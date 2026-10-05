import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { UNITS, TAGS, makeQuestion, makeProbe, byId, registerKokugo, registerKnowledge } from '../gen.js';

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
for (const u of Object.values(byId)) {
  for (const p of u.pre) {
    assert.ok(byId[p], `unknown prereq ${p} of ${u.id}`);
    assert.ok(byId[p].grade <= u.grade, `prereq ${p} is higher grade than ${u.id}`);
    assert.notEqual(p, u.id);
  }
}
console.log('OK: prerequisite graph');

// ---- かせつを たしかめる 問題(makeProbe) ----
{
  let units = 0; let checked = 0;
  for (const us of Object.values(UNITS)) for (const u of us) {
    if (u.subject !== '算数') continue;
    units++;
    const freq = {};
    const N = 400;
    for (let i = 0; i < N; i++) for (const c of makeQuestion(u).choices) if (c.tag) freq[c.tag] = (freq[c.tag] || 0) + 1;
    for (const [tag, n] of Object.entries(freq)) {
      if (n / N < 0.15) continue; // めったに でない 罠は 対象外
      for (let k = 0; k < 40; k++) {
        const q = makeProbe(u, { tag });
        assert.ok(q.choices.some((c) => c.tag === tag), `${u.id}: ${tag} の 罠が ない`);
        assert.equal(q.choices.filter((c) => c.ok).length, 1); assert.equal(q.unit, u.id);
        checked++;
      }
    }
  }
  assert.ok(units > 30 && checked > 3000, `たしかめた 数 ${checked}`);
  // 国語: 罠の tag を ふくむ 問題を えらぶ
  const ko = byId.g2_kanji;
  const tag = ko.pool.flatMap((it) => it.wrong.map((w) => w.tag))[0];
  for (let i = 0; i < 20; i++) assert.ok(makeProbe(ko, { tag }).choices.some((c) => c.tag === tag), '国語の 罠');
  // 知識: おなじ 問題を もういちど
  const kn = byId.g4_sci_electric; const item = kn.items[3];
  for (let i = 0; i < 5; i++) { const q = makeProbe(kn, { itemId: item.id }); assert.equal(q.id, item.id); assert.equal(q.unit, kn.id); assert.equal(q.choices.filter((c) => c.ok).length, 1); }
  // しらべられない ときは ふつうの 問題
  assert.ok(makeProbe(byId.g2_add, { tag: 'no-such-tag' }).choices.length === 4);
}
