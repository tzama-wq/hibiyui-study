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

// せんじゅつ(ちょうさ: ラインの たかさ・プレス・はば・カウンター。IFAB の ルールと こうしきの コーチング しりょうを さんこうに した)
//   attack=たかい ラインで はやく プレス / balance=バランス / counter=ひくく まもって はやい カウンター
export const TACTICS = {
  attack: { line: 0.07, press: 2.4, width: 1.12, direct: 0.45, counter: false, name: 'アタック' },
  balance: { line: 0, press: 1.6, width: 1, direct: 0.55, counter: false, name: 'バランス' },
  counter: { line: -0.07, press: 1, width: 0.95, direct: 0.95, counter: true, name: 'カウンター' },
};
const STYLE_TACT = { att: 'attack', bal: 'balance', def: 'counter' };
// むずかしさ: easy(かんたん・はじめは これ)/ normal / hard。てきの うごき・かんの よさと、じぶんの アシストの つよさが かわる
export const DIFFS = {
  easy: { ai: 0.8, spd: 1.05, myAcc: 0.75, opAcc: 1.3, aim: 0.5, gk: 0.1, tackle: 0.16, range: 0.8, pickup: 0.8, stam: 0.55, react: 1.3, press: 1.4 },
  normal: { ai: 0.95, spd: 1.02, myAcc: 0.9, opAcc: 1.1, aim: 0.25, gk: 0.05, tackle: 0.12, range: 0.6, pickup: 0.65, stam: 0.8, react: 1.1, press: 1.8 },
  hard: { ai: 1, spd: 1, myAcc: 1, opAcc: 1, aim: 0, gk: 0, tackle: 0.1, range: 0.5, pickup: 0.5, stam: 1, react: 1, press: 2 },
};
export function createPlay({ me, opp, halfSec = 90, rnd = Math.random, level = 1, extraSec = 60, tactic = 'balance', auto: autoOpt = false, diff = 'easy', mode = 'solo' }) {
  // mode: solo=ひとり(a が にんげん)/ coop=ふたりで a を うごかす / versus=a と b を それぞれ にんげんが うごかす
  const DF = DIFFS[diff] || DIFFS.easy;
  let auto = !!autoOpt;
  const myPow = avg(me.team); const opPow = avg(opp.team);
  function avg(t) { return t.reduce((a, m) => a + (m.stats.SHO + m.stats.PAS + m.stats.SPD + m.stats.DEF + m.stats.STA) / 5, 0) / Math.max(1, t.length); }
  const aiLevel = clamp((opPow / Math.max(30, myPow)) ** 0.5 * level * DF.ai, 0.5, 1.5); // てきの つよさ(じぶんより つよいほど おおきい)

  const teams = { a: me, b: opp };
  const tact = { a: TACTICS[tactic] || TACTICS.balance, b: TACTICS[STYLE_TACT[opp.style]] || TACTICS.balance };
  const players = { a: [], b: [] };
  const homes = { a: formationPos(me.team), b: formationPos(opp.team) };
  for (const s of ['a', 'b']) {
    teams[s].team.forEach((m, i) => {
      const st = m.stats;
      players[s].push({ side: s, idx: i, slot: m.slot, name: m.name, face: m.face || '', m, stats: st,
        x: 0, z: 0, vx: 0, vz: 0, dir: s === 'a' ? 0 : Math.PI, stamina: 1, stun: 0, cd: 0, act: '', actT: 0,
        spd: 6.1 * mul(st.SPD, 0.72, 1.42) * (s === 'b' && mode !== 'versus' ? lerp(0.82, 1.1, clamp((aiLevel - 0.5) / 0.9, 0, 1)) : DF.spd), yc: 0, off: false,
        sprint: false, run: 0, aiT: rnd() * 0.3, tx: 0, tz: 0, wantSprint: false });
    });
  }
  const gkOf = (s) => players[s].find((p) => p.slot === 'GK') || players[s][players[s].length - 1];
  const ball = { x: 0, y: 0.11, z: 0, vx: 0, vy: 0, vz: 0, owner: null, lastSide: 'a', lastP: null, prevP: null, shotBy: null, shotSpeed: 0, saveRolled: false, free: 0, passT: 99, offside: null };

  const S = {
    ph: 'kickoff', phT: 0, half: 1, clock: 0, // clock: じっさいの びょう(ぜんはん+こうはん)
    score: { a: 0, b: 0 }, events: [], shots: { a: 0, b: 0 }, fouls: { a: 0, b: 0 }, offsides: { a: 0, b: 0 }, poss: { a: 0.001, b: 0.001 },
    restart: null, dead: 0, banner: '', bannerT: 0, msg: '', done: false, ctrl: 0, ctrlLock: 0, kickSide: 'a', extra: false, golden: false, winner: null,
    celebrate: null, flash: 0, cards: [], snd: [], e1: halfSec, e2: halfSec * 2, base1: halfSec, add: { 1: 0, 2: 0 }, mark: { goals: 0, fouls: 0, cards: 0, pen: 0 }, restartCount: { penalty: 0 }, restartFresh: false, lostAt: { a: -99, b: -99 }, gainedAt: { a: -99, b: -99 }, auto: !!autoOpt,
  };
  const snd = (n) => { if (S.snd.length < 20) S.snd.push(n); };
  // にんげんの コントローラ(ひとり: a / きょうりょく: a と a / たいせん: a と b)。key= S の なかの せんしゅばんごうの なまえ
  const mkCtl = (side, key, lock) => ({ side, key, lock, input: { mx: 0, mz: 0, sprint: false }, pressed: { pass: false, shoot: false, lob: false, tackle: false, switch: false }, shootCharge: { on: false, t: 0 }, passCharge: { on: false, t: 0, release: false }, flick: null });
  const C = [mkCtl('a', 'ctrl', 'ctrlLock')]; if (mode === 'coop') C.push(mkCtl('a', 'ctrl2', 'ctrlLock2')); if (mode === 'versus') C.push(mkCtl('b', 'ctrl2', 'ctrlLock2'));
  S.ctrl2 = 0; S.ctrlLock2 = 0;
  const humanSides = new Set(C.map((c) => c.side));
  const input = C[0].input; const pressed = C[0].pressed; const shootCharge = C[0].shootCharge; const passCharge = C[0].passCharge;
  const log = (t) => { S.msg = t; };
  const banner = (t, d = 1.4) => { S.banner = t; S.bannerT = d; };
  // アディショナルタイム: ぜんはん・こうはんの おわりに「+なんぷん」。ゴール・ファウル・カードが おおい ほど ながい(1〜5ふん)
  const addSec = (m) => (m * halfSec) / 45; // ゲームないの なんぷんを じっさいの なんびょうに するか
  function addedMinutes() {
    const g = S.events.length - S.mark.goals; const f = S.fouls.a + S.fouls.b - S.mark.fouls; const c = S.cards.length - S.mark.cards; const pen = S.restartCount.penalty - S.mark.pen;
    return clamp(1 + Math.round(g * 0.9 + f * 0.28 + c * 0.8 + pen * 1.2), 1, 5);
  }
  const minuteNow = () => { // ゲームないの ふん(ぜんはん 0〜45・こうはん 45〜90)。アディショナルは 45/90 の まま
    if (S.clock < S.base1) return Math.min(45, Math.floor((S.clock / halfSec) * 45));
    if (S.clock < S.e1) return 45;
    const c2 = S.clock - S.e1; if (c2 < halfSec) return 45 + Math.min(45, Math.floor((c2 / halfSec) * 45));
    return 90;
  };
  const clockText = () => { // がめんの ひょうじ: 12' / 45+2' / 90+1'
    const m = minuteNow(); if (S.extra) return `えんちょう`;
    if (S.clock >= S.base1 && S.clock < S.e1) return `45+${Math.max(1, Math.ceil(((S.clock - S.base1) / halfSec) * 45))}'`;
    if (S.half === 2 && S.clock >= S.e1 + halfSec) return `90+${Math.max(1, Math.ceil(((S.clock - S.e1 - halfSec) / halfSec) * 45))}'`;
    return `${m}'`;
  };

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
    S.ph = 'kickoff'; S.phT = 0; S.dead = 1.2; S.restart = { type: 'kickoff', side, taker: k }; S.restartFresh = true;
    for (const q of players[other(side)]) { const dd = len(q.x, q.z); if (!q.off && dd < 9.8) { const a = Math.atan2(q.z, q.x) || 0.1; q.x = Math.cos(a) * 9.9; q.z = Math.sin(a) * 9.9; } } // ルール: キックオフは あいてが センターサークルの そと S.ctrl = side === 'a' ? k.idx : nearestIdx('a', 0, 0);
    S.celebrate = null;
  }

  // ---- ヘルパー ----------------------------------------------------------------
  function nearestIdx(side, x, z, excl = -1, noGK = true) {
    let best = -1; let bd = 1e9;
    players[side].forEach((p) => { if (p.idx === excl || p.off || (noGK && p.slot === 'GK')) return; const d = len(p.x - x, p.z - z); if (d < bd) { bd = d; best = p.idx; } });
    return best;
  }
  function setAuto(v) { auto = !!v; S.auto = auto; for (const c of C) { c.input.mx = c.input.mz = 0; c.input.sprint = false; c.shootCharge.on = false; } }
  const ctrlOf = (c) => players[c.side][S[c.key]];
  const ctrlP = () => ctrlOf(C[0]);
  const isHumanSide = (sd) => !auto && humanSides.has(sd);
  const ctlOf = (p) => (auto ? null : C.find((c) => c.side === p.side && S[c.key] === p.idx) || null);
  const isCtl = (p) => !!ctlOf(p);
  const mateOf = (c) => C.find((q) => q !== c && q.side === c.side);
  function setCtl(c, idx) { const mate = mateOf(c); if (mate && S[mate.key] === idx) { const cur = S[c.key]; S[c.key] = cur; return; } S[c.key] = idx; } // なかまが うけとる パスなら そのまま(じぶんは とどまる)
  function claimCtl(p) { // ボールを とった せんしゅを にんげんが うごかす(ロックちゅうは かえない)
    const cs = C.filter((c) => c.side === p.side); if (!cs.length || cs.some((c) => S[c.key] === p.idx)) return;
    const dl = (c) => { const q = ctrlOf(c); return q ? len(q.x - ball.x, q.z - ball.z) : 99; };
    const c = cs.filter((q) => S[q.lock] <= 0).sort((u, v) => dl(v) - dl(u))[0]; if (c) S[c.key] = p.idx;
  }
  const ownerSide = () => (ball.owner ? ball.owner.side : null);
  function lastDefX(defSide) { // まもりの いちばん うしろから 2ばんめ(オフサイドライン)の ざひょう(あいての ゴールに ちかい ほうが おおきい x for a)
    const sg = sgn(other(defSide)); // こうげき がわの むき
    const xs = players[defSide].filter((p) => !p.off).map((p) => p.x * sg).sort((u, v) => v - u); // こうげき むきの ざひょうで おおきい じゅん
    return (xs[1] != null ? xs[1] : xs[0]) * sg;
  }

  // ---- ボールを うごかす ----------------------------------------------------------
  function touch(p) {
    if (ball.lastSide && ball.lastSide !== p.side) { S.lostAt[ball.lastSide] = S.clock; S.gainedAt[p.side] = S.clock; }
    if (ball.indirectBy && ball.indirectBy !== p) ball.indirectBy = null; // ほかの 人が さわったら ふつうの キックに なる
    ball.prevP = ball.lastP; ball.lastP = p; ball.lastSide = p.side;
  }
  function kick(p, vx, vz, vy, kind) {
    ball.owner = null; ball.x = p.x + Math.cos(p.dir) * 0.6; ball.z = p.z + Math.sin(p.dir) * 0.6; ball.y = 0.15;
    ball.vx = vx; ball.vz = vz; ball.vy = vy; touch(p); p.cd = 0.45; p.act = 'kick'; p.actT = 0.25; ball.free = 0.25; ball.kind = kind;
    ball.pen = kind === 'shot' && S.restartFresh && S.restart && S.restart.type === 'penalty'; S.restartFresh = false; snd(kind === 'shot' ? 'kick' : 'pass'); ball.passT = 0; ball.saveRolled = false; ball.shotBy = kind === 'shot' ? p : null; ball.shotSpeed = kind === 'shot' ? len(vx, vz) : 0;
    if (kind === 'shot') S.shots[p.side]++;
  }
  function offsideSnapshot(p) { // パスを だした しゅんかんに オフサイドの いちに いる みかた
    // ルール: ゴールキック・スローイン・コーナーキックから ボールを うけても オフサイドに ならない(IFAB 11じょう)
    if (S.restartFresh && S.restart && S.restart.taker === p && ['throw', 'goalkick', 'corner', 'kickoff'].includes(S.restart.type)) { ball.offside = null; return; }
    const sg = sgn(p.side); const line = lastDefX(other(p.side));
    const set = players[p.side].filter((q) => q !== p && !q.off && q.slot !== 'GK' && q.x * sg > line * sg + 0.3 && q.x * sg > ball.x * sg + 0.3 && q.x * sg > 0).map((q) => q.idx);
    ball.offside = set.length ? { side: p.side, set, from: { x: p.x, z: p.z } } : null;
  }
  // パスの あいて えらび: むいている ほうこう(dx,dz)に いちばん ちかく、ちかい 人
  function pickTarget(p, dx, dz, forward = false) {
    const sg = sgn(p.side); const mag = len(dx, dz);
    const ang = mag > 0.2 ? Math.atan2(dz, dx) : p.dir;
    let best = null; let bs = -1e9;
    for (const q of players[p.side]) {
      if (q === p || q.off) continue;
      const d = len(q.x - p.x, q.z - p.z); if (d < 3) continue;
      const a2 = Math.atan2(q.z - p.z, q.x - p.x); const da = Math.abs(angDiff(a2, ang));
      if (da > 1.05 && mag > 0.2) continue;
      let sc = -da * 14 - d * 0.18 + ((q.x - p.x) * sg) * (forward ? 0.25 : 0.06 + 0.2 * (tact[p.side].direct - 0.5));
      if (q.slot === 'GK') sc -= 12;
      // あいてが まわりに いない 人を このむ
      const near = players[other(p.side)].reduce((m, o) => (o.off ? m : Math.min(m, len(o.x - q.x, o.z - q.z))), 99); sc += Math.min(near, 8) * 0.9;
      if (sc > bs) { bs = sc; best = q; }
    }
    return best;
  }
  function passTo(p, q, power = 1, lob = false) {
    const err = (1 - clamp(p.stats.PAS / 140, 0, 0.9)) * 0.1 * (lob ? 1.5 : 1);
    const d = len(q.x - p.x, q.z - p.z);
    // ロング(たかい ボール): ちゃくちするまでの じかん T から いきおいを きめる(とどく きょりは さいだい 48m。ゴールキックが あいての ゴールまで とどかない)
    const T = clamp(0.75 + Math.min(d, 48) * 0.03, 1.0, 2.2);
    // じめんの パス: まさつで おちる ぶんを ひいて、ちょうど あいてに とどく いきおいに する。power が おおきい ほど はやい(ひらきの ある ボール)
    const vAvg = clamp(13 * power, 7, 26); const Tg = d / vAvg; const v0g = clamp((d * 0.9) / (1 - Math.exp(-0.9 * Tg)), 9, 36);
    const sp = lob ? (Math.min(d, 48) / T) * 1.05 * clamp(power, 0.5, 1.1) : v0g;
    const t = d / Math.max(1, sp); const lx = q.x + q.vx * Math.min(t, T) * 0.8; const lz = q.z + q.vz * Math.min(t, T) * 0.8; // さきまわり
    let a = Math.atan2(lz - p.z, lx - p.x) + (rnd() - 0.5) * 2 * err;
    p.dir = a; offsideSnapshot(p);
    kick(p, Math.cos(a) * sp, Math.sin(a) * sp, lob ? 4.9 * T : 0, lob ? 'lob' : 'pass');
    ball.target = q; return q;
  }
  // フリックパス: ほうこう(dx,dz)と つよさ(0〜1)で けるパス。その ほうこうの みかたが いれば その人へ、いなければ ほうこうへ そのまま ころがす
  function passDir(p, dx, dz, pw01) {
    const ang = Math.atan2(dz, dx); const D = lerp(6, 44, clamp(pw01, 0, 1)); let best = null; let bs = 1e9;
    for (const q of players[p.side]) {
      if (q === p || q.off) continue;
      const d = len(q.x - p.x, q.z - p.z); const da = Math.abs(angDiff(Math.atan2(q.z - p.z, q.x - p.x), ang));
      if (da > 0.42 || d < 3 || d < D * 0.55 || d > D * 1.5) continue;
      const sc = da * 14 + Math.abs(d - D) * 0.25 + (q.slot === 'GK' ? 8 : 0); if (sc < bs) { bs = sc; best = q; }
    }
    if (best) { passTo(p, best, 1.1 + pw01 * 0.5, false); return best; }
    // あいてが いない: そのまま ほうこうへ。つよさで きょりが かわる
    const v0 = clamp(D * 0.9, 6, 36); // ころがって とまる きょりが D(まさつを ふくめて)
    p.dir = ang; offsideSnapshot(p); kick(p, Math.cos(ang) * v0, Math.sin(ang) * v0, 0, 'pass'); ball.target = null; return null;
  }
  function shootAt(p, aimZ, power) { // power 0..1
    if (p.side === 'a' && !auto && DF.aim > 0 && p.slot !== 'GK') { const gk = gkOf('b'); const want = (gk.z >= 0 ? -1 : 1) * 2.7; aimZ = aimZ * (1 - DF.aim) + want * DF.aim; } // アシスト: キーパーと はんたいの すみに ねらいを よせる
    const sg = sgn(p.side); const gx = sg * HX;
    const press = players[other(p.side)].reduce((m, o2) => Math.min(m, len(o2.x - p.x, o2.z - p.z)), 99);
    const dgo = len(gx - p.x, p.z);
    const err = (1 - clamp(p.stats.SHO / 150, 0, 0.9)) * (0.16 + power * 0.18) * (1 + clamp((28 - dgo) / 28, -0.4, 0) * -0.0 + clamp(dgo / 40, 0, 1) * 0.9) * (press < 2.6 ? 1.5 : 1) * (p.side === 'a' ? DF.myAcc : DF.opAcc);
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
    if (S.restartFresh && S.restart && ball.owner === S.restart.taker && d !== S.restart.taker) return false; // けるまえは ボールを うばえない(フリーキック・ゴールキックなど)
    snd('tackle');
    const dx = c.x - d.x; const dz = c.z - d.z; const dist = len(dx, dz);
    const human = isCtl(d); // にんげんの アシスト: すこし とおくても タックルできる
    const range = (slide ? 2.4 : 1.55) + (human ? DF.range : 0); if (dist > range) return false;
    d.cd = slide ? 1.0 : 0.7; d.act = slide ? 'slide' : 'tackle'; d.actT = slide ? 0.55 : 0.3; d.dir = Math.atan2(dz, dx);
    if (slide) { d.vx = Math.cos(d.dir) * 9; d.vz = Math.sin(d.dir) * 9; }
    const behind = Math.cos(angDiff(Math.atan2(d.z - c.z, d.x - c.x), c.dir)) < -0.35; // ディフェンダーが うしろから
    const drib = mul((c.stats.SPD + c.stats.SHO) / 2, 0.8, 1.5); const df = mul(d.stats.DEF, 0.8, 1.5);
    const pOk = clamp(0.42 + (df - drib) * 1.2 + (slide ? 0.1 : 0) - (c.sprint ? 0.06 : 0) + (human ? DF.tackle : 0) + (d.side === 'b' && !humanSides.has('b') ? (aiLevel - 1) * 0.35 : 0), 0.18, 0.88); // つよい てきほど タックルが うまい
    const roll = rnd();
    const foulP = behind ? (slide ? 0.4 : 0.22) : (slide ? 0.2 : 0.04);
    if (roll < pOk) { // せいこう
      if (behind && rnd() < foulP * 0.5) return foul(d, c, slide ? 0.3 : 0);
      ball.owner = null; ball.free = 0.2; touch(d);
      ball.x = c.x; ball.z = c.z; ball.y = 0.11; const a = d.dir + (rnd() - 0.5) * 1.6;
      ball.vx = Math.cos(a) * 5; ball.vz = Math.sin(a) * 5; ball.vy = 0.6;
      c.stun = 0.55; c.cd = 0.6; log(`${d.name}が タックル!`);
      if (rnd() < 0.55) { ball.owner = d; ball.vx = ball.vz = 0; }
      return 'won';
    }
    if (rnd() < foulP) return foul(d, c, slide ? 0.5 : 0);
    d.stun = slide ? 1.0 : 0.55; // しっぱい: すかされる
    log(`${c.name}が かわした!`); return 'miss';
  }
  const inArea = (side, x, z) => x * sgn(other(side)) > HX - FIELD.PAd && Math.abs(z) < FIELD.PAh; // side が まもる ペナルティエリアの なか?
  function foul(d, c, serious = 0) {
    // ルール(IFAB 12じょう): ふつうの ファウル=ちょくせつ フリーキック / あらい=イエロー / ひどい=レッド / じぶんの エリアの なか=ペナルティキック
    S.fouls[d.side]++; log(`${d.name}の ファウル!`);
    const behind = Math.cos(angDiff(Math.atan2(d.z - c.z, d.x - c.x), c.dir)) < -0.35;
    const reckless = rnd() < (0.1 + serious * 0.25 + (behind ? 0.08 : 0)); let red = rnd() < (0.012 + serious * 0.05);
    let text = 'ファウル!';
    if (reckless && !red) { d.yc++; if (d.yc >= 2) { red = true; text = 'にまいめの イエロー! たいじょう!'; } else { S.cards.push({ name: d.name, side: d.side, idx: d.idx, t: S.clock, color: 'yellow' }); text = 'ファウル! イエローカード!'; } }
    if (red) { if (text === 'ファウル!') text = 'ファウル! レッドカード! たいじょう!'; S.cards.push({ name: d.name, side: d.side, idx: d.idx, t: S.clock, color: 'red' }); sendOff(d); }
    const pen = inArea(d.side, d.x, d.z) || inArea(d.side, c.x, c.z);
    if (pen) deadBall({ type: 'penalty', side: c.side, x: sgn(c.side) * (HX - 11), z: 0 }, 'ペナルティキック!' + (red ? ' レッド!' : ''));
    else deadBall({ type: 'free', side: c.side, x: clamp(c.x, -HX + 2, HX - 2), z: clamp(c.z, -HZ + 1.5, HZ - 1.5) }, text);
    if (!d.off) d.stun = 1.0;
    c.stun = 0.4; return 'foul';
  }
  function sendOff(d) { d.off = true; d.x = d.side === 'a' ? -HX - 6 : HX + 6; d.z = -HZ - 4; d.vx = d.vz = 0; if (ball.owner === d) ball.owner = null; S.reds = (S.reds || 0) + 1; for (const c of C) if (c.side === d.side && S[c.key] === d.idx) S[c.key] = nearestIdx(d.side, ball.x, ball.z, d.idx); }

  // ---- デッドボール(スローイン・ゴールキック・コーナー・フリーキック) ----------------------
  function deadBall(r, text) {
    snd('whistle'); S.ph = 'dead'; S.phT = 0; S.restart = r; S.restartAt = S.clock; S.restartFresh = true; if (r.type === 'penalty') S.restartCount.penalty++; S.dead = r.type === 'penalty' ? 2.2 : 1.6;
    ball.owner = null; ball.vx = ball.vy = ball.vz = 0; ball.y = 0.11; ball.offside = null; ball.free = 0.1; ball.indirectBy = null; ball.pen = false; ball.target = null; ball.shotBy = null;
    ball.x = r.x; ball.z = r.z;
    if (text) banner(text, 1.5);
    for (const s of ['a', 'b']) formation(s, r.side);
    const sg = sgn(r.side); const D = other(r.side);
    const ok = (q) => !q.off && q.slot !== 'GK';
    let taker;
    if (r.type === 'goalkick') taker = gkOf(r.side);
    else if (r.type === 'penalty') taker = players[r.side].filter(ok).sort((u, v) => v.stats.SHO - u.stats.SHO)[0];
    else taker = players[r.side][nearestIdx(r.side, r.x, r.z, -1, true)];
    r.taker = taker;
    taker.x = r.x - sg * (r.type === 'throw' ? 0 : r.type === 'goalkick' ? 0.7 : 0.9); taker.z = r.z + (r.type === 'throw' ? Math.sign(r.z || 1) * 0.3 : 0);
    if (r.type === 'throw') taker.x = r.x;
    taker.vx = taker.vz = 0; taker.stun = 0; taker.tx = taker.x; taker.tz = taker.z; taker.cd = 0;
    ball.owner = taker; ball.lastSide = r.side; ball.lastP = taker;
    taker.dir = r.type === 'throw' ? (r.z > 0 ? -Math.PI / 2 : Math.PI / 2) : (r.type === 'corner' ? Math.atan2(-r.z, -sg * 14) : (r.side === 'a' ? 0 : Math.PI));
    const park = (q, x, z) => { q.x = x; q.z = z; q.vx = q.vz = 0; q.tx = x; q.tz = z; };
    // まもる がわは 9.15メートル はなれる(スローインは 2メートル)。 ゴールキック・ペナルティは エリアの そと
    const away = r.type === 'throw' ? 2.5 : 9.3;
    if (r.type === 'free' || r.type === 'corner') {
      const gx = sgn(r.side) * HX; // こうげき がわの ゴール
      const ang = Math.atan2(0 - r.z, gx - r.x); const dgoal = len(gx - r.x, -r.z);
      const defs = players[D].filter(ok);
      if (r.type === 'free' && dgoal < 34) { // かべ: ボールと ゴールの あいだに 4にん
        const wallers = defs.slice().sort((u, v) => len(u.x - r.x, u.z - r.z) - len(v.x - r.x, v.z - r.z)).slice(0, 4);
        wallers.forEach((q, j) => park(q, r.x + Math.cos(ang) * 9.4 - Math.sin(ang) * (j - 1.5) * 1.1, r.z + Math.sin(ang) * 9.4 + Math.cos(ang) * (j - 1.5) * 1.1));
      }
      for (const q of defs) { const dd = len(q.x - r.x, q.z - r.z); if (dd < away) { const a = Math.atan2(q.z - r.z, q.x - r.x) || 0.1; park(q, r.x + Math.cos(a) * (away + 0.3), r.z + Math.sin(a) * (away + 0.3)); } }
    }
    if (r.type === 'throw') for (const q of players[D].filter(ok)) { const dd = len(q.x - r.x, q.z - r.z); if (dd < away) park(q, r.x + (q.x >= r.x ? 1 : -1) * 2.8, r.z - Math.sign(r.z || 1) * 1.5); }
    if (r.type === 'goalkick' || r.type === 'penalty') {
      const endSign = r.type === 'goalkick' ? Math.sign(r.x) : sgn(r.side); // ボールの ある がわの ゴールの むき
      const line = endSign * (HX - FIELD.PAd - 2.5); let n = 0;
      for (const q of [...players[D].filter(ok), ...(r.type === 'penalty' ? players[r.side].filter((o) => ok(o) && o !== taker) : [])]) {
        if (Math.abs(q.x) > HX - FIELD.PAd - 0.3 && Math.sign(q.x) === endSign && Math.abs(q.z) < FIELD.PAh + 0.3) park(q, line - endSign * (n % 3) * 2.2, -9 + (n++ % 7) * 3);
      }
    }
    if (r.type === 'penalty') { // キーパーは ゴールライン、ほかは エリアの そと
      const gk = gkOf(D); park(gk, sgn(r.side) * (HX - 0.6), 0); gk.penDive = undefined; gk.dir = sgn(r.side) > 0 ? Math.PI : 0;
      ball.x = r.x; ball.z = 0; taker.x = r.x - sg * 0.7; taker.z = 0;
    }
    if (r.type === 'kickoff') for (const q of players[D].filter(ok)) { const dd = len(q.x, q.z); if (dd < 9.6) { const a = Math.atan2(q.z, q.x) || 0.1; park(q, Math.cos(a) * 9.8, Math.sin(a) * 9.8); } }
    if (r.type === 'corner') { // コーナー: こうげきは エリアの なかへ、まもりは マーク
      const att = players[r.side].filter((q) => ok(q) && q !== taker); const def = players[D].filter(ok);
      att.forEach((q, j) => { q.hx = sg * (HX - 6 - (j % 3) * 3.5); q.hz = -7 + (j % 6) * 2.8; q.tx = q.hx; q.tz = q.hz; });
      def.forEach((q, j) => { q.hx = sg * (HX - 5 - (j % 3) * 3); q.hz = -6.5 + (j % 6) * 2.6; q.tx = q.hx; q.tz = q.hz; });
    }
    r.indirect = !!r.offside; if (r.indirect) ball.indirectBy = taker;
    C.forEach((c) => { if (auto) return; const mate = mateOf(c); const first = C.find((q) => q.side === c.side) === c; if (r.side === c.side) S[c.key] = first ? taker.idx : nearestIdx(c.side, r.x, r.z, taker.idx); else S[c.key] = nearestIdx(c.side, r.x, r.z, mate ? S[mate.key] : -1); });
  }
  function outOfPlay() {
    const last = ball.lastSide; const x = ball.x; const z = ball.z;
    if (Math.abs(z) > HZ) { // タッチラインを でた → スローイン(あいてが ボールに さわって いた ほうの あいて)
      deadBall({ type: 'throw', side: other(last), x: clamp(x, -HX + 1, HX - 1), z: Math.sign(z) * HZ }, 'スローイン');
    } else if (Math.abs(x) > HX) { // ゴールラインを でた
      const atEnd = Math.sign(x); const defSide = atEnd > 0 ? 'b' : 'a'; // x=+HX は b が まもる ゴール
      if (last === defSide) deadBall({ type: 'corner', side: other(defSide), x: atEnd * HX, z: z >= 0 ? HZ - 0.5 : -HZ + 0.5 }, 'コーナーキック');
      else deadBall({ type: 'goalkick', side: defSide, x: atEnd * (HX - 5.5), z: 0 }, 'ゴールキック');
    }
  }
  function goal(side) { // side が ゴール
    if (ball.indirectBy && ball.indirectBy.side === side) { // かんせつ フリーキックが そのまま はいっても ゴールに ならない → ゴールキック
      const d = other(side); const atEnd = sgn(side); log('かんせつ フリーキックは ゴールに ならないよ'); deadBall({ type: 'goalkick', side: d, x: atEnd * (HX - 5.5), z: 0 }, 'ノーゴール! ゴールキック'); return;
    }
    S.score[side]++; const sc = ball.lastP && ball.lastP.side === side ? ball.lastP : (ball.shotBy || ball.lastP);
    const ass = ball.prevP && ball.prevP.side === side && ball.prevP !== sc ? ball.prevP : null;
    S.events.push({ side, type: 'goal', scorer: sc ? sc.name : '', assist: ass ? ass.name : '', minute: minuteNow(), mt: clockText(), own: sc ? sc.side !== side : false, from: S.restart && S.restartAt != null && S.clock - S.restartAt < 7 ? S.restart.type : 'open' });
    snd('goal'); S.ph = 'goal'; S.phT = 0; S.celebrate = { side, p: sc }; S.flash = 0.4; banner('ゴール!!', 2.2); log(`ゴール!! ${sc ? sc.name : ''}`);
    ball.owner = null; ball.vx *= 0.15; ball.vz *= 0.15; ball.vy = 0; ball.x = clamp(ball.x, -HX - 1, HX + 1);
    if (S.golden) { S.winner = side; }
  }

  // ---- にんげんの そうさ ------------------------------------------------------------
  function humanActions(c, dt) {
    const p = ctrlOf(c); if (!p) return; const { input, pressed, shootCharge, passCharge } = c; const me = c.side; const foe = other(me);
    const lockK = c.lock; const has = ball.owner === p;
    // きりかえ
    if (pressed.switch) { pressed.switch = false; if (ownerSide() !== me) { S[c.key] = nextBallSide(c); S[lockK] = 1.2; } }
    if (has && p.cd <= 0 && p.stun <= 0) {
      const dx = input.mx; const dz = input.mz;
      if (c.flick) { const f = c.flick; c.flick = null; const q = passDir(p, f.dx, f.dz, f.pw); if (q) { setCtl(c, q.idx); S[lockK] = 0.8; } passCharge.t = 0; }
      else if (passCharge.release) { passCharge.release = false; const t = passCharge.t; passCharge.t = 0; const pw = t < 0.15 ? 1.15 : clamp(1.15 + (t - 0.15) * 0.8, 1.15, 1.85); const q = pickTarget(p, dx, dz, false); if (q) { passTo(p, q, pw, false); setCtl(c, q.idx); S[lockK] = 0.8; } }
      else if (pressed.lob) { pressed.lob = false; const q = pickTarget(p, dx, dz, true); if (q) { passTo(p, q, 1, true); setCtl(c, q.idx); S[lockK] = 0.8; } }
      else if (shootCharge.on === false && pressed.shoot) { pressed.shoot = false; shootAt(p, p.z * 0.4 + (dz || 0) * 3.4, 0.55); }
      if (shootCharge.release) { shootCharge.release = false; const pw = clamp(shootCharge.t / 0.9, 0.2, 1); shootAt(p, p.z * 0.3 + (input.mz || 0) * 3.4, pw); shootCharge.t = 0; }
    } else { pressed.pass = pressed.lob = false; c.flick = null; passCharge.release = false; if (shootCharge.release) { shootCharge.release = false; shootCharge.t = 0; } }
    if (shootCharge.on) shootCharge.t = Math.min(1.2, shootCharge.t + dt);
    if (passCharge.on) passCharge.t = Math.min(1.1, passCharge.t + dt);
    if (!has) {
      if (pressed.tackle) { pressed.tackle = false; const o = ball.owner && ball.owner.side === foe ? ball.owner : null; if (o && p.cd <= 0 && p.stun <= 0) { if (len(o.x - p.x, o.z - p.z) <= 2.1) tackle(p, o, false); else { p.act = 'lunge'; p.actT = 0.35; p.cd = 0.5; } } }
      if (pressed.shoot) { pressed.shoot = false; const o = ball.owner && ball.owner.side === foe ? ball.owner : null; if (o && p.cd <= 0 && p.stun <= 0) tackle(p, o, true); else if (p.cd <= 0 && p.stun <= 0) { p.act = 'slide'; p.actT = 0.5; p.cd = 0.9; p.vx = Math.cos(p.dir) * 9; p.vz = Math.sin(p.dir) * 9; } }
    }
    pressed.tackle = false;
  }
  function nextBallSide(c) { // ボールに ちかい じゅんに きりかえ(なかまの コントローラの せんしゅは とばす)
    const mate = mateOf(c); const arr = players[c.side].filter((p) => p.slot !== 'GK' && !p.off && !(mate && S[mate.key] === p.idx)).sort((u, v) => len(u.x - ball.x, u.z - ball.z) - len(v.x - ball.x, v.z - ball.z));
    const cur = arr.findIndex((p) => p.idx === S[c.key]); return arr[(cur + 1) % arr.length].idx;
  }

  // ---- AI ---------------------------------------------------------------------
  const goalOf = (s) => ({ x: sgn(s) * HX, z: 0 });
  function aiRestart(p) { // リスタートの キッカーが じどうで けつ(ルール: スローイン・ゴールキック・コーナー・フリーキック・ペナルティ)
    const s = p.side; const sg = sgn(s); const r = S.restart; const g = goalOf(s);
    if (r.type === 'penalty') { shootAt(p, (rnd() < 0.5 ? -1 : 1) * (2 + rnd() * 1.4), 0.86); return; }
    if (r.type === 'free' && !r.indirect && Math.abs(p.x - g.x) < 30 && Math.abs(p.z) < 24 && rnd() < 0.5) { shootAt(p, (rnd() - 0.5) * 6, 0.85); return; }
    if (r.type === 'corner') { const q = pickTarget(p, sg, 0, true); if (q) { passTo(p, q, 1, true); return; } }
    if (r.type === 'goalkick') { const q = pickTarget(p, sg, (rnd() - 0.5) * 0.8, true); if (q) { passTo(p, q, 1, true); return; } }
    const q = pickTarget(p, sg, 0, r.type !== 'kickoff') || players[s][nearestIdx(s, p.x, p.z, p.idx)];
    if (q) passTo(p, q, 1, len(q.x - p.x, q.z - p.z) > 32);
  }
  function aiThink(p, dt) {
    if (S.restartFresh && S.restart && ball.owner === S.restart.taker && p.side !== S.restart.side && p.slot !== 'GK') { // ルール: けるまえは まもりは はなれて まつ(9.15m。スローインは 2m。ゴールキック・ペナルティは エリアの そと)
      const r = S.restart; const away = r.type === 'throw' ? 2.9 : 9.6; const dNow = len(p.x - ball.x, p.z - ball.z); p.wantSprint = false;
      if (dNow < away + 2) { // ちかくに いる 人は そのばで まつ(ちかすぎたら そとへ おしだす)
        if (dNow < away) { const a2 = Math.atan2(p.z - ball.z, p.x - ball.x) || 0.1; p.tx = ball.x + Math.cos(a2) * (away + 0.4); p.tz = ball.z + Math.sin(a2) * (away + 0.4); } else { p.tx = p.x; p.tz = p.z; }
      } else {
        let tx = p.hx; let tz = p.hz; const dd = len(tx - ball.x, tz - ball.z);
        if (dd < away + 1) { const a2 = Math.atan2(tz - ball.z, tx - ball.x) || 0.1; tx = ball.x + Math.cos(a2) * (away + 1.2); tz = ball.z + Math.sin(a2) * (away + 1.2); }
        if ((r.type === 'goalkick' || r.type === 'penalty') && Math.abs(tz) < FIELD.PAh + 0.5) { const es = r.type === 'goalkick' ? Math.sign(r.x) : sgn(r.side); if (tx * es > HX - FIELD.PAd - 0.5) tx = es * (HX - FIELD.PAd - 2.5); }
        p.tx = clamp(tx, -HX + 2, HX - 2); p.tz = clamp(tz, -HZ + 2, HZ - 2);
      }
      return;
    }
    if (S.ph !== 'play') { p.wantSprint = false; return; } // やすみの あいだは ならんだ ばしょで まつ(タックルも しない)
    p.aiT -= dt; if (p.aiT > 0 && !p.forceThink) return; p.aiT = (0.14 + rnd() * 0.1) * (p.side === 'b' ? DF.react : 1) / (p.side === 'b' ? aiLevel : 1); p.forceThink = false;
    const s = p.side; const sg = sgn(s); const own = ball.owner; const mine = own && own.side === s; const T = tact[s];
    p.wantSprint = false;
    if (p.slot === 'GK') return aiKeeper(p);
    const g = goalOf(s);
    if (own === p) { // ボールを もっている
      const dg = len(g.x - p.x, g.z - p.z);
      const pressure = players[other(s)].reduce((m, o) => (o.off ? m : Math.min(m, len(o.x - p.x, o.z - p.z))), 99);
      // うつ(ちかい・かくどが いい・プレッシャーが ある)
      const angleOK = Math.abs(p.z) < 22 || dg < 14;
      if (dg < 25 && angleOK && p.cd <= 0 && (pressure < 5 || dg < 18) && rnd() < 0.5 * (dg < 18 ? 1.3 : 0.7)) { shootAt(p, (rnd() - 0.5) * GW(), 0.6 + rnd() * 0.35); return; }
      // パス(プレッシャーが つよい とき・ちょくせつ ねらう ばあいは まえへ・そうでなければ たまに あしもとへ)
      if (p.cd <= 0 && (pressure < 3.4 || rnd() < 0.1 + (1 - T.direct) * 0.06)) {
        const q = pickTarget(p, sg * 1, 0, T.direct > 0.7); if (q && (q.x - p.x) * sg > -6) { passTo(p, q, 1, len(q.x - p.x, q.z - p.z) > 30); return; }
      }
      // ドリブル: ゴールへ、あいてを よけて
      const tx = g.x - sg * 6; let tz = clamp(p.z * 0.7, -18, 18);
      for (const o of players[other(s)]) { if (o.off) continue; const d = len(o.x - p.x, o.z - p.z); if (d < 7 && (o.x - p.x) * sg > 0) { tz += (p.z - o.z >= 0 ? 1 : -1) * (7 - d) * 1.2; } }
      p.tx = tx; p.tz = clamp(tz, -HZ + 3, HZ - 3); p.wantSprint = dg > 12 && pressure > 3; return;
    }
    if (mine) { // みかたが もっている: サポート(はばを つかう・ラインを おしあげる・カウンターは はしりこむ)
      const forward = p.slot === 'FW' ? 0.14 : p.slot === 'MF' ? 0.09 : 0.03;
      let tx = p.hx + sg * (clamp((ball.x * sg + HX) / FIELD.L, 0, 1) * 0.38 * FIELD.L - 8 + forward * FIELD.L * 0.3) + sg * T.line * FIELD.L * 0.5;
      if (p.slot === 'FW') { const lineX = lastDefX(other(s)); tx = sg * Math.min(sg * tx, sg * lineX - 0.8); }
      let hz = p.hz; if (Math.abs(hz) > 12) hz = Math.sign(hz) * Math.min(HZ - 4, Math.abs(hz) * T.width + 1.5);
      let sprint = false;
      if (T.counter && S.clock - S.gainedAt[s] < 7 && (p.slot === 'FW' || (p.slot === 'MF' && Math.abs(p.hz) > 10))) { tx = sg * clamp(sg * ball.x + 30, -HX + 6, HX - 9); if (p.slot === 'FW') { const lineX = lastDefX(other(s)); tx = sg * Math.min(sg * tx, sg * lineX - 0.8); } sprint = true; }
      p.tx = clamp(tx, -HX + 4, HX - 4); p.tz = clamp(hz + (ball.z - hz) * 0.25 + Math.sin(p.idx * 2.1 + S.clock * 0.35) * 5, -HZ + 3, HZ - 3); p.wantSprint = sprint; return;
    }
    // あいてが もっている or ルーズ: プレス / かえる
    const target = own || ball; const d = len(target.x - p.x, target.z - p.z);
    const rank = players[s].filter((q) => q.slot !== 'GK' && !q.off).sort((u, v) => len(u.x - target.x, u.z - target.z) - len(v.x - target.x, v.z - target.z)).findIndex((q) => q === p);
    const counterPress = S.clock - S.lostAt[s] < 4 ? 1 : 0; // ボールを うしなった ちょくごは ちかくの みんなで うばいかえす
    const nChase = own ? Math.max(1, Math.min(3, Math.round(T.press * (s === 'b' && aiLevel > 1.05 ? 1.15 : 1)) + (T.press >= 1.6 ? counterPress : 0), s === 'b' ? Math.round(DF.press + 1) : 3)) : 1;
    const chase = rank < nChase;
    if (chase && (own || len(ball.vx, ball.vz) < 14)) {
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
    // まもりの かたち: ラインの たかさ(せんじゅつ)・ボールがわに よる(コンパクト)
    const back = own ? 1 : 0.4; const comp = 0.3 + 0.08 * T.press;
    p.tx = clamp(p.hx + sg * T.line * FIELD.L - sg * 4 * back + (ball.x - p.hx) * 0.22, -HX + 3, HX - 3); p.tz = clamp(p.hz + (ball.z - p.hz) * comp, -HZ + 3, HZ - 3);
  }
  const GW = () => FIELD.GW;
  function aiKeeper(p) {
    const s = p.side; const sg = sgn(s); const goalX = -sg * HX;
    if (ball.owner === p) { // ボールを もった(ゴールキックや キャッチの あと): ながい パス
      if (S.restartFresh && S.restart && S.restart.taker === p) return; // リスタートは aiRestart が する
      if (S.dead <= 0 && p.cd <= 0) { const q = pickTarget(p, sg, rnd() - 0.5, true) || players[s][nearestIdx(s, p.x, p.z, p.idx)]; passTo(p, q, 1, true); }
      return;
    }
    if (S.ph === 'dead' && S.restart && S.restart.type === 'penalty') { p.tx = goalX; p.tz = 0; p.penDive = undefined; return; } // ペナルティ: ゴールラインの まんなか
    const mine = ball.owner && ball.owner.side === s;
    let tx = goalX + sg * (mine ? 14 : 2.2 + clamp(len(ball.x - goalX, ball.z) * 0.06, 0, 5)); let tz = clamp(ball.z * 0.32, -GHW + 0.6, GHW - 0.6);
    if (ball.shotBy && ball.shotBy.side !== s && len(ball.vx, ball.vz) > 10 && Math.sign(ball.vx) === Math.sign(goalX - ball.x) && Math.abs(goalX - ball.x) < 40) {
      if (ball.pen) { // ペナルティ: キッカーの ほうこうは わからない。かん で とぶ
        if (p.penDive === undefined) p.penDive = rnd() < 0.2 ? 0 : (rnd() < 0.5 ? -1 : 1);
        tz = p.penDive * 2.9; tx = goalX + sg * 0.6; p.wantSprint = true; p.dive = true;
      } else {
        const t = (goalX - ball.x) / (ball.vx || 1e-6); if (t > 0 && t < 3) { tz = clamp(ball.z + ball.vz * t, -GHW - 1, GHW + 1); tx = goalX + sg * 1.2; p.wantSprint = true; p.dive = true; }
      }
    }
    if (!ball.owner && Math.abs(ball.x - goalX) < 12 && Math.abs(ball.z) < 16 && len(ball.vx, ball.vz) < 8) { tx = ball.x; tz = ball.z; p.wantSprint = true; }
    p.tx = tx; p.tz = tz;
  }

  // ---- 1フレーム ---------------------------------------------------------------
  function movePlayer(p, dt, humanDrive) {
    let wx = 0; let wz = 0; let sprint = false;
    if (p.stun > 0) { p.stun -= dt; p.vx *= 0.9; p.vz *= 0.9; }
    else if (p.act === 'slide' && p.actT > 0) { /* すべり */ p.vx *= 0.96; p.vz *= 0.96; }
    else if (humanDrive) {
      wx = humanDrive.input.mx; wz = humanDrive.input.mz; sprint = !!humanDrive.input.sprint; const m = len(wx, wz); if (m > 1) { wx /= m; wz /= m; }
      // アシスト: ボールが ルーズ か あいてが もっている とき、じどうで ボールに ちかづく(スティックを はなすと ぜんぶ おまかせ。うごかすと その ほうこうが ゆうせん)
      if (S.ph === 'play' && ball.owner !== p && !(ball.owner && ball.owner.side === humanDrive.side) && S.assist !== false) {
        const tgt = ball.owner ? { x: ball.owner.x + ball.owner.vx * 0.25, z: ball.owner.z + ball.owner.vz * 0.25 } : { x: ball.x + ball.vx * 0.35, z: ball.y > 2 ? ball.z : ball.z + ball.vz * 0.35 };
        const dx = tgt.x - p.x; const dz = tgt.z - p.z; const d = len(dx, dz);
        if (d < 34 && !(len(ball.vx, ball.vz) > 15 && !ball.owner && d > 10)) {
          const ax = dx / Math.max(d, 0.001); const az = dz / Math.max(d, 0.001);
          if (m < 0.2) { wx = ax; wz = az; sprint = d > 7; }
          else { wx = wx * 0.7 + ax * 0.3; wz = wz * 0.7 + az * 0.3; const mm = len(wx, wz); if (mm > 1) { wx /= mm; wz /= mm; } }
        }
      }
    }
    else {
      const dx = p.tx - p.x; const dz = p.tz - p.z; const d = len(dx, dz);
      if (d > 0.35) { const k = Math.min(1, d / 2.5); wx = (dx / d) * k; wz = (dz / d) * k; }
      sprint = p.wantSprint;
    }
    if (p.act === 'lunge' && p.actT > 0) { wx = Math.cos(p.dir); wz = Math.sin(p.dir); sprint = true; }
    // スタミナ
    const sp = len(wx, wz) > 0.5;
    if (sprint && sp && p.stamina > 0.05) p.stamina = Math.max(0, p.stamina - dt * 0.09 * (p.side === 'a' && !auto ? DF.stam : 1) / mul(p.stats.STA, 0.7, 1.5)); else p.stamina = Math.min(1, p.stamina + dt * 0.06 * mul(p.stats.STA, 0.7, 1.4));
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
    if (ball.y < 0.11) { ball.y = 0.11; if (ball.vy < -1.4) { ball.vy = -ball.vy * 0.45; if (ball.kind !== 'shot') { ball.vx *= 0.62; ball.vz *= 0.62; } } else ball.vy = 0; } // ちゃくちで スピードが おちる(ロングボールが ころがりすぎない)
    const fr = ball.y <= 0.12 ? 0.9 : 0.05; const sp = len(ball.vx, ball.vz); if (sp > 0) { const k = Math.max(0, 1 - (fr * dt * (sp > 0.3 ? 1 : 3))); ball.vx *= k; ball.vz *= k; if (sp < 0.15) { ball.vx = ball.vz = 0; } }
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
        const pS = clamp(0.64 + (mul(gk.stats.DEF, 0.8, 1.45) - mul(ball.shotBy.stats.SHO, 0.8, 1.45)) * 1.1 - (ball.shotSpeed - 18) / 50 - near * 0.1 - (ball.pen ? 0.12 : 0) - (ball.shotBy.side === 'a' ? DF.gk : 0), 0.12, 0.93);
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
      if (p.off || p.stun > 0 || p.cd > 0.3 && p === ball.lastP) continue;
      const rr = p.slot === 'GK' ? 1.15 : 0.82 + (p.act === 'slide' ? 0.7 : 0) + (p === ball.target ? 0.8 : 0) + (isCtl(p) ? DF.pickup : 0); // にんげんの せんしゅは ひろいやすい
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
    if (!auto && best.slot !== 'GK') claimCtl(best);
  }
  function checkBounds() {
    if (S.ph === 'goal' || S.ph === 'dead' || S.ph === 'kickoff') return;
    if (ball.owner) { // ドリブルで ラインを こえたら アウト(スローイン・ゴールキック・コーナー)
      if (Math.abs(ball.z) > HZ + 0.15 || Math.abs(ball.x) > HX + 0.15) { ball.lastSide = ball.owner.side; if (Math.abs(ball.x) > HX && Math.abs(ball.z) < GHW && ball.y < FIELD.GH) { ball.owner = null; goal(ball.x > 0 ? 'a' : 'b'); } else { ball.owner = null; outOfPlay(); } }
      return;
    }
    if (Math.abs(ball.x) > HX && Math.abs(ball.z) < GHW && ball.y < FIELD.GH) { goal(ball.x > 0 ? 'a' : 'b'); return; }
    if (Math.abs(ball.x) > HX + 0.4 || Math.abs(ball.z) > HZ + 0.4) outOfPlay();
  }

  function step(dtIn) {
    const dt = Math.min(dtIn, 1 / 20);
    if (S.done) return;
    S.phT += dt; if (S.bannerT > 0) S.bannerT -= dt; if (S.flash > 0) S.flash -= dt; if (S.ctrlLock > 0) S.ctrlLock -= dt; if (S.ctrlLock2 > 0) S.ctrlLock2 -= dt;
    const live = S.ph === 'play';
    if (live) { S.clock += dt; if (ball.owner) S.poss[ball.owner.side] += dt; }
    // じかん
    if (live && !S.extra && S.half === 1 && !S.add[1] && S.clock >= S.base1) { // ぜんはん ロスタイム
      const n = addedMinutes(); S.add[1] = n; S.e1 = S.base1 + addSec(n); S.e2 = S.e1 + halfSec; banner(`アディショナルタイム +${n}ぷん`, 2.6); snd('whistle');
    }
    if (live && !S.extra && S.half === 1 && S.clock >= S.e1) { S.half = 2; S.ph = 'half'; S.phT = 0; snd('whistle'); banner('ハーフタイム', 2.2); S.mark = { goals: S.events.length, fouls: S.fouls.a + S.fouls.b, cards: S.cards.length, pen: S.restartCount.penalty }; }
    if (live && !S.extra && S.half === 2 && !S.add[2] && S.clock >= S.e1 + halfSec) { // こうはん ロスタイム
      const n = addedMinutes(); S.add[2] = n; S.e2 = S.e1 + halfSec + addSec(n); banner(`アディショナルタイム +${n}ぷん`, 2.6); snd('whistle');
    }
    if (live && !S.extra && S.half === 2 && S.add[2] && S.clock >= S.e2) { endRegulation(); }
    if (live && S.extra && S.clock >= S.e2 + extraSec) { finish(null); }
    if (S.ph === 'half' && S.phT > 2.4) kickoff('b');
    if (S.ph === 'goal' && S.phT > 3.0) { if (S.golden) finish(S.winner); else if (S.half === 2 && S.add[2] && S.clock >= S.e2 && !S.extra) endRegulation(); else kickoff(other(S.celebrate.side)); }
    if (S.ph === 'kickoff' || S.ph === 'dead') { S.dead -= dt; if (S.dead <= 0) { S.ph = 'play'; S.phT = 0; ball.free = 0.15; } }
    if (S.ph === 'end') { return; }
    // ひとの そうさ
    if (S.ph === 'play' || S.ph === 'dead' || S.ph === 'kickoff') {
      for (const c of C) {
        if (auto) { c.shootCharge.on = false; c.shootCharge.release = false; const pr = c.pressed; pr.pass = pr.lob = pr.shoot = pr.tackle = pr.switch = false; }
        else if (S.ph === 'play' || (ball.owner && ball.owner.side === c.side && S.dead <= 0.0)) humanActions(c, dt); else if (S.ph !== 'play') { c.shootCharge.release = false; const pr = c.pressed; pr.pass = pr.lob = pr.shoot = pr.tackle = false; }
        // ひとが うごかす せんしゅ(ボールを もって いない ときは じどうで ボールに ちかい 人に きりかえ)
        if (!auto && ownerSide() !== c.side && S[c.lock] <= 0 && S.ph === 'play') { const mate = mateOf(c); const n = nearestIdx(c.side, ball.x, ball.z, mate ? S[mate.key] : -1); if (n >= 0 && n !== S[c.key]) { const cur = ctrlOf(c); if (!cur || len(cur.x - ball.x, cur.z - ball.z) > len(players[c.side][n].x - ball.x, players[c.side][n].z - ball.z) + 2.5) { S[c.key] = n; S[c.lock] = 0.5; } } }
      }
    }
    // ルール: スローイン・ゴールキックなどは じかんを かけすぎない(にんげんが まごまご したら じどうで けつ)
    if (!auto && S.ph === 'play' && S.restartFresh && S.restart && S.restart.taker && isHumanSide(S.restart.taker.side) && ball.owner === S.restart.taker && S.phT > 7 && S.restart.taker.cd <= 0) aiRestart(S.restart.taker);
    // AI
    for (const s of ['a', 'b']) for (const p of players[s]) {
      if (p.off) continue;
      const hd = ctlOf(p);
      if (!hd) {
        if (S.ph === 'play' || S.ph === 'kickoff' || S.ph === 'dead') {
          if (S.restartFresh && S.restart && S.restart.taker === p && ball.owner === p) { // リスタートの キッカー
            p.tx = p.x; p.tz = p.z; p.wantSprint = false;
            if (S.ph === 'play' && S.phT > 0.5 && p.cd <= 0) aiRestart(p);
          } else
          if ((S.ph === 'dead' || S.ph === 'kickoff') && ball.owner === p && S.restart && S.restart.taker === p) { // AIの リスタート
            p.tx = p.x; p.tz = p.z; p.wantSprint = false;
            if (S.dead <= 0 && !isHumanSide(s)) { const q = S.restart.type === 'free' && Math.abs(p.x - goalOf(s).x) < 28 && rnd() < 0.45 ? null : pickTarget(p, sgn(s), 0, true) || players[s][nearestIdx(s, p.x, p.z, p.idx)]; if (q) passTo(p, q, 1, S.restart.type === 'goalkick' || S.restart.type === 'corner'); else shootAt(p, (rnd() - 0.5) * 5, 0.8); }
            else if (S.dead <= 0 && s === 'a' && S.restart.auto) { /* じどう */ }
          } else aiThink(p, dt);
        } else if (S.ph === 'goal' && S.celebrate && S.celebrate.side === s) { p.tx = S.celebrate.p ? S.celebrate.p.x : p.x; p.tz = S.celebrate.p ? S.celebrate.p.z : p.z; p.wantSprint = false; }
        else if (S.ph === 'half' || S.ph === 'end') { p.tx = p.x; p.tz = p.z; }
      }
      movePlayer(p, dt, hd && (S.ph === 'play' || S.ph === 'dead' || S.ph === 'kickoff') ? hd : null);
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
    S.clock = S.e2;
  }
  function finish(winnerSide) {
    snd('whistle'); S.done = true; S.ph = 'end'; S.winner = winnerSide; banner('しゅうりょう!', 3);
  }
  // ---- がいぶからの そうさ -------------------------------------------------------------
  function press(k, ci = 0) {
    const c = C[ci]; if (!c) return; const holds = ownerSide() === c.side && ball.owner === ctrlOf(c);
    if (k === 'pass') { if (holds) { c.passCharge.on = true; c.passCharge.t = 0; c.passCharge.release = false; } return; }
    if (k === 'shoot') { if (holds) { c.shootCharge.on = true; c.shootCharge.t = 0; } else c.pressed.shoot = true; return; }
    c.pressed[k] = true;
  }
  function release(k, ci = 0) {
    const c = C[ci]; if (!c) return; const holds = ownerSide() === c.side && ball.owner === ctrlOf(c);
    if (k === 'pass') { if (c.passCharge.on) { c.passCharge.on = false; if (holds) c.passCharge.release = true; } return; }
    if (k === 'shoot') { if (c.shootCharge.on) { c.shootCharge.on = false; if (holds) c.shootCharge.release = true; } }
  }
  kickoff('a');
  S.ph = 'kickoff'; S.dead = 1.6;
  if (mode === 'versus') S.ctrl2 = nearestIdx('b', 0, 0); else if (mode === 'coop') S.ctrl2 = nearestIdx('a', 0, 0, S.ctrl);
  return {
    state: S, players, ball, input, homes, press, release, step, charge: shootCharge, teams, aiLevel, ctrlP, minuteNow, clockText, FIELD,
    endNow() { if (!S.done) finish(null); },
    flickPass(dx, dz, pw, ci = 0) { const c = C[ci]; if (!c) return; c.passCharge.on = false; c.passCharge.release = false; c.flick = { dx, dz, pw: clamp(pw, 0.05, 1) }; }, passCharge, ctls: C, ctrlOf, mode, // いまの スコアで しあいを おわらせる
    setAuto, setTactic(t) { if (TACTICS[t]) tact.a = TACTICS[t]; }, _foul: foul, _dead: deadBall, _out: outOfPlay, _tact: tact,
    skip() { /* しあいを すぐ おわらせる(テスト・とばす用) */ let n = 0; while (!S.done && n++ < 200000) step(1 / 30); },
  };
}
