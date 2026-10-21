// サッカー 3D の みため: スタジアム(ピッチ・ゴール・ネット・かんきゃくせき・ボード・ライト)・せんしゅ・ボール。ルールには かんけいしない。
import { FIELD } from './playsim.js';

const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };

// ---- テクスチャ ------------------------------------------------------------------
export function grassTexture(THREE) {
  const W = 2048; const H = Math.round(W * (FIELD.W + 10) / (FIELD.L + 14));
  const [c, g] = cv(W, H);
  const sx = W / (FIELD.L + 14); const sz = H / (FIELD.W + 10); const ox = W / 2; const oz = H / 2;
  const X = (x) => ox + x * sx; const Z = (z) => oz + z * sz;
  g.fillStyle = '#2a8a3f'; g.fillRect(0, 0, W, H);
  const stripes = 16;
  for (let i = 0; i < stripes; i++) { g.fillStyle = i % 2 ? '#3aa04c' : '#2c8a3d'; g.fillRect(X(-FIELD.L / 2 - 7 + (i * (FIELD.L + 14)) / stripes), 0, ((FIELD.L + 14) / stripes) * sx + 1, H); }
  // しばの つぶ(ざらざら)
  for (let i = 0; i < 26000; i++) { const x = Math.random() * W; const y = Math.random() * H; g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,40,0,.07)'; g.fillRect(x, y, 2 + Math.random() * 3, 1 + Math.random() * 2); }
  g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = Math.max(4, sx * 0.34); g.lineJoin = 'round'; g.fillStyle = '#fff';
  const L = FIELD.L / 2; const Wd = FIELD.W / 2;
  g.strokeRect(X(-L), Z(-Wd), FIELD.L * sx, FIELD.W * sz);
  g.beginPath(); g.moveTo(X(0), Z(-Wd)); g.lineTo(X(0), Z(Wd)); g.stroke();
  g.beginPath(); g.ellipse(X(0), Z(0), 9.15 * sx, 9.15 * sz, 0, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.ellipse(X(0), Z(0), 0.35 * sx, 0.35 * sz, 0, 0, Math.PI * 2); g.fill();
  for (const s of [-1, 1]) {
    g.strokeRect(s > 0 ? X(L - 16.5) : X(-L), Z(-20.16), 16.5 * sx, 40.32 * sz);
    g.strokeRect(s > 0 ? X(L - 5.5) : X(-L), Z(-9.16), 5.5 * sx, 18.32 * sz);
    g.beginPath(); g.ellipse(X(s * (L - 11)), Z(0), 0.3 * sx, 0.3 * sz, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(X(s * (L - 11)), Z(0), 9.15 * sx, 9.15 * sz, 0, s > 0 ? Math.PI * 0.69 : -Math.PI * 0.31, s > 0 ? Math.PI * 1.31 : Math.PI * 0.31); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c); tex.anisotropy = 8; tex.colorSpace = THREE.SRGBColorSpace; return tex;
}
function crowdTexture(THREE, rep) {
  const [c, g] = cv(512, 128);
  g.fillStyle = '#1a2038'; g.fillRect(0, 0, 512, 128);
  const cols = ['#e8564a', '#f4c542', '#4aa3e8', '#e8e8e8', '#6fcf97', '#a56de2', '#ff9f43', '#2f6df6'];
  for (let y = 3; y < 128; y += 7) for (let x = 0; x < 512; x += 6) {
    const ox = (y % 14 ? 3 : 0); g.fillStyle = cols[Math.floor(Math.random() * cols.length)]; g.fillRect(x + ox, y + 2, 5, 4);
    g.fillStyle = ['#e0b894', '#c68a5e', '#f1d1b0', '#8a5a3c'][Math.floor(Math.random() * 4)]; g.fillRect(x + ox + 1, y - 1, 3, 3);
  }
  const tex = new THREE.CanvasTexture(c); tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(rep, 1); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}
function adTexture(THREE, rep) {
  const [c, g] = cv(1024, 64);
  const items = [['FAIR PLAY', '#e63946'], ['ひびゆいFC', '#1d3557'], ['SOCCER', '#2a9d8f'], ['GO! GO!', '#f4a261'], ['AIR PLAY', '#4361ee'], ['THANKS FOR PLAYING', '#6a4c93']];
  const w = 1024 / items.length;
  items.forEach(([t, col], i) => { g.fillStyle = col; g.fillRect(i * w, 0, w, 64); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(i * w, 0, w, 6); g.fillStyle = '#fff'; g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, i * w + w / 2, 34, w - 16); });
  const tex = new THREE.CanvasTexture(c); tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(rep, 1); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; return tex;
}
function netTexture(THREE, rx, ry) {
  const [c, g] = cv(64, 64); g.clearRect(0, 0, 64, 64); g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 3; g.strokeRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); return t;
}
function skyTexture(THREE) {
  const [c, g] = cv(8, 256); const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#3f86d8'); gr.addColorStop(0.55, '#8fc1f0'); gr.addColorStop(1, '#dff0ff'); g.fillStyle = gr; g.fillRect(0, 0, 8, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function ballTexture(THREE) {
  const [c, g] = cv(256, 128); g.fillStyle = '#fafafa'; g.fillRect(0, 0, 256, 128); g.fillStyle = '#16161e';
  const pent = (x, y, r) => { g.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); g.fill(); };
  for (let i = 0; i < 6; i++) pent(20 + i * 42, 30 + (i % 2) * 8, 13); for (let i = 0; i < 6; i++) pent(40 + i * 42, 96 - (i % 2) * 8, 13); pent(128, 64, 11);
  g.strokeStyle = '#bbb'; g.lineWidth = 2; for (let i = 0; i < 12; i++) { g.beginPath(); g.moveTo(i * 22, 0); g.lineTo(i * 22 + 10, 128); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function shirtTexture(THREE, lk) {
  const [c, g] = cv(128, 128); g.fillStyle = lk.shirt; g.fillRect(0, 0, 128, 128); g.fillStyle = lk.trim; g.globalAlpha = 0.9;
  if (lk.pat === 1) for (let y = 14; y < 128; y += 36) g.fillRect(0, y, 128, 14);
  else if (lk.pat === 2) for (let x = 0; x < 128; x += 32) g.fillRect(x, 0, 14, 128);
  else if (lk.pat === 3) { g.beginPath(); g.moveTo(0, 20); g.lineTo(128, 70); g.lineTo(128, 100); g.lineTo(0, 50); g.fill(); }
  g.globalAlpha = 1; g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, 0, 128, 10);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function numTexture(THREE, n, col) {
  const [c, g] = cv(64, 64); g.font = 'bold 48px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.45)'; g.strokeText(String(n), 32, 34); g.fillStyle = col; g.fillText(String(n), 32, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---- せんしゅ -----------------------------------------------------------------------
export function makePlayerModel(THREE, lk, num, SC) {
  const root = new THREE.Group(); const inner = new THREE.Group(); root.add(inner);
  const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
  const cap = (r, len, c) => new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), lam(c));
  const h = hash(lk.skin + lk.hair + lk.shirt);
  const bootC = ['#17171d', '#f2f2f2', '#ff6b35', '#3ad1ff', '#ffd23f'][h % 5];
  const mkLeg = (z) => {
    const gr = new THREE.Group(); gr.position.set(0, 0.88, z);
    const th = cap(0.1, 0.24, lk.skin); th.position.y = -0.2; const sock = cap(0.088, 0.3, lk.sock); sock.position.y = -0.58;
    const boot = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.2, 4, 8), lam(bootC)); boot.rotation.z = Math.PI / 2; boot.position.set(0.07, -0.86, 0); boot.scale.set(1, 1, 1.15);
    gr.add(th, sock, boot); inner.add(gr); return gr;
  };
  const legL = mkLeg(-0.13); const legR = mkLeg(0.13);
  const shorts = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.22, 0.3, 14), lam(lk.shorts)); shorts.scale.z = 1.45; shorts.position.y = 0.97; inner.add(shorts);
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.58, 14), new THREE.MeshLambertMaterial({ map: shirtTexture(THREE, lk) })); torso.scale.z = 1.5; torso.position.y = 1.33; inner.add(torso);
  const sh = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: lk.shirt })); sh.scale.set(1, 0.5, 1.5); sh.position.y = 1.6; inner.add(sh);
  const numM = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), new THREE.MeshBasicMaterial({ map: numTexture(THREE, num, lk.trim === '#ffffff' ? '#ffffff' : '#fff6d8'), transparent: true, depthWrite: false })); numM.rotation.y = -Math.PI / 2; numM.position.set(-0.205, 1.38, 0); inner.add(numM);
  const mkArm = (z) => {
    const gr = new THREE.Group(); gr.position.set(0, 1.56, z * 1.0);
    const up = cap(0.075, 0.22, lk.shirt); up.position.y = -0.17; const lo = cap(0.062, 0.2, lk.glove ? '#ffd23f' : lk.skin); lo.position.y = -0.45; const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), lam(lk.glove ? '#ffd23f' : lk.skin)); hand.position.y = -0.62;
    gr.add(up, lo, hand); inner.add(gr); return gr;
  };
  const armL = mkArm(-0.36); const armR = mkArm(0.36);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.1, 8), lam(lk.skin)); neck.position.y = 1.66; inner.add(neck);
  const head = new THREE.Group(); head.position.y = 1.84; inner.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 14), lam(lk.skin)); skull.scale.set(0.95, 1.05, 0.95); head.add(skull);
  for (const z of [-0.075, 0.075]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), new THREE.MeshBasicMaterial({ color: '#15151c' })); eye.position.set(0.185, 0.02, z); head.add(eye); }
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.014, 0.07), new THREE.MeshBasicMaterial({ color: '#9a4a3a' })); mouth.position.set(0.19, -0.07, 0); head.add(mouth);
  const ear = (z) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), lam(lk.skin)); e.position.set(0, 0, z); head.add(e); }; ear(-0.19); ear(0.19);
  const hairM = lam(lk.hair); const st = lk.style % 6;
  const cap0 = new THREE.Mesh(new THREE.SphereGeometry(0.215, 18, 10, 0, Math.PI * 2, 0, Math.PI * (st === 5 ? 0.38 : 0.52)), hairM); cap0.scale.set(1, 1.05, 1); cap0.rotation.z = 0.12; cap0.position.y = 0.01; head.add(cap0);
  if (st === 1) for (let i = 0; i < 7; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.15, 5), hairM); const a = (i / 7) * Math.PI * 2; sp.position.set(Math.cos(a) * 0.1, 0.2, Math.sin(a) * 0.1); sp.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); head.add(sp); }
  if (st === 2) { const lg = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.25, 4, 8), hairM); lg.position.set(-0.13, -0.08, 0); lg.scale.set(0.8, 1, 1.5); head.add(lg); }
  if (st === 3) { const af = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 10), hairM); af.position.set(-0.03, 0.07, 0); af.scale.set(0.95, 0.9, 1); head.add(af); }
  if (st === 4) { const hb = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 6, 16), new THREE.MeshBasicMaterial({ color: lk.trim })); hb.rotation.x = Math.PI / 2; hb.position.y = 0.07; head.add(hb); }
  if (lk.star) { const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), new THREE.MeshBasicMaterial({ color: lk.star === 'kid' ? '#ffd23f' : lk.star === 'legend' ? '#ff9f1c' : lk.star === 'diamond' ? '#9ff3ff' : '#9be7ff' })); star.position.y = 2.4; inner.add(star); root.userData.star = star; }
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; root.add(shadow);
  root.traverse((o) => { if (o.isMesh && o !== shadow) o.castShadow = true; });
  root.scale.setScalar(SC);
  root.userData = { ...root.userData, inner, legL, legR, armL, armR, head, shadow };
  return root;
}
export function makeBall(THREE, r) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), new THREE.MeshLambertMaterial({ map: ballTexture(THREE), emissive: '#222222' })); m.castShadow = true; return m;
}

// ---- スタジアム ------------------------------------------------------------------------
export function buildStadium(THREE, scene, opts = {}) {
  const L = FIELD.L; const W = FIELD.W; const shadows = opts.shadows !== false;
  scene.background = skyTexture(THREE); scene.fog = new THREE.Fog('#bcd9f2', 130, 300);
  scene.add(new THREE.HemisphereLight(0xeaf3ff, 0x3a6a3a, 0.95));
  const sun = new THREE.DirectionalLight(0xfff3dc, 1.15); sun.position.set(-30, 60, 25); sun.target.position.set(0, 0, 0); scene.add(sun, sun.target);
  if (shadows) { sun.castShadow = true; sun.shadow.mapSize.set(opts.mobile ? 1024 : 2048, opts.mobile ? 1024 : 2048); const sc = sun.shadow.camera; sc.left = -40; sc.right = 40; sc.top = 32; sc.bottom = -32; sc.near = 10; sc.far = 160; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04; }
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(L + 14, W + 10), new THREE.MeshLambertMaterial({ map: grassTexture(THREE) })); pitch.rotation.x = -Math.PI / 2; pitch.receiveShadow = true; scene.add(pitch);
  const out = new THREE.Mesh(new THREE.PlaneGeometry(500, 400), new THREE.MeshLambertMaterial({ color: '#2d6a3a' })); out.rotation.x = -Math.PI / 2; out.position.y = -0.05; scene.add(out);
  // ゴール
  const post = new THREE.MeshLambertMaterial({ color: '#ffffff' });
  for (const s of [-1, 1]) {
    const gx = s * L / 2; const hw = FIELD.GW / 2; const gh = FIELD.GH; const dep = 2.3;
    for (const z of [-hw, hw]) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, gh, 10), post); m.position.set(gx, gh / 2, z); m.castShadow = true; scene.add(m); }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, FIELD.GW, 10), post); bar.rotation.x = Math.PI / 2; bar.position.set(gx, gh, 0); scene.add(bar);
    for (const z of [-hw, hw]) { const back = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, dep + 0.3, 6), post); back.rotation.z = Math.PI / 2; back.position.set(gx + s * dep / 2, gh, z); scene.add(back); const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, gh, 6), post); leg.position.set(gx + s * dep, gh / 2, z); scene.add(leg); }
    const nm = (tx, ty) => new THREE.MeshBasicMaterial({ map: netTexture(THREE, tx, ty), transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(FIELD.GW, gh), nm(FIELD.GW * 2, gh * 2)); back.rotation.y = Math.PI / 2; back.position.set(gx + s * dep, gh / 2, 0); scene.add(back);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(dep, FIELD.GW), nm(dep * 2, FIELD.GW * 2)); top.rotation.set(-Math.PI / 2, 0, Math.PI / 2); top.position.set(gx + s * dep / 2, gh, 0); scene.add(top);
    for (const z of [-hw, hw]) { const sd = new THREE.Mesh(new THREE.PlaneGeometry(dep, gh), nm(dep * 2, gh * 2)); sd.position.set(gx + s * dep / 2, gh / 2, z); scene.add(sd); }
  }
  // ボード(こうこく)
  const adLong = new THREE.MeshLambertMaterial({ map: adTexture(THREE, 5) }); const adShort = new THREE.MeshLambertMaterial({ map: adTexture(THREE, 2) });
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(L + 12, 1.6, 0.3), adLong); m.position.set(0, 0.8, s * (W / 2 + 2.8)); scene.add(m);
    for (const e of [-1, 1]) { const mm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.6, (W + 7) / 2 - 6), adShort); mm.position.set(e * (L / 2 + 6.2), 0.8, s * ((W + 7) / 4 + 3)); scene.add(mm); }
  }
  // かんきゃくせき(だんだん)
  const crowdL = new THREE.MeshBasicMaterial({ map: crowdTexture(THREE, 8) }); const crowdS = new THREE.MeshBasicMaterial({ map: crowdTexture(THREE, 5) });
  const concrete = new THREE.MeshLambertMaterial({ color: '#59607a' });
  const tiers = (len, cx, cz, rot, mat) => {
    const g = new THREE.Group();
    for (let i = 0; i < 5; i++) { const hh = 1.6 + i * 1.5; const step = new THREE.Mesh(new THREE.BoxGeometry(len, hh, 2.2), [concrete, concrete, concrete, concrete, mat, concrete]); step.position.set(0, hh / 2, -i * 2.2); g.add(step); }
    g.position.set(cx, 0, cz); g.rotation.y = rot; scene.add(g);
  };
  tiers(L + 40, 0, -W / 2 - 9, 0, crowdL); tiers(L + 40, 0, W / 2 + 9, Math.PI, crowdL);
  tiers(W + 24, -L / 2 - 13, 0, Math.PI / 2, crowdS); tiers(W + 24, L / 2 + 13, 0, -Math.PI / 2, crowdS);
  // ライト(とう)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const px = sx * (L / 2 + 20); const pz = sz * (W / 2 + 18); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 36, 8), new THREE.MeshLambertMaterial({ color: '#8d94a8' })); pole.position.set(px, 18, pz); scene.add(pole);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(7, 3.5, 1), new THREE.MeshBasicMaterial({ color: '#fffbe8' })); lamp.position.set(px, 37, pz); lamp.lookAt(0, 20, 0); scene.add(lamp);
  }
  // くも
  const cm = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.75, fog: false });
  for (let i = 0; i < 8; i++) { const c = new THREE.Mesh(new THREE.SphereGeometry(12 + (i % 3) * 5, 8, 6), cm); c.scale.set(2.4, 0.5, 1.2); c.position.set(-160 + i * 46, 85 + (i % 3) * 12, -140 - (i % 2) * 40); scene.add(c); }
  return { sun, follow(x, z) { sun.position.set(x - 30, 60, z + 25); sun.target.position.set(x, 0, z); } };
}
