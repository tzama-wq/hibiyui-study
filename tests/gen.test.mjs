import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { UNITS, TAGS, makeQuestion, registerKokugo, registerKnowledge } from '../gen.js';

// 同梱の国語プールも、算数と同じ検査にかける
registerKokugo(JSON.parse(readFileSync(new URL('../data/kokugo-pool.json', import.meta.url), 'utf8')).items);
registerKnowledge(JSON.parse(readFileSync(new URL('../data/knowledge.json', import.meta.url), 'utf8')).units);

let n = 0;
for (const units of Object.values(UNITS)) {
  for (const u of units) {
    for (let i = 0; i < 2000; i++) {
      const q = makeQuestion(u);
      n++;
      const ctx = `${u.id}: ${q.text}`;
      const know = ['理科', '社会', '生活'].includes(u.subject);
      if (know) assert.ok(q.choices.length === 3 || q.choices.length === 4, `choices ${ctx}`);
      else assert.equal(q.choices.length, 4, `choices!=4 ${ctx}`);
      assert.ok(!/<(?!\/?(small|br|ruby|rt)>)/.test(q.text), `unsafe html ${ctx}`);
      assert.equal(q.choices.filter((c) => c.ok).length, 1, `ok count ${ctx}`);
      assert.equal(new Set(q.choices.map((c) => c.label)).size, q.choices.length, `dup labels ${ctx}`);
      for (const c of q.choices) if (!c.ok) assert.ok(TAGS[c.tag], `bad tag ${c.tag} ${ctx}`);
      assert.ok(q.why && q.text, `empty text ${ctx}`);
    }
  }
}
// 答えの検算(代表)
for (let i = 0; i < 2000; i++) {
  const q = makeQuestion(UNITS[4].find((u) => u.id === 'g4_div'));
  const [, a, b] = q.text.match(/(\d+) ÷ (\d+)/);
  const ok = q.choices.find((c) => c.ok).label;
  const [, qq, rr] = ok.match(/(\d+)あまり(\d+)/);
  assert.equal(Number(b) * Number(qq) + Number(rr), Number(a));
  assert.ok(Number(rr) < Number(b));
}
console.log(`OK: ${n} questions checked`);

// 前提つながり: 存在するIDで、学年が下がる方向にだけ向き、循環しない
import { byId } from '../gen.js';
for (const u of Object.values(byId)) {
  for (const p of u.pre) {
    assert.ok(byId[p], `unknown prereq ${p} of ${u.id}`);
    assert.ok(byId[p].grade <= u.grade, `prereq ${p} is higher grade than ${u.id}`);
    assert.notEqual(p, u.id);
  }
}
console.log('OK: prerequisite graph');
