# Research Tree

Vibe coded tree to visualize ongoing work.

Single-file standalone HTML (`Research Tree _standalone_.html`) — open it in a
browser, no server required. State persists to `localStorage` per browser; use
**export ↑** in the top bar to save a portable JSON copy.

## Controls

### Top bar

- **tabs A / B / C** — switch between Freeform Canvas, Spine-Snap, and
  Notebook Trellis layouts (all three share the same underlying tree)
- **export ↑** — download the current tree as
  `research-tree-YYYY-MM-DD.json`
- **import ↓** — load a tree from a JSON file (replaces the current one;
  reversible via undo)

### Keyboard

| key | action |
|---|---|
| `Ctrl+Z` / `Cmd+Z` | undo |
| `Ctrl+Shift+Z` / `Cmd+Shift+Z` / `Ctrl+Y` | redo |

Keyboard shortcuts are suppressed while typing in a text field.

Tree interaction (in any of the three views):

- **drag** a node to move it
- **drag the `+`** handle from one node onto another to connect them
- **`Ctrl`+click** two nodes to toggle a link between them — creates a link if they're not connected, removes the link if they already are (in either direction). `Esc` cancels mid-gesture.
- **drag the background** to pan the canvas

## Editing the source

The HTML embeds its React components as base64-encoded, gzipped entries.
Unpacked sources live in [`src/`](src/) — see
[`src/README.md`](src/README.md) for the edit loop.

## Future updates

- **Promote todo → node.** A button next to each checkbox in the detail
  panel that turns the todo into a real child node — title copied from the
  todo text, the corresponding line stripped from the parent's
  description. For when a sub-task outgrows a bullet and needs its own
  substructure.
