import { NextRequest } from "next/server";
import OpenAI from "openai";
import { promises as fs } from "fs";
import path from "path";

type ActiveConceptsData = [string, string];
interface FinishedThoughtData {
  thought: string;
  critique: string;
  concepts: [string, string];
}
interface StreamEvent {
  event: "active_concepts" | "finished_thought";
  data: ActiveConceptsData | FinishedThoughtData;
}

async function* makeIterator(
  apiKey: string,
  turns: number,
  titles: string[]
): AsyncGenerator<StreamEvent, void, unknown> {
  const openai = new OpenAI({ apiKey });

  for (let i = 0; i < turns; i++) {
    const concept1 = titles[Math.floor(Math.random() * titles.length)];
    const concept2 = titles[Math.floor(Math.random() * titles.length)];

    yield { event: "active_concepts", data: [concept1, concept2] };

    const synthesizerPrompt = `[SYSTEM]
You are a creative synthesizer. Your task is to find deep, non-obvious,
and potentially groundbreaking connections between the two following concepts.
Do not state the obvious. Generate a hypothesis, a novel analogy,
a potential research question, or a creative synthesis.
Be speculative but ground your reasoning.

Concept 1: ${concept1}
Concept 2: ${concept2}

Think step-by-step to explore potential connections:

#. Are these concepts analogous in some abstract way?
#. Could one concept be a metaphor for the other?
#. Do they represent a similar problem or solution in different domains?
#. Could they be combined to create a new idea or solve a problem?
#. What revealing contradiction or tension exists between them?

Synthesize your most interesting finding below.
[ASSISTANT]`;

    const synthesizerResponse = await openai.chat.completions.create({
      model: "o4-mini",
      messages: [{ role: "user", content: synthesizerPrompt }],
    });

    const thought = synthesizerResponse.choices[0].message.content;

    if (thought) {
      const criticPrompt = `[SYSTEM]
You are a discerning critic. Evaluate the following hypothesis
on a scale of 1--10 for each of the following criteria:

- **Novelty:** Is this idea surprising and non-obvious? (1=obvious, 10=paradigm-shifting)
- **Coherence:** Is the reasoning logical and well-formed? (1=nonsense, 10=rigorous)
- **Usefulness:** Could this idea lead to a testable hypothesis, a new product,
  or a solution to a problem? (1=useless, 10=highly applicable)

Hypothesis: ${thought}

First, provide your scores in the format:
Novelty: [score]/10
Coherence: [score]/10
Usefulness: [score]/10

Then, provide a brief justification for your scores.
[ASSISTANT]`;

      const criticResponse = await openai.chat.completions.create({
        model: "o4-mini",
        messages: [{ role: "user", content: criticPrompt }],
      });

      const critique = criticResponse.choices[0].message.content;

      if (critique) {
        yield {
          event: "finished_thought",
          data: {
            thought,
            critique,
            concepts: [concept1, concept2],
          },
        };
      }
    }
  }
}

function iteratorToStream(iterator: AsyncGenerator<StreamEvent, void, unknown>) {
  return new ReadableStream({
    async pull(controller) {
      const { value, done } = await iterator.next();

      if (done) {
        controller.close();
      } else {
        controller.enqueue(
          new TextEncoder().encode(`data: ${JSON.stringify(value)}\n\n`)
        );
      }
    },
  });
}

export async function POST(req: NextRequest) {
  const { apiKey, turns } = await req.json();

  if (!apiKey || !turns) {
    return new Response("Missing apiKey or turns", { status: 400 });
  }

  const csvPath = path.join(process.cwd(), "scraper", "wiki_seeds.csv");
  const file = await fs.readFile(csvPath, "utf-8");
  const titles = file.split("\n").filter(Boolean);

  const iterator = makeIterator(apiKey, turns, titles);
  const stream = iteratorToStream(iterator);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
} 