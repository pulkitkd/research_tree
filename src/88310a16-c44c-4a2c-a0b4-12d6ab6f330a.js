function V2Notebook({ store, tweaks }) {
  const { nodes, update, remove, add, connect } = store;
  const svgRef = React.useRef(null);
  const [selected, setSelected] = React.useState(null);
  const [dragNode, setDragNode] = React.useState(null);
  const [view, setView] = React.useState({ tx: 0, ty: 0 });
  const [pan, setPan] = React.useState(null);

  React.useEffect(() => {
    const onSelect = (e) => setSelected(e.detail.id);
    window.addEventListener('research-tree:select', onSelect);
    return () => window.removeEventListener('research-tree:select', onSelect);
  }, []);

  const CARD_W = 180, CARD_H = 88;
  const SX = (STAGE_X + 60) * tweaks.hSpace;
  const SY = (LANE_Y + 30) * tweaks.vSpace;

  const laid = React.useMemo(() => nodes.map(n => {
    const [wx, wy] = wobble(n.id + 'np', 6);
    return { ...n, x: n.x != null ? n.x : 180 + n.stage * SX + wx, y: n.y != null ? n.y : 280 + n.lane * SY + wy };
  }), [nodes, SX, SY]);
  const byId = Object.fromEntries(laid.map(n => [n.id, n]));

  // Card-shaped hit test (rect)
  const hitTestCard = (pt) => {
    for (const n of laid) {
      if (Math.abs(pt.x - n.x) <= CARD_W/2 && Math.abs(pt.y - n.y) <= CARD_H/2) return n;
    }
    return null;
  };

  const startNodeDrag = (e, node) => {
    e.stopPropagation();
    const pt = toSvgPoint(svgRef.current, e.clientX, e.clientY);
    const n = byId[node.id];
    setDragNode({ id: node.id, ox: pt.x - view.tx - n.x, oy: pt.y - view.ty - n.y, moved: false });
  };

  const addDrag = useAddByDrag(
    svgRef,
    (fromNode, pt) => {
      const lx = pt.x - view.tx, ly = pt.y - view.ty;
      const f = byId[fromNode.id];
      const dx = lx - f.x, dy = ly - f.y;
      if (Math.hypot(dx, dy) < 30) return;
      const id = add({ title: 'new note', description: 'what happened here…', parents: [fromNode.id], stage: fromNode.stage, lane: fromNode.lane, x: lx, y: ly, status: 'ongoing' });
      setSelected(id);
    },
    (fromNode, toNode) => { connect(fromNode.id, toNode.id); },
    (pt) => hitTestCard({ x: pt.x - view.tx, y: pt.y - view.ty })
  );

  const ctrl = useCtrlConnect((a, b) => connect(a, b));

  const onMove = (e) => {
    addDrag.onMouseMove(e);
    if (dragNode) {
      const pt = toSvgPoint(svgRef.current, e.clientX, e.clientY);
      update(dragNode.id, { x: pt.x - view.tx - dragNode.ox, y: pt.y - view.ty - dragNode.oy });
      setDragNode(d => d ? { ...d, moved: true } : null);
    }
    if (pan) {
      setView(v => ({ tx: v.tx + (e.clientX - pan.x), ty: v.ty + (e.clientY - pan.y) }));
      setPan({ x: e.clientX, y: e.clientY });
    }
  };
  const onUp = (e) => { addDrag.onMouseUp(e); setDragNode(null); setPan(null); };
  const onBgDown = (e) => {
    if (e.target === svgRef.current || e.target.classList.contains('bg-capture')) {
      if (ctrl.firstId) ctrl.cancel();
      setPan({ x: e.clientX, y: e.clientY });
    }
  };

  const selNode = laid.find(n => n.id === selected);
  const adjLocal = (x, y) => ({ x: x - view.tx, y: y - view.ty });
  const overId = addDrag.drag?.overId;

  const cardAnchor = (n, side) => {
    if (side === 'right') return { x: n.x + CARD_W/2, y: n.y };
    if (side === 'left')  return { x: n.x - CARD_W/2, y: n.y };
    if (side === 'top')   return { x: n.x, y: n.y - CARD_H/2 };
    return { x: n.x, y: n.y + CARD_H/2 };
  };
  const attach = (from, to) => {
    const dx = to.x - from.x, dy = to.y - from.y;
    if (Math.abs(dx) > Math.abs(dy)) return [cardAnchor(from, dx > 0 ? 'right' : 'left'), cardAnchor(to, dx > 0 ? 'left' : 'right')];
    return [cardAnchor(from, dy > 0 ? 'bottom' : 'top'), cardAnchor(to, dy > 0 ? 'top' : 'bottom')];
  };

  return (
    <div className="stage" onMouseMove={onMove} onMouseUp={onUp} onMouseDown={onBgDown}>
      <svg ref={svgRef} width="100%" height="100%"
           style={{cursor: pan ? 'grabbing' : (addDrag.drag ? 'crosshair' : (dragNode ? 'grabbing' : 'default'))}}
           onClick={() => setSelected(null)}>
        <g transform={`translate(${view.tx},${view.ty})`}>
          <rect x="-5000" y="-5000" width="10000" height="10000" fill="transparent" className="bg-capture" />

          {laid.map(n => (n.parents||[]).map(pid => {
            const p = byId[pid]; if (!p) return null;
            const abandoned = n.status === 'abandoned' || p.status === 'abandoned';
            const [a, b] = attach(p, n);
            return <path key={`e-${pid}-${n.id}`} d={sketchPath(a.x, a.y, b.x, b.y, pid+n.id)} className={`edge ${abandoned ? 'abandoned' : ''}`} />;
          }))}

          {addDrag.drag && (() => {
            const gx = adjLocal(addDrag.drag.x, addDrag.drag.y);
            const f = byId[addDrag.drag.fromNode.id];
            return (<>
              <path d={sketchPath(f.x + CARD_W/2, f.y, gx.x, gx.y, 'ghost')} className="drag-edge" />
              {!overId && <rect x={gx.x - CARD_W/2} y={gx.y - CARD_H/2} width={CARD_W} height={CARD_H} rx="6" fill="var(--paper-2)" stroke="var(--rust)" strokeDasharray="4 3" strokeWidth="1.5" opacity="0.8"/>}
            </>);
          })()}

          {laid.map(n => {
            const [jx, jy] = wobble(n.id + 'card', 2);
            const isSel = selected === n.id;
            const isOver = overId === n.id;
            const isFirst = ctrl.firstId === n.id;
            const abandoned = n.status === 'abandoned';
            return (
              <g key={n.id} transform={`translate(${n.x + jx}, ${n.y + jy})`}
                 onMouseDown={(e) => startNodeDrag(e, n)}
                 onClick={(e) => { e.stopPropagation(); if (ctrl.tryPick(e, n)) return; if (!dragNode || !dragNode.moved) setSelected(n.id); }}
                 style={{cursor: 'grab', opacity: abandoned ? 0.5 : 1}}>
                {(isOver || isFirst) && <rect x={-CARD_W/2 - 8} y={-CARD_H/2 - 8} width={CARD_W + 16} height={CARD_H + 16} rx="9" fill="none" stroke="var(--rust)" strokeWidth="2.5" strokeDasharray="5 3" />}
                <rect x={-CARD_W/2 + 3} y={-CARD_H/2 + 4} width={CARD_W} height={CARD_H} rx="6" fill="rgba(42,33,25,0.1)" />
                <rect
                  x={-CARD_W/2} y={-CARD_H/2} width={CARD_W} height={CARD_H} rx="6"
                  className={`card-body ${n.status}`}
                  fill={`var(--paper-${n.status}, var(--paper))`}
                  strokeDasharray={abandoned ? '4 3' : ''}
                />
                <rect x={-CARD_W/2} y={-CARD_H/2} width="6" height={CARD_H} fill={`var(--${n.status})`} rx="3" />
                <text className="card-title" x={-CARD_W/2 + 14} y={-CARD_H/2 + 18} style={{textDecoration: abandoned ? 'line-through' : 'none'}}>
                  {n.title.length > 22 ? n.title.slice(0, 22) + '…' : n.title}
                </text>
                <text className="card-meta" x={-CARD_W/2 + 14} y={-CARD_H/2 + 32}>{n.date} · {n.status}</text>
                {n.description && (
                  <foreignObject x={-CARD_W/2 + 12} y={-CARD_H/2 + 38} width={CARD_W - 24} height={CARD_H - 44}>
                    <div className="card-desc">{n.description}</div>
                  </foreignObject>
                )}
                {isSel && <rect x={-CARD_W/2 - 5} y={-CARD_H/2 - 5} width={CARD_W + 10} height={CARD_H + 10} rx="8" fill="none" stroke="var(--rust)" strokeDasharray="5 4" strokeWidth="2" />}
                <g transform={`translate(${CARD_W/2 - 2}, ${-CARD_H/2 + 2})`} onMouseDown={(e) => { e.stopPropagation(); addDrag.startAddDrag(e, n); }} style={{ cursor: 'crosshair' }}>
                  <circle r="9" className="add-handle" />
                  <line x1="-4" y1="0" x2="4" y2="0" className="add-handle-plus" />
                  <line x1="0" y1="-4" x2="0" y2="4" className="add-handle-plus" />
                </g>
              </g>
            );
          })}

          {selNode && (
            <foreignObject x={selNode.x - 150} y={selNode.y + CARD_H/2 + 10} width="300" height="300">
              <div className="inline-card" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
                <DetailForm node={selNode} onChange={patch => update(selNode.id, patch)} onDelete={() => { remove(selNode.id); setSelected(null); }} onClose={() => setSelected(null)} />
              </div>
            </foreignObject>
          )}
        </g>
      </svg>

      <Legend />
    </div>
  );
}

window.V2Notebook = V2Notebook;
