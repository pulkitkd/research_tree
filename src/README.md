# src/

Unpacked app sources. The outer `Research Tree _standalone_.html` at the repo
root is a single-file bundle that base64-embeds these files (plus React,
ReactDOM, Babel-standalone, and the Caveat webfont family — kept only inside
the bundle, not in this repo).

Filenames are UUIDs so they round-trip 1:1 with the bundle's manifest. What
each one is:

| UUID prefix | role |
|---|---|
| `9ba52a2c-…` | **store** — `useStore()` hook, seed data, undo/redo, localStorage persistence, sketchy-path helpers |
| `d3d95e3d-…` | **shared components** — `SketchyNode`, `DetailForm`, `StatusChip`, `Legend`, drag/Ctrl+click hooks |
| `41bd197f-…` | **view: Freeform Canvas** — the only view; pan, drag-to-create, modal detail panel |
| `c35e7b2e-…` | **app shell** — top bar, export/import, undo/redo keybinds, bootstraps `<App/>` |

The earlier Spine-Snap and Notebook Trellis views live in `../archive/` — not
part of the bundle. Restore by moving back into `src/` and re-adding manifest
entries + `<script src="…">` lines in `index.template.html`.

## Edit loop

```
# 1. (optional) re-unpack the bundle to pick up upstream changes
python3 scripts/unpack.py

# 2. edit files in src/

# 3. splice them back into the standalone HTML
python3 scripts/rebundle.py
```

`scripts/rebundle.py` only touches manifest entries whose UUID matches a file
in `src/` — vendor JS and webfonts in the bundle are left alone.
