"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Settings, ArrowUpDown, Loader2 } from "lucide-react";

interface Thought {
  thought: string;
  critique: string;
  concepts: string[];
  novelty: number;
  coherence: number;
  usefulness: number;
}

export default function Home() {
  const [apiKey, setApiKey] = useState("");
  const [turns, setTurns] = useState(5);
  const [running, setRunning] = useState(false);
  const [finishedThoughts, setFinishedThoughts] = useState<Thought[]>([]);
  const [activeConcepts, setActiveConcepts] = useState<string[] | null>(null);
  const [sortedThoughts, setSortedThoughts] = useState<Thought[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  const [selectedThought, setSelectedThought] = useState<Thought | null>(null);

  useEffect(() => {
    const sorted = [...finishedThoughts].sort((a, b) => b.novelty - a.novelty);
    setSortedThoughts(sorted);
  }, [finishedThoughts]);

  const startDaydreaming = async () => {
    setRunning(true);
    setFinishedThoughts([]);
    setActiveConcepts(null);

    try {
      const response = await fetch("/api/daydream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, turns }),
      });

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const json = line.substring(6);
            if (json) {
              const { event, data } = JSON.parse(json);

              if (event === "active_concepts") {
                setActiveConcepts(data);
              } else if (event === "finished_thought") {
                const { scores, justification } = parseCritique(data.critique);
                setFinishedThoughts((prev) => [
                  ...prev,
                  {
                    ...data,
                    novelty: scores.Novelty,
                    coherence: scores.Coherence,
                    usefulness: scores.Usefulness,
                    critique: justification,
                  },
                ]);
                setActiveConcepts(null);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Streaming error:", error);
    } finally {
      setRunning(false);
      setActiveConcepts(null);
    }
  };

  const parseCritique = (critique: string) => {
    const scores: { Novelty: number; Coherence: number; Usefulness: number } = {
      Novelty: 0, Coherence: 0, Usefulness: 0,
    };
    let justification = critique;

    const scoreRegex = /(Novelty|Coherence|Usefulness):\s*(\d+)\/10/gi;
    let match;
    let lastIndex = -1;

    while ((match = scoreRegex.exec(critique)) !== null) {
      const key = match[1] as keyof typeof scores;
      scores[key] = parseInt(match[2], 10);
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex !== -1) {
      justification = critique.substring(lastIndex).trim();
    }
    
    return { scores, justification };
  };

  return (
    <div className="bg-background text-foreground min-h-screen">
      <header className="p-4 flex justify-between items-center border-b">
        <div className="flex items-center space-x-2">
          <h1 className="text-xl font-semibold">LLM Daydreaming</h1>
        </div>
        <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Settings</DialogTitle>
              <DialogDescription>
                Configure your OpenAI API key and the number of daydreams.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Input
                type="password"
                placeholder="OpenAI API Key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <Input
                type="number"
                placeholder="Number of Turns"
                value={turns}
                min="1"
                onChange={(e) => setTurns(Number(e.target.value))}
              />
            </div>
            <DialogFooter>
              <Button onClick={() => setIsSettingsOpen(false)}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <main className="p-4 md:p-8 grid gap-8 grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Controls</CardTitle>
              <CardDescription>Start the daydreaming process.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                onClick={startDaydreaming}
                disabled={running || !apiKey}
              >
                {running ? "Daydreaming..." : "Start Daydreaming"}
              </Button>
            </CardContent>
          </Card>

          {running && (
            <Card className="mt-8">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <span>Active Thought</span>
                  <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                </CardTitle>
                <CardDescription>The LLM is currently pondering...</CardDescription>
              </CardHeader>
              <CardContent className="h-24 flex items-center justify-center">
                {activeConcepts && (
                  <div className="text-center">
                    <p className="font-semibold text-lg">{activeConcepts[0]}</p>
                    <p className="text-muted-foreground text-sm my-2">&</p>
                    <p className="font-semibold text-lg">{activeConcepts[1]}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Finished Thoughts</CardTitle>
              <CardDescription>
                Insights and critiques generated by the LLM. Ranked by novelty.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sortedThoughts.length > 0 ? (
                <Accordion type="single" collapsible className="w-full">
                  {sortedThoughts.map((thought, index) => (
                    <AccordionItem key={index} value={`item-${index}`}>
                      <AccordionTrigger>
                        <div className="flex justify-between w-full pr-4">
                          <span>{thought.concepts.join(" & ")}</span>
                          <div className="text-right text-sm text-muted-foreground">
                            <span>Usefulness {thought.usefulness}/10</span>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4 pt-2">
                          <div>
                            <h3 className="font-semibold text-md mb-2">Synthesis</h3>
                            <p className="text-muted-foreground text-sm">{thought.thought}</p>
                          </div>
                          <div>
                            <h3 className="font-semibold text-md mb-2">Critique</h3>
                            <div className="flex justify-around bg-muted p-4 rounded-lg mb-2">
                              <div className="text-center">
                                <p className="font-bold text-lg">{thought.novelty}/10</p>
                                <p className="text-xs text-muted-foreground">Novelty</p>
                              </div>
                              <div className="text-center">
                                <p className="font-bold text-lg">{thought.coherence}/10</p>
                                <p className="text-xs text-muted-foreground">Coherence</p>
                              </div>
                              <div className="text-center">
                                <p className="font-bold text-lg">{thought.usefulness}/10</p>
                                <p className="text-xs text-muted-foreground">Usefulness</p>
                              </div>
                            </div>
                            <p className="text-muted-foreground text-sm">{thought.critique}</p>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <div className="text-center py-10">
                  <p className="text-muted-foreground">No thoughts yet. Start daydreaming to begin.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
