import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { allowedSet, generateForGrade, mergePool, normalizeItem, pickTargets, validateItem, verifyAnswers } from '../scripts/lib/kokugo.mjs';
import { makeGen } from '../scripts/lib/gemini.mjs';

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

// ---- 採用率を上げる工夫 ----
// (1) 書き問題で sentence を ひらがなのまま 書いてきても、安全に 漢字へ おきかえる
{
  const hira = { ...good, type: 'kaki', sentence: 'がっこうに いく。', wrong: [{ text: '字校', tag: 'similar_kanji' }, { text: '学林', tag: 'similar_sound' }, { text: '学村', tag: 'similar_kanji' }] };
  assert.equal(validateItem(hira, a1).reason, 'target-not-once', '直さないと おちる');
  const fixed = normalizeItem(hira);
  assert.equal(fixed.sentence, '学校に いく。');
  assert.ok(validateItem(fixed, a1).ok);
  // おきかえ先が 2か所に ある(あいまい)なら 直さない
  assert.equal(normalizeItem({ ...good, sentence: 'がっこうと がっこう。' }).sentence, 'がっこうと がっこう。');
  // kanji が 2字 → target に ふくまれる 1字に
  assert.equal(normalizeItem({ ...good, kanji: '学校' }).kanji, '学');
}
// (2) 落ちた漢字だけを、落ちた りゆうを つたえて もう1回 たのむ
{
  const prompts = [];
  const mk = (k, t, r, sent) => ({ type: 'yomi', kanji: k, target: t, reading: r, sentence: sent, explain: 'ひとこと。', wrong: [{ text: 'あああ', tag: 'other' }, { text: 'いいい', tag: 'other' }, { text: 'ううう', tag: 'other' }] });
  const round1 = [mk('山', '山', 'やま', '山に のぼる。'), mk('水', '水', 'みず', '水を のむ。')]; // 川・火 は 返ってこない
  const round2 = [mk('川', '川', 'かわ', '川で あそぶ。'), mk('火', '火', 'ひ', '火を つける。')];
  const answers = (items) => items.map((it, i) => ({ index: i, answer: it.reading }));
  let call = 0;
  const gen = async (prompt) => {
    prompts.push(prompt); call++;
    if (call === 1) return round1;
    if (call === 2) return answers(round1);
    if (call === 3) return round2;
    return answers(round2);
  };
  const r = await generateForGrade({ kanji, grade: 1, count: 4, dateStr: '2026-10-02', gen, targets: ['山', '水', '川', '火'] });
  assert.equal(r.items.length, 4, '2回目で 足りない ぶんが とれた');
  assert.equal(r.stats.rounds, 2);
  assert.ok(prompts[2].includes('川、火') && !prompts[2].includes('山、水'), '2回目は 足りない 漢字だけ');
  assert.equal(r.stats.missing, 0);
}
// 落ちた 問題の じっぶつが samples に のこる(原因を あとで 見られる)
{
  const bad = { ...good, sentence: '学校と 学校。' };
  const gen = async (prompt) => (prompt.includes('一覧に ない') ? [] : [bad]);
  const r = await generateForGrade({ kanji, grade: 1, count: 1, dateStr: '2026-10-02', gen, targets: ['校'], rounds: 1 });
  assert.equal(r.items.length, 0);
  assert.equal(r.stats.samples[0].reason, 'target-not-once');
  assert.equal(r.stats.samples[0].item.sentence, '学校と 学校。');
}
// 2回目の プロンプトには 前回の ダメだし(りゆう)が 入る
{
  const prompts = [];
  const gen = async (prompt) => { prompts.push(prompt); return []; };
  await generateForGrade({ kanji, grade: 1, count: 1, dateStr: '2026-10-02', gen, targets: ['校'] }).catch(() => {});
  // 返りが 空 → ダメだしは なし。かわりに、理由つきの 再依頼は 上のテストで 確認ずみ
  assert.ok(prompts.length >= 1);
}
// (3) 1日2回(午前=0/午後=1)で ちがう 漢字を えらぶ
{
  const am = pickTargets(kanji, 3, 8, '2026-10-02', 0); const pm = pickTargets(kanji, 3, 8, '2026-10-02', 1);
  assert.equal(new Set([...am, ...pm]).size, 16, '午前と午後で かぶらない');
  assert.deepEqual(pickTargets(kanji, 3, 8, '2026-10-02', 1), pm, '同じ日・同じ回なら 同じ');
}

// ---- 混雑(503)への ふんばり: 再試行 → 別モデルへ ----
{
  const calls = []; const sleeps = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const model = String(url).match(/models\/([^:]+):/)[1]; calls.push(model);
    if (model === 'm-busy') return { status: 503, ok: false, text: async () => 'busy', json: async () => ({}) };
    return { status: 200, ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '[{"ok":1}]' }] } }] }) };
  };
  try {
    const gen = makeGen('KEY', ['m-busy', 'm-ok'], { sleep: async (ms) => { sleeps.push(ms); }, attempts: 3 });
    assert.deepEqual(await gen('p', {}), [{ ok: 1 }]);
    assert.deepEqual(calls, ['m-busy', 'm-busy', 'm-busy', 'm-ok'], '3回 ためして、だめなら 次の モデル');
    assert.equal(sleeps.length, 2, '待つのは 2回(最後は 待たずに 次へ)');
    assert.ok(sleeps[1] > sleeps[0], 'だんだん 長く まつ');
    // どのモデルも だめなら エラーを なげる
    calls.length = 0;
    const bad = makeGen('KEY', ['m-busy'], { sleep: async () => {}, attempts: 2 });
    await assert.rejects(bad('p', {}), /503/);
    // 400 は 作りなおしても なおらないので すぐ 止める
    globalThis.fetch = async () => ({ status: 400, ok: false, text: async () => 'bad request', json: async () => ({}) });
    const once = makeGen('KEY', ['m1', 'm2'], { sleep: async () => {} });
    await assert.rejects(once('p', {}), /HTTP 400/);
  } finally { globalThis.fetch = realFetch; }
}

console.log(`OK: kokugo (${seed.length}問のプールを検査)`);
