function V4Canvas({ store, tweaks }) {
  const { nodes, update, updateMany, remove, removeMany, add, connect, toggleLink, undo, redo, canUndo, canRedo } = store;
  const svgRef = React.useRef(null);
  // `selected` is a Set of ids — purely for selection (sel-ring + group drag).
  // Detail card is gated by `openId` (double-click to open) so selection
  // gestures like shift+click aren't blocked by the modal.
  const [selected, setSelected] = React.useState(() => new Set());
  const [openId, setOpenId] = React.useState(null);
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

  const openNode = openId ? laid.find(n => n.id === openId) : null;
  const overId = addDrag.drag?.overId;

  const closeModal = () => setOpenId(null);

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
            return <path key={`e-${pid}-${n.id}`} d={sketchPath(p.x + 14, p.y, n.x - 14, n.y, pid+n.id)} className={`edge ${abandoned ? 'abandoned' : ''}`} />;
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
              <g key={n.id} onDoubleClick={(e) => { e.stopPropagation(); setOpenId(n.id); }}>
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
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <DetailForm node={openNode} onChange={patch => update(openNode.id, patch)} onDelete={() => { remove(openNode.id); closeModal(); }} onClose={closeModal} />
          </div>
        </div>
      )}

      <Legend />
    </div>
  );
}

window.V4Canvas = V4Canvas;
