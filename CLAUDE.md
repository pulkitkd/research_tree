# Research Tree — notes for AI coding agents

A single-file React app that visualizes ongoing research as a DAG. The
deliverable is one standalone HTML file at the repo root; everything else in
this repo is the source + build tooling to regenerate it.

## Repo layout

```
Research Tree _standalone_.html   ← final deliverable; do NOT hand-edit
README.md                         ← user-facing
CLAUDE.md                         ← this file
src/
  index.template.html             ← outer HTML + all CSS (edit CSS here)
  9ba52a2c-…js                    ← store: useStore, seed data, undo/redo
  d3d95e3d-…js                    ← shared components: SketchyNode, Legend, DetailForm, hooks
  8b0c5eed-…js                    ← view V1 Spine-Snap
  88310a16-…js                    ← view V2 Notebook Trellis
  41bd197f-…js                    ← view V4 Freeform Canvas
  c35e7b2e-…js                    ← app shell: tabs, keyboard, export/import
  README.md                       ← UUID → role map
scripts/
  unpack.py                       ← HTML bundle → src/ (and build/vendor/)
  rebundle.py                     ← src/ → HTML bundle (in place)
build/                            ← gitignored; vendor JS + 18 Caveat woff2
```

**File names are UUIDs** because that's what the bundle's manifest uses; keep
them that way so `src/<uuid>.js` lines up 1:1 with `manifest[uuid]`.

## Edit loop

```
python3 scripts/rebundle.py      # splice src/ back into the HTML
# hard-refresh the browser (Ctrl+Shift+R) to pick up the new bundle
```

`scripts/unpack.py` is the reverse — run it to re-derive `src/` from the
HTML. **It overwrites `src/` unconditionally**, so commit before running it.

## Bundle format (so the scripts make sense)

The HTML has three sibling `<script>` blocks at the bottom:

| tag | content |
|---|---|
| `type="__bundler/manifest"` | JSON object: `{uuid: {mime, compressed, data (base64)}}` for every asset |
| `type="__bundler/template"` | JSON-encoded string: the inner HTML/CSS, with asset UUIDs as literal strings that get swapped for blob URLs at boot |
| `type="__bundler/ext_resources"` | small JSON array; unused here |

The inline `<script>` at the top of the HTML reads those three tags,
base64-decodes each asset (gunzipping if `compressed:true`), creates blob URLs,
textually substitutes UUIDs in the template with those URLs, then
`DOMParser`s the result and replaces `document.documentElement`.

## Gotchas that have bitten us

1. **App JS entries are gzipped.** Every `application/javascript` entry in the
   manifest has `compressed:true` and the `data` starts with `H4sI…` (base64
   of the gzip magic `1f8b`). `rebundle.py` must `gzip.compress(..., mtime=0)`
   when an entry was originally compressed. A raw-bytes patch with
   `compressed:true` left on will silently break the runtime.

2. **Unpack must gunzip.** Mirror side of the same issue. `unpack.py` checks
   `entry.compressed` and the gzip magic bytes and calls `gzip.decompress`
   before writing to disk.

3. **Template re-encoding must escape `</`.** After editing
   `src/index.template.html` and re-encoding with `json.dumps`, any literal
   `</script>` inside the encoded string would close the outer
   `<script type="__bundler/template">` tag early. `rebundle.py` does
   `.replace("</", "<\\/")` on the encoded string — keep that line.

4. **Don't commit exported tree snapshots.** `research-tree-*.json` (produced
   by the in-app export button) is gitignored; leave it that way.

5. **Integrity / crossorigin attributes.** The template ships SRI `integrity=`
   hashes on vendor script tags. The bootstrap code strips them at runtime
   (blob URLs + null origin would fail SRI). If you ever edit a vendor
   script, don't bother recomputing hashes — they're dead code.

## Common task recipes

| want to change | where | follow-up |
|---|---|---|
| any CSS rule (colors, layout, panel position) | `src/index.template.html` (inside the big `<style>` block) | `rebundle.py` |
| a component's JSX or behavior | the right `src/<uuid>.js` — see `src/README.md` | `rebundle.py` |
| the seed tree, status list, or path-drawing math | `src/9ba52a2c-…js` | `rebundle.py` |
| add a top-bar button | `src/c35e7b2e-…js` (the app shell) | `rebundle.py` |

## Testing

There is no automated UI test. Validation steps before declaring a change done:

1. `python3 scripts/rebundle.py` — script itself must succeed with
   `N asset(s) patched` output.
2. Round-trip check: after rebundling, `python3 scripts/unpack.py` and then
   spot-check that a grep for the edited identifier still appears in
   `src/<uuid>.js`. If it doesn't, the encoding broke.
3. UUID alignment: the template references 28 UUIDs and the manifest has
   28 entries; the two sets must match. `rebundle.py` leaves unknown UUIDs
   alone so this is preserved automatically, but worth re-checking after any
   change that edits the template or manifest.
4. **Ask the user to hard-refresh and report**. The agent can't see the
   rendered page, so "looks right" requires a human glance. If the red bundle
   error panel appears at the bottom-left of the page, ask the user to copy
   its text — it's the `window.error` sink.

## What not to touch

- Files under `build/vendor/` — those are React, ReactDOM, Babel-standalone,
  and 18 Caveat woff2 files. Regenerated by `unpack.py`; not source of truth.
- The three big vendor UUIDs in the manifest (`1fa1f1b7-…`, `50fa6c73-…`,
  `ec70f441-…`). `rebundle.py` won't touch them unless you create a matching
  `src/<uuid>.js`, which you shouldn't.
- The `EDITMODE-BEGIN/END` comment markers in `src/c35e7b2e-…js` — they're a
  hook for an external editor tool; harmless but don't remove the sentinels.
