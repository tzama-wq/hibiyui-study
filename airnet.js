// 「そらの まもり」の ローカル つうしん(きょうりょく / たいせん)。ホストが ほんもの の シミュレーションを うごかし、ゲストは そうさを おくって けしきを うけとる。
//   ホスト: const hb = hostBind(sim, conn);  まいフレーム hb.tick(dt)   (ゲストの そうさを players[1] に はんえい、20かい/びょうで スナップショットを おくる)
//   ゲスト: const gs = createGuestSim({ conn, mission, vehicle, pvp });  gs は createAir と おなじ つかいかた(state / input / step / fireMissile / evade / nextTarget)
import { ENEMY } from './airsim.js';

const r1 = (v) => Math.round(v * 10) / 10; const r3 = (v) => Math.round(v * 1000) / 1000;
const PLK = ['x', 'y', 'z'];

export function snapshot(sim) {
  const S = sim.state;
  const pl = S.players.map((P) => ({ x: r1(P.x), y: r1(P.y), z: r1(P.z), yw: r3(P.yaw), pt: r3(P.pitch), rl: r3(P.roll), rs: r3(P.rollSpin || 0), ty: r3(P.turretYaw), ap: r3(P.aimPitch), hp: Math.round(P.hp), hm: Math.round(P.hpMax), b: Math.round(P.boost), bo: P.boosting ? 1 : 0, mi: P.missiles, d: P.dead ? 1 : 0, iv: r3(P.invuln || 0), sh: r3(P.shield || 0), lt: P.lockTarget.map((e) => e.id), lc: P.lockCands.map((c) => [c.id, c.locked ? 1 : 0, r3(c.p)]), tg: P.target ? P.target.id : 0 }));
  return {
    t: 's', tm: r1(S.t), ph: S.ph, dn: S.done ? 1 : 0, wn: S.win ? 1 : 0, wr: S.winner, st: S.stars || 0, k: S.kills, bn: S.banner, bt: r3(S.bannerT), ms: S.msg, mt: r3(S.msgT), hu: r3(S.hurt || 0), bh: r3(S.baseHurt || 0),
    base: [Math.round(S.base.hp), S.base.hpMax], wv: S.waveI, boss: S.boss && S.enemies.includes(S.boss) ? S.boss.id : 0,
    pl, en: S.enemies.map((e) => [e.id, e.type, r1(e.x), r1(e.y), r1(e.z), r3(e.yaw), r3(e.pitch), Math.round(e.hp), Math.round(e.hpMax)]),
    bu: S.bullets.map((b) => [r1(b.x), r1(b.y), r1(b.z)]), mi: S.missiles.map((m) => [r1(m.x), r1(m.y), r1(m.z), r1(m.vx), r1(m.vy), r1(m.vz)]),
    fx: S.effects.map((e) => [e.kind, r1(e.x), r1(e.y), r1(e.z), e.r, r3(e.t), e.life]), tr: S.tracers.map((t) => [r1(t.from.x), r1(t.from.y), r1(t.from.z), r1(t.to.x), r1(t.to.y), r1(t.to.z), r3(t.t)]),
    snd: S.snd.slice(),
  };
}

// ---- ホスト ---------------------------------------------------------------------
export function hostBind(sim, conn) {
  let acc = 0; let alive = true;
  conn.on((m) => {
    if (!alive || !m) return; const G = sim.players[1]; if (!G) return;
    if (m.t === 'in' && m.i) { const i = G.input; i.turn = +m.i[0] || 0; i.climb = +m.i[1] || 0; i.gun = !!m.i[2]; i.boost = !!m.i[3]; i.aimX = +m.i[4] || 0; i.aimY = +m.i[5] || 0; }
    else if (m.t === 'ev') { if (m.e === 'missile') sim.fireMissile(1); else if (m.e === 'evade') sim.evade(1); else if (m.e === 'target') sim.nextTarget(1); }
  });
  conn.onClose(() => { alive = false; const G = sim.players[1]; if (G) { G.input.gun = false; G.input.boost = false; G.input.turn = 0; G.input.climb = 0; G.input.aimX = 0; G.input.aimY = 0; } });
  return {
    tick(dt) { acc += dt; if (acc < 0.05) return; acc = 0; if (conn.isOpen()) { conn.fast(snapshot(sim)); sim.state.snd.length = 0; if (sim.state.done) conn.send(snapshot(sim)); } },
    // おわったら さいごの スナップショットを かくじつに おくる
    finish() { if (conn.isOpen()) conn.send(snapshot(sim)); },
    gone: () => !alive || !conn.isOpen(),
  };
}

// ---- ゲスト ---------------------------------------------------------------------
// スナップショットを createAir の state に にた かたちに なおして もつ。じぶんは players[1]。
export function createGuestSim({ conn, mission, vehicle, pvp = false, me = 1, partnerVehicle }) {
  const mk = (V, i) => ({ i, V, kind: V.vehicle, air: V.vehicle === 'plane', x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, rollSpin: 0, turretYaw: 0, aimPitch: 0, hp: V.hpMax, hpMax: V.hpMax, boost: V.boostMax, boosting: false, missiles: V.missiles, dead: false, invuln: 0, shield: 0, lockTarget: [], lockCands: [], target: null, radius: 10, cy: 0 });
  const vs = me === 1 ? [partnerVehicle, vehicle] : [vehicle, partnerVehicle];
  const players = vs.map((V, i) => mk(V, i));
  const S = { ph: 'brief', t: 0, kills: 0, done: false, win: false, banner: '', bannerT: 0, msg: '', msgT: 0, pvp, np: 2, winner: -1, stars: 0, player: players[me], players, base: { x: 0, y: 0, z: 700, hp: mission.baseHp, hpMax: mission.baseHp }, enemies: [], bullets: [], missiles: [], effects: [], tracers: [], snd: [], waveI: 0, boss: null, target: null, lockCands: [], hurt: 0, baseHurt: 0, shield: 0, remote: true };
  const input = { turn: 0, climb: 0, gun: false, boost: false, aimX: 0, aimY: 0 }; players[me].input = input;
  const foeOf = (id) => (id >= 1000 ? players[id - 1000].foe : S.enemies.find((e) => e.id === id) || null);
  players.forEach((p) => { p.foe = { id: 1000 + p.i, type: 'pl', dom: p.kind === 'plane' ? 'air' : p.kind === 'ship' ? 'sea' : 'ground', x: 0, y: 0, z: 0, pl: p }; });
  let last = null; let seen = 0;
  const apply = (m) => {
    last = m; seen++;
    S.t = m.tm; S.ph = m.ph; S.done = !!m.dn; S.win = pvp ? m.wr === me : !!m.wn; S.winner = m.wr; S.stars = m.st; S.kills = m.k; S.banner = m.bn; S.bannerT = m.bt; S.msg = m.ms; S.msgT = m.mt; S.baseHurt = m.bh;
    S.base.hp = m.base[0]; S.base.hpMax = m.base[1]; S.waveI = m.wv;
    { const q = m.pl[me]; if (q && q.hp < players[me].hp) S.hurt = 0.35; }
    m.pl.forEach((q, i) => { const P = players[i]; if (!P) return; P.x = q.x; P.y = q.y; P.z = q.z; P.yaw = q.yw; P.pitch = q.pt; P.roll = q.rl; P.rollSpin = q.rs; P.turretYaw = q.ty; P.aimPitch = q.ap; P.hp = q.hp; P.hpMax = q.hm; P.boost = q.b; P.boosting = !!q.bo; P.missiles = q.mi; P.dead = !!q.d; P.invuln = q.iv; P.shield = q.sh; P.foe.x = q.x; P.foe.y = q.y + (P.air ? 0 : 4); P.foe.z = q.z; });
    S.enemies = m.en.map((e) => ({ id: e[0], type: e[1], dom: ENEMY[e[1]].dom, x: e[2], y: e[3], z: e[4], yaw: e[5], pitch: e[6], hp: e[7], hpMax: e[8] }));
    S.boss = m.boss ? S.enemies.find((e) => e.id === m.boss) || null : null;
    players.forEach((P, i) => { const q = m.pl[i]; if (!q) return; P.lockTarget = q.lt.map(foeOf).filter(Boolean); P.lockCands = q.lc.map((c) => ({ id: c[0], locked: !!c[1], p: c[2] })); P.target = q.tg ? foeOf(q.tg) : null; });
    S.target = players[me].target; S.lockCands = players[me].lockCands; S.shield = players[me].shield;
    S.bullets = m.bu.map((b) => ({ x: b[0], y: b[1], z: b[2] })); S.missiles = m.mi.map((b) => ({ x: b[0], y: b[1], z: b[2], vx: b[3], vy: b[4], vz: b[5] }));
    S.effects = m.fx.map((e) => ({ kind: e[0], x: e[1], y: e[2], z: e[3], r: e[4], t: e[5], life: e[6] })); S.tracers = m.tr.map((t) => ({ from: { x: t[0], y: t[1], z: t[2] }, to: { x: t[3], y: t[4], z: t[5] }, t: t[6] }));
    for (const s of m.snd) if (S.snd.length < 30) S.snd.push(s);
  };
  conn.on((m) => { if (m && m.t === 's') apply(m); });
  let sendT = 0; let lastSent = '';
  const sendInput = (force) => { const a = [r3(input.turn), r3(input.climb), input.gun ? 1 : 0, input.boost ? 1 : 0, r3(input.aimX), r3(input.aimY)]; const k = a.join(','); if (!force && k === lastSent && sendT < 0.5) return; lastSent = k; sendT = 0; conn.fast({ t: 'in', i: a }); };
  const ev = (e) => { conn.send({ t: 'ev', e }); return true; };
  return {
    state: S, input, inputs: [], players, vehicle, mission, remote: true,
    step(dt) { if (S.hurt > 0) S.hurt -= dt; sendT += dt; this._acc = (this._acc || 0) + dt; if (this._acc >= 0.033) { this._acc = 0; sendInput(false); } },
    fireMissile: () => ev('missile'), evade: () => ev('evade'), nextTarget: () => { ev('target'); }, aimAt() {},
    seen: () => seen, lost: () => !conn.isOpen(),
  };
}
void PLK;
