"""
core.templates — JSON template manager (missiles, platforms, scenarios).
========================================================================

Loads human-authored JSON (SI-with-friendly-units) and builds the live engine
objects: :class:`~core.entities.Missile`, :class:`~core.entities.Target`, and a
:class:`Scenario`. Also lists and saves templates for the GUI.

Position convention in JSON is **[North, East, Altitude]** in metres with
altitude positive-up; it is converted to internal NED (Down = −Altitude) on load.
Velocities may be given as an explicit ``[vn, ve, vd]`` or as
``{speed, heading_deg, climb_deg}``.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np

from core import registry
from core import visuals
from core.propulsion import Propulsion, MotorStage, RamjetSustainer, boost_sustain_curve
from core.entities import Missile, Target, Shooter, quat_from_velocity
from core.maneuvers import build_timeline

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE_DIR = ROOT / "templates"
SAVE_DIR = ROOT / "data" / "saved_scenarios"


# ── unit / geometry helpers ──────────────────────────────────────────────────

def _to_ned_position(p) -> np.ndarray:
    """[North, East, Altitude(up)] → NED [N, E, Down]."""
    n, e, alt = p
    return np.array([float(n), float(e), -float(alt)])


def _to_ned_velocity(spec) -> np.ndarray:
    if isinstance(spec, (list, tuple)):
        return np.array([float(x) for x in spec])
    speed = float(spec.get("speed", spec.get("speed_mps", 0.0)))
    hdg = np.radians(float(spec.get("heading_deg", 0.0)))
    climb = np.radians(float(spec.get("climb_deg", 0.0)))
    vn = speed * np.cos(climb) * np.cos(hdg)
    ve = speed * np.cos(climb) * np.sin(hdg)
    vd = -speed * np.sin(climb)   # climbing = negative Down
    return np.array([vn, ve, vd])


# ── builders ─────────────────────────────────────────────────────────────────

def build_propulsion(m: Dict[str, Any]) -> Propulsion:
    phys = m["physical"]
    prop = m.get("propulsion", {})
    stages = []
    for s in prop.get("stages", []):
        if "thrust_curve" in s:
            curve = [(float(a), float(b)) for a, b in s["thrust_curve"]]
        elif "boost_sustain" in s:
            bs = s["boost_sustain"]
            curve = boost_sustain_curve(
                bs["boost_thrust_n"], bs["boost_time_s"],
                bs.get("sustain_thrust_n", 0.0), bs.get("sustain_time_s", 0.0))
        else:
            curve = [(0.0, 0.0)]
        stages.append(MotorStage(
            name=s.get("name", "stage"),
            thrust_curve=curve,
            propellant_mass=float(s.get("propellant_mass_kg", 0.0)),
            ignition_time=float(s.get("ignition_time_s", 0.0)),
            isp=float(s.get("isp_s", 235.0)),
            exit_area=float(s.get("exit_area_m2", 0.0)),
        ))
    # optional air-breathing ramjet sustainer (Meteor-class ducted rocket)
    ramjet = None
    rj = prop.get("ramjet")
    if rj:
        ramjet = RamjetSustainer(
            thrust_n=float(rj.get("thrust_n", 8000.0)),
            fuel_mass_kg=float(rj.get("fuel_mass_kg", 45.0)),
            isp_s=float(rj.get("isp_s", 800.0)),
            ignition_time_s=float(rj.get("ignition_time_s", 2.0)),
            mach_min=float(rj.get("mach_min", 1.8)),
            mach_cruise=float(rj.get("mach_cruise", 3.5)),
            mach_economy=(float(rj["mach_economy"]) if rj.get("mach_economy") is not None else None),
            min_throttle=float(rj.get("min_throttle", 0.15)),
        )
    dry = float(phys.get("empty_mass_kg", phys["launch_mass_kg"] * 0.55))
    return Propulsion(
        stages=stages,
        dry_mass=dry,
        length=float(phys["length_m"]),
        diameter=float(phys["diameter_m"]),
        cg_wet=prop.get("cg_wet_m"),
        cg_dry=prop.get("cg_dry_m"),
        inertia_wet=prop.get("inertia_wet"),
        inertia_dry=prop.get("inertia_dry"),
        ramjet=ramjet,
    )


def build_missile(m: Dict[str, Any], guidance_override: Optional[dict] = None) -> Missile:
    phys = m["physical"]
    propulsion = build_propulsion(m)

    aero_spec = m.get("aero", {"model": "parametric", "params": {}})
    aero = registry.create("aero", aero_spec.get("model", "parametric"),
                           **aero_spec.get("params", {}))

    seeker_spec = m.get("seeker", {"type": "rf_active", "params": {}})
    seeker = registry.create("seeker", seeker_spec.get("type", "rf_active"),
                             **seeker_spec.get("params", {}))

    g_spec = dict(m.get("guidance", {"law": "apn", "N": 4.0, "params": {}}))
    if guidance_override:
        g_spec.update(guidance_override)
    guidance = registry.create("guidance", g_spec.get("law", "apn"),
                               **g_spec.get("params", {}))
    guidance.N = float(g_spec.get("N", 4.0))  # attach nav constant

    ap_spec = m.get("autopilot", {"type": "three_loop", "params": {}})
    ap_params = dict(ap_spec.get("params", {}))
    ap_params.setdefault("max_g", float(phys.get("max_g", 40.0)))
    autopilot = registry.create("autopilot", ap_spec.get("type", "three_loop"),
                                **ap_params)

    missile = Missile(
        name=m.get("name", "Interceptor"),
        propulsion=propulsion,
        aero=aero,
        seeker=seeker,
        guidance=guidance,
        autopilot=autopilot,
        length=float(phys["length_m"]),
        diameter=float(phys["diameter_m"]),
        reference_area=phys.get("reference_area_m2"),
        max_g=float(phys.get("max_g", 40.0)),
    )
    missile.visual = visuals.normalize_visual(
        m.get("visual"), visuals.default_missile_visual(m.get("category")))
    # IR/IIR seekers are fire-and-forget with no midcourse datalink; radar/SARH
    # are datalink-guided (or illuminated) until the seeker goes active.
    seeker_type = seeker_spec.get("type", "rf_active")
    missile.datalink_capable = bool(m.get("datalink", seeker_type not in ("ir", "iir")))
    missile.loft_gain = float(m.get("loft", 1.0))   # midcourse energy-loft strength
    # thermal-battery life [s]: after this the fins can't be driven → the missile
    # goes ballistic. Open-source: AAM batteries run ~60–120 s (long-range BVR
    # several minutes); big SAM batteries run hundreds of seconds.
    default_batt = 100.0 if m.get("category") == "air_to_air" else 240.0
    missile.battery_s = float(m.get("battery_s", default_batt))
    # structural/thermal max Mach — a hard airframe limit (skin heating). Speed is
    # otherwise emergent from thrust vs drag (already atmosphere-dependent).
    missile.max_mach = float(m.get("max_mach", 5.5))
    # loft ceiling [m]: max useful apogee of the shaped midcourse — above this
    # the air is too thin for the fins to hold the profile.
    default_ceiling = 24000.0 if m.get("category") == "air_to_air" else 30000.0
    missile.ceiling_m = float(m.get("ceiling_m", default_ceiling))
    return missile


def build_target(platform: Dict[str, Any], initial: Dict[str, Any],
                 timeline_spec: List[dict]) -> Target:
    sig = platform.get("signatures", {})
    perf = platform.get("performance", {})
    timeline = build_timeline(timeline_spec or [], default="straight")
    tgt = Target(
        name=platform.get("name", "Target"),
        timeline=timeline,
        rcs=float(sig.get("rcs_m2", 5.0)),
        ir_signature=float(sig.get("ir_signature", 1.0)),
        max_g=float(perf.get("max_g", 9.0)),
        min_speed=float(perf.get("min_speed_mps", 120.0)),
        max_speed=float(perf.get("max_speed_mps", 700.0)),
        platform_type=platform.get("type", "fighter"),
    )
    tgt.position = _to_ned_position(initial["position"])
    tgt.velocity = _to_ned_velocity(initial.get("velocity", initial))
    tgt.visual = visuals.normalize_visual(
        platform.get("visual"), visuals.default_platform_visual(platform.get("type")))
    return tgt


# ── scenario ─────────────────────────────────────────────────────────────────

@dataclass
class SimConfig:
    dt: float = 0.002
    max_time: float = 60.0
    output_rate_hz: float = 50.0
    hit_radius_m: float = 8.0


@dataclass
class Scenario:
    name: str
    engagement_type: str
    missile: Missile
    target: Target
    atmosphere: Any
    sim: SimConfig
    shooter: Any = None
    raw: dict = field(default_factory=dict)


def _resolve_ref(section: Dict[str, Any], kind: str) -> Dict[str, Any]:
    """A section may inline a template or reference one by 'template'/'platform'."""
    key = "template" if kind == "missiles" else "platform"
    if key in section and section[key]:
        data = load_named(kind, section[key])
        # allow inline overrides to be merged on top of the referenced template
        overrides = {k: v for k, v in section.items()
                     if k not in (key, "launch", "initial", "timeline",
                                  "guidance_override")}
        data = {**data, **overrides}
        return data
    return section.get("definition", section)


def geometry_setup(spec: Dict[str, Any]) -> Dict[str, Any]:
    """Build launch/initial geometry from an intuitive engagement description.

    Instead of hand-placing NED coordinates, describe the merge and let this
    compute shooter, missile-launch and target states::

        "geometry": {
            "range_km": 30,          # shooter→target range at launch
            "aspect_deg": 180,       # target aspect: 180 head-on, 90 beam, 0 tail
            "offboresight_deg": 20,  # target angle off the shooter's nose
            "altitude_m": 9000,      # both at this altitude (or shooter/target alt)
            "target_altitude_m": 9000,
            "shooter_speed": 300, "target_speed": 260,
            "shooter_heading_deg": 90
        }

    The shooter sits at the origin flying ``shooter_heading_deg``; the target is
    placed ``range_km`` away at ``offboresight_deg`` off the nose, flying at the
    requested ``aspect_deg`` relative to the line of sight. Returns a dict with
    ``shooter``, ``missile_launch`` and ``target_initial`` sub-dicts (human units).
    """
    rng = float(spec.get("range_km", 30)) * 1000.0
    aspect = np.radians(float(spec.get("aspect_deg", 180)))
    obl = np.radians(float(spec.get("offboresight_deg", 0)))
    alt_s = float(spec.get("altitude_m", spec.get("shooter_altitude_m", 9000)))
    alt_t = float(spec.get("target_altitude_m", spec.get("altitude_m", alt_s)))
    hdg = np.radians(float(spec.get("shooter_heading_deg", 90)))
    s_spd = float(spec.get("shooter_speed", 300))
    t_spd = float(spec.get("target_speed", 260))

    # shooter at origin
    s_pos = [0.0, 0.0, alt_s]
    s_dir = np.array([np.cos(hdg), np.sin(hdg)])            # N,E horizontal
    # target placed offboresight off the shooter nose
    los_dir = np.array([np.cos(hdg + obl), np.sin(hdg + obl)])
    t_ne = los_dir * rng
    t_pos = [float(t_ne[0]), float(t_ne[1]), alt_t]
    # target velocity: aspect is measured between target velocity and the
    # target→shooter line. 180° = pointing straight at the shooter (head-on).
    tgt_to_shooter = -los_dir
    # rotate tgt_to_shooter by (180 - aspect) so aspect=180 → along tgt_to_shooter
    rot = (np.pi - aspect)
    ca, sa = np.cos(rot), np.sin(rot)
    t_dir = np.array([ca * tgt_to_shooter[0] - sa * tgt_to_shooter[1],
                      sa * tgt_to_shooter[0] + ca * tgt_to_shooter[1]])
    t_heading = float(np.degrees(np.arctan2(t_dir[1], t_dir[0])) % 360)
    s_heading = float(np.degrees(hdg) % 360)
    return {
        "shooter": {"position": s_pos, "velocity": {"speed": s_spd, "heading_deg": s_heading, "climb_deg": 0}},
        "missile_launch": {"position": s_pos, "velocity": {"speed": s_spd, "heading_deg": s_heading, "climb_deg": 0}},
        "target_initial": {"position": t_pos, "velocity": {"speed": t_spd, "heading_deg": t_heading, "climb_deg": 0}},
    }


def geometry_setup_sam(spec: Dict[str, Any]) -> Dict[str, Any]:
    """Surface-to-Air geometry planner: place a ground launcher/radar site at the
    origin and an inbound threat by range, bearing and altitude.

        "geometry": {
            "range_km": 30,               # launcher→threat horizontal range
            "bearing_deg": 90,            # direction to the threat (0=N, 90=E)
            "altitude_m": 150,            # threat altitude (sea-skimmer → high)
            "threat_speed": 250,
            "threat_heading_deg": <auto>, # default = straight inbound at the site
            "launch_elevation_deg": 25,   # SAM initial climb angle
            "launch_speed": 40,
            "site_altitude_m": 20
        }
    """
    rng = float(spec.get("range_km", 30)) * 1000.0
    brg = np.radians(float(spec.get("bearing_deg", 90)))
    alt_t = float(spec.get("altitude_m", 150))
    site_alt = float(spec.get("site_altitude_m", 20))
    spd = float(spec.get("threat_speed", 250))
    inbound = (float(spec.get("bearing_deg", 90)) + 180) % 360
    th_hdg = float(spec.get("threat_heading_deg", inbound))
    elev = float(spec.get("launch_elevation_deg", 25))
    lspd = float(spec.get("launch_speed", 40))
    bdeg = float(spec.get("bearing_deg", 90))
    s_pos = [0.0, 0.0, site_alt]
    t_pos = [float(rng * np.cos(brg)), float(rng * np.sin(brg)), alt_t]
    return {
        # ground radar site: near-stationary, nose toward the threat, wide gimbal
        "shooter": {"position": s_pos, "velocity": {"speed": 2, "heading_deg": bdeg, "climb_deg": 0}},
        "missile_launch": {"position": s_pos, "velocity": {"speed": lspd, "heading_deg": bdeg, "climb_deg": elev}},
        "target_initial": {"position": t_pos, "velocity": {"speed": spd, "heading_deg": th_hdg, "climb_deg": 0}},
    }


def build_scenario(sc: Dict[str, Any]) -> Scenario:
    atmo = registry.create("atmosphere", sc.get("atmosphere", "ussa1976"))
    is_sam = sc.get("engagement_type") == "surface_to_air"

    # intuitive geometry planner → authoritative for launch / initial / shooter
    if "geometry" in sc and sc["geometry"]:
        geo = geometry_setup_sam(sc["geometry"]) if is_sam else geometry_setup(sc["geometry"])
        sc = json.loads(json.dumps(sc))  # deep copy so we don't mutate caller
        sc.setdefault("missile", {})["launch"] = geo["missile_launch"]
        sc.setdefault("target", {})["initial"] = geo["target_initial"]
        sh = sc.setdefault("shooter", {})
        sh["position"] = geo["shooter"]["position"]
        sh["velocity"] = geo["shooter"]["velocity"]
        if is_sam:
            sh.setdefault("radar_gimbal_deg", 85.0)   # ground radar slews wide
            sh.setdefault("support", "straight")

    m_section = sc["missile"]
    m_def = _resolve_ref(m_section, "missiles")
    missile = build_missile(m_def, m_section.get("guidance_override"))
    launch = m_section["launch"]
    missile.position = _to_ned_position(launch["position"])
    missile.launch_position = missile.position.copy()
    missile.velocity = _to_ned_velocity(launch.get("velocity", launch))
    if np.linalg.norm(missile.velocity) < 1.0:
        # cold launch: give it a nudge along heading so aero is defined
        missile.velocity = _to_ned_velocity(
            {"speed": 30.0, "heading_deg": launch.get("heading_deg", 0.0),
             "climb_deg": launch.get("climb_deg", 0.0)})
    missile.quat = quat_from_velocity(missile.velocity)
    # give CLOS the launcher origin if applicable
    if hasattr(missile.guidance, "origin"):
        missile.guidance.origin = missile.position.copy()

    t_section = sc["target"]
    p_def = _resolve_ref(t_section, "platforms")
    target = build_target(p_def, t_section["initial"], t_section.get("timeline", []))

    # ── shooter (launch aircraft providing midcourse datalink) ──
    sh_section = sc.get("shooter")
    shooter = None
    if sh_section is None:
        sh_section = {}  # synthesize a default shooter co-located with the launch
    sh_pos = (_to_ned_position(sh_section["position"]) if "position" in sh_section
              else missile.launch_position.copy())
    sh_vel = (_to_ned_velocity(sh_section["velocity"]) if "velocity" in sh_section
              else missile.velocity.copy())
    sh_platform = {}
    if sh_section.get("platform"):
        try:
            sh_platform = load_named("platforms", sh_section["platform"])
        except Exception:
            sh_platform = {}
    sh_visual = visuals.normalize_visual(
        sh_platform.get("visual"), visuals.default_platform_visual(sh_platform.get("type", "fighter")))
    shooter = Shooter(
        name=sh_platform.get("name", sh_section.get("name", "Shooter")),
        position=sh_pos, velocity=sh_vel,
        radar_gimbal_deg=float(sh_section.get("radar_gimbal_deg", 60.0)),
        radar_range=float(sh_section.get("radar_range_m", 140000.0)),
        datalink_range=float(sh_section.get("datalink_range_m", 180000.0)),
        support=sh_section.get("support", "straight"),
        crank_angle_deg=float(sh_section.get("crank_angle_deg", 45.0)),
        platform_type=sh_platform.get("type", "fighter"),
        visual=sh_visual,
    )

    sim = SimConfig(**sc.get("sim", {}))
    return Scenario(
        name=sc.get("name", "Engagement"),
        engagement_type=sc.get("engagement_type", "air_to_air"),
        missile=missile, target=target, atmosphere=atmo, sim=sim,
        shooter=shooter, raw=sc,
    )


# ── file management ──────────────────────────────────────────────────────────

def _dir_for(kind: str) -> Path:
    return TEMPLATE_DIR / kind


def load_named(kind: str, name: str) -> Dict[str, Any]:
    """Load templates/<kind>/<name>.json (name may include or omit .json)."""
    d = _dir_for(kind)
    fn = name if name.endswith(".json") else f"{name}.json"
    path = d / fn
    if not path.exists():
        # try matching by 'id' or 'name' field inside files
        for f in d.glob("*.json"):
            data = json.loads(f.read_text(encoding="utf-8"))
            if data.get("id") == name or data.get("name") == name:
                return data
        raise FileNotFoundError(f"No {kind} template '{name}' in {d}")
    return json.loads(path.read_text(encoding="utf-8"))


def list_templates(kind: str) -> List[Dict[str, Any]]:
    d = _dir_for(kind)
    out = []
    if not d.exists():
        return out
    for f in sorted(d.glob("*.json")):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            out.append({"file": f.name,
                        "id": data.get("id", f.stem),
                        "name": data.get("name", f.stem),
                        "type": data.get("type", data.get("engagement_type", kind)),
                        "data": data})
        except Exception as e:  # pragma: no cover
            out.append({"file": f.name, "id": f.stem, "name": f.stem,
                        "error": str(e)})
    return out


def save_template(kind: str, name: str, data: Dict[str, Any]) -> Path:
    d = _dir_for(kind) if kind != "scenarios_user" else SAVE_DIR
    d.mkdir(parents=True, exist_ok=True)
    safe = "".join(c for c in name if c.isalnum() or c in "-_ ").strip().replace(" ", "_")
    path = d / f"{safe or 'untitled'}.json"
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    return path


def load_scenario_file(path: str | Path) -> Dict[str, Any]:
    return json.loads(Path(path).read_text(encoding="utf-8"))
