"""Indonesian text -> IPA phonemes in the form the Wikidepia model was trained on. Runs inside .tts-env (needs g2p-id).

The model expects stress marks (README: "saja səˈdanʔ ˈbərada di dʒaˈkarta.") and U+0261 for g, and has a fixed character set.
The current g2p-id gives plain IPA, so stress (penultimate, or final when the penultimate vowel is a schwa) and symbol clean-up
are added here. Shared by the server-side synthesis worker and by the phonemizer used for in-browser synthesis.
"""
import json
from pathlib import Path

VOWELS = set("aeiouəɛɔɪʊ")


def make_phonemizer(config_path):
    from g2p_id import G2P
    g2p = G2P()
    cfg = json.loads(Path(config_path).read_text())["characters"]
    allowed = set(cfg["characters"] + cfg["punctuations"])

    def syllables(word):
        toks, i = [], 0
        while i < len(word):
            if word[i:i + 2] in ("dʒ", "tʃ"):
                toks.append(word[i:i + 2])
                i += 2
            else:
                toks.append(word[i])
                i += 1
        nuclei = [i for i, t in enumerate(toks) if t in VOWELS]
        cuts = [0]
        for a, b in zip(nuclei, nuclei[1:]):
            k = b - a - 1                       # consonants between two vowels: V|V, V|CV, VC|CV
            cuts.append(b if k == 0 else a + 1 if k == 1 else a + 2)
        cuts.append(len(toks))
        return ["".join(toks[x:y]) for x, y in zip(cuts, cuts[1:])]

    def phonemize(text):
        ph, _ = g2p.to_phoneme(text)
        out = []
        for word in ph.replace("-", " ").split():
            tail = ""
            while word and word[-1] in ".,!?":
                tail, word = word[-1] + tail, word[:-1]
            syl = syllables(word.replace("g", "ɡ"))
            if len(syl) >= 2:
                i = len(syl) - 2
                if "ə" in syl[i]:
                    i = len(syl) - 1
                syl[i] = "ˈ" + syl[i]
            out.append("".join(syl) + tail)
        return "".join(c for c in " ".join(out) if c in allowed)

    return phonemize
