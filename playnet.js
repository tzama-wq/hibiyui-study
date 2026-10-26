// サッカーの ローカル つうしん(きょうりょく / たいせん)。ホストが ほんもの の シミュレーションを うごかし、ゲストは そうさを おくって けしきを うけとる。
//   ホスト: const hb = hostBindPlay(sim, conn);  まいフレーム hb.tick(dt)
//   ゲスト: const gp = createGuestPlay({ conn, me, opp, mode, halfSec, mySide, ci });  gp は createPlay と おなじ つかいかた(play3d が そのまま つかえる)
import { createPlay } from './playsim.js';

const r2 = (v) => Math.round(v * 100) / 100; const r3 = (v) => Math.round(v * 1000) / 1000;
const DYN = 12; // 1にんの スナップショットの ながさ

export function playSnapshot(sim) {
  const S = sim.state; const b = sim.ball;
  const pl = []; for (const s of ['a', 'b']) for (const p of sim.players[s]) pl.push([r2(p.x), r2(p.z), r2(p.vx), r2(p.vz), r3(p.dir), r3(p.run), p.act || '', r3(p.actT || 0), r3(p.stun || 0), p.off ? 1 : 0, p.dive ? 1 : 0, r3(p.stamina)]);
  return {
    t: 'p', ph: S.ph, ck: r2(S.clock), half: S.half, sc: [S.score.a, S.score.b], ex: S.extra ? 1 : 0, e2: r2(S.e2), bn: S.banner, bt: r3(S.bannerT), ms: S.msg, fl: r3(S.flash), ct: sim.clockText(), c: [S.ctrl, S.ctrl2], dn: S.done ? 1 : 0, wn: S.winner || '',
    ball: [r2(b.x), r2(b.y), r2(b.z), r2(b.vx), r2(b.vz), b.owner ? b.owner.side : '', b.owner ? b.owner.idx : -1], pl,
    cards: S.cards.map((c) => [c.side, c.idx, c.color]), cel: S.celebrate ? [S.celebrate.side, S.celebrate.p ? S.celebrate.p.idx : -1, S.celebrate.p ? S.celebrate.p.side : ''] : null,
    po: [r2(S.poss.a), r2(S.poss.b)], sh: [S.shots.a, S.shots.b], fo: [S.fouls.a, S.fouls.b], of: [S.offsides.a, S.offsides.b], ev: S.done ? S.events : undefined, snd: [],
  };
}

export function hostBindPlay(sim, conn) {
  let acc = 0; let alive = true; const sndBuf = []; const C = sim.ctls[1];
  conn.on((m) => {
    if (!alive || !m || !C) return;
    if (m.t === 'in' && m.i) { C.input.mx = +m.i[0] || 0; C.input.mz = +m.i[1] || 0; C.input.sprint = !!m.i[2]; }
    else if (m.t === 'ev') { if (m.e === 'press') sim.press(m.k, 1); else if (m.e === 'release') sim.release(m.k, 1); else if (m.e === 'flick') sim.flickPass(m.dx, m.dz, m.pw, 1); }
  });
  conn.onClose(() => { alive = false; if (C) { C.input.mx = C.input.mz = 0; C.input.sprint = false; } });
  return {
    tick(dt) { acc += dt; if (acc < 0.05) return; acc = 0; if (conn.isOpen()) { const sn = playSnapshot(sim); sn.snd = sndBuf.splice(0, 20); conn.fast(sn); } },
    finish() { if (conn.isOpen()) { const sn = playSnapshot(sim); sn.snd = []; conn.send(sn); } },
    snd: sndBuf, gone: () => !alive || !conn.isOpen(),
  };
}

// ---- ゲスト ---------------------------------------------------------------------
export function createGuestPlay({ conn, me, opp, mode, halfSec, mySide = 'b', ci = 1, diff = 'hard' }) {
  const sim = createPlay({ me, opp, halfSec, rnd: () => 0.5, mode, diff, auto: true }); // かたちだけ かりる(うごかさない)
  const startedAt = Date.now(); const S = sim.state; const ball = sim.ball; const players = sim.players; const flat = [...players.a, ...players.b];
  S.auto = false; S.remote = true; S.ctrl = 0; S.ctrl2 = 0; S.cards = []; S.events = [];
  const tg = flat.map(() => ({ x: 0, z: 0 })); const bt = { x: 0, y: 0.11, z: 0 }; let inited = false;
  let lastRx = 0;
  const apply = (m) => {
    lastRx = Date.now();
    S.ph = m.ph; S.clock = m.ck; S.half = m.half; S.score.a = m.sc[0]; S.score.b = m.sc[1]; S.extra = !!m.ex; S.e2 = m.e2; S.banner = m.bn; S.bannerT = m.bt; S.msg = m.ms; S.flash = m.fl; S.ctrl = m.c[0]; S.ctrl2 = m.c[1]; S.done = !!m.dn; S.winner = m.wn || null; S.ctText = m.ct;
    S.poss.a = m.po[0]; S.poss.b = m.po[1]; S.shots.a = m.sh[0]; S.shots.b = m.sh[1]; S.fouls.a = m.fo[0]; S.fouls.b = m.fo[1]; S.offsides.a = m.of[0]; S.offsides.b = m.of[1];
    m.pl.forEach((q, i) => { const p = flat[i]; if (!p) return; tg[i].x = q[0]; tg[i].z = q[1]; p.vx = q[2]; p.vz = q[3]; p.dir = q[4]; p.run = q[5]; p.act = q[6]; p.actT = q[7]; p.stun = q[8]; p.off = !!q[9]; p.dive = !!q[10]; p.stamina = q[11]; if (!inited) { p.x = q[0]; p.z = q[1]; } });
    bt.x = m.ball[0]; bt.y = m.ball[1]; bt.z = m.ball[2]; ball.vx = m.ball[3]; ball.vz = m.ball[4]; ball.owner = m.ball[5] ? players[m.ball[5]][m.ball[6]] : null; if (!inited) { ball.x = bt.x; ball.y = bt.y; ball.z = bt.z; } inited = true;
    S.cards = m.cards.map((c) => ({ side: c[0], idx: c[1], color: c[2] })); S.celebrate = m.cel ? { side: m.cel[0], p: m.cel[1] >= 0 ? players[m.cel[2]][m.cel[1]] : null } : null;
    if (m.ev) S.events = m.ev; for (const s of m.snd) if (S.snd.length < 20) S.snd.push(s);
  };
  conn.on((m) => { if (m && m.t === 'p') apply(m); });
  // そうさ: input を 30かい/びょうで おくる
  let lastSent = ''; let sendT = 0; let acc = 0;
  const sendInput = (force) => { const a = [r2(sim.input.mx), r2(sim.input.mz), sim.input.sprint ? 1 : 0]; const k = a.join(','); if (!force && k === lastSent && sendT < 0.5) return; lastSent = k; sendT = 0; conn.fast({ t: 'in', i: a }); };
  sim.press = (k) => { conn.send({ t: 'ev', e: 'press', k }); if (k === 'pass') { sim.passCharge.on = true; sim.passCharge.t = 0; } if (k === 'shoot') { sim.charge.on = true; sim.charge.t = 0; } };
  sim.release = (k) => { conn.send({ t: 'ev', e: 'release', k }); if (k === 'pass') sim.passCharge.on = false; if (k === 'shoot') sim.charge.on = false; };
  sim.flickPass = (dx, dz, pw) => { sim.passCharge.on = false; conn.send({ t: 'ev', e: 'flick', dx, dz, pw }); };
  sim.ctrlP = () => players[mySide][ci === 0 ? S.ctrl : S.ctrl2];
  sim.setAuto = () => {}; sim.setTactic = () => {}; sim.endNow = () => {}; sim.clockText = () => S.ctText || "0'";
  sim.step = (dt) => {
    acc += dt; sendT += dt; if (acc >= 0.033) { acc = 0; sendInput(false); }
    if (sim.charge.on) sim.charge.t = Math.min(1.2, sim.charge.t + dt); if (sim.passCharge.on) sim.passCharge.t = Math.min(1.1, sim.passCharge.t + dt);
    const k = 1 - Math.exp(-20 * dt); flat.forEach((p, i) => { const q = tg[i]; if (Math.hypot(q.x - p.x, q.z - p.z) > 12) { p.x = q.x; p.z = q.z; } else { p.x += (q.x - p.x) * k; p.z += (q.z - p.z) * k; } });
    if (Math.hypot(bt.x - ball.x, bt.z - ball.z) > 14) { ball.x = bt.x; ball.z = bt.z; } else { ball.x += (bt.x - ball.x) * k; ball.z += (bt.z - ball.z) * k; } ball.y += (bt.y - ball.y) * k;
  };
  sim.remote = true; sim.silent = () => Date.now() - (lastRx || startedAt) > 1500; sim.lost = () => !conn.isOpen(); sim.conn = conn;
  return sim;
}
void DYN;
