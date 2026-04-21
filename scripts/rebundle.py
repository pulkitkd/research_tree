#!/usr/bin/env python3
"""Splice edited src/ back into the standalone HTML bundle.

Usage:  python3 scripts/rebundle.py

Edits the standalone HTML *in place*:
  - every UUID that has a matching `src/<uuid>.js`  → manifest entry re-encoded
    (gzipped if the entry was originally compressed)
  - `src/index.template.html` (if present)          → __bundler/template block
    re-encoded as JSON

Vendor manifest entries (React/Babel/woff2) stay untouched.
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
TEMPLATE_SRC = SRC / "index.template.html"

if not SRC.is_dir():
    sys.exit(f"no src/ directory at {SRC} — run scripts/unpack.py first")

sources = {p.stem: p for p in SRC.glob("*.js")}
if not sources and not TEMPLATE_SRC.exists():
    sys.exit(f"nothing to splice — no *.js or index.template.html in {SRC}")

html = HTML.read_text(encoding="utf-8")


def splice(html_text, tag, new_content):
    """Replace the inner text of <script type="__bundler/{tag}">...</script>."""
    rx = re.compile(
        rf'(<script type="__bundler/{tag}">\s*)(.*?)(\s*</script>)',
        re.DOTALL,
    )
    m = rx.search(html_text)
    if not m:
        sys.exit(f"bundler/{tag} script block not found in HTML")
    return html_text[: m.start(2)] + new_content + html_text[m.end(2):]


# --- 1. patch manifest entries for any src/*.js that matches a UUID --------
m = re.search(
    r'<script type="__bundler/manifest">\s*(.*?)\s*</script>',
    html, re.DOTALL,
)
if not m:
    sys.exit("manifest script block not found in HTML")
manifest = json.loads(m.group(1))

changed = 0
for uuid, path in sources.items():
    if uuid not in manifest:
        print(f"warn: {uuid} not in manifest, skipping")
        continue
    raw_bytes = path.read_bytes()
    # Match the original encoding: gzip iff the entry was flagged compressed.
    # mtime=0 keeps the output byte-deterministic.
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
html = splice(html, "manifest", new_manifest_json)

# --- 2. patch template if present ------------------------------------------
tpl_patched = False
if TEMPLATE_SRC.exists():
    template = TEMPLATE_SRC.read_text(encoding="utf-8")
    # Re-encode as a JSON string, then escape `</` → `<\/` so the encoded
    # string is safe to embed inside a <script> tag. (The parser would
    # otherwise close the outer script on any `</script>` it sees inside.)
    encoded = json.dumps(template, ensure_ascii=False).replace("</", "<\\/")
    html = splice(html, "template", encoded)
    tpl_patched = True
    print(f"patched template ({len(template)} chars)  ← {TEMPLATE_SRC.relative_to(REPO)}")

HTML.write_text(html, encoding="utf-8")
total = changed + (1 if tpl_patched else 0)
print(f"wrote {HTML.relative_to(REPO)} — {total} asset(s) patched, {len(html)} bytes")
