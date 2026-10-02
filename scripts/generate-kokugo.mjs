// 毎朝(GitHub Actions)に動かして、国語(漢字)の問題プール data/kokugo-pool.json を増やす。
//   GEMINI_API_KEY=... node scripts/generate-kokugo.mjs [--grades 1,2,3,4] [--count 8] [--date 2026-10-02]
import { readFile, writeFile } from 'node:fs/promises';
import { generateForGrade, mergePool } from './lib/kokugo.mjs';
import { makeGen, pickModel } from './lib/gemini.mjs';

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
};
const grades = arg('grades', '1,2,3,4').split(',').map(Number);
const count = Number(arg('count', '8'));
const jst = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const dateStr = arg('date', jst);

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

const model = await pickModel(key);
console.log(`model: ${model} / date: ${dateStr}`);
const gen = makeGen(key, model);

const report = { date: dateStr, model, grades: {} };
for (const grade of grades) {
  try {
    const { items, stats } = await generateForGrade({ kanji, grade, count, dateStr, gen });
    pool = mergePool(pool, items);
    report.grades[grade] = stats;
    console.log(`grade ${grade}:`, JSON.stringify(stats));
  } catch (e) {
    report.grades[grade] = { error: String(e.message).slice(0, 200) };
    console.error(`grade ${grade} 失敗:`, e.message);
  }
}
await writeFile(data('kokugo-pool.json'), JSON.stringify({ version: 1, updated: dateStr, items: pool }));
await writeFile(data('last-run.json'), JSON.stringify(report, null, 1));
console.log(`pool: ${pool.length}問`);
