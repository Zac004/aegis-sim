"""
core.entities — the rigid bodies in an engagement (Missile, Target).
====================================================================

State vector conventions (documented once, shared by dynamics/integrator/sim):

  Missile state, packed length 13:
      [0:3]   position   (inertial NED, m)
      [3:6]   velocity   (inertial NED, m/s)
      [6:10]  quaternion (body→inertial, [w,x,y,z], unit)
      [10:13] body rates (p, q, r) (body frame, rad/s)
  Mass, CG and inertia are NOT integrated — they are deterministic functions of
  time via `core.propulsion`, refreshed each step.

  Target state, packed length 6:
      [0:3]   position (NED, m)
      [3:6]   velocity (NED, m/s)
  The target is a steered point-mass; its acceleration comes from the maneuver
  timeline (already includes its own g-loading).

All angles internal are radians; all distances metres; all times seconds.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional

import numpy as np


# ─────────────────────────────────────────────────────────────────────────────
#  Quaternion helpers  (q = [w, x, y, z], body→inertial, unit)
# ─────────────────────────────────────────────────────────────────────────────

def quat_normalize(q):
    n = np.linalg.norm(q)
    return q / n if n > 1e-12 else np.array([1.0, 0.0, 0.0, 0.0])


def quat_to_matrix(q):
    """Rotation matrix R such that v_inertial = R @ v_body."""
    w, x, y, z = q
    return np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - w * z),     2 * (x * z + w * y)],
        [2 * (x * y + w * z),     1 - 2 * (x * x + z * z), 2 * (y * z - w * x)],
        [2 * (x * z - w * y),     2 * (y * z + w * x),     1 - 2 * (x * x + y * y)],
    ])


def quat_mul(a, b):
    aw, ax, ay, az = a
    bw, bx, by, bz = b
    return np.array([
        aw * bw - ax * bx - ay * by - az * bz,
        aw * bx + ax * bw + ay * bz - az * by,
        aw * by - ax * bz + ay * bw + az * bx,
        aw * bz + ax * by - ay * bx + az * bw,
    ])


def quat_derivative(q, omega_body):
    """q̇ = ½ q ⊗ [0, ω]."""
    return 0.5 * quat_mul(q, np.array([0.0, *omega_body]))


def quat_from_euler(roll, pitch, yaw):
    """ZYX (yaw-pitch-roll) Euler → quaternion (body→inertial)."""
    cr, sr = np.cos(roll / 2), np.sin(roll / 2)
    cp, sp = np.cos(pitch / 2), np.sin(pitch / 2)
    cy, sy = np.cos(yaw / 2), np.sin(yaw / 2)
    return quat_normalize(np.array([
        cr * cp * cy + sr * sp * sy,
        sr * cp * cy - cr * sp * sy,
        cr * sp * cy + sr * cp * sy,
        cr * cp * sy - sr * sp * cy,
    ]))


def quat_to_euler(q):
    """Quaternion → (roll, pitch, yaw) radians, ZYX convention."""
    w, x, y, z = q
    roll = np.arctan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y))
    s = 2 * (w * y - z * x)
    pitch = np.arcsin(np.clip(s, -1.0, 1.0))
    yaw = np.arctan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z))
    return roll, pitch, yaw


def quat_from_velocity(v_ned, roll=0.0):
    """Build an attitude whose body-x points along a velocity vector."""
    v = np.asarray(v_ned, float)
    n = np.linalg.norm(v)
    if n < 1e-9:
        return np.array([1.0, 0.0, 0.0, 0.0])
    fwd = v / n
    yaw = np.arctan2(fwd[1], fwd[0])
    pitch = np.arctan2(-fwd[2], np.hypot(fwd[0], fwd[1]))
    return quat_from_euler(roll, pitch, yaw)


# ─────────────────────────────────────────────────────────────────────────────
#  Missile
# ─────────────────────────────────────────────────────────────────────────────

class Missile:
    """Rigid-body interceptor with attached GNC models.

    Holds live state plus references to the models that produce forces/moments.
    Derived quantities (mass, speed, alpha, beta, inertia) are refreshed each
    step by :meth:`refresh` before the controllers run.
    """
    def __init__(self, name, propulsion, aero, seeker, guidance, autopilot,
                 length, diameter, reference_area=None, max_g=40.0):
        self.name = name
        self.propulsion = propulsion
        self.aero = aero
        self.seeker = seeker
        self.guidance = guidance
        self.autopilot = autopilot
        self.length = length
        self.diameter = diameter
        self.reference_area = reference_area or (np.pi * (diameter / 2) ** 2)
        self.max_g = max_g
        self.visual = None   # {sprite, color, accent} — set by templates
        self.datalink_capable = True   # active-radar/SARH: yes; IR fire-and-forget: no
        self.loft_gain = 1.0           # midcourse energy-loft strength (0 = none)
        self.battery_s = 90.0          # fin/guidance battery life [s] → then ballistic
        self.max_mach = 5.5            # structural/thermal airframe Mach limit
        self.ceiling_m = 24000.0       # max useful loft apogee (thin-air control limit)
        self._thrust_now = 0.0         # current total thrust [N] (autopilot reads it)

        # state
        self.position = np.zeros(3)
        self.velocity = np.zeros(3)
        self.quat = np.array([1.0, 0.0, 0.0, 0.0])
        self.omega_body = np.zeros(3)
        self.launch_position = np.zeros(3)

        # derived (refreshed each step)
        self.mass = propulsion.launch_mass
        self.inertia = propulsion.mass_properties(0.0).inertia
        self.speed = 0.0
        self.alpha = 0.0
        self.beta = 0.0
        self._ideal_accel = None  # set by the ideal autopilot

    # ── packing for the integrator ───────────────────────────────────────────
    def get_state(self):
        return np.concatenate([self.position, self.velocity, self.quat, self.omega_body])

    def set_state(self, s):
        self.position = s[0:3]
        self.velocity = s[3:6]
        self.quat = quat_normalize(s[6:10])
        self.omega_body = s[10:13]

    # ── geometry helpers ─────────────────────────────────────────────────────
    def rotation_matrix(self):
        return quat_to_matrix(self.quat)

    def forward_inertial(self):
        """Unit nose direction (body-x) in the inertial frame."""
        return quat_to_matrix(self.quat) @ np.array([1.0, 0.0, 0.0])

    def altitude(self):
        return -self.position[2]  # NED: down is +z, altitude is −z

    # ── refresh derived quantities before controllers run ─────────────────────
    def refresh(self, t):
        mp = self.propulsion.mass_properties(t)
        self.mass = mp.mass
        self.inertia = mp.inertia
        self.speed = float(np.linalg.norm(self.velocity))
        if self.speed > 1e-3:
            R = self.rotation_matrix()
            v_body = R.T @ self.velocity
            u = v_body[0]
            self.alpha = float(np.arctan2(v_body[2], u if abs(u) > 1e-6 else 1e-6))
            self.beta = float(np.arcsin(np.clip(v_body[1] / self.speed, -1, 1)))
        else:
            self.alpha = self.beta = 0.0


# ─────────────────────────────────────────────────────────────────────────────
#  Target
# ─────────────────────────────────────────────────────────────────────────────

class Target:
    """Steered point-mass target (aircraft / decoy) with signatures & CMs."""
    def __init__(self, name, timeline, rcs=5.0, ir_signature=1.0,
                 max_g=9.0, min_speed=120.0, max_speed=700.0, platform_type="fighter"):
        self.name = name
        self.timeline = timeline
        self.rcs = rcs
        self.ir_signature = ir_signature
        self.max_g = max_g
        self.min_speed = min_speed
        self.max_speed = max_speed
        self.platform_type = platform_type
        self.visual = None   # {sprite, color, accent} — set by templates

        self.position = np.zeros(3)
        self.velocity = np.zeros(3)
        self.accel_cmd = np.zeros(3)   # last commanded accel (for APN feed-fwd)
        self.active_countermeasures: List[dict] = []
        self._cm_timers: List[dict] = []

    def get_state(self):
        return np.concatenate([self.position, self.velocity])

    def set_state(self, s):
        self.position = s[0:3]
        self.velocity = s[3:6]

    def altitude(self):
        return -self.position[2]

    def speed(self):
        return float(np.linalg.norm(self.velocity))

    def update_countermeasures(self, t, released):
        """Register newly released CMs and age out expired ones."""
        for cm in released:
            expiry = t + cm.get("duration", 4.0)
            self._cm_timers.append({**cm, "expiry": expiry})
        self._cm_timers = [c for c in self._cm_timers if c["expiry"] > t]
        self.active_countermeasures = self._cm_timers


# ─────────────────────────────────────────────────────────────────────────────
#  Shooter (launch aircraft) — provides midcourse datalink to the missile
# ─────────────────────────────────────────────────────────────────────────────

class Shooter:
    """The launching aircraft. Its radar tracks the target and datalinks the
    track to the missile during midcourse (before the missile's own seeker goes
    active). It flies a simple support profile and can 'crank' to open range
    while keeping the target inside its radar gimbal.

    radar_gimbal   : half-angle the shooter's radar can look off its nose [rad]
    radar_range    : max range the shooter can hold a target track [m]
    datalink_range : max shooter→missile range the datalink reaches [m]
    support        : 'straight' (hold heading) | 'crank' (turn to gimbal edge) |
                     'notch' (turn cold, drops track — models a bad supporter)
    """
    def __init__(self, name, position, velocity, radar_gimbal_deg=60.0,
                 radar_range=140000.0, datalink_range=180000.0, support="straight",
                 crank_angle_deg=45.0, platform_type="fighter", visual=None):
        self.name = name
        self.position = np.asarray(position, float)
        self.velocity = np.asarray(velocity, float)
        self.radar_gimbal = np.radians(radar_gimbal_deg)
        self.radar_range = radar_range
        self.datalink_range = datalink_range
        self.support = support
        self.crank_angle = np.radians(crank_angle_deg)
        self.platform_type = platform_type
        self.visual = visual
        self._v0 = self.velocity.copy()

    def altitude(self):
        return -self.position[2]

    def nose(self):
        n = np.linalg.norm(self.velocity)
        return self.velocity / n if n > 1e-6 else np.array([1.0, 0.0, 0.0])

    def boresight_to(self, point):
        """Angle from shooter nose to a point [rad]."""
        los = np.asarray(point, float) - self.position
        d = np.linalg.norm(los)
        if d < 1e-6:
            return 0.0
        return float(np.arccos(np.clip(np.dot(los / d, self.nose()), -1.0, 1.0)))

    def tracks(self, target_position):
        """True if the target is inside the shooter's radar gimbal + range."""
        los = np.asarray(target_position, float) - self.position
        rng = np.linalg.norm(los)
        return rng <= self.radar_range and self.boresight_to(target_position) <= self.radar_gimbal

    def update(self, t, dt, target_position, launched_active=False):
        """Advance the shooter one step per its support profile (const speed)."""
        speed = np.linalg.norm(self._v0)
        if self.support == "notch" and not launched_active:
            # bad supporter: turns cold immediately → radar gimbal breaks →
            # datalink drops and the missile goes inertial (teaching case)
            los = np.asarray(target_position, float) - self.position
            los[2] = 0.0
            ln = np.linalg.norm(los)
            if ln > 1e-6:
                away = -los / ln
                hd = np.array([self.velocity[0], self.velocity[1], 0.0])
                hn = np.linalg.norm(hd)
                if hn > 1e-6:
                    hd /= hn
                    new = hd + 0.8 * dt * (away - hd)
                    new /= np.linalg.norm(new)
                    self.velocity[:2] = new[:2] * speed
        elif self.support == "crank" and not launched_active:
            # rotate velocity toward the gimbal edge relative to the target LOS,
            # opening range while keeping the target trackable
            los = np.asarray(target_position, float) - self.position
            los[2] = 0.0
            ln = np.linalg.norm(los)
            if ln > 1e-6:
                los /= ln
                desired = self.crank_angle
                # current horizontal heading
                hd = np.array([self.velocity[0], self.velocity[1], 0.0])
                hn = np.linalg.norm(hd)
                if hn > 1e-6:
                    hd /= hn
                    # blend heading toward crank_angle off the LOS (turn away side)
                    perp = np.array([-los[1], los[0], 0.0])
                    if np.dot(perp, hd) < 0:
                        perp = -perp
                    target_dir = (np.cos(desired) * los + np.sin(desired) * perp)
                    target_dir /= np.linalg.norm(target_dir)
                    new = hd + 0.6 * dt * (target_dir - hd)
                    new /= np.linalg.norm(new)
                    self.velocity = np.array([new[0], new[1], self.velocity[2] / max(speed, 1e-6) * speed]) * speed
                    self.velocity[:2] = new[:2] * speed
        self.position = self.position + self.velocity * dt
