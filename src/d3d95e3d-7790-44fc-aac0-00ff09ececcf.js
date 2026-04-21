// Shared components — Node, DetailPanel, StatusChip, hints

const { useState, useRef, useEffect, useMemo } = React;

function SketchyNode({ node, cx, cy, selected, onClick, onStartDrag, onStartAddDrag, showDate = true, r = 16, labelPosition = 'right' }) {
  const [jx, jy] = wobble(node.id, 2.5);
  const [rx, ry] = wobble(node.id + 'r', 1.5);
  const rrx = r + rx, rry = r + ry;
  const cls = `node-circle ${node.status}`;
  const above = labelPosition === 'above';

  return (
    <g className="node-g" transform={`translate(${cx + jx}, ${cy + jy})`}>
      {selected && (
        <ellipse rx={rrx + 8} ry={rry + 8} className="sel-ring" />
      )}
      <ellipse
        rx={rrx} ry={rry}
        className={cls}
        onMouseDown={(e) => onStartDrag && onStartDrag(e, node)}
        onClick={(e) => { e.stopPropagation(); onClick && onClick(node, e); }}
      />
      {/* inner core ring to indicate status even on white abandoned */}
      <ellipse rx={rrx - 4} ry={rry - 4} className={`node-core ${node.status}`} />

      {above ? (
        <>
          <text className={`node-label ${node.status}`} x={0} y={-rry - 14} textAnchor="middle">{node.title}</text>
          {showDate && <text className="node-date" x={0} y={rry + 14} textAnchor="middle">{node.date}</text>}
        </>
      ) : (
        <>
          <text className={`node-label ${node.status}`} x={r + 8} y={4}>{node.title}</text>
          {showDate && <text className="node-date" x={r + 8} y={18}>{node.date}</text>}
        </>
      )}

      {/* + handle to drag a new child */}
      {onStartAddDrag && (
        <g
          className="add-handle-g"
          transform={`translate(${rrx + 2}, ${-rry - 2})`}
          onMouseDown={(e) => { e.stopPropagation(); onStartAddDrag(e, node); }}
          style={{ cursor: 'crosshair' }}
        >
          <circle r="8" className="add-handle" />
          <line x1="-4" y1="0" x2="4" y2="0" className="add-handle-plus" />
          <line x1="0" y1="-4" x2="0" y2="4" className="add-handle-plus" />
        </g>
      )}
    </g>
  );
}

function StatusChip({ value, onChange }) {
  return (
    <div className="status-picker">
      {STATUSES.map(s => (
        <button
          key={s.id}
          className={`status-chip ${value === s.id ? 'active '+s.id : ''}`}
          onClick={() => onChange(s.id)}
        >
          <span className={`dot ld-${s.id}`} style={{background: `var(--${s.id})`}} />
          {s.label}
        </button>
      ))}
    </div>
  );
}

function DetailForm({ node, onChange, onDelete, onClose }) {
  if (!node) return null;
  return (
    <>
      <button className="xclose" onClick={onClose} aria-label="close">✕</button>
      <h3>node details</h3>
      <div style={{fontFamily:'var(--mono)', fontSize:10, color:'var(--ink-soft)'}}>id: {node.id}</div>

      <div className="field">
        <label>Title</label>
        <input value={node.title} onChange={e => onChange({ title: e.target.value })} />
      </div>
      <div className="field">
        <label>Date</label>
        <input type="date" value={node.date} onChange={e => onChange({ date: e.target.value })} />
      </div>
      <div className="field">
        <label>Status</label>
        <StatusChip value={node.status} onChange={v => onChange({ status: v })} />
      </div>
      <div className="field">
        <label>Description / notes</label>
        <textarea value={node.description} onChange={e => onChange({ description: e.target.value })} placeholder="what happened, what's next, blockers..." />
      </div>

      <div className="panel-actions">
        <button className="btn danger" onClick={onDelete}>delete</button>
        <button className="btn" style={{marginLeft:'auto'}} onClick={onClose}>close</button>
      </div>
    </>
  );
}

function Legend() {
  return (
    <div className="legend">
      <div className="legend-item"><span className="legend-dot ld-ongoing"/>ongoing</div>
      <div className="legend-item"><span className="legend-dot ld-blocked"/>blocked</div>
      <div className="legend-item"><span className="legend-dot ld-clarify"/>needs clarification</div>
      <div className="legend-item"><span className="legend-dot ld-done"/>done</div>
      <div className="legend-item"><span className="legend-dot ld-abandoned"/>abandoned</div>
    </div>
  );
}

// Drag-to-create helper hook.
// onCreate(fromNode, pt)   — pointer released over empty space
// onConnect(fromNode, toNode) — pointer released over an existing node (optional)
// hitTest(pt) -> node|null  — caller-supplied node hit detector (optional)
function useAddByDrag(svgRef, onCreate, onConnect, hitTest) {
  const [drag, setDrag] = useState(null); // { fromNode, x, y, overId }
  const startAddDrag = (e, fromNode) => {
    e.stopPropagation();
    e.preventDefault();
    const pt = toSvgPoint(svgRef.current, e.clientX, e.clientY);
    setDrag({ fromNode, x: pt.x, y: pt.y, overId: null });
  };
  const onMouseMove = (e) => {
    if (!drag) return;
    const pt = toSvgPoint(svgRef.current, e.clientX, e.clientY);
    const hit = hitTest ? hitTest(pt) : null;
    const overId = hit && hit.id !== drag.fromNode.id ? hit.id : null;
    setDrag(d => d ? { ...d, x: pt.x, y: pt.y, overId } : null);
  };
  const onMouseUp = (e) => {
    if (!drag) return;
    const pt = toSvgPoint(svgRef.current, e.clientX, e.clientY);
    const hit = hitTest ? hitTest(pt) : null;
    if (hit && hit.id !== drag.fromNode.id && onConnect) {
      onConnect(drag.fromNode, hit);
    } else {
      onCreate(drag.fromNode, pt);
    }
    setDrag(null);
  };
  return { drag, startAddDrag, onMouseMove, onMouseUp };
}

// Ctrl/Cmd+click connect: 2-step picker state.
function useCtrlConnect(onConnect) {
  const [first, setFirst] = useState(null);
  const tryPick = (e, node) => {
    if (!(e.ctrlKey || e.metaKey)) return false;
    e.stopPropagation();
    e.preventDefault();
    if (!first) {
      setFirst(node.id);
      return true;
    }
    if (first === node.id) {
      setFirst(null);
      return true;
    }
    onConnect(first, node.id);
    setFirst(null);
    return true;
  };
  const cancel = () => setFirst(null);
  return { firstId: first, tryPick, cancel };
}

// Distance-based node hit test. nodesWithXY: [{id,x,y}], r default 22.
function makeHitTest(nodesWithXY, r = 24) {
  return (pt) => {
    for (const n of nodesWithXY) {
      const dx = pt.x - n.x, dy = pt.y - n.y;
      if (dx*dx + dy*dy <= r*r) return n;
    }
    return null;
  };
}

function toSvgPoint(svg, clientX, clientY) {
  if (!svg) return { x: clientX, y: clientY };
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: clientX, y: clientY };
  const p = pt.matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}

window.SketchyNode = SketchyNode;
window.StatusChip = StatusChip;
window.DetailForm = DetailForm;
window.Legend = Legend;
window.useAddByDrag = useAddByDrag;
window.useCtrlConnect = useCtrlConnect;
window.makeHitTest = makeHitTest;
window.toSvgPoint = toSvgPoint;
