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
  emtheory: 3, formations: 3, rwr: 3, polegame: 3, energy: 3, section2ship: 3,
  wez: 3, sternconv: 3,
  ew: 4, cm: 4, notchgame: 4,
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
      <p>This one equation governs who sees whom first, so it is worth building rather than quoting.
      Step through the two-way journey the energy actually makes — each click adds one physical idea
      and one factor to the formula:</p>
      <div class="wx" data-widget="radarderive"></div>
      <h4>Every term, and what it costs you</h4>
      <p class="eq">P<sub>r</sub> = P<sub>t</sub> · G² · λ² · σ / ( (4π)³ · R⁴ ) &nbsp;&nbsp;⇒&nbsp;&nbsp;
      R<sub>max</sub> = [ P<sub>t</sub> · G² · λ² · σ / ( (4π)³ · S<sub>min</sub> ) ]<sup>¼</sup></p>
      <table class="range-table"><thead><tr><th>Term</th><th>Units</th><th>What it is — and the engineering reality</th></tr></thead><tbody>
      <tr><td><b>P<sub>t</sub></b> — transmit power</td><td>W</td><td>Peak power out of the transmitter. The obvious knob, and the weakest: it sits under the fourth root, so <b>16× the power doubles your range</b>. Also the one that makes you loudest to his <a data-goto="rwr">RWR</a>.</td></tr>
      <tr><td><b>G</b> — antenna gain</td><td>dimensionless</td><td>How much the antenna concentrates energy into a beam versus radiating equally in all directions. It appears <b>squared</b> because you get it twice: focusing on transmit and collecting on receive. Bigger array or higher frequency ⇒ more gain, narrower beam, less search volume per second.</td></tr>
      <tr><td><b>λ</b> — wavelength</td><td>m</td><td>Sets antenna physics: effective aperture A<sub>e</sub> = Gλ²/4π. Short λ (X-band) gives fine resolution and small antennas — ideal in a fighter nose. Long λ (VHF/UHF) gives coarse tracking but is far <b>harder to hide from</b>, because shaping and coatings are tuned to specific wavelengths. That is the whole counter-stealth argument.</td></tr>
      <tr><td><b>σ</b> — radar cross-section</td><td><b>m²</b></td><td>Everything about the target — size, shape, material, aspect — collapsed into one equivalent area. Formally: the area of a perfect isotropic scatterer that would return the same echo. Being an <b>area, σ is always positive</b>; it is <i>not</i> the jet's physical size, and it swings by orders of magnitude with aspect and band (see the polar plot below).</td></tr>
      <tr><td><b>R</b> — range</td><td>m</td><td>The killer. Out-and-back spreading means the echo falls as <b>1/R⁴</b>: double the range, one-sixteenth the signal.</td></tr>
      <tr><td><b>S<sub>min</sub></b> — min detectable signal</td><td>W</td><td>The receiver's noise floor and processing threshold. Lower it (better receivers, longer integration, pulse compression) and range grows — still only as the fourth root. This is where modern radars quietly win.</td></tr>
      </tbody></table>
      <p><b>Where the fourth root comes from:</b> power dies as R⁴, and range is what you get when you
      invert that — so <i>every</i> design term is trapped under a ¼ exponent. This is the single most
      important intuition in sensor warfare: <b>brute force barely moves range, and enormous effort
      buys modest gains — which is exactly why attacking σ is worth billions.</b></p>
      <p>Sweep power and RCS and watch it happen:</p>
      <div class="wx" data-widget="radareq"></div>
      <h4>RCS is not one number</h4>
      <p>The σ in that equation is a single value only for a single aspect and a single frequency. In
      reality it is a wildly spiky function of the angle you are looking from — which is why the "brochure
      RCS" is always the flattering nose-on figure. Spin the aspect and compare a conventional fighter
      against a shaped design:</p>
      <div class="wx" data-widget="rcsaspect"></div>
      <div class="workex">A search radar sees a clean 5 m² fighter at 85 km. Hang low-observable
      shaping on the threat and its RCS drops 1000× to 0.005 m². New detection range:
      <span class="m">85 × (0.001)<sup>¼</sup> ≈ 85 × 0.178 ≈ 15 km</span>. A <b>thousand-fold</b>
      engineering effort bought a <b>5.6×</b> range cut — that's the tyranny of the fourth root, and
      it cuts both ways: doubling transmitter power buys only <span class="m">2<sup>¼</sup> ≈ 19%</span>
      more range. Stealth attacks the σ term because it's the only one your <i>adversary</i> controls.</div>
      <div class="lore">Radar's paternity is disputed by half of physics. <b>Christian Hülsmeyer</b>
      patented his "Telemobiloskop" ship-collision detector in <b>1904</b> — it worked, and nobody
      bought one. The word itself is a US Navy acronym from <b>1940</b>: <i>RAdio Detection And
      Ranging</i>. The system that proved the concept in blood was Britain's <b>Chain Home</b> (1938):
      crude HF towers, but wired into the <b>Dowding System</b> — the world's first integrated air
      defence network — they let ~700 RAF fighters be at the right place at the right time against
      the Luftwaffe in 1940. The lesson that still runs today's IADS doctrine: <b>the network beat
      the better radar</b>. Germany's Würzburg sets were technically finer; they weren't a system.</div>
      <p class="tip">RCS is not one number — it varies wildly with aspect (nose-on is what gets
      quoted; beam aspect can be 100× bigger) and with band (VLO shaping is optimised against
      fighter X-band; long-wave surveillance radars see stealth jets far better, which is why
      counter-stealth radars are low-band and why the sim's RCS drives seeker acquisition range).</p>`,
  },
  {
    id: 'radartypes', title: 'How Radar Scans — Mechanical, Pulse-Doppler & AESA',
    html: `
      <p>"Radar" is not one thing. Before anything else, separate the two questions people constantly
      confuse:</p>
      <ul>
        <li><b>How does it POINT the beam?</b> — mechanical, PESA, or AESA. This is <i>antenna</i>
        architecture.</li>
        <li><b>How does it PROCESS the echo?</b> — pulse-Doppler, and everything built on it. This is
        <i>signal</i> architecture.</li>
      </ul>
      <p class="tip">These are <b>independent</b>. A 1970s mechanical dish can absolutely be
      pulse-Doppler (the F-16's early APG-66 was), and an AESA without Doppler processing would be
      helpless against a low-flyer in clutter. "AESA" tells you how fast the beam moves — it says nothing
      about whether the radar can pick a cruise missile out of the ground return.</p>

      <h3>1 · How the beam is actually steered</h3>
      <p>Electronic steering is not magic and it is not a metaphor. Each element radiates a little
      spherical wavelet; the <b>envelope of those wavelets is the wavefront</b> (Huygens' principle).
      Fire the elements simultaneously and the wavefront is flat and the beam goes straight ahead. Delay
      each element slightly more than its neighbour and the envelope <b>tilts</b> — and the beam points
      somewhere else, with nothing having moved. Switch modes and watch the hardware behind it change:</p>
      <div class="wx" data-widget="arrayphysics"></div>
      <p>The steering law is one line: to point at angle θ, each element gets a progressive phase shift</p>
      <p class="eq">Δφ = (2π d / λ) · sin θ &nbsp;&nbsp;&nbsp;<span style="color:var(--ink-dim)">(d = element spacing, typically λ/2)</span></p>
      <table class="range-table"><thead><tr><th></th><th>Mechanical</th><th>PESA</th><th>AESA</th></tr></thead><tbody>
      <tr><td><b>How it aims</b></td><td>Motors slew the antenna</td><td>Phase shifters</td><td>Phase shifters, one per module</td></tr>
      <tr><td><b>Transmitter</b></td><td>One tube + feed horn</td><td><b>One</b> central tube, power divided out</td><td><b>Hundreds</b> of solid-state T/R modules</td></tr>
      <tr><td><b>Repoint time</b></td><td>~tens of ms (inertia)</td><td>microseconds</td><td>microseconds</td></tr>
      <tr><td><b>Simultaneous beams</b></td><td>1</td><td>1</td><td><b>Several</b> (sub-arrays)</td></tr>
      <tr><td><b>Frequency agility</b></td><td>Limited</td><td>Limited (shared source)</td><td><b>Pulse-to-pulse</b></td></tr>
      <tr><td><b>Failure mode</b></td><td>Tube dies → radar dead</td><td>Tube dies → radar dead</td><td><b>Graceful</b> — lose modules, not the radar</td></tr>
      <tr><td><b>LPI / low intercept</b></td><td>Poor</td><td>Moderate</td><td><b>Strong</b> (spread, agile waveforms)</td></tr>
      </tbody></table>
      <p><b>What a T/R module actually is:</b> a solid-state <b>power amplifier</b> for transmit, a
      <b>low-noise amplifier</b> for receive, a <b>phase shifter</b>, and a switch — a complete miniature
      radar a few centimetres across. Put 1,000 of them behind a radome and you no longer have an antenna
      being fed by a transmitter; you have a thousand transmitters that <i>agree</i> to point somewhere.
      Everything AESA does well flows from that one change.</p>

      <h3>2 · Beamwidth — the straw you search the sky with</h3>
      <p>The beam is not a laser. Its width comes straight from aperture physics: <b>θ ≈ λ/D</b> — a beam
      is narrow only if the antenna is many wavelengths across. That single ratio decides your angular
      resolution, your gain, and how much sky you can cover per second. Drag the aperture, the band, and
      the steer angle:</p>
      <div class="wx" data-widget="beamwidth"></div>
      <ul>
        <li><b>Bigger D or higher frequency ⇒ narrower beam</b> — sharper angular resolution, more gain,
        longer detection range. But a narrow beam is a thin straw: covering the same volume takes longer.</li>
        <li><b>Steering costs you.</b> An electronically scanned face does not turn, so off boresight it
        presents a <b>foreshortened</b> aperture D·cos θ. Beamwidth grows as <b>1/cos θ</b> and gain drops
        with <b>cos θ</b>. That is why practical AESA coverage is roughly <b>±60°</b> per face, and why
        fighters still manoeuvre to keep the fight in front of them — the "gimbal limit" that makes
        <a data-goto="polegame">cranking</a> a real constraint rather than a free lunch.</li>
        <li><b>Sidelobes matter.</b> The little lobes flanking the main beam are the back door through
        which jamming and clutter enter. Suppressing them (amplitude tapering) costs main-beam width —
        another trade with no free side.</li>
      </ul>

      <h3>3 · Bars — how the sky actually gets painted</h3>
      <p>A search radar does not illuminate a cone; it <b>paints a raster</b>. The beam sweeps across in
      azimuth, steps down about one beamwidth in elevation — one <b>bar</b> — sweeps back, and repeats.
      A fighter pilot selecting "4-bar, 60 degrees" is choosing exactly this pattern, and it is one of the
      most consequential decisions in the intercept:</p>
      <div class="wx" data-widget="barscan"></div>
      <p>The trade is brutal and unavoidable: <b>volume versus freshness</b>. More bars and wider azimuth
      cover more sky but stretch the <b>frame time</b>, so every track ages before the beam returns. Fewer
      bars give a fast, fresh picture of a thin slice — and a target a few thousand feet outside that slice
      is not "faint", it is simply <b>not in the volume being searched</b>. This is why the elevation
      question ("where is he in height?") dominates real intercept geometry, and why an AESA's ability to
      <b>squeeze a track update in between search bars</b> — instead of waiting a whole frame — is worth
      more in practice than its headline range.</p>

      <h3>4 · Test yourself</h3>
      <div class="wx" data-widget="radarpick"></div>

      <h3>5 · Processing echoes: the pulse-Doppler PRF trade</h3>
      <p>How often the radar pulses (its <b>PRF</b>) forces a fundamental compromise between measuring
      <i>range</i> and measuring <i>velocity</i>. Sweep it:</p>
      <div class="wx" data-widget="prf"></div>
      <p>This is why <b>look-down/shoot-down</b> needed pulse-Doppler (high/medium PRF filters fast movers
      out of ground clutter), and why the <a data-goto="ew">Doppler notch</a> exists at all — beam the
      radar and your near-zero velocity drops you into the clutter it must reject.</p>
      <div class="lore">The AESA era arrived quietly: <b>Japan's F-2</b> fielded the first production
      fighter AESA (the J/APG-1) around <b>2000</b>, beating everyone to service; the same year US
      F-15Cs at Elmendorf got the APG-63(V)2, and the F-22's <b>APG-77</b> then set the standard —
      an array so agile it hops frequencies pulse-to-pulse and whispers in <b>LPI</b> patterns an RWR
      struggles to even classify as a radar. Crews describe fighting a modern AESA jet as being
      "clubbed by the invisible man": the first hard warning may be the missile going
      <a data-goto="midcourse">pitbull</a>. Meanwhile the humble spinning dish isn't dead — it's just
      been demoted to weather radar and museum pieces.</div>`,
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

      <h3>What separates them is the band — and λ decides everything</h3>
      <p>These three radars are not just "big" and "small". They live in different parts of the spectrum,
      and almost every property you care about falls out of the wavelength. Sweep the band and watch the
      consequences:</p>
      <div class="wx" data-widget="radarbands"></div>
      <table class="range-table"><thead><tr><th>Band</th><th>λ</th><th>Typical job</th><th>Why</th></tr></thead><tbody>
      <tr><td><b>VHF / UHF</b></td><td>~1–10 m</td><td>Early warning, counter-stealth</td><td>Wavelengths comparable to whole airframe features, so <a data-goto="modern">shaping/RAM tuned for X-band works far less well</a>. But a narrow beam would need an antenna the size of a building — coarse by nature.</td></tr>
      <tr><td><b>L / S</b></td><td>~10–30 cm</td><td>Long-range surveillance, acquisition</td><td>The practical compromise: real range, usable (if not weapon-grade) accuracy, tolerant of weather. AEW radars and big acquisition sets live here.</td></tr>
      <tr><td><b>C</b></td><td>~4–8 cm</td><td>Acquisition / multifunction</td><td>Middle ground — enough precision to hand off, enough aperture efficiency to stay mobile.</td></tr>
      <tr><td><b>X / Ku</b></td><td>~2–3 cm</td><td>Fighter FCR, missile seekers</td><td>A genuinely narrow beam fits behind a fighter radome or in a missile nose. Precision for weapons — and the exact band stealth is designed against.</td></tr>
      </tbody></table>
      <p class="tip"><b>The counter-stealth trap.</b> "Low-band radars see stealth aircraft" is true and
      routinely over-sold. A VHF set can tell you <i>something is out there, roughly that way</i> — but
      θ ≈ λ/D means its angular precision is measured in degrees, which at 200 km is an error box
      kilometres across. That is a <b>cue</b>, not a firing solution. The real counter-stealth play is
      <b>networked</b>: low band detects and cues, and something else — an X-band FCR sneaking a look, an
      <a data-goto="ir101">IRST</a>, or another sensor entirely — converts that cue into a track worth
      shooting at. That handoff is the seam a stealth force spends its whole mission plan trying to break.</p>

      <h3>What "track quality" actually means</h3>
      <p>A radar contact is not binary. It matures through levels, and every tactical decision depends on
      which level you have:</p>
      <ul>
        <li><b>Detection</b> — energy above threshold in some resolution cell. One look. Could be a jet,
        a bird, or noise; you cannot even be sure it is real yet.</li>
        <li><b>Track initiation</b> — several detections associated across successive looks into a
        consistent motion. Now it has a velocity and a history.</li>
        <li><b>Firm track</b> — the track's error covariance has settled small enough that the system will
        commit to it: sort it, assign it, hand it off. This is the currency of <a data-goto="section2ship">sorting</a>.</li>
        <li><b>Weapon-quality track</b> — accurate <i>and</i> updated fast enough to steer a missile. This
        is what only an FCR (or an AESA dedicating time to that track) can produce.</li>
      </ul>
      <p>The gate between these is <b>revisit rate</b>. A track fed every 10 seconds by a slow-turning
      early-warning set has huge uncertainty between updates — plenty for an air picture, nowhere near
      enough to shoot. That is why <a data-goto="radartypes">how many bars you scan</a> is not a detail:
      it directly sets how good your tracks are allowed to be.</p>

      <h3>The FCR's workload depends on your missile</h3>
      <p>Here is the link that ties this page to every shot in the simulator — <b>how the weapon is guided
      decides how long the fire-control radar is captive</b>:</p>
      <ul>
        <li><b>SARH</b> (semi-active) — the FCR must <b>illuminate that one target continuously until
        impact</b>. One illuminator equals one engagement at a time, and everyone else in the raid flies
        on untouched. This is the single biggest limit on old SAM systems' and old fighters' magazine depth.</li>
        <li><b>Command / TVM</b> — the ground radar tracks both target and missile and computes the
        steering, uplinking corrections. Still captive, but the smarts stay on the ground where they can
        be big and cheap.</li>
        <li><b>ARH</b> (active) — the FCR only needs to supply <a data-goto="midcourse">midcourse
        updates</a> until the missile's own seeker goes <b>pitbull</b>, then it is free. That is what makes
        genuinely simultaneous multi-target engagement possible — and what lets a shooter
        <a data-goto="polegame">crank away</a> instead of flying into the merge.</li>
      </ul>

      <h3>Why an IADS deliberately splits the roles</h3>
      <ul>
        <li><b>Survivability.</b> An FCR that radiates continuously is an <a data-goto="iadsnet">anti-radiation
        missile</a> magnet. Keeping detection on a separate, distant, low-band set means the expensive,
        vulnerable, short-legged FCR can stay <b>silent</b> until the last possible moment.</li>
        <li><b>EMCON.</b> Emission control is a tactic in itself: radiate only what the current phase
        requires. The 1999 <a data-goto="sam">F-117 shoot-down</a> was won largely by a crew who kept their
        fire-control radar off for all but a few seconds.</li>
        <li><b>Redundancy.</b> Separate boxes fail — and are killed — separately. Losing an FCR costs you
        an engagement; losing the only radar costs you the sector.</li>
        <li><b>Optimisation.</b> No single antenna can be simultaneously huge and low-band (for range) and
        tiny and high-band (for precision). Splitting the roles lets each radar be good at exactly one thing.</li>
      </ul>
      <p class="tip">The fighter took the opposite path: one <a data-goto="radartypes">AESA</a> time-shares
      all three jobs from a single aperture, because a fighter cannot carry three radars. That is a
      genuine engineering triumph — and also why an aircraft's radar range will never match a purpose-built
      ground early-warning set with a hundred times the antenna and a power station behind it.</p>
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
      which is why deception jammers must resort to cross-eye or terrain-bounce (see <a data-goto="ew">EW</a>).</p>
      <div class="lore">The radar family earned its reputations one shot at a time. On <b>1 May 1960</b>
      an SA-2's <b>Fan Song</b> fire-control radar guided the missile that brought down Gary Powers'
      U-2 over Sverdlovsk — ending the era of "fly high, fly safe" overnight. Five years later
      (<b>24 July 1965</b>) an SA-2 took the first USAF jet of the Vietnam air war, and within months
      the US invented a whole new mission — <a data-goto="iadsnet">Wild Weasel</a> — just to duel the
      radar family itself. At the other end of the chain, the E-3 Sentry's 9-metre rotodome is an
      entire <b>acquisition radar flying at 9 km altitude</b>: its whole reason to exist is the
      <a data-goto="horizon">horizon geometry</a> in the widget above.</div>`,
  },
  {
    id: 'ir101', title: 'Infrared Fundamentals — Heat, Bands & IRST',
    html: `
      <p>Everything above absolute zero glows in the infrared. IR sensors weaponise that — silently.
      The whole discipline hangs on one picture — what a jet radiates vs what the atmosphere lets
      through:</p>
      <div class="wx" data-widget="irbands"></div>
      <div class="workex">Where does a body glow brightest? <b>Wien's law:</b>
      <span class="m">λ<sub>peak</sub> = 2898 / T µm</span>. Engine hot parts at ~900 K →
      <span class="m">2898/900 ≈ 3.2 µm</span> — squarely in <b>MWIR</b>.
      Now the skin, which is heated by <b>compression and friction</b>, not by the engine. Its
      temperature is the <b>recovery temperature</b>
      <span class="m">T<sub>r</sub> ≈ T<sub>∞</sub>(1 + 0.89 · 0.2 · M²)</span>. At 10 km
      (<span class="m">T<sub>∞</sub> = 223 K</span>) and Mach 0.9 that is only
      <span class="m">223 × 1.14 ≈ 255 K</span> → <span class="m">2898/255 ≈ 11.4 µm</span>, deep in
      <b>LWIR</b>. Down at sea level the same Mach gives <span class="m">≈330 K</span> — so "how hot is
      the skin" has no single answer: it depends on altitude and Mach together. One formula, and the
      whole sensor market falls out of it.</div>
      <ul>
        <li><b>What glows on a jet:</b> the engine hot parts and plume (fiercest, but mostly visible
        from behind), the exhaust-washed tailpipe, and — at speed — <b>aerodynamic heating</b>. That
        last one is bigger than people expect: stagnation temperature is
        <span class="m">T₀ = T<sub>∞</sub>(1 + 0.2 M²)</span>, so a <b>Mach 1.6</b> jet's leading edges
        run about <b>100 K above ambient</b> (≈328 K at 10 km), visible from <i>any</i> aspect — and a
        Mach 5 missile is at roughly <b>six times</b> ambient, a genuine torch. Afterburner multiplies
        the signature many times over: burner in a fight is a beacon.</li>
        <li><b>Bands:</b> <b>MWIR (3–5 µm)</b> — hot metal and plume peak here, <i>and</i> it is where
        essentially every fielded imaging air-to-air seeker actually lives (AIM-9X, IRIS-T, Python-5 and
        MICA-IR all use indium-antimonide focal planes, which cut off around 5.5 µm; the F-35's EOTS and
        DAS are MWIR too). <b>LWIR (8–12 µm)</b> — cooler <i>skin</i> heat peaks here, so this is the
        band for long-wave IRSTs hunting a target from the front, and for dual-band sensors like
        Typhoon's PIRATE that watch both windows at once. Between them, roughly <b>5–8 µm</b>, water
        vapour (the 6.3 µm band) shuts the atmosphere almost completely — that wall is why there are two
        separate windows rather than one. CO₂ does not sit between them: it <b>notches the MWIR window
        at 4.3 µm</b> and <b>closes the far end past ~15 µm</b>.</li>
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
      <div class="lore">The heat-seeker was born a garage project. At China Lake, physicist
      <b>William McLean</b> began the work in <b>1946</b> as an unfunded in-house effort, building the
      Sidewinder largely off-budget against official indifference — and naming it for the
      <b>sidewinder rattlesnake</b>, which really does hunt by infrared, sensing prey heat through pit
      organs between eye and nostril. On <b>24 September 1958</b>, Taiwanese F-86s fired the missile
      (then designated <b>GAR-8</b> — the familiar "AIM-9B" label only arrived with the 1962
      tri-service redesignation) at MiG-17s over the Taiwan Strait: the first guided air-to-air missile
      kills in history. One round lodged in a MiG <i>without exploding</i>, was shipped to Moscow, and
      was reverse-engineered into the Soviet <b>K-13 / AA-2 "Atoll"</b> — one of the most consequential
      unintended technology transfers of the Cold War. Nearly seventy years of upgrades later, the
      airframe McLean sketched is still on wingtips worldwide.</div>
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
      <a data-goto="mar">MAR and no-escape zone</a>.</p>
      <div class="lore"><b>Why every beat has a name.</b> BVR combat was declared inevitable in the early 1960s — the F-4 Phantom entered service without an internal gun because <b>AIM-7 Sparrow</b> salvoes were expected to settle everything at radar range. Vietnam wrecked the script: rules of engagement demanded visual identification, dragging fights inside dogfight range, and crews under fire launched most Sparrows outside the missile's parameters. Kill rates collapsed to roughly one shot in ten, against test-range forecasts several times higher. The fix was not just better missiles — it was <b>choreography</b>: named phases, briefed commit criteria, disciplined <a data-goto="mar">abort ranges</a>. The commit–crank–pitbull litany in this section is the institutional memory of those losses, drilled until it runs faster than adrenaline.</div>
      <div class="workex"><b>Worked example — what cranking buys in A-pole.</b> You launch at <span class="m">60 km</span>. The missile averages <span class="m">900 m/s</span> along the line of sight and the hot target adds <span class="m">300 m/s</span>, so missile–target range shrinks at <span class="m">1200 m/s</span>. The seeker goes pitbull at <span class="m">15 km</span>, so it must close <span class="m">60 − 15 = 45 km</span>, taking <span class="m">45 000 / 1200 = 37.5 s</span>. Fly straight and your own closure is <span class="m">300 + 300 = 600 m/s</span>: A-pole = <span class="m">60 − 0.6 × 37.5 = 37.5 km</span>. Crank 60° off instead and your closing component drops to <span class="m">300 × cos 60° = 150 m/s</span> (total closure <span class="m">450 m/s</span>): A-pole = <span class="m">60 − 0.45 × 37.5 ≈ 43.1 km</span>. One turn bought <span class="m">5.6 km</span> of extra separation at the moment the missile stopped needing you.</div>`,
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
      <p class="tip">Which laws loft? Only <b>datalink-capable</b> weapons flying APN or OGL midcourse —
      because a loft needs a <i>predicted intercept point</i> to fly toward, and that has to be fed to
      the missile. PN and CLOS home on the here-and-now, so they never loft. Note that "IR missile"
      does <b>not</b> automatically mean "no datalink": most short-range heat-seekers have none, but
      datalinked IIR weapons exist — <b>MICA-IR</b> in this library carries a datalink and does loft.
      The rule the sim enforces is about the <i>datalink and the law</i>, not the seeker type. See the
      flight paths compared in <a data-goto="guidancelaws">Guidance Laws Compared</a>.</p>
      <div class="lore"><b>The mathematics came from space.</b> Proportional navigation is the old mariner's rule mechanised, but the laws above it — the <b>optimal</b> ones — were born in the guidance labs of the early space age. In <b>1960</b> Rudolf Kalman published a recursive filter for estimating a system's true state from noisy measurements; within a few years the same optimal-control mathematics was running in the Apollo guidance computer. Missile engineers recognised their own problem in it: given a noisy seeker, a moving target and a finite control budget, what steering <i>minimises</i> the miss? The answer is the <b>zero-effort miss</b> formulation — where you would miss by if nobody ever steered again — nulled with the least total effort. That is the <b>OGL</b> option in this simulator: PN is the sailor's instinct, OGL is the moon-shot's arithmetic pointed at a fighter.</div>`,
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
      the trajectory and G-load change.</p>
      <div class="lore"><b>PN before the computer.</b> Proportional navigation sounds like a job for a flight computer, but the missile that made it famous carried none. The trick was mechanical: mount the seeker optics on the rotor of a <b>gyroscope</b>. A spinning gyro resists being turned, so the torque required to keep it pointed at a drifting target is — by the physics of precession — directly proportional to the <b>line-of-sight rate</b>. The seeker therefore <i>measures</i> the exact quantity PN consumes, and the guidance law falls out of the hardware for free, with no computation at all. Generations of engineers have since added APN's target-acceleration term and OGL's optimal-control polish, but every one of them is still chasing the same number that a 1950s spinning mirror produced as a side effect of trying to stay still.</div>
      <div class="workex"><b>Worked example — what PN actually commands.</b> A target cuts across the line of sight at <span class="m">v<sub>⊥</sub> = 300 m/s</span> at range <span class="m">R = 6 km</span>. The LOS rate is <span class="m">λ̇ = v<sub>⊥</sub>/R = 300 / 6000 = 0.05 rad/s</span> (≈ 2.9°/s). With closing velocity <span class="m">V<sub>c</sub> = 1200 m/s</span> and <span class="m">N = 4</span>, PN commands <span class="m">a = N·V<sub>c</sub>·λ̇ = 4 × 1200 × 0.05 = 240 m/s² ≈ 24.5 g</span>. Now let the same geometry close to <span class="m">R = 3 km</span>: λ̇ doubles to <span class="m">0.1 rad/s</span> and the command doubles to <span class="m">480 m/s² ≈ 49 g</span> — beyond what most airframes can pull. That is why a late-crossing target is so expensive, and why PN's whole strategy is to null λ̇ <i>early</i>, while the correction is still cheap.</div>`,
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
      <h3>Watch the PIP go stale</h3>
      <p>Fly the same shot three ways against a target that breaks. The missile always steers at a
      <b>Predicted Intercept Point</b> — the question is whether that point is still being refreshed:</p>
      <div class="wx" data-widget="midcoursepip"></div>
      <p><b>Shooter support matters.</b> After launch you choose: <b>Straight</b> (press in — best
      guidance, most exposure), <b>Crank</b> (hold the target at the gimbal edge — open range while
      still guiding), or <b>Turn cold</b> (drop the link immediately — the missile flies INS and the
      kill probability drops; the classic mistake case). Compare all three and watch the miss
      distance move.</p>
      <p><b>SARH</b> (Sparrow, R-27R, big legacy SAMs) is the harsh version: the missile homes on
      your radar's <i>reflection</i>, so you must illuminate to impact — no crank, no cold.</p>
      <div class="lore"><b>Why the datalink exists.</b> In Vietnam, the semi-active <b>AIM-7 Sparrow</b> scored roughly one kill per ten shots. Crews had to hold lock and illuminate to impact — nose-on, closing fast — while fragile 1960s electronics, tropical humidity and dogfight geometry ate the rest. The fix took two decades: give the missile its own <b>INS</b>, feed it <b>datalink</b> corrections in midcourse, and let an onboard <b>active seeker</b> close the deal so the shooter can crank away. That weapon is <b>AMRAAM</b>. After a long, nearly-cancelled development it entered service in 1991 and drew first blood on 27 December 1992: a USAF F-16 downed an Iraqi MiG-25 over the southern no-fly zone — the first air-to-air kill ever scored by a USAF F-16.</div>
      <div class="workex"><b>Worked example — what the crank buys.</b> Head-on, both fighters at <span class="m">250 m/s</span>: closure is <span class="m">250 + 250 = 500 m/s</span>. Now crank <span class="m">50°</span> off the target — still inside a typical ±60° radar gimbal, so the datalink keeps feeding. Your closing component drops to <span class="m">250 × cos 50° ≈ 161 m/s</span>, total closure to <span class="m">161 + 250 = 411 m/s</span> — an 18% cut. Over a <span class="m">40 s</span> missile flight that is <span class="m">(500 − 411) × 40 ≈ 3,560 m</span> less closing: your <b>F-pole</b> — your range from the target at missile impact — grows by roughly 3.6 km, often the difference between standing inside or outside the bandit's return shot. Turn fully cold and closure falls to <span class="m">250 − 250 = 0</span> — but the link, and your Pk, go with it.</div>`,
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
      <h3>Fly it yourself</h3>
      <p>The plot below is a live <b>point-mass integration</b> — thrust, drag from the sim's own
      Cd₀(M) curve, inverse-square gravity, USSA-1976 density — not an illustration. Sweep the loft
      angle and the whole trade appears on its own:</p>
      <div class="wx" data-widget="loftprofile"></div>
      <p class="tip">The Mach chart tells the whole story: boost spike → cruise decay → dive
      re-acceleration → the number that matters: <b>Mach at the merge</b>. A missile arriving below
      ~Mach 1.5 can't out-turn anyone. This is why the best defence is often simply making the shot
      longer.</p>
      <div class="lore"><b>Point Mugu, 1973 — the loft, proven.</b> To show the <b>AIM-54 Phoenix</b> could defend the fleet at absurd ranges, the US Navy fired one from an F-14 at a target drone about <b>110 nautical miles</b> away. The missile flew this page's profile exactly: pitch up, climb past <b>100,000 ft</b> where drag all but vanishes, cruise across the gap, then nose over and dive onto the drone — the longest air-to-air intercept publicly demonstrated at the time. The motor burned out long before the midpoint; everything after was pure <b>energy management</b> — altitude banked in the climb, cashed in the dive. Half a century on, AMRAAM, R-37M and <a data-goto="propulsion">Meteor</a> ride the same arc. The physics never expired.</div>
      <div class="workex"><b>What the dive buys back.</b> A missile coasts over apogee at 20 km doing Mach 2.5 — sound speed there is <span class="m">≈295 m/s</span>, so <span class="m">v = 2.5 × 295 ≈ 737 m/s</span>. It noses over and trades 10 km of altitude for speed. Lossless exchange: <span class="m">v'² = v² + 2gΔh = 737² + 2 × 9.81 × 10,000 ≈ 543,200 + 196,200 = 739,400 m²/s²</span>, so <span class="m">v' ≈ 860 m/s</span>. At 10 km sound speed is <span class="m">≈299.5 m/s</span>, giving <span class="m">Mach ≈ 860 / 299.5 ≈ 2.87</span> — the dive returned about <span class="m">+123 m/s</span> without burning a gram of propellant. And the cruise leg was cheap to begin with: at 20 km, density is <span class="m">0.089 / 1.225 ≈ 7%</span> of sea level, so at the same true airspeed the missile pays roughly 7% of the drag a sea-level dash would.</div>`,
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
      launch mass − empty mass. See the cutaways in <a data-goto="motors">Rocket Motors Up Close</a>.</p>
      <div class="lore"><b>The ramjet gamble.</b> In 2000 Britain had to choose its next BVR missile. Raytheon offered an evolved AMRAAM — proven solid rocket, low risk. A six-nation European team offered <b>Meteor</b>, built around a throttleable <b>ducted rocket</b> that had never powered an operational air-to-air missile. The physics case was seductive: a solid spends its energy in seconds and then coasts; an air-breather sips oxidizer from the atmosphere and arrives at the merge still under power. Britain took the gamble — and paid in time: Meteor didn't reach operational service until 2016, on Swedish Gripens, sixteen years after selection. The payoff was the cruise-then-sprint energy management that makes Meteor the no-escape-zone benchmark every other AAM is measured against. Sometimes the harder motor is the right motor.</div>
      <div class="workex"><b>Worked example — the impulse budget of a boost-sustain motor.</b> An AMRAAM-class motor carries <span class="m">50 kg</span> of propellant at <span class="m">Isp = 235 s</span>. Total impulse: <span class="m">50 × 235 × 9.81 ≈ 115,270 N·s</span>. Spend <span class="m">22 kN × 3 s = 66,000 N·s</span> on the boost, and the sustain grain inherits the remainder: <span class="m">115,270 − 66,000 = 49,270 N·s</span> — which at <span class="m">5 kN</span> buys <span class="m">49,270 / 5,000 ≈ 9.9 s</span> of sustain. The ideal drag-free speed gain, launching at <span class="m">152 kg</span> and burning down to <span class="m">102 kg</span>: <span class="m">Δv = 235 × 9.81 × ln(152/102) ≈ 2,305 × 0.399 ≈ 920 m/s</span> — roughly +3 Mach at high altitude, before drag takes its cut. This is exactly the thrust-curve-area = propellant × Isp × g₀ bookkeeping the Forge enforces.</div>`,
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
      hump / the sustained plateau on the Mach chart — the hardware in these cutaways, made real.</p>
      <div class="lore"><b>The ramjet's combat debut, 1973.</b> The Soviet <b>2K12 Kub</b> (NATO: <b>SA-6 Gainful</b>) was built exactly like the cutaway above: a solid booster burned first, then its emptied casing became the <b>ramjet combustor</b>, with four <b>intakes</b> feeding it air the rest of the way. When Egypt and Syria unleashed it in the October 1973 Yom Kippur War, Israeli pilots met a missile that was <i>still under power</i> when it arrived — no coast phase to out-turn — and the radar warning receivers of the day gave little or no alert. Losses in the opening days were brutal, and diving away from the Kub dropped jets straight into ZSU-23-4 gun range. The lesson has held for fifty years: sustained thrust in the endgame, not peak speed, is what shrinks a <a data-goto="defence">defence</a> — the same logic that produced Meteor.</div>
      <div class="workex"><b>Worked example — why air-breathing wins on fuel.</b> Total impulse = propellant mass × g₀ × I<sub>sp</sub>. Give two missiles the same <span class="m">100 kg</span> of propellant. A solid rocket at a textbook <span class="m">I<sub>sp</sub> ≈ 250 s</span>: <span class="m">100 × 9.81 × 250 = 245,250 N·s ≈ 245 kN·s</span>. A ramjet at a textbook <span class="m">I<sub>sp</sub> ≈ 1000 s</span> (class figure — the oxidiser comes free from the atmosphere): <span class="m">100 × 9.81 × 1000 = 981,000 N·s ≈ 981 kN·s</span> — four times the impulse from the same tank. Now spend it the way the hardware does: the rocket dumps its impulse in ~10 s of boost (<span class="m">245,250 / 10 ≈ 24.5 kN</span> of brute thrust), while the ramjet meters its out over ~200 s (<span class="m">981,000 / 200 ≈ 4.9 kN</span>) — modest thrust that never stops. That is the arithmetic behind "still under power at the merge".</div>`,
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
      <h3>Why the fuze has to fire early</h3>
      <p>Fragments are fast, but not instant — and at BVR closing speeds the geometry moves while
      they cross the gap. Drag the miss distance and the closure and watch the required lead:</p>
      <div class="wx" data-widget="fuzegeom"></div>
      <p class="tip">Doctrine note: a missile that misses by 30 m produced a <b>defeat</b>, not a
      malfunction. Almost every "missile defeated" story is geometry + energy + fuzing conspiring —
      exactly the three things every defensive move in this academy attacks.</p>
      <div class="lore"><b>The shell that thinks — the VT fuze, 1943.</b> The proximity fuze began as a WWII artillery project: a complete <b>radio Doppler sensor</b> squeezed into a shell nose, its vacuum tubes built to survive gun launch at roughly <b>20,000 g</b> while spinning hundreds of times per second. The Allies guarded it like the atomic bomb — for most of the war it was fired only <b>over water</b>, so no dud could be picked apart on enemy soil. It drew first blood in January 1943, when the cruiser <b>USS Helena</b> downed a Japanese dive bomber near Guadalcanal. In summer 1944, VT-fuzed guns slaved to radar-directed predictors gutted the <b>V-1</b> streams over southern England; that December, cleared at last for land use, airbursts over the Ardennes caught German infantry in the open. Every proximity fuze in this sim is that shell's descendant.</div>
      <div class="workex"><b>Worked example — why the fuze must aim ahead.</b> Take a near-head-on intercept: closure <span class="m">V<sub>c</sub> = 1,500 m/s</span>, miss distance <span class="m">10 m</span>, fragment velocity <span class="m">V<sub>f</sub> = 2,000 m/s</span>. Fragment fly-out time to the target's track: <span class="m">10 / 2,000 = 5 ms</span>. In those 5 ms the geometry keeps moving: <span class="m">1,500 m/s × 0.005 s = 7.5 m</span> of closure. Detonate exactly at closest approach and the frag ring arrives 7.5 m behind a target that has already passed — so the fuze fires early and skews the pattern forward along the crossing line. And the whole decision must fit inside the lethal-zone transit: a 20 m lethal diameter sweeps past in <span class="m">20 / 1,500 ≈ 13 ms</span>. No human reflex lives at this timescale — which is why the fuze, not the pilot, makes the call.</div>`,
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
      <h3>Race the three clocks</h3>
      <p>Every shot is a race between intercept time, battery life and energy death — and the
      <b>shortest clock wins</b>. That is exactly the outcome logic the simulator applies, so you can
      predict a result before you fire it:</p>
      <div class="wx" data-widget="batteryclock"></div>
      <p class="tip">Watch a max-range shot's log: motor burnout in the first seconds, then a
      minutes-long unpowered glide managed entirely by the loft — the battery quietly ticking away
      the whole time. Long-range missiles are mostly <i>gliders with excellent brains</i>.</p>
      <div class="lore"><b>Born on the V-2.</b> The <b>thermal battery</b> is German wartime engineering: chemist <b>Georg Otto Erb</b> built cells whose salt electrolyte sits as a solid, inert lump at room temperature — chemically asleep, effectively unable to self-discharge. Fire a pyrotechnic charge, the salt melts, and full power arrives in a fraction of a second. The <b>V-2</b> rocket carried the idea to war; Allied technical intelligence carried it home after the war, and the US applied it first to artillery <b>proximity fuzes</b>, then to nearly every guided missile since. The genius is the storage problem it solves: a round can hang on a rail for two decades through desert heat and deck frost, then wake at launch with fresh, full-voltage power — exactly once. When the melt refreezes, the fins freeze with it.</div>
      <div class="workex"><b>Worked example — the battery clock vs the chase.</b> Same missile, same launch range, two geometries. Say the missile averages <span class="m">900 m/s</span> over its whole flight, the battery lasts <span class="m">100 s</span>, and you fire at <span class="m">60 km</span>.<br><b>Hot target</b> (head-on at <span class="m">300 m/s</span>): closure is <span class="m">900 + 300 = 1200 m/s</span>, so time to intercept is <span class="m">60,000 / 1200 = 50 s</span> — half the battery still alive at impact.<br><b>Cold target</b> (running at <span class="m">300 m/s</span>): closure drops to <span class="m">900 - 300 = 600 m/s</span>, so <span class="m">60,000 / 600 = 100 s</span> — the intercept lands exactly as the electricity runs out. Any extra drag, any lofted detour, any target acceleration, and the log prints the ballistic message short of the merge. Aspect doesn't just change Pk — it decides whether the battery outlives the flight.</div>`,
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
      <h3>Three seekers, three different range laws</h3>
      <p>Those bullets each hide a different equation, and the differences are what drive doctrine.
      Compare them against the same target:</p>
      <div class="wx" data-widget="seekerrange"></div>
      <p class="tip">Read the SARH bar carefully — it is the one people get wrong. A semi-active
      missile's reach is not a fixed number: the signal depends on <b>both</b> legs of the path,
      <span class="m">∝ σ / (R<sub>t</sub>² · R<sub>m</sub>²)</span>, so as the shooter falls back the
      missile's own acquisition range shrinks with it. That coupling — plus the requirement to keep
      illuminating all the way to impact — is exactly why <a data-goto="midcourse">ARH and the
      pitbull handover</a> replaced SARH for anything that matters.</p>
      <p>Modelled per seeker (all in the Forge): <b>acquisition range</b> (sets pitbull),
      <b>gimbal limit</b> (look-angle before track physically breaks — this is what the notch
      exploits when combined with Doppler), <b>FOV</b>, <b>track bandwidth</b> (agile tracking vs
      noise), <b>angle noise</b> (why terminal G wiggles and misses cluster at a few metres),
      <b>jam susceptibility</b>, <b>burn-through range</b>, and <b>frequency band</b>.</p>
      <div class="lore"><b>The missile pilots begged to remove.</b> In 1967 USAF F-4Ds went to war over North Vietnam carrying the <b>AIM-4 Falcon</b> instead of the Sidewinder, and the seeker design nearly ended careers. Its cooled detector ran on a small charge of coolant: the pilot had to cool the seeker <i>before</i> firing, the supply lasted only a couple of minutes, and once exhausted the missiles were inert lumps for the rest of the sortie — a dogfight timer no pilot wanted. Worse, the Falcon had no <a data-goto="fuzing">proximity fuze</a>: it had to physically strike the target to detonate. Colonel <b>Robin Olds</b>, the 8th Tactical Fighter Wing commander and one of the war's great fighter leaders, loathed it and had his wing's jets rewired to carry Sidewinders again. The lesson is baked into every seeker page in this guide: a seeker is not a spec sheet, it is a <b>contract with the pilot</b> about when, and for how long, it will actually work.</div>`,
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
      pre-emptive programs, kinematics and DIRCM, not just hot flares.</p>
      <div class="lore"><b>The day the rear hemisphere stopped mattering.</b> Early heat-seekers could only smell a hot tailpipe, so a shooter had to fight his way into a narrow cone behind the target — the whole reason classic dogfighting was about getting to someone's six. Cooled seekers changed the geometry: chill the detector and it becomes sensitive enough to see the dimmer, cooler glow of an airframe head-on. The <b>Falklands, 1982</b>, was the public proof. RAF and Royal Navy <b>Sea Harriers</b> carried the all-aspect <b>AIM-9L</b> and could shoot from angles no previous Sidewinder could use; the missile accounted for the great majority of their air-to-air kills at a hit rate several times what Vietnam-era rear-aspect rounds had managed. Argentine pilots, flying faster jets, found there was no longer a safe hemisphere. Every modern <a data-goto="wvr">merge</a> assumption dates from that shift.</div>`,
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
      physics says it should.</p>
      <div class="lore"><b>The Battle of the Beams, 1940.</b> Electronic warfare was invented before radar jamming existed, to fight <i>navigation</i>. British scientific intelligence, led by the young physicist <b>R. V. Jones</b>, deduced that Luftwaffe bombers were flying down intersecting radio beams — <b>Knickebein</b>, later the finer <b>X-Ger&auml;t</b> — to find English cities in cloud and darkness. The counter was not brute force but deception: Britain re-radiated and bent the beams so crews believed they were on track while drifting off it, and bombs fell on empty fields. Germany kept refining; Britain kept spoofing. Every principle in this section was already present in that duel — <b>detect the emission, understand the waveform, then lie to it convincingly</b> rather than merely shout over it. Noise jamming is the crude cousin; deception has always been the deadly one.</div>`,
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
      </ul>
      <div class="lore"><b>The flare became standard because the threat became portable.</b> Chaff was a strategic-bomber problem; flares became everyone's problem when infrared <b>MANPADS</b> arrived. The Soviet <b>9K32 Strela-2</b> (NATO: SA-7 Grail) — a shoulder-launched IR missile a single soldier could carry — appeared in Vietnam in 1972 and in large numbers in the 1973 Yom Kippur War, and suddenly any aircraft flying low over hostile ground was under threat from an infantryman. The response fitted flare dispensers to practically everything that flies, from fighters to airliners in some fleets. The seekers then learned to reject the counter — rise-time discrimination, two-colour ratios, imaging — and the flares answered with spectrally-tailored and kinematically-matched decoys, then <b>DIRCM</b> laser turrets that dazzle the seeker directly. That ladder has been climbing for fifty years and shows no sign of stopping.</div>`,
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
      clutter, so the notch is far less reliable when he's above you.</p>
      <div class="lore"><b>The SAM break, learned the hard way.</b> When SA-2s began killing aircraft over North Vietnam in 1965, crews discovered something the engineers already knew: a huge, fast missile is a poor turner. The <b>S-75</b> flew far quicker than any fighter but pulled only a handful of G, and its guidance had to solve an ever-worsening geometry as range collapsed. So pilots were taught to <i>watch the telephone pole</i> — track it visually, hold the nerve, and at the last moment break hard into and under it, forcing a turn the missile could not physically make. Break too early and it simply re-corrected; break too late and nothing helped. That is the entire logic of the <b>last-ditch break</b> in this section: you are not out-running the missile, you are spending its remaining turn budget at the instant it has the least left.</div>
      <div class="workex"><b>Why late beats early.</b> A missile closing at <span class="m">V<sub>c</sub> = 1000 m/s</span> that can pull <span class="m">20 g</span> needs lateral room to correct. Its achievable sideways displacement in the last <span class="m">t</span> seconds is roughly <span class="m">&frac12;at&sup2; = &frac12; &times; 196 &times; t&sup2;</span>. Break <span class="m">8 s</span> out and it can still shift <span class="m">&asymp;6300 m</span> &mdash; your turn is irrelevant. Break at <span class="m">2 s</span> and it can only manage <span class="m">&asymp;390 m</span>; at <span class="m">1 s</span>, <span class="m">&asymp;98 m</span>. Your jink only has to exceed what is left of <i>that</i> budget, which is why the break is timed in seconds-to-impact, never in kilometres.</div>`,
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
      <b>know your MAR before the merge and honor it</b> — most BVR deaths are late aborts. Next: <a data-goto="brevity">the timeline &amp; brevity</a> that turns MAR into a radio call, and <a data-goto="defence">aspect defeat</a> for when you're committed.</p>
      <div class="lore"><b>Badme front, February 1999.</b> The Eritrea–Ethiopia war put <b>MiG-29s</b> and <b>Su-27s</b> against each other in combat for the first time — and produced the cleanest field demonstration of the <b>No-Escape Zone</b> on record. Open-source accounts count roughly two dozen <b>R-27</b> shots exchanged, with not a single confirmed kill. Nearly every launch went out near maximum range against aware, maneuvering targets; the defenders turned cold and dragged the missiles to energy death, exactly as the abort math says they must. The kills that did come arrived only after the fights collapsed to visual range — short-range, heat-seeking <b>R-73s</b>, fired deep inside anyone's no-escape zone. A shot taken outside the NEZ is a suggestion, not a sentence — provided you know your <a data-goto="brevity">timeline</a>, honor MAR, and go cold in time.</div>
      <div class="workex"><b>Worked example — why the cold turn works.</b> Say the Tactical Brief credits a threat missile with a maximum kinematic reach of <span class="m">Rmax = 80 km</span> head-on at your altitude. The rule of thumb puts the NEZ at 30–50% of that: <span class="m">0.30 × 80 = 24 km</span> to <span class="m">0.50 × 80 = 40 km</span>. He launches at <span class="m">55 km</span> — outside even the pessimistic NEZ. Head-on, with you at <span class="m">300 m/s</span> and the missile averaging <span class="m">900 m/s</span>, closure is <span class="m">900 + 300 = 1200 m/s</span>, so it arrives in <span class="m">55,000 / 1200 ≈ 46 s</span>. Turn cold and closure collapses to <span class="m">900 − 300 = 600 m/s</span>: now it needs <span class="m">55,000 / 600 ≈ 92 s</span> of flight — exactly double. And the constant-speed assumption flatters the missile: its real average speed decays as the tail-chase drags on, stretching that even further. Somewhere in the second minute it goes energy-dead — the moment the brief prints as your recommit time.</div>`,
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
        <li><b>PITBULL</b> — your missile's seeker has gone active and it no longer needs you: the
        moment you are free to turn. In this sim: the diamond on the map and the A-pole moment.
        (Strictly, <b>HUSKY</b> is the earlier call — the missile is approaching active range and can
        still benefit from support — while <b>PITBULL</b> is true autonomy. This guide mostly uses
        PITBULL for the whole handover.)</li>
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
      that's the point of them.</p>
      <div class="lore"><b>Where brevity was born.</b> In the summer of 1940, RAF Fighter Command fought the Battle of Britain through the <b>Dowding system</b>: <b>Chain Home</b> radar and Observer Corps plots flowed into filter rooms, and sector controllers steered squadrons onto raids by voice radio. A crowded, crackling net forced a compressed vocabulary — <b>"angels"</b> for altitude in thousands of feet, <b>"bandits"</b> for hostiles, <b>"vector"</b> for a steer, <b>"buster"</b> for full throttle, <b>"tally-ho"</b> when the enemy was sighted, <b>"pancake"</b> to come home and land. Every code word replaced a sentence, and the seconds saved let one controller run several squadrons at once — ground-controlled interception at scale. Today's multiservice brevity list, SKATE and PITBULL included, is that vocabulary's direct descendant: a pre-briefed shared language so the radio carries decisions, not descriptions.</div>
      <div class="workex"><b>Why one word, not a sentence.</b> Two fighters run at each other, each at about <span class="m">350 m/s</span> (roughly Mach 1.15 at altitude), so closure is <span class="m">2 × 350 = 700 m/s</span>. From commit at <span class="m">60 km</span> to MAR at <span class="m">20 km</span> the fight crosses <span class="m">40 km</span>: <span class="m">40,000 m ÷ 700 m/s ≈ 57 s</span>. In under a minute the flight must sort, shoot, crank, judge pitbull, and make the abort-or-press call — and each <span class="m">10 km</span> bracket of the timeline lasts only <span class="m">10,000 ÷ 700 ≈ 14 s</span>. A full sentence on a shared net costs several of those seconds; "SKATE" costs about one. That ratio is the whole argument for brevity.</div>`,
  },
  {
    id: 'wvr', title: 'The WVR Arena — Energy, Angles & the Merge',
    html: `
      <p>If BVR discipline fails, you arrive at the merge — the visual knife-fight. Different physics
      rules here: turn <b>rate</b>, turn <b>radius</b>, and the energy to keep buying them.</p>
      <h3>Corner velocity — the one number of dogfighting</h3>
      <p>Turn rate ω = g·√(n²−1)/V and radius R = V²/(g·√(n²−1)). Slow down and you can't pull max G
      (lift-limited); speed up and the radius balloons with V². The sweet spot — the lowest speed at
      which you can still <i>reach</i> max G — is <b>corner velocity</b>. (Reach, not sustain: at corner
      most fighters are bleeding energy hard, which is why a corner-speed fight has a clock on it.)
      Sweep it yourself:</p>
      <div class="wx" data-widget="doghouse"></div>
      <h3>The classic fights</h3>
      <ul>
        <li><b>One-circle vs two-circle</b> — this is decided by <i>both</i> pilots, not one: if the
        two fighters turn in <b>opposite</b> directions after the pass they share a single circle
        (<b>one-circle</b>: a radius fight, favouring the tighter turner and HOBS weapons); if they
        turn the <b>same</b> way they carve two circles (<b>two-circle</b>: a rate fight, favouring
        nose authority and energy). Each pilot picks in the first second of the merge, and the
        <i>combination</i> sets the flow — which is why reading his turn matters as much as choosing
        yours.</li>
        <li><b>Energy vs angles</b> — the energy fighter keeps speed/altitude and makes the angles
        fighter bleed dry chasing snapshots; the angles fighter bets on getting the nose (or helmet)
        on first. Sustained G above ~5.5 bleeds speed every second — the sim models exactly this
        bleed on the target.</li>
        <li><b>The vertical</b> — trading altitude for turn performance (and back) is the third
        dimension amateurs forget. The two halves are opposites: a <b>Split-S</b> spends altitude to
        <i>buy</i> speed and tightens the turn with gravity pulling the nose down; an <b>Immelmann</b>
        spends speed to <i>buy</i> altitude, banking energy for later at the cost of being slow at the
        top. Gravity is a motor going down and a tax going up — which one you can afford is an energy
        decision, not a preference.</li>
      </ul>
      <h3>HOBS changed the arithmetic</h3>
      <p>With helmet-cued 90°+ off-boresight missiles (AIM-9X, R-73, PL-10, IRIS-T) both fighters can
      usually generate a valid shot within seconds of any merge — one-circle fights become mutual-kill
      lotteries. Modern doctrine follows: <b>win BVR, don't donate a merge</b>; if merged, fight for
      the first HOBS shot and deny his (keep him out of your rear hemisphere <i>and</i> his helmet
      off you). Try it: set up a 5 km, 90°-aspect merge in the sim with an AIM-9X vs a flare-dropping,
      jinking target.</p>
      <div class="lore"><b>The Archer shock.</b> When Germany reunified in 1990, the Luftwaffe inherited East German MiG-29s — and with them the <b>R-73 "Archer"</b> and its helmet-mounted sight. Flying dissimilar combat from Laage, <b>JG 73</b> pilots simply looked at NATO jets and shot them: in merge after merge, Western fighters with better radars and cockpits lost the WVR fight to a missile cued far off boresight. The West had shelved its own agile-missile and helmet-sight work (AIM-95 Agile, VTAS) in the 1970s as luxuries. Laage reversed the verdict: the direct answers were <b>AIM-9X</b> with the JHMCS helmet and the German-led <b>IRIS-T</b>. The doctrinal lesson became orthodoxy — against a HOBS shooter the merge is a coin flip, so <a data-goto="modern">win before it</a>.</div>
      <div class="workex"><b>Worked example — the corner-velocity arithmetic.</b> A fighter pulls its limit of <span class="m">n = 7.5 G</span>. The load-factor term is <span class="m">√(n² − 1) = √55.25 ≈ 7.43</span>, giving <span class="m">g·√(n² − 1) ≈ 9.81 × 7.43 ≈ 72.9 m/s²</span> of turning acceleration. At <span class="m">V = 150 m/s</span>: rate <span class="m">ω = 72.9 / 150 ≈ 0.486 rad/s ≈ 27.9°/s</span>, radius <span class="m">R = 150² / 72.9 ≈ 309 m</span>. At <span class="m">V = 300 m/s</span> and the same G: <span class="m">ω ≈ 13.9°/s</span>, <span class="m">R ≈ 1,234 m</span>. Doubling speed at fixed G halves the rate and quadruples the circle — a 180° reversal takes <span class="m">≈ 6.5 s</span> slow versus <span class="m">≈ 12.9 s</span> fast. That asymmetry is the whole case for fighting at corner velocity.</div>`,
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
      of why cruise missiles and strike jets hug the ground. This is the heart of <a data-goto="iadsnet">IADS &amp; SEAD</a>.</p>
      <div class="lore"><b>The first shots of Desert Storm were fired under the horizon.</b> The 1991 air campaign opened not with stealth bombers but with helicopters: <b>Task Force Normandy</b>, a joint flight of US Army <b>AH-64 Apaches</b> guided by Air Force special-operations helicopters, crossed into Iraq in the dark at extremely low level and destroyed two <b>early-warning radar</b> sites in the pre-dawn hours of <b>17 January 1991</b>. Flying under the radar horizon meant the sites never saw them coming; destroying those sites tore a corridor in Iraqi coverage through which the main strike packages flowed minutes later. It is the cleanest demonstration of this page's geometry ever staged: the curvature of the Earth is a weapon, and the side that plans around it writes the opening move.</div>
      <div class="workex"><b>How low is low enough?</b> Radar line-of-sight is approximately <span class="m">R &asymp; 4.12 (&radic;h<sub>1</sub> + &radic;h<sub>2</sub>)</span> km with heights in metres. Against a <span class="m">30 m</span> mast: a jet at <span class="m">9000 m</span> is visible from <span class="m">4.12(94.9 + 5.5) &asymp; 414 km</span>. Drop that jet to <span class="m">60 m</span> and it is visible only from <span class="m">4.12(7.7 + 5.5) &asymp; 54 km</span>. Descending has cut the enemy's warning time by nearly <b>87%</b> — the same aircraft, the same radar, a completely different war.</div>`,
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
      the IADS story.</p>
      <div class="lore"><b>Bekaa Valley, 9 June 1982 — the template for every SEAD campaign since.</b> Israel faced a dense Syrian belt of <b>SA-2, SA-3 and SA-6</b> batteries in Lebanon and dismantled it in a matter of hours. The method was systemic, not heroic: unmanned <b>decoy drones</b> flew in first to look like strike aircraft, Syrian batteries switched on their fire-control radars to engage them, and that single act of radiating handed the Israelis exactly what they needed — precise emitter locations for <b>anti-radiation missiles</b> and artillery, while jamming severed the network's coordination. Nearly the whole belt was destroyed, and in the air battle that followed, Syrian fighters launched piecemeal without radar cover were cut apart. The enduring lesson sits at the top of this page: <b>an air-defence network is only as strong as its willingness to emit</b>, and the side that controls that dilemma controls the sky.</div>`,
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
      <div class="wx" data-widget="killchain"></div>
      <div class="lore"><b>Stealth was published, in Russian, and ignored.</b> In <b>1962</b> the Soviet physicist <b>Pyotr Ufimtsev</b> published a paper on the physical theory of diffraction — mathematics predicting how radio waves scatter off <b>edges</b>. It was open literature; Soviet authorities saw no military value in it. In the mid-1970s a Lockheed engineer, <b>Denys Overholser</b>, found the translated work and realised it gave a way to <i>compute</i> the radar return of a shape built from flat panels. The result was a faceted design so ungainly the team nicknamed it the <b>Hopeless Diamond</b> — which became <b>Have Blue</b>, and then the <b>F-117</b>. The jet looks the way it does because 1970s computers could only solve Ufimtsev's equations for flat plates; once computing caught up, stealth aircraft turned into the smooth curves of the B-2 and F-22. An idea nobody wanted rewrote air warfare two decades later.</div>`,
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
      battery/kinematics.</p>
      <div class="lore"><b>27 March 1999 — the night a SAM beat stealth.</b> Over Serbia, an <b>F-117 Nighthawk</b> was shot down by a 1960s-vintage <b>S-125</b> (SA-3) battery commanded by Colonel <b>Zolt&aacute;n Dani</b>. No magic was involved, only discipline and physics: the unit used <b>lower-frequency</b> acquisition radars against which the aircraft's shaping was far less effective, kept its emitters silent for a few seconds at a time so <a data-goto="iadsnet">SEAD</a> could never localise it, relocated constantly, and exploited predictable strike routing and the fleeting moments when the F-117 opened its bomb bay. It remains the only combat loss of an F-117 — and the standing rebuttal to the idea that low observability is invisibility. Stealth buys you a shorter detection range, not a different set of physical laws.</div>`,
  },
  {
    id: 'aero', title: 'Aerodynamics — Drag, Lift, G, and the Atmosphere in Everything',
    html: `
      <p>Every aero force scales with <b>dynamic pressure q = ½ρV²</b>. Air density falls by about
      <b>7× from sea level to 16 km</b> — and roughly <b>14× by 20 km</b> — which is why altitude is a
      weapon and a tax at the same time.</p>
      <h3>The curves your missiles actually fly</h3>
      <p>These are not textbook illustrations: this plot runs the <i>same</i> coefficient model as the
      physics core, so what you see here is literally what the simulator integrates. Sweep Mach and
      angle of attack:</p>
      <div class="wx" data-widget="dragcurve"></div>
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
      </ul>
      <h3>How much G is actually available</h3>
      <p>"Max G" on a data sheet is a structural number. What the missile can <i>really</i> pull is
      whichever is smaller: that structural cap, or what the air will give it. Watch the second one
      collapse with altitude:</p>
      <div class="wx" data-widget="gbudget"></div>
      <div class="workex">Feel what altitude does. Same 300 m/s TAS at sea level
      (<span class="m">ρ = 1.225 kg/m³</span>) vs 12 km (<span class="m">ρ ≈ 0.31 kg/m³</span>):
      <span class="m">q = ½ρV² = 55 kPa</span> vs <span class="m">14 kPa</span> — a <b>4× collapse</b>
      in the force budget for both drag <i>and</i> lift. That one number is why missiles fired high
      fly far (drag ∝ q) yet turn feebly up there (lift ∝ q), why <a data-goto="loft">loft</a> works,
      and why the last-ditch break is best done <b>low, in thick air</b>.</div>
      <div class="lore">The transonic drag spike in the Cd₀ curve above once had a name:
      "the sound barrier". In 1952 NACA's <b>Richard Whitcomb</b> realised drag near Mach 1 follows
      the aircraft's <i>total cross-sectional area distribution</i> — pinch the fuselage where the
      wing sits (the "wasp waist") and the spike shrinks. His <b>area rule</b> turned the Convair
      F-102 from a failure that couldn't pass Mach 1 into a supersonic interceptor within a year, and
      that coke-bottle waist is hiding in every supersonic airframe (and missile) since.</div>`,
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
        <li><b>Tropical (ISA +15)</b> — a warm-day case. <b>Read the name carefully:</b> this is a
        uniform +15 K offset at every altitude, not a genuine tropical column. A real tropical
        atmosphere has a <i>higher and much colder</i> tropopause (~16–17 km at ~195 K, against ISA's
        11 km at 217 K), so above ~11 km real tropical air is <b>colder</b> than standard, not warmer.
        Treat this preset as "warm day", and don't read it as a physically tropical profile.</li>
      </ul>
      <p class="tip">One honest caveat about the ±ΔT days: they follow the standard aviation
      <b>ISA-deviation</b> convention — the <i>pressure</i> column is held at standard and only
      temperature, density and speed of sound are re-derived (ρ = P/RT). That is the normal engineering
      practice, and it is what makes "density altitude" meaningful, but it does mean the offset days
      are not independently re-integrated hydrostatic atmospheres. Only the <b>Standard</b> profile is
      the full 7-layer USSA-1976 integration.</p>
      <h3>The profile, live</h3>
      <p>This runs the <i>same</i> 7-layer integration as the physics core, so these are the exact
      numbers your missiles fly through. Slide the altitude, and switch days to see the whole column
      shift:</p>
      <div class="wx" data-widget="atmoprofile"></div>
      <h3>Why the shape matters more than the numbers</h3>
      <ul>
        <li><b>Density is the master variable.</b> It appears in q = ½ρV², so it scales <i>both</i> drag
        and lift. Thin air simultaneously extends a missile's reach and destroys its turn — the same
        single fact behind <a data-goto="loft">lofting</a>, behind <a data-goto="mar">MAR growing with
        altitude</a>, and behind breaking low.</li>
        <li><b>The tropopause is a real feature, not a label.</b> Temperature falls 6.5 K/km up to
        ~11 km and then simply <b>stops</b> falling. Above 20 km it starts <i>rising</i> again, because
        ozone is absorbing solar UV up there. That kink is why the speed-of-sound curve flattens at
        ~295 m/s through the whole 11–20 km band.</li>
        <li><b>Mach is a temperature measurement in disguise.</b> a = √(γRT) depends on <i>nothing but
        temperature</i> — not pressure, not density. So "Mach 2" at 12 km is ~590 m/s while at sea
        level it is ~680 m/s. Every Mach-limited number in this app is therefore altitude-dependent by
        construction.</li>
        <li><b>Pressure and density are not the same curve.</b> Both fall roughly exponentially, but
        through the isothermal band they fall <i>together</i>, while in the troposphere density falls
        more slowly than pressure because the air is also getting colder (ρ = P/RT with T dropping too).</li>
      </ul>
      <p>Press <b>ATMOS</b> in the app to plot the <i>standard</i> profile — density, speed of sound and
      pressure to 30 km. Then switch the <b>Atmosphere</b> dropdown in panel <b>⑤ CONDITIONS</b>, fire
      the same shot on a hot vs cold day, and watch Rmax move — the atmosphere is a tunable experiment
      variable here, exactly as in professional engagement-modelling tools.</p>
      <div class="lore">The "standard day" — 15 °C, 1013.25 hPa, −6.5 °C per km up to an 11 km
      tropopause — is aviation's shared fiction: no real day matches it, but every performance chart,
      altimeter and this simulator agree to pretend. The <b>US Standard Atmosphere 1976</b> and ICAO's
      ISA are identical up to 32 km, so a Mirage tested over France and an F-16 tested over Nevada
      can be compared on paper. Where the fiction bites is <b>hot-and-high</b>: at La Paz (4,060 m
      elevation) on a warm afternoon, the <i>density altitude</i> can exceed 5,500 m before you've
      left the runway — aircraft that scream at sea level waddle there, and the same missile flies
      measurably farther on less turn. Fighter pilots don't fly the atmosphere they see; they fly
      the density the atmosphere hides.</div>`,
  },
  {
    id: 'hitmiss', title: 'Hit or Miss — How Outcomes Are Decided',
    html: `
      <p>Real missiles rarely body-hit; a <b>proximity fuze</b> fires the warhead inside a lethal
      radius. The sim computes the exact <b>closest approach</b> — including the sub-timestep point
      of a Mach-4 fly-through — and scores:</p>
      <ul>
        <li><b>HIT</b> — closest approach inside the lethal radius (⑤ Conditions slider).</li>
        <li><b>MISS</b> — flew through and opened range; the target out-guessed it.</li>
        <li><b>ENERGY DEPLETED</b> — went subsonic coasting with real range to go: a dead round.
        The usual end of an aborted-against shot.</li>
        <li><b>GROUND / NO INTERCEPT</b> — flew into the earth / ran out the sim clock (extend Max
        time for very long shots — the planner auto-budgets it from the geometry).</li>
      </ul>
      <p>Seeker noise is real, so even clean shots miss by a few metres — that IS homing accuracy.
      A last-second break or a chaff bloom can push closest approach just outside the fuze: the
      target lives by metres, and the charts show you exactly which second decided it.</p>
      <div class="lore"><b>The argument that produced hit-to-kill.</b> During the 1991 Gulf War, Patriot batteries engaging Iraqi <b>Scud</b> ballistic missiles were initially reported as near-perfect. Post-war analysis was far harsher and deeply contested — the central problem being exactly what this page is about: against a large ballistic body, a <b>proximity-fuzed blast-fragmentation warhead</b> detonating nearby often failed to destroy the warhead itself, which continued on a ballistic path to the ground. Intercept and kill turned out to be different events. The engineering answer was <b>hit-to-kill</b>: the <b>PAC-3</b> carries no blast warhead at all and instead steers with tiny attitude thrusters to physically strike the target, converting closing speed into destruction. It is why this simulator scores a <i>closest approach</i> rather than a hit flag — miss distance is the whole story.</div>`,
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
      <h3>The chart Boyd actually drew</h3>
      <p>Altitude and speed are the same thing in different clothes. These contours are lines of
      constant energy height — slide along one for free, climb to the next only with excess thrust:</p>
      <div class="wx" data-widget="psdiagram"></div>
      <p>(The turn-rate side of the same story — rate against radius — lives in
      <a data-goto="wvr">the WVR arena</a> and <a data-goto="energy">corner speed</a>. This page is
      about the <i>fuel</i> for those turns.)</p>
      <ul>
        <li><b>Sustained turn</b> — the hardest turn you can hold at constant speed/altitude (P<sub>s</sub>=0).
        An <b>energy fighter</b> (lots of thrust, low drag) has a big sustained-G circle and dictates
        the fight from range.</li>
        <li><b>Instantaneous turn</b> — the hardest turn you can pull for a moment (lift/structural
        limit), bleeding energy fast. An <b>angles fighter</b> bets on getting the nose (or helmet)
        around first before it runs out of energy.</li>
        <li><b>Corner velocity</b> — the <i>lowest</i> speed at which you can still reach the structural
        G limit, so it is where <b>instantaneous turn rate peaks</b>. Below it you are lift-limited
        (can't reach max G); above it the G cap holds while radius grows. Note this is a point on the
        <i>instantaneous</i> curve — most fighters cannot <b>sustain</b> max G there, so a corner-speed
        turn is a loan against your energy, not an income. The knife-fight speed.</li>
      </ul>
      <p class="tip">Why a BVR pilot cares: a missile is an energy fighter with no engine after burnout.
      Its "sustained G" collapses as it coasts — which is the whole basis of <a data-goto="mar">MAR
      and the no-escape zone</a>. Drag it <a data-goto="defence">low and slow</a> and its P<sub>s</sub>
      goes so negative it can't complete the intercept. EM theory <i>is</i> BVR survival, one layer down.</p>
      <div class="lore"><b>EM theory</b> began as a semi-legal act. In the early 1960s Major <b>John Boyd</b> — the Nellis instructor called "Forty-Second Boyd" for his standing bet that, starting from a position of disadvantage, he could reverse and win inside forty seconds — teamed with civilian mathematician <b>Thomas Christie</b> at Eglin AFB and quietly bootlegged mainframe time to compute P<sub>s</sub> across the whole envelope for American and Soviet fighters. The charts were heresy: the MiG-17 and MiG-21 out-turned the US inventory across broad regions of the plot. The Air Force opened an investigation into the stolen computer hours — then decorated Boyd for the results instead. Those overlays hardened into the thrust-to-weight demands of the <b>F-15</b> and later the lightweight <b>F-16</b>. The doghouse plot above is Boyd's chart, still doing its job.</div>
      <div class="workex">Put numbers on the energy trade. A fighter at <span class="m">5,000 m</span> and <span class="m">300 m/s</span>: <span class="m">E<sub>s</sub> = 5000 + 300² / (2 × 9.81) = 5000 + 4,587 ≈ 9,590 m</span> of energy height. Trade every metre for speed in an ideal dive to the deck and <span class="m">V = √(2 × 9.81 × 9,590) ≈ 434 m/s</span> — about Mach 1.27 at sea level. Same energy state, utterly different fight. Now hold a hard defensive break where <span class="m">P<sub>s</sub> ≈ −40 m/s</span> for ten seconds: you have spent <span class="m">40 × 10 = 400 m</span> of energy height — the zoom-climb you no longer own when the missile arrives.</div>`,
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
      <h3>How long can you actually hold it?</h3>
      <p>"The jet pulls 9 G" is a statement about the airframe. What the <i>pilot</i> can do is a
      curve with two completely different limits on it — pick your kit and sweep the pull:</p>
      <div class="wx" data-widget="gtolerance"></div>
      <div class="workex">Why ~5 G greys you out: your brain sits ≈30 cm above your heart, and that
      blood column costs ≈22 mmHg of pressure at 1 G. At <span class="m">+5 G<sub>z</sub></span> the
      same column costs <span class="m">5 × 22 ≈ 110 mmHg</span> — roughly your entire systolic
      pressure — so arterial pressure <i>at eye level</i> approaches zero. Vision goes first (grey-out
      → tunnel → blackout) because the eye adds its own internal pressure; consciousness follows
      ~4–6 s later when the brain's oxygen reserve runs out. A G-suit squeezes the legs (+~1 G) and
      the <b>AGSM</b> strain (+~3 G) raises the pressure at the pump — that's the whole trick.</div>
      <div class="lore">The reference point for everything G is Col. <b>John Stapp</b>, the USAF
      flight surgeon who rode rocket sleds to test his own limits: on <b>10 December 1954</b> he took
      <b>46.2 G</b> of deceleration at Holloman AFB — eyes hemorrhaging, temporarily blinded, and
      back at work analysing the data. His runs rewrote what "human limits" meant and put shoulder
      harnesses in your car. The modern fight is subtler: G-LOC still kills trained pilots in
      9-G-capable jets, because the aircraft stopped being the limiting component decades before the
      circulatory system did.</div>
      <p class="tip">Design takeaway echoed across this app: automation (datalink midcourse, the
      <a data-goto="mar">Tactical-AI kneeboard</a>, HOBS cueing) mostly buys back <b>human bandwidth</b>
      so the crew can spend attention where it decides the fight.</p>`,
  },
  {
    id: 'weather', title: 'Weather, Environment & the Day',
    html: `
      <p>The same shot on a different day is a different shot. The environment quietly moves every
      number in this sim.</p>
      <h3>Weather does not treat sensors equally</h3>
      <p>This is the asymmetry that decides which weapon is the right tool on a given day. Step
      through the conditions:</p>
      <div class="wx" data-widget="wxsensor"></div>
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
      <div class="lore">Weather has veto power over technology. In the 1991 Gulf War, planners met
      the worst January weather over Iraq in years — repeated low cloud forced thousands of sortie
      changes and spoiled laser-guided attacks that needed a clear line of sight to the target.
      The all-weather sensors got the glory; the <i>schedule</i> belonged to the clouds. It's a
      permanent pattern: radar shots work in the rain, IR shots and laser designation want the
      "clean" day — so a smart air force checks the forecast before it picks its weapons, and a
      smart defender prays for haze.</div>
      <p class="tip">In the sim, the <b>Atmosphere</b> selector (Standard / Hot / Cold / Tropical) is
      your weather knob — the cleanest one-variable experiment in the whole tool.</p>`,
  },
  {
    id: 'rwr', title: 'RWR & Threat Awareness — What the Defender Sees',
    html: `
      <p>Half of surviving BVR is <i>knowing you're being shot at</i>. The <b>Radar Warning Receiver
      (RWR)</b> is the defender's ears — and its limits shape every tactic. Watch the top contact
      escalate search → lock → launch, and learn the symbology:</p>
      <div class="wx" data-widget="rwrscope"></div>
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
      </ul>
      <div class="lore"><b>Born over Hanoi.</b> On 24 July 1965 an SA-2 climbed out of the haze and destroyed a USAF F-4C — the first American aircraft lost to a surface-to-air missile in Vietnam. Crews had no way of knowing a <b>Fan Song</b> radar was tracking them until the "flying telephone pole" arrived. The crash-priority answer was <b>Wild Weasel</b>: two-seat F-100Fs fitted with the <b>APR-25 vector receiver</b> — ancestor of the modern fighter RWR — turning invisible radar beams into bearing strobes and audio tones. Told his new job was to fly ahead of the strike and invite SAMs to shoot at him first, one electronic-warfare officer answered with an acronym — <b>YGBSM</b> — that Weasel squadrons wear on patches to this day. On 22 December 1965 a Weasel crew homed down a Fan Song's own beam and destroyed the site: the receiver had become a weapon.</div>
      <div class="workex"><b>Worked example — the pitbull-to-impact budget.</b> A TWS shot gives you no launch tone; your first RWR cue may be the missile's own seeker going active. Say it acquires you at <span class="m">16 km</span> (open-source estimate class for modern active seekers) while you're pointed hot: your <span class="m">300 m/s</span> plus the missile's <span class="m">1000 m/s</span> average gives closure <span class="m">1300 m/s</span>. Warning time = <span class="m">16,000 / 1300 ≈ 12.3 s</span> — your entire budget to break, notch and dispense. Had a proper LAUNCH tone sounded at <span class="m">40 km</span> of separation, the same closure gives <span class="m">40,000 / 1300 ≈ 31 s</span>. The silent shot doesn't change the missile — it deletes about 60% of your reaction time.</div>`,
  },
  {
    id: 'formations', title: 'Formations & Roles — Fighting as a Team',
    html: `
      <p>Fighters fight in pairs and fours, not alone. The <b>formation</b> is a machine for building
      SA, covering blind spots, and stacking shots — 1+1 in air combat is far more than 2. Flip through
      the common pictures and why each is flown:</p>
      <div class="wx" data-widget="formations"></div>
      <ul>
        <li><b>The element (2-ship)</b> — the atomic unit: a <b>lead</b> who fights and a <b>wingman</b>
        who supports (radar coverage, mutual defence, the second shot). "Lose sight, lose the fight"
        — formations exist so someone always has eyes/sensors on the threat.</li>
        <li><b>The wall</b> — fighters line-abreast, radars overlapping: maximum forward detection and
        simultaneous shots across a front. The classic offensive BVR picture.</li>
        <li><b>Ladder</b> — groups stacked one behind another in <b>range</b> (a trail stagger), so
        shooters and supporters trade roles: the front presents shots while the back stays cold, then
        they swap (the <b>grinder</b>). <b>Champagne</b> is the related three-group picture — <i>two
        groups split in azimuth with a third in trail</i>, so it buys a bracket <b>and</b> depth at
        once. (Strictly these are radar-<b>picture</b> labels from brevity, used for describing both
        your own formation and the bandits' presentation.)</li>
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
      run all of this as one brain.</p>
      <div class="lore"><b>Where pairs and fours came from.</b> Over Spain in the late 1930s, Luftwaffe Condor Legion pilots — <b>Werner Mölders</b> foremost — codified the <b>Rotte</b> (a leader who shoots, a wingman who guards his tail) and the <b>Schwarm</b>: two pairs spread wide, the famous <b>finger-four</b>, so every pilot searched the sky instead of holding station. The RAF entered the Battle of Britain in tight three-ship <b>vics</b>, wingmen staring at the leader's wingtip; German pilots dubbed the neat rows <i>Idiotenreihen</i> — rows of idiots — and bounced them relentlessly. The stopgap "weaver" snaking behind each squadron was routinely the first man to die. The RAF swallowed its pride and copied the finger-four, and every air force since has kept it: the element and wall above are its direct descendants. Formation is not parade drill — it is distributed eyesight. More in <a data-goto="history">Lessons from Real Engagements</a>.</div>`,
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
      <h3>Does this trick still work? — the ladder as a matrix</h3>
      <p>Click any cell. Read each countermeasure <i>across</i> its row and the whole argument of this
      page appears as a colour gradient:</p>
      <div class="wx" data-widget="ccmmatrix"></div>
      <p class="tip">The lesson repeated across the whole domain: a countermeasure buys <b>seconds and
      doubt against the generation it was designed for</b>, and becomes decoration against the next.
      The sim's per-seeker <i>jam susceptibility</i> and <i>burn-through range</i> are exactly where
      this ladder lives — edit them in the Forge and watch a defence work or fail.</p>
      <div class="lore">The entire ladder was climbed once before, in a single year. Britain and Germany each invented <a data-goto="cm">chaff</a> independently — and each withheld it, terrified the other side would copy the trick. The RAF finally broke the seal over <b>Hamburg</b> on the night of 24/25 July 1943: clouds of foil strips, code-named <b>Window</b>, flooded the German <b>Würzburg</b> radars with thousands of false blips, and a defence that had been butchering bombers went blind in a single raid. The counter-countermeasure appeared within months: <b>Würzlaus</b> used the <b>Doppler shift</b> to separate a moving bomber from drifting foil, and <b>Nürnberg</b> let operators listen for propeller modulation in the echo. Chaff versus Doppler discrimination — the first rung of this section's ladder, cut in 1943. Everything since is the same cycle, run faster.</div>
      <div class="workex">Why burn-through is inevitable: your echo makes a two-way trip off the target (power ∝ 1/R⁴) while a self-protection jammer's noise travels one way (∝ 1/R²), so <span class="m">J/S ∝ R²</span> — every halving of range strips <span class="m">≈6 dB</span> off the jammer's advantage. Say the jammer enjoys <span class="m">J/S = 20 dB</span> at 40 km and the seeker can track once <span class="m">J/S ≤ 0 dB</span>. A 20 dB swing needs a range factor of <span class="m">10<sup>20/20</sup> = 10</span>: burn-through at <span class="m">40 / 10 = 4 km</span>. Noise jamming buys the defender time, never immunity — and <b>home-on-jam</b> makes even the waiting free for the attacker.</div>`,
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
      See the link <i>types</i> diagrammed in <a data-goto="datalinks">Datalink Types</a>.</p>
      <div class="lore"><b>From plotting tables to Link 16.</b> Networked air warfare began at sea. Cold War naval task forces needed every ship to hold the <i>same</i> picture, so early tactical data links (the <b>Link 11</b> generation) began automatically exchanging track data between ships and aircraft instead of relying on voice reports and grease-pencil plots. Its descendant, <b>Link 16</b>, added jam-resistant, frequency-hopping, time-slotted messaging — every participant transmitting in its own assigned instants so hundreds of platforms can share one picture without stepping on each other. The tactical consequence is the whole point of this page: once tracks are common property, the aircraft that <b>sees</b> and the aircraft that <b>shoots</b> no longer have to be the same aircraft — and a silent fighter can fight using someone else's eyes.</div>`,
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
      ever emitting.</p>
      <div class="lore"><b>Six missiles, six targets, one radar.</b> The uplink concept had a spectacular proof in <b>November 1973</b>, when a US Navy <b>F-14A</b> demonstrated the AWG-9 and <b>AIM-54 Phoenix</b> combination by launching six missiles in a single pass against six separate drone targets, with multiple confirmed hits. Nothing about that is possible with a <a data-goto="seeker">semi-active</a> weapon: SARH requires the launching radar to floodlight <i>one</i> target continuously until impact, so one shooter equals one engagement. Time-shared track-while-scan plus a <b>command uplink</b> broke that limit — the radar services many tracks and sends each missile its own steering corrections until the missile's own seeker takes over. Every modern multi-shot BVR engagement, including the ones you fly in this simulator, is descended from that idea.</div>`,
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
      you can verify in the sim, not a claim about any particular real engagement.)</p>
      <div class="lore"><b>The arc, in two wars.</b> Air forces entered the 1960s believing the missile had made the gunfight obsolete — and then fought over Vietnam with radar missiles whose combat hit rates were a small fraction of test-range predictions, under rules of engagement that usually demanded a visual identification and therefore erased the BVR advantage entirely. The response was institutional rather than merely technical: dedicated adversary training (the US Navy's Top Gun and the Air Force's Red Flag), reliable all-aspect weapons, airborne early warning, and identification systems good enough to permit shooting at a radar contact. By <b>Desert Storm in 1991</b>, coalition fighters — cued by AWACS, with positive identification available — took the majority of their air-to-air kills at beyond visual range, many without the loser ever manoeuvring. Same physics, opposite outcome: the difference was <b>training, identification and the network</b>.</div>`,
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
    id: 'polegame', title: '♟ The Pole Game — A-pole, F-pole & Cranking',
    html: `
      <p>BVR is a <b>separation</b> problem as much as a shooting problem. You want your missile to
      reach him while <i>you</i> stay as far from his weapons as possible. The currency of that trade is
      the <b>pole</b> — your range from the target at key moments of your own shot.</p>
      <ul>
        <li><b>A-pole</b> — your range from the target the instant your missile goes <a data-goto="midcourse">active
        ("pitbull")</a> and no longer needs you. From here you're free to turn away without orphaning the shot.</li>
        <li><b>F-pole</b> — your range from the target at <b>impact</b>. This is the number that keeps you
        alive: the bigger it is, the farther you were from his merge and his return shot when your missile hit.</li>
      </ul>
      <p>Drag the crank angle and watch both poles grow. This is the single most important habit in BVR.</p>
      <div class="wx" data-widget="fpole"></div>
      <p><b>Why cranking works.</b> Flying <b>hot</b> (straight at him) gets your missile there soonest, but
      you close the whole time — smallest F-pole, maximum exposure. <b>Cranking</b> turns you toward your
      radar's <b>gimbal limit</b> (~50–60° off the nose): the antenna can still see him, so the datalink keeps
      feeding the missile mid-course, but your velocity vector now points mostly <i>across</i> the fight instead
      of into it. Same kill, far more of your own separation. Turn much past the gimbal limit and you <b>drag</b>
      (go cold): F-pole is huge, but you've dropped him and your missile loses mid-course updates.</p>
      <p><b>The moves, in brevity:</b></p>
      <ul>
        <li><b>Crank</b> — turn to the gimbal limit after the shot; keep guiding while opening range. The default.</li>
        <li><b>Pump / drag</b> — turn cold to defeat a return shot (see <a data-goto="mar">MAR</a>), then re-commit
        when his missile is dead. A "SKATE" game plan is launch-and-leave built around this.</li>
        <li><b>Single-side offset</b> — a whole section cranks the <i>same</i> direction so nobody flies through
        the threat's <a data-goto="mar">NEZ</a>, keeping every shooter's F-pole large.</li>
        <li><b>Bracket / grinder</b> — split a section across the bandit's nose so one fighter's crank is the
        other's flanking shot (see <a data-goto="section2ship">fighting as a section</a>).</li>
      </ul>
      <div class="lore"><b>The word comes from the weapon.</b> "F-pole" entered the vocabulary with the
      first generation of fire-and-forget radar missiles, because before them the idea was meaningless: a
      <a data-goto="seeker">semi-active</a> shooter had to illuminate all the way to impact, so his range at
      his own missile's impact was simply <i>zero separation</i> — he was still pointing at the target. The
      moment <b>AMRAAM</b> made the missile autonomous at pitbull, a shooter suddenly owned a decision that
      had never existed: how much of the remaining flight time to spend running away. Everything on this
      page — cranking, the pole study, the whole language of separation — is downstream of that single
      change in what a missile could do without its parent.</div>
      <p class="tip">The sim models this directly. Set a datalink shot, choose shooter support <b>straight vs
      crank</b>, and read the <b>pole study</b> in ◈ TACTICAL-AI — it plots A-pole and F-pole against your crank
      angle so you can see the exact trade for a given weapon and range.</p>`,
  },
  {
    id: 'energy', title: '⚡ Energy & the Merge — Corner Speed, Rate vs Radius',
    html: `
      <p>If BVR fails and you arrive at the <a data-goto="wvr">merge</a>, the fight becomes about
      <b>energy</b>: how much total energy (height + speed) you carry, and how efficiently you spend it turning.
      A turn always costs energy — the question is how much turn you buy per unit spent.</p>
      <p>The master chart is the <b>turn performance envelope</b>. Turn rate (how fast your nose sweeps, °/s)
      trades against speed. Drag the sliders:</p>
      <div class="wx" data-widget="emdiagram"></div>
      <p><b>Corner speed</b> is the star of the show — the slowest speed at which you can still pull your
      structural G limit, and therefore where <b>turn rate peaks</b>. Below it you're <b>lift-limited</b>: the
      wing can't generate enough lift for max G, so your rate falls off even though the <i>radius</i> is tight.
      Above it you're <b>G-limited</b>: lift to spare, but the airframe (and the pilot) cap G, so a faster jet
      just carves a <b>bigger circle</b>. Fly near corner and you own the angles.</p>
      <p><b>Rate fight vs radius fight.</b> Two ways to win a turning fight:</p>
      <ul>
        <li><b>Rate (two-circle)</b> — both fighters turn the same way into a big shared circle; whoever has the
        higher <b>turn rate</b> (nose authority) comes around to a shot first. Lives near corner speed.</li>
        <li><b>Radius (one-circle)</b> — the fighters turn opposite ways; whoever has the smaller <b>radius</b>
        gets nose-on first. Often a slow, low-speed knife-fight — dangerous against a <a data-goto="wvr">HOBS
        + helmet-sight</a> jet, where first-nose = mutual kill.</li>
      </ul>
      <p><b>Vertical = your energy bank.</b> Trading speed for height (a climb) stores energy you can dump back
      into the turn later; pulling into the vertical also tightens the radius as gravity helps bring the nose
      down. This is why energy fighters go up and angles fighters stay level. <b>Specific energy</b>
      E<sub>s</sub> = h + V²/2g captures it in one number — good BVR pilots arrive at the merge with more of it.</p>
      <div class="lore"><b>Corner speed built two fighters.</b> When Boyd's <a data-goto="emtheory">EM
      charts</a> reached the aircraft designers, they turned an argument about opinion into an argument about
      curves. The camp that prized <i>sustained</i> performance — hold energy, dictate from range — pushed
      toward the big, powerful <b>F-15</b>. The camp that prized <i>instantaneous</i> turn and low wing
      loading, Boyd's own "Fighter Mafia" among them, pushed for something small and light that lived near
      corner speed; that argument produced the <b>F-16</b>. Both aircraft are still flying, which is the
      honest verdict: the plot has two axes, and no airframe has ever won both ends of it at once.</div>
      <p>Climb with the altitude slider and watch corner speed rise and peak rate fall: thin air means less lift,
      so turning <b>bleeds you down</b> in both speed and altitude — the fight naturally sinks. That's the same
      density physics behind missile <a data-goto="loft">lofting</a> and <a data-goto="mar">MAR growing with
      altitude</a>.</p>`,
  },
  {
    id: 'section2ship', title: '⋈ Fighting as a Section — Bracket, Grinder & Sort',
    html: `
      <p>Real air combat is not 1-v-1; it's <b>sections</b> (2-ship) and <b>divisions</b> (4-ship) fighting as a
      system. One fighter gives a bandit a single problem he can solve. Two fighters, split correctly, give him
      two problems he <i>can't</i> — and that asymmetry is the whole point.</p>
      <div class="wx" data-widget="grinder"></div>
      <p><b>The bracket.</b> The section splits <b>azimuth</b> — spreads apart laterally so the bandit sits
      between them. He cannot point at both. The instant he commits to one jet (the <b>engaged</b> fighter, who
      drags him and defends), the other (the <b>free</b> fighter) is looking at his flank or stern and takes the
      shot. Keep trading who's engaged and who's free and you "grind" him down — hence <b>grinder</b>.</p>
      <p><b>Roles and comm.</b> The fight runs on tight brevity so both pilots share one picture:</p>
      <ul>
        <li><b>Sort</b> — who shoots whom. A section <b>sorts</b> a group by range ("lead/trail") or azimuth
        ("side-to-side") so two missiles don't chase one bandit while another flies through untouched.</li>
        <li><b>Targeting / "TARGETED"</b> — the formal call locking in each shooter's contact.</li>
        <li><b>Engaged / Free / Press / Cover</b> — who's fighting, who's supporting, who presses in, who watches
        for the second threat.</li>
        <li><b>Bogey dope</b> — the bullseye picture (range/bearing/altitude) that keeps everyone's mental radar
        aligned — see the <a data-goto="rwr">SA & RWR</a> and bullseye notes.</li>
      </ul>
      <p><b>Drill the sort.</b> The lead calls the rule; you assign each shooter their contact. Get it wrong and
      you build a leaker:</p>
      <div class="wx" data-widget="sortgame"></div>
      <p><b>Formations set up the sort.</b> A <b>wall</b> (line abreast) maximizes the bracket and the number of
      radars looking; a <b>box</b> or <b>champagne</b> adds depth so a trailing element can shoot bandits that
      commit on the leaders; an <b>offset/ladder</b> stacks shooters in range. Each is a different answer to the
      same question: how do we present the most shooters while giving the enemy the fewest solvable problems?</p>
      <div class="lore"><b>Loose deuce versus the welded wing.</b> The two-ship is old, but <i>how</i> the
      pair should fight was argued bitterly. The classic model made the wingman a bodyguard: he held
      position, cleared the leader's tail, and rarely shot — a rigid arrangement that spent half the
      formation's firepower on lookout. The US Navy pushed the opposite idea, <b>loose deuce</b>: the two
      fighters fly wide, either may become the engaged fighter, and the roles swap freely depending on who
      has the better picture and the better angle. It asks far more of the wingman — he must think like a
      leader — but it doubles the number of jets that can actually kill something. The lesson generalised:
      a formation is not a shape, it is an <b>agreement about who does what</b>, and the tighter you weld
      the shape, the fewer of your own weapons you can bring to bear.</div>
      <p><b>Why it matters here.</b> This sim flies 1-v-1, but every number it gives you — <a data-goto="mar">MAR</a>,
      <a data-goto="polegame">F-pole</a>, <a data-goto="mar">NEZ</a>, cold-time — is an input to these section
      tactics. The 2-ship simply lets two fighters spend those numbers as a team: one buys F-pole by cranking
      while the other converts, so the section keeps a shot on the bandit without anyone flying into his NEZ.</p>`,
  },
  {
    id: 'wez', title: '◎ The Weapons Engagement Zone',
    html: `
      <p>A missile doesn't have "a range" — it has a <b>zone</b> that breathes with geometry. The single most
      useful mental model in BVR is the <b>WEZ</b>: a set of nested range bands that tell you, right now, whether
      a shot kills, whether he can defeat it, and whether you're too close. Drag the target's aspect and your
      altitude and watch the whole envelope expand and collapse.</p>
      <div class="wx" data-widget="wez"></div>
      <p>The bands, from far to near:</p>
      <ul>
        <li><b style="color:#FFB000">Rmax</b> — the farthest the missile can reach a <i>cooperative</i> (non-reacting)
        target. Big, but soft: it assumes he does nothing.</li>
        <li><b style="color:#22ff9c">NEZ (no-escape zone)</b> — fire inside this and no reaction saves him; even
        turning and running (going cold) can't open enough range before the missile arrives. This is the number
        that actually matters. Between the NEZ edge and Rmax, a shot only connects if he <i>keeps coming</i> — a
        timely <a data-goto="mar">abort</a> at his MAR defeats it.</li>
        <li><b style="color:#FF3D00">Rmin</b> — too close: the motor/fuze can't arm and settle, or the required
        lead exceeds the seeker's gimbal. Point-blank is a dead zone.</li>
      </ul>
      <div class="lore"><b>The number on the brochure is the number nobody shoots at.</b> Every published
      "range" for an air-to-air missile is an <b>Rmax</b> figure: a high-altitude, head-on, co-operative
      shot against a target that never manoeuvres. It is a real number and it is nearly useless, because no
      defender agrees to be co-operative. The gap between that headline and the <b>no-escape zone</b> — often
      only a third to a half of it — is where careers and aircraft are lost, and it is exactly why air forces
      spend so much effort teaching crews to think in <i>zones</i> rather than in a single number. The pattern
      is old: a weapon whose paper envelope is enormous still gets employed, in practice, from far closer in,
      because the shot that counts is the one he cannot simply turn around and out-run.</div>
      <p><b>Aspect is everything.</b> Drag him from <b>hot</b> (nose-on) to <b>cold</b> (running) and the envelope
      shrinks to a fraction — closure was doing half the missile's work, and a tail-chase spends the motor just
      catching up. That collapse is <i>why</i> the whole <a data-goto="polegame">pole game</a> and the abort
      exist. <b>Altitude</b> pushes the other way: thin high air cuts drag, so lofted shots from the tropopause
      stretch every band. The sim renders your specific weapon's version of this as the <b>doghouse</b> and
      <b>NEZ%</b> in ◈ TACTICAL-AI.</p>`,
  },
  {
    id: 'sternconv', title: '↻ Stern Conversion — Winning the Control Zone',
    html: `
      <p>If the fight goes to the merge and you want a guns or rear-aspect IR kill, you're trying to arrive at his
      <b>stern</b> — the rear-quarter <b>control zone</b> where you match his turn, sit inside his circle, and he
      can't bring his nose (or a HOBS missile) back to bear. Getting there is <b>pursuit-curve</b> geometry.</p>
      <div class="wx" data-widget="sternconv"></div>
      <p><b>The three pursuit choices</b> — where you point your nose relative to the bandit:</p>
      <ul>
        <li><b>Lead</b> — nose <i>ahead</i> of him. Closes range fastest and sets up a high-aspect shot, but pull
        lead too early in a turning fight and you cut across his circle and <b>overshoot</b> out front — handing
        him the reversal.</li>
        <li><b>Pure</b> — nose right <i>at</i> him. Feels natural, but in a turn it quietly bleeds you toward an
        overshoot.</li>
        <li><b>Lag</b> — nose <i>behind</i> him. You cut to the <b>inside</b> of his turn circle and slide into the
        control zone without flying out front. This is how you <b>convert</b> to the stern.</li>
      </ul>
      <div class="lore"><b>Korea proved conversion beats raw performance.</b> Over the Yalu in 1950–53 the
      <b>MiG-15</b> held real advantages over the <b>F-86 Sabre</b>: it climbed better and it could operate
      higher, so it frequently chose when to fight. What the Sabre had was a better cockpit view, a
      radar-ranging gunsight, and — decisively — pilots drilled in <b>converting</b> an advantage into a
      firing position rather than merely gaining one. That is precisely the skill on this page: arriving in
      the control zone with the right angle and closure instead of overshooting past it. Every generation
      relearns it. Superior aircraft performance buys you the <i>opportunity</i>; pursuit-curve discipline is
      what turns the opportunity into a shot.</div>
      <p>The animation pulls <b>lag</b> into the rear-quarter cone: nose behind the bandit, matching his turn,
      settling where he can't point back. It's the same line-of-sight logic as <a data-goto="guidance">proportional
      navigation</a> — except here <i>you're</i> the seeker, managing closure and angle so you stop in control
      rather than blowing through. Lose the energy fight (see <a data-goto="energy">corner speed</a>) and you can't
      hold lag; that's why WVR is an energy game first and a pointing game second.</p>`,
  },
  {
    id: 'notchgame', title: '🎯 The Notch — Reflex Trainer',
    html: `
      <p>The <b>notch</b> (beaming) is the defender's sharpest trick against a pulse-Doppler radar or an active
      missile: turn <b>perpendicular</b> to it so your closing velocity falls to near zero, and the radar's own
      <a data-goto="cm">clutter filter</a> throws you out with the ground return. But the window is narrow and the
      timing is everything — too hot and you're still seen, too cold and you pop back out. Train the reflex:</p>
      <div class="wx" data-widget="notchgame"></div>
      <p>Beam the instant closure crosses <b>zero</b>. Each clean break scores; the needle speeds up as you go, and
      40+ points banks XP. In the real fight it's harder still: you must hold the beam through the missile's flight
      while bleeding energy and staying out of its <a data-goto="mar">terminal basket</a>, and a
      <a data-goto="cccm">home-on-jam or memory-track</a> missile may coast through the notch and re-acquire on the
      far side. That's why the notch is a <i>last-ditch</i> tool, not a plan — see <a data-goto="defence">defending
      the shot</a>. The sim scores your notch window automatically in ◈ TACTICAL-AI.</p>`,
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
                     : `<div class="hr-badges hr-badge-hint">Read a full category or ace the check-ride to earn badges →</div>`) +
      (progress.getBookmark() ? `<div class="hr-resume" id="hr-resume">🔖 Resume: ${((HELP_SECTIONS.find(x => x.id === progress.getBookmark()) || {}).title || '').replace(/^[^A-Za-z0-9]+/, '').slice(0, 34)}</div>` : '');
    rankBox.title = 'Rank grows with topics read (60%) and your best check-ride score (40%). Earn XP by reading topics, acing quizzes, solving challenges, the match game, the Decision Drill and the Weapon Codex — XP promotes your WINGS (Bronze → Legend). Show up daily for a sortie streak. Finish a whole category to earn badges, and collect all 16 medals in the Trophy Room. Bookmark a topic to get a resume link here.';
    const rz = document.getElementById('hr-resume');
    if (rz) rz.onclick = () => show(progress.getBookmark());
  };
  window._aegisRankRefresh = refreshRank;   // let the reset button re-render the header
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
      a.innerHTML = `<span class="hn-tick">${progress.isRead(s.id) ? '✓' : ''}</span>${s.title}<span class="hn-bm">${progress.getBookmark() === s.id ? '🔖' : ''}</span>`;
      a.addEventListener('click', () => show(s.id));
      nav.appendChild(a);
    });
  });

  function show(id) {
    if (_activeTeardown) { _activeTeardown(); _activeTeardown = null; }   // stop the previous section's widgets
    const s = HELP_SECTIONS.find(x => x.id === id) || HELP_SECTIONS[0];
    const bm = () => progress.getBookmark() === s.id;
    body.innerHTML = `<div class="sec-toolbar"><button id="bm-toggle" class="bm-btn">${bm() ? '🔖 Bookmarked — your resume point' : '☆ Bookmark this topic'}</button></div><h2>${s.title}</h2>` + s.html;
    body.scrollTop = 0;
    _activeTeardown = mountWidgets(body);            // mount any live widgets in this section
    body.querySelectorAll('[data-goto]').forEach(a => a.addEventListener('click', (e) => {
      e.preventDefault(); show(a.dataset.goto);       // in-guide hyperlinks
    }));
    // bookmark toggle
    const bmBtn = body.querySelector('#bm-toggle');
    if (bmBtn) bmBtn.addEventListener('click', () => {
      progress.setBookmark(s.id);
      bmBtn.textContent = bm() ? '🔖 Bookmarked — your resume point' : '☆ Bookmark this topic';
      bmBtn.classList.toggle('on', bm());
      nav.querySelectorAll('.help-nav-item').forEach(c => {
        const st = c.querySelector('.hn-bm'); if (st) st.textContent = progress.getBookmark() === c.dataset.id ? '🔖' : '';
      });
      refreshRank();
    });
    if (bm()) bmBtn.classList.add('on');
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
