// 地球防衛隊「シティ」の 3Dがめん(three.js): じゆうに うごける まち。ルールは citysim.js。
//   const g = await startCity3D({ kidName, stats, vehicles, specs, coins, done, calm, onSfx, onReward, onBuy, onQuit });
import { createCity, LAYOUT, LINES, BAY, AIRFIELD, PLAZA, HQ, SHOP, SPAWN, CITY_MISSIONS, SHOP as SHOPD, isWater } from './citysim.js';
import { makeVehicleModel } from './vehicle3d.js';
import { makePlayerModel } from './stadium3d.js';
import { look } from './match.js';
import { makeFx } from './fx3d.js';
import { skyMat, SEA_VS, SEA_FS, envTexture } from './world3d.js';

let T = null;
async function loadThree() { if (!T) T = await import('./vendor/three.module.min.js'); return T; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = (s) => String(s).replace(/[<>&"]/g, '');
let ACTIVE = null;
const MAPR = 680; // マップの はんぶんの おおきさ(m)

// ---- テクスチャ ----------------------------------------------------------------------------
function groundCanvas() {
  const S = 2048; const k = S / (MAPR * 2); const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  const X = (x) => (x + MAPR) * k; const Z = (z) => (z + MAPR) * k; const rect = (x0, z0, x1, z1) => g.fillRect(X(x0), Z(z0), (x1 - x0) * k, (z1 - z0) * k);
  g.fillStyle = '#e6d3a0'; rect(-652, -652, 652, 652); g.clearRect(X(BAY.x0 - 12), Z(BAY.z0 - 40), (BAY.x1 - BAY.x0 + 24) * k, (BAY.z1 - BAY.z0 + 52) * k);
  g.fillStyle = '#5f9a4a'; rect(-640, -640, 640, 640);
  for (let i = 0; i < 9000; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,50,0,.07)'; g.fillRect(Math.random() * S, Math.random() * S, 3, 2); }
  for (const l of LINES) { // みち(ほどう→アスファルト)
    g.fillStyle = '#b9bcc4'; rect(l - 18, -640, l + 18, 640); rect(-640, l - 18, 640, l + 18);
  }
  for (const l of LINES) { g.fillStyle = '#3f4552'; rect(l - 12, -640, l + 12, 640); rect(-640, l - 12, 640, l + 12); }
  g.setLineDash([14 * k, 12 * k]); g.strokeStyle = '#f2c230'; g.lineWidth = 1.4 * k;
  for (const l of LINES) { g.beginPath(); g.moveTo(X(l), Z(-640)); g.lineTo(X(l), Z(640)); g.stroke(); g.beginPath(); g.moveTo(X(-640), Z(l)); g.lineTo(X(640), Z(l)); g.stroke(); }
  g.setLineDash([]);
  g.fillStyle = 'rgba(255,255,255,.8)'; for (const lx of LINES) for (const lz of LINES) for (let i = -9; i <= 9; i += 3) { rect(lx + i - 0.6, lz - 17, lx + i + 0.6, lz - 13); rect(lx + i - 0.6, lz + 13, lx + i + 0.6, lz + 17); rect(lx - 17, lz + i - 0.6, lx - 13, lz + i + 0.6); rect(lx + 13, lz + i - 0.6, lx + 17, lz + i + 0.6); }
  // ほんぶの ひろば
  g.fillStyle = '#aab3c4'; rect(PLAZA.x0 + 12, PLAZA.z0 + 12, PLAZA.x1 - 12, PLAZA.z1 - 12); g.strokeStyle = '#fff'; g.lineWidth = 2 * k; g.beginPath(); g.arc(X(HQ.x), Z(HQ.z), HQ.r * k, 0, 6.283); g.stroke(); g.save(); g.translate(X(HQ.x), Z(HQ.z)); g.rotate(Math.PI); g.fillStyle = '#e0302a'; g.font = `bold ${26 * k}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('HQ', 0, 0); g.restore();
  // くうこう
  g.fillStyle = '#4a5160'; rect(AIRFIELD.x0, AIRFIELD.z0, AIRFIELD.x1, AIRFIELD.z1); g.fillStyle = '#fff'; for (let x = AIRFIELD.x0 + 20; x < AIRFIELD.x1 - 20; x += 36) rect(x, -1.2, x + 18, 1.2); for (let i = -3; i <= 3; i++) { rect(AIRFIELD.x0 + 4, i * 6 - 1.2, AIRFIELD.x0 + 16, i * 6 + 1.2); rect(AIRFIELD.x1 - 16, i * 6 - 1.2, AIRFIELD.x1 - 4, i * 6 + 1.2); }
  g.fillStyle = '#ffd23f'; rect(AIRFIELD.x0, AIRFIELD.z0, AIRFIELD.x1, AIRFIELD.z0 + 1.5); rect(AIRFIELD.x0, AIRFIELD.z1 - 1.5, AIRFIELD.x1, AIRFIELD.z1);
  // みなとの うみ(きりぬき)
  g.clearRect(X(BAY.x0), Z(BAY.z0 - 40), (BAY.x1 - BAY.x0) * k, (BAY.z1 - BAY.z0 + 40) * k);
  return c;
}
function windowTex(THREE, base, seed) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, 128, 128);
  let a = seed * 9973 + 7; const rnd = () => { a = (a * 1664525 + 1013904223) % 4294967296; return a / 4294967296; };
  for (let y = 6; y < 128; y += 16) for (let x = 6; x < 128; x += 16) { g.fillStyle = rnd() < 0.18 ? '#ffe9a0' : '#35506f'; g.fillRect(x, y, 9, 10); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x, y, 9, 2); }
  g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, 0, 128, 3);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function iconSprite(THREE, text, color = '#ffd23f') {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = 'rgba(8,20,44,.75)'; g.beginPath(); g.arc(64, 64, 58, 0, 6.283); g.fill(); g.strokeStyle = color; g.lineWidth = 8; g.stroke(); g.font = '64px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 64, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); s.renderOrder = 20; return s;
}

// ---- モデル ----------------------------------------------------------------------------------
function makeCar(THREE, color, police = false) {
  const g = new THREE.Group(); const mat = (c, m = {}) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.5, roughness: 0.4, ...m });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.9, 4.8), mat(color)); body.position.y = 0.85; g.add(body);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.35, 1.5), mat(color)); hood.position.set(0, 1.25, 1.5); hood.rotation.x = -0.1; g.add(hood);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.85, 2.4), new THREE.MeshStandardMaterial({ color: '#27456e', metalness: 0.9, roughness: 0.08 })); cab.position.set(0, 1.6, -0.3); g.add(cab);
  for (const [x, z] of [[-1.15, 1.5], [1.15, 1.5], [-1.15, -1.5], [1.15, -1.5]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.4, 14), mat('#1a1d24', { metalness: 0.2 })); w.rotation.z = Math.PI / 2; w.position.set(x, 0.5, z); g.add(w); }
  for (const x of [-0.8, 0.8]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.1), new THREE.MeshBasicMaterial({ color: '#fff7c0' })); l.position.set(x, 0.95, 2.42); g.add(l); const t = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.1), new THREE.MeshBasicMaterial({ color: '#ff3a3a' })); t.position.set(x, 0.95, -2.42); g.add(t); }
  if (police) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.2, 0.4), new THREE.MeshBasicMaterial({ color: '#3a6dff' })); b.position.set(-0.3, 2.1, -0.3); g.add(b); const r = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.4), new THREE.MeshBasicMaterial({ color: '#ff3a3a' })); r.position.set(0.5, 2.1, -0.3); g.add(r); g.userData.siren = [b, r]; }
  g.traverse((m) => { if (m.isMesh) m.castShadow = true; }); return g;
}
function makeRobot(THREE, big) {
  const g = new THREE.Group(); const s = big ? 1.7 : 1; const mat = (c) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.6, roughness: 0.4 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.8, 1.0), mat(big ? '#7a2a3a' : '#9a3a46')); body.position.y = 2.2; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 1.0), mat('#3a2a34')); head.position.y = 3.6; g.add(head);
  const eye = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.1), new THREE.MeshBasicMaterial({ color: '#ff3a3a' })); eye.position.set(0, 3.65, 0.52); g.add(eye);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 5), mat('#ccc')); ant.position.set(0.3, 4.4, 0); g.add(ant); const ball = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffd23f' })); ball.position.set(0.3, 4.85, 0); g.add(ball);
  g.userData.legs = []; for (const x of [-0.45, 0.45]) { const leg = new THREE.Group(); leg.position.set(x, 1.3, 0); const l = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.3, 0.5), mat('#2a2a34')); l.position.y = -0.55; leg.add(l); g.add(leg); g.userData.legs.push(leg); }
  g.userData.arms = []; for (const x of [-1.05, 1.05]) { const arm = new THREE.Group(); arm.position.set(x, 2.9, 0); const a = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.4, 0.4), mat('#4a3a44')); a.position.y = -0.6; arm.add(a); g.add(arm); g.userData.arms.push(arm); }
  const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.4, 8), mat('#222')); gun.rotation.x = Math.PI / 2; gun.position.set(0.9, 2.3, 0.8); g.add(gun);
  g.scale.setScalar(s); g.traverse((m) => { if (m.isMesh) m.castShadow = true; }); return g;
}

export async function startCity3D(o) {
  const THREE = await loadThree();
  if (ACTIVE) { try { ACTIVE.destroy(); } catch { /* ok */ } ACTIVE = null; }
  document.querySelectorAll('.c3d').forEach((e) => e.remove());
  const sim = createCity({ stats: o.stats, vehicles: o.vehicles, coins: o.coins || 0, gentle: !!o.gentle }); const S = sim.state; const P = S.player; S.done = { ...(o.done || {}) };
  const root = document.createElement('div'); root.className = 'a3d c3d';
  root.innerHTML = `<canvas class="a3d-cv"></canvas>
    <div class="a3d-hud">
      <div class="a3d-bars"><div class="ab hp"><span>HP</span><i><u></u></i></div><div class="ab boost"><span>ダッシュ</span><i><u></u></i></div><div class="ab ms"><span>ミサイル</span><b></b></div><div class="c3d-coin">🪙 <b>0</b></div></div>
      <div class="a3d-top c3d-mis" hidden><div class="a3d-name"></div><div class="a3d-obj"></div></div>
      <div class="a3d-banner"></div><div class="a3d-msg"></div><div class="a3d-warn"></div><div class="a3d-ret"><i></i></div>
      <canvas class="c3d-map" width="150" height="150"></canvas>
      <button class="a3d-pausebtn" aria-label="ポーズ">⏸</button><button class="c3d-bigmapbtn" aria-label="ちず">🗺</button><button class="c3d-cancel" hidden>✖ ミッションを やめる</button>
    </div>
    <div class="a3d-pad"><div class="a3d-stick"><div class="a3d-knob"></div></div>
      <div class="a3d-btns"><button class="ab-b ab-gun" data-b="gun">こうげき</button><button class="ab-b ab-ms" data-b="missile">ミサイル</button><button class="ab-b ab-boost" data-b="boost">ダッシュ</button><button class="ab-b ab-act" data-b="act" hidden></button><button class="ab-b ab-tg" data-b="target">ねらい<br>あわせ</button></div></div>
    <div class="a3d-rot p3d-rot"><div>📱↔<br>よこむきに して あそんでね</div></div>
    <div class="c3d-bigmap" hidden><canvas width="640" height="640"></canvas><button class="btn gray">とじる</button></div>
    <div class="c3d-shop" hidden></div>
    <div class="p3d-menu a3d-menu" hidden><div class="p3d-menubox"><b>ポーズ</b><button class="btn gold" data-m="resume">▶ つづける</button><button class="btn gray" data-m="quit">シティを でる</button></div></div>`;
  document.body.appendChild(root); const prevOv = document.body.style.overflow; document.body.style.overflow = 'hidden';
  const cv = root.querySelector('.a3d-cv'); const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
  const mobile = /Mobi|Android/i.test(navigator.userAgent); const shadowsOn = !o.calm;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, o.calm ? 1.25 : 1.75)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  if (shadowsOn) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; }
  const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.5, 9000);
  const sunDir = new THREE.Vector3(-0.45, 0.62, -0.35).normalize(); const horizon = new THREE.Color('#cfe4f5'); scene.background = horizon; scene.fog = new THREE.Fog(horizon, 600, 5000);
  try { scene.environment = envTexture(THREE, renderer); scene.environmentIntensity = 0.8; } catch { /* ok */ }
  scene.add(new THREE.HemisphereLight(0xdfeeff, 0x4a7a55, 0.6)); const sun = new THREE.DirectionalLight(0xfff1d6, 2.2); scene.add(sun, sun.target);
  if (shadowsOn) { sun.castShadow = true; const m = mobile ? 1024 : 2048; sun.shadow.mapSize.set(m, m); const sc = sun.shadow.camera; sc.left = -140; sc.right = 140; sc.top = 140; sc.bottom = -140; sc.near = 20; sc.far = 700; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.5; }
  const sky = new THREE.Mesh(new THREE.SphereGeometry(8000, 24, 16), skyMat(THREE, sunDir)); sky.frustumCulled = false; sky.renderOrder = -10; scene.add(sky);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(24000, 24000), new THREE.ShaderMaterial({ vertexShader: SEA_VS, fragmentShader: SEA_FS, uniforms: { time: { value: 0 }, sunDir: { value: sunDir }, fogColor: { value: horizon }, fogNear: { value: 600 }, fogFar: { value: 5000 }, isl: { value: new THREE.Vector2(0, 0) }, islR: { value: 700 } } }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -1.5; sea.frustumCulled = false; scene.add(sea);
  // まち
  const gc = groundCanvas(); const gtex = new THREE.CanvasTexture(gc); gtex.colorSpace = THREE.SRGBColorSpace; gtex.anisotropy = 8;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(MAPR * 2, MAPR * 2), new THREE.MeshStandardMaterial({ map: gtex, transparent: true, alphaTest: 0.5, roughness: 0.95, metalness: 0 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const TONES = ['#c9cfdd', '#b7c4d6', '#d9c9b0', '#a8b9a0', '#cfa9a0', '#9fb0c8', '#d8d2c0', '#aab6c8', '#c4c9d0', '#e8eef7'];
  const bmats = TONES.map((c, i) => new THREE.MeshStandardMaterial({ map: windowTex(THREE, c, i + 1), roughness: 0.7, metalness: 0.15 }));
  const hangarMat = new THREE.MeshStandardMaterial({ color: '#8a96aa', roughness: 0.5, metalness: 0.4 }); const hqMat = new THREE.MeshStandardMaterial({ map: windowTex(THREE, '#e8eef7', 9), roughness: 0.5, metalness: 0.2 });
  for (const b of LAYOUT.buildings) {
    const w = b.x1 - b.x0; const d = b.z1 - b.z0; const geo = new THREE.BoxGeometry(w, b.h, d); const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) { const face = Math.floor(i / 4); const [su, sv] = face < 2 ? [d, b.h] : face < 4 ? [w, d] : [w, b.h]; uv.setXY(i, (uv.getX(i) * su) / 22, (uv.getY(i) * sv) / 22); }
    const m = new THREE.Mesh(geo, b.kind === 'hangar' || b.kind === 'warehouse' ? hangarMat : b.kind === 'hq' ? hqMat : bmats[b.tone % bmats.length]); m.position.set((b.x0 + b.x1) / 2, b.h / 2, (b.z0 + b.z1) / 2); m.castShadow = shadowsOn; m.receiveShadow = shadowsOn; scene.add(m);
    if (b.kind === 'office' && b.h > 50) { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 14, 6), new THREE.MeshStandardMaterial({ color: '#ddd' })); a.position.set(m.position.x, b.h + 7, m.position.z); scene.add(a); const l = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff3a3a' })); l.position.set(m.position.x, b.h + 14, m.position.z); scene.add(l); }
  }
  { const hq = LAYOUT.buildings.find((b) => b.kind === 'hq'); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 30, 6), new THREE.MeshStandardMaterial({ color: '#fff' })); pole.position.set(hq.x0 + 6, hq.h + 15, hq.z0 + 6); scene.add(pole); const flag = new THREE.Mesh(new THREE.PlaneGeometry(12, 8), new THREE.MeshBasicMaterial({ color: '#fff', side: THREE.DoubleSide })); flag.position.set(hq.x0 + 12, hq.h + 26, hq.z0 + 6); scene.add(flag); const hi = new THREE.Mesh(new THREE.CircleGeometry(2.4, 18), new THREE.MeshBasicMaterial({ color: '#e0302a', side: THREE.DoubleSide })); hi.position.set(hq.x0 + 12, hq.h + 26, hq.z0 + 6.05); scene.add(hi); }
  // ショップ(おみせ)
  { const sh = new THREE.Group(); const body = new THREE.Mesh(new THREE.BoxGeometry(8, 4, 5), new THREE.MeshStandardMaterial({ color: '#f1f4fa', roughness: 0.5 })); body.position.y = 2; const aw = new THREE.Mesh(new THREE.BoxGeometry(9, 0.5, 4), new THREE.MeshStandardMaterial({ color: '#e0302a' })); aw.position.set(0, 4.3, 2.4); aw.rotation.x = 0.25; sh.add(body, aw); const sp = iconSprite(THREE, '🏪'); sp.scale.set(10, 10, 1); sp.position.y = 12; sh.add(sp); sh.position.set(SHOP.x - 10, 0, SHOP.z); sh.traverse((m) => { if (m.isMesh) m.castShadow = shadowsOn; }); scene.add(sh); }
  // きのこ・き
  { const mk = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.castShadow = shadowsOn; scene.add(m); return m; }; const n = LAYOUT.trees.length; const cone = mk(new THREE.ConeGeometry(4.5, 12, 7), new THREE.MeshStandardMaterial({ color: '#2f6a3a', roughness: 0.9 }), n); const trunk = mk(new THREE.CylinderGeometry(0.6, 0.8, 4, 5), new THREE.MeshStandardMaterial({ color: '#5a3f2a', roughness: 1 }), n); const dm = new THREE.Object3D();
    LAYOUT.trees.forEach((t, i) => { dm.position.set(t.x, 2 * t.s, t.z); dm.scale.setScalar(t.s); dm.updateMatrix(); trunk.setMatrixAt(i, dm.matrix); dm.position.y = 9 * t.s; dm.updateMatrix(); cone.setMatrixAt(i, dm.matrix); }); }
  const clouds = new THREE.Group(); { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); for (let i = 0; i < 22; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, opacity: 0.8, depthWrite: false })); const s = 240 + (i * 53) % 260; sp.scale.set(s * 1.6, s * 0.8, 1); sp.position.set(Math.sin(i * 2.1) * 1800, 380 + (i * 41) % 260, Math.cos(i * 1.7) * 1800); clouds.add(sp); } scene.add(clouds); }
  const fx = makeFx(THREE, scene); const seenFx = new Map();

  // ---- ものたち ----
  const kidLook = look({ id: `self_${o.kidName}`, name: o.kidName, slot: 'FW', rarity: 'kid' }, 'a', o.kidName);
  const me = makePlayerModel(THREE, kidLook, 10, 1.2); scene.add(me); const vmodels = new Map();
  for (const v of S.vehicles) { const m = v.kind === 'car' ? makeCar(THREE, v.id === 'car1' ? '#e63946' : '#f2c230', v.id === 'car1') : makeVehicleModel(THREE, o.specs[v.kind]); m.traverse((x) => { if (x.isMesh) x.castShadow = shadowsOn; }); scene.add(m); vmodels.set(v.id, m); }
  const npcs = new Map(); const trafficM = new Map(); const robotM = new Map(); const pickM = new Map();
  const mkNpc = (id, i) => { const lk = look({ id: `npc${id}`, name: `n${i}`, slot: i % 3 === 0 ? 'GK' : 'MF', rarity: 'common' }, i % 2 ? 'a' : 'b', `T${i}`); const m = makePlayerModel(THREE, lk, (i % 20) + 1, 1.15); m.userData.shadow.visible = true; scene.add(m); return m; };
  const mkMarker = (color, h = 70) => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, h, 14, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); b.position.y = h / 2; const r = new THREE.Mesh(new THREE.TorusGeometry(5, 0.35, 8, 28), new THREE.MeshBasicMaterial({ color })); r.rotation.x = Math.PI / 2; r.position.y = 0.6; g.add(b, r); g.userData.ring = r; return g; };
  const startMarkers = CITY_MISSIONS.map((m) => { const g = mkMarker('#ffd23f'); g.position.set(m.start.x, 0, m.start.z); const sp = iconSprite(THREE, m.icon); sp.scale.set(9, 9, 1); sp.position.y = 24; g.add(sp); scene.add(g); return { m, g }; });
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
  pad.addEventListener('pointerdown', (e) => { if (e.target.closest('.ab-b')) return; if (e.clientX > root.clientWidth * 0.5 && !(sim.vehicleOf() && sim.vehicleOf().kind === 'plane')) { if (aid !== null) return; aid = e.pointerId; ao = { x: e.clientX, y: e.clientY }; try { pad.setPointerCapture(e.pointerId); } catch { /* ok */ } e.preventDefault(); return; } if (sid !== null) return; sid = e.pointerId; try { pad.setPointerCapture(e.pointerId); } catch { /* ok */ } const r = stick.getBoundingClientRect(); so = { x: e.clientX, y: e.clientY }; stick.style.left = `${e.clientX - r.width / 2}px`; stick.style.bottom = 'auto'; stick.style.top = `${e.clientY - r.height / 2}px`; setStick(0, 0); e.preventDefault(); });
  pad.addEventListener('pointermove', (e) => { if (e.pointerId === aid) { setAim(e.clientX - ao.x, e.clientY - ao.y); e.preventDefault(); return; } if (e.pointerId !== sid) return; setStick(e.clientX - so.x, e.clientY - so.y); e.preventDefault(); });
  const endPtr = (e) => { if (e.pointerId === aid) { aid = null; setAim(0, 0); return; } if (e.pointerId !== sid) return; sid = null; setStick(0, 0); stick.style.left = ''; stick.style.top = ''; stick.style.bottom = ''; };
  pad.addEventListener('pointerup', endPtr); pad.addEventListener('pointercancel', endPtr);
  const doAct = () => { const had = !!S.nearby; if (!sim.interact() && !had) return; };
  const bp = (b) => { if (b === 'gun') sim.input.gun = true; else if (b === 'boost') sim.input.boost = true; else if (b === 'missile') sim.fireMissile(); else if (b === 'act') doAct(); else if (b === 'target') sim.aimAt(P.target || null); };
  const br = (b) => { if (b === 'gun') sim.input.gun = false; else if (b === 'boost') sim.input.boost = false; };
  root.querySelectorAll('.ab-b').forEach((btn) => { const b = btn.dataset.b; btn.addEventListener('pointerdown', (e) => { try { btn.setPointerCapture(e.pointerId); } catch { /* ok */ } btn.classList.add('on'); bp(b); e.preventDefault(); }); const up = (e) => { btn.classList.remove('on'); br(b); e.preventDefault(); }; btn.addEventListener('pointerup', up); btn.addEventListener('pointercancel', up); });
  const keys = new Set(); const akeys = { KeyI: [0, 1], KeyK: [0, -1], KeyJ: [-1, 0], KeyL: [1, 0] }; const aimKeys = new Set(); const kmap = { Space: 'gun', KeyF: 'missile', ShiftLeft: 'boost', KeyE: 'act', KeyT: 'target' };
  const recompute = () => { const x = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0); const y = (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0) - (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0); sim.input.turn = -x; sim.input.climb = y; };
  const recAim = () => { let x = 0; let y = 0; for (const c of aimKeys) { x += akeys[c][0]; y += akeys[c][1]; } sim.input.aimX = -x; sim.input.aimY = y; };
  const kd = (e) => { if (e.repeat) return; if (e.code === 'Escape' || e.code === 'KeyP') { setPause(!paused); return; } if (akeys[e.code]) { aimKeys.add(e.code); recAim(); return; } if (kmap[e.code]) { bp(kmap[e.code]); e.preventDefault(); return; } keys.add(e.code); recompute(); if (e.code.startsWith('Arrow')) e.preventDefault(); };
  const ku = (e) => { if (akeys[e.code]) { aimKeys.delete(e.code); recAim(); } if (kmap[e.code]) { br(kmap[e.code]); return; } keys.delete(e.code); recompute(); };
  window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
  let paused = false; let dead = false; let portrait = false; const menu = root.querySelector('.a3d-menu'); const setPause = (v) => { paused = v; menu.hidden = !v; if (v) { sim.input.gun = false; sim.input.boost = false; } };
  const saveNow = () => { if (o.onSave) o.onSave({ coins: P.coins, done: S.done, stats: S.stats }); };
  menu.addEventListener('click', (e) => { const m = e.target.closest('[data-m]'); if (!m) return; if (m.dataset.m === 'resume') setPause(false); else if (m.dataset.m === 'quit') { saveNow(); destroy(); if (o.onQuit) o.onQuit({ coins: P.coins, done: S.done, stats: S.stats }); } });
  root.querySelector('.a3d-pausebtn').addEventListener('click', () => setPause(!paused));
  root.querySelector('.c3d-cancel').addEventListener('click', () => sim.cancelMission());
  const bigmap = root.querySelector('.c3d-bigmap'); root.querySelector('.c3d-bigmapbtn').addEventListener('click', () => { bigmap.hidden = !bigmap.hidden; }); bigmap.addEventListener('click', () => { bigmap.hidden = true; });
  const resize = () => { const w = root.clientWidth || innerWidth; const h = root.clientHeight || innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < 1.5 ? 70 : 62; camera.updateProjectionMatrix(); portrait = h > w * 1.05; root.classList.toggle('portrait', portrait); };
  window.addEventListener('resize', resize); window.addEventListener('orientationchange', resize); resize();
  try { if (document.documentElement.requestFullscreen && !document.fullscreenElement && /Mobi|Android/i.test(navigator.userAgent)) document.documentElement.requestFullscreen().then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {})).catch(() => {}); } catch { /* ok */ }
  // ---- おみせ ----
  const shopEl = root.querySelector('.c3d-shop');
  const openShop = () => {
    const draw = (note = '') => { shopEl.hidden = false; shopEl.innerHTML = `<div class="sh-box"><h3>🏪 おみせ</h3><div class="sh-coin">🪙 ${P.coins}</div>${SHOPD.items.map((it) => `<button class="sh-item" data-id="${it.id}" ${P.coins < it.cost ? 'disabled' : ''}><span>${it.icon}</span><b>${it.name}</b><small>${it.desc}</small><em>🪙${it.cost}</em></button>`).join('')}<div class="sh-note">${note}</div><button class="btn gray sh-x">とじる</button></div>`; };
    draw('コインは まちの ミッションや コインあつめで ふえるよ'); S.ui = 'shop'; setPause(false); paused = true;
    shopEl.onclick = (e) => { if (e.target.closest('.sh-x')) { shopEl.hidden = true; S.ui = null; paused = false; return; } const b = e.target.closest('.sh-item'); if (!b) return; const r = sim.buy(b.dataset.id); if (r.ok) { for (const ev of sim.takeEvents()) handleEvent(ev); saveNow(); draw('かったよ! ありがとう!'); } else draw(r.why || ''); };
  };
  const handleEvent = (e) => {
    if (e.t === 'reward' && o.onReward) { o.onReward(e); saveNow(); } else if (e.t === 'buy' && o.onBuy) o.onBuy(e.id); else if (e.t === 'shop') openShop();
  };

  // ---- HUD ----
  const q = (s) => root.querySelector(s); const hud = { hp: q('.ab.hp u'), hpw: q('.ab.hp'), boost: q('.ab.boost u'), ms: q('.ab.ms b'), msw: q('.ab.ms'), coin: q('.c3d-coin b'), mis: q('.c3d-mis'), misN: q('.c3d-mis .a3d-name'), misO: q('.c3d-mis .a3d-obj'), banner: q('.a3d-banner'), msg: q('.a3d-msg'), warn: q('.a3d-warn'), ret: q('.a3d-ret'), act: q('.ab-act'), gun: q('.ab-gun'), cancel: q('.c3d-cancel'), map: q('.c3d-map').getContext('2d'), big: bigmap.querySelector('canvas').getContext('2d') };
  const kindName = { foot: 'あるく', car: 'くるま', tank: 'せんしゃ', ship: 'ふね', plane: 'ひこうき' };
  let lastBanner = ''; const v3 = new THREE.Vector3();
  const project = (x, y, z) => { v3.set(x, y, z).project(camera); return { x: (v3.x * 0.5 + 0.5) * root.clientWidth, y: (-v3.y * 0.5 + 0.5) * root.clientHeight, z: v3.z }; };
  const drawMap = (g, R, size, rot) => {
    g.clearRect(0, 0, size, size); g.save(); g.translate(size / 2, size / 2); const sc = size / (2 * R); if (rot) g.rotate(P.yaw + Math.PI); g.scale(sc, sc); g.translate(rot ? -P.x : 0, rot ? -P.z : 0);
    g.fillStyle = '#2a6ea0'; g.fillRect(-1700, -1700, 3400, 3400); g.drawImage(gc, -MAPR, -MAPR, MAPR * 2, MAPR * 2);
    g.fillStyle = 'rgba(70,76,96,.9)'; for (const b of LAYOUT.buildings) g.fillRect(b.x0, b.z0, b.x1 - b.x0, b.z1 - b.z0);
    const dot = (x, z, c, r, sq) => { g.fillStyle = c; if (sq) g.fillRect(x - r, z - r, r * 2, r * 2); else { g.beginPath(); g.arc(x, z, r, 0, 6.283); g.fill(); } };
    const rr = rot ? R / 26 : 7; for (const { m } of startMarkers) if (!S.mission) { dot(m.start.x, m.start.z, '#ffd23f', rr * 1.1); }
    if (S.mission && S.mission.targets && S.mission.targets[S.mission.stage]) { const t = S.mission.targets[S.mission.stage]; dot(t.x, t.z, '#27d8ff', rr * 1.3); }
    if (S.mission && (S.mission.id === 'rescue' || (S.mission.id === 'delivery' && S.mission.stage === 1))) dot(HQ.x, HQ.z, '#7dffa0', rr * 1.3);
    for (const c of S.civs) if (c.state === 'need') dot(c.x, c.z, '#ff9ad0', rr);
    for (const r of S.robots) dot(r.x, r.z, '#ff4d5e', rr);
    for (const v of S.vehicles) if (!v.occ) dot(v.x, v.z, '#6ab0ff', rr * 0.9, true);
    dot(SHOP.x, SHOP.z, '#fff', rr * 0.9, true);
    if (!rot) { g.fillStyle = '#ff0'; g.beginPath(); g.arc(P.x, P.z, 8, 0, 6.283); g.fill(); }
    g.restore();
    if (rot) { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(size / 2, size / 2 - 9); g.lineTo(size / 2 - 7, size / 2 + 8); g.lineTo(size / 2 + 7, size / 2 + 8); g.closePath(); g.fill(); g.strokeStyle = '#27d8ff'; g.lineWidth = 3; g.beginPath(); g.arc(size / 2, size / 2, size / 2 - 2, 0, 6.283); g.stroke(); }
  };
  function updateHud() {
    const v = sim.vehicleOf(); const hp = v ? v.hp / v.hpMax : P.hp / P.hpMax; hud.hp.style.width = `${clamp(hp, 0, 1) * 100}%`; hud.hpw.classList.toggle('low', hp < 0.3); hud.boost.style.width = `${clamp(P.boost, 0, 100)}%`;
    const hasMis = !!(v && v.V.missiles); hud.msw.style.display = hasMis ? '' : 'none'; if (hasMis) hud.ms.textContent = `🚀 ×${v.mis == null ? v.V.missiles : v.mis}`; root.querySelector('.ab-ms').style.display = hasMis ? '' : 'none';
    hud.coin.textContent = P.coins;
    const n = S.nearby; const showAct = !!n && n.kind !== 'exit' || (n && n.kind === 'exit'); hud.act.hidden = !showAct; if (showAct) { hud.act.textContent = n.label; hud.act.classList.toggle('exit', n.kind === 'exit'); }
    const M = S.mission; hud.mis.hidden = !M; hud.cancel.hidden = !M;
    if (M) { hud.misN.textContent = `${M.icon} ${M.name}`; let t = `${M.got}/${M.total}`; if (M.id === 'delivery') t = M.stage === 0 ? '📦 にもつを うけとりに いこう' : `⏱ のこり ${Math.max(0, Math.ceil(M.timeLeft))}びょう → ほんぶへ!`; else if (M.id === 'rescue') t = `たすけた ${M.got}/${M.total}・いっしょに いる ${P.carry}にん → ほんぶへ`; else if (M.id === 'invasion') t = `のこり ${S.robots.filter((r) => r.mission).length}たい`; else if (M.id === 'harbor' && !(v && (v.kind === 'ship' || v.kind === 'plane'))) t += ' (ふねに のろう)'; else if (M.id === 'sky' && !(v && v.kind === 'plane')) t += ' (ひこうきに のろう)'; hud.misO.textContent = t; }
    const b = S.bannerT > 0 ? S.banner : ''; if (b !== lastBanner) { lastBanner = b; hud.banner.textContent = b; hud.banner.classList.toggle('on', !!b); }
    hud.msg.textContent = S.msgT > 0 ? S.msg : ''; hud.warn.textContent = P.dead > 0 ? '😵 ふっかつちゅう…' : ''; root.classList.toggle('hurt', P.hurt > 0);
    // しょうじゅん
    const kind = v ? v.kind : 'foot'; const ay = kind === 'plane' ? v.yaw : P.yaw + P.aimRel; const ap = kind === 'plane' ? v.pitch : P.aimPitch; const o0 = kind === 'plane' ? { x: v.x, y: v.y, z: v.z } : { x: P.x, y: 2, z: P.z }; const rp = project(o0.x + Math.sin(ay) * Math.cos(ap) * 200, o0.y + Math.sin(ap) * 200, o0.z + Math.cos(ay) * Math.cos(ap) * 200); hud.ret.style.left = `${rp.x}px`; hud.ret.style.top = `${rp.y}px`; hud.ret.style.display = rp.z < 1 && P.dead <= 0 ? '' : 'none'; hud.ret.classList.toggle('lock', !!P.target && kind === 'plane');
    hud.gun.textContent = kind === 'foot' ? 'ブラスター' : kind === 'car' ? 'ビーム' : 'こうげき'; root.querySelector('.ab-tg').style.display = kind === 'plane' ? 'none' : '';
    drawMap(hud.map, 240, 150, true); if (!bigmap.hidden) drawMap(hud.big, 760, 640, false);
  }
  // ---- かく ----
  const cam = { x: 0, y: 0, z: 0, init: false }; let tt = 0; let raf = 0; let last = 0; let acc = 0; let trailT = 0; let lastEffN = 0;
  const setYaw = (m, yaw) => { m.userData.inner.rotation.y = yaw - Math.PI / 2; };
  function syncScene(dt) {
    const v = sim.vehicleOf(); const kind = v ? v.kind : 'foot';
    // じぶん
    me.visible = !v && P.dead <= 0; me.position.set(P.x, P.chute ? P.y : 0, P.z); setYaw(me, P.yaw); { const u = me.userData; const sp = Math.abs(P.speed); const sw = Math.sin(tt * 11) * Math.min(1, sp / 5) * 0.9; u.legL.rotation.z = sw; u.legR.rotation.z = -sw; u.armL.rotation.z = -sw * 0.8; u.armR.rotation.z = sw * 0.8; if (P.chute) { u.armL.rotation.z = u.armR.rotation.z = 2.7; } me.position.y += Math.abs(Math.sin(tt * 11)) * Math.min(1, sp / 5) * 0.12; }
    shield.visible = P.invuln > 0; shield.position.set(P.x, (v ? v.y : P.y) + (kind === 'plane' ? 0 : 3), P.z); shield.scale.setScalar(kind === 'foot' ? 1 : kind === 'plane' ? 3 : 4);
    // のりもの
    for (const vv of S.vehicles) { const m = vmodels.get(vv.id); m.position.set(vv.x, vv.kind === 'ship' ? Math.sin(tt * 1.6 + vv.x) * 0.4 : vv.kind === 'plane' ? vv.y : 0, vv.z); m.rotation.order = 'YXZ'; if (vv.kind === 'plane') { m.rotation.set(-vv.pitch, vv.yaw, vv.roll); if (m.userData.flame) m.userData.flame.scale.set(1, 1, vv.occ && input_boost() ? 2.4 : 1); } else m.rotation.set(0, vv.yaw, vv.roll * 0.5); if (vv.occ && vv.id === P.veh) { const ty = P.yaw + P.aimRel - vv.yaw; if (m.userData.turrets) m.userData.turrets.forEach((t) => { t.rotation.y = ty; }); if (m.userData.turret) m.userData.turret.rotation.y = ty; } if (m.userData.radar) m.userData.radar.rotation.y = tt * 3; if (m.userData.siren) { const on = Math.floor(tt * 6) % 2 === 0; m.userData.siren[0].visible = on; m.userData.siren[1].visible = !on; } }
    // ひと(ちかくだけ つくる)
    const people = [...S.walkers.map((w) => ({ ...w, kind: 'walk' })), ...S.civs.map((c) => ({ ...c, kind: 'civ' }))]; const seen = new Set();
    for (const w of people) { const d = Math.hypot(w.x - P.x, w.z - P.z); if (d > 240) continue; seen.add(w.id); let m = npcs.get(w.id); if (!m) { if (npcs.size >= 16) continue; m = mkNpc(w.id, w.id); npcs.set(w.id, m); } m.position.set(w.x, 0, w.z); setYaw(m, w.yaw); const sp = w.kind === 'walk' ? 1 : (w.state === 'carried' ? 1 : 0); const sw = Math.sin(tt * 9 + w.id) * sp * 0.8; const u = m.userData; u.legL.rotation.z = sw; u.legR.rotation.z = -sw; u.armL.rotation.z = w.kind === 'civ' && w.state === 'need' ? 2.6 + Math.sin(tt * 10) * 0.3 : -sw; u.armR.rotation.z = w.kind === 'civ' && w.state === 'need' ? 2.6 - Math.sin(tt * 10) * 0.3 : sw; if (w.kind === 'civ') m.visible = w.state !== 'safe'; }
    for (const [id, m] of npcs) if (!seen.has(id)) { scene.remove(m); npcs.delete(id); }
    // くるま(かざり)
    for (const c of S.traffic) { let m = trafficM.get(c.id); if (!m) { m = makeCar(THREE, ['#4a90d9', '#e0a030', '#5aa86a', '#d85a8a', '#8a8f9a', '#f2f2f2', '#6a4ad8', '#d8d24a'][c.tone % 8]); scene.add(m); trafficM.set(c.id, m); } m.position.set(c.x, 0, c.z); m.rotation.y = c.yaw; m.visible = Math.hypot(c.x - P.x, c.z - P.z) < 700; }
    // ロボット
    const rseen = new Set(); for (const r of S.robots) { rseen.add(r.id); let m = robotM.get(r.id); if (!m) { m = makeRobot(THREE, r.type === 'big'); scene.add(m); robotM.set(r.id, m); } m.position.set(r.x, 0, r.z); m.rotation.y = r.yaw; const sw = Math.sin(tt * 8 + r.ph) * 0.7; m.userData.legs.forEach((l, i) => { l.rotation.x = i ? sw : -sw; }); m.userData.arms.forEach((a, i) => { a.rotation.x = i ? -sw : sw; }); }
    for (const [id, m] of robotM) if (!rseen.has(id)) { scene.remove(m); robotM.delete(id); }
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
    hqMarker.userData.ring.rotation.z = tt;
    // カメラ
    const f = { x: Math.sin(P.yaw) * Math.cos(P.pitch || 0), y: Math.sin(P.pitch || 0), z: Math.cos(P.yaw) * Math.cos(P.pitch || 0) };
    let bx; let by; let bz; let lx; let ly; let lz; const k = 1 - Math.exp(-8 * dt);
    if (kind === 'plane') { bx = P.x - f.x * 26; by = P.y - f.y * 26 + 7; bz = P.z - f.z * 26; lx = P.x + f.x * 90; ly = P.y + f.y * 90; lz = P.z + f.z * 90; }
    else { const cy = kind === 'tank' || kind === 'ship' ? P.yaw + P.aimRel : P.yaw; const d = { foot: 8, car: 12, tank: 30, ship: 68 }[kind]; const h = { foot: 3.6, car: 5, tank: 15, ship: 30 }[kind]; bx = P.x - Math.sin(cy) * d; by = (P.chute ? P.y : 0) + h; bz = P.z - Math.cos(cy) * d; lx = P.x + Math.sin(cy) * 80; ly = (P.chute ? P.y : 0) + (kind === 'foot' ? 2 : 6) + (kind === 'tank' || kind === 'ship' ? Math.tan(P.aimPitch) * 80 : 0); lz = P.z + Math.cos(cy) * 80; }
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
    syncScene(dt); updateHud(); renderer.render(scene, camera); raf = requestAnimationFrame(frame);
  }
  function destroy() {
    if (dead) return; dead = true; cancelAnimationFrame(raf); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('resize', resize); window.removeEventListener('orientationchange', resize);
    try { fx.dispose(); renderer.dispose(); scene.traverse((ob) => { if (ob.geometry) ob.geometry.dispose(); if (ob.material) (Array.isArray(ob.material) ? ob.material : [ob.material]).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); }); } catch { /* ok */ }
    root.remove(); document.body.style.overflow = prevOv; try { if (document.fullscreenElement) document.exitFullscreen(); if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch { /* ok */ }
  }
  void SPAWN; void isWater; void lastEffN;
  raf = requestAnimationFrame(frame);
  const api = { destroy: () => { if (ACTIVE === api) ACTIVE = null; saveNow(); destroy(); }, sim, root, renderer, scene, camera };
  ACTIVE = api; return api;
}
