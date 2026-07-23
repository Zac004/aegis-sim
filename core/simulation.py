"""
core.simulation — the engagement runner.
========================================

Drives one missile-vs-target engagement to termination and returns a rich
telemetry record. The per-step loop:

    refresh mass/derived → sample atmosphere → seeker.measure → guidance.command
    → autopilot.update → RK4-integrate missile → step target (maneuver timeline
    + countermeasures) → record telemetry → test termination.

Termination is decided by a continuous closest-approach test (so a Mach-4
fly-through isn't missed between discrete steps), plus ground impact, loss of
energy, and timeout.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import numpy as np

from core.entities import Missile, Target, quat_to_euler
from core.guidance import GuidanceContext
from core.seeker import SeekerMeasurement
from core.dynamics import (missile_derivative, missile_derivative_ideal,
                           target_derivative)
from core.integrator import rk4_step
from core.atmosphere import G0
from core.templates import Scenario


# ─────────────────────────────────────────────────────────────────────────────
#  Result container
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class TelemetryResult:
    outcome: str                       # "HIT" | "MISS" | "GROUND" | "TIMEOUT" | "LOST_ENERGY"
    miss_distance: float               # m at closest approach
    time_of_flight: float              # s
    channels: Dict[str, List]          # named time-series (downsampled)
    events: List[Dict]                 # discrete events (launch, CM release, lock changes)
    summary: Dict[str, Any]            # scalar KPIs

    def to_dict(self) -> Dict[str, Any]:
        return {
            "outcome": self.outcome,
            "miss_distance": self.miss_distance,
            "time_of_flight": self.time_of_flight,
            "channels": self.channels,
            "events": self.events,
            "summary": self.summary,
        }


# ─────────────────────────────────────────────────────────────────────────────
#  Midcourse shaper — PIP navigation with energy loft & SAM pitch-over
# ─────────────────────────────────────────────────────────────────────────────

class MidcourseShaper:
    """PIP-referenced midcourse steering with energy management (the loft).

    Real BVR weapons do not home during midcourse — they fly INS toward a
    *predicted intercept point* (PIP) refreshed by the shooter's datalink,
    shaping the vertical profile to manage energy: climb into thin high air,
    cruise near apogee, then dive onto the PIP as the seeker takes over.
    Vertically-launched SAMs additionally pitch over onto that same profile
    right off the rail. This module owns the whole midcourse acceleration
    command; the terminal law (PN/APN/OGL) takes over at seeker-active.

    Only weapons that really fly a shaped midcourse get this behaviour: the
    simulation gates it on a midcourse datalink + a predictive guidance law
    (APN/OGL) + a non-zero template ``loft``. Pure-PN/CLOS/IR fire-and-forget
    weapons never loft — they home (or coast) exactly as their guidance allows.
    """

    def __init__(self, missile, ceiling_m: float):
        self.m = missile
        self.loft = float(np.clip(getattr(missile, "loft_gain", 0.0), 0.0, 3.0))
        self.ceiling = float(ceiling_m)
        self.R0 = None            # horizontal range to first PIP → sizes the loft
        self.apogee = None

    def command(self, tgt_pos, tgt_vel, meas, rng) -> np.ndarray:
        m = self.m
        sp = max(m.speed, 1.0)
        # time-to-go from closure (floored so a slow launch still gets a lead)
        closing = max(meas.closing_speed, 0.30 * sp, 30.0)
        t_go = float(np.clip(rng / closing, 0.5, 400.0))
        pip = tgt_pos + tgt_vel * min(t_go, 60.0)   # cap the lead vs stale data
        d = pip - m.position
        d_h = float(np.hypot(d[0], d[1]))
        alt = m.altitude()
        alt_pip = -float(pip[2])

        if self.R0 is None:       # lock the loft sizing to the shot geometry
            self.R0 = max(d_h, 1000.0)
            base = max(-float(m.launch_position[2]), alt_pip)
            # Loft climb scales with range × loft-gain, but is capped at a fraction
            # of the range too: over-lofting a medium shot (climbing near the
            # ceiling then diving) wastes energy and can leave the missile mushing.
            climb = min(0.10 * self.loft * self.R0, 0.13 * self.R0)
            self.apogee = float(np.clip(base + climb, base + 400.0, self.ceiling))

        # ── vertical: flight-path-angle (γ) schedule ─────────────────────────
        vh = float(np.hypot(m.velocity[0], m.velocity[1]))
        gamma = float(np.arctan2(-m.velocity[2], max(vh, 1e-3)))
        gamma_pip = float(np.arctan2(alt_pip - alt, max(d_h, 1.0)))
        # dive geometry: begin the terminal descent when the remaining ground
        # range just accommodates a dive at the profile's dive angle
        dive_gamma = np.radians(18.0 + 10.0 * min(self.loft, 2.5))
        r_dive = max(alt - alt_pip, 0.0) / max(np.tan(dive_gamma), 0.1)
        # predictive apogee protection: with the current climb rate, where would
        # a ~2 g nose-over top out? Level off *before* momentum busts the apogee
        # (a Mach 5 booster can gain kilometres during the pushover itself).
        vz_up = max(-float(m.velocity[2]), 0.0)
        h_pred = alt + vz_up * vz_up / (2.0 * 2.0 * G0)
        if d_h <= r_dive * 1.15 + 1500.0:
            gamma_cmd = gamma_pip                      # nose over onto the PIP
        elif h_pred < self.apogee - 250.0:
            # climb leg, easing off as the *predicted* apogee approaches
            ease = float(np.clip((self.apogee - h_pred) / 3000.0, 0.12, 1.0))
            climb = np.radians(np.clip(12.0 + 16.0 * self.loft, 8.0, 55.0))
            gamma_cmd = max(climb * ease, min(gamma_pip, np.radians(60.0)))
        else:
            gamma_cmd = np.clip(gamma_pip, -0.06, 0.06)  # cruise near apogee
            # energy glide: if the coast has gone slow with real range still to
            # go, trade altitude for airspeed (a shallow descent keeps dynamic
            # pressure — and the missile alive — instead of mushing at apogee)
            if sp < 480.0 and d_h > 8000.0:
                gamma_cmd = min(gamma_cmd, -0.09)
        gamma_err = float(np.clip(gamma_cmd - gamma, -0.6, 0.6))

        # ── build the command in the velocity frame ──────────────────────────
        # The autopilot can only realise acceleration ⟂ velocity, so express the
        # γ correction along the "pitch-up" basis vector (⟂ velocity, in the
        # vertical plane through it). Straight off a vertical rail that basis
        # degenerates — there the pitch-over direction IS the PIP azimuth.
        vhat = m.velocity / max(np.linalg.norm(m.velocity), 1e-6)
        up = np.array([0.0, 0.0, -1.0])                     # NED "up"
        az = (np.array([d[0], d[1], 0.0]) / d_h) if d_h > 1.0 else np.array([1.0, 0.0, 0.0])
        u_pitch = up - np.dot(up, vhat) * vhat              # ⟂ v, increases γ
        n_p = np.linalg.norm(u_pitch)
        if n_p > 0.05:
            u_pitch /= n_p
        else:
            u_pitch = -az                                   # vertical: pitch-down = toward PIP azimuth
        a_gamma = sp * gamma_err / 1.8 + G0 * np.cos(gamma)  # γ̇ control + gravity comp

        # yaw-plane: proportional heading steer onto the PIP azimuth
        if vh > 1.0 and d_h > 1.0:
            hdg = np.arctan2(m.velocity[1], m.velocity[0])
            e = (np.arctan2(d[1], d[0]) - hdg + np.pi) % (2 * np.pi) - np.pi
            a_lat = float(np.clip(sp * e / 1.5, -12.0 * G0, 12.0 * G0))
            a_yaw = np.array([-np.sin(hdg), np.cos(hdg), 0.0]) * a_lat
        else:
            a_yaw = np.zeros(3)   # still vertical off the rail — u_pitch tips us over
        return a_gamma * u_pitch + a_yaw


# ─────────────────────────────────────────────────────────────────────────────
#  Runner
# ─────────────────────────────────────────────────────────────────────────────

def run(scenario: Scenario, record: bool = True,
        progress: Optional[callable] = None) -> TelemetryResult:
    m: Missile = scenario.missile
    tgt: Target = scenario.target
    shooter = scenario.shooter
    atmo_model = scenario.atmosphere
    cfg = scenario.sim

    # reset stateful controllers (the propulsion holds ramjet fuel state)
    for obj in (m.seeker, m.guidance, m.autopilot, m.propulsion, tgt.timeline):
        if hasattr(obj, "reset"):
            obj.reset()
    if hasattr(m.guidance, "origin"):
        m.guidance.origin = m.launch_position.copy()

    # ── datalink / midcourse state ──
    self_active = False               # onboard seeker gone active (pitbull)?
    pitbull = {"t": None, "range": None, "a_pole": None}
    f_pole = None
    dl_lost_flagged = False
    burnout_flagged = False
    battery_flagged = False
    _burnout_t = m.propulsion.burnout_time()
    _dl_rng = np.random.default_rng(4242)   # small datalink track noise

    dt = cfg.dt
    n_max = int(cfg.max_time / dt) + 1
    out_stride = max(1, int(round((1.0 / cfg.output_rate_hz) / dt)))
    ideal = getattr(m.autopilot, "_registry_key", "") == "ideal"

    # ── midcourse shaping (loft / SAM up-and-over) gating ──────────────────────
    # Only weapons that actually fly a shaped, uplinked midcourse loft: they need
    # a datalink (radar/SARH — never IR fire-and-forget), a predictive guidance
    # law (APN/OGL — pure-PN and CLOS home directly and never loft), and a
    # non-zero template loft. This applies to BVR air-to-air shots *and* to
    # long-range SAMs (which fly exactly this up-and-over profile after a
    # vertical-launch pitch-over).
    guidance_key = getattr(m.guidance, "_registry_key", "")
    loft_enabled = (getattr(m, "datalink_capable", True)
                    and guidance_key in ("ogl", "apn")
                    and getattr(m, "loft_gain", 0.0) > 0.0)
    shaper = MidcourseShaper(m, getattr(m, "ceiling_m", 24000.0)) if loft_enabled else None
    battery_s = getattr(m, "battery_s", None)   # fin/guidance battery life [s]
    # multi-pulse motors: pre-list later pulse ignitions so we can log them
    _pulse_ign = sorted((s.ignition_time, s.name) for s in m.propulsion.stages
                        if s.ignition_time > 0.05)
    _pulse_flagged = 0
    _ram = m.propulsion.ramjet
    _ram_lit_flagged = False
    _ram_out_flagged = False

    ch = _new_channels() if record else None
    events: List[Dict] = [{"t": 0.0, "type": "launch", "label": "Missile launch"}]

    min_range = np.inf
    min_range_t = 0.0
    prev_range = np.inf
    outcome = "TIMEOUT"
    miss_distance = np.inf
    t = 0.0
    hit = False
    prev_locked = False
    gravity_vec = np.array([0.0, 0.0, G0])

    for step in range(n_max):
        t = step * dt
        m.refresh(t)
        atmo = atmo_model.sample(m.altitude())

        r_rel = tgt.position - m.position
        v_rel = tgt.velocity - m.velocity
        rng = float(np.linalg.norm(r_rel))

        # ── onboard seeker: always polled so we know when it can go active ──────
        seeker_meas = m.seeker.measure(m, tgt, atmo, dt)
        if not self_active and seeker_meas.locked:
            self_active = True   # "pitbull" — the missile is now autonomous
            sh_rng = float(np.linalg.norm(tgt.position - shooter.position)) if shooter else 0.0
            pitbull = {"t": round(t, 2), "range": round(rng, 1), "a_pole": round(sh_rng, 1)}
            events.append({"t": round(t, 3), "type": "active",
                           "label": f"Seeker ACTIVE (pitbull) @ {rng/1000:.1f} km"})

        # ── datalink availability from the shooter ──────────────────────────────
        # only if the weapon actually has a midcourse datalink (radar/SARH); IR
        # fire-and-forget missiles must acquire with their own seeker.
        dl = False
        if shooter is not None and not self_active and getattr(m, "datalink_capable", True):
            dl = (shooter.tracks(tgt.position)
                  and np.linalg.norm(m.position - shooter.position) <= shooter.datalink_range)
            if not dl and not dl_lost_flagged:
                dl_lost_flagged = True
                events.append({"t": round(t, 3), "type": "unlock",
                               "label": "Datalink lost — missile inertial"})

        # ── pick the guidance source for this phase ─────────────────────────────
        # A datalink-capable BVR missile always flies a guided midcourse: on the
        # shooter's datalink when available, otherwise on its own inertial nav
        # (INS) toward the predicted intercept. Losing the datalink degrades the
        # track (no target-maneuver lead) and drops A-pole support — it does NOT
        # make the missile go ballistic. Only a fire-and-forget IR weapon that
        # hasn't yet acquired flies truly inertial.
        # NOTE: TERMINAL is *not* latched — if the seeker breaks lock (gimbal,
        # chaff, notch) a datalink-capable weapon drops back to INS midcourse
        # and re-acquires, exactly as real weapons do. A transient lock during
        # a SAM pitch-over therefore cannot strand the missile guidance-less.
        dl_capable = getattr(m, "datalink_capable", True)
        ins_phase = False
        if seeker_meas.locked:
            phase = "TERMINAL"
            meas = seeker_meas
        elif dl_capable and dl:
            phase = "MIDCOURSE"
            meas = _datalink_measure(m, tgt, r_rel, v_rel, rng, _dl_rng)
        elif dl_capable:
            phase = "INS"                 # datalink dropped → inertial midcourse
            ins_phase = True
            meas = _datalink_measure(m, tgt, r_rel, v_rel, rng, _dl_rng, noise_m=8.0)
        elif self_active:
            phase = "TERMINAL"            # IR: went active once, keep homing memory
            meas = seeker_meas
        else:
            phase = "INERTIAL"            # IR fire-and-forget, not yet locked
            meas = _inertial_measure(m, tgt, r_rel, v_rel, rng)

        if meas.locked != prev_locked:
            events.append({"t": round(t, 3),
                           "type": "lock" if meas.locked else "unlock",
                           "label": ("Guiding" if meas.locked else "Guidance coast")})
            prev_locked = meas.locked

        # ── guidance ──────────────────────────────────────────────────────────
        ctx = GuidanceContext(
            t=t, r_rel=r_rel, v_rel=v_rel,
            los_unit=meas.los_unit, los_rate_vec=meas.los_rate_vec,
            closing_speed=meas.closing_speed, range=rng,
            missile_vel=m.velocity, missile_speed=m.speed,
            # on INS (no datalink updates) the missile can't lead a target
            # maneuver it can't see — deny the augmentation term.
            target_accel=(np.zeros(3) if ins_phase else tgt.accel_cmd),
            gravity=gravity_vec,
            N=getattr(m.guidance, "N", 4.0), locked=meas.locked,
        )
        ctx.missile_pos = m.position
        a_cmd = np.asarray(m.guidance.command(ctx), dtype=float)

        # ── midcourse: PIP navigation + energy loft (replaces homing command) ──
        # During MIDCOURSE/INS a shaped weapon does not home — it flies the
        # uplinked predicted-intercept-point profile (climb → cruise → dive).
        # This is also what pitches a vertically-launched SAM over onto its
        # up-and-over trajectory instead of climbing out of the atmosphere.
        if shaper is not None and phase in ("MIDCOURSE", "INS"):
            a_cmd = shaper.command(tgt.position, tgt.velocity, meas, rng)

        # ── thrust: solid stages (+ pressure correction) + air-breathing ramjet ─
        # In the terminal phase the ramjet stops conserving fuel and throttles up
        # to restore endgame speed (or when the seeker is already active/close).
        mach_now = atmo.mach(m.speed)
        rj_terminal = (phase == "TERMINAL") or self_active or (rng < 25000.0)
        thrust = m.propulsion.thrust(t, atmo.pressure)
        thrust += m.propulsion.ramjet_thrust(t, dt, atmo.density, m.speed, mach_now,
                                             terminal=rj_terminal)
        if not burnout_flagged and _burnout_t > 0 and t >= _burnout_t:
            burnout_flagged = True
            label = ("Booster burnout" if _ram is not None else "Motor burnout")
            events.append({"t": round(t, 3), "type": "burnout",
                           "label": f"{label} @ {mach_now:.1f} Mach"
                                    + (" — ramjet cruise" if _ram is not None else " — coast")})
        if _pulse_flagged < len(_pulse_ign) and t >= _pulse_ign[_pulse_flagged][0]:
            events.append({"t": round(t, 3), "type": "burnout",
                           "label": f"Pulse {_pulse_flagged + 2} ignition @ {mach_now:.1f} Mach"})
            _pulse_flagged += 1
        if _ram is not None:
            if not _ram_lit_flagged and _ram.burning():
                _ram_lit_flagged = True
                events.append({"t": round(t, 3), "type": "burnout",
                               "label": f"Ramjet lit @ {mach_now:.1f} Mach — throttled cruise"})
            if _ram_lit_flagged and not _ram_out_flagged and not _ram.burning():
                _ram_out_flagged = True
                why = "flame-out (below operating Mach)" if _ram._flameout and _ram.fuel_remaining > 1e-3 \
                    else "fuel exhausted"
                events.append({"t": round(t, 3), "type": "burnout",
                               "label": f"Ramjet {why} @ {mach_now:.1f} Mach — coast"})

        # ── battery life: once the thermal battery is exhausted the fins can no
        # longer be driven — the missile is a ballistic slug for the rest of its
        # flight (no guidance, no control). Open sources: AAM batteries run
        # ~60–120 s; long-range SAM batteries several hundred seconds.
        battery_dead = battery_s is not None and t > battery_s
        if battery_dead:
            a_cmd = np.zeros(3)
            if not battery_flagged:
                battery_flagged = True
                events.append({"t": round(t, 3), "type": "unlock",
                               "label": f"Battery expired @ {t:.0f}s — missile ballistic"})

        # ── autopilot → control moment (sees thrust for thrust-borne lift) ─────
        m._thrust_now = thrust
        ap = m.autopilot.update(a_cmd, m, atmo, dt)
        if battery_dead:
            ap.body_moment = np.zeros(3)   # fins frozen — no control authority

        # ── integrate missile (controls held constant over the step) ───────────
        state = m.get_state()
        if ideal:
            accel_applied = getattr(m, "_ideal_accel", np.zeros(3))
            deriv = lambda s: missile_derivative_ideal(
                s, m, atmo_model, thrust, accel_applied, t)
        else:
            cmom = ap.body_moment
            deriv = lambda s: missile_derivative(
                s, m, atmo_model, thrust, cmom, t)
        new_state = rk4_step(deriv, state, dt)
        # structural/thermal Mach cap: clamp speed to the airframe limit (skin
        # heating). At altitude the same Mach is a lower TAS, so this is naturally
        # atmosphere-dependent; drag already limits speed below this most of the time.
        vmax = getattr(m, "max_mach", 5.5) * atmo.speed_of_sound
        sp_new = float(np.linalg.norm(new_state[3:6]))
        if sp_new > vmax and sp_new > 1e-6:
            new_state[3:6] *= vmax / sp_new
        if not np.all(np.isfinite(new_state)):   # safety net vs any blow-up
            outcome = "LOST_ENERGY"
            miss_distance = min_range
            break
        m.set_state(new_state)

        # ── target: maneuver timeline + countermeasures ────────────────────────
        events_ctx = {
            "missile_launched": True,
            "range_to_threat": rng,
            "time_to_impact": rng / max(meas.closing_speed, 1e-3),
            "threat_pos": m.position.copy(),
        }
        a_tgt, released = tgt.timeline.command(t, tgt, events_ctx)
        a_tgt = _limit_g(np.asarray(a_tgt, float), tgt.max_g)
        tgt.accel_cmd = a_tgt
        tstate = tgt.get_state()
        tgt.set_state(rk4_step(lambda s: target_derivative(s, a_tgt), tstate, dt))
        # ── aircraft energy model (drag polar, altitude- and load-dependent) ───
        # Induced-drag deceleration ∝ (n²−1)/q̄: a hard turn bleeds airspeed, and
        # it bleeds FASTER in thin high air and at low speed (small dynamic
        # pressure) — the physical reason a defender who breaks high and slow
        # goes energy-dead. When lightly loaded (unloaded/extending) the engine
        # regains energy toward the platform's max speed (thrust falls with air
        # density). This replaces the old flat >5.5 g bleed.
        _apply_target_energy(tgt, a_tgt, atmo_model, dt)
        _clamp_speed(tgt)

        # ── shooter flies its support profile ───────────────────────────────────
        if shooter is not None:
            shooter.update(t, dt, tgt.position, launched_active=self_active)

        if released:
            tgt.update_countermeasures(t, released)
            for cm in released:
                events.append({"t": round(t, 3), "type": "countermeasure",
                               "cm": cm.get("type", "cm"),
                               "count": int(cm.get("count", 1)),
                               "label": f"{cm.get('type','CM').title()} ×{cm.get('count',1)}"})
        else:
            tgt.update_countermeasures(t, [])

        # ── closest-approach / termination test ────────────────────────────────
        r_now = tgt.position - m.position
        rng_now = float(np.linalg.norm(r_now))
        # continuous closest approach within this step
        vv = v_rel.dot(v_rel)
        if vv > 1e-6:
            t_ca = -r_rel.dot(v_rel) / vv
            if 0.0 <= t_ca <= dt:
                ca = np.linalg.norm(r_rel + v_rel * t_ca)
                if ca < min_range:
                    min_range = ca
                    min_range_t = t + t_ca
                if ca <= cfg.hit_radius_m:
                    hit = True
        if rng_now < min_range:
            min_range = rng_now
            min_range_t = t
            if shooter is not None:   # F-pole: shooter→target range at closest approach
                f_pole = float(np.linalg.norm(tgt.position - shooter.position))
        if rng_now <= cfg.hit_radius_m:
            hit = True

        # ── record telemetry ───────────────────────────────────────────────────
        if record and (step % out_stride == 0 or hit):
            _record(ch, t, m, tgt, atmo, meas, ap, a_cmd, thrust, rng_now,
                    shooter, phase, dl)

        if progress and step % 500 == 0:
            progress(t / cfg.max_time)

        # ── stop conditions ─────────────────────────────────────────────────────
        if hit:
            outcome = "HIT"
            miss_distance = min_range
            break
        if m.altitude() < 0.0 and t > 0.5:
            outcome = "GROUND"
            miss_distance = min_range
            break
        # fly-through past closest approach without a hit → declare miss
        if meas.closing_speed < 0 and rng_now > min_range + 30.0 and min_range < 2000.0:
            outcome = "MISS"
            miss_distance = min_range
            break
        # ── energy death ─────────────────────────────────────────────────────
        # A coasting missile that has gone subsonic can no longer pull the G to
        # complete an intercept — it's a dead round even if a head-on target is
        # still flying toward it. (This is what caps realistic max range; without
        # it a missile "hits" by gliding subsonically for minutes as the target
        # closes the gap.) Only applies well after burnout, outside the terminal
        # endgame where a brief slow-down is normal.
        if (not m.propulsion.is_thrusting(t) and t > _burnout_t + 2.0
                and rng_now > 4000.0 and atmo.mach(m.speed) < 0.95):
            outcome = "LOST_ENERGY"
            miss_distance = min_range
            break
        # legacy: subsonic + opening close-in
        if (not m.propulsion.is_thrusting(t) and m.speed < 180.0
                and meas.closing_speed < 0 and t > 3.0):
            outcome = "LOST_ENERGY"
            miss_distance = min_range
            break
        prev_range = rng_now

    tof = min_range_t if outcome == "HIT" else t
    if miss_distance is np.inf:
        miss_distance = min_range

    # datalink / BVR analysis KPIs
    dl_kpis = {
        "pitbull_time": pitbull["t"],           # s from launch until seeker went active
        "pitbull_range": pitbull["range"],      # missile→target range at go-active [m]
        "a_pole": pitbull["a_pole"],            # shooter→target range at go-active [m]
        "f_pole": round(f_pole, 1) if f_pole is not None else None,   # shooter→target at intercept
        "datalink_support_time": pitbull["t"] if pitbull["t"] is not None else round(tof, 2),
        "went_active": self_active,
    }
    summary = _summarize(ch, outcome, miss_distance, tof, scenario, dl_kpis) if record else {
        "outcome": outcome, "miss_distance": float(miss_distance), **dl_kpis}

    return TelemetryResult(
        outcome=outcome,
        miss_distance=float(miss_distance),
        time_of_flight=float(tof),
        channels=ch or {},
        events=events,
        summary=summary,
    )


# ─────────────────────────────────────────────────────────────────────────────
#  helpers
# ─────────────────────────────────────────────────────────────────────────────

def _limit_g(a_vec, max_g):
    mag = np.linalg.norm(a_vec)
    lim = max_g * G0
    if mag > lim and mag > 1e-9:
        return a_vec * (lim / mag)
    return a_vec


def _unit(v):
    n = np.linalg.norm(v)
    return v / n if n > 1e-9 else np.zeros(3)


def _datalink_measure(m, tgt, r_rel, v_rel, rng, rng_noise, noise_m=0.6):
    """Synthetic measurement the missile flies on during midcourse: the shooter's
    datalinked target track (or its own INS estimate when the link is down —
    higher ``noise_m``). High quality but not perfect."""
    los = _unit(r_rel + rng_noise.normal(0, noise_m, 3))   # track noise (m)
    omega = np.cross(r_rel, v_rel) / max(rng * rng, 1e-6)
    closing = float(-np.dot(r_rel, v_rel) / rng) if rng > 1e-6 else 0.0
    nose = m.forward_inertial()
    be = float(np.arccos(np.clip(np.dot(_unit(r_rel), nose), -1.0, 1.0)))
    return SeekerMeasurement(los, omega, rng, closing, be, True, 99.0, False)


def _inertial_measure(m, tgt, r_rel, v_rel, rng):
    """No datalink, seeker not yet active: the missile coasts (no LOS update)."""
    los = _unit(r_rel)
    closing = float(-np.dot(r_rel, v_rel) / rng) if rng > 1e-6 else 0.0
    nose = m.forward_inertial()
    be = float(np.arccos(np.clip(np.dot(los, nose), -1.0, 1.0)))
    return SeekerMeasurement(los, np.zeros(3), rng, closing, be, False, 0.0, False)


def _apply_target_energy(tgt: Target, a_tgt, atmo_model, dt):
    """Physically-shaped fighter energy model applied to the point-mass target.

    Induced-drag deceleration scales as (n²−1) / q̄  with q̄ = ½ρV² (so it grows
    with load factor squared, and grows as air thins or speed drops); unloaded
    flight regains energy from thrust (∝ air density). Constants tuned so a 9 g
    break at sea level ~200 m/s bleeds ~18 m/s², rising sharply with altitude —
    matching real fighter energy behaviour. Kept lightweight (no per-airframe
    polar) but captures every trend that decides an energy fight."""
    sp = float(np.linalg.norm(tgt.velocity))
    if sp < 1.0:
        return
    atmo_t = atmo_model.sample(tgt.altitude())
    rho_ratio = atmo_t.density / 1.225
    n = float(np.linalg.norm(a_tgt)) / G0
    v_ref = 220.0
    # dynamic-pressure proxy (relative to the reference condition), floored so
    # the bleed stays finite when very slow / very high.
    q_term = max(rho_ratio * (sp / v_ref) ** 2, 0.06)
    a_bleed = 0.16 * max(n * n - 1.0, 0.0) / q_term          # induced-drag decel [m/s²]
    # thrust: regain energy only when lightly loaded and below max speed; thrust
    # available falls with air density (turbojet ~∝ ρ).
    a_thrust = 6.5 * rho_ratio if (n < 2.2 and sp < tgt.max_speed) else 0.0
    sp_new = sp + (a_thrust - a_bleed) * dt
    tgt.velocity *= max(0.2, sp_new) / sp


def _clamp_speed(tgt: Target):
    sp = np.linalg.norm(tgt.velocity)
    if sp < 1e-6:
        return
    if sp > tgt.max_speed:
        tgt.velocity *= tgt.max_speed / sp
    elif sp < tgt.min_speed:
        tgt.velocity *= tgt.min_speed / sp


def _new_channels() -> Dict[str, List]:
    keys = [
        "t", "mx", "my", "mz", "malt", "mspeed", "mmach",
        "tx", "ty", "tz", "talt", "tspeed",
        "range", "closing", "accel_cmd_g", "accel_g", "alpha_deg", "beta_deg",
        "fin_pitch_deg", "fin_yaw_deg", "thrust", "mass", "gload",
        "los_rate", "boresight_deg", "snr", "locked", "jammed",
        "roll_deg", "pitch_deg", "yaw_deg", "p", "q", "r",
        "qw", "qx", "qy", "qz", "cm_active", "maneuver",
        "tgload", "aspect_deg",
        "sx", "sy", "sz", "salt", "shooter_range", "phase", "datalink",
    ]
    return {k: [] for k in keys}


def _record(ch, t, m: Missile, tgt: Target, atmo, meas, ap, a_cmd, thrust, rng,
            shooter=None, phase="TERMINAL", datalink=False):
    roll, pitch, yaw = quat_to_euler(m.quat)
    # ACHIEVED lateral acceleration — the G the airframe is actually pulling,
    # from the real aerodynamic normal force at the current AoA plus the lateral
    # component of thrust. (The raw guidance command spikes with seeker noise
    # near intercept; what a real accelerometer — and a real pilot display —
    # sees is this, filtered through the airframe.)
    q_dyn = min(0.5 * atmo.density * m.speed * m.speed, 320000.0)
    a_tot = float(np.hypot(m.alpha, m.beta))
    coeffs = m.aero.coefficients(atmo.mach(m.speed), a_tot)
    lateral = (q_dyn * m.reference_area * abs(coeffs.cl)
               + thrust * np.sin(min(a_tot, 0.6))) / max(m.mass, 1e-6)
    ch["t"].append(round(t, 4))
    ch["mx"].append(round(float(m.position[0]), 2))
    ch["my"].append(round(float(m.position[1]), 2))
    ch["mz"].append(round(float(m.position[2]), 2))
    ch["malt"].append(round(float(m.altitude()), 2))
    ch["mspeed"].append(round(float(m.speed), 2))
    ch["mmach"].append(round(float(atmo.mach(m.speed)), 3))
    ch["tx"].append(round(float(tgt.position[0]), 2))
    ch["ty"].append(round(float(tgt.position[1]), 2))
    ch["tz"].append(round(float(tgt.position[2]), 2))
    ch["talt"].append(round(float(tgt.altitude()), 2))
    ch["tspeed"].append(round(float(np.linalg.norm(tgt.velocity)), 2))
    ch["range"].append(round(float(rng), 2))
    ch["closing"].append(round(float(meas.closing_speed), 2))
    ch["accel_cmd_g"].append(round(float(ap.accel_command_g), 2))
    ch["accel_g"].append(round(float(ap.accel_limited_g), 2))
    ch["alpha_deg"].append(round(float(np.degrees(m.alpha)), 2))
    ch["beta_deg"].append(round(float(np.degrees(m.beta)), 2))
    ch["fin_pitch_deg"].append(round(float(np.degrees(ap.fin_deflection[0])), 2))
    ch["fin_yaw_deg"].append(round(float(np.degrees(ap.fin_deflection[1])), 2))
    ch["thrust"].append(round(float(thrust), 1))
    ch["mass"].append(round(float(m.mass), 3))
    ch["gload"].append(round(float(lateral / G0), 2))
    ch["los_rate"].append(round(float(np.linalg.norm(meas.los_rate_vec)), 5))
    ch["boresight_deg"].append(round(float(np.degrees(meas.boresight_error)), 2))
    ch["snr"].append(round(float(meas.snr), 2))
    ch["locked"].append(int(meas.locked))
    ch["jammed"].append(int(meas.jammed))
    ch["roll_deg"].append(round(float(np.degrees(roll)), 2))
    ch["pitch_deg"].append(round(float(np.degrees(pitch)), 2))
    ch["yaw_deg"].append(round(float(np.degrees(yaw)), 2))
    ch["p"].append(round(float(m.omega_body[0]), 4))
    ch["q"].append(round(float(m.omega_body[1]), 4))
    ch["r"].append(round(float(m.omega_body[2]), 4))
    ch["qw"].append(round(float(m.quat[0]), 5))
    ch["qx"].append(round(float(m.quat[1]), 5))
    ch["qy"].append(round(float(m.quat[2]), 5))
    ch["qz"].append(round(float(m.quat[3]), 5))
    ch["cm_active"].append(len(tgt.active_countermeasures))
    ch["maneuver"].append(tgt.timeline.active_maneuver)
    ch["tgload"].append(round(float(np.linalg.norm(tgt.accel_cmd) / G0), 2))
    # aspect angle, pilot convention: 180° = head-on (hot), 0° = tail chase (cold)
    r_tm = m.position - tgt.position
    vt = tgt.velocity
    nv, nr = np.linalg.norm(vt), np.linalg.norm(r_tm)
    if nv > 1e-3 and nr > 1e-3:
        aspect = 180.0 - float(np.degrees(np.arccos(
            np.clip(np.dot(vt, r_tm) / (nv * nr), -1.0, 1.0))))
    else:
        aspect = 0.0
    ch["aspect_deg"].append(round(aspect, 1))
    # shooter + guidance-phase channels
    if shooter is not None:
        ch["sx"].append(round(float(shooter.position[0]), 2))
        ch["sy"].append(round(float(shooter.position[1]), 2))
        ch["sz"].append(round(float(shooter.position[2]), 2))
        ch["salt"].append(round(float(shooter.altitude()), 2))
        ch["shooter_range"].append(round(float(np.linalg.norm(tgt.position - shooter.position)), 2))
    else:
        for k in ("sx", "sy", "sz", "salt", "shooter_range"):
            ch[k].append(0.0)
    ch["phase"].append(phase)
    ch["datalink"].append(int(datalink))


def _summarize(ch, outcome, miss, tof, scenario, dl=None) -> Dict[str, Any]:
    def _mx(key):
        return max(ch[key]) if ch.get(key) else 0.0
    return {
        "outcome": outcome,
        "miss_distance": round(float(miss), 2),
        "time_of_flight": round(float(tof), 2),
        "max_mach": round(_mx("mmach"), 2),
        "max_speed": round(_mx("mspeed"), 1),
        "max_g": round(_mx("gload"), 1),   # achieved airframe G (accelerometer)
        "peak_alt": round(_mx("malt"), 1),
        "max_range": round(_mx("range"), 1),
        "n_samples": len(ch.get("t", [])),
        "engagement_type": scenario.engagement_type,
        "missile": scenario.missile.name,
        "target": scenario.target.name,
        "guidance": getattr(scenario.missile.guidance, "_registry_key", "?"),
        "seeker": getattr(scenario.missile.seeker, "_registry_key", "?"),
        **(dl or {}),
    }
