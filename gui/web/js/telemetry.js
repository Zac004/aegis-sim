// telemetry.js — right-panel readouts, live charts, ADI attitude widget, log.

const COLORS = { blue: '#00E5FF', amber: '#FFB000', red: '#FF3D00', green: '#22ff9c', dim: '#6d84a6' };

export class Telemetry {
  constructor() {
    this.result = null;
    this.readoutRoot = document.getElementById('readout-grid');
    this.chartRoot = document.getElementById('charts');
    this.eventsList = document.getElementById('events-list');
    this.adi = document.getElementById('adi-canvas');
    this.charts = [];
    this._buildStatic();
  }

  _buildStatic() {
    // readout tiles
    const tiles = [
      ['time', 'MISSION TIME', 's', 'blue', 'Elapsed time since missile launch.'],
      ['mach', 'MISSILE MACH', '', 'amber', 'Missile speed as a multiple of the local speed of sound (altitude-dependent).'],
      ['range', 'RANGE TO GO', 'km', 'blue', 'Slant range from missile to target.'],
      ['closing', 'CLOSING VEL', 'm/s', 'amber', 'Rate of closure. Positive = closing; negative = the missile is falling behind.'],
      ['gload', 'MSL G-LOAD', 'g', 'red', 'Lateral acceleration the airframe is ACTUALLY pulling (from real aero + thrust forces at the current AoA) — what an onboard accelerometer would read. The raw guidance command can spike wildly with seeker noise near intercept; the airframe filters it into this.'],
      ['tgtg', 'TARGET G', 'g', 'red', 'G the defending aircraft is pulling. Sustained >5.5 g bleeds its airspeed.'],
      ['alt', 'MSL ALTITUDE', 'm', 'green', 'Missile altitude. Thin air up high = less drag but also less turning force.'],
      ['aspect', 'TGT ASPECT', '°', 'blue', 'Target aspect angle: 180° = head-on (hot), 90° = beam (the notch), 0° = tail chase (cold).'],
      ['phase', 'GUIDANCE', '', 'amber', 'Guidance phase: MIDCOURSE = flying on shooter datalink; TERMINAL = own seeker active (pitbull); INERTIAL = coasting, no updates.'],
      ['srange', 'SHOOTER RNG', 'km', 'blue', 'Range from the launching aircraft to the target. At seeker-active it becomes the A-pole; at intercept, the F-pole.'],
    ];
    this.readoutRoot.innerHTML = '';
    this.tiles = {};
    tiles.forEach(([k, label, unit, cls, tip]) => {
      const v = document.createElement('div'); v.className = 'r-value'; v.textContent = '—';
      const tile = document.createElement('div'); tile.className = `readout ${cls}`;
      tile.setAttribute('data-tip', tip);
      const l = document.createElement('div'); l.className = 'r-label'; l.textContent = label;
      const u = document.createElement('span'); u.className = 'r-unit'; u.textContent = unit;
      v.appendChild(u); tile.appendChild(l); tile.appendChild(v);
      this.readoutRoot.appendChild(tile);
      this.tiles[k] = { v, unit };
    });

    // charts
    const specs = [
      { key: 'gload', title: 'G-LOAD (ACHIEVED)', color: COLORS.red, unit: 'g',
        tip: 'The lateral G the airframe actually pulls — real aero + thrust force at the flown AoA, so it is smooth like a real accelerometer trace. (Raw guidance commands naturally oscillate near intercept as seeker noise multiplies through the shrinking time-to-go; the airframe lag filters that out.)' },
      { key: 'mmach', title: 'MACH', color: COLORS.amber, unit: 'M',
        tip: 'Missile Mach: boost, sustain, then coasting drag decay. Energy at the merge decides who wins the endgame.' },
      { key: 'range', title: 'RANGE', color: COLORS.blue, unit: 'km', scale: 0.001,
        tip: 'Missile→target slant range. The slope is the closing velocity.' },
      { key: 'closing', title: 'CLOSING VELOCITY', color: COLORS.green, unit: 'm/s',
        tip: 'Closure rate. A notching target drives this toward zero — right into a pulse-Doppler radar\'s blind zone.' },
      { key: 'boresight_deg', title: 'SEEKER BORESIGHT ERROR', color: COLORS.blue, unit: '°',
        tip: 'Angle between the missile nose and the line-of-sight. Past the gimbal limit the seeker physically cannot look at the target — track lost.' },
      { key: 'malt', title: 'ALTITUDE', color: COLORS.green, unit: 'm',
        tip: 'Missile altitude profile — watch lofted trajectories trade altitude for terminal energy.' },
    ];
    this.chartRoot.innerHTML = '';
    this.charts = specs.map(s => {
      const box = document.createElement('div'); box.className = 'chart-box';
      if (s.tip) box.setAttribute('data-tip', s.tip);
      const t = document.createElement('div'); t.className = 'chart-title';
      const name = document.createElement('span'); name.textContent = s.title;
      const val = document.createElement('b'); val.textContent = '—'; val.style.color = s.color;
      t.appendChild(name); t.appendChild(val);
      const cv = document.createElement('canvas'); cv.width = 300; cv.height = 74;
      box.appendChild(t); box.appendChild(cv);
      this.chartRoot.appendChild(box);
      return { ...s, canvas: cv, valEl: val };
    });
  }

  setResult(result) {
    this.result = result;
    const ch = result.channels;
    // precompute series (with scale) and ranges
    this.charts.forEach(c => {
      const raw = ch[c.key] || [];
      c.data = raw.map(x => x * (c.scale || 1));
      const lo = Math.min(...c.data, 0), hi = Math.max(...c.data, 1);
      c.lo = lo; c.hi = hi;
    });
    // run analysis (full KPI breakdown)
    this._fillAnalysis(result);
    // events log
    this.eventsList.innerHTML = '';
    (result.events || []).forEach(ev => {
      const li = document.createElement('li'); li.className = ev.type;
      li.innerHTML = `<span class="t">T+${ev.t.toFixed(1)}s</span>${ev.label}`;
      this.eventsList.appendChild(li);
    });
    this.update(0);
  }

  _fillAnalysis(result) {
    const body = document.getElementById('analysis-body');
    if (!body) return;
    const s = result.summary || {};
    const km = (v) => (v == null ? '—' : (v / 1000).toFixed(1) + ' km');
    const rows = [
      ['Outcome', result.outcome], ['Miss distance', (result.miss_distance ?? 0).toFixed(1) + ' m'],
      ['Time of flight', (result.time_of_flight ?? 0).toFixed(1) + ' s'],
      ['Missile', s.missile], ['Target', s.target],
      ['Guidance / Seeker', `${(s.guidance || '?').toUpperCase()} / ${(s.seeker || '?')}`],
      ['Peak Mach', s.max_mach], ['Peak speed', (s.max_speed ?? 0) + ' m/s'],
      ['Peak G pulled', (s.max_g ?? 0) + ' g'], ['Peak altitude', (s.peak_alt ?? 0) + ' m'],
      ['Max range', km(s.max_range * 1000 ? s.max_range : null) === '—' ? (s.max_range ?? '—') + ' m' : (s.max_range / 1000).toFixed(1) + ' km'],
      ['Pitbull (seeker active)', km(s.pitbull_range)], ['Datalink support', s.datalink_support_time != null ? s.datalink_support_time + ' s' : '—'],
      ['A-pole (shooter@active)', km(s.a_pole)], ['F-pole (shooter@merge)', km(s.f_pole)],
      ['Went active', s.went_active == null ? '—' : (s.went_active ? 'yes' : 'no — never acquired')],
    ];
    body.innerHTML = rows.filter(r => r[1] != null && r[1] !== undefined)
      .map(r => `<div class="an-row"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('');
  }

  update(i) {
    if (!this.result) return;
    const ch = this.result.channels;
    const n = ch.t.length; if (!n) return;
    i = Math.max(0, Math.min(n - 1, i));
    const g = (k) => (ch[k] ? ch[k][i] : 0);
    this.tiles.time.v.firstChild.textContent = g('t').toFixed(2);
    this.tiles.mach.v.firstChild.textContent = g('mmach').toFixed(2);
    this.tiles.range.v.firstChild.textContent = (g('range') / 1000).toFixed(2);
    this.tiles.closing.v.firstChild.textContent = Math.round(g('closing'));
    this.tiles.gload.v.firstChild.textContent = g('gload').toFixed(1);
    this.tiles.tgtg.v.firstChild.textContent = g('tgload').toFixed(1);
    this.tiles.alt.v.firstChild.textContent = Math.round(g('malt'));
    this.tiles.aspect.v.firstChild.textContent = Math.round(g('aspect_deg'));
    const phase = ch.phase ? ch.phase[i] : 'TERMINAL';
    this.tiles.phase.v.firstChild.textContent = phase === 'MIDCOURSE' ? 'M-CRS' : phase === 'INS' ? 'INS' : phase === 'INERTIAL' ? 'BALLISTIC' : 'TERM';
    this.tiles.phase.v.parentElement.className = 'readout ' +
      (phase === 'TERMINAL' ? 'red' : phase === 'INERTIAL' ? 'amber' : 'blue');
    this.tiles.srange.v.firstChild.textContent = ch.shooter_range ? (g('shooter_range') / 1000).toFixed(1) : '—';
    // restore units (firstChild is text node; unit span is appended after)
    for (const k in this.tiles) {
      const t = this.tiles[k];
      if (t.v.querySelector('.r-unit')) continue;
    }
    this.charts.forEach(c => {
      this._drawChart(c, i);
      c.valEl.textContent = (c.data[i] ?? 0).toFixed(c.unit === 'm' || c.unit === 'm/s' ? 0 : 2);
    });
    this._drawADI(g('roll_deg'), g('pitch_deg'), g('yaw_deg'));
  }

  _drawChart(c, playIdx) {
    const cv = c.canvas, ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height, pad = 4;
    ctx.clearRect(0, 0, W, H);
    const data = c.data; if (!data.length) return;
    const n = data.length;
    const span = (c.hi - c.lo) || 1;
    const X = (idx) => pad + (idx / (n - 1)) * (W - 2 * pad);
    const Y = (v) => H - pad - ((v - c.lo) / span) * (H - 2 * pad);
    // zero baseline
    if (c.lo < 0 && c.hi > 0) {
      ctx.strokeStyle = 'rgba(109,132,166,.25)'; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(pad, Y(0)); ctx.lineTo(W - pad, Y(0)); ctx.stroke(); ctx.setLineDash([]);
    }
    // area fill under the played portion
    ctx.beginPath(); ctx.moveTo(X(0), Y(data[0]));
    for (let k = 1; k < n; k++) ctx.lineTo(X(k), Y(data[k]));
    // line
    ctx.strokeStyle = c.color; ctx.lineWidth = 1.5;
    ctx.shadowColor = c.color; ctx.shadowBlur = 6; ctx.stroke(); ctx.shadowBlur = 0;
    // played fill
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, c.color + '44'); grad.addColorStop(1, c.color + '00');
    ctx.lineTo(X(playIdx), H - pad); ctx.lineTo(X(0), H - pad); ctx.closePath();
    ctx.fillStyle = grad;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, X(playIdx), H); ctx.clip(); ctx.fill(); ctx.restore();
    // playhead
    ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = .5;
    ctx.beginPath(); ctx.moveTo(X(playIdx), 0); ctx.lineTo(X(playIdx), H); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.fillStyle = c.color; ctx.beginPath(); ctx.arc(X(playIdx), Y(data[playIdx]), 2.5, 0, 7); ctx.fill();
  }

  _drawADI(roll = 0, pitch = 0, yaw = 0) {
    const cv = this.adi;
    if (!cv) return;                 // ADI removed from the layout
    const ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height, cx = W / 2, cy = 74, R = 62;
    const PPD = 2.0;                 // pixels per degree of pitch
    const rr = roll * Math.PI / 180;
    ctx.clearRect(0, 0, W, H);

    // ── rotating horizon ball (clipped to the instrument circle) ──
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.clip();
    ctx.translate(cx, cy); ctx.rotate(rr);           // bank
    ctx.translate(0, pitch * PPD);                   // pitch slides the ball
    // sky (top) and ground (bottom) — large enough to always fill after transforms
    const S = R * 4;
    ctx.fillStyle = '#0e3a63'; ctx.fillRect(-S, -S, 2 * S, S);       // sky above horizon (y<0)
    ctx.fillStyle = '#5a3a15'; ctx.fillRect(-S, 0, 2 * S, S);        // ground below (y>0)
    // horizon line
    ctx.strokeStyle = '#eaf6ff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-S, 0); ctx.lineTo(S, 0); ctx.stroke();
    // pitch ladder every 10°, with tick labels
    ctx.lineWidth = 1; ctx.font = '7px "JetBrains Mono"'; ctx.textAlign = 'center';
    for (let d = -60; d <= 60; d += 10) {
      if (d === 0) continue;
      const yy = -d * PPD, halfw = d % 20 === 0 ? 16 : 9;
      ctx.strokeStyle = d > 0 ? 'rgba(234,246,255,.7)' : 'rgba(255,210,170,.7)';
      ctx.beginPath(); ctx.moveTo(-halfw, yy); ctx.lineTo(halfw, yy); ctx.stroke();
      if (d % 20 === 0) {
        ctx.fillStyle = 'rgba(234,246,255,.75)';
        ctx.fillText(Math.abs(d), halfw + 8, yy + 2.5);
      }
    }
    ctx.restore();

    // ── fixed aircraft symbol (miniature waterline) ──
    ctx.strokeStyle = '#FFB000'; ctx.lineWidth = 2.6; ctx.shadowColor = '#FFB000'; ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(cx - 24, cy); ctx.lineTo(cx - 9, cy); ctx.lineTo(cx - 4, cy + 5);
    ctx.moveTo(cx + 24, cy); ctx.lineTo(cx + 9, cy); ctx.lineTo(cx + 4, cy + 5);
    ctx.stroke();
    ctx.fillStyle = '#FFB000'; ctx.beginPath(); ctx.arc(cx, cy, 2, 0, 7); ctx.fill();
    ctx.shadowBlur = 0;

    // ── roll pointer + bank arc marks at top ──
    ctx.save(); ctx.translate(cx, cy);
    ctx.strokeStyle = 'rgba(207,227,255,.55)'; ctx.lineWidth = 1;
    for (const a of [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60]) {
      const ar = (a - 90) * Math.PI / 180, len = a % 30 === 0 ? 7 : 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ar) * R, Math.sin(ar) * R);
      ctx.lineTo(Math.cos(ar) * (R - len), Math.sin(ar) * (R - len));
      ctx.stroke();
    }
    // current-bank triangle pointer
    ctx.rotate(rr); ctx.fillStyle = '#00E5FF';
    ctx.beginPath(); ctx.moveTo(0, -R + 1); ctx.lineTo(-4, -R + 8); ctx.lineTo(4, -R + 8); ctx.closePath(); ctx.fill();
    ctx.restore();

    // ── bezel + numeric readouts ──
    ctx.strokeStyle = '#26375a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
    ctx.textAlign = 'left'; ctx.font = '8px "JetBrains Mono"'; ctx.fillStyle = '#6d84a6';
    ctx.fillText('ADI', 8, 13);
    const hdg = ((yaw % 360) + 360) % 360;
    ctx.textAlign = 'center'; ctx.font = '9px "JetBrains Mono"'; ctx.fillStyle = '#00E5FF';
    ctx.fillText(`P ${pitch.toFixed(0)}°  R ${roll.toFixed(0)}°`, cx, H - 14);
    ctx.fillStyle = '#FFB000';
    ctx.fillText(`HDG ${hdg.toFixed(0).padStart(3, '0')}°`, cx, H - 4);
  }
}
