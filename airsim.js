// 「そらの まもり」(エースコンバット・アーマードコアふうの ゲームモード)の ルールと うごき。画面(three.js)には さわらない。node で テストできる。
//   しゅじんこう(パパ・ひびと・ゆいと)が メイン。ガチャの キャラは「ぶひん」(きかんじゅう・ミサイル・つばさ・びよく・そうこう)として そうびする。
//   きたいは 3しゅるい: ひこうき / ふね / せんしゃ。どれでも クリアできるが、てきの しゅるい(くう・うみ・りく)で あいしょうが ある。
//   const sim = createAir({ vehicle, mission, rnd, gentle });   sim.input = { turn, climb(=スロットル), gun, boost };  sim.fireMissile();  sim.evade();  sim.nextTarget();  sim.step(dt)
//   ざひょう: x=よこ, y=たかさ, z=おく。きちは (0,0,BASE_Z)。しまの はんけい ISLAND(りく)のそとが うみ。
export const BASE_Z = 700;
export const ISLAND = 660;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const dirOf = (yaw, pitch) => ({ x: Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: Math.cos(yaw) * Math.cos(pitch) });
const norm = (v) => { const m = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / m, y: v.y / m, z: v.z / m }; };
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// ---- きたいと ぶひん ---------------------------------------------------------------------
export const VEHICLES = {
  plane: { id: 'plane', name: 'ひこうき', icon: '✈️', note: 'はやくて どこへでも いける。そうこうは うすい。くうの てきに つよい' },
  ship: { id: 'ship', name: 'ふね', icon: '🚢', note: 'うみの うえ。ながい きょりの ほうげき。そうこうが あつい。うみの てきに つよい' },
  tank: { id: 'tank', name: 'せんしゃ', icon: '🚜', note: 'しまの うえ。いちばん かたい。りくの てきに つよいが、くうは にがて' },
};
// ぶひんの スロット(のうりょくが ちがう): stat=つかう のうりょく / match=ぴったりの ポジション(×1.2)
export const SLOTS = {
  plane: [
    { id: 'gun', name: 'きかんじゅう', icon: '🔫', stat: 'SHO', match: ['FW'], note: 'かりょく' },
    { id: 'missile', name: 'ミサイル', icon: '🚀', stat: 'PAS', match: ['MF'], note: 'ロックオン・かず・いりょく' },
    { id: 'mobility', name: 'つばさ', icon: '🪽', stat: 'SPD', match: ['FW', 'GK'], note: 'スピード・ちいさく まがれる' },
    { id: 'support', name: 'びよく', icon: '🔱', stat: 'STA', match: ['MF', 'GK'], note: 'ブースト・かいひの もち' },
    { id: 'armor', name: 'そうこう', icon: '🛡️', stat: 'DEF', match: ['DF', 'GK'], note: 'きたいの いのち' },
  ],
  ship: [
    { id: 'gun', name: 'しゅほう', icon: '🔫', stat: 'SHO', match: ['FW'], note: 'かりょく' },
    { id: 'missile', name: 'ミサイルはっしゃかん', icon: '🚀', stat: 'PAS', match: ['MF'], note: 'ロックオン・かず・いりょく' },
    { id: 'mobility', name: 'スクリュー', icon: '🌀', stat: 'SPD', match: ['FW', 'GK'], note: 'スピード' },
    { id: 'support', name: 'レーダー', icon: '📡', stat: 'STA', match: ['MF', 'GK'], note: 'ブースト・かいひの もち' },
    { id: 'armor', name: 'そうこうばん', icon: '🛡️', stat: 'DEF', match: ['DF', 'GK'], note: 'ふねの いのち' },
  ],
  tank: [
    { id: 'gun', name: 'せんしゃほう', icon: '🔫', stat: 'SHO', match: ['FW'], note: 'かりょく' },
    { id: 'missile', name: 'ミサイルポッド', icon: '🚀', stat: 'PAS', match: ['MF'], note: 'ロックオン・かず・いりょく' },
    { id: 'mobility', name: 'キャタピラ', icon: '⚙️', stat: 'SPD', match: ['FW', 'GK'], note: 'スピード' },
    { id: 'support', name: 'センサー', icon: '📡', stat: 'STA', match: ['MF', 'GK'], note: 'ブースト・かいひの もち' },
    { id: 'armor', name: 'そうこう', icon: '🛡️', stat: 'DEF', match: ['DF', 'GK'], note: 'せんしゃの いのち' },
  ],
};
export const RARITY_MUL = { common: 0.85, uncommon: 0.95, rare: 1.05, super: 1.2, legend: 1.4, diamond: 1.7 };
export const RARITY_NAME = { common: 'コモン', uncommon: 'アンコモン', rare: 'レア', super: 'スーパーレア', legend: 'レジェンド', diamond: 'ダイヤモンド' };
export const RARITY_RANK = { common: 0, uncommon: 1, rare: 2, super: 3, legend: 4, diamond: 5 };
// ぶひん 1こ の つよさ = そのキャラの のうりょく × レアどの ばいりつ × (ポジションが ぴったりなら 1.2)
export function partOf(vehicle, slotId, ch) {
  const slot = SLOTS[vehicle].find((s) => s.id === slotId); if (!slot || !ch) return null;
  const fit = slot.match.includes(ch.pos); const power = ch.stats[slot.stat] * (RARITY_MUL[ch.rarity] || 1) * (fit ? 1.2 : 1);
  return { slot: slotId, charId: ch.id, name: ch.name, face: ch.face || '', img: ch.img || '', rarity: ch.rarity, pos: ch.pos, fit, power: Math.round(power), stat: slot.stat };
}
// ばあいごとの あいしょう(ばいりつ)
const GUN_VS = { plane: { air: 1, sea: 0.9, ground: 0.9 }, ship: { air: 0.45, sea: 1.5, ground: 1.1 }, tank: { air: 0.28, sea: 1.3, ground: 1.7 } };
const GUN_RANGE = { plane: { air: 650, sea: 650, ground: 650 }, ship: { air: 520, sea: 950, ground: 900 }, tank: { air: 380, sea: 720, ground: 720 } };
const MIS_VS = { plane: { air: 1, sea: 0.9, ground: 0.9 }, ship: { air: 1.3, sea: 1, ground: 0.8 }, tank: { air: 0.85, sea: 0.8, ground: 1.2 } };
const MIS_RANGE = { plane: 1300, ship: 1600, tank: 1200 };

// しゅじんこう(kidStats)と ぶひん(loadout={slot: charInfo})から きたいの せいのうを つくる
export function buildVehicle({ vehicle = 'plane', name = '', face = '', img = '', kidStats, parts = {} }) {
  const ks = kidStats; const P = (id) => parts[id] ? parts[id].power : 0;
  const gun = P('gun'); const mis = P('missile'); const mob = P('mobility'); const sup = P('support'); const arm = P('armor');
  const base = {
    plane: { spd: 66 + ks.SPD * 0.12 + mob * 0.2, hp: 110 + ks.DEF * 1.4 + arm * 2.2, turn: 1.15 },
    ship: { spd: 17 + ks.SPD * 0.05 + mob * 0.07, hp: 220 + ks.DEF * 2.4 + arm * 3.4, turn: 0.5 },
    tank: { spd: 11 + ks.SPD * 0.04 + mob * 0.06, hp: 260 + ks.DEF * 2.8 + arm * 4.0, turn: 1.0 },
  }[vehicle];
  const mult = vehicle === 'plane' ? 1.25 : 1;
  const misPow = mis + ks.PAS * 0.25;
  const v = {
    vehicle, name, face, img, parts, kidStats: ks,
    speed: Math.round(base.spd * 10) / 10, turn: base.turn, hpMax: Math.round(base.hp),
    gunDps: Math.round((24 + ks.SHO * 0.18 + gun * 0.5) * mult),
    missileDmg: Math.round(62 + ks.SHO * 0.3 + misPow * 0.55),
    misRange: Math.round(MIS_RANGE[vehicle] * clamp(0.8 + misPow / 220, 0.8, 1.5)), gunRangeMul: Math.round(clamp(0.85 + (gun + ks.SHO * 0.5) / 300, 0.85, 1.35) * 100) / 100,
    missiles: 3 + Math.floor(misPow / 30) + (vehicle === 'plane' ? 0 : 2), locks: clamp(1 + Math.floor(misPow / 50), 1, 6),
    lockTime: clamp(1.2 - ks.PAS * 0.002 - mis * 0.004, 0.3, 1.2),
    boostMax: Math.round(50 + ks.STA * 0.5 + sup * 0.7), evadeCd: clamp(4.6 - sup * 0.016, 1.8, 4.6),
  };
  v.rating = Math.round((v.gunDps * 1.3 + v.missileDmg * 0.5 + v.hpMax * (vehicle === 'plane' ? 0.35 : 0.18) + v.speed * (vehicle === 'plane' ? 0.5 : 1.4) + v.locks * 6) / 3.6);
  return v;
}
// いちばん いい ぶひんを じどうで えらぶ(おまかせ そうび): いろんな ポジションの キャラが ぴったりに なる ように
export function autoLoadout(vehicle, chars) {
  const used = new Set(); const out = {};
  const order = ['armor', 'gun', 'missile', 'mobility', 'support'];
  for (const sid of order) {
    let best = null; let bs = -1;
    for (const ch of chars) { if (used.has(ch.id)) continue; const pt = partOf(vehicle, sid, ch); if (pt && pt.power > bs) { bs = pt.power; best = ch; } }
    if (best) { used.add(best.id); out[sid] = best.id; }
  }
  return out;
}

// ---- ミッション ---------------------------------------------------------------------------
// waves: [{ t, type, n }]  type: drone/fighter/bomber/boat/destroyer/etank/boss。てきの しゅるいで きたいの あいしょうが かわる
export const ENEMY = {
  drone: { dom: 'air', hp: 26, speed: 62, size: 4, score: 10, base: 22, icon: '✈️' },
  fighter: { dom: 'air', hp: 78, speed: 82, size: 7, score: 30, fire: 1.5, dmg: 7, icon: '✈️' },
  bomber: { dom: 'air', hp: 210, speed: 44, size: 14, score: 50, base: 44, icon: '✈️' },
  boat: { dom: 'sea', hp: 150, speed: 20, size: 14, score: 30, fire: 2.4, dmg: 11, baseDmg: 18, icon: '🚢' },
  destroyer: { dom: 'sea', hp: 520, speed: 11, size: 30, score: 80, fire: 3, dmg: 18, baseDmg: 40, icon: '🚢' },
  etank: { dom: 'ground', hp: 150, speed: 10, size: 10, score: 40, fire: 1.6, dmg: 12, baseDmg: 26, icon: '🚜' },
  boss: { dom: 'air', hp: 1500, speed: 18, size: 60, score: 300, fire: 0.7, dmg: 9, icon: '👾' },
};
export const MISSIONS = [
  { id: 'm1', name: 'はじめての パトロール', icon: '🌊', brief: 'ふめいの ドローンと ボートが きちに ちかづいて いる! やっつけて きちを まもろう。', baseHp: 280,
    waves: [{ t: 2, type: 'drone', n: 3 }, { t: 12, type: 'boat', n: 2 }, { t: 24, type: 'drone', n: 4 }, { t: 38, type: 'etank', n: 2 }], reward: { bronze: 2, pts: 8 }, first: { bronze: 3, silver: 1 } },
  { id: 'm2', name: 'そらを まもれ', icon: '🛡️', brief: 'ドローンの むれと 戦闘機が せまって くる。ロックして うちおとそう。', baseHp: 300,
    waves: [{ t: 2, type: 'drone', n: 5 }, { t: 14, type: 'fighter', n: 2 }, { t: 28, type: 'boat', n: 2 }, { t: 40, type: 'drone', n: 6 }, { t: 54, type: 'fighter', n: 3 }], reward: { bronze: 2, silver: 1, pts: 12 }, first: { silver: 2, gold: 1 } },
  { id: 'm3', name: 'うみから くる てき', icon: '⚓', brief: 'ふめいの ぐんかんと ボートが うみから せまって くる! うみの てきを ふせごう。', baseHp: 320,
    waves: [{ t: 2, type: 'boat', n: 3 }, { t: 16, type: 'destroyer', n: 1 }, { t: 30, type: 'drone', n: 5 }, { t: 44, type: 'boat', n: 3 }, { t: 58, type: 'destroyer', n: 1 }], reward: { silver: 2, pts: 16 }, first: { gold: 2 } },
  { id: 'm4', name: 'じょうりくを とめろ', icon: '🏖️', brief: 'はまべから せんしゃが じょうりく! きちに つく まえに たおそう。', baseHp: 330,
    waves: [{ t: 2, type: 'etank', n: 3 }, { t: 18, type: 'bomber', n: 2 }, { t: 30, type: 'etank', n: 4 }, { t: 46, type: 'drone', n: 6 }, { t: 60, type: 'etank', n: 4 }], reward: { gold: 1, silver: 2, pts: 20 }, first: { gold: 2, platinum: 1 } },
  { id: 'm5', name: 'エースへの みち', icon: '⚡', brief: 'てきの エース部隊が とうじょう。くう・うみ・りくから いっぺんに くるぞ!', baseHp: 360,
    waves: [{ t: 2, type: 'fighter', n: 3 }, { t: 14, type: 'etank', n: 3 }, { t: 26, type: 'destroyer', n: 1 }, { t: 40, type: 'bomber', n: 3 }, { t: 54, type: 'fighter', n: 4 }, { t: 66, type: 'boat', n: 3 }], reward: { gold: 1, silver: 2, pts: 26 }, first: { gold: 2, platinum: 1 } },
  { id: 'm6', name: 'きょだい ぼかん', icon: '🚢', brief: 'うみの むこうから きょだいな くうちゅう ぼかんが やって きた! ボスを たおして にっぽんを まもれ!', baseHp: 400, boss: true,
    waves: [{ t: 2, type: 'drone', n: 4 }, { t: 6, type: 'boat', n: 2 }, { t: 16, type: 'boss', n: 1 }], reward: { gold: 2, platinum: 1, pts: 38 }, first: { platinum: 3, shards: 10 } },
];
export const missionById = (id) => MISSIONS.find((m) => m.id === id);
export const missionMix = (m) => { const c = { air: 0, sea: 0, ground: 0 }; for (const w of m.waves) c[ENEMY[w.type].dom] += w.n; return c; };

// ---- しあいの ほんたい ---------------------------------------------------------------------
export function createAir({ vehicle: V, mission, rnd = Math.random, gentle = false, difficulty = 1 }) {
  const M = mission; const kind = V.vehicle; const hpScale = gentle ? 1.45 : 1; const enemyDmg = (gentle ? 0.6 : 1) * difficulty;
  const air = kind === 'plane';
  const start = kind === 'plane' ? { x: 0, y: 260, z: 120 } : kind === 'tank' ? { x: 0, y: 0, z: BASE_Z + 60 } : { x: 0, y: 0, z: BASE_Z + ISLAND + 240 };
  const S = {
    ph: 'brief', t: 0, kills: 0, score: 0, done: false, win: false, banner: '', bannerT: 0, msg: '', msgT: 0, vehicle: kind,
    player: { ...start, yaw: 0, pitch: 0, roll: 0, speed: 0, hp: V.hpMax * hpScale, hpMax: V.hpMax * hpScale, boost: V.boostMax, boosting: false, invuln: 0, evadeCd: 0, missiles: V.missiles, mRegen: 0, lockTarget: [], lockT: new Map(), firing: false, turretYaw: 0, radius: air ? 9 : kind === 'ship' ? 24 : 12, cy: air ? 0 : 4 },
    base: { x: 0, y: 0, z: BASE_Z, hp: M.baseHp, hpMax: M.baseHp },
    enemies: [], bullets: [], missiles: [], effects: [], tracers: [], snd: [], waveI: 0, boss: null, target: null, targetIdx: 0,
  };
  if (air) S.player.speed = V.speed;
  const input = { turn: 0, climb: 0, gun: false, boost: false };
  const snd = (n) => { if (S.snd.length < 30) S.snd.push(n); };
  const fx = (kindFx, pos, r = 10) => { if (S.effects.length < 80) S.effects.push({ kind: kindFx, x: pos.x, y: pos.y, z: pos.z, r, t: 0, life: kindFx === 'big' ? 1.4 : 0.7 }); };
  const msg = (t, d = 2.5) => { S.msg = t; S.msgT = d; };
  const banner = (t, d = 2.2) => { S.banner = t; S.bannerT = d; };
  let spawnId = 0;

  function spawn(type, i, n) {
    const E = ENEMY[type]; const ang = (i / Math.max(1, n) - 0.5) * 1.6 + (rnd() - 0.5) * 0.4;
    const e = { id: ++spawnId, type, dom: E.dom, x: Math.sin(ang) * (500 + rnd() * 500), y: 0, z: BASE_Z + 1250 + rnd() * 450, yaw: Math.PI, pitch: 0, hp: E.hp * (difficulty > 1 ? 1.2 : 1), hpMax: E.hp, speed: E.speed * (0.9 + rnd() * 0.25), cd: 1 + rnd() * 1.5, target: rnd() < 0.55 ? 'base' : 'player', t: 0, ph: rnd() * 6.28, spawnCd: 6, orbit: rnd() < 0.5 ? 1 : -1, stop: false };
    if (E.dom === 'air') e.y = 140 + rnd() * 320;
    if (type === 'boat' || type === 'destroyer') { e.x = Math.sin(ang) * (700 + rnd() * 500); e.z = BASE_Z + ISLAND + 700 + rnd() * 500; e.target = 'base'; e.stopR = (type === 'destroyer' ? 1180 : 980) + rnd() * 60; }
    if (type === 'etank') { e.x = Math.sin(ang) * (250 + rnd() * 120); e.z = BASE_Z + ISLAND - 20 - rnd() * 40; e.target = 'base'; e.yaw = Math.PI; e.y = 0; }
    if (type === 'boss') { e.x = 0; e.y = 260; e.z = BASE_Z + 1500; e.target = 'base'; S.boss = e; banner('⚠ ボスが きた!', 2.6); snd('warn'); }
    S.enemies.push(e); return e;
  }

  // ---- ねらい・ロック ----------------------------------------------------------------
  const inRangeGun = (P, e) => { const d = Math.hypot(e.x - P.x, e.y - P.y, e.z - P.z); return d <= GUN_RANGE[kind][e.dom] * (V.gunRangeMul || 1) && GUN_VS[kind][e.dom] > 0.2; };
  function chooseTarget() { // ふねと せんしゃ: じどうで ねらう(ちかい じゅん)。ボタンで つぎの てきへ
    if (air) { S.target = null; return; }
    const P = S.player; const c = S.enemies.filter((e) => inRangeGun(P, e)).sort((a, b) => dist(a, P) - dist(b, P));
    if (!c.length) { S.target = null; return; }
    const keep = S.target && c.find((e) => e.id === S.target.id); S.target = keep || c[Math.min(S.targetIdx, c.length - 1)]; if (!keep) S.targetIdx = 0;
  }
  function nextTarget() { if (air) return; const P = S.player; const c = S.enemies.filter((e) => inRangeGun(P, e)).sort((a, b) => dist(a, P) - dist(b, P)); if (!c.length) return; const i = c.findIndex((e) => S.target && e.id === S.target.id); S.target = c[(i + 1) % c.length]; }
  function updateLock(dt) {
    const P = S.player; const fwd = dirOf(P.yaw, P.pitch); const R = V.misRange || MIS_RANGE[kind];
    let cands;
    if (air) cands = S.enemies.map((e) => { const v = { x: e.x - P.x, y: e.y - P.y, z: e.z - P.z }; const d = Math.hypot(v.x, v.y, v.z); const c = (v.x * fwd.x + v.y * fwd.y + v.z * fwd.z) / (d || 1); return { e, d, ang: Math.acos(clamp(c, -1, 1)) }; }).filter((c) => c.d < R && c.ang < 0.5).sort((a, b) => a.ang - b.ang || a.d - b.d);
    else cands = S.enemies.map((e) => ({ e, d: dist(e, P), ang: 0 })).filter((c) => c.d < R).sort((a, b) => ((S.target && b.e.id === S.target.id) - (S.target && a.e.id === S.target.id)) || a.d - b.d);
    cands = cands.slice(0, V.locks); const keep = new Map();
    for (const c of cands) keep.set(c.e.id, Math.min((P.lockT.get(c.e.id) || 0) + dt, V.lockTime + 0.05));
    P.lockT = keep; P.lockTarget = cands.filter((c) => keep.get(c.e.id) >= V.lockTime).map((c) => c.e);
    S.lockCands = cands.map((c) => ({ id: c.e.id, locked: keep.get(c.e.id) >= V.lockTime, p: Math.min(1, keep.get(c.e.id) / V.lockTime) }));
  }
  function fireMissile() {
    const P = S.player; if (S.done || S.ph !== 'play' || P.missiles <= 0) return false;
    const targets = P.lockTarget.length ? P.lockTarget.slice() : [null]; let n = 0;
    for (const e of targets) { if (P.missiles <= 0) break; P.missiles--; n++;
      const aim = e ? norm({ x: e.x - P.x, y: e.y - P.y - (air ? 0 : 10), z: e.z - P.z }) : dirOf(P.yaw, air ? P.pitch : 0.4);
      const d = air ? aim : norm({ x: aim.x, y: Math.max(aim.y, 0.45), z: aim.z });
      S.missiles.push({ x: P.x + d.x * 12, y: P.y + (air ? d.y * 12 - 2 : 12), z: P.z + d.z * 12, vx: d.x * 240, vy: d.y * 240, vz: d.z * 240, target: e ? e.id : null, t: 0, life: 8, dmg: V.missileDmg }); }
    if (n) snd('missile'); return n > 0;
  }
  function evade() { const P = S.player; if (P.evadeCd > 0 || S.done) return false; P.invuln = air ? 0.9 : 1.3; P.evadeCd = V.evadeCd; P.rollSpin = air ? 1 : 0; S.shield = P.invuln; snd('evade'); return true; }

  // ---- ダメージ ---------------------------------------------------------------------
  const damageEnemy = (e, d) => { if (e.hp <= 0) return; e.hp -= d; if (e.hp <= 0) killEnemy(e); };
  function killEnemy(e) { e.hp = 0; e.dead = true; S.kills++; S.score += ENEMY[e.type].score; fx(e.type === 'boss' ? 'big' : 'boom', e, ENEMY[e.type].size * 1.6); snd(e.type === 'boss' ? 'bigboom' : 'boom'); if (e.type === 'boss') endMission(true); }
  function hurtPlayer(d) { const P = S.player; if (P.invuln > 0 || S.done) return; P.hp -= d * enemyDmg; snd('hit'); S.hurt = 0.35; if (P.hp <= 0) { P.hp = 0; fx('big', P, 20); endMission(false, 'きたいが こわれた…'); } }
  function hurtBase(d) { const B = S.base; if (S.done) return; B.hp -= d; S.baseHurt = 0.5; snd('basehit'); if (B.hp <= 0) { B.hp = 0; endMission(false, 'きちが やられた…'); } }
  function endMission(win, why = '') {
    if (S.done) return; S.done = true; S.win = win; S.ph = win ? 'win' : 'lose'; S.endT = 0; banner(win ? 'ミッション クリア!' : 'ミッション しっぱい', 3); if (!win) msg(why, 3);
    const hpPct = S.player.hp / S.player.hpMax; const bPct = S.base.hp / S.base.hpMax; S.stars = !win ? 0 : bPct >= 0.7 && hpPct >= 0.5 ? 3 : bPct >= 0.4 ? 2 : 1; snd(win ? 'win' : 'lose');
  }

  // ---- 1フレーム ----------------------------------------------------------------------
  function movePlayer(dt) {
    const P = S.player;
    const boosting = input.boost && P.boost > 1; P.boosting = boosting; P.boost = clamp(P.boost + (boosting ? -26 : 10) * dt, 0, V.boostMax);
    if (air) {
      const sp = V.speed * (boosting ? 1.65 : 1) * (input.climb < -0.4 ? 1.12 : input.climb > 0.4 ? 0.92 : 1); P.speed = lerp(P.speed, sp, 1 - Math.exp(-2.4 * dt));
      P.yaw += input.turn * V.turn * dt; P.pitch = clamp(P.pitch + input.climb * 0.95 * dt, -0.95, 0.95); if (Math.abs(input.climb) < 0.12) P.pitch *= Math.exp(-0.9 * dt);
      P.roll = lerp(P.roll, -input.turn * 0.95, 1 - Math.exp(-5 * dt)); if (P.rollSpin) P.rollSpin = Math.max(0, P.rollSpin - dt / 0.75);
      const f = dirOf(P.yaw, P.pitch); P.x += f.x * P.speed * dt; P.y += f.y * P.speed * dt; P.z += f.z * P.speed * dt;
      if (P.y < 55) { P.pitch = lerp(P.pitch, 0.35, 1 - Math.exp(-3 * dt)); if (P.y < 14) { P.y = 14; S.groundWarn = 1; hurtPlayer(6 * dt * 12); } }
      P.y = Math.min(P.y, 1500);
      const r = Math.hypot(P.x, P.z - BASE_Z); if (r > 3200) { const want = Math.atan2(-P.x, BASE_Z - P.z); P.yaw += clamp(angDiff(want, P.yaw), -1.6 * dt, 1.6 * dt) * 3; S.outWarn = 1; } else S.outWarn = 0;
      return;
    }
    // ふね・せんしゃ: スティック うえ=すすむ/した=さがる、よこ=まわる
    const max = V.speed * (boosting ? 1.6 : 1); const want = input.climb >= 0 ? input.climb * max : input.climb * max * 0.35;
    P.speed = lerp(P.speed, want, 1 - Math.exp(-(kind === 'tank' ? 3.2 : 1.4) * dt));
    P.yaw += input.turn * V.turn * dt * (0.45 + Math.min(1, Math.abs(P.speed) / (V.speed * 0.5)) * 0.55) * (P.speed < -0.5 ? -1 : 1);
    P.x += Math.sin(P.yaw) * P.speed * dt; P.z += Math.cos(P.yaw) * P.speed * dt; P.roll = lerp(P.roll, -input.turn * 0.12, 1 - Math.exp(-4 * dt));
    const dx = P.x; const dz = P.z - BASE_Z; const r = Math.hypot(dx, dz) || 1;
    if (kind === 'tank' && r > ISLAND - 20) { P.x = (dx / r) * (ISLAND - 20); P.z = BASE_Z + (dz / r) * (ISLAND - 20); S.outWarn = 0; S.shoreWarn = 1; }
    if (kind === 'ship') { if (r < ISLAND + 70) { P.x = (dx / r) * (ISLAND + 70); P.z = BASE_Z + (dz / r) * (ISLAND + 70); S.shoreWarn = 1; } if (r > 3000) { P.x = (dx / r) * 3000; P.z = BASE_Z + (dz / r) * 3000; S.outWarn = 1; } else S.outWarn = 0; }
  }

  function step(dtIn) {
    const dt = Math.min(dtIn, 1 / 20); if (S.ph === 'brief') { S.ph = 'play'; banner(`${M.icon} ${M.name}`, 2.4); }
    if (S.bannerT > 0) S.bannerT -= dt; if (S.msgT > 0) S.msgT -= dt; if (S.hurt > 0) S.hurt -= dt; if (S.baseHurt > 0) S.baseHurt -= dt; if (S.shield > 0) S.shield -= dt;
    for (let i = S.effects.length - 1; i >= 0; i--) { S.effects[i].t += dt; if (S.effects[i].t > S.effects[i].life) S.effects.splice(i, 1); }
    S.tracers = S.tracers.filter((tr) => { tr.t += dt; return tr.t < 0.12; });
    if (S.done) { S.endT += dt; return; }
    S.t += dt; const P = S.player;
    movePlayer(dt);
    if (P.invuln > 0) P.invuln -= dt; if (P.evadeCd > 0) P.evadeCd -= dt;
    P.mRegen += dt; if (P.mRegen > (air ? 6 : 5) && P.missiles < V.missiles) { P.missiles++; P.mRegen = 0; }
    chooseTarget(); updateLock(dt);
    // ---- きかんほう ----
    P.firing = !!input.gun;
    if (air) {
      const fwd = dirOf(P.yaw, P.pitch);
      if (input.gun) {
        let best = null; let ba = 0.13;
        for (const e of S.enemies) { const hd = Math.hypot(e.x - P.x, e.z - P.z); const ty = e.dom === 'air' ? e.y : Math.max(e.y, P.y - 0.25 * hd); /* うみ・りくの てきは あさい かくどで ねらえる */ const v = { x: e.x - P.x, y: ty - P.y, z: e.z - P.z }; const d = Math.hypot(v.x, v.y, v.z); if (d > 650) continue; const c = (v.x * fwd.x + v.y * fwd.y + v.z * fwd.z) / (d || 1); const a = Math.acos(clamp(c, -1, 1)) - ENEMY[e.type].size / d; if (a < ba) { ba = a; best = e; } }
        if (best) damageEnemy(best, V.gunDps * GUN_VS.plane[best.dom] * dt);
        if (S.t % 0.07 < dt) S.tracers.push({ from: { x: P.x + fwd.x * 8, y: P.y + fwd.y * 8 - 1.5, z: P.z + fwd.z * 8 }, to: best ? { x: best.x, y: best.dom === 'air' ? best.y : Math.max(best.y, P.y - 0.25 * Math.hypot(best.x - P.x, best.z - P.z)) , z: best.z } : { x: P.x + fwd.x * 520, y: P.y + fwd.y * 520, z: P.z + fwd.z * 520 }, t: 0 });
        if (S.t % 0.18 < dt) snd('gun');
      }
    } else {
      const tg = S.target; if (tg) P.turretYaw = Math.atan2(tg.x - P.x, tg.z - P.z); else P.turretYaw = lerp(P.turretYaw, P.yaw, 0.1);
      if (input.gun && tg) {
        damageEnemy(tg, V.gunDps * GUN_VS[kind][tg.dom] * dt);
        if (S.t % 0.12 < dt) S.tracers.push({ from: { x: P.x, y: P.y + 8, z: P.z }, to: { x: tg.x, y: tg.y + 3, z: tg.z }, t: 0 });
        if (S.t % 0.22 < dt) snd(kind === 'tank' ? 'boom' : 'gun');
      }
    }
    // ---- ウェーブ ----
    while (S.waveI < M.waves.length && S.t >= M.waves[S.waveI].t) { const w = M.waves[S.waveI++]; for (let i = 0; i < w.n; i++) spawn(w.type, i, w.n); if (w.type !== 'boss') msg(`${ENEMY[w.type].icon} てきが ${w.n}たい ちかづいて いる!`); snd('warn'); }
    // ---- てき ----
    const B = S.base; const lastT = M.waves[M.waves.length - 1].t; const late = S.t > lastT + 55; // さいごの ウェーブから 55びょう すぎたら のこりの てきは つっこんで くる
    for (const e of S.enemies) {
      e.t += dt; const E = ENEMY[e.type]; if (late && E.dom === 'air' && e.type !== 'boss' && e.type !== 'drone') e.target = 'player'; if (e.type === 'drone' && e.target === 'player') { e.chase = (e.chase || 0) + dt; if (e.chase > 9) e.target = 'base'; } // ドローンは 9びょう おいかけて あたらなかったら きちへ if (late && E.dom === 'sea') e.stopR = Math.max(700, e.stopR - 80 * dt);
      let tgt = e.target === 'player' ? P : B; if (e.type === 'bomber' || e.type === 'boss' || E.dom !== 'air') tgt = B;
      if (e.type === 'boss') { // ボス: きちの ほうへ ゆっくり すすみ、ずっと たまを うつ。ときどき ドローンを だす
        e.x = Math.sin(e.t * 0.12) * 300; e.z = Math.max(BASE_Z + 430, e.z - E.speed * dt); e.y = 230 + Math.sin(e.t * 0.3) * 30; e.yaw = Math.PI;
        e.cd -= dt; const rage = e.hp < e.hpMax * 0.5 ? 1.6 : 1;
        if (e.cd <= 0) { e.cd = E.fire / rage; const v = norm({ x: P.x - e.x + (rnd() - 0.5) * 60, y: P.y + P.cy - e.y, z: P.z - e.z }); for (const off of [-1, 1]) S.bullets.push({ x: e.x + off * 30, y: e.y - 8, z: e.z - 30, vx: v.x * 230, vy: v.y * 230, vz: v.z * 230, t: 0, dmg: E.dmg, own: 'e' }); }
        e.spawnCd -= dt; if (e.spawnCd <= 0 && S.enemies.filter((x) => x.type === 'drone' && !x.dead).length < 8) { e.spawnCd = 9; for (let i = 0; i < 2; i++) { const d = spawn('drone', i, 2); d.x = e.x + (i ? 40 : -40); d.y = e.y; d.z = e.z - 40; } }
        if (e.z <= BASE_Z + 900) hurtBase(3.4 * dt); continue;
      }
      if (E.dom === 'sea') { // うみの てき: きちに ちかづき、とまって ほうげき
        const r = Math.hypot(e.x - B.x, e.z - B.z); const want = Math.atan2(B.x - e.x, B.z - e.z);
        if (r > e.stopR) { e.yaw += clamp(angDiff(want, e.yaw), -0.5 * dt, 0.5 * dt); e.x += Math.sin(e.yaw) * e.speed * dt; e.z += Math.cos(e.yaw) * e.speed * dt; } else e.stop = true;
        e.cd -= dt; const dp = flat(e, P);
        if (e.cd <= 0) { e.cd = E.fire + rnd() * 0.6; if (e.stop) hurtBase(E.baseDmg); if (kind !== 'plane' || dp < 600) { if (dp < 900) { const v = norm({ x: P.x - e.x, y: P.y + P.cy + 4 - 6, z: P.z - e.z }); S.bullets.push({ x: e.x, y: 8, z: e.z, vx: v.x * 220, vy: v.y * 220, vz: v.z * 220, t: 0, dmg: E.dmg, own: 'e' }); } } }
        continue;
      }
      if (E.dom === 'ground') { // りくの てき: はまから きちへ。ちかづくと うつ
        const r = Math.hypot(e.x - B.x, e.z - B.z); const want = Math.atan2(B.x - e.x, B.z - e.z);
        if (r > 140) { e.yaw += clamp(angDiff(want, e.yaw), -1.0 * dt, 1.0 * dt); e.x += Math.sin(e.yaw) * e.speed * dt; e.z += Math.cos(e.yaw) * e.speed * dt; } else e.stop = true;
        e.cd -= dt; const dp = flat(e, P);
        if (e.cd <= 0) { e.cd = E.fire + rnd() * 0.5; if (e.stop) hurtBase(E.baseDmg); else if (dp < 520) { const v = norm({ x: P.x - e.x, y: P.y + P.cy - 4, z: P.z - e.z }); S.bullets.push({ x: e.x, y: 6, z: e.z, vx: v.x * 220, vy: v.y * 220, vz: v.z * 220, t: 0, dmg: E.dmg, own: 'e' }); } }
        continue;
      }
      const to = { x: tgt.x - e.x, y: (tgt === B ? 40 : tgt.y + (tgt === P ? P.cy : 0)) - e.y, z: tgt.z - e.z }; const d = Math.hypot(to.x, to.y, to.z) || 1;
      const wantYaw = Math.atan2(to.x, to.z); const wantPitch = Math.asin(clamp(to.y / d, -1, 1)); const turn = e.type === 'drone' ? 1.4 : e.type === 'fighter' ? 1.8 : 0.5;
      if (e.type === 'fighter' && tgt === P && d < 260) { e.yaw += e.orbit * 1.1 * dt; e.pitch = lerp(e.pitch, Math.sin(e.t * 1.3 + e.ph) * 0.3, 0.05); }
      else { e.yaw += clamp(angDiff(wantYaw, e.yaw), -turn * dt, turn * dt); e.pitch += clamp(wantPitch - e.pitch, -turn * 0.6 * dt, turn * 0.6 * dt); }
      const f = dirOf(e.yaw, e.pitch); e.x += f.x * e.speed * dt; e.y = Math.max(30, e.y + f.y * e.speed * dt); e.z += f.z * e.speed * dt;
      if (tgt === B && Math.hypot(e.x - B.x, e.z - B.z) < (e.type === 'bomber' ? 140 : 70) && e.y < 220) {
        if (e.type === 'drone') { hurtBase(E.base); fx('boom', e, 12); e.dead = true; e.hp = 0; snd('boom'); }
        else if (e.type === 'bomber') { e.cd -= dt; if (e.cd <= 0) { e.cd = 3.2; hurtBase(E.base); fx('boom', { x: B.x, y: 20, z: B.z }, 25); } }
      }
      if (e.type === 'fighter') { e.cd -= dt; const toP = norm({ x: P.x - e.x, y: P.y + P.cy - e.y, z: P.z - e.z }); const dp = dist(e, P); const aim = toP.x * f.x + toP.y * f.y + toP.z * f.z;
        if (e.cd <= 0 && dp < 520 && aim > 0.93) { e.cd = E.fire + rnd() * 0.5; S.bullets.push({ x: e.x, y: e.y, z: e.z, vx: toP.x * 250 + f.x * 20, vy: toP.y * 250, vz: toP.z * 250 + f.z * 20, t: 0, dmg: E.dmg, own: 'e' }); } }
      if (e.type === 'drone' && e.target === 'player' && dist(e, { x: P.x, y: P.y + P.cy, z: P.z }) < P.radius + 6) { hurtPlayer(14); e.hp = 0; e.dead = true; fx('boom', e, 12); S.kills++; snd('boom'); }
      else if (e.type !== 'drone' && dist(e, { x: P.x, y: P.y + P.cy, z: P.z }) < ENEMY[e.type].size + P.radius && !e.dead) { hurtPlayer(e.type === 'bomber' ? 28 : 18); e.hp = 0; e.dead = true; fx('boom', e, 14); S.kills++; snd('boom'); }
    }
    S.enemies = S.enemies.filter((e) => !e.dead);
    // ---- てきの たま ----
    for (const b of S.bullets) {
      b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      if (V.parts && V.parts.armor && false) { /* (ぶひん そうこうは HPに はんえい ずみ) */ }
      if (dist(b, { x: P.x, y: P.y + P.cy, z: P.z }) < P.radius) { hurtPlayer(b.dmg); b.t = 99; fx('spark', b, 5); }
      if (b.y < -2) b.t = 99;
    }
    S.bullets = S.bullets.filter((b) => b.t < 5);
    // ---- じぶんの ミサイル ----
    for (const m of S.missiles) {
      m.t += dt; const tg = m.target != null ? S.enemies.find((e) => e.id === m.target) : null;
      if (tg) { const v = norm({ x: tg.x - m.x, y: tg.y - m.y, z: tg.z - m.z }); const cur = norm({ x: m.vx, y: m.vy, z: m.vz }); const k = clamp(4.2 * dt, 0, 1); const nv = norm({ x: cur.x + (v.x - cur.x) * k, y: cur.y + (v.y - cur.y) * k, z: cur.z + (v.z - cur.z) * k }); m.vx = nv.x * 260; m.vy = nv.y * 260; m.vz = nv.z * 260; }
      m.x += m.vx * dt; m.y += m.vy * dt; m.z += m.vz * dt;
      const hit = S.enemies.find((e) => !e.dead && dist(e, m) < ENEMY[e.type].size + 12);
      if (hit) { m.t = 99; fx('boom', m, 18); snd('boom'); for (const e of S.enemies) if (e !== hit && !e.dead && dist(e, m) < 40) damageEnemy(e, m.dmg * 0.35 * MIS_VS[kind][e.dom]); damageEnemy(hit, m.dmg * MIS_VS[kind][hit.dom]); }
      if (m.y < 1 && !hit) m.t = 99;
    }
    S.missiles = S.missiles.filter((m) => m.t < m.life);
    // ---- しょうり ----
    const allSpawned = S.waveI >= M.waves.length;
    if (!S.done && allSpawned && !M.boss && S.enemies.length === 0) endMission(true);
  }
  return { state: S, input, step, fireMissile, evade, nextTarget, vehicle: V, mission: M, skip() { let n = 0; while (!S.done && n++ < 100000) step(1 / 30); } };
}
