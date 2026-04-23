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

Mental model: **each node is a captured thought / first-class todo.**
The `[ ]` lines inside a description are planning scratch — a thinking
aid for one node, not a separate todo list. The planned work below
follows from that.

- **List view of the tree.** Same nodes, rendered as rows — filterable
  by status, groupable by root-descendant (= project), sortable by
  date-touched. Answers "what are my 7 open items across 3 projects" in
  a way the spatial view can't.
- **Quick-capture shortcut.** An `n` keypress that spawns a node with
  its title input auto-focused; enter commits without opening the full
  detail card. Lowers the friction of "gotta pin this thought down" to
  one keystroke plus typing.
- **Promote todo → node.** A button next to each `[ ]` line in the
  detail panel that turns the todo into a real child node — title
  copied from the todo text, the line stripped from the parent's
  description. The moment a scratch item crosses into "I'm tracking
  this."
- **Collapse nodes → todos.** The inverse of promote. Select
  descendants of some node and collapse them into it: their titles
  become todos in its description, and the nodes themselves are
  removed. The moment a subtree is done and its details demote back to
  historical notes.
- **Branch roots.** Flag any node as a "branch root" (project entry
  point). Renders its title larger/bolder on the canvas, and — more
  importantly — provides the grouping axis the list view uses to
  answer "which project does this node belong to."
- **Non-modal detail dock.** Replace the centered modal with a panel
  docked at the bottom, so the canvas stays visible while you edit a
  node's description. Pays off more once promote/collapse land, since
  description-editing gets more frequent.
