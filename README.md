# Research Tree

Vibe coded tree to visualize ongoing work.

Single-file standalone HTML (`Research Tree _standalone_.html`) — open it in a
browser, no server required. State persists to `localStorage` per browser; use
**export ↑** in the top bar to save a portable JSON copy.

## Controls

### Top bar

- **+ new** — create an unconnected node at the center of the canvas
- **↶ undo** / **↷ redo**
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

### Nodes

- **drag** a node to move it
- **double-click** a node to open its detail card (title, date, status,
  description)
- **hover** a node to reveal its `+` handle; **drag the `+`** onto another
  node to connect them, or onto empty space to create a new connected child
- **`Ctrl`+click** two nodes to toggle a link between them — creates a link
  if they're not connected, removes the link if they already are (in either
  direction). `Esc` cancels mid-gesture.

### Selection

- **click** a node to select it (replaces the current selection)
- **`Shift`+click** a node to add/remove it from the selection
- **`Shift`+drag** on empty canvas to marquee-select every node inside the
  rectangle (added to the current selection)
- **drag** any selected node to move the whole group together
- when 2+ nodes are selected, a toolbar appears with status chips (mark all
  as ongoing / blocked / done / …) and a **delete** button
- **click** empty canvas to clear the selection

### Canvas

- **drag the background** to pan the canvas

### Todos inside descriptions

Inside a node's description, lines beginning with `[]`, `[ ]`, or `[x]` (a
leading `- ` is also accepted) are treated as todos. The node shows a
pie-slice fill that grows as more todos are checked — a small sliver
appears as soon as any todo exists, and the slice becomes a full circle
when they're all done. Toggle a todo by editing the `[]` to `[x]` (or vice
versa) in the description textarea.

## Editing the source

The HTML embeds its React components as base64-encoded, gzipped entries.
Unpacked sources live in [`src/`](src/) — see
[`src/README.md`](src/README.md) for the edit loop.

## Future updates

- **Branch roots.** Flag any node as a "branch root" to mark it as the
  entry point of a project/theme. The flagged node renders with a larger
  heading-style title, so at a glance you can tell which part of the tree
  is the lucie work, which is the ngcm work, etc. Spatially independent —
  survives dragging nodes around.
- **Promote todo → node.** A button next to each checkbox in the detail
  panel that turns the todo into a real child node — title copied from the
  todo text, the corresponding line stripped from the parent's
  description. For when a sub-task outgrows a bullet and needs its own
  substructure.
- **Collapse nodes → todos.** The inverse of promote. Select a group of
  descendants of some node and collapse them into that node: their titles
  become todos in its description, and the nodes themselves are removed.
  For shrinking a completed subtree back into its entry point once the
  work is done.
- **Non-modal detail dock.** Replace the centered modal with a panel
  docked at the bottom of the screen, so the canvas stays visible and
  interactive while you edit a node's description. Especially useful
  alongside todos, which encourage more description editing.
