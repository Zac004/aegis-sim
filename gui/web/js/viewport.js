// viewport.js — Three.js 3D engagement viewport.
// Detailed procedural models (finned missile w/ exhaust plume + smoke trail,
// swept-wing fighter that banks into turns w/ afterburner, cruise missile, SAM
// launcher), neon bloom, path tracing, LOS line, lock reticle and playback.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let BLOOM = null;
try {
  const { EffectComposer } = await import('three/addons/postprocessing/EffectComposer.js');
  const { RenderPass } = await import('three/addons/postprocessing/RenderPass.js');
  const { UnrealBloomPass } = await import('three/addons/postprocessing/UnrealBloomPass.js');
  BLOOM = { EffectComposer, RenderPass, UnrealBloomPass };
} catch (e) { console.warn('Bloom unavailable, running without post-processing', e); }

const S = 0.02;                       // metres → scene units
const nedToScene = (n, e, d) => new THREE.Vector3(e * S, -d * S, n * S);
const nedDir = (n, e, d) => new THREE.Vector3(e, -d, n).normalize();
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export class Viewport {
  constructor(canvas) {
    this.canvas = canvas;
    this.result = null;
    this.camMode = 'orbit';
    this._initScene();
    this._animate = this._animate.bind(this);
    requestAnimationFrame(this._animate);
    window.addEventListener('resize', () => this._resize());
  }

  _makeGlowTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.25, 'rgba(255,255,255,0.85)');
    grd.addColorStop(0.6, 'rgba(255,255,255,0.22)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _initScene() {
    const w = this.canvas.clientWidth || 800, h = this.canvas.clientHeight || 600;
    this.glowTex = this._makeGlowTexture();
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(w, h, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x05080e, 0.0008);

    this.camera = new THREE.PerspectiveCamera(52, w / h, 0.1, 9000);
    this.camera.position.set(120, 90, 220);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.08;
    this.controls.maxDistance = 3500;
    this.controls.zoomSpeed = 2.6;          // fast wheel zoom
    this.modelScale = 1.0;

    this.hemi = new THREE.HemisphereLight(0x88bbff, 0x101820, 1.15); this.scene.add(this.hemi);
    this.keyLight = new THREE.DirectionalLight(0xfff0e0, 1.6); this.keyLight.position.set(300, 500, 200); this.scene.add(this.keyLight);
    const rim = new THREE.DirectionalLight(0xff7a30, 0.55); rim.position.set(-250, 90, -220); this.scene.add(rim);

    this._buildEnvironment();

    // dynamic objects (rebuilt per scenario in _setModels)
    this.missile = new THREE.Group(); this.target = new THREE.Group();
    this.shooter = new THREE.Group();
    this.scene.add(this.missile); this.scene.add(this.target); this.scene.add(this.shooter);
    // datalink line (shooter → missile, dashed green)
    this.dlGeom = new THREE.BufferGeometry().setFromPoints([V(0, 0, 0), V(0, 0, 0)]);
    this.dlLine = new THREE.Line(this.dlGeom, new THREE.LineDashedMaterial({
      color: 0x22ff9c, transparent: true, opacity: 0.55, dashSize: 3, gapSize: 2.4 }));
    this.scene.add(this.dlLine); this.dlLine.visible = false;
    this.samSite = this._buildSAMSite(); this.samSite.visible = false; this.scene.add(this.samSite);
    this.plume = null; this.afterburners = [];
    this._setModels(null, null, 'air_to_air');
    this.missile.visible = this.target.visible = false;

    // trajectory lines
    this.missilePathFull = this._makeLine(0x39c0ff, 0.16);
    this.missilePathTrav = this._makeLine(0x7fe0ff, 0.95);
    this.targetPathFull = this._makeLine(0xFF3D00, 0.16);
    this.targetPathTrav = this._makeLine(0xff6a3a, 0.95);
    [this.missilePathFull, this.missilePathTrav, this.targetPathFull, this.targetPathTrav]
      .forEach(l => this.scene.add(l));

    // LOS line
    this.losGeom = new THREE.BufferGeometry().setFromPoints([V(0, 0, 0), V(0, 0, 0)]);
    this.losLine = new THREE.Line(this.losGeom, new THREE.LineBasicMaterial({
      color: 0x00E5FF, transparent: true, opacity: 0.35 }));
    this.scene.add(this.losLine); this.losLine.visible = false;

    // intercept flash
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glowTex, color: 0xffd070, transparent: true, opacity: 0, blending: THREE.AdditiveBlending }));
    this.flash.scale.set(46, 46, 1); this.scene.add(this.flash);

    // particle pools: countermeasures + motor smoke
    this.cmSprites = this._spritePool(60, 0xffb000, THREE.AdditiveBlending);
    this.smokeSprites = this._spritePool(150, 0xb9c4d0, THREE.NormalBlending);
    this.vaporSprites = this._spritePool(70, 0xeaf2ff, THREE.NormalBlending);
    this.cmEvents = []; this._cmNext = 0; this._smokeNext = 0; this._vaporNext = 0;

    // closest-approach marker
    this.caMarker = new THREE.Mesh(
      new THREE.RingGeometry(2.4, 3.2, 48),
      new THREE.MeshBasicMaterial({ color: 0x22ff9c, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    this.caMarker.visible = false; this.scene.add(this.caMarker);

    if (BLOOM) {
      this.composer = new BLOOM.EffectComposer(this.renderer);
      this.composer.addPass(new BLOOM.RenderPass(this.scene, this.camera));
      this.bloom = new BLOOM.UnrealBloomPass(new THREE.Vector2(w, h), 0.65, 0.5, 0.4);
      this.composer.addPass(this.bloom);
    }
    this._resize();
  }

  _spritePool(n, color, blending) {
    const arr = [];
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.glowTex, color, transparent: true, opacity: 0, blending, depthWrite: false }));
      s._born = -1; s._vel = V(0, 0, 0); this.scene.add(s); arr.push(s);
    }
    return arr;
  }

  _buildEnvironment() {
    this.env = { rings: [] };
    const grid = new THREE.GridHelper(5000, 100, 0x1c3a5c, 0x102030);
    grid.material.transparent = true; grid.material.opacity = 0.45;
    this.scene.add(grid); this.env.grid = grid;
    // ground plane (subtle)
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000),
      new THREE.MeshStandardMaterial({ color: 0x0a1522, metalness: 0.1, roughness: 0.95,
        transparent: true, opacity: 0.55 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.2; this.scene.add(ground);
    this.env.ground = ground;
    for (let r = 100; r <= 700; r += 100) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.35, r + 0.35, 128),
        new THREE.MeshBasicMaterial({ color: 0x1d4b6e, transparent: true, opacity: 0.3, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.1; this.scene.add(ring);
      this.env.rings.push(ring);
    }
    const starGeo = new THREE.BufferGeometry();
    const N = 1600, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = 3000 + Math.random() * 3000, th = Math.random() * 6.28, ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = Math.abs(r * Math.cos(ph)) * 0.6 + 60;
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0x9fc4ff, size: 2.2, transparent: true, opacity: 0.65, sizeAttenuation: false }));
    this.scene.add(stars); this.env.stars = stars;
  }

  // ── environment themes (map background) ─────────────────────────────────────
  setTheme(key) {
    const THEMES = {
      night:  { bg: null,     fog: 0x05080e, fd: 8.0e-4, ground: 0x0a1522, gop: 0.55,
                grid: [0x1c3a5c, 0x102030], gridOp: 0.45, ring: 0x1d4b6e, ringOp: 0.3,
                stars: 0.65, hemi: 1.15, key: 1.6, keyCol: 0xfff0e0 },
      dawn:   { bg: 0x2b2033, fog: 0x2b2033, fd: 6.0e-4, ground: 0x201822, gop: 0.9,
                grid: [0x6e5a80, 0x372c44], gridOp: 0.5, ring: 0x9a6a80, ringOp: 0.35,
                stars: 0.25, hemi: 1.25, key: 2.0, keyCol: 0xffb080 },
      day:    { bg: 0x8fb2d4, fog: 0x8fb2d4, fd: 3.5e-4, ground: 0x66805f, gop: 1.0,
                grid: [0x2f4a6e, 0x4f6d8c], gridOp: 0.55, ring: 0x2f4f6f, ringOp: 0.45,
                stars: 0.0, hemi: 1.75, key: 2.2, keyCol: 0xffffff },
      arctic: { bg: 0xd3dce6, fog: 0xd3dce6, fd: 4.5e-4, ground: 0xe9eef4, gop: 1.0,
                grid: [0x6e8299, 0xa3b4c6], gridOp: 0.6, ring: 0x7f95ab, ringOp: 0.5,
                stars: 0.0, hemi: 1.85, key: 2.0, keyCol: 0xffffff },
    };
    const t = THEMES[key] || THEMES.night;
    this.scene.background = t.bg === null ? null : new THREE.Color(t.bg);
    this.scene.fog.color.setHex(t.fog); this.scene.fog.density = t.fd;
    this.env.ground.material.color.setHex(t.ground);
    this.env.ground.material.opacity = t.gop;
    // GridHelper colours are baked into vertex attributes → rebuild it
    const old = this.env.grid; this.scene.remove(old); old.geometry.dispose(); old.material.dispose();
    const grid = new THREE.GridHelper(5000, 100, t.grid[0], t.grid[1]);
    grid.material.transparent = true; grid.material.opacity = t.gridOp;
    this.scene.add(grid); this.env.grid = grid;
    this.env.rings.forEach(r => { r.material.color.setHex(t.ring); r.material.opacity = t.ringOp; });
    this.env.stars.visible = t.stars > 0;
    this.env.stars.material.opacity = t.stars;
    this.hemi.intensity = t.hemi;
    this.keyLight.intensity = t.key; this.keyLight.color.setHex(t.keyCol);
    document.getElementById('viewport').classList.toggle('light-theme', key === 'day' || key === 'arctic');
  }

  // ── model display scale (visual clarity ↔ true scale) ──────────────────────
  setModelScale(f) {
    this.modelScale = f;
    if (this._mBase) this.missile.scale.setScalar(this._mBase * f);
    if (this._tBase) this.target.scale.setScalar(this._tBase * f);
    if (this._sBase) this.shooter.scale.setScalar(this._sBase * f);
  }

  // ── slider-driven camera zoom (t: 0 = far, 1 = close) ──────────────────────
  setZoom(t) {
    const dist = 3000 * Math.pow(20 / 3000, t);   // log scale 3000 → 20 units
    const dir = this.camera.position.clone().sub(this.controls.target);
    if (dir.lengthSq() < 1e-6) dir.set(1, 0.6, 1);
    dir.setLength(dist);
    this.camera.position.copy(this.controls.target).add(dir);
  }

  // ── material helpers ───────────────────────────────────────────────────────
  _metal(color, rough = 0.4, metal = 0.75) {
    return new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough });
  }
  _emis(color, intensity = 1.2) {
    return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity,
      metalness: 0.3, roughness: 0.4 });
  }
  _glass() {
    return new THREE.MeshStandardMaterial({ color: 0x113344, emissive: 0x0a2a3a, emissiveIntensity: 0.5,
      metalness: 0.9, roughness: 0.08, transparent: true, opacity: 0.75 });
  }
  // flat swept/tapered lifting surface from 4 corner points (body frame, +Z fwd)
  _panel(pts, mat) {
    const g = new THREE.BufferGeometry();
    const v = new Float32Array([
      pts[0].x, pts[0].y, pts[0].z, pts[1].x, pts[1].y, pts[1].z, pts[2].x, pts[2].y, pts[2].z,
      pts[0].x, pts[0].y, pts[0].z, pts[2].x, pts[2].y, pts[2].z, pts[3].x, pts[3].y, pts[3].z,
    ]);
    g.setAttribute('position', new THREE.BufferAttribute(v, 3)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.castShadow = true; return m;
  }
  // body of revolution from a [radius, station] profile, axis along +Z
  _lathe(profile, mat, seg = 26) {
    const pts = profile.map(p => new THREE.Vector2(Math.max(p[0], 1e-4), p[1]));
    const g = new THREE.LatheGeometry(pts, seg);
    g.rotateX(Math.PI / 2);  // Y-axis (lathe) → Z (forward)
    return new THREE.Mesh(g, mat);
  }
  // extruded lifting surface with real thickness + beveled edges.
  // pts2d: [[span(x), chord(z)], ...] outline; lies in the XZ plane.
  _wing(pts2d, thickness, mat) {
    const shape = new THREE.Shape();
    shape.moveTo(pts2d[0][0], pts2d[0][1]);
    for (let i = 1; i < pts2d.length; i++) shape.lineTo(pts2d[i][0], pts2d[i][1]);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: thickness, bevelEnabled: true, bevelThickness: thickness * 0.4,
      bevelSize: thickness * 0.5, bevelSegments: 1 });
    geo.rotateX(Math.PI / 2);          // shape-Y → world-Z (chord)
    geo.translate(0, thickness / 2, 0);
    const m = new THREE.Mesh(geo, mat); m.castShadow = true; return m;
  }

  _col(hex) { return new THREE.Color(hex || '#cccccc'); }
  _shade(hex, f) { return this._col(hex).multiplyScalar(f); }

  // ── INTERCEPTOR MISSILE ────────────────────────────────────────────────────
  _buildInterceptor(sprite, color, accent) {
    const g = new THREE.Group();
    const isSAM = sprite === 'sam_heavy', slim = sprite === 'cruise_dart';
    const L = isSAM ? 13 : slim ? 10.5 : 11, R = isSAM ? 0.85 : slim ? 0.48 : 0.62;
    const body = new THREE.MeshStandardMaterial({ color: this._col(color), metalness: 0.6, roughness: 0.35 });
    const dark = new THREE.MeshStandardMaterial({ color: this._shade(color, 0.3), metalness: 0.7, roughness: 0.5 });
    // profile: sharp ogive nose → body → slight boat-tail (stations along +Z)
    const nose = 0.22 * L, tail = 0.06 * L, x0 = -L / 2;
    const prof = [
      [0.001, x0], [R * 0.45, x0 + 0.35 * nose], [R * 0.8, x0 + 0.7 * nose],
      [R, x0 + nose], [R, L / 2 - tail], [R * 0.7, L / 2], [0.001, L / 2 + 0.05],
    ];
    const hull = this._lathe(prof, body); g.add(hull);
    // seeker nose cap (dark) + accent band
    const cap = this._lathe([[0.001, x0], [R * 0.55, x0 + 0.4 * nose], [R * 0.72, x0 + 0.6 * nose]], dark);
    g.add(cap);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.02, R * 1.02, 0.35, 20),
      new THREE.MeshStandardMaterial({ color: this._col(accent), emissive: this._col(accent), emissiveIntensity: 1.0, metalness: 0.3, roughness: 0.4 }));
    band.rotation.x = Math.PI / 2; band.position.z = x0 + nose + 0.5; g.add(band);
    // subtle panel-line rings along the body (section joints)
    for (const zf of [0.30, 0.52, 0.76]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(R * 1.002, 0.02, 6, 40),
        new THREE.MeshBasicMaterial({ color: 0x0d1420, transparent: true, opacity: 0.5 }));
      ring.position.z = x0 + zf * L; g.add(ring);
    }
    // wings (mid) + tail fins (rear), cruciform ×4 — extruded, raked shapes
    const wingMat = new THREE.MeshStandardMaterial({ color: this._shade(color, 0.82), metalness: 0.55, roughness: 0.4 });
    const midZ = 0.12 * L, tailZ = L / 2 - 0.6;
    for (let i = 0; i < 4; i++) {
      const rot = i * Math.PI / 2;
      // mid control wing — long-chord strake
      const mw = this._wing([[R - 0.05, midZ + 1.0], [R - 0.05, midZ - 0.6],
        [R + 1.45, midZ - 1.0], [R + 1.45, midZ - 0.1]], 0.08, wingMat);
      mw.rotation.z = rot; g.add(mw);
      // tail fin — clipped delta with raked tip
      const tf = this._wing([[R - 0.05, tailZ + 1.1], [R - 0.05, tailZ - 0.9],
        [R + 1.6, tailZ - 1.65], [R + 2.05, tailZ - 1.45], [R + 2.05, tailZ - 0.55]], 0.1, wingMat);
      tf.rotation.z = rot; g.add(tf);
    }
    // nozzle (with a dark throat ring for depth)
    const noz = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.72, R * 0.56, 0.5, 20), dark);
    noz.rotation.x = Math.PI / 2; noz.position.z = L / 2 - 0.1; g.add(noz);
    const throat = new THREE.Mesh(new THREE.CircleGeometry(R * 0.5, 18),
      new THREE.MeshBasicMaterial({ color: 0x120a06 }));
    throat.rotation.y = Math.PI; throat.position.z = L / 2 + 0.16; g.add(throat);
    // ── layered exhaust plume: diffuse outer + bright inner + mach diamonds ──
    const plumeGrp = new THREE.Group(); plumeGrp.position.z = L / 2 + 0.2; g.add(plumeGrp);
    const outer = new THREE.Mesh(new THREE.ConeGeometry(R * 0.95, 8.5, 22, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x3a7fd0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
    outer.rotation.x = -Math.PI / 2; outer.position.z = 4.3; plumeGrp.add(outer);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(R * 0.5, 5.5, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xcfeaff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
    inner.rotation.x = -Math.PI / 2; inner.position.z = 2.8; plumeGrp.add(inner);
    // shock diamonds
    const diamonds = [];
    for (let i = 0; i < 3; i++) {
      const d = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0xfff0d0,
        transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      d.scale.set(R * 1.1, R * 1.1, 1); d.position.z = 1.4 + i * 1.4; plumeGrp.add(d); diamonds.push(d);
    }
    this.plume = { grp: plumeGrp, outer, inner, diamonds };
    const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0xdff2ff,
      transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    core.scale.set(4.5, 4.5, 1); core.position.z = L / 2 + 0.5; g.add(core); this.plumeCore = core;
    g.scale.setScalar(4.0);
    return g;
  }

  // ── FIGHTER / BOMBER AIRCRAFT ──────────────────────────────────────────────
  _buildFighter(sprite, color, accent) {
    const g = new THREE.Group();
    const big = sprite === 'bomber_heavy';
    const swept = sprite === 'fighter_swept';
    const L = big ? 22 : 15, R = big ? 1.4 : 1.0;
    const skin = new THREE.MeshStandardMaterial({ color: this._col(color), metalness: 0.55, roughness: 0.5 });
    const dark = new THREE.MeshStandardMaterial({ color: this._shade(color, 0.42), metalness: 0.6, roughness: 0.55 });
    // fuselage: pointed nose, cockpit bulge, taper to tail
    const x0 = -L / 2;
    const prof = [
      [0.001, x0], [R * 0.4, x0 + 0.10 * L], [R * 0.85, x0 + 0.22 * L], [R, x0 + 0.4 * L],
      [R * 0.95, x0 + 0.62 * L], [R * 0.7, x0 + 0.85 * L], [R * 0.55, L / 2], [0.001, L / 2],
    ];
    g.add(this._lathe(prof, skin, 24));
    // nose radome (dark dielectric tip)
    const radome = this._lathe([[0.001, x0], [R * 0.3, x0 + 0.06 * L], [R * 0.42, x0 + 0.10 * L]],
      new THREE.MeshStandardMaterial({ color: this._shade(color, 0.35), metalness: 0.2, roughness: 0.6 }));
    g.add(radome);
    // canopy: teardrop glass + frame arch
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(R * 0.58, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), this._glass());
    canopy.scale.set(1, 0.72, 2.3); canopy.position.set(0, R * 0.55, x0 + 0.26 * L); g.add(canopy);
    const frame = new THREE.Mesh(new THREE.TorusGeometry(R * 0.56, 0.035, 6, 22, Math.PI), dark);
    frame.rotation.z = Math.PI; frame.rotation.y = Math.PI / 2;
    frame.position.set(0, R * 0.55, x0 + 0.30 * L); frame.scale.set(0.72, 1, 1); g.add(frame);
    // dorsal spine fairing
    const spine = new THREE.Mesh(new THREE.CapsuleGeometry(R * 0.22, L * 0.34, 4, 10), skin);
    spine.rotation.x = Math.PI / 2; spine.position.set(0, R * 0.62, -0.02 * L); g.add(spine);
    // engine intakes flanking the fuselage
    for (const s of [1, -1]) {
      const intake = new THREE.Mesh(new THREE.BoxGeometry(R * 0.55, R * 0.8, L * 0.30), dark);
      intake.position.set(s * R * 1.02, -R * 0.12, 0.04 * L); g.add(intake);
      const lip = new THREE.Mesh(new THREE.BoxGeometry(R * 0.58, R * 0.83, 0.14),
        new THREE.MeshBasicMaterial({ color: 0x0a0f16 }));
      lip.position.set(s * R * 1.02, -R * 0.12, 0.04 * L - L * 0.15); g.add(lip);
    }
    // main wings — extruded, with LERX strakes blending into the fuselage
    const wingMat = skin;
    const rootZ = 0.05 * L, span = big ? 13 : 8.5, sweep = big ? 3.5 : swept ? 6.5 : 4.5, chord = big ? 6 : 5;
    for (const s of [1, -1]) {
      const w = this._wing([
        [s * R * 0.9, rootZ + chord * 0.5], [s * R * 0.9, rootZ - chord * 0.5],
        [s * (R * 0.9 + span), rootZ - chord * 0.5 - sweep + 0.6],
        [s * (R * 0.9 + span), rootZ - chord * 0.5 - sweep + 1.8]], 0.16, wingMat);
      g.add(w);
      if (!big) {  // LERX strake forward of the wing root
        const lx = this._wing([[s * R * 0.85, rootZ + chord * 0.5 + 2.6], [s * R * 0.85, rootZ + chord * 0.42],
          [s * (R * 0.9 + 1.6), rootZ + chord * 0.40]], 0.1, wingMat);
        g.add(lx);
        // wingtip missile rail
        const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.7, 8), dark);
        rail.rotation.x = Math.PI / 2; rail.position.set(s * (R * 0.9 + span - 0.1), 0.02, rootZ - sweep + 0.4);
        g.add(rail);
      }
    }
    // horizontal stabilators — extruded
    const tzs = 0.4 * L;
    for (const s of [1, -1]) {
      const t = this._wing([
        [s * R * 0.8, -tzs + 1.8], [s * R * 0.8, -tzs + 0.4],
        [s * (R * 0.8 + span * 0.45), -tzs - 0.8], [s * (R * 0.8 + span * 0.45), -tzs + 0.4]], 0.12, wingMat);
      g.add(t);
    }
    // twin canted vertical tails — extruded, accent-tipped
    for (const s of [1, -1]) {
      const fin = this._wing([[0, -tzs + 1.6], [0, -tzs - 0.6], [3.0, -tzs - 1.6], [3.0, -tzs - 0.2]], 0.1, dark);
      fin.rotation.z = s * (Math.PI / 2 - 0.28);         // stand up, canted outward
      fin.position.set(s * R * 0.5, 0.1, 0); g.add(fin);
      const tip = this._wing([[2.6, -tzs - 1.45], [2.6, -tzs - 0.35], [3.0, -tzs - 1.6], [3.0, -tzs - 0.2]], 0.11,
        new THREE.MeshStandardMaterial({ color: this._col(accent), emissive: this._col(accent), emissiveIntensity: 0.6, metalness: 0.3, roughness: 0.5 }));
      tip.rotation.z = s * (Math.PI / 2 - 0.28); tip.position.set(s * R * 0.5, 0.1, 0); g.add(tip);
    }
    // engine nozzles: outer petals + glowing inner ring + afterburner sprite
    this.afterburners = [];
    for (let i = 0; i < 2; i++) {
      const off = (i - 0.5) * R * 1.1;
      const noz = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.42, R * 0.34, 1.1, 16), dark);
      noz.rotation.x = Math.PI / 2; noz.position.set(off, 0, L / 2 - 0.3); g.add(noz);
      const burn = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.30, R * 0.26, 0.18, 14),
        new THREE.MeshBasicMaterial({ color: 0xff7a30 }));
      burn.rotation.x = Math.PI / 2; burn.position.set(off, 0, L / 2 + 0.25); g.add(burn);
      const ab = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0xff8a3a,
        transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
      ab.scale.set(2.4, 2.4, 1); ab.position.set(off, 0, L / 2 + 1.0); g.add(ab); this.afterburners.push(ab);
    }
    g.scale.setScalar(3.8);
    return g;
  }

  _buildCruise(color, accent) {
    const g = new THREE.Group();
    const L = 9, R = 0.5;
    const skin = new THREE.MeshStandardMaterial({ color: this._col(color), metalness: 0.5, roughness: 0.5 });
    g.add(this._lathe([[0.001, -L / 2], [R * 0.7, -L / 2 + 1], [R, -L / 2 + 2], [R, L / 2 - 1.2], [R * 0.6, L / 2], [0.001, L / 2]], skin));
    for (const s of [1, -1]) {
      g.add(this._wing([[s * R, 0.6], [s * R, -0.4], [s * (R + 3.2), -0.9], [s * (R + 3.2), 0.1]], 0.09, skin));
    }
    const vt = this._wing([[0, -L / 2 + 1.4], [0, -L / 2 + 0.2], [1.6, -L / 2 + 0.4], [1.6, -L / 2 + 1.2]], 0.09, skin);
    vt.rotation.z = Math.PI / 2; vt.position.y = R * 0.55; g.add(vt);
    // ventral intake scoop (turbofan)
    const scoop = new THREE.Mesh(new THREE.BoxGeometry(R * 0.7, R * 0.5, 1.6),
      new THREE.MeshStandardMaterial({ color: this._shade(color, 0.45), metalness: 0.5, roughness: 0.6 }));
    scoop.position.set(0, -R * 0.85, -L / 2 + 2.6); g.add(scoop);
    const ab = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: this._col(accent),
      transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
    ab.scale.set(1.6, 1.6, 1); ab.position.z = L / 2 + 0.6; g.add(ab); this.afterburners = [ab];
    g.scale.setScalar(4.0);
    return g;
  }

  _buildUAV(color, accent) {
    const g = new THREE.Group();
    const L = 11, R = 0.6;
    const skin = new THREE.MeshStandardMaterial({ color: this._col(color), metalness: 0.4, roughness: 0.6 });
    const dark = new THREE.MeshStandardMaterial({ color: this._shade(color, 0.5), metalness: 0.5, roughness: 0.6 });
    // slim fuselage with a bulbous sensor nose
    g.add(this._lathe([[0.001, -L / 2], [R * 0.9, -L / 2 + 1.4], [R, -L / 2 + 3], [R * 0.85, L / 2 - 2], [R * 0.5, L / 2], [0.001, L / 2]], skin, 20));
    const dome = new THREE.Mesh(new THREE.SphereGeometry(R * 0.9, 14, 12), dark);
    dome.position.z = -L / 2 + 1.2; dome.scale.set(1, 0.8, 1); g.add(dome);
    // long straight high-aspect wings (slight upward dihedral)
    const span = 11;
    for (const s of [1, -1]) {
      const w = this._wing([[s * R, 1.2], [s * R, -0.6], [s * (R + span), -0.2], [s * (R + span), 0.9]], 0.11, skin);
      w.rotation.z = -s * 0.06; g.add(w);
    }
    // V-tail — extruded, canted 40°
    for (const s of [1, -1]) {
      const vt = this._wing([[0, -L / 2 + 1.6], [0, -L / 2 + 0.2], [2.6, -L / 2 + 0.5], [2.6, -L / 2 + 1.4]], 0.09, dark);
      vt.rotation.z = s * (Math.PI / 2 - 0.7); vt.position.set(s * R * 0.3, 0.1, 0); g.add(vt);
    }
    const ab = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: this._col(accent),
      transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }));
    ab.scale.set(1.4, 1.4, 1); ab.position.z = L / 2 + 0.4; g.add(ab); this.afterburners = [ab];
    g.scale.setScalar(3.6);
    return g;
  }

  _buildSAMSite() {
    const g = new THREE.Group();
    const base = this._metal(0x2f3a2e, 0.85, 0.2);
    const truck = new THREE.Mesh(new THREE.BoxGeometry(6, 2.2, 12), base); truck.position.y = 1.4; g.add(truck);
    for (const x of [-2, 2]) for (const z of [-4, 0, 4]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.8, 12), this._metal(0x111417, 0.9, 0.1));
      wheel.rotation.z = Math.PI / 2; wheel.position.set(x, 0.9, z); g.add(wheel);
    }
    // crew cab up front
    const cab = new THREE.Mesh(new THREE.BoxGeometry(5.4, 2.0, 2.6), this._metal(0x39452f, 0.8, 0.2));
    cab.position.set(0, 2.4, 5.4); g.add(cab);
    const glassStrip = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.6, 0.1), this._glass());
    glassStrip.position.set(0, 2.8, 4.05); g.add(glassStrip);
    // erected launch canisters (4, angled up) with dark end caps
    const rail = new THREE.Group(); rail.position.set(0, 2.6, -1);
    for (let i = 0; i < 4; i++) {
      const can = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 9), this._metal(0x3c4636, 0.8, 0.25));
      can.position.set((i - 1.5) * 1.35, 0, 0); rail.add(can);
      const capEnd = new THREE.Mesh(new THREE.BoxGeometry(1.14, 1.14, 0.18), this._metal(0x14181f, 0.9, 0.1));
      capEnd.position.set((i - 1.5) * 1.35, 0, 4.55); rail.add(capEnd);
    }
    rail.rotation.x = -1.1; g.add(rail);
    // engagement radar mast + dish (slow spin in _animate)
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 2.2, 10), this._metal(0x2a3325, 0.8, 0.2));
    mast.position.set(0, 3.6, 8.2); g.add(mast);
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.14, 20, 1, false),
      this._metal(0x46523c, 0.7, 0.3));
    dish.rotation.z = Math.PI / 2; dish.rotation.x = 0.5;
    dish.position.set(0, 4.9, 8.2); g.add(dish);
    this.samDish = dish;
    g.scale.setScalar(3.0);
    return g;
  }

  _setModels(missileVisual, targetVisual, engagementType, shooterVisual) {
    const mv = missileVisual || { sprite: 'aam_slender', color: '#d9dde3', accent: '#ffb000' };
    const tv = targetVisual || { sprite: 'fighter_delta', color: '#8b95a3', accent: '#00e5ff' };
    const isSAM = engagementType === 'surface_to_air';
    // rebuild missile
    this._disposeGroup(this.missile);
    const nm = this._buildInterceptor(mv.sprite, mv.color, mv.accent);
    this.missile.add(...nm.children);
    this._mBase = nm.scale.x;
    // rebuild target by sprite kit
    this._disposeGroup(this.target); this.afterburners = [];
    let nt;
    if (tv.sprite === 'cruise_missile') nt = this._buildCruise(tv.color, tv.accent);
    else if (tv.sprite === 'uav_recon') nt = this._buildUAV(tv.color, tv.accent);
    else nt = this._buildFighter(tv.sprite, tv.color, tv.accent);
    this.target.add(...nt.children);
    this._tBase = nt.scale.x;
    const tBurn = this.afterburners;
    // rebuild shooter (airborne launcher; hidden for ground SAM shots)
    this._disposeGroup(this.shooter);
    if (!isSAM) {
      const sv = shooterVisual || { sprite: 'fighter_delta', color: '#9fb2c8', accent: '#00e5ff' };
      const ns = this._buildFighter(sv.sprite, sv.color, sv.accent);
      this.shooter.add(...ns.children);
      this._sBase = ns.scale.x;
      this.afterburners = [...tBurn, ...this.afterburners];  // both craft flicker
    } else {
      this.afterburners = tBurn;
      this._sBase = 0;
    }
    this.setModelScale(this.modelScale || 1.0);   // re-apply user display scale
    this.samSite.visible = isSAM;
    this.shooter.visible = !isSAM;
  }
  _disposeGroup(grp) {
    [...grp.children].forEach(c => {
      grp.remove(c);
      c.traverse?.(o => { o.geometry?.dispose?.(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose?.()); });
    });
  }

  _makeLine(color, opacity) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
    return new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
  }

  // ── load a simulation result ──────────────────────────────────────────────
  setResult(result) {
    this.result = result;
    const meta = result.meta || {};
    this._setModels(meta.missile_visual, meta.target_visual,
      result.engagement_type || 'air_to_air', meta.shooter_visual);
    const ch = result.channels; const n = ch.t.length;
    this.hasShooter = !!(ch.sx && ch.sx.some((v, i) => v !== 0 || ch.sy[i] !== 0));
    this.mPts = []; this.tPts = []; this.sPts = [];
    for (let i = 0; i < n; i++) {
      this.mPts.push(nedToScene(ch.mx[i], ch.my[i], ch.mz[i]));
      this.tPts.push(nedToScene(ch.tx[i], ch.ty[i], ch.tz[i]));
      if (this.hasShooter) this.sPts.push(nedToScene(ch.sx[i], ch.sy[i], ch.sz[i]));
    }
    this.shooter.visible = this.hasShooter && result.engagement_type !== 'surface_to_air';
    this._setLine(this.missilePathFull, this.mPts);
    this._setLine(this.targetPathFull, this.tPts);
    this.missile.visible = this.target.visible = true;
    this.losLine.visible = true;

    if (meta.launch_position) {
      const lp = meta.launch_position;
      this.samSite.position.copy(nedToScene(lp[0], lp[1], lp[2]));
    }

    this.cmEvents = (result.events || [])
      .filter(e => e.type === 'countermeasure')
      .map(e => ({ t: e.t, cm: e.cm || 'flare', count: Math.min(e.count || 4, 10), fired: false }));
    [...this.cmSprites, ...this.smokeSprites].forEach(s => { s._born = -1; s.material.opacity = 0; });
    this._cmNext = this._smokeNext = 0; this._lastSeekT = null;

    let iCA = 0;
    for (let i = 1; i < n; i++) if (ch.range[i] < ch.range[iCA]) iCA = i;
    this.iCA = iCA;
    this.caMarker.position.copy(this.mPts[iCA].clone().add(this.tPts[iCA]).multiplyScalar(0.5));
    this.caMarker.material.color.setHex(result.outcome === 'HIT' ? 0x22ff9c : 0xff3d00);
    this.caMarker.visible = false;

    const box = new THREE.Box3().setFromPoints([...this.mPts, ...this.tPts]);
    const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    this.center = c; this.extent = Math.max(size.x, size.y, size.z, 40);
    this.controls.target.copy(c);
    this.camera.position.set(c.x + this.extent * 0.8, c.y + this.extent * 0.55, c.z + this.extent * 1.05);
    this.flash.material.opacity = 0;
    this.seek(0);
  }

  _setLine(line, pts, count) {
    const n = count ?? pts.length;
    const arr = new Float32Array(Math.max(n, 1) * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = pts[i].x; arr[i * 3 + 1] = pts[i].y; arr[i * 3 + 2] = pts[i].z; }
    line.geometry.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    line.geometry.setDrawRange(0, n);
    line.geometry.attributes.position.needsUpdate = true;
    line.geometry.computeBoundingSphere();
  }

  // ── seek to a sample index ─────────────────────────────────────────────────
  seek(i) {
    if (!this.result) return;
    const ch = this.result.channels; const n = ch.t.length;
    i = Math.max(0, Math.min(n - 1, Math.round(i)));
    this.index = i;
    const mp = this.mPts[i], tp = this.tPts[i];
    this.missile.position.copy(mp); this.target.position.copy(tp);

    // missile attitude from quaternion (nose = body-x in NED)
    const nDir = this._noseDir(ch, i);
    this.missile.quaternion.setFromUnitVectors(V(0, 0, 1), nDir);

    // target: nose along velocity + bank into the turn
    const iN = Math.min(i + 1, n - 1), iP = Math.max(i - 1, 0);
    let tDir = this.tPts[iN].clone().sub(this.tPts[iP]);
    if (tDir.lengthSq() < 1e-6) tDir = V(0, 0, 1); else tDir.normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), tDir);
    // bank angle from horizontal turn rate
    const vP = this.tPts[iN].clone().sub(this.tPts[iP]);
    const hd0 = Math.atan2(this.tPts[i].x - this.tPts[iP].x, this.tPts[i].z - this.tPts[iP].z);
    const hd1 = Math.atan2(this.tPts[iN].x - this.tPts[i].x, this.tPts[iN].z - this.tPts[i].z);
    let dh = hd1 - hd0; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
    const bank = Math.max(-1.4, Math.min(1.4, -dh * 22));
    q.multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), bank));
    this.target.quaternion.copy(q);

    // shooter craft: position + orient along velocity, gentle bank
    if (this.shooter.visible && this.sPts.length) {
      const sp = this.sPts[i];
      this.shooter.position.copy(sp);
      const sN = Math.min(i + 1, n - 1), sP = Math.max(i - 1, 0);
      let sDir = this.sPts[sN].clone().sub(this.sPts[sP]);
      if (sDir.lengthSq() > 1e-8) {
        sDir.normalize();
        const sq = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), sDir);
        const h0 = Math.atan2(this.sPts[i].x - this.sPts[sP].x, this.sPts[i].z - this.sPts[sP].z);
        const h1 = Math.atan2(this.sPts[sN].x - this.sPts[i].x, this.sPts[sN].z - this.sPts[i].z);
        let dh = h1 - h0; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
        sq.multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), Math.max(-1.2, Math.min(1.2, -dh * 22))));
        this.shooter.quaternion.copy(sq);
      }
      // datalink line while midcourse guidance is flowing
      const dlOn = ch.datalink && ch.datalink[i] === 1;
      this.dlLine.visible = dlOn;
      if (dlOn) {
        const dp = this.dlGeom.attributes.position;
        dp.setXYZ(0, sp.x, sp.y, sp.z); dp.setXYZ(1, mp.x, mp.y, mp.z); dp.needsUpdate = true;
        this.dlGeom.computeBoundingSphere();
        this.dlLine.computeLineDistances();
      }
    } else {
      this.dlLine.visible = false;
    }

    // traveled paths
    this._setLine(this.missilePathTrav, this.mPts, i + 1);
    this._setLine(this.targetPathTrav, this.tPts, i + 1);

    // LOS + reticle
    const pa = this.losGeom.attributes.position;
    pa.setXYZ(0, mp.x, mp.y, mp.z); pa.setXYZ(1, tp.x, tp.y, tp.z); pa.needsUpdate = true;
    const locked = ch.locked[i] === 1;
    this.losLine.material.color.setHex(locked ? 0xFF3D00 : 0x00E5FF);
    this.losLine.material.opacity = locked ? 0.5 : 0.22;
    this._updateReticle(tp, locked, ch.jammed[i] === 1);

    // exhaust plume + smoke from thrust
    const thrust = ch.thrust[i] || 0;
    const thrusting = thrust > 10;
    if (this.plume) {
      const f = thrusting ? Math.min(thrust / 8000, 1.4) : 0;
      const fl = 0.85 + 0.15 * Math.random();   // flicker
      this.plume.grp.scale.set(1, 1, 0.65 + f);  // plume length grows with thrust
      this.plume.outer.material.opacity = thrusting ? (0.28 + 0.12 * f) * fl : 0;
      this.plume.inner.material.opacity = thrusting ? (0.6 + 0.25 * f) * fl : 0;
      this.plume.diamonds.forEach((d, k) => {
        d.material.opacity = thrusting && f > 0.55 ? (0.7 - k * 0.18) * fl : 0;  // only supersonic exhaust
      });
      this.plumeCore.material.opacity = thrusting ? (0.7 + 0.3 * Math.random()) : 0;
      this.plumeCore.scale.setScalar(thrusting ? 3.5 + f * 2 : 0);
    }
    // afterburner flicker on the target
    this.afterburners.forEach(ab => { ab.material.opacity = 0.35 + 0.25 * Math.random(); });

    // fire CM bursts + emit smoke as playback advances
    const nowT = ch.t[i];
    if (this._lastSeekT != null && nowT < this._lastSeekT) {
      this.cmEvents.forEach(e => e.fired = false);
      [...this.smokeSprites, ...this.vaporSprites].forEach(s => { s._born = -1; s.material.opacity = 0; });
    }
    if (this._lastSeekT == null || nowT > this._lastSeekT) {
      if (thrusting) this._emitSmoke(mp);
      // wingtip condensation vapour when the target hauls into a hard turn
      const tg = ch.tgload ? ch.tgload[i] : 0;
      if (tg > 5.2) this._emitVapor(this.target, tg);
    }
    this._lastSeekT = nowT;
    this.cmEvents.forEach(e => { if (!e.fired && nowT >= e.t) { e.fired = true; this._spawnCM(e, tp); } });
    this.caMarker.visible = i >= this.iCA;

    this._applyCamera(mp, tp, nDir);
    document.getElementById('vr-time').textContent = ch.t[i].toFixed(2);
    document.getElementById('vr-mach').textContent = ch.mmach[i].toFixed(2);
    document.getElementById('vr-range').textContent = (ch.range[i] / 1000).toFixed(2);
  }

  _emitSmoke(at) {
    const s = this.smokeSprites[this._smokeNext % this.smokeSprites.length]; this._smokeNext++;
    s.position.copy(at); s._born = performance.now();
    s._vel = V((Math.random() - 0.5) * 0.15, 0.05 + Math.random() * 0.1, (Math.random() - 0.5) * 0.15);
    s.material.color.setHex(0xb9c4d0); s.scale.setScalar(2.5);
  }
  _updateSmoke() {
    const now = performance.now();
    this.smokeSprites.forEach(s => {
      if (s._born < 0) return;
      const age = (now - s._born) / 1000, life = 2.6;
      if (age > life) { s.material.opacity = 0; s._born = -1; return; }
      s.position.addScaledVector(s._vel, 1);
      s.material.opacity = Math.max(0, 1 - age / life) * 0.4;
      s.scale.setScalar(2.5 + age * 5);
    });
  }

  _emitVapor(targetGrp, tg) {
    // two puffs, one at each wingtip, briefly — condensation off a hard-turning jet
    const span = 22, intensity = Math.min((tg - 5.2) / 4, 1);
    for (const s of [1, -1]) {
      const sp = this.vaporSprites[this._vaporNext % this.vaporSprites.length]; this._vaporNext++;
      const wing = new THREE.Vector3(s * span, 0, -4).applyQuaternion(targetGrp.quaternion);
      sp.position.copy(targetGrp.position).add(wing);
      sp._born = performance.now(); sp._vel = V(0, 0, 0); sp._peak = 0.28 * intensity;
      sp.scale.setScalar(3);
    }
  }
  _updateVapor() {
    const now = performance.now();
    this.vaporSprites.forEach(s => {
      if (s._born < 0) return;
      const age = (now - s._born) / 1000, life = 0.9;
      if (age > life) { s.material.opacity = 0; s._born = -1; return; }
      s.material.opacity = (s._peak || 0.25) * Math.sin(Math.PI * age / life);  // fade in/out
      s.scale.setScalar(3 + age * 9);
    });
  }

  _spawnCM(ev, at) {
    const color = ev.cm === 'chaff' ? 0xbfe6ff : ev.cm === 'ecm' ? 0x22ff9c : 0xffb000;
    for (let k = 0; k < ev.count; k++) {
      const s = this.cmSprites[this._cmNext % this.cmSprites.length]; this._cmNext++;
      s.material.color.setHex(color); s.position.copy(at); s._born = performance.now();
      s._chaff = ev.cm === 'chaff';
      const spread = ev.cm === 'chaff' ? 0.3 : 1.2;
      s._vel = V((Math.random() - 0.5) * spread, -0.4 - Math.random() * 0.6, (Math.random() - 0.5) * spread);
      s.scale.setScalar(ev.cm === 'chaff' ? 4 : 3.5);
    }
  }
  _updateCM() {
    const now = performance.now();
    this.cmSprites.forEach(s => {
      if (s._born < 0) return;
      const age = (now - s._born) / 1000, life = s._chaff ? 4.0 : 2.2;
      if (age > life) { s.material.opacity = 0; s._born = -1; return; }
      s.position.addScaledVector(s._vel, s._chaff ? 0.12 : 0.5);
      s.material.opacity = Math.max(0, 1 - age / life) * (s._chaff ? 0.55 : 0.85);
      if (s._chaff) s.scale.setScalar(4 + age * 4);
      else s.scale.setScalar(3.5 * (0.75 + 0.25 * Math.random()));
    });
  }

  _noseDir(ch, i) {
    const w = ch.qw[i], x = ch.qx[i], y = ch.qy[i], z = ch.qz[i];
    const nN = 1 - 2 * (y * y + z * z), nE = 2 * (x * y + w * z), nD = 2 * (x * z - w * y);
    const d = nedDir(nN, nE, nD);
    return d.lengthSq() > 1e-6 ? d : V(0, 0, 1);
  }

  _applyCamera(mp, tp, nDir) {
    if (this.camMode === 'orbit') { this.controls.enabled = true; return; }
    this.controls.enabled = false;
    if (this.camMode === 'chase') {
      const back = nDir.clone().multiplyScalar(-46).add(V(0, 14, 0));
      this.camera.position.lerp(mp.clone().add(back), 0.14); this.camera.lookAt(tp);
    } else if (this.camMode === 'side') {
      const mid = mp.clone().add(tp).multiplyScalar(0.5);
      this.camera.position.lerp(V(mid.x, mid.y + this.extent * 0.3, mid.z + this.extent), 0.12); this.camera.lookAt(mid);
    } else if (this.camMode === 'top') {
      const mid = mp.clone().add(tp).multiplyScalar(0.5);
      this.camera.position.lerp(V(mid.x, mid.y + this.extent * 1.3, mid.z), 0.12); this.camera.lookAt(mid);
    }
  }

  _updateReticle(tp, locked, jammed) {
    const rt = document.getElementById('lock-reticle');
    if (!locked) { rt.classList.add('hidden'); return; }
    const v = tp.clone().project(this.camera);
    if (v.z > 1) { rt.classList.add('hidden'); return; }
    const rect = this.canvas.getBoundingClientRect();
    const x = (v.x * 0.5 + 0.5) * rect.width, y = (-v.y * 0.5 + 0.5) * rect.height;
    rt.classList.remove('hidden');
    rt.style.left = x + 'px'; rt.style.top = y + 'px';
    rt.style.borderColor = jammed ? '#FFB000' : '#FF3D00';
    rt.innerHTML = `<span class="tag">${jammed ? 'JAMMED' : 'LOCK'}</span>`;
  }

  setCamera(mode) {
    this.camMode = mode;
    if (mode === 'orbit' && this.center) { this.controls.enabled = true; this.controls.target.copy(this.center); }
  }

  _resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    if (this.composer) this.composer.setSize(w, h);
  }

  setActive(on) {
    this._active = on;
    if (on) this._resize();
  }

  _animate() {
    requestAnimationFrame(this._animate);
    if (this._active === false) return;   // 2D view up — skip 3D render to save CPU
    this.controls.update();
    this._updateCM(); this._updateSmoke(); this._updateVapor();
    if (this.samDish && this.samSite.visible) this.samDish.rotation.y += 0.02;
    if (this.caMarker && this.caMarker.visible) this.caMarker.lookAt(this.camera.position);
    if (this.target && this.target.visible && this.index != null && this.result) {
      this._updateReticle(this.tPts[this.index],
        this.result.channels.locked[this.index] === 1,
        this.result.channels.jammed[this.index] === 1);
    }
    if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
  }
}
