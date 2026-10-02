// 問題集の「正解の長さの偏り」を調べる。
// 正解がいつも一番長い(または一番短い)と、内容を考えなくても「長い(短い)のを選べば当たる」ことになってしまう。
//   node scripts/lint-knowledge.mjs [--max 0.45]
import { readdir, readFile } from 'node:fs/promises';
import { plainText } from './lib/knowledge.mjs';

const i = process.argv.indexOf('--max');
const MAX = i > -1 ? Number(process.argv[i + 1]) : 0.45; // 正解が「いちばん長い」問題の上限の割合
const dir = new URL('../data/know/', import.meta.url);
let bad = 0;
for (const n of (await readdir(dir)).filter((f) => f.endsWith('.json')).sort()) {
  const f = JSON.parse(await readFile(new URL(n, dir), 'utf8'));
  for (const u of f.units) {
    let longest = 0;
    let shortest = 0;
    for (const it of u.items) {
      const c = plainText(it.correct).length;
      const w = it.wrong.map((x) => plainText(x.label).length);
      if (c > Math.max(...w)) longest++;
      if (c < Math.min(...w)) shortest++;
    }
    const r = longest / u.items.length;
    const rs = shortest / u.items.length;
    const flag = r > MAX || rs > MAX ? '  ← 偏りあり' : '';
    if (r > MAX || rs > MAX) bad++;
    console.log(`${u.id.padEnd(24)} 正解が最長 ${(r * 100).toFixed(0).padStart(3)}%  最短 ${((shortest / u.items.length) * 100).toFixed(0).padStart(3)}%  (${u.items.length}問)${flag}`);
  }
}
console.log(bad ? `\n偏りのある単元: ${bad}` : '\n偏りなし');
process.exit(bad ? 1 : 0);
