import assert from 'node:assert/strict';
import { THRESH, observe, activeList, nextProbes, noteProbe, counts, specFor, keyOf } from '../hyp.js';

// 罠つきの もんだい(tag の 選択肢が ある)を つくる
const trapQ = (tag = 'carry_forget') => ({ text: '27 + 38 = ?', choices: [{ label: '65', ok: true }, { label: '55', ok: false, tag }, { label: '66', ok: false, tag: 'calc_slip' }, { label: '75', ok: false, tag: 'carry_double' }] });
const pick = (q, tag) => q.choices.find((c) => c.tag === tag);
const right = (q) => q.choices.find((c) => c.ok);
const U = 'g2_add';
const D = (n) => `2026-10-${String(n).padStart(2, '0')}`;

// ---- 1) 1回の まちがいは「かせつ」。まだ 「弱点」と きめつけない ----
{
  const p = {};
  const ev = observe(p, { unitId: U, q: trapQ(), choice: pick(trapQ(), 'carry_forget'), ok: false, today: D(1) });
  assert.deepEqual(ev.map((e) => e.type), ['new']);
  const h = p.hyp[keyOf(U, 'carry_forget')];
  assert.equal(h.status, 'testing'); assert.equal(h.sup, 1); assert.equal(h.ref, 0);
  assert.deepEqual(specFor(h), { tag: 'carry_forget' });
  // 同じ かせつは 2つ できない(根拠が ふえる だけ)
  observe(p, { unitId: U, q: trapQ(), choice: pick(trapQ(), 'carry_forget'), ok: false, today: D(1) });
  assert.equal(Object.keys(p.hyp).length, 1); assert.equal(h.sup, 2);
}

// ---- 2) 根拠が 3つで「ほんとうに よわい」 ----
{
  const p = {}; const q = trapQ();
  observe(p, { unitId: U, q, choice: pick(q, 'carry_forget'), ok: false, today: D(1) });
  observe(p, { unitId: U, q, choice: pick(q, 'carry_forget'), ok: false, today: D(2) });
  const ev = observe(p, { unitId: U, q, choice: pick(q, 'carry_forget'), ok: false, today: D(3) });
  assert.deepEqual(ev.map((e) => e.type), ['confirmed']);
  assert.equal(activeList(p)[0].status, 'confirmed');
}

// ---- 3) 3回れんぞくで 罠を さければ「たまたま」→ とりさげ ----
{
  const p = {}; const q = trapQ();
  observe(p, { unitId: U, q, choice: pick(q, 'carry_forget'), ok: false, today: D(1) });
  assert.equal(observe(p, { unitId: U, q, choice: right(q), ok: true, today: D(2) }).length, 0);
  assert.equal(observe(p, { unitId: U, q, choice: right(q), ok: true, today: D(3) }).length, 0);
  const ev = observe(p, { unitId: U, q, choice: right(q), ok: true, today: D(4) });
  assert.deepEqual(ev.map((e) => e.type), ['cleared']);
  assert.equal(activeList(p).length, 0); assert.equal(counts(p).cleared, 1);
  // ほかの まちがいは どちらにも かぞえない
  const p2 = {}; observe(p2, { unitId: U, q, choice: pick(q, 'carry_forget'), ok: false, today: D(1) });
  observe(p2, { unitId: U, q, choice: pick(q, 'calc_slip'), ok: false, today: D(2) });
  const h = Object.values(p2.hyp).find((x) => x.tag === 'carry_forget');
  assert.equal(h.sup, 1); assert.equal(h.ref, 0); assert.equal(h.streak, 0);
  // 罠が ない もんだいは 手がかりに ならない
  const noTrap = { text: 'x', choices: [{ label: 'a', ok: true }, { label: 'b', ok: false, tag: 'calc_slip' }] };
  observe(p2, { unitId: U, q: noTrap, choice: right(noTrap), ok: true, today: D(3) });
  assert.equal(h.ref, 0, '罠の ない 問題は しょうこに ならない');
  // べつの 単元の もんだいは かんけいない
  observe(p2, { unitId: 'g2_sub', q, choice: right(q), ok: true, today: D(3) });
  assert.equal(h.ref, 0);
}

// ---- 4) 確定した 弱点を「のりこえた」: 3回れんぞくせいかい かつ 2日いじょう ----
{
  const p = {}; const q = trapQ();
  for (const d of [1, 2, 3]) observe(p, { unitId: U, q, choice: pick(q, 'carry_forget'), ok: false, today: D(d) });
  const h = Object.values(p.hyp)[0]; assert.equal(h.status, 'confirmed');
  // 同じ日に 3回 せいかい → まだ(おぼえた だけかも しれない)
  for (let i = 0; i < 3; i++) observe(p, { unitId: U, q, choice: right(q), ok: true, today: D(4) });
  assert.equal(h.status, 'confirmed', '1日だけでは のりこえた ことに しない');
  // 次の日も せいかい → のりこえた
  const ev = observe(p, { unitId: U, q, choice: right(q), ok: true, today: D(5) });
  assert.deepEqual(ev.map((e) => e.type), ['resolved']);
  assert.equal(counts(p).resolved, 1);
  // 途中で ぶりかえしたら れんぞくは リセット
  const p2 = {};
  for (const d of [1, 2, 3]) observe(p2, { unitId: U, q, choice: pick(q, 'carry_forget'), ok: false, today: D(d) });
  const h2 = Object.values(p2.hyp)[0];
  observe(p2, { unitId: U, q, choice: right(q), ok: true, today: D(4) });
  observe(p2, { unitId: U, q, choice: right(q), ok: true, today: D(5) });
  observe(p2, { unitId: U, q, choice: pick(q, 'carry_forget'), ok: false, today: D(6) });
  assert.equal(h2.streak, 0); assert.deepEqual(h2.okDays, []);
  assert.equal(h2.status, 'confirmed');
  // のりこえた あと ぶりかえしたら テスト中に もどる
  const p3 = {}; Object.assign(p3, { hyp: { [h.key]: { ...h } } });
  const ev3 = observe(p3, { unitId: U, q, choice: pick(q, 'carry_forget'), ok: false, today: D(9) });
  assert.deepEqual(ev3.map((e) => e.type), ['reopen']); assert.equal(p3.hyp[h.key].status, 'testing'); assert.equal(p3.hyp[h.key].sup, 1);
}

// ---- 5) まちがえた 直後の やりなおしは「はんする しょうこ」に かぞえない(おぼえた ばかりだから) ----
{
  const p = {}; const q = trapQ();
  observe(p, { unitId: U, q, choice: pick(q, 'carry_forget'), ok: false, today: D(1) });
  for (let i = 0; i < 5; i++) observe(p, { unitId: U, q, choice: right(q), ok: true, today: D(1), immediate: true });
  const h = Object.values(p.hyp)[0];
  assert.equal(h.ref, 0); assert.equal(h.status, 'testing');
  // でも 直後に また おなじ まちがいを したら こんきょに かぞえる
  observe(p, { unitId: U, q, choice: pick(q, 'carry_forget'), ok: false, today: D(1), immediate: true });
  assert.equal(h.sup, 2);
}

// ---- 6) 「わからない」は かせつに しない / 知識の問題は「その 問題」ごとに かせつ ----
{
  const p = {}; const q = trapQ();
  const ev = observe(p, { unitId: U, q, choice: null, ok: false, today: D(1) });
  assert.equal(ev.length, 0); assert.equal(Object.keys(p.hyp).length, 0);
  const kq = { id: 'g4_sci_electric:3', text: '<small>x</small>かん電池を 2こ 直列に つなぐと?', choices: [{ label: 'a', ok: true }, { label: 'b', ok: false, tag: 'know_mixup', note: 'n' }] };
  observe(p, { unitId: 'g4_sci_electric', q: kq, choice: kq.choices[1], ok: false, today: D(1) });
  const h = p.hyp['g4_sci_electric|item:g4_sci_electric:3'];
  assert.equal(h.kind, 'item'); assert.deepEqual(specFor(h), { itemId: 'g4_sci_electric:3' });
  assert.ok(h.label.length > 0 && !h.label.includes('<'));
  // 別の 問題で まちがえても、かせつは べつ
  const kq2 = { ...kq, id: 'g4_sci_electric:4' };
  observe(p, { unitId: 'g4_sci_electric', q: kq2, choice: kq2.choices[1], ok: false, today: D(1) });
  assert.equal(Object.keys(p.hyp).length, 2);
}

// ---- 7) 確かめる 問題の えらびかた: 確定が さき / 1日2回まで ----
{
  const p = {}; const q = trapQ(); const q2 = trapQ('carry_double');
  observe(p, { unitId: U, q, choice: pick(q, 'carry_forget'), ok: false, today: D(1) }); // testing
  for (const d of [1, 2, 3]) observe(p, { unitId: 'g2_sub', q: q2, choice: pick(q2, 'carry_double'), ok: false, today: D(d) }); // confirmed
  const list = activeList(p);
  assert.equal(list[0].status, 'confirmed', '確定した かせつを さきに たしかめる');
  assert.equal(nextProbes(p, D(5), 1)[0].key, list[0].key);
  noteProbe(p, list[0].key, D(5)); noteProbe(p, list[0].key, D(5));
  assert.notEqual(nextProbes(p, D(5), 1)[0].key, list[0].key, '1日2回までで 次の かせつへ');
  assert.equal(nextProbes(p, D(6), 1)[0].key, list[0].key, '次の日は また たしかめる');
  assert.equal(nextProbes(p, D(5), 5).length, 1, 'テスト中の ぶんだけ のこる');
  assert.equal(nextProbes(p, D(5), 5, [list[1].key]).length, 0, '避けたい かせつは とばす');
}

// ---- 8) ふえすぎない(古い おわった かせつから けす) ----
{
  const p = {};
  for (let i = 0; i < THRESH.maxKeep + 10; i++) {
    const q = trapQ(`t${i}`);
    observe(p, { unitId: `u${i}`, q, choice: pick(q, `t${i}`), ok: false, today: D(1 + (i % 28)) });
  }
  // ぜんぶ テスト中なので 消えない(進行中の かせつは 守る)
  assert.equal(Object.keys(p.hyp).length, THRESH.maxKeep + 10);
  const first20 = Object.values(p.hyp).slice(0, 20);
  first20.forEach((h, i) => { h.status = 'cleared'; h.last = D(1 + i); });
  const q = trapQ('zz'); observe(p, { unitId: 'uzz', q, choice: pick(q, 'zz'), ok: false, today: D(30) });
  assert.equal(Object.keys(p.hyp).length, THRESH.maxKeep, '上限(40)まで へらす');
  assert.equal(Object.values(p.hyp).filter((h) => h.status === 'testing').length, THRESH.maxKeep + 10 - 20 + 1, 'テスト中の かせつは ひとつも 消えない');
  const removed = first20.filter((h) => !p.hyp[h.key]);
  assert.equal(removed.length, 11);
  assert.ok(removed.every((h) => h.last <= D(11)), '古い おわった ものから 消える');
}
console.log('OK: hyp');
