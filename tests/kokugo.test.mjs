import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { allowedSet, generateForGrade, mergePool, pickTargets, validateItem, verifyAnswers } from '../scripts/lib/kokugo.mjs';

const kanji = JSON.parse(readFileSync(new URL('../data/kanji.json', import.meta.url), 'utf8'));
const a1 = allowedSet(kanji, 1);
const a2 = allowedSet(kanji, 2);

const good = {
  type: 'yomi', kanji: '校', target: '学校', reading: 'がっこう', sentence: '学校に いく。', explain: '「がっ」は 小さい「っ」だよ。',
  wrong: [{ text: 'がくこう', tag: 'small_kana' }, { text: 'がっごう', tag: 'dakuten' }, { text: 'まなびこう', tag: 'onkun_mix' }],
};
assert.ok(validateItem(good, a1).ok);

// 学年外の漢字は不採用(「行」は2年、「読」は2年)
assert.equal(validateItem({ ...good, sentence: '学校に 行く。' }, a1).reason, 'sentence-kanji-out-of-grade');
assert.ok(validateItem({ ...good, sentence: '学校に 行く。' }, a2).ok);
assert.equal(validateItem({ ...good, explain: '読むよ。' }, a1).reason, 'explain-kanji-out-of-grade');
// 形式の不正
assert.equal(validateItem({ ...good, reading: 'ガッコウ' }, a1).reason, 'reading-not-hiragana');
assert.equal(validateItem({ ...good, wrong: [{ text: 'がっこう', tag: 'other' }, ...good.wrong.slice(1)] }, a1).reason, 'wrong-dup');
assert.equal(validateItem({ ...good, wrong: [{ text: 'がくこう', tag: 'bogus' }, ...good.wrong.slice(1)] }, a1).reason, 'wrong-shape');
assert.equal(validateItem({ ...good, sentence: '学校と 学校へ。' }, a1).reason, 'target-not-once');
assert.equal(validateItem({ ...good, explain: '<b>x</b>' }, a1).reason, 'bad-chars');
assert.equal(validateItem(null, a1).reason, 'not-object');

// 生成の流れ: 検査で落ちたもの/二重検算で食い違ったものは採用されない
const bad1 = { ...good, target: '山', kanji: '山', reading: 'やま', sentence: '山に 行く。' }; // 学年外の漢字
const wrongAnswer = { ...good, sentence: '大きな 学校。', explain: 'そうだよ。' };
let calls = 0;
const gen = async (prompt, schema) => {
  calls++;
  if (calls === 1) return [good, bad1, wrongAnswer];
  // 二重検算: good は正解、wrongAnswer には わざと まちがえた こたえを返す
  return [{ index: 0, answer: 'がっこう' }, { index: 1, answer: 'がくこう' }];
};
const r = await generateForGrade({ kanji, grade: 1, count: 3, dateStr: '2026-10-02', gen });
assert.equal(r.items.length, 1);
assert.equal(r.items[0].correct, 'がっこう');
assert.equal(r.stats.rejected['sentence-kanji-out-of-grade'], 1);
assert.equal(r.stats.unverified, 1);
assert.match(r.items[0].text, /【学校】/);

// 書き問題は 文の中の語をひらがなに おきかえて 出す
const kaki = { type: 'kaki', kanji: '校', target: '学校', reading: 'がっこう', sentence: '学校に いく。', explain: 'きへんの 校だよ。', wrong: [{ text: '字校', tag: 'similar_kanji' }, { text: '学林', tag: 'similar_sound' }, { text: '学村', tag: 'similar_kanji' }] };
assert.ok(validateItem(kaki, a1).ok);
assert.deepEqual(verifyAnswers([kaki], [{ index: 0, answer: '学校' }]), [true]);
assert.deepEqual(verifyAnswers([kaki], [{ index: 0, answer: '?' }]), [false]);
assert.deepEqual(verifyAnswers([kaki], []), [false]);

// ローテーションは毎日ちがう/同じ日は同じ
const t1 = pickTargets(kanji, 2, 8, '2026-10-02');
const t2 = pickTargets(kanji, 2, 8, '2026-10-03');
assert.equal(new Set(t1).size, 8);
assert.deepEqual(t1, pickTargets(kanji, 2, 8, '2026-10-02'));
assert.notDeepEqual(t1, t2);

// プール: 重複は入らない/学年ごとの上限
const pool = mergePool([], r.items);
assert.equal(mergePool(pool, r.items).length, 1);
const many = Array.from({ length: 350 }, (_, i) => ({ id: `x${i}`, grade: 2 }));
assert.equal(mergePool([], many).length, 300);

// 同梱のプールは、すべて検査を通る
const seed = JSON.parse(readFileSync(new URL('../data/kokugo-pool.json', import.meta.url), 'utf8')).items;
assert.ok(seed.length >= 10);
for (const q of seed) {
  const allowed = allowedSet(kanji, q.grade);
  assert.equal(q.wrong.length, 3);
  assert.ok(!q.wrong.some((w) => w.label === q.correct), q.id);
  assert.ok([...q.text.replace(/<[^>]*>/g, '')].every((c) => !/[一-鿿]/.test(c) || allowed.has(c)), `out-of-grade kanji in ${q.id}`);
}
console.log(`OK: kokugo (${seed.length}問のプールを検査)`);
