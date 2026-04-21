// App shell — tabs, shared store, export/import.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "defaultView": "v4",
  "hSpace": 1.0,
  "vSpace": 1.0
}/*EDITMODE-END*/;

// Views still read tweaks.hSpace / tweaks.vSpace for layout math; the UI to
// change them was dropped, so just freeze at defaults.
const tweaks = { hSpace: TWEAK_DEFAULTS.hSpace, vSpace: TWEAK_DEFAULTS.vSpace };

function App() {
  const store = useStore();
  const [view, setView] = React.useState(() => {
    try { return localStorage.getItem('research-tree-view') || TWEAK_DEFAULTS.defaultView; } catch (e) { return TWEAK_DEFAULTS.defaultView; }
  });

  React.useEffect(() => {
    try { localStorage.setItem('research-tree-view', view); } catch(e) {}
  }, [view]);

  React.useEffect(() => {
    const onKey = (e) => {
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
  }, [store.undo, store.redo]);

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
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
