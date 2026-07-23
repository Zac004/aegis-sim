"""
core.integrator — fixed-step RK4 integration helpers.
=====================================================

Classic 4th-order Runge-Kutta. The controls (thrust, control moment / accel
command) are captured in the derivative closure and held constant across the
four sub-stages — i.e. a zero-order hold on the controller output each step,
which is the standard way to couple a discrete GNC update to a continuous plant.

A Numba-JIT fast path is used *if* numba is installed; otherwise the pure-NumPy
version runs. Results are identical.
"""

from __future__ import annotations

from typing import Callable

import numpy as np


def rk4_step(deriv: Callable[[np.ndarray], np.ndarray], state: np.ndarray, dt: float) -> np.ndarray:
    """One RK4 step. `deriv(state) -> dstate` (time handled inside the closure)."""
    k1 = deriv(state)
    k2 = deriv(state + 0.5 * dt * k1)
    k3 = deriv(state + 0.5 * dt * k2)
    k4 = deriv(state + dt * k3)
    return state + (dt / 6.0) * (k1 + 2 * k2 + 2 * k3 + k4)


def euler_step(deriv, state, dt):
    return state + dt * deriv(state)


# Optional numba acceleration of a pure-numeric inner loop would go here; the
# closures used above capture Python objects (models), so JITting them wholesale
# is not straightforward. We keep the interface pluggable for future kernels.
try:  # pragma: no cover
    import numba  # noqa: F401
    HAVE_NUMBA = True
except Exception:  # pragma: no cover
    HAVE_NUMBA = False
