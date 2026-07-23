"""
core.registry — the Aegis-Sim "Pandora Box" plugin system.
===========================================================

Every *type* of behaviour a scenario can select — a guidance law, a seeker, an
autopilot, a target maneuver, an atmosphere model, an aerodynamic model — is a
class registered here under a (category, key) pair. The engine never hard-codes
an `if law == "pn"` ladder; it asks the registry to build the object by key.

To add a brand-new type of anything, subclass the relevant base class and
decorate it with ``@register(category, key, label=...)``. Drop the file under
``plugins/`` and it is auto-discovered at startup (see ``discover_plugins``).

    from core.registry import register, GuidanceLaw

    @register("guidance", "my_law", label="My Law")
    class MyLaw(GuidanceLaw):
        def command(self, ctx):
            return ctx.N * ctx.closing_speed * ctx.los_rate_vec

This module has **no third-party dependencies** so it can be imported anywhere.
"""

from __future__ import annotations

import importlib
import importlib.util
import pkgutil
import sys
import traceback
from pathlib import Path
from typing import Any, Callable, Dict, List, Type


# ─────────────────────────────────────────────────────────────────────────────
#  The registry store
# ─────────────────────────────────────────────────────────────────────────────

# category -> { key -> {"cls": type, "label": str, "meta": dict} }
_REGISTRY: Dict[str, Dict[str, Dict[str, Any]]] = {}

# Categories known to the engine. Plugins may add new categories freely, but
# these are the ones the simulation core consumes.
KNOWN_CATEGORIES = (
    "guidance",
    "seeker",
    "autopilot",
    "maneuver",
    "atmosphere",
    "aero",
)


def register(category: str, key: str, *, label: str | None = None, **meta) -> Callable[[Type], Type]:
    """Class decorator that registers ``cls`` under ``(category, key)``.

    ``label``  human-readable name for UI dropdowns (defaults to ``key``).
    ``meta``   arbitrary extra metadata (e.g. ``description=..., color=...``)
               surfaced to the UI via :func:`catalog`.
    """
    def _decorator(cls: Type) -> Type:
        bucket = _REGISTRY.setdefault(category, {})
        if key in bucket and bucket[key]["cls"] is not cls:
            # Allow silent re-registration on reload, warn on genuine clashes.
            existing = bucket[key]["cls"]
            if existing.__module__ != cls.__module__:
                print(f"[registry] WARNING: overriding {category}:{key} "
                      f"({existing.__module__} -> {cls.__module__})")
        cls._registry_category = category
        cls._registry_key = key
        cls._registry_label = label or key.replace("_", " ").title()
        bucket[key] = {"cls": cls, "label": cls._registry_label, "meta": meta}
        return cls
    return _decorator


def create(category: str, key: str, **kwargs) -> Any:
    """Instantiate the class registered under ``(category, key)``."""
    try:
        entry = _REGISTRY[category][key]
    except KeyError:
        available = sorted(_REGISTRY.get(category, {}))
        raise KeyError(
            f"No {category!r} registered under key {key!r}. "
            f"Available: {available or '(none)'}"
        ) from None
    return entry["cls"](**kwargs)


def get_class(category: str, key: str) -> Type:
    return _REGISTRY[category][key]["cls"]


def has(category: str, key: str) -> bool:
    return key in _REGISTRY.get(category, {})


def keys(category: str) -> List[str]:
    return sorted(_REGISTRY.get(category, {}))


def catalog() -> Dict[str, List[Dict[str, Any]]]:
    """Return a UI-friendly catalogue of everything registered.

    Shape::

        { "guidance": [ {"key": "pn", "label": "Pure PN", "meta": {...}}, ... ],
          "seeker":   [ ... ], ... }
    """
    out: Dict[str, List[Dict[str, Any]]] = {}
    for category, bucket in _REGISTRY.items():
        out[category] = [
            {"key": k, "label": v["label"], "meta": v["meta"]}
            for k, v in sorted(bucket.items())
        ]
    return out


# ─────────────────────────────────────────────────────────────────────────────
#  Base classes — the contracts a plugin implements
# ─────────────────────────────────────────────────────────────────────────────

class _Base:
    """Common base: stores construction params so objects are introspectable."""
    def __init__(self, **params):
        self.params = params

    def __repr__(self):  # pragma: no cover - cosmetic
        cat = getattr(self, "_registry_category", "?")
        key = getattr(self, "_registry_key", "?")
        return f"<{cat}:{key} {type(self).__name__}>"


class GuidanceLaw(_Base):
    """Produce a commanded lateral acceleration vector (inertial NED, m/s²).

    Implement :meth:`command`. It receives a ``GuidanceContext`` (see
    ``core.guidance``) exposing LOS geometry, closing velocity, gains, target
    state estimate, gravity, and the current missile state.
    """
    def reset(self):  # optional per-run hook
        pass

    def command(self, ctx) -> "Any":
        raise NotImplementedError


class SeekerModel(_Base):
    """Measure the target and report a tracking solution.

    Implement :meth:`measure(missile, target, atmosphere, dt)` returning a
    ``SeekerMeasurement`` (see ``core.seeker``) with LOS unit vector, LOS rate,
    range, closing velocity, and lock/ECM status.
    """
    def reset(self):
        pass

    def measure(self, missile, target, atmo, dt) -> "Any":
        raise NotImplementedError


class Autopilot(_Base):
    """Convert a commanded acceleration into fin deflections + body moments."""
    def reset(self):
        pass

    def update(self, a_cmd, missile, atmo, dt) -> "Any":
        raise NotImplementedError


class Maneuver(_Base):
    """Drive a target's commanded acceleration/attitude over time."""
    def reset(self):
        pass

    def command(self, t, target, events) -> "Any":
        raise NotImplementedError


class AtmosphereModel(_Base):
    """Return atmospheric state at geometric altitude ``h`` (m)."""
    def sample(self, h) -> "Any":
        raise NotImplementedError


class AeroModel(_Base):
    """Return aerodynamic coefficients for a flight condition."""
    def coefficients(self, mach, alpha, beta=0.0) -> "Any":
        raise NotImplementedError


# ─────────────────────────────────────────────────────────────────────────────
#  Plugin discovery
# ─────────────────────────────────────────────────────────────────────────────

def _import_core_modules() -> None:
    """Import the built-in modules so their @register decorators fire."""
    for mod in (
        "core.atmosphere",
        "core.aerodynamics",
        "core.guidance",
        "core.seeker",
        "core.autopilot",
        "core.maneuvers",
    ):
        try:
            importlib.import_module(mod)
        except Exception:  # pragma: no cover - defensive
            print(f"[registry] failed importing built-in {mod}:")
            traceback.print_exc()


def discover_plugins(plugins_dir: str | Path | None = None) -> List[str]:
    """Import every ``*.py`` under ``plugins/`` so registrations take effect.

    Returns the list of module names successfully loaded. Import errors in one
    plugin never abort discovery of the others.
    """
    _import_core_modules()

    if plugins_dir is None:
        plugins_dir = Path(__file__).resolve().parent.parent / "plugins"
    plugins_dir = Path(plugins_dir)
    loaded: List[str] = []
    if not plugins_dir.is_dir():
        return loaded

    for path in sorted(plugins_dir.glob("*.py")):
        if path.name.startswith("_"):
            continue
        mod_name = f"aegis_plugins.{path.stem}"
        try:
            spec = importlib.util.spec_from_file_location(mod_name, path)
            if spec is None or spec.loader is None:
                continue
            module = importlib.util.module_from_spec(spec)
            sys.modules[mod_name] = module
            spec.loader.exec_module(module)
            loaded.append(mod_name)
        except Exception:
            print(f"[registry] plugin {path.name} failed to load:")
            traceback.print_exc()
    return loaded


def summary() -> str:
    """One-line-per-category human summary (used at startup)."""
    lines = []
    for cat in sorted(_REGISTRY):
        ks = ", ".join(keys(cat))
        lines.append(f"  {cat:11s}: {ks}")
    return "\n".join(lines)
