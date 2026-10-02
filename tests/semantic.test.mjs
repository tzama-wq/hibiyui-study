// 出題プログラムとは「別の計算」で、正解が数学的に正しいかを検算する。
import assert from 'node:assert/strict';
import { UNITS, makeQuestion } from '../gen.js';

const stripRuby = (t) => t.replace(/<rt>.*?<\/rt>/g, '').replace(/<[^>]+>/g, '');
const correctOf = (q) => q.choices.find((c) => c.ok).label.replace(/,/g, '');
const dec = (x) => String(+x.toFixed(2));
const N = 400;

let checked = 0;
function check(q, expected, why) {
  assert.equal(correctOf(q), String(expected), `${why}: ${q.text} → ${correctOf(q)} (期待 ${expected})`);
  checked++;
}

for (const us of Object.values(UNITS)) {
  for (const u of us) {
    if (u.subject !== '算数') continue;
    for (let i = 0; i < N; i++) {
      const q = makeQuestion(u);
      const t = stripRuby(q.text).replace(/,/g, '');
      let m;

      // 式 = ?  (四則・かっこ・小数)
      if ((m = t.match(/^([\d.\s+−×÷()]+) = \?$/))) {
        const expr = m[1].replace(/−/g, '-').replace(/×/g, '*');
        if (expr.includes('÷')) {
          const [a, b] = expr.split('÷').map(Number);
          const ans = a % b === 0 || String(a).includes('.') || String(b).includes('.')
            ? (a / b).toString()
            : `${Math.floor(a / b)}あまり${a % b}`;
          if (/あまり/.test(ans) || /あまり/.test(correctOf(q))) {
            // 整数のわり算: あまりなしなら商だけ、あまりありなら「qあまりr」
            const exp = a % b === 0 ? String(a / b) : `${Math.floor(a / b)}あまり${a % b}`;
            check(q, exp, 'division');
          } else {
            check(q, dec(Number(ans)), 'decimal division');
          }
        } else {
          const v = Function(`"use strict"; return (${expr});`)();
          check(q, expr.includes('.') ? dec(v) : v, 'expr');
        }
        continue;
      }
      // 長方形・正方形の面積
      if ((m = t.match(/^たて (\d+)cm、よこ (\d+)cm の 長方形の 面積/))) { check(q, `${m[1] * m[2]}`, 'rect'); continue; }
      if ((m = t.match(/^1辺が (\d+)cm の 正方形の 面積/))) { check(q, `${m[1] * m[1]}`, 'square'); continue; }
      if ((m = t.match(/^(\d+)m² は なんcm²/))) { check(q, `${m[1] * 10000}`, 'm2'); continue; }
      // 円
      if ((m = t.match(/^半径が (\d+)cmの 円の 直径/))) { check(q, `${m[1] * 2}`, 'diameter'); continue; }
      if ((m = t.match(/^直径が (\d+)cmの 円の 半径/))) { check(q, `${m[1] / 2}`, 'radius'); continue; }
      // 角度
      if ((m = t.match(/^一直線の 上で、一方の 角が (\d+)°/))) { check(q, `${180 - m[1]}°`, 'straight'); continue; }
      if ((m = t.match(/^三角形の 2つの 角が (\d+)°と (\d+)°/))) { check(q, `${180 - m[1] - m[2]}°`, 'triangle'); continue; }
      // 時刻・時間
      if ((m = t.match(/^(\d+)時(\d+)分から (\d+)分たつと/))) {
        const tot = +m[1] * 60 + +m[2] + +m[3];
        check(q, `${Math.floor(tot / 60)}時${tot % 60}分`, 'clock');
        continue;
      }
      if ((m = t.match(/^(\d+)時間(\d+)分は なん分/))) { check(q, `${m[1] * 60 + +m[2]}`, 'hm→min'); continue; }
      if ((m = t.match(/^(\d+)分(\d+)秒は なん秒/))) { check(q, `${m[1] * 60 + +m[2]}`, 'ms→s'); continue; }
      // 単位
      if ((m = t.match(/^(\d+)m (\d+)cm は なんcm/))) { check(q, `${m[1] * 100 + +m[2]}`, 'm cm'); continue; }
      if ((m = t.match(/^(\d+)cm は なんm なんcm/))) { check(q, `${Math.floor(m[1] / 100)}m ${m[1] % 100}cm`, 'cm→m'); continue; }
      if ((m = t.match(/^(\d+)cm (\d+)mm は なんmm/))) { check(q, `${m[1] * 10 + +m[2]}`, 'cm mm'); continue; }
      if ((m = t.match(/^(\d+)mm は なんcm なんmm/))) { check(q, `${Math.floor(m[1] / 10)}cm ${m[1] % 10}mm`, 'mm→cm'); continue; }
      if ((m = t.match(/^(\d+)L (\d+)dL は なんdL/))) { check(q, `${m[1] * 10 + +m[2]}`, 'L dL'); continue; }
      if ((m = t.match(/^(\d+)L は なんmL/))) { check(q, `${m[1] * 1000}`, 'L mL'); continue; }
      if ((m = t.match(/^(\d+)km (\d+)m は なんm/))) { check(q, `${m[1] * 1000 + +m[2]}`, 'km m'); continue; }
      if ((m = t.match(/^(\d+)kg (\d+)g は なんg/))) { check(q, `${m[1] * 1000 + +m[2]}`, 'kg g'); continue; }
      if ((m = t.match(/^(\d+)000m は なんkm/))) { check(q, `${m[1]}km`, 'm→km'); continue; }
      // 位取り・大きな数
      if ((m = t.match(/^100が (\d+)こ、10が (\d+)こ、1が (\d+)こ/))) { check(q, `${m[1] * 100 + m[2] * 10 + +m[3]}`, 'place3'); continue; }
      if ((m = t.match(/^10が (\d+)こ と 1が (\d+)こ/))) { check(q, `${m[1] * 10 + +m[2]}`, 'place2'); continue; }
      if ((m = t.match(/^1000が (\d+)こ、100が (\d+)こ、10が (\d+)こ、1が (\d+)こ/))) { check(q, `${m[1] * 1000 + m[2] * 100 + m[3] * 10 + +m[4]}`, 'place4'); continue; }
      if ((m = t.match(/^(\d+)億 は 1万の なんこ分/))) { check(q, `${m[1] * 10000}`, 'oku'); continue; }
      if ((m = t.match(/^(\d+)億 (\d)000万 を 数字で/))) { check(q, `${m[1]}${m[2]}0000000`, 'oku-man'); continue; }
      if ((m = t.match(/^(\d+) は 1万\(10000\)が なんこ分/))) { check(q, `${m[1] / 10000}`, 'man'); continue; }
      // 小数 0.1 が n こ
      if ((m = t.match(/^0\.1が (\d+)こ で いくつ/))) { check(q, dec(m[1] / 10), '0.1×n'); continue; }
      // 分数
      if ((m = t.match(/^(\d+)分の(\d+) を 帯分数/))) { check(q, `${Math.floor(m[2] / m[1])}と${m[1]}分の${m[2] % m[1]}`, 'improper→mixed'); continue; }
      if ((m = t.match(/^(\d+)と(\d+)分の(\d+) を 仮分数/))) { check(q, `${m[2]}分の${m[1] * m[2] + +m[3]}`, 'mixed→improper'); continue; }
      if ((m = t.match(/^(\d+)分の(\d+) \+ (\d+)分の(\d+) = \?$/))) { check(q, `${m[1]}分の${+m[2] + +m[4]}`, 'frac+'); continue; }
      if ((m = t.match(/^(\d+)分の(\d+) − (\d+)分の(\d+) = \?$/))) { check(q, `${m[1]}分の${m[2] - m[4]}`, 'frac-'); continue; }
      // 四捨五入
      if ((m = t.match(/^([\d]+) を 四捨五入して、(.)の位までの がい数/))) {
        const p = { 十: 10, 百: 100, 千: 1000 }[m[2]];
        check(q, Math.round(+m[1] / p) * p, 'round');
        continue;
      }
      // 九九のわり算・単純な○あまり(上で処理済み)・円・その他は構造検査のみ
    }
  }
}
assert.ok(checked > 8000, `検算した問題が少なすぎる (${checked})`);
console.log(`OK: semantic (${checked}問を別計算で検算)`);
