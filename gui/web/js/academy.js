// academy.js — the interactive teaching widgets for the Learn guide.
// Each widget is a self-contained, dependency-free mini-app that mounts into a
// <div data-widget="name"> placeholder inside a help section. They turn abstract
// BVR concepts (aspect, radar horizon, proportional navigation, the Doppler
// notch, MAR decision bands) into things you can drag, sweep and watch.
//
// help.js calls mountWidgets(rootEl) after rendering a section and calls the
// returned teardown before rendering the next one (so animation loops stop).

const COL = { blue: '#00E5FF', amber: '#FFB000', red: '#FF3D00', green: '#22ff9c',
              ink: '#e4eefc', dim: '#93accb', faint: '#6d84a6', grid: 'rgba(78,128,178,0.28)' };

function el(tag, attrs = {}, kids = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v != null) e.setAttribute(k, v);
  }
  (Array.isArray(kids) ? kids : [kids]).forEach(c =>
    e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  return e;
}
const R = (n, d = 0) => (Math.round(n * 10 ** d) / 10 ** d);

const REGISTRY = {};
const reg = (name, fn) => { REGISTRY[name] = fn; };

// the hands-on lab widgets — mounting one counts toward the "Tinkerer" medal
const LAB_WIDGETS = new Set(['aspect', 'pnlab', 'notch', 'jammer', 'marband', 'horizon',
  'radareq', 'flarefight', 'doghouse', 'guidancecompare', 'motorrace', 'seekerloop',
  'irscan', 'prf', 'decisiondrill', 'codex', 'fpole', 'emdiagram', 'grinder',
  'wez', 'notchgame', 'sternconv', 'sortgame', 'formations', 'rwrscope', 'irbands',
  'radarderive', 'rcsaspect', 'arrayphysics', 'beamwidth', 'barscan', 'radarpick']);

export function mountWidgets(root) {
  const teardowns = [];
  root.querySelectorAll('[data-widget]').forEach(node => {
    const fn = REGISTRY[node.dataset.widget];
    if (!fn) return;
    node.innerHTML = '';
    try {
      const t = fn(node); if (t) teardowns.push(t);
      if (LAB_WIDGETS.has(node.dataset.widget)) progress.touch(node.dataset.widget);
    }
    catch (e) { node.innerHTML = `<div class="wx-err">widget error: ${e.message}</div>`; }
  });
  return () => teardowns.forEach(t => { try { t(); } catch (_) {} });
}

// shared canvas helper: crisp DPR-scaled 2D context sized to the element width
function makeCanvas(parent, h) {
  const cv = el('canvas', { class: 'wx-canvas' });
  cv.style.height = h + 'px';
  parent.appendChild(cv);
  const g = cv.getContext('2d');
  const V = { cv, g, get w() { return cv._w; }, get h() { return cv._h; }, redraw: null };
  const fit = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = cv.clientWidth || parent.clientWidth || 640;
    cv.width = w * dpr; cv.height = h * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    cv._w = w; cv._h = h;
  };
  V.fit = fit;
  fit();
  // A widget mounted into a hidden modal first measures a 0/fallback width; a
  // ResizeObserver refits + redraws the instant it gets its real layout size,
  // which works even when requestAnimationFrame is throttled (background tab).
  if (window.ResizeObserver) {
    let lastW = cv._w;
    const ro = new ResizeObserver(() => {
      if (cv.clientWidth && cv.clientWidth !== lastW) {
        lastW = cv.clientWidth; fit();
        if (V.redraw) { try { V.redraw(); } catch (_) {} }
      }
    });
    ro.observe(cv);
    V._ro = ro;
  }
  return V;
}
// `fmt` (optional) maps the raw slider number to what the user should SEE — e.g.
// a log-scale control whose slider position is an exponent but which must read
// out as the real physical quantity (never a negative area).
function slider(label, min, max, step, val, oninput, fmt) {
  const show = (v) => (fmt ? fmt(+v) : String(v));
  const out = el('b', { class: 'wx-val' }, show(val));
  const input = el('input', { type: 'range', min, max, step, value: val,
    oninput: (e) => { out.textContent = show(e.target.value); oninput(+e.target.value); } });
  return { row: el('label', { class: 'wx-slider' }, [el('span', {}, label), input, out]), input, out };
}
function frame(fn) {   // rAF loop with a stop flag
  let live = true;
  const tick = (t) => { if (!live) return; fn(t); requestAnimationFrame(tick); };
  // paint the first frame SYNCHRONOUSLY so the widget shows content even if
  // requestAnimationFrame is throttled (background tab / headless preview),
  // then hand off to the rAF loop for animation.
  try { fn(performance.now()); } catch (_) {}
  requestAnimationFrame(tick);
  return () => { live = false; };
}

// ─────────────────────────────────────────────────────────────────────────────
//  1 · ASPECT & ANGLE-OFF DIAL  (NATO aspect / brevity)
// ─────────────────────────────────────────────────────────────────────────────
reg('aspect', (node) => {
  const _V = makeCanvas(node, 300); const { cv, g, fit } = _V;
  const controls = el('div', { class: 'wx-controls' });
  node.appendChild(controls);
  const read = el('div', { class: 'wx-readout' });
  node.appendChild(read);
  let bandit = 200;   // bandit heading, ° (0 = pointing straight at you)
  const s1 = slider('Bandit heading (drag)', 0, 359, 1, bandit, v => { bandit = v; draw(); });
  controls.appendChild(s1.row);

  function term(aspect) {
    if (aspect >= 150) return ['HOT', COL.red, 'nose-on — max closure, he sees you, shot incoming'];
    if (aspect >= 110) return ['FLANKING', COL.amber, 'angling in — high closure, still threatening'];
    if (aspect >= 70) return ['BEAM', COL.green, '~90° — near-zero closure, the Doppler-notch geometry'];
    if (aspect >= 30) return ['DRAG', COL.blue, 'angling away — low closure, running for the door'];
    return ['COLD / STERN', COL.blue, 'tail-on — you are behind him, minimum closure'];
  }
  function draw() {
    g.clearRect(0, 0, _V.w, _V.h);
    const cx = _V.w / 2, you = _V.h - 34, band = 70, R0 = 30;
    // LOS
    g.strokeStyle = 'rgba(147,172,203,.5)'; g.setLineDash([5, 5]); g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(cx, you); g.lineTo(cx, band); g.stroke(); g.setLineDash([]);
    g.fillStyle = COL.faint; g.font = '10px "JetBrains Mono"';
    g.fillText('LINE OF SIGHT', cx + 8, (you + band) / 2);
    // you (interceptor) — arrow pointing up (at the bandit)
    drawJet(g, cx, you, 0, COL.blue, 'YOU');
    // bandit velocity heading: 0 = toward you (down the LOS, i.e. +y screen)
    const hd = bandit * Math.PI / 180;
    // aspect = 180 - angle between bandit velocity and bandit→you
    // bandit→you points DOWN (+y). velocity dir for heading 0 should be down.
    const vdir = { x: Math.sin(hd), y: Math.cos(hd) };     // heading 0 → (0,+1) down = toward you
    const toYou = { x: 0, y: 1 };
    let ang = Math.acos(Math.max(-1, Math.min(1, vdir.x * toYou.x + vdir.y * toYou.y)));
    const aspect = 180 - ang * 180 / Math.PI;
    // screen heading: velocity vector on canvas points along (vdir.x, vdir.y)
    const scrHead = Math.atan2(vdir.x, -vdir.y);   // 0 = up
    drawJet(g, cx, band, scrHead, COL.red, 'BANDIT');
    // aspect arc at bandit
    g.strokeStyle = COL.amber; g.lineWidth = 2;
    g.beginPath(); g.arc(cx, band, R0 + 6, Math.PI / 2, Math.PI / 2 + ang * Math.sign(vdir.x || 1), vdir.x < 0);
    g.stroke();
    const [t, c, desc] = term(aspect);
    read.innerHTML =
      `<div class="wx-big" style="color:${c}">${t}</div>` +
      `<div class="wx-line">Aspect angle <b style="color:${COL.amber}">${R(aspect)}°</b>` +
      ` &nbsp;·&nbsp; ${desc}</div>` +
      `<div class="wx-hint">Aspect is measured at the <b>bandit</b>, between his tail and the line to you: ` +
      `180° = hot (nose-on), 90° = beam, 0° = cold (you're on his stern). It's what he presents to <i>you</i> — ` +
      `distinct from <b>angle-off</b> (the difference between your two headings) and <b>AOT</b> (angle off tail).</div>`;
  }
  _V.redraw = draw;
  const onResize = () => { fit(); draw(); };
  window.addEventListener('resize', onResize);
  draw();
  return () => window.removeEventListener('resize', onResize);
});

function drawJet(g, x, y, heading, color, label) {
  g.save(); g.translate(x, y); g.rotate(heading);
  g.fillStyle = color; g.strokeStyle = color; g.shadowColor = color; g.shadowBlur = 8;
  g.beginPath(); g.moveTo(0, -13); g.lineTo(9, 11); g.lineTo(0, 5); g.lineTo(-9, 11); g.closePath();
  g.fill(); g.shadowBlur = 0; g.restore();
  g.fillStyle = color; g.font = 'bold 10px "JetBrains Mono"';
  g.fillText(label, x + 14, y + 3);
}

// ─────────────────────────────────────────────────────────────────────────────
//  2 · RADAR HORIZON / LRSAM VULNERABILITY
// ─────────────────────────────────────────────────────────────────────────────
reg('horizon', (node) => {
  const _V = makeCanvas(node, 260); const { cv, g, fit } = _V;
  const controls = el('div', { class: 'wx-controls' });
  node.appendChild(controls);
  const read = el('div', { class: 'wx-readout' });
  node.appendChild(read);
  let hRadar = 25, hTgt = 100, tgtRange = 120;   // m, m, km
  const s1 = slider('Radar/emitter alt (m)', 0, 10000, 25, hRadar, v => { hRadar = v; draw(); });
  const s2 = slider('Target alt (m)', 30, 12000, 30, hTgt, v => { hTgt = v; draw(); });
  const s3 = slider('Target range (km)', 5, 400, 5, tgtRange, v => { tgtRange = v; draw(); });
  controls.append(s1.row, s2.row, s3.row);

  const horizonKm = (h) => 4.12 * Math.sqrt(Math.max(h, 0));   // 4/3-earth radar horizon
  function draw() {
    g.clearRect(0, 0, _V.w, _V.h);
    const hd = horizonKm(hRadar), ht = horizonKm(hTgt), maxDet = hd + ht;
    const detectable = tgtRange <= maxDet;
    // side view: curved earth arc
    const pad = 30, base = _V.h - 26, span = _V.w - 2 * pad;
    const Rearth = span * 3.4;   // exaggerated curvature for legibility
    const cx = _V.w / 2, cyEarth = base + Rearth;
    g.strokeStyle = COL.grid; g.lineWidth = 2;
    g.beginPath();
    for (let px = pad; px <= _V.w - pad; px += 4) {
      const dx = px - cx, y = cyEarth - Math.sqrt(Rearth * Rearth - dx * dx);
      px === pad ? g.moveTo(px, y) : g.lineTo(px, y);
    }
    g.stroke();
    g.fillStyle = 'rgba(78,128,178,0.06)';
    g.fillRect(0, base, _V.w, _V.h - base);
    // km→x mapping (0 km at left radar site)
    const kmMax = 400, X = (km) => pad + (km / kmMax) * span;
    const surfY = (km) => { const dx = X(km) - cx; return cyEarth - Math.sqrt(Rearth * Rearth - dx * dx); };
    const altPx = (m) => m / 12000 * 120;   // vertical exaggeration
    // radar
    const rx = X(0), ry = surfY(0) - altPx(hRadar);
    g.fillStyle = COL.blue; g.shadowColor = COL.blue; g.shadowBlur = 8;
    g.beginPath(); g.arc(rx, ry, 4, 0, 7); g.fill(); g.shadowBlur = 0;
    g.fillStyle = COL.blue; g.font = '9px "JetBrains Mono"'; g.fillText('RADAR', rx - 6, ry - 8);
    // horizon tangent line to the radar's horizon distance
    const hx = X(hd), hy = surfY(hd);
    g.strokeStyle = 'rgba(0,229,255,.5)'; g.setLineDash([4, 4]); g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(rx, ry); g.lineTo(hx + (hx - rx) * 0.5, hy - (surfY(hd) - surfY(hd * 1.5)) * -1);
    g.lineTo(X(maxDet), surfY(maxDet) - altPx(hTgt)); g.stroke(); g.setLineDash([]);
    // radar-horizon marker on the surface
    g.fillStyle = COL.amber; g.beginPath(); g.arc(hx, hy, 3, 0, 7); g.fill();
    // target
    const tx = X(tgtRange), ty = surfY(tgtRange) - altPx(hTgt);
    const tc = detectable ? COL.green : COL.red;
    g.save(); g.translate(tx, ty); g.fillStyle = tc; g.strokeStyle = tc; g.shadowColor = tc; g.shadowBlur = 8;
    g.beginPath(); g.moveTo(-8, 0); g.lineTo(6, -4); g.lineTo(6, 4); g.closePath(); g.fill();
    g.shadowBlur = 0; g.restore();
    g.fillStyle = tc; g.font = '9px "JetBrains Mono"';
    g.fillText(detectable ? 'SEEN' : 'BELOW HORIZON', tx - 20, ty - 9);
    read.innerHTML =
      `<div class="wx-line">Radar horizon to target: <b style="color:${COL.amber}">${R(maxDet)} km</b>` +
      ` &nbsp;(radar ${R(hd)} + target ${R(ht)} km)</div>` +
      `<div class="wx-big" style="color:${tc}">${detectable ? 'TARGET DETECTABLE' : 'TARGET HIDDEN BELOW THE HORIZON'}</div>` +
      `<div class="wx-hint"><b>The LRSAM problem:</b> a 400 km missile is useless against what its radar can't see. ` +
      `A jet at ${R(hTgt)} m stays under a ${R(hRadar) === 0 ? 'ground' : R(hRadar) + ' m'} radar's horizon until ≈${R(maxDet)} km — ` +
      `so a low-level ingress shrinks a monster SAM's effective reach to a knife-fight unless an <b>elevated sensor</b> ` +
      `(AWACS, aerostat, fighter, another radar) cues it over the horizon via datalink. Formula: horizon(km) ≈ 4.12·(√h₁ + √h₂), h in metres.</div>`;
  }
  _V.redraw = draw;
  const onResize = () => { fit(); draw(); };
  window.addEventListener('resize', onResize);
  draw();
  return () => window.removeEventListener('resize', onResize);
});

// ─────────────────────────────────────────────────────────────────────────────
//  3 · PROPORTIONAL NAVIGATION SANDBOX
// ─────────────────────────────────────────────────────────────────────────────
reg('pnlab', (node) => {
  const _V = makeCanvas(node, 320); const { cv, g, fit } = _V;
  const controls = el('div', { class: 'wx-controls' });
  node.appendChild(controls);
  const read = el('div', { class: 'wx-readout' });
  node.appendChild(read);
  let N = 4, tgtManeuver = false, running = true;
  const s1 = slider('Navigation constant N', 2, 6, 0.5, N, v => { N = v; reset(); });
  const chk = el('label', { class: 'wx-chk' }, [
    el('input', { type: 'checkbox', onchange: (e) => { tgtManeuver = e.target.checked; reset(); } }),
    el('span', {}, 'Target jinks')]);
  const btn = el('button', { class: 'wx-btn', onclick: () => reset() }, '↻ Re-fire');
  controls.append(s1.row, chk, btn);

  let m, tgt, losPrev, trailM, trailT, t0, done, missDist, losHistory;
  function reset() {
    m = { x: _V.w * 0.15, y: _V.h - 30, vx: 0, vy: 0, spd: 260 };
    tgt = { x: _V.w * 0.55, y: 40, vx: 95, vy: 0, spd: 95 };
    // aim missile initial velocity roughly at target
    const dx = tgt.x - m.x, dy = tgt.y - m.y, d = Math.hypot(dx, dy);
    m.vx = m.spd * dx / d; m.vy = m.spd * dy / d;
    losPrev = Math.atan2(dy, dx); trailM = []; trailT = []; losHistory = [];
    t0 = performance.now(); done = false; missDist = Infinity;
  }
  reset();

  const SCALE = 0.02;   // world→display time compression
  function step(dt) {
    if (done) return;
    // target kinematics
    if (tgtManeuver) { const w = 1.1; tgt.vy = 55 * Math.sin((performance.now() - t0) / 1000 * w); }
    tgt.x += tgt.vx * dt * 4; tgt.y += tgt.vy * dt * 4;
    if (tgt.x > _V.w - 12) tgt.x = _V.w - 12;
    // LOS + PN
    const dx = tgt.x - m.x, dy = tgt.y - m.y, d = Math.hypot(dx, dy);
    const los = Math.atan2(dy, dx);
    let losRate = (los - losPrev); losRate = Math.atan2(Math.sin(losRate), Math.cos(losRate)) / dt;
    losPrev = los;
    const closing = -((dx * (m.vx - tgt.vx) + dy * (m.vy - tgt.vy)) / (d || 1));
    // a_cmd = N·Vc·λ̇, applied ⟂ velocity
    const aMag = N * Math.max(closing, 40) * losRate;
    const vh = Math.atan2(m.vy, m.vx);
    m.vx += -Math.sin(vh) * aMag * dt; m.vy += Math.cos(vh) * aMag * dt;
    const sp = Math.hypot(m.vx, m.vy) || 1; m.vx = m.vx / sp * m.spd; m.vy = m.vy / sp * m.spd;
    m.x += m.vx * dt * 4; m.y += m.vy * dt * 4;
    trailM.push([m.x, m.y]); trailT.push([tgt.x, tgt.y]);
    losHistory.push(los);
    if (d < missDist) missDist = d;
    if (d < 10) { done = true; missDist = d; }
    if (m.x > _V.w || m.y < -20 || tgt.x >= _V.w - 12 || trailM.length > 900) done = true;
  }
  let last = performance.now();
  const stop = frame((now) => {
    const dt = Math.min((now - last) / 1000, 0.04); last = now;
    if (running) step(dt);
    render();
  });
  function render() {
    g.clearRect(0, 0, _V.w, _V.h);
    // LOS fan — the key insight: parallel LOS lines = collision course
    const step2 = Math.max(1, Math.floor(trailM.length / 12));
    g.lineWidth = 1;
    for (let i = 0; i < trailM.length; i += step2) {
      g.strokeStyle = 'rgba(147,172,203,0.16)';
      g.beginPath(); g.moveTo(trailM[i][0], trailM[i][1]); g.lineTo(trailT[i][0], trailT[i][1]); g.stroke();
    }
    poly(g, trailT, COL.red, 2); poly(g, trailM, COL.amber, 2);
    dot(g, tgt.x, tgt.y, COL.red, 'TGT'); dot(g, m.x, m.y, COL.amber, 'MSL');
    // verdict
    const hit = done && missDist < 12;
    read.innerHTML =
      `<div class="wx-line">N = <b style="color:${COL.blue}">${N}</b> · closest approach ` +
      `<b style="color:${hit ? COL.green : COL.amber}">${missDist === Infinity ? '—' : R(missDist / 6, 1) + ' "m"'}</b>` +
      (done ? (hit ? ` · <span style="color:${COL.green}">INTERCEPT</span>` : ` · <span style="color:${COL.red}">flew past</span>`) : ' · guiding…') +
      `</div>` +
      `<div class="wx-hint">Watch the faint <b>line-of-sight lines</b> between missile and target. When they stay ` +
      `<b>parallel</b> (constant bearing), the range is closing on a collision course — that's the whole trick. ` +
      `PN commands turn ∝ how fast the LOS <i>rotates</i> (λ̇), driving that rotation to zero. Higher <b>N</b> nulls it ` +
      `sooner and leads a ${tgtManeuver ? 'jinking ' : ''}target harder, but a real seeker's noise gets amplified too.</div>`;
  }
  const onResize = () => { fit(); reset(); };
  window.addEventListener('resize', onResize);
  return () => { stop(); window.removeEventListener('resize', onResize); };
});
function poly(g, pts, color, w) {
  if (pts.length < 2) return;
  g.strokeStyle = color; g.lineWidth = w; g.beginPath();
  pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]));
  g.stroke();
}
function dot(g, x, y, color, label) {
  g.fillStyle = color; g.shadowColor = color; g.shadowBlur = 8;
  g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); g.shadowBlur = 0;
  g.font = '9px "JetBrains Mono"'; g.fillText(label, x + 7, y - 6);
}

// ─────────────────────────────────────────────────────────────────────────────
//  4 · DOPPLER NOTCH DEMONSTRATOR
// ─────────────────────────────────────────────────────────────────────────────
reg('notch', (node) => {
  const _V = makeCanvas(node, 250); const { cv, g, fit } = _V;
  const controls = el('div', { class: 'wx-controls' });
  node.appendChild(controls);
  const read = el('div', { class: 'wx-readout' });
  node.appendChild(read);
  let heading = 90, speed = 250;   // target heading rel. to radar LOS, target speed
  const s1 = slider('Target heading vs radar (°)', 0, 180, 1, heading, v => { heading = v; draw(); });
  const s2 = slider('Target speed (m/s)', 100, 400, 10, speed, v => { speed = v; draw(); });
  controls.append(s1.row, s2.row);
  const NOTCH = 65;   // m/s — the ± clutter-rejection notch half-width

  function draw() {
    g.clearRect(0, 0, _V.w, _V.h);
    const rx = 40, ry = _V.h / 2, tx = _V.w * 0.62, ty = _V.h * 0.4;
    // radial velocity = speed·cos(angle between velocity and LOS); heading 0 = straight at radar
    const radial = speed * Math.cos(heading * Math.PI / 180);
    const notched = Math.abs(radial) < NOTCH;
    // top-down picture
    g.strokeStyle = 'rgba(147,172,203,.4)'; g.setLineDash([5, 5]); g.lineWidth = 1.3;
    g.beginPath(); g.moveTo(rx, ry); g.lineTo(tx, ty); g.stroke(); g.setLineDash([]);
    g.fillStyle = COL.blue; g.shadowColor = COL.blue; g.shadowBlur = 8;
    g.beginPath(); g.arc(rx, ry, 5, 0, 7); g.fill(); g.shadowBlur = 0;
    g.font = '9px "JetBrains Mono"'; g.fillStyle = COL.blue; g.fillText('RADAR', rx - 8, ry + 20);
    // target with velocity arrow (heading measured from LOS)
    const los = Math.atan2(ty - ry, tx - rx);
    const vdir = los + Math.PI - heading * Math.PI / 180;   // heading 0 → toward radar
    const tc = notched ? COL.red : COL.green;
    g.save(); g.translate(tx, ty);
    g.strokeStyle = tc; g.lineWidth = 2; g.shadowColor = tc; g.shadowBlur = notched ? 2 : 8;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(vdir) * 34, Math.sin(vdir) * 34); g.stroke();
    g.fillStyle = tc; g.beginPath(); g.arc(0, 0, 5, 0, 7); g.fill(); g.shadowBlur = 0; g.restore();
    g.fillStyle = tc; g.fillText(notched ? 'NOTCHED — GONE' : 'TRACKED', tx - 16, ty - 12);
    // Doppler scope on the right
    const bx = _V.w - 150, bw = 130, by = 30, bh = _V.h - 60;
    g.strokeStyle = COL.grid; g.strokeRect(bx, by, bw, bh);
    g.fillStyle = COL.faint; g.font = '9px "JetBrains Mono"';
    g.fillText('DOPPLER', bx, by - 8); g.fillText('+Vc', bx - 2, by + 10); g.fillText('−Vc', bx - 2, by + bh - 2);
    // clutter notch band (around zero Doppler)
    const V = (v) => by + bh / 2 - (v / 450) * (bh / 2);
    g.fillStyle = 'rgba(255,61,0,.14)';
    g.fillRect(bx, V(NOTCH), bw, V(-NOTCH) - V(NOTCH));
    g.strokeStyle = 'rgba(255,61,0,.5)'; g.setLineDash([3, 3]);
    g.beginPath(); g.moveTo(bx, V(NOTCH)); g.lineTo(bx + bw, V(NOTCH)); g.moveTo(bx, V(-NOTCH)); g.lineTo(bx + bw, V(-NOTCH)); g.stroke();
    g.setLineDash([]);
    g.fillStyle = COL.red; g.fillText('CLUTTER NOTCH', bx + 8, V(0) + 3);
    // target return blip on the scope
    g.fillStyle = tc; g.shadowColor = tc; g.shadowBlur = notched ? 0 : 8;
    g.beginPath(); g.arc(bx + bw / 2, V(Math.max(-449, Math.min(449, radial))), 5, 0, 7); g.fill(); g.shadowBlur = 0;
    read.innerHTML =
      `<div class="wx-line">Radial (closing) velocity <b style="color:${COL.amber}">${R(radial)} m/s</b>` +
      ` &nbsp;→&nbsp; <span style="color:${tc}">${notched ? 'inside the clutter notch' : 'above the notch — clean return'}</span></div>` +
      `<div class="wx-big" style="color:${tc}">${notched ? 'TARGET LOST IN THE NOTCH' : 'TARGET TRACKED'}</div>` +
      `<div class="wx-hint">A pulse-Doppler radar rejects near-zero-Doppler returns to filter out the huge, ` +
      `stationary <b>ground clutter</b>. Turn to the <b>beam (~90°)</b> and your closing velocity drops toward zero — ` +
      `your return falls into that same rejection notch and you <b>vanish</b>. That's the <b>notch</b>. Pair it with ` +
      `chaff (which keeps some closure and blooms where you were) and drop low so the clutter behind you is worst. ` +
      `Counter: the shooter can go high (look-down separates you from clutter) or a modern radar may track through it.</div>`;
  }
  _V.redraw = draw;
  const onResize = () => { fit(); draw(); };
  window.addEventListener('resize', onResize);
  draw();
  return () => window.removeEventListener('resize', onResize);
});

// ─────────────────────────────────────────────────────────────────────────────
//  5 · MAR / NEZ DECISION-BAND RULER
// ─────────────────────────────────────────────────────────────────────────────
reg('marband', (node) => {
  const _V = makeCanvas(node, 150); const { cv, g, fit } = _V;
  const controls = el('div', { class: 'wx-controls' });
  node.appendChild(controls);
  const read = el('div', { class: 'wx-readout' });
  node.appendChild(read);
  let rmax = 100, mar = 40, shot = 55;
  const s1 = slider('Rmax (km)', 20, 300, 5, rmax, v => { rmax = v; if (mar > rmax) mar = rmax; if (shot > rmax * 1.2) shot = rmax; clamp(); draw(); });
  const s2 = slider('MAR (km)', 5, 200, 5, mar, v => { mar = Math.min(v, rmax); draw(); });
  const s3 = slider('Shot taken at (km)', 5, 320, 1, shot, v => { shot = v; draw(); });
  controls.append(s1.row, s2.row, s3.row);
  function clamp() { s2.input.max = rmax; }
  clamp();

  function draw() {
    g.clearRect(0, 0, _V.w, _V.h);
    const pad = 20, y = 60, h = 34, w = _V.w - 2 * pad, axMax = Math.max(rmax * 1.25, shot * 1.1);
    const X = (km) => pad + (km / axMax) * w;
    // bands
    band(g, X(0), X(mar), y, h, 'rgba(255,61,0,.35)', COL.red);       // NEZ
    band(g, X(mar), X(rmax), y, h, 'rgba(255,176,0,.28)', COL.amber);  // abort works
    band(g, X(rmax), X(axMax), y, h, 'rgba(34,255,156,.20)', COL.green); // beyond Rmax
    g.fillStyle = COL.dim; g.font = '9px "JetBrains Mono"'; g.textAlign = 'center';
    g.fillText('NO-ESCAPE ZONE', (X(0) + X(mar)) / 2, y - 6);
    g.fillText('ABORT WORKS', (X(mar) + X(rmax)) / 2, y - 6);
    g.fillText('OUT OF RANGE', (X(rmax) + X(axMax)) / 2, y - 6);
    g.textAlign = 'left';
    // axis ticks
    g.strokeStyle = COL.grid; g.fillStyle = COL.faint;
    for (let km = 0; km <= axMax; km += axMax > 160 ? 50 : 20) {
      g.beginPath(); g.moveTo(X(km), y + h); g.lineTo(X(km), y + h + 4); g.stroke();
      g.fillText(km + '', X(km) - 6, y + h + 15);
    }
    // shot marker
    const sxx = X(shot);
    g.strokeStyle = COL.ink; g.lineWidth = 2;
    g.beginPath(); g.moveTo(sxx, y - 16); g.lineTo(sxx, y + h + 6); g.stroke();
    g.fillStyle = COL.ink; g.beginPath(); g.moveTo(sxx, y - 16); g.lineTo(sxx - 5, y - 24); g.lineTo(sxx + 5, y - 24); g.closePath(); g.fill();
    let verdict, vc;
    if (shot > rmax) { verdict = 'Beyond Rmax — the shot can\'t reach you. Note it and keep working the intercept.'; vc = COL.green; }
    else if (shot > mar) { verdict = 'Inside Rmax but outside MAR — an immediate abort (turn cold & run) defeats it. Do it now.'; vc = COL.amber; }
    else { verdict = 'Inside MAR — the NO-ESCAPE ZONE. Running won\'t save you; go to your best last-ditch defence (notch + chaff, then break) and pray.'; vc = COL.red; }
    read.innerHTML =
      `<div class="wx-big" style="color:${vc}">${shot > rmax ? 'SAFE' : shot > mar ? 'ABORT' : 'NO ESCAPE — DEFEND'}</div>` +
      `<div class="wx-line">${verdict}</div>` +
      `<div class="wx-hint">MAR is typically <b>30–50% of Rmax</b> and both grow with <b>altitude</b> (thin air extends reach) ` +
      `and closure (a hot, fast, high target is killable from much farther). The Tactical-AI computes these exact numbers for ` +
      `your chosen weapon — set them here from that brief and rehearse the decision.</div>`;
  }
  function band(g, x0, x1, y, h, fill, stroke) {
    g.fillStyle = fill; g.fillRect(x0, y, x1 - x0, h);
    g.strokeStyle = stroke; g.lineWidth = 1; g.strokeRect(x0, y, x1 - x0, h);
  }
  _V.redraw = draw;
  const onResize = () => { fit(); draw(); };
  window.addEventListener('resize', onResize);
  draw();
  return () => window.removeEventListener('resize', onResize);
});

// ─────────────────────────────────────────────────────────────────────────────
//  PROGRESS & RANK — the gamification spine (persisted in localStorage)
// ─────────────────────────────────────────────────────────────────────────────
export const progress = {
  _get() { try { return JSON.parse(localStorage.aegis_learn || '{}'); } catch { return {}; } },
  _set(p) { try { localStorage.aegis_learn = JSON.stringify(p); } catch (_) {} },
  markRead(id) { const p = this._get(); p.read = p.read || {}; if (!p.read[id]) { p.read[id] = 1; this._set(p); } },
  isRead(id) { return !!(this._get().read || {})[id]; },
  readCount() { return Object.keys(this._get().read || {}).length; },
  quizResult(score, total) {
    const p = this._get();
    p.quizBest = Math.max(p.quizBest || 0, score);
    p.quizTotal = total;
    p.quizRuns = (p.quizRuns || 0) + 1;
    p.streakBest = Math.max(p.streakBest || 0, p.streakNow || 0);
    this._set(p);
  },
  bumpStreak(ok) { const p = this._get(); p.streakNow = ok ? (p.streakNow || 0) + 1 : 0; p.streakBest = Math.max(p.streakBest || 0, p.streakNow); this._set(p); },
  addXP(n, key) {
    const p = this._get();
    p.xp = (p.xp || 0) + n;
    if (key) { p.done = p.done || {}; p.done[key] = 1; }   // one-time credit per challenge
    this._set(p);
    if (typeof window !== 'undefined' && window._aegisXPtoast) window._aegisXPtoast(n);
    this._sync();
    return p.xp;
  },
  hasDone(key) { return !!(this._get().done || {})[key]; },
  xp() { return this._get().xp || 0; },
  wing() {   // flight-hours "wings" earned from XP (a fun second progression)
    const xp = this.xp();
    const tiers = [[0, 'Rookie'], [200, 'Bronze Wings'], [600, 'Silver Wings'],
                   [1400, 'Gold Wings'], [3000, 'Ace'], [6000, 'Double Ace'], [12000, 'Legend']];
    let t = tiers[0]; for (const x of tiers) if (xp >= x[0]) t = x;
    const next = tiers.find(x => x[0] > xp);
    return { name: t[1], xp, next: next ? next[0] : null };
  },
  stats() { const p = this._get(); return { read: Object.keys(p.read || {}).length, quizBest: p.quizBest || 0, quizTotal: p.quizTotal || 0, streakBest: p.streakBest || 0, runs: p.quizRuns || 0, xp: p.xp || 0 }; },
  rank(totalSections) {
    const s = this.stats();
    const readFrac = totalSections ? s.read / totalSections : 0;
    const quizFrac = s.quizTotal ? s.quizBest / s.quizTotal : 0;
    const pct = Math.round(100 * (0.6 * readFrac + 0.4 * quizFrac));
    const ladder = [
      [0, 'CADET', '▱'], [15, 'STUDENT PILOT', '▰'], [30, 'WINGMAN', '◈'],
      [50, 'ELEMENT LEAD', '◆'], [70, 'FLIGHT LEAD', '★'], [85, 'INSTRUCTOR PILOT', '✦'],
      [96, 'WEAPONS SCHOOL', '⚔'],
    ];
    let r = ladder[0];
    for (const l of ladder) if (pct >= l[0]) r = l;
    return { pct, name: r[1], icon: r[2] };
  },

  // ── total section count (set by help.js so achievements know the goal) ──
  total: 0,

  // ── sortie streak: consecutive calendar days you show up to train ──
  visit() {
    const p = this._get();
    const today = new Date().toISOString().slice(0, 10);
    if (p.lastVisit !== today) {
      const yday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
      p.streakDays = (p.lastVisit === yday) ? (p.streakDays || 0) + 1 : 1;
      p.lastVisit = today;
      p.streakDaysBest = Math.max(p.streakDaysBest || 0, p.streakDays);
      this._set(p);
    }
    this._sync();
    return this.sortie();
  },
  sortie() { const p = this._get(); return { days: p.streakDays || 0, best: p.streakDaysBest || 0 }; },

  // ── bookmark: flag where you are in the syllabus ──
  setBookmark(id) { const p = this._get(); p.bookmark = (p.bookmark === id ? null : id); this._set(p); return p.bookmark; },
  getBookmark() { return this._get().bookmark || null; },

  // ── wipe all learning progress (XP, medals, reads, streak, codex, bookmark) ──
  reset() { try { localStorage.removeItem('aegis_learn'); } catch (_) {} },

  // ── "used this tool" tracking → the Tinkerer medal ──
  touch(name) { const p = this._get(); p.touched = p.touched || {}; if (!p.touched[name]) { p.touched[name] = 1; this._set(p); this._sync(); } },
  touchedCount() { return Object.keys(this._get().touched || {}).length; },

  // ── decision-drill high score ──
  drillResult(score) { const p = this._get(); p.drillBest = Math.max(p.drillBest || 0, score); p.drillRuns = (p.drillRuns || 0) + 1; this._set(p); this._sync(); return p.drillBest; },
  drillBest() { return this._get().drillBest || 0; },

  // ── weapon-ID match: remember which weapons you've correctly identified ──
  matchWin(name) { const p = this._get(); p.match = p.match || {}; if (!p.match[name]) { p.match[name] = 1; this._set(p); this._sync(); } },
  matchCount() { return Object.keys(this._get().match || {}).length; },

  // ── weapon codex: cards you've studied (one-time +XP each) ──
  studyCard(id) { const p = this._get(); p.codex = p.codex || {}; if (!p.codex[id]) { p.codex[id] = 1; this._set(p); this.addXP(12, 'codex_' + id); } this._sync(); },
  studied(id) { return !!(this._get().codex || {})[id]; },
  codexCount() { return Object.keys(this._get().codex || {}).length; },

  challengesSolved() { const d = this._get().done || {}; return Object.keys(d).filter(k => k.startsWith('ch_')).length; },

  // ── achievements: earned set + toast the newly unlocked ──
  achievements() { return ACHIEVEMENTS.map(a => ({ id: a.id, icon: a.icon, name: a.name, desc: a.desc, got: !!a.test(this) })); },
  achievementCount() { return { got: ACHIEVEMENTS.filter(a => a.test(this)).length, total: ACHIEVEMENTS.length }; },
  _sync() {
    const p = this._get();
    p.ach = p.ach || {};
    const fresh = [];
    for (const a of ACHIEVEMENTS) if (a.test(this) && !p.ach[a.id]) { p.ach[a.id] = 1; fresh.push(a); }
    if (fresh.length) {
      this._set(p);
      if (typeof window !== 'undefined' && window._aegisAchToast) fresh.forEach(a => window._aegisAchToast(a));
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
//  6 · CHECK-RIDE QUIZ — categorised bank, streaks, rank progression
// ─────────────────────────────────────────────────────────────────────────────
const QUIZ = [
  // ── geometry / doctrine ──
  { c: 'GEOMETRY', q: 'A bandit presents 90° aspect and is fast. What is he doing, and what does it buy him?',
    a: ['Coming straight at you (hot) — max closure', 'Flying the beam — near-zero closure, hunting your Doppler notch', 'Running away cold — you\'re safe', 'Diving on you from above'],
    correct: 1, why: 'Beam aspect (~90°) means his velocity is perpendicular to your LOS, so his closing velocity ≈ 0 — he\'s trying to fall into your pulse-Doppler notch and disappear.' },
  { c: 'DOCTRINE', q: 'You\'re fired on from 60 km; your MAR at this altitude is 40 km. Best move?',
    a: ['Press straight in for your own shot', 'Immediately abort — turn cold and run', 'Hold heading and pop flares', 'Climb to gain energy'],
    correct: 1, why: 'You\'re outside MAR (40 km), so a timely abort defeats the shot kinematically — the missile runs out of energy chasing you. Inside MAR it would be too late to out-run it.' },
  { c: 'DOCTRINE', q: 'In the brevity of 4-ship BVR timelines, a "SKATE" game plan means…',
    a: ['Press to the visual merge regardless', 'Launch and leave: shoot, then be out (cold) at or before MAR', 'Never fire — sensor only', 'Fly the beam the whole way in'],
    correct: 1, why: 'SKATE = launch-and-leave: take the BVR shot, then abort out before entering the threat\'s MAR/NEZ. SHORT SKATE presses a bit closer before the out; BANZAI accepts the merge.' },
  { c: 'DOCTRINE', q: 'Your element aborts a shot at MAR. When is the recommit cue?',
    a: ['A fixed 30 s after the abort', 'When the threat missile is kinematically dead (energy-depleted), plus a margin', 'When the bandit turns cold too', 'Immediately after your RWR goes quiet'],
    correct: 1, why: 'You recommit when the shot chasing you is energy-dead — the Tactical Brief computes that time from the missile\'s actual coast-down. RWR silence alone doesn\'t mean the (active-seeker) missile is gone.' },
  { c: 'GEOMETRY', q: 'F-pole vs A-pole: which statement is right?',
    a: ['A-pole is your range from the target at YOUR missile\'s impact; F-pole at its pitbull', 'F-pole is at impact, A-pole at pitbull — bigger of both = safer shot', 'They are two names for the same range', 'Both measure the missile\'s range, not yours'],
    correct: 1, why: 'A-pole = shooter→target range when your missile goes active (you\'re free to maneuver); F-pole = shooter→target range at impact. Cranking grows both — that\'s the pole game.' },
  // ── guidance / missile ──
  { c: 'GUIDANCE', q: 'Raising the navigation constant N in Proportional Navigation…',
    a: ['Makes the missile fly straight at the target\'s current position', 'Nulls line-of-sight rotation sooner but amplifies seeker noise', 'Reduces the missile\'s turn rate', 'Only affects the boost phase'],
    correct: 1, why: 'a = N·Vc·λ̇. A higher N corrects LOS rotation harder and earlier (leads a maneuvering target better), but it also multiplies the seeker\'s angular noise into the command — a real trade.' },
  { c: 'GUIDANCE', q: 'The tell-tale sign of a collision course, and the whole basis of PN, is…',
    a: ['The target grows larger in the HUD', 'Constant bearing — the line-of-sight direction stops rotating', 'Closure rate reaching zero', 'The target\'s aspect going to 90°'],
    correct: 1, why: 'Constant bearing + decreasing range = collision. PN measures LOS rotation (λ̇) and drives it to zero; sailors have used the same rule to avoid collisions for centuries.' },
  { c: 'MISSILE', q: 'What most reliably extends a shot\'s no-escape zone against a reacting fighter?',
    a: ['A bigger warhead', 'A brighter seeker', 'More terminal energy — dual-pulse or ramjet keeping speed to the merge', 'A longer datalink'],
    correct: 2, why: 'The NEZ is an energy problem. A missile that arrives fast can still out-turn a last-ditch break; a coasting one can\'t. Dual-pulse and ramjet motors keep energy to the merge — that\'s why Meteor/PL-15 have huge NEZs.' },
  { c: 'MISSILE', q: 'A ramjet missile like Meteor flames out permanently if…',
    a: ['It flies above 20 km', 'It decelerates below its minimum operating Mach', 'It turns harder than 20 g', 'The datalink drops'],
    correct: 1, why: 'An air-breathing ducted rocket needs supersonic intake flow. Decelerate below ~M1.7 and the engine cannot run — or relight. Dragging a ramjet missile into thick, slow air is a real defeat mechanism.' },
  { c: 'MISSILE', q: 'A missile\'s thermal battery dying mid-flight means…',
    a: ['The seeker switches to backup power', 'Fins freeze, guidance stops — the round is a ballistic slug', 'Only the datalink is lost', 'The motor cuts off'],
    correct: 1, why: 'The one-shot thermal battery powers seeker, computer and fin actuators. When it\'s exhausted the missile can no longer steer at all — battery life is the hard ceiling on flight time, sized to the weapon\'s mission.' },
  { c: 'MISSILE', q: 'Why do long-range missiles loft high during midcourse?',
    a: ['To stay above the target\'s radar', 'Thin high air has a tenth the drag — coasting there can double the range', 'To cool the seeker', 'To arm the warhead'],
    correct: 1, why: 'Drag ∝ air density × V². Climbing into ~20-30 km air spends some energy once but saves far more over a long coast, then the dive converts altitude back to terminal speed.' },
  // ── radar / EW ──
  { c: 'RADAR', q: 'Radar detection range scales with target RCS as…',
    a: ['Linearly — 10× RCS = 10× range', 'As the square root', 'As the fourth root — 10,000× smaller RCS = 10× shorter detection', 'It doesn\'t depend on RCS'],
    correct: 2, why: 'The radar equation has R⁴ in the denominator, so R_detect ∝ σ^(1/4). That fourth root is why stealth works: an 0.0001 m² target is seen at ~1/10 the range of a 1 m² one, collapsing the enemy\'s timeline.' },
  { c: 'RADAR', q: 'A pulse-Doppler radar\'s clutter notch exists because…',
    a: ['The antenna can\'t look down', 'It must reject the enormous zero-Doppler ground return, and a beaming target falls into the same filter', 'Chaff jams the receiver', 'The radar runs out of power at short range'],
    correct: 1, why: 'Look-down radars filter returns near zero closing velocity to kill ground clutter. Beam the radar and your closure ≈ 0 — you\'re filtered out with the dirt. That\'s the notch.' },
  { c: 'EW', q: 'Burn-through range is…',
    a: ['Where the missile motor burns out', 'Where the real echo (∝1/R⁴) finally overpowers the jamming (∝1/R²) as range closes', 'The range a laser destroys the seeker', 'Where chaff stops blooming'],
    correct: 1, why: 'Skin return strengthens with R⁻⁴ but jamming only R⁻² (one-way), so closing range always favours the radar eventually. Inside burn-through, noise jamming stops protecting you.' },
  { c: 'EW', q: 'DRFM jammers are dangerous because they…',
    a: ['Transmit more raw power than anyone else', 'Record the radar\'s own pulse and replay believable false targets / walk the range gate off you (RGPO)', 'Physically blind the seeker head', 'Work even when switched off'],
    correct: 1, why: 'Digital RF Memory captures the victim radar\'s waveform and re-transmits it with controlled delay/Doppler — creating coherent phantoms and gate-pull-off deception that look real to the radar, unlike crude noise.' },
  { c: 'EW', q: 'The counter to a noise jammer that a modern missile can employ directly is…',
    a: ['Bigger fins', 'Home-on-jam — the jam strobe itself becomes the beacon it guides on', 'Flying slower', 'Turning off its seeker'],
    correct: 1, why: 'A jammer is a bright RF point source. HOJ mode lets the missile guide passively on the jamming itself — jam too loudly, too long, and you\'ve built the missile a lighthouse.' },
  { c: 'EW', q: 'Chaff is most effective when the target is…',
    a: ['Hot, head-on at high closure', 'In the notch — the chaff bloom decelerates fast and both fall near zero Doppler together', 'Directly above the radar', 'Supersonic and climbing'],
    correct: 1, why: 'Chaff blooms then rapidly slows to wind speed. Head-on, radar Doppler easily separates a 400 m/s jet from stationary chaff. In the beam, your Doppler is near zero too — the deception is coherent with your kinematics.' },
  { c: 'EW', q: 'Flares struggle against imaging-IR (IIR) seekers because…',
    a: ['Flares are too bright for them', 'An imaging seeker recognises the target\'s shape and trajectory — a point-source fireball with a falling, decelerating track is rejected', 'IIR seekers only see radar energy', 'Flares only work at night'],
    correct: 1, why: 'IIR seekers image the scene: spatial (shape/size), spectral (flare burns hotter/differently) and kinematic (flares decelerate and fall) discriminants reject classic flares — hence back-to-back modern flare programs + maneuver, and DIRCM lasers.' },
  // ── SAM / IADS ──
  { c: 'SAM/IADS', q: 'Why can a 400 km LRSAM fail to engage a jet only 50 km away at low level?',
    a: ['The missile is too fast to turn', 'The target is below the radar horizon — the radar can\'t see it', 'Low air is too thin for the motor', 'The warhead won\'t arm that close'],
    correct: 1, why: 'Radar is line-of-sight. A low flyer stays below the curved-earth horizon (a few tens of km for a ground radar) until close — unless an elevated sensor cues the shot over the horizon via datalink.' },
  { c: 'SAM/IADS', q: 'A vertically-launched SAM steers onto its intercept profile at low speed using…',
    a: ['Its fins, which work at any speed', 'Thrust-borne lift / TVC — lateral force from the motor while dynamic pressure is still tiny', 'The ground radar pushing it over', 'Gravity alone'],
    correct: 1, why: 'Off the rail there\'s no airflow for fins to bite. Tilting the thrust vector (jet vanes, TVC, or flying angle-of-attack under thrust) provides the pitch-over force — exactly what the sim\'s autopilot models.' },
  { c: 'SAM/IADS', q: 'An integrated air defence system (IADS) is layered because…',
    a: ['One big radar is illegal', 'Each layer covers another\'s weakness: EW radars cue, LRSAMs force you low, SHORAD kills what sneaks under', 'Missiles are cheaper in bulk', 'It looks better on parade'],
    correct: 1, why: 'The long-range layer denies altitude; flying under it puts you in gun/MANPADS/SHORAD range and terrain risk. The layers + netted sensors turn each system\'s blind spot into another\'s kill zone.' },
  { c: 'SAM/IADS', q: 'SEAD aircraft "wild weasel" tactics work by…',
    a: ['Outrunning every SAM', 'Baiting emitters to radiate, then attacking the radar (ARM/standoff) — forcing emission discipline that blinds the IADS', 'Jamming GPS', 'Flying higher than the missiles'],
    correct: 1, why: 'The duel is sensor vs anti-radiation: if the SAM radiates, it eats a HARM; if it stays silent, it\'s blind and the strike walks past. Decoys (MALD) inflate the picture and drain missiles.' },
  // ── WVR ──
  { c: 'WVR', q: 'Corner velocity is…',
    a: ['The fastest the jet can fly', 'The slowest speed at which you can pull maximum G — where turn rate peaks', 'The speed for minimum fuel burn', 'The landing speed'],
    correct: 1, why: 'Below corner speed you\'re lift-limited (can\'t reach max G); above it you\'re G-limited and the radius balloons. Best sustained turning happens near corner — the heart of the energy-vs-angles game.' },
  { c: 'WVR', q: 'Against a HOBS + helmet-sight equipped bandit, the classic advice is…',
    a: ['Always take the merge — skill decides', 'Avoid the merge: with 90°+ off-boresight shots, entering the visual arena is close to mutual death', 'Fly directly above him', 'Turn off your radar'],
    correct: 1, why: 'High-off-boresight IR missiles cued by helmet sights can be fired far off the nose in the first second of a merge — both fighters can usually generate a shot. Modern doctrine: win BVR, don\'t donate a merge.' },
];
reg('quiz', (node) => {
  const RUN = 8;   // questions per check-ride
  let deck = [], idx = 0, score = 0, answered = false, streak = 0;
  const wrap = el('div', { class: 'wx-quiz' });
  node.appendChild(wrap);
  function newDeck() {
    deck = [...QUIZ].sort(() => Math.random() - 0.5).slice(0, RUN);
    idx = 0; score = 0; streak = 0; answered = false;
    render();
  }
  function render() {
    const item = deck[idx];
    const st = progress.stats();
    wrap.innerHTML = '';
    wrap.appendChild(el('div', { class: 'wx-qmeta' },
      `Q ${idx + 1}/${RUN} · score ${score} · streak ${streak} · best ${st.quizBest}/${RUN} · best streak ${st.streakBest}`));
    wrap.appendChild(el('div', { class: 'wx-qcat' }, item.c));
    wrap.appendChild(el('div', { class: 'wx-q' }, item.q));
    const opts = el('div', { class: 'wx-opts' });
    item.a.forEach((txt, i) => opts.appendChild(el('button', { class: 'wx-opt', onclick: (e) => choose(i, opts) }, txt)));
    wrap.appendChild(opts);
    wrap.appendChild(el('div', { class: 'wx-why', id: 'wx-why' }));
  }
  function choose(i, opts) {
    if (answered) return;
    answered = true;
    const item = deck[idx];
    const ok = i === item.correct;
    [...opts.children].forEach((b, j) => {
      b.classList.add(j === item.correct ? 'correct' : (j === i ? 'wrong' : 'dim'));
      b.disabled = true;
    });
    if (ok) { score++; streak++; progress.addXP(10 + Math.min(streak - 1, 5) * 2); } else streak = 0;
    progress.bumpStreak(ok);
    const why = wrap.querySelector('#wx-why');
    why.innerHTML = `<b style="color:${ok ? COL.green : COL.red}">${ok ? '✓ Correct. +XP' : '✗ Not quite.'}</b> ${item.why}`;
    const last = idx === RUN - 1;
    if (last) { progress.quizResult(score, RUN); if (score === RUN) progress.addXP(50); }
    const next = el('button', { class: 'wx-btn', style: 'margin-top:10px',
      onclick: () => { answered = false; if (last) newDeck(); else { idx++; render(); } } },
      last ? `Finish — ${score}/${RUN} · ↻ new check-ride` : 'Next question →');
    why.appendChild(el('div', {}, next));
    if (last) {
      const verdict = score >= 7 ? 'WEAPONS-SCHOOL STANDARD. Outstanding.' : score >= 5 ? 'Solid — review the missed topics and refly.' : 'Back to the books, then refly the check-ride.';
      why.appendChild(el('div', { class: 'wx-line', style: 'margin-top:8px;color:' + (score >= 5 ? COL.green : COL.amber) },
        `Check-ride complete: ${score}/${RUN}. ${verdict} (Your rank on the Learn header updates with your best score and sections read.)`));
    }
  }
  newDeck();
  return () => {};
});

// ─────────────────────────────────────────────────────────────────────────────
//  7 · RADAR EQUATION EXPLORER — why stealth works
// ─────────────────────────────────────────────────────────────────────────────
reg('radareq', (node) => {
  const _V = makeCanvas(node, 240); const { cv, g, fit } = _V;
  const controls = el('div', { class: 'wx-controls' });
  node.appendChild(controls);
  const read = el('div', { class: 'wx-readout' });
  node.appendChild(read);
  let pwr = 50, rcsExp = 0.7;   // slider carries log10(σ); σ itself is never < 0
  // σ is an AREA — it can never be negative. The slider travels on a log scale
  // (10^-4 … 10^2 m²) but must always read out the real, positive value.
  const fmtRcs = (x) => {
    const v = 10 ** x;
    return (v < 0.01 ? v.toExponential(1) : v < 1 ? v.toFixed(3) : v.toFixed(1)) + ' m²';
  };
  const s1 = slider('Radar power (rel)', 10, 100, 5, pwr, v => { pwr = v; draw(); });
  const s2 = slider('Target RCS σ (log scale)', -4, 2, 0.1, rcsExp, v => { rcsExp = v; draw(); }, fmtRcs);
  controls.append(s1.row, s2.row);
  const R0 = 160;   // km detection at pwr 50 vs 5 m²
  function draw() {
    const rcs = 10 ** rcsExp;
    const rdet = R0 * ((pwr / 50) * (rcs / 5)) ** 0.25;
    g.clearRect(0, 0, _V.w, _V.h);
    const cx = 90, cy = _V.h / 2, pxPerKm = (_V.w - 140) / 220;
    // reference ring (5 m² fighter) and current ring
    ring(g, cx, cy, R0 * ((pwr / 50)) ** 0.25 * pxPerKm, 'rgba(147,172,203,.35)', '5 m² ref');
    ring(g, cx, cy, rdet * pxPerKm, COL.amber, null, true);
    g.fillStyle = COL.blue; g.shadowColor = COL.blue; g.shadowBlur = 8;
    g.beginPath(); g.arc(cx, cy, 5, 0, 7); g.fill(); g.shadowBlur = 0;
    g.fillStyle = COL.blue; g.font = '9px "JetBrains Mono"'; g.fillText('RADAR', cx - 16, cy + 18);
    // targets legend
    const cls = rcs <= 0.001 ? ['VLO STEALTH (F-22 class)', COL.green]
      : rcs <= 0.1 ? ['LO / reduced (F-35, Rafale-class front)', COL.green]
      : rcs <= 6 ? ['FIGHTER', COL.amber] : ['BOMBER / TANKER', COL.red];
    const rel = rdet / R0;
    read.innerHTML =
      `<div class="wx-line">σ = <b style="color:${COL.amber}">${rcs < 0.01 ? rcs.toExponential(1) : R(rcs, 2)} m²</b> (${cls[0]})` +
      ` &nbsp;→&nbsp; detection range <b style="color:${COL.amber}">${R(rdet)} km</b>` +
      ` <span style="color:${COL.dim}">(${rel >= 1 ? R(rel, 2) + '×' : '1/' + R(1 / rel, 1) + '×'} the 5 m² reference)</span></div>` +
      `<div class="wx-hint">R<sub>detect</sub> ∝ (P·σ)<sup>¼</sup> — the brutal fourth root. Cutting RCS from 5 m² to ` +
      `0.0005 m² (10,000×) only shrinks detection 10× — but that 10× collapses the enemy's entire timeline: he detects, sorts and ` +
      `shoots you a hundred kilometres later than you shoot him. Notice power is also under the fourth root: doubling radar ` +
      `power buys only 19% more range. Stealth beats wattage. <b>σ is an area, so it is never negative</b> — the slider runs on a ` +
      `log scale from 0.0001 m² (a bird, or a VLO fighter head-on) to 100 m² (a bomber broadside).</div>`;
  }
  function ring(g, x, y, r, color, label, glow) {
    g.strokeStyle = color; g.lineWidth = glow ? 2 : 1.2;
    if (glow) { g.shadowColor = color; g.shadowBlur = 8; }
    g.beginPath(); g.arc(x, y, Math.max(r, 4), 0, 7); g.stroke(); g.shadowBlur = 0;
    if (label) { g.fillStyle = color; g.font = '9px "JetBrains Mono"'; g.fillText(label, x + Math.max(r, 4) * 0.72, y - Math.max(r, 4) * 0.72); }
  }
  _V.redraw = draw;
  const onResize = () => { fit(); draw(); };
  window.addEventListener('resize', onResize);
  draw();
  return () => window.removeEventListener('resize', onResize);
});

// ─────────────────────────────────────────────────────────────────────────────
//  8 · JAMMING — J/S RATIO & BURN-THROUGH
// ─────────────────────────────────────────────────────────────────────────────
reg('jammer', (node) => {
  const _V = makeCanvas(node, 260); const { cv, g, fit } = _V;
  const controls = el('div', { class: 'wx-controls' });
  node.appendChild(controls);
  const read = el('div', { class: 'wx-readout' });
  node.appendChild(read);
  let erp = 40, rcsExp = 0.7, rng = 80;   // jammer power, rcs exp, current range km
  const s1 = slider('Jammer power ERP (rel)', 5, 100, 5, erp, v => { erp = v; draw(); });
  const s2 = slider('Your RCS 10^x m²', -3, 1.5, 0.1, rcsExp, v => { rcsExp = v; draw(); });
  const s3 = slider('Range to radar (km)', 5, 150, 1, rng, v => { rng = v; draw(); });
  controls.append(s1.row, s2.row, s3.row);
  function draw() {
    const rcs = 10 ** rcsExp;
    // relative received powers at the radar: skin ∝ σ/R⁴ ; jam ∝ ERP/R²
    const skin = (R_) => 3e7 * rcs / R_ ** 4;
    const jam = (R_) => 12 * erp / R_ ** 2;
    const rBT = Math.sqrt(Math.sqrt(3e7 * rcs / (12 * erp)) ** 2);   // where skin = jam → R² = σk/ERPk
    const rBurn = Math.sqrt(3e7 * rcs / (12 * erp)) ** 0.5 * 1;      // solve R^2 = 3e7σ/(12·ERP) → R = (…)^(1/2)
    const rbt = Math.sqrt(3e7 * rcs / (12 * erp));
    const RBT = Math.sqrt(rbt);
    g.clearRect(0, 0, _V.w, _V.h);
    const padL = 46, padB = 24, x0 = padL, x1 = _V.w - 14, y0 = 16, y1 = _V.h - padB;
    const X = (km) => x0 + ((km - 5) / 145) * (x1 - x0);
    const Y = (db) => y1 - ((db + 40) / 110) * (y1 - y0);   // dB scale -40..70
    const dB = (v) => 10 * Math.log10(Math.max(v, 1e-9));
    // axes + grid
    g.strokeStyle = COL.grid; g.lineWidth = 1; g.font = '9px "JetBrains Mono"'; g.fillStyle = COL.faint;
    for (let d = -40; d <= 70; d += 20) { g.beginPath(); g.moveTo(x0, Y(d)); g.lineTo(x1, Y(d)); g.stroke(); g.fillText(d + 'dB', 6, Y(d) + 3); }
    for (let km = 25; km <= 150; km += 25) { g.fillText(km + '', X(km) - 8, _V.h - 8); }
    // curves
    curve(g, X, Y, dB, skin, COL.amber); curve(g, X, Y, dB, jam, COL.red);
    g.fillStyle = COL.amber; g.fillText('SKIN ECHO ∝ σ/R⁴', x0 + 8, Y(dB(skin(140))) - 18);
    g.fillStyle = COL.red; g.fillText('JAMMING ∝ ERP/R²', x1 - 130, Y(dB(jam(140))) - 8);
    // burn-through marker
    if (RBT > 5 && RBT < 150) {
      g.strokeStyle = COL.green; g.setLineDash([4, 4]); g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(X(RBT), y0); g.lineTo(X(RBT), y1); g.stroke(); g.setLineDash([]);
      g.fillStyle = COL.green; g.fillText('BURN-THROUGH', X(RBT) - 34, y0 + 10);
    }
    // current range marker
    const jammed = jam(rng) > skin(rng);
    g.strokeStyle = COL.ink; g.lineWidth = 2;
    g.beginPath(); g.moveTo(X(rng), y0); g.lineTo(X(rng), y1); g.stroke();
    const js = dB(jam(rng)) - dB(skin(rng));
    read.innerHTML =
      `<div class="wx-line">J/S at ${R(rng)} km: <b style="color:${COL.amber}">${R(js, 1)} dB</b> · burn-through ≈ ` +
      `<b style="color:${COL.green}">${RBT < 5 ? '&lt;5' : RBT > 150 ? '&gt;150' : R(RBT)} km</b></div>` +
      `<div class="wx-big" style="color:${jammed ? COL.red : COL.green}">${jammed ? 'RADAR JAMMED (J > S)' : 'BURNED THROUGH (S > J)'}</div>` +
      `<div class="wx-hint">Your skin echo makes a two-way trip (∝1/R⁴); the jammer's noise only one way (∝1/R²). ` +
      `Closing range therefore always favours the radar — the crossover is <b>burn-through</b>. Bigger RCS moves it out ` +
      `(more to hide), more jammer power moves it in. This is why noise jamming buys <i>time and ambiguity</i>, never immunity — ` +
      `and why a jammer that keeps radiating inside burn-through has become a <b>home-on-jam beacon</b>.</div>`;
  }
  function curve(g, X, Y, dB, f, color) {
    g.strokeStyle = color; g.lineWidth = 2; g.shadowColor = color; g.shadowBlur = 5; g.beginPath();
    for (let km = 5; km <= 150; km += 2) { const x = X(km), y = Y(dB(f(km))); km === 5 ? g.moveTo(x, y) : g.lineTo(x, y); }
    g.stroke(); g.shadowBlur = 0;
  }
  _V.redraw = draw;
  const onResize = () => { fit(); draw(); };
  window.addEventListener('resize', onResize);
  draw();
  return () => window.removeEventListener('resize', onResize);
});

// ─────────────────────────────────────────────────────────────────────────────
//  9 · FLARE FIGHT — dispense-timing mini-game
// ─────────────────────────────────────────────────────────────────────────────
reg('flarefight', (node) => {
  const _V = makeCanvas(node, 260); const { cv, g, fit } = _V;
  const controls = el('div', { class: 'wx-controls' });
  node.appendChild(controls);
  const read = el('div', { class: 'wx-readout' });
  node.appendChild(read);
  let seekerType = 'ir', state;
  const sel = el('select', { class: 'wx-sel', onchange: (e) => { seekerType = e.target.value; reset(); } }, [
    el('option', { value: 'ir' }, 'IR seeker (AIM-9M class)'),
    el('option', { value: 'iir' }, 'Imaging IR (AIM-9X / IRIS-T class)')]);
  const dispenseBtn = el('button', { class: 'wx-btn', onclick: () => dispense() }, '☀ DISPENSE ×2 (8 carried)');
  const resetBtn = el('button', { class: 'wx-btn', onclick: () => reset() }, '↻ New attack');
  controls.append(el('label', { class: 'wx-chk' }, [el('span', {}, 'Threat: '), sel]), dispenseBtn, resetBtn);
  function reset() {
    state = { t: 0, msl: { x: 30, y: 60 }, jet: { x: _V.w - 60, y: _V.h / 2 }, flares: [],
              flaresLeft: 8, tracking: 'jet', done: false, result: null,
              wins: state ? state.wins : 0, tries: state ? state.tries : 0 };
    dispenseBtn.disabled = false;
    updateBtn();
  }
  function updateBtn() { dispenseBtn.textContent = `☀ DISPENSE ×2 (${state.flaresLeft} carried)`; }
  function dispense() {
    if (state.done || state.flaresLeft <= 0) return;
    for (let k = 0; k < 2 && state.flaresLeft > 0; k++) {
      state.flaresLeft--;
      const f = { x: state.jet.x - 8, y: state.jet.y + 4, vx: -40 - 30 * Math.random(), vy: 30 + 40 * Math.random(), age: 0 };
      state.flares.push(f);
      // seduction check at release: distance-weighted
      const p = seekerType === 'ir' ? 0.42 : 0.07;
      if (state.tracking === 'jet' && Math.random() < p) state.tracking = f;
    }
    updateBtn();
  }
  reset();
  let last = performance.now();
  const stop = frame((now) => {
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    step(dt); render();
  });
  function step(dt) {
    if (state.done) return;
    state.t += dt;
    // jet flies gentle weave
    state.jet.y = _V.h / 2 + Math.sin(state.t * 1.2) * 34;
    // flares fall & decelerate & burn out
    state.flares.forEach(f => { f.age += dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 0.985; f.vy += 25 * dt; });
    state.flares = state.flares.filter(f => f.age < 4.2);
    if (state.tracking !== 'jet' && (!state.flares.includes(state.tracking))) {
      // flare burned out: IIR re-acquires jet almost always, IR sometimes stays lost then re-locks
      state.tracking = 'jet';
    }
    // missile homes on whatever it tracks (simple pursuit for the demo)
    const tgt = state.tracking === 'jet' ? state.jet : state.tracking;
    const dx = tgt.x - state.msl.x, dy = tgt.y - state.msl.y, d = Math.hypot(dx, dy) || 1;
    const sp = 150;
    state.msl.x += sp * dx / d * dt * 1.6; state.msl.y += sp * dy / d * dt * 1.6;
    // outcomes
    if (Math.hypot(state.jet.x - state.msl.x, state.jet.y - state.msl.y) < 13) {
      state.done = true; state.result = 'HIT'; state.tries++;
    } else if (state.tracking !== 'jet' && Math.hypot(tgt.x - state.msl.x, tgt.y - state.msl.y) < 10) {
      state.done = true; state.result = 'DECOYED'; state.wins++; state.tries++;
    } else if (state.msl.x > _V.w + 20) {
      state.done = true; state.result = 'MISSED'; state.wins++; state.tries++;
    }
  }
  function render() {
    g.clearRect(0, 0, _V.w, _V.h);
    // jet
    drawJet(g, state.jet.x, state.jet.y, Math.PI / 2, COL.blue, 'YOU');
    // flares
    state.flares.forEach(f => {
      const a = Math.max(0, 1 - f.age / 4.2);
      g.fillStyle = `rgba(255,${140 + 60 * a},40,${0.5 + 0.5 * a})`; g.shadowColor = '#ffb000'; g.shadowBlur = 10 * a;
      g.beginPath(); g.arc(f.x, f.y, 3 + 2 * a, 0, 7); g.fill(); g.shadowBlur = 0;
    });
    // missile + track line
    const tgt = state.tracking === 'jet' ? state.jet : state.tracking;
    g.strokeStyle = state.tracking === 'jet' ? 'rgba(255,61,0,.5)' : 'rgba(255,176,0,.6)';
    g.setLineDash([4, 4]); g.beginPath(); g.moveTo(state.msl.x, state.msl.y); g.lineTo(tgt.x, tgt.y); g.stroke(); g.setLineDash([]);
    dot(g, state.msl.x, state.msl.y, COL.red, 'MSL');
    g.fillStyle = COL.faint; g.font = '9px "JetBrains Mono"';
    g.fillText(`seeker: ${seekerType.toUpperCase()} · tracking: ${state.tracking === 'jet' ? 'YOU' : 'FLARE'}`, 12, 16);
    if (state.done) {
      const win = state.result !== 'HIT';
      g.fillStyle = win ? COL.green : COL.red; g.font = 'bold 18px "JetBrains Mono"';
      g.fillText(state.result === 'HIT' ? '✗ HIT — you\'re dead' : state.result === 'DECOYED' ? '✓ SEEKER TOOK THE FLARE' : '✓ MISSED', _V.w / 2 - 90, _V.h / 2);
    }
    read.innerHTML =
      `<div class="wx-line">Survived <b style="color:${COL.green}">${state.wins}</b> of <b>${state.tries}</b> attacks</div>` +
      `<div class="wx-hint">Time your flares: each pair has a chance to seduce the seeker <i>while it can see them near you</i> — ` +
      `dispense too early and they burn out before the endgame; too late and the missile is inside your miss distance. ` +
      `Switch to the <b>imaging-IR</b> threat and feel the difference: shape/kinematic discrimination rejects almost every flare — ` +
      `against modern IIR your real defences are pre-emptive programs, hard maneuver at the right second, and DIRCM.</div>`;
  }
  const onResize = () => { fit(); };
  window.addEventListener('resize', onResize);
  return () => { stop(); window.removeEventListener('resize', onResize); };
});

// ─────────────────────────────────────────────────────────────────────────────
//  10 · DOGHOUSE — turn rate / radius vs speed (corner velocity)
// ─────────────────────────────────────────────────────────────────────────────
reg('doghouse', (node) => {
  const _V = makeCanvas(node, 260); const { cv, g, fit } = _V;
  const controls = el('div', { class: 'wx-controls' });
  node.appendChild(controls);
  const read = el('div', { class: 'wx-readout' });
  node.appendChild(read);
  let spd = 200, gmax = 9;
  const s1 = slider('Your speed (m/s)', 80, 420, 5, spd, v => { spd = v; draw(); });
  const s2 = slider('G limit', 4, 12, 0.5, gmax, v => { gmax = v; draw(); });
  controls.append(s1.row, s2.row);
  const G0 = 9.80665, VCORN = (gm) => 120 * Math.sqrt(gm / 9);   // stall-limited: n = (V/Vs)², Vs≈40·..; corner where n=gmax
  function nAvail(v, gm) { const vs = 62; return Math.min(gm, (v / vs) ** 2); }
  function rate(v, gm) { const n = nAvail(v, gm); return n <= 1 ? 0 : G0 * Math.sqrt(n * n - 1) / v * 180 / Math.PI; }
  function radius(v, gm) { const n = nAvail(v, gm); return n <= 1 ? Infinity : v * v / (G0 * Math.sqrt(n * n - 1)); }
  function draw() {
    g.clearRect(0, 0, _V.w, _V.h);
    const x0 = 46, x1 = _V.w - 14, y0 = 14, y1 = _V.h - 26;
    const X = (v) => x0 + ((v - 80) / 340) * (x1 - x0);
    const maxRate = 28;
    const Y = (r) => y1 - (r / maxRate) * (y1 - y0);
    g.strokeStyle = COL.grid; g.font = '9px "JetBrains Mono"'; g.fillStyle = COL.faint;
    for (let r = 0; r <= maxRate; r += 7) { g.beginPath(); g.moveTo(x0, Y(r)); g.lineTo(x1, Y(r)); g.stroke(); g.fillText(r + '°/s', 6, Y(r) + 3); }
    for (let v = 100; v <= 400; v += 100) g.fillText(v + '', X(v) - 10, _V.h - 8);
    // the doghouse top: rate vs speed
    g.strokeStyle = COL.blue; g.lineWidth = 2; g.shadowColor = COL.blue; g.shadowBlur = 5; g.beginPath();
    for (let v = 80; v <= 420; v += 4) { const x = X(v), y = Y(rate(v, gmax)); v === 80 ? g.moveTo(x, y) : g.lineTo(x, y); }
    g.stroke(); g.shadowBlur = 0;
    // corner velocity marker (peak of the curve)
    let vc = 80, best = 0;
    for (let v = 80; v <= 420; v += 2) { const r = rate(v, gmax); if (r > best) { best = r; vc = v; } }
    g.strokeStyle = COL.green; g.setLineDash([4, 4]);
    g.beginPath(); g.moveTo(X(vc), y0); g.lineTo(X(vc), y1); g.stroke(); g.setLineDash([]);
    g.fillStyle = COL.green; g.fillText('CORNER ' + vc + ' m/s', X(vc) - 30, y0 + 10);
    // your point
    const yr = rate(spd, gmax), yd = radius(spd, gmax);
    g.fillStyle = COL.amber; g.shadowColor = COL.amber; g.shadowBlur = 8;
    g.beginPath(); g.arc(X(spd), Y(yr), 5, 0, 7); g.fill(); g.shadowBlur = 0;
    const region = spd < vc - 8 ? ['LIFT-LIMITED', 'below corner: pulling to the buffet, can\'t reach max G — rate AND radius both suffer']
      : spd > vc + 8 ? ['G-LIMITED', 'above corner: you have the G but the radius balloons with V² — you turn like a bus']
      : ['AT CORNER', 'maximum instantaneous turn rate — the knife-fight speed'];
    read.innerHTML =
      `<div class="wx-line">At <b style="color:${COL.amber}">${spd} m/s</b>: turn rate <b style="color:${COL.blue}">${R(yr, 1)}°/s</b>, ` +
      `radius <b style="color:${COL.blue}">${yd === Infinity ? '∞' : R(yd) + ' m'}</b> — <b style="color:${COL.green}">${region[0]}</b></div>` +
      `<div class="wx-hint">${region[1]}. Rate ω = g·√(n²−1)/V and radius R = V²/(g·√(n²−1)) — the two sides of every dogfight ` +
      `decision. Energy fighters (fast wings, thrust) fight in the G-limited region and dictate range; angles fighters slow toward ` +
      `corner to point first. Missiles obey the same math — which is why arriving fast (dual-pulse/ramjet) at the endgame matters.</div>`;
  }
  _V.redraw = draw;
  const onResize = () => { fit(); draw(); };
  window.addEventListener('resize', onResize);
  draw();
  return () => window.removeEventListener('resize', onResize);
});

// ─────────────────────────────────────────────────────────────────────────────
//  11 · MOTOR RACE — boost-sustain vs dual-pulse vs ramjet Mach profiles
// ─────────────────────────────────────────────────────────────────────────────
reg('motorrace', (node) => {
  const _V = makeCanvas(node, 250); const { cv, g, fit } = _V;
  const read = el('div', { class: 'wx-readout' });
  node.appendChild(read);
  // hand-shaped but physics-faithful Mach(t) profiles over an 80 s / ~80 km shot
  const T = 80;
  const prof = {
    'BOOST-SUSTAIN': { c: COL.amber, f: (t) => t < 3 ? 1 + t : t < 10 ? 4 + 0.05 * (t - 3) : Math.max(0.8, 4.3 - 0.055 * (t - 10) - 0.0006 * (t - 10) ** 2) },
    'DUAL-PULSE': { c: COL.green, f: (t) => t < 3 ? 1 + t : t < 22 ? Math.max(1.6, 4 - 0.07 * (t - 3)) : t < 27 ? 2.7 + 0.34 * (t - 22) : Math.max(1.0, 4.4 - 0.05 * (t - 27)) },
    'RAMJET': { c: COL.blue, f: (t) => t < 2 ? 1 + 0.9 * t : t < 5 ? 2.8 + 0.3 * (t - 2) : t < 60 ? 3.7 : Math.max(0.9, 3.7 - 0.06 * (t - 60)) },
  };
  let t = 0, last = performance.now();
  const stop = frame((now) => {
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    t = (t + dt * 8) % (T + 12);
    draw();
  });
  function draw() {
    g.clearRect(0, 0, _V.w, _V.h);
    const x0 = 44, x1 = _V.w - 12, y0 = 14, y1 = _V.h - 24;
    const X = (tt) => x0 + (tt / T) * (x1 - x0);
    const Y = (m) => y1 - (m / 5) * (y1 - y0);
    g.strokeStyle = COL.grid; g.font = '9px "JetBrains Mono"'; g.fillStyle = COL.faint;
    for (let m = 0; m <= 5; m++) { g.beginPath(); g.moveTo(x0, Y(m)); g.lineTo(x1, Y(m)); g.stroke(); g.fillText('M' + m, 8, Y(m) + 3); }
    for (let s = 0; s <= T; s += 20) g.fillText(s + 's', X(s) - 8, _V.h - 8);
    const tNow = Math.min(t, T);
    let iy = 16;
    for (const [name, p] of Object.entries(prof)) {
      g.strokeStyle = p.c; g.lineWidth = 2; g.shadowColor = p.c; g.shadowBlur = 4; g.beginPath();
      for (let s = 0; s <= tNow; s += 0.6) { const x = X(s), y = Y(p.f(s)); s === 0 ? g.moveTo(x, y) : g.lineTo(x, y); }
      g.stroke(); g.shadowBlur = 0;
      g.fillStyle = p.c; g.beginPath(); g.arc(X(tNow), Y(p.f(tNow)), 3.5, 0, 7); g.fill();
      g.fillText(name, x1 - 96, iy); iy += 12;
    }
    // playhead + endgame shading
    g.fillStyle = 'rgba(255,61,0,.08)'; g.fillRect(X(60), y0, x1 - X(60), y1 - y0);
    g.fillStyle = COL.red; g.fillText('ENDGAME', X(62), y0 + 10);
  }
  read.innerHTML =
    `<div class="wx-hint">The same shot, three motors. <b style="color:${COL.amber}">Boost-sustain</b> peaks early then bleeds for a ` +
    `minute — a defender just waits it out. <b style="color:${COL.green}">Dual-pulse</b> saves a grain and re-lights right before the ` +
    `endgame (the second hump) — energy exactly when the terminal fight starts. <b style="color:${COL.blue}">Ramjet</b> throttles ` +
    `fuel to hold cruise Mach the whole way — still under power in the red endgame band, the biggest no-escape zone of all. ` +
    `Fire the PL-15 and Meteor in the sim and find these exact shapes on the Mach chart.</div>`;
  const onResize = () => { fit(); };
  window.addEventListener('resize', onResize);
  return () => { stop(); window.removeEventListener('resize', onResize); };
});

// ─────────────────────────────────────────────────────────────────────────────
//  12 · LAYERED IADS vs INGRESS ALTITUDE
// ─────────────────────────────────────────────────────────────────────────────
reg('iads', (node) => {
  const _V = makeCanvas(node, 280); const { cv, g, fit } = _V;
  const controls = el('div', { class: 'wx-controls' });
  node.appendChild(controls);
  const read = el('div', { class: 'wx-readout' });
  node.appendChild(read);
  let alt = 6000;
  const s1 = slider('Your ingress altitude (m)', 30, 12000, 30, alt, v => { alt = v; draw(); });
  controls.append(s1.row);
  const LAYERS = [
    { name: 'EW / SURVEILLANCE RADAR', nom: 400, h: 40, c: 'rgba(147,172,203,.5)' },
    { name: 'LRSAM (40N6/48N6 class)', nom: 250, h: 30, c: COL.red },
    { name: 'MRSAM (9M96/PAC-3 class)', nom: 100, h: 25, c: COL.amber },
    { name: 'SHORAD (Tor/gun class)', nom: 15, h: 12, c: COL.green },
  ];
  const horizon = (h1, h2) => 4.12 * (Math.sqrt(Math.max(h1, 0)) + Math.sqrt(Math.max(h2, 0)));
  function draw() {
    g.clearRect(0, 0, _V.w, _V.h);
    const cx = _V.w / 2, cy = _V.h / 2 + 10, pxPerKm = Math.min(_V.w, 2 * (_V.h - 40)) / 2 / 420;
    let rows = [];
    LAYERS.forEach((L, i) => {
      const eff = Math.min(L.nom, horizon(L.h, alt));
      rows.push({ ...L, eff });
      // nominal (ghost) + effective ring
      g.strokeStyle = 'rgba(147,172,203,.18)'; g.lineWidth = 1; g.setLineDash([3, 5]);
      g.beginPath(); g.arc(cx, cy, L.nom * pxPerKm, 0, 7); g.stroke(); g.setLineDash([]);
      g.strokeStyle = L.c; g.lineWidth = i === 0 ? 1.2 : 2;
      if (i > 0) { g.shadowColor = L.c; g.shadowBlur = 6; }
      g.beginPath(); g.arc(cx, cy, Math.max(eff * pxPerKm, 3), 0, 7); g.stroke(); g.shadowBlur = 0;
    });
    g.fillStyle = COL.red; g.beginPath(); g.arc(cx, cy, 4, 0, 7); g.fill();
    g.fillStyle = COL.faint; g.font = '9px "JetBrains Mono"'; g.fillText('SAM COMPLEX', cx + 8, cy + 3);
    const list = rows.map(r =>
      `<div class="wx-line" style="display:flex;justify-content:space-between"><span style="color:${r.c}">${r.name}</span>` +
      `<span>nominal <b>${r.nom}</b> km → at your altitude <b style="color:${r.eff < r.nom * 0.5 ? COL.green : COL.amber}">${R(r.eff)}</b> km</span></div>`).join('');
    read.innerHTML = list +
      `<div class="wx-hint">Dashed rings are brochure ranges; glowing rings are what the radar horizon actually allows against ` +
      `you at ${R(alt)} m. Fly low and the giant rings collapse — but notice what's waiting under them: the SHORAD ring barely ` +
      `shrinks, terrain and guns join in, and you've traded missile risk for a knife-fight at 100 ft. That trade — and elevated ` +
      `sensors (AWACS, aerostats) restoring the big rings — is the entire game of strike planning against an IADS.</div>`;
  }
  _V.redraw = draw;
  const onResize = () => { fit(); draw(); };
  window.addEventListener('resize', onResize);
  draw();
  return () => window.removeEventListener('resize', onResize);
});

// ─────────────────────────────────────────────────────────────────────────────
//  13 · BVR TIMELINE PLAYER — the engagement sequence, animated & scrubbable
// ─────────────────────────────────────────────────────────────────────────────
reg('timeline_play', (node) => {
  const _V = makeCanvas(node, 200); const { cv, g, fit } = _V;
  const controls = el('div', { class: 'wx-controls' });
  node.appendChild(controls);
  const read = el('div', { class: 'wx-readout' });
  node.appendChild(read);
  // events keyed to shooter→target range (km), inbound (range shrinks left→right)
  const EV = [
    { r: 80, t: 'COMMIT', c: COL.blue, d: 'Decide to fight — lock the picture, sort who takes whom.' },
    { r: 65, t: 'FOX-3 (launch)', c: COL.amber, d: 'Active-radar missile away; it flies midcourse on your datalink.' },
    { r: 52, t: 'CRANK', c: COL.green, d: 'Turn to the gimbal edge — keep guiding while opening range.' },
    { r: 30, t: 'PITBULL', c: COL.red, d: 'Missile seeker active — it homes on its own. You are free (A-pole).' },
    { r: 24, t: 'MAR — ABORT?', c: COL.amber, d: 'Your abort line: turn cold now or accept the merge.' },
    { r: 8, t: 'MERGE', c: COL.red, d: 'Visual arena — WVR rules, HOBS shots, the vertical.' },
  ];
  let play = true, rng = 90, dir = -1;
  const btn = el('button', { class: 'wx-btn', onclick: () => { play = !play; btn.textContent = play ? '❚❚ Pause' : '▶ Play'; } }, '❚❚ Pause');
  const s1 = slider('Range to bandit (km)', 4, 90, 1, rng, v => { rng = v; play = false; btn.textContent = '▶ Play'; draw(); });
  controls.append(btn, s1.row);
  let last = performance.now();
  const stop = frame((now) => {
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    if (play) { rng += dir * 14 * dt; if (rng <= 4) { rng = 90; } s1.input.value = rng; s1.out.textContent = Math.round(rng); }
    draw();
  });
  function draw() {
    g.clearRect(0, 0, _V.w, _V.h);
    const x0 = 20, x1 = _V.w - 20, y = 96;
    const X = (r) => x1 - (r / 90) * (x1 - x0);     // far left, close right
    // baseline
    g.strokeStyle = COL.grid; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke();
    g.fillStyle = COL.faint; g.font = '9px "JetBrains Mono"';
    g.fillText('90 km', x0 - 4, y + 26); g.fillText('MERGE', x1 - 30, y + 26);
    // zones: NEZ shading inside MAR
    g.fillStyle = 'rgba(255,61,0,.08)'; g.fillRect(X(24), y - 30, X(0) - X(24), 60);
    // event ticks
    EV.forEach(e => {
      const x = X(e.r), passed = rng <= e.r;
      g.strokeStyle = e.c; g.globalAlpha = passed ? 1 : 0.4; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x, y - 14); g.lineTo(x, y + 14); g.stroke();
      g.fillStyle = e.c; g.save(); g.translate(x, y - 20); g.rotate(-Math.PI / 5);
      g.font = '8.5px "JetBrains Mono"'; g.fillText(e.t, 0, 0); g.restore();
      g.globalAlpha = 1;
    });
    // playhead (your jet closing)
    const px = X(rng);
    g.fillStyle = COL.ink; g.shadowColor = COL.ink; g.shadowBlur = 8;
    g.beginPath(); g.moveTo(px, y + 16); g.lineTo(px - 5, y + 26); g.lineTo(px + 5, y + 26); g.closePath(); g.fill(); g.shadowBlur = 0;
    // current phase
    let cur = EV[0];
    for (const e of EV) if (rng <= e.r) cur = e;
    read.innerHTML =
      `<div class="wx-big" style="color:${cur.c}">${Math.round(rng)} km — ${cur.t}</div>` +
      `<div class="wx-line">${cur.d}</div>` +
      `<div class="wx-hint">This is the BVR <b>timeline</b>: a scripted sequence of decision ranges, each a one-word radio ` +
      `call so a four-ship fights as one brain. Scrub the range and watch the game plan unfold. The red band is the no-escape ` +
      `zone inside <b>MAR</b> — a SKATE game plan keeps you left of it; BANZAI accepts the merge. Numbers like these come from ` +
      `the <a data-goto="mar">Tactical-AI kneeboard</a> for your exact weapon.</div>`;
  }
  const onResize = () => { fit(); };
  window.addEventListener('resize', onResize);
  return () => { stop(); window.removeEventListener('resize', onResize); };
});

// ─────────────────────────────────────────────────────────────────────────────
//  14 · KILL-CHAIN RACE — F2T2EA / OODA, "who finishes first wins"
// ─────────────────────────────────────────────────────────────────────────────
reg('killchain', (node) => {
  const _V = makeCanvas(node, 220); const { cv, g, fit } = _V;
  const controls = el('div', { class: 'wx-controls' });
  node.appendChild(controls);
  const read = el('div', { class: 'wx-readout' });
  node.appendChild(read);
  const STEPS = ['DETECT', 'TRACK', 'IDENTIFY', 'ENGAGE', 'LAUNCH'];
  let blueRcs = 0.01, redRcs = 5, running = true;
  const s1 = slider('YOUR RCS 10^x m²', -4, 1, 0.2, Math.log10(blueRcs), v => { blueRcs = 10 ** v; reset(); });
  const s2 = slider('THEIR RCS 10^x m²', -4, 1, 0.2, Math.log10(redRcs), v => { redRcs = 10 ** v; reset(); });
  const btn = el('button', { class: 'wx-btn', onclick: () => reset() }, '↻ Race again');
  controls.append(s1.row, s2.row, btn);
  let blue, red, t0, winner;
  function reset() {
    // detection range ∝ σ^0.25 ; the side that detects first gets a head start
    const bDet = 200 * (redRcs / 5) ** 0.25;   // YOU detect THEM (their rcs)
    const rDet = 200 * (blueRcs / 5) ** 0.25;  // THEY detect YOU (your rcs)
    // closure ~ constant; time-to-complete-chain ∝ 1/detection-lead
    blue = { prog: 0, rate: 0.10 * (bDet / 120), det: bDet };
    red = { prog: 0, rate: 0.10 * (rDet / 120), det: rDet };
    t0 = performance.now(); winner = null;
  }
  reset();
  let last = performance.now();
  const stop = frame((now) => {
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    if (!winner) {
      blue.prog = Math.min(1, blue.prog + blue.rate * dt);
      red.prog = Math.min(1, red.prog + red.rate * dt);
      if (blue.prog >= 1) winner = 'BLUE';
      else if (red.prog >= 1) winner = 'RED';
    }
    draw();
  });
  function bar(y, prog, color, label, det) {
    const x0 = 90, x1 = _V.w - 20, w = x1 - x0;
    g.fillStyle = COL.faint; g.font = '10px "JetBrains Mono"'; g.fillText(label, 12, y + 4);
    g.fillText(Math.round(det) + ' km', 12, y + 17);
    g.strokeStyle = COL.grid; g.strokeRect(x0, y - 8, w, 18);
    // step ticks
    for (let i = 1; i < STEPS.length; i++) { const x = x0 + w * i / STEPS.length; g.strokeStyle = 'rgba(78,128,178,.25)'; g.beginPath(); g.moveTo(x, y - 8); g.lineTo(x, y + 10); g.stroke(); }
    g.fillStyle = color; g.shadowColor = color; g.shadowBlur = 6; g.fillRect(x0, y - 8, w * prog, 18); g.shadowBlur = 0;
    // current step label
    const si = Math.min(STEPS.length - 1, Math.floor(prog * STEPS.length));
    g.fillStyle = '#04121f'; g.font = 'bold 9px "JetBrains Mono"';
    if (prog > 0.06) g.fillText(STEPS[si], x0 + 6, y + 4);
  }
  function draw() {
    g.clearRect(0, 0, _V.w, _V.h);
    g.fillStyle = COL.dim; g.font = '9px "JetBrains Mono"';
    g.fillText('KILL CHAIN: DETECT → TRACK → IDENTIFY → ENGAGE → LAUNCH', 12, 18);
    bar(70, blue.prog, COL.blue, 'YOU', blue.det);
    bar(120, red.prog, COL.red, 'THREAT', red.det);
    if (winner) {
      g.fillStyle = winner === 'BLUE' ? COL.green : COL.red; g.font = 'bold 16px "JetBrains Mono"';
      g.fillText(winner === 'BLUE' ? '✓ YOU SHOOT FIRST' : '✗ HE SHOOTS FIRST', _V.w / 2 - 90, 175);
    }
    read.innerHTML =
      `<div class="wx-hint">The <b>kill chain</b> (military <b>F2T2EA</b>, or Boyd's <b>OODA loop</b>): detect → track → ` +
      `identify → engage → launch. Whoever completes it first usually wins — often before the merge. Detection range ` +
      `∝ RCS<sup>¼</sup>, so shrink <b>your</b> RCS and you complete the chain a hundred kilometres before he even ` +
      `<i>detects</i> you. That head start is what <a data-goto="modern">stealth, AESA and networking</a> all buy: not ` +
      `invulnerability, but <b>finishing the loop faster</b> — or breaking his (jamming, IRST-passive, emission control).</div>`;
  }
  const onResize = () => { fit(); };
  window.addEventListener('resize', onResize);
  return () => { stop(); window.removeEventListener('resize', onResize); };
});

// ─────────────────────────────────────────────────────────────────────────────
//  15 · TACTICAL DECISION CHALLENGE — applied "what would you do" scenarios (XP)
// ─────────────────────────────────────────────────────────────────────────────
const CHALLENGES = [
  { id: 'ch_abort', pic: 'You: 9 km alt, 300 m/s, hot. Bandit: FOX-3 AMRAAM launched at 55 km. Your MAR here is ~35 km.',
    q: 'The missile is midcourse, still ~50 km out. Best move?',
    a: ['Press for your own shot — you have time', 'Abort now: turn cold and run before MAR', 'Notch immediately and hold the beam', 'Descend to the deck and accelerate'],
    correct: 1, xp: 20,
    why: 'You are outside MAR (35 km) with a shot inbound. A timely abort wins kinematically — turn cold and the missile chases you to energy death. Waiting to react near MAR is how BVR deaths happen.' },
  { id: 'ch_notch', pic: 'A radar SAM has locked you. You are committed inside its MAR — you cannot out-run it.',
    q: 'Committed, no escape. Your best surviving play?',
    a: ['Climb straight ahead for energy', 'Turn to the beam (notch) + chaff, then a last-ditch break at TTI ~3 s', 'Fly straight and dispense flares', 'Accelerate directly away'],
    correct: 1, xp: 20,
    why: 'Inside MAR, defeat the SENSOR, not the kinematics: beam the radar so your closure ≈ 0 and you fall into its Doppler clutter notch, back it with chaff (coherent at the same zero Doppler), then a late max-G break to spike the LOS rate.' },
  { id: 'ch_low', pic: 'You must penetrate an S-400 (380 km missile) belt to strike a target 120 km behind it.',
    q: 'How do you shrink that 380 km bubble?',
    a: ['Fly high and fast to overfly it', 'Ingress low — stay below its radar horizon until close', 'Jam it from directly underneath', 'Fire chaff continuously the whole way'],
    correct: 1, xp: 25,
    why: 'Radar is line-of-sight. A low-level ingress keeps you below the curved-earth horizon (tens of km against a ground radar), collapsing a 380 km engagement zone to a knife-fight — unless an elevated sensor (AWACS) cues the shot over the horizon.' },
  { id: 'ch_meteor', pic: 'You face a Meteor shooter. Its ramjet holds Mach to the merge, giving a huge no-escape zone.',
    q: 'Why is aborting against a Meteor so much harder than against an AMRAAM?',
    a: ['Its warhead is bigger', 'It keeps energy to the merge, so its MAR is a much larger fraction of Rmax', 'Its seeker sees farther', 'It flies higher'],
    correct: 1, xp: 20,
    why: 'A solid-motor AMRAAM coasts and can be out-run once its energy bleeds (MAR ≈ 30–40% of Rmax). A ramjet stays powered, so it can still run you down deep inside its envelope — MAR ≈ 60–70% of Rmax. Respect the shot earlier.' },
  { id: 'ch_stealth', pic: 'You (F-15, RCS ~10 m²) vs an F-35 (RCS ~0.005 m²), both with similar radars, head-on.',
    q: 'Who most likely shoots first, and why?',
    a: ['The F-15 — bigger radar antenna', 'The F-35 — it detects you ~7× farther (detection ∝ RCS^¼)', 'Simultaneous — same radar', 'Neither can lock the other'],
    correct: 1, xp: 20,
    why: 'Detection range scales as the fourth root of RCS. A 2000× smaller RCS still shrinks the F-35\'s detectability ~7×, so it completes detect→track→launch long before you even see it. Stealth wins the kill-chain race.' },
  { id: 'ch_crank', pic: 'You just fired FOX-3 at 40 km. The missile flies midcourse on your datalink.',
    q: 'What does CRANKING (turning toward the gimbal edge) buy you?',
    a: ['Faster missile', 'Opens your F-pole/A-pole (more separation) while still supporting the shot', 'Makes the missile go active sooner', 'Nothing — it drops the datalink'],
    correct: 1, xp: 20,
    why: 'Cranking turns you toward your radar\'s gimbal limit: you keep the target trackable (datalink alive) while opening range from him and any return shot. Bigger A-pole/F-pole = the same kill with more of your own separation.' },
];
reg('challenge', (node) => {
  let idx = 0;
  const wrap = el('div', { class: 'wx-quiz' });
  node.appendChild(wrap);
  function render() {
    const c = CHALLENGES[idx];
    wrap.innerHTML = '';
    wrap.appendChild(el('div', { class: 'wx-qmeta' }, `Scenario ${idx + 1} / ${CHALLENGES.length} · ${progress.hasDone(c.id) ? '✓ solved' : '+' + c.xp + ' XP'} · your XP ${progress.xp()}`));
    wrap.appendChild(el('div', { class: 'wx-scenario' }, [el('b', {}, '◈ PICTURE  '), c.pic]));
    wrap.appendChild(el('div', { class: 'wx-q' }, c.q));
    const opts = el('div', { class: 'wx-opts' });
    let answered = false;
    c.a.forEach((txt, i) => opts.appendChild(el('button', { class: 'wx-opt', onclick: () => {
      if (answered) return; answered = true;
      const ok = i === c.correct;
      [...opts.children].forEach((b, j) => { b.classList.add(j === c.correct ? 'correct' : (j === i ? 'wrong' : 'dim')); b.disabled = true; });
      if (ok && !progress.hasDone(c.id)) progress.addXP(c.xp, c.id);
      const why = wrap.querySelector('#wx-why');
      why.innerHTML = `<b style="color:${ok ? COL.green : COL.red}">${ok ? '✓ Good call.' + (progress.hasDone(c.id) ? '' : ' +' + c.xp + ' XP') : '✗ Reconsider.'}</b> ${c.why}`;
      const next = el('button', { class: 'wx-btn', style: 'margin-top:10px',
        onclick: () => { idx = (idx + 1) % CHALLENGES.length; render(); } }, idx === CHALLENGES.length - 1 ? '↻ First scenario' : 'Next scenario →');
      why.appendChild(el('div', {}, next));
    } }, txt)));
    wrap.appendChild(opts);
    wrap.appendChild(el('div', { class: 'wx-why', id: 'wx-why' }));
  }
  render();
  return () => {};
});

// ─────────────────────────────────────────────────────────────────────────────
//  16 · WEAPON-ID MATCH GAME — recognise the weapon from its signature traits
// ─────────────────────────────────────────────────────────────────────────────
const CARDS = [
  { name: 'AIM-9X', clue: 'Short-range imaging-IR dogfighter with thrust-vectoring; ~30 km; no datalink.' },
  { name: 'AIM-120 AMRAAM', clue: 'US medium-range active-radar workhorse; boost-sustain solid; ~70–160 km by variant.' },
  { name: 'MBDA Meteor', clue: 'Throttleable ramjet — powered to the merge; the largest no-escape zone of any AAM.' },
  { name: 'PL-15', clue: 'Chinese dual-pulse active-radar with an AESA seeker; second pulse restores endgame energy; ~200–300 km.' },
  { name: 'R-37M', clue: 'Russian very-long-range Mach-6 interceptor missile, carried by the MiG-31; ~300 km.' },
  { name: 'S-400 (48N6/40N6)', clue: 'Long/very-long-range SAM; Mach 6+, huge loft, active seeker on the 40N6; up to ~380 km.' },
  { name: 'MIM-104 PAC-3', clue: 'Hit-to-kill SAM with attitude thrusters — no warhead, pure kinetic impact; ~20–35 km.' },
  { name: 'AIM-7 Sparrow', clue: 'Legacy semi-active radar — needs the shooter to illuminate all the way; ~50 km, never lofts.' },
];
reg('matchgame', (node) => {
  const wrap = el('div', { class: 'wx-match' });
  node.appendChild(wrap);
  const read = el('div', { class: 'wx-readout' });
  node.appendChild(read);
  let round, clue, choices, solved = 0, tries = 0;
  function newRound() {
    const pool = [...CARDS].sort(() => Math.random() - 0.5);
    round = pool[0];
    choices = [round, ...pool.slice(1, 4)].sort(() => Math.random() - 0.5);
    draw();
  }
  function draw() {
    wrap.innerHTML = '';
    wrap.appendChild(el('div', { class: 'wx-clue' }, [el('b', {}, '◈ IDENTIFY  '), round.clue]));
    const row = el('div', { class: 'wx-cards' });
    let answered = false;
    choices.forEach(c => row.appendChild(el('button', { class: 'wx-card', onclick: () => {
      if (answered) return; answered = true; tries++;
      const ok = c.name === round.name;
      [...row.children].forEach(b => { b.classList.add(b.textContent === round.name ? 'correct' : (b.textContent === c.name ? 'wrong' : 'dim')); b.disabled = true; });
      if (ok) { solved++; progress.addXP(8); progress.matchWin(round.name); }
      read.innerHTML = `<div class="wx-line" style="color:${ok ? COL.green : COL.red}">${ok ? '✓ Correct — ' + round.name + '. +8 XP' : '✗ It was ' + round.name + '.'}</div>` +
        `<div class="wx-hint">Solved ${solved} of ${tries}. Every weapon has a fingerprint — motor type, seeker, range class, datalink. Learn to read the fingerprint and you can predict a threat\'s envelope before the merge.</div>` +
        `<button class="wx-btn" style="margin-top:8px">↻ Next weapon</button>`;
      read.querySelector('.wx-btn').addEventListener('click', newRound);
    } }, c.name)));
    wrap.appendChild(row);
  }
  newRound();
  return () => {};
});

// ═════════════════════════════════════════════════════════════════════════════
//  TECHNICAL DIAGRAM WIDGETS — radar, seekers, motors, datalinks, guidance
//  Drawn to teach the real machinery, not to dumb it down.
// ═════════════════════════════════════════════════════════════════════════════

function arrow(g, x1, y1, x2, y2, color, head = 6, w = 1.4) {
  g.strokeStyle = color; g.fillStyle = color; g.lineWidth = w;
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  const a = Math.atan2(y2 - y1, x2 - x1);
  g.beginPath(); g.moveTo(x2, y2);
  g.lineTo(x2 - head * Math.cos(a - 0.4), y2 - head * Math.sin(a - 0.4));
  g.lineTo(x2 - head * Math.cos(a + 0.4), y2 - head * Math.sin(a + 0.4));
  g.closePath(); g.fill();
}
function lbl(g, x, y, text, color, align = 'left', size = 10, bold = false) {
  g.fillStyle = color; g.font = `${bold ? 'bold ' : ''}${size}px "JetBrains Mono", monospace`;
  g.textAlign = align; g.textBaseline = 'alphabetic';
  g.fillText(text, x, y); g.textAlign = 'left';
}
function chip(g, x, y, w, h, text, color, sub) {
  g.strokeStyle = color; g.fillStyle = 'rgba(10,18,30,.6)'; g.lineWidth = 1;
  g.beginPath(); g.rect(x, y, w, h); g.fill(); g.stroke();
  g.fillStyle = color; g.font = '9px "JetBrains Mono"'; g.textAlign = 'left';
  g.fillText(text, x + 6, y + 13);
  if (sub) { g.fillStyle = COL.dim; g.fillText(sub, x + 6, y + 25); }
}

// ── 1 · MECHANICAL vs AESA SCANNING ──────────────────────────────────────────
// ── 2 · PULSE-DOPPLER PRF TRADE ──────────────────────────────────────────────
reg('prf', (node) => {
  const _V = makeCanvas(node, 250); const { cv, g, fit } = _V;
  const controls = el('div', { class: 'wx-controls' }); node.appendChild(controls);
  const read = el('div', { class: 'wx-readout' }); node.appendChild(read);
  let prf = 3;   // kHz (1=low .. 100=high on a log-ish feel; use 3 discrete-ish)
  const s1 = slider('PRF (kHz)', 1, 100, 1, prf, v => { prf = v; draw(); });
  controls.appendChild(s1.row);
  function draw() {
    const C = 299792.458;  // km/s
    const R_ua = C / (2 * prf * 1000) ;      // km  (c/(2·PRF))
    const V_ua = prf * 1000 * 0.03 / 4;      // arbitrary-scaled unambiguous velocity (∝ PRF)
    g.clearRect(0, 0, _V.w, _V.h);
    const x0 = 14, x1 = _V.w - 14;
    // pulse train
    const py = 40, pri = Math.max(14, 220 / (prf ** 0.5));
    lbl(g, x0, 20, 'PULSE TRAIN (time →)   PRI = 1/PRF', COL.dim, 'left', 9);
    g.strokeStyle = COL.grid; g.beginPath(); g.moveTo(x0, py); g.lineTo(x1, py); g.stroke();
    g.strokeStyle = COL.amber; g.lineWidth = 2;
    for (let x = x0; x < x1; x += pri) { g.beginPath(); g.moveTo(x, py); g.lineTo(x, py - 14); g.lineTo(x + 2, py - 14); g.lineTo(x + 2, py); g.stroke(); }
    // two trade bars
    const barY1 = 95, barY2 = 150, bw = x1 - x0 - 90;
    const rangeFrac = Math.min(1, R_ua / 300);         // 300 km full scale
    const dopFrac = Math.min(1, prf / 100);
    lbl(g, x0, barY1 - 6, 'RANGE unambiguity', COL.blue, 'left', 10, true);
    g.fillStyle = 'rgba(0,229,255,.18)'; g.fillRect(x0, barY1, bw, 16);
    g.fillStyle = COL.blue; g.fillRect(x0, barY1, bw * rangeFrac, 16);
    lbl(g, x0 + bw + 8, barY1 + 13, `${R_ua < 1 ? (R_ua * 1000).toFixed(0) + ' m' : R_ua.toFixed(0) + ' km'}`, COL.blue, 'left', 11);
    lbl(g, x0, barY2 - 6, 'DOPPLER / velocity unambiguity', COL.green, 'left', 10, true);
    g.fillStyle = 'rgba(34,255,156,.16)'; g.fillRect(x0, barY2, bw, 16);
    g.fillStyle = COL.green; g.fillRect(x0, barY2, bw * dopFrac, 16);
    lbl(g, x0 + bw + 8, barY2 + 13, dopFrac >= 0.66 ? 'clean' : dopFrac >= 0.33 ? 'ok' : 'aliased', COL.green, 'left', 11);
    // regime label
    const regime = prf < 8 ? ['LOW PRF', 'unambiguous RANGE, aliased Doppler → poor look-down. Old search radars.'] :
      prf < 40 ? ['MEDIUM PRF', 'BOTH ambiguous but resolved by hopping PRFs — the fighter-radar workhorse, decent everywhere.'] :
      ['HIGH PRF', 'clean DOPPLER (great vs closing/look-down targets) but ambiguous range — "velocity search".'];
    g.fillStyle = COL.amber; g.font = 'bold 13px "JetBrains Mono"'; g.textAlign = 'left';
    g.fillText(regime[0], x0, _V.h - 30);
    read.innerHTML = `<div class="wx-big" style="color:${COL.amber}">${regime[0]}</div>` +
      `<div class="wx-line">${regime[1]}</div>` +
      `<div class="wx-hint">A pulse radar can\'t have it both ways. Space pulses far apart (<b>low PRF</b>) and each echo returns before the next pulse → you know range unambiguously, but you sample the target\'s Doppler too slowly to measure velocity (and can\'t reject ground clutter well). Pack them close (<b>high PRF</b>) and Doppler is beautifully clean — perfect for spotting fast, closing, look-down targets against clutter — but range wraps around. <b>Medium PRF</b> hops between several PRFs to unwrap both. This trade is why the <a data-goto="ew">notch</a> exists and why look-down/shoot-down needed pulse-Doppler.</div>`;
  }
  _V.redraw = draw;
  const onResize = () => { fit(); draw(); }; window.addEventListener('resize', onResize); draw();
  return () => window.removeEventListener('resize', onResize);
});

// ── 3 · RADAR FAMILY: EARLY WARNING → ACQUISITION → FIRE CONTROL ──────────────
reg('radarfamily', (node) => {
  const _V = makeCanvas(node, 300); const { cv, g, fit } = _V;
  const read = el('div', { class: 'wx-readout' }); node.appendChild(read);
  function draw() {
    g.clearRect(0, 0, _V.w, _V.h);
    const cx = 60, cy = _V.h - 30;
    const rows = [
      { r: 1.0, half: 1.15, col: 'rgba(147,172,203,.6)', name: 'EARLY WARNING', band: 'VHF/UHF · wide', job: 'detect & cue far (coarse)', y: 40 },
      { r: 0.66, half: 0.85, col: COL.amber, name: 'ACQUISITION', band: 'S/C · medium', job: 'build a firm track, hand off', y: 90 },
      { r: 0.42, half: 0.5, col: COL.red, name: 'FIRE CONTROL', band: 'X/Ku · pencil', job: 'precise track + guide weapon', y: 140 },
    ];
    const Rmax = Math.max(30, Math.min(_V.w - 90, 340));   // clamp: a narrow canvas must not give arc() a negative radius
    rows.forEach(rw => {
      g.strokeStyle = rw.col; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, Rmax * rw.r, -rw.half, rw.half); g.closePath(); g.stroke();
      g.fillStyle = rw.col.includes('rgba') ? rw.col : rw.col;
    });
    // radar site
    g.fillStyle = COL.ink; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx - 6, cy + 8); g.lineTo(cx + 6, cy + 8); g.closePath(); g.fill();
    // handoff arrows + spec chips (right side)
    const bx = _V.w - 230, cw = 216;
    rows.forEach((rw, i) => {
      chip(g, bx, rw.y - 14, cw, 34, `${rw.name}  ·  ${rw.band}  ·  ${rw.beam}`, rw.col, rw.job);
      if (i < rows.length - 1) arrow(g, bx + cw / 2, rw.y + 22, bx + cw / 2, rows[i + 1].y - 16, COL.dim, 5);
    });
    lbl(g, 12, 18, 'ONE IADS, THREE RADAR JOBS (coverage arcs, left)', COL.blue, 'left', 10, true);
    read.innerHTML = `<div class="wx-hint">These are three <b>different jobs</b>, often three different radars, chained together. <b>Early-warning</b> radars are huge, low-frequency and long-ranged — they see hundreds of km (and see stealth best) but only roughly; their product is a <i>cue</i>. The <b>acquisition</b> radar takes that cue and builds a firm track. The <b>fire-control radar (FCR)</b> is a narrow, high-update pencil that <i>tracks the target precisely and guides the weapon</i> (illuminating for SARH, or uplinking a datalink). A fighter\'s single AESA does all three roles interleaved; a ground <a data-goto="iadsnet">IADS</a> splits them across dedicated radars so killing one doesn\'t blind the system.</div>`;
  }
  _V.redraw = draw;
  const onResize = () => { fit(); draw(); }; window.addEventListener('resize', onResize); draw();
  return () => window.removeEventListener('resize', onResize);
});

// ── 4 · GROUND-BASED vs AIRBORNE RADAR ───────────────────────────────────────
reg('groundvsair', (node) => {
  const _V = makeCanvas(node, 260); const { cv, g, fit } = _V;
  const read = el('div', { class: 'wx-readout' }); node.appendChild(read);
  function draw() {
    g.clearRect(0, 0, _V.w, _V.h);
    const midX = _V.w / 2;
    g.strokeStyle = COL.grid; g.beginPath(); g.moveTo(midX, 6); g.lineTo(midX, _V.h - 20); g.stroke();
    // curved earth on both
    const drawEarth = (ox) => {
      const base = _V.h - 40, cxE = ox + (_V.w / 2) / 2, Re = (_V.w / 2) * 2.6;
      g.strokeStyle = 'rgba(78,128,178,.35)'; g.lineWidth = 2; g.beginPath();
      for (let px = ox + 8; px <= ox + _V.w / 2 - 8; px += 4) { const dx = px - cxE; const y = base + Re - Math.sqrt(Re * Re - dx * dx); px === ox + 8 ? g.moveTo(px, y) : g.lineTo(px, y); }
      g.stroke(); return { base, cxE, Re };
    };
    // LEFT: ground radar
    const L = drawEarth(0);
    const gx = L.cxE, gy = L.base + L.Re - Math.sqrt(L.Re * L.Re) ; // on surface at center
    const gsy = L.base + L.Re - Math.sqrt(L.Re * L.Re - 0) - 0;
    g.fillStyle = COL.blue; g.beginPath(); g.moveTo(gx, gsy); g.lineTo(gx - 5, gsy + 8); g.lineTo(gx + 5, gsy + 8); g.closePath(); g.fill();
    lbl(g, gx - 26, gsy + 22, 'GROUND', COL.blue, 'left', 9);
    // horizon tangent (line of sight grazing earth) + a low target hidden
    g.strokeStyle = 'rgba(0,229,255,.5)'; g.setLineDash([4, 4]);
    g.beginPath(); g.moveTo(gx, gsy); g.lineTo(0 + _V.w / 2 - 14, gsy - 30); g.stroke(); g.setLineDash([]);
    // hidden low target (below horizon on the right of left panel)
    const htx = 0 + _V.w / 2 - 30, hty = L.base + L.Re - Math.sqrt(L.Re * L.Re - (htx - L.cxE) ** 2) - 6;
    g.fillStyle = COL.red; g.save(); g.translate(htx, hty); g.beginPath(); g.moveTo(-7, 0); g.lineTo(5, -3); g.lineTo(5, 3); g.closePath(); g.fill(); g.restore();
    lbl(g, htx - 40, hty + 12, 'hidden low', COL.red, 'left', 8);
    // RIGHT: airborne radar
    const Rp = drawEarth(_V.w / 2);
    const ax = Rp.cxE - 30, ay = 40;
    g.fillStyle = COL.green; g.save(); g.translate(ax, ay); g.beginPath(); g.moveTo(-8, 0); g.lineTo(6, -3); g.lineTo(6, 3); g.closePath(); g.fill(); g.restore();
    lbl(g, ax - 10, ay - 6, 'AIRBORNE', COL.green, 'left', 9);
    // look-down beam + clutter cone
    const tgx = Rp.cxE + 40, tgy = Rp.base + Rp.Re - Math.sqrt(Rp.Re * Rp.Re - (tgx - Rp.cxE) ** 2) - 6;
    g.strokeStyle = 'rgba(34,255,156,.6)'; g.beginPath(); g.moveTo(ax, ay); g.lineTo(tgx, tgy); g.stroke();
    g.fillStyle = 'rgba(255,61,0,.14)'; g.beginPath(); g.moveTo(ax, ay); g.lineTo(tgx - 30, tgy + 6); g.lineTo(tgx + 40, tgy + 8); g.closePath(); g.fill();
    g.fillStyle = COL.green; g.save(); g.translate(tgx, tgy); g.beginPath(); g.moveTo(-7, 0); g.lineTo(5, -3); g.lineTo(5, 3); g.closePath(); g.fill(); g.restore();
    lbl(g, tgx - 20, tgy + 12, 'low target SEEN', COL.green, 'left', 8);
    lbl(g, Rp.cxE - 20, _V.h - 6, 'ground clutter', COL.red, 'left', 8);
    read.innerHTML = `<div class="wx-hint"><b>Ground radar</b> (left): big antenna, huge power, no self-clutter looking up — but it\'s <b>horizon-limited</b>. A low flyer hides below the curved-earth <a data-goto="horizon">radar horizon</a> until close, and terrain masks whole sectors. <b>Airborne radar</b> (right): elevated, so it can <b>look DOWN over the horizon</b> and catch low flyers — but now it stares into <b>ground clutter</b> (the huge stationary return from the earth), which is exactly why airborne radars are <a data-goto="prf">pulse-Doppler</a> (they filter by velocity to separate movers from dirt). The airborne radar trades antenna size, power and cooling for that elevated geometry and mobility. This ground-vs-air difference is the whole reason AWACS exists — an elevated radar restores the low-altitude coverage a ground site can\'t reach.</div>`;
  }
  _V.redraw = draw;
  const onResize = () => { fit(); draw(); }; window.addEventListener('resize', onResize); draw();
  return () => window.removeEventListener('resize', onResize);
});

// ── 5 · MONOPULSE ANGLE TRACKING ─────────────────────────────────────────────
reg('monopulse', (node) => {
  const _V = makeCanvas(node, 240); const { cv, g, fit } = _V;
  const controls = el('div', { class: 'wx-controls' }); node.appendChild(controls);
  const read = el('div', { class: 'wx-readout' }); node.appendChild(read);
  let off = 0.3;   // target offset from boresight, -1..1
  const s1 = slider('Target off boresight', -1, 1, 0.02, off, v => { off = v; draw(); });
  controls.appendChild(s1.row);
  function draw() {
    g.clearRect(0, 0, _V.w, _V.h);
    const cx = _V.w / 2, top = 20, bw = _V.w - 60, x0 = 30;
    // two squinted beam patterns (left/right lobes)
    const patY = 120, ph = 80;
    const gauss = (x, mu) => Math.exp(-((x - mu) ** 2) / 0.14);
    g.lineWidth = 2;
    for (const [mu, col, nm] of [[-0.35, COL.blue, 'A'], [0.35, COL.amber, 'B']]) {
      g.strokeStyle = col; g.beginPath();
      for (let i = 0; i <= 100; i++) { const xf = -1 + i / 50; const px = cx + xf * bw / 2; const py = patY - gauss(xf, mu) * ph; i ? g.lineTo(px, py) : g.moveTo(px, py); }
      g.stroke();
    }
    // boresight + target
    g.strokeStyle = COL.grid; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(cx, top); g.lineTo(cx, patY); g.stroke(); g.setLineDash([]);
    lbl(g, cx + 3, top + 8, 'boresight', COL.dim, 'left', 8);
    const tx = cx + off * bw / 2;
    g.strokeStyle = COL.red; g.lineWidth = 1.6; g.beginPath(); g.moveTo(tx, top); g.lineTo(tx, patY); g.stroke();
    g.fillStyle = COL.red; g.beginPath(); g.arc(tx, top + 4, 4, 0, 7); g.fill();
    lbl(g, tx + 5, top + 8, 'target', COL.red, 'left', 8);
    // Σ and Δ signals
    const A = gauss(off, -0.35), B = gauss(off, 0.35);
    const sum = A + B, diff = B - A;
    const barY = 165, bh = 18;
    lbl(g, x0, barY - 4, 'Σ (sum) = A + B  → is a target THERE?', COL.green, 'left', 9);
    g.fillStyle = 'rgba(34,255,156,.5)'; g.fillRect(x0, barY, (sum / 2) * bw, bh);
    lbl(g, x0, barY + 40 - 4, 'Δ (difference) = B − A  → WHICH SIDE, how far off', COL.amber, 'left', 9);
    g.fillStyle = 'rgba(255,176,0,.5)'; const dc = x0 + bw / 2; g.fillRect(Math.min(dc, dc + (diff / 2) * bw), barY + 40, Math.abs(diff / 2) * bw, bh);
    g.strokeStyle = COL.dim; g.beginPath(); g.moveTo(dc, barY + 40); g.lineTo(dc, barY + 40 + bh); g.stroke();
    read.innerHTML = `<div class="wx-line">Δ/Σ = <b style="color:${COL.amber}">${(diff / sum).toFixed(2)}</b> → target is <b>${off > 0.02 ? 'RIGHT' : off < -0.02 ? 'LEFT' : 'on boresight'}</b> of the antenna axis.</div>` +
      `<div class="wx-hint"><b>Monopulse</b> forms two (or four) squinted beams at once. The <b>sum</b> channel Σ says a target is present and how strong; the <b>difference</b> channel Δ (one lobe minus the other) is zero on boresight and grows with the error, its sign giving the side. The ratio <b>Δ/Σ</b> yields the exact off-axis angle from a <b>single pulse</b> — no scanning, no reliance on the target\'s amplitude. That\'s why monopulse is precise and <b>hard to angle-deceive</b>: amplitude tricks cancel in the ratio, so DRFM jammers must resort to cross-eye or terrain-bounce to fool it.</div>`;
  }
  _V.redraw = draw;
  const onResize = () => { fit(); draw(); }; window.addEventListener('resize', onResize); draw();
  return () => window.removeEventListener('resize', onResize);
});

// ── 6 · SEEKER GIMBAL TRACKING LOOP ──────────────────────────────────────────
reg('seekerloop', (node) => {
  const _V = makeCanvas(node, 250); const { cv, g, fit } = _V;
  const controls = el('div', { class: 'wx-controls' }); node.appendChild(controls);
  const read = el('div', { class: 'wx-readout' }); node.appendChild(read);
  let gimbalLim = 60, play = true;
  const s1 = slider('Gimbal limit (°)', 20, 90, 5, gimbalLim, v => { gimbalLim = v; });
  const btn = el('button', { class: 'wx-btn', onclick: () => { play = !play; btn.textContent = play ? '❚❚' : '▶'; } }, '❚❚');
  controls.append(s1.row, btn);
  let head = 0, t0 = performance.now(), lost = false;
  const stop = frame((now) => {
    const T = (now - t0) / 1000;
    g.clearRect(0, 0, _V.w, _V.h);
    const mx = 70, my = _V.h / 2;
    // missile body pointing right
    g.fillStyle = COL.dim; g.beginPath(); g.moveTo(mx - 30, my - 7); g.lineTo(mx + 10, my - 7); g.lineTo(mx + 22, my); g.lineTo(mx + 10, my + 7); g.lineTo(mx - 30, my + 7); g.closePath(); g.fill();
    // target orbiting / crossing
    const tAng = play ? T * 0.6 : head * Math.PI / 180 * 0 + 0.6;
    const tx = mx + 180 + Math.cos(T * 0.9) * 40, ty = my + Math.sin(T * 0.7) * 90;
    // LOS angle from missile nose (body axis = +x)
    const losAng = Math.atan2(ty - my, tx - mx) * 180 / Math.PI;
    // seeker head slews toward LOS (first-order), unless beyond gimbal limit
    if (play) {
      if (Math.abs(losAng) <= gimbalLim) { head += (losAng - head) * Math.min(1, 6 * 0.016); lost = false; }
      else lost = true;
    }
    // gimbal cone
    g.strokeStyle = 'rgba(255,176,0,.4)'; g.lineWidth = 1; g.setLineDash([4, 3]);
    for (const s of [-1, 1]) { const a = s * gimbalLim * Math.PI / 180; g.beginPath(); g.moveTo(mx + 22, my); g.lineTo(mx + 22 + Math.cos(a) * 150, my + Math.sin(a) * 150); g.stroke(); }
    g.setLineDash([]);
    lbl(g, mx + 30, my - gimbalLim * 1.4 - 4, `gimbal ±${gimbalLim}°`, COL.amber, 'left', 8);
    // seeker boresight (where the head points)
    const ha = head * Math.PI / 180;
    g.strokeStyle = lost ? COL.red : COL.green; g.lineWidth = 2; g.shadowColor = g.strokeStyle; g.shadowBlur = 6;
    g.beginPath(); g.moveTo(mx + 22, my); g.lineTo(mx + 22 + Math.cos(ha) * 120, my + Math.sin(ha) * 120); g.stroke(); g.shadowBlur = 0;
    // LOS to target
    g.strokeStyle = 'rgba(147,172,203,.6)'; g.lineWidth = 1.2; g.setLineDash([5, 4]);
    g.beginPath(); g.moveTo(mx + 22, my); g.lineTo(tx, ty); g.stroke(); g.setLineDash([]);
    // target
    g.fillStyle = lost ? COL.red : COL.tgt || COL.red; g.beginPath(); g.arc(tx, ty, 6, 0, 7); g.fill();
    lbl(g, 10, 16, lost ? 'GIMBAL LIMIT EXCEEDED — TRACK LOST' : 'SEEKER TRACKING', lost ? COL.red : COL.green, 'left', 10, true);
    const be = Math.abs(losAng - head);
    read.innerHTML = `<div class="wx-line">boresight error <b style="color:${COL.amber}">${be.toFixed(1)}°</b> · head at <b>${head.toFixed(0)}°</b> · LOS at <b>${losAng.toFixed(0)}°</b></div>` +
      `<div class="wx-hint">The seeker runs a <b>tracking loop</b>: (1) measure where the target is relative to the head — the <b>boresight error</b>; (2) drive the gimballed head to <b>null that error</b> so it stays pointed at the target; (3) the residual <b>line-of-sight rate</b> it measures is what feeds <a data-goto="guidance">proportional navigation</a>. The head can only slew so far off the missile\'s nose — the <b>gimbal limit</b> (amber cone). Force the target past it (a hard beam/notch that drives high LOS rate, or a crossing at short range) and the loop can\'t keep up: <b>track breaks</b>. This is the physical mechanism the notch and last-ditch break exploit.</div>`;
  });
  const onResize = () => fit(); window.addEventListener('resize', onResize);
  return () => { stop(); window.removeEventListener('resize', onResize); };
});

// ── 7 · IR SEEKER SCAN GENERATIONS ───────────────────────────────────────────
reg('irscan', (node) => {
  const _V = makeCanvas(node, 240); const { cv, g, fit } = _V;
  const controls = el('div', { class: 'wx-controls' }); node.appendChild(controls);
  const read = el('div', { class: 'wx-readout' }); node.appendChild(read);
  const GENS = [
    { k: 'spin', nm: 'SPIN-SCAN reticle', rej: 1, desc: 'A spinning spoked reticle chops the incoming IR into a tone whose phase gives target angle. The <b>brightest</b> source wins — a flare easily out-shouts the jet. 1960s–70s.' },
    { k: 'con', nm: 'CON-SCAN (nutating)', rej: 2, desc: 'The reticle image is nutated in a small circle so a centred target gives a steady signal. Better angle info and somewhat harder to flare, but still amplitude-driven.' },
    { k: 'rosette', nm: 'ROSETTE (pseudo-imaging)', rej: 3, desc: 'A detector scans a rose-petal pattern across the whole field, sampling the scene — pseudo-imaging. It can separate a flare from the jet by position and rise-time. Good flare rejection.' },
    { k: 'fpa', nm: 'IMAGING FOCAL-PLANE ARRAY', rej: 4, desc: 'A staring pixel grid (like a thermal camera) SEES the target\'s <b>shape</b>. Rejects flares by shape (a point fireball isn\'t a jet), spectrum (two-colour) and kinematics (flares fall & decelerate). AIM-9X / IRIS-T class.' },
  ];
  let gi = 3;
  const btns = GENS.map((G, i) => el('button', { class: 'wx-btn', onclick: () => { gi = i; sync(); draw(); } }, G.nm.split(' ')[0]));
  controls.append(...btns);
  function sync() { btns.forEach((b, i) => b.style.borderColor = i === gi ? 'var(--amber)' : ''); }
  let t0 = performance.now();
  const stop = frame((now) => draw(now));
  function draw(now) {
    now = now || performance.now(); const T = (now - t0) / 1000;
    g.clearRect(0, 0, _V.w, _V.h);
    const cx = 110, cy = _V.h / 2 + 6, R = _V.h / 2 - 24;
    g.strokeStyle = COL.grid; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.stroke();
    lbl(g, cx - R, 16, 'SEEKER FIELD OF VIEW', COL.dim, 'left', 9);
    const G = GENS[gi];
    g.save(); g.beginPath(); g.arc(cx, cy, R, 0, 7); g.clip();
    if (G.k === 'spin') { g.save(); g.translate(cx, cy); g.rotate(T * 4); g.strokeStyle = 'rgba(0,229,255,.5)'; for (let a = 0; a < 8; a++) { g.rotate(Math.PI / 4); g.beginPath(); g.moveTo(0, 0); g.lineTo(R, 0); g.stroke(); } g.restore(); }
    else if (G.k === 'con') { const ox = Math.cos(T * 3) * R * 0.3, oy = Math.sin(T * 3) * R * 0.3; g.strokeStyle = 'rgba(0,229,255,.5)'; g.beginPath(); g.arc(cx + ox, cy + oy, R * 0.5, 0, 7); g.stroke(); }
    else if (G.k === 'rosette') { g.strokeStyle = 'rgba(0,229,255,.5)'; g.beginPath(); for (let i = 0; i <= 200; i++) { const th = i / 200 * Math.PI * 12; const rr = R * 0.9 * Math.abs(Math.cos(2.5 * th)); const px = cx + Math.cos(th + T) * rr, py = cy + Math.sin(th + T) * rr; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); }
    else { g.strokeStyle = 'rgba(0,229,255,.25)'; const n = 8, cell = R * 2 / n; for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(cx - R + i * cell, cy - R); g.lineTo(cx - R + i * cell, cy + R); g.stroke(); g.beginPath(); g.moveTo(cx - R, cy - R + i * cell); g.lineTo(cx + R, cy - R + i * cell); g.stroke(); } }
    // target (jet) + a flare
    g.fillStyle = COL.green; g.save(); g.translate(cx - 8, cy - 6); g.beginPath(); g.moveTo(-8, 0); g.lineTo(6, -3); g.lineTo(6, 3); g.closePath(); g.fill(); g.restore();
    const fx = cx + 20 + Math.sin(T) * 6, fy = cy + 18 + T % 3 * 6;
    g.fillStyle = 'rgba(255,150,40,.9)'; g.shadowColor = '#ffb000'; g.shadowBlur = 10; g.beginPath(); g.arc(fx, fy % (cy + R), 5, 0, 7); g.fill(); g.shadowBlur = 0;
    g.restore();
    // rejection meter
    const mx = cx + R + 30, mw = _V.w - mx - 16;
    lbl(g, mx, cy - 30, 'FLARE REJECTION', COL.amber, 'left', 10, true);
    for (let i = 0; i < 4; i++) { g.strokeStyle = COL.grid; g.strokeRect(mx + i * (mw / 4), cy - 14, mw / 4 - 3, 20); if (i < G.rej) { g.fillStyle = i < 2 ? COL.red : i < 3 ? COL.amber : COL.green; g.fillRect(mx + i * (mw / 4), cy - 14, mw / 4 - 3, 20); } }
    lbl(g, mx, cy + 26, G.nm, COL.blue, 'left', 10, true);
    read.innerHTML = `<div class="wx-hint">${G.desc}</div>`;
  }
  sync();
  const onResize = () => fit(); window.addEventListener('resize', onResize);
  return () => { stop(); window.removeEventListener('resize', onResize); };
});

// ── 8 · MOTOR CROSS-SECTIONS + THRUST CURVES ─────────────────────────────────
reg('motorx', (node) => {
  const _V = makeCanvas(node, 240); const { cv, g, fit } = _V;
  const controls = el('div', { class: 'wx-controls' }); node.appendChild(controls);
  const read = el('div', { class: 'wx-readout' }); node.appendChild(read);
  const TYPES = [
    { k: 'single', nm: 'SINGLE-GRAIN', desc: 'One propellant grain, one burn. Simple and cheap, but the whole impulse is spent early — after burnout it\'s a coasting glider. Short-range weapons.' },
    { k: 'bs', nm: 'BOOST-SUSTAIN', desc: 'One grain cast in two geometries: a fast <b>boost</b> section for a hard kick, then a slow <b>sustain</b> section that trickles thrust to hold speed. Stretches the energy profile — the AMRAAM/most-SAM workhorse.' },
    { k: 'dual', nm: 'DUAL-PULSE', desc: 'Two separate grains split by an insulating bulkhead, each with its own igniter. Pulse 1 boosts; the missile coasts; <b>pulse 2 relights near the endgame</b> to restore Mach exactly when the terminal fight starts — a huge no-escape zone. PL-15, AIM-260, Barak-8.' },
    { k: 'ram', nm: 'RAMJET (ducted rocket)', desc: 'A solid <b>booster</b> gets it supersonic, then air scooped through <b>intakes</b> burns fuel in a ramjet <b>combustor</b> — the oxidiser is the atmosphere, so specific impulse is 3–4× a rocket. The <b>throttle</b> runs a fuel-efficient economy cruise in midcourse (idling when already fast) and throttles UP in the terminal phase — so it arrives at the merge still under power (Meteor). Flames out for good if it decelerates below its minimum Mach.' },
  ];
  let ti = 2;
  const btns = TYPES.map((Tp, i) => el('button', { class: 'wx-btn', onclick: () => { ti = i; sync(); draw(); } }, Tp.nm.split(' ')[0].split('-')[0]));
  controls.append(...btns);
  function sync() { btns.forEach((b, i) => b.style.borderColor = i === ti ? 'var(--amber)' : ''); }
  function tube(x, y, w, h) { g.strokeStyle = COL.dim; g.lineWidth = 1.5; g.strokeRect(x, y, w, h); }
  function draw() {
    g.clearRect(0, 0, _V.w, _V.h);
    const x = 20, y = 30, w = _V.w - 120, h = 46;   // motor body
    const nz = 14;   // nozzle
    const T = TYPES[ti];
    // body
    tube(x, y, w, h);
    // nozzle (right)
    g.fillStyle = 'rgba(147,172,203,.3)'; g.beginPath(); g.moveTo(x + w, y + 6); g.lineTo(x + w + nz, y - 2); g.lineTo(x + w + nz, y + h + 2); g.lineTo(x + w, y + h - 6); g.closePath(); g.fill();
    const grain = (gx, gw, col, bore) => { g.fillStyle = col; g.fillRect(gx, y + 4, gw, h - 8); g.fillStyle = '#0a1220'; const bh = bore * (h - 12); g.fillRect(gx, y + h / 2 - bh / 2, gw, bh); };
    if (T.k === 'single') { grain(x + 4, w - 8, 'rgba(255,176,0,.5)', 0.35); lbl(g, x + 4, y - 6, 'propellant grain', COL.amber, 'left', 8); }
    else if (T.k === 'bs') { grain(x + 4, (w - 8) * 0.4, 'rgba(255,90,42,.55)', 0.5); grain(x + 4 + (w - 8) * 0.4, (w - 8) * 0.6, 'rgba(255,176,0,.45)', 0.25); lbl(g, x + 6, y - 6, 'boost web', COL.red, 'left', 8); lbl(g, x + (w) * 0.5, y - 6, 'sustain', COL.amber, 'left', 8); }
    else if (T.k === 'dual') { const gw = (w - 20) / 2; grain(x + 4, gw, 'rgba(255,176,0,.5)', 0.35); g.fillStyle = COL.blue; g.fillRect(x + 4 + gw + 4, y + 3, 4, h - 6); grain(x + 12 + gw, gw, 'rgba(34,255,156,.4)', 0.35); lbl(g, x + 6, y - 6, 'pulse 1', COL.amber, 'left', 8); lbl(g, x + 6 + gw + 8, y + h + 12, 'bulkhead + igniter', COL.blue, 'left', 8); lbl(g, x + 14 + gw, y - 6, 'pulse 2', COL.green, 'left', 8); }
    else { grain(x + 4, (w - 8) * 0.28, 'rgba(255,90,42,.55)', 0.3); lbl(g, x + 6, y - 6, 'booster', COL.red, 'left', 8); g.fillStyle = 'rgba(0,229,255,.25)'; g.fillRect(x + 4 + (w - 8) * 0.28, y + 6, (w - 8) * 0.68, h - 12); lbl(g, x + (w) * 0.45, y - 6, 'ramjet combustor (fuel + air)', COL.blue, 'left', 8);
      // intakes
      g.fillStyle = COL.blue; g.beginPath(); g.moveTo(x + w * 0.35, y - 2); g.lineTo(x + w * 0.5, y - 14); g.lineTo(x + w * 0.55, y - 14); g.lineTo(x + w * 0.42, y - 2); g.closePath(); g.fill();
      arrow(g, x + w * 0.52, y - 20, x + w * 0.46, y - 6, COL.blue, 4); lbl(g, x + w * 0.56, y - 16, 'air', COL.blue, 'left', 8); }
    // thrust curve
    const gx = x, gy = _V.h - 20, gw2 = w, gh = 70;
    g.strokeStyle = COL.grid; g.beginPath(); g.moveTo(gx, gy); g.lineTo(gx + gw2, gy); g.moveTo(gx, gy); g.lineTo(gx, gy - gh); g.stroke();
    lbl(g, gx - 2, gy - gh - 2, 'thrust', COL.dim, 'left', 8); lbl(g, gx + gw2 - 20, gy + 12, 'time →', COL.dim, 'left', 8);
    const curve = { single: [[0, 0], [0.05, 1], [0.3, 0.9], [0.32, 0], [1, 0]], bs: [[0, 0], [0.04, 1], [0.15, 0.95], [0.17, 0.28], [0.6, 0.22], [0.62, 0], [1, 0]], dual: [[0, 0], [0.04, 1], [0.2, 0.9], [0.22, 0], [0.6, 0], [0.62, 0.85], [0.8, 0.8], [0.82, 0], [1, 0]], ram: [[0, 0], [0.04, 1], [0.12, 0.95], [0.14, 0.4], [0.9, 0.38], [0.95, 0]] }[T.k];
    g.strokeStyle = COL.amber; g.lineWidth = 2; g.beginPath();
    curve.forEach((p, i) => { const px = gx + p[0] * gw2, py = gy - p[1] * gh; i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.stroke();
    lbl(g, x + w + nz + 6, y + 20, T.nm, COL.amber, 'left', 10, true);
    read.innerHTML = `<div class="wx-hint">${T.desc} <a data-goto="propulsion">(full propulsion section)</a></div>`;
  }
  sync();
  const onResize = () => { fit(); draw(); }; window.addEventListener('resize', onResize); draw();
  _V.redraw = draw;
  return () => window.removeEventListener('resize', onResize);
});

// ── 9 · DATALINK TYPES ───────────────────────────────────────────────────────
reg('datalinktypes', (node) => {
  const _V = makeCanvas(node, 230); const { cv, g, fit } = _V;
  const controls = el('div', { class: 'wx-controls' }); node.appendChild(controls);
  const read = el('div', { class: 'wx-readout' }); node.appendChild(read);
  const MODES = [
    { k: 'oneway', nm: 'ONE-WAY COMMAND', desc: 'The shooter transmits guidance/illumination to the missile, which sends nothing back (command guidance, or SARH riding the shooter\'s reflection). Simple, but the shooter is <b>committed</b>: turn away and the missile is orphaned.' },
    { k: 'twoway', nm: 'TWO-WAY WEAPON LINK', desc: 'The shooter and missile talk both ways: the shooter uplinks the predicted intercept point; the missile downlinks its seeker/position/lock state. Enables <b>cranking</b>, mid-flight retargeting, home-on-jam handoff and kill assessment. Modern ARH weapons.' },
    { k: 'network', nm: 'TACTICAL NETWORK / 3rd-PARTY', desc: 'A meshed net (Link-16 class) shares one picture across AWACS, fighters and ships. Any node can <b>cue</b> any shooter, and a <i>different</i> platform can guide the missile — <b>engage-on-remote</b>, silent shooter, resilient web. The state of the art.' },
  ];
  let mi = 1;
  const btns = MODES.map((M, i) => el('button', { class: 'wx-btn', onclick: () => { mi = i; sync(); draw(); } }, M.nm.split(' ')[0]));
  controls.append(...btns);
  function sync() { btns.forEach((b, i) => b.style.borderColor = i === mi ? 'var(--amber)' : ''); }
  function jet(x, y, col, name) { g.fillStyle = col; g.save(); g.translate(x, y); g.beginPath(); g.moveTo(-10, 0); g.lineTo(8, -4); g.lineTo(8, 4); g.closePath(); g.fill(); g.restore(); lbl(g, x - 12, y + 16, name, col, 'left', 8); }
  function msl(x, y) { g.fillStyle = COL.amber; g.beginPath(); g.moveTo(x - 6, y - 3); g.lineTo(x + 6, y); g.lineTo(x - 6, y + 3); g.closePath(); g.fill(); lbl(g, x - 10, y - 8, 'MSL', COL.amber, 'left', 8); }
  function draw() {
    g.clearRect(0, 0, _V.w, _V.h);
    const M = MODES[mi]; const midY = _V.h / 2;
    const sx = 60, mslx = _V.w / 2, tgtx = _V.w - 60;
    if (M.k === 'oneway') {
      jet(sx, midY, COL.blue, 'SHOOTER'); msl(mslx, midY); jet(tgtx, midY, COL.red, 'TARGET');
      arrow(g, sx + 12, midY - 8, mslx - 8, midY - 8, COL.green, 6); lbl(g, (sx + mslx) / 2 - 20, midY - 14, 'command →', COL.green, 'left', 8);
    } else if (M.k === 'twoway') {
      jet(sx, midY, COL.blue, 'SHOOTER'); msl(mslx, midY); jet(tgtx, midY, COL.red, 'TARGET');
      arrow(g, sx + 12, midY - 10, mslx - 8, midY - 10, COL.green, 6); lbl(g, (sx + mslx) / 2 - 18, midY - 16, 'PIP uplink', COL.green, 'left', 8);
      arrow(g, mslx - 8, midY + 10, sx + 12, midY + 10, COL.amber, 6); lbl(g, (sx + mslx) / 2 - 24, midY + 22, 'seeker/status downlink', COL.amber, 'left', 8);
    } else {
      // network mesh
      const nodes = [[sx, midY + 30, COL.blue, 'FIGHTER'], [sx + 30, 40, COL.green, 'AWACS'], [_V.w - 90, 44, COL.blue, 'F-35'], [_V.w - 60, midY + 40, COL.blue, 'SHIP']];
      for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) { g.strokeStyle = 'rgba(34,255,156,.3)'; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(nodes[i][0], nodes[i][1]); g.lineTo(nodes[j][0], nodes[j][1]); g.stroke(); g.setLineDash([]); }
      nodes.forEach(n => jet(n[0], n[1], n[2], n[3]));
      msl(mslx, midY - 4); jet(tgtx, midY + 60, COL.red, 'TARGET');
      arrow(g, nodes[2][0], nodes[2][1] + 6, mslx + 4, midY - 8, COL.amber, 6); lbl(g, mslx + 10, midY - 14, 'engage-on-remote', COL.amber, 'left', 8);
    }
    lbl(g, 10, 16, M.nm, COL.blue, 'left', 10, true);
    read.innerHTML = `<div class="wx-hint">${M.desc} <a data-goto="datalinknet">(datalink networks section)</a></div>`;
  }
  sync();
  const onResize = () => { fit(); draw(); }; window.addEventListener('resize', onResize); draw();
  _V.redraw = draw;
  return () => window.removeEventListener('resize', onResize);
});

// ── 10 · GUIDANCE-LAW PATH COMPARISON ────────────────────────────────────────
reg('guidancecompare', (node) => {
  const _V = makeCanvas(node, 250); const { cv, g, fit } = _V;
  const controls = el('div', { class: 'wx-controls' }); node.appendChild(controls);
  const read = el('div', { class: 'wx-readout' }); node.appendChild(read);
  const LAWS = { pursuit: { c: COL.red, nm: 'Pure Pursuit' }, lead: { c: COL.amber, nm: 'Lead / deviated' }, pn: { c: COL.green, nm: 'Proportional Nav' } };
  let on = { pursuit: true, lead: true, pn: true };
  Object.keys(LAWS).forEach(k => { const b = el('label', { class: 'wx-chk' }, [el('input', { type: 'checkbox', checked: on[k] ? '' : null, onchange: (e) => { on[k] = e.target.checked; } }), el('span', {}, LAWS[k].nm)]); b.querySelector('span').style.color = LAWS[k].c; controls.appendChild(b); });
  const btn = el('button', { class: 'wx-btn', onclick: () => reset() }, '↻ Re-run'); controls.appendChild(btn);
  let paths, tgtPath, t0, builtW = 0;
  function reset() {
    builtW = _V.w;   // remember the width these paths were baked for
    // simulate each law kinematically to intercept a crossing target
    const start = [40, _V.h - 30], tgt0 = [_V.w * 0.45, 30], tv = [42, 0], msp = 90;
    paths = {}; tgtPath = [];
    for (const law of Object.keys(LAWS)) {
      const m = [...start]; let v = [0, -msp]; const pts = [[...m]]; let tp = [...tgt0]; let prevLos = null;
      for (let step = 0; step < 400; step++) {
        tp = [tgt0[0] + tv[0] * step * 0.02, tgt0[1]];
        const d = [tp[0] - m[0], tp[1] - m[1]], rng = Math.hypot(...d) || 1;
        const los = Math.atan2(d[1], d[0]);
        let desired;
        if (law === 'pursuit') desired = los;
        else if (law === 'lead') desired = los + Math.atan2(tv[0] * 0.35, rng);
        else { const losRate = prevLos == null ? 0 : Math.atan2(Math.sin(los - prevLos), Math.cos(los - prevLos)); const vh = Math.atan2(v[1], v[0]); desired = vh + 4 * losRate; }
        prevLos = los;
        const vh = Math.atan2(v[1], v[0]); let dv = Math.atan2(Math.sin(desired - vh), Math.cos(desired - vh));
        dv = Math.max(-0.14, Math.min(0.14, dv)); const nh = vh + dv;
        v = [Math.cos(nh) * msp, Math.sin(nh) * msp]; m[0] += v[0] * 0.02; m[1] += v[1] * 0.02;
        pts.push([...m]); if (rng < 8 || m[1] < 0 || m[0] > _V.w) break;
      }
      paths[law] = pts;
    }
    // target straight path
    for (let s = 0; s < 200; s++) { const x = tgt0[0] + tv[0] * s * 0.02; if (x > _V.w) break; tgtPath.push([x, tgt0[1]]); }
    t0 = performance.now();
  }
  reset();
  const stop = frame((now) => {
    // rebuild the baked trajectories if the canvas got its real width after mount
    if (Math.abs(_V.w - builtW) > 4) reset();
    const T = (now - t0) / 1000; const prog = Math.min(1, T / 3);
    g.clearRect(0, 0, _V.w, _V.h);
    lbl(g, 10, 16, 'SAME SHOT, THREE GUIDANCE LAWS', COL.blue, 'left', 10, true);
    // target path (dashed) + marker
    g.strokeStyle = 'rgba(255,90,42,.5)'; g.lineWidth = 1.5; g.setLineDash([4, 4]); g.beginPath();
    tgtPath.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); g.setLineDash([]);
    const ti = Math.min(tgtPath.length - 1, Math.floor(prog * tgtPath.length));
    if (tgtPath[ti]) { g.fillStyle = COL.red; g.beginPath(); g.arc(tgtPath[ti][0], tgtPath[ti][1], 5, 0, 7); g.fill(); lbl(g, tgtPath[ti][0] + 6, tgtPath[ti][1] - 6, 'TGT', COL.red, 'left', 8); }
    for (const law of Object.keys(LAWS)) {
      if (!on[law]) continue; const pts = paths[law];
      // full path always visible (compare all three at a glance) + animated head
      g.strokeStyle = LAWS[law].c; g.lineWidth = 2; g.beginPath();
      for (let i = 0; i < pts.length; i++) i ? g.lineTo(pts[i][0], pts[i][1]) : g.moveTo(pts[i][0], pts[i][1]); g.stroke();
      const hi = Math.min(pts.length - 1, Math.max(0, Math.floor(prog * pts.length)));
      const h = pts[hi]; g.fillStyle = LAWS[law].c; g.shadowColor = LAWS[law].c; g.shadowBlur = 6;
      g.beginPath(); g.arc(h[0], h[1], 4, 0, 7); g.fill(); g.shadowBlur = 0;
    }
    // missile launch point
    g.fillStyle = COL.ink; g.beginPath(); g.arc(40, _V.h - 30, 3, 0, 7); g.fill();
    lbl(g, 46, _V.h - 26, 'launch', COL.dim, 'left', 8);
    read.innerHTML = `<div class="wx-hint"><b style="color:${COL.red}">Pure pursuit</b> always points the nose <i>at the target now</i> → a long curved tail-chase that arrives late and slow (what a naive heat-seeker does). <b style="color:${COL.amber}">Lead pursuit</b> aims a fixed angle ahead — better, but not adaptive. <b style="color:${COL.green}">Proportional Navigation</b> steers to null the <a data-goto="guidance">line-of-sight rotation</a>, flying the <b>collision triangle</b> to a near-straight, energy-efficient intercept — why every real homing missile uses PN or a variant (APN adds target-accel lead; OGL adds gravity/optimality). <b>CLOS/beam-riding</b> (not shown) instead keeps the missile on the launcher→target line for command-guided SAMs.</div>`;
  });
  const onResize = () => fit(); window.addEventListener('resize', onResize);
  return () => { stop(); window.removeEventListener('resize', onResize); };
});

// ═════════════════════════════════════════════════════════════════════════════
//  GAMIFICATION v4 — medals, mastery web, the Decision Drill, the Weapon Codex
//  More ways to earn, track and see your progress. All persisted in localStorage.
// ═════════════════════════════════════════════════════════════════════════════

// ── the medal roster. Each test(p) reads the persisted progress singleton. ──
const ACHIEVEMENTS = [
  { id: 'first_read',    icon: '📖', name: 'First Contact',   desc: 'Read your first topic.',                 test: p => p.readCount() >= 1 },
  { id: 'ground_school', icon: '📚', name: 'Ground School',   desc: 'Read 10 topics.',                        test: p => p.readCount() >= 10 },
  { id: 'full_syllabus', icon: '🎓', name: 'Full Syllabus',   desc: 'Read every topic in the guide.',         test: p => p.total > 0 && p.readCount() >= p.total },
  { id: 'check_ride',    icon: '✍',  name: 'Check-Ride',      desc: 'Complete a check-ride quiz.',            test: p => p.stats().runs >= 1 },
  { id: 'sharpshooter',  icon: '🎯', name: 'Sharpshooter',    desc: 'Hit a 5-answer quiz streak.',            test: p => p.stats().streakBest >= 5 },
  { id: 'top_gun',       icon: '⚔',  name: 'TOP GUN',         desc: 'Ace a check-ride — 8 of 8.',             test: p => p.stats().quizBest >= 8 },
  { id: 'first_blood',   icon: '♟',  name: 'First Blood',     desc: 'Solve a tactical challenge.',            test: p => p.challengesSolved() >= 1 },
  { id: 'tactician',     icon: '◈',  name: 'Tactician',       desc: 'Solve every tactical challenge.',        test: p => p.challengesSolved() >= CHALLENGES.length },
  { id: 'loadmaster',    icon: '🔗', name: 'Loadmaster',      desc: 'Identify every weapon in the match game.', test: p => p.matchCount() >= CARDS.length },
  { id: 'quick_draw',    icon: '⏱',  name: 'Quick Draw',      desc: 'Score 80+ in the Decision Drill.',       test: p => p.drillBest() >= 80 },
  { id: 'regular',       icon: '🔥', name: 'Regular',         desc: '3-day sortie streak.',                   test: p => p.sortie().best >= 3 },
  { id: 'committed',     icon: '🔥', name: 'Committed',       desc: '7-day sortie streak.',                   test: p => p.sortie().best >= 7 },
  { id: 'collector',     icon: '🃏', name: 'Collector',       desc: 'Study your first codex card.',           test: p => p.codexCount() >= 1 },
  { id: 'codex_done',    icon: '🏆', name: 'Codex Complete',  desc: 'Study every weapon in the codex.',       test: p => p.codexCount() >= CODEX.length },
  { id: 'four_figure',   icon: '✈',  name: 'Four-Figure Hours', desc: 'Reach 1000 XP.',                       test: p => p.xp() >= 1000 },
  { id: 'tinkerer',      icon: '🧭', name: 'Tinkerer',        desc: 'Play with 5 different lab widgets.',     test: p => p.touchedCount() >= 5 },
];

// ── the collectible weapon codex — real, teaching-accurate signature cards ──
// bars are relative 0-1 teaching indices (range, top speed, NEZ size, agility)
const CODEX = [
  { id: 'aim9x', name: 'AIM-9X', side: 'US · WVR', motor: 'Solid, thrust-vectoring', seeker: 'Imaging IR (IIR)',
    rng: 30, mach: 2.5, nez: 30, agl: 98,
    note: 'The knife-fighter. Helmet-cued high-off-boresight IR shots far off the nose; TVC gives blistering first-second agility. No datalink — pure fire-and-forget inside the visual arena.' },
  { id: 'aim120d', name: 'AIM-120D', side: 'US · BVR', motor: 'Boost-sustain solid', seeker: 'Active radar (ARH)',
    rng: 160, mach: 4, nez: 55, agl: 65,
    note: 'The Western workhorse. Two-way datalink, lofts midcourse, goes "pitbull" active in the endgame. The D grew range and no-escape zone markedly over the C-series.' },
  { id: 'meteor', name: 'MBDA Meteor', side: 'EU · BVR', motor: 'Throttleable ramjet', seeker: 'Active radar (ARH)',
    rng: 200, mach: 4, nez: 96, agl: 62,
    note: 'The energy king. A throttleable ducted-rocket ramjet keeps thrust to the merge, giving the largest no-escape zone of any air-to-air missile — you can\'t simply out-run it.' },
  { id: 'pl15', name: 'PL-15', side: 'CN · BVR', motor: 'Dual-pulse solid', seeker: 'AESA active radar',
    rng: 250, mach: 5, nez: 82, agl: 55,
    note: 'The long arm. A second motor pulse re-lights in the endgame to restore terminal energy; an AESA seeker resists jamming. Drove Western interest in very-long-range AAMs.' },
  { id: 'r37m', name: 'R-37M', side: 'RU · VLR', motor: 'Boost + long coast', seeker: 'Active/SARH',
    rng: 300, mach: 6, nez: 68, agl: 40,
    note: 'The sniper. A huge Mach-6 interceptor round flung from a MiG-31 or Su-35 to swat tankers, AWACS and bombers at extreme range. Fast and far, but not a dogfighter.' },
  { id: 'r77', name: 'R-77 (RVV-AE)', side: 'RU · BVR', motor: 'Solid', seeker: 'Active radar (ARH)',
    rng: 110, mach: 4, nez: 45, agl: 70,
    note: 'The AMRAAM analogue, famous for its gridfin tails. Agile and fire-and-forget; later RVV-SD/-BD variants stretch the range considerably.' },
  { id: 'mica', name: 'MBDA MICA', side: 'EU · Med', motor: 'Solid, TVC', seeker: 'IR or RF (two versions)',
    rng: 80, mach: 4, nez: 40, agl: 82,
    note: 'One airframe, two seekers (imaging-IR or active-radar) sharing a launcher — flexibility from WVR out to medium BVR, with thrust-vectoring agility.' },
  { id: 'aim7', name: 'AIM-7 Sparrow', side: 'US · Legacy', motor: 'Boost-sustain solid', seeker: 'Semi-active radar (SARH)',
    rng: 50, mach: 4, nez: 25, agl: 55,
    note: 'The classic umbilical shot: the launching fighter must illuminate the target all the way to impact — no crank, no cold. Superseded by AMRAAM\'s fire-and-forget.' },
  { id: 's400', name: 'S-400 40N6', side: 'RU · SAM', motor: 'Boost + huge loft', seeker: 'Active radar (ARH)',
    rng: 380, mach: 6.5, nez: 76, agl: 45,
    note: 'The area-denial giant. Very-long-range surface-to-air round with an active seeker for over-the-horizon engagements when cued by an elevated sensor. Forces strikers low.' },
  { id: 'pac3', name: 'MIM-104 PAC-3', side: 'US · SAM', motor: 'Solid + attitude thrusters', seeker: 'Ka-band active',
    rng: 35, mach: 5, nez: 62, agl: 96,
    note: 'Hit-to-kill: no warhead, it destroys the target by direct impact using tiny attitude-control thrusters for pinpoint terminal agility. Optimised against ballistic missiles.' },
];

// ── Decision Drill question bank — snappy tactical calls under a timer ──
const DRILL = [
  { q: 'RWR: nails 12 o\'clock, 35 km, closing. Your MAR here is 30 km. CALL IT.',
    a: ['Press for your own shot', 'Abort cold — you\'re outside MAR', 'Hold heading, pop chaff', 'Climb for energy'],
    correct: 1, why: 'Outside MAR a timely cold abort defeats the shot kinematically — the missile runs out of energy.' },
  { q: 'You fired FOX-3 at 40 km; your missile is midcourse on the datalink.',
    a: ['Fly straight, keep guiding him in', 'Crank to the gimbal limit', 'Turn cold immediately', 'Descend to the deck'],
    correct: 1, why: 'Cranking keeps the datalink alive while opening range and growing your F-pole/A-pole.' },
  { q: 'Bandit swings to ~90° aspect, slows, and blooms chaff.',
    a: ['He\'s committing hot', 'He\'s notching your pulse-Doppler', 'He\'s bingo fuel', 'He\'s zooming'],
    correct: 1, why: 'Beam + chaff = trying to fall into your zero-Doppler clutter notch and vanish.' },
  { q: 'Merge in 5 s vs a 5th-gen with helmet sight + high-off-boresight IR.',
    a: ['Take the merge, out-turn him', 'Avoid the merge — it\'s near mutual death', 'Go pure vertical', 'Guns-only pass'],
    correct: 1, why: 'HOBS + HMS means both jets can shoot in the first second. Don\'t donate the merge — win it BVR.' },
  { q: 'Your SARH Sparrow is 8 s from impact when a new threat appears.',
    a: ['Crank away, it self-guides', 'You can\'t leave — SARH needs your illumination to impact', 'Go cold, notch the new guy', 'Descend'],
    correct: 1, why: 'A semi-active shot is umbilical to your radar — break lock and your own missile goes ballistic.' },
  { q: 'Low strike inside a 400 km SAM ring, 45 km out, still un-engaged. Why?',
    a: ['Missile too slow to turn', 'He\'s below the radar horizon', 'Warhead won\'t arm that close', 'Too much chaff'],
    correct: 1, why: 'Radar is line-of-sight; a low flyer hides under the curved-earth horizon until close.' },
  { q: 'Your ramjet missile decelerates through Mach 1.6 chasing a dragging target.',
    a: ['Command a relight', 'It\'s flamed out for good — air-breathers don\'t relight', 'Add throttle', 'Loft to recover'],
    correct: 1, why: 'Below minimum intake Mach the ducted rocket cannot run or relight — a real defeat mechanism.' },
  { q: 'An enemy noise jammer is screaming on your nose at 20 km.',
    a: ['Break lock — it\'s hopeless', 'Home-on-jam: guide on the strobe itself', 'Shut down your radar', 'Just add chaff'],
    correct: 1, why: 'A loud jammer is a bright beacon — HOJ turns its own emission into the aimpoint.' },
  { q: 'You\'re 15 km behind a co-speed bandit, tail-on (his 6 o\'clock).',
    a: ['Max closure, he sees you', 'Cold aspect — minimum closure, best seat in the house', 'Beam geometry', 'Hot, shot incoming'],
    correct: 1, why: 'Stern/cold: you\'re behind him with minimum closure and he can\'t easily shoot back.' },
  { q: 'Two-ship BVR: lead shoots and calls "SKATE."',
    a: ['Press on to the merge', 'Launch-and-leave — be cold by MAR', 'Illuminate to impact', 'Fly the beam in'],
    correct: 1, why: 'SKATE = shoot, then abort out before the threat\'s MAR/NEZ. Take the shot, don\'t take the merge.' },
  { q: 'PN shot: the target\'s bearing off your nose is NOT changing; range shrinking.',
    a: ['You\'ll miss behind him', 'Collision course — constant bearing, decreasing range', 'He\'s turning cold', 'Time to notch'],
    correct: 1, why: 'Constant bearing + closing range = collision. Nulling that LOS rotation is the whole basis of PN.' },
  { q: 'Stealth target at RCS 0.001 m² vs a 1 m² fighter, same radar.',
    a: ['Seen at the same range', 'Seen at roughly 1/5 the range (fourth-root law)', 'Never seen at all', 'Seen farther away'],
    correct: 1, why: 'R_detect ∝ σ^(1/4): a 1000× smaller RCS shrinks detection range to ~0.18× — the timeline collapses.' },
];

// ─────────────────────────────────────────────────────────────────────────────
//  MEDAL WALL — sortie streak + the full achievement roster (locked/unlocked)
// ─────────────────────────────────────────────────────────────────────────────
reg('achievements', (node) => {
  const wrap = el('div', { class: 'wx-ach' });
  node.appendChild(wrap);
  function render() {
    const list = progress.achievements();
    const got = list.filter(a => a.got).length;
    const s = progress.sortie();
    const w = progress.wing();
    wrap.innerHTML = '';
    const head = el('div', { class: 'ach-head' });
    head.innerHTML =
      `<div class="ach-streak"><span class="ach-flame">🔥</span> <b>${s.days}</b>-day sortie streak <i>(best ${s.best})</i></div>` +
      `<div class="ach-count"><b style="color:${got === list.length ? COL.green : COL.amber}">${got}/${list.length}</b> medals · ✈ ${w.name} · ${w.xp} XP</div>`;
    wrap.appendChild(head);
    const grid = el('div', { class: 'ach-grid' });
    list.forEach(a => {
      const cell = el('div', { class: 'ach-medal ' + (a.got ? 'got' : 'locked') });
      cell.innerHTML = `<div class="ach-ic">${a.got ? a.icon : '🔒'}</div>` +
                       `<div class="ach-nm">${a.name}</div><div class="ach-dc">${a.desc}</div>`;
      grid.appendChild(cell);
    });
    wrap.appendChild(grid);
    const reset = el('button', { class: 'wx-btn ach-reset', onclick: () => {
      if (!confirm('Reset ALL learning progress?\n\nThis clears your XP, rank, medals, sortie streak, codex, quiz scores, bookmark and every topic-read mark. This cannot be undone.')) return;
      progress.reset();
      render();
      if (window._aegisRankRefresh) window._aegisRankRefresh();
      if (window._aegisMasteryRefresh) window._aegisMasteryRefresh();
    } }, '↺ Reset all learning progress');
    wrap.appendChild(reset);
  }
  render();
  window._aegisAchRefresh = render;   // toasts re-render the wall live
  return () => { if (window._aegisAchRefresh === render) window._aegisAchRefresh = null; };
});

// ─────────────────────────────────────────────────────────────────────────────
//  MASTERY WEB — a radar/spider chart of how much of each category you've read
// ─────────────────────────────────────────────────────────────────────────────
reg('masteryweb', (node) => {
  const _V = makeCanvas(node, 340); const { g } = _V;
  const cap = el('div', { class: 'wx-hint' }); node.appendChild(cap);
  const data = () => (window._aegisCatMastery || []).filter(c => c.total > 0);
  function draw() {
    const D = data();
    g.clearRect(0, 0, _V.w, _V.h);
    if (!D.length) {
      g.fillStyle = COL.dim; g.font = '12px "JetBrains Mono"';
      g.fillText('Open some topics to chart your mastery…', 20, _V.h / 2);
      cap.innerHTML = ''; return;
    }
    const cx = _V.w / 2, cy = _V.h / 2, R0 = Math.min(_V.w, _V.h) / 2 - 52, N = D.length;
    const pt = (i, r) => { const a = -Math.PI / 2 + i / N * 2 * Math.PI; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
    for (let ring = 1; ring <= 4; ring++) {
      g.strokeStyle = 'rgba(78,128,178,0.16)'; g.lineWidth = 1; g.beginPath();
      for (let i = 0; i <= N; i++) { const [x, y] = pt(i % N, R0 * ring / 4); i ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
    }
    D.forEach((c, i) => {
      const [ex, ey] = pt(i, R0);
      g.strokeStyle = 'rgba(78,128,178,0.22)'; g.beginPath(); g.moveTo(cx, cy); g.lineTo(ex, ey); g.stroke();
      const [lx, ly] = pt(i, R0 + 18);
      const a = -Math.PI / 2 + i / N * 2 * Math.PI;
      g.fillStyle = c.frac >= 1 ? COL.green : COL.dim; g.font = '9px "JetBrains Mono"';
      g.textAlign = Math.abs(Math.cos(a)) < 0.35 ? 'center' : (Math.cos(a) > 0 ? 'left' : 'right');
      g.textBaseline = 'middle'; g.fillText(c.short, lx, ly);
    });
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.beginPath();
    D.forEach((c, i) => { const [x, y] = pt(i, R0 * Math.max(0.02, c.frac)); i ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.closePath(); g.fillStyle = 'rgba(34,255,156,0.15)'; g.fill();
    g.strokeStyle = COL.green; g.lineWidth = 2; g.stroke();
    D.forEach((c, i) => { const [x, y] = pt(i, R0 * Math.max(0.02, c.frac)); g.fillStyle = c.frac >= 1 ? COL.green : COL.amber; g.beginPath(); g.arc(x, y, 2.6, 0, 7); g.fill(); });
    const done = D.filter(c => c.frac >= 1).length;
    cap.innerHTML = `Your <b>mastery web</b>: each spoke is a topic category, filled to how much of it you\'ve read. ` +
      `<b style="color:${COL.green}">${done}/${D.length}</b> categories fully mastered — round out the shape to climb the ranks.`;
  }
  _V.redraw = draw; draw();
  window._aegisMasteryRefresh = draw;
  return () => { if (window._aegisMasteryRefresh === draw) window._aegisMasteryRefresh = null; };
});

// ─────────────────────────────────────────────────────────────────────────────
//  DECISION DRILL — timed tactical calls; speed + accuracy = score. Replayable.
// ─────────────────────────────────────────────────────────────────────────────
reg('decisiondrill', (node) => {
  const ROUNDS = 8, TIME = 8.0;
  let deck = [], order = [], idx = 0, score = 0, running = false, tLeft = 0, tPrev = 0, raf = 0, answered = false;
  const wrap = el('div', { class: 'wx-drill' });
  node.appendChild(wrap);

  function stopTimer() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  function begin() { deck = [...DRILL].sort(() => Math.random() - 0.5).slice(0, ROUNDS); idx = 0; score = 0; running = true; nextRound(); }
  function nextRound() {
    if (idx >= deck.length) { finish(); return; }
    // shuffle the answer positions each round so the right call isn't always in the same slot
    order = deck[idx].a.map((_, i) => i).sort(() => Math.random() - 0.5);
    answered = false; tLeft = TIME; tPrev = performance.now(); render(); runTimer();
  }
  function runTimer() {
    stopTimer();
    const step = (t) => {
      if (!running || answered) return;
      tLeft -= (t - tPrev) / 1000; tPrev = t;
      if (tLeft <= 0) { tLeft = 0; paintBar(); resolve(-1); return; }
      paintBar(); raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }
  function paintBar() {
    const bar = wrap.querySelector('.drill-fill');
    if (!bar) return;
    const f = Math.max(0, tLeft / TIME);
    bar.style.width = (f * 100) + '%';
    bar.style.background = f > 0.5 ? COL.green : f > 0.25 ? COL.amber : COL.red;
  }
  function render() {
    const c = deck[idx];
    wrap.innerHTML = '';
    wrap.appendChild(el('div', { class: 'wx-qmeta' }, `DRILL ${idx + 1}/${ROUNDS} · score ${score} · best ${progress.drillBest()}`));
    wrap.appendChild(el('div', { class: 'drill-timer' }, el('i', { class: 'drill-fill' })));
    wrap.appendChild(el('div', { class: 'wx-q' }, c.q));
    const opts = el('div', { class: 'wx-opts' });
    order.forEach(orig => opts.appendChild(el('button', { class: 'wx-opt', onclick: () => resolve(orig) }, c.a[orig])));
    wrap.appendChild(opts);
    wrap.appendChild(el('div', { class: 'wx-why', id: 'drill-why' }));
    paintBar();
  }
  function resolve(pick) {
    if (answered) return; answered = true; stopTimer();
    const c = deck[idx];
    const ok = pick === c.correct;
    const bonus = ok ? Math.round(tLeft) : 0;      // faster = more points
    if (ok) score += 10 + bonus;
    const opts = wrap.querySelector('.wx-opts');
    [...opts.children].forEach((b, d) => { const orig = order[d]; b.classList.add(orig === c.correct ? 'correct' : (orig === pick ? 'wrong' : 'dim')); b.disabled = true; });
    const why = wrap.querySelector('#drill-why');
    const head = pick === -1 ? `<b style="color:${COL.red}">⏱ Too slow.</b>` : (ok ? `<b style="color:${COL.green}">✓ +${10 + bonus} (speed +${bonus})</b>` : `<b style="color:${COL.red}">✗ Reconsider.</b>`);
    why.innerHTML = `${head} ${c.why}`;
    const nxt = el('button', { class: 'wx-btn', style: 'margin-top:10px', onclick: () => { idx++; nextRound(); } }, idx === deck.length - 1 ? 'See result →' : 'Next call →');
    why.appendChild(el('div', {}, nxt));
  }
  function finish() {
    running = false; stopTimer();
    const best = progress.drillResult(score);
    const max = ROUNDS * 18;
    const grade = score >= 120 ? ['ACE — lightning calls.', COL.green] : score >= 80 ? ['SOLID — you\'d survive the fight.', COL.green] : score >= 40 ? ['GETTING THERE — read the doctrine sections.', COL.amber] : ['REVIEW — hit the BVR doctrine topics and retry.', COL.red];
    wrap.innerHTML = '';
    wrap.appendChild(el('div', { class: 'wx-qmeta' }, `DRILL COMPLETE`));
    wrap.appendChild(el('div', { class: 'drill-score' }, [el('b', { style: `color:${grade[1]}` }, String(score)), ` / ${max}   ·   best ${best}`]));
    wrap.appendChild(el('div', { class: 'wx-line', style: `color:${grade[1]}` }, grade[0]));
    wrap.appendChild(el('div', { class: 'wx-hint' }, 'The drill rewards fast, correct doctrine calls — exactly what a BVR timeline demands. 80+ earns the Quick Draw medal.'));
    wrap.appendChild(el('button', { class: 'wx-btn', style: 'margin-top:10px', onclick: begin }, '↻ Run it again'));
  }
  // intro card
  wrap.appendChild(el('div', { class: 'wx-q' }, '8 tactical calls. A timer on each — the faster you make the right call, the more points. Ready?'));
  wrap.appendChild(el('button', { class: 'wx-btn', onclick: begin }, '▶ START DRILL'));
  return () => { running = false; stopTimer(); };
});

// ─────────────────────────────────────────────────────────────────────────────
//  WEAPON CODEX — collectible signature-weapon cards with live stat bars
// ─────────────────────────────────────────────────────────────────────────────
reg('codex', (node) => {
  const wrap = el('div', { class: 'wx-codex' });
  const head = el('div', { class: 'codex-head' });
  const grid = el('div', { class: 'codex-grid' });
  node.appendChild(head); node.appendChild(wrap); wrap.appendChild(grid);
  const bars = (c) => {
    const rows = [['RANGE', c.rng / 400, COL.blue, c.rng + ' km'],
                  ['SPEED', c.mach / 7, COL.amber, 'M' + c.mach],
                  ['NEZ', c.nez / 100, COL.green, c.nez + '%'],
                  ['AGILITY', c.agl / 100, COL.red, c.agl + '%']];
    return rows.map(([lab, f, col, val]) =>
      `<div class="cx-bar"><span class="cx-bl">${lab}</span>` +
      `<span class="cx-bt"><i style="width:${Math.min(100, f * 100)}%;background:${col}"></i></span>` +
      `<span class="cx-bv">${val}</span></div>`).join('');
  };
  function refreshHead() {
    const n = progress.codexCount();
    head.innerHTML = `<b style="color:${n >= CODEX.length ? COL.green : COL.amber}">${n}/${CODEX.length}</b> weapons studied — tap a card to study it (+12 XP each). Complete the codex for the 🏆 medal.`;
  }
  function card(c) {
    const done = progress.studied(c.id);
    const cell = el('div', { class: 'codex-card' + (done ? ' studied' : '') });
    cell.innerHTML =
      `<div class="cx-top"><span class="cx-name">${c.name}</span><span class="cx-side">${c.side}</span></div>` +
      `<div class="cx-spec"><span>◗ ${c.motor}</span><span>◎ ${c.seeker}</span></div>` +
      `<div class="cx-bars">${bars(c)}</div>` +
      `<div class="cx-note" ${done ? '' : 'hidden'}>${c.note}</div>` +
      `<div class="cx-foot">${done ? '✓ STUDIED' : '＋ STUDY  (+12 XP)'}</div>`;
    cell.addEventListener('click', () => {
      const wasNew = !progress.studied(c.id);
      progress.studyCard(c.id);
      cell.classList.add('studied');
      const note = cell.querySelector('.cx-note'); if (note) note.hidden = false;
      cell.querySelector('.cx-foot').textContent = '✓ STUDIED';
      if (wasNew) refreshHead();
    });
    return cell;
  }
  refreshHead();
  CODEX.forEach(c => grid.appendChild(card(c)));
  return () => {};
});

// ═════════════════════════════════════════════════════════════════════════════
//  DEEP BVR WIDGETS — the pole game, energy-maneuverability, the 2-ship bracket
// ═════════════════════════════════════════════════════════════════════════════

// ── THE POLE GAME — crank to grow your A-pole and F-pole ──────────────────────
reg('fpole', (node) => {
  const _V = makeCanvas(node, 360); const { g } = _V;
  const ctr = el('div', { class: 'wx-controls' }); node.appendChild(ctr);
  const read = el('div', { class: 'wx-readout' }); node.appendChild(read);
  let R0 = 37, crank = 45;                    // shot range (km), crank angle (° off nose)
  const sR = slider('Shot range (km)', 15, 55, 1, R0, v => { R0 = v; draw(); });
  const sC = slider('Your crank (° off the nose)', 0, 120, 5, crank, v => { crank = v; draw(); });
  ctr.appendChild(sR.row); ctr.appendChild(sC.row);

  // top-down kinematics (km, s). You + missile launch from origin; the bandit
  // starts R0 "north", committed hot (drives at your launch point).
  function sim() {
    const Vown = 0.30, Vb = 0.27, Vm = 1.05;  // km/s teaching speeds (~M0.9 / M3.2)
    const th = crank * Math.PI / 180, dt = 0.08, Ra = 13; // Ra = pitbull range
    let Y = [0, 0], B = [0, R0], M = [0, 0];
    const yv = [Math.sin(th) * Vown, Math.cos(th) * Vown];
    const tk = { y: [[0, 0]], m: [[0, 0]], b: [[0, R0]] };
    let apole = null, apAt = null, fpole = null, impact = null;
    for (let i = 0; i < 2000; i++) {
      const bl = Math.hypot(B[0], B[1]) || 1e-6;              // bandit → origin
      B = [B[0] - B[0] / bl * Vb * dt, B[1] - B[1] / bl * Vb * dt];
      const md = [B[0] - M[0], B[1] - M[1]], ml = Math.hypot(md[0], md[1]) || 1e-6;
      M = [M[0] + md[0] / ml * Vm * dt, M[1] + md[1] / ml * Vm * dt]; // missile pursues
      Y = [Y[0] + yv[0] * dt, Y[1] + yv[1] * dt];             // you crank
      if (i % 2 === 0) { tk.y.push([...Y]); tk.m.push([...M]); tk.b.push([...B]); }
      const mb = Math.hypot(B[0] - M[0], B[1] - M[1]);
      if (apole == null && mb <= Ra) { apole = Math.hypot(B[0] - Y[0], B[1] - Y[1]); apAt = [[...Y], [...B]]; }
      if (mb <= 0.25) { fpole = Math.hypot(B[0] - Y[0], B[1] - Y[1]); impact = [[...Y], [...B]]; break; }
      if (Math.hypot(B[0], B[1]) < 0.3) break;
    }
    return { tk, apole, fpole, apAt, impact };
  }
  function draw() {
    const s = sim();
    g.clearRect(0, 0, _V.w, _V.h);
    const all = [...s.tk.y, ...s.tk.m, ...s.tk.b];
    let minX = 0, maxX = 0, maxY = R0;
    all.forEach(p => { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); maxY = Math.max(maxY, p[1]); });
    const padX = 26, padY = 24, w = _V.w, h = _V.h;
    const spanX = Math.max(maxX - minX, 8), spanY = Math.max(maxY, 8);
    const sc = Math.min((w - 2 * padX) / spanX, (h - 2 * padY) / spanY);
    const X = kmx => padX + (kmx - minX) * sc;
    const Yc = kmy => h - padY - kmy * sc;                    // north = up
    const line = (pts, col, wdt, dash) => {
      g.strokeStyle = col; g.lineWidth = wdt; g.setLineDash(dash || []);
      g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(X(p[0]), Yc(p[1])) : g.moveTo(X(p[0]), Yc(p[1]))); g.stroke(); g.setLineDash([]);
    };
    // LOS at launch
    line([[0, 0], [0, R0]], 'rgba(147,172,203,.28)', 1, [4, 4]);
    line(s.tk.b, COL.red, 2);       // bandit
    line(s.tk.m, COL.green, 2);     // your missile
    line(s.tk.y, COL.blue, 2.4);    // you (cranking)
    // launch marker
    g.fillStyle = COL.ink; g.beginPath(); g.arc(X(0), Yc(0), 3, 0, 7); g.fill();
    lbl(g, X(0) + 6, Yc(0) + 2, 'FOX-3', COL.dim, 'left', 8);
    // A-pole (dashed cyan) + F-pole (dashed amber) chords
    if (s.apAt) { line([s.apAt[0], s.apAt[1]], 'rgba(0,229,255,.5)', 1.4, [3, 3]);
      g.fillStyle = COL.blue; g.beginPath(); g.arc(X(s.apAt[1][0]), Yc(s.apAt[1][1]), 3, 0, 7); g.fill();
      lbl(g, X(s.apAt[1][0]) + 5, Yc(s.apAt[1][1]), 'pitbull', COL.blue, 'left', 8); }
    if (s.impact) { line([s.impact[0], s.impact[1]], COL.amber, 1.6, [5, 3]);
      g.fillStyle = COL.amber; g.beginPath(); g.arc(X(s.impact[1][0]), Yc(s.impact[1][1]), 4, 0, 7); g.fill();
      lbl(g, X(s.impact[1][0]) + 6, Yc(s.impact[1][1]), '✹ impact', COL.amber, 'left', 8);
      drawJet(g, X(s.impact[0][0]), Yc(s.impact[0][1]), crank * Math.PI / 180, COL.blue, 'YOU'); }
    const A = s.apole == null ? '—' : R(s.apole, 1), F = s.fpole == null ? '—' : R(s.fpole, 1);
    read.innerHTML =
      `<div class="wx-line"><b style="color:${COL.blue}">A-pole ${A} km</b> (your range from him when the missile goes active — you're free to turn) · ` +
      `<b style="color:${COL.amber}">F-pole ${F} km</b> (your range from him at impact).</div>` +
      `<div class="wx-hint">Flying <b>hot</b> (crank 0°) gets your missile there fastest but leaves you closest to him — small poles, max exposure to his return shot. <b>Cranking</b> toward your radar's gimbal limit (~50–60°) keeps the datalink alive while you open range — bigger A-pole and F-pole for the same kill. Past ~70–90° you'd <b>drag</b> and risk losing the lock (gimbal). The whole BVR game is buying separation without dropping him: <a data-goto="mar">time your abort at MAR</a>, and read the sim's <b>pole study</b> in ◈ TACTICAL-AI.</div>`;
  }
  _V.redraw = draw; draw();
  return () => {};
});

// ── ENERGY–MANEUVERABILITY — corner speed, turn rate & radius ─────────────────
reg('emdiagram', (node) => {
  const _V = makeCanvas(node, 340); const { g } = _V;
  const ctr = el('div', { class: 'wx-controls' }); node.appendChild(ctr);
  const read = el('div', { class: 'wx-readout' }); node.appendChild(read);
  let altk = 5, gmax = 9;
  const sA = slider('Altitude (km)', 0, 12, 0.5, altk, v => { altk = v; draw(); });
  const sG = slider('Structural G limit', 5, 12, 0.5, gmax, v => { gmax = v; draw(); });
  ctr.appendChild(sA.row); ctr.appendChild(sG.row);
  const G = 9.81, WS = 3400, CLmax = 1.5;      // wing loading N/m², max lift coeff
  const rho = h => 1.225 * Math.exp(-h / 8500);
  const a_sound = h => 340 - 3.9 * (h / 1000);  // rough speed of sound vs alt (m/s)
  function nAt(V, r) { return Math.min(0.5 * r * V * V * CLmax / WS, gmax); }
  function rateAt(V, r) { const n = nAt(V, r); return n <= 1 ? 0 : G * Math.sqrt(n * n - 1) / V; } // rad/s
  function draw() {
    const r = rho(altk * 1000), a = a_sound(altk * 1000);
    const Vlo = 90, Vhi = 620, w = _V.w, h = _V.h, padL = 40, padR = 14, padT = 16, padB = 30;
    // corner speed: where lift-limited n meets the structural cap
    const Vc = Math.sqrt(gmax * WS / (0.5 * r * CLmax));
    let peak = 0; for (let V = Vlo; V <= Vhi; V += 2) peak = Math.max(peak, rateAt(V, r));
    const maxRate = Math.max(peak * 1.1, 0.05);
    const X = V => padL + (V - Vlo) / (Vhi - Vlo) * (w - padL - padR);
    const Yc = rate => h - padB - (rate / maxRate) * (h - padT - padB);
    g.clearRect(0, 0, w, h);
    // axes
    g.strokeStyle = COL.grid; g.lineWidth = 1;
    g.beginPath(); g.moveTo(padL, padT); g.lineTo(padL, h - padB); g.lineTo(w - padR, h - padB); g.stroke();
    g.fillStyle = COL.faint; g.font = '9px "JetBrains Mono"';
    for (let V = 100; V <= 600; V += 100) { g.fillText(V + '', X(V) - 8, h - padB + 12); }
    lbl(g, w / 2, h - 4, 'true airspeed  (m/s)', COL.dim, 'center', 9);
    g.save(); g.translate(11, h / 2); g.rotate(-Math.PI / 2); g.textAlign = 'center';
    g.fillStyle = COL.dim; g.fillText('turn rate  (°/s)', 0, 0); g.restore();
    for (let dr = 5; dr <= maxRate * 57.3; dr += 5) { const y = Yc(dr / 57.3);
      g.strokeStyle = 'rgba(78,128,178,0.12)'; g.beginPath(); g.moveTo(padL, y); g.lineTo(w - padR, y); g.stroke();
      g.fillStyle = COL.faint; g.fillText(dr + '', 20, y + 3); }
    // shade lift-limited (left of corner) vs G-limited (right)
    g.fillStyle = 'rgba(0,229,255,.05)'; g.fillRect(padL, padT, X(Vc) - padL, h - padT - padB);
    g.fillStyle = 'rgba(255,61,0,.05)'; g.fillRect(X(Vc), padT, w - padR - X(Vc), h - padT - padB);
    // the turn-rate envelope
    g.strokeStyle = COL.green; g.lineWidth = 2.2; g.beginPath();
    let first = true; for (let V = Vlo; V <= Vhi; V += 2) { const y = Yc(rateAt(V, r)); first ? (g.moveTo(X(V), y), first = false) : g.lineTo(X(V), y); }
    g.stroke();
    // corner marker
    const cy = Yc(rateAt(Vc, r));
    g.strokeStyle = COL.amber; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(X(Vc), h - padB); g.lineTo(X(Vc), cy); g.stroke(); g.setLineDash([]);
    g.fillStyle = COL.amber; g.beginPath(); g.arc(X(Vc), cy, 4, 0, 7); g.fill();
    lbl(g, X(Vc), cy - 8, 'CORNER', COL.amber, 'center', 9);
    const rate = rateAt(Vc, r) * 57.3, radius = Vc * Vc / (G * Math.sqrt(gmax * gmax - 1));
    read.innerHTML =
      `<div class="wx-line">Corner speed <b style="color:${COL.amber}">${R(Vc)} m/s</b> (~M${R(Vc / a, 1)}) · peak turn <b style="color:${COL.green}">${R(rate, 1)}°/s</b> · tightest radius <b>${R(radius)} m</b>.</div>` +
      `<div class="wx-hint"><b style="color:${COL.blue}">Left of corner</b> you're <b>lift-limited</b> — too slow to pull max G, so you turn tightest but the rate suffers. <b style="color:${COL.red}">Right of corner</b> you're <b>G-limited</b> — plenty of lift but the structural cap holds you, and radius balloons with speed. The peak sits at <b>corner speed</b>: the best sustained turn lives right there. Climb (thinner air, slide the altitude slider) and corner speed rises while your turn decays — why the fight often <b>bleeds down</b> in altitude. This is the WVR side of <a data-goto="wvr">the merge</a>.</div>`;
  }
  _V.redraw = draw; draw();
  return () => {};
});

// ── THE 2-SHIP BRACKET — a section pincers a bandit (animated) ────────────────
reg('grinder', (node) => {
  const _V = makeCanvas(node, 340); const { g } = _V;
  const read = el('div', { class: 'wx-readout' }); node.appendChild(read);
  read.innerHTML = `<div class="wx-hint">A single fighter gives a bandit one problem. A <b>2-ship</b> gives him two he can't both solve. In a <b>bracket</b>, the section splits azimuth so the bandit can't point at both — the moment he commits to one (the <b>engaged</b> fighter drags him), the <b>free</b> fighter swings to his stern for the kill. That's the "grinder": trade who's engaged and who's free until someone gets the shot. Numbers and geometry, not heroics.</div>`;
  // smoothstep + parametric flight paths (s in 0..1). Clean, readable geometry.
  const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const bandit = (s, w, h) => [w / 2 - ss(0.4, 1, s) * 0.30 * w, 0.10 * h + s * 0.72 * h];
  const engaged = (s, w, h) => [w / 2 - (0.05 + ss(0, 0.5, s) * 0.26) * w, 0.9 * h - ss(0, 1, s) * 0.42 * h];
  const free = (s, w, h) => {
    const b = bandit(s, w, h), bracketX = w / 2 + (0.05 + ss(0, 0.45, s) * 0.24) * w;
    return [bracketX + ss(0.55, 1, s) * (b[0] + 0.07 * w - bracketX), 0.9 * h - ss(0, 1, s) * (0.9 * h - (b[1] + 0.11 * h))];
  };
  const heading = (fn, s, w, h) => { const a = fn(Math.max(0, s - 0.02), w, h), b = fn(Math.min(1, s + 0.02), w, h); return Math.atan2(b[0] - a[0], -(b[1] - a[1])); };
  const trail = (fn, p, col, w, h) => {
    g.lineWidth = 1; g.strokeStyle = 'rgba(120,140,170,.16)'; g.beginPath();
    for (let s = 0; s <= 1.0001; s += 0.02) { const q = fn(s, w, h); s ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); } g.stroke();
    g.lineWidth = 2; g.strokeStyle = col; g.beginPath();
    for (let s = 0; s <= p + 1e-6; s += 0.02) { const q = fn(s, w, h); s ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); } g.stroke();
  };
  const stop = frame((t) => {
    const w = _V.w, h = _V.h; g.clearRect(0, 0, w, h);
    const p = (t / 6000) % 1;
    trail(bandit, p, 'rgba(255,61,0,.65)', w, h);
    trail(engaged, p, 'rgba(0,229,255,.65)', w, h);
    trail(free, p, 'rgba(34,255,156,.65)', w, h);
    const B = bandit(p, w, h), E = engaged(p, w, h), F = free(p, w, h);
    drawJet(g, B[0], B[1], heading(bandit, p, w, h), COL.red, 'BANDIT');
    drawJet(g, E[0], E[1], heading(engaged, p, w, h), COL.blue, 'ENGAGED');
    drawJet(g, F[0], F[1], heading(free, p, w, h), COL.green, 'FREE');
    if (p > 0.8) {                                   // free-side shot on convert
      g.strokeStyle = COL.amber; g.setLineDash([2, 3]); g.lineWidth = 1.3;
      g.beginPath(); g.moveTo(F[0], F[1]); g.lineTo(B[0], B[1]); g.stroke(); g.setLineDash([]);
      if (p > 0.93) { g.fillStyle = COL.red; g.font = 'bold 10px "JetBrains Mono"'; g.fillText('✹ STERN KILL', B[0] + 8, B[1]); }
    }
    g.fillStyle = COL.faint; g.font = '9px "JetBrains Mono"';
    g.fillText(p < 0.4 ? 'SECTION BRACKETS — split the azimuth' : p < 0.75 ? 'BANDIT COMMITS — engaged fighter drags him' : 'FREE FIGHTER CONVERTS — stern shot', 12, 16);
  });
  return stop;
});

// ═════════════════════════════════════════════════════════════════════════════
//  MORE DEEP BVR WIDGETS — the WEZ, the notch reflex game, stern conversion
// ═════════════════════════════════════════════════════════════════════════════

// ── WEAPONS ENGAGEMENT ZONE — how the shot envelope breathes with aspect/alt ──
reg('wez', (node) => {
  const _V = makeCanvas(node, 200); const { g } = _V;
  const ctr = el('div', { class: 'wx-controls' }); node.appendChild(ctr);
  const read = el('div', { class: 'wx-readout' }); node.appendChild(read);
  let aspect = 180, altk = 9;
  const sA = slider('Target aspect (180 hot · 90 beam · 0 cold)', 0, 180, 5, aspect, v => { aspect = v; draw(); });
  const sH = slider('Altitude (km)', 0, 15, 1, altk, v => { altk = v; draw(); });
  ctr.appendChild(sA.row); ctr.appendChild(sH.row);
  const SCALE = 130;                         // km, full scale of the range bar
  function model() {
    const aFrac = aspect / 180;              // 1 hot … 0 cold
    const Rmax = 92 * (0.22 + 0.78 * aFrac) * (0.55 + 0.05 * altk);  // hot+high = far
    const Rne = Rmax * (0.42 + 0.22 * aFrac);       // NEZ: bigger when he's hot
    const Rmin = 1.4 + 1.1 * aFrac;                 // more closure → slightly bigger min
    return { Rmax, Rne, Rmin };
  }
  function draw() {
    const m = model(), w = _V.w, h = _V.h, padL = 12, padR = 14, y0 = 74, barH = 34;
    g.clearRect(0, 0, w, h);
    const X = km => padL + (km / SCALE) * (w - padL - padR);
    const seg = (a, b, col) => { g.fillStyle = col; g.fillRect(X(a), y0, X(b) - X(a), barH); };
    seg(0, m.Rmin, 'rgba(255,61,0,.38)');            // min range
    seg(m.Rmin, m.Rne, 'rgba(34,255,156,.38)');      // NEZ
    seg(m.Rne, m.Rmax, 'rgba(255,176,0,.32)');       // Rne..Rmax (defeatable by running)
    seg(m.Rmax, SCALE, 'rgba(120,140,170,.13)');     // out of range
    g.strokeStyle = 'rgba(147,172,203,.3)'; g.strokeRect(X(0), y0, X(SCALE) - X(0), barH);
    // scale ticks
    g.fillStyle = COL.faint; g.font = '9px "JetBrains Mono"';
    for (let k = 0; k <= SCALE; k += 25) { g.fillRect(X(k), y0 + barH, 1, 4); g.fillText(k + '', X(k) - 5, y0 + barH + 15); }
    lbl(g, w - padR, y0 + barH + 15, 'range to target (km) →', COL.dim, 'right', 9);
    // boundary markers
    const mark = (km, col, name) => { g.strokeStyle = col; g.setLineDash([2, 2]); g.beginPath(); g.moveTo(X(km), y0 - 6); g.lineTo(X(km), y0 + barH); g.stroke(); g.setLineDash([]);
      lbl(g, X(km), y0 - 9, name, col, 'center', 8); };
    mark(m.Rmin, COL.red, 'Rmin'); mark(m.Rne, COL.green, 'NEZ'); mark(m.Rmax, COL.amber, 'Rmax');
    read.innerHTML =
      `<div class="wx-line"><b style="color:${COL.red}">Rmin ${R(m.Rmin, 1)}</b> · <b style="color:${COL.green}">NEZ edge ${R(m.Rne)}</b> · <b style="color:${COL.amber}">Rmax ${R(m.Rmax)} km</b></div>` +
      `<div class="wx-hint">The <b style="color:${COL.green}">green NEZ</b> is the no-escape zone — fire here and he can't out-run it even turning cold. Between <b style="color:${COL.green}">NEZ</b> and <b style="color:${COL.amber}">Rmax</b> (amber) the shot only connects if he keeps coming; a timely <a data-goto="mar">abort</a> beats it — that's his MAR. Inside <b style="color:${COL.red}">Rmin</b> (red) the missile can't arm/settle. Now drag him from <b>hot to cold</b>: the whole envelope <b>collapses</b> — a running target is dramatically harder to kill, the core reason defenders <a data-goto="defence">go cold</a>. Climb (altitude slider) and it all expands as thin air stretches the missile's legs. Compare the sim's <b>doghouse</b> in ◈ TACTICAL-AI.</div>`;
  }
  _V.redraw = draw; draw();
  return () => {};
});

// ── THE NOTCH — a reflex game: beam the radar at zero closure to break lock ───
reg('notchgame', (node) => {
  const _V = makeCanvas(node, 130); const { g } = _V;
  const info = el('div', { class: 'wx-readout' }); node.appendChild(info);
  const row = el('div', { class: 'wx-controls' }); node.appendChild(row);
  const ROUNDS = 8, WIN = 0.16;              // notch half-width (closure units)
  let live = false, x = -1, dir = 1, speed = 0.9, round = 0, score = 0, locks = 0, phase = 'idle', msg = '', raf = 0, best = 0;
  const beamBtn = el('button', { class: 'wx-btn', onclick: () => strike() }, 'BEAM! (break lock)');
  const startBtn = el('button', { class: 'wx-btn', onclick: () => begin() }, '▶ START');
  row.appendChild(startBtn); row.appendChild(beamBtn);
  function begin() { live = true; round = 0; score = 0; locks = 0; speed = 0.9; phase = 'sweep'; nextRound(); }
  function nextRound() { if (round >= ROUNDS) { finish(); return; } round++; x = -1; dir = 1; phase = 'sweep'; msg = ''; }
  function strike() {
    if (!live || phase !== 'sweep') return;
    const inNotch = Math.abs(x) <= WIN;
    if (inNotch) { score += 10; locks++; msg = '✓ LOCK BROKEN — you fell into the notch'; }
    else { msg = Math.abs(x) < 0.4 ? '✗ close — still weak return, not notched' : '✗ high closure — radar holds you'; }
    phase = 'result';
    setTimeout(() => { if (!live) return; speed = Math.min(speed + 0.18, 2.2); nextRound(); }, 850);
  }
  function finish() { live = false; phase = 'done'; best = Math.max(best, score); if (score >= 40) progress.addXP(Math.min(score, 60)); }
  function draw() {
    const w = _V.w, h = _V.h, cy = 62, padX = 16;
    g.clearRect(0, 0, w, h);
    const X = v => padX + (v + 1) / 2 * (w - 2 * padX);   // v in [-1,1]
    // closure scale
    g.strokeStyle = COL.grid; g.beginPath(); g.moveTo(padX, cy); g.lineTo(w - padX, cy); g.stroke();
    // notch window (green)
    g.fillStyle = 'rgba(34,255,156,.18)'; g.fillRect(X(-WIN), cy - 22, X(WIN) - X(-WIN), 44);
    g.strokeStyle = COL.green; g.setLineDash([3, 2]); g.strokeRect(X(-WIN), cy - 22, X(WIN) - X(-WIN), 44); g.setLineDash([]);
    lbl(g, X(0), cy - 28, 'NOTCH (0 closure)', COL.green, 'center', 8);
    lbl(g, padX, cy + 30, 'HOT +closure', COL.red, 'left', 8);
    lbl(g, w - padX, cy + 30, 'COLD −closure', COL.blue, 'right', 8);
    // needle
    if (live && phase === 'sweep') { x += dir * speed * 0.03; if (x > 1) { x = 1; dir = -1; } if (x < -1) { x = -1; dir = 1; } }
    g.strokeStyle = Math.abs(x) <= WIN ? COL.green : COL.amber; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(X(x), cy - 20); g.lineTo(X(x), cy + 20); g.stroke();
    g.fillStyle = COL.ink; g.font = '10px "JetBrains Mono"';
    g.fillText(live ? `ROUND ${round}/${ROUNDS} · score ${score} · locks ${locks}` : (phase === 'done' ? `DONE — ${score} pts (${locks}/${ROUNDS} breaks) · best ${best}` : 'Break the missile\'s lock: BEAM when the needle hits the green notch.'), padX, 18);
    if (msg) { g.fillStyle = msg[0] === '✓' ? COL.green : COL.red; g.fillText(msg, padX, h - 8); }
  }
  const stop = frame(draw);
  info.innerHTML = `<div class="wx-hint">A pulse-Doppler radar rejects near-zero closing velocity to kill ground clutter — fly <b>perpendicular</b> (beam it) and your closure falls into that <b>notch</b>, so you vanish with the dirt. Time your <b>BEAM</b> for the instant closure crosses zero. Too hot and the radar still sees you; hold the beam too long and you drift cold and reappear. 40+ pts earns XP. This is the reflex behind the <a data-goto="defence">last-ditch defence</a> and the sim's notch-window study.</div>`;
  return stop;
});

// ── STERN CONVERSION — pull lag to roll into his control zone (animated) ──────
reg('sternconv', (node) => {
  const _V = makeCanvas(node, 300); const { g } = _V;
  const read = el('div', { class: 'wx-readout' }); node.appendChild(read);
  read.innerHTML = `<div class="wx-hint">To kill from guns or an IR missile you want his <b>stern</b> — the rear-quarter <b>control zone</b> where you match his turn and he can't point back at you. Aim your nose <i>behind</i> him (<b>lag pursuit</b>) and you cut to the inside of his circle and settle in control; aim <i>ahead</i> (<b>lead</b>) too early and you overshoot out front — a classic reversal. Watch the interceptor pull lag into the cone.</div>`;
  // one consistent convention: phi = standard math angle of a direction vector
  // (dir = cos/sin, screen y-down); drawJet heading = phi + PI/2.
  const jetHdg = phi => phi + Math.PI / 2;
  const ease = x => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
  const stop = frame((t) => {
    const w = _V.w, h = _V.h; g.clearRect(0, 0, w, h);
    const p = (t / 5200) % 1;
    const cx = w * 0.58, cy = h * 0.46, Rt = Math.min(w, h) * 0.27;    // bandit's turn circle
    // bandit orbits (clockwise on screen); its velocity math-angle is ba + PI/2
    const ba = -Math.PI / 2 + p * Math.PI * 1.2;
    const bx = cx + Rt * Math.cos(ba), by = cy + Rt * Math.sin(ba);
    const phiB = ba + Math.PI / 2;
    const rear = phiB + Math.PI;                                       // straight behind him
    // faint turn circle he's flying
    g.strokeStyle = 'rgba(255,61,0,.18)'; g.setLineDash([3, 4]); g.lineWidth = 1;
    g.beginPath(); g.arc(cx, cy, Rt, 0, 7); g.stroke(); g.setLineDash([]);
    // rear-quarter control-zone cone (±60° about the rear)
    g.fillStyle = 'rgba(34,255,156,.12)'; g.beginPath(); g.moveTo(bx, by);
    for (let d = -60; d <= 60; d += 8) { const a = rear + d * Math.PI / 180; g.lineTo(bx + 54 * Math.cos(a), by + 54 * Math.sin(a)); }
    g.closePath(); g.fill();
    lbl(g, bx + 70 * Math.cos(rear), by + 70 * Math.sin(rear), 'CONTROL ZONE', COL.green, 'center', 8);
    // interceptor eases from the corner to a lag point in the stern cone
    const sternPt = [bx + 42 * Math.cos(rear), by + 42 * Math.sin(rear)];
    const s0 = [w * 0.12, h * 0.92];
    const ix = s0[0] + (sternPt[0] - s0[0]) * ease(p);
    const iy = s0[1] + (sternPt[1] - s0[1]) * ease(p);
    const lagPt = [bx + 28 * Math.cos(rear), by + 28 * Math.sin(rear)];
    g.strokeStyle = 'rgba(0,229,255,.4)'; g.setLineDash([3, 3]); g.lineWidth = 1;
    g.beginPath(); g.moveTo(ix, iy); g.lineTo(lagPt[0], lagPt[1]); g.stroke(); g.setLineDash([]);
    const phiI = Math.atan2(lagPt[1] - iy, lagPt[0] - ix);
    drawJet(g, bx, by, jetHdg(phiB), COL.red, 'BANDIT');
    drawJet(g, ix, iy, jetHdg(phiI), COL.blue, 'YOU');
    g.fillStyle = COL.faint; g.font = '9px "JetBrains Mono"';
    g.fillText(p < 0.5 ? 'PULL LAG — nose behind him, cut inside his circle' : p < 0.9 ? 'CONVERTING — sliding into the rear quarter' : 'IN CONTROL — matched turn, stern shot', 12, 16);
  });
  return stop;
});

// ═════════════════════════════════════════════════════════════════════════════
//  SECTION-TACTICS WIDGETS — sort game, formation library, the RWR scope
// ═════════════════════════════════════════════════════════════════════════════

// ── SORT & TARGETING — assign shooters so nobody's double-targeted or leaks ───
reg('sortgame', (node) => {
  const _V = makeCanvas(node, 280); const { cv, g } = _V;
  const info = el('div', { class: 'wx-readout' }); node.appendChild(info);
  const row = el('div', { class: 'wx-controls' }); node.appendChild(row);
  let bandits = [], rule = '', picks = [], round = 0, score = 0, msg = '', done = false;
  const nextBtn = el('button', { class: 'wx-btn', onclick: () => newRound() }, '▶ New picture');
  row.appendChild(nextBtn);
  const RULES = [
    { k: 'AZIMUTH', txt: 'SORT AZIMUTH — Lead takes the LEFT contact, Wingman the RIGHT', pick: bs => [minBy(bs, b => b.x), maxBy(bs, b => b.x)] },
    { k: 'RANGE', txt: 'SORT RANGE — Lead takes the FAR (trail) contact, Wingman the NEAR', pick: bs => [minBy(bs, b => b.y), maxBy(bs, b => b.y)] },
  ];
  function minBy(a, f) { return a.reduce((m, x) => f(x) < f(m) ? x : m); }
  function maxBy(a, f) { return a.reduce((m, x) => f(x) > f(m) ? x : m); }
  function newRound() {
    round++; picks = []; msg = ''; done = false;
    const w = _V.w, h = _V.h;
    // two contacts, well separated in both axes so left/right & near/far are clear
    const ax = 0.22 + Math.random() * 0.18, bx = 0.6 + Math.random() * 0.18;
    const ay = 0.16 + Math.random() * 0.16, by = 0.42 + Math.random() * 0.16;
    bandits = [{ x: ax * w, y: ay * h, id: 0 }, { x: bx * w, y: by * h, id: 1 }];
    if (Math.random() < 0.5) bandits.reverse();
    rule = RULES[Math.floor(Math.random() * RULES.length)];
    draw();
  }
  function draw() {
    const w = _V.w, h = _V.h; g.clearRect(0, 0, w, h);
    // your section along the bottom
    const leadXY = [w * 0.32, h - 22], wingXY = [w * 0.68, h - 22];
    drawJet(g, leadXY[0], leadXY[1], 0, COL.blue, 'LEAD');
    drawJet(g, wingXY[0], wingXY[1], 0, COL.green, 'WING');
    // contacts
    bandits.forEach((b, i) => {
      const assignedTo = picks.findIndex(p => p === i);
      const col = assignedTo === 0 ? COL.blue : assignedTo === 1 ? COL.green : COL.red;
      g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); g.arc(b.x, b.y, 12, 0, 7); g.stroke();
      g.fillStyle = col; g.font = '9px "JetBrains Mono"';
      g.fillText('BND' + (i + 1), b.x - 12, b.y - 16);
      if (assignedTo >= 0) { g.strokeStyle = col; g.setLineDash([3, 3]); g.beginPath();
        g.moveTo(assignedTo === 0 ? leadXY[0] : wingXY[0], assignedTo === 0 ? leadXY[1] : wingXY[1]); g.lineTo(b.x, b.y); g.stroke(); g.setLineDash([]); }
    });
    g.fillStyle = COL.amber; g.font = '10px "JetBrains Mono"';
    g.fillText(rule.txt, 10, 16);
    g.fillStyle = COL.ink; g.font = '9px "JetBrains Mono"';
    const who = picks.length === 0 ? 'Click LEAD\'s contact' : picks.length === 1 ? 'Click WINGMAN\'s contact' : '';
    g.fillText(`Round ${round} · score ${score}${who ? ' · ' + who : ''}`, 10, 30);
    if (msg) { g.fillStyle = msg[0] === '✓' ? COL.green : COL.red; g.fillText(msg, 10, h - 6); }
  }
  function onClick(e) {
    if (done || picks.length >= 2) return;
    const r = cv.getBoundingClientRect();
    const mx = (e.clientX - r.left) * (_V.w / r.width), my = (e.clientY - r.top) * (_V.h / r.height);
    const hit = bandits.findIndex(b => Math.hypot(b.x - mx, b.y - my) < 22);
    if (hit < 0 || picks.includes(hit)) return;
    picks.push(hit);
    if (picks.length === 2) {
      const want = rule.pick(bandits);            // [leadTarget, wingTarget]
      const ok = bandits[picks[0]] === want[0] && bandits[picks[1]] === want[1];
      done = true;
      if (ok) { score++; progress.addXP(6); msg = '✓ Clean sort — one missile each, no leakers.'; }
      else msg = '✗ Bad sort — you\'d double-target one and let the other leak.';
    }
    draw();
  }
  cv.addEventListener('click', onClick);
  info.innerHTML = `<div class="wx-hint">A section must <b>sort</b> a group so two missiles don't chase one bandit while another flies through untouched. The flight lead calls the rule — by <b>azimuth</b> (left/right) or <b>range</b> (lead/trail) — and each shooter takes their piece. Apply the call: click Lead's contact, then Wingman's. Get it wrong and you've built a <b>leaker</b>. This is the teamwork layer over every number the sim gives you — see <a data-goto="section2ship">fighting as a section</a>.</div>`;
  newRound();
  return () => cv.removeEventListener('click', onClick);
});

// ── FORMATION LIBRARY — why fighters fly wall / box / champagne / ladder ──────
reg('formations', (node) => {
  const _V = makeCanvas(node, 240); const { g } = _V;
  const row = el('div', { class: 'wx-controls' }); node.appendChild(row);
  const read = el('div', { class: 'wx-readout' }); node.appendChild(read);
  const FORMS = {
    WALL: { jets: [[0.2, 0.5], [0.4, 0.5], [0.6, 0.5], [0.8, 0.5]],
      why: '<b>Line abreast.</b> Every radar looks forward, maximum bracket width, all four can shoot. The default offensive push — but no depth, so a leaker past the wall is behind everyone.' },
    BOX: { jets: [[0.35, 0.35], [0.65, 0.35], [0.35, 0.7], [0.65, 0.7]],
      why: '<b>Two elements stacked in range.</b> The trail pair adds depth and mutual support: they can shoot bandits that commit on the leaders, and cover the leakers a wall can\'t.' },
    CHAMPAGNE: { jets: [[0.25, 0.35], [0.75, 0.35], [0.5, 0.72]],
      why: '<b>Two up, one back (an inverted wedge).</b> Wide front bracket plus a trailer for depth and a shooter who stays free — a flexible 3-ship offensive picture.' },
    LADDER: { jets: [[0.5, 0.2], [0.5, 0.45], [0.5, 0.7], [0.5, 0.92]],
      why: '<b>Stacked in range on one line.</b> Sequential shooters against a narrow threat axis — each fires in turn — but almost no lateral bracket. Used to mass shots down a lane.' },
    WEDGE: { jets: [[0.5, 0.28], [0.28, 0.62], [0.72, 0.62]],
      why: '<b>Lead with two swept-back wings.</b> Good all-aspect lookout and mutual support, quick to flex into a bracket. A common patrol / transition formation.' },
  };
  let cur = 'WALL';
  const btns = {};
  Object.keys(FORMS).forEach(k => { const b = el('button', { class: 'wx-tab', onclick: () => { cur = k; sync(); } }, k); btns[k] = b; row.appendChild(b); });
  function sync() { Object.entries(btns).forEach(([k, b]) => b.classList.toggle('on', k === cur)); draw(); }
  function draw() {
    const w = _V.w, h = _V.h, pad = 30; g.clearRect(0, 0, w, h);
    // "threat" reference arrow (formations point up = toward the enemy)
    g.strokeStyle = 'rgba(255,61,0,.4)'; arrow(g, w / 2, 20, w / 2, 6, COL.red, 5, 1.2);
    lbl(g, w / 2 + 8, 14, 'threat axis', COL.faint, 'left', 8);
    FORMS[cur].jets.forEach((j, i) => {
      const x = pad + j[0] * (w - 2 * pad), y = pad + j[1] * (h - 2 * pad);
      drawJet(g, x, y, 0, i === 0 ? COL.amber : COL.blue, i === 0 ? 'LEAD' : '');
    });
    read.innerHTML = `<div class="wx-hint">${FORMS[cur].why} Each formation is a different answer to one question: <b>present the most shooters while giving the enemy the fewest solvable problems</b>. The picture you fly sets up the <a data-goto="sortgame">sort</a> and the <a data-goto="section2ship">bracket</a>.</div>`;
  }
  sync();
  return () => {};
});

// ── RWR SCOPE — read the radar-warning display: search → lock → LAUNCH ────────
reg('rwrscope', (node) => {
  const _V = makeCanvas(node, 300); const { g } = _V;
  const read = el('div', { class: 'wx-readout' }); node.appendChild(read);
  // static threats + one that escalates through the states on a loop
  const THREATS = [
    { brg: -55, r: 0.75, sym: '29', state: 'search' },   // SA-like search radar, far
    { brg: 120, r: 0.5, sym: '15', state: 'lock' },      // a fighter locked on
  ];
  const stop = frame((t) => {
    const w = _V.w, h = _V.h, cx = w / 2, cy = h / 2 + 6, R = Math.min(w, h) / 2 - 26;
    g.clearRect(0, 0, w, h);
    // scope rings
    g.strokeStyle = COL.grid; g.lineWidth = 1;
    [1, 0.66, 0.33].forEach(f => { g.beginPath(); g.arc(cx, cy, R * f, 0, 7); g.stroke(); });
    g.beginPath(); g.moveTo(cx, cy - R); g.lineTo(cx, cy + R); g.moveTo(cx - R, cy); g.lineTo(cx + R, cy); g.stroke();
    g.fillStyle = COL.faint; g.font = '8px "JetBrains Mono"';
    g.fillText('NOSE', cx - 12, cy - R - 4); g.fillText('TAIL', cx - 10, cy + R + 12);
    // own ship
    drawJet(g, cx, cy, 0, COL.blue, '');
    // the escalating threat (loops: search → lock → launch)
    const p = (t / 6000) % 1;
    const state = p < 0.4 ? 'search' : p < 0.78 ? 'lock' : 'launch';
    const flash = Math.sin(t / 90) > 0;
    const dyn = { brg: 35, r: 0.6, sym: '11', state };
    [...THREATS, dyn].forEach((th, i) => {
      const a = (th.brg - 90) * Math.PI / 180;            // 0°=nose(up)
      const x = cx + R * th.r * Math.cos(a), y = cy + R * th.r * Math.sin(a);
      const isLaunch = th.state === 'launch', isLock = th.state === 'lock';
      const col = isLaunch ? COL.red : isLock ? COL.amber : COL.green;
      if (isLaunch && !flash) { /* blink off */ } else {
        g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 2;
        if (isLaunch) { g.beginPath(); g.moveTo(x, y - 9); g.lineTo(x + 9, y); g.lineTo(x, y + 9); g.lineTo(x - 9, y); g.closePath(); g.stroke(); }
        else if (isLock) { g.beginPath(); g.arc(x, y, 8, 0, 7); g.fill(); }        // solid = locked
        else { g.beginPath(); g.arc(x, y, 8, 0, 7); g.stroke(); }                  // hollow = search
        g.fillStyle = col; g.font = 'bold 9px "JetBrains Mono"'; g.fillText(th.sym, x - 6, y + 3.5);
        if (isLaunch) lbl(g, x, y - 13, 'LAUNCH', COL.red, 'center', 9, true);
      }
    });
    // legend
    g.font = '8px "JetBrains Mono"';
    g.fillStyle = COL.green; g.fillText('○ search', 8, h - 20);
    g.fillStyle = COL.amber; g.fillText('● lock', 70, h - 20);
    g.fillStyle = COL.red; g.fillText('◇ LAUNCH (spike)', 120, h - 20);
    g.fillStyle = COL.faint; g.fillText('ring = signal strength · bearing = threat direction · number = emitter type', 8, h - 6);
  });
  read.innerHTML = `<div class="wx-hint">The <b>Radar Warning Receiver</b> paints every emitter that touches you as a symbol at its <b>bearing</b> (direction) and <b>ring</b> (signal strength ≈ how close/threatening). Reading it is survival: a <b style="color:${COL.green}">hollow search</b> symbol is just being looked at; it going <b style="color:${COL.amber}">solid (lock)</b> means a fire-control radar has you; a flashing <b style="color:${COL.red}">◇ launch spike</b> is a missile in the air — time to <a data-goto="defence">defend</a>. Half of surviving BVR is knowing you're being shot at <i>before</i> the missile arrives. Watch the top threat cycle search → lock → launch.</div>`;
  return stop;
});

// ── IR BANDS — why MWIR & LWIR exist: Planck curves under the atmosphere ─────
reg('irbands', (node) => {
  const _V = makeCanvas(node, 300); const { g } = _V;
  const read = el('div', { class: 'wx-readout' }); node.appendChild(read);
  const L0 = 2, L1 = 15;                        // wavelength axis, µm
  // Planck spectral radiance (arbitrary scale): B ∝ λ⁻⁵ / (e^(c₂/λT) − 1)
  const C2 = 14388;                             // µm·K
  const planck = (lam, T) => Math.pow(lam, -5) / (Math.exp(C2 / (lam * T)) - 1);
  // simplified sea-level transmission: MWIR window (CO₂ notch at 4.3), H₂O wall
  // 5.5–7.5, LWIR window 8–13, CO₂ shutting it past ~14.
  const trans = (lam) => {
    const s = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    let T = 0;
    T = Math.max(T, s(2.9, 3.2, lam) * (1 - s(4.05, 4.25, lam)) * 0.85);   // MWIR lobe A
    T = Math.max(T, s(4.4, 4.65, lam) * (1 - s(4.85, 5.4, lam)) * 0.7);    // MWIR lobe B (past CO₂ notch)
    T = Math.max(T, s(7.6, 8.3, lam) * (1 - s(12.8, 14.2, lam)) * 0.85);   // LWIR window
    T = Math.max(T, s(2.0, 2.05, lam) * (1 - s(2.45, 2.75, lam)) * 0.7);   // SWIR edge
    return T;
  };
  function draw() {
    const w = _V.w, h = _V.h, padL = 34, padR = 12, padT = 24, padB = 30;
    const pw = w - padL - padR, ph = h - padT - padB;
    g.clearRect(0, 0, w, h);
    const X = lam => padL + (lam - L0) / (L1 - L0) * pw;
    const Y = f => padT + (1 - f) * ph;
    // transmission fill (the atmosphere's "windows")
    g.beginPath(); g.moveTo(X(L0), Y(0));
    for (let lam = L0; lam <= L1; lam += 0.04) g.lineTo(X(lam), Y(trans(lam) * 0.92));
    g.lineTo(X(L1), Y(0)); g.closePath();
    g.fillStyle = 'rgba(120,150,190,0.13)'; g.fill();
    g.strokeStyle = 'rgba(147,172,203,0.4)'; g.lineWidth = 1; g.stroke();
    // window band highlights
    const band = (a, b, col, name) => {
      g.fillStyle = col; g.fillRect(X(a), padT - 14, X(b) - X(a), 11);
      g.fillStyle = COL.ink; g.font = 'bold 8.5px "JetBrains Mono"'; g.textAlign = 'center';
      g.fillText(name, (X(a) + X(b)) / 2, padT - 5.5); g.textAlign = 'left';
    };
    band(3, 5, 'rgba(255,176,0,0.25)', 'MWIR 3–5 µm');
    band(8, 13, 'rgba(0,229,255,0.22)', 'LWIR 8–13 µm');
    // absorber callouts
    g.fillStyle = COL.faint; g.font = '8.5px "JetBrains Mono"'; g.textAlign = 'center';
    g.fillText('CO₂', X(4.3), Y(0.06) - 2);
    g.fillText('H₂O (opaque)', X(6.5), Y(0.5));
    g.fillText('CO₂', X(14.4), Y(0.35));
    g.textAlign = 'left';
    // Planck curves, each normalised to its own peak (radiance scales differ hugely)
    const curves = [[900, COL.amber, 'PLUME & HOT PARTS ~900 K'], [320, COL.blue, 'SKIN ~320 K']];
    curves.forEach(([T, col, name]) => {
      let peak = 0; for (let lam = L0; lam <= L1; lam += 0.02) peak = Math.max(peak, planck(lam, T));
      g.strokeStyle = col; g.lineWidth = 2.2; g.beginPath();
      let first = true;
      for (let lam = L0; lam <= L1; lam += 0.04) {
        const y = Y(planck(lam, T) / peak * 0.88);
        first ? (g.moveTo(X(lam), y), first = false) : g.lineTo(X(lam), y);
      }
      g.stroke();
      const lp = 2898 / T;                       // Wien's law, µm
      g.fillStyle = col; g.beginPath(); g.arc(X(lp), Y(0.88), 3.4, 0, 7); g.fill();
      lbl(g, X(lp), Y(0.88) - 10, `${name} · peak ${lp.toFixed(1)} µm`, col, lp < 7 ? 'left' : 'center', 8.5);
    });
    // axes
    g.strokeStyle = COL.grid; g.beginPath(); g.moveTo(padL, padT); g.lineTo(padL, h - padB); g.lineTo(w - padR, h - padB); g.stroke();
    g.fillStyle = COL.faint; g.font = '9px "JetBrains Mono"';
    for (let lam = 2; lam <= 15; lam++) { if (lam % 2 === 1) continue; g.fillText(lam + '', X(lam) - 4, h - padB + 13); }
    lbl(g, w / 2, h - 4, 'wavelength (µm)', COL.dim, 'center', 9);
    g.save(); g.translate(10, h / 2); g.rotate(-Math.PI / 2); g.textAlign = 'center';
    g.fillStyle = COL.dim; g.font = '9px "JetBrains Mono"'; g.fillText('emission / transmission (norm.)', 0, 0); g.restore();
  }
  _V.redraw = draw; draw();
  read.innerHTML = `<div class="wx-hint">Two curves, one atmosphere. A jet's <b style="color:${COL.amber}">plume and hot parts (~900 K)</b> radiate with a Planck peak near <b>3.2 µm</b> — right in the <b style="color:${COL.amber}">MWIR window</b>, which is why classic heat-seekers live there (note the <b>CO₂ notch at 4.3 µm</b> splitting that window — the plume's own CO₂ emission band sits just beside it). <b style="color:${COL.blue}">Skin heated by air friction (~320 K)</b> peaks near <b>9 µm</b> — the <b style="color:${COL.blue}">LWIR window</b>, home of IRSTs and imaging sensors that spot a fighter from <i>any</i> aspect. Between them the atmosphere is a wall of <b>H₂O absorption</b> — the two windows exist only because those gaps in the gas spectrum happen to line up with how hot jets get. (Curves normalised per-peak; in absolute terms the plume outshines the skin enormously.)</div>`;
  return () => {};
});

// ═════════════════════════════════════════════════════════════════════════════
//  RADAR EQUATION — stepped derivation + RCS-vs-aspect polar signature
// ═════════════════════════════════════════════════════════════════════════════

// ── Step through the two-way path that produces the 1/R⁴ law ─────────────────
reg('radarderive', (node) => {
  const _V = makeCanvas(node, 300); const { g } = _V;
  const row = el('div', { class: 'wx-controls' }); node.appendChild(row);
  const read = el('div', { class: 'wx-readout' }); node.appendChild(read);
  let step = 0;
  const STEPS = [
    { t: 'ISOTROPIC TRANSMIT',
      eq: 'S = P<sub>t</sub> / 4πR²',
      why: 'The transmitter radiates <b>P<sub>t</sub></b> watts. If it spread that energy equally in every direction, at range <b>R</b> it would be smeared over the surface of a sphere, <b>4πR²</b>. So the power crossing each square metre — the <b>power density S</b> — already falls as <b>1/R²</b>. Nothing has hit the target yet.' },
    { t: 'ANTENNA GAIN FOCUSES IT',
      eq: 'S = P<sub>t</sub>G / 4πR²',
      why: 'A real antenna does not radiate equally everywhere: it concentrates energy into a beam. <b>Gain G</b> is exactly that concentration factor — how many times stronger the beam is than the isotropic case. A fighter radar might have G of tens of thousands. This is free range: G multiplies the density without extra watts.' },
    { t: 'THE TARGET INTERCEPTS',
      eq: 'P<sub>refl</sub> = (P<sub>t</sub>G / 4πR²) · σ',
      why: 'The target intercepts some of that beam and scatters it back. We bundle everything about the target — size, shape, material, aspect — into one number: the <b>radar cross-section σ</b>, in <b>square metres</b>. σ is the area of a perfect isotropic reflector that would send back the same echo. It is an <b>area, so it is never negative</b>, and it is not the physical size of the jet.' },
    { t: 'THE ECHO SPREADS BACK',
      eq: 'S<sub>echo</sub> = P<sub>t</sub>Gσ / (4πR²)²',
      why: 'Here is the cruelty. That scattered energy now makes its <i>own</i> journey home, spreading over another <b>4πR²</b> sphere. The echo therefore suffers <b>1/R²</b> twice — once out, once back. Multiply them and the returning density falls as <b>1/R⁴</b>. Double the range and the echo is <b>16 times weaker</b>.' },
    { t: 'THE ANTENNA COLLECTS',
      eq: 'P<sub>r</sub> = P<sub>t</sub>G²λ²σ / (4π)³R⁴',
      why: 'The receiving antenna captures that density over its <b>effective aperture</b> A<sub>e</sub> = Gλ²/4π. Substituting it in gives the classic radar equation. Note <b>G appears squared</b> (once transmitting, once receiving) and the <b>wavelength λ</b> enters — a longer λ means a physically bigger effective aperture for the same gain.' },
    { t: 'SOLVE FOR RANGE',
      eq: 'R<sub>max</sub> = [ P<sub>t</sub>G²λ²σ / (4π)³S<sub>min</sub> ]<sup>¼</sup>',
      why: 'Detection happens when the received power exceeds the receiver\'s <b>minimum detectable signal S<sub>min</sub></b> (set by noise). Set P<sub>r</sub> = S<sub>min</sub> and solve for R. Because P<sub>r</sub> fell as R⁴, range comes back as a <b>fourth root</b> — and every design term is trapped under it. That single exponent is why 1000× less RCS buys only ~5.6× less range, and why doubling power buys 19%.' },
  ];
  const prev = el('button', { class: 'wx-btn', onclick: () => { step = (step + STEPS.length - 1) % STEPS.length; draw(); } }, '◀ Back');
  const next = el('button', { class: 'wx-btn', onclick: () => { step = (step + 1) % STEPS.length; draw(); } }, 'Next ▶');
  row.append(prev, next);

  function draw() {
    const w = _V.w, h = _V.h; g.clearRect(0, 0, w, h);
    // proportional layout so the geometry can never invert on a narrow canvas
    // (a fixed inset would make tx < rx and hand arc() a negative radius).
    const rx = Math.max(28, w * 0.10), tx = Math.max(rx + 40, w * 0.86), cy = h / 2 - 16;
    const span = tx - rx;
    const s = STEPS[step];
    // ── outbound wavefronts (steps 0+) ──
    const outLive = step >= 0;
    for (let i = 1; i <= 4; i++) {
      const f = i / 4, rad = Math.max(1, span * f);
      const spread = 12 + f * (step >= 1 ? 26 : 60);      // gain narrows the beam at step 1+
      g.strokeStyle = outLive ? `rgba(0,229,255,${0.5 - f * 0.09})` : 'rgba(0,229,255,.12)';
      g.lineWidth = 1.6;
      g.beginPath(); g.arc(rx, cy, rad, -Math.atan2(spread, rad), Math.atan2(spread, rad)); g.stroke();
    }
    // beam envelope
    if (step >= 1) {
      g.strokeStyle = 'rgba(0,229,255,.22)'; g.setLineDash([4, 4]); g.lineWidth = 1;
      g.beginPath(); g.moveTo(rx, cy); g.lineTo(tx, cy - 38); g.moveTo(rx, cy); g.lineTo(tx, cy + 38); g.stroke(); g.setLineDash([]);
    }
    // ── return wavefronts (steps 3+) ──
    if (step >= 3) {
      for (let i = 1; i <= 4; i++) {
        const f = i / 4;
        g.strokeStyle = `rgba(255,176,0,${0.45 - f * 0.08})`; g.lineWidth = 1.4;
        g.beginPath(); g.arc(tx, cy, Math.max(1, span * f), Math.PI - 0.55, Math.PI + 0.55); g.stroke();
      }
    }
    // radar + target
    g.fillStyle = COL.blue; g.shadowColor = COL.blue; g.shadowBlur = 8;
    g.beginPath(); g.arc(rx, cy, 6, 0, 7); g.fill(); g.shadowBlur = 0;
    lbl(g, rx, cy + 22, 'RADAR', COL.blue, 'center', 9);
    const tCol = step >= 2 ? COL.amber : COL.dim;
    g.fillStyle = tCol; g.shadowColor = tCol; g.shadowBlur = step >= 2 ? 10 : 0;
    g.beginPath(); g.arc(tx, cy, step >= 2 ? 8 : 5, 0, 7); g.fill(); g.shadowBlur = 0;
    lbl(g, tx, cy + 24, step >= 2 ? 'TARGET σ' : 'TARGET', tCol, 'center', 9);
    // range bracket
    g.strokeStyle = 'rgba(147,172,203,.4)'; g.setLineDash([2, 3]); g.lineWidth = 1;
    g.beginPath(); g.moveTo(rx, cy + 44); g.lineTo(tx, cy + 44); g.stroke(); g.setLineDash([]);
    lbl(g, (rx + tx) / 2, cy + 58, 'R', COL.dim, 'center', 11);
    // step header + equation
    lbl(g, 12, 18, `STEP ${step + 1}/${STEPS.length} — ${s.t}`, COL.green, 'left', 10, true);
    read.innerHTML = `<div class="wx-line" style="font-family:var(--font-mono);font-size:14px;color:${COL.amber}">${s.eq}</div>` +
      `<div class="wx-hint">${s.why}</div>`;
  }
  _V.redraw = draw; draw();
  return () => {};
});

// ── RCS is not one number: the polar signature ───────────────────────────────
reg('rcsaspect', (node) => {
  const _V = makeCanvas(node, 340); const { g } = _V;
  const row = el('div', { class: 'wx-controls' }); node.appendChild(row);
  const ctr = el('div', { class: 'wx-controls' }); node.appendChild(ctr);   // aspect slider sits with the tabs
  const read = el('div', { class: 'wx-readout' }); node.appendChild(read);
  const angDiff = (a, b) => { let d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
  const lobe = (d, c, w, p) => p * Math.exp(-Math.pow(angDiff(d, c), 2) / (2 * w * w));
  const SIGS = {
    conv: { name: 'CONVENTIONAL FIGHTER', col: COL.amber,
      f: d => 0.8 + lobe(d, 0, 22, 3.5) + lobe(d, 180, 28, 7) + lobe(d, 90, 16, 90) + lobe(d, 270, 16, 90) + lobe(d, 45, 14, 4) + lobe(d, 315, 14, 4),
      note: 'Big, smooth lobes everywhere, and an enormous <b>broadside flash</b> — flat fuselage sides, slab wings and a vertical tail all act like mirrors when the beam hits them square.' },
    vlo: { name: 'VLO / SHAPED', col: COL.green,
      f: d => 0.0008 + lobe(d, 40, 4, 0.35) + lobe(d, 320, 4, 0.35) + lobe(d, 140, 5, 0.5) + lobe(d, 220, 5, 0.5) + lobe(d, 90, 12, 4) + lobe(d, 270, 12, 4) + lobe(d, 180, 20, 0.15),
      note: 'Shaping does not delete energy — it <b>redirects</b> it. The frontal sector is scrubbed to almost nothing, but the energy reappears as a few <b>narrow spikes</b> off the planform edges, and the beam aspect is still far from invisible.' },
  };
  let cur = 'conv', aspect = 0;
  const btns = {};
  Object.entries(SIGS).forEach(([k, v]) => { const b = el('button', { class: 'wx-tab', onclick: () => { cur = k; sync(); } }, v.name); btns[k] = b; row.appendChild(b); });
  const sA = slider('Your aspect to him (°)', 0, 359, 1, aspect, v => { aspect = v; draw(); });
  ctr.appendChild(sA.row);
  function sync() { Object.entries(btns).forEach(([k, b]) => b.classList.toggle('on', k === cur)); draw(); }

  const DBMIN = -35, DBMAX = 22;
  const toDb = s => 10 * Math.log10(Math.max(s, 1e-6));
  function draw() {
    const w = _V.w, h = _V.h, cx = w / 2, cy = h / 2 + 4;
    // clamp: a narrow first-mount measurement must never produce a negative radius
    const R0 = Math.max(24, Math.min(w, h) / 2 - 40);
    g.clearRect(0, 0, w, h);
    const rOf = db => Math.max(1, R0 * Math.max(0.04, (Math.min(Math.max(db, DBMIN), DBMAX) - DBMIN) / (DBMAX - DBMIN)));
    // rings (dBsm)
    g.font = '8px "JetBrains Mono"';
    for (let db = -30; db <= 20; db += 10) {
      const r = rOf(db);
      g.strokeStyle = 'rgba(78,128,178,0.16)'; g.lineWidth = 1;
      g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
      g.fillStyle = COL.faint; g.fillText(db + ' dBsm', cx + 3, cy - r - 2);
    }
    // spokes + aspect labels (0 = nose, drawn up)
    [[0, 'NOSE'], [90, 'BEAM'], [180, 'TAIL'], [270, 'BEAM']].forEach(([d, t]) => {
      const a = (d - 90) * Math.PI / 180;
      g.strokeStyle = 'rgba(78,128,178,0.2)'; g.beginPath(); g.moveTo(cx, cy);
      g.lineTo(cx + R0 * Math.cos(a), cy + R0 * Math.sin(a)); g.stroke();
      lbl(g, cx + (R0 + 20) * Math.cos(a), cy + (R0 + 20) * Math.sin(a) + 3, t, COL.dim, 'center', 8.5);
    });
    // the signature curve
    const S = SIGS[cur];
    g.beginPath();
    for (let d = 0; d <= 360; d += 1) {
      const a = (d - 90) * Math.PI / 180, r = rOf(toDb(S.f(d)));
      const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
      d ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.closePath();
    g.fillStyle = cur === 'vlo' ? 'rgba(34,255,156,0.13)' : 'rgba(255,176,0,0.13)';
    g.fill(); g.strokeStyle = S.col; g.lineWidth = 2; g.stroke();
    // jet silhouette at centre, nose up
    drawJet(g, cx, cy, 0, COL.ink, '');
    // current-aspect marker
    const sig = S.f(aspect), a = (aspect - 90) * Math.PI / 180, r = rOf(toDb(sig));
    g.strokeStyle = COL.red; g.setLineDash([3, 3]); g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + R0 * Math.cos(a), cy + R0 * Math.sin(a)); g.stroke(); g.setLineDash([]);
    g.fillStyle = COL.red; g.beginPath(); g.arc(cx + r * Math.cos(a), cy + r * Math.sin(a), 4.5, 0, 7); g.fill();
    // readout: σ at this aspect + what the 4th root does to detection range
    const nose = S.f(0), ratio = Math.pow(sig / nose, 0.25);
    read.innerHTML =
      `<div class="wx-line">At <b>${aspect}°</b> aspect: σ = <b style="color:${S.col}">${sig < 0.01 ? sig.toExponential(1) : R(sig, 2)} m²</b> ` +
      `(<b>${R(toDb(sig), 1)} dBsm</b>) — detection range <b style="color:${COL.red}">${R(ratio, 2)}×</b> what it is nose-on.</div>` +
      `<div class="wx-hint">${S.note} This is why a single quoted RCS figure is nearly meaningless: the number in the brochure is almost always the <b>nose-on</b> value, the one the designer worked hardest on. Swing to the <b>beam</b> and σ can jump by a factor of a hundred — and because detection range goes as σ<sup>¼</sup>, even that only multiplies range by about 3. The same fourth root that protects the stealth designer also limits how much the defender gains from catching you side-on. <i>(Shapes here are representative teaching models, not measured signatures — real ones are classified, frequency-dependent and far spikier.)</i></div>`;
  }
  _V.redraw = draw; sync();
  return () => {};
});

// ═════════════════════════════════════════════════════════════════════════════
//  HOW RADAR SCANS — array physics (TR modules), beamwidth, bar scans
// ═════════════════════════════════════════════════════════════════════════════

// ── MECHANICAL vs PESA vs AESA, built from the actual hardware ───────────────
// Huygens construction: each element radiates a spherical wavelet; the envelope
// of the wavelets IS the wavefront. Delay the elements progressively and the
// envelope tilts — that is electronic beam steering, drawn exactly as it works.
reg('arrayphysics', (node) => {
  const _V = makeCanvas(node, 380); const { g } = _V;
  const tabRow = el('div', { class: 'wx-controls' }); node.appendChild(tabRow);
  const ctr = el('div', { class: 'wx-controls' }); node.appendChild(ctr);
  const read = el('div', { class: 'wx-readout' }); node.appendChild(read);

  const MODES = {
    mech: { name: 'MECHANICAL', col: COL.blue },
    pesa: { name: 'PESA', col: COL.amber },
    aesa: { name: 'AESA', col: COL.green },
  };
  let mode = 'mech', steer = 0, failed = 0, N = 16;
  const btns = {};
  Object.entries(MODES).forEach(([k, v]) => {
    const b = el('button', { class: 'wx-tab', onclick: () => { mode = k; sync(); } }, v.name);
    btns[k] = b; tabRow.appendChild(b);
  });
  const sS = slider('Steer the beam (°)', -60, 60, 1, steer, v => { steer = v; });
  const sF = slider('AESA: failed T/R modules', 0, 8, 1, failed, v => { failed = v; });
  ctr.append(sS.row, sF.row);
  function sync() {
    Object.entries(btns).forEach(([k, b]) => b.classList.toggle('on', k === mode));
    sF.row.style.display = mode === 'aesa' ? '' : 'none';
    if (mode === 'mech') { sS.row.querySelector('span').textContent = 'Slew the whole antenna (°)'; }
    else { sS.row.querySelector('span').textContent = 'Steer the beam — phase only (°)'; }
    setText();
  }
  function setText() {
    const T = {
      mech: `<div class="wx-hint"><b>One transmitter, one aperture, one wavefront — and a motor.</b> The entire plate radiates as a <b>single antenna</b>, so the wave leaves perpendicular to the face and the beam points wherever the metal points. There is no phase trickery available: to aim somewhere else you must physically swing kilograms of antenna on a gimbal, against <b>inertia</b>. Scan rates land around 60–70°/s, a full search frame takes <b>seconds</b>, and the antenna can be searching <i>or</i> tracking, never genuinely both. Everything the radar knows is as stale as the last time the beam swept past. Now switch to PESA and watch the single wavefront break into <b>many element wavelets</b> — that is the whole revolution.</div>`,
      pesa: `<div class="wx-hint"><b>One transmitter feeding many elements, each through a phase shifter.</b> Delay each element a little more than its neighbour and the wavelet envelope — the wavefront — tilts. Nothing moves: the beam repositions in <b>microseconds</b>. But every element is fed from the <i>same</i> source, so a PESA still forms <b>one beam on one frequency</b> at a time, and the single transmitter is a single point of failure. Fast eyes, one pair of them.</div>`,
      aesa: `<div class="wx-hint"><b>Every element is its own radar.</b> A T/R module = a solid-state power amplifier + a low-noise receiver + its own phase shifter. Independent control means the array can split into sub-arrays and form <b>multiple simultaneous beams</b> — searching here while tracking there while pushing a <a data-goto="datalinks">datalink</a> somewhere else. It can change frequency <b>pulse to pulse</b> (brutal to jam), spread energy into <b>LPI</b> waveforms an <a data-goto="rwr">RWR</a> struggles to classify, and it <b>degrades gracefully</b>: kill modules with the slider and the beam widens and dims, but the radar keeps working. A dish with a dead transmitter is scrap.</div>`,
    };
    read.innerHTML = T[mode];
  }

  const stop = frame((now) => {
    const w = _V.w, h = _V.h; g.clearRect(0, 0, w, h);
    const T = now / 1000;
    const hwY = h - 104;                      // hardware strip baseline (room for labels)
    const cx = w / 2;
    const arrayW = Math.max(80, Math.min(w * 0.55, 300));
    const d = arrayW / (N - 1);               // element spacing in px
    // dish geometry (kept compact + shallow so it stays in frame at any slew)
    const dishA = arrayW * 0.32, dishF = dishA * 0.95;
    const lamPx = Math.max(14, d * 2);        // λ = 2d (half-wave spacing)
    const th = steer * Math.PI / 180;
    const live = (i) => !(mode === 'aesa' && i % 2 === 0 && i < failed * 2);

    // ── radiated wavefronts ──
    const front = ((T * 60) % lamPx) + lamPx * 6;
    g.save();
    g.beginPath(); g.rect(0, 0, w, hwY - 6); g.clip();
    if (mode === 'mech') {
      // ONE aperture = ONE radiator. The whole plate radiates a single wavefront
      // that propagates along the face normal — so the ONLY way to move the beam
      // is to move the plate. Drawn as arcs from a single origin, in a beam sector.
      const halfBeam = 0.22;                            // radians, illustrative
      for (let k = 0; k < 9; k++) {
        const r = front - k * lamPx;
        if (r <= 6) continue;
        g.strokeStyle = `rgba(0,229,255,${0.46 - k * 0.045})`;
        g.lineWidth = 2;
        g.beginPath();
        g.arc(cx, hwY, r, -Math.PI / 2 + th - halfBeam, -Math.PI / 2 + th + halfBeam);
        g.stroke();
      }
      // beam edges, to make the single-aperture sector obvious
      g.strokeStyle = 'rgba(0,229,255,.18)'; g.setLineDash([4, 5]); g.lineWidth = 1;
      for (const s of [-1, 1]) {
        const a = th + s * halfBeam;
        g.beginPath(); g.moveTo(cx, hwY);
        g.lineTo(cx + Math.sin(a) * (hwY - 10), hwY - Math.cos(a) * (hwY - 10)); g.stroke();
      }
      g.setLineDash([]);
    } else {
      // Phased array: EACH ELEMENT is its own wave origin; the envelope of those
      // wavelets is the wavefront. Delay them progressively and the envelope tilts.
      for (let i = 0; i < N; i++) {
        if (!live(i)) continue;
        const xn = cx + (i - (N - 1) / 2) * d;
        const delay = (xn - cx) * Math.sin(th);
        for (let k = 0; k < 7; k++) {
          const r = front - delay - k * lamPx;
          if (r <= 2) continue;
          g.strokeStyle = `rgba(0,229,255,${0.30 - k * 0.035})`;
          g.lineWidth = 1;
          g.beginPath(); g.arc(xn, hwY, r, Math.PI, 2 * Math.PI); g.stroke();
        }
        // the element itself, glowing as the origin of its wavelet
        const c = mode === 'aesa' ? COL.green : COL.amber;
        g.fillStyle = c; g.shadowColor = c; g.shadowBlur = 6;
        g.beginPath(); g.arc(xn, hwY, 2.6, 0, 7); g.fill(); g.shadowBlur = 0;
      }
      lbl(g, 10, 30, `${N} element sources — each radiates its own wavelet`,
        mode === 'aesa' ? COL.green : COL.amber, 'left', 8.5);
    }
    g.restore();

    // ── resulting beam axis (+ a second beam for AESA) ──
    const beam = (ang, col, wide) => {
      const L = hwY - 14;
      g.strokeStyle = col; g.lineWidth = wide;
      g.save(); g.shadowColor = col; g.shadowBlur = 10;
      g.beginPath(); g.moveTo(cx, hwY); g.lineTo(cx + Math.sin(ang) * L, hwY - Math.cos(ang) * L); g.stroke();
      g.restore();
    };
    const degraded = mode === 'aesa' ? 1 + failed * 0.16 : 1;
    beam(th, MODES[mode].col, 6 * degraded);
    if (mode === 'aesa') {
      const th2 = Math.sin(T * 0.9) * 0.9;      // simultaneous search beam
      beam(th2, 'rgba(34,255,156,.45)', 3);
      lbl(g, 10, 30, 'second beam: searching while beam 1 tracks', COL.green, 'left', 8.5);
    }

    // ── hardware strip ──
    g.strokeStyle = 'rgba(78,128,178,.3)'; g.beginPath();
    g.moveTo(0, hwY + 2); g.lineTo(w, hwY + 2); g.stroke();
    if (mode === 'mech') {
      // ONE flat plate (a slotted planar array on a gimbal — what mechanically
      // scanned fighter radars actually use), fed by a single transmitter.
      const A = dishA;
      g.save(); g.translate(cx, hwY); g.rotate(th);
      g.fillStyle = 'rgba(0,229,255,.20)'; g.strokeStyle = COL.blue; g.lineWidth = 3;
      g.fillRect(-A, -5, 2 * A, 10); g.strokeRect(-A, -5, 2 * A, 10);
      for (let i = 1; i < 10; i++) {                   // slot detail on the face
        const x = -A + (2 * A) * i / 10;
        g.strokeStyle = 'rgba(0,229,255,.45)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(x, -4); g.lineTo(x, 4); g.stroke();
      }
      g.restore();
      lbl(g, cx + Math.cos(th) * (A + 16), hwY + Math.sin(th) * (A + 16),
        'ONE aperture', COL.blue, 'center', 8.5);
      // single transmitter feeding the whole plate through a waveguide
      g.strokeStyle = COL.amber; g.lineWidth = 2;
      g.beginPath(); g.moveTo(cx, hwY + 4); g.lineTo(cx, hwY + 22); g.stroke();
      g.fillStyle = COL.amber; g.fillRect(cx - 30, hwY + 22, 60, 14);
      g.fillStyle = '#06121f'; g.font = 'bold 8px "JetBrains Mono"'; g.textAlign = 'center';
      g.fillText('1 TRANSMITTER', cx, hwY + 32); g.textAlign = 'left';
      // the gimbal that has to physically move it
      g.strokeStyle = COL.red; g.lineWidth = 1.6;
      g.beginPath(); g.arc(cx, hwY + 44, 11, 0.2, Math.PI - 0.2); g.stroke();
      arrow(g, cx - 11, hwY + 44, cx - 14, hwY + 38, COL.red, 4, 1.2);
      lbl(g, cx, hwY + 62, 'GIMBAL + MOTOR — the whole plate must swing; inertia sets the scan rate', COL.red, 'center', 8.5);
    } else {
      // element row
      for (let i = 0; i < N; i++) {
        const xn = cx + (i - (N - 1) / 2) * d;
        const ok = live(i);
        const c = !ok ? '#5a2020' : mode === 'aesa' ? COL.green : COL.amber;
        g.fillStyle = c; g.fillRect(xn - d * 0.32, hwY - 4, Math.max(3, d * 0.64), 9);
        if (mode === 'aesa') {         // per-element T/R module block
          g.strokeStyle = ok ? 'rgba(34,255,156,.65)' : 'rgba(255,61,0,.55)';
          g.lineWidth = 1; g.strokeRect(xn - d * 0.36, hwY + 12, Math.max(4, d * 0.72), 16);
          if (!ok) { g.strokeStyle = COL.red; g.beginPath();
            g.moveTo(xn - d * 0.3, hwY + 15); g.lineTo(xn + d * 0.3, hwY + 25);
            g.moveTo(xn + d * 0.3, hwY + 15); g.lineTo(xn - d * 0.3, hwY + 25); g.stroke(); }
        } else {                        // PESA: phase shifter fed from one source
          g.strokeStyle = 'rgba(255,176,0,.5)'; g.lineWidth = 1;
          g.beginPath(); g.moveTo(xn, hwY + 6); g.lineTo(cx, hwY + 34); g.stroke();
          g.strokeStyle = COL.amber; g.strokeRect(xn - 3, hwY + 8, 6, 7);
        }
      }
      if (mode === 'pesa') {
        g.fillStyle = COL.amber; g.fillRect(cx - 30, hwY + 36, 60, 15);
        g.fillStyle = '#06121f'; g.font = 'bold 8px "JetBrains Mono"'; g.textAlign = 'center';
        g.fillText('1 TRANSMITTER', cx, hwY + 46); g.textAlign = 'left';
        lbl(g, cx, hwY + 62, 'one source → divider → φ shifters: ONE beam, ONE frequency', COL.amber, 'center', 8.5);
      } else {
        lbl(g, cx, hwY + 40, 'φ', COL.green, 'center', 8);
        lbl(g, cx, hwY + 56, `${N} independent T/R modules — amp + receiver + φ each` + (failed ? `  ·  ${failed * 2} DEAD` : ''), COL.green, 'center', 8.5);
      }
    }
    lbl(g, 10, 16, MODES[mode].name + (mode === 'mech' ? ' — the metal must move' : ' — the wavefront tilts, nothing moves'), MODES[mode].col, 'left', 10, true);
  });
  sync();
  return stop;
});

// ── BEAMWIDTH: aperture, wavelength, and the price of steering off boresight ─
reg('beamwidth', (node) => {
  const _V = makeCanvas(node, 300); const { g } = _V;
  const ctr = el('div', { class: 'wx-controls' }); node.appendChild(ctr);
  const read = el('div', { class: 'wx-readout' }); node.appendChild(read);
  let D = 0.6, fGHz = 10, steer = 0;
  const sD = slider('Array width D (m)', 0.2, 1.2, 0.05, D, v => { D = v; draw(); });
  const sF = slider('Frequency (GHz)', 1, 16, 0.5, fGHz, v => { fGHz = v; draw(); });
  const sS = slider('Steer off boresight (°)', 0, 70, 1, steer, v => { steer = v; draw(); });
  ctr.append(sD.row, sF.row, sS.row);
  const C = 3e8;
  // uniform linear array factor, half-wave spacing
  const AF = (u, u0, N) => {
    const psi = Math.PI * (Math.sin(u) - Math.sin(u0));
    const den = N * Math.sin(psi / 2);
    if (Math.abs(den) < 1e-9) return 1;
    return Math.abs(Math.sin(N * psi / 2) / den);
  };
  function draw() {
    const w = _V.w, h = _V.h, cx = w / 2, cy = h - 26;
    const R0 = Math.max(40, Math.min(w / 2 - 30, h - 60));
    g.clearRect(0, 0, w, h);
    const lam = C / (fGHz * 1e9);
    const N = Math.max(2, Math.round(D / (lam / 2)));
    const u0 = steer * Math.PI / 180;
    // polar pattern, dB scale (0 to -35 dB)
    const dbFloor = -35;
    const rOf = db => R0 * Math.max(0.02, (Math.max(db, dbFloor) - dbFloor) / -dbFloor);
    // grid
    g.strokeStyle = 'rgba(78,128,178,.16)';
    for (const db of [0, -10, -20, -30]) { const r = rOf(db);
      g.beginPath(); g.arc(cx, cy, r, Math.PI, 2 * Math.PI); g.stroke();
      g.fillStyle = COL.faint; g.font = '8px "JetBrains Mono"'; g.fillText(db + ' dB', cx + 3, cy - r - 2); }
    for (const a of [-60, -30, 0, 30, 60]) { const rad = a * Math.PI / 180;
      g.strokeStyle = 'rgba(78,128,178,.14)'; g.beginPath(); g.moveTo(cx, cy);
      g.lineTo(cx + R0 * Math.sin(rad), cy - R0 * Math.cos(rad)); g.stroke();
      lbl(g, cx + (R0 + 14) * Math.sin(rad), cy - (R0 + 14) * Math.cos(rad) + 3, a + '°', COL.faint, 'center', 8); }
    // pattern
    g.beginPath();
    let first = true, peak = 0, peakU = 0;
    for (let deg = -90; deg <= 90; deg += 0.35) {
      const u = deg * Math.PI / 180;
      const amp = AF(u, u0, N);
      if (amp > peak) { peak = amp; peakU = u; }
      const db = 20 * Math.log10(Math.max(amp, 1e-4));
      const r = rOf(db);
      const x = cx + r * Math.sin(u), y = cy - r * Math.cos(u);
      first ? (g.moveTo(x, y), first = false) : g.lineTo(x, y);
    }
    g.strokeStyle = COL.blue; g.lineWidth = 2; g.stroke();
    g.lineTo(cx, cy); g.closePath(); g.fillStyle = 'rgba(0,229,255,.10)'; g.fill();
    // measure the -3 dB beamwidth numerically about the steered peak
    const half = Math.pow(10, -3 / 20);
    let lo = peakU, hi = peakU;
    for (let dd = 0; dd < 90; dd += 0.05) { const u = peakU - dd * Math.PI / 180;
      if (u < -Math.PI / 2 || AF(u, u0, N) < half * peak) { lo = u; break; } }
    for (let dd = 0; dd < 90; dd += 0.05) { const u = peakU + dd * Math.PI / 180;
      if (u > Math.PI / 2 || AF(u, u0, N) < half * peak) { hi = u; break; } }
    const bw = (hi - lo) * 180 / Math.PI;
    // boresight reference beamwidth
    let bl = 0, bh = 0;
    for (let dd = 0; dd < 90; dd += 0.05) { const u = -dd * Math.PI / 180; if (AF(u, 0, N) < half) { bl = u; break; } }
    for (let dd = 0; dd < 90; dd += 0.05) { const u = dd * Math.PI / 180; if (AF(u, 0, N) < half) { bh = u; break; } }
    const bw0 = (bh - bl) * 180 / Math.PI;
    // array face + steer marker
    g.strokeStyle = COL.dim; g.lineWidth = 3;
    g.beginPath(); g.moveTo(cx - Math.min(60, R0 * 0.5), cy); g.lineTo(cx + Math.min(60, R0 * 0.5), cy); g.stroke();
    g.strokeStyle = COL.amber; g.setLineDash([3, 3]); g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + R0 * Math.sin(u0), cy - R0 * Math.cos(u0)); g.stroke(); g.setLineDash([]);
    const gainLoss = 10 * Math.log10(Math.max(Math.cos(u0), 1e-3));
    read.innerHTML =
      `<div class="wx-line">λ = <b>${(lam * 100).toFixed(1)} cm</b> · <b>${N}</b> elements at λ/2 · beamwidth <b style="color:${COL.blue}">${bw.toFixed(1)}°</b> ` +
      `<span style="color:${COL.dim}">(${bw0.toFixed(1)}° on boresight)</span> · aperture gain penalty <b style="color:${COL.amber}">${gainLoss.toFixed(1)} dB</b></div>` +
      `<div class="wx-hint">Beamwidth is set by how many wavelengths wide the aperture is: <b>θ ≈ λ/D</b>. Widen the array or shorten the wavelength and the beam sharpens — better angular resolution and more gain, but a narrower straw to search the sky with. Now drag the steer angle: an electronically scanned array does not turn, so the beam sees a <b>foreshortened</b> aperture of D·cos θ. The beam <b>fattens as 1/cos θ</b> and gain falls with cos θ — by 60° you have lost about <b>3 dB</b> and the beam is twice as wide. That geometry, not electronics, is why an AESA face is generally worked within roughly <b>±60°</b> and why fighters still have to point at the fight. Watch the <b>sidelobes</b> too — the little lobes either side of the main beam. They are how jamming and ground clutter sneak in through the "back door", and taming them is a whole discipline (amplitude tapering, at the cost of a slightly wider main beam).</div>`;
  }
  _V.redraw = draw; draw();
  return () => {};
});

// ── BAR SCAN: the raster that actually searches the sky, and its frame time ──
reg('barscan', (node) => {
  const _V = makeCanvas(node, 300); const { g } = _V;
  const ctr = el('div', { class: 'wx-controls' }); node.appendChild(ctr);
  const read = el('div', { class: 'wx-readout' }); node.appendChild(read);
  let azHalf = 60, bars = 4, rng = 60;
  const sA = slider('Azimuth scan (± °)', 10, 60, 5, azHalf, v => { azHalf = v; });
  const sB = slider('Elevation bars', 1, 8, 1, bars, v => { bars = v; });
  const sR = slider('Target range (km)', 10, 150, 5, rng, v => { rng = v; });
  ctr.append(sA.row, sB.row, sR.row);
  const BW = 3.3;            // beam/bar height, degrees (typical X-band fighter)
  const RATE = 70;           // antenna sweep rate, deg/s
  const stop = frame((now) => {
    const w = _V.w, h = _V.h; g.clearRect(0, 0, w, h);
    const padL = 46, padR = 16, padT = 26, padB = 54;
    const pw = Math.max(40, w - padL - padR), ph = Math.max(40, h - padT - padB);
    const elevSpan = Math.max(bars * BW, 6);
    const X = az => padL + (az + azHalf) / (2 * azHalf) * pw;
    const Y = elv => padT + (elevSpan / 2 - elv) / elevSpan * ph;
    // frame geometry
    g.strokeStyle = 'rgba(78,128,178,.35)'; g.lineWidth = 1; g.strokeRect(padL, padT, pw, ph);
    // bar lanes
    for (let b = 0; b < bars; b++) {
      const eC = elevSpan / 2 - BW * (b + 0.5);
      g.fillStyle = b % 2 ? 'rgba(0,229,255,0.035)' : 'rgba(0,229,255,0.06)';
      g.fillRect(padL, Y(eC + BW / 2), pw, Math.max(2, ph * BW / elevSpan));
      lbl(g, padL - 6, Y(eC) + 3, 'bar ' + (b + 1), COL.faint, 'right', 8);
    }
    // the sweeping beam
    const frameT = bars * (2 * azHalf) / RATE;
    const tt = (now / 1000) % frameT;
    const barIdx = Math.min(bars - 1, Math.floor(tt / (frameT / bars)));
    const within = (tt % (frameT / bars)) / (frameT / bars);
    const azNow = (barIdx % 2 === 0 ? -azHalf + within * 2 * azHalf : azHalf - within * 2 * azHalf);
    const eNow = elevSpan / 2 - BW * (barIdx + 0.5);
    // painted trail for the current frame
    for (let b = 0; b <= barIdx; b++) {
      const eC = elevSpan / 2 - BW * (b + 0.5);
      const done = b < barIdx ? 1 : within;
      const x0 = b % 2 === 0 ? X(-azHalf) : X(azHalf);
      const x1 = b % 2 === 0 ? X(-azHalf + done * 2 * azHalf) : X(azHalf - done * 2 * azHalf);
      g.strokeStyle = 'rgba(0,229,255,.28)'; g.lineWidth = Math.max(2, ph * BW / elevSpan * 0.7);
      g.beginPath(); g.moveTo(x0, Y(eC)); g.lineTo(x1, Y(eC)); g.stroke();
    }
    g.fillStyle = COL.blue; g.shadowColor = COL.blue; g.shadowBlur = 10;
    g.beginPath(); g.arc(X(azNow), Y(eNow), 6, 0, 7); g.fill(); g.shadowBlur = 0;
    // axes
    g.fillStyle = COL.dim; g.font = '9px "JetBrains Mono"';
    lbl(g, w / 2, h - 34, 'AZIMUTH  (−' + azHalf + '° … +' + azHalf + '°)', COL.dim, 'center', 9);
    lbl(g, padL - 8, padT - 8, 'ELEV', COL.dim, 'right', 9);
    lbl(g, 10, 16, `RASTER SEARCH — ${bars}-bar, ±${azHalf}°`, COL.blue, 'left', 10, true);
    // numbers
    const slabKm = 2 * rng * Math.tan(elevSpan / 2 * Math.PI / 180);
    const moved = 400 * frameT / 1000;
    read.innerHTML =
      `<div class="wx-line">frame time <b style="color:${COL.amber}">${frameT.toFixed(1)} s</b> · elevation covered <b>${elevSpan.toFixed(1)}°</b> ` +
      `· at ${rng} km that is a slab only <b style="color:${COL.blue}">${slabKm.toFixed(1)} km</b> tall · a 400 m/s target moves <b style="color:${COL.red}">${moved.toFixed(1)} km</b> between looks</div>` +
      `<div class="wx-hint">A radar does not "see" a cone — it <b>paints</b> one, one <b>bar</b> at a time. The antenna sweeps azimuth, steps down roughly one beamwidth in elevation, sweeps back, and repeats; the number of bars is a direct trade of <b>volume against freshness</b>. Widen the azimuth or add bars and you cover more sky, but the <b>frame time</b> grows and every track gets staler — which is exactly the gap a defender exploits. And notice the elevation slab: even a 4-bar scan is a thin sheet at long range, so a target only a few thousand feet off your scan centre is simply <b>not in the volume</b>. Half of intercept work is putting the beam where the target will be — and the reason an <b>AESA</b> changes the game is that it can revisit a track between search bars instead of waiting for the next frame.</div>`;
  });
  return stop;
});

// ── Gamified: pick the right radar for the requirement ──────────────────────
const RADARQ = [
  { q: 'You must track six targets while still searching for new ones, from one antenna.',
    a: ['Mechanical dish', 'PESA', 'AESA'], correct: 2,
    why: 'Only an AESA can split its elements into sub-arrays and run genuinely simultaneous beams. A dish and a PESA both form one beam at a time — TWS interleaving helps, but the beam is still shared.' },
  { q: 'The enemy is jamming a narrow band hard. Which survives best?',
    a: ['Mechanical dish', 'AESA with pulse-to-pulse frequency agility', 'PESA'], correct: 1,
    why: 'Independent T/R modules let an AESA change frequency between pulses and spread energy across the band, so a narrowband jammer never sits on the right frequency long enough.' },
  { q: 'A cruise missile is skimming the deck below you against heavy ground clutter. What actually solves this?',
    a: ['A bigger antenna', 'Pulse-Doppler processing', 'A faster scan rate'], correct: 1,
    why: 'This is a PROCESSING problem, not a steering one. Pulse-Doppler filters returns by radial velocity, separating a fast mover from the huge zero-Doppler ground return. A mechanical radar with pulse-Doppler can do it; an AESA without it cannot.' },
  { q: 'One transmitter tube fails. Which radar keeps fighting?',
    a: ['Mechanical dish', 'PESA', 'AESA'], correct: 2,
    why: 'Graceful degradation. AESA power is distributed across hundreds of modules — losing some slightly widens the beam and lowers power. A dish or PESA fed by a single transmitter simply goes dark.' },
  { q: 'You want the beam to jump between two widely separated targets in microseconds.',
    a: ['Mechanical dish', 'Either PESA or AESA', 'Only a mechanical dish'], correct: 1,
    why: 'Both electronically scanned types steer by phase, with no inertia at all. That is the shared advantage of PESA and AESA over any moving antenna.' },
  { q: 'Your AESA is steering 60° off boresight. What has happened to the beam?',
    a: ['Nothing — electronic steering is lossless', 'It is about twice as wide with roughly 3 dB less gain', 'It got narrower'], correct: 1,
    why: 'The array presents a foreshortened aperture D·cos θ. Beamwidth broadens as 1/cos θ and gain falls with cos θ — geometry no electronics can undo, which is why a face is worked within about ±60°.' },
];
reg('radarpick', (node) => {
  const wrap = el('div', { class: 'wx-quiz' }); node.appendChild(wrap);
  let idx = 0, score = 0;
  function render() {
    const c = RADARQ[idx];
    wrap.innerHTML = '';
    wrap.appendChild(el('div', { class: 'wx-qmeta' }, `RADAR CALL ${idx + 1}/${RADARQ.length} · score ${score}`));
    wrap.appendChild(el('div', { class: 'wx-q' }, c.q));
    const opts = el('div', { class: 'wx-opts' });
    let answered = false;
    c.a.forEach((txt, i) => opts.appendChild(el('button', { class: 'wx-opt', onclick: () => {
      if (answered) return; answered = true;
      const ok = i === c.correct;
      [...opts.children].forEach((b, j) => { b.classList.add(j === c.correct ? 'correct' : (j === i ? 'wrong' : 'dim')); b.disabled = true; });
      if (ok) { score++; progress.addXP(8); }
      const why = wrap.querySelector('#rp-why');
      why.innerHTML = `<b style="color:${ok ? COL.green : COL.red}">${ok ? '✓ Correct. +8 XP' : '✗ Not quite.'}</b> ${c.why}`;
      why.appendChild(el('div', {}, el('button', { class: 'wx-btn', style: 'margin-top:10px',
        onclick: () => { idx = (idx + 1) % RADARQ.length; render(); } },
        idx === RADARQ.length - 1 ? '↻ Start over' : 'Next call →')));
    } }, txt)));
    wrap.appendChild(opts);
    wrap.appendChild(el('div', { class: 'wx-why', id: 'rp-why' }));
  }
  render();
  return () => {};
});
