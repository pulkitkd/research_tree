function V4Canvas({ store, tweaks }) {
  const { nodes, update, updateMany, remove, add, connect, toggleLink, undo, redo, canUndo, canRedo } = store;
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
    // Starting a drag cancels any pending Ctrl+click connect/disconnect mode.
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
    if (pan) {
      panMovedRef.current = true;
      setView(v => ({ ...v, tx: v.tx + (e.clientX - pan.x), ty: v.ty + (e.clientY - pan.y) }));
      setPan({ x: e.clientX, y: e.clientY });
    }
  };
  const onUp = (e) => {
    addDrag.onMouseUp(e);
    setDragNode(null);
    // Pure click on empty background (mousedown without subsequent move) clears the selection.
    if (pan && !panMovedRef.current) setSelected(new Set());
    setPan(null);
    panMovedRef.current = false;
  };
  const onBgDown = (e) => {
    if (e.target === svgRef.current || e.target.classList.contains('bg-capture')) {
      if (ctrl.firstId) ctrl.cancel();
      panMovedRef.current = false;
      setPan({ x: e.clientX, y: e.clientY });
    }
  };

  const openNode = openId ? laid.find(n => n.id === openId) : null;
  const overId = addDrag.drag?.overId;

  const closeModal = () => setOpenId(null);

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
