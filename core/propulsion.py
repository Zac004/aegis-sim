"""
core.propulsion — multi-stage rocket motor & mass-properties model.
===================================================================

Handles:
  * a thrust-vs-time curve per stage (piecewise-linear, vacuum-referenced),
  * pressure-thrust correction  F = F_curve + (P0 - Pa)·Ae  so thrust rises with
    altitude as ambient pressure drops,
  * **multi-pulse motors** — any number of solid stages/pulses, each with its
    own ignition time (e.g. a PL-15-style dual-pulse: boost at t=0, second
    pulse pre-programmed for the endgame),
  * **air-breathing ramjet sustainers** (Meteor-style throttleable ducted
    rocket): thrust scales with captured air mass-flow (∝ ρ·V), operates only
    above a minimum Mach, throttles to hold a commanded cruise Mach, and burns
    real fuel at Isp far above any solid rocket,
  * propellant mass depletion (from the thrust curve + Isp for solids; from the
    actual throttle state for ramjets),
  * linear CG shift and inertia-tensor interpolation between the "wet" (launch)
    and "dry" (burnout) states as propellant is consumed.

A missile is modelled as a rigid body whose scalar mass, CG location, and
diagonal inertia tensor (Ixx roll, Iyy=Izz pitch/yaw) all vary with the
remaining propellant fraction.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Sequence, Tuple

import numpy as np

from core.atmosphere import G0

try:  # optional smoother interpolation
    from scipy.interpolate import interp1d  # noqa: F401
    _HAVE_SCIPY = True
except Exception:  # pragma: no cover
    _HAVE_SCIPY = False


@dataclass
class MotorStage:
    """One propulsion stage.

    thrust_curve : list of (t_since_stage_ignition[s], thrust[N]) points, vacuum
                   thrust preferred (sea-level curves also fine — set exit_area=0).
    propellant_mass : total propellant burned in this stage [kg].
    ignition_time   : absolute time from launch when this stage lights [s].
    isp             : specific impulse [s]; used to derive mdot if no mdot curve.
    exit_area       : nozzle exit area [m²] for pressure-thrust correction.
    """
    name: str
    thrust_curve: List[Tuple[float, float]]
    propellant_mass: float
    ignition_time: float = 0.0
    isp: float = 235.0
    exit_area: float = 0.0

    def burn_time(self) -> float:
        return self.thrust_curve[-1][0] if self.thrust_curve else 0.0

    def _times_thrusts(self):
        arr = np.asarray(self.thrust_curve, dtype=float)
        return arr[:, 0], arr[:, 1]

    def vacuum_thrust(self, t_local: float) -> float:
        """Interpolated thrust curve value at local stage time."""
        if not self.thrust_curve:
            return 0.0
        ts, fs = self._times_thrusts()
        if t_local <= ts[0]:
            return float(fs[0]) if t_local >= 0 else 0.0
        if t_local >= ts[-1]:
            return 0.0
        return float(np.interp(t_local, ts, fs))

    def total_impulse(self) -> float:
        ts, fs = self._times_thrusts()
        return float(np.trapz(fs, ts))


@dataclass
class MassProperties:
    mass: float          # kg
    cg: float            # m, from nose (or reference datum)
    inertia: np.ndarray  # 3x3 tensor about CG [kg·m²]


class RamjetSustainer:
    """Throttleable air-breathing sustainer (Meteor-class ducted rocket).

    Physics, kept honest to how a ducted rocket actually behaves:
      * Thrust comes from accelerating captured air, so the *available* thrust
        scales with intake mass-flow  ṁ_air ∝ ρ·V — full thrust needs speed and
        air density. ``thrust_n`` is the maximum at the reference condition
        (``rho_ref``·``v_ref``, ≈ Mach 3 at 11 km by default).
      * The engine only lights/runs above ``mach_min`` (the booster must get it
        supersonic first) and it flames out below that — permanently, as a real
        ducted rocket cannot relight once the gas generator has been shut down
        out of its operating envelope.
      * **Energy management (the real Meteor trick).** The engine does NOT hold a
        high fixed Mach the whole flight — that would dump all the fuel. During
        midcourse it runs a fuel-efficient ECONOMY cruise (``mach_economy``) and
        genuinely idles (throttle → 0) whenever it's already faster than that, so
        it burns *only when needed* and keeps a reserve. In the TERMINAL phase it
        throttles UP toward ``mach_cruise`` to restore speed exactly when the
        endgame fight starts — which is what gives Meteor its huge no-escape zone
        (still under power at the merge) without an absurd absolute range.
      * Fuel burns at  ṁ = F / (Isp·g0)  with the high ramjet Isp (the oxidizer
        is the atmosphere — only fuel is carried).

    Parameters
    ----------
    thrust_n       max thrust at the reference condition [N]
    fuel_mass_kg   fuel carried [kg]
    isp_s          fuel specific impulse [s] (ducted rocket ≈ 600–1000)
    ignition_time_s  when the gas generator lights (booster hand-over) [s]
    mach_min       flame-out Mach — below this the engine cannot run
    mach_cruise    the higher Mach the throttle restores in the TERMINAL phase
    mach_economy   the fuel-efficient midcourse cruise Mach (default cruise−0.7)
    min_throttle   idle floor while burning in the terminal phase
    rho_ref, v_ref reference density [kg/m³] and speed [m/s] for thrust scaling
    """

    def __init__(self, thrust_n, fuel_mass_kg, isp_s=800.0, ignition_time_s=2.0,
                 mach_min=1.8, mach_cruise=3.5, mach_economy=None, min_throttle=0.15,
                 rho_ref=0.364, v_ref=885.0):
        self.thrust_ref = float(thrust_n)
        self.fuel_mass = float(fuel_mass_kg)
        self.isp = float(isp_s)
        self.ignition_time = float(ignition_time_s)
        self.mach_min = float(mach_min)
        self.mach_cruise = float(mach_cruise)
        self.mach_economy = float(mach_economy) if mach_economy is not None \
            else max(self.mach_min + 0.5, self.mach_cruise - 0.7)
        self.min_throttle = float(min_throttle)
        self.rho_ref = float(rho_ref)
        self.v_ref = float(v_ref)
        self.reset()

    def reset(self):
        self.fuel_used = 0.0
        self._lit = False
        self._flameout = False
        self._thrust = 0.0

    @property
    def fuel_remaining(self) -> float:
        return max(self.fuel_mass - self.fuel_used, 0.0)

    def burning(self) -> bool:
        # "burning" = producing meaningful thrust this step (so it doesn't block
        # energy-death while idling on an economy cruise). Still has fuel/lit.
        return self._lit and not self._flameout and self.fuel_remaining > 1e-3 \
            and self._thrust > 200.0

    def update(self, t, dt, density, speed, mach, terminal=False) -> float:
        """Advance the engine one step; returns thrust [N] and consumes fuel.

        ``terminal`` — True once the missile is in its terminal/seeker-active
        phase, telling the engine to stop conserving and restore endgame speed.
        """
        self._thrust = 0.0
        if self._flameout or t < self.ignition_time or self.fuel_remaining <= 1e-3:
            return 0.0
        if mach < self.mach_min:
            if self._lit:
                self._flameout = True      # decelerated out of the envelope
            return 0.0
        self._lit = True
        # available thrust from intake mass-flow (∝ ρ·V), softly capped ×1.25
        capture = (density * speed) / (self.rho_ref * self.v_ref)
        F_avail = self.thrust_ref * min(max(capture, 0.0), 1.25)
        if terminal:
            # restore/hold the higher cruise Mach for the endgame (won't fully idle)
            err = self.mach_cruise - mach
            throttle = float(np.clip(0.35 + err / 0.25, self.min_throttle, 1.0))
        else:
            # ECONOMY cruise: throttle up only when below the economy Mach; idle
            # completely (throttle → 0, burn nothing) whenever already faster.
            err = self.mach_economy - mach
            throttle = float(np.clip(err / 0.22, 0.0, 0.9))
        F = F_avail * throttle
        if F <= 1.0:
            return 0.0
        # burn real fuel for the thrust actually produced
        mdot = F / (self.isp * G0)
        fuel = min(mdot * dt, self.fuel_remaining)
        self.fuel_used += fuel
        if fuel < mdot * dt:               # tank ran dry mid-step
            F *= fuel / max(mdot * dt, 1e-12)
        self._thrust = float(F)
        return float(F)


class Propulsion:
    """Assembles stages and reports thrust + mass properties over time."""

    def __init__(self,
                 stages: Sequence[MotorStage],
                 dry_mass: float,
                 length: float,
                 diameter: float,
                 cg_wet: float | None = None,
                 cg_dry: float | None = None,
                 inertia_wet: Sequence[float] | None = None,
                 inertia_dry: Sequence[float] | None = None,
                 ramjet: RamjetSustainer | None = None):
        self.stages = list(stages)
        self.ramjet = ramjet
        self.dry_mass = float(dry_mass)
        self.length = float(length)
        self.diameter = float(diameter)
        self.total_propellant = (sum(s.propellant_mass for s in self.stages)
                                 + (ramjet.fuel_mass if ramjet else 0.0))
        self.launch_mass = self.dry_mass + self.total_propellant

        # CG positions from nose (default: slightly aft shift as fuel burns)
        self.cg_wet = cg_wet if cg_wet is not None else 0.55 * length
        self.cg_dry = cg_dry if cg_dry is not None else 0.50 * length

        # Inertia: use provided, else estimate as a uniform rod + cylinder.
        r = 0.5 * diameter
        if inertia_wet is None:
            Ixx = 0.5 * self.launch_mass * r * r
            Iyy = (1.0 / 12.0) * self.launch_mass * (3 * r * r + length * length)
            inertia_wet = (Ixx, Iyy, Iyy)
        if inertia_dry is None:
            Ixx = 0.5 * self.dry_mass * r * r
            Iyy = (1.0 / 12.0) * self.dry_mass * (3 * r * r + length * length)
            inertia_dry = (Ixx, Iyy, Iyy)
        self.inertia_wet = np.asarray(inertia_wet, dtype=float)
        self.inertia_dry = np.asarray(inertia_dry, dtype=float)

        self._build_mdot_schedule()

    # ── propellant burn schedule ────────────────────────────────────────────
    def _build_mdot_schedule(self):
        """Precompute, per stage, propellant consumed vs time via ∫F/(Isp·g0)."""
        self._stage_burn = []
        for s in self.stages:
            if not s.thrust_curve:
                self._stage_burn.append((np.array([0.0]), np.array([0.0])))
                continue
            ts, fs = s._times_thrusts()
            # mass flow ∝ thrust; scale so ∫mdot dt == propellant_mass exactly
            mdot_raw = fs / (s.isp * G0)
            burned = np.concatenate([[0.0], np.cumsum(
                0.5 * (mdot_raw[1:] + mdot_raw[:-1]) * np.diff(ts))])
            total = burned[-1] if burned[-1] > 0 else 1.0
            burned *= s.propellant_mass / total
            self._stage_burn.append((ts, burned))

    def propellant_remaining(self, t: float) -> float:
        burned = 0.0
        for s, (ts, cum) in zip(self.stages, self._stage_burn):
            tl = t - s.ignition_time
            if tl <= 0:
                continue
            if tl >= ts[-1]:
                burned += cum[-1]
            else:
                burned += float(np.interp(tl, ts, cum))
        if self.ramjet is not None:
            burned += self.ramjet.fuel_used
        return max(self.total_propellant - burned, 0.0)

    # ── public API used by the simulation loop ──────────────────────────────
    def reset(self):
        """Re-arm for a fresh run (the ramjet fuel state is stateful)."""
        if self.ramjet is not None:
            self.ramjet.reset()

    def thrust(self, t: float, ambient_pressure: float, sea_level_pressure: float = 101325.0) -> float:
        """Solid-motor thrust [N] at time t with altitude pressure correction.

        (The ramjet contribution is state-dependent — the simulation loop adds
        it via :meth:`ramjet_thrust` which also consumes fuel.)
        """
        F = 0.0
        for s in self.stages:
            tl = t - s.ignition_time
            if 0.0 <= tl <= s.burn_time():
                Fv = s.vacuum_thrust(tl)
                if Fv > 0 and s.exit_area > 0:
                    # curve assumed sea-level referenced → add pressure term
                    Fv += (sea_level_pressure - ambient_pressure) * s.exit_area
                F += max(Fv, 0.0)
        return F

    def ramjet_thrust(self, t: float, dt: float, density: float,
                      speed: float, mach: float, terminal: bool = False) -> float:
        """Ramjet thrust this step [N]; advances the engine state & burns fuel.

        ``terminal`` lets the engine stop conserving fuel and restore endgame
        speed once the missile is in its terminal phase."""
        if self.ramjet is None:
            return 0.0
        return self.ramjet.update(t, dt, density, speed, mach, terminal=terminal)

    def is_thrusting(self, t: float) -> bool:
        if self.ramjet is not None and self.ramjet.burning():
            return True
        return any(s.ignition_time <= t <= s.ignition_time + s.burn_time()
                   and s.vacuum_thrust(t - s.ignition_time) > 0
                   for s in self.stages)

    def mass_properties(self, t: float) -> MassProperties:
        prop = self.propellant_remaining(t)
        frac = prop / self.total_propellant if self.total_propellant > 0 else 0.0
        mass = self.dry_mass + prop
        cg = self.cg_dry + (self.cg_wet - self.cg_dry) * frac
        Idiag = self.inertia_dry + (self.inertia_wet - self.inertia_dry) * frac
        inertia = np.diag(Idiag)
        return MassProperties(mass=mass, cg=cg, inertia=inertia)

    def burnout_time(self) -> float:
        """Last solid-motor burnout [s]. A ramjet's end-of-burn is fuel-state
        dependent and is tracked live via :meth:`is_thrusting`."""
        return max((s.ignition_time + s.burn_time() for s in self.stages), default=0.0)

    def summary(self) -> dict:
        return {
            "launch_mass": self.launch_mass,
            "dry_mass": self.dry_mass,
            "total_propellant": self.total_propellant,
            "total_impulse": sum(s.total_impulse() for s in self.stages),
            "burnout_time": self.burnout_time(),
            "ramjet": (None if self.ramjet is None else {
                "thrust_ref": self.ramjet.thrust_ref, "fuel": self.ramjet.fuel_mass,
                "isp": self.ramjet.isp, "mach_min": self.ramjet.mach_min,
                "mach_cruise": self.ramjet.mach_cruise}),
            "stages": [
                {"name": s.name, "ignition": s.ignition_time,
                 "burn_time": s.burn_time(), "impulse": s.total_impulse()}
                for s in self.stages
            ],
        }


def boost_sustain_curve(boost_thrust, boost_time, sustain_thrust, sustain_time,
                        n=6) -> List[Tuple[float, float]]:
    """Helper: build a boost→sustain thrust curve with a short taper."""
    curve = [(0.0, boost_thrust), (boost_time, boost_thrust)]
    if sustain_time > 0:
        curve.append((boost_time + 0.05, sustain_thrust))
        curve.append((boost_time + sustain_time, sustain_thrust))
        curve.append((boost_time + sustain_time + 0.05, 0.0))
    else:
        curve.append((boost_time + 0.05, 0.0))
    return curve
