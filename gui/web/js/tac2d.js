// tac2d.js — clean 2D top-down tactical plan view (North-up) with playback.
// Default engagement display: shooter, missile, target, trajectories, line-of-
// sight, datalink, guidance phase, range rings and a scale bar. Built for fast,
// legible 1v1 BVR→WVR analysis.

const C = {
  bg0: '#0a1626', bg1: '#12233b', grid: 'rgba(78,128,178,0.35)', ring: 'rgba(96,158,208,0.5)',
  ink: '#e4eefc', dim: '#93accb',
  msl: '#ffc233', tgt: '#ff5a2a', shooter: '#4ecbff',
  midcourse: '#22e0ff', terminal: '#ff5a2a', inertial: '#c79a4a', datalink: '#33ffa6',
};

export class Tac2D {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.result = null;
    this.index = 0;
    this.active = true;
    this.opts = { rings: true, grid: false, bullseye: false };
    this._panE = 0; this._panN = 0;            // user pan offset (world metres)
    this._measureMode = false; this._measure = null; this._drag = null;
    canvas.style.cursor = 'grab';
    window.addEventListener('resize', () => this.resize());
    const local = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

    // mouse-wheel zoom, anchored on the cursor so you zoom into what you point at
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (!this.bounds) return;
      const [mx, my] = local(e);
      const overMap = my <= this.mapH;
      const before = overMap ? this.S2W(mx, my) : null;   // [N,E] under cursor
      this._userZoom = Math.max(0.4, Math.min(16, (this._userZoom || 1) * (e.deltaY < 0 ? 1.12 : 0.89)));
      this._computeTransform();
      if (before) { const after = this.S2W(mx, my); this._panN += before[0] - after[0]; this._panE += before[1] - after[1]; this._computeTransform(); }
      this.seek(this.index);
    }, { passive: false });

    // left-drag = pan the map; in MEASURE mode it draws a ruler instead
    canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || !this.bounds) return;
      const [mx, my] = local(e);
      if (this._measureMode) {
        const region = my <= this.mapH ? 'map' : 'elev';
        const pt = region === 'map' ? this.S2W(mx, my) : [mx, my];   // map: world [N,E]; elev: screen px
        this._measure = { region, a: pt, b: pt.slice() };
        this.seek(this.index);
      } else { this._drag = { x: e.clientX, y: e.clientY, panE: this._panE, panN: this._panN }; canvas.style.cursor = 'grabbing'; }
    });
    window.addEventListener('mousemove', (e) => {
      if (this._drag) {
        const dx = e.clientX - this._drag.x, dy = e.clientY - this._drag.y;
        this._panE = this._drag.panE - dx / this.scale;
        this._panN = this._drag.panN + dy / this.scale;
        this._computeTransform(); this.seek(this.index);
      } else if (this._measure) {
        const [mx, my] = local(e);
        this._measure.b = this._measure.region === 'map' ? this.S2W(mx, my) : [mx, my];
        this.seek(this.index);
      }
    });
    window.addEventListener('mouseup', () => { if (this._drag) { this._drag = null; canvas.style.cursor = this._measureMode ? 'crosshair' : 'grab'; } });

    // right-click resets the view (zoom + pan) back to fit
    canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); this._userZoom = 1; this._panE = 0; this._panN = 0; this._measure = null; if (this.bounds) { this._computeTransform(); this.seek(this.index); } });
  }

  setOption(key, on) {
    this.opts[key] = on;
    if (key === 'measure') { this._measureMode = on; this.canvas.style.cursor = on ? 'crosshair' : 'grab'; }   // ruler persists until reset
    if (this.result) this.seek(this.index);
  }

  setResult(result) {
    this.result = result;
    const ch = result.channels;
    this.hasShooter = ch.sx && ch.sx.some((v, i) => v !== 0 || ch.sy[i] !== 0);
    // pitbull sample index (seeker went active), from the events log
    const act = (result.events || []).find(e => e.type === 'active');
    this.iPitbull = act ? ch.t.findIndex(t => t >= act.t) : -1;
    // motor phases from the thrust trace: boost → sustain → burnout
    this.iBurnout = -1; this.iBoostEnd = -1;
    if (ch.thrust) {
      const peak = Math.max(...ch.thrust, 1);
      for (let k = 0; k < ch.thrust.length; k++) if (ch.thrust[k] > 10) this.iBurnout = k;
      // boost→sustain: first drop below 45% of peak while still burning
      for (let k = 1; k <= this.iBurnout; k++) {
        if (ch.thrust[k] > 10 && ch.thrust[k] < 0.45 * peak && ch.thrust[k - 1] >= 0.45 * peak) { this.iBoostEnd = k; break; }
      }
    }
    this._userZoom = 1; this._panE = 0; this._panN = 0;   // reset view for each new run
    this._measure = null;
    this._fit();
    this.seek(0);
  }

  _fit() {
    const ch = this.result.channels;
    let minN = Infinity, maxN = -Infinity, minE = Infinity, maxE = -Infinity;
    const acc = (N, E) => { minN = Math.min(minN, N); maxN = Math.max(maxN, N); minE = Math.min(minE, E); maxE = Math.max(maxE, E); };
    for (let i = 0; i < ch.mx.length; i++) {
      acc(ch.mx[i], ch.my[i]); acc(ch.tx[i], ch.ty[i]);
      if (this.hasShooter) acc(ch.sx[i], ch.sy[i]);
    }
    this.bounds = { minN, maxN, minE, maxE };
    this.resize();
  }

  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.canvas.width = w * dpr; this.canvas.height = h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.vw = w; this.vh = h;
    // reserve the bottom band for the elevation (altitude vs downrange) profile
    this.elevH = Math.max(110, Math.min(200, h * 0.30));
    this.mapH = h - this.elevH;
    if (this.bounds) this._computeTransform();
    if (this.result) this.seek(this.index);
  }

  _computeTransform() {
    const b = this.bounds, pad = 60;
    const spanE = Math.max(b.maxE - b.minE, 1000);
    const spanN = Math.max(b.maxN - b.minN, 1000);
    const sx = (this.vw - 2 * pad) / spanE;
    const sy = (this.mapH - 2 * pad) / spanN;
    this.scale = (this._userZoom || 1) * Math.min(sx, sy);   // metres → px
    this.cx = (b.minE + b.maxE) / 2 + (this._panE || 0);
    this.cy = (b.minN + b.maxN) / 2 + (this._panN || 0);
  }

  setZoom(f) { this._userZoom = f; if (this.bounds) { this._computeTransform(); this.seek(this.index); } }

  // world (North, East) → screen px. North up (screen y decreases upward),
  // vertically centred within the top-down map region only.
  W2S(N, E) {
    return [this.vw / 2 + (E - this.cx) * this.scale,
            this.mapH / 2 - (N - this.cy) * this.scale];
  }

  // screen px → world [N, E] (inverse of W2S), for cursor-zoom & the ruler
  S2W(sx, sy) {
    return [this.cy - (sy - this.mapH / 2) / this.scale,
            this.cx + (sx - this.vw / 2) / this.scale];
  }

  setActive(on) {
    this.active = on;
    this.canvas.classList.toggle('hidden', !on);
    if (on) { this.resize(); }
  }

  seek(i) {
    if (!this.result || !this.active) return;
    // the canvas may be unlaid-out (0-width panel hidden/collapsed); don't crash
    if (!this.vw || !this.vh) { this.resize(); if (!this.vw || !this.vh) return; }
    const ch = this.result.channels;
    const n = ch.t.length;
    i = Math.max(0, Math.min(n - 1, Math.round(i)));
    this.index = i;
    const g = this.ctx;
    // background
    const grad = g.createLinearGradient(0, 0, 0, this.vh);
    grad.addColorStop(0, C.bg1); grad.addColorStop(1, C.bg0);
    g.fillStyle = grad; g.fillRect(0, 0, this.vw, this.vh);

    // ── top-down map region (clipped so trails don't spill into the profile) ──
    g.save();
    g.beginPath(); g.rect(0, 0, this.vw, this.mapH); g.clip();
    this._drawGridAndRings(ch);

    // full ghost trajectories
    this._poly(ch.mx, ch.my, n, C.msl, 0.18, 1);
    this._poly(ch.tx, ch.ty, n, C.tgt, 0.18, 1);
    if (this.hasShooter) this._poly(ch.sx, ch.sy, n, C.shooter, 0.16, 1);
    // flown trails up to i
    this._poly(ch.mx, ch.my, i + 1, C.msl, 0.95, 2);
    this._poly(ch.tx, ch.ty, i + 1, C.tgt, 0.95, 2);
    if (this.hasShooter) this._poly(ch.sx, ch.sy, i + 1, C.shooter, 0.8, 2);
    // motor-burn overlay: the powered portion of the missile trail glows hot
    if (this.iBurnout > 0) {
      const upTo = Math.min(i + 1, this.iBurnout + 1);
      g.save(); g.shadowColor = '#ffd070'; g.shadowBlur = 8;
      this._poly(ch.mx, ch.my, upTo, '#ffe9a0', 0.95, 4.5);
      g.restore();
    }

    const M = this.W2S(ch.mx[i], ch.my[i]);
    const T = this.W2S(ch.tx[i], ch.ty[i]);
    const phase = ch.phase ? ch.phase[i] : 'TERMINAL';
    const dl = ch.datalink && ch.datalink[i] === 1;
    const burning = ch.thrust && i <= this.iBurnout && ch.thrust[i] > 10;

    // datalink line (shooter → missile)
    if (this.hasShooter && dl) {
      const S = this.W2S(ch.sx[i], ch.sy[i]);
      this._line(S, M, C.datalink, 0.7, 1.4, [4, 4]);
      this._tag((S[0] + M[0]) / 2, (S[1] + M[1]) / 2 - 8, 'DATALINK', C.datalink);
    }
    // line of sight (missile → target), coloured by phase
    const losCol = (phase === 'MIDCOURSE' || phase === 'INS') ? C.midcourse : phase === 'INERTIAL' ? C.inertial : C.terminal;
    this._line(M, T, losCol, 0.6, 1.4, phase === 'TERMINAL' ? null : [6, 5]);

    // motor-burn markers on the trail: boost/sustain glow + BURNOUT diamond
    if (this.iBoostEnd > 0 && i >= this.iBoostEnd) {
      const B = this.W2S(ch.mx[this.iBoostEnd], ch.my[this.iBoostEnd]);
      g.fillStyle = '#ff8a3a'; g.beginPath(); g.arc(B[0], B[1], 3, 0, 7); g.fill();
      this._tag(B[0] + 8, B[1] + 10, 'BOOST→SUSTAIN', '#ff8a3a');
    }
    if (this.iBurnout > 0 && i >= this.iBurnout) {
      const O = this.W2S(ch.mx[this.iBurnout], ch.my[this.iBurnout]);
      g.save(); g.translate(O[0], O[1]); g.rotate(Math.PI / 4);
      g.strokeStyle = '#ffd070'; g.fillStyle = 'rgba(255,208,112,0.25)'; g.lineWidth = 1.6;
      g.fillRect(-5, -5, 10, 10); g.strokeRect(-5, -5, 10, 10); g.restore();
      this._tag(O[0] + 9, O[1] - 8, 'BURNOUT', '#ffd070');
    }
    // live motor status chip near the missile while powered
    if (burning) {
      const boost = this.iBoostEnd < 0 || i < this.iBoostEnd;
      this._tag(M[0], M[1] + 22, boost ? '▲ BOOST' : '▲ SUSTAIN', '#ffe9a0');
    }

    // pitbull marker: diamond on the missile trail where the seeker went active
    if (this.iPitbull >= 0 && i >= this.iPitbull) {
      const P = this.W2S(ch.mx[this.iPitbull], ch.my[this.iPitbull]);
      g.save(); g.translate(P[0], P[1]); g.rotate(Math.PI / 4);
      g.strokeStyle = C.terminal; g.lineWidth = 1.6; g.strokeRect(-5, -5, 10, 10);
      g.restore();
      this._tag(P[0] + 9, P[1] - 8, 'PITBULL', C.terminal);
    }

    // entities
    if (this.hasShooter) this._craft(ch.sx, ch.sy, i, C.shooter, 'SHOOTER', 9);
    this._craft(ch.tx, ch.ty, i, C.tgt, 'TGT', 10);
    this._craft(ch.mx, ch.my, i, C.msl, 'MSL', 7, true);
    g.restore();   // end map clip

    this._overlay(ch, i, phase, dl);
    this._drawElevation(ch, i);
    this._drawMeasure();
    // interaction hint (top-right of the map)
    g.fillStyle = 'rgba(147,172,203,0.45)'; g.font = '9px "JetBrains Mono", monospace'; g.textAlign = 'right';
    g.fillText(this._measureMode ? 'MEASURE: drag a ruler · right-click: reset' : 'wheel: zoom · drag: pan · right-click: reset', this.vw - 10, 13);
    g.textAlign = 'left';
  }

  // ── measuring ruler: ground range/bearing on the map, Δrange/Δalt on the profile
  _drawMeasure() {
    const m = this._measure; if (!m) return;
    const g = this.ctx;
    let ax, ay, bx, by, label = '';
    if (m.region === 'map') {
      [ax, ay] = this.W2S(m.a[0], m.a[1]);      // a,b are world [N,E] → project live
      [bx, by] = this.W2S(m.b[0], m.b[1]);
      const dN = m.b[0] - m.a[0], dE = m.b[1] - m.a[1];
      let brg = Math.atan2(dE, dN) * 180 / Math.PI; if (brg < 0) brg += 360;
      label = `${(Math.hypot(dN, dE) / 1000).toFixed(1)} km · ${brg.toFixed(0)}°`;
    } else {
      [ax, ay] = m.a; [bx, by] = m.b;           // elevation transform is fixed → screen px
      const e = this._elev;
      if (e) {
        const inv = (sx, sy) => [(sx - e.x0) / e.plotW * e.drMax, (e.bot - sy) / e.h * e.altMax];
        const A = inv(ax, ay), B = inv(bx, by);
        const dAlt = B[1] - A[1];
        label = `Δrange ${(Math.abs(B[0] - A[0]) / 1000).toFixed(1)} km · Δalt ${dAlt >= 0 ? '+' : ''}${dAlt.toFixed(0)} m`;
      }
    }
    g.save();
    g.strokeStyle = '#ffd070'; g.lineWidth = 1.5; g.setLineDash([5, 4]);
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#ffd070';
    for (const p of [[ax, ay], [bx, by]]) { g.beginPath(); g.arc(p[0], p[1], 3, 0, 7); g.fill(); }
    const mxp = (ax + bx) / 2, myp = (ay + by) / 2;
    g.font = 'bold 11px "JetBrains Mono", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const wlab = g.measureText(label).width + 12;
    g.fillStyle = 'rgba(10,16,26,0.92)'; g.fillRect(mxp - wlab / 2, myp - 24, wlab, 16);
    g.strokeStyle = '#ffd070'; g.lineWidth = 1; g.strokeRect(mxp - wlab / 2, myp - 24, wlab, 16);
    g.fillStyle = '#ffd070'; g.fillText(label, mxp, myp - 16);
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.restore();
  }

  // ── elevation profile: altitude (m) vs downrange (km along the merge axis) ──
  _drawElevation(ch, i) {
    const g = this.ctx, n = ch.t.length;
    const top = this.mapH + 6, h = this.elevH - 12, bot = top + h;
    const padL = 46, padR = 14;
    const x0 = padL, x1 = this.vw - padR, plotW = x1 - x0;
    // accurate ground-range axis: true horizontal distance from the launch point
    // (no projection distortion — the missile & target altitude traces converge
    //  at the intercept because they share the same ground range there).
    const Lx = this.hasShooter ? ch.sx[0] : ch.mx[0];
    const Ly = this.hasShooter ? ch.sy[0] : ch.my[0];
    const dr = (X, Y) => Math.hypot(X - Lx, Y - Ly);   // metres, horizontal
    // ranges
    let drMax = 1, altMax = 1000;
    for (let k = 0; k < n; k++) {
      drMax = Math.max(drMax, dr(ch.mx[k], ch.my[k]), dr(ch.tx[k], ch.ty[k]));
      altMax = Math.max(altMax, ch.malt[k], ch.talt[k], this.hasShooter ? ch.salt[k] : 0);
    }
    altMax = Math.ceil(altMax / 2000) * 2000;
    const X = (d) => x0 + (d / drMax) * plotW;
    const Y = (a) => bot - (a / altMax) * h;
    this._elev = { x0, plotW, drMax, bot, h, altMax };   // for the measure ruler
    // panel bg + frame
    g.fillStyle = 'rgba(8,16,28,0.55)'; g.fillRect(0, this.mapH, this.vw, this.elevH);
    g.strokeStyle = 'rgba(78,128,178,0.25)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, this.mapH); g.lineTo(this.vw, this.mapH); g.stroke();
    // altitude gridlines + labels
    g.font = '9px "JetBrains Mono", monospace'; g.textBaseline = 'middle';
    const step = altMax <= 12000 ? 3000 : altMax <= 24000 ? 6000 : 10000;
    for (let a = 0; a <= altMax; a += step) {
      const yy = Y(a);
      g.strokeStyle = 'rgba(78,128,178,0.14)'; g.beginPath(); g.moveTo(x0, yy); g.lineTo(x1, yy); g.stroke();
      g.fillStyle = C.dim; g.fillText((a / 1000) + 'k', 6, yy);
    }
    g.textBaseline = 'alphabetic';
    g.fillStyle = C.dim; g.fillText('ALT (m)', 6, top + 10);
    g.fillText('GROUND RANGE FROM LAUNCH · ' + (drMax / 1000).toFixed(0) + ' km →', x1 - 210, bot + 9 > this.vh ? this.vh - 3 : bot + 9);
    // profiles (ghost full + flown)
    const prof = (mx, my, alt, color, count, alpha, w) => {
      g.save(); g.globalAlpha = alpha; g.strokeStyle = color; g.lineWidth = w; g.lineJoin = 'round';
      g.beginPath();
      for (let k = 0; k < count; k++) { const px = X(dr(mx[k], my[k])), py = Y(alt[k]); k ? g.lineTo(px, py) : g.moveTo(px, py); }
      g.stroke(); g.restore();
    };
    if (this.hasShooter) { prof(ch.sx, ch.sy, ch.salt, C.shooter, n, 0.16, 1); prof(ch.sx, ch.sy, ch.salt, C.shooter, i + 1, 0.85, 1.6); }
    prof(ch.tx, ch.ty, ch.talt, C.tgt, n, 0.16, 1); prof(ch.tx, ch.ty, ch.talt, C.tgt, i + 1, 0.95, 1.8);
    prof(ch.mx, ch.my, ch.malt, C.msl, n, 0.18, 1); prof(ch.mx, ch.my, ch.malt, C.msl, i + 1, 0.95, 2);
    // motor-burn segment glows hot on the elevation profile + burnout tick
    if (this.iBurnout > 0) {
      const upTo = Math.min(i + 1, this.iBurnout + 1);
      g.save(); g.globalAlpha = 0.95; g.strokeStyle = '#ffe9a0'; g.lineWidth = 4; g.shadowColor = '#ffd070'; g.shadowBlur = 6;
      g.beginPath();
      for (let k = 0; k < upTo; k++) { const px = X(dr(ch.mx[k], ch.my[k])), py = Y(ch.malt[k]); k ? g.lineTo(px, py) : g.moveTo(px, py); }
      g.stroke(); g.restore();
      if (i >= this.iBurnout) {
        const px = X(dr(ch.mx[this.iBurnout], ch.my[this.iBurnout])), py = Y(ch.malt[this.iBurnout]);
        g.strokeStyle = '#ffd070'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(px, py - 5); g.lineTo(px, py + 5); g.stroke();
        this._tag(px, py - 8, 'BURNOUT', '#ffd070');
      }
    }
    // current markers
    const dot = (mx, my, alt, color) => { const px = X(dr(mx[i], my[i])), py = Y(alt[i]); g.fillStyle = color; g.beginPath(); g.arc(px, py, 3, 0, 7); g.fill(); };
    if (this.hasShooter) dot(ch.sx, ch.sy, ch.salt, C.shooter);
    dot(ch.tx, ch.ty, ch.talt, C.tgt); dot(ch.mx, ch.my, ch.malt, C.msl);
    // pitbull tick on the elevation profile
    if (this.iPitbull >= 0 && i >= this.iPitbull) {
      const px = X(dr(ch.mx[this.iPitbull], ch.my[this.iPitbull])), py = Y(ch.malt[this.iPitbull]);
      g.strokeStyle = C.terminal; g.lineWidth = 1.4; g.beginPath(); g.moveTo(px, py - 6); g.lineTo(px, py + 6); g.stroke();
    }
    g.fillStyle = C.msl; g.font = '9px "JetBrains Mono", monospace';
    g.fillText('◤ ELEVATION PROFILE', x1 - 130, top + 10);
  }

  _drawGridAndRings(ch) {
    const g = this.ctx;
    const oN = this.hasShooter ? ch.sx[0] : ch.mx[0];
    const oE = this.hasShooter ? ch.sy[0] : ch.my[0];
    const O = this.W2S(oN, oE);
    // km grid (North/East) across the whole map
    if (this.opts.grid) {
      g.save(); g.strokeStyle = C.grid; g.lineWidth = 0.5; g.globalAlpha = 0.5;
      g.font = '9px "JetBrains Mono", monospace'; g.fillStyle = C.dim;
      const stepM = this._niceStep();
      const c0 = this.W2S(this.cy, this.cx);
      for (let s = -20; s <= 20; s++) {
        const px = c0[0] + s * stepM * this.scale;
        if (px > 0 && px < this.vw) { g.beginPath(); g.moveTo(px, 0); g.lineTo(px, this.mapH); g.stroke(); }
        const py = c0[1] + s * stepM * this.scale;
        if (py > 0 && py < this.mapH) { g.beginPath(); g.moveTo(0, py); g.lineTo(this.vw, py); g.stroke(); }
      }
      g.globalAlpha = 1; g.restore();
    }
    // range rings centred on the launcher
    if (this.opts.rings) {
      g.save();
      for (let km = 10; km <= 200; km += 10) {
        const r = km * 1000 * this.scale;
        if (r < 24) continue; if (r > Math.hypot(this.vw, this.vh)) break;
        g.beginPath(); g.arc(O[0], O[1], r, 0, 7);
        g.strokeStyle = C.ring; g.lineWidth = km % 50 === 0 ? 1.1 : 0.6; g.stroke();
        if (km % 20 === 0) {
          g.fillStyle = C.dim; g.font = '10px "JetBrains Mono", monospace';
          g.fillText(km + ' km', O[0] + r * 0.7071 + 3, O[1] - r * 0.7071 - 3);
        }
      }
      g.restore();
    }
    // bullseye: labelled datum at the launch point with N/E cross + bearing ticks
    if (this.opts.bullseye) this._drawBullseye(O);
  }

  // ── configurable bullseye datum: custom range rings + bearing spokes ────────
  _drawBullseye(O) {
    const g = this.ctx;
    const b = this.bull || (this.bull = { rings: 4, spacing_km: 20, bearing_step: 30 });
    const amber = 'rgba(255,176,0,'; g.save();
    g.font = '9px "JetBrains Mono", monospace';
    // range rings at the chosen spacing, with km labels
    for (let i = 1; i <= b.rings; i++) {
      const km = i * b.spacing_km, r = km * 1000 * this.scale;
      if (r > Math.hypot(this.vw, this.mapH) * 1.1) break;
      g.strokeStyle = amber + (i === b.rings ? '0.6)' : '0.32)');
      g.lineWidth = i === b.rings ? 1.3 : 0.8;
      g.beginPath(); g.arc(O[0], O[1], r, 0, 7); g.stroke();
      g.fillStyle = amber + '0.7)';
      g.fillText(km + ' km', O[0] + 3, O[1] - r - 3);
    }
    // bearing spokes with degree labels (0 = North, clockwise)
    if (b.bearing_step > 0) {
      const rMax = b.rings * b.spacing_km * 1000 * this.scale;
      for (let deg = 0; deg < 360; deg += b.bearing_step) {
        const rad = deg * Math.PI / 180;              // 0=N (up), clockwise
        const dx = Math.sin(rad), dy = -Math.cos(rad);
        const major = deg % 90 === 0;
        g.strokeStyle = amber + (major ? '0.5)' : '0.22)');
        g.lineWidth = major ? 1.1 : 0.6;
        g.beginPath(); g.moveTo(O[0], O[1]); g.lineTo(O[0] + dx * rMax, O[1] + dy * rMax); g.stroke();
        // label just past the outer ring
        const lx = O[0] + dx * (rMax + 12), ly = O[1] + dy * (rMax + 12);
        g.fillStyle = amber + '0.75)'; g.textAlign = 'center'; g.textBaseline = 'middle';
        const cardinal = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[deg];
        g.fillText(cardinal || (deg + '°'), lx, ly);
        g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      }
    }
    // datum cross + label
    g.strokeStyle = amber + '0.85)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(O[0] - 7, O[1]); g.lineTo(O[0] + 7, O[1]);
    g.moveTo(O[0], O[1] - 7); g.lineTo(O[0], O[1] + 7); g.stroke();
    g.fillStyle = amber + '0.9)'; g.fillText('◎ BULLSEYE', O[0] + 9, O[1] + 12);
    g.restore();
  }

  setBullseye(cfg) {
    this.bull = { ...(this.bull || { rings: 4, spacing_km: 20, bearing_step: 30 }), ...cfg };
    if (this.result) this.seek(this.index);
  }

  _niceStep() {
    // choose a round km grid spacing (~8 lines across the view)
    const targetM = (this.vw / this.scale) / 8;
    const nice = [1000, 2000, 5000, 10000, 20000, 50000, 100000];
    return nice.reduce((a, b) => Math.abs(b - targetM) < Math.abs(a - targetM) ? b : a);
  }

  _poly(N, E, count, color, alpha, width) {
    if (count < 2) return;
    const g = this.ctx; g.save(); g.globalAlpha = alpha;
    g.strokeStyle = color; g.lineWidth = width; g.lineJoin = 'round';
    g.beginPath();
    for (let k = 0; k < count; k++) { const p = this.W2S(N[k], E[k]); k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }
    g.stroke(); g.restore();
  }

  _line(a, b, color, alpha, width, dash) {
    const g = this.ctx; g.save(); g.globalAlpha = alpha;
    g.strokeStyle = color; g.lineWidth = width; if (dash) g.setLineDash(dash);
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); g.restore();
  }

  _craft(N, E, i, color, label, size, glow) {
    const g = this.ctx;
    const p = this.W2S(N[i], E[i]);
    // heading from finite difference
    const j = Math.min(i + 1, N.length - 1), k = Math.max(i - 1, 0);
    const dE = E[j] - E[k], dN = N[j] - N[k];
    const ang = Math.atan2(dE, dN);   // 0 = north
    g.save(); g.translate(p[0], p[1]); g.rotate(ang);
    if (glow) { g.shadowColor = color; g.shadowBlur = 10; }
    g.fillStyle = color; g.strokeStyle = color;
    g.beginPath();  // arrowhead pointing "up" (north before rotation)
    g.moveTo(0, -size); g.lineTo(size * 0.7, size * 0.8); g.lineTo(0, size * 0.35); g.lineTo(-size * 0.7, size * 0.8);
    g.closePath(); g.fill();
    g.restore();
    // label
    g.fillStyle = color; g.font = '10px "JetBrains Mono", monospace';
    g.globalAlpha = 0.9; g.fillText(label, p[0] + size + 3, p[1] - size - 1); g.globalAlpha = 1;
  }

  _tag(x, y, text, color) {
    const g = this.ctx; g.fillStyle = color; g.font = '9px "JetBrains Mono", monospace';
    g.globalAlpha = 0.85; g.fillText(text, x - text.length * 2.6, y); g.globalAlpha = 1;
  }

  _overlay(ch, i, phase, dl) {
    const g = this.ctx;
    // scale bar (bottom-left)
    const targetPx = this.vw * 0.22;
    let km = targetPx / (this.scale * 1000);
    const nice = [1, 2, 5, 10, 20, 50, 100].reduce((a, b) => Math.abs(b - km) < Math.abs(a - km) ? b : a);
    const px = nice * 1000 * this.scale;
    const y = this.mapH - 18, x0 = 20;
    g.strokeStyle = C.ink; g.lineWidth = 1.5; g.globalAlpha = 0.8;
    g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + px, y); g.moveTo(x0, y - 4); g.lineTo(x0, y + 4);
    g.moveTo(x0 + px, y - 4); g.lineTo(x0 + px, y + 4); g.stroke();
    g.fillStyle = C.ink; g.font = '11px "JetBrains Mono", monospace';
    g.fillText(nice + ' km', x0 + px + 8, y + 4); g.globalAlpha = 1;
    // north arrow (top-left)
    g.strokeStyle = C.dim; g.fillStyle = C.dim; g.lineWidth = 1.5;
    const nx = 30, ny = 40;
    g.beginPath(); g.moveTo(nx, ny + 14); g.lineTo(nx, ny - 14); g.stroke();
    g.beginPath(); g.moveTo(nx, ny - 16); g.lineTo(nx - 4, ny - 8); g.lineTo(nx + 4, ny - 8); g.closePath(); g.fill();
    g.font = '11px "JetBrains Mono", monospace'; g.fillText('N', nx - 3, ny - 20);
    // phase badge (top-center)
    const col = (phase === 'MIDCOURSE' || phase === 'INS') ? C.midcourse : phase === 'INERTIAL' ? C.inertial : C.terminal;
    const txt = phase === 'MIDCOURSE' ? '◈ MIDCOURSE — DATALINK'
      : phase === 'INS' ? '◈ MIDCOURSE — INERTIAL NAV (no datalink)'
      : phase === 'INERTIAL' ? '◈ INERTIAL — NO GUIDANCE' : '● TERMINAL — SEEKER ACTIVE';
    g.font = 'bold 12px "JetBrains Mono", monospace';
    const tw = g.measureText(txt).width, bx = this.vw / 2 - tw / 2 - 12;
    const by = this.vh - 44;
    g.fillStyle = 'rgba(8,14,24,0.8)'; g.strokeStyle = col; g.lineWidth = 1;
    this._roundRect(bx, by, tw + 24, 26, 5); g.fill(); g.stroke();
    g.fillStyle = col; g.fillText(txt, this.vw / 2 - tw / 2, by + 17);
  }

  _roundRect(x, y, w, h, r) {
    const g = this.ctx; g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
}
