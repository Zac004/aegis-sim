#!/usr/bin/env python3
"""
run.py — single entry point for Aegis-Sim.
==========================================

    python run.py                         # launch the app, open a browser
    python run.py --no-browser            # launch the server only
    python run.py --port 8770             # choose a port
    python run.py --headless <scenario>   # run a scenario, print a summary, exit
    python run.py --list                  # list available templates and plugins

Only NumPy is required; SciPy/Numba are optional accelerators.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def _headless(scenario_path: str):
    from core import registry, templates, simulation
    registry.discover_plugins()
    sc = templates.load_scenario_file(scenario_path)
    scenario = templates.build_scenario(sc)
    print(f"Running: {scenario.name}")
    result = simulation.run(scenario)
    print("-" * 50)
    for k, v in result.summary.items():
        print(f"  {k:16s}: {v}")
    print("-" * 50)
    print(f"  OUTCOME: {result.outcome}  (miss {result.miss_distance:.1f} m, "
          f"TOF {result.time_of_flight:.1f} s)")


def _list():
    from core import registry, templates
    registry.discover_plugins()
    print("PLUGINS / REGISTRY:")
    print(registry.summary())
    for kind in ("missiles", "platforms", "scenarios"):
        print(f"\n{kind.upper()}:")
        for t in templates.list_templates(kind):
            print(f"  {t['id']:26s} {t.get('name','')}")


def main():
    import os
    # Deployment-friendly defaults from the environment (PORT/HOST are the
    # conventions most hosts inject). Locally these are unset → the usual
    # 127.0.0.1:8765 with a browser tab.
    env_port = os.environ.get("PORT") or os.environ.get("AEGIS_PORT")
    env_host = os.environ.get("AEGIS_HOST")
    ap = argparse.ArgumentParser(description="Aegis-Sim launcher")
    ap.add_argument("--port", type=int, default=int(env_port) if env_port else 8765)
    ap.add_argument("--host", default=env_host or "127.0.0.1",
                    help="bind address; use 0.0.0.0 to serve externally (hosting)")
    ap.add_argument("--no-browser", action="store_true")
    ap.add_argument("--headless", metavar="SCENARIO.json")
    ap.add_argument("--list", action="store_true")
    args = ap.parse_args()

    if args.list:
        _list()
        return
    if args.headless:
        _headless(args.headless)
        return

    # never try to pop a browser when bound to a non-loopback address (a server)
    open_browser = (not args.no_browser) and args.host in ("127.0.0.1", "localhost")
    from gui.server import serve
    serve(port=args.port, host=args.host, open_browser=open_browser)


if __name__ == "__main__":
    # Windows/frozen: the tactical engine uses a process pool (spawn start
    # method). freeze_support() is a no-op on a normal interpreter but required
    # if this is ever bundled with PyInstaller so worker processes launch clean.
    import multiprocessing
    multiprocessing.freeze_support()
    main()
