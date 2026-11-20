import assert from 'node:assert/strict';
import { createCity, LAYOUT, isWater, isRoad, insideBuilding, HQ, SHOP, SPAWN, BOARD, GARAGE, CITY_MISSIONS, LINES, WANTED, VCAT, catalogOf, catalogV, DEFAULT_OWNED, isAir } from '../citysim.js';
import { buildVehicle, partOf, autoLoadout } from '../airsim.js';

const st = (v) => ({ SHO: v, PAS: v, SPD: v, DEF: v, STA: v });
const ch = (id, rarity, pos) => ({ id, name: id, face: '', rarity, pos, stats: st(90) });
const chars = [ch('f', 'legend', 'FW'), ch('m', 'legend', 'MF'), ch('d', 'legend', 'DF'), ch('g', 'super', 'GK'), ch('f2', 'rare', 'FW')];
const veh = (kind, ks) => { const lo = autoLoadout(kind, chars); const parts = {}; for (const [s, id] of Object.entries(lo)) parts[s] = partOf(kind, s, chars.find((c) => c.id === id)); return buildVehicle({ vehicle: kind, name: 'P', kidStats: ks, parts }); };
const mk = (ks = st(70), seed = 3, extra = {}) => { let a = seed; const rnd = () => { a = (a * 1664525 + 1013904223) % 4294967296; return a / 4294967296; }; return createCity({ stats: ks, vehicles: { tank: veh('tank', ks), ship: veh('ship', ks), plane: veh('plane', ks) }, rnd, ...extra }); };
const run = (sim, sec, f) => { for (let t = 0; t < sec; t += 1 / 30) { if (f) f(t); sim.step(1 / 30); } };
const tele = (sim, x, z) => { sim.state.player.x = x; sim.state.player.z = z; sim.step(1 / 30); };

// ---- まちの かたち ----
{
  assert.ok(LAYOUT.buildings.length > 60, 'たてものが たくさん ある');
  for (const p of [SPAWN, HQ, SHOP, BOARD, GARAGE, ...CITY_MISSIONS.map((m) => m.start), ...WANTED.map((w) => w.spot)]) assert.ok(!isWater(p.x, p.z) && !insideBuilding(p.x, p.z, 0), `りくの うえ・たてものの そと (${p.x},${p.z})`);
  for (const m of CITY_MISSIONS) for (const p of [...(m.points || []), ...(m.civs || []), ...(m.pickup ? [m.pickup] : [])]) { if (m.water) assert.ok(isWater(p.x, p.z), `${m.id}: うみの うえ`); else assert.ok(!isWater(p.x, p.z) && !insideBuilding(p.x, p.z, 0), `${m.id}: たてものの そと (${p.x},${p.z})`); }
  for (const l of LINES) for (let v = -620; v <= 620; v += 20) for (const [x, z] of [[l, v], [v, l]]) if (isRoad(x, z)) assert.ok(!insideBuilding(x, z, 0), `みちに たてものが ない (${x},${z})`);
  assert.ok(isWater(0, -600) && !isWater(0, -400) && isWater(900, 0), 'みなとの うみ・まちの そと');
  assert.equal(WANTED.length, 8); assert.ok(WANTED.every((w, i) => i === 0 || w.bounty >= WANTED[i - 1].bounty), 'つよい ほど けんしょう金が おおい');
  assert.ok(VCAT.length >= 16 && VCAT.some((v) => v.kind === 'bike') && VCAT.some((v) => v.kind === 'jet') && VCAT.some((v) => v.kind === 'plane') && VCAT.filter((v) => v.kind === 'car').length >= 6, 'のりものが いろいろ');
  const sim = mk(st(70), 3, { owned: VCAT.map((v) => v.id) });
  for (const v of sim.state.vehicles) { assert.ok(!isWater(v.x, v.z) || v.kind === 'ship', `ガレージの のりもの ${v.id}`); assert.ok(!insideBuilding(v.x, v.z, 0), `たてものの そと ${v.id} (${v.x},${v.z})`); }
  assert.equal(new Set(sim.state.vehicles.map((v) => `${v.home.x},${v.home.z}`)).size, sim.state.vehicles.length, 'わくが かさならない');
}
// ---- あるく・のりおり ----
{
  const sim = mk(); const S = sim.state; const P = S.player;
  sim.input.climb = 1; run(sim, 2); assert.ok(Math.hypot(P.x - SPAWN.x, P.z - SPAWN.z) > 6, 'あるける'); sim.input.climb = 0;
  P.x = 0; P.z = -470; P.yaw = Math.PI; sim.input.climb = 1; run(sim, 6); assert.ok(!isWater(P.x, P.z), 'あるいて うみに はいれない'); sim.input.climb = 0;
  const c1 = S.vehicles.find((v) => v.id === 'sedan'); c1.x = 0; c1.z = 100; P.x = 4; P.z = 100; P.yaw = 0; run(sim, 0.1); assert.equal(S.nearby && S.nearby.kind, 'veh'); assert.ok(sim.interact()); assert.equal(P.mode, 'veh');
  sim.input.climb = 1; run(sim, 3); assert.ok(sim.vehicleOf().speed > 10, 'くるまが はしる'); sim.input.climb = 0; run(sim, 3);
  assert.ok(sim.interact() && P.mode === 'foot', 'おりる');
  P.x = 100; P.z = 90; sim.input.climb = 1; P.yaw = Math.PI / 2; run(sim, 3); assert.ok(!insideBuilding(P.x, P.z, 0), 'ほんぶに めりこまない'); sim.input.climb = 0;
  assert.ok(S.pickups.length > 20 && S.walkers.length > 5 && S.traffic.length >= 4);
  const t = S.traffic[0]; tele(sim, t.x + 3, t.z); run(sim, 0.1); assert.equal(S.nearby && S.nearby.kind, 'tcar'); const nt = S.traffic.length; assert.ok(sim.interact() && P.mode === 'veh' && S.traffic.length === nt - 1, 'くるまを かりられる');
  sim.input.climb = 1; run(sim, 2); assert.ok(sim.vehicleOf().speed > 5); sim.input.climb = 0; sim.interact(); run(sim, 45); assert.ok(!S.vehicles.some((v) => v.temp), 'かりた くるまは きえる');
}
// ---- いろいろな のりもの ----
{
  const sim = mk(st(80), 3, { owned: VCAT.map((v) => v.id) }); const S = sim.state; const P = S.player;
  for (const id of ['sports', 'bike', 'truck', 'racer', 'pbike', 'suv']) {
    const v = S.vehicles.find((x) => x.id === id); assert.ok(v, id); P.mode = 'foot'; P.veh = null; v.occ = false; v.x = 0; v.z = 200; v.yaw = 0; v.speed = 0; P.x = 3; P.z = 200; run(sim, 0.1); assert.equal(S.nearby.id, id); sim.interact(); assert.equal(sim.vehicleOf().id, id);
    sim.input.climb = 1; run(sim, 3.5); const sp = sim.vehicleOf().speed; assert.ok(sp > catalogV(catalogOf(id), st(80)).speed * 0.7, `${id}: はしる (${sp.toFixed(0)})`); sim.input.climb = 0; sim.interact(); run(sim, 1);
  }
  for (const id of ['cessna', 'trainer', 'bizjet', 'hawk', 'phantom']) {
    P.mode = 'foot'; P.veh = null; const v = S.vehicles.find((x) => x.id === id); assert.ok(v && isAir(v.kind), id); v.occ = false; P.x = v.x + 4; P.z = v.z; run(sim, 0.1); sim.interact(); assert.equal(sim.vehicleOf().id, id); assert.ok(P.y > 30);
    run(sim, 3); assert.ok(Math.hypot(v.x - v.home.x, v.z - v.home.z) > 60, `${id}: とぶ`); sim.interact(); run(sim, 25);
  }
  assert.ok(catalogOf('phantom').price > catalogOf('hawk').price && catalogOf('hawk').missiles >= 6, 'せんとうきは たかい・ミサイル');
}
// ---- ガレージ・ショップ・ボード ----
{
  const sim = mk(); const S = sim.state; const P = S.player; P.coins = 50; assert.equal(sim.buy('heal').ok, false); P.hp = 10; assert.ok(sim.buy('heal').ok && P.hp === P.hpMax && P.coins === 40);
  assert.equal(sim.buy('silver').ok, false); assert.ok(sim.buy('bronze').ok && P.coins === 0); assert.ok(sim.takeEvents().some((e) => e.t === 'buy' && e.id === 'bronze'));
  P.coins = 250; assert.equal(sim.buyVehicle('hawk').ok, false, 'たりない'); assert.equal(sim.buyVehicle('sedan').ok, false, 'もってる'); assert.ok(sim.buyVehicle('taxi').ok && P.coins === 50 && S.vehicles.some((v) => v.id === 'taxi' && v.cat === 'taxi')); assert.ok(sim.takeEvents().some((e) => e.t === 'buyveh' && e.id === 'taxi'));
  tele(sim, GARAGE.x, GARAGE.z); assert.equal(S.nearby && S.nearby.kind, 'garage'); sim.interact(); assert.equal(S.ui, 'garage'); sim.closeUi();
  tele(sim, BOARD.x, BOARD.z); assert.equal(S.nearby && S.nearby.kind, 'board'); sim.interact(); assert.ok(S.wanted.length === 8 && S.wanted.every((w) => w.alive));
}
// ---- してい手配はんを たいほ ----
{
  const sim = mk(st(100)); const S = sim.state; const P = S.player; const joe = () => S.crooks.find((c) => c.wid === 'joe'); const j = joe(); assert.ok(j && S.crooks.length >= 20);
  tele(sim, j.x - 14, j.z); P.yaw = Math.PI / 2;
  run(sim, 30, () => { P.hp = P.hpMax; const c = joe(); if (!c || c.state === 'down') { sim.input.gun = false; sim.input.turn = 0; return; } let d = Math.atan2(c.x - P.x, c.z - P.z) - P.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; sim.input.turn = Math.max(-1, Math.min(1, d * 3)); sim.input.climb = 0; sim.input.gun = true; });
  sim.input.gun = false; sim.input.turn = 0; assert.equal(joe().state, 'down', 'うたれて ばんざい(たおれる)'); assert.ok(joe().hp >= 1, 'たおしても しなない');
  const hpBefore = joe().hp; sim.input.gun = true; run(sim, 2); sim.input.gun = false; assert.ok(joe().hp >= hpBefore, 'たおれた はんにんは うてない');
  tele(sim, joe().x - 2, joe().z); assert.equal(S.nearby.kind, 'arrest'); const c0 = P.coins; assert.ok(sim.interact()); assert.equal(P.coins - c0, 100, 'けんしょう金 100'); assert.ok(!joe()); assert.ok(sim.takeEvents().some((e) => e.t === 'bounty' && e.id === 'joe' && e.coins === 100 && e.first));
  run(sim, 125); const j2 = joe(); assert.ok(j2, '2ふん ごに また あらわれる');
  j2.state = 'down'; tele(sim, j2.x - 2, j2.z); const c1 = P.coins; sim.interact(); assert.equal(P.coins - c1, 50, '2かいめは はんがく'); const e2 = sim.takeEvents().find((e) => e.t === 'bounty'); assert.ok(e2 && !e2.first);
  const sim2 = mk(st(100)); const don = sim2.state.crooks.find((c) => c.wid === 'don'); don.state = 'down'; tele(sim2, don.x - 2, don.z); const c2 = sim2.state.player.coins; sim2.interact(); assert.equal(sim2.state.player.coins - c2, 1500); assert.equal(sim2.takeEvents().find((e) => e.t === 'bounty').tickets.gold, 1, 'ボスは ゴールドチケット');
  const sim3 = mk(st(100)); const g = sim3.state.crooks.find((c) => c.wid === 'gonzo'); g.state = 'down'; tele(sim3, 0, 0); run(sim3, 30); assert.notEqual(g.state, 'down', 'ほうっておくと にげる');
}
// ---- ミッション(ボット) ----
const drive = (sim, tx, tz, { speed = 1 } = {}) => { const P = sim.state.player; let d = Math.atan2(tx - P.x, tz - P.z) - P.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; sim.input.turn = Math.max(-1, Math.min(1, d * 2.2)); sim.input.climb = Math.abs(d) < 1.2 ? speed : 0.2; };
{
  const sim = mk(); const S = sim.state; const P = S.player; tele(sim, 160, 150); assert.equal(S.nearby.kind, 'mission'); assert.ok(sim.interact()); assert.equal(S.mission.id, 'patrol');
  const car = S.vehicles.find((v) => v.id === 'police'); car.x = 160; car.z = 160; tele(sim, 163, 160); sim.interact(); assert.equal(P.mode, 'veh');
  run(sim, 120, () => { const t = S.mission && S.mission.targets[S.mission.stage]; if (!t) return; drive(sim, t.x, t.z); }); assert.ok(!S.mission && S.done.patrol === 1, 'パトロールを クリア');
  const evs = sim.takeEvents(); assert.ok(evs.some((e) => e.t === 'reward' && e.id === 'patrol' && e.reward.bronze === 1 && e.coins === 30)); assert.ok(P.coins >= 30);
}
{
  const sim = mk(); const S = sim.state; const P = S.player; tele(sim, -160, 150); sim.interact(); assert.equal(S.mission.id, 'rescue'); assert.equal(S.civs.length, 3);
  for (const c of S.civs.slice()) { tele(sim, c.x - 3, c.z - 3); P.hp = P.hpMax; assert.equal(S.nearby.kind, 'civ'); sim.interact(); }
  tele(sim, HQ.x, HQ.z); P.hp = P.hpMax; run(sim, 8); assert.ok(!S.mission && S.done.rescue === 1, 'ひとじちを ほんぶへ とどけて クリア');
}
{
  const sim = mk(st(100)); const S = sim.state; const P = S.player; tele(sim, -160, -150); sim.interact(); assert.equal(S.mission.id, 'gang'); const mc = () => S.crooks.filter((c) => c.mission); assert.equal(mc().length, 5);
  const tank = S.vehicles.find((v) => v.id === 'tank'); tank.x = -320; tank.z = -230; tele(sim, -316, -230); sim.interact(); assert.equal(sim.vehicleOf().kind, 'tank');
  run(sim, 200, () => { P.hp = P.hpMax; const r = mc().filter((c) => c.state !== 'down').sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z))[0]; if (!r) { sim.input.gun = false; return; } const d = Math.hypot(r.x - P.x, r.z - P.z); if (d > 60) drive(sim, r.x, r.z); else { sim.input.turn = 0; sim.input.climb = 0; } sim.aimAt(r); sim.input.gun = d < 150; if (d < 250) sim.fireMissile(); });
  sim.input.gun = false; assert.ok(mc().length > 0 && mc().every((c) => c.state === 'down'), `ぜんいん たおれた (のこり ${mc().filter((c) => c.state !== 'down').length})`);
  sim.interact();
  for (const c of mc().slice()) { tele(sim, c.x - 2, c.z); P.hp = P.hpMax; assert.equal(S.nearby.kind, 'arrest'); sim.interact(); }
  run(sim, 0.2); assert.ok(!S.mission && S.done.gang === 1, 'ギャングを ぜんいん たいほして クリア');
}
{
  const sim = mk(); const S = sim.state; tele(sim, 0, -480); sim.interact(); assert.equal(S.mission.id, 'harbor');
  const ship = S.vehicles.find((v) => v.id === 'ship'); tele(sim, ship.x, ship.z + 5); assert.ok(sim.interact()); assert.equal(sim.vehicleOf().kind, 'ship');
  run(sim, 400, () => { const t = S.mission && S.mission.targets[S.mission.stage]; if (!t) return; drive(sim, t.x, t.z); }); assert.ok(S.done.harbor === 1, 'ふねで ブイを まわって クリア');
}
for (const planeId of ['plane', 'hawk']) {
  const sim = mk(st(100), 3, { owned: [...DEFAULT_OWNED, 'hawk'] }); const S = sim.state; const P = S.player; tele(sim, 345, 40); sim.interact(); assert.equal(S.mission.id, 'sky');
  const pl = S.vehicles.find((v) => v.id === planeId); tele(sim, pl.x + 3, pl.z); assert.ok(sim.interact()); assert.ok(isAir(sim.vehicleOf().kind) && P.y > 30);
  run(sim, 400, () => { P.hp = P.hpMax; const v = sim.vehicleOf(); if (!v) return; const t = S.mission && S.mission.targets[S.mission.stage]; if (!t) return; let d = Math.atan2(t.x - v.x, t.z - v.z) - v.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; sim.input.turn = Math.max(-1, Math.min(1, d * 2.5)); const hd = Math.hypot(t.x - v.x, t.z - v.z); const want = Math.atan2(t.y - v.y, hd) - v.pitch; sim.input.climb = Math.max(-1, Math.min(1, want * 3)); });
  assert.ok(S.done.sky === 1, `${planeId}: リングを ぜんぶ くぐって クリア (${S.mission ? S.mission.got : '-'}/6)`);
  const v = sim.vehicleOf(); if (v) { sim.interact(); run(sim, 25); assert.ok(P.y < 1 && !isWater(P.x, P.z) && !insideBuilding(P.x, P.z, 0), 'パラシュートで ぶじに ちゃくち'); }
}
{
  const sim = mk(); const S = sim.state; tele(sim, -320, 0); sim.interact(); assert.equal(S.mission.id, 'delivery');
  tele(sim, S.mission.pk.x, S.mission.pk.z); assert.equal(S.nearby.kind, 'pack'); sim.interact(); assert.equal(S.mission.stage, 1); tele(sim, HQ.x, HQ.z); run(sim, 0.5); assert.ok(S.done.delivery === 1, 'にもつを とどけた');
  const s2 = mk(); const S2 = s2.state; tele(s2, -320, 0); s2.interact(); tele(s2, S2.mission.pk.x, S2.mission.pk.z); s2.interact(); run(s2, 105); assert.ok(!S2.mission && !S2.done.delivery, 'じかんぎれは しっぱい');
}
// ---- ノックアウト・ふっかつ・ひったくり ----
{
  const sim = mk(); const S = sim.state; const P = S.player; P.coins = 100; P.hp = 1; S.crooks.push({ id: 9999, type: 'gunman', x: P.x + 8, z: P.z, yaw: 0, hp: 90, hpMax: 90, cd: 0, homeX: 0, homeZ: 0, wander: 20, state: 'idle', t: 0, downT: 0, speed: 5, ph: 0, alert: true, flee: 0, look: 0 });
  run(sim, 15); assert.ok(S.player.hp > 0 && S.player.coins <= 100 && Math.hypot(P.x - SPAWN.x, P.z - SPAWN.z) < 200, 'ふっかつして ほんぶに もどる');
  tele(sim, 160, 150); sim.interact(); assert.ok(S.mission); sim.cancelMission(); assert.equal(S.mission, null);
  const s2 = mk(); run(s2, 25); assert.ok(s2.state.crooks.some((c) => c.minor && c.type === 'runner'), 'ひったくりが あらわれる'); const r = s2.state.crooks.find((c) => c.minor); r.state = 'down'; tele(s2, r.x - 2, r.z); const c0 = s2.state.player.coins; s2.interact(); assert.equal(s2.state.player.coins - c0, 40);
}
console.log('OK: city');
