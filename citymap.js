// シティの ちず(ほんものの まちなみ = OpenStreetMap のデータ)。みち・たてもの・かわ・てつどう・こうえんを しらべる どうぐ。
//   じっさいの ちずは citymap-data.js(scripts/build-citymap.py で つくる)。このファイルは ゲームで つかう かたちに かえて、
//   ほんぶ・じたく・くうこう・モール・サッカーじょうの ばしょを ちずの すいている ところに きめる。
import { MAP } from './citymap-data.js';
export const HALF = MAP.half;
const hyp = Math.hypot; const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mulberry = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pairs = (f) => { const o = []; for (let i = 0; i < f.length; i += 2) o.push([f[i], f[i + 1]]); return o; };
const inRect = (r, x, z, m = 0) => x >= r.x0 - m && x <= r.x1 + m && z >= r.z0 - m && z <= r.z1 + m;

// ---- みち ------------------------------------------------------------------------------------------
export const ROAD_HW = [3.2, 4.8, 6.4, 8.2, 10.5]; // ほそい みち→おおきな どうろ(はんぶんの はば)
let roadList = MAP.roads.map(([cls, br, f]) => ({ cls, br: !!br, hw: ROAD_HW[cls], pts: pairs(f) }));
let SEGS = []; let GRID = new Map(); const GS = 40;
function indexRoads() {
  SEGS = []; GRID = new Map();
  roadList.forEach((r, ri) => { for (let i = 1; i < r.pts.length; i++) { const a = r.pts[i - 1]; const b = r.pts[i]; const sg = { ax: a[0], az: a[1], bx: b[0], bz: b[1], hw: r.hw, br: r.br, cls: r.cls, ri }; const id = SEGS.length; SEGS.push(sg);
    const x0 = Math.floor((Math.min(a[0], b[0]) - 14) / GS); const x1 = Math.floor((Math.max(a[0], b[0]) + 14) / GS); const z0 = Math.floor((Math.min(a[1], b[1]) - 14) / GS); const z1 = Math.floor((Math.max(a[1], b[1]) + 14) / GS);
    for (let gx = x0; gx <= x1; gx++) for (let gz = z0; gz <= z1; gz++) { const k = gx * 100003 + gz; let l = GRID.get(k); if (!l) { l = []; GRID.set(k, l); } l.push(id); } } });
}
const segD = (x, z, ax, az, bx, bz) => { const dx = bx - ax; const dz = bz - az; const L = dx * dx + dz * dz; const t = L ? clamp(((x - ax) * dx + (z - az) * dz) / L, 0, 1) : 0; return hyp(x - (ax + dx * t), z - (az + dz * t)); };
// いちばん ちかい みちの「はし からの きょり」(0いかなら みちの うえ)。なければ 99
export function roadSD(x, z, onlyBridge = false) {
  const gx = Math.floor(x / GS); const gz = Math.floor(z / GS); let best = 99;
  for (let a = gx - 1; a <= gx + 1; a++) for (let b = gz - 1; b <= gz + 1; b++) { const l = GRID.get(a * 100003 + b); if (!l) continue; for (const id of l) { const s = SEGS[id]; if (onlyBridge && !s.br) continue; const d = segD(x, z, s.ax, s.az, s.bx, s.bz) - s.hw; if (d < best) best = d; } }
  return best;
}
// いちばん ちかい みちの ちゅうしんの てん(さいたん 200m)
export function nearestRoadPoint(x, z, minCls = 1, maxR = 220, noBridge = true) {
  let best = null; let bd = maxR;
  for (const s of SEGS) { if (s.cls < minCls || (noBridge && s.br)) continue; if (Math.abs((s.ax + s.bx) / 2 - x) > maxR + 120 || Math.abs((s.az + s.bz) / 2 - z) > maxR + 120) continue; const dx = s.bx - s.ax; const dz = s.bz - s.az; const L = dx * dx + dz * dz; const t = L ? clamp(((x - s.ax) * dx + (z - s.az) * dz) / L, 0.05, 0.95) : 0; const px = s.ax + dx * t; const pz = s.az + dz * t; const d = hyp(px - x, pz - z); if (d < bd) { bd = d; best = { x: px, z: pz, ang: Math.atan2(dz, dx), cls: s.cls }; } }
  return best;
}
export const roadsOf = () => roadList;

// ---- かわ(つるみがわ) ・ はし ----------------------------------------------------------------------
const rv = MAP.rivers.slice().sort((a, b) => b.length - a.length)[0] || [];
export const RIVER = { pts: pairs(rv), hw: 40, bank: 76 };
const segDR = (x, z, a, b) => segD(x, z, a[0], a[1], b[0], b[1]);
export const riverDist = (x, z) => { let d = 1e9; const P = RIVER.pts; for (let i = 1; i < P.length; i++) d = Math.min(d, segDR(x, z, P[i - 1], P[i])); return d; };
export const inRiver = (x, z) => riverDist(x, z) < RIVER.hw;
export const riverZ = (x) => { const P = RIVER.pts; if (x <= P[0][0]) return P[0][1]; for (let i = 1; i < P.length; i++) if (x <= P[i][0]) { const t = (x - P[i - 1][0]) / (P[i][0] - P[i - 1][0] || 1); return P[i - 1][1] + (P[i][1] - P[i - 1][1]) * t; } return P[P.length - 1][1]; };
// はしの ばしょ(かわを わたる どうろ): にしの はし=おおつなばし / ひがしの はし=たるつなばし
export const BRIDGES = (() => { const out = []; for (const r of roadList) if (r.br) { const mx = r.pts.reduce((s, p) => s + p[0], 0) / r.pts.length; const mz = r.pts.reduce((s, p) => s + p[1], 0) / r.pts.length; if (riverDist(mx, mz) < 60) out.push({ x: mx, z: mz }); } out.sort((a, b) => a.x - b.x); return out; })();
export const BRIDGE_W = BRIDGES.length ? BRIDGES[0].x : -520; export const BRIDGE_E = BRIDGES.length ? BRIDGES[BRIDGES.length - 1].x : 560;
export const onBridge = (x, z) => roadSD(x, z, true) < 1.5;
export const isWater = (x, z) => Math.abs(x) > HALF || Math.abs(z) > HALF || (inRiver(x, z) && !onBridge(x, z));

// ---- てつどう ----------------------------------------------------------------------------------------
// マップの なかの ぶぶんだけ きりとる
function clipPoly(P, lim) { const out = []; for (let i = 1; i < P.length; i++) { const a = P[i - 1]; const b = P[i]; const L = hyp(b[0] - a[0], b[1] - a[1]); const n = Math.max(1, Math.ceil(L / 6)); for (let k = 0; k <= n; k++) { const x = a[0] + ((b[0] - a[0]) * k) / n; const z = a[1] + ((b[1] - a[1]) * k) / n; if (Math.abs(x) <= lim && Math.abs(z) <= lim) { if (!out.length || hyp(out[out.length - 1][0] - x, out[out.length - 1][1] - z) > 5) out.push([x, z]); } } } return out; }
const thin = (P) => { if (P.length < 3) return P; const o = [P[0]]; for (let i = 1; i < P.length - 1; i++) { const a = o[o.length - 1]; const b = P[i]; const c = P[i + 1]; const cr = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / (hyp(c[0] - a[0], c[1] - a[1]) || 1); if (cr > 1.5) o.push(b); } o.push(P[P.length - 1]); return o; };
export const RAILS = { toyoko: thin(clipPoly(pairs(MAP.rails.toyoko || []), HALF + 30)), shin: thin(clipPoly(pairs(MAP.rails.shin || []), HALF + 30)) };
export const railDist = (x, z) => { let d = 1e9; for (const P of Object.values(RAILS)) for (let i = 1; i < P.length; i++) d = Math.min(d, segDR(x, z, P[i - 1], P[i])); return d; };

// ---- たてもの(かたむいた ちょうほうけい) ------------------------------------------------------------
export const KIND = ['house', 'apt', 'shop', 'office', 'school', 'warehouse'];
let blds = MAP.buildings.filter((b) => Math.abs(b[0]) < HALF + 20 && Math.abs(b[1]) < HALF + 20).map(([cx, cz, w, d, ang, h, k]) => mkB(cx, cz, w, d, ang, h, KIND[k]));
export function mkB(cx, cz, w, d, ang, h, kind, extra = {}) {
  const c = Math.cos(ang); const s = Math.sin(ang); const ex = (w / 2) * Math.abs(c) + (d / 2) * Math.abs(s); const ez = (w / 2) * Math.abs(s) + (d / 2) * Math.abs(c);
  return { cx, cz, w, d, ang, c, s, h, kind, tone: Math.abs(Math.floor(cx * 7 + cz * 13)) % 6, x0: cx - ex, x1: cx + ex, z0: cz - ez, z1: cz + ez, ...extra };
}
const polyIn = (poly, x, z) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i]; const [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; } return c; };
const polyAABB = (p) => { let x0 = 1e9; let x1 = -1e9; let z0 = 1e9; let z1 = -1e9; for (const [x, z] of p) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } return { x0, x1, z0, z1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 }; };
const polyCentroid = (p) => ({ x: p.reduce((s, q) => s + q[0], 0) / p.length, z: p.reduce((s, q) => s + q[1], 0) / p.length });

// かわ・てつどう・みち の うえの たてものは けす
blds = blds.filter((b) => riverDist(b.cx, b.cz) > RIVER.hw + 6 && railDist(b.cx, b.cz) > 7);
indexRoads();
const onRoadB = (b) => { for (const [u, v] of [[0, 0], [0.8, 0.8], [-0.8, 0.8], [0.8, -0.8], [-0.8, -0.8], [0.95, 0], [-0.95, 0], [0, 0.95], [0, -0.95]]) { const lx = (u * b.w) / 2; const lz = (v * b.d) / 2; const x = b.cx + lx * b.c - lz * b.s; const z = b.cz + lx * b.s + lz * b.c; if (roadSD(x, z) < -0.2) return true; } return false; };
blds = blds.filter((b) => !onRoadB(b)); // みちの うえに かかる たてものは けす

// ---- ばしょの けってい(ほんぶ・じたく・サッカー・くうこう・モール) ---------------------------------------
const costOf = (cx, cz, w, d) => { // その ばしょの こんざつ ぐあい(たてもの・みち・かわ・てつどう)
  let cst = 0; for (let x = cx - w / 2; x <= cx + w / 2; x += 8) for (let z = cz - d / 2; z <= cz + d / 2; z += 8) { if (isWater(x, z) || riverDist(x, z) < RIVER.hw + 8) return 1e9; if (railDist(x, z) < 12) return 1e9; if (roadSD(x, z) < 0) cst += 1; }
  for (const b of blds) if (b.x1 > cx - w / 2 && b.x0 < cx + w / 2 && b.z1 > cz - d / 2 && b.z0 < cz + d / 2) cst += Math.max(1, (b.w * b.d) / 60);
  return cst;
};
const zones = [];
function carve(r, cutRoads = true) {
  const m = 3; blds = blds.filter((b) => !(b.x1 > r.x0 - m && b.x0 < r.x1 + m && b.z1 > r.z0 - m && b.z0 < r.z1 + m));
  if (cutRoads) { roadList = roadList.flatMap((rd) => { const out = []; let cur = []; for (const p of rd.pts) { if (inRect(r, p[0], p[1])) { if (cur.length > 1) out.push({ ...rd, pts: cur }); cur = []; } else cur.push(p); } if (cur.length > 1) out.push({ ...rd, pts: cur }); return out.length ? out : (rd.pts.some((p) => inRect(r, p[0], p[1])) ? [] : [rd]); }); indexRoads(); }
  zones.push(r); return r;
}
const rectAt = (cx, cz, w, d) => ({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2, cx, cz, w, d });
function findRect(tx, tz, w, d, o = {}) {
  const maxR = o.maxR || 200; const step = o.step || 20; let best = null; let bc = 1e18;
  for (let r = 0; r <= maxR; r += step) for (let a = 0; a < (r === 0 ? 1 : Math.max(8, Math.round(r / 10))); a++) { const t = (a / (r === 0 ? 1 : Math.max(8, Math.round(r / 10)))) * Math.PI * 2; const cx = tx + Math.cos(t) * r; const cz = tz + Math.sin(t) * r; if (Math.abs(cx) > HALF - w / 2 - 6 || Math.abs(cz) > HALF - d / 2 - 6) continue; if (zones.some((q) => inRect({ x0: q.x0 - w / 2 - 10, x1: q.x1 + w / 2 + 10, z0: q.z0 - d / 2 - 10, z1: q.z1 + d / 2 + 10 }, cx, cz))) continue; const c = costOf(cx, cz, w, d) + r * (o.pull ?? 0.02); if (c < bc) { bc = c; best = rectAt(cx, cz, w, d); } }
  return best || rectAt(tx, tz, w, d);
}
const POI = MAP.pois;
const stn = POI.shinTsunashima || [-400, 150]; const stn2 = POI.tsunashima || [-527, 250];
// ほんぶの ひろば(新綱島駅の まえ)
export const PLAZA = carve(findRect(stn[0] + 10, stn[1] + 75, 150, 120, { maxR: 120, pull: 0.2 }));
// かせんじきの サッカーじょう(おおつなばし と たるつなばしの あいだ・きたぎし)
export const SOCCER_ZONE = (() => { const x = 90; const z = riverZ(x) + RIVER.hw + 26; return carve({ x0: x - 62, x1: x + 62, z0: z - 24, z1: z + 24, cx: x, cz: z, w: 124, d: 48 }); })();
export const SOCCER = { x: SOCCER_ZONE.cx, z: SOCCER_ZONE.cz };
// じたく(ガレージ): 綱島東小学校の ちかく
const sch = POI.school ? POI.school.c : [17, 351]; const pk3 = POI.park3 ? POI.park3.c : [244, 381];
export const HOME = carve(findRect((sch[0] + pk3[0]) / 2 - 30, Math.min(sch[1], pk3[1]) - 190, 120, 100, { maxR: 260, pull: 0.03 }));
// くうこう(いちばん すいている ひろい ばしょ)
export const AIRFIELD = (() => { let best = null; let bc = 1e18; for (let cx = -HALF + 190; cx <= HALF - 190; cx += 40) for (let cz = -HALF + 100; cz <= HALF - 100; cz += 40) { if (zones.some((q) => inRect({ x0: q.x0 - 190, x1: q.x1 + 190, z0: q.z0 - 100, z1: q.z1 + 100 }, cx, cz))) continue; const c = costOf(cx, cz, 300, 140) + hyp(cx - stn[0], cz - stn[1]) * 0.004; if (c < bc) { bc = c; best = rectAt(cx, cz, 300, 140); } } carve(best); return { x0: best.x0, x1: best.x1, z0: best.z0, z1: best.z1 }; })();
// モール(トレッサ・アピタ)
const mallR = (tx, tz, w, d) => carve(findRect(tx, tz, w, d, { maxR: 320, step: 20, pull: 0.01 }));
export const MALL_TRESA = mallR(-250, -420, 170, 90); export const MALL_APITA = mallR(250, 520, 130, 80);
indexRoads();

// ---- いろいろな てん(みちに ぴったり) ------------------------------------------------------------------
const snap = (x, z, minCls = 1, maxR = 260) => { const r = nearestRoadPoint(x, z, minCls, maxR); return r ? { x: Math.round(r.x), z: Math.round(r.z), ang: r.ang } : { x: Math.round(x), z: Math.round(z), ang: 0 }; };
export const pointNear = (x, z, minCls = 0, maxR = 260) => snap(x, z, minCls, maxR);
export const SNAP = snap;
export const SPAWN_HUB = { x: PLAZA.cx, z: PLAZA.cz };
// ---- みち、たてものの そうさ -----------------------------------------------------------------------------
export const buildings = () => blds;
export const roadList2 = () => roadList;
export { inRect, polyIn, polyAABB, polyCentroid, mulberry, POI, MAP };
export const isRoadAt = (x, z) => !isWater(x, z) && roadSD(x, z) <= 0 && !inRect(AIRFIELD, x, z) && !inRect(HOME, x, z);
export const greens = MAP.greens.map(([f, k]) => ({ poly: pairs(f), kind: k }));
export const pitches = MAP.pitches.map((f) => pairs(f));
export const schoolPoly = POI.school ? POI.school.poly : null; export const parkPoly = POI.park3 ? POI.park3.poly : null;
export const stationA = { x: stn[0], z: stn[1] }; export const stationB = { x: stn2[0], z: stn2[1] };
export const shrinePts = (POI.shrines || []).filter((p) => Math.abs(p[0]) < HALF - 30 && Math.abs(p[1]) < HALF - 30);
