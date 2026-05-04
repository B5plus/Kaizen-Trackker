// Trackker — shared API helpers (loaded as a plain script, exposes window.api)

(function () {
  const API_BASE = ''; // same origin
  const PW_KEY = 'trackker.adminPw';

  const getPw = () => sessionStorage.getItem(PW_KEY) || '';
  const setPw = (pw) => sessionStorage.setItem(PW_KEY, pw);
  const clearPw = () => sessionStorage.removeItem(PW_KEY);

  async function listNodes() {
    const r = await fetch(`${API_BASE}/api/nodes`);
    if (!r.ok) throw new Error('Failed to load nodes');
    return r.json();
  }

  async function checkPassword(pw) {
    const r = await fetch(`${API_BASE}/api/auth/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    });
    return r.ok;
  }

  async function createNode(body) {
    const r = await fetch(`${API_BASE}/api/nodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': getPw() },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error((await r.json()).error || 'Create failed');
    return r.json();
  }

  async function updateNode(id, patch) {
    const r = await fetch(`${API_BASE}/api/nodes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': getPw() },
      body: JSON.stringify(patch),
    });
    if (!r.ok) throw new Error((await r.json()).error || 'Update failed');
    return r.json();
  }

  async function deleteNode(id) {
    const r = await fetch(`${API_BASE}/api/nodes/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-password': getPw() },
    });
    if (!r.ok) throw new Error('Delete failed');
    return r.json();
  }

  window.api = { listNodes, checkPassword, createNode, updateNode, deleteNode, getPw, setPw, clearPw };

  // Shared helpers
  window.helpers = {
    TODAY: new Date(),
    fmtDate(iso) {
      if (!iso) return '—';
      const d = new Date(iso + 'T00:00:00');
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    },
    daysUntil(iso) {
      if (!iso) return Infinity;
      const d = new Date(iso + 'T00:00:00');
      return Math.round((d - new Date(new Date().toDateString())) / 86400000);
    },
    deadlineDisplay(node) {
      if (!node.deadline) return { text: '—', tone: 'muted' };
      const days = this.daysUntil(node.deadline);
      if (node.status === 'completed') return { text: this.fmtDate(node.deadline), tone: 'ok' };
      if (days < 0) return { text: `${Math.abs(days)}d overdue`, tone: 'danger' };
      if (days === 0) return { text: 'Due today', tone: 'warn' };
      if (days <= 7) return { text: `In ${days} days`, tone: 'warn' };
      return { text: this.fmtDate(node.deadline), tone: 'muted' };
    },
    effectiveStatus(node) {
      if (node.status !== 'completed' && node.deadline && this.daysUntil(node.deadline) < 0) return 'overdue';
      return node.status;
    },
    statusLabel(s) {
      return ({ completed: 'Completed', progress: 'In progress', notstarted: 'Not started', overdue: 'Overdue' })[s] || s;
    },
    initials(name) {
      return (name || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
    },
    avatarBg(name) {
      const hues = [
        'linear-gradient(135deg, #58a8ff, #2575bd)',
        'linear-gradient(135deg, #34d399, #047857)',
        'linear-gradient(135deg, #c084fc, #7c3aed)',
        'linear-gradient(135deg, #fbbf24, #d97706)',
        'linear-gradient(135deg, #f87171, #b91c1c)',
        'linear-gradient(135deg, #6b7a99, #353d4b)',
      ];
      return hues[(name || 'U').charCodeAt(0) % hues.length];
    },
  };
})();
