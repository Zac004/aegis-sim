"""
core.maneuvers — target maneuver library + timeline builder.
============================================================

A target's evasive behaviour is expressed as a *commanded acceleration* (and,
for some maneuvers, a bank/heading intent) as a function of time and events. Two
layers:

  1. **Preset maneuvers** — parametric evasions (break turn, weave, barrel roll,
     Split-S, Immelmann, notch, jink) registered under the ``maneuver`` category.
  2. **Timeline / waypoint engine** — :class:`ManeuverTimeline` sequences presets
     against absolute times *and* triggers (e.g. "on missile launch", "when
     range < 5 km", "when time-to-impact < 4 s"), and can fire countermeasures.

The simulation calls ``timeline.command(t, target, events)`` each step to get the
target's acceleration and any countermeasure releases.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, List, Optional

import numpy as np

from core.registry import register, Maneuver, create, keys
from core.atmosphere import G0


def _unit(v):
    n = np.linalg.norm(v)
    return v / n if n > 1e-9 else np.zeros(3)


# ── preset maneuvers ─────────────────────────────────────────────────────────

@register("maneuver", "straight", label="Straight & Level")
class Straight(Maneuver):
    def command(self, t, target, events):
        return np.zeros(3)


@register("maneuver", "break_turn", label="Max-G Break Turn")
class BreakTurn(Maneuver):
    """Sustained hard turn perpendicular to velocity in the horizontal plane."""
    def __init__(self, g=8.0, direction="right", **kw):
        super().__init__(**kw)
        self.g = g
        self.sign = 1.0 if direction == "right" else -1.0

    def command(self, t, target, events):
        v = target.velocity
        horiz = _unit(np.array([v[0], v[1], 0.0]))
        # perpendicular in horizontal plane (NED: down is +z)
        perp = np.array([-horiz[1], horiz[0], 0.0]) * self.sign
        return perp * self.g * G0


@register("maneuver", "weave", label="Weave / Snake")
class Weave(Maneuver):
    """Sinusoidal side-to-side loading to defeat PN prediction."""
    def __init__(self, g=6.0, period=3.0, **kw):
        super().__init__(**kw)
        self.g = g
        self.omega = 2 * np.pi / period

    def command(self, t, target, events):
        v = target.velocity
        horiz = _unit(np.array([v[0], v[1], 0.0]))
        perp = np.array([-horiz[1], horiz[0], 0.0])
        return perp * self.g * G0 * np.sin(self.omega * (t - getattr(self, "_t0", 0.0)))


@register("maneuver", "barrel_roll", label="Barrel Roll")
class BarrelRoll(Maneuver):
    """Rotating lift vector — combines pitch & yaw accel on a circle."""
    def __init__(self, g=5.0, period=2.5, **kw):
        super().__init__(**kw)
        self.g = g
        self.omega = 2 * np.pi / period

    def command(self, t, target, events):
        v = target.velocity
        fwd = _unit(v)
        # build a frame perpendicular to velocity
        up = np.array([0.0, 0.0, -1.0])
        right = _unit(np.cross(fwd, up))
        up = _unit(np.cross(right, fwd))
        ph = self.omega * (t - getattr(self, "_t0", 0.0))
        return (np.cos(ph) * up + np.sin(ph) * right) * self.g * G0


@register("maneuver", "split_s", label="Split-S (diving reversal)")
class SplitS(Maneuver):
    """Roll inverted and pull down — strong vertical unload then dive."""
    def __init__(self, g=7.0, **kw):
        super().__init__(**kw)
        self.g = g

    def command(self, t, target, events):
        # pull toward +Down (NED) i.e. dive, plus decelerating turn
        return np.array([0.0, 0.0, self.g * G0])


@register("maneuver", "immelmann", label="Immelmann (climbing reversal)")
class Immelmann(Maneuver):
    def __init__(self, g=6.0, **kw):
        super().__init__(**kw)
        self.g = g

    def command(self, t, target, events):
        # pull up (−Down) to climb and reverse
        return np.array([0.0, 0.0, -self.g * G0])


@register("maneuver", "notch", label="Beam / Notch (Doppler defeat)")
class Notch(Maneuver):
    """Turn to put the missile on the beam (~90° aspect) to defeat pulse-Doppler.

    Steers velocity toward perpendicular to the LOS to the threat. Requires the
    threat position in ``events['threat_pos']`` (the simulation supplies it).
    """
    def __init__(self, g=6.0, **kw):
        super().__init__(**kw)
        self.g = g

    def command(self, t, target, events):
        threat = events.get("threat_pos")
        if threat is None:
            return np.zeros(3)
        los = _unit(threat - target.position)
        v = _unit(target.velocity)
        # desired velocity direction: perpendicular to LOS, in horizontal plane
        desired = _unit(np.cross(np.array([0, 0, -1.0]), los))
        if np.dot(desired, v) < 0:
            desired = -desired
        err = desired - v
        perp = err - np.dot(err, v) * v
        return _unit(perp) * self.g * G0 if np.linalg.norm(perp) > 1e-6 else np.zeros(3)


@register("maneuver", "jink", label="Random Jink")
class Jink(Maneuver):
    """Pseudo-random hard reversals — unpredictable last-ditch defense."""
    def __init__(self, g=8.0, switch_period=1.2, seed=0, **kw):
        super().__init__(**kw)
        self.g = g
        self.switch = switch_period
        self._rng = np.random.default_rng(seed)
        self._next = 0.0
        self._dir = 1.0

    def command(self, t, target, events):
        if t >= self._next:
            self._dir = self._rng.choice([-1.0, 1.0])
            self._next = t + self.switch * (0.6 + 0.8 * self._rng.random())
        v = target.velocity
        horiz = _unit(np.array([v[0], v[1], 0.0]))
        perp = np.array([-horiz[1], horiz[0], 0.0]) * self._dir
        return perp * self.g * G0


@register("maneuver", "break_to_heading", label="Break → Roll-out Heading",
          description="Hard level break at the set G, then roll out and steady on a chosen heading (°true). Models a defensive turn to a specific escape course.")
class BreakToHeading(Maneuver):
    """Turn hard at ``g`` until the ground track reaches ``heading_deg``, then fly
    straight. ``direction`` may be 'left', 'right', or 'shortest'."""
    def __init__(self, g=7.0, heading_deg=180.0, direction="shortest", tol_deg=4.0, **kw):
        super().__init__(**kw)
        self.g = g
        self.target_hdg = np.radians(heading_deg)
        self.direction = direction
        self.tol = np.radians(tol_deg)

    def command(self, t, target, events):
        v = target.velocity
        hd = np.array([v[0], v[1], 0.0])
        if np.linalg.norm(hd) < 1e-6:
            return np.zeros(3)
        cur = np.arctan2(v[1], v[0])
        err = (self.target_hdg - cur + np.pi) % (2 * np.pi) - np.pi   # shortest signed error
        if abs(err) < self.tol:
            return np.zeros(3)   # rolled out on heading
        if self.direction == "right":
            sign = 1.0
        elif self.direction == "left":
            sign = -1.0
        else:
            sign = 1.0 if err > 0 else -1.0
        horiz = _unit(hd)
        perp = np.array([-horiz[1], horiz[0], 0.0]) * sign
        return perp * self.g * G0


@register("maneuver", "extend", label="Extend (unload & run)",
          description="Wings-level, near-zero G — accelerate away to build energy and open range. The classic 'extend' after a defensive break to reset the fight.")
class Extend(Maneuver):
    def __init__(self, descent_deg=0.0, **kw):
        super().__init__(**kw)
        self.descent = np.radians(descent_deg)

    def command(self, t, target, events):
        # unloaded flight = ~1g wings-level; optionally a shallow descent to gain speed
        if self.descent > 1e-3:
            return np.array([0.0, 0.0, 0.4 * G0])   # gentle nose-down
        return np.zeros(3)


@register("maneuver", "climb", label="Climb",
          description="Pull up and climb at the set G. Trades airspeed for altitude/potential energy — useful to force a look-up shot that bleeds the missile.")
class Climb(Maneuver):
    def __init__(self, g=3.0, **kw):
        super().__init__(**kw)
        self.g = g

    def command(self, t, target, events):
        return np.array([0.0, 0.0, -self.g * G0])   # −Down = up


@register("maneuver", "dive", label="Dive (drag to the deck)",
          description="Push/roll and descend at the set G — drag the missile into dense low air where its drag rises and it bleeds energy fastest. Pairs with the notch.")
class Dive(Maneuver):
    def __init__(self, g=3.0, **kw):
        super().__init__(**kw)
        self.g = g

    def command(self, t, target, events):
        return np.array([0.0, 0.0, self.g * G0])    # +Down = descend


@register("maneuver", "go_cold", label="Go Cold / Drag (turn tail-on)",
          description="Turn to put the threat directly behind you (0° aspect — cold) at the set G, then extend away. The classic 'drag' to defeat a radar shot by denying closure and running out of its range. Optionally set a turn rate (°/s) instead of G.")
class GoCold(Maneuver):
    """Turn the velocity vector to point directly away from the threat, then run.

    ``g``           turn hardness [g] (used if no ``rate_deg_s`` given).
    ``rate_deg_s``  optional fixed turn rate; if set, G is derived from V·ω.
    ``tol_deg``     how close to tail-on before rolling out to extend.
    """
    def __init__(self, g=6.0, rate_deg_s=0.0, tol_deg=8.0, **kw):
        super().__init__(**kw)
        self.g = g
        self.rate = np.radians(rate_deg_s)
        self.tol = np.radians(tol_deg)

    def command(self, t, target, events):
        threat = events.get("threat_pos")
        if threat is None:
            return np.zeros(3)
        away = target.position - threat
        away[2] = 0.0
        an = np.linalg.norm(away)
        v = target.velocity
        vh = np.array([v[0], v[1], 0.0])
        vn = np.linalg.norm(vh)
        if an < 1e-6 or vn < 1e-6:
            return np.zeros(3)
        away /= an
        vhat = vh / vn
        if np.dot(vhat, away) >= np.cos(self.tol):
            return np.zeros(3)                       # cold — now extend
        # derive lateral accel: fixed rate (a = V·ω) or fixed G
        g_use = self.g if self.rate <= 0 else min(target.speed() * self.rate / G0, 9.0)
        cross_z = vhat[0] * away[1] - vhat[1] * away[0]
        sign = 1.0 if cross_z > 0 else -1.0
        perp = np.array([-vhat[1], vhat[0], 0.0]) * sign
        return perp * g_use * G0


# ── timeline / waypoint engine ───────────────────────────────────────────────

@dataclass
class TimelineSegment:
    """One entry in a maneuver timeline.

    trigger : either ('time', t_seconds) or ('event', name) or ('range', metres)
              or ('tti', seconds_to_impact). When it fires, `maneuver_key` becomes
              active until the next segment triggers.
    countermeasure : optional dict released once when the segment fires, e.g.
              {"type": "flare", "count": 4, "intensity": 1.0}.
    """
    trigger: tuple
    maneuver_key: str
    params: dict = field(default_factory=dict)
    countermeasure: Optional[dict] = None
    _fired: bool = False


class ManeuverTimeline:
    """Sequences maneuver segments by time and event triggers."""

    def __init__(self, segments: List[TimelineSegment], default="straight"):
        self.segments = segments
        self.default_key = default
        self._built = {}
        self._active_key = default
        self._active = create("maneuver", default)
        self._active._t0 = 0.0
        self._cm_events: List[dict] = []

    def reset(self):
        for s in self.segments:
            s._fired = False
        self._active_key = self.default_key
        self._active = create("maneuver", self.default_key)
        self._active._t0 = 0.0
        self._cm_events = []

    def _instantiate(self, seg: TimelineSegment, t: float):
        m = create("maneuver", seg.maneuver_key, **seg.params)
        m._t0 = t
        return m

    def command(self, t, target, events):
        """Evaluate triggers, switch the active maneuver, return accel + CMs."""
        released = []
        for seg in self.segments:
            if seg._fired:
                continue
            kind = seg.trigger[0]
            fire = False
            if kind == "time":
                fire = t >= seg.trigger[1]
            elif kind == "event":
                fire = bool(events.get(seg.trigger[1]))
            elif kind == "range":
                fire = events.get("range_to_threat", 1e12) <= seg.trigger[1]
            elif kind == "tti":
                fire = events.get("time_to_impact", 1e12) <= seg.trigger[1]
            if fire:
                seg._fired = True
                self._active_key = seg.maneuver_key
                self._active = self._instantiate(seg, t)
                if seg.countermeasure:
                    cm = dict(seg.countermeasure)
                    cm["released_at"] = t
                    released.append(cm)
        accel = self._active.command(t, target, events)
        return accel, released

    @property
    def active_maneuver(self):
        return self._active_key


def build_timeline(spec: List[dict], default="straight") -> ManeuverTimeline:
    """Build a timeline from a JSON-friendly spec.

    Each item: {"trigger": {"type": "time"|"event"|"range"|"tti", "value": ...},
                "maneuver": "break_turn", "params": {...},
                "countermeasure": {"type": "flare", "count": 4}}
    """
    segs = []
    for item in spec:
        trg = item["trigger"]
        trigger = (trg["type"], trg.get("value"))
        segs.append(TimelineSegment(
            trigger=trigger,
            maneuver_key=item["maneuver"],
            params=item.get("params", {}),
            countermeasure=item.get("countermeasure"),
        ))
    return ManeuverTimeline(segs, default=default)


def preset_names() -> List[str]:
    return keys("maneuver")
