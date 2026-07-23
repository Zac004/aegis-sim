// runexpand.js — expanded 6-DOF analysis: large charts for one run, with the
// ability to OVERLAY multiple saved runs on the same axes for A/B comparison
// (e.g. crank vs notch, AMRAAM-C vs Meteor at the same geometry).

import { api } from './api.js';

const RUN_COLORS = ['#ffb000', '#00e5ff', '#22ff9c', '#ff3d00', '#c58cff', '#ff8a3a'];
const CHANNELS = [
  { key: 'mmach', label: 'Missile Mach', unit: 'M' },
  { key: 'gload', label: 'Missile G (achieved)', unit: 'g' },
  { key: 'accel_g', label: 'Missile G (commanded)', unit: 'g' },
  { key: 'thrust', label: 'Thrust', unit: 'kN', scale: 0.001 },
  { key: 'mass', label: 'Missile mass', unit: 'kg' },
  { key: 'malt', label: 'Missile altitude', unit: 'm' },
  { key: 'range', label: 'Range to target', unit: 'km', scale: 0.001 },
  { key: 'closing', label: 'Closing velocity', unit: 'm/s' },
  { key: 'tgload', label: 'Target G-load', unit: 'g' },
  { key: 'mspeed', label: 'Missile speed', unit: 'm/s' },
  { key: 'boresight_deg', label: 'Seeker boresight error', unit: '°' },
  { key: 'aspect_deg', label: 'Target aspect', unit: '°' },
  { key: 'shooter_range', label: 'Shooter→target range', unit: 'km', scale: 0.001 },
];

let state = { runs: [], channels: ['mmach', 'gload', 'malt', 'range'] };

export function openExpand(runs) {
  state.runs = runs.map((r, i) => ({ ...r, color: RUN_COLORS[i % RUN_COLORS.length] }));
  render();
  document.getElementById('expand-modal').classList.remove('hidden');
}

async function render() {
  const body = document.getElementById('expand-body');
  document.getElementById('expand-title').textContent =
    state.runs.length > 1 ? `◱ RUN COMPARISON (${state.runs.length} runs)` : '◱ 6-DOF RUN ANALYSIS';
  // toolbar
  let runsList = [];
  try { runsList = (await api.runs()).runs; } catch (e) { /* ignore */ }
  const legend = state.runs.map(r => `<span class="ex-legend"><i style="background:${r.color}"></i>${r.name}</span>`).join('');
  const chanChips = CHANNELS.map(c =>
    `<button class="ex-chip${state.channels.includes(c.key) ? ' on' : ''}" data-ch="${c.key}">${c.label}</button>`).join('');
  const overlayOpts = runsList.map(r => `<option value="${r.id}">${r.name} (${r.outcome})</option>`).join('');
  body.innerHTML = `
    <div class="ex-top">
      <div class="ex-legends">${legend}</div>
      <div class="ex-overlay">
        <label>Overlay a saved run:</label>
        <select id="ex-add"><option value="">— select —</option>${overlayOpts}</select>
        ${state.runs.length > 1 ? '<button id="ex-clear" class="ghost">CLEAR</button>' : ''}
      </div>
    </div>
    <div class="ex-chips">Channels: ${chanChips}</div>
    <div id="ex-charts"></div>
    <p class="hint" style="margin-top:8px">Tip: overlay two runs of the <b>same geometry</b> with different tactics
    (crank vs notch) or different missiles to compare energy, G and altitude side by side. All charts share the mission-time axis.</p>`;

  body.querySelectorAll('.ex-chip').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.ch;
    if (state.channels.includes(k)) state.channels = state.channels.filter(x => x !== k);
    else state.channels.push(k);
    render();
  }));
  const add = document.getElementById('ex-add');
  add && add.addEventListener('change', async (e) => {
    if (!e.target.value) return;
    try { const rec = await api.loadRun(e.target.value); if (rec.result) { state.runs.push({ name: rec.name, result: rec.result, color: RUN_COLORS[state.runs.length % RUN_COLORS.length] }); render(); } }
    catch (err) { /* ignore */ }
  });
  const clr = document.getElementById('ex-clear');
  clr && clr.addEventListener('click', () => { state.runs = state.runs.slice(0, 1); render(); });

  drawCharts();
}

function drawCharts() {
  const wrap = document.getElementById('ex-charts');
  wrap.innerHTML = '';
  const tMax = Math.max(...state.runs.map(r => r.result.channels.t[r.result.channels.t.length - 1] || 1));
  state.channels.forEach(key => {
    const spec = CHANNELS.find(c => c.key === key);
    const box = document.createElement('div'); box.className = 'ex-chart';
    box.innerHTML = `<div class="ex-ctitle">${spec.label} <span>(${spec.unit})</span></div>`;
    const cv = document.createElement('canvas'); cv.className = 'ex-canvas';
    box.appendChild(cv); wrap.appendChild(box);
    requestAnimationFrame(() => plot(cv, spec, tMax));
  });
}

function plot(cv, spec, tMax) {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const W = cv.clientWidth, H = cv.clientHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const padL = 44, padR = 12, padT = 8, padB = 20;
  g.clearRect(0, 0, W, H);
  // y-range across all runs
  const sc = spec.scale || 1;
  let lo = Infinity, hi = -Infinity;
  state.runs.forEach(r => (r.result.channels[spec.key] || []).forEach(v => { const x = v * sc; lo = Math.min(lo, x); hi = Math.max(hi, x); }));
  if (!isFinite(lo)) { lo = 0; hi = 1; }
  if (lo === hi) hi = lo + 1;
  lo = Math.min(lo, 0);
  const X = (t) => padL + (t / tMax) * (W - padL - padR);
  const Y = (v) => H - padB - ((v - lo) / (hi - lo)) * (H - padT - padB);
  // grid + axes
  g.strokeStyle = 'rgba(38,55,90,0.5)'; g.lineWidth = 1; g.font = '9px "Share Tech Mono", monospace'; g.fillStyle = '#6d84a6';
  for (let k = 0; k <= 4; k++) {
    const v = lo + (hi - lo) * k / 4, yy = Y(v);
    g.beginPath(); g.moveTo(padL, yy); g.lineTo(W - padR, yy); g.stroke();
    g.fillText(v.toFixed(hi - lo < 5 ? 1 : 0), 4, yy + 3);
  }
  for (let s = 0; s <= 4; s++) { const t = tMax * s / 4; g.fillText(t.toFixed(0) + 's', X(t) - 8, H - 6); }
  // series
  state.runs.forEach(r => {
    const ch = r.result.channels, data = ch[spec.key];
    if (!data) return;
    g.strokeStyle = r.color; g.lineWidth = 1.8; g.shadowColor = r.color; g.shadowBlur = 4;
    g.beginPath();
    for (let k = 0; k < data.length; k++) { const px = X(ch.t[k]), py = Y(data[k] * sc); k ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.stroke(); g.shadowBlur = 0;
  });
}
