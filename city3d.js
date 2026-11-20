// 地球防衛隊「シティ」の 3Dがめん(three.js): じゆうに うごける まち。ルールは citysim.js。
//   const g = await startCity3D({ kidName, stats, vehicles, specs, coins, done, calm, onSfx, onReward, onBuy, onQuit });
import { createCity, LAYOUT, HALF, RIVER, BRIDGES, riverZ, AIRFIELD, PLAZA, HQ, SPAWN, RAILS, STATION, STATION2, SCHOOL, SCHOOL_POLY, PARK3, PARK3_POLY, MALL_TRESA, MALL_APITA, SHRINE, SOCCER, SOCCER_ZONE, HOME, STORES, ITEMS, storeOf, railDist, roadsOf, roadSD, greens, pitches, CITY_MISSIONS, SHOP as SHOPD, isWater, isAir, VCAT, catalogOf, BOARD, GARAGE, JOB, CROOKS, DEFAULT_OWNED, WEAPONS, DEFAULT_WEAPONS, weaponOf, needText } from './citysim.js';
import { makeCarModel, makeBikeModel, makeAirModel, makePerson, makeWeaponModel, poseLimbs, townsPerson, crookPerson, labelSprite } from './citymodels3d.js';
import { makeVehicleModel } from './vehicle3d.js';
import { makeFx } from './fx3d.js';
import { createPost } from './post3d.js';
import { addBuildings } from './facade3d.js';
import { skyMat, SEA_VS, SEA_FS, envTexture } from './world3d.js';

let T = null;
async function loadThree() { if (!T) T = await import('./vendor/three.module.min.js'); return T; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = (s) => String(s).replace(/[<>&"]/g, '');
let ACTIVE = null;
const MAPR = HALF + 60; // マップの はんぶんの おおきさ(m)

// ---- テクスチャ ----------------------------------------------------------------------------
function groundCanvas(S = 2048) {
  const q = S / 2048; let seed = 99; const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const k = S / (MAPR * 2); const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  const X = (x) => (x + MAPR) * k; const Z = (z) => (z + MAPR) * k; const rect = (x0, z0, x1, z1) => g.fillRect(X(x0), Z(z0), (x1 - x0) * k, (z1 - z0) * k);
  const trace = (pts) => { g.beginPath(); pts.forEach(([x, z], i) => (i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z)))); };
  const poly = (pts, fill) => { trace(pts); g.closePath(); g.fillStyle = fill; g.fill(); };
  g.fillStyle = '#e6d3a0'; rect(-MAPR, -MAPR, MAPR, MAPR);
  g.fillStyle = '#6c6f68'; rect(-HALF - 30, -HALF - 30, HALF + 30, HALF + 30);
  for (let i = 0; i < 9000 * q * q; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,50,0,.07)'; g.fillRect(rnd() * S, rnd() * S, 3 * q, 2 * q); }
  // みどり(こうえん・もり・かわらの くさ)
  for (const gr of greens) poly(gr.poly, gr.kind === 'forest' || gr.kind === 'wood' ? '#3f6a3a' : gr.kind === 'park' || gr.kind === 'garden' ? '#4f7a45' : '#5a8a4c');
  for (const p of pitches) poly(p, '#3f8a3a');
  if (SCHOOL_POLY) poly(SCHOOL_POLY, '#c9a878');
  if (PARK3_POLY) { poly(PARK3_POLY, '#5f9a50'); g.strokeStyle = '#c4b8a0'; g.lineWidth = 2.2 * k; g.lineJoin = 'round'; trace(PARK3_POLY); g.closePath(); g.stroke(); }
  // かわと どて
  const riverPath = (w) => { trace(RIVER.pts); g.lineWidth = w * k; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); };
  g.strokeStyle = '#5d7a4c'; riverPath(RIVER.bank * 2 + 6); g.strokeStyle = '#a9a28c'; riverPath(RIVER.hw * 2 + 14);
  // たてものの あしあと(ちずと ミニマップ用)
  g.fillStyle = '#4b4d53'; for (const b of LAYOUT.buildings) { if (b.kind === 'pillar') continue; g.save(); g.translate(X(b.cx), Z(b.cz)); g.rotate(b.ang); g.fillRect((-b.w / 2) * k, (-b.d / 2) * k, b.w * k, b.d * k); g.restore(); }
  // みち(ほどう→アスファルト→ちゅうおうせん)
  const RL = roadsOf(); g.lineJoin = 'round'; g.lineCap = 'round';
  g.strokeStyle = '#8b8d90'; for (const r of RL) { trace(r.pts); g.lineWidth = r.hw * 2 * k; g.stroke(); }
  g.strokeStyle = '#373c45'; for (const r of RL) { trace(r.pts); g.lineWidth = (r.hw - (r.cls >= 2 ? 1.7 : 0.9)) * 2 * k; g.stroke(); }
  g.setLineDash([9 * k, 8 * k]); g.lineCap = 'butt'; g.strokeStyle = '#f2c230'; for (const r of RL) { if (r.cls < 2 || r.br) continue; trace(r.pts); g.lineWidth = (r.cls >= 3 ? 0.55 : 0.35) * k; g.stroke(); }
  g.setLineDash([]); g.strokeStyle = 'rgba(255,255,255,.7)'; for (const r of RL) { if (r.cls < 3) continue; for (const sgn of [-1, 1]) { g.beginPath(); for (let i = 0; i < r.pts.length; i++) { const a = r.pts[Math.max(0, i - 1)]; const b = r.pts[Math.min(r.pts.length - 1, i + 1)]; const ang = Math.atan2(b[1] - a[1], b[0] - a[0]); const x = r.pts[i][0] - Math.sin(ang) * sgn * (r.hw - 2.1); const z = r.pts[i][1] + Math.cos(ang) * sgn * (r.hw - 2.1); if (i) g.lineTo(X(x), Z(z)); else g.moveTo(X(x), Z(z)); } g.lineWidth = 0.22 * k; g.stroke(); } }
  g.lineCap = 'round';
  // ほんぶの ひろば・じたく・くうこう・モール・サッカーじょう
  g.fillStyle = '#767d88'; rect(PLAZA.x0, PLAZA.z0, PLAZA.x1, PLAZA.z1); g.strokeStyle = '#fff'; g.lineWidth = 2 * k; g.beginPath(); g.arc(X(HQ.x), Z(HQ.z), HQ.r * k, 0, 6.283); g.stroke(); g.save(); g.translate(X(HQ.x), Z(HQ.z)); g.rotate(Math.PI); g.fillStyle = '#e0302a'; g.font = `bold ${26 * k}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('HQ', 0, 0); g.restore();
  g.fillStyle = '#b4655a'; for (let i = 0; i < 5; i++) rect(PLAZA.x0 + 10 + i * 26, PLAZA.z0 + 6, PLAZA.x0 + 30 + i * 26, PLAZA.z0 + 18);
  g.fillStyle = '#8f8d86'; rect(HOME.x0, HOME.z0, HOME.x1, HOME.z1); g.fillStyle = '#4d5058'; rect(HOME.x0 + 6, HOME.z0 + 12, HOME.x1 - 6, HOME.z0 + 48); g.strokeStyle = '#f0f0f0'; g.lineWidth = 0.5 * k; for (let i = 0; i <= 9; i++) { g.beginPath(); g.moveTo(X(HOME.x0 + 12 + i * 10), Z(HOME.z0 + 18)); g.lineTo(X(HOME.x0 + 12 + i * 10), Z(HOME.z0 + 42)); g.stroke(); } g.fillStyle = '#5f8a4a'; rect(HOME.x0 + 4, HOME.z0 + 54, HOME.x1 - 4, HOME.z1 - 4);
  { const zc = (AIRFIELD.z0 + AIRFIELD.z1) / 2; g.fillStyle = '#4a5160'; rect(AIRFIELD.x0, AIRFIELD.z0, AIRFIELD.x1, AIRFIELD.z1); g.fillStyle = '#fff'; for (let x = AIRFIELD.x0 + 20; x < AIRFIELD.x1 - 20; x += 36) rect(x, zc - 1.2, x + 18, zc + 1.2); for (let i = -3; i <= 3; i++) { rect(AIRFIELD.x0 + 4, zc + i * 6 - 1.2, AIRFIELD.x0 + 16, zc + i * 6 + 1.2); rect(AIRFIELD.x1 - 16, zc + i * 6 - 1.2, AIRFIELD.x1 - 4, zc + i * 6 + 1.2); } g.fillStyle = '#ffd23f'; rect(AIRFIELD.x0, AIRFIELD.z0, AIRFIELD.x1, AIRFIELD.z0 + 1.5); rect(AIRFIELD.x0, AIRFIELD.z1 - 1.5, AIRFIELD.x1, AIRFIELD.z1); }
  for (const m of [MALL_TRESA, MALL_APITA]) { g.fillStyle = '#585b62'; rect(m.x0, m.z0, m.x1, m.z1); g.strokeStyle = '#eee'; g.lineWidth = 0.3 * k; for (let x = m.x0 + 6; x < m.x1 - 4; x += 6) { g.beginPath(); g.moveTo(X(x), Z(m.z0 + 4)); g.lineTo(X(x), Z(m.z0 + 22)); g.stroke(); } }
  { const sx = SOCCER_ZONE.cx; const sz = SOCCER_ZONE.cz; g.fillStyle = '#c9b88a'; rect(sx - 60, sz - 23, sx + 60, sz + 23); g.fillStyle = '#3f7d3a'; rect(sx - 52, sz - 19, sx + 52, sz + 19); for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.05)'; rect(sx - 52 + i * 13, sz - 19, sx - 52 + (i + 1) * 13, sz + 19); } g.strokeStyle = '#fff'; g.lineWidth = 0.35 * k; g.strokeRect(X(sx - 48), Z(sz - 16), 96 * k, 32 * k); g.beginPath(); g.moveTo(X(sx), Z(sz - 16)); g.lineTo(X(sx), Z(sz + 16)); g.stroke(); g.beginPath(); g.arc(X(sx), Z(sz), 5 * k, 0, 6.283); g.stroke(); g.strokeRect(X(sx - 48), Z(sz - 8), 10 * k, 16 * k); g.strokeRect(X(sx + 38), Z(sz - 8), 10 * k, 16 * k); }
  // ---- ほそかい ようす ----
  const rc = document.createElement('canvas'); rc.width = rc.height = Math.min(S, 2048); const rg = rc.getContext('2d'); const rk = rc.width / (MAPR * 2); const RX = (x) => (x + MAPR) * rk; const RZ = (z) => (z + MAPR) * rk;
  rg.fillStyle = '#d4d4d4'; rg.fillRect(0, 0, rc.width, rc.height); rg.strokeStyle = '#8c8c8c'; rg.lineCap = 'round'; rg.lineJoin = 'round'; for (const r of RL) { rg.beginPath(); r.pts.forEach(([x, z], i) => (i ? rg.lineTo(RX(x), RZ(z)) : rg.moveTo(RX(x), RZ(z)))); rg.lineWidth = (r.hw - 1) * 2 * rk; rg.stroke(); }
  const rpt = () => { const r = RL[Math.floor(rnd() * RL.length)]; const i = 1 + Math.floor(rnd() * (r.pts.length - 1)); const a = r.pts[i - 1]; const b = r.pts[i]; const u = rnd(); return { x: a[0] + (b[0] - a[0]) * u, z: a[1] + (b[1] - a[1]) * u, hw: r.hw }; };
  for (let i = 0; i < 260; i++) { const p = rpt(); g.fillStyle = `rgba(${20 + rnd() * 25},${20 + rnd() * 25},${24 + rnd() * 25},.35)`; rect(p.x, p.z, p.x + 1.5 + rnd() * 4, p.z + 1.5 + rnd() * 3); }
  g.strokeStyle = 'rgba(8,8,10,.55)'; g.lineWidth = 0.07 * k; for (let i = 0; i < 300; i++) { const p = rpt(); let x = p.x + (rnd() - 0.5) * p.hw; let z = p.z + (rnd() - 0.5) * p.hw; g.beginPath(); g.moveTo(X(x), Z(z)); for (let j = 0; j < 5; j++) { x += (rnd() - 0.5) * 2.4; z += (rnd() - 0.5) * 2.4; g.lineTo(X(x), Z(z)); } g.stroke(); }
  for (let i = 0; i < 110; i++) { const p = rpt(); const x = p.x + (rnd() - 0.5) * 3; const z = p.z + (rnd() - 0.5) * 3; g.fillStyle = '#44464c'; g.beginPath(); g.arc(X(x), Z(z), 0.55 * k, 0, 6.283); g.fill(); g.strokeStyle = '#6a6c72'; g.lineWidth = 0.1 * k; g.stroke(); g.beginPath(); g.moveTo(X(x) - 0.4 * k, Z(z)); g.lineTo(X(x) + 0.4 * k, Z(z)); g.moveTo(X(x), Z(z) - 0.4 * k); g.lineTo(X(x), Z(z) + 0.4 * k); g.stroke(); }
  rg.fillStyle = '#1a1a1a'; for (let i = 0; i < 170; i++) { const p = rpt(); rg.beginPath(); rg.ellipse(RX(p.x + (rnd() - 0.5) * 4), RZ(p.z + (rnd() - 0.5) * 4), (1.5 + rnd() * 4) * rk, (1 + rnd() * 2.5) * rk, rnd() * 3, 0, 6.283); rg.fill(); }
  for (let i = 0; i < 160 * q * q; i++) { rg.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.1)'; rg.fillRect(rnd() * rc.width, rnd() * rc.height, 2, 2); }
  c.rough = rc;
  g.save(); g.globalCompositeOperation = 'destination-out'; g.strokeStyle = '#000'; riverPath(RIVER.hw * 2); g.restore();
  return c;
}
function windowTex(THREE, base, seed) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, 128, 128);
  const e = document.createElement('canvas'); e.width = e.height = 128; const ge = e.getContext('2d'); ge.fillStyle = '#000'; ge.fillRect(0, 0, 128, 128);
  let a = seed * 9973 + 7; const rnd = () => { a = (a * 1664525 + 1013904223) % 4294967296; return a / 4294967296; };
  for (let i = 0; i < 700; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.05)'; g.fillRect(rnd() * 128, rnd() * 128, 2, 2); }
  for (let y = 6; y < 128; y += 16) for (let x = 6; x < 128; x += 16) { const lit = rnd() < 0.32; g.fillStyle = lit ? '#ffd98a' : '#26364c'; g.fillRect(x, y, 9, 10); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x, y, 9, 2); if (lit) { ge.fillStyle = rnd() < 0.2 ? '#9fd8ff' : '#ffc36a'; ge.fillRect(x, y, 9, 10); } }
  const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(0,0,0,.1)'); gr.addColorStop(1, 'rgba(10,8,6,.28)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 0, 128, 3);
  const mk = (cv) => { const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  const t = mk(c); t.userData.em = mk(e); return t;
}
const bmat = (THREE, tex, o = {}) => new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex.userData.em, emissive: 0xffffff, emissiveIntensity: 0.85, roughness: 0.8, metalness: 0.08, ...o });
function iconSprite(THREE, text, color = '#ffd23f') {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = 'rgba(8,20,44,.75)'; g.beginPath(); g.arc(64, 64, 58, 0, 6.283); g.fill(); g.strokeStyle = color; g.lineWidth = 8; g.stroke(); g.font = '64px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 64, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); s.renderOrder = 20; return s;
}

export async function startCity3D(o) {
  const THREE = await loadThree();
  if (ACTIVE) { try { ACTIVE.destroy(); } catch { /* ok */ } ACTIVE = null; }
  document.querySelectorAll('.c3d').forEach((e) => e.remove());
  const sim = createCity({ stats: o.stats, vehicles: o.vehicles, owned: o.owned && o.owned.length ? o.owned : DEFAULT_OWNED, weapons: o.weapons && o.weapons.length ? o.weapons : DEFAULT_WEAPONS, weapon: o.weapon || 'pistol', arrests: o.arrests || {}, coins: o.coins || 0, gentle: !!o.gentle }); const S = sim.state; const P = S.player; S.done = { ...(o.done || {}) };
  const root = document.createElement('div'); root.className = 'a3d c3d';
  root.innerHTML = `<canvas class="a3d-cv"></canvas>
    <div class="a3d-hud">
      <div class="a3d-bars"><div class="ab hp"><span>HP</span><i><u></u></i></div><div class="ab boost"><span>ダッシュ</span><i><u></u></i></div><div class="ab ms"><span>ミサイル</span><b></b></div><div class="c3d-coin">🪙 <b>0</b></div></div>
      <div class="a3d-top c3d-mis" hidden><div class="a3d-name"></div><div class="a3d-obj"></div></div>
      <div class="c3d-track" hidden></div><div class="c3d-pinhud" hidden></div><div class="c3d-stars"></div><button class="c3d-help" aria-label="やりかた">？</button><div class="a3d-banner"></div><div class="a3d-msg"></div><div class="a3d-warn"></div><div class="a3d-ret"><i></i></div>
      <canvas class="c3d-map" width="150" height="150"></canvas>
      <button class="a3d-pausebtn" aria-label="ポーズ">⏸</button><button class="c3d-bigmapbtn" aria-label="ちず">🗺</button><button class="c3d-ftbtn" aria-label="ガレージへ ワープ">🏁⚡</button><button class="c3d-wep" aria-label="ぶき"></button><button class="c3d-cancel" hidden>✖ ミッションを やめる</button>
    </div>
    <div class="c3d-vig"></div><div class="a3d-pad"><div class="a3d-stick"><div class="a3d-knob"></div></div>
      <div class="a3d-btns"><button class="ab-b ab-gun" data-b="gun">こうげき</button><button class="ab-b ab-ms" data-b="missile">ミサイル</button><button class="ab-b ab-boost" data-b="boost">ダッシュ</button><button class="ab-b ab-act" data-b="act" hidden></button><button class="ab-b ab-wp" data-b="weapon">🔁<br>ぶき</button><button class="ab-b ab-tg" data-b="target">ねらい<br>あわせ</button></div></div>
    <div class="a3d-rot p3d-rot"><div>📱↔<br>よこむきに して あそんでね</div></div>
    <div class="c3d-bigmap" hidden><div class="bm-hint">📍 ちずを タップで ピン(もくてきち)。🧭 じぶんは ▲</div><canvas width="640" height="640"></canvas><div class="bm-btns"><button class="btn gold bm-clear">📍 ピンを けす</button><button class="btn gray bm-close">とじる</button></div></div>
    <div class="c3d-shop" hidden></div>
    <div class="p3d-menu a3d-menu" hidden><div class="p3d-menubox"><b>ポーズ</b><button class="btn gold" data-m="resume">▶ つづける</button><button class="btn gray" data-m="quit">シティを でる</button></div></div>`;
  document.body.appendChild(root); const prevOv = document.body.style.overflow; document.body.style.overflow = 'hidden';
  const cv = root.querySelector('.a3d-cv'); const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
  const mobile = /Mobi|Android/i.test(navigator.userAgent); const shadowsOn = !o.calm;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, o.calm ? 1.25 : 1.75)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
  if (shadowsOn) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; }
  let post = null; try { if (!o.calm && renderer.capabilities.isWebGL2) post = createPost(THREE, renderer, { grade: o.grade }); } catch { post = null; }
  const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.5, 9000);
  const sunDir = new THREE.Vector3(-0.62, 0.2, -0.45).normalize(); const horizon = new THREE.Color('#8e8f86'); scene.background = horizon; scene.fog = new THREE.Fog(horizon, 120, 1500);
  try { scene.environment = envTexture(THREE, renderer); scene.environmentIntensity = 0.35; } catch { /* ok */ }
  scene.add(new THREE.HemisphereLight(0xb9bfc8, 0x3a3f36, 0.55)); const sun = new THREE.DirectionalLight(0xffb673, 1.9); scene.add(sun, sun.target);
  if (shadowsOn) { sun.castShadow = true; const m = mobile ? 1024 : 2048; sun.shadow.mapSize.set(m, m); const sc = sun.shadow.camera; sc.left = -140; sc.right = 140; sc.top = 140; sc.bottom = -140; sc.near = 20; sc.far = 700; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.5; }
  const sky = new THREE.Mesh(new THREE.SphereGeometry(8000, 24, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { top: { value: new THREE.Color('#4f5a68') }, mid: { value: new THREE.Color('#8a8c86') }, low: { value: new THREE.Color('#b59a76') }, sun: { value: sunDir } }, vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }', fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 low; uniform vec3 sun; void main(){ float h = clamp(vP.y,0.0,1.0); vec3 c = mix(low, mid, smoothstep(0.0,0.12,h)); c = mix(c, top, smoothstep(0.1,0.7,h)); float s = max(dot(vP, normalize(sun)),0.0); c += vec3(0.55,0.32,0.12) * pow(s, 6.0) * 0.6; gl_FragColor = vec4(c,1.0); }' })); sky.frustumCulled = false; sky.renderOrder = -10; scene.add(sky);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(24000, 24000), new THREE.ShaderMaterial({ vertexShader: SEA_VS, fragmentShader: SEA_FS, uniforms: { time: { value: 0 }, sunDir: { value: sunDir }, fogColor: { value: horizon }, fogNear: { value: 120 }, fogFar: { value: 1500 }, isl: { value: new THREE.Vector2(0, 0) }, islR: { value: 700 } } }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -1.5; sea.frustumCulled = false; scene.add(sea);
  { const sh = new THREE.Shape(); sh.moveTo(-7000, -7000); sh.lineTo(7000, -7000); sh.lineTo(7000, 7000); sh.lineTo(-7000, 7000); sh.closePath(); const hole = new THREE.Path(); [[-MAPR, -MAPR], [-MAPR, MAPR], [MAPR, MAPR], [MAPR, -MAPR]].forEach(([x, z], i) => (i ? hole.lineTo(x, z) : hole.moveTo(x, z))); hole.closePath(); sh.holes.push(hole);
    const land = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshStandardMaterial({ color: '#5a6350', roughness: 1 })); land.rotation.x = -Math.PI / 2; land.position.y = -0.4; land.receiveShadow = false; scene.add(land);
    let a = 31; const rnd = () => { a = (a * 1664525 + 1013904223) % 4294967296; return a / 4294967296; }; const N = 900; const hm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 }), N); const dm = new THREE.Object3D(); let n = 0; const cols = ['#c9c3b0', '#b9bec6', '#d6cdb8', '#a8afba', '#cbb8a6'];
    while (n < N) { const x = (rnd() - 0.5) * 5200; const z = (rnd() - 0.5) * 5200; if (Math.abs(x) < MAPR + 60 && Math.abs(z) < MAPR + 60) continue;  const h = 8 + rnd() * (rnd() < 0.15 ? 60 : 14); dm.position.set(x, h / 2 - 0.4, z); dm.scale.set(12 + rnd() * 20, h, 12 + rnd() * 20); dm.updateMatrix(); hm.setMatrixAt(n, dm.matrix); hm.setColorAt(n, new THREE.Color(cols[Math.floor(rnd() * cols.length)])); n++; }
    hm.instanceColor.needsUpdate = true; scene.add(hm); }
  // まち
  const gc = groundCanvas(mobile ? 2560 : 4096); const rtex = new THREE.CanvasTexture(gc.rough); const btex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g2 = c.getContext('2d'); g2.fillStyle = '#808080'; g2.fillRect(0, 0, 256, 256); for (let i = 0; i < 9000; i++) { const v = 80 + Math.random() * 100; g2.fillStyle = `rgb(${v},${v},${v})`; g2.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 1 + Math.random() * 2); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(420, 420); t.anisotropy = 4; return t; })(); const gtex = new THREE.CanvasTexture(gc); gtex.colorSpace = THREE.SRGBColorSpace; gtex.anisotropy = 8;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(MAPR * 2, MAPR * 2), new THREE.MeshStandardMaterial({ map: gtex, roughnessMap: rtex, bumpMap: btex, bumpScale: 1.6, transparent: true, alphaTest: 0.5, roughness: 1, metalness: 0.02 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const TONES = ['#8f949f', '#7d8795', '#9a8f7e', '#778472', '#98807a', '#74808f', '#9a9588', '#7f8896', '#8a8f96', '#aeb5bf'];
  const bmats = TONES.map((c, i) => bmat(THREE, windowTex(THREE, c, i + 1)));
  const hangarMat = new THREE.MeshStandardMaterial({ color: '#8a96aa', roughness: 0.5, metalness: 0.4 }); const hqMat = bmat(THREE, windowTex(THREE, '#e8eef7', 9), { roughness: 0.5 });
  addBuildings(THREE, scene, LAYOUT.buildings, { shadows: shadowsOn, aniso: Math.min(8, renderer.capabilities.getMaxAnisotropy()) });
  for (const b of LAYOUT.buildings) { if (b.kind === 'tower' && b.h > 50) { const cx = (b.x0 + b.x1) / 2; const cz = (b.z0 + b.z1) / 2; const H = b.H || b.h; const a = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 14, 6), new THREE.MeshStandardMaterial({ color: '#ddd' })); a.position.set(cx, H + 11, cz); scene.add(a); const l = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff3a3a' })); l.position.set(cx, H + 18, cz); scene.add(l); }
    if (b.kind === 'shrine') { const m = new THREE.Mesh(new THREE.BoxGeometry(b.x1 - b.x0, b.h, b.z1 - b.z0), new THREE.MeshStandardMaterial({ color: '#7a4a2a', roughness: 0.9 })); m.position.set((b.x0 + b.x1) / 2, b.h / 2, (b.z0 + b.z1) / 2); m.castShadow = shadowsOn; scene.add(m); } }
  { const hq = LAYOUT.buildings.find((b) => b.kind === 'hq'); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 30, 6), new THREE.MeshStandardMaterial({ color: '#fff' })); pole.position.set(hq.x0 + 6, hq.h + 15, hq.z0 + 6); scene.add(pole); const flag = new THREE.Mesh(new THREE.PlaneGeometry(12, 8), new THREE.MeshBasicMaterial({ color: '#fff', side: THREE.DoubleSide })); flag.position.set(hq.x0 + 12, hq.h + 26, hq.z0 + 6); scene.add(flag); const hi = new THREE.Mesh(new THREE.CircleGeometry(2.4, 18), new THREE.MeshBasicMaterial({ color: '#e0302a', side: THREE.DoubleSide })); hi.position.set(hq.x0 + 12, hq.h + 26, hq.z0 + 6.05); scene.add(hi); }
  // おみせ(コンビニ・ドラッグストア・ラーメンや・ホビー・ミリタリー)と モール(トレッサ・アピタ)
  const signTex = (text, bg, fg = '#fff', w = 512, h = 128, fs = 64) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g2 = c.getContext('2d'); g2.fillStyle = bg; g2.fillRect(0, 0, w, h); g2.strokeStyle = 'rgba(255,255,255,.7)'; g2.lineWidth = 6; g2.strokeRect(5, 5, w - 10, h - 10); g2.fillStyle = fg; g2.font = `bold ${fs}px sans-serif`; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText(text, w / 2, h / 2 + 3); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  { const COLS = { conbini: ['#e8eef0', '#2aa86a'], drug: ['#eaf4ea', '#2a9a5a'], ramen: ['#7a4a2a', '#d12a2a'], hobby: ['#4a3a7a', '#8a3ad1'], military: ['#59606c', '#c0392b'] };
    for (const st of STORES) { if (st.id === 'tresa' || st.id === 'apita') continue; const [wallC, signC] = COLS[st.id]; const g = new THREE.Group(); const hubby = st.id === 'conbini' || st.id === 'military';
      const wall = new THREE.Mesh(new THREE.BoxGeometry(14, 7, 8), new THREE.MeshStandardMaterial({ color: wallC, roughness: 0.7 })); wall.position.y = 3.5; const band = new THREE.Mesh(new THREE.BoxGeometry(14.2, 2.4, 0.4), new THREE.MeshStandardMaterial({ color: signC, emissive: signC, emissiveIntensity: 0.4 })); band.position.set(0, 6.0, -4.1);
      const tx = new THREE.Mesh(new THREE.PlaneGeometry(13, 2.1), new THREE.MeshBasicMaterial({ map: signTex(st.name, signC, '#fff', 512, 84, 48) })); tx.position.set(0, 6.0, -4.35); tx.rotation.y = Math.PI;
      const door = new THREE.Mesh(new THREE.BoxGeometry(5, 3.6, 0.3), new THREE.MeshStandardMaterial({ color: '#cfe6f6', emissive: '#ffe9b0', emissiveIntensity: 0.9 })); door.position.set(0, 1.9, -4.05); const aw = new THREE.Mesh(new THREE.BoxGeometry(14, 0.3, 2.6), new THREE.MeshStandardMaterial({ color: signC })); aw.position.set(0, 4.2, -5.2); aw.rotation.x = 0.2;
      g.add(wall, band, tx, door, aw); g.position.set(st.x, 0, st.z + (hubby ? 10 : 17)); g.traverse((m) => { if (m.isMesh) m.castShadow = shadowsOn; }); scene.add(g); }
    for (const m of LAYOUT.buildings.filter((b) => b.kind === 'mall')) { const st = storeOf(m.name); const north = false; const tex = signTex(`${st.icon} ${st.name}`, m.name === 'tresa' ? '#d12a2a' : '#1f6ad1', '#fff', 768, 160, 84); const pl = new THREE.Mesh(new THREE.PlaneGeometry(40, 8.3), new THREE.MeshBasicMaterial({ map: tex })); const H = m.H || m.h; pl.position.set((m.x0 + m.x1) / 2, H - 4, north ? m.z1 + 0.6 : m.z0 - 0.6); pl.rotation.y = north ? 0 : Math.PI; scene.add(pl); } }
  { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 12, 6), new THREE.MeshStandardMaterial({ color: '#ddd', metalness: 0.5 })); pole.position.set(JOB.x + 8, 6, JOB.z - 4); scene.add(pole); const fl = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.8), new THREE.MeshBasicMaterial({ color: '#fff', side: THREE.DoubleSide })); fl.position.set(JOB.x + 9.4, 11, JOB.z - 4); scene.add(fl); const dot2 = new THREE.Mesh(new THREE.CircleGeometry(0.5, 14), new THREE.MeshBasicMaterial({ color: '#d12a2a', side: THREE.DoubleSide })); dot2.position.set(JOB.x + 9.4, 11, JOB.z - 4.02); scene.add(dot2); }
  // なまえの ふだ(綱島東小学校・綱島東三丁目公園・じたく・えき・サッカーじょう)
  const nameBoard = (x, y, z, text, sub, color, w = 400) => { const sp = labelSprite(THREE, text, sub, color, w); sp.scale.multiplyScalar(2.2); sp.position.set(x, y, z); scene.add(sp); return sp; };
  nameBoard(JOB.x, 15, JOB.z - 6, '綱島東小学校', '💼 おしごと', '#7fe7ff'); nameBoard(PARK3.cx, 14, PARK3.cz, '綱島東三丁目公園', '🌳 こうえん', '#9fe29f', 460); nameBoard(GARAGE.x, 14, HOME.z0 + 8, 'じたく', '🏠 ガレージ', '#ffb35a'); nameBoard(STATION.x, 30, STATION.z, '綱島駅', '🚉 えき', '#9fd8ff'); nameBoard(HQ.x - 40, 22, HQ.z + 40, '新綱島駅', '🚉 えき', '#9fd8ff'); nameBoard(SOCCER.x, 16, SOCCER_ZONE.z1 + 3, 'サッカーじょう', '⚽ サッカーへ', '#9fe29f', 420);
  // じたく(いえ・カーポート・フェンス)
  { const hb = LAYOUT.buildings.find((b) => b.kind === 'home'); const g = new THREE.Group(); const cx = (hb.x0 + hb.x1) / 2; const cz = (hb.z0 + hb.z1) / 2; const w = hb.x1 - hb.x0; const d = hb.z1 - hb.z0; const wall = new THREE.MeshStandardMaterial({ color: '#efe6d2', roughness: 0.9 }); const dark = new THREE.MeshStandardMaterial({ color: '#4a3a30', roughness: 0.8 }); const glow = new THREE.MeshStandardMaterial({ color: '#cfe0f0', emissive: '#ffd890', emissiveIntensity: 0.9 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, hb.h, d), wall); body.position.set(cx, hb.h / 2, cz); const roof = new THREE.Mesh(new THREE.ConeGeometry(0.76, 1, 4), new THREE.MeshStandardMaterial({ color: '#7a3a2a', roughness: 0.8 })); roof.rotation.y = Math.PI / 4; roof.scale.set(w * 1.55, 5.5, d * 1.55); roof.position.set(cx, hb.h + 2.7, cz); const chim = new THREE.Mesh(new THREE.BoxGeometry(1.6, 4, 1.6), dark); chim.position.set(cx + 10, hb.h + 5, cz + 3);
    g.add(body, roof, chim); for (const dx of [-14, 0, 14]) { const wn = new THREE.Mesh(new THREE.BoxGeometry(5, 3.4, 0.3), glow); wn.position.set(cx + dx, 4.8, hb.z0 - 0.1); g.add(wn); } const door = new THREE.Mesh(new THREE.BoxGeometry(3.2, 5, 0.4), dark); door.position.set(cx + 20, 2.5, hb.z0 - 0.1); g.add(door);
    const cp = new THREE.Mesh(new THREE.BoxGeometry(84, 0.5, 44), new THREE.MeshStandardMaterial({ color: '#b8bcc6', metalness: 0.5, roughness: 0.4 })); cp.position.set(HOME.cx - 11, 4.4, HOME.cz - 18); g.add(cp); for (const [x, z] of [[HOME.cx - 51, HOME.cz - 38], [HOME.cx + 29, HOME.cz - 38], [HOME.cx - 51, HOME.cz + 2], [HOME.cx + 29, HOME.cz + 2]]) { const po = new THREE.Mesh(new THREE.BoxGeometry(0.6, 4.4, 0.6), dark); po.position.set(x, 2.2, z); g.add(po); }
    const fm = new THREE.MeshStandardMaterial({ color: '#d8dce4', roughness: 0.7 }); for (const [x, z, fw, fd] of [[(HOME.x0 + HOME.x1) / 2, HOME.z1, HOME.x1 - HOME.x0, 0.5], [HOME.x0, (HOME.z0 + HOME.z1) / 2, 0.5, HOME.z1 - HOME.z0], [HOME.x1, (HOME.z0 + HOME.z1) / 2, 0.5, HOME.z1 - HOME.z0]]) { const f = new THREE.Mesh(new THREE.BoxGeometry(fw, 1.3, fd), fm); f.position.set(x, 0.65, z); g.add(f); }
    g.traverse((m) => { if (m.isMesh) m.castShadow = shadowsOn; }); scene.add(g); }
  // こうえん(ぶらんこ・すべりだい・すなば・ベンチ)
  { const g = new THREE.Group(); const red = new THREE.MeshStandardMaterial({ color: '#d12a2a', roughness: 0.6 }); const yel = new THREE.MeshStandardMaterial({ color: '#e0b020', roughness: 0.6 }); const blu = new THREE.MeshStandardMaterial({ color: '#2a6ad1', roughness: 0.6 }); const sand = new THREE.MeshStandardMaterial({ color: '#d9c39a', roughness: 1 }); const wood = new THREE.MeshStandardMaterial({ color: '#7a5230', roughness: 0.9 });
    const bx = PARK3.cx - 14; const bz = PARK3.cz - 6; for (const dx of [-3.5, 3.5]) { const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 5, 6), blu); lg.position.set(bx + dx, 2.5, bz); lg.rotation.z = dx > 0 ? -0.2 : 0.2; g.add(lg); } const bar = new THREE.Mesh(new THREE.BoxGeometry(8, 0.2, 0.2), blu); bar.position.set(bx, 4.9, bz); g.add(bar); for (const dx of [-1.5, 1.5]) { const sw = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 0.5), red); sw.position.set(bx + dx, 1.2, bz); g.add(sw); const ch = new THREE.Mesh(new THREE.BoxGeometry(0.04, 3.7, 0.04), wood); ch.position.set(bx + dx, 3.0, bz); g.add(ch); }
    const sx = PARK3.cx + 12; const sz = PARK3.cz + 4; const slide = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.15, 6), yel); slide.position.set(sx, 1.6, sz + 2.5); slide.rotation.x = 0.55; g.add(slide); const tower = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.4, 2.4), red); tower.position.set(sx, 1.7, sz - 1.2); g.add(tower); const tr = new THREE.Mesh(new THREE.ConeGeometry(2, 1.4, 4), blu); tr.position.set(sx, 4.1, sz - 1.2); tr.rotation.y = Math.PI / 4; g.add(tr);
    const sb = new THREE.Mesh(new THREE.BoxGeometry(9, 0.4, 9), sand); sb.position.set(PARK3.cx + 20, 0.2, PARK3.cz - 14); g.add(sb); for (const [x, z] of [[PARK3.cx - 4, PARK3.cz + 12], [PARK3.cx + 22, PARK3.cz + 14], [PARK3.cx - 22, PARK3.cz + 14]]) { const seat = new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 0.9), wood); seat.position.set(x, 0.55, z); const back = new THREE.Mesh(new THREE.BoxGeometry(3, 0.7, 0.15), wood); back.position.set(x, 1.0, z + 0.4); g.add(seat, back); }
    g.traverse((m) => { if (m.isMesh) m.castShadow = shadowsOn; }); scene.add(g); }
  // サッカーじょう(ゴール・フェンス・ゲート)
  { const g = new THREE.Group(); const wm = new THREE.MeshStandardMaterial({ color: '#f4f4f4' }); const sz = SOCCER_ZONE.cz; for (const sx of [-1, 1]) { const gp = new THREE.Group(); for (const z of [-3.6, 3.6]) { const po = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.4, 6), wm); po.position.set(0, 1.2, z); gp.add(po); } const bar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 7.4), wm); bar.position.y = 2.4; gp.add(bar); const net = new THREE.Mesh(new THREE.PlaneGeometry(2, 7.2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.18, side: THREE.DoubleSide })); net.rotation.y = Math.PI / 2; net.position.set(sx * 1.2, 1.2, 0); net.scale.y = 0.33; gp.add(net); gp.position.set(SOCCER.x + sx * 40, 0, sz); g.add(gp); }
    const fn = new THREE.MeshStandardMaterial({ color: '#3a4a3a', roughness: 0.8 }); for (const [x, z, fw, fd] of [[SOCCER.x, sz - 34, 108, 0.2], [SOCCER.x, sz + 34, 108, 0.2], [SOCCER.x - 54, sz, 0.2, 68], [SOCCER.x + 54, sz, 0.2, 68]]) { const f = new THREE.Mesh(new THREE.BoxGeometry(fw, 3, fd), new THREE.MeshBasicMaterial({ color: '#2a3a2a', transparent: true, opacity: 0.28 })); f.position.set(x, 1.5, z); g.add(f); const rail = new THREE.Mesh(new THREE.BoxGeometry(fw, 0.15, fd + 0.1), fn); rail.position.set(x, 3, z); g.add(rail); }
    for (const sx of [-1, 1]) { const po = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 9, 8), new THREE.MeshStandardMaterial({ color: '#2a6ad1' })); po.position.set(SOCCER.x + sx * 8, 4.5, SOCCER_ZONE.z1 + 5); g.add(po); } const arch = new THREE.Mesh(new THREE.BoxGeometry(17, 1.4, 1), new THREE.MeshStandardMaterial({ color: '#2a6ad1', emissive: '#2a6ad1', emissiveIntensity: 0.4 })); arch.position.set(SOCCER.x, 9.5, SOCCER_ZONE.z1 + 5); g.add(arch);
    g.traverse((m) => { if (m.isMesh) m.castShadow = shadowsOn; }); scene.add(g); }
  { const bd = new THREE.Group(); const wood = new THREE.MeshStandardMaterial({ color: '#7a5230', roughness: 0.9 }); const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5, 0.6), wood); const board = new THREE.Mesh(new THREE.BoxGeometry(6.4, 3.6, 0.3), wood);
    const c = document.createElement('canvas'); c.width = 256; c.height = 144; const g2 = c.getContext('2d'); g2.fillStyle = '#e8d9a0'; g2.fillRect(0, 0, 256, 144); g2.fillStyle = '#b3201a'; g2.font = 'bold 26px sans-serif'; g2.textAlign = 'center'; g2.fillText('WANTED', 128, 30); g2.fillStyle = '#3a2a1a'; g2.font = '44px sans-serif'; for (let i = 0; i < 4; i++) g2.fillText('☠', 40 + i * 58, 92); g2.font = 'bold 18px sans-serif'; g2.fillText('してい手配ボード', 128, 130);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const face = new THREE.Mesh(new THREE.PlaneGeometry(6, 3.2), new THREE.MeshBasicMaterial({ map: t })); face.position.z = 0.17; board.position.y = 4.2; face.position.y = 4.2; const p2 = post.clone(); post.position.set(-2.4, 2.5, 0); p2.position.set(2.4, 2.5, 0); bd.add(post, p2, board, face);
    const sp = iconSprite(THREE, '📋', '#e8d9a0'); sp.scale.set(5, 5, 1); sp.position.y = 9.5; bd.add(sp); bd.position.set(BOARD.x, 0, BOARD.z + 3); bd.rotation.y = Math.PI; bd.traverse((m) => { if (m.isMesh) m.castShadow = shadowsOn; }); scene.add(bd); }
  // ---- がいとう・でんしんばしら・やねの きかい・いえ(みちと たてものに そって ならべる) ----
  const lampPts = [];
  { let a = 5; const rnd = () => { a = (a * 1664525 + 1013904223) % 4294967296; return a / 4294967296; }; const dk = new THREE.MeshStandardMaterial({ color: '#5a5750', roughness: 1 }); const lampM = new THREE.MeshStandardMaterial({ color: '#4a505c', metalness: 0.6, roughness: 0.5 });
    const lamps = []; const poles = []; const wires = [];
    for (const r of roadsOf()) { if (r.cls < 1 || r.br) continue; const step = r.cls >= 2 ? 32 : 38; let acc = step * rnd(); let side = 1; const prevPole = { 1: null, '-1': null };
      for (let i = 1; i < r.pts.length; i++) { const A = r.pts[i - 1]; const Bp = r.pts[i]; const L = Math.hypot(Bp[0] - A[0], Bp[1] - A[1]); const ang = Math.atan2(Bp[1] - A[1], Bp[0] - A[0]); const nx = -Math.sin(ang); const nz = Math.cos(ang);
        while (acc < L) { const t = acc / L; const x0 = A[0] + (Bp[0] - A[0]) * t; const z0 = A[1] + (Bp[1] - A[1]) * t; const sides = r.cls >= 2 ? [1, -1] : [side]; for (const sd of sides) { const x = x0 + nx * sd * (r.hw - 0.5); const z = z0 + nz * sd * (r.hw - 0.5); if (isWater(x, z) || (x > AIRFIELD.x0 - 10 && x < AIRFIELD.x1 + 10 && z > AIRFIELD.z0 - 10 && z < AIRFIELD.z1 + 10) || railDist(x, z) < 10 || Math.abs(x) > HALF - 4 || Math.abs(z) > HALF - 4) continue; if (r.cls >= 2) { lamps.push([x, z, ang, sd]); lampPts.push([x, z]); } else { poles.push([x, z, ang]); lampPts.push([x, z]); const pp = prevPole[sd]; if (pp && Math.hypot(pp[0] - x, pp[1] - z) < 46) for (const off of [-1.2, 0, 1.2]) wires.push(pp[0] + nx * off, 10, pp[1] + nz * off, x + nx * off, 9.6, z + nz * off); prevPole[sd] = [x, z]; } } side = -side; acc += step; }
        acc -= L; } }
    const nl = lamps.length; const lp = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.22, 8.5, 6), lampM, nl); const lh = new THREE.InstancedMesh(new THREE.BoxGeometry(2.2, 0.28, 0.6), new THREE.MeshBasicMaterial({ color: '#fff3c0' }), nl); const dm = new THREE.Object3D();
    lamps.forEach(([x, z, ang, sd], i) => { dm.position.set(x, 4.25, z); dm.rotation.set(0, 0, 0); dm.scale.setScalar(1); dm.updateMatrix(); lp.setMatrixAt(i, dm.matrix); dm.position.set(x - Math.sin(ang) * 0, 8.6, z); dm.rotation.set(0, -ang, 0); dm.updateMatrix(); lh.setMatrixAt(i, dm.matrix); });
    const np = poles.length; const pm = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.26, 11, 6), dk, np); const ar = new THREE.InstancedMesh(new THREE.BoxGeometry(3.2, 0.2, 0.2), dk, np);
    poles.forEach(([x, z, ang], i) => { dm.position.set(x, 5.5, z); dm.rotation.set(0, 0, 0); dm.updateMatrix(); pm.setMatrixAt(i, dm.matrix); dm.position.set(x, 10, z); dm.rotation.set(0, -ang + Math.PI / 2, 0); dm.updateMatrix(); ar.setMatrixAt(i, dm.matrix); });
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(wires, 3)); const ln = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: '#1c1c20' })); ln.frustumCulled = false; scene.add(lp, lh, pm, ar, ln);
    // やねの きかい
    const gb = LAYOUT.buildings.filter((b) => ['apt', 'shop', 'office', 'warehouse'].includes(b.kind)); const ac = new THREE.InstancedMesh(new THREE.BoxGeometry(3, 1.8, 2.4), new THREE.MeshStandardMaterial({ color: '#b9c0cc', metalness: 0.5, roughness: 0.5 }), gb.length * 2); const tk = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.4, 1.4, 3, 10), new THREE.MeshStandardMaterial({ color: '#7a6a58', roughness: 0.9 }), gb.length); let ia = 0; let it = 0;
    for (const b of gb) { const H = b.H || b.h; if (b.w < 7 || b.d < 7) continue; for (let k = 0; k < 2; k++) { const lx = (rnd() - 0.5) * (b.w - 5); const lz = (rnd() - 0.5) * (b.d - 5); dm.position.set(b.cx + lx * b.c - lz * b.s, H + 1.0, b.cz + lx * b.s + lz * b.c); dm.rotation.set(0, -b.ang + rnd() * 0.3, 0); dm.updateMatrix(); ac.setMatrixAt(ia++, dm.matrix); } if (H > 20 && rnd() < 0.6) { const lx = (rnd() - 0.5) * (b.w - 5); const lz = (rnd() - 0.5) * (b.d - 5); dm.position.set(b.cx + lx * b.c - lz * b.s, H + 1.6, b.cz + lx * b.s + lz * b.c); dm.rotation.set(0, 0, 0); dm.updateMatrix(); tk.setMatrixAt(it++, dm.matrix); } }
    ac.count = ia; tk.count = it; ac.castShadow = shadowsOn; tk.castShadow = shadowsOn; scene.add(ac, tk); }
  // ---- 住宅(ほんものの いえの むき・やね) ----
  { const hs = LAYOUT.buildings.filter((b) => b.kind === 'house'); const n = hs.length; const wt = windowTex(THREE, '#d8d4c6', 20); wt.repeat.set(2, 1);
    const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ map: wt, emissiveMap: wt.userData.em, emissive: 0xffffff, emissiveIntensity: 0.8, roughness: 0.9 }), n);
    const roofs = new THREE.InstancedMesh(new THREE.ConeGeometry(0.72, 1, 4), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 }), n); const dm = new THREE.Object3D();
    const WC = ['#e8e2d2', '#d8d4c6', '#cfc8b8', '#e4ddc8', '#c9d0c4', '#dcd2c0']; const RC = ['#4a4f58', '#6a3a30', '#3a5a5a', '#5a4a3a', '#2f3a4a'];
    hs.forEach((b, i) => { dm.position.set(b.cx, b.h / 2, b.cz); dm.rotation.set(0, -b.ang, 0); dm.scale.set(b.w, b.h, b.d); dm.updateMatrix(); walls.setMatrixAt(i, dm.matrix); walls.setColorAt(i, new THREE.Color(WC[b.tone % WC.length]));
      dm.position.set(b.cx, b.h + 1.6, b.cz); dm.rotation.set(0, -b.ang + Math.PI / 4, 0); dm.scale.set(b.w * 1.5, 3.2, b.d * 1.5); dm.updateMatrix(); roofs.setMatrixAt(i, dm.matrix); roofs.setColorAt(i, new THREE.Color(RC[Math.abs(Math.floor(b.cx * 3 + b.cz)) % RC.length])); });
    walls.instanceColor.needsUpdate = true; roofs.instanceColor.needsUpdate = true; walls.castShadow = shadowsOn; roofs.castShadow = shadowsOn; walls.receiveShadow = shadowsOn; scene.add(walls, roofs); }
  // ---- こうかせん(えきと でんしゃ) ----
  const trains = []; const pathCache = {};
  const pathInfo = (name) => { if (pathCache[name]) return pathCache[name]; const P = RAILS[name]; const cum = [0]; for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1])); return (pathCache[name] = { P, cum, L: cum[cum.length - 1] }); };
  const pathAt = (name, sd, off) => { const { P, cum, L } = pathInfo(name); const sv = ((sd % L) + L) % L; let i = 1; while (i < P.length - 1 && cum[i] < sv) i++; const t = (sv - cum[i - 1]) / (cum[i] - cum[i - 1]); const ax = P[i - 1][0]; const az = P[i - 1][1]; const bx = P[i][0]; const bz = P[i][1]; const ang = Math.atan2(bz - az, bx - ax); return { x: ax + (bx - ax) * t - Math.sin(ang) * off, z: az + (bz - az) * t + Math.cos(ang) * off, ang }; };
  { const con = new THREE.MeshStandardMaterial({ color: '#9a9ca0', roughness: 0.9 }); const dark = new THREE.MeshStandardMaterial({ color: '#34363c', roughness: 0.8 }); const Y = 9; const railM = new THREE.MeshStandardMaterial({ color: '#b8bcc6', metalness: 0.8, roughness: 0.3 });
    for (const [name, P] of Object.entries(RAILS)) { for (let i = 1; i < P.length; i++) { const [ax, az] = P[i - 1]; const [bx, bz] = P[i]; const len = Math.hypot(bx - ax, bz - az); const ang = Math.atan2(bz - az, bx - ax); const g = new THREE.Group(); g.position.set((ax + bx) / 2, 0, (az + bz) / 2); g.rotation.y = -ang;
        const beam = new THREE.Mesh(new THREE.BoxGeometry(len + 1, 2.6, 8), con); beam.position.y = Y + 1.3; const bed = new THREE.Mesh(new THREE.BoxGeometry(len + 1, 0.3, 6.4), dark); bed.position.y = Y + 2.7; g.add(beam, bed); beam.castShadow = shadowsOn;
        for (const dz of [-3.9, 3.9]) { const pr = new THREE.Mesh(new THREE.BoxGeometry(len + 1, 1.0, 0.25), con); pr.position.set(0, Y + 3.0, dz); g.add(pr); }
        for (const dz of [-1.8, 1.8]) for (const dd of [-0.72, 0.72]) { const rl = new THREE.Mesh(new THREE.BoxGeometry(len + 1, 0.14, 0.1), railM); rl.position.set(0, Y + 2.95, dz + dd); g.add(rl); }
        for (let x = -len / 2 + 10; x < len / 2; x += 25) { const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 6.5, 0.3), dark); p1.position.set(x, Y + 5.5, -4); const arm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 8), dark); arm.position.set(x, Y + 8.6, 0); g.add(p1, arm); }
        for (const dz of [-1.8, 1.8]) { const w = new THREE.Mesh(new THREE.BoxGeometry(len + 1, 0.06, 0.06), dark); w.position.set(0, Y + 8.1, dz); g.add(w); } scene.add(g); } }
    const pil = LAYOUT.buildings.filter((b) => b.kind === 'pillar'); const pm = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 9, 1.6), con, pil.length); const cap = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, 0.8, 7.5), con, pil.length); const dm = new THREE.Object3D();
    pil.forEach((b, i) => { const cx = (b.x0 + b.x1) / 2; const cz = (b.z0 + b.z1) / 2; dm.position.set(cx, 4.5, cz); dm.rotation.set(0, -(b.rail || 0), 0); dm.updateMatrix(); pm.setMatrixAt(i, dm.matrix); dm.position.set(cx, 9.2, cz); dm.updateMatrix(); cap.setMatrixAt(i, dm.matrix); }); pm.castShadow = shadowsOn; scene.add(pm, cap);
    // えき(ホームの やねと えきしゃ)
    { const P = RAILS.toyoko; let bi = 1; let bd = 1e9; for (let i = 1; i < P.length; i++) { const mx = (P[i][0] + P[i - 1][0]) / 2; const mz = (P[i][1] + P[i - 1][1]) / 2; const d0 = Math.hypot(mx - STATION.x, mz - STATION.z); if (d0 < bd) { bd = d0; bi = i; } } const ang = Math.atan2(P[bi][1] - P[bi - 1][1], P[bi][0] - P[bi - 1][0]); const g = new THREE.Group(); g.position.set((P[bi][0] + P[bi - 1][0]) / 2, 0, (P[bi][1] + P[bi - 1][1]) / 2); g.rotation.y = -ang; const roof = new THREE.Mesh(new THREE.BoxGeometry(110, 0.7, 11), new THREE.MeshStandardMaterial({ color: '#d8dce4', roughness: 0.6, metalness: 0.2 })); roof.position.y = Y + 9.6; g.add(roof);
      for (let x = -50; x <= 50; x += 12.5) for (const dz of [-4.8, 4.8]) { const po = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5.6, 0.4), dark); po.position.set(x, Y + 6.5, dz); g.add(po); } scene.add(g); }
    const mkTrain = (name, dir, off, color, n, speed) => { const g = new THREE.Group(); const body = new THREE.MeshStandardMaterial({ color: '#eef0f4', metalness: 0.5, roughness: 0.35 }); const stripe = new THREE.MeshStandardMaterial({ color, roughness: 0.5 }); const win = new THREE.MeshStandardMaterial({ color: '#1d2f4a', metalness: 0.9, roughness: 0.1, emissive: '#ffe9a0', emissiveIntensity: 0.25 });
      for (let i = 0; i < n; i++) { const c = new THREE.Mesh(new THREE.BoxGeometry(19, 3.4, 3.1), body); c.position.set(-i * 20.2, 2.4, 0); const st = new THREE.Mesh(new THREE.BoxGeometry(19.05, 0.55, 3.16), stripe); st.position.set(-i * 20.2, 1.4, 0); const wn = new THREE.Mesh(new THREE.BoxGeometry(18, 1.0, 3.2), win); wn.position.set(-i * 20.2, 2.9, 0); g.add(c, st, wn); }
      g.userData = { name, dir, off, s: dir > 0 ? 0 : pathInfo(name).L * 0.6, speed }; g.traverse((m) => { if (m.isMesh) m.castShadow = shadowsOn; }); scene.add(g); trains.push(g); };
    mkTrain('toyoko', 1, -1.8, '#d12a2a', 8, 24); mkTrain('toyoko', -1, 1.8, '#d12a2a', 6, 22); mkTrain('shin', 1, 0, '#2a6ad1', 8, 60); }
  // ---- じんじゃ(とりい)・さくら・でんしんばしら・じどうはんばいき ----
  { const red = new THREE.MeshStandardMaterial({ color: '#c8281e', roughness: 0.6 }); const to = new THREE.Group(); for (const x of [-4, 4]) { const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 11, 10), red); pl.position.set(x, 5.5, 0); to.add(pl); } const b1 = new THREE.Mesh(new THREE.BoxGeometry(13.5, 0.9, 1.2), red); b1.position.y = 10.6; const b2 = new THREE.Mesh(new THREE.BoxGeometry(11, 0.6, 0.8), red); b2.position.y = 8.4; const b0 = new THREE.Mesh(new THREE.BoxGeometry(15, 0.4, 1.6), new THREE.MeshStandardMaterial({ color: '#222' })); b0.position.y = 11.3; to.add(b1, b2, b0); to.position.set(SHRINE.x, 0, SHRINE.z + 36); scene.add(to);
    const sh = LAYOUT.buildings.find((b) => b.kind === 'shrine'); const rf = new THREE.Mesh(new THREE.ConeGeometry(24, 7, 4), new THREE.MeshStandardMaterial({ color: '#3a4a50', roughness: 0.8 })); rf.rotation.y = Math.PI / 4; rf.scale.set(1, 1, 0.62); rf.position.set((sh.x0 + sh.x1) / 2, sh.h + 3, (sh.z0 + sh.z1) / 2); scene.add(rf);
    const path = new THREE.Mesh(new THREE.PlaneGeometry(6, 28), new THREE.MeshStandardMaterial({ color: '#9a958a', roughness: 1 })); path.rotation.x = -Math.PI / 2; path.position.set(SHRINE.x, 0.06, SHRINE.z + 22); scene.add(path); }
  { const pts = []; const P = RIVER.pts; for (let i = 1; i < P.length; i++) { const a0 = P[i - 1]; const b0 = P[i]; const L = Math.hypot(b0[0] - a0[0], b0[1] - a0[1]); const ang = Math.atan2(b0[1] - a0[1], b0[0] - a0[0]); const nx = -Math.sin(ang); const nz = Math.cos(ang); for (let d = 0; d < L; d += 13) for (const sd of [-1, 1]) { const x = a0[0] + ((b0[0] - a0[0]) * d) / L + nx * sd * (RIVER.hw + 11); const z = a0[1] + ((b0[1] - a0[1]) * d) / L + nz * sd * (RIVER.hw + 11); if (Math.abs(x) > HALF + 20 || Math.abs(z) > HALF + 20 || isWater(x, z) || roadSD(x, z) < 1.5 || LAYOUT.buildings.some((b) => x > b.x0 - 3 && x < b.x1 + 3 && z > b.z0 - 3 && z < b.z1 + 3)) continue; pts.push([x, z]); } }
    const n = pts.length; const tr = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.4, 0.55, 5, 6), new THREE.MeshStandardMaterial({ color: '#4a3a2e', roughness: 1 }), n); const cr = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(5.2, 1), new THREE.MeshStandardMaterial({ color: '#f3b6c8', roughness: 0.9, emissive: '#f3b6c8', emissiveIntensity: 0.12 }), n); const dm = new THREE.Object3D();
    pts.forEach(([x, z], i) => { dm.position.set(x, 2.5, z); dm.scale.setScalar(1); dm.updateMatrix(); tr.setMatrixAt(i, dm.matrix); dm.position.set(x, 7.5, z); dm.scale.set(1, 0.8, 1); dm.updateMatrix(); cr.setMatrixAt(i, dm.matrix); }); tr.castShadow = shadowsOn; scene.add(tr, cr); }
  // はし(ちずの はしの どうろ)
  for (const r of roadsOf()) { if (!r.br) continue; for (let i = 1; i < r.pts.length; i++) { const A = r.pts[i - 1]; const Bp = r.pts[i]; const L = Math.hypot(Bp[0] - A[0], Bp[1] - A[1]); const ang = Math.atan2(Bp[1] - A[1], Bp[0] - A[0]); const g = new THREE.Group(); g.position.set((A[0] + Bp[0]) / 2, 0, (A[1] + Bp[1]) / 2); g.rotation.y = -ang;
      const deck = new THREE.Mesh(new THREE.BoxGeometry(L + 1.5, 0.8, r.hw * 2), new THREE.MeshStandardMaterial({ color: '#3a3e46', roughness: 0.9 })); deck.position.y = -0.36; g.add(deck);
      for (const sx of [-1, 1]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(L + 1.5, 1.2, 0.3), new THREE.MeshStandardMaterial({ color: '#b8bcc6', metalness: 0.5, roughness: 0.5 })); rail.position.set(0, 0.6, sx * (r.hw - 0.2)); g.add(rail); }
      if (L > 12) { const pier = new THREE.Mesh(new THREE.BoxGeometry(4, 4, r.hw * 2 - 1), new THREE.MeshStandardMaterial({ color: '#8a8d92' })); pier.position.set(0, -2.4, 0); g.add(pier); } scene.add(g); } }
  // きのこ・き
  { const mk = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.castShadow = shadowsOn; scene.add(m); return m; }; const n = LAYOUT.trees.length; const cone = mk(new THREE.ConeGeometry(4.5, 12, 7), new THREE.MeshStandardMaterial({ color: '#2f6a3a', roughness: 0.9 }), n); const trunk = mk(new THREE.CylinderGeometry(0.6, 0.8, 4, 5), new THREE.MeshStandardMaterial({ color: '#5a3f2a', roughness: 1 }), n); const dm = new THREE.Object3D();
    LAYOUT.trees.forEach((t, i) => { dm.position.set(t.x, 2 * t.s, t.z); dm.scale.setScalar(t.s); dm.updateMatrix(); trunk.setMatrixAt(i, dm.matrix); dm.position.y = 9 * t.s; dm.updateMatrix(); cone.setMatrixAt(i, dm.matrix); }); }
  { const gc2 = document.createElement('canvas'); gc2.width = gc2.height = 64; const g2 = gc2.getContext('2d'); const gr = g2.createRadialGradient(32, 32, 1, 32, 32, 31); gr.addColorStop(0, 'rgba(255,214,140,1)'); gr.addColorStop(0.3, 'rgba(255,190,100,.45)'); gr.addColorStop(1, 'rgba(255,170,80,0)'); g2.fillStyle = gr; g2.fillRect(0, 0, 64, 64);
    const pts = []; for (const [x, z] of lampPts) pts.push(x, 9, z);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); const tx = new THREE.CanvasTexture(gc2); const pm = new THREE.Points(geo, new THREE.PointsMaterial({ map: tx, size: 26, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); pm.frustumCulled = false; scene.add(pm); }
  const clouds = new THREE.Group(); { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); for (let i = 0; i < 22; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, opacity: 0.8, depthWrite: false })); const s = 240 + (i * 53) % 260; sp.scale.set(s * 1.6, s * 0.8, 1); sp.position.set(Math.sin(i * 2.1) * 1800, 380 + (i * 41) % 260, Math.cos(i * 1.7) * 1800); clouds.add(sp); } scene.add(clouds); }
  const fx = makeFx(THREE, scene); const seenFx = new Map();

  // ---- ものたち ----
  let heldId = ''; let heldM = null;
  const me = makePerson(THREE, { shirt: '#3a3a3e', jacket: true, jacketColor: '#1c1d21', pants: '#4a5a34', cargo: true, boots: true, shoe: '#4a3020', sole: '#1a1612', hair: '#2a1c14', hairStyle: 0, stubble: true, scale: 1.0 }); scene.add(me); const vmodels = new Map();
  const mkVehModel = (v) => { let m; if (v.cat) { const it = catalogOf(v.cat) || catalogOf('sedan'); m = it.kind === 'bike' ? makeBikeModel(THREE, it.model) : isAir(it.kind) ? makeAirModel(THREE, it.model) : makeCarModel(THREE, it.model); } else m = makeVehicleModel(THREE, o.specs[v.kind]); m.traverse((x) => { if (x.isMesh) x.castShadow = shadowsOn; }); scene.add(m); vmodels.set(v.id, m); return m; };
  for (const v of S.vehicles) mkVehModel(v);
  const npcs = new Map(); const trafficM = new Map(); const crookM = new Map(); const pickM = new Map();
  const mkNpc = (id) => { const m = townsPerson(THREE, id); m.traverse((x) => { if (x.isMesh) x.castShadow = shadowsOn; }); scene.add(m); return m; };
  const mkMarker = (color, h = 70) => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, h, 14, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); b.position.y = h / 2; const r = new THREE.Mesh(new THREE.TorusGeometry(5, 0.35, 8, 28), new THREE.MeshBasicMaterial({ color })); r.rotation.x = Math.PI / 2; r.position.y = 0.6; g.add(b, r); g.userData.ring = r; return g; };
  const markers = []; const startMarkers = CITY_MISSIONS.map((m) => { const g = mkMarker('#ffd23f'); g.position.set(m.start.x, 0, m.start.z); const sp = iconSprite(THREE, m.icon); sp.scale.set(9, 9, 1); sp.position.y = 24; g.add(sp); scene.add(g); return { m, g }; });
  for (const [pt, ic, col] of [[GARAGE, '🏠', '#ff9f43'], [BOARD, '📋', '#e8d9a0'], [JOB, '💼', '#7fe7ff'], [SOCCER, '⚽', '#9fe29f'], ...STORES.map((st) => [st, st.icon, '#ffb35a'])]) { const g = mkMarker(col, 40); g.position.set(pt.x, 0, pt.z); const sp = iconSprite(THREE, ic, col); sp.scale.set(8, 8, 1); sp.position.y = 26; g.add(sp); scene.add(g); markers.push(g); }
  let pin = null; const pinMarker = mkMarker('#ff4d6a', 140); pinMarker.visible = false; { const sp = iconSprite(THREE, '📍', '#ff4d6a'); sp.scale.set(10, 10, 1); sp.position.y = 34; pinMarker.add(sp); } scene.add(pinMarker);
  const setPin = (x, z) => { pin = x == null ? null : { x, z }; pinMarker.visible = !!pin; if (pin) pinMarker.position.set(x, 0, z); };
  const targetMarker = mkMarker('#27d8ff', 110); targetMarker.visible = false; scene.add(targetMarker); const hqMarker = mkMarker('#7dffa0', 60); hqMarker.position.set(HQ.x, 0, HQ.z); hqMarker.scale.set(4.5, 1, 4.5); hqMarker.visible = false; scene.add(hqMarker);
  const ringM = new THREE.Mesh(new THREE.TorusGeometry(24, 2.2, 10, 36), new THREE.MeshBasicMaterial({ color: '#27d8ff', transparent: true, opacity: 0.9 })); ringM.visible = false; scene.add(ringM);
  const shield = new THREE.Mesh(new THREE.SphereGeometry(3, 12, 8), new THREE.MeshBasicMaterial({ color: '#7fe7ff', transparent: true, opacity: 0.3, depthWrite: false })); shield.visible = false; scene.add(shield);
  const bulletGeo = new THREE.SphereGeometry(0.35, 6, 4); const bulletMat = new THREE.MeshBasicMaterial({ color: '#ff7a5a', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
  const poolB = []; const poolT = []; const poolM = []; const trGeo = new THREE.CylinderGeometry(0.1, 0.1, 1, 4); const trMat = new THREE.MeshBasicMaterial({ color: '#ffe48a', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }); const misGeo = new THREE.CylinderGeometry(0.25, 0.25, 3, 6); const misMat = new THREE.MeshBasicMaterial({ color: '#fff' });
  const pool = (arr, geo, mat, i) => { while (arr.length <= i) { const m = new THREE.Mesh(geo, mat); m.visible = false; scene.add(m); arr.push(m); } return arr[i]; };

  // ---- そうさ ----
  const stick = root.querySelector('.a3d-stick'); const knob = root.querySelector('.a3d-knob'); const pad = root.querySelector('.a3d-pad'); let sid = null; let so = { x: 0, y: 0 }; const R = 56; let aid = null; let ao = { x: 0, y: 0 };
  const setStick = (dx, dy) => { const m = Math.hypot(dx, dy); const k = m > R ? R / m : 1; const x = dx * k; const y = dy * k; knob.style.transform = `translate(${x}px,${y}px)`; const vx = x / R; const vy = y / R; if (Math.hypot(vx, vy) < 0.1) { sim.input.turn = 0; sim.input.climb = 0; } else { sim.input.turn = -vx; sim.input.climb = -vy; } };
  const setAim = (dx, dy) => { const m = Math.hypot(dx, dy); const k = m > R ? R / m : 1; const vx = (dx * k) / R; const vy = (dy * k) / R; sim.input.aimX = Math.abs(vx) < 0.08 ? 0 : -vx; sim.input.aimY = Math.abs(vy) < 0.08 ? 0 : -vy; };
  pad.addEventListener('pointerdown', (e) => { if (e.target.closest('.ab-b')) return; if (e.clientX > root.clientWidth * 0.5 && !(sim.vehicleOf() && isAir(sim.vehicleOf().kind))) { if (aid !== null) return; aid = e.pointerId; ao = { x: e.clientX, y: e.clientY }; try { pad.setPointerCapture(e.pointerId); } catch { /* ok */ } e.preventDefault(); return; } if (sid !== null) return; sid = e.pointerId; try { pad.setPointerCapture(e.pointerId); } catch { /* ok */ } const r = stick.getBoundingClientRect(); so = { x: e.clientX, y: e.clientY }; stick.style.left = `${e.clientX - r.width / 2}px`; stick.style.bottom = 'auto'; stick.style.top = `${e.clientY - r.height / 2}px`; setStick(0, 0); e.preventDefault(); });
  pad.addEventListener('pointermove', (e) => { if (e.pointerId === aid) { setAim(e.clientX - ao.x, e.clientY - ao.y); e.preventDefault(); return; } if (e.pointerId !== sid) return; setStick(e.clientX - so.x, e.clientY - so.y); e.preventDefault(); });
  const endPtr = (e) => { if (e.pointerId === aid) { aid = null; setAim(0, 0); return; } if (e.pointerId !== sid) return; sid = null; setStick(0, 0); stick.style.left = ''; stick.style.top = ''; stick.style.bottom = ''; };
  pad.addEventListener('pointerup', endPtr); pad.addEventListener('pointercancel', endPtr);
  const doAct = () => { const had = !!S.nearby; if (!sim.interact() && !had) return; };
  const bp = (b) => { if (b === 'gun') sim.input.gun = true; else if (b === 'boost') sim.input.boost = true; else if (b === 'weapon') { sim.cycleWeapon(1); saveNow(); } else if (b === 'missile') sim.fireMissile(); else if (b === 'act') doAct(); else if (b === 'target') sim.aimAt(P.target || null); };
  const br = (b) => { if (b === 'gun') sim.input.gun = false; else if (b === 'boost') sim.input.boost = false; };
  root.querySelectorAll('.ab-b').forEach((btn) => { const b = btn.dataset.b; btn.addEventListener('pointerdown', (e) => { try { btn.setPointerCapture(e.pointerId); } catch { /* ok */ } btn.classList.add('on'); bp(b); e.preventDefault(); }); const up = (e) => { btn.classList.remove('on'); br(b); e.preventDefault(); }; btn.addEventListener('pointerup', up); btn.addEventListener('pointercancel', up); });
  const keys = new Set(); const akeys = { KeyI: [0, 1], KeyK: [0, -1], KeyJ: [-1, 0], KeyL: [1, 0] }; const aimKeys = new Set(); const kmap = { Space: 'gun', KeyF: 'missile', ShiftLeft: 'boost', KeyE: 'act', KeyT: 'target', KeyQ: 'weapon' };
  const recompute = () => { const x = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0); const y = (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0) - (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0); sim.input.turn = -x; sim.input.climb = y; };
  const recAim = () => { let x = 0; let y = 0; for (const c of aimKeys) { x += akeys[c][0]; y += akeys[c][1]; } sim.input.aimX = -x; sim.input.aimY = y; };
  const kd = (e) => { if (e.repeat) return; if (e.code === 'Escape' || e.code === 'KeyP') { setPause(!paused); return; } if (akeys[e.code]) { aimKeys.add(e.code); recAim(); return; } if (kmap[e.code]) { bp(kmap[e.code]); e.preventDefault(); return; } keys.add(e.code); recompute(); if (e.code.startsWith('Arrow')) e.preventDefault(); };
  const ku = (e) => { if (akeys[e.code]) { aimKeys.delete(e.code); recAim(); } if (kmap[e.code]) { br(kmap[e.code]); return; } keys.delete(e.code); recompute(); };
  window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
  let paused = false; let dead = false; let portrait = false; const menu = root.querySelector('.a3d-menu'); const setPause = (v) => { paused = v; menu.hidden = !v; if (v) { sim.input.gun = false; sim.input.boost = false; } };
  const snap = () => ({ coins: P.coins, done: S.done, stats: S.stats, owned: S.owned, weapons: S.wOwned, weapon: P.weapon, arrests: S.arrests }); const saveNow = () => { if (o.onSave) o.onSave(snap()); };
  menu.addEventListener('click', (e) => { const m = e.target.closest('[data-m]'); if (!m) return; if (m.dataset.m === 'resume') setPause(false); else if (m.dataset.m === 'quit') { saveNow(); destroy(); if (o.onQuit) o.onQuit(snap()); } });
  root.querySelector('.a3d-pausebtn').addEventListener('click', () => setPause(!paused));
  const showHelp = () => { openModal(() => { shopEl.innerHTML = `<div class="sh-box"><h3>❓ シティの あそびかた</h3><div class="hp">
      <p>🕹️ ひだり: うごく ・ みぎ: ねらう ・ ボタンで うつ・のる・おりる</p>
      <p>📋 <b>ボード</b>: してい手配はんを みる→たおして「たいほ」→ <b>けんしょう金</b></p>
      <p>🔫 <b>ぶきや</b>: ぶきを かう ・ 🔁ボタン/Qキーで きりかえ</p>
      <p>💼 <b>おしごと</b>: さんすう・こくごで おきゅうりょう</p>
      <p>🏁 <b>ガレージ</b>: のりものを かう・のる ・ 🏁⚡ボタンで ワープ</p>
      <p>⭐ ミッション(きいろい はしら)で チケット ゲット</p>
      <p>🗺 ちず ・ 🎯 ついせき ・ 🚉 えき ・ 🌸 さくらなみき</p><p style="font-size:10px;opacity:.7">ちず: © OpenStreetMap contributors</p></div><button class="btn gold sh-x">わかった!</button></div>`; }); shopEl.onclick = (e) => { if (e.target.closest('.sh-x')) { closeModal(); try { localStorage.setItem('city-help', '1'); } catch { /* ok */ } } }; };
  root.querySelector('.c3d-help').addEventListener('click', () => { if (!paused) showHelp(); });
  try { if (!localStorage.getItem('city-help')) setTimeout(() => { if (!dead && !paused) showHelp(); }, 1200); } catch { /* ok */ }
  root.querySelector('.c3d-cancel').addEventListener('click', () => sim.cancelMission());
  root.querySelector('.c3d-ftbtn').addEventListener('click', () => { if (paused) return; const r = sim.fastTravel(); if (!r.ok && r.why) { S.msg = r.why; S.msgT = 2; } });
  root.querySelector('.c3d-wep').addEventListener('click', () => { if (!paused) openWeapons(); });
  const bigmap = root.querySelector('.c3d-bigmap'); root.querySelector('.c3d-bigmapbtn').addEventListener('click', () => { bigmap.hidden = !bigmap.hidden; });
  bigmap.querySelector('.bm-close').addEventListener('click', (e) => { e.stopPropagation(); bigmap.hidden = true; }); bigmap.querySelector('.bm-clear').addEventListener('click', (e) => { e.stopPropagation(); setPin(null); });
  bigmap.querySelector('canvas').addEventListener('click', (e) => { e.stopPropagation(); const cvb = e.currentTarget; const r = cvb.getBoundingClientRect(); const u = (e.clientX - r.left) / r.width; const fy = (e.clientY - r.top) / r.height; const R0 = HALF + 40; const x = ((1 - u) - 0.5) * 2 * R0; const z = ((1 - fy) - 0.5) * 2 * R0; if (Math.abs(x) > HALF || Math.abs(z) > HALF) return; if (pin && Math.hypot(pin.x - x, pin.z - z) < 40) setPin(null); else { setPin(x, z); S.msg = '📍 ピンを たてたよ! ちずを とじて むかおう'; S.msgT = 2.5; } });
  const resize = () => { const w = root.clientWidth || innerWidth; const h = root.clientHeight || innerHeight; renderer.setSize(w, h, false); if (post) { const v = new THREE.Vector2(); renderer.getDrawingBufferSize(v); post.setSize(v.x, v.y); } camera.aspect = w / h; camera.fov = w / h < 1.5 ? 70 : 62; camera.updateProjectionMatrix(); portrait = h > w * 1.05; root.classList.toggle('portrait', portrait); };
  window.addEventListener('resize', resize); window.addEventListener('orientationchange', resize); resize();
  try { if (document.documentElement.requestFullscreen && !document.fullscreenElement && /Mobi|Android/i.test(navigator.userAgent)) document.documentElement.requestFullscreen().then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {})).catch(() => {}); } catch { /* ok */ }
  // ---- おみせ・ガレージ・ボード ----
  const shopEl = root.querySelector('.c3d-shop');
  const openModal = (draw) => { S.ui = 'modal'; setPause(false); paused = true; shopEl.hidden = false; draw(); };
  const closeModal = () => { shopEl.hidden = true; S.ui = null; paused = false; sim.closeUi(); };
  // おみせ(トレッサ・アピタ・ほかの おみせ)
  const wLine = (w) => { const own = S.wOwned.includes(w.id); const lock = !own && !sim.meets(w.need); const ok = own || (!lock && P.coins >= w.price); const st = w.melee ? `ちかくの てき・ダメージ ${w.dmg}` : w.expl ? `ばくはつ ${w.dmg}${w.homing ? '・ホーミング' : ''}` : `ダメージ ${w.dmg}${w.pellets ? '×' + w.pellets : ''}・れんしゃ ${w.rate}`; return `<button class="sh-item ${own ? 'own' : ''} ${lock ? 'lock' : ''} ${P.weapon === w.id ? 'trk' : ''}" data-k="w" data-id="${w.id}" ${!ok ? 'disabled' : ''}><span>${lock ? '🔒' : w.icon}</span><div><b>${esc(w.name)}</b><small>${lock ? '🔒 ' + needText(w.need) : st}</small></div><em>${own ? (P.weapon === w.id ? '✔ そうび中' : 'そうび') : `🪙${w.price}`}</em></button>`; };
  const vLine = (it) => { const own = S.owned.includes(it.id); const lock = !own && !sim.meets(it.need); const ok = own || (!lock && P.coins >= it.price); return `<button class="sh-item ${own ? 'own' : ''} ${lock ? 'lock' : ''}" data-k="v" data-id="${it.id}" ${own || !ok ? 'disabled' : ''}><span>${lock ? '🔒' : it.icon}</span><div><b>${esc(it.name)}</b><small>${lock ? '🔒 ' + needText(it.need) : `${esc(it.desc)}・スピード ${it.speed}${it.missiles ? `・🚀${it.missiles}` : ''}`}</small></div><em>${own ? '✔ もってる' : `🪙${it.price}`}</em></button>`; };
  const openStore = (id) => {
    const st = storeOf(id); if (!st) return; const sl = st.sells; const tabs = []; if (sl.items) tabs.push(['i', '🛒 しなもの']); if (sl.weapons) tabs.push(['w', '🔫 ぶき']); if (sl.vehicles) tabs.push(['v', '🚗 のりもの・ひこうき']); let tab = tabs[0][0];
    const draw = (note = `${st.sub}。コインは ミッションや たいほ・おしごとで ふえるよ`) => {
      let body = '';
      if (tab === 'i') body = ITEMS.filter((it) => sl.items.includes(it.id)).map((it) => `<button class="sh-item" data-k="i" data-id="${it.id}" ${P.coins < it.cost ? 'disabled' : ''}><span>${it.icon}</span><div><b>${it.name}</b><small>${it.desc}</small></div><em>🪙${it.cost}</em></button>`).join('');
      else if (tab === 'w') { const list = WEAPONS.filter((w) => sl.weapons === 'all' ? true : sl.weapons.includes(w.id)); const cats = [...new Set(list.map((w) => w.cat))]; body = cats.map((c) => `<div class="sh-grp">${c}</div>${list.filter((w) => w.cat === c).map(wLine).join('')}`).join(''); }
      else { const list = VCAT.filter((it) => sl.vehicles === 'all' ? true : sl.vehicles.includes(it.id)); body = [['🚗 くるま', 'car'], ['🏍️ バイク', 'bike'], ['✈️ ひこうき・せんとうき', 'air']].map(([t, g]) => `<div class="sh-grp">${t}</div>${list.filter((it) => (g === 'air' ? isAir(it.kind) : it.kind === g)).map(vLine).join('')}`).join(''); }
      shopEl.innerHTML = `<div class="sh-box"><h3>${st.icon} ${esc(st.name)}</h3><div class="sh-coin">🪙 ${P.coins}</div>${tabs.length > 1 ? `<div class="sh-tabs">${tabs.map(([k2, l]) => `<button class="chipb ${tab === k2 ? 'on' : ''}" data-tab="${k2}">${l}</button>`).join('')}</div>` : ''}${body}<div class="sh-note">${note}</div><button class="btn gray sh-x">とじる</button></div>`;
    };
    openModal(draw);
    shopEl.onclick = (e) => {
      if (e.target.closest('.sh-x')) { closeModal(); return; } const tb = e.target.closest('[data-tab]'); if (tb) { tab = tb.dataset.tab; draw(); return; }
      const b = e.target.closest('.sh-item'); if (!b || b.disabled) return; const k2 = b.dataset.k; const bid = b.dataset.id; let r;
      if (k2 === 'w') { if (S.wOwned.includes(bid)) { sim.equip(bid); saveNow(); draw('そうびしたよ!'); return; } r = sim.buyWeapon(bid); } else if (k2 === 'v') r = sim.buyVehicle(bid); else r = sim.buy(bid);
      if (r.ok) { for (const ev of sim.takeEvents()) handleEvent(ev); saveNow(); draw(k2 === 'v' ? 'かったよ! じたくの ガレージに ならんだよ!' : 'まいどあり!'); } else draw(r.why || '');
    };
  };
  // じたく(ガレージ): もっている のりものに のる
  const openGarage = () => {
    const draw = (note = 'もっている のりものに「のる」で じたくの まえから のれるよ。あたらしい のりものは「トレッサ」で かおう') => {
      const mine = S.vehicles.filter((v) => !v.temp && (v.kind === 'tank' || (v.cat === undefined && v.kind === 'plane'))).map((v) => ({ id: v.id, icon: v.kind === 'tank' ? '🚜' : '✈️', name: v.name || (v.kind === 'tank' ? 'せんしゃ' : 'ひこうき'), desc: 'ぼうえいたいの きたい' }));
      const groups = [['🚗 くるま', 'car'], ['🏍️ バイク', 'bike'], ['✈️ ひこうき・せんとうき', 'air']];
      shopEl.innerHTML = `<div class="sh-box"><h3>🏠 じたく ガレージ</h3>${mine.length ? `<div class="sh-grp">🛡️ ぼうえいたいの きたい</div>${mine.map((m) => `<button class="sh-item own" data-ride="${m.id}"><span>${m.icon}</span><div><b>${esc(m.name)}</b><small>${esc(m.desc)}</small></div><em>▶ のる</em></button>`).join('')}` : ''}${groups.map(([t, g]) => { const l = VCAT.filter((it) => S.owned.includes(it.id) && (g === 'air' ? isAir(it.kind) : it.kind === g)); return l.length ? `<div class="sh-grp">${t}</div>${l.map((it) => `<button class="sh-item own" data-ride="${it.id}"><span>${it.icon}</span><div><b>${esc(it.name)}</b><small>${esc(it.desc)}</small></div><em>▶ のる</em></button>`).join('')}` : ''; }).join('')}<div class="sh-note">${note}</div><button class="btn gray sh-x">とじる</button></div>`;
    };
    openModal(draw);
    shopEl.onclick = (e) => { if (e.target.closest('.sh-x')) { closeModal(); return; } const b = e.target.closest('.sh-item'); if (!b || b.disabled) return; if (b.dataset.ride) { const r = sim.summon(b.dataset.ride); if (r.ok) closeModal(); else draw(r.why || ''); } };
  };
  const openWeapons = () => {
    const draw = () => { const mine = WEAPONS.filter((w) => S.wOwned.includes(w.id)); shopEl.innerHTML = `<div class="sh-box"><h3>🎒 ぶきリスト</h3>${mine.map((w) => `<button class="sh-item ${P.weapon === w.id ? 'trk' : ''}" data-id="${w.id}"><span>${w.icon}</span><div><b>${esc(w.name)}</b><small>${w.cat}</small></div><em>${P.weapon === w.id ? '✔' : ''}</em></button>`).join('')}<div class="sh-note">ぶきを タップで そうび。ぶきは ぶきやで かえるよ</div><button class="btn gray sh-x">とじる</button></div>`; };
    openModal(draw);
    shopEl.onclick = (e) => { if (e.target.closest('.sh-x')) { closeModal(); return; } const b = e.target.closest('.sh-item'); if (!b) return; sim.equip(b.dataset.id); saveNow(); closeModal(); };
  };
  // ---- おしごと(もんだいに こたえて おきゅうりょう) ----
  const openJob = () => {
    const N = 5; const st = { n: 0, ok: 0, subj: 'mix', q: null };
    const intro = () => { shopEl.innerHTML = `<div class="sh-box"><h3>💼 おしごとセンター</h3><div class="sh-coin">🪙 ${P.coins}</div><p class="jb-p">もんだいに こたえて おきゅうりょうを もらおう!<br>${N}もん・せいかい 1もんで 🪙40・ぜんぶ せいかいで +🪙80</p><button class="sh-item" data-s="算数"><span>🔢</span><div><b>さんすうの おしごと</b><small>けいさんや ずけい</small></div></button><button class="sh-item" data-s="国語"><span>📖</span><div><b>こくごの おしごと</b><small>かんじ・ことば</small></div></button><button class="sh-item" data-s="mix"><span>🎲</span><div><b>おまかせ</b><small>さんすう+こくご</small></div></button><button class="btn gray sh-x">とじる</button></div>`; };
    const ask = () => {
      const subj = st.subj === 'mix' ? (st.n % 2 ? '国語' : '算数') : st.subj; const q = o.getJobQuestion ? o.getJobQuestion(subj) : null;
      if (!q) { shopEl.innerHTML = `<div class="sh-box"><h3>💼 おしごと</h3><p class="jb-p">いまは おしごとが ないみたい…</p><button class="btn gray sh-x">とじる</button></div>`; return; }
      st.q = q; shopEl.innerHTML = `<div class="sh-box jb"><h3>💼 おしごと ${st.n + 1}/${N}</h3><div class="jb-q">${q.text}</div>${q.choices.map((c, i) => `<button class="sh-item jb-c" data-i="${i}"><b>${c.label}</b></button>`).join('')}<div class="sh-note jb-r"></div></div>`;
    };
    const done = () => {
      const perfect = st.ok === N; const pay = st.ok * 40 + (perfect ? 80 : 0); if (pay) sim.addCoins(pay); if (o.onJobDone) o.onJobDone({ correct: st.ok, total: N, pay, perfect }); saveNow();
      shopEl.innerHTML = `<div class="sh-box"><h3>💼 おつかれさま!</h3><div class="jb-big">${perfect ? '🌟 パーフェクト!' : st.ok >= 3 ? '👍 よくできました' : 'ざんねん…またね'}</div><p class="jb-p">せいかい ${st.ok}/${N}<br>おきゅうりょう 🪙+${pay}</p><div class="sh-coin">🪙 ${P.coins}</div><button class="sh-item" data-again="1"><span>🔁</span><div><b>もういちど はたらく</b></div></button><button class="btn gray sh-x">とじる</button></div>`;
    };
    openModal(intro);
    shopEl.onclick = (e) => {
      if (e.target.closest('.sh-x')) { closeModal(); return; }
      const sb = e.target.closest('[data-s]'); if (sb) { st.subj = sb.dataset.s; st.n = 0; st.ok = 0; ask(); return; }
      if (e.target.closest('[data-again]')) { intro(); return; }
      const nx = e.target.closest('.jb-next'); if (nx) { st.n++; if (st.n >= N) done(); else ask(); return; }
      const c = e.target.closest('.jb-c'); if (!c || c.dataset.done) return; const ch = st.q.choices[+c.dataset.i]; shopEl.querySelectorAll('.jb-c').forEach((x) => { x.dataset.done = '1'; const k = st.q.choices[+x.dataset.i]; x.classList.add(k.ok ? 'good' : 'dim'); });
      if (ch.ok) { st.ok++; snd0('win'); } else snd0('lose'); const r = shopEl.querySelector('.jb-r'); r.innerHTML = `<b>${ch.ok ? '⭕ せいかい! 🪙+40' : '❌ ざんねん'}</b>${st.q.why ? `<div class="jb-why">${st.q.why}</div>` : ''}<button class="btn gold jb-next">${st.n + 1 >= N ? 'けっかを みる' : 'つぎへ ▶'}</button>`;
    };
  };
  const snd0 = (n) => { if (o.onSfx) o.onSfx(n); };
  const openBoard = () => {
    const draw = (note = 'タップで ついせき(ちずに 🎯)。たおして ばんざいした はんにんに ちかづいて「たいほ」! はじめての たいほは チケットも もらえるよ') => {
      sim.refreshWanted();
      shopEl.innerHTML = `<div class="sh-box"><h3>📋 してい手配ボード</h3><div class="sh-coin">🪙 ${P.coins}・つかまえた ${S.stats.arrests}にん</div>${S.wanted.map((w) => `<button class="sh-item bd ${S.tracked === w.id ? 'trk' : ''}" data-id="${w.id}"><span>${'⭐'.repeat(w.stars)}</span><div><b>${esc(w.name)}</b><small>${esc(w.crime)}${w.caught ? `・たいほ ${w.caught}かい` : ''}${w.alive ? '' : '・(いまは いないよ)'}</small></div><em>🪙${w.bounty}${S.tracked === w.id ? ' 🎯' : ''}</em></button>`).join('')}<div class="sh-note">${note}</div><button class="btn gray sh-x">とじる</button></div>`;
    };
    openModal(draw);
    shopEl.onclick = (e) => { if (e.target.closest('.sh-x')) { closeModal(); return; } const b = e.target.closest('.sh-item'); if (!b) return; sim.track(b.dataset.id); draw(S.tracked ? 'ついせき ちゅう! ちずを みてね' : 'ついせきを やめたよ'); };
  };
  const handleEvent = (e) => {
    if (e.t === 'reward' && o.onReward) { o.onReward(e); saveNow(); } else if (e.t === 'bounty') { if (o.onBounty) o.onBounty(e); saveNow(); } else if (e.t === 'arrest') saveNow();
    else if (e.t === 'buy' && o.onBuy) o.onBuy(e.id); else if (e.t === 'buyveh') { if (o.onBuyVeh) o.onBuyVeh(e.id); } else if (e.t === 'store') openStore(e.id); else if (e.t === 'garage') openGarage(); else if (e.t === 'board') openBoard(); else if (e.t === 'job') openJob(); else if (e.t === 'soccer') { saveNow(); if (o.onSoccer) { destroy(); o.onSoccer(); } } else if (e.t === 'buywep' && o.onBuyWeapon) o.onBuyWeapon(e.id);
  };

  // ---- HUD ----
  const q = (s) => root.querySelector(s); const hud = { hp: q('.ab.hp u'), hpw: q('.ab.hp'), boost: q('.ab.boost u'), ms: q('.ab.ms b'), msw: q('.ab.ms'), coin: q('.c3d-coin b'), mis: q('.c3d-mis'), misN: q('.c3d-mis .a3d-name'), misO: q('.c3d-mis .a3d-obj'), banner: q('.a3d-banner'), msg: q('.a3d-msg'), warn: q('.a3d-warn'), ret: q('.a3d-ret'), act: q('.ab-act'), gun: q('.ab-gun'), cancel: q('.c3d-cancel'), track: q('.c3d-track'), pinhud: q('.c3d-pinhud'), stars: q('.c3d-stars'), wep: q('.c3d-wep'), wpb: q('.ab-wp'), map: q('.c3d-map').getContext('2d'), big: bigmap.querySelector('canvas').getContext('2d') };
    let lastBanner = ''; const v3 = new THREE.Vector3();
  const project = (x, y, z) => { v3.set(x, y, z).project(camera); return { x: (v3.x * 0.5 + 0.5) * root.clientWidth, y: (-v3.y * 0.5 + 0.5) * root.clientHeight, z: v3.z }; };
  const drawMap = (g, R, size, rot) => {
    g.clearRect(0, 0, size, size); g.save(); g.translate(size / 2, size / 2); const sc = size / (2 * R); if (rot) g.rotate(P.yaw + Math.PI); g.scale(sc, sc); g.translate(rot ? -P.x : 0, rot ? -P.z : 0);
    g.fillStyle = '#2a6ea0'; g.fillRect(-1700, -1700, 3400, 3400); g.drawImage(gc, -MAPR, -MAPR, MAPR * 2, MAPR * 2);
        const dot = (x, z, c, r, sq) => { g.fillStyle = c; if (sq) g.fillRect(x - r, z - r, r * 2, r * 2); else { g.beginPath(); g.arc(x, z, r, 0, 6.283); g.fill(); } };
    g.lineWidth = rot ? R / 90 : 3; g.strokeStyle = 'rgba(40,40,46,.9)'; g.setLineDash([]); for (const [nm, P] of Object.entries(RAILS)) { g.strokeStyle = nm === 'shin' ? 'rgba(40,170,180,.95)' : 'rgba(30,30,36,.95)'; g.setLineDash(nm === 'shin' ? [16, 10] : []); g.beginPath(); P.forEach(([x, z], i) => (i ? g.lineTo(x, z) : g.moveTo(x, z))); g.stroke(); } g.setLineDash([]);
    const rr = rot ? R / 26 : 7; for (const { m } of startMarkers) if (!S.mission) { dot(m.start.x, m.start.z, '#ffd23f', rr * 1.1); }
    if (S.mission && S.mission.targets && S.mission.targets[S.mission.stage]) { const t = S.mission.targets[S.mission.stage]; dot(t.x, t.z, '#27d8ff', rr * 1.3); }
    if (S.mission && (S.mission.id === 'rescue' || (S.mission.id === 'delivery' && S.mission.stage === 1))) dot(HQ.x, HQ.z, '#7dffa0', rr * 1.3);
    for (const c of S.civs) if (c.state === 'need') dot(c.x, c.z, '#ff9ad0', rr);
    for (const c of S.crooks) { if (c.state === 'down') dot(c.x, c.z, '#27d8ff', rr * 1.1); else if (c.wid) dot(c.x, c.z, '#ff2a3a', rr * 1.5); else if (c.minor) dot(c.x, c.z, '#ff9f43', rr * 1.1); else dot(c.x, c.z, '#a83a46', rr * 0.8); }
    if (S.tracked) { const w = S.wanted.find((x) => x.id === S.tracked); if (w && w.alive) { g.strokeStyle = '#fff'; g.lineWidth = rr * 0.5; g.beginPath(); g.arc(w.x, w.z, rr * (2.2 + Math.sin(tt * 6) * 0.5), 0, 6.283); g.stroke(); } }
    dot(GARAGE.x, GARAGE.z, '#ff9f43', rr * 1.1, true); dot(BOARD.x, BOARD.z, '#e8d9a0', rr * 1.0, true); dot(JOB.x, JOB.z, '#7fe7ff', rr, true); dot(SOCCER.x, SOCCER.z, '#9fe29f', rr * 1.1, true); for (const st of STORES) dot(st.x, st.z, '#ffb35a', rr * (st.id === 'tresa' || st.id === 'apita' ? 1.6 : 0.95), true);
    for (const v of S.vehicles) if (!v.occ && !v.temp) dot(v.x, v.z, '#6ab0ff', rr * 0.9, true);
    if (pin) { // ピン(ルートの ガイドせん つき)
      const pr = rot ? R / 26 : 7; g.save(); g.setLineDash([pr * 2.4, pr * 1.6]); g.strokeStyle = 'rgba(255,90,110,.9)'; g.lineWidth = pr * 0.45; g.beginPath(); g.moveTo(P.x, P.z); g.lineTo(pin.x, pin.z); g.stroke(); g.setLineDash([]);
      const dx = pin.x - P.x; const dz = pin.z - P.z; const dd = Math.hypot(dx, dz); let px = pin.x; let pz = pin.z; if (rot && dd > R * 0.82) { px = P.x + (dx / dd) * R * 0.82; pz = P.z + (dz / dd) * R * 0.82; }
      g.fillStyle = '#ff4d6a'; g.strokeStyle = '#fff'; g.lineWidth = pr * 0.3; g.beginPath(); g.arc(px, pz, pr * 1.6, 0, 6.283); g.fill(); g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.arc(px, pz, pr * 0.6, 0, 6.283); g.fill(); g.restore(); }
    if (!rot) { const ar = R / 34; const ang = Math.atan2(Math.cos(P.yaw), Math.sin(P.yaw)); g.save(); g.translate(P.x, P.z); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = ar * 0.25; g.beginPath(); g.arc(0, 0, ar * (2.2 + Math.sin(tt * 4) * 0.4), 0, 6.283); g.stroke(); g.rotate(ang); g.fillStyle = '#ffe14a'; g.strokeStyle = '#222'; g.lineWidth = ar * 0.22; g.beginPath(); g.moveTo(ar * 1.7, 0); g.lineTo(-ar, ar * 1.05); g.lineTo(-ar * 0.45, 0); g.lineTo(-ar, -ar * 1.05); g.closePath(); g.fill(); g.stroke(); g.restore(); }
    g.restore();
    if (rot) { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(size / 2, size / 2 - 9); g.lineTo(size / 2 - 7, size / 2 + 8); g.lineTo(size / 2 + 7, size / 2 + 8); g.closePath(); g.fill(); g.strokeStyle = '#27d8ff'; g.lineWidth = 3; g.beginPath(); g.arc(size / 2, size / 2, size / 2 - 2, 0, 6.283); g.stroke(); }
  };
  function updateHud() {
    const v = sim.vehicleOf(); const hp = v ? v.hp / v.hpMax : P.hp / P.hpMax; hud.hp.style.width = `${clamp(hp, 0, 1) * 100}%`; hud.hpw.classList.toggle('low', hp < 0.3); hud.boost.style.width = `${clamp(P.boost, 0, 100)}%`;
    const hasMis = !!(v && v.V.missiles); hud.msw.style.display = hasMis ? '' : 'none'; if (hasMis) hud.ms.textContent = `🚀 ×${v.mis == null ? v.V.missiles : v.mis}`; root.querySelector('.ab-ms').style.display = hasMis ? '' : 'none';
    hud.coin.textContent = P.coins;
    const n = S.nearby; const showAct = !!n && n.kind !== 'exit' || (n && n.kind === 'exit'); hud.act.hidden = !showAct; if (showAct) { hud.act.textContent = n.label; hud.act.classList.toggle('exit', n.kind === 'exit'); }
    const M = S.mission; hud.mis.hidden = !M; hud.cancel.hidden = !M;
    if (M) { hud.misN.textContent = `${M.icon} ${M.name}`; let t = `${M.got}/${M.total}`; if (M.id === 'delivery') t = M.stage === 0 ? '📦 にもつを うけとりに いこう' : `⏱ のこり ${Math.max(0, Math.ceil(M.timeLeft))}びょう → ほんぶへ!`; else if (M.id === 'rescue') t = `たすけた ${M.got}/${M.total}・いっしょに いる ${P.carry}にん → ほんぶへ`; else if (M.id === 'gang') t = `のこり ${S.crooks.filter((c) => c.mission).length}にん・たおれた はんにんを たいほ!`; else if (M.id === 'harbor' && !(v && (v.kind === 'ship' || isAir(v.kind)))) t += ' (ふねに のろう)'; else if (M.id === 'sky' && !(v && isAir(v.kind))) t += ' (ひこうきに のろう)'; hud.misO.textContent = t; }
    const b = S.bannerT > 0 ? S.banner : ''; if (b !== lastBanner) { lastBanner = b; hud.banner.textContent = b; hud.banner.classList.toggle('on', !!b); }
    hud.msg.textContent = S.msgT > 0 ? S.msg : ''; hud.warn.textContent = P.dead > 0 ? '😵 ふっかつちゅう…' : ''; root.classList.toggle('hurt', P.hurt > 0);
    // しょうじゅん
    const kind = v ? v.kind : 'foot'; const air = isAir(kind); const ay = air ? v.yaw : P.yaw + P.aimRel; const ap = air ? v.pitch : P.aimPitch; const o0 = air ? { x: v.x, y: v.y, z: v.z } : { x: P.x, y: 2, z: P.z }; const rp = project(o0.x + Math.sin(ay) * Math.cos(ap) * 200, o0.y + Math.sin(ap) * 200, o0.z + Math.cos(ay) * Math.cos(ap) * 200); hud.ret.style.left = `${rp.x}px`; hud.ret.style.top = `${rp.y}px`; hud.ret.style.display = rp.z < 1 && P.dead <= 0 ? '' : 'none'; hud.ret.classList.toggle('lock', !!P.target && air);
    { let st = 0; for (const c of S.crooks) { if (!c.wid || c.state === 'down') continue; const d = Math.hypot(c.x - P.x, c.z - P.z); if (c.alert || d < 70) { const w = S.wanted.find((x) => x.id === c.wid); if (w && w.stars > st) st = w.stars; } } hud.stars.textContent = st ? '⭐'.repeat(st) : ''; hud.stars.classList.toggle('on', !!st); }
    { const W = weaponOf(P.weapon) || {}; hud.wep.hidden = kind !== 'foot'; hud.wep.textContent = `${W.icon || ''} ${W.name || ''}`; hud.wpb.style.display = kind === 'foot' ? '' : 'none'; }
    hud.gun.textContent = kind === 'foot' ? (weaponOf(P.weapon) && weaponOf(P.weapon).melee ? 'なぐる' : 'うつ') : kind === 'car' || kind === 'bike' ? 'ビーム' : 'こうげき'; root.querySelector('.ab-tg').style.display = air ? 'none' : '';
    if (pin) { const dd = Math.hypot(pin.x - P.x, pin.z - P.z); if (dd < 14) { setPin(null); S.msg = '🎉 もくてきちに ついたよ!'; S.msgT = 2.5; if (o.onSfx) o.onSfx('win'); } else { const ang = Math.atan2(pin.x - P.x, pin.z - P.z) - (P.yaw + 0); let dA = ang; while (dA > Math.PI) dA -= 2 * Math.PI; while (dA < -Math.PI) dA += 2 * Math.PI; const arrow = Math.abs(dA) < 0.35 ? '⬆' : dA > 0 ? (Math.abs(dA) > 2.4 ? '⬇' : '⬅') : (Math.abs(dA) > 2.4 ? '⬇' : '➡'); hud.pinhud.hidden = false; hud.pinhud.textContent = `📍 ${arrow} ${dd >= 1000 ? (dd / 1000).toFixed(1) + 'km' : Math.round(dd) + 'm'}`; } } else hud.pinhud.hidden = true;
    { const w = S.tracked ? S.wanted.find((x) => x.id === S.tracked) : null; hud.track.hidden = !w; if (w) hud.track.textContent = w.alive ? `🎯 ${w.name} 🪙${w.bounty} ・ ${Math.round(Math.hypot(w.x - P.x, w.z - P.z))}m` : `🎯 ${w.name}(いまは いないよ)`; }
    drawMap(hud.map, 240, 150, true); if (!bigmap.hidden) drawMap(hud.big, HALF + 40, 640, false);
  }
  // ---- かく ----
  const cam = { x: 0, y: 0, z: 0, init: false }; let tt = 0; let raf = 0; let last = 0; let acc = 0; let trailT = 0; let lastEffN = 0;
    function syncScene(dt) {
    const v = sim.vehicleOf(); const kind = v ? v.kind : 'foot';
    // じぶん
    me.visible = !v && P.dead <= 0; me.position.set(P.x, P.chute ? P.y : 0, P.z); me.rotation.y = P.yaw; { const u = me.userData; const sp = Math.abs(P.speed); const sw = Math.sin(tt * 11) * Math.min(1, sp / 5) * 0.9; u.legL.rotation.x = sw; u.legR.rotation.x = -sw; u.armL.rotation.x = -sw * 0.8; u.armR.rotation.x = sw * 0.8; const W = weaponOf(P.weapon) || {}; if (heldId !== P.weapon) { heldId = P.weapon; if (heldM) u.handR.remove(heldM); heldM = makeWeaponModel(THREE, W.id || 'fist'); u.handR.add(heldM); } if (W.melee) { if (S.swing > 0) { u.armR.rotation.x = -2.3 + (1 - S.swing / 0.25) * 2.6; } else u.armR.rotation.x = -0.5 + (sw > 0 ? 0 : 0); } else { const long = ['ライフル', 'SMG', 'マシンガン', 'スナイパー', 'ショットガン'].includes(W.cat); if (sim.input.gun && P.dead <= 0) { u.armR.rotation.x = -1.5; u.armL.rotation.x = long ? -1.4 : -1.3; } else if (!W.expl || W.range > 100) u.armR.rotation.x = Math.min(u.armR.rotation.x, -0.55); } if (P.chute) { u.armL.rotation.x = u.armR.rotation.x = -2.8; } me.position.y += Math.abs(Math.sin(tt * 11)) * Math.min(1, sp / 5) * 0.1; poseLimbs(u); }
    shield.visible = P.invuln > 0; shield.position.set(P.x, (v ? v.y : P.y) + (isAir(kind) ? 0 : 3), P.z); shield.scale.setScalar(kind === 'foot' ? 1 : isAir(kind) ? 3 : 4);
    // のりもの
    const vseen = new Set();
    for (const vv of S.vehicles) {
      vseen.add(vv.id); const m = vmodels.get(vv.id) || mkVehModel(vv); const air = isAir(vv.kind); const u = m.userData;
      m.position.set(vv.x, vv.kind === 'ship' ? Math.sin(tt * 1.6 + vv.x) * 0.4 : air ? vv.y : 0, vv.z); m.rotation.order = 'YXZ';
      if (air) { m.rotation.set(-vv.pitch, vv.yaw, vv.roll); const bo = vv.occ && input_boost(); if (u.flame) u.flame.scale.set(1, 1, bo ? 2.4 : 1); if (u.flames) u.flames.forEach((f) => f.scale.set(1, 1, vv.occ ? (bo ? 1.6 : 0.8 + Math.sin(tt * 40) * 0.1) : 0.01)); if (u.prop) u.prop.rotation.z += dt * (vv.occ ? 40 : 0); }
      else m.rotation.set(0, vv.yaw, vv.roll * (vv.kind === 'bike' ? 1.3 : 0.5));
      if (u.nav) { u.nav.strobe.visible = Math.floor(tt * 1.6) % 2 === 0; }
      if (u.rider) u.rider.visible = !!vv.occ;
      if (vv.occ && vv.id === P.veh) { const ty = P.yaw + P.aimRel - vv.yaw; if (u.turrets) u.turrets.forEach((t) => { t.rotation.y = ty; }); if (u.turret) u.turret.rotation.y = ty; }
      if (u.radar) u.radar.rotation.y = tt * 3; if (u.siren) { const on = Math.floor(tt * 6) % 2 === 0; u.siren[0].visible = on; u.siren[1].visible = !on; }
    }
    for (const [id, m] of vmodels) if (!vseen.has(id)) { scene.remove(m); vmodels.delete(id); }
    // ひと(ちかくだけ つくる)
    const people = [...S.walkers.map((w) => ({ ...w, kind: 'walk' })), ...S.civs.map((c) => ({ ...c, kind: 'civ' }))]; const seen = new Set();
    for (const w of people) { const d = Math.hypot(w.x - P.x, w.z - P.z); if (d > 240) continue; seen.add(w.id); let m = npcs.get(w.id); if (!m) { if (npcs.size >= 18) continue; m = mkNpc(w.id); npcs.set(w.id, m); } m.position.set(w.x, 0, w.z); m.rotation.y = w.yaw; const moving = w.kind === 'walk' || w.state === 'carried'; const sw = Math.sin(tt * (w.scared > 0 ? 14 : 8) + w.id) * (moving ? 0.7 : 0); const u = m.userData; const need = w.kind === 'civ' && w.state === 'need'; u.legL.rotation.x = sw; u.legR.rotation.x = -sw; u.armL.rotation.x = need ? -2.7 + Math.sin(tt * 10) * 0.3 : -sw * 0.8; u.armR.rotation.x = need ? -2.7 - Math.sin(tt * 10) * 0.3 : sw * 0.8; poseLimbs(u); if (w.kind === 'civ') m.visible = w.state !== 'safe'; }
    for (const [id, m] of npcs) if (!seen.has(id)) { scene.remove(m); npcs.delete(id); }
    // くるま(かざり)
    for (const c of S.traffic) { let m = trafficM.get(c.id); if (!m) { m = makeCarModel(THREE, c.model || 'sedan', (c.model || 'sedan') === 'sedan' ? ['#4a90d9', '#d85a8a', '#5aa86a', '#8a8f9a', '#f2f2f2', '#6a4ad8', '#2a2e38', '#b8c0cc'][c.tone % 8] : undefined); m.traverse((x) => { if (x.isMesh) x.castShadow = shadowsOn; }); scene.add(m); trafficM.set(c.id, m); } m.position.set(c.x, 0, c.z); m.rotation.y = c.yaw; m.visible = Math.hypot(c.x - P.x, c.z - P.z) < 700; }
    for (const [id, m] of trafficM) if (!S.traffic.some((c) => c.id === id)) { scene.remove(m); trafficM.delete(id); }
    // はんにん(してい手配はんは なまえと けんしょう金の ふだつき)
    const rseen = new Set();
    for (const c of S.crooks) {
      const d = Math.hypot(c.x - P.x, c.z - P.z); if (d > 320) continue; let e = crookM.get(c.id);
      if (!e) { if (crookM.size >= 28) continue; const m = crookPerson(THREE, c.type, c.id); m.traverse((x) => { if (x.isMesh) x.castShadow = shadowsOn; }); scene.add(m); e = { m, label: null, cuff: null, lx: c.x, lz: c.z, sub: '' }; const cf = iconSprite(THREE, '🚔', '#27d8ff'); cf.scale.set(3.4, 3.4, 1); cf.visible = false; scene.add(cf); e.cuff = cf; crookM.set(c.id, e); }
      rseen.add(c.id); const m = e.m; const u = m.userData; const w = c.wid ? S.wanted.find((x) => x.id === c.wid) : null; const sub = c.wid ? `${'⭐'.repeat(w ? w.stars : 1)} 🪙${w ? w.bounty : 0}` : c.minor ? '🪙40' : ''; const nm = c.wid ? (w ? w.name : '') : c.minor ? 'ひったくり' : '';
      if (nm && (sub !== e.sub || !e.label)) { if (e.label) { scene.remove(e.label); e.label.material.map.dispose(); e.label.material.dispose(); } e.label = labelSprite(THREE, nm, sub, c.wid ? '#ff5a5a' : '#ffb35a', 300); scene.add(e.label); e.sub = sub; }
      const down = c.state === 'down'; const mv = Math.hypot(c.x - e.lx, c.z - e.lz) / Math.max(dt, 0.001); e.lx = c.x; e.lz = c.z; const sw = down ? 0 : Math.sin(tt * (mv > 4 ? 12 : 8) + c.ph) * Math.min(0.8, mv / 4);
      m.position.set(c.x, down ? -0.42 : 0, c.z); m.rotation.y = c.yaw; u.legL.rotation.x = down ? 1.35 : sw; u.legR.rotation.x = down ? 1.35 : -sw;
      if (down) { u.armL.rotation.x = -2.9; u.armR.rotation.x = -2.9; } else { const aim = (c.alert || d < 80) && c.type !== 'runner'; u.armL.rotation.x = -sw * 0.8; u.armR.rotation.x = aim ? -1.45 : u.gun ? -0.35 : sw * 0.8; }
      poseLimbs(u);
      if (e.label) { e.label.visible = d < 160 && P.dead <= 0; e.label.position.set(c.x, (c.type === 'boss' ? 3.9 : 3.5) + (down ? -0.6 : 0), c.z); }
      e.cuff.visible = down && d < 60; e.cuff.position.set(c.x, 3.2, c.z); e.cuff.scale.setScalar(3.4 + Math.sin(tt * 6) * 0.4);
    }
    for (const [id, e] of crookM) if (!rseen.has(id)) { scene.remove(e.m); if (e.label) scene.remove(e.label); scene.remove(e.cuff); crookM.delete(id); }
    // ひろいもの
    const pseen = new Set(); for (const p of S.pickups) { if (Math.hypot(p.x - P.x, p.z - P.z) > 300) continue; pseen.add(p.id); let m = pickM.get(p.id); if (!m) { m = p.kind === 'gem' ? new THREE.Mesh(new THREE.OctahedronGeometry(1.4), new THREE.MeshBasicMaterial({ color: '#7ff3ff' })) : new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.3, 16), new THREE.MeshBasicMaterial({ color: '#ffd23f' })); if (p.kind !== 'gem') m.rotation.x = Math.PI / 2; scene.add(m); pickM.set(p.id, m); } m.position.set(p.x, 1.8 + Math.sin(tt * 3 + p.id) * 0.3, p.z); m.rotation.y = tt * 3; }
    for (const [id, m] of pickM) if (!pseen.has(id)) { scene.remove(m); pickM.delete(id); }
    // たま・ビーム・ミサイル
    S.bullets.forEach((b, i) => { const m = pool(poolB, bulletGeo, bulletMat, i); m.visible = true; m.position.set(b.x, b.y, b.z); }); for (let i = S.bullets.length; i < poolB.length; i++) poolB[i].visible = false;
    S.tracers.forEach((t, i) => { const m = pool(poolT, trGeo, trMat, i); m.visible = true; const a = t.from; const b = t.to; const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z); m.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); m.scale.set(1, Math.min(len, 80), 1); m.lookAt(b.x, b.y, b.z); m.rotateX(Math.PI / 2); }); for (let i = S.tracers.length; i < poolT.length; i++) poolT[i].visible = false;
    S.missiles.forEach((b, i) => { const m = pool(poolM, misGeo, misMat, i); m.visible = true; m.position.set(b.x, b.y, b.z); m.lookAt(b.x + b.vx, b.y + b.vy, b.z + b.vz); m.rotateX(Math.PI / 2); }); for (let i = S.missiles.length; i < poolM.length; i++) poolM[i].visible = false;
    for (const e of S.effects) { const key = `${e.kind}:${Math.round(e.x / 3)}:${Math.round(e.y / 3)}:${Math.round(e.z / 3)}`; if (e.t < 0.2 && !seenFx.has(key)) { seenFx.set(key, tt); if (e.kind === 'spark') fx.spark(e.x, e.y, e.z, e.r * 0.6); else fx.explode(e.x, e.y, e.z, Math.max(2.5, e.r * 0.4), e.kind === 'big'); } } for (const [k, t0] of seenFx) if (tt - t0 > 2.5) seenFx.delete(k);
    trailT += dt; if (trailT > 0.04) { trailT = 0; for (const mi of S.missiles) { fx.puff(mi.x - mi.vx * 0.02, mi.y - mi.vy * 0.02, mi.z - mi.vz * 0.02, 1.4, 0.8); fx.flame(mi.x, mi.y, mi.z, 2); } }
    // めじるし
    for (const { m, g } of startMarkers) { g.visible = !S.mission; g.userData.ring.rotation.z = tt; void m; }
    const M = S.mission; targetMarker.visible = false; ringM.visible = false; hqMarker.visible = !!M && (M.id === 'rescue' || (M.id === 'delivery' && M.stage === 1));
    if (M && M.targets && M.targets[M.stage]) { const t = M.targets[M.stage]; if (M.id === 'sky') { ringM.visible = true; ringM.position.set(t.x, t.y, t.z); const a = Math.atan2(t.x - P.x, t.z - P.z); ringM.rotation.set(0, a, 0); } else { targetMarker.visible = true; targetMarker.position.set(t.x, M.id === 'harbor' ? -1 : 0, t.z); targetMarker.userData.ring.rotation.z = tt; } }
    for (const t of trains) { const u = t.userData; u.s += u.dir * u.speed * dt; const pa = pathAt(u.name, u.s, u.off); t.position.set(pa.x, 12, pa.z); t.rotation.y = -pa.ang + (u.dir < 0 ? Math.PI : 0); }
    hqMarker.userData.ring.rotation.z = tt; for (const g of markers) g.userData.ring.rotation.z = tt;
    // カメラ
    const f = { x: Math.sin(P.yaw) * Math.cos(P.pitch || 0), y: Math.sin(P.pitch || 0), z: Math.cos(P.yaw) * Math.cos(P.pitch || 0) };
    let bx; let by; let bz; let lx; let ly; let lz; const k = 1 - Math.exp(-8 * dt);
    if (isAir(kind)) { const dd = kind === 'jet' ? 30 : 26; bx = P.x - f.x * dd; by = P.y - f.y * dd + 7; bz = P.z - f.z * dd; lx = P.x + f.x * 90; ly = P.y + f.y * 90; lz = P.z + f.z * 90; }
    else { const cy = kind === 'tank' || kind === 'ship' ? P.yaw + P.aimRel : P.yaw; const d = { foot: 5.4, car: 11, bike: 8, tank: 30, ship: 68 }[kind]; const h = { foot: 2.7, car: 4.6, bike: 3.8, tank: 15, ship: 30 }[kind]; bx = P.x - Math.sin(cy) * d; by = (P.chute ? P.y : 0) + h; bz = P.z - Math.cos(cy) * d; lx = P.x + Math.sin(cy) * 80; ly = (P.chute ? P.y : 0) + (kind === 'foot' ? 2 : 6) + (kind === 'tank' || kind === 'ship' ? Math.tan(P.aimPitch) * 80 : 0); lz = P.z + Math.cos(cy) * 80; }
    if (!cam.init) { cam.x = bx; cam.y = by; cam.z = bz; cam.init = true; } cam.x += (bx - cam.x) * k; cam.y += (by - cam.y) * k; cam.z += (bz - cam.z) * k;
    camera.position.set(cam.x, Math.max(2.2, cam.y), cam.z); camera.up.set(0, 1, 0); camera.lookAt(lx, ly, lz);
    sky.position.set(camera.position.x, 0, camera.position.z); sea.position.x = camera.position.x; sea.position.z = camera.position.z; sea.material.uniforms.time.value = tt;
    sun.position.set(P.x + sunDir.x * 300, sunDir.y * 300, P.z + sunDir.z * 300); sun.target.position.set(P.x, 0, P.z);
    fx.update(dt, renderer.domElement.height / (2 * Math.tan((camera.fov * Math.PI) / 360)));
  }
  const input_boost = () => sim.input.boost;
  function frame(ts) {
    if (dead) return; const dt = Math.min(0.05, last ? (ts - last) / 1000 : 0.016); last = ts; tt += dt;
    if (!paused && !portrait) { acc += dt; let n = 0; while (acc >= 1 / 60 && n++ < 4) { sim.step(1 / 60); acc -= 1 / 60; } while (S.snd.length) { const nm = S.snd.shift(); if (o.onSfx) o.onSfx(nm); } for (const e of sim.takeEvents()) handleEvent(e); }
    syncScene(dt); updateHud(); if (post) post.render(scene, camera, tt); else renderer.render(scene, camera); raf = requestAnimationFrame(frame);
  }
  function destroy() {
    if (dead) return; dead = true; cancelAnimationFrame(raf); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('resize', resize); window.removeEventListener('orientationchange', resize);
    try { fx.dispose(); if (post) post.dispose(); renderer.dispose(); scene.traverse((ob) => { if (ob.geometry) ob.geometry.dispose(); if (ob.material) (Array.isArray(ob.material) ? ob.material : [ob.material]).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); }); } catch { /* ok */ }
    root.remove(); document.body.style.overflow = prevOv; try { if (document.fullscreenElement) document.exitFullscreen(); if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch { /* ok */ }
  }
  void SPAWN; void isWater; void lastEffN;
  raf = requestAnimationFrame(frame);
  const api = { destroy: () => { if (ACTIVE === api) ACTIVE = null; saveNow(); destroy(); }, sim, root, renderer, scene, camera };
  ACTIVE = api; return api;
}
