// 毎日(GitHub Actions)に 動かして、国語(漢字)の問題プール data/kokugo-pool.json を ふやす。
//   GEMINI_API_KEY=... node scripts/generate-kokugo.mjs [--grades 1,2,3,4] [--count 8] [--date 2026-10-02] [--part 0|1]
import { readFile, writeFile } from 'node:fs/promises';
import { generateForGrade, mergePool } from './lib/kokugo.mjs';
import { listModels, makeGen } from './lib/gemini.mjs';

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
};
const grades = arg('grades', '1,2,3,4').split(',').map(Number);
const count = Number(arg('count', '8'));
const jstNow = new Date(Date.now() + 9 * 3600e3);
const dateStr = arg('date', jstNow.toISOString().slice(0, 10));
const part = Number(arg('part', jstNow.getUTCHours() < 12 ? 0 : 1)); // 日本時間の 午前=0 / 午後=1(1日2回 ちがう 漢字)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const key = process.env.GEMINI_API_KEY;
if (!key) {
  console.error('GEMINI_API_KEY が設定されていません(GitHub の Settings → Secrets に登録してください)');
  process.exit(1);
}

const data = (f) => new URL(`../data/${f}`, import.meta.url);
const kanji = JSON.parse(await readFile(data('kanji.json'), 'utf8'));
let pool = [];
try {
  pool = JSON.parse(await readFile(data('kokugo-pool.json'), 'utf8')).items || [];
} catch {
  /* はじめて */
}

const models = await listModels(key);
console.log(`models: ${models.join(' > ')} / date: ${dateStr} part: ${part}`);
const gen = makeGen(key, models);

const report = { date: dateStr, part, models: models.slice(0, 3), grades: {} };
async function runGrade(grade) {
  try {
    const { items, stats } = await generateForGrade({ kanji, grade, count, dateStr, gen, part });
    pool = mergePool(pool, items);
    report.grades[grade] = stats;
    console.log(`grade ${grade}:`, JSON.stringify({ ...stats, samples: undefined }));
    return true;
  } catch (e) {
    report.grades[grade] = { error: String(e.message).slice(0, 200) };
    console.error(`grade ${grade} 失敗:`, e.message);
    return false;
  }
}
const failed = [];
for (const [i, g] of grades.entries()) {
  if (i) await sleep(15000); // つづけて たたかない(混雑・回数制限を さける)
  if (!(await runGrade(g))) failed.push(g);
}
// 失敗した 学年は、しばらく まってから もう1回
if (failed.length) {
  console.log(`失敗した学年 ${failed.join(',')} を 90秒後に やりなおします`);
  await sleep(90000);
  for (const g of failed) { await runGrade(g); await sleep(15000); }
}
await writeFile(data('kokugo-pool.json'), JSON.stringify({ version: 1, updated: dateStr, items: pool }));
await writeFile(data('last-run.json'), JSON.stringify(report, null, 1));
console.log(`pool: ${pool.length}問`);
