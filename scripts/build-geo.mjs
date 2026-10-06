// 都道府県と くにの「かたち」を、アプリで つかえる かるい SVG パスに する(1回だけ 実行)。
//   node scripts/build-geo.mjs <japan.geojson> <ne_110m_admin_0_countries.geojson>
//   元データ: dataofjapan/land(都道府県) と Natural Earth 110m(国)。どちらも パブリックドメイン相当。
// 出力: data/geo.json  { v, pref: {JIS: {n,y,r,c,cy,e,d,w,h}}, world: {A3: {n,y,k,c,cy,e,d,w,h}} }
import { readFile, writeFile } from 'node:fs/promises';
import { PREFS, COUNTRIES } from './lib/geo-names.mjs';

const [, , jpFile, worldFile] = process.argv;
if (!jpFile || !worldFile) { console.error('使い方: node scripts/build-geo.mjs <japan.geojson> <world.geojson>'); process.exit(1); }

const SIZE = 200; // いちばん ながい ほうの 長さ

const ringsOf = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).map((poly) => poly[0]); // 外がわの わっかだけ
const area = (r) => { let a = 0; for (let i = 0; i < r.length; i++) { const [x1, y1] = r[i]; const [x2, y2] = r[(i + 1) % r.length]; a += x1 * y2 - x2 * y1; } return Math.abs(a) / 2; };

function rdp(pts, eps) { // Ramer–Douglas–Peucker
  if (pts.length < 3) return pts;
  const [ax, ay] = pts[0]; const [bx, by] = pts[pts.length - 1];
  const dx = bx - ax; const dy = by - ay; const len = Math.hypot(dx, dy) || 1e-9;
  let mi = 0; let md = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len;
    if (d > md) { md = d; mi = i; }
  }
  if (md <= eps) return [pts[0], pts[pts.length - 1]];
  return [...rdp(pts.slice(0, mi + 1), eps).slice(0, -1), ...rdp(pts.slice(mi), eps)];
}

// keep: いちばん 大きい 島に くらべて この わりあい いじょうの 島だけ のこす
function shapeOf(geometry, keep, eps = 0.7) {
  let rings = ringsOf(geometry);
  const lat = rings.flat().reduce((s, p) => s + p[1], 0) / rings.flat().length;
  const kx = Math.cos((lat * Math.PI) / 180);
  rings = rings.map((r) => r.map(([lo, la]) => [lo * kx, -la]));
  const big = Math.max(...rings.map(area));
  rings = rings.filter((r) => area(r) >= big * keep);
  const all = rings.flat();
  const x0 = Math.min(...all.map((p) => p[0])); const x1 = Math.max(...all.map((p) => p[0]));
  const y0 = Math.min(...all.map((p) => p[1])); const y1 = Math.max(...all.map((p) => p[1]));
  const s = SIZE / Math.max(x1 - x0, y1 - y0);
  const w = Math.round((x1 - x0) * s); const h = Math.round((y1 - y0) * s);
  let d = '';
  for (const r of rings) {
    let pts = r.map(([x, y]) => [(x - x0) * s, (y - y0) * s]);
    if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop(); // とじた わっかの おわりの 重なり
    let far = 1; let fd = 0; // わっかは 始点から いちばん とおい 点で 2つに わけて けずる
    pts.forEach(([x, y], i) => { const dd = Math.hypot(x - pts[0][0], y - pts[0][1]); if (dd > fd) { fd = dd; far = i; } });
    pts = [...rdp(pts.slice(0, far + 1), eps).slice(0, -1), ...rdp([...pts.slice(far), pts[0]], eps).slice(0, -1)];
    pts = pts.map(([x, y]) => [Math.round(x), Math.round(y)]);
    pts = pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]);
    if (pts.length < 3 || area(pts) < 2) continue;
    d += `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) d += `l${pts[i][0] - pts[i - 1][0]} ${pts[i][1] - pts[i - 1][1]}`;
    d += 'z';
  }
  d = d.replace(/ -/g, '-');
  return { d, w, h };
}

const jp = JSON.parse(await readFile(jpFile, 'utf8'));
const world = JSON.parse(await readFile(worldFile, 'utf8'));
const out = { v: 1, pref: {}, world: {} };

const byId = new Map(jp.features.map((f) => [Number(f.properties.id), f]));
for (const [id, n, y, r, c, cy, e] of PREFS) {
  const f = byId.get(id);
  if (!f) { console.error(`都道府県 ${id} ${n} が みつかりません`); process.exit(1); }
  if (f.properties.nam_ja !== n) { console.error(`なまえが ちがいます: ${id} ${f.properties.nam_ja} ≠ ${n}`); process.exit(1); }
  out.pref[id] = { n, y, r, c, cy, e, ...shapeOf(f.geometry, n === '沖縄県' ? 0.1 : 0.12) };
}
const byA3 = new Map(world.features.map((f) => [f.properties.ADM0_A3, f]));
for (const [a3, n, y, k, c, cy, e] of COUNTRIES) {
  const f = byA3.get(a3);
  if (!f) { console.error(`国 ${a3} ${n} が みつかりません`); process.exit(1); }
  out.world[a3] = { n, y, k, c, cy, e, ...shapeOf(f.geometry, 0.08, 0.9) };
}
const json = JSON.stringify(out);
await writeFile(new URL('../data/geo.json', import.meta.url), json);
console.log(`data/geo.json: 都道府県 ${Object.keys(out.pref).length} / 国 ${Object.keys(out.world).length} / ${(json.length / 1024).toFixed(0)}KB`);
