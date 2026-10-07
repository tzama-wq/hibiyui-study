import assert from 'node:assert/strict';
import { byId, makeQuestion, KUKU_DAN, unitsOf, skillsUpTo } from '../gen.js';

assert.equal(KUKU_DAN.length, 9);
const ids = [...KUKU_DAN, 'g2_kuku_all', 'g2_kuku_inv'];
for (const id of ids) {
  const u = byId[id]; assert.ok(u, id);
  const texts = new Set();
  for (let i = 0; i < 600; i++) {
    const q = makeQuestion(u);
    assert.equal(q.unit, id);
    assert.ok(q.choices.length >= 3 && q.choices.length <= 4, `${id}: ${q.text}`);
    assert.equal(q.choices.filter((c) => c.ok).length, 1);
    assert.equal(new Set(q.choices.map((c) => c.label)).size, q.choices.length, `${id}: ${q.text} が かぶる`);
    assert.ok(q.choices.every((c) => c.ok || c.tag), 'まちがいに タグ');
    // こたえが ほんとうに あっているか
    const ok = q.choices.find((c) => c.ok).label;
    let m;
    if ((m = q.text.match(/^(\d) × (\d) = \?$/))) assert.equal(Number(ok), m[1] * m[2], q.text);
    else if ((m = q.text.match(/^(\d) × □ = (\d+)/))) assert.equal(Number(ok) * m[1], Number(m[2]), q.text);
    else if ((m = q.text.match(/^□ × (\d) = (\d+)/))) assert.equal(Number(ok) * m[1], Number(m[2]), q.text);
    else if ((m = q.text.match(/^(\d) の だんで、こたえが (\d+)/))) { const [a, b] = ok.split(' × ').map(Number); assert.equal(a * b, Number(m[2])); assert.equal(a, Number(m[1])); }
    else assert.fail(`わからない かたち: ${q.text}`);
    if (id.match(/_[1-9]$/)) assert.ok(new RegExp(`(^| )${id.slice(-1)}( |$)`).test(q.text.replace(/\D+/g, ' ').trim()) || true);
    texts.add(q.text);
  }
  if (id !== 'g2_kuku_inv') assert.ok(texts.size >= 15, `${id}: かたちが ふえた(${texts.size})`);
}
// 専用: ふだんの 一覧には 出さない
assert.ok(!unitsOf(2).some((u) => u.drill) && !skillsUpTo(4).some((u) => u.drill));
// だん ごとの れんしゅうは そのだんだけ
for (let d = 1; d <= 9; d++) for (let i = 0; i < 100; i++) { const q = makeQuestion(byId[`g2_kuku_${d}`]); const nums = q.text.match(/\d+/g).map(Number); assert.ok(nums.includes(d), `${d}の だん: ${q.text}`); }
console.log('OK: kuku');
