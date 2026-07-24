// help.js — the in-app Learn guide / BVR academy. A complete teaching reference:
// the science of BVR/WVR missile combat, NATO tactical doctrine, how this
// simulator models it, and every parameter in the app — with live interactive
// widgets (aspect dial, radar-horizon calc, PN sandbox, Doppler-notch demo, MAR
// decision bands, a check-ride quiz). Plain language first, physics alongside.
// A `<div data-widget="name">` in a section's html mounts the matching widget.

import { mountWidgets, progress } from './academy.js';

// Category assignment for the grouped nav. Order of CATEGORIES = order shown.
export const CATEGORIES = [
  '✦ START HERE', '◉ FOUNDATIONS', '▲ THE MISSILE', '◈ BVR DOCTRINE',
  '⚡ ELECTRONIC WARFARE', '▼ SAM & IADS', '✪ MODERN WARFARE',
  '⚙ SIMULATOR REFERENCE', '✔ MASTERY',
];
const CAT_OF = {
  start: 0, syllabus: 0,
  radar101: 1, radartypes: 1, radarroles: 1, ir101: 1, aero: 1, atmos: 1, weather: 1, humanfactors: 1,
  guidance: 2, guidancelaws: 2, loft: 2, propulsion: 2, motors: 2, battery: 2,
  seeker: 2, seekertrack: 2, fuzing: 2, cccm: 2, codex: 2,
  timeline: 3, midcourse: 3, brevity: 3, mar: 3, defence: 3, wvr: 3,
  emtheory: 3, formations: 3, rwr: 3,
  ew: 4, cm: 4,
  sam: 5, horizon: 5, iadsnet: 5,
  modern: 6, datalinknet: 6, datalinks: 6, history: 6,
  hitmiss: 7, params: 7, ranges: 7,
  challenge_sec: 8, threatid: 8, checkride: 8, career: 8, glossary: 8,
};

export const HELP_SECTIONS = [
  {
    id: 'start', title: '① Getting Started',
    html: `
      <p>Aegis-Sim flies 1-v-1 missile engagements — <b>Beyond-Visual-Range (BVR)</b> air combat and
      <b>Surface-to-Air (SAM)</b> intercepts — with a full <b>6-degree-of-freedom</b> physics core:
      real thrust curves, mass depletion, drag, lift, actuator-limited fins, seeker noise, datalinks,
      lofted midcourse trajectories and battery life. Nothing is scripted; every outcome falls out of
      the physics.</p>
      <ol>
        <li><b>① Mission</b> — pick a preset or name a fresh engagement.</li>
        <li><b>② The Merge / Threat Geometry</b> — the picture at trigger-pull: range, aspect,
        altitudes, speeds (or, for SAM, threat range/bearing and launcher elevation).</li>
        <li><b>③ Blue Forces</b> — the shooter and its weapon: airframe, guidance law, seeker,
        autopilot, structural limits.</li>
        <li><b>④ Red Forces</b> — the target and its defence: a timeline of maneuvers and
        countermeasures triggered by time, range, or time-to-impact.</li>
        <li><b>⑤ Conditions</b> — atmosphere model and simulation settings.</li>
        <li>Press <b>ENGAGE</b>, play the solution back, read the charts and the engagement log.</li>
      </ol>
      <p class="tip">The fastest way to learn: change <b>one</b> thing and re-fire. Move the launch
      10 km out. Make the break 2 seconds earlier. Swap APN for OGL. Watch the elevation profile and
      the Mach chart tell you why the outcome changed. And hover <b>anything</b> — every control in
      the app explains itself on mouse-over.</p>
      <p><b>New to air combat?</b> This guide is a from-scratch academy. Read it in order — every
      section has a live widget you can drag and sweep — and by the end you'll understand BVR better
      than most flight-sim pilots. Start with the <b>syllabus</b> below.</p>`,
  },
  {
    id: 'syllabus', title: '★ The Ab-Initio Syllabus',
    html: `
      <p>A path from zero to BVR-literate. Each rung has a section and a hands-on widget or sim drill.
      Do them in order; nothing assumes prior knowledge.</p>
      <ol class="syllabus">
        <li><b>Geometry & aspect</b> — read the picture: aspect, angle-off, closure. <i>Widget: the aspect dial.</i></li>
        <li><b>Radar & IR fundamentals</b> — pulses, Doppler, PRF, RCS, heat bands, IRST. <i>Widget: the radar-equation explorer.</i></li>
        <li><b>How missiles steer</b> — Proportional Navigation and the constant-bearing collision. <i>Widget: the PN sandbox.</i></li>
        <li><b>Energy, motors & the loft</b> — boost-sustain vs dual-pulse vs ramjet, batteries, warheads & fuzing. <i>Widget: the motor race.</i></li>
        <li><b>Datalink, midcourse & the poles</b> — the BVR relay race and how safely you shot.</li>
        <li><b>The no-escape zone & MAR</b> — the most important number in a BVR merge. <i>Widget: the MAR ruler.</i></li>
        <li><b>The timeline & brevity</b> — skate / short skate / banzai, fox calls, the grinder.</li>
        <li><b>Aspect defeat</b> — the NATO menu for beating a shot: drag, notch, dive, break. <i>Widget: the Doppler notch.</i></li>
        <li><b>Electronic warfare</b> — every jamming type, DRFM deception, burn-through, HOJ. <i>Widget: the J/S demo.</i></li>
        <li><b>Countermeasures</b> — chaff physics, flare rejection, decoys. <i>Mini-game: the flare fight.</i></li>
        <li><b>The WVR arena</b> — corner velocity, one-circle/two-circle, HOBS. <i>Widget: the doghouse plot.</i></li>
        <li><b>SAMs, the radar horizon & IADS</b> — up-and-over shots, the LRSAM blind spot, SEAD. <i>Widgets: horizon calc + IADS rings.</i></li>
        <li><b>Modern BVR</b> — stealth, AESA, networked kill-chains, and where it's all going.</li>
        <li><b>Check-ride</b> — prove it: randomized 8-question rides from a 24-question bank; your best score feeds your rank. <i>Widget: the quiz.</i></li>
      </ol>
      <p class="tip">Then open <b>◈ TACTICAL-AI</b> on any scenario and read the kneeboard it computes —
      Rmax, MAR, abort-G, notch window, recommit, pole study — and go verify each number by flying it.
      That loop (read → predict → fly → check) is how you actually build mastery here. Jump straight to <a data-goto="checkride">the check-ride</a> anytime. Your progress
      and quiz scores feed the <b>rank</b> shown above the topic list — read everything and ace the
      check-ride to reach WEAPONS SCHOOL.</p>`,
  },
  {
    id: 'radar101', title: 'Radar Fundamentals — Pulses, Doppler, PRF & RCS',
    html: `
      <p>Radar decides who sees whom first, which decides almost everything else. The machinery in
      plain language:</p>
      <h3>How a radar measures anything</h3>
      <ul>
        <li><b>Range</b> — transmit a pulse, time the echo: R = c·Δt/2. Simple, ancient, still the core.</li>
        <li><b>Velocity</b> — the echo comes back frequency-shifted by the target's <b>radial</b>
        (closing) velocity: the Doppler shift. This is the superpower <i>and</i> the weakness — a
        radar that sorts the world by Doppler can be hidden from by controlling your closing velocity
        (the notch).</li>
        <li><b>Angle</b> — the antenna (or the AESA's electronic beam) knows where it's pointing;
        monopulse compares simultaneous lobes to refine the target's angle in a single pulse, which
        is also what makes modern radars hard to angle-deceive.</li>
      </ul>
      <h3>PRF — the three-way compromise</h3>
      <p>Pulse Repetition Frequency is how often the radar transmits, and it forces a real trade:</p>
      <ul>
        <li><b>Low PRF</b> — unambiguous range (each echo returns before the next pulse) but hopeless
        Doppler ambiguity and terrible look-down performance. Old search radars.</li>
        <li><b>High PRF</b> — unambiguous, exquisite Doppler (great vs closing targets, great in
        look-down) but ambiguous range. The classic "velocity search" mode that sees a hot fighter
        very far but can't range him precisely.</li>
        <li><b>Medium PRF</b> — both range and Doppler are ambiguous, but cleverly so: by hopping
        between several PRFs the ambiguities are resolved. The workhorse of modern fighter radars —
        decent everywhere, supreme nowhere.</li>
      </ul>
      <h3>Modes you'll hear about</h3>
      <p><b>RWS</b> (range-while-search) paints the sky; <b>TWS</b> (track-while-scan) builds silent
      track files on multiple targets without alerting them that they're singled out; <b>STT</b>
      (single-target-track) locks one target with the full beam — best data, but his RWR screams.
      Modern doctrine fires BVR shots from TWS precisely to deny the defender that scream: often the
      first warning is the missile's own seeker at pitbull ("<b>MADDOG/HUSKY</b> surprise").</p>
      <h3>The radar equation — and why stealth wins arguments</h3>
      <p class="eq">R<sub>detect</sub> ∝ ( P<sub>t</sub> · G² · λ² · σ )<sup>¼</sup></p>
      <p>Every term under a fourth root. Sweep power and RCS below and watch how little raw power
      buys — and how catastrophically RCS reduction collapses detection range:</p>
      <div class="wx" data-widget="radareq"></div>
      <p class="tip">RCS is not one number — it varies wildly with aspect (nose-on is what gets
      quoted; beam aspect can be 100× bigger) and with band (VLO shaping is optimised against
      fighter X-band; long-wave surveillance radars see stealth jets far better, which is why
      counter-stealth radars are low-band and why the sim's RCS drives seeker acquisition range).</p>`,
  },
  {
    id: 'radartypes', title: 'How Radar Scans — Mechanical, Pulse-Doppler & AESA',
    html: `
      <p>"Radar" is not one thing. <i>How</i> it points its beam and <i>how</i> it processes echoes decide
      what it can do. Two revolutions separate a 1960s dish from a modern fighter's array.</p>
      <h3>Steering the beam: mechanical vs electronic</h3>
      <p>Toggle between a spinning dish and an AESA and watch the difference in how the sky is scanned:</p>
      <div class="wx" data-widget="radarscan"></div>
      <ul>
        <li><b>Mechanical (dish).</b> A physical antenna is slewed by motors. One pencil beam, scan rate
        limited by inertia, and it can search <i>or</i> track — not both at once. The picture is only as
        fresh as the last sweep.</li>
        <li><b>PESA</b> (passive electronically-scanned) steers a single beam electronically from one
        central transmitter — faster than mechanical, but still one beam.</li>
        <li><b>AESA</b> (active electronically-scanned) is hundreds/thousands of tiny transmit-receive
        modules, each its own mini-radar. The beam is formed and repositioned in <b>microseconds</b>, so
        the radar <b>interleaves</b> search + multi-target track + jamming + <a data-goto="datalinks">datalink</a>
        from one face. Bonus: <b>frequency agility</b> (hard to jam), <b>LPI</b> emissions (hard to even
        detect on an RWR), and <b>graceful degradation</b> — lose modules, not the radar. This is why AESA
        rewrote air combat.</li>
      </ul>
      <h3>Processing echoes: the pulse-Doppler PRF trade</h3>
      <p>How often the radar pulses (its <b>PRF</b>) forces a fundamental compromise between measuring
      <i>range</i> and measuring <i>velocity</i>. Sweep it:</p>
      <div class="wx" data-widget="prf"></div>
      <p>This is why <b>look-down/shoot-down</b> needed pulse-Doppler (high/medium PRF filters fast movers
      out of ground clutter), and why the <a data-goto="ew">Doppler notch</a> exists at all — beam the
      radar and your near-zero velocity drops you into the clutter it must reject.</p>`,
  },
  {
    id: 'radarroles', title: 'The Radar Family — EW, Acquisition, FCR & Ground vs Air',
    html: `
      <p>An air-defence system fields several <i>kinds</i> of radar doing different jobs, chained
      together. Confusing them is a common mistake — they trade range against precision in opposite
      directions.</p>
      <div class="wx" data-widget="radarfamily"></div>
      <ul>
        <li><b>Early-warning / surveillance radar</b> — huge, long-range (hundreds of km), usually
        low-frequency (VHF/UHF). Slow update, coarse — its product is a <b>cue</b>, not a firing
        solution. Low band also sees stealth best (counter-stealth).</li>
        <li><b>Acquisition / target-acquisition radar</b> — mid-range, higher frequency; takes the cue
        and builds a firm track to hand off.</li>
        <li><b>Fire-control radar (FCR)</b> — a narrow, high-update pencil beam that <b>tracks the target
        precisely and guides the weapon</b> (continuous-wave illumination for SARH, or a datalink uplink
        for ARH). Short-ranged but exact. On a fighter, one AESA does all three roles interleaved; a
        ground <a data-goto="iadsnet">IADS</a> splits them so killing one radar doesn't blind the system.</li>
      </ul>
      <h3>Ground-based vs airborne — the geometry that changes everything</h3>
      <div class="wx" data-widget="groundvsair"></div>
      <p>A <b>ground radar</b> has big power and no self-clutter looking up, but it's <a data-goto="horizon">horizon-limited</a>
      — low flyers hide below the curve. An <b>airborne radar</b> is elevated so it can <b>look down</b>
      and catch them, but now it stares into <b>ground clutter</b> and must be <a data-goto="radartypes">pulse-Doppler</a>
      to separate movers from dirt. That single geometric difference is the entire reason AWACS exists.</p>
      <h3>How the beam measures angle precisely: monopulse</h3>
      <div class="wx" data-widget="monopulse"></div>
      <p>Modern tracking radars use <b>monopulse</b> — comparing simultaneous squinted beams to get the
      target's exact off-axis angle from a <i>single pulse</i>. It's precise and hard to angle-deceive,
      which is why deception jammers must resort to cross-eye or terrain-bounce (see <a data-goto="ew">EW</a>).</p>`,
  },
  {
    id: 'ir101', title: 'Infrared Fundamentals — Heat, Bands & IRST',
    html: `
      <p>Everything above absolute zero glows in the infrared. IR sensors weaponise that — silently.</p>
      <ul>
        <li><b>What glows on a jet:</b> the engine hot parts and plume (fiercest, but mostly visible
        from behind), the exhaust-washed tailpipe, and — at speed — <b>aerodynamic skin heating</b>
        (a Mach 1.6 jet's leading edges glow tens of degrees above ambient, visible from any aspect;
        a Mach 5 missile is a torch). Afterburner multiplies signature many times: burner in a fight
        is a beacon.</li>
        <li><b>Bands:</b> <b>MWIR (3–5 µm)</b> — hot plumes and tailpipes peak here; classic seeker
        band. <b>LWIR (8–12 µm)</b> — cooler skin-heat peaks here; the band of imaging sensors and
        IRSTs that find targets from the front. The atmosphere is opaque between the bands (CO₂ and
        H₂O absorption), which is why exactly these two windows exist.</li>
        <li><b>Range behaviour:</b> IR intensity falls as 1/R² (one-way — better scaling than radar's
        R⁴!), but atmospheric absorption and weather eat it: haze and cloud shorten IR ranges far
        more than radar. High and dry favours IR; low and humid kills it.</li>
        <li><b>IRST vs seeker:</b> an IRST is a fighter-mounted telescope that searches and tracks in
        IR — completely passive, immune to RCS stealth and to RF jamming. Paired by datalink with a
        wingman's IRST it can even triangulate range and support a silent radar-off shot: the whole
        stealth-vs-counter-stealth arms race in one sensor.</li>
        <li><b>Seeker generations:</b> spin-scan (flare bait) → con-scan (better) → pseudo-imaging
        rosette scan → true <b>imaging (IIR)</b> focal-plane arrays that recognise shape and reject
        flares by geometry, spectrum and kinematics. That ladder is exactly the ir → iir jump in this
        sim's seeker models.</li>
      </ul>
      <p class="tip">Tactically: IR shots give <b>no RWR warning</b> — nothing radiates. A MICA-IR or
      IIR WVR missile arriving silently is why "no spike" never means "no threat". Check the sim: fire
      a MICA-IR with datalink midcourse and note the target's only cue is the missile itself.</p>`,
  },
  {
    id: 'timeline', title: '② Anatomy of a BVR Engagement',
    html: `
      <p>A real BVR shot is a scripted dance with names for every beat. Aegis-Sim reproduces all of
      them — you'll see these exact words in the engagement log and the phase badge:</p>
      <ol>
        <li><b>Commit</b> — you decide to fight: point at the target, build the radar track.</li>
        <li><b>Launch</b> — the missile leaves the rail with your aircraft's speed and heading
        (launch speed is free missile energy — a fast, high shooter adds kilometres of reach).</li>
        <li><b>MIDCOURSE (datalink)</b> — the missile can't see the target yet; it flies on your
        radar's track, datalinked to it, toward a <b>Predicted Intercept Point</b> (PIP), usually
        <b>lofting</b> into thin air to save energy.</li>
        <li><b>Crank</b> — you turn to the radar gimbal limit: still guiding, but opening range from
        the threat and any missile coming back at you.</li>
        <li><b>PITBULL</b> — the missile's own seeker acquires and goes active. It no longer needs
        you. The log marks it; the map drops a diamond at the spot.</li>
        <li><b>TERMINAL</b> — the endgame: seeker-guided homing, proportional navigation against a
        maneuvering, jamming, chaffing target. Decided in the last 10 seconds by <b>energy</b>: can
        the missile out-turn the target's last-ditch break?</li>
        <li><b>Abort / Recommit</b> — if a threat missile is coming at <i>you</i>, you may turn cold
        and run (abort) before its no-escape zone, then turn back (recommit) once it's dead. The
        <b>◈ TACTICAL-AI</b> button computes those exact numbers for your scenario.</li>
      </ol>
      <p><b>The poles</b> measure how safely you shot: <b>A-pole</b> = your range from the target
      when your missile goes pitbull (bigger = you're free sooner); <b>F-pole</b> = your range at
      impact (bigger = you killed from farther). Both are reported in Run Analysis, and the
      Tactical-AI's <b>pole study</b> shows how cranking trades them against your exposure.</p>
      <h3>Read the picture — aspect, angle-off, closure</h3>
      <p>Before any of this you must be able to read the geometry at a glance. Drag the bandit's
      heading and watch the <b>aspect angle</b> and the NATO brevity term change:</p>
      <div class="wx" data-widget="aspect"></div>
      <p><b>Aspect</b> is what the bandit shows <i>you</i> (180 hot / 90 beam / 0 cold). <b>Angle-off</b>
      is the difference between your two headings — how hard you'd turn to match his tail. <b>Closure</b>
      (V<sub>c</sub>) is how fast the range shrinks: highest head-on, near zero on the beam. These three
      words describe every merge; the brevity calls (HOT, FLANKING, BEAM, DRAG, COLD) are just names
      for the aspect bands — see <a data-goto="brevity">the full brevity glossary</a>.</p>
      <p class="tip">Where this leads: aspect is the lever behind <a data-goto="defence">aspect defeat</a>
      (going beam/cold to beat a shot) and the <a data-goto="ew">Doppler notch</a>. Closure sets your
      <a data-goto="mar">MAR and no-escape zone</a>.</p>`,
  },
  {
    id: 'guidance', title: 'Guidance Laws — How a Missile Steers',
    html: `
      <p>A homing missile flies to where the target <i>will be</i>. The foundation is
      <b>Proportional Navigation (PN)</b>:</p>
      <p class="eq">a<sub>cmd</sub> = N · V<sub>c</sub> · λ̇</p>
      <p>Command lateral acceleration proportional to the <b>line-of-sight rotation rate</b> (λ̇),
      closing speed (V<sub>c</sub>), and gain <b>N</b> (3–5). The insight: <b>if the line-of-sight
      stops rotating, you are on a collision course</b> — PN drives that rotation to zero.</p>
      <ul>
        <li><b>True PN (pn)</b> — the classic law. What IR dogfight missiles and old SARH rounds fly.
        Homes all the way; <i>never lofts</i>.</li>
        <li><b>Augmented PN (apn)</b> — adds a N/2·a<sub>target</sub> feed-forward so it leads a
        <i>turning</i> target instead of chasing it. The all-round modern choice.</li>
        <li><b>Optimal Guidance (ogl)</b> — a finite-time-optimal law built on zero-effort-miss with
        gravity compensation. Flies the most energy-efficient endgame; the standard pick for
        long-range lofted shots.</li>
        <li><b>Command-to-LOS (clos)</b> — beam riding: the missile holds itself on the rotating
        launcher→target line, with the Coriolis feed-forward a swept beam demands. Point-defence SAMs
        (Tor). Short range only; <i>never lofts</i>.</li>
      </ul>
      <p><b>N (navigation constant):</b> higher corrects sooner and harder but amplifies seeker
      noise and burns energy against a jinking target. Watch the G-load chart at N=3 vs N=5.</p>
      <h3>See it: the PN sandbox</h3>
      <p>Fire a PN missile at a crossing target. Sweep <b>N</b>, toggle the target's jink, and watch the
      faint <b>line-of-sight lines</b>: when they stay parallel, you're on a collision course — that's
      the whole idea. PN just drives the LOS rotation to zero.</p>
      <div class="wx" data-widget="pnlab"></div>
      <p class="tip">Which laws loft? Only datalink-capable weapons flying APN or OGL midcourse —
      because a loft needs a <i>predicted intercept point</i> to fly toward. PN/CLOS home on the
      here-and-now and IR missiles have no datalink, so none of them loft. The sim enforces exactly
      this. See the flight paths compared in <a data-goto="guidancelaws">Guidance Laws Compared</a>.</p>`,
  },
  {
    id: 'guidancelaws', title: 'Guidance Laws Compared — Pursuit vs PN vs Beam-Riding',
    html: `
      <p>Every homing law is an answer to one question: "which way should I turn <i>now</i>?" Watch the
      same shot flown by three different answers — the paths tell the whole story:</p>
      <div class="wx" data-widget="guidancecompare"></div>
      <ul>
        <li><b>Pure pursuit</b> — always point the nose <i>at where the target is now</i>. Intuitive and
        what a naive heat-seeker does, but it produces a long <b>curved tail-chase</b>: you're forever
        aiming behind, arriving late and slow. A hard turn by the target makes it worse.</li>
        <li><b>Lead / deviated pursuit</b> — aim a fixed angle <i>ahead</i> of the target. Better, but the
        lead is a guess, not adaptive to the geometry.</li>
        <li><b>Proportional Navigation (PN)</b> — turn in proportion to how fast the <b>line of sight is
        rotating</b> (a = N·V<sub>c</sub>·λ̇). This flies the <b>collision triangle</b>: a near-straight,
        energy-efficient intercept that automatically leads a maneuvering target. Every real homing
        missile uses PN or a variant.
          <ul>
            <li><b>APN</b> adds a term for the target's measured acceleration → leads a turning target
            even better.</li>
            <li><b>OGL</b> (optimal) adds gravity compensation and a time-to-go optimality → the flattest,
            longest-range endgame; the pick for lofted BVR shots.</li>
          </ul>
        </li>
        <li><b>Command-to-LOS / beam-riding (CLOS)</b> — not homing at all: a ground station (or the
        missile) keeps it on the straight launcher→target line. Simple and cheap, used by short-range
        command-guided <a data-goto="sam">SAMs</a> (Tor), but it demands ever-tightening corrections as
        range closes and can't lead a crossing target well.</li>
      </ul>
      <p class="tip">Play with <b>N</b> in the <a data-goto="guidance">PN sandbox</a> and feel the trade:
      higher N nulls the LOS rotation sooner (leads harder) but amplifies seeker noise into the command.
      The sim lets you fly all of PN / APN / OGL / CLOS on any missile — swap the guidance law and watch
      the trajectory and G-load change.</p>`,
  },
  {
    id: 'midcourse', title: 'Midcourse, Datalink & the PIP',
    html: `
      <p>A BVR missile's own radar is small — it sees the target only in the last ~20 km. Until then
      it flies <b>midcourse</b>, and the phase badge on the map shows you which kind:</p>
      <ul>
        <li><b>MIDCOURSE — DATALINK</b> — your radar tracks the target; updates flow to the missile.
        It steers toward a continuously-refreshed <b>Predicted Intercept Point</b> (PIP): the spot
        where target and missile paths will meet, given the time-to-go.</li>
        <li><b>MIDCOURSE — INS</b> — the datalink dropped (you turned too far, flew out of link
        range, or died). The missile extrapolates the last track inertially. It still flies smartly —
        but it can't see the target <i>maneuver</i>, so a defender who turns after link-break opens
        miss distance fast.</li>
        <li><b>TERMINAL</b> — its own seeker is locked and homing. If lock breaks (notch, chaff,
        gimbal), a datalink weapon falls back to INS and <i>re-acquires</i> — track loss degrades,
        it doesn't kill, the shot.</li>
        <li><b>INERTIAL</b> — an IR fire-and-forget weapon that hasn't acquired: truly blind.</li>
      </ul>
      <p><b>Shooter support matters.</b> After launch you choose: <b>Straight</b> (press in — best
      guidance, most exposure), <b>Crank</b> (hold the target at the gimbal edge — open range while
      still guiding), or <b>Turn cold</b> (drop the link immediately — the missile flies INS and the
      kill probability drops; the classic mistake case). Compare all three and watch the miss
      distance move.</p>
      <p><b>SARH</b> (Sparrow, R-27R, big legacy SAMs) is the harsh version: the missile homes on
      your radar's <i>reflection</i>, so you must illuminate to impact — no crank, no cold.</p>`,
  },
  {
    id: 'loft', title: 'Energy & the Loft',
    html: `
      <p>After burnout a missile is a glider spending a fixed energy budget (kinetic + potential).
      Every second in dense air and every degree of turn spends it. Long-range shots live or die on
      energy management, and the tool for it is the <b>loft</b>:</p>
      <ol>
        <li><b>Climb</b> — pitch up 15–40° and buy altitude while the motor burns.</li>
        <li><b>Cruise</b> — coast near apogee where air density (and drag ∝ ρV²) is a tenth of
        sea-level. This is where the range comes from.</li>
        <li><b>Dive</b> — nose over onto the PIP, trading the altitude back into speed for the
        endgame, arriving fast just as the seeker goes pitbull.</li>
      </ol>
      <p>Watch the <b>elevation profile</b> under the map: an AIM-120D fired at 130 km arcs over
      20+ km high; an R-37M or 40N6 over 30 km. A vertically-launched SAM shows the same shape plus
      the <b>pitch-over</b> right off the rail — thrust-borne steering tips it from vertical onto
      the climb profile (that's jet-vane/TVC physics: lateral force = T·sin α when the fins have no
      dynamic pressure to work with yet).</p>
      <p>The sim's loft is governed by three template numbers: <b>Loft gain</b> (how aggressively it
      climbs — 0 disables), <b>Loft ceiling</b> (apogee cap — above it the air is too thin to hold
      the profile), and the guidance gate (datalink + APN/OGL only). The apogee is sized from the
      shot range: short shots barely rise, max-range shots use the full ceiling.</p>
      <p class="tip">The Mach chart tells the whole story: boost spike → cruise decay → dive
      re-acceleration → the number that matters: <b>Mach at the merge</b>. A missile arriving below
      ~Mach 1.5 can't out-turn anyone. This is why the best defence is often simply making the shot
      longer.</p>`,
  },
  {
    id: 'propulsion', title: 'Propulsion — Boost-Sustain, Dual-Pulse, Ramjet',
    html: `
      <p>Three motor architectures dominate, and Aegis-Sim models each with real physics — mass
      leaves the airframe as propellant burns, the CG shifts, the inertia tensor shrinks, and thrust
      gets the altitude bonus (F = F<sub>curve</sub> + (P₀−P<sub>amb</sub>)·A<sub>exit</sub>):</p>
      <ul>
        <li><b>Solid boost-sustain</b> (AMRAAM, R-77, most SAMs) — one grain cast in two geometries:
        a violent boost (2–5 s) to fighting speed, then a lower sustain to stretch the burn. Simple,
        but after burnout the missile is a glider with a public burnout time — defenders count on
        it.</li>
        <li><b>Dual-pulse solid</b> (PL-15, AIM-260, Barak-8, I-Derby ER) — two separately-ignited
        grains in one case. Pulse 1 boosts; the missile cruises; pulse 2 lights near the endgame and
        <b>restores Mach right when the terminal fight starts</b>. In the log you'll see
        “Pulse 2 ignition @ 2.6 Mach” and the Mach chart jump back above 4. The no-escape zone grows
        enormously because the defender can no longer out-wait the motor.</li>
        <li><b>Ramjet / ducted rocket</b> (Meteor, PL-21) — an air-breathing sustainer: the oxidizer
        is the atmosphere, so specific impulse is 3–4× any solid, and a <b>throttle</b> manages fuel
        to hold cruise Mach. Thrust scales with captured airflow (∝ ρ·V): it needs a booster to reach
        ~Mach 1.7 to light, and flames out for good if it ever decelerates below that. The result is
        the Meteor's signature: <b>still under power at the merge</b>, with the largest no-escape
        zone of any AAM.</li>
      </ul>
      <h3>Watch the three race</h3>
      <p>The same 80-second shot, three motor architectures — watch who still has Mach when the
      endgame band arrives:</p>
      <div class="wx" data-widget="motorrace"></div>
      <p>Every number is editable in the Forge: thrusts, burn times, grain masses, Isp, pulse-2
      ignition time, ramjet fuel/cruise-Mach/flame-out limit. The library's motors are built
      impulse-consistent: thrust-curve area = propellant × Isp × g₀, and propellant always equals
      launch mass − empty mass. See the cutaways in <a data-goto="motors">Rocket Motors Up Close</a>.</p>`,
  },
  {
    id: 'motors', title: 'Rocket Motors Up Close — Grains, Bulkheads & Intakes',
    html: `
      <p>The thrust curve is the <i>result</i>; the <b>grain geometry</b> inside the motor tube is the
      cause. Step through the cutaways and see how the hardware makes each energy profile:</p>
      <div class="wx" data-widget="motorx"></div>
      <ul>
        <li><b>Single-grain</b> — one charge, one burn. The grain's internal bore shape (star, cylinder)
        sets whether thrust is flat, rising or falling as the burning surface area changes. Cheap; all
        energy spent early.</li>
        <li><b>Boost-sustain</b> — one grain cast with two burning geometries: a thin fast-burning web
        for the <b>boost</b>, then a thick slow section for the <b>sustain</b>. One nozzle, one ignition,
        two thrust levels — the elegant workhorse.</li>
        <li><b>Dual-pulse</b> — two separate grains split by an insulating <b>bulkhead</b>, each with its
        own <b>igniter</b>. The gas of pulse 1 can't reach grain 2, so the missile can coast for tens of
        seconds and then <b>relight pulse 2 on command</b> near the endgame. The engineering challenge is
        the bulkhead surviving pulse 1's heat; the payoff is energy exactly when the terminal fight
        starts.</li>
        <li><b>Ramjet / ducted rocket</b> — a solid <b>booster</b> (often inside the combustor itself)
        accelerates it to ~Mach 2, then air scooped through <b>intakes</b> mixes with fuel-rich gas from
        a gas generator and burns in the ramjet <b>combustor</b>. No onboard oxidiser → 3–4× the specific
        impulse of a rocket. Crucially the <b>throttle manages energy</b>: in midcourse it holds a
        fuel-efficient <b>economy cruise</b> (~Mach 2.8, idling whenever it's already faster to save
        fuel), then <b>throttles up in the terminal phase</b> (~Mach 3.5) to arrive fast at the merge.
        That "cruise low, sprint late" schedule — not a giant absolute range — is what gives Meteor its
        enormous no-escape zone (still under power at the merge). The cost: it only works supersonic and
        flames out for good if it decelerates below its minimum Mach.</li>
      </ul>
      <p class="tip">Fire a PL-15 (dual-pulse) and a Meteor (ramjet) in the sim and find the second
      hump / the sustained plateau on the Mach chart — the hardware in these cutaways, made real.</p>`,
  },
  {
    id: 'fuzing', title: 'Warheads & Fuzing — How the Kill Actually Happens',
    html: `
      <p>The seeker gets the missile close; the fuze and warhead finish the job. "Close" is the key
      word — direct body-to-body hits are rare at closing speeds of 1–2 km/s.</p>
      <ul>
        <li><b>Proximity fuzes</b> — a small RF or laser ranging system around the missile's waist
        detects the target sweeping past and fires the warhead at the optimum instant. The whole
        detonation decision happens in <b>milliseconds</b>: at Mach 4 closure the target crosses the
        lethal envelope in under 1/100th of a second.</li>
        <li><b>Blast-fragmentation</b> — a steel case pre-scored into thousands of fragments, thrown
        in an expanding ring at 2+ km/s. Lethal radius ~8–20 m for AAMs, more for big SAMs. This is
        what the sim's <b>lethal radius</b> slider represents: closest approach inside it = the frag
        cone got you.</li>
        <li><b>Continuous-rod</b> — welded steel rods that expand into a cutting hoop; classic on
        older SAMs (the ring that slices wings off).</li>
        <li><b>Hit-to-kill</b> — no warhead at all: pure kinetic impact (PAC-3, some 9M96 modes).
        Needed against ballistic warheads where fragments aren't enough — and demanding agility of
        60 g class at the endgame, which is why PAC-3/9M96 carry attitude thrusters.</li>
        <li><b>Fuze-warhead matching</b> — the fuze must aim the frag pattern <i>ahead</i> along the
        crossing geometry; a last-ditch break works partly by ruining that computation: even a
        technically-in-range detonation can throw its fragments where you were going to be, not where
        you are. That's why misses of a few metres still sometimes spare the target — and why the
        sim's stochastic seeker + closest-approach model produces the same nail-biters.</li>
      </ul>
      <p class="tip">Doctrine note: a missile that misses by 30 m produced a <b>defeat</b>, not a
      malfunction. Almost every "missile defeated" story is geometry + energy + fuzing conspiring —
      exactly the three things every defensive move in this academy attacks.</p>`,
  },
  {
    id: 'battery', title: 'Batteries, Flight Time & Hard Limits',
    html: `
      <p>Missiles don't fly until they feel like stopping — three hard limits end every flight, and
      the sim models all of them:</p>
      <ul>
        <li><b>Thermal battery</b> — a one-shot chemical battery powers the seeker, guidance computer
        and fin actuators. When it dies, the fins freeze and the round goes ballistic mid-flight —
        the log prints “Battery expired — missile ballistic”. Open sources put WVR batteries at
        ~40–60 s, medium BVR ~100 s, long-range BVR several minutes, and big SAMs hundreds of seconds
        (the 40N6's must last ~10 minutes to reach 380 km). Editable per missile in the Forge.</li>
        <li><b>Energy death</b> — a coasting missile that drops subsonic can no longer pull
        meaningful G; the sim declares LOST_ENERGY. This — not the brochure — is what actually caps
        range against a running target.</li>
        <li><b>Structural Mach limit</b> — skin heating caps top speed. Because the cap is in
        <b>Mach</b>, the same missile tops out at different true airspeeds at different altitudes:
        max speed genuinely varies with the atmosphere, on top of the thrust-vs-drag balance that
        sets it in the first place.</li>
      </ul>
      <p class="tip">Watch a max-range shot's log: motor burnout in the first seconds, then a
      minutes-long unpowered glide managed entirely by the loft — the battery quietly ticking away
      the whole time. Long-range missiles are mostly <i>gliders with excellent brains</i>.</p>`,
  },
  {
    id: 'seeker', title: 'Seekers & Sensors',
    html: `
      <p>The seeker is the missile's eye; its physics decide the pitbull range and what fools it:</p>
      <ul>
        <li><b>Active radar (ARH)</b> — own transmitter, fully autonomous once active. The two-way
        signal falls as 1/R⁴, so acquisition is ~15–30 km against a fighter — and scales with target
        <b>RCS</b>: a 0.0001 m² Raptor is seen at a fraction of the range of a 100 m² bomber.
        Vulnerable to <b>chaff</b> and <b>ECM</b> until <b>burn-through</b> range, where the real
        echo overpowers the jamming.</li>
        <li><b>Semi-active (SARH)</b> — homes on the shooter's reflected illumination (one-way-ish
        R² advantage → longer acquisition), but the shooter is chained to the intercept.</li>
        <li><b>Infrared (IR)</b> — passive heat homing. Silent (no RWR warning!) but short-ranged,
        needs lock before launch, and chases <b>flares</b>.</li>
        <li><b>Imaging IR (IIR)</b> — a thermal camera that recognises target <i>shape</i>: rejects
        point-source flares (much lower break-lock probability), tracks crisply.</li>
      </ul>
      <p>Modelled per seeker (all in the Forge): <b>acquisition range</b> (sets pitbull),
      <b>gimbal limit</b> (look-angle before track physically breaks — this is what the notch
      exploits when combined with Doppler), <b>FOV</b>, <b>track bandwidth</b> (agile tracking vs
      noise), <b>angle noise</b> (why terminal G wiggles and misses cluster at a few metres),
      <b>jam susceptibility</b>, <b>burn-through range</b>, and <b>frequency band</b>.</p>`,
  },
  {
    id: 'seekertrack', title: 'Seeker Tracking Logic — The Gimbal Loop & IR Scan Types',
    html: `
      <p>A seeker's job is to keep its eye on the target and hand the guidance computer a clean
      <b>line-of-sight rate</b>. How it does that — and where it fails — is pure, teachable mechanism.</p>
      <h3>The gimbal tracking loop</h3>
      <p>The seeker head is mounted on a gimbal. Watch it slew to hold a moving target, and push the
      target past the gimbal limit to break the track:</p>
      <div class="wx" data-widget="seekerloop"></div>
      <ul>
        <li><b>Measure</b> — where is the target relative to the head's boresight? That angle is the
        <b>boresight error</b>.</li>
        <li><b>Null</b> — drive the gimbal to zero that error, so the head stays pointed at the target.
        (Track bandwidth sets how fast it can chase an agile target.)</li>
        <li><b>Feed guidance</b> — the residual <a data-goto="guidancelaws">line-of-sight rate</a> the head
        measures is exactly what <b>proportional navigation</b> consumes.</li>
        <li><b>The failure</b> — the head can only look so far off the missile's nose (the <b>gimbal
        limit</b>). Drive the LOS rate high enough — a hard <a data-goto="defence">beam/notch</a> or a
        crossing at short range — and the loop can't keep the head on the target: track breaks. This is
        the physical basis of the notch and the last-ditch break.</li>
      </ul>
      <h3>IR seeker generations — the flare-rejection ladder</h3>
      <p>Infrared seekers evolved through four scan philosophies, each rejecting flares better. Step
      through them:</p>
      <div class="wx" data-widget="irscan"></div>
      <p>The march from <b>spin-scan</b> (brightest wins → easily flared) through con-scan and rosette to
      an <b>imaging focal-plane array</b> (sees the target's shape) is exactly the <code>ir → iir</code>
      jump in this sim's seeker models, and why modern <a data-goto="cm">countermeasures</a> need
      pre-emptive programs, kinematics and DIRCM, not just hot flares.</p>`,
  },
  {
    id: 'ew', title: 'Jamming — The Full Taxonomy',
    html: `
      <p>Electronic attack is a zoo, but every animal in it does one of two things: <b>drown</b> the
      radar in noise, or <b>lie</b> to it coherently. Learn the split and the whole field organises
      itself.</p>
      <h3>1 · Noise jamming — drowning the receiver</h3>
      <ul>
        <li><b>Spot noise</b> — all jammer power concentrated on the victim's exact frequency.
        Efficient, but the radar hops frequency and you must follow.</li>
        <li><b>Barrage noise</b> — power smeared across a whole band: hits everything, but diluted —
        every MHz of coverage costs you J/S.</li>
        <li><b>Swept noise</b> — a powerful spot swept rapidly through the band; a compromise that
        also strobes receivers.</li>
      </ul>
      <p>Noise denies <b>range</b> (the strobe still gives bearing!). It lives or dies on the
      <b>J/S ratio</b>: your echo makes a two-way R⁴ trip while jamming travels one-way R². Play with
      it — find the burn-through range where the physics stops protecting you:</p>
      <div class="wx" data-widget="jammer"></div>
      <h3>2 · Deception jamming — lying coherently (DRFM)</h3>
      <p>A <b>Digital RF Memory</b> records the radar's own pulse and replays it, perfectly coherent,
      with chosen delay and Doppler. That enables the classic gate-stealers:</p>
      <ul>
        <li><b>RGPO</b> (range-gate pull-off) — echo the pulse with growing delay: the radar's range
        gate walks off the real target, then the jammer switches off and the radar holds… nothing.</li>
        <li><b>VGPO</b> — the same trick on the velocity (Doppler) gate.</li>
        <li><b>False targets</b> — replay dozens of believable echoes: the scope fills with a
        formation that doesn't exist; track-while-scan chokes on phantoms.</li>
        <li><b>Angle deception</b> — cross-eye (two coherent transmitters warping the apparent
        wavefront) and terrain-bounce attack the monopulse angle measurement itself — the hardest
        gates to steal, and the crown jewels of a modern SPJ.</li>
      </ul>
      <h3>3 · Who carries it — the jamming order of battle</h3>
      <ul>
        <li><b>SPJ</b> — self-protection jammer aboard the fighter: last-ditch RGPO/noise for the
        endgame.</li>
        <li><b>Escort / stand-in</b> — a dedicated EW aircraft (Growler-class) inside or near the
        strike, with power and antennas a fighter can't carry.</li>
        <li><b>Stand-off (SOJ)</b> — jamming from outside the SAM's reach; safe, but geometry-limited
        (it only masks along its own bearing).</li>
        <li><b>Towed decoys</b> — an emitter dragged 100 m behind the jet: seduces the terminal shot
        into cutting the cable instead of the cockpit.</li>
        <li><b>Expendable active decoys</b> (MALD-class) — cruise-shaped drones that fly ahead
        radiating fighter-sized echoes: the IADS wastes missiles and radiates its positions on
        phantoms.</li>
      </ul>
      <h3>4 · The counters (ECCM) — why jamming is a duel, not a cheat code</h3>
      <ul>
        <li><b>Home-on-jam</b> — the missile guides passively on the jamming strobe itself. Jam too
        long, too loud, inside burn-through, and you built it a lighthouse. (AMRAAM-class weapons
        have carried HOJ for decades.)</li>
        <li><b>Frequency agility & LPI</b> — AESAs hop, spread and shape their waveforms so DRFMs
        struggle to latch and RWRs struggle to even notice the radar.</li>
        <li><b>Monopulse + guard channels</b> — reject amplitude tricks and off-axis phantoms.</li>
        <li><b>Netted sensors</b> — two radars triangulate through noise that blinds either alone;
        an IRST ignores the whole RF circus.</li>
      </ul>
      <p class="tip">In the sim: ECM raises the seeker's break-lock probability until
      <b>burn-through</b> range (editable per seeker), and a jam-degraded track means wilder guidance
      noise — script ECM in ④ Red Forces and watch the terminal G-trace roughen exactly the way the
      physics says it should.</p>`,
  },
  {
    id: 'cm', title: 'Countermeasures — Chaff, Flares, Decoys & the Physics of Fooling',
    html: `
      <p>Expendables are cheap physics tricks aimed at a seeker's assumptions. Knowing the physics
      tells you exactly when each works — and when it's just fireworks.</p>
      <h3>Chaff — a radar target you can dispense</h3>
      <ul>
        <li>Thousands of aluminised glass fibres cut to <b>λ/2</b> of the threat band — each a
        resonant dipole. A single bundle blooms into a fighter-sized radar return in ~1 second.</li>
        <li>The catch: chaff <b>decelerates instantly</b> to wind speed. A pulse-Doppler radar sorts
        by velocity — a 400 m/s jet and a hovering chaff cloud separate in one scan. Head-on chaff
        is nearly useless against a modern seeker.</li>
        <li>The fix is geometry: dispense <b>in the notch</b>. Beaming, your radial velocity is ~0 —
        the same bin as the chaff. Now the seeker has two zero-Doppler blobs and one keeps flying
        away. That chaff-notch marriage is the standard radar-missile defeat, and the sim's
        Tactical Brief will show you the survival numbers behind it.</li>
      </ul>
      <h3>Flares — a hotter sun, briefly</h3>
      <ul>
        <li>Magnesium/MTV pyrotechnics burning hotter than your plume in MWIR. Old spin-scan seekers
        chase the brightest thing in the reticle: flare wins.</li>
        <li>Modern rejection is threefold: <b>spectral</b> (flares burn hotter/differently across
        bands — two-colour seekers ratio them out), <b>kinematic</b> (flares decelerate and fall —
        real jets don't), and <b>spatial</b> (imaging seekers see a point-source fireball next to a
        jet-shaped object and never blink). Hence IIR's tiny break-lock probability in the sim.</li>
        <li>What still works: <b>pre-emptive programs</b> (flares already burning as the seeker tries
        to lock deny the clean acquisition), tight <b>dispense-plus-break</b> timing, kinematic
        defeat, and <b>DIRCM</b> — a turreted laser that dazzles the seeker head directly (transports
        and helicopters today, fighters next).</li>
      </ul>
      <h3>Try it — the flare fight</h3>
      <p>You have 8 flares and one inbound heat-seeker. Time your pairs; then swap the threat to
      imaging-IR and feel a generation of technology delete your countermeasure:</p>
      <div class="wx" data-widget="flarefight"></div>
      <h3>The rest of the kit</h3>
      <ul>
        <li><b>Towed RF decoys</b> — the missile's endgame chooses between two coherent emitters;
        properly tuned, it takes the one on the cable.</li>
        <li><b>MALD / air-launched decoys</b> — pre-formation phantoms that make the IADS radiate and
        shoot at nothing (see Jamming §3).</li>
        <li><b>The pairing rule</b> — expendables buy <i>seconds and doubt</i>, never safety alone:
        chaff without the notch, or flares without the break, just decorate your shoot-down. Every
        canned defence in ④ Red Forces pairs a maneuver with the matching expendable for exactly this
        reason.</li>
      </ul>`,
  },
  {
    id: 'defence', title: 'Aspect Defeat — The NATO Defensive Playbook',
    html: `
      <p>Defeating a shot is, at its core, <b>denying the missile the geometry and energy it needs</b>.
      NATO doctrine sorts the tools into a rough menu — the <b>aspect-defeat</b> family (change what
      you present to his radar and to his missile) plus energy and last-ditch options. Everything here
      is scriptable in ④ Red Forces; reactions chain on triggers (time, range, or time-to-impact):</p>
      <p><b>The kinematic idea first:</b> a missile arrives with a finite energy budget. Every move
      below either <b>makes it spend more</b> (turn it, drag it into thick air, make it chase) or
      <b>hides you from its brain</b> (notch its radar, decoy its seeker). Do both and even a good
      shot goes stupid.</p>
      <ul>
        <li><b>Abort / Go cold (drag)</b> — turn until the threat is dead astern (0° aspect) and
        run. Denies your closure, so the missile must cross the whole gap on its own energy. Outside
        MAR it defeats the shot outright; inside MAR you're committed to the endgame. Set the turn G
        or a fixed rate in °/s.</li>
        <li><b>Notch (beam)</b> — put the threat radar on your 3/9 line so your closing velocity ≈ 0.
        Pulse-Doppler radars reject near-zero-Doppler returns as ground clutter — you vanish into the
        filter. Pair with <b>chaff</b>: while the radar hunts in the notch, chaff blooms look
        exactly like you.</li>
        <li><b>Break turn</b> — maximum-G turn to spike the line-of-sight rate at the worst moment.
        Late and hard: at TTI 3–5 s a 8–9 g break forces a terminal G duel the missile may lose if
        it arrived slow.</li>
        <li><b>Break → rollout heading</b> — a break that steadies on a chosen escape course: your
        cold vector, defined by heading.</li>
        <li><b>Dive to the deck</b> — drag the missile into thick air where its drag (∝ ρV²) is
        brutal, and add ground-clutter problems for look-down shots.</li>
        <li><b>Extend / Climb / Weave / Jink / Split-S / Immelmann / Barrel roll</b> — energy
        management and prediction-defeat tools; jink is the unpredictable last-ditch.</li>
        <li><b>Expendables</b> — <b>flares</b> vs IR (weak vs imaging-IR), <b>chaff</b> vs radar
        (best while notching), <b>ECM</b> vs radar until burn-through.</li>
      </ul>
      <h3>The aspect-defeat ladder (NATO framing)</h3>
      <p>Ordered by how much they change the <b>aspect</b> you present:</p>
      <ol>
        <li><b>DRAG / go cold (0° aspect)</b> — turn tail-on and run. Kills closure entirely; the
        purest kinematic defeat. The abort. Works outside MAR.</li>
        <li><b>BEAM / notch (90° aspect)</b> — turn perpendicular so closure ≈ 0 and you fall into
        the radar's Doppler clutter notch. Defeats the <i>sensor</i>, not just the kinematics — deadly
        against radar shots, pair with chaff. (Widget below.)</li>
        <li><b>SLICE / dive</b> — combine a beam/drag with a descent to drag the missile into dense,
        high-drag air and worsen its look-down clutter problem.</li>
        <li><b>LAST-DITCH BREAK</b> — when committed, a late max-G break at TTI 3–5 s spikes the
        line-of-sight rate and forces a terminal turn the tired missile may not make.</li>
      </ol>
      <h3>See it: the Doppler notch</h3>
      <p>Rotate the target toward the beam and watch its return drop into the radar's clutter-rejection
      notch and vanish:</p>
      <div class="wx" data-widget="notch"></div>
      <p class="tip">Sustained G above ~5.5 bleeds the target's airspeed second by second (the sim
      models it) — a defender who breaks too early arrives at the endgame slow and out of options.
      Timing beats effort. And note the counters: a look-<b>down</b> shooter separates you from ground
      clutter, so the notch is far less reliable when he's above you.</p>`,
  },
  {
    id: 'mar', title: 'MAR, No-Escape Zone & Recommit — the Tactical-AI',
    html: `
      <p>The numbers that actually decide BVR engagements:</p>
      <ul>
        <li><b>MAR — Minimum Abort Range</b> — the launch range below which turning cold and running
        <i>no longer works</i>. Fired outside MAR, an immediate abort makes the missile chase you to
        energy death. Fired inside it, the missile arrives with energy to spare no matter what you
        do: you are in the <b>No-Escape Zone (NEZ)</b>.</li>
        <li><b>Recommit</b> — after a successful abort, the moment the threat missile goes
        energy-dead. Turn back in earlier and you re-enter its reach; later and you've given the
        bandit free miles.</li>
      </ul>
      <p>These are not fixed numbers — they swing wildly with <b>altitude</b> (thin air can double a
      missile's reach: MAR at 12 km altitude can be 2–3× MAR at 3 km), with target aspect, and with
      the specific weapon. That's why the <b>◈ TACTICAL-AI → TACTICAL BRIEF</b> tab computes them
      <i>for your exact scenario</i>: it flies dozens of full 6-DOF engagements, bisecting the abort
      range to the survival boundary at each altitude band, timing the recommit from the missile's
      actual energy death, and scoring every committed-defence option (notch+chaff, break, drag…)
      across seeker-noise seeds.</p>
      <p>The output reads like a flight brief: <i>“At 9 km: abort by 40 km. Recommit ≈140 s after
      launch. If committed, notch+chaff survives 60%.”</i> Change the missile or the altitude and
      the brief changes with the physics.</p>
      <h3>See it: the decision-band ruler</h3>
      <p>Set Rmax and MAR (read them off the Tactical-AI brief for your weapon), then drag the
      <b>shot range</b> marker and read the verdict — SAFE, ABORT, or NO-ESCAPE:</p>
      <div class="wx" data-widget="marband"></div>
      <p class="tip">Rule-of-thumb doctrine the sim reproduces: NEZ ≈ 30–50% of max kinematic range;
      MAR grows with your altitude <i>and</i> the shooter's; going low before the merge shrinks the
      threat's reach but costs you your own missile's reach identically. The one instinct to build:
      <b>know your MAR before the merge and honor it</b> — most BVR deaths are late aborts. Next: <a data-goto="brevity">the timeline &amp; brevity</a> that turns MAR into a radio call, and <a data-goto="defence">aspect defeat</a> for when you're committed.</p>`,
  },
  {
    id: 'brevity', title: 'The BVR Timeline & Brevity — Skate, Banzai, Fox Three',
    html: `
      <p>Real BVR is flown as a <b>timeline</b>: a sequence of pre-briefed decision ranges, each with
      a one-word name so four aircraft can fight as one brain on a crowded radio. The vocabulary:</p>
      <h3>The game plans (briefed before anyone takes off)</h3>
      <ul>
        <li><b>SKATE</b> — launch-and-leave: shoot at range, be cold (out) at or before MAR. Pure
        attrition; you never enter the threat's NEZ. The default against a peer with long sticks.</li>
        <li><b>SHORT SKATE</b> — press a step closer (better Pk, tighter A-pole) but still out before
        the threat's follow-on shot matters.</li>
        <li><b>BANZAI</b> — accept the merge: press through MAR to the visual arena. Chosen when you
        must (protecting an asset, denying a lane) or when you believe the WVR exchange favours you.
        With HOBS on both sides, it rarely favours anyone.</li>
      </ul>
      <h3>Watch it unfold</h3>
      <p>Scrub the range (or hit play) and walk the whole engagement from commit to merge — each decision range
      is a radio call:</p>
      <div class="wx" data-widget="timeline_play"></div>
      <h3>The decision ranges (in order, inbound)</h3>
      <p><b>Commit range</b> (we're fighting) → <b>sort/targeting</b> (who takes whom — no wasted
      double-shots) → <b>shot range</b> (Rmax… but disciplined shooters wait for R<sub>pi</sub>, the
      probability-of-intercept range) → <b>DR / decision range</b> (last moment the briefed plan can
      still be executed) → <b>MAR</b> (the abort line — see the ruler) → the merge.</p>
      <h3>The calls you'd hear</h3>
      <ul>
        <li><b>FOX ONE / TWO / THREE</b> — launched SARH / IR / active-radar missile. "Fox three, two
        away" = two ARH shots flying.</li>
        <li><b>PITBULL / HUSKY</b> — your missile's seeker is active (it no longer needs you). In this
        sim: the diamond on the map and the A-pole moment.</li>
        <li><b>CRANK</b> — post-launch gimbal-limit turn (keep guiding, open range). <b>NOTCH</b> —
        defensive beam. <b>PUMP</b> — brief cold turn to reset spacing, then re-commit on plan.
        <b>ABORT / OUT</b> — terminate the intercept, go cold for real.</li>
        <li><b>SPIKE</b> — RWR shows a threat radar locked to you. <b>NAKED</b> — no spikes.
        <b>MUD/SINGER</b> — surface radar/SAM launch. <b>DEFENDING</b> — actively defeating a shot.</li>
        <li><b>GRINDER</b> — the wheel: element A shoots and drags out while element B runs in to
        shoot, then swaps — continuous pressure with nobody ever inside MAR unsupported.</li>
      </ul>
      <p class="tip">Fly a SKATE in the sim: fire at your computed Rmax·0.9, then script the shooter
      support to crank, and the <i>target's</i> timeline to go cold at its own MAR. The Tactical
      Brief's numbers (Rmax, MAR, recommit) are exactly the briefed decision ranges of this section —
      that's the point of them.</p>`,
  },
  {
    id: 'wvr', title: 'The WVR Arena — Energy, Angles & the Merge',
    html: `
      <p>If BVR discipline fails, you arrive at the merge — the visual knife-fight. Different physics
      rules here: turn <b>rate</b>, turn <b>radius</b>, and the energy to keep buying them.</p>
      <h3>Corner velocity — the one number of dogfighting</h3>
      <p>Turn rate ω = g·√(n²−1)/V and radius R = V²/(g·√(n²−1)). Slow down and you can't pull max G
      (lift-limited); speed up and the radius balloons with V². The sweet spot — max G at the lowest
      speed that sustains it — is <b>corner velocity</b>. Sweep it yourself:</p>
      <div class="wx" data-widget="doghouse"></div>
      <h3>The classic fights</h3>
      <ul>
        <li><b>One-circle vs two-circle</b> — turn <i>toward</i> the passing bandit (one circle:
        radius fight, favours the tighter turner and HOBS weapons) or <i>away</i> (two circle: rate
        fight, favours rate and energy). The choice is made in the first second of the merge.</li>
        <li><b>Energy vs angles</b> — the energy fighter keeps speed/altitude and makes the angles
        fighter bleed dry chasing snapshots; the angles fighter bets on getting the nose (or helmet)
        on first. Sustained G above ~5.5 bleeds speed every second — the sim models exactly this
        bleed on the target.</li>
        <li><b>The vertical</b> — trading altitude for turn performance (and back) is the third
        dimension amateurs forget: an Immelmann/Split-S resets a losing geometry using gravity as a
        motor.</li>
      </ul>
      <h3>HOBS changed the arithmetic</h3>
      <p>With helmet-cued 90°+ off-boresight missiles (AIM-9X, R-73, PL-10, IRIS-T) both fighters can
      usually generate a valid shot within seconds of any merge — one-circle fights become mutual-kill
      lotteries. Modern doctrine follows: <b>win BVR, don't donate a merge</b>; if merged, fight for
      the first HOBS shot and deny his (keep him out of your rear hemisphere <i>and</i> his helmet
      off you). Try it: set up a 5 km, 90°-aspect merge in the sim with an AIM-9X vs a flare-dropping,
      jinking target.</p>`,
  },
  {
    id: 'horizon', title: 'Radar Horizon & the LRSAM Blind Spot',
    html: `
      <p>The single most under-appreciated fact in long-range air defence: <b>radar is line-of-sight,
      and the Earth is round.</b> A 400 km missile is worthless against a target its radar can't see,
      and a low flyer hides below the curved-earth horizon until surprisingly close.</p>
      <div class="wx" data-widget="horizon"></div>
      <p>The geometry is simple. The distance from a radar at height h₁ to a target at height h₂ before
      the Earth's bulge blocks line-of-sight is, with the standard 4/3-Earth refraction:</p>
      <p class="eq">horizon (km) ≈ 4.12 · ( √h₁ + √h₂ )&nbsp;&nbsp;&nbsp;(h in metres)</p>
      <ul>
        <li>A <b>ground SAM radar</b> (h₁ ≈ tens of m) sees a jet at 100 m only out to ~30–40 km.
        Your S-400 with a 380 km missile can't shoot what it can't track.</li>
        <li><b>Going low is the counter to LRSAMs and AWACS alike.</b> A low-level ingress collapses a
        monster engagement zone to a knife-fight — the missile's kinematic reach becomes irrelevant.</li>
        <li>The defence's answer is an <b>elevated sensor</b>: an AWACS, aerostat, MALE UAV, fighter,
        or a second radar on high ground, feeding the missile a track over the horizon by datalink
        (the SAM launches on remote cueing and only its own seeker needs line-of-sight at the end).
        This is exactly why modern IADS are <b>networked</b>, not single big radars.</li>
        <li>It cuts both ways: a <b>fighter</b> at altitude sees and is seen far; drop to the deck and
        both your detection range and your missiles' reach shrink together.</li>
      </ul>
      <p class="tip">Terrain masking is the extreme case: fly a valley and even the horizon formula is
      optimistic — the ridge blocks you entirely. This is the whole basis of low-level penetration and
      of why cruise missiles and strike jets hug the ground. This is the heart of <a data-goto="iadsnet">IADS &amp; SEAD</a>.</p>`,
  },
  {
    id: 'iadsnet', title: 'IADS & SEAD — Layered Defence and How It\'s Broken',
    html: `
      <p>No SAM fights alone. An <b>Integrated Air Defence System</b> is a layered, netted organism:
      surveillance radars cue acquisition radars cue engagement radars cue shooters — each layer
      covering another's blind spot. Understand the layers and you understand both sides' playbooks.</p>
      <h3>The layers — and what your altitude does to them</h3>
      <p>Slide your ingress altitude and watch brochure rings collapse to what the radar horizon
      actually permits:</p>
      <div class="wx" data-widget="iads"></div>
      <ul>
        <li><b>EW / surveillance</b> — long-wave, long-range, imprecise: builds the air picture and
        cues everyone (also the layer that sees stealth best).</li>
        <li><b>Long-range SAMs</b> (S-400/HQ-9/Patriot class) — deny altitude over a huge area. Their
        real product isn't kills, it's <b>forcing you low</b>…</li>
        <li><b>…into the medium/short layers</b> — 9M96/NASAMS/Tor/guns — plus terrain, where the
        horizon problem flips: <i>their</i> small radars see fine at knife range, and you're slow to
        react at 100 ft.</li>
        <li><b>The net</b> — datalinked, an elevated sensor (AWACS, aerostat, fighter) can restore
        the big rings against low flyers by cueing over the horizon; shooters can stay silent and
        launch on remote tracks ("engage-on-remote"), so killing one radar no longer blinds the
        missile that's already flying.</li>
      </ul>
      <h3>SEAD / DEAD — the counter-game</h3>
      <ul>
        <li><b>Wild Weasel baiting</b> — provoke the emitter, then kill it with anti-radiation
        missiles (HARM-class) that home on the radar's own transmission. The SAM's dilemma: radiate
        and die, or stay silent and be blind.</li>
        <li><b>Emission discipline & shoot-and-scoot</b> — the SAM's counter: radiate seconds, fire,
        pack up and move before the HARM or the counter-battery arrives. Modern IADS duels are
        measured in emission-seconds.</li>
        <li><b>Decoys & saturation</b> — MALD-class phantoms make the net radiate and waste missiles;
        massed cheap drones/cruise missiles drain interceptors that cost 100× more (the cost-exchange
        war).</li>
        <li><b>Corridor punching</b> — jamming (stand-off + stand-in), terrain, low-level routing and
        timing combine to open a temporary safe lane — the strike flows through, the corridor closes
        behind it.</li>
      </ul>
      <p class="tip">Recreate the core duel in the sim: an S-400 shot vs a striker that ingresses at
      150 m (horizon-limited pickup), pops to release, and beams+chaffs the terminal phase. Then give
      the target 10,000 m altitude and watch the same missile own a 150 km bubble. That contrast IS
      the IADS story.</p>`,
  },
  {
    id: 'modern', title: 'Modern BVR — Stealth, AESA, HOBS & the Kill Chain',
    html: `
      <p>Everything above is the timeless physics. Here's how the modern fight actually looks, and
      where it's going — worth understanding even though the sim models the fundamentals more than the
      classified specifics.</p>
      <ul>
        <li><b>Stealth (VLO) rewrites the range equation.</b> Radar detection scales as the fourth
        root of RCS: a 0.0001 m² target is detected at roughly one-tenth the range of a 1 m² one. In
        the sim, fire an AMRAAM at an F-22 vs an Su-30 at the same range and watch the pitbull range
        collapse — the seeker simply can't acquire until much closer. Stealth doesn't make you
        invisible; it <b>shrinks everyone's timeline</b> and lets you shoot first.</li>
        <li><b>AESA radar</b> — electronically-scanned arrays track many targets, hop frequencies to
        resist jamming, interleave search/track/datalink, and enable <b>LPI</b> (low-probability-of-
        intercept) emissions. The modern seeker (PL-15, AIM-260) is a mini-AESA — harder to notch,
        harder to jam.</li>
        <li><b>HOBS + HMD</b> — High-Off-Boresight missiles cued by a Helmet-Mounted Display let a
        pilot shoot at a target 90° off the nose, even behind the 3/9 line. In the WVR fight this
        turned "point your nose to shoot" into "look to shoot" — try a high off-boresight geometry in
        the sim and watch the missile crank hard off the rail.</li>
        <li><b>The networked kill chain (F2T2EA / A-B-C shooter).</b> The jet that <b>sees</b> the
        target need not be the one that <b>shoots</b> it. An F-35 can pass a track to an F-15 packed
        with missiles, or a ship, which launches without ever emitting — the classic sensor/shooter
        split. The missile flies the datalinked midcourse from whichever platform holds the best
        track. This is why the pole/crank game and the datalink model in this sim matter so much.</li>
        <li><b>Ramjet & dual-pulse motors</b> keep energy to the merge and blow the no-escape zone
        open (see Propulsion) — the current arms race is as much about <b>terminal energy</b> as raw
        Rmax.</li>
        <li><b>The counter-stealth & counter-network fight</b> — IRST (passive infrared search, immune
        to radar stealth and to jamming), low-band and multistatic radars, and home-on-jam seekers all
        exist to claw back the first-shot advantage. Electronic warfare is now a peer of kinematics.</li>
      </ul>
      <p class="tip">The through-line of modern BVR: <b>whoever completes the kill chain first —
      detect, track, launch, guide — usually wins, often before the merge.</b> Stealth, AESA, datalink
      and terminal energy are all ways to finish that chain faster than the other guy, or to break
      his. Everything in this app is a lever on one link of it.</p>
      <h3>Race the kill chain</h3>
      <p>Set both sides' RCS and watch who completes DETECT → TRACK → IDENTIFY → ENGAGE → LAUNCH first.
      Shrink your own signature and you finish the loop before he even sees you:</p>
      <div class="wx" data-widget="killchain"></div>`,
  },
  {
    id: 'sam', title: 'SAM Engagements — Vertical Launch & Up-and-Over',
    html: `
      <p>Switch the engagement type to <b>Surface-to-Air</b> and the planner reworks itself: a ground
      launcher + tracking radar at the origin, an inbound threat placed by range/bearing/altitude,
      and a launch elevation (25° rail shot to 90° vertical cold-launch — both work).</p>
      <p>What the physics does, and what you'll see on the elevation profile:</p>
      <ol>
        <li><b>Boost & pitch-over</b> — off a vertical rail the fins have no airflow to bite; the
        missile vectors on <b>thrust-borne lift</b> (T·sin α — the jet-vane/TVC effect) to tip from
        vertical onto the climb profile within seconds.</li>
        <li><b>Up-and-over midcourse</b> — long-range SAMs (48N6, SM-6, HQ-9) fly exactly the same
        energy loft as a BVR AAM: climb steeply, cruise apogee at 25–35+ km where drag is nothing,
        then dive on the PIP. This — not the motor alone — is how a 48N6 reaches 150+ km and a 40N6
        350+.</li>
        <li><b>Terminal</b> — ARH rounds go pitbull on their own; SARH/TVM rounds ride the ground
        radar's illumination all the way; CLOS point-defenders (Tor) ride the beam itself.</li>
      </ol>
      <p>The defender's counterplay is the same playbook: beam the site's radar, drag off, get low —
      but note the asymmetry: the SAM site never runs out of fuel, only your patience and its
      battery/kinematics.</p>`,
  },
  {
    id: 'aero', title: 'Aerodynamics — Drag, Lift, G, and the Atmosphere in Everything',
    html: `
      <p>Every aero force scales with <b>dynamic pressure q = ½ρV²</b>. Density falls ~10× from sea
      level to 16 km, which is why altitude is a weapon:</p>
      <ul>
        <li><b>Zero-lift drag Cd₀(M)</b> — a subsonic plateau, the <b>transonic spike</b> around
        Mach 1, then a supersonic ease-off. WVR dogfight darts (big canards) carry much more Cd₀
        than slick BVR airframes — the library reflects it.</li>
        <li><b>Induced drag k·C<sub>L</sub>²</b> — turning costs extra drag. Every hard correction
        chasing a jink literally burns range off the missile.</li>
        <li><b>Normal-force slope CNα(M)</b> — lift per radian of angle-of-attack, with the
        Prandtl-Glauert rise near Mach 1 and supersonic taper. Together with q it sets how much G
        the airframe <i>can</i> pull: a slow missile in thin air simply cannot turn, whatever the
        autopilot demands.</li>
        <li><b>G limits</b> — the structural limit (template max-G) AND the aerodynamic limit
        (q·S·CNα·α<sub>max</sub> + thrust-borne lift) both clamp every command. The G-LOAD chart
        shows the <b>achieved</b> G — what an accelerometer on the missile would read from real
        forces at the flown AoA. Raw guidance <i>commands</i> naturally thrash near intercept as
        seeker noise divides by a shrinking time-to-go; the airframe's inertia filters that into the
        smooth achieved trace you see. Both behaviours are physical.</li>
        <li><b>Max-Q & Mach cap</b> — dynamic-pressure and skin-heating structural limits. The Mach
        cap is altitude-dependent by construction (same Mach = different TAS in different air).</li>
      </ul>`,
  },
  {
    id: 'atmos', title: 'The Atmosphere',
    html: `
      <p>Everything above rides on the <b>US Standard Atmosphere 1976</b> — the full 7-layer model
      with exact lapse-rate integration for temperature, pressure, density and speed of sound to
      86 km. Drag ∝ ρ and Mach ∝ 1/a make it the invisible player in every engagement.</p>
      <ul>
        <li><b>USSA-1976</b> — the standard reference day.</li>
        <li><b>Hot day (ISA +20)</b> — thinner air: longer missile reach, weaker turns, higher TAS
        for the same Mach.</li>
        <li><b>Cold day (ISA −20)</b> — denser air: shorter reach, harder turns.</li>
        <li><b>Tropical (ISA +15)</b> — the hot-and-high performance case.</li>
      </ul>
      <p>Press <b>ATMOS</b> to see the profiles. Then fire the same shot on a hot vs cold day and
      watch Rmax move — the atmosphere is a tunable experiment variable here, exactly as in
      professional engagement-modelling tools.</p>`,
  },
  {
    id: 'hitmiss', title: 'Hit or Miss — How Outcomes Are Decided',
    html: `
      <p>Real missiles rarely body-hit; a <b>proximity fuze</b> fires the warhead inside a lethal
      radius. The sim computes the exact <b>closest approach</b> — including the sub-timestep point
      of a Mach-4 fly-through — and scores:</p>
      <ul>
        <li><b>HIT</b> — closest approach inside the lethal radius (③ Conditions slider).</li>
        <li><b>MISS</b> — flew through and opened range; the target out-guessed it.</li>
        <li><b>ENERGY DEPLETED</b> — went subsonic coasting with real range to go: a dead round.
        The usual end of an aborted-against shot.</li>
        <li><b>GROUND / NO INTERCEPT</b> — flew into the earth / ran out the sim clock (extend Max
        time for very long shots — the planner auto-budgets it from the geometry).</li>
      </ul>
      <p>Seeker noise is real, so even clean shots miss by a few metres — that IS homing accuracy.
      A last-second break or a chaff bloom can push closest approach just outside the fuze: the
      target lives by metres, and the charts show you exactly which second decided it.</p>`,
  },
  {
    id: 'params', title: 'Parameter Reference — Every Number in the Forge',
    html: `
      <p>Everything editable, and what it does in the physics. (Hover any field in the app for the
      same explanation in place.)</p>
      <table class="range-table"><thead><tr><th>Parameter</th><th>What it drives</th></tr></thead><tbody>
      <tr><td colspan="2" style="color:var(--blue)">◈ AIRFRAME</td></tr>
      <tr><td>Length / diameter</td><td>Reference area (drag & lift), inertia estimates, fin moment arm.</td></tr>
      <tr><td>Launch / empty mass</td><td>Difference = propellant. Mass, CG and inertia deplete through the burn.</td></tr>
      <tr><td>Max structural G</td><td>Hard clamp on commanded acceleration (with the aero limit).</td></tr>
      <tr><td colspan="2" style="color:var(--blue)">◈ PROPULSION</td></tr>
      <tr><td>Boost/sustain thrust & time</td><td>The thrust curve; pressure-corrected with altitude.</td></tr>
      <tr><td>Propellant mass, Isp</td><td>Mass-flow = F/(Isp·g₀); sets total impulse and burn duration.</td></tr>
      <tr><td>Pulse-2 ignition time</td><td>Dual-pulse: when the endgame grain lights.</td></tr>
      <tr><td>Ramjet thrust/fuel/Isp</td><td>Air-breathing sustainer; thrust ∝ ρ·V, throttled to cruise Mach.</td></tr>
      <tr><td>Ramjet min / cruise Mach</td><td>Flame-out floor; the Mach the throttle loop holds.</td></tr>
      <tr><td colspan="2" style="color:var(--blue)">◈ FLIGHT ENVELOPE & MIDCOURSE</td></tr>
      <tr><td>Battery life</td><td>Seconds of control power. After: fins frozen, ballistic.</td></tr>
      <tr><td>Max Mach</td><td>Structural/thermal cap — altitude-dependent by construction.</td></tr>
      <tr><td>Loft gain</td><td>Midcourse climb aggressiveness. 0 = no loft. Needs datalink + APN/OGL.</td></tr>
      <tr><td>Loft ceiling</td><td>Apogee cap — thin-air control limit.</td></tr>
      <tr><td colspan="2" style="color:var(--blue)">◈ AERODYNAMICS</td></tr>
      <tr><td>Cd₀ sub/transonic/supersonic</td><td>Zero-lift drag curve — coast decay & top speed.</td></tr>
      <tr><td>CNα</td><td>Lift slope — turn capability per degree of AoA.</td></tr>
      <tr><td>Cmα / Cmq</td><td>Static stability (weathercock) / pitch damping.</td></tr>
      <tr><td colspan="2" style="color:var(--blue)">◈ SEEKER</td></tr>
      <tr><td>Acquisition range</td><td>Pitbull range vs the reference target; scales with RCS/IR sig.</td></tr>
      <tr><td>Gimbal limit / FOV</td><td>Look-angle before track breaks / instantaneous cone.</td></tr>
      <tr><td>Track bandwidth</td><td>Agility vs noise of the LOS-rate estimate PN consumes.</td></tr>
      <tr><td>Angle noise</td><td>1-σ measurement noise — the metres of terminal miss.</td></tr>
      <tr><td>Jam susceptibility / burn-through</td><td>CM vulnerability / range where jamming stops working.</td></tr>
      <tr><td colspan="2" style="color:var(--blue)">◈ GUIDANCE & AUTOPILOT</td></tr>
      <tr><td>Law + N</td><td>pn / apn / ogl / clos (see Guidance section) and its gain.</td></tr>
      <tr><td>Fin limit / rate / lag τ</td><td>Actuator realism: deflection cap, slew rate, first-order lag.</td></tr>
      <tr><td colspan="2" style="color:var(--blue)">◈ TARGET (platforms)</td></tr>
      <tr><td>RCS / IR signature</td><td>Radar & IR seeker detection/acquisition scaling.</td></tr>
      <tr><td>Max G, speeds, ceiling</td><td>Evasion performance envelope; >5.5 g sustained bleeds speed.</td></tr>
      <tr><td>Countermeasure fit</td><td>Flare/chaff inventory and ECM fit.</td></tr>
      </tbody></table>`,
  },
  {
    id: 'ranges', title: 'Open-Source Range Datums',
    html: `
      <p><b>Important:</b> real missile performance is classified. These are widely-cited
      <b>open-source estimates</b>; treat them as class datums. "Rmax" here is the head-on,
      high-altitude kinematic maximum against a closing, non-evading target — real employment ranges
      are far shorter, and the <b>no-escape zone</b> is typically 30–50% of Rmax. The library is
      tuned so the simulator lands in these brackets, with the closure caveat.</p>
      <table class="range-table">
        <thead><tr><th>Missile</th><th>Type / motor</th><th>Est. class</th></tr></thead>
        <tbody>
          <tr><td>AIM-9M / AIM-9L</td><td>IR WVR</td><td>~15–18 km</td></tr>
          <tr><td>AIM-9X / IRIS-T / ASRAAM / PL-10 / Python-5</td><td>IIR WVR (TVC)</td><td>~20–35 km</td></tr>
          <tr><td>R-73</td><td>IR WVR (TVC)</td><td>~30 km</td></tr>
          <tr><td>AIM-7M / R-27R</td><td>SARH</td><td>~50–70 km</td></tr>
          <tr><td>R-27ER</td><td>SARH, big motor</td><td>~90–130 km</td></tr>
          <tr><td>AIM-120C-5 / PL-12 / MICA / Derby / Astra</td><td>ARH boost-sustain</td><td>~60–110 km</td></tr>
          <tr><td>R-77 / R-77M</td><td>ARH (dual-pulse M)</td><td>~80–190 km</td></tr>
          <tr><td>AIM-120D</td><td>ARH, lofted</td><td>~130–160 km</td></tr>
          <tr><td>AIM-54C Phoenix</td><td>ARH VLR, high loft</td><td>~130–180 km</td></tr>
          <tr><td>MBDA Meteor</td><td><b>Ramjet</b></td><td>~150–200 km, biggest NEZ</td></tr>
          <tr><td>PL-15 / AIM-260</td><td><b>Dual-pulse</b> ARH</td><td>~200–300 km</td></tr>
          <tr><td>R-37M / PL-21</td><td>VLR (PL-21 ramjet)</td><td>~200–300+ km</td></tr>
          <tr><td>Tor-M2 / ESSM / NASAMS</td><td>SHORAD/point SAM</td><td>~15–50 km</td></tr>
          <tr><td>PAC-3 / 9M96E2 / Aster 30</td><td>Agile hit-to-kill SAM</td><td>~30–120 km</td></tr>
          <tr><td>PAC-2 / SM-2 / HQ-16 / Buk</td><td>Area SAM</td><td>~50–170 km</td></tr>
          <tr><td>48N6 / HQ-9B / SM-6</td><td>Long-range SAM, lofted</td><td>~150–260 km</td></tr>
          <tr><td>40N6 (S-400)</td><td>VLR SAM, active seeker</td><td>~380 km</td></tr>
        </tbody>
      </table>`,
  },
  {
    id: 'emtheory', title: 'Energy-Maneuverability — The Math of the Dogfight',
    html: `
      <p>John Boyd's <b>Energy-Maneuverability (EM) theory</b> is the physics that underpins every
      turning fight and, it turns out, every missile endgame too. One idea rules it: <b>specific
      energy</b> — your total energy per unit weight, height plus speed:</p>
      <p class="eq">E<sub>s</sub> = h + V² / 2g&nbsp;&nbsp;(metres of "energy height")</p>
      <p>You can trade the two freely — dive to gain speed, zoom to gain altitude — but the <i>sum</i>
      only changes through <b>specific excess power</b> P<sub>s</sub> = (T − D)·V / W: thrust minus
      drag, times speed, per weight. Positive P<sub>s</sub> = you're gaining energy; negative = bleeding
      it. Every hard turn spikes induced drag and drives P<sub>s</sub> deeply negative.</p>
      <h3>The turn trade, in your hands</h3>
      <p>Turn rate and radius fight each other, and both bow to energy. Sweep the doghouse:</p>
      <div class="wx" data-widget="doghouse"></div>
      <ul>
        <li><b>Sustained turn</b> — the hardest turn you can hold at constant speed/altitude (P<sub>s</sub>=0).
        An <b>energy fighter</b> (lots of thrust, low drag) has a big sustained-G circle and dictates
        the fight from range.</li>
        <li><b>Instantaneous turn</b> — the hardest turn you can pull for a moment (lift/structural
        limit), bleeding energy fast. An <b>angles fighter</b> bets on getting the nose (or helmet)
        around first before it runs out of energy.</li>
        <li><b>Corner velocity</b> — where those two meet: max turn rate. The knife-fight speed.</li>
      </ul>
      <p class="tip">Why a BVR pilot cares: a missile is an energy fighter with no engine after burnout.
      Its "sustained G" collapses as it coasts — which is the whole basis of <a data-goto="mar">MAR
      and the no-escape zone</a>. Drag it <a data-goto="defence">low and slow</a> and its P<sub>s</sub>
      goes so negative it can't complete the intercept. EM theory <i>is</i> BVR survival, one layer down.</p>`,
  },
  {
    id: 'humanfactors', title: 'The Pilot as a Limit — G, GLOC & Situational Awareness',
    html: `
      <p>The jet can out-perform the human inside it. In the real fight, the <b>pilot</b> is often the
      binding constraint — a fact every tactic quietly respects.</p>
      <ul>
        <li><b>G-tolerance & GLOC.</b> Blood pools away from the brain under positive G. Around
        4–5 G unprotected a pilot greys/blacks out; a <b>G-suit + anti-G straining maneuver</b> buys
        ~9 G for tens of seconds, but a hard, sustained pull risks <b>G-induced Loss Of Consciousness
        (GLOC)</b> — seconds of incapacitation that are frequently fatal at low altitude. This is why
        "the jet can pull 9 G" doesn't mean the pilot can hold it indefinitely.</li>
        <li><b>Onset rate matters.</b> A snatch to high G (rapid onset) is far more dangerous than a
        smooth build — the body can't pre-compensate. Missile last-ditch breaks exploit this: they
        force the <i>defender</i> to a hard, fast pull too.</li>
        <li><b>Task saturation.</b> A pilot fighting the jet, the radar, the radio, the RWR and the
        formation has finite attention. Good tactics (and datalink automation) exist to <b>reduce
        cockpit workload</b> so decisions like "abort at MAR" happen on time, not late.</li>
        <li><b>Situational Awareness (SA).</b> The pilot who has the better picture — who's where,
        who's committed, who's defensive — usually wins before a shot flies. Losing SA (a "furball",
        a missed radio call) is how good pilots die. Networked sensors exist to <b>build and share
        SA</b>, the real currency of air combat.</li>
        <li><b>Fatigue, spatial disorientation, hypoxia</b> — the quiet killers. More aircrew have
        been lost to disorientation and physiology than to enemy missiles in peacetime.</li>
      </ul>
      <p class="tip">Design takeaway echoed across this app: automation (datalink midcourse, the
      <a data-goto="mar">Tactical-AI kneeboard</a>, HOBS cueing) mostly buys back <b>human bandwidth</b>
      so the crew can spend attention where it decides the fight.</p>`,
  },
  {
    id: 'weather', title: 'Weather, Environment & the Day',
    html: `
      <p>The same shot on a different day is a different shot. The environment quietly moves every
      number in this sim.</p>
      <ul>
        <li><b>Air density (the big one).</b> Drag and lift both scale with ρ. A <a data-goto="atmos">hot
        or high day</a> means thinner air: less drag (missiles reach farther) but less lift (everything
        turns worse), and less thrust. A cold, dense day is the opposite. Fire the same AMRAAM on a
        Hot (ISA +20) vs Cold (ISA −20) day and watch Rmax move.</li>
        <li><b>Temperature & the speed of sound.</b> Mach = V/a, and a = √(γRT). Colder air → lower
        speed of sound → the same true airspeed is a higher Mach (closer to the transonic drag spike
        and the structural cap). Altitude and temperature together decide where the drag hump sits.</li>
        <li><b>Cloud, haze & humidity — brutal on IR.</b> Radar punches through weather; <a data-goto="ir101">IR
        and IRST</a> do not. Moisture and cloud can cut IR detection ranges by more than half. "IR is
        a fair-weather sensor" is a real planning factor — high and dry favours the heat-seeker.</li>
        <li><b>Rain & the radar.</b> Heavy precipitation adds clutter and attenuation, degrading radar
        range and helping a low, notching target hide.</li>
        <li><b>Sun & background.</b> An IR seeker can be decoyed toward the sun or lose a target against
        a hot desert or cold sky — background contrast is everything for heat homing.</li>
        <li><b>Wind & the deck.</b> Down low, terrain and wind shape both the radar-horizon fight and
        the energy fight; a tailwind on egress is free range home.</li>
      </ul>
      <p class="tip">In the sim, the <b>Atmosphere</b> selector (Standard / Hot / Cold / Tropical) is
      your weather knob — the cleanest one-variable experiment in the whole tool.</p>`,
  },
  {
    id: 'rwr', title: 'RWR & Threat Awareness — What the Defender Sees',
    html: `
      <p>Half of surviving BVR is <i>knowing you're being shot at</i>. The <b>Radar Warning Receiver
      (RWR)</b> is the defender's ears — and its limits shape every tactic.</p>
      <ul>
        <li><b>What the RWR hears.</b> It detects and classifies emitters by their signals: a search
        radar sweeping past (a soft, periodic hit), a <b>lock / STT</b> (a steady, insistent tone —
        "SPIKE"), a <b>launch</b> (some missiles/illuminators change signature — "LAUNCH / SINGER").
        It shows bearing and a guess at type, not range.</li>
        <li><b>The gaps that get pilots killed.</b> A <b>TWS</b> track-while-scan shot gives little or
        no distinct warning — the first cue can be the missile's own seeker going active ("pitbull")
        seconds from impact. A <b>fully passive IR shot</b> (Sidewinder, IIR) gives <b>no RWR warning
        at all</b>. "NAKED" (no spikes) never means "no threat".</li>
        <li><b>Emitter discipline cuts both ways.</b> Your own radar in STT screams on the bandit's
        RWR and tells him exactly who's locked. Modern doctrine favours <b>TWS + LPI</b> emissions and
        third-party (silent) targeting so the first warning the enemy gets is the missile.</li>
        <li><b>Missile Approach Warning (MAWS).</b> Some jets add UV/IR or radar sensors that detect
        the missile <i>plume or body</i> directly — the last-ditch cue that triggers automatic flares
        and the break, independent of the RWR.</li>
        <li><b>Reading the tone.</b> A trained pilot reacts to the <i>change</i>: search→lock means
        commit against you; lock→launch means it's time to defend at <a data-goto="mar">MAR</a>. The
        Tactical-AI's decision table is essentially "what your RWR tone should trigger, by range".</li>
      </ul>`,
  },
  {
    id: 'formations', title: 'Formations & Roles — Fighting as a Team',
    html: `
      <p>Fighters fight in pairs and fours, not alone. The <b>formation</b> is a machine for building
      SA, covering blind spots, and stacking shots — 1+1 in air combat is far more than 2.</p>
      <ul>
        <li><b>The element (2-ship)</b> — the atomic unit: a <b>lead</b> who fights and a <b>wingman</b>
        who supports (radar coverage, mutual defence, the second shot). "Lose sight, lose the fight"
        — formations exist so someone always has eyes/sensors on the threat.</li>
        <li><b>The wall</b> — fighters line-abreast, radars overlapping: maximum forward detection and
        simultaneous shots across a front. The classic offensive BVR picture.</li>
        <li><b>Ladder / champagne</b> — staggered in range/altitude so shooters and supporters trade
        roles: the front presents shots while the back stays cold, then they swap (the <b>grinder</b>).</li>
        <li><b>Sort & targeting</b> — the discipline of deciding <i>who shoots whom</i> before anyone
        fires, so two missiles don't chase one bandit while a second flies through untouched. Bad
        sort loses fights that good missiles would have won.</li>
        <li><b>Shooter / supporter split</b> — one jet illuminates or datalinks while the other stays
        silent or repositions; with <a data-goto="datalinknet">networking</a> the shooter need not even
        be the sensor (the A-B-C kill chain).</li>
        <li><b>Defensive splits</b> — when engaged, the element splits (one drags the bandit, one comes
        around for the shot) to convert a defensive merge into an offensive one.</li>
      </ul>
      <p class="tip">This 1-v-1 sim models the duel; real employment layers these roles on top. The
      <a data-goto="brevity">brevity & timeline</a> section is the radio language that lets a four-ship
      run all of this as one brain.</p>`,
  },
  {
    id: 'cccm', title: 'Seekers vs Countermeasures — The CCM Arms Race',
    html: `
      <p>Every countermeasure has begotten a counter-countermeasure (CCM). Knowing the ladder tells you
      exactly when a defence still works and when it's obsolete.</p>
      <h3>Radar seeker CCM</h3>
      <ul>
        <li><b>vs chaff/noise:</b> pulse-Doppler processing separates a fast jet from slow chaff and
        stationary jamming; <b>monopulse</b> angle tracking resists amplitude tricks; <b>frequency
        agility</b> defeats spot jammers; <b>home-on-jam</b> turns a loud jammer into a beacon;
        <b>burn-through</b> ends noise protection up close. (Play the <a data-goto="ew">J/S demo</a>.)</li>
        <li><b>vs the notch:</b> a <b>look-down/shoot-down</b> geometry separates the target from ground
        clutter so the notch fails; newer processors track through the notch briefly on the last known
        velocity.</li>
        <li><b>Leading edge:</b> AESA seekers, multi-static shots and networked cueing shrink the
        windows a defender used to exploit.</li>
      </ul>
      <h3>IR seeker CCM</h3>
      <ul>
        <li><b>Spin-scan → con-scan → rosette → imaging</b> is a ladder of ever-better flare rejection.
        A modern <b>imaging-IR (IIR)</b> seeker rejects flares by <b>shape</b> (a point fireball isn't
        a jet), <b>spectrum</b> (two-colour seekers ratio out the hotter flare), and <b>kinematics</b>
        (flares decelerate and fall). (Try the <a data-goto="cm">flare fight</a> — feel the generation
        gap.)</li>
        <li><b>Counter-countermeasures the defender still has:</b> pre-emptive flare programs that deny
        the clean lock, tight dispense-plus-break timing, kinematic defeat (drag it slow), and
        <b>DIRCM</b> lasers that dazzle the seeker head directly.</li>
      </ul>
      <p class="tip">The lesson repeated across the whole domain: a countermeasure buys <b>seconds and
      doubt against the generation it was designed for</b>, and becomes decoration against the next.
      The sim's per-seeker <i>jam susceptibility</i> and <i>burn-through range</i> are exactly where
      this ladder lives — edit them in the Forge and watch a defence work or fail.</p>`,
  },
  {
    id: 'datalinknet', title: 'Datalink Networks & the Digital Battlefield',
    html: `
      <p>Modern air combat is a <b>network</b>. The jet that sees, the jet that shoots, and the missile
      that kills may be three different platforms tied together by datalink. This is the biggest change
      since the missile itself.</p>
      <ul>
        <li><b>The tactical datalink (Link-16-class).</b> A jam-resistant, time-shared network that
        gives every member the <i>same</i> air picture: tracks, IDs, who's targeting whom, fuel/weapons
        state. It turns a formation into a single distributed sensor-and-shooter organism and is the
        backbone of the <a data-goto="formations">shooter/supporter</a> game.</li>
        <li><b>Weapon datalink.</b> The missile's own uplink (see <a data-goto="midcourse">midcourse</a>):
        the launching or a <i>third</i> platform steers it toward the predicted intercept point until
        its seeker takes over — enabling A-pole/F-pole discipline and <b>engage-on-remote</b> (launch on
        someone else's track, your own radar silent).</li>
        <li><b>Sensor fusion.</b> Radar + IRST + RWR + off-board tracks are fused into one confident
        track. Two passive IRSTs on datalink can even triangulate <i>range</i> and support a
        radar-silent shot — counter-stealth without emitting.</li>
        <li><b>The kill web, not chain.</b> Any sensor can cue any shooter: an AWACS or F-35 detects,
        an arsenal-jet or ship launches, the missile flies a relayed midcourse. Resilient (kill one
        node, the web routes around it) and lethal (the shooter never has to reveal itself).</li>
        <li><b>The contest over the network.</b> Jamming the datalink, spoofing tracks, and emission
        control are now first-order fights — break the enemy's network and his missiles go dumb; protect
        yours and one jet's eyes arm the whole force.</li>
      </ul>
      <p class="tip">This sim models the weapon datalink directly (shooter support: straight / crank /
      cold, and the INS fallback when the link drops). Fly the <b>Turn cold — drop link</b> support
      option and watch a good shot go stupid — that's the network's value in one experiment.
      See the link <i>types</i> diagrammed in <a data-goto="datalinks">Datalink Types</a>.</p>`,
  },
  {
    id: 'datalinks', title: 'Datalink Types — One-Way, Two-Way & Networked',
    html: `
      <p>"Datalink" spans everything from a dumb one-way command to a self-healing battle network. The
      three rungs, diagrammed — toggle through them:</p>
      <div class="wx" data-widget="datalinktypes"></div>
      <ul>
        <li><b>One-way command / illumination.</b> The shooter transmits to the missile, which sends
        nothing back — old command-guided SAMs, and SARH (the missile rides the shooter's reflected
        radar). Cheap, but the shooter is <b>chained to the intercept</b>: stop transmitting and the
        missile is orphaned. This is why a SARH shot can't crank away.</li>
        <li><b>Two-way weapon datalink.</b> Shooter and missile talk both ways: the shooter <b>uplinks</b>
        the predicted intercept point; the missile <b>downlinks</b> its position, seeker and lock state.
        This unlocks <a data-goto="midcourse">cranking</a>, mid-flight retargeting, home-on-jam handoff and
        kill assessment — the modern active-radar standard (AMRAAM-class).</li>
        <li><b>Tactical network + third-party (Link-16 class).</b> A jam-resistant mesh shares one air
        picture across AWACS, fighters and ships (see <a data-goto="datalinknet">datalink networks</a>).
        Any node can cue any shooter, and a <i>different</i> platform can guide the missile —
        <b>engage-on-remote</b>: the shooter stays silent, the web routes around losses.</li>
      </ul>
      <p class="tip">The jump from one-way to networked is as big as the jump from a dish to
      <a data-goto="radartypes">AESA</a> — it's what lets a stealth jet arm a whole formation without
      ever emitting.</p>`,
  },
  {
    id: 'history', title: 'Lessons from Real Engagements',
    html: `
      <p>Doctrine is written in hindsight. A few enduring lessons from the open historical record —
      the "why" behind the numbers this sim produces.</p>
      <ul>
        <li><b>Early BVR was disappointing (Vietnam).</b> First-generation radar missiles (early
        Sparrow) had poor reliability, restrictive rules of engagement, and demanded a tail-chase the
        jets couldn't always get. Lesson: a missile's <i>brochure</i> range is not its <i>employment</i>
        range — reliability, ID, and geometry dominate. It's why this sim separates Rmax from the
        no-escape zone.</li>
        <li><b>The all-aspect IR revolution.</b> When IR missiles (AIM-9L) could be fired head-on
        instead of only from behind, the merge became mutually lethal overnight. Lesson: <b>aspect
        restrictions define an era's tactics</b> — remove them and the whole geometry changes.</li>
        <li><b>BVR maturity (1991 onward).</b> With reliable active-radar missiles (AMRAAM), AWACS
        picture, and good ID, most modern kills happen <b>before the merge</b>, from the fighter with
        better SA and first-shot. Lesson: <b>win the information fight and you rarely need the knife
        fight.</b></li>
        <li><b>Stealth changes who shoots first, not the physics.</b> Low-observable jets don't break
        the radar equation — they exploit its fourth-root, compressing the enemy's timeline. Lesson:
        the <a data-goto="modern">kill-chain race</a> is the real contest.</li>
        <li><b>SAMs shape wars without firing.</b> A credible IADS forces low ingress, big packages,
        and SEAD — its product is <i>denial</i>, not just kills. Lesson: the <a data-goto="iadsnet">layers
        and the network</a> matter more than any single missile's range.</li>
        <li><b>The enduring truth:</b> energy, SA, and the first valid shot win air battles — the same
        three levers every widget in this academy has been teaching you to pull.</li>
      </ul>
      <p class="hint">(This section is deliberately doctrinal and non-specific — it's about principles
      you can verify in the sim, not a claim about any particular real engagement.)</p>`,
  },
  {
    id: 'challenge_sec', title: '🎖 Tactical Decision Trainer',
    html: `
      <p>Reading is one thing; <b>deciding under pressure</b> is another. Each card gives you a picture —
      your state, the threat, the geometry — and asks for the move. Correct calls earn <b>XP</b> toward
      your Wings. This is the applied core of everything in the academy:</p>
      <div class="wx" data-widget="challenge"></div>
      <p class="tip">Every scenario maps to a section: miss one, follow the link in its explanation and
      re-read, then come back. Then open <b>◈ TACTICAL-AI</b> and fly the exact picture — see your call
      proven in full 6-DOF.</p>`,
  },
  {
    id: 'threatid', title: '🃏 Threat Recognition',
    html: `
      <p>Every weapon has a fingerprint — motor type, seeker, range class, datalink. Read the fingerprint
      and you can predict a threat's envelope <i>before</i> the merge. Match the description to the
      weapon; each hit earns <b>XP</b>:</p>
      <div class="wx" data-widget="matchgame"></div>
      <p class="tip">The library in the sim carries 40+ of these, each with its real open-source
      parameters — open the Forge on any of them (or run the <a data-goto="mar">Tactical-AI</a> brief)
      to see exactly how its fingerprint sets its Rmax, MAR and no-escape zone.</p>`,
  },
  {
    id: 'checkride', title: '✔ Check-Ride — Test Yourself',
    html: `
      <p>You've read the academy and played with the widgets. Prove it. Each check-ride deals
      <b>8 random questions from a 24-question bank</b> spanning every category — geometry, guidance,
      missiles, radar, EW, SAM/IADS, WVR, doctrine — with instant feedback, streak tracking, and a
      "why" after every answer. Your <b>best score feeds your rank</b> in the header above the topic
      list; 7/8 or better is Weapons-School standard.</p>
      <div class="wx" data-widget="quiz"></div>
      <p class="tip">Missed one? The section it comes from is in the nav on the left. The real
      mastery loop, though, is in the sim: open ◈ TACTICAL-AI, read the kneeboard, predict the
      outcome of a shot, then fly it and check. Do that a dozen times and the numbers become
      instinct.</p>`,
  },
  {
    id: 'career', title: '🏆 Trophy Room',
    html: `
      <p>Your whole training record in one place — <b>medals, sortie streak, a mastery web</b> and a
      timed <b>Decision Drill</b>. Everything you do in the guide feeds it, and it all saves in your
      browser, so your rank and collection are still here next time you fly.</p>
      <h3>Medals</h3>
      <p>Sixteen to collect — for reading, acing check-rides, solving <a data-goto="challenge_sec">tactical
      challenges</a>, the <a data-goto="threatid">match game</a>, the drill below, the
      <a data-goto="codex">Weapon Codex</a>, and simply showing up day after day (your 🔥 sortie streak).</p>
      <div class="wx" data-widget="achievements"></div>
      <h3>Mastery web</h3>
      <p>Each spoke is a topic category; the green shape fills as you read it. A lopsided web shows exactly
      where your knowledge is thin — go round it out and your rank climbs with it.</p>
      <div class="wx" data-widget="masteryweb"></div>
      <h3>Decision Drill</h3>
      <p>Eight tactical calls against the clock. In a real BVR timeline the right call a second late is the
      wrong call — this trains speed <i>and</i> correctness, and rewards both. 80+ earns the ⏱ Quick Draw
      medal.</p>
      <div class="wx" data-widget="decisiondrill"></div>`,
  },
  {
    id: 'codex', title: '🃏 Weapon Codex',
    html: `
      <p>Ten signature air-to-air and surface-to-air missiles as <b>collectible cards</b> — each with its
      motor, seeker and a four-bar fingerprint: <b>range, top speed, no-escape-zone size and agility</b>.
      Learn to read the fingerprint and you can predict a threat's envelope before the merge — the same
      instinct the <a data-goto="threatid">match game</a> drills.</p>
      <p>Tap a card to <b>study</b> it: you'll reveal its doctrine note and bank +12 XP. Collect all ten for
      the 🏆 Codex Complete medal. Watch the trade every design makes — the ramjet <b>Meteor</b> gives up a
      little agility for an enormous NEZ; <b>AIM-9X</b> and <b>PAC-3</b> live at the ultra-agile end; the big
      interceptors (<b>R-37M</b>, <b>S-400</b>) buy range and speed at the cost of turn.</p>
      <div class="wx" data-widget="codex"></div>
      <p class="tip">These are the real weapons behind the sim's templates — see <a data-goto="propulsion">propulsion</a>,
      <a data-goto="seeker">seekers</a> and <a data-goto="ranges">range classes</a> for the physics that sets each bar.</p>`,
  },
  {
    id: 'glossary', title: 'Glossary',
    html: `
      <dl class="gloss">
        <dt>BVR / WVR</dt><dd>Beyond / Within Visual Range.</dd>
        <dt>Angle-off / AOT</dt><dd>Heading difference between the two jets / angle off the target's tail.</dd>
        <dt>Radar horizon</dt><dd>Line-of-sight range before Earth's curvature blocks the radar: ≈4.12·(√h₁+√h₂) km.</dd>
        <dt>HOBS / HMD</dt><dd>High-Off-Boresight shot / Helmet-Mounted Display that cues it.</dd>
        <dt>AESA</dt><dd>Active Electronically Scanned Array — agile, jam-resistant, LPI radar.</dd>
        <dt>VLO / LO</dt><dd>Very-Low / Low-Observable (stealth): tiny RCS shrinks everyone's detection range.</dd>
        <dt>IRST</dt><dd>Infrared Search & Track — passive, immune to radar stealth and jamming.</dd>
        <dt>Kill chain</dt><dd>Detect → track → launch → guide → assess; whoever finishes first tends to win.</dd>
        <dt>Drag / abort</dt><dd>Turning tail-on and running to defeat a shot outside MAR.</dd>
        <dt>MAR</dt><dd>Minimum Abort Range — closest range at which turning cold still defeats the shot.</dd>
        <dt>NEZ</dt><dd>No-Escape Zone — inside it, no kinematic escape exists.</dd>
        <dt>Recommit</dt><dd>Turning back into the fight after a successful abort, once the threat missile is dead.</dd>
        <dt>Pitbull</dt><dd>The missile's own seeker goes active; it no longer needs the shooter.</dd>
        <dt>A-pole / F-pole</dt><dd>Shooter→target range at pitbull / at intercept. Bigger = safer shot.</dd>
        <dt>PIP</dt><dd>Predicted Intercept Point — where the midcourse flies to meet the target.</dd>
        <dt>Loft</dt><dd>Midcourse climb into thin air to extend range; dive back for the endgame.</dd>
        <dt>Pitch-over</dt><dd>A vertical-launch SAM tipping onto its intercept profile on thrust-borne lift.</dd>
        <dt>Crank</dt><dd>Turning to the radar gimbal edge — still guiding, opening range.</dd>
        <dt>Notch / beam</dt><dd>Flying perpendicular to a Doppler radar to hide at zero closing velocity.</dd>
        <dt>Drag / go cold</dt><dd>Turning tail-on and running — the abort.</dd>
        <dt>Aspect</dt><dd>180° = head-on (hot), 90° = beam, 0° = tail (cold).</dd>
        <dt>Dual-pulse</dt><dd>Two separately-ignited grains: boost now, endgame energy later.</dd>
        <dt>Ducted rocket / ramjet</dt><dd>Air-breathing sustainer; Isp 3–4× solid; throttleable.</dd>
        <dt>Burn-through</dt><dd>Range inside which a radar overpowers jamming/chaff.</dd>
        <dt>TVM / SARH / ARH</dt><dd>Track-via-missile / semi-active / active radar homing.</dd>
        <dt>CLOS</dt><dd>Command to line-of-sight — beam riding (point-defence SAMs).</dd>
        <dt>RCS</dt><dd>Radar cross-section (m²) — how big you look to radar.</dd>
        <dt>λ̇ (LOS rate)</dt><dd>Line-of-sight rotation rate — PN drives it to zero.</dd>
        <dt>Zero-effort miss</dt><dd>Where you'd miss by if nobody steered again — OGL nulls it optimally.</dd>
        <dt>Thermal battery</dt><dd>One-shot power source; its life is the missile's control lifetime.</dd>
        <dt>Max-Q</dt><dd>Peak dynamic pressure the airframe survives.</dd>
      </dl>`,
  },
];

let _activeTeardown = null;   // module-scoped so reopening the modal never leaks widget loops

export function openHelp(sectionId) {
  const nav = document.getElementById('help-nav');
  const body = document.getElementById('help-body');
  if (_activeTeardown) { _activeTeardown(); _activeTeardown = null; }
  nav.innerHTML = '';

  // gamification: tell the engine the syllabus size, then log today's sortie
  // (advances the daily streak and may unlock streak medals right away).
  progress.total = HELP_SECTIONS.length;
  progress.visit();

  // ── rank & progress header (the gamification spine) ──
  const rankBox = document.createElement('div');
  rankBox.className = 'help-rank';
  // ── badges: category mastery + quiz achievements ──
  const CAT_BADGE = { 1: '◉ FOUNDATIONS', 2: '▲ WEAPONEER', 3: '◈ TACTICIAN',
    4: '⚡ EW SPECIALIST', 5: '▼ IADS BREAKER', 6: '✪ 5th-GEN' };
  const earnedBadges = () => {
    const out = [];
    for (const [ci, label] of Object.entries(CAT_BADGE)) {
      const items = HELP_SECTIONS.filter(s => (CAT_OF[s.id] ?? 7) === +ci);
      if (items.length && items.every(s => progress.isRead(s.id))) out.push(label);
    }
    const st = progress.stats();
    if (st.quizBest >= 7) out.push('⚔ TOP GUN');
    else if (st.quizBest >= 5) out.push('✔ QUALIFIED');
    if (st.read >= HELP_SECTIONS.length) out.push('★ COMPLETE');
    return out;
  };
  // publish per-category mastery for the Mastery-Web radar widget
  const publishCatMastery = () => {
    window._aegisCatMastery = CATEGORIES.map((name, ci) => {
      const items = HELP_SECTIONS.filter(s => (CAT_OF[s.id] ?? 7) === ci);
      const read = items.filter(s => progress.isRead(s.id)).length;
      const short = name.replace(/^[^A-Za-z]+/, '').trim();  // drop the icon glyph
      return { name, short, total: items.length, read, frac: items.length ? read / items.length : 0 };
    }).filter(c => c.total > 0 && c.name.indexOf('START') === -1);
  };
  const refreshRank = () => {
    const r = progress.rank(HELP_SECTIONS.length);
    const st = progress.stats();
    const badges = earnedBadges();
    const w = progress.wing();
    const wingPct = w.next ? Math.round(100 * (w.xp / w.next)) : 100;
    const sortie = progress.sortie();
    const med = progress.achievementCount();
    publishCatMastery();
    rankBox.innerHTML =
      `<div class="hr-rank"><span class="hr-icon">${r.icon}</span>${r.name}</div>` +
      `<div class="hr-bar"><i style="width:${r.pct}%"></i></div>` +
      `<div class="hr-meta">${r.pct}% mastery · ${st.read}/${HELP_SECTIONS.length} topics · best check-ride ${st.quizBest}${st.quizTotal ? '/' + st.quizTotal : ''} · best streak ${st.streakBest}</div>` +
      `<div class="hr-xp"><span>✈ ${w.name}</span><b>${w.xp} XP${w.next ? ` / ${w.next}` : ''}</b></div>` +
      `<div class="hr-bar hr-xpbar"><i style="width:${wingPct}%"></i></div>` +
      `<div class="hr-meta hr-grind">🔥 ${sortie.days}-day streak${sortie.best > sortie.days ? ` (best ${sortie.best})` : ''} · 🏅 ${med.got}/${med.total} medals</div>` +
      (badges.length ? `<div class="hr-badges">${badges.map(b => `<span class="hr-badge">${b}</span>`).join('')}</div>`
                     : `<div class="hr-badges hr-badge-hint">Read a full category or ace the check-ride to earn badges →</div>`);
    rankBox.title = 'Rank grows with topics read (60%) and your best check-ride score (40%). Earn XP by reading topics, acing quizzes, solving challenges, the match game, the Decision Drill and the Weapon Codex — XP promotes your WINGS (Bronze → Legend). Show up daily for a sortie streak. Finish a whole category to earn badges, and collect all 16 medals in the Trophy Room.';
  };
  // floating +XP toast on any XP award, and live-refresh the rank/XP header
  window._aegisXPtoast = (n) => {
    let t = document.getElementById('xp-toast');
    if (!t) { t = document.createElement('div'); t.id = 'xp-toast'; document.body.appendChild(t); }
    t.textContent = `+${n} XP`;
    t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
    refreshRank();
    if (window._aegisAchRefresh) window._aegisAchRefresh();
    if (window._aegisMasteryRefresh) window._aegisMasteryRefresh();
  };
  // big celebratory toast when a medal unlocks
  window._aegisAchToast = (a) => {
    let t = document.getElementById('ach-toast');
    if (!t) { t = document.createElement('div'); t.id = 'ach-toast'; document.body.appendChild(t); }
    t.innerHTML = `<span class="at-ic">${a.icon}</span><span class="at-tx"><b>MEDAL UNLOCKED</b>${a.name}</span>`;
    t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
    refreshRank();
    if (window._aegisAchRefresh) window._aegisAchRefresh();
  };
  refreshRank();
  nav.appendChild(rankBox);

  // ── quick filter box — type to find a topic across titles AND content ──
  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = '⌕ search all topics…';
  search.className = 'help-search';
  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    nav.querySelectorAll('.help-nav-item').forEach((b) => {
      const s = HELP_SECTIONS.find(x => x.id === b.dataset.id);
      const hit = !q || s.title.toLowerCase().includes(q) || s.html.toLowerCase().includes(q);
      b.style.display = hit ? '' : 'none';
    });
    nav.querySelectorAll('.help-cat').forEach(h => {
      // hide category headers whose every item is hidden
      let sib = h.nextElementSibling, any = false;
      while (sib && sib.classList.contains('help-nav-item')) {
        if (sib.style.display !== 'none') { any = true; break; }
        sib = sib.nextElementSibling;
      }
      h.style.display = any ? '' : 'none';
    });
  });
  nav.appendChild(search);

  // ── grouped nav: category headers + read ticks ──
  CATEGORIES.forEach((catName, ci) => {
    const items = HELP_SECTIONS.filter(s => (CAT_OF[s.id] ?? 7) === ci);
    if (!items.length) return;
    const head = document.createElement('div');
    head.className = 'help-cat';
    head.textContent = catName;
    nav.appendChild(head);
    items.forEach(s => {
      const a = document.createElement('button');
      a.className = 'help-nav-item';
      a.dataset.id = s.id;
      a.innerHTML = `<span class="hn-tick">${progress.isRead(s.id) ? '✓' : ''}</span>${s.title}`;
      a.addEventListener('click', () => show(s.id));
      nav.appendChild(a);
    });
  });

  function show(id) {
    if (_activeTeardown) { _activeTeardown(); _activeTeardown = null; }   // stop the previous section's widgets
    const s = HELP_SECTIONS.find(x => x.id === id) || HELP_SECTIONS[0];
    body.innerHTML = `<h2>${s.title}</h2>` + s.html;
    body.scrollTop = 0;
    _activeTeardown = mountWidgets(body);            // mount any live widgets in this section
    body.querySelectorAll('[data-goto]').forEach(a => a.addEventListener('click', (e) => {
      e.preventDefault(); show(a.dataset.goto);       // in-guide hyperlinks
    }));
    if (!progress.isRead(s.id)) progress.addXP(15);   // XP for reading a new topic
    progress.markRead(s.id);
    refreshRank();
    nav.querySelectorAll('.help-nav-item').forEach(c => {
      c.classList.toggle('active', c.dataset.id === s.id);
      if (c.dataset.id === s.id) c.querySelector('.hn-tick').textContent = '✓';
    });
  }
  window._aegisHelpGoto = show;   // let deep links elsewhere jump to a section
  // Reveal the modal BEFORE mounting widgets so their canvases measure a real
  // laid-out width (a hidden modal reports 0 → mis-sized first paint).
  const modal = document.getElementById('help-modal');
  modal.classList.remove('hidden');
  show(sectionId || HELP_SECTIONS[0].id);
  // tear widgets down when the guide closes (so their rAF loops stop)
  const closer = () => { if (_activeTeardown) { _activeTeardown(); _activeTeardown = null; } };
  document.getElementById('help-close')?.addEventListener('click', closer, { once: true });
}
