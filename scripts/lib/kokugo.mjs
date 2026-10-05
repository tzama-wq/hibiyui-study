// 国語(漢字)の問題づくり。Gemini の出力は「信用せず」、コードで検査してから採用する。
//  1) 文中の漢字は、その学年までに習う漢字だけ(学年別漢字表で検査)
//  2) 形式(ひらがなだけの読み、選択肢の重複など)の検査
//  3) 別の呼び出しで同じ問題を解かせ、答えが一致したものだけ採用(二重検算)

export const YOMI_TAGS = ['onkun_mix', 'dakuten', 'small_kana', 'long_vowel', 'similar_word', 'other'];
export const KAKI_TAGS = ['similar_kanji', 'similar_sound', 'other'];

const KANJI_RE = /[㐀-䶿一-鿿々〆]/g;
const HIRA = /^[ぁ-ゖー]+$/;
const BAD_CHARS = /[<>&"'`\\]/;

export const kanjiOf = (s) => String(s).match(KANJI_RE) || [];
export const isAllowedText = (s, allowed) => kanjiOf(s).every((c) => allowed.has(c));

export function allowedSet(kanji, grade) {
  const set = new Set(['々']);
  for (const [g, list] of Object.entries(kanji)) if (Number(g) <= grade) for (const e of list) set.add(e.k);
  return set;
}

// ---- 検査 ------------------------------------------------------------------
export function validateItem(it, allowed) {
  const bad = (reason) => ({ ok: false, reason });
  if (!it || typeof it !== 'object') return bad('not-object');
  const { type, kanji, target, reading, sentence, explain, wrong } = it;
  if (type !== 'yomi' && type !== 'kaki') return bad('type');
  for (const v of [kanji, target, reading, sentence, explain]) if (typeof v !== 'string' || !v) return bad('missing-field');
  if ([target, reading, sentence, explain].some((v) => BAD_CHARS.test(v))) return bad('bad-chars');
  if (!allowed.has(kanji) || !target.includes(kanji)) return bad('target-kanji');
  if (!HIRA.test(reading)) return bad('reading-not-hiragana');
  if (sentence.length > 40 || explain.length > 80) return bad('too-long');
  if (sentence.split(target).length !== 2) return bad('target-not-once');
  if (!isAllowedText(sentence, allowed)) return bad('sentence-kanji-out-of-grade');
  if (!isAllowedText(explain, allowed)) return bad('explain-kanji-out-of-grade');
  if (!Array.isArray(wrong) || wrong.length < 3) return bad('wrong-count');
  const tags = type === 'yomi' ? YOMI_TAGS : KAKI_TAGS;
  const correct = type === 'yomi' ? reading : target;
  const seen = new Set([correct]);
  for (const w of wrong.slice(0, 3)) {
    if (!w || typeof w.text !== 'string' || !tags.includes(w.tag)) return bad('wrong-shape');
    if (BAD_CHARS.test(w.text) || seen.has(w.text)) return bad('wrong-dup');
    seen.add(w.text);
    if (type === 'yomi' && !HIRA.test(w.text)) return bad('wrong-not-hiragana');
    if (type === 'kaki' && (kanjiOf(w.text).length === 0 || !isAllowedText(w.text, allowed))) return bad('wrong-kanji-out-of-grade');
  }
  return { ok: true };
}

const hash = (s) => {
  let h = 5381;
  for (const c of s) h = ((h * 33) ^ c.codePointAt(0)) >>> 0;
  return h.toString(36);
};

export function toPoolItem(it, grade) {
  const yomi = it.type === 'yomi';
  // 見出しの文も、その学年で習う漢字だけで書く(読=2年、漢=3年)
  const head = yomi ? (grade >= 2 ? '【 】の 読みは?' : '【 】の よみは?') : (grade >= 3 ? '【 】を 漢字で かくと?' : '【 】を かん字で かくと?');
  const body = yomi ? it.sentence.replace(it.target, `【${it.target}】`) : it.sentence.replace(it.target, `【${it.reading}】`);
  return {
    id: `k${grade}-${it.type}-${hash(it.target + it.sentence)}`,
    grade,
    type: it.type,
    kanji: it.kanji,
    text: `<small>${head}</small><br>${body}`,
    correct: yomi ? it.reading : it.target,
    wrong: it.wrong.slice(0, 3).map((w) => ({ label: w.text, tag: yomi ? `yomi_${w.tag}` : `kaki_${w.tag}` })),
    why: it.explain,
  };
}

// ---- Gemini への依頼 ----------------------------------------------------------
export const ITEM_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      type: { type: 'STRING', enum: ['yomi', 'kaki'] },
      kanji: { type: 'STRING' },
      target: { type: 'STRING' },
      reading: { type: 'STRING' },
      sentence: { type: 'STRING' },
      explain: { type: 'STRING' },
      wrong: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: { text: { type: 'STRING' }, tag: { type: 'STRING', enum: [...YOMI_TAGS, ...KAKI_TAGS] } },
          required: ['text', 'tag'],
        },
      },
    },
    required: ['type', 'kanji', 'target', 'reading', 'sentence', 'explain', 'wrong'],
  },
};

export function buildPrompt(grade, kanjiList, allowed, feedback = '') {
  return `あなたは日本の小学校の国語の先生です。小学${grade}年生向けの漢字の問題を作ってください。
${feedback ? `\n【前回の ダメだし(かならず なおす)】\n${feedback}\n` : ''}
【対象の漢字】${kanjiList.join('、')}
対象の漢字ごとに 1問ずつ作ります。type は yomi と kaki を交互にしてください。
- yomi: 文の中の語(target)の読みを答える問題。reading は target の読み(ひらがなだけ)。
- kaki: ひらがなで書かれた語を漢字にする問題。reading はひらがな、target はその漢字表記。

【きまり】
- target は対象の漢字を1字以上ふくむ語(熟語、または送りがな付き)。kanji には対象の漢字を1字入れる。
- sentence は 20字いない のやさしい日本語の文。**yomi でも kaki でも、sentence には target を「漢字のまま」ちょうど1回だけ入れる**(kaki でも sentence の中の target を ひらがなに しない。ひらがな版は reading に書く。アプリが あとで ひらがなに おきかえる)。子どもに不適切な内容は入れない。
- sentence・explain・wrong の中で使ってよい漢字は、次の一覧にあるものだけ。一覧にない漢字は かならず ひらがなで書く(kaki の wrong の 漢字も、一覧の中の 漢字だけで 作る):
${[...allowed].join('')}
- wrong は まちがえやすい 選択肢を ちょうど3つ。どれも 正しい答えとは 別の もの。
  - yomi: ひらがなだけ。tag は ${YOMI_TAGS.join(' / ')} から選ぶ(onkun_mix=音読みと訓読みの取り違え、dakuten=にごる・にごらない、small_kana=小さい「っ」「ゅ」など、long_vowel=のばす音、similar_word=にた語の読み)。
  - kaki: 漢字をふくむ語(ひらがなだけに しない)。形のにた漢字や同じ読みの漢字を使う。tag は ${KAKI_TAGS.join(' / ')}。
- explain は 小学${grade}年生に分かる やさしい ひと言(40字いない)で、なぜその答えになるかを書く。`;
}

// 落ちた りゆうを AI に つたえて やりなおしてもらう ための ひとこと
export const REASON_HINT = {
  'target-not-once': 'sentence に target が ちょうど1回、漢字のまま 入っていない(ひらがなに していたり、2回 入っていた)',
  'sentence-kanji-out-of-grade': 'sentence に 一覧に ない 漢字が あった(一覧に ない 漢字は ひらがなに する)',
  'explain-kanji-out-of-grade': 'explain に 一覧に ない 漢字が あった',
  'wrong-kanji-out-of-grade': 'kaki の wrong に 一覧に ない 漢字が あった(一覧の 漢字だけで 作る)',
  'wrong-not-hiragana': 'yomi の wrong が ひらがなだけでは なかった',
  'wrong-dup': 'wrong が 正しい答えや ほかの wrong と おなじだった',
  'wrong-shape': 'wrong の tag が きまりの 中から えらばれていなかった',
  'wrong-count': 'wrong が 3つ なかった',
  'reading-not-hiragana': 'reading が ひらがなだけでは なかった',
  'too-long': '文や explain が ながすぎた',
  'target-kanji': 'kanji が target に ふくまれていない',
};

// AI の 出力の よくある ずれを 安全に なおす(なおせない ものは そのまま 検査で おとす)
export function normalizeItem(it) {
  if (!it || typeof it !== 'object') return it;
  const o = { ...it };
  for (const k of ['kanji', 'target', 'reading', 'sentence', 'explain']) if (typeof o[k] === 'string') o[k] = o[k].trim();
  // kanji が 2字いじょうなら、target に ふくまれる 最初の 1字に
  if (typeof o.kanji === 'string' && o.kanji.length > 1 && typeof o.target === 'string') {
    o.kanji = [...o.kanji].find((c) => o.target.includes(c)) || o.kanji;
  }
  // sentence に target が なく、reading(ひらがな)が ちょうど1回 あれば、target(漢字)に おきかえる
  if (typeof o.sentence === 'string' && typeof o.target === 'string' && typeof o.reading === 'string' && o.target && o.reading
    && !o.sentence.includes(o.target) && o.sentence.split(o.reading).length === 2) {
    o.sentence = o.sentence.replace(o.reading, o.target);
  }
  return o;
}

export function buildVerifyPrompt(items) {
  const lines = items.map((it, i) => {
    const q =
      it.type === 'yomi'
        ? `読み問題: 「${it.sentence}」の「${it.target}」の読みを、ひらがなだけで答えて。`
        : `書き問題: 「${it.sentence.replace(it.target, `【${it.reading}】`)}」の【】を、ふさわしい漢字の語で答えて。`;
    return `${i}: ${q}`;
  });
  return `次の問題を、正しい答えだけ返してください(解説は不要)。文脈から答えが1つに決まらない場合は、answer を "?" にしてください。\n${lines.join('\n')}`;
}

export const VERIFY_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: { index: { type: 'INTEGER' }, answer: { type: 'STRING' } },
    required: ['index', 'answer'],
  },
};

export function verifyAnswers(items, answers) {
  const byIdx = new Map((answers || []).map((a) => [a.index, String(a.answer).trim()]));
  return items.map((it, i) => byIdx.get(i) === (it.type === 'yomi' ? it.reading : it.target));
}

// ---- 1日分の生成 ---------------------------------------------------------------
export const dayNumber = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 864e5);
};

// 日付から決まるローテーション(毎日ちがう漢字が対象になる)
export function pickTargets(kanji, grade, count, dateStr, part = 0) {
  const list = kanji[grade].map((e) => e.k);
  const start = ((dayNumber(dateStr) * 2 + part) * count) % list.length; // 1日に2回(part 0/1)やるので、ちがう 漢字を えらぶ
  return Array.from({ length: count }, (_, i) => list[(start + i) % list.length]);
}

// gen(prompt, schema) → 解析済みJSON。テストでは差し替える
export async function generateForGrade({ kanji, grade, count, dateStr, gen, targets, part = 0, rounds = 2 }) {
  const allowed = allowedSet(kanji, grade);
  const list = targets || pickTargets(kanji, grade, count, dateStr, part);
  const stats = { asked: list.length, returned: 0, rejected: {}, unverified: 0, accepted: 0, rounds: 0, samples: [] };
  const accepted = [];
  let pending = list;
  let feedback = '';
  for (let round = 0; round < rounds && pending.length; round++) {
    stats.rounds++;
    const raw = await gen(buildPrompt(grade, pending, allowed, feedback), ITEM_SCHEMA);
    const items = Array.isArray(raw) ? raw.map(normalizeItem) : [];
    stats.returned += items.length;
    const valid = [];
    const reasons = new Set();
    for (const it of items) {
      const v = validateItem(it, allowed);
      if (v.ok) valid.push(it);
      else {
        stats.rejected[v.reason] = (stats.rejected[v.reason] || 0) + 1;
        reasons.add(v.reason);
        if (stats.samples.length < 4) stats.samples.push({ reason: v.reason, item: it }); // 原因を あとで 見られるように
      }
    }
    if (valid.length) {
      const answers = await gen(buildVerifyPrompt(valid), VERIFY_SCHEMA);
      const ok = verifyAnswers(valid, answers);
      valid.forEach((it, i) => { if (ok[i]) accepted.push(it); else stats.unverified++; });
    }
    pending = list.filter((k) => !accepted.some((it) => it.kanji === k));
    feedback = [...reasons].map((r) => `- ${REASON_HINT[r] || r}`).join('\n');
  }
  stats.accepted = accepted.length;
  stats.missing = pending.length;
  return { items: accepted.map((it) => toPoolItem(it, grade)), stats };
}

export function mergePool(pool, items, capPerGrade = 300) {
  const ids = new Set(pool.map((p) => p.id));
  const merged = [...pool, ...items.filter((it) => !ids.has(it.id))];
  const out = [];
  for (const g of [...new Set(merged.map((p) => p.grade))]) out.push(...merged.filter((p) => p.grade === g).slice(-capPerGrade));
  return out;
}
