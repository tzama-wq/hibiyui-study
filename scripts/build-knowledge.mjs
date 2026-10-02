// data/know/*.json を検査して data/knowledge.json にまとめる。
//   node scripts/build-knowledge.mjs              … 全ファイルを検査して knowledge.json を作る
//   node scripts/build-knowledge.mjs --check FILE … 指定ファイルだけ検査(書き込まない)
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { buildKnowledge } from './lib/knowledge.mjs';

const dir = new URL('../data/know/', import.meta.url);
const kanji = JSON.parse(await readFile(new URL('../data/kanji.json', import.meta.url), 'utf8'));
const i = process.argv.indexOf('--check');
const only = i > -1 ? process.argv[i + 1].replace(/\\/g, '/').split('/').pop() : null;

const names = (await readdir(dir)).filter((n) => n.endsWith('.json') && (!only || n === only)).sort();
const files = [];
for (const n of names) {
  try {
    files.push([n, JSON.parse(await readFile(new URL(n, dir), 'utf8'))]);
  } catch (e) {
    console.error(`${n}: JSON として読めません (${e.message})`);
    process.exit(1);
  }
}
const { units, errors } = buildKnowledge(files, kanji);
const count = units.reduce((a, u) => a + u.items.length, 0);
if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`\n✖ ${errors.length} 件の問題 (${units.length}単元 / ${count}問)`);
  process.exit(1);
}
console.log(`✔ OK: ${units.length}単元 / ${count}問${only ? ` (${only} のみ検査)` : ''}`);
if (!only) {
  await writeFile(new URL('../data/knowledge.json', import.meta.url), JSON.stringify({ version: 1, units }));
  console.log('data/knowledge.json を書き出しました');
}
