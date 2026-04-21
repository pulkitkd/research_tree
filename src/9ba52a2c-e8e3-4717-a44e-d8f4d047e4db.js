// Shared data store — single source of truth across all 4 variants.
// Node shape: { id, title, description, status, date, x, y, stage, lane, parents: [ids] }
// status: ongoing | blocked | clarify | done | abandoned

const STATUSES = [
  { id: 'ongoing',  label: 'ongoing' },
  { id: 'blocked',  label: 'blocked' },
  { id: 'clarify',  label: 'needs clarification' },
  { id: 'done',     label: 'done' },
  { id: 'abandoned',label: 'abandoned' },
];

// Seed data modelled on the user's napkin sketch.
// `stage` = horizontal progression index; `lane` = vertical lane (0 = main, +n = deeper drill-down)
const seedNodes = [
  // Root
  { id: 'n1', title: 'climate control with emulators', description: 'Top-level research program. Evaluate emulator-based climate intervention strategies.', status: 'done', date: '2026-01-08', stage: 0, lane: 0, parents: [] },

  // Upper branch — lucie
  { id: 'n2', title: 'install lucie', description: 'Install the LUCIE emulator. Struggled with CUDA drivers initially.', status: 'done', date: '2026-01-14', stage: 1, lane: -1, parents: ['n1'] },
  { id: 'n3', title: 'validate (lucie)', description: 'Validate LUCIE on historical reanalysis.', status: 'done', date: '2026-01-27', stage: 2, lane: -1, parents: ['n2'] },
  { id: 'n4', title: 'postprocessing (lucie)', description: 'Diagnostic pipeline, regridding, masks.', status: 'done', date: '2026-02-04', stage: 3, lane: -1, parents: ['n3'] },
  { id: 'n5', title: 'zonal cooling', description: 'Apply zonal cooling forcing, run 30-yr ensemble.', status: 'ongoing', date: '2026-03-19', stage: 4, lane: -2, parents: ['n4'] },
  { id: 'n5b', title: 'hadley response', description: 'Examine Hadley-cell contraction.', status: 'clarify', date: '2026-03-30', stage: 5, lane: -2, parents: ['n5'] },
  { id: 'n5c', title: 'write-up draft', description: 'Draft figures & results section.', status: 'ongoing', date: '2026-04-12', stage: 6, lane: -2, parents: ['n5b'] },
  { id: 'n6', title: 'patch cooling', description: 'Localized patch-cooling experiments. Competing with zonal.', status: 'blocked', date: '2026-03-22', stage: 4, lane: -0.5, parents: ['n4'] },

  // Lower branch — ngcm
  { id: 'n7', title: 'install ngcm', description: 'Install the NGCM emulator on lab cluster.', status: 'done', date: '2026-01-20', stage: 1, lane: 1, parents: ['n1'] },
  { id: 'n8', title: 'validate (ngcm)', description: 'Match vs. ERA5.', status: 'done', date: '2026-02-12', stage: 2, lane: 1, parents: ['n7'] },
  { id: 'n9', title: 'postprocessing (ngcm)', description: 'Climatology pipeline.', status: 'ongoing', date: '2026-03-02', stage: 3, lane: 1, parents: ['n8'] },

  // Vertical drill-downs off validate(ngcm)
  { id: 'n10', title: 'global mean change', description: 'Compute global-mean temperature change under forcing suite.', status: 'abandoned', date: '2026-02-18', stage: 2, lane: 2, parents: ['n8'] },
  { id: 'n11', title: 'field plots', description: 'Pointwise maps of anomaly fields.', status: 'done', date: '2026-02-24', stage: 2.4, lane: 2, parents: ['n8'] },
  { id: 'n12', title: 'time series', description: 'Regional time series & trend fits.', status: 'ongoing', date: '2026-03-10', stage: 2.4, lane: 3, parents: ['n11'] },
  { id: 'n13', title: 'ensemble based study', description: 'Compare 20-member ensemble spread for signal detection.', status: 'clarify', date: '2026-04-02', stage: 2.4, lane: 4, parents: ['n12'] },
];

// Position-y helpers — computed per-variant
const STAGE_X = 210;   // px between stages (horizontal)
const LANE_Y  = 120;   // px between lanes (vertical)

function useStore() {
  const [nodes, setNodesRaw] = React.useState(() => {
    try {
      const s = localStorage.getItem('research-tree-v1');
      if (s) return JSON.parse(s);
    } catch (e) {}
    return seedNodes;
  });

  // Undo/redo history — snapshots of `nodes` array.
  const [past, setPast] = React.useState([]);
  const [future, setFuture] = React.useState([]);
  // Coalesce rapid updates to the same node into one history entry.
  const coalesceRef = React.useRef({ id: null, t: 0, timer: null });
  const HISTORY_LIMIT = 100;
  const COALESCE_MS = 500;

  React.useEffect(() => {
    try { localStorage.setItem('research-tree-v1', JSON.stringify(nodes)); } catch (e) {}
  }, [nodes]);

  // Commits current state to history before applying a mutation. Always clears future.
  // `coalesceKey` (optional) — when a consecutive mutation has the same key within COALESCE_MS, skip pushing.
  const commit = (coalesceKey = null) => {
    const now = Date.now();
    const co = coalesceRef.current;
    const shouldSkip = coalesceKey != null && co.id === coalesceKey && (now - co.t) < COALESCE_MS;
    co.id = coalesceKey;
    co.t = now;
    // schedule a flush so next *different* action sees a fresh window
    if (co.timer) clearTimeout(co.timer);
    co.timer = setTimeout(() => { coalesceRef.current.id = null; }, COALESCE_MS);
    if (shouldSkip) return false;
    setPast(p => {
      const next = [...p, nodes];
      if (next.length > HISTORY_LIMIT) next.shift();
      return next;
    });
    setFuture([]);
    return true;
  };
  // Force the next mutation to start a new coalesce window (call from non-update mutations).
  const breakCoalesce = () => { coalesceRef.current.id = null; };

  const setNodes = setNodesRaw; // unhistoried raw access (for migrations etc)

  const update = (id, patch) => {
    commit('update:' + id);
    setNodesRaw(ns => ns.map(n => n.id === id ? { ...n, ...patch } : n));
  };
  const remove = (id) => {
    breakCoalesce(); commit();
    setNodesRaw(ns => ns.filter(n => n.id !== id).map(n => ({ ...n, parents: (n.parents||[]).filter(p => p !== id) })));
  };
  const add = (node) => {
    const id = 'n' + Math.random().toString(36).slice(2, 8);
    const full = {
      id,
      title: node.title || 'new node',
      description: node.description || '',
      status: node.status || 'ongoing',
      date: node.date || new Date().toISOString().slice(0,10),
      stage: node.stage ?? 0,
      lane: node.lane ?? 0,
      x: node.x, y: node.y,
      parents: node.parents || [],
    };
    breakCoalesce(); commit();
    setNodesRaw(ns => [...ns, full]);
    return id;
  };
  const reset = () => {
    breakCoalesce(); commit();
    setNodesRaw(seedNodes);
  };
  const load = (newNodes) => {
    if (!Array.isArray(newNodes)) return false;
    breakCoalesce(); commit();
    setNodesRaw(newNodes);
    return true;
  };
  const connect = (parentId, childId) => {
    if (parentId === childId) return;
    // cycle check against current nodes
    const parentsOf = (id) => nodes.find(n => n.id === id)?.parents || [];
    const isAncestor = (a, b, seen = new Set()) => {
      if (a === b) return true;
      if (seen.has(a)) return false;
      seen.add(a);
      return parentsOf(a).some(p => isAncestor(p, b, seen));
    };
    if (isAncestor(parentId, childId)) return;
    const child = nodes.find(n => n.id === childId);
    if (!child) return;
    if ((child.parents || []).includes(parentId)) return; // no-op
    breakCoalesce(); commit();
    setNodesRaw(ns => ns.map(n => {
      if (n.id !== childId) return n;
      return { ...n, parents: [...(n.parents||[]), parentId] };
    }));
  };
  const disconnect = (parentId, childId) => {
    breakCoalesce(); commit();
    setNodesRaw(ns => ns.map(n => n.id === childId
      ? { ...n, parents: (n.parents||[]).filter(p => p !== parentId) }
      : n
    ));
  };

  const undo = () => {
    breakCoalesce();
    setPast(p => {
      if (!p.length) return p;
      const prev = p[p.length - 1];
      setFuture(f => [nodes, ...f]);
      setNodesRaw(prev);
      return p.slice(0, -1);
    });
  };
  const redo = () => {
    breakCoalesce();
    setFuture(f => {
      if (!f.length) return f;
      const next = f[0];
      setPast(p => [...p, nodes]);
      setNodesRaw(next);
      return f.slice(1);
    });
  };

  return {
    nodes, setNodes, update, remove, add, reset, load, connect, disconnect,
    undo, redo, canUndo: past.length > 0, canRedo: future.length > 0,
  };
}

// Simple wobble — deterministic per-id so layout doesn't shift every render
function wobble(seed, amp = 3) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const r1 = ((h & 0xff) / 255 - 0.5) * 2 * amp;
  const r2 = (((h >> 8) & 0xff) / 255 - 0.5) * 2 * amp;
  return [r1, r2];
}

// Sketchy path between two points — slight curve + jitter.
function sketchPath(x1, y1, x2, y2, bendSeed = '') {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const [w1] = wobble(bendSeed + 'a', 5);
  const [w2] = wobble(bendSeed + 'b', 5);
  // for mostly-horizontal: arc gently; for mostly-vertical: same
  const mx = x1 + dx / 2;
  const my = y1 + dy / 2;
  // control points
  const c1x = x1 + dx * 0.35 + w1;
  const c1y = y1 + dy * 0.2 - Math.abs(dx) * 0.05;
  const c2x = x1 + dx * 0.65 + w2;
  const c2y = y1 + dy * 0.8 + Math.abs(dx) * 0.05;
  return `M ${x1},${y1} C ${c1x},${c1y} ${c2x},${c2y} ${x2},${y2}`;
}

// step path for v1 — horizontal then vertical
function stepPath(x1, y1, x2, y2, id='') {
  const [w1, w2] = wobble(id, 3);
  if (Math.abs(y2 - y1) < 4) {
    return `M ${x1},${y1} Q ${(x1+x2)/2 + w1},${y1 + w2} ${x2},${y2}`;
  }
  // horizontal lane, drop to new lane
  const mid = x1 + (x2 - x1) * 0.55 + w1;
  return `M ${x1},${y1} L ${mid - 10},${y1} Q ${mid},${y1} ${mid},${y1 + Math.sign(y2-y1)*10} L ${mid},${y2 - Math.sign(y2-y1)*10} Q ${mid},${y2} ${mid+10},${y2} L ${x2},${y2}`;
}

window.useStore = useStore;
window.STATUSES = STATUSES;
window.seedNodes = seedNodes;
window.STAGE_X = STAGE_X;
window.LANE_Y = LANE_Y;
window.wobble = wobble;
window.sketchPath = sketchPath;
window.stepPath = stepPath;
