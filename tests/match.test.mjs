import assert from 'node:assert/strict';
import { buildPlan, layout, toPx, createMatch, PITCH, W, H } from '../match.js';
import { simulate, cpuTeam, rngSeed, slotsOf, FORMATIONS, shootout, pkKicks } from '../game.js';

const team = (fid, seed = 1) => cpuTeam('normal', rngSeed(seed), fid).team;
globalThis.requestAnimationFrame = () => 0; globalThis.cancelAnimationFrame = () => {};
const noop = new Proxy({}, { get: () => () => {}, set: () => true });
const fakeCanvas = { width: 0, height: 0, getContext: () => noop };

// ---- かたち ----
for (const f of FORMATIONS) {
  const t = team(f.id); const L = layout(t);
  assert.equal(L.pos.length, 11); assert.equal(L.rows.GK.length, 1);
  assert.equal(L.rows.FW.length, f.fw); assert.equal(L.rows.MF.length, f.mf); assert.equal(L.rows.DF.length, f.df);
  for (const p of L.pos) assert.ok(p.ax >= 0 && p.ax <= 1 && p.ay > 0.05 && p.ay < 0.95);
}
const a = toPx('a', 0, 0.5); const b = toPx('b', 0, 0.5);
assert.ok(a.x < b.x && a.x === PITCH.x0 && b.x === PITCH.x1, 'aは ひだりから みぎへ');

// ---- だんどり: パスのつながり ----
for (const f of FORMATIONS) for (let s = 0; s < 40; s++) {
  const t = team(f.id, s); const rnd = rngSeed(s * 31 + 7);
  for (const type of ['goal', 'save', 'miss']) {
    const ev = { side: 'a', type, passer: t[(s % 4) + 2].name, shooter: t[s % 2].name };
    const plan = buildPlan(ev, t, rnd);
    assert.ok(plan.chain.length >= 2, '2にん いじょう');
    assert.equal(new Set(plan.chain).size, plan.chain.length, '同じ人に 2かい パスしない');
    assert.equal(plan.chain[plan.chain.length - 1], plan.shooter, 'さいごは シューター');
    assert.ok(plan.chain.every((i) => i >= 0 && i < 11));
    assert.equal(t[plan.gk].slot, 'GK');
  }
  // なまえが みつからなくても こわれない
  const plan = buildPlan({ side: 'b', type: 'goal', passer: 'だれか', shooter: 'ふめい' }, t, rnd);
  assert.ok(plan.chain.length >= 2 && plan.shooter >= 0);
}

// ---- 1しあい さいごまで うごかす(かきこみは ダミー) ----
for (const [fa, fb] of [['442', '433'], ['352', '532'], ['451', '343']]) {
  const me = { name: 'ひびとの チーム', team: team(fa, 3) }; const opp = { name: 'ライバル', team: team(fb, 4) };
  const res = simulate(me, opp, rngSeed(11));
  const events = res.events.map((e, i) => ({ ...e, idx: i, total: res.events.length }));
  const log = []; let ended = 0;
  const m = createMatch({ me, opp, events, rnd: rngSeed(5), callbacks: { onEvent: (x) => log.push(`${x.phase}${x.i}`), onBanner: (t) => log.push(t), onEnd: () => ended++ } });
  m.attach(fakeCanvas);
  assert.equal(fakeCanvas.width, W); assert.equal(fakeCanvas.height, H);
  let frames = 0;
  while (!m.done && frames < 20000) { m._step(0.03); frames++;
    const bl = m._ball; assert.ok(Number.isFinite(bl.x) && Number.isFinite(bl.y) && Number.isFinite(bl.z), 'ボールが NaN に ならない');
    assert.ok(bl.x > -30 && bl.x < W + 30 && bl.y > 0 && bl.y < H, `ボールが ばしょ ちがい ${bl.x},${bl.y}`);
    for (const k of ['a', 'b']) for (const p of m._players[k]) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
  }
  assert.ok(m.done, 'しあいが おわる'); assert.equal(ended, 1);
  for (let i = 0; i < events.length; i++) assert.ok(['start', 'result', 'end'].every((p) => log.includes(`${p}${i}`)), `チャンス${i}の えんしゅつ`);
  assert.ok(log.includes('HALF TIME') && log.includes('FULL TIME'));
  if (events.some((e) => e.type === 'tackle')) assert.ok(log.includes('タックル!') || log.includes('カット!'), 'タックルの えんしゅつ');
  assert.ok(frames * 0.03 < 150, `しあいは 90びょう いない (${(frames * 0.03).toFixed(0)}びょう)`);
  m.destroy();
}
// とばす
{
  const me = { name: 'a', team: team('442', 1) }; const opp = { name: 'b', team: team('442', 2) };
  const res = simulate(me, opp, rngSeed(2)); let ended = 0;
  const m = createMatch({ me, opp, events: res.events.map((e, i) => ({ ...e, idx: i, total: 12 })), callbacks: { onEnd: () => ended++ } });
  m.attach(fakeCanvas); m.skip(); assert.ok(m.done); assert.equal(ended, 1); m.destroy();
}
// PK戦: けったぶん ぜんぶ えんしゅつして おわる
for (let s = 0; s < 6; s++) {
  const me = { name: 'a', team: team('442', 1) }; const opp = { name: 'b', team: team('433', 2) };
  const res = simulate(me, opp, rngSeed(s)); const pk = shootout(50, 55, rngSeed(s + 100));
  assert.notEqual(pk.a, pk.b); assert.equal(pk.kicks.filter((k) => k.side === 'a' && k.ok).length, pk.a);
  const log = []; let ended = 0;
  const m = createMatch({ me, opp, events: res.events.map((e, i) => ({ ...e, idx: i, total: 12 })), pk: pk.kicks, rnd: rngSeed(9), callbacks: { onPk: (x) => log.push(`${x.phase}${x.i}`), onBanner: (b) => log.push(b), onEnd: () => ended++ } });
  m.attach(fakeCanvas); let f = 0;
  while (!m.done && f < 40000) { m._step(0.03); f++; const bl = m._ball; assert.ok(Number.isFinite(bl.x) && Number.isFinite(bl.y) && bl.x > -40 && bl.x < W + 40, `PK ボール ${bl.x},${bl.y}`); }
  assert.ok(m.done && ended === 1);
  for (let i = 0; i < pk.kicks.length; i++) assert.ok(log.includes(`start${i}`) && log.includes(`result${i}`), `PK ${i}ほんめ`);
  assert.ok(log.includes('PK戦'));
  m.destroy();
}
// ふるい きろく(kicks なし)からも ならべられる
{ const k = pkKicks({ a: 4, b: 3 }); assert.equal(k.filter((x) => x.side === 'a' && x.ok).length, 4); assert.equal(k.filter((x) => x.side === 'b' && x.ok).length, 3); }
console.log('OK: match');
