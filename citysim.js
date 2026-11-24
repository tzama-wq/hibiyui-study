// 地球防衛隊「シティ」: じゆうに うごける 街の ルールと うごき(画面には さわらない。node で テストできる)。
//   あるいて・くるま・バイク・せんしゃ・ふね・ひこうき・せんとうきに のりおりして、指名手配はんを たいほして けんしょう金を もらう。
//   const sim = createCity({ stats, vehicles, owned, rnd, gentle, coins, arrests });  sim.input = { turn, climb, gun, boost, aimX, aimY };
//   sim.interact()(のる/おりる/ミッション/おみせ/たいほ) ・ sim.fireMissile() ・ sim.step(dt) ・ sim.takeEvents()
//   ざひょう: x=よこ, y=たかさ, z=おく。からだの むき yaw: まえ = (sin yaw, cos yaw)
import * as CM from './citymap.js';
import { SYMBOLS } from './symbols-data.js';
import { normalizeHome, addFurn, rollFurn, furnOf } from './cityhome.js';
import { JOBS, SWAT_LOAN, SYMPTOMS, JOB_PAY, JSDF } from './cityjobs.js';
import { COLL, collPay } from './citycollect.js';
import { STORY, chapterOf, lvNeeded, jobLevel, jobNext, rankOf, payBonus, rpgLevel, rpgNext, XP_PER_LV, JOB_HOWTO } from './cityquest.js';
export { JOBS, JOB_LIST, SYMPTOMS, JSDF, defenseMission } from './cityjobs.js';
export const { HALF, RIVER, riverDist, inRiver, riverZ, BRIDGES, BRIDGE_W, BRIDGE_E, RAILS, railDist, isWater, PLAZA, SOCCER, SOCCER_ZONE, HOME, AIRFIELD, roadSD, greens, pitches } = CM;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const hyp = Math.hypot;
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
const dirOf = (yaw, pitch) => ({ x: Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: Math.cos(yaw) * Math.cos(pitch) });
const mulberry = CM.mulberry;
const inRect = (r, x, z) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
export const isAir = (k) => k === 'plane' || k === 'jet';
export const isRoad = CM.isRoadAt;
export const roadsOf = CM.roadsOf;
export const MAPDATA = CM.MAP;

// ---- ばしょ(ちずの いちから きまる) ------------------------------------------------------------------
const snap = CM.SNAP; const pn = (x, z, c = 0, r = 260) => CM.pointNear(x, z, c, r);
export const STATION = { x: CM.stationB.x, z: CM.stationB.z }; // 綱島駅(こうかの えき)
export const STATION2 = { x: CM.stationA.x, z: CM.stationA.z }; // 新綱島駅
const polyBox = (poly, fb) => { if (!poly) return fb; const q = CM.polyAABB(poly); return { x0: q.x0, x1: q.x1, z0: q.z0, z1: q.z1, cx: q.cx, cz: q.cz }; };
export const SCHOOL = polyBox(CM.schoolPoly, { x0: 0, x1: 80, z0: 300, z1: 400, cx: 40, cz: 350 }); // 綱島東小学校
export const PARK3 = polyBox(CM.parkPoly, { x0: 220, x1: 280, z0: 330, z1: 410, cx: 250, cz: 370 }); // 綱島東三丁目公園
export const SCHOOL_POLY = CM.schoolPoly; export const PARK3_POLY = CM.parkPoly;
export const HQ = { x: PLAZA.cx, z: PLAZA.cz, r: 30 };
export const BOARD = { x: PLAZA.cx + 48, z: PLAZA.cz - 36 }; // 指名手配ボード
export const KOBAN = { x: PLAZA.cx - 4, z: PLAZA.cz - 46 }; // 駅まえの こうばん
export const GARAGE = { x: HOME.cx, z: HOME.z0 + 38 }; // ガレージ(じたく)
// 「ほんぶ」は じたくに とうごう(かいふく・のりものの しゅうり・ひとじちの おくりとどけ・ふっかつ)。HQ は えきまえの めじるし(ちかくの おみせ・ミッションの きじゅん)としてだけ のこす
export const BASE = { x: GARAGE.x, z: GARAGE.z, r: 26 };
export const SPAWN = { x: GARAGE.x + 10, z: GARAGE.z + 16, yaw: Math.PI };
// えきまえの あたらしい おみせ(ほんもの ちかくの いち。ちず(OSM)には まだ ない)
const llxz = (lat, lon) => ({ x: -(lon - 139.6405) * 111320 * Math.cos((35.5345 * Math.PI) / 180), z: (lat - 35.5345) * 111320 });
export const SQUARE = { ...llxz(35.53569, 139.63559), w: 58, d: 38, h: 64 }; // 新綱島スクエア(えきちょくけつ ふくごうビル)
export const MICCA = { ...llxz(35.53675, 139.637), w: 36, d: 24, h: 12 }; // 新綱島MICCA(こみんか フードモール・2026年10月オープン)
export const MATSU = { ...llxz(35.5364, 139.6364), w: 20, d: 15, h: 11 }; // マツモトキヨシ 新綱島駅前店(新綱島クロス)
const freeAround = (x, z) => { for (let r = 0; r < 120; r += 4) for (let a = 0; a < 16; a++) { const t = (a / 16) * 6.283; const px = x + Math.cos(t) * r; const pz = z + Math.sin(t) * r; if (!CM.isWater(px, pz) && !insideBuilding(px, pz, 0)) return { x: Math.round(px), z: Math.round(pz) }; } return { x, z }; };
export const JOB = { x: 0, z: 0 }; // おべんきょう(綱島東小学校)—あとで きめる
export const ARMS = { x: PLAZA.cx - 56, z: PLAZA.cz + 32 };
export const SECRET = { x: 0, z: 0, arena: { x: 0, z: 0 } }; // かくれキャラ(もりの おくに いる)
export const SHRINE = (() => { const q = CM.shrinePts[0] || [-200, 300]; return { x: q[0], z: q[1] }; })();
export const MALL_TRESA = CM.MALL_TRESA; export const MALL_APITA = CM.MALL_APITA;

// ---- まちの かたち(ほんものの たてもの + とくべつな たてもの) ----------------------------------------------
const mkB = CM.mkB;
function makeLayout() {
  const R = mulberry(11); const blds = CM.buildings().slice(); const trees = [];
  const add = (...bs) => { for (const b of bs) blds.push(b); };
  const clearFor = (b, m = 3) => { for (let i = blds.length - 1; i >= 0; i--) { const o = blds[i]; if (o.x1 > b.x0 - m && o.x0 < b.x1 + m && o.z1 > b.z0 - m && o.z0 < b.z1 + m) blds.splice(i, 1); } return b; };
  const front = (q, kind, name) => { const r = CM.nearestRoadPoint(q.x, q.z, 1, 80); const ang = r ? Math.round((r.ang / (Math.PI / 2)) % 4) * (Math.PI / 2) * 0 + r.ang : 0; const b = mkB(q.x, q.z, q.w, q.d, ang, q.h, kind, { name }); clearFor(b); add(b); return b; };
  front(SQUARE, 'office', 'square'); front(MICCA, 'shop', 'micca'); front(MATSU, 'shop', 'matsukiyo');
  add(mkB(HQ.x - 40, HQ.z + 52, 42, 22, 0, 11, 'station')); // 新綱島駅の しゅつにゅうぐち
  // スーパー(OSMの ばしょ): ちかくの たてものを スーパーに する(なければ あたらしく おく)
  for (const [k, x, z] of SYMBOLS) if (k === 'super') {
    const hitB = blds.find((b) => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && Math.abs((x - b.cx) * b.c + (z - b.cz) * b.s) < b.w / 2 && Math.abs(-(x - b.cx) * b.s + (z - b.cz) * b.c) < b.d / 2 && b.w * b.d >= 150 && b.w * b.d <= 5000 && !['school', 'station', 'hq', 'mall', 'home', 'shrine'].includes(b.kind));
    if (hitB) { hitB.kind = 'supermarket'; hitB.name = 'super'; hitB.h = Math.min(hitB.h, 12); } else { const r = CM.nearestRoadPoint(x, z, 1, 60); const b = mkB(x, z, 26, 18, r ? r.ang : 0, 10, 'supermarket', { name: 'super' }); clearFor(b); add(b); }
  }
  const mk = (m, name, st) => add(mkB(m.cx, m.cz + m.d * 0.18, m.w - 34, m.d * 0.5, 0, 22, 'mall', { name }));
  mk(MALL_TRESA, 'tresa'); mk(MALL_APITA, 'apita');
  add(mkB(HOME.cx, HOME.z1 - 13, 24, 14, 0, 8, 'home')); // じたく
  const ac = (AIRFIELD.x0 + AIRFIELD.x1) / 2; add(mkB(ac - 90, AIRFIELD.z1 - 26, 60, 36, 0, 16, 'hangar'), mkB(ac + 20, AIRFIELD.z1 - 26, 50, 36, 0, 16, 'hangar'));
  add(mkB(SHRINE.x, SHRINE.z, 28, 16, 0, 8, 'shrine'));
  // こうかせんの はしら(せんろに そって 40mごと)
  for (const P of Object.values(RAILS)) for (let i = 1; i < P.length; i++) { const [ax, az] = P[i - 1]; const [bx, bz] = P[i]; const len = hyp(bx - ax, bz - az); const n = Math.floor(len / 40); for (let k = 1; k < n; k++) { const x = ax + ((bx - ax) * k) / n; const z = az + ((bz - az) * k) / n; if (Math.abs(x) > HALF - 8 || Math.abs(z) > HALF - 8 || CM.roadSD(x, z) < 5 || CM.inRiver(x, z) || inRect({ x0: AIRFIELD.x0 - 12, x1: AIRFIELD.x1 + 12, z0: AIRFIELD.z0 - 12, z1: AIRFIELD.z1 + 12 }, x, z) || inRect({ x0: PLAZA.x0 - 4, x1: PLAZA.x1 + 4, z0: PLAZA.z0 - 4, z1: PLAZA.z1 + 4 }, x, z)) continue; add(mkB(x, z, 1.6, 1.6, 0, 9, 'pillar', { rail: Math.atan2(bz - az, bx - ax) })); } }
  // き(こうえん・もり)
  for (const g of CM.greens) { const q = CM.polyAABB(g.poly); const area = (q.x1 - q.x0) * (q.z1 - q.z0) * 0.6; if (area < 300) continue; const n = Math.min(44, Math.floor(area / (g.kind === 'forest' || g.kind === 'wood' ? 260 : 420))); for (let i = 0, t = 0; i < n && t < n * 6; t++) { const x = lerp(q.x0, q.x1, R()); const z = lerp(q.z0, q.z1, R()); if (!CM.polyIn(g.poly, x, z) || Math.abs(x) > HALF - 5 || Math.abs(z) > HALF - 5 || CM.roadSD(x, z) < 2 || CM.riverDist(x, z) < RIVER.hw + 4 || blds.some((b) => x > b.x0 - 2 && x < b.x1 + 2 && z > b.z0 - 2 && z < b.z1 + 2 && Math.abs((x - b.cx) * b.c + (z - b.cz) * b.s) < b.w / 2 + 2 && Math.abs(-(x - b.cx) * b.s + (z - b.cz) * b.c) < b.d / 2 + 2)) continue; if ([PLAZA, HOME, AIRFIELD, MALL_TRESA, MALL_APITA, SOCCER_ZONE].some((r) => inRect({ x0: r.x0 - 4, x1: r.x1 + 4, z0: r.z0 - 4, z1: r.z1 + 4 }, x, z))) continue; trees.push({ x, z, s: 0.8 + R() * 0.9 }); i++; } }
  return { buildings: blds, trees };
}
export const LAYOUT = makeLayout();
const CELL = new Map();
for (const b of LAYOUT.buildings) { const i0 = Math.floor(b.x0 / 80); const i1 = Math.floor(b.x1 / 80); const j0 = Math.floor(b.z0 / 80); const j1 = Math.floor(b.z1 / 80); for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = `${i},${j}`; if (!CELL.has(k)) CELL.set(k, []); CELL.get(k).push(b); } }
const nearB = (x, z) => { const i = Math.floor(x / 80); const j = Math.floor(z / 80); const out = []; for (let a = i - 1; a <= i + 1; a++) for (let c = j - 1; c <= j + 1; c++) { const l = CELL.get(`${a},${c}`); if (l) for (const b of l) if (!out.includes(b)) out.push(b); } return out; };
// かたむいた たてものに めりこまない
function pushOut(p, r, ys = 0) {
  let hit = false;
  for (const b of nearB(p.x, p.z)) {
    if (ys > b.h + 1) continue; if (p.x < b.x0 - r || p.x > b.x1 + r || p.z < b.z0 - r || p.z > b.z1 + r) continue;
    const dx = p.x - b.cx; const dz = p.z - b.cz; const lx = dx * b.c + dz * b.s; const lz = -dx * b.s + dz * b.c; const hw = b.w / 2; const hd = b.d / 2;
    const qx = clamp(lx, -hw, hw); const qz = clamp(lz, -hd, hd); const ex = lx - qx; const ez = lz - qz; const d = hyp(ex, ez); let nx = lx; let nz = lz;
    if (d < r) { hit = true; if (d > 0.001) { nx = qx + (ex / d) * r; nz = qz + (ez / d) * r; } else { const l = lx + hw; const rr = hw - lx; const t = lz + hd; const bt = hd - lz; const m = Math.min(l, rr, t, bt); if (m === l) nx = -hw - r; else if (m === rr) nx = hw + r; else if (m === t) nz = -hd - r; else nz = hd + r; } p.x = b.cx + nx * b.c - nz * b.s; p.z = b.cz + nx * b.s + nz * b.c; }
  }
  return hit;
}
// そとかいだん(らせん)で おくじょうへ いける たてもの(スナイパーの ねらいうちポイント)
export const STAIRS = LAYOUT.buildings.map((b, bi) => ({ b, bi })).filter(({ b, bi }) => b.h >= 10 && ['apt', 'office', 'shop', 'warehouse', 'supermarket'].includes(b.kind) && bi % 6 === 0).map(({ b, bi }) => { const lx = b.w / 2 + 2.3; const lz = b.d * 0.2; return { bi, x: b.cx + lx * b.c - lz * b.s, z: b.cz + lx * b.s + lz * b.c, h: b.h }; });
// アジト: ギャングの かくれが。とびらは おおきな たてものの まえ・なかは あいている とちの うえの そら(y=600)にある へや
export const ROOM_Y = 600;
let HIDE = null;
export const hideoutSites = () => {
  if (HIDE) return HIDE; const sites = [];
  for (let gx = -HALF + 140; gx <= HALF - 140; gx += 60) for (let gz = -HALF + 140; gz <= HALF - 140; gz += 60) {
    if (sites.length >= 6) break; if (CM.isWater(gx, gz) || inRect(AIRFIELD, gx, gz) || inRect(HOME, gx, gz) || CM.inRiver(gx, gz)) continue; let ok = true;
    for (const rr of [0, 24, 46]) for (let k = 0; k < 8 && ok; k++) { const px = gx + Math.cos(k * 0.785) * rr; const pz = gz + Math.sin(k * 0.785) * rr; if (insideBuilding(px, pz, 0) || CM.isWater(px, pz)) ok = false; }
    if (ok && sites.every((q) => hyp(q.x - gx, q.z - gz) > 260)) sites.push({ x: gx, z: gz });
  }
  const bl = LAYOUT.buildings.filter((b) => ['warehouse', 'shop', 'apt', 'office'].includes(b.kind) && b.w * b.d > 260 && b.h >= 6).sort((a, b) => b.w * b.d - a.w * a.d || a.cx - b.cx); const ents = [];
  for (const b of bl) { if (ents.length >= sites.length) break; const lz = b.d / 2 + 2.6; const ex = b.cx - lz * b.s; const ez = b.cz + lz * b.c; if (insideBuilding(ex, ez, 0) || CM.isWater(ex, ez) || ents.some((q) => hyp(q.x - ex, q.z - ez) > 0 && hyp(q.x - ex, q.z - ez) < 170) || hyp(ex - SPAWN.x, ez - SPAWN.z) < 120) continue; ents.push({ x: ex, z: ez, b }); }
  HIDE = sites.slice(0, ents.length).map((st, i) => ({ id: `h${i}`, lv: i + 1, ex: ents[i].x, ez: ents[i].z, cx: st.x, cz: st.z, x0: st.x - 17, x1: st.x + 17, z0: st.z - 12, z1: st.z + 12 }));
  return HIDE;
};
// アジトの なかの しゃへいぶつ(コンクリの かべ・はこ・はしら): たまが あたらない・とおれない
export const hideCover = (h) => {
  const L = []; const B = (dx, dz, w, d, hh = 2.2) => L.push({ x0: h.cx + dx - w / 2, x1: h.cx + dx + w / 2, z0: h.cz + dz - d / 2, z1: h.cz + dz + d / 2, h: hh });
  B(-9, 4, 7, 1, 2.2); B(9, 4, 7, 1, 2.2); B(0, -1, 6, 2.4); B(-12, -6, 2.2, 2.2); B(12, -6, 2.2, 2.2); B(-5, -8.5, 1.6, 1.6); B(5, -8.5, 1.6, 1.6); B(-5.5, -4, 1, 5, 2.4); B(5.5, -4, 1, 5, 2.4);
  return L;
};
// つりスポット(かわぞい): GTAの アクティビティ(つり)を さんこう
let FISH = null;
export const fishSpots = () => {
  if (FISH) return FISH; const out = [];
  for (let x = -HALF + 120; x <= HALF - 120 && out.length < 6; x += 70) { const rz = riverZ(x); for (const sd of [-1, 1]) { const z = rz + sd * (RIVER.hw + 5); if (Math.abs(z) > HALF - 60 || CM.isWater(x, z) || insideBuilding(x, z, 0) || out.some((q) => hyp(q.x - x, q.z - z) < 200)) continue; out.push({ i: out.length, x, z }); break; } }
  FISH = out; return out;
};
export const insideBuilding = (x, z, ys = 0) => nearB(x, z).some((b) => { if (ys > b.h) return false; if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) return false; const dx = x - b.cx; const dz = z - b.cz; return Math.abs(dx * b.c + dz * b.s) <= b.w / 2 && Math.abs(-dx * b.s + dz * b.c) <= b.d / 2; });
{ const jp = freeAround(CM.POI.school ? CM.POI.school.c[0] : SCHOOL.cx, CM.POI.school ? CM.POI.school.c[1] : SCHOOL.cz); JOB.x = jp.x; JOB.z = jp.z; }
{ const fo = CM.greens.filter((g) => g.kind === 'forest').map((g) => ({ g, q: CM.polyAABB(g.poly) })).sort((a, b) => (b.q.x1 - b.q.x0) * (b.q.z1 - b.q.z0) - (a.q.x1 - a.q.x0) * (a.q.z1 - a.q.z0))[0]; const cx = fo ? fo.q.cx : -666; const cz = fo ? fo.q.cz : 290; const p = freeAround(cx, cz); SECRET.x = p.x; SECRET.z = p.z; SECRET.arena = freeAround(cx + 70, cz + 40); }
// あそびば: ボウリング・ゲームセンター(えきまえ ひろばの ちかく)
export const PLAYSPOTS = (() => { const a = freeAround(PLAZA.cx - 36, PLAZA.cz + 8); const b = freeAround(PLAZA.cx + 36, PLAZA.cz + 8); return [{ id: 'bowl', name: 'ボウリング', icon: '🎳', x: a.x, z: a.z, cost: 100, max: 600 }, { id: 'arcade', name: 'ゲームセンター', icon: '🕹️', x: b.x, z: b.z, cost: 100, max: 1600 }]; })();
export const COMMANDER = { x: 0, z: 0 }; // じえいたいの ちょうかん(きちに いる)
{ const q = freeAround(AIRFIELD.x0 + 34, AIRFIELD.z1 - 10); COMMANDER.x = q.x; COMMANDER.z = q.z; }
// みちの ひろいあげ: ちずの みちの うえの ランダムな てん
export const roadPoint = (R, minCls = 1) => { const rl = CM.roadsOf().filter((r) => r.cls >= minCls && r.pts.length >= 2); for (let t = 0; t < 40; t++) { const r = rl[Math.floor(R() * rl.length)]; const i = 1 + Math.floor(R() * (r.pts.length - 1)); const a = r.pts[i - 1]; const b = r.pts[i]; const u = R(); const x = lerp(a[0], b[0], u); const z = lerp(a[1], b[1], u); if (!CM.isWater(x, z) && Math.abs(x) < HALF - 20 && Math.abs(z) < HALF - 20) return { x, z, ang: Math.atan2(b[1] - a[1], b[0] - a[0]), r, i, u }; } return { x: HQ.x, z: HQ.z + 40, ang: 0 }; };

// ---- あるく・のりものの せいのう ------------------------------------------------------------------
export const footStats = (ks) => ({ vehicle: 'foot', speed: (5.6 + ks.SPD * 0.0064) * 0.62, run: (9.6 + ks.SPD * 0.0096) * 0.62, hpMax: Math.round(70 + ks.DEF * 0.7), gunDps: Math.round(18 + ks.SHO * 0.1), range: 75, turn: 2.4 });
// のりものカタログ(model=3Dの かたち)。price=コイン。free=さいしょから もっている
export const VCAT = [
  { id: 'sedan', name: 'ふつうの くるま', icon: '🚗', kind: 'car', model: 'sedan', price: 0, free: true, speed: 18, turn: 1.7, hp: 130, gun: 20, desc: 'まちを はしる ふつうの くるま' },
  { id: 'police', name: 'パトカー', icon: '🚓', kind: 'car', model: 'police', price: 0, free: true, speed: 21, turn: 1.8, hp: 170, gun: 26, desc: 'サイレンつき! ぼうえいたいの パトカー' },
  { id: 'scooter', name: 'スクーター', icon: '🛵', kind: 'bike', model: 'scooter', price: 0, free: true, speed: 14, turn: 2.6, hp: 60, gun: 14, desc: 'ちいさくて こまわりが きく' },
  { id: 'taxi', name: 'タクシー', icon: '🚕', kind: 'car', model: 'taxi', price: 800, speed: 17, turn: 1.7, hp: 130, gun: 16, desc: 'きいろい タクシー' },
  { id: 'suv', name: 'SUV', icon: '🚙', kind: 'car', model: 'suv', price: 1800, speed: 19, turn: 1.5, hp: 210, gun: 22, desc: 'がんじょうな 4WD' },
  { id: 'bike', name: 'バイク', icon: '🏍️', kind: 'bike', model: 'bike', price: 1400, speed: 26, turn: 2.6, hp: 70, gun: 18, desc: 'はやい ロードバイク' },
  { id: 'pbike', need: { a: 2 }, name: '白バイ', icon: '🏍️', kind: 'bike', model: 'pbike', price: 2080, speed: 25, turn: 2.7, hp: 95, gun: 24, desc: 'サイレンつきの けいさつの バイク' },
  { id: 'bus', name: 'バス', icon: '🚌', kind: 'car', model: 'bus', price: 3800, speed: 14, turn: 1.1, hp: 420, gun: 0, desc: 'おおきな まちの バス(ぶつかっても へいき)' },
  { id: 'truck', name: 'トラック', icon: '🚚', kind: 'car', model: 'truck', price: 2600, speed: 13, turn: 1.2, hp: 340, gun: 18, desc: 'おおきくて とても じょうぶ' },
  { id: 'sports', need: { a: 1 }, name: 'スポーツカー', icon: '🏎️', kind: 'car', model: 'sports', price: 3200, speed: 28, turn: 2.0, hp: 125, gun: 22, desc: 'スピードが じまんの くるま' },
  { id: 'racer', need: { m: 3 }, name: 'レーサーバイク', icon: '🏍️', kind: 'bike', model: 'racer', price: 6000, speed: 38, turn: 2.8, hp: 70, gun: 18, desc: 'ちょう はやい バイク' },
  { id: 'cessna', name: 'プロペラ機', icon: '🛩️', kind: 'plane', model: 'cessna', price: 2400, speed: 50, turn: 0.95, hp: 100, gun: 0, desc: 'ゆっくり そらを さんぽ' },
  { id: 'super', need: { a: 3 }, name: 'スーパーカー', icon: '🏎️', kind: 'car', model: 'super', price: 9600, speed: 34, turn: 2.1, hp: 115, gun: 24, desc: 'とびきり はやい!' },
  { id: 'trainer', need: { m: 2 }, name: 'れんしゅうき', icon: '✈️', kind: 'jet', model: 'trainer', price: 6000, speed: 92, turn: 1.1, hp: 130, gun: 24, missiles: 2, desc: 'ジェットの はじめの いっぽ' },
  { id: 'bizjet', need: { m: 5 }, name: 'ビジネスジェット', icon: '🛫', kind: 'jet', model: 'bizjet', price: 10000, speed: 125, turn: 0.95, hp: 150, gun: 0, desc: 'そらを ゆうがに ひこう' },
  { id: 'hawk', need: { a: 5, m: 4 }, name: 'ホーク せんとうき', icon: '🛩️', kind: 'jet', model: 'fighter', price: 18000, speed: 138, turn: 1.1, hp: 170, gun: 42, missiles: 6, desc: 'ミサイルを つんだ せんとうき' },
  { id: 'phantom', need: { a: 8, m: 6 }, name: 'ファントム ステルス', icon: '✈️', kind: 'jet', model: 'stealth', price: 36000, speed: 165, turn: 1.15, hp: 210, gun: 56, missiles: 8, desc: 'さいしんの ステルス せんとうき' },
  // しょくぎょうの のりもの(その しょくぎょうの ときだけ のれる)
  { id: 'firetruck', job: 'fire', name: 'しょうぼうしゃ', icon: '🚒', kind: 'car', model: 'firetruck', price: 0, free: true, speed: 20, turn: 1.3, hp: 320, gun: 0, desc: 'みずを だして かじを けす' },
  { id: 'ambulance', job: 'ems', name: 'きゅうきゅうしゃ', icon: '🚑', kind: 'car', model: 'ambulance', price: 0, free: true, speed: 25, turn: 1.7, hp: 200, gun: 0, desc: 'かんじゃを びょういんへ はこぶ' },
  { id: 'swatvan', job: 'swat', name: 'SWATの そうこうしゃ', icon: '🚐', kind: 'car', model: 'swatvan', price: 0, free: true, speed: 23, turn: 1.4, hp: 380, gun: 34, desc: 'がんじょうな ぼうだんしゃ' },
];
export const catalogOf = (id) => VCAT.find((v) => v.id === id);
// かわないと のれない とくべつな きかん(せんしゃ・ぼうえいたいの せんとうき)
export const SPECIALS = [
  { id: 'tank', name: 'せんしゃ', icon: '🚜', price: 14000, need: { m: 2 }, speed: 22, desc: 'ミサイルつきの ぼうえいたいの せんしゃ' },
  { id: 'plane', name: 'ぼうえいたいの せんとうき', icon: '✈️', price: 9000, need: { m: 1 }, speed: 110, desc: 'きみの チームで つくった せんとうき' },
];
export const specialOf = (id) => SPECIALS.find((x) => x.id === id);
// かいほうじょうけん: a=つかまえた 指名手配はんの にんずう / m=クリアした ミッションの かいすう
export const needText = (n) => (n ? [n.all ? 'そうび・のりもの・せんとうきを ぜんぶ かう' : '', n.secret ? 'まちの かくれキャラの しれんに クリア' : '', n.m ? `ミッション ${n.m}かい クリア` : '', n.a ? `指名手配はん ${n.a}にん たいほ` : '', n.j ? `がっこうの おべんきょうで せいかい ${n.j}もん` : ''].filter(Boolean).join(' + ') : '');
// ぶきカタログ(GTAの ぶきを まなんだ ラインナップ。たまは なくならない)。rate=1びょうに なんかい / expl=ばくはつ / g=おちる つよさ
export const WEAPONS = [
  { id: 'fist', name: 'こぶし', icon: '👊', cat: '近接', price: 0, melee: true, dmg: 8, rate: 2.5, range: 2.6 },
  { id: 'bat', name: 'バット', icon: '🏏', cat: '近接', price: 0, melee: true, dmg: 20, rate: 1.6, range: 3.6 },
  { id: 'knife', name: 'ナイフ', icon: '🔪', cat: '近接', price: 360, melee: true, dmg: 16, rate: 3.5, range: 2.8 },
  { id: 'hammer', name: 'ハンマー', icon: '🔨', cat: '近接', price: 480, melee: true, dmg: 26, rate: 1.5, range: 3.4 },
  { id: 'crowbar', name: 'バール', icon: '🪛', cat: '近接', price: 2400, melee: true, dmg: 30, rate: 2.0, range: 3.4 },
  { id: 'machete', name: '山刀', icon: '🗡️', cat: '近接', price: 3200, melee: true, dmg: 34, rate: 2.2, range: 3.6, need: { a: 1 } },
  { id: 'axe', name: 'バトルアックス', icon: '🪓', cat: '近接', price: 5600, melee: true, dmg: 55, rate: 1.1, range: 3.8, need: { a: 3 } },
  { id: 'pistol', name: 'ピストル', icon: '🔫', cat: 'ハンドガン', price: 0, dmg: 14, rate: 2.6, range: 50, spread: 0.01, snd: 'gun' },
  { id: 'combatpistol', name: '軍用ピストル', icon: '🔫', cat: 'ハンドガン', price: 1600, dmg: 17, rate: 3.0, range: 52, spread: 0.01, snd: 'gun' },
  { id: 'heavypistol', name: 'ヘビーピストル', icon: '🔫', cat: 'ハンドガン', price: 3200, dmg: 26, rate: 2.2, range: 58, spread: 0.012, snd: 'gun' },
  { id: 'pistol50', name: '50口径ピストル', icon: '🔫', cat: 'ハンドガン', price: 4800, dmg: 38, rate: 1.6, range: 65, spread: 0.012, snd: 'boom' },
  { id: 'revolver', name: 'ヘビーリボルバー', icon: '🔫', cat: 'ハンドガン', price: 7200, dmg: 55, rate: 1.2, range: 75, spread: 0.01, snd: 'boom', need: { m: 2 } },
  { id: 'appistol', name: 'APピストル', icon: '🔫', cat: 'ハンドガン', price: 9600, dmg: 14, rate: 8, range: 45, spread: 0.03, snd: 'gun', need: { a: 1 } },
  { id: 'microsmg', name: 'マイクロSMG', icon: '🔫', cat: 'SMG', price: 4000, dmg: 8, rate: 11, range: 40, spread: 0.04, snd: 'gun' },
  { id: 'smg', name: 'SMG', icon: '🔫', cat: 'SMG', price: 6400, dmg: 9, rate: 10, range: 50, spread: 0.035, snd: 'gun' },
  { id: 'assaultsmg', name: 'アサルトSMG', icon: '🔫', cat: 'SMG', price: 10400, dmg: 11, rate: 11, range: 55, spread: 0.035, snd: 'gun', need: { a: 2 } },
  { id: 'combatpdw', name: 'コンバットPDW', icon: '🔫', cat: 'SMG', price: 12000, dmg: 12, rate: 10, range: 60, spread: 0.03, snd: 'gun', need: { m: 2 } },
  { id: 'sawedoff', name: 'ソードオフ・ショットガン', icon: '💥', cat: 'ショットガン', price: 3200, dmg: 8, rate: 1.3, range: 18, pellets: 6, spread: 0.2, snd: 'boom' },
  { id: 'pump', name: 'ポンプ式ショットガン', icon: '💥', cat: 'ショットガン', price: 5600, dmg: 7, rate: 1.1, range: 28, pellets: 8, spread: 0.12, snd: 'boom' },
  { id: 'dbarrel', name: '二連式ショットガン', icon: '💥', cat: 'ショットガン', price: 11200, dmg: 9, rate: 0.9, range: 26, pellets: 10, spread: 0.14, snd: 'boom', need: { a: 2 } },
  { id: 'assaultsg', name: 'アサルト・ショットガン', icon: '💥', cat: 'ショットガン', price: 14400, dmg: 6, rate: 3, range: 32, pellets: 6, spread: 0.12, snd: 'boom', need: { a: 3 } },
  { id: 'assault', name: 'アサルトライフル', icon: '🔫', cat: 'ライフル', price: 14400, dmg: 12, rate: 8, range: 110, spread: 0.02, snd: 'gun', need: { m: 2 } },
  { id: 'carbine', name: 'カービンライフル', icon: '🔫', cat: 'ライフル', price: 17600, dmg: 13, rate: 9, range: 120, spread: 0.015, snd: 'gun', need: { m: 3 } },
  { id: 'specialcarbine', name: '特殊カービン', icon: '🔫', cat: 'ライフル', price: 20000, dmg: 14, rate: 8.5, range: 125, spread: 0.015, snd: 'gun', need: { a: 3 } },
  { id: 'heavyrifle', name: 'ヘビーライフル', icon: '🔫', cat: 'ライフル', price: 48000, dmg: 18, rate: 8, range: 140, spread: 0.012, snd: 'boom', need: { a: 6 } },
  { id: 'mg', name: 'マシンガン', icon: '🔫', cat: 'マシンガン', price: 24000, dmg: 11, rate: 12, range: 115, spread: 0.04, snd: 'gun', need: { m: 4 } },
  { id: 'combatmg', name: '軍用マシンガン', icon: '🔫', cat: 'マシンガン', price: 32000, dmg: 13, rate: 12, range: 125, spread: 0.035, snd: 'gun', need: { a: 4 } },
  { id: 'minigun', name: 'ミニガン', icon: '⚙️', cat: 'マシンガン', price: 72000, dmg: 10, rate: 30, range: 100, spread: 0.06, snd: 'gun', need: { a: 6 } },
  { id: 'sniper', name: 'スナイパーライフル', icon: '🎯', cat: 'スナイパー', price: 20000, dmg: 110, rate: 0.8, range: 320, spread: 0.002, snd: 'boom', need: { m: 3 } },
  { id: 'marksman', name: 'マークスマンライフル', icon: '🎯', cat: 'スナイパー', price: 24000, dmg: 70, rate: 1.6, range: 260, spread: 0.004, snd: 'boom', need: { a: 3 } },
  { id: 'heavysniper', name: 'ヘビースナイパー', icon: '🎯', cat: 'スナイパー', price: 40000, dmg: 220, rate: 0.5, range: 420, spread: 0.002, snd: 'boom', need: { a: 5 } },
  { id: 'grenade', name: '手榴弾', icon: '💣', cat: 'とうてき', price: 2000, expl: true, dmg: 90, rate: 0.8, range: 35, speed: 34, lob: 0.35, g: 24, snd: 'missile' },
  { id: 'molotov', name: '火炎瓶', icon: '🍾', cat: 'とうてき', price: 2400, expl: true, dmg: 60, rate: 0.9, range: 30, speed: 30, lob: 0.4, g: 24, snd: 'missile' },
  { id: 'grenadel', name: 'グレネード・ランチャー', icon: '🚀', cat: 'じゅうかき', price: 36000, expl: true, dmg: 120, rate: 0.8, range: 140, speed: 60, lob: 0.15, g: 14, snd: 'missile', need: { a: 4 } },
  { id: 'rpg', name: 'ロケット・ランチャー', icon: '🚀', cat: 'じゅうかき', price: 48000, expl: true, dmg: 160, rate: 0.6, range: 300, speed: 95, lob: 0, g: 0, snd: 'missile', need: { m: 5 } },
  { id: 'homing', name: 'ホーミングランチャー', icon: '🚀', cat: 'じゅうかき', price: 96000, expl: true, homing: true, dmg: 150, rate: 0.5, range: 400, speed: 80, lob: 0.2, g: 0, snd: 'missile', need: { a: 8, m: 6 } },
  { id: 'railgun', name: 'レイルガン', icon: '⚡', cat: 'じゅうかき', price: 160000, dmg: 400, rate: 0.4, range: 450, spread: 0.001, snd: 'bigboom', need: { a: 8, m: 6 } },
];
export const weaponOf = (id) => WEAPONS.find((w) => w.id === id);
// たまの せってい: [マガジン, リロード(びょう), もてる たまの かず, はんどう(うつと うえに ぶれる), きょりに よる ダメージの げんすい(0=なし)]
const AMMO = {
  pistol: [12, 1.2, 120, 0.012, 0.35], combatpistol: [12, 1.1, 120, 0.012, 0.35], heavypistol: [8, 1.4, 80, 0.02, 0.3], pistol50: [9, 1.5, 72, 0.026, 0.25], revolver: [6, 2.2, 48, 0.034, 0.2], appistol: [18, 1.3, 180, 0.01, 0.4],
  microsmg: [20, 1.4, 200, 0.008, 0.5], smg: [30, 1.6, 240, 0.008, 0.45], assaultsmg: [30, 1.5, 240, 0.008, 0.4], combatpdw: [30, 1.6, 240, 0.007, 0.35],
  sawedoff: [2, 1.8, 24, 0.045, 0.85], pump: [6, 2.4, 48, 0.04, 0.8], dbarrel: [2, 2.0, 30, 0.05, 0.75], assaultsg: [8, 2.4, 64, 0.03, 0.7],
  assault: [30, 2.0, 240, 0.009, 0.25], carbine: [30, 1.9, 240, 0.008, 0.2], specialcarbine: [30, 1.9, 240, 0.008, 0.2], heavyrifle: [30, 2.4, 210, 0.012, 0.15],
  mg: [60, 4.0, 360, 0.01, 0.3], combatmg: [100, 4.5, 500, 0.01, 0.25], minigun: [200, 5.5, 1000, 0.008, 0.3],
  sniper: [5, 2.8, 40, 0.05, 0], marksman: [8, 2.4, 64, 0.03, 0.05], heavysniper: [3, 3.6, 18, 0.07, 0],
  grenade: [1, 1.0, 10, 0.02, 0], molotov: [1, 1.2, 10, 0.02, 0], grenadel: [6, 3.0, 24, 0.03, 0], rpg: [1, 3.2, 10, 0.04, 0], homing: [1, 3.6, 6, 0.04, 0], railgun: [3, 3.5, 12, 0.05, 0],
};
// ぜんぶ かって かくしミッションを クリアすると かえる 「さいきょうの ぶき」
WEAPONS.push({ id: 'omega', name: '👑 オメガ ブラスター', icon: '🌟', cat: 'じゅうかき', price: 1500000, dmg: 900, rate: 0.9, range: 600, spread: 0.0004, snd: 'bigboom', need: { all: true, secret: true } }, { id: 'tempest', name: '👑 テンペスト ガトリング', icon: '🌪️', cat: 'じゅうかき', price: 1000000, dmg: 70, rate: 16, range: 320, spread: 0.008, snd: 'gun', need: { all: true, secret: true } });
AMMO.omega = [3, 3.0, 15, 0.05, 0]; AMMO.tempest = [300, 5, 1500, 0.01, 0.2];
export const ammoSpec = (w) => { const a = w && AMMO[w.id]; return a ? { mag: a[0], reload: a[1], cap: a[2], recoil: a[3], fall: a[4] } : null; };
export const DEFAULT_WEAPONS = WEAPONS.filter((w) => !w.price).map((w) => w.id);
export const DEFAULT_OWNED = VCAT.filter((v) => v.free).map((v) => v.id);
// カタログの のりものの せいのう(しゅじんこうの つよさで すこし のびる)
export function catalogV(it, ks) {
  const air = isAir(it.kind);
  return { vehicle: it.kind, model: it.model, name: it.name, speed: (it.speed + ks.SPD * (air ? 0.08 : 0.04)) * (air || it.kind === 'ship' ? 1 : 0.7), hpMax: Math.round(it.hp + ks.DEF * (air ? 0.8 : 1.0)), gunDps: it.gun ? Math.round(it.gun + ks.SHO * 0.1) : 0, turn: it.turn, missiles: it.missiles || 0, missileDmg: it.missiles ? Math.round(70 + ks.SHO * 0.3) : 0, locks: it.missiles ? 2 : 0, boostMax: 60 + Math.round(ks.STA * 0.4) };
}
export const carStats = (ks) => catalogV(catalogOf('sedan'), ks); // (むかしの なまえ)

// ---- 指名手配はん(けんしょう金つき) -------------------------------------------------------------
const TAC = { thug: { pref: 12, strafe: 0.5, rush: 1 }, gunman: { pref: 30, strafe: 1 }, boss: { pref: 34, cover: 1, strafe: 0.6 }, elite: { pref: 26, orbit: 1, dash: 1 }, legend: { pref: 22, orbit: 1, dash: 1, rush: 0.4 }, cop: { pref: 28, strafe: 1 }, bounty: { pref: 34, cover: 1, strafe: 0.5 } };
export const DIFF_HP = 1.8; export const DIFF_DMG = 1.5; // てきの つよさ(HP・ダメージ)
export const CROOKS = {
  thug: { name: 'チンピラ', hp: 50, dmg: 4, speed: 4.6, range: 55, fire: 1.7 },
  gunman: { name: 'ごうとう', hp: 90, dmg: 6, speed: 5, range: 70, fire: 1.4 },
  boss: { name: 'ボス', hp: 260, dmg: 9, speed: 4.2, range: 85, fire: 1.0 },
  runner: { name: 'ひったくり', hp: 36, dmg: 0, speed: 8.5, range: 0, fire: 99 },
  elite: { name: 'エリート', hp: 420, dmg: 11, speed: 6, range: 95, fire: 0.8, rad: 3.2 },
  legend: { name: 'レジェンド', hp: 1200, dmg: 15, speed: 6.2, range: 110, fire: 0.6, rad: 3.8 },
  cop: { name: 'おまわりさん', hp: 80, dmg: 5, speed: 5.8, range: 60, fire: 1.3 },
  bounty: { name: '賞金かせぎ', hp: 120, dmg: 7, speed: 6, range: 75, fire: 1.0 },
};
// てはい(指名手配): はんざいの おもさで 「てはいど」が ふえる→★の かず。じかんで きえる・こうばんで ばっきん
export const AUTOAIM_EXTRA = 5; export const AUTOAIM_MAX_VEH = 140; // オートAIM・ロックオン: ぶきの しゃてい+5m まで(のりもの: くるま・バイクは 140m)。とおすぎる てきには ききません
export const HEAT_DUR = [0, 150, 240, 360, 480, 900]; export const HEAT_FINE = [0, 200, 500, 1000, 1800, 3000]; // ★5は ばっきん・ワープでは けせない。ながい あいだ(15ふん) にげきれば おわる
export const WANTED = [
  { id: 'joe', name: 'コソドロ ジョー', crime: 'ぬすみ・ごうとう みすい', stars: 1, bounty: 100, type: 'thug', spot: pn(HQ.x - 360, HQ.z + 40), guards: 0 },
  { id: 'momo', name: 'ひったくり モモ', crime: 'ひったくり れんぞく', stars: 1, bounty: 140, type: 'runner', spot: pn(HQ.x - 180, HQ.z + 330), guards: 0 },
  { id: 'gonzo', name: 'ゴンゾー', crime: 'ぎんこう ごうとう', stars: 2, bounty: 320, type: 'gunman', spot: pn(HQ.x - 560, HQ.z + 280), guards: 2 },
  { id: 'rex', name: 'レックス', crime: 'ほうせき どろぼう', stars: 2, bounty: 420, type: 'gunman', spot: pn(HQ.x - 120, -330, 1, 500), guards: 2 },
  { id: 'viper', name: 'ヴァイパー', crime: 'ぶき ゆそう', stars: 3, bounty: 700, type: 'gunman', spot: pn(-380, -420, 1, 500), guards: 3 },
  { id: 'shadow', name: 'シャドウ', crime: 'みなとの みつゆ', stars: 3, bounty: 900, type: 'gunman', spot: pn(-520, 120), guards: 3 },
  { id: 'don', name: 'ドン・カルロ', crime: 'ギャングの ボス', stars: 4, bounty: 1500, type: 'boss', spot: pn(560, -420, 1, 600), guards: 4 },
  { id: 'king', name: 'キング・ガレオン', crime: 'おおきな しんじゅ ごうだつ', stars: 5, bounty: 3000, type: 'boss', spot: pn(-40, 560), guards: 6 },
  // レアな 指名手配はん(つよい・たおすと レアな ぶき・そうびを おとす)
  { id: 'kaito', name: '怪盗ファントム', crime: 'びじゅつかん ぜんぶ ぬすんだ', stars: 5, bounty: 4000, type: 'elite', rarity: 'rare', spot: pn(-640, -560, 1, 500), guards: 3, guardType: 'gunman' },
  { id: 'tiger', name: 'あかとら タイガー', crime: 'ギャングの よういんぼう', stars: 5, bounty: 5000, type: 'elite', rarity: 'rare', spot: pn(640, 600, 1, 500), guards: 3, guardType: 'gunman' },
  { id: 'oni', name: 'おに ゴウキ', crime: 'ぶき ふうじゅう あばれもの', stars: 5, bounty: 6000, type: 'elite', rarity: 'rare', spot: pn(120, -700, 1, 500), guards: 4, guardType: 'gunman' },
  { id: 'dragon', name: 'りゅうじん ドラゴ', crime: 'あんこくがいの おう', stars: 5, bounty: 12000, type: 'elite', rarity: 'super', hpMul: 1.8, spot: pn(700, -620, 1, 500), guards: 5, guardType: 'elite' },
  { id: 'raven', name: 'くろがらす レイヴン', crime: 'そらの ほうせき ごうだつ', stars: 5, bounty: 15000, type: 'elite', rarity: 'super', hpMul: 2.2, spot: pn(-100, 760, 1, 500), guards: 5, guardType: 'elite' },
  { id: 'kaiser', name: 'こうてい カイザー', crime: 'まち ぜんたいを しはい', stars: 5, bounty: 40000, type: 'legend', rarity: 'super2', spot: pn(-700, 640, 1, 500), guards: 8, guardType: 'boss' },
];
export const RARITY_NAME = { rare: 'レア', super: 'スーパーレア', super2: 'レジェンド' };
// たおした ときの おとしもの(レアほど いい ぶき・そうび)。p: かくりつ
const DROP_POOLS = {
  rare: { w: ['revolver', 'specialcarbine', 'marksman', 'pump', 'assaultsg'], e: ['vest', 'turbo', 'tactical'], pw: 0.16, pe: 0.1, coins: 800 },
  super: { w: ['heavysniper', 'minigun', 'rpg', 'combatmg', 'grenadel'], e: ['armor', 'rocket', 'goggle'], pw: 0.14, pe: 0.1, coins: 2500 },
  super2: { w: ['railgun', 'homing', 'heavyrifle'], e: ['bsuit', 'lightning', 'hmask'], pw: 0.3, pe: 0.22, coins: 8000 },
};

// ---- ミッション ---------------------------------------------------------------------------------
const hubA = (ang, rad, c = 1) => pn(HQ.x - Math.cos(ang) * rad, HQ.z + Math.sin(ang) * rad, c, 300);
const ACX = (AIRFIELD.x0 + AIRFIELD.x1) / 2; const ACZ = (AIRFIELD.z0 + AIRFIELD.z1) / 2;
const DOCK_X = -150; const DOCK = { x: DOCK_X, z: riverZ(DOCK_X) };
export const CITY_MISSIONS = [
  { id: 'patrol', name: 'まちの パトロール', icon: '🚓', brief: 'まちの 4かしょを のりもので まわろう。', reward: { bronze: 1, coins: 30 }, pts: 4, start: hubA(1.2, 150), points: [hubA(-0.15, 360), hubA(0.45, 380), hubA(1.05, 400), hubA(1.7, 330)] },
  { id: 'rescue', name: 'ひとじちを たすけろ', icon: '🆘', brief: 'はんにんに おそわれている 3にんを みつけて じたくまで つれて いこう(ちかづいて ボタン)。', reward: { silver: 1, coins: 60 }, pts: 6, start: hubA(2.6, 190), civs: [hubA(3.0, 260), hubA(2.2, 330), hubA(1.5, 300)], guards: 2 },
  { id: 'gang', name: 'ギャングを たいほしろ!', icon: '🚔', brief: 'こうさてんに あつまった ギャングを ぜんいん たいほしよう!(たおれて ばんざいした はんにんに ちかづいて ボタン)', reward: { silver: 1, coins: 80 }, pts: 8, start: hubA(0.2, 240), spot: hubA(0.1, 520), crooks: 5 },
  { id: 'harbor', name: 'こうわん パトロール', icon: '⚓', brief: 'ふねで かわの ブイを 3つ まわろう!(かわの ふねに のってね)', reward: { bronze: 2, coins: 70 }, pts: 6, start: (() => { const z = riverZ(DOCK_X) + RIVER.bank + 8; return pn(DOCK_X, z, 0, 160); })(), points: [{ x: -380, z: riverZ(-380) }, { x: -30, z: riverZ(-30) }, { x: 330, z: riverZ(330) }], water: true },
  { id: 'sky', name: 'そらの リング', icon: '💫', brief: 'ひこうきで リングを 6つ くぐろう!(くうこうの ひこうきに のってね。はやい せんとうきは むずかしいよ)', reward: { gold: 1, coins: 120 }, pts: 10, start: { x: AIRFIELD.x0 + 16, z: ACZ + 36 }, rings: [{ x: ACX + 150, y: 90, z: ACZ + 40 }, { x: ACX + 330, y: 120, z: ACZ + 200 }, { x: ACX + 600, y: 140, z: ACZ + 240 }, { x: ACX + 700, y: 110, z: ACZ - 100 }, { x: ACX + 450, y: 90, z: ACZ - 300 }, { x: ACX + 150, y: 70, z: ACZ - 200 }] },
  { id: 'fortress', name: 'アジトを おそえ!', icon: '🏰', brief: 'ギャングの アジトに のりこんで 12にんを ぜんいん たいほしよう! ボスが 3にん。5ふんい ないに!', reward: { gold: 2, coins: 900 }, pts: 20, start: hubA(3.7, 430), spot: hubA(3.45, 720), crooks: 12, types: ['thug', 'gunman', 'gunman', 'boss'], hpMul: 1.5, time: 300, need: { m: 3, a: 2 }, gang: true },
  { id: 'kingpin', name: 'ボス・ラッシュ', icon: '👹', brief: 'つよい ボスが 6にん あらわれた! 4ふんい ないに ぜんいん たいほしよう。かなり むずかしいよ!', reward: { gold: 3, coins: 1800 }, pts: 30, start: hubA(4.6, 330), spot: hubA(4.35, 650), crooks: 6, types: ['boss'], hpMul: 1.8, time: 240, need: { m: 6, a: 5 }, gang: true },
  { id: 'delivery', name: 'はやく おとどけ!', icon: '📦', brief: 'にもつを うけとって、100びょうい ないに じたくへ とどけよう!', reward: { silver: 1, coins: 90 }, pts: 6, start: hubA(-0.6, 260), pickup: hubA(0.5, 640), time: 100 },
];
// かくしミッション(まちの かくれキャラから うける)
export const SECRET_MISSION = { id: 'secret', name: 'さいきょうの しれん', icon: '👑', brief: 'かくれキャラの しれん! エリートの ボス 8にんを 3ぷんい ないに ぜんいん たいほしろ!', reward: { gold: 3, coins: 3000 }, pts: 50, crooks: 8, types: ['boss'], hpMul: 2.2, time: 180, gang: true, spot: SECRET.arena };
export const missionOf = (id) => (id === 'secret' ? SECRET_MISSION : CITY_MISSIONS.find((m) => m.id === id)); // ちずの マーカーには ださない
// おみせの しなもの(ぶき・のりもの・かいふくなど)
export const ITEMS = [
  { id: 'snack', name: 'おにぎり', icon: '🍙', cost: 4, desc: 'HPが すこし かいふく' },
  { id: 'heal', name: 'ぜんかいふく', icon: '❤️', cost: 10, desc: 'HPが ぜんぶ もどるよ' },
  { id: 'drink', name: 'パワードリンク', icon: '🥤', cost: 25, desc: '60びょう こうげき つよい' },
  { id: 'sneak', name: 'ダッシュスニーカー', icon: '👟', cost: 25, desc: '60びょう あしが はやい' },
  { id: 'ramen', name: 'スタミナラーメン', icon: '🍜', cost: 30, desc: 'ぜんかいふく+45びょう つよい' },
  { id: 'bronze', name: 'ブロンズチケット', icon: '🥉', cost: 40, desc: 'ガチャチケット' },
  { id: 'silver', name: 'シルバーチケット', icon: '🥈', cost: 90, desc: 'ガチャチケット' },
  { id: 'gold', name: 'ゴールドチケット', icon: '🥇', cost: 220, desc: 'ガチャチケット' },
  { id: 'shard', name: 'ダイヤの かけら×5', icon: '💠', cost: 180, desc: 'ダイヤの かけら' },
  { id: 'phone', name: 'スマートフォン', icon: '📱', cost: 3000, desc: 'メニューから もっている のりものを その場で よびだせる' },
  { id: 'ammo', name: 'たまの ほじゅう', icon: '📦', cost: 150, desc: 'ぜんぶの ぶきの たまを まんたんに' },
];
export const SHOP = { x: PLAZA.cx - 52, z: PLAZA.cz - 34, items: ITEMS.filter((i) => ['heal', 'bronze', 'silver', 'gold', 'shard'].includes(i.id)) };
const ALLI = ITEMS.map((i) => i.id);
const RARE_W = ['sniper', 'marksman', 'heavysniper', 'grenadel', 'rpg', 'homing', 'railgun', 'minigun', 'heavyrifle', 'combatmg', 'axe', 'machete', 'revolver', 'specialcarbine'];
// おみせ: トレッサ=なんでも / アピタ=のりもの いがい / ほかは とくしょく
export const STORES = [
  { id: 'tresa', name: 'トレッサ', icon: '🛍️', sub: 'モール', x: MALL_TRESA.cx, z: MALL_TRESA.cz - 26, sells: { weapons: 'all', vehicles: 'all', equip: true, items: ALLI } },
  { id: 'apita', name: 'アピタ', icon: '🏬', sub: 'ショッピングセンター', x: MALL_APITA.cx, z: MALL_APITA.cz - 24, sells: { weapons: 'all', items: ALLI } },
  { id: 'conbini', name: 'コンビニ', icon: '🏪', sub: 'おにぎり・かいふく', x: SHOP.x, z: SHOP.z, sells: { items: ['snack', 'heal', 'drink'] } },
  { id: 'drug', name: 'マツモトキヨシ', icon: '💊', sub: '新綱島駅前店・かいふく・スニーカー', ...pn(MATSU.x, MATSU.z, 0, 120), sells: { items: ['heal', 'drink', 'sneak'] } },
  { id: 'ramen', name: '新綱島MICCA', icon: '🏮', sub: 'こみんかの フードモール・ラーメン', ...pn(MICCA.x, MICCA.z, 0, 120), sells: { items: ['ramen', 'snack'] } },
  { id: 'hobby', name: 'ホビーショップ', icon: '🎴', sub: 'ガチャチケット・かけら', ...pn(HQ.x - 70, HQ.z - 120, 0, 200), sells: { items: ['bronze', 'silver', 'gold', 'shard'] } },
  { id: 'military', name: 'ミリタリーショップ', icon: '🔫', sub: 'レアな ぶき', x: ARMS.x, z: ARMS.z, sells: { weapons: RARE_W, items: ['ammo'] } },
];
// そうび: ふく(HP・ぼうぎょ)・くつ(あしの はやさ)・ぼうし(ねらいの はやさ・じゅうの ブレ)。トレッサで かえる
export const EQUIP_SLOTS = [['body', '👕 ふく'], ['feet', '👟 くつ'], ['head', '🧢 ぼうし'], ['acc', '🤖 アクセサリー']];
export const EQUIP = [
  { id: 'jersey', slot: 'body', name: 'サッカーユニフォーム', icon: '👕', price: 1200, hp: 10, def: 0.05 },
  { id: 'hoodie', slot: 'body', name: 'あったか パーカー', icon: '🧥', price: 3200, hp: 20, def: 0.08 },
  { id: 'rider', slot: 'body', name: 'ライダースジャケット', icon: '🧥', price: 8000, hp: 35, def: 0.14, need: { a: 1 } },
  { id: 'vest', slot: 'body', name: 'ぼうだんベスト', icon: '🦺', price: 20000, hp: 55, def: 0.22, need: { m: 3 } },
  { id: 'armor', slot: 'body', name: 'ヒーローアーマー', icon: '🛡️', price: 48000, hp: 80, def: 0.32, need: { a: 4, m: 3 } },
  { id: 'bsuit', slot: 'body', name: 'ぼうえいたい ぜんしんスーツ', icon: '🥋', price: 120000, hp: 120, def: 0.45, need: { a: 8, m: 6 } },
  { id: 'sneaker', slot: 'feet', name: 'スニーカー', icon: '👟', price: 1000, spd: 0.06 },
  { id: 'runner', slot: 'feet', name: 'ランニングシューズ', icon: '👟', price: 3000, spd: 0.12 },
  { id: 'spike', slot: 'feet', name: 'サッカースパイク', icon: '⚽', price: 7600, spd: 0.18, need: { a: 1 } },
  { id: 'turbo', slot: 'feet', name: 'ターボブーツ', icon: '🥾', price: 18000, spd: 0.26, need: { m: 3 } },
  { id: 'rocket', slot: 'feet', name: 'ロケットシューズ', icon: '🚀', price: 44000, spd: 0.36, need: { a: 4, m: 4 } },
  { id: 'lightning', slot: 'feet', name: 'ライトニングブーツ', icon: '⚡', price: 110000, spd: 0.5, need: { a: 8, m: 6 } },
  { id: 'cap', slot: 'head', name: 'キャップ', icon: '🧢', price: 800, aim: 0.1, acc: 0.08 },
  { id: 'visor', slot: 'head', name: 'バイザー', icon: '🎓', price: 2800, aim: 0.2, acc: 0.15 },
  { id: 'headset', slot: 'head', name: 'ヘッドセット', icon: '🎧', price: 7000, aim: 0.3, acc: 0.22, need: { a: 1 } },
  { id: 'tactical', slot: 'head', name: 'タクティカルヘルメット', icon: '⛑️', price: 17000, aim: 0.42, acc: 0.3, need: { m: 3 } },
  { id: 'goggle', slot: 'head', name: 'スコープゴーグル', icon: '🥽', price: 42000, aim: 0.55, acc: 0.4, need: { a: 4, m: 4 } },
  // アクセサリー: AIMアシストロボット(ランク1〜5で オートAIMの つよさが かわる。なしだと ほとんど ひきよせない)
  { id: 'aimbot1', slot: 'acc', name: 'AIMアシストロボット ランク1', icon: '🤖', price: 6000, aimLv: 1 },
  { id: 'aimbot2', slot: 'acc', name: 'AIMアシストロボット ランク2', icon: '🤖', price: 16000, aimLv: 2, need: { m: 2 } },
  { id: 'aimbot3', slot: 'acc', name: 'AIMアシストロボット ランク3', icon: '🤖', price: 40000, aimLv: 3, need: { a: 3, m: 3 } },
  { id: 'aimbot4', slot: 'acc', name: 'AIMアシストロボット ランク4', icon: '🤖', price: 90000, aimLv: 4, need: { a: 5, m: 4 } },
  { id: 'aimbot5', slot: 'acc', name: 'AIMアシストロボット ランク5', icon: '🤖', price: 180000, aimLv: 5, need: { a: 8, m: 6 } },
  // ぜんぶ(そうび・のりもの・ひこうき)を かうと かえる 「さいきょう」
  { id: 'u_suit', slot: 'body', name: '👑 ちきゅうぼうえい さいきょうスーツ', icon: '👑', price: 1200000, hp: 220, def: 0.6, need: { all: true, secret: true } },
  { id: 'u_boots', slot: 'feet', name: '👑 さいきょう ブースター ブーツ', icon: '🌟', price: 900000, spd: 0.75, need: { all: true, secret: true } },
  { id: 'u_helm', slot: 'head', name: '👑 さいきょう スカウター ヘルメット', icon: '🌟', price: 900000, aim: 1.0, acc: 0.75, need: { all: true, secret: true } },
  { id: 'hmask', slot: 'head', name: 'ヒーローマスク', icon: '🦸', price: 105000, aim: 0.7, acc: 0.52, need: { a: 8, m: 6 } },
];
// がっこうの おべんきょうで せいかい した かずでも かいほう(レアな ぶき・のりもの・そうび)
const JOBN = { sniper: 20, marksman: 30, heavysniper: 60, grenadel: 40, rpg: 80, homing: 150, railgun: 200, minigun: 100, heavyrifle: 90, combatmg: 50, specialcarbine: 40, racer: 20, super: 30, bizjet: 40, hawk: 60, phantom: 150, vest: 20, armor: 50, bsuit: 120, turbo: 20, rocket: 60, lightning: 140, tactical: 20, goggle: 60, hmask: 130 };
for (const it of [...WEAPONS, ...VCAT, ...EQUIP]) if (JOBN[it.id]) it.need = { ...(it.need || {}), j: JOBN[it.id] };
export const equipOf = (id) => EQUIP.find((e) => e.id === id);
export const equipDesc = (e) => [e.hp ? `HP+${e.hp}` : '', e.def ? `ダメージ-${Math.round(e.def * 100)}%` : '', e.spd ? `あしの はやさ+${Math.round(e.spd * 100)}%` : '', e.aim ? `ねらいの はやさ+${Math.round(e.aim * 100)}%` : '', e.acc ? `じゅうの ブレ-${Math.round(e.acc * 100)}%` : '', e.aimLv ? `オートAIMの つよさ ランク${e.aimLv}/5` : ''].filter(Boolean).join('・');
export const storeOf = (id) => STORES.find((x) => x.id === id);
// とめる ばしょ(ガレージの わく)
const HX = HOME.cx; const HZ0 = HOME.z0;
const CAR_SLOTS = [-24, -12, 0, 12, 24].flatMap((dx) => [12, 26, 40].map((dz) => [HX + dx, HZ0 + dz])).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
const BIKE_SLOTS = [-15, -9, -3, 3, 9, 15].map((dx) => [HX + dx, HZ0 + 46]);
const AIR_SLOTS = [[AIRFIELD.x0 + 20, ACZ - 28], [AIRFIELD.x0 + 20, ACZ + 28], [AIRFIELD.x0 + 20, ACZ - 56], [AIRFIELD.x0 + 20, ACZ + 56], [AIRFIELD.x0 + 58, ACZ - 42], [AIRFIELD.x0 + 58, ACZ + 42]];
const FIXED = { tank: { kind: 'tank', x: PLAZA.cx + 50, z: PLAZA.cz + 4, yaw: Math.PI / 2 }, ship: { kind: 'ship', x: DOCK.x, z: DOCK.z, yaw: Math.PI / 2 }, plane: { kind: 'plane', x: AIRFIELD.x0 + 24, z: ACZ, yaw: Math.PI / 2 } };
const slotOf = (it, idx) => { if (it.kind === 'bike') { const s = BIKE_SLOTS[idx % BIKE_SLOTS.length]; return { x: s[0], z: s[1], yaw: 0 }; } if (isAir(it.kind)) { const s = AIR_SLOTS[idx % AIR_SLOTS.length]; return { x: s[0], z: s[1], yaw: Math.PI / 2 }; } const s = CAR_SLOTS[idx % CAR_SLOTS.length]; return { x: s[0], z: s[1], yaw: 0 }; };

export function createCity({ stats, vehicles, owned = DEFAULT_OWNED, weapons = DEFAULT_WEAPONS, weapon = 'pistol', rnd = mulberry(5), gentle = false, coins = 0, arrests = {}, ammo = {}, eqOwned = [], equip: eqWorn = {}, jobOk = 0, warps = [], job: jobId = 'none', jobXp = {}, home = null, phone = false, defLevel = 1, quest = {}, rpgXp = 0, collect = {}, witness = true, vcol = {}, pet = null, allyN = 0 }) {
  const ks = stats; const FS = footStats(ks);
  let input = { turn: 0, climb: 0, moveX: 0, moveY: 0, autoAim: true, aimLock: false, gun: false, boost: false, aimX: 0, aimY: 0 };
  const S = {
    t: 0, ph: 'play', events: [], snd: [], msg: '', msgT: 0, banner: '', bannerT: 0,
    player: { mode: 'foot', x: SPAWN.x, y: 0, z: SPAWN.z, yaw: SPAWN.yaw, pitch: 0, roll: 0, speed: 0, hp: FS.hpMax, hpMax: FS.hpMax, boost: 100, aimRel: 0, aimPitch: 0.05, veh: null, invuln: 0, dead: 0, hurt: 0, coins, wCd: 0, buff: { dmg: 0, speed: 0 }, weapon: 'pistol', noAim: 0, camYaw: SPAWN.yaw, camFree: false, reload: 0, reloadId: null, bloom: 0, chute: false, carry: 0, kos: 0, target: null, missileCd: 0, lastHurt: -99 },
    vehicles: [], civs: [], crooks: [], bullets: [], missiles: [], tracers: [], effects: [], pickups: [], traffic: [], walkers: [], mission: null, done: {}, nearby: null, ui: null, owned: [...new Set([...DEFAULT_OWNED, ...owned])], wOwned: [...new Set([...DEFAULT_WEAPONS, ...weapons])], arrests: { ...arrests }, tracked: null, swing: 0, defLevel: Math.max(1, defLevel | 0), job: JOBS[jobId] ? jobId : 'none', coll: (() => { const o = {}; for (const c of COLL) o[c.id] = Array.isArray(collect[c.id]) ? [...new Set(collect[c.id].filter((i) => Number.isInteger(i) && i >= 0 && i < c.n))] : []; return o; })(), cnear: [], cT: 0, run: null, qs: (() => { const o = {}; for (const id of Object.keys(STORY)) { const q = quest[id] || {}; o[id] = { cl: Array.isArray(q.cl) ? [...new Set(q.cl.filter((i) => Number.isInteger(i) && i >= 0 && i < STORY[id].length))] : Array.from({ length: Math.min(q.c | 0, STORY[id].length) }, (_, i) => i), c: q.c | 0, s: q.s | 0, p: 0, base: q.base == null ? null : q.base, tx: q.tx == null ? null : q.tx, tz: q.tz == null ? null : q.tz, lx: q.lx == null ? null : q.lx, lz: q.lz == null ? null : q.lz, began: !!q.began, spawned: false, done: !!q.done }; } return o; })(), rpgXp: rpgXp | 0, goal: null, qLock: null, jobXp: { ...jobXp }, home: normalizeHome(home), hasPhone: !!phone, tasks: [], fires: [], patients: [], loaned: [], taskT: 8, fireT: 45, warps: (Array.isArray(warps) ? warps : []).slice(0, 3).map((w) => (w && Number.isFinite(w.x) && Number.isFinite(w.z) ? { x: w.x, z: w.z, name: String(w.name || '') } : null)), jobOk: jobOk | 0, heat: 0, lv: 0, heatT: 0, fine: 0, melee: 0, jets: [], helis: [], ammo: { ...ammo }, eqOwned: [...new Set(eqOwned.filter((id) => equipOf(id)))], equip: {},
    wanted: [], stats: { coins: 0, arrests: 0, bounty: 0, missions: 0 },
  };
  const spaceOf = (pl) => (pl && pl.plat && pl.plat.kind === 'hideout' ? pl.plat.id : null);
  const GHOST = { x: 1e7, z: 1e7, y: 0, dead: 999, hp: 1, hpMax: 1, mode: 'foot', veh: null, plat: null, coins: 0, invuln: 0, speed: 0, yaw: 0, camYaw: 0, jh: 0 };
  let P = S.player; const HOST = P; const HOST_IN = input; const players = [P]; const inputs = [input]; S.players = players; S.noWitness = !witness; S.playSpots = PLAYSPOTS; S.allies = Array.from({ length: clamp(allyN | 0, 0, 2) }, (_, i) => ({ id: 70000 + i, x: SPAWN.x + 3 + i * 2, z: SPAWN.z + 3, yaw: 0, cd: 1, mv: 0 })); S.pet = pet === 'dog' || pet === 'cat' ? { kind: pet, x: SPAWN.x + 2, z: SPAWN.z + 2, yaw: 0, dig: 70 + rnd() * 50, mv: 0 } : null; S.vcol = (vcol && typeof vcol === 'object') ? Object.fromEntries(Object.entries(vcol).filter(([k, v]) => typeof k === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)).slice(0, 40)) : {}; S.fishSpots = fishSpots(); S.coopBest = null; S.hideouts = hideoutSites().map((h) => ({ ...h, cover: hideCover(h), spawned: false, cleared: false, cd: 0 })); let nid = 100; P.weapon = weapon && S.wOwned.includes(weapon) ? weapon : 'pistol';
  for (const [sl] of EQUIP_SLOTS) { const id = eqWorn[sl]; if (id && S.eqOwned.includes(id) && equipOf(id).slot === sl) S.equip[sl] = id; }
  const eqStat = () => { const q = { hp: 0, def: 0, spd: 0, aim: 0, acc: 0, aimLv: 0 }; for (const id of Object.values(S.equip)) { const e = equipOf(id); if (e) for (const k of Object.keys(q)) q[k] += e[k] || 0; } return q; };
  const applyEq = () => { const q = eqStat(); const hm = FS.hpMax + q.hp + 3 * (rpgLevel(S.rpgXp) - 1); const r = P.hp / (P.hpMax || hm); P.hpMax = hm; P.hp = Math.min(hm, Math.max(1, Math.round(hm * r))); S.eq = q; };
  applyEq(); P.hp = P.hpMax;
  // ---- てはい ----
  // 指名手配(ゆるめ): 1ぷんで 10にん ひくと★1・なぐる5かいで★1・いっぱんの ひとを うつと ★2・そのあと 2かい あてるごとに ★+1(けいさつは 3かい・のりものは 4かい)(★5が さいだい)
  const raiseNow = (to, why) => { const l0 = S.lv; if (l0 === 0) { const vv = cur(); S.heatVeh = vv ? vv.id : null; } S.lv = Math.min(5, Math.max(S.lv, to)); S.heat = S.lv; S.fine = HEAT_FINE[S.lv]; if (S.lv > 0) S.heatT = Math.max(S.heatT, HEAT_DUR[S.lv]); if (S.lv > l0) { banner(S.lv >= 5 ? '🚨 ★5 ながい あいだ にげきれ!!' : `🚨 指名手配 ${'⭐'.repeat(S.lv)}!`, 2.6); snd('warn'); ev({ t: 'wanted', lv: S.lv }); } else if (why && S.lv > 0) msg(why, 1.4); };
  // GTA6 ふう: はんざいは「だれかに みられた」ときだけ つうほうされる(もくげきしゃが でんわ→3.5びょうごに 指名手配)。
  // もくげきしゃを たおす・とおくへ にげる と つうほうは きえる。もう 指名手配 ちゅうなら すぐ あがる。
  const raise = (to, why) => {
    if (S.lv > 0 || S.noWitness) return raiseNow(to, why);
    if (S.rep) { S.rep.to = Math.max(S.rep.to, to); return; }
    let best = null; let bd = 46; for (const w of S.walkers) { if (w.dead > 0) continue; const d = hyp(w.x - P.x, w.z - P.z); if (d < bd) { bd = d; best = w; } }
    for (const c of S.traffic) if (c.cop && !(c.dead > 0) && hyp(c.x - P.x, c.z - P.z) < 70) return raiseNow(to, why);
    if (!best) { if (S.t - (S.noseeT || -9) > 5) { S.noseeT = S.t; msg('👀 だれも みていない… つうほうは されなかった', 2.4); } return; }
    S.rep = { w: best, to, why, t: 3.5 }; best.calling = true; best.scared = Math.max(best.scared || 0, 4); if (best.idle) { best.idle = false; best.spd = 1.8; }
    msg('📱 だれかに みられた! つうほうされる まえに たおすか にげよう!', 3); snd('warn');
  };
  const stepWitness = (dt) => {
    const rp = S.rep; if (!rp) return; rp.t -= dt; const w = rp.w;
    if (S.lv > 0) { w.calling = false; S.rep = null; return; }
    if (w.dead > 0) { w.calling = false; S.rep = null; msg('📵 もくげきしゃが いなくなった… つうほうは とまった', 2.6); return; }
    if (hyp(w.x - P.x, w.z - P.z) > 85) { w.calling = false; S.rep = null; msg('📵 もくげきしゃを ふりきった!', 2.6); return; }
    if (rp.t <= 0) { w.calling = false; S.rep = null; msg('📞 つうほうされた!', 1.6); raiseNow(rp.to, rp.why); }
  };
  // ---- なかま(ボディガード)・ペット ----
  const stepCompanions = (dt) => {
    const inRoom = !!(P.plat && P.plat.kind === 'hideout'); const vcur = cur();
    for (const a of S.allies) {
      const d = hyp(a.x - P.x, a.z - P.z); if (d > 55 || inRoom || (P.plat && d > 12)) { if (!inRoom) { a.x = P.x + Math.sin(a.id) * 3; a.z = P.z + Math.cos(a.id) * 3; } continue; }
      let tg = null; let bd = 42; if (!vcur || !isAir(vcur.kind)) for (const c of S.crooks) { if (c.state === 'down' || c.hideout) continue; const dd = hyp(c.x - a.x, c.z - a.z); if (dd < bd) { bd = dd; tg = c; } }
      let gx = P.x; let gz = P.z; let stay = 4.5 + (a.id % 3);
      if (tg && bd > 14) { gx = tg.x; gz = tg.z; stay = 14; }
      const dx = gx - a.x; const dz = gz - a.z; const dg = hyp(dx, dz); a.mv = 0;
      if (dg > stay) { const sp = Math.min(dg > 25 ? 11 : 6.5, 3 + dg * 0.6); a.yaw = Math.atan2(dx, dz); groundMove(a, a.x + Math.sin(a.yaw) * sp * dt, a.z + Math.cos(a.yaw) * sp * dt, 1.0, false); a.mv = sp; }
      a.cd -= dt; if (tg) { a.yaw = Math.atan2(tg.x - a.x, tg.z - a.z); if (a.cd <= 0 && wallDist({ x: a.x, y: 1.5, z: a.z }, { x: Math.sin(a.yaw), y: 0, z: Math.cos(a.yaw) }, bd, null) > bd) { a.cd = 0.55 + rnd() * 0.3; hitCrook(tg, 9 + rpgLevel(S.rpgXp)); S.tracers.push({ from: { x: a.x, y: 1.5, z: a.z }, to: { x: tg.x, y: 1.4, z: tg.z }, t: 0 }); snd('shot_pistol'); } }
    }
    const pt = S.pet; if (pt) {
      const d = hyp(pt.x - P.x, pt.z - P.z); if (d > 60) { pt.x = P.x + 2; pt.z = P.z + 2; } else if (!inRoom && !P.plat) { pt.mv = 0; if (d > 3.5) { const sp = Math.min(d > 14 ? 11 : 7, 2.5 + d * 0.8); pt.yaw = Math.atan2(P.x - pt.x, P.z - pt.z); groundMove(pt, pt.x + Math.sin(pt.yaw) * sp * dt, pt.z + Math.cos(pt.yaw) * sp * dt, 0.5, false); pt.mv = sp; } pt.dig -= dt; if (pt.dig <= 0 && P.mode === 'foot') { pt.dig = 80 + rnd() * 60; const c = 70 + Math.floor(rnd() * 140); S.pickups.push({ id: ++nid, kind: 'coin', x: pt.x + Math.sin(pt.yaw) * 2, z: pt.z + Math.cos(pt.yaw) * 2, v: c, icon: '🪙', col: '#ffd23f' }); msg(`${pt.kind === 'dog' ? '🐕 ポチ' : '🐈 タマ'}が なにか ほりだしたよ!`, 2.6); snd('coin'); } }
    }
  };
  const addStar = (why) => raise(S.lv + 1, why);
  const gunHit = (why, per = 2) => { if (S.lv < 2) { S.gunCnt = 0; raise(2, why); } else if (S.t - (S.cntT || -9) > 0.3) { S.cntT = S.t; S.gunCnt = (S.gunCnt || 0) + 1; if (S.gunCnt >= per) { S.gunCnt = 0; addStar(why); } } };
  const meleeHit = (why) => { S.melee++; if (S.melee >= 5) { S.melee = 0; raise(1, why); } else msg(`🚨 なぐった(${S.melee}/5)`, 1.2); };
  const clearHeat = (why) => { if (S.rep) { S.rep.w.calling = false; S.rep = null; } S.heat = 0; S.lv = 0; S.heatT = 0; S.fine = 0; S.melee = 0; S.gunCnt = 0; S.runs = []; S.jets = []; S.helis = []; S.missiles = S.missiles.filter((m) => !m.enemy); S.crooks = S.crooks.filter((c) => !c.hunter); S.traffic = S.traffic.filter((c) => !c.cop); if (why) msg(why, 3); };
  const hurtWalker = (w, dmg, how) => { if (w.dead > 0) return; w.hp = (w.hp == null ? 40 : w.hp) - dmg; w.scared = 8; if (w.idle) { w.idle = false; w.spd = 1.8; if (S.relocWalker) S.relocWalker(w); } fx('spark', w.x, 1.2, w.z, 4); if (how === 'melee') meleeHit('🚨 いっぱんの ひとを なぐった!'); else if (how === 'run') { S.runs = (S.runs || []).filter((t) => S.t - t < 60); S.runs.push(S.t); if (S.runs.length >= 10) raise(1, '🚨 たくさんの ひとを ひいた!'); else if (S.runs.length >= 5 && S.lv < 1) msg(`⚠️ ひとを ひきすぎ ちゅうい!(${S.runs.length}/10)`, 1.4); } else gunHit('🚨 いっぱんの ひとを やった!'); if (w.hp <= 0) { w.dead = 14; snd('down'); fx('spark', w.x, 1.5, w.z, 8); } };
  const rayWalker = (from, dv, range, wall) => { let best = null; let ba = 9; for (const w of S.walkers) { if (w.dead > 0) continue; const vx = w.x - from.x; const vy = 1.1 - from.y; const vz = w.z - from.z; const dist = hyp(vx, vy, vz); if (dist > range || dist > wall || dist < 1) continue; const a = Math.acos(clamp((vx * dv.x + vy * dv.y + vz * dv.z) / dist, -1, 1)); if (a < 0.9 / dist + 0.04 && a < ba) { ba = a; best = w; } } return best; };
  const nearestWalker = (maxD, cone, yaw) => { let best = null; let bd = maxD; for (const w of S.walkers) { if (w.dead > 0) continue; const d = hyp(w.x - P.x, w.z - P.z); if (d > bd || Math.abs(angDiff(Math.atan2(w.x - P.x, w.z - P.z), yaw)) > cone) continue; bd = d; best = w; } return best; };
  const spawnHunter = (t) => { for (let i = 0; i < 80; i++) { const rp = roadPoint(R2, 1); const dd = hyp(rp.x - P.x, rp.z - P.z); if (dd < 55 || dd > 200 || insideBuilding(rp.x, rp.z) || inRect(AIRFIELD, rp.x, rp.z) || inRect(HOME, rp.x, rp.z) || isWater(rp.x, rp.z)) continue; const c = spawnCrook(t === 'cop' ? 'cop' : 'bounty', rp.x, rp.z, { wander: 20 }); c.hunter = t; c.alert = true; return true; } return false; };
  const spawnCopCar = () => { const cps = S.carPaths || []; if (!cps.length) return false; for (let i = 0; i < 120; i++) { const cp = cps[Math.floor(rnd() * cps.length)]; const sx = rnd() * cp.cum[cp.cum.length - 1]; const q = S.pathAt(cp, sx); const dd = hyp(q.x - P.x, q.z - P.z); if (dd < 80 || dd > 230) continue; const dir = rnd() < 0.5 ? 1 : -1; const c = { id: ++nid, path: cp, s: sx, dir, off: cp.hw * 0.5 * dir, spd: 16, tone: 0, model: 'police', bike: false, hostile: true, cop: true, hp: 2, x: 0, z: 0, yaw: 0, wait: 0, dead: 0, r: 2.6 }; S.placeOn(c, cp, c.off); S.traffic.push(c); return true; } return false; };
  // ★ごとの おいかけてくる かず: [あるく けいさつ, 賞金かせぎ, パトカー, せんとうき] ★5は ぜんぶで 20
  const HUNT = [[0, 0, 0, 0, 0], [1, 0, 0, 0, 0], [2, 0, 1, 0, 0], [3, 1, 2, 0, 0], [5, 2, 3, 1, 1], [8, 2, 5, 3, 3]]; // [あるく けいさつ, 賞金かせぎ, パトカー, せんとうき, ヘリ] ★5は ぜんぶで 21
  const spawnJet = () => { const a = rnd() * 6.283; const d = 260 + rnd() * 120; const j = { id: ++nid, x: P.x + Math.sin(a) * d, z: P.z + Math.cos(a) * d, y: 42 + rnd() * 20, yaw: a + Math.PI, spd: 46, cd: 1 + rnd() * 2, ph: rnd() * 6, model: 'hawk', air: 'jet', hp: 90, hpMax: 90, rad: 4.2 }; S.jets.push(j); return true; };
  const spawnHeli = () => { const a = rnd() * 6.283; const d = 90 + rnd() * 60; S.helis.push({ id: ++nid, x: P.x + Math.sin(a) * d, z: P.z + Math.cos(a) * d, y: 26, yaw: a + Math.PI, ang: a, cd: 1 + rnd(), burst: 0, ph: rnd() * 6, air: 'heli', hp: 120, hpMax: 120, rad: 4.5 }); return true; };
  const maintainHunters = () => {
    S.crooks = S.crooks.filter((c) => !c.gone); const lv = S.lv; const H = HUNT[lv]; let made = 0; if (lv < 5 && P.mode === 'foot' && hyp(P.x - BASE.x, P.z - BASE.z) < BASE.r) return; // じたくに かくれている ときは あたらしい おってが でない
    for (const [t, n0] of [['cop', H[0]], ['bounty', H[1]]]) { let n = S.crooks.filter((c) => c.hunter === t && c.state !== 'down').length; while (n < n0 && made < 3) { if (!spawnHunter(t)) break; n++; made++; } }
    S.traffic = S.traffic.filter((c) => !(c.cop && c.dead > 1000)); let k = S.traffic.filter((c) => c.cop).length; while (k < H[2] && made < 4 && spawnCopCar()) { k++; made++; }
    if (S.t >= (S.airRespawn || 0)) { while (S.jets.length < H[3]) spawnJet(); while (S.helis.length < H[4]) spawnHeli(); }
  };
  function payFine() {
    if (S.lv <= 0) { msg('いまは 指名手配されて いないよ', 2.4); return { ok: false, why: 'てはい なし' }; } if (S.lv >= 5) { msg('🚨 ★5は ばっきんでは ゆるされない! ながく にげきるしか ない!', 3); return { ok: false, why: '★5' }; } const f = S.fine; if (P.coins < f) { msg(`ばっきん 🪙${f} が たりないよ…`, 2.8); return { ok: false, why: 'コインが たりない' }; }
    P.coins -= f; clearHeat(); snd('win'); banner('🚓 ばっきんを はらった! てはいが きえたよ', 3); ev({ t: 'fine', coins: f }); return { ok: true };
  }
  // ================= しょくぎょう(けいさつ・SWAT・しょうぼう・きゅうきゅう) =================
  const jobLv = () => jobLevel(S.jobXp[S.job]);
  const addRpg = (n) => { const b = rpgLevel(S.rpgXp); S.rpgXp += n; const a = rpgLevel(S.rpgXp); if (a > b) { applyEq(); P.hp = P.hpMax; banner(`⭐ プレイヤー Lv.${a}! HP+3`, 3.6); snd('win'); } };
  const addJobXp = (n) => {
    const J = JOBS[S.job]; const b = jobLevel(S.jobXp[S.job]); S.jobXp[S.job] = (S.jobXp[S.job] || 0) + n; const xp = S.jobXp[S.job]; const a = jobLevel(xp); addRpg(n * 3);
    if (a > b) { banner(`🎉 ${J.icon} ${J.name} Lv.${a}! ランク「${rankOf(S.job, xp)}」`, 4.2); msg(`ほうしゅう +${payBonus(xp)}%! つぎの しょうが ひらくよ(📖ストーリー)`, 4.2); snd('win'); fx('spark', P.x, 3, P.z, 10); ev({ t: 'jobsave' }); }
  };
  const payJob = (kind, furnLv = 1) => {
    const coins = Math.round(JOB_PAY[kind] * (1 + payBonus(S.jobXp[S.job]) / 100)); P.coins += coins; S.stats.coins += coins; addJobXp(1);
    const fid = rollFurn(rnd, Math.min(3, furnLv + (jobLv() >= 4 ? 1 : 0))); addFurn(S.home, fid); ev({ t: 'jobdone', job: S.job, kind, coins, furn: fid }); msg(`✅ おしごと かんりょう! 🪙+${coins}  🎁 ${furnOf(fid).icon} ${furnOf(fid).name}  (Lv.${jobLv()}まで あと${jobNext(S.jobXp[S.job])})`, 4.2); snd('win'); fx('spark', P.x, 3, P.z, 8); qNote(kind); return coins;
  };
  const farSpot = (min, max) => { for (let t = 0; t < 60; t++) { const rp = roadPoint(R2, 1); const d = hyp(rp.x - P.x, rp.z - P.z); if (d < min || d > max || insideBuilding(rp.x, rp.z, 0) || isWater(rp.x, rp.z) || inRect(AIRFIELD, rp.x, rp.z) || inRect(HOME, rp.x, rp.z)) continue; return rp; } return null; };
  const HOSPITALS = (() => { const h = SYMBOLS.filter((x) => x[0] === 'hospital').map((x, i) => ({ id: i, x: x[1], z: x[2], name: x[3] || `びょういん${i + 1}` })); const fb = [[-300, 160], [200, -200], [-120, 420]]; for (let i = h.length; i < 3; i++) { const q = freeAround(fb[i][0], fb[i][1]); h.push({ id: i, x: q.x, z: q.z, name: `びょういん${i + 1}` }); } return h.slice(0, 3); })();
  const LOAN_SET = (on) => {
    if (on) { for (const id of SWAT_LOAN) if (!S.wOwned.includes(id) && weaponOf(id)) { S.wOwned.push(id); S.loaned.push(id); const sp = ammoSpec(weaponOf(id)); if (sp) S.ammo[id] = { mag: sp.mag, reserve: sp.cap }; } }
    else { S.wOwned = S.wOwned.filter((id) => !S.loaned.includes(id)); if (S.loaned.includes(P.weapon)) P.weapon = S.wOwned.includes('pistol') ? 'pistol' : S.wOwned[0]; S.loaned = []; }
  };
  function setJob(id) {
    if (!JOBS[id]) return { ok: false, why: 'ない' }; if (hyp(P.x - BASE.x, P.z - BASE.z) > 90 && !S.hasPhone) return { ok: false, why: 'じたくの ちかくで えらんでね(スマホが あれば どこでも OK)' }; if (S.job === id) return { ok: true };
    if (S.job === 'swat') LOAN_SET(false); S.job = id; S.tasks = []; S.patients = []; S.crooks = S.crooks.filter((c) => !c.task); for (const c of S.traffic) { c.task = null; c.speeding = false; } if (id === 'swat') LOAN_SET(true); S.taskT = 4; S.fireT = Math.min(S.fireT, 30);
    msg(id === 'none' ? 'しょくぎょうを やめたよ' : `${JOBS[id].icon} ${JOBS[id].name}に なった! ${JOBS[id].vehicle ? 'のりものは ガレージに あるよ' : ''}`, 3.4); snd('win'); ev({ t: 'jobset', id }); return { ok: true };
  }
  function ensureTasks() {
    const ids = () => ++nid;
    if (S.job === 'police') {
      if (!S.tasks.some((t) => t.type === 'snatch')) { const rp = farSpot(110, 260); if (rp) { const id = ids(); const c = spawnCrook('runner', rp.x, rp.z, { wander: 40 }); c.task = id; c.minor = true; c.alert = true; c.speed = 6.8; S.tasks.push({ id, type: 'snatch', icon: '👜', label: 'ひったくりを おえ!', x: rp.x, z: rp.z, cid: c.id, life: 210 }); msg('👜 ひったくりだ! ちずの ばしょへ!', 3); snd('warn'); } }
      if (!S.tasks.some((t) => t.type === 'speed')) { const tc = S.traffic.find((c) => !c.hostile && !c.cop && !c.task && !(c.dead > 0) && !c.bike && hyp(c.x - P.x, c.z - P.z) > 70 && hyp(c.x - P.x, c.z - P.z) < 320); if (tc) { const id = ids(); tc.task = id; tc.speeding = true; tc.spd = 24; S.tasks.push({ id, type: 'speed', icon: '🚨', label: 'スピードいはんの くるま!', x: tc.x, z: tc.z, tid: tc.id, life: 170, prog: 0 }); msg('🚨 スピードいはん! パトカーで おいついて!', 3); snd('warn'); } }
    } else if (S.job === 'swat') {
      if (!S.tasks.some((t) => t.type === 'raid')) { const rp = farSpot(220, 460); if (rp) { const id = ids(); const types = ['thug', 'gunman', 'gunman', 'boss', 'thug']; for (let i = 0; i < 5; i++) { const c = spawnCrook(types[i], rp.x + Math.cos(i * 1.4) * 24, rp.z + Math.sin(i * 1.4) * 24, { wander: 36, hpMul: 1.25 }); c.task = id; } S.tasks.push({ id, type: 'raid', icon: '🏚️', label: 'ギャングの アジト(5にん)', x: rp.x, z: rp.z, life: 380 }); msg('🏚️ ギャングの アジトを はっけん! たいほしよう', 3.4); snd('warn'); } }
    } else if (JSDF.includes(S.job)) {
      if (!S.tasks.some((t) => t.type === 'cmd')) S.tasks.push({ id: ids(), type: 'cmd', icon: '🎖️', label: `ちょうかんの ところへ(ぼうえい Lv.${S.defLevel})`, x: COMMANDER.x, z: COMMANDER.z, life: 1e9 });
    } else if (S.job === 'ems') {
      if (S.patients.length < 2) { const rp = farSpot(130, 360); if (rp) { const id = ids(); const p = { id, x: rp.x + 2, z: rp.z, sym: Math.floor(rnd() * SYMPTOMS.length), state: 'need', life: 320, hosp: null }; S.patients.push(p); S.tasks.push({ id, type: 'patient', icon: SYMPTOMS[p.sym].icon, label: `かんじゃ「${SYMPTOMS[p.sym].say}」`, x: p.x, z: p.z, pid: id, life: 9999 }); msg('🚑 きゅうきゅう! かんじゃが いるよ。ちずを かくにん!', 3.4); snd('warn'); } }
    }
  }
  // ---- ストーリー(しょくぎょうごとの クエスト) ----
  const placeXY = (at) => {
    if (at === 'koban') return { x: KOBAN.x, z: KOBAN.z + 8 }; if (at === 'tresa') { const t = STORES.find((x) => x.id === 'tresa'); return { x: t.x, z: t.z }; } if (at === 'home') return { x: GARAGE.x, z: GARAGE.z + 10 };
    if (at === 'plaza') return { x: PLAZA.cx, z: PLAZA.cz }; if (/^hosp[0-2]$/.test(at)) { const h = HOSPITALS[+at[4]]; return h ? { x: h.x, z: h.z } : null; } if (at === 'base') return { x: COMMANDER.x, z: COMMANDER.z };
    if (at === 'air') return { x: ACX, z: ACZ }; if (at === 'dock') return { x: DOCK.x, z: DOCK.z }; return farSpot(200, 480) || { x: PLAZA.cx, z: PLAZA.cz };
  };
  const qCur = () => { const q = S.qs[S.job]; if (!q || q.done) return null; const ch = chapterOf(S.job, q.c); return ch ? { q, ch, st: ch.steps[q.s] } : null; };
  const qAdvance = (cur) => {
    const { q, ch, st } = cur; addJobXp(1); addRpg(4); msg(`✅ ${st.label}`, 2.6); snd('win'); if (st.k === 'goto') { q.lx = q.tx; q.lz = q.tz; } q.s++; q.p = 0; q.tx = null; q.tz = null; q.spawned = false; q.base = null; ev({ t: 'jobsave' });
    if (q.s >= ch.steps.length) {
      const rw = ch.reward || {}; P.coins += rw.coins || 0; S.stats.coins += rw.coins || 0; if (rw.gem) addFurn(S.home, rollFurn(rnd, 3)); addJobXp(3); addRpg(20); if (!q.cl.includes(q.c)) q.cl.push(q.c); const nn = STORY[S.job].length; let nx = -1; for (let k = 1; k <= nn; k++) { const i = (q.c + k) % nn; if (!q.cl.includes(i)) { nx = i; break; } } if (nx < 0) { q.done = true; q.c = nn; } else q.c = nx; q.s = 0; q.began = false; q.lx = null; q.lz = null;
      ev({ t: 'story', kind: 'clear', title: ch.title, text: ch.outro, coins: rw.coins || 0, last: q.done, rare: !!rw.gem });
    }
  };
  function qNote(what) { const cur = qCur(); if (!cur || cur.st.k !== 'do' || cur.st.what !== what) return; cur.q.p++; if (cur.q.p >= cur.st.n) qAdvance(cur); }
  const nearestOf = (arr) => { let b = null; let bd = 1e18; for (const u of arr) { const d = hyp(u.x - P.x, u.z - P.z); if (d < bd) { bd = d; b = u; } } return b; };
  const stepQuest = () => {
    S.goal = null; S.qLock = null; const cur = qCur();
    if (cur) {
      const { q, ch, st } = cur; const need = lvNeeded(q.c);
      void need;
      {
        if (!q.began) { q.began = true; ev({ t: 'story', kind: 'chapter', title: ch.title, text: ch.say }); ev({ t: 'jobsave' }); }
        if (st.k === 'goto') { if (q.tx == null) { const pp = placeXY(st.at); if (!pp) { qAdvance(cur); return; } q.tx = pp.x; q.tz = pp.z; } S.goal = { x: q.tx, z: q.tz, icon: '📍', label: st.label }; if (hyp(q.tx - P.x, q.tz - P.z) < 16 && P.dead <= 0) qAdvance(cur); }
        else if (st.k === 'boss') {
          if (q.tx == null) { const rp = q.lx != null ? { x: q.lx, z: q.lz } : (farSpot(200, 480) || { x: PLAZA.cx, z: PLAZA.cz }); q.tx = rp.x; q.tz = rp.z; } const tag = `q${q.c}_${q.s}`; const mine = S.crooks.filter((c) => c.qtag === tag);
          if (!q.spawned) { S.goal = { x: q.tx, z: q.tz, icon: '🌹', label: st.label }; if (hyp(q.tx - P.x, q.tz - P.z) < 150) { const types = st.legend ? ['legend'] : st.n === 1 ? ['boss'] : st.elite ? ['gunman', 'elite', 'gunman', 'gunman', 'elite', 'boss'] : ['thug', 'gunman', 'thug', 'gunman', 'boss']; const esc = 1 + 0.12 * Math.max(0, q.c - 4); for (let i = 0; i < st.n; i++) { const c = spawnCrook(types[i % types.length], q.tx + Math.cos(i * 1.7) * 14, q.tz + Math.sin(i * 1.7) * 14, { wander: 30, hpMul: (st.n === 1 ? (st.legend ? 1.2 : 1.8) : 1.15) * esc }); c.qtag = tag; c.qboss = st.n === 1; } q.spawned = true; msg(st.n === 1 ? '🌹 ボス ノワールが あらわれた!' : '🌹 ブラックローズ団だ!', 3); snd('warn'); } }
          else if (!mine.length) qAdvance(cur); else { q.p = st.n - mine.length; S.goal = { x: mine.reduce((a, c) => a + c.x, 0) / mine.length, z: mine.reduce((a, c) => a + c.z, 0) / mine.length, icon: '🌹', label: `${st.label}(のこり ${mine.length})` }; }
        } else if (st.k === 'defend') { if (q.base == null) q.base = S.defLevel; q.p = S.defLevel - q.base; if (q.p >= st.n) qAdvance(cur); else S.goal = { x: COMMANDER.x, z: COMMANDER.z, icon: '🎖️', label: st.label }; }
        else if (st.k === 'do') {
          const w = st.what; let g = null;
          if (['snatch', 'speed', 'raid', 'patient'].includes(w)) { const t = S.tasks.find((x) => x.type === w); if (t) g = { x: t.x, z: t.z, icon: t.icon, label: t.label }; }
          else if (w === 'fire') { const f = nearestOf(S.fires); if (f) g = { x: f.x, z: f.z, icon: '🔥', label: st.label }; else S.fireT = Math.min(S.fireT, 2); }
          else if (w === 'wanted' || w === 'arrest') { const c = nearestOf(S.crooks.filter((x) => x.wid)); if (c) g = { x: c.x, z: c.z, icon: '🚔', label: st.label }; }
          else if (w === 'wreck') { const c = nearestOf(S.traffic.filter((x) => x.hostile && !(x.dead > 0))); if (c) g = { x: c.x, z: c.z, icon: '🎯', label: st.label }; }
          if (g) S.goal = g;
        }
      }
    }
    if (!S.goal && S.job !== 'none') { const t = nearestOf(S.tasks); if (t) S.goal = { x: t.x, z: t.z, icon: t.icon, label: t.label }; else if (S.job === 'fire') { const f = nearestOf(S.fires); if (f) S.goal = { x: f.x, z: f.z, icon: '🔥', label: 'かじを けす' }; } }
  };
  const questView = (job = S.job) => {
    const xp = S.jobXp[job] || 0; const base = { job, lv: jobLevel(xp), xp, next: jobNext(xp), rank: rankOf(job, xp), rpgLv: rpgLevel(S.rpgXp), rpgXp: S.rpgXp, rpgNext: rpgNext(S.rpgXp), howto: JOB_HOWTO }; const q = S.qs[job]; const story = STORY[job]; if (!story || !q) return { ...base, none: true };
    const chapters = story.map((c2, i) => ({ i, title: c2.title, cleared: q.cl.includes(i), cur: !q.done && i === q.c, reco: lvNeeded(i) }));
    if (q.done) return { ...base, done: true, total: story.length, chapters }; const ch = story[q.c]; const need = lvNeeded(q.c);
    return { ...base, c: q.c, total: story.length, title: ch.title, say: ch.say, locked: false, need, left: 0, chapters, steps: ch.steps.map((s2, i) => ({ label: s2.label, n: s2.n || 1, done: i < q.s, cur: i === q.s, p: i === q.s ? q.p : 0 })) };
  };
  // ---- やりこみ(あつめる・たすける・スピードラン) ----
  let CP = null;
  const cpts = () => {
    if (CP) return CP; const Rc = mulberry(901); const used = []; CP = {};
    const okp = (rp) => !insideBuilding(rp.x, rp.z, 0) && !isWater(rp.x, rp.z) && !inRect(AIRFIELD, rp.x, rp.z) && !inRect(HOME, rp.x, rp.z) && hyp(rp.x - SPAWN.x, rp.z - SPAWN.z) > 40;
    const gen = (push) => { for (let t = 0; t < 300; t++) { const rp = roadPoint(Rc, 1); if (okp(rp) && (!push || used.every((u) => hyp(u.x - rp.x, u.z - rp.z) > 55))) { if (push) used.push(rp); return { x: rp.x, z: rp.z }; } } return null; };
    for (const c of COLL) { CP[c.id] = []; if (c.id === 'roof') { const bs = LAYOUT.buildings.map((b, bi) => ({ b, bi })).filter((u) => u.b.h >= 14 && !isWater(u.b.cx, u.b.cz)).sort((p1, p2) => p2.b.h - p1.b.h || p1.bi - p2.bi); const pick = []; for (const u of bs) { if (pick.length >= c.n) break; if (pick.every((q) => hyp(q.b.cx - u.b.cx, q.b.cz - u.b.cz) > 150)) pick.push(u); } for (let i = 0; i < c.n; i++) { const u = pick[i % Math.max(1, pick.length)]; CP[c.id].push(u ? { x: u.b.cx, z: u.b.cz, y: u.b.h, bi: u.bi } : { x: SPAWN.x, z: SPAWN.z + 30 }); } continue; } for (let i = 0; i < c.n; i++) { const a = gen(true); if (!a) { CP[c.id].push({ x: SPAWN.x + 20 + i * 8, z: SPAWN.z + 20 }); continue; } if (c.id === 'run') { let b = null; for (let t = 0; t < 120 && !b; t++) { const q = gen(false); if (q) { const d = hyp(q.x - a.x, q.z - a.z); if (d > 260 && d < 540) b = q; } } if (!b) b = { x: a.x + 300, z: a.z }; a.gx = b.x; a.gz = b.z; a.limit = Math.round(hyp(b.x - a.x, b.z - a.z) / 9 + 14); } CP[c.id].push(a); } }
    return CP;
  };
  const collTotals = () => { let got = 0; let total = 0; for (const c of COLL) { got += S.coll[c.id].length; total += c.n; } return { got, total, pct: Math.round((got / total) * 100) }; };
  const collectItem = (cat, i, bonus = 0) => {
    const c = COLL.find((x) => x.id === cat); if (!c || S.coll[cat].includes(i)) return false; S.coll[cat].push(i); const coins = collPay(c) + bonus; P.coins += coins; S.stats.coins += coins; addRpg(2); snd(cat === 'gold' ? 'gem' : 'coin'); fx('spark', P.x, 2, P.z, 8);
    msg(`${c.icon} ${c.done}  🪙+${coins}  (${S.coll[cat].length}/${c.n})`, 3); ev({ t: 'jobsave' });
    if (S.coll[cat].length >= c.n) { const fid = rollFurn(rnd, 3); addFurn(S.home, fid); P.coins += c.bonus; S.stats.coins += c.bonus; addRpg(15); ev({ t: 'story', kind: 'clear', title: `${c.icon} ${c.name} コンプリート!`, text: c.clear, coins: c.bonus, rare: true }); }
    const tt = collTotals(); if (tt.got >= tt.total && !S.collAll) { S.collAll = true; P.coins += 20000; S.stats.coins += 20000; addRpg(100); ev({ t: 'story', kind: 'clear', title: '🏆 やりこみ 100% たっせい!', text: 'まちの みんなが きみの どうぞうを たてたよ! ほんとうの ヒーローだ!', coins: 20000, last: true }); }
    return true;
  };
  const stepCollect = (dt) => {
    const CPx = cpts(); S.cT -= dt;
    if (S.cT <= 0) {
      S.cT = 0.35; S.cnear = [];
      for (const c of COLL) CPx[c.id].forEach((pt, i) => { if (S.coll[c.id].includes(i)) return; const d = hyp(pt.x - P.x, pt.z - P.z); if (d < 240) S.cnear.push({ cat: c.id, i, x: pt.x, z: pt.z, y: pt.y || 0, icon: c.icon, col: c.col, d }); if (c.auto && d < 4.2 && P.dead <= 0 && P.mode !== 'air' && (c.id === 'roof' ? !!(P.plat && P.plat.bi === pt.bi) : !P.plat)) collectItem(c.id, i); });
    }
    if (S.run) { S.run.t -= dt; const r = S.run; if (hyp(r.gx - P.x, r.gz - P.z) < 12) { collectItem('run', r.i, Math.round(r.t * 12)); S.run = null; } else if (r.t <= 0) { msg('⏱️ じかんぎれ… もういちど ちょうせん!', 3); S.run = null; } else S.goal = { x: r.gx, z: r.gz, icon: '🏁', label: `ゴールへ! のこり ${Math.ceil(r.t)}びょう` }; }
  };
  const collectView = () => ({ cats: COLL.map((c) => ({ id: c.id, name: c.name, icon: c.icon, got: S.coll[c.id].length, total: c.n, how: c.how })), ...collTotals(), run: S.run ? { t: Math.ceil(S.run.t) } : null });
  const dropTask = (t) => { S.tasks = S.tasks.filter((x) => x !== t); };
  const spawnFire = () => {
    if (S.fires.length >= 2) return; const bl = LAYOUT.buildings.filter((b) => ['house', 'apt', 'shop', 'office', 'warehouse', 'supermarket'].includes(b.kind) && b.w * b.d >= 60 && hyp(b.cx - P.x, b.cz - P.z) > 140 && hyp(b.cx - P.x, b.cz - P.z) < 470 && !isWater(b.cx, b.cz)); if (!bl.length) return;
    const b = bl[Math.floor(rnd() * bl.length)]; S.fires.push({ id: ++nid, x: b.cx, z: b.cz, h: Math.min(24, b.h || 8), r: Math.max(4, Math.min(13, Math.sqrt(b.w * b.d) / 2.4)), hp: 100, hpMax: 100, life: 270, hit: 0 }); if (S.job === 'fire') { msg('🔥 かじだ! ちずで ばしょを かくにんしよう', 3.4); snd('warn'); } ev({ t: 'fire' });
  };
  const stepJobs = (dt) => {
    // かじ: ランダムに おきる・ほうっておくと もえつきる
    S.fireT -= dt; if (S.fireT <= 0) { S.fireT = 80 + rnd() * 80; spawnFire(); }
    for (const f of S.fires.slice()) { f.life -= dt; if (f.hit > 0) f.hit -= dt; if (hyp(f.x - P.x, f.z - P.z) < f.r + 2.5 && P.mode === 'foot' && P.dead <= 0) { P.hurtFire = (P.hurtFire || 0) + dt; if (P.hurtFire > 0.6) { P.hurtFire = 0; hurtPlayer(4); } }
      if (f.hp <= 0) { S.fires = S.fires.filter((x) => x !== f); fx('big', f.x, 3, f.z, 8); snd('win'); if (S.job === 'fire') payJob('fire', 2); else { P.coins += 60; S.stats.coins += 60; } }
      else if (f.life <= 0) { S.fires = S.fires.filter((x) => x !== f); if (S.job === 'fire') msg('🔥 かじが もえつきて しまった…', 3); } }
    if (P.spray > 0) P.spray -= dt;
    // しょくぎょうの しごと
    if (S.job === 'none') return; S.taskT -= dt; if (S.taskT <= 0) { S.taskT = 12; ensureTasks(); }
    for (const t of S.tasks.slice()) {
      t.life -= dt; if (t.type === 'snatch') { const c = S.crooks.find((x) => x.id === t.cid); if (!c) { dropTask(t); continue; } t.x = c.x; t.z = c.z; if (t.life <= 0) { S.crooks = S.crooks.filter((x) => x !== c); dropTask(t); msg('👜 ひったくりを にがした…', 3); } }
      else if (t.type === 'speed') { const tc = S.traffic.find((x) => x.id === t.tid); if (!tc || tc.dead > 0) { dropTask(t); continue; } t.x = tc.x; t.z = tc.z; const pv = cur(); if (pv && (pv.kind === 'car' || pv.kind === 'bike') && hyp(pv.x - tc.x, pv.z - tc.z) < 14 && Math.abs(pv.speed) > 6) t.prog += dt; else t.prog = Math.max(0, t.prog - dt * 0.6);
        if (t.prog >= 2.5) { tc.stun = 8; tc.speeding = false; tc.task = null; tc.spd = 12; dropTask(t); msg('🚨 スピードいはんを とりしまった!', 2.6); payJob('speed', 1); } else if (t.life <= 0) { tc.speeding = false; tc.task = null; tc.spd = 12; dropTask(t); msg('🚨 スピードいはんの くるまを みうしなった…', 3); } }
      else if (t.type === 'raid') { const left = S.crooks.filter((c) => c.task === t.id); if (!left.length) { dropTask(t); payJob('raid', 3); } else { t.x = left.reduce((q, c) => q + c.x, 0) / left.length; t.z = left.reduce((q, c) => q + c.z, 0) / left.length; t.label = `ギャングの アジト(のこり ${left.length}にん)`; if (t.life <= 0) { S.crooks = S.crooks.filter((c) => c.task !== t.id); dropTask(t); msg('🏚️ ギャングは にげてしまった…', 3); } } }
      else if (t.type === 'patient') { const p = S.patients.find((x) => x.id === t.pid); if (!p) { dropTask(t); continue; } p.life -= dt; const pv = cur();
        if (p.state === 'treated' && pv && pv.id === 'ambulance' && hyp(pv.x - p.x, pv.z - p.z) < 11) { p.state = 'loaded'; const h = HOSPITALS[p.hosp]; msg(`🚑 のせたよ! ${h.name}へ はこぼう!`, 3.4); snd('door'); }
        if (p.state === 'loaded') { if (pv && pv.id === 'ambulance') { p.x = pv.x; p.z = pv.z; } const h = HOSPITALS[p.hosp]; t.x = h.x; t.z = h.z; t.icon = '🏥'; t.label = `${h.name}へ はこぶ`; if (pv && pv.id === 'ambulance' && hyp(pv.x - h.x, pv.z - h.z) < 26) { S.patients = S.patients.filter((x) => x !== p); dropTask(t); payJob('patient', 3); continue; } }
        else { t.x = p.x; t.z = p.z; }
        if (p.life <= 0) { S.patients = S.patients.filter((x) => x !== p); dropTask(t); msg('🚑 まにあわなかった…', 3.4); snd('lose'); } }
    }
  };
  function treat(pid, ok) {
    const p = S.patients.find((x) => x.id === pid && x.state === 'need'); if (!p) return { ok: false };
    if (ok) { p.state = 'treated'; p.hosp = Math.floor(rnd() * HOSPITALS.length); const h = HOSPITALS[p.hosp]; msg(`✅ おうきゅう てあて せいこう! きゅうきゅうしゃで ${h.name}へ!(のせるには きゅうきゅうしゃで ちかづく)`, 5); snd('win'); return { ok: true, hosp: h }; }
    p.life -= 25; msg('❌ ちがう てあて! かんじゃが くるしそう…', 2.6); snd('warn'); return { ok: false };
  }
  function callVehicle(id) {
    if (!S.hasPhone) return { ok: false, why: 'スマートフォンが ないよ' }; if (P.dead > 0) return { ok: false, why: '' }; const v = S.vehicles.find((x) => x.id === id && !x.temp); if (!v || v.kind === 'ship') return { ok: false, why: 'よべないよ' }; if (!S.owned.includes(id) && !specialOf(id) && !(catalogOf(id) && catalogOf(id).free)) return { ok: false, why: 'もっていない のりものだよ' };
    if (specialOf(id) && !S.owned.includes(id)) return { ok: false, why: 'もっていない のりものだよ' }; if (!canRide(v)) return { ok: false, why: 'いまの しょくぎょうでは のれないよ' }; if (cur() && cur() !== v) { if (isAir(cur().kind) && P.y > 12) return { ok: false, why: 'そらでは つかえないよ' }; leave(); }
    const a = P.camYaw; const f = freeAround(P.x + Math.sin(a) * 7, P.z + Math.cos(a) * 7); v.occ = false; v.x = f.x; v.z = f.z; v.y = 0; v.yaw = P.yaw; v.speed = 0; v.hp = v.hpMax; v.hits = 0; P.chute = false; enter(v); S.ui = null; msg(`📱 ${catalogOf(id) ? catalogOf(id).name : (specialOf(id) || {}).name} を よびだした!`, 2.4); return { ok: true };
  }
  if (S.job === 'swat') LOAN_SET(true);
  const am = (id) => { const sp = ammoSpec(weaponOf(id)); if (!sp) return null; if (!S.ammo[id]) S.ammo[id] = { mag: sp.mag, reserve: Math.floor(sp.cap / 2) }; return S.ammo[id]; };
  const startReload = () => { const W = weaponOf(P.weapon); const sp = ammoSpec(W); if (!sp || P.reload > 0 || P.dead > 0) return false; const A = am(W.id); if (A.mag >= sp.mag || A.reserve <= 0) return false; P.reload = sp.reload; P.reloadId = W.id; snd('reload'); return true; };
  const progress = () => { const o = { a: Object.values(S.arrests).filter((n) => n > 0).length, m: Object.entries(S.done).filter(([k]) => k !== 'secret').reduce((q, [, n]) => q + n, 0), j: S.jobOk }; const b = S.coopBest; if (b) { o.a = Math.max(o.a, b.a | 0); o.m = Math.max(o.m, b.m | 0); o.j = Math.max(o.j, b.j | 0); } return o; }; // きょうりょくの ときは いちばん すすんでいる ひとを きじゅんに
  const ultimateProgress = () => { const eq = EQUIP.filter((e) => !(e.need && e.need.all)); const have = eq.filter((e) => S.eqOwned.includes(e.id)).length + VCAT.filter((it) => S.owned.includes(it.id)).length; return { have, total: eq.length + VCAT.length }; };
  const meets = (need) => { if (!need) return true; if (need.all) { const u = ultimateProgress(); if (u.have < u.total) return false; } if (need.secret && !(S.done.secret > 0)) return false; const pr = progress(); return pr.a >= (need.a || 0) && pr.m >= (need.m || 0) && pr.j >= (need.j || 0); };
  const snd = (n) => { if (S.snd.length < 24) S.snd.push(n); };
  const fx = (kind, x, y, z, r = 8) => { if (S.effects.length < 60) S.effects.push({ kind, x, y, z, r, t: 0, life: kind === 'big' ? 1.2 : 0.7 }); };
  const msg = (t, d = 2.6) => { S.msg = t; S.msgT = d; };
  const banner = (t, d = 2.4) => { S.banner = t; S.bannerT = d; };
  const ev = (e) => S.events.push(e);
  // のりもの(ならべる)
  const HITMAX = { car: 8, bike: 5, tank: 30, ship: 99 };
  const mkVeh = (id, kind, V, home, extra = {}) => ({ hits: 0, hitMax: (V.model === 'truck' ? 12 : HITMAX[kind]) || 99, id, kind, model: V.model || kind, name: V.name || kind, V, x: home.x, y: 0, z: home.z, yaw: home.yaw, pitch: 0, roll: 0, speed: 0, hp: V.hpMax, hpMax: V.hpMax, home: { ...home }, occ: false, away: 0, boost: V.boostMax || 100, fuel: 100, ...extra });
  const parkOwned = () => { const idx = { car: 0, bike: 0, air: 0 }; for (const id of S.owned) { const it = catalogOf(id); if (!it || S.vehicles.some((v) => v.id === id)) continue; const grp = it.kind === 'bike' ? 'bike' : isAir(it.kind) ? 'air' : 'car'; const home = slotOf(it, idx[grp]++); S.vehicles.push(mkVeh(id, it.kind, catalogV(it, ks), { ...home, kind: it.kind }, { cat: id })); } };
  for (const [id, h] of Object.entries(FIXED)) if (vehicles[h.kind]) S.vehicles.push(mkVeh(id, h.kind, vehicles[h.kind], h));
  parkOwned();
  const R2 = mulberry(77);
  for (let i = 0; i < 70; i++) { const rp = roadPoint(R2, 1); const x = rp.x + (R2() - 0.5) * 4; const z = rp.z + (R2() - 0.5) * 4; if (inRect(PLAZA, x, z) || inRect(AIRFIELD, x, z) || insideBuilding(x, z)) continue; S.pickups.push({ id: ++nid, x, z, kind: i % 9 === 0 ? 'gem' : 'coin', v: i % 9 === 0 ? 15 : 3 }); }
  // あるく ひと・はしる くるまは ちずの みちに そって うごく
  const cumOf = (pts) => { const c = [0]; for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + hyp(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return c; };
  const PATHS = CM.roadsOf().filter((r) => r.cls >= 1 && r.pts.length >= 2).map((r) => ({ pts: r.pts, cum: cumOf(r.pts), hw: r.hw, cls: r.cls })).filter((r) => r.cum[r.cum.length - 1] > 90 && r.pts.every((q) => Math.abs(q[0]) < HALF + 5 && Math.abs(q[1]) < HALF + 5));
  const pathAt = (P, sd) => { const L = P.cum[P.cum.length - 1]; const t = clamp(sd, 0, L); let i = 1; while (i < P.pts.length - 1 && P.cum[i] < t) i++; const u = (t - P.cum[i - 1]) / (P.cum[i] - P.cum[i - 1] || 1); const a0 = P.pts[i - 1]; const b0 = P.pts[i]; return { x: lerp(a0[0], b0[0], u), z: lerp(a0[1], b0[1], u), ang: Math.atan2(b0[1] - a0[1], b0[0] - a0[0]) }; };
  const place = (e, P, off) => { const q = pathAt(P, e.s); const nx = -Math.sin(q.ang); const nz = Math.cos(q.ang); e.x = q.x + nx * off; e.z = q.z + nz * off; e.yaw = Math.atan2(Math.cos(q.ang) * e.dir, Math.sin(q.ang) * e.dir); };
  const walkP = PATHS.filter((r) => r.cls <= 2 || true);
  for (let i = 0; i < 46 && walkP.length; i++) { const P = walkP[Math.floor(R2() * walkP.length)]; const w = { id: ++nid, path: P, s: R2() * P.cum[P.cum.length - 1], dir: R2() < 0.5 ? 1 : -1, spd: 1.4 + R2(), off: (R2() < 0.5 ? -1 : 1) * (P.hw - 0.8), look: i, x: 0, z: 0, yaw: 0 }; place(w, P, w.off); if (inRect(PLAZA, w.x, w.z) || inRect(AIRFIELD, w.x, w.z) || insideBuilding(w.x, w.z)) continue; S.walkers.push(w); }
  // えきまえひろばや おみせの まえに たっている ひとたち
  for (let i = 0; i < 16; i++) { const base = i < 9 ? { x: PLAZA.cx, z: PLAZA.cz, rx: (PLAZA.x1 - PLAZA.x0) / 2 - 8, rz: (PLAZA.z1 - PLAZA.z0) / 2 - 8 } : { x: HOME.cx, z: HOME.cz, rx: 0, rz: 0 }; if (i >= 9) { const st = STORES[(i - 9) % STORES.length]; base.x = st.x; base.z = st.z; base.rx = 7; base.rz = 5; } const x = base.x + (R2() - 0.5) * 2 * base.rx; const z = base.z + (R2() - 0.5) * 2 * base.rz; if (isWater(x, z) || insideBuilding(x, z)) continue; S.walkers.push({ id: ++nid, idle: true, path: null, s: 0, dir: 1, spd: 0, off: 0, look: 100 + i, x, z, yaw: R2() * 6.28 }); }
  const pathCache = new Map(); const pathOfRoad = (r) => { let P = pathCache.get(r); if (!P) { P = { pts: r.pts, cum: cumOf(r.pts), hw: r.hw, cls: r.cls }; pathCache.set(r, P); } return P; };
  S.relocWalker = (w) => { for (let t = 0; t < 40; t++) { const rp = roadPoint(R2, 1); const dd = hyp(rp.x - P.x, rp.z - P.z); if (dd < 70 || dd > 230 || insideBuilding(rp.x, rp.z) || inRect(AIRFIELD, rp.x, rp.z) || inRect(HOME, rp.x, rp.z)) continue; const Pp = pathOfRoad(rp.r); if (Pp.cum[Pp.cum.length - 1] < 40) continue; w.path = Pp; w.s = Pp.cum[rp.i - 1] + rp.u * (Pp.cum[rp.i] - Pp.cum[rp.i - 1]); w.dir = R2() < 0.5 ? 1 : -1; w.off = (R2() < 0.5 ? -1 : 1) * (Pp.hw - 0.8); w.scared = 0; S.placeOn(w, Pp, w.off); return true; } return false; };
  const TRAF = ['sedan', 'taxi', 'suv', 'bus', 'truck', 'taxi', 'sports', 'suv', 'scooter', 'bike', 'sedan', 'pbike', 'bus'];
  const carP = PATHS.filter((r) => r.cls >= 2).sort((a, b) => b.cum[b.cum.length - 1] - a.cum[a.cum.length - 1]);
  for (let i = 0; i < 40 && carP.length; i++) { const P = carP[i % Math.min(carP.length, 30)]; const dir = i % 2 ? -1 : 1; const model = TRAF[i % TRAF.length]; const hostile = i % 7 === 4; const bike = catalogOf(model) && catalogOf(model).kind === 'bike'; const c = { id: ++nid, path: P, s: R2() * P.cum[P.cum.length - 1], dir, off: P.hw * 0.5 * dir, spd: (hostile ? 17 : 10) + R2() * 6, tone: i, model: hostile ? (bike ? 'bike' : 'sports') : model, bike: !!(hostile ? bike : bike), hostile, hp: hostile ? 2 : 4, x: 0, z: 0, yaw: 0, wait: 0, dead: 0, r: bike ? 1.4 : model === 'truck' || model === 'bus' ? 3.8 : 2.6 }; place(c, P, c.off); S.traffic.push(c); }
  const carPaths = carP; S.pathAt = pathAt; S.placeOn = place; S.carPaths = carPaths;
  const groundMove = (e, nx, nz, r, water) => {
    const swimOk = e === P && P.mode === 'foot' && !P.chute && !P.plat; const ok = (x, z) => (water ? inRiver(x, z) && x > -466 && x < 466 : (!isWater(x, z) || (swimOk && Math.abs(x) < HALF - 40 && Math.abs(z) < HALF - 40))); let moved = false;
    if (ok(nx, nz)) { e.x = nx; e.z = nz; moved = true; } else if (ok(nx, e.z)) { e.x = nx; moved = true; } else if (ok(e.x, nz)) { e.z = nz; moved = true; }
    if (!water) pushOut(e, r, e === P && P.plat ? P.plat.y + 5 : 0); if (e.room) { e.x = clamp(e.x, e.room.x0 + 1, e.room.x1 - 1); e.z = clamp(e.z, e.room.z0 + 1, e.room.z1 - 1); } { const rm = e.room || (e === P && P.plat && P.plat.kind === 'hideout' ? S.hideouts.find((q) => q.id === P.plat.id) : null); if (rm) for (const cb of rm.cover) { const nx = clamp(e.x, cb.x0, cb.x1); const nz = clamp(e.z, cb.z0, cb.z1); const dd = hyp(e.x - nx, e.z - nz); if (dd < r + 0.1) { if (dd > 0.001) { e.x = nx + ((e.x - nx) / dd) * (r + 0.1); e.z = nz + ((e.z - nz) / dd) * (r + 0.1); } else { const ex = Math.min(e.x - cb.x0, cb.x1 - e.x); const ez = Math.min(e.z - cb.z0, cb.z1 - e.z); if (ex < ez) e.x = e.x - cb.x0 < cb.x1 - e.x ? cb.x0 - r - 0.1 : cb.x1 + r + 0.1; else e.z = e.z - cb.z0 < cb.z1 - e.z ? cb.z0 - r - 0.1 : cb.z1 + r + 0.1; } } } } return moved;
  };
  const cur = () => (P.veh ? S.vehicles.find((v) => v.id === P.veh) : null);
  const VNAME = { car: '🚗', bike: '🏍️', tank: '🚜', ship: '🚢', plane: '✈️', jet: '🛩️' };

  // ---- ちかくの ものと ボタン ----
  const setNear = () => {
    let best = null; let bd = 1e9; const px = P.x; const pz = P.z;
    const PRI = { arrest: 3, collect: 3, hideout: 2, patient: 2, commander: 2, veh: 2, tcar: 2, roof: 0, job: 0, leave: 0, exit: 0 }; let bpri = -1;
    const cand = (kind, id, x, z, r, label, extra = {}) => { const d = hyp(px - x, pz - z); const pri = PRI[kind] != null ? PRI[kind] : 1; if (d < r && (pri > bpri || (pri === bpri && d < bd))) { bd = d; bpri = pri; best = { kind, id, label, d, ...extra }; } };
    if (P.mode === 'foot') {
      for (const c of S.crooks) if (c.state === 'down' && !c.hunter) cand('arrest', c.id, c.x, c.z, 6, `🚔 たいほする${c.wid ? `(けんしょう金 ${bountyOf(c)})` : ''}`);
      for (const v of S.vehicles) if (!v.occ) { if (!canRide(v)) { if (specialOf(v.id)) cand('lockveh', v.id, v.x, v.z, 12, `🔒 ${specialOf(v.id).name}(トレッサで かうと のれるよ)`); continue; } if (!v.temp && v.kind !== 'ship' && inRect(HOME, v.x, v.z)) continue; /* じたくの なかの くるまは ガレージの メニューから のる */ cand('veh', v.id, v.x, v.z, v.kind === 'ship' ? 26 : 12, `${VNAME[v.kind] || '🚗'} ${v.name || ''}に のる`); }
      for (const t of S.traffic) if (!t.dead && (!t.hostile || t.cop)) cand('tcar', t.id, t.x, t.z, 7, t.cop ? '🚓 パトカーを うばう(★3に なるよ!)' : t.denied ? '🚨 むりやり うばう(どろぼうに なるよ!)' : '🚗 うんてんしゅに たのむ(くるまを かりる)');
      for (const c of S.civs) if (c.state === 'need') cand('civ', c.id, c.x, c.z, 9, '🆘 ひとを たすける');
      if (cur() && (cur().kind === 'car' || cur().kind === 'bike') && (cur().fuel == null ? 100 : cur().fuel) < 96) { for (const st of STORES) cand('fuel', 'f' + st.id, st.x, st.z, 26, `⛽ ガソリンを いれる(🪙${Math.ceil((100 - (cur().fuel == null ? 100 : cur().fuel)) * 1.5)})`); cand('fuel', 'fhome', BASE.x, BASE.z, 60, '⛽ じたくで ガソリンを いれる(ただ)'); }
    } else cand('exit', 'exit', px, pz, 999, cur() && isAir(cur().kind) && P.y > 12 ? '🪂 パラシュートで おりる' : '🚪 おりる');
    if (P.mode === 'foot' && P.plat) {
      const pl = P.plat; if (pl.kind === 'hideout') cand('leave', 'leave', pl.cx, pl.z1, 7, 'アジトから でる'); else if (pl.kind !== 'shop') cand('leave', 'leave', pl.cx, pl.cz, 9999, pl.via === 'stair' ? 'かいだんで 1かいへ おりる' : 'エレベーターで 1かいへ おりる');
      if (pl.kind === 'shop') { const st = STORES.find((x) => x.id === pl.id); if (st) cand('store', st.id, pl.cx, pl.cz - 4, 7, `${st.icon} てんいんさんに はなす(${st.name})`); cand('leave', 'leave', pl.cx, pl.cz + 6, 5, '🚪 おみせを でる'); }
    } else {
      if (P.mode === 'foot') for (const h of S.hideouts) cand('hideout', h.id, h.ex, h.ez, 5, h.cleared && h.cd > 0 ? `アジト Lv.${h.lv}(せいあつずみ)` : `アジト Lv.${h.lv} に つっこむ!`);
      if (P.mode === 'foot' && S.lv === 0) for (const w of S.walkers) { if (w.dead > 0 || w.scared > 0) continue; if (Math.abs(w.x - px) > 4 || Math.abs(w.z - pz) > 4) continue; if ((w.talkCd || 0) > S.t) { if (S.allies.length < 2) cand('recruit', w.id, w.x, w.z, 3.6, `🤝 なかまに さそう(🪙${400 + S.allies.length * 300})`); continue; } cand('talk', w.id, w.x, w.z, 3.6, '💬 はなしかける'); }
      if (P.mode === 'foot') for (const g of S.playSpots) cand('play', g.id, g.x, g.z, 7, `${g.icon} ${g.name}で あそぶ(🪙${g.cost})`);
      if (P.mode === 'foot' && !P.fish) for (const f of S.fishSpots) cand('fish', f.i, f.x, f.z, 6, '🎣 つりを する');
      for (const st of STORES) { if (P.mode === 'foot') cand('enter', st.id, st.x, st.z, 11, `🚪 ${st.icon} ${st.name}に はいる(${st.sub})`); else cand('store', st.id, st.x, st.z, 11, `${st.icon} ${st.name}(${st.sub})`); }
      if (P.mode === 'foot') for (const u of STAIRS) { if (Math.abs(u.x - px) > 6 || Math.abs(u.z - pz) > 6) continue; cand('roof', u.bi, u.x, u.z, 4.5, `かいだんで おくじょうへ(たかさ ${Math.round(u.h)}m・スナイパーポイント)`, { via: 'stair' }); }
      if (P.mode === 'foot') for (const b of nearB(px, pz)) { if (b.h < 10) continue; const dx = px - b.cx; const dz = pz - b.cz; const lx = dx * b.c + dz * b.s; const lz = -dx * b.s + dz * b.c; const ex = Math.max(0, Math.abs(lx) - b.w / 2); const ez = Math.max(0, Math.abs(lz) - b.d / 2); const ed = hyp(ex, ez); if (ed < 3.2) cand('roof', LAYOUT.buildings.indexOf(b), px + ed + 1.5, pz, 6, `🏢 エレベーターで おくじょうへ(たかさ ${Math.round(b.h)}m)`); }
    }
    cand('soccer', 'soccer', SOCCER.x, SOCCER.z, 18, '⚽ サッカーじょうへ いく');
    cand('koban', 'koban', KOBAN.x, KOBAN.z, 12, S.lv >= 5 ? '🚓 こうばん(★5は ばっきん できない! にげきれ)' : S.lv > 0 ? `🚓 こうばん(ばっきん 🪙${S.fine} で 指名手配が きえる)` : '🚓 こうばん');
    if (P.mode === 'foot') { cand('commander', 'commander', COMMANDER.x, COMMANDER.z, 7, JSDF.includes(S.job) ? `🎖️ ちょうかんに はなしかける(ぼうえい にんむ Lv.${S.defLevel})` : '🎖️ ちょうかん(じえいたいの ひと いがいは はなせない)'); cand('house', 'house', HOME.cx, HOME.z1 - 25, 10, '🏠 いえに はいる(へや・しょくぎょう)'); for (const p of S.patients) if (p.state === 'need') cand('patient', p.id, p.x, p.z, 6, '🚑 かんじゃを たすける'); if (S.job === 'police' || S.job === 'swat') for (const c of S.crooks) if (c.task && c.type === 'runner' && c.state !== 'down') cand('arrest', c.id, c.x, c.z, 3.6, '🚔 つかまえる!'); }
    if (P.mode === 'foot') for (const u of S.cnear) { const c = COLL.find((x) => x.id === u.cat); if (c.auto) continue; if (c.id === 'run') { if (!S.run) cand('collect', 'run:' + u.i, u.x, u.z, 9, `⏱️ スピードラン(${cpts().run[u.i].limit}びょうで ゴール!)`); } else cand('collect', `${u.cat}:${u.i}`, u.x, u.z, 7, c.verb); }
    cand('board', 'board', BOARD.x, BOARD.z, 11, '📋 指名手配ボードを みる');
    cand('garage', 'garage', GARAGE.x, GARAGE.z, 14, '🏠 じたく(ガレージ)');
    cand('job', 'job', JOB.x, JOB.z, 12, '📚 おべんきょう(綱島東小学校)'); if (CM.polyIn && CM.polyIn(SCHOOL_POLY, px, pz)) cand('job', 'job', px, pz, 9999, '📚 おべんきょう(がっこうに はいったよ)');
    if (!S.mission) for (const m of CITY_MISSIONS) { if (m.id === 'secret') continue; cand('mission', m.id, m.start.x, m.start.z, 14, meets(m.need) ? `${m.icon} ミッション「${m.name}」` : `🔒 ${m.icon} ${m.name}(${needText(m.need)})`); }
    cand('secret', 'secret', SECRET.x, SECRET.z, 6, S.done.secret > 0 ? '👑 かくれキャラと はなす' : '❓ ふしぎな ひとに はなしかける');
    if (S.mission && S.mission.id === 'delivery' && S.mission.stage === 0) cand('pack', 'pack', S.mission.pk.x, S.mission.pk.z, 14, '📦 にもつを うけとる');
    if (!S.secretHint && !(S.done.secret > 0) && hyp(P.x - SECRET.x, P.z - SECRET.z) < 110) { const u = ultimateProgress(); if (u.have >= u.total) { S.secretHint = true; msg('🔔 ちかくに ふしぎな けはいが する…', 4); } }
    S.nearby = best;
  };
  const canRide = (v) => { const it = catalogOf(v.id); if (it && it.job && S.job !== it.job) return false; if (!specialOf(v.id)) return true; return S.owned.includes(v.id) || (v.id === 'tank' && S.job === 'jgsdf') || (v.id === 'plane' && S.job === 'jasdf'); };
  const enter = (v) => {
    if (!canRide(v)) { msg('🔒 まだ かっていないよ(トレッサで かおう)', 2.4); return; }
    if (S.lv > 0 && S.heatVeh && S.heatVeh !== v.id && !isAir(v.kind) && !S.traffic.some((c) => c.cop && !(c.dead > 0) && hyp(c.x - P.x, c.z - P.z) < 55)) { S.heatT = Math.max(2, S.heatT * 0.5); S.heatVeh = v.id; msg('🚗 のりものを かえた! けいさつの てがかりが へった', 2.8); }
    P.mode = 'veh'; P.veh = v.id; v.occ = true; v.away = 0; P.aimRel = 0; P.aimPitch = 0.05; P.noAim = 0; P.boost = 100;
    if (isAir(v.kind)) { v.y = 60; v.speed = v.V.speed; v.pitch = 0; v.yaw = v.home.yaw; msg(`${VNAME[v.kind]} ${v.name}に のったよ! そらへ!`); }
    else msg(`${VNAME[v.kind] || ''} ${v.name}に のったよ`);
    P.x = v.x; P.z = v.z; P.y = v.y; P.yaw = v.yaw; snd('door');
  };
  const leave = () => {
    const v = cur(); if (!v) return; v.occ = false; v.away = 0; const sd = v.yaw + Math.PI / 2; const air = isAir(v.kind);
    P.camFree = false; P.mode = 'foot'; P.veh = null; P.x = v.x + Math.sin(sd) * (v.kind === 'ship' ? 18 : 6); P.z = v.z + Math.cos(sd) * (v.kind === 'ship' ? 18 : 6); P.y = air ? v.y : 0; P.yaw = v.yaw; P.speed = 0;
    if (air && v.y > 12) { P.chute = true; msg('🪂 パラシュートで ゆっくり おりるよ'); v.x = v.home.x; v.z = v.home.z; v.y = 0; v.yaw = v.home.yaw; v.speed = 0; v.hp = v.hpMax; }
    else if (air) { v.speed = 0; }
    if (isWater(P.x, P.z) && v.kind === 'ship') {
      let ok = false; for (let r = 18; r < 120 && !ok; r += 6) for (let a = 0; a < 16 && !ok; a++) { const x = v.x + Math.cos(a * 0.39) * r; const z = v.z + Math.sin(a * 0.39) * r; if (!isWater(x, z) && !insideBuilding(x, z)) { P.x = x; P.z = z; ok = true; } }
      if (!ok) { P.x = v.home.x + 30; P.z = v.home.z + 40; }
    }
    snd('door');
  };

  // ---- ミッション ----
  const startMission = (id) => {
    const m = missionOf(id); if (!m || S.mission) return false;
    const M = { id, stage: 0, t: 0, name: m.name, icon: m.icon, total: 0, got: 0 }; S.mission = M;
    if (id === 'patrol' || id === 'harbor') { M.total = m.points.length; M.targets = m.points.map((p) => ({ ...p })); }
    else if (id === 'sky') { M.total = m.rings.length; M.targets = m.rings.map((p) => ({ ...p })); }
    else if (id === 'rescue') { M.total = m.civs.length; for (const c of m.civs) S.civs.push({ id: ++nid, x: c.x, z: c.z, yaw: 0, state: 'need', fear: 0, home: { ...c } }); for (let i = 0; i < m.guards; i++) spawnCrook('thug', m.civs[i % m.civs.length].x + 18, m.civs[i % m.civs.length].z + 14, { wander: 28 }); }
    else if (m.gang) { M.total = m.crooks; M.gangX = true; if (m.time) M.timeLeft = m.time; const ty = m.types; for (let i = 0; i < m.crooks; i++) spawnCrook(ty[i % ty.length], m.spot.x + Math.cos(i * 1.3) * 30, m.spot.z + Math.sin(i * 1.3) * 30, { wander: 45, mission: true, hpMul: m.hpMul || 1 }); M.targets = [{ x: m.spot.x, z: m.spot.z }]; }
    else if (id === 'gang') { M.total = m.crooks; for (let i = 0; i < m.crooks; i++) spawnCrook(['thug', 'gunman', 'thug', 'gunman', 'boss'][i % 5], m.spot.x + Math.cos(i * 1.3) * 34, m.spot.z + Math.sin(i * 1.3) * 34, { wander: 50, mission: true }); M.targets = [{ x: m.spot.x, z: m.spot.z }]; }
    else if (id === 'delivery') { M.total = 2; M.pk = { ...m.pickup }; M.timeLeft = m.time; M.targets = [{ x: m.pickup.x, z: m.pickup.z }]; }
    banner(`${m.icon} ${m.name}`); msg(m.brief, 5); snd('mission'); return true;
  };
  const endMission = (ok, why) => {
    const M = S.mission; if (!M) return; const m = missionOf(M.id);
    if (ok) { S.done[M.id] = (S.done[M.id] || 0) + 1; S.stats.missions++; const r = { ...m.reward }; const coins = r.coins || 0; delete r.coins; P.coins += coins; S.stats.coins += coins; ev({ t: 'reward', id: M.id, name: m.name, reward: r, pts: m.pts || 0, coins, first: S.done[M.id] === 1 }); banner('✅ ミッション クリア!', 3); msg(`ごほうび: コイン +${coins}${Object.keys(r).length ? ' + チケット' : ''}`, 4); snd('win'); fx('big', P.x, P.y + 4, P.z, 10); }
    else { banner('ミッション しっぱい…', 2.6); msg(why || 'もういちど ちょうせんしよう', 3.5); snd('lose'); }
    S.civs = []; S.mission = null; P.carry = 0; S.crooks = S.crooks.filter((c) => !c.mission);
  };
  const cancelMission = () => { if (S.mission) { S.civs = []; S.crooks = S.crooks.filter((c) => !c.mission); S.mission = null; P.carry = 0; msg('ミッションを やめたよ'); } };

  // ---- はんにん ----
  function spawnCrook(type, x, z, o = {}) {
    if (insideBuilding(x, z, 0) || isWater(x, z)) { const f = freeAround(x, z); x = f.x; z = f.z; }
    const T = CROOKS[type]; const hp = Math.round(T.hp * (o.hpMul || 1) * DIFF_HP * (1 + 0.05 * (rpgLevel(S.rpgXp) - 1)) * (1 + 0.55 * (players.length - 1)));
    const c = { id: ++nid, type, x, z, yaw: rnd() * 6.28, hp, hpMax: hp, cd: 1 + rnd(), homeX: x, homeZ: z, wander: o.wander || 36, state: 'idle', t: 0, downT: 0, mission: !!o.mission, wid: o.wid || null, rad: T.rad || 0, speed: T.speed, ph: rnd() * 6, alert: false, look: Math.floor(rnd() * 8), flee: 0 };
    S.crooks.push(c); return c;
  }
  const bountyOf = (c) => { if (c.wid) { const w = WANTED.find((x) => x.id === c.wid); const n = S.arrests[c.wid] || 0; return Math.round(w.bounty * (n === 0 ? 1 : 0.5)); } return c.minor ? 40 : 0; };
  // ひとが かくれる ばしょは まいかい ちがう(つよい はんにんほど とおい ばしょ)
  const pickSpot = (w) => {
    if (rnd() < 0.3) return w.spot; const lo = 120 + w.stars * 90; const hi = 320 + w.stars * 170;
    for (let t = 0; t < 70; t++) { const rp = roadPoint(rnd, 1); const d = hyp(rp.x - HQ.x, rp.z - HQ.z); if (d < lo || d > hi || insideBuilding(rp.x, rp.z, 0) || isWater(rp.x, rp.z) || inRect(AIRFIELD, rp.x, rp.z) || inRect(HOME, rp.x, rp.z) || hyp(rp.x - P.x, rp.z - P.z) < 90) continue; return { x: rp.x, z: rp.z }; }
    return w.spot;
  };
  const spawnWanted = (w) => {
    const sp = pickSpot(w); const form = Math.floor(rnd() * 3); // かこむ・いっれつ・ばらばら
    spawnCrook(w.type, sp.x, sp.z, { wid: w.id, wander: 30 + rnd() * 30, hpMul: w.hpMul || 1 });
    for (let i = 0; i < w.guards; i++) { const a = (i / w.guards) * 6.28 + rnd() * 0.5; const rr = form === 0 ? 22 : form === 1 ? 10 + i * 6 : 12 + rnd() * 26; const ax = form === 1 ? sp.x + (i - w.guards / 2) * 7 : sp.x + Math.cos(a) * rr; const az = form === 1 ? sp.z + 14 : sp.z + Math.sin(a) * rr; spawnCrook(w.guardType || (w.stars >= 4 && i < 2 ? 'gunman' : 'thug'), ax, az, { wander: 30 + rnd() * 20, hpMul: 1, guardOf: w.id }); }
  };
  const spawnHideout = (h) => {
    const n = Math.min(10, 4 + h.lv); const types = []; for (let i = 0; i < n; i++) types.push(i === n - 1 && h.lv >= 2 ? 'boss' : i % 3 === 2 || h.lv >= 4 ? 'gunman' : 'thug');
    types.forEach((tp, i) => { const x = h.x0 + 4 + rnd() * (h.x1 - h.x0 - 8); const z = h.z0 + 3 + rnd() * (h.z1 - h.z0 - 10); const c = spawnCrook(tp, x, z, { wander: 7, hpMul: 1 + 0.12 * h.lv }); c.hideout = h.id; c.room = h; c.alert = true; if (tp === 'boss') c.qboss = true; });
    h.spawned = true; h.cleared = false;
  };
  const enterHideout = (h) => {
    if (S.lv > 0) { msg('てはい ちゅうは アジトに はいれないよ!', 2.6); return true; } if (P.mode !== 'foot') return true; if (!h.spawned || (h.cleared && h.cd <= 0)) { S.crooks = S.crooks.filter((c) => c.hideout !== h.id); spawnHideout(h); }
    P.plat = { kind: 'hideout', id: h.id, y: ROOM_Y, cx: h.cx, cz: h.cz, x0: h.x0 + 1, x1: h.x1 - 1, z0: h.z0 + 1, z1: h.z1 - 1, ex: h.ex, ez: h.ez }; P.x = h.cx; P.z = h.z1 - 3; P.yaw = Math.PI; P.camYaw = Math.PI; P.speed = 0; P.invuln = Math.max(P.invuln || 0, 3); for (const c of S.crooks) if (c.hideout === h.id) c.cd = 3 + rnd() * 2.5; snd('door'); banner(`アジト Lv.${h.lv}! てきを ぜんいん たおせ!`, 3); msg(h.cleared ? 'ここは もう せいあつしたよ' : 'ギャングが まちぶせしている…!', 3); return true;
  };
  const stepHideouts = (dt) => {
    for (const h of S.hideouts) {
      if (h.cd > 0) h.cd -= dt; if (!h.spawned || h.cleared) continue; const alive = S.crooks.some((c) => c.hideout === h.id && c.state !== 'down'); if (alive) continue;
      h.cleared = true; h.cd = 240; const coins = 500 * h.lv; P.coins += coins; S.stats.coins += coins; const fid = rollFurn(rnd, Math.min(3, 1 + Math.floor(h.lv / 2))); addFurn(S.home, fid); addRpg(8 + h.lv * 2); S.crooks = S.crooks.filter((c) => c.hideout !== h.id); S.pickups.push({ id: ++nid, kind: 'coin', x: h.cx, z: h.cz, v: 200 * h.lv, icon: '🪙', col: '#ffd23f' }); banner(`アジト Lv.${h.lv} せいあつ! 🪙+${coins}`, 4); msg(`🎁 かぐ ${furnOf(fid).icon} ${furnOf(fid).name} を てにいれた!`, 3.4); snd('win'); ev({ t: 'jobsave' });
    }
  };
  // ---- ストリート イベント(GTAの ランダム イベントを さんこう): ごうとう・こうそう・ぶっし とうか・ストリートの ボス ----
  const EVT = [
    { type: 'robbery', icon: '🏦', label: 'ぎんこう ごうとう!', n: 4, kinds: ['gunman'], coins: 900, say: '🏦 ぎんこう ごうとうだ! ちずの ばしょへ!' },
    { type: 'gangwar', icon: '🔫', label: 'ギャングの こうそう!', n: 7, kinds: ['thug', 'gunman', 'thug'], coins: 1100, say: '🔫 ギャングの こうそう! まきこまれる まえに とめよう!' },
    { type: 'airdrop', icon: '📦', label: 'ぶっし とうか!', n: 4, kinds: ['thug', 'gunman'], coins: 1300, say: '📦 そらから ぶっしが おちた! ギャングが ねらっているぞ!', loot: true },
    { type: 'boss', icon: '💀', label: 'ストリートの ボス!', n: 1, kinds: ['elite'], coins: 2600, say: '💀 ストリートの ボスが あらわれた! つよいぞ!', minLv: 3 },
    { type: 'mugging', icon: '🆘', label: 'おそわれている ひとを たすけろ!', n: 2, kinds: ['thug', 'thug'], coins: 650, say: '🆘 つうこうにんが おそわれている! たすけに いこう!' },
    { type: 'thief', icon: '👜', label: 'どろぼうを おえ!', n: 1, kinds: ['runner'], coins: 750, say: '👜 どろぼうだ! にげる まえに おえ!' },
    { type: 'van', icon: '💰', label: 'げんきんゆそうしゃ!', n: 0, coins: 1400, say: '💰 げんきんゆそうしゃが はしっている! ぶつけて とめろ!', van: true },
    { type: 'race', icon: '🏁', label: 'ストリート レース!', n: 0, coins: 1800, say: '🏁 ストリート レース! くるまか バイクで チェックポイントを とおろう!', race: true },
    { type: 'rescue', icon: '🚗', label: 'たちおうじょう', n: 0, coins: 450, say: '🚗 くるまが うごかなくて こまっている ひとが いる! ちかくへ いこう', reach: true },
    { type: 'rescue', icon: '👦', label: 'まいごの こ', n: 0, coins: 550, say: '👦 まいごの こが ないている! ちかくへ いこう', reach: true },
    { type: 'rescue', icon: '🤕', label: 'こうつうじこ', n: 0, coins: 800, say: '🤕 こうつうじこだ! けがをした ひとを たすけに いこう', reach: true },
    { type: 'rescue', icon: '🧳', label: 'ヒッチハイカー', n: 0, coins: 500, say: '🧳 ヒッチハイクを している ひとが いる! ちかくへ いこう', reach: true },
    { type: 'hostage', icon: '🆘', label: 'ひとじち じけん!', n: 5, kinds: ['gunman', 'thug'], coins: 1600, say: '🆘 ひとじち じけん! はんにんを ぜんいん たおして たすけだそう!' },
  ];
  // まちの ひとと はなす(GTAの しみんとの かいわを さんこう): ヒント・おこづかい・うわさばなし
  const dirWord = (x, z) => { const a = angDiff(Math.atan2(x - P.x, z - P.z), P.camYaw); const q = Math.abs(a) < 0.8 ? 'まえ' : Math.abs(a) > 2.3 ? 'うしろ' : a > 0 ? 'ひだり' : 'みぎ'; return `${q}のほう ${Math.round(hyp(x - P.x, z - P.z) / 10) * 10}mくらい`; };
  const talkTo = (w) => {
    const q = rnd(); if (!S.pet && rnd() < 0.12) { S.pet = { kind: rnd() < 0.5 ? 'dog' : 'cat', x: P.x + 2, z: P.z + 2, yaw: 0, dig: 70 + rnd() * 50, mv: 0 }; msg(`🗣 「この こを あげる! だいじに してね」 ${S.pet.kind === 'dog' ? '🐕 ポチ' : '🐈 タマ'}が なかまに なった!`, 4); snd('win'); ev({ t: 'jobsave' }); return; } const pin = (x, z, icon, label) => { S.hintPin = { x, z, icon, label, t: 90 }; };
    if (q < 0.22) { const hs = S.hideouts.filter((h) => !(h.cleared && h.cd > 0)).sort((a, b) => hyp(a.ex - P.x, a.ez - P.z) - hyp(b.ex - P.x, b.ez - P.z))[0]; if (hs) { pin(hs.ex, hs.ez, '🏚', `アジト Lv.${hs.lv}`); msg(`🗣 「あの ビルの まえに ギャングの アジトが あるらしいよ…(${dirWord(hs.ex, hs.ez)})」 ちずに しるしを つけたよ`, 4.5); return; } }
    if (q < 0.4) { const f = S.fishSpots.slice().sort((a, b) => hyp(a.x - P.x, a.z - P.z) - hyp(b.x - P.x, b.z - P.z))[0]; if (f) { pin(f.x, f.z, '🎣', 'つりスポット'); msg(`🗣 「かわぞいで おおきな さかなが つれるんだ!(${dirWord(f.x, f.z)})」 ちずに しるしを つけたよ`, 4.5); return; } }
    if (q < 0.55) { const u = S.cnear.slice().sort((a, b) => a.d - b.d)[0]; if (u) { pin(u.x, u.z, u.icon, 'きになる もの'); msg(`🗣 「さっき あっちで ${u.icon} みたいな ものを みたよ(${dirWord(u.x, u.z)})」 ちずに しるしを つけたよ`, 4.5); return; } }
    if (q < 0.68) { const c = 30 + Math.floor(rnd() * 90); P.coins += c; S.stats.coins += c; msg(`🗣 「いつも ありがとう! おこづかい あげる」 🪙+${c}`, 3.4); snd('coin'); return; }
    if (q < 0.8 && S.event) { msg(`🗣 「${S.event.icon} ${S.event.label} が あったみたい!(${dirWord(S.event.x, S.event.z)})」`, 3.6); return; }
    const lines = ['「きょうは いい てんきだね」', '「あめが ふりそうだな…かさ もってこなきゃ」', '「このまち、さいきん さわがしくて こわいわ」', '「くるまには きをつけてね!」', '「ヒーローさん! ファンです!」', '「かわで つりを するのが たのしみなんだ」', '「パトカーが おおいと アジトが ちかいって うわさだよ」'];
    msg(`🗣 ${lines[Math.floor(rnd() * lines.length)]}`, 3);
  };
  const stepEvents = (dt) => {
    if (S.hintPin) { S.hintPin.t -= dt; if (S.hintPin.t <= 0 || hyp(S.hintPin.x - P.x, S.hintPin.z - P.z) < 12) S.hintPin = null; else if (!S.goal) S.goal = { x: S.hintPin.x, z: S.hintPin.z, icon: S.hintPin.icon, label: S.hintPin.label }; }
    if (P.plat && P.plat.kind === 'roof' && P.dead <= 0) { // おくじょうに いる あいだ、ビルの まわりに ギャングが あつまる(うえから ねらえる)
      S.roofT = (S.roofT == null ? 3 : S.roofT) - dt; const alive = S.crooks.filter((c) => c.roofTag && c.state !== 'down').length;
      if (alive < 4 && S.roofT <= 0) { S.roofT = 12; const bb = LAYOUT.buildings[P.plat.bi]; const rad = bb ? Math.max(bb.w, bb.d) / 2 + 14 : 30; for (let k = 0; k < 16 && S.crooks.filter((c) => c.roofTag && c.state !== 'down').length < 5; k++) { const a = rnd() * 6.283; const rr = rad + rnd() * 22; const x = P.plat.cx + Math.sin(a) * rr; const z = P.plat.cz + Math.cos(a) * rr; if (insideBuilding(x, z, 0) || isWater(x, z) || inRect(AIRFIELD, x, z)) continue; const c = spawnCrook(rnd() < 0.5 ? 'gunman' : 'thug', x, z, { wander: 18 }); c.roofTag = true; c.alert = true; } if (alive < 1) msg('ギャングが ビルを かこんだ! うえから ねらおう!', 3); }
    } else if (S.crooks.some((c) => c.roofTag)) { S.crooks = S.crooks.filter((c) => !c.roofTag || hyp(c.x - P.x, c.z - P.z) < 70); for (const c of S.crooks) if (c.roofTag && !P.plat) c.roofTag = false; }
    const e0 = S.event; if (!e0) { S.evT = (S.evT == null ? 70 : S.evT) - dt; }
    if (P.fish) { const F = P.fish; if (P.speed > 1.5 || P.mode !== 'foot' || P.dead > 0) { P.fish = null; msg('🎣 うごいたので さかなが にげた…', 2); } else { F.t -= dt; if (F.t <= 0) { P.fish = null; const q = rnd(); const [nm, c] = q < 0.55 ? ['こざかな', 60] : q < 0.85 ? ['おさかな', 160] : q < 0.97 ? ['おおもの!', 420] : ['ながぐつ…(ざんねん)', 5]; P.coins += c; S.stats.coins += c; addRpg(1); msg(`🎣 ${nm} が つれた! 🪙+${c}`, 2.8); snd(c >= 160 ? 'win' : 'coin'); ev({ t: 'jobsave' }); } } }
    if (e0) {
      const left = S.crooks.filter((c) => c.qtag === e0.tag && c.state !== 'down').length; e0.left = left; e0.life -= dt;
      if (e0.van) { const tc = S.traffic.find((c) => c.id === e0.tid); if (!tc || e0.life <= 0) { S.event = null; S.evT = 60; return; } e0.x = tc.x; e0.z = tc.z; e0.spawned = true; if (tc.dead > 0) { P.coins += e0.coins; S.stats.coins += e0.coins; addRpg(8); S.pickups.push({ id: ++nid, kind: 'coin', x: tc.x, z: tc.z, v: 500, icon: '🪙', col: '#ffd23f' }); banner(`💰 げんきんゆそうしゃを とめた! 🪙+${e0.coins}`, 3.4); snd('win'); tc.cashVan = false; S.event = null; S.evT = 110 + rnd() * 90; ev({ t: 'jobsave' }); return; } if (!S.goal) S.goal = { x: tc.x, z: tc.z, icon: '💰', label: e0.label }; return; }
      if (e0.race) { const R = e0.race; const pt = R.pts[R.i]; e0.x = pt.x; e0.z = pt.z; e0.spawned = true; const vv = cur(); if (R.started) { R.t -= dt; if (R.t <= 0) { msg('🏁 じかんぎれ… レース しっぱい', 3); S.event = null; S.evT = 80; return; } } if (hyp(pt.x - P.x, pt.z - P.z) < 16 && vv && !isAir(vv.kind)) { R.started = true; R.i++; R.t = 42; snd('coin'); if (R.i >= R.pts.length) { P.coins += e0.coins; S.stats.coins += e0.coins; addRpg(10); banner(`🏁 ゴール! 🪙+${e0.coins}`, 3.4); snd('win'); S.event = null; S.evT = 120 + rnd() * 90; ev({ t: 'jobsave' }); return; } msg(`🏁 チェックポイント ${R.i}/${R.pts.length}`, 1.4); } if (!S.goal) S.goal = { x: R.pts[Math.min(R.i, R.pts.length - 1)].x, z: R.pts[Math.min(R.i, R.pts.length - 1)].z, icon: '🏁', label: R.started ? `チェックポイント ${R.i + 1}/${R.pts.length}(のこり ${Math.ceil(R.t)}びょう)` : 'スタート ちてんへ(のりもので)' }; return; }
      if (e0.reach) { if (!e0.spawned && hyp(e0.x - P.x, e0.z - P.z) < 150) { S.walkers.push({ id: e0.wid, idle: true, path: null, s: 0, dir: 1, spd: 0, off: 0, look: 120 + (e0.wid % 7), x: e0.x, z: e0.z, yaw: rnd() * 6.28, evt: e0.tag }); e0.spawned = true; } if (e0.spawned && hyp(e0.x - P.x, e0.z - P.z) < 9 && P.dead <= 0) { const pvv = cur(); if (!pvv || Math.abs(pvv.speed) < 8) { P.coins += e0.coins; S.stats.coins += e0.coins; addRpg(6); S.walkers = S.walkers.filter((w) => w.evt !== e0.tag); banner(`${e0.icon} ${e0.label} かいけつ! 🪙+${e0.coins}`, 3.4); msg('「ありがとう!」', 2.2); snd('win'); ev({ t: 'jobsave' }); S.event = null; S.evT = 100 + rnd() * 80; return; } } if (e0.life <= 0 || hyp(e0.x - P.x, e0.z - P.z) > 750) { S.walkers = S.walkers.filter((w) => w.evt !== e0.tag); S.event = null; S.evT = 60; return; } if (!S.goal) S.goal = { x: e0.x, z: e0.z, icon: e0.icon, label: e0.label }; return; }
      if (hyp(e0.x - P.x, e0.z - P.z) > 750 || e0.life <= 0) { S.crooks = S.crooks.filter((c) => c.qtag !== e0.tag); S.event = null; S.evT = 60; return; }
      if (!e0.spawned) { if (hyp(e0.x - P.x, e0.z - P.z) < 130) { for (let i = 0; i < e0.n; i++) { const c = spawnCrook(e0.kinds[i % e0.kinds.length], e0.x + Math.cos(i * 1.9) * (6 + i), e0.z + Math.sin(i * 1.9) * (6 + i), { wander: 14, hpMul: 1 + 0.06 * (rpgLevel(S.rpgXp) - 1) }); c.qtag = e0.tag; c.alert = true; } e0.spawned = true; } }
      else if (!left) { P.coins += e0.coins; S.stats.coins += e0.coins; addRpg(8); if (e0.loot) S.pickups.push({ id: ++nid, kind: 'coin', x: e0.x, z: e0.z, v: 400, icon: '🪙', col: '#ffd23f' }); banner(`${e0.icon} ${e0.label} かいけつ! 🪙+${e0.coins}`, 3.4); snd('win'); ev({ t: 'jobsave' }); S.event = null; S.evT = 110 + rnd() * 90; return; }
      if (!S.goal) S.goal = { x: e0.x, z: e0.z, icon: e0.icon, label: e0.spawned ? `${e0.label}(のこり ${left})` : e0.label };
      return;
    }
    if (S.evT > 0 || S.lv > 0 || P.plat || S.mission || S.ui || isAir(P.mode === 'veh' && cur() ? cur().kind : 'foot') || P.dead > 0) return;
    const pool = EVT.filter((q) => !q.minLv || rpgLevel(S.rpgXp) >= q.minLv); const t = pool[Math.floor(rnd() * pool.length)]; const rp = farSpot(170, 380); if (!rp) { S.evT = 10; return; }
    const ne = { ...t, tag: `ev${++nid}`, x: rp.x, z: rp.z, spawned: false, life: 360, left: t.n, wid: ++nid };
    if (t.van) { const tc = S.traffic.find((c) => !c.hostile && !c.cop && !c.task && !(c.dead > 0) && !c.bike && hyp(c.x - P.x, c.z - P.z) > 90 && hyp(c.x - P.x, c.z - P.z) < 320); if (!tc) { S.evT = 15; return; } tc.cashVan = true; tc.hp = 2; tc.spd = 17; ne.tid = tc.id; ne.x = tc.x; ne.z = tc.z; ne.life = 200; }
    if (t.race) { const pts = [rp]; for (let k = 0; k < 4; k++) { let nx = null; for (let a = 0; a < 40 && !nx; a++) { const q = roadPoint(R2, 1); const dd = hyp(q.x - pts[pts.length - 1].x, q.z - pts[pts.length - 1].z); if (dd > 110 && dd < 240 && !isWater(q.x, q.z) && !insideBuilding(q.x, q.z, 0) && !inRect(AIRFIELD, q.x, q.z)) nx = q; } if (!nx) break; pts.push(nx); } if (pts.length < 4) { S.evT = 15; return; } ne.race = { pts, i: 0, t: 0, started: false }; ne.life = 420; }
    S.event = ne; msg(t.say, 3.6); snd('warn');
  };
  const respawnAt = {}; for (const w of WANTED) spawnWanted(w);
  const refreshWanted = () => { S.wanted = WANTED.map((w) => { const c = S.crooks.find((x) => x.wid === w.id); return { id: w.id, name: w.name, rarity: w.rarity || null, rname: w.rarity ? RARITY_NAME[w.rarity] : '', crime: w.crime, stars: w.stars, bounty: Math.round(w.bounty * ((S.arrests[w.id] || 0) === 0 ? 1 : 0.5)), alive: !!c, x: c ? c.x : null, z: c ? c.z : null, caught: S.arrests[w.id] || 0, state: c ? c.state : 'gone' }; }); };
  refreshWanted();
    const dropPickup = (x, z, d, icon, col) => { S.pickups.push({ id: ++nid, kind: 'drop', x: x + (rnd() - 0.5) * 5, z: z + (rnd() - 0.5) * 5, v: 0, drop: d, icon, col, life: 150 }); };
  const dropLoot = (c) => {
    const w = WANTED.find((x) => x.id === c.wid); if (!w || c.dropped) return; c.dropped = true; const pool = DROP_POOLS[w.rarity];
    dropPickup(c.x, c.z, { t: 'coins', v: pool ? pool.coins : Math.round(w.bounty * 0.3) }, '🪙', '#ffd23f'); dropPickup(c.x, c.z, { t: 'heal' }, '❤️', '#ff6a8a'); dropPickup(c.x, c.z, { t: 'ammo' }, '📦', '#9fe29f');
    // ドロップは 「いま ショップで かえる いちばん つよい そうび」までに する(かえない ものは でない)
    const capped = (list, kind) => { const T = kind === 'w' ? WEAPONS : EQUIP; const buyable = T.filter((it) => it.price > 0 && meets(it.need) && !(it.need && it.need.secret)); const cap = buyable.reduce((m, it) => Math.max(m, it.price), 0); const ok = list.filter((id) => { const it = T.find((x) => x.id === id); return it && it.price <= cap; }); if (ok.length) return ok; const top = buyable.filter((it) => it.price >= cap * 0.5).map((it) => it.id); return top.length ? top : list.slice(0, 1); };
    const pick = (list0, own, kind = 'w') => { const list = capped(list0, kind); const un = list.filter((id) => !own.includes(id)); const arr = un.length ? un : list; return arr[Math.floor(rnd() * arr.length)]; };
    if (pool) { const col = w.rarity === 'super2' ? '#ff5aff' : w.rarity === 'super' ? '#ffb02a' : '#5ac8ff'; S.pity = (S.pity || 0) + 1; const force = S.pity >= 5; // 1たいに つき レアアイテムは 1こまで・5かい つづけて でなければ かくてい
      if (force || rnd() < pool.pw) { dropPickup(c.x, c.z, { t: 'weapon', id: pick(pool.w, S.wOwned) }, '🔫', col); S.pity = 0; } else if (rnd() < pool.pe) { dropPickup(c.x, c.z, { t: 'equip', id: pick(pool.e, S.eqOwned, 'e') }, '👕', col); S.pity = 0; } }
    else if (w.stars >= 3 && rnd() < 0.2) dropPickup(c.x, c.z, { t: 'weapon', id: pick(['heavypistol', 'smg', 'pump', 'assault'], S.wOwned) }, '🔫', '#5ac8ff');
    msg(`${w.rarity ? '✨ ' : ''}アイテムを おとした! ひろおう!`, 3); snd('coin');
  };
  const applyDrop = (d) => {
    if (d.t === 'coins') { P.coins += d.v; S.stats.coins += d.v; snd('coin'); msg(`🪙 +${d.v}`, 1.6); }
    else if (d.t === 'heal') { P.hp = P.hpMax; snd('win'); msg('❤️ HPが ぜんかいふく!', 2); }
    else if (d.t === 'ammo') { for (const wid of S.wOwned) { const sp = ammoSpec(weaponOf(wid)); if (sp) { const A = am(wid); A.reserve = sp.cap; A.mag = Math.max(A.mag, sp.mag); } } snd('win'); msg('📦 たまを ぜんぶ ほじゅう!', 2); }
    else if (d.t === 'weapon') { const w = weaponOf(d.id); if (!w) return; if (S.wOwned.includes(d.id)) { P.coins += 800; msg(`🎁 ${w.name}(もってる) → 🪙+800`, 2.4); } else { S.wOwned.push(d.id); const sp = ammoSpec(w); if (sp) S.ammo[d.id] = { mag: sp.mag, reserve: Math.floor(sp.cap / 2) }; msg(`🎁 ${w.icon || ''} ${w.name} を てにいれた!`, 3.4); ev({ t: 'dropget', kind: 'weapon', id: d.id }); } snd('win'); }
    else if (d.t === 'equip') { const e = equipOf(d.id); if (!e) return; if (S.eqOwned.includes(d.id)) { P.coins += 1000; msg(`🎁 ${e.name}(もってる) → 🪙+1000`, 2.4); } else { S.eqOwned.push(d.id); if (!S.equip[e.slot]) { S.equip[e.slot] = d.id; applyEq(); } msg(`🎁 ${e.icon} ${e.name} を てにいれた!`, 3.4); ev({ t: 'dropget', kind: 'equip', id: d.id }); } snd('win'); }
  };
  const downCrook = (c) => { if (c.wid) dropLoot(c); { const sp = ammoSpec(weaponOf(P.weapon)); const A = sp && am(P.weapon); if (A) A.reserve = Math.min(sp.cap, A.reserve + Math.ceil(sp.mag * 0.5)); } c.state = 'down'; c.downT = 0; c.hp = Math.max(1, Math.round(c.hpMax * 0.2)); snd('down'); fx('spark', c.x, 3, c.z, 5); };
  const hitAir = (u, dmg) => {
    u.hp -= dmg; u.flash = 0.12; gunHit('🚨 けいさつの のりものを うった!', 4); fx('spark', u.x, u.y, u.z, 3);
    if (u.hp <= 0) { fx('big', u.x, u.y, u.z, 16); snd('bigboom'); const jet = u.air === 'jet'; const reward = jet ? 350 : 250; P.coins += reward; S.stats.coins += reward; S.airRespawn = S.t + 14; S.helis = S.helis.filter((x) => x !== u); S.jets = S.jets.filter((x) => x !== u); msg(`${jet ? '✈️ せんとうき' : '🚁 ヘリ'}を おとした! 🪙+${reward}`, 2.6); ev({ t: 'airkill', jet }); }
  };
  const hitCrook = (c, dmg) => { if (c.state !== 'down' && !c.air && c.type !== 'thug' && c.type !== 'runner' && rnd() < (c.type === 'legend' || c.type === 'elite' ? 0.5 : 0.25)) { c.reactT = 0.3; c.dashDir = rnd() < 0.5 ? 1 : -1; } if (!c.air && c.state !== 'down' && S.t - (S.hmT || -9) > 0.06) { S.hmT = S.t; S.hitT = S.t; snd('hitmark'); } if (c.air) { hitAir(c, dmg); return; } if (c.state === 'down') return; if (c.hunter) gunHit('🚨 けいさつを うった!', 3); c.hp -= dmg; c.alert = true; if (c.hp <= c.hpMax * 0.22) downCrook(c); };
  const arrest = (c) => {
    S.crooks = S.crooks.filter((x) => x !== c); P.kos++; qNote('arrest'); if (c.wid) qNote('wanted'); S.stats.arrests++; snd('win'); fx('spark', c.x, 3, c.z, 6);
    const coins = bountyOf(c) * (S.job === 'swat' && c.wid ? 1.5 : 1); P.coins += Math.round(coins); S.stats.coins += Math.round(coins); S.stats.bounty += Math.round(coins);
    if (c.task && c.type === 'runner') { const tk = S.tasks.find((t) => t.cid === c.id); if (tk) { dropTask(tk); payJob('snatch', 1); } } else if (c.wid && rnd() < (S.job === 'swat' ? 0.9 : 0.5)) { const w0 = WANTED.find((x) => x.id === c.wid); const f0 = rollFurn(rnd, w0 && w0.rarity ? 3 : w0 && w0.stars >= 3 ? 2 : 1); addFurn(S.home, f0); msg(`🎁 かぐ ${furnOf(f0).icon} ${furnOf(f0).name} を てにいれた!`, 3); }
    if (c.wid) { const w = WANTED.find((x) => x.id === c.wid); const first = (S.arrests[c.wid] || 0) === 0; S.arrests[c.wid] = (S.arrests[c.wid] || 0) + 1; respawnAt[c.wid] = S.t + (w.rarity === 'super2' ? 1500 : w.rarity === 'super' ? 900 : w.rarity ? 600 : 120); const tk = {}; if (first) { if (w.stars >= 5) tk.gold = 2; else if (w.stars >= 4) tk.gold = 1; else if (w.stars >= 3) tk.silver = 1; else if (w.stars >= 2) tk.bronze = 1; }
      ev({ t: 'bounty', id: c.wid, name: w.name, stars: w.stars, coins, tickets: tk, first }); banner(`🚔 ${w.name} を たいほ!`, 3.2); msg(`けんしょう金 🪙+${coins}${Object.keys(tk).length ? ' + チケット' : ''}`, 4); }
    else { ev({ t: 'arrest', coins }); msg(coins ? `たいほ! 🪙+${coins}` : 'たいほ!', 2.2); }
    refreshWanted();
  };
  const hurtPlayer = (d) => {
    if (P.invuln > 0 || P.dead > 0) return; const dd = d * (gentle ? 0.6 : 1); snd('hit'); P.hurt = 0.35;
    const v = cur();
    if (v) { v.hp -= dd; if (v.hp <= 0) { v.hp = 0; fx('big', v.x, v.y + 3, v.z, 14); snd('bigboom'); msg('のりものが こわれた! じたくで なおすよ', 3); const wasAir = isAir(v.kind); leave(); P.invuln = 2; if (v.temp) { S.vehicles = S.vehicles.filter((x) => x !== v); } else { v.x = v.home.x; v.z = v.home.z; v.y = 0; v.yaw = v.home.yaw; v.speed = 0; v.hp = v.hpMax; v.hits = 0; } if (wasAir) P.chute = false; } }
    else { P.hp -= dd * (1 - S.eq.def); if (P.hp <= 0) { P.hp = 0; knockout(); } }
  };
  const knockout = () => {
    P.dead = 2.8; const wasHot = S.lv > 0; const lose = Math.min(P.coins, Math.max(0, Math.round(P.coins * (wasHot ? 0.5 : 0.1)))); if (wasHot && P === HOST) clearHeat(); P.coins -= lose; fx('boom', P.x, 3, P.z, 10); snd('lose');
    banner('😵 ノックアウト! じたくで ふっかつ', 3); msg(wasHot ? `つかまって ばっきん! コインが はんぶん(${lose}こ)になったよ` : lose ? `コインを ${lose}こ おとしたよ` : 'だいじょうぶ! もういちど!', 3);
    if (P.veh) { const v = cur(); if (v) { v.occ = false; } P.veh = null; P.mode = 'foot'; }
  };
  const respawn = () => { P.plat = null; if (S.lv > 0 && P === HOST) clearHeat('🕊️ ふっかつ! 指名手配は かいじょ された'); if (S.mission && S.mission.id === 'delivery' && S.mission.stage === 1) { cancelMission(); msg('📦 にもつを おとしちゃった…', 2.4); } P.dead = 0; P.hp = P.hpMax; P.x = SPAWN.x + players.indexOf(P) * 3; P.z = SPAWN.z; P.y = 0; P.yaw = 0; P.speed = 0; P.mode = 'foot'; P.invuln = 3; P.chute = false; P.carry = 0; for (const c of S.civs) if (c.state === 'carried') { c.state = 'need'; c.x = c.home.x; c.z = c.home.z; } };

  // ---- ねらい ----
  const nearestCrook = (maxD, cone, yaw, air = true, minD = 3) => {
    let best = null; let bd = maxD; for (const r of air ? [...S.crooks, ...S.helis, ...S.jets] : S.crooks) { if (r.state === 'down') continue; if ((r.hideout || null) !== spaceOf(P)) continue; const d = hyp(r.x - P.x, r.z - P.z); if (d > bd || d < (r.air ? Math.max(minD, 14) : minD)) continue; const a = Math.abs(angDiff(Math.atan2(r.x - P.x, r.z - P.z), yaw)); if (a > cone) continue; bd = d; best = r; } return best;
  };
  const roofEdge = (pl) => { const q = pl.plat; return Math.min(pl.x - q.x0, q.x1 - pl.x, pl.z - q.z0, q.z1 - pl.z) < 3.2; }; // おくじょうの ふち(したを うてる ばしょ)
  const roofY = (pl) => (pl && pl.plat && pl.plat.kind === 'roof' ? pl.plat.y : 0);
  const aimDir = () => {
    const v = cur(); const kind = v ? v.kind : 'foot';
    if (isAir(kind)) return { yaw: v.yaw, pitch: v.pitch, from: { x: v.x, y: v.y - 1, z: v.z } };
    const ay = kind === 'foot' ? P.camYaw : P.yaw + P.aimRel;
    return { yaw: ay, pitch: P.aimPitch, from: { x: P.x, y: (kind === 'foot' ? 1.6 : kind === 'ship' ? 8 : kind === 'tank' ? 4 : 1.8) + P.y + (kind === 'foot' ? roofY(P) : 0), z: P.z } };
  };
  // たまは たてものを とおりぬけない(さいしょに あたる たてものまでの きょり)
  const coverHit = (x, z, y, sp) => { if (!sp) return false; const rm = S.hideouts.find((q) => q.id === sp); if (!rm) return false; for (const cb of rm.cover) if (x > cb.x0 && x < cb.x1 && z > cb.z0 && z < cb.z1 && y < cb.h) return true; return false; };
  const wallDist = (from, dv, maxD, sp = spaceOf(P)) => { const ob = P.plat && P.plat.kind === 'roof' && from.y > P.plat.y && roofEdge(P) ? LAYOUT.buildings[P.plat.bi] : null; for (let d = 1; d < maxD; d += 0.8) { const x = from.x + dv.x * d; const y = from.y + dv.y * d; const z = from.z + dv.z * d; if (y < 0) return d; if (sp) { if (coverHit(x, z, y, sp)) return d; } else if (insideBuilding(x, z, y) && !(ob && x >= ob.x0 && x <= ob.x1 && z >= ob.z0 && z <= ob.z1)) return d; } return maxD + 1; };
  const rayCrook = (from, yaw, pitch, range) => {
    const dv = dirOf(yaw, pitch); let best = null; let ba = 9; const wall = wallDist(from, dv, range);
    for (const r of [...S.crooks, ...S.helis, ...S.jets]) {
      if (r.state === 'down') continue; if ((r.hideout || null) !== spaceOf(P)) continue; const vx = r.x - from.x; const vy = (r.y != null ? r.y : 1.6) - from.y; const vz = r.z - from.z; const dist = hyp(vx, vy, vz); if (dist > range || (!r.air && dist > wall)) continue;
      const a = Math.acos(clamp((vx * dv.x + vy * dv.y + vz * dv.z) / (dist || 1), -1, 1)); const tol = ((r.rad || (r.type === 'boss' ? 3 : 2)) / dist + 0.05) * (gentle ? 1.5 : 1); if (a < tol && a < ba) { ba = a; best = r; }
    }
    return { best, dv, wall };
  };
  const shotSnd = (W) => (W.cat === 'ハンドガン' ? (W.snd === 'boom' ? 'shot_rifle' : 'shot_pistol') : W.cat === 'SMG' ? 'shot_smg' : W.cat === 'ショットガン' ? 'shot_sg' : W.cat === 'スナイパー' ? 'shot_sniper' : (W.cat === 'ライフル' || W.cat === 'マシンガン') ? 'shot_rifle' : (W.snd || 'gun'));
  const fireFoot = () => {
    const W0 = weaponOf(P.weapon) || weaponOf('fist'); const W = P.plat && P.plat.kind === 'roof' && !W0.melee && !W0.expl ? { ...W0, range: W0.range * 1.4 } : W0; if (P.wCd > 0) return; const sho = (1 + ks.SHO / 500) * (P.buff.dmg > 0 ? 1.4 : 1); const yaw0 = P.camYaw;
    if (!W.melee && input.autoAim && P.noAim > 0.35) { const lvA = clamp((S.eq && S.eq.aimLv) | 0, 0, 5); const t = nearestCrook(W.range + AUTOAIM_EXTRA, [0.1, 0.18, 0.26, 0.4, 0.55, 0.75][lvA], yaw0); if (t) { const mx = [0.012, 0.03, 0.05, 0.09, 0.14, 0.2][lvA]; P.camYaw += clamp(angDiff(Math.atan2(t.x - P.x, t.z - P.z), yaw0) * [0.05, 0.1, 0.16, 0.26, 0.36, 0.45][lvA], -mx, mx); const tp = clamp(Math.atan2((t.y != null ? t.y : 2.5) - 1.6 - roofY(P), hyp(t.x - P.x, t.z - P.z)), roofY(P) ? -1.25 : -0.2, t.y != null ? 1.1 : 0.4); P.aimPitch += (tp - P.aimPitch) * [0.05, 0.12, 0.25, 0.4, 0.6, 0.8][lvA]; } }
    const asp = ammoSpec(W); if (asp) { const A = am(W.id); if (P.reload > 0) return; if (A.mag <= 0) { if (A.reserve > 0) startReload(); else if (S.t - (P.dryT || -9) > 1.2) { P.dryT = S.t; snd('dry'); msg('たまが ない! 「おみせ」で たまを かおう(🔫)', 2.2); } return; } A.mag--; }
    P.wCd = 1 / W.rate; const d = aimDir(); if (P.plat && P.plat.kind === 'roof' && !W.melee && P.aimPitch < -0.12 && !roofEdge(P) && S.t - (P.edgeT || -9) > 4) { P.edgeT = S.t; msg('おくじょうの ふち(はし)に よらないと したを うてないよ!', 3); }
    if (W.melee) { S.swing = 0.25; snd('hit'); const t = nearestCrook(W.range + 1.2, 1.2, d.yaw, false, 0); if (t) { hitCrook(t, W.dmg * sho); fx('spark', t.x, 2, t.z, 4); } else { const ww = nearestWalker(W.range + 1.2, 1.2, d.yaw); if (ww) hurtWalker(ww, W.dmg * sho, 'melee'); } return; }
    if (W.expl) {
      const t = W.homing ? nearestCrook(W.range, 0.8, d.yaw) : null; const dv = dirOf(d.yaw, d.pitch + (W.lob || 0)); const sp = W.speed || 80;
      S.missiles.push({ x: d.from.x + dv.x * 1.5, y: d.from.y, z: d.from.z + dv.z * 1.5, vx: dv.x * sp, vy: dv.y * sp, vz: dv.z * sp, target: t ? t.id : null, t: 0, life: Math.max(1.2, W.range / sp + 1), dmg: W.dmg * sho, g: W.g || 0 }); snd(W.snd); return;
    }
    const n = W.pellets || 1; let hit = null; let last = null; let lastWall = 999;
    const mvPen = P.moving ? (W.cat === 'スナイパー' ? 4 : 1.5) : 1; const jj = (W.spread || 0) * (1 + P.bloom) * mvPen * (input.aimLock ? 0.7 : 1) * (1 - S.eq.acc);
    for (let i = 0; i < n; i++) { const r = rayCrook(d.from, d.yaw + (rnd() - 0.5) * 2 * jj, d.pitch + (rnd() - 0.5) * 2 * jj, W.range); last = r.dv; lastWall = r.wall; if (r.best) { const dd = hyp(r.best.x - d.from.x, r.best.z - d.from.z); const fall = asp ? asp.fall : 0; hitCrook(r.best, W.dmg * sho * (1 - fall * Math.min(1, dd / W.range))); hit = r.best; } else { const ww = rayWalker(d.from, r.dv, W.range, r.wall); if (ww) { hurtWalker(ww, W.dmg * sho * (1 - (asp ? asp.fall : 0) * 0.5), 'gun'); hit = ww; } } }
    if (asp) { P.bloom = Math.min(3, P.bloom + asp.recoil * (W.rate > 5 ? 10 : 6)); P.aimPitch = clamp(P.aimPitch + asp.recoil * (0.7 + rnd() * 0.6), roofY(P) ? -1.25 : -0.35, 1.1); if (P.camFree) P.camYaw += (rnd() - 0.5) * asp.recoil * 0.8; }
    const wl = Math.min(90, lastWall - 1); S.tracers.push({ from: d.from, to: hit ? { x: hit.x, y: hit.y != null ? hit.y : 1.6, z: hit.z } : { x: d.from.x + last.x * wl, y: d.from.y + last.y * wl, z: d.from.z + last.z * wl }, t: 0 }); if (!hit && lastWall < 90) fx('spark', d.from.x + last.x * lastWall, Math.max(0.5, d.from.y + last.y * lastWall), d.from.z + last.z * lastWall, 3); snd(shotSnd(W)); S.shot = { t: S.t, n: (S.shot ? S.shot.n : 0) + 1, x: d.from.x, y: d.from.y, z: d.from.z, pw: asp ? asp.recoil : 0.03, cat: W.cat };
  };
  const fireGun = (dt) => {
    if (!cur()) return fireFoot();
    if (cur().id === 'firetruck') { const v0 = cur(); P.spray = 0.25; const ay0 = v0.yaw + P.aimRel; for (const f of S.fires) { const d = hyp(f.x - v0.x, f.z - v0.z); if (d < 44 && Math.abs(angDiff(Math.atan2(f.x - v0.x, f.z - v0.z), ay0)) < 0.85) { f.hp -= 30 * dt * (d < 30 ? 1 : 0.55); f.hit = 0.3; } } return; }
    const v = cur(); const kind = v ? v.kind : 'foot'; const dps = v ? v.V.gunDps : FS.gunDps; if (!dps) { if (S.t - (P.nogunT || -9) > 3) { P.nogunT = S.t; msg('この のりものには ぶきが ないよ'); } return; }
    const air = isAir(kind); const range = air ? 650 : kind === 'ship' ? 800 : kind === 'tank' ? 600 : kind === 'car' || kind === 'bike' ? 140 : FS.range;
    if (input.autoAim && (kind === 'foot' || kind === 'car' || kind === 'bike') && P.noAim > 0.8) { const yaw0 = v ? v.yaw : P.yaw; const t = nearestCrook(range, 0.9, yaw0); if (t) { P.aimRel = clamp(angDiff(Math.atan2(t.x - P.x, t.z - P.z), yaw0), -1.5, 1.5); P.aimPitch = clamp(Math.atan2(2.5 - (kind === 'foot' ? 1.6 : 2), Math.hypot(t.x - P.x, t.z - P.z)), -0.2, 0.4); } }
    const d = aimDir(); const dv = dirOf(d.yaw, d.pitch); let best = null; let ba = 9;
    for (const r of [...S.crooks, ...S.helis, ...S.jets]) {
      if (r.state === 'down') continue; const ty = r.y != null ? r.y : air ? Math.max(1.5, d.from.y - 0.25 * hyp(r.x - d.from.x, r.z - d.from.z)) : 1.6; const vx = r.x - d.from.x; const vy = ty - d.from.y; const vz = r.z - d.from.z; const dist = hyp(vx, vy, vz); if (dist > range) continue;
      const a = Math.acos(clamp((vx * dv.x + vy * dv.y + vz * dv.z) / (dist || 1), -1, 1)); const tol = (r.rad ? r.rad / dist + 0.06 : air ? 0.13 : (r.type === 'boss' ? 3 : 2) / dist + 0.05) * (gentle ? 1.5 : 1); if (a < tol && a < ba) { const dd = { x: vx / (dist || 1), y: vy / (dist || 1), z: vz / (dist || 1) }; if (r.air || wallDist(d.from, dd, dist) > dist) { ba = a; best = r; } }
    }
    if (best) hitCrook(best, dps * dt * (kind === 'foot' ? 1 : 1.2));
    if (S.t % (kind === 'foot' ? 0.1 : 0.08) < dt) S.tracers.push({ from: d.from, to: best ? { x: best.x, y: 1.6, z: best.z } : { x: d.from.x + dv.x * 120, y: d.from.y + dv.y * 120, z: d.from.z + dv.z * 120 }, t: 0 });
    if (S.t % 0.2 < dt) snd(kind === 'tank' || kind === 'ship' ? 'boom' : 'gun');
  };
  const fireMissile = () => {
    const v = cur(); if (!v || !v.V.missiles || P.missileCd > 0 || P.dead > 0) return false; if ((v.mis == null ? v.V.missiles : v.mis) <= 0) { msg('ミサイルは ふえるのを まってね'); return false; }
    const air = isAir(v.kind); const range = air ? 800 : 500; const t = nearestCrook(range, air ? 0.7 : 3.2, air ? v.yaw : v.yaw + P.aimRel);
    if (!t) { msg('ロックできる てきが いないよ'); return false; }
    v.mis = (v.mis == null ? v.V.missiles : v.mis) - 1; P.missileCd = 0.5; const d = dirOf(air ? v.yaw : v.yaw + P.aimRel, 0.5);
    S.missiles.push({ x: v.x + d.x * 8, y: v.y + 6, z: v.z + d.z * 8, vx: d.x * 120, vy: 0.5 * 120, vz: d.z * 120, target: t.id, t: 0, life: 7, dmg: v.V.missileDmg }); snd('missile'); return true;
  };

  // ---- 1フレーム ----
  function movePlayer(dt) {
    const v = cur(); const boost = input.boost;
    if (P.dead > 0) return;
    if (P.chute) { // パラシュート: たかい ときは はやく、ひくく なるほど ゆっくり おりる。スティックは カメラの むきで いどう
      const fall = clamp(P.y * 0.12, 6, 20); P.y = Math.max(0, P.y - fall * dt); const mx = input.moveX || 0; const my = input.moveY || 0; const mag = Math.min(1, Math.hypot(mx, my));
      if (mag > 0.08) { const cy = P.camYaw; let dx = Math.sin(cy) * my - Math.cos(cy) * mx; let dz = Math.cos(cy) * my + Math.sin(cy) * mx; const L = hyp(dx, dz) || 1; dx /= L; dz /= L; P.x += dx * 9 * mag * dt; P.z += dz * 9 * mag * dt; P.yaw += clamp(angDiff(Math.atan2(dx, dz), P.yaw), -3 * dt, 3 * dt); }
      else { P.yaw += input.turn * 0.6 * dt; P.x += Math.sin(P.yaw) * input.climb * 8 * dt; P.z += Math.cos(P.yaw) * input.climb * 8 * dt; }
      if (isWater(P.x, P.z)) { P.x = HQ.x; P.z = HQ.z - 40; } pushOut(P, 1.2); if (P.y <= 0.01) { P.chute = false; P.speed = 0; } return; }
    if (!v) {
      const mx = input.moveX || 0; const my = input.moveY || 0; const mag = Math.min(1, Math.hypot(mx, my)); if (P.tired && P.boost >= 30) P.tired = false; P.swim = isWater(P.x, P.z); const dash = (boost || mag >= 0.85) && !P.tired && (P.boost > 0 || P.swim); const sp = (dash ? FS.run : FS.speed) * (P.buff.speed > 0 ? 1.3 : 1) * (1 + S.eq.spd) * (P.swim ? 0.8 : 1); // スティックを ふかく たおすと ダッシュ
      if (mag > 0.08) { // スマホ ふうの そうさ: スティックの むきに カメラを きじゅんに あるく
        P.camFree = true; // カメラ(レティクル)は からだの むきに ひきずられない
        const cy = P.camYaw; let dx = Math.sin(cy) * my - Math.cos(cy) * mx; let dz = Math.cos(cy) * my + Math.sin(cy) * mx; const L = hyp(dx, dz) || 1; dx /= L; dz /= L;
        P.speed = lerp(P.speed, (dash ? 1 : Math.min(1, mag / 0.8)) * sp, 1 - Math.exp(-10 * dt)); const lockd = input.gun || input.aimLock; const want = lockd ? P.camYaw : Math.atan2(dx, dz); P.yaw += clamp(angDiff(want, P.yaw), -14 * dt, 14 * dt); P.moveRel = angDiff(Math.atan2(dx, dz), P.yaw); P.moving = true;
        groundMove(P, P.x + dx * P.speed * dt, P.z + dz * P.speed * dt, 1.1, false);
      } else if (input.turn || input.climb) { const target = input.climb >= 0 ? input.climb * sp : input.climb * sp * 0.5; P.speed = lerp(P.speed, target, 1 - Math.exp(-9 * dt)); P.yaw += input.turn * FS.turn * dt; P.camFree = false; groundMove(P, P.x + Math.sin(P.yaw) * P.speed * dt, P.z + Math.cos(P.yaw) * P.speed * dt, 1.1, false); }
      else { P.moving = false; P.speed = lerp(P.speed, 0, 1 - Math.exp(-12 * dt)); if (input.gun || input.aimLock) P.yaw += clamp(angDiff(P.camYaw, P.yaw), -14 * dt, 14 * dt); }
      P.y = 0;
      // ダッシュメーター: ダッシュ中は へる(STAが たかいほど もつ)。0で「つかれた」→ 30まで かいふくするまで ダッシュ できない
      if (dash && mag > 0.1) { P.boost = Math.max(0, P.boost - Math.max(9, 22 - ks.STA * 0.08) * dt); P.dashRest = 0.7; if (P.boost <= 0) { P.tired = true; msg('😮‍💨 つかれた! すこし やすんでね', 1.8); } } else { P.dashRest = Math.max(0, (P.dashRest || 0) - dt); if (P.dashRest <= 0) P.boost = Math.min(100, P.boost + (mag > 0.1 ? (P.tired ? 8 : 12) : 22) * dt); }
      return;
    }
    const V = v.V; const k = v.kind;
    if (isAir(k)) {
      const bo = boost && P.boost > 1; P.boost = clamp(P.boost + (bo ? -22 : 10) * dt, 0, 100);
      const sp = V.speed * (bo ? 1.55 : 1) * (input.climb < -0.4 ? 1.12 : input.climb > 0.4 ? 0.92 : 1); v.speed = lerp(v.speed, sp, 1 - Math.exp(-2.4 * dt));
      v.yaw += input.turn * V.turn * dt; v.pitch = clamp(v.pitch + input.climb * 0.95 * dt, -0.95, 0.95); if (Math.abs(input.climb) < 0.12) v.pitch *= Math.exp(-0.9 * dt); v.roll = lerp(v.roll, -input.turn * 0.95, 1 - Math.exp(-5 * dt));
      const f = dirOf(v.yaw, v.pitch); v.x += f.x * v.speed * dt; v.y += f.y * v.speed * dt; v.z += f.z * v.speed * dt;
      if (v.y < 6) { v.y = 6; v.pitch = Math.max(v.pitch, 0.25); if (S.t - (v.crashT || -9) > 1.2) { v.crashT = S.t; hurtPlayer(14); msg('⚠ ちめんに ちかいよ! のぼって!', 1.6); } }
      if (insideBuilding(v.x, v.z, v.y)) { const b = nearB(v.x, v.z).find((bb) => v.y <= bb.h && v.x >= bb.x0 && v.x <= bb.x1 && v.z >= bb.z0 && v.z <= bb.z1); if (b) { v.y = b.h + 8; v.pitch = 0.3; if (S.t - (v.crashT || -9) > 1.2) { v.crashT = S.t; hurtPlayer(20); msg('💥 たてものに ぶつかった!', 1.6); fx('boom', v.x, v.y, v.z, 10); } } }
      v.y = Math.min(v.y, 800); if (hyp(v.x, v.z) > 1800) v.yaw += clamp(angDiff(Math.atan2(-v.x, -v.z), v.yaw), -1.6 * dt, 1.6 * dt) * 3;
      P.x = v.x; P.y = v.y; P.z = v.z; P.yaw = v.yaw; P.pitch = v.pitch; return;
    }
    const bo = boost && P.boost > 1; P.boost = clamp(P.boost + (bo ? -26 : 12) * dt, 0, 100);
    if (k === 'car' || k === 'bike') { v.fuel = Math.max(0, (v.fuel == null ? 100 : v.fuel) - Math.abs(v.speed) / Math.max(8, V.speed) * dt * 1.4); if (v.fuel <= 0 && S.t - (v.fuelT || -99) > 12) { v.fuelT = S.t; msg('⛽ ガソリンが ない! ガソリンスタンド(おみせの ちかく)で いれよう', 3.4); snd('warn'); } else if (v.fuel < 20 && S.t - (v.fuelT || -99) > 20) { v.fuelT = S.t; msg('⛽ ガソリンが すくなく なってきた', 2.4); } }
    const max = V.speed * (bo ? 1.5 : 1) * ((k === 'car' || k === 'bike') && v.fuel <= 0 ? 0.25 : 1); const want = input.climb >= 0 ? input.climb * max : input.climb * max * 0.4;
    v.speed = lerp(v.speed, want, 1 - Math.exp(-(k === 'car' ? 2.4 : k === 'bike' ? 3.0 : k === 'tank' ? 3.2 : 1.1) * dt));
    v.yaw += input.turn * V.turn * dt * (0.35 + Math.min(1, Math.abs(v.speed) / (V.speed * 0.45)) * 0.65) * (v.speed < -0.5 ? -1 : 1);
    const nx = v.x + Math.sin(v.yaw) * v.speed * dt; const nz = v.z + Math.cos(v.yaw) * v.speed * dt; const rad = k === 'car' ? 3.2 : k === 'bike' ? 1.6 : k === 'tank' ? 6.5 : 14;
    const ox = v.x; const oz = v.z; const moved = groundMove(v, nx, nz, rad, k === 'ship');
    if (k === 'ship') { for (const b of nearB(v.x, v.z)) { const cx = clamp(v.x, b.x0, b.x1); const cz = clamp(v.z, b.z0, b.z1); if (hyp(v.x - cx, v.z - cz) < rad) { v.x = ox; v.z = oz; v.speed *= 0.2; } } v.x = clamp(v.x, -1700, 1700); v.z = clamp(v.z, -1700, 1700); }
    if (!moved || hyp(v.x - nx, v.z - nz) > 0.6) { if (Math.abs(v.speed) > 8 && S.t - (v.bumpT || -9) > 0.7) { v.bumpT = S.t; snd('bump'); if (k === 'car' || k === 'bike') hurtPlayer(Math.min(12, Math.abs(v.speed) * (k === 'bike' ? 0.35 : 0.22))); } v.speed *= 0.5; }
    // はんにんに ぶつかっても たおれる だけ(けがは しない)
    if (Math.abs(v.speed) > 9) for (const r of S.crooks.slice()) if (r.state !== 'down' && hyp(r.x - v.x, r.z - v.z) < rad + 1.5) { hitCrook(r, k === 'tank' ? 90 : 45); fx('spark', r.x, 2, r.z, 5); r.x += Math.sin(v.yaw) * 4; r.z += Math.cos(v.yaw) * 4; }
    v.roll = lerp(v.roll, -input.turn * (k === 'bike' ? 0.5 : 0.1) * Math.min(1, Math.abs(v.speed) / 15), 1 - Math.exp(-4 * dt)); P.x = v.x; P.z = v.z; P.y = 0; P.yaw = v.yaw; P.speed = v.speed;
  }
  const nearestAlive = (x, z, sp = null) => { let best = null; let bd = 1e18; for (const pl of players) { if (spaceOf(pl) !== sp) continue; if (pl.dead > 0 && pl !== HOST) continue; const d = hyp(pl.x - x, pl.z - z) + (pl.dead > 0 ? 1e6 : 0); if (d < bd) { bd = d; best = pl; } } return best || GHOST; };
  function stepCrooks(dt) {
    for (const r of S.crooks) {
      P = nearestAlive(r.x, r.z, r.hideout || null); r.t += dt; const T = CROOKS[r.type];
      if (r.state === 'down') { r.downT += dt; if (r.hunter) { if (r.downT > 5) r.gone = true; continue; } if (r.downT > 26) { r.state = 'flee'; r.flee = 18; r.hp = Math.round(r.hpMax * 0.55); } continue; }
      if (r.state === 'flee') { r.flee -= dt; const away = Math.atan2(r.x - P.x, r.z - P.z); r.yaw += clamp(angDiff(away, r.yaw), -3 * dt, 3 * dt); groundMove(r, r.x + Math.sin(r.yaw) * T.speed * 1.4 * dt, r.z + Math.cos(r.yaw) * T.speed * 1.4 * dt, 1.4, false); if (r.flee <= 0) { r.state = 'idle'; r.alert = true; } continue; }
      const dp = hyp(r.x - P.x, r.z - P.z); if (r.hunter && dp > 260) { const rp = roadPoint(R2, 1); const d2 = hyp(rp.x - P.x, rp.z - P.z); if (d2 > 60 && d2 < 140 && !insideBuilding(rp.x, rp.z)) { r.x = rp.x; r.z = rp.z; } }
      const hunt = P.dead <= 0 && (dp < 80 || r.alert);
      if (r.type === 'runner') { // ひったくりは にげる
        if (dp < 110) { const away = Math.atan2(r.x - P.x, r.z - P.z); r.yaw += clamp(angDiff(away, r.yaw), -3.2 * dt, 3.2 * dt); groundMove(r, r.x + Math.sin(r.yaw) * T.speed * dt, r.z + Math.cos(r.yaw) * T.speed * dt, 1.4, false); } else { r.yaw += (rnd() - 0.5) * dt; groundMove(r, r.x + Math.sin(r.yaw) * 2 * dt, r.z + Math.cos(r.yaw) * 2 * dt, 1.4, false); }
        continue;
      }
      if (hunt) {
        // つよさに おうじた うごき(ストレイフ・かこむ・ダッシュで よける・かげに かくれる・ひるむと さがる)
        const want = Math.atan2(P.x - r.x, P.z - r.z); r.yaw += clamp(angDiff(want, r.yaw), -4 * dt, 4 * dt); r.cd -= dt;
        const tc = TAC[r.type] || TAC.gunman; r.mv = r.mv || { t: 0, dir: rnd() < 0.5 ? 1 : -1 };
        const lowHp = r.hp < r.hpMax * 0.3 && r.type !== 'thug'; const pref = tc.pref * (lowHp ? 1.8 : 1);
        let rad = dp > pref + 6 ? 1 : dp < pref - 8 ? -0.8 : 0; let tan = 0; r.mv.t -= dt; if (r.mv.t <= 0) { r.mv.t = 0.7 + rnd() * 1.6; if (rnd() < 0.6) r.mv.dir *= -1; }
        if (tc.strafe) tan = r.mv.dir * tc.strafe; if (tc.orbit) { tan = r.mv.dir; rad *= 0.5; } if (tc.rush && dp > 9) rad = 1;
        if (tc.dash) { r.dashCd = (r.dashCd == null ? 2 : r.dashCd) - dt; if (r.dashCd <= 0 && dp < 70) { r.dashCd = 2.2 + rnd() * 2; r.dashT = 0.28; r.dashDir = rnd() < 0.5 ? 1 : -1; } if (r.dashT > 0) { r.dashT -= dt; tan = (r.dashDir || 1) * 2.8; } }
        if (r.reactT > 0) { r.reactT -= dt; tan = (r.dashDir || 1) * 2.2; }
        let mx = 0; let mz = 0; let sp = r.speed * (r.dashT > 0 || r.reactT > 0 ? 1.7 : 1);
        if (tc.cover && !lowHp) { r.coverT = (r.coverT || 0) - dt; if (!r.cover || r.coverT <= 0) { r.coverT = 4 + rnd() * 3; r.cover = null; let best = null; let bd = 55; for (const b of nearB(r.x, r.z)) { if (b.w * b.d < 40) continue; const d0 = hyp(b.cx - r.x, b.cz - r.z); if (d0 < bd) { bd = d0; best = b; } } if (best) { const ux = best.cx - P.x; const uz = best.cz - P.z; const ul = hyp(ux, uz) || 1; const off = Math.max(best.w, best.d) / 2 + 2.5; r.cover = { x: best.cx + (ux / ul) * off, z: best.cz + (uz / ul) * off }; } }
          if (r.cover) { const dc = hyp(r.cover.x - r.x, r.cover.z - r.z); if (dc > 2) { mx = (r.cover.x - r.x) / dc; mz = (r.cover.z - r.z) / dc; } else { mx = Math.cos(want) * 0.25 * r.mv.dir; mz = -Math.sin(want) * 0.25 * r.mv.dir; sp = r.speed * 0.5; } } }
        if (!mx && !mz) { const rx = Math.sin(want); const rz = Math.cos(want); mx = rad * rx + tan * Math.cos(want); mz = rad * rz - tan * Math.sin(want); const ml = hyp(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; } }
        if (mx || mz) groundMove(r, r.x + mx * sp * dt, r.z + mz * sp * dt, 1.4, false);
        if (r.cd <= 0 && dp < T.range) { r.cd = T.fire * 0.8 + rnd() * 0.4; const sx = (rnd() - 0.5) * 0.075; const vx = Math.sin(r.yaw + sx); const vz = Math.cos(r.yaw + sx); const vcur = cur(); const ty = vcur && isAir(vcur.kind) ? P.y : 1.4 + roofY(P); const dy = (ty - 1.6) / Math.max(10, dp); S.bullets.push({ x: r.x, y: 1.6, z: r.z, vx: vx * 62, vy: dy * 62, vz: vz * 62, t: 0, dmg: T.dmg * DIFF_DMG, sp: r.hideout || null }); snd('cshot'); }
      } else { const home = hyp(r.homeX - r.x, r.homeZ - r.z); if (r.t % 4 < dt || home > r.wander) r.goal = { x: r.homeX + (rnd() - 0.5) * r.wander, z: r.homeZ + (rnd() - 0.5) * r.wander }; if (r.goal) { const want = Math.atan2(r.goal.x - r.x, r.goal.z - r.z); r.yaw += clamp(angDiff(want, r.yaw), -2 * dt, 2 * dt); if (hyp(r.goal.x - r.x, r.goal.z - r.z) > 3) groundMove(r, r.x + Math.sin(r.yaw) * r.speed * 0.4 * dt, r.z + Math.cos(r.yaw) * r.speed * 0.4 * dt, 1.4, false); } }
    }
    P = HOST;
    for (const b of S.bullets) {
      b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      if (b.sp) { const hh = S.hideouts.find((q) => q.id === b.sp); if (!hh || b.x < hh.x0 || b.x > hh.x1 || b.z < hh.z0 || b.z > hh.z1) { b.t = 99; continue; } if (coverHit(b.x, b.z, b.y, b.sp)) { b.t = 99; continue; } } else if (insideBuilding(b.x, b.z, b.y)) { b.t = 99; continue; }
      for (const pl of players) { P = pl; if (b.t >= 99) break; if (spaceOf(pl) !== (b.sp || null)) continue; const svb = swapIn(pl); if (P.dead <= 0) { const v = cur(); const py = v ? (isAir(v.kind) ? P.y : 1.8) : 1.2 + (P.jh || 0) + roofY(P); const rad = v ? (v.kind === 'ship' ? 14 : v.kind === 'tank' ? 7 : isAir(v.kind) ? 8 : v.kind === 'bike' ? 2.2 : 3.2) : 1.4; if (hyp(b.x - P.x, b.z - P.z) < rad && Math.abs(b.y - py) < rad + 2) { hurtPlayer(b.dmg); b.t = 99; fx('spark', b.x, b.y, b.z, 3); } } swapOut(svb, pl); } P = HOST;
    }
    S.bullets = S.bullets.filter((b) => b.t < 3.5);
  }
  function stepMissiles(dt) {
    for (const m of S.missiles) {
      if (m.enemy) { // てきの ミサイル: プレイヤーを おいかける
        m.t += dt; const vcur = cur(); const tyy = vcur && isAir(vcur.kind) ? P.y : 1.5; const dx = P.x - m.x; const dy = tyy - m.y; const dz = P.z - m.z; const d = hyp(dx, dy, dz) || 1; const c0 = hyp(m.vx, m.vy, m.vz) || 1; const k = clamp(1.8 * dt, 0, 1);
        m.vx += ((dx / d) * c0 - m.vx) * k; m.vy += ((dy / d) * c0 - m.vy) * k; m.vz += ((dz / d) * c0 - m.vz) * k; m.x += m.vx * dt; m.y += m.vy * dt; m.z += m.vz * dt;
        if (d < 5 || m.y < 0.4 || insideBuilding(m.x, m.z, m.y)) { m.t = 99; fx('boom', m.x, Math.max(1, m.y), m.z, 12); snd('boom'); const dd = hyp(P.x - m.x, P.z - m.z); if (dd < 12 && P.dead <= 0) hurtPlayer(m.dmg * (dd < 6 ? 1 : 0.5)); }
        continue;
      }
      m.t += dt; if (m.g) m.vy -= m.g * dt; const tg = S.crooks.find((r) => r.id === m.target) || S.helis.find((r) => r.id === m.target) || S.jets.find((r) => r.id === m.target);
      if (tg) { const vx = tg.x - m.x; const vy = (tg.y != null ? tg.y : 1.6) - m.y; const vz = tg.z - m.z; const d = hyp(vx, vy, vz) || 1; const k = clamp(4.2 * dt, 0, 1); const c0 = hyp(m.vx, m.vy, m.vz) || 1; m.vx += ((vx / d) * c0 - m.vx) * k; m.vy += ((vy / d) * c0 - m.vy) * k; m.vz += ((vz / d) * c0 - m.vz) * k; }
      m.x += m.vx * dt; m.y += m.vy * dt; m.z += m.vz * dt;
      const hit = [...S.crooks, ...S.helis, ...S.jets].find((r) => r.state !== 'down' && hyp(r.x - m.x, r.z - m.z) < (r.air ? 8 : 6) && Math.abs(m.y - (r.y != null ? r.y : 1.6)) < (r.air ? 8 : 9));
      if (hit || m.y < 0.5) { m.t = 99; fx('boom', m.x, Math.max(1, m.y), m.z, 12); snd('boom'); for (const r of [...S.crooks, ...S.helis, ...S.jets]) { const d = r.air ? hyp(r.x - m.x, r.y - m.y, r.z - m.z) : hyp(r.x - m.x, r.z - m.z); if (d < (r.air ? 16 : 14)) hitCrook(r, m.dmg * (d < 7 ? 1 : 0.4)); } for (const w of S.walkers) if (!(w.dead > 0) && hyp(w.x - m.x, w.z - m.z) < 12) hurtWalker(w, 999, 'blast'); }
      if (insideBuilding(m.x, m.z, m.y)) { m.t = 99; fx('boom', m.x, m.y, m.z, 10); }
    }
    S.missiles = S.missiles.filter((m) => m.t < m.life);
  }
  function stepWorld(dt) {
    stepJobs(dt); stepQuest(); stepCollect(dt); stepHideouts(dt); stepEvents(dt); stepWitness(dt); stepCompanions(dt);
    if (S.pickups.some((p) => p.life != null)) S.pickups = S.pickups.filter((p) => p.life == null || (p.life -= dt) > 0);
    for (const pl of players) { P = pl; const svp = swapIn(pl); for (const p of S.pickups.slice()) if (P.dead <= 0 && S.pickups.includes(p) && hyp(p.x - P.x, p.z - P.z) < (P.mode === 'veh' ? 7 : p.kind === 'drop' ? 4.5 : 3) && (P.y < 12 || P.mode === 'foot')) { S.pickups = S.pickups.filter((x) => x !== p); if (p.kind === 'drop') applyDrop(p.drop); else if (p.kind === 'gem') { ev({ t: 'gem', v: 1 }); snd('gem'); msg('💎 ほうせきを みつけた!', 2); P.coins += p.v; S.stats.coins += p.v; } else { P.coins += p.v; S.stats.coins += p.v; snd('coin'); } } swapOut(svp, pl); } P = HOST;
    S.relocT = (S.relocT || 0) + dt; const fire = P.mode === 'foot' && (input.gun || P.wCd > 0.1) && (weaponOf(P.weapon) || {}).range > 5;
    for (const w of S.walkers) { if (w.dead > 0) { w.dead -= dt; if (w.dead <= 0) { w.hp = 40; w.idle = false; w.scared = 0; if (!(S.relocWalker && S.relocWalker(w))) w.dead = 3; } continue; } if (w.idle) { if (fire && hyp(w.x - P.x, w.z - P.z) < 30) { w.idle = false; w.scared = 6; w.relocFlee = true; if (S.relocWalker) S.relocWalker(w); w.spd = 1.8; } continue; } if (!w.path) continue;
      if (S.relocT > 0.4 && hyp(w.x - P.x, w.z - P.z) > 300) { if (S.relocWalker(w)) { S.relocT = 0; } }
      if (fire && hyp(w.x - P.x, w.z - P.z) < 40 && !(w.scared > 0)) { w.scared = 5; const q = S.pathAt(w.path, w.s + 1); const q0 = S.pathAt(w.path, w.s); const tx = q.x - q0.x; const tz = q.z - q0.z; w.dir = (tx * (w.x - P.x) + tz * (w.z - P.z)) >= 0 ? 1 : -1; } { const pvw = cur(); if (pvw && (pvw.kind === 'car' || pvw.kind === 'bike' || pvw.kind === 'tank') && Math.abs(pvw.speed) > 3) { const rx = w.x - pvw.x; const rz = w.z - pvw.z; const dv = hyp(rx, rz); const fwd = (Math.sin(pvw.yaw) * rx + Math.cos(pvw.yaw) * rz) * (pvw.speed >= 0 ? 1 : -1); if (dv < 34 && fwd > -2 && !(w.scared > 1.5 && w.vflee)) { w.scared = Math.max(w.scared || 0, 3.5); w.vflee = true; const q = S.pathAt(w.path, w.s + 1); const q0 = S.pathAt(w.path, w.s); w.dir = ((q.x - q0.x) * rx + (q.z - q0.z) * rz) >= 0 ? 1 : -1; } } } w.s += w.dir * w.spd * dt * (w.scared > 0 ? (w.vflee ? 4 : 3) : 1); if (w.scared > 0) { w.scared -= dt; if (w.scared <= 0) w.vflee = false; } const L = w.path.cum[w.path.cum.length - 1]; if (w.s > L) { w.s = L; w.dir = -1; } if (w.s < 0) { w.s = 0; w.dir = 1; } S.placeOn(w, w.path, w.off); if (isWater(w.x, w.z)) w.dir *= -1; }
    S.trafT = (S.trafT || 0) + dt; if (S.trafT > 0.6) { S.trafT = 0; const cps = S.carPaths || []; const far = S.traffic.find((c) => !c.cop && !(c.dead > 0) && hyp(c.x - P.x, c.z - P.z) > 340); if (far && cps.length) for (let t = 0; t < 40; t++) { const cp = cps[Math.floor(rnd() * cps.length)]; const sx = rnd() * cp.cum[cp.cum.length - 1]; const q = S.pathAt(cp, sx); const dd = hyp(q.x - P.x, q.z - P.z); if (dd < 90 || dd > 280 || inRect(AIRFIELD, q.x, q.z) || inRect(HOME, q.x, q.z)) continue; far.path = cp; far.s = sx; far.dir = rnd() < 0.5 ? 1 : -1; far.off = cp.hw * 0.5 * far.dir; S.placeOn(far, cp, far.off); break; } }
    const pv = cur();
    for (const c of S.traffic) {
      if (c.dead > 0) { c.dead -= dt; c.hidden = true; if (c.dead <= 0) { const cp = carPaths[Math.floor(rnd() * carPaths.length)]; if (cp) { c.path = cp; c.s = rnd() * cp.cum[cp.cum.length - 1]; c.dir = rnd() < 0.5 ? 1 : -1; c.off = cp.hw * 0.5 * c.dir; c.hp = c.hostile ? 2 : 4; c.hidden = false; S.placeOn(c, cp, c.off); } } continue; }
      const L = c.path.cum[c.path.cum.length - 1]; const ahead = S.pathAt(c.path, c.s + c.dir * 9); const px = ahead.x - Math.sin(ahead.ang) * c.off; const pz = ahead.z + Math.cos(ahead.ang) * c.off; let blocked = false; // じぶんの レーンの すこし さき(たいこうしゃと ぶつからない)
      if (!c.hostile && hyp(px - P.x, pz - P.z) < 7) blocked = true; for (const o of S.traffic) if (o !== c && !o.dead && hyp(px - o.x, pz - o.z) < 5) blocked = true; if (isWater(px, pz) || inRect(AIRFIELD, px, pz) || inRect(HOME, px, pz)) { c.dir *= -1; c.off = c.path.hw * 0.5 * c.dir; blocked = false; }
      if (c.ghost > 0) { c.ghost -= dt; blocked = false; } if (pv && !isAir(pv.kind) && pv.kind !== 'ship' && !c.hostile && !c.cop) { const fx0 = ahead.x - c.x; const fz0 = ahead.z - c.z; const fl = hyp(fx0, fz0) || 1; const rx = pv.x - c.x; const rz = pv.z - c.z; const al = (rx * fx0 + rz * fz0) / fl; const lt = Math.abs(rx * fz0 - rz * fx0) / fl; if (al > -2 && al < 14 && lt < 4.2) { blocked = true; c.ghost = 0; } } // じぶんの のりものは よける(ゴーストでも すりぬけない) c.wait = blocked ? Math.min(2, c.wait + dt) : 0; if (c.wait >= 2) c.ghost = 2.5; // 2びょう まって うごけない ときは すりぬけて すすむ(こうさてんの こうちゃく ぼうし)
       if (c.stun > 0) { c.stun -= dt; blocked = true; } const sp = c.spd * (c.hostile && hyp(c.x - P.x, c.z - P.z) < 90 ? 1.7 : 1); if (!blocked) c.s += c.dir * sp * dt; if (c.s > L) { c.s = L; c.dir = -1; c.off = c.path.hw * 0.5 * c.dir; } if (c.s < 0) { c.s = 0; c.dir = 1; c.off = c.path.hw * 0.5 * c.dir; } S.placeOn(c, c.path, c.off);
      // のりものが ぶつかる(いっぱんの くるま・バイク・指名手配はんの くるま)
      if (pv && !isAir(pv.kind) && pv.kind !== 'ship' && P.dead <= 0 && (c.hostile || c.cop || Math.abs(pv.speed) > 1.5) && hyp(c.x - pv.x, c.z - pv.z) < c.r + (pv.kind === 'tank' ? 6 : pv.kind === 'bike' ? 1.6 : 3.2) && S.t - (c.hitT || -9) > 1.1) {
        c.hitT = S.t; const sp0 = Math.abs(pv.speed); const tank = pv.kind === 'tank'; const dmg = clamp(6 + sp0 * 0.6 + (c.hostile ? 9 : 0), 6, 70) * (tank ? 0.15 : 1);
        c.stun = 2.5; fx('spark', (c.x + pv.x) / 2, 1.5, (c.z + pv.z) / 2, 6); snd('bump'); const ox = pv.x - c.x; const oz = pv.z - c.z; const od = hyp(ox, oz) || 1; pv.x += (ox / od) * 2.2; pv.z += (oz / od) * 2.2; pv.speed *= tank ? 0.8 : -0.25;
        if (!tank) { pv.hits = (pv.hits || 0) + 1; hurtPlayer(dmg); if (pv.hits >= pv.hitMax - 1 && pv.hits < pv.hitMax && S.t - (pv.warnT || -9) > 2) { pv.warnT = S.t; msg('💥 こわれそう! もう すこしで ばくはつ!', 2.4); } if (pv.hits >= pv.hitMax && P.dead <= 0 && P.mode === 'veh') { P.invuln = 0; hurtPlayer(99999); } else msg(`💥 ぶつかった! (${pv.hits}/${pv.hitMax}かい で こわれる)`, 1.6); }
        const dh = tank ? 99 : c.cashVan ? (sp0 > 7 ? 1 : 0.2) : c.hostile || c.cop ? 1 : sp0 > 18 ? 1 : 0.3; if (!c.hostile && c.hp - dh <= 0) raise(1, '🚨 くるまを こわした!'); c.hp -= dh; if (c.hp <= 0) { c.dead = c.cop ? 99999 : 12; fx('big', c.x, 2, c.z, 10); snd('bigboom'); if (c.cop) { addStar('🚨 パトカーを こわした!'); } else if (c.hostile) { P.coins += 120; S.stats.coins += 120; msg('🚔 指名手配はんの のりものを たおした! 🪙+120', 3); ev({ t: 'crash', hostile: true }); qNote('wreck'); } }
      }
    }
    // パトカーも うつ・せんとうきが くうちゅうから うつ
    for (const c of S.traffic) if (c.cop && !(c.dead > 0) && P.dead <= 0) { c.cd = (c.cd == null ? 1 : c.cd) - dt; const dpc = hyp(c.x - P.x, c.z - P.z); if (c.cd <= 0 && dpc < 70) { const dv0 = { x: (P.x - c.x) / dpc, y: 0, z: (P.z - c.z) / dpc }; if (wallDist({ x: c.x, y: 1.3, z: c.z }, dv0, dpc) > dpc) { c.cd = 1.2 + rnd() * 0.5; const vcur = cur(); const ty = vcur && isAir(vcur.kind) ? P.y : 1.4; S.bullets.push({ x: c.x, y: 1.3, z: c.z, vx: dv0.x * 62, vy: ((ty - 1.3) / Math.max(10, dpc)) * 62, vz: dv0.z * 62, t: 0, dmg: 4 }); snd('cshot'); } else c.cd = 0.5; } }
    for (const j of S.jets) {
      const dx = P.x - j.x; const dz = P.z - j.z; const dp = hyp(dx, dz); const want = Math.atan2(dx, dz); j.yaw += clamp(angDiff(want, j.yaw), -1.0 * dt, 1.0 * dt); j.x += Math.sin(j.yaw) * j.spd * dt; j.z += Math.cos(j.yaw) * j.spd * dt; j.ph += dt; j.cd -= dt;
      const facing = Math.abs(angDiff(want, j.yaw)); const vcur = cur(); const ty = vcur && isAir(vcur.kind) ? P.y : 1.4;
      if (j.cd <= 0 && dp < 220 && facing < 0.3 && P.dead <= 0) { j.cd = 1.6 + rnd() * 0.8; const d3 = hyp(dp, j.y - ty) || 1; for (let k = 0; k < 2; k++) { const sx = (rnd() - 0.5) * 0.05; S.bullets.push({ x: j.x, y: j.y, z: j.z, vx: (dx / d3) * 95 + sx * 60, vy: ((ty - j.y) / d3) * 95, vz: (dz / d3) * 95, t: -k * 0.12, dmg: 4 }); } snd('cshot'); }
      if (S.lv >= 5) { j.mcd = (j.mcd == null ? 3 + rnd() * 4 : j.mcd) - dt; if (j.mcd <= 0 && dp < 280 && facing < 0.45 && P.dead <= 0) { j.mcd = 6 + rnd() * 3; const d3 = hyp(dp, j.y - ty) || 1; S.missiles.push({ enemy: true, x: j.x, y: j.y - 1, z: j.z, vx: (dx / d3) * 62, vy: ((ty - j.y) / d3) * 62, vz: (dz / d3) * 62, t: 0, life: 7, dmg: 26, g: 0 }); snd('missile'); } }
      if (dp > 520) { j.x = P.x + Math.sin(j.yaw + Math.PI) * 300; j.z = P.z + Math.cos(j.yaw + Math.PI) * 300; }
    }
    for (const h of S.helis) { // ヘリ: うえに はりついて ぐるぐる まわりながら きかんじゅうで うつ
      h.ph += dt; h.ang += 0.28 * dt; const orb = 32 + Math.sin(h.ph * 0.4) * 8; const tx = P.x + Math.sin(h.ang) * orb; const tz = P.z + Math.cos(h.ang) * orb; const ddx = tx - h.x; const ddz = tz - h.z; const dd = hyp(ddx, ddz) || 1; const sp = Math.min(26, dd * 1.2); h.x += (ddx / dd) * sp * dt; h.z += (ddz / dd) * sp * dt; h.y += (24 + Math.sin(h.ph) * 3 - h.y) * Math.min(1, dt); h.yaw += clamp(angDiff(Math.atan2(P.x - h.x, P.z - h.z), h.yaw), -2 * dt, 2 * dt);
      const dp = hyp(P.x - h.x, P.z - h.z); const vcur = cur(); const ty = vcur && isAir(vcur.kind) ? P.y : 1.4; h.cd -= dt; h.burst = (h.burst || 0) - dt;
      if (h.burst <= -1.0) h.burst = 1.4; if (h.burst > 0 && h.cd <= 0 && dp < 150 && P.dead <= 0) { h.cd = 0.3; const d3 = hyp(dp, h.y - ty) || 1; const sx = (rnd() - 0.5) * 0.07; const sz = (rnd() - 0.5) * 0.07; S.bullets.push({ x: h.x, y: h.y - 1, z: h.z, vx: ((P.x - h.x) / d3 + sx) * 80, vy: ((ty - h.y) / d3) * 80, vz: ((P.z - h.z) / d3 + sz) * 80, t: 0, dmg: 3 }); snd('cshot'); }
    }
    if (pv && (pv.kind === 'car' || pv.kind === 'bike' || pv.kind === 'tank') && Math.abs(pv.speed) > 3 && P.dead <= 0) for (const w of S.walkers) if (!(w.dead > 0) && hyp(w.x - pv.x, w.z - pv.z) < (pv.kind === 'tank' ? 5 : 2.6)) hurtWalker(w, 999, 'run');
    if (S.lv > 0) { S.heatT -= dt; S.huntT = (S.huntT || 0) - dt; if (S.heatT <= 0) clearHeat('🕊️ にげきった! 指名手配が とけたよ'); else if (S.huntT <= 0) { S.huntT = S.lv >= 4 ? 1.2 : 2.5; maintainHunters(); } }
    // こわれた のりものは じたくで なおる(ひとが のってない とき)
    for (const v of S.vehicles) if (!v.occ && !v.temp && v.hits > 0 && S.lv <= 0 && hyp(v.x - GARAGE.x, v.z - GARAGE.z) < 30) { v.hits = 0; v.hp = v.hpMax; }
    for (const c of S.civs) {
      if (c.state === 'need') c.fear = Math.max(0, c.fear - dt);
      else if (c.state === 'carried') { const d = hyp(c.x - P.x, c.z - P.z); const want = Math.atan2(P.x - c.x, P.z - c.z); c.yaw = want; if (d > 5 && P.mode === 'foot') { const s = Math.min(d - 4, 9 * dt + d * dt * 1.5); c.x += Math.sin(want) * s; c.z += Math.cos(want) * s; } else if (P.mode === 'veh') { c.x = P.x; c.z = P.z; } if (isWater(c.x, c.z)) { c.x = P.x; c.z = P.z; } }
    }
    // しめいてはいはん が つかまったら あとで また あらわれる
    for (const w of WANTED) if (respawnAt[w.id] && S.t >= respawnAt[w.id] && !S.crooks.some((c) => c.wid === w.id)) { delete respawnAt[w.id]; spawnWanted(w); refreshWanted(); }
    if (Math.floor(S.t * 2) % 2 === 0 && S.t - (S.rwT || -9) > 0.9) { S.rwT = S.t; refreshWanted(); }
    // ときどき「ひったくりが にげてる!」
    if (!S.mission && S.t > 20 && S.t - (S.lastRaid || -999) > 75 && !S.crooks.some((c) => c.minor)) { S.lastRaid = S.t; for (let tr = 0; tr < 80; tr++) { const rp = roadPoint(rnd, 1); const dd = hyp(rp.x - P.x, rp.z - P.z); if (dd > 70 && dd < 220 && isRoad(rp.x, rp.z) && !insideBuilding(rp.x, rp.z)) { const c = spawnCrook('runner', rp.x, rp.z, { wander: 40 }); c.minor = true; if (S.job === 'police') { banner('⚠ ひったくりが にげてる! つかまえて!', 2.6); snd('warn'); } break; } } }
    for (const c of S.crooks.slice()) if (c.minor && hyp(c.x - P.x, c.z - P.z) > 420) S.crooks = S.crooks.filter((x) => x !== c);
    for (const v of S.vehicles.slice()) { if (v.occ) continue; const d = hyp(v.x - P.x, v.z - P.z); if (v.temp) { v.idle = (v.idle || 0) + dt; if (v.idle > 40) { S.vehicles = S.vehicles.filter((x) => x !== v); continue; } } else if (d > 120 && hyp(v.x - v.home.x, v.z - v.home.z) > 3) { v.away += dt; if (v.away > 30) { v.x = v.home.x; v.z = v.home.z; v.y = 0; v.yaw = v.home.yaw; v.speed = 0; v.away = 0; } } else v.away = 0; v.speed *= Math.exp(-2 * dt); if (isAir(v.kind) && !v.occ) { v.y = 0; if (!v.temp) { v.x = v.home.x; v.z = v.home.z; } } }
    // じたくの かいふく・ほじゅうは 「あんぜんな とき」だけ(指名手配ちゅう・6びょうい ないに ダメージを うけた ときは つかえない=じたくで ずっと たたかえない)
    const homeSafe = S.lv <= 0 && S.t - (P.lastHurt == null ? -99 : P.lastHurt) > 6; const atHome = P.mode === 'foot' && hyp(P.x - GARAGE.x, P.z - GARAGE.z) < 24 && P.dead <= 0;
    // じたくに かくれる: おってを たおして ★1〜4の まま じたくで 12びょう じっと していると 指名手配が きえる(★5は かくれられない)
    { const near = (a) => a.some((u) => hyp(u.x - P.x, u.z - P.z) < 90); const calm = S.lv > 0 && S.lv < 5 && atHome && S.t - (P.lastHurt == null ? -99 : P.lastHurt) > 8 && !near(S.crooks.filter((c) => c.hunter && c.state !== 'down')) && !near(S.traffic.filter((c) => c.cop && !(c.dead > 0))) && !near(S.jets) && !near(S.helis);
      if (calm) { S.hideT = (S.hideT || 0) + dt; if (S.hideT >= 12) { S.hideT = 0; clearHeat('🏠 じたくに かくれて ほとぼりが さめた! 指名手配が きえたよ'); } else if (S.t - (S.hideMsgT || -9) > 4) { S.hideMsgT = S.t; msg(`🏠 じたくに かくれている…あと ${Math.ceil(12 - S.hideT)}びょう`, 2); } } else S.hideT = 0; }
    if (atHome && !homeSafe && S.t - (P.homeWarnT || -99) > 6) { P.homeWarnT = S.t; msg(S.lv > 0 ? '🚨 指名手配ちゅうは じたくでも かいふく できない!' : '💥 たたかっている あいだは じたくでも かいふく できない!', 2.4); }
    if (atHome && homeSafe) { // じたくに いると たまが ほじゅうされ、HPも なおる
      if (P.hp < P.hpMax) P.hp = Math.min(P.hpMax, P.hp + 20 * dt);
      if (S.t - (P.homeAmmoT || -99) > 12) { let need = false; for (const wid of S.wOwned) { const sp = ammoSpec(weaponOf(wid)); if (sp) { const A = am(wid); if (A.reserve < sp.cap || A.mag < sp.mag) { A.reserve = sp.cap; A.mag = sp.mag; need = true; } } } P.homeAmmoT = S.t; if (need) { snd('win'); msg('🏠 じたくで たまを ほじゅうしたよ!', 2.4); } }
    }
    if (homeSafe && P.mode === 'foot' && hyp(P.x - BASE.x, P.z - BASE.z) < BASE.r && P.hp < P.hpMax) P.hp = Math.min(P.hpMax, P.hp + 14 * dt);
    else if (P.mode === 'foot' && S.lv <= 0 && S.t - P.lastHurt > 6) P.hp = Math.min(P.hpMax, P.hp + 3 * dt);
    const v = cur(); if (v && v.V.missiles && (v.mis == null ? v.V.missiles : v.mis) < v.V.missiles) { v.misT = (v.misT || 0) + dt; if (v.misT > 6) { v.misT = 0; v.mis = (v.mis == null ? v.V.missiles : v.mis) + 1; } }
  }
  function stepMission(dt) {
    const M = S.mission; if (!M) return; M.t += dt; const v = cur(); const px = P.x; const pz = P.z; const reach = (t, r) => hyp(t.x - px, t.z - pz) < r;
    if (M.id === 'patrol') { const t = M.targets[M.stage]; if (t && reach(t, 18)) { M.stage++; M.got++; snd('coin'); msg(`${M.got}/${M.total} チェックポイント!`, 1.6); if (M.stage >= M.total) endMission(true); } }
    else if (M.id === 'harbor') { const t = M.targets[M.stage]; if (t && reach(t, 26)) { M.stage++; M.got++; snd('coin'); msg(`${M.got}/${M.total} ブイを まわった!`, 1.6); if (M.stage >= M.total) endMission(true); } else if (!v || (v.kind !== 'ship' && !isAir(v.kind))) { if (M.t > 3 && M.stage === 0 && !M.warned) { M.warned = true; msg('⚓ ふねに のって うみへ!(みなとの ふね)', 3); } } }
    else if (M.id === 'sky') { const t = M.targets[M.stage]; if (t && v && isAir(v.kind) && hyp(t.x - v.x, t.z - v.z) < 28 + 0.8 * Math.max(0, v.V.speed - 80) && Math.abs(t.y - v.y) < 34) { M.stage++; M.got++; snd('coin'); fx('spark', t.x, t.y, t.z, 8); msg(`${M.got}/${M.total} リング!`, 1.4); if (M.stage >= M.total) endMission(true); } }
    else if (M.id === 'rescue') {
      for (const c of S.civs) if (c.state === 'carried' && hyp(c.x - BASE.x, c.z - BASE.z) < BASE.r && hyp(px - BASE.x, pz - BASE.z) < BASE.r + 6) { c.state = 'safe'; M.got++; P.carry = Math.max(0, P.carry - 1); snd('coin'); msg(`${M.got}/${M.total} にん たすけた!`, 1.8); }
      S.civs = S.civs.filter((c) => c.state !== 'safe'); if (M.got >= M.total) endMission(true);
    } else if (M.id === 'gang' || M.gangX) { M.got = M.total - S.crooks.filter((c) => c.mission).length; if (M.timeLeft != null) { M.timeLeft -= dt; if (M.timeLeft <= 0) { endMission(false, 'じかんぎれ! もういちど ちょうせん'); return; } } if (!S.crooks.some((c) => c.mission)) endMission(true); }
    else if (M.id === 'delivery') { if (M.stage === 1) { M.timeLeft -= dt; if (hyp(px - BASE.x, pz - BASE.z) < BASE.r) { endMission(true); return; } if (M.timeLeft <= 0) endMission(false, 'じかんぎれ! もういちど ちょうせん'); } }
  }
  function interact() {
    if (P.dead > 0) return false; const n = S.nearby; if (!n) return false;
    if (n.kind === 'veh') { const v = S.vehicles.find((x) => x.id === n.id); if (v && !v.occ) { enter(v); return true; } }
    else if (n.kind === 'tcar') { const t = S.traffic.find((x) => x.id === n.id); if (t) {
      if (t.cop) { raiseNow(Math.max(S.lv, 3), '🚨 パトカーを うばった!'); }
      else if (!t.asked) { t.asked = true; t.ok = rnd() < 0.5; if (!t.ok) { t.denied = true; msg('運転手「だめ!」…むりやり のると どろぼうだよ', 3); snd('warn'); return true; } msg('運転手「いいよ! だいじに のってね」', 2.4); }
      else if (t.denied) raise(1, '🚨 くるまを ぬすんだ! どろぼう!');
      const it = catalogOf(t.model) || catalogOf('sedan'); const v = mkVeh(`tmp${++nid}`, it.kind, catalogV(it, ks), { x: t.x, z: t.z, yaw: t.yaw }, { temp: true, cat: it.id }); S.vehicles.push(v); S.traffic = S.traffic.filter((x) => x !== t); S.walkers.push({ id: ++nid, x: t.x + 3, z: t.z, yaw: t.yaw + 1.6, vert: t.vert, line: t.vert ? t.line + 4 : t.line, dir: 1, spd: 2.5, scared: 6, look: nid }); enter(v); if (t.denied) msg('🚨 くるまを うばった!', 2.5); return true; } }
    else if (n.kind === 'exit') { leave(); return true; }
    else if (n.kind === 'store') { S.ui = 'store'; ev({ t: 'store', id: n.id }); return true; }
    else if (n.kind === 'soccer') { ev({ t: 'soccer' }); return true; }
    else if (n.kind === 'koban') { payFine(); return true; }
    else if (n.kind === 'lockveh') { msg('🔒 トレッサの「のりもの」で かうと のれるよ', 3); return true; }
    else if (n.kind === 'board') { refreshWanted(); S.ui = 'board'; ev({ t: 'board' }); return true; }
    else if (n.kind === 'garage') { S.ui = 'garage'; ev({ t: 'garage' }); return true; }
    else if (n.kind === 'job') { S.ui = 'job'; ev({ t: 'job' }); return true; }
    else if (n.kind === 'mission') { const m = missionOf(n.id); if (m && !meets(m.need)) { msg(`🔒 まだ うけられないよ(${needText(m.need)})`, 3); return true; } return startMission(n.id); }
    else if (n.kind === 'secret') { const u = ultimateProgress(); if (S.done.secret > 0) { msg('「みごとだった…さいきょうの そうびを かうが いい」', 3.4); return true; } if (u.have < u.total) { msg(`「まだ はやい…そうび・のりもの・せんとうきを ぜんぶ そろえて きなさい」(${u.have}/${u.total})`, 4); return true; } if (S.mission) { msg('いまの ミッションを おえてから…', 2.4); return true; } msg('「よく ここまで たどりついた。さいきょうの しれんを うけるか?」', 3.2); return startMission('secret'); }
    else if (n.kind === 'arrest') { const c = S.crooks.find((x) => x.id === n.id); if (c && (c.state === 'down' || c.task)) { arrest(c); return true; } }
    else if (n.kind === 'house') { ev({ t: 'house' }); return true; }
    else if (n.kind === 'fuel') { const vf = cur(); if (vf) { const cost = n.id === 'fhome' ? 0 : Math.ceil((100 - (vf.fuel == null ? 100 : vf.fuel)) * 1.5); if (P.coins < cost) { msg('コインが たりないよ', 2); return true; } P.coins -= cost; vf.fuel = 100; msg(`⛽ まんたんに なった!${cost ? ` 🪙-${cost}` : ''}`, 2.4); snd('coin'); } return true; }
    else if (n.kind === 'play') { S.ui = 'play'; ev({ t: 'play', id: n.id }); return true; }
    else if (n.kind === 'recruit') { const cost = 400 + S.allies.length * 300; if (S.allies.length >= 2) return true; if (P.coins < cost) { msg(`🗣 「いっしょに いきたいけど…コインが たりないよ(🪙${cost} ひつよう)」`, 2.8); return true; } P.coins -= cost; const w = S.walkers.find((q) => q.id === n.id); S.allies.push({ id: 70000 + S.allies.length + Math.floor(rnd() * 900), x: w ? w.x : P.x + 2, z: w ? w.z : P.z, yaw: 0, cd: 1, mv: 0 }); if (w) w.dead = 9999; msg('🤝 なかまに なった! たよれる ボディガードだ', 3); snd('win'); ev({ t: 'jobsave' }); return true; }
    else if (n.kind === 'talk') { const w = S.walkers.find((q) => q.id === n.id); if (w) { w.talkCd = S.t + 45; talkTo(w); } return true; }
    else if (n.kind === 'fish') { if (!P.fish) { P.fish = { t: 3.5 + rnd() * 2, i: n.id }; msg('🎣 つりを はじめた… うごかずに まとう!', 2.4); snd('click'); } return true; }
    else if (n.kind === 'hideout') { const h = S.hideouts.find((q) => q.id === n.id); if (h) return enterHideout(h); return true; }
    else if (n.kind === 'enter') {
      const st = STORES.find((x) => x.id === n.id); if (!st) return true; if (S.lv > 0) { msg('🚨 てはい ちゅうは おみせに はいれないよ!', 2.6); return true; }
      P.plat = { kind: 'shop', id: st.id, y: 600, cx: st.x, cz: st.z, x0: st.x - 8.3, x1: st.x + 8.3, z0: st.z - 6.0, z1: st.z + 6.3, ex: st.x, ez: st.z }; P.x = st.x; P.z = st.z + 5; P.yaw = Math.PI; P.camYaw = Math.PI; snd('door'); msg(`${st.icon} ${st.name}に はいった!`, 2); return true;
    }
    else if (n.kind === 'roof') {
      const b = LAYOUT.buildings[n.id]; if (!b) return true; if (S.lv > 0) { msg('🚨 てはい ちゅうは のぼれないよ!', 2.6); return true; }
      const hw = Math.max(2, Math.min(b.w, b.d) / 2 - 1.2); P.plat = { kind: 'roof', bi: n.id, y: b.H || b.h, cx: b.cx, cz: b.cz, x0: b.cx - hw, x1: b.cx + hw, z0: b.cz - hw, z1: b.cz + hw, ex: P.x, ez: P.z, via: n.via || 'lift' }; P.x = b.cx; P.z = b.cz; snd('door'); msg('おくじょうに ついた! スナイパーに ぴったり(しゃていが ながく なるよ)', 3); return true;
    }
    else if (n.kind === 'leave') { if (P.plat) { const pl = P.plat; const f = freeAround(pl.ex, pl.ez); P.plat = null; P.x = f.x; P.z = f.z; P.speed = 0; snd('door'); msg('🚪 そとに でた', 1.6); } return true; }
    else if (n.kind === 'collect') { const [cat, si] = String(n.id).split(':'); const i = +si; if (cat === 'run') { const pt = cpts().run[i]; if (pt && !S.run && !S.coll.run.includes(i)) { S.run = { i, t: pt.limit, gx: pt.gx, gz: pt.gz }; msg(`⏱️ スタート! ${pt.limit}びょうで ゴールへ!`, 3); snd('warn'); } } else collectItem(cat, i); return true; }
    else if (n.kind === 'commander') { if (JSDF.includes(S.job)) { msg('🎖️「よく きた! ぼうえい にんむだ。クリアするまで もどれんぞ!」', 3.2); ev({ t: 'defense', level: S.defLevel, branch: JOBS[S.job].branch, job: S.job }); } else msg('🎖️「じえいたいの しょくぎょうの ものだけだ。じたくで えらんで こい!」', 3.4); return true; }
    else if (n.kind === 'patient') { ev({ t: 'patient', id: n.id }); return true; }
    else if (n.kind === 'civ') { const c = S.civs.find((x) => x.id === n.id); if (c) { c.state = 'carried'; P.carry++; snd('coin'); msg('いっしょに じたくまで いこう!', 2); return true; } }
    else if (n.kind === 'pack') { const M = S.mission; if (M) { M.stage = 1; M.targets = [{ x: BASE.x, z: BASE.z }]; msg('📦 うけとった! じたくへ ダッシュ!', 2.4); snd('coin'); return true; } }
    return false;
  }
  function buy(id) {
    const it = ITEMS.find((x) => x.id === id); if (!it) return { ok: false, why: 'ない' }; if (P.coins < it.cost) return { ok: false, why: 'コインが たりないよ' };
    if (id === 'heal' || id === 'snack' || id === 'ramen') { if (P.hp >= P.hpMax) return { ok: false, why: 'もう げんきだよ' }; P.coins -= it.cost; P.hp = id === 'snack' ? Math.min(P.hpMax, P.hp + P.hpMax * 0.35) : P.hpMax; if (id === 'ramen') P.buff.dmg = 45; snd('win'); return { ok: true }; }
    if (id === 'drink') { P.coins -= it.cost; P.buff.dmg = 60; snd('win'); msg('💪 60びょう こうげきが つよく なったよ!', 2.4); return { ok: true }; }
    if (id === 'ammo') { P.coins -= it.cost; for (const wid of S.wOwned) { const sp = ammoSpec(weaponOf(wid)); if (sp) { const A = am(wid); A.reserve = sp.cap; } } snd('win'); msg('📦 たまを ぜんぶ ほじゅうしたよ!', 2.4); return { ok: true }; }
    if (id === 'phone') { if (S.hasPhone) return { ok: false, why: 'もう もってるよ' }; P.coins -= it.cost; S.hasPhone = true; snd('win'); msg('📱 スマートフォンを てにいれた! メニューから のりものを よべるよ', 3.4); return { ok: true }; }
    if (id === 'sneak') { P.coins -= it.cost; P.buff.speed = 60; snd('win'); msg('👟 60びょう あしが はやく なったよ!', 2.4); return { ok: true }; }
    P.coins -= it.cost; ev({ t: 'buy', id }); return { ok: true };
  }
  function buyVehicle(id) {
    const it = catalogOf(id) || specialOf(id); if (!it) return { ok: false, why: 'ない' }; if (S.owned.includes(id)) return { ok: false, why: 'もう もってるよ' }; if (!meets(it.need)) return { ok: false, why: `まだ かえないよ(${needText(it.need)})` }; if (P.coins < it.price) return { ok: false, why: 'コインが たりないよ' };
    P.coins -= it.price; S.owned.push(id); parkOwned(); ev({ t: 'buyveh', id }); snd('win'); return { ok: true };
  }
  function buyWeapon(id) {
    const w = weaponOf(id); if (!w) return { ok: false, why: 'ない' }; if (S.wOwned.includes(id)) return { ok: false, why: 'もう もってるよ' };
    if (!meets(w.need)) return { ok: false, why: `まだ かえないよ(${needText(w.need)})` }; if (P.coins < w.price) return { ok: false, why: 'コインが たりないよ' };
    P.coins -= w.price; S.wOwned.push(id); P.weapon = id; { const sp = ammoSpec(w); if (sp) S.ammo[id] = { mag: sp.mag, reserve: Math.floor(sp.cap / 2) }; } ev({ t: 'buywep', id }); snd('win'); return { ok: true };
  }
  function buyEquip(id) {
    const e = equipOf(id); if (!e) return { ok: false, why: 'ない' }; if (S.eqOwned.includes(id)) return { ok: false, why: 'もう もってるよ' };
    if (!meets(e.need)) return { ok: false, why: `まだ かえないよ(${needText(e.need)})` }; if (P.coins < e.price) return { ok: false, why: 'コインが たりないよ' };
    P.coins -= e.price; S.eqOwned.push(id); S.equip[e.slot] = id; applyEq(); snd('win'); ev({ t: 'buyeq', id }); return { ok: true };
  }
  function wear(id) { const e = equipOf(id); if (!e || !S.eqOwned.includes(id)) return false; if (S.equip[e.slot] === id) delete S.equip[e.slot]; else S.equip[e.slot] = id; applyEq(); snd('door'); return true; }
  function equip(id) { if (!S.wOwned.includes(id)) return false; P.reload = 0; P.weapon = id; P.wCd = Math.max(P.wCd, 0.2); snd('door'); return true; }
  function cycleWeapon(dir = 1) { const list = WEAPONS.filter((w) => S.wOwned.includes(w.id)).map((w) => w.id); const i = list.indexOf(P.weapon); P.reload = 0; P.weapon = list[(i + dir + list.length) % list.length]; P.wCd = Math.max(P.wCd, 0.2); snd('door'); return P.weapon; }
  function addCoins(n) { P.coins += n; S.stats.coins += n; snd('coin'); return P.coins; }
  // ---- ファストトラベル: じたく・トレッサ・こうばん + じぶんで とうろく(3かしょ) ----
  const warpPlaces = () => { const tr = STORES.find((x) => x.id === 'tresa'); return [{ id: 'home', name: 'じたく', icon: '🏠', x: GARAGE.x, z: GARAGE.z + 10 }, { id: 'tresa', name: 'トレッサ', icon: '🛍️', x: tr.x, z: tr.z }, { id: 'koban', name: '綱島えきまえ こうばん', icon: '🚓', x: KOBAN.x, z: KOBAN.z + 8 }]; };
  const nameHere = (x, z, slot) => { const cand2 = [...STORES.map((st) => [st.name, st.x, st.z]), ['じたく', GARAGE.x, GARAGE.z], ['こうばん', KOBAN.x, KOBAN.z], ['おべんきょう(がっこう)', JOB.x, JOB.z], ['サッカーじょう', SOCCER.x, SOCCER.z]]; let best = null; let bd = 70; for (const [n, px, pz] of cand2) { const d = hyp(px - x, pz - z); if (d < bd) { bd = d; best = n; } } return best ? `${best}の ちかく` : `とうろく${slot + 1}`; };
  function fastTravel(dest = 'home') {
    if (P.dead > 0) return { ok: false, why: '' }; if (S.lv >= 5) return { ok: false, why: '🚨 ★5は にげられない!' }; const v = cur(); if (v && isAir(v.kind) && P.y > 12) return { ok: false, why: 'そらでは つかえないよ' };
    let d = warpPlaces().find((x) => x.id === dest); if (!d && /^w[0-2]$/.test(dest)) { const w = S.warps[+dest[1]]; if (w) d = { id: dest, name: w.name, icon: '📍', x: w.x, z: w.z }; } if (!d) return { ok: false, why: 'そこは とうろく されていないよ' };
    const f = (insideBuilding(d.x, d.z, 0) || CM.isWater(d.x, d.z)) ? freeAround(d.x, d.z) : { x: d.x, z: d.z };
    P.plat = null; if (v) leave(); P.chute = false; P.x = f.x; P.z = f.z; P.y = 0; P.speed = 0; P.yaw = d.id === 'home' ? Math.PI : 0; P.camYaw = P.yaw; fx('spark', P.x, 2, P.z, 8); snd('door'); msg(`${d.icon} ${d.name}に ワープしたよ!`, 2.2); return { ok: true };
  }
  function registerWarp(slot) {
    if (!(slot >= 0 && slot < 3)) return { ok: false, why: '' }; if (CM.isWater(P.x, P.z) || P.y > 12) return { ok: false, why: 'ここには とうろく できないよ' }; const x = Math.round(P.x); const z = Math.round(P.z); S.warps[slot] = { x, z, name: nameHere(x, z, slot) }; snd('win'); msg(`📍 とうろくしたよ: ${S.warps[slot].name}`, 2.4); return { ok: true };
  }
  function removeWarp(slot) { if (S.warps[slot]) { S.warps[slot] = null; while (S.warps.length && !S.warps[S.warps.length - 1]) S.warps.pop(); } return { ok: true }; }
  function summon(id) {
    const v = S.vehicles.find((x) => x.id === id && !x.temp); if (!v) return { ok: false, why: 'ないよ' }; if (!canRide(v)) return { ok: false, why: (catalogOf(v.id) && catalogOf(v.id).job) ? 'その しょくぎょうの ときだけ のれるよ(じたくで しょくぎょうを えらぶ)' : 'まだ かっていないよ(トレッサで かおう)' }; if (v.kind === 'ship') return { ok: false, why: 'ふねは みなとに あるよ' };
    if (P.dead > 0) return { ok: false, why: '' }; if (cur() && cur() !== v) { if (isAir(cur().kind) && P.y > 12) return { ok: false, why: 'そらでは つかえないよ' }; leave(); }
    v.occ = false; v.x = GARAGE.x - 4; v.z = GARAGE.z + 12; v.y = 0; v.yaw = Math.PI; v.speed = 0; v.hp = v.hpMax; P.x = GARAGE.x; P.z = GARAGE.z + 4; P.chute = false; enter(v); S.ui = null; return { ok: true };
  }
  function stepPlayer(dt, remote) {
    if (P.invuln > 0) P.invuln -= dt; if (P.hurt > 0) { P.hurt -= dt; P.lastHurt = S.t; } if (P.missileCd > 0) P.missileCd -= dt; if (P.wCd > 0) P.wCd -= dt; if (P.bloom > 0) P.bloom = Math.max(0, P.bloom - (input.gun ? 0.35 : 2.2) * dt); if (P.reload > 0) { if (P.reloadId !== P.weapon) P.reload = 0; else { P.reload -= dt; if (P.reload <= 0) { P.reload = 0; const A = am(P.weapon); const sp = ammoSpec(weaponOf(P.weapon)); if (A && sp) { const take = Math.min(sp.mag - A.mag, A.reserve); A.mag += take; A.reserve -= take; snd('door'); } } } } if (P.buff.dmg > 0) P.buff.dmg -= dt; if (P.buff.speed > 0) P.buff.speed -= dt; if (S.swing > 0) S.swing -= dt;
    if (P.dead > 0) { P.dead -= dt; if (P.dead <= 0) respawn(); return false; }
    if (Math.abs(input.aimX) + Math.abs(input.aimY) > 0.05) P.noAim = 0; else P.noAim += dt;
    if (remote) { if (input.camYaw != null) P.camYaw = input.camYaw; if (input.aimPitch != null) P.aimPitch = clamp(input.aimPitch, -0.4, 1.2); P.camFree = true; }
    else {
    const v0 = cur(); if (!v0) { if (input.aimX) { P.camYaw += input.aimX * 1.45 * (1 + S.eq.aim) * dt; P.camFree = true; } P.aimPitch = clamp(P.aimPitch + input.aimY * 0.9 * dt, roofY(P) ? -1.25 : -0.35, 1.1); if (!P.camFree) P.camYaw = P.yaw; } else if (!isAir(v0.kind)) { P.aimRel = clamp(P.aimRel + input.aimX * 1.7 * dt, -2.4, 2.4); P.aimPitch = clamp(P.aimPitch + input.aimY * 0.9 * dt, -0.2, 1.2); }
    if (input.aimLock && !cur() && P.dead <= 0) { const t = P.target; if (t) { const wy = Math.atan2(t.x - P.x, t.z - P.z); P.camYaw += clamp(angDiff(wy, P.camYaw) * Math.min(1, 12 * (1 + S.eq.aim) * dt), -4 * dt, 4 * dt); P.aimPitch += (clamp(Math.atan2((t.y != null ? t.y : 1.6) - 2.5 - roofY(P), hyp(t.x - P.x, t.z - P.z)), roofY(P) ? -1.25 : -0.2, t.y != null ? 1.1 : 0.4) - P.aimPitch) * Math.min(1, 10 * dt); } P.camFree = true; }
    }
    movePlayer(dt); if (P.plat) { if (P.mode !== 'foot' || P.dead > 0) P.plat = null; else { P.x = clamp(P.x, P.plat.x0, P.plat.x1); P.z = clamp(P.z, P.plat.z0, P.plat.z1); } } setNear();
    P.nearby = S.nearby;
    // ジャンプ(あるいている ときだけ・じめん/おくじょうから)
    if (input.jump) { input.jump = false; if (P.mode === 'foot' && !P.chute && !(P.jh > 0.02)) { P.jv = 6.6; P.jh = 0.001; snd('jump'); } }
    if (P.mode !== 'foot' || P.chute) { P.jh = 0; P.jv = 0; } else if (P.jh > 0) { P.jv -= 21 * dt; P.jh += P.jv * dt; if (P.jh <= 0) { P.jh = 0; P.jv = 0; } }
    if (input.gun) fireGun(dt);
    { const Wt = weaponOf(P.weapon) || {}; const vt = cur(); P.target = nearestCrook(vt ? (vt.kind === 'car' || vt.kind === 'bike' ? AUTOAIM_MAX_VEH : 600) : (Wt.range || 3) + AUTOAIM_EXTRA, 6.3, P.yaw); } // あるいている ときは ぶきの しゃてい+12mの なかだけ ねらいが きく
    return true;
  }
  function step(dtIn) {
    const dt = Math.min(dtIn, 1 / 20); S.t += dt; if (S.msgT > 0) S.msgT -= dt; if (S.bannerT > 0) S.bannerT -= dt;
    for (let i = S.effects.length - 1; i >= 0; i--) { S.effects[i].t += dt; if (S.effects[i].t > S.effects[i].life) S.effects.splice(i, 1); }
    S.tracers = S.tracers.filter((tr) => { tr.t += dt; return tr.t < 0.1; });
    for (let k = players.length - 1; k >= 0; k--) { P = players[k]; input = inputs[k]; const sv = swapIn(P); const alive = stepPlayer(dt, k > 0); swapOut(sv, P); if (k === 0 && !alive) { P = HOST; input = HOST_IN; stepCrooks(dt); return; } }
    P = HOST; input = HOST_IN;
    stepCrooks(dt); stepMissiles(dt); stepWorld(dt); stepMission(dt);
  }
  // ---- きょうりょく(3にん): ホストが せかいを うごかし、ゲストは そうさを おくる ----
  const GUEST_OK = ['veh', 'tcar', 'exit', 'arrest', 'collect'];
  // ゲストは じぶんの ぶき・たまを つかう(ホストの もちものを つかわない)
  const swapIn = (pl) => { if (pl === HOST) return null; const sv = { o: S.wOwned, a: S.ammo, e: S.equip, eo: S.eqOwned, q: S.eq }; S.wOwned = pl.wOwned || ['pistol']; S.ammo = pl.ammo || {}; S.equip = pl.equip || {}; S.eqOwned = pl.eqOwned || []; S.eq = pl.eqs || { hp: 0, def: 0, spd: 0, aim: 0, acc: 0 }; return sv; };
  const swapOut = (sv, pl) => { if (!sv) return; pl.wOwned = S.wOwned; pl.ammo = S.ammo; pl.equip = S.equip; pl.eqOwned = S.eqOwned; pl.eqs = S.eq; S.wOwned = sv.o; S.ammo = sv.a; S.equip = sv.e; S.eqOwned = sv.eo; S.eq = sv.q; };
  const as = (pl, fn) => { if (!players.includes(pl)) return undefined; const k = players.indexOf(pl); P = pl; input = inputs[k]; const sv = swapIn(pl); try { return fn(); } finally { swapOut(sv, pl); P = HOST; input = HOST_IN; } };
  const addPlayer = (name = 'ゲスト', inv = null) => {
    if (players.length >= 3) return null; const g = JSON.parse(JSON.stringify(HOST)); g.name = name; g.mode = 'foot'; g.veh = null; g.dead = 0; g.hp = g.hpMax; g.invuln = 3; g.x = SPAWN.x + players.length * 3; g.z = SPAWN.z; g.y = 0; g.yaw = 0; g.camYaw = 0; g.speed = 0; g.plat = null; g.coins = 0; g.target = null; g.nearby = null; g.reload = 0; g.wCd = 0; const gw = inv && Array.isArray(inv.w) ? inv.w.filter((id) => typeof id === 'string' && weaponOf(id)).slice(0, 60) : []; g.wOwned = [...new Set(['pistol', ...gw])]; g.ammo = {}; if (inv && inv.am && typeof inv.am === 'object') for (const id of g.wOwned) { const a = inv.am[id]; const sp = ammoSpec(weaponOf(id)); if (a && sp) g.ammo[id] = { mag: Math.min(sp.mag, a.mag | 0), reserve: Math.min(sp.cap, a.reserve | 0) }; } g.weapon = inv && g.wOwned.includes(inv.wp) ? inv.wp : 'pistol';
    g.equip = {}; g.eqOwned = []; if (inv && inv.eo && Array.isArray(inv.eo)) g.eqOwned = inv.eo.filter((id) => typeof id === 'string' && equipOf(id) && !(equipOf(id).need && equipOf(id).need.secret)).slice(0, 40); if (inv && inv.eq && typeof inv.eq === 'object') for (const [sl, id] of Object.entries(inv.eq)) { const e = equipOf(id); if (e && e.slot === sl && g.eqOwned.includes(id)) g.equip[sl] = id; } g.eqs = { hp: 0, def: 0, spd: 0, aim: 0, acc: 0 };
    players.push(g); as(g, () => { applyEq(); g.hp = g.hpMax; }); inputs.push({ turn: 0, climb: 0, moveX: 0, moveY: 0, autoAim: true, aimLock: false, gun: false, boost: false, aimX: 0, aimY: 0 }); msg(`${name} が さんかしたよ!`, 3); return g;
  };
  const removePlayer = (pl) => { const k = players.indexOf(pl); if (k <= 0) return; if (pl.veh) as(pl, () => leave()); players.splice(k, 1); inputs.splice(k, 1); };
  const inputOf = (pl) => inputs[players.indexOf(pl)];
  const interactFor = (pl) => { const n = pl.nearby; if (!n || !GUEST_OK.includes(n.kind)) return false; return !!as(pl, () => { S.nearby = n; const r = interact(); S.nearby = HOST.nearby; return r; }); };
  const setCoopBest = (b) => { S.coopBest = b ? { a: b.a | 0, m: b.m | 0, j: b.j | 0 } : null; };
  return {
    state: S, input: HOST_IN, step, addPlayer, removePlayer, inputOf, interactFor, setCoopBest, as, players, interact, fireMissile, startMission, cancelMission, buy, buyVehicle, buyWeapon, buyEquip, wear, ultimateProgress, warpPlaces, registerWarp, removeWarp, spend(n) { if (P.coins < n) return false; P.coins -= n; return true; }, setJob, treat, callVehicle, questView, collectView, hospitals: HOSPITALS, addJobOk(n) { S.jobOk += n | 0; return S.jobOk; }, payFine, raise: raiseNow, gunHit, meleeHit, equip, cycleWeapon, reload: startReload, ammoOf: am, addCoins, fastTravel, summon, meets, progress, vehicleOf: cur, footStats: FS,
    takeEvents() { const e = S.events; S.events = []; return e; },
    playPay(id) { const g = PLAYSPOTS.find((q) => q.id === id); if (!g || P.coins < g.cost) return { ok: false }; P.coins -= g.cost; return { ok: true }; },
    playReward(id, n) { const g = PLAYSPOTS.find((q) => q.id === id); if (!g) return 0; const c = clamp(Math.round(+n || 0), 0, g.max); P.coins += c; S.stats.coins += c; if (c > 0) addRpg(2); ev({ t: 'jobsave' }); return c; },
    setVehColor(id, hex) { if (!/^#[0-9a-fA-F]{6}$/.test(hex || '') || !catalogOf(id) || !S.owned.includes(id)) return { ok: false }; S.vcol[id] = hex; S.vcolV = (S.vcolV || 0) + 1; ev({ t: 'jobsave' }); return { ok: true }; },
    selectChapter(i) { const q = S.qs[S.job]; const story = STORY[S.job]; if (!q || !story || !Number.isInteger(i) || i < 0 || i >= story.length || q.cl.includes(i)) return { ok: false }; q.done = false; q.c = i; q.s = 0; q.p = 0; q.began = false; q.tx = null; q.tz = null; q.spawned = false; q.base = null; q.lx = null; q.lz = null; ev({ t: 'jobsave' }); msg(`📖 ${story[i].title} に ちょうせん!`, 2.6); return { ok: true }; },
    aimAt(r) { if (!r) return; if (!cur()) { P.camYaw = Math.atan2(r.x - P.x, r.z - P.z); P.camFree = true; P.aimPitch = clamp(r.y != null ? Math.atan2(r.y - 1.6 - roofY(P), hyp(r.x - P.x, r.z - P.z)) : Math.atan2(1.6 - 2.5 - roofY(P), hyp(r.x - P.x, r.z - P.z)), roofY(P) ? -1.25 : -0.2, r.y != null ? 1.1 : 0.4); return; } P.aimRel = clamp(angDiff(Math.atan2(r.x - P.x, r.z - P.z), cur() ? cur().yaw : P.yaw), -2.4, 2.4); P.aimPitch = clamp(Math.atan2(2 - 4, Math.hypot(r.x - P.x, r.z - P.z)), -0.2, 1.2); },
    look(dx, dy) { P.noAim = 0; const v = cur(); if (!v) { const am2 = 1 + S.eq.aim; P.camYaw -= dx * 0.0034 * am2; P.camFree = true; P.aimPitch = clamp(P.aimPitch - dy * 0.0024 * am2, roofY(P) ? -1.25 : -0.35, 1.1); } else if (!isAir(v.kind)) { P.aimRel = clamp(P.aimRel - dx * 0.0036, -2.4, 2.4); P.aimPitch = clamp(P.aimPitch - dy * 0.0026, -0.2, 1.2); } },
    track(id) { S.tracked = S.tracked === id ? null : id; }, closeUi() { S.ui = null; }, refreshWanted,
  };
}
