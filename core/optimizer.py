"""
core.optimizer — "Tactical AI" Monte-Carlo / genetic optimization engine.
=========================================================================

Two complementary search strategies over a parameterised scenario:

  * :func:`monte_carlo` — sample N random variants of a set of tunable knobs
    (maneuver timing/g, countermeasure release times, guidance N, launch lead)
    and score each engagement, returning the distribution and the best variant.

  * :func:`genetic_optimize` — a light real-valued GA that evolves the same knob
    vector to maximise an objective (e.g. maximise target survival, or minimise
    intercept miss distance), good when the search space is larger.

The objective is configurable so the same engine answers both questions the
brief poses: "Optimal Survival Strategy" (defender view — maximise miss distance)
and "Optimal Intercept Profile" (attacker view — minimise miss distance / TOF).

Knobs are described declaratively so the UI can expose sliders and the engine
stays generic. Each knob maps to a path inside the scenario dict.
"""

from __future__ import annotations

import copy
import random
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Tuple

import numpy as np

from core.templates import build_scenario
from core import simulation

# parallelism config (Windows-spawn safe: worker + init are module-level)
import os as _os
try:
    _CPU = _os.cpu_count() or 2
except Exception:
    _CPU = 2
_MAX_WORKERS = max(1, min(_CPU, 8))
_PARALLEL_THRESHOLD = 6      # only spin up processes when a batch is worth it
_POOL_OK = True              # flipped off if the pool can't start in this env


# ─────────────────────────────────────────────────────────────────────────────
#  Knob description & scenario patching
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class Knob:
    """A tunable scalar mapped to a dotted path inside the scenario dict.

    path : e.g. "missile.guidance_override.N" or
           "target.timeline.0.trigger.value" or
           "target.timeline.1.params.g".
    """
    path: str
    low: float
    high: float
    integer: bool = False
    label: str = ""


def _set_path(d: Dict, path: str, value):
    parts = path.split(".")
    cur = d
    for p in parts[:-1]:
        if p.isdigit():
            cur = cur[int(p)]
        else:
            cur = cur.setdefault(p, {}) if isinstance(cur, dict) else cur
    last = parts[-1]
    if last.isdigit():
        cur[int(last)] = value
    else:
        cur[last] = value


def _apply(scenario_dict: Dict, knobs: List[Knob], vector: List[float]) -> Dict:
    sc = copy.deepcopy(scenario_dict)
    for knob, v in zip(knobs, vector):
        val = int(round(v)) if knob.integer else float(v)
        _set_path(sc, knob.path, val)
    return sc


# ─────────────────────────────────────────────────────────────────────────────
#  Objectives
# ─────────────────────────────────────────────────────────────────────────────

def survival_objective(result: simulation.TelemetryResult) -> float:
    """Defender: bigger miss distance = better. HIT is heavily penalised."""
    if result.outcome == "HIT":
        return -100.0 + result.miss_distance
    return result.miss_distance   # metres of miss (want to maximise)


def intercept_objective(result: simulation.TelemetryResult) -> float:
    """Attacker: smaller miss distance & faster intercept = better (maximise)."""
    base = -result.miss_distance
    if result.outcome == "HIT":
        base += 500.0 - result.time_of_flight  # reward quick kills
    return base


OBJECTIVES: Dict[str, Callable] = {
    "survival": survival_objective,
    "intercept": intercept_objective,
}


# ─────────────────────────────────────────────────────────────────────────────
#  Evaluation (single variant)
# ─────────────────────────────────────────────────────────────────────────────

def _evaluate(scenario_dict: Dict, seed: int | None = None) -> simulation.TelemetryResult:
    sc = build_scenario(scenario_dict)
    # inject determinism into stochastic seekers if they expose an rng
    if seed is not None and hasattr(sc.missile.seeker, "_rng"):
        sc.missile.seeker._rng = np.random.default_rng(seed)
    return simulation.run(sc, record=False)


# ─────────────────────────────────────────────────────────────────────────────
#  Monte-Carlo search
# ─────────────────────────────────────────────────────────────────────────────

def _score_dict(objective: str, r: Dict[str, Any]) -> float:
    """Score a compact worker result the same way the objective functions do."""
    if r.get("outcome") == "ERROR":
        return float("-inf")
    miss = r["miss"]
    if objective == "survival":
        return (-100.0 + miss) if r["outcome"] == "HIT" else miss
    base = -miss
    if r["outcome"] == "HIT":
        base += 500.0 - r["tof"]
    return base


def monte_carlo(scenario_dict: Dict, knobs: List[Knob], n: int = 120,
                objective: str = "survival", seed: int = 0,
                progress: Callable[[float], None] | None = None) -> Dict[str, Any]:
    """Monte-Carlo search over the knob space — now embarrassingly parallel: all
    N variants are built up front and evaluated across the shared process pool."""
    rng = np.random.default_rng(seed)
    vectors = [[rng.uniform(k.low, k.high) for k in knobs] for _ in range(n)]
    sim_seeds = [int(rng.integers(1 << 30)) for _ in range(n)]
    payloads = [{"tag": i, "sc": _apply(scenario_dict, knobs, vectors[i]), "seed": sim_seeds[i]}
                for i in range(n)]
    pool = _SimPool()
    try:
        raw = pool.run(payloads, progress, 0.0, 1.0)
    finally:
        pool.close()
    raw.sort(key=lambda r: r.get("tag", 0))   # restore variant order

    results, best = [], None
    for i, res in enumerate(raw):
        score = _score_dict(objective, res)
        entry = {
            "vector": [int(round(v)) if k.integer else round(float(v), 3)
                       for k, v in zip(knobs, vectors[i])],
            "score": round(float(score), 3) if score != float("-inf") else None,
            "outcome": res.get("outcome"),
            "miss_distance": round(res.get("miss", float("inf")), 2) if res.get("miss") != float("inf") else None,
            "time_of_flight": round(res.get("tof", 0.0), 2),
        }
        results.append(entry)
        if res.get("outcome") != "ERROR" and (best is None or score > best["score_raw"]):
            best = {**entry, "score_raw": score}
    if best:
        best.pop("score_raw", None)

    valid = [r for r in results if r["score"] is not None]
    scores = np.array([r["score"] for r in valid]) if valid else np.array([0.0])
    misses = np.array([r["miss_distance"] for r in valid if r["miss_distance"] is not None]) \
        if valid else np.array([0.0])
    hits = sum(1 for r in results if r["outcome"] == "HIT")
    return {
        "method": "monte_carlo",
        "objective": objective,
        "n": n,
        "parallel": _POOL_OK,
        "errors": sum(1 for r in results if r["outcome"] == "ERROR"),
        "knobs": [{"path": k.path, "label": k.label or k.path,
                   "low": k.low, "high": k.high, "integer": k.integer}
                  for k in knobs],
        "best": best,
        "results": results,
        "stats": {
            "hit_rate": round(hits / n, 3) if n else 0.0,
            "mean_miss": round(float(misses.mean()), 2),
            "median_miss": round(float(np.median(misses)), 2),
            "best_score": round(float(scores.max()), 3),
            "worst_score": round(float(scores.min()), 3),
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
#  Genetic optimization
# ─────────────────────────────────────────────────────────────────────────────

def genetic_optimize(scenario_dict: Dict, knobs: List[Knob],
                     generations: int = 15, pop_size: int = 24,
                     objective: str = "survival", seed: int = 0,
                     elite_frac: float = 0.25, mutation: float = 0.25,
                     progress: Callable[[float], None] | None = None) -> Dict[str, Any]:
    rng = np.random.default_rng(seed)
    obj = OBJECTIVES[objective]
    dim = len(knobs)
    lows = np.array([k.low for k in knobs])
    highs = np.array([k.high for k in knobs])

    pop = rng.uniform(lows, highs, size=(pop_size, dim))
    n_elite = max(2, int(pop_size * elite_frac))
    history = []
    best_ever = None

    total = generations
    for gen in range(generations):
        scored = []
        for ind in pop:
            sc = _apply(scenario_dict, knobs, ind.tolist())
            res = _evaluate(sc, seed=int(rng.integers(1 << 30)))
            scored.append((obj(res), ind, res))
        scored.sort(key=lambda x: x[0], reverse=True)
        elites = [s[1] for s in scored[:n_elite]]
        best_score, best_ind, best_res = scored[0]
        if best_ever is None or best_score > best_ever["score"]:
            best_ever = {
                "vector": [int(round(v)) if k.integer else round(float(v), 3)
                           for k, v in zip(knobs, best_ind)],
                "score": round(float(best_score), 3),
                "outcome": best_res.outcome,
                "miss_distance": round(best_res.miss_distance, 2),
                "time_of_flight": round(best_res.time_of_flight, 2),
            }
        history.append({"generation": gen,
                        "best_score": round(float(best_score), 3),
                        "mean_score": round(float(np.mean([s[0] for s in scored])), 3)})

        # reproduce: elites + crossover/mutation children
        children = list(elites)
        while len(children) < pop_size:
            a, b = elites[rng.integers(n_elite)], elites[rng.integers(n_elite)]
            mask = rng.random(dim) < 0.5
            child = np.where(mask, a, b)
            # gaussian mutation scaled to each knob's range
            child = child + rng.normal(0, mutation, dim) * (highs - lows)
            child = np.clip(child, lows, highs)
            children.append(child)
        pop = np.array(children)
        if progress:
            progress((gen + 1) / total)

    return {
        "method": "genetic",
        "objective": objective,
        "generations": generations,
        "pop_size": pop_size,
        "knobs": [{"path": k.path, "label": k.label or k.path} for k in knobs],
        "best": best_ever,
        "history": history,
    }


def default_defender_knobs() -> List[Knob]:
    """A sensible default knob set for the 'optimal survival' study."""
    return [
        Knob("target.timeline.0.trigger.value", 0.0, 8.0, label="Break time (s)"),
        Knob("target.timeline.0.params.g", 4.0, 9.0, label="Break g"),
    ]


# ═════════════════════════════════════════════════════════════════════════════
#  TACTICAL ENGINE — the BVR kneeboard, computed in parallel from full 6-DOF runs
# ═════════════════════════════════════════════════════════════════════════════
#
# Answers the questions a pilot actually briefs, per altitude, entirely from
# physics (no lookup tables — every number is reproducible by flying it):
#
#   Rmax   max launch range that kills a hot, non-reacting target.
#   MAR    Minimum Abort Range — inside it, turning cold no longer saves you
#          (the no-escape boundary).
#   abort-G       softest cold turn that still defeats a shot just outside MAR.
#   aspect+G      the least aspect change (beam vs full cold) and the G needed to
#                 defeat the briefed shot if you can't out-range it.
#   SRRC   Short-Range ReCommit — shooter→you range when the aborted-against
#          missile finally dies: how close you can be when you turn back hot.
#   cold-time     seconds you must hold the cold course before that happens.
#   notch window  the time-to-impact at which a committed notch+chaff works best.
#   decision table   range-banded "what to do at what distance".
#   pole study    (A2A) straight vs crank 30/45/55 → A-pole / F-pole trade.
#
# EFFICIENCY: instead of long sequential bisections, the study builds every
# independent engagement it needs, flattens them into two waves, and runs each
# wave across a process pool (falling back to serial if a pool can't start). A
# study that used to take ~2 minutes now finishes in a handful of seconds.


# ── process-pool plumbing (module-level so it's picklable under spawn) ─────────

def _worker_init():
    try:
        from core import registry
        registry.discover_plugins()
    except Exception:
        pass


def _sim_eval(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Run one engagement and return a compact, picklable result."""
    from core import templates as _T, simulation as _S
    import numpy as _np
    sc = payload["sc"]
    seed = payload.get("seed")
    record = payload.get("record", False)
    try:
        scn = _T.build_scenario(sc)
        if seed is not None and hasattr(scn.missile.seeker, "_rng"):
            scn.missile.seeker._rng = _np.random.default_rng(seed)
        res = _S.run(scn, record=record)
    except Exception as e:                       # never let one variant sink the study
        return {"tag": payload.get("tag"), "outcome": "ERROR", "miss": float("inf"),
                "tof": 0.0, "err": str(e)}
    s = res.summary or {}
    out = {"tag": payload.get("tag"), "outcome": res.outcome,
           "miss": float(res.miss_distance), "tof": float(res.time_of_flight),
           "a_pole": s.get("a_pole"), "f_pole": s.get("f_pole"),
           "pitbull_range": s.get("pitbull_range")}
    if record:
        sr = res.channels.get("shooter_range") or []
        asp = res.channels.get("aspect_deg") or []
        out["shooter_range_end"] = float(sr[-1]) if sr else None
        out["min_aspect"] = float(min(asp)) if asp else None
    return out


class _SimPool:
    """One warm process pool for an entire study (both waves share it, so the
    ~0.5-1 s/worker spawn cost is paid ONCE, not per batch). Falls back to serial
    evaluation transparently if a pool can't start in this environment. Worker
    exceptions are caught per-task so a single bad variant can never sink a study.
    """

    def __init__(self, want_parallel: bool = True):
        global _POOL_OK
        self.ex = None
        if want_parallel and _POOL_OK:
            try:
                from concurrent.futures import ProcessPoolExecutor
                self.ex = ProcessPoolExecutor(max_workers=_MAX_WORKERS,
                                              initializer=_worker_init)
            except Exception:
                _POOL_OK = False
                self.ex = None
        if self.ex is None:
            _worker_init()

    def run(self, payloads: List[Dict[str, Any]],
            progress: Callable[[float], None] | None = None,
            lo: float = 0.0, hi: float = 1.0) -> List[Dict[str, Any]]:
        n = len(payloads)
        if n == 0:
            return []
        if self.ex is None:                       # serial fallback
            out = []
            for i, p in enumerate(payloads):
                out.append(_sim_eval(p))
                if progress:
                    progress(lo + (hi - lo) * (i + 1) / n)
            return out
        from concurrent.futures import as_completed
        results: List[Any] = [None] * n
        futs = {self.ex.submit(_sim_eval, p): i for i, p in enumerate(payloads)}
        done = 0
        for fut in as_completed(futs):
            i = futs[fut]
            try:
                results[i] = fut.result()
            except Exception as e:                # dead worker → mark, don't crash
                results[i] = {"tag": payloads[i].get("tag"), "outcome": "ERROR",
                              "miss": float("inf"), "tof": 0.0, "err": str(e)}
            done += 1
            if progress:
                progress(lo + (hi - lo) * done / n)
        return results

    def close(self):
        if self.ex is not None:
            try:
                self.ex.shutdown(wait=True)
            except Exception:
                pass
            self.ex = None


# ── scenario-variant builders ─────────────────────────────────────────────────

_ABORT_G = 7.0
_TACTIC_OPTIONS = [
    ("No reaction (press hot)", []),
    ("Abort — turn cold, run", [
        {"trigger": {"type": "event", "value": "missile_launched"},
         "maneuver": "go_cold", "params": {"g": _ABORT_G}}]),
    ("Notch + chaff @ TTI 8 s", [
        {"trigger": {"type": "tti", "value": 8.0}, "maneuver": "notch",
         "params": {"g": 6.0},
         "countermeasure": {"type": "chaff", "count": 8, "intensity": 1.0, "duration": 4.0}}]),
    ("Notch, then last-ditch break", [
        {"trigger": {"type": "tti", "value": 9.0}, "maneuver": "notch",
         "params": {"g": 6.0},
         "countermeasure": {"type": "chaff", "count": 6, "intensity": 1.0, "duration": 4.0}},
        {"trigger": {"type": "tti", "value": 3.0}, "maneuver": "break_turn",
         "params": {"g": 8.5, "direction": "right"}}]),
    ("Drag & dive to the deck", [
        {"trigger": {"type": "event", "value": "missile_launched"},
         "maneuver": "go_cold", "params": {"g": _ABORT_G}},
        {"trigger": {"type": "tti", "value": 12.0}, "maneuver": "dive",
         "params": {"g": 3.0}}]),
]


def _variant(base: Dict, alt_m: float, range_km: float, timeline: List[dict],
             fast: bool = True) -> Dict:
    sc = copy.deepcopy(base)
    geo = sc.setdefault("geometry", {})
    geo["range_km"] = float(range_km)
    geo["altitude_m"] = float(alt_m)
    if sc.get("engagement_type") != "surface_to_air":
        geo["target_altitude_m"] = float(alt_m)
        geo.setdefault("aspect_deg", 180)
    sc.setdefault("target", {})["timeline"] = copy.deepcopy(timeline)
    sim = sc.setdefault("sim", {})
    # Optional per-study time ceiling (set to the weapon's battery life + margin):
    # a missile physically cannot guide past its battery, so there's no point — and
    # it's wrong — to simulate longer. A persistent ramjet needs its full ~260 s to
    # complete a long chase, or an aborting target looks safe when it isn't (MAR
    # under-read); a short-battery WVR round needs far less, keeping the study fast.
    tcap = sim.pop("_tcap", None)
    ceil_fast = float(tcap) if tcap else 165.0
    ceil_slow = (float(tcap) + 45.0) if tcap else 340.0
    sim["dt"] = 0.012 if fast else max(float(sim.get("dt", 0.006)), 0.008)
    sim["max_time"] = float(min(22.0 + range_km * 2.8, ceil_fast)) if fast else \
        float(min(30.0 + range_km * 3.4, ceil_slow))
    sim["output_rate_hz"] = 12
    return sc


def _abort_tl(g: float) -> List[dict]:
    return [{"trigger": {"type": "event", "value": "missile_launched"},
             "maneuver": "go_cold", "params": {"g": g}}]


def _notch_tl(tti: float, g: float = 6.0) -> List[dict]:
    return [{"trigger": {"type": "tti", "value": float(tti)}, "maneuver": "notch",
             "params": {"g": g},
             "countermeasure": {"type": "chaff", "count": 8, "intensity": 1.0, "duration": 4.0}}]


def _finite_misses(misses):
    """Drop NaN / inf (worker errors) from a seed sample of miss distances."""
    return [m for m in misses if isinstance(m, (int, float)) and m == m and m != float("inf")]


def _boundary_range(samples, hit_r: float):
    """Accurate kill-boundary range from seed samples of miss distance.

    samples : list of (range_km, [miss_over_seeds]). Returns
              (boundary_km, in_grid_bool).

    Method (robust + sub-grid accurate): at each range compute the kill fraction
    P_kill = fraction of (non-error) seeds whose miss ≤ lethal radius, and the
    MEDIAN miss (outlier-robust). Locate the grid cell where P_kill crosses 0.5
    going outbound (kill → no-kill), then refine WITHIN that cell by linearly
    interpolating where the median miss crosses the lethal radius. This defines
    the boundary as "the range at which kill probability = 50%", localised to
    well below the grid spacing — far more accurate than a boolean midpoint and
    immune to single-seed seeker-noise flips.
    """
    pts = []
    for r, misses in sorted(samples, key=lambda s: s[0]):
        fin = _finite_misses(misses)
        if not fin:
            continue
        p_kill = sum(1 for m in fin if m <= hit_r) / len(fin)
        pts.append((float(r), p_kill, float(np.median(fin))))
    if not pts:
        return None, False
    if all(p >= 0.5 for _, p, _ in pts):
        return pts[-1][0], False       # kills across the whole grid → boundary is beyond it
    if all(p < 0.5 for _, p, _ in pts):
        return pts[0][0], False        # never kills → boundary below the grid
    bnd = pts[0][0]
    for i in range(len(pts) - 1):
        r0, p0, m0 = pts[i]
        r1, p1, m1 = pts[i + 1]
        if p0 >= 0.5 and p1 < 0.5:      # outbound kill→no-kill crossing
            if m1 > m0 and m0 <= hit_r <= m1:
                f = (hit_r - m0) / (m1 - m0)     # sub-cell refine on the continuous miss
            else:
                f = 0.5
            bnd = r0 + max(0.0, min(1.0, f)) * (r1 - r0)
    return bnd, True


def tactical_study(scenario_dict: Dict,
                   altitudes: List[float] | None = None,
                   n_seeds: int = 2,
                   progress: Callable[[float], None] | None = None) -> Dict[str, Any]:
    """Compute the full BVR kneeboard vs this scenario's missile.

    World-class, error-safe, and efficient:
      * ONE warm process pool for the whole study (spawn cost paid once).
      * Rmax / MAR from a single dense range grid, seed-averaged, with sub-grid
        boundary interpolation on the continuous median miss vs lethal radius —
        so the numbers are accurate to well under the grid spacing and immune to
        single-seed seeker-noise flips.
      * Every reaction study at the briefed range runs concurrently with the grid
        (only the abort-G sweep + recorded recommit depend on MAR → tiny wave B).
      * ERROR results are filtered out everywhere (a crashed variant never counts
        as a survival), so the statistics stay honest.
    """
    base = copy.deepcopy(scenario_dict)
    geo = base.get("geometry", {})
    base_range = float(geo.get("range_km", 40.0))
    base_alt = float(geo.get("altitude_m", 9000.0))
    hit_r = float(base.get("sim", {}).get("hit_radius_m", 15.0))
    if altitudes is None:
        altitudes = [3000.0, 9000.0]
    seeds = [11 + 7 * k for k in range(max(1, int(n_seeds)))]
    gseeds = seeds[:2] if len(seeds) >= 2 else seeds   # 2 seeds is enough for a P_kill grid
    is_a2a = base.get("engagement_type") != "surface_to_air"
    # this weapon's own seeker acquisition range (the pitbull / WVR handover)
    try:
        mdef = base.get("missile", {}).get("definition")
        if not mdef:
            from core import templates as _T
            mdef = _T.load_named("missiles", base["missile"]["template"])
        pit_km = float(mdef.get("seeker", {}).get("params", {}).get("acquisition_range", 18000)) / 1000.0
    except Exception:
        pit_km = 18.0
    # Simulate at most to the weapon's battery death (+ margin): the physical cap
    # on flight time. This makes long-range/ramjet studies accurate (the full
    # chase plays out) without wasting time on impossible flight beyond it.
    try:
        batt = float(mdef.get("battery_s", 100.0 if is_a2a else 240.0))
    except Exception:
        batt = 100.0 if is_a2a else 240.0
    base.setdefault("sim", {})["_tcap"] = min(batt + 25.0, 320.0)

    grid_hi = max(base_range * 2.2, 60.0)
    grid = [round(float(r), 2) for r in np.linspace(8.0, grid_hi, 9)]
    pool = _SimPool()
    try:
        # ── WAVE A : range grid (Rmax+MAR) + all briefed-range studies + poles ──
        # everything here is independent of MAR, so it all runs concurrently.
        wA = []
        for ai, alt in enumerate(altitudes):
            for r in grid:
                for si, sd in enumerate(gseeds):
                    wA.append({"tag": ("hot", ai, r, si), "sc": _variant(base, alt, r, []), "seed": sd})
                    wA.append({"tag": ("abt", ai, r, si), "sc": _variant(base, alt, r, _abort_tl(_ABORT_G)), "seed": sd})
            for sd in seeds:
                wA.append({"tag": ("aBeam", ai, sd), "sc": _variant(base, alt, base_range, _notch_tl(9.0, 6.0)), "seed": sd})
                wA.append({"tag": ("aCold", ai, sd), "sc": _variant(base, alt, base_range, _abort_tl(6.0)), "seed": sd})
            for tti in (5.0, 8.0, 12.0):
                for sd in seeds:
                    wA.append({"tag": ("nt", ai, tti, sd), "sc": _variant(base, alt, base_range, _notch_tl(tti)), "seed": sd})
            for oi, (name, tl) in enumerate(_TACTIC_OPTIONS):
                for sd in seeds:
                    wA.append({"tag": ("opt", ai, oi, sd), "sc": _variant(base, alt, base_range, tl), "seed": sd})
        if is_a2a:
            base_tl = base.get("target", {}).get("timeline", []) or []
            for pi, (label, support, angle) in enumerate((("Straight (press)", "straight", 0),
                                                          ("Crank 30°", "crank", 30),
                                                          ("Crank 45°", "crank", 45),
                                                          ("Crank 55°", "crank", 55))):
                scv = _variant(base, base_alt, base_range, base_tl)
                sh = scv.setdefault("shooter", {}); sh["support"] = support
                if angle:
                    sh["crank_angle_deg"] = angle
                wA.append({"tag": ("pole", pi, label), "sc": scv, "seed": seeds[0]})
        RA = {res["tag"]: res for res in pool.run(wA, progress, 0.0, 0.6)}

        # Rmax / MAR per altitude from the seed-averaged grid (accurate interp).
        # Flag altitudes whose boundary sits at the far edge → the true value is
        # BEYOND the grid (long-range / ramjet class) and needs an extension sweep.
        rmax_by, mar_by, hot_by, abt_by = {}, {}, {}, {}
        ext_rmax, ext_mar = [], []
        for ai, alt in enumerate(altitudes):
            hot_by[ai] = [(r, [RA[("hot", ai, r, si)]["miss"] for si in range(len(gseeds))]) for r in grid]
            abt_by[ai] = [(r, [RA[("abt", ai, r, si)]["miss"] for si in range(len(gseeds))]) for r in grid]
            rmax, rmax_in = _boundary_range(hot_by[ai], hit_r)
            mar, mar_in = _boundary_range(abt_by[ai], hit_r)
            rmax_by[ai] = rmax if rmax is not None else grid[-1]
            mar_by[ai] = mar if mar is not None else grid[0]
            if not rmax_in and rmax is not None and rmax >= grid[-1] - 1e-6:
                ext_rmax.append(ai)
            if not mar_in and mar is not None and mar >= grid[-1] - 1e-6:
                ext_mar.append(ai)

        # ── WAVE B : adaptive grid EXTENSION for weapons that reach past the grid ─
        ext_grid = [round(float(r), 2) for r in np.linspace(grid_hi * 1.12,
                    max(grid_hi * 3.8, 380.0), 6)] if (ext_rmax or ext_mar) else []
        wB = []
        for ai in ext_rmax:
            for r in ext_grid:
                for si, sd in enumerate(gseeds):
                    wB.append({"tag": ("hotx", ai, r, si), "sc": _variant(base, altitudes[ai], r, []), "seed": sd})
        for ai in ext_mar:
            for r in ext_grid:
                for si, sd in enumerate(gseeds):
                    wB.append({"tag": ("abtx", ai, r, si), "sc": _variant(base, altitudes[ai], r, _abort_tl(_ABORT_G)), "seed": sd})
        if wB:
            RB = {res["tag"]: res for res in pool.run(wB, progress, 0.6, 0.75)}
            for ai in ext_rmax:
                ex = [(r, [RB[("hotx", ai, r, si)]["miss"] for si in range(len(gseeds))]) for r in ext_grid]
                r2, _ = _boundary_range(hot_by[ai] + ex, hit_r)
                if r2 is not None:
                    rmax_by[ai] = r2
            for ai in ext_mar:
                ex = [(r, [RB[("abtx", ai, r, si)]["miss"] for si in range(len(gseeds))]) for r in ext_grid]
                m2, _ = _boundary_range(abt_by[ai] + ex, hit_r)
                if m2 is not None:
                    mar_by[ai] = m2
        else:
            RB = {}

        # ── WAVE C : MAR-dependent runs, now positioned off the CORRECTED MAR ────
        wC = []
        for ai, alt in enumerate(altitudes):
            mar = mar_by[ai]
            gtest = max(mar * 1.2, mar + 4.0)
            for g in (3.0, 5.0, 7.0):
                for sd in seeds:
                    wC.append({"tag": ("gG", ai, g, sd), "sc": _variant(base, alt, gtest, _abort_tl(g)), "seed": sd})
            wC.append({"tag": ("rec", ai), "sc": _variant(base, alt, max(mar * 1.3, mar + 8.0),
                       _abort_tl(_ABORT_G), fast=False), "seed": seeds[0], "record": True})
        RC = {res["tag"]: res for res in pool.run(wC, progress, 0.75, 0.99)}
    finally:
        pool.close()

    R = {**RA, **RB, **RC}

    def surv(prefix, *key):
        """Survival fraction + mean miss over seeds, EXCLUDING crashed variants."""
        vals = [R[t] for t in R if t[0] == prefix and t[1:1 + len(key)] == key
                and R[t].get("outcome") != "ERROR"]
        if not vals:
            return 0.0, float("inf")
        ok = sum(1 for v in vals if v["outcome"] != "HIT")
        misses = _finite_misses([v["miss"] for v in vals])
        return ok / len(vals), (float(np.mean(misses)) if misses else float("inf"))

    rows = []
    for ai, alt in enumerate(altitudes):
        rmax_km = round(rmax_by[ai], 1)
        mar_km = round(min(mar_by[ai], rmax_by[ai]), 1)   # MAR can never exceed Rmax

        # minimum abort-G
        min_abort_g = None
        for g in (3.0, 5.0, 7.0):
            s, _ = surv("gG", ai, g)
            if s >= 0.5:
                min_abort_g = g
                break

        # aspect + G required (least aspect change that survives the briefed shot)
        beam_s, _ = surv("aBeam", ai)
        cold_s, _ = surv("aCold", ai)
        if beam_s >= 0.5:
            aspect_req = {"final_aspect": 90, "change_deg": 90, "g": 6.0, "survival": round(beam_s, 2),
                          "label": "beam (notch) + chaff"}
        elif cold_s >= 0.5:
            aspect_req = {"final_aspect": 0, "change_deg": 180, "g": 6.0, "survival": round(cold_s, 2),
                          "label": "full cold turn"}
        else:
            aspect_req = {"final_aspect": 0, "change_deg": 180, "g": _ABORT_G, "survival": round(cold_s, 2),
                          "label": "no aspect change reliably survives this shot"}

        # notch window
        notch_best = None
        for tti in (5.0, 8.0, 12.0):
            s, mm = surv("nt", ai, tti)
            if notch_best is None or s > notch_best["survival"] or (s == notch_best["survival"] and mm > notch_best["mean_miss_m"]):
                notch_best = {"tti_s": tti, "survival": round(s, 2),
                              "mean_miss_m": round(mm, 1) if mm != float("inf") else None}

        # SRRC + cold-time from the recorded abort
        rec = R.get(("rec", ai), {})
        cold_time_s = srrc_km = rec_km = None
        if rec.get("outcome") in ("LOST_ENERGY", "MISS", "GROUND", "TIMEOUT"):
            cold_time_s = round(rec.get("tof") or 0.0, 1)
            if rec.get("shooter_range_end") is not None:
                srrc_km = rec_km = round(rec["shooter_range_end"] / 1000.0, 1)

        # committed-defence menu
        options = []
        for oi, (name, _tl) in enumerate(_TACTIC_OPTIONS):
            s, mm = surv("opt", ai, oi)
            options.append({"name": name, "survival": round(s, 2),
                            "mean_miss_m": round(mm, 1) if mm != float("inf") else None})
        best = max(options, key=lambda o: (o["survival"], o["mean_miss_m"] or 0.0))

        decision = _decision_table(rmax_km, mar_km, pit_km, min_abort_g,
                                   aspect_req, notch_best, best)

        rows.append({
            "altitude_m": alt, "rmax_km": rmax_km, "mar_km": mar_km,
            "mar_pct_rmax": round(100.0 * mar_km / rmax_km, 0) if rmax_km > 0 else None,
            "pitbull_km": round(pit_km, 1),
            "min_abort_g": min_abort_g, "aspect_required": aspect_req,
            "notch": notch_best, "srrc_km": srrc_km, "cold_time_s": cold_time_s,
            "recommit_km": rec_km, "recommit_s": cold_time_s,
            "options": options, "best_option": best["name"], "decision": decision,
            "advice": _advice_line(alt, rmax_km, mar_km, min_abort_g, aspect_req,
                                   notch_best, cold_time_s, srrc_km, best, base_range),
        })

    poles = []
    if is_a2a:
        for t in sorted([t for t in R if t[0] == "pole"], key=lambda t: t[1]):
            res = R[t]
            poles.append({"profile": t[2], "outcome": res["outcome"],
                          "a_pole_km": round(res["a_pole"] / 1000.0, 1) if res.get("a_pole") else None,
                          "f_pole_km": round(res["f_pole"] / 1000.0, 1) if res.get("f_pole") else None,
                          "tof_s": round(res["tof"], 1)})

    if progress:
        progress(1.0)
    n_err = sum(1 for t in R if R[t].get("outcome") == "ERROR")
    return {
        "method": "tactical",
        "threat": (scenario_dict.get("missile", {}).get("definition", {}) or {}).get("name")
                  or scenario_dict.get("missile", {}).get("template", "threat missile"),
        "base_range_km": base_range, "base_altitude_m": base_alt,
        "n_seeds": len(seeds), "parallel": _POOL_OK, "hit_radius_m": hit_r,
        "sims": len(R), "errors": n_err, "rows": rows, "poles": poles,
    }


def _decision_table(rmax, mar, pit, min_g, aspect_req, notch, best):
    """Range-banded 'what to do at what distance', from this weapon's numbers."""
    g = min_g or _ABORT_G
    nt = notch["tti_s"] if notch else 8.0
    bands = [
        {"lo": rmax, "hi": None, "zone": "MONITOR",
         "action": f"Outside Rmax (~{rmax:.0f} km) — no kinematic threat. Build the picture, sort, and prep your own shot."},
        {"lo": mar, "hi": rmax, "zone": "ABORT LANE",
         "action": f"Inside Rmax but outside MAR (~{mar:.0f} km). If fired on, ABORT: turn cold at {g:.0f} g and run — you defeat it kinematically. Skate here."},
        {"lo": pit if pit < mar else max(mar * 0.35, 3.0), "hi": mar, "zone": "COMMITTED / NO-ESCAPE",
         "action": f"Inside MAR — running won't save you. Best defence: {best['name']}. Change aspect to the {aspect_req['label']} (~{aspect_req['change_deg']}° turn, {aspect_req['g']:.0f} g), notch+chaff around TTI {nt:.0f} s, last-ditch break at TTI 3 s."},
        {"lo": 0.0, "hi": pit if pit < mar else max(mar * 0.35, 3.0), "zone": "MERGE / WVR",
         "action": f"Inside the seeker's own acquisition (~{pit:.0f} km) — WVR rules. Fight for the first HOBS shot, deny his, use the vertical."},
    ]
    return [b for b in bands if b["hi"] is None or b["hi"] > (b["lo"] or 0)]


def _advice_line(alt, rmax_km, mar_km, min_g, aspect_req, notch, cold_time,
                 srrc_km, best, base_range) -> str:
    a = (f"At {alt/1000:.0f} km altitude this weapon kills a hot, non-reacting target out to "
         f"≈{rmax_km:.0f} km; your abort line (MAR) is ≈{mar_km:.0f} km — turn cold before it or you're "
         f"in the no-escape zone.")
    if min_g:
        a += f" Just outside MAR a {min_g:.0f} g cold turn suffices."
    if aspect_req and aspect_req.get("survival", 0) > 0:
        a += f" If committed at {base_range:.0f} km, the least aspect change that survives is the {aspect_req['label']} (~{aspect_req['change_deg']}° at {aspect_req['g']:.0f} g)."
    if cold_time:
        a += f" After a clean abort you must hold the cold course ≈{cold_time:.0f} s" + (
            f"; your short-range recommit (SRRC) is ≈{srrc_km:.0f} km — that's how close you can be when you turn back hot." if srrc_km else ".")
    if best and best["survival"] > 0:
        a += f" Best committed reaction overall: {best['name']} ({best['survival']*100:.0f}%)."
    return a
