"""
core.visuals — the shared sprite & colour library (visual continuity).
======================================================================

A single source of truth for the 3D "sprite kits" and colour palette the UI
offers when creating or saving a missile / platform. Because every craft picks
from the same catalogue, the same missile always looks the same across every
scenario, and users can theme their creations while staying visually coherent.

The frontend fetches this via ``/api/catalog`` and renders swatches / a sprite
picker; the viewport maps ``sprite`` → a procedural mesh builder and tints it
with ``color`` (primary skin) and ``accent`` (bands, glow, markings).
"""

from __future__ import annotations

# sprite kits — key → {label, class, default colours}
#   class "missile" kits are built by the interceptor mesh builder;
#   class "aircraft" kits by the platform mesh builder.
SPRITES = [
    {"key": "aam_slender",   "label": "AAM — Slender Dart",      "class": "missile",  "color": "#d9dde3", "accent": "#ffb000"},
    {"key": "sam_heavy",     "label": "SAM — Heavy Interceptor", "class": "missile",  "color": "#e6e9ee", "accent": "#00e5ff"},
    {"key": "cruise_dart",   "label": "Cruise / ARM — Dart",     "class": "missile",  "color": "#9aa4b0", "accent": "#ff8a3a"},
    {"key": "fighter_delta", "label": "Fighter — Delta",         "class": "aircraft", "color": "#8b95a3", "accent": "#00e5ff"},
    {"key": "fighter_swept", "label": "Fighter — Swept Wing",    "class": "aircraft", "color": "#7f8a99", "accent": "#22ff9c"},
    {"key": "bomber_heavy",  "label": "Bomber — Heavy",          "class": "aircraft", "color": "#6f7787", "accent": "#ffb000"},
    {"key": "cruise_missile","label": "Cruise Missile — Target", "class": "aircraft", "color": "#9aa4b0", "accent": "#66ccff"},
    {"key": "uav_recon",     "label": "UAV — Recon",             "class": "aircraft", "color": "#c2b280", "accent": "#ff3d00"},
]

# named colour swatches offered by the editor (skin + accent share this list)
PALETTES = [
    {"name": "Steel",    "hex": "#d9dde3"},
    {"name": "Gunmetal", "hex": "#8b95a3"},
    {"name": "Charcoal", "hex": "#3a4150"},
    {"name": "Arctic",   "hex": "#e8eef5"},
    {"name": "Olive",    "hex": "#6b7250"},
    {"name": "Sand",     "hex": "#c2b280"},
    {"name": "Navy",     "hex": "#35507a"},
    {"name": "Crimson",  "hex": "#b03030"},
    {"name": "Amber",    "hex": "#ffb000"},
    {"name": "Tactical Blue", "hex": "#00e5ff"},
    {"name": "Danger Red",    "hex": "#ff3d00"},
    {"name": "Ion Green",     "hex": "#22ff9c"},
]

_SPRITE_KEYS = {s["key"] for s in SPRITES}


def default_missile_visual(category: str | None) -> dict:
    if category == "surface_to_air":
        return {"sprite": "sam_heavy", "color": "#e6e9ee", "accent": "#00e5ff"}
    return {"sprite": "aam_slender", "color": "#d9dde3", "accent": "#ffb000"}


def default_platform_visual(ptype: str | None) -> dict:
    m = {
        "fighter": {"sprite": "fighter_delta", "color": "#8b95a3", "accent": "#00e5ff"},
        "bomber": {"sprite": "bomber_heavy", "color": "#6f7787", "accent": "#ffb000"},
        "cruise_missile": {"sprite": "cruise_missile", "color": "#9aa4b0", "accent": "#66ccff"},
        "uav": {"sprite": "uav_recon", "color": "#c2b280", "accent": "#ff3d00"},
    }
    return m.get(ptype, {"sprite": "fighter_delta", "color": "#8b95a3", "accent": "#00e5ff"})


def normalize_visual(v: dict | None, fallback: dict) -> dict:
    """Validate a stored visual against the catalogue, filling gaps."""
    v = dict(v or {})
    if v.get("sprite") not in _SPRITE_KEYS:
        v["sprite"] = fallback["sprite"]
    v.setdefault("color", fallback["color"])
    v.setdefault("accent", fallback["accent"])
    return {"sprite": v["sprite"], "color": v["color"], "accent": v["accent"]}


def catalog() -> dict:
    return {"sprites": SPRITES, "palettes": PALETTES}
