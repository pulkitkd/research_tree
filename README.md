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
| `Delete` / `Backspace` | delete the currently selected node(s) |
| `n` | new node — opens its detail card with the title pre-selected for immediate typing |
| `Enter` | open the detail card for the selected node (only when exactly one is selected) |
| `Esc` | close the open detail card; cancels a mid-gesture Ctrl+click; cancels a marquee in progress |
| arrow keys | move the selection to the spatially nearest node in that direction (only when exactly one is selected) |

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
  as ongoing / priority / done / …) and a **delete** button
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

### Bigger direction: shared artifact with an LLM agent

A different bet than the list above. The features above make this a
better *solo* tool. This direction reframes the whole thing: the tree
becomes a **shared map between you and an LLM agent helping with the
work**. The agent reads the tree at the start of a session to pick up
context, proposes updates as work progresses (mark done, add new
children, promote todos, collapse completed subtrees), and writes the
updated tree back. You keep the bird's-eye view; the agent gets
persistent memory across sessions that isn't opaque — the memory *is*
the visible artifact.

Why it's different from existing "LLM memory" solutions (project
memory, MCP servers, etc.): those are opaque to you. Here, the memory
is a map you can inspect, hand-edit, and share. The agent proposes;
you own.

Feasibility is high. The tree is already JSON; no model changes
needed. Open design questions to work through when building:

- **Where the tree lives.** Per-project (`.research-tree.json` in each
  repo the agent works in) is the clean default. A single global tree
  is harder — the agent has to know where to look.
- **Conflict model.** You edit visually, the agent edits via file — they
  can step on each other. Simplest mitigation: agent's updates are
  *proposals* you accept, not direct writes.
- **Browser ↔ filesystem bridge.** The app lives in a browser and has
  no filesystem access by default. Options: Chrome's File System
  Access API (Chrome-only); a tiny local bridge (breaks the
  zero-server ethos); or manual export/import as the sync step (no
  new infrastructure, slight UX friction — probably the right starting
  point).
- **Scope mismatch.** The agent knows what happened in its session; it
  doesn't know your Monday meeting shifted a deadline. The
  agent-curated tree captures implementation reality, not the full
  research state. Good to remember the tree is *your* view — the agent
  proposes, the human owns.

Minimal prototype path: keep the app as-is, adopt a
`.research-tree.json` convention per repo, teach the agent (Claude
Code or similar) to read/propose/write it. The app doesn't need to
change for the first pass.
