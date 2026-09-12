// Small fetch wrapper shared by all frontend modules.
const Api = {
  async get(url) {
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
    return data;
  },
  async post(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
    return data;
  },
  async postFile(url, file) {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(url, { method: 'POST', body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
    return data;
  },
};

// Shared state, persisted across tab switches via localStorage.
const Store = {
  get league() {
    const raw = localStorage.getItem('ffhub.league');
    return raw ? JSON.parse(raw) : null;
  },
  set league(val) {
    localStorage.setItem('ffhub.league', JSON.stringify(val));
  },
  get rosterId() {
    return localStorage.getItem('ffhub.rosterId') || null;
  },
  set rosterId(val) {
    localStorage.setItem('ffhub.rosterId', val);
  },
};
