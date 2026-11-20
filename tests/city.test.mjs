import assert from 'node:assert/strict';
import * as HM from '../cityhome.js';
import { JOBS as JOBS_, SYMPTOMS as SYM_ } from '../citysim.js';
import { EQUIP, weaponOf, ammoSpec, WEAPONS, ARMS, JOB, STORES, SOCCER, ITEMS, needText, createCity, LAYOUT, isWater, isRoad, insideBuilding, SECRET, HQ, BASE, SHOP, SPAWN, BOARD, GARAGE, CITY_MISSIONS, WANTED, riverZ, BRIDGES, RIVER, roadPoint, SCHOOL, HOME, AIRFIELD, MAPDATA, VCAT, catalogOf, catalogV, DEFAULT_OWNED, isAir } from '../citysim.js';
import { buildVehicle, partOf, autoLoadout } from '../airsim.js';

const FSrun = (sim) => 9.6 + 70 * 0.0096; const st = (v) => ({ SHO: v, PAS: v, SPD: v, DEF: v, STA: v });
const ch = (id, rarity, pos) => ({ id, name: id, face: '', rarity, pos, stats: st(90) });
const chars = [ch('f', 'legend', 'FW'), ch('m', 'legend', 'MF'), ch('d', 'legend', 'DF'), ch('g', 'super', 'GK'), ch('f2', 'rare', 'FW')];
const veh = (kind, ks) => { const lo = autoLoadout(kind, chars); const parts = {}; for (const [s, id] of Object.entries(lo)) parts[s] = partOf(kind, s, chars.find((c) => c.id === id)); return buildVehicle({ vehicle: kind, name: 'P', kidStats: ks, parts }); };
const mk = (ks = st(70), seed = 3, extra = {}) => { let a = seed; const rnd = () => { a = (a * 1664525 + 1013904223) % 4294967296; return a / 4294967296; }; return createCity({ stats: ks, vehicles: { tank: veh('tank', ks), ship: veh('ship', ks), plane: veh('plane', ks) }, rnd, ...extra }); };
const run = (sim, sec, f) => { for (let t = 0; t < sec; t += 1 / 30) { if (f) f(t); sim.step(1 / 30); } };
const freeYaw = (x, z, L = 170) => { let best = 0; let bl = -1; for (let k = 0; k < 16; k++) { const y = (k / 16) * Math.PI * 2; let d = 0; for (; d < L; d += 4) { const px = x + Math.sin(y) * d; const pz = z + Math.cos(y) * d; if (isWater(px, pz) || insideBuilding(px, pz, 0)) break; } if (d > bl) { bl = d; best = y; } } return best; };
const clearLine = (x0, z0, y0, x1, z1, y1) => { const L = Math.hypot(x1 - x0, z1 - z0, y1 - y0); for (let d = 2; d < L - 1; d += 1.5) { const t = d / L; if (insideBuilding(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, y0 + (y1 - y0) * t)) return false; } return true; };
const hopLos = (sim, r) => { const P = sim.state.player; for (const rad of [10, 16, 24, 34]) for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; const x = r.x + Math.cos(a) * rad; const z = r.z + Math.sin(a) * rad; if (isWater(x, z) || insideBuilding(x, z, 0)) continue; if (!clearLine(x, z, 4, r.x, r.z, 1.6)) continue; const v = sim.vehicleOf(); if (v) { v.x = x; v.z = z; } P.x = x; P.z = z; return true; } return false; };
const MS = (id) => CITY_MISSIONS.find((m) => m.id === id).start;
const tele = (sim, x, z) => { sim.state.player.x = x; sim.state.player.z = z; sim.step(1 / 30); };

// ---- まちの かたち ----
{
  assert.ok(LAYOUT.buildings.length > 60, 'たてものが たくさん ある');
  for (const p of [SPAWN, HQ, SHOP, BOARD, GARAGE, JOB, SOCCER, ...STORES, ...CITY_MISSIONS.map((m) => m.start), ...WANTED.map((w) => w.spot)]) assert.ok(!isWater(p.x, p.z) && !insideBuilding(p.x, p.z, 0), `りくの うえ・たてものの そと (${p.x},${p.z})`);
  for (const m of CITY_MISSIONS) for (const p of [...(m.points || []), ...(m.civs || []), ...(m.pickup ? [m.pickup] : [])]) { if (m.water) assert.ok(isWater(p.x, p.z), `${m.id}: うみの うえ`); else assert.ok(!isWater(p.x, p.z) && !insideBuilding(p.x, p.z, 0), `${m.id}: たてものの そと (${p.x},${p.z})`); }
  { let q = 5; const R = () => { q = (q * 1664525 + 1013904223) % 4294967296; return q / 4294967296; }; for (let i = 0; i < 600; i++) { const rp = roadPoint(R, 0); if (isRoad(rp.x, rp.z)) assert.ok(!insideBuilding(rp.x, rp.z, 0), `みちに たてものが ない (${rp.x},${rp.z})`); } }
  assert.ok(isWater(0, riverZ(0)) && !isWater(HQ.x, HQ.z) && isWater(2000, 0) && isWater(-150, riverZ(-150)) && BRIDGES.length >= 2 && !isWater(BRIDGES[0].x, BRIDGES[0].z) && MAPDATA.buildings.length > 1000, 'かわ・はし・まちの そと・ほんものの ちず');
  assert.equal(WANTED.length, 14); assert.ok(WANTED.every((w, i) => i === 0 || w.bounty >= WANTED[i - 1].bounty), 'つよい ほど けんしょう金が おおい');
  assert.ok(VCAT.length >= 16 && VCAT.some((v) => v.kind === 'bike') && VCAT.some((v) => v.kind === 'jet') && VCAT.some((v) => v.kind === 'plane') && VCAT.filter((v) => v.kind === 'car').length >= 6, 'のりものが いろいろ');
  const sim = mk(st(70), 3, { owned: VCAT.map((v) => v.id) });
  for (const v of sim.state.vehicles) { assert.ok(!isWater(v.x, v.z) || v.kind === 'ship', `ガレージの のりもの ${v.id}`); assert.ok(!insideBuilding(v.x, v.z, 0), `たてものの そと ${v.id} (${v.x},${v.z})`); }
  assert.equal(new Set(sim.state.vehicles.map((v) => `${v.home.x},${v.home.z}`)).size, sim.state.vehicles.length, 'わくが かさならない');
}
// ---- あるく・のりおり ----
{
  const sim = mk(); const S = sim.state; const P = S.player;
  sim.input.climb = 1; run(sim, 2); assert.ok(Math.hypot(P.x - SPAWN.x, P.z - SPAWN.z) > 6, 'あるける'); sim.input.climb = 0;
  P.x = MS('harbor').x; P.z = MS('harbor').z; P.yaw = Math.PI; sim.input.climb = 1; run(sim, 8); assert.ok(!isWater(P.x, P.z), 'あるいて うみに はいれない'); sim.input.climb = 0;
  const c1 = S.vehicles.find((v) => v.id === 'sedan'); c1.x = HQ.x + 6; c1.z = HQ.z + 6; P.x = HQ.x + 10; P.z = HQ.z + 6; P.yaw = 0; run(sim, 0.1); assert.equal(S.nearby && S.nearby.kind, 'veh'); assert.ok(sim.interact()); assert.equal(P.mode, 'veh');
  sim.input.climb = 1; run(sim, 3); assert.ok(sim.vehicleOf().speed > 10, 'くるまが はしる'); sim.input.climb = 0; run(sim, 3);
  assert.ok(sim.interact() && P.mode === 'foot', 'おりる');
  P.x = HQ.x + 20; P.z = HQ.z + 30; sim.input.climb = 1; P.yaw = Math.PI / 2; run(sim, 5); assert.ok(!insideBuilding(P.x, P.z, 0), 'ほんぶに めりこまない'); sim.input.climb = 0;
  assert.ok(S.pickups.length > 20 && S.walkers.length > 5 && S.traffic.length >= 4);
  S.lv = 0; S.heat = 0; S.heatT = 0; S.fine = 0; S.crooks = S.crooks.filter((c) => !c.hunter); S.traffic = S.traffic.filter((c) => !c.cop); // (ここまでで くるまを うんてんして ひとを ひいた ぶん)
  const t = S.traffic[0]; tele(sim, t.x + 3, t.z); run(sim, 0.1); assert.equal(S.nearby && S.nearby.kind, 'tcar'); const nt = S.traffic.length; sim.interact(); if (P.mode !== 'veh') { assert.ok(t.denied && S.lv === 0, 'だめと いわれた'); sim.interact(); assert.ok(P.mode === 'veh' && S.lv >= 1, 'ことわられたのに のると どろぼう★1'); } else assert.equal(S.lv, 0, 'OKなら ★は つかない'); assert.equal(S.traffic.length, nt - 1, 'くるまを かりられる');
  sim.input.climb = 1; run(sim, 2); assert.ok(sim.vehicleOf().speed > 5); sim.input.climb = 0; sim.interact(); run(sim, 45); assert.ok(!S.vehicles.some((v) => v.temp), 'かりた くるまは きえる');
}
// ---- いろいろな のりもの ----
{
  const sim = mk(st(80), 3, { owned: VCAT.map((v) => v.id) }); const S = sim.state; const P = S.player;
  for (const id of ['sports', 'bike', 'truck', 'racer', 'pbike', 'suv']) {
    const v = S.vehicles.find((x) => x.id === id); assert.ok(v, id); P.mode = 'foot'; P.veh = null; v.occ = false; v.x = HQ.x + 6; v.z = HQ.z + 6; v.yaw = freeYaw(v.x, v.z); v.speed = 0; P.x = HQ.x + 9; P.z = HQ.z + 6; run(sim, 0.1); assert.equal(S.nearby.id, id); sim.interact(); assert.equal(sim.vehicleOf().id, id);
    sim.input.climb = 1; let sp = 0; run(sim, 3.5, () => { const vv = sim.vehicleOf(); if (vv) sp = Math.max(sp, vv.speed); }); assert.ok(sp > catalogV(catalogOf(id), st(80)).speed * 0.7, `${id}: はしる (${sp.toFixed(0)})`); sim.input.climb = 0; sim.interact(); run(sim, 1);
  }
  for (const id of ['cessna', 'trainer', 'bizjet', 'hawk', 'phantom']) {
    P.mode = 'foot'; P.veh = null; const v = S.vehicles.find((x) => x.id === id); assert.ok(v && isAir(v.kind), id); v.occ = false; assert.ok(sim.summon(id).ok, 'ガレージの メニューから のる'); assert.equal(sim.vehicleOf().id, id); assert.ok(P.y > 30);
    run(sim, 3); assert.ok(Math.hypot(v.x - v.home.x, v.z - v.home.z) > 60, `${id}: とぶ`); sim.interact(); run(sim, 25);
  }
  assert.ok(catalogOf('phantom').price > catalogOf('hawk').price && catalogOf('hawk').missiles >= 6, 'せんとうきは たかい・ミサイル');
}
// ---- ガレージ・ショップ・ボード ----
{
  const sim = mk(); const S = sim.state; const P = S.player; P.coins = 50; assert.equal(sim.buy('heal').ok, false); P.hp = 10; assert.ok(sim.buy('heal').ok && P.hp === P.hpMax && P.coins === 40);
  assert.equal(sim.buy('silver').ok, false); assert.ok(sim.buy('bronze').ok && P.coins === 0); assert.ok(sim.takeEvents().some((e) => e.t === 'buy' && e.id === 'bronze'));
  const tp = catalogOf('taxi').price; P.coins = tp + 50; assert.equal(sim.buyVehicle('hawk').ok, false, 'たりない'); assert.equal(sim.buyVehicle('sedan').ok, false, 'もってる'); assert.ok(sim.buyVehicle('taxi').ok && P.coins === 50 && S.vehicles.some((v) => v.id === 'taxi' && v.cat === 'taxi')); assert.ok(sim.takeEvents().some((e) => e.t === 'buyveh' && e.id === 'taxi'));
  tele(sim, GARAGE.x, GARAGE.z); assert.equal(S.nearby && S.nearby.kind, 'garage'); sim.interact(); assert.equal(S.ui, 'garage'); sim.closeUi();
  tele(sim, BOARD.x, BOARD.z); assert.equal(S.nearby && S.nearby.kind, 'board'); sim.interact(); assert.ok(S.wanted.length === 14 && S.wanted.every((w) => w.alive));
}
// ---- 指名手配はんを たいほ ----
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
  const sim3 = mk(st(100)); const g = sim3.state.crooks.find((c) => c.wid === 'gonzo'); g.state = 'down'; tele(sim3, 300, 300); run(sim3, 30); assert.notEqual(g.state, 'down', 'ほうっておくと にげる');
}
// ---- ミッション(ボット) ----
const drive = (sim, tx, tz, { speed = 1 } = {}) => {
  const P = sim.state.player; const dr = sim._drv || (sim._drv = { x: P.x, z: P.z, n: 0 }); const v0 = sim.vehicleOf();
  // ほんものの ちずは みちが ふくざつ なので、じどうの うんてんは「もくひょうの ちかくへ ワープ」で ミッションの ルールだけ たしかめる(はしる テストは べつ)
  if (!(v0 && (v0.kind === 'ship' || isAir(v0.kind)))) { const dd = Math.hypot(tx - P.x, tz - P.z); if (dr.n++ > 20 && dd > 12) { dr.n = 0; const k2 = (dd - 6) / dd; const nx = P.x + (tx - P.x) * k2; const nz = P.z + (tz - P.z) * k2; if (!isWater(nx, nz)) { if (v0) { v0.x = nx; v0.z = nz; } P.x = nx; P.z = nz; } } }
  let d = Math.atan2(tx - P.x, tz - P.z) - P.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; sim.input.turn = Math.max(-1, Math.min(1, d * 2.2)); sim.input.climb = Math.abs(d) < 1.2 ? speed : 0.2;
};
{
  const sim = mk(); const S = sim.state; const P = S.player; tele(sim, MS('patrol').x, MS('patrol').z); assert.equal(S.nearby.kind, 'mission'); assert.ok(sim.interact()); assert.equal(S.mission.id, 'patrol');
  const car = S.vehicles.find((v) => v.id === 'police'); car.x = MS('patrol').x; car.z = MS('patrol').z; tele(sim, MS('patrol').x + 3, MS('patrol').z); sim.interact(); assert.equal(P.mode, 'veh');
  run(sim, 120, () => { const t = S.mission && S.mission.targets[S.mission.stage]; if (!t) return; drive(sim, t.x, t.z); }); assert.ok(!S.mission && S.done.patrol === 1, 'パトロールを クリア');
  const evs = sim.takeEvents(); assert.ok(evs.some((e) => e.t === 'reward' && e.id === 'patrol' && e.reward.bronze === 1 && e.coins === 30)); assert.ok(P.coins >= 30);
}
{
  const sim = mk(); const S = sim.state; const P = S.player; tele(sim, MS('rescue').x, MS('rescue').z); sim.interact(); assert.equal(S.mission.id, 'rescue'); assert.equal(S.civs.length, 3);
  for (const c of S.civs.slice()) { tele(sim, c.x - 3, c.z - 3); P.hp = P.hpMax; assert.equal(S.nearby.kind, 'civ'); sim.interact(); }
  tele(sim, BASE.x, BASE.z); P.hp = P.hpMax; run(sim, 8); assert.ok(!S.mission && S.done.rescue === 1, 'ひとじちを ほんぶへ とどけて クリア');
}
{
  const sim = mk(st(100), 3, { owned: [...DEFAULT_OWNED, 'tank'] }); const S = sim.state; const P = S.player; tele(sim, MS('gang').x, MS('gang').z); sim.interact(); assert.equal(S.mission.id, 'gang'); const mc = () => S.crooks.filter((c) => c.mission); assert.equal(mc().length, 5);
  const tank = S.vehicles.find((v) => v.id === 'tank'); tank.x = MS('gang').x + 6; tank.z = MS('gang').z; tele(sim, MS('gang').x + 10, MS('gang').z); sim.interact(); assert.equal(sim.vehicleOf().kind, 'tank');
  run(sim, 200, () => { P.hp = P.hpMax; const r = mc().filter((c) => c.state !== 'down').sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z))[0]; if (!r) { sim.input.gun = false; return; } const d = Math.hypot(r.x - P.x, r.z - P.z); if (d > 60 || !clearLine(P.x, P.z, 4, r.x, r.z, 1.6)) hopLos(sim, r); else { let aa = Math.atan2(r.x - P.x, r.z - P.z) - P.yaw; while (aa > Math.PI) aa -= 2 * Math.PI; while (aa < -Math.PI) aa += 2 * Math.PI; sim.input.turn = Math.max(-1, Math.min(1, aa * 2.5)); sim.input.climb = 0; } sim.aimAt(r); sim.input.gun = d < 150; if (d < 250) sim.fireMissile(); });
  sim.input.gun = false; assert.ok(mc().length > 0 && mc().every((c) => c.state === 'down'), `ぜんいん たおれた (のこり ${mc().filter((c) => c.state !== 'down').length})`);
  sim.interact();
  for (const c of mc().slice()) { tele(sim, c.x - 2, c.z); P.hp = P.hpMax; assert.equal(S.nearby.kind, 'arrest'); sim.interact(); }
  run(sim, 0.2); assert.ok(!S.mission && S.done.gang === 1, 'ギャングを ぜんいん たいほして クリア');
}
{
  const sim = mk(); const S = sim.state; tele(sim, MS('harbor').x, MS('harbor').z); sim.interact(); assert.equal(S.mission.id, 'harbor');
  const ship = S.vehicles.find((v) => v.id === 'ship'); tele(sim, ship.x, ship.z + 5); assert.ok(sim.interact()); assert.equal(sim.vehicleOf().kind, 'ship');
  run(sim, 400, () => { const t = S.mission && S.mission.targets[S.mission.stage]; if (!t) return; drive(sim, t.x, t.z); }); assert.ok(S.done.harbor === 1, 'ふねで ブイを まわって クリア');
}
for (const planeId of ['plane', 'hawk']) {
  const sim = mk(st(100), 3, { owned: [...DEFAULT_OWNED, 'hawk', 'plane'] }); const S = sim.state; const P = S.player; tele(sim, MS('sky').x, MS('sky').z); sim.interact(); assert.equal(S.mission.id, 'sky');
  const pl = S.vehicles.find((v) => v.id === planeId); tele(sim, pl.x + 3, pl.z); assert.ok(sim.interact()); assert.ok(isAir(sim.vehicleOf().kind) && P.y > 30);
  run(sim, 400, () => { P.hp = P.hpMax; const v = sim.vehicleOf(); if (!v) return; const t = S.mission && S.mission.targets[S.mission.stage]; if (!t) return; let d = Math.atan2(t.x - v.x, t.z - v.z) - v.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; sim.input.turn = Math.max(-1, Math.min(1, d * 2.5)); const hd = Math.hypot(t.x - v.x, t.z - v.z); const want = Math.atan2(t.y - v.y, hd) - v.pitch; sim.input.climb = Math.max(-1, Math.min(1, want * 3)); });
  assert.ok(S.done.sky === 1, `${planeId}: リングを ぜんぶ くぐって クリア (${S.mission ? S.mission.got : '-'}/6)`);
  const v = sim.vehicleOf(); if (v) { sim.interact(); run(sim, 25); assert.ok(P.y < 1 && !isWater(P.x, P.z) && !insideBuilding(P.x, P.z, 0), 'パラシュートで ぶじに ちゃくち'); }
}
{
  const sim = mk(); const S = sim.state; tele(sim, MS('delivery').x, MS('delivery').z); sim.interact(); assert.equal(S.mission.id, 'delivery');
  tele(sim, S.mission.pk.x, S.mission.pk.z); assert.equal(S.nearby.kind, 'pack'); sim.interact(); assert.equal(S.mission.stage, 1); tele(sim, BASE.x, BASE.z); run(sim, 0.5); assert.ok(S.done.delivery === 1, 'にもつを とどけた');
  const s2 = mk(); const S2 = s2.state; tele(s2, MS('delivery').x, MS('delivery').z); s2.interact(); tele(s2, S2.mission.pk.x, S2.mission.pk.z); s2.interact(); run(s2, 105); assert.ok(!S2.mission && !S2.done.delivery, 'じかんぎれは しっぱい');
}
// ---- ノックアウト・ふっかつ・ひったくり ----
{
  const sim = mk(); const S = sim.state; const P = S.player; P.coins = 100; P.hp = 1; S.crooks.push({ id: 9999, type: 'gunman', x: P.x + 8, z: P.z, yaw: 0, hp: 90, hpMax: 90, cd: 0, homeX: 0, homeZ: 0, wander: 20, state: 'idle', t: 0, downT: 0, speed: 5, ph: 0, alert: true, flee: 0, look: 0 });
  run(sim, 15); assert.ok(S.player.hp > 0 && S.player.coins <= 100 && Math.hypot(P.x - SPAWN.x, P.z - SPAWN.z) < 200, 'ふっかつして ほんぶに もどる');
  tele(sim, MS('patrol').x, MS('patrol').z); sim.interact(); assert.ok(S.mission); sim.cancelMission(); assert.equal(S.mission, null);
  const s2 = mk(); run(s2, 25); assert.ok(s2.state.crooks.some((c) => c.minor && c.type === 'runner'), 'ひったくりが あらわれる'); const r = s2.state.crooks.find((c) => c.minor); r.state = 'down'; tele(s2, r.x - 2, r.z); const c0 = s2.state.player.coins; s2.interact(); assert.equal(s2.state.player.coins - c0, 40);
}
// ---- ぶき・ワープ・のりものの かいほう・おしごと ----
{
  assert.ok(WEAPONS.length >= 30 && new Set(WEAPONS.map((w) => w.id)).size === WEAPONS.length, 'ぶきが たくさん');
  for (const p of [ARMS, JOB]) assert.ok(!isWater(p.x, p.z) && !insideBuilding(p.x, p.z, 0), 'ぶきや・おしごと');
  const sim = mk(); const S = sim.state; const P = S.player; assert.equal(P.weapon, 'pistol');
  P.coins = 100000; assert.equal(sim.buyWeapon('railgun').ok, false, 'じょうけんが まだ'); assert.ok(sim.buyWeapon('knife').ok && P.weapon === 'knife', 'かって そうび'); assert.equal(sim.buyWeapon('knife').ok, false);
  const w0 = P.weapon; assert.notEqual(sim.cycleWeapon(1), w0, 'きりかえ'); sim.equip('bat'); assert.equal(P.weapon, 'bat'); assert.equal(sim.equip('railgun'), false);
  assert.equal(sim.buyVehicle('hawk').ok, false, 'レアは ミッションと たいほが ひつよう'); assert.ok(/ミッション/.test(needText({ m: 2 })) && P.coins === 100000 - WEAPONS.find((w) => w.id === 'knife').price);
  // ぶきで はんにんを たおす(ちかくで)
  for (const w of ['bat', 'pistol']) { const s2 = mk(); const P2 = s2.state.player; P2.weapon = w; const c = s2.state.crooks.find((x) => x.wid === 'joe'); P2.x = c.x; P2.z = c.z - (w === 'bat' ? 2.4 : 12); P2.yaw = 0; c.state = 'idle'; s2.input.gun = true; run(s2, 8, () => { P2.hp = P2.hpMax; P2.yaw = Math.atan2(c.x - P2.x, c.z - P2.z); }); s2.input.gun = false; assert.ok(c.state === 'down', `${w}で たおせる`); }
  // ばくはつぶき
  { const s2 = mk(); const P2 = s2.state.player; s2.state.wOwned.push('rpg'); P2.weapon = 'rpg'; const c = s2.state.crooks.find((x) => x.wid === 'joe'); P2.x = c.x; P2.z = c.z - 30; P2.yaw = 0; s2.input.gun = true; run(s2, 4, () => { P2.hp = P2.hpMax; P2.yaw = Math.atan2(c.x - P2.x, c.z - P2.z); P2.aimPitch = 0.05; }); s2.input.gun = false; assert.ok(c.state === 'down', 'ロケットで たおせる'); }
  // ワープ・のりものを ガレージで のる
  const s3 = mk(st(70), 3, { owned: VCAT.map((v) => v.id) }); const P3 = s3.state.player; P3.x = -300; P3.z = 300; assert.ok(s3.fastTravel().ok && Math.hypot(P3.x - GARAGE.x, P3.z - GARAGE.z) < 20, 'ガレージへ ワープ');
  const sp = s3.summon('hawk'); assert.ok(sp.ok && s3.vehicleOf() && s3.vehicleOf().id === 'hawk', 'ガレージから のる'); assert.equal(s3.summon('ship').ok, false);
  const s4 = mk(st(70), 3, { jobOk: 0 }); s4.state.player.coins = 30000; s4.state.arrests = { joe: 1, momo: 1, gonzo: 1 }; assert.ok(!s4.buyVehicle('super').ok, 'おしごとの せいかいが たりないと かえない'); s4.addJobOk(30); assert.ok(s4.buyVehicle('super').ok, 'たいほ・おしごとが ふえると レアを かえる');
  const s5 = mk(); s5.addCoins(50); assert.equal(s5.state.player.coins, 50, 'おしごとの おきゅうりょう');
}
// ---- たては たてものを とおりぬけない ----
{
  const bb = LAYOUT.buildings.find((b) => b.kind === 'apt' && b.h > 14 && b.w > 14 && b.d > 10 && !b.ang); const sim = mk(); const S = sim.state; const P = S.player;
  if (bb) { const c = S.crooks.find((x) => x.wid === 'joe'); c.x = bb.cx + bb.w / 2 + 9; c.z = bb.cz; c.state = 'idle'; c.hp = c.hpMax; P.x = bb.cx - bb.w / 2 - 9; P.z = bb.cz; P.weapon = 'pistol'; P.yaw = Math.PI / 2; sim.input.gun = true; const hp0 = c.hp;
    run(sim, 3, () => { P.hp = P.hpMax; P.x = bb.cx - bb.w / 2 - 9; P.z = bb.cz; P.yaw = Math.PI / 2; P.camYaw = Math.PI / 2; c.x = bb.cx + bb.w / 2 + 9; c.z = bb.cz; }); sim.input.gun = false; assert.equal(c.hp, hp0, 'かべの むこうの てきには あたらない'); }
}
// ---- スマホふうの そうさ: カメラきじゅんの いどう・ねらいロックで よこいどう・スティックで ダッシュ ----
{
  const sim = mk(); const S = sim.state; const P = S.player; P.x = HQ.x; P.z = HQ.z; const fy = freeYaw(P.x, P.z, 60); P.camYaw = fy; P.camFree = true; P.yaw = fy;
  const x0 = P.x; const z0 = P.z; sim.input.moveY = 0.5; run(sim, 1.5); const dF = Math.hypot(P.x - x0, P.z - z0); sim.input.moveY = 0; run(sim, 0.5);
  const spWalk = dF / 1.5; assert.ok(dF > 3, 'スティックを うえに たおすと カメラの むきに すすむ');
  sim.input.moveY = 1; run(sim, 1.2); const spMax = P.speed; sim.input.moveY = 0; run(sim, 0.5); assert.ok(spMax > spWalk * 1.3, 'ふかく たおすと ダッシュ');
  const cy2 = fy + Math.PI / 2; P.x = x0; P.z = z0; P.camYaw = cy2; P.yaw = cy2; sim.input.aimLock = true; sim.input.moveX = 1; sim.input.moveY = 0; run(sim, 0.8); const lateral = Math.abs(((P.x - x0) * Math.cos(cy2) - (P.z - z0) * Math.sin(cy2))); const along = Math.abs((P.x - x0) * Math.sin(cy2) + (P.z - z0) * Math.cos(cy2));
  assert.ok(Math.abs(Math.atan2(Math.sin(P.yaw - P.camYaw), Math.cos(P.yaw - P.camYaw))) < 0.25, 'ねらい中は からだが カメラを むいたまま'); assert.ok(lateral > along, 'ねらい中の よこいどう(ストレイフ)'); sim.input.aimLock = false; sim.input.moveX = 0;
}
// ---- ねらいあわせは ぶきの しゃてい+αだけ ----
{
  const sim = mk(); const S = sim.state; const P = S.player; const c = S.crooks.find((x) => x.wid === 'joe'); P.weapon = 'pistol'; const r = weaponOf('pistol').range;
  P.x = c.x - 40; P.z = c.z; sim.step(1 / 30); assert.ok(P.target, 'しゃていの なか: ロックできる');
  P.x = c.x - (r + 40); P.z = c.z; sim.step(1 / 30); assert.ok(!P.target || P.target.id !== c.id, 'しゃてい+αの そと: ロックできない');
}
// ---- たまの かず・リロード ----
{
  const sim = mk(); const S = sim.state; const P = S.player; P.weapon = 'pistol'; const A = sim.ammoOf('pistol'); const sp = ammoSpec(weaponOf('pistol')); assert.equal(A.mag, sp.mag);
  const c = S.crooks.find((x) => x.wid === 'joe'); P.x = c.x - 30; P.z = c.z; c.state = 'down'; sim.input.gun = true; run(sim, 1.2, () => { P.camYaw = Math.PI / 2; P.yaw = Math.PI / 2; }); sim.input.gun = false; assert.ok(A.mag < sp.mag, 'うつと たまが へる');
  A.mag = 0; A.reserve = 20; sim.input.gun = true; run(sim, 0.1, () => { P.wCd = 0; }); assert.ok(P.reload > 0, 'からに なると じどうで リロード'); sim.input.gun = false; run(sim, sp.reload + 0.3); assert.equal(A.mag, sp.mag, 'リロードで マガジンが ふえる'); assert.equal(A.reserve, 20 - sp.mag, 'よびの たまが へる');
  A.mag = 0; A.reserve = 0; sim.input.gun = true; run(sim, 1, () => { P.wCd = 0; }); assert.equal(A.mag, 0, 'たまが ないと うてない'); sim.input.gun = false;
  P.coins = 1000; assert.ok(sim.buy('ammo').ok && sim.ammoOf('pistol').reserve === ammoSpec(weaponOf('pistol')).cap, 'たまの ほじゅう');
  sim.ammoOf('pistol').mag = sp.mag; assert.ok(sim.reload() === false, 'まんたんでは リロードしない'); P.weapon = 'sniper'; const sa = sim.ammoOf('sniper'); assert.ok(sa.mag <= 5 && ammoSpec(weaponOf('sniper')).reload > ammoSpec(weaponOf('pistol')).reload, 'スナイパーは マガジンが すくなく リロードが おそい');
}
// ---- ぶきごとの しゃてい ----
{
  const rg = (id) => weaponOf(id).range; assert.ok(rg('sawedoff') < rg('pistol') && rg('pistol') < rg('assault') && rg('assault') < rg('sniper') && rg('sniper') < rg('heavysniper'), 'ぶきごとに しゃていが ちがう');
  const sim = mk(); const S = sim.state; const P = S.player; const c = S.crooks.find((x) => x.wid === 'joe'); P.weapon = 'pistol'; c.state = 'idle'; c.hp = c.hpMax; sim.input.gun = true; sim.ammoOf('pistol').mag = 12;
  P.x = c.x - (rg('pistol') + 20); P.z = c.z; run(sim, 1, () => { P.camYaw = Math.PI / 2; P.yaw = Math.PI / 2; P.wCd = 0; P.x = c.x - (rg('pistol') + 20); P.z = c.z; }); sim.input.gun = false; assert.equal(c.hp, c.hpMax, 'しゃていの そとには とどかない');
}
// ---- じたくで たまを ほじゅう ----
{
  const sim = mk(); const S = sim.state; const P = S.player; const A = sim.ammoOf('pistol'); A.mag = 1; A.reserve = 3; tele(sim, GARAGE.x, GARAGE.z); run(sim, 0.5); const sp = ammoSpec(weaponOf('pistol')); assert.equal(A.reserve, sp.cap, 'じたくで よびが まんたん'); assert.equal(A.mag, sp.mag, 'じたくで マガジンも まんたん');
}
// ---- じたくの かいふくは あんぜんな ときだけ ----
{
  const sim = mk(); const S = sim.state; const P = S.player; const A = sim.ammoOf('pistol'); tele(sim, GARAGE.x, GARAGE.z); sim.raise(3); P.hp = 20; A.mag = 0; A.reserve = 0; run(sim, 3); assert.ok(P.hp < 40, `指名手配ちゅうは じたくで かいふく しない (${P.hp})`); assert.equal(A.reserve, 0, '指名手配ちゅうは たまも ほじゅう されない');
  const s2 = mk(); const Q = s2.state.player; tele(s2, GARAGE.x, GARAGE.z); Q.hp = 20; Q.lastHurt = s2.state.t; run(s2, 2); assert.ok(Q.hp < 30, 'ダメージを うけた ばかりは かいふく しない');
  const s3 = mk(); const R = s3.state.player; tele(s3, GARAGE.x, GARAGE.z); R.hp = 20; R.lastHurt = -99; run(s3, 3); assert.ok(R.hp > 60, 'あんぜんな ときは じたくで かいふく');
}
// ---- くるま・バイクに ぶつかると ダメージ、なんかいかで こわれる ----
{
  const sim = mk(); const S = sim.state; const P = S.player; const car = S.vehicles.find((v) => v.id === 'sedan'); const c = S.traffic.find((x) => !x.hostile && !x.bike);
  car.x = c.x; car.z = c.z; P.x = c.x + 3; P.z = c.z; sim.step(1 / 30); sim.interact(); assert.equal(sim.vehicleOf() && sim.vehicleOf().id, 'sedan'); const v = sim.vehicleOf();
  let n = 0; for (let i = 0; i < 40 && P.mode === 'veh'; i++) { c.hitT = -99; c.dead = 0; c.hp = 1; c.hidden = false; v.x = c.x; v.z = c.z; v.speed = 12; P.invuln = 0; sim.step(1 / 30); n++; }
  assert.equal(P.mode, 'foot', `${v.hitMax}かい ぶつかると こわれる`); assert.ok(n >= v.hitMax - 1 && n <= v.hitMax + 3, `ぶつかった かいすう ${n}`); assert.equal(v.hits, 0, 'こわれたら もとに もどる');
  const bike = S.vehicles.find((x) => x.id === 'scooter'); assert.ok(bike.hitMax < v.hitMax, 'バイクは くるまより こわれやすい');
}
// ---- そうび(ふく・くつ・ぼうし) ----
{
  const sim = mk(); const S = sim.state; const P = S.player; const hp0 = P.hpMax; P.coins = 500000;
  assert.ok(!sim.buyEquip('hmask').ok, 'レアは ミッション・たいほが ひつよう'); assert.ok(sim.buyEquip('hoodie').ok && P.hpMax === hp0 + 20, 'ふくで HPが ふえる'); assert.equal(S.equip.body, 'hoodie');
  assert.ok(sim.buyEquip('jersey').ok && S.equip.body === 'jersey' && P.hpMax === hp0 + 10, 'きがえると こうかが かわる'); assert.ok(sim.wear('jersey') && !S.equip.body && P.hpMax === hp0, 'ぬぐと もどる');
  const s2 = mk(); s2.state.player.coins = 100000; s2.buyEquip('sneaker'); assert.ok(s2.state.eq.spd > 0.05, 'くつで あしが はやい'); s2.buyEquip('cap'); assert.ok(s2.state.eq.aim > 0.09 && s2.state.eq.acc > 0.07, 'ぼうしで ねらい・ブレ');
  const s3 = mk(); s3.state.player.coins = 1e6; s3.state.arrests = { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1, g: 1, h: 1 }; s3.state.done = { x: 6 }; assert.ok(!s3.buyEquip('hmask').ok, 'おしごとの せいかいも ひつよう'); s3.addJobOk(130); assert.ok(s3.buyEquip('hmask').ok, 'かいほうされると レアが かえる');
  const s4 = mk(st(70), 3, { eqOwned: ['sneaker', 'cap'], equip: { feet: 'sneaker', head: 'cap' } }); assert.ok(s4.state.eq.spd > 0 && s4.state.equip.head === 'cap', 'ほぞん・ふっかつ');
  const run1 = (e) => { const q = mk(st(70), 3, e); const Q = q.state.player; Q.x = 0; Q.z = 0; q.input.moveY = 1; q.input.moveX = 0; for (let i = 0; i < 40; i++) q.step(0.05); return Q.speed; };
  assert.ok(run1({ eqOwned: ['rocket'], equip: { feet: 'rocket' } }) > run1({}) * 1.2, 'くつで はやく はしる');
}
// ---- 指名手配 ----
{
  const sim = mk(); const S = sim.state; const P = S.player; P.coins = 5000; assert.equal(S.lv, 0);
  for (let i = 0; i < 4; i++) sim.meleeHit(); assert.equal(S.lv, 0, 'なぐるのは 5かいで ★1'); sim.meleeHit(); assert.equal(S.lv, 1, '5かい なぐると ★1');
  sim.gunHit(); assert.equal(S.lv, 2, 'うつと 1かいで ★2'); const hit = (n) => { for (let i = 0; i < n; i++) { S.cntT = -9; sim.gunHit(); } }; hit(1); assert.equal(S.lv, 2, '1かいでは まだ'); hit(1); assert.equal(S.lv, 3, '2かい あてると ★+1'); hit(4); assert.equal(S.lv, 5); hit(4); assert.equal(S.lv, 5, '★5が さいだい');
  assert.ok(S.heatT >= 900, '★が たかいほど じかんが ながい');
  for (let i = 0; i < 700; i++) { sim.step(0.05); P.hp = P.hpMax; } assert.equal(S.lv, 5, '★5は すぐには きえない');
  const cops = S.crooks.filter((c) => c.hunter).length + S.traffic.filter((c) => c.cop).length + S.jets.length + S.helis.length; assert.ok(cops >= 17 && cops <= 26, `★5は 20にん ぐらい (${cops})`); assert.ok(S.jets.length >= 3 && S.helis.length >= 3 && S.traffic.some((c) => c.cop) && S.crooks.some((c) => c.hunter === 'cop'), 'せんとうき・パトカー・あるく けいさつ');
  const kb = sim.payFine(); assert.ok(!kb.ok && S.lv === 5, '★5は ばっきんで けせない'); assert.ok(!sim.fastTravel().ok, '★5は ワープ できない');
  P.coins = 1000; P.hp = 1; P.invuln = 0; S.bullets.push({ x: P.x, y: 1.2, z: P.z, vx: 0, vy: 0, vz: 0, t: 0, dmg: 99 }); sim.step(0.1); assert.equal(P.coins, 500, 'たおされると おかねが はんぶん'); assert.equal(S.lv, 0, 'たおされると かいじょ'); assert.equal(S.jets.length, 0);
  { const e = mk(); e.raise(5); e.state.heatT = 0.5; e.state.player.invuln = 99; for (let i = 0; i < 40; i++) e.step(0.05); assert.equal(e.state.lv, 0, '★5でも ながく にげきれば おわる'); }
  const s2 = mk(); const P2 = s2.state.player; P2.coins = 5000; s2.raise(3); assert.equal(s2.state.lv, 3); const f = s2.state.fine; assert.ok(f > 0 && s2.state.heatT > 100); const b0 = P2.coins; const ok2 = s2.payFine(); assert.ok(ok2.ok && P2.coins === b0 - f && s2.state.lv === 0, '★3までは ばっきんで かいじょ');
  const s3 = mk(); const P3 = s3.state.player; const w3 = s3.state.walkers.find((x) => !x.idle && x.path); w3.x = P3.x + 8; w3.z = P3.z; P3.camYaw = Math.PI / 2; P3.yaw = Math.PI / 2; P3.weapon = 'pistol'; s3.state.walkers.forEach((x) => { if (x !== w3) { x.x = 9999; x.z = 9999; } }); s3.input.gun = true; for (let i = 0; i < 6; i++) { w3.x = P3.x + 8; w3.z = P3.z; P3.wCd = 0; P3.camYaw = Math.PI / 2; s3.step(0.05); if (s3.state.lv >= 2) break; } s3.input.gun = false; assert.ok(s3.state.lv >= 2, 'いっぱんの ひとを うつと ★2');
}
// ---- くるまが はしっている ----
{
  const sim = mk(); const S = sim.state; const P = S.player; assert.ok(S.traffic.length >= 36, 'くるまが おおい'); for (let i = 0; i < 80; i++) sim.step(0.05); const near = S.traffic.filter((c) => Math.hypot(c.x - P.x, c.z - P.z) < 300).length; assert.ok(near >= 4, `ちかくに くるまが はしっている (${near})`);
}
// ---- ダッシュメーター ----
{
  const sim = mk(); const S = sim.state; const P = S.player; P.x = HQ.x; P.z = HQ.z; const fy = freeYaw(P.x, P.z, 400); P.camYaw = fy; P.yaw = fy; P.camFree = true;
  sim.input.moveY = 1; let tiredAt = -1; for (let i = 0; i < 20 * 14; i++) { sim.step(0.05); if (P.tired && tiredAt < 0) tiredAt = i * 0.05; P.x = HQ.x; P.z = HQ.z; } assert.ok(tiredAt > 2 && tiredAt < 12, 'ダッシュを つづけると メーターが ゼロに なって つかれる'); assert.ok(P.boost < 40, 'メーターが へった');
  for (let i = 0; i < 20; i++) { sim.step(0.05); P.x = HQ.x; P.z = HQ.z; } assert.ok(P.tired, 'まだ つかれている'); assert.ok(P.speed < FSrun(sim) * 0.8, 'つかれると ダッシュできず おそい'); sim.input.moveY = 0; for (let i = 0; i < 20 * 6; i++) sim.step(0.05); assert.ok(P.boost > 60 || !P.tired, 'やすむと かいふく');
}
// ---- くるまを かりる(運転手が OKの ときだけ) ----
{
  let ok = 0; let no = 0; for (let k = 0; k < 12; k++) { const sim = mk(st(70), 3 + k); const S = sim.state; const P = S.player; const t = S.traffic.find((x) => !x.hostile && !x.dead); tele(sim, t.x + 3, t.z); run(sim, 0.1); if (!S.nearby || S.nearby.kind !== 'tcar') continue; sim.interact(); if (P.mode === 'veh') { ok++; assert.equal(S.lv, 0); } else { no++; assert.ok(t.denied && S.lv === 0); sim.interact(); assert.ok(P.mode === 'veh' && S.lv === 1, 'ぬすむと ★1'); } }
  assert.ok(ok > 0 && no > 0, `OK(${ok})と だめ(${no})の りょうほうが ある`);
}
// ---- ヘリ・せんとうきを うって たおせる ----
{
  const sim = mk(); const S = sim.state; const P = S.player; sim.raise(5); sim.step(0.05); for (let i = 0; i < 60; i++) { S.huntT = 0; sim.step(0.05); P.hp = P.hpMax; P.invuln = 5; } assert.ok(S.helis.length >= 1 && S.jets.length >= 1, 'ヘリ・せんとうきが いる');
  const h = S.helis[0]; const hp0 = h.hp; P.weapon = 'assault'; if (!S.wOwned.includes('assault')) S.wOwned.push('assault'); sim.ammoOf('assault').mag = 30;
  h.x = P.x + 30; h.z = P.z; h.y = 24; P.camYaw = Math.PI / 2; P.yaw = Math.PI / 2; P.camFree = true; P.aimPitch = Math.atan2(24 - 1.6, 30); sim.input.gun = true; for (let i = 0; i < 40; i++) { h.x = P.x + 30; h.z = P.z; h.y = 24; P.camYaw = Math.PI / 2; P.aimPitch = Math.atan2(24 - 1.6, 30); P.wCd = 0; P.invuln = 5; sim.step(0.05); if (!S.helis.includes(h)) break; } sim.input.gun = false;
  assert.ok(h.hp < hp0 || !S.helis.includes(h), 'ヘリに あたる'); 
  const j = S.jets[0]; const coins0 = P.coins; for (let i = 0; i < 12 && S.jets.includes(j); i++) { j.hp = 1; j.x = P.x + 30; j.z = P.z; j.y = 24; P.camYaw = Math.PI / 2; P.aimPitch = Math.atan2(24 - 1.6, 30); P.wCd = 0; sim.input.gun = true; P.invuln = 5; sim.step(0.05); } sim.input.gun = false; assert.ok(!S.jets.includes(j), 'せんとうきを たおせる'); assert.ok(P.coins > coins0, 'おとすと コインが もらえる');
}
// ---- ばっきん・じかんで かいじょ したら けいさつは きえる / ロックオンが ぐるぐる まわらない ----
{
  const sim = mk(); const S = sim.state; const P = S.player; P.coins = 99999; tele(sim, HQ.x, HQ.z); sim.raise(3); for (let i = 0; i < 80; i++) { S.huntT = 0; sim.step(0.05); P.invuln = 5; } assert.ok(S.crooks.some((c) => c.hunter) && S.traffic.some((c) => c.cop), 'けいさつが いる');
  assert.ok(sim.payFine().ok); assert.ok(!S.crooks.some((c) => c.hunter) && !S.traffic.some((c) => c.cop) && S.jets.length === 0 && S.helis.length === 0, 'ばっきんを はらったら けいさつは ぜんいん きえる'); for (let i = 0; i < 60; i++) sim.step(0.05); assert.ok(!S.crooks.some((c) => c.hunter), 'きえた あとも あらわれない');
  const s2 = mk(); const Q = s2.state.player; s2.raise(5); for (let i = 0; i < 40; i++) { s2.state.huntT = 0; s2.step(0.05); Q.invuln = 5; } s2.input.aimLock = true; let maxTurn = 0; let prev = Q.camYaw; for (let i = 0; i < 120; i++) { for (const j of s2.state.jets) { const a = i * 0.9; j.x = Q.x + Math.sin(a) * 6; j.z = Q.z + Math.cos(a) * 6; j.y = 50; } Q.invuln = 5; s2.step(0.05); const d = Math.abs(Math.atan2(Math.sin(Q.camYaw - prev), Math.cos(Q.camYaw - prev))); if (d > maxTurn) maxTurn = d; prev = Q.camYaw; } assert.ok(maxTurn < 0.4, `ロックオンの かいてんは はやすぎない (${maxTurn.toFixed(2)})`);
}
// ---- くるま・バイクが ちゃんと はしっている(たいこうしゃで とまらない) ----
{
  const sim = mk(); const S = sim.state; for (let i = 0; i < 400; i++) sim.step(0.05); const p0 = new Map(S.traffic.map((c) => [c.id, [c.x, c.z]])); for (let i = 0; i < 200; i++) sim.step(0.05);
  const moving = S.traffic.filter((c) => !c.dead && Math.hypot(c.x - p0.get(c.id)[0], c.z - p0.get(c.id)[1]) > 25).length; assert.ok(moving >= S.traffic.length * 0.6, `10びょうで 25m いじょう はしった くるま: ${moving}/${S.traffic.length}`);
}
// ---- オートAIMは ぶきの しゃてい+5m まで ----
{
  const mkT = (wid) => { const sim = mk(); const S = sim.state; const P = S.player; P.weapon = wid; if (!S.wOwned.includes(wid)) S.wOwned.push(wid); const c = S.crooks.find((x) => x.wid === 'joe'); c.state = 'idle'; S.crooks.forEach((x) => { if (x !== c) { x.x = 9999; x.z = 9999; } }); return { sim, S, P, c }; };
  const { sim, S, P, c } = mkT('pistol'); const R = weaponOf('pistol').range; P.camYaw = Math.PI / 2; P.yaw = Math.PI / 2;
  P.x = c.x - (R + 12); P.z = c.z; sim.step(0.05); assert.ok(!S.player.target, 'ハンドガンの しゃてい+5mを こえると オートAIMしない'); P.x = c.x - (R + 3); P.z = c.z; sim.step(0.05); assert.ok(S.player.target && S.player.target.id === c.id, 'しゃてい+5m いないなら ロックできる');
  const t2 = mkT('sniper'); const R2 = weaponOf('sniper').range; assert.ok(R2 > R + 40, 'スナイパーは ながい'); t2.P.camYaw = Math.PI / 2; t2.P.yaw = Math.PI / 2; t2.P.x = t2.c.x - (R2 - 5); t2.P.z = t2.c.z; t2.sim.step(0.05); assert.ok(t2.S.player.target, 'スナイパーは とおくまで ロックできる(ぶきごとに ちがう)');
}
// ---- むずかしい ミッション・かくれキャラ ----
{
  const sim = mk(); const S = sim.state; const P = S.player; const m = CITY_MISSIONS.find((x) => x.id === 'fortress'); const k = CITY_MISSIONS.find((x) => x.id === 'kingpin'); assert.ok(m && k, 'むずかしい ミッションが ある'); tele(sim, m.start.x, m.start.z); run(sim, 0.1); assert.equal(S.nearby && S.nearby.kind, 'mission'); sim.interact(); assert.ok(!S.mission, 'じょうけんが たりないと うけられない');
  S.arrests = { joe: 1, momo: 1 }; S.done = { patrol: 2, gang: 2 }; run(sim, 0.1); sim.interact(); assert.ok(S.mission && S.mission.id === 'fortress' && S.crooks.filter((c) => c.mission).length === 12 && S.mission.timeLeft === 300, 'アジトを おそえ ミッション'); assert.ok(S.crooks.filter((c) => c.mission && c.type === 'boss').length >= 3, 'ボスが いる'); for (let i = 0; i < 20 * 301; i++) { P.invuln = 5; sim.step(0.05); if (!S.mission) break; } assert.ok(!S.mission && !S.done.fortress, 'じかんぎれで しっぱい');
}
// ---- ぜんぶ かうと さいきょうの そうびが かえる ----
{
  const sim = mk(); const S = sim.state; const P = S.player; P.coins = 1e9; assert.ok(!sim.buyEquip('u_suit').ok, 'さいしょは かえない'); const u0 = sim.ultimateProgress(); assert.ok(u0.total > 30 && u0.have < u0.total);
  S.arrests = Object.fromEntries(WANTED.map((w) => [w.id, 3])); S.done = { a: 10, b: 10, c: 10, d: 10, e: 10, f: 10 }; sim.addJobOk(999);
  for (const e of EQUIP) if (!(e.need && e.need.all)) assert.ok(sim.buyEquip(e.id).ok, e.id); assert.ok(!sim.buyEquip('u_suit').ok, 'そうびだけでは まだ'); for (const it of VCAT) if (!S.owned.includes(it.id)) assert.ok(sim.buyVehicle(it.id).ok, it.id);
  const u1 = sim.ultimateProgress(); assert.equal(u1.have, u1.total); assert.ok(!sim.buyEquip('u_suit').ok, 'かくれキャラの しれんを クリアするまで かえない'); tele(sim, SECRET.x, SECRET.z); run(sim, 0.1); assert.equal(S.nearby && S.nearby.kind, 'secret', 'かくれキャラに はなしかけられる'); sim.interact(); assert.ok(S.mission && S.mission.id === 'secret' && S.crooks.filter((c) => c.mission).length === 8, 'かくしミッションが はじまる'); assert.ok(S.mission.timeLeft > 100); S.crooks = S.crooks.filter((c) => !c.mission); run(sim, 0.2); assert.ok(S.done.secret === 1 && !S.mission, 'かくしミッション クリア');
  assert.ok(sim.buyEquip('u_suit').ok && sim.buyEquip('u_boots').ok && sim.buyEquip('u_helm').ok, 'ぜんぶ かって しれんを クリアすると さいきょうが かえる'); assert.ok(S.eq.hp >= 220 && S.eq.def >= 0.6 && S.eq.spd >= 0.75 && S.eq.aim >= 1 && S.eq.acc >= 0.75, 'さいきょうの こうか'); assert.ok(sim.buyWeapon('omega').ok && sim.buyWeapon('tempest').ok && sim.ammoOf('omega').mag === 3, 'さいきょうの ぶきも かえる'); const lowc = mk(); lowc.state.player.coins = 1e7; assert.ok(!lowc.buyWeapon('omega').ok, 'ぜんぶ そろえて かくしミッションを クリアするまで かえない');
}
// ---- オートAIMの ON/OFF・ふっかつで 指名手配が きえる・じたくに かくれる ----
{
  const aa = (auto) => { const sim = mk(); const S = sim.state; const P = S.player; P.weapon = 'pistol'; const c = S.crooks.find((x) => x.wid === 'joe'); c.state = 'idle'; S.crooks.forEach((x) => { if (x !== c) { x.x = 9999; x.z = 9999; } }); P.x = c.x - 30; P.z = c.z; P.camYaw = Math.PI / 2 + 0.3; P.yaw = P.camYaw; sim.input.autoAim = auto; P.noAim = 5; P.wCd = 0; sim.input.gun = true; sim.step(0.05); return Math.abs(P.camYaw - Math.PI / 2); };
  assert.ok(aa(true) < 0.28, 'ONだと てきの ほうへ ひきよせる'); assert.ok(aa(false) > 0.29, 'OFFだと ひきよせない');
  const sim = mk(); const S = sim.state; const P = S.player; tele(sim, HQ.x, HQ.z); sim.raise(3); S.huntT = 0; for (let i = 0; i < 80; i++) { P.invuln = 5; sim.step(0.05); } P.hp = 1; P.invuln = 0; S.bullets.push({ x: P.x, y: 1.2, z: P.z, vx: 0, vy: 0, vz: 0, t: 0, dmg: 99 }); sim.step(0.05); assert.equal(S.lv, 0, 'たおされたら かいじょ'); sim.raise(2); for (let i = 0; i < 70; i++) sim.step(0.05); assert.ok(S.lv >= 0);
  const h = mk(); const HS = h.state; const HP = HS.player; h.raise(3); tele(h, BASE.x, BASE.z); HP.lastHurt = -99; for (let i = 0; i < 20 * 14; i++) { HP.invuln = 5; h.step(0.05); if (HS.lv === 0) break; } assert.equal(HS.lv, 0, 'じたくに かくれて 12びょう じっとすると かいじょ'); assert.ok(!HS.crooks.some((c) => c.hunter), 'かくれている あいだは おってが でない');
  const f = mk(); f.raise(5); tele(f, BASE.x, BASE.z); for (let i = 0; i < 20 * 14; i++) { f.state.player.invuln = 5; f.step(0.05); } assert.equal(f.state.lv, 5, '★5は かくれられない');
}
// ---- パラシュートは ちゃんと おりる・うごける ----
{
  const sim = mk(st(70), 3, { owned: ['hawk'] }); const S = sim.state; const P = S.player; assert.ok(sim.summon('hawk').ok); const v = sim.vehicleOf(); v.y = 250; P.y = 250; for (let i = 0; i < 5; i++) sim.step(0.05); assert.equal(S.nearby && S.nearby.kind, 'exit'); sim.interact(); assert.ok(P.chute && P.mode === 'foot');
  const x0 = P.x; const z0 = P.z; P.camYaw = 1; sim.input.moveY = 1; let t = 0; while (P.chute && t < 60) { sim.step(0.05); t += 0.05; } sim.input.moveY = 0; assert.ok(!P.chute && P.y === 0, 'ちゃくちできる'); assert.ok(t < 30, `250mから 30びょういない (${t.toFixed(1)}びょう)`); assert.ok(Math.hypot(P.x - x0, P.z - z0) > 60, 'スティックで すすめる');
}
// ---- してい手配はんが アイテムを おとす・レアは つよい ----
{
  const sim = mk(); const S = sim.state; const P = S.player; const raresIds = ['kaito', 'tiger', 'oni', 'dragon', 'raven', 'kaiser']; for (const id of raresIds) assert.ok(S.crooks.some((c) => c.wid === id), `${id} が いる`);
  const hpOf = (id) => S.crooks.find((c) => c.wid === id).hpMax; assert.ok(hpOf('kaito') > hpOf('king') * 1.2 && hpOf('dragon') > hpOf('kaito') * 1.5 && hpOf('kaiser') > hpOf('dragon'), 'レアほど つよい');
  const joe = S.crooks.find((c) => c.wid === 'joe'); joe.hp = 1; sim.interact; P.x = joe.x - 20; P.z = joe.z; const before = S.pickups.length; sim.hit ? 0 : 0;
  const kaito = S.crooks.find((c) => c.wid === 'kaito'); P.weapon = 'pistol'; kaito.hp = 1; P.x = kaito.x - 20; P.z = kaito.z; P.camYaw = Math.PI / 2; P.yaw = Math.PI / 2; P.wCd = 0; sim.input.gun = true; for (let i = 0; i < 30 && kaito.state !== 'down'; i++) { P.invuln = 5; P.wCd = 0; P.camYaw = Math.PI / 2; P.aimPitch = 0.05; kaito.x = P.x + 20; kaito.z = P.z; sim.step(0.05); } sim.input.gun = false;
  assert.equal(kaito.state, 'down', 'たおれた'); const drops = S.pickups.filter((p) => p.kind === 'drop'); assert.ok(drops.length >= 3 && drops.some((d) => d.drop.t === 'heal') && drops.some((d) => d.drop.t === 'ammo'), 'おとしもの'); const wp = drops.find((d) => d.drop.t === 'weapon'); const eq = drops.find((d) => d.drop.t === 'equip');
  const got = (d) => { P.x = d.x; P.z = d.z; P.invuln = 5; sim.step(0.05); };
  if (wp) { assert.ok(!S.wOwned.includes(wp.drop.id)); got(wp); assert.ok(S.wOwned.includes(wp.drop.id), 'ぶきを てにいれる'); } if (eq) { got(eq); assert.ok(S.eqOwned.includes(eq.drop.id), 'そうびを てにいれる'); }
  const coins0 = P.coins; for (const d of S.pickups.filter((p) => p.kind === 'drop')) got(d); assert.ok(P.coins > coins0, 'コインも おちる');
}
// ---- せんしゃ・せんとうきは かわないと のれない / ガレージで くるまに のらない / くるまごとの スピード ----
{
  const sim = mk(); const S = sim.state; const P = S.player; const tank = S.vehicles.find((v) => v.id === 'tank'); tele(sim, tank.x + 4, tank.z); run(sim, 0.1); assert.equal(S.nearby && S.nearby.kind, 'lockveh', 'かう まえは 🔒'); sim.interact(); assert.ok(!sim.vehicleOf(), 'のれない'); assert.ok(!sim.summon('tank').ok && !sim.summon('plane').ok, 'ガレージからも のれない');
  P.coins = 99999; assert.ok(!sim.buyVehicle('tank').ok, 'ミッションの じょうけん'); S.done = { patrol: 2 }; assert.ok(sim.buyVehicle('tank').ok && sim.buyVehicle('plane').ok, 'かえる'); assert.ok(sim.summon('tank').ok && sim.vehicleOf().id === 'tank', 'かったら のれる');
  const sim2 = mk(); const S2 = sim2.state; tele(sim2, GARAGE.x, GARAGE.z); run(sim2, 0.1); assert.equal(S2.nearby && S2.nearby.kind, 'garage', 'じたくに はいろうと したら くるまに のらない');
  const sp = (id) => VCAT.find((v) => v.id === id).speed; assert.ok(sp('truck') < sp('sedan') && sp('sedan') < sp('suv') && sp('suv') < sp('sports') && sp('sports') < sp('racer') && sp('scooter') < sp('bike'), 'くるまごとに さいこうそくどが ちがう'); assert.ok(Math.max(...VCAT.filter((v) => v.kind === 'car' || v.kind === 'bike').map((v) => v.speed)) <= 40, 'すこし おそく');
}
// ---- よこに あるいても カメラが かってに まわらない・ひき(10にんで★1) ----
{
  const sim = mk(); const S = sim.state; const P = S.player; P.x = HQ.x; P.z = HQ.z; const fy = freeYaw(P.x, P.z, 40); P.camYaw = fy; P.yaw = fy; P.camFree = false; sim.input.autoAim = false; sim.input.moveX = 1; sim.input.moveY = 0; for (let i = 0; i < 60; i++) { sim.step(0.05); P.x = HQ.x; P.z = HQ.z; } sim.input.moveX = 0; assert.ok(Math.abs(Math.atan2(Math.sin(P.camYaw - fy), Math.cos(P.camYaw - fy))) < 0.01, `カメラが まわらない (${(P.camYaw - fy).toFixed(2)})`);
  const r = mk(); const R = r.state; assert.ok(r.summon('sedan').ok); const rv = r.vehicleOf(); const ws = R.walkers.filter((w) => !(w.dead > 0)).slice(0, 12); R.player.invuln = 99;
  for (let i = 0; i < 12; i++) { const w = ws[i]; rv.speed = 12; w.dead = 0; rv.x = w.x - Math.sin(rv.yaw) * 1.2; rv.z = w.z - Math.cos(rv.yaw) * 1.2; r.step(0.05); if (i === 8) assert.equal(R.lv, 0, '9にん ひいても まだ ★0'); if (i === 9) assert.ok(R.lv >= 1 && R.lv <= 1, '10にん ひくと ★1(それいじょうは あがらない)'); }
  assert.equal(R.lv, 1, 'ひいた だけでは ★1 まで');
}
// ---- ファストトラベル: じたく・トレッサ・こうばん + とうろく3かしょ ----
{
  const sim = mk(st(70), 3, { warps: [{ x: 100, z: 50, name: 'テスト' }, null, null] }); const S = sim.state; const P = S.player; const pl = sim.warpPlaces(); assert.deepEqual(pl.map((x) => x.id), ['home', 'tresa', 'koban']);
  for (const id of ['tresa', 'koban', 'home']) { assert.ok(sim.fastTravel(id).ok, id); const d = pl.find((x) => x.id === id); assert.ok(Math.hypot(P.x - d.x, P.z - d.z) < 130 && !isWater(P.x, P.z) && !insideBuilding(P.x, P.z, 0), `${id} へ とべる`); }
  assert.ok(sim.fastTravel('w0').ok && !sim.fastTravel('w1').ok, 'とうろく ばしょへ・あきスロットは とべない');
  tele(sim, HQ.x, HQ.z); assert.ok(sim.registerWarp(1).ok && S.warps[1] && Math.abs(S.warps[1].x - HQ.x) < 1, 'いまの いちを とうろく'); assert.ok(sim.registerWarp(2).ok); assert.ok(!sim.registerWarp(3).ok, '3かしょまで'); tele(sim, 0, 0); assert.ok(sim.fastTravel('w1').ok && Math.abs(P.x - S.warps[1].x) < 30, 'とうろくへ ワープ'); sim.removeWarp(1); assert.ok(!sim.fastTravel('w1').ok, 'けしたら とべない');
  sim.raise(5); assert.ok(!sim.fastTravel('home').ok, '★5は とべない');
}
// ---- はこにわ(じたくの かぐ・かくちょう) ----
{
  const h = HM.emptyHome(); assert.equal(HM.roomSize(h).w, 6); assert.ok(HM.placeItem(h, 'bed', 0, 0, 0) && !HM.placeItem(h, 'bed', 0, 0, 0), 'ベッドは 1こ だけ'); HM.addFurn(h, 'sofa', 1); assert.ok(!HM.placeItem(h, 'sofa', 1, 1, 0), 'かさなる ばしょには おけない'); assert.ok(HM.placeItem(h, 'sofa', 3, 3, 0)); assert.ok(!HM.placeItem(h, 'plant', 6, 0, 0), 'へやの そとには おけない');
  assert.ok(HM.rotateItem(h, 1) && h.items[1].r === 1, 'まわせる'); assert.ok(HM.moveItem(h, 1, 4, 1) && !HM.moveItem(h, 1, 5, 4), 'うごかせる(はみだし NG)'); assert.ok(HM.storeItem(h, 1) && h.inv.sofa === 2, 'しまえる');
  assert.equal(HM.expand(h, 100), -1, 'おかねが ないと かくちょう できない'); assert.equal(HM.expand(h, 5000), 3000); assert.equal(h.lv, 1); assert.equal(HM.roomSize(h).w, 8); assert.ok(h.houses.includes('c') && HM.setHouse(h, 'c') && !HM.setHouse(h, 'e'), 'かくちょうで あたらしい がいかん');
  assert.equal(HM.buyStyle(h, 'floor', 'tile', 100), -1); assert.equal(HM.buyStyle(h, 'floor', 'tile', 1000), 600); assert.equal(h.floor, 'tile'); assert.equal(HM.buyStyle(h, 'floor', 'wood', 0), 0);
  const n = HM.normalizeHome({ lv: 99, items: [{ id: 'bed', x: 50, y: 0 }, { id: 'zzz', x: 0, y: 0 }, { id: 'sofa', x: 0, y: 0 }], inv: { bed: -1, foo: 2, cat: 2 }, floor: 'x' }); assert.equal(n.lv, 3); assert.equal(n.items.length, 1); assert.deepEqual(n.inv, { cat: 2 }); assert.equal(n.floor, 'wood');
}
// ---- しょくぎょう(けいさつ・SWAT・しょうぼう・きゅうきゅう)・スマホ ----
{
  const sim = mk(); const S = sim.state; const P = S.player; assert.equal(S.job, 'none'); P.x = HQ.x; P.z = HQ.z; assert.ok(!sim.setJob('police').ok, 'じたくの ちかくで えらぶ'); tele(sim, BASE.x, BASE.z); assert.ok(!sim.summon('firetruck').ok, 'しょくぎょうが ないと しょうぼうしゃに のれない');
  assert.ok(sim.setJob('police').ok); const furn0 = Object.values(S.home.inv).reduce((q, n) => q + n, 0); for (let i = 0; i < 20 * 20; i++) { P.invuln = 5; sim.step(0.05); } assert.ok(S.tasks.some((t) => t.type === 'snatch'), 'ひったくりの しごとが でる');
  const t = S.tasks.find((x) => x.type === 'snatch'); const c = S.crooks.find((x) => x.id === t.cid); assert.ok(c && c.task); tele(sim, c.x - 2, c.z); P.invuln = 5; sim.step(0.02); c.x = P.x + 2; c.z = P.z; sim.step(0.02); const coins0 = P.coins; assert.equal(S.nearby && S.nearby.kind, 'arrest', 'けいさつは つかまえられる'); assert.ok(sim.interact()); sim.step(0.1); assert.ok(P.coins > coins0 && !S.tasks.some((x) => x.id === t.id), 'しごと かんりょうで コイン'); assert.ok(Object.values(S.home.inv).reduce((q, n) => q + n, 0) > furn0, 'かぐが もらえる');
  tele(sim, BASE.x, BASE.z); assert.ok(sim.setJob('swat').ok && S.loaned.length >= 3 && S.wOwned.includes('rpg'), 'SWATは ぶきを かりる'); assert.ok(sim.setJob('fire').ok && !S.wOwned.includes('rpg') && S.loaned.length === 0, 'やめると ぶきを かえす');
}
{ // しょうぼう
  const sim = mk(); const S = sim.state; const P = S.player; tele(sim, BASE.x, BASE.z); assert.ok(sim.setJob('fire').ok); S.fireT = 0.1; for (let i = 0; i < 10; i++) { P.invuln = 5; sim.step(0.05); } assert.ok(S.fires.length >= 1, 'かじが おきる'); const f = S.fires[0];
  assert.ok(sim.summon('firetruck').ok && sim.vehicleOf().id === 'firetruck'); const v = sim.vehicleOf(); v.x = f.x - 16; v.z = f.z; v.yaw = Math.PI / 2; P.aimRel = 0; const coins0 = P.coins; sim.input.gun = true; for (let i = 0; i < 20 * 8 && S.fires.includes(f); i++) { P.invuln = 5; v.x = f.x - 16; v.z = f.z; v.yaw = Math.PI / 2; v.speed = 0; sim.step(0.05); } sim.input.gun = false; assert.ok(!S.fires.includes(f), 'みずで かじが きえる'); assert.ok(P.coins > coins0, 'しょうぼうの ほうしゅう');
}
{ // きゅうきゅう
  const sim = mk(); const S = sim.state; const P = S.player; tele(sim, BASE.x, BASE.z); assert.ok(sim.setJob('ems').ok); S.taskT = 0.1; for (let i = 0; i < 10; i++) { P.invuln = 5; sim.step(0.05); } assert.ok(S.patients.length >= 1 && sim.hospitals.length === 3, 'かんじゃ・びょういんは 3かしょ'); const p = S.patients[0];
  assert.ok(!sim.treat(p.id, false).ok && p.state === 'need', 'まちがい'); assert.ok(sim.treat(p.id, true).ok && p.state === 'treated'); assert.ok(sim.summon('ambulance').ok); const v = sim.vehicleOf(); v.x = p.x + 3; v.z = p.z; P.x = v.x; P.z = v.z; P.invuln = 5; sim.step(0.05); sim.step(0.05); assert.equal(p.state, 'loaded', 'きゅうきゅうしゃに のせる');
  const h = sim.hospitals[p.hosp]; v.x = h.x; v.z = h.z; P.x = h.x; P.z = h.z; const coins0 = P.coins; P.invuln = 5; sim.step(0.05); sim.step(0.05); assert.ok(!S.patients.includes(p) && P.coins > coins0, 'びょういんに はこぶと ほうしゅう');
}
{ // スマホ
  const sim = mk(st(70), 3, { owned: [...DEFAULT_OWNED, 'sports'] }); const S = sim.state; const P = S.player; P.coins = 99999; assert.ok(!sim.callVehicle('sports').ok, 'スマホが ないと よべない'); assert.ok(sim.buy('phone').ok && S.hasPhone && !sim.buy('phone').ok, 'スマホを かう'); tele(sim, HQ.x, HQ.z);
  assert.ok(sim.callVehicle('sports').ok && sim.vehicleOf().id === 'sports' && Math.hypot(sim.vehicleOf().x - HQ.x, sim.vehicleOf().z - HQ.z) < 40, 'その場で よべる'); assert.ok(!sim.callVehicle('super').ok, 'もっていない のりものは よべない'); assert.ok(!sim.callVehicle('firetruck').ok, 'しょくぎょうが ちがうと よべない');
}
console.log('OK: city');
