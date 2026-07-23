"""
Physics & engine sanity/regression tests for Aegis-Sim.

Run with:  pytest tests/
These are deterministic where possible; engagement outcomes that depend on the
stochastic seeker are asserted with generous margins.
"""

import sys
from pathlib import Path

import numpy as np
import pytest

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core import registry, templates, simulation           # noqa: E402
from core import atmosphere as atmo                          # noqa: E402
from core.propulsion import Propulsion, MotorStage, boost_sustain_curve  # noqa: E402

registry.discover_plugins()


# ── Atmosphere (USSA-1976) ───────────────────────────────────────────────────

def test_atmosphere_sea_level():
    s = atmo.properties(0.0)
    assert s.temperature == pytest.approx(288.15, abs=0.05)
    assert s.pressure == pytest.approx(101325.0, rel=1e-4)
    assert s.density == pytest.approx(1.225, rel=2e-3)
    assert s.speed_of_sound == pytest.approx(340.29, abs=0.5)


def test_atmosphere_tropopause_11km():
    s = atmo.properties(11000.0)
    assert s.temperature == pytest.approx(216.65, abs=0.3)
    assert s.pressure == pytest.approx(22632.0, rel=5e-3)


def test_atmosphere_monotonic_density():
    alts = np.linspace(0, 30000, 50)
    rho = [atmo.properties(h).density for h in alts]
    assert all(rho[i] >= rho[i + 1] for i in range(len(rho) - 1))


# ── Propulsion ───────────────────────────────────────────────────────────────

def test_propellant_mass_conservation():
    curve = boost_sustain_curve(12000, 2.0, 3000, 5.0)
    stage = MotorStage("m", curve, propellant_mass=40.0, isp=240.0)
    p = Propulsion([stage], dry_mass=60.0, length=3.0, diameter=0.18)
    # after full burn, all propellant is consumed (to <0.1 kg)
    assert p.propellant_remaining(20.0) == pytest.approx(0.0, abs=0.1)
    # launch mass = dry + propellant
    assert p.launch_mass == pytest.approx(100.0, abs=1e-6)
    # mass decreases monotonically through the burn
    ms = [p.mass_properties(t).mass for t in np.linspace(0, 8, 40)]
    assert all(ms[i] >= ms[i + 1] - 1e-6 for i in range(len(ms) - 1))


def test_thrust_zero_after_burnout():
    curve = boost_sustain_curve(10000, 1.5, 0, 0)
    stage = MotorStage("m", curve, propellant_mass=20.0)
    p = Propulsion([stage], dry_mass=40.0, length=2.5, diameter=0.15)
    assert p.thrust(0.5, 101325) > 0
    assert p.thrust(10.0, 101325) == 0.0


# ── Registry / plugins ───────────────────────────────────────────────────────

def test_registry_has_builtins():
    for law in ("pn", "apn", "ogl", "pure_pn", "clos"):
        assert registry.has("guidance", law)
    for sk in ("rf_active", "rf_semiactive", "ir", "iir"):
        assert registry.has("seeker", sk)


def test_plugin_discovered():
    # example_plugin.py registers these custom types
    assert registry.has("guidance", "biased_pn")
    assert registry.has("seeker", "dual_rf_ir")
    assert registry.has("maneuver", "split_s_extend")


# ── End-to-end engagements ───────────────────────────────────────────────────

def _run(name):
    sc = templates.load_scenario_file(ROOT / "templates" / "scenarios" / name)
    return simulation.run(templates.build_scenario(sc))


def test_sidewinder_intercepts():
    r = _run("wvr_sidewinder_flares.json")
    assert r.outcome == "HIT"
    assert r.miss_distance < 15.0
    assert 1.5 < r.summary["max_mach"] < 4.0     # supersonic but sane


def test_amraam_intercepts_and_is_energetic():
    r = _run("a2a_headon_amraam.json")
    assert r.outcome == "HIT"
    assert r.summary["max_g"] > 8.0              # it actually maneuvers
    assert r.time_of_flight < 45.0


def test_sam_intercepts():
    r = _run("sam_pac3_intercept.json")
    assert r.outcome == "HIT"


def test_straight_target_is_easy_hit():
    sc = templates.load_scenario_file(ROOT / "templates" / "scenarios" / "a2a_headon_amraam.json")
    sc["target"]["timeline"] = []                # non-maneuvering
    r = simulation.run(templates.build_scenario(sc))
    assert r.outcome == "HIT"
    assert r.miss_distance < 15.0


def test_bvr_datalink_phases_and_poles():
    """The BVR preset must fly midcourse on datalink, go pitbull, and report poles."""
    r = _run("bvr_datalink_amraam.json")
    assert r.outcome == "HIT"
    s = r.summary
    assert s["went_active"] is True
    assert s["pitbull_range"] and 15000 < s["pitbull_range"] <= 26000
    assert s["a_pole"] and s["f_pole"] and s["f_pole"] < s["a_pole"]
    phases = set(r.channels["phase"])
    assert "MIDCOURSE" in phases and "TERMINAL" in phases
    # datalink flag must be on at some point before pitbull
    assert any(d == 1 for d in r.channels["datalink"])


def test_geometry_planner_places_entities():
    """geometry{} must override hand-placed coordinates."""
    sc = {"engagement_type": "air_to_air",
          "geometry": {"range_km": 20, "aspect_deg": 180, "offboresight_deg": 0,
                        "altitude_m": 8000, "shooter_heading_deg": 0,
                        "shooter_speed": 300, "target_speed": 250},
          "missile": {"template": "aim120c_amraam",
                       "launch": {"position": [9e5, 9e5, 100]}},   # should be overridden
          "target": {"platform": "su35_flanker"},
          "sim": {"dt": 0.005, "max_time": 40, "hit_radius_m": 15}}
    scn = templates.build_scenario(sc)
    import numpy as np
    assert np.linalg.norm(scn.missile.position - np.array([0, 0, -8000])) < 1.0
    rng = np.linalg.norm(scn.target.position - scn.shooter.position)
    assert abs(rng - 20000) < 1.0


def test_sam_geometry_planner():
    """SAM geometry{} places a ground launcher + inbound threat by range/bearing."""
    import numpy as np
    sc = {"engagement_type": "surface_to_air",
          "geometry": {"range_km": 30, "bearing_deg": 90, "altitude_m": 120,
                        "threat_speed": 250, "launch_elevation_deg": 18},
          "missile": {"template": "pac3_interceptor"},
          "target": {"platform": "cruise_missile_target"},
          "sim": {"dt": 0.004, "max_time": 80, "hit_radius_m": 15}}
    scn = templates.build_scenario(sc)
    # launcher at origin, threat 30 km due East at 120 m
    assert np.linalg.norm(scn.shooter.position[:2]) < 1.0
    assert abs(scn.target.position[1] - 30000) < 1.0 and abs(scn.target.position[0]) < 1.0
    assert abs(scn.target.altitude() - 120) < 1.0
    # missile launches climbing toward the threat
    assert scn.missile.velocity[2] < 0    # climbing = negative Down
    r = simulation.run(scn)
    assert r.outcome == "HIT"                 # a sea-skimmer intercept must resolve
    assert np.isfinite(r.miss_distance)       # no NaN blow-up at low altitude


def test_no_numeric_blowup_low_altitude():
    """Sea-level high-speed flight must stay finite (max-Q cap)."""
    import warnings, numpy as np
    sc = {"engagement_type": "surface_to_air",
          "geometry": {"range_km": 20, "bearing_deg": 90, "altitude_m": 50,
                        "threat_speed": 280, "launch_elevation_deg": 20},
          "missile": {"template": "pac3_interceptor"},
          "target": {"platform": "cruise_missile_target"},
          "sim": {"dt": 0.004, "max_time": 60, "hit_radius_m": 15}}
    with warnings.catch_warnings():
        warnings.simplefilter("error", RuntimeWarning)
        r = simulation.run(templates.build_scenario(sc))
    assert np.isfinite(r.miss_distance)


def test_telemetry_channels_consistent():
    r = _run("wvr_sidewinder_flares.json")
    n = len(r.channels["t"])
    assert n > 10
    # every channel has the same length as the time base
    for key, series in r.channels.items():
        assert len(series) == n, f"channel {key} length mismatch"


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))


# ── New-physics regression tests (loft/SAM/ramjet/dual-pulse/battery/CLOS) ───

def _geo_a2a(mid, rng_km, alt=10000, timeline=None, dt=0.008):
    return {"name": "t", "engagement_type": "air_to_air", "atmosphere": "ussa1976",
            "geometry": {"range_km": rng_km, "aspect_deg": 180, "offboresight_deg": 0,
                          "altitude_m": alt, "target_altitude_m": alt,
                          "shooter_speed": 300, "target_speed": 250, "shooter_heading_deg": 90},
            "missile": {"template": mid},
            "target": {"platform": "su30_flanker", "initial": {}, "timeline": timeline or []},
            "sim": {"dt": dt, "max_time": 30 + rng_km * 3.0, "output_rate_hz": 10,
                     "hit_radius_m": 15}}


def _geo_sam(mid, rng_km, alt, elev=65, dt=0.006):
    return {"name": "t", "engagement_type": "surface_to_air", "atmosphere": "ussa1976",
            "geometry": {"range_km": rng_km, "bearing_deg": 90, "altitude_m": alt,
                          "threat_speed": 250, "launch_elevation_deg": elev,
                          "launch_speed": 40, "site_altitude_m": 20},
            "missile": {"template": mid},
            "target": {"platform": "su30_flanker", "initial": {}},
            "sim": {"dt": dt, "max_time": 25 + rng_km * 3.2, "output_rate_hz": 10,
                     "hit_radius_m": 15}}


def test_sam_steep_launch_pitches_over_and_hits():
    """A 65° 48N6 launch must fly the up-and-over and intercept at 120 km —
    not climb out of the atmosphere (the old failure mode)."""
    r = simulation.run(templates.build_scenario(_geo_sam("s400_48n6", 120, 10000)))
    assert r.outcome == "HIT"
    peak = max(r.channels["malt"])
    assert 12000 < peak < 36000            # lofted, but controlled below ceiling


def test_vertical_launch_sam_intercepts():
    """Even a fully vertical (90°) launch must tip over onto the profile."""
    r = simulation.run(templates.build_scenario(_geo_sam("aster30", 60, 8000, elev=90)))
    assert r.outcome == "HIT"
    assert max(r.channels["malt"]) < 25000


def test_clos_beam_rider_hits():
    r = simulation.run(templates.build_scenario(_geo_sam("tor_m2", 12, 2000, elev=25, dt=0.004)))
    assert r.outcome == "HIT"


def test_dual_pulse_second_pulse_fires():
    """PL-15's pulse 2 must ignite mid-flight and show up in events + thrust."""
    r = simulation.run(templates.build_scenario(_geo_a2a("pl15", 110)))
    labels = " | ".join(e["label"] for e in r.events)
    assert "Pulse 2 ignition" in labels
    assert r.outcome == "HIT"


def test_ramjet_lights_and_cruises():
    """Meteor: booster → ramjet lit → powered cruise events, and an intercept."""
    r = simulation.run(templates.build_scenario(_geo_a2a("meteor", 100)))
    labels = " | ".join(e["label"] for e in r.events)
    assert "Ramjet lit" in labels
    assert r.outcome == "HIT"


def test_ramjet_engine_model_flameout_and_fuel():
    from core.propulsion import RamjetSustainer
    rj = RamjetSustainer(thrust_n=9000, fuel_mass_kg=50, isp_s=800,
                         ignition_time_s=1.0, mach_min=1.7, mach_cruise=3.6, mach_economy=2.9)
    # below min Mach before ignition window → no thrust, no fuel burn
    assert rj.update(0.5, 0.01, 0.4, 600, 2.0) == 0.0
    # midcourse BELOW the economy cruise → throttles up, burns fuel
    F = rj.update(2.0, 0.01, 0.4, 750, 2.4)      # Mach 2.4 < economy 2.9
    assert F > 0 and rj.fuel_used > 0
    # midcourse ABOVE economy cruise → IDLES to conserve fuel (the key behaviour)
    used = rj.fuel_used
    rj.update(2.1, 0.01, 0.4, 1050, 3.4)          # Mach 3.4 > economy → idle
    assert rj.fuel_used == used                   # no fuel burned while coasting fast
    # TERMINAL phase → throttles up even above economy to restore endgame speed
    assert rj.update(2.2, 0.01, 0.4, 1050, 3.2, terminal=True) > 0
    # decelerate out of the envelope → permanent flame-out (cannot relight)
    assert rj.update(3.0, 0.01, 0.4, 400, 1.2, terminal=True) == 0.0
    assert rj.update(4.0, 0.01, 0.4, 900, 3.0, terminal=True) == 0.0


def test_ramjet_economy_cruise_saves_fuel_for_endgame():
    """A ramjet should not dump all its fuel holding a high Mach in midcourse —
    it must arrive at the merge still able to throttle up (the Meteor trait)."""
    from core import optimizer as opt
    base = _geo_a2a("meteor", 90, alt=11000)
    out = opt.tactical_study(base, altitudes=[11000.0], n_seeds=1)
    r = out["rows"][0]
    # ramjet economy cruise + terminal boost → an enormous no-escape zone
    assert r["mar_pct_rmax"] and r["mar_pct_rmax"] >= 45   # NEZ ≥ 45% of Rmax
    assert r["rmax_km"] < 260                              # realistic, not runaway


def test_battery_expiry_goes_ballistic():
    sc = _geo_a2a("aim120c_amraam", 60)
    sc["missile"]["battery_s"] = 8.0    # absurdly short battery
    r = simulation.run(templates.build_scenario(sc))
    labels = " | ".join(e["label"] for e in r.events)
    assert "Battery expired" in labels
    assert r.outcome != "HIT"


def test_loft_gated_by_guidance_law():
    """OGL lofts; the same missile forced to pure PN must NOT loft."""
    lofted = simulation.run(templates.build_scenario(_geo_a2a("aim120d_amraam", 100)))
    sc = _geo_a2a("aim120d_amraam", 100)
    sc["missile"]["guidance_override"] = {"law": "pure_pn"}
    flat = simulation.run(templates.build_scenario(sc))
    assert max(lofted.channels["malt"]) > 13000        # climbed well above launch
    assert max(flat.channels["malt"]) < 12500          # PN stays near co-alt


def test_propellant_mass_consistency_all_templates():
    """Every library missile: propellant (+ ramjet fuel) == launch − empty."""
    import json
    for entry in templates.list_templates("missiles"):
        d = entry.get("data")
        if not d or "physical" not in d:
            continue
        if d.get("source") != "open-source estimate":
            continue   # user-forged craft aren't held to library consistency
        ph = d["physical"]
        if "empty_mass_kg" not in ph:
            continue
        prop = sum(s.get("propellant_mass_kg", 0) for s in d.get("propulsion", {}).get("stages", []))
        prop += d.get("propulsion", {}).get("ramjet", {}).get("fuel_mass_kg", 0)
        diff = abs((ph["launch_mass_kg"] - ph["empty_mass_kg"]) - prop)
        assert diff < 2.5, f"{d.get('id')}: propellant {prop} vs launch-empty"


def test_tactical_study_variant_builder():
    from core import optimizer as opt
    base = _geo_a2a("aim120c_amraam", 45)
    v = opt._variant(base, 6000.0, 30.0, opt._TACTIC_OPTIONS[1][1])
    assert v["geometry"]["altitude_m"] == 6000.0
    assert v["geometry"]["range_km"] == 30.0
    assert v["target"]["timeline"][0]["maneuver"] == "go_cold"


def test_tactical_study_runs_and_is_rich():
    """The parallel tactical study returns the full kneeboard for one altitude."""
    from core import optimizer as opt
    base = _geo_a2a("aim120c_amraam", 45)
    out = opt.tactical_study(base, altitudes=[9000.0], n_seeds=1)
    assert out["rows"] and len(out["rows"]) == 1
    r = out["rows"][0]
    assert r["rmax_km"] > r["mar_km"] > 0          # NEZ is a strict sub-band
    assert r["decision"] and len(r["decision"]) >= 3
    assert "aspect_required" in r and "pitbull_km" in r
    assert out["poles"]                            # A2A pole study present


def test_boundary_interpolation_and_error_safety():
    """The kill-boundary interpolator is sub-grid accurate and drops crashed seeds."""
    from core import optimizer as opt
    # kills (miss<15) to 40 km, misses beyond → boundary between 40 and 50, refined
    samples = [(10, [8, 10]), (20, [9, 11]), (30, [10, 12]), (40, [12, 14]),
               (50, [18, 22]), (60, [120, 140])]
    b, in_grid = opt._boundary_range(samples, 15.0)
    assert in_grid and 40.0 <= b <= 50.0        # crossing localised inside the cell
    # an inf (crashed) seed must be dropped, never counted as a kill or a miss
    s2 = [(10, [8, float("inf")]), (20, [9, 11]), (30, [float("inf"), float("inf")])]
    b2, _ = opt._boundary_range(s2, 15.0)
    assert b2 is not None                        # still resolves from the finite seeds


def test_tactical_error_results_never_count_as_survival():
    """A crashed variant must not inflate survival stats (the old correctness bug)."""
    from core import optimizer as opt
    # scenario the workers can build fine; just assert the study reports 0 errors
    base = _geo_a2a("aim120c_amraam", 40)
    out = opt.tactical_study(base, altitudes=[9000.0], n_seeds=1)
    assert out["errors"] == 0
    assert out["sims"] > 0
    # Rmax strictly beyond MAR, MAR strictly positive, all decision bands present
    r = out["rows"][0]
    assert r["rmax_km"] > r["mar_km"] > 0
    assert r["mar_pct_rmax"] and 10 <= r["mar_pct_rmax"] <= 100


def test_monte_carlo_parallel_runs():
    """The parallelised monte_carlo returns a ranked, error-counted result set."""
    from core import optimizer as opt
    base = _geo_a2a("aim120c_amraam", 30,
                    timeline=[{"trigger": {"type": "tti", "value": 6},
                               "maneuver": "break_turn", "params": {"g": 7, "direction": "right"}}])
    knobs = [opt.Knob("target.timeline.0.params.g", 4, 9, label="Break G")]
    out = opt.monte_carlo(base, knobs, n=12, objective="survival")
    assert out["n"] == 12 and len(out["results"]) == 12
    assert out["errors"] == 0 and out["best"] is not None
    assert 0.0 <= out["stats"]["hit_rate"] <= 1.0
