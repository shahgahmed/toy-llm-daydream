#!/usr/bin/env python3
"""
Fetch all Level‑1‑to‑5 Vital Articles and write them to wiki_seeds.csv.
"""

import csv, itertools, requests

# Per WMF's API Etiquette policy, all clients must set a custom User-Agent.
# https://meta.wikimedia.org/wiki/User-Agent_policy
S = requests.Session()
S.headers.update({"User-Agent": "wikigrab/1.0 (https://github.com/your-name/your-repo)"})

# ---------- Vital Articles (Levels 1‑5) ----------
def get_vital(level):
    """
    Hit the CategoryMembers API for each Level‑X vital‑article category
    and yield plain page titles.  Level   1 = 10      articles
                                         2 = 100     articles
                                         3 = 1,000   articles
                                         4 = 10,000  articles
                                         5 = 50,000  articles
    """
    cat = f"Category:Wikipedia_level-{level}_vital_articles"
    yield from get_vital_recursive(cat)

def get_vital_recursive(category):
    cmcontinue = None
    while True:
        resp = S.get(
            "https://en.wikipedia.org/w/api.php",
            params={
                "action": "query",
                "format": "json",
                "list": "categorymembers",
                "cmtitle": category,
                "cmlimit": "500",
                "cmtype": "page|subcat",
                **({"cmcontinue": cmcontinue} if cmcontinue else {}),
            },
            timeout=20,
        )
        resp.raise_for_status()
        data = resp.json()
        for page in data["query"]["categorymembers"]:
            if page["ns"] == 14:  # Is a subcategory
                yield from get_vital_recursive(page["title"])
            elif page["ns"] == 1:  # Article talk page
                # The Vital Articles project categorizes talk pages.
                # The title will be "Talk:Article name", so we strip the prefix.
                yield page["title"][5:]
            elif page["ns"] == 0:  # Article page
                # It's rare, but an article could be directly in a vital category.
                yield page["title"]
        cmcontinue = data.get("continue", {}).get("cmcontinue")
        if not cmcontinue:
            break

vital_titles = set(itertools.chain.from_iterable(get_vital(lvl) for lvl in (1, 2, 3, 4, 5)))
print(f"Fetched {len(vital_titles):,} vital-article titles.")

# ---------- Write to CSV ----------
all_titles = sorted(vital_titles)
with open("wiki_seeds.csv", "w", newline="", encoding="utf-8") as f:
    csv.writer(f).writerows([[t] for t in all_titles])

print(f"Wrote {len(all_titles):,} vital article titles to wiki_seeds.csv")
