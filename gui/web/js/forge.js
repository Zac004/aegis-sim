// forge.js — the "Forge": create / edit / duplicate airframes (missiles) and
// platforms (aircraft, SAMs, targets) to component-level detail, pick a sprite
// and colours from the shared library, and save as a reusable template.

const clone = (o) => JSON.parse(JSON.stringify(o));
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
function getPath(o, p) { return p.split('.').reduce((a, k) => a?.[/^\d+$/.test(k) ? +k : k], o); }
function setPath(o, p, val) {
  const parts = p.split('.'); let cur = o;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = /^\d+$/.test(parts[i]) ? +parts[i] : parts[i];
    if (cur[k] == null) cur[k] = /^\d+$/.test(parts[i + 1]) ? [] : {};
    cur = cur[k];
  }
  const last = parts[parts.length - 1];
  cur[/^\d+$/.test(last) ? +last : last] = val;
}
const slug = (s) => (s || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

const DEFAULT_MISSILE = {
  id: '', name: 'New Interceptor', category: 'air_to_air',
  visual: { sprite: 'aam_slender', color: '#d9dde3', accent: '#ffb000' },
  physical: { length_m: 3.6, diameter_m: 0.18, launch_mass_kg: 150, empty_mass_kg: 100, max_g: 40 },
  propulsion: { cg_wet_m: 2.0, cg_dry_m: 1.7, stages: [{
    name: 'boost-sustain', propellant_mass_kg: 50, ignition_time_s: 0, isp_s: 240, exit_area_m2: 0.012,
    boost_sustain: { boost_thrust_n: 14000, boost_time_s: 2.2, sustain_thrust_n: 3000, sustain_time_s: 6 } }] },
  aero: { model: 'parametric', params: { cd0_subsonic: 0.28, cd0_transonic_peak: 0.7, cd0_supersonic: 0.4, cn_alpha0: 34, cm_alpha0: -0.3, cm_q: -200 } },
  seeker: { type: 'rf_active', params: { acquisition_range: 25000, gimbal_limit_deg: 60, fov_deg: 4, track_bandwidth_hz: 3.5, angle_noise_mrad: 0.4, frequency_band: 'X', jam_susceptibility: 0.12, burnthrough_range: 2500 } },
  loft: 1.0, battery_s: 100, max_mach: 4.0, ceiling_m: 21000,
  guidance: { law: 'apn', N: 4 },
  autopilot: { type: 'three_loop', params: { max_fin_deg: 25, fin_rate_deg_s: 350, actuator_tau: 0.02, max_g: 40 } },
};
const DEFAULT_PLATFORM = {
  id: '', name: 'New Platform', type: 'fighter',
  visual: { sprite: 'fighter_delta', color: '#8b95a3', accent: '#00e5ff' },
  signatures: { rcs_m2: 4, ir_signature: 1.2 },
  performance: { max_g: 9, min_speed_mps: 130, max_speed_mps: 720, service_ceiling_m: 18000 },
  countermeasures: { flares: 60, chaff: 60, ecm: true },
};

export class Forge {
  constructor(catalog) { this.catalog = catalog; this.onSaved = null; }

  open(kind, data, slot) {
    // kind: 'missiles' | 'platforms' ; slot: 'missile' | 'target' | 'shooter'
    this.kind = kind;
    this.slot = slot || (kind === 'missiles' ? 'missile' : 'target');
    this.data = clone(data || (kind === 'missiles' ? DEFAULT_MISSILE : DEFAULT_PLATFORM));
    this._render();
    document.body.appendChild(this.modal);
  }
  close() { this.modal?.remove(); }
  _rerender() { const m = this.modal; this._render(); m?.replaceWith(this.modal); }

  _render() {
    const title = this.kind === 'missiles' ? 'AIRFRAME FORGE — INTERCEPTOR' : 'PLATFORM FORGE — AIRCRAFT / TARGET';
    const body = el('div', { class: 'modal-body forge-body' },
      this.kind === 'missiles' ? this._missileForm() : this._platformForm());
    const box = el('div', { class: 'modal-box forge-box' }, [
      el('div', { class: 'modal-head' }, [
        el('span', {}, '⚒ ' + title),
        el('button', { class: 'x', onclick: () => this.close() }, '✕'),
      ]),
      body,
      el('div', { class: 'forge-foot' }, [
        el('div', { class: 'hint', style: 'flex:1' }, 'Saved craft appear instantly in the configurator dropdowns and keep this exact look everywhere.'),
        el('button', { class: 'ghost', onclick: () => this.close() }, 'CANCEL'),
        el('button', { class: 'opt-run', style: 'width:auto;padding:10px 22px', onclick: () => this._save() }, '⚒ SAVE TO LIBRARY'),
      ]),
    ]);
    this.modal = el('div', { class: 'modal' }, box);
    this.modal.addEventListener('mousedown', (e) => { if (e.target === this.modal) this.close(); });
  }

  // ── field builders ─────────────────────────────────────────────────────────
  num(label, path, step = 1, tip = '') {
    const inp = el('input', { type: 'number', step, value: getPath(this.data, path) ?? 0,
      oninput: (e) => setPath(this.data, path, +e.target.value) });
    return el('div', { class: 'field', ...(tip ? { 'data-tip': tip } : {}) }, [el('label', {}, label), inp]);
  }
  sel(label, path, options, tip = '') {
    const cur = getPath(this.data, path);
    const s = el('select', { onchange: (e) => setPath(this.data, path, e.target.value) },
      options.map(o => el('option', { value: o.key, ...(String(o.key) === String(cur) ? { selected: '' } : {}) }, o.label)));
    return el('div', { class: 'field', ...(tip ? { 'data-tip': tip } : {}) }, [el('label', {}, label), s]);
  }
  txt(label, path, tip = '') {
    const inp = el('input', { type: 'text', value: getPath(this.data, path) ?? '',
      oninput: (e) => setPath(this.data, path, e.target.value) });
    return el('div', { class: 'field', ...(tip ? { 'data-tip': tip } : {}) }, [el('label', {}, label), inp]);
  }
  bool(label, path, tip = '') {
    const cur = !!getPath(this.data, path);
    const s = el('select', { onchange: (e) => setPath(this.data, path, e.target.value === 'yes') },
      [el('option', { value: 'yes', ...(cur ? { selected: '' } : {}) }, 'Equipped'),
       el('option', { value: 'no', ...(!cur ? { selected: '' } : {}) }, 'None')]);
    return el('div', { class: 'field', ...(tip ? { 'data-tip': tip } : {}) }, [el('label', {}, label), s]);
  }
  group(title, ...fields) {
    return el('div', { class: 'forge-group' }, [el('div', { class: 'forge-gtitle' }, title), ...fields]);
  }
  rows(...fields) { return el('div', { class: 'forge-rows' }, fields); }

  // ── visual (sprite + colours) picker ────────────────────────────────────────
  visualPicker(spriteClass) {
    const sprites = (this.catalog.sprites || []).filter(s => s.class === spriteClass);
    const grid = el('div', { class: 'sprite-grid' });
    const paint = () => {
      grid.innerHTML = '';
      sprites.forEach(sp => {
        const sel = this.data.visual.sprite === sp.key;
        const tile = el('div', { class: 'sprite-tile' + (sel ? ' sel' : ''), 'data-tip': sp.label,
          onclick: () => { this.data.visual.sprite = sp.key; paint(); } }, [
          el('div', { class: 'sprite-swatch', style: `background:linear-gradient(135deg,${this.data.visual.color} 60%,${this.data.visual.accent} 60%)` }),
          el('div', { class: 'sprite-name' }, sp.label),
        ]);
        grid.appendChild(tile);
      });
    };
    paint();
    const swatches = (key) => {
      const wrap = el('div', { class: 'swatch-row' });
      (this.catalog.palettes || []).forEach(p => {
        wrap.appendChild(el('button', { class: 'swatch', style: `background:${p.hex}`, 'data-tip': p.name,
          onclick: () => { this.data.visual[key] = p.hex; paint(); markSel(); } }));
      });
      const custom = el('input', { type: 'color', class: 'swatch-custom', value: this.data.visual[key],
        oninput: (e) => { this.data.visual[key] = e.target.value; paint(); } });
      wrap.appendChild(custom);
      const markSel = () => wrap.querySelectorAll('.swatch').forEach((b, i) => {
        b.classList.toggle('sel', (this.catalog.palettes[i] || {}).hex?.toLowerCase() === this.data.visual[key]?.toLowerCase());
      });
      markSel();
      return wrap;
    };
    return this.group('◈ SPRITE & LIVERY',
      el('div', { class: 'hint', style: 'margin-bottom:6px' }, 'Pick the 3D model, then a skin and accent colour. This look follows the craft into every scenario.'),
      grid,
      el('label', { style: 'margin-top:8px' }, 'Skin colour'), swatches('color'),
      el('label', { style: 'margin-top:8px' }, 'Accent colour'), swatches('accent'));
  }

  // ── propulsion editor: boost-sustain / dual-pulse / ramjet ─────────────────
  _motorType() {
    const p = this.data.propulsion || {};
    if (p.ramjet) return 'ramjet';
    if ((p.stages || []).length > 1) return 'dual_pulse';
    return 'boost_sustain';
  }
  _setMotorType(t) {
    const p = this.data.propulsion = this.data.propulsion || {};
    p.stages = p.stages || [];
    const s0 = p.stages[0] || { name: 'boost', propellant_mass_kg: 50, ignition_time_s: 0, isp_s: 245,
      exit_area_m2: 0.012, boost_sustain: { boost_thrust_n: 16000, boost_time_s: 2.5, sustain_thrust_n: 4000, sustain_time_s: 8 } };
    if (t === 'boost_sustain') { p.stages = [s0]; delete p.ramjet; }
    else if (t === 'dual_pulse') {
      const s1 = p.stages[1] || { name: 'pulse 2 (endgame)', propellant_mass_kg: 30, ignition_time_s: 20, isp_s: s0.isp_s,
        exit_area_m2: s0.exit_area_m2, boost_sustain: { boost_thrust_n: 12000, boost_time_s: 5, sustain_thrust_n: 0, sustain_time_s: 0 } };
      s0.name = 'pulse 1 (boost)'; p.stages = [s0, s1]; delete p.ramjet;
    } else { // ramjet
      s0.name = 'booster'; p.stages = [s0];
      p.ramjet = p.ramjet || { thrust_n: 9000, fuel_mass_kg: 50, isp_s: 800, ignition_time_s: 4.0,
        mach_min: 2.0, mach_cruise: 3.5, mach_economy: 2.8, min_throttle: 0.15 };
    }
    this._rerender();
  }
  _propulsionGroup() {
    const t = this._motorType();
    const typeSel = el('div', { class: 'field',
      'data-tip': 'Motor architecture. Boost-sustain: one solid grain in two thrust levels. Dual-pulse: a second, separately-ignited grain restores energy for the endgame (PL-15 / AIM-260 style). Ramjet: air-breathing throttleable sustainer — powered all the way to the merge (Meteor style).' }, [
      el('label', {}, 'Motor type'),
      el('select', { onchange: (e) => this._setMotorType(e.target.value) },
        [['boost_sustain', 'Solid — boost / sustain'], ['dual_pulse', 'Solid — DUAL-PULSE'], ['ramjet', 'RAMJET + booster']]
          .map(([k, l]) => el('option', { value: k, ...(t === k ? { selected: '' } : {}) }, l))),
    ]);
    const fields = [typeSel];
    const stageFields = (i, label) => [
      this.rows(this.num(`${label} thrust (N)`, `propulsion.stages.${i}.boost_sustain.boost_thrust_n`, 100, 'Peak thrust of this grain (1 N ≈ 0.1 kgf). Examples: WVR boost ~13 kN · AMRAAM boost ~22 kN · PAC-3 ~70 kN · S-400 booster ~350 kN.'),
        this.num(`${label} burn (s)`, `propulsion.stages.${i}.boost_sustain.boost_time_s`, 0.1, 'How long this grain burns at peak thrust. Short violent boost ~2–3 s; big SAM boosters ~5–6 s. (The library derives this so the impulse = propellant × Isp × g₀.)')),
      this.rows(this.num(`${label} propellant (kg)`, `propulsion.stages.${i}.propellant_mass_kg`, 1, 'Grain mass — as it burns, mass leaves the missile so the CG shifts and inertia drops (all modelled). Must sum with the ramjet fuel to launch − empty mass. Examples: WVR ~24 kg · AMRAAM ~48–55 kg · S-400 ~900 kg.'),
        this.num(`${label} Isp (s)`, `propulsion.stages.${i}.isp_s`, 1, 'Specific impulse — thrust efficiency per kg of propellant burned. Solid rockets ≈ 230–265 s. (A ramjet\'s fuel Isp is far higher, ~600–1000 s, because it breathes air.)')),
    ];
    if (t === 'boost_sustain') {
      fields.push(...stageFields(0, 'Boost'));
      fields.push(this.rows(
        this.num('Sustain thrust (N)', 'propulsion.stages.0.boost_sustain.sustain_thrust_n', 100, 'Lower thrust level after the boost, to stretch the burn and hold speed. Examples: AMRAAM ~5000 N · big SAM ~15–65 kN. Set to 0 for an all-boost motor (e.g. ESSM, PAC-3).'),
        this.num('Sustain time (s)', 'propulsion.stages.0.boost_sustain.sustain_time_s', 0.1, 'Duration of the sustain phase. Longer sustain = flatter energy profile and more reach. AMRAAM ~10–15 s.')));
    } else if (t === 'dual_pulse') {
      fields.push(...stageFields(0, 'Pulse-1'));
      fields.push(...stageFields(1, 'Pulse-2'));
      fields.push(this.rows(this.num('Pulse-2 ignition at (s)', 'propulsion.stages.1.ignition_time_s', 1,
        'Seconds after launch when the second pulse lights — time it for just before the terminal phase to arrive fast at the merge.')));
    } else {
      fields.push(...stageFields(0, 'Booster'));
      fields.push(this.rows(
        this.num('Ramjet thrust (N)', 'propulsion.ramjet.thrust_n', 100, 'Max thrust at the reference condition (≈Mach 3 @ 11 km). Real available thrust scales with captured airflow ∝ ρ·V, so it needs speed and air. Meteor ~9 kN, PL-21 ~15 kN.'),
        this.num('Ramjet fuel (kg)', 'propulsion.ramjet.fuel_mass_kg', 1, 'Fuel carried — the oxidiser is the atmosphere, so Isp is huge. Meteor ~54 kg. This is what limits powered endurance, not oxidiser.')));
      fields.push(this.rows(
        this.num('Ramjet Isp (s)', 'propulsion.ramjet.isp_s', 10, 'Ducted-rocket fuel Isp ≈ 600–1000 s — 3–4× a solid rocket, because it only carries fuel (air-breathing).'),
        this.num('Ignition at (s)', 'propulsion.ramjet.ignition_time_s', 0.1, 'When the gas generator lights (booster hand-over). Set to the BOOSTER burn time so their thrusts don\'t overlap — ~4 s for Meteor.')));
      fields.push(this.rows(
        this.num('Min Mach (flame-out)', 'propulsion.ramjet.mach_min', 0.1, 'Below this Mach the intake flow is too weak — the ramjet cannot run, and once it decelerates through this it is dead for good (no relight). ~1.8–2.0.'),
        this.num('Economy cruise Mach', 'propulsion.ramjet.mach_economy', 0.1, 'The fuel-EFFICIENT midcourse cruise it holds to CONSERVE fuel. Above this Mach it idles (burns nothing); below it, it throttles up. Meteor ~2.8. This is the real energy-management trick.')));
      fields.push(this.rows(
        this.num('Terminal Mach (throttle-up)', 'propulsion.ramjet.mach_cruise', 0.1, 'The HIGHER Mach it restores in the terminal phase — it throttles up here to arrive fast at the merge, which is what gives a ramjet its huge no-escape zone. Meteor ~3.5.')));
    }
    return this.group(t === 'ramjet' ? 'PROPULSION — RAMJET + BOOSTER'
      : t === 'dual_pulse' ? 'PROPULSION — DUAL-PULSE SOLID' : 'PROPULSION — BOOST/SUSTAIN SOLID', ...fields);
  }

  // ── missile form ────────────────────────────────────────────────────────────
  _missileForm() {
    const seekers = (this.catalog.seeker || []).map(o => ({ key: o.key, label: o.label }));
    const guides = (this.catalog.guidance || []).map(o => ({ key: o.key, label: o.label }));
    const autos = (this.catalog.autopilot || []).map(o => ({ key: o.key, label: o.label }));
    const bands = ['X', 'Ku', 'Ka', 'S', 'C', 'MWIR', 'LWIR'].map(b => ({ key: b, label: b }));
    return [
      el('div', { class: 'forge-cols' }, [
        el('div', {}, [
          this.group('IDENTITY',
            this.txt('Designation', 'name', 'Display name of the missile.'),
            this.sel('Category', 'category', [{ key: 'air_to_air', label: 'Air-to-Air' }, { key: 'surface_to_air', label: 'Surface-to-Air' }, { key: 'custom', label: 'Custom' }], 'Drives sensible defaults and launcher depiction.')),
          this.group('AIRFRAME (PHYSICAL)',
            this.rows(this.num('Length (m)', 'physical.length_m', 0.1, 'Body length. Sets the fin moment arm and slenderness. Examples: AIM-9X 3.0 m · AIM-120 3.66 m · Meteor 3.65 m · R-37M 4.2 m · Aster 30 4.9 m · S-400 48N6 7.5 m.'),
              this.num('Diameter (m)', 'physical.diameter_m', 0.01, 'Body diameter → frontal reference area (drag & lift scale with it). Examples: Sidewinder 0.127 m · AMRAAM 0.178 m · R-77 0.20 m · R-37M 0.38 m · S-400 0.50 m.')),
            this.rows(this.num('Launch mass (kg)', 'physical.launch_mass_kg', 1, 'All-up mass at launch (airframe + propellant + warhead). Examples: AIM-9X 85 kg · AMRAAM 152 kg · Meteor 190 kg · PL-15 210 kg · R-37M 510 kg · PAC-3 315 kg · S-400 48N6 1800 kg.'),
              this.num('Empty mass (kg)', 'physical.empty_mass_kg', 1, 'Burnout mass (launch mass − propellant). The difference IS the propellant, so keep them consistent. Example: AMRAAM 152→113 kg means 39 kg of propellant.')),
            this.num('Max structural G', 'physical.max_g', 1, 'Airframe load limit — commanded acceleration is clamped to this (and to what dynamic pressure can supply). Examples: big SAM ~20–28 g · AMRAAM ~40 g · WVR dogfight missile ~50–60 g · hit-to-kill PAC-3/9M96 ~45–60 g.')),
          this._propulsionGroup(),
          this.group('FLIGHT ENVELOPE & MIDCOURSE',
            this.rows(this.num('Battery life (s)', 'battery_s', 5, 'Thermal-battery run time. When it dies the fins freeze and the missile goes ballistic — the hard ceiling on flight time (and thus max range). Examples: WVR IR ~45–60 s · AMRAAM-C ~100 s · AMRAAM-D/Meteor ~160–260 s · S-400 40N6 ~600 s (must reach 380 km).'),
              this.num('Max Mach (structural)', 'max_mach', 0.1, 'Skin-heating/structural Mach cap. Real top speed is emergent (thrust vs drag) and altitude-dependent — this only limits it. Examples: WVR ~2.5–3 · AMRAAM ~4 · PL-15/AIM-260 ~5 · R-37M / big SAM ~6–6.5.')),
            this.rows(this.num('Loft gain (0 = none)', 'loft', 0.1, 'How aggressively the missile climbs into thin air during midcourse to extend range (climb→cruise→dive). Only fires with a datalink + APN/OGL — PN, CLOS and IR weapons never loft. Examples: WVR 0 · AMRAAM-C ~1.0 · AMRAAM-D ~1.4 · PL-15 ~1.6 · R-37M ~2.0.'),
              this.num('Loft ceiling (m)', 'ceiling_m', 500, 'Highest useful apogee of the lofted midcourse — above this the air is too thin for the fins to hold the profile. Examples: AAM ~21–26 km · long-range SAM ~30–35 km.'))),
          this.group('AERODYNAMICS',
            this.rows(this.num('Cd₀ subsonic', 'aero.params.cd0_subsonic', 0.01, 'Zero-lift drag coefficient below Mach 0.8 (referenced to frontal area). Lower = cleaner coast. Slim BVR airframe ~0.28–0.30; a draggy finned WVR dart ~0.36; a fat SAM ~0.26.'),
              this.num('Cd₀ transonic peak', 'aero.params.cd0_transonic_peak', 0.01, 'Peak drag at the transonic "sound-barrier" spike near Mach 1 (wave drag). This is the hump the missile must punch through. Slim ~0.7–0.8; dogfight dart ~0.98.')),
            this.rows(this.num('Cd₀ supersonic', 'aero.params.cd0_supersonic', 0.01, 'Zero-lift drag once safely supersonic (drag eases after the transonic peak). Typically ~0.40–0.50. Sets the coast-decay rate that caps range.'),
              this.num('Normal-force slope CNα', 'aero.params.cn_alpha0', 1, 'Lift (normal force) produced per radian of angle-of-attack — the missile\'s turn muscle. Higher = tighter turns per degree AoA. Slender AAM ~32–40; a big-finned dogfighter higher.')),
            this.rows(this.num('Static stability Cmα', 'aero.params.cm_alpha0', 0.01, 'Pitch stiffness (weathercock). NEGATIVE = statically stable (nose returns toward the airflow). ~−0.28 to −0.34. More negative = stiffer but sluggish; near zero = twitchy.'),
              this.num('Pitch damping Cmq', 'aero.params.cm_q', 5, 'Rate damping that resists pitch/yaw oscillation. More negative = better-damped (smoother), less negative = more overshoot. Typically −180 to −240.'))),
        ]),
        el('div', {}, [
          this.group('SEEKER / SENSOR',
            this.sel('Seeker type', 'seeker.type', seekers, 'Active radar (ARH): own transmitter, fires-and-forgets once active, chaff/ECM-vulnerable — AMRAAM, PL-15. Semi-active (SARH): homes on the shooter\'s reflection, needs continuous illumination — Sparrow, R-27R. IR: passive heat, no warning, flare-prone — Sidewinder. Imaging-IR (IIR): a thermal camera that rejects flares — AIM-9X, IRIS-T.'),
            this.rows(this.num('Acquisition range (m)', 'seeker.params.acquisition_range', 500, 'Range the seeker locks a reference-RCS target — this is where the missile goes "pitbull" / active. Scales with target RCS. Examples: AMRAAM ~20–25 km · PL-15 AESA ~25 km · IR WVR ~10–14 km · big SARH SAM ~40–55 km.'),
              this.sel('Frequency band', 'seeker.params.frequency_band', bands, 'RF band: X (most fighter radars, balanced), Ku/Ka (higher resolution, shorter range — modern AESA seekers), S/C (longer range, big SAMs). IR band: MWIR 3–5 µm (hot plumes), LWIR 8–12 µm (imaging/skin-heat). Affects resolution and weather.')),
            this.rows(this.num('Gimbal limit (°)', 'seeker.params.gimbal_limit_deg', 1, 'How far off its own nose the seeker head can physically look before track breaks. This is what the NOTCH exploits. Typical radar ~55–65°; wide-FOV IR/HOBS ~75–90°.'),
              this.num('Field of view (°)', 'seeker.params.fov_deg', 0.5, 'Instantaneous acceptance cone the seeker sees at once. Narrow (~3–4°) = precise but must be pointed well; wider = easier acquisition, more clutter.')),
            this.rows(this.num('Track bandwidth (Hz)', 'seeker.params.track_bandwidth_hz', 0.1, 'Tracking-loop bandwidth. Higher (~4–5 Hz) follows an agile jinking target but passes more noise into guidance; lower is smoother but lags. ~3–3.5 Hz is typical.'),
              this.num('Angle noise (mrad)', 'seeker.params.angle_noise_mrad', 0.05, '1-σ angular measurement noise — the physical source of the few-metres terminal miss. Sharp imaging seekers ~0.15 mrad; noisier radar ~0.4–0.5 mrad.')),
            this.rows(this.num('Jam susceptibility (0–1)', 'seeker.params.jam_susceptibility', 0.01, 'Per-step probability a matched countermeasure degrades the track. Low ~0.06 (jam-resistant AESA / imaging-IR) → high ~0.22 (legacy IR vs flares). ECM and chaff act through this.'),
              this.num('Burn-through range (m)', 'seeker.params.burnthrough_range', 100, 'Range inside which the real echo overpowers chaff/ECM and jamming stops working (skin return ∝1/R⁴ beats jam ∝1/R²). Typically ~2000–3000 m for active radar.'))),
          this.group('GUIDANCE (GNC)',
            this.rows(this.sel('Guidance law', 'guidance.law', guides, 'PN: classic homing (IR/legacy), never lofts. APN: adds target-maneuver lead — the modern all-rounder. OGL: energy-optimal, lofts for long shots. CLOS: beam-riding for point-defence SAMs (Tor).'),
              this.num('Navigation constant N', 'guidance.N', 0.1, 'Guidance gain. 3–5 typical. Higher nulls line-of-sight rotation sooner (leads a turning target harder) but amplifies seeker noise and burns energy. 4 is the standard default.'))),
          this.group('AUTOPILOT & ACTUATORS',
            this.sel('Autopilot', 'autopilot.type', autos, '3-Loop: models real fin actuator dynamics (lag, rate & deflection limits) — the realistic choice. Ideal: instant, lag-free lift vectoring for isolating guidance behaviour in analysis.'),
            this.rows(this.num('Max fin deflection (°)', 'autopilot.params.max_fin_deg', 1, 'Largest angle the control fins can deflect. More = more control authority (tighter turns) at the cost of drag. Typical ~25–30°.'),
              this.num('Fin rate limit (°/s)', 'autopilot.params.fin_rate_deg_s', 10, 'How fast the actuators can slew the fins — caps how quickly the missile can respond to a jink. Agile missiles ~400–500 °/s; sluggish ~300.')),
            this.rows(this.num('Actuator lag τ (s)', 'autopilot.params.actuator_tau', 0.005, 'First-order actuator time constant — the delay between commanded and achieved fin angle. Smaller = crisper response. ~0.02 s is typical; the endgame G-fight lives here.'),
              this.num('Autopilot G limit', 'autopilot.params.max_g', 1, 'The G the autopilot is allowed to command (usually = the structural max-G). The airframe still can\'t exceed what dynamic pressure supplies, so a slow missile in thin air pulls far less than this.'))),
          this.visualPicker('missile'),
        ]),
      ]),
    ];
  }

  // ── platform form ───────────────────────────────────────────────────────────
  _platformForm() {
    const types = ['fighter', 'bomber', 'cruise_missile', 'uav', 'ship', 'sam_site'].map(t => ({ key: t, label: t.replace('_', ' ') }));
    return [
      el('div', { class: 'forge-cols' }, [
        el('div', {}, [
          this.group('IDENTITY',
            this.txt('Designation', 'name', 'Display name of the platform.'),
            this.sel('Type', 'type', types, 'Drives the default sprite and role.')),
          this.group('SIGNATURES',
            this.num('Radar cross-section (m²)', 'signatures.rcs_m2', 0.1, 'How big you look to radar — detection range scales as RCS^¼, so this dominates who shoots first. Examples: F-22 ~0.0001 · F-35 ~0.005 · J-20 ~0.05 · Rafale/Typhoon ~0.5–1 · legacy F-16 ~1.2 · Flanker ~4–5 · bomber ~10–100.'),
            this.num('IR signature (× fighter)', 'signatures.ir_signature', 0.1, 'Heat output relative to a reference fighter (1.0) — drives IR-seeker acquisition range. Examples: stealth ~0.9–1.0 · typical fighter ~1.2–1.4 · afterburning/large ~1.6 · heavy bomber (4 engines) ~3–4.')),
          this.group('PERFORMANCE',
            this.rows(this.num('Max G', 'performance.max_g', 0.5, 'Hardest turn it can pull evading. Sustained >5.5 g bleeds airspeed fast (worse high/thin). Examples: modern fighter 9 g · Super Hornet 7.5 g · MiG-31 5 g · bomber 2–3 g · UAV 2.5–3 g.'),
              this.num('Ceiling (m)', 'performance.service_ceiling_m', 100, 'Service ceiling — practical max altitude. Examples: most fighters ~15–18 km · F-22 ~19.8 km · MiG-31 ~20.6 km · bomber ~12–15 km.')),
            this.rows(this.num('Min speed (m/s)', 'performance.min_speed_mps', 5, 'Slowest sustainable airspeed (stall floor). Below this the jet departs. Fighters ~120–140 m/s; heavy/UAV lower.'),
              this.num('Max speed (m/s)', 'performance.max_speed_mps', 5, 'Top airspeed. Examples: F-16 ~680 · F-15 ~810 · MiG-31 ~830 · Flanker ~700–720 · bomber ~250–400 m/s (1 m/s ≈ 3.6 km/h; Mach 1 ≈ 295 m/s at altitude).'))),
          this.group('COUNTERMEASURE FIT',
            this.rows(this.num('Flares', 'countermeasures.flares', 1, 'IR decoy count carried. Hot pyrotechnics that seduce IR seekers (weak vs imaging-IR). Typical fighter load 60–120.'),
              this.num('Chaff', 'countermeasures.chaff', 1, 'Radar decoy count. Clouds of resonant dipoles — best while notching (both you and the chaff sit at ~zero Doppler). Typical 60–120.')),
            this.bool('ECM / Jammer', 'countermeasures.ecm', 'Onboard active radar jammer — raises the seeker\'s break-lock probability until burn-through range. Fighters usually equipped; UAVs/cruise missiles often not.')),
        ]),
        el('div', {}, [this.visualPicker('aircraft')]),
      ]),
    ];
  }

  // ── save ────────────────────────────────────────────────────────────────────
  async _save() {
    const d = this.data;
    d.id = slug(d.name);
    if (this.kind === 'missiles' && !d.aero) d.aero = { model: 'parametric', params: {} };
    if (this.onSaved) await this.onSaved(this.kind, d, this.slot);
    this.close();
  }
}
