"""Optional KBBI source: a server that speaks the kbbi-api JSON format (https://github.com/raf555/kbbi-api, /api/v1/entry/<word>).

Set KAMUS_KBBI_API_URL on the Kamus server (for example https://kbbi.example.org); it is never sent by the browser. KBBI content belongs
to Badan Pengembangan dan Pembinaan Bahasa: personal, non-commercial use only. Returns the same entry shape as kbbi.py.
"""
import os
import re
import time

import requests

import kbbi

UA = "kamus-personal-learning-tool/0.1"
_last = [0.0]
MIN_GAP = 0.3


def base_url():
    url = (os.environ.get("KAMUS_KBBI_API_URL") or "").strip().rstrip("/")
    return url if re.match(r"^https?://", url) else ""


def _entry(raw):
    name = re.sub(r"\s*\(\d+\)\s*$", "", raw.get("entry") or "")   # "makan (1)": the homonym number is not part of the word
    syllables = name.replace(".", "·")
    headword = name.replace(".", "")
    senses = []
    for d in raw.get("definitions") or []:
        own = lambda s: re.sub(r"--|~", headword, s)   # the dictionary writes the headword as '--' or '~' inside examples and definitions
        text = own((d.get("definition") or "").strip()).strip(" :;")
        if not text and d.get("referencedLemma"):
            text = "lihat " + d["referencedLemma"]
        if not text:
            continue
        senses.append({"pos": [l["code"] for l in d.get("labels") or [] if l.get("code")], "definition": text,
                       "examples": [own(x).strip() for x in d.get("usageExamples") or [] if len(x.strip()) > 3]})
    return {"headword": headword, "syllables": syllables, "senses": senses[:10]} if senses else None


def _fetch(word):
    wait = MIN_GAP - (time.time() - _last[0])
    if wait > 0:
        time.sleep(wait)
    _last[0] = time.time()
    r = requests.get(f"{base_url()}/api/v1/entry/{requests.utils.quote(word)}", headers={"User-Agent": UA}, timeout=15)
    if r.status_code == 404:
        return []
    r.raise_for_status()
    return [e for e in (_entry(x) for x in r.json().get("entries") or []) if e]


def lookup(word):
    """Returns (entries, base_word) like kbbi.lookup."""
    if not base_url():
        raise RuntimeError("KAMUS_KBBI_API_URL is not set on the server")
    entries = _fetch(word)
    if entries or " " in word:
        return entries, None
    for base in kbbi.stem_candidates(word)[:6]:
        found = _fetch(base)
        if found:
            return found, base
    return [], None
