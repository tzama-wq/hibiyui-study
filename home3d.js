// じたくの がいかん(3D): デザイン(HOUSES)と かくちょうレベルで かたち・おおきさ・かざりが かわる。まえ(げんかん)は -z がわ。げんてん=たてものの ちゅうしん(ゆか)。
import { houseOf, HOME_LEVELS } from './cityhome.js';
export function buildHouse(THREE, styleId = 'a', lv = 0) {
  const hs = houseOf(styleId) || houseOf('a'); const g = new THREE.Group(); const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.78, metalness: 0.04, ...o });
  const bx = (w, h, d, c, x, y, z, o) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(c, o)); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  const W = 13 + lv * 2.4; const D = 9 + lv * 1.2; const floors = lv >= 2 ? 2 : 1; const FH = 3.3; const H = FH * floors;
  bx(W + 1.2, 0.35, D + 1.2, '#b9b3a5', 0, 0.17, 0); // きそ
  bx(W, H, D, hs.wall, 0, 0.35 + H / 2, 0);
  if (hs.id === 'd') for (let i = 0; i < 6 * floors; i++) bx(W + 0.02, 0.07, D + 0.02, '#a4694a', 0, 0.8 + i * 0.55, 0); // レンガの すじ
  const top = 0.35 + H;
  if (hs.flat) { bx(W + 0.8, 0.5, D + 0.8, hs.roof, 0, top + 0.25, 0); bx(W * 0.55, 1.4, D * 0.6, '#d8dce2', -W * 0.1, top + 1.2, 0); bx(W * 0.4, 0.35, D * 0.4, hs.roof, -W * 0.1, top + 2.05, 0); }
  else { const roof = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 4), M(hs.roof, { roughness: 0.6 })); roof.scale.set(W * 0.78, 3.2 + lv * 0.5, D * 0.78 + 0.4); roof.rotation.y = Math.PI / 4; roof.position.y = top + (3.2 + lv * 0.5) / 2; roof.castShadow = true; g.add(roof); bx(0.9, 2.2, 0.9, '#8a6a52', W * 0.22, top + 2.2, D * 0.12); }
  if (hs.tower) { const tw = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.3, H + 3.2, 14), M(hs.wall)); tw.position.set(W / 2 + 0.2, 0.35 + (H + 3.2) / 2, D / 2 - 0.4); tw.castShadow = true; g.add(tw); const tr = new THREE.Mesh(new THREE.ConeGeometry(2.7, 3.6, 14), M(hs.roof, { roughness: 0.5 })); tr.position.set(W / 2 + 0.2, 0.35 + H + 3.2 + 1.8, D / 2 - 0.4); tr.castShadow = true; g.add(tr); const fl = bx(0.08, 1.4, 0.7, '#e03a3a', W / 2 + 0.2, 0.35 + H + 3.2 + 4.2, D / 2 - 0.4); fl.position.y += 0.2; }
  // まど・ドア
  const win = (x, y, z, ry) => { const m = bx(1.5, 1.4, 0.12, '#9fd4ff', x, y, z, { metalness: 0.55, roughness: 0.2 }); m.rotation.y = ry; const fr = bx(1.7, 1.6, 0.06, '#f4f4f2', x, y, z - Math.sign(Math.cos(ry) || 1) * 0.04); fr.rotation.y = ry; };
  for (let f = 0; f < floors; f++) { const y = 0.35 + FH * f + 1.9; for (const x of [-W * 0.3, W * 0.3]) { if (!(f === 0 && Math.abs(x) < 2)) win(x, y, -D / 2 - 0.06, 0); win(x, y, D / 2 + 0.06, 0); } for (const z of [-D * 0.2, D * 0.2]) { win(W / 2 + 0.06, y, z, Math.PI / 2); win(-W / 2 - 0.06, y, z, Math.PI / 2); } }
  bx(1.5, 2.5, 0.14, '#6b4a34', 0, 0.35 + 1.25, -D / 2 - 0.08); bx(0.14, 0.14, 0.2, '#e0b04a', 0.5, 0.35 + 1.2, -D / 2 - 0.2); // ドア
  bx(2.6, 0.18, 1.6, '#c9a06a', 0, 0.5, -D / 2 - 0.9); // げんかんの ステップ
  // おにわ: さく・はな・ポスト(かくちょうで ふえる)
  const fw = W + 6 + lv * 1.5; const fd = D + 6 + lv * 1.5;
  for (let i = 0; i < 2 + lv * 2; i++) { const a = (i / (2 + lv * 2)) * 6.283; const fl = new THREE.Mesh(new THREE.SphereGeometry(0.4, 6, 5), M(['#ff7aa0', '#ffd23f', '#9f7aff', '#ff8a4d'][i % 4])); fl.position.set(Math.cos(a) * (W / 2 + 1.8), 0.5, Math.sin(a) * (D / 2 + 1.8)); g.add(fl); }
  for (const sx of [-1, 1]) { bx(0.12, 1.0, fd, '#e8e0d0', sx * fw / 2, 0.5, 0); } bx(fw, 1.0, 0.12, '#e8e0d0', 0, 0.5, fd / 2); for (const sx of [-1, 1]) bx(fw / 2 - 1.6, 1.0, 0.12, '#e8e0d0', sx * (fw / 4 + 0.8), 0.5, -fd / 2);
  bx(0.4, 0.9, 0.3, '#d33', fw / 2 - 1.2, 0.9, -fd / 2 + 0.6); // ポスト
  if (lv >= 1) { const tree = new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 6), M('#3f8f4a')); tree.position.set(-W / 2 - 2.4, 3.2, -D / 2 - 1.6); tree.castShadow = true; g.add(tree); bx(0.35, 2.4, 0.35, '#6a4a30', -W / 2 - 2.4, 1.2, -D / 2 - 1.6); }
  if (lv >= 3) { const pool = bx(5, 0.15, 3.2, '#4fb4e8', W / 2 + 4.2, 0.12, -D / 2 - 2.6, { metalness: 0.3, roughness: 0.2 }); pool.receiveShadow = true; }
  g.userData = { w: W, d: D, lv, maxLv: HOME_LEVELS.length - 1 };
  return g;
}
