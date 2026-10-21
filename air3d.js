// 「そらの まもり」の 3D がめん(three.js)+ タッチ そうさ + HUD。ルールと うごきは airsim.js。
//   const g = await startAir3D({ machine, wings, mission, gentle, onSfx, onEnd, onQuit });
import { createAir, BASE_Z } from './airsim.js';

let T = null;
async function loadThree() { if (!T) T = await import('./vendor/three.module.min.js'); return T; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = (s) => String(s).replace(/[<>&"]/g, '');
let ACTIVE = null;

const RAR_COL = { kid: '#ffd23f', common: '#8fa2c8', uncommon: '#5bd18b', rare: '#4aa3ff', super: '#b57bff', legend: '#ff9f1c', diamond: '#9ff3ff' };

function makeJet(THREE, color = '#4aa3ff', scale = 1, enemy = false) {
  const g = new THREE.Group(); const mat = (c, e = 0) => new THREE.MeshLambertMaterial({ color: c, emissive: e });
  const body = new THREE.Mesh(new THREE.ConeGeometry(1.6, 12, 8), mat(color)); body.rotation.x = Math.PI / 2; g.add(body);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(14, 0.4, 4.6), mat(enemy ? '#3a2630' : '#e8eefc')); wing.position.set(0, 0, -1.2); g.add(wing);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.3, 2.2), mat(enemy ? '#3a2630' : '#e8eefc')); tail.position.set(0, 0, -5); g.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.6, 2.4), mat(color)); fin.position.set(0, 1.4, -5); g.add(fin);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), mat('#2a4a7a', 0x112244)); canopy.position.set(0, 0.9, 1); canopy.scale.set(1, 0.7, 2); g.add(canopy);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4, 6), new THREE.MeshBasicMaterial({ color: enemy ? '#ff4d5e' : '#7fe7ff', transparent: true, opacity: 0.85 })); flame.rotation.x = -Math.PI / 2; flame.position.set(0, 0, -8); g.add(flame); g.userData.flame = flame;
  g.scale.setScalar(scale); return g;
}
function makeDrone(THREE) { const g = new THREE.Group(); const m = (c) => new THREE.MeshLambertMaterial({ color: c, emissive: 0x330a10 }); const b = new THREE.Mesh(new THREE.OctahedronGeometry(2.6), m('#c43a4a')); b.scale.set(1.3, 0.6, 1.3); g.add(b); const r = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.35, 6, 14), m('#2a1620')); r.rotation.x = Math.PI / 2; g.add(r); const e = new THREE.Mesh(new THREE.SphereGeometry(0.7, 6, 6), new THREE.MeshBasicMaterial({ color: '#ff5566' })); e.position.set(0, 0, 2.2); g.add(e); return g; }
function makeBomber(THREE) { const g = makeJet(THREE, '#6a2a3a', 2.2, true); g.userData.flame.scale.set(1.5, 1.5, 1.5); return g; }
function makeBoss(THREE) {
  const g = new THREE.Group(); const m = (c, e = 0) => new THREE.MeshLambertMaterial({ color: c, emissive: e });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(110, 16, 220), m('#3a2f46')); g.add(hull);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(90, 4, 190), m('#52456a')); deck.position.y = 10; g.add(deck);
  const tower = new THREE.Mesh(new THREE.BoxGeometry(24, 30, 36), m('#2a2234')); tower.position.set(26, 26, 30); g.add(tower);
  for (const [x, z] of [[-34, -70], [34, -70], [-34, 70], [34, 70], [0, 0]]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(5, 7, 10, 8), m('#8a3340', 0x330a10)); t.position.set(x, 16, z); g.add(t); const gun = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 22), m('#1c1824')); gun.position.set(x, 20, z - 14); g.add(gun); }
  for (const x of [-48, 48]) { const e = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 20, 12), new THREE.MeshBasicMaterial({ color: '#ff6a4a', transparent: true, opacity: 0.85 })); e.rotation.x = Math.PI / 2; e.position.set(x, 0, 116); g.add(e); }
  return g;
}

export async function startAir3D(o) {
  const THREE = await loadThree();
  if (ACTIVE) { try { ACTIVE.destroy(); } catch { /* ok */ } ACTIVE = null; }
  document.querySelectorAll('.a3d').forEach((e) => e.remove());
  const sim = createAir({ machine: o.machine, wings: o.wings || [], mission: o.mission, gentle: !!o.gentle, difficulty: o.difficulty || 1 });
  const S = sim.state;
  const root = document.createElement('div'); root.className = 'a3d';
  root.innerHTML = `<canvas class="a3d-cv"></canvas>
    <div class="a3d-hud">
      <div class="a3d-top"><div class="a3d-name">${esc(o.machine.face || '')} ${esc(o.machine.pilot)} ・ ${esc(o.machine.tier)}</div><div class="a3d-obj"></div></div>
      <div class="a3d-bars"><div class="ab hp"><span>きたい</span><i><u></u></i></div><div class="ab base"><span>きち</span><i><u></u></i></div><div class="ab boost"><span>ブースト</span><i><u></u></i></div><div class="ab ms"><span>ミサイル</span><b></b></div></div>
      <div class="a3d-marks"></div><div class="a3d-banner"></div><div class="a3d-msg"></div><div class="a3d-warn"></div>
      <canvas class="a3d-radar" width="120" height="120"></canvas>
      <button class="a3d-pausebtn" aria-label="ポーズ">⏸</button>
    </div>
    <div class="a3d-pad"><div class="a3d-stick"><div class="a3d-knob"></div></div>
      <div class="a3d-btns"><button class="ab-b ab-gun" data-b="gun">きかんほう</button><button class="ab-b ab-ms" data-b="missile">ミサイル</button><button class="ab-b ab-boost" data-b="boost">ブースト</button><button class="ab-b ab-ev" data-b="evade">かいひ</button></div></div>
    <div class="a3d-rot p3d-rot"><div>📱↔<br>よこむきに して あそんでね</div></div>
    <div class="a3d-end" hidden></div>
    <div class="p3d-menu a3d-menu" hidden><div class="p3d-menubox"><b>ポーズ</b><button class="btn gold" data-m="resume">▶ つづける</button><button class="btn" data-m="invert"></button><button class="btn gray" data-m="quit">ミッションを やめる</button></div></div>`;
  document.body.appendChild(root);
  const prevOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
  const cv = root.querySelector('.a3d-cv');
  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, o.calm ? 1.25 : 1.75)); renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); const sky = new THREE.Color('#7fb8f0'); scene.background = sky; scene.fog = new THREE.Fog('#b7d8f5', 600, 4200);
  const camera = new THREE.PerspectiveCamera(62, 16 / 9, 1, 9000);
  scene.add(new THREE.HemisphereLight(0xdfeeff, 0x2a5d8a, 1.05)); const sun = new THREE.DirectionalLight(0xffffff, 1.1); sun.position.set(-400, 900, -300); scene.add(sun);
  // うみ
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(14000, 14000, 1, 1), new THREE.MeshLambertMaterial({ color: '#1f6fa8' })); sea.rotation.x = -Math.PI / 2; sea.position.set(0, 0, BASE_Z); scene.add(sea);
  const seaLines = new THREE.GridHelper(14000, 70, 0x8fd0ff, 0x4a9ad0); seaLines.position.set(0, 0.5, BASE_Z); seaLines.material.transparent = true; seaLines.material.opacity = 0.25; scene.add(seaLines);
  // くも・しま
  const cloudMat = new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 });
  for (let i = 0; i < 34; i++) { const c = new THREE.Group(); const n = 3 + (i % 3); for (let j = 0; j < n; j++) { const s = new THREE.Mesh(new THREE.SphereGeometry(60 + (j * 17) % 50, 8, 6), cloudMat); s.position.set(j * 70, (j % 2) * 18, (j % 3) * 30); s.scale.y = 0.45; c.add(s); } c.position.set(Math.sin(i * 7.3) * 2600, 320 + (i * 53) % 520, BASE_Z + Math.cos(i * 4.1) * 2800); scene.add(c); }
  const isl = new THREE.MeshLambertMaterial({ color: '#4a7a42' });
  for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(new THREE.ConeGeometry(80 + (i * 37) % 120, 70 + (i * 29) % 80, 8), isl); m.position.set(Math.sin(i * 2.1) * 2200, 25, BASE_Z + 400 + Math.cos(i * 1.7) * 2000); scene.add(m); }
  // きち(まもる ばしょ)
  const base = new THREE.Group(); { const pad = new THREE.Mesh(new THREE.CylinderGeometry(130, 150, 18, 14), new THREE.MeshLambertMaterial({ color: '#7b8aa0' })); pad.position.y = 6; base.add(pad);
    for (let i = 0; i < 18; i++) { const h = 20 + (i * 13) % 50; const b = new THREE.Mesh(new THREE.BoxGeometry(18 + (i % 3) * 6, h, 18), new THREE.MeshLambertMaterial({ color: i % 4 ? '#e8eefc' : '#ffd23f' })); b.position.set(Math.cos(i * 1.7) * (30 + (i % 5) * 18), 15 + h / 2, Math.sin(i * 1.7) * (30 + (i % 5) * 18)); base.add(b); }
    const flag = new THREE.Mesh(new THREE.BoxGeometry(2, 60, 2), new THREE.MeshLambertMaterial({ color: '#ffffff' })); flag.position.set(0, 45, 0); base.add(flag); const hi = new THREE.Mesh(new THREE.CircleGeometry(10, 16), new THREE.MeshBasicMaterial({ color: '#e0302a', side: THREE.DoubleSide })); hi.position.set(8, 70, 0); base.add(hi); }
  base.position.set(0, 0, BASE_Z); scene.add(base);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(230, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#7fe7ff', transparent: true, opacity: 0.12, depthWrite: false })); dome.position.set(0, 0, BASE_Z); scene.add(dome);
  // じぶんと なかま
  const rc = RAR_COL[o.machine.rarity] || '#4aa3ff'; const me = makeJet(THREE, rc, 1.0); scene.add(me);
  const wingM = S.wings.map((w) => { const j = makeJet(THREE, RAR_COL[w.m.rarity] || '#8fa2c8', 0.85); scene.add(j); return j; });
  const meshes = new Map(); // てき id → mesh
  const bulletPool = []; const missilePool = []; const tracerPool = []; const fxPool = [];
  const bulletGeo = new THREE.SphereGeometry(1.4, 6, 4); const bulletMat = new THREE.MeshBasicMaterial({ color: '#ffd23f' });
  const misGeo = new THREE.CylinderGeometry(0.5, 0.5, 7, 6); const misMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const trGeo = new THREE.CylinderGeometry(0.25, 0.25, 1, 4); const trMat = new THREE.MeshBasicMaterial({ color: '#fff7a0' });
  const getFromPool = (pool, geo, mat, i) => { while (pool.length <= i) { const m = new THREE.Mesh(geo, mat); m.visible = false; scene.add(m); pool.push(m); } return pool[i]; };
  const lockMat = new THREE.MeshBasicMaterial({ color: '#ff4d5e', side: THREE.DoubleSide, transparent: true, opacity: 0.9, depthTest: false });

  // ---- そうさ ----
  const stick = root.querySelector('.a3d-stick'); const knob = root.querySelector('.a3d-knob'); const pad = root.querySelector('.a3d-pad'); let sid = null; let so = { x: 0, y: 0 }; const R = 56; let invert = false; try { invert = localStorage.getItem('hibiyui.a3d.invert') === '1'; } catch { /* ok */ }
  const setStick = (dx, dy) => { const m = Math.hypot(dx, dy); const k = m > R ? R / m : 1; const x = dx * k; const y = dy * k; knob.style.transform = `translate(${x}px,${y}px)`; const vx = x / R; const vy = y / R; if (Math.hypot(vx, vy) < 0.1) { sim.input.turn = 0; sim.input.climb = 0; } else { sim.input.turn = vx; sim.input.climb = (invert ? 1 : -1) * vy; } };
  pad.addEventListener('pointerdown', (e) => { if (e.target.closest('.ab-b') || sid !== null) return; sid = e.pointerId; try { pad.setPointerCapture(e.pointerId); } catch { /* ok */ } const r = stick.getBoundingClientRect(); so = { x: e.clientX, y: e.clientY }; stick.style.left = `${e.clientX - r.width / 2}px`; stick.style.bottom = 'auto'; stick.style.top = `${e.clientY - r.height / 2}px`; setStick(0, 0); e.preventDefault(); });
  pad.addEventListener('pointermove', (e) => { if (e.pointerId !== sid) return; setStick(e.clientX - so.x, e.clientY - so.y); e.preventDefault(); });
  const endStick = (e) => { if (e.pointerId !== sid) return; sid = null; setStick(0, 0); stick.style.left = ''; stick.style.top = ''; stick.style.bottom = ''; };
  pad.addEventListener('pointerup', endStick); pad.addEventListener('pointercancel', endStick);
  const bp = (b) => { if (b === 'gun') sim.input.gun = true; else if (b === 'boost') sim.input.boost = true; else if (b === 'missile') sim.fireMissile(); else if (b === 'evade') sim.evade(); };
  const br = (b) => { if (b === 'gun') sim.input.gun = false; else if (b === 'boost') sim.input.boost = false; };
  root.querySelectorAll('.ab-b').forEach((btn) => { const b = btn.dataset.b; btn.addEventListener('pointerdown', (e) => { try { btn.setPointerCapture(e.pointerId); } catch { /* ok */ } btn.classList.add('on'); bp(b); e.preventDefault(); }); const up = (e) => { btn.classList.remove('on'); br(b); e.preventDefault(); }; btn.addEventListener('pointerup', up); btn.addEventListener('pointercancel', up); });
  const keys = new Set(); const recompute = () => { const x = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0); const y = (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0) - (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0); sim.input.turn = x; sim.input.climb = (invert ? -1 : 1) * y; };
  const kmap = { KeyJ: 'gun', Space: 'gun', KeyK: 'missile', ShiftLeft: 'boost', KeyL: 'evade' };
  const kd = (e) => { if (e.repeat) return; if (e.code === 'Escape' || e.code === 'KeyP') { setPause(!paused); return; } if (kmap[e.code]) { bp(kmap[e.code]); e.preventDefault(); return; } keys.add(e.code); recompute(); if (e.code.startsWith('Arrow')) e.preventDefault(); };
  const ku = (e) => { if (kmap[e.code]) { br(kmap[e.code]); return; } keys.delete(e.code); recompute(); };
  window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
  // ---- ポーズ・よこむき ----
  let paused = false; let dead = false; let portrait = false; const menu = root.querySelector('.a3d-menu');
  const setPause = (v) => { paused = v; menu.hidden = !v; if (v) { sim.input.gun = false; sim.input.boost = false; } };
  const syncInv = () => { menu.querySelector('[data-m=invert]').textContent = `🎮 うえした: ${invert ? 'スティックを したに たおすと のぼる' : 'スティックを うえに たおすと のぼる'}(おして かえる)`; };
  menu.addEventListener('click', (e) => { const m = e.target.closest('[data-m]'); if (!m) return; if (m.dataset.m === 'resume') setPause(false); else if (m.dataset.m === 'invert') { invert = !invert; try { localStorage.setItem('hibiyui.a3d.invert', invert ? '1' : '0'); } catch { /* ok */ } syncInv(); } else if (m.dataset.m === 'quit') { destroy(); if (o.onQuit) o.onQuit(); } });
  root.querySelector('.a3d-pausebtn').addEventListener('click', () => setPause(!paused)); syncInv();
  const resize = () => { const w = root.clientWidth || innerWidth; const h = root.clientHeight || innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < 1.5 ? 70 : 62; camera.updateProjectionMatrix(); portrait = h > w * 1.05; root.classList.toggle('portrait', portrait); };
  window.addEventListener('resize', resize); window.addEventListener('orientationchange', resize); resize();
  try { if (document.documentElement.requestFullscreen && !document.fullscreenElement && /Mobi|Android/i.test(navigator.userAgent)) { document.documentElement.requestFullscreen().then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {})).catch(() => {}); } } catch { /* ok */ }

  // ---- HUD ----
  const q = (s) => root.querySelector(s); const hud = { hp: q('.ab.hp u'), base: q('.ab.base u'), boost: q('.ab.boost u'), ms: q('.ab.ms b'), obj: q('.a3d-obj'), banner: q('.a3d-banner'), msg: q('.a3d-msg'), warn: q('.a3d-warn'), marks: q('.a3d-marks'), radar: q('.a3d-radar').getContext('2d') };
  let lastBanner = ''; const v3 = new THREE.Vector3();
  const project = (x, y, z) => { v3.set(x, y, z).project(camera); return { x: (v3.x * 0.5 + 0.5) * root.clientWidth, y: (-v3.y * 0.5 + 0.5) * root.clientHeight, z: v3.z }; };
  function updateHud() {
    const P = S.player;
    hud.hp.style.width = `${clamp(P.hp / P.hpMax, 0, 1) * 100}%`; hud.hp.parentElement.classList.toggle('low', P.hp / P.hpMax < 0.3);
    hud.base.style.width = `${clamp(S.base.hp / S.base.hpMax, 0, 1) * 100}%`; hud.base.parentElement.classList.toggle('low', S.base.hp / S.base.hpMax < 0.3);
    hud.boost.style.width = `${clamp(P.boost / sim.machine.boostMax, 0, 1) * 100}%`; hud.ms.textContent = `🚀 ×${P.missiles}`;
    const left = S.enemies.length; hud.obj.textContent = o.mission.boss ? (S.boss && !S.boss.dead ? `ボス HP ${Math.max(0, Math.round((S.boss.hp / S.boss.hpMax) * 100))}%` : 'ボスを たおせ!') : `てき のこり ${left + (o.mission.waves.slice(S.waveI).reduce((a, w) => a + w.n, 0))}き ・ げきつい ${S.kills}`;
    const b = S.bannerT > 0 ? S.banner : ''; if (b !== lastBanner) { lastBanner = b; hud.banner.textContent = b; hud.banner.classList.toggle('on', !!b); }
    hud.msg.textContent = S.msgT > 0 ? S.msg : ''; hud.warn.textContent = S.outWarn ? '⚠ えんしゅうから でちゃう! もどって!' : S.groundWarn ? '⚠ うみに ちかいよ!' : (P.hp / P.hpMax < 0.3 ? '⚠ きたいが あぶない!' : ''); S.groundWarn = 0;
    root.classList.toggle('hurt', S.hurt > 0);
    // ロックオン・てきの マーク
    let html = ''; const lc = new Map((S.lockCands || []).map((c) => [c.id, c]));
    for (const e of S.enemies) { const pj = project(e.x, e.y, e.z); if (pj.z > 1 || pj.x < -30 || pj.x > root.clientWidth + 30 || pj.y < -30 || pj.y > root.clientHeight + 30) continue; const c = lc.get(e.id); const d = Math.round(Math.hypot(e.x - P.x, e.y - P.y, e.z - P.z)); const sz = clamp(900 / Math.max(120, d) * 16, 14, 46);
      html += `<div class="mk ${c ? (c.locked ? 'lock' : 'seek') : ''} ${e.type}" style="left:${pj.x}px;top:${pj.y}px;width:${sz}px;height:${sz}px"><small>${d}m</small></div>`; }
    hud.marks.innerHTML = html;
    // レーダー
    const g = hud.radar; g.clearRect(0, 0, 120, 120); g.fillStyle = 'rgba(8,24,44,.55)'; g.beginPath(); g.arc(60, 60, 58, 0, 6.283); g.fill(); g.strokeStyle = 'rgba(127,231,255,.5)'; g.beginPath(); g.arc(60, 60, 58, 0, 6.283); g.stroke(); g.beginPath(); g.arc(60, 60, 29, 0, 6.283); g.stroke();
    const rr = 1800; const toR = (x, z) => { const dx = x - P.x; const dz = z - P.z; const c = Math.cos(P.yaw); const s = Math.sin(P.yaw); return { x: 60 + ((dx * c - dz * s) / rr) * 58, y: 60 - ((dx * s + dz * c) / rr) * 58 }; };
    g.fillStyle = '#4aa3ff'; g.beginPath(); g.moveTo(60, 52); g.lineTo(55, 66); g.lineTo(65, 66); g.fill();
    const bp2 = toR(S.base.x, S.base.z); g.fillStyle = '#ffd23f'; g.fillRect(clamp(bp2.x, 4, 114) - 4, clamp(bp2.y, 4, 114) - 4, 8, 8);
    for (const e of S.enemies) { const r = toR(e.x, e.z); if (Math.hypot(r.x - 60, r.y - 60) > 58) continue; g.fillStyle = e.type === 'boss' ? '#ff9f1c' : '#ff4d5e'; g.fillRect(r.x - 2, r.y - 2, e.type === 'boss' ? 7 : 4, e.type === 'boss' ? 7 : 4); }
  }
  // ---- かく ----
  const cam = { x: 0, y: 0, z: 0 }; let tt = 0; let raf = 0; let last = 0; let acc = 0; let endT = 0; let ended = false; let sndT = 0;
  function syncScene(dt) {
    const P = S.player; const f = { x: Math.sin(P.yaw) * Math.cos(P.pitch), y: Math.sin(P.pitch), z: Math.cos(P.yaw) * Math.cos(P.pitch) };
    me.position.set(P.x, P.y, P.z); me.rotation.order = 'YXZ'; me.rotation.set(-P.pitch, P.yaw, P.roll + (P.rollSpin ? P.rollSpin * 6.283 : 0)); me.visible = !(S.done && !S.win);
    me.userData.flame.scale.set(1, 1, P.boosting ? 2.4 : 1);
    S.wings.forEach((w, i) => { const m = wingM[i]; m.position.set(w.x, w.y, w.z); m.rotation.order = 'YXZ'; m.rotation.set(-w.pitch, w.yaw, P.roll * 0.8); });
    // てき
    const alive = new Set();
    for (const e of S.enemies) { alive.add(e.id); let m = meshes.get(e.id); if (!m) { m = e.type === 'drone' ? makeDrone(THREE) : e.type === 'bomber' ? makeBomber(THREE) : e.type === 'boss' ? makeBoss(THREE) : makeJet(THREE, '#a8324a', 1.1, true); scene.add(m); meshes.set(e.id, m); } m.position.set(e.x, e.y, e.z); m.rotation.order = 'YXZ'; m.rotation.set(-e.pitch, e.yaw, e.type === 'drone' ? tt * 6 : 0); if (e.type === 'drone') m.rotation.set(0, e.yaw + tt * 4, 0); }
    for (const [id, m] of meshes) if (!alive.has(id)) { scene.remove(m); meshes.delete(id); }
    // たま・ミサイル・きせき
    S.bullets.forEach((b, i) => { const m = getFromPool(bulletPool, bulletGeo, bulletMat, i); m.visible = true; m.position.set(b.x, b.y, b.z); }); for (let i = S.bullets.length; i < bulletPool.length; i++) bulletPool[i].visible = false;
    S.missiles.forEach((b, i) => { const m = getFromPool(missilePool, misGeo, misMat, i); m.visible = true; m.position.set(b.x, b.y, b.z); m.lookAt(b.x + b.vx, b.y + b.vy, b.z + b.vz); m.rotateX(Math.PI / 2); }); for (let i = S.missiles.length; i < missilePool.length; i++) missilePool[i].visible = false;
    S.tracers.forEach((t, i) => { const m = getFromPool(tracerPool, trGeo, trMat, i); m.visible = true; const a = t.from; const b = t.to; const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z); const fr = clamp(t.t / 0.12, 0, 1); m.position.set(lerp(a.x, b.x, 0.5 + fr * 0.2), lerp(a.y, b.y, 0.5 + fr * 0.2), lerp(a.z, b.z, 0.5 + fr * 0.2)); m.scale.set(1, Math.min(len, 60), 1); m.lookAt(b.x, b.y, b.z); m.rotateX(Math.PI / 2); }); for (let i = S.tracers.length; i < tracerPool.length; i++) tracerPool[i].visible = false;
    // ばくはつ
    S.effects.forEach((e, i) => { let m = fxPool[i]; if (!m) { m = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.9, depthWrite: false })); scene.add(m); fxPool[i] = m; } const k = e.t / e.life; m.visible = true; m.position.set(e.x, e.y, e.z); m.scale.setScalar(e.r * (0.35 + k * 1.3)); m.material.opacity = 0.9 * (1 - k); m.material.color.set(e.kind === 'spark' ? '#fff7a0' : k < 0.4 ? '#fff0a0' : '#ff7a2a'); }); for (let i = S.effects.length; i < fxPool.length; i++) fxPool[i].visible = false;
    base.children.forEach((c) => c); dome.material.opacity = 0.1 + (S.baseHurt > 0 ? 0.25 : 0);
    // カメラ(うしろから)
    const bx = P.x - f.x * 34; const by = P.y - f.y * 34 + 9; const bz = P.z - f.z * 34; const k = 1 - Math.exp(-7 * dt);
    cam.x += (bx - cam.x) * k; cam.y += (by - cam.y) * k; cam.z += (bz - cam.z) * k; if (!cam.init) { cam.x = bx; cam.y = by; cam.z = bz; cam.init = true; }
    camera.position.set(cam.x, Math.max(6, cam.y), cam.z); camera.up.set(Math.sin(-P.roll * 0.35), Math.cos(P.roll * 0.35), 0); camera.lookAt(P.x + f.x * 90, P.y + f.y * 90, P.z + f.z * 90);
    sea.position.x = P.x; sea.position.z = P.z; seaLines.position.x = Math.round(P.x / 200) * 200; seaLines.position.z = Math.round(P.z / 200) * 200;
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function frame(ts) {
    if (dead) return; const dt = Math.min(0.05, last ? (ts - last) / 1000 : 0.016); last = ts; tt += dt;
    if (!paused && !portrait) {
      acc += dt; let n = 0; while (acc >= 1 / 60 && n++ < 4) { sim.step(1 / 60); acc -= 1 / 60; }
      sndT += dt; while (S.snd.length) { const nm = S.snd.shift(); if (o.onSfx) o.onSfx(nm); }
      if (S.done && !ended) { endT += dt; if (endT > 2.4) { ended = true; showEnd(); } }
    }
    syncScene(dt); updateHud(); renderer.render(scene, camera); raf = requestAnimationFrame(frame);
  }
  function showEnd() {
    const el = root.querySelector('.a3d-end'); el.hidden = false; const stars = S.stars || 0;
    el.innerHTML = `<div class="ae-box ${S.win ? 'win' : 'lose'}"><b>${S.win ? '🎖 ミッション クリア!' : 'ミッション しっぱい…'}</b><div class="ae-stars">${S.win ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : ''}</div>
      <p>げきつい ${S.kills} ・ きちの のこり ${Math.round((S.base.hp / S.base.hpMax) * 100)}% ・ きたい ${Math.round((S.player.hp / S.player.hpMax) * 100)}%</p><button class="btn gold" data-e="done">けっかを みる</button></div>`;
    el.querySelector('[data-e=done]').addEventListener('click', () => finish());
  }
  function finish() { if (dead) return; const r = { win: S.win, stars: S.stars || 0, kills: S.kills, basePct: S.base.hp / S.base.hpMax, hpPct: S.player.hp / S.player.hpMax, time: S.t, mission: o.mission.id }; destroy(); if (o.onEnd) o.onEnd(r); }
  function destroy() {
    if (dead) return; dead = true; cancelAnimationFrame(raf); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('resize', resize); window.removeEventListener('orientationchange', resize);
    try { renderer.dispose(); scene.traverse((ob) => { if (ob.geometry) ob.geometry.dispose(); if (ob.material) (Array.isArray(ob.material) ? ob.material : [ob.material]).forEach((m) => m.dispose()); }); } catch { /* ok */ }
    root.remove(); document.body.style.overflow = prevOverflow; try { if (document.fullscreenElement) document.exitFullscreen(); if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch { /* ok */ }
  }
  raf = requestAnimationFrame(frame);
  const api = { destroy: () => { if (ACTIVE === api) ACTIVE = null; destroy(); }, sim, root, renderer };
  ACTIVE = api; return api;
}
