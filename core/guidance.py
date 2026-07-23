"""
core.guidance — guidance laws (the "how do I steer" brain).
===========================================================

Each law returns a commanded acceleration vector (inertial NED, m/s²) that is
perpendicular-ish to the line of sight; the autopilot then realises it. All laws
receive a :class:`GuidanceContext` populated by the simulation each step from the
seeker measurement and the missile state.

Implemented built-ins:
  * ``pn``     True Proportional Navigation:  a = N · Vc · ω_LOS × û_LOS
  * ``pure_pn``Pure PN referenced to the missile velocity vector.
  * ``apn``    Augmented PN: adds N/2 · a_target (target-accel feed-forward).
  * ``ogl``    Optimal Guidance Law: finite-time optimal w/ target-accel & lead.
  * ``clos``   Command To Line-Of-Sight (beam-riding style) for SAM/command link.

The LOS rotation vector ω is computed as  ω = (R × V_rel) / |R|²  which is the
standard relative-kinematics form and avoids differentiating a noisy angle.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from core.registry import register, GuidanceLaw


@dataclass
class GuidanceContext:
    """Everything a guidance law might need, assembled each timestep."""
    t: float
    r_rel: np.ndarray          # target - missile position, NED [m]
    v_rel: np.ndarray          # target - missile velocity, NED [m/s]
    los_unit: np.ndarray       # unit LOS (missile→target)
    los_rate_vec: np.ndarray   # LOS angular-rate vector ω [rad/s]
    closing_speed: float       # -d|R|/dt  [m/s]  (positive = closing)
    range: float               # |R| [m]
    missile_vel: np.ndarray    # NED [m/s]
    missile_speed: float
    target_accel: np.ndarray   # estimated target accel, NED [m/s²]
    gravity: np.ndarray        # NED gravity vector [m/s²]
    N: float                   # navigation constant (gain)
    locked: bool               # seeker has a valid track


def _safe_unit(v):
    n = np.linalg.norm(v)
    return v / n if n > 1e-9 else np.zeros(3)


@register("guidance", "pn", label="True Proportional Navigation (TPN)",
          description="a = N·Vc·(ω × û_LOS). The workhorse homing law.")
class TrueProportionalNavigation(GuidanceLaw):
    """True PN: acceleration ⟂ LOS, magnitude N·Vc·λ̇."""
    def command(self, ctx: GuidanceContext) -> np.ndarray:
        if not ctx.locked:
            return np.zeros(3)
        # a_cmd = N * Vc * (ω_LOS × û_LOS)
        return ctx.N * ctx.closing_speed * np.cross(ctx.los_rate_vec, ctx.los_unit)


@register("guidance", "pure_pn", label="Pure PN (velocity-referenced)",
          description="Commands normal to missile velocity: a = N·|Vm|·ω × û_v.")
class PurePN(GuidanceLaw):
    def command(self, ctx: GuidanceContext) -> np.ndarray:
        if not ctx.locked:
            return np.zeros(3)
        vhat = _safe_unit(ctx.missile_vel)
        return ctx.N * ctx.missile_speed * np.cross(ctx.los_rate_vec, vhat)


@register("guidance", "apn", label="Augmented PN (APN)",
          description="TPN + N/2·a_target feed-forward — beats maneuvering targets.")
class AugmentedPN(GuidanceLaw):
    def command(self, ctx: GuidanceContext) -> np.ndarray:
        if not ctx.locked:
            return np.zeros(3)
        base = ctx.N * ctx.closing_speed * np.cross(ctx.los_rate_vec, ctx.los_unit)
        # project target accel perpendicular to LOS and add half of it × N
        at = ctx.target_accel
        at_perp = at - np.dot(at, ctx.los_unit) * ctx.los_unit
        return base + 0.5 * ctx.N * at_perp


@register("guidance", "ogl", label="Optimal Guidance Law (OGL)",
          description="Finite-time optimal: lead + target-accel + gravity comp.")
class OptimalGuidance(GuidanceLaw):
    """Optimal guidance for a lag-free missile against a maneuvering target.

    a = (N'/t_go²)·[ ZEM ]  where ZEM (zero-effort miss) accounts for relative
    position, relative velocity and target acceleration over the remaining
    time-to-go. Gravity is compensated so the biased command flies a straighter
    path. N' ≈ 3 recovers PN in the limit.
    """
    def command(self, ctx: GuidanceContext) -> np.ndarray:
        if not ctx.locked or ctx.closing_speed <= 1e-3:
            return np.zeros(3)
        t_go = ctx.range / max(ctx.closing_speed, 1e-3)
        t_go = max(t_go, 1e-2)
        # zero-effort miss with target maneuver term
        zem = ctx.r_rel + ctx.v_rel * t_go + 0.5 * ctx.target_accel * t_go ** 2
        zem_perp = zem - np.dot(zem, ctx.los_unit) * ctx.los_unit
        Nprime = ctx.N
        a = Nprime * zem_perp / (t_go ** 2)
        return a - ctx.gravity   # gravity compensation


@register("guidance", "clos", label="Command To Line-Of-Sight (CLOS)",
          description="Beam-riding: null the missile's offset from the launcher→target line.")
class CommandLineOfSight(GuidanceLaw):
    """CLOS / three-point guidance.

    Steers the missile back onto the straight line joining the launcher origin
    and the target. Needs the launch point, injected by the simulation via
    ``ctx``'s missile state and a stored origin. Uses a PD law on cross-track
    offset. (For SAM / command-link engagements.)
    """
    def __init__(self, kp=16.0, kd=7.5, **kw):
        super().__init__(**kw)
        self.kp = kp
        self.kd = kd
        self.origin = None  # set on reset by simulation
        self._prev_beam = None
        self._prev_t = None

    def reset(self):
        self.origin = None
        self._prev_beam = None
        self._prev_t = None

    def command(self, ctx: GuidanceContext) -> np.ndarray:
        if not ctx.locked:
            return np.zeros(3)
        if self.origin is None:
            # simulation stores launcher origin on the context's missile start;
            # fall back to treating current closing geometry like PN.
            return ctx.N * ctx.closing_speed * np.cross(ctx.los_rate_vec, ctx.los_unit)
        # beam direction from launcher to target
        beam = _safe_unit((ctx.r_rel + (ctx.missile_pos - self.origin))
                          if hasattr(ctx, "missile_pos") else ctx.los_unit)
        # offset of missile from the beam line
        m_off = getattr(ctx, "missile_pos", np.zeros(3)) - self.origin
        cross = m_off - np.dot(m_off, beam) * beam
        v_perp = ctx.missile_vel - np.dot(ctx.missile_vel, beam) * beam
        # The beam ROTATES as the target moves, so riding it at radius r demands
        # a matching lateral velocity r·ω — damping raw v_perp would fight that
        # and leave a standing error kd·r·ω/kp (tens of metres!). Damp only the
        # velocity error *relative to the sweeping beam*, and feed forward the
        # Coriolis acceleration 2·v_along·ω the rotation demands.
        a_ff = np.zeros(3)
        if self._prev_beam is not None and ctx.t > (self._prev_t or 0.0):
            dtb = ctx.t - self._prev_t
            omega_beam = np.cross(self._prev_beam, beam) / max(dtb, 1e-4)
            beam_sweep_vel = np.cross(omega_beam, m_off)     # beam-line velocity at our radius
            v_perp = v_perp - (beam_sweep_vel - np.dot(beam_sweep_vel, beam) * beam)
            v_along = float(np.dot(ctx.missile_vel, beam))
            a_ff = 2.0 * v_along * np.cross(omega_beam, beam)
        self._prev_beam = beam
        self._prev_t = ctx.t
        return -self.kp * cross - self.kd * v_perp + a_ff
