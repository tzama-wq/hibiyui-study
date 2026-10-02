// 学年別漢字配当表(教育漢字)を kanjiapi.dev から取得して data/kanji.json に保存する。1回だけ実行すればよい。
// 形式: { "1": [{ "k": "校", "on": ["コウ"], "kun": [] }, ...], "2": [...], ... }
import { writeFile } from 'node:fs/promises';

const GRADES = [1, 2, 3, 4];
const out = {};
for (const g of GRADES) {
  const list = await (await fetch(`https://kanjiapi.dev/v1/kanji/grade-${g}`)).json();
  const items = [];
  for (let i = 0; i < list.length; i += 10) {
    const part = await Promise.all(list.slice(i, i + 10).map(async (k) => {
      const d = await (await fetch(`https://kanjiapi.dev/v1/kanji/${encodeURIComponent(k)}`)).json();
      return { k, on: d.on_readings, kun: d.kun_readings };
    }));
    items.push(...part);
  }
  out[g] = items;
  console.log(`grade ${g}: ${items.length}字`);
}
await writeFile(new URL('../data/kanji.json', import.meta.url), JSON.stringify(out));
