"""Rebuilds static/data/wordlist-id.txt: single lowercase titles of English Wiktionary's Indonesian lemmas and non-lemma forms.

The stemmer checks base words against this list. The titles come from en.wiktionary.org (CC BY-SA 4.0); the list is a snapshot, refresh it now
and then:  python3 scripts/build_wordlist.py        (about a minute, about 50 requests to the Wikimedia API)
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request

API = "https://en.wiktionary.org/w/api.php"
UA = "kamus-wordlist-builder/1.0 (+https://github.com/martin-awal/kamus)"
CATS = ["Category:Indonesian_lemmas", "Category:Indonesian_non-lemma_forms"]


def members(cat):
    cont = ""
    while True:
        q = {"action": "query", "list": "categorymembers", "cmtitle": cat, "cmlimit": "500", "cmnamespace": "0", "cmprop": "title", "format": "json"}
        if cont:
            q["cmcontinue"] = cont
        req = urllib.request.Request(API + "?" + urllib.parse.urlencode(q), headers={"User-Agent": UA})
        data = json.load(urllib.request.urlopen(req, timeout=30))
        for m in data["query"]["categorymembers"]:
            yield m["title"]
        cont = data.get("continue", {}).get("cmcontinue", "")
        if not cont:
            return
        time.sleep(0.2)


words = set()
for cat in CATS:
    for t in members(cat):
        if re.fullmatch(r"[a-z]+", t):   # single lowercase words only: no names, no phrases
            words.add(t)
    print(cat, len(words), file=sys.stderr)
out = "static/data/wordlist-id.txt"
open(out, "w", encoding="utf-8").write("\n".join(sorted(words)) + "\n")
print(f"{len(words)} words written to {out}")
