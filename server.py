"""Local dictionary lookup page. Run: python3 server.py  ->  http://localhost:8765"""
import asyncio
import hashlib
import json
import requests
import sqlite3
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import kbbi
import translate
import wikidepia
import edge_tts
import wiktionary
from pronounce import ipa

HERE = Path(__file__).parent
DB = sqlite3.connect(HERE / "cache.db", check_same_thread=False)
DB.execute("create table if not exists cache4 (word text primary key, data text)")


def lookup(word):
    row = DB.execute("select data from cache4 where word=?", (word,)).fetchone()
    if row:
        return json.loads(row[0])
    entries, base = kbbi.lookup(word)
    for e in entries:
        e["ipa"] = ipa(e["headword"])
    # Wiktionary and Tatoeba are fetched by the browser itself (both allow cross-origin reads); only KBBI needs this server.
    result = {"word": word, "kbbi": entries, "kbbi_base": base, "wiktionary": None, "sentences": [], "warnings": []}
    if entries and not result["warnings"]:
        DB.execute("insert or replace into cache4 values (?,?)", (word, json.dumps(result)))
        DB.commit()
    return result


def legacy_cards():
    """Cards used to live in cards.db on this server; they now live in the browser. Read-only, for the one-time move."""
    path = HERE / "cards.db"
    if not path.exists():
        return []
    db = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    try:
        cols = [c[1] for c in db.execute("pragma table_info(cards)")]
        out = []
        for r in db.execute("select * from cards order by created desc"):
            d = dict(zip(cols, r))
            out.append({"id": d["id"], "word": d["word"], "meaning": d["meaning"], "fields": json.loads(d["fields"]), "created": d["created"],
                        "note_id": d.get("note_id"), "synced_at": d.get("synced_at"), "progress": json.loads(d["progress"]) if d.get("progress") else None,
                        "progress_at": d.get("progress_at"), "dirty": bool(d.get("dirty"))})
        return out
    finally:
        db.close()


SUGGEST = {}


def suggest(prefix):
    """Indonesian words starting with `prefix`, from Wiktionary's 'Indonesian lemmas' category."""
    prefix = "".join(c for c in prefix.lower() if c.isalnum() or c in " -")[:30].strip()
    if not prefix:
        return []
    if prefix in SUGGEST:
        return SUGGEST[prefix]
    r = requests.get("https://en.wiktionary.org/w/api.php", headers={"User-Agent": wiktionary.UA}, timeout=10, params={
        "action": "query", "list": "search", "srsearch": f'incategory:Indonesian_lemmas prefix:"{prefix}"',
        "srnamespace": 0, "srlimit": 20, "format": "json"})
    r.raise_for_status()
    titles = [h["title"] for h in r.json()["query"]["search"] if h["title"].lower().startswith(prefix)]
    result = sorted(set(titles), key=lambda t: (len(t), t))[:6]
    if len(SUGGEST) > 500:
        SUGGEST.clear()
    SUGGEST[prefix] = result
    return result


STATIC_FILES = {"/sw.js", "/wd-worker.js", "/tr-worker.js", "/cards-store.js", "/apkg.js", "/sync.js", "/auth.html", "/anki-model.json", "/theme.js", "/manifest.webmanifest", "/icon.svg"}
STATIC_TYPES = {".html": "text/html; charset=utf-8", ".mjs": "text/javascript", ".wasm": "application/wasm", ".onnx": "application/octet-stream", ".json": "application/json", ".js": "text/javascript", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png"}
QUICK, KB = {}, {}
TTS_DIR = HERE / "tts_cache"
TTS_DIR.mkdir(exist_ok=True)
VOICES = {"gadis": "id-ID-GadisNeural", "ardi": "id-ID-ArdiNeural"}


def tts(text, engine, voice, speed=1.0):
    """Speech for `text`. engine 'edge' = edge-tts (cached mp3); 'wikidepia' = local VITS model (cached wav). speed 0.5..1.5."""
    text = " ".join(text.split())[:300]
    if not text:
        raise ValueError("empty text")
    speed = max(0.5, min(1.5, float(speed)))
    if engine == "wikidepia":
        return wikidepia.synth(text, voice, TTS_DIR, speed), "audio/wav"
    name = VOICES.get(voice, VOICES["gadis"])
    pct = round((speed - 1) * 100)
    rate = f"{'+' if pct >= 0 else '-'}{abs(pct)}%"
    key = f"{name}|{text}" if pct == 0 else f"{name}|{rate}|{text}"          # speed 1 keeps the cache entries from before
    path = TTS_DIR / (hashlib.sha1(key.encode()).hexdigest() + ".mp3")
    if not path.exists():
        tmp = path.with_suffix(".part")
        asyncio.run(edge_tts.Communicate(text, name, rate=rate).save(str(tmp)))
        tmp.rename(path)
    return path.read_bytes(), "audio/mpeg"


def credits():
    """credits.json (edit it whenever a dependency, data source or service changes) + installed versions."""
    from importlib import metadata
    data = json.loads((HERE / "credits.json").read_text())
    for item in data["items"]:
        pkg = item.get("package")
        if pkg:
            try:
                item["version"] = metadata.version(pkg)
            except metadata.PackageNotFoundError:
                pass
    return data


def _clean(word):
    return "".join(c for c in word.lower() if c.isalpha() or c in " -")[:40].strip()


def quick(word):
    """English-only lookup (Wiktionary) for the select-a-word chip: fast, cached in memory."""
    word = _clean(word)
    if word not in QUICK:
        QUICK[word] = {"word": word, **wiktionary.lookup(word)}
    return QUICK[word]


def kbbi_only(word):
    word = _clean(word)
    if word not in KB:
        entries, base = kbbi.lookup(word)
        for e in entries:
            e["ipa"] = ipa(e["headword"])
        KB[word] = {"word": word, "entries": entries, "base": base}
    return KB[word]


class Handler(BaseHTTPRequestHandler):
    def _send(self, body, ctype, code=200):
        data = body.encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def end_headers(self):
        # cross-origin isolation: lets onnxruntime-web use several WASM threads (SharedArrayBuffer) for in-browser TTS.
        # Browsers only honour it on secure origins (https or localhost), so don't send it (and get console warnings) elsewhere.
        host = (self.headers.get("Host") or "").rsplit(":", 1)[0].strip("[]")
        behind_https = (self.headers.get("X-Forwarded-Proto") or "").lower() == "https"      # e.g. `tailscale serve`, a reverse proxy with TLS
        # /auth.html (Google sign-in) must NOT be isolated: a COOP page cannot talk to the sign-in pop-up it opens
        if self.path.split("?")[0] != "/auth.html" and (getattr(self.server, "is_tls", False) or behind_https or host in ("localhost", "127.0.0.1", "::1")):
            self.send_header("Cross-Origin-Opener-Policy", "same-origin")
            self.send_header("Cross-Origin-Embedder-Policy", "credentialless")
        super().end_headers()

    def _send_file(self, f, no_cache=False):
        size = f.stat().st_size
        self.send_response(200)
        self.send_header("Content-Type", STATIC_TYPES.get(f.suffix, "application/octet-stream"))
        self.send_header("Content-Length", str(size))
        if no_cache:
            self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        with f.open("rb") as fh:
            while chunk := fh.read(1 << 20):
                self.wfile.write(chunk)

    def _body(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n > 200_000:
            raise ValueError("body too large")
        return json.loads(self.rfile.read(n) or b"{}")

    def do_POST(self):
        u = urlparse(self.path)
        try:
            body = self._body()
            if u.path == "/api/translate":
                out = translate.translate(body.get("text", ""), body.get("from", "id"), body.get("to", "en"),
                                          body.get("engine", "mymemory"), body.get("url"), body.get("key"))
                self._send(json.dumps({"text": out, "engine": body.get("engine", "mymemory")}), "application/json")
            else:
                self._send("not found", "text/plain", 404)
        except ValueError as exc:
            self._send(json.dumps({"error": str(exc)}), "application/json", 400)
        except Exception as exc:
            self._send(json.dumps({"error": str(exc)}), "application/json", 500)

    def do_GET(self):
        u = urlparse(self.path)
        if u.path == "/":
            self._send((HERE / "static/index.html").read_text(), "text/html; charset=utf-8")
        elif u.path == "/api/lookup":
            word = parse_qs(u.query).get("q", [""])[0].strip().lower()
            if not word:
                return self._send("{}", "application/json", 400)
            try:
                self._send(json.dumps(lookup(word)), "application/json")
            except Exception as exc:
                self._send(json.dumps({"error": str(exc)}), "application/json", 502)
        elif u.path in ("/api/quick", "/api/kbbi"):
            fn = quick if u.path == "/api/quick" else kbbi_only
            try:
                self._send(json.dumps(fn(parse_qs(u.query).get("q", [""])[0])), "application/json")
            except Exception as exc:
                self._send(json.dumps({"error": str(exc)}), "application/json", 502)
        elif u.path == "/api/tts":
            qs = parse_qs(u.query)
            try:
                data, ctype = tts(qs.get("text", [""])[0], qs.get("engine", ["edge"])[0], qs.get("voice", ["gadis"])[0], qs.get("speed", ["1"])[0])
                self.send_response(200)
                self.send_header("Content-Type", ctype)
                self.send_header("Content-Length", str(len(data)))
                self.send_header("Cache-Control", "max-age=86400")
                self.end_headers()
                self.wfile.write(data)
            except Exception as exc:
                self._send(json.dumps({"error": str(exc)}), "application/json", 502)
        elif u.path in STATIC_FILES or u.path.startswith(("/icons/", "/vendor/", "/models/wikidepia/", "/models/opus-mt/")):
            if u.path.startswith("/models/wikidepia/"):
                root, rel = (HERE / "models" / "wikidepia-v1.2" / "web").resolve(), u.path[len("/models/wikidepia/"):]
            elif u.path.startswith("/models/opus-mt/"):
                root, rel = (HERE / "models" / "opus-mt").resolve(), u.path[len("/models/opus-mt/"):]
            else:
                root, rel = (HERE / "static").resolve(), u.path.lstrip("/")
            f = (root / rel).resolve()
            if root in f.parents and f.is_file():
                self._send_file(f, no_cache=f.name == "sw.js")
            else:
                self._send("not found", "text/plain", 404)
        elif u.path == "/api/phonemize":
            try:
                self._send(json.dumps({"phonemes": wikidepia.phonemize(parse_qs(u.query).get("text", [""])[0])}), "application/json")
            except Exception as exc:
                self._send(json.dumps({"error": str(exc)}), "application/json", 502)
        elif u.path == "/api/cards":   # legacy, read-only: the page copies the old cards.db into the browser once
            self._send(json.dumps({"cards": legacy_cards()}), "application/json")
        elif u.path == "/api/translate/status":
            self._send(json.dumps(translate.status()), "application/json")
        elif u.path == "/api/tts/status":
            self._send(json.dumps({"edge": {"ready": True, "voices": list(VOICES)}, "wikidepia": wikidepia.status()}), "application/json")
        elif u.path == "/api/credits":
            self._send(json.dumps(credits()), "application/json")
        elif u.path == "/api/suggest":
            try:
                self._send(json.dumps(suggest(parse_qs(u.query).get("q", [""])[0])), "application/json")
            except Exception:
                self._send("[]", "application/json")
        else:
            self._send("not found", "text/plain", 404)


def lan_addresses():
    """Private IPv4 addresses of this machine (best effort), for printing the URLs to open from other devices."""
    import socket
    out = set()
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            out.add(info[4][0])
    except OSError:
        pass
    try:  # the address used for the default route
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("192.0.2.1", 9))
            out.add(sock.getsockname()[0])
    except OSError:
        pass
    return sorted(ip for ip in out if not ip.startswith("127."))


if __name__ == "__main__":
    import argparse
    import ssl

    ap = argparse.ArgumentParser(description="Kamus dictionary server")
    ap.add_argument("--lan", action="store_true", help="listen on all network interfaces (default: this computer only)")
    ap.add_argument("--host", help="bind address, e.g. 0.0.0.0 or a single LAN IP (overrides --lan)")
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--cert", help="TLS certificate (PEM) to serve https, e.g. one made with mkcert")
    ap.add_argument("--key", help="TLS private key (PEM)")
    args = ap.parse_args()
    host = args.host or ("0.0.0.0" if args.lan else "127.0.0.1")
    httpd = ThreadingHTTPServer((host, args.port), Handler)
    scheme = "http"
    httpd.is_tls = bool(args.cert)
    if args.cert:
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(args.cert, args.key)
        httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
        scheme = "https"
    print(f"Kamus on {scheme}://localhost:{args.port}", flush=True)
    if host not in ("127.0.0.1", "localhost"):
        for ip in lan_addresses():
            print(f"  from other devices: {scheme}://{ip}:{args.port}", flush=True)
        print("  (no login: anyone on this network can use it)", flush=True)
    httpd.serve_forever()
