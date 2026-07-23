"""
core.autopilot — acceleration autopilot + actuator dynamics.
============================================================

The guidance law asks for a lateral acceleration; the autopilot has to *make the
airframe produce it*. It does so by demanding an angle of attack (and sideslip),
driving fins to trim there through a first-order actuator with **rate and
deflection limits**, and returning the resulting body moments the 6-DOF EOM will
integrate. It also clamps the achievable acceleration to the structural G-limit
and to what dynamic pressure can supply.

Built-ins:
  * ``three_loop`` — classic 3-loop accel autopilot (accel → rate → fin) with
    actuator lag; the standard tactical-missile controller.
  * ``ideal`` — a debug controller that instantly points the lift vector
    (no lag) for validating guidance in isolation.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from core.registry import register, Autopilot
from core.atmosphere import G0


@dataclass
class AutopilotOutput:
    body_moment: np.ndarray     # commanded moment about CG, body frame [N·m]
    fin_deflection: np.ndarray  # [pitch, yaw] fin angle actually achieved [rad]
    accel_command_g: float      # requested |a| in g (pre-limit, for telemetry)
    accel_limited_g: float      # limit actually applied [g]
    alpha_command: float        # commanded total AoA [rad]


def _clamp(x, lo, hi):
    return max(lo, min(hi, x))


@register("autopilot", "three_loop", label="3-Loop Accel Autopilot",
          description="Accel→rate→fin loops with actuator lag, rate & deflection limits.")
class ThreeLoopAutopilot(Autopilot):
    """Skid-to-turn 3-loop autopilot.

    Parameters
    ----------
    max_fin_deg          : max fin deflection [deg]
    fin_rate_deg_s       : actuator slew-rate limit [deg/s]
    actuator_tau         : actuator first-order time constant [s]
    max_g                : structural acceleration limit [g]
    k_accel, k_rate      : outer/inner loop gains
    """
    def __init__(self,
                 max_fin_deg=25.0,
                 fin_rate_deg_s=350.0,
                 actuator_tau=0.02,
                 max_g=40.0,
                 att_kp=45.0,
                 att_kd=11.0,
                 cm_delta=6.0,
                 alpha_max_deg=28.0,
                 **kw):
        super().__init__(**kw)
        self.max_fin = np.radians(max_fin_deg)
        self.fin_rate = np.radians(fin_rate_deg_s)
        self.tau = actuator_tau
        self.max_g = max_g
        self.att_kp = att_kp            # attitude-loop stiffness  (≈ ω_n²)
        self.att_kd = att_kd            # attitude-loop rate damping
        self.cm_delta = cm_delta        # fin control-moment effectiveness /rad
        self.alpha_max = np.radians(alpha_max_deg)
        self.reset()

    def reset(self):
        self._fin = np.zeros(2)  # [pitch(δq), yaw(δr)] achieved deflection

    def update(self, a_cmd, missile, atmo, dt) -> AutopilotOutput:
        """a_cmd : desired accel vector, inertial NED [m/s²] (⟂-ish to LOS).

        Strategy (frame-consistent, no per-axis sign juggling):
          1. project a_cmd perpendicular to velocity → the lift we must make;
          2. G-limit it (structural + what dynamic pressure can supply);
          3. convert magnitude → required total AoA, and build the *desired nose
             direction* = velocity tilted toward the lift by that AoA;
          4. an attitude PD law commands the body moment that rotates the real
             nose onto the desired nose (gyroscopic term feed-forward);
          5. that moment is realised through fins with actuator lag + rate and
             deflection limits, and the achieved fin moment is returned.
        """
        vel = missile.velocity
        speed = max(missile.speed, 1e-3)
        vhat = vel / speed

        # ---- (1) lift we need = a_cmd component ⟂ velocity ------------------
        a_perp = a_cmd - np.dot(a_cmd, vhat) * vhat
        a_mag = float(np.linalg.norm(a_perp))
        accel_cmd_g = a_mag / G0

        # ---- (2) G limiting: structural and aerodynamic ---------------------
        a_avail = self._max_available_accel(missile, atmo)
        a_limit = min(self.max_g * G0, a_avail)
        if a_mag > a_limit and a_mag > 1e-6:
            a_perp *= a_limit / a_mag
            a_mag = a_limit
        accel_lim_g = a_mag / G0
        lift_hat = a_perp / a_mag if a_mag > 1e-6 else np.zeros(3)

        # ---- (3) required AoA and desired nose direction --------------------
        # Lateral force comes from aero normal force q·S·CNα·α AND from the
        # lateral component of thrust T·sin(α) ≈ T·α. The thrust term is what
        # lets a boosting missile vector at low dynamic pressure — the physics
        # behind a vertical-launch SAM's pitch-over (jet-vane/TVC equivalent).
        q_dyn = min(0.5 * atmo.density * speed * speed, 320000.0)
        Sref = missile.reference_area
        cna = missile.aero.cn_alpha(atmo.mach(speed))
        thrust = max(getattr(missile, "_thrust_now", 0.0), 0.0)
        denom = max(q_dyn * Sref * cna + thrust, 1e-3)
        alpha_cmd = _clamp(a_mag * missile.mass / denom, 0.0, self.alpha_max)
        desired_nose = np.cos(alpha_cmd) * vhat + np.sin(alpha_cmd) * lift_hat
        dn = np.linalg.norm(desired_nose)
        if dn > 1e-9:
            desired_nose = desired_nose / dn

        # ---- (4) attitude PD → commanded body moment ------------------------
        R_ib = missile.rotation_matrix()          # inertial ← body
        nose = R_ib @ np.array([1.0, 0.0, 0.0])
        err_inertial = np.cross(nose, desired_nose)   # axis·sin(angle), inertial
        err_body = R_ib.T @ err_inertial              # into body frame
        omega = missile.omega_body
        ang_accel_cmd = self.att_kp * err_body - self.att_kd * omega
        I = missile.inertia
        gyro = np.cross(omega, I @ omega)             # feed-forward
        M_cmd = I @ ang_accel_cmd + gyro

        # ---- (5) moment → fin command → actuator lag/limits → real moment ---
        d = missile.diameter
        fin_gain = max(q_dyn * Sref * d * self.cm_delta, 1e-3)
        fin_cmd = np.clip(np.array([M_cmd[1], M_cmd[2]]) / fin_gain,
                          -self.max_fin, self.max_fin)
        # first-order actuator toward the command, then slew-rate clamp
        target = self._fin + (fin_cmd - self._fin) * min(dt / self.tau, 1.0)
        delta = np.clip(target - self._fin, -self.fin_rate * dt, self.fin_rate * dt)
        self._fin = np.clip(self._fin + delta, -self.max_fin, self.max_fin)

        My = fin_gain * self._fin[0]
        Mz = fin_gain * self._fin[1]
        Mx = -0.05 * q_dyn * Sref * d * omega[0]      # roll damping only
        body_moment = np.array([Mx, My, Mz])

        return AutopilotOutput(
            body_moment=body_moment,
            fin_deflection=self._fin.copy(),
            accel_command_g=accel_cmd_g,
            accel_limited_g=accel_lim_g,
            alpha_command=alpha_cmd,
        )

    def _max_available_accel(self, missile, atmo):
        """Max lateral accel the airframe can generate [m/s²]: aerodynamic
        normal force at max AoA plus the lateral thrust component at max AoA
        (thrust-borne lift — dominant during a low-speed boost/pitch-over)."""
        q_dyn = min(0.5 * atmo.density * missile.speed ** 2, 320000.0)
        cna = missile.aero.cn_alpha(atmo.mach(missile.speed))
        alpha_max = np.radians(25.0)
        force = (q_dyn * missile.reference_area * cna * alpha_max
                 + max(getattr(missile, "_thrust_now", 0.0), 0.0) * np.sin(alpha_max))
        return force / max(missile.mass, 1e-3)


@register("autopilot", "ideal", label="Ideal (no-lag, debug)",
          description="Instantly aligns the lift vector; for isolating guidance.")
class IdealAutopilot(Autopilot):
    def __init__(self, max_g=40.0, **kw):
        super().__init__(**kw)
        self.max_g = max_g

    def update(self, a_cmd, missile, atmo, dt) -> AutopilotOutput:
        a_mag = np.linalg.norm(a_cmd)
        lim = self.max_g * G0
        acc = a_cmd * (lim / a_mag) if a_mag > lim and a_mag > 1e-9 else a_cmd
        # ideal AP short-circuits attitude: simulation applies a_cmd directly.
        missile._ideal_accel = acc
        return AutopilotOutput(np.zeros(3), np.zeros(2),
                               a_mag / G0, np.linalg.norm(acc) / G0, 0.0)
