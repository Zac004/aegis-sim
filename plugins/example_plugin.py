"""
plugins/example_plugin.py — the Pandora Box in action.
======================================================

Drop-in demonstration of adding *new types* of engine behaviour without touching
any core file. On the next `python run.py` these appear automatically in the UI
dropdowns (guidance law list, seeker list, maneuver list).

This file registers:
  1. A custom guidance law  — "Biased PN" (PN + a downrange trajectory-shaping
     bias that flies a loft to preserve energy for long shots).
  2. A custom seeker        — "Dual-Mode RF/IR" that fuses radar range with IR
     angle tracking and is only broken if BOTH chaff and flares are present.
  3. A custom maneuver      — "Split-S then Extend": dive-reverse, then run.

Copy this file, rename the keys, edit the maths — that's the whole workflow.
"""

from __future__ import annotations

import numpy as np

from core.registry import register, GuidanceLaw, Maneuver
from core.seeker import _BaseSeeker
from core.atmosphere import G0


# ─────────────────────────────────────────────────────────────────────────────
# 1) Custom guidance law: Biased Proportional Navigation with energy loft
# ─────────────────────────────────────────────────────────────────────────────

@register("guidance", "biased_pn", label="Biased PN (Energy Loft)",
          description="TPN plus a range-scaled vertical loft bias for long shots.")
class BiasedProportionalNavigation(GuidanceLaw):
    """PN with a trajectory-shaping bias.

    Early in flight (long range) it adds an upward bias so the missile lofts,
    trading a longer path for far less drag loss at altitude; the bias fades as
    range closes and it reverts to clean PN for the terminal engagement.
    """
    def __init__(self, loft_gain=0.35, fade_range=6000.0, **kw):
        super().__init__(**kw)
        self.loft_gain = loft_gain
        self.fade_range = fade_range

    def command(self, ctx):
        if not ctx.locked:
            return np.zeros(3)
        pn = ctx.N * ctx.closing_speed * np.cross(ctx.los_rate_vec, ctx.los_unit)
        # loft bias (upward = -Down) that fades to zero inside fade_range
        fade = max(0.0, (ctx.range - self.fade_range) / max(ctx.range, 1.0))
        loft = np.array([0.0, 0.0, -1.0]) * self.loft_gain * fade * ctx.missile_speed
        return pn + loft


# ─────────────────────────────────────────────────────────────────────────────
# 2) Custom seeker: dual-mode RF + IR fusion (hard to jam)
# ─────────────────────────────────────────────────────────────────────────────

@register("seeker", "dual_rf_ir", label="Dual-Mode RF/IR (fused)",
          description="Fuses radar + IR; needs BOTH chaff and flares to break lock.")
class DualModeSeeker(_BaseSeeker):
    cm_channel = "none"  # custom logic below

    def __init__(self, **kw):
        kw.setdefault("acquisition_range", 22000.0)
        kw.setdefault("angle_noise_mrad", 0.2)
        super().__init__(**kw)

    def _snr(self, rng, atmo, missile, target):
        rcs = getattr(target, "rcs", 5.0)
        ir = getattr(target, "ir_signature", 1.0)
        ref = 18000.0
        rf = (rcs / 5.0) * (ref / max(rng, 1.0)) ** 4 * 3.0
        irs = ir * (ref / max(rng, 1.0)) ** 2 * 4.0
        return rf + irs  # fused channels sum → very robust SNR

    def _apply_countermeasures(self, target, rng):
        active = getattr(target, "active_countermeasures", None) or []
        types = {cm.get("type") for cm in active}
        # only degraded if the target spoofs BOTH the radar and the IR channel
        if "chaff" in types and "flare" in types:
            if self._rng.random() < self.cm_break_prob:
                return True
        return False


# ─────────────────────────────────────────────────────────────────────────────
# 3) Custom maneuver: Split-S then extend
# ─────────────────────────────────────────────────────────────────────────────

@register("maneuver", "split_s_extend", label="Split-S + Extend",
          description="Hard diving reversal, then unload and run to open range.")
class SplitSExtend(Maneuver):
    def __init__(self, g=7.5, dive_time=2.5, **kw):
        super().__init__(**kw)
        self.g = g
        self.dive_time = dive_time

    def command(self, t, target, events):
        local = t - getattr(self, "_t0", 0.0)
        if local < self.dive_time:
            return np.array([0.0, 0.0, self.g * G0])   # pull into a dive
        return np.zeros(3)                              # then extend / unload
