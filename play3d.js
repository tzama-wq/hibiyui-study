// じぶんで うごかす しあい(3D)。three.js で かく + タッチ そうさ(よこむき) + HUD。ルールは playsim.js。
//   const g = await startPlay3D({ me, opp, halfSec, level, calm, onSfx, onEnd, onQuit });  g.destroy()
import { createPlay, FIELD } from './playsim.js';
import { look } from './match.js';

let T = null;
async function loadThree() { if (!T) T = await import('./vendor/three.module.min.js'); return T; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const SC = 1.55; // えを みやすくする ために せんしゅ・ボールを すこし おおきく する(あそびやすさ ゆうせん)

const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

// ---- テクスチャ ------------------------------------------------------------------
function grassTexture(THREE) {
  const W = 2048; const H = Math.round(W * (FIELD.W + 10) / (FIELD.L + 14));
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const sx = W / (FIELD.L + 14); const sz = H / (FIELD.W + 10); const ox = W / 2; const oz = H / 2;
  const X = (x) => ox + x * sx; const Z = (z) => oz + z * sz;
  g.fillStyle = '#2a8a3f'; g.fillRect(0, 0, W, H);
  const stripes = 14;
  for (let i = 0; i < stripes; i++) { g.fillStyle = i % 2 ? '#2f9645' : '#278238'; g.fillRect(X(-FIELD.L / 2 - 7 + (i * (FIELD.L + 14)) / stripes), 0, ((FIELD.L + 14) / stripes) * sx + 1, H); }
  g.strokeStyle = 'rgba(255,255,255,.92)'; g.lineWidth = Math.max(3, sx * 0.34); g.lineJoin = 'round';
  const L = FIELD.L / 2; const Wd = FIELD.W / 2;
  g.strokeRect(X(-L), Z(-Wd), FIELD.L * sx, FIELD.W * sz);
  g.beginPath(); g.moveTo(X(0), Z(-Wd)); g.lineTo(X(0), Z(Wd)); g.stroke();
  g.beginPath(); g.ellipse(X(0), Z(0), 9.15 * sx, 9.15 * sz, 0, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#fff'; g.beginPath(); g.ellipse(X(0), Z(0), 0.35 * sx, 0.35 * sz, 0, 0, Math.PI * 2); g.fill();
  for (const s of [-1, 1]) {
    g.strokeRect(s > 0 ? X(L - 16.5) : X(-L), Z(-20.16), 16.5 * sx, 40.32 * sz);
    g.strokeRect(s > 0 ? X(L - 5.5) : X(-L), Z(-9.16), 5.5 * sx, 18.32 * sz);
    g.beginPath(); g.ellipse(X(s * (L - 11)), Z(0), 0.3 * sx, 0.3 * sz, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(X(s * (L - 11)), Z(0), 9.15 * sx, 9.15 * sz, 0, s > 0 ? Math.PI * 0.69 : -Math.PI * 0.31, s > 0 ? Math.PI * 1.31 : Math.PI * 0.31); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c); tex.anisotropy = 8; tex.colorSpace = THREE.SRGBColorSpace; return tex;
}
function crowdTexture(THREE) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#10182e'; g.fillRect(0, 0, 512, 128);
  const cols = ['#e8564a', '#f4c542', '#4aa3e8', '#e8e8e8', '#6fcf97', '#a56de2', '#ff9f43'];
  for (let y = 4; y < 128; y += 6) for (let x = 0; x < 512; x += 5) { g.fillStyle = cols[Math.floor(Math.random() * cols.length)]; g.fillRect(x + (y % 12 ? 2 : 0), y, 3, 3); g.fillStyle = '#e0b894'; g.fillRect(x + (y % 12 ? 2 : 0), y - 2, 3, 2); }
  const tex = new THREE.CanvasTexture(c); tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(6, 1); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}

// ---- せんしゅの モデル -------------------------------------------------------------
function makePlayerModel(THREE, lk) {
  const root = new THREE.Group(); const inner = new THREE.Group(); root.add(inner);
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
  const box = (w, h, d, c) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
  // あし(ひざを つけねで ふれる ように、さきを したに ずらす)
  const mkLeg = (z) => { const gr = new THREE.Group(); gr.position.set(0, 0.86, z); const up = box(0.2, 0.42, 0.2, lk.skin); up.position.y = -0.21; const lo = box(0.21, 0.44, 0.21, lk.sock); lo.position.y = -0.64; const shoe = box(0.34, 0.1, 0.22, '#15151c'); shoe.position.set(0.06, -0.86, 0); gr.add(up, lo, shoe); inner.add(gr); return gr; };
  const legL = mkLeg(-0.14); const legR = mkLeg(0.14);
  const shorts = box(0.38, 0.3, 0.5, lk.shorts); shorts.position.y = 0.95; inner.add(shorts);
  const torso = box(0.36, 0.55, 0.56, lk.shirt); torso.position.y = 1.35; inner.add(torso);
  const trim = box(0.37, 0.06, 0.57, lk.trim); trim.position.y = 1.12; inner.add(trim);
  const mkArm = (z) => { const gr = new THREE.Group(); gr.position.set(0, 1.55, z); const a = box(0.16, 0.5, 0.16, lk.shirt); a.position.y = -0.24; const h = box(0.14, 0.14, 0.14, lk.glove ? '#ffd23f' : lk.skin); h.position.y = -0.55; gr.add(a, h); inner.add(gr); return gr; };
  const armL = mkArm(-0.36); const armR = mkArm(0.36);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 12), mat(lk.skin)); head.position.y = 1.86; inner.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.255, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(lk.hair)); hair.position.y = 1.88; hair.rotation.z = 0.15; inner.add(hair);
  const nose = box(0.06, 0.06, 0.06, lk.skin); nose.position.set(0.24, 1.84, 0); inner.add(nose);
  if (lk.star) { const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), new THREE.MeshBasicMaterial({ color: lk.star === 'kid' ? '#ffd23f' : lk.star === 'legend' ? '#ff9f1c' : lk.star === 'diamond' ? '#9ff3ff' : '#9be7ff' })); star.position.y = 2.35; inner.add(star); root.userData.star = star; }
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 14), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; root.add(shadow);
  root.scale.setScalar(SC);
  root.userData = { ...root.userData, inner, legL, legR, armL, armR, head, shadow };
  return root;
}

// ---- メイン ----------------------------------------------------------------------
export async function startPlay3D(o) {
  const THREE = await loadThree();
  let watch = o.mode === 'watch';
  const sim = createPlay({ me: o.me, opp: o.opp, halfSec: o.halfSec || 90, level: o.level || 1, tactic: o.tactic || 'balance', auto: watch });
  const S = sim.state;
  const root = document.createElement('div'); root.className = 'p3d';
  root.innerHTML = `<canvas class="p3d-cv"></canvas>
    <div class="p3d-hud"><div class="p3d-score"><span class="ta">${esc(o.me.name)}</span><b class="sa">0</b><i class="tm">0:00</i><b class="sb">0</b><span class="tb">${esc(o.opp.name)}</span></div>
      <button class="p3d-modebtn" aria-label="かんせん/そうさ"></button><button class="p3d-pausebtn" aria-label="ポーズ">⏸</button><div class="p3d-stats"></div><div class="p3d-banner"></div><div class="p3d-msg"></div><div class="p3d-ctl"><b></b><i><u></u></i></div><div class="p3d-tag"></div></div>
    <div class="p3d-pad"><div class="p3d-stick"><div class="p3d-knob"></div></div>
      <div class="p3d-btns"><button class="pb pb-d" data-b="sprint">ダッシュ</button><button class="pb pb-c" data-b="lob">ロング</button><button class="pb pb-a" data-b="pass">パス</button><button class="pb pb-b" data-b="shoot">シュート</button></div></div>
    <div class="p3d-intro"><div class="pi-vs"><div class="pi-team a"><small>HOME</small><b class="pi-na"></b><span class="pi-pa"></span><em class="pi-ka"></em></div><i>VS</i><div class="pi-team b"><small>AWAY</small><b class="pi-nb"></b><span class="pi-pb"></span><em class="pi-kb"></em></div></div><div class="pi-info"></div><div class="pi-count"></div><div class="pi-skip">タップで スキップ ▶</div></div>
    <div class="p3d-rot"><div>📱↔<br>よこむきに して あそんでね</div></div>
    <div class="p3d-menu" hidden><div class="p3d-menubox"><b>ポーズ</b><button class="btn gold" data-m="resume">▶ つづける</button><button class="btn" data-m="skipintro" hidden>⏭ オープニングを とばす</button><button class="btn" data-m="skip">⏭ しあいを スキップ(のこりは じどうで)</button><button class="btn" data-m="mode"></button><button class="btn" data-m="swap"></button><div class="p3d-tactics"><small>せんじゅつ</small><button class="chipb" data-t="attack">アタック</button><button class="chipb" data-t="balance">バランス</button><button class="chipb" data-t="counter">カウンター</button></div><button class="btn gray" data-m="quit">しあいを やめる</button></div></div>`;
  (o.root || document.body).appendChild(root);
  const prevOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; // うしろの がめんが うごかない ように
  const cv = root.querySelector('.p3d-cv');
  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, o.calm ? 1.25 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#0a1426'); scene.fog = new THREE.Fog('#0a1426', 90, 190);
  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.5, 400);
  scene.add(new THREE.HemisphereLight(0xdfeaff, 0x2a5a30, 1.0)); const sun = new THREE.DirectionalLight(0xffffff, 1.2); sun.position.set(-30, 60, 25); scene.add(sun);
  // ピッチ
  const tex = grassTexture(THREE);
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(FIELD.L + 14, FIELD.W + 10), new THREE.MeshLambertMaterial({ map: tex })); pitch.rotation.x = -Math.PI / 2; scene.add(pitch);
  const out = new THREE.Mesh(new THREE.PlaneGeometry(400, 300), new THREE.MeshLambertMaterial({ color: '#16331f' })); out.rotation.x = -Math.PI / 2; out.position.y = -0.05; scene.add(out);
  // ゴール
  const post = new THREE.MeshLambertMaterial({ color: '#ffffff' });
  for (const s of [-1, 1]) {
    const gx = s * FIELD.L / 2; const hw = FIELD.GW / 2;
    for (const z of [-hw, hw]) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, FIELD.GH, 8), post); m.position.set(gx, FIELD.GH / 2, z); scene.add(m); }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, FIELD.GW, 8), post); bar.rotation.x = Math.PI / 2; bar.position.set(gx, FIELD.GH, 0); scene.add(bar);
    const net = new THREE.Mesh(new THREE.BoxGeometry(2.4, FIELD.GH, FIELD.GW, 6, 4, 10), new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.35 })); net.position.set(gx + s * 1.2, FIELD.GH / 2, 0); scene.add(net);
  }
  // かんきゃくせき・ボード
  const crowd = new THREE.MeshBasicMaterial({ map: crowdTexture(THREE) });
  const stand = (w, d, x, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 16), crowd); m.position.set(x, 9, z); m.rotation.set(-0.5, ry, 0, 'YXZ'); scene.add(m); };
  stand(FIELD.L + 40, 0, 0, -FIELD.W / 2 - 14, 0); stand(FIELD.L + 40, 0, 0, FIELD.W / 2 + 22, Math.PI);
  stand(FIELD.W + 30, 0, -FIELD.L / 2 - 22, 0, Math.PI / 2); stand(FIELD.W + 30, 0, FIELD.L / 2 + 22, 0, -Math.PI / 2);
  const BOARD = ['#e63946', '#2a9d8f', '#f4a261', '#4361ee', '#9b5de5', '#ffbe0b'];
  for (let i = 0; i < 14; i++) { const w = (FIELD.L + 10) / 14; const m = new THREE.Mesh(new THREE.BoxGeometry(w - 0.3, 1.1, 0.3), new THREE.MeshLambertMaterial({ color: BOARD[i % BOARD.length] })); m.position.set(-FIELD.L / 2 - 5 + (i + 0.5) * w, 0.55, -FIELD.W / 2 - 3.4); scene.add(m); const m2 = m.clone(); m2.position.z = FIELD.W / 2 + 3.4; scene.add(m2); }
  // せんしゅ
  const models = { a: [], b: [] };
  for (const s of ['a', 'b']) sim.players[s].forEach((p) => { const lk = look(p.m, s, s === 'a' ? o.me.name : o.opp.name); const m = makePlayerModel(THREE, lk); scene.add(m); models[s].push(m); });
  // ボール
  const ballM = new THREE.Mesh(new THREE.SphereGeometry(0.3 * SC * 0.8, 16, 12), new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#222222' })); scene.add(ballM);
  const bshadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 12), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.4, depthWrite: false })); bshadow.rotation.x = -Math.PI / 2; bshadow.position.y = 0.03; scene.add(bshadow);
  // じぶんの せんしゅの めじるし
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.9 * SC * 0.7, 1.2 * SC * 0.7, 28), new THREE.MeshBasicMaterial({ color: '#ffd23f', side: THREE.DoubleSide, transparent: true, opacity: 0.95, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; scene.add(ring);
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.8, 4), new THREE.MeshBasicMaterial({ color: '#ffd23f' })); arrow.rotation.x = Math.PI; scene.add(arrow);

  // ---- そうさ(ジョイスティック・ボタン・キーボード) ---------------------------------
  const stick = root.querySelector('.p3d-stick'); const knob = root.querySelector('.p3d-knob'); let sid = null; let so = { x: 0, y: 0 }; const R = 56;
  const setStick = (dx, dy) => { const m = Math.hypot(dx, dy); const k = m > R ? R / m : 1; const x = dx * k; const y = dy * k; knob.style.transform = `translate(${x}px,${y}px)`; const vx = x / R; const vy = y / R; const mm = Math.hypot(vx, vy); if (mm < 0.14) { sim.input.mx = 0; sim.input.mz = 0; } else { sim.input.mx = vx; sim.input.mz = vy; } };
  const pad = root.querySelector('.p3d-pad');
  pad.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.pb')) return;
    if (sid !== null) return; sid = e.pointerId; try { pad.setPointerCapture(e.pointerId); } catch { /* ok */ }
    const r = stick.getBoundingClientRect(); so = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    // スティックが ゆびの したに くる ように うごかす(ひだり はんぶんの どこを さわっても OK)
    so = { x: e.clientX, y: e.clientY }; stick.style.left = `${e.clientX - r.width / 2}px`; stick.style.bottom = 'auto'; stick.style.top = `${e.clientY - r.height / 2}px`; setStick(0, 0); e.preventDefault();
  });
  pad.addEventListener('pointermove', (e) => { if (e.pointerId !== sid) return; setStick(e.clientX - so.x, e.clientY - so.y); e.preventDefault(); });
  const endStick = (e) => { if (e.pointerId !== sid) return; sid = null; setStick(0, 0); stick.style.left = ''; stick.style.top = ''; stick.style.bottom = ''; };
  pad.addEventListener('pointerup', endStick); pad.addEventListener('pointercancel', endStick);
  const hold = { sprint: 0 };
  const bpress = (b) => { if (b === 'sprint') { sim.input.sprint = true; return; } if (b === 'pass') { const att = S.ph !== 'end' && sim.ball.owner && sim.ball.owner.side === 'a'; sim.press(att ? 'pass' : 'tackle'); return; } if (b === 'lob') { const att = sim.ball.owner && sim.ball.owner.side === 'a'; sim.press(att ? 'lob' : 'switch'); return; } if (b === 'shoot') sim.press('shoot'); };
  const brel = (b) => { if (b === 'sprint') { sim.input.sprint = false; return; } if (b === 'shoot') sim.release('shoot'); };
  root.querySelectorAll('.pb').forEach((btn) => {
    const b = btn.dataset.b;
    btn.addEventListener('pointerdown', (e) => { try { btn.setPointerCapture(e.pointerId); } catch { /* ok */ } btn.classList.add('on'); bpress(b); e.preventDefault(); });
    const up = (e) => { btn.classList.remove('on'); brel(b); e.preventDefault(); };
    btn.addEventListener('pointerup', up); btn.addEventListener('pointercancel', up);
  });
  const keys = new Set();
  const kmap = { KeyJ: 'pass', KeyK: 'shoot', KeyL: 'lob', ShiftLeft: 'sprint', ShiftRight: 'sprint', Space: 'shoot' };
  const recompute = () => { const x = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0); const z = (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0); const m = Math.hypot(x, z) || 1; sim.input.mx = x / m; sim.input.mz = z / m; };
  const kd = (e) => { if (e.repeat) return; if (e.code === 'Escape' || e.code === 'KeyP') { togglePause(); return; } if (kmap[e.code]) { bpress(kmap[e.code]); e.preventDefault(); return; } keys.add(e.code); recompute(); if (e.code.startsWith('Arrow')) e.preventDefault(); };
  const ku = (e) => { if (kmap[e.code]) { brel(kmap[e.code]); return; } keys.delete(e.code); recompute(); };
  window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);

  // ---- ポーズ・たて むき ----------------------------------------------------------
  let paused = false; let dead = false; let portrait = false;
  const menu = root.querySelector('.p3d-menu');
  const setPause = (v) => { paused = v; menu.hidden = !v; menu.querySelector('[data-m=skipintro]').hidden = !(intro && v); };
  const togglePause = () => setPause(!paused);
  root.querySelector('.p3d-pausebtn').addEventListener('click', togglePause);
  const tacts = { attack: 'アタック(たかい ラインで はやく プレス)', balance: 'バランス', counter: 'カウンター(ひくく まもって はやい こうげき)' }; let curTact = o.tactic || 'balance';
  // ボタンの ならびを いれかえ(ダッシュ ↔ パス/タックル)。えらんだ ものは このスマホに おぼえる
  const SWAP_KEY = 'hibiyui.p3d.swap'; let swapped = true; try { const v = localStorage.getItem(SWAP_KEY); if (v !== null) swapped = v === '1'; } catch { /* ok */ }
  const syncSwap = () => { root.classList.toggle('swap', swapped); menu.querySelector('[data-m=swap]').textContent = `🔁 ボタンの ばしょ(${swapped ? 'ダッシュが みぎ' : 'パス・タックルが みぎ'})を いれかえる`; };
  const syncMode = () => { root.classList.toggle('watch', watch); root.querySelector('.p3d-modebtn').textContent = watch ? '🎮 そうさする' : '👀 みる'; menu.querySelector('[data-m=mode]').textContent = watch ? '🎮 じぶんで そうさする' : '👀 かんせんに きりかえる'; menu.querySelectorAll('[data-t]').forEach((b) => b.classList.toggle('on', b.dataset.t === curTact)); };
  const toggleMode = () => { watch = !watch; sim.setAuto(watch); sid = null; syncMode(); };
  root.querySelector('.p3d-modebtn').addEventListener('click', toggleMode);
  menu.addEventListener('click', (e) => { const tb = e.target.closest('[data-t]'); if (tb) { curTact = tb.dataset.t; sim.setTactic(curTact); syncMode(); hud.msg.textContent = `せんじゅつ: ${tacts[curTact]}`; return; } const m = e.target.closest('[data-m]'); if (!m) return; if (m.dataset.m === 'resume') setPause(false); else if (m.dataset.m === 'mode') { toggleMode(); setPause(false); } else if (m.dataset.m === 'swap') { swapped = !swapped; try { localStorage.setItem(SWAP_KEY, swapped ? '1' : '0'); } catch { /* ok */ } syncSwap(); } else if (m.dataset.m === 'skipintro') { endIntro(); setPause(false); } else if (m.dataset.m === 'skip') { skipMatch(); } else { if (o.onQuit) { destroy(); o.onQuit(); } else destroy(); } });
  const resize = () => {
    const w = root.clientWidth || innerWidth; const h = root.clientHeight || innerHeight; renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.fov = w / h < 1.5 ? 48 : 40; camera.updateProjectionMatrix(); portrait = h > w * 1.05; root.classList.toggle('portrait', portrait);
  };
  window.addEventListener('resize', resize); window.addEventListener('orientationchange', resize); resize();
  try { // よこむきに ロック(できる ブラウザだけ)
    if (document.documentElement.requestFullscreen && !document.fullscreenElement && /Mobi|Android/i.test(navigator.userAgent)) { document.documentElement.requestFullscreen().then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {})).catch(() => {}); }
  } catch { /* ok */ }

  // ---- HUD ----------------------------------------------------------------------
  const el = (s) => root.querySelector(s);
  const hud = { stats: el('.p3d-stats'), sa: el('.sa'), sb: el('.sb'), tm: el('.tm'), banner: el('.p3d-banner'), msg: el('.p3d-msg'), ctl: el('.p3d-ctl'), tag: el('.p3d-tag'), bA: el('.pb-a'), bB: el('.pb-b'), bC: el('.pb-c') };
  let hudT = 0; let lastBanner = '';
  function updateHud(dt) {
    hudT -= dt; if (hudT > 0) return; hudT = 0.1;
    hud.sa.textContent = S.score.a; hud.sb.textContent = S.score.b;
    hud.tm.textContent = S.extra ? `延長 ${Math.max(0, Math.ceil(60 - (S.clock - S.e2)))}` : sim.clockText();
    const b = S.bannerT > 0 ? S.banner : ''; if (b !== lastBanner) { lastBanner = b; hud.banner.textContent = b; hud.banner.classList.toggle('on', !!b); }
    hud.msg.textContent = S.msg || '';
    const att = sim.ball.owner && sim.ball.owner.side === 'a';
    hud.bA.textContent = att ? 'パス' : 'タックル'; hud.bB.textContent = att ? 'シュート' : 'スライド'; hud.bC.textContent = att ? 'ロング' : 'きりかえ';
    const cp = sim.ctrlP(); if (cp) { hud.tag.textContent = watch ? '' : cp.name; }
    if (cp && !watch) { const st = cp.stats; const bar = (n, v, c) => `<div><span>${n}</span><i><u style="width:${clamp(v / 140, 0.04, 1) * 100}%;background:${c}"></u></i><b>${Math.round(v)}</b></div>`; hud.stats.innerHTML = `${bar('スピード', st.SPD, '#27d8ff')}${bar('シュート', st.SHO, '#ff4d5e')}${bar('パス', st.PAS, '#ffd23f')}${bar('まもり', st.DEF, '#6fcf97')}${bar('スタミナ', st.STA * clamp(0.35 + cp.stamina * 0.65, 0.2, 1), '#a56de2')}`; } else hud.stats.innerHTML = '';
    const ch = sim.charge; hud.ctl.classList.toggle('on', ch.on && ch.t > 0.05); hud.ctl.querySelector('u').style.width = `${clamp(ch.t / 0.9, 0, 1) * 100}%`;
  }

  // ---- かく ---------------------------------------------------------------------
  const cam = { x: 0, z: 0 }; let cardsShown = 0; const cardMeshes = [];
  function syncScene(dt, t) {
    for (const s of ['a', 'b']) sim.players[s].forEach((p, i) => {
      const m = models[s][i]; const u = m.userData; m.visible = !p.off; if (p.off) return; m.position.set(p.x, 0, p.z); u.inner.rotation.y = -p.dir;
      const sp = Math.hypot(p.vx, p.vz); const sw = Math.sin(p.run * 1.8) * clamp(sp / 5, 0, 1) * 0.9;
      u.legL.rotation.z = sw; u.legR.rotation.z = -sw; u.armL.rotation.z = -sw * 0.8; u.armR.rotation.z = sw * 0.8;
      u.inner.rotation.z = 0; u.inner.position.y = 0; u.inner.rotation.x = 0; u.head.rotation.x = 0;
      if (p.act === 'kick') u.legR.rotation.z = -1.3 * clamp(p.actT / 0.25, 0, 1) + 0.3;
      if (p.act === 'slide' && p.actT > 0) { u.inner.rotation.z = -1.25; u.inner.position.y = 0.22; u.legL.rotation.z = 0.4; u.legR.rotation.z = 0.4; }
      else if (p.stun > 0.05 && p.act !== 'tackle') { u.inner.rotation.z = -1.5 * clamp(p.stun * 4, 0, 1); u.inner.position.y = 0.15; }
      if (p.slot === 'GK' && p.dive && sp > 3) { u.inner.rotation.x = (p.vz > 0 ? 1 : -1) * 1.1; u.armL.rotation.z = u.armR.rotation.z = 2.8; }
      if (S.ph === 'goal' && S.celebrate && S.celebrate.p === p) { m.position.y = Math.abs(Math.sin(t * 7)) * 0.7; u.armL.rotation.z = u.armR.rotation.z = 2.8; }
      if (S.ph === 'goal' && S.celebrate && S.celebrate.side === s && S.celebrate.p !== p) u.armL.rotation.z = u.armR.rotation.z = 2.4 + Math.sin(t * 9 + i) * 0.3;
      if (u.star) { u.star.rotation.y = t * 2; }
      u.shadow.scale.setScalar(1);
    });
    const b = sim.ball; ballM.position.set(b.x, Math.max(0.3 * SC * 0.8, b.y * 1 + 0.3), b.z); ballM.rotation.z -= b.vx * dt * 1.2; ballM.rotation.x += b.vz * dt * 1.2;
    bshadow.position.set(b.x, 0.03, b.z); bshadow.scale.setScalar(clamp(1.1 - b.y * 0.08, 0.4, 1.2));
    const cp = sim.ctrlP(); const cm = models.a[cp.idx];
    ring.visible = arrow.visible = !watch; ring.position.set(cp.x, 0.06, cp.z); ring.rotation.z = t * 2; arrow.position.set(cp.x, 4.4 + Math.sin(t * 5) * 0.25, cp.z); arrow.rotation.y = t * 3;
    void cm;
    // カード(イエロー/レッド)を あたまの うえに ひょうじ
    while (cardsShown < S.cards.length) { const c = S.cards[cardsShown++]; const pl = sim.players[c.side][c.idx]; if (pl) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.3), new THREE.MeshBasicMaterial({ color: c.color === 'red' ? '#e0302a' : '#ffd23f', side: THREE.DoubleSide })); m.position.set(pl.x, 5.0, pl.z); scene.add(m); cardMeshes.push({ m, t: 2.6 }); } }
    for (let i = cardMeshes.length - 1; i >= 0; i--) { const c = cardMeshes[i]; c.t -= dt; c.m.rotation.y += dt * 3; if (c.t <= 0) { scene.remove(c.m); cardMeshes.splice(i, 1); } }
    // カメラ: ボールを みて、せめる むきに すこし さきを みる
    const lead = (sim.ball.owner ? (sim.ball.owner.side === 'a' ? 1 : -1) : Math.sign(sim.ball.vx) || 0) * 6;
    const tx = clamp(b.x * 0.96 + lead, -FIELD.L / 2 + 14, FIELD.L / 2 - 14); const tz = clamp(b.z * 0.5, -14, 14);
    const k = 1 - Math.pow(0.0008, dt); cam.x += (tx - cam.x) * k; cam.z += (tz - cam.z) * k;
    const sh = !o.calm && S.flash > 0 ? (Math.random() - 0.5) * 0.9 * S.flash : 0;
    camera.position.set(cam.x + sh, 29, cam.z + 38); camera.lookAt(cam.x, 0, cam.z - 2);
  }
  let raf = 0; let last = 0; let acc = 0; let tt = 0; let endT = 0; let ended = false;
  function frame(ts) {
    if (dead) return;
    const dt = Math.min(0.05, last ? (ts - last) / 1000 : 0.016); last = ts; tt += dt;
    if (intro) { if (!paused && !portrait) { intro.t += dt; introStep(); } }
    else if (!paused && !portrait) {
      acc += dt; let n = 0; while (acc >= 1 / 60 && n++ < 4) { sim.step(1 / 60); acc -= 1 / 60; }
      while (S.snd.length) { const nm = S.snd.shift(); if (o.onSfx) o.onSfx(nm); }
      if (S.done && !ended) { endT += dt; if (endT > 2.6) { ended = true; finish(); } }
    }
    syncScene(dt, tt); if (intro) introCamera(); updateHud(dt); renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  // ---- オープニング(カメラが スタジアムを まわって、チームしょうかい → 3・2・1 → キックオフ) ----
  const keyman = (t) => t.team.slice().sort((u, v) => (v.stats.SHO + v.stats.PAS + v.stats.SPD + v.stats.DEF) - (u.stats.SHO + u.stats.PAS + u.stats.SPD + u.stats.DEF))[0];
  const powerOf = (t) => Math.round(t.team.reduce((a, m) => a + (m.stats.SHO + m.stats.PAS + m.stats.SPD + m.stats.DEF + m.stats.STA) / 5, 0) / Math.max(1, t.team.length));
  const TACT_NAME = { attack: 'アタック', balance: 'バランス', counter: 'カウンター' };
  let intro = { t: 0, dur: 6.2, whistle: false };
  const iEl = root.querySelector('.p3d-intro');
  root.querySelector('.pi-na').textContent = o.me.name; root.querySelector('.pi-nb').textContent = o.opp.name;
  root.querySelector('.pi-pa').textContent = `パワー ${powerOf(o.me)}`; root.querySelector('.pi-pb').textContent = `パワー ${powerOf(o.opp)}`;
  { const ka = keyman(o.me); const kb = keyman(o.opp); root.querySelector('.pi-ka').textContent = `エース: ${ka.name}`; root.querySelector('.pi-kb').textContent = `エース: ${kb.name}`; }
  root.querySelector('.pi-info').innerHTML = watch ? '👀 かんせんモード ・ とちゅうで 🎮 そうさに かえられるよ' : '🎮 ひだり: うごく ・ みぎ: パス/シュート(おして ためる)/ロング/ダッシュ ・ せんじゅつ: ' + (TACT_NAME[o.tactic || 'balance']);
  root.classList.add('intro');
  const introCount = root.querySelector('.pi-count');
  function introStep() {
    const t = intro.t;
    if (t > 3.4 && t < 6.2) { const n = Math.ceil(6.2 - t); const txt = n >= 3 ? '3' : n === 2 ? '2' : n === 1 ? '1' : ''; if (introCount.textContent !== txt) { introCount.textContent = txt; introCount.classList.remove('pop'); void introCount.offsetWidth; introCount.classList.add('pop'); } }
    if (t >= 5.4 && !intro.whistle) { intro.whistle = true; introCount.textContent = 'キックオフ!'; introCount.classList.remove('pop'); void introCount.offsetWidth; introCount.classList.add('pop'); iEl.classList.add('go'); if (o.onSfx) o.onSfx('whistle'); }
    if (t >= intro.dur) endIntro();
  }
  function endIntro() { if (!intro) return; intro = null; root.classList.remove('intro'); iEl.classList.remove('go'); S.snd.length = 0; hud.msg.textContent = ''; acc = 0; }
  function introCamera() { // ぞらっと うえから ぐるっと まわって、いつもの アングルに おりてくる
    const t = clamp(intro.t / 4.8, 0, 1); const e = t * t * (3 - 2 * t);
    const ang = (1 - e) * 2.3 - 0.0; const rad = 30 + (1 - e) * 70; const h = 29 + (1 - e) * 40;
    const cx = cam.x; const cz = cam.z;
    camera.position.set(cx + Math.sin(ang) * rad * 0.9, h, cz + Math.cos(ang) * rad * 0.62 + 38 * e); camera.lookAt(cx, 0, cz - 1.5 * e);
  }
  iEl.addEventListener('pointerdown', (e) => { endIntro(); e.preventDefault(); });
  function skipMatch() { // しあいを スキップ: のこりを AI で いっきに すすめて けっかへ
    setPause(false); intro = null; root.classList.remove('intro'); sim.setAuto(true); let n = 0; while (!S.done && n++ < 120000) sim.step(1 / 30);
    S.snd.length = 0; ended = true; finish();
  }
  function finish() { const r = { score: { ...S.score }, events: S.events, winner: S.winner, shots: { ...S.shots }, fouls: { ...S.fouls }, offsides: { ...S.offsides }, poss: { ...S.poss }, cards: S.cards, extra: S.extra }; destroy(); if (o.onEnd) o.onEnd(r); }
  function destroy() {
    if (dead) return; dead = true; cancelAnimationFrame(raf);
    window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('resize', resize); window.removeEventListener('orientationchange', resize);
    try { renderer.dispose(); scene.traverse((ob) => { if (ob.geometry) ob.geometry.dispose(); if (ob.material) { (Array.isArray(ob.material) ? ob.material : [ob.material]).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); } }); } catch { /* ok */ }
    root.remove(); document.body.style.overflow = prevOverflow;
    try { if (document.fullscreenElement) document.exitFullscreen(); if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch { /* ok */ }
  }
  syncMode(); syncSwap(); sim.setTactic(curTact);
  raf = requestAnimationFrame(frame);
  return { destroy, sim, pause: () => setPause(true), root, renderer };
}
