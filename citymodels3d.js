// 地球防衛隊「シティ」の モデル: くるま・バイク・ひこうき・ひと・ぶき・はんにん(three.js)。ぜんぶ まえ = +Z。
//   makeCarModel(THREE, model, color) / makeBikeModel(THREE, model) / makeAirModel(THREE, model) / makePerson(THREE, opts) / makeWeaponModel(THREE, id) / labelSprite(THREE, text, sub, color)
//   パーツを いろごとに 1つの メッシュに まとめて(頂点カラー)、たくさん ならべても かるい。
const M = (THREE, c, o = {}) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.5, roughness: 0.4, ...o });
const B = (THREE, w, h, d, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; };
const glass = (THREE) => new THREE.MeshStandardMaterial({ color: '#1d2f4a', metalness: 0.9, roughness: 0.06 });
const lit = (THREE, c) => new THREE.MeshBasicMaterial({ color: c });
const castAll = (g) => { g.traverse((m) => { if (m.isMesh) m.castShadow = true; }); return g; };

// ---- パーツを あつめて くっつける ----------------------------------------------------------------
function collector(THREE) {
  const classes = {}; const tmp = new THREE.Object3D(); const col = new THREE.Color();
  const add = (cls, geo, color, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone(); tmp.position.set(p[0], p[1], p[2]); tmp.rotation.set(r[0], r[1], r[2]); tmp.scale.set(s[0], s[1], s[2]); tmp.updateMatrix(); g.applyMatrix4(tmp.matrix);
    col.set(color); const n = g.attributes.position.count; const c = new Float32Array(n * 3); for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; } g.setAttribute('color', new THREE.BufferAttribute(c, 3)); if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    (classes[cls] = classes[cls] || []).push(g);
  };
  const box = (cls, w, h, d, color, p, r, s) => add(cls, new THREE.BoxGeometry(w, h, d), color, p, r, s);
  const cyl = (cls, rt, rb, h, color, p, r, seg = 12) => add(cls, new THREE.CylinderGeometry(rt, rb, h, seg), color, p, r);
  const sph = (cls, rad, color, p, s, seg = 12) => add(cls, new THREE.SphereGeometry(rad, seg, Math.max(6, seg - 4)), color, p, [0, 0, 0], s);
  const build = (mats, shadow = true) => {
    const grp = new THREE.Group();
    for (const [cls, list] of Object.entries(classes)) {
      let n = 0; for (const g of list) n += g.attributes.position.count; const pos = new Float32Array(n * 3); const nor = new Float32Array(n * 3); const colr = new Float32Array(n * 3); const uvs = new Float32Array(n * 2); let o = 0;
      for (const g of list) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); colr.set(g.attributes.color.array, o * 3); uvs.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count; g.dispose(); }
      const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); mg.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); mg.setAttribute('uv', new THREE.BufferAttribute(uvs, 2)); mg.setAttribute('color', new THREE.BufferAttribute(colr, 3));
      const mesh = new THREE.Mesh(mg, mats[cls] || mats.paint); mesh.castShadow = shadow; grp.add(mesh);
    }
    return grp;
  };
  return { add, box, cyl, sph, build };
}
let MATS = null;
const mats = (THREE) => MATS || (MATS = {
  paint: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.55, roughness: 0.28 }),
  matte: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.1, roughness: 0.85 }),
  chrome: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.95, roughness: 0.18 }),
  glass: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.9, roughness: 0.05, transparent: true, opacity: 0.82 }),
  light: new THREE.MeshBasicMaterial({ vertexColors: true }),
  cloth: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0, roughness: 0.92, map: fabricTex(THREE), bumpMap: fabricTex(THREE), bumpScale: 0.9 }),
  skin: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0, roughness: 0.72 }),
  metal: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.85, roughness: 0.32 }),
  wood: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.05, roughness: 0.7 }),
  glow: new THREE.MeshBasicMaterial({ vertexColors: true }),
});

// よこから みた かたちを ほそながく のばす(shape x = まえうしろ(z), y = たかさ)
function profileGeo(THREE, pts, width, bevel = 0.06) {
  const sh = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y))); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: width - bevel * 2, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, steps: 1 });
  geo.translate(0, 0, -(width - bevel * 2) / 2); geo.rotateY(-Math.PI / 2); return geo;
}

// ---- くるま --------------------------------------------------------------------------------------
const CARS = {
  sedan: { L: 4.6, W: 1.85, bh: 0.92, ch: 0.52, cz: [-1.75, 0.95], wr: 0.34, color: '#3b6fd0' },
  police: { L: 4.8, W: 1.92, bh: 0.94, ch: 0.54, cz: [-1.75, 1.0], wr: 0.35, color: '#f4f6fa' },
  taxi: { L: 4.6, W: 1.85, bh: 0.92, ch: 0.58, cz: [-1.75, 0.95], wr: 0.34, color: '#f2b705' },
  suv: { L: 4.8, W: 2.02, bh: 1.18, ch: 0.68, cz: [-2.25, 1.15], wr: 0.44, color: '#2f5a3a' },
  truck: { L: 6.8, W: 2.25, bh: 1.2, ch: 0.9, cz: [1.1, 2.7], wr: 0.5, color: '#c93a2a' },
  sports: { L: 4.4, W: 1.95, bh: 0.7, ch: 0.4, cz: [-1.1, 0.7], wr: 0.35, color: '#d11f2e' },
  super: { L: 4.6, W: 2.1, bh: 0.6, ch: 0.36, cz: [-0.85, 0.8], wr: 0.37, color: '#c6e000' },
};
export function makeCarModel(THREE, model = 'sedan', color) {
  const s = CARS[model] || CARS.sedan; const C = collector(THREE); const col = color || s.color; const L = s.L; const W = s.W; const low = model === 'sports' || model === 'super'; const hw = W / 2;
  const dark = '#14161b'; const grey = '#2a2d34';
  // ボディ
  const pts = low ? [[-L / 2, 0.28], [-L / 2, s.bh * 0.92], [-L / 2 + 0.5, s.bh + 0.06], [L / 2 - 2.0, s.bh + 0.06], [L / 2 - 0.55, s.bh - 0.05], [L / 2, s.bh - 0.28], [L / 2, 0.28]]
    : [[-L / 2, 0.3], [-L / 2, s.bh * 0.94], [-L / 2 + 0.45, s.bh], [L / 2 - 1.45, s.bh], [L / 2 - 0.2, s.bh - 0.16], [L / 2, s.bh - 0.3], [L / 2, 0.3]];
  C.add('paint', profileGeo(THREE, pts, W, 0.07), col);
  const [c0, c1] = s.cz; const roofY = s.bh + s.ch; const f0 = low ? 0.55 : 0.5; const f1 = low ? 0.5 : 0.8;
  C.add('glass', profileGeo(THREE, [[c0, s.bh], [c0 + f0, roofY - 0.02], [c1 - f1, roofY - 0.02], [c1, s.bh]], W * 0.9, 0.02), '#1b2a40');
  C.add('paint', profileGeo(THREE, [[c0 + f0 - 0.05, roofY - 0.04], [c0 + f0, roofY + 0.04], [c1 - f1, roofY + 0.04], [c1 - f1 + 0.05, roofY - 0.04]], W * 0.86, 0.02), col);
  for (const sx of [-1, 1]) { C.box('paint', 0.07, s.ch, 0.08, col, [sx * (hw - 0.1), s.bh + s.ch / 2, c0 + f0 * 0.5], [-0.0, 0, 0], [1, 1, 1]); C.box('paint', 0.07, s.ch, 0.1, col, [sx * (hw - 0.1), s.bh + s.ch / 2, c1 - f1 * 0.45]); C.box('paint', 0.07, s.ch * 0.9, 0.06, col, [sx * (hw - 0.1), s.bh + s.ch / 2, (c0 + c1) / 2 - 0.1]); }
  // ないぶ(シートと ハンドル)
  for (const sx of [-0.4, 0.4]) { C.box('matte', 0.42, 0.45, 0.4, grey, [sx, s.bh + 0.05, (c0 + c1) / 2 + 0.25]); C.box('matte', 0.4, 0.5, 0.1, grey, [sx, s.bh + 0.35, (c0 + c1) / 2 + 0.03]); }
  C.box('matte', 1.5, 0.4, 0.4, grey, [0, s.bh + 0.05, (c0 + c1) / 2 - 0.55]); C.cyl('matte', 0.17, 0.17, 0.03, dark, [-0.4, s.bh + 0.25, (c0 + c1) / 2 + 0.6], [1.0, 0, 0], 14);
  // ホイール・アーチ・タイヤ
  const wz = L / 2 - (model === 'truck' ? 1.0 : 0.88); const wzs = model === 'truck' ? [wz, -wz + 0.2, -wz - 0.65] : [wz, -wz];
  for (const sx of [-1, 1]) for (const z of wzs) {
    const x = sx * (hw - 0.1); C.cyl('matte', s.wr + 0.07, s.wr + 0.07, 0.34, '#0d0e11', [x, s.wr, z], [0, 0, Math.PI / 2], 18); C.cyl('matte', s.wr, s.wr, 0.3, '#17181c', [sx * (hw - 0.12), s.wr, z], [0, 0, Math.PI / 2], 20);
    C.cyl('chrome', s.wr * 0.66, s.wr * 0.66, 0.32, '#cdd3dc', [sx * (hw - 0.12), s.wr, z], [0, 0, Math.PI / 2], 14); C.cyl('chrome', s.wr * 0.18, s.wr * 0.18, 0.36, '#6a707c', [sx * (hw - 0.12), s.wr, z], [0, 0, Math.PI / 2], 8);
    for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; C.box('chrome', 0.34, s.wr * 0.5, 0.05, '#e8ecf2', [sx * (hw - 0.12), s.wr + Math.cos(a) * s.wr * 0.35, z + Math.sin(a) * s.wr * 0.35], [a, 0, 0]); }
  }
  // バンパー・グリル・ライト・ナンバー
  C.box('matte', W * 0.96, 0.22, 0.2, dark, [0, 0.42, L / 2 - 0.02]); C.box('matte', W * 0.96, 0.22, 0.2, dark, [0, 0.42, -L / 2 + 0.02]);
  C.box('chrome', W * 0.55, 0.14, 0.05, '#3a3f48', [0, s.bh - 0.38, L / 2 + 0.02]); for (let k = 0; k < 4; k++) C.box('chrome', W * 0.55, 0.012, 0.06, '#aab2be', [0, s.bh - 0.44 + k * 0.035, L / 2 + 0.035]);
  for (const sx of [-1, 1]) { C.box('light', 0.42, 0.16, 0.08, '#fff6d0', [sx * (hw - 0.38), s.bh - 0.2, L / 2 + 0.01]); C.box('chrome', 0.46, 0.2, 0.05, '#9aa0aa', [sx * (hw - 0.38), s.bh - 0.2, L / 2 - 0.02]); C.box('light', 0.5, 0.14, 0.06, '#e01818', [sx * (hw - 0.4), s.bh - 0.12, -L / 2 - 0.01]); C.box('light', 0.12, 0.08, 0.06, '#ff9a1a', [sx * (hw - 0.14), s.bh - 0.2, L / 2 + 0.01]);
    C.box('paint', 0.08, 0.1, 0.18, col, [sx * (hw + 0.02), s.bh + 0.08, c0 + f0 * 0.55 + 0.18]); C.box('matte', 0.06, 0.08, 0.1, dark, [sx * (hw + 0.08), s.bh + 0.08, c0 + f0 * 0.55 + 0.18]); // ミラー
    C.box('chrome', 0.03, 0.03, 0.14, '#d8dde5', [sx * (hw + 0.005), s.bh - 0.1, (c0 + c1) / 2 + 0.2]); C.box('matte', 0.014, s.bh - 0.35, 0.014, '#0c0d10', [sx * (hw + 0.005), s.bh / 2 + 0.2, (c0 + c1) / 2 + 0.55]); C.box('matte', 0.014, s.bh - 0.35, 0.014, '#0c0d10', [sx * (hw + 0.005), s.bh / 2 + 0.2, (c0 + c1) / 2 - 0.55]); }
  C.box('light', 0.52, 0.13, 0.02, '#f2f2ee', [0, 0.45, L / 2 + 0.09]); C.box('light', 0.52, 0.13, 0.02, '#f2f2ee', [0, 0.5, -L / 2 - 0.09]);
  for (const sx of [-0.55, 0.55]) C.cyl('chrome', 0.045, 0.045, 0.22, '#9aa0aa', [sx, 0.3, -L / 2 - 0.06], [Math.PI / 2, 0, 0], 8);
  // モデルごとの とくちょう
  const sirens = [];
  const model3 = () => {
    if (model === 'police') {
      C.box('matte', W * 1.001, 0.3, 1.8, '#10131a', [0, 0.62, 0]); C.box('matte', W * 1.001, 0.3, 1.1, '#10131a', [0, 0.62, -1.5]); C.box('matte', 0.9, 0.12, 0.36, '#10131a', [0, roofY + 0.1, 0]); C.box('chrome', W * 0.6, 0.35, 0.08, '#2a2d34', [0, 0.55, L / 2 + 0.1]);
      for (const sx of [-1, 1]) C.box('light', 0.18, 0.1, 0.06, sx < 0 ? '#2a6aff' : '#ff2a2a', [sx * 0.7, s.bh - 0.02, L / 2 - 0.1]);
    } else if (model === 'taxi') {
      C.box('light', 0.9, 0.2, 0.28, '#fff0a0', [0, roofY + 0.14, 0.1]); C.box('matte', 0.9, 0.04, 0.3, '#222', [0, roofY + 0.03, 0.1]);
      for (let k = 0; k < 14; k++) for (const sx of [-1, 1]) C.box('matte', 0.02, 0.07, 0.14, k % 2 ? '#111' : '#f2b705', [sx * (hw + 0.002), 0.68, -1.5 + k * 0.23]);
    } else if (model === 'suv') {
      for (const sx of [-1, 1]) C.box('matte', 0.05, 0.05, 1.9, '#2a2d34', [sx * 0.7, roofY + 0.1, -0.6]); C.box('matte', 1.5, 0.04, 0.05, '#2a2d34', [0, roofY + 0.1, -1.4]); C.cyl('matte', 0.36, 0.36, 0.2, '#17181c', [0, 0.95, -L / 2 - 0.15], [Math.PI / 2, 0, 0], 16); C.cyl('chrome', 0.2, 0.2, 0.22, '#aaa', [0, 0.95, -L / 2 - 0.16], [Math.PI / 2, 0, 0], 12); C.box('matte', W, 0.12, 0.35, grey, [0, 0.35, L / 2 + 0.05]);
    } else if (model === 'truck') {
      C.box('paint', W * 0.98, 2.0, 4.2, '#e9edf3', [0, 2.15, -1.7]); C.box('matte', W, 0.26, 4.6, '#2b2f38', [0, 1.0, -1.55]); for (let k = 0; k < 6; k++) C.box('paint', W * 1.0, 2.0, 0.05, '#cdd2da', [0, 2.15, -3.5 + k * 0.7]);
      C.box('paint', W * 0.99, 0.5, 1.5, col, [0, 1.35, 2.2]); C.box('matte', 0.3, 0.1, 0.1, dark, [-hw - 0.05, 1.7, 1.6]); C.cyl('chrome', 0.07, 0.07, 1.5, '#aab', [hw - 0.2, 2.2, 0.9], [0, 0, 0], 8); C.box('chrome', 0.5, 0.35, 0.05, '#8a8f98', [0, 0.85, L / 2 + 0.02]);
      for (const sx of [-1, 1]) C.box('paint', 0.1, 0.55, 0.3, col, [sx * (hw + 0.12), roofY + 0.1, 2.3]);
    } else if (model === 'sports' || model === 'super') {
      C.box('matte', W * 0.92, 0.05, 0.55, '#0c0d10', [0, s.bh + 0.46, -L / 2 + 0.25]); for (const sx of [-0.72, 0.72]) C.box('matte', 0.05, 0.4, 0.5, '#0c0d10', [sx, s.bh + 0.26, -L / 2 + 0.25]);
      for (const sx of [-1, 1]) { C.box('matte', 0.06, 0.2, 1.0, '#0c0d10', [sx * (hw + 0.005), 0.55, -0.35]); C.box('matte', 0.06, 0.12, 0.6, '#0c0d10', [sx * (hw + 0.005), 0.55, 1.05]); }
      C.box('matte', W * 0.85, 0.06, 0.3, '#0c0d10', [0, 0.28, L / 2 + 0.05]); C.box('matte', 0.9, 0.04, 0.5, '#0c0d10', [0, s.bh + 0.06, 0.8]);
      if (model === 'super') { C.box('paint', 0.9, 0.03, 1.4, '#0c0d10', [0, s.bh + 0.07, -1.4]); for (const sx of [-1, 1]) C.box('matte', 0.4, 0.04, 0.14, '#0c0d10', [sx * 0.8, s.bh + 0.07, 0.4]); for (const sx of [-0.4, 0.4]) C.cyl('chrome', 0.07, 0.07, 0.2, '#aab', [sx, 0.38, -L / 2 - 0.05], [Math.PI / 2, 0, 0], 10); }
      else for (const sx of [-0.4, 0.4]) C.cyl('chrome', 0.06, 0.06, 0.2, '#aab', [sx, 0.35, -L / 2 - 0.05], [Math.PI / 2, 0, 0], 10);
      // ストライプ
      if (model === 'sports') { C.box('paint', 0.28, 0.01, L - 0.3, '#f4f4f4', [0, s.bh + 0.075, 0]); }
    }
  };
  model3();
  const grp = C.build(mats(THREE)); grp.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  if (model === 'police') { const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.3), new THREE.MeshBasicMaterial({ color: '#3a6dff' })); b.position.set(-0.28, roofY + 0.2, 0); const r = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.3), new THREE.MeshBasicMaterial({ color: '#ff3a3a' })); r.position.set(0.28, roofY + 0.2, 0); grp.add(b, r); grp.userData.siren = [b, r]; }
  void sirens; return grp;
}

// ---- バイク --------------------------------------------------------------------------------------
const BIKES = {
  scooter: { color: '#27b7a6', len: 1.7 },
  bike: { color: '#d11f2e', len: 2.05 },
  pbike: { color: '#f4f6fa', len: 2.15 },
  racer: { color: '#16c47a', len: 2.05 },
};
export function makeBikeModel(THREE, model = 'bike') {
  const s = BIKES[model] || BIKES.bike; const C = collector(THREE); const col = s.color; const dark = '#16181d'; const wr = model === 'scooter' ? 0.26 : 0.34; const wz = s.len / 2 - 0.08; const sport = model === 'bike' || model === 'racer';
  const wheel = (z) => { C.add('matte', new THREE.TorusGeometry(wr - 0.05, 0.06, 8, 22), '#101114', [0, wr, z], [0, Math.PI / 2, 0]); C.cyl('chrome', wr - 0.08, wr - 0.08, 0.02, '#c8cdd6', [0, wr, z], [0, 0, Math.PI / 2], 16); for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI; C.box('chrome', 0.015, 0.012, (wr - 0.08) * 2, '#d8dde5', [0, wr, z], [a, 0, 0]); } C.cyl('chrome', 0.04, 0.04, 0.14, '#6a707c', [0, wr, z], [0, 0, Math.PI / 2], 8); C.cyl('chrome', wr * 0.55, wr * 0.55, 0.012, '#9aa0aa', [0.045, wr, z], [0, 0, Math.PI / 2], 14); };
  wheel(wz); wheel(-wz);
  const fy = wr + 0.22;
  if (model === 'scooter') {
    C.box('paint', 0.5, 0.1, 0.9, col, [0, 0.3, 0.05]); C.add('paint', profileGeo(THREE, [[-0.9, 0.3], [-0.9, 0.7], [-0.5, 0.75], [-0.2, 0.55], [-0.2, 0.3]], 0.42, 0.04), col); C.box('matte', 0.4, 0.1, 0.62, '#222', [0, 0.82, -0.52]);
    C.add('paint', profileGeo(THREE, [[0.45, 0.28], [0.35, 0.95], [0.6, 1.05], [0.75, 0.3]], 0.46, 0.04), col, [0, 0, 0]); C.box('chrome', 0.07, 0.8, 0.07, '#cfd5df', [0, 0.65, wz - 0.12], [-0.22, 0, 0]); C.box('matte', 0.8, 0.045, 0.06, dark, [0, 1.15, wz - 0.3]); C.box('light', 0.26, 0.2, 0.08, '#fff6d0', [0, 0.95, wz - 0.05]); C.box('light', 0.2, 0.08, 0.04, '#e01818', [0, 0.78, -0.95]); C.box('paint', 0.3, 0.05, 0.4, col, [0, wr + 0.2, wz - 0.1]); C.box('paint', 0.3, 0.05, 0.44, col, [0, wr + 0.22, -wz + 0.05]);
    C.cyl('chrome', 0.04, 0.05, 0.5, '#9aa0aa', [0.2, 0.3, -0.7], [Math.PI / 2, 0, 0], 8);
  } else {
    C.box('matte', 0.3, 0.4, 0.55, '#202228', [0, fy, 0.05]); for (let k = 0; k < 4; k++) C.cyl('chrome', 0.07, 0.07, 0.34, '#9aa0aa', [0, fy + 0.12, -0.05 + k * 0.01 + (k % 2) * 0.1], [0, 0, Math.PI / 2], 10); C.box('matte', 0.28, 0.3, 0.4, '#1a1c20', [0, fy - 0.16, -0.38]);
    C.sph('paint', 0.22, col, [0, fy + 0.46, 0.28], [0.9, 0.85, 1.7], 14); C.box('matte', 0.3, 0.1, 0.8, '#222', [0, fy + 0.33, -0.55]); C.add('paint', profileGeo(THREE, [[-0.4, fy + 0.2], [-0.95, fy + 0.5 + (model === 'racer' ? 0.12 : 0)], [-0.95, fy + 0.34], [-0.55, fy + 0.2]], 0.28, 0.03), col);
    for (const sx of [-1, 1]) { C.box('chrome', 0.045, 0.95, 0.05, '#d3d8e0', [sx * 0.09, 0.7, wz - 0.28], [-0.38, 0, 0]); C.box('chrome', 0.03, 0.4, 0.04, '#aab', [sx * 0.1, wr + 0.1, -wz + 0.2], [-0.6, 0, 0]); C.box('matte', 0.04, 0.04, 0.9, dark, [sx * 0.1, wr + 0.25, -0.35], [0.12, 0, 0]); }
    C.box('matte', 0.85, 0.045, 0.06, dark, [0, 1.12, wz - 0.5]); for (const sx of [-1, 1]) { C.cyl('matte', 0.025, 0.025, 0.14, '#111', [sx * 0.46, 1.12, wz - 0.5], [0, 0, Math.PI / 2], 8); C.box('chrome', 0.02, 0.1, 0.08, '#ccd', [sx * 0.34, 1.2, wz - 0.5]); }
    C.add('paint', profileGeo(THREE, [[wz - 0.62, 0.9], [wz - 0.05, 0.76], [wz + 0.05, 1.0 + (model === 'racer' ? 0.2 : 0.05)], [wz - 0.45, 1.25 + (model === 'racer' ? 0.12 : 0)]], 0.46, 0.04), col); C.box('glass', 0.34, 0.32 + (model === 'racer' ? 0.1 : 0), 0.04, '#223048', [0, 1.28, wz - 0.4], [-0.5, 0, 0]);
    C.add('light', new THREE.CylinderGeometry(0.1, 0.1, 0.05, 14), '#fff6d0', [0, 0.98, wz + 0.04], [Math.PI / 2, 0, 0]); C.box('light', 0.18, 0.06, 0.04, '#e01818', [0, fy + 0.5, -1.18]); C.box('paint', 0.25, 0.04, 0.5, col, [0, wr + 0.22, wz - 0.12]); C.box('paint', 0.28, 0.04, 0.5, col, [0, wr + 0.3, -wz + 0.1]); C.box('light', 0.2, 0.1, 0.01, '#f4f4ee', [0, fy + 0.4, -1.2]);
    C.cyl('chrome', 0.05, 0.075, 1.05, '#aab2be', [0.22, fy - 0.12, -0.45], [Math.PI / 2, 0, 0.05], 10); C.cyl('chrome', 0.06, 0.06, 0.16, '#222', [0.22, fy - 0.1, -1.0], [Math.PI / 2, 0, 0], 10);
    if (model === 'pbike') { for (const sx of [-1, 1]) C.box('matte', 0.28, 0.45, 0.6, '#10131a', [sx * 0.34, fy + 0.3, -0.85]); C.box('matte', 0.4, 0.04, 0.5, dark, [0, fy + 0.78, -0.85]); }
    if (model === 'racer') { C.box('matte', 0.3, 0.1, 0.9, '#0c0d10', [0, fy - 0.2, 0.15]); C.box('paint', 0.28, 0.5, 0.05, '#0c0d10', [0, fy + 0.6, -1.15], [-0.3, 0, 0]); C.box('paint', 0.32, 0.04, 0.9, '#f4f4f4', [0, fy + 0.72, 0.28]); }
    if (sport && model === 'bike') C.box('paint', 0.32, 0.04, 0.8, '#f4f4f4', [0, fy + 0.7, 0.28]);
  }
  const g = C.build(mats(THREE));
  if (model === 'pbike') { const b = B(THREE, 0.18, 0.12, 0.2, lit(THREE, '#3a6dff'), -0.1, 1.5, wz - 0.35); const r = B(THREE, 0.18, 0.12, 0.2, lit(THREE, '#ff3a3a'), 0.1, 1.5, wz - 0.35); g.add(b, r); g.userData.siren = [b, r]; }
  const rider = makePerson(THREE, { shirt: model === 'pbike' ? '#1d2a55' : '#262a33', pants: model === 'pbike' ? '#1d2a55' : '#20232b', helmet: model === 'pbike' ? '#f4f6fa' : s.color, sit: true, jacket: true });
  rider.position.set(0, 0.04, -0.4); g.add(rider); g.userData.rider = rider; rider.visible = false;
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

const AIR_SPAN = { cessna: [5.6, -4.6], trainer: [5.4, -5.8], bizjet: [6.6, -7.4], fighter: [5.0, -7.0], stealth: [6.4, -5.0] };
// パトロールヘリ(あおい ボディ・ローター・きかんじゅう)。まえは +z
export function makeHeliModel(THREE) {
  const g = new THREE.Group(); const m = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.25, ...o });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.7, 16, 12), m('#1d2f63')); body.scale.set(1, 0.95, 1.7); body.position.y = 0; g.add(body);
  const glass = new THREE.Mesh(new THREE.SphereGeometry(1.2, 14, 10), m('#9fd4ff', { metalness: 0.6, roughness: 0.15 })); glass.scale.set(1, 0.85, 1.1); glass.position.set(0, 0.35, 1.6); g.add(glass);
  const boom = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 5.6), m('#1d2f63')); boom.position.set(0, 0.35, -4.2); g.add(boom);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.7, 0.9), m('#f2f2f2')); fin.position.set(0, 1.1, -6.8); g.add(fin);
  const rotor = new THREE.Group(); for (let i = 0; i < 2; i++) { const bl = new THREE.Mesh(new THREE.BoxGeometry(11, 0.07, 0.45), m('#222')); bl.rotation.y = (i * Math.PI) / 2; rotor.add(bl); } rotor.position.y = 2.1; g.add(rotor);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.6, 6), m('#333')); mast.position.y = 1.85; g.add(mast);
  const trot = new THREE.Group(); const tb = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.6, 0.25), m('#222')); trot.add(tb); trot.position.set(0.25, 1.3, -6.8); g.add(trot);
  for (const sx of [-1, 1]) { const sk = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 3.6), m('#444')); sk.position.set(sx * 1.2, -1.7, 0.2); g.add(sk); for (const sz of [-0.9, 1]) { const lg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.08), m('#444')); lg.position.set(sx * 1.2, -1.2, sz); g.add(lg); } }
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff3b3b' })); lamp.position.set(0, 1.85, 0.6); g.add(lamp); const lamp2 = lamp.clone(); lamp2.material = new THREE.MeshBasicMaterial({ color: '#3b6bff' }); lamp2.position.set(0, 1.85, -0.6); g.add(lamp2);
  g.userData = { rotor, trot }; return g;
}
export function makeAirModel(THREE, model = 'trainer') {
  const g = makeAirBase(THREE, model); const [sp, tz] = AIR_SPAN[model] || [5, -5];
  const mk = (c, x, z) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: c })); m.position.set(x, 0.05, z); return m; };
  const r = mk('#ff2a2a', -sp, 0.3); const gr = mk('#2aff5a', sp, 0.3); const st = mk('#ffffff', 0, tz + 0.4); st.position.y = 1.2; g.add(r, gr, st); g.userData.nav = { strobe: st, red: r, green: gr };
  if (model === 'fighter') { for (const x of [-1, 1]) for (const dx of [2.3, 3.4]) { const ms = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.6, 8), new THREE.MeshStandardMaterial({ color: '#e8e8ee', metalness: 0.5, roughness: 0.4 })); ms.rotation.x = Math.PI / 2; ms.position.set(x * dx, -0.35, -0.4); const nose = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.35, 8), new THREE.MeshStandardMaterial({ color: '#cc3a2a' })); nose.rotation.x = Math.PI / 2; nose.position.set(x * dx, -0.35, 1.05); g.add(ms, nose); } }
  if (model === 'trainer' || model === 'fighter') for (const x of [-1, 1]) { const px = x * (model === 'trainer' ? 3.2 : 3.0); const rd = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), new THREE.MeshBasicMaterial({ color: '#d12a2a', side: THREE.DoubleSide })); rd.rotation.x = -Math.PI / 2; rd.position.set(px, 0.12, -0.6); const wh = new THREE.Mesh(new THREE.CircleGeometry(0.28, 16), new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide })); wh.rotation.x = -Math.PI / 2; wh.position.set(px, 0.13, -0.6); g.add(rd, wh); }
  return g;
}
function makeAirBase(THREE, model) {
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

// ---- ぶき(てに もつ モデル。にぎりが げんてん・さきが +Z・うえが +Y) ------------------------------------
export function makeWeaponModel(THREE, id = 'pistol') {
  const C = collector(THREE); const gm = '#1c1e24'; const gm2 = '#2c2f38'; const st = '#aab2be'; const wd = '#6a4526'; const wd2 = '#8a5a30'; const gl = '#7fe7ff';
  const b = (cls, w, h, d, c, x, y, z, rx = 0) => C.box(cls, w, h, d, c, [x, y, z], [rx, 0, 0]); const cy = (cls, r1, r2, len, c, x, y, z, seg = 10) => C.cyl(cls, r1, r2, len, c, [x, y, z], [Math.PI / 2, 0, 0], seg);
  const grip = (len = 0.1, x = 0, z = 0, c = gm2, rx = 0.22) => b('metal', 0.034, len, 0.05, c, x, -len / 2 + 0.02, z, rx);
  const guard = (z = 0.04) => { b('metal', 0.01, 0.04, 0.05, gm, 0, -0.03, z + 0.03); b('metal', 0.01, 0.012, 0.05, gm, 0, -0.05, z + 0.03); };
  const mag = (len = 0.14, z = 0, w = 0.026, rx = 0) => b('metal', w, len, 0.045, gm, 0, -len / 2 - 0.02, z, rx);
  const optic = (z = 0.1, y = 0.07, len = 0.12) => { cy('metal', 0.022, 0.022, len, gm, 0, y, z, 10); C.cyl('glow', 0.019, 0.019, 0.005, gl, [0, y, z + len / 2 + 0.002], [Math.PI / 2, 0, 0], 8); b('metal', 0.012, 0.03, 0.03, gm, 0, y - 0.03, z); };
  const sights = (z1, z2, y = 0.062) => { b('metal', 0.01, 0.015, 0.012, gm, 0, y, z1); b('metal', 0.016, 0.015, 0.012, gm, 0, y, z2); };
  const stockW = (len = 0.22, z = -0.18, c = wd, h = 0.08) => { b('wood', 0.04, h, len, c, 0, 0.0, z, -0.08); b('wood', 0.045, h + 0.02, 0.025, wd2, 0, -0.01, z - len / 2, -0.08); };
  switch (id) {
    case 'pistol': case 'combatpistol': case 'heavypistol': case 'pistol50': case 'appistol': {
      const big = id === 'pistol50' || id === 'heavypistol'; const w = big ? 1.15 : 1;
      b('metal', 0.034 * w, 0.045, 0.2 * w, id === 'appistol' ? gm2 : gm, 0, 0.04, 0.1 * w); b('metal', 0.03, 0.03, 0.18 * w, gm2, 0, 0.005, 0.09 * w); cy('metal', 0.011, 0.011, 0.04, st, 0, 0.04, 0.215 * w); grip(0.11 * w); guard(); sights(0.2 * w, 0.005); mag(id === 'appistol' ? 0.17 : 0.09, 0.01, 0.024, 0.22); b('metal', 0.012, 0.012, 0.02, '#c9a24a', 0.0, 0.065, 0.1 * w);
      if (id === 'appistol') b('metal', 0.03, 0.02, 0.1, gm, 0, 0.065, 0.1); break; }
    case 'revolver': {
      b('metal', 0.032, 0.05, 0.12, gm, 0, 0.03, 0.05); cy('metal', 0.04, 0.04, 0.06, st, 0, 0.03, 0.1, 12); cy('metal', 0.014, 0.014, 0.22, st, 0, 0.045, 0.2); b('metal', 0.02, 0.025, 0.2, gm2, 0, 0.01, 0.2); grip(0.12, 0, -0.01, wd); guard(0.02); b('metal', 0.01, 0.02, 0.012, gm, 0, 0.07, 0.3); break; }
    case 'microsmg': case 'smg': case 'assaultsmg': case 'combatpdw': {
      const len = id === 'microsmg' ? 0.24 : 0.32; b('metal', 0.05, 0.075, len, gm, 0, 0.03, len / 2 - 0.02); cy('metal', 0.013, 0.013, 0.14, st, 0, 0.04, len + 0.06); b('metal', 0.04, 0.05, 0.1, gm2, 0, 0.03, len + 0.0); grip(0.1, 0, 0.02); guard(0.0); mag(id === 'microsmg' ? 0.14 : 0.2, len * 0.55, 0.026);
      b('metal', 0.02, 0.012, len * 0.7, gm2, 0, 0.075, len * 0.45); if (id !== 'microsmg') { b('metal', 0.012, 0.03, 0.2, gm2, 0, 0.0, -0.1, 0); b('metal', 0.04, 0.07, 0.02, gm2, 0, 0.0, -0.2); } if (id === 'assaultsmg' || id === 'combatpdw') optic(0.15, 0.1, 0.09); b('metal', 0.03, 0.06, 0.03, gm2, 0, -0.06, len + 0.05, 0.1); break; }
    case 'sawedoff': case 'pump': case 'dbarrel': case 'assaultsg': {
      const L = id === 'sawedoff' ? 0.3 : 0.6; if (id === 'dbarrel' || id === 'sawedoff') { for (const sx of [-0.014, 0.014]) cy('metal', 0.016, 0.016, L, gm, sx, 0.04, L / 2 + 0.05); } else { cy('metal', 0.018, 0.018, L, gm, 0, 0.04, L / 2 + 0.05); cy('metal', 0.015, 0.015, L * 0.75, st, 0, 0.0, L * 0.4 + 0.05); }
      b('metal', 0.05, 0.08, 0.16, gm2, 0, 0.02, 0.04); if (id === 'pump') b('wood', 0.045, 0.045, 0.15, wd2, 0, 0.0, 0.3); if (id === 'assaultsg') { b('metal', 0.05, 0.05, 0.18, gm2, 0, 0.0, 0.3); mag(0.16, 0.08, 0.04); optic(0.1, 0.1, 0.08); }
      grip(0.1, 0, -0.03, id === 'assaultsg' ? gm2 : wd); stockW(id === 'sawedoff' ? 0.06 : 0.22, -0.16, id === 'assaultsg' ? gm2 : wd, 0.075); b('metal', 0.012, 0.016, 0.012, gm, 0, 0.065, L + 0.05); guard(0.0); break; }
    case 'assault': case 'carbine': case 'specialcarbine': case 'heavyrifle': {
      const hv = id === 'heavyrifle'; b('metal', 0.05, 0.085, 0.34, gm, 0, 0.03, 0.12); b('metal', 0.06, 0.07, 0.3, id === 'assault' ? wd : gm2, 0, 0.02, 0.42); cy('metal', 0.012, 0.012, 0.2, st, 0, 0.035, 0.7); cy('metal', 0.016, 0.016, 0.05, gm, 0, 0.035, 0.8);
      grip(0.1, 0, -0.04); guard(-0.02); b('metal', 0.026, 0.19, 0.05, gm, 0, -0.14, 0.17, -0.16); b('metal', 0.02, 0.05, 0.06, gm2, 0, -0.06, 0.12);
      stockW(0.26, -0.26, id === 'assault' ? wd : gm2, hv ? 0.1 : 0.085); if (id !== 'assault') optic(0.15, 0.11, 0.14); else { b('metal', 0.012, 0.03, 0.02, gm, 0, 0.1, 0.0); b('metal', 0.012, 0.025, 0.012, gm, 0, 0.09, 0.78); }
      if (hv) b('metal', 0.03, 0.04, 0.4, gm, 0, -0.04, 0.6); break; }
    case 'mg': case 'combatmg': {
      b('metal', 0.07, 0.1, 0.4, gm, 0, 0.03, 0.15); cy('metal', 0.02, 0.02, 0.5, gm2, 0, 0.04, 0.6); cy('metal', 0.034, 0.034, 0.4, gm, 0, 0.04, 0.5, 12); b('metal', 0.14, 0.12, 0.12, '#3a4a2a', 0.1, -0.04, 0.12); for (let k = 0; k < 6; k++) b('metal', 0.012, 0.012, 0.03, '#c9a24a', 0.04 + k * 0.012, -0.02 - k * 0.012, 0.12);
      grip(0.1, 0, -0.04); stockW(0.22, -0.28, id === 'mg' ? wd : gm2, 0.09); for (const sx of [-1, 1]) b('metal', 0.012, 0.18, 0.012, gm, sx * 0.04, -0.06, 0.82, 0.5 * sx * 0 + 0.35); optic(0.15, 0.1, 0.1); break; }
    case 'sniper': case 'marksman': case 'heavysniper': {
      const hv = id === 'heavysniper'; b('metal', 0.05, 0.08, 0.34, gm, 0, 0.03, 0.12); cy('metal', hv ? 0.016 : 0.012, hv ? 0.016 : 0.012, 0.55, st, 0, 0.035, 0.62); cy('metal', 0.02, 0.02, 0.06, gm, 0, 0.035, 0.92); b('metal', 0.045, 0.05, 0.3, gm2, 0, 0.0, 0.5);
      optic(0.18, 0.11, hv ? 0.3 : 0.24); for (const z of [0.1, 0.25]) b('metal', 0.012, 0.05, 0.015, gm, 0, 0.085, z); stockW(0.3, -0.3, id === 'marksman' ? wd : gm2, 0.09); b('metal', 0.045, 0.06, 0.1, gm2, 0, 0.0, -0.1); grip(0.1, 0, -0.03, gm2); b('metal', 0.02, 0.02, 0.04, st, 0.05, 0.05, 0.05); b('metal', 0.026, 0.1, 0.05, gm, 0, -0.08, 0.15);
      for (const sx of [-1, 1]) b('metal', 0.01, 0.2, 0.01, gm, sx * 0.04, -0.08, 0.72, 0.5 * 0 + 0.3); break; }
    case 'minigun': {
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; cy('metal', 0.014, 0.014, 0.55, st, Math.cos(a) * 0.045, Math.sin(a) * 0.045 + 0.03, 0.5, 8); } cy('metal', 0.075, 0.075, 0.1, gm2, 0, 0.03, 0.78, 14); cy('metal', 0.09, 0.09, 0.32, gm, 0, 0.03, 0.12, 14); b('metal', 0.16, 0.2, 0.2, '#3a4a2a', 0.0, -0.14, 0.05); cy('metal', 0.06, 0.06, 0.04, st, 0, 0.03, 0.78, 12);
      b('metal', 0.03, 0.13, 0.03, gm2, 0, -0.07, 0.2); b('metal', 0.03, 0.13, 0.03, gm2, 0, -0.07, -0.04); b('metal', 0.18, 0.02, 0.02, gm2, 0, 0.14, 0.12); break; }
    case 'grenadel': {
      cy('metal', 0.045, 0.045, 0.5, gm2, 0, 0.04, 0.4, 12); cy('metal', 0.075, 0.075, 0.14, gm, 0, 0.0, 0.1, 14); cy('metal', 0.052, 0.052, 0.06, st, 0, 0.04, 0.68, 12); grip(0.12, 0, -0.04); guard(-0.02); stockW(0.22, -0.2, gm2, 0.07); optic(0.2, 0.1, 0.08); b('metal', 0.02, 0.1, 0.03, gm, 0, -0.1, 0.45); break; }
    case 'rpg': case 'homing': {
      const hm = id === 'homing'; cy('metal', 0.065, 0.065, 0.95, hm ? '#3a4658' : '#4a5a3a', 0, 0.04, 0.22, 14); cy('metal', 0.1, 0.07, 0.22, gm2, 0, 0.04, -0.34, 14); cy('metal', 0.08, 0.08, 0.1, gm2, 0, 0.04, 0.72, 14);
      C.add('metal', new THREE.ConeGeometry(0.055, 0.2, 12), hm ? '#ffcc2a' : '#8a3a2a', [0, 0.04, 0.9], [Math.PI / 2, 0, 0]); grip(0.12, 0, 0.02); guard(0.0); b('metal', 0.03, 0.09, 0.03, gm, 0, -0.08, 0.38); optic(0.28, 0.14, hm ? 0.16 : 0.08); if (hm) { C.cyl('glow', 0.03, 0.03, 0.01, '#ff4a4a', [0, 0.14, 0.37], [Math.PI / 2, 0, 0], 8); } b('metal', 0.02, 0.07, 0.07, gm, 0, 0.11, -0.2); break; }
    case 'railgun': {
      b('metal', 0.1, 0.1, 0.4, gm2, 0, 0.03, 0.1); for (const sx of [-1, 1]) { b('glow', 0.02, 0.03, 0.7, '#3a8aff', sx * 0.04, 0.05, 0.6); b('metal', 0.015, 0.05, 0.7, '#cfd6e6', sx * 0.055, 0.04, 0.6); } for (let k = 0; k < 4; k++) b('metal', 0.14, 0.03, 0.04, gm, 0, 0.04, 0.35 + k * 0.17); grip(0.12, 0, -0.04); optic(0.05, 0.1, 0.14); b('glow', 0.05, 0.05, 0.05, '#7fd0ff', 0, 0.03, 0.97); break; }
    case 'bat': {
      cy('wood', 0.012, 0.012, 0.3, '#2a2a2a', 0, 0, 0.0); cy('wood', 0.034, 0.014, 0.42, wd2, 0, 0.0, 0.34, 12); cy('wood', 0.036, 0.034, 0.12, wd2, 0, 0.0, 0.58, 12); b('wood', 0.03, 0.03, 0.03, '#2a2a2a', 0, 0, -0.17); break; }
    case 'knife': {
      const sh = new THREE.Shape(); sh.moveTo(0, 0.0); sh.lineTo(0.2, 0.0); sh.lineTo(0.28, 0.015); sh.lineTo(0.2, 0.034); sh.lineTo(0, 0.034); sh.closePath(); const bg = new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: false }); bg.translate(0, -0.017, -0.003); bg.rotateY(-Math.PI / 2); C.add('metal', bg, '#d0d6e0', [0, 0, 0.09]);
      b('metal', 0.014, 0.016, 0.1, '#222', 0, 0, 0.0); b('metal', 0.012, 0.05, 0.015, st, 0, 0, 0.065); break; }
    case 'machete': {
      const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.5, 0); sh.lineTo(0.58, 0.045); sh.lineTo(0.5, 0.06); sh.lineTo(0, 0.05); sh.closePath(); const bg = new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: false }); bg.translate(0, -0.025, -0.003); bg.rotateY(-Math.PI / 2); C.add('metal', bg, '#cfd6e0', [0, 0, 0.1]); b('wood', 0.025, 0.03, 0.12, '#2a2a2a', 0, 0, 0.0); b('metal', 0.02, 0.06, 0.012, st, 0, 0, 0.065); break; }
    case 'hammer': {
      cy('wood', 0.016, 0.016, 0.42, wd2, 0, 0, 0.18); b('metal', 0.06, 0.05, 0.14, '#6a707c', 0, 0, 0.42); b('metal', 0.07, 0.07, 0.05, '#3a3f48', 0, 0, 0.5); break; }
    case 'crowbar': {
      cy('metal', 0.012, 0.012, 0.5, '#9a3a2a', 0, 0, 0.2); C.add('metal', new THREE.TorusGeometry(0.06, 0.012, 6, 12, Math.PI), '#9a3a2a', [0, 0.06, 0.45], [0, 0, Math.PI / 2]); b('metal', 0.03, 0.012, 0.07, '#cfd6e0', 0, 0.0, -0.08); break; }
    case 'axe': {
      cy('wood', 0.018, 0.018, 0.7, wd2, 0, 0, 0.28); const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.05, 0.1); sh.lineTo(0.2, 0.16); sh.lineTo(0.2, -0.16); sh.lineTo(0.05, -0.1); sh.closePath(); const ag = new THREE.ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: false }); ag.translate(0, 0, -0.01); ag.rotateY(Math.PI / 2); ag.rotateZ(Math.PI / 2); C.add('metal', ag, '#cfd6e0', [0, 0, 0.58]); b('metal', 0.04, 0.05, 0.1, gm, 0, 0, 0.6); break; }
    case 'grenade': {
      C.sph('metal', 0.045, '#3f5230', [0, 0.0, 0.05], [1, 1.2, 1], 10); b('metal', 0.02, 0.03, 0.035, st, 0, 0.065, 0.05); b('metal', 0.012, 0.012, 0.07, st, 0, 0.085, 0.07); C.add('metal', new THREE.TorusGeometry(0.018, 0.004, 5, 10), '#ccc', [0.0, 0.09, 0.03]); break; }
    case 'molotov': {
      cy('glass', 0.04, 0.04, 0.16, '#3a7a4a', 0, 0, 0.04, 12); cy('glass', 0.018, 0.04, 0.06, '#3a7a4a', 0, 0, 0.14, 10); cy('glass', 0.018, 0.018, 0.08, '#3a7a4a', 0, 0, 0.2, 10); b('cloth', 0.02, 0.02, 0.1, '#e8e0c8', 0, 0, 0.28); C.sph('glow', 0.03, '#ff9a2a', [0, 0.015, 0.33], [1, 1.4, 1], 8); break; }
    default: break; // こぶし
  }
  const g = C.build({ ...mats(THREE), glass: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.2, roughness: 0.1, transparent: true, opacity: 0.8 }), cloth: mats(THREE).cloth }); g.userData.id = id; return g;
}

// ---- ひと -----------------------------------------------------------------------------------------
const SKIN = ['#f3c9a5', '#e0a97d', '#c68a5c', '#8d5a3a', '#f6d6bc'];
const HAIR = ['#1a1410', '#3a2414', '#7a5030', '#c9a24a', '#8a8a8a', '#4a1a14'];
const sh = (THREE, c, f) => { const k = new THREE.Color(c); k.multiplyScalar(f); return `#${k.getHexString()}`; };
let FABRIC = null;
const fabricTex = (THREE) => FABRIC || (FABRIC = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#dcdcdc'; g.fillRect(0, 0, 128, 128);
  let a = 17; const r = () => { a = (a * 1664525 + 1013904223) % 4294967296; return a / 4294967296; };
  for (let i = 0; i < 3000; i++) { const v = 150 + r() * 100; g.fillStyle = `rgba(${v},${v},${v},.5)`; g.fillRect(r() * 128, r() * 128, 1 + r() * 2, 1 + r() * 2); }
  g.strokeStyle = 'rgba(0,0,0,.07)'; g.lineWidth = 1; for (let i = 0; i < 128; i += 3) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke(); }
  g.strokeStyle = 'rgba(0,0,0,.12)'; for (let i = 0; i < 9; i++) { const y = r() * 128; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(40, y + 6, 90, y - 6, 128, y + 2); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(2, 2); t.anisotropy = 4; return t;
})());
const FACEMAT = new Map();
function faceMat(THREE, skin, hair, stubble, brow) {
  const key = `${skin}|${hair}|${stubble ? 1 : 0}|${brow}`; if (FACEMAT.has(key)) return FACEMAT.get(key);
  const c = document.createElement('canvas'); c.width = 128; c.height = 128; const g = c.getContext('2d'); const base = new THREE.Color(skin); const px = `#${base.getHexString()}`;
  g.fillStyle = px; g.fillRect(0, 0, 128, 128);
  const shade = (f) => `#${new THREE.Color(skin).multiplyScalar(f).getHexString()}`;
  // ほお・めのまわりの かげ
  const rg = g.createRadialGradient(64, 66, 10, 64, 66, 70); rg.addColorStop(0, 'rgba(255,255,255,.08)'); rg.addColorStop(1, 'rgba(0,0,0,.22)'); g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
  g.fillStyle = shade(0.82); g.beginPath(); g.ellipse(40, 58, 15, 7, 0, 0, 6.283); g.ellipse(88, 58, 15, 7, 0, 0, 6.283); g.fill(); // めの くぼみ
  for (const ex of [40, 88]) { g.fillStyle = '#f4f1ea'; g.beginPath(); g.ellipse(ex, 60, 11, 6.5, 0, 0, 6.283); g.fill(); g.fillStyle = '#4a3220'; g.beginPath(); g.arc(ex + (ex < 64 ? 1 : -1), 60, 4.8, 0, 6.283); g.fill(); g.fillStyle = '#0a0a0a'; g.beginPath(); g.arc(ex + (ex < 64 ? 1 : -1), 60, 2.4, 0, 6.283); g.fill(); g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(ex - 2, 57, 2, 2); g.strokeStyle = shade(0.55); g.lineWidth = 1.6; g.beginPath(); g.ellipse(ex, 60, 11, 6.5, 0, 3.3, 6.1); g.stroke(); }
  g.strokeStyle = brow; g.lineWidth = 4.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(26, 46); g.quadraticCurveTo(40, 40, 54, 46); g.moveTo(74, 46); g.quadraticCurveTo(88, 40, 102, 46); g.stroke();
  g.strokeStyle = shade(0.7); g.lineWidth = 2; g.beginPath(); g.moveTo(64, 56); g.lineTo(61, 84); g.quadraticCurveTo(64, 88, 69, 84); g.stroke(); // はな
  g.strokeStyle = '#7a3a3a'; g.lineWidth = 3; g.beginPath(); g.moveTo(48, 102); g.quadraticCurveTo(64, 108, 80, 102); g.stroke(); g.strokeStyle = shade(0.6); g.lineWidth = 1.5; g.beginPath(); g.moveTo(52, 100); g.quadraticCurveTo(64, 96, 76, 100); g.stroke();
  if (stubble) { for (let i = 0; i < 700; i++) { const x = 20 + Math.random() * 88; const y = 78 + Math.random() * 46; const dd = Math.hypot(x - 64, y - 100); if (dd > 52) continue; g.fillStyle = 'rgba(30,24,20,.35)'; g.fillRect(x, y, 1.4, 1.4); } }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.78, metalness: 0 }); FACEMAT.set(key, m); return m;
}
export function makePerson(THREE, o = {}) {
  const skin = o.skin || SKIN[0]; const shirt = o.shirt || '#4a6fa5'; const pants = o.pants || '#2a3042'; const hair = o.hair || HAIR[0]; const jacketC = o.jacket ? (o.jacketColor || shirt) : null; const shoeC = o.shoe || '#17181c'; const top = jacketC || shirt;
  const root = new THREE.Group(); const m = mats(THREE); const mkMesh = (C) => C.build(m, true); const S = (c, f) => sh(THREE, c, f);
  const pivot = (x, y, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); return g; };
  const boots = o.boots != null ? o.boots : !!o.cargo;
  // ------ こし(ズボン・ベルト)
  const hips = new THREE.Group(); hips.position.set(0, 0.92, 0); root.add(hips);
  { const C = collector(THREE); C.cyl('cloth', 0.178, 0.205, 0.22, pants, [0, 0.0, 0], [0, 0, 0], 16); C.cyl('cloth', 0.19, 0.19, 0.045, '#1b1c20', [0, 0.12, 0], [0, 0, 0], 16); C.box('metal', 0.05, 0.04, 0.012, '#c9a24a', [0, 0.12, 0.2]);
    for (const sx of [-1, 1]) { C.box('cloth', 0.018, 0.06, 0.012, '#1b1c20', [sx * 0.1, 0.12, 0.19]); C.box('cloth', 0.085, 0.07, 0.02, S(pants, 0.82), [sx * 0.08, -0.02, -0.205]); } C.box('cloth', 0.006, 0.12, 0.012, S(pants, 0.7), [0, 0.0, 0.205]);
    if (o.cargo) for (const sx of [-1, 1]) C.box('cloth', 0.04, 0.12, 0.1, S(pants, 0.88), [sx * 0.2, -0.06, 0.02]);
    const hg = mkMesh(C); hg.children.forEach((mm) => { mm.scale.z = 0.7; }); hips.add(hg); }
  // ------ むね・うで・あたま
  const torso = pivot(0, 0.98, 0); root.add(torso);
  { const C = collector(THREE);
    C.add('cloth', new THREE.CylinderGeometry(0.188, 0.172, 0.24, 18), top, [0, 0.13, 0]); C.add('cloth', new THREE.CylinderGeometry(0.215, 0.19, 0.32, 18), top, [0, 0.4, 0]);
    C.add('cloth', new THREE.CylinderGeometry(0.195, 0.195, 0.06, 18), S(top, 0.85), [0, 0.0, 0]); // すそ
    for (const sx of [-1, 1]) { C.sph('cloth', 0.072, top, [sx * 0.2, 0.5, 0], [1, 1.05, 1], 12); C.box('cloth', 0.02, 0.34, 0.2, S(top, 0.9), [sx * 0.205, 0.33, -0.01]); }
    if (o.vest) { C.add('cloth', new THREE.CylinderGeometry(0.23, 0.205, 0.36, 18), o.vest, [0, 0.35, 0]); C.box('metal', 0.1, 0.1, 0.05, '#2a2d34', [0, 0.3, 0.19]); for (const sx of [-1, 1]) C.box('cloth', 0.08, 0.1, 0.05, S(o.vest, 0.8), [sx * 0.1, 0.2, 0.195]); }
    if (jacketC) { C.box('metal', 0.01, 0.46, 0.012, '#2a2a2e', [0, 0.28, 0.205]); for (let i = 0; i < 7; i++) C.box('metal', 0.014, 0.012, 0.014, '#9a9a9a', [0, 0.06 + i * 0.065, 0.208]); for (const sx of [-1, 1]) { C.box('cloth', 0.09, 0.09, 0.02, S(top, 0.78), [sx * 0.105, 0.12, 0.2]); C.box('cloth', 0.06, 0.012, 0.022, S(top, 1.15), [sx * 0.105, 0.17, 0.205]); C.box('cloth', 0.12, 0.018, 0.02, S(top, 0.7), [sx * 0.1, 0.5, 0.195]); } C.box('cloth', 0.2, 0.04, 0.2, S(shirt, 1), [0, 0.54, 0.02]); }
    else { for (const sx of [-1, 1]) C.box('cloth', 0.12, 0.012, 0.02, S(top, 0.75), [sx * 0.1, 0.46, 0.2]); C.box('cloth', 0.22, 0.012, 0.012, S(top, 0.8), [0, 0.62, 0.17]); }
    if (o.tie) { C.box('cloth', 0.045, 0.26, 0.015, o.tie, [0, 0.36, 0.215]); C.box('cloth', 0.06, 0.05, 0.02, S(o.tie, 0.85), [0, 0.5, 0.215]); }
    C.cyl('skin', 0.052, 0.062, 0.12, skin, [0, 0.6, 0], [0, 0, 0], 12); C.add('cloth', new THREE.TorusGeometry(0.08, 0.026, 8, 16), o.collar || S(top, 1.1), [0, 0.575, -0.005], [Math.PI / 2, 0, 0]);
    if (jacketC) for (const sx of [-1, 1]) C.box('cloth', 0.07, 0.06, 0.03, S(top, 1.12), [sx * 0.07, 0.55, 0.16], [0.5, 0, sx * 0.4]);
    if (o.bag) { C.box('cloth', 0.34, 0.38, 0.15, o.bag, [0, 0.36, -0.21]); C.box('cloth', 0.3, 0.12, 0.16, S(o.bag, 0.82), [0, 0.22, -0.21]); for (const sx of [-1, 1]) C.box('cloth', 0.045, 0.42, 0.02, S(o.bag, 0.7), [sx * 0.12, 0.38, 0.115]); }
    if (o.sash) C.box('cloth', 0.05, 0.5, 0.01, o.sash, [0, 0.35, 0.215], [0, 0, 0.7]);
    const tg = mkMesh(C); tg.children.forEach((mm) => { if (mm.material === m.cloth) mm.scale.z = 0.68; }); torso.add(tg); }
  // ------ あたま
  const head = pivot(0, 0.69, 0); head.scale.setScalar(1.3); torso.add(head);
  { const C = collector(THREE); const hs = hair;
    C.sph('skin', 0.102, skin, [0, 0.06, 0], [0.9, 1.12, 1.0], 20); C.box('skin', 0.15, 0.07, 0.12, skin, [0, -0.03, 0.03]); C.sph('skin', 0.055, skin, [0, -0.04, 0.06], [1.15, 0.85, 1], 12);
    C.box('skin', 0.17, 0.025, 0.05, S(skin, 0.94), [0, 0.095, 0.085]); C.box('skin', 0.022, 0.07, 0.03, skin, [0, 0.05, 0.1]); C.sph('skin', 0.02, skin, [0, 0.022, 0.112], [1.15, 0.9, 1], 8);
    C.box('cloth', 0.05, 0.012, 0.014, '#a05a5a', [0, -0.012, 0.105]); C.box('cloth', 0.04, 0.012, 0.014, '#8a4a4a', [0, -0.026, 0.1]);
    for (const sx of [-1, 1]) { C.sph('skin', 0.026, skin, [sx * 0.094, 0.06, 0], [0.5, 1.05, 0.8], 10); C.sph('skin', 0.028, S(skin, 0.97), [sx * 0.07, 0.02, 0.078], [1, 0.8, 0.7], 8); }
    const style = o.hairStyle == null ? 0 : o.hairStyle;
    if (!o.helmet && !o.cap && !o.hat) {
      if (style !== 4) { C.add('cloth', new THREE.SphereGeometry(0.108, 18, 12, 0, 6.283, 0, 1.2), hs, [0, 0.07, -0.012], [0, 0, 0], [0.95, 1.12, 1.06]); C.box('cloth', 0.18, 0.13, 0.06, hs, [0, 0.03, -0.085]); for (const sx of [-1, 1]) C.box('cloth', 0.014, 0.075, 0.04, hs, [sx * 0.098, 0.075, -0.03]); C.box('cloth', 0.16, 0.025, 0.02, hs, [0, 0.128, 0.078]); }
      if (style === 2) { C.box('cloth', 0.2, 0.24, 0.06, hs, [0, -0.02, -0.085]); for (const sx of [-1, 1]) C.box('cloth', 0.04, 0.2, 0.08, hs, [sx * 0.1, -0.02, -0.03]); }
      if (style === 3) C.cyl('cloth', 0.028, 0.02, 0.22, hs, [0, -0.05, -0.13], [0.3, 0, 0], 8);
      if (style === 5) for (let k = 0; k < 8; k++) C.sph('cloth', 0.042, hs, [Math.cos(k) * 0.075, 0.14 + (k % 2) * 0.012, Math.sin(k) * 0.075 - 0.02], [1, 1, 1], 8);
      if (style === 1) { C.box('cloth', 0.13, 0.035, 0.03, hs, [0.03, 0.125, 0.095]); C.box('cloth', 0.06, 0.04, 0.025, hs, [-0.05, 0.12, 0.1]); }
    }
    if (o.helmet) { C.add('paint', new THREE.SphereGeometry(0.135, 20, 14, 0, 6.283, 0, 2.15), o.helmet, [0, 0.06, -0.005], [0, 0, 0], [0.98, 1.0, 1.1]); C.box('glass', 0.17, 0.05, 0.03, '#12213a', [0, 0.075, 0.125]); }
    else if (o.cap) { C.add('cloth', new THREE.SphereGeometry(0.116, 16, 10, 0, 6.283, 0, 1.5), o.cap, [0, 0.085, 0], [0, 0, 0], [0.95, 1.0, 1.03]); C.box('cloth', 0.16, 0.014, 0.11, o.cap, [0, 0.082, 0.135], [0.1, 0, 0]); }
    else if (o.hat) C.add('cloth', new THREE.CylinderGeometry(0.1, 0.108, 0.07, 14), o.hat, [0, 0.14, 0]);
    if (o.mask) { C.add('cloth', new THREE.SphereGeometry(0.11, 14, 10, 0, 6.283, 1.28, 1.15), '#101010', [0, 0.04, 0.008], [0, 0, 0], [0.93, 1.1, 1.04]); for (const sx of [-1, 1]) C.box('light', 0.034, 0.014, 0.012, '#ffffff', [sx * 0.037, 0.082, 0.1]); }
    if (o.glasses) { C.box('glass', 0.15, 0.034, 0.02, '#101418', [0, 0.078, 0.104]); C.box('metal', 0.17, 0.006, 0.01, '#222', [0, 0.095, 0.1]); }
    if (o.beard) C.add('cloth', new THREE.SphereGeometry(0.104, 12, 8, 0, 6.283, 1.5, 0.9), hs, [0, 0.02, 0.012], [0, 0, 0], [0.92, 1.1, 1.02]);
    head.add(mkMesh(C));
    // かお(めと はなと くちの テクスチャ)
    const fc = new THREE.Mesh(new THREE.CylinderGeometry(0.109, 0.109, 0.135, 20, 1, true, -0.95, 1.9), faceMat(THREE, skin, hs, o.stubble || o.beard, S(hs, 0.9))); fc.position.set(0, 0.0675, 0); fc.scale.set(0.9, 1.0, 1.02); head.add(fc); }
  const arm = (sx) => {
    const shp = pivot(sx * 0.2, 0.5, 0); torso.add(shp); const long = !o.shortSleeve;
    { const C = collector(THREE); C.add('cloth', new THREE.CylinderGeometry(0.052, 0.046, 0.3, 14), top, [0, -0.145, 0]); C.add('cloth', new THREE.CylinderGeometry(0.058, 0.058, 0.02, 14), S(top, 0.8), [0, -0.012, 0]); if (!long) C.add('skin', new THREE.CylinderGeometry(0.048, 0.045, 0.1, 12), skin, [0, -0.25, 0]); shp.add(mkMesh(C)); }
    const el = pivot(0, -0.29, 0); shp.add(el);
    { const C = collector(THREE); C.add(long ? 'cloth' : 'skin', new THREE.CylinderGeometry(0.047, 0.037, 0.26, 12), long ? top : skin, [0, -0.13, 0]); if (long) { C.add('cloth', new THREE.CylinderGeometry(0.045, 0.045, 0.03, 12), S(top, 0.78), [0, -0.255, 0]); C.box('cloth', 0.07, 0.01, 0.07, S(top, 0.75), [0, -0.01, -0.01]); }
      C.box('skin', 0.075, 0.09, 0.036, skin, [0, -0.315, 0.0]); for (let f = 0; f < 4; f++) C.box('skin', 0.015, 0.06, 0.016, S(skin, 0.97), [-0.027 + f * 0.018, -0.385, 0.012], [0.28, 0, 0]); C.box('skin', 0.018, 0.05, 0.02, S(skin, 0.97), [-sx * 0.04, -0.33, 0.022], [0.3, 0, -sx * 0.5]); el.add(mkMesh(C)); }
    const hand = pivot(0, -0.31, 0.01); hand.rotation.x = Math.PI / 2; el.add(hand);
    return { sh: shp, el, hand };
  };
  const aL = arm(-1); const aR = arm(1);
  const leg = (sx) => {
    const hp = pivot(sx * 0.092, 0, 0); hips.add(hp);
    { const C = collector(THREE); C.add('cloth', new THREE.CylinderGeometry(0.093, 0.07, 0.46, 14), pants, [0, -0.22, 0]); C.box('cloth', 0.025, 0.1, 0.05, S(pants, 0.82), [sx * 0.085, -0.2, 0.04]); if (o.cargo) { C.box('cloth', 0.04, 0.15, 0.115, S(pants, 0.9), [sx * 0.09, -0.2, 0.01]); C.box('cloth', 0.042, 0.022, 0.118, S(pants, 0.7), [sx * 0.09, -0.135, 0.01]); } hp.add(mkMesh(C)); }
    const kn = pivot(0, -0.45, 0); hp.add(kn);
    { const C = collector(THREE); C.add('cloth', new THREE.CylinderGeometry(0.071, 0.056, 0.42, 14), pants, [0, -0.21, 0]); C.sph('cloth', 0.06, S(pants, 0.86), [0, 0.0, 0.03], [1, 0.8, 0.8], 10);
      if (boots) { C.add('cloth', new THREE.CylinderGeometry(0.066, 0.06, 0.2, 14), shoeC, [0, -0.31, 0]); C.box('cloth', 0.115, 0.075, 0.27, shoeC, [0, -0.42, 0.065]); C.sph('cloth', 0.056, shoeC, [0, -0.415, 0.19], [1.02, 0.78, 1.05], 10); C.box('cloth', 0.12, 0.035, 0.3, o.sole || '#2a2420', [0, -0.465, 0.07]); C.box('cloth', 0.1, 0.05, 0.05, '#2a2420', [0, -0.44, -0.07]); for (let i = 0; i < 4; i++) C.box('cloth', 0.06, 0.008, 0.012, '#c9c3b0', [0, -0.395 + i * 0.012, 0.14 - i * 0.012]); }
      else { C.box('cloth', 0.108, 0.07, 0.26, shoeC, [0, -0.42, 0.06]); C.sph('cloth', 0.054, shoeC, [0, -0.415, 0.185], [1.0, 0.75, 1.05], 10); C.box('cloth', 0.115, 0.032, 0.29, o.sole || '#e8e8ee', [0, -0.462, 0.065]); }
      kn.add(mkMesh(C)); }
    return { hp, kn };
  };
  const lL = leg(-1); const lR = leg(1);
  let gun = null; if (o.weapon) { gun = makeWeaponModel(THREE, o.weapon); aR.hand.add(gun); }
  const u = { legL: lL.hp, legR: lR.hp, kneeL: lL.kn, kneeR: lR.kn, armL: aL.sh, armR: aR.sh, elbowL: aL.el, elbowR: aR.el, handR: aR.hand, handL: aL.hand, head, torso, hips, gun, sit: !!o.sit };
  if (o.sit) { lL.hp.rotation.x = -1.25; lR.hp.rotation.x = -1.25; torso.rotation.x = 0.28; aL.sh.rotation.x = -1.0; aR.sh.rotation.x = -1.0; }
  root.userData = u; poseLimbs(u);
  root.scale.setScalar(o.scale || 1);
  root.traverse((mm) => { if (mm.isMesh) mm.castShadow = true; });
  return root;
}
// てあしを じゅんばんに まげる(ひざ・ひじ)。からだの うごきの あとに よぶ
export function poseLimbs(u) {
  const knee = (leg, kn) => { kn.rotation.x = u.sit ? 1.35 : Math.max(0, leg.rotation.x * 1.25) + (leg.rotation.x < 0 ? 0.06 : 0); };
  knee(u.legL, u.kneeL); knee(u.legR, u.kneeR);
  const elb = (a, e, extra = 0) => { e.rotation.x = -0.16 + Math.min(0, a.rotation.x) * 0.38 + extra; };
  elb(u.armL, u.elbowL); elb(u.armR, u.elbowR);
}
// ひとの いろいろ(id から きまる)
const SHIRTS = ['#c9473a', '#3a78c9', '#e0b12a', '#4aa86a', '#8a5ac9', '#e8e8ee', '#d8789a', '#2a8a9a', '#e07a3a', '#56606e'];
const PANTS = ['#2a3042', '#3a3a44', '#5a4a3a', '#2a4a6a', '#20242c', '#6a6a72', '#7a6a58'];
export function townsPerson(THREE, id) {
  const r = (n) => { let a = (id * 2654435761 + n * 40503) >>> 0; a = (a ^ (a >>> 13)) >>> 0; a = Math.imul(a, 1274126177) >>> 0; return (a & 0xffff) / 0xffff; };
  const pick = (arr, n) => arr[Math.floor(r(n) * arr.length) % arr.length]; const kind = r(1); const type = r(9);
  const kid = type < 0.15; const biz = type > 0.8;
  return makePerson(THREE, { skin: pick(SKIN, 2), shirt: biz ? '#e8eaf0' : pick(SHIRTS, 3), pants: biz ? '#2a2f3a' : pick(PANTS, 4), hair: pick(HAIR, 5), hairStyle: Math.floor(r(6) * 6), jacket: biz || r(10) > 0.72, jacketColor: biz ? '#2a2f3a' : pick(PANTS, 11), tie: biz ? pick(SHIRTS, 12) : null, cap: kind < 0.12 ? pick(SHIRTS, 6) : null, boots: r(15) > 0.6, cargo: r(16) > 0.75, stubble: !kid && r(17) > 0.7, bag: kid || kind > 0.8 ? pick(PANTS, 7) : null, glasses: r(13) > 0.85, shortSleeve: r(14) > 0.55, scale: kid ? 0.72 : 0.92 + r(8) * 0.14, sole: '#e8e8ee' });
}
export function crookPerson(THREE, type, id) {
  const base = { thug: { shirt: '#3a3d47', jacket: true, jacketColor: '#2a2d36', pants: '#2f3a2a', cargo: true, boots: true, shoe: '#3a2a1a', cap: '#1a1a1e', weapon: 'pistol', stubble: true }, gunman: { shirt: '#262a33', pants: '#16181d', cargo: true, boots: true, mask: true, vest: '#3a3f46', hair: '#1a1410', weapon: 'smg', jacket: true, jacketColor: '#20242c' }, boss: { shirt: '#8a1f2a', jacket: true, jacketColor: '#14161a', pants: '#14161a', boots: true, shoe: '#2a1a12', hair: '#1a1410', weapon: 'pump', vest: '#8a6a2a', glasses: true, tie: '#c9a24a', beard: true, scale: 1.1 }, runner: { shirt: '#c9843a', pants: '#2a2e38', cap: '#222', bag: '#c0292a', jacket: true, jacketColor: '#c9843a' } }[type] || {};
  return makePerson(THREE, { skin: SKIN[id % SKIN.length], hairStyle: id % 6, ...base });
}

// なまえと けんしょう金の ふだ
export function labelSprite(THREE, text, sub, color = '#ffd23f', w = 320) {
  const c = document.createElement('canvas'); c.width = w; c.height = 112; const g = c.getContext('2d');
  g.fillStyle = 'rgba(10,14,30,.78)'; const r = 18; g.beginPath(); g.moveTo(r, 4); g.lineTo(w - r, 4); g.quadraticCurveTo(w - 4, 4, w - 4, r); g.lineTo(w - 4, 108 - r); g.quadraticCurveTo(w - 4, 108, w - r, 108); g.lineTo(r, 108); g.quadraticCurveTo(4, 108, 4, 108 - r); g.lineTo(4, r); g.quadraticCurveTo(4, 4, r, 4); g.fill(); g.strokeStyle = color; g.lineWidth = 4; g.stroke();
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.font = 'bold 40px sans-serif'; g.fillText(text, w / 2, 36); g.fillStyle = color; g.font = 'bold 34px sans-serif'; g.fillText(sub, w / 2, 80);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); s.renderOrder = 22; s.scale.set(w / 52, 112 / 52, 1); s.userData.sub = sub; return s;
}
