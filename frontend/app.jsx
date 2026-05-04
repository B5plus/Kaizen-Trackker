// Trackker — Public node graph (read-only)
const { useState, useEffect, useRef, useMemo } = React;
const h = window.helpers;

const Avatar = ({ name }) => (
  <div className="avatar sm" style={{ background: h.avatarBg(name) }} title={name}>
    {h.initials(name)}
  </div>
);

const NodeCard = ({ node, status }) => {
  const dl = h.deadlineDisplay(node);
  return (
    <div className={`node ${status}`} style={{ left: node.pos_x, top: node.pos_y }}>
      <div className="node-head">
        <div className="node-row">
          <span className={`k-badge ${status}`}>
            <span className="dot"></span>{h.statusLabel(status)}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--txt-3)' }}>
            {node.progress}%
          </span>
        </div>
        <div className="node-title">{node.title}</div>
        {node.description && <div className="node-desc">{node.description}</div>}
      </div>
      <div className="node-body">
        <div className="node-meta">
          <div className="meta-row">
            <i data-lucide="user"></i>
            <span className="lbl">Dev</span>
            <Avatar name={node.developer} />
            <span className="val" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {node.developer || 'Unassigned'}
            </span>
          </div>
          <div className="meta-row">
            <i data-lucide="calendar"></i>
            <span className="lbl">Due</span>
            <span className={`val ${dl.tone}`}>{dl.text}</span>
          </div>
        </div>
        <div className="node-progress">
          <div className="np-row">
            <span className="l">Progress</span>
            <span className="v">{node.progress}%</span>
          </div>
          <div className="np-bar"><span style={{ width: `${node.progress}%` }} /></div>
        </div>
      </div>
    </div>
  );
};

// Curved edge from one node to another (right side -> left side)
const NODE_W = 260, NODE_H = 168;
function edgePath(a, b) {
  const x1 = a.pos_x + NODE_W;
  const y1 = a.pos_y + NODE_H / 2;
  const x2 = b.pos_x;
  const y2 = b.pos_y + NODE_H / 2;
  const dx = Math.max(40, Math.abs(x2 - x1) * 0.5);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

const Graph = ({ nodes }) => {
  useEffect(() => { window.lucide && window.lucide.createIcons(); }, [nodes]);

  const byId = useMemo(() => {
    const m = {}; nodes.forEach(n => m[n.id] = n); return m;
  }, [nodes]);

  const edges = [];
  nodes.forEach(src => {
    (src.connections || []).forEach(tgtId => {
      const tgt = byId[tgtId];
      if (tgt) edges.push({ src, tgt, status: h.effectiveStatus(src) });
    });
  });

  // Size the canvas to fit the actual node positions (with padding) instead of a fixed 1800x1200
  const PAD = 80;
  const innerW = Math.max(1200, ...nodes.map(n => (n.pos_x || 0) + NODE_W)) + PAD;
  const innerH = Math.max(700,  ...nodes.map(n => (n.pos_y || 0) + NODE_H)) + PAD;

  return (
    <div className="graph-canvas">
      <div className="graph-inner" style={{ width: innerW, height: innerH }}>
        <svg className="graph-edges" width={innerW} height={innerH}>
          <defs>
            <marker id="arrow-ok" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" fill="rgba(52,211,153,0.7)" />
            </marker>
            <marker id="arrow-warn" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" fill="rgba(251,191,36,0.7)" />
            </marker>
            <marker id="arrow-idle" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" fill="rgba(107,122,153,0.6)" />
            </marker>
          </defs>
          {edges.map((e, i) => {
            const cls = e.status === 'completed' ? 'completed' : (e.status === 'progress' || e.status === 'overdue') ? 'progress' : 'notstarted';
            const marker = cls === 'completed' ? 'arrow-ok' : cls === 'progress' ? 'arrow-warn' : 'arrow-idle';
            return (
              <path
                key={i}
                className={`edge-path ${cls}`}
                d={edgePath(e.src, e.tgt)}
                markerEnd={`url(#${marker})`}
              />
            );
          })}
        </svg>
        {nodes.map(n => (
          <NodeCard key={n.id} node={n} status={h.effectiveStatus(n)} />
        ))}
      </div>
    </div>
  );
};

const KPIs = ({ nodes }) => {
  useEffect(() => { window.lucide && window.lucide.createIcons(); }, [nodes]);
  const completed = nodes.filter(n => n.status === 'completed').length;
  const inProgress = nodes.filter(n => n.status === 'progress').length;
  const notStarted = nodes.filter(n => n.status === 'notstarted').length;
  const overdue = nodes.filter(n => n.status !== 'completed' && n.deadline && h.daysUntil(n.deadline) < 0).length;
  const overall = nodes.length === 0 ? 0 : Math.round(nodes.reduce((s, n) => s + n.progress, 0) / nodes.length);

  return (
    <div className="kpi-grid compact">
      <div className="kpi">
        <div className="k-label"><i data-lucide="trending-up"></i> Overall progress</div>
        <div className="k-num">{overall}%</div>
        <div className="k-sub"><strong>{nodes.length}</strong> nodes total</div>
        <div className="micro-bar"><span style={{ width: `${overall}%`, background: 'linear-gradient(90deg, rgba(88,168,255,0.4), var(--accent))', boxShadow: '0 0 10px var(--accent-glow)' }} /></div>
      </div>
      <div className="kpi completed-kpi">
        <div className="k-label"><i data-lucide="check-circle-2"></i> Completed</div>
        <div className="k-num">{completed}</div>
        <div className="k-sub">delivered</div>
        <div className="micro-bar"><span style={{ width: `${nodes.length ? (completed/nodes.length)*100 : 0}%`, background: 'linear-gradient(90deg, rgba(52,211,153,0.4), var(--ok))', boxShadow: '0 0 10px var(--ok-glow)' }} /></div>
      </div>
      <div className="kpi progress-kpi">
        <div className="k-label"><i data-lucide="loader"></i> In progress</div>
        <div className="k-num">{inProgress}</div>
        <div className="k-sub">{notStarted} not started</div>
        <div className="micro-bar"><span style={{ width: `${nodes.length ? (inProgress/nodes.length)*100 : 0}%`, background: 'linear-gradient(90deg, rgba(251,191,36,0.4), var(--warn))', boxShadow: '0 0 10px var(--warn-glow)' }} /></div>
      </div>
      <div className="kpi">
        <div className="k-label" style={{ color: overdue > 0 ? 'var(--danger)' : undefined }}>
          <i data-lucide="alert-triangle"></i> Overdue
        </div>
        <div className="k-num" style={{ color: overdue > 0 ? 'var(--danger)' : '#fff' }}>{overdue}</div>
        <div className="k-sub">{overdue === 0 ? 'all on track' : 'need attention'}</div>
        <div className="micro-bar"><span style={{ width: `${nodes.length ? (overdue/nodes.length)*100 : 0}%`, background: overdue > 0 ? 'linear-gradient(90deg, rgba(248,113,113,0.4), var(--danger))' : 'rgba(255,255,255,0.08)' }} /></div>
      </div>
    </div>
  );
};

const Topbar = () => {
  useEffect(() => { window.lucide && window.lucide.createIcons(); });
  return (
    <header className="topbar">
      <div className="brand">
        <div className="logo">T</div>
        <div>
          <div className="name">Trackker</div>
          <div className="sub">Project status</div>
        </div>
      </div>
      <div className="spacer" />
      <div className="view-pill client"><i data-lucide="eye"></i> Live · read only</div>
      <nav className="nav-tabs">
        <a href="/" className="active"><i data-lucide="git-branch"></i> Overview</a>
      </nav>
    </header>
  );
};

const App = () => {
  const [nodes, setNodes] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => { window.lucide && window.lucide.createIcons(); }, [nodes, error]);

  const load = () => {
    window.api.listNodes()
      .then(setNodes)
      .catch(e => setError(e.message));
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 8000); // light polling for live updates
    return () => clearInterval(t);
  }, []);

  return (
    <>
      <Topbar />
      <main className="main" data-screen-label="Public · Node Graph">
        <div className="page-header">
          <div>
            <div className="page-eyebrow">Live status</div>
            <h1 className="page-title">Kaizen Digitization Tracker</h1>
          </div>
          {nodes && <KPIs nodes={nodes} />}
        </div>

        <div className="graph-wrap">
          {nodes === null && !error && (
            <div className="loading"><div className="spinner"></div> Loading nodes…</div>
          )}
          {error && (
            <div className="empty">
              <i data-lucide="alert-triangle"></i>
              <div style={{ color: 'var(--danger)' }}>{error}</div>
              <div style={{ marginTop: 6, fontSize: 12 }}>Make sure the backend is running and Supabase is connected.</div>
            </div>
          )}
          {nodes && nodes.length === 0 && (
            <div className="empty">
              <i data-lucide="git-branch"></i>
              <div>No nodes yet. Visit <a href="/admin.html" style={{ color: 'var(--accent)' }}>/admin.html</a> to add some.</div>
            </div>
          )}
          {nodes && nodes.length > 0 && <Graph nodes={nodes} />}
        </div>
      </main>
    </>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
