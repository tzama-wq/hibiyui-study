// 理科・社会・生活の「事実リスト方式」の問題集の検査。
// 人が(または AI が)書いた data/know/*.json を検査して、data/knowledge.json にまとめる。
//
// ファイル形式:
// { "grade": 4, "subject": "理科",
//   "units": [{ "id": "g4_sci_electric", "name": "電気の はたらき", "months": [10, 11], "pre": [],
//     "items": [{ "q": "…?", "correct": "…",
//                 "wrong": [{ "label": "…", "note": "それは〇〇のことだよ" }, …(2〜3こ)],
//                 "why": "せいかいの りゆう(やさしく)" }] }] }
//
// ルビ: 学年で習わない漢字は {神奈川|かながわ} のように書く(アプリで<ruby>になる)。
//       ルビの外側の漢字は、その学年までに習う漢字だけ使える。
import { allowedSet, kanjiOf } from './kokugo.mjs';

export const SUBJECTS = ['理科', '社会', '生活', '国語'];
export const RUBY_RE = /\{([^|{}]+)\|([^{}]+)\}/g;
export const stripRuby = (s) => String(s).replace(RUBY_RE, '');
// ルビを外して、表示される文字(ルビの親文字)だけにする。重複判定などに使う
export const plainText = (s) => String(s).replace(RUBY_RE, '$1');
const HIRA = /^[ぁ-ゖー]+$/;
const BAD = /[<>&"`\\]/;
export const MIN_ITEMS = 12;

function checkText(label, s, max, allowed, errs, where) {
  if (typeof s !== 'string' || !s.trim()) return errs.push(`${where}: ${label} が空`);
  if (s.length > max) errs.push(`${where}: ${label} が ${max} 字より長い (${s.length}字)`);
  if (BAD.test(s)) errs.push(`${where}: ${label} に使えない記号 (< > & " \` \\)`);
  for (const m of s.matchAll(RUBY_RE)) if (!HIRA.test(m[2])) errs.push(`${where}: ${label} のルビがひらがなでない {${m[1]}|${m[2]}}`);
  const rest = stripRuby(s);
  if (/[{}|]/.test(rest)) errs.push(`${where}: ${label} のルビ記法が壊れている`);
  const out = [...new Set(kanjiOf(rest).filter((c) => !allowed.has(c)))];
  if (out.length) errs.push(`${where}: ${label} に学年外の漢字 [${out.join('')}] → {漢字|よみ} にするか ひらがなに`);
}

export function validateFile(file, kanji) {
  const errs = [];
  const grade = file.grade;
  if (![1, 2, 3, 4].includes(grade)) return ['grade は 1〜4'];
  if (!SUBJECTS.includes(file.subject)) return [`subject は ${SUBJECTS.join('/')}`];
  const allowed = allowedSet(kanji, grade);
  const ids = new Set();
  const qs = new Set();
  for (const u of file.units || []) {
    const w = `[${u.id}]`;
    if (!/^g\d_[a-z0-9_]+$/.test(u.id || '') || !u.id.startsWith(`g${grade}_`)) errs.push(`${w}: id は g${grade}_xxx 形式`);
    if (ids.has(u.id)) errs.push(`${w}: id が重複`);
    ids.add(u.id);
    checkText('単元名', u.name, 20, allowed, errs, w);
    if (!Array.isArray(u.months) || !u.months.length || u.months.some((m) => !Number.isInteger(m) || m < 1 || m > 12)) errs.push(`${w}: months は 1〜12 の配列`);
    if (u.pre !== undefined && !Array.isArray(u.pre)) errs.push(`${w}: pre は配列`);
    if (!Array.isArray(u.items) || u.items.length < MIN_ITEMS) errs.push(`${w}: 問題が ${MIN_ITEMS} 問より少ない (${u.items?.length || 0})`);
    (u.items || []).forEach((it, i) => {
      const ww = `${w}#${i + 1}`;
      checkText('q', it.q, 70, allowed, errs, ww);
      checkText('correct', it.correct, 24, allowed, errs, ww);
      checkText('why', it.why, 90, allowed, errs, ww);
      if (qs.has(it.q)) errs.push(`${ww}: 同じ問題文が重複`);
      qs.add(it.q);
      if (!Array.isArray(it.wrong) || it.wrong.length < 2 || it.wrong.length > 3) return errs.push(`${ww}: wrong は 2〜3こ`);
      const labels = new Set([plainText(it.correct)]);
      for (const x of it.wrong) {
        checkText('wrong.label', x?.label, 24, allowed, errs, ww);
        checkText('wrong.note', x?.note, 70, allowed, errs, ww);
        const l = plainText(x?.label ?? '');
        if (labels.has(l)) errs.push(`${ww}: 選択肢が重複 「${l}」`);
        labels.add(l);
      }
    });
  }
  return errs;
}

export function buildKnowledge(files, kanji) {
  const units = [];
  const errors = [];
  const ids = new Set();
  for (const [name, f] of files) {
    for (const e of validateFile(f, kanji)) errors.push(`${name} ${e}`);
    for (const u of f.units || []) {
      if (ids.has(u.id)) errors.push(`${name} [${u.id}]: 他のファイルと id が重複`);
      ids.add(u.id);
      units.push({ id: u.id, grade: f.grade, subject: f.subject, name: u.name, months: u.months, pre: u.pre || [], items: u.items });
    }
  }
  return { units, errors };
}
