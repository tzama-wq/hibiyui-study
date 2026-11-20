import assert from 'node:assert/strict';
import { createCity, LAYOUT, isWater, isRoad, insideBuilding, HQ, SHOP, SPAWN, CITY_MISSIONS, LINES, carStats, footStats, AIRFIELD } from '../citysim.js';
import { buildVehicle, partOf, autoLoadout } from '../airsim.js';

const st = (v) => ({ SHO: v, PAS: v, SPD: v, DEF: v, STA: v });
const ch = (id, rarity, pos) => ({ id, name: id, face: '', rarity, pos, stats: st(90) });
const chars = [ch('f', 'legend', 'FW'), ch('m', 'legend', 'MF'), ch('d', 'legend', 'DF'), ch('g', 'super', 'GK'), ch('f2', 'rare', 'FW')];
const veh = (kind, ks) => { const lo = autoLoadout(kind, chars); const parts = {}; for (const [s, id] of Object.entries(lo)) parts[s] = partOf(kind, s, chars.find((c) => c.id === id)); return buildVehicle({ vehicle: kind, name: 'P', kidStats: ks, parts }); };
const mk = (ks = st(70), seed = 3) => { let a = seed; const rnd = () => { a = (a * 1664525 + 1013904223) % 4294967296; return a / 4294967296; }; return createCity({ stats: ks, vehicles: { car: { ...carStats(ks) }, tank: veh('tank', ks), ship: veh('ship', ks), plane: veh('plane', ks) }, rnd }); };
const run = (sim, sec, f) => { for (let t = 0; t < sec; t += 1 / 30) { if (f) f(t); sim.step(1 / 30); } };

// ---- まちの かたち ----
{
  assert.ok(LAYOUT.buildings.length > 60, 'たてものが たくさん ある');
  for (const p of [SPAWN, HQ, SHOP, ...CITY_MISSIONS.map((m) => m.start)]) { assert.ok(!isWater(p.x, p.z) && !insideBuilding(p.x, p.z, 0), `りくの うえ・たてものの そと (${p.x},${p.z})`); }
  for (const m of CITY_MISSIONS) for (const p of [...(m.points || []), ...(m.civs || []), ...(m.pickup ? [m.pickup] : [])]) { if (m.water) assert.ok(isWater(p.x, p.z), `${m.id}: うみの うえ`); else assert.ok(!isWater(p.x, p.z) && !insideBuilding(p.x, p.z, 0), `${m.id}: たてものの そと (${p.x},${p.z})`); }
  for (const l of LINES) for (let v = -620; v <= 620; v += 20) for (const [x, z] of [[l, v], [v, l]]) if (isRoad(x, z)) assert.ok(!insideBuilding(x, z, 0), `みちに たてものが ない (${x},${z})`);
  assert.ok(isWater(0, -600) && !isWater(0, -400) && isWater(900, 0), 'みなとの うみ・まちの そと');
  assert.ok(!insideBuilding(350, 0, 0) && AIRFIELD.x0 < 350, 'くうこう');
}
// ---- あるく・のりおり ----
{
  const sim = mk(); const S = sim.state; const P = S.player;
  sim.input.climb = 1; run(sim, 2); assert.ok(Math.hypot(P.x - SPAWN.x, P.z - SPAWN.z) > 6, 'あるける'); sim.input.climb = 0;
  // みなとの うみには はいれない
  P.x = 0; P.z = -470; P.yaw = Math.PI; sim.input.climb = 1; run(sim, 6); assert.ok(!isWater(P.x, P.z), 'あるいて うみに はいれない'); sim.input.climb = 0;
  // くるまに のる
  { const c1 = S.vehicles.find((v) => v.id === 'car1'); c1.x = 0; c1.z = 100; } P.x = 4; P.z = 100; P.yaw = 0; run(sim, 0.1); assert.equal(S.nearby && S.nearby.kind, 'veh'); assert.ok(sim.interact()); assert.equal(P.mode, 'veh');
  sim.input.climb = 1; run(sim, 3); assert.ok(sim.vehicleOf().speed > 10, 'くるまが はしる'); sim.input.climb = 0; run(sim, 3);
  assert.ok(sim.interact() && P.mode === 'foot', 'おりる');
  // たてものに ぶつかっても めりこまない
  P.x = 100; P.z = 90; sim.input.climb = 1; P.yaw = Math.PI / 2; run(sim, 3); assert.ok(!insideBuilding(P.x, P.z, 0), 'ほんぶに めりこまない'); sim.input.climb = 0;
  // コイン・ほじゅう
  assert.ok(S.pickups.length > 20 && S.walkers.length > 5 && S.traffic.length >= 4);
}
// ---- ショップ ----
{
  const sim = mk(); const P = sim.state.player; P.coins = 50; assert.equal(sim.buy('heal').ok, false, 'げんきな ときは かわない'); P.hp = 10; assert.ok(sim.buy('heal').ok && P.hp === P.hpMax && P.coins === 40);
  assert.equal(sim.buy('silver').ok, false); assert.ok(sim.buy('bronze').ok && P.coins === 0); const ev = sim.takeEvents(); assert.ok(ev.some((e) => e.t === 'buy' && e.id === 'bronze'));
}
// ---- ミッション(ボット) ----
const drive = (sim, tx, tz, { fly = false, speed = 1 } = {}) => { const P = sim.state.player; let d = Math.atan2(tx - P.x, tz - P.z) - P.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; sim.input.turn = Math.max(-1, Math.min(1, d * 2.2)); sim.input.climb = fly ? 0 : (Math.abs(d) < 1.2 ? speed : 0.2); };
{ // パトロール(くるま)
  const sim = mk(); const S = sim.state; const P = S.player; P.x = 160; P.z = 150; run(sim, 0.1); assert.equal(S.nearby.kind, 'mission'); assert.ok(sim.interact()); assert.equal(S.mission.id, 'patrol');
  // くるまに のって まわる(ワープで くるまを ちかくへ)
  const car = S.vehicles.find((v) => v.id === 'car1'); car.x = 160; car.z = 160; P.x = 160; P.z = 160; run(sim, 0.1); P.x = car.x + 3; P.z = car.z; run(sim, 0.1); sim.interact(); assert.equal(P.mode, 'veh');
  let ok = false; run(sim, 120, () => { const t = S.mission && S.mission.targets[S.mission.stage]; if (!t) return; drive(sim, t.x, t.z); }); ok = !S.mission && S.done.patrol === 1; assert.ok(ok, 'パトロールを クリアできる');
  const evs = sim.takeEvents(); assert.ok(evs.some((e) => e.t === 'reward' && e.id === 'patrol' && e.reward.bronze === 1 && e.coins === 30)); assert.equal(P.coins, 30);
}
{ // しみんを たすけろ
  const sim = mk(); const S = sim.state; const P = S.player; P.x = -160; P.z = 150; run(sim, 0.1); sim.interact(); assert.equal(S.mission.id, 'rescue'); assert.equal(S.civs.length, 3);
  for (const c of S.civs.slice()) { P.x = c.x - 3; P.z = c.z - 3; P.hp = P.hpMax; run(sim, 0.1); assert.equal(S.nearby.kind, 'civ'); sim.interact(); }
  P.x = HQ.x; P.z = HQ.z; P.hp = P.hpMax; run(sim, 8); assert.ok(!S.mission && S.done.rescue === 1, 'しみんを ほんぶへ とどけて クリア');
}
{ // ロボットを たおせ(ひとが うつ)
  const sim = mk(st(100)); const S = sim.state; const P = S.player; P.x = -160; P.z = -150; run(sim, 0.1); sim.interact(); assert.equal(S.mission.id, 'invasion'); assert.equal(S.robots.length, 6);
  // タンクで たたかう(ボット)
  const tank = S.vehicles.find((v) => v.id === 'tank'); tank.x = -320; tank.z = -230; P.x = -316; P.z = -230; run(sim, 0.1); sim.interact(); assert.equal(sim.vehicleOf().kind, 'tank');
  run(sim, 200, () => { P.hp = P.hpMax; const r = S.robots.slice().sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z))[0]; if (!r) return; const d = Math.hypot(r.x - P.x, r.z - P.z); if (d > 60) drive(sim, r.x, r.z); else { sim.input.turn = 0; sim.input.climb = 0; } sim.aimAt(r); sim.input.gun = d < 150; if (d < 250) sim.fireMissile(); });
  assert.ok(!S.mission && S.done.invasion === 1, `ロボットを ぜんぶ たおして クリア (のこり ${S.robots.length})`);
}
{ // こうわん(ふね)
  const sim = mk(); const S = sim.state; const P = S.player; P.x = 0; P.z = -480; run(sim, 0.1); sim.interact(); assert.equal(S.mission.id, 'harbor');
  const ship = S.vehicles.find((v) => v.id === 'ship'); P.x = ship.x; P.z = ship.z + 5; run(sim, 0.1); assert.ok(sim.interact()); assert.equal(sim.vehicleOf().kind, 'ship');
  run(sim, 400, () => { const t = S.mission && S.mission.targets[S.mission.stage]; if (!t) return; drive(sim, t.x, t.z); }); assert.ok(S.done.harbor === 1, 'ふねで ブイを まわって クリア');
}
{ // そらの リング(ひこうき)
  const sim = mk(st(100)); const S = sim.state; const P = S.player; P.x = 345; P.z = 40; run(sim, 0.1); sim.interact(); assert.equal(S.mission.id, 'sky');
  const pl = S.vehicles.find((v) => v.id === 'plane'); P.x = pl.x; P.z = pl.z; run(sim, 0.1); assert.ok(sim.interact()); assert.equal(sim.vehicleOf().kind, 'plane'); assert.ok(P.y > 30, 'そらに うかぶ');
  run(sim, 400, () => { P.hp = P.hpMax; const v = sim.vehicleOf(); if (!v) return; const t = S.mission && S.mission.targets[S.mission.stage]; if (!t) return; let d = Math.atan2(t.x - v.x, t.z - v.z) - v.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; sim.input.turn = Math.max(-1, Math.min(1, d * 2.5)); const hd = Math.hypot(t.x - v.x, t.z - v.z); const want = Math.atan2(t.y - v.y, hd) - v.pitch; sim.input.climb = Math.max(-1, Math.min(1, want * 3)); });
  assert.ok(S.done.sky === 1, `リングを ぜんぶ くぐって クリア (${S.mission ? S.mission.got : '-'}/6)`);
  // おりる(パラシュート)
  const v = sim.vehicleOf(); if (v) { sim.interact(); assert.ok(P.chute || P.mode === 'foot'); run(sim, 25); assert.ok(P.y < 1 && !isWater(P.x, P.z) && !insideBuilding(P.x, P.z, 0), 'パラシュートで ぶじに ちゃくち'); }
}
{ // はいたつ(じかんせいげん)
  const sim = mk(); const S = sim.state; const P = S.player; P.x = -320; P.z = 0; run(sim, 0.1); sim.interact(); assert.equal(S.mission.id, 'delivery');
  P.x = S.mission.pk.x; P.z = S.mission.pk.z; run(sim, 0.1); assert.equal(S.nearby.kind, 'pack'); sim.interact(); assert.equal(S.mission.stage, 1); P.x = HQ.x; P.z = HQ.z; run(sim, 0.5); assert.ok(S.done.delivery === 1, 'にもつを とどけた');
  const s2 = mk(); const S2 = s2.state; S2.player.x = -320; S2.player.z = 0; run(s2, 0.1); s2.interact(); S2.player.x = S2.mission.pk.x; S2.player.z = S2.mission.pk.z; run(s2, 0.1); s2.interact(); run(s2, 105); assert.ok(!S2.mission && !S2.done.delivery, 'じかんぎれは しっぱい');
}
// ---- ノックアウト・ふっかつ・ミッションを やめる ----
{
  const sim = mk(); const S = sim.state; const P = S.player; P.coins = 100; P.hp = 1; sim.state.robots.push({ id: 9999, type: 'bot', x: P.x + 8, z: P.z, yaw: 0, hp: 46, hpMax: 46, cd: 0, homeX: 0, homeZ: 0, wander: 20, state: 'idle', t: 0, speed: 4, ph: 0, alert: true });
  run(sim, 15); assert.ok(S.player.hp > 0 && S.player.coins <= 100 && Math.hypot(P.x - SPAWN.x, P.z - SPAWN.z) < 200, 'ふっかつして ほんぶに もどる');
  P.x = 160; P.z = 150; run(sim, 0.1); sim.interact(); assert.ok(S.mission); sim.cancelMission(); assert.equal(S.mission, null);
}
console.log('OK: city');
