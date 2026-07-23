"""
core.aerodynamics — aerodynamic coefficient model.
==================================================

Provides drag (Cd), lift (Cl / normal force) and pitching-moment (Cm) style
coefficients as functions of Mach number and angle of attack (α). The default
model is a physically reasonable parametric fit for a slender finned missile:

  * Zero-lift drag Cd0 has a subsonic plateau, a transonic drag-rise near M≈1,
    and a mild supersonic decay — the classic "drag bucket + spike".
  * Induced drag adds k·CN² so drag grows with maneuvering.
  * Normal-force slope CN_α is ~2/rad (slender-body) with a supersonic taper.
  * Static margin gives a restoring pitching-moment slope Cm_α (negative =
    statically stable) plus pitch-damping Cm_q.

These are engineering approximations, not wind-tunnel data — but they capture
the right *trends* (transonic drag rise, loss of control authority at high Mach)
so envelopes and intercepts behave believably. Swap in a table-driven model via
the plugin system for higher fidelity.
"""

from __future__ import annotations

from dataclasses import dataclass

import math

from core.registry import register, AeroModel


@dataclass
class AeroCoeffs:
    cd: float      # total drag coefficient
    cl: float      # lift / normal-force coefficient (body normal)
    cm: float      # pitching-moment coefficient (about CG, per reference length)
    cn_alpha: float  # normal-force slope, per rad (diagnostic)


def _transonic_cd0(mach: float, cd_sub: float, cd_peak: float, cd_suphi: float) -> float:
    """Zero-lift drag vs Mach: plateau → transonic rise → supersonic decay."""
    m = max(mach, 0.0)
    if m < 0.8:
        return cd_sub
    if m < 1.2:
        # smooth rise across the transonic bucket (cosine blend)
        x = (m - 0.8) / 0.4
        blend = 0.5 - 0.5 * math.cos(math.pi * x)
        return cd_sub + (cd_peak - cd_sub) * blend
    # supersonic: decay from peak toward a high-Mach asymptote
    return cd_suphi + (cd_peak - cd_suphi) * math.exp(-(m - 1.2) / 1.5)


@register("aero", "parametric", label="Parametric Slender-Body",
          description="Analytic Cd/Cl/Cm(M,α) with transonic drag rise.")
class ParametricAero(AeroModel):
    """Default analytic aerodynamic model.

    Tunable parameters (all optional, sensible defaults for a ~0.2 m dia AAM):
        cd0_subsonic, cd0_transonic_peak, cd0_supersonic
        induced_k               induced-drag factor (k in Cd = Cd0 + k·CN²)
        cn_alpha0               normal-force slope at low Mach [1/rad]
        cm_alpha0               static pitch-stiffness slope [1/rad] (negative)
        cm_q                    pitch-damping derivative [1/rad]
        alpha_stall             soft normal-force saturation angle [rad]
    """
    def __init__(self,
                 cd0_subsonic=0.30,
                 cd0_transonic_peak=0.75,
                 cd0_supersonic=0.42,
                 induced_k=0.004,
                 cn_alpha0=32.0,
                 cm_alpha0=-0.28,
                 cm_q=-180.0,
                 alpha_stall=math.radians(28.0),
                 **kw):
        super().__init__(**kw)
        self.cd_sub = cd0_subsonic
        self.cd_peak = cd0_transonic_peak
        self.cd_sup = cd0_supersonic
        self.k = induced_k
        self.cn_alpha0 = cn_alpha0
        self.cm_alpha0 = cm_alpha0
        self.cm_q = cm_q
        self.alpha_stall = alpha_stall

    def cn_alpha(self, mach: float) -> float:
        """Normal-force slope vs Mach (Prandtl-Glauert-ish behaviour)."""
        m = max(mach, 0.05)
        if m < 0.95:
            # subsonic amplification, capped to avoid the PG singularity
            return self.cn_alpha0 / math.sqrt(max(1.0 - m * m, 0.15))
        if m < 1.05:
            return self.cn_alpha0 / math.sqrt(0.15)  # transonic plateau
        # supersonic: slope tapers ~ 1/sqrt(M²-1), floored
        return self.cn_alpha0 * (1.0 / math.sqrt(m * m - 1.0 + 0.4))

    def coefficients(self, mach: float, alpha: float, beta: float = 0.0) -> AeroCoeffs:
        cna = self.cn_alpha(mach)
        # soft-saturating normal force (sin gives natural roll-off past stall)
        a_eff = max(-1.5, min(1.5, alpha))
        sat = math.sin(min(abs(a_eff), self.alpha_stall)) / max(self.alpha_stall, 1e-6)
        cl = cna * self.alpha_stall * sat * (1.0 if a_eff >= 0 else -1.0)
        # if below stall this ≈ cna*alpha; past stall it plateaus/rolls off
        if abs(a_eff) < self.alpha_stall:
            cl = cna * a_eff

        cd0 = _transonic_cd0(mach, self.cd_sub, self.cd_peak, self.cd_sup)
        cd = cd0 + self.k * cl * cl

        cm = self.cm_alpha0 * a_eff  # damping term added by dynamics via cm_q
        return AeroCoeffs(cd=cd, cl=cl, cm=cm, cn_alpha=cna)


@register("aero", "flat_plate", label="Flat-Plate (debug)",
          description="Newtonian flat-plate; crude but monotone for testing.")
class FlatPlateAero(AeroModel):
    def __init__(self, cd0=0.25, **kw):
        super().__init__(**kw)
        self.cd0 = cd0

    def coefficients(self, mach, alpha, beta=0.0) -> AeroCoeffs:
        cl = 2.0 * math.sin(alpha) * math.cos(alpha)
        cd = self.cd0 + 2.0 * math.sin(alpha) ** 2
        cm = -0.3 * alpha
        return AeroCoeffs(cd=cd, cl=cl, cm=cm, cn_alpha=2.0)
