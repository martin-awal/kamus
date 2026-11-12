"""Wikidepia/indonesian-tts (VITS, Coqui TTS) as an optional offline TTS engine, CPU only.

It needs Python 3.10 + Coqui TTS 0.8, so it lives in its own environment (.tts-env, see scripts/install_wikidepia.sh)
and is driven through a long-running worker process.
"""
import hashlib
import json
import select
import subprocess
import threading
from pathlib import Path

HERE = Path(__file__).parent
ENV_PY = HERE / ".tts-env" / "bin" / "python"
MODEL_DIR = HERE / "models" / "wikidepia-v1.2"
MODEL_FILES = {"checkpoint_1260000-inference.pth": 345_999_149, "config.json": 9071, "speakers.pth": 1839}
SPEAKERS = ["wibowo", "ardi", "gadis"]

_lock = threading.Lock()
_proc = None
_info = {"load_seconds": None, "last_seconds": None, "error": None}


def _model_ok():
    return all((MODEL_DIR / n).exists() and (MODEL_DIR / n).stat().st_size == s for n, s in MODEL_FILES.items())


def status():
    return {"env": ENV_PY.exists(), "model": _model_ok(), "web": web_model_status(), "loaded": _proc is not None and _proc.poll() is None,
            "ready": ENV_PY.exists() and _model_ok(), "speakers": SPEAKERS, **_info}


def _start():
    global _proc
    if _proc is not None and _proc.poll() is None:
        return
    _proc = subprocess.Popen([str(ENV_PY), str(HERE / "wikidepia_worker.py"), str(MODEL_DIR)], stdin=subprocess.PIPE,
                             stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, bufsize=1,
                             cwd=str(MODEL_DIR))  # config.json refers to speakers.pth by relative path
    if not select.select([_proc.stdout], [], [], 300)[0]:
        _proc.kill()
        raise RuntimeError("model did not load within 300 s")
    first = json.loads(_proc.stdout.readline() or "{}")
    if not first.get("ready"):
        raise RuntimeError("worker failed to start")
    _info["load_seconds"] = first["load_seconds"]


_pz_lock = threading.Lock()
_pz = None
_pz_cache = {}


def phonemize(text):
    """Text -> phonemes for the in-browser model. A tiny separate process (no model loaded), results cached."""
    global _pz
    text = " ".join(text.split())[:300]
    if text in _pz_cache:
        return _pz_cache[text]
    if not ENV_PY.exists():
        raise RuntimeError("Wikidepia environment is not installed (run scripts/install_wikidepia.sh)")
    with _pz_lock:
        if _pz is None or _pz.poll() is not None:
            _pz = subprocess.Popen([str(ENV_PY), str(HERE / "phonemize_worker.py"), str(MODEL_DIR / "config.json")], stdin=subprocess.PIPE,
                                   stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, bufsize=1)
            if not select.select([_pz.stdout], [], [], 120)[0] or not json.loads(_pz.stdout.readline() or "{}").get("ready"):
                _pz.kill()
                raise RuntimeError("phonemizer failed to start")
        _pz.stdin.write(json.dumps({"text": text}) + "\n")
        _pz.stdin.flush()
        if not select.select([_pz.stdout], [], [], 30)[0]:
            _pz.kill()
            raise RuntimeError("phonemizer timed out")
        res = json.loads(_pz.stdout.readline())
    if "error" in res:
        raise RuntimeError(res["error"])
    if len(_pz_cache) > 2000:
        _pz_cache.clear()
    _pz_cache[text] = res["phonemes"]
    return res["phonemes"]


def web_model_status():
    web = MODEL_DIR / "web"
    return {"onnx": (web / "vits.onnx").exists(), "bytes": (web / "vits.onnx").stat().st_size if (web / "vits.onnx").exists() else 0}


def synth(text, speaker, cache_dir, speed=1.0):
    """Returns wav bytes. Raises RuntimeError if the engine is not installed or fails."""
    if not status()["ready"]:
        raise RuntimeError("Wikidepia TTS is not installed (run scripts/install_wikidepia.sh)")
    speaker = speaker if speaker in SPEAKERS else "wibowo"
    key = f"wikidepia|{speaker}|{text}" if speed == 1 else f"wikidepia|{speaker}|x{speed:.2f}|{text}"
    path = cache_dir / (hashlib.sha1(key.encode()).hexdigest() + ".wav")
    if not path.exists():
        with _lock:
            try:
                _start()
                _proc.stdin.write(json.dumps({"text": text, "speaker": speaker, "out": str(path), "speed": speed}) + "\n")
                _proc.stdin.flush()
                if not select.select([_proc.stdout], [], [], 120)[0]:
                    _proc.kill()
                    raise RuntimeError("synthesis timed out")
                res = json.loads(_proc.stdout.readline())
            except Exception as exc:
                _info["error"] = str(exc)
                raise RuntimeError(str(exc))
        if not res.get("ok"):
            _info["error"] = res.get("error")
            raise RuntimeError(res.get("error", "synthesis failed"))
        _info["last_seconds"], _info["error"] = res["seconds"], None
    return path.read_bytes()
