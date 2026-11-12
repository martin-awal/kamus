"""Runs inside .argos-env (Python 3.11 + Argos Translate): JSON lines {text, from, to} -> {text}."""
import json
import sys

real_out, sys.stdout = sys.stdout, sys.stderr
import argostranslate.translate as t  # noqa: E402

real_out.write(json.dumps({"ready": True}) + "\n")
real_out.flush()
for line in sys.stdin:
    try:
        req = json.loads(line)
        res = {"text": t.translate(req["text"], req["from"], req["to"])}
    except Exception as exc:
        res = {"error": f"{type(exc).__name__}: {exc}"}
    real_out.write(json.dumps(res) + "\n")
    real_out.flush()
