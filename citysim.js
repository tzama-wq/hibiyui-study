// 地球防衛隊「シティ」: じゆうに うごける 街の ルールと うごき(画面には さわらない。node で テストできる)。
//   あるいて・くるま・バイク・せんしゃ・ふね・ひこうき・せんとうきに のりおりして、指名手配はんを たいほして けんしょう金を もらう。
//   const sim = createCity({ stats, vehicles, owned, rnd, gentle, coins, arrests });  sim.input = { turn, climb, gun, boost, aimX, aimY };
//   sim.interact()(のる/おりる/ミッション/おみせ/たいほ) ・ sim.fireMissile() ・ sim.step(dt) ・ sim.takeEvents()
//   ざひょう: x=よこ, y=たかさ, z=おく。からだの むき yaw: まえ = (sin yaw, cos yaw)
import * as CM from './citymap.js';
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
export const JOB = { x: 0, z: 0 }; // おしごと(綱島東小学校)—あとで きめる
export const ARMS = { x: PLAZA.cx - 56, z: PLAZA.cz + 32 };
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
export const insideBuilding = (x, z, ys = 0) => nearB(x, z).some((b) => { if (ys > b.h) return false; if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) return false; const dx = x - b.cx; const dz = z - b.cz; return Math.abs(dx * b.c + dz * b.s) <= b.w / 2 && Math.abs(-dx * b.s + dz * b.c) <= b.d / 2; });
{ const jp = freeAround(CM.POI.school ? CM.POI.school.c[0] : SCHOOL.cx, CM.POI.school ? CM.POI.school.c[1] : SCHOOL.cz); JOB.x = jp.x; JOB.z = jp.z; }
// みちの ひろいあげ: ちずの みちの うえの ランダムな てん
export const roadPoint = (R, minCls = 1) => { const rl = CM.roadsOf().filter((r) => r.cls >= minCls && r.pts.length >= 2); for (let t = 0; t < 40; t++) { const r = rl[Math.floor(R() * rl.length)]; const i = 1 + Math.floor(R() * (r.pts.length - 1)); const a = r.pts[i - 1]; const b = r.pts[i]; const u = R(); const x = lerp(a[0], b[0], u); const z = lerp(a[1], b[1], u); if (!CM.isWater(x, z) && Math.abs(x) < HALF - 20 && Math.abs(z) < HALF - 20) return { x, z, ang: Math.atan2(b[1] - a[1], b[0] - a[0]), r, i, u }; } return { x: HQ.x, z: HQ.z + 40, ang: 0 }; };

// ---- あるく・のりものの せいのう ------------------------------------------------------------------
export const footStats = (ks) => ({ vehicle: 'foot', speed: 5.6 + ks.SPD * 0.0064, run: 9.6 + ks.SPD * 0.0096, hpMax: Math.round(70 + ks.DEF * 0.7), gunDps: Math.round(18 + ks.SHO * 0.1), range: 75, turn: 2.4 });
// のりものカタログ(model=3Dの かたち)。price=コイン。free=さいしょから もっている
export const VCAT = [
  { id: 'sedan', name: 'ふつうの くるま', icon: '🚗', kind: 'car', model: 'sedan', price: 0, free: true, speed: 30, turn: 1.7, hp: 130, gun: 20, desc: 'まちを はしる ふつうの くるま' },
  { id: 'police', name: 'パトカー', icon: '🚓', kind: 'car', model: 'police', price: 0, free: true, speed: 34, turn: 1.8, hp: 170, gun: 26, desc: 'サイレンつき! ぼうえいたいの パトカー' },
  { id: 'scooter', name: 'スクーター', icon: '🛵', kind: 'bike', model: 'scooter', price: 0, free: true, speed: 24, turn: 2.6, hp: 60, gun: 14, desc: 'ちいさくて こまわりが きく' },
  { id: 'taxi', name: 'タクシー', icon: '🚕', kind: 'car', model: 'taxi', price: 800, speed: 30, turn: 1.7, hp: 130, gun: 16, desc: 'きいろい タクシー' },
  { id: 'suv', name: 'SUV', icon: '🚙', kind: 'car', model: 'suv', price: 1800, speed: 32, turn: 1.5, hp: 210, gun: 22, desc: 'がんじょうな 4WD' },
  { id: 'bike', name: 'バイク', icon: '🏍️', kind: 'bike', model: 'bike', price: 1400, speed: 44, turn: 2.6, hp: 70, gun: 18, desc: 'はやい ロードバイク' },
  { id: 'pbike', need: { a: 2 }, name: '白バイ', icon: '🏍️', kind: 'bike', model: 'pbike', price: 2080, speed: 42, turn: 2.7, hp: 95, gun: 24, desc: 'サイレンつきの けいさつの バイク' },
  { id: 'truck', name: 'トラック', icon: '🚚', kind: 'car', model: 'truck', price: 2600, speed: 24, turn: 1.2, hp: 340, gun: 18, desc: 'おおきくて とても じょうぶ' },
  { id: 'sports', need: { a: 1 }, name: 'スポーツカー', icon: '🏎️', kind: 'car', model: 'sports', price: 3200, speed: 44, turn: 2.0, hp: 125, gun: 22, desc: 'スピードが じまんの くるま' },
  { id: 'racer', need: { m: 3 }, name: 'レーサーバイク', icon: '🏍️', kind: 'bike', model: 'racer', price: 6000, speed: 64, turn: 2.8, hp: 70, gun: 18, desc: 'ちょう はやい バイク' },
  { id: 'cessna', name: 'プロペラ機', icon: '🛩️', kind: 'plane', model: 'cessna', price: 2400, speed: 50, turn: 0.95, hp: 100, gun: 0, desc: 'ゆっくり そらを さんぽ' },
  { id: 'super', need: { a: 3 }, name: 'スーパーカー', icon: '🏎️', kind: 'car', model: 'super', price: 9600, speed: 58, turn: 2.1, hp: 115, gun: 24, desc: 'とびきり はやい!' },
  { id: 'trainer', need: { m: 2 }, name: 'れんしゅうき', icon: '✈️', kind: 'jet', model: 'trainer', price: 6000, speed: 92, turn: 1.1, hp: 130, gun: 24, missiles: 2, desc: 'ジェットの はじめの いっぽ' },
  { id: 'bizjet', need: { m: 5 }, name: 'ビジネスジェット', icon: '🛫', kind: 'jet', model: 'bizjet', price: 10000, speed: 125, turn: 0.95, hp: 150, gun: 0, desc: 'そらを ゆうがに ひこう' },
  { id: 'hawk', need: { a: 5, m: 4 }, name: 'ホーク せんとうき', icon: '🛩️', kind: 'jet', model: 'fighter', price: 18000, speed: 138, turn: 1.1, hp: 170, gun: 42, missiles: 6, desc: 'ミサイルを つんだ せんとうき' },
  { id: 'phantom', need: { a: 8, m: 6 }, name: 'ファントム ステルス', icon: '✈️', kind: 'jet', model: 'stealth', price: 36000, speed: 165, turn: 1.15, hp: 210, gun: 56, missiles: 8, desc: 'さいしんの ステルス せんとうき' },
];
export const catalogOf = (id) => VCAT.find((v) => v.id === id);
// かいほうじょうけん: a=つかまえた 指名手配はんの にんずう / m=クリアした ミッションの かいすう
export const needText = (n) => (n ? [n.all ? 'そうび・のりもの・せんとうきを ぜんぶ かう' : '', n.m ? `ミッション ${n.m}かい クリア` : '', n.a ? `指名手配はん ${n.a}にん たいほ` : ''].filter(Boolean).join(' + ') : '');
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
export const ammoSpec = (w) => { const a = w && AMMO[w.id]; return a ? { mag: a[0], reload: a[1], cap: a[2], recoil: a[3], fall: a[4] } : null; };
export const DEFAULT_WEAPONS = WEAPONS.filter((w) => !w.price).map((w) => w.id);
export const DEFAULT_OWNED = VCAT.filter((v) => v.free).map((v) => v.id);
// カタログの のりものの せいのう(しゅじんこうの つよさで すこし のびる)
export function catalogV(it, ks) {
  const air = isAir(it.kind);
  return { vehicle: it.kind, model: it.model, name: it.name, speed: it.speed + ks.SPD * (air ? 0.08 : 0.04), hpMax: Math.round(it.hp + ks.DEF * (air ? 0.8 : 1.0)), gunDps: it.gun ? Math.round(it.gun + ks.SHO * 0.1) : 0, turn: it.turn, missiles: it.missiles || 0, missileDmg: it.missiles ? Math.round(70 + ks.SHO * 0.3) : 0, locks: it.missiles ? 2 : 0, boostMax: 60 + Math.round(ks.STA * 0.4) };
}
export const carStats = (ks) => catalogV(catalogOf('sedan'), ks); // (むかしの なまえ)

// ---- 指名手配はん(けんしょう金つき) -------------------------------------------------------------
export const CROOKS = {
  thug: { name: 'チンピラ', hp: 50, dmg: 4, speed: 4.6, range: 55, fire: 1.7 },
  gunman: { name: 'ごうとう', hp: 90, dmg: 6, speed: 5, range: 70, fire: 1.4 },
  boss: { name: 'ボス', hp: 260, dmg: 9, speed: 4.2, range: 85, fire: 1.0 },
  runner: { name: 'ひったくり', hp: 36, dmg: 0, speed: 8.5, range: 0, fire: 99 },
  cop: { name: 'おまわりさん', hp: 80, dmg: 5, speed: 5.8, range: 60, fire: 1.3 },
  bounty: { name: '賞金かせぎ', hp: 120, dmg: 7, speed: 6, range: 75, fire: 1.0 },
};
// てはい(指名手配): はんざいの おもさで 「てはいど」が ふえる→★の かず。じかんで きえる・こうばんで ばっきん
export const AUTOAIM_MAX = 70; export const AUTOAIM_MAX_VEH = 140; // オートAIM・ロックオンが きく さいだい きょり(m): とおすぎる てきには ききません
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
];

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
  { id: 'delivery', name: 'はやく おとどけ!', icon: '📦', brief: 'にもつを うけとって、100びょうい ないに じたくへ とどけよう!', reward: { silver: 1, coins: 90 }, pts: 6, start: hubA(-0.6, 260), pickup: hubA(0.5, 640), time: 100 },
];
export const missionOf = (id) => CITY_MISSIONS.find((m) => m.id === id);
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
export const EQUIP_SLOTS = [['body', '👕 ふく'], ['feet', '👟 くつ'], ['head', '🧢 ぼうし']];
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
  // ぜんぶ(そうび・のりもの・ひこうき)を かうと かえる 「さいきょう」
  { id: 'u_suit', slot: 'body', name: '👑 ちきゅうぼうえい さいきょうスーツ', icon: '👑', price: 300000, hp: 220, def: 0.6, need: { all: true } },
  { id: 'u_boots', slot: 'feet', name: '👑 さいきょう ブースター ブーツ', icon: '🌟', price: 300000, spd: 0.75, need: { all: true } },
  { id: 'u_helm', slot: 'head', name: '👑 さいきょう スカウター ヘルメット', icon: '🌟', price: 300000, aim: 1.0, acc: 0.75, need: { all: true } },
  { id: 'hmask', slot: 'head', name: 'ヒーローマスク', icon: '🦸', price: 105000, aim: 0.7, acc: 0.52, need: { a: 8, m: 6 } },
];
export const equipOf = (id) => EQUIP.find((e) => e.id === id);
export const equipDesc = (e) => [e.hp ? `HP+${e.hp}` : '', e.def ? `ダメージ-${Math.round(e.def * 100)}%` : '', e.spd ? `あしの はやさ+${Math.round(e.spd * 100)}%` : '', e.aim ? `ねらいの はやさ+${Math.round(e.aim * 100)}%` : '', e.acc ? `じゅうの ブレ-${Math.round(e.acc * 100)}%` : ''].filter(Boolean).join('・');
export const storeOf = (id) => STORES.find((x) => x.id === id);
// とめる ばしょ(ガレージの わく)
const HX = HOME.cx; const HZ0 = HOME.z0;
const CAR_SLOTS = [-18, -6, 6, 18].flatMap((dx) => [14, 30].map((dz) => [HX + dx, HZ0 + dz])).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
const BIKE_SLOTS = [-15, -9, -3, 3, 9, 15].map((dx) => [HX + dx, HZ0 + 46]);
const AIR_SLOTS = [[AIRFIELD.x0 + 20, ACZ - 28], [AIRFIELD.x0 + 20, ACZ + 28], [AIRFIELD.x0 + 20, ACZ - 56], [AIRFIELD.x0 + 20, ACZ + 56], [AIRFIELD.x0 + 58, ACZ - 42], [AIRFIELD.x0 + 58, ACZ + 42]];
const FIXED = { tank: { kind: 'tank', x: PLAZA.cx + 50, z: PLAZA.cz + 4, yaw: Math.PI / 2 }, ship: { kind: 'ship', x: DOCK.x, z: DOCK.z, yaw: Math.PI / 2 }, plane: { kind: 'plane', x: AIRFIELD.x0 + 24, z: ACZ, yaw: Math.PI / 2 } };
const slotOf = (it, idx) => { if (it.kind === 'bike') { const s = BIKE_SLOTS[idx % BIKE_SLOTS.length]; return { x: s[0], z: s[1], yaw: 0 }; } if (isAir(it.kind)) { const s = AIR_SLOTS[idx % AIR_SLOTS.length]; return { x: s[0], z: s[1], yaw: Math.PI / 2 }; } const s = CAR_SLOTS[idx % CAR_SLOTS.length]; return { x: s[0], z: s[1], yaw: 0 }; };

export function createCity({ stats, vehicles, owned = DEFAULT_OWNED, weapons = DEFAULT_WEAPONS, weapon = 'pistol', rnd = mulberry(5), gentle = false, coins = 0, arrests = {}, ammo = {}, eqOwned = [], equip: eqWorn = {} }) {
  const ks = stats; const FS = footStats(ks);
  const input = { turn: 0, climb: 0, moveX: 0, moveY: 0, aimLock: false, gun: false, boost: false, aimX: 0, aimY: 0 };
  const S = {
    t: 0, ph: 'play', events: [], snd: [], msg: '', msgT: 0, banner: '', bannerT: 0,
    player: { mode: 'foot', x: SPAWN.x, y: 0, z: SPAWN.z, yaw: SPAWN.yaw, pitch: 0, roll: 0, speed: 0, hp: FS.hpMax, hpMax: FS.hpMax, boost: 100, aimRel: 0, aimPitch: 0.05, veh: null, invuln: 0, dead: 0, hurt: 0, coins, wCd: 0, buff: { dmg: 0, speed: 0 }, weapon: 'pistol', noAim: 0, camYaw: SPAWN.yaw, camFree: false, reload: 0, reloadId: null, bloom: 0, chute: false, carry: 0, kos: 0, target: null, missileCd: 0, lastHurt: -99 },
    vehicles: [], civs: [], crooks: [], bullets: [], missiles: [], tracers: [], effects: [], pickups: [], traffic: [], walkers: [], mission: null, done: {}, nearby: null, ui: null, owned: [...new Set([...DEFAULT_OWNED, ...owned])], wOwned: [...new Set([...DEFAULT_WEAPONS, ...weapons])], arrests: { ...arrests }, tracked: null, swing: 0, heat: 0, lv: 0, heatT: 0, fine: 0, melee: 0, jets: [], helis: [], ammo: { ...ammo }, eqOwned: [...new Set(eqOwned.filter((id) => equipOf(id)))], equip: {},
    wanted: [], stats: { coins: 0, arrests: 0, bounty: 0, missions: 0 },
  };
  const P = S.player; let nid = 100; P.weapon = weapon && S.wOwned.includes(weapon) ? weapon : 'pistol';
  for (const [sl] of EQUIP_SLOTS) { const id = eqWorn[sl]; if (id && S.eqOwned.includes(id) && equipOf(id).slot === sl) S.equip[sl] = id; }
  const eqStat = () => { const q = { hp: 0, def: 0, spd: 0, aim: 0, acc: 0 }; for (const id of Object.values(S.equip)) { const e = equipOf(id); if (e) for (const k of Object.keys(q)) q[k] += e[k] || 0; } return q; };
  const applyEq = () => { const q = eqStat(); const hm = FS.hpMax + q.hp; const r = P.hp / (P.hpMax || hm); P.hpMax = hm; P.hp = Math.min(hm, Math.max(1, Math.round(hm * r))); S.eq = q; };
  applyEq(); P.hp = P.hpMax;
  // ---- てはい ----
  // 指名手配: なぐる3かいで★1・うつと 1かいで★3・そのあと けいさつや いっぱんの ひとを うつたびに ★+1(★5が さいだい)
  const raise = (to, why) => { const l0 = S.lv; S.lv = Math.min(5, Math.max(S.lv, to)); S.heat = S.lv; S.fine = HEAT_FINE[S.lv]; if (S.lv > 0) S.heatT = Math.max(S.heatT, HEAT_DUR[S.lv]); if (S.lv > l0) { banner(S.lv >= 5 ? '🚨 ★5 ながい あいだ にげきれ!!' : `🚨 指名手配 ${'⭐'.repeat(S.lv)}!`, 2.6); snd('warn'); ev({ t: 'wanted', lv: S.lv }); } else if (why && S.lv > 0) msg(why, 1.4); };
  const addStar = (why) => raise(S.lv + 1, why);
  const gunHit = (why) => { if (S.lv < 3) raise(3, why); else if (S.t - (S.starT || -9) > 0.25) { S.starT = S.t; addStar(why); } };
  const meleeHit = (why) => { S.melee++; if (S.melee >= 3) { S.melee = 0; raise(1, why); } else msg(`🚨 なぐった(${S.melee}/3)`, 1.2); };
  const clearHeat = (why) => { S.heat = 0; S.lv = 0; S.heatT = 0; S.fine = 0; S.melee = 0; S.jets = []; S.helis = []; S.missiles = S.missiles.filter((m) => !m.enemy); S.crooks = S.crooks.filter((c) => !c.hunter); S.traffic = S.traffic.filter((c) => !c.cop); if (why) msg(why, 3); };
  const hurtWalker = (w, dmg, how) => { if (w.dead > 0) return; w.hp = (w.hp == null ? 40 : w.hp) - dmg; w.scared = 8; if (w.idle) { w.idle = false; w.spd = 1.8; if (S.relocWalker) S.relocWalker(w); } fx('spark', w.x, 1.2, w.z, 4); if (how === 'melee') meleeHit('🚨 いっぱんの ひとを なぐった!'); else gunHit('🚨 いっぱんの ひとを やった!'); if (w.hp <= 0) { w.dead = 14; snd('down'); fx('spark', w.x, 1.5, w.z, 8); } };
  const rayWalker = (from, dv, range, wall) => { let best = null; let ba = 9; for (const w of S.walkers) { if (w.dead > 0) continue; const vx = w.x - from.x; const vy = 1.1 - from.y; const vz = w.z - from.z; const dist = hyp(vx, vy, vz); if (dist > range || dist > wall || dist < 1) continue; const a = Math.acos(clamp((vx * dv.x + vy * dv.y + vz * dv.z) / dist, -1, 1)); if (a < 0.9 / dist + 0.04 && a < ba) { ba = a; best = w; } } return best; };
  const nearestWalker = (maxD, cone, yaw) => { let best = null; let bd = maxD; for (const w of S.walkers) { if (w.dead > 0) continue; const d = hyp(w.x - P.x, w.z - P.z); if (d > bd || Math.abs(angDiff(Math.atan2(w.x - P.x, w.z - P.z), yaw)) > cone) continue; bd = d; best = w; } return best; };
  const spawnHunter = (t) => { for (let i = 0; i < 80; i++) { const rp = roadPoint(R2, 1); const dd = hyp(rp.x - P.x, rp.z - P.z); if (dd < 55 || dd > 200 || insideBuilding(rp.x, rp.z) || inRect(AIRFIELD, rp.x, rp.z) || inRect(HOME, rp.x, rp.z) || isWater(rp.x, rp.z)) continue; const c = spawnCrook(t === 'cop' ? 'cop' : 'bounty', rp.x, rp.z, { wander: 20 }); c.hunter = t; c.alert = true; return true; } return false; };
  const spawnCopCar = () => { const cps = S.carPaths || []; if (!cps.length) return false; for (let i = 0; i < 120; i++) { const cp = cps[Math.floor(rnd() * cps.length)]; const sx = rnd() * cp.cum[cp.cum.length - 1]; const q = S.pathAt(cp, sx); const dd = hyp(q.x - P.x, q.z - P.z); if (dd < 80 || dd > 230) continue; const dir = rnd() < 0.5 ? 1 : -1; const c = { id: ++nid, path: cp, s: sx, dir, off: cp.hw * 0.5 * dir, spd: 16, tone: 0, model: 'police', bike: false, hostile: true, cop: true, hp: 2, x: 0, z: 0, yaw: 0, wait: 0, dead: 0, r: 2.6 }; S.placeOn(c, cp, c.off); S.traffic.push(c); return true; } return false; };
  // ★ごとの おいかけてくる かず: [あるく けいさつ, 賞金かせぎ, パトカー, せんとうき] ★5は ぜんぶで 20
  const HUNT = [[0, 0, 0, 0, 0], [1, 0, 0, 0, 0], [2, 0, 1, 0, 0], [3, 1, 2, 0, 0], [5, 2, 3, 1, 1], [8, 2, 5, 3, 3]]; // [あるく けいさつ, 賞金かせぎ, パトカー, せんとうき, ヘリ] ★5は ぜんぶで 21
  const spawnJet = () => { const a = rnd() * 6.283; const d = 260 + rnd() * 120; const j = { id: ++nid, x: P.x + Math.sin(a) * d, z: P.z + Math.cos(a) * d, y: 42 + rnd() * 20, yaw: a + Math.PI, spd: 46, cd: 1 + rnd() * 2, ph: rnd() * 6, model: 'hawk', air: 'jet', hp: 90, hpMax: 90, rad: 4.2 }; S.jets.push(j); return true; };
  const spawnHeli = () => { const a = rnd() * 6.283; const d = 90 + rnd() * 60; S.helis.push({ id: ++nid, x: P.x + Math.sin(a) * d, z: P.z + Math.cos(a) * d, y: 26, yaw: a + Math.PI, ang: a, cd: 1 + rnd(), burst: 0, ph: rnd() * 6, air: 'heli', hp: 120, hpMax: 120, rad: 4.5 }); return true; };
  const maintainHunters = () => {
    S.crooks = S.crooks.filter((c) => !c.gone); const lv = S.lv; const H = HUNT[lv]; let made = 0;
    for (const [t, n0] of [['cop', H[0]], ['bounty', H[1]]]) { let n = S.crooks.filter((c) => c.hunter === t && c.state !== 'down').length; while (n < n0 && made < 3) { if (!spawnHunter(t)) break; n++; made++; } }
    S.traffic = S.traffic.filter((c) => !(c.cop && c.dead > 1000)); let k = S.traffic.filter((c) => c.cop).length; while (k < H[2] && made < 4 && spawnCopCar()) { k++; made++; }
    if (S.t >= (S.airRespawn || 0)) { while (S.jets.length < H[3]) spawnJet(); while (S.helis.length < H[4]) spawnHeli(); }
  };
  function payFine() {
    if (S.lv <= 0) { msg('いまは 指名手配されて いないよ', 2.4); return { ok: false, why: 'てはい なし' }; } if (S.lv >= 5) { msg('🚨 ★5は ばっきんでは ゆるされない! ながく にげきるしか ない!', 3); return { ok: false, why: '★5' }; } const f = S.fine; if (P.coins < f) { msg(`ばっきん 🪙${f} が たりないよ…`, 2.8); return { ok: false, why: 'コインが たりない' }; }
    P.coins -= f; clearHeat(); snd('win'); banner('🚓 ばっきんを はらった! てはいが きえたよ', 3); ev({ t: 'fine', coins: f }); return { ok: true };
  }
  const am = (id) => { const sp = ammoSpec(weaponOf(id)); if (!sp) return null; if (!S.ammo[id]) S.ammo[id] = { mag: sp.mag, reserve: Math.floor(sp.cap / 2) }; return S.ammo[id]; };
  const startReload = () => { const W = weaponOf(P.weapon); const sp = ammoSpec(W); if (!sp || P.reload > 0 || P.dead > 0) return false; const A = am(W.id); if (A.mag >= sp.mag || A.reserve <= 0) return false; P.reload = sp.reload; P.reloadId = W.id; snd('door'); return true; };
  const progress = () => ({ a: Object.values(S.arrests).filter((n) => n > 0).length, m: Object.values(S.done).reduce((q, n) => q + n, 0) });
  const ultimateProgress = () => { const eq = EQUIP.filter((e) => !(e.need && e.need.all)); const have = eq.filter((e) => S.eqOwned.includes(e.id)).length + VCAT.filter((it) => S.owned.includes(it.id)).length; return { have, total: eq.length + VCAT.length }; };
  const meets = (need) => { if (!need) return true; if (need.all) { const u = ultimateProgress(); if (u.have < u.total) return false; } const pr = progress(); return pr.a >= (need.a || 0) && pr.m >= (need.m || 0); };
  const snd = (n) => { if (S.snd.length < 24) S.snd.push(n); };
  const fx = (kind, x, y, z, r = 8) => { if (S.effects.length < 60) S.effects.push({ kind, x, y, z, r, t: 0, life: kind === 'big' ? 1.2 : 0.7 }); };
  const msg = (t, d = 2.6) => { S.msg = t; S.msgT = d; };
  const banner = (t, d = 2.4) => { S.banner = t; S.bannerT = d; };
  const ev = (e) => S.events.push(e);
  // のりもの(ならべる)
  const HITMAX = { car: 8, bike: 5, tank: 30, ship: 99 };
  const mkVeh = (id, kind, V, home, extra = {}) => ({ hits: 0, hitMax: (V.model === 'truck' ? 12 : HITMAX[kind]) || 99, id, kind, model: V.model || kind, name: V.name || kind, V, x: home.x, y: 0, z: home.z, yaw: home.yaw, pitch: 0, roll: 0, speed: 0, hp: V.hpMax, hpMax: V.hpMax, home: { ...home }, occ: false, away: 0, boost: V.boostMax || 100, ...extra });
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
  const TRAF = ['sedan', 'taxi', 'suv', 'sedan', 'truck', 'taxi', 'sports', 'suv', 'scooter', 'bike', 'sedan', 'pbike'];
  const carP = PATHS.filter((r) => r.cls >= 2).sort((a, b) => b.cum[b.cum.length - 1] - a.cum[a.cum.length - 1]);
  for (let i = 0; i < 40 && carP.length; i++) { const P = carP[i % Math.min(carP.length, 30)]; const dir = i % 2 ? -1 : 1; const model = TRAF[i % TRAF.length]; const hostile = i % 7 === 4; const bike = catalogOf(model) && catalogOf(model).kind === 'bike'; const c = { id: ++nid, path: P, s: R2() * P.cum[P.cum.length - 1], dir, off: P.hw * 0.5 * dir, spd: (hostile ? 17 : 10) + R2() * 6, tone: i, model: hostile ? (bike ? 'bike' : 'sports') : model, bike: !!(hostile ? bike : bike), hostile, hp: hostile ? 2 : 1, x: 0, z: 0, yaw: 0, wait: 0, dead: 0, r: bike ? 1.4 : model === 'truck' ? 3.6 : 2.6 }; place(c, P, c.off); S.traffic.push(c); }
  const carPaths = carP; S.pathAt = pathAt; S.placeOn = place; S.carPaths = carPaths;
  const groundMove = (e, nx, nz, r, water) => {
    const ok = (x, z) => (water ? inRiver(x, z) && x > -466 && x < 466 : !isWater(x, z)); let moved = false;
    if (ok(nx, nz)) { e.x = nx; e.z = nz; moved = true; } else if (ok(nx, e.z)) { e.x = nx; moved = true; } else if (ok(e.x, nz)) { e.z = nz; moved = true; }
    if (!water) pushOut(e, r); return moved;
  };
  const cur = () => (P.veh ? S.vehicles.find((v) => v.id === P.veh) : null);
  const VNAME = { car: '🚗', bike: '🏍️', tank: '🚜', ship: '🚢', plane: '✈️', jet: '🛩️' };

  // ---- ちかくの ものと ボタン ----
  const setNear = () => {
    let best = null; let bd = 1e9; const px = P.x; const pz = P.z;
    const cand = (kind, id, x, z, r, label, extra = {}) => { const d = hyp(px - x, pz - z); if (d < r && d < bd) { bd = d; best = { kind, id, label, d, ...extra }; } };
    if (P.mode === 'foot') {
      for (const c of S.crooks) if (c.state === 'down' && !c.hunter) cand('arrest', c.id, c.x, c.z, 6, `🚔 たいほする${c.wid ? `(けんしょう金 ${bountyOf(c)})` : ''}`);
      for (const v of S.vehicles) if (!v.occ) cand('veh', v.id, v.x, v.z, v.kind === 'ship' ? 26 : 12, `${VNAME[v.kind] || '🚗'} ${v.name || ''}に のる`);
      for (const t of S.traffic) if (!t.dead && !t.hostile) cand('tcar', t.id, t.x, t.z, 7, t.denied ? '🚨 むりやり うばう(どろぼうに なるよ!)' : '🚗 うんてんしゅに たのむ(くるまを かりる)');
      for (const c of S.civs) if (c.state === 'need') cand('civ', c.id, c.x, c.z, 9, '🆘 ひとを たすける');
    } else cand('exit', 'exit', px, pz, 999, cur() && isAir(cur().kind) && P.y > 12 ? '🪂 パラシュートで おりる' : '🚪 おりる');
    for (const st of STORES) cand('store', st.id, st.x, st.z, 11, `${st.icon} ${st.name}(${st.sub})`);
    cand('soccer', 'soccer', SOCCER.x, SOCCER.z, 18, '⚽ サッカーじょうへ いく');
    cand('koban', 'koban', KOBAN.x, KOBAN.z, 12, S.lv >= 5 ? '🚓 こうばん(★5は ばっきん できない! にげきれ)' : S.lv > 0 ? `🚓 こうばん(ばっきん 🪙${S.fine} で 指名手配が きえる)` : '🚓 こうばん');
    cand('board', 'board', BOARD.x, BOARD.z, 11, '📋 指名手配ボードを みる');
    cand('garage', 'garage', GARAGE.x, GARAGE.z, 14, '🏠 じたく(ガレージ)');
    cand('job', 'job', JOB.x, JOB.z, 12, '💼 おしごと(綱島東小学校)'); if (CM.polyIn && CM.polyIn(SCHOOL_POLY, px, pz)) cand('job', 'job', px, pz, 9999, '💼 おしごと(がっこうに はいったよ)');
    if (!S.mission) for (const m of CITY_MISSIONS) cand('mission', m.id, m.start.x, m.start.z, 14, `${m.icon} ミッション「${m.name}」`);
    if (S.mission && S.mission.id === 'delivery' && S.mission.stage === 0) cand('pack', 'pack', S.mission.pk.x, S.mission.pk.z, 14, '📦 にもつを うけとる');
    S.nearby = best;
  };
  const enter = (v) => {
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
    const T = CROOKS[type]; const hp = Math.round(T.hp * (o.hpMul || 1));
    const c = { id: ++nid, type, x, z, yaw: rnd() * 6.28, hp, hpMax: hp, cd: 1 + rnd(), homeX: x, homeZ: z, wander: o.wander || 36, state: 'idle', t: 0, downT: 0, mission: !!o.mission, wid: o.wid || null, speed: T.speed, ph: rnd() * 6, alert: false, look: Math.floor(rnd() * 8), flee: 0 };
    S.crooks.push(c); return c;
  }
  const bountyOf = (c) => { if (c.wid) { const w = WANTED.find((x) => x.id === c.wid); const n = S.arrests[c.wid] || 0; return Math.round(w.bounty * (n === 0 ? 1 : 0.5)); } return c.minor ? 40 : 0; };
  const spawnWanted = (w) => {
    spawnCrook(w.type, w.spot.x, w.spot.z, { wid: w.id, wander: 30, hpMul: 1 });
    for (let i = 0; i < w.guards; i++) { const a = (i / w.guards) * 6.28; spawnCrook(w.stars >= 4 && i < 2 ? 'gunman' : 'thug', w.spot.x + Math.cos(a) * 22, w.spot.z + Math.sin(a) * 22, { wander: 30, hpMul: 1, guardOf: w.id }); }
  };
  const respawnAt = {}; for (const w of WANTED) spawnWanted(w);
  const refreshWanted = () => { S.wanted = WANTED.map((w) => { const c = S.crooks.find((x) => x.wid === w.id); return { id: w.id, name: w.name, crime: w.crime, stars: w.stars, bounty: Math.round(w.bounty * ((S.arrests[w.id] || 0) === 0 ? 1 : 0.5)), alive: !!c, x: c ? c.x : null, z: c ? c.z : null, caught: S.arrests[w.id] || 0, state: c ? c.state : 'gone' }; }); };
  refreshWanted();
  const downCrook = (c) => { { const sp = ammoSpec(weaponOf(P.weapon)); const A = sp && am(P.weapon); if (A) A.reserve = Math.min(sp.cap, A.reserve + Math.ceil(sp.mag * 0.5)); } c.state = 'down'; c.downT = 0; c.hp = Math.max(1, Math.round(c.hpMax * 0.2)); snd('down'); fx('spark', c.x, 3, c.z, 5); };
  const hitAir = (u, dmg) => {
    u.hp -= dmg; u.flash = 0.12; gunHit('🚨 けいさつの のりものを うった!'); fx('spark', u.x, u.y, u.z, 3);
    if (u.hp <= 0) { fx('big', u.x, u.y, u.z, 16); snd('bigboom'); const jet = u.air === 'jet'; const reward = jet ? 350 : 250; P.coins += reward; S.stats.coins += reward; S.airRespawn = S.t + 14; S.helis = S.helis.filter((x) => x !== u); S.jets = S.jets.filter((x) => x !== u); msg(`${jet ? '✈️ せんとうき' : '🚁 ヘリ'}を おとした! 🪙+${reward}`, 2.6); ev({ t: 'airkill', jet }); }
  };
  const hitCrook = (c, dmg) => { if (c.air) { hitAir(c, dmg); return; } if (c.state === 'down') return; if (c.hunter) gunHit('🚨 けいさつを うった!'); c.hp -= dmg; c.alert = true; if (c.hp <= c.hpMax * 0.22) downCrook(c); };
  const arrest = (c) => {
    S.crooks = S.crooks.filter((x) => x !== c); P.kos++; S.stats.arrests++; snd('win'); fx('spark', c.x, 3, c.z, 6);
    const coins = bountyOf(c); P.coins += coins; S.stats.coins += coins; S.stats.bounty += coins;
    if (c.wid) { const w = WANTED.find((x) => x.id === c.wid); const first = (S.arrests[c.wid] || 0) === 0; S.arrests[c.wid] = (S.arrests[c.wid] || 0) + 1; respawnAt[c.wid] = S.t + 120; const tk = {}; if (first) { if (w.stars >= 5) tk.gold = 2; else if (w.stars >= 4) tk.gold = 1; else if (w.stars >= 3) tk.silver = 1; else if (w.stars >= 2) tk.bronze = 1; }
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
    P.dead = 2.8; const wasHot = S.lv > 0; const lose = Math.min(P.coins, Math.max(0, Math.round(P.coins * (wasHot ? 0.5 : 0.1)))); if (wasHot) clearHeat(); P.coins -= lose; fx('boom', P.x, 3, P.z, 10); snd('lose');
    banner('😵 ノックアウト! じたくで ふっかつ', 3); msg(wasHot ? `つかまって ばっきん! コインが はんぶん(${lose}こ)になったよ` : lose ? `コインを ${lose}こ おとしたよ` : 'だいじょうぶ! もういちど!', 3);
    if (P.veh) { const v = cur(); if (v) { v.occ = false; } P.veh = null; P.mode = 'foot'; }
  };
  const respawn = () => { if (S.mission && S.mission.id === 'delivery' && S.mission.stage === 1) { cancelMission(); msg('📦 にもつを おとしちゃった…', 2.4); } P.dead = 0; P.hp = P.hpMax; P.x = SPAWN.x; P.z = SPAWN.z; P.y = 0; P.yaw = 0; P.speed = 0; P.mode = 'foot'; P.invuln = 3; P.chute = false; P.carry = 0; for (const c of S.civs) if (c.state === 'carried') { c.state = 'need'; c.x = c.home.x; c.z = c.home.z; } };

  // ---- ねらい ----
  const nearestCrook = (maxD, cone, yaw, air = true, minD = 3) => {
    let best = null; let bd = maxD; for (const r of air ? [...S.crooks, ...S.helis, ...S.jets] : S.crooks) { if (r.state === 'down') continue; const d = hyp(r.x - P.x, r.z - P.z); if (d > bd || d < (r.air ? Math.max(minD, 14) : minD)) continue; const a = Math.abs(angDiff(Math.atan2(r.x - P.x, r.z - P.z), yaw)); if (a > cone) continue; bd = d; best = r; } return best;
  };
  const aimDir = () => {
    const v = cur(); const kind = v ? v.kind : 'foot';
    if (isAir(kind)) return { yaw: v.yaw, pitch: v.pitch, from: { x: v.x, y: v.y - 1, z: v.z } };
    const ay = kind === 'foot' ? P.camYaw : P.yaw + P.aimRel;
    return { yaw: ay, pitch: P.aimPitch, from: { x: P.x, y: (kind === 'foot' ? 1.6 : kind === 'ship' ? 8 : kind === 'tank' ? 4 : 1.8) + P.y, z: P.z } };
  };
  // たまは たてものを とおりぬけない(さいしょに あたる たてものまでの きょり)
  const wallDist = (from, dv, maxD) => { for (let d = 2; d < maxD; d += 1.6) { const x = from.x + dv.x * d; const y = from.y + dv.y * d; const z = from.z + dv.z * d; if (y < 0) return d; if (insideBuilding(x, z, y)) return d; } return maxD + 1; };
  const rayCrook = (from, yaw, pitch, range) => {
    const dv = dirOf(yaw, pitch); let best = null; let ba = 9; const wall = wallDist(from, dv, range);
    for (const r of [...S.crooks, ...S.helis, ...S.jets]) {
      if (r.state === 'down') continue; const vx = r.x - from.x; const vy = (r.y != null ? r.y : 1.6) - from.y; const vz = r.z - from.z; const dist = hyp(vx, vy, vz); if (dist > range || (!r.air && dist > wall)) continue;
      const a = Math.acos(clamp((vx * dv.x + vy * dv.y + vz * dv.z) / (dist || 1), -1, 1)); const tol = ((r.rad || (r.type === 'boss' ? 3 : 2)) / dist + 0.05) * (gentle ? 1.5 : 1); if (a < tol && a < ba) { ba = a; best = r; }
    }
    return { best, dv, wall };
  };
  const fireFoot = () => {
    const W = weaponOf(P.weapon) || weaponOf('fist'); if (P.wCd > 0) return; const sho = (1 + ks.SHO / 500) * (P.buff.dmg > 0 ? 1.4 : 1); const yaw0 = P.camYaw;
    if (!W.melee && P.noAim > 0.35) { const t = nearestCrook(Math.min(W.range, AUTOAIM_MAX), 0.7, yaw0); if (t) { P.camYaw += clamp(angDiff(Math.atan2(t.x - P.x, t.z - P.z), yaw0) * 0.45, -0.2, 0.2); P.aimPitch = clamp(Math.atan2((t.y != null ? t.y : 2.5) - 1.6, hyp(t.x - P.x, t.z - P.z)), -0.2, t.y != null ? 1.1 : 0.4); } }
    const asp = ammoSpec(W); if (asp) { const A = am(W.id); if (P.reload > 0) return; if (A.mag <= 0) { if (A.reserve > 0) startReload(); else if (S.t - (P.dryT || -9) > 1.2) { P.dryT = S.t; snd('warn'); msg('たまが ない! 「おみせ」で たまを かおう(🔫)', 2.2); } return; } A.mag--; }
    P.wCd = 1 / W.rate; const d = aimDir();
    if (W.melee) { S.swing = 0.25; snd('hit'); const t = nearestCrook(W.range + 1.2, 1.2, d.yaw, false, 0); if (t) { hitCrook(t, W.dmg * sho); fx('spark', t.x, 2, t.z, 4); } else { const ww = nearestWalker(W.range + 1.2, 1.2, d.yaw); if (ww) hurtWalker(ww, W.dmg * sho, 'melee'); } return; }
    if (W.expl) {
      const t = W.homing ? nearestCrook(W.range, 0.8, d.yaw) : null; const dv = dirOf(d.yaw, d.pitch + (W.lob || 0)); const sp = W.speed || 80;
      S.missiles.push({ x: d.from.x + dv.x * 1.5, y: d.from.y, z: d.from.z + dv.z * 1.5, vx: dv.x * sp, vy: dv.y * sp, vz: dv.z * sp, target: t ? t.id : null, t: 0, life: Math.max(1.2, W.range / sp + 1), dmg: W.dmg * sho, g: W.g || 0 }); snd(W.snd); return;
    }
    const n = W.pellets || 1; let hit = null; let last = null; let lastWall = 999;
    const mvPen = P.moving ? (W.cat === 'スナイパー' ? 4 : 1.5) : 1; const jj = (W.spread || 0) * (1 + P.bloom) * mvPen * (input.aimLock ? 0.7 : 1) * (1 - S.eq.acc);
    for (let i = 0; i < n; i++) { const r = rayCrook(d.from, d.yaw + (rnd() - 0.5) * 2 * jj, d.pitch + (rnd() - 0.5) * 2 * jj, W.range); last = r.dv; lastWall = r.wall; if (r.best) { const dd = hyp(r.best.x - d.from.x, r.best.z - d.from.z); const fall = asp ? asp.fall : 0; hitCrook(r.best, W.dmg * sho * (1 - fall * Math.min(1, dd / W.range))); hit = r.best; } else { const ww = rayWalker(d.from, r.dv, W.range, r.wall); if (ww) { hurtWalker(ww, W.dmg * sho * (1 - (asp ? asp.fall : 0) * 0.5), 'gun'); hit = ww; } } }
    if (asp) { P.bloom = Math.min(3, P.bloom + asp.recoil * (W.rate > 5 ? 10 : 6)); P.aimPitch = clamp(P.aimPitch + asp.recoil * (0.7 + rnd() * 0.6), -0.35, 1.1); if (P.camFree) P.camYaw += (rnd() - 0.5) * asp.recoil * 0.8; }
    const wl = Math.min(90, lastWall - 1); S.tracers.push({ from: d.from, to: hit ? { x: hit.x, y: hit.y != null ? hit.y : 1.6, z: hit.z } : { x: d.from.x + last.x * wl, y: d.from.y + last.y * wl, z: d.from.z + last.z * wl }, t: 0 }); if (!hit && lastWall < 90) fx('spark', d.from.x + last.x * lastWall, Math.max(0.5, d.from.y + last.y * lastWall), d.from.z + last.z * lastWall, 3); snd(W.snd || 'gun');
  };
  const fireGun = (dt) => {
    if (!cur()) return fireFoot();
    const v = cur(); const kind = v ? v.kind : 'foot'; const dps = v ? v.V.gunDps : FS.gunDps; if (!dps) { if (S.t - (P.nogunT || -9) > 3) { P.nogunT = S.t; msg('この のりものには ぶきが ないよ'); } return; }
    const air = isAir(kind); const range = air ? 650 : kind === 'ship' ? 800 : kind === 'tank' ? 600 : kind === 'car' || kind === 'bike' ? 140 : FS.range;
    if ((kind === 'foot' || kind === 'car' || kind === 'bike') && P.noAim > 0.8) { const yaw0 = v ? v.yaw : P.yaw; const t = nearestCrook(range, 0.9, yaw0); if (t) { P.aimRel = clamp(angDiff(Math.atan2(t.x - P.x, t.z - P.z), yaw0), -1.5, 1.5); P.aimPitch = clamp(Math.atan2(2.5 - (kind === 'foot' ? 1.6 : 2), Math.hypot(t.x - P.x, t.z - P.z)), -0.2, 0.4); } }
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
    if (P.chute) { P.y = Math.max(0, P.y - 7 * dt); P.yaw += input.turn * 0.6 * dt; P.x += Math.sin(P.yaw) * input.climb * 6 * dt; P.z += Math.cos(P.yaw) * input.climb * 6 * dt; if (isWater(P.x, P.z)) { P.x = HQ.x; P.z = HQ.z - 40; } pushOut(P, 1.2); if (P.y <= 0.01) P.chute = false; return; }
    if (!v) {
      const mx = input.moveX || 0; const my = input.moveY || 0; const mag = Math.min(1, Math.hypot(mx, my)); if (P.tired && P.boost >= 30) P.tired = false; const dash = (boost || mag >= 0.85) && !P.tired && P.boost > 0; const sp = (dash ? FS.run : FS.speed) * (P.buff.speed > 0 ? 1.3 : 1) * (1 + S.eq.spd); // スティックを ふかく たおすと ダッシュ
      if (mag > 0.08) { // スマホ ふうの そうさ: スティックの むきに カメラを きじゅんに あるく
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
    const max = V.speed * (bo ? 1.5 : 1); const want = input.climb >= 0 ? input.climb * max : input.climb * max * 0.4;
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
  function stepCrooks(dt) {
    for (const r of S.crooks) {
      r.t += dt; const T = CROOKS[r.type];
      if (r.state === 'down') { r.downT += dt; if (r.hunter) { if (r.downT > 5) r.gone = true; continue; } if (r.downT > 26) { r.state = 'flee'; r.flee = 18; r.hp = Math.round(r.hpMax * 0.55); } continue; }
      if (r.state === 'flee') { r.flee -= dt; const away = Math.atan2(r.x - P.x, r.z - P.z); r.yaw += clamp(angDiff(away, r.yaw), -3 * dt, 3 * dt); groundMove(r, r.x + Math.sin(r.yaw) * T.speed * 1.4 * dt, r.z + Math.cos(r.yaw) * T.speed * 1.4 * dt, 1.4, false); if (r.flee <= 0) { r.state = 'idle'; r.alert = true; } continue; }
      const dp = hyp(r.x - P.x, r.z - P.z); if (r.hunter && dp > 260) { const rp = roadPoint(R2, 1); const d2 = hyp(rp.x - P.x, rp.z - P.z); if (d2 > 60 && d2 < 140 && !insideBuilding(rp.x, rp.z)) { r.x = rp.x; r.z = rp.z; } }
      const hunt = P.dead <= 0 && (dp < 80 || r.alert);
      if (r.type === 'runner') { // ひったくりは にげる
        if (dp < 110) { const away = Math.atan2(r.x - P.x, r.z - P.z); r.yaw += clamp(angDiff(away, r.yaw), -3.2 * dt, 3.2 * dt); groundMove(r, r.x + Math.sin(r.yaw) * T.speed * dt, r.z + Math.cos(r.yaw) * T.speed * dt, 1.4, false); } else { r.yaw += (rnd() - 0.5) * dt; groundMove(r, r.x + Math.sin(r.yaw) * 2 * dt, r.z + Math.cos(r.yaw) * 2 * dt, 1.4, false); }
        continue;
      }
      if (hunt) {
        const want = Math.atan2(P.x - r.x, P.z - r.z); r.yaw += clamp(angDiff(want, r.yaw), -3 * dt, 3 * dt); if (dp > 22) groundMove(r, r.x + Math.sin(r.yaw) * r.speed * dt, r.z + Math.cos(r.yaw) * r.speed * dt, 1.4, false); r.cd -= dt;
        if (r.cd <= 0 && dp < T.range) { r.cd = T.fire + rnd() * 0.5; const sx = (rnd() - 0.5) * 0.14; const vx = Math.sin(r.yaw + sx); const vz = Math.cos(r.yaw + sx); const vcur = cur(); const ty = vcur && isAir(vcur.kind) ? P.y : 1.4; const dy = (ty - 1.6) / Math.max(10, dp); S.bullets.push({ x: r.x, y: 1.6, z: r.z, vx: vx * 62, vy: dy * 62, vz: vz * 62, t: 0, dmg: T.dmg }); snd('cshot'); }
      } else { const home = hyp(r.homeX - r.x, r.homeZ - r.z); if (r.t % 4 < dt || home > r.wander) r.goal = { x: r.homeX + (rnd() - 0.5) * r.wander, z: r.homeZ + (rnd() - 0.5) * r.wander }; if (r.goal) { const want = Math.atan2(r.goal.x - r.x, r.goal.z - r.z); r.yaw += clamp(angDiff(want, r.yaw), -2 * dt, 2 * dt); if (hyp(r.goal.x - r.x, r.goal.z - r.z) > 3) groundMove(r, r.x + Math.sin(r.yaw) * r.speed * 0.4 * dt, r.z + Math.cos(r.yaw) * r.speed * 0.4 * dt, 1.4, false); } }
    }
    for (const b of S.bullets) {
      b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      if (insideBuilding(b.x, b.z, b.y)) { b.t = 99; continue; }
      if (P.dead <= 0) { const v = cur(); const py = v ? (isAir(v.kind) ? P.y : 1.8) : 1.2; const rad = v ? (v.kind === 'ship' ? 14 : v.kind === 'tank' ? 7 : isAir(v.kind) ? 8 : v.kind === 'bike' ? 2.2 : 3.2) : 1.4; if (hyp(b.x - P.x, b.z - P.z) < rad && Math.abs(b.y - py) < rad + 2) { hurtPlayer(b.dmg); b.t = 99; fx('spark', b.x, b.y, b.z, 3); } }
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
    for (const p of S.pickups.slice()) if (hyp(p.x - P.x, p.z - P.z) < (P.mode === 'veh' ? 7 : 3) && (P.y < 12 || P.mode === 'foot')) { S.pickups = S.pickups.filter((x) => x !== p); if (p.kind === 'gem') { ev({ t: 'gem', v: 1 }); snd('gem'); msg('💎 ほうせきを みつけた!', 2); P.coins += p.v; S.stats.coins += p.v; } else { P.coins += p.v; S.stats.coins += p.v; snd('coin'); } }
    S.relocT = (S.relocT || 0) + dt; const fire = P.mode === 'foot' && (input.gun || P.wCd > 0.1) && (weaponOf(P.weapon) || {}).range > 5;
    for (const w of S.walkers) { if (w.dead > 0) { w.dead -= dt; if (w.dead <= 0) { w.hp = 40; w.idle = false; w.scared = 0; if (!(S.relocWalker && S.relocWalker(w))) w.dead = 3; } continue; } if (w.idle) { if (fire && hyp(w.x - P.x, w.z - P.z) < 30) { w.idle = false; w.scared = 6; w.relocFlee = true; if (S.relocWalker) S.relocWalker(w); w.spd = 1.8; } continue; } if (!w.path) continue;
      if (S.relocT > 0.4 && hyp(w.x - P.x, w.z - P.z) > 300) { if (S.relocWalker(w)) { S.relocT = 0; } }
      if (fire && hyp(w.x - P.x, w.z - P.z) < 40 && !(w.scared > 0)) { w.scared = 5; const q = S.pathAt(w.path, w.s + 1); const q0 = S.pathAt(w.path, w.s); const tx = q.x - q0.x; const tz = q.z - q0.z; w.dir = (tx * (w.x - P.x) + tz * (w.z - P.z)) >= 0 ? 1 : -1; } w.s += w.dir * w.spd * dt * (w.scared > 0 ? 3 : 1); if (w.scared > 0) w.scared -= dt; const L = w.path.cum[w.path.cum.length - 1]; if (w.s > L) { w.s = L; w.dir = -1; } if (w.s < 0) { w.s = 0; w.dir = 1; } S.placeOn(w, w.path, w.off); if (isWater(w.x, w.z)) w.dir *= -1; }
    S.trafT = (S.trafT || 0) + dt; if (S.trafT > 0.6) { S.trafT = 0; const cps = S.carPaths || []; const far = S.traffic.find((c) => !c.cop && !(c.dead > 0) && hyp(c.x - P.x, c.z - P.z) > 340); if (far && cps.length) for (let t = 0; t < 40; t++) { const cp = cps[Math.floor(rnd() * cps.length)]; const sx = rnd() * cp.cum[cp.cum.length - 1]; const q = S.pathAt(cp, sx); const dd = hyp(q.x - P.x, q.z - P.z); if (dd < 90 || dd > 280 || inRect(AIRFIELD, q.x, q.z) || inRect(HOME, q.x, q.z)) continue; far.path = cp; far.s = sx; far.dir = rnd() < 0.5 ? 1 : -1; far.off = cp.hw * 0.5 * far.dir; S.placeOn(far, cp, far.off); break; } }
    const pv = cur();
    for (const c of S.traffic) {
      if (c.dead > 0) { c.dead -= dt; c.hidden = true; if (c.dead <= 0) { const cp = carPaths[Math.floor(rnd() * carPaths.length)]; if (cp) { c.path = cp; c.s = rnd() * cp.cum[cp.cum.length - 1]; c.dir = rnd() < 0.5 ? 1 : -1; c.off = cp.hw * 0.5 * c.dir; c.hp = c.hostile ? 2 : 1; c.hidden = false; S.placeOn(c, cp, c.off); } } continue; }
      const L = c.path.cum[c.path.cum.length - 1]; const ahead = S.pathAt(c.path, c.s + c.dir * 9); const px = ahead.x - Math.sin(ahead.ang) * c.off; const pz = ahead.z + Math.cos(ahead.ang) * c.off; let blocked = false; // じぶんの レーンの すこし さき(たいこうしゃと ぶつからない)
      if (!c.hostile && hyp(px - P.x, pz - P.z) < 7) blocked = true; for (const o of S.traffic) if (o !== c && !o.dead && hyp(px - o.x, pz - o.z) < 5) blocked = true; if (isWater(px, pz) || inRect(AIRFIELD, px, pz) || inRect(HOME, px, pz)) { c.dir *= -1; c.off = c.path.hw * 0.5 * c.dir; blocked = false; }
      if (c.ghost > 0) { c.ghost -= dt; blocked = false; } c.wait = blocked ? Math.min(2, c.wait + dt) : 0; if (c.wait >= 2) c.ghost = 2.5; // 2びょう まって うごけない ときは すりぬけて すすむ(こうさてんの こうちゃく ぼうし)
       if (c.stun > 0) { c.stun -= dt; blocked = true; } const sp = c.spd * (c.hostile && hyp(c.x - P.x, c.z - P.z) < 90 ? 1.7 : 1); if (!blocked) c.s += c.dir * sp * dt; if (c.s > L) { c.s = L; c.dir = -1; c.off = c.path.hw * 0.5 * c.dir; } if (c.s < 0) { c.s = 0; c.dir = 1; c.off = c.path.hw * 0.5 * c.dir; } S.placeOn(c, c.path, c.off);
      // のりものが ぶつかる(いっぱんの くるま・バイク・指名手配はんの くるま)
      if (pv && !isAir(pv.kind) && pv.kind !== 'ship' && P.dead <= 0 && hyp(c.x - pv.x, c.z - pv.z) < c.r + (pv.kind === 'tank' ? 6 : pv.kind === 'bike' ? 1.6 : 3.2) && S.t - (c.hitT || -9) > 1.1) {
        c.hitT = S.t; const sp0 = Math.abs(pv.speed); const tank = pv.kind === 'tank'; const dmg = clamp(6 + sp0 * 0.6 + (c.hostile ? 9 : 0), 6, 70) * (tank ? 0.15 : 1);
        c.stun = 2.5; fx('spark', (c.x + pv.x) / 2, 1.5, (c.z + pv.z) / 2, 6); snd('bump'); const ox = pv.x - c.x; const oz = pv.z - c.z; const od = hyp(ox, oz) || 1; pv.x += (ox / od) * 2.2; pv.z += (oz / od) * 2.2; pv.speed *= tank ? 0.8 : -0.25;
        if (!tank) { pv.hits = (pv.hits || 0) + 1; hurtPlayer(dmg); if (pv.hits >= pv.hitMax - 1 && pv.hits < pv.hitMax && S.t - (pv.warnT || -9) > 2) { pv.warnT = S.t; msg('💥 こわれそう! もう すこしで ばくはつ!', 2.4); } if (pv.hits >= pv.hitMax && P.dead <= 0 && P.mode === 'veh') { P.invuln = 0; hurtPlayer(99999); } else msg(`💥 ぶつかった! (${pv.hits}/${pv.hitMax}かい で こわれる)`, 1.6); }
        if (!c.hostile && c.hp - (tank ? 99 : 1) <= 0) raise(1, '🚨 くるまを こわした!'); c.hp -= tank ? 99 : 1; if (c.hp <= 0) { c.dead = c.cop ? 99999 : 12; fx('big', c.x, 2, c.z, 10); snd('bigboom'); if (c.cop) { addStar('🚨 パトカーを こわした!'); } else if (c.hostile) { P.coins += 120; S.stats.coins += 120; msg('🚔 指名手配はんの のりものを たおした! 🪙+120', 3); ev({ t: 'crash', hostile: true }); } }
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
    if (!S.mission && S.t > 20 && S.t - (S.lastRaid || -999) > 75 && !S.crooks.some((c) => c.minor)) { S.lastRaid = S.t; for (let tr = 0; tr < 80; tr++) { const rp = roadPoint(rnd, 1); const dd = hyp(rp.x - P.x, rp.z - P.z); if (dd > 70 && dd < 220 && isRoad(rp.x, rp.z) && !insideBuilding(rp.x, rp.z)) { const c = spawnCrook('runner', rp.x, rp.z, { wander: 40 }); c.minor = true; banner('⚠ ひったくりが にげてる! つかまえて!', 2.6); snd('warn'); break; } } }
    for (const c of S.crooks.slice()) if (c.minor && hyp(c.x - P.x, c.z - P.z) > 420) S.crooks = S.crooks.filter((x) => x !== c);
    for (const v of S.vehicles.slice()) { if (v.occ) continue; const d = hyp(v.x - P.x, v.z - P.z); if (v.temp) { v.idle = (v.idle || 0) + dt; if (v.idle > 40) { S.vehicles = S.vehicles.filter((x) => x !== v); continue; } } else if (d > 120 && hyp(v.x - v.home.x, v.z - v.home.z) > 3) { v.away += dt; if (v.away > 30) { v.x = v.home.x; v.z = v.home.z; v.y = 0; v.yaw = v.home.yaw; v.speed = 0; v.away = 0; } } else v.away = 0; v.speed *= Math.exp(-2 * dt); if (isAir(v.kind) && !v.occ) { v.y = 0; if (!v.temp) { v.x = v.home.x; v.z = v.home.z; } } }
    // じたくの かいふく・ほじゅうは 「あんぜんな とき」だけ(指名手配ちゅう・6びょうい ないに ダメージを うけた ときは つかえない=じたくで ずっと たたかえない)
    const homeSafe = S.lv <= 0 && S.t - (P.lastHurt == null ? -99 : P.lastHurt) > 6; const atHome = P.mode === 'foot' && hyp(P.x - GARAGE.x, P.z - GARAGE.z) < 24 && P.dead <= 0;
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
    } else if (M.id === 'gang') { M.got = M.total - S.crooks.filter((c) => c.mission).length; if (!S.crooks.some((c) => c.mission)) endMission(true); }
    else if (M.id === 'delivery') { if (M.stage === 1) { M.timeLeft -= dt; if (hyp(px - BASE.x, pz - BASE.z) < BASE.r) { endMission(true); return; } if (M.timeLeft <= 0) endMission(false, 'じかんぎれ! もういちど ちょうせん'); } }
  }
  function interact() {
    if (P.dead > 0) return false; const n = S.nearby; if (!n) return false;
    if (n.kind === 'veh') { const v = S.vehicles.find((x) => x.id === n.id); if (v && !v.occ) { enter(v); return true; } }
    else if (n.kind === 'tcar') { const t = S.traffic.find((x) => x.id === n.id); if (t) {
      if (!t.asked) { t.asked = true; t.ok = rnd() < 0.5; if (!t.ok) { t.denied = true; msg('運転手「だめ!」…むりやり のると どろぼうだよ', 3); snd('warn'); return true; } msg('運転手「いいよ! だいじに のってね」', 2.4); }
      else if (t.denied) raise(1, '🚨 くるまを ぬすんだ! どろぼう!');
      const it = catalogOf(t.model) || catalogOf('sedan'); const v = mkVeh(`tmp${++nid}`, it.kind, catalogV(it, ks), { x: t.x, z: t.z, yaw: t.yaw }, { temp: true, cat: it.id }); S.vehicles.push(v); S.traffic = S.traffic.filter((x) => x !== t); S.walkers.push({ id: ++nid, x: t.x + 3, z: t.z, yaw: t.yaw + 1.6, vert: t.vert, line: t.vert ? t.line + 4 : t.line, dir: 1, spd: 2.5, scared: 6, look: nid }); enter(v); if (t.denied) msg('🚨 くるまを うばった!', 2.5); return true; } }
    else if (n.kind === 'exit') { leave(); return true; }
    else if (n.kind === 'store') { S.ui = 'store'; ev({ t: 'store', id: n.id }); return true; }
    else if (n.kind === 'soccer') { ev({ t: 'soccer' }); return true; }
    else if (n.kind === 'koban') { payFine(); return true; }
    else if (n.kind === 'board') { refreshWanted(); S.ui = 'board'; ev({ t: 'board' }); return true; }
    else if (n.kind === 'garage') { S.ui = 'garage'; ev({ t: 'garage' }); return true; }
    else if (n.kind === 'job') { S.ui = 'job'; ev({ t: 'job' }); return true; }
    else if (n.kind === 'mission') return startMission(n.id);
    else if (n.kind === 'arrest') { const c = S.crooks.find((x) => x.id === n.id); if (c && c.state === 'down') { arrest(c); return true; } }
    else if (n.kind === 'civ') { const c = S.civs.find((x) => x.id === n.id); if (c) { c.state = 'carried'; P.carry++; snd('coin'); msg('いっしょに じたくまで いこう!', 2); return true; } }
    else if (n.kind === 'pack') { const M = S.mission; if (M) { M.stage = 1; M.targets = [{ x: BASE.x, z: BASE.z }]; msg('📦 うけとった! じたくへ ダッシュ!', 2.4); snd('coin'); return true; } }
    return false;
  }
  function buy(id) {
    const it = ITEMS.find((x) => x.id === id); if (!it) return { ok: false, why: 'ない' }; if (P.coins < it.cost) return { ok: false, why: 'コインが たりないよ' };
    if (id === 'heal' || id === 'snack' || id === 'ramen') { if (P.hp >= P.hpMax) return { ok: false, why: 'もう げんきだよ' }; P.coins -= it.cost; P.hp = id === 'snack' ? Math.min(P.hpMax, P.hp + P.hpMax * 0.35) : P.hpMax; if (id === 'ramen') P.buff.dmg = 45; snd('win'); return { ok: true }; }
    if (id === 'drink') { P.coins -= it.cost; P.buff.dmg = 60; snd('win'); msg('💪 60びょう こうげきが つよく なったよ!', 2.4); return { ok: true }; }
    if (id === 'ammo') { P.coins -= it.cost; for (const wid of S.wOwned) { const sp = ammoSpec(weaponOf(wid)); if (sp) { const A = am(wid); A.reserve = sp.cap; } } snd('win'); msg('📦 たまを ぜんぶ ほじゅうしたよ!', 2.4); return { ok: true }; }
    if (id === 'sneak') { P.coins -= it.cost; P.buff.speed = 60; snd('win'); msg('👟 60びょう あしが はやく なったよ!', 2.4); return { ok: true }; }
    P.coins -= it.cost; ev({ t: 'buy', id }); return { ok: true };
  }
  function buyVehicle(id) {
    const it = catalogOf(id); if (!it) return { ok: false, why: 'ない' }; if (S.owned.includes(id)) return { ok: false, why: 'もう もってるよ' }; if (!meets(it.need)) return { ok: false, why: `まだ かえないよ(${needText(it.need)})` }; if (P.coins < it.price) return { ok: false, why: 'コインが たりないよ' };
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
  function fastTravel() {
    if (P.dead > 0) return { ok: false, why: '' }; if (S.lv >= 5) return { ok: false, why: '🚨 ★5は にげられない!' }; const v = cur(); if (v && isAir(v.kind) && P.y > 12) return { ok: false, why: 'そらでは つかえないよ' };
    if (v) leave(); P.chute = false; P.x = GARAGE.x; P.z = GARAGE.z + 10; P.y = 0; P.speed = 0; P.yaw = Math.PI; fx('spark', P.x, 2, P.z, 8); snd('door'); msg('🏁 ガレージに ワープしたよ!', 2.2); return { ok: true };
  }
  function summon(id) {
    const v = S.vehicles.find((x) => x.id === id && !x.temp); if (!v) return { ok: false, why: 'ないよ' }; if (v.kind === 'ship') return { ok: false, why: 'ふねは みなとに あるよ' };
    if (P.dead > 0) return { ok: false, why: '' }; if (cur() && cur() !== v) { if (isAir(cur().kind) && P.y > 12) return { ok: false, why: 'そらでは つかえないよ' }; leave(); }
    v.occ = false; v.x = GARAGE.x - 4; v.z = GARAGE.z + 12; v.y = 0; v.yaw = Math.PI; v.speed = 0; v.hp = v.hpMax; P.x = GARAGE.x; P.z = GARAGE.z + 4; P.chute = false; enter(v); S.ui = null; return { ok: true };
  }
  function step(dtIn) {
    const dt = Math.min(dtIn, 1 / 20); S.t += dt; if (S.msgT > 0) S.msgT -= dt; if (S.bannerT > 0) S.bannerT -= dt;
    for (let i = S.effects.length - 1; i >= 0; i--) { S.effects[i].t += dt; if (S.effects[i].t > S.effects[i].life) S.effects.splice(i, 1); }
    S.tracers = S.tracers.filter((tr) => { tr.t += dt; return tr.t < 0.1; });
    if (P.invuln > 0) P.invuln -= dt; if (P.hurt > 0) { P.hurt -= dt; P.lastHurt = S.t; } if (P.missileCd > 0) P.missileCd -= dt; if (P.wCd > 0) P.wCd -= dt; if (P.bloom > 0) P.bloom = Math.max(0, P.bloom - (input.gun ? 0.35 : 2.2) * dt); if (P.reload > 0) { if (P.reloadId !== P.weapon) P.reload = 0; else { P.reload -= dt; if (P.reload <= 0) { P.reload = 0; const A = am(P.weapon); const sp = ammoSpec(weaponOf(P.weapon)); if (A && sp) { const take = Math.min(sp.mag - A.mag, A.reserve); A.mag += take; A.reserve -= take; snd('door'); } } } } if (P.buff.dmg > 0) P.buff.dmg -= dt; if (P.buff.speed > 0) P.buff.speed -= dt; if (S.swing > 0) S.swing -= dt;
    if (P.dead > 0) { P.dead -= dt; if (P.dead <= 0) respawn(); stepCrooks(dt); return; }
    if (Math.abs(input.aimX) + Math.abs(input.aimY) > 0.05) P.noAim = 0; else P.noAim += dt;
    const v0 = cur(); if (!v0) { if (input.aimX) { P.camYaw += input.aimX * 1.45 * (1 + S.eq.aim) * dt; P.camFree = true; } P.aimPitch = clamp(P.aimPitch + input.aimY * 0.9 * dt, -0.35, 1.1); if (!P.camFree) P.camYaw = P.yaw; } else if (!isAir(v0.kind)) { P.aimRel = clamp(P.aimRel + input.aimX * 1.7 * dt, -2.4, 2.4); P.aimPitch = clamp(P.aimPitch + input.aimY * 0.9 * dt, -0.2, 1.2); }
    if (input.aimLock && !cur() && P.dead <= 0) { const t = P.target; if (t) { const wy = Math.atan2(t.x - P.x, t.z - P.z); P.camYaw += clamp(angDiff(wy, P.camYaw) * Math.min(1, 12 * (1 + S.eq.aim) * dt), -4 * dt, 4 * dt); P.aimPitch += (clamp(Math.atan2((t.y != null ? t.y : 1.6) - 2.5, hyp(t.x - P.x, t.z - P.z)), -0.2, t.y != null ? 1.1 : 0.4) - P.aimPitch) * Math.min(1, 10 * dt); } P.camFree = true; }
    movePlayer(dt); setNear();
    if (input.gun) fireGun(dt);
    stepCrooks(dt); stepMissiles(dt); stepWorld(dt); stepMission(dt);
    { const Wt = weaponOf(P.weapon) || {}; const vt = cur(); P.target = nearestCrook(vt ? (vt.kind === 'car' || vt.kind === 'bike' ? AUTOAIM_MAX_VEH : 600) : Math.min((Wt.range || 3) + 12, AUTOAIM_MAX), 6.3, P.yaw); } // あるいている ときは ぶきの しゃてい+12mの なかだけ ねらいが きく
  }
  return {
    state: S, input, step, interact, fireMissile, startMission, cancelMission, buy, buyVehicle, buyWeapon, buyEquip, wear, ultimateProgress, payFine, raise, gunHit, meleeHit, equip, cycleWeapon, reload: startReload, ammoOf: am, addCoins, fastTravel, summon, meets, progress, vehicleOf: cur, footStats: FS,
    takeEvents() { const e = S.events; S.events = []; return e; },
    aimAt(r) { if (!r) return; if (!cur()) { P.camYaw = Math.atan2(r.x - P.x, r.z - P.z); P.camFree = true; P.aimPitch = clamp(r.y != null ? Math.atan2(r.y - 1.6, hyp(r.x - P.x, r.z - P.z)) : Math.atan2(1.6 - 2.5, hyp(r.x - P.x, r.z - P.z)), -0.2, r.y != null ? 1.1 : 0.4); return; } P.aimRel = clamp(angDiff(Math.atan2(r.x - P.x, r.z - P.z), cur() ? cur().yaw : P.yaw), -2.4, 2.4); P.aimPitch = clamp(Math.atan2(2 - 4, Math.hypot(r.x - P.x, r.z - P.z)), -0.2, 1.2); },
    look(dx, dy) { P.noAim = 0; const v = cur(); if (!v) { const am2 = 1 + S.eq.aim; P.camYaw -= dx * 0.0034 * am2; P.camFree = true; P.aimPitch = clamp(P.aimPitch - dy * 0.0024 * am2, -0.35, 1.1); } else if (!isAir(v.kind)) { P.aimRel = clamp(P.aimRel - dx * 0.0036, -2.4, 2.4); P.aimPitch = clamp(P.aimPitch - dy * 0.0026, -0.2, 1.2); } },
    track(id) { S.tracked = S.tracked === id ? null : id; }, closeUi() { S.ui = null; }, refreshWanted,
  };
}
