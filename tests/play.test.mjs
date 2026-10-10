import assert from 'node:assert/strict';
import { createPlay, FIELD, formationPos } from '../playsim.js';
import { cpuTeamAt, rngSeed, FORMATIONS } from '../game.js';

const mk = (power, f = '442', seed = 1) => cpuTeamAt(power, `T${power}`, rngSeed(seed), f);

// ---- かたち ----
for (const f of FORMATIONS) {
  const t = mk(60, f.id).team; const pos = formationPos(t);
  assert.equal(pos.length, 11); pos.forEach((p) => assert.ok(p.ax >= 0 && p.ax <= 1 && p.ay > 0 && p.ay < 1));
}

// ---- フルタイムまで うごく(にんげんは ランダムに そうさ) ----
for (const [pa, pb, seed] of [[60, 60, 11], [90, 60, 12], [60, 120, 13]]) {
  const rnd = rngSeed(seed);
  const sim = createPlay({ me: mk(pa, '442', 1), opp: mk(pb, '433', 2), halfSec: 60, rnd });
  let t = 0; let maxOut = 0; const phs = new Set();
  const acts = ['pass', 'shoot', 'lob', 'tackle', 'switch'];
  while (!sim.state.done && t < 60 * 60) {
    if (Math.floor(t * 10) % 7 === 0) { sim.input.mx = rnd() * 2 - 1; sim.input.mz = rnd() * 2 - 1; sim.input.sprint = rnd() < 0.5; }
    if (rnd() < 0.04) { const a = acts[Math.floor(rnd() * acts.length)]; sim.press(a); if (a === 'shoot') setTimeout(() => {}, 0); if (a === 'shoot' && rnd() < 0.8) sim.release('shoot'); }
    sim.step(1 / 30); t += 1 / 30; phs.add(sim.state.ph);
    const b = sim.ball;
    for (const k of ['x', 'y', 'z']) assert.ok(Number.isFinite(b[k]), `ボールが ${k} で おかしい`);
    assert.ok(b.y < 40, 'ボールが たかすぎる');
    maxOut = Math.max(maxOut, Math.abs(b.x) - FIELD.L / 2, Math.abs(b.z) - FIELD.W / 2);
    for (const s of ['a', 'b']) for (const p of sim.players[s]) { assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z), 'せんしゅの ざひょう'); assert.ok(Math.abs(p.x) < 60 && Math.abs(p.z) < 40, 'せんしゅが そとに でない'); }
  }
  assert.ok(sim.state.done, `しあいが おわる (${t.toFixed(0)}びょう)`);
  assert.ok(sim.state.score.a + sim.state.score.b <= 20, 'ゴールが おおすぎない');
  assert.ok(maxOut < 25, `ボールが とおくへ いかない (${maxOut.toFixed(1)})`);
  assert.ok(phs.has('play') && phs.has('half'), 'ハーフタイムが ある');
  assert.ok(sim.state.poss.a > 1 && sim.state.poss.b > 1, 'りょうほうが ボールを もつ');
}

// ---- CPU どうしの しあい(にんげんは なにも しない): ゴール・コーナー・スローイン などが おきる ----
{
  let goals = 0; let throws = 0; let dead = new Set(); const N = 6;
  for (let g = 0; g < N; g++) {
    const sim = createPlay({ me: mk(70, '442', 3 + g), opp: mk(70, '442', 40 + g), halfSec: 90, rnd: rngSeed(100 + g) });
    // かんぜんに ほうち。ただし a の せんしゅも AI で うごかすために ctrl の にんげんは ボールを もったら まえへ はしる
    let t = 0;
    while (!sim.state.done && t < 400) {
      const p = sim.ctrlP();
      if (p && sim.ball.owner === p) { sim.input.mx = 1; sim.input.mz = -p.z / 30; sim.input.sprint = true; if (p.x > 28) { sim.press('shoot'); sim.release('shoot'); } }
      else { sim.input.mx = (sim.ball.x - p.x) / 10; sim.input.mz = (sim.ball.z - p.z) / 10; sim.input.sprint = true; }
      sim.step(1 / 30); t += 1 / 30;
      if (sim.state.restart) dead.add(sim.state.restart.type);
    }
    goals += sim.state.score.a + sim.state.score.b;
    assert.ok(sim.state.done);
    assert.ok(sim.state.events.every((e) => e.type === 'goal'));
    void throws;
  }
  assert.ok(goals > 0, `ゴールが うまれる (${goals})`);
  assert.ok(dead.size >= 2, `リスタートが おきる (${[...dead].join(',')})`);
}

// ---- にんげんが シュートすると ボールが ゴールの ほうへ とぶ ----
{
  const sim = createPlay({ me: mk(80, '442', 5), opp: mk(40, '442', 6), halfSec: 60, rnd: rngSeed(7) });
  // キックオフを まつ
  for (let i = 0; i < 100; i++) sim.step(1 / 30);
  assert.equal(sim.state.ph, 'play');
  const p = sim.ctrlP(); sim.ball.owner = p; p.x = 40; p.z = 2; p.dir = 0; sim.ball.x = 40.6; sim.ball.z = 2;
  sim.press('shoot'); sim.step(1 / 30); for (let i = 0; i < 15; i++) sim.step(1 / 30); sim.release('shoot'); sim.step(1 / 30);
  assert.ok(sim.ball.vx > 8 || sim.state.shots.a > 0, 'シュートが うたれた');
  assert.equal(sim.state.shots.a, 1);
}

// ---- パス: ボールが みかたへ いく / オフサイド ----
{
  const sim = createPlay({ me: mk(80, '442', 5), opp: mk(60, '442', 6), halfSec: 60, rnd: rngSeed(8) });
  for (let i = 0; i < 100; i++) sim.step(1 / 30);
  const p = sim.ctrlP(); sim.ball.owner = p; p.x = 0; p.z = 0; p.dir = 0; sim.ball.x = 0.6;
  sim.input.mx = 1; sim.input.mz = 0; sim.press('pass'); sim.step(1 / 30);
  assert.ok(!sim.ball.owner && sim.ball.vx > 5, 'パスが でた');
  // オフサイド: あいての うしろ(はんぶんより さき)に いる みかたへ パス
  const sim2 = createPlay({ me: mk(80, '442', 5), opp: mk(60, '442', 6), halfSec: 60, rnd: rngSeed(9) });
  for (let i = 0; i < 100; i++) sim2.step(1 / 30);
  const q = sim2.players.a.filter((x) => x.slot === 'FW')[1]; const h = sim2.players.a.find((x) => x.slot === 'MF'); sim2.state.ctrl = h.idx;
  const line = Math.max(...sim2.players.b.map((x) => -x.x)) * -1; void line;
  for (const o of sim2.players.b) if (o.slot !== 'GK') { o.x = 30; o.tx = 30; o.vx = 0; } // ラインを 30mに
  sim2.players.b.find((x) => x.slot === 'GK').x = 50;
  for (const o of sim2.players.a) if (o !== q && o !== h) { o.x = -30; o.tx = -30; o.z = 25; o.tz = 25; }
  h.x = 33; h.z = 0; sim2.ball.owner = h; sim2.ball.x = 33.6; q.x = 44; q.z = 0; q.tx = 44; q.tz = 0; q.vx = 0;
  sim2.input.mx = 1; sim2.press('pass'); // うけ手は FW
  let called = false; for (let i = 0; i < 200 && !called; i++) { q.tx = 44; q.tz = 0; q.x = Math.min(q.x, 44.5); sim2.step(1 / 30); if (sim2.state.offsides.a > 0) called = true; }
  assert.ok(called || sim2.state.ph !== 'play', 'オフサイドの ほうへ パスすると ふえきが なる (または ほかの リスタート)');
}

// ---- ルール(IFAB): アウト・ペナルティ・かんせつFK・オフサイドの れいがい・たいじょう ----
{
  const mkSim = (seed = 1, opts = {}) => { const sim = createPlay({ me: mk(80, '442', 5), opp: mk(60, '442', 6), halfSec: 60, rnd: rngSeed(seed), ...opts }); for (let i = 0; i < 100; i++) sim.step(1 / 30); return sim; };
  // ドリブルで タッチラインを でる → あいての スローイン
  { const sim = mkSim(1); const p = sim.players.a.find((x) => x.slot === 'MF'); sim.ball.owner = p; p.x = 10; p.z = 33.5; p.dir = Math.PI / 2; p.vz = 6; sim.state.ctrl = p.idx; sim.input.mx = 0; sim.input.mz = 1;
    for (let i = 0; i < 40 && sim.state.ph === 'play'; i++) sim.step(1 / 30);
    assert.equal(sim.state.restart.type, 'throw'); assert.equal(sim.state.restart.side, 'b', 'ボールを もっていた a が でたので b の スローイン'); assert.ok(Math.abs(sim.state.restart.z) > 33.9); }
  // ゴールラインを でる: まもりが さいごに さわれば コーナー、こうげきが さいごなら ゴールキック
  { const sim = mkSim(2); const d = sim.players.b.find((x) => x.slot === 'DF'); sim.ball.owner = null; sim.ball.x = 53.2; sim.ball.z = 15; sim.ball.vx = 2; sim.ball.vz = 0; sim.ball.lastSide = 'b'; sim.ball.lastP = d; sim._out();
    assert.equal(sim.state.restart.type, 'corner'); assert.equal(sim.state.restart.side, 'a');
    const defs = sim.players.b.filter((x) => x.slot !== 'GK'); for (const q of defs) assert.ok(Math.hypot(q.x - sim.state.restart.x, q.z - sim.state.restart.z) > 9, 'コーナーは 9.15m はなれる'); }
  { const sim = mkSim(3); sim.ball.owner = null; sim.ball.x = 53.4; sim.ball.z = 10; sim.ball.lastSide = 'a'; sim._out(); assert.equal(sim.state.restart.type, 'goalkick'); assert.equal(sim.state.restart.side, 'b');
    for (const q of sim.players.a.filter((x) => x.slot !== 'GK')) assert.ok(!(q.x > 52.5 - 16.5 && Math.abs(q.z) < 20.2), 'ゴールキックの とき あいては エリアの そと'); }
  // ペナルティ: まもる チームの エリアの なかの ファウル
  { const sim = mkSim(4); const c = sim.players.a.find((x) => x.slot === 'FW'); const d = sim.players.b.find((x) => x.slot === 'DF'); c.x = 46; c.z = 4; d.x = 45; d.z = 4; c.dir = 0;
    sim._foul(d, c, 0); assert.equal(sim.state.restart.type, 'penalty'); assert.equal(sim.state.restart.side, 'a'); assert.ok(Math.abs(sim.ball.x - 41.5) < 1.2, 'ペナルティマークは ゴールから 11m');
    for (const q of [...sim.players.a, ...sim.players.b]) { if (q === sim.state.restart.taker || q.slot === 'GK' || q.off) continue; assert.ok(Math.hypot(q.x - sim.ball.x, q.z - sim.ball.z) >= 9.1 && !(q.x > 52.5 - 16.5 && Math.abs(q.z) < 20.2), 'ペナルティの とき ほかの 人は エリアの そと'); }
    const gk = sim.players.b.find((x) => x.slot === 'GK'); assert.ok(gk.x > 51 && Math.abs(gk.z) < 0.5, 'キーパーは ゴールラインの まんなか');
    for (let i = 0; i < 120 && sim.state.ph !== 'play'; i++) sim.step(1 / 30); sim.step(1 / 30);
    const tk = sim.state.restart.taker; sim.state.ctrl = tk.idx; sim.input.mz = 0.5; sim.press('shoot'); sim.step(1 / 30); sim.release('shoot'); sim.step(1 / 30); assert.ok(sim.state.shots.a >= 1 && sim.ball.pen, 'ペナルティを うった'); }
  // ふつうの エリアの そとの ファウルは ちょくせつ フリーキック(かべが できる)
  { const sim = mkSim(5); const c = sim.players.a.find((x) => x.slot === 'FW'); const d = sim.players.b.find((x) => x.slot === 'DF'); c.x = 30; c.z = 3; d.x = 29; d.z = 3; c.dir = 0; sim._foul(d, c, 0); assert.equal(sim.state.restart.type, 'free');
    const wall = sim.players.b.filter((q) => q.slot !== 'GK' && Math.hypot(q.x - sim.ball.x, q.z - sim.ball.z) < 10.5); assert.ok(wall.length >= 3, 'かべが 3にん いじょう'); assert.ok(wall.every((q) => Math.hypot(q.x - sim.ball.x, q.z - sim.ball.z) >= 9.1), 'かべは 9.15m'); }
  // かんせつ フリーキックは そのまま ゴールに はいっても ノーゴール
  { const sim = mkSim(6); sim._dead({ type: 'free', side: 'a', x: 40, z: 0, offside: true }, 'x'); assert.ok(sim.ball.indirectBy, 'かんせつ');
    sim.ball.owner = null; sim.ball.x = 52.6; sim.ball.z = 0; sim.ball.y = 1; sim.ball.vx = 10; sim.ball.vz = 0; sim.ball.lastSide = 'a'; sim.ball.lastP = sim.ball.indirectBy; sim.state.ph = 'play';
    sim.step(1 / 30); assert.equal(sim.state.score.a, 0, 'ノーゴール'); assert.equal(sim.state.restart.type, 'goalkick'); }
  // スローインから うけても オフサイドに ならない
  { const sim = mkSim(7); const r = sim.players.a.filter((x) => x.slot === 'FW')[1];
    for (const o of sim.players.b) if (o.slot !== 'GK') { o.x = 20; o.tx = 20; } sim.players.b.find((x) => x.slot === 'GK').x = 50;
    sim._dead({ type: 'throw', side: 'a', x: 25, z: 34 }, 'スローイン'); for (let i = 0; i < 70 && sim.state.ph !== 'play'; i++) sim.step(1 / 30);
    r.x = 40; r.z = 10; r.tx = 40; r.tz = 10; sim.state.ctrl = sim.state.restart.taker.idx; sim.input.mx = 0.5; sim.input.mz = -1; sim.press('pass'); sim.step(1 / 30);
    assert.equal(sim.ball.offside, null, 'スローインは オフサイドに ならない'); }
  // たいじょう: 2まいめの イエローで たいじょう(10にんに なる)
  { const sim2 = createPlay({ me: mk(80, '442', 5), opp: mk(60, '442', 6), halfSec: 60, rnd: () => 0.0 });
    for (let i = 0; i < 100; i++) sim2.step(1 / 30); const d2 = sim2.players.b.find((x) => x.slot === 'DF'); const c2 = sim2.players.a.find((x) => x.slot === 'FW'); d2.yc = 1; d2.x = 20; c2.x = 21; sim2._foul(d2, c2, 0);
    assert.ok(d2.off, 'にまいめの イエローで たいじょう'); assert.ok(sim2.state.cards.some((k) => k.color === 'red'), 'レッドカード'); }
}
// ---- かんせん(オート) モード: ぜんいん AI で さいごまで うごく ----
{
  const sim = createPlay({ me: mk(80, '442', 5), opp: mk(80, '433', 6), halfSec: 40, rnd: rngSeed(21), auto: true });
  sim.input.mx = 1; sim.input.sprint = true; let t = 0; while (!sim.state.done && t < 400) { sim.press('shoot'); sim.step(1 / 30); t += 1 / 30; }
  assert.ok(sim.state.done, 'かんせんで おわる'); assert.ok(sim.state.shots.a + sim.state.shots.b > 0, 'シュートが ある'); assert.ok(sim.state.poss.a > 1 && sim.state.poss.b > 1);
}
// ---- せんじゅつ: アタックは ラインが たかく、カウンターは ひくい ----
{
  const run = (tc) => { const sim = createPlay({ me: mk(80, '442', 5), opp: mk(80, '442', 6), halfSec: 60, rnd: rngSeed(31), tactic: tc, auto: true }); let t = 0; let lineSum = 0; let n = 0;
    while (!sim.state.done && t < 500) { sim.step(1 / 30); t += 1 / 30; if (sim.state.ph === 'play' && sim.ball.owner && sim.ball.owner.side === 'b') { const df = sim.players.a.filter((q) => q.slot === 'DF' && !q.off); lineSum += df.reduce((a, q) => a + q.x, 0) / df.length; n++; } }
    return n ? lineSum / n : 0; };
  const hi = run('attack'); const lo = run('counter');
  assert.ok(hi > lo + 1, `アタックは ラインが たかい (${hi.toFixed(1)} > ${lo.toFixed(1)})`);
}
console.log('OK: play');
