// api.js — thin fetch wrapper around the Aegis-Sim JSON API.

async function j(url, opts) {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({ error: 'bad json' }));
  if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  catalog: () => j('/api/catalog'),
  templates: (kind) => j(`/api/templates/${kind}`),
  preset: (kind, id) => j(`/api/preset/${kind}/${id}`),
  atmosphere: () => j('/api/atmosphere'),
  simulate: (scenario) => j('/api/simulate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario }),
  }),
  optimize: (payload) => j('/api/optimize', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }),
  tactical: (payload) => j('/api/tactical', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }),
  save: (kind, name, data) => j('/api/save', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, name, data }),
  }),
  saveRun: (name, scenario, result) => j('/api/save_run', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, scenario, result }),
  }),
  runs: () => j('/api/runs'),
  loadRun: (id) => j('/api/run/' + encodeURIComponent(id)),
};

export function toast(msg, ms = 2600) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), ms);
}
