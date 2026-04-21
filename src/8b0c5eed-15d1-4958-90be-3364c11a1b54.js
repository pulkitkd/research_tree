function V1Spine({ store, tweaks }) {
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

  const SX = STAGE_X * tweaks.hSpace;
  const SY = LANE_Y * tweaks.vSpace;

  const laid = React.useMemo(() => nodes.map(n => ({
    ...n, x: 180 + n.stage * SX, y: 300 + n.lane * SY,
  })), [nodes, SX, SY]);
  const byId = Object.fromEntries(laid.map(n => [n.id, n]));
  const hitTest = makeHitTest(laid, 26);

  const lanes = React.useMemo(() => {
    const ls = new Set(nodes.map(n => Math.round(n.lane)));
    return [...ls].sort((a,b) => a-b);
  }, [nodes]);
  const stageRange = React.useMemo(() => {
    const s = nodes.map(n => n.stage);
    return { min: Math.min(...s, 0), max: Math.max(...s, 6) };
  }, [nodes]);

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
      const stageDelta = Math.max(0, Math.round(dx / SX));
      const laneDelta  = Math.round(dy / SY);
      if (stageDelta === 0 && laneDelta === 0) return;
      const id = add({ title: 'new step', parents: [fromNode.id], stage: fromNode.stage + stageDelta, lane: fromNode.lane + laneDelta, status: 'ongoing' });
      setSelected(id);
    },
    (fromNode, toNode) => { connect(fromNode.id, toNode.id); },
    (pt) => {
      const lx = pt.x - view.tx, ly = pt.y - view.ty;
      return hitTest({ x: lx, y: ly });
    }
  );

  const ctrl = useCtrlConnect((a, b) => connect(a, b));

  const onMove = (e) => {
    addDrag.onMouseMove(e);
    if (dragNode) {
      const pt = toSvgPoint(svgRef.current, e.clientX, e.clientY);
      const rawX = pt.x - view.tx - dragNode.ox;
      const rawY = pt.y - view.ty - dragNode.oy;
      const newStage = Math.max(0, Math.round((rawX - 180) / SX));
      const newLane  = Math.round((rawY - 300) / SY);
      update(dragNode.id, { stage: newStage, lane: newLane });
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

  const laneSummary = (lane) => {
    const inLane = laid.filter(n => n.lane === lane);
    return { count: inLane.length };
  };

  return (
    <div className="stage" onMouseMove={onMove} onMouseUp={onUp} onMouseDown={onBgDown}>
      <svg ref={svgRef} width="100%" height="100%"
           style={{cursor: pan ? 'grabbing' : (addDrag.drag ? 'crosshair' : (dragNode ? 'grabbing' : 'default'))}}
           onClick={() => setSelected(null)}>
        <g transform={`translate(${view.tx},${view.ty})`}>
          <rect x="-5000" y="-5000" width="10000" height="10000" fill="transparent" className="bg-capture" />

          {lanes.map(L => {
            const y = 300 + L * SY;
            const x0 = 80 + stageRange.min * SX;
            const x1 = 260 + stageRange.max * SX;
            const isMain = L === 0;
            const sum = laneSummary(L);
            return (
              <g key={'lane'+L}>
                <line x1={x0} x2={x1} y1={y} y2={y} stroke={isMain ? 'var(--ink)' : 'var(--ink-faint)'} strokeWidth={isMain ? 1.6 : 1} strokeDasharray={isMain ? '' : '2 6'} />
                <text x={x0 - 10} y={y + 4} textAnchor="end" className="lane-label">{isMain ? 'main' : (L < 0 ? `lucie ${L}` : `ngcm ${L}`)}</text>
                <text x={x0 - 10} y={y + 18} textAnchor="end" style={{fontFamily:'var(--mono)', fontSize:9, fill:'var(--ink-soft)'}}>{sum.count} {sum.count===1?'node':'nodes'}</text>
              </g>
            );
          })}

          {Array.from({length: stageRange.max - stageRange.min + 1}).map((_, i) => {
            const s = stageRange.min + i;
            const x = 180 + s * SX;
            return (
              <g key={'tick'+s}>
                <line x1={x} x2={x} y1={280} y2={286} stroke="var(--ink)" strokeWidth="1" />
                <text x={x} y={274} textAnchor="middle" style={{fontFamily:'var(--mono)', fontSize:9, fill:'var(--ink-soft)'}}>{s+1}</text>
              </g>
            );
          })}

          {laid.map(n => (n.parents||[]).map(pid => {
            const p = byId[pid]; if (!p) return null;
            const abandoned = n.status === 'abandoned' || p.status === 'abandoned';
            return <path key={`e-${pid}-${n.id}`} d={stepPath(p.x + 14, p.y, n.x - 14, n.y, pid+n.id)} className={`edge ${abandoned ? 'abandoned' : ''}`} />;
          }))}

          {dragNode && (() => {
            const n = byId[dragNode.id];
            return <rect x={n.x - 24} y={n.y - 20} width="48" height="40" fill="none" stroke="var(--rust)" strokeDasharray="4 3" strokeWidth="1.5" rx="6" />;
          })()}

          {addDrag.drag && (() => {
            const gx = adjLocal(addDrag.drag.x, addDrag.drag.y);
            const f = byId[addDrag.drag.fromNode.id];
            return (<>
              <path d={sketchPath(f.x, f.y, gx.x, gx.y, 'ghost')} className="drag-edge" />
              {!overId && <circle cx={gx.x} cy={gx.y} r="14" className="ghost-node" />}
            </>);
          })()}

          {laid.map(n => {
            const isOver = overId === n.id;
            const isFirst = ctrl.firstId === n.id;
            return (
              <g key={n.id}>
                {(isOver || isFirst) && <circle cx={n.x} cy={n.y} r="28" fill="none" stroke="var(--rust)" strokeWidth="2.5" strokeDasharray="5 3" />}
                <SketchyNode
                  node={n} cx={n.x} cy={n.y} r={18}
                  selected={selected === n.id}
                  onClick={(node, e) => { if (e && ctrl.tryPick(e, node)) return; if (!dragNode || !dragNode.moved) setSelected(node.id); }}
                  onStartDrag={startNodeDrag}
                  onStartAddDrag={addDrag.startAddDrag}
                />
              </g>
            );
          })}
        </g>
      </svg>

      {selNode && (
        <div className="side-panel" onClick={e => e.stopPropagation()}>
          <DetailForm node={selNode} onChange={patch => update(selNode.id, patch)} onDelete={() => { remove(selNode.id); setSelected(null); }} onClose={() => setSelected(null)} />
        </div>
      )}

      <Legend />
    </div>
  );
}

window.V1Spine = V1Spine;
