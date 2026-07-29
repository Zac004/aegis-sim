"""
core.dynamics — 6-DOF rigid-body equations of motion.
=====================================================

Given a missile state and the *controls held constant over the step* (thrust and
the autopilot's commanded control moment), this computes the state derivative:

  Translational (inertial NED):
      m·v̇ = F_thrust + F_aero + F_gravity
      F_thrust  = R(q) · [T, 0, 0]                 (along body-x)
      F_aero    = −q̄·S·Cd·v̂        (drag, opposing airspeed)
                  + q̄·S·Cl·n̂        (lift, curving velocity toward the nose)
      F_gravity = m·[0, 0, g]                       (NED, +Down)

  Rotational (body frame):
      I·ω̇ = M_control + M_static + M_damp − ω × (I·ω)
      M_static = weathercock moment ∝ Cm_α·α  (restores nose toward velocity)
      M_damp   = pitch/yaw/roll rate damping

  Attitude:  q̇ = ½ q ⊗ [0, ω]

The lift direction n̂ is the component of the nose (body-x) perpendicular to the
airspeed, normalised — a frame-independent way to say "lift pulls the velocity
vector toward where the missile is pointing", with magnitude set by total AoA.
This is what couples attitude (set by the fins) to the trajectory.
"""

from __future__ import annotations

import numpy as np

from core.entities import quat_to_matrix, quat_derivative, quat_normalize
from core.atmosphere import G0, gravity


# structural max dynamic pressure [Pa]. Real tactical missiles are limited to
# ~200–350 kPa; beyond this the airframe fails. Also bounds the stiff sea-level
# high-speed regime so the fixed-step integrator stays stable.
QDYN_MAX = 320000.0


def _unit(v):
    n = np.linalg.norm(v)
    return v / n if n > 1e-9 else np.zeros(3)


def missile_derivative(state, missile, atmo_model, thrust, control_moment, t):
    """Return d(state)/dt for the 13-element missile state.

    `thrust` (scalar, N) and `control_moment` (body-frame N·m, from the
    autopilot) are held constant across the RK4 sub-steps (zero-order hold); all
    state-dependent aero forces/moments are recomputed here each sub-step.
    """
    pos = state[0:3]
    vel = state[3:6]
    q = quat_normalize(state[6:10])
    omega = state[10:13]

    R = quat_to_matrix(q)               # inertial ← body
    nose = R @ np.array([1.0, 0.0, 0.0])

    speed = np.linalg.norm(vel)
    alt = -pos[2]
    atmo = atmo_model.sample(alt)
    mass = missile.mass
    Sref = missile.reference_area
    d = missile.diameter

    # ── total angle of attack (nose vs velocity) ─────────────────────────────
    if speed > 1e-3:
        vhat = vel / speed
        cos_a = np.clip(np.dot(nose, vhat), -1.0, 1.0)
        alpha_total = np.arccos(cos_a)
        nose_perp = nose - cos_a * vhat
        n_hat = _unit(nose_perp)         # lift direction
    else:
        vhat = np.zeros(3)
        alpha_total = 0.0
        n_hat = np.zeros(3)

    mach = atmo.mach(speed)
    coeffs = missile.aero.coefficients(mach, alpha_total)

    # dynamic pressure, capped at a structural max-Q. Beyond this a real airframe
    # is torn apart anyway; the cap also keeps the stiff low-altitude/high-speed
    # regime numerically stable (prevents integrator blow-up).
    q_dyn = min(0.5 * atmo.density * speed * speed, QDYN_MAX)

    # ── forces (inertial) ────────────────────────────────────────────────────
    F_thrust = thrust * nose
    F_drag = -q_dyn * Sref * coeffs.cd * vhat
    F_lift = q_dyn * Sref * coeffs.cl * n_hat
    # inverse-square gravity: a lofted shot spends minutes above 20 km, where g is
    # ~0.7% weaker — small per step, but it biases the whole ballistic arc.
    F_grav = np.array([0.0, 0.0, mass * gravity(alt)])
    F_total = F_thrust + F_drag + F_lift + F_grav
    accel = F_total / max(mass, 1e-6)

    # ── moments (body frame) ─────────────────────────────────────────────────
    # static (weathercock) restoring moment: proportional to AoA, acts to reduce
    # it. Build it about the body axes from the body-frame airspeed direction.
    v_body = R.T @ vel
    if speed > 1e-3:
        a_pitch = np.arctan2(v_body[2], v_body[0])   # AoA
        a_yaw = np.arctan2(v_body[1], v_body[0])     # sideslip
    else:
        a_pitch = a_yaw = 0.0

    cm_alpha = getattr(missile.aero, "cm_alpha0", -0.28)
    # restoring: negative Cm_alpha × alpha gives a nose-toward-velocity moment
    M_static = q_dyn * Sref * d * cm_alpha * np.array([0.0, a_pitch, a_yaw])

    # rate damping (all axes) — scaled by dynamic pressure and length
    cm_q = getattr(missile.aero, "cm_q", -180.0)
    damp_ref = q_dyn * Sref * d * (d / max(2 * speed, 1.0))
    M_damp = damp_ref * cm_q * np.array([0.15, 1.0, 1.0]) * omega

    M_total = control_moment + M_static + M_damp

    # Euler's rotational equation:  I ω̇ = M − ω × (I ω).
    # Inertia is diagonal (Ixx roll, Iyy pitch, Izz yaw), so invert element-wise
    # instead of a 3×3 solve — this is the hot path (called 4×/step).
    Idiag = missile.inertia.diagonal()
    Iw = Idiag * omega
    omega_dot = (M_total - np.cross(omega, Iw)) / Idiag

    q_dot = quat_derivative(q, omega)

    return np.concatenate([vel, accel, q_dot, omega_dot])


def missile_derivative_ideal(state, missile, atmo_model, thrust, accel_cmd, t):
    """Point-mass derivative used by the *ideal* (no-lag) autopilot path.

    The commanded lateral acceleration is applied directly (plus thrust along
    velocity, drag, gravity), bypassing attitude dynamics — for validating
    guidance laws in isolation.
    """
    pos = state[0:3]
    vel = state[3:6]
    speed = np.linalg.norm(vel)
    vhat = vel / speed if speed > 1e-3 else np.zeros(3)
    alt = -pos[2]
    atmo = atmo_model.sample(alt)
    mach = atmo.mach(speed)
    coeffs = missile.aero.coefficients(mach, 0.0)
    q_dyn = 0.5 * atmo.density * speed * speed
    F_drag = -q_dyn * missile.reference_area * coeffs.cd * vhat
    F_thrust = thrust * vhat
    F_grav = np.array([0.0, 0.0, missile.mass * gravity(alt)])
    accel = (F_thrust + F_drag + F_grav) / max(missile.mass, 1e-6) + accel_cmd
    # keep attitude roughly aligned with velocity for display
    q_dot = np.zeros(4)
    omega_dot = np.zeros(3)
    return np.concatenate([vel, accel, q_dot, omega_dot])


def target_derivative(state, accel_cmd, gravity=False):
    """Point-mass target derivative. `accel_cmd` is the maneuver command (NED)."""
    vel = state[3:6]
    accel = np.array(accel_cmd, dtype=float)
    if gravity:
        accel = accel + np.array([0.0, 0.0, G0])
    return np.concatenate([vel, accel])
