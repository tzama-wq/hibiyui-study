// 地球防衛隊「シティ」の モデル: くるま・バイク・ひこうき・ひと・はんにん(three.js)。ぜんぶ まえ = +Z。
//   makeCarModel(THREE, model, color) / makeBikeModel(THREE, model) / makeAirModel(THREE, model) / makePerson(THREE, opts) / labelSprite(THREE, text, sub, color)
const M = (THREE, c, o = {}) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.5, roughness: 0.4, ...o });
const B = (THREE, w, h, d, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; };
const glass = (THREE) => new THREE.MeshStandardMaterial({ color: '#1d2f4a', metalness: 0.9, roughness: 0.06 });
const lit = (THREE, c) => new THREE.MeshBasicMaterial({ color: c });
const castAll = (g) => { g.traverse((m) => { if (m.isMesh) m.castShadow = true; }); return g; };

// よこから みた かたちを ほそながく のばす(shape x = まえうしろ(z), y = たかさ)
function profile(THREE, pts, width, mat, bevel = 0.06) {
  const sh = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y))); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: width - bevel * 2, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, steps: 1 });
  geo.translate(0, 0, -(width - bevel * 2) / 2); geo.rotateY(-Math.PI / 2); return new THREE.Mesh(geo, mat);
}
function wheel(THREE, r, w, x, y, z) {
  const g = new THREE.Group(); const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 20), M(THREE, '#15171c', { metalness: 0.1, roughness: 0.9 })); t.rotation.z = Math.PI / 2;
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.62, r * 0.62, w + 0.02, 12), M(THREE, '#cfd5df', { metalness: 0.9, roughness: 0.25 })); rim.rotation.z = Math.PI / 2; g.add(t, rim); g.position.set(x, y, z); return g;
}

const CARS = {
  sedan: { L: 4.6, W: 1.9, bh: 0.95, ch: 0.55, cz: [-1.7, 0.95], wr: 0.36, color: '#3b6fd0' },
  police: { L: 4.7, W: 1.95, bh: 0.95, ch: 0.55, cz: [-1.7, 1.0], wr: 0.37, color: '#f4f6fa' },
  taxi: { L: 4.6, W: 1.9, bh: 0.95, ch: 0.55, cz: [-1.7, 0.95], wr: 0.36, color: '#f2b705' },
  suv: { L: 4.8, W: 2.05, bh: 1.2, ch: 0.7, cz: [-2.2, 1.1], wr: 0.46, color: '#2f5a3a' },
  truck: { L: 6.6, W: 2.2, bh: 1.2, ch: 0.9, cz: [1.0, 2.55], wr: 0.5, color: '#c93a2a' },
  sports: { L: 4.4, W: 1.95, bh: 0.72, ch: 0.42, cz: [-1.15, 0.7], wr: 0.36, color: '#d11f2e' },
  super: { L: 4.6, W: 2.1, bh: 0.62, ch: 0.38, cz: [-0.9, 0.75], wr: 0.38, color: '#c6e000' },
};
export function makeCarModel(THREE, model = 'sedan', color) {
  const s = CARS[model] || CARS.sedan; const g = new THREE.Group(); const col = color || s.color; const body = M(THREE, col, { metalness: 0.6, roughness: 0.3 }); const L = s.L; const W = s.W;
  const low = model === 'sports' || model === 'super';
  const pts = low
    ? [[-L / 2, 0.3], [-L / 2, s.bh * 0.95], [-L / 2 + 0.5, s.bh + 0.05], [L / 2 - 1.9, s.bh + 0.05], [L / 2 - 0.5, s.bh - 0.05], [L / 2, s.bh - 0.3], [L / 2, 0.3]]
    : [[-L / 2, 0.3], [-L / 2, s.bh * 0.95], [-L / 2 + 0.4, s.bh], [L / 2 - 1.4, s.bh], [L / 2 - 0.15, s.bh - 0.18], [L / 2, s.bh - 0.32], [L / 2, 0.3]];
  g.add(profile(THREE, pts, W, body));
  const [c0, c1] = s.cz; const gl = glass(THREE);
  const cab = profile(THREE, [[c0, s.bh], [c0 + (low ? 0.7 : 0.45), s.bh + s.ch], [c1 - (low ? 1.0 : 0.75), s.bh + s.ch], [c1, s.bh]], W * 0.9, gl, 0.03); g.add(cab);
  g.add(B(THREE, W * 0.86, 0.06, c1 - c0 - (low ? 1.7 : 1.2), body, 0, s.bh + s.ch + 0.04, (c0 + c1) / 2 - (low ? 0.15 : 0.1)));
  const wz = L / 2 - (model === 'truck' ? 0.95 : 0.9);
  for (const [x, z] of [[-1, wz], [1, wz], [-1, -wz], [1, -wz]]) g.add(wheel(THREE, s.wr, 0.34, x * (W / 2 - 0.12), s.wr, z));
  if (model === 'truck') { g.add(B(THREE, W * 0.98, 1.8, 4.0, M(THREE, '#e9edf3', { metalness: 0.2, roughness: 0.6 }), 0, 2.1, -1.55)); g.add(B(THREE, W, 0.22, 4.2, M(THREE, '#2b2f38'), 0, 1.05, -1.55)); for (const x of [-1, 1]) g.add(wheel(THREE, s.wr, 0.34, x * (W / 2 - 0.12), s.wr, -L / 2 + 0.7));
  }
  for (const x of [-0.7, 0.7]) { g.add(B(THREE, 0.5, 0.2, 0.08, lit(THREE, '#fff7c0'), x * (W / 2 - 0.35) / 0.7, s.bh - 0.18, L / 2 + 0.02)); g.add(B(THREE, 0.5, 0.2, 0.08, lit(THREE, '#ff2a2a'), x * (W / 2 - 0.35) / 0.7, s.bh - 0.12, -L / 2 - 0.02)); }
  g.add(B(THREE, W * 0.7, 0.18, 0.08, M(THREE, '#22252b', { metalness: 0.3 }), 0, 0.5, L / 2 + 0.02)); // グリル
  if (model === 'police') { g.add(B(THREE, W * 1.0, 0.28, 1.5, M(THREE, '#10131a'), 0, 0.55, 0.0)); g.add(B(THREE, 0.9, 0.12, 0.35, M(THREE, '#10131a'), 0, s.bh + s.ch + 0.12, 0)); const b = B(THREE, 0.5, 0.16, 0.34, lit(THREE, '#3a6dff'), -0.28, s.bh + s.ch + 0.2, 0); const r = B(THREE, 0.5, 0.16, 0.34, lit(THREE, '#ff3a3a'), 0.28, s.bh + s.ch + 0.2, 0); g.add(b, r); g.userData.siren = [b, r]; }
  if (model === 'taxi') { g.add(B(THREE, 0.9, 0.22, 0.3, lit(THREE, '#fff3b0'), 0, s.bh + s.ch + 0.2, 0)); g.add(B(THREE, W * 1.0, 0.1, 3.0, M(THREE, '#10131a'), 0, 0.8, 0)); }
  if (model === 'sports' || model === 'super') { g.add(B(THREE, W * 0.9, 0.07, 0.5, M(THREE, '#101216'), 0, s.bh + 0.42, -L / 2 + 0.2)); for (const x of [-0.7, 0.7]) g.add(B(THREE, 0.07, 0.4, 0.4, M(THREE, '#101216'), x, s.bh + 0.22, -L / 2 + 0.2)); }
  if (model === 'super') { for (const x of [-1, 1]) g.add(B(THREE, 0.06, 0.18, 1.2, M(THREE, '#101216'), x * (W / 2 + 0.01), 0.6, -0.3)); }
  if (model === 'suv') { g.add(B(THREE, 1.7, 0.08, 1.9, M(THREE, '#2a2d34'), 0, s.bh + s.ch + 0.12, -0.6)); g.add(B(THREE, 0.5, 0.4, 0.3, M(THREE, '#1a1c20'), 0, 1.25, -L / 2 - 0.15)); }
  return castAll(g);
}

const BIKES = {
  scooter: { color: '#27b7a6', len: 1.6, big: 0 },
  bike: { color: '#d11f2e', len: 2.0, big: 1 },
  pbike: { color: '#f4f6fa', len: 2.1, big: 1 },
  racer: { color: '#16c47a', len: 2.0, big: 2 },
};
export function makeBikeModel(THREE, model = 'bike') {
  const s = BIKES[model] || BIKES.bike; const g = new THREE.Group(); const body = M(THREE, s.color, { metalness: 0.6, roughness: 0.3 }); const dark = M(THREE, '#16181d', { metalness: 0.4, roughness: 0.6 });
  const wr = model === 'scooter' ? 0.27 : 0.36; const wz = s.len / 2 - 0.1;
  for (const z of [wz, -wz]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(wr, wr, 0.16, 18), M(THREE, '#101114', { metalness: 0.1, roughness: 0.9 })); t.rotation.z = Math.PI / 2; t.position.set(0, wr, z); const rim = new THREE.Mesh(new THREE.CylinderGeometry(wr * 0.6, wr * 0.6, 0.18, 10), M(THREE, '#cfd5df', { metalness: 0.9, roughness: 0.25 })); rim.rotation.z = Math.PI / 2; rim.position.copy(t.position); g.add(t, rim); }
  const frameY = wr + 0.25;
  if (model === 'scooter') {
    g.add(B(THREE, 0.5, 0.18, 1.1, body, 0, 0.42, 0)); g.add(B(THREE, 0.46, 0.3, 0.6, body, 0, 0.55, -0.55)); g.add(B(THREE, 0.42, 0.12, 0.65, dark, 0, 0.82, -0.5));
    const fork = B(THREE, 0.08, 0.9, 0.1, body, 0, 0.75, wz - 0.2); fork.rotation.x = -0.2; g.add(fork); g.add(B(THREE, 0.9, 0.06, 0.08, dark, 0, 1.2, wz - 0.32)); g.add(B(THREE, 0.34, 0.28, 0.12, lit(THREE, '#fff7c0'), 0, 1.0, wz - 0.12)); g.add(B(THREE, 0.34, 0.1, 0.4, body, 0, 0.62, wz - 0.05));
  } else {
    const big = s.big;
    g.add(B(THREE, 0.34, 0.45, 1.1, dark, 0, frameY + 0.05, 0.05)); // エンジン
    const tank = B(THREE, 0.42, 0.34 + big * 0.04, 0.8, body, 0, frameY + 0.5, 0.3); tank.rotation.x = -0.08; g.add(tank);
    g.add(B(THREE, 0.38, 0.14, 0.95, dark, 0, frameY + 0.45, -0.55)); // シート
    g.add(B(THREE, 0.36, 0.3, 0.5, body, 0, frameY + 0.6, -0.95)); // テール
    const fork = B(THREE, 0.1, 1.0, 0.1, M(THREE, '#cfd5df', { metalness: 0.9, roughness: 0.2 }), 0, 0.72, wz - 0.28); fork.rotation.x = -0.35; g.add(fork);
    g.add(B(THREE, 0.9, 0.06, 0.08, dark, 0, 1.18, wz - 0.5));
    const fair = B(THREE, 0.5, 0.55 + big * 0.08, 0.5, body, 0, 0.95, wz - 0.28); fair.rotation.x = -0.35; g.add(fair);
    g.add(B(THREE, 0.34, 0.22, 0.1, lit(THREE, '#fff7c0'), 0, 1.0, wz - 0.02)); g.add(B(THREE, 0.2, 0.12, 0.06, lit(THREE, '#ff2a2a'), 0, frameY + 0.7, -1.2));
    const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.1, 8), M(THREE, '#9aa3b2', { metalness: 0.95, roughness: 0.2 })); ex.rotation.x = Math.PI / 2; ex.position.set(0.24, frameY - 0.05, -0.55); g.add(ex);
    if (model === 'pbike') { for (const x of [-0.34, 0.34]) g.add(B(THREE, 0.28, 0.42, 0.55, M(THREE, '#10131a'), x, frameY + 0.35, -0.85)); const b = B(THREE, 0.18, 0.12, 0.2, lit(THREE, '#3a6dff'), -0.1, 1.55, wz - 0.35); const r = B(THREE, 0.18, 0.12, 0.2, lit(THREE, '#ff3a3a'), 0.1, 1.55, wz - 0.35); g.add(b, r); g.userData.siren = [b, r]; }
  }
  // のっている ひと(のっている ときだけ ひょうじ)
  const rider = makePerson(THREE, { shirt: model === 'pbike' ? '#1d2a55' : '#262a33', pants: model === 'pbike' ? '#1d2a55' : '#20232b', helmet: model === 'pbike' ? '#f4f6fa' : s.color, sit: true, scale: 1 });
  rider.position.set(0, frameY + 0.1, -0.45); rider.rotation.x = 0; g.add(rider); g.userData.rider = rider; rider.visible = false;
  return castAll(g);
}

// ---- ひこうき ------------------------------------------------------------------------------------
function lathe(THREE, pts, mat, segs = 16) { // pts=[[はんけい, ながさ(+まえ)]...]
  const geo = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), segs); geo.rotateX(Math.PI / 2); return new THREE.Mesh(geo, mat);
}
function planform(THREE, pts, thick, mat) { // うえから みた かたち(x=よこ, y=うしろほど +)。z=まえ
  const sh = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y))); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: thick, bevelEnabled: false }); geo.translate(0, 0, -thick / 2); geo.rotateX(-Math.PI / 2); return new THREE.Mesh(geo, mat);
}
function fin(THREE, pts, thick, mat) { // よこから みた たてがた(x=まえうしろ, y=たかさ)
  const sh = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y))); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: thick, bevelEnabled: false }); geo.translate(0, 0, -thick / 2); geo.rotateY(-Math.PI / 2); return new THREE.Mesh(geo, mat);
}
const flameOf = (THREE, r, len) => { const f = new THREE.Mesh(new THREE.ConeGeometry(r, len, 10, 1, true), new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })); f.rotation.x = -Math.PI / 2; f.position.z = -len / 2; return f; };

export function makeAirModel(THREE, model = 'trainer') {
  const g = new THREE.Group(); const gl = new THREE.MeshStandardMaterial({ color: '#27456e', metalness: 0.9, roughness: 0.05, transparent: true, opacity: 0.92 });
  const flames = [];
  const engine = (x, y, z, r, len) => { const f = flameOf(THREE, r, len); const h = new THREE.Group(); h.position.set(x, y, z); h.add(f); g.add(h); flames.push(h); return h; };
  if (model === 'cessna') {
    const wh = M(THREE, '#f2f4f8', { metalness: 0.3, roughness: 0.5 }); const red = M(THREE, '#d33a2c', { metalness: 0.3, roughness: 0.5 });
    g.add(lathe(THREE, [[0.01, -4.6], [0.25, -4.0], [0.55, -2.2], [0.8, 0.2], [0.85, 1.4], [0.7, 2.4], [0.3, 3.0], [0.01, 3.1]], wh));
    g.add(planform(THREE, [[-5.6, 0.7], [-5.6, 0], [-0.6, -0.9], [0.6, -0.9], [5.6, 0], [5.6, 0.7]], 0.14, wh).translateY(0.95));
    g.add(planform(THREE, [[-1.9, 0.0], [-1.9, -0.55], [-0.4, -0.9], [0.4, -0.9], [1.9, -0.55], [1.9, 0]], 0.1, wh).translateZ(-4.0).translateY(0.35));
    g.add(fin(THREE, [[-0.4, 0], [0.4, 0], [0.1, 1.7], [-0.4, 1.7]], 0.1, red).translateZ(-3.8));
    const cab = new THREE.Mesh(new THREE.SphereGeometry(0.75, 14, 10), gl); cab.scale.set(0.9, 0.7, 1.5); cab.position.set(0, 0.85, 0.2); g.add(cab);
    const prop = new THREE.Group(); prop.position.z = 3.2; const blade = B(THREE, 3.0, 0.2, 0.06, M(THREE, '#222'), 0, 0, 0); prop.add(blade, B(THREE, 0.2, 3.0, 0.06, M(THREE, '#222')).translateY(0)); g.add(prop); g.userData.prop = prop;
    g.add(B(THREE, 1.7, 0.1, 0.1, M(THREE, '#222'), 0, -0.85, 1.4)); for (const x of [-0.85, 0.85]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.16, 12), M(THREE, '#15171c')); w.rotation.z = Math.PI / 2; w.position.set(x, -0.85, 1.4); g.add(w); }
    g.add(B(THREE, 4, 0.12, 0.3, red, 0, 0.9, 0.2).translateY(0.0));
    g.userData.flames = flames; return castAll(g);
  }
  if (model === 'trainer') {
    const rd = M(THREE, '#d8342a', { metalness: 0.4, roughness: 0.35 }); const wh = M(THREE, '#f4f6fa', { metalness: 0.4, roughness: 0.35 });
    g.add(lathe(THREE, [[0.01, -5.8], [0.35, -5.2], [0.8, -3], [1.0, -0.5], [0.95, 2.0], [0.6, 4.2], [0.2, 5.6], [0.01, 6.0]], rd));
    g.add(planform(THREE, [[-5.4, 1.2], [-5.4, 0.2], [-1.0, -2.2], [1.0, -2.2], [5.4, 0.2], [5.4, 1.2]], 0.18, wh).translateY(-0.1));
    g.add(planform(THREE, [[-2.6, 0.4], [-2.6, -0.4], [-0.8, -1.4], [0.8, -1.4], [2.6, -0.4], [2.6, 0.4]], 0.12, wh).translateZ(-5.0));
    g.add(fin(THREE, [[-0.9, 0], [0.9, 0], [0.3, 2.6], [-0.7, 2.6]], 0.14, rd).translateZ(-4.8));
    const c1 = new THREE.Mesh(new THREE.SphereGeometry(0.8, 14, 10), gl); c1.scale.set(0.85, 0.85, 2.3); c1.position.set(0, 0.85, 1.9); g.add(c1);
    for (const x of [-1, 1]) g.add(B(THREE, 0.5, 0.5, 1.8, rd, x * 0.9, 0.15, 2.2));
    engine(0, 0, -5.8, 0.55, 3);
    g.userData.flames = flames; return castAll(g);
  }
  if (model === 'bizjet') {
    const wh = M(THREE, '#f5f7fb', { metalness: 0.45, roughness: 0.3 }); const nv = M(THREE, '#17356b', { metalness: 0.5, roughness: 0.4 });
    g.add(lathe(THREE, [[0.01, -7.4], [0.4, -6.8], [0.95, -4], [1.15, -0.5], [1.15, 3.5], [0.9, 5.8], [0.4, 7.6], [0.01, 8.4]], wh, 20));
    g.add(planform(THREE, [[-6.6, 2.6], [-6.6, 1.6], [-0.9, -2.6], [0.9, -2.6], [6.6, 1.6], [6.6, 2.6]], 0.2, wh).translateY(-0.55));
    for (const x of [-1, 1]) g.add(B(THREE, 0.18, 0.5, 1.4, nv, x * 6.5, -0.45, 2.2)); // ウイングレット
    g.add(planform(THREE, [[-2.8, 0.9], [-2.8, 0], [-0.8, -1.5], [0.8, -1.5], [2.8, 0], [2.8, 0.9]], 0.14, wh).translateZ(-6.4).translateY(2.6));
    g.add(fin(THREE, [[-1.0, 0], [1.3, 0], [0.5, 3.0], [-0.9, 3.0]], 0.16, nv).translateZ(-6.3));
    for (const x of [-1, 1]) { const e = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.5, 2.4, 14), M(THREE, '#cfd5df', { metalness: 0.8, roughness: 0.3 })); e.rotation.x = Math.PI / 2; e.position.set(x * 1.55, 0.6, -5.2); g.add(e); engine(x * 1.55, 0.6, -6.4, 0.38, 2.2); }
    const c1 = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 10), gl); c1.scale.set(0.9, 0.55, 1.4); c1.position.set(0, 0.85, 6.1); g.add(c1);
    for (let i = 0; i < 9; i++) for (const x of [-1, 1]) g.add(B(THREE, 0.04, 0.3, 0.45, M(THREE, '#1d2f4a', { metalness: 0.9, roughness: 0.08 }), x * 1.15, 0.35, -3.5 + i * 1.0));
    g.add(B(THREE, 2.34, 0.14, 12, nv, 0, 0.05, -0.5));
    g.userData.flames = flames; return castAll(g);
  }
  if (model === 'fighter') {
    const gy = M(THREE, '#7d8798', { metalness: 0.7, roughness: 0.32 }); const dk = M(THREE, '#4b5363', { metalness: 0.7, roughness: 0.4 });
    g.add(lathe(THREE, [[0.01, -7.0], [0.55, -6.4], [0.95, -3.0], [1.05, 0.5], [0.85, 3.5], [0.45, 6.4], [0.12, 8.2], [0.01, 8.8]], gy, 18));
    g.add(planform(THREE, [[-5.0, 2.2], [-5.0, 1.0], [-0.9, -3.6], [0.9, -3.6], [5.0, 1.0], [5.0, 2.2]], 0.16, gy).translateY(-0.15).translateZ(-0.6));
    g.add(planform(THREE, [[-2.6, 0.8], [-2.6, 0], [-0.9, -1.6], [0.9, -1.6], [2.6, 0], [2.6, 0.8]], 0.12, dk).translateZ(-6.0).translateY(-0.05));
    for (const x of [-1, 1]) { const f = fin(THREE, [[-0.9, 0], [1.0, 0], [0.2, 2.4], [-0.8, 2.4]], 0.12, dk); f.position.set(x * 0.8, 0.7, -5.3); f.rotation.z = -x * 0.22; g.add(f); }
    const c1 = new THREE.Mesh(new THREE.SphereGeometry(0.8, 14, 10), gl); c1.scale.set(0.62, 0.7, 2.6); c1.position.set(0, 0.95, 2.6); g.add(c1);
    for (const x of [-1, 1]) { g.add(B(THREE, 0.7, 0.7, 2.6, dk, x * 0.95, -0.05, 1.2)); const m = lathe(THREE, [[0.05, 0], [0.25, 0.4], [0.2, 1.4]], M(THREE, '#cc3a2a')); m.position.set(x * 3.4, -0.25, -0.6); g.add(m); }
    engine(-0.45, 0, -7.0, 0.5, 3.4); engine(0.45, 0, -7.0, 0.5, 3.4);
    g.userData.flames = flames; return castAll(g);
  }
  // stealth(ファントム)
  const bk = M(THREE, '#232831', { metalness: 0.8, roughness: 0.3 }); const edge = M(THREE, '#3c4352', { metalness: 0.8, roughness: 0.3 });
  const body = lathe(THREE, [[0.01, -5.0], [0.5, -4.6], [1.0, -2.5], [1.1, 0.6], [0.8, 3.6], [0.35, 6.4], [0.01, 8.4]], bk, 6); body.scale.set(1.35, 0.45, 1); g.add(body);
  g.add(planform(THREE, [[-6.4, 3.4], [-6.4, 2.2], [-0.3, -7.2], [0.3, -7.2], [6.4, 2.2], [6.4, 3.4], [3.0, 1.6], [0, 3.0], [-3.0, 1.6]], 0.16, bk).translateY(-0.05).translateZ(0.2));
  for (const x of [-1, 1]) { const f = fin(THREE, [[-0.9, 0], [1.0, 0], [0.3, 2.0], [-0.7, 2.0]], 0.1, edge); f.position.set(x * 1.3, 0.25, -4.2); f.rotation.z = -x * 0.55; g.add(f); }
  const c1 = new THREE.Mesh(new THREE.SphereGeometry(0.7, 14, 10), new THREE.MeshStandardMaterial({ color: '#f0b04a', metalness: 0.95, roughness: 0.06, transparent: true, opacity: 0.9 })); c1.scale.set(0.7, 0.5, 2.2); c1.position.set(0, 0.5, 2.4); g.add(c1);
  engine(-0.7, 0.0, -5.0, 0.5, 3.2); engine(0.7, 0.0, -5.0, 0.5, 3.2);
  g.userData.flames = flames; return castAll(g);
}

// ---- ひと ----------------------------------------------------------------------------------------
const SKIN = ['#f3c9a5', '#e0a97d', '#c68a5c', '#8d5a3a', '#f6d6bc'];
const HAIR = ['#1a1410', '#3a2414', '#7a5030', '#c9a24a', '#8a8a8a', '#4a1a14'];
export function makePerson(THREE, o = {}) {
  const g = new THREE.Group(); const sc = o.scale || 1; const skin = M(THREE, o.skin || SKIN[0], { metalness: 0, roughness: 0.8 });
  const shirt = M(THREE, o.shirt || '#4a6fa5', { metalness: 0, roughness: 0.85 }); const pants = M(THREE, o.pants || '#2a3042', { metalness: 0, roughness: 0.9 }); const shoe = M(THREE, '#17181c', { metalness: 0.1, roughness: 0.8 });
  const hip = B(THREE, 0.5, 0.22, 0.3, pants, 0, 0.92, 0); const torso = B(THREE, 0.56, 0.66, 0.32, shirt, 0, 1.36, 0); torso.geometry.translate(0, 0, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), skin); head.position.set(0, 1.9, 0); const neck = B(THREE, 0.1, 0.1, 0.1, skin, 0, 1.76, 0);
  g.add(hip, torso, head, neck);
  const eyeM = lit(THREE, '#101010'); for (const x of [-0.06, 0.06]) g.add(B(THREE, 0.03, 0.03, 0.02, eyeM, x, 1.92, 0.16));
  if (o.helmet) { const h = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10, 0, 6.283, 0, 1.9), M(THREE, o.helmet, { metalness: 0.7, roughness: 0.25 })); h.position.set(0, 1.91, 0); g.add(h); const v = B(THREE, 0.3, 0.08, 0.06, glass(THREE), 0, 1.9, 0.17); g.add(v); }
  else if (o.cap) { const h = new THREE.Mesh(new THREE.SphereGeometry(0.185, 14, 8, 0, 6.283, 0, 1.45), M(THREE, o.cap, { metalness: 0, roughness: 0.8 })); h.position.set(0, 1.93, 0); g.add(h); g.add(B(THREE, 0.24, 0.03, 0.2, M(THREE, o.cap, { metalness: 0 }), 0, 1.93, 0.18)); }
  else { const h = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 8, 0, 6.283, 0, 1.6), M(THREE, o.hair || HAIR[0], { metalness: 0, roughness: 0.9 })); h.position.set(0, 1.92, -0.01); g.add(h); }
  if (o.mask) g.add(B(THREE, 0.3, 0.18, 0.06, M(THREE, '#101010', { metalness: 0, roughness: 0.9 }), 0, 1.86, 0.15));
  if (o.vest) g.add(B(THREE, 0.6, 0.5, 0.36, M(THREE, o.vest, { metalness: 0.1, roughness: 0.8 }), 0, 1.4, 0));
  if (o.bag) g.add(B(THREE, 0.34, 0.3, 0.14, M(THREE, o.bag, { metalness: 0, roughness: 0.9 }), 0, 1.35, -0.26));
  const mkLimb = (x, y, w, h, mat, hand) => { const p = new THREE.Group(); p.position.set(x, y, 0); const m = B(THREE, w, h, w + 0.04, mat, 0, -h / 2, 0); p.add(m); if (hand) { const hd = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), skin); hd.position.set(0, -h - 0.02, 0); p.add(hd); } return p; };
  const legL = mkLimb(-0.14, 0.88, 0.2, 0.8, pants, false); const legR = mkLimb(0.14, 0.88, 0.2, 0.8, pants, false);
  for (const l of [legL, legR]) { const f = B(THREE, 0.22, 0.12, 0.34, shoe, 0, -0.84, 0.06); l.add(f); }
  const armL = mkLimb(-0.37, 1.64, 0.15, 0.62, o.sleeve ? shirt : skin, true); const armR = mkLimb(0.37, 1.64, 0.15, 0.62, o.sleeve ? shirt : skin, true);
  for (const a of [armL, armR]) { a.children[0].material = shirt; a.children[0].scale.set(1, 0.55, 1); a.children[0].position.y = -0.17; const f = B(THREE, 0.13, 0.34, 0.13, skin, 0, -0.45, 0); a.add(f); }
  g.add(legL, legR, armL, armR);
  let gun = null; if (o.gun) { gun = new THREE.Group(); const body = B(THREE, 0.07, 0.12, 0.34, M(THREE, '#1a1a1e', { metalness: 0.8, roughness: 0.3 }), 0, 0, 0.14); const grip = B(THREE, 0.06, 0.16, 0.07, M(THREE, '#2a2a2e'), 0, -0.1, 0.02); gun.add(body, grip); gun.position.set(0, -0.62, 0.04); armR.add(gun); }
  if (o.sit) { legL.rotation.x = -1.35; legR.rotation.x = -1.35; armL.rotation.x = -0.9; armR.rotation.x = -0.9; torso.rotation.x = 0.25; }
  g.scale.setScalar(sc); g.userData = { legL, legR, armL, armR, head, gun, torso, parts: g.children.slice() };
  return castAll(g);
}
// ひとの いろいろ(id から きまる)
const SHIRTS = ['#c9473a', '#3a78c9', '#e0b12a', '#4aa86a', '#8a5ac9', '#e8e8ee', '#d8789a', '#2a8a9a', '#e07a3a'];
const PANTS = ['#2a3042', '#3a3a44', '#5a4a3a', '#2a4a6a', '#20242c', '#6a6a72'];
export function townsPerson(THREE, id) {
  const r = (n) => { let a = (id * 2654435761 + n * 40503) >>> 0; a = (a ^ (a >>> 13)) >>> 0; a = Math.imul(a, 1274126177) >>> 0; return (a & 0xffff) / 0xffff; };
  const pick = (arr, n) => arr[Math.floor(r(n) * arr.length) % arr.length];
  const kind = r(1);
  return makePerson(THREE, { skin: pick(SKIN, 2), shirt: pick(SHIRTS, 3), pants: pick(PANTS, 4), hair: pick(HAIR, 5), cap: kind < 0.2 ? pick(SHIRTS, 6) : null, bag: kind > 0.75 ? pick(PANTS, 7) : null, scale: 0.9 + r(8) * 0.18 });
}
export function crookPerson(THREE, type, id) {
  const base = { thug: { shirt: '#3a3d47', pants: '#1f2229', cap: '#1a1a1e', gun: true }, gunman: { shirt: '#262a33', pants: '#16181d', mask: true, vest: '#34383f', gun: true, hair: '#1a1410' }, boss: { shirt: '#6a1f2a', pants: '#14161a', hair: '#1a1410', gun: true, vest: '#8a6a2a', scale: 1.12 }, runner: { shirt: '#c9843a', pants: '#2a2e38', cap: '#222', bag: '#c0292a' } }[type] || {};
  return makePerson(THREE, { skin: SKIN[id % SKIN.length], scale: 1, sleeve: true, ...base });
}

// なまえと けんしょう金の ふだ
export function labelSprite(THREE, text, sub, color = '#ffd23f', w = 320) {
  const c = document.createElement('canvas'); c.width = w; c.height = 112; const g = c.getContext('2d');
  g.fillStyle = 'rgba(10,14,30,.78)'; const r = 18; g.beginPath(); g.moveTo(r, 4); g.lineTo(w - r, 4); g.quadraticCurveTo(w - 4, 4, w - 4, r); g.lineTo(w - 4, 108 - r); g.quadraticCurveTo(w - 4, 108, w - r, 108); g.lineTo(r, 108); g.quadraticCurveTo(4, 108, 4, 108 - r); g.lineTo(4, r); g.quadraticCurveTo(4, 4, r, 4); g.fill(); g.strokeStyle = color; g.lineWidth = 4; g.stroke();
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.font = 'bold 40px sans-serif'; g.fillText(text, w / 2, 36); g.fillStyle = color; g.font = 'bold 34px sans-serif'; g.fillText(sub, w / 2, 80);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); s.renderOrder = 22; s.scale.set(w / 52, 112 / 52, 1); s.userData.sub = sub; return s;
}
