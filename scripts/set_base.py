"""Prefixes the root-absolute asset paths in a built copy of Kamus (dist/) with a sub-path, so the site can live at https://user.github.io/kamus/.

    python3 scripts/set_base.py dist /kamus

Only Kamus' own files are rewritten (never vendor/): quoted "/vendor/...", "/data/...", "/models/...", "/icons/...", the top-level scripts and
styles, the manifest, "/auth.html" and "/#hash" links, and the service worker's "/" entry. "/api/..." is left alone (there is no server in
a static build; the page notices and carries on).
"""
import re
import sys
from pathlib import Path

root, base = Path(sys.argv[1]), sys.argv[2].rstrip("/")
if base and not base.startswith("/"):
    sys.exit("the base must start with a slash, e.g. /kamus")
TOP = r"(?:sw|theme|sync|stemmer|srs|learn|cards-store|apkg|wd-worker|tr-worker)\.js|learn\.css|anki-model\.json|auth\.html|manifest\.webmanifest|icon\.svg"
ASSET = re.compile(r"""(?P<q>["'`])/(?P<p>vendor/|data/|models/|icons/|""" + TOP + r")")
HASH = re.compile(r"""(?P<q>["'])/#""")
changed = 0
for f in sorted(root.rglob("*")):
    if not f.is_file() or f.suffix not in {".html", ".js", ".css", ".webmanifest"} or "vendor" in f.relative_to(root).parts:
        continue
    text = f.read_text(encoding="utf-8")
    new = ASSET.sub(lambda m: f"{m['q']}{base}/{m['p']}", text)
    new = HASH.sub(lambda m: f"{m['q']}{base}/#", new)
    if f.name == "sw.js":
        new = new.replace("const SHELL_URLS = ['/', ", f"const SHELL_URLS = ['{base}/', ")
    if f.suffix == ".webmanifest":
        new = re.sub(r'("(?:start_url|scope|id)"\s*:\s*)"/"', rf'\1"{base}/"', new)
    if new != text:
        f.write_text(new, encoding="utf-8")
        changed += 1
print(f"{changed} files now use the base '{base}'")
