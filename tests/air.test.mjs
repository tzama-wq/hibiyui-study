import assert from 'node:assert/strict';
import { createAir, buildVehicle, partOf, autoLoadout, SLOTS, VEHICLES, MISSIONS, ENEMY, missionById, missionMix, BASE_Z, RARITY_MUL } from '../airsim.js';
import { rngSeed } from '../game.js';

const stats = (v) => ({ SHO: v, PAS: v, SPD: v, DEF: v, STA: v });
const ch = (id, rarity, pos, v = 80) => ({ id, name: id, face: '', rarity, pos, stats: stats(v) });
const kid = stats(60);
function vehicleWith(kind, chars, ks = kid) {
  const lo = autoLoadout(kind, chars); const parts = {};
  for (const [slot, id] of Object.entries(lo)) parts[slot] = partOf(kind, slot, chars.find((c) => c.id === id));
  return buildVehicle({ vehicle: kind, name: 'パイロット', kidStats: ks, parts });
}
const strongChars = [ch('f1', 'legend', 'FW', 110), ch('m1', 'legend', 'MF', 110), ch('d1', 'legend', 'DF', 110), ch('g1', 'super', 'GK', 100), ch('f2', 'super', 'FW', 100), ch('m2', 'rare', 'MF', 90)];

// ---- ぶひん: レアど・ポジションで つよさが かわる / そうびで きたいが つよくなる ----
{
  const c = (r, pos) => partOf('plane', 'gun', ch('x', r, pos, 80));
  assert.ok(c('legend', 'FW').power > c('common', 'FW').power * 1.5, 'レアどが たかい ほど つよい');
  assert.ok(c('rare', 'FW').fit && !c('rare', 'DF').fit && c('rare', 'FW').power > c('rare', 'DF').power, 'ポジションが ぴったりだと つよい');
  assert.ok(SLOTS.plane.length === 5 && SLOTS.ship.length === 5 && SLOTS.tank.length === 5);
  for (const k of Object.keys(VEHICLES)) {
    const bare = buildVehicle({ vehicle: k, kidStats: kid, parts: {} }); const full = vehicleWith(k, strongChars);
    assert.ok(full.hpMax > bare.hpMax * 1.2 && full.gunDps > bare.gunDps * 1.2 && full.speed > bare.speed && full.locks >= bare.locks && full.missiles > bare.missiles, `${k}: ぶひんで つよくなる`);
  }
  const p = vehicleWith('plane', strongChars); const s = vehicleWith('ship', strongChars); const t = vehicleWith('tank', strongChars);
  assert.ok(p.speed > s.speed * 3 && s.hpMax > p.hpMax * 1.5 && t.hpMax > s.hpMax * 0.9, 'ひこうきは はやく ふねと せんしゃは かたい');
  // おまかせ そうび: ぜんぶ ちがう キャラ・ぴったりを えらぶ
  const lo = autoLoadout('plane', strongChars); assert.equal(new Set(Object.values(lo)).size, 5, 'おなじ キャラを 2かいは つかわない'); assert.equal(lo.armor, 'd1', 'そうこうは DF'); assert.equal(lo.missile, 'm1', 'ミサイルは MF');
  // しゅじんこうの のうりょくも きく
  assert.ok(buildVehicle({ vehicle: 'plane', kidStats: stats(100), parts: {} }).gunDps > buildVehicle({ vehicle: 'plane', kidStats: stats(30), parts: {} }).gunDps);
}

// ---- ボット: どの きたいでも ミッションを クリアできる ----
function fly(V, mission, { seed = 1, gentle = false, seconds = 420 } = {}) {
  const sim = createAir({ vehicle: V, mission, rnd: rngSeed(seed), gentle }); const S = sim.state; const P = S.player; let t = 0;
  while (!S.done && t < seconds) {
    const near = S.enemies.slice().sort((a, b) => Math.hypot(a.x - P.x, a.y - P.y, a.z - P.z) - Math.hypot(b.x - P.x, b.y - P.y, b.z - P.z))[0];
    if (V.vehicle === 'plane') {
      if (near) { let dy = Math.atan2(near.x - P.x, near.z - P.z) - P.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI; sim.input.turn = Math.max(-1, Math.min(1, dy * 2.2)); const hd = Math.hypot(near.x - P.x, near.z - P.z); const ty = near.dom === 'air' ? near.y : Math.max(near.y, P.y - 0.25 * hd, 90); sim.input.climb = Math.max(-1, Math.min(1, (Math.atan2(ty - P.y, hd) - P.pitch) * 3)); sim.input.gun = true; }
      else { sim.input.turn = Math.max(-1, Math.min(1, Math.atan2(-P.x, BASE_Z - P.z + 600) - P.yaw)); sim.input.climb = (260 - P.y) * 0.01; sim.input.gun = false; }
    } else {
      // ふね・せんしゃ: いちばん ちかい てきの ほうへ むかう(うちおとせる きょりに はいったら とまる)
      if (near) { let dy = Math.atan2(near.x - P.x, near.z - P.z) - P.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI; sim.input.turn = Math.max(-1, Math.min(1, dy * 2)); sim.input.climb = S.target ? 0.15 : Math.abs(dy) < 1.2 ? 1 : 0.2; }
      else { sim.input.turn = 0; sim.input.climb = 0; }
      if (S.target) sim.aimAt(S.target); sim.input.gun = !!S.target;
    }
    if (P.lockTarget.length) sim.fireMissile();
    if (Math.floor(t * 4) % 36 === 0) sim.evade();
    sim.step(1 / 30); t += 1 / 30;
  }
  return { S, sim, t };
}
{
  const report = {};
  for (const kind of Object.keys(VEHICLES)) {
    const V = vehicleWith(kind, strongChars, stats(70));
    for (const mis of MISSIONS) {
      const wins = [1, 2, 3].map((seed) => fly(V, mis, { seed }).S.win).filter(Boolean).length; report[`${kind}:${mis.id}`] = wins;
      assert.ok(wins >= 2, `${kind} で ${mis.id} を クリアできる (3かい中 ${wins})`);
    }
  }
  console.log('  ボット クリアりつ(3かい中):', JSON.stringify(report));
  // よわい そうびだと きびしい(ボスは とくに)/ やさしい モードは そうこうが あつい
  const weak = buildVehicle({ vehicle: 'tank', kidStats: stats(30), parts: {} }); const strong = vehicleWith('tank', strongChars, stats(70));
  const w = fly(weak, missionById('m6'), { seed: 4 }); const s2 = fly(strong, missionById('m6'), { seed: 4 }); assert.ok(s2.S.win && (!w.S.win || w.S.base.hp < s2.S.base.hp), 'よわい そうびは くろうする');
  const g = createAir({ vehicle: strong, mission: missionById('m1'), gentle: true }); const n = createAir({ vehicle: strong, mission: missionById('m1') }); assert.ok(g.state.player.hpMax > n.state.player.hpMax);
  // ミッションごとに てきの しゅるいが ちがう(あいしょうの ヒント)
  const mixes = MISSIONS.map(missionMix); assert.ok(mixes.some((m) => m.sea > m.air) && mixes.some((m) => m.ground >= 4) && mixes.some((m) => m.air > m.sea + m.ground), 'くう・うみ・りく それぞれ ちがう ミッション');
  for (const mis of MISSIONS) assert.ok(Object.keys(mis.reward).length && mis.waves.length && mis.baseHp > 0);
}
// ---- あいしょう: せんしゃは くうに よわく、ふねは うみに つよい ----
{
  const dmg = (kind, dom) => { const V = vehicleWith(kind, strongChars, stats(70)); const sim = createAir({ vehicle: V, mission: missionById('m1'), rnd: rngSeed(9) }); const S = sim.state; const P = S.player; sim.step(1 / 30);
    const type = dom === 'air' ? 'drone' : dom === 'sea' ? 'boat' : 'etank'; const e = { id: 777, type, dom, x: P.x + 20, y: dom === 'air' ? P.y : 0, z: P.z + 120, yaw: 0, pitch: 0, hp: 100000, hpMax: 100000, speed: 0, cd: 99, target: 'base', t: 0, ph: 0, orbit: 1, stop: true, stopR: 0 };
    S.enemies = [e]; S.waveI = 99; sim.input.gun = true; if (kind === 'plane') { P.yaw = Math.atan2(e.x - P.x, e.z - P.z); } for (let i = 0; i < 30; i++) { e.speed = 0; if (kind !== 'plane') sim.aimAt(e); sim.step(1 / 30); } return 100000 - e.hp; };
  assert.ok(dmg('tank', 'ground') > dmg('tank', 'air') * 2.5, 'せんしゃは りくに つよく くうに よわい'); assert.ok(dmg('ship', 'sea') > dmg('ship', 'air') * 2.5, 'ふねは うみに つよく くうに よわい');
  assert.ok(dmg('plane', 'air') > dmg('tank', 'air') * 1.5, 'ひこうきは くうに つよい');
}
// ---- ルール: かいひで むてき・きちが こわれたら しっぱい・ふねは しまに のりあげない・せんしゃは しまから でない ----
{
  const V = vehicleWith('plane', strongChars); const sim = createAir({ vehicle: V, mission: missionById('m1'), rnd: rngSeed(5) }); const S = sim.state;
  for (let i = 0; i < 90; i++) sim.step(1 / 30);
  assert.ok(sim.evade()); assert.ok(S.player.invuln > 0); const hp = S.player.hp; S.bullets.push({ x: S.player.x, y: S.player.y, z: S.player.z, vx: 0, vy: 0, vz: 0, t: 0, dmg: 50, own: 'e' }); sim.step(1 / 30); assert.equal(S.player.hp, hp, 'かいひ中は ダメージなし');
  S.base.hp = 1; S.enemies.push({ id: 9999, type: 'drone', dom: 'air', x: 0, y: 40, z: BASE_Z + 20, yaw: Math.PI, pitch: 0, hp: 20, hpMax: 20, speed: 60, cd: 1, target: 'base', t: 0, ph: 0, orbit: 1 });
  for (let i = 0; i < 30 && !S.done; i++) sim.step(1 / 30); assert.ok(S.done && !S.win && S.base.hp === 0, 'きちが こわれたら しっぱい');
  for (const kind of ['ship', 'tank']) {
    const T = createAir({ vehicle: vehicleWith(kind, strongChars), mission: missionById('m1'), rnd: rngSeed(6) }); const TS = T.state; T.input.climb = 1; T.input.turn = 0.3;
    for (let i = 0; i < 1500; i++) { T.step(1 / 30); const r = Math.hypot(TS.player.x, TS.player.z - BASE_Z); if (kind === 'tank') assert.ok(r <= 660, 'せんしゃは しまの なか'); else assert.ok(r >= 700, 'ふねは うみの うえ'); if (TS.done) break; }
  }
}
// ---- ふね・せんしゃは じぶんで ねらう: ねらいが ずれていると あたらない ----
{
  for (const kind of ['ship', 'tank']) {
    const V = vehicleWith(kind, strongChars, stats(70)); const sim = createAir({ vehicle: V, mission: missionById('m1'), rnd: rngSeed(3) }); const S = sim.state; const P = S.player; sim.step(1 / 30);
    const e = { id: 555, type: 'boat', dom: 'sea', x: P.x + 10, y: 0, z: P.z + 200, yaw: 0, pitch: 0, hp: 100000, hpMax: 100000, speed: 0, cd: 99, target: 'base', t: 0, ph: 0, orbit: 1, stop: true, stopR: 0 };
    S.enemies = [e]; S.waveI = 99; sim.input.gun = true; P.yaw = 0; P.aimRel = 1.2; for (let i = 0; i < 30; i++) { e.speed = 0; sim.step(1 / 30); } assert.equal(e.hp, 100000, `${kind}: ねらいが ずれていると あたらない`);
    sim.aimAt(e); for (let i = 0; i < 30; i++) { e.speed = 0; sim.step(1 / 30); } assert.ok(e.hp < 100000, `${kind}: ねらうと あたる`);
    sim.input.aimX = 1; const r0 = P.aimRel; sim.step(1 / 30); assert.ok(P.aimRel > r0, 'ドラッグで ねらいが うごく');
  }
}
// ---- ふたりで あそぶ: きょうりょく(おなじ てきと たたかう)・たいせん(おたがいの きたいを ねらう) ----
function drive(sim, P, foes, enemyOf = null) {
  const near = foes.slice().sort((a, b) => Math.hypot(a.x - P.x, a.y - P.y, a.z - P.z) - Math.hypot(b.x - P.x, b.y - P.y, b.z - P.z))[0]; const inp = P.input; if (P.dead) return;
  if (P.kind === 'plane') {
    if (near) { let dy = Math.atan2(near.x - P.x, near.z - P.z) - P.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI; inp.turn = Math.max(-1, Math.min(1, dy * 2.2)); const hd = Math.hypot(near.x - P.x, near.z - P.z); const ty = near.dom === 'air' ? near.y : Math.max(near.y, P.y - 0.25 * hd, 90); inp.climb = Math.max(-1, Math.min(1, (Math.atan2(ty - P.y, hd) - P.pitch) * 3)); inp.gun = true; }
    else { inp.turn = Math.max(-1, Math.min(1, Math.atan2(-P.x, BASE_Z - P.z + 600) - P.yaw)); inp.climb = (260 - P.y) * 0.01; inp.gun = false; }
  } else {
    if (near) { let dy = Math.atan2(near.x - P.x, near.z - P.z) - P.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI; inp.turn = Math.max(-1, Math.min(1, dy * 2)); inp.climb = P.target ? 0.15 : Math.abs(dy) < 1.2 ? 1 : 0.2; } else { inp.turn = 0; inp.climb = 0; }
    if (P.target) sim.aimAt(P.target, P.i); inp.gun = !!P.target;
  }
  if (P.lockTarget.length) sim.fireMissile(P.i);
}
{
  const V1 = vehicleWith('plane', strongChars, stats(70)); const V2 = vehicleWith('tank', strongChars.slice().reverse(), stats(60));
  for (const mis of [missionById('m1'), missionById('m4'), missionById('m6')]) {
    let wins = 0;
    for (const seed of [1, 2, 3]) {
      const sim = createAir({ vehicle: V1, extra: [V2], mission: mis, rnd: rngSeed(seed) }); const S = sim.state; assert.equal(S.players.length, 2);
      let t = 0; while (!S.done && t < 420) { for (const P of S.players) drive(sim, P, S.enemies); sim.step(1 / 30); t += 1 / 30; } if (S.win) wins++;
    }
    assert.ok(wins >= 2, `ふたりで ${mis.id} を クリアできる (${wins}/3)`);
  }
  // ひとりが やられても もうひとりが のこって いれば つづく / ふたりとも やられたら しっぱい
  const sim = createAir({ vehicle: V1, extra: [V2], mission: missionById('m1'), rnd: rngSeed(8) }); const S = sim.state; sim.step(1 / 30); S.players[1].hp = 1; S.players[1].invuln = 0;
  S.bullets.push({ x: S.players[1].x, y: S.players[1].y + 4, z: S.players[1].z, vx: 0, vy: 0, vz: 0, t: 0, dmg: 50, own: 'e' }); sim.step(1 / 30);
  assert.ok(S.players[1].dead && !S.done, 'ひとり やられても ミッションは つづく');
  S.players[0].hp = 1; S.players[0].invuln = 0; S.bullets.push({ x: S.players[0].x, y: S.players[0].y, z: S.players[0].z, vx: 0, vy: 0, vz: 0, t: 0, dmg: 99, own: 'e' }); sim.step(1 / 30);
  assert.ok(S.done && !S.win, 'ふたりとも やられたら しっぱい');
  // たいせん: どの くみあわせでも しょうぶが つく
  const pairs = [['plane', 'plane'], ['plane', 'tank'], ['ship', 'tank'], ['ship', 'plane'], ['tank', 'tank'], ['ship', 'ship']]; const rep = {};
  for (const [a, b] of pairs) {
    const sim2 = createAir({ vehicle: vehicleWith(a, strongChars, stats(70)), extra: [vehicleWith(b, strongChars, stats(70))], pvp: true, rnd: rngSeed(4) }); const S2 = sim2.state; let tt = 0;
    while (!S2.done && tt < 400) { const [p0, p1] = S2.players; drive(sim2, p0, [p1.foe]); drive(sim2, p1, [p0.foe]); sim2.step(1 / 30); tt += 1 / 30; }
    rep[`${a}-${b}`] = S2.done ? `${S2.winner}@${Math.round(tt)}s` : 'draw'; assert.ok(S2.done && (S2.winner === 0 || S2.winner === 1), `たいせん ${a} vs ${b} で しょうぶが つく`);
  }
  console.log('  たいせん(かち:0/1 @じかん):', JSON.stringify(rep));
}
console.log('OK: air');
