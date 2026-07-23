// config.js — left-panel MISSION PLANNER.
// Doctrine-ordered flow so the workflow reads top-to-bottom like planning a real
// intercept:
//    1 · MISSION      pick/name/save the scenario
//    2 · THE MERGE    the geometry: range, aspect, off-boresight, altitudes, speeds
//    3 · BLUE FORCES  the launch aircraft (shooter + datalink) and its weapon (missile)
//    4 · RED FORCES   the target aircraft and how it defends (maneuvers + countermeasures)
//    5 · CONDITIONS   atmosphere + simulation settings
// Blue/red sections are colour-coded. Every dropdown is populated from
// /api/catalog (plugins included). NEW / EDIT buttons open the Forge, which
// saves brand-new missile & platform templates straight into the library.

const $ = (s, r = document) => r.querySelector(s);
function el(tag, attrs = {}, kids = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) e.setAttribute(k, v);
  }
  (Array.isArray(kids) ? kids : [kids]).forEach(c =>
    e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  return e;
}
const clone = (o) => JSON.parse(JSON.stringify(o));

const MTIPS = {
  straight: 'Constant heading and altitude — the baseline (and the easiest target).',
  break_turn: 'Maximum-G level turn away from the threat — forces the missile to pull lead and bleed energy.',
  weave: 'Rhythmic S-turns that keep the line-of-sight rate oscillating, defeating clean prediction.',
  barrel_roll: 'Rolling displacement — the lift vector corkscrews, mixing vertical and horizontal miss.',
  split_s: 'Roll inverted and pull down into a dive — trades altitude for speed and reverses course.',
  immelmann: 'Climbing half-loop reversal — costs speed, gains altitude and a new heading.',
  notch: 'Turn to put the threat on the beam (~90° aspect) so closing velocity ≈ 0 — hides you in the pulse-Doppler notch. Pair with chaff.',
  jink: 'Random hard reversals in the final seconds — an unpredictable last-ditch defence.',
  split_s_extend: 'Dive-reversal, then unload and run to open range (plugin example).',
  break_to_heading: 'Hard break at the set G, then roll out and steady on a chosen heading — models turning to a specific escape course. Set the Rollout heading below.',
  extend: 'Wings-level, ~1 G — accelerate away to build energy and open range. The classic post-break extend to reset the fight.',
  climb: 'Pull up and climb — trade airspeed for altitude, forcing a look-up shot that bleeds the missile.',
  dive: 'Descend hard toward the deck — drag the missile into dense low air where its drag spikes and it bleeds energy fastest. Pairs with the notch.',
  go_cold: 'Turn until the threat is directly behind you (0° aspect — cold), then run. The classic ABORT/drag: denies closure so the missile must chase you on its own energy. Set the turn G, or a fixed turn rate in °/s.',
};

export class Config {
  constructor(root) {
    this.root = root;
    this.catalog = null;
    this.missiles = []; this.platforms = []; this.scenarios = [];
    this.working = null;
    this.onReady = null;    // (scenario) after a preset loads / big change
    this.onSave = null;     // (workingScenario) — Save Scenario button
    this.onForge = null;    // (kind, currentDef, slot) — open the Forge
  }

  init(catalog, { missiles, platforms, scenarios }) {
    this.catalog = catalog;
    this.missiles = missiles; this.platforms = platforms; this.scenarios = scenarios;
    this.loadPreset(scenarios[0].data);
  }

  // ── option builders ─────────────────────────────────────────────────────────
  opts(list, selected) {
    return list.map(o => {
      const attrs = { value: o.key ?? o.id };
      if (String(o.key ?? o.id) === String(selected)) attrs.selected = '';
      const tip = o.tip || (o.meta && o.meta.description);
      if (tip) attrs.title = tip;
      return el('option', attrs, o.label ?? o.name);
    });
  }
  catOpts(cat, selected) {
    return this.opts((this.catalog[cat] || []).map(o => ({
      ...o, tip: MTIPS[o.key] || (o.meta && o.meta.description),
    })), selected);
  }

  // ── preset → editable working scenario ──────────────────────────────────────
  loadPreset(scn) {
    const w = clone(scn);
    w.engagement_type = w.engagement_type || 'air_to_air';
    const mid = w.missile && w.missile.template;
    const mt = this.missiles.find(m => m.id === mid)?.data;
    w.missile = w.missile || {};
    if (mt) { w.missile.definition = clone(mt); delete w.missile.template; }
    if (!w.missile.definition) w.missile.definition = clone(this.missiles[0].data);
    const pid = w.target && w.target.platform;
    const pt = this.platforms.find(p => p.id === pid)?.data;
    w.target = w.target || {};
    if (pt) { w.target.definition = clone(pt); delete w.target.platform; }
    if (!w.target.definition) w.target.definition = clone(this.platforms[0].data);
    w.target.timeline = w.target.timeline || [];
    w.shooter = w.shooter || {};
    if (!w.shooter.platform) {   // default the shooter to a fighter unlike the target
      const tid = w.target.definition.id;
      w.shooter.platform = (this.platforms.find(p => p.id !== tid && p.type === 'fighter')?.id)
        || this.platforms.find(p => p.id !== tid)?.id || tid;
    }
    w.sim = w.sim || { dt: 0.004, max_time: 60, output_rate_hz: 60, hit_radius_m: 15 };
    // always plan by geometry (one source of truth). Derive it from the preset's
    // coordinates if the preset didn't already specify it — per engagement type.
    if (!w.geometry) w.geometry = w.engagement_type === 'surface_to_air'
      ? this._geoDefaultsSam(w) : this._geoDefaults(w);
    this.working = w;
    this.render();
    if (this.onReady) this.onReady(w);
  }

  buildScenario() {
    const s = clone(this.working);
    // auto-extend the sim window so long-range shots aren't cut off mid-flight
    const rng = s.geometry && s.geometry.range_km;
    if (rng) {
      s.sim = s.sim || {};
      const need = Math.ceil(25 + rng * 3.2);   // generous flight-time budget
      s.sim.max_time = Math.max(s.sim.max_time || 0, need);
    }
    return s;
  }

  _geoDefaultsSam(w) {
    const ml = (w.missile && w.missile.launch) || {}, ti = (w.target && w.target.initial) || {};
    const tp = ti.position || [0, 30000, 150];
    const bearing = Math.round((Math.atan2(tp[1], tp[0]) * 180 / Math.PI + 360) % 360) || 90;
    return {
      range_km: +((Math.hypot(tp[0], tp[1]) / 1000).toFixed(1)) || 30,
      bearing_deg: bearing, altitude_m: Math.round(tp[2]) || 150,
      threat_speed: (ti.velocity && ti.velocity.speed) ?? 250,
      threat_heading_deg: (ti.velocity && ti.velocity.heading_deg) ?? ((bearing + 180) % 360),
      launch_elevation_deg: (ml.velocity && ml.velocity.climb_deg) ?? 25,
      launch_speed: (ml.velocity && ml.velocity.speed) ?? 40,
      site_altitude_m: (ml.position && ml.position[2]) ?? 20,
    };
  }

  _geoDefaults(w) {
    const ml = (w.missile && w.missile.launch) || {}, ti = (w.target && w.target.initial) || {};
    const lp = ml.position || [0, 0, 9000], tp = ti.position || [0, 25000, 9000];
    const dN = tp[0] - lp[0], dE = tp[1] - lp[1];
    const brg = Math.atan2(dE, dN) * 180 / Math.PI;
    const sh = (ml.velocity && ml.velocity.heading_deg) ?? 90;
    const obl = Math.round(((brg - sh + 540) % 360) - 180);
    const th = (ti.velocity && ti.velocity.heading_deg) ?? 270;
    const b2 = (brg + 180) % 360;
    const dA = Math.abs(((th - b2 + 540) % 360) - 180);
    return {
      range_km: +((Math.hypot(dN, dE) / 1000).toFixed(1)) || 25,
      aspect_deg: Math.round(180 - dA), offboresight_deg: obl,
      altitude_m: Math.round(lp[2]) || 9000, target_altitude_m: Math.round(tp[2]) || 9000,
      shooter_speed: (ml.velocity && ml.velocity.speed) ?? 300,
      target_speed: (ti.velocity && ti.velocity.speed) ?? 260,
      shooter_heading_deg: sh,
    };
  }

  // ── section / field primitives ──────────────────────────────────────────────
  section(icon, title, body, opts = {}) {
    const cls = 'section' + (opts.tone ? ' tone-' + opts.tone : '') + (opts.collapsed ? ' collapsed' : '');
    return el('div', { class: cls }, [
      el('div', { class: 'sec-head', onclick: (e) => e.currentTarget.parentNode.classList.toggle('collapsed') }, [
        el('span', {}, [el('span', { class: 'sec-step' }, opts.step || ''), el('span', { class: 'sec-icon' }, icon), title]),
        el('span', { class: 'chev' }, '▾'),
      ]),
      el('div', { class: 'sec-body' }, body),
    ]);
  }
  subhead(t) { return el('div', { class: 'panel-subhead' }, t); }
  field(label, control, tip) {
    const a = { class: 'field' }; if (tip) a['data-tip'] = tip;
    return el('div', a, [el('label', {}, label), control]);
  }
  row(fields, cols = 2) { return el('div', { class: 'row' + cols }, fields); }
  mnum(label, value, cb, step = '1', tip) {
    return this.field(label, el('input', { type: 'number', step, value,
      oninput: (e) => cb(+e.target.value) }), tip);
  }
  txt(label, value, cb, tip) {
    return this.field(label, el('input', { type: 'text', value: value ?? '',
      oninput: (e) => cb(e.target.value) }), tip);
  }
  sel(label, options, selected, cb, tip) {
    return this.field(label, el('select', { onchange: (e) => cb(e.target.value) }, options), tip);
  }
  slider(label, min, max, step, value, cb, tip) {
    const val = el('span', { class: 'val' }, (+value).toFixed(step < 1 ? 1 : 0));
    const input = el('input', { type: 'range', min, max, step, value,
      oninput: (e) => { const v = +e.target.value; val.textContent = v.toFixed(step < 1 ? 1 : 0); cb(v); } });
    const a = { class: 'field' }; if (tip) a['data-tip'] = tip;
    return el('div', a, [el('label', {}, [label, val]), input]);
  }
  forgeRow(kind, currentDef, slot, label) {
    return el('div', { class: 'forge-row' }, [
      el('button', { class: 'mini-btn', 'data-tip': `Build a brand-new ${label} from scratch — every parameter editable — and save it to the library.`,
        onclick: () => this.onForge && this.onForge(kind, null, slot) }, '＋ NEW'),
      el('button', { class: 'mini-btn', 'data-tip': `Open the current ${label} in the Forge to tweak and save as a new variant.`,
        onclick: () => this.onForge && this.onForge(kind, currentDef, slot) }, '✎ EDIT / SAVE AS NEW'),
    ]);
  }

  // ── render the whole planner ─────────────────────────────────────────────────
  render() {
    const w = this.working;
    const md = w.missile.definition, pd = w.target.definition;
    const g = md.guidance || (md.guidance = { law: 'apn', N: 4 });
    const sk = md.seeker || (md.seeker = { type: 'rf_active', params: {} });
    const ap = md.autopilot || (md.autopilot = { type: 'three_loop', params: {} });
    const sig = pd.signatures || (pd.signatures = {});
    const perf = pd.performance || (pd.performance = {});
    const shd = w.shooter;
    const isSAM = w.engagement_type === 'surface_to_air';
    this.root.innerHTML = '';

    // ─── 1 · MISSION ─────────────────────────────────────────────
    this.root.appendChild(this.section('◎', 'MISSION', [
      this.field('Load preset', el('select', {
        id: 'preset-select',
        onchange: (e) => { const s = this.scenarios.find(x => x.id === e.target.value); if (s) this.loadPreset(s.data); }
      }, this.opts(this.scenarios.map(s => ({ key: s.id, label: s.name })), null)),
        'Start from a saved engagement. Everything below becomes an editable copy.'),
      this.txt('Engagement name', w.name, (v) => w.name = v, 'Name used when you save this as a new scenario preset.'),
      this.field('Engagement type', el('select', {
        onchange: (e) => {
          w.engagement_type = e.target.value;
          // reset geometry to the matching field set for the chosen type
          w.geometry = e.target.value === 'surface_to_air' ? this._geoDefaultsSam(w) : this._geoDefaults(w);
          this.render(); if (this.onReady) this.onReady(w);
        }
      }, this.opts([{ key: 'air_to_air', label: 'Air-to-Air (1v1)' }, { key: 'surface_to_air', label: 'Surface-to-Air (SAM)' }], w.engagement_type)),
        'Air-to-Air plans by the merge geometry; Surface-to-Air plans by threat range/bearing from a ground launcher.'),
      el('button', { class: 'save-scn', 'data-tip': 'Save this whole configuration as a new reusable scenario preset.',
        onclick: () => this.onSave && this.onSave(this.working) }, '◈ SAVE SCENARIO'),
    ], { step: '1' }));

    // ─── 2 · THE MERGE (geometry) ────────────────────────────────
    if (!isSAM) {
      const geo = w.geometry || (w.geometry = this._geoDefaults(w));
      const gset = (k, v) => { geo[k] = v; };
      this.root.appendChild(this.section('⌖', 'THE MERGE — GEOMETRY', [
        el('div', { class: 'hint', style: 'margin-bottom:8px' }, 'Set the picture at trigger-pull. Sweep RANGE to walk an engagement from BVR down to WVR.'),
        this.row([
          this.mnum('Range (km)', geo.range_km, v => gset('range_km', v), '1', 'Shooter→target range at launch. Sweep it to walk from a long BVR poke (60+ km) down to a WVR knife-fight (<10 km). Compare against the missile\'s Rmax/MAR in the Tactical-AI brief.'),
          this.mnum('Aspect °', geo.aspect_deg, v => gset('aspect_deg', v), '5', 'Target aspect: 180 = head-on / HOT (max closure, longest reach), 90 = BEAM (the Doppler notch, ~zero closure), 0 = tail-chase / COLD (energy-limited to the missile\'s own reach).'),
          this.mnum('Off-bore °', geo.offboresight_deg, v => gset('offboresight_deg', v), '5', 'Angle of the target off the shooter\'s nose. High-off-boresight (HOBS) shots — e.g. 40–90° with a helmet sight — are possible on modern weapons but the missile must turn onto the target, costing energy.'),
        ], 3),
        this.row([
          this.mnum('Shooter alt (m)', geo.altitude_m, v => gset('altitude_m', v), '100', 'Launch altitude. Thin high air = far less drag → much longer missile reach (a shot from 12 km can out-range the same shot from 3 km by 2–3×). Fighters cruise ~9–12 km.'),
          this.mnum('Target alt (m)', geo.target_altitude_m, v => gset('target_altitude_m', v), '100', 'Target altitude. A LOOK-UP shot (target above you) bleeds missile energy; a LOOK-DOWN shot gains it (and separates the target from ground clutter, defeating the notch).'),
        ]),
        this.row([
          this.mnum('Shtr spd', geo.shooter_speed, v => gset('shooter_speed', v), '10', 'Shooter airspeed (m/s). Launch speed is FREE missile energy added to the shot — a fast, high launch adds kilometres of reach. Fighter cruise ~250–300 m/s; a supersonic launch ~400+.'),
          this.mnum('Tgt spd', geo.target_speed, v => gset('target_speed', v), '10', 'Target airspeed (m/s). A fast, hot target closes the range for your missile (bigger NEZ); a slow or cold one is energy-limited. ~250–300 m/s typical fighter cruise.'),
          this.mnum('Shtr hdg°', geo.shooter_heading_deg, v => gset('shooter_heading_deg', v), '5', 'Shooter heading (°true, 0 = North, 90 = East). Combined with aspect/off-boresight it sets the whole merge picture.'),
        ], 3),
      ], { step: '2' }));
    } else {
      // Surface-to-Air geometry planner: threat by range/bearing/altitude
      const geo = w.geometry || (w.geometry = this._geoDefaultsSam(w));
      const gset = (k, v) => { geo[k] = v; };
      this.root.appendChild(this.section('⌖', 'THREAT GEOMETRY — SAM', [
        el('div', { class: 'hint', style: 'margin-bottom:8px' }, 'Site the launcher and place the inbound threat. Bearing is measured from the launcher (0 = North, 90 = East).'),
        this.row([
          this.mnum('Threat range (km)', geo.range_km, v => gset('range_km', v), '1', 'Horizontal range from the launcher to the threat at engagement start.'),
          this.mnum('Bearing °', geo.bearing_deg, v => gset('bearing_deg', v), '5', 'Direction from the launcher to the threat (0 = N, 90 = E).'),
        ]),
        this.row([
          this.mnum('Threat alt (m)', geo.altitude_m, v => gset('altitude_m', v), '100', 'Threat altitude — sea-skimmer (low) to high-altitude penetrator.'),
          this.mnum('Threat spd', geo.threat_speed, v => gset('threat_speed', v), '10', 'Threat airspeed, m/s.'),
          this.mnum('Threat hdg°', geo.threat_heading_deg, v => gset('threat_heading_deg', v), '5', 'Where the threat is flying. Default is straight inbound at the site.'),
        ], 3),
        this.subhead('LAUNCHER'),
        this.row([
          this.mnum('Launch elev °', geo.launch_elevation_deg, v => gset('launch_elevation_deg', v), '5', 'SAM initial climb angle off the rail.'),
          this.mnum('Boost spd', geo.launch_speed, v => gset('launch_speed', v), '5', 'Missile speed just off the rail, m/s.'),
          this.mnum('Site alt (m)', geo.site_altitude_m, v => gset('site_altitude_m', v), '10', 'Launcher altitude above sea level.'),
        ], 3),
      ], { step: '2' }));
    }

    // ─── 3 · BLUE FORCES — shooter + weapon ──────────────────────
    const blueBody = [];
    if (!isSAM) {
      blueBody.push(this.subhead('LAUNCH AIRCRAFT (SHOOTER)'));
      blueBody.push(this.field('Aircraft', el('select', {
        onchange: (e) => shd.platform = e.target.value
      }, this.opts(this.platforms, shd.platform || pd.id)),
        'Which fighter fires the missile (its model + type; radar/datalink set below).'));
      blueBody.push(this.forgeRow('platforms', this.platforms.find(p => p.id === shd.platform)?.data || null, 'shooter', 'launch aircraft'));
      blueBody.push(this.field('Support after launch', el('select', {
        onchange: (e) => shd.support = e.target.value
      }, this.opts([
        { key: 'straight', label: 'Straight — press in', tip: 'Keep pointing at the target: shortest support, most exposure.' },
        { key: 'crank', label: 'Crank — gimbal edge', tip: 'Turn to the radar gimbal limit: open range while still supporting.' },
        { key: 'notch', label: 'Turn cold — drop link', tip: 'Turn away now: datalink drops, missile goes inertial. The mistake case.' },
      ], shd.support || 'straight')), 'How the shooter flies after firing. Datalink survives only while its radar holds the target.'));
      blueBody.push(this.row([
        this.mnum('Crank °', shd.crank_angle_deg ?? 45, v => shd.crank_angle_deg = v, '5', 'Crank angle off the target line.'),
        this.mnum('Gimbal °', shd.radar_gimbal_deg ?? 60, v => shd.radar_gimbal_deg = v, '5', 'Radar gimbal limit — past it the datalink drops.'),
      ]));
      blueBody.push(this.row([
        this.mnum('Radar (km)', (shd.radar_range_m ?? 140000) / 1000, v => shd.radar_range_m = v * 1000, '10', 'Max range the shooter\'s radar holds the target track (scales with target RCS in reality). Modern AESA fighter radar vs a fighter-size target ~120–180 km. If the target flies outside this, the datalink drops and the missile goes inertial.'),
        this.mnum('Datalink (km)', (shd.datalink_range_m ?? 180000) / 1000, v => shd.datalink_range_m = v * 1000, '10', 'Max shooter→missile datalink reach for midcourse updates. Beyond it the missile flies on its own INS until its seeker goes active. Usually ≥ the radar range so the track, not the link, is the limit.'),
      ]));
    }
    blueBody.push(this.subhead(isSAM ? 'INTERCEPTOR MISSILE' : 'WEAPON (MISSILE)'));
    blueBody.push(this.field('Airframe', el('select', {
      onchange: (e) => { const m = this.missiles.find(x => x.id === e.target.value); if (m) { w.missile.definition = clone(m.data); this.render(); if (this.onReady) this.onReady(w); } }
    }, this.opts(this.missiles, md.id)), 'The missile: mass, motor, aero, seeker, structural limits.'));
    blueBody.push(this.forgeRow('missiles', md, 'missile', 'missile'));
    blueBody.push(this.field('Guidance law', el('select', { onchange: (e) => g.law = e.target.value },
      this.catOpts('guidance', g.law)), 'APN feeds target-maneuver forward; OGL is the energy-optimal endgame law.'));
    blueBody.push(this.slider('Nav constant N', 2, 6, 0.1, g.N ?? 4, v => g.N = v, 'Guidance gain, 3–5 typical. Higher corrects harder but amplifies noise.'));
    blueBody.push(this.field('Seeker', el('select', { onchange: (e) => { sk.type = e.target.value; sk.params = sk.params || {}; } },
      this.catOpts('seeker', sk.type)), 'Radar sees through weather but is chaff/ECM-vulnerable; IR is passive; imaging-IR resists flares.'));
    blueBody.push(this.field('Autopilot', el('select', { onchange: (e) => ap.type = e.target.value },
      this.catOpts('autopilot', ap.type)), '3-Loop models real fin dynamics; Ideal is lag-free for analysis.'));
    blueBody.push(this.slider('Max structural G', 15, 60, 1, (md.physical && md.physical.max_g) || 40,
      v => { md.physical = md.physical || {}; md.physical.max_g = v; ap.params = ap.params || {}; ap.params.max_g = v; },
      'Airframe load limit — commands are clamped to this and to what dynamic pressure allows.'));
    this.root.appendChild(this.section('▲', isSAM ? 'INTERCEPTOR' : 'BLUE FORCES — SHOOTER & WEAPON', blueBody, { step: '3', tone: 'blue' }));

    // ─── 4 · RED FORCES — target + defence ───────────────────────
    this.root.appendChild(this.section('◆', 'RED FORCES — TARGET & DEFENCE', [
      this.field('Aircraft', el('select', {
        onchange: (e) => { const p = this.platforms.find(x => x.id === e.target.value); if (p) { w.target.definition = clone(p.data); this.render(); if (this.onReady) this.onReady(w); } }
      }, this.opts(this.platforms, pd.id)), 'The defending aircraft: signatures, performance, countermeasure fit.'),
      this.forgeRow('platforms', pd, 'target', 'target aircraft'),
      this.row([
        this.mnum('RCS (m²)', sig.rcs_m2 ?? 5, v => sig.rcs_m2 = v, '0.1', 'Radar cross-section — bigger = seen & tracked from farther.'),
        this.mnum('IR sig', sig.ir_signature ?? 1, v => sig.ir_signature = v, '0.1', 'IR signature vs a reference fighter — drives IR seeker range.'),
      ]),
      this.slider('Pilot / structural G', 3, 12, 0.5, perf.max_g ?? 9, v => perf.max_g = v, 'Hardest turn the target pulls. Sustained >5.5 g bleeds its airspeed.'),
      this.subhead('DEFENSIVE REACTIONS'),
      el('div', { class: 'hint', style: 'margin-bottom:6px' }, 'What the target does to survive, in sequence. Triggers fire on time, range-to-threat, or time-to-impact (TTI).'),
      this.timelineUI(w.target.timeline),
    ], { step: '4', tone: 'red' }));

    // ─── 5 · CONDITIONS ──────────────────────────────────────────
    this.root.appendChild(this.section('❋', 'CONDITIONS — ENVIRONMENT & SIM', [
      this.field('Atmosphere', el('select', { onchange: (e) => w.atmosphere = e.target.value },
        this.catOpts('atmosphere', w.atmosphere || 'ussa1976')), 'Density/pressure/temp vs altitude — drives drag and Mach everywhere.'),
      this.row([
        this.mnum('Δt (s)', w.sim.dt, v => w.sim.dt = v, '0.001', 'Physics step. 0.003–0.005 s balances accuracy and speed.'),
        this.mnum('Max time (s)', w.sim.max_time, v => w.sim.max_time = v, '1', 'Cutoff — the run also ends early on intercept, fly-through or energy death.'),
      ]),
      this.slider('Lethal radius (m)', 3, 40, 1, w.sim.hit_radius_m ?? 15, v => w.sim.hit_radius_m = v, 'Warhead + proximity-fuze kill radius. Closest approach inside this = HIT.'),
    ], { step: '5' }));

    // Pandora hint
    this.root.appendChild(el('div', { class: 'pandora' }, [
      el('div', { html: '<b>◈ PANDORA BOX</b>' }),
      el('div', { class: 'hint', style: 'margin-top:5px' },
        'Every dropdown is fed by the plugin registry. Drop a .py in /plugins to add a new guidance law, seeker or maneuver — it appears here automatically. Saved craft from NEW/EDIT live in your template library.'),
    ]));
  }

  // ── raw NED geometry block (SAM only) ────────────────────────────────────────
  geoBlock(obj, tip) {
    obj.position = obj.position || [0, 0, 5000];
    obj.velocity = (obj.velocity && typeof obj.velocity === 'object' && !Array.isArray(obj.velocity))
      ? obj.velocity : { speed: 250, heading_deg: 90, climb_deg: 0 };
    const v = obj.velocity;
    const num = (val, cb, step = '10') => el('input', { type: 'number', step, value: val, oninput: (e) => cb(+e.target.value) });
    return el('div', tip ? { 'data-tip': tip } : {}, [
      this.row([
        this.field('North (m)', num(obj.position[0], x => obj.position[0] = x)),
        this.field('East (m)', num(obj.position[1], x => obj.position[1] = x)),
        this.field('Alt (m)', num(obj.position[2], x => obj.position[2] = x)),
      ], 3),
      this.row([
        this.field('Speed', num(v.speed ?? 250, x => v.speed = x)),
        this.field('Hdg°', num(v.heading_deg ?? 0, x => v.heading_deg = x, '5')),
        this.field('Climb°', num(v.climb_deg ?? 0, x => v.climb_deg = x, '5')),
      ], 3),
    ]);
  }

  // ── target defensive-reaction timeline ───────────────────────────────────────
  timelineUI(timeline) {
    const wrap = el('div', {});
    const redraw = () => {
      wrap.innerHTML = '';
      if (!timeline.length) wrap.appendChild(el('div', { class: 'hint', style: 'opacity:.7;margin-bottom:6px' }, 'No reactions — the target flies straight (easy kill). Add one below.'));
      timeline.forEach((seg, i) => wrap.appendChild(this.segUI(seg, i, timeline, redraw)));
      wrap.appendChild(el('button', {
        class: 'btn-add', 'data-tip': 'Append a defensive reaction. The latest triggered segment drives the target.',
        onclick: () => { timeline.push({ trigger: { type: 'tti', value: 6 }, maneuver: 'break_turn', params: { g: 7, direction: 'right', period: 2.2 } }); redraw(); }
      }, '＋ ADD DEFENSIVE REACTION'));
    };
    redraw();
    return wrap;
  }
  segUI(seg, i, timeline, redraw) {
    seg.trigger = seg.trigger || { type: 'tti', value: 6 };
    seg.params = seg.params || {};
    const trg = [
      { key: 'time', label: 'At time (s)', tip: 'Fire at an absolute mission time.' },
      { key: 'range', label: 'At range (m)', tip: 'Fire when the missile closes inside this range (RWR reaction).' },
      { key: 'tti', label: 'At TTI (s)', tip: 'Fire at time-to-impact — the last-ditch break window.' },
      { key: 'event', label: 'On launch', tip: 'React the moment the missile is airborne.' }];
    const cm = seg.countermeasure;
    const mkey = seg.maneuver;
    // ── per-maneuver parameter rows (only what the chosen maneuver uses) ──
    const pnum = (label, key, dflt, step, tip) =>
      this.field(label, el('input', { type: 'number', step, value: seg.params[key] ?? dflt,
        oninput: (e) => seg.params[key] = +e.target.value }), tip);
    const pdir = () => this.field('Dir', el('select', {
      onchange: (e) => seg.params.direction = e.target.value
    }, this.opts([{ key: 'shortest', label: 'Shortest' }, { key: 'right', label: 'Right' }, { key: 'left', label: 'Left' }], seg.params.direction || 'right')),
      'Turn direction. "Shortest" auto-picks the quickest way round.');
    const gTip = 'Turn hardness in g. >5.5 g bleeds the target\'s airspeed every second it is held.';
    let paramRows;
    if (mkey === 'go_cold') {
      paramRows = [this.row([
        pnum('Turn G', 'g', 6, '0.5', gTip),
        pnum('Rate °/s (0=use G)', 'rate_deg_s', 0, '1', 'Optional fixed turn rate. Leave 0 to turn at the set G; set e.g. 18 °/s to model a rate-controlled abort turn.'),
      ]), this.row([
        pnum('Cold tolerance °', 'tol_deg', 8, '1', 'How close to exactly tail-on (0° aspect) before rolling out to run.'),
      ], 1)];
    } else if (mkey === 'break_to_heading') {
      paramRows = [this.row([pnum('Turn G', 'g', 7, '0.5', gTip), pdir()]),
        this.row([pnum('Rollout hdg °', 'heading_deg', 180, '5', 'The cold course: heading (°true) to steady on after the break — your escape vector.')], 1)];
    } else if (mkey === 'weave' || mkey === 'barrel_roll') {
      paramRows = [this.row([
        pnum('G-load', 'g', 6, '0.5', gTip),
        pnum('Period (s)', 'period', mkey === 'weave' ? 3 : 2.5, '0.2', 'Seconds per full S-turn / roll cycle. Shorter = more frantic, more speed bled.'),
      ])];
    } else if (mkey === 'jink') {
      paramRows = [this.row([
        pnum('G-load', 'g', 8, '0.5', gTip),
        pnum('Switch (s)', 'switch_period', 1.2, '0.1', 'Mean seconds between random direction reversals.'),
      ])];
    } else if (mkey === 'straight' || mkey === 'extend') {
      paramRows = mkey === 'extend'
        ? [this.row([pnum('Descent °', 'descent_deg', 0, '1', 'Optional shallow descent while extending — trades altitude for speed.')], 1)]
        : [];
    } else if (mkey === 'climb' || mkey === 'dive' || mkey === 'split_s' || mkey === 'immelmann') {
      paramRows = [this.row([pnum('G-load', 'g', mkey === 'climb' || mkey === 'dive' ? 3 : 7, '0.5', gTip)], 1)];
    } else {
      paramRows = [this.row([pnum('G-load', 'g', 7, '0.5', gTip), pdir()])];
    }
    return el('div', { class: 'timeline-seg' }, [
      el('span', { class: 'seg-del', 'data-tip': 'Delete this reaction.', onclick: () => { timeline.splice(i, 1); redraw(); } }, '✕'),
      this.row([
        this.field('Trigger', el('select', { onchange: (e) => seg.trigger.type = e.target.value }, this.opts(trg, seg.trigger.type)),
          'What fires this reaction: mission time, missile range, time-to-impact, or the launch itself.'),
        this.field('Value', el('input', { type: 'number', step: '0.5', value: seg.trigger.value ?? 6, oninput: (e) => seg.trigger.value = +e.target.value }),
          'Trigger threshold: seconds for time/TTI triggers, metres for the range trigger.'),
      ]),
      this.field('Maneuver', el('select', { onchange: (e) => { seg.maneuver = e.target.value; redraw(); } }, this.catOpts('maneuver', seg.maneuver)),
        MTIPS[seg.maneuver] || 'Evasive maneuver flown while this reaction is active.'),
      ...paramRows,
      this.row([
        this.field('Countermeasure', el('select', {
          onchange: (e) => { if (e.target.value === 'none') delete seg.countermeasure; else seg.countermeasure = { type: e.target.value, count: 4, intensity: 1.0, duration: 4.0 }; redraw(); }
        }, this.opts([{ key: 'none', label: 'None' }, { key: 'flare', label: 'Flares', tip: 'Decoy IR seekers.' }, { key: 'chaff', label: 'Chaff', tip: 'Decoy radar — best while notching.' }, { key: 'ecm', label: 'ECM', tip: 'Jam radar until burn-through.' }], cm ? cm.type : 'none')),
          'Expendables released the moment this reaction triggers. Match the seeker: flares vs IR, chaff/ECM vs radar.'),
        this.field('Count', el('input', { type: 'number', step: '1', value: cm ? cm.count : 0, ...(cm ? {} : { disabled: '' }), oninput: (e) => { if (seg.countermeasure) seg.countermeasure.count = +e.target.value; } }),
          'How many expendables in the salvo — more = better decoy odds while they burn/bloom.'),
      ]),
    ]);
  }
}
