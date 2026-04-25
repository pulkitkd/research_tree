function V4Canvas({ store, tweaks }) {
  const { nodes, update, updateMany, remove, removeMany, add, connect, toggleLink, undo, redo, canUndo, canRedo } = store;
  const svgRef = React.useRef(null);
  // `selected` is a Set of ids — purely for selection (sel-ring + group drag).
  // Detail dock is gated by `openId` (explicit open via double-click / Enter /
  // `n`) so plain clicks just inspect status without committing to editing.
  // While the dock is open, single-click on another node swaps its content;
  // any change that takes selection out of single-node closes it.
  const [selected, setSelected] = React.useState(() => new Set());
  const [openId, setOpenId] = React.useState(null);
  // Tracks a node that was just created via the `n` shortcut so the dock
  // can auto-focus + select-all on its title for immediate typing.
  const [freshId, setFreshId] = React.useState(null);
  const [view, setView] = React.useState({ tx: 0, ty: 0, scale: 1 });
  const [pan, setPan] = React.useState(null);
  const panMovedRef = React.useRef(false);
  // dragNode: { ids: [...], offsets: { [id]: {ox,oy} }, moved: bool } — one
  // shape handles both single-node drags and group drags.
  const [dragNode, setDragNode] = React.useState(null);
  const justDraggedRef = React.useRef(false);
  // marquee: { x1, y1, x2, y2 } in outer-SVG coords (== group coords while
  // scale=1). Populated by shift-drag on empty canvas; on release, every
  // node whose center lies inside the rect is added to the selection.
  const [marquee, setMarquee] = React.useState(null);

  // External select (e.g. after creating a node) replaces selection with {id}.
  React.useEffect(() => {
    const onSelect = (e) => setSelected(new Set([e.detail.id]));
    window.addEventListener('research-tree:select', onSelect);
    return () => window.removeEventListener('research-tree:select', onSelect);
  }, []);

  const laid = React.useMemo(() => {
    const pad = { x: 180, y: 280 };
    return nodes.map(n => {
      const [wx, wy] = wobble(n.id + 'q', 10);
      return {
        ...n,
        x: n.x != null ? n.x : pad.x + n.stage * (STAGE_X * tweaks.hSpace) + wx,
        y: n.y != null ? n.y : pad.y + n.lane * (LANE_Y * tweaks.vSpace) + wy,
      };
    });
  }, [nodes, tweaks.hSpace, tweaks.vSpace]);
  const byId = Object.fromEntries(laid.map(n => [n.id, n]));
  const hitTest = makeHitTest(laid, 29);

  const startNodeDrag = (e, node) => {
    e.stopPropagation();
    // Shift-click is a selection gesture; let the click handler take over.
    if (e.shiftKey) return;
    // Ctrl/Cmd is the connect/disconnect gesture; don't start a drag and
    // don't cancel the pending ctrl-pick state — the click handler uses it.
    if (e.ctrlKey || e.metaKey) return;
    // A plain drag cancels any pending Ctrl+click mode.
    if (ctrl.firstId) ctrl.cancel();
    const pt = toSvgPoint(svgRef.current, e.clientX, e.clientY);
    // If the clicked node is part of a multi-selection, drag the whole group;
    // otherwise drag this node alone. Never mutate selection here — the modal
    // should only surface on a short click (handled in onClick), not on
    // mousedown-and-hold.
    const ids = (selected.has(node.id) && selected.size > 1) ? [...selected] : [node.id];
    const offsets = {};
    for (const id of ids) {
      const n = byId[id];
      if (!n) continue;
      offsets[id] = { ox: pt.x - n.x, oy: pt.y - n.y };
    }
    setDragNode({ ids, offsets, moved: false });
  };

  const addDrag = useAddByDrag(
    svgRef,
    (fromNode, pt) => {
      const f = byId[fromNode.id];
      const dx = pt.x - f.x, dy = pt.y - f.y;
      if (Math.hypot(dx, dy) < 30) return;
      const id = add({ title: 'new step', parents: [fromNode.id], stage: fromNode.stage, lane: fromNode.lane, x: pt.x, y: pt.y, status: 'ongoing' });
      setSelected(new Set([id]));
    },
    (fromNode, toNode) => { connect(fromNode.id, toNode.id); },
    hitTest
  );

  const ctrl = useCtrlConnect((a, b) => toggleLink(a, b));

  const onMove = (e) => {
    addDrag.onMouseMove(e);
    if (dragNode) {
      const pt = toSvgPoint(svgRef.current, e.clientX, e.clientY);
      const patches = {};
      for (const id of dragNode.ids) {
        const off = dragNode.offsets[id];
        if (!off) continue;
        patches[id] = { x: pt.x - off.ox, y: pt.y - off.oy };
      }
      updateMany(patches);
      setDragNode(d => d ? { ...d, moved: true } : null);
      justDraggedRef.current = true;
    }
    if (marquee) {
      const pt = toSvgPoint(svgRef.current, e.clientX, e.clientY);
      setMarquee(m => m ? { ...m, x2: pt.x - view.tx, y2: pt.y - view.ty } : null);
    }
    if (pan) {
      panMovedRef.current = true;
      setView(v => ({ ...v, tx: v.tx + (e.clientX - pan.x), ty: v.ty + (e.clientY - pan.y) }));
      setPan({ x: e.clientX, y: e.clientY });
    }
  };
  const onUp = (e) => {
    addDrag.onMouseUp(e);
    setDragNode(null);
    // Commit the marquee: add every node inside the rect to the selection.
    if (marquee) {
      const x0 = Math.min(marquee.x1, marquee.x2);
      const x1 = Math.max(marquee.x1, marquee.x2);
      const y0 = Math.min(marquee.y1, marquee.y2);
      const y1 = Math.max(marquee.y1, marquee.y2);
      const hitIds = laid.filter(n => n.x >= x0 && n.x <= x1 && n.y >= y0 && n.y <= y1).map(n => n.id);
      if (hitIds.length) {
        setSelected(prev => {
          const next = new Set(prev);
          for (const id of hitIds) next.add(id);
          return next;
        });
      }
      setMarquee(null);
    }
    // Pure click on empty background (mousedown without subsequent move) clears the selection.
    if (pan && !panMovedRef.current) setSelected(new Set());
    setPan(null);
    panMovedRef.current = false;
  };
  const onBgDown = (e) => {
    if (e.target === svgRef.current || e.target.classList.contains('bg-capture')) {
      if (ctrl.firstId) ctrl.cancel();
      if (e.shiftKey) {
        // Shift-drag on empty canvas starts a marquee instead of a pan.
        // Store in group coords so the rect stays anchored to the cursor
        // even when the canvas has been panned.
        const pt = toSvgPoint(svgRef.current, e.clientX, e.clientY);
        const gx = pt.x - view.tx, gy = pt.y - view.ty;
        setMarquee({ x1: gx, y1: gy, x2: gx, y2: gy });
        return;
      }
      panMovedRef.current = false;
      setPan({ x: e.clientX, y: e.clientY });
    }
  };

  // Esc cancels an in-progress marquee without touching the selection.
  React.useEffect(() => {
    if (!marquee) return;
    const onKey = (e) => { if (e.key === 'Escape') setMarquee(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [marquee]);

  // Delete / Backspace removes the current selection. Suppressed while
  // typing in an input or textarea so editing titles/descriptions is safe.
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const t = e.target;
      const tag = t && t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (t && t.isContentEditable)) return;
      if (!selected.size) return;
      e.preventDefault();
      deleteSelected();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  // `n` spawns a new node at the canvas center and opens its detail card
  // for immediate title entry. Only fires bare (no Ctrl/Cmd/Alt) so browser
  // shortcuts like Ctrl+N still work; suppressed while typing.
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'n' && e.key !== 'N') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      const tag = t && t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (t && t.isContentEditable)) return;
      e.preventDefault();
      const cx = 400 + (Math.random() - 0.5) * 120;
      const cy = 300 + (Math.random() - 0.5) * 80;
      const id = add({ title: 'new node', parents: [], x: cx, y: cy, stage: 0, lane: 0, status: 'ongoing' });
      setSelected(new Set([id]));
      setOpenId(id);
      setFreshId(id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [add]);

  // Enter / Escape / arrow-key navigation. Escape works even from inside an
  // input field so it can dismiss the dock or cancel a pending Ctrl+click.
  // Enter is a no-op when the dock is already open (selection is the
  // selected node already). Arrows navigate spatially, and if the dock is
  // open they swap its content as you move.
  React.useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      const tag = t && t.tagName;
      const inField = tag === 'INPUT' || tag === 'TEXTAREA' || (t && t.isContentEditable);

      if (e.key === 'Escape') {
        if (openId != null) { e.preventDefault(); closeDock(); return; }
        if (ctrl.firstId) { e.preventDefault(); ctrl.cancel(); return; }
        return;
      }

      if (inField) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (selected.size !== 1) return;

      if (e.key === 'Enter') {
        if (openId != null) return;
        e.preventDefault();
        setOpenId([...selected][0]);
        setFreshId(null);
        return;
      }

      const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      const dir = arrows[e.key];
      if (!dir) return;
      e.preventDefault();
      const [dx, dy] = dir;
      const cur = byId[[...selected][0]];
      if (!cur) return;
      // Spatial nearest in the chosen direction. Score each candidate by
      // distance + perpendicular-axis penalty so on-axis neighbors win
      // over slightly closer but heavily off-axis ones.
      let best = null, bestScore = Infinity;
      for (const n of laid) {
        if (n.id === cur.id) continue;
        const ddx = n.x - cur.x, ddy = n.y - cur.y;
        const along = ddx * dx + ddy * dy;
        if (along <= 0) continue;
        const perp = Math.abs(ddx * dy - ddy * dx);
        const score = Math.hypot(ddx, ddy) + perp * 1.5;
        if (score < bestScore) { bestScore = score; best = n; }
      }
      if (best) {
        setSelected(new Set([best.id]));
        if (openId != null) { setOpenId(best.id); setFreshId(null); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, openId, laid, ctrl]);

  // Auto-close the dock whenever selection isn't exactly one node — covers
  // deselect (click empty canvas), shift-click going to multi-select, marquee
  // adds, and the node being deleted out from under the dock.
  React.useEffect(() => {
    if (openId != null && selected.size !== 1) {
      setOpenId(null);
      setFreshId(null);
    }
  }, [selected, openId]);

  const openNode = openId ? laid.find(n => n.id === openId) : null;
  const overId = addDrag.drag?.overId;

  const closeDock = () => { setOpenId(null); setFreshId(null); };

  const applyBatchStatus = (statusId) => {
    const patches = {};
    for (const id of selected) patches[id] = { status: statusId };
    updateMany(patches);
  };
  const deleteSelected = () => {
    const ids = [...selected];
    if (!ids.length) return;
    if (!confirm(`Delete ${ids.length} node${ids.length === 1 ? '' : 's'}? Links to these nodes will also be removed.`)) return;
    removeMany(ids);
    setSelected(new Set());
  };

  return (
    <div className="stage" onMouseMove={onMove} onMouseUp={onUp} onMouseDown={onBgDown}>
      <div className="undo-dock">
        <button className="btn ghost" onClick={() => {
          const cx = 400 + (Math.random() - 0.5) * 120;
          const cy = 300 + (Math.random() - 0.5) * 80;
          const id = add({ title: 'new node', parents: [], x: cx, y: cy, stage: 0, lane: 0, status: 'ongoing' });
          setSelected(new Set([id]));
        }} title="New unconnected node">+ new</button>
        <button className="btn ghost" disabled={!canUndo} onClick={() => undo()} title="Undo (Ctrl+Z)">↶ undo</button>
        <button className="btn ghost" disabled={!canRedo} onClick={() => redo()} title="Redo (Ctrl+Shift+Z)">↷ redo</button>
      </div>

      {selected.size > 1 && (
        <div className="batch-toolbar">
          <span className="batch-label">{selected.size} selected</span>
          {STATUSES.map(s => (
            <button
              key={s.id}
              className="status-chip"
              onClick={() => applyBatchStatus(s.id)}
              title={`Mark ${selected.size} as ${s.label}`}
            >
              <span className="dot" style={{background: `var(--${s.id})`}} />
              {s.label}
            </button>
          ))}
          <button className="btn danger" onClick={deleteSelected} title="Delete all selected">delete</button>
        </div>
      )}

      <svg ref={svgRef} width="100%" height="100%" style={{cursor: pan ? 'grabbing' : (addDrag.drag ? 'crosshair' : 'default')}}>
        <g transform={`translate(${view.tx},${view.ty}) scale(${view.scale})`}>
          <rect x="-5000" y="-5000" width="10000" height="10000" fill="transparent" className="bg-capture" />

          {laid.map(n => (n.parents||[]).map(pid => {
            const p = byId[pid]; if (!p) return null;
            const abandoned = n.status === 'abandoned' || p.status === 'abandoned';
            const x1 = p.x + 14, y1 = p.y, x2 = n.x - 14, y2 = n.y;
            const mid = sketchMid(x1, y1, x2, y2, pid+n.id);
            return (
              <g key={`e-${pid}-${n.id}`}>
                <path d={sketchPath(x1, y1, x2, y2, pid+n.id)} className={`edge ${abandoned ? 'abandoned' : ''}`} />
                <path
                  d="M -2.2,-2.6 L 3.6,0 L -2.2,2.6 Z"
                  transform={`translate(${mid.x},${mid.y}) rotate(${mid.angle})`}
                  className={`edge-arrow ${abandoned ? 'abandoned' : ''}`}
                />
              </g>
            );
          }))}

          {addDrag.drag && (<>
            <path d={sketchPath(byId[addDrag.drag.fromNode.id].x, byId[addDrag.drag.fromNode.id].y, addDrag.drag.x, addDrag.drag.y, 'ghost')} className="drag-edge" />
            {!overId && <circle cx={addDrag.drag.x} cy={addDrag.drag.y} r="14" className="ghost-node" />}
          </>)}

          {marquee && (
            <rect
              x={Math.min(marquee.x1, marquee.x2)}
              y={Math.min(marquee.y1, marquee.y2)}
              width={Math.abs(marquee.x2 - marquee.x1)}
              height={Math.abs(marquee.y2 - marquee.y1)}
              className="marquee-rect"
            />
          )}

          {laid.map(n => {
            const isOver = overId === n.id;
            const isFirst = ctrl.firstId === n.id;
            return (
              <g key={n.id} onDoubleClick={(e) => { e.stopPropagation(); setSelected(new Set([n.id])); setOpenId(n.id); setFreshId(null); }}>
                {(isOver || isFirst) && <circle cx={n.x} cy={n.y} r="28" fill="none" stroke="var(--rust)" strokeWidth="2.5" strokeDasharray="5 3" />}
                <SketchyNode
                  node={n}
                  cx={n.x}
                  cy={n.y}
                  labelPosition="above"
                  selected={selected.has(n.id) && !isOver && !isFirst}
                  onClick={(node, e) => {
                    if (e && ctrl.tryPick(e, node)) return;
                    if (justDraggedRef.current) { justDraggedRef.current = false; return; }
                    // A non-Ctrl click exits Ctrl+click connect/disconnect mode.
                    if (ctrl.firstId) ctrl.cancel();
                    if (e && e.shiftKey) {
                      setSelected(prev => {
                        const next = new Set(prev);
                        if (next.has(node.id)) next.delete(node.id); else next.add(node.id);
                        return next;
                      });
                    } else {
                      setSelected(new Set([node.id]));
                      // Dock is non-modal: a single click while it's open
                      // swaps the displayed node rather than just selecting.
                      if (openId != null && openId !== node.id) {
                        setOpenId(node.id);
                        setFreshId(null);
                      }
                    }
                  }}
                  onStartDrag={startNodeDrag}
                  onStartAddDrag={addDrag.startAddDrag}
                />
              </g>
            );
          })}
        </g>
      </svg>

      {openNode && (
        <div className="dock" onMouseDown={e => e.stopPropagation()}>
          <DetailForm node={openNode} onChange={patch => update(openNode.id, patch)} onDelete={() => { remove(openNode.id); closeDock(); }} onClose={closeDock} autoFocusTitle={openId === freshId} />
        </div>
      )}

      <Legend />
    </div>
  );
}

window.V4Canvas = V4Canvas;
