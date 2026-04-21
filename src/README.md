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
| `d3d95e3d-…` | **shared components** — `SketchyNode`, `DetailPanel`, `StatusChip`, hint strip |
| `8b0c5eed-…` | **view: V1 Spine-Snap** — opinionated git-graph / strict lanes |
| `88310a16-…` | **view: V2 Notebook Trellis** — lab-notebook cards, reading-focused |
| `41bd197f-…` | **view: V4 Freeform Canvas** — default; pan/zoom |
| `c35e7b2e-…` | **app shell** — top bar, tabs, tweaks panel, export/import, bootstraps `<App/>` |

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
