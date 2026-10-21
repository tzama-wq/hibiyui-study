// 「そらの まもり」の 3D がめん(three.js): ひこうき・ふね・せんしゃ。タッチ そうさ + HUD。ルールと うごきは airsim.js、みためは vehicle3d.js。
//   const g = await startAir3D({ vehicle, spec, mission, gentle, onSfx, onEnd, onQuit });   vehicle=buildVehicle の けっか / spec=みための ぶひん じょうほう
import { createAir, BASE_Z, ISLAND, ENEMY } from './airsim.js';
import { makeVehicleModel, makeEnemyModel } from './vehicle3d.js';

let T = null;
async function loadThree() { if (!T) T = await import('./vendor/three.module.min.js'); return T; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const esc = (s) => String(s).replace(/[<>&"]/g, '');
let ACTIVE = null;

export async function startAir3D(o) {
  const THREE = await loadThree();
  if (ACTIVE) { try { ACTIVE.destroy(); } catch { /* ok */ } ACTIVE = null; }
  document.querySelectorAll('.a3d').forEach((e) => e.remove());
  const V = o.vehicle; const kind = V.vehicle; const air = kind === 'plane';
  const sim = createAir({ vehicle: V, mission: o.mission, gentle: !!o.gentle, difficulty: o.difficulty || 1 });
  const S = sim.state;
  const root = document.createElement('div'); root.className = `a3d k-${kind}`;
  root.innerHTML = `<canvas class="a3d-cv"></canvas>
    <div class="a3d-hud">
      <div class="a3d-top"><div class="a3d-name">${esc(o.spec.icon || '')} ${esc(V.name)} ・ ${esc(o.spec.vname || '')}</div><div class="a3d-obj"></div></div>
      <div class="a3d-bars"><div class="ab hp"><span>きたい</span><i><u></u></i></div><div class="ab base"><span>きち</span><i><u></u></i></div><div class="ab boost"><span>ブースト</span><i><u></u></i></div><div class="ab ms"><span>ミサイル</span><b></b></div></div>
      <div class="a3d-marks"></div><div class="a3d-banner"></div><div class="a3d-msg"></div><div class="a3d-warn"></div>
      <div class="a3d-ret"><i></i></div><canvas class="a3d-radar" width="120" height="120"></canvas>
      <button class="a3d-pausebtn" aria-label="ポーズ">⏸</button>
    </div>
    <div class="a3d-pad"><div class="a3d-stick"><div class="a3d-knob"></div></div>
      <div class="a3d-btns"><button class="ab-b ab-gun" data-b="gun">${air ? 'きかんほう' : 'ほうげき'}</button><button class="ab-b ab-ms" data-b="missile">ミサイル</button><button class="ab-b ab-boost" data-b="boost">ブースト</button><button class="ab-b ab-ev" data-b="evade">${air ? 'かいひ' : 'バリア'}</button>${air ? '' : '<button class="ab-b ab-tg" data-b="target">てきに<br>むける</button>'}</div></div>
    <div class="a3d-rot p3d-rot"><div>📱↔<br>よこむきに して あそんでね</div></div>
    <div class="a3d-end" hidden></div>
    <div class="p3d-menu a3d-menu" hidden><div class="p3d-menubox"><b>ポーズ</b><button class="btn gold" data-m="resume">▶ つづける</button><button class="btn gray" data-m="quit">ミッションを やめる</button></div></div>`;
  document.body.appendChild(root);
  const prevOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
  const cv = root.querySelector('.a3d-cv');
  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, o.calm ? 1.25 : 1.75)); renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#7fb8f0'); scene.fog = new THREE.Fog('#b7d8f5', 700, 4800);
  const camera = new THREE.PerspectiveCamera(62, 16 / 9, 1, 9000);
  scene.add(new THREE.HemisphereLight(0xdfeeff, 0x2a5d8a, 1.05)); const sun = new THREE.DirectionalLight(0xffffff, 1.1); sun.position.set(-400, 900, -300); scene.add(sun);
  // うみ・しま
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(14000, 14000), new THREE.MeshLambertMaterial({ color: '#1f6fa8' })); sea.rotation.x = -Math.PI / 2; sea.position.set(0, -1.5, BASE_Z); scene.add(sea);
  const seaLines = new THREE.GridHelper(14000, 70, 0x8fd0ff, 0x4a9ad0); seaLines.position.set(0, 0.5, BASE_Z); seaLines.material.transparent = true; seaLines.material.opacity = 0.25; scene.add(seaLines);
  const beach = new THREE.Mesh(new THREE.CylinderGeometry(ISLAND + 40, ISLAND + 70, 1, 40), new THREE.MeshLambertMaterial({ color: '#e8d9a0' })); beach.position.set(0, -0.2, BASE_Z); scene.add(beach);
  const land = new THREE.Mesh(new THREE.CylinderGeometry(ISLAND, ISLAND + 20, 1, 40), new THREE.MeshLambertMaterial({ color: '#5a9a4c' })); land.position.set(0, 0.2, BASE_Z); scene.add(land);
  const treeMat = new THREE.MeshLambertMaterial({ color: '#2f6f3a' });
  for (let i = 0; i < 70; i++) { const a = i * 2.399; const r = 160 + ((i * 53) % 440); const t = new THREE.Mesh(new THREE.ConeGeometry(9 + (i % 4) * 2, 26 + (i % 5) * 4, 6), treeMat); t.position.set(Math.cos(a) * r, 14, BASE_Z + Math.sin(a) * r); scene.add(t); }
  const cloudMat = new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 });
  for (let i = 0; i < 30; i++) { const c = new THREE.Group(); const n = 3 + (i % 3); for (let j = 0; j < n; j++) { const s = new THREE.Mesh(new THREE.SphereGeometry(60 + (j * 17) % 50, 8, 6), cloudMat); s.position.set(j * 70, (j % 2) * 18, (j % 3) * 30); s.scale.y = 0.45; c.add(s); } c.position.set(Math.sin(i * 7.3) * 2600, 360 + (i * 53) % 520, BASE_Z + Math.cos(i * 4.1) * 2800); scene.add(c); }
  const isl = new THREE.MeshLambertMaterial({ color: '#4a7a42' }); for (let i = 0; i < 7; i++) { const m = new THREE.Mesh(new THREE.ConeGeometry(80 + (i * 37) % 120, 70 + (i * 29) % 80, 8), isl); m.position.set(Math.sin(i * 2.1) * 2400, 25, BASE_Z + 400 + Math.cos(i * 1.7) * 2200); scene.add(m); }
  // きち
  const base = new THREE.Group(); { const pad = new THREE.Mesh(new THREE.CylinderGeometry(230, 250, 1.4, 24), new THREE.MeshLambertMaterial({ color: '#7b8aa0' })); pad.position.y = 0.8; base.add(pad);
    for (let i = 0; i < 18; i++) { const h = 20 + (i * 13) % 50; const b = new THREE.Mesh(new THREE.BoxGeometry(18 + (i % 3) * 6, h, 18), new THREE.MeshLambertMaterial({ color: i % 4 ? '#e8eefc' : '#ffd23f' })); b.position.set(Math.cos(i * 1.7) * (120 + (i % 5) * 18), 1.5 + h / 2, Math.sin(i * 1.7) * (120 + (i % 5) * 18)); base.add(b); }
    const flag = new THREE.Mesh(new THREE.BoxGeometry(2, 60, 2), new THREE.MeshLambertMaterial({ color: '#ffffff' })); flag.position.set(150, 31, 0); base.add(flag); const hi = new THREE.Mesh(new THREE.CircleGeometry(10, 16), new THREE.MeshBasicMaterial({ color: '#e0302a', side: THREE.DoubleSide })); hi.position.set(158, 56, 0); base.add(hi); }
  base.position.set(0, 0, BASE_Z); scene.add(base);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(230, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#7fe7ff', transparent: true, opacity: 0.1, depthWrite: false })); dome.position.set(0, 0, BASE_Z); scene.add(dome);
  // じぶんの きたい
  const me = makeVehicleModel(THREE, { vehicle: kind, color: o.spec.color, parts: o.spec.parts, missiles: V.missiles }); scene.add(me);
  const shield = new THREE.Mesh(new THREE.SphereGeometry(air ? 14 : 24, 14, 10), new THREE.MeshBasicMaterial({ color: '#7fe7ff', transparent: true, opacity: 0.28, depthWrite: false })); shield.visible = false; scene.add(shield);
  const meshes = new Map();
  const pools = { bullet: [], missile: [], tracer: [], fx: [] };
  const bulletGeo = new THREE.SphereGeometry(1.4, 6, 4); const bulletMat = new THREE.MeshBasicMaterial({ color: '#ffd23f' });
  const misGeo = new THREE.CylinderGeometry(0.5, 0.5, 7, 6); const misMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const trGeo = new THREE.CylinderGeometry(0.25, 0.25, 1, 4); const trMat = new THREE.MeshBasicMaterial({ color: '#fff7a0' });
  const fromPool = (pool, geo, mat, i) => { while (pool.length <= i) { const m = new THREE.Mesh(geo, mat); m.visible = false; scene.add(m); pool.push(m); } return pool[i]; };

  // ---- そうさ ----
  const stick = root.querySelector('.a3d-stick'); const knob = root.querySelector('.a3d-knob'); const pad = root.querySelector('.a3d-pad'); let sid = null; let so = { x: 0, y: 0 }; const R = 56; 
  const setStick = (dx, dy) => { const m = Math.hypot(dx, dy); const k = m > R ? R / m : 1; const x = dx * k; const y = dy * k; knob.style.transform = `translate(${x}px,${y}px)`; const vx = x / R; const vy = y / R; if (Math.hypot(vx, vy) < 0.1) { sim.input.turn = 0; sim.input.climb = 0; } else { sim.input.turn = -vx; sim.input.climb = -vy; } };
  let aid = null; let ao = { x: 0, y: 0 };
  const setAim = (dx, dy) => { const m = Math.hypot(dx, dy); const k = m > R ? R / m : 1; const vx = (dx * k) / R; const vy = (dy * k) / R; sim.input.aimX = Math.abs(vx) < 0.08 ? 0 : -vx; sim.input.aimY = Math.abs(vy) < 0.08 ? 0 : -vy; };
  pad.addEventListener('pointerdown', (e) => { if (e.target.closest('.ab-b')) return; if (!air && e.clientX > root.clientWidth * 0.5) { if (aid !== null) return; aid = e.pointerId; ao = { x: e.clientX, y: e.clientY }; try { pad.setPointerCapture(e.pointerId); } catch { /* ok */ } root.classList.add('aiming'); e.preventDefault(); return; } if (sid !== null) return; sid = e.pointerId; try { pad.setPointerCapture(e.pointerId); } catch { /* ok */ } const r = stick.getBoundingClientRect(); so = { x: e.clientX, y: e.clientY }; stick.style.left = `${e.clientX - r.width / 2}px`; stick.style.bottom = 'auto'; stick.style.top = `${e.clientY - r.height / 2}px`; setStick(0, 0); e.preventDefault(); });
  pad.addEventListener('pointermove', (e) => { if (e.pointerId === aid) { setAim(e.clientX - ao.x, e.clientY - ao.y); e.preventDefault(); return; } if (e.pointerId !== sid) return; setStick(e.clientX - so.x, e.clientY - so.y); e.preventDefault(); });
  const endStick = (e) => { if (e.pointerId === aid) { aid = null; setAim(0, 0); root.classList.remove('aiming'); return; } if (e.pointerId !== sid) return; sid = null; setStick(0, 0); stick.style.left = ''; stick.style.top = ''; stick.style.bottom = ''; };
  pad.addEventListener('pointerup', endStick); pad.addEventListener('pointercancel', endStick);
  const bp = (b) => { if (b === 'gun') sim.input.gun = true; else if (b === 'boost') sim.input.boost = true; else if (b === 'missile') sim.fireMissile(); else if (b === 'evade') sim.evade(); else if (b === 'target') sim.nextTarget(); };
  const br = (b) => { if (b === 'gun') sim.input.gun = false; else if (b === 'boost') sim.input.boost = false; };
  root.querySelectorAll('.ab-b').forEach((btn) => { const b = btn.dataset.b; btn.addEventListener('pointerdown', (e) => { try { btn.setPointerCapture(e.pointerId); } catch { /* ok */ } btn.classList.add('on'); bp(b); e.preventDefault(); }); const up = (e) => { btn.classList.remove('on'); br(b); e.preventDefault(); }; btn.addEventListener('pointerup', up); btn.addEventListener('pointercancel', up); });
  const keys = new Set(); const recompute = () => { const x = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0); const y = (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0) - (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0); sim.input.turn = -x; sim.input.climb = y; };
  const akeys = { KeyI: [0, 1], KeyK: [0, -1], KeyJ: [-1, 0], KeyL: [1, 0] }; const aimKeys = new Set();
  const kmap = { Space: 'gun', KeyF: 'missile', ShiftLeft: 'boost', KeyE: 'evade', KeyT: 'target' };
  const recAim = () => { let x = 0; let y = 0; for (const c of aimKeys) { x += akeys[c][0]; y += akeys[c][1]; } sim.input.aimX = -x; sim.input.aimY = y; };
  const kd = (e) => { if (e.repeat) return; if (!air && akeys[e.code]) { aimKeys.add(e.code); recAim(); return; } if (e.code === 'Escape' || e.code === 'KeyP') { setPause(!paused); return; } if (kmap[e.code]) { bp(kmap[e.code]); e.preventDefault(); return; } keys.add(e.code); recompute(); if (e.code.startsWith('Arrow')) e.preventDefault(); };
  const ku = (e) => { if (akeys[e.code]) { aimKeys.delete(e.code); recAim(); } if (kmap[e.code]) { br(kmap[e.code]); return; } keys.delete(e.code); recompute(); };
  window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
  let paused = false; let dead = false; let portrait = false; const menu = root.querySelector('.a3d-menu');
  const setPause = (v) => { paused = v; menu.hidden = !v; if (v) { sim.input.gun = false; sim.input.boost = false; } };
  
  menu.addEventListener('click', (e) => { const m = e.target.closest('[data-m]'); if (!m) return; if (m.dataset.m === 'resume') setPause(false); else if (m.dataset.m === 'quit') { destroy(); if (o.onQuit) o.onQuit(); } });
  root.querySelector('.a3d-pausebtn').addEventListener('click', () => setPause(!paused));
  const resize = () => { const w = root.clientWidth || innerWidth; const h = root.clientHeight || innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < 1.5 ? 70 : 62; camera.updateProjectionMatrix(); portrait = h > w * 1.05; root.classList.toggle('portrait', portrait); };
  window.addEventListener('resize', resize); window.addEventListener('orientationchange', resize); resize();
  try { if (document.documentElement.requestFullscreen && !document.fullscreenElement && /Mobi|Android/i.test(navigator.userAgent)) { document.documentElement.requestFullscreen().then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {})).catch(() => {}); } } catch { /* ok */ }

  // ---- HUD ----
  const q = (s) => root.querySelector(s); const hud = { hp: q('.ab.hp u'), base: q('.ab.base u'), boost: q('.ab.boost u'), ms: q('.ab.ms b'), obj: q('.a3d-obj'), banner: q('.a3d-banner'), msg: q('.a3d-msg'), warn: q('.a3d-warn'), marks: q('.a3d-marks'), ret: q('.a3d-ret'), radar: q('.a3d-radar').getContext('2d') };
  let lastBanner = ''; const v3 = new THREE.Vector3();
  const project = (x, y, z) => { v3.set(x, y, z).project(camera); return { x: (v3.x * 0.5 + 0.5) * root.clientWidth, y: (-v3.y * 0.5 + 0.5) * root.clientHeight, z: v3.z }; };
  function updateHud() {
    const P = S.player;
    hud.hp.style.width = `${clamp(P.hp / P.hpMax, 0, 1) * 100}%`; hud.hp.parentElement.classList.toggle('low', P.hp / P.hpMax < 0.3);
    hud.base.style.width = `${clamp(S.base.hp / S.base.hpMax, 0, 1) * 100}%`; hud.base.parentElement.classList.toggle('low', S.base.hp / S.base.hpMax < 0.3);
    hud.boost.style.width = `${clamp(P.boost / V.boostMax, 0, 1) * 100}%`; hud.ms.textContent = `🚀 ×${P.missiles}`;
    const left = S.enemies.length + o.mission.waves.slice(S.waveI).reduce((a, w) => a + w.n, 0);
    hud.obj.textContent = o.mission.boss ? (S.boss && !S.boss.dead && S.enemies.includes(S.boss) ? `ボス HP ${Math.max(0, Math.round((S.boss.hp / S.boss.hpMax) * 100))}%` : 'ボスを たおせ!') : `てき のこり ${left}たい ・ げきつい ${S.kills}`;
    const b = S.bannerT > 0 ? S.banner : ''; if (b !== lastBanner) { lastBanner = b; hud.banner.textContent = b; hud.banner.classList.toggle('on', !!b); }
    hud.msg.textContent = S.msgT > 0 ? S.msg : '';
    hud.warn.textContent = S.outWarn ? '⚠ えんしゅうから でちゃう! もどって!' : S.groundWarn ? '⚠ うみに ちかいよ!' : S.shoreWarn ? (kind === 'tank' ? '⚠ しまの はしだよ' : '⚠ しまに ちかいよ') : (P.hp / P.hpMax < 0.3 ? '⚠ きたいが あぶない!' : ''); S.groundWarn = 0; S.shoreWarn = 0;
    root.classList.toggle('hurt', S.hurt > 0);
    { const ay = air ? P.yaw : P.turretYaw; const ap = air ? P.pitch : P.aimPitch; const rp = project(P.x + Math.sin(ay) * Math.cos(ap) * 500, (air ? P.y : 8) + Math.sin(ap) * 500, P.z + Math.cos(ay) * Math.cos(ap) * 500); hud.ret.style.left = `${rp.x}px`; hud.ret.style.top = `${rp.y}px`; hud.ret.style.display = rp.z < 1 ? '' : 'none'; hud.ret.classList.toggle('lock', P.lockTarget.length > 0); }
    let html = ''; const lc = new Map((S.lockCands || []).map((c) => [c.id, c]));
    for (const e of S.enemies) { const pj = project(e.x, e.y + 4, e.z); if (pj.z > 1 || pj.x < -30 || pj.x > root.clientWidth + 30 || pj.y < -30 || pj.y > root.clientHeight + 30) continue; const c = lc.get(e.id); const d = Math.round(Math.hypot(e.x - P.x, e.y - P.y, e.z - P.z)); const sz = clamp(900 / Math.max(120, d) * 16, 14, 46); const isT = S.target && S.target.id === e.id;
      html += `<div class="mk ${c ? (c.locked ? 'lock' : 'seek') : ''} ${isT ? 'tgt' : ''} ${e.type} dom-${e.dom}" style="left:${pj.x}px;top:${pj.y}px;width:${sz}px;height:${sz}px"><small>${ENEMY[e.type].icon}${d}m</small></div>`; }
    hud.marks.innerHTML = html;
    const g = hud.radar; g.clearRect(0, 0, 120, 120); g.fillStyle = 'rgba(8,24,44,.55)'; g.beginPath(); g.arc(60, 60, 58, 0, 6.283); g.fill(); g.strokeStyle = 'rgba(127,231,255,.5)'; g.beginPath(); g.arc(60, 60, 58, 0, 6.283); g.stroke(); g.beginPath(); g.arc(60, 60, 29, 0, 6.283); g.stroke();
    const rr = air ? 1800 : 1400; const toR = (x, z) => { const dx = x - P.x; const dz = z - P.z; const c = Math.cos(P.yaw); const s = Math.sin(P.yaw); return { x: 60 - ((dx * c - dz * s) / rr) * 58, y: 60 - ((dx * s + dz * c) / rr) * 58 }; };
    g.fillStyle = '#4aa3ff'; g.beginPath(); g.moveTo(60, 52); g.lineTo(55, 66); g.lineTo(65, 66); g.fill();
    const bp2 = toR(S.base.x, S.base.z); g.fillStyle = '#ffd23f'; g.fillRect(clamp(bp2.x, 4, 114) - 4, clamp(bp2.y, 4, 114) - 4, 8, 8);
    for (const e of S.enemies) { const r = toR(e.x, e.z); if (Math.hypot(r.x - 60, r.y - 60) > 58) continue; g.fillStyle = e.type === 'boss' ? '#ff9f1c' : e.dom === 'air' ? '#ff4d5e' : e.dom === 'sea' ? '#b57bff' : '#ffb02e'; g.fillRect(r.x - 2, r.y - 2, e.type === 'boss' ? 7 : 4, e.type === 'boss' ? 7 : 4); }
  }
  // ---- かく ----
  const cam = { x: 0, y: 0, z: 0 }; let tt = 0; let raf = 0; let last = 0; let acc = 0; let endT = 0; let ended = false;
  function syncScene(dt) {
    const P = S.player; const f = { x: Math.sin(P.yaw) * Math.cos(P.pitch), y: Math.sin(P.pitch), z: Math.cos(P.yaw) * Math.cos(P.pitch) };
    me.position.set(P.x, P.y, P.z); me.rotation.order = 'YXZ'; me.visible = !(S.done && !S.win);
    if (air) { me.rotation.set(-P.pitch, P.yaw, P.roll + (P.rollSpin ? P.rollSpin * 6.283 : 0)); if (me.userData.flame) me.userData.flame.scale.set(1, 1, P.boosting ? 2.4 : 1); }
    else {
      me.rotation.set(0, P.yaw, P.roll * 0.5); me.position.y = kind === 'ship' ? Math.sin(tt * 1.6) * 0.5 : 0;
      const ty = P.turretYaw - P.yaw; if (me.userData.turrets) me.userData.turrets.forEach((t) => { t.rotation.y = ty; }); if (me.userData.turret) me.userData.turret.rotation.y = ty; if (me.userData.radar) me.userData.radar.rotation.y = tt * 3;
    }
    shield.visible = S.shield > 0; shield.position.set(P.x, P.y + (air ? 0 : 8), P.z);
    const alive = new Set();
    for (const e of S.enemies) { alive.add(e.id); let m = meshes.get(e.id); if (!m) { m = makeEnemyModel(THREE, e.type); scene.add(m); meshes.set(e.id, m); } m.position.set(e.x, e.dom === 'air' ? e.y : e.dom === 'sea' ? Math.sin(tt * 1.3 + e.id) * 0.5 : 0, e.z); m.rotation.order = 'YXZ'; if (e.type === 'drone') m.rotation.set(0, e.yaw + tt * 4, 0); else m.rotation.set(e.dom === 'air' ? -e.pitch : 0, e.yaw, 0); }
    for (const [id, m] of meshes) if (!alive.has(id)) { scene.remove(m); meshes.delete(id); }
    S.bullets.forEach((b, i) => { const m = fromPool(pools.bullet, bulletGeo, bulletMat, i); m.visible = true; m.position.set(b.x, b.y, b.z); }); for (let i = S.bullets.length; i < pools.bullet.length; i++) pools.bullet[i].visible = false;
    S.missiles.forEach((b, i) => { const m = fromPool(pools.missile, misGeo, misMat, i); m.visible = true; m.position.set(b.x, b.y, b.z); m.lookAt(b.x + b.vx, b.y + b.vy, b.z + b.vz); m.rotateX(Math.PI / 2); }); for (let i = S.missiles.length; i < pools.missile.length; i++) pools.missile[i].visible = false;
    S.tracers.forEach((t, i) => { const m = fromPool(pools.tracer, trGeo, trMat, i); m.visible = true; const a = t.from; const b = t.to; const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z); const fr = clamp(t.t / 0.12, 0, 1); m.position.set(lerp(a.x, b.x, 0.5 + fr * 0.2), lerp(a.y, b.y, 0.5 + fr * 0.2), lerp(a.z, b.z, 0.5 + fr * 0.2)); m.scale.set(1, Math.min(len, 60), 1); m.lookAt(b.x, b.y, b.z); m.rotateX(Math.PI / 2); }); for (let i = S.tracers.length; i < pools.tracer.length; i++) pools.tracer[i].visible = false;
    S.effects.forEach((e, i) => { let m = pools.fx[i]; if (!m) { m = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.9, depthWrite: false })); scene.add(m); pools.fx[i] = m; } const k = e.t / e.life; m.visible = true; m.position.set(e.x, e.y, e.z); m.scale.setScalar(e.r * (0.35 + k * 1.3)); m.material.opacity = 0.9 * (1 - k); m.material.color.set(e.kind === 'spark' ? '#fff7a0' : k < 0.4 ? '#fff0a0' : '#ff7a2a'); }); for (let i = S.effects.length; i < pools.fx.length; i++) pools.fx[i].visible = false;
    dome.material.opacity = 0.1 + (S.baseHurt > 0 ? 0.25 : 0);
    // カメラ
    let bx; let by; let bz; let lx; let ly; let lz; const k = 1 - Math.exp(-7 * dt);
    if (air) { bx = P.x - f.x * 26; by = P.y - f.y * 26 + 7; bz = P.z - f.z * 26; lx = P.x + f.x * 90; ly = P.y + f.y * 90; lz = P.z + f.z * 90; }
    else { const d = kind === 'ship' ? 120 : 72; const h = kind === 'ship' ? 58 : 38; const cy = P.turretYaw; bx = P.x - Math.sin(cy) * d; by = h; bz = P.z - Math.cos(cy) * d; lx = P.x + Math.sin(cy) * 300; ly = 8 + Math.tan(P.aimPitch) * 300; lz = P.z + Math.cos(cy) * 300; }
    if (!cam.init) { cam.x = bx; cam.y = by; cam.z = bz; cam.init = true; } cam.x += (bx - cam.x) * k; cam.y += (by - cam.y) * k; cam.z += (bz - cam.z) * k;
    camera.position.set(cam.x, Math.max(6, cam.y), cam.z); camera.up.set(0, 1, 0); camera.lookAt(lx, ly, lz);
    sea.position.x = P.x; sea.position.z = P.z; seaLines.position.x = Math.round(P.x / 200) * 200; seaLines.position.z = Math.round(P.z / 200) * 200;
  }
  function frame(ts) {
    if (dead) return; const dt = Math.min(0.05, last ? (ts - last) / 1000 : 0.016); last = ts; tt += dt;
    if (!paused && !portrait) { acc += dt; let n = 0; while (acc >= 1 / 60 && n++ < 4) { sim.step(1 / 60); acc -= 1 / 60; } while (S.snd.length) { const nm = S.snd.shift(); if (o.onSfx) o.onSfx(nm); } if (S.done && !ended) { endT += dt; if (endT > 2.4) { ended = true; showEnd(); } } }
    syncScene(dt); updateHud(); renderer.render(scene, camera); raf = requestAnimationFrame(frame);
  }
  function showEnd() {
    const el = root.querySelector('.a3d-end'); el.hidden = false; const stars = S.stars || 0;
    el.innerHTML = `<div class="ae-box ${S.win ? 'win' : 'lose'}"><b>${S.win ? '🎖 ミッション クリア!' : 'ミッション しっぱい…'}</b><div class="ae-stars">${S.win ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : ''}</div>
      <p>げきつい ${S.kills} ・ きちの のこり ${Math.round((S.base.hp / S.base.hpMax) * 100)}% ・ きたい ${Math.round((S.player.hp / S.player.hpMax) * 100)}%</p><button class="btn gold" data-e="done">けっかを みる</button></div>`;
    el.querySelector('[data-e=done]').addEventListener('click', () => finish());
  }
  function finish() { if (dead) return; const r = { win: S.win, stars: S.stars || 0, kills: S.kills, basePct: S.base.hp / S.base.hpMax, hpPct: S.player.hp / S.player.hpMax, time: S.t, mission: o.mission.id, vehicle: kind }; destroy(); if (o.onEnd) o.onEnd(r); }
  function destroy() {
    if (dead) return; dead = true; cancelAnimationFrame(raf); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('resize', resize); window.removeEventListener('orientationchange', resize);
    try { renderer.dispose(); scene.traverse((ob) => { if (ob.geometry) ob.geometry.dispose(); if (ob.material) (Array.isArray(ob.material) ? ob.material : [ob.material]).forEach((m) => m.dispose()); }); } catch { /* ok */ }
    root.remove(); document.body.style.overflow = prevOverflow; try { if (document.fullscreenElement) document.exitFullscreen(); if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch { /* ok */ }
  }
  raf = requestAnimationFrame(frame);
  const api = { destroy: () => { if (ACTIVE === api) ACTIVE = null; destroy(); }, sim, root, renderer };
  ACTIVE = api; return api;
}

// ---- かくのう庫の プレビュー(まわる 3Dの きたい) -------------------------------------------
let PREV = null;
export async function startPreview(canvas, spec) {
  stopPreview(); if (!canvas) return;
  const THREE = await loadThree(); if (!canvas.isConnected) return;
  const w = canvas.clientWidth || 300; const h = canvas.clientHeight || 180;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(w, h, false); renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); const cam = new THREE.PerspectiveCamera(40, w / h, 1, 600); scene.add(new THREE.HemisphereLight(0xffffff, 0x334466, 1.3)); const sun = new THREE.DirectionalLight(0xffffff, 1.1); sun.position.set(30, 60, 40); scene.add(sun);
  const model = makeVehicleModel(THREE, spec); const kind = spec.vehicle; scene.add(model);
  const R = kind === 'ship' ? 70 : kind === 'tank' ? 36 : 26; const H = kind === 'ship' ? 26 : kind === 'tank' ? 18 : 12;
  let raf = 0; let dead = false; const t0 = performance.now();
  const loop = (ts) => { if (dead) return; if (!canvas.isConnected) { stopPreview(); return; } const t = (ts - t0) / 1000; model.rotation.y = t * 0.6 + 0.6; if (kind === 'plane') model.position.y = Math.sin(t * 1.4) * 0.8; if (model.userData.radar) model.userData.radar.rotation.y = t * 3; cam.position.set(0, H, R); cam.lookAt(0, kind === 'plane' ? 0 : 4, 0); renderer.render(scene, cam); raf = requestAnimationFrame(loop); };
  raf = requestAnimationFrame(loop);
  PREV = { stop: () => { dead = true; cancelAnimationFrame(raf); try { renderer.dispose(); scene.traverse((ob) => { if (ob.geometry) ob.geometry.dispose(); }); } catch { /* ok */ } } };
}
export function stopPreview() { if (PREV) { PREV.stop(); PREV = null; } }
