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
  time_60: ['60分で 1時間 だよ', '時間や 分は 60ずつで くり上がるよ(60分=1時間、60秒=1分)。100ではないよ。'],
  unit_zero: ['0の 数を まちがえたよ', '1m=100cm、1L=10dL など、たんいの 関係を もういちど たしかめよう。'],
  area_perim: ['まわりの 長さと まちがえたよ', '面積は「たて×よこ」。まわりの 長さは「たて+よこ」を 2つ ぶん だよ。'],
  angle_straight: ['一直線の 角は 180°だよ', '一直線の 角は 180°。90°や 360°と まざらないように しよう。'],
  angle_sum: ['三角形の 角の 和は 180°だよ', '三角形の 3つの 角を あわせると 180°。のこりの 角は 180から ひくよ。'],
  frac_swap: ['ぶんしと ぶんぼが ぎゃくだよ', '「4分の1」は 下の数(4)が わけた 数、上の数(1)が とった 数だよ。'],
  frac_improper: ['仮分数と 帯分数の 直しかたを まちがえたよ', '仮分数→帯分数は わり算(7÷4=1あまり3 → 1と4分の3)。あまりが ぶんしに なるよ。'],
  order_ltr: ['計算の じゅんばんを まちがえたよ', 'かけ算・わり算が さき。( ) の 中は もっと さき。左から じゅんに とは かぎらないよ。'],
  radius_diam: ['半径と 直径を まちがえたよ', '直径は 半径の 2ばい。半径は 直径の 半分だよ。'],
  know_mixup: ['ちかい ことと まちがえたよ', 'えらんだ ものの せつめいを よんで、せいかいと くらべてみよう。'],
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

// ---- 九九マスター(1〜9の だん・ぜんぶ・□を さがす) -----------------------------------------
// だん ごとの れんしゅう。かたちを かえて(a×b / b×a / a×□=c)おなじ もんだいに ならないように する
function kukuDan(d) {
  const a = d; const b = rnd(1, 9), c = a * b;
  const swap = c >= 10 ? Number(String(c).split('').reverse().join('')) : c + 1;
  const form = rnd(0, 3);
  const why = `${a}の だん:${Array.from({ length: 9 }, (_, i) => a * (i + 1)).slice(0, Math.max(b, 3)).join('、')}。${a}×${b}=${c}`;
  if (form === 2) { // a × □ = c
    return build(`${a} × □ = ${c}  □に はいる 数は?`, S(b), [
      [S(b + 1), 'kuku_neighbor'], [S(b - 1), 'kuku_neighbor'], [S(c - a), 'calc_slip'], [S(a), 'plus_instead'], [S(b + 2), 'calc_slip'], [S(c), 'calc_slip'],
    ], `${a}の だん で ${c} に なるのは ${a}×${b}。□は ${b}`);
  }
  if (form === 1 && a !== b) return build(`${b} × ${a} = ?`, S(c), [
    [S(b * (a + 1)), 'kuku_neighbor'], [S(b * (a - 1)), 'kuku_neighbor'], [S((b + 1) * a), 'kuku_neighbor'], [S(a + b), 'plus_instead'], [S(swap), 'calc_slip'], [S(c + 10), 'calc_slip'],
  ], `${b}×${a} と ${a}×${b} は おなじ こたえ。${why}`);
  return build(`${a} × ${b} = ?`, S(c), [
    [S(a * (b + 1)), 'kuku_neighbor'], [S(a * (b - 1)), 'kuku_neighbor'], [S((a + 1) * b), 'kuku_neighbor'], [S(a + b), 'plus_instead'], [S(swap), 'calc_slip'], [S(c + 10), 'calc_slip'],
  ], why);
}
function kukuInv() { // □ × a = c / c ÷ a の 九九
  const a = rnd(2, 9), b = rnd(2, 9), c = a * b;
  if (Math.random() < 0.5) return build(`□ × ${a} = ${c}  □に はいる 数は?`, S(b), [
    [S(b + 1), 'kuku_neighbor'], [S(b - 1), 'kuku_neighbor'], [S(c - a), 'calc_slip'], [S(a), 'plus_instead'], [S(b + 2), 'calc_slip'],
  ], `${a}の だんで ${c} に なるのは ${a}×${b}。□は ${b}`);
  return build(`${a} の だんで、こたえが ${c} に なる 九九は?`, `${a} × ${b}`, [
    [`${a} × ${b + 1}`, 'kuku_neighbor'], [`${a} × ${b - 1}`, 'kuku_neighbor'], [`${a + 1} × ${b}`, 'kuku_neighbor'], [`${b} × ${b}`, 'calc_slip'], [`${a} × ${a}`, 'calc_slip'],
  ], `${a}×${b}=${c}`);
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

// ---- 追加の算数(2年〜4年) ----------------------------------------------------
const hm = (h, m) => `${h}時${m}分`;

function time2() {
  if (Math.random() < 0.5) {
    const h = rnd(1, 9), m = pick([10, 15, 20, 25, 30, 35, 40, 45, 50]), d = pick([20, 30, 40, 45, 50, 60, 70, 80]);
    const t = h * 60 + m + d, ch = Math.floor(t / 60), cm = t % 60;
    return build(`${hm(h, m)}から ${d}分たつと、なん時なん分?`, hm(ch, cm), [
      [hm(h, m + d), 'time_60'], [hm(ch, (cm + 10) % 60), 'calc_slip'], [hm(ch + 1, cm), 'calc_slip'], [hm(ch - 1, cm), 'calc_slip'],
      [hm(h, Math.abs(m - d)), 'sign_mix'],
    ], `${hm(h, m)}の ${d}分あとは、60分で 1時間と 考えて ${hm(ch, cm)}`);
  }
  const h = rnd(1, 3), m = pick([10, 15, 20, 30, 40, 45, 50]), c = h * 60 + m;
  return build(`${h}時間${m}分は なん分?`, S(c), [
    [S(h * 100 + m), 'time_60'], [S(h + m), 'unit_add'], [S(c + 10), 'calc_slip'], [S(c - 10), 'calc_slip'], [S(h * 10 + m), 'unit_concat'],
  ], `1時間=60分 だから ${h}時間=${h * 60}分。${h * 60}+${m}=${c}分`);
}

function len2() {
  if (Math.random() < 0.5) {
    const m = rnd(1, 5), c = pick([10, 20, 25, 30, 40, 50, 60, 75, 80, 90]), a = m * 100 + c;
    return build(`${m}m ${c}cm は なんcm?`, S(a), [
      [S(m + c), 'unit_add'], [S(m * 1000 + c), 'unit_concat'], [S(m * 10 + c), 'unit_zero'], [S(a + 10), 'calc_slip'], [S(a - 10), 'calc_slip'],
    ], `1m=100cm だから ${m}m=${m * 100}cm。${m * 100}+${c}=${a}cm`);
  }
  const cm = pick([120, 135, 150, 160, 175, 205, 230, 240, 250, 280, 315, 340]), m = Math.floor(cm / 100), r = cm % 100;
  return build(`${cm}cm は なんm なんcm?`, `${m}m ${r}cm`, [
    [`${r}m ${m}cm`, 'unit_swap'], [`${m * 10}m ${r}cm`, 'unit_zero'], [`${m + 1}m ${r}cm`, 'calc_slip'], [`${m}m ${r + 10}cm`, 'calc_slip'], [`${cm}m`, 'unit_concat'],
  ], `100cm で 1m。${cm}cm は 100cm が ${m}こ と ${r}cm だから ${m}m ${r}cm`);
}

function liter() {
  if (Math.random() < 0.5) {
    const l = rnd(1, 5), d = rnd(1, 9), a = l * 10 + d;
    return build(`${l}L ${d}dL は なんdL?`, S(a), [
      [S(l + d), 'unit_add'], [S(l * 100 + d), 'unit_concat'], [S(d * 10 + l), 'unit_swap'], [S(a + 10), 'calc_slip'], [S(a - 1), 'calc_slip'],
    ], `1L=10dL だから ${l}L=${l * 10}dL。${l * 10}+${d}=${a}dL`);
  }
  const l = rnd(1, 4);
  return build(`${l}L は なんmL?`, S(l * 1000), [
    [S(l * 100), 'zero_slip'], [S(l * 10000), 'zero_slip'], [S(l * 10), 'zero_slip'], [S(l * 1000 + 100), 'calc_slip'],
  ], `1L=1000mL だから ${l}L=${l * 1000}mL`);
}

function add3() {
  if (Math.random() < 0.5) {
    let a, b;
    do { a = rnd(120, 780); b = rnd(35, 299); } while ((a % 10) + (b % 10) < 10 || a + b > 999);
    const c = a + b;
    return build(`${a} + ${b} = ?`, S(c), [
      [S(c - 10), 'carry_forget'], [S(c - 100), 'carry_forget'], [S(c + 10), 'carry_double'], [S(c + 1), 'calc_slip'], [S(c - 1), 'calc_slip'],
    ], `くらいを そろえて 一のくらいから。くり上がりの 1を わすれずに たして ${c}`);
  }
  let a, b;
  do { a = rnd(230, 950); b = rnd(35, 289); } while ((a % 10) >= (b % 10) || a <= b);
  const c = a - b;
  return build(`${a} − ${b} = ?`, S(c), [
    [S(c + 10), 'borrow_forget'], [S(c + 100), 'borrow_forget'], [S(c - 10), 'borrow_double'], [S(c + 1), 'calc_slip'], [S(c - 1), 'calc_slip'],
  ], `一のくらいが ひけないときは となりから 10 かりて、かりた ぶんを へらして ${c}`);
}

function frac2() {
  const n = pick([2, 3, 4, 8]);
  return build(`同じ 大きさに ${n}つに わけた 1つ分を、分数で いうと?`, `${n}分の1`, [
    [`1分の${n}`, 'frac_swap'], [`${n}分の${n}`, 'frac_swap'], [`${n + 1}分の1`, 'calc_slip'], [`${Math.max(n - 1, 2)}分の1`, 'calc_slip'], [`${n}分の2`, 'calc_slip'],
  ], `${n}つに わけた 1つ分は「${n}分の1」。下の数が わけた 数だよ`);
}

function mul2() {
  const a = rnd(12, 48), b = rnd(12, 39), c = a * b;
  return build(`${a} × ${b} = ?`, S(c), [
    [S(a * (b % 10) + a * Math.floor(b / 10)), 'mul_place'], [S(c + 10), 'calc_slip'], [S(c - 10), 'calc_slip'], [S(c + 100), 'calc_slip'], [S(c - 100), 'calc_slip'],
  ], `${a}×${b % 10}=${a * (b % 10)}、${a}×${Math.floor(b / 10)}0=${a * Math.floor(b / 10) * 10}。あわせて ${c}`);
}

function divr() {
  const b = rnd(3, 9), q = rnd(2, 9), r = rnd(1, b - 1), a = b * q + r;
  return build(`${a} ÷ ${b} = ?`, `${q}あまり${r}`, [
    [`${q}あまり${r + b}`, 'rem_too_big'], [`${q - 1}あまり${r + b}`, 'rem_too_big'], [`${q}`, 'forgot_rem'], [`${r}あまり${q}`, 'quot_rem_swap'],
    [`${q + 1}あまり${r}`, 'calc_slip'], [`${q}あまり${Math.max(b - r, 1)}`, 'calc_slip'],
  ], `${b}×${q}=${b * q}、${a}−${b * q}=${r}。あまり ${r} は わる数 ${b} より 小さいね`);
}

function time3() {
  const m = rnd(1, 5), s = pick([10, 15, 20, 25, 30, 40, 45, 50]), c = m * 60 + s;
  return build(`${m}分${s}秒は なん秒?`, S(c), [
    [S(m * 100 + s), 'time_60'], [S(m + s), 'unit_add'], [S(c + 10), 'calc_slip'], [S(c - 10), 'calc_slip'], [S(m * 10 + s), 'unit_concat'],
  ], `1分=60秒 だから ${m}分=${m * 60}秒。${m * 60}+${s}=${c}秒`);
}

function len3() {
  const t = rnd(0, 2);
  if (t === 0) {
    const k = rnd(1, 6), m = pick([100, 200, 250, 300, 400, 500, 600, 750]), c = k * 1000 + m;
    return build(`${k}km ${m}m は なんm?`, S(c), [
      [S(k * 100 + m), 'zero_slip'], [S(k + m), 'unit_add'], [S(k * 10000 + m), 'zero_slip'], [S(c + 100), 'calc_slip'],
    ], `1km=1000m だから ${k}km=${k * 1000}m。${k * 1000}+${m}=${c}m`);
  }
  if (t === 1) {
    const k = rnd(1, 5), g = pick([100, 200, 250, 300, 400, 500, 600, 750]), c = k * 1000 + g;
    return build(`${k}kg ${g}g は なんg?`, S(c), [
      [S(k * 100 + g), 'zero_slip'], [S(k + g), 'unit_add'], [S(k * 10000 + g), 'zero_slip'], [S(c + 100), 'calc_slip'],
    ], `1kg=1000g だから ${k}kg=${k * 1000}g。${k * 1000}+${g}=${c}g`);
  }
  const k = rnd(1, 9);
  return build(`${k}000m は なんkm?`, `${k}km`, [
    [`${k}00km`, 'zero_slip'], [`${k}0km`, 'zero_slip'], [`${k * 10}km`, 'zero_slip'], [`${k}m`, 'unit_swap'],
  ], `1000m=1km だから ${k}000m=${k}km`);
}

function addsub4() {
  if (Math.random() < 0.5) {
    let a, b;
    do { a = rnd(1200, 7800); b = rnd(1100, 2900); } while ((a % 100) + (b % 100) < 100);
    const c = a + b;
    return build(`${a} + ${b} = ?`, S(c), [
      [S(c - 100), 'carry_forget'], [S(c - 10), 'carry_forget'], [S(c + 100), 'carry_double'], [S(c + 10), 'calc_slip'], [S(c - 1000), 'carry_forget'],
    ], `一のくらいから じゅんに。くり上がりの 1を わすれずに たして ${c}`);
  }
  let a, b;
  do { a = rnd(3500, 9800); b = rnd(1100, 2900); } while ((a % 100) >= (b % 100) || a <= b);
  const c = a - b;
  return build(`${a} − ${b} = ?`, S(c), [
    [S(c + 100), 'borrow_forget'], [S(c + 10), 'borrow_forget'], [S(c - 100), 'borrow_double'], [S(c + 1000), 'borrow_forget'], [S(c - 10), 'calc_slip'],
  ], `ひけない くらいは となりから 10 かりて、かりた ぶんを へらして ${c}`);
}

function circle() {
  const r = rnd(2, 9);
  if (Math.random() < 0.5) {
    return build(ruby(`{半径|はんけい}が ${r}cmの 円の {直径|ちょっけい}は なんcm?`), S(r * 2), [
      [S(r), 'radius_diam'], [S(r * r), 'calc_slip'], [S(r + 2), 'calc_slip'], [S(r * 3), 'calc_slip'], [S(r * 2 + 2), 'calc_slip'], [S(r * 2 + 1), 'calc_slip'], [S(r * 2 - 1), 'calc_slip'], [S(r * 4), 'calc_slip'],
    ], ruby(`{直径|ちょっけい}は {半径|はんけい}の 2ばい。${r}×2=${r * 2}cm`));
  }
  return build(ruby(`{直径|ちょっけい}が ${r * 2}cmの 円の {半径|はんけい}は なんcm?`), S(r), [
    [S(r * 2), 'radius_diam'], [S(r * 4), 'radius_diam'], [S(r + 1), 'calc_slip'], [S(r - 1), 'calc_slip'], [S(r * 2 - 2), 'calc_slip'], [S(r + 2), 'calc_slip'], [S(r + 3), 'calc_slip'],
  ], ruby(`{半径|はんけい}は {直径|ちょっけい}の 半分。${r * 2}÷2=${r}cm`));
}

function dec2() {
  const add = Math.random() < 0.5;
  let x, y;
  if (add) { x = rnd(3, 9); y = rnd(3, 9); } else { x = rnd(11, 29); y = rnd(2, 9); }
  const c = add ? x + y : x - y;
  const sign = add ? '+' : '−';
  return build(`${fmtD(x * 10)} ${sign} ${fmtD(y * 10)} = ?`, fmtD(c * 10), [
    [fmtD(c), 'point_slip'], [S(c), 'point_slip'], [fmtD(c * 10 + 10), 'calc_slip'], [fmtD(c * 10 - 10), 'calc_slip'], [fmtD(c * 10 + 20), 'calc_slip'],
  ], `0.1が ${x}こ ${add ? 'と' : 'から'} ${y}こ ${add ? 'で' : 'とって'} 0.1が ${c}こ → ${fmtD(c * 10)}`);
}

function angle() {
  const t = rnd(0, 2);
  if (t === 0) {
    const a = pick([30, 40, 50, 60, 70, 110, 120, 130, 140, 150]);
    return build(`一直線の 上で、一方の 角が ${a}°の とき、もう一方の 角は なん°?`, `${180 - a}°`, [
      [`${Math.abs(90 - a)}°`, 'angle_straight'], [`${360 - a}°`, 'angle_straight'], [`${180 + a}°`, 'angle_straight'], [`${180 - a + 10}°`, 'calc_slip'], [`${180 - a - 10}°`, 'calc_slip'],
    ], `一直線の 角は 180°。180−${a}=${180 - a}°`);
  }
  const a = pick([30, 40, 45, 50, 60, 70]), b = pick([30, 40, 50, 60, 70, 80]);
  if (t === 1) {
    return build(`三角形の 2つの 角が ${a}°と ${b}°の とき、のこりの 角は なん°?`, `${180 - a - b}°`, [
      [`${a + b}°`, 'angle_sum'], [`${360 - a - b}°`, 'angle_sum'], [`${Math.abs(90 - a - b)}°`, 'angle_sum'], [`${180 - a - b + 10}°`, 'calc_slip'], [`${180 - a - b - 10}°`, 'calc_slip'],
    ], `三角形の 3つの 角を あわせると 180°。180−${a}−${b}=${180 - a - b}°`);
  }
  const k = pick([90, 180, 270, 360]);
  return build(`${k}° は 直角 いくつ分?`, S(k / 90), [
    [S(k / 45), 'angle_straight'], [S(k / 180), 'angle_straight'], [S(k / 90 + 1), 'calc_slip'], [S(k / 90 + 2), 'calc_slip'],
  ], `直角は 90°。${k}÷90=${k / 90}こ分`);
}

function area() {
  const t = rnd(0, 2);
  if (t === 0) {
    let a, b;
    do { a = rnd(3, 12); b = rnd(3, 12); } while (a === b);
    return build(`たて ${a}cm、よこ ${b}cm の 長方形の 面積は なんcm²?`, S(a * b), [
      [S(2 * (a + b)), 'area_perim'], [S(a + b), 'plus_instead'], [S(a * b + a), 'calc_slip'], [S(a * b - b), 'calc_slip'], [S(a * 2 * b), 'calc_slip'],
    ], `長方形の 面積は「たて×よこ」。${a}×${b}=${a * b}cm²`);
  }
  if (t === 1) {
    const a = rnd(3, 12);
    return build(`1辺が ${a}cm の 正方形の 面積は なんcm²?`, S(a * a), [
      [S(a * 4), 'area_perim'], [S(a * 2), 'plus_instead'], [S(a * a + a), 'calc_slip'], [S(a * a - a), 'calc_slip'], [S(a * a + 1), 'calc_slip'], [S(a * a - 1), 'calc_slip'],
    ], `正方形の 面積は「1辺×1辺」。${a}×${a}=${a * a}cm²`);
  }
  const m = rnd(2, 6);
  return build(`${m}m² は なんcm²?`, S(m * 10000), [
    [S(m * 100), 'zero_slip'], [S(m * 1000), 'zero_slip'], [S(m * 100000), 'zero_slip'], [S(m * 10000 + 100), 'calc_slip'],
  ], `1m=100cm だから 1m²=100×100=10000cm²。${m}m²=${m * 10000}cm²`);
}

function decmul() {
  const n = rnd(2, 6);
  if (Math.random() < 0.5) {
    const x = rnd(12, 49), c = x * n;
    return build(`${fmtD(x * 10)} × ${n} = ?`, fmtD(c * 10), [
      [S(c), 'point_slip'], [fmtD(c), 'point_slip'], [fmtD(c * 10 + 10), 'calc_slip'], [fmtD(c * 10 - 10), 'calc_slip'], [fmtD(c * 100), 'point_slip'],
    ], `0.1が ${x}こ の ${n}ばい だから 0.1が ${c}こ → ${fmtD(c * 10)}`);
  }
  let q, c;
  do { q = rnd(12, 49); c = q * n; } while (c % 10 === 0); // 割り切れる「小数÷整数」だけ(整数÷整数が小数になる問題は出さない)
  return build(`${fmtD(c * 10)} ÷ ${n} = ?`, fmtD(q * 10), [
    [S(q), 'point_slip'], [fmtD(q), 'point_slip'], [fmtD(q * 10 + 10), 'calc_slip'], [fmtD(q * 10 - 10), 'calc_slip'], [fmtD(q * 100), 'point_slip'],
  ], `0.1が ${c}こ を ${n}つに わけると 0.1が ${q}こ → ${fmtD(q * 10)}`);
}

function frac4() {
  const d = rnd(3, 8), w = rnd(1, 3), n = rnd(1, d - 1), imp = w * d + n;
  if (Math.random() < 0.5) {
    return build(`${d}分の${imp} を 帯分数に すると?`, `${w}と${d}分の${n}`, [
      [`${w}と${d}分の${imp}`, 'frac_improper'], [`${w + 1}と${d}分の${n}`, 'frac_improper'], [`${n}と${d}分の${w}`, 'frac_improper'], [`${w}と${d}分の${n + 1}`, 'calc_slip'],
    ], `${imp}÷${d}=${w}あまり${n}。だから ${w}と${d}分の${n}`);
  }
  return build(`${w}と${d}分の${n} を 仮分数に すると?`, `${d}分の${imp}`, [
    [`${d}分の${w + n}`, 'frac_improper'], [`${d}分の${w * n + d}`, 'frac_improper'], [`${d}分の${imp + 1}`, 'calc_slip'], [`${d}分の${imp - 1}`, 'calc_slip'], [`${d * w}分の${n}`, 'frac_improper'],
  ], `${w}×${d}+${n}=${imp}。だから ${d}分の${imp}`);
}

function order() {
  const t = rnd(0, 2);
  const a = rnd(2, 9), b = rnd(2, 9), c = rnd(2, 9);
  if (t === 0) {
    const v = a + b * c;
    return build(`${a} + ${b} × ${c} = ?`, S(v), [
      [S((a + b) * c), 'order_ltr'], [S(a * b + c), 'calc_slip'], [S(v + 1), 'calc_slip'], [S(v - 1), 'calc_slip'], [S(a + b + c), 'plus_instead'], [S(v + 2), 'calc_slip'], [S(v - 2), 'calc_slip'],
    ], `かけ算が さき。${b}×${c}=${b * c}、${a}+${b * c}=${v}`);
  }
  if (t === 1) {
    const v = (a + b) * c;
    return build(`(${a} + ${b}) × ${c} = ?`, S(v), [
      [S(a + b * c), 'order_ltr'], [S(a * c + b), 'order_ltr'], [S(v + c), 'calc_slip'], [S(v - c), 'calc_slip'], [S(a + b + c), 'plus_instead'], [S(v + 1), 'calc_slip'], [S(v - 1), 'calc_slip'], [S(v + 2), 'calc_slip'],
    ], `( )の 中が さき。${a}+${b}=${a + b}、${a + b}×${c}=${v}`);
  }
  const bb = rnd(2, 6), cc = rnd(2, 6), aa = bb * cc + rnd(3, 20), v = aa - bb * cc;
  return build(`${aa} − ${bb} × ${cc} = ?`, S(v), [
    [S((aa - bb) * cc), 'order_ltr'], [S(v + 1), 'calc_slip'], [S(v - 1), 'calc_slip'], [S(aa - bb - cc), 'order_ltr'], [S(aa + bb * cc), 'sign_mix'],
  ], `かけ算が さき。${bb}×${cc}=${bb * cc}、${aa}−${bb * cc}=${v}`);
}

function big2() {
  if (Math.random() < 0.5) {
    const k = rnd(2, 9);
    return build(`${k}億 は 1万の なんこ分?`, S(k * 10000), [
      [S(k * 1000), 'zero_slip'], [S(k * 100000), 'zero_slip'], [S(k * 100), 'zero_slip'], [S(k * 10000 + 1), 'calc_slip'],
    ], `1億=1万の 10000こ分。${k}億=${k * 10000}こ分`);
  }
  const a = rnd(2, 9), b = rnd(1, 9);
  const ans = `${a}${b}0000000`;
  return build(`${a}億 ${b}000万 を 数字で かくと?`, ans, [
    [`${a}${b}000000`, 'zero_slip'], [`${a}${b}00000000`, 'zero_slip'], [`${a}0${b}000000`, 'place_zero'], [`${a}${b}000`, 'zero_slip'],
  ], `${a}億=${a}00000000、${b}000万=${b}0000000。あわせて ${ans}`);
}

function mul3b() {
  const a = rnd(112, 499), b = rnd(12, 48), c = a * b;
  return build(`${a} × ${b} = ?`, S(c), [
    [S(a * (b % 10) + a * Math.floor(b / 10)), 'mul_place'], [S(c + 100), 'calc_slip'], [S(c - 100), 'calc_slip'], [S(c + 10), 'calc_slip'], [S(c - 10), 'calc_slip'],
  ], `${a}×${b % 10}=${a * (b % 10)}、${a}×${Math.floor(b / 10)}0=${a * Math.floor(b / 10) * 10}。あわせて ${c}`);
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
    { id: 'g3_dec2', name: '小数の たし算・ひき算(0.1)', months: [], gen: dec2 },
    { id: 'g3_mul2', name: '2けた × 2けた', months: [], gen: mul2 },
    { id: 'g3_divr', name: 'あまりのある わり算', months: [], gen: divr },
    { id: 'g3_time', name: '時間と 秒', months: [], gen: time3 },
    { id: 'g3_len', name: '長さ・重さ(km・kg・g)', months: [], gen: len3 },
    { id: 'g3_addsub4', name: '4けたの たし算・ひき算', months: [], gen: addsub4 },
    { id: 'g3_circle', name: '円と 半径・直径', months: [], gen: circle },
  ],
  2: [
    { id: 'g2_add', name: 'たし算の ひっ算', months: [4, 5, 6], gen: add2 },
    { id: 'g2_sub', name: 'ひき算の ひっ算', months: [5, 6, 7], gen: sub2 },
    { id: 'g2_len', name: '長さ(cm と mm)', months: [7, 9, 10], gen: len },
    { id: 'g2_place', name: '3けたの 数', months: [9, 10], gen: place },
    { id: 'g2_kuku', name: 'かけ算(九九)', months: [10, 11, 12, 1, 2], gen: kuku },
    { id: 'g2_time', name: '時こくと 時間', months: [9, 10], gen: time2 },
    { id: 'g2_len2', name: '長さ(m と cm)', months: [10, 11], gen: len2 },
    { id: 'g2_liter', name: 'かさ(L・dL・mL)', months: [11, 12], gen: liter },
    { id: 'g2_add3', name: '3けたの たし算・ひき算', months: [11, 12, 1], gen: add3 },
    { id: 'g2_frac', name: '分数(2分の1など)', months: [2, 3], gen: frac2 },
  ],
  4: [
    { id: 'g4_big', name: '大きな 数', months: [4, 5, 6], gen: bignum },
    { id: 'g4_div', name: 'わり算の ひっ算', months: [6, 7, 10, 11], gen: div },
    { id: 'g4_round', name: 'がい数', months: [9, 10], gen: gaisu },
    { id: 'g4_dec', name: '小数の たし算・ひき算', months: [10, 11, 12], gen: decimal },
    { id: 'g4_big2', name: '億・兆の 数', months: [4, 5], gen: big2 },
    { id: 'g4_mul3', name: '3けた × 2けた', months: [5, 6, 7, 9], gen: mul3b },
    { id: 'g4_angle', name: '角の 大きさ', months: [6, 7, 10], gen: angle },
    { id: 'g4_area', name: '面積', months: [11, 12], gen: area },
    { id: 'g4_frac', name: '分数(仮分数・帯分数)', months: [11, 12], gen: frac4 },
    { id: 'g4_order', name: '計算の きまり', months: [12, 1], gen: order },
    { id: 'g4_decmul', name: '小数 × 整数・÷ 整数', months: [1, 2, 3], gen: decmul },
  ],
};

// 「これが できないと 次が むずかしい」という前提つながり(さかのぼり診断に使う)
const PRE = {
  g1_addc: ['g1_add'], g1_subc: ['g1_sub'],
  g2_add: ['g1_addc', 'g1_num'], g2_sub: ['g1_subc', 'g1_num'], g2_place: ['g1_num'], g2_len: ['g2_place'], g2_kuku: ['g2_add'],
  g2_time: ['g1_num'], g2_len2: ['g2_len'], g2_liter: ['g2_place'], g2_add3: ['g2_add', 'g2_sub'], g2_frac: ['g2_kuku'],
  g3_big: ['g2_place'], g3_mul: ['g2_kuku', 'g2_add'], g3_div: ['g2_kuku'], g3_frac: ['g2_add', 'g2_sub'], g3_dec: ['g2_place'],
  g3_dec2: ['g3_dec'], g3_mul2: ['g3_mul'], g3_divr: ['g3_div'], g3_time: ['g2_time'], g3_len: ['g2_len2'], g3_addsub4: ['g2_add3'], g3_circle: ['g2_len2'],
  g4_big: ['g3_big'], g4_div: ['g3_div', 'g3_divr', 'g3_mul', 'g2_sub'], g4_round: ['g3_big'], g4_dec: ['g3_dec', 'g2_add', 'g2_sub'],
  g4_big2: ['g4_big'], g4_mul3: ['g3_mul2'], g4_angle: ['g3_circle'], g4_area: ['g3_mul'], g4_frac: ['g3_frac', 'g3_divr'],
  g4_order: ['g3_mul', 'g3_div'], g4_decmul: ['g3_dec2', 'g3_mul'],
};
for (const [g, us] of Object.entries(UNITS)) for (const u of us) { u.grade = Number(g); u.pre = PRE[u.id] || []; u.subject = u.subject || '算数'; }

export const byId = Object.fromEntries(Object.values(UNITS).flat().map((u) => [u.id, u]));
// 九九マスター用の たんげん(ふだんの 一覧や タイムマシンには 出さず、専用の カードから あそぶ)
export const KUKU_DAN = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => `g2_kuku_${d}`);
for (let d = 1; d <= 9; d++) byId[`g2_kuku_${d}`] = { id: `g2_kuku_${d}`, name: `九九 ${d}の だん`, subject: '算数', grade: 2, months: [], pre: ['g2_add'], drill: true, gen: () => kukuDan(d) };
byId.g2_kuku_all = { id: 'g2_kuku_all', name: '九九 ぜんぶ', subject: '算数', grade: 2, months: [], pre: ['g2_add'], drill: true, gen: () => kukuDan(rnd(1, 9)) };
byId.g2_kuku_inv = { id: 'g2_kuku_inv', name: '九九の □を さがせ', subject: '算数', grade: 2, months: [], pre: ['g2_kuku_all'], drill: true, gen: kukuInv };
export const unitsOf = (grade) => UNITS[grade] || [];

// ---- 国語(Gemini が毎朝ふやす 問題プールから出題) -----------------------------------
let seenIds = new Set();
export const setSeen = (ids) => { seenIds = new Set(ids); };
// 入っていて よいのは <small> と <br> だけ(それ以外の < は 文字として あつかう)
const sanitize = (t) => String(t).replace(/<(?!\/?small>|br>)/g, '&lt;');

function fromPool(unit, forced) {
  const fresh = unit.pool.filter((p) => !seenIds.has(p.id));
  const it = forced || pick(fresh.length ? fresh : unit.pool); // 全部 見たら くりかえし
  const choices = shuffle([{ label: it.correct, ok: true }, ...it.wrong.map((w) => ({ label: w.label, ok: false, tag: w.tag }))]);
  return { text: sanitize(it.text), why: String(it.why).replace(/[<>&]/g, ''), choices, id: it.id };
}

// ---- 理科・社会・生活(人が確かめた「事実リスト」から出題) -----------------------------
// ルビ記法 {漢字|かな} → <ruby>
const RUBY = /\{([^|{}]+)\|([^{}]+)\}/g;
export const ruby = (s) => String(s).replace(/[<>&"]/g, '').replace(RUBY, '<ruby>$1<rt>$2</rt></ruby>');

const recentEnt = new Map(); // かたち・はた クイズ: さいきんの 県・国は つづけて でない
function fromKnowledge(unit, forced) {
  const fresh = unit.items.filter((p) => !seenIds.has(p.id));
  let pool = fresh.length ? fresh : unit.items;
  if (unit.geo && !forced) {
    const recent = recentEnt.get(unit.id) || [];
    const p2 = pool.filter((x) => !recent.includes(x.ent)); if (p2.length) pool = p2;
  }
  const it = forced || pick(pool);
  if (unit.geo && !forced) {
    const recent = recentEnt.get(unit.id) || []; recent.push(it.ent);
    const keep = Math.max(3, Math.min(40, Math.floor(new Set(unit.items.map((x) => x.ent)).size / 2)));
    recentEnt.set(unit.id, recent.slice(-keep));
  }
  // かたちクイズは まちがいの せんたくしを その つど えらぶ(ちかい ところを 2つ + ほか)
  const wrong = it.wrong || (() => { const n = shuffle(it.near.slice()); const f = shuffle(it.far.slice()); return [...n.slice(0, 2), ...f, ...n.slice(2)].slice(0, 3); })();
  const lab = (t) => (it.raw ? t : ruby(t)); // かたち・はたの えらびかたは SVG をそのまま つかう
  const choices = shuffle([
    { label: lab(it.correct), ok: true },
    ...wrong.map((w) => ({ label: lab(w.label), ok: false, tag: 'know_mixup', note: ruby(w.note) })),
  ]);
  return { text: (it.svg ? `<div class="shapebox">${it.svg}</div>` : '') + ruby(it.q), why: ruby(it.why), choices, id: it.id, ...(it.hlabel ? { hlabel: it.hlabel } : {}) };
}

export function registerKnowledge(list) {
  for (const k of list) {
    if (!k.items || !k.items.length || byId[k.id]) continue;
    const unit = { id: k.id, name: k.name, subject: k.subject, grade: k.grade, months: k.months || [], pre: k.pre || [],
      items: k.items.map((it, i) => ({ ...it, id: `${k.id}:${i}` })), gen: () => fromKnowledge(unit) };
    (UNITS[k.grade] = UNITS[k.grade] || []).push(unit);
    byId[k.id] = unit;
  }
  for (const u of Object.values(byId)) u.pre = u.pre.filter((x) => byId[x]);
}

// ---- かたち・はた クイズ(都道府県・せかいの くに): data/geo.json・flags.json から たんげんを つくる ----------
// 1つの 県・くにに つき 5しゅるいの といかた(かたち→なまえ / なまえ→かたち / しゅと / ちほう・たいりく / しゅと→なまえ)
const TAIL = { 県: 'けん', 府: 'ふ', 都: 'と', 市: 'し', 区: 'く' };
// 読みを つける。whole=false なら「県・市」など おわりの 1もじは ふりがな なし
function rubyName(name, yomi, whole) {
  if (!yomi) return name;
  const t = name.slice(-1);
  if (!whole && TAIL[t] && name.length > 1 && yomi.endsWith(TAIL[t])) return `{${name.slice(0, -1)}|${yomi.slice(0, -TAIL[t].length)}}${t}`;
  return `{${name}|${yomi}}`;
}
const svgOf = (o, cls = 'shape') => `<svg class="${cls}" viewBox="-4 -4 ${o.w + 8} ${o.h + 8}" role="img" aria-label="かたち"><path d="${o.d}"/></svg>`;
const flagSvg = (f, cls = 'flag') => `<svg class="${cls}" viewBox="0 0 640 480" role="img" aria-label="こっき">${f}</svg>`;
const REGION_R = { 北海道: '{北海道|ほっかいどう}', 東北: '{東北|とうほく}', 関東: '{関東|かんとう}', 中部: '{中部|ちゅうぶ}', 近畿: '{近畿|きんき}', 中国: '{中国|ちゅうごく}', 四国: '{四国|しこく}', '九州・沖縄': '{九州|きゅうしゅう}・{沖縄|おきなわ}' };
const CONT_R = { アジア: 'アジア', ヨーロッパ: 'ヨーロッパ', アフリカ: 'アフリカ', 北アメリカ: '{北|きた}アメリカ', 南アメリカ: '{南|みなみ}アメリカ', オセアニア: 'オセアニア' };
const NOTE = 'ちがうよ。もういちど よく かんがえてみよう。';

// かたち・はたの といを つくる(variantsFn: 1つの ぎょうから といの リストを かえす)
function makeGeoUnit(id, name, subject, grade, rows, variantsFn) {
  if (byId[id] || rows.length < 6) return;
  const items = [];
  for (const o of rows) {
    for (const v of variantsFn(o, rows)) {
      let near = []; let far = [];
      if (v.values) far = v.values.filter((x) => x !== v.correct).map((label) => ({ label, note: NOTE }));
      else if (v.onlyFar) { // 「〇〇の くには どれ?」: おなじ グループの ほかの 子は せいかいに なって しまうので、ちがう グループだけ
        for (const x of rows) if (x[v.group] !== o[v.group]) far.push({ label: v.labelOf(x), note: v.noteOf(x) });
      } else {
        for (const x of rows) {
          if (x === o) continue;
          const e = { label: v.labelOf(x), note: v.noteOf(x) };
          if (v.group && x[v.group] === o[v.group]) near.push(e); else far.push(e);
        }
        near = near.filter((e) => e.label !== v.correct); far = far.filter((e) => e.label !== v.correct);
      }
      items.push({ q: v.q, svg: v.svg, correct: v.correct, raw: !!v.raw, why: v.why, hlabel: v.hlabel, ent: o.n, near, far, id: `${id}:${items.length}` });
    }
  }
  const unit = { id, name, subject, grade, months: [], pre: [], geo: true, items, gen: () => fromKnowledge(unit) };
  (UNITS[grade] = UNITS[grade] || []).push(unit);
  byId[id] = unit;
}

export function registerGeo(geo, flags) {
  if (!geo || !geo.pref || !geo.world) return;
  const prefs = Object.values(geo.pref); const world = Object.entries(geo.world).map(([a3, o]) => ({ ...o, a3 }));
  const flagRows = flags && flags.flags ? world.filter((o) => flags.flags[o.a3]).map((o) => ({ ...o, f: flags.flags[o.a3] })) : [];
  const capName = (x) => rubyName(x.c, x.cy, true);
  const REG = Object.values(REGION_R); const CON = Object.values(CONT_R);

  const prefVariants = (whole, small) => (o) => {
    const lab = (x) => rubyName(x.n, x.y, whole);
    const out = [
      { q: 'この かたちは どこの 都道府県かな?', svg: svgOf(o), correct: lab(o), labelOf: lab, noteOf: (x) => `それは ${lab(x)}の かたちだよ。もういちど よく くらべてみよう。`, group: 'r', hlabel: `${o.n}の かたち`,
        why: `${lab(o)}。${REGION_R[o.r]}ちほうだよ。{県庁所在地|けんちょうしょざいち}は ${capName(o)}。` },
      { q: `「${lab(o)}」の かたちは どれ?`, correct: svgOf(o, 'shape mini'), raw: true, labelOf: (x) => svgOf(x, 'shape mini'), noteOf: (x) => `それは ${lab(x)}の かたちだよ。`, group: 'r', hlabel: `${o.n}の かたち`,
        why: `${lab(o)}の かたちは これ。${REGION_R[o.r]}ちほうに あるよ。` },
    ];
    if (small) return out;
    out.push(
      { q: 'この かたちの 県の {県庁所在地|けんちょうしょざいち}は どこかな?', svg: svgOf(o), correct: capName(o), labelOf: capName, noteOf: (x) => `それは ${lab(x)}の {県庁所在地|けんちょうしょざいち}だよ。`, group: 'r', hlabel: `${o.n}の けんちょうしょざいち`,
        why: `${lab(o)}の {県庁所在地|けんちょうしょざいち}は ${capName(o)}。` },
      { q: 'この かたちは どの 地方に ある 県かな?', svg: svgOf(o), correct: REGION_R[o.r], values: REG, hlabel: `${o.n}の ちほう`, why: `${lab(o)}は ${REGION_R[o.r]}ちほうだよ。` },
      { q: `${capName(o)}は どの 都道府県の {県庁所在地|けんちょうしょざいち}かな?`, correct: lab(o), labelOf: lab, noteOf: (x) => `それは ${lab(x)}だよ。${capName(o)}は べつの 県の まちだよ。`, group: 'r', hlabel: `${o.n}の けんちょうしょざいち`,
        why: `${capName(o)}は ${lab(o)}の {県庁所在地|けんちょうしょざいち}。` },
      { q: `「${o.n}」の よみかたは どれ?`, correct: o.y, labelOf: (x) => x.y, noteOf: (x) => `それは「${x.n}」の よみかただよ。`, group: 'r', hlabel: `${o.n}の よみ`, why: `「${o.n}」は「${o.y}」と よむよ。` },
      { q: `${REGION_R[o.r]}ちほうに ある 県は どれ?`, correct: lab(o), labelOf: lab, noteOf: (x) => `${lab(x)}は ${REGION_R[x.r]}ちほうの 県だよ。`, group: 'r', onlyFar: true, hlabel: `${o.n}の ちほう`, why: `${lab(o)}は ${REGION_R[o.r]}ちほうに あるよ。` },
    );
    return out;
  };
  makeGeoUnit('geo_pref', '都道府県の かたち', '社会', 4, prefs, prefVariants(false, false));
  makeGeoUnit('geo_pref_e', 'にほんの かたち', '生活', 2, prefs, prefVariants(true, false)); // ゆいとも ぜんぶの 県・ぜんぶの といかた

  const worldVariants = (whole, small) => (o) => {
    const lab = (x) => rubyName(x.n, x.y, whole);
    const out = [
      { q: 'この かたちは どこの くにかな?', svg: svgOf(o), correct: lab(o), labelOf: lab, noteOf: (x) => `それは ${lab(x)}の かたちだよ。もういちど よく くらべてみよう。`, group: 'k', hlabel: `${o.n}の かたち`,
        why: `${lab(o)}。${CONT_R[o.k]}の くにで、しゅとは ${capName(o)}。` },
      { q: `「${lab(o)}」の かたちは どれ?`, correct: svgOf(o, 'shape mini'), raw: true, labelOf: (x) => svgOf(x, 'shape mini'), noteOf: (x) => `それは ${lab(x)}の かたちだよ。`, group: 'k', hlabel: `${o.n}の かたち`,
        why: `${lab(o)}の かたちは これ。${CONT_R[o.k]}に あるよ。` },
    ];
    if (small) return out;
    out.push(
      { q: 'この かたちの くにの しゅとは どこかな?', svg: svgOf(o), correct: capName(o), labelOf: capName, noteOf: (x) => `それは ${lab(x)}の しゅとだよ。`, group: 'k', hlabel: `${o.n}の しゅと`, why: `${lab(o)}の しゅとは ${capName(o)}。` },
      { q: 'この かたちの くには どの たいりくに あるかな?', svg: svgOf(o), correct: CONT_R[o.k], values: CON, hlabel: `${o.n}の たいりく`, why: `${lab(o)}は ${CONT_R[o.k]}に あるよ。` },
      { q: `${capName(o)}は どこの くにの しゅとかな?`, correct: lab(o), labelOf: lab, noteOf: (x) => `それは ${lab(x)}だよ。${capName(o)}は べつの くにの まちだよ。`, group: 'k', hlabel: `${o.n}の しゅと`, why: `${capName(o)}は ${lab(o)}の しゅと。` },
      { q: `${CONT_R[o.k]}に ある くには どれかな?`, correct: lab(o), labelOf: lab, noteOf: (x) => `${lab(x)}は ${CONT_R[x.k]}の くにだよ。`, group: 'k', onlyFar: true, hlabel: `${o.n}の たいりく`, why: `${lab(o)}は ${CONT_R[o.k]}に あるよ。` },
    );
    return out;
  };
  makeGeoUnit('geo_world', 'せかいの くにの かたち', '社会', 4, world, worldVariants(false, false));
  makeGeoUnit('geo_world_e', 'せかいの くにの かたち', '生活', 2, world, worldVariants(true, false));

  const flagVariants = (whole, small) => (o) => {
    const lab = (x) => rubyName(x.n, x.y, whole);
    const out = [
      { q: 'この はたは どこの くにの はたかな?', svg: flagSvg(o.f), correct: lab(o), labelOf: lab, noteOf: (x) => `それは ${lab(x)}の はただよ。もういちど よく みてみよう。`, group: 'k', hlabel: `${o.n}の はた`,
        why: `${lab(o)}の はただよ。${CONT_R[o.k]}の くにで、しゅとは ${capName(o)}。` },
      { q: `「${lab(o)}」の はたは どれ?`, correct: flagSvg(o.f, 'flag mini'), raw: true, labelOf: (x) => flagSvg(x.f, 'flag mini'), noteOf: (x) => `それは ${lab(x)}の はただよ。`, group: 'k', hlabel: `${o.n}の はた`,
        why: `${lab(o)}の はたは これ。${CONT_R[o.k]}の くにだよ。` },
    ];
    if (small) return out;
    out.push(
      { q: 'この はたの くにの しゅとは どこかな?', svg: flagSvg(o.f), correct: capName(o), labelOf: capName, noteOf: (x) => `それは ${lab(x)}の しゅとだよ。`, group: 'k', hlabel: `${o.n}の しゅと`, why: `${lab(o)}の しゅとは ${capName(o)}。` },
      { q: 'この はたの くには どの たいりくに あるかな?', svg: flagSvg(o.f), correct: CONT_R[o.k], values: CON, hlabel: `${o.n}の たいりく`, why: `${lab(o)}は ${CONT_R[o.k]}に あるよ。` },
      { q: `${CONT_R[o.k]}の くにの はたは どれかな?`, correct: flagSvg(o.f, 'flag mini'), raw: true, labelOf: (x) => flagSvg(x.f, 'flag mini'), noteOf: (x) => `それは ${lab(x)}の はただよ。${CONT_R[x.k]}の くにだよ。`, group: 'k', onlyFar: true, hlabel: `${o.n}の たいりく`, why: `${lab(o)}は ${CONT_R[o.k]}の くにだよ。` },
    );
    return out;
  };
  makeGeoUnit('flag_world', 'せかいの こっき', '社会', 4, flagRows, flagVariants(false, false));
  makeGeoUnit('flag_world_e', 'せかいの こっき', '生活', 2, flagRows, flagVariants(true, false)); // ゆいとも ぜんぶの くに・ぜんぶの といかた(こっきは とくいなので しぼらない)
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
  const all = unitsOf(grade).filter((u) => u.subject === '算数' && !u.items); // けいさん・ずけいの もんだい(ことがらの たんげんは べつ)
  const ov = all.find((u) => u.id === overrideId);
  if (ov) return [ov];
  const cur = all.filter((u) => u.months.includes(month));
  return cur.length ? cur : [all[all.length - 1]];
}

export function makeQuestion(unit) {
  return { ...unit.gen(), unit: unit.id };
}

// かせつを たしかめる 問題(つまずきの「かせつ」の しけん)
//  tag    : その まちがえ方の 罠(ひっかけの 選択肢)を ふくむ 問題。計算は 数字を かえて、国語は 罠つきの 問題から。
//  itemId : 知識(理科・社会・生活)は「おなじ 問題」を もういちど(あいだを あけて)。
export function makeProbe(unit, { tag, itemId } = {}) {
  if (itemId && unit.items) {
    const it = unit.items.find((x) => x.id === itemId);
    if (it) return { ...fromKnowledge(unit, it), unit: unit.id };
  }
  if (tag && unit.pool) {
    const cand = unit.pool.filter((it) => it.wrong.some((w) => w.tag === tag));
    if (cand.length) {
      const fresh = cand.filter((x) => !seenIds.has(x.id));
      return { ...fromPool(unit, pick(fresh.length ? fresh : cand)), unit: unit.id };
    }
  }
  if (tag && !unit.pool && !unit.items) {
    for (let i = 0; i < 80; i++) { const q = unit.gen(); if (q.choices.some((c) => c.tag === tag)) return { ...q, unit: unit.id }; }
  }
  return makeQuestion(unit); // しらべられない ときは ふつうの 問題
}
