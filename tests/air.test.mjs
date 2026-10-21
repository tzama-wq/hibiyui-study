import assert from 'node:assert/strict';
import { createAir, machineOf, MISSIONS, TIERS, ROLES, missionById, BASE_Z } from '../airsim.js';
import { rngSeed } from '../game.js';

const stats = (v) => ({ SHO: v, PAS: v, SPD: v, DEF: v, STA: v });
const mk = (v, rarity = 'rare', pos = 'FW') => machineOf({ id: `m${v}${rarity}${pos}`, name: 'パイロット', rarity, pos, stats: stats(v) });

// ---- きたい: レアどが たかい ほど つよい / ポジションで やくわりが ちがう ----
{
  const r = ['common', 'uncommon', 'rare', 'super', 'legend', 'diamond'].map((x) => mk(80, x));
  for (let i = 1; i < r.length; i++) assert.ok(r[i].rating > r[i - 1].rating && r[i].hpMax > r[i - 1].hpMax, `${r[i].rarity} のほうが つよい`);
  assert.ok(r[4].missiles > r[0].missiles && r[4].locks > r[0].locks);
  const fw = mk(80, 'rare', 'FW'); const mf = mk(80, 'rare', 'MF'); const df = mk(80, 'rare', 'DF'); const gk = mk(80, 'rare', 'GK');
  assert.ok(fw.missiles > df.missiles, 'FWは ミサイルが おおい'); assert.ok(mf.lockTime < fw.lockTime && mf.locks > fw.locks, 'MFは ロックが はやく おおい'); assert.ok(df.hpMax > fw.hpMax * 1.3, 'DFは そうこうが あつい'); assert.ok(gk.intercept && df.baseGuard);
  assert.ok(mk(120).gunDps > mk(40).gunDps && mk(120).speed > mk(40).speed && mk(120).boostMax > mk(40).boostMax, 'のうりょくが そのまま きたいに');
}

// ---- ボット(まえに むかって うつ)で ミッションを あそぶ ----
function fly(m, mission, { seed = 1, gentle = false, seconds = 300 } = {}) {
  const sim = createAir({ machine: m, wings: [mk(70), mk(60)], mission, rnd: rngSeed(seed), gentle });
  const S = sim.state; const P = S.player; let t = 0;
  while (!S.done && t < seconds) {
    // いちばん ちかい てきの ほうへ むく
    let tg = S.enemies.slice().sort((a, b) => Math.hypot(a.x - P.x, a.y - P.y, a.z - P.z) - Math.hypot(b.x - P.x, b.y - P.y, b.z - P.z))[0];
    if (tg) {
      const want = Math.atan2(tg.x - P.x, tg.z - P.z); let dy = want - P.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
      sim.input.turn = Math.max(-1, Math.min(1, dy * 2.2));
      const wantP = Math.atan2(tg.y - P.y, Math.hypot(tg.x - P.x, tg.z - P.z)); sim.input.climb = Math.max(-1, Math.min(1, (wantP - P.pitch) * 3));
      sim.input.gun = true;
    } else { const want = Math.atan2(-P.x, BASE_Z - P.z + 600); let dy = want - P.yaw; sim.input.turn = Math.max(-1, Math.min(1, dy)); sim.input.climb = (260 - P.y) * 0.01; sim.input.gun = false; }
    if (S.player.lockTarget.length) sim.fireMissile();
    if (Math.floor(t * 4) % 40 === 0) sim.evade();
    sim.step(1 / 30); t += 1 / 30;
  }
  return { S, sim, t };
}
{
  // つよい きたいで ぜんミッションを クリアできる
  for (const mis of MISSIONS) {
    const r = fly(mk(110, 'legend', 'FW'), mis, { seed: 3 }); assert.ok(r.S.done && r.S.win, `${mis.id} を クリア (${r.S.ph} ${r.t.toFixed(0)}s hp ${Math.round(r.S.player.hp)} base ${Math.round(r.S.base.hp)})`);
    assert.ok(r.S.kills >= 3 && r.S.stars >= 1);
  }
  // よわい きたいは おそらく ボスで まける / おなじ ミッションでも ちがいが でる
  const weak = fly(mk(30, 'common', 'FW'), missionById('m5'), { seed: 4, gentle: false }); const strong = fly(mk(110, 'legend', 'FW'), missionById('m5'), { seed: 4 });
  assert.ok(strong.S.win); assert.ok(!weak.S.win || weak.t > strong.t, 'よわい きたいは くろうする');
  // やさしい もーど(gentle)は そうこうが あつい
  const g = createAir({ machine: mk(60), mission: missionById('m1'), gentle: true }); const n = createAir({ machine: mk(60), mission: missionById('m1') }); assert.ok(g.state.player.hpMax > n.state.player.hpMax);
  // ぜんぶの ミッションに ほうしゅうが ある
  for (const mis of MISSIONS) assert.ok(Object.keys(mis.reward).length && mis.waves.length && mis.baseHp > 0);
}
// ---- ルール: ミサイルは ロックしてから・かいひで むてき・きちが こわれたら しっぱい ----
{
  const sim = createAir({ machine: mk(80), mission: missionById('m1'), rnd: rngSeed(5) }); const S = sim.state;
  for (let i = 0; i < 90; i++) sim.step(1 / 30);
  assert.ok(sim.evade()); assert.ok(S.player.invuln > 0); const hp = S.player.hp; S.bullets.push({ x: S.player.x, y: S.player.y, z: S.player.z, vx: 0, vy: 0, vz: 0, t: 0, dmg: 50, own: 'e' }); sim.step(1 / 30); assert.equal(S.player.hp, hp, 'かいひ中は ダメージなし');
  S.base.hp = 1; S.enemies.push({ id: 9999, type: 'drone', x: 0, y: 40, z: BASE_Z + 20, yaw: Math.PI, pitch: 0, hp: 20, hpMax: 20, speed: 60, cd: 1, target: 'base', t: 0, ph: 0, orbit: 1 });
  for (let i = 0; i < 30 && !S.done; i++) sim.step(1 / 30); assert.ok(S.done && !S.win && S.base.hp === 0, 'きちが こわれたら しっぱい');
}
console.log('OK: air');
