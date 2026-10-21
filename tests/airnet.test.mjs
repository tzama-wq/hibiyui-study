import assert from 'node:assert/strict';
import { createAir, buildVehicle, partOf, autoLoadout, missionById } from '../airsim.js';
import { hostBind, createGuestSim, snapshot } from '../airnet.js';
import { rngSeed } from '../game.js';

// なんちゃって つうしん(メモリの なかで 2つを つなぐ)
function pair() {
  const a = { ls: [], cl: [], open: true }; const b = { ls: [], cl: [], open: true };
  const mk = (me, other) => ({ send: (o) => { if (me.open) { const c = JSON.parse(JSON.stringify(o)); other.ls.forEach((f) => f(c)); } }, fast(o) { this.send(o); }, on: (f) => me.ls.push(f), onClose: (f) => me.cl.push(f), isOpen: () => me.open, close() { me.open = false; other.open = false; me.cl.concat(other.cl).forEach((f) => f()); } });
  return [mk(a, b), mk(b, a)];
}
const st = (v) => ({ SHO: v, PAS: v, SPD: v, DEF: v, STA: v });
const ch = (id, rarity, pos) => ({ id, name: id, face: '', rarity, pos, stats: st(90) });
const chars = [ch('f', 'legend', 'FW'), ch('m', 'legend', 'MF'), ch('d', 'legend', 'DF'), ch('g', 'super', 'GK'), ch('f2', 'rare', 'FW')];
const veh = (kind) => { const lo = autoLoadout(kind, chars); const parts = {}; for (const [s, id] of Object.entries(lo)) parts[s] = partOf(kind, s, chars.find((c) => c.id === id)); return buildVehicle({ vehicle: kind, name: 'P', kidStats: st(70), parts }); };

const [hc, gc] = pair(); const Vh = veh('plane'); const Vg = veh('tank'); const mis = missionById('m1');
const sim = createAir({ vehicle: Vh, extra: [Vg], mission: mis, rnd: rngSeed(2) }); const hb = hostBind(sim, hc);
const gs = createGuestSim({ conn: gc, mission: mis, vehicle: Vg, partnerVehicle: Vh, me: 1 });
// ゲストの そうさが ホストの players[1] に とどく
gs.input.climb = 1; gs.input.turn = -0.5; gs.input.gun = true; let t = 0;
for (let i = 0; i < 300; i++) { gs.step(1 / 60); hb.tick(1 / 60); sim.step(1 / 60); t += 1 / 60; }
const G = sim.players[1];
assert.ok(G.speed > 0 && Math.abs(G.yaw) > 0.05, 'ゲストの そうさで せんしゃが うごく');
assert.ok(gs.seen() > 20, 'スナップショットが とどく');
const gp = gs.state.player; assert.ok(Math.abs(gp.x - G.x) < 3 && Math.abs(gp.z - G.z) < 3 && gp.yaw === gs.state.players[1].yaw, 'ゲストの がめんの いちが ホストと おなじ');
assert.equal(gs.state.enemies.length, sim.state.enemies.length, 'てきの かずが おなじ');
assert.ok(gs.state.players[0].x !== 0 || gs.state.players[0].z !== 0, 'あいての きたいも みえる');
// イベント(ミサイル・かいひ)
const m0 = G.missiles; gs.evade(); gs.fireMissile(); sim.step(1 / 60); assert.ok(G.invuln > 0, 'かいひが ホストに とどく');
// さいごまで: ホストが おわったら ゲストも おわる
sim.state.done = false; let n = 0; while (!sim.state.done && n++ < 60 * 400) { for (const P of sim.players) { P.input.gun = true; P.hp = P.hpMax; } gs.step(1 / 60); hb.tick(1 / 60); sim.step(1 / 60); }
sim.state.done || sim.skip(); hb.finish(); assert.ok(gs.state.done, 'ゲストにも しゅうりょうが つたわる'); void m0; void snapshot;
// たいせん
{
  const [h2, g2] = pair(); const s2 = createAir({ vehicle: Vh, extra: [Vg], pvp: true, rnd: rngSeed(5) }); const b2 = hostBind(s2, h2);
  const gg = createGuestSim({ conn: g2, mission: mis, vehicle: Vg, partnerVehicle: Vh, pvp: true, me: 1 });
  s2.players[1].hp = 1; s2.players[1].invuln = 0; s2.state.missiles.push({ x: s2.players[1].x, y: s2.players[1].y, z: s2.players[1].z, vx: 0, vy: 0, vz: 0, t: 0, life: 8, dmg: 999, own: 0, kind: 'plane', target: null });
  for (let i = 0; i < 20; i++) { gg.step(1 / 60); b2.tick(1 / 60); s2.step(1 / 60); } b2.finish();
  assert.ok(s2.state.done && s2.state.winner === 0 && gg.state.done && !gg.state.win && gg.state.winner === 0, 'たいせん: かった/まけたが りょうほうに つたわる');
}
console.log('OK: airnet');
