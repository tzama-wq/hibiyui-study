// 地球防衛隊「シティ」: じゆうに うごける 街の ルールと うごき(画面には さわらない。node で テストできる)。
//   あるいて・くるま・せんしゃ・ふね・ひこうきに のりおりして、ミッションや ひろいものを たのしむ。
//   const sim = createCity({ stats, vehicles, rnd, gentle });  sim.input = { turn, climb, gun, boost, aimX, aimY };
//   sim.interact()(のる/おりる/ミッション/おみせ) ・ sim.fireMissile() ・ sim.step(dt) ・ sim.takeEvents()
//   ざひょう: x=よこ, y=たかさ, z=おく。からだの むき yaw: まえ = (sin yaw, cos yaw)
export const HALF = 640; export const GRID = 160; export const ROAD = 24;
export const LINES = [-480, -320, -160, 0, 160, 320, 480];
export const BAY = { x0: -160, x1: 160, z0: -640, z1: -490 }; // みなとの うみ(みなみがわ)
export const AIRFIELD = { x0: 330, x1: 630, z0: -70, z1: 70 }; // くうこう
export const PLAZA = { x0: 0, x1: 160, z0: 0, z1: 160 }; // ほんぶの ひろば
export const HQ = { x: 60, z: 70, r: 32 };
export const SPAWN = { x: 30, z: 30, yaw: 0 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const hyp = Math.hypot;
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
const dirOf = (yaw, pitch) => ({ x: Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: Math.cos(yaw) * Math.cos(pitch) });
const mulberry = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const inRect = (r, x, z) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
export const isWater = (x, z) => Math.abs(x) > HALF || Math.abs(z) > HALF || inRect(BAY, x, z);
const nearLine = (v) => { let b = 1e9; for (const l of LINES) b = Math.min(b, Math.abs(v - l)); return b; };
export const isRoad = (x, z) => !isWater(x, z) && !inRect(AIRFIELD, x, z) && (nearLine(x) < ROAD / 2 || nearLine(z) < ROAD / 2);

// ---- まちの かたち(いつも おなじ) ------------------------------------------------------------
function makeLayout() {
  const R = mulberry(11); const buildings = []; const trees = [];
  const park = new Set(['1,5', '5,6', '0,2', '6,0']); const skip = new Set(['4,4', '3,0', '4,0', '6,3', '7,3', '6,4', '7,4']);
  for (let ix = 0; ix < 8; ix++) for (let iz = 0; iz < 8; iz++) {
    const key = `${ix},${iz}`; if (skip.has(key)) continue;
    const x0 = -640 + GRID * ix; const z0 = -640 + GRID * iz; const x1 = x0 + GRID; const z1 = z0 + GRID;
    const xa = x0 + (ix === 0 ? 18 : 20); const xb = x1 - (ix === 7 ? 18 : 20); const za = z0 + (iz === 0 ? 18 : 20); const zb = z1 - (iz === 7 ? 18 : 20);
    if (park.has(key)) { for (let i = 0; i < 16; i++) trees.push({ x: lerp(xa + 6, xb - 6, R()), z: lerp(za + 6, zb - 6, R()), s: 0.8 + R() * 0.8 }); continue; }
    const harbor = iz === 0 && (ix === 2 || ix === 5); const centerish = Math.abs(ix - 3.5) < 2.2 && Math.abs(iz - 3.5) < 2.2;
    const w = (xb - xa - 10) / 2; const d = (zb - za - 10) / 2;
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
      if (R() < 0.1) { trees.push({ x: xa + a * (w + 10) + w / 2, z: za + b * (d + 10) + d / 2, s: 1 }); continue; }
      const h = harbor ? 9 + R() * 8 : 14 + R() * 26 + (centerish ? R() * 80 : R() * 24);
      buildings.push({ x0: xa + a * (w + 10), x1: xa + a * (w + 10) + w, z0: za + b * (d + 10), z1: za + b * (d + 10) + d, h: Math.round(h), tone: Math.floor(R() * 6), kind: harbor ? 'warehouse' : 'office' });
    }
  }
  buildings.push({ x0: 100, x1: 150, z0: 110, z1: 150, h: 36, tone: 9, kind: 'hq' }); // ほんぶ
  buildings.push({ x0: 345, x1: 405, z0: 95, z1: 135, h: 16, tone: 8, kind: 'hangar' }, { x0: 400, x1: 460, z0: -135, z1: -95, h: 16, tone: 8, kind: 'hangar' }); // くうこうの かくのうこ
  return { buildings, trees };
}
export const LAYOUT = makeLayout();
// ばしょごとの ひきだし(あたりはんてい用)
const CELL = new Map();
for (const b of LAYOUT.buildings) { const i0 = Math.floor(b.x0 / 80); const i1 = Math.floor(b.x1 / 80); const j0 = Math.floor(b.z0 / 80); const j1 = Math.floor(b.z1 / 80); for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = `${i},${j}`; if (!CELL.has(k)) CELL.set(k, []); CELL.get(k).push(b); } }
const nearB = (x, z) => { const i = Math.floor(x / 80); const j = Math.floor(z / 80); const out = []; for (let a = i - 1; a <= i + 1; a++) for (let c = j - 1; c <= j + 1; c++) { const l = CELL.get(`${a},${c}`); if (l) for (const b of l) if (!out.includes(b)) out.push(b); } return out; };
// えんと はこ の あたり: おしだす。あたったら true
function pushOut(p, r, ys = 0) {
  let hit = false;
  for (const b of nearB(p.x, p.z)) {
    if (ys > b.h + 1) continue; // たかい ところを とぶ ものは あたらない
    const cx = clamp(p.x, b.x0, b.x1); const cz = clamp(p.z, b.z0, b.z1); const dx = p.x - cx; const dz = p.z - cz; const d = hyp(dx, dz);
    if (d < r) { hit = true; if (d > 0.001) { p.x = cx + (dx / d) * r; p.z = cz + (dz / d) * r; } else { const l = p.x - b.x0; const rr = b.x1 - p.x; const t = p.z - b.z0; const bt = b.z1 - p.z; const m = Math.min(l, rr, t, bt); if (m === l) p.x = b.x0 - r; else if (m === rr) p.x = b.x1 + r; else if (m === t) p.z = b.z0 - r; else p.z = b.z1 + r; } }
  }
  return hit;
}
export const insideBuilding = (x, z, ys = 0) => nearB(x, z).some((b) => ys <= b.h && x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1);

// ---- きたいの せいのう(しゅじんこうの つよさから) -----------------------------------------------
export const footStats = (ks) => ({ vehicle: 'foot', speed: 7 + ks.SPD * 0.008, run: 12 + ks.SPD * 0.012, hpMax: Math.round(70 + ks.DEF * 0.7), gunDps: Math.round(18 + ks.SHO * 0.1), range: 75, turn: 2.4 });
export const carStats = (ks) => ({ vehicle: 'car', speed: 26 + ks.SPD * 0.1, hpMax: Math.round(130 + ks.DEF * 1.2), gunDps: Math.round(22 + ks.SHO * 0.12), turn: 1.7, missiles: 0, missileDmg: 0, locks: 0, boostMax: 60 + Math.round(ks.STA * 0.4) });

// ---- ミッション ---------------------------------------------------------------------------------
export const CITY_MISSIONS = [
  { id: 'patrol', name: 'まちの パトロール', icon: '🚓', start: { x: 160, z: 160 }, brief: 'まちの 4かしょを くるまや のりもので まわろう。', reward: { bronze: 1, coins: 30 }, pts: 4, points: [{ x: 160, z: 320 }, { x: 320, z: 160 }, { x: 160, z: -160 }, { x: -160, z: 160 }] },
  { id: 'rescue', name: 'しみんを たすけろ', icon: '🆘', start: { x: -160, z: 160 }, brief: 'ロボットに おいかけられている 3にんを みつけて ほんぶまで つれて いこう(ちかづいて ボタン)。', reward: { silver: 1, coins: 60 }, pts: 6, civs: [{ x: -320, z: 320 }, { x: -480, z: 160 }, { x: -320, z: 0 }], guards: 2 },
  { id: 'invasion', name: 'ロボットを たおせ!', icon: '🤖', start: { x: -160, z: -160 }, brief: 'とおくの こうさてんに あらわれた ロボットを ぜんぶ たおそう!', reward: { silver: 1, coins: 80 }, pts: 8, spot: { x: -320, z: -320 }, robots: 6 },
  { id: 'harbor', name: 'こうわん パトロール', icon: '⚓', start: { x: 0, z: -470 }, brief: 'ふねで うみの ブイを 3つ まわろう!(みなとの ふねに のってね)', reward: { bronze: 2, coins: 70 }, pts: 6, points: [{ x: 0, z: -820 }, { x: 760, z: -760 }, { x: 780, z: -300 }], water: true },
  { id: 'sky', name: 'そらの リング', icon: '💫', start: { x: 345, z: 40 }, brief: 'ひこうきで リングを 6つ くぐろう!(くうこうの ひこうきに のってね)', reward: { gold: 1, coins: 120 }, pts: 10, rings: [{ x: 200, y: 90, z: 60 }, { x: 40, y: 120, z: 200 }, { x: -200, y: 140, z: 260 }, { x: -300, y: 110, z: -60 }, { x: -60, y: 90, z: -260 }, { x: 240, y: 70, z: -120 }] },
  { id: 'delivery', name: 'はやく おとどけ!', icon: '📦', start: { x: -320, z: 0 }, brief: 'にもつを うけとって、100びょうい ないに ほんぶへ とどけよう!', reward: { silver: 1, coins: 90 }, pts: 6, pickup: { x: -480, z: -320 }, time: 100 },
];
export const missionOf = (id) => CITY_MISSIONS.find((m) => m.id === id);
export const SHOP = { x: 30, z: 62, items: [
  { id: 'heal', name: 'ぜんかいふく', icon: '❤️', cost: 10, desc: 'HPが ぜんぶ もどるよ' },
  { id: 'bronze', name: 'ブロンズチケット', icon: '🥉', cost: 40, desc: 'ガチャチケット' },
  { id: 'silver', name: 'シルバーチケット', icon: '🥈', cost: 90, desc: 'ガチャチケット' },
  { id: 'gold', name: 'ゴールドチケット', icon: '🥇', cost: 220, desc: 'ガチャチケット' },
  { id: 'shard', name: 'ダイヤの かけら×5', icon: '💠', cost: 180, desc: 'ダイヤの かけら' },
] };

const VEH_HOME = {
  car1: { kind: 'car', x: 30, z: 120, yaw: 0 }, car2: { kind: 'car', x: 70, z: 120, yaw: 0 }, tank: { kind: 'tank', x: 108, z: 36, yaw: Math.PI / 2 },
  ship: { kind: 'ship', x: 0, z: -540, yaw: Math.PI }, plane: { kind: 'plane', x: 350, z: 0, yaw: Math.PI / 2 },
};

export function createCity({ stats, vehicles, rnd = mulberry(5), gentle = false, coins = 0 }) {
  const ks = stats; const FS = footStats(ks);
  const input = { turn: 0, climb: 0, gun: false, boost: false, aimX: 0, aimY: 0 };
  const S = {
    t: 0, ph: 'play', events: [], snd: [], msg: '', msgT: 0, banner: '', bannerT: 0,
    player: { mode: 'foot', x: SPAWN.x, y: 0, z: SPAWN.z, yaw: SPAWN.yaw, pitch: 0, roll: 0, speed: 0, hp: FS.hpMax, hpMax: FS.hpMax, boost: 100, aimRel: 0, aimPitch: 0.05, veh: null, invuln: 0, dead: 0, hurt: 0, coins, fireCd: 0, noAim: 0, chute: false, carry: 0, kos: 0, target: null, lockId: 0, missileCd: 0 },
    vehicles: [], civs: [], robots: [], bullets: [], missiles: [], tracers: [], effects: [], pickups: [], traffic: [], walkers: [], mission: null, done: {}, nearby: null, ui: null, stats: { coins: 0, kos: 0, missions: 0 },
  };
  const P = S.player; let nid = 100;
  const snd = (n) => { if (S.snd.length < 24) S.snd.push(n); };
  const fx = (kind, x, y, z, r = 8) => { if (S.effects.length < 60) S.effects.push({ kind, x, y, z, r, t: 0, life: kind === 'big' ? 1.2 : 0.7 }); };
  const msg = (t, d = 2.6) => { S.msg = t; S.msgT = d; };
  const banner = (t, d = 2.4) => { S.banner = t; S.bannerT = d; };
  const ev = (e) => S.events.push(e);
  // のりもの(ならべる)
  const mkVeh = (id, home) => { const V = vehicles[home.kind]; return { id, kind: home.kind, V, x: home.x, y: 0, z: home.z, yaw: home.yaw, pitch: 0, roll: 0, speed: 0, hp: V.hpMax, hpMax: V.hpMax, home: { ...home }, occ: false, away: 0, boost: V.boostMax || 100 }; };
  for (const [id, h] of Object.entries(VEH_HOME)) if (vehicles[h.kind]) S.vehicles.push(mkVeh(id, h));
  // ひろいもの(コイン・ほうせき)
  const R2 = mulberry(77);
  for (let i = 0; i < 46; i++) { const l = LINES[Math.floor(R2() * LINES.length)]; const along = lerp(-600, 600, R2()); const vert = R2() < 0.5; const x = vert ? l : along; const z = vert ? along : l; if (!isRoad(x, z) || inRect(PLAZA, x, z)) continue; S.pickups.push({ id: ++nid, x, z, kind: i % 9 === 0 ? 'gem' : 'coin', v: i % 9 === 0 ? 15 : 3 }); }
  // まちの ひとと くるま(かざり)
  for (let i = 0; i < 16; i++) { const l = LINES[Math.floor(R2() * LINES.length)]; const vert = R2() < 0.5; const a = lerp(-560, 560, R2()); const off = (R2() < 0.5 ? -1 : 1) * 15; const x = vert ? l + off : a; const z = vert ? a : l + off; if (!isWater(x, z) && !inRect(AIRFIELD, x, z) && !insideBuilding(x, z) && !inRect(PLAZA, x, z)) S.walkers.push({ id: ++nid, x, z, yaw: vert ? 0 : Math.PI / 2, vert, line: l + off, dir: R2() < 0.5 ? 1 : -1, spd: 1.4 + R2(), look: i }); }
  for (let i = 0; i < 8; i++) { const l = [-480, -320, 320, 480, -160, 160][i % 6]; const vert = i % 2 === 0; if (vert && (l === -160 || l === 160)) continue; const lane = (i % 3 === 0 ? -1 : 1) * 6; S.traffic.push({ id: ++nid, vert, line: l + lane, pos: lerp(-560, 560, R2()), dir: lane > 0 ? 1 : -1, spd: 12 + R2() * 6, tone: i, x: 0, z: 0, yaw: 0, wait: 0 }); }

  // ---- まわりの ぶつかり ----
  const groundMove = (e, nx, nz, r, water) => { // water=true: うみ だけ / false: りく だけ
    const ok = (x, z) => (water ? isWater(x, z) : !isWater(x, z));
    let moved = false;
    if (ok(nx, nz)) { e.x = nx; e.z = nz; moved = true; } else if (ok(nx, e.z)) { e.x = nx; moved = true; } else if (ok(e.x, nz)) { e.z = nz; moved = true; }
    if (!water) pushOut(e, r); return moved;
  };
  const dmgEntity = (hurt) => { /* ダメージの うけて */ void hurt; };
  void dmgEntity;

  // ---- いま のってる のりもの ----
  const cur = () => (P.veh ? S.vehicles.find((v) => v.id === P.veh) : null);
  const setNear = () => {
    let best = null; let bd = 1e9; const px = P.x; const pz = P.z;
    const cand = (kind, id, x, z, r, label, extra = {}) => { const d = hyp(px - x, pz - z); if (d < r && d < bd) { bd = d; best = { kind, id, label, d, ...extra }; } };
    if (P.mode === 'foot') {
      for (const v of S.vehicles) if (!v.occ) cand('veh', v.id, v.x, v.z, v.kind === 'ship' ? 26 : 12, `${{ car: '🚗 くるま', tank: '🚜 せんしゃ', ship: '🚢 ふね', plane: '✈️ ひこうき' }[v.kind]}に のる`);
      for (const c of S.civs) if (c.state === 'need') cand('civ', c.id, c.x, c.z, 9, '🆘 しみんを たすける');
    } else cand('exit', 'exit', px, pz, 999, P.veh && cur() && cur().kind === 'plane' && P.y > 12 ? '🪂 パラシュートで おりる' : '🚪 おりる');
    cand('shop', 'shop', SHOP.x, SHOP.z, 10, '🏪 おみせを みる');
    if (!S.mission) for (const m of CITY_MISSIONS) cand('mission', m.id, m.start.x, m.start.z, 14, `${m.icon} ミッション「${m.name}」`);
    if (S.mission && S.mission.id === 'delivery' && S.mission.stage === 0) cand('pack', 'pack', S.mission.pk.x, S.mission.pk.z, 14, '📦 にもつを うけとる');
    S.nearby = best;
  };
  const enter = (v) => {
    P.mode = 'veh'; P.veh = v.id; v.occ = true; v.away = 0; P.hp = Math.min(P.hp, P.hpMax); P.aimRel = 0; P.aimPitch = 0.05; P.noAim = 0;
    if (v.kind === 'plane') { v.y = 60; v.speed = v.V.speed; v.pitch = 0; v.yaw = v.home.yaw; msg('✈️ ひこうきに のったよ! リングを めざせ!'); }
    P.x = v.x; P.z = v.z; P.y = v.y; P.yaw = v.yaw; snd('door');
  };
  const leave = () => {
    const v = cur(); if (!v) return; v.occ = false; v.away = 0; const sd = v.yaw + Math.PI / 2;
    P.mode = 'foot'; P.veh = null; P.x = v.x + Math.sin(sd) * (v.kind === 'ship' ? 18 : 6); P.z = v.z + Math.cos(sd) * (v.kind === 'ship' ? 18 : 6); P.y = v.kind === 'plane' ? v.y : 0; P.yaw = v.yaw; P.speed = 0;
    if (v.kind === 'plane' && v.y > 12) { P.chute = true; msg('🪂 パラシュートで ゆっくり おりるよ'); const d = hyp(v.x - v.home.x, v.z - v.home.z); void d; v.x = v.home.x; v.z = v.home.z; v.y = 0; v.yaw = v.home.yaw; v.speed = 0; v.hp = v.hpMax; }
    else if (v.kind === 'plane') { v.speed = 0; }
    if (isWater(P.x, P.z) && v.kind === 'ship') { // みずの うえに おりない(ちかくの りくへ)
      let ok = false; for (let r = 18; r < 120 && !ok; r += 6) for (let a = 0; a < 16 && !ok; a++) { const x = v.x + Math.cos(a * 0.39) * r; const z = v.z + Math.sin(a * 0.39) * r; if (!isWater(x, z) && !insideBuilding(x, z)) { P.x = x; P.z = z; ok = true; } }
      if (!ok) { P.x = v.home.x + 30; P.z = v.home.z + 40; }
    }
    snd('door');
  };

  // ---- ミッション ----
  const startMission = (id) => {
    const m = missionOf(id); if (!m || S.mission) return false;
    const M = { id, stage: 0, t: 0, name: m.name, icon: m.icon, total: 0, got: 0 };
    S.mission = M; // さきに おく(ロボットに ミッションの めじるしを つけるため)
    if (id === 'patrol') { M.total = m.points.length; M.targets = m.points.map((p) => ({ ...p })); }
    else if (id === 'harbor') { M.total = m.points.length; M.targets = m.points.map((p) => ({ ...p })); }
    else if (id === 'sky') { M.total = m.rings.length; M.targets = m.rings.map((p) => ({ ...p })); }
    else if (id === 'rescue') { M.total = m.civs.length; for (const c of m.civs) S.civs.push({ id: ++nid, x: c.x, z: c.z, yaw: 0, state: 'need', fear: 0, home: { ...c } }); for (let i = 0; i < m.guards; i++) spawnRobot(m.civs[i % m.civs.length].x + 18, m.civs[i % m.civs.length].z + 14, 'bot', 28); }
    else if (id === 'invasion') { M.total = m.robots; for (let i = 0; i < m.robots; i++) spawnRobot(m.spot.x + Math.cos(i * 1.1) * 36, m.spot.z + Math.sin(i * 1.1) * 36, i % 5 === 4 ? 'big' : 'bot', 60); M.kosAt = P.kos; M.targets = [{ x: m.spot.x, z: m.spot.z }]; }
    else if (id === 'delivery') { M.total = 2; M.pk = { ...m.pickup }; M.timeLeft = m.time; M.targets = [{ x: m.pickup.x, z: m.pickup.z }]; }
    banner(`${m.icon} ${m.name}`); msg(m.brief, 5); snd('mission'); return true;
  };
  const endMission = (ok, why) => {
    const M = S.mission; if (!M) return; const m = missionOf(M.id);
    if (ok) { S.done[M.id] = (S.done[M.id] || 0) + 1; S.stats.missions++; const r = { ...m.reward }; const coins = r.coins || 0; delete r.coins; P.coins += coins; S.stats.coins += coins; ev({ t: 'reward', id: M.id, name: m.name, reward: r, pts: m.pts || 0, coins, first: S.done[M.id] === 1 }); banner('✅ ミッション クリア!', 3); msg(`ごほうび: コイン +${coins}${Object.keys(r).length ? ' + チケット' : ''}`, 4); snd('win'); fx('big', P.x, P.y + 4, P.z, 10); }
    else { banner('ミッション しっぱい…', 2.6); msg(why || 'もういちど ちょうせんしよう', 3.5); snd('lose'); }
    // のこりの ロボット・しみんを かたづける
    S.civs = S.civs.filter((c) => c.state === 'safe' ? false : false); S.mission = null; P.carry = 0;
    if (M.id === 'invasion') S.robots = S.robots.filter((r) => !r.mission);
  };
  const cancelMission = () => { if (S.mission) { const M = S.mission; S.civs = []; if (M.id === 'invasion') S.robots = S.robots.filter((r) => !r.mission); S.mission = null; P.carry = 0; msg('ミッションを やめたよ'); } };

  // ---- ロボット ----
  function spawnRobot(x, z, type = 'bot', home = 0) {
    const big = type === 'big'; const r = { id: ++nid, type, x, z, yaw: rnd() * 6.28, hp: big ? 150 : 46, hpMax: big ? 150 : 46, cd: 1 + rnd(), homeX: x, homeZ: z, wander: home || 40, state: 'idle', t: 0, mission: !!S.mission && true, speed: big ? 3.2 : 4.4, ph: rnd() * 6 };
    S.robots.push(r); return r;
  }
  const koRobot = (r) => {
    S.robots = S.robots.filter((x) => x !== r); P.kos++; S.stats.kos++; fx('boom', r.x, 3, r.z, r.type === 'big' ? 12 : 8); snd('boom');
    S.pickups.push({ id: ++nid, x: r.x + (rnd() - 0.5) * 3, z: r.z + (rnd() - 0.5) * 3, kind: 'coin', v: r.type === 'big' ? 6 : 3 });
    ev({ t: 'ko', type: r.type });
  };
  const hurtPlayer = (d) => {
    if (P.invuln > 0 || P.dead > 0) return; const dd = d * (gentle ? 0.6 : 1); snd('hit'); P.hurt = 0.35;
    const v = cur();
    if (v) { v.hp -= dd; if (v.hp <= 0) { v.hp = 0; fx('big', v.x, v.y + 3, v.z, 14); snd('bigboom'); msg('のりものが こわれた! ほんぶで なおすよ', 3); const wasPlane = v.kind === 'plane'; leave(); P.invuln = 2; v.x = v.home.x; v.z = v.home.z; v.y = 0; v.yaw = v.home.yaw; v.speed = 0; v.hp = v.hpMax; if (wasPlane) P.chute = false; } }
    else { P.hp -= dd; if (P.hp <= 0) { P.hp = 0; knockout(); } }
  };
  const knockout = () => {
    P.dead = 2.8; const lose = Math.min(P.coins, Math.max(0, Math.round(P.coins * 0.1))); P.coins -= lose; fx('boom', P.x, 3, P.z, 10); snd('lose');
    banner('😵 ノックアウト! ほんぶで ふっかつ', 3); msg(lose ? `コインを ${lose}こ おとしたよ` : 'だいじょうぶ! もういちど!', 3);
    if (P.veh) { const v = cur(); if (v) { v.occ = false; } P.veh = null; P.mode = 'foot'; }
  };
  const respawn = () => { P.dead = 0; P.hp = P.hpMax; P.x = SPAWN.x; P.z = SPAWN.z; P.y = 0; P.yaw = 0; P.speed = 0; P.mode = 'foot'; P.invuln = 3; P.chute = false; P.carry = 0; for (const c of S.civs) if (c.state === 'carried') { c.state = 'need'; c.x = c.home.x; c.z = c.home.z; } };

  // ---- ねらい ----
  const nearestRobot = (maxD, cone, yaw) => {
    let best = null; let bd = maxD; for (const r of S.robots) { const d = hyp(r.x - P.x, r.z - P.z); if (d > bd) continue; const a = Math.abs(angDiff(Math.atan2(r.x - P.x, r.z - P.z), yaw)); if (a > cone) continue; bd = d; best = r; } return best;
  };
  const aimDir = () => { // いま うつ ほうこう(せかいの ざひょう)
    const v = cur(); const kind = v ? v.kind : 'foot';
    if (kind === 'plane') return { yaw: v.yaw, pitch: v.pitch, from: { x: v.x, y: v.y - 1, z: v.z } };
    const ay = P.yaw + P.aimRel;
    return { yaw: ay, pitch: P.aimPitch, from: { x: P.x, y: (kind === 'foot' ? 1.6 : kind === 'ship' ? 8 : 4) + P.y, z: P.z } };
  };
  const fireGun = (dt) => {
    const v = cur(); const kind = v ? v.kind : 'foot'; const dps = v ? v.V.gunDps : FS.gunDps; const range = kind === 'plane' ? 650 : kind === 'ship' ? 800 : kind === 'tank' ? 600 : kind === 'car' ? 140 : FS.range;
    // おてがる: あるく・くるまは ちかい ロボットに ねらいを あわせる(たまに じぶんで うごかすと そちらが ゆうせん)
    if ((kind === 'foot' || kind === 'car') && P.noAim > 0.8) { const t = nearestRobot(range, 0.9, v ? v.yaw : P.yaw); if (t) { P.aimRel = clamp(angDiff(Math.atan2(t.x - P.x, t.z - P.z), v ? v.yaw : P.yaw), -1.5, 1.5); P.aimPitch = clamp(Math.atan2(2.5 - (kind === 'foot' ? 1.6 : 4), Math.hypot(t.x - P.x, t.z - P.z)), -0.2, 0.4); } }
    const d = aimDir(); const dv = dirOf(d.yaw, d.pitch); let best = null; let ba = 9;
    for (const r of S.robots) {
      const ty = kind === 'plane' ? Math.max(3, d.from.y - 0.25 * hyp(r.x - d.from.x, r.z - d.from.z)) : 3; const vx = r.x - d.from.x; const vy = ty - d.from.y; const vz = r.z - d.from.z; const dist = hyp(vx, vy, vz); if (dist > range) continue;
      const a = Math.acos(clamp((vx * dv.x + vy * dv.y + vz * dv.z) / (dist || 1), -1, 1)); const tol = (kind === 'plane' ? 0.13 : (r.type === 'big' ? 5 : 3) / dist + 0.05) * (gentle ? 1.5 : 1); if (a < tol && a < ba) { ba = a; best = r; }
    }
    if (best) { best.hp -= dps * dt * (kind === 'foot' ? 1 : 1.2); best.alert = true; if (best.hp <= 0) koRobot(best); }
    if (S.t % (kind === 'foot' ? 0.1 : 0.08) < dt) S.tracers.push({ from: d.from, to: best ? { x: best.x, y: 3, z: best.z } : { x: d.from.x + dv.x * 120, y: d.from.y + dv.y * 120, z: d.from.z + dv.z * 120 }, t: 0 });
    if (S.t % 0.2 < dt) snd(kind === 'tank' || kind === 'ship' ? 'boom' : 'gun');
  };
  const fireMissile = () => {
    const v = cur(); if (!v || !v.V.missiles || P.missileCd > 0 || P.dead > 0) return false; if ((v.mis == null ? v.V.missiles : v.mis) <= 0) { msg('ミサイルは ふえるのを まってね'); return false; }
    const range = v.kind === 'plane' ? 800 : 500; const t = nearestRobot(range, v.kind === 'plane' ? 0.7 : 3.2, v.kind === 'plane' ? v.yaw : v.yaw + P.aimRel);
    if (!t) { msg('ロックできる てきが いないよ'); return false; }
    v.mis = (v.mis == null ? v.V.missiles : v.mis) - 1; P.missileCd = 0.5; const d = dirOf(v.kind === 'plane' ? v.yaw : v.yaw + P.aimRel, 0.5);
    S.missiles.push({ x: v.x + d.x * 8, y: v.y + 6, z: v.z + d.z * 8, vx: d.x * 120, vy: 0.5 * 120, vz: d.z * 120, target: t.id, t: 0, life: 7, dmg: v.V.missileDmg }); snd('missile'); return true;
  };

  // ---- 1フレーム ----
  function movePlayer(dt) {
    const v = cur(); const boost = input.boost;
    if (P.dead > 0) return;
    if (P.chute) { P.y = Math.max(0, P.y - 7 * dt); P.yaw += input.turn * 0.6 * dt; P.x += Math.sin(P.yaw) * input.climb * 6 * dt; P.z += Math.cos(P.yaw) * input.climb * 6 * dt; if (isWater(P.x, P.z)) { /* うみに おちても だいじょうぶ(ちかくの りくへ) */ P.x = HQ.x; P.z = HQ.z - 40; } pushOut(P, 1.2); if (P.y <= 0.01) { P.chute = false; } return; }
    if (!v) { // あるく
      const sp = boost ? FS.run : FS.speed; const target = input.climb >= 0 ? input.climb * sp : input.climb * sp * 0.5; P.speed = lerp(P.speed, target, 1 - Math.exp(-9 * dt));
      P.yaw += input.turn * FS.turn * dt; groundMove(P, P.x + Math.sin(P.yaw) * P.speed * dt, P.z + Math.cos(P.yaw) * P.speed * dt, 1.1, false); P.y = 0; P.boost = clamp(P.boost + (boost && input.climb > 0 ? -30 : 20) * dt, 0, 100); return;
    }
    const V = v.V; const k = v.kind;
    if (k === 'plane') {
      const bo = boost && P.boost > 1; P.boost = clamp(P.boost + (bo ? -22 : 10) * dt, 0, 100);
      const sp = V.speed * (bo ? 1.65 : 1) * (input.climb < -0.4 ? 1.12 : input.climb > 0.4 ? 0.92 : 1); v.speed = lerp(v.speed, sp, 1 - Math.exp(-2.4 * dt));
      v.yaw += input.turn * V.turn * dt; v.pitch = clamp(v.pitch + input.climb * 0.95 * dt, -0.95, 0.95); if (Math.abs(input.climb) < 0.12) v.pitch *= Math.exp(-0.9 * dt); v.roll = lerp(v.roll, -input.turn * 0.95, 1 - Math.exp(-5 * dt));
      const f = dirOf(v.yaw, v.pitch); v.x += f.x * v.speed * dt; v.y += f.y * v.speed * dt; v.z += f.z * v.speed * dt;
      if (v.y < 6) { v.y = 6; v.pitch = Math.max(v.pitch, 0.25); if (S.t - (v.crashT || -9) > 1.2) { v.crashT = S.t; hurtPlayer(14); msg('⚠ ちめんに ちかいよ! のぼって!', 1.6); } }
      if (insideBuilding(v.x, v.z, v.y)) { const b = nearB(v.x, v.z).find((bb) => v.y <= bb.h && v.x >= bb.x0 && v.x <= bb.x1 && v.z >= bb.z0 && v.z <= bb.z1); if (b) { v.y = b.h + 8; v.pitch = 0.3; if (S.t - (v.crashT || -9) > 1.2) { v.crashT = S.t; hurtPlayer(20); msg('💥 たてものに ぶつかった!', 1.6); fx('boom', v.x, v.y, v.z, 10); } } }
      v.y = Math.min(v.y, 700); const r = hyp(v.x, v.z); if (r > 1600) { v.yaw += clamp(angDiff(Math.atan2(-v.x, -v.z), v.yaw), -1.6 * dt, 1.6 * dt) * 3; }
      P.x = v.x; P.y = v.y; P.z = v.z; P.yaw = v.yaw; P.pitch = v.pitch; return;
    }
    // ちじょう・うみ
    const bo = boost && P.boost > 1; P.boost = clamp(P.boost + (bo ? -26 : 12) * dt, 0, 100);
    const max = V.speed * (bo ? 1.55 : 1); const want = input.climb >= 0 ? input.climb * max : input.climb * max * 0.4;
    v.speed = lerp(v.speed, want, 1 - Math.exp(-(k === 'car' ? 2.4 : k === 'tank' ? 3.2 : 1.1) * dt));
    v.yaw += input.turn * V.turn * dt * (0.35 + Math.min(1, Math.abs(v.speed) / (V.speed * 0.45)) * 0.65) * (v.speed < -0.5 ? -1 : 1);
    const nx = v.x + Math.sin(v.yaw) * v.speed * dt; const nz = v.z + Math.cos(v.yaw) * v.speed * dt; const rad = k === 'car' ? 3.2 : k === 'tank' ? 6.5 : 14;
    const ox = v.x; const oz = v.z; const moved = groundMove(v, nx, nz, rad, k === 'ship');
    if (k === 'ship') { for (const b of nearB(v.x, v.z)) { const cx = clamp(v.x, b.x0, b.x1); const cz = clamp(v.z, b.z0, b.z1); if (hyp(v.x - cx, v.z - cz) < rad) { v.x = ox; v.z = oz; v.speed *= 0.2; } } v.x = clamp(v.x, -1700, 1700); v.z = clamp(v.z, -1700, 1700); }
    if (!moved || hyp(v.x - nx, v.z - nz) > 0.6) { if (Math.abs(v.speed) > 8 && S.t - (v.bumpT || -9) > 0.7) { v.bumpT = S.t; snd('bump'); if (k === 'car') hurtPlayer(Math.min(10, Math.abs(v.speed) * 0.25)); } v.speed *= 0.5; }
    // ぶつかって ロボットを はじく
    if (Math.abs(v.speed) > 9) for (const r of S.robots.slice()) if (hyp(r.x - v.x, r.z - v.z) < rad + 2) { r.hp -= (k === 'tank' ? 80 : 40); fx('spark', r.x, 2, r.z, 5); if (r.hp <= 0) koRobot(r); else { r.x += Math.sin(v.yaw) * 6; r.z += Math.cos(v.yaw) * 6; } }
    v.roll = lerp(v.roll, -input.turn * 0.1, 1 - Math.exp(-4 * dt)); P.x = v.x; P.z = v.z; P.y = k === 'ship' ? 0 : 0; P.yaw = v.yaw; P.speed = v.speed;
  }
  function stepRobots(dt) {
    for (const r of S.robots) {
      r.t += dt; const dp = hyp(r.x - P.x, r.z - P.z); const target = P.dead > 0 ? null : (dp < 85 || r.alert ? P : null);
      let civ = null; if (!target) for (const c of S.civs) if (c.state === 'need' && hyp(c.x - r.x, c.z - r.z) < 50) civ = c;
      const goal = target || civ;
      if (goal) { const gx = goal.x; const gz = goal.z; const d = hyp(gx - r.x, gz - r.z); const want = Math.atan2(gx - r.x, gz - r.z); r.yaw += clamp(angDiff(want, r.yaw), -3 * dt, 3 * dt); if (d > 22) { groundMove(r, r.x + Math.sin(r.yaw) * r.speed * dt, r.z + Math.sin(0) * 0 + Math.cos(r.yaw) * r.speed * dt, 1.6, false); } r.cd -= dt;
        if (r.cd <= 0 && d < 70) { r.cd = (r.type === 'big' ? 1.1 : 1.6) + rnd() * 0.5; const sx = (rnd() - 0.5) * 0.14; const vx = Math.sin(r.yaw + sx); const vz = Math.cos(r.yaw + sx); const ty = target ? (P.mode === 'veh' ? (cur() && cur().kind === 'plane' ? P.y : 3) : 1.4) : 1.4; const dy = (ty - 3) / Math.max(10, d); S.bullets.push({ x: r.x, y: 3, z: r.z, vx: vx * 62, vy: dy * 62, vz: vz * 62, t: 0, dmg: r.type === 'big' ? 9 : 5, civ: !target }); snd('rshot'); } }
      else { const home = hyp(r.homeX - r.x, r.homeZ - r.z); if (r.t % 4 < dt || home > r.wander) { r.goal = { x: r.homeX + (rnd() - 0.5) * r.wander, z: r.homeZ + (rnd() - 0.5) * r.wander }; } if (r.goal) { const want = Math.atan2(r.goal.x - r.x, r.goal.z - r.z); r.yaw += clamp(angDiff(want, r.yaw), -2 * dt, 2 * dt); if (hyp(r.goal.x - r.x, r.goal.z - r.z) > 3) groundMove(r, r.x + Math.sin(r.yaw) * r.speed * 0.5 * dt, r.z + Math.cos(r.yaw) * r.speed * 0.5 * dt, 1.6, false); } }
    }
    for (const b of S.bullets) {
      b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      if (insideBuilding(b.x, b.z, b.y)) { b.t = 99; continue; }
      if (P.dead <= 0 && !b.civ) { const v = cur(); const py = v ? (v.kind === 'plane' ? P.y : 3) : 1.4; const rad = v ? (v.kind === 'ship' ? 14 : v.kind === 'tank' ? 7 : v.kind === 'plane' ? 8 : 4) : 1.6; if (hyp(b.x - P.x, b.z - P.z) < rad && Math.abs(b.y - py) < rad + 2) { hurtPlayer(b.dmg); b.t = 99; fx('spark', b.x, b.y, b.z, 4); } }
      if (b.civ) for (const c of S.civs) if (c.state === 'need' && hyp(b.x - c.x, b.z - c.z) < 1.8) { c.fear = 1; b.t = 99; }
    }
    S.bullets = S.bullets.filter((b) => b.t < 3.5);
  }
  function stepMissiles(dt) {
    for (const m of S.missiles) {
      m.t += dt; const tg = S.robots.find((r) => r.id === m.target);
      if (tg) { const vx = tg.x - m.x; const vy = 3 - m.y; const vz = tg.z - m.z; const d = hyp(vx, vy, vz) || 1; const k = clamp(4.2 * dt, 0, 1); const cur0 = hyp(m.vx, m.vy, m.vz) || 1; m.vx += ((vx / d) * cur0 - m.vx) * k; m.vy += ((vy / d) * cur0 - m.vy) * k; m.vz += ((vz / d) * cur0 - m.vz) * k; }
      m.x += m.vx * dt; m.y += m.vy * dt; m.z += m.vz * dt;
      const hit = S.robots.find((r) => hyp(r.x - m.x, r.z - m.z) < 7 && Math.abs(m.y - 3) < 9);
      if (hit || m.y < 0.5) { m.t = 99; fx('boom', m.x, Math.max(1, m.y), m.z, 14); snd('boom'); for (const r of S.robots.slice()) { const d = hyp(r.x - m.x, r.z - m.z); if (d < 16) { r.hp -= m.dmg * (d < 7 ? 1 : 0.4); r.alert = true; if (r.hp <= 0) koRobot(r); } } }
      if (insideBuilding(m.x, m.z, m.y)) { m.t = 99; fx('boom', m.x, m.y, m.z, 10); }
    }
    S.missiles = S.missiles.filter((m) => m.t < m.life);
  }
  function stepWorld(dt) {
    // ひろいもの
    for (const p of S.pickups.slice()) if (hyp(p.x - P.x, p.z - P.z) < (P.mode === 'veh' ? 7 : 3) && (P.y < 12 || P.mode === 'foot')) { S.pickups = S.pickups.filter((x) => x !== p); if (p.kind === 'gem') { ev({ t: 'gem', v: 1 }); snd('gem'); msg('💎 ほうせきを みつけた!', 2); P.coins += p.v; S.stats.coins += p.v; } else { P.coins += p.v; S.stats.coins += p.v; snd('coin'); } }
    // かざりの ひと・くるま
    for (const w of S.walkers) { const a = w.vert ? 'z' : 'x'; w[a] += w.dir * w.spd * dt; if (Math.abs(w[a]) > 600) w.dir *= -1; if (w.vert) { w.x = w.line; } else { w.z = w.line; } w.yaw = w.vert ? (w.dir > 0 ? 0 : Math.PI) : (w.dir > 0 ? Math.PI / 2 : -Math.PI / 2); if (isWater(w.x, w.z)) w.dir *= -1; }
    for (const c of S.traffic) {
      const ahead = c.pos + c.dir * 8; const px = c.vert ? c.line : ahead; const pz = c.vert ? ahead : c.line; let blocked = false;
      if (hyp(px - P.x, pz - P.z) < 7) blocked = true; for (const o of S.traffic) if (o !== c && hyp(px - o.x, pz - o.z) < 6) blocked = true; if (isWater(px, pz) || inRect(AIRFIELD, px, pz)) { c.dir *= -1; blocked = false; }
      c.wait = blocked ? Math.min(2, c.wait + dt) : 0; if (!blocked) c.pos += c.dir * c.spd * dt; if (Math.abs(c.pos) > 600) c.dir *= -1; c.x = c.vert ? c.line : c.pos; c.z = c.vert ? c.pos : c.line; c.yaw = c.vert ? (c.dir > 0 ? 0 : Math.PI) : (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    }
    // しみん(ミッション)
    for (const c of S.civs) {
      if (c.state === 'need') { c.fear = Math.max(0, c.fear - dt); }
      else if (c.state === 'carried') { const d = hyp(c.x - P.x, c.z - P.z); const want = Math.atan2(P.x - c.x, P.z - c.z); c.yaw = want; if (d > 5 && P.mode === 'foot') { const s = Math.min(d - 4, 9 * dt + d * dt * 1.5); c.x += Math.sin(want) * s; c.z += Math.cos(want) * s; } else if (P.mode === 'veh') { c.x = P.x; c.z = P.z; } if (isWater(c.x, c.z)) { c.x = P.x; c.z = P.z; } }
    }
    // ちかくの ロボットを ふやす(たまに「しんりゃく!」)
    if (!S.mission && S.t > 25 && S.robots.length < 3 && Math.floor(S.t) % 90 === 0 && S.t - (S.lastRaid || -999) > 60) { S.lastRaid = S.t; const a = rnd() * 6.28; for (let i = 0; i < 3; i++) spawnRobot(P.x + Math.cos(a) * 140 + i * 6, P.z + Math.sin(a) * 140, 'bot', 30); const bad = S.robots.filter((r) => isWater(r.x, r.z) || insideBuilding(r.x, r.z)); S.robots = S.robots.filter((r) => !bad.includes(r)); if (S.robots.length) { banner('⚠ ロボットが あらわれた!', 2.4); snd('warn'); } }
    // ほおって おいた のりものは ほんぶへ
    for (const v of S.vehicles) { if (v.occ) continue; const d = hyp(v.x - P.x, v.z - P.z); if (d > 120 && hyp(v.x - v.home.x, v.z - v.home.z) > 3) { v.away += dt; if (v.away > 30) { v.x = v.home.x; v.z = v.home.z; v.y = 0; v.yaw = v.home.yaw; v.speed = 0; v.away = 0; } } else v.away = 0; v.speed *= Math.exp(-2 * dt); if (!v.occ && v.kind === 'plane') { v.y = 0; } if (v.kind === 'plane' && !v.occ) { v.x = v.home.x; v.z = v.home.z; } }
    if (P.mode === 'foot' && hyp(P.x - HQ.x, P.z - HQ.z) < HQ.r && P.hp < P.hpMax) { P.hp = Math.min(P.hpMax, P.hp + 14 * dt); } // ほんぶで ゆっくり かいふく
    else if (P.mode === 'foot' && S.t - P.lastHurt > 6) P.hp = Math.min(P.hpMax, P.hp + 3 * dt);
    const v = cur(); if (v && v.V.missiles && (v.mis == null ? v.V.missiles : v.mis) < v.V.missiles) { v.misT = (v.misT || 0) + dt; if (v.misT > 6) { v.misT = 0; v.mis = (v.mis == null ? v.V.missiles : v.mis) + 1; } }
  }
  function stepMission(dt) {
    const M = S.mission; if (!M) return; M.t += dt; const m = missionOf(M.id); const v = cur(); const px = P.x; const pz = P.z;
    const reach = (t, r) => hyp(t.x - px, t.z - pz) < r;
    if (M.id === 'patrol') { const t = M.targets[M.stage]; if (t && reach(t, 18)) { M.stage++; M.got++; snd('coin'); msg(`${M.got}/${M.total} チェックポイント!`, 1.6); if (M.stage >= M.total) endMission(true); } }
    else if (M.id === 'harbor') { const t = M.targets[M.stage]; if (t && reach(t, 26)) { M.stage++; M.got++; snd('coin'); msg(`${M.got}/${M.total} ブイを まわった!`, 1.6); if (M.stage >= M.total) endMission(true); } else if (!v || (v.kind !== 'ship' && v.kind !== 'plane')) { if (M.t > 3 && M.stage === 0 && !M.warned) { M.warned = true; msg('⚓ ふねに のって うみへ!(みなとの ふね)', 3); } } }
    else if (M.id === 'sky') { const t = M.targets[M.stage]; if (t && v && v.kind === 'plane' && hyp(t.x - v.x, t.z - v.z) < 28 && Math.abs(t.y - v.y) < 30) { M.stage++; M.got++; snd('coin'); fx('spark', t.x, t.y, t.z, 8); msg(`${M.got}/${M.total} リング!`, 1.4); if (M.stage >= M.total) endMission(true); } }
    else if (M.id === 'rescue') {
      for (const c of S.civs) if (c.state === 'carried' && hyp(c.x - HQ.x, c.z - HQ.z) < HQ.r && hyp(px - HQ.x, pz - HQ.z) < HQ.r + 6) { c.state = 'safe'; M.got++; P.carry = Math.max(0, P.carry - 1); snd('coin'); msg(`${M.got}/${M.total} にん たすけた!`, 1.8); }
      S.civs = S.civs.filter((c) => c.state !== 'safe'); if (M.got >= M.total) endMission(true);
    } else if (M.id === 'invasion') { if (!S.robots.some((r) => r.mission)) endMission(true); }
    else if (M.id === 'delivery') {
      if (M.stage === 0 && false) void 0;
      if (M.stage === 1) { M.timeLeft -= dt; if (hyp(px - HQ.x, pz - HQ.z) < HQ.r) { endMission(true); return; } if (M.timeLeft <= 0) endMission(false, 'じかんぎれ! もういちど ちょうせん'); }
    }
    void m;
  }
  // ---- こうどう ----
  function interact() {
    if (P.dead > 0) return false; const n = S.nearby; if (!n) return false;
    if (n.kind === 'veh') { const v = S.vehicles.find((x) => x.id === n.id); if (v && !v.occ) { enter(v); return true; } }
    else if (n.kind === 'exit') { leave(); return true; }
    else if (n.kind === 'shop') { S.ui = 'shop'; ev({ t: 'shop' }); return true; }
    else if (n.kind === 'mission') { return startMission(n.id); }
    else if (n.kind === 'civ') { const c = S.civs.find((x) => x.id === n.id); if (c) { c.state = 'carried'; P.carry++; snd('coin'); msg('いっしょに ほんぶまで いこう!', 2); return true; } }
    else if (n.kind === 'pack') { const M = S.mission; if (M) { M.stage = 1; M.targets = [{ x: HQ.x, z: HQ.z }]; msg('📦 うけとった! ほんぶへ ダッシュ!', 2.4); snd('coin'); return true; } }
    return false;
  }
  function buy(id) {
    const it = SHOP.items.find((x) => x.id === id); if (!it) return { ok: false, why: 'ない' }; if (P.coins < it.cost) return { ok: false, why: 'コインが たりないよ' };
    if (id === 'heal') { if (P.hp >= P.hpMax) return { ok: false, why: 'もう げんきだよ' }; P.coins -= it.cost; P.hp = P.hpMax; return { ok: true }; }
    P.coins -= it.cost; ev({ t: 'buy', id }); return { ok: true };
  }
  function step(dtIn) {
    const dt = Math.min(dtIn, 1 / 20); S.t += dt; if (S.msgT > 0) S.msgT -= dt; if (S.bannerT > 0) S.bannerT -= dt;
    for (let i = S.effects.length - 1; i >= 0; i--) { S.effects[i].t += dt; if (S.effects[i].t > S.effects[i].life) S.effects.splice(i, 1); }
    S.tracers = S.tracers.filter((tr) => { tr.t += dt; return tr.t < 0.1; });
    if (P.invuln > 0) P.invuln -= dt; if (P.hurt > 0) { P.hurt -= dt; P.lastHurt = S.t; } if (P.missileCd > 0) P.missileCd -= dt;
    if (P.dead > 0) { P.dead -= dt; if (P.dead <= 0) respawn(); stepRobots(dt); return; }
    if (Math.abs(input.aimX) + Math.abs(input.aimY) > 0.05) P.noAim = 0; else P.noAim += dt;
    const v0 = cur(); if (!v0 || v0.kind === 'tank' || v0.kind === 'ship' || v0.kind === 'car' || !v0) { P.aimRel = clamp(P.aimRel + input.aimX * 1.7 * dt, -2.4, 2.4); P.aimPitch = clamp(P.aimPitch + input.aimY * 0.9 * dt, -0.2, 1.2); }
    movePlayer(dt); setNear();
    const v = cur(); const canFire = !(v && v.kind === 'plane' && false); if (input.gun && canFire) fireGun(dt);
    stepRobots(dt); stepMissiles(dt); stepWorld(dt); stepMission(dt);
    S.player.target = nearestRobot(600, 6.3, P.yaw);
    if (v && v.kind === 'plane' && P.y < 7) { /* ちかい */ }
  }
  S.player.lastHurt = -99;
  return {
    state: S, input, step, interact, fireMissile, startMission, cancelMission, buy, vehicleOf: cur, footStats: FS,
    takeEvents() { const e = S.events; S.events = []; return e; },
    aimAt(r) { if (!r) return; P.aimRel = clamp(angDiff(Math.atan2(r.x - P.x, r.z - P.z), cur() ? cur().yaw : P.yaw), -2.4, 2.4); P.aimPitch = clamp(Math.atan2(3 - 4, Math.hypot(r.x - P.x, r.z - P.z)), -0.2, 1.2); },
    closeUi() { S.ui = null; },
  };
}
