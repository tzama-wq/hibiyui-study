import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeTeaser, notificationOf, papaNotification } from '../scripts/lib/teaser.mjs';
const units = JSON.parse(readFileSync(new URL('../data/knowledge.json', import.meta.url), 'utf8')).units;
let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
for (const grade of [1, 2, 3, 4]) for (let i = 0; i < 80; i++) {
  const t = makeTeaser(grade, rnd, units);
  assert.ok(t.q && t.a && t.b && t.a !== t.b, `選択肢が ちがう (${t.q})`);
  assert.ok(['a', 'b'].includes(t.ans));
  // けいさんの もんだいは こたえが あっている
  const m = /^(\d+(?:\.\d+)?) ([+×÷−]) (\d+(?:\.\d+)?) = \?$/.exec(t.q);
  if (m) { const [x, op, y] = [Number(m[1]), m[2], Number(m[3])]; const v = op === '+' ? x + y : op === '−' ? x - y : op === '×' ? x * y : x / y; assert.equal(Number(t[t.ans === 'a' ? 'a' : 'b']), Math.round(v * 10) / 10, `こたえ ${t.q}`); }
  const n = notificationOf('ひびと', t, 'first', rnd); assert.ok(!n.body.includes(`こたえは ${t[t.ans]}`) && n.body.includes('A:') && n.body.length < 140, 'つうちの ぶんしょう');
}
assert.equal(papaNotification([{ name: 'ひびと', did: true }, { name: 'ゆいと', did: true }]), null);
assert.match(papaNotification([{ name: 'ひびと', did: false }]).body, /ひびと/);
console.log('OK: teaser');
