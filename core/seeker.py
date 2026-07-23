"""
core.seeker — seeker / sensor models (the "what do I see" eyes).
===============================================================

A seeker measures the line of sight (LOS) to the target and its rate, subject to
real-world limits:

  * **Gimbal limit** — the seeker head can only look so far off boresight; beyond
    it, track is lost.
  * **Field of view (FOV)** — instantaneous acceptance cone.
  * **Tracking-loop bandwidth** — the head lags true LOS; modelled as a
    first-order filter so LOS-rate estimates are smoothed/delayed.
  * **Thermal / glint noise** — Gaussian angle noise scaled by range and SNR.
  * **Acquisition range** — max range at which lock can first be achieved.
  * **Countermeasures** — chaff/flare/ECM raise a break-lock probability and
    inject a bias, per seeker type (IR ⇄ flares, RF ⇄ chaff/jamming).

Built-in types: ``rf_active``, ``rf_semiactive``, ``ir``, ``iir``. All share the
kinematics; they differ in noise, countermeasure vulnerability, and range.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from core.registry import register, SeekerModel


@dataclass
class SeekerMeasurement:
    los_unit: np.ndarray        # measured unit LOS (missile→target), NED
    los_rate_vec: np.ndarray    # filtered LOS angular rate ω [rad/s]
    range: float                # measured range [m]
    closing_speed: float        # closing velocity [m/s]
    boresight_error: float      # angle off seeker boresight [rad]
    locked: bool                # valid track this step
    snr: float                  # linear signal-to-noise
    jammed: bool = False        # countermeasure currently degrading track


def _unit(v):
    n = np.linalg.norm(v)
    return v / n if n > 1e-9 else np.zeros(3)


class _BaseSeeker(SeekerModel):
    """Shared kinematics + limits; subclasses set noise & CM vulnerability.

    Detailed, sim-affecting parameters (all editable per template):
      acquisition_range   max lock-on range against the reference target [m]
      gimbal_limit_deg    seeker head look-angle limit off boresight
      fov_deg             instantaneous field of view
      track_bandwidth_hz  tracking-loop bandwidth (lag vs noise trade)
      angle_noise_mrad    1-σ angular measurement noise
      jam_susceptibility  0–1 probability/step a matched CM degrades track
      burnthrough_range   range [m] inside which active radar burns through
                          chaff/ECM (jamming becomes ineffective)
      frequency_band      RF band (X/Ku/Ka/S/C) or IR band (MWIR/LWIR) — metadata
      vuln_channels       which CM types affect this seeker (chaff/flare/ecm)
    """
    default_vuln = ("none",)
    default_band = "-"

    def __init__(self,
                 acquisition_range=20000.0,
                 gimbal_limit_deg=45.0,
                 fov_deg=3.0,
                 track_bandwidth_hz=3.0,
                 angle_noise_mrad=0.3,
                 rate_noise=0.002,
                 cm_break_prob=0.15,
                 jam_susceptibility=None,
                 burnthrough_range=2500.0,
                 frequency_band=None,
                 vuln_channels=None,
                 rng_seed=20260707,
                 **kw):
        super().__init__(**kw)
        self.acq_range = acquisition_range
        self.gimbal_limit = np.radians(gimbal_limit_deg)
        self.fov = np.radians(fov_deg)
        self.bw = track_bandwidth_hz
        self.angle_noise = angle_noise_mrad * 1e-3
        self.rate_noise = rate_noise
        self.cm_break_prob = cm_break_prob
        self.jam_susceptibility = cm_break_prob if jam_susceptibility is None else jam_susceptibility
        self.burnthrough_range = burnthrough_range
        self.frequency_band = frequency_band or self.default_band
        self.vuln_channels = tuple(vuln_channels) if vuln_channels is not None else self.default_vuln
        self._rng = np.random.default_rng(rng_seed)
        self.reset()

    def reset(self):
        self._los_prev = None
        self._omega_filt = np.zeros(3)
        self._locked = False

    # ── main measurement ────────────────────────────────────────────────────
    def measure(self, missile, target, atmo, dt) -> SeekerMeasurement:
        r_rel = target.position - missile.position
        v_rel = target.velocity - missile.velocity
        rng = float(np.linalg.norm(r_rel))
        los_true = _unit(r_rel)

        # boresight error vs missile nose (body-x in inertial)
        nose = missile.forward_inertial()
        cos_be = np.clip(np.dot(los_true, nose), -1.0, 1.0)
        boresight_error = float(np.arccos(cos_be))

        # acquisition / gimbal logic
        can_see = (rng <= self.acq_range) and (boresight_error <= self.gimbal_limit)
        if not self._locked:
            # need to be within FOV-ish and in range to first acquire
            self._locked = can_see and boresight_error <= max(self.gimbal_limit, self.fov)
        elif not can_see:
            self._locked = False  # gimbal ran out → break lock

        # signal model → SNR falls with range² (RF: R⁴ two-way; approximated)
        snr = self._snr(rng, atmo, missile, target)
        if snr < 1.0:
            self._locked = False

        # countermeasures
        jammed = self._apply_countermeasures(target, rng)

        if not self._locked:
            self._los_prev = None
            self._omega_filt = np.zeros(3)
            return SeekerMeasurement(los_true, np.zeros(3), rng,
                                     self._closing(r_rel, v_rel), boresight_error,
                                     False, snr, jammed)

        # angle noise (scaled up when SNR is poor or jammed)
        noise_scale = self.angle_noise * (1.0 + 2.0 / max(snr, 0.5))
        if jammed:
            noise_scale *= 6.0
        los_meas = _unit(los_true + self._rng.normal(0, noise_scale, 3))

        # LOS rate from relative kinematics: ω = (R × V) / |R|²
        omega_true = np.cross(r_rel, v_rel) / max(rng * rng, 1e-6)
        omega_true += self._rng.normal(0, self.rate_noise * (6.0 if jammed else 1.0), 3)

        # first-order tracking-loop filter (bandwidth-limited)
        alpha = np.clip(2 * np.pi * self.bw * dt, 0.0, 1.0)
        self._omega_filt = (1 - alpha) * self._omega_filt + alpha * omega_true
        self._los_prev = los_meas

        return SeekerMeasurement(
            los_unit=los_meas,
            los_rate_vec=self._omega_filt.copy(),
            range=rng,
            closing_speed=self._closing(r_rel, v_rel),
            boresight_error=boresight_error,
            locked=True,
            snr=snr,
            jammed=jammed,
        )

    @staticmethod
    def _closing(r_rel, v_rel):
        rng = np.linalg.norm(r_rel)
        if rng < 1e-6:
            return 0.0
        return float(-np.dot(r_rel, v_rel) / rng)  # +ve when closing

    def _snr(self, rng, atmo, missile, target):
        raise NotImplementedError

    def _apply_countermeasures(self, target, rng) -> bool:
        """Return True if a countermeasure is currently degrading track.

        Active radar/SARH can *burn through* chaff and ECM once the target is
        inside ``burnthrough_range`` (the return signal overwhelms the jammer),
        so terminal-phase jamming is far less effective than at long range.
        """
        active = getattr(target, "active_countermeasures", None)
        if not active:
            return False
        degraded = False
        for cm in active:
            ctype = cm.get("type")
            if ctype not in self.vuln_channels:
                continue
            if ctype in ("ecm", "chaff") and rng < self.burnthrough_range:
                continue  # burned through — jamming ineffective at close range
            p = self.jam_susceptibility * cm.get("intensity", 1.0)
            if self._rng.random() < p:
                degraded = True
                if self._rng.random() < 0.35:   # sometimes a full break-lock
                    self._locked = False
        return degraded


@register("seeker", "rf_active", label="Active Radar (RF)",
          description="Onboard transmitter; two-way R⁴ range loss; chaff/ECM vuln.")
class ActiveRadarSeeker(_BaseSeeker):
    default_vuln = ("chaff", "ecm")
    default_band = "X"

    def __init__(self, radar_power=1.0, **kw):
        kw.setdefault("acquisition_range", 25000.0)
        kw.setdefault("angle_noise_mrad", 0.5)
        super().__init__(**kw)
        self.radar_power = radar_power

    def _snr(self, rng, atmo, missile, target):
        rcs = getattr(target, "rcs", 5.0)          # m²
        ref = 20000.0
        # two-way: SNR ∝ P·RCS / R⁴
        return self.radar_power * (rcs / 5.0) * (ref / max(rng, 1.0)) ** 4 * 4.0


@register("seeker", "rf_semiactive", label="Semi-Active Radar (SARH)",
          description="Illuminated by launch platform; one-way-ish R² beyond illuminator.")
class SemiActiveRadarSeeker(_BaseSeeker):
    default_vuln = ("chaff", "ecm")
    default_band = "X"

    def __init__(self, **kw):
        kw.setdefault("acquisition_range", 40000.0)
        kw.setdefault("angle_noise_mrad", 0.4)
        super().__init__(**kw)

    def _snr(self, rng, atmo, missile, target):
        rcs = getattr(target, "rcs", 5.0)
        ref = 30000.0
        return (rcs / 5.0) * (ref / max(rng, 1.0)) ** 2 * 3.0


@register("seeker", "ir", label="Infrared (IR)",
          description="Passive heat-seeker; flare-vulnerable; short-to-medium range.")
class InfraredSeeker(_BaseSeeker):
    default_vuln = ("flare",)
    default_band = "MWIR"

    def __init__(self, **kw):
        kw.setdefault("acquisition_range", 12000.0)
        kw.setdefault("angle_noise_mrad", 0.25)
        kw.setdefault("cm_break_prob", 0.25)
        super().__init__(**kw)

    def _snr(self, rng, atmo, missile, target):
        # IR intensity ~ plume/skin temperature; falls with R² and thin air aloft
        ir_sig = getattr(target, "ir_signature", 1.0)
        ref = 10000.0
        aspect = 1.0
        return ir_sig * (ref / max(rng, 1.0)) ** 2 * 5.0 * aspect


@register("seeker", "iir", label="Imaging Infrared (IIR)",
          description="Imaging IR; flare-resistant (lower break-prob), sharp tracking.")
class ImagingInfraredSeeker(InfraredSeeker):
    default_vuln = ("flare",)
    default_band = "LWIR"

    def __init__(self, **kw):
        kw.setdefault("cm_break_prob", 0.08)   # imaging rejects point-source flares
        kw.setdefault("angle_noise_mrad", 0.15)
        super().__init__(**kw)
