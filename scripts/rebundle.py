#!/usr/bin/env python3
"""Splice edited ../src/*.js back into the standalone HTML bundle.

Usage:  python3 scripts/rebundle.py

Edits the standalone HTML *in place*: for every UUID that also has a file
in ../src/, re-encodes that file as base64 and overwrites the matching
manifest entry's `data` field. Vendor assets stay untouched.
"""
import base64
import gzip
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
HTML = REPO / "Research Tree _standalone_.html"
SRC = REPO / "src"

if not SRC.is_dir():
    sys.exit(f"no src/ directory at {SRC} — run scripts/unpack.py first")

sources = {p.stem: p for p in SRC.glob("*.js")}
if not sources:
    sys.exit(f"no *.js files in {SRC}")

html = HTML.read_text(encoding="utf-8")
m = re.search(
    r'(<script type="__bundler/manifest">\s*)(.*?)(\s*</script>)',
    html, re.DOTALL,
)
if not m:
    sys.exit("manifest script block not found in HTML")

manifest = json.loads(m.group(2))

changed = 0
for uuid, path in sources.items():
    if uuid not in manifest:
        print(f"warn: {uuid} not in manifest, skipping")
        continue
    raw_bytes = path.read_bytes()
    # Match the original encoding: if the manifest entry was gzipped, gzip the
    # new bytes too; otherwise embed raw. mtime=0 keeps the output deterministic.
    if manifest[uuid].get("compressed"):
        payload = gzip.compress(raw_bytes, mtime=0)
    else:
        payload = raw_bytes
    manifest[uuid]["data"] = base64.b64encode(payload).decode("ascii")
    if "size" in manifest[uuid]:
        manifest[uuid]["size"] = len(raw_bytes)
    changed += 1
    print(f"patched {uuid} ({len(raw_bytes)} bytes → {len(payload)} encoded)  ← {path.relative_to(REPO)}")

new_manifest_json = json.dumps(manifest, separators=(",", ":"))
new_html = html[: m.start(2)] + new_manifest_json + html[m.end(2):]
HTML.write_text(new_html, encoding="utf-8")
print(f"wrote {HTML.relative_to(REPO)} — {changed} asset(s) patched, {len(new_html)} bytes")
