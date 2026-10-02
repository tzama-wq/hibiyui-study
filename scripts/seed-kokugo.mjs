// 最初の問題プール(手書き)。Gemini の鍵がなくてもアプリを試せるようにするためのもの。
// 本番の問題と同じ検査(学年外の漢字がないか等)を通してから data/kokugo-pool.json に書き出す。
//   node scripts/seed-kokugo.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { allowedSet, mergePool, toPoolItem, validateItem } from './lib/kokugo.mjs';

const y = (kanji, target, reading, sentence, explain, wrong) => ({ type: 'yomi', kanji, target, reading, sentence, explain, wrong: wrong.map(([text, tag]) => ({ text, tag })) });
const k = (kanji, target, reading, sentence, explain, wrong) => ({ type: 'kaki', kanji, target, reading, sentence, explain, wrong: wrong.map(([text, tag]) => ({ text, tag })) });

const SEEDS = {
  1: [
    y('校', '学校', 'がっこう', '学校に いく。', '「学校」は「がっ」と 小さい「っ」が はいるよ。', [['がくこう', 'small_kana'], ['がっごう', 'dakuten'], ['まなびこう', 'onkun_mix']]),
    y('山', '山', 'やま', '山に のぼる。', 'ひとつの 字の「山」は「やま」だよ。', [['さん', 'onkun_mix'], ['ざん', 'dakuten'], ['やみ', 'other']]),
    y('水', '水', 'みず', '水を のむ。', '「水」は ここでは「みず」。「すい」は 「水よう日」などで つかうよ。', [['すい', 'onkun_mix'], ['みつ', 'other'], ['びず', 'dakuten']]),
    y('犬', '犬', 'いぬ', '大きな 犬が いる。', '「犬」は「いぬ」だよ。', [['けん', 'onkun_mix'], ['いね', 'other'], ['いんぬ', 'small_kana']]),
    k('校', '学校', 'がっこう', '学校に いく。', '「学」と「校」。「校」は きへんの 校(こう)だよ。', [['字校', 'similar_kanji'], ['学林', 'similar_sound'], ['学村', 'similar_kanji']]),
  ],
  2: [
    y('夏', '夏休み', 'なつやすみ', '夏休みに 海へ 行く。', '「夏」は ここでは「なつ」、「休み」は「やすみ」。', [['なつきゅうみ', 'onkun_mix'], ['かやすみ', 'onkun_mix'], ['なつやしみ', 'other']]),
    y('毎', '毎朝', 'まいあさ', '毎朝 牛にゅうを のむ。', '「毎」は「まい」、「朝」は「あさ」と 読むよ。', [['まいちょう', 'onkun_mix'], ['まいじょう', 'dakuten'], ['つねあさ', 'similar_word']]),
    y('公', '公園', 'こうえん', '友だちと 公園で あそぶ。', '「公園」は「こう」「えん」。「こう」は のばす 音だよ。', [['こうおん', 'similar_word'], ['ごうえん', 'dakuten'], ['こえん', 'long_vowel']]),
    y('先', '先生', 'せんせい', '学校の 先生に きく。', '「先生」は「せん」「せい」と どちらも 音読みだよ。', [['せんぜい', 'dakuten'], ['さきせい', 'onkun_mix'], ['せんせ', 'long_vowel']]),
    k('園', '公園', 'こうえん', '公園で あそぶ。', '「公園」の「公」は ム(わたくし)の 上に 八。', [['公国', 'similar_kanji'], ['交園', 'similar_kanji'], ['公遠', 'similar_kanji']]),
    k('毎', '毎日', 'まいにち', '毎日 本を 読む。', '「毎」は「母」の 上に ノ。母とは ちがうよ。', [['母日', 'similar_kanji'], ['海日', 'similar_kanji'], ['毎目', 'similar_kanji']]),
  ],
  3: [
    y('駅', '駅', 'えき', '駅で 友だちを まつ。', '「駅」は 音読みで「えき」と 読むよ。', [['いき', 'similar_word'], ['えぎ', 'dakuten'], ['やく', 'onkun_mix']]),
    y('勉', '勉強', 'べんきょう', '家で 勉強を する。', '「勉強」は「べん」「きょう」。「きょう」は のばす 音だよ。', [['べんぎょう', 'dakuten'], ['べんきょ', 'long_vowel'], ['めんきょう', 'similar_word']]),
    k('運', '運動', 'うんどう', '運動を する。', '「運」は しんにょうの 字、「動」は 力が ついているよ。', [['遠動', 'similar_kanji'], ['運重', 'similar_kanji'], ['転動', 'similar_kanji']]),
  ],
  4: [
    y('健', '健康', 'けんこう', '健康に 気を つける。', '「健康」は「けん」「こう」。にごらない 音だよ。', [['けんごう', 'dakuten'], ['げんこう', 'similar_word'], ['けんこ', 'long_vowel']]),
    y('必', '必ず', 'かならず', '必ず 宿題を する。', '「必ず」は「かならず」。送りがなの「ず」までが 読みだよ。', [['ひつず', 'onkun_mix'], ['かならす', 'other'], ['かなら', 'other']]),
    y('季', '季節', 'きせつ', '春は 花の 季節だ。', '「季節」は「き」「せつ」。「せつ」は 小さい「っ」は ないよ。', [['きぜつ', 'dakuten'], ['きふし', 'onkun_mix'], ['きせっ', 'small_kana']]),
    y('伝', '伝える', 'つたえる', '気持ちを 伝える。', '「伝える」は 訓読みで「つたえる」だよ。', [['でんえる', 'onkun_mix'], ['つたたえる', 'other'], ['つたる', 'other']]),
    k('健', '健康', 'けんこう', '健康に すごす。', '「健」は にんべんに「建」の つくり。', [['建康', 'similar_kanji'], ['健庫', 'similar_kanji'], ['建庫', 'similar_kanji']]),
  ],
};

const kanji = JSON.parse(await readFile(new URL('../data/kanji.json', import.meta.url), 'utf8'));
let pool = [];
let bad = 0;
for (const [g, items] of Object.entries(SEEDS)) {
  const allowed = allowedSet(kanji, Number(g));
  const ok = [];
  for (const it of items) {
    const v = validateItem(it, allowed);
    if (v.ok) ok.push(toPoolItem(it, Number(g)));
    else { bad++; console.error(`NG grade${g} ${it.target}: ${v.reason}`); }
  }
  pool = mergePool(pool, ok);
}
await writeFile(new URL('../data/kokugo-pool.json', import.meta.url), JSON.stringify({ version: 1, updated: 'seed', items: pool }));
console.log(`seed: ${pool.length}問 / 不合格 ${bad}`);
if (bad) process.exit(1);
