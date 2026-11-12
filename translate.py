"""Machine translation for card text (Indonesian <-> English), with three interchangeable engines:

  mymemory        free web API (api.mymemory.translated.net), no setup, anonymous daily quota
  argos           Argos Translate (MIT), offline neural models, runs in its own environment (.argos-env, scripts/install_argos.sh)
  libretranslate  any LibreTranslate server (open source, self-hostable); URL and optional API key come from Settings
Results are cached (cache.db), so a sentence is only translated once.
"""
import glob
import html
import json
import os
import re
import select
import sqlite3
import subprocess
import threading
from pathlib import Path

import requests

HERE = Path(__file__).parent
ARGOS_PY = HERE / ".argos-env" / "bin" / "python"
UA = "kamus-personal-learning-tool/0.1"
_DB = sqlite3.connect(HERE / "cache.db", check_same_thread=False)
_DB.execute("create table if not exists tr (key text primary key, val text)")
_lock = threading.Lock()
_argos = None


def _argos_models():
    base = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local/share")) / "argos-translate" / "packages"
    return bool(glob.glob(str(base / "translate-id_en*"))) and bool(glob.glob(str(base / "translate-en_id*")))


OPUS_FILES = ["config.json", "generation_config.json", "tokenizer.json", "tokenizer_config.json", "special_tokens_map.json",
              "onnx/encoder_model_quantized.onnx", "onnx/decoder_model_merged_quantized.onnx"]


def _opus():
    """Opus-MT files that browsers can download (scripts/download_opus_mt.sh) for in-browser translation."""
    base = HERE / "models" / "opus-mt" / "Xenova"
    out = {}
    for d in ("id-en", "en-id"):
        m = base / f"opus-mt-{d}"
        files = [{"path": f"/models/opus-mt/Xenova/opus-mt-{d}/{f}", "size": (m / f).stat().st_size if (m / f).exists() else 0} for f in OPUS_FILES]
        out[d] = {"available": all(x["size"] > 0 for x in files), "files": files, "bytes": sum(x["size"] for x in files)}
    return out


def status():
    return {"mymemory": {"ready": True}, "argos": {"ready": ARGOS_PY.exists() and _argos_models(), "env": ARGOS_PY.exists()},
            "libretranslate": {"ready": True}, "opusmt": _opus()}


def _chunks(text, limit=450):
    """MyMemory takes about 500 bytes per request: split long text at sentence ends."""
    if len(text.encode()) <= limit:
        return [text]
    out, cur = [], ""
    for s in re.split(r"(?<=[.!?])\s+", text):
        if cur and len((cur + " " + s).encode()) > limit:
            out.append(cur)
            cur = s
        else:
            cur = (cur + " " + s).strip()
    return out + [cur] if cur else out


def _mymemory(text, src, dst):
    parts = []
    for ch in _chunks(text):
        r = requests.get("https://api.mymemory.translated.net/get", params={"q": ch, "langpair": f"{src}|{dst}"},
                         headers={"User-Agent": UA}, timeout=20)
        r.raise_for_status()
        j = r.json()
        out = html.unescape(j["responseData"]["translatedText"])
        if str(j.get("responseStatus")) != "200" or "MYMEMORY WARNING" in out.upper():
            raise RuntimeError("MyMemory: " + out[:120])
        parts.append(out)
    return " ".join(parts)


def _argos_worker():
    global _argos
    if _argos is None or _argos.poll() is not None:
        if not (ARGOS_PY.exists() and _argos_models()):
            raise RuntimeError("Argos Translate is not installed (run scripts/install_argos.sh)")
        _argos = subprocess.Popen([str(ARGOS_PY), str(HERE / "argos_worker.py")], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                  stderr=subprocess.DEVNULL, text=True, bufsize=1)
        if not select.select([_argos.stdout], [], [], 180)[0] or not json.loads(_argos.stdout.readline() or "{}").get("ready"):
            _argos.kill()
            raise RuntimeError("Argos Translate failed to start")
    return _argos


def _argos_translate(text, src, dst):
    with _lock:
        w = _argos_worker()
        w.stdin.write(json.dumps({"text": text, "from": src, "to": dst}) + "\n")
        w.stdin.flush()
        if not select.select([w.stdout], [], [], 120)[0]:
            w.kill()
            raise RuntimeError("Argos Translate timed out")
        res = json.loads(w.stdout.readline())
    if "error" in res:
        raise RuntimeError(res["error"])
    return res["text"]


def _libre(text, src, dst, url, key):
    if not re.match(r"^https?://", url or ""):
        raise RuntimeError("LibreTranslate URL is not set (Settings -> Translation)")
    body = {"q": text, "source": src, "target": dst, "format": "text"}
    if key:
        body["api_key"] = key
    r = requests.post(url.rstrip("/") + "/translate", json=body, headers={"User-Agent": UA}, timeout=30)
    if r.status_code != 200:
        raise RuntimeError(f"LibreTranslate: HTTP {r.status_code} {r.text[:100]}")
    return r.json()["translatedText"]


def translate(text, src, dst, engine="mymemory", url=None, key=None):
    text = " ".join(str(text).split())[:1200]
    if not text:
        raise ValueError("empty text")
    if (src, dst) not in (("id", "en"), ("en", "id")):
        raise ValueError("only id<->en is supported")
    ck = f"{engine}|{src}|{dst}|{text}"
    row = _DB.execute("select val from tr where key=?", (ck,)).fetchone()
    if row:
        return row[0]
    if engine == "argos":
        out = _argos_translate(text, src, dst)
    elif engine == "libretranslate":
        out = _libre(text, src, dst, url, key)
    else:
        out = _mymemory(text, src, dst)
    out = out.strip()
    if out:
        _DB.execute("insert or replace into tr values (?,?)", (ck, out))
        _DB.commit()
    return out
