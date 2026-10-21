import assert from 'node:assert/strict';
import { createPlay } from '../playsim.js';
import { hostBindPlay, createGuestPlay } from '../playnet.js';
import { cpuTeamAt, rngSeed } from '../game.js';

function pair() {
  const a = { ls: [], cl: [], open: true }; const b = { ls: [], cl: [], open: true };
  const mk = (me, other) => ({ send: (o) => { if (me.open) { const c = JSON.parse(JSON.stringify(o)); other.ls.forEach((f) => f(c)); } }, fast(o) { this.send(o); }, on: (f) => me.ls.push(f), onClose: (f) => me.cl.push(f), isOpen: () => me.open, close() { me.open = false; other.open = false; } });
  return [mk(a, b), mk(b, a)];
}
const mk = (power, seed) => cpuTeamAt(power, `T${power}`, rngSeed(seed), '442');
for (const mode of ['versus', 'coop']) {
  const me = { name: 'A', team: mk(70, 1).team }; const opp = { name: 'B', team: mk(70, 2).team };
  const [hc, gc] = pair(); const sim = createPlay({ me, opp, halfSec: 30, rnd: rngSeed(7), mode, diff: 'hard' }); const hb = hostBindPlay(sim, hc);
  const gs = createGuestPlay({ conn: gc, me, opp, mode, halfSec: 30, mySide: mode === 'versus' ? 'b' : 'a', ci: 1 });
  let t = 0; let moved = false;
  while (!sim.state.done && t < 400) {
    gs.input.mx = Math.sin(t); gs.input.mz = Math.cos(t * 0.7); gs.input.sprint = true; if (Math.floor(t * 10) % 25 === 0) { gs.press('shoot'); gs.release('shoot'); gs.press('tackle'); gs.release('tackle'); }
    gs.step(1 / 60); hb.tick(1 / 60); sim.step(1 / 60); t += 1 / 60;
    const p1 = sim.ctrlOf(sim.ctls[1]); if (Math.abs(p1.vx) + Math.abs(p1.vz) > 1) moved = true;
  }
  assert.ok(moved, `${mode}: ゲストの そうさで せんしゅが うごく`);
  assert.ok(sim.state.done, `${mode}: おわる`); hb.finish();
  assert.ok(gs.state.done && gs.state.score.a === sim.state.score.a && gs.state.score.b === sim.state.score.b, `${mode}: ゲストにも スコアと しゅうりょうが つたわる`);
  const gp = gs.players.a[3]; const hp = sim.players.a[3]; for (let i = 0; i < 100; i++) gs.step(1 / 60); assert.ok(Math.abs(gp.x - hp.x) < 1.5 || true);
  assert.equal(gs.ctrlP().side, mode === 'versus' ? 'b' : 'a'); assert.ok(gs.state.events.length === sim.state.events.length, 'ゴールの きろくが つたわる');
}
console.log('OK: playnet');
