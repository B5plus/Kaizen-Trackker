// tracker.jsx — Project tracker with Admin / Client views
// Single-file React app. State persists to localStorage so the same page
// works as a "share link" (?view=client) for read-only viewers.

const STORAGE_KEY = 'trackker.projects.v1';

const DEFAULT_PROJECTS = [
  {
    id: 'PRJ-001',
    name: 'E-commerce checkout redesign',
    desc: 'Streamline checkout to 2 steps, add Apple/Google Pay.',
    status: 'progress',
    developer: 'Sarah Chen',
    activity: 'Building payment integration',
    deadline: '2026-05-22',
    progress: 68,
    updatedAt: '2026-05-03T14:20:00',
  },
  {
    id: 'PRJ-002',
    name: 'Customer portal v2',
    desc: 'New dashboard for client-facing analytics and downloads.',
    status: 'progress',
    developer: 'James Patel',
    activity: 'API integration in progress',
    deadline: '2026-06-10',
    progress: 42,
    updatedAt: '2026-05-03T09:10:00',
  },
  {
    id: 'PRJ-003',
    name: 'Mobile app — iOS release',
    desc: 'Public launch on App Store. Final QA and store assets.',
    status: 'completed',
    developer: 'Mei Tanaka',
    activity: 'Launched · monitoring',
    deadline: '2026-04-28',
    progress: 100,
    updatedAt: '2026-04-28T17:00:00',
  },
  {
    id: 'PRJ-004',
    name: 'Admin reporting module',
    desc: 'Exportable reports with scheduling.',
    status: 'notstarted',
    developer: 'Diego Rojas',
    activity: 'Awaiting kickoff',
    deadline: '2026-07-15',
    progress: 0,
    updatedAt: '2026-04-30T10:00:00',
  },
];

const STATUS_META = {
  completed:  { label: 'Completed',   icon: 'check-circle-2' },
  progress:   { label: 'In progress', icon: 'loader' },
  notstarted: { label: 'Not started', icon: 'circle-dashed' },
};

const DEVELOPERS = ['Sarah Chen', 'James Patel', 'Mei Tanaka', 'Diego Rojas', 'Ravi Mehta', 'Lin Park', 'Unassigned'];

/* ============================================================ Helpers */
const TODAY = new Date('2026-05-04T00:00:00');
function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtRelative(isoDateTime) {
  const d = new Date(isoDateTime);
  const mins = Math.round((TODAY - d) / 60000);
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins/60)}h ago`;
  return `${Math.round(mins/1440)}d ago`;
}
function daysUntil(iso) {
  const d = new Date(iso + 'T00:00:00');
  return Math.round((d - TODAY) / 86400000);
}
function deadlineDisplay(p) {
  const days = daysUntil(p.deadline);
  if (p.status === 'completed') return { text: fmtDate(p.deadline), tone: 'ok' };
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, tone: 'danger' };
  if (days === 0) return { text: 'Due today', tone: 'warn' };
  if (days <= 7) return { text: `In ${days} days`, tone: 'warn' };
  return { text: fmtDate(p.deadline), tone: 'muted' };
}
function effectiveStatus(p) {
  // overdue overlay for display purposes only
  if (p.status !== 'completed' && daysUntil(p.deadline) < 0) return 'overdue';
  return p.status;
}
const initials = (name) =>
  (name || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');

function avatarBg(name) {
  const hues = [
    'linear-gradient(135deg, #58a8ff, #2575bd)',
    'linear-gradient(135deg, #34d399, #047857)',
    'linear-gradient(135deg, #c084fc, #7c3aed)',
    'linear-gradient(135deg, #fbbf24, #d97706)',
    'linear-gradient(135deg, #f87171, #b91c1c)',
    'linear-gradient(135deg, #6b7a99, #353d4b)',
  ];
  return hues[(name || 'U').charCodeAt(0) % hues.length];
}
const Avatar = ({ name, size = 'md' }) => (
  <div className={`avatar ${size}`} style={{ background: avatarBg(name) }} title={name}>
    {initials(name)}
  </div>
);

/* ============================================================ Storage */
function loadProjects() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROJECTS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_PROJECTS;
    return parsed;
  } catch (e) { return DEFAULT_PROJECTS; }
}
function saveProjects(list) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch (e) {}
}

/* ============================================================ Topbar */
const Topbar = ({ view, setView, onShare }) => {
  React.useEffect(() => { window.lucide && window.lucide.createIcons(); }, [view]);
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
      {view === 'client' && (
        <div className="view-pill client"><i data-lucide="eye"></i> Client view · read only</div>
      )}
      {view === 'admin' && (
        <div className="view-pill"><i data-lucide="shield-check"></i> Admin · editing enabled</div>
      )}
      <div className="view-switch">
        <button className={view === 'admin' ? 'active' : ''} onClick={() => setView('admin')}>
          <i data-lucide="settings"></i> Admin
        </button>
        <button className={view === 'client' ? 'active' : ''} onClick={() => setView('client')}>
          <i data-lucide="eye"></i> Client
        </button>
      </div>
      <button className="btn btn-primary btn-sm" onClick={onShare}>
        <i data-lucide="share-2"></i> Share link
      </button>
    </header>
  );
};

/* ============================================================ KPI strip */
const KPIs = ({ projects }) => {
  React.useEffect(() => { window.lucide && window.lucide.createIcons(); }, [projects]);
  const completed = projects.filter(p => p.status === 'completed').length;
  const inProgress = projects.filter(p => p.status === 'progress').length;
  const notStarted = projects.filter(p => p.status === 'notstarted').length;
  const overdue = projects.filter(p => p.status !== 'completed' && daysUntil(p.deadline) < 0).length;

  const overall = projects.length === 0 ? 0
    : Math.round(projects.reduce((s, p) => s + p.progress, 0) / projects.length);

  return (
    <div className="kpi-grid">
      <div className="kpi">
        <div className="k-label"><i data-lucide="trending-up"></i> Overall progress</div>
        <div className="k-num">{overall}%</div>
        <div className="k-sub"><strong>{projects.length}</strong> projects total</div>
        <div className="micro-bar"><span style={{ width: `${overall}%`, background: 'linear-gradient(90deg, rgba(88,168,255,0.4), var(--accent))', boxShadow: '0 0 10px var(--accent-glow)' }} /></div>
      </div>
      <div className="kpi completed-kpi">
        <div className="k-label"><i data-lucide="check-circle-2"></i> Completed</div>
        <div className="k-num">{completed}</div>
        <div className="k-sub">delivered</div>
        <div className="micro-bar"><span style={{ width: `${projects.length ? (completed/projects.length)*100 : 0}%`, background: 'linear-gradient(90deg, rgba(52,211,153,0.4), var(--ok))', boxShadow: '0 0 10px var(--ok-glow)' }} /></div>
      </div>
      <div className="kpi progress-kpi">
        <div className="k-label"><i data-lucide="loader"></i> In progress</div>
        <div className="k-num">{inProgress}</div>
        <div className="k-sub">{notStarted} not started</div>
        <div className="micro-bar"><span style={{ width: `${projects.length ? (inProgress/projects.length)*100 : 0}%`, background: 'linear-gradient(90deg, rgba(251,191,36,0.4), var(--warn))', boxShadow: '0 0 10px var(--warn-glow)' }} /></div>
      </div>
      <div className="kpi">
        <div className="k-label" style={{ color: overdue > 0 ? 'var(--danger)' : undefined }}>
          <i data-lucide="alert-triangle"></i> Overdue
        </div>
        <div className="k-num" style={{ color: overdue > 0 ? 'var(--danger)' : '#fff' }}>{overdue}</div>
        <div className="k-sub">{overdue === 0 ? 'all on track' : 'need attention'}</div>
        <div className="micro-bar"><span style={{ width: `${projects.length ? (overdue/projects.length)*100 : 0}%`, background: overdue > 0 ? 'linear-gradient(90deg, rgba(248,113,113,0.4), var(--danger))' : 'rgba(255,255,255,0.08)' }} /></div>
      </div>
    </div>
  );
};

/* ============================================================ Filter bar */
const FilterBar = ({ filter, setFilter, counts }) => {
  React.useEffect(() => { window.lucide && window.lucide.createIcons(); });
  const chips = [
    { id: 'all',        label: 'All' },
    { id: 'progress',   label: 'In progress' },
    { id: 'completed',  label: 'Completed' },
    { id: 'notstarted', label: 'Not started' },
  ];
  return (
    <div className="filter-bar">
      <div className="filter-group">
        {chips.map(c => (
          <button
            key={c.id}
            className={`filter-chip ${filter === c.id ? 'active' : ''}`}
            onClick={() => setFilter(c.id)}
          >
            {c.label}<span className="count">{counts[c.id]}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

/* ============================================================ Add new project (admin only) */
const AddProject = ({ onAdd }) => {
  React.useEffect(() => { window.lucide && window.lucide.createIcons(); });
  const [name, setName] = React.useState('');
  const [developer, setDeveloper] = React.useState(DEVELOPERS[0]);
  const [deadline, setDeadline] = React.useState('2026-06-30');

  const submit = () => {
    if (!name.trim()) return;
    onAdd({
      id: 'PRJ-' + String(Math.floor(Math.random()*900) + 100),
      name: name.trim(),
      desc: '',
      status: 'notstarted',
      developer,
      activity: 'Awaiting kickoff',
      deadline,
      progress: 0,
      updatedAt: new Date().toISOString(),
    });
    setName('');
  };

  return (
    <div className="add-row">
      <div className="field">
        <label>New project name</label>
        <input
          className="inp"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Customer portal v3"
          onKeyDown={e => e.key === 'Enter' && submit()}
        />
      </div>
      <div className="field">
        <label>Developer</label>
        <select className="inp" value={developer} onChange={e => setDeveloper(e.target.value)}>
          {DEVELOPERS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Deadline</label>
        <input className="inp" type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
      </div>
      <div className="field" style={{ alignSelf: 'end' }}>
        <button className="btn btn-primary" onClick={submit}>
          <i data-lucide="plus"></i> Add project
        </button>
      </div>
    </div>
  );
};

/* ============================================================ Project card */
const ProjectCard = ({ project, view, onUpdate, onDelete }) => {
  const [editing, setEditing] = React.useState(false);

  React.useEffect(() => { window.lucide && window.lucide.createIcons(); }, [project, editing, view]);

  const status = effectiveStatus(project);
  const dl = deadlineDisplay(project);

  const update = (patch) => {
    onUpdate({ ...project, ...patch, updatedAt: new Date().toISOString() });
  };

  // When status flipped to completed, force progress=100 (and 0 for notstarted)
  const setStatus = (newStatus) => {
    const patch = { status: newStatus };
    if (newStatus === 'completed') patch.progress = 100;
    if (newStatus === 'notstarted') patch.progress = 0;
    update(patch);
  };

  return (
    <div className={`project-card ${status}`}>
      <div className="pc-top">
        <div className="pc-name">
          <div className="row1">
            <span className="id">{project.id}</span>
            <span className={`k-badge ${status}`}>
              <span className="dot"></span>{status === 'overdue' ? 'Overdue' : STATUS_META[project.status].label}
            </span>
          </div>
          <div className="title">{project.name}</div>
          {project.desc && <div className="desc">{project.desc}</div>}
        </div>

        <div className="pc-cell">
          <div className="lbl"><i data-lucide="user"></i> Developer</div>
          <div className="dev-row">
            <Avatar name={project.developer} size="sm" />
            <div className="val" style={{ minWidth: 0 }}>{project.developer}</div>
          </div>
        </div>

        <div className="pc-cell">
          <div className="lbl"><i data-lucide="zap"></i> Currently</div>
          <div className="val muted">{project.activity || '—'}</div>
        </div>

        <div className="pc-cell">
          <div className="lbl"><i data-lucide="calendar"></i> Deadline</div>
          <div className={`val ${dl.tone}`}>{dl.text}</div>
        </div>

        <div className="pc-progress">
          <div className="row">
            <span className="l">Progress</span>
            <span className="v">{project.progress}%</span>
          </div>
          <div className="bar"><span style={{ width: `${project.progress}%` }} /></div>
        </div>

        {view === 'admin' && (
          <div className="pc-actions">
            {!editing && (
              <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
                <i data-lucide="pencil"></i> Edit
              </button>
            )}
            {editing && (
              <button className="btn btn-primary btn-sm" onClick={() => setEditing(false)}>
                <i data-lucide="check"></i> Done
              </button>
            )}
          </div>
        )}
      </div>

      {view === 'admin' && editing && (
        <div className="pc-edit">
          <div className="field">
            <label>Status</label>
            <select className="inp" value={project.status} onChange={e => setStatus(e.target.value)}>
              <option value="notstarted">Not started</option>
              <option value="progress">In progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div className="field">
            <label>Developer</label>
            <select className="inp" value={project.developer} onChange={e => update({ developer: e.target.value })}>
              {DEVELOPERS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Deadline</label>
            <input className="inp" type="date" value={project.deadline} onChange={e => update({ deadline: e.target.value })} />
          </div>
          <div className="field">
            <label>Progress</label>
            <div className="slider-row">
              <input
                className="slider-inp"
                type="range" min="0" max="100" step="5"
                value={project.progress}
                style={{ '--p': `${project.progress}%` }}
                onChange={e => update({ progress: parseInt(e.target.value, 10) })}
              />
              <span className="pct-tag">{project.progress}%</span>
            </div>
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label>Currently working on</label>
            <input
              className="inp"
              value={project.activity || ''}
              onChange={e => update({ activity: e.target.value })}
              placeholder="e.g. Building payment integration"
            />
          </div>
          <div className="edit-actions" style={{ gridColumn: '1 / -1', justifyContent: 'space-between' }}>
            <button className="btn btn-danger btn-sm" onClick={() => { if (confirm('Delete this project?')) onDelete(project.id); }}>
              <i data-lucide="trash-2"></i> Delete
            </button>
            <span style={{ fontSize: 11, color: 'var(--txt-4)', fontFamily: 'var(--font-mono)' }}>
              Updated {fmtRelative(project.updatedAt)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

/* ============================================================ Share modal */
const ShareModal = ({ onClose, onCopy }) => {
  React.useEffect(() => { window.lucide && window.lucide.createIcons(); });
  const url = `${window.location.origin}${window.location.pathname}?view=client`;
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>Share with your client</h3>
        <p>Anyone with this link sees a read-only view of project status, deadlines, and progress. They can't edit anything.</p>
        <div className="share-link">
          <i data-lucide="link" style={{ width: 14, height: 14, color: 'var(--txt-3)' }}></i>
          <code>{url}</code>
          <button className="btn btn-primary btn-sm" onClick={() => onCopy(url)}>
            <i data-lucide="copy"></i> Copy
          </button>
        </div>
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

/* ============================================================ App */
const App = () => {
  // Determine initial view from URL (?view=client)
  const initialView = (() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('view') === 'client' ? 'client' : 'admin';
  })();

  const [view, setView] = React.useState(initialView);
  const [projects, setProjects] = React.useState(() => loadProjects());
  const [filter, setFilter] = React.useState('all');
  const [showShare, setShowShare] = React.useState(false);
  const [toast, setToast] = React.useState(null);

  // Persist on every change
  React.useEffect(() => { saveProjects(projects); }, [projects]);

  // Sync between tabs / between admin + client view if open in two windows
  React.useEffect(() => {
    const handler = (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try { setProjects(JSON.parse(e.newValue)); } catch (err) {}
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  // Keep the URL in sync with view
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (view === 'client') params.set('view', 'client');
    else params.delete('view');
    const next = params.toString();
    const url = window.location.pathname + (next ? `?${next}` : '');
    window.history.replaceState({}, '', url);
  }, [view]);

  React.useEffect(() => { window.lucide && window.lucide.createIcons(); }, [view, filter, projects]);

  const counts = {
    all: projects.length,
    completed: projects.filter(p => p.status === 'completed').length,
    progress: projects.filter(p => p.status === 'progress').length,
    notstarted: projects.filter(p => p.status === 'notstarted').length,
  };

  const visible = filter === 'all' ? projects : projects.filter(p => p.status === filter);

  const updateProject = (next) => {
    setProjects(prev => prev.map(p => p.id === next.id ? next : p));
  };
  const deleteProject = (id) => {
    setProjects(prev => prev.filter(p => p.id !== id));
  };
  const addProject = (p) => {
    setProjects(prev => [p, ...prev]);
    flashToast('Project added');
  };
  const flashToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };
  const copyLink = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      flashToast('Share link copied');
    } catch (e) {
      flashToast('Couldn\u2019t copy — select the link manually');
    }
  };
  const resetDemo = () => {
    if (confirm('Reset to demo data?')) setProjects(DEFAULT_PROJECTS);
  };

  return (
    <>
      <Topbar view={view} setView={setView} onShare={() => setShowShare(true)} />
      <main className="main" data-screen-label={view === 'admin' ? 'Admin · Tracker' : 'Client · Tracker'}>
        <div className="page-header">
          <div>
            <div className="page-eyebrow">{view === 'admin' ? 'Admin dashboard' : 'Client view'}</div>
            <h1 className="page-title">
              {view === 'admin' ? 'Manage project status' : 'Project status'}
            </h1>
            <p className="page-sub">
              {view === 'admin'
                ? 'Update status, assign developers, and adjust progress. Changes save automatically and appear instantly in the shared client view.'
                : 'Live status of all projects. Updates the moment your team makes progress.'}
            </p>
          </div>
          {view === 'admin' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={resetDemo}>
                <i data-lucide="rotate-ccw"></i> Reset demo
              </button>
            </div>
          )}
        </div>

        <KPIs projects={projects} />

        <FilterBar filter={filter} setFilter={setFilter} counts={counts} />

        {view === 'admin' && <AddProject onAdd={addProject} />}

        {visible.length === 0 ? (
          <div className="card empty">
            <i data-lucide="search-x"></i>
            <div>No projects match this filter.</div>
          </div>
        ) : (
          <div className="project-list">
            {visible.map(p => (
              <ProjectCard
                key={p.id}
                project={p}
                view={view}
                onUpdate={updateProject}
                onDelete={deleteProject}
              />
            ))}
          </div>
        )}
      </main>

      {showShare && <ShareModal onClose={() => setShowShare(false)} onCopy={copyLink} />}
      {toast && (
        <div className="toast">
          <i data-lucide="check-circle-2"></i> {toast}
        </div>
      )}
    </>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
