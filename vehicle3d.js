// 「地球防衛隊」の きたいの 3Dモデル(エースコンバット3 ふうの テクスチャつき ポリゴン)
//   makeVehicleModel(THREE, spec)  spec = { vehicle, color, parts: { gun, missile, mobility, support, armor }, missiles }
//   parts[slot] = { rarity, charId, fit, power }。ぶひんの レアど・キャラで かたちや いろが かわる
//   +z が まえ、+y が うえ、x が よこ。ひこうき=userData.flame / ふね=turrets・radar・wake / せんしゃ=turret・radar
const RANK = { common: 0, uncommon: 1, rare: 2, super: 3, legend: 4, diamond: 5 };
const rk = (part) => (part ? RANK[part.rarity] ?? 0 : 0);
const hashStr = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const RARITY_COLOR = ['#9aa7bf', '#6fd69a', '#5aa8ff', '#b88aff', '#ffa83a', '#9ff3ff'];
// ぶひんの いろ: キャラごとに ちがう いろあい(レアどが たかいほど あざやか)
export function partColor(part, fallback = '#aab6cc') {
  if (!part) return fallback; const h = hashStr(part.charId) % 360; const r = rk(part);
  return `hsl(${h}, ${35 + r * 11}%, ${58 - r * 3}%)`;
}
const pcCache = new Map();
const pc =(THREE, part, fb) => { const c = partColor(part, fb); const k = c + (part ? 1 : 0); if (!pcCache.has(k)) pcCache.set(k, `#${new THREE.Color(c).lerp(new THREE.Color('#4a4f58'), part ? 0.58 : 0).getHexString()}`); return pcCache.get(k); };
const glowOf = (part) => (part && rk(part) >= 4 ? RARITY_COLOR[rk(part)] : null);

// ---- ざいりょう・テクスチャ ------------------------------------------------------------
const TEX = new Map();
function canvasTex(THREE, key, w, h, draw, opts = {}) {
  if (TEX.has(key)) return TEX.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.wrapS = t.wrapT = THREE.RepeatWrapping; if (opts.repeat) t.repeat.set(opts.repeat[0], opts.repeat[1]); TEX.set(key, t); return t;
}
const mulberry = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const shade = (THREE, hex, dh, ds, dl) => { const c = new THREE.Color(hex); c.offsetHSL(dh, ds, dl); return `#${c.getHexString()}`; };
// まだらの めいさい(blobを かさねる)。panel=ぱねるの すじ、rivets=びょう
function camoTex(THREE, base, { seed = 1, panel = false, size = 256, blobs = 46, tone = 0.1, stripes = false } = {}) {
  return canvasTex(THREE, `camo|${base}|${seed}|${panel}|${blobs}|${stripes}`, size, size, (g, w, h) => {
    const R = mulberry(seed); const cols = [base, shade(THREE, base, 0, 0.02, -tone), shade(THREE, base, 0.02, -0.03, tone * 0.8), shade(THREE, base, -0.02, 0.05, -tone * 1.8)];
    g.fillStyle = cols[0]; g.fillRect(0, 0, w, h);
    for (let i = 0; i < blobs; i++) { g.fillStyle = cols[1 + (i % 3)]; g.beginPath(); const cx = R() * w; const cy = R() * h; const r = 14 + R() * 34; const n = 7; for (let k = 0; k < n; k++) { const a = (k / n) * 6.283; const rr = r * (0.6 + R() * 0.7); g.lineTo(cx + Math.cos(a) * rr * 1.5, cy + Math.sin(a) * rr * 0.8); } g.closePath(); g.fill(); }
    for (let i = 0; i < 900; i++) { g.fillStyle = R() < 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.06)'; g.fillRect(R() * w, R() * h, 2, 2); }
    if (stripes) { g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(0, h * 0.55, w, 6); }
    if (panel) { g.strokeStyle = 'rgba(20,24,32,.45)'; g.lineWidth = 1.2; for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(0, (i * h) / 6 + R() * 8); g.lineTo(w, (i * h) / 6 + R() * 8); g.stroke(); } for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo((i * w) / 5 + R() * 10, 0); g.lineTo((i * w) / 5 + R() * 10, h); g.stroke(); } g.fillStyle = 'rgba(20,24,32,.5)'; for (let i = 0; i < 70; i++) g.fillRect(R() * w, R() * h, 1.5, 1.5); }
  });
}
const treadTex = (THREE) => canvasTex(THREE, 'tread', 64, 64, (g, w, h) => { g.fillStyle = '#23262c'; g.fillRect(0, 0, w, h); g.fillStyle = '#3b3f48'; for (let y = 0; y < h; y += 8) g.fillRect(0, y, w, 4); g.fillStyle = '#17191d'; for (let x = 6; x < w; x += 22) g.fillRect(x, 0, 3, h); }, { repeat: [1, 6] });
const grilleTex = (THREE) => canvasTex(THREE, 'grille', 64, 64, (g, w, h) => { g.fillStyle = '#2b2f36'; g.fillRect(0, 0, w, h); g.fillStyle = '#0f1115'; for (let y = 4; y < h; y += 8) g.fillRect(4, y, w - 8, 4); });
const vlsTex = (THREE) => canvasTex(THREE, 'vls', 64, 64, (g, w, h) => { g.fillStyle = '#6a7585'; g.fillRect(0, 0, w, h); g.fillStyle = '#2a2f38'; for (let y = 4; y < h; y += 16) for (let x = 4; x < w; x += 16) g.fillRect(x, y, 11, 11); });
const hullTex = (THREE, base, id) => canvasTex(THREE, `hull|${base}|${id}`, 256, 128, (g, w, h) => { g.fillStyle = base; g.fillRect(0, 0, w, h); for (let i = 0; i < 700; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.07)'; g.fillRect(Math.random() * w, Math.random() * h, 3, 2); } g.fillStyle = 'rgba(255,255,255,.9)'; g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.fillText(String(id), w * 0.5, 62); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, h - 14, w, 14); g.fillStyle = 'rgba(190,40,40,.55)'; g.fillRect(0, h - 28, w, 14); });
const hinomaru = (THREE) => canvasTex(THREE, 'hinomaru', 64, 64, (g) => { g.fillStyle = '#e0302a'; g.beginPath(); g.arc(32, 32, 24, 0, 6.283); g.fill(); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 3; g.stroke(); });

function mats(THREE) {
  const cache = new Map();
  const m = (color, emissive = 0x000000, extra = {}) => { const k = `${color}|${emissive}|${JSON.stringify(extra)}`; if (!cache.has(k)) cache.set(k, new THREE.MeshStandardMaterial({ color, emissive, metalness: 0.45, roughness: 0.38, ...extra })); return cache.get(k); };
  return m;
}
const add = (THREE, g, geo, mat, x = 0, y = 0, z = 0, rot) => { const mesh = new THREE.Mesh(geo, mat); mesh.position.set(x, y, z); if (rot) mesh.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0); g.add(mesh); return mesh; };
const scaleUV = (geo) => { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.085, uv.getY(i) * 0.085); uv.needsUpdate = true; };
// うえから みた かたち(x, z)を ふとさ depth で おしだす。y0 から y0+depth
const topShape = (THREE, pts, depth, mat, y0 = 0, bev = true) => {
  const sh = new THREE.Shape(); pts.forEach(([x, z], i) => (i ? sh.lineTo(x, z) : sh.moveTo(x, z)));
  const geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: bev, bevelThickness: 0.1, bevelSize: 0.12, bevelSegments: 2 }); geo.rotateX(Math.PI / 2); geo.translate(0, y0 + depth, 0); scaleUV(geo); return new THREE.Mesh(geo, mat);
};
// よこから みた かたち(z, y)を よこはば t で おしだす(x の まんなか)
const sideShape = (THREE, pts, t, mat) => {
  const sh = new THREE.Shape(); pts.forEach(([z, y], i) => (i ? sh.lineTo(-z, y) : sh.moveTo(-z, y)));
  const geo = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.06, bevelSegments: 1 }); geo.rotateY(Math.PI / 2); geo.translate(-t / 2, 0, 0); scaleUV(geo); return new THREE.Mesh(geo, mat);
};
const palette = (THREE, base, enemy) => (enemy ? { base: '#7a3340', camo: '#7a3340' } : { base, camo: base });

// ---- ひこうき(+z が まえ) --------------------------------------------------------
const WING = [
  [[0, 2.4], [6.6, -0.6], [7.2, -1.6], [7.2, -2.6], [0, -3.0]],
  [[0, 3.2], [7.6, -0.8], [8.2, -2.2], [8.2, -3.4], [0, -3.4]],
  [[0, 4.2], [9.2, -2.6], [9.2, -3.6], [0, -3.6]],
  [[0, 4.2], [5.4, 0.6], [9.6, -3.4], [9.6, -4.4], [0, -4.2]],
  [[0, 1.2], [8.4, 2.2], [8.4, 0.8], [0, -3.0]],
  [[0, 5.4], [4.6, 1.2], [10.4, -3.6], [10.4, -4.8], [0, -4.6]],
];
function planeModel(THREE, spec, enemy = false) {
  const m = mats(THREE); const g = new THREE.Group(); const P = spec.parts || {}; const body = spec.color || '#4aa3ff'; const pal = palette(THREE, body, enemy); const gray = new THREE.Color('#7e8a99').lerp(new THREE.Color(body), 0.22); const gh = `#${gray.getHexString()}`;
  const skin = new THREE.MeshStandardMaterial({ map: camoTex(THREE, enemy ? '#7a3340' : gh, { seed: enemy ? 5 : 3, panel: true, blobs: 38, tone: 0.07 }), metalness: 0.35, roughness: 0.5 });
  const skin2 = new THREE.MeshStandardMaterial({ map: camoTex(THREE, enemy ? '#5a2430' : shade(THREE, gh, 0, 0, -0.1), { seed: enemy ? 6 : 4, panel: true, blobs: 30, tone: 0.06 }), metalness: 0.35, roughness: 0.5 });
  const dark = m('#1c2028', 0, { metalness: 0.6, roughness: 0.4 });
  const ar = rk(P.armor); const fk = 1 + ar * 0.06;
  const prof = [[0, 8.4], [0.32, 7.7], [0.78, 6.4], [1.15, 4.8], [1.45, 2.8], [1.62, 0.6], [1.58, -2], [1.38, -4.6], [1.15, -6.4], [1.0, -7.4]].map(([r, y]) => new THREE.Vector2(r * fk, y)).reverse();
  const fus = add(THREE, g, new THREE.LatheGeometry(prof, 22), skin, 0, 0, 0, [Math.PI / 2, 0, 0]); fus.scale.set(1.04, 1, 0.84);
  add(THREE, g, new THREE.ConeGeometry(0.62, 2.4, 14), dark, 0, 0, 7.4, [Math.PI / 2, 0, 0]); // レドーム
  add(THREE, g, new THREE.CylinderGeometry(0.05, 0.05, 1.8, 5), m('#cfd6e2'), 0, 0.1, 9.2, [Math.PI / 2, 0, 0]); // ピトーかん
  // コックピット
  const glass = new THREE.MeshStandardMaterial({ color: '#27456e', metalness: 0.95, roughness: 0.05, emissive: '#071a33', envMapIntensity: 1.8 });
  add(THREE, g, new THREE.SphereGeometry(1, 18, 12), glass, 0, 1.05, 2.5).scale.set(0.78, 0.62, 2.3);
  add(THREE, g, new THREE.SphereGeometry(0.28, 8, 6), m('#10131a'), 0, 1.0, 2.0); add(THREE, g, new THREE.BoxGeometry(1.5, 0.12, 0.2), dark, 0, 1.55, 3.5);
  add(THREE, g, new THREE.BoxGeometry(0.9, 0.5, 5.2), skin2, 0, 1.15, -2.4).rotation.x = 0.04; // せぼね
  // くうきとりいれぐち
  for (const s of [-1, 1]) { add(THREE, g, new THREE.BoxGeometry(0.95, 1.0, 3.2), skin2, s * 1.35, -0.4, 2.6); add(THREE, g, new THREE.BoxGeometry(0.8, 0.8, 0.2), dark, s * 1.35, -0.4, 4.25); }
  // つばさ(mobility)
  const wc = pc(THREE, P.mobility, '#e8eefc'); const wv = Math.min(5, rk(P.mobility)); const pts = WING[wv]; const tipX = Math.max(...pts.map((p) => p[0]));
  const wm = enemy ? skin : new THREE.MeshStandardMaterial({ map: camoTex(THREE, shade(THREE, gh, 0, 0, -0.04), { seed: 11, panel: true, blobs: 30, tone: 0.06 }), metalness: 0.35, roughness: 0.5 });
  const wR = topShape(THREE, pts, 0.28, wm, -0.28); wR.position.set(1.0, 0, -0.4); g.add(wR);
  const wL = topShape(THREE, pts.map(([x, z]) => [-x, z]), 0.28, wm, -0.28); wL.position.set(-1.0, 0, -0.4); g.add(wL);
  if (!enemy) for (const s of [-1, 1]) { const hm = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshBasicMaterial({ map: hinomaru(THREE), transparent: true, depthWrite: false })); hm.rotation.x = -Math.PI / 2; hm.position.set(s * (1.0 + tipX * 0.55), 0.06, -1.6); g.add(hm); }
  for (const s of [-1, 1]) { const tx = s * (1.0 + tipX); add(THREE, g, new THREE.SphereGeometry(0.22, 6, 5), new THREE.MeshBasicMaterial({ color: s > 0 ? '#3aff6a' : '#ff3a4a' }), tx, -0.1, pts[pts.length - 2][1] - 0.4); add(THREE, g, new THREE.BoxGeometry(0.2, 0.2, 2.4), m(wc), tx - s * 0.1, -0.1, -2.2); }
  if (glowOf(P.mobility)) for (const s of [-1, 1]) add(THREE, g, new THREE.BoxGeometry(0.2, 0.12, 5), new THREE.MeshBasicMaterial({ color: glowOf(P.mobility) }), s * (4.5 + wv * 0.3), 0.18, -1.4);
  // びよく(support): すいちょくびよく と すいへいびよく
  const tc = pc(THREE, P.support, body); const tv = Math.min(5, rk(P.support)); const tm = enemy ? skin2 : new THREE.MeshStandardMaterial({ map: camoTex(THREE, shade(THREE, gh, 0, 0, -0.08), { seed: 8, panel: true, blobs: 24, tone: 0.06 }), color: new THREE.Color(1, 1, 1).lerp(new THREE.Color(tc), tv > 0 ? 0.35 : 0), metalness: 0.4, roughness: 0.45 });
  const hs = 1 + Math.min(tv, 5) * 0.06; for (const s of [-1, 1]) { const st = topShape(THREE, [[0, 0], [s * 3.7 * hs, -1.7], [s * 3.7 * hs, -3.1], [0, -2.1]], 0.2, tm, -0.2); st.position.set(0, 0, -4.7); g.add(st); }
  const finPts = (h) => [[-2.2, 0.9], [-3.5, 0.9 + h], [-5.3, 0.9 + h], [-5.4, 0.9]];
  if (tv === 0) { const f = sideShape(THREE, finPts(2.6), 0.2, tm); g.add(f); }
  else if (tv === 1) for (const s of [-1, 1]) { const f = sideShape(THREE, finPts(2.6), 0.2, tm); f.position.x = s * 1.1; g.add(f); }
  else if (tv === 2) for (const s of [-1, 1]) { const f = sideShape(THREE, finPts(3.0), 0.2, tm); f.position.x = s * 1.0; f.rotation.z = -s * 0.42; g.add(f); }
  else if (tv === 3) for (const s of [-1, 1]) { const f = sideShape(THREE, finPts(3.5), 0.22, tm); f.position.x = s * 1.1; f.rotation.z = -s * 0.28; g.add(f); }
  else { for (const s of [-1, 1]) { const f = sideShape(THREE, finPts(3.5 + (tv - 4) * 0.6), 0.22, tm); f.position.x = s * 1.2; f.rotation.z = -s * 0.5; g.add(f); } const f2 = sideShape(THREE, finPts(2.4), 0.2, tm); g.add(f2); }
  // ノズル
  for (const s of [-1, 1]) { add(THREE, g, new THREE.CylinderGeometry(0.62, 0.52, 1.9, 14), m('#454b56', 0, { metalness: 0.8, roughness: 0.35 }), s * 0.55, 0, -7.7, [Math.PI / 2, 0, 0]); add(THREE, g, new THREE.CylinderGeometry(0.5, 0.5, 0.1, 12), new THREE.MeshBasicMaterial({ color: '#ffb060' }), s * 0.55, 0, -8.7, [Math.PI / 2, 0, 0]); }
  // へき・ほかの そうこう(armor)
  for (let i = 0; i < ar; i++) add(THREE, g, new THREE.BoxGeometry(0.4, 0.5, 3), m(pc(THREE, P.armor), glowOf(P.armor) ? 0x222222 : 0), (i % 2 ? 1 : -1) * 1.38, 0.55, -1 + Math.floor(i / 2) * 2.4);
  // きかんじゅう(gun): ばんすう=レアど
  const gr = rk(P.gun); const nb = [1, 2, 2, 3, 4, 4][gr]; const gc = pc(THREE, P.gun, '#555a66');
  for (let i = 0; i < nb; i++) { const x = (i % 2 ? 1 : -1) * (0.9 + Math.floor(i / 2) * 0.7); add(THREE, g, new THREE.CylinderGeometry(0.13, 0.17, 3.6 + gr * 0.8, 8), m(gc, 0, { metalness: 0.7 }), x, -0.45, 5.2, [Math.PI / 2, 0, 0]); add(THREE, g, new THREE.SphereGeometry(0.2, 6, 4), glowOf(P.gun) ? new THREE.MeshBasicMaterial({ color: glowOf(P.gun) }) : m('#222'), x, -0.45, 7.2 + gr * 0.4); }
  // ミサイル(missile): パイロンの かず
  const mc = Math.max(2, Math.min(10, 2 + Math.floor((spec.missiles || 4) / 2))); const mcol = pc(THREE, P.missile, '#e8eefc');
  for (let i = 0; i < mc; i++) { const s = i % 2 ? 1 : -1; const x = s * (2.2 + Math.floor(i / 2) * 1.15);
    add(THREE, g, new THREE.BoxGeometry(0.16, 0.5, 1.4), dark, x, -0.35, -0.5); add(THREE, g, new THREE.CylinderGeometry(0.2, 0.2, 3.2, 10), m(mcol, 0, { metalness: 0.3, roughness: 0.5 }), x, -0.82, -0.4, [Math.PI / 2, 0, 0]); add(THREE, g, new THREE.ConeGeometry(0.2, 0.8, 10), m('#ff4d5e'), x, -0.82, 1.6, [Math.PI / 2, 0, 0]);
    for (const a of [0, 1.57, 3.14, 4.71]) add(THREE, g, new THREE.BoxGeometry(0.04, 0.5, 0.5), m('#dfe3ea'), x + Math.sin(a) * 0.2, -0.82 + Math.cos(a) * 0.2, -1.6, [0, 0, -a]); }
  // ほのお(2じゅう)
  const flame = new THREE.Group(); flame.position.set(0, 0, -8.8);
  for (const s of [-1, 1]) { const o = add(THREE, flame, new THREE.ConeGeometry(0.5, 3.6, 10), new THREE.MeshBasicMaterial({ color: '#5fb8ff', transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }), s * 0.55, 0, -1.8, [-Math.PI / 2, 0, 0]); add(THREE, flame, new THREE.ConeGeometry(0.28, 2.4, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }), s * 0.55, 0, -1.2, [-Math.PI / 2, 0, 0]); void o; }
  g.add(flame); g.userData.flame = flame;
  return g;
}

// ---- ふね(くちくかん) -------------------------------------------------------------------
function shipModel(THREE, spec, enemy = false) {
  const m = mats(THREE); const g = new THREE.Group(); const P = spec.parts || {}; const body = spec.color || '#4aa3ff';
  const mv = rk(P.mobility); const len = enemy ? 34 : 38 * (1 + mv * 0.06); const ar = rk(P.armor); const armC = pc(THREE, P.armor, '#7b8aa0'); const hl = len / 2;
  const hullBase = enemy ? '#6a3540' : '#8794a6'; const decoBase = enemy ? '#7a4452' : shade(THREE, body, 0, -0.05, 0.05);
  const hullM = new THREE.MeshStandardMaterial({ map: hullTex(THREE, hullBase, enemy ? 'X-' + (len | 0) : '17'), metalness: 0.3, roughness: 0.55 });
  const deckM = new THREE.MeshStandardMaterial({ color: enemy ? '#4a2a32' : '#59616f', metalness: 0.25, roughness: 0.7 });
  const supM = new THREE.MeshStandardMaterial({ map: camoTex(THREE, decoBase, { seed: 21, panel: true, blobs: 14, tone: 0.05 }), metalness: 0.35, roughness: 0.5 });
  const dark = m('#1c2028', 0, { metalness: 0.6, roughness: 0.45 }); const white = m('#e8edf5', 0, { metalness: 0.2, roughness: 0.5 });
  const beam = 5.2 + ar * 0.25;
  // せんたい(うえから みた かたち)
  const hull = [[0, hl + 6.5], [beam * 0.55, hl + 2.2], [beam, hl - 5], [beam * 1.04, 0], [beam * 0.98, -hl + 4], [beam * 0.8, -hl], [-beam * 0.8, -hl], [-beam * 0.98, -hl + 4], [-beam * 1.04, 0], [-beam, hl - 5], [-beam * 0.55, hl + 2.2]];
  const hu = topShape(THREE, hull, 5.8, hullM, -1.6); g.add(hu);
  const deck = hull.map(([x, z]) => [x * 0.9, z > hl ? z - 0.4 : z]); const dk = topShape(THREE, deck, 0.5, deckM, 4.2, false); g.add(dk);
  // そうこうばん(armor)
  for (let i = 0; i < 2 + ar; i++) for (const s of [-1, 1]) add(THREE, g, new THREE.BoxGeometry(0.5, 2.2 + ar * 0.2, 4.6), m(armC, glowOf(P.armor) ? 0x1a1a1a : 0), s * (beam * 1.05 + 0.3), 2.4, -hl + 4.5 + i * (len - 12) / Math.max(1, 1 + ar));
  // ぜんぶの ゆか・ブリッジ・マスト
  add(THREE, g, new THREE.BoxGeometry(beam * 1.5, 2.4, 11), supM, 0, 6.2, -5); add(THREE, g, new THREE.BoxGeometry(beam * 1.2, 2.4, 7), supM, 0, 8.6, -5.5);
  add(THREE, g, new THREE.BoxGeometry(beam * 1.25, 1.5, 4.6), glassBox(THREE), 0, 9.4, -2.6).rotation.x = 0.15; // ブリッジの まど
  const mast = add(THREE, g, new THREE.CylinderGeometry(0.28, 0.5, 8, 6), m('#cfd6e2'), 0, 14.8, -6); add(THREE, g, new THREE.BoxGeometry(5, 0.22, 0.22), m('#cfd6e2'), 0, 16.8, -6); void mast;
  // えんとつ
  const fun = add(THREE, g, new THREE.BoxGeometry(3.4, 4.2, 5), m('#4f5866'), 0, 10.4, -11); fun.rotation.x = 0.0; add(THREE, g, new THREE.BoxGeometry(3.2, 0.3, 4.6), dark, 0, 12.6, -11);
  // ヘリデッキ・かくのうこ
  add(THREE, g, new THREE.BoxGeometry(beam * 1.3, 3, 5), supM, 0, 6, -hl + 6); const hp = add(THREE, g, new THREE.CircleGeometry(3.4, 20), new THREE.MeshStandardMaterial({ map: helipadTex(THREE), roughness: 0.8 }), 0, 4.75, -hl + 1.6, [-Math.PI / 2, 0, 0]); void hp;
  // ミサイル(VLS)
  const nm = Math.min(24, 8 + rk(P.missile) * 3); const mcol = pc(THREE, P.missile, '#7b8aa0'); const vls = add(THREE, g, new THREE.BoxGeometry(beam * 1.3, 0.6, 8), new THREE.MeshStandardMaterial({ map: vlsTex(THREE), color: new THREE.Color(1, 1, 1).lerp(new THREE.Color(mcol), 0.35), roughness: 0.6, metalness: 0.4 }), 0, 4.8, 6); vls.rotation.y = 0;
  for (let i = 0; i < Math.min(12, nm / 2); i++) add(THREE, g, new THREE.CylinderGeometry(0.25, 0.25, 0.4, 8), m(mcol), ((i % 4) - 1.5) * 1.5, 5.2, 3 + Math.floor(i / 4) * 2.4);
  // CIWS・スクリュー
  for (const z of [-hl + 12, 2]) { const c = new THREE.Group(); c.position.set(0, 5.4, z); add(THREE, c, new THREE.CylinderGeometry(1, 1.3, 1.2, 10), white); add(THREE, c, new THREE.SphereGeometry(1.1, 12, 8, 0, 6.283, 0, Math.PI / 2), white, 0, 0.6, 0); g.add(c); }
  for (let i = 0; i < Math.min(4, 2 + (mv >= 3 ? 1 : 0) + (mv >= 5 ? 1 : 0)); i++) { const x = (i % 2 ? 1 : -1) * 2.0; add(THREE, g, new THREE.CylinderGeometry(0.9, 0.9, 1.0, 10), m(pc(THREE, P.mobility, '#333')), x, -0.6, -hl - 0.3, [Math.PI / 2, 0, 0]); }
  // しゅほう(turrets: まわる) ドームがた
  g.userData.turrets = []; const gr = rk(P.gun); const nt = 1 + (gr >= 2 ? 1 : 0) + (gr >= 4 ? 1 : 0); const gc = pc(THREE, P.gun, '#555a66');
  for (let t = 0; t < nt; t++) { const tg = new THREE.Group(); tg.position.set(0, 4.6, [hl - 4.5, -hl + 8.5, 12][t] ?? 12);
    add(THREE, tg, new THREE.CylinderGeometry(2.4, 2.8, 1.6, 12), m('#7a8494'), 0, 0.6, 0); const dome = add(THREE, tg, new THREE.SphereGeometry(2.3, 14, 8, 0, 6.283, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ map: camoTex(THREE, decoBase, { seed: 22 + t, blobs: 10 }), roughness: 0.55, metalness: 0.35 }), 0, 1.3, 0); dome.scale.set(1, 0.62, 1.15);
    const nb = gr >= 3 ? 2 : 1; for (let b = 0; b < nb; b++) { add(THREE, tg, new THREE.CylinderGeometry(0.28 + gr * 0.03, 0.34 + gr * 0.03, 7 + gr * 1.4, 10), m('#2b323e', 0, { metalness: 0.75 }), (b - (nb - 1) / 2) * 1.2, 1.6, 4.2 + gr * 0.5, [Math.PI / 2, 0, 0]); add(THREE, tg, new THREE.CylinderGeometry(0.42 + gr * 0.03, 0.42 + gr * 0.03, 0.7, 10), dark, (b - (nb - 1) / 2) * 1.2, 1.6, 7.6 + gr * 1.1, [Math.PI / 2, 0, 0]); }
    if (glowOf(P.gun)) add(THREE, tg, new THREE.SphereGeometry(0.5, 6, 4), new THREE.MeshBasicMaterial({ color: glowOf(P.gun) }), 0, 2.8, 0); g.add(tg); g.userData.turrets.push(tg); }
  // レーダー(support: まわる)
  const sv = rk(P.support); const rc = pc(THREE, P.support, '#e8eefc'); const rad = new THREE.Group(); rad.position.set(0, 17.2, -6);
  add(THREE, rad, new THREE.CylinderGeometry(0.12, 0.12, 1.6, 5), m('#ccd'), 0, 0, 0);
  if (sv === 0) add(THREE, rad, new THREE.BoxGeometry(5, 0.3, 0.5), m(rc), 0, 0.9, 0);
  else if (sv === 1) add(THREE, rad, new THREE.CylinderGeometry(2.4, 0.3, 1.2, 12), m(rc), 0, 1.0, 0);
  else if (sv === 2) add(THREE, rad, new THREE.BoxGeometry(6, 0.5, 0.8), m(rc), 0, 1.0, 0);
  else if (sv === 3) add(THREE, rad, new THREE.SphereGeometry(2.0, 12, 8), m(rc), 0, 1.4, 0);
  else for (const s of [-1, 1]) add(THREE, rad, new THREE.BoxGeometry(0.4, 3.6, 3.6), m(rc, glowOf(P.support) ? 0x222222 : 0), s * 1.5, 1.8, 0);
  g.add(rad); g.userData.radar = rad; g.userData.len = len;
  for (const x of [-1, 1]) add(THREE, g, new THREE.BoxGeometry(0.2, 2.4, 2.4), m('#3a4452', 0x0a1020), x * (beam * 0.62), 8.8, -5.5 + 0.6).rotation.y = 0; // アレイ
  // あわの あと(うしろに ひく)
  const wake = new THREE.Mesh(new THREE.PlaneGeometry(10, 46), new THREE.MeshBasicMaterial({ map: wakeTex(THREE), transparent: true, opacity: 0.85, depthWrite: false })); wake.rotation.x = -Math.PI / 2; wake.position.set(0, -1.2, -hl - 22); g.add(wake); g.userData.wake = wake;
  return g;
}
const glassBox = (THREE) => new THREE.MeshStandardMaterial({ color: '#27456e', metalness: 0.9, roughness: 0.08, emissive: '#06162c' });
const helipadTex = (THREE) => canvasTex(THREE, 'helipad', 64, 64, (g) => { g.fillStyle = '#4a525e'; g.fillRect(0, 0, 64, 64); g.strokeStyle = '#e8edf5'; g.lineWidth = 3; g.beginPath(); g.arc(32, 32, 28, 0, 6.283); g.stroke(); g.fillStyle = '#e8edf5'; g.font = 'bold 36px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('H', 32, 34); });
const wakeTex = (THREE) => canvasTex(THREE, 'wake', 64, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(w * 0.35, 0); g.lineTo(w * 0.65, 0); g.lineTo(w * 0.98, h); g.lineTo(w * 0.02, h); g.closePath(); g.fill(); for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(Math.random() * w, Math.random() * h, 4, 2); } });

// ---- せんしゃ ------------------------------------------------------------------------
function tankModel(THREE, spec, enemy = false) {
  const m = mats(THREE); const g = new THREE.Group(); const P = spec.parts || {}; const body = spec.color || '#4aa3ff';
  const mv = rk(P.mobility); const tw = 2.4 + mv * 0.25; const ar = rk(P.armor); const armC = pc(THREE, P.armor, '#6b7788'); const tc = pc(THREE, P.mobility, '#2a2e36');
  const base = enemy ? '#7a3340' : shade(THREE, body, 0, 0.02, -0.05);
  const camo = new THREE.MeshStandardMaterial({ map: camoTex(THREE, base, { seed: enemy ? 31 : 32, blobs: 60, tone: 0.1 }), metalness: 0.12, roughness: 0.82 });
  const camoB = new THREE.MeshStandardMaterial({ map: camoTex(THREE, base, { seed: enemy ? 33 : 34, blobs: 50, tone: 0.1 }), metalness: 0.12, roughness: 0.82 });
  const dark = m('#1f2228', 0, { metalness: 0.5, roughness: 0.6 }); const steel = m('#3a3f49', 0, { metalness: 0.7, roughness: 0.45 }); const tread = new THREE.MeshStandardMaterial({ map: treadTex(THREE), roughness: 0.9, metalness: 0.2 });
  // キャタピラ(ベルト+ころ+きどうりん)
  for (const s of [-1, 1]) {
    const x = s * 4.7; const belt = topShape(THREE, [[-tw / 2, -7.4], [tw / 2, -7.4], [tw / 2, 7.4], [-tw / 2, 7.4]], 2.8, tread, 0, false); belt.rotation.set(0, 0, 0); belt.position.set(x, 0, 0); belt.scale.set(1, 1, 1);
    // ベルトは よこむきの おびに する(ながい はこ+まるい りん)
    belt.visible = false; add(THREE, g, new THREE.BoxGeometry(tw, 2.7, 13.4), tread, x, 1.45, 0);
    for (const z of [-7, 7]) add(THREE, g, new THREE.CylinderGeometry(1.45, 1.45, tw, 14), tread, x, 1.45, z, [0, 0, Math.PI / 2]);
    const nw = 6 + Math.min(2, mv); for (let i = 0; i < nw; i++) { const z = -6 + i * (12 / (nw - 1)); add(THREE, g, new THREE.CylinderGeometry(1.25, 1.25, tw + 0.5, 14), m(tc, 0, { metalness: 0.6, roughness: 0.5 }), x, 1.3, z, [0, 0, Math.PI / 2]); add(THREE, g, new THREE.CylinderGeometry(0.5, 0.5, tw + 0.7, 8), steel, x, 1.3, z, [0, 0, Math.PI / 2]); }
    add(THREE, g, new THREE.CylinderGeometry(1.0, 1.0, tw + 0.6, 12), steel, x, 1.7, -7.4, [0, 0, Math.PI / 2]); // きどうりん
    add(THREE, g, new THREE.BoxGeometry(tw + 0.9, 0.35, 15), camoB, x, 3.4, 0); // フェンダー
    add(THREE, g, new THREE.BoxGeometry(tw + 0.9, 0.35, 2.4), camoB, x, 3.6, 8.2).rotation.x = -0.35;
    for (let k = 0; k < 4; k++) add(THREE, g, new THREE.CylinderGeometry(0.3, 0.3, tw, 8), steel, x, 3.1, -4.5 + k * 3.3, [0, 0, Math.PI / 2]); // うわの ころ
  }
  // せんたい(ななめの そうこう)
  const hullPts = [[-3.7, -7.6], [3.7, -7.6], [3.7, 4.6], [2.6, 8.4], [-2.6, 8.4], [-3.7, 4.6]];
  const hull = topShape(THREE, hullPts, 2.6, camo, 2.2); g.add(hull);
  add(THREE, g, new THREE.BoxGeometry(6.2, 0.35, 3.4), camoB, 0, 4.7, 6.3).rotation.x = 0.45; // グラシス
  add(THREE, g, new THREE.CylinderGeometry(0.8, 0.8, 0.4, 10), dark, 0, 5.0, 6.0); // うんてんしゅの ハッチ
  add(THREE, g, new THREE.BoxGeometry(6.4, 0.45, 5.4), new THREE.MeshStandardMaterial({ map: grilleTex(THREE), roughness: 0.7, metalness: 0.5 }), 0, 4.95, -5.0); // エンジンデッキ
  for (const s of [-1, 1]) { add(THREE, g, new THREE.CylinderGeometry(0.34, 0.34, 3, 8), dark, s * 2.3, 5.2, -7.6, [Math.PI / 2, 0, 0]); add(THREE, g, new THREE.CylinderGeometry(0.75, 0.75, 1.9, 10), m('#4a5a3a', 0, { roughness: 0.8 }), s * 2.9, 5.6, -8.6, [0, 0, Math.PI / 2]); } // はいき・ドラムかん
  for (const s of [-1, 1]) add(THREE, g, new THREE.BoxGeometry(0.9, 0.9, 3.0), camoB, s * 4.7, 4.0, -2.4); // そうこばこ
  // そうこう(armor): サイドスカート・ERA
  for (let i = 0; i < 1 + ar * 2; i++) for (const s of [-1, 1]) add(THREE, g, new THREE.BoxGeometry(0.4, 1.5, 2.2), m(armC, glowOf(P.armor) ? 0x1a1a1a : 0), s * 3.95, 3.2, -6 + (i % (1 + ar)) * (12 / (1 + ar)));
  if (ar >= 2) add(THREE, g, new THREE.BoxGeometry(6, 0.6, 3), m(armC), 0, 5.4, -5);
  // ほうとう(まわる)
  const tur = new THREE.Group(); tur.position.set(0, 4.8, -0.8);
  const tPts = [[-2.9, -3.1], [2.9, -3.1], [3.2, 0.6], [1.7, 3.6], [-1.7, 3.6], [-3.2, 0.6]]; const tb = topShape(THREE, tPts, 2.1, camo, 0); tur.add(tb);
  add(THREE, tur, new THREE.CylinderGeometry(3.2, 3.5, 0.5, 14), dark, 0, 0.1, 0); // ターレットリング
  add(THREE, tur, new THREE.BoxGeometry(4.2, 0.4, 2.0), camoB, 0, 2.3, -1.4); // ルーフ
  const gr = rk(P.gun); const gc = pc(THREE, P.gun, '#4a505c'); add(THREE, tur, new THREE.BoxGeometry(2.8, 1.8, 1.0), steel, 0, 1.0, 3.8); // しゃへいぼう
  const blen = 8 + gr * 2.2; add(THREE, tur, new THREE.CylinderGeometry(0.34 + gr * 0.08, 0.44 + gr * 0.09, blen, 12), m(gc, 0, { metalness: 0.7, roughness: 0.4 }), 0, 1.0, 4.2 + blen / 2, [Math.PI / 2, 0, 0]);
  add(THREE, tur, new THREE.CylinderGeometry(0.6, 0.6, 2.6, 10), steel, 0, 1.0, 5.6, [Math.PI / 2, 0, 0]); // ぼうしゃ
  add(THREE, tur, new THREE.CylinderGeometry(0.72 + gr * 0.04, 0.72 + gr * 0.04, 1.2, 10), dark, 0, 1.0, 4.2 + blen + 0.2, [Math.PI / 2, 0, 0]); // マズルブレーキ
  if (glowOf(P.gun)) add(THREE, tur, new THREE.SphereGeometry(0.5, 6, 4), new THREE.MeshBasicMaterial({ color: glowOf(P.gun) }), 0, 2.6, 0);
  add(THREE, tur, new THREE.CylinderGeometry(0.95, 1.0, 0.9, 12), camoB, -1.2, 2.5, -0.4); add(THREE, tur, new THREE.CylinderGeometry(0.85, 0.85, 0.15, 12), dark, -1.2, 3.0, -0.4); add(THREE, tur, new THREE.CylinderGeometry(0.07, 0.07, 1.8, 6), steel, -1.2, 3.4, 0.4, [Math.PI / 2, 0, 0]); // コマンダーキューポラ+MG
  add(THREE, tur, new THREE.BoxGeometry(4.2, 1.4, 1.4), camoB, 0, 0.7, -3.4); // バスル
  const nm = 2 + rk(P.missile); const mcol = pc(THREE, P.missile, '#e8eefc'); for (let i = 0; i < nm; i++) { const s = i % 2 ? 1 : -1; const x = s * (3.4 + Math.floor(i / 2) * 0.9); add(THREE, tur, new THREE.BoxGeometry(0.9, 0.9, 3.2), dark, x, 1.0, 0.3); add(THREE, tur, new THREE.CylinderGeometry(0.34, 0.34, 3.2, 10), m(mcol), x, 1.0, 0.4, [Math.PI / 2, 0, 0]); add(THREE, tur, new THREE.ConeGeometry(0.34, 0.8, 10), m('#ff4d5e'), x, 1.0, 2.4, [Math.PI / 2, 0, 0]); }
  const sv = rk(P.support); const rc = pc(THREE, P.support, '#e8eefc'); const ant = new THREE.Group(); ant.position.set(1.7, 2.0, -2.6); add(THREE, ant, new THREE.CylinderGeometry(0.08, 0.1, 3.4, 5), m('#ccd'), 0, 1.4, 0);
  if (sv <= 1) add(THREE, ant, new THREE.BoxGeometry(1.4, 0.2, 0.2), m(rc), 0, 3.1, 0); else if (sv <= 3) add(THREE, ant, new THREE.CylinderGeometry(1.2, 0.2, 0.6, 12), m(rc), 0, 3.2, 0); else add(THREE, ant, new THREE.BoxGeometry(2.4, 1.6, 0.3), m(rc, 0x222222), 0, 3.4, 0);
  tur.add(ant); g.add(tur); g.userData.turret = tur; g.userData.radar = ant;
  return g;
}

export function makeVehicleModel(THREE, spec) {
  const g = spec.vehicle === 'ship' ? shipModel(THREE, spec) : spec.vehicle === 'tank' ? tankModel(THREE, spec) : planeModel(THREE, spec);
  g.userData.kind = spec.vehicle; return g;
}

// ---- てきの モデル ---------------------------------------------------------------------
export function makeEnemyModel(THREE, type) {
  const m = mats(THREE); const dark = m('#2a1a22', 0, { metalness: 0.5 });
  if (type === 'drone') {
    const g = new THREE.Group(); const skin = new THREE.MeshStandardMaterial({ map: camoTex(THREE, '#8a3a48', { seed: 41, panel: true, blobs: 20 }), metalness: 0.4, roughness: 0.5 });
    const b = add(THREE, g, new THREE.SphereGeometry(2.4, 14, 10), skin); b.scale.set(1.3, 0.55, 1.3); add(THREE, g, new THREE.TorusGeometry(3.6, 0.32, 8, 20), dark, 0, 0, 0, [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 4; i++) { const a = (i / 4) * 6.283; add(THREE, g, new THREE.CylinderGeometry(0.15, 0.15, 3.4, 5), dark, Math.cos(a) * 1.8, 0, Math.sin(a) * 1.8, [Math.PI / 2, 0, -a + Math.PI / 2]); }
    add(THREE, g, new THREE.SphereGeometry(0.75, 8, 8), new THREE.MeshBasicMaterial({ color: '#ff5566' }), 0, 0, 2.4); add(THREE, g, new THREE.SphereGeometry(0.4, 6, 6), new THREE.MeshBasicMaterial({ color: '#ffd23f' }), 0, 0.5, -2.2);
    return g;
  }
  if (type === 'fighter' || type === 'bomber') {
    const spec = { vehicle: 'plane', color: '#7a3340', parts: type === 'bomber' ? { gun: { rarity: 'common', charId: 'e' }, mobility: { rarity: 'rare', charId: 'e' }, support: { rarity: 'common', charId: 'e' } } : {}, missiles: 2 };
    const g = planeModel(THREE, spec, true); g.userData.flame.visible = true; if (type === 'bomber') { g.scale.setScalar(2.1); for (const s of [-1, 1]) for (const x of [3.2, 6]) add(THREE, g, new THREE.CylinderGeometry(0.7, 0.8, 3.4, 12), m('#3a1e28'), s * x, -0.9, 0.6, [Math.PI / 2, 0, 0]); } else g.scale.setScalar(1.0);
    return g;
  }
  if (type === 'boat' || type === 'destroyer') { const g = shipModel(THREE, { vehicle: 'ship', color: '#7a3340', parts: {}, missiles: 2 }, true); g.scale.setScalar(type === 'destroyer' ? 0.95 : 0.55); return g; }
  if (type === 'etank') { const g = tankModel(THREE, { vehicle: 'tank', color: '#7a3340', parts: {}, missiles: 0 }, true); g.scale.setScalar(0.62); const tur = g.userData.turret; if (tur) tur.rotation.y = 0; return g; }
  // boss(くうちゅう ようさい)
  const g = new THREE.Group(); const skin = new THREE.MeshStandardMaterial({ map: camoTex(THREE, '#4a3a5a', { seed: 51, panel: true, blobs: 70, tone: 0.08, size: 512 }), metalness: 0.5, roughness: 0.45 }); const skin2 = new THREE.MeshStandardMaterial({ map: camoTex(THREE, '#35293f', { seed: 52, panel: true, blobs: 50, tone: 0.06, size: 512 }), metalness: 0.5, roughness: 0.45 });
  const hullP = [[0, 120], [26, 80], [54, 30], [58, -40], [40, -110], [-40, -110], [-58, -40], [-54, 30], [-26, 80]]; g.add(topShape(THREE, hullP, 18, skin, -9, true));
  add(THREE, g, new THREE.BoxGeometry(80, 5, 150), skin2, 0, 11.5, -10); add(THREE, g, new THREE.BoxGeometry(26, 32, 40), skin2, 22, 26, 20); add(THREE, g, new THREE.BoxGeometry(18, 10, 26), glassBox(THREE), 22, 40, 34);
  for (const [x, z] of [[-34, -70], [34, -70], [-34, 70], [34, 60], [0, 0]]) { add(THREE, g, new THREE.CylinderGeometry(6, 8, 8, 14), m('#8a3340', 0x220810), x, 16, z); add(THREE, g, new THREE.SphereGeometry(5.6, 12, 8, 0, 6.283, 0, Math.PI / 2), m('#6a2a38'), x, 19, z); add(THREE, g, new THREE.CylinderGeometry(0.9, 1.1, 24, 8), dark, x, 21, z - 14, [Math.PI / 2, 0, 0]); }
  for (const s of [-1, 1]) { add(THREE, g, new THREE.CylinderGeometry(15, 17, 30, 16), m('#2a2030', 0, { metalness: 0.7 }), s * 46, 0, -112, [Math.PI / 2, 0, 0]); add(THREE, g, new THREE.CylinderGeometry(13, 13, 6, 16), new THREE.MeshBasicMaterial({ color: '#ff8a5a', blending: THREE.AdditiveBlending, transparent: true, opacity: 0.9, depthWrite: false }), s * 46, 0, -128, [Math.PI / 2, 0, 0]); }
  for (let i = 0; i < 14; i++) add(THREE, g, new THREE.SphereGeometry(1.6, 6, 5), new THREE.MeshBasicMaterial({ color: i % 2 ? '#ff4d5e' : '#ffd23f' }), ((i % 7) - 3) * 14, 12, 90 - Math.floor(i / 7) * 150);
  return g;
}
