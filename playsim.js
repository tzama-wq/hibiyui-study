// じぶんで うごかす しあい(3D)の「ルール」と「うごき」。画面(three.js)には さわらない。node で テストできる。
//   const sim = createPlay({ me, opp, halfSec: 90, rnd, level: 1 });   me / opp: { name, team:[{slot,name,stats,...}] }(game.js の teamSnapshot と おなじ)
//   sim.input = { mx, mz, sprint, ... };  sim.press('pass'|'shoot'|'lob'|'tackle'|'switch') ; sim.release('shoot')
//   sim.step(dt) を まいフレーム。 sim.state で えを かく。
// ざひょう: x = たて(-52.5〜52.5)、z = よこ(-34〜34)、y = たかさ。 a(じぶん)は +x の ゴールへ せめる。
export const FIELD = { L: 105, W: 68, GW: 7.32, GH: 2.44, PAh: 20.16, PAd: 16.5 };
const HX = FIELD.L / 2; const HZ = FIELD.W / 2; const GHW = FIELD.GW / 2;
const ROW_X = { GK: 0.045, DF: 0.22, MF: 0.46, FW: 0.68 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const len = (x, z) => Math.hypot(x, z);
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
const sgn = (s) => (s === 'a' ? 1 : -1); // a は +x へ せめる
const other = (s) => (s === 'a' ? 'b' : 'a');

// のうりょく(40〜200ぐらい)→ 0.8〜1.4 ぐらいの ばいりつ(つよすぎる てきでも おいつけない ほどには しない)
const mul = (s, lo = 0.8, hi = 1.4) => clamp(lo + (hi - lo) * Math.sqrt(clamp(s, 20, 220) / 120), lo, hi);

export function formationPos(team) {
  const rows = { GK: [], DF: [], MF: [], FW: [] };
  team.forEach((m, i) => rows[m.slot].push(i));
  const pos = Array(team.length);
  for (const [s, idxs] of Object.entries(rows)) idxs.forEach((i, j) => { pos[i] = { ax: ROW_X[s], ay: s === 'GK' ? 0.5 : 0.1 + (0.8 * (j + 0.5)) / idxs.length }; });
  return pos;
}

export function createPlay({ me, opp, halfSec = 90, rnd = Math.random, level = 1, extraSec = 60 }) {
  const myPow = avg(me.team); const opPow = avg(opp.team);
  function avg(t) { return t.reduce((a, m) => a + (m.stats.SHO + m.stats.PAS + m.stats.SPD + m.stats.DEF + m.stats.STA) / 5, 0) / Math.max(1, t.length); }
  const aiLevel = clamp((opPow / Math.max(30, myPow)) ** 0.5 * level, 0.7, 1.35); // てきの つよさ(じぶんより つよいほど おおきい)

  const teams = { a: me, b: opp };
  const players = { a: [], b: [] };
  const homes = { a: formationPos(me.team), b: formationPos(opp.team) };
  for (const s of ['a', 'b']) {
    teams[s].team.forEach((m, i) => {
      const st = m.stats;
      players[s].push({ side: s, idx: i, slot: m.slot, name: m.name, face: m.face || '', m, stats: st,
        x: 0, z: 0, vx: 0, vz: 0, dir: s === 'a' ? 0 : Math.PI, stamina: 1, stun: 0, cd: 0, act: '', actT: 0,
        spd: 6.1 * mul(st.SPD, 0.8, 1.32) * (s === 'b' ? lerp(0.94, 1.1, (aiLevel - 0.7) / 0.65) : 1),
        sprint: false, run: 0, aiT: rnd() * 0.3, tx: 0, tz: 0, wantSprint: false });
    });
  }
  const gkOf = (s) => players[s].find((p) => p.slot === 'GK') || players[s][players[s].length - 1];
  const ball = { x: 0, y: 0.11, z: 0, vx: 0, vy: 0, vz: 0, owner: null, lastSide: 'a', lastP: null, prevP: null, shotBy: null, shotSpeed: 0, saveRolled: false, free: 0, passT: 99, offside: null };

  const S = {
    ph: 'kickoff', phT: 0, half: 1, clock: 0, // clock: じっさいの びょう(ぜんはん+こうはん)
    score: { a: 0, b: 0 }, events: [], shots: { a: 0, b: 0 }, fouls: { a: 0, b: 0 }, offsides: { a: 0, b: 0 }, poss: { a: 0.001, b: 0.001 },
    restart: null, dead: 0, banner: '', bannerT: 0, msg: '', done: false, ctrl: 0, ctrlLock: 0, kickSide: 'a', extra: false, golden: false, winner: null,
    celebrate: null, flash: 0, cards: [], snd: [],
  };
  const snd = (n) => { if (S.snd.length < 20) S.snd.push(n); };
  const input = { mx: 0, mz: 0, sprint: false };
  const pressed = { pass: false, shoot: false, lob: false, tackle: false, switch: false }; const shootCharge = { on: false, t: 0 };
  const log = (t) => { S.msg = t; };
  const banner = (t, d = 1.4) => { S.banner = t; S.bannerT = d; };
  const minuteNow = () => { const tot = halfSec * 2; const f = clamp(S.clock / tot, 0, 1); return Math.round(f * 90); };

  // ---- ならべる ------------------------------------------------------------------
  function formation(side, atkSide) {
    const sg = sgn(side);
    players[side].forEach((p) => {
      const h = homes[side][p.idx];
      const push = atkSide ? (side === atkSide ? 0.04 : -0.03) : 0;
      p.hx = sg * (-HX + clamp(h.ax + push, 0.03, 0.96) * FIELD.L); p.hz = (h.ay - 0.5) * (FIELD.W - 8);
      p.tx = p.hx; p.tz = p.hz;
    });
  }
  function resetPlayers(kickSide) {
    for (const s of ['a', 'b']) {
      formation(s, null);
      for (const p of players[s]) {
        p.x = p.hx; p.z = p.hz; p.vx = p.vz = 0; p.stun = 0; p.act = ''; p.dir = s === 'a' ? 0 : Math.PI; p.cd = 0;
        // キックオフは じぶんの ほうの ハーフから
        if (sgn(s) * p.x > -0.5) p.x = -sgn(s) * 0.5 * (p.slot === 'FW' ? 1 : 1.5) + sgn(s) * -0.0;
        if (s === kickSide && p.slot === 'FW' && p.idx === firstFW(s)) { p.x = -sgn(s) * 0.5; p.z = 0; }
      }
    }
  }
  function firstFW(s) { const i = players[s].findIndex((p) => p.slot === 'FW'); return i >= 0 ? i : 0; }
  function kickoff(side) {
    S.kickSide = side;
    resetPlayers(side);
    const k = players[side][firstFW(side)];
    ball.x = 0; ball.z = 0; ball.y = 0.11; ball.vx = ball.vy = ball.vz = 0; ball.owner = k; ball.lastSide = side; ball.lastP = k; ball.prevP = null; ball.free = 0.5; ball.offside = null;
    S.ph = 'kickoff'; S.phT = 0; S.dead = 1.2; S.restart = { type: 'kickoff', side }; S.ctrl = side === 'a' ? k.idx : nearestIdx('a', 0, 0);
    S.celebrate = null;
  }

  // ---- ヘルパー ----------------------------------------------------------------
  function nearestIdx(side, x, z, excl = -1, noGK = true) {
    let best = -1; let bd = 1e9;
    players[side].forEach((p) => { if (p.idx === excl || (noGK && p.slot === 'GK')) return; const d = len(p.x - x, p.z - z); if (d < bd) { bd = d; best = p.idx; } });
    return best;
  }
  const humanTeam = 'a';
  const ctrlP = () => players.a[S.ctrl];
  const ownerSide = () => (ball.owner ? ball.owner.side : null);
  function lastDefX(defSide) { // まもりの いちばん うしろから 2ばんめ(オフサイドライン)の ざひょう(あいての ゴールに ちかい ほうが おおきい x for a)
    const sg = sgn(other(defSide)); // こうげき がわの むき
    const xs = players[defSide].map((p) => p.x * sg).sort((u, v) => v - u); // こうげき むきの ざひょうで おおきい じゅん
    return (xs[1] != null ? xs[1] : xs[0]) * sg;
  }

  // ---- ボールを うごかす ----------------------------------------------------------
  function touch(p) { ball.prevP = ball.lastP; ball.lastP = p; ball.lastSide = p.side; }
  function kick(p, vx, vz, vy, kind) {
    ball.owner = null; ball.x = p.x + Math.cos(p.dir) * 0.6; ball.z = p.z + Math.sin(p.dir) * 0.6; ball.y = 0.15;
    ball.vx = vx; ball.vz = vz; ball.vy = vy; touch(p); p.cd = 0.45; p.act = 'kick'; p.actT = 0.25; ball.free = 0.25; ball.kind = kind;
    snd(kind === 'shot' ? 'kick' : 'pass'); ball.passT = 0; ball.saveRolled = false; ball.shotBy = kind === 'shot' ? p : null; ball.shotSpeed = kind === 'shot' ? len(vx, vz) : 0;
    if (kind === 'shot') S.shots[p.side]++;
  }
  function offsideSnapshot(p) { // パスを だした しゅんかんに オフサイドの いちに いる みかた
    const sg = sgn(p.side); const line = lastDefX(other(p.side));
    const set = players[p.side].filter((q) => q !== p && q.slot !== 'GK' && q.x * sg > line * sg + 0.3 && q.x * sg > ball.x * sg + 0.3 && q.x * sg > 0).map((q) => q.idx);
    ball.offside = set.length ? { side: p.side, set, from: { x: p.x, z: p.z } } : null;
  }
  // パスの あいて えらび: むいている ほうこう(dx,dz)に いちばん ちかく、ちかい 人
  function pickTarget(p, dx, dz, forward = false) {
    const sg = sgn(p.side); const mag = len(dx, dz);
    const ang = mag > 0.2 ? Math.atan2(dz, dx) : p.dir;
    let best = null; let bs = -1e9;
    for (const q of players[p.side]) {
      if (q === p) continue;
      const d = len(q.x - p.x, q.z - p.z); if (d < 3) continue;
      const a2 = Math.atan2(q.z - p.z, q.x - p.x); const da = Math.abs(angDiff(a2, ang));
      if (da > 1.05 && mag > 0.2) continue;
      let sc = -da * 14 - d * 0.18 + (forward ? (q.x - p.x) * sg * 0.25 : 0);
      if (q.slot === 'GK') sc -= 12;
      // あいてが まわりに いない 人を このむ
      const near = players[other(p.side)].reduce((m, o) => Math.min(m, len(o.x - q.x, o.z - q.z)), 99); sc += Math.min(near, 8) * 0.9;
      if (sc > bs) { bs = sc; best = q; }
    }
    return best;
  }
  function passTo(p, q, power = 1, lob = false) {
    const err = (1 - clamp(p.stats.PAS / 140, 0, 0.9)) * 0.1 * (lob ? 1.5 : 1);
    const d = len(q.x - p.x, q.z - p.z); const sp = clamp(8 + d * (lob ? 0.62 : 0.6), 10, lob ? 27 : 23) * power;
    const t = d / sp; const lx = q.x + q.vx * t * 0.8; const lz = q.z + q.vz * t * 0.8; // さきまわり
    let a = Math.atan2(lz - p.z, lx - p.x) + (rnd() - 0.5) * 2 * err;
    p.dir = a; offsideSnapshot(p);
    kick(p, Math.cos(a) * sp, Math.sin(a) * sp, lob ? 5 + d * 0.16 : 0, lob ? 'lob' : 'pass');
    ball.target = q; return q;
  }
  function shootAt(p, aimZ, power) { // power 0..1
    const sg = sgn(p.side); const gx = sg * HX;
    const press = players[other(p.side)].reduce((m, o2) => Math.min(m, len(o2.x - p.x, o2.z - p.z)), 99);
    const dgo = len(gx - p.x, p.z);
    const err = (1 - clamp(p.stats.SHO / 150, 0, 0.9)) * (0.16 + power * 0.18) * (1 + clamp((28 - dgo) / 28, -0.4, 0) * -0.0 + clamp(dgo / 40, 0, 1) * 0.9) * (press < 2.6 ? 1.5 : 1);
    const tz = clamp(aimZ, -GHW * 1.05, GHW * 1.05) + (rnd() - 0.5) * 2 * err * 12 * (p.stats.SHO > 120 ? 0.7 : 1);
    const a = Math.atan2(tz - p.z, gx - p.x);
    const sp = (16 + 15 * power) * mul(p.stats.SHO, 0.9, 1.25);
    p.dir = a;
    kick(p, Math.cos(a) * sp, Math.sin(a) * sp, 0.6 + power * 3.2 + rnd() * 1.2, 'shot');
    // たかく ふかす
    if (rnd() < (1 - power * 0.6) * 0.1) ball.vy += 4;
  }

  // ---- タックル ------------------------------------------------------------------
  function tackle(d, c, slide) {
    snd('tackle');
    const dx = c.x - d.x; const dz = c.z - d.z; const dist = len(dx, dz);
    const range = slide ? 2.4 : 1.55; if (dist > range) return false;
    d.cd = slide ? 1.0 : 0.7; d.act = slide ? 'slide' : 'tackle'; d.actT = slide ? 0.55 : 0.3; d.dir = Math.atan2(dz, dx);
    if (slide) { d.vx = Math.cos(d.dir) * 9; d.vz = Math.sin(d.dir) * 9; }
    const behind = Math.cos(angDiff(Math.atan2(d.z - c.z, d.x - c.x), c.dir)) < -0.35; // ディフェンダーが うしろから
    const drib = mul((c.stats.SPD + c.stats.SHO) / 2, 0.8, 1.5); const df = mul(d.stats.DEF, 0.8, 1.5);
    const pOk = clamp(0.42 + (df - drib) * 1.2 + (slide ? 0.1 : 0) - (c.sprint ? 0.06 : 0), 0.18, 0.86);
    const roll = rnd();
    const foulP = behind ? (slide ? 0.4 : 0.22) : (slide ? 0.2 : 0.04);
    if (roll < pOk) { // せいこう
      if (behind && rnd() < foulP * 0.5) return foul(d, c);
      ball.owner = null; ball.free = 0.2; touch(d);
      ball.x = c.x; ball.z = c.z; ball.y = 0.11; const a = d.dir + (rnd() - 0.5) * 1.6;
      ball.vx = Math.cos(a) * 5; ball.vz = Math.sin(a) * 5; ball.vy = 0.6;
      c.stun = 0.55; c.cd = 0.6; log(`${d.name}が タックル!`);
      if (rnd() < 0.55) { ball.owner = d; ball.vx = ball.vz = 0; }
      return 'won';
    }
    if (rnd() < foulP) return foul(d, c);
    d.stun = slide ? 1.0 : 0.55; // しっぱい: すかされる
    log(`${c.name}が かわした!`); return 'miss';
  }
  function foul(d, c) {
    S.fouls[d.side]++; log(`${d.name}の ファウル!`);
    const yellow = rnd() < 0.12; if (yellow) S.cards.push({ name: d.name, side: d.side, t: S.clock });
    deadBall({ type: 'free', side: c.side, x: clamp(c.x, -HX + 2, HX - 2), z: clamp(c.z, -HZ + 1.5, HZ - 1.5) }, 'ファウル!' + (yellow ? ' イエローカード!' : ''));
    d.stun = 1.0; c.stun = 0.4; return 'foul';
  }

  // ---- デッドボール(スローイン・ゴールキック・コーナー・フリーキック) ----------------------
  function deadBall(r, text) {
    snd('whistle'); S.ph = 'dead'; S.phT = 0; S.restart = r; S.restartAt = S.clock; S.dead = 1.6; ball.owner = null; ball.vx = ball.vy = ball.vz = 0; ball.y = 0.11; ball.offside = null; ball.free = 0.1;
    ball.x = r.x; ball.z = r.z;
    if (text) banner(text, 1.3);
    // かこむ ポジション
    for (const s of ['a', 'b']) formation(s, r.side);
    const taker = r.type === 'goalkick' ? gkOf(r.side) : players[r.side][nearestIdx(r.side, r.x, r.z, -1, r.type !== 'goalkick')];
    r.taker = taker; taker.x = r.x - sgn(r.side) * (r.type === 'throw' ? 0 : 1.0) * (r.type === 'throw' ? 0 : 1); taker.z = r.z + (r.type === 'throw' ? Math.sign(r.z || 1) * 0.3 : 0);
    taker.vx = taker.vz = 0; taker.stun = 0; taker.tx = taker.x; taker.tz = taker.z;
    // ボールを もたせる(まもる がわは 9メートル はなれる)
    ball.owner = taker; taker.cd = 0; ball.lastSide = r.side; ball.lastP = taker;
    taker.dir = r.type === 'throw' ? (r.z > 0 ? -Math.PI / 2 : Math.PI / 2) : (r.side === 'a' ? 0 : Math.PI);
    if (r.type === 'free' || r.type === 'corner') for (const p of players[other(r.side)]) { const dd = len(p.x - r.x, p.z - r.z); if (dd < 9.2 && p.slot !== 'GK') { const a = Math.atan2(p.z - r.z, p.x - r.x) || 0.1; p.x = r.x + Math.cos(a) * 9.5; p.z = r.z + Math.sin(a) * 9.5; p.vx = p.vz = 0; } }
    if (r.type === 'corner') { // はこびに ぜんいん
      players[r.side].forEach((p) => { if (p !== taker && p.slot !== 'GK' && p.slot !== 'DF') { p.hx = sgn(r.side) * (HX - 8 - (p.idx % 3) * 3); p.hz = -6 + (p.idx % 5) * 3; } });
      players[other(r.side)].forEach((p) => { if (p.slot !== 'GK') { p.hx = -sgn(r.side) * -(HX - 6 - (p.idx % 3) * 2.5) * -1; p.hz = -5 + (p.idx % 5) * 2.5; p.hx = sgn(r.side) * (HX - 6 - (p.idx % 3) * 2.5); } });
    }
    if (r.side === humanTeam) S.ctrl = taker.idx; else S.ctrl = nearestIdx('a', r.x, r.z);
  }
  function outOfPlay() {
    const last = ball.lastSide; const x = ball.x; const z = ball.z;
    if (Math.abs(z) > HZ) { // タッチライン → スローイン
      deadBall({ type: 'throw', side: other(last), x: clamp(x, -HX + 1, HX - 1), z: Math.sign(z) * HZ }, 'スローイン');
    } else if (Math.abs(x) > HX) { // ゴールライン(ゴールの そとがわ)
      const atEnd = Math.sign(x); // +1 なら a の ゴールがわ
      const defSide = atEnd > 0 ? 'b' : 'a'; // x=+HX は b が まもる ゴール
      if (last === defSide) deadBall({ type: 'corner', side: other(defSide), x: atEnd * HX, z: z >= 0 ? HZ - 0.5 : -HZ + 0.5 }, 'コーナーキック');
      else deadBall({ type: 'goalkick', side: defSide, x: atEnd * (HX - 5.5), z: 0 }, 'ゴールキック');
    }
  }
  function goal(side) { // side が ゴール
    S.score[side]++; const sc = ball.lastP && ball.lastP.side === side ? ball.lastP : (ball.shotBy || ball.lastP);
    const ass = ball.prevP && ball.prevP.side === side && ball.prevP !== sc ? ball.prevP : null;
    S.events.push({ side, type: 'goal', scorer: sc ? sc.name : '', assist: ass ? ass.name : '', minute: minuteNow(), own: sc ? sc.side !== side : false, from: S.restart && S.restartAt != null && S.clock - S.restartAt < 7 ? S.restart.type : 'open' });
    snd('goal'); S.ph = 'goal'; S.phT = 0; S.celebrate = { side, p: sc }; S.flash = 0.4; banner('ゴール!!', 2.2); log(`ゴール!! ${sc ? sc.name : ''}`);
    ball.owner = null; ball.vx *= 0.15; ball.vz *= 0.15; ball.vy = 0; ball.x = clamp(ball.x, -HX - 1, HX + 1);
    if (S.golden) { S.winner = side; }
  }

  // ---- にんげんの そうさ ------------------------------------------------------------
  function humanActions(dt) {
    const p = ctrlP(); if (!p) return;
    const has = ball.owner === p;
    // きりかえ
    if (pressed.switch) { pressed.switch = false; if (ownerSide() !== 'a') { S.ctrl = nextBallSide(); S.ctrlLock = 1.2; } }
    if (has && p.cd <= 0 && p.stun <= 0) {
      const dx = input.mx; const dz = input.mz;
      if (pressed.pass) { pressed.pass = false; const q = pickTarget(p, dx, dz, false); if (q) { passTo(p, q, 1, false); S.ctrl = q.idx; S.ctrlLock = 0.8; } }
      else if (pressed.lob) { pressed.lob = false; const q = pickTarget(p, dx, dz, true); if (q) { passTo(p, q, 1, true); S.ctrl = q.idx; S.ctrlLock = 0.8; } }
      else if (shootCharge.on === false && pressed.shoot) { pressed.shoot = false; shootAt(p, p.z * 0.4 + (dz || 0) * 3.4, 0.55); }
      if (shootCharge.release) { shootCharge.release = false; const pw = clamp(shootCharge.t / 0.9, 0.2, 1); shootAt(p, p.z * 0.3 + (input.mz || 0) * 3.4, pw); shootCharge.t = 0; }
    } else { pressed.pass = pressed.lob = false; if (shootCharge.release) { shootCharge.release = false; shootCharge.t = 0; } }
    if (shootCharge.on) shootCharge.t = Math.min(1.2, shootCharge.t + dt);
    if (!has) {
      if (pressed.tackle) { pressed.tackle = false; const c = ball.owner && ball.owner.side === 'b' ? ball.owner : null; if (c && p.cd <= 0 && p.stun <= 0) { if (len(c.x - p.x, c.z - p.z) <= 1.6) tackle(p, c, false); else { p.act = 'lunge'; p.actT = 0.35; p.cd = 0.5; } } }
      if (pressed.shoot) { pressed.shoot = false; const c = ball.owner && ball.owner.side === 'b' ? ball.owner : null; if (c && p.cd <= 0 && p.stun <= 0) tackle(p, c, true); else if (p.cd <= 0 && p.stun <= 0) { p.act = 'slide'; p.actT = 0.5; p.cd = 0.9; p.vx = Math.cos(p.dir) * 9; p.vz = Math.sin(p.dir) * 9; } }
    }
    pressed.tackle = false;
  }
  function nextBallSide() { // ボールに ちかい じゅんに きりかえ
    const arr = players.a.filter((p) => p.slot !== 'GK').sort((u, v) => len(u.x - ball.x, u.z - ball.z) - len(v.x - ball.x, v.z - ball.z));
    const cur = arr.findIndex((p) => p.idx === S.ctrl); return arr[(cur + 1) % arr.length].idx;
  }

  // ---- AI ---------------------------------------------------------------------
  const goalOf = (s) => ({ x: sgn(s) * HX, z: 0 });
  function aiThink(p, dt) {
    p.aiT -= dt; if (p.aiT > 0 && !p.forceThink) return; p.aiT = (0.14 + rnd() * 0.1) / (p.side === 'b' ? aiLevel : 1); p.forceThink = false;
    const s = p.side; const sg = sgn(s); const own = ball.owner; const mine = own && own.side === s;
    p.wantSprint = false;
    if (p.slot === 'GK') return aiKeeper(p);
    const g = goalOf(s);
    if (own === p) { // ボールを もっている
      const dg = len(g.x - p.x, g.z - p.z);
      const pressure = players[other(s)].reduce((m, o) => Math.min(m, len(o.x - p.x, o.z - p.z)), 99);
      // うつ
      const angleOK = Math.abs(p.z) < 22 || dg < 14;
      if (dg < 25 && angleOK && p.cd <= 0 && (pressure < 5 || dg < 18) && rnd() < 0.55 * (dg < 18 ? 1.3 : 0.7)) { shootAt(p, (rnd() - 0.5) * GW(), 0.6 + rnd() * 0.35); return; }
      // パス
      if (p.cd <= 0 && (pressure < 3.4 || (S.ph !== 'play') || rnd() < 0.1)) {
        const q = pickTarget(p, sg * 1, 0, true); if (q && (q.x - p.x) * sg > -6) { passTo(p, q, 1, len(q.x - p.x, q.z - p.z) > 30); return; }
      }
      // ドリブル: ゴールへ、あいてを よけて
      let tx = g.x - sg * 6; let tz = clamp(p.z * 0.7, -18, 18);
      for (const o of players[other(s)]) { const d = len(o.x - p.x, o.z - p.z); if (d < 7 && (o.x - p.x) * sg > 0) { tz += (p.z - o.z >= 0 ? 1 : -1) * (7 - d) * 1.2; } }
      p.tx = tx; p.tz = clamp(tz, -HZ + 3, HZ - 3); p.wantSprint = dg > 12 && pressure > 3; return;
    }
    if (mine) { // みかたが もっている: サポート
      const forward = p.slot === 'FW' ? 0.14 : p.slot === 'MF' ? 0.09 : 0.03;
      let tx = p.hx + sg * (clamp((ball.x * sg + HX) / FIELD.L, 0, 1) * 0.38 * FIELD.L - 8 + forward * FIELD.L * 0.3);
      if (p.slot === 'FW') { const lineX = lastDefX(other(s)); tx = sg * Math.min(sg * tx, sg * lineX - 0.8); }
      p.tx = clamp(tx, -HX + 4, HX - 4); p.tz = clamp(p.hz + (ball.z - p.hz) * 0.25 + Math.sin(p.idx * 2.1 + S.clock * 0.35) * 5, -HZ + 3, HZ - 3); p.wantSprint = false; return;
    }
    // あいてが もっている or ルーズ: プレス / かえる
    const target = own || ball; const d = len(target.x - p.x, target.z - p.z);
    const rank = players[s].filter((q) => q.slot !== 'GK').sort((u, v) => len(u.x - target.x, u.z - target.z) - len(v.x - target.x, v.z - target.z)).findIndex((q) => q === p);
    const chase = own ? rank < (aiLevel > 1.05 ? 2 : 1) : rank < 1;
    if (chase && (own || len(ball.vx, ball.vz) < 14)) {
      // さきまわり
      const lead = own ? 0.25 : 0.45;
      p.tx = target.x + (target.vx || 0) * lead; p.tz = target.z + (target.vz || 0) * lead; p.wantSprint = d > 3;
      if (own && own.side !== s && p.cd <= 0 && p.stun <= 0 && d < 1.7 && rnd() < 0.62 * (s === 'b' ? aiLevel : 0.75)) tackle(p, own, rnd() < 0.12);
      return;
    }
    if (own && own.side !== s && (own.x - p.x) * sg > 0 && d < 17 && (p.slot === 'DF' || p.slot === 'MF' || d < 10)) { // ゴールがわに いる 人は ボールもちの まえに たちふさがる
      p.tx = own.x - sg * 2.6 + own.vx * 0.35; p.tz = own.z + own.vz * 0.35; p.wantSprint = d > 5;
      if (p.cd <= 0 && p.stun <= 0 && d < 1.8 && rnd() < 0.5 * (s === 'b' ? aiLevel : 0.7)) tackle(p, own, false);
      return;
    }
    const back = own ? 1 : 0.4; // まもりの ラインを さげる
    p.tx = clamp(p.hx - sg * 4 * back + (ball.x - p.hx) * 0.22, -HX + 3, HX - 3); p.tz = clamp(p.hz + (ball.z - p.hz) * 0.35, -HZ + 3, HZ - 3);
  }
  const GW = () => FIELD.GW;
  function aiKeeper(p) {
    const s = p.side; const sg = sgn(s); const goalX = -sg * HX;
    if (ball.owner === p) { // ボールを もった: すこし まって ながい パス
      if (S.dead <= 0 && p.cd <= 0) { const q = pickTarget(p, sg, rnd() - 0.5, true) || players[s][nearestIdx(s, p.x, p.z, p.idx)]; passTo(p, q, 1, true); }
      return;
    }
    const mine = ball.owner && ball.owner.side === s;
    const inD = (ball.x - goalX) * -sg * -1; // ゴールからの きょり
    let tx = goalX + sg * (mine ? 14 : 2.2 + clamp(len(ball.x - goalX, ball.z) * 0.06, 0, 5)); let tz = clamp(ball.z * 0.32, -GHW + 0.6, GHW - 0.6);
    // うたれた: ボールの とおりみち
    if (ball.shotBy && ball.shotBy.side !== s && len(ball.vx, ball.vz) > 10 && Math.sign(ball.vx) === Math.sign(goalX - ball.x) && Math.abs(goalX - ball.x) < 40) {
      const t = (goalX - ball.x) / (ball.vx || 1e-6); if (t > 0 && t < 3) { tz = clamp(ball.z + ball.vz * t, -GHW - 1, GHW + 1); tx = goalX + sg * 1.2; p.wantSprint = true; p.dive = true; }
    }
    // ルーズボールが ペナルティエリアの なか
    if (!ball.owner && Math.abs(ball.x - goalX) < 12 && Math.abs(ball.z) < 16 && len(ball.vx, ball.vz) < 8) { tx = ball.x; tz = ball.z; p.wantSprint = true; }
    p.tx = tx; p.tz = tz; void inD;
  }

  // ---- 1フレーム ---------------------------------------------------------------
  function movePlayer(p, dt, humanDrive) {
    let wx = 0; let wz = 0; let sprint = false;
    if (p.stun > 0) { p.stun -= dt; p.vx *= 0.9; p.vz *= 0.9; }
    else if (p.act === 'slide' && p.actT > 0) { /* すべり */ p.vx *= 0.96; p.vz *= 0.96; }
    else if (humanDrive) { wx = input.mx; wz = input.mz; sprint = !!input.sprint; const m = len(wx, wz); if (m > 1) { wx /= m; wz /= m; } }
    else {
      const dx = p.tx - p.x; const dz = p.tz - p.z; const d = len(dx, dz);
      if (d > 0.35) { const k = Math.min(1, d / 2.5); wx = (dx / d) * k; wz = (dz / d) * k; }
      sprint = p.wantSprint;
    }
    if (p.act === 'lunge' && p.actT > 0) { wx = Math.cos(p.dir); wz = Math.sin(p.dir); sprint = true; }
    // スタミナ
    const sp = len(wx, wz) > 0.5;
    if (sprint && sp && p.stamina > 0.05) p.stamina = Math.max(0, p.stamina - dt * 0.09 / mul(p.stats.STA, 0.7, 1.5)); else p.stamina = Math.min(1, p.stamina + dt * 0.06 * mul(p.stats.STA, 0.7, 1.4));
    p.sprint = sprint && sp && p.stamina > 0.05;
    let vmax = p.spd * (p.sprint ? 1.38 : 1) * (0.78 + 0.22 * Math.min(1, p.stamina * 2.2)) * (ball.owner === p ? 0.93 : 1);
    if (p.slot === 'GK') vmax *= p.wantSprint ? 1.25 : 0.85;
    if (p.act === 'slide' && p.actT > 0) vmax = 0;
    const tvx = wx * vmax; const tvz = wz * vmax; const acc = 22 * dt;
    if (!(p.act === 'slide' && p.actT > 0) && p.stun <= 0) { p.vx += clamp(tvx - p.vx, -acc, acc); p.vz += clamp(tvz - p.vz, -acc, acc); }
    p.x += p.vx * dt; p.z += p.vz * dt;
    p.x = clamp(p.x, -HX - 3, HX + 3); p.z = clamp(p.z, -HZ - 2.5, HZ + 2.5);
    const sv = len(p.vx, p.vz);
    if (sv > 0.7) { const target = Math.atan2(p.vz, p.vx); p.dir += clamp(angDiff(target, p.dir), -9 * dt, 9 * dt) * 1; }
    p.run = (p.run + sv * dt * 1.15) % (Math.PI * 2);
    if (p.cd > 0) p.cd -= dt; if (p.actT > 0) { p.actT -= dt; if (p.actT <= 0) p.act = ''; }
  }
  function separate() { // ぶつからない ように すこしだけ おしあう
    const all = [...players.a, ...players.b];
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
      const u = all[i]; const v = all[j]; const dx = v.x - u.x; const dz = v.z - u.z; const d2 = dx * dx + dz * dz;
      if (d2 < 0.64 && d2 > 1e-6) { const d = Math.sqrt(d2); const k = (0.8 - d) * 0.5; u.x -= (dx / d) * k * 0.5; u.z -= (dz / d) * k * 0.5; v.x += (dx / d) * k * 0.5; v.z += (dz / d) * k * 0.5; }
    }
  }
  function ballPhysics(dt) {
    if (ball.owner) {
      const o = ball.owner; const lead = 0.62;
      const tx = o.x + Math.cos(o.dir) * lead; const tz = o.z + Math.sin(o.dir) * lead;
      ball.x = lerp(ball.x, tx, 0.55); ball.z = lerp(ball.z, tz, 0.55); ball.y = 0.11; ball.vx = o.vx; ball.vz = o.vz; ball.vy = 0;
      return;
    }
    ball.free = Math.max(0, ball.free - dt); ball.passT += dt;
    ball.vy -= 9.8 * dt; ball.x += ball.vx * dt; ball.z += ball.vz * dt; ball.y += ball.vy * dt;
    if (ball.y < 0.11) { ball.y = 0.11; if (ball.vy < -1.4) ball.vy = -ball.vy * 0.5; else ball.vy = 0; }
    const fr = ball.y <= 0.12 ? 0.6 : 0.05; const sp = len(ball.vx, ball.vz); if (sp > 0) { const k = Math.max(0, 1 - (fr * dt * (sp > 0.3 ? 1 : 3))); ball.vx *= k; ball.vz *= k; if (sp < 0.15) { ball.vx = ball.vz = 0; } }
  }
  function pickups(dt) {
    if (ball.owner || S.ph === 'goal') return;
    const sp = len(ball.vx, ball.vz);
    // キーパーの セーブ
    if (ball.shotBy && !ball.saveRolled) {
      const gk = gkOf(other(ball.shotBy.side)); const dxg = gk.x - ball.x; const dzg = gk.z - ball.z;
      if (Math.abs(dxg) < 2.3 && Math.abs(dzg) < (gk.dive ? 3.1 : 2.2) && ball.y < 2.7) {
        ball.saveRolled = true;
        const near = Math.abs(dzg);
        const pS = clamp(0.64 + (mul(gk.stats.DEF, 0.8, 1.45) - mul(ball.shotBy.stats.SHO, 0.8, 1.45)) * 1.1 - (ball.shotSpeed - 18) / 50 - near * 0.1, 0.12, 0.93);
        if (rnd() < pS) { // せーぶ
          if (sp < 15 && rnd() < 0.6) { ball.owner = gk; touch(gk); ball.vx = ball.vz = ball.vy = 0; S.shotSave = true; log(`${gk.name}が キャッチ!`); }
          else { touch(gk); ball.vx = -ball.vx * 0.3; ball.vz = (dzg >= 0 ? -1 : 1) * (3 + rnd() * 4) * -1; ball.vy = 2.5; log(`${gk.name}が セーブ!`); }
          S.msgSave = 1; snd('save'); banner('セーブ!', 0.9); ball.shotBy = null; ball.free = 0.4; return;
        }
      }
    }
    if (ball.free > 0) return;
    if (ball.y > 1.2) return;
    let best = null; let bd = 1e9;
    for (const s of ['a', 'b']) for (const p of players[s]) {
      if (p.stun > 0 || p.cd > 0.3 && p === ball.lastP) continue;
      const rr = p.slot === 'GK' ? 1.15 : 0.82 + (p.act === 'slide' ? 0.7 : 0) + (p === ball.target ? 0.8 : 0);
      const d = len(p.x - ball.x, p.z - ball.z); if (d > rr) continue;
      if (sp > 17 && p.slot !== 'GK' && p !== ball.target && rnd() > 0.35 * mul(p.stats.DEF, 0.8, 1.3)) continue; // はやすぎて トラップ しっぱい
      const sc = d - (p === ball.target ? 0.3 : 0) - (p.stats.SPD / 400);
      if (sc < bd) { bd = sc; best = p; }
    }
    if (!best) return;
    // オフサイド
    if (ball.offside && best.side === ball.offside.side && ball.offside.set.includes(best.idx) && ball.passT < 3.5) {
      const o = ball.offside; ball.offside = null; S.offsides[o.side]++; log(`${best.name}は オフサイド!`);
      deadBall({ type: 'free', side: other(o.side), x: clamp(best.x, -HX + 2, HX - 2), z: clamp(best.z, -HZ + 1.5, HZ - 1.5), offside: true }, 'オフサイド!'); return;
    }
    ball.owner = best; touch(best); ball.vx = ball.vz = 0; ball.vy = 0; ball.shotBy = null; ball.offside = null; ball.target = null; best.cd = Math.max(best.cd, 0.1);
    if (best.side === 'a' && best.slot !== 'GK' && S.ctrlLock <= 0) S.ctrl = best.idx;
  }
  function checkBounds() {
    if (S.ph === 'goal' || S.ph === 'dead' || S.ph === 'kickoff') return;
    if (ball.owner) { const o = ball.owner; if (Math.abs(o.z) > HZ + 1.5 || Math.abs(o.x) > HX + 2.5) { /* おさえこみ */ o.x = clamp(o.x, -HX - 2, HX + 2); o.z = clamp(o.z, -HZ - 1, HZ + 1); } return; }
    if (Math.abs(ball.x) > HX && Math.abs(ball.z) < GHW && ball.y < FIELD.GH) { goal(ball.x > 0 ? 'a' : 'b'); return; }
    if (Math.abs(ball.x) > HX + 0.4 || Math.abs(ball.z) > HZ + 0.4) outOfPlay();
  }

  function step(dtIn) {
    const dt = Math.min(dtIn, 1 / 20);
    if (S.done) return;
    S.phT += dt; if (S.bannerT > 0) S.bannerT -= dt; if (S.flash > 0) S.flash -= dt; if (S.ctrlLock > 0) S.ctrlLock -= dt;
    const live = S.ph === 'play';
    if (live) { S.clock += dt; if (ball.owner) S.poss[ball.owner.side] += dt; }
    // じかん
    const tot = halfSec * 2;
    if (live && !S.extra && S.half === 1 && S.clock >= halfSec) { S.half = 2; S.ph = 'half'; S.phT = 0; snd('whistle'); banner('ハーフタイム', 2.2); }
    if (live && !S.extra && S.half === 2 && S.clock >= tot) { endRegulation(); }
    if (live && S.extra && S.clock >= tot + extraSec) { finish(null); }
    if (S.ph === 'half' && S.phT > 2.4) kickoff('b');
    if (S.ph === 'goal' && S.phT > 3.0) { if (S.golden) finish(S.winner); else if (S.half === 2 && S.clock >= tot && !S.extra) endRegulation(); else kickoff(other(S.celebrate.side)); }
    if (S.ph === 'kickoff' || S.ph === 'dead') { S.dead -= dt; if (S.dead <= 0) { S.ph = 'play'; S.phT = 0; ball.free = 0.15; } }
    if (S.ph === 'end') { return; }
    // ひとの そうさ
    if (S.ph === 'play' || S.ph === 'dead' || S.ph === 'kickoff') {
      if (S.ph === 'play' || (ball.owner && ball.owner.side === 'a' && S.dead <= 0.0)) humanActions(dt); else if (S.ph !== 'play') { shootCharge.release = false; pressed.pass = pressed.lob = pressed.shoot = pressed.tackle = false; }
      // ひとが うごかす せんしゅ(ボールを もって いない ときは じどうで ボールに ちかい 人に きりかえ)
      if (ownerSide() !== 'a' && S.ctrlLock <= 0 && S.ph === 'play') { const n = nearestIdx('a', ball.x, ball.z); if (n >= 0 && n !== S.ctrl) { const cur = ctrlP(); if (!cur || len(cur.x - ball.x, cur.z - ball.z) > len(players.a[n].x - ball.x, players.a[n].z - ball.z) + 2.5) { S.ctrl = n; S.ctrlLock = 0.5; } } }
    }
    // AI
    for (const s of ['a', 'b']) for (const p of players[s]) {
      const hd = s === 'a' && p.idx === S.ctrl && p.slot !== 'GK' || (s === 'a' && p.idx === S.ctrl);
      if (!hd) {
        if (S.ph === 'play' || S.ph === 'kickoff' || S.ph === 'dead') {
          if ((S.ph === 'dead' || S.ph === 'kickoff') && ball.owner === p && S.restart && S.restart.taker === p) { // AIの リスタート
            p.tx = p.x; p.tz = p.z; p.wantSprint = false;
            if (S.dead <= 0 && s !== 'a') { const q = S.restart.type === 'free' && Math.abs(p.x - goalOf(s).x) < 28 && rnd() < 0.45 ? null : pickTarget(p, sgn(s), 0, true) || players[s][nearestIdx(s, p.x, p.z, p.idx)]; if (q) passTo(p, q, 1, S.restart.type === 'goalkick' || S.restart.type === 'corner'); else shootAt(p, (rnd() - 0.5) * 5, 0.8); }
            else if (S.dead <= 0 && s === 'a' && S.restart.auto) { /* じどう */ }
          } else aiThink(p, dt);
        } else if (S.ph === 'goal' && S.celebrate && S.celebrate.side === s) { p.tx = S.celebrate.p ? S.celebrate.p.x : p.x; p.tz = S.celebrate.p ? S.celebrate.p.z : p.z; p.wantSprint = false; }
        else if (S.ph === 'half' || S.ph === 'end') { p.tx = p.x; p.tz = p.z; }
      }
      movePlayer(p, dt, hd && (S.ph === 'play' || S.ph === 'dead' || S.ph === 'kickoff'));
    }
    separate();
    // きょうつうの ボール
    ballPhysics(dt);
    if (S.ph === 'play') { pickups(dt); checkBounds(); }
    else if (S.ph === 'goal') { ball.vx *= 0.9; ball.vz *= 0.9; ball.x = clamp(ball.x, -HX - 2.6, HX + 2.6); ball.z = clamp(ball.z, -GHW - 0.6, GHW + 0.6); }
    if (S.ph === 'half' || S.ph === 'end') { if (!ball.owner) { ball.vx = ball.vz = ball.vy = 0; ball.y = 0.11; } ball.x = clamp(ball.x, -HX, HX); ball.z = clamp(ball.z, -HZ, HZ); }
    // けいさんで おかしく なったら もどす
    for (const k of ['x', 'y', 'z']) if (!Number.isFinite(ball[k])) { ball.x = 0; ball.z = 0; ball.y = 0.11; ball.vx = ball.vz = ball.vy = 0; ball.owner = players.a[firstFW('a')]; }
  }
  function endRegulation() {
    if (S.score.a !== S.score.b) return finish(null);
    S.extra = true; S.golden = true; S.ph = 'half'; S.phT = 0; banner('ひきわけ! ゴールデンゴール', 2.4); S.half = 3;
    S.clock = halfSec * 2;
  }
  function finish(winnerSide) {
    snd('whistle'); S.done = true; S.ph = 'end'; S.winner = winnerSide; banner('しゅうりょう!', 3);
  }
  // ---- がいぶからの そうさ -------------------------------------------------------------
  function press(k) {
    if (k === 'shoot') { if (ownerSide() === 'a' && ball.owner === ctrlP()) { shootCharge.on = true; shootCharge.t = 0; } else pressed.shoot = true; return; }
    pressed[k] = true;
  }
  function release(k) { if (k === 'shoot') { if (shootCharge.on) { shootCharge.on = false; if (ownerSide() === 'a' && ball.owner === ctrlP()) shootCharge.release = true; shootCharge.t = shootCharge.t; } } }
  kickoff('a');
  S.ph = 'kickoff'; S.dead = 1.6;
  return {
    state: S, players, ball, input, homes, press, release, step, charge: shootCharge, teams, aiLevel, ctrlP, minuteNow, FIELD,
    skip() { /* しあいを すぐ おわらせる(テスト・とばす用) */ let n = 0; while (!S.done && n++ < 200000) step(1 / 30); },
  };
}
