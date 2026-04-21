# Research Tree

Vibe coded tree to visualize ongoing work.

Single-file standalone HTML (`Research Tree _standalone_.html`) — open it in a
browser, no server required. State persists to `localStorage` per browser; use
**export ↓** in the top bar to save a portable JSON copy.

## Controls

### Top bar

- **tabs A / B / C** — switch between Freeform Canvas, Spine-Snap, and
  Notebook Trellis layouts (all three share the same underlying tree)
- **export ↓** — download the current tree as
  `research-tree-YYYY-MM-DD.json`
- **import ↑** — load a tree from a JSON file (replaces the current one;
  reversible via undo)

### Keyboard

| key | action |
|---|---|
| `Ctrl+Z` / `Cmd+Z` | undo |
| `Ctrl+Shift+Z` / `Cmd+Shift+Z` / `Ctrl+Y` | redo |
| `Ctrl+,` / `Cmd+,` | toggle the **Tweaks** panel (spacing sliders, default view, reset data) |

Keyboard shortcuts are suppressed while typing in a text field.

## Editing the source

The HTML embeds its React components as base64-encoded, gzipped entries.
Unpacked sources live in [`src/`](src/) — see
[`src/README.md`](src/README.md) for the edit loop.
