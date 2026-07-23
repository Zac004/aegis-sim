"""
gui.server — stdlib HTTP + JSON API for Aegis-Sim.
==================================================

No Flask/FastAPI: a threaded ``http.server`` serves the static Three.js frontend
from ``gui/web`` and exposes a small JSON API that drives the physics core.

Endpoints
---------
  GET  /                         → the app (index.html)
  GET  /api/catalog              → every registered guidance/seeker/etc. (plugins too)
  GET  /api/templates/<kind>     → list missiles | platforms | scenarios
  GET  /api/preset/<kind>/<id>   → one template's JSON
  POST /api/simulate             → { scenario } → telemetry
  POST /api/optimize             → { scenario, knobs, method, objective, n } → study
  POST /api/save                 → { kind, name, data } → persist a template
  GET  /api/atmosphere           → USSA-1976 sample table (for the atmos panel)

Everything is defensive: a handler exception becomes a JSON 400/500 with the
traceback message rather than crashing the server.
"""

from __future__ import annotations

import json
import sys
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, unquote

ROOT = Path(__file__).resolve().parent.parent
WEB_DIR = Path(__file__).resolve().parent / "web"
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core import registry, templates, simulation, optimizer  # noqa: E402
from core import atmosphere as atmo_mod                        # noqa: E402
from core import visuals as visuals_mod                        # noqa: E402

_MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
}


class Handler(BaseHTTPRequestHandler):
    server_version = "AegisSim/1.0"

    # ── helpers ──────────────────────────────────────────────────────────────
    def _send_json(self, obj, status=200):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _send_file(self, path: Path):
        if not path.exists() or not path.is_file():
            self._send_json({"error": f"not found: {path.name}"}, 404)
            return
        data = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", _MIME.get(path.suffix, "application/octet-stream"))
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(data)

    def _read_body(self):
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return {}
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def log_message(self, fmt, *args):  # quieter console, crash-proof
        try:
            line = (fmt % args) if args else str(fmt)
        except Exception:
            line = str(fmt)
        if "/api/" in line:
            sys.stderr.write("  " + line + "\n")

    def do_HEAD(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()

    # ── routing ──────────────────────────────────────────────────────────────
    def do_GET(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        try:
            if path == "/" or path == "/index.html":
                self._send_file(WEB_DIR / "index.html")
            elif path.startswith("/api/"):
                self._route_get_api(path)
            else:
                # static asset under web/
                rel = path.lstrip("/")
                target = (WEB_DIR / rel).resolve()
                if WEB_DIR.resolve() in target.parents or target == WEB_DIR.resolve():
                    self._send_file(target)
                else:
                    self._send_json({"error": "forbidden"}, 403)
        except Exception as e:
            self._send_json({"error": str(e), "trace": traceback.format_exc()}, 500)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        try:
            body = self._read_body()
            if path == "/api/simulate":
                self._api_simulate(body)
            elif path == "/api/optimize":
                self._api_optimize(body)
            elif path == "/api/tactical":
                self._api_tactical(body)
            elif path == "/api/save":
                self._api_save(body)
            elif path == "/api/save_run":
                self._api_save_run(body)
            else:
                self._send_json({"error": f"unknown endpoint {path}"}, 404)
        except Exception as e:
            self._send_json({"error": str(e), "trace": traceback.format_exc()}, 400)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    # ── GET api ──────────────────────────────────────────────────────────────
    def _route_get_api(self, path):
        parts = path.strip("/").split("/")  # e.g. ['api','templates','missiles']
        if parts[1] == "catalog":
            cat = registry.catalog()
            cat.update(visuals_mod.catalog())   # sprites + palettes
            self._send_json(cat)
        elif parts[1] == "templates" and len(parts) >= 3:
            kind = parts[2]
            self._send_json({"templates": templates.list_templates(kind)})
        elif parts[1] == "preset" and len(parts) >= 4:
            kind, ident = parts[2], parts[3]
            self._send_json(templates.load_named(kind, ident))
        elif parts[1] == "atmosphere":
            self._send_json(self._atmosphere_table())
        elif parts[1] == "runs":
            self._send_json({"runs": self._list_runs()})
        elif parts[1] == "run" and len(parts) >= 3:
            self._send_json(self._load_run(parts[2]))
        else:
            self._send_json({"error": f"unknown api {path}"}, 404)

    # ── saved runs (archived 6-DOF engagements) ─────────────────────────────
    def _runs_dir(self):
        d = ROOT / "data" / "saved_runs"
        d.mkdir(parents=True, exist_ok=True)
        return d

    def _list_runs(self):
        out = []
        for f in sorted(self._runs_dir().glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
            try:
                d = json.loads(f.read_text(encoding="utf-8"))
                out.append({"id": f.stem, "name": d.get("name", f.stem),
                            "saved_at": d.get("saved_at"),
                            "outcome": d.get("result", {}).get("outcome"),
                            "summary": d.get("result", {}).get("summary", {})})
            except Exception:
                continue
        return out

    def _load_run(self, run_id):
        f = self._runs_dir() / (run_id if run_id.endswith(".json") else run_id + ".json")
        if not f.exists():
            return {"error": f"run '{run_id}' not found"}
        return json.loads(f.read_text(encoding="utf-8"))

    def _api_save_run(self, body):
        import time
        name = (body.get("name") or "engagement").strip()
        safe = "".join(c for c in name if c.isalnum() or c in "-_ ").strip().replace(" ", "_") or "run"
        safe = f"{safe}_{int(time.time())}"
        rec = {"name": name, "saved_at": time.strftime("%Y-%m-%d %H:%M:%S"),
               "scenario": body.get("scenario"), "result": body.get("result")}
        path = self._runs_dir() / f"{safe}.json"
        path.write_text(json.dumps(rec, ensure_ascii=False), encoding="utf-8")
        self._send_json({"saved": str(path), "id": safe, "name": name})

    def _atmosphere_table(self):
        rows = []
        for h in range(0, 30001, 500):
            s = atmo_mod.properties(float(h))
            rows.append({"alt": h, "T": round(s.temperature, 2),
                         "P": round(s.pressure, 1), "rho": round(s.density, 5),
                         "a": round(s.speed_of_sound, 2)})
        return {"rows": rows}

    # ── POST api ─────────────────────────────────────────────────────────────
    def _api_simulate(self, body):
        scenario_dict = body.get("scenario", body)
        scenario = templates.build_scenario(scenario_dict)
        result = simulation.run(scenario)
        payload = result.to_dict()
        payload["scenario_name"] = scenario.name
        payload["engagement_type"] = scenario.engagement_type
        # a little static context for the 3D scene
        payload["meta"] = {
            "hit_radius": scenario.sim.hit_radius_m,
            "missile_name": scenario.missile.name,
            "target_name": scenario.target.name,
            "target_type": scenario.target.platform_type,
            "missile_category": scenario_dict.get("missile", {}).get("definition", {}).get(
                "category", scenario.engagement_type),
            "missile_visual": scenario.missile.visual,
            "target_visual": scenario.target.visual,
            "shooter_visual": getattr(scenario.shooter, "visual", None) if scenario.shooter else None,
            "shooter_name": getattr(scenario.shooter, "name", None) if scenario.shooter else None,
            "seeker_band": getattr(scenario.missile.seeker, "frequency_band", "-"),
            "seeker_active_range": getattr(scenario.missile.seeker, "acq_range", None),
            "launch_position": scenario.missile.launch_position.tolist(),
        }
        self._send_json(payload)

    def _api_optimize(self, body):
        scenario_dict = body["scenario"]
        knob_specs = body.get("knobs", [])
        knobs = [optimizer.Knob(k["path"], float(k["low"]), float(k["high"]),
                                integer=bool(k.get("integer", False)),
                                label=k.get("label", k["path"])) for k in knob_specs]
        if not knobs:
            knobs = optimizer.default_defender_knobs()
        method = body.get("method", "monte_carlo")
        objective = body.get("objective", "survival")
        n = int(body.get("n", 60))
        # coarsen dt for search speed unless the caller pinned it
        scenario_dict.setdefault("sim", {})
        scenario_dict["sim"]["dt"] = max(scenario_dict["sim"].get("dt", 0.004), 0.006)
        if method == "genetic":
            out = optimizer.genetic_optimize(
                scenario_dict, knobs, generations=int(body.get("generations", 12)),
                pop_size=int(body.get("pop_size", 20)), objective=objective)
        else:
            out = optimizer.monte_carlo(scenario_dict, knobs, n=n, objective=objective)
        self._send_json(out)

    def _api_tactical(self, body):
        """Tactical study: MAR / recommit / best-reaction per altitude band."""
        scenario_dict = body["scenario"]
        alts = body.get("altitudes")
        alts = [float(a) for a in alts] if alts else None
        n_seeds = int(body.get("n_seeds", 2))
        out = optimizer.tactical_study(scenario_dict, altitudes=alts, n_seeds=n_seeds)
        self._send_json(out)

    def _api_save(self, body):
        kind = body["kind"]
        name = body["name"]
        data = body["data"]
        path = templates.save_template(kind, name, data)
        self._send_json({"saved": str(path), "name": name})


def serve(port=8765, host="127.0.0.1", open_browser=True):
    registry.discover_plugins()
    print("=" * 66)
    print("  AEGIS-SIM  ·  Missile Engagement 6-DOF Simulator")
    print("=" * 66)
    print("  Registry loaded:")
    print(registry.summary())
    httpd = ThreadingHTTPServer((host, port), Handler)
    # a link the operator can click locally; on a server (0.0.0.0) show the port
    shown = "127.0.0.1" if host == "0.0.0.0" else host
    url = f"http://{shown}:{port}/"
    print("-" * 66)
    print(f"  Serving on  {host}:{port}   →  {url}")
    print("  Press Ctrl+C to stop.")
    print("=" * 66)
    if open_browser:
        import webbrowser
        import threading
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n  Shutting down.")
        httpd.shutdown()


if __name__ == "__main__":
    serve()
