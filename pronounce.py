"""Rule-based approximate IPA for Indonesian (spelling is quite regular)."""
import re

DIGRAPHS = [("ng", "ŋ"), ("ny", "ɲ"), ("sy", "ʃ"), ("kh", "x"), ("gh", "ɣ")]
SINGLE = {"c": "tʃ", "j": "dʒ", "y": "j", "r": "r", "ĕ": "ə", "é": "e", "è": "ɛ"}


def ipa(word):
    w = word.lower().replace("·", "")
    out, i = [], 0
    while i < len(w):
        for dg, sym in DIGRAPHS:
            if w.startswith(dg, i):
                out.append(sym); i += 2; break
        else:
            ch = w[i]
            if ch == "e":
                out.append("ə")  # default; é/ĕ marked words are exceptions KBBI sometimes flags
            elif ch == "k" and (i == len(w) - 1 or not w[i + 1].isalpha()):
                out.append("ʔ")  # final k is a glottal stop
            else:
                out.append(SINGLE.get(ch, ch))
            i += 1
    return "/" + "".join(out) + "/"
