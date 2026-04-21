// App shell — tabs, tweaks, shared store.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "defaultView": "v4",
  "hSpace": 1.0,
  "vSpace": 1.0
}/*EDITMODE-END*/;

function App() {
  const store = useStore();
  const [view, setView] = React.useState(() => {
    try { return localStorage.getItem('research-tree-view') || TWEAK_DEFAULTS.defaultView; } catch (e) { return TWEAK_DEFAULTS.defaultView; }
  });
  const [tweaksOn, setTweaksOn] = React.useState(false);
  const [tweaks, setTweaks] = React.useState({
    hSpace: TWEAK_DEFAULTS.hSpace,
    vSpace: TWEAK_DEFAULTS.vSpace,
  });

  React.useEffect(() => {
    try { localStorage.setItem('research-tree-view', view); } catch(e) {}
  }, [view]);

  React.useEffect(() => {
    const onMsg = (e) => {
      if (!e.data) return;
      if (e.data.type === '__activate_edit_mode') setTweaksOn(true);
      if (e.data.type === '__deactivate_edit_mode') setTweaksOn(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  // Undo/redo keyboard shortcuts (global — works in all variants)
  React.useEffect(() => {
    const onKey = (e) => {
      // Ignore when typing in inputs/textareas
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); store.undo(); }
      else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); store.redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store.undo, store.redo, store.add]);

  const persist = (patch) => {
    const next = { ...tweaks, ...patch };
    setTweaks(next);
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits: patch }, '*');
  };

  const fileInputRef = React.useRef(null);

  const exportJson = () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      nodes: store.nodes,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `research-tree-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const onImportFile = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const incoming = Array.isArray(parsed) ? parsed : parsed.nodes;
        if (!Array.isArray(incoming)) throw new Error('no nodes array');
        if (!incoming.every(n => n && typeof n.id === 'string')) throw new Error('nodes missing id');
        if (!confirm(`Replace current tree (${store.nodes.length} nodes) with ${incoming.length} nodes from ${file.name}?`)) return;
        store.load(incoming);
      } catch (err) {
        alert('Could not import: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const tabs = [
    { id: 'v4', num: 'A', label: 'Freeform Canvas' },
    { id: 'v1', num: 'B', label: 'Spine-Snap' },
    { id: 'v2', num: 'C', label: 'Notebook Trellis' },
  ];

  const subtitles = {
    v4: 'daily use · messy state · get out of the way',
    v1: 'opinionated git-graph · strict lanes · big-picture reviews',
    v2: 'lab-notebook · read the tree · journaling after time away',
  };

  return (
    <>
      <div className="topbar">
        <div className="title">research <span className="accent">tree</span></div>
        <div className="subtitle">// {subtitles[view]}</div>
        <div className="tabs">
          {tabs.map(t => (
            <button key={t.id}
              data-screen-label={`${t.num} ${t.label}`}
              className={`tab ${view === t.id ? 'active' : ''}`}
              onClick={() => setView(t.id)}>
              <span className="num">{t.num}</span>{t.label}
            </button>
          ))}
        </div>
        <div className="io-buttons" style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          <button className="btn ghost" onClick={exportJson} title="Download current tree as JSON">export ↓</button>
          <button className="btn ghost" onClick={() => fileInputRef.current && fileInputRef.current.click()} title="Load a tree from a JSON file (replaces current)">import ↑</button>
          <input ref={fileInputRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={onImportFile} />
        </div>
      </div>

      {view === 'v4' && <V4Canvas   store={store} tweaks={tweaks} />}
      {view === 'v1' && <V1Spine    store={store} tweaks={tweaks} />}
      {view === 'v2' && <V2Notebook store={store} tweaks={tweaks} />}

      {tweaksOn && (
        <div className="tweaks-panel">
          <h4>Tweaks</h4>
          <div className="tweak-row">
            <span>default view</span>
            <select value={view} onChange={e => { setView(e.target.value); persist({ defaultView: e.target.value }); }}>
              <option value="v4">A — Freeform</option>
              <option value="v1">B — Spine-Snap</option>
              <option value="v2">C — Notebook</option>
            </select>
          </div>
          <div className="tweak-row">
            <span>horizontal spacing</span>
            <input type="range" min="0.6" max="1.6" step="0.05" value={tweaks.hSpace}
              onChange={e => persist({ hSpace: parseFloat(e.target.value) })} />
          </div>
          <div className="tweak-row">
            <span>vertical spacing</span>
            <input type="range" min="0.6" max="1.6" step="0.05" value={tweaks.vSpace}
              onChange={e => persist({ vSpace: parseFloat(e.target.value) })} />
          </div>
          <div className="tweak-row">
            <span>reset data</span>
            <button className="btn" onClick={() => { if(confirm('reset the demo tree?')) store.reset(); }}>reset</button>
          </div>
        </div>
      )}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
