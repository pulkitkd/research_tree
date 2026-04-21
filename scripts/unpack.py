#!/usr/bin/env python3
"""Unpack the standalone HTML bundle into ../src/ (and other assets into build/).

Usage:  python3 scripts/unpack.py

Reads the __bundler manifest embedded in the standalone HTML, base64-decodes
each asset, writes them out by UUID with a guessed extension. Only the six
small Babel/JSX app files are expected to be hand-edited — the vendor JS and
webfont woff2 files are written to build/vendor/ for inspection but are not
part of the edit workflow.
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
VENDOR = REPO / "build" / "vendor"

# The six app source UUIDs (everything else is vendor / fonts)
APP_UUIDS = {
    "9ba52a2c-e8e3-4717-a44e-d8f4d047e4db",  # store
    "d3d95e3d-7790-44fc-aac0-00ff09ececcf",  # components
    "8b0c5eed-15d1-4958-90be-3364c11a1b54",  # view: spine
    "88310a16-c44c-4a2c-a0b4-12d6ab6f330a",  # view: notebook
    "41bd197f-f463-437b-a4d5-b695b5c985ff",  # view: canvas
    "c35e7b2e-fe06-48c3-91b4-d56af7c6a99d",  # app shell
}

SRC.mkdir(parents=True, exist_ok=True)
VENDOR.mkdir(parents=True, exist_ok=True)

html = HTML.read_text(encoding="utf-8")

def extract(tag):
    m = re.search(
        rf'<script type="__bundler/{tag}">\s*(.*?)\s*</script>',
        html, re.DOTALL,
    )
    if not m:
        sys.exit(f"missing {tag}")
    return m.group(1)

manifest = json.loads(extract("manifest"))
template = json.loads(extract("template"))
(VENDOR.parent / "index.template.html").write_text(template, encoding="utf-8")

def guess_ext(data, mime=None):
    if mime:
        if "javascript" in mime: return ".js"
        if "css" in mime: return ".css"
        if "woff2" in mime: return ".woff2"
        if "png" in mime: return ".png"
        if "svg" in mime: return ".svg"
    if data[:4] == b"wOF2": return ".woff2"
    if data[:8] == b"\x89PNG\r\n\x1a\n": return ".png"
    return ".js" if data[:200].lstrip().startswith((b"//", b"function", b"const ", b"let ", b"import ", b"(")) else ".bin"

written_app = 0
written_vendor = 0
for uuid, entry in manifest.items():
    raw = base64.b64decode(entry["data"])
    # The bundler's manifest marks gzipped entries with `compressed: true`;
    # also sniff magic bytes as a belt-and-braces check.
    if entry.get("compressed") or raw[:2] == b"\x1f\x8b":
        raw = gzip.decompress(raw)
    ext = guess_ext(raw, entry.get("mime"))
    name = f"{uuid}{ext}"
    if uuid in APP_UUIDS:
        (SRC / name).write_bytes(raw); written_app += 1
    else:
        (VENDOR / name).write_bytes(raw); written_vendor += 1

print(f"unpacked {written_app} app source(s) → {SRC.relative_to(REPO)}/")
print(f"unpacked {written_vendor} vendor asset(s) → {VENDOR.relative_to(REPO)}/")
