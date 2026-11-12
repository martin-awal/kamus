"""Runs inside .tts-env (Python 3.10 + Coqui TTS 0.8 + g2p-id). Reads JSON lines on stdin, writes wavs, answers on stdout.

Started on demand by wikidepia.py; the model stays loaded between requests (CPU inference only).
"""
import json
import sys
import time
from pathlib import Path

real_out = sys.stdout
sys.stdout = sys.stderr  # library chatter must not corrupt the JSON protocol


def reply(obj):
    real_out.write(json.dumps(obj) + "\n")
    real_out.flush()


model_dir = Path(sys.argv[1])
t0 = time.time()
from TTS.utils.synthesizer import Synthesizer  # noqa: E402
from wikidepia_phonemize import make_phonemizer  # noqa: E402

syn = Synthesizer(tts_checkpoint=str(model_dir / "checkpoint_1260000-inference.pth"),
                  tts_config_path=str(model_dir / "config.json"),
                  tts_speakers_file=str(model_dir / "speakers.pth"), use_cuda=False)

phonemize = make_phonemizer(str(model_dir / "config.json"))
reply({"ready": True, "load_seconds": round(time.time() - t0, 1),
       "speakers": [n for n in ("wibowo", "ardi", "gadis") if n in syn.tts_model.speaker_manager.ids]})

for line in sys.stdin:
    req = json.loads(line)
    t = time.time()
    try:
        syn.tts_model.length_scale = 1.0 / float(req.get("speed", 1.0))   # VITS: bigger length_scale = slower speech
        phonemes = phonemize(req["text"])
        wav = syn.tts(phonemes, speaker_name=req["speaker"])
        syn.save_wav(wav, req["out"])
        reply({"ok": True, "seconds": round(time.time() - t, 2), "phonemes": phonemes})
    except Exception as exc:
        reply({"ok": False, "error": f"{type(exc).__name__}: {exc}"})
