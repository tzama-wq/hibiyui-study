// 「そらの まもり」の きたいの 3Dモデル(しゅじんこうの いろ + ぶひん(ガチャの キャラ)の レアど・いろで みためが かわる)
//   makeVehicleModel(THREE, spec)  spec = { vehicle, color, parts: { gun, missile, mobility, support, armor }, missiles }
//   parts[slot] = { rarity, charId, fit, power }。ぶひんが なければ ふつうの 「きほんの ぶひん」
const RANK = { common: 0, uncommon: 1, rare: 2, super: 3, legend: 4, diamond: 5 };
const rk = (part) => (part ? RANK[part.rarity] ?? 0 : 0);
const hashStr = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const RARITY_COLOR = ['#9aa7bf', '#6fd69a', '#5aa8ff', '#b88aff', '#ffa83a', '#9ff3ff'];
// ぶひんの いろ: キャラごとに ちがう いろあい(レアどが たかいほど あざやか)
export function partColor(part, fallback = '#aab6cc') {
  if (!part) return fallback; const h = hashStr(part.charId) % 360; const r = rk(part);
  return `hsl(${h}, ${35 + r * 11}%, ${58 - r * 3}%)`;
}
const glowOf = (part) => (part && rk(part) >= 4 ? RARITY_COLOR[rk(part)] : null);

function mats(THREE) {
  const cache = new Map();
  const m = (color, emissive = 0x000000, extra = {}) => { const k = `${color}|${emissive}|${JSON.stringify(extra)}`; if (!cache.has(k)) cache.set(k, new THREE.MeshLambertMaterial({ color, emissive, ...extra })); return cache.get(k); };
  return m;
}
const add = (THREE, g, geo, mat, x = 0, y = 0, z = 0, rot) => { const mesh = new THREE.Mesh(geo, mat); mesh.position.set(x, y, z); if (rot) mesh.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0); g.add(mesh); return mesh; };
const flatShape = (THREE, pts, depth, mat) => { const sh = new THREE.Shape(); pts.forEach(([x, z], i) => (i ? sh.lineTo(x, z) : sh.moveTo(x, z))); const geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false }); geo.rotateX(Math.PI / 2); geo.translate(0, depth / 2, 0); return new THREE.Mesh(geo, mat); };

// ---- ひこうき(+z が まえ) --------------------------------------------------------
const WING = [
  [[0, 2], [7.5, 2], [7.5, -1.5], [0, -2.5]],
  [[0, 3], [8, -1], [8, -3], [0, -3]],
  [[0, 4], [9, -3.5], [0, -3.5]],
  [[0, 4], [6, -1], [9, -4], [0, -4]],
  [[0, 0], [8, 3], [8, 1], [0, -3]],
  [[0, 5], [5, 0], [10, -4.5], [0, -4.5]],
];
function planeModel(THREE, spec) {
  const m = mats(THREE); const g = new THREE.Group(); const P = spec.parts || {}; const body = spec.color || '#4aa3ff';
  const ar = rk(P.armor); const fus = add(THREE, g, new THREE.ConeGeometry(1.5 + ar * 0.1, 14, 10), m(body), 0, 0, 0, [Math.PI / 2, 0, 0]);
  for (let i = 0; i < ar; i++) add(THREE, g, new THREE.BoxGeometry(0.5, 0.5, 3), m(partColor(P.armor), glowOf(P.armor) ? 0x222222 : 0), (i % 2 ? 1 : -1) * 1.05, 0.2, -1 + Math.floor(i / 2) * 2.4);
  add(THREE, g, new THREE.SphereGeometry(0.95, 10, 8), m('#2a4a7a', 0x112244), 0, 0.9, 1.2).scale.set(1, 0.7, 2);
  // つばさ(mobility)
  const wc = partColor(P.mobility, '#e8eefc'); const wv = Math.min(5, rk(P.mobility)); const pts = WING[wv];
  const wR = flatShape(THREE, pts, 0.35, m(wc, glowOf(P.mobility) ? 0x1a1a1a : 0)); wR.position.set(0.9, 0, -0.5); g.add(wR);
  const wL = flatShape(THREE, pts.map(([x, z]) => [-x, z]), 0.35, m(wc, glowOf(P.mobility) ? 0x1a1a1a : 0)); wL.position.set(-0.9, 0, -0.5); g.add(wL);
  if (glowOf(P.mobility)) for (const s of [-1, 1]) add(THREE, g, new THREE.BoxGeometry(0.2, 0.12, 6), new THREE.MeshBasicMaterial({ color: glowOf(P.mobility) }), s * (4.5 + wv * 0.3), 0.25, -1.2);
  // びよく(support)
  const tc = partColor(P.support, body); const tv = Math.min(5, rk(P.support)); const tm = m(tc, glowOf(P.support) ? 0x1a1a1a : 0);
  add(THREE, g, new THREE.BoxGeometry(5.6, 0.3, 2.2), m('#e8eefc'), 0, 0, -5.4);
  if (tv === 0) add(THREE, g, new THREE.BoxGeometry(0.3, 2.6, 2.4), tm, 0, 1.5, -5.3);
  else if (tv === 1) for (const s of [-1, 1]) add(THREE, g, new THREE.BoxGeometry(0.3, 2.6, 2.4), tm, s * 1.5, 1.5, -5.3);
  else if (tv === 2) for (const s of [-1, 1]) add(THREE, g, new THREE.BoxGeometry(0.3, 3, 2.4), tm, s * 1.2, 1.3, -5.3, [0, 0, s * -0.55]);
  else if (tv === 3) for (const s of [-1, 1]) add(THREE, g, new THREE.BoxGeometry(0.3, 3.4, 3), tm, s * 1.7, 1.5, -5.3, [0, 0, s * -0.25]);
  else { for (const s of [-1, 1]) add(THREE, g, new THREE.BoxGeometry(0.3, 3.2 + (tv - 4) * 0.8, 3.2), tm, s * 1.6, 1.5, -5.3, [0, 0, s * -0.6]); add(THREE, g, new THREE.BoxGeometry(0.3, 2, 3.6), tm, 0, 1.2, -5.2); }
  // きかんじゅう(gun): ばんすう=レアど
  const gr = rk(P.gun); const nb = [1, 2, 2, 3, 4, 4][gr]; const gc = partColor(P.gun, '#555a66');
  for (let i = 0; i < nb; i++) { const x = (i % 2 ? 1 : -1) * (0.9 + Math.floor(i / 2) * 0.7); add(THREE, g, new THREE.CylinderGeometry(0.16, 0.2, 4 + gr * 0.8, 6), m(gc), x, -0.5, 5.2, [Math.PI / 2, 0, 0]); add(THREE, g, new THREE.SphereGeometry(0.22, 6, 4), glowOf(P.gun) ? new THREE.MeshBasicMaterial({ color: glowOf(P.gun) }) : m('#222'), x, -0.5, 7.4 + gr * 0.4); }
  // ミサイル(missile): パイロンの かず
  const mc = Math.max(2, Math.min(10, 2 + Math.floor((spec.missiles || 4) / 2))); const mcol = partColor(P.missile, '#e8eefc');
  for (let i = 0; i < mc; i++) { const s = i % 2 ? 1 : -1; const x = s * (2.2 + Math.floor(i / 2) * 1.15); add(THREE, g, new THREE.CylinderGeometry(0.22, 0.22, 3.4, 6), m(mcol), x, -0.55, -0.4, [Math.PI / 2, 0, 0]); add(THREE, g, new THREE.ConeGeometry(0.22, 0.8, 6), m('#ff4d5e'), x, -0.55, 1.6, [Math.PI / 2, 0, 0]); }
  const flame = add(THREE, g, new THREE.ConeGeometry(0.9, 4, 6), new THREE.MeshBasicMaterial({ color: '#7fe7ff', transparent: true, opacity: 0.85 }), 0, 0, -8.6, [-Math.PI / 2, 0, 0]); g.userData.flame = flame; void fus;
  return g;
}

// ---- ふね ----------------------------------------------------------------------------
function shipModel(THREE, spec) {
  const m = mats(THREE); const g = new THREE.Group(); const P = spec.parts || {}; const body = spec.color || '#4aa3ff';
  const mv = rk(P.mobility); const len = 38 * (1 + mv * 0.06); const ar = rk(P.armor); const armC = partColor(P.armor, '#7b8aa0');
  add(THREE, g, new THREE.BoxGeometry(10 + ar * 0.5, 4 + ar * 0.4, len), m('#5c6e86'), 0, 2, 0);
  const bow = add(THREE, g, new THREE.ConeGeometry(5.6 + ar * 0.25, 10, 4), m('#5c6e86'), 0, 2, len / 2 + 4, [Math.PI / 2, Math.PI / 4, 0]); bow.scale.set(1, 1, 0.55);
  for (let i = 0; i < 2 + ar; i++) for (const s of [-1, 1]) add(THREE, g, new THREE.BoxGeometry(0.5, 2.4 + ar * 0.2, 5), m(armC, glowOf(P.armor) ? 0x1a1a1a : 0), s * (5.3 + ar * 0.25), 2.4, -len / 2 + 5 + i * (len - 10) / Math.max(1, 1 + ar));
  add(THREE, g, new THREE.BoxGeometry(8, 0.5, len - 2), m(body), 0, 4.3 + ar * 0.2, 0);
  add(THREE, g, new THREE.BoxGeometry(6, 4.5, 9), m(body), 0, 7, -6); add(THREE, g, new THREE.BoxGeometry(4, 3, 5), m('#e8eefc'), 0, 10.5, -6);
  for (let i = 0; i < Math.min(4, 2 + (mv >= 3 ? 1 : 0) + (mv >= 5 ? 1 : 0)); i++) { const x = (i % 2 ? 1 : -1) * 2.2; add(THREE, g, new THREE.CylinderGeometry(0.9, 0.9, 1.2, 8), m(partColor(P.mobility, '#333')), x, 0.8, -len / 2 - 0.4, [Math.PI / 2, 0, 0]); }
  // しゅほう(turrets: まわる)
  g.userData.turrets = []; const gr = rk(P.gun); const nt = 1 + (gr >= 2 ? 1 : 0) + (gr >= 4 ? 1 : 0); const gc = partColor(P.gun, '#555a66');
  for (let t = 0; t < nt; t++) { const tg = new THREE.Group(); tg.position.set(0, 5.4 + ar * 0.2, [len / 2 - 6, -len / 2 + 7, 4][t]); add(THREE, tg, new THREE.CylinderGeometry(2.6, 3, 2, 10), m(gc)); const nb = gr >= 3 ? 2 : 1; for (let b = 0; b < nb; b++) add(THREE, tg, new THREE.CylinderGeometry(0.34 + gr * 0.04, 0.4 + gr * 0.04, 8 + gr * 1.5, 6), m('#333a46'), (b - (nb - 1) / 2) * 1.4, 0.4, 5.4 + gr * 0.6, [Math.PI / 2, 0, 0]); if (glowOf(P.gun)) add(THREE, tg, new THREE.SphereGeometry(0.6, 6, 4), new THREE.MeshBasicMaterial({ color: glowOf(P.gun) }), 0, 1.4, 0); g.add(tg); g.userData.turrets.push(tg); }
  // ミサイル(VLS)
  const nm = 4 + rk(P.missile) * 3; const mcol = partColor(P.missile, '#7b8aa0');
  for (let i = 0; i < nm; i++) add(THREE, g, new THREE.BoxGeometry(1.5, 0.7, 1.5), m(mcol), ((i % 3) - 1) * 1.9, 4.9 + ar * 0.2, 6 + Math.floor(i / 3) * 1.9 - 12);
  // レーダー(support)
  const sv = rk(P.support); const rc = partColor(P.support, '#e8eefc'); const rad = new THREE.Group(); rad.position.set(0, 14, -6);
  add(THREE, rad, new THREE.CylinderGeometry(0.2, 0.2, 5, 5), m('#ccd'), 0, 0, 0);
  if (sv === 0) add(THREE, rad, new THREE.BoxGeometry(3, 0.3, 0.3), m(rc), 0, 2.6, 0);
  else if (sv === 1) add(THREE, rad, new THREE.CylinderGeometry(2.4, 0.2, 1.2, 10), m(rc), 0, 2.8, 0);
  else if (sv === 2) add(THREE, rad, new THREE.BoxGeometry(6, 0.4, 0.6), m(rc), 0, 2.8, 0);
  else if (sv === 3) add(THREE, rad, new THREE.SphereGeometry(2.2, 10, 8), m(rc), 0, 3, 0);
  else { for (const s of [-1, 1]) add(THREE, rad, new THREE.BoxGeometry(0.4, 4, 4), m(rc, glowOf(P.support) ? 0x222222 : 0), s * 1.6, 3.2, 0); }
  g.add(rad); g.userData.radar = rad; g.userData.len = len;
  return g;
}

// ---- せんしゃ ------------------------------------------------------------------------
function tankModel(THREE, spec) {
  const m = mats(THREE); const g = new THREE.Group(); const P = spec.parts || {}; const body = spec.color || '#4aa3ff';
  const mv = rk(P.mobility); const tw = 2.2 + mv * 0.25; const ar = rk(P.armor); const armC = partColor(P.armor, '#6b7788'); const tc = partColor(P.mobility, '#2a2e36');
  for (const s of [-1, 1]) { add(THREE, g, new THREE.BoxGeometry(tw, 2.4, 15), m('#22262e'), s * 4.6, 1.3, 0); const nw = 5 + Math.min(3, mv); for (let i = 0; i < nw; i++) add(THREE, g, new THREE.CylinderGeometry(1.1, 1.1, tw + 0.3, 10), m(tc), s * 4.6, 1.2, -6 + i * (12 / (nw - 1)), [0, 0, Math.PI / 2]); }
  add(THREE, g, new THREE.BoxGeometry(7.4, 2.8, 13), m(body), 0, 3, 0);
  add(THREE, g, new THREE.BoxGeometry(7.4, 2.4, 4), m(body), 0, 2.6, 8, [0.5, 0, 0]);
  for (let i = 0; i < 1 + ar * 2; i++) for (const s of [-1, 1]) add(THREE, g, new THREE.BoxGeometry(0.4, 1.6, 2.2), m(armC, glowOf(P.armor) ? 0x1a1a1a : 0), s * 3.9, 3.3, -6 + (i % (1 + ar)) * (12 / (1 + ar)) + (i >= 1 + ar ? 0 : 0));
  if (ar >= 2) add(THREE, g, new THREE.BoxGeometry(6, 0.6, 3), m(armC), 0, 4.6, -5);
  // ほうとう(まわる)
  const tur = new THREE.Group(); tur.position.set(0, 4.8, -0.5); add(THREE, tur, new THREE.BoxGeometry(5.6, 2.4, 6), m(body), 0, 0, 0); add(THREE, tur, new THREE.BoxGeometry(4, 1, 4), m('#d7dde8'), 0, 1.5, -0.2);
  const gr = rk(P.gun); const gc = partColor(P.gun, '#4a505c'); add(THREE, tur, new THREE.CylinderGeometry(0.35 + gr * 0.1, 0.45 + gr * 0.1, 8 + gr * 2.2, 8), m(gc), 0, 0.2, 6 + gr * 1.1, [Math.PI / 2, 0, 0]); if (gr >= 3) add(THREE, tur, new THREE.CylinderGeometry(0.75, 0.75, 1.2, 8), m('#262a32'), 0, 0.2, 10 + gr * 2); if (glowOf(P.gun)) add(THREE, tur, new THREE.SphereGeometry(0.5, 6, 4), new THREE.MeshBasicMaterial({ color: glowOf(P.gun) }), 0, 1.3, 2.4);
  const nm = 2 + rk(P.missile); const mcol = partColor(P.missile, '#e8eefc'); for (let i = 0; i < nm; i++) { const s = i % 2 ? 1 : -1; add(THREE, tur, new THREE.CylinderGeometry(0.4, 0.4, 3.2, 6), m(mcol), s * (3.3 + Math.floor(i / 2) * 0.9), 0.9, 0.4, [Math.PI / 2, 0, 0]); add(THREE, tur, new THREE.ConeGeometry(0.4, 0.8, 6), m('#ff4d5e'), s * (3.3 + Math.floor(i / 2) * 0.9), 0.9, 2.4, [Math.PI / 2, 0, 0]); }
  const sv = rk(P.support); const rc = partColor(P.support, '#e8eefc'); const ant = new THREE.Group(); ant.position.set(-1.6, 1.6, -1.8); add(THREE, ant, new THREE.CylinderGeometry(0.12, 0.12, 3, 5), m('#ccd'), 0, 1.2, 0);
  if (sv <= 1) add(THREE, ant, new THREE.BoxGeometry(1.4, 0.2, 0.2), m(rc), 0, 2.7, 0); else if (sv <= 3) add(THREE, ant, new THREE.CylinderGeometry(1.2, 0.2, 0.6, 10), m(rc), 0, 2.8, 0); else add(THREE, ant, new THREE.BoxGeometry(2.4, 1.6, 0.3), m(rc, 0x222222), 0, 3, 0);
  tur.add(ant); g.add(tur); g.userData.turret = tur; g.userData.radar = ant;
  return g;
}

export function makeVehicleModel(THREE, spec) {
  const g = spec.vehicle === 'ship' ? shipModel(THREE, spec) : spec.vehicle === 'tank' ? tankModel(THREE, spec) : planeModel(THREE, spec);
  g.userData.kind = spec.vehicle; return g;
}

// ---- てきの モデル ---------------------------------------------------------------------
export function makeEnemyModel(THREE, type) {
  const m = mats(THREE); const g = new THREE.Group(); const dark = '#3a2630';
  if (type === 'drone') { const b = add(THREE, g, new THREE.OctahedronGeometry(2.6), m('#c43a4a', 0x330a10)); b.scale.set(1.3, 0.6, 1.3); add(THREE, g, new THREE.TorusGeometry(3.4, 0.35, 6, 14), m('#2a1620'), 0, 0, 0, [Math.PI / 2, 0, 0]); add(THREE, g, new THREE.SphereGeometry(0.7, 6, 6), new THREE.MeshBasicMaterial({ color: '#ff5566' }), 0, 0, 2.2); return g; }
  if (type === 'fighter' || type === 'bomber') { const s = type === 'bomber' ? 2.2 : 1.1; add(THREE, g, new THREE.ConeGeometry(1.6, 12, 8), m('#a8324a'), 0, 0, 0, [Math.PI / 2, 0, 0]); add(THREE, g, new THREE.BoxGeometry(14, 0.4, 4.6), m(dark), 0, 0, -1.2); add(THREE, g, new THREE.BoxGeometry(5.4, 0.3, 2.2), m(dark), 0, 0, -5); add(THREE, g, new THREE.BoxGeometry(0.3, 2.6, 2.4), m('#a8324a'), 0, 1.4, -5); add(THREE, g, new THREE.ConeGeometry(0.9, 4, 6), new THREE.MeshBasicMaterial({ color: '#ff4d5e', transparent: true, opacity: 0.85 }), 0, 0, -8, [-Math.PI / 2, 0, 0]); g.scale.setScalar(s); return g; }
  if (type === 'boat' || type === 'destroyer') { const k = type === 'destroyer' ? 1.9 : 1; add(THREE, g, new THREE.BoxGeometry(7, 3, 22), m('#6a3a46'), 0, 1.5, 0); add(THREE, g, new THREE.ConeGeometry(3.9, 7, 4), m('#6a3a46'), 0, 1.5, 14, [Math.PI / 2, Math.PI / 4, 0]).scale.set(1, 1, 0.5); add(THREE, g, new THREE.BoxGeometry(4, 3, 6), m('#3a2630'), 0, 4.5, -3); add(THREE, g, new THREE.CylinderGeometry(1.2, 1.4, 1.4, 8), m('#8a3340'), 0, 4, 7); add(THREE, g, new THREE.CylinderGeometry(0.3, 0.3, 6, 6), m('#222'), 0, 4.2, 10.5, [Math.PI / 2, 0, 0]); add(THREE, g, new THREE.SphereGeometry(0.6, 6, 4), new THREE.MeshBasicMaterial({ color: '#ff5566' }), 0, 7, -3); g.scale.setScalar(k); return g; }
  if (type === 'etank') { add(THREE, g, new THREE.BoxGeometry(6, 2.2, 10), m('#7a2f3a'), 0, 2, 0); for (const s of [-1, 1]) add(THREE, g, new THREE.BoxGeometry(1.6, 1.8, 11), m('#22262e'), s * 3.4, 1, 0); add(THREE, g, new THREE.BoxGeometry(3.8, 1.6, 4), m('#5a2430'), 0, 3.8, -0.4); add(THREE, g, new THREE.CylinderGeometry(0.3, 0.3, 6, 6), m('#222'), 0, 3.9, 4.4, [Math.PI / 2, 0, 0]); add(THREE, g, new THREE.SphereGeometry(0.5, 6, 4), new THREE.MeshBasicMaterial({ color: '#ff5566' }), 0, 5.2, -0.4); return g; }
  // boss
  add(THREE, g, new THREE.BoxGeometry(110, 16, 220), m('#3a2f46')); add(THREE, g, new THREE.BoxGeometry(90, 4, 190), m('#52456a'), 0, 10, 0); add(THREE, g, new THREE.BoxGeometry(24, 30, 36), m('#2a2234'), 26, 26, 30);
  for (const [x, z] of [[-34, -70], [34, -70], [-34, 70], [34, 70], [0, 0]]) { add(THREE, g, new THREE.CylinderGeometry(5, 7, 10, 8), m('#8a3340', 0x330a10), x, 16, z); add(THREE, g, new THREE.BoxGeometry(2.4, 2.4, 22), m('#1c1824'), x, 20, z - 14); }
  for (const x of [-48, 48]) add(THREE, g, new THREE.CylinderGeometry(12, 12, 20, 12), new THREE.MeshBasicMaterial({ color: '#ff6a4a', transparent: true, opacity: 0.85 }), x, 0, 116, [Math.PI / 2, 0, 0]);
  return g;
}
