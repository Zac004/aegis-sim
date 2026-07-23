"""
Aegis-Sim physics & GNC core.
=============================

Pure-Python / NumPy engagement engine. Import order matters only in that
`registry.discover_plugins()` must run once at startup to populate the plugin
catalogue (built-in models + anything under ``plugins/``).

Typical use::

    from core import registry, templates, simulation
    registry.discover_plugins()
    scenario = templates.build_scenario(scenario_dict)
    result = simulation.run(scenario)
    print(result.summary)
"""

from __future__ import annotations

__version__ = "1.0.0"
__all__ = ["registry", "templates", "simulation", "optimizer"]
