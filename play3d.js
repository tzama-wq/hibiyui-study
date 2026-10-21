// じぶんで うごかす しあい(3D)。three.js で かく + タッチ そうさ(よこむき) + HUD。ルールは playsim.js。
//   const g = await startPlay3D({ me, opp, halfSec, level, calm, onSfx, onEnd, onQuit });  g.destroy()
import { createPlay, FIELD } from './playsim.js';
import { hostBindPlay, createGuestPlay } from './playnet.js';
import { look } from './match.js';
import { buildStadium, makePlayerModel, makeBall } from './stadium3d.js';

let T = null;
async function loadThree() { if (!T) T = await import('./vendor/three.module.min.js'); return T; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const SC = 1.55; // えを みやすくする ために せんしゅ・ボールを すこし おおきく する(あそびやすさ ゆうせん)

const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

// ---- メイン ----------------------------------------------------------------------
let ACTIVE = null; // いま うごいている しあい(ひとつだけ。ダブルタップで ふたつ はじまって、みえない ほうの けっかが つかわれるのを ふせぐ)
export async function startPlay3D(o) {
  const THREE = await loadThree();
  if (ACTIVE) { try { ACTIVE.destroy(); } catch { /* ok */ } ACTIVE = null; }
  document.querySelectorAll('.p3d').forEach((e) => e.remove());
  let watch = o.mode === 'watch';
  // ふたりで あそぶ(ローカル つうしん): net = { role: 'host'|'guest', conn, mode: 'versus'|'coop' }
  const net = o.net || null; const netMode = net ? net.mode : 'solo'; let hb = null; let sim;
  const mySide = net && net.role === 'guest' && netMode === 'versus' ? 'b' : 'a'; const flip = mySide === 'b'; // あいてがわの ひとは カメラを はんたいから
  if (net && net.role === 'guest') sim = createGuestPlay({ conn: net.conn, me: o.me, opp: o.opp, mode: netMode, halfSec: o.halfSec || 90, mySide, ci: 1 });
  else { sim = createPlay({ me: o.me, opp: o.opp, halfSec: o.halfSec || 90, level: o.level || 1, tactic: o.tactic || 'balance', auto: watch, diff: net && netMode === 'versus' ? 'hard' : (o.diff || 'easy'), mode: netMode }); if (net) hb = hostBindPlay(sim, net.conn); }
  if (net) watch = false;
  const S = sim.state;
  const root = document.createElement('div'); root.className = 'p3d';
  root.innerHTML = `<canvas class="p3d-cv"></canvas>
    <div class="p3d-hud"><div class="p3d-score"><span class="ta">${esc(o.me.name)}</span><b class="sa">0</b><i class="tm">0:00</i><b class="sb">0</b><span class="tb">${esc(o.opp.name)}</span></div>
      <button class="p3d-modebtn" aria-label="かんせん/そうさ"></button><button class="p3d-pausebtn" aria-label="ポーズ">⏸</button><div class="p3d-stats"></div><div class="p3d-banner"></div><div class="p3d-msg"></div><div class="p3d-ctl"><b></b><i><u></u></i></div><div class="p3d-flick"></div><div class="p3d-tag"></div></div>
    <div class="p3d-pad"><div class="p3d-stick"><div class="p3d-knob"></div></div>
      <div class="p3d-btns"><button class="pb pb-d" data-b="sprint">ダッシュ</button><button class="pb pb-c" data-b="lob">ロング</button><button class="pb pb-a" data-b="pass">パス</button><button class="pb pb-b" data-b="shoot">シュート</button></div></div>
    <div class="p3d-intro"><div class="pi-vs"><div class="pi-team a"><small>HOME</small><b class="pi-na"></b><span class="pi-pa"></span><em class="pi-ka"></em></div><i>VS</i><div class="pi-team b"><small>AWAY</small><b class="pi-nb"></b><span class="pi-pb"></span><em class="pi-kb"></em></div></div><div class="pi-info"></div><div class="pi-count"></div><div class="pi-skip">タップで スキップ ▶</div></div>
    <div class="p3d-rot"><div>📱↔<br>よこむきに して あそんでね</div></div>
    <div class="p3d-menu" hidden><div class="p3d-menubox"><b>ポーズ</b><button class="btn gold" data-m="resume">▶ つづける</button><button class="btn" data-m="skipintro" hidden>⏭ オープニングを とばす</button><button class="btn" data-m="skip">⏭ しあいを スキップ(いまの スコアで けっか。どうてんなら のこりを じどうで)</button><button class="btn" data-m="mode"></button><button class="btn" data-m="swap"></button><div class="p3d-tactics"><small>せんじゅつ</small><button class="chipb" data-t="attack">アタック</button><button class="chipb" data-t="balance">バランス</button><button class="chipb" data-t="counter">カウンター</button></div><button class="btn gray" data-m="quit">しあいを やめる</button></div></div>`;
  (o.root || document.body).appendChild(root);
  const prevOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; // うしろの がめんが うごかない ように
  const cv = root.querySelector('.p3d-cv');
  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, o.calm ? 1.25 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const mobile = /Mobi|Android/i.test(navigator.userAgent); const shadowsOn = !o.calm;
  if (shadowsOn) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; }
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.5, 500);
  const stadium = buildStadium(THREE, scene, { shadows: shadowsOn, mobile });
  // せんしゅ
  const models = { a: [], b: [] };
  for (const s of ['a', 'b']) sim.players[s].forEach((p) => { const lk = look(p.m, s, s === 'a' ? o.me.name : o.opp.name); const m = makePlayerModel(THREE, lk, p.idx + 1, SC); scene.add(m); models[s].push(m); });
  // ボール
  const ballM = makeBall(THREE, 0.3 * SC * 0.8); scene.add(ballM);
  const bshadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 12), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.4, depthWrite: false })); bshadow.rotation.x = -Math.PI / 2; bshadow.position.y = 0.03; scene.add(bshadow);
  // じぶんの せんしゅの めじるし
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.7, 2.45, 36), new THREE.MeshBasicMaterial({ color: '#ffd23f', side: THREE.DoubleSide, transparent: true, opacity: 0.95, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; scene.add(ring);
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.95, 1.9, 4), new THREE.MeshBasicMaterial({ color: '#ffd23f' })); arrow.rotation.x = Math.PI; scene.add(arrow);
  const ring2 = new THREE.Mesh(new THREE.RingGeometry(2.6, 2.95, 36), new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide, transparent: true, opacity: 0.7, depthWrite: false })); ring2.rotation.x = -Math.PI / 2; ring2.position.y = 0.07; scene.add(ring2);

  // ---- そうさ(ジョイスティック・ボタン・キーボード) ---------------------------------
  const stick = root.querySelector('.p3d-stick'); const knob = root.querySelector('.p3d-knob'); let sid = null; let so = { x: 0, y: 0 }; const R = 56;
  const setStick = (dx, dy) => { const m = Math.hypot(dx, dy); const k = m > R ? R / m : 1; const x = dx * k; const y = dy * k; knob.style.transform = `translate(${x}px,${y}px)`; const vx = x / R; const vy = y / R; const mm = Math.hypot(vx, vy); if (mm < 0.14) { sim.input.mx = 0; sim.input.mz = 0; } else { sim.input.mx = flip ? -vx : vx; sim.input.mz = flip ? -vy : vy; } };
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
  const bpress = (b) => { if (b === 'sprint') { sim.input.sprint = true; return; } if (b === 'pass') { const att = S.ph !== 'end' && sim.ball.owner && sim.ball.owner.side === mySide; passWasAtk = !!att; sim.press(att ? 'pass' : 'tackle'); return; } if (b === 'lob') { const att = sim.ball.owner && sim.ball.owner.side === mySide; sim.press(att ? 'lob' : 'switch'); return; } if (b === 'shoot') sim.press('shoot'); };
  const brel = (b) => { if (b === 'sprint') { sim.input.sprint = false; return; } if (b === 'shoot') sim.release('shoot'); if (b === 'pass' && passWasAtk) sim.release('pass'); };
  let passWasAtk = false;
  // パスボタン: おしている あいだ ためる(つよさ)・ボタンから フリックで ほうこうと つよさを きめる
  const flickEl = root.querySelector('.p3d-flick'); let fl = null;
  const passAtk = () => sim.ball.owner && sim.ball.owner.side === mySide && sim.ball.owner === sim.ctrlP();
  root.querySelectorAll('.pb').forEach((btn) => {
    const b = btn.dataset.b;
    btn.addEventListener('pointerdown', (e) => { try { btn.setPointerCapture(e.pointerId); } catch { /* ok */ } btn.classList.add('on'); if (b === 'pass') fl = { x: e.clientX, y: e.clientY, atk: passAtk(), moved: false }; bpress(b); e.preventDefault(); });
    btn.addEventListener('pointermove', (e) => {
      if (b !== 'pass' || !fl || !fl.atk) return; const dx = e.clientX - fl.x; const dy = e.clientY - fl.y; const m = Math.hypot(dx, dy);
      if (m > 22) { fl.moved = true; const rect = root.getBoundingClientRect(); flickEl.style.display = 'block'; flickEl.style.left = `${fl.x - rect.left}px`; flickEl.style.top = `${fl.y - rect.top}px`; flickEl.style.width = `${Math.min(m, 150)}px`; flickEl.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`; }
    });
    const up = (e) => {
      btn.classList.remove('on');
      if (b === 'pass' && fl) { const dx = e.clientX - fl.x; const dy = e.clientY - fl.y; const m = Math.hypot(dx, dy); flickEl.style.display = 'none'; const f = fl; fl = null;
        if (f.atk && m > 22) { sim.flickPass(flip ? -dx / m : dx / m, flip ? -dy / m : dy / m, clamp((m - 20) / 110, 0.05, 1)); e.preventDefault(); return; } }
      brel(b); e.preventDefault();
    };
    btn.addEventListener('pointerup', up); btn.addEventListener('pointercancel', (e) => { flickEl.style.display = 'none'; fl = null; up(e); });
  });
  const keys = new Set();
  const kmap = { KeyJ: 'pass', KeyK: 'shoot', KeyL: 'lob', ShiftLeft: 'sprint', ShiftRight: 'sprint', Space: 'shoot' };
  const recompute = () => { const x = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0); const z = (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0); const m = Math.hypot(x, z) || 1; sim.input.mx = (flip ? -x : x) / m; sim.input.mz = (flip ? -z : z) / m; };
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
    const att = sim.ball.owner && sim.ball.owner.side === mySide;
    hud.bA.textContent = att ? 'パス' : 'タックル'; hud.bB.textContent = att ? 'シュート' : 'スライド'; hud.bC.textContent = att ? 'ロング' : 'きりかえ';
    const cp = sim.ctrlP(); if (cp) { hud.tag.textContent = watch ? '' : cp.name; }
    if (cp && !watch) { const st = cp.stats; const bar = (n, v, c) => `<div><span>${n}</span><i><u style="width:${clamp(v / 140, 0.04, 1) * 100}%;background:${c}"></u></i><b>${Math.round(v)}</b></div>`; hud.stats.innerHTML = `${bar('スピード', st.SPD, '#27d8ff')}${bar('シュート', st.SHO, '#ff4d5e')}${bar('パス', st.PAS, '#ffd23f')}${bar('まもり', st.DEF, '#6fcf97')}${bar('スタミナ', st.STA * clamp(0.35 + cp.stamina * 0.65, 0.2, 1), '#a56de2')}`; } else hud.stats.innerHTML = '';
    const ch = sim.charge; const pc = sim.passCharge; const onS = ch.on && ch.t > 0.05; const onP = pc.on && pc.t > 0.08; hud.ctl.classList.toggle('on', onS || onP); hud.ctl.classList.toggle('pass', !onS && onP);
    hud.ctl.querySelector('b').textContent = onS ? 'シュート' : onP ? 'パス' : ''; hud.ctl.querySelector('u').style.width = `${clamp((onS ? ch.t / 0.9 : pc.t / 0.8), 0, 1) * 100}%`;
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
    const cp = sim.ctrlP(); const cm = models[mySide][cp.idx];
    ring.visible = arrow.visible = ring2.visible = !watch; ring.position.set(cp.x, 0.06, cp.z); ring.rotation.z = t * 2; ring2.position.set(cp.x, 0.07, cp.z); ring2.scale.setScalar(1 + Math.sin(t * 5) * 0.08); arrow.position.set(cp.x, 6.0 + Math.sin(t * 5) * 0.4, cp.z); arrow.rotation.y = t * 3;
    void cm;
    // カード(イエロー/レッド)を あたまの うえに ひょうじ
    while (cardsShown < S.cards.length) { const c = S.cards[cardsShown++]; const pl = sim.players[c.side][c.idx]; if (pl) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.3), new THREE.MeshBasicMaterial({ color: c.color === 'red' ? '#e0302a' : '#ffd23f', side: THREE.DoubleSide })); m.position.set(pl.x, 5.0, pl.z); scene.add(m); cardMeshes.push({ m, t: 2.6 }); } }
    for (let i = cardMeshes.length - 1; i >= 0; i--) { const c = cardMeshes[i]; c.t -= dt; c.m.rotation.y += dt * 3; if (c.t <= 0) { scene.remove(c.m); cardMeshes.splice(i, 1); } }
    // カメラ: ボールを みて、せめる むきに すこし さきを みる
    const lead = (sim.ball.owner ? (sim.ball.owner.side === 'a' ? 1 : -1) : Math.sign(sim.ball.vx) || 0) * 6;
    const tx = clamp(b.x * 0.96 + lead, -FIELD.L / 2 + 14, FIELD.L / 2 - 14); const tz = clamp(b.z * 0.5, -14, 14);
    const k = 1 - Math.pow(0.0008, dt); cam.x += (tx - cam.x) * k; cam.z += (tz - cam.z) * k;
    stadium.follow(cam.x, cam.z);
    const sh = !o.calm && S.flash > 0 ? (Math.random() - 0.5) * 0.9 * S.flash : 0;
    if (flip) { camera.position.set(-cam.x + sh, 22, -cam.z - 29); camera.lookAt(-cam.x, 0, -cam.z + 2); } else { camera.position.set(cam.x + sh, 22, cam.z + 29); camera.lookAt(cam.x, 0, cam.z - 2); }
  }
  let raf = 0; let last = 0; let acc = 0; let tt = 0; let endT = 0; let ended = false; let lostMsg = false;
  function frame(ts) {
    if (dead) return;
    const dt = Math.min(0.05, last ? (ts - last) / 1000 : 0.016); last = ts; tt += dt;
    if (intro) { if (!paused && !portrait) { intro.t += dt; introStep(); } }
    else if ((!paused || net) && !portrait) {
      acc += dt; let n = 0; while (acc >= 1 / 60 && n++ < 4) { sim.step(1 / 60); if (hb) hb.tick(1 / 60); acc -= 1 / 60; }
      while (S.snd.length) { const nm = S.snd.shift(); if (hb) hb.snd.push(nm); if (o.onSfx) o.onSfx(nm); }
      if (net && !S.done && !lostMsg && ((hb && hb.gone()) || (sim.remote && sim.lost()))) { lostMsg = true; S.done = true; S.lostLink = true; hud.msg.textContent = '📡 つうしんが きれたよ'; }
      if (S.done && !ended) { endT += dt; if (endT > 2.6) { ended = true; finish(); } }
    }
    syncScene(dt, tt); if (intro) introCamera(); updateHud(dt); renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  // ---- オープニング(カメラが スタジアムを まわって、チームしょうかい → 3・2・1 → キックオフ) ----
  const keyman = (t) => t.team.slice().sort((u, v) => (v.stats.SHO + v.stats.PAS + v.stats.SPD + v.stats.DEF) - (u.stats.SHO + u.stats.PAS + u.stats.SPD + u.stats.DEF))[0];
  const powerOf = (t) => Math.round(t.team.reduce((a, m) => a + (m.stats.SHO + m.stats.PAS + m.stats.SPD + m.stats.DEF + m.stats.STA) / 5, 0) / Math.max(1, t.team.length));
  const TACT_NAME = { attack: 'アタック', balance: 'バランス', counter: 'カウンター' };
  let intro = net ? null : { t: 0, dur: 6.2, whistle: false };
  const iEl = root.querySelector('.p3d-intro');
  root.querySelector('.pi-na').textContent = o.me.name; root.querySelector('.pi-nb').textContent = o.opp.name;
  root.querySelector('.pi-pa').textContent = `パワー ${powerOf(o.me)}`; root.querySelector('.pi-pb').textContent = `パワー ${powerOf(o.opp)}`;
  { const ka = keyman(o.me); const kb = keyman(o.opp); root.querySelector('.pi-ka').textContent = `エース: ${ka.name}`; root.querySelector('.pi-kb').textContent = `エース: ${kb.name}`; }
  root.querySelector('.pi-info').innerHTML = watch ? '👀 かんせんモード ・ とちゅうで 🎮 そうさに かえられるよ' : '🎮 ひだり: うごく ・ みぎ: パス/シュート(おして ためる)/ロング/ダッシュ ・ せんじゅつ: ' + (TACT_NAME[o.tactic || 'balance']);
  if (intro) root.classList.add('intro');
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
    setPause(false); intro = null; root.classList.remove('intro');
    if (S.score.a !== S.score.b) sim.endNow(); // かって いる(まけて いる)ときは いまの スコアで けっかへ
    else { sim.setAuto(true); let n = 0; while (!S.done && n++ < 120000) sim.step(1 / 30); } // どうてんの ときは のこりを じどうで(のびたら ゴールデンゴール・PK戦)
    S.snd.length = 0; ended = true; finish();
  }
  function finish() { if (dead) return; const r = { score: { ...S.score }, events: S.events, winner: S.winner, shots: { ...S.shots }, fouls: { ...S.fouls }, offsides: { ...S.offsides }, poss: { ...S.poss }, cards: S.cards, extra: S.extra, net: net ? { mode: netMode, mySide, lostLink: !!S.lostLink } : null }; destroy(); if (o.onEnd) o.onEnd(r); }
  function destroy() {
    if (dead) return; dead = true; if (hb) hb.finish(); if (net && net.conn) setTimeout(() => { try { net.conn.close(); } catch { /* ok */ } }, 400); cancelAnimationFrame(raf);
    window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('resize', resize); window.removeEventListener('orientationchange', resize);
    try { renderer.dispose(); scene.traverse((ob) => { if (ob.geometry) ob.geometry.dispose(); if (ob.material) { (Array.isArray(ob.material) ? ob.material : [ob.material]).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); } }); } catch { /* ok */ }
    root.remove(); document.body.style.overflow = prevOverflow;
    try { if (document.fullscreenElement) document.exitFullscreen(); if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch { /* ok */ }
  }
  if (net) { root.classList.add('net'); } // ポーズでも ゲームは とまらない・スキップ/かんせんは なし
  syncMode(); syncSwap(); sim.setTactic(curTact);
  raf = requestAnimationFrame(frame);
  const api = { destroy: () => { if (ACTIVE === api) ACTIVE = null; destroy(); }, sim, pause: () => setPause(true), root, renderer, scene, camera };
  ACTIVE = api;
  return api;
}
