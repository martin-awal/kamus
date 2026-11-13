"""CI check: credits.json must be valid and every entry complete (it feeds the Legal page)."""
import json
import sys

KINDS = {"data", "service", "software", "asset"}
data = json.load(open("credits.json", encoding="utf-8"))
items = data["items"] if isinstance(data, dict) else data
problems = []
for i, x in enumerate(items):
    name = x.get("name", f"#{i}")
    if x.get("kind") not in KINDS:
        problems.append(f"{name}: kind must be one of {sorted(KINDS)}")
    for key in ("name", "license", "role"):
        if not x.get(key):
            problems.append(f"{name}: missing '{key}'")
if isinstance(data, dict) and not data.get("updated"):
    problems.append("missing 'updated' date")
print(f"{len(items)} credit entries")
if problems:
    print("\n".join(problems))
    sys.exit(1)
