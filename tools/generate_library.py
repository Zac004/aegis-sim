#!/usr/bin/env python3
"""
tools/generate_library.py — build the Aegis-Sim weapon & platform library.

Emits JSON templates (missiles, SAMs, aircraft) using WIDELY-CITED OPEN-SOURCE
ESTIMATES. Exact figures for these systems are classified; values here are
public approximations chosen so the simulator's kinematics land in the right
ballpark. Every file carries `"source": "open-source estimate"`.

Physical consistency rules enforced here (so the 6-DOF sees a coherent weapon):
  * propellant mass == launch mass − empty mass (ramjets: booster + fuel),
  * every thrust curve's total impulse == propellant · Isp · g0 exactly
    (boost/sustain split is specified, burn times are derived),
  * every missile carries battery life, structural Mach limit, loft ceiling,
    loft gain, seeker, guidance and autopilot parameters.

Run:  python3 tools/generate_library.py
"""
import json
import os

G0 = 9.80665
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MDIR = os.path.join(ROOT, "templates", "missiles")
PDIR = os.path.join(ROOT, "templates", "platforms")
os.makedirs(MDIR, exist_ok=True)
os.makedirs(PDIR, exist_ok=True)


# ── motor builders (impulse-consistent) ──────────────────────────────────────

def solid_stage(name, prop, isp, boost_n, sustain_n=0.0, boost_frac=1.0,
                ignition=0.0, dia=0.18):
    """One solid stage whose burn times are derived so that the thrust curve's
    total impulse equals prop·Isp·g0 exactly."""
    I_total = prop * isp * G0
    I_boost = I_total * (boost_frac if sustain_n > 0 else 1.0)
    boost_t = round(I_boost / boost_n, 2)
    st = {"name": name, "propellant_mass_kg": prop, "ignition_time_s": ignition,
          "isp_s": isp, "exit_area_m2": round((dia * 0.42) ** 2 * 3.14159, 5)}
    if sustain_n > 0:
        sus_t = round((I_total - I_boost) / sustain_n, 2)
        st["boost_sustain"] = {"boost_thrust_n": boost_n, "boost_time_s": boost_t,
                               "sustain_thrust_n": sustain_n, "sustain_time_s": sus_t}
    else:
        st["boost_sustain"] = {"boost_thrust_n": boost_n, "boost_time_s": boost_t,
                               "sustain_thrust_n": 0, "sustain_time_s": 0}
    return st


def boost_sustain(prop, isp, boost_n, sustain_n, boost_frac=0.55, dia=0.18):
    """Classic single-stage boost→sustain motor."""
    return [solid_stage("boost-sustain motor", prop, isp, boost_n, sustain_n,
                        boost_frac, 0.0, dia)]


def dual_pulse(prop, isp, p1_frac, p1_n, p2_n, p2_ignition, dia=0.18):
    """Dual-pulse solid: pulse 1 at launch, pulse 2 pre-programmed for the
    endgame (restores energy right before the terminal phase — PL-15 style)."""
    p1 = round(prop * p1_frac, 1)
    p2 = round(prop - p1, 1)
    return [solid_stage("pulse 1 (boost)", p1, isp, p1_n, dia=dia),
            solid_stage("pulse 2 (endgame)", p2, isp, p2_n, ignition=p2_ignition, dia=dia)]


def ramjet(thrust_n, fuel, isp=800, ignition=3.9, mach_min=2.0, mach_cruise=3.4,
           mach_economy=2.8, min_throttle=0.15):
    # ignition defaults to just after a typical booster burnout (no thrust overlap);
    # mach_economy is the fuel-efficient midcourse cruise, mach_cruise the terminal restore.
    return {"thrust_n": thrust_n, "fuel_mass_kg": fuel, "isp_s": isp,
            "ignition_time_s": ignition, "mach_min": mach_min,
            "mach_cruise": mach_cruise, "mach_economy": mach_economy,
            "min_throttle": min_throttle}


# ── aero presets ─────────────────────────────────────────────────────────────
AERO = {
    "slim": dict(cd0_subsonic=0.30, cd0_transonic_peak=0.82, cd0_supersonic=0.48,
                 cn_alpha0=38, cm_alpha0=-0.32, cm_q=-220, induced_k=0.004),
    "std":  dict(cd0_subsonic=0.28, cd0_transonic_peak=0.74, cd0_supersonic=0.44,
                 cn_alpha0=34, cm_alpha0=-0.30, cm_q=-200, induced_k=0.004),
    "fat":  dict(cd0_subsonic=0.26, cd0_transonic_peak=0.68, cd0_supersonic=0.42,
                 cn_alpha0=30, cm_alpha0=-0.28, cm_q=-240, induced_k=0.004),
    # ramjet airframes carry intakes → higher drag
    "ram":  dict(cd0_subsonic=0.32, cd0_transonic_peak=0.84, cd0_supersonic=0.50,
                 cn_alpha0=34, cm_alpha0=-0.30, cm_q=-200, induced_k=0.004),
    # WVR dogfight darts: big canards/wings for agility = much more zero-lift drag
    "dart": dict(cd0_subsonic=0.36, cd0_transonic_peak=0.98, cd0_supersonic=0.62,
                 cn_alpha0=40, cm_alpha0=-0.34, cm_q=-220, induced_k=0.005),
}


def seeker(kind, acq=None):
    S = {
        "arh_x":   ("rf_active", 20000, 60, dict(frequency_band="X", angle_noise_mrad=0.4, jam_susceptibility=0.12)),
        "arh_ku":  ("rf_active", 22000, 65, dict(frequency_band="Ku", angle_noise_mrad=0.3, jam_susceptibility=0.10)),
        "arh_big": ("rf_active", 30000, 55, dict(frequency_band="X", angle_noise_mrad=0.4, jam_susceptibility=0.10)),
        "sarh":    ("rf_semiactive", 40000, 50, dict(frequency_band="X", angle_noise_mrad=0.4, jam_susceptibility=0.14)),
        "iir":     ("iir", 14000, 90, dict(frequency_band="LWIR", angle_noise_mrad=0.15, jam_susceptibility=0.06)),
        "ir":      ("ir", 11000, 75, dict(frequency_band="MWIR", angle_noise_mrad=0.25, jam_susceptibility=0.22)),
    }
    t, acq0, gim, extra = S[kind]
    p = dict(acquisition_range=acq or acq0, gimbal_limit_deg=gim, fov_deg=4.0,
             track_bandwidth_hz=3.5, **extra)
    return {"type": t, "params": p}


def missile(id, name, category, sprite, accent, length, dia, mass, empty, maxg,
            stages, aero, skr, law="apn", N=4.0, loft=1.0, battery=100,
            max_mach=4.0, ceiling=21000, rj=None, datalink=None,
            fins=(26, 400), note=""):
    prop = sum(s["propellant_mass_kg"] for s in stages) + (rj["fuel_mass_kg"] if rj else 0)
    assert abs(prop - (mass - empty)) < 1.5, f"{id}: propellant {prop} != launch-empty {mass - empty}"
    d = {
        "id": id, "name": name, "category": category, "source": "open-source estimate",
        "visual": {"sprite": sprite,
                   "color": "#d9dde3" if category == "air_to_air" else "#e6e9ee",
                   "accent": accent},
        "physical": {"length_m": length, "diameter_m": dia, "launch_mass_kg": mass,
                     "empty_mass_kg": empty, "max_g": maxg},
        "propulsion": {"cg_wet_m": round(length * 0.56, 3), "cg_dry_m": round(length * 0.5, 3),
                       "stages": stages, **({"ramjet": rj} if rj else {})},
        "aero": {"model": "parametric", "params": AERO[aero]},
        "seeker": seeker(skr) if isinstance(skr, str) else skr,
        "loft": loft,
        "battery_s": battery,
        "max_mach": max_mach,
        "ceiling_m": ceiling,
        "guidance": {"law": law, "N": N},
        "autopilot": {"type": "three_loop",
                      "params": {"max_fin_deg": fins[0], "fin_rate_deg_s": fins[1],
                                 "actuator_tau": 0.02, "max_g": maxg}},
        "notes": note,
    }
    if datalink is not None:
        d["datalink"] = datalink
    return d


MISSILES = [
    # ═══ Air-to-Air: BVR active radar ═══
    missile("aim120c_amraam", "AIM-120C-5 AMRAAM", "air_to_air", "aam_slender", "#ffb000",
            3.66, 0.178, 161, 113, 40,
            boost_sustain(48, 250, 22000, 5500, 0.55), "std", seeker("arh_x", 20000),
            law="apn", loft=1.0, battery=100, max_mach=4.0, ceiling=21000,
            note="US medium-range ARH; boost-sustain WPU-16/B; ~70 km class."),
    missile("aim120d_amraam", "AIM-120D AMRAAM", "air_to_air", "aam_slender", "#ffb000",
            3.66, 0.178, 161, 106, 40,
            boost_sustain(55, 255, 22000, 5000, 0.55), "std", seeker("arh_x", 22000),
            law="ogl", loft=1.4, battery=160, max_mach=4.0, ceiling=23000,
            note="Extended-range AMRAAM; improved motor + lofted midcourse; ~130–160 km class."),
    missile("aim260_jatm", "AIM-260 JATM", "air_to_air", "aam_slender", "#22ff9c",
            3.66, 0.19, 195, 115, 40,
            dual_pulse(80, 255, 0.62, 24000, 14000, 20.0, dia=0.19), "slim", seeker("arh_ku", 25000),
            law="ogl", loft=1.6, battery=260, max_mach=5.0, ceiling=25000,
            note="US next-gen dual-pulse ARH; second pulse restores endgame energy; ~200 km class (est.)."),
    missile("pl15", "PL-15", "air_to_air", "aam_slender", "#22ff9c",
            4.0, 0.203, 210, 122, 40,
            dual_pulse(88, 252, 0.62, 26000, 15000, 22.0, dia=0.203), "std", seeker("arh_ku", 25000),
            law="ogl", loft=1.6, battery=260, max_mach=5.0, ceiling=26000,
            note="Chinese dual-pulse ARH with AESA seeker; ~200–300 km class."),
    missile("meteor", "MBDA Meteor", "air_to_air", "aam_slender", "#00e5ff",
            3.65, 0.178, 190, 100, 40,
            [solid_stage("booster", 36, 235, 21000, dia=0.178)], "ram", seeker("arh_ku", 22000),
            law="ogl", loft=0.8, battery=155, max_mach=4.0, ceiling=22000,
            rj=ramjet(9000, 54, isp=800, ignition=4.0, mach_min=2.0, mach_cruise=3.5, mach_economy=2.8),
            note="Throttleable ducted-rocket ramjet: economy cruise, throttles up for the endgame → huge no-escape zone; ~150–200 km."),
    missile("r77_rvvae", "R-77 (RVV-AE)", "air_to_air", "aam_slender", "#ff8a3a",
            3.6, 0.20, 175, 110, 40,
            boost_sustain(65, 250, 24000, 6000, 0.55, dia=0.2), "std", seeker("arh_x", 16000),
            law="apn", loft=0.9, battery=110, max_mach=4.5, ceiling=20000,
            note="Russian ARH; grid fins; ~80–100 km class."),
    missile("r77m", "R-77M (izd. 180)", "air_to_air", "aam_slender", "#ff8a3a",
            4.14, 0.20, 190, 115, 40,
            dual_pulse(75, 252, 0.6, 24000, 13000, 20.0, dia=0.2), "std", seeker("arh_x", 20000),
            law="ogl", loft=1.3, battery=220, max_mach=4.5, ceiling=24000,
            note="Dual-pulse R-77 development with AESA seeker, conventional fins; ~160–190 km class."),
    missile("r37m_axehead", "R-37M (RVV-BD)", "air_to_air", "aam_slender", "#ff3d00",
            4.06, 0.38, 510, 300, 30,
            boost_sustain(210, 258, 85000, 18000, 0.6, dia=0.38), "fat", seeker("arh_big", 30000),
            law="ogl", loft=1.5, battery=340, max_mach=6.0, ceiling=28000,
            note="Very-long-range ARH; Mach 6 class, high loft; ~200–300 km."),
    missile("r37_axehead", "R-37 (early)", "air_to_air", "aam_slender", "#ff3d00",
            4.2, 0.38, 600, 340, 28,
            boost_sustain(260, 255, 90000, 20000, 0.6, dia=0.38), "fat", seeker("sarh", 35000),
            law="ogl", loft=1.4, battery=300, max_mach=6.0, ceiling=27000,
            note="Original very-long-range interceptor missile; ~150–200 km class."),
    missile("aim54c_phoenix", "AIM-54C Phoenix", "air_to_air", "aam_slender", "#ffb000",
            3.96, 0.38, 463, 288, 22,
            boost_sustain(175, 250, 60000, 12000, 0.6, dia=0.38), "fat", seeker("arh_big", 18000),
            law="ogl", loft=1.6, battery=300, max_mach=4.3, ceiling=28000,
            note="F-14 fleet-defence VLR missile; the original high-loft profile; ~130–180 km class."),
    missile("mica_em", "MICA-EM", "air_to_air", "aam_slender", "#00e5ff",
            3.1, 0.16, 112, 75, 45,
            boost_sustain(37, 240, 18000, 4500, 0.6, dia=0.16), "slim", seeker("arh_ku", 14000),
            law="apn", loft=0.5, battery=70, max_mach=4.0, ceiling=17000,
            note="French dual WVR/BVR ARH; TVC; ~60–80 km class."),
    missile("mica_ir", "MICA-IR", "air_to_air", "aam_slender", "#00e5ff",
            3.1, 0.16, 112, 75, 45,
            boost_sustain(37, 240, 18000, 4500, 0.6, dia=0.16), "slim", seeker("iir", 12000),
            law="apn", loft=0.5, battery=70, max_mach=4.0, ceiling=17000, datalink=True,
            note="Imaging-IR MICA *with* datalink midcourse — a silent BVR shot (no RWR warning)."),
    missile("derby_i", "I-Derby ER", "air_to_air", "aam_slender", "#ffb000",
            3.6, 0.16, 118, 75, 40,
            dual_pulse(43, 245, 0.6, 16000, 9000, 15.0, dia=0.16), "slim", seeker("arh_ku", 14000),
            law="apn", loft=0.9, battery=160, max_mach=4.0, ceiling=18000,
            note="Israeli dual-pulse ARH; ~100 km class."),
    missile("pl12", "PL-12 (SD-10)", "air_to_air", "aam_slender", "#22ff9c",
            3.85, 0.203, 180, 115, 38,
            boost_sustain(65, 248, 23000, 6000, 0.55, dia=0.203), "std", seeker("arh_x", 16000),
            law="apn", loft=0.8, battery=100, max_mach=4.0, ceiling=20000,
            note="Chinese medium-range ARH; ~70–100 km class."),
    missile("pl21", "PL-21", "air_to_air", "aam_slender", "#22ff9c",
            5.0, 0.25, 380, 200, 35,
            [solid_stage("booster", 70, 240, 60000, dia=0.25)], "ram", seeker("arh_big", 30000),
            law="ogl", loft=1.3, battery=300, max_mach=4.2, ceiling=28000,
            rj=ramjet(15000, 110, isp=780, ignition=2.8, mach_min=2.0, mach_cruise=3.6, mach_economy=2.9),
            note="Chinese very-long-range ramjet AAM (est.); economy cruise + endgame throttle-up; AWACS-killer class; ~250–300 km."),
    missile("astra_mk1", "Astra Mk1", "air_to_air", "aam_slender", "#ffb000",
            3.57, 0.178, 154, 103, 40,
            boost_sustain(51, 248, 21000, 5200, 0.55), "std", seeker("arh_x", 15000),
            law="apn", loft=1.0, battery=110, max_mach=4.5, ceiling=20000,
            note="Indian ARH; ~90–110 km class."),
    # ═══ Air-to-Air: SARH / legacy ═══
    missile("aim7m_sparrow", "AIM-7M Sparrow", "air_to_air", "aam_slender", "#ffb000",
            3.66, 0.203, 231, 151, 30,
            boost_sustain(80, 245, 25000, 11000, 0.6, dia=0.203), "std", seeker("sarh", 45000),
            law="pn", loft=0.0, battery=70, max_mach=4.0, ceiling=18000,
            note="US SARH; homes on reflected illumination the whole way (no loft); ~50 km class."),
    missile("r27r", "R-27R (Alamo-A)", "air_to_air", "aam_slender", "#ff8a3a",
            4.08, 0.23, 253, 158, 30,
            boost_sustain(95, 248, 30000, 9000, 0.6, dia=0.23), "std", seeker("sarh", 40000),
            law="apn", loft=0.3, battery=70, max_mach=4.0, ceiling=20000,
            note="Russian SARH with inertial midcourse + radio correction; ~60–70 km class."),
    missile("r27t", "R-27T (Alamo-B)", "air_to_air", "aam_slender", "#ff8a3a",
            3.7, 0.23, 254, 160, 30,
            boost_sustain(94, 248, 30000, 9000, 0.6, dia=0.23), "std", seeker("ir", 9000),
            law="pn", loft=0.0, battery=60, max_mach=4.0, ceiling=18000,
            note="IR-homing R-27: silent fire-and-forget but must lock before launch."),
    missile("r27er", "R-27ER (Alamo-C)", "air_to_air", "aam_slender", "#ff8a3a",
            4.7, 0.26, 350, 210, 30,
            boost_sustain(140, 250, 42000, 12000, 0.6, dia=0.26), "fat", seeker("sarh", 45000),
            law="apn", loft=0.4, battery=90, max_mach=4.5, ceiling=22000,
            note="Energetic long-burn SARH; ~90–130 km class."),
    # ═══ Air-to-Air: WVR IR ═══
    missile("aim9m_sidewinder", "AIM-9M Sidewinder", "air_to_air", "cruise_dart", "#ffb000",
            2.85, 0.127, 86, 62, 40,
            boost_sustain(24, 235, 12000, 2600, 0.6, dia=0.127), "dart", seeker("ir", 10000),
            law="pn", loft=0.0, battery=50, max_mach=2.7, ceiling=15000,
            note="Legacy IR WVR; flare-vulnerable; ~18 km class."),
    missile("aim9l_sidewinder", "AIM-9L Sidewinder", "air_to_air", "cruise_dart", "#ffb000",
            2.85, 0.127, 86, 62, 35,
            boost_sustain(24, 232, 12000, 2400, 0.6, dia=0.127), "dart", seeker("ir", 9000),
            law="pn", loft=0.0, battery=45, max_mach=2.5, ceiling=14000,
            note="First all-aspect IR WVR; ~15 km class."),
    missile("aim9x_sidewinder", "AIM-9X Sidewinder", "air_to_air", "cruise_dart", "#ffb000",
            3.02, 0.127, 85, 61, 60,
            boost_sustain(24, 240, 13000, 2800, 0.6, dia=0.127), "dart", seeker("iir", 14000),
            law="apn", loft=0.0, battery=60, max_mach=2.9, ceiling=16000, fins=(30, 500),
            note="TVC + imaging IR: HOBS shots, flare-resistant; ~30 km class."),
    missile("r73_archer", "R-73 (Archer)", "air_to_air", "cruise_dart", "#ff3d00",
            2.9, 0.17, 105, 74, 50,
            boost_sustain(31, 235, 15000, 3200, 0.6, dia=0.17), "dart", seeker("ir", 11000),
            law="pn", loft=0.0, battery=50, max_mach=2.5, ceiling=14000, fins=(30, 500),
            note="Russian HOBS IR with TVC; helmet-cued; ~30 km class."),
    missile("iris_t", "IRIS-T", "air_to_air", "cruise_dart", "#22ff9c",
            2.94, 0.127, 87, 62, 60,
            boost_sustain(25, 238, 13500, 2800, 0.6, dia=0.127), "dart", seeker("iir", 13000),
            law="apn", loft=0.0, battery=55, max_mach=3.0, ceiling=15000, fins=(30, 500),
            note="German IIR WVR; TVC; extreme agility; ~25 km class."),
    missile("asraam", "ASRAAM", "air_to_air", "cruise_dart", "#00e5ff",
            2.9, 0.166, 88, 60, 50,
            boost_sustain(28, 238, 16000, 3000, 0.65, dia=0.166), "dart", seeker("iir", 15000),
            law="apn", loft=0.0, battery=60, max_mach=3.5, ceiling=16000,
            note="UK long-burn IIR WVR — fastest of its class off the rail; ~25 km+."),
    missile("python5", "Python-5", "air_to_air", "cruise_dart", "#ffb000",
            3.1, 0.16, 105, 72, 60,
            boost_sustain(33, 238, 15000, 3200, 0.6, dia=0.16), "dart", seeker("iir", 14000),
            law="apn", loft=0.0, battery=60, max_mach=3.0, ceiling=15000, fins=(30, 500),
            note="Israeli IIR HOBS with lock-after-launch; ~20 km class."),
    missile("pl10_ason", "PL-10 (ASON)", "air_to_air", "cruise_dart", "#22ff9c",
            3.0, 0.16, 89, 64, 60,
            boost_sustain(25, 238, 14000, 3000, 0.6, dia=0.16), "dart", seeker("iir", 13000),
            law="apn", loft=0.0, battery=55, max_mach=3.0, ceiling=15000, fins=(30, 500),
            note="Chinese HOBS IIR + TVC; ~20 km class."),
    # ═══ Surface-to-Air ═══
    missile("pac3_interceptor", "MIM-104 PAC-3", "surface_to_air", "sam_heavy", "#00e5ff",
            5.2, 0.255, 315, 154, 60,
            boost_sustain(161, 250, 70000, 0, 1.0, dia=0.255), "fat", seeker("arh_ku", 20000),
            law="ogl", loft=0.6, battery=120, max_mach=5.0, ceiling=20000, fins=(30, 500),
            note="Hit-to-kill SAM with attitude-control thrusters; all-boost motor; ~20–35 km."),
    missile("pac2_gem", "MIM-104 PAC-2 GEM", "surface_to_air", "sam_heavy", "#00e5ff",
            5.18, 0.41, 900, 465, 25,
            boost_sustain(435, 245, 150000, 30000, 0.7, dia=0.41), "fat", seeker("sarh", 45000),
            law="ogl", loft=1.0, battery=180, max_mach=5.0, ceiling=25000,
            note="Blast-frag Patriot; TVM guidance, lofted profile; ~70–160 km class."),
    missile("s400_48n6", "48N6DM (S-400)", "surface_to_air", "sam_heavy", "#ff3d00",
            7.5, 0.52, 1835, 900, 25,
            boost_sustain(935, 252, 350000, 65000, 0.6, dia=0.52), "fat", seeker("sarh", 55000),
            law="ogl", loft=1.3, battery=300, max_mach=6.5, ceiling=30000,
            note="Long-range S-400 round; Mach 6+, big loft; ~150–250 km class."),
    missile("s400_40n6", "40N6 (S-400)", "surface_to_air", "sam_heavy", "#ff3d00",
            7.5, 0.52, 1893, 950, 20,
            boost_sustain(943, 255, 360000, 60000, 0.6, dia=0.52), "fat", seeker("arh_big", 40000),
            law="ogl", loft=1.8, battery=600, max_mach=6.5, ceiling=35000,
            note="Very-long-range S-400 round; active seeker for over-horizon shots; ~380 km class."),
    missile("aster30", "Aster 30", "surface_to_air", "sam_heavy", "#00e5ff",
            4.9, 0.18, 450, 220, 60,
            [solid_stage("booster", 180, 245, 100000, dia=0.36),
             solid_stage("dart sustainer", 50, 245, 15000, ignition=4.4, dia=0.18)],
            "std", seeker("arh_ku", 18000),
            law="ogl", loft=0.7, battery=120, max_mach=4.5, ceiling=20000, fins=(30, 500),
            note="Two-stage PIF-PAF interceptor: booster + dart with direct thrust control; ~120 km."),
    missile("sa11_buk", "9M38M1 (SA-11 Buk)", "surface_to_air", "sam_heavy", "#ff8a3a",
            5.55, 0.4, 690, 398, 24,
            boost_sustain(292, 245, 120000, 22000, 0.5, dia=0.4), "fat", seeker("sarh", 30000),
            law="apn", loft=0.5, battery=60, max_mach=3.5, ceiling=22000,
            note="Medium-range SARH SAM; ~35–50 km class."),
    missile("nasams_amraam", "AMRAAM-ER (NASAMS)", "surface_to_air", "sam_heavy", "#22ff9c",
            4.1, 0.254, 250, 130, 40,
            boost_sustain(120, 245, 60000, 12000, 0.6, dia=0.254), "std", seeker("arh_x", 20000),
            law="ogl", loft=0.8, battery=120, max_mach=4.0, ceiling=15000,
            note="Surface-launched AMRAAM with ESSM motor; ~50 km class."),
    missile("sm2_block3", "SM-2MR Block IIIA", "surface_to_air", "sam_heavy", "#00e5ff",
            4.72, 0.34, 708, 360, 30,
            boost_sustain(348, 250, 150000, 33000, 0.55, dia=0.34), "fat", seeker("sarh", 40000),
            law="ogl", loft=1.0, battery=150, max_mach=3.5, ceiling=24000,
            note="US naval area-defence SAM; command midcourse + SARH terminal; ~90–170 km."),
    missile("sm6", "SM-6 (RIM-174)", "surface_to_air", "sam_heavy", "#00e5ff",
            6.55, 0.34, 1500, 684, 30,
            [solid_stage("Mk 72 booster", 468, 245, 250000, dia=0.53),
             solid_stage("Mk 104 sustainer", 348, 250, 60000, 25000, 0.5, ignition=5.0, dia=0.34)],
            "fat", seeker("arh_x", 25000),
            law="ogl", loft=1.6, battery=400, max_mach=3.5, ceiling=34000,
            note="Booster-stacked Standard with active AMRAAM-derived seeker; ~240 km class."),
    missile("essm", "ESSM (RIM-162)", "surface_to_air", "sam_heavy", "#22ff9c",
            3.66, 0.254, 280, 172, 50,
            boost_sustain(108, 245, 90000, 0, 1.0, dia=0.254), "std", seeker("sarh", 25000),
            law="apn", loft=0.3, battery=60, max_mach=4.0, ceiling=15000, fins=(30, 500),
            note="Ship self-defence missile; all-boost, extremely agile; ~50 km class."),
    missile("hq9b", "HQ-9B", "surface_to_air", "sam_heavy", "#22ff9c",
            6.8, 0.47, 1300, 650, 22,
            boost_sustain(650, 250, 280000, 48000, 0.6, dia=0.47), "fat", seeker("arh_big", 30000),
            law="ogl", loft=1.2, battery=300, max_mach=6.0, ceiling=27000,
            note="Chinese long-range SAM; TVM midcourse + ARH terminal; ~200–260 km class."),
    missile("barak8", "Barak-8ER", "surface_to_air", "sam_heavy", "#ffb000",
            4.5, 0.225, 275, 150, 40,
            dual_pulse(125, 245, 0.6, 60000, 30000, 25.0, dia=0.225), "std", seeker("arh_ku", 20000),
            law="ogl", loft=0.6, battery=250, max_mach=3.0, ceiling=16000,
            note="Indo-Israeli dual-pulse SAM — the second pulse powers the endgame; ~100–150 km."),
    missile("s350_9m96e2", "9M96E2 (S-350/S-400)", "surface_to_air", "sam_heavy", "#ff3d00",
            5.65, 0.24, 420, 210, 60,
            boost_sustain(210, 250, 120000, 15000, 0.75, dia=0.24), "std", seeker("arh_ku", 22000),
            law="ogl", loft=1.0, battery=200, max_mach=5.0, ceiling=30000, fins=(30, 500),
            note="Agile gas-dynamic-control interceptor (60 g endgame); ~120 km class."),
    missile("hq16b", "HQ-16B", "surface_to_air", "sam_heavy", "#22ff9c",
            5.2, 0.34, 650, 330, 26,
            boost_sustain(320, 245, 130000, 25000, 0.55, dia=0.34), "fat", seeker("sarh", 35000),
            law="apn", loft=0.6, battery=90, max_mach=4.0, ceiling=18000,
            note="Chinese medium-range SARH SAM; ~70 km class."),
    missile("tor_m2", "9M338 (Tor-M2)", "surface_to_air", "sam_heavy", "#ff8a3a",
            2.9, 0.24, 167, 97, 30,
            boost_sustain(70, 240, 55000, 0, 1.0, dia=0.24), "std", seeker("sarh", 20000),
            law="clos", loft=0.0, battery=40, max_mach=2.8, ceiling=10000, fins=(30, 500),
            note="Point-defence SHORAD; command-to-LOS guidance (no loft); ~15 km class."),
]


def aircraft(id, name, typ, sprite, color, accent, rcs, ir, maxg, vmin, vmax, ceil, flares, chaff, ecm, note=""):
    return {"id": id, "name": name, "type": typ, "source": "open-source estimate",
            "visual": {"sprite": sprite, "color": color, "accent": accent},
            "signatures": {"rcs_m2": rcs, "ir_signature": ir},
            "performance": {"max_g": maxg, "min_speed_mps": vmin, "max_speed_mps": vmax, "service_ceiling_m": ceil},
            "countermeasures": {"flares": flares, "chaff": chaff, "ecm": ecm}, "notes": note}


PLATFORMS = [
    aircraft("f16_viper", "F-16C Viper", "fighter", "fighter_delta", "#9fb2c8", "#00e5ff", 1.2, 1.0, 9, 120, 680, 15000, 60, 60, True),
    aircraft("f15c_eagle", "F-15C Eagle", "fighter", "fighter_swept", "#8a97a8", "#ffb000", 10, 1.4, 9, 130, 810, 18000, 120, 120, True),
    aircraft("f15e_strike", "F-15E Strike Eagle", "fighter", "fighter_swept", "#6f7787", "#ffb000", 8, 1.6, 9, 140, 800, 18000, 120, 120, True),
    aircraft("f18_hornet", "F/A-18E Super Hornet", "fighter", "fighter_delta", "#7f8a99", "#00e5ff", 1.0, 1.1, 7.5, 120, 620, 15000, 60, 60, True),
    aircraft("f22_raptor", "F-22 Raptor", "fighter", "fighter_delta", "#5b6572", "#22ff9c", 0.0001, 0.9, 9, 130, 740, 19800, 60, 60, True, "VLO stealth — very short radar detection."),
    aircraft("f35_lightning", "F-35A Lightning II", "fighter", "fighter_delta", "#6a7482", "#22ff9c", 0.005, 1.0, 9, 120, 600, 15000, 60, 60, True, "LO stealth."),
    aircraft("su35_flanker", "Su-35S Flanker-E", "fighter", "fighter_swept", "#7f8a99", "#ff3d00", 4.0, 1.2, 9, 130, 720, 18000, 96, 96, True),
    aircraft("su30_flanker", "Su-30MKI Flanker-H", "fighter", "fighter_swept", "#77828f", "#ff3d00", 5.0, 1.3, 9, 130, 700, 17300, 96, 96, True),
    aircraft("su57_felon", "Su-57 Felon", "fighter", "fighter_delta", "#5b6572", "#ff3d00", 0.1, 1.0, 9, 130, 720, 20000, 96, 96, True, "LO stealth."),
    aircraft("mig29_fulcrum", "MiG-29 Fulcrum", "fighter", "fighter_swept", "#828d9a", "#ff3d00", 4.0, 1.2, 9, 140, 690, 18000, 60, 60, True),
    aircraft("mig31_foxhound", "MiG-31 Foxhound", "fighter", "fighter_swept", "#6f7787", "#ff3d00", 8, 1.6, 5, 200, 830, 20600, 96, 96, True, "High-speed interceptor; R-37M carrier."),
    aircraft("rafale", "Dassault Rafale", "fighter", "fighter_delta", "#8a97a8", "#00e5ff", 1.0, 1.0, 9, 120, 690, 15200, 100, 100, True),
    aircraft("typhoon", "Eurofighter Typhoon", "fighter", "fighter_delta", "#8a97a8", "#00e5ff", 0.5, 1.0, 9, 120, 720, 16800, 100, 100, True),
    aircraft("j20_dragon", "J-20 Mighty Dragon", "fighter", "fighter_delta", "#5b6572", "#ffb000", 0.05, 1.0, 8, 130, 700, 18000, 60, 60, True, "LO stealth."),
    aircraft("gripen", "JAS 39 Gripen E", "fighter", "fighter_delta", "#9fb2c8", "#00e5ff", 0.5, 0.9, 9, 120, 680, 15200, 60, 60, True),
    aircraft("b52_bomber", "B-52H Stratofortress", "bomber", "bomber_heavy", "#6f7787", "#ffb000", 100, 3.0, 2, 150, 290, 15000, 200, 200, True),
    aircraft("tu95_bear", "Tu-95 Bear", "bomber", "bomber_heavy", "#77828f", "#ffb000", 100, 4.0, 2, 150, 250, 12000, 200, 200, True),
    aircraft("b1_lancer", "B-1B Lancer", "bomber", "bomber_heavy", "#6a7482", "#ffb000", 10, 2.5, 3, 160, 400, 18000, 120, 120, True),
    aircraft("reaper_uav", "MQ-9 Reaper", "uav", "uav_recon", "#c2b280", "#ff3d00", 0.5, 0.4, 3, 50, 130, 15000, 0, 0, False),
    aircraft("global_hawk", "RQ-4 Global Hawk", "uav", "uav_recon", "#c2b280", "#00e5ff", 1.0, 0.5, 2.5, 80, 175, 18000, 0, 0, False),
    aircraft("cruise_missile_target", "Subsonic Cruise Missile", "cruise_missile", "cruise_missile", "#9aa4b0", "#66ccff", 0.1, 0.6, 4, 200, 300, 8000, 0, 0, False, "Sea-skimmer threat."),
    aircraft("supersonic_asm", "Supersonic Anti-Ship Missile", "cruise_missile", "cruise_missile", "#9aa4b0", "#ff3d00", 0.3, 1.5, 8, 400, 900, 15000, 0, 0, False, "Mach 2–3 sea-skimmer."),
]


def write(dir, items):
    for it in items:
        with open(os.path.join(dir, it["id"] + ".json"), "w", encoding="utf-8") as f:
            json.dump(it, f, indent=2, ensure_ascii=False)
    return len(items)


if __name__ == "__main__":
    n = write(MDIR, MISSILES)
    m = write(PDIR, PLATFORMS)
    print(f"wrote {n} missiles/SAMs → {MDIR}")
    print(f"wrote {m} platforms → {PDIR}")
