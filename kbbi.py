"""Fetch and parse an entry from kbbi.web.id (Indonesian definitions, examples, syllables)."""
import html
import re
import time

import requests

URL = "https://kbbi.web.id/{}"
UA = "kamus-personal-learning-tool/0.1"


_last = [0.0]
MIN_GAP = 0.6  # seconds between requests to kbbi.web.id, to stay polite


def fetch(word, _retry=True):
    wait = MIN_GAP - (time.time() - _last[0])
    if wait > 0:
        time.sleep(wait)
    _last[0] = time.time()
    r = requests.get(URL.format(requests.utils.quote(word)), headers={"User-Agent": UA}, timeout=15)
    if r.status_code in (429, 503) and _retry:  # rate limited: back off once
        time.sleep(2)
        return fetch(word, _retry=False)
    r.raise_for_status()
    return r.text


def _text(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s)).strip()


def _parse_sense(chunk, headword):
    """One numbered sense: pos tags, definition, example sentences (italic, '--' = headword)."""
    pos = []
    m = re.match(r"\s*<em>(.*?)</em>", chunk)
    if m:
        pos = _text(m.group(1)).split()
        chunk = chunk[m.end():]
    chunk = re.sub(r"--\s*<em>", "<em>-- ", chunk)  # headword placeholder directly before the example
    examples = [part.strip() for e in re.findall(r"<em>(.*?)</em>", chunk) for part in _text(e).split(";")]   # one <em> can hold several examples joined by ';'
    definition = _text(re.sub(r"<em>.*?</em>", "", chunk)).rstrip(":; ").strip()
    own = lambda s: re.sub(r"--|~", headword, s)   # KBBI writes the headword as '--' or '~' inside examples and definitions
    examples = [re.sub(r"\s+", " ", re.sub(r"\s*,\s*(?:ki|cak|kl|ark|n|v|a)$", "", own(e).strip(" ;,")).replace(" ,", ","))
                for e in examples if len(e) > 3]
    definition = re.sub(r"\s*:\s*;", ";", definition)
    definition = re.sub(r"\s*;\s*;", ";", definition).strip(" :;")
    definition = own(definition)
    return {"pos": pos, "definition": definition, "examples": examples}


def parse(page):
    m = re.search(r'<div id="d1">(.*?)</div>', page, re.S)
    if not m:
        return []
    entries = []
    # each entry starts with a bold headword that carries syllable dots (&#183;) or a superscript
    parts = re.split(r"(?=<b>[^<]*(?:&#183;|<sup>)[^<]*(?:<sup>\d</sup>)?</b>\s*<em>)", m.group(1))
    for part in parts:
        h = re.match(r"<b>(.*?)</b>", part)
        if not h:
            continue
        syll = re.sub(r"<sup>.*?</sup>", "", h.group(1))
        syllables = _text(syll)
        headword = syllables.replace("·", "")
        body = part[h.end():]
        body = re.split(r"<br\s*/?>", body)[0]
        # drop idioms/compounds after the first '--' compound marker at sense level
        sense_chunks = re.split(r"<b>\d+</b>", body)
        senses = []
        for c in sense_chunks:
            c = c.strip()
            if not c:
                continue
            c = re.split(r";?\s*--\s*<em>[^<]*,\s*(?:pb|ki|ark)", c)[0]  # cut idiom list
            s = _parse_sense(c, headword)
            if s["definition"]:
                senses.append(s)
        if senses:
            entries.append({"headword": headword, "syllables": syllables, "senses": senses[:10]})
    return entries


# Indonesian affix stripping. KBBI lists derived words (merokok) under their base word (rokok),
# so an exact-word page often does not exist.
PREFIXES = [("meng", ["", "k"]), ("meny", ["s"]), ("men", ["", "t"]), ("mem", ["", "p"]), ("me", [""]),
            ("peng", ["", "k"]), ("peny", ["s"]), ("pen", ["", "t"]), ("pem", ["", "p"]), ("pe", [""]),
            ("ber", [""]), ("be", [""]), ("ter", [""]), ("te", [""]), ("per", [""]),
            ("di", [""]), ("ke", [""]), ("se", [""])]
SUFFIXES = ["kan", "an", "i", "lah", "kah", "nya"]


def stem_candidates(word):
    out = []

    def add(c):
        if len(c) >= 3 and c != word and c not in out:
            out.append(c)

    for irregular in ("pel", "bel"):   # the only roots that take these: ajar (pelajar, pelajaran, belajar)
        if word.startswith(irregular + "ajar"):
            add(word[len(irregular):])
            for suf in SUFFIXES:
                if word.endswith(suf) and len(word) - len(suf) > len(irregular) + 3:
                    add(word[len(irregular):-len(suf)])
    for suf in [""] + SUFFIXES:
        if suf and not word.endswith(suf):
            continue
        stem = word[:-len(suf)] if suf else word
        if suf:
            add(stem)
        for pre, reps in PREFIXES:
            if stem.startswith(pre):
                for r in reps:
                    add(r + stem[len(pre):])
    return out


def lookup(word):
    """Returns (entries, base_word). base_word is set when the entry was found under another word."""
    entries = parse(fetch(word))
    if entries or " " in word:
        return entries, None
    for base in stem_candidates(word)[:6]:
        try:
            found = parse(fetch(base))
        except requests.RequestException:
            continue
        # only accept a base page that really lists the searched word ('akan' also exists, but is not 'memakan')
        hit = next((e for e in found if e["headword"] == word), None)
        if hit:
            return [hit] + [e for e in found if e is not hit], base
    return [], None
