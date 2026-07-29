"""
core.atmosphere — U.S. Standard Atmosphere 1976.
================================================

Implements the 7 geopotential layers from 0 to 86 km with exact per-layer
integration of temperature and pressure, then derives density and speed of
sound. Values match the published USSA-1976 tables to well within table
precision, which matters because drag ∝ ρ and Mach ∝ 1/a drive the entire
engagement outcome.

Reference constants (USSA-1976):
    g0  = 9.80665      m/s²      standard gravity
    R*  = 8.31432      J/(mol·K) universal gas constant (1976 value)
    M0  = 0.0289644    kg/mol    mean molecular weight of air
    R   = R*/M0 = 287.053        specific gas constant
    γ   = 1.40                   ratio of specific heats
    r_E = 6356766      m         effective Earth radius for geopotential
"""

from __future__ import annotations

from dataclasses import dataclass

import math

from core.registry import register, AtmosphereModel

# ── constants ────────────────────────────────────────────────────────────────
G0 = 9.80665
RSTAR = 8.31432
M0 = 0.0289644
R_AIR = RSTAR / M0          # ≈ 287.053 J/(kg·K)
GAMMA = 1.40
R_EARTH = 6356766.0        # m, effective radius for geopotential conversion


def gravity(altitude_m: float) -> float:
    """Gravitational acceleration [m/s²] at geometric altitude, inverse-square.

        g(h) = g0 · (Re / (Re + h))²

    G0 is the sea-level standard value; at a 25 km loft apogee this returns
    ≈9.73 m/s² (0.8 % lower). Small per-step, but a long-range shot integrates it
    for minutes, so using a constant g biases the whole ballistic arc. Clamped at
    h ≥ 0 so sub-sea-level samples (numerical undershoot) stay finite.
    """
    h = altitude_m if altitude_m > 0.0 else 0.0
    ratio = R_EARTH / (R_EARTH + h)
    return G0 * ratio * ratio

# Base of each layer: geopotential altitude [m], lapse rate [K/m], base temp [K]
#   (base pressure is computed once at import so the profile is continuous)
_LAYERS = [
    # H_base(m)   lapse L(K/m)   T_base(K)
    (0.0,        -0.0065,        288.150),
    (11000.0,     0.0,           216.650),
    (20000.0,     0.0010,        216.650),
    (32000.0,     0.0028,        228.650),
    (47000.0,     0.0,           270.650),
    (51000.0,    -0.0028,        270.650),
    (71000.0,    -0.0020,        214.650),
]
_P0 = 101325.0             # Pa, sea-level standard pressure


def _build_base_pressures():
    """Precompute base pressure at each layer boundary for continuity."""
    pressures = [_P0]
    for i in range(1, len(_LAYERS)):
        h0, L0, T0 = _LAYERS[i - 1]
        h1, _, _ = _LAYERS[i]
        p0 = pressures[i - 1]
        dh = h1 - h0
        if abs(L0) < 1e-12:
            # isothermal layer
            p1 = p0 * math.exp(-G0 * dh / (R_AIR * T0))
        else:
            T1 = T0 + L0 * dh
            p1 = p0 * (T1 / T0) ** (-G0 / (R_AIR * L0))
        pressures.append(p1)
    return pressures


_BASE_P = _build_base_pressures()


def geopotential_altitude(h_geometric: float) -> float:
    """Convert geometric altitude (m) to geopotential altitude (m)."""
    return R_EARTH * h_geometric / (R_EARTH + h_geometric)


@dataclass
class AtmoState:
    altitude: float      # geometric altitude, m
    temperature: float   # K
    pressure: float      # Pa
    density: float       # kg/m³
    speed_of_sound: float  # m/s

    def mach(self, speed: float) -> float:
        return speed / self.speed_of_sound if self.speed_of_sound > 0 else 0.0


def properties(h_geometric: float) -> AtmoState:
    """Full USSA-1976 atmospheric state at a geometric altitude (m).

    Below 0 m the sea-level layer is extrapolated; above 86 km the top layer is
    held constant (adequate for endo-atmospheric missile work).
    """
    H = geopotential_altitude(max(h_geometric, -5000.0))
    H = min(H, 84852.0)  # top of the 86 km geometric ceiling in geopotential m

    # find layer
    idx = 0
    for i in range(len(_LAYERS)):
        if H >= _LAYERS[i][0]:
            idx = i
        else:
            break

    h0, L, T0 = _LAYERS[idx]
    p0 = _BASE_P[idx]
    dh = H - h0
    T = T0 + L * dh
    if abs(L) < 1e-12:
        P = p0 * math.exp(-G0 * dh / (R_AIR * T0))
    else:
        P = p0 * (T / T0) ** (-G0 / (R_AIR * L))

    rho = P / (R_AIR * T)
    a = math.sqrt(GAMMA * R_AIR * T)
    return AtmoState(h_geometric, T, P, rho, a)


@register("atmosphere", "ussa1976", label="US Standard Atmosphere 1976",
          description="7-layer standard atmosphere, 0–86 km.")
class USStandard1976(AtmosphereModel):
    """Registry wrapper around the module-level :func:`properties`."""
    def sample(self, h) -> AtmoState:
        return properties(h)


class _OffsetAtmosphere(AtmosphereModel):
    """USSA-1976 shifted by a temperature offset (ISA±ΔT). Warmer air is less
    dense (less drag → more missile range but less lift); colder is denser."""
    dT = 0.0
    def sample(self, h) -> AtmoState:
        s = properties(h)
        T = s.temperature + self.dT
        rho = s.pressure / (R_AIR * T)        # pressure ~ unchanged, density scales
        a = math.sqrt(GAMMA * R_AIR * T)
        return AtmoState(s.altitude, T, s.pressure, rho, a)


@register("atmosphere", "ussa_hot", label="Hot Day (ISA +20 °C)",
          description="Standard atmosphere +20 °C. Hotter, thinner air: lower density → less drag (longer missile reach) but less lift for turning.")
class HotDay(_OffsetAtmosphere):
    dT = 20.0


@register("atmosphere", "ussa_cold", label="Cold Day (ISA −20 °C)",
          description="Standard atmosphere −20 °C. Colder, denser air: more drag (shorter missile reach) but more available lift/turn.")
class ColdDay(_OffsetAtmosphere):
    dT = -20.0


@register("atmosphere", "tropical", label="Tropical (ISA +15 °C)",
          description="Warm tropical profile (+15 °C). Thinner low-level air — common test case for hot-and-high missile performance.")
class Tropical(_OffsetAtmosphere):
    dT = 15.0


@register("atmosphere", "isothermal", label="Isothermal (debug)",
          description="Constant-temperature exponential atmosphere for testing.")
class Isothermal(AtmosphereModel):
    """Simple exponential atmosphere: ρ = ρ0·exp(-h/H_scale)."""
    def __init__(self, T=288.15, scale_height=8500.0, **kw):
        super().__init__(T=T, scale_height=scale_height, **kw)
        self.T = T
        self.H = scale_height
        self.rho0 = _P0 / (R_AIR * T)
        self.a = math.sqrt(GAMMA * R_AIR * T)

    def sample(self, h) -> AtmoState:
        rho = self.rho0 * math.exp(-max(h, 0.0) / self.H)
        P = rho * R_AIR * self.T
        return AtmoState(h, self.T, P, rho, self.a)


if __name__ == "__main__":  # quick table dump / sanity check
    print(f"{'alt km':>7} {'T K':>8} {'P Pa':>12} {'rho':>10} {'a m/s':>8}")
    for km in (0, 5, 11, 20, 32, 47, 60, 71, 86):
        s = properties(km * 1000.0)
        print(f"{km:7d} {s.temperature:8.2f} {s.pressure:12.2f} "
              f"{s.density:10.5f} {s.speed_of_sound:8.2f}")
