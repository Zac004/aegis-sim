# AEGIS-SIM — Missile Engagement 6-DOF Simulator

> Codename directory: `WHAT_IF?`  ·  Product name: **Aegis-Sim**
> A hyper-realistic, cross-platform (Windows/macOS/Linux) missile-vs-target
> engagement simulator with a full 6-DOF physics core, advanced GNC, seeker
> modelling, an atmospheric model, a maneuver timeline engine, a Monte-Carlo
> "Tactical AI" optimizer, and an award-winning WebGL 3D front-end.

---

## 1. Architecture at a glance

```
WHAT_IF?/
├── run.py                     # ← single entry point:  python run.py
├── requirements.txt
├── CLAUDE.md                  # (this file)
├── README.md
│
├── core/                      # Physics + GNC engine (pure Python / NumPy)
│   ├── registry.py            # ★ Plugin "Pandora Box" — register anything
│   ├── atmosphere.py          # US Standard Atmosphere 1976
│   ├── aerodynamics.py        # Cd/Cl/Cm vs Mach & AoA
│   ├── propulsion.py          # Multi-stage motor: thrust curve, mass, inertia
│   ├── guidance.py            # Pure PN, APN, OGL, CLOS  (+ plugin laws)
│   ├── seeker.py              # RF / IR / SARH seekers, gimbal, FOV, ECM
│   ├── autopilot.py           # 3-loop accel autopilot + actuator dynamics
│   ├── maneuvers.py           # Target maneuver timeline / preset library
│   ├── dynamics.py            # 6-DOF rigid-body EOM (quaternion attitude)
│   ├── integrator.py          # RK4 / adaptive stepping
│   ├── simulation.py          # Scenario runner → telemetry time-series
│   ├── optimizer.py           # Tactical-AI: parallel tactical_study (Rmax/MAR/SRRC/decision-table, POST /api/tactical) + parallel monte_carlo/genetic (shared _SimPool)
│   └── templates.py           # JSON template manager (load/save/validate)
│
├── templates/
│   ├── schemas/               # JSON Schema blueprints (missile, platform, scenario)
│   ├── missiles/              # Example interceptor definitions
│   ├── platforms/             # Fighters, ships, SAM sites
│   └── scenarios/             # Full engagement setups
│
├── plugins/                   # Drop a .py here → auto-discovered at boot
│   └── example_plugin.py      # Shows how to add a custom guidance law + seeker
│
├── gui/
│   ├── server.py              # Stdlib HTTP + JSON API (no heavy deps)
│   └── web/                   # Three.js single-page front-end
│       ├── index.html
│       ├── css/style.css
│       └── js/*.js
│
├── data/saved_scenarios/      # User saves land here
└── tests/                     # Physics sanity + regression tests
```

**Design rule:** the `core/` package never imports from `gui/`. The GUI talks to
the core only through `core.simulation` and `core.templates`. This keeps the
physics headless-testable and lets the same engine drive a CLI, the web UI, or a
batch optimizer.

---

## 2. The Plugin "Pandora Box"  (★ read this first)

Everything selectable in a scenario — guidance law, seeker, autopilot, target
maneuver, atmosphere model, aero model — is resolved through a single registry
in [`core/registry.py`](core/registry.py). To add a **new type** of anything,
you never edit the engine. You just register it:

```python
from core.registry import register, GuidanceLaw

@register("guidance", "my_law", label="My Custom Law")
class MyLaw(GuidanceLaw):
    def command(self, ctx):
        # ctx gives you LOS rate, closing velocity, target state, etc.
        # return a commanded lateral acceleration vector (m/s^2, inertial NED)
        return ctx.N * ctx.closing_speed * ctx.los_rate_vec
```

Put that file anywhere under `plugins/` and it appears in the UI dropdown on the
next launch. The same pattern works for `"seeker"`, `"maneuver"`,
`"autopilot"`, `"atmosphere"`, and `"aero"`. See
[`plugins/example_plugin.py`](plugins/example_plugin.py).

Registry categories:

| Category     | Base class      | Purpose                                   |
|--------------|-----------------|-------------------------------------------|
| `guidance`   | `GuidanceLaw`   | Produce commanded acceleration            |
| `seeker`     | `SeekerModel`   | Measure/track target, apply ECM effects   |
| `autopilot`  | `Autopilot`     | Turn accel command → body moments/fins    |
| `maneuver`   | `Maneuver`      | Drive target kinematics                    |
| `atmosphere` | `AtmosphereModel`| ρ, P, T, a vs altitude                    |
| `aero`       | `AeroModel`     | Cd, Cl, Cm vs Mach & AoA                   |

---

## 3. Coordinate frames & conventions

- **Inertial frame:** flat-Earth **NED** (North, East, Down). Gravity is +Down.
- **Body frame:** x-forward, y-right, z-down (standard aircraft body axes).
- **Attitude:** unit quaternion `q` (body→inertial), integrated from body rates
  `[p, q, r]`. Euler angles are derived for display only.
- **Units:** SI everywhere internally (m, kg, s, N, rad). The UI converts to
  km / Mach / g / deg for humans; the JSON templates use human units and are
  converted on load (see `templates.py`).
- **G:** `g0 = 9.80665 m/s²`.

---

## 4. Physics fidelity notes

- **Atmosphere:** US Standard Atmosphere 1976, 7 geopotential layers to 86 km,
  exact lapse-rate integration for T, P; ρ from ideal gas; a = √(γRT).
- **6-DOF:** full rigid-body translational + rotational EOM. Thrust along body-x,
  aerodynamic force resolved from AoA/sideslip, gravity in NED. Rotational EOM
  uses the (possibly time-varying) inertia tensor from `propulsion`.
- **Mass properties:** motor burn depletes mass, shifts CG, and rescales the
  inertia tensor between launch and burnout values.
- **Propulsion types:** multi-pulse solids (stages with delayed `ignition_time_s`
  — PL-15/AIM-260 dual-pulse) and an air-breathing **ramjet sustainer**
  (`propulsion.ramjet` in the template; thrust ∝ ρ·V, throttled to hold cruise
  Mach, flame-out below `mach_min`, real fuel burn at high Isp — Meteor/PL-21).
- **Midcourse shaper:** `simulation.MidcourseShaper` owns MIDCOURSE/INS steering
  for datalink weapons with APN/OGL + `loft>0`: PIP navigation, energy loft
  (climb→cruise→dive, apogee capped by `ceiling_m`), and vertical-launch SAM
  pitch-over on thrust-borne lift. PN/CLOS/IR weapons never loft. TERMINAL is
  non-latching: lock loss drops a datalink round back to INS to re-acquire.
- **Hard limits:** per-missile thermal `battery_s` (fins freeze after — round
  goes ballistic), structural `max_mach` (altitude-dependent by construction),
  and subsonic energy-death for coasting rounds.
- **Guidance:** True/Pure PN uses LOS-rate × closing velocity × N. APN adds a
  target-acceleration feed-forward term (N/2·a_t). OGL is the finite-time
  optimal law with a gravity/target-accel term.
- **Autopilot:** commanded lateral accel → required AoA → fin deflection through
  a first-order actuator with rate + deflection limits → body moment.
- **Integration:** fixed-step RK4 by default (dt≈0.002 s), with a coarser output
  cadence for the UI. Numba JIT accelerates the inner loop *if installed*; the
  code runs fine on pure NumPy otherwise.

---

## 5. Running & developing

```bash
python -m venv .venv && source .venv/bin/activate      # (Windows: .venv\Scripts\activate)
pip install -r requirements.txt                        # numpy required; scipy/numba optional
python run.py                                           # opens the app in your browser
```

- `python run.py --no-browser` — start the server without auto-opening a tab.
- `python run.py --port 8770` — pick a port.
- `python run.py --headless <scenario.json>` — run a scenario, print summary, exit.
- `pytest tests/` — physics sanity + regression tests.

**Dependency policy:** the app must run with **only NumPy** installed. `scipy`
(nicer interpolation) and `numba` (JIT speed) are *optional accelerators* behind
`try/except` imports. Three.js is loaded in the browser via an ES-module
import-map (CDN) so there is no Node/npm build step.

---

## 6. Data flow of one simulation

```
scenario JSON ──▶ templates.load ──▶ Scenario object
      │
      ▼
simulation.run(scenario):
   build Missile (mass, motor, aero, seeker, autopilot, guidance)
   build Target  (kinematics + maneuver timeline)
   loop RK4 @ dt:
       atmosphere(h) → ρ,a
       seeker.measure(missile,target) → LOS, LOS-rate, lock/ECM state
       guidance.command(ctx) → a_cmd
       autopilot(a_cmd) → fin δ → body moment
       dynamics.derivatives(state, forces, moments)
       integrator.step
       target.update(maneuver)
       record telemetry
       check miss-distance / intercept / ground / timeout
      │
      ▼
   TelemetryResult (numpy arrays) ──▶ JSON ──▶ Three.js viewport + graphs
```

---

## 7. Conventions for contributors (and future Claude sessions)

- Keep `core/` NumPy-only and GUI-free; add real docstrings with the physics.
- New capabilities go in as **plugins/registry entries**, not `if/elif` chains.
- Everything a user can tune lives in the JSON templates, validated against the
  schemas in `templates/schemas/`.
- Prefer vectorized NumPy; guard optional deps; never hard-crash on a missing
  optional accelerator.
- When you change the state-vector layout, update `dynamics.py`,
  `integrator.py`, and `simulation.py` together — they share the packing order
  documented at the top of `dynamics.py`.
