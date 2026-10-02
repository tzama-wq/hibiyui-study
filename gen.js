// 算数の出題ジェネレーター。答えはすべてコードで計算する(AIには任せない)。
// 間違いの選択肢には「つまずき原因タグ」を付け、誤答から原因を特定する。

const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = (a) => a[rnd(0, a.length - 1)];
export const shuffle = (a) => {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const S = String;
const fmtN = (n) => n.toLocaleString('en-US');
const fmtD = (h) => String(+(h / 100).toFixed(2)); // 100分の1の整数 → 小数表記

// ---- つまずき原因 ---------------------------------------------------------
export const TAGS = {
  carry_forget: ['くり上がりを わすれたよ', 'いちのくらいが 10を こえたら、10を「じゅうのくらい」に 1こ あげるよ。その 1を たすのを わすれたみたい。'],
  carry_double: ['くり上がりを 2かい したよ', 'くり上がりの 1は 1かいだけ たすよ。'],
  borrow_swap: ['ひくほうを ぎゃくに ひいたよ', 'いちのくらいで ひけないときは、大きいほうから 小さいほうを ひくんじゃなくて、じゅうのくらいから 10 かりてくるよ。'],
  borrow_forget: ['かりた あとの じゅうのくらいを へらしてないよ', '10を かりたら、じゅうのくらいは 1 へるよ。へらすのを わすれると 10 おおきくなっちゃう。'],
  borrow_double: ['かりたのを 2かい ひいたよ', 'かりて へらすのは 1かいだけ だよ。'],
  kuku_neighbor: ['九九が となりの だんと まざったよ', 'おぼえにくい ところだね。となりの 九九から 1つ たしたり ひいたり して たしかめよう。'],
  plus_instead: ['かけ算なのに たし算 したよ', '「×」は おなじ数を なんかいも たす計算だよ。'],
  calc_slip: ['おしい! けいさんミスかも', 'やりかたは あってそう。さいごに もういちど けいさんを たしかめよう。'],
  unit_add: ['cmと mmを そのまま たしたよ', '1cm は 10mm。cm を mm に なおしてから たそう。'],
  unit_concat: ['cmと mmを ならべて かいたよ', '1cm は 10mm。cmの数を 10ばい してから mmを たすよ。'],
  unit_swap: ['cmと mmが ぎゃくだよ', 'cm は 大きい たんい、mm は 小さい たんい。10mm で 1cm になるよ。'],
  place_order: ['くらいが ぎゃくだよ', '100が いくつ→ひゃくのくらい、10が いくつ→じゅうのくらい、1が いくつ→いちのくらい。'],
  place_zero: ['0の かきわすれ・かきすぎ', '10が 0こ のときは、じゅうのくらいに 0を かこう。'],
  zero_slip: ['0の 数を まちがえたよ', '1万=10000(0が4こ)。0を 4こ とって かぞえてみよう。'],
  rem_too_big: ['あまりが わる数より 大きいよ', 'あまりは、いつも わる数より 小さくなるよ。もう1回 われるなら、まだ わりきれてないよ。'],
  quot_rem_swap: ['しょうと あまりが ぎゃくだよ', 'わり算の こたえは「しょう あまり」の じゅんばん。'],
  forgot_rem: ['あまりを わすれたよ', 'わりきれないときは「あまり」も こたえに かくよ。'],
  dec_align: ['小数点の いちを そろえてないよ', '小数の たし算・ひき算は、小数点を たてに そろえて かくよ。'],
  point_slip: ['小数点の いちが ずれたよ', 'こたえの 小数点は、たてに そろえた いちに うつそう。'],
  round_floor: ['ぜんぶ 切りすてたよ', '四捨五入は、見る けたが 0〜4なら 切りすて、5〜9なら 切り上げ。'],
  round_up: ['ぜんぶ 切り上げたよ', '四捨五入は、見る けたが 0〜4なら 切りすて、5〜9なら 切り上げ。'],
  round_place: ['まるめる くらいが ちがうよ', '「百の位までの がい数」は、ひとつ下の「十の位」を 見て まるめるよ。'],
  sign_mix: ['たし算と ひき算を まちがえたよ', '「+」は あわせる、「−」は とる。しきの きごうを ゆびで さして たしかめよう。'],
  mul_carry_forget: ['くり上がりを たしわすれたよ', 'いちのくらいの かけ算で 10を こえたら、その 10の ぶんを じゅうのくらいに たすよ。'],
  mul_place: ['じゅうのくらいの 10ばいを わすれたよ', 'じゅうのくらいの かけ算は 10が いくつ ぶんだから、答えも 10ばい(0を 1つ)するよ。'],
  div_swap: ['わる数を こたえに したよ', '「わる数」と「こたえ」は べつ。わる数の だんで 九九を さがそう。'],
  frac_den_add: ['ぶんぼも たし算・ひき算 したよ', 'ぶんぼ(下の数)は「なん分の 1か」を あらわすから、そのままだよ。かわるのは ぶんし(上の数)だけ。'],
  yomi_onkun_mix: ['音読みと 訓読みを まちがえたよ', '同じ 漢字でも「山(さん)」「山(やま)」のように 2つの 読み方が あるよ。ことばの 中で どちらか 考えよう。'],
  yomi_dakuten: ['にごる・にごらないを まちがえたよ', 'ことばが つながると「か→が」のように にごる ことが あるよ。声に 出して たしかめよう。'],
  yomi_small_kana: ['小さい「っ」「ゅ」などを まちがえたよ', '「学校(がっこう)」のように 小さい「っ」が はいる ことばが あるよ。'],
  yomi_long_vowel: ['のばす 音を まちがえたよ', '「こう」「きょう」のように のばす 音に 気を つけよう。'],
  yomi_similar_word: ['にている ことばと まちがえたよ', 'にた ことばが あるよ。文の 意味を 考えて えらぼう。'],
  yomi_other: ['読み方を まちがえたよ', 'もういちど 文を ゆっくり 読んで、声に 出して みよう。'],
  kaki_similar_kanji: ['形の にた 漢字と まちがえたよ', 'にた 形の 漢字が あるよ。ぶぶんごとに 見くらべよう。'],
  kaki_similar_sound: ['同じ 読みの 漢字と まちがえたよ', '同じ 読みでも 意味が ちがう 漢字が あるよ。文の 意味から えらぼう。'],
  kaki_other: ['漢字を まちがえたよ', 'もういちど 漢字の 形を よく 見て えらぼう。'],
  unknown: ['わからなかったね', 'だいじょうぶ!「わからない」って おしえてくれて ありがとう。いっしょに 見てみよう。'],
};

// ---- 問題の組み立て ---------------------------------------------------------
function build(text, correct, wrongs, why) {
  const seen = new Set([correct]);
  const choices = [{ label: correct, ok: true }];
  for (const [label, tag] of shuffle(wrongs)) {
    if (seen.has(label) || /^-|NaN/.test(label)) continue;
    seen.add(label);
    choices.push({ label, ok: false, tag });
    if (choices.length === 4) break;
  }
  return { text, why, choices: shuffle(choices) };
}

// ---- 2年生 ---------------------------------------------------------------
function add2() {
  const a1 = rnd(2, 9), b1 = rnd(10 - a1, 9);
  const a10 = rnd(1, 7), b10 = rnd(1, Math.max(1, 8 - a10));
  const a = a10 * 10 + a1, b = b10 * 10 + b1, c = a + b;
  return build(`${a} + ${b} = ?`, S(c), [
    [S(c - 10), 'carry_forget'], [S(c + 10), 'carry_double'],
    [S(c + 1), 'calc_slip'], [S(c - 1), 'calc_slip'], [S(c + 2), 'calc_slip'],
  ], `いちのくらい ${a1}+${b1}=${a1 + b1} → 1 くり上げる。じゅうのくらい ${a10}+${b10}+1=${a10 + b10 + 1}。こたえは ${c}`);
}

function sub2() {
  const a1 = rnd(0, 8), b1 = rnd(a1 + 1, 9);
  const a10 = rnd(2, 9), b10 = rnd(1, a10 - 1);
  const a = a10 * 10 + a1, b = b10 * 10 + b1, c = a - b;
  return build(`${a} − ${b} = ?`, S(c), [
    [S((a10 - b10) * 10 + (b1 - a1)), 'borrow_swap'], [S(c + 10), 'borrow_forget'],
    [S(c - 10), 'borrow_double'], [S(c + 1), 'calc_slip'], [S(c - 1), 'calc_slip'],
  ], `いちのくらいが ひけないので 10 かりる。${10 + a1}−${b1}=${10 + a1 - b1}。じゅうのくらいは ${a10 - 1}−${b10}=${a10 - 1 - b10}。こたえは ${c}`);
}

function len() {
  if (Math.random() < 0.5) {
    const c = rnd(1, 9), m = rnd(1, 9), a = c * 10 + m;
    return build(`${c}cm ${m}mm は なんmm?`, S(a), [
      [S(c + m), 'unit_add'], [S(c * 100 + m), 'unit_concat'], [S(m * 10 + c), 'unit_swap'],
      [S(a + 10), 'calc_slip'], [S(a - 1), 'calc_slip'],
    ], `1cm=10mm だから ${c}cm=${c * 10}mm。${c * 10}+${m}=${a}mm`);
  }
  let mm;
  do { mm = rnd(11, 99); } while (mm % 10 === 0);
  const c = Math.floor(mm / 10), m = mm % 10;
  return build(`${mm}mm は なんcm なんmm?`, `${c}cm ${m}mm`, [
    [`${m}cm ${c}mm`, 'unit_swap'], [`${mm}cm`, 'unit_concat'], [`${c}cm ${mm}mm`, 'unit_concat'],
    [`${c + 1}cm ${m}mm`, 'calc_slip'], [`${c}cm ${m + 1}mm`, 'calc_slip'],
  ], `10mm で 1cm。${mm}mm は 10mm が ${c}こ と ${m}mm だから ${c}cm ${m}mm`);
}

function place() {
  const h = rnd(1, 9), t = Math.random() < 0.5 ? 0 : rnd(1, 9), o = rnd(0, 9);
  const n = h * 100 + t * 10 + o;
  return build(`100が ${h}こ、10が ${t}こ、1が ${o}こ で いくつ?`, S(n), [
    [S(o * 100 + t * 10 + h), 'place_order'], [S(h * 10 + o), 'place_zero'],
    [S(h * 1000 + t * 100 + o), 'place_zero'], [S(h + t + o), 'place_order'], [S(n + 10), 'calc_slip'],
  ], `${h * 100} + ${t * 10} + ${o} = ${n}`);
}

function kuku() {
  const a = rnd(2, 9), b = rnd(2, 9), c = a * b;
  const swap = c >= 10 ? Number(String(c).split('').reverse().join('')) : c;
  return build(`${a} × ${b} = ?`, S(c), [
    [S(a * (b + 1)), 'kuku_neighbor'], [S(a * (b - 1)), 'kuku_neighbor'], [S((a + 1) * b), 'kuku_neighbor'],
    [S(a + b), 'plus_instead'], [S(swap), 'calc_slip'], [S(c + 10), 'calc_slip'],
  ], `${a}の だん:${Array.from({ length: b }, (_, i) => a * (i + 1)).join('、')}。${a}×${b}=${c}`);
}

// ---- 4年生 ---------------------------------------------------------------
function bignum() {
  const k = rnd(12, 999), n = k * 10000;
  return build(`${fmtN(n)} は 1万(10000)が なんこ分?`, S(k), [
    [S(k * 10), 'zero_slip'], [S(k * 100), 'zero_slip'], [S(Math.floor(k / 10)), 'zero_slip'],
    [S(k * 1000), 'zero_slip'], [S(k + 1), 'calc_slip'],
  ], `${fmtN(n)} の 0を 4こ とると ${k}。1万が ${k}こ分`);
}

function div() {
  const b = rnd(3, 9), q = rnd(10, 99), r = rnd(1, b - 1), a = b * q + r;
  return build(`${a} ÷ ${b} = ?`, `${q}あまり${r}`, [
    [`${q}あまり${r + b}`, 'rem_too_big'], [`${q - 1}あまり${r + b}`, 'rem_too_big'],
    [`${q}`, 'forgot_rem'], [`${r}あまり${q}`, 'quot_rem_swap'],
    [`${q + 1}あまり${r}`, 'calc_slip'], [`${q}あまり${Math.max(b - r, 1)}`, 'calc_slip'],
  ], `${b}×${q}=${b * q}、${a}−${b * q}=${r}。あまり ${r} は わる数 ${b} より 小さいね`);
}

function decimal() {
  const add = Math.random() < 0.5;
  let Y;
  do { Y = rnd(101, 399); } while (Y % 10 === 0);
  const X = add ? rnd(11, 99) : rnd(40, 99);
  const x = X * 10;
  const c = add ? x + Y : x - Y;
  const align = add ? X + Y : Math.abs(X - Y);
  const sign = add ? '+' : '−';
  return build(`${fmtD(x)} ${sign} ${fmtD(Y)} = ?`, fmtD(c), [
    [fmtD(align), 'dec_align'], [fmtD(c * 10), 'point_slip'],
    [fmtD(c + 10), 'calc_slip'], [fmtD(c - 10), 'calc_slip'], [fmtD(c + 100), 'calc_slip'],
  ], `小数点を たてに そろえて ${fmtD(x)} ${sign} ${fmtD(Y)} = ${fmtD(c)}`);
}

function gaisu() {
  const p = pick([10, 100, 1000]);
  let n;
  do { n = rnd(1000, 99999); } while (n % p === 0);
  const r = Math.round(n / p) * p;
  const nm = { 10: '十', 100: '百', 1000: '千' }[p];
  const low = { 10: '一', 100: '十', 1000: '百' }[p];
  const d = Math.floor((n % p) / (p / 10));
  return build(`${fmtN(n)} を 四捨五入して、${nm}の位までの がい数に しよう`, fmtN(r), [
    [fmtN(Math.floor(n / p) * p), 'round_floor'], [fmtN(Math.ceil(n / p) * p), 'round_up'],
    [fmtN(Math.round(n / (p * 10)) * p * 10), 'round_place'], [fmtN(Math.round(n / (p / 10)) * (p / 10)), 'round_place'],
    [fmtN(r + p), 'calc_slip'], [fmtN(r - p), 'calc_slip'],
    [fmtN(r + 2 * p), 'calc_slip'], [fmtN(r - 2 * p), 'calc_slip'],
  ], `ひとつ下の ${low}の位は ${d}。${d >= 5 ? '5いじょうだから 切り上げ' : '4いか だから 切りすて'}。こたえ ${fmtN(r)}`);
}

// ---- 1年生 ---------------------------------------------------------------
function add1() {
  const a = rnd(1, 8), b = rnd(1, 9 - a), c = a + b;
  return build(`${a} + ${b} = ?`, S(c), [
    [S(c + 1), 'calc_slip'], [S(c - 1), 'calc_slip'], [S(c + 2), 'calc_slip'], [S(Math.abs(a - b)), 'sign_mix'],
  ], `${a}に ${b}を たすと ${c}。ゆびや おはじきで かぞえて たしかめよう`);
}

function add1c() {
  const a = rnd(2, 9), b = rnd(11 - a, 9), c = a + b, k = 10 - a;
  return build(`${a} + ${b} = ?`, S(c), [
    [S(c - 10), 'carry_forget'], [S(c + 10), 'carry_double'], [S(c + 1), 'calc_slip'], [S(c - 1), 'calc_slip'], [S(Math.abs(a - b)), 'sign_mix'],
  ], `${a}は あと ${k}で 10。${b}を ${k}と ${b - k}に わけて、10+${b - k}=${c}`);
}

function sub1() {
  const a = rnd(3, 10), b = rnd(1, a - 1), c = a - b;
  return build(`${a} − ${b} = ?`, S(c), [
    [S(c + 1), 'calc_slip'], [S(c - 1), 'calc_slip'], [S(a + b), 'sign_mix'], [S(c + 2), 'calc_slip'],
  ], `${a}から ${b}を とると ${c}。のこりを かぞえてみよう`);
}

function sub1c() {
  const a = rnd(11, 18), b = rnd(Math.max(a - 9, 2), 9), c = a - b;
  return build(`${a} − ${b} = ?`, S(c), [
    [S(b - (a - 10)), 'borrow_swap'], [S(c + 10), 'borrow_forget'], [S(c + 1), 'calc_slip'], [S(c - 1), 'calc_slip'], [S(a + b), 'sign_mix'],
  ], `${a}を 10と ${a - 10}に わける。10から ${b}を ひいて ${10 - b}、${10 - b}+${a - 10}=${c}`);
}

function num1() {
  const t = rnd(1, 9), o = rnd(0, 9), n = t * 10 + o;
  return build(`10が ${t}こ と 1が ${o}こ で いくつ?`, S(n), [
    [S(o * 10 + t), 'place_order'], [S(t * 100 + o), 'place_zero'], [S(n + 10), 'calc_slip'], [S(n - 10), 'calc_slip'], [S(t + o), 'place_order'],
  ], `10が ${t}こ で ${t * 10}、1が ${o}こ。あわせて ${n}`);
}

// ---- 3年生 ---------------------------------------------------------------
function mul3() {
  let a1, b;
  do { a1 = rnd(2, 9); b = rnd(2, 9); } while (a1 * b < 10);
  const a10 = rnd(1, 4), a = a10 * 10 + a1, c = a * b;
  return build(`${a} × ${b} = ?`, S(c), [
    [S(a10 * b * 10 + ((a1 * b) % 10)), 'mul_carry_forget'], [S(a1 * b + a10 * b), 'mul_place'],
    [S(c + 10), 'calc_slip'], [S(c - 10), 'calc_slip'], [S(c + 1), 'calc_slip'],
  ], `${a1}×${b}=${a1 * b} → ${(a1 * b) % 10}を かいて ${Math.floor((a1 * b) / 10)}を くり上げ。${a10}×${b}=${a10 * b}、+${Math.floor((a1 * b) / 10)}=${a10 * b + Math.floor((a1 * b) / 10)}。こたえ ${c}`);
}

function div3() {
  const b = rnd(2, 9), q = rnd(2, 9), a = b * q;
  return build(`${a} ÷ ${b} = ?`, S(q), [
    [S(q + 1), 'kuku_neighbor'], [S(q - 1), 'kuku_neighbor'], [S(b), 'div_swap'], [S(a - b), 'calc_slip'], [S(q + 2), 'calc_slip'], [S(q - 2), 'calc_slip'],
  ], `${b}の だんで ${a}に なるのは ${b}×${q}=${a}。だから ${a}÷${b}=${q}`);
}

function big3() {
  const th = rnd(1, 9), h = Math.random() < 0.5 ? 0 : rnd(1, 9), t = rnd(0, 9), o = rnd(0, 9);
  const n = th * 1000 + h * 100 + t * 10 + o;
  const noZero = Number(`${th}${h}${t}${o}`.replace(/0/g, ''));
  return build(`1000が ${th}こ、100が ${h}こ、10が ${t}こ、1が ${o}こ で いくつ?`, S(n), [
    [S(noZero), 'place_zero'], [S(Number(`${o}${t}${h}${th}`)), 'place_order'],
    [S(n + 100), 'calc_slip'], [S(n - 100), 'calc_slip'], [S(n + 1000), 'calc_slip'], [S(th + h + t + o), 'place_order'],
  ], `${th * 1000} + ${h * 100} + ${t * 10} + ${o} = ${n}(0の くらいも わすれずに)`);
}

function frac3() {
  const d = rnd(5, 9);
  if (Math.random() < 0.5) {
    const a = rnd(1, d - 3), b = rnd(1, d - 1 - a);
    return build(`${d}分の${a} + ${d}分の${b} = ?`, `${d}分の${a + b}`, [
      [`${d + d}分の${a + b}`, 'frac_den_add'], [`${d}分の${a + b + 1}`, 'calc_slip'], [`${d}分の${a + b - 1}`, 'calc_slip'], [`${d}分の${a * b}`, 'calc_slip'],
    ], `${d}分の 1が ${a}こ と ${b}こ で ${a + b}こ。わる数(ぶんぼ)の ${d}は そのまま!`);
  }
  const a = rnd(3, d - 1), b = rnd(1, a - 1);
  return build(`${d}分の${a} − ${d}分の${b} = ?`, `${d}分の${a - b}`, [
    [`${d - b}分の${a - b}`, 'frac_den_add'], [`${d}分の${a + b}`, 'sign_mix'], [`${d}分の${a - b + 1}`, 'calc_slip'], [`${d}分の${a - b - 1}`, 'calc_slip'], [`${d + 1}分の${a - b}`, 'frac_den_add'],
  ], `${d}分の 1が ${a}こ から ${b}こ とると ${a - b}こ。ぶんぼの ${d}は そのまま!`);
}

function dec3() {
  const n = rnd(11, 59);
  return build(`0.1が ${n}こ で いくつ?`, fmtD(n * 10), [
    [fmtD(n), 'point_slip'], [S(n), 'point_slip'], [fmtD(n * 10 + 10), 'calc_slip'], [fmtD(n * 10 - 10), 'calc_slip'], [fmtD(n * 100), 'point_slip'],
  ], `0.1が 10こで 1。${n}こは ${n}÷10 だから ${fmtD(n * 10)}`);
}

// ---- 単元表(学年・学校の進度の目安。months は学校の学期の目安) ---------------
export const UNITS = {
  1: [
    { id: 'g1_add', name: 'たし算(10までの数)', months: [], gen: add1 },
    { id: 'g1_addc', name: 'たし算(くり上がり)', months: [], gen: add1c },
    { id: 'g1_sub', name: 'ひき算(10までの数)', months: [], gen: sub1 },
    { id: 'g1_subc', name: 'ひき算(くり下がり)', months: [], gen: sub1c },
    { id: 'g1_num', name: '100までの 数', months: [], gen: num1 },
  ],
  3: [
    { id: 'g3_big', name: '1万までの 数', months: [], gen: big3 },
    { id: 'g3_mul', name: '2けた × 1けた', months: [], gen: mul3 },
    { id: 'g3_div', name: 'わり算(九九)', months: [], gen: div3 },
    { id: 'g3_frac', name: '分数の たし算・ひき算', months: [], gen: frac3 },
    { id: 'g3_dec', name: '小数(0.1)', months: [], gen: dec3 },
  ],
  2: [
    { id: 'g2_add', name: 'たし算の ひっ算', months: [4, 5, 6], gen: add2 },
    { id: 'g2_sub', name: 'ひき算の ひっ算', months: [5, 6, 7], gen: sub2 },
    { id: 'g2_len', name: '長さ(cm と mm)', months: [7, 9, 10], gen: len },
    { id: 'g2_place', name: '3けたの 数', months: [9, 10], gen: place },
    { id: 'g2_kuku', name: 'かけ算(九九)', months: [10, 11, 12, 1, 2], gen: kuku },
  ],
  4: [
    { id: 'g4_big', name: '大きな 数', months: [4, 5, 6], gen: bignum },
    { id: 'g4_div', name: 'わり算の ひっ算', months: [6, 7, 10, 11], gen: div },
    { id: 'g4_round', name: 'がい数', months: [9, 10], gen: gaisu },
    { id: 'g4_dec', name: '小数の たし算・ひき算', months: [10, 11, 12], gen: decimal },
  ],
};

// 「これが できないと 次が むずかしい」という前提つながり(さかのぼり診断に使う)
const PRE = {
  g1_addc: ['g1_add'], g1_subc: ['g1_sub'],
  g2_add: ['g1_addc', 'g1_num'], g2_sub: ['g1_subc', 'g1_num'], g2_place: ['g1_num'], g2_len: ['g2_place'], g2_kuku: ['g2_add'],
  g3_big: ['g2_place'], g3_mul: ['g2_kuku', 'g2_add'], g3_div: ['g2_kuku'], g3_frac: ['g2_add', 'g2_sub'], g3_dec: ['g2_place'],
  g4_big: ['g3_big'], g4_div: ['g3_div', 'g3_mul', 'g2_sub'], g4_round: ['g3_big'], g4_dec: ['g3_dec', 'g2_add', 'g2_sub'],
};
for (const [g, us] of Object.entries(UNITS)) for (const u of us) { u.grade = Number(g); u.pre = PRE[u.id] || []; u.subject = u.subject || '算数'; }

export const byId = Object.fromEntries(Object.values(UNITS).flat().map((u) => [u.id, u]));
export const unitsOf = (grade) => UNITS[grade] || [];

// ---- 国語(Gemini が毎朝ふやす 問題プールから出題) -----------------------------------
let seenIds = new Set();
export const setSeen = (ids) => { seenIds = new Set(ids); };
// 入っていて よいのは <small> と <br> だけ(それ以外の < は 文字として あつかう)
const sanitize = (t) => String(t).replace(/<(?!\/?small>|br>)/g, '&lt;');

function fromPool(unit) {
  const fresh = unit.pool.filter((p) => !seenIds.has(p.id));
  const it = pick(fresh.length ? fresh : unit.pool); // 全部 見たら くりかえし
  const choices = shuffle([{ label: it.correct, ok: true }, ...it.wrong.map((w) => ({ label: w.label, ok: false, tag: w.tag }))]);
  return { text: sanitize(it.text), why: String(it.why).replace(/[<>&]/g, ''), choices, id: it.id };
}

export function registerKokugo(items) {
  const byGrade = {};
  for (const it of items) (byGrade[it.grade] = byGrade[it.grade] || []).push(it);
  for (const [g, list] of Object.entries(byGrade)) {
    const grade = Number(g);
    if (list.length < 5) continue;
    const id = `g${grade}_kanji`;
    if (byId[id]) { byId[id].pool = list; continue; }
    const unit = { id, name: '漢字(読み・書き)', subject: '国語', months: [], grade, pre: [], pool: list, gen: () => fromPool(unit) };
    (UNITS[grade] = UNITS[grade] || []).push(unit);
    byId[id] = unit;
  }
  // 前提: ひとつ下の学年の漢字
  for (const u of Object.values(byId)) if (u.subject === '国語') u.pre = byId[`g${u.grade - 1}_kanji`] ? [`g${u.grade - 1}_kanji`] : [];
}
// その学年まで(1年生〜その学年)のすべての単元
export const skillsUpTo = (grade) => Object.keys(UNITS).map(Number).filter((g) => g <= grade).sort().flatMap((g) => UNITS[g]);

export function currentUnits(grade, month, overrideId) {
  const all = unitsOf(grade).filter((u) => u.subject !== '国語');
  const ov = all.find((u) => u.id === overrideId);
  if (ov) return [ov];
  const cur = all.filter((u) => u.months.includes(month));
  return cur.length ? cur : [all[all.length - 1]];
}

export function makeQuestion(unit) {
  return { ...unit.gen(), unit: unit.id };
}
