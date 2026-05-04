// Trackker — Admin page: manage nodes
const { useState, useEffect, useMemo } = React;
const h = window.helpers;

// Compute layered left-to-right positions from node connections.
function computeAutoLayout(nodes) {
  const NODE_W = 260, NODE_H = 168;
  const COL_W = NODE_W + 100, ROW_H = NODE_H + 60;
  const START_X = 80, START_Y = 80;

  const inDeg = {};
  nodes.forEach(n => { inDeg[n.id] = 0; });
  nodes.forEach(n => (n.connections || []).forEach(t => { if (t in inDeg) inDeg[t]++; }));

  const level = {};
  const queue = [];
  nodes.forEach(n => { if (inDeg[n.id] === 0) { level[n.id] = 0; queue.push(n.id); } });

  const byId = {};
  nodes.forEach(n => { byId[n.id] = n; });

  while (queue.length) {
    const id = queue.shift();
    (byId[id]?.connections || []).forEach(t => {
      if (!byId[t]) return;
      const next = level[id] + 1;
      if (level[t] === undefined || next > level[t]) { level[t] = next; queue.push(t); }
    });
  }
  nodes.forEach(n => { if (level[n.id] === undefined) level[n.id] = 0; });

  const byLevel = {};
  nodes.forEach(n => {
    const lv = level[n.id];
    (byLevel[lv] = byLevel[lv] || []).push(n);
  });
  Object.values(byLevel).forEach(g => g.sort((a, b) => (a.title || '').localeCompare(b.title || '')));

  const positions = {};
  Object.entries(byLevel).forEach(([lv, group]) => {
    const x = START_X + Number(lv) * COL_W;
    group.forEach((n, i) => { positions[n.id] = { x, y: START_Y + i * ROW_H }; });
  });
  return positions;
}

const Avatar = ({ name, size = 'sm' }) => (
  <div className={`avatar ${size}`} style={{ background: h.avatarBg(name) }} title={name}>
    {h.initials(name)}
  </div>
);

const Topbar = ({ onLogout }) => (
  <header className="topbar">
    <div className="brand">
      <div className="logo">T</div>
      <div>
        <div className="name">Trackker</div>
        <div className="sub">Admin</div>
      </div>
    </div>
    <div className="spacer" />
    <nav className="nav-tabs">
      <a href="/"><i data-lucide="git-branch"></i> Public</a>
      <a href="/admin.html" className="active"><i data-lucide="settings"></i> Admin</a>
    </nav>
    <div className="view-pill"><i data-lucide="shield-check"></i> Admin</div>
    <button className="btn btn-secondary btn-sm" onClick={onLogout}>
      <i data-lucide="log-out"></i> Sign out
    </button>
  </header>
);

const Login = ({ onAuth }) => {
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const ok = await window.api.checkPassword(pw);
      if (!ok) { setError('Incorrect password.'); return; }
      window.api.setPw(pw);
      onAuth();
    } catch (err) {
      setError(err.message || 'Could not reach server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="logo">T</div>
        <h1>Sign in to admin</h1>
        <p>Enter the team password to manage Kaizen nodes.</p>
        <div className="field">
          <label>Password</label>
          <input
            className="inp" type="password" autoFocus
            value={pw} onChange={e => setPw(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy || !pw}
          style={{ marginTop: 14, width: '100%', justifyContent: 'center' }}>
          {busy ? 'Checking…' : <><i data-lucide="log-in"></i> Sign in</>}
        </button>
        {error && (
          <div className="login-error">
            <i data-lucide="alert-triangle"></i> {error}
          </div>
        )}
      </form>
    </div>
  );
};

const FilterBar = ({ filter, setFilter, counts }) => {
  const chips = [
    { id: 'all', label: 'All' },
    { id: 'progress', label: 'In progress' },
    { id: 'completed', label: 'Completed' },
    { id: 'notstarted', label: 'Not started' },
    { id: 'overdue', label: 'Overdue' },
  ];
  return (
    <div className="filter-bar">
      <div className="filter-group">
        {chips.map(c => (
          <button key={c.id} className={`filter-chip ${filter === c.id ? 'active' : ''}`} onClick={() => setFilter(c.id)}>
            {c.label}<span className="count">{counts[c.id] ?? 0}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

const AddNode = ({ onAdd }) => {
  const [title, setTitle] = useState('');
  const [developer, setDeveloper] = useState('');
  const [deadline, setDeadline] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      await onAdd({ title: title.trim(), developer: developer.trim() || 'Unassigned', deadline: deadline || null });
      setTitle(''); setDeveloper(''); setDeadline('');
    } finally { setBusy(false); }
  };

  return (
    <form className="add-node-form" onSubmit={submit}>
      <div className="field">
        <label style={{ color: 'var(--accent)' }}>New node title</label>
        <input className="inp" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Backend API" />
      </div>
      <div className="field">
        <label style={{ color: 'var(--accent)' }}>Developer</label>
        <input className="inp" value={developer} onChange={e => setDeveloper(e.target.value)} placeholder="e.g. Sarah Chen" />
      </div>
      <div className="field">
        <label style={{ color: 'var(--accent)' }}>Deadline</label>
        <input className="inp" type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
      </div>
      <div className="field" style={{ alignSelf: 'end' }}>
        <button className="btn btn-primary" type="submit" disabled={busy || !title.trim()}>
          <i data-lucide="plus"></i> Add node
        </button>
      </div>
    </form>
  );
};

const NodeRow = ({ node, allNodes, onUpdate, onDelete, toast }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [connSearch, setConnSearch] = useState('');

  const status = h.effectiveStatus(node);
  const dl = h.deadlineDisplay(node);

  const startEdit = () => {
    setDraft({
      title: node.title || '',
      status: node.status || 'notstarted',
      developer: node.developer || '',
      deadline: node.deadline || '',
      description: node.description || '',
      progress: node.progress ?? 0,
      pos_x: node.pos_x || 0,
      pos_y: node.pos_y || 0,
      connections: [...(node.connections || [])],
    });
    setEditing(true);
    setConnSearch('');
  };

  const cancelEdit = () => { setEditing(false); setDraft(null); setConnSearch(''); };
  const setField = (k, v) => setDraft(d => ({ ...d, [k]: v }));

  const setStatusDraft = (st) => setDraft(d => {
    const next = { ...d, status: st };
    if (st === 'completed') next.progress = 100;
    else if (st === 'notstarted') next.progress = 0;
    return next;
  });

  const toggleConnection = (id) => setDraft(d => {
    const set = new Set(d.connections);
    if (set.has(id)) set.delete(id); else set.add(id);
    return { ...d, connections: [...set] };
  });

  const isDirty = draft && (
    draft.title !== (node.title || '') ||
    draft.status !== (node.status || 'notstarted') ||
    draft.developer !== (node.developer || '') ||
    (draft.deadline || '') !== (node.deadline || '') ||
    draft.description !== (node.description || '') ||
    draft.progress !== (node.progress ?? 0) ||
    draft.pos_x !== (node.pos_x || 0) ||
    draft.pos_y !== (node.pos_y || 0) ||
    JSON.stringify(draft.connections) !== JSON.stringify(node.connections || [])
  );

  const saveEdit = async () => {
    if (!draft || saving) return;
    if (!isDirty) { cancelEdit(); return; }
    if (!draft.title.trim()) { toast('Title cannot be empty', 'error'); return; }
    setSaving(true);
    try {
      await onUpdate(node.id, {
        title: draft.title.trim(),
        status: draft.status,
        developer: draft.developer.trim(),
        deadline: draft.deadline || null,
        description: draft.description,
        progress: draft.progress,
        pos_x: draft.pos_x,
        pos_y: draft.pos_y,
        connections: draft.connections,
      });
      toast('Saved', 'ok');
      cancelEdit();
    } catch (e) {
      toast(e.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Memoize connection list filtering
  const connFiltered = useMemo(() => {
    const others = allNodes.filter(n => n.id !== node.id);
    const q = connSearch.trim().toLowerCase();
    return q ? others.filter(o => (o.title || '').toLowerCase().includes(q)) : others;
  }, [allNodes, node.id, connSearch]);

  const connOthers = useMemo(() => allNodes.filter(n => n.id !== node.id), [allNodes, node.id]);

  return (
    <div className={`node-row-card ${status}`}>
      <div className="nrc-top">
        <div className="nrc-name">
          <div className="row1">
            <span className={`k-badge ${status}`}>
              <span className="dot"></span>{h.statusLabel(status)}
            </span>
            {editing && isDirty && (
              <span className="k-badge progress" style={{ marginLeft: 6 }}>
                <span className="dot"></span>Unsaved changes
              </span>
            )}
          </div>
          <div className="title">{node.title}</div>
          {node.description && <div className="desc">{node.description}</div>}
        </div>

        <div className="nrc-cell">
          <div className="lbl"><i data-lucide="user"></i> Developer</div>
          <div className="dev-row">
            <Avatar name={node.developer} />
            <span className="val">{node.developer || 'Unassigned'}</span>
          </div>
        </div>

        <div className="nrc-cell">
          <div className="lbl"><i data-lucide="calendar"></i> Deadline</div>
          <div className={`val ${dl.tone}`}>{dl.text}</div>
        </div>

        <div className="nrc-progress">
          <div className="row">
            <span className="l">Progress</span>
            <span className="v">{node.progress}%</span>
          </div>
          <div className="bar"><span style={{ width: `${node.progress}%` }} /></div>
        </div>

        <div className="nrc-actions">
          {!editing ? (
            <button className="btn btn-secondary btn-sm" onClick={startEdit}>
              <i data-lucide="pencil"></i> Edit
            </button>
          ) : (
            <>
              <button className="btn btn-secondary btn-sm" onClick={cancelEdit} disabled={saving}>
                <i data-lucide="x"></i> Cancel
              </button>
              <button className="btn btn-primary btn-sm" onClick={saveEdit} disabled={saving || !isDirty}>
                <i data-lucide="check"></i> {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>

      {editing && draft && (
        <div className="edit-panel">
          <div className="field">
            <label>Title</label>
            <input className="inp" value={draft.title} onChange={e => setField('title', e.target.value)} />
          </div>
          <div className="field">
            <label>Status</label>
            <select className="inp" value={draft.status} onChange={e => setStatusDraft(e.target.value)}>
              <option value="notstarted">Not started</option>
              <option value="progress">In progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div className="field">
            <label>Developer</label>
            <input className="inp" value={draft.developer} onChange={e => setField('developer', e.target.value)} />
          </div>
          <div className="field">
            <label>Deadline</label>
            <input className="inp" type="date" value={draft.deadline} onChange={e => setField('deadline', e.target.value)} />
          </div>

          <div className="field full">
            <label>Description</label>
            <textarea className="inp" value={draft.description} onChange={e => setField('description', e.target.value)} />
          </div>

          <div className="field full">
            <label>Progress · {draft.progress}%</label>
            <div className="slider-row">
              <input
                className="slider-inp" type="range" min="0" max="100" step="5"
                value={draft.progress}
                style={{ '--p': `${draft.progress}%` }}
                onChange={e => setField('progress', parseInt(e.target.value, 10))}
              />
              <span className="pct-tag">{draft.progress}%</span>
            </div>
          </div>

          <div className="field" style={{ gridColumn: '1 / 3' }}>
            <label>Position on graph</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="inp" type="number" value={draft.pos_x} onChange={e => setField('pos_x', parseInt(e.target.value, 10) || 0)} placeholder="X" />
              <input className="inp" type="number" value={draft.pos_y} onChange={e => setField('pos_y', parseInt(e.target.value, 10) || 0)} placeholder="Y" />
            </div>
          </div>

          <div className="field" style={{ gridColumn: '3 / -1' }}>
            <label>Connects to (downstream)</label>
            {connOthers.length > 6 && (
              <input
                className="inp"
                style={{ marginBottom: 6, fontSize: 12, padding: '6px 10px' }}
                placeholder="Search nodes…"
                value={connSearch}
                onChange={e => setConnSearch(e.target.value)}
              />
            )}
            <div className="conn-list">
              {connOthers.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--txt-3)', padding: 4 }}>Add more nodes to draw connections.</div>
              )}
              {connOthers.length > 0 && connFiltered.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--txt-3)', padding: 4 }}>No nodes match "{connSearch}".</div>
              )}
              {connFiltered.map(other => (
                <label key={other.id}>
                  <input
                    type="checkbox"
                    checked={draft.connections.includes(other.id)}
                    onChange={() => toggleConnection(other.id)}
                  /> {other.title}
                </label>
              ))}
            </div>
          </div>

          <div className="actions">
            <button className="btn btn-danger btn-sm" disabled={saving}
              onClick={() => { if (confirm('Delete this node?')) onDelete(node.id); }}>
              <i data-lucide="trash-2"></i> Delete node
            </button>
            <span className="meta-time">Last saved {new Date(node.updated_at).toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
};

const App = () => {
  const [authed, setAuthed] = useState(!!window.api.getPw());
  const [nodes, setNodes] = useState(null);
  const [filter, setFilter] = useState('all');
  const [toastMsg, setToastMsg] = useState(null);
  const [layingOut, setLayingOut] = useState(false);

  // Single createIcons call after every render
  useEffect(() => { window.lucide && window.lucide.createIcons(); });

  const flashToast = (msg, kind = 'ok') => {
    setToastMsg({ msg, kind });
    setTimeout(() => setToastMsg(null), 1800);
  };

  const load = async () => {
    try { setNodes(await window.api.listNodes()); }
    catch (e) { flashToast(e.message, 'error'); }
  };

  useEffect(() => { if (authed) load(); }, [authed]);

  if (!authed) return <Login onAuth={() => setAuthed(true)} />;

  const counts = useMemo(() => ({
    all: nodes ? nodes.length : 0,
    completed: nodes ? nodes.filter(n => n.status === 'completed').length : 0,
    progress: nodes ? nodes.filter(n => n.status === 'progress').length : 0,
    notstarted: nodes ? nodes.filter(n => n.status === 'notstarted').length : 0,
    overdue: nodes ? nodes.filter(n => h.effectiveStatus(n) === 'overdue').length : 0,
  }), [nodes]);

  const visible = useMemo(() => {
    if (!nodes) return [];
    if (filter === 'all') return nodes;
    if (filter === 'overdue') return nodes.filter(n => h.effectiveStatus(n) === 'overdue');
    return nodes.filter(n => n.status === filter);
  }, [nodes, filter]);

  const onUpdate = async (id, patch) => {
    // Optimistic update, revert on failure
    const prev = nodes;
    setNodes(ns => ns.map(n => n.id === id ? { ...n, ...patch } : n));
    try {
      const updated = await window.api.updateNode(id, patch);
      setNodes(ns => ns.map(n => n.id === id ? updated : n));
    } catch (e) {
      setNodes(prev);
      throw e;
    }
  };

  const onDelete = async (id) => {
    try {
      await window.api.deleteNode(id);
      setNodes(ns => ns.filter(n => n.id !== id));
      flashToast('Node deleted');
    } catch (e) { flashToast(e.message, 'error'); }
  };

  const onAdd = async (payload) => {
    try {
      const maxX = (nodes || []).reduce((m, n) => Math.max(m, n.pos_x || 0), 0);
      const created = await window.api.createNode({ ...payload, pos_x: maxX + 320, pos_y: 200 });
      setNodes(ns => [...(ns || []), created]);
      flashToast('Node added');
    } catch (e) { flashToast(e.message, 'error'); }
  };

  const onLogout = () => { window.api.clearPw(); setAuthed(false); };

  const onAutoLayout = async () => {
    if (!nodes || nodes.length === 0 || layingOut) return;
    if (!confirm(`Re-position all ${nodes.length} nodes based on their connections?`)) return;
    setLayingOut(true);
    const positions = computeAutoLayout(nodes);
    try {
      // Collect nodes that need repositioning
      const toUpdate = nodes.filter(n => {
        const p = positions[n.id];
        return p && (p.x !== n.pos_x || p.y !== n.pos_y);
      });
      if (toUpdate.length === 0) { flashToast('Layout already clean'); return; }

      // Parallel updates
      const results = await Promise.allSettled(
        toUpdate.map(n => window.api.updateNode(n.id, { pos_x: positions[n.id].x, pos_y: positions[n.id].y }))
      );

      const updated = results.filter(r => r.status === 'fulfilled').map(r => r.value);
      const failed = results.filter(r => r.status === 'rejected').length;

      if (updated.length) {
        setNodes(ns => ns.map(n => updated.find(u => u.id === n.id) || n));
      }
      if (failed > 0) flashToast(`${failed} node(s) failed to update`, 'error');
      else flashToast(`Auto-laid out ${updated.length} node${updated.length === 1 ? '' : 's'}`);
    } catch (e) {
      flashToast(e.message, 'error');
    } finally {
      setLayingOut(false);
    }
  };

  return (
    <>
      <Topbar onLogout={onLogout} />
      <main className="main">
        <div className="page-header">
          <div>
            <div className="page-eyebrow">Admin dashboard</div>
            <h1 className="page-title">Manage Kaizen nodes</h1>
            <p className="page-sub">Add, edit, and connect nodes. Changes appear on the public graph in seconds.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={onAutoLayout}
              disabled={!nodes || nodes.length === 0 || layingOut}
              title="Re-arrange every node into clean columns based on connections"
            >
              <i data-lucide="layout-grid"></i> {layingOut ? 'Laying out…' : 'Auto layout'}
            </button>
          </div>
        </div>

        <FilterBar filter={filter} setFilter={setFilter} counts={counts} />
        <AddNode onAdd={onAdd} />

        {nodes === null ? (
          <div className="loading"><div className="spinner"></div> Loading…</div>
        ) : visible.length === 0 ? (
          <div className="empty">
            <i data-lucide="search-x"></i>
            <div>No nodes match this filter.</div>
          </div>
        ) : (
          <div className="node-list">
            {visible.map(n => (
              <NodeRow
                key={n.id}
                node={n}
                allNodes={nodes}
                onUpdate={onUpdate}
                onDelete={onDelete}
                toast={flashToast}
              />
            ))}
          </div>
        )}
      </main>

      {toastMsg && (
        <div className={`toast ${toastMsg.kind === 'error' ? 'error' : ''}`}>
          <i data-lucide={toastMsg.kind === 'error' ? 'alert-triangle' : 'check-circle-2'}></i>
          {toastMsg.msg}
        </div>
      )}
    </>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
