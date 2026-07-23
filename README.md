---
title: Aegis-Sim
emoji: 🚀
colorFrom: blue
colorTo: red
sdk: docker
app_port: 7860
pinned: false
---

# ◤ AEGIS-SIM — Missile Engagement 6-DOF Simulator

A hyper-realistic, cross-platform missile-vs-target engagement simulator with a
full **6-degree-of-freedom** physics core, advanced **guidance/navigation/control**,
**seeker & countermeasure** modelling, the **US Standard Atmosphere 1976**, a
**maneuver timeline engine**, a Monte-Carlo / genetic **"Tactical-AI" optimizer**,
and an award-winning **WebGL (Three.js)** tactical viewport.

> Python physics core + Three.js frontend. One command to launch. Only NumPy is
> required — SciPy/Numba are optional accelerators, Three.js loads from a CDN.

---

## Quick start

```bash
cd "WHAT_IF?"
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt                       # numpy required; scipy/numba optional
python run.py                                          # opens the app in your browser
```

**Cross-platform (Windows 11 / macOS / Linux):** pure-Python + stdlib server, no
native build step. All file I/O is UTF-8-encoded and the Tactical-AI engine uses
a `spawn`-safe process pool, so everything runs identically on Windows 11
(`py run.py` or `python run.py`). On Windows just use `.venv\Scripts\activate`.

Then press **▶ ENGAGE**. Pick a preset (BVR AMRAAM shot, WVR Sidewinder dogfight,
or PAC-3 surface-to-air intercept), tweak the guidance law / seeker / target
maneuvers, and watch the 6-DOF solution render in 3D with live telemetry.

Other entry points:

```bash
python run.py --no-browser --port 8770       # server only, custom port
python run.py --list                         # list templates + registered plugins
python run.py --headless templates/scenarios/a2a_headon_amraam.json
```

---

## What's inside

| Module | What it models |
|--------|----------------|
| `core/atmosphere.py`   | USSA-1976: ρ, P, T, speed of sound to 86 km (matches published tables) |
| `core/aerodynamics.py` | Cd/Cl/Cm vs **Mach & AoA** with a transonic drag rise |
| `core/propulsion.py`   | Multi-stage motors: thrust curves, mass depletion, CG shift, inertia interpolation, altitude pressure-thrust |
| `core/dynamics.py`     | Full **6-DOF** rigid-body EOM with quaternion attitude |
| `core/guidance.py`     | **Pure PN, True PN, Augmented PN, Optimal Guidance, CLOS** |
| `core/seeker.py`       | **Active/Semi-active RF, IR, Imaging-IR**: gimbal, FOV, tracking bandwidth, thermal noise, chaff/flare/ECM vulnerability |
| `core/autopilot.py`    | 3-loop acceleration autopilot with **fin actuator lag + rate/deflection limits** |
| `core/maneuvers.py`    | Break turn, weave, barrel roll, Split-S, Immelmann, notch, jink + a **trigger timeline** |
| `core/optimizer.py`    | Monte-Carlo & genetic **"optimal survival / optimal intercept"** search |

## Realism, briefly

- Attitude (set by fins) → angle of attack → aerodynamic lift → curved
  trajectory: a genuinely coupled 6-DOF loop, not a kinematic fudge.
- Missiles bleed energy and lose g-capability at altitude; hard-maneuvering
  targets can defeat a shot in a low-energy endgame — and the optimizer will
  find exactly that survival envelope for you.
- Chaff/flares can break seeker lock; imaging-IR and dual-mode seekers resist it.

---

## ◈ The Pandora Box — add your own everything

Every guidance law, seeker, autopilot, maneuver, atmosphere and aero model is a
plugin resolved through `core/registry.py`. To add a **new type**, subclass the
base and register it — then drop the file in `plugins/`:

```python
from core.registry import register, GuidanceLaw

@register("guidance", "my_law", label="My Custom Law")
class MyLaw(GuidanceLaw):
    def command(self, ctx):
        return ctx.N * ctx.closing_speed * ctx.los_rate_vec   # (returns m/s², NED)
```

It appears in the UI dropdowns on the next launch — no engine edits. See
[`plugins/example_plugin.py`](plugins/example_plugin.py) for a custom guidance
law, a dual-mode seeker, and a new maneuver.

---

## Templates

Everything tunable lives in JSON, validated against `templates/schemas/`:

- `templates/missiles/` — AMRAAM-class, Sidewinder-class, PAC-3-class
- `templates/platforms/` — fighters, bomber, cruise-missile target
- `templates/scenarios/` — full engagements you can load, edit and save

## Tests

```bash
pip install pytest && pytest tests/
```

## Notes

- The frontend loads Three.js via a CDN import-map, so the viewport needs
  internet on first load. The physics core is fully offline.
- Tested on Python 3.11–3.13, NumPy 1.24+/2.x.
