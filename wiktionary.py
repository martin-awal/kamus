"""English glosses, examples, IPA and audio from en.wiktionary.org (official REST + action API, CC BY-SA)."""
import html
import os
import re
import requests


# Wikimedia asks API clients to put contact details in the User-Agent. Set KAMUS_CONTACT (an email or a URL) in your own environment;
# it is never stored in the repository.
UA = "kamus-personal-learning-tool/0.1" + (f" ({os.environ['KAMUS_CONTACT']})" if os.environ.get("KAMUS_CONTACT") else "")
REST = "https://en.wiktionary.org/api/rest_v1/page/definition/{}"
API = "https://en.wiktionary.org/w/api.php"


def _text(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s or "")).strip()


def _get(url, **kw):
    r = requests.get(url, headers={"User-Agent": UA}, timeout=15, **kw)
    if r.status_code == 404:
        return None
    r.raise_for_status()
    return r


def _pronunciation(word):
    r = _get(API, params={"action": "parse", "page": word, "prop": "text", "format": "json",
                          "formatversion": 2, "disabletoc": 1})
    if not r or "parse" not in r.json():
        return {"ipa": [], "audio": []}
    page = r.json()["parse"]["text"]
    i = page.find('id="Indonesian"')
    if i < 0:
        return {"ipa": [], "audio": []}
    j = page.find("<h2", i + 1)
    sec = page[i:j if j > 0 else None]
    ipa = [x for x in dict.fromkeys(re.findall(r'class="IPA[^"]*"[^>]*>([^<]+)<', sec)) if x[0] in "/["]
    audio = list(dict.fromkeys("https:" + u if u.startswith("//") else u for u in
                               re.findall(r'(?:https:)?//upload\.wikimedia\.org/[^"\'\s]+\.(?:ogg|mp3|wav|opus)', sec)))
    return {"ipa": ipa, "audio": audio}


def lookup(word):
    r = _get(REST.format(requests.utils.quote(word)))
    senses = []
    if r:
        for block in r.json().get("id", []):
            for d in block["definitions"]:
                gloss = _text(d["definition"])
                if not gloss:
                    continue
                ex = [{"id": _text(e["example"]), "en": _text(e.get("translation", ""))}
                      for e in d.get("parsedExamples", [])]
                senses.append({"pos": block["partOfSpeech"].lower(), "gloss": gloss, "examples": ex})
    pron = _pronunciation(word)
    return {"senses": senses, **pron, "url": f"https://en.wiktionary.org/wiki/{word}#Indonesian"}
