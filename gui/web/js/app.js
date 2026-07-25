// app.js — orchestrates the whole application.

import { api, toast } from './api.js';
import { Config } from './config.js';
import { Telemetry } from './telemetry.js';
import { Tac2D } from './tac2d.js';
import { Forge } from './forge.js';
import { openHelp } from './help.js';
import { openExpand } from './runexpand.js';

const $ = (s) => document.querySelector(s);

const app = {
  config: null, telemetry: null, tac2d: null,
  result: null, playing: false, index: 0, lastFrame: 0, speed: 1, sampleRate: 60,
};
window.aegis = app;   // console/debug access

async function boot() {
  app.tac2d = new Tac2D($('#tac2d'));
  app.telemetry = new Telemetry();
  app.config = new Config($('#config-root'));
  app.tac2d.setActive(true);

  try {
    const [catalog, missiles, platforms, scenarios] = await Promise.all([
      api.catalog(), api.templates('missiles'), api.templates('platforms'), api.templates('scenarios'),
    ]);
    app.config.init(catalog, {
      missiles: missiles.templates, platforms: platforms.templates, scenarios: scenarios.templates,
    });
    app.catalog = catalog;

    // ── Forge (create/edit airframes & platforms) ──
    app.forge = new Forge(catalog);
    app.config.onForge = (kind, def, slot) => app.forge.open(kind, def, slot);
    app.forge.onSaved = async (kind, data, slot) => {
      try {
        await api.save(kind, data.name, data);
        const fresh = await api.templates(kind);
        if (kind === 'missiles') app.config.missiles = fresh.templates;
        else app.config.platforms = fresh.templates;
        // assign the new template to the slot it was created for
        const w = app.config.working;
        if (slot === 'missile') w.missile.definition = data;
        else if (slot === 'shooter') w.shooter.platform = data.id;
        else w.target.definition = data;
        app.config.render();
        if (app.config.onReady) app.config.onReady(w);
        toast(`Saved “${data.name}” to library — now active as the ${slot}`);
      } catch (e) { toast('Save failed: ' + e.message, 4500); }
    };
  } catch (e) {
    toast('Failed to load templates: ' + e.message, 5000);
    console.error(e);
  }

  // save-scenario wiring (SAVE button lives in the configurator)
  app.config.onSave = async (working) => {
    const name = (working.name || 'untitled').trim();
    try {
      await api.save('scenarios', name, working);
      const fresh = await api.templates('scenarios');
      app.config.scenarios = fresh.templates;
      app.config.render();
      toast(`Scenario "${name}" saved as a preset`);
    } catch (e) { toast('Save failed: ' + e.message, 4500); }
  };

  wireControls();
  wireTooltips();
  requestAnimationFrame(loop);
}

// professional hover tooltips: any element with [data-tip] shows a styled card
function wireTooltips() {
  const tt = document.getElementById('tt');
  document.addEventListener('mouseover', (e) => {
    const t = e.target.closest('[data-tip]');
    if (!t) { tt.classList.remove('show'); return; }
    tt.textContent = t.dataset.tip;
    tt.classList.add('show');
  });
  document.addEventListener('mousemove', (e) => {
    if (!tt.classList.contains('show')) return;
    const x = Math.min(e.clientX + 14, innerWidth - tt.offsetWidth - 10);
    const y = Math.min(e.clientY + 18, innerHeight - tt.offsetHeight - 10);
    tt.style.left = x + 'px'; tt.style.top = y + 'px';
  });
  document.addEventListener('mouseout', (e) => {
    if (!e.relatedTarget || !e.relatedTarget.closest('[data-tip]')) tt.classList.remove('show');
  });
}

function wireControls() {
  $('#btn-simulate').addEventListener('click', engage);
  $('#btn-play').addEventListener('click', togglePlay);
  $('#btn-restart').addEventListener('click', () => { app.index = 0; setScrub(0); pause(); seek(0); });
  $('#scrub').addEventListener('input', (e) => { pause(); app.index = +e.target.value; seek(app.index); });
  $('#speed').addEventListener('change', (e) => app.speed = +e.target.value);
  // (map zoom is mouse-wheel on the map — the old slider is gone)
  // viewer options: range rings, gridlines, bullseye
  document.querySelectorAll('.viewopt').forEach(b => b.addEventListener('click', (e) => {
    const k = e.currentTarget.dataset.opt;
    if (!k) return;
    e.currentTarget.classList.toggle('on');
    const on = e.currentTarget.classList.contains('on');
    app.tac2d.setOption(k, on);
    if (k === 'bullseye') $('#bullseye-cfg').classList.toggle('hidden', !on);
  }));
  // bullseye: custom rings + bearing spokes
  const bullCfg = () => app.tac2d.setBullseye({
    rings: +$('#bc-rings').value, spacing_km: +$('#bc-spacing').value, bearing_step: +$('#bc-bearing').value });
  ['#bc-rings', '#bc-spacing', '#bc-bearing'].forEach(s => $(s).addEventListener('input', bullCfg));
  // hideable side panels
  document.querySelectorAll('.panel-x, .reveal').forEach(b =>
    b.addEventListener('click', (e) => togglePanel(e.currentTarget.dataset.panel)));
  $('#btn-save-run').addEventListener('click', saveRun);
  $('#btn-runs').addEventListener('click', openRuns);
  $('#runs-close').addEventListener('click', () => $('#runs-modal').classList.add('hidden'));
  $('#btn-optimize').addEventListener('click', openOptimizer);
  $('#opt-close').addEventListener('click', () => $('#optimizer-modal').classList.add('hidden'));
  $('#btn-atmos').addEventListener('click', openAtmos);
  $('#atmos-close').addEventListener('click', () => $('#atmos-modal').classList.add('hidden'));
  $('#btn-help').addEventListener('click', () => openHelp());
  $('#help-close').addEventListener('click', () => { $('#help-modal').classList.add('hidden'); $('#help-modal').classList.remove('expanded'); });
  // Fullscreen toggle — fill the browser window for easier reading
  $('#help-expand')?.addEventListener('click', () => {
    const m = $('#help-modal'), on = m.classList.toggle('expanded');
    const b = $('#help-expand'); if (b) b.textContent = on ? '⤡ RESTORE' : '⛶ FULLSCREEN';
  });
  // Open the guide full-page in its own browser tab
  $('#help-newtab')?.addEventListener('click', () => window.open('learn.html', '_blank', 'noopener'));
  // Esc leaves fullscreen first, then closes
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const m = $('#help-modal'); if (m.classList.contains('hidden')) return;
    if (m.classList.contains('expanded')) { m.classList.remove('expanded'); const b = $('#help-expand'); if (b) b.textContent = '⛶ FULLSCREEN'; }
    else m.classList.add('hidden');
  });
  $('#expand-close').addEventListener('click', () => $('#expand-modal').classList.add('hidden'));
  // expand the current run into the big analysis / compare view
  const doExpand = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (app.result) openExpand([{ name: app.result.scenario_name || 'Current run', result: app.result }]);
    else toast('Run an engagement first (press ENGAGE)');
  };
  $('#btn-expand')?.addEventListener('click', doExpand);
  // double-click anywhere on the telemetry charts or the map also expands
  $('#charts')?.addEventListener('dblclick', doExpand);
  $('#tac2d')?.addEventListener('dblclick', doExpand);
}

// ── run an engagement ────────────────────────────────────────────────────────
async function engage() {
  const scenario = app.config.buildScenario();
  app.lastScenario = scenario;
  setBanner('running', 'COMPUTING', 'Integrating 6-DOF solution…');
  $('#viewport-loading').classList.remove('hidden');
  pause();
  try {
    const t0 = performance.now();
    const result = await api.simulate(scenario);
    const ms = Math.round(performance.now() - t0);
    app.result = result;
    const n = result.channels.t.length;
    app.sampleRate = n > 1 ? (n - 1) / result.channels.t[n - 1] : 60;
    document.getElementById('viewport-empty')?.classList.add('hidden');
    app.tac2d.setResult(result);
    app.telemetry.setResult(result);
    $('#scrub').max = n - 1; setScrub(0); app.index = 0;
    showOutcome(result);
    toast(`Solution: ${n} samples in ${ms} ms`);
    play();
  } catch (e) {
    setBanner('miss', 'ERROR', e.message);
    toast('Simulation failed: ' + e.message, 5000);
    console.error(e);
  } finally {
    $('#viewport-loading').classList.add('hidden');
  }
}

function showOutcome(r) {
  const s = r.summary;
  const poles = s.pitbull_range
    ? ` · PITBULL @ ${(s.pitbull_range / 1000).toFixed(1)} km` +
      (s.a_pole ? ` · A-pole ${(s.a_pole / 1000).toFixed(1)} km` : '') +
      (s.f_pole ? ` · F-pole ${(s.f_pole / 1000).toFixed(1)} km` : '')
    : (s.went_active === false ? ' · seeker never acquired' : '');
  if (r.outcome === 'HIT') {
    setBanner('hit', '● INTERCEPT', `Miss ${r.miss_distance.toFixed(1)} m · TOF ${r.time_of_flight.toFixed(1)} s · ${s.max_mach} Mach${poles}`);
  } else {
    const label = { MISS: '○ TARGET SURVIVED', GROUND: '▽ GROUND IMPACT', TIMEOUT: '◌ NO INTERCEPT', LOST_ENERGY: '◌ ENERGY DEPLETED' }[r.outcome] || r.outcome;
    setBanner('miss', label, `Closest approach ${r.miss_distance.toFixed(1)} m · TOF ${r.time_of_flight.toFixed(1)} s${poles}`);
  }
}

function setBanner(cls, label, detail) {
  const b = $('#outcome-banner');
  b.className = 'outcome ' + cls;
  b.querySelector('.o-label').textContent = label;
  b.querySelector('.o-detail').textContent = detail;
}

// ── playback ─────────────────────────────────────────────────────────────────
function play() { if (!app.result) return; app.playing = true; $('#btn-play').textContent = '❚❚'; app.lastFrame = performance.now(); }
function pause() { app.playing = false; $('#btn-play').textContent = '▶'; }
function togglePlay() { if (app.playing) pause(); else { if (app.result && app.index >= app.result.channels.t.length - 1) app.index = 0; play(); } }

function loop(now) {
  requestAnimationFrame(loop);
  if (app.playing && app.result) {
    const dt = Math.min((now - app.lastFrame) / 1000, 0.1);
    app.lastFrame = now;
    app.index += app.speed * dt * app.sampleRate;
    const n = app.result.channels.t.length;
    if (app.index >= n - 1) { app.index = n - 1; pause(); }
    seek(app.index);
    setScrub(app.index);
  }
}

function seek(i) {
  const idx = Math.round(i);
  app.tac2d.seek(idx);
  app.telemetry.update(idx);
  if (app.result) {   // keep the viewport HUD readout live in both views
    const ch = app.result.channels, j = Math.min(idx, ch.t.length - 1);
    $('#vr-time').textContent = ch.t[j].toFixed(2);
    $('#vr-mach').textContent = ch.mmach[j].toFixed(2);
    $('#vr-range').textContent = (ch.range[j] / 1000).toFixed(2);
  }
  $('#scrub-time').textContent = app.result ? app.result.channels.t[Math.min(idx, app.result.channels.t.length - 1)].toFixed(2) + 's' : '0.00s';
}
function setScrub(i) { $('#scrub').value = Math.round(i); }

function togglePanel(side) {
  const ws = $('#workspace');
  ws.classList.toggle(side === 'left' ? 'lcol' : 'rcol');
  // let the 3D viewport / 2D map refit to the new width
  setTimeout(() => window.dispatchEvent(new Event('resize')), 260);
}

// ── save / load / analyse runs ────────────────────────────────────────────────
async function saveRun() {
  if (!app.result) { toast('Run an engagement first (press ENGAGE)'); return; }
  const def = (app.result.scenario_name || 'engagement') + ' — ' + app.result.outcome;
  const name = prompt('Name this run:', def);
  if (!name) return;
  try {
    await api.saveRun(name, app.lastScenario || {}, app.result);
    toast(`Run “${name}” archived`);
  } catch (e) { toast('Save run failed: ' + e.message, 4500); }
}

async function openRuns() {
  const body = $('#runs-body');
  body.innerHTML = '<p class="hint mono">Loading…</p>';
  $('#runs-modal').classList.remove('hidden');
  try {
    const { runs } = await api.runs();
    if (!runs.length) { body.innerHTML = '<p class="hint">No saved runs yet. Run an engagement and press ◈ SAVE RUN.</p>'; return; }
    body.innerHTML = '';
    runs.forEach(r => {
      const s = r.summary || {};
      const tag = (r.outcome || '').toLowerCase();
      const row = document.createElement('div');
      row.className = 'run-row';
      row.innerHTML = `<div class="run-main"><b>${r.name}</b>
        <span class="tag-${tag}">${r.outcome || ''}</span></div>
        <div class="run-sub mono">${r.saved_at || ''} · ${s.missile || ''} vs ${s.target || ''} · miss ${s.miss_distance ?? '?'} m · Mach ${s.max_mach ?? '?'}
        <span class="run-hint">— click: load & play · double-click: expand/compare</span></div>`;
      row.addEventListener('click', () => loadRun(r.id));
      row.addEventListener('dblclick', async () => {
        const rec = await api.loadRun(r.id);
        if (rec.result) { $('#runs-modal').classList.add('hidden'); openExpand([{ name: rec.name, result: rec.result }]); }
      });
      body.appendChild(row);
    });
  } catch (e) { body.innerHTML = `<p class="hint" style="color:var(--red)">${e.message}</p>`; }
}

async function loadRun(id) {
  try {
    const rec = await api.loadRun(id);
    if (rec.error) throw new Error(rec.error);
    $('#runs-modal').classList.add('hidden');
    if (rec.scenario) app.config.loadPreset(rec.scenario);   // reflect in the planner
    const result = rec.result;
    app.result = result; app.lastScenario = rec.scenario;
    const n = result.channels.t.length;
    app.sampleRate = n > 1 ? (n - 1) / result.channels.t[n - 1] : 60;
    document.getElementById('viewport-empty')?.classList.add('hidden');
    app.tac2d.setResult(result); app.telemetry.setResult(result);
    $('#scrub').max = n - 1; setScrub(0); app.index = 0;
    showOutcome(result);
    toast(`Loaded run “${rec.name}”`);
    seek(0);
  } catch (e) { toast('Load failed: ' + e.message, 4500); }
}

// ── optimizer / tactical-AI ──────────────────────────────────────────────────
function openOptimizer() {
  const body = $('#opt-body');
  const scenario = app.config.buildScenario();
  const hasSeg = scenario.target.timeline && scenario.target.timeline.length > 0;
  body.innerHTML = `
    <div class="opt-tabs">
      <button class="opt-tab active" id="opt-tab-brief" data-tip="Compute the numbers pilots actually brief: Minimum Abort Range, recommit timing and the best defensive reaction — per altitude, from full 6-DOF Monte-Carlo runs.">◈ TACTICAL BRIEF (MAR / RECOMMIT)</button>
      <button class="opt-tab" id="opt-tab-search" data-tip="Classic parameter search: vary chosen knobs across many engagements to find an optimum.">⚙ PARAMETER SEARCH</button>
    </div>
    <div id="opt-pane-brief">
      <p class="hint">Runs dozens of full 6-DOF engagements of <b>this scenario's missile</b> against the target to derive an actionable defensive brief:
      <b>MAR</b> (the range inside which turning cold no longer saves you), <b>recommit timing</b> (when the missile is energy-dead so you can turn back hot),
      and the <b>best reaction</b> if you're committed — for each altitude band.</p>
      <div class="opt-controls">
        <div class="field" data-tip="Altitude bands to study. MAR grows dramatically with altitude — thin air extends missile reach."><label>Altitudes (km)</label>
          <div id="tac-alts" class="tac-alts">
            <label class="chk"><input type="checkbox" value="3000" checked>3</label>
            <label class="chk"><input type="checkbox" value="6000" checked>6</label>
            <label class="chk"><input type="checkbox" value="9000" checked>9</label>
            <label class="chk"><input type="checkbox" value="12000">12</label>
          </div></div>
        <div class="field" data-tip="Seeker-noise re-rolls per test point. 2 is a quick look; 4 gives steadier survival percentages (≈2× slower)."><label>Noise seeds</label>
          <select id="tac-seeds"><option value="2">2 (fast)</option><option value="3">3</option><option value="4">4 (steady)</option></select></div>
      </div>
      <button class="opt-run" id="tac-run" data-tip="Launch the study (≈1 min per altitude per seed). Every number comes from full 6-DOF physics runs, not lookup tables — and every number can be reproduced by hand in the sim.">▶ COMPUTE TACTICAL BRIEF</button>
      <div class="opt-progress hidden" id="tac-prog"><div></div></div>
      <div class="opt-result" id="tac-result"></div>
    </div>
    <div id="opt-pane-search" class="hidden">
      <p class="hint">The search engine runs many engagement variants to find an optimal strategy.
      <b>Survival</b> maximises the defender's miss distance; <b>Intercept</b> minimises it for the attacker.</p>
      <div class="opt-controls">
        <div class="field" data-tip="Whose problem to solve: the defender's (maximise miss distance / survive) or the shooter's (minimise miss distance / kill fast)."><label>Objective</label>
          <select id="opt-objective">
            <option value="survival">Optimal Survival (defender)</option>
            <option value="intercept">Optimal Intercept (attacker)</option>
          </select></div>
        <div class="field" data-tip="Monte-Carlo samples the search space uniformly (good first look). Genetic evolves the best candidates over generations (better for fine optima)."><label>Method</label>
          <select id="opt-method">
            <option value="monte_carlo">Monte-Carlo (random)</option>
            <option value="genetic">Genetic Algorithm</option>
          </select></div>
        <div class="field" data-tip="How many full engagements to simulate. More = better coverage, longer wait (~1 s each)."><label>Variants (N)</label>
          <input id="opt-n" type="number" value="40" min="10" max="300" step="10"></div>
        <div class="field" data-tip="Which parameters the AI is allowed to vary while searching."><label>Search variables</label>
          <select id="opt-knobs">
            ${hasSeg ? '<option value="defender">Break timing + Break G</option>' : ''}
            <option value="guidance">Guidance N + Lethal radius</option>
          </select></div>
      </div>
      <button class="opt-run" id="opt-run" data-tip="Launch the study. Results are ranked; the best strategy can be applied straight back into the configurator.">▶ RUN OPTIMIZATION</button>
      <div class="opt-progress hidden" id="opt-prog"><div></div></div>
      <div class="opt-result" id="opt-result"></div>
    </div>`;
  const tabs = (brief) => {
    $('#opt-pane-brief').classList.toggle('hidden', !brief);
    $('#opt-pane-search').classList.toggle('hidden', brief);
    $('#opt-tab-brief').classList.toggle('active', brief);
    $('#opt-tab-search').classList.toggle('active', !brief);
  };
  $('#opt-tab-brief').addEventListener('click', () => tabs(true));
  $('#opt-tab-search').addEventListener('click', () => tabs(false));
  $('#opt-run').addEventListener('click', () => runOptimization(scenario));
  $('#tac-run').addEventListener('click', () => runTactical(scenario));
  $('#optimizer-modal').classList.remove('hidden');
}

async function runTactical(scenario) {
  const altitudes = [...document.querySelectorAll('#tac-alts input:checked')].map(i => +i.value);
  if (!altitudes.length) { toast('Pick at least one altitude band'); return; }
  const n_seeds = +$('#tac-seeds').value;
  const prog = $('#tac-prog'); prog.classList.remove('hidden');
  const bar = prog.querySelector('div'); bar.style.width = '10%';
  $('#tac-result').innerHTML = '<p class="hint mono">Flying the study — Rmax/MAR bisection, abort-G sweep, notch windows, pole study… (≈1 min per altitude per seed)</p>';
  $('#tac-run').disabled = true;
  let p = 10; const creep = setInterval(() => { p = Math.min(94, p + 1.2); bar.style.width = p + '%'; }, 900);
  try {
    const out = await api.tactical({ scenario, altitudes, n_seeds });
    clearInterval(creep); bar.style.width = '100%';
    renderTactical(out);
  } catch (e) {
    clearInterval(creep);
    $('#tac-result').innerHTML = `<p class="hint" style="color:var(--red)">Error: ${e.message}</p>`;
  } finally {
    $('#tac-run').disabled = false;
  }
}

function renderTactical(out) {
  const rows = out.rows || [];
  const fmt = (v, d = 0) => (v == null ? '—' : (+v).toFixed(d));
  const cards = rows.map(r => {
    const opts = (r.options || []).map(o => {
      const pct = Math.round(o.survival * 100);
      const cls = pct >= 75 ? 'good' : pct >= 40 ? 'mid' : 'bad';
      return `<div class="tac-opt"><span>${o.name}</span>
        <span class="tac-bar"><i class="${cls}" style="width:${pct}%"></i></span>
        <b class="${cls}">${pct}%</b></div>`;
    }).join('');
    const notch = r.notch ? `TTI ${fmt(r.notch.tti_s)} s · ${Math.round(r.notch.survival * 100)}%` : '—';
    const asp = r.aspect_required;
    const aspStr = asp ? `${fmt(asp.change_deg)}° → ${asp.final_aspect}° · ${fmt(asp.g)} g` : '—';
    const zoneCls = { 'MONITOR': 'good', 'ABORT LANE': 'mid', 'COMMITTED / NO-ESCAPE': 'bad', 'MERGE / WVR': 'bad' };
    const decision = (r.decision || []).map(b => {
      const rng = b.hi == null ? `beyond ${fmt(b.lo)} km` : `${fmt(b.lo)}–${fmt(b.hi)} km`;
      const cls = zoneCls[b.zone] || 'mid';
      return `<div class="tac-band ${cls}"><div class="tb-head"><span class="tb-range">${rng}</span><span class="tb-zone">${b.zone}</span></div><div class="tb-act">${b.action}</div></div>`;
    }).join('');
    return `<div class="tac-card">
      <div class="tac-alt">▲ ${(r.altitude_m / 1000).toFixed(0)} km ALT</div>
      <div class="tac-kpis">
        <div data-tip="Max launch range that kills a HOT, non-reacting target at this altitude (grid-swept in full 6-DOF). Compare with the open-source class figures in Learn."><span>RMAX</span><b>${fmt(r.rmax_km)} km</b></div>
        <div data-tip="Minimum Abort Range: fired inside this, even an immediate 7 g turn-cold-and-run does not defeat the shot — the no-escape boundary. Shown also as % of Rmax (doctrine: NEZ ≈ 30–50% of Rmax)."><span>MAR</span><b>${fmt(r.mar_km)} km</b>${r.mar_pct_rmax ? `<em>${fmt(r.mar_pct_rmax)}% of Rmax</em>` : ''}</div>
        <div data-tip="The missile's own seeker acquisition range — where it goes pitbull / the WVR handover. Inside this the shooter no longer matters."><span>PITBULL</span><b>${fmt(r.pitbull_km)} km</b></div>
      </div>
      <div class="tac-kpis">
        <div data-tip="Softest cold turn that still defeats a shot taken just outside MAR. Turning softer saves energy for the recommit; the study sweeps 3/5/7 g."><span>ABORT G</span><b>${r.min_abort_g ? fmt(r.min_abort_g) + ' g' : '—'}</b></div>
        <div data-tip="If you can't out-range the shot: the LEAST aspect change (from hot) and the G needed to survive it — beam/notch (≈90°) if that works, else a full cold turn (≈180°)."><span>ASPECT+G REQ</span><b>${aspStr}</b></div>
        <div data-tip="Best notch+chaff timing if COMMITTED at the briefed range: the time-to-impact at which beaming works best, and its survival rate."><span>NOTCH WIN</span><b>${notch}</b></div>
      </div>
      <div class="tac-kpis">
        <div data-tip="Seconds you must hold the cold course after an abort until the threat missile is energy-dead. This is your exposure time going cold."><span>COLD TIME</span><b>${fmt(r.cold_time_s)} s</b></div>
        <div data-tip="Short-Range ReCommit: shooter→you range when the aborted-against missile finally dies — how close you can be when you turn back hot and re-enter the fight."><span>SRRC</span><b>${fmt(r.srrc_km)} km</b></div>
      </div>
      <div class="tac-dec-title" data-tip="What to do at each range band against this weapon, derived from the numbers above. Read it top (far) to bottom (merge).">◈ WHAT TO DO AT WHAT DISTANCE</div>
      <div class="tac-decision">${decision}</div>
      <div class="tac-opts-title">Committed-defence menu @ ${fmt(out.base_range_km)} km (survival over ${out.n_seeds} seeds)</div>
      <div class="tac-opts">${opts}</div>
      <div class="tac-advice">${r.advice}</div>
    </div>`;
  }).join('');
  const poleRows = (out.poles || []).map(p => `
    <tr><td>${p.profile}</td><td class="tag-${(p.outcome || '').toLowerCase()}">${p.outcome}</td>
    <td>${p.a_pole_km ?? '—'}</td><td>${p.f_pole_km ?? '—'}</td><td>${p.tof_s ?? '—'}</td></tr>`).join('');
  const polesBlock = poleRows ? `
    <div class="opt-best" style="margin-top:14px"><h4>◈ SHOOTER POLE STUDY — support profile trade @ ${fmt(out.base_range_km)} km / ${fmt((out.base_altitude_m || 9000) / 1000)} km</h4>
      <p class="hint">Offensive side of the same shot: how hard you crank after launch vs how far you stay from the threat.
      Bigger A-pole/F-pole = you are safer while the missile still kills. (Crank too far and the datalink drops — the miss shows it.)</p>
      <table class="data"><thead><tr><th>Support</th><th>Outcome</th><th>A-pole (km)</th><th>F-pole (km)</th><th>TOF (s)</th></tr></thead>
      <tbody>${poleRows}</tbody></table></div>` : '';
  $('#tac-result').innerHTML = `
    <div class="opt-best"><h4>◈ DEFENSIVE KNEEBOARD vs ${out.threat} (briefed launch range ${fmt(out.base_range_km)} km)</h4>
    <p class="hint">Flown in full 6-DOF${out.parallel ? ' — parallelised across cores' : ''}: ${out.sims ?? '—'} engagements${out.errors ? `, ${out.errors} errored` : ', 0 errors'}.
    Rmax/MAR are seed-averaged and sub-grid interpolated to the kill-probability boundary (lethal radius ${fmt(out.hit_radius_m)} m), per altitude.
    Verify any number by hand: set the geometry to it, script the reaction in ④ Red Forces, press ENGAGE.</p></div>
    <div class="tac-grid">${cards}</div>
    ${polesBlock}`;
}

function knobSet(which, scenario) {
  if (which === 'defender' && scenario.target.timeline.length) {
    const t0 = scenario.target.timeline[0].trigger.type;
    const lo = t0 === 'range' ? 3000 : 0, hi = t0 === 'range' ? 14000 : 10;
    return [
      { path: 'target.timeline.0.trigger.value', low: lo, high: hi, label: 'Break trigger' },
      { path: 'target.timeline.0.params.g', low: 4, high: 9, label: 'Break G' },
    ];
  }
  return [
    { path: 'missile.definition.guidance.N', low: 2.5, high: 5.5, label: 'Guidance N' },
    { path: 'sim.hit_radius_m', low: 5, high: 25, label: 'Lethal radius' },
  ];
}

async function runOptimization(scenario) {
  const objective = $('#opt-objective').value;
  const method = $('#opt-method').value;
  const n = +$('#opt-n').value;
  const knobs = knobSet($('#opt-knobs').value, scenario);
  const prog = $('#opt-prog'); prog.classList.remove('hidden');
  const bar = prog.querySelector('div'); bar.style.width = '15%';
  $('#opt-result').innerHTML = '<p class="hint mono">Running ' + n + ' engagements… this can take a moment.</p>';
  $('#opt-run').disabled = true;
  // fake progress creep while the (blocking) request runs
  let p = 15; const creep = setInterval(() => { p = Math.min(92, p + 3); bar.style.width = p + '%'; }, 400);
  try {
    const out = await api.optimize({ scenario, knobs, method, objective, n });
    clearInterval(creep); bar.style.width = '100%';
    renderOptResult(out, knobs);
  } catch (e) {
    clearInterval(creep);
    $('#opt-result').innerHTML = `<p class="hint" style="color:var(--red)">Error: ${e.message}</p>`;
  } finally {
    $('#opt-run').disabled = false;
  }
}

function renderOptResult(out, knobs) {
  const best = out.best;
  if (!best) { $('#opt-result').innerHTML = '<p class="hint" style="color:var(--red)">No valid variants — every engagement errored. Check the scenario.</p>'; return; }
  const dash = (v) => (v == null ? '—' : v);
  const vecStr = knobs.map((k, i) => `${k.label} = ${best.vector[i]}`).join('  ·  ');
  const rows = (out.results || []).slice()
    .filter(r => r.score != null)
    .sort((a, b) => b.score - a.score).slice(0, 12);
  let table = '';
  if (rows.length) {
    table = `<table class="data"><thead><tr><th>#</th>${knobs.map(k => `<th>${k.label}</th>`).join('')}<th>Outcome</th><th>Miss (m)</th><th>Score</th></tr></thead><tbody>` +
      rows.map((r, i) => `<tr><td>${i + 1}</td>${r.vector.map(v => `<td>${v}</td>`).join('')}<td class="tag-${(r.outcome || '').toLowerCase()}">${r.outcome}</td><td>${dash(r.miss_distance)}</td><td>${dash(r.score)}</td></tr>`).join('') +
      '</tbody></table>';
  }
  const errNote = out.errors ? ` · ${out.errors} errored` : '';
  const stats = out.stats ? `<p class="hint mono">Hit rate ${(out.stats.hit_rate * 100).toFixed(0)}% · median miss ${out.stats.median_miss} m · best score ${out.stats.best_score}${out.parallel ? ' · parallelised' : ''}${errNote}</p>` : '';
  $('#opt-result').innerHTML = `
    <div class="opt-best">
      <h4>◈ OPTIMAL STRATEGY (${out.objective})</h4>
      <div class="mono">${vecStr}</div>
      <div class="mono" style="margin-top:6px">Outcome: <b class="tag-${(best.outcome || '').toLowerCase()}">${best.outcome}</b> · miss ${dash(best.miss_distance)} m · TOF ${dash(best.time_of_flight)} s</div>
      <button class="ghost amber" id="opt-apply" style="margin-top:10px">APPLY TO SCENARIO →</button>
    </div>
    ${stats}${table}`;
  $('#opt-apply')?.addEventListener('click', () => { applyKnobs(knobs, best.vector); toast('Applied optimal values to the configurator'); $('#optimizer-modal').classList.add('hidden'); });
}

function applyKnobs(knobs, vector) {
  const w = app.config.working;
  knobs.forEach((k, i) => setPath(w, k.path, vector[i]));
  app.config.render();
}
function setPath(obj, path, val) {
  const parts = path.split('.'); let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = /^\d+$/.test(parts[i]) ? +parts[i] : parts[i];
    if (cur[p] == null) cur[p] = /^\d+$/.test(parts[i + 1]) ? [] : {};
    cur = cur[p];
  }
  const last = parts[parts.length - 1];
  cur[/^\d+$/.test(last) ? +last : last] = val;
}

// ── atmosphere modal ─────────────────────────────────────────────────────────
async function openAtmos() {
  $('#atmos-modal').classList.remove('hidden');
  const body = $('#atmos-body');
  body.innerHTML = '<p class="hint mono">Loading USSA-1976 profile…</p>';
  try {
    const { rows } = await api.atmosphere();
    const cv = document.createElement('canvas'); cv.width = 700; cv.height = 260; cv.style.width = '100%';
    body.innerHTML = '';
    body.appendChild(cv);
    drawAtmos(cv, rows);
    const t = document.createElement('p'); t.className = 'hint';
    t.innerHTML = 'Density (blue), speed of sound (amber) and pressure (red, log) vs altitude to 30 km. These drive drag (∝ρ) and Mach (∝1/a) throughout the engagement.';
    body.appendChild(t);
  } catch (e) { body.innerHTML = `<p class="hint" style="color:var(--red)">${e.message}</p>`; }
}
function drawAtmos(cv, rows) {
  const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, pad = 30;
  ctx.clearRect(0, 0, W, H);
  const maxAlt = rows[rows.length - 1].alt;
  const X = (a) => pad + (a / maxAlt) * (W - 2 * pad);
  const series = (key, color, logv) => {
    const vals = rows.map(r => logv ? Math.log10(r[key]) : r[key]);
    const lo = Math.min(...vals), hi = Math.max(...vals), span = (hi - lo) || 1;
    const Y = (v) => H - pad - ((v - lo) / span) * (H - 2 * pad);
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.shadowColor = color; ctx.shadowBlur = 6;
    ctx.beginPath(); rows.forEach((r, i) => { const x = X(r.alt), y = Y(vals[i]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke(); ctx.shadowBlur = 0;
  };
  ctx.strokeStyle = '#26375a'; ctx.strokeRect(pad, pad, W - 2 * pad, H - 2 * pad);
  series('rho', '#00E5FF', false); series('a', '#FFB000', false); series('P', '#FF3D00', true);
  ctx.fillStyle = '#6d84a6'; ctx.font = '10px "JetBrains Mono"';
  ctx.fillText('0 km', pad, H - 12); ctx.fillText((maxAlt / 1000) + ' km', W - pad - 30, H - 12);
}

boot();
