"""Tiny worker (runs in .tts-env): JSON lines {"text"} -> {"phonemes"}. No model is loaded, so it is cheap to keep running."""
import json
import sys

from wikidepia_phonemize import make_phonemizer

real_out, sys.stdout = sys.stdout, sys.stderr
phonemize = make_phonemizer(sys.argv[1])
real_out.write(json.dumps({"ready": True}) + "\n")
real_out.flush()
for line in sys.stdin:
    try:
        res = {"phonemes": phonemize(json.loads(line)["text"])}
    except Exception as exc:
        res = {"error": f"{type(exc).__name__}: {exc}"}
    real_out.write(json.dumps(res) + "\n")
    real_out.flush()
