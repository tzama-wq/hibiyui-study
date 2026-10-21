// 「そらの まもり」(エースコンバット・アーマードコアふうの 空の まもり)の ルールと うごき。画面(three.js)には さわらない。node で テストできる。
//   const sim = createAir({ machine, wings, mission, rnd, gentle });  sim.input = { turn, climb, gun, boost };  sim.fireMissile();  sim.evade();  sim.step(dt)
//   ざひょう: x=よこ, y=たかさ, z=おく。きちは (0,0,BASE_Z)。てきは おくから くる。
export const BASE_Z = 700;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const dirOf = (yaw, pitch) => ({ x: Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: Math.cos(yaw) * Math.cos(pitch) });
const norm = (v) => { const m = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / m, y: v.y / m, z: v.z / m }; };
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

// ---- きたい(キャラ → きたい) --------------------------------------------------------------
// レアど=きしゅの ランク、ポジション=やくわり。のうりょく(シュート・パス・スピード・まもり・スタミナ)が そのまま きたいの つよさに なる
export const TIERS = {
  kid: { name: 'エース機', mul: 1.0, locks: 2, missiles: 6 }, common: { name: '練習機', mul: 0.9, locks: 1, missiles: 4 }, uncommon: { name: '軽戦闘機', mul: 0.97, locks: 1, missiles: 5 },
  rare: { name: '戦闘機', mul: 1.06, locks: 2, missiles: 6 }, super: { name: '重戦闘機', mul: 1.16, locks: 3, missiles: 8 }, legend: { name: 'ステルス機', mul: 1.3, locks: 4, missiles: 10 }, diamond: { name: '試作 ゼロ式', mul: 1.5, locks: 5, missiles: 12 },
};
export const ROLES = {
  FW: { name: 'ファイター', note: 'ミサイルが おおい・こうげき とくい', missiles: 3, gun: 1.2, armor: 1, lock: 1 },
  MF: { name: 'サポート', note: 'ロックオンが はやい・おおく ねらえる', missiles: 1, gun: 1, armor: 1, lock: 1.6, locks: 2 },
  DF: { name: 'ガーディアン', note: 'そうこうが あつい・きちを まもる', missiles: 0, gun: 1, armor: 1.45, lock: 1, baseGuard: true },
  GK: { name: 'インターセプター', note: 'てきの たまを じどうで うちおとす', missiles: 1, gun: 0.95, armor: 1.2, lock: 1.1, intercept: true },
  ALL: { name: 'エース', note: 'なんでも こなす', missiles: 1, gun: 1.05, armor: 1.1, lock: 1.2, locks: 1 },
};
export function machineOf({ id, name, face = '', img = '', rarity = 'common', pos = 'FW', stats }) {
  const T = TIERS[rarity] || TIERS.common; const R = ROLES[pos] || ROLES.ALL; const st = stats;
  const rating = Math.round((st.SHO * 1.2 + st.PAS * 0.6 + st.SPD * 0.8 + st.DEF * 1.0 + st.STA * 0.5) / 4.1 * T.mul);
  return {
    id, pilot: name, face, img, rarity, pos, role: R.name, note: R.note, tier: T.name, rating, stats: st,
    hpMax: Math.round((120 + st.DEF * 2.6) * T.mul * R.armor),
    gunDps: Math.round((26 + st.SHO * 0.5) * T.mul * R.gun),
    missileDmg: Math.round((70 + st.SHO * 0.8) * T.mul),
    missiles: T.missiles + R.missiles,
    locks: clamp(T.locks + (R.locks || 0), 1, 6),
    lockTime: clamp(1.15 - (st.PAS / 100) * 0.4 * R.lock, 0.25, 1.15),
    speed: Math.round(70 + st.SPD * 0.32),
    boostMax: Math.round(60 + st.STA * 0.9),
    baseGuard: !!R.baseGuard, intercept: !!R.intercept,
  };
}

// ---- ミッション ---------------------------------------------------------------------------
// waves: [{ t: じかん(びょう), type, n }]。てきは おくの うみの うえから やってくる(ふめいの むじんき)
export const MISSIONS = [
  { id: 'm1', name: 'はじめての パトロール', icon: '🌊', brief: 'ふめいの ドローンが きちに ちかづいて いる! やっつけて きちを まもろう。', recommend: 20, baseHp: 260,
    waves: [{ t: 2, type: 'drone', n: 3 }, { t: 18, type: 'drone', n: 4 }, { t: 36, type: 'drone', n: 5 }], reward: { bronze: 2, pts: 8 }, first: { bronze: 3, silver: 1 } },
  { id: 'm2', name: 'そらを まもれ', icon: '🛡️', brief: 'ドローンの むれと 戦闘機が せまって くる。ミサイルで ロックして うちおとそう。', recommend: 35, baseHp: 300,
    waves: [{ t: 2, type: 'drone', n: 5 }, { t: 16, type: 'fighter', n: 2 }, { t: 30, type: 'drone', n: 6 }, { t: 46, type: 'fighter', n: 3 }], reward: { bronze: 2, silver: 1, pts: 12 }, first: { silver: 2, gold: 1 } },
  { id: 'm3', name: 'ばくげききを とめろ', icon: '✈️', brief: 'おおきな ばくげきが きちを ねらって いる! きちに つく まえに うちおとせ。', recommend: 50, baseHp: 320,
    waves: [{ t: 2, type: 'bomber', n: 2 }, { t: 14, type: 'drone', n: 6 }, { t: 28, type: 'bomber', n: 3 }, { t: 44, type: 'fighter', n: 3 }], reward: { silver: 2, pts: 16 }, first: { gold: 2 } },
  { id: 'm4', name: 'エースへの みち', icon: '⚡', brief: 'てきの エース部隊が とうじょう。うごきが はやい! かいひ(ローリング)を つかおう。', recommend: 70, baseHp: 340,
    waves: [{ t: 2, type: 'fighter', n: 4 }, { t: 18, type: 'drone', n: 8 }, { t: 32, type: 'fighter', n: 5 }, { t: 50, type: 'bomber', n: 3 }, { t: 64, type: 'fighter', n: 4 }], reward: { gold: 1, silver: 2, pts: 22 }, first: { gold: 2, platinum: 1 } },
  { id: 'm5', name: 'きょだい ぼかん', icon: '🚢', brief: 'うみの むこうから きょだいな くうちゅう ぼかんが やって きた! ボスを たおして にっぽんを まもれ!', recommend: 95, baseHp: 380, boss: true,
    waves: [{ t: 2, type: 'drone', n: 4 }, { t: 14, type: 'boss', n: 1 }], reward: { gold: 2, platinum: 1, pts: 35 }, first: { platinum: 3, shards: 10 } },
];
export const missionById = (id) => MISSIONS.find((m) => m.id === id);

const ENEMY = {
  drone: { hp: 26, speed: 62, size: 4, score: 10, base: 22 },
  fighter: { hp: 78, speed: 82, size: 7, score: 30, fire: 1.5, dmg: 7 },
  bomber: { hp: 210, speed: 44, size: 14, score: 50, base: 44 },
  boss: { hp: 1800, speed: 18, size: 60, score: 300, fire: 0.7, dmg: 9 },
};

export function createAir({ machine, wings = [], mission, rnd = Math.random, gentle = false, difficulty = 1 }) {
  const M = mission; const hpScale = gentle ? 1.45 : 1; const enemyDmg = (gentle ? 0.6 : 1) * difficulty;
  const S = {
    ph: 'brief', t: 0, kills: 0, score: 0, done: false, win: false, banner: '', bannerT: 0, msg: '', msgT: 0,
    player: { x: 0, y: 260, z: 120, yaw: 0, pitch: 0, roll: 0, speed: machine.speed, hp: machine.hpMax * hpScale, hpMax: machine.hpMax * hpScale, boost: machine.boostMax, boosting: false, invuln: 0, evadeCd: 0, missiles: machine.missiles, mRegen: 0, lockTarget: [], lockT: new Map(), gunHeat: 0, firing: false },
    base: { x: 0, y: 0, z: BASE_Z, hp: M.baseHp, hpMax: M.baseHp },
    enemies: [], bullets: [], missiles: [], effects: [], tracers: [], snd: [], waveI: 0, spawned: 0, boss: null, wings: [],
  };
  const input = { turn: 0, climb: 0, gun: false, boost: false };
  const snd = (n) => { if (S.snd.length < 30) S.snd.push(n); };
  const fx = (kind, pos, r = 10) => { if (S.effects.length < 80) S.effects.push({ kind, x: pos.x, y: pos.y, z: pos.z, r, t: 0, life: kind === 'big' ? 1.4 : 0.7 }); };
  const msg = (t, d = 2.5) => { S.msg = t; S.msgT = d; };
  const banner = (t, d = 2.2) => { S.banner = t; S.bannerT = d; };
  // なかま(僚機): じどうで てきを うつ
  wings.slice(0, 2).forEach((w, i) => S.wings.push({ m: w, x: (i ? 1 : -1) * 55, y: 250, z: 80 + i * 12, yaw: 0, pitch: 0, cd: rnd() * 0.5, offset: { x: (i ? 1 : -1) * 70, y: 12 + i * 8, z: -40 } }));

  function spawn(type, i, n) {
    const E = ENEMY[type]; const ang = (i / Math.max(1, n) - 0.5) * 1.6 + (rnd() - 0.5) * 0.4;
    const e = { id: ++spawnId, type, x: Math.sin(ang) * (700 + rnd() * 500), y: 140 + rnd() * 320, z: BASE_Z + 1250 + rnd() * 450, yaw: Math.PI, pitch: 0, hp: E.hp * (type === 'boss' ? 1 : 1) * (difficulty > 1 ? 1.2 : 1), hpMax: E.hp, speed: E.speed * (0.9 + rnd() * 0.25), cd: 1 + rnd() * 1.5, target: rnd() < 0.55 ? 'base' : 'player', t: 0, ph: rnd() * 6.28, spawnCd: 6, orbit: rnd() < 0.5 ? 1 : -1 };
    if (type === 'boss') { e.x = 0; e.y = 300; e.z = BASE_Z + 1500; e.target = 'base'; S.boss = e; banner('⚠ ボスが きた!', 2.6); snd('warn'); }
    S.enemies.push(e); return e;
  }
  let spawnId = 0;

  // ---- ロックオン ----------------------------------------------------------------
  function updateLock(dt) {
    const P = S.player; const fwd = dirOf(P.yaw, P.pitch);
    const cands = S.enemies.map((e) => { const v = { x: e.x - P.x, y: e.y - P.y, z: e.z - P.z }; const d = Math.hypot(v.x, v.y, v.z); const c = (v.x * fwd.x + v.y * fwd.y + v.z * fwd.z) / (d || 1); return { e, d, ang: Math.acos(clamp(c, -1, 1)) }; })
      .filter((c) => c.d < 1300 && c.ang < 0.5).sort((a, b) => a.ang - b.ang || a.d - b.d).slice(0, machine.locks);
    const keep = new Map();
    for (const c of cands) { const t = (P.lockT.get(c.e.id) || 0) + dt; keep.set(c.e.id, Math.min(t, machine.lockTime + 0.05)); }
    P.lockT = keep; P.lockTarget = cands.filter((c) => keep.get(c.e.id) >= machine.lockTime).map((c) => c.e);
    S.lockCands = cands.map((c) => ({ id: c.e.id, locked: keep.get(c.e.id) >= machine.lockTime, p: Math.min(1, keep.get(c.e.id) / machine.lockTime) }));
  }
  function fireMissile() {
    const P = S.player; if (S.done || S.ph !== 'play' || P.missiles <= 0) return false;
    let targets = P.lockTarget.slice(); if (!targets.length) { // ロックが なくても まえに うつ(あたりにくい)
      targets = [null];
    }
    let n = 0; for (const e of targets) { if (P.missiles <= 0) break; P.missiles--; n++;
      const fwd = dirOf(P.yaw, P.pitch); S.missiles.push({ x: P.x + fwd.x * 14, y: P.y + fwd.y * 14 - 2, z: P.z + fwd.z * 14, vx: fwd.x * 240, vy: fwd.y * 240, vz: fwd.z * 240, target: e ? e.id : null, t: 0, life: 5, dmg: machine.missileDmg, own: 'p' }); }
    if (n) snd('missile'); return n > 0;
  }
  function evade() { const P = S.player; if (P.evadeCd > 0 || S.done) return false; P.invuln = 0.9; P.evadeCd = 3.5; P.rollSpin = 1; snd('evade'); return true; }

  // ---- てき・たま ------------------------------------------------------------------
  const damageEnemy = (e, d, srcWing = false) => { if (e.hp <= 0) return; e.hp -= d; if (e.hp <= 0) killEnemy(e, srcWing); };
  function killEnemy(e, byWing) {
    e.hp = 0; e.dead = true; S.kills++; S.score += ENEMY[e.type].score; fx(e.type === 'boss' ? 'big' : 'boom', e, ENEMY[e.type].size * 1.6); snd(e.type === 'boss' ? 'bigboom' : 'boom');
    if (e.type === 'boss') { S.win = true; endMission(true); }
    void byWing;
  }
  function hurtPlayer(d) { const P = S.player; if (P.invuln > 0 || S.done) return; P.hp -= d * enemyDmg; snd('hit'); S.hurt = 0.35; if (P.hp <= 0) { P.hp = 0; fx('big', P, 20); endMission(false, 'きたいが こわれた…'); } }
  function hurtBase(d) { const B = S.base; if (S.done) return; B.hp -= d; S.baseHurt = 0.5; snd('basehit'); if (B.hp <= 0) { B.hp = 0; endMission(false, 'きちが やられた…'); } }

  function endMission(win, why = '') {
    if (S.done) return; S.done = true; S.win = win; S.ph = win ? 'win' : 'lose'; S.endT = 0;
    banner(win ? 'ミッション クリア!' : 'ミッション しっぱい', 3); if (!win) msg(why, 3);
    const hpPct = S.player.hp / S.player.hpMax; const bPct = S.base.hp / S.base.hpMax;
    S.stars = !win ? 0 : bPct >= 0.7 && hpPct >= 0.5 ? 3 : bPct >= 0.4 ? 2 : 1;
    snd(win ? 'win' : 'lose');
  }

  // ---- 1フレーム -------------------------------------------------------------------
  function step(dtIn) {
    const dt = Math.min(dtIn, 1 / 20); if (S.ph === 'brief') { S.ph = 'play'; banner(`${M.icon} ${M.name}`, 2.4); }
    if (S.bannerT > 0) S.bannerT -= dt; if (S.msgT > 0) S.msgT -= dt; if (S.hurt > 0) S.hurt -= dt; if (S.baseHurt > 0) S.baseHurt -= dt;
    S.snd = S.snd; for (let i = S.effects.length - 1; i >= 0; i--) { S.effects[i].t += dt; if (S.effects[i].t > S.effects[i].life) S.effects.splice(i, 1); }
    S.tracers = S.tracers.filter((tr) => { tr.t += dt; return tr.t < 0.12; });
    if (S.done) { S.endT += dt; return; }
    S.t += dt; const P = S.player;
    // ---- じぶん ----
    const boosting = input.boost && P.boost > 1; P.boosting = boosting; P.boost = clamp(P.boost + (boosting ? -26 : 10) * dt, 0, machine.boostMax);
    const sp = machine.speed * (boosting ? 1.65 : 1) * (input.climb < -0.4 ? 1.12 : input.climb > 0.4 ? 0.92 : 1);
    P.speed = lerp(P.speed, sp, 1 - Math.exp(-2.4 * dt));
    P.yaw += input.turn * 1.15 * dt; P.pitch = clamp(P.pitch + input.climb * 0.95 * dt, -0.95, 0.95);
    if (Math.abs(input.climb) < 0.12) P.pitch *= Math.exp(-0.9 * dt);
    P.roll = lerp(P.roll, -input.turn * 0.95, 1 - Math.exp(-5 * dt)); if (P.rollSpin) { P.rollSpin = Math.max(0, P.rollSpin - dt / 0.75); }
    const fwd = dirOf(P.yaw, P.pitch);
    P.x += fwd.x * P.speed * dt; P.y += fwd.y * P.speed * dt; P.z += fwd.z * P.speed * dt;
    if (P.y < 55) { P.pitch = lerp(P.pitch, 0.35, 1 - Math.exp(-3 * dt)); if (P.y < 14) { P.y = 14; S.groundWarn = 1; if (P.invuln <= 0) hurtPlayer(6 * dt * 12); } } // うみに ちかづくと じどうで ひきおこす
    P.y = Math.min(P.y, 1500);
    const r = Math.hypot(P.x, P.z - BASE_Z); if (r > 3200) { const want = Math.atan2(-P.x, BASE_Z - P.z); P.yaw += clamp(angDiff(want, P.yaw), -1.6 * dt, 1.6 * dt) * 3; S.outWarn = 1; } else S.outWarn = 0;
    if (P.invuln > 0) P.invuln -= dt; if (P.evadeCd > 0) P.evadeCd -= dt;
    P.mRegen += dt; if (P.mRegen > 6 && P.missiles < machine.missiles) { P.missiles++; P.mRegen = 0; }
    updateLock(dt);
    // ---- きかん砲(じどうで ねらいを あわせる) ----
    P.firing = !!input.gun;
    if (input.gun) {
      let best = null; let ba = 0.13;
      for (const e of S.enemies) { const v = { x: e.x - P.x, y: e.y - P.y, z: e.z - P.z }; const d = Math.hypot(v.x, v.y, v.z); if (d > 650) continue; const c = (v.x * fwd.x + v.y * fwd.y + v.z * fwd.z) / (d || 1); const a = Math.acos(clamp(c, -1, 1)) - ENEMY[e.type].size / d; if (a < ba) { ba = a; best = e; } }
      if (best) damageEnemy(best, machine.gunDps * dt);
      if (S.t % 0.07 < dt) S.tracers.push({ from: { x: P.x + fwd.x * 8, y: P.y + fwd.y * 8 - 1.5, z: P.z + fwd.z * 8 }, to: best ? { x: best.x, y: best.y, z: best.z } : { x: P.x + fwd.x * 520, y: P.y + fwd.y * 520, z: P.z + fwd.z * 520 }, t: 0 });
      if (S.t % 0.18 < dt) snd('gun');
    }
    // ---- ウェーブ ----
    while (S.waveI < M.waves.length && S.t >= M.waves[S.waveI].t) { const w = M.waves[S.waveI++]; for (let i = 0; i < w.n; i++) spawn(w.type, i, w.n); if (w.type !== 'boss') msg(`てきが ${w.n}き ちかづいて いる!`); snd('warn'); }
    // ---- てき ----
    const B = S.base;
    for (const e of S.enemies) {
      e.t += dt; const E = ENEMY[e.type];
      let tgt = e.target === 'player' ? P : B; if (e.type === 'bomber' || e.type === 'boss') tgt = B;
      if (e.type === 'boss') { // ボス: きちの ほうへ ゆっくり すすみ、ずっと たまを うつ。ときどき ドローンを だす
        e.x = Math.sin(e.t * 0.12) * 380; e.z = Math.max(BASE_Z + 900, e.z - E.speed * dt); e.y = 300 + Math.sin(e.t * 0.3) * 40; e.yaw = Math.PI;
        e.cd -= dt; const rage = e.hp < e.hpMax * 0.5 ? 1.6 : 1;
        if (e.cd <= 0) { e.cd = E.fire / rage; const v = norm({ x: P.x - e.x + (rnd() - 0.5) * 60, y: P.y - e.y, z: P.z - e.z }); for (const off of [-1, 1]) S.bullets.push({ x: e.x + off * 30, y: e.y - 8, z: e.z - 30, vx: v.x * 230, vy: v.y * 230, vz: v.z * 230, t: 0, dmg: E.dmg, own: 'e' }); }
        e.spawnCd -= dt; if (e.spawnCd <= 0 && S.enemies.filter((x) => x.type === 'drone' && !x.dead).length < 8) { e.spawnCd = 9; for (let i = 0; i < 2; i++) { const d = spawn('drone', i, 2); d.x = e.x + (i ? 40 : -40); d.y = e.y; d.z = e.z - 40; } }
        if (e.z <= BASE_Z + 950) hurtBase(5 * dt * 2.2);
        continue;
      }
      const to = { x: tgt.x - e.x, y: (tgt === B ? 40 : tgt.y) - e.y, z: tgt.z - e.z }; const d = Math.hypot(to.x, to.y, to.z) || 1;
      const wantYaw = Math.atan2(to.x, to.z); const wantPitch = Math.asin(clamp(to.y / d, -1, 1));
      const turn = e.type === 'drone' ? 1.4 : e.type === 'fighter' ? 1.8 : 0.5;
      if (e.type === 'fighter' && tgt === P && d < 260) { // ちかづき すぎたら ぐるっと まわる
        e.yaw += e.orbit * 1.1 * dt; e.pitch = lerp(e.pitch, Math.sin(e.t * 1.3 + e.ph) * 0.3, 0.05);
      } else { e.yaw += clamp(angDiff(wantYaw, e.yaw), -turn * dt, turn * dt); e.pitch += clamp(wantPitch - e.pitch, -turn * 0.6 * dt, turn * 0.6 * dt); }
      const f = dirOf(e.yaw, e.pitch); const spd = e.speed; e.x += f.x * spd * dt; e.y = Math.max(30, e.y + f.y * spd * dt); e.z += f.z * spd * dt;
      // きちに とどいた
      if (tgt === B && Math.hypot(e.x - B.x, e.z - B.z) < (e.type === 'bomber' ? 140 : 70) && e.y < 220) {
        if (e.type === 'drone') { hurtBase(E.base); fx('boom', e, 12); e.dead = true; e.hp = 0; snd('boom'); }
        else if (e.type === 'bomber') { e.cd -= dt; if (e.cd <= 0) { e.cd = 3.2; hurtBase(E.base); fx('boom', { x: B.x, y: 20, z: B.z }, 25); } }
      }
      if (e.type === 'fighter') { e.cd -= dt; const toP = norm({ x: P.x - e.x, y: P.y - e.y, z: P.z - e.z }); const dp = dist(e, P); const aim = toP.x * f.x + toP.y * f.y + toP.z * f.z;
        if (e.cd <= 0 && dp < 520 && aim > 0.93) { e.cd = E.fire + rnd() * 0.5; S.bullets.push({ x: e.x, y: e.y, z: e.z, vx: toP.x * 250 + f.x * 20, vy: toP.y * 250, vz: toP.z * 250 + f.z * 20, t: 0, dmg: E.dmg, own: 'e' }); } }
      // ぶつかり
      if (dist(e, P) < ENEMY[e.type].size + 7 && !e.dead) { hurtPlayer(e.type === 'bomber' ? 28 : 18); e.hp = 0; e.dead = true; fx('boom', e, 14); S.kills++; snd('boom'); }
    }
    S.enemies = S.enemies.filter((e) => !e.dead);
    // ---- てきの たま ----
    for (const b of S.bullets) {
      b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      if (machine.intercept) { const dd = dist(b, P); if (dd < 140 && rnd() < 0.5 * dt * 6) { b.t = 99; fx('spark', b, 4); snd('spark'); continue; } } // インターセプター: じどうで うちおとす
      if (dist(b, P) < 9) { hurtPlayer(b.dmg); b.t = 99; fx('spark', b, 5); }
      if (machine.baseGuard && Math.hypot(b.x - B.x, b.z - B.z) < 120 && b.y < 80) b.t = 99;
    }
    S.bullets = S.bullets.filter((b) => b.t < 5);
    // ---- じぶんの ミサイル ----
    for (const m of S.missiles) {
      m.t += dt; const tg = m.target != null ? S.enemies.find((e) => e.id === m.target) : null;
      if (tg) { const v = norm({ x: tg.x - m.x, y: tg.y - m.y, z: tg.z - m.z }); const cur = norm({ x: m.vx, y: m.vy, z: m.vz }); const k = clamp(4.2 * dt, 0, 1); const nv = norm({ x: cur.x + (v.x - cur.x) * k, y: cur.y + (v.y - cur.y) * k, z: cur.z + (v.z - cur.z) * k }); m.vx = nv.x * 260; m.vy = nv.y * 260; m.vz = nv.z * 260; }
      m.x += m.vx * dt; m.y += m.vy * dt; m.z += m.vz * dt;
      const hit = S.enemies.find((e) => !e.dead && dist(e, m) < ENEMY[e.type].size + 12);
      if (hit) { m.t = 99; fx('boom', m, 18); snd('boom'); for (const e of S.enemies) if (e !== hit && !e.dead && dist(e, m) < 40) damageEnemy(e, m.dmg * 0.35); damageEnemy(hit, m.dmg); }
      if (m.y < 2) m.t = 99;
    }
    S.missiles = S.missiles.filter((m) => m.t < m.life);
    // ---- なかま ----
    S.wings.forEach((w, i) => {
      const want = { x: P.x + Math.cos(P.yaw) * w.offset.x + Math.sin(P.yaw) * w.offset.z, y: P.y + w.offset.y, z: P.z - Math.sin(P.yaw) * w.offset.x + Math.cos(P.yaw) * w.offset.z };
      w.x = lerp(w.x, want.x, 1 - Math.exp(-1.6 * dt)); w.y = lerp(w.y, want.y, 1 - Math.exp(-1.6 * dt)); w.z = lerp(w.z, want.z, 1 - Math.exp(-1.6 * dt)); w.yaw = P.yaw; w.pitch = P.pitch * 0.8;
      w.cd -= dt; if (w.cd <= 0) {
        const t = S.enemies.filter((e) => dist(e, w) < 600).sort((a, b) => dist(a, w) - dist(b, w))[0];
        if (t) { w.cd = 0.4; damageEnemy(t, w.m.gunDps * 0.3 * 0.4, true); S.tracers.push({ from: { x: w.x, y: w.y, z: w.z }, to: { x: t.x, y: t.y, z: t.z }, t: 0 }); if (rnd() < 0.18) { snd('gun'); } } else w.cd = 0.3;
      }
      void i;
    });
    // ---- しょうり ----
    const allSpawned = S.waveI >= M.waves.length;
    if (!S.done && allSpawned && !M.boss && S.enemies.length === 0) endMission(true);
    if (!S.done && M.boss && allSpawned && !S.boss) { /* ボスが でるまえ */ }
  }
  return {
    state: S, input, step, fireMissile, evade, machine, mission: M,
    skip() { let n = 0; while (!S.done && n++ < 100000) step(1 / 30); },
  };
}
