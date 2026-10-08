// ガチャ・選手・編成・対戦・強化の「ルール」。画面(DOM)には触らない純粋な計算だけ。
// 乱数は rnd(0以上1未満を返す関数)を渡せる。テストでは固定のシードを使う。

// ---- 基本のきまり ----------------------------------------------------------------
export const RARITIES = ['common', 'uncommon', 'rare', 'super', 'legend'];
export const RARITY_NAME = { common: 'コモン', uncommon: 'アンコモン', rare: 'レア', super: 'スーパーレア', legend: 'レジェンド' };
export const BASE_RATES = { common: 60, uncommon: 28, rare: 9.5, super: 2.48, legend: 0.02 }; // 合計100(%)
// レジェンドの でやすさは チケットで かわる(いいチケットほど でやすい。さいだい 2%)
export const LEGEND_RATES = { bronze: 0.02, silver: 0.1, gold: 0.5, platinum: 2 };
export const MAX_LEGEND_RATE = 2;
export const TICKETS = {
  bronze: { name: 'ブロンズ', icon: '🥉', min: 'common' },
  silver: { name: 'シルバー', icon: '🥈', min: 'uncommon' },
  gold: { name: 'ゴールド', icon: '🥇', min: 'rare' },
  platinum: { name: 'プラチナ', icon: '💎', min: 'super' },
};
export const TICKET_ORDER = ['bronze', 'silver', 'gold', 'platinum'];

export const STATS = ['SHO', 'PAS', 'SPD', 'DEF', 'STA'];
export const STAT_NAME = { SHO: 'シュート', PAS: 'パス', SPD: 'スピード', DEF: 'まもり', STA: 'スタミナ' };
export const SUBJECT_STAT = { 算数: 'SHO', 国語: 'PAS', 理科: 'SPD', 社会: 'DEF', 生活: 'STA' };
// 11にんで しあいをする(4-4-2)。じゅんばん: FW2 → MF4 → DF4 → GK1
// フォーメーション: わくの じゅんばんは いつも FW → MF → DF → GK。かずが かわるだけ
export const FORMATIONS = [
  { id: '442', name: '4-4-2', fw: 2, mf: 4, df: 4, desc: 'バランスが いい' },
  { id: '433', name: '4-3-3', fw: 3, mf: 3, df: 4, desc: 'こうげき ふやす' },
  { id: '343', name: '3-4-3', fw: 3, mf: 4, df: 3, desc: 'とにかく こうげき' },
  { id: '352', name: '3-5-2', fw: 2, mf: 5, df: 3, desc: 'まんなかを あつく' },
  { id: '451', name: '4-5-1', fw: 1, mf: 5, df: 4, desc: 'まもって カウンター' },
  { id: '532', name: '5-3-2', fw: 2, mf: 3, df: 5, desc: 'がっちり まもる' },
];
export const formationOf = (id) => FORMATIONS.find((f) => f.id === id) || FORMATIONS[0];
export const slotsOf = (id) => { const f = formationOf(id); return [...Array(f.fw).fill('FW'), ...Array(f.mf).fill('MF'), ...Array(f.df).fill('DF'), 'GK']; };
export const SLOT_POS = slotsOf('442');
export const TEAM_SIZE = SLOT_POS.length;
// フォーメーションを かえた とき、えらんだ 選手を ポジションの あう わくに ならべなおす(じぶんは どこでも OK)
export function refitTeam(team, newSlots, posOf) {
  const ids = team.filter(Boolean); const out = Array(newSlots.length).fill(null); const left = [];
  for (const id of ids) {
    const j = newSlots.findIndex((s, i) => !out[i] && s === posOf(id));
    if (j >= 0) out[j] = id; else left.push(id);
  }
  left.sort((a, b) => (posOf(a) === 'ALL') - (posOf(b) === 'ALL')); // ポジションの きまってる 子を さきに
  for (const id of left) { const j = out.findIndex((x) => !x); if (j >= 0) out[j] = id; }
  return out;
}
// 5にんだった ころの へんせいを 11にんの じゅんばんに うつす(FW,FW,MF,DF,GK)
export const migrateTeam = (old) => { const t = Array(TEAM_SIZE).fill(null); [0, 1, 2, 6, 10].forEach((to, k) => { t[to] = old[k] ?? null; }); return t; };
export const POS_NAME = { FW: 'フォワード', MF: 'ミッドフィルダー', DF: 'ディフェンダー', GK: 'キーパー', ALL: 'オールラウンダー' };

export const rngSeed = (seed) => { // mulberry32: 同じシードなら同じ並び
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
};

// ---- 選手(オリジナル。実在の人物ではない) --------------------------------------------
const FIRST = ['ハヤテ', 'ソラ', 'レオ', 'カイ', 'リク', 'ダイチ', 'ツバサ', 'ヒカル', 'アラタ', 'ショウ', 'ナギ', 'ミナト', 'ライト', 'コウタ', 'ハルト', 'ジン', 'ガク', 'ケン', 'トラ', 'シン', 'カズ', 'マル', 'ボル', 'ロコ', 'テツ', 'サク', 'タケル', 'リュウ', 'ゲン', 'アキラ', 'ヨウ', 'ジロー', 'モモ', 'ヒロ', 'セナ', 'ルカ', 'ノア', 'ミライ'];
const LAST = {
  FW: ['サンダー', 'ブレイズ', 'ストライク', 'ターボ', 'ロケット', 'コメット', 'ファルコン', 'スパーク', 'ブレイカー', 'ハリケーン'],
  MF: ['リズム', 'マジック', 'ドリーム', 'パス', 'ウィンド', 'ムーン', 'オーシャン', 'テクニカル', 'アシスト', 'ミラクル'],
  DF: ['ウォール', 'ガーディアン', 'バリア', 'ブロック', 'シールド', 'アイアン', 'ロック', 'ナイト', 'タイタン', 'クラッシュ'],
  GK: ['セーブ', 'グローブ', 'ネット', 'キャッチ', 'ジャイアント', 'フォートレス', 'ブルワーク', 'ストッパー'],
};
const FACE = {
  FW: ['🦁', '🐯', '🦅', '🐺', '🦈', '🐉', '🔥', '⚡'],
  MF: ['🦊', '🐬', '🦉', '🐙', '🦄', '🌟', '🦋', '🐼'],
  DF: ['🐻', '🦏', '🐢', '🛡️', '🐘', '🦬', '🦍', '🐗'],
  GK: ['🧤', '🦒', '🐊', '🦦', '🐨', '🦛'],
};
const MAIN = { FW: ['SHO', 'SPD'], MF: ['PAS', 'STA'], DF: ['DEF', 'STA'], GK: ['DEF', 'STA'] };
const RANGE = { common: [36, 56], uncommon: [50, 66], rare: [62, 78], super: [74, 90], legend: [89, 99] };
// レア いじょうは 5ばいに ふやした(うしろに ふやしているので、もう ある 選手の なまえ・のうりょくは かわらない)
const COUNTS = { common: 80, uncommon: 60, rare: 220, super: 120, legend: 60 };
const NATIONS = ['🇧🇷', '🇦🇷', '🇫🇷', '🇩🇪', '🇪🇸', '🇮🇹', '🇬🇧', '🇳🇱', '🇵🇹', '🇧🇪', '🇭🇷', '🇺🇾', '🇨🇴', '🇲🇽', '🇺🇸', '🇯🇵', '🇰🇷', '🇸🇳', '🇳🇬', '🇬🇭', '🇲🇦', '🇪🇬', '🇨🇲', '🇨🇮', '🇦🇺', '🇸🇪', '🇳🇴', '🇩🇰', '🇨🇭', '🇵🇱', '🇹🇷', '🇨🇱', '🇪🇨', '🇵🇾', '🇮🇷', '🇸🇦', '🌐'];
const STAT_PHRASE = { SHO: 'シュート', PAS: 'パス', SPD: 'スピード', DEF: 'まもり', STA: 'スタミナ' };
const EPITHET = ['ひらめきの', 'ふんえんの', 'だいちの', 'あらしの', 'こおりの', 'ほのおの', 'ひかりの', 'かぜの', 'いなずまの', 'ほしの', 'うみの', 'そらの', 'くろがねの', 'こがねの'];
// 有名な選手を「モデル」にした オリジナルの キャラクター(名前は もじり。実在の本人とは かんけいない)。
// [レア度, なまえ, ポジション, 国, かお, とくい(タイプ), とくいな のうりょく]
const STARS = [
  // レジェンド(れきだいの でんせつ)
  ['legend', 'キング・ペロ', 'FW', '🇧🇷', '👑', 'サッカーの 王さま。なんでも できる', ['SHO', 'SPD', 'PAS']],
  ['legend', 'ロナルドン', 'FW', '🇧🇷', '👽', 'とてつもない スピードと ゴール', ['SHO', 'SPD']],
  ['legend', 'マラドン', 'MF', '🇦🇷', '🪄', '左足の まほうつかい。ドリブルの かみさま', ['PAS', 'SPD', 'SHO']],
  ['legend', 'ジダール', 'MF', '🇫🇷', '🎭', 'ゆうがな ターンの 司令塔', ['PAS', 'STA']],
  ['legend', 'カイザー・ベック', 'DF', '🇩🇪', '🦅', 'ディフェンスから せめあがる 皇帝', ['DEF', 'PAS', 'STA']],
  ['legend', 'ブラック・ヤシン', 'GK', '🌐', '🕷️', '黒い ふくの しゅごしん。ゴールを まもる でんせつ', ['DEF', 'STA']],
  // スーパーレア(いまの せかいの スター)
  ['super', 'レオ・メッセイ', 'FW', '🇦🇷', '🐐', '小さな 体の 左足ドリブラー', ['SPD', 'SHO', 'PAS']],
  ['super', 'キリオン・エンバピ', 'FW', '🇫🇷', '🚀', 'せかいで いちばん はやい 若きエース', ['SPD', 'SHO']],
  ['super', 'アーリン・ホーラン', 'FW', '🇳🇴', '🤖', 'ゴールを うみだす 大きな ストライカー', ['SHO', 'STA']],
  ['super', 'ネイ・マール', 'FW', '🇧🇷', '🎩', 'トリッキーな ドリブルの てんさい', ['SPD', 'PAS', 'SHO']],
  ['super', 'ケイヴ・デブラウン', 'MF', '🇧🇪', '🧠', 'せいかくな パスで チャンスを つくる', ['PAS', 'STA']],
  ['super', 'ルコ・モドリー', 'MF', '🇭🇷', '🎻', 'ピッチを しはいする ベテラン', ['PAS', 'STA']],
  ['super', 'ジュート・ベリンガー', 'MF', '🇬🇧', '⭐', 'ぜんぶ できる わかき ミッドフィルダー', ['PAS', 'SHO', 'STA']],
  ['super', 'ヤマ・ラミール', 'MF', '🇪🇸', '✨', '10だいの てんさい ウィンガー', ['SPD', 'PAS']],
  ['super', 'バルジル・ファンダイカ', 'DF', '🇳🇱', '🗼', 'くうちゅうせんに つよい かべ', ['DEF', 'STA']],
  ['super', 'ルーベ・ディアーズ', 'DF', '🇵🇹', '🧱', 'しずかに まもる リーダー', ['DEF', 'STA']],
  ['super', 'ティボル・クルトワール', 'GK', '🇧🇪', '🦒', 'でっかい 手で とめる しゅごしん', ['DEF', 'STA']],
  ['super', 'アリゾン・ベッカ', 'GK', '🇧🇷', '🧤', '足もとも うまい しゅごしん', ['DEF', 'PAS']],
  // レア(せかいと 日本の スター)
  ['rare', 'モー・サラハ', 'FW', '🇪🇬', '⚡', '左足で カットインする 快足ウィング', ['SPD', 'SHO']],
  ['rare', 'ハリー・ケイナ', 'FW', '🇬🇧', '🎯', 'ゴールも パスも できる ストライカー', ['SHO', 'PAS']],
  ['rare', 'ビニ・シオール', 'FW', '🇧🇷', '🌪️', 'キレキレの ドリブルの ウィング', ['SPD', 'SHO']],
  ['rare', 'ロドリオ', 'MF', '🇪🇸', '⚓', 'まもりの かなめの ボランチ', ['DEF', 'STA', 'PAS']],
  ['rare', 'トニ・クローザ', 'MF', '🇩🇪', '🎼', 'ミスしない パスの たつじん', ['PAS', 'STA']],
  ['rare', 'ペドロ・ペドリン', 'MF', '🇪🇸', '🎈', 'ちいさな 体で ボールを はなさない', ['PAS', 'SPD']],
  ['rare', 'アクラム・ハキミル', 'DF', '🇲🇦', '🏃', 'スピードが ある 右サイド', ['SPD', 'DEF']],
  ['rare', 'トレント・アーノル', 'DF', '🇬🇧', '📐', 'ロングパスが ピタリの サイドバック', ['PAS', 'DEF']],
  ['rare', 'ウィリアム・サリバル', 'DF', '🇫🇷', '🛡️', 'れいせいな センターバック', ['DEF', 'SPD']],
  ['rare', 'アルフォン・デイビス', 'DF', '🇨🇦', '💨', 'ちょうはやい 左サイドバック', ['SPD', 'DEF']],
  ['rare', 'マヌエル・ノイエル', 'GK', '🇩🇪', '🧹', 'とびだして まもる スイーパーGK', ['DEF', 'SPD']],
  ['rare', 'エデル・ソーン', 'GK', '🇧🇷', '🎯', 'ロングキックが せいかくな GK', ['DEF', 'PAS']],
  ['rare', 'ミトモ・リョウ', 'FW', '🇯🇵', '🌀', '左がわから ぬく ドリブルの たつじん', ['SPD', 'SHO']],
  ['rare', 'マエダ・ライ', 'FW', '🇯🇵', '🔥', 'どこまでも おいかける スプリンター', ['SPD', 'STA']],
  ['rare', 'ウエダ・ジュウ', 'FW', '🇯🇵', '🏹', 'ゴールの においが わかる ストライカー', ['SHO', 'STA']],
  ['rare', 'クボ・テツ', 'MF', '🇯🇵', '🪽', 'するどい パスと ドリブルの 若き てんさい', ['PAS', 'SPD', 'SHO']],
  ['rare', 'エンドウ・マモル', 'MF', '🇯🇵', '🐺', '1たい1に つよい ボランチ', ['DEF', 'STA']],
  ['rare', 'カマタ・ジュン', 'MF', '🇯🇵', '🧩', 'すきまに はいる トップした', ['PAS', 'SHO']],
  ['rare', 'モリタ・ケイ', 'MF', '🇯🇵', '⚙️', 'よく はしる はたらきものの ボランチ', ['STA', 'PAS']],
  ['rare', 'トミタ・ガク', 'DF', '🇯🇵', '🧰', 'どこでも まもれる ユーティリティ', ['DEF', 'SPD']],
  ['rare', 'イタバ・コウ', 'DF', '🇯🇵', '🗿', 'たよれる センターバック', ['DEF', 'STA']],
  ['rare', 'スズキ・ダイ', 'GK', '🇯🇵', '🦾', '大きくて はんのうが はやい GK', ['DEF', 'STA']],
  // ---- 第2弾(ここから追加。順番を かえない・うしろに たす:選手IDが かわらないように) ----
  // レジェンド +6
  ['legend', 'トータル・クルーフ', 'FW', '🇳🇱', '🌷', 'ポジションを きめずに うごく トータルフットボールの 天才', ['PAS', 'SPD', 'SHO']],
  ['legend', 'スマイル・ロニー', 'MF', '🇧🇷', '😁', 'えがおで ふしぎな プレーを する まほうつかい', ['PAS', 'SPD', 'SHO']],
  ['legend', 'ミルディーニ', 'DF', '🇮🇹', '🏛️', 'ひとつの クラブで あいされた 名ディフェンダー', ['DEF', 'STA', 'PAS']],
  ['legend', 'ブッフォーネ', 'GK', '🇮🇹', '🏔️', '20ねん つづけた ゆうめいな ゴールキーパー', ['DEF', 'STA']],
  ['legend', 'サムライ・ナカタ', 'MF', '🇯🇵', '🗡️', '日本を せかいに むけた ミッドフィルダー', ['PAS', 'STA', 'SHO']],
  ['legend', 'ジッコ', 'MF', '🇧🇷', '🎯', 'フリーキックの めいじん。しろい 王さま', ['PAS', 'SHO']],
  // スーパーレア +12
  ['super', 'クリスト・ロナール', 'FW', '🇵🇹', '🦘', 'ジャンプと パワーが すごい ストライカー', ['SHO', 'STA', 'SPD']],
  ['super', 'レバンドー', 'FW', '🇵🇱', '⚽', 'ゴールの かたまり。どんな ボールも きめる', ['SHO', 'STA']],
  ['super', 'ソン・ヒョンミ', 'FW', '🇰🇷', '🐅', 'りょうあしで うてる 快足ウィング', ['SPD', 'SHO']],
  ['super', 'オシメン', 'FW', '🇳🇬', '🐆', 'ちからづよく はしる ストライカー', ['SPD', 'SHO', 'STA']],
  ['super', 'イニエスト', 'MF', '🇪🇸', '🎹', 'しずかに パスで あやつる まほうつかい', ['PAS', 'SPD']],
  ['super', 'ムシアーラ', 'MF', '🇩🇪', '🌀', 'スキルが あふれる わかき ドリブラー', ['SPD', 'PAS']],
  ['super', 'バルベルド', 'MF', '🇺🇾', '🚂', 'ずっと はしりつづける エンジン', ['STA', 'SPD', 'SHO']],
  ['super', 'エーデゴル', 'MF', '🇳🇴', '🎬', 'パスで ゲームを つくる キャプテン', ['PAS', 'STA']],
  ['super', 'マルキニョ', 'DF', '🇧🇷', '⚔️', 'まもりの リーダー。ぜったいに あきらめない', ['DEF', 'STA']],
  ['super', 'グバルドール', 'DF', '🇭🇷', '🗡', 'ひだりも できる わかい DF', ['DEF', 'SPD', 'PAS']],
  ['super', 'ドンナルマ', 'GK', '🇮🇹', '🧤', 'おおきな 手の しゅごしん', ['DEF', 'STA']],
  ['super', 'テア・シュテーゲル', 'GK', '🇩🇪', '🏐', '足もとが うまい しゅごしん', ['DEF', 'PAS']],
  // レア +22(せかい12 + 日本10)
  ['rare', 'ラウタロ・マルチ', 'FW', '🇦🇷', '🐂', 'ひたむきに ゴールを ねらう ストライカー', ['SHO', 'STA']],
  ['rare', 'ラッシュフォード', 'FW', '🇬🇧', '🏇', 'はやい ドリブルから シュート', ['SPD', 'SHO']],
  ['rare', 'グリズマル', 'FW', '🇫🇷', '🧲', 'パスも ゴールも できる ふくざつな FW', ['SHO', 'PAS']],
  ['rare', 'ヨシュア・キミック', 'MF', '🇩🇪', '🏗️', 'まもりも せめも こなす ばんのう MF', ['PAS', 'STA', 'DEF']],
  ['rare', 'バレッラ', 'MF', '🇮🇹', '🐝', 'ねばりづよく はしる ミッドフィルダー', ['STA', 'DEF']],
  ['rare', 'カゼミーロ', 'MF', '🇧🇷', '🐻', 'ボールを うばう ボランチ', ['DEF', 'STA']],
  ['rare', 'ブルノ・フェルナンド', 'MF', '🇵🇹', '🔭', 'ながい パスと シュートが とくい', ['PAS', 'SHO']],
  ['rare', 'カイル・ウォッカー', 'DF', '🇬🇧', '🐎', 'はやさで おいつく ディフェンダー', ['SPD', 'DEF']],
  ['rare', 'テオ・エルナンデル', 'DF', '🇫🇷', '🚄', 'ぐんぐん あがる 左サイドバック', ['SPD', 'SHO', 'DEF']],
  ['rare', 'カルバハロ', 'DF', '🇪🇸', '🏆', 'けいけんが ゆたかな 右サイドバック', ['DEF', 'STA']],
  ['rare', 'オブラコ', 'GK', '🇸🇮', '🧱', 'ゴールの まえの かべ', ['DEF', 'STA']],
  ['rare', 'メニャーン', 'GK', '🇫🇷', '🦅', 'はんのうが はやい しゅごしん', ['DEF', 'SPD']],
  ['rare', 'イトウ・ハヤテ', 'FW', '🇯🇵', '🏍️', '右がわを かけぬける 快足ウィング', ['SPD', 'PAS']],
  ['rare', 'ドウノ・ユウ', 'FW', '🇯🇵', '🪃', '右足で するどく うつ ウィング', ['SHO', 'SPD']],
  ['rare', 'ナカムラ・ソウ', 'FW', '🇯🇵', '🦊', 'ひだりから ゴールを ねらう アタッカー', ['SHO', 'SPD']],
  ['rare', 'タナカ・ゲン', 'MF', '🇯🇵', '🪨', 'ボールを うばう ちゅうさいの MF', ['DEF', 'STA', 'PAS']],
  ['rare', 'ハタナ・レオ', 'MF', '🇯🇵', '🔧', 'どこでも はしる ハードワーカー', ['STA', 'SPD']],
  ['rare', 'ホンダ・リョウ', 'MF', '🇯🇵', '🚀', 'つよい キックと パワーの MF', ['SHO', 'PAS']],
  ['rare', 'カガワ・トオル', 'MF', '🇯🇵', '🪡', 'せまい ところで ぬける 名人', ['PAS', 'SPD']],
  ['rare', 'タニグチ・マサ', 'DF', '🇯🇵', '🏯', 'くうちゅうせんに つよい センターバック', ['DEF', 'STA']],
  ['rare', 'スガノ・ケイ', 'DF', '🇯🇵', '🛹', 'スピードで つなぐ サイドバック', ['SPD', 'DEF']],
  ['rare', 'ナガノ・ソラ', 'DF', '🇯🇵', '🔋', 'スタミナが おばけの 左サイド', ['STA', 'SPD']],
];

const POS_TYPE = { FW: 'ストライカー', MF: 'ミッドフィルダー', DF: 'ディフェンダー', GK: 'ゴールキーパー' };
function buildPlayers() {
  const used = new Set(STARS.map((s) => s[1]));
  const out = [];
  for (const rarity of RARITIES) {
    const stars = STARS.filter((s) => s[0] === rarity);
    for (let i = 0; i < COUNTS[rarity]; i++) {
      // 選手ごとに 乱数を わける: うしろに ふやしても、もう ある選手の なまえ・のうりょくは かわらない
      const rnd = rngSeed(20261005 + RARITIES.indexOf(rarity) * 1000 + i);
      const pick = (a) => a[Math.floor(rnd() * a.length)];
      let pos; let name; let face; let nation = ''; let type = ''; let main;
      if (stars[i]) { [, name, pos, nation, face, type, main] = stars[i]; }
      else {
        pos = ['FW', 'FW', 'MF', 'MF', 'DF', 'DF', 'GK'][i % 7];
        do { name = `${pick(FIRST)}・${pick(LAST[pos])}`; } while (used.has(name));
        face = pick(FACE[pos]);
      }
      used.add(name);
      main = main || MAIN[pos];
      const [lo, hi] = RANGE[rarity];
      const stats = {};
      for (const s of STATS) {
        const isMain = main.includes(s);
        const v = isMain ? lo + (hi - lo) * (0.6 + 0.4 * rnd()) : lo + (hi - lo) * 0.55 * rnd();
        stats[s] = Math.min(99, Math.round(v));
      }
      const id = `${rarity[0]}${String(i + 1).padStart(2, '0')}`;
      // イラストが あるのは モデル入り(レア以上)。なければ 絵文字の かおを つかう
      // イラスト つきの モデル入り(STARS)いがいの レア以上にも、くにと とくいな ところを つける(あとから ふやしても 他の せんしゅは かわらない)
      const hand = !!stars[i];
      if (!hand && RARITIES.indexOf(rarity) >= RARITIES.indexOf('rare')) {
        const r2 = rngSeed(777000 + RARITIES.indexOf(rarity) * 1000 + i); const p2 = (a) => a[Math.floor(r2() * a.length)];
        nation = p2(NATIONS);
        const top = [...STATS].sort((a, b) => stats[b] - stats[a]).slice(0, 2).map((s) => STAT_PHRASE[s]);
        type = `${p2(EPITHET)}${POS_TYPE[pos]}。${top[0]}と ${top[1]}が とくい`;
      }
      out.push({ id, name, pos, rarity, face, nation, type, img: hand ? `images/players/${id}.webp` : '', stats });
    }
  }
  return out;
}
export const PLAYERS = buildPlayers();
export const PLAYER_BY_ID = Object.fromEntries(PLAYERS.map((p) => [p.id, p]));

// ---- ガチャ ---------------------------------------------------------------------
// チケットの 上位ほど 低いレアが でなくなり、レジェンドも でやすくなる(0.02% 〜 2%)。
export function rates(ticket) {
  const minI = RARITIES.indexOf(TICKETS[ticket].min);
  const tiers = RARITIES.filter((r, i) => r !== 'legend' && i >= minI);
  const sum = tiers.reduce((a, r) => a + BASE_RATES[r], 0);
  const out = Object.fromEntries(RARITIES.map((r) => [r, 0]));
  const legend = LEGEND_RATES[ticket];
  for (const r of tiers) out[r] = (BASE_RATES[r] / sum) * (100 - legend);
  out.legend = legend;
  return out;
}
export function rollRarity(ticket, rnd = Math.random) {
  const rt = rates(ticket);
  let r = rnd() * 100;
  for (const k of ['legend', 'super', 'rare', 'uncommon', 'common']) { // ちいさい 確率から じゅんに
    if (r < rt[k]) return k;
    r -= rt[k];
  }
  return RARITIES[RARITIES.indexOf(TICKETS[ticket].min)]; // 丸め誤差の保険
}
export function rollPlayer(ticket, rnd = Math.random) {
  const rarity = rollRarity(ticket, rnd);
  const pool = PLAYERS.filter((p) => p.rarity === rarity);
  return pool[Math.floor(rnd() * pool.length)];
}
// 1回ひく: チケットを1まい つかって、選手を コレクションに くわえる
export function pull(p, ticket, rnd = Math.random) {
  if (!(p.tickets && p.tickets[ticket] > 0)) return null;
  p.tickets[ticket]--;
  const player = rollPlayer(ticket, rnd);
  const before = p.owned[player.id] || 0;
  p.owned[player.id] = before + 1;
  return { player, isNew: before === 0, copies: before + 1 };
}
// 同じ選手が ふえると レベルアップ(さいだい +5)。1レベルごとに 能力 +4%
export const levelOf = (copies) => Math.max(0, Math.min(5, (copies || 1) - 1));

// ---- チケットの かせぎかた ---------------------------------------------------------------
export const DAILY_STUDY_TICKET_CAP = 6; // 1日に べんきょうで もらえる 上限(ひたすら ちかてつ連打を ふせぐ)
export const PRACTICE_TICKET_CAP = 4;    // 「すきな れんしゅう」の ぶんは べつわく(きょうの セットで 上限でも、れんしゅうで もらえる)
export const emptyTickets = () => ({ bronze: 0, silver: 0, gold: 0, platinum: 0 });
export function studyReward({ good, total, mode, perfect }) {
  if (!total || good / total < 0.6) return {};
  let r = perfect ? { silver: 1 } : { bronze: 1 };
  if (mode === 'bonus' || mode === 'back') r = { ...r, bronze: (r.bronze || 0) + 1 };
  return r;
}
export function addTickets(p, reward) {
  p.tickets = { ...emptyTickets(), ...(p.tickets || {}) };
  for (const [k, v] of Object.entries(reward)) p.tickets[k] += v;
}
// べんきょうで もらった チケット(1日の上限つき)。もらえた ぶんを かえす
export function earnStudyTickets(p, info, today) {
  p.tk = p.tk && p.tk.date === today ? p.tk : { date: today, n: 0, pn: 0 };
  const want = studyReward(info);
  const got = {};
  const key = info.mode === 'practice' ? 'pn' : 'n'; const cap = info.mode === 'practice' ? PRACTICE_TICKET_CAP : DAILY_STUDY_TICKET_CAP;
  p.tk.pn = p.tk.pn || 0;
  for (const k of TICKET_ORDER) {
    for (let i = 0; i < (want[k] || 0); i++) {
      if (p.tk[key] >= cap) break;
      got[k] = (got[k] || 0) + 1; p.tk[key]++;
    }
  }
  addTickets(p, got);
  return got;
}
// ログインボーナス: 「れんぞく」ではなく「ぜんぶで なん日め」。やすんでも のこる。
export function loginReward(n) {
  if (n % 30 === 0) return { platinum: 1, gold: 1 };
  if (n % 14 === 0) return { gold: 1 };
  if (n % 7 === 0) return { silver: 2 };
  if (n % 3 === 0) return { silver: 1 };
  return { bronze: 1 };
}
export function nextBigLogin(n) { // 「あと なん日で ごうかに なる?」
  for (let d = n + 1; d <= n + 30; d++) if (d % 7 === 0 || d % 14 === 0 || d % 30 === 0) return { day: d, in: d - n, reward: loginReward(d) };
  return null;
}
export function claimLogin(p, today) {
  if (p.lastLogin === today) return null;
  p.loginDays = (p.loginDays || 0) + 1;
  p.lastLogin = today;
  const reward = loginReward(p.loginDays);
  addTickets(p, reward);
  return { n: p.loginDays, reward };
}

// ---- 強化(ひびと・ゆいとの つよさ) ----------------------------------------------------
export const MAX_LEVEL = 100;
export const upgradeCost = (level) => 1 + Math.floor(level / 10);
export const kidStat = (level) => Math.round(30 + level * 1.5); // Lv47 で レジェンドの さいだい(99)を こえる
export const emptyStatMap = () => Object.fromEntries(STATS.map((s) => [s, 0]));
export function addPoints(p, subject, n) {
  const s = SUBJECT_STAT[subject]; if (!s) return;
  p.pts = { ...emptyStatMap(), ...(p.pts || {}) };
  p.pts[s] += n;
}
export function upgrade(p, stat) {
  p.pts = { ...emptyStatMap(), ...(p.pts || {}) }; p.lv = { ...emptyStatMap(), ...(p.lv || {}) };
  const lv = p.lv[stat]; const cost = upgradeCost(lv);
  if (lv >= MAX_LEVEL || p.pts[stat] < cost) return false;
  p.pts[stat] -= cost; p.lv[stat]++;
  return true;
}
export const kidStats = (p) => Object.fromEntries(STATS.map((s) => [s, kidStat(((p.lv || {})[s]) || 0)]));

// ---- メダルの チームバフ(%) ----------------------------------------------------------------
export const BADGE_BUFFS = {
  goal1: { SHO: 1 }, goal10: { SHO: 2 }, goal50: { SHO: 3 }, goal100: { SHO: 5 }, goal300: { SHO: 8 },
  day3: { STA: 2 }, day7: { STA: 3 }, day30: { STA: 8 },
  hat: { SHO: 3, PAS: 2 }, perfect: { ALL: 3 }, comeback: { STA: 3, SPD: 2 }, time: { SPD: 3 }, hyp1: { ALL: 2 }, hyp5: { ALL: 4 }, kuku9: { SHO: 4, SPD: 2 }, cup_j: { ALL: 2 }, cup_asia: { ALL: 3 }, cup_kirin: { ALL: 4 }, cup_wc: { ALL: 6 },
  rank2: { ALL: 2 }, rank4: { ALL: 3 }, rank5: { ALL: 5 }, rank_eu: { ALL: 4 }, rank_wc: { ALL: 5 }, rank_max: { ALL: 6 },
  m_算数: { SHO: 6 }, m_国語: { PAS: 6 }, m_理科: { SPD: 6 }, m_社会: { DEF: 6 }, m_生活: { STA: 6 },
};
export const MAX_EQUIP = 3;
export const BUFF_CAP = 40;
export const registerBuffs = (b) => Object.assign(BADGE_BUFFS, b); // メダルの ふえた ぶんの バフ(app.js から とうろく)
export function teamBuff(equip = []) {
  const out = emptyStatMap();
  for (const id of equip.slice(0, MAX_EQUIP)) {
    const b = BADGE_BUFFS[id]; if (!b) continue;
    for (const s of STATS) out[s] += (b[s] || 0) + (b.ALL || 0);
  }
  for (const s of STATS) out[s] = Math.min(BUFF_CAP, out[s]);
  return out;
}
export const buffText = (id) => {
  const b = BADGE_BUFFS[id]; if (!b) return '';
  return Object.entries(b).map(([s, v]) => `${s === 'ALL' ? 'ぜんぶ' : STAT_NAME[s]}+${v}%`).join(' ');
};

// ---- チーム編成と つよさ ----------------------------------------------------------------
const OUT_OF_POSITION = 0.85;
export function effectiveStats(base, { level = 0, buff = emptyStatMap(), penalty = 1, enh = 0 }) {
  return Object.fromEntries(STATS.map((s) => [s, Math.min(STAT_CAP, Math.round(base[s] * (1 + 0.04 * level) * (1 + ENH_STEP * enh) * (1 + buff[s] / 100) * penalty))]));
}
// ---- ガチャ選手の きょうか(ポイントで)。じぶんより ポイントが たくさん いる ----------------------------------
export const ENH_MAX = 20;        // 1人の 選手に かけられる きょうかの かず
export const ENH_STEP = 0.03;     // 1かいで のうりょく +3%(ダブりの レベルアップ(+4%)とは べつ)
export const STAT_CAP = 140;      // どんなに きょうかしても のうりょくは これ まで
const ENH_RARITY = { common: 1, uncommon: 1.5, rare: 2, super: 3, legend: 4 };
export const enhCost = (enh, rarity) => Math.round((3 + enh) * (ENH_RARITY[rarity] || 1));
export const totalPoints = (p) => STATS.reduce((a, s) => a + ((p.pts || {})[s] || 0), 0);
// ポイントを つかう(おおい ほうから へらす)。たりないと false
export function spendPoints(p, n) {
  if (totalPoints(p) < n) return false;
  p.pts = { ...emptyStatMap(), ...(p.pts || {}) };
  for (let i = 0; i < n; i++) { const s = STATS.reduce((m, x) => (p.pts[x] > p.pts[m] ? x : m), STATS[0]); p.pts[s]--; }
  return true;
}
export function enhance(p, id) {
  const pl = PLAYER_BY_ID[id]; if (!pl || !(p.owned || {})[id]) return false;
  p.plv = p.plv || {}; const e = p.plv[id] || 0;
  if (e >= ENH_MAX || !spendPoints(p, enhCost(e, pl.rarity))) return false;
  p.plv[id] = e + 1; return true;
}
const BENCH = { id: 'bench', name: 'ベンチの 子', face: '🪑', pos: 'ALL', rarity: 'common', stats: Object.fromEntries(STATS.map((s) => [s, 30])) };
// team: 11この わく(選手ID / 'self' / null)。kid: { name, face, stats }
export function teamSnapshot({ kid, owned = {}, team = [], equip = [], formation = '442', plv = {} }) {
  const buff = teamBuff(equip);
  return slotsOf(formation).map((slot, i) => {
    const id = team[i];
    let who; let level = 0; let penalty = 1; let enh = 0;
    if (id === 'self') who = { id: 'self', name: kid.name, face: kid.face, pos: 'ALL', rarity: 'kid', stats: kid.stats };
    else if (id && owned[id] && PLAYER_BY_ID[id]) {
      who = PLAYER_BY_ID[id]; level = levelOf(owned[id]); enh = (plv || {})[id] || 0;
      if (who.pos !== slot) penalty = OUT_OF_POSITION;
    } else who = BENCH;
    return { slot, id: who.id, name: who.name, face: who.face, img: who.img || '', pos: who.pos, rarity: who.rarity, level, enh, offPos: penalty < 1, stats: effectiveStats(who.stats, { level, buff, penalty, enh }) };
  });
}
const attSkill = (s) => 0.5 * s.SHO + 0.2 * s.PAS + 0.3 * s.SPD;
const defSkill = (s) => 0.6 * s.DEF + 0.2 * s.STA + 0.2 * s.SPD;
// ポジションごとの 「こうげき」「まもり」への きよ度(4-4-2)
const ATT_W = { FW: 1, MF: 0.5, DF: 0.1, GK: 0 };
const DEF_W = { FW: 0, MF: 0.5, DF: 1, GK: 1.5 };
export function ratings(snap) {
  let aw = 0; let as = 0; let dw = 0; let ds = 0; const n = { FW: 0, MF: 0, DF: 0 };
  snap.forEach((p) => {
    const pos = p.slot;
    n[pos] = (n[pos] || 0) + 1;
    aw += ATT_W[pos]; as += ATT_W[pos] * attSkill(p.stats);
    dw += DEF_W[pos]; ds += DEF_W[pos] * defSkill(p.stats);
  });
  // かたちの クセ: フォワードが おおいと こうげき、ディフェンダーが おおいと まもり(4-4-2 が きじゅん)
  const att = (as / aw) * (1 + 0.05 * (n.FW - 2) + 0.02 * (n.MF - 4));
  const def = (ds / dw) * (1 + 0.05 * (n.DF - 4) + 0.02 * (n.MF - 4));
  return { att, def, power: Math.round((att + def) / 2) };
}

// ---- 対戦(かんたんな シミュレーション) ---------------------------------------------------------
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const pickW = (arr, w, rnd) => { const t = w.reduce((a, b) => a + b, 0); let r = rnd() * t; for (let i = 0; i < arr.length; i++) { r -= w[i]; if (r <= 0) return arr[i]; } return arr[arr.length - 1]; };
export const goalChance = (att, def) => clamp(0.3 * (att / Math.max(1, def)) ** 1.3, 0.04, 0.8);
const at = (team, pos) => team.filter((x) => x.slot === pos);
export function simulate(a, b, rnd = Math.random, phases = 6) {
  const ra = ratings(a.team); const rb = ratings(b.team);
  const sides = [{ ...a, r: ra, key: 'a' }, { ...b, r: rb, key: 'b' }];
  const events = []; const score = { a: 0, b: 0 };
  for (let i = 0; i < phases * 2; i++) {
    const atk = sides[i % 2]; const dfn = sides[(i + 1) % 2];
    const fw = at(atk.team, 'FW'); const mf = at(atk.team, 'MF');
    const gk = at(dfn.team, 'GK')[0];
    const passers = [...mf, ...fw];
    const passer = pickW(passers, passers.map((x) => x.stats.PAS), rnd);
    const cands = [...fw, ...mf].filter((x) => x !== passer);
    const shooter = pickW(cands, cands.map((x) => x.stats.SHO * (fw.includes(x) ? 1 : 0.5)), rnd);
    const p = goalChance(atk.r.att, dfn.r.def);
    const roll = rnd();
    const type = roll < p ? 'goal' : roll < p + (1 - p) * 0.55 ? 'save' : 'miss';
    if (type === 'goal') score[atk.key]++;
    events.push({
      side: atk.key, type, passer: passer.name, shooter: shooter.name, keeper: gk.name, score: { ...score },
      text: type === 'goal' ? `${passer.name}の パスから ${shooter.name}が シュート! ゴール!!`
        : type === 'save' ? `${shooter.name}の シュートを ${gk.name}が ナイスセーブ!`
          : `${shooter.name}の シュートは ゴールの 外へ…`,
    });
  }
  return { events, score, ratings: { a: ra, b: rb } };
}

// CPUチーム: つよさは「じぶんに あわせない」。いつでも きまった つよさ(おそろしい あいては ほんとうに つよい)
export const CPU_LEVELS = [
  { id: 'easy', name: 'やさしい', power: 30, club: 'ルーキーズ FC' },
  { id: 'normal', name: 'ふつう', power: 52, club: 'ライバル ユナイテッド' },
  { id: 'hard', name: 'つよい', power: 72, club: 'ストロング ワンダラーズ' },
  { id: 'boss', name: 'ボス', power: 95, club: 'レジェンド オールスターズ' },
  { id: 'god', name: 'ちょうつよい', power: 110, club: 'ドリーム レジェンズ' },
];
// style: att = こうげき タイプ(まもりが うすい)/ def = まもり タイプ(こうげきが うすい)/ bal = バランス
const STYLE_MUL = { att: { SHO: 1.12, PAS: 1.1, SPD: 1.06, DEF: 0.88, STA: 0.94 }, def: { SHO: 0.88, PAS: 0.94, SPD: 0.96, DEF: 1.12, STA: 1.08 }, bal: {} };
export const STYLE_NAME = { att: '⚔ こうげき タイプ', def: '🛡 まもり タイプ', bal: '⚖ バランス タイプ' };
export function cpuTeamAt(power, name, rnd = Math.random, formation = '442', style = 'bal') {
  const faces = ['🦁', '🐯', '🦊', '🐻', '🐺', '🦅', '🐲', '🦈', '🐘', '🦏', '🧤'];
  const mul = STYLE_MUL[style] || {};
  const team = slotsOf(formation).map((slot, i) => ({
    slot, id: `cpu${i}`, name: `${FIRST[Math.floor(rnd() * FIRST.length)]}・${LAST[slot][Math.floor(rnd() * LAST[slot].length)]}`, face: faces[i % faces.length], pos: slot, rarity: 'common', level: 0, offPos: false,
    stats: Object.fromEntries(STATS.map((s) => [s, Math.round(power * (mul[s] || 1) * (0.9 + 0.2 * rnd()))])),
  }));
  return { name, team, formation, style };
}
export function cpuTeam(levelId, rnd = Math.random, formation = '442') {
  const lv = CPU_LEVELS.find((l) => l.id === levelId) || CPU_LEVELS[1];
  return cpuTeamAt(lv.power, lv.club, rnd, formation);
}

// ---- PK戦(ひきわけの ときの けっちゃく) -------------------------------------------------
export function shootout(powerA, powerB, rnd = Math.random) {
  const pa = clamp(0.72 + (powerA - powerB) / 800, 0.62, 0.82); const pb = clamp(0.72 + (powerB - powerA) / 800, 0.62, 0.82);
  let a = 0; let b = 0; const kicks = [];
  const kick = (side, p) => { const ok = rnd() < p; const kind = ok ? 'goal' : rnd() < 0.65 ? 'save' : 'miss'; kicks.push({ side, ok, kind }); if (ok) { if (side === 'a') a++; else b++; } };
  for (let i = 0; i < 5; i++) { kick('a', pa); kick('b', pb); }
  for (let i = 0; i < 40 && a === b; i++) { kick('a', pa); kick('b', pb); } // サドンデス
  if (a === b) { a++; kicks.push({ side: 'a', ok: true, kind: 'goal' }); }
  return { a, b, kicks };
}
// ふるい きろく(kicks が ない)から、じゅんばんを つくる
export function pkKicks(pk) {
  if (pk.kicks && pk.kicks.length) return pk.kicks;
  const R = Math.max(5, pk.a, pk.b); const out = [];
  for (let i = 0; i < R; i++) { out.push({ side: 'a', ok: i < pk.a, kind: i < pk.a ? 'goal' : 'save' }); out.push({ side: 'b', ok: i < pk.b, kind: i < pk.b ? 'goal' : 'save' }); }
  return out;
}
// かてる かくりつ(PK戦も ふくめた めやす)。ひょうじ用
export function winChance(me, opp, n = 160, rnd = Math.random) {
  let w = 0;
  for (let i = 0; i < n; i++) {
    const r = simulate(me, opp, rnd);
    if (r.score.a > r.score.b) w++; else if (r.score.a === r.score.b) { const k = shootout(ratings(me.team).power, ratings(opp.team).power, rnd); if (k.a > k.b) w++; }
  }
  return w / n;
}

// ---- たいかい(Jリーグ → アジアカップ → KIRINカップ → ワールドカップ) -----------------------------------
// 1つ かつごとに つぎの ラウンドへ。まけたら はいたい(1かいせんから)。ゆうしょうで つぎの たいかいが ひらく
export const CUPS = [
  { id: 'j', name: 'Jリーグ', icon: '🏟️', sub: 'J3から J1へ しょうかく! リーグを せいはしよう', badge: 'cup_j', final: { silver: 2 }, rounds: [
    { label: 'J3 リーグせん', name: '山形ブルーリバーFC', power: 34, style: 'def', reward: { bronze: 1 } },
    { label: 'J2 リーグせん', name: '水戸グリーンホップス', power: 41, style: 'att', reward: { bronze: 1 } },
    { label: 'J1 リーグせん', name: '名古屋ゴールデンシャチ', power: 50, style: 'bal', reward: { silver: 1 } },
    { label: 'ゆうしょう けっていせん', name: '大阪ブラックタイガース', power: 58, style: 'att', reward: { silver: 1 } },
  ] },
  { id: 'asia', name: 'アジアカップ', icon: '🏆', sub: 'アジアの てっぺんを めざせ!', badge: 'cup_asia', final: { gold: 1, silver: 2 }, rounds: [
    { label: 'グループステージ', name: 'タイ代表', power: 52, style: 'att', reward: { silver: 1 } },
    { label: 'ラウンド16', name: 'サウジアラビア代表', power: 60, style: 'def', reward: { silver: 1 } },
    { label: '準決勝', name: 'イラン代表', power: 68, style: 'bal', reward: { gold: 1 } },
    { label: '決勝', name: '韓国代表', power: 76, style: 'att', reward: { gold: 1 } },
  ] },
  { id: 'kirin', name: 'KIRINカップ', icon: '🍀', sub: 'せかいの ゲストチームを むかえうて!', badge: 'cup_kirin', final: { gold: 2 }, rounds: [
    { label: 'オープニングマッチ', name: 'ペルー代表', power: 70, style: 'bal', reward: { gold: 1 } },
    { label: '準決勝', name: 'ガーナ代表', power: 77, style: 'att', reward: { gold: 1 } },
    { label: '決勝', name: 'スイス代表', power: 84, style: 'def', reward: { gold: 1 } },
  ] },
  { id: 'wc', name: 'ワールドカップ', icon: '🌍', sub: 'せかい いちを きめる たたかい!', badge: 'cup_wc', final: { platinum: 2, gold: 3 }, rounds: [
    { label: 'グループステージ', name: 'モロッコ代表', power: 78, style: 'def', reward: { gold: 1 } },
    { label: 'ベスト16', name: 'ドイツ代表', power: 86, style: 'bal', reward: { gold: 1 } },
    { label: '準々決勝', name: 'スペイン代表', power: 92, style: 'att', reward: { platinum: 1 } },
    { label: '準決勝', name: 'アルゼンチン代表', power: 98, style: 'bal', reward: { platinum: 1 } },
    { label: '決勝', name: 'ブラジル代表', power: 105, style: 'att', reward: { platinum: 1 } },
  ] },
];
export const cupById = (id) => CUPS.find((c) => c.id === id);
export const MATCH_TICKET_CAP = 3; // くりかえしの たいかいで もらえる チケットの 1日の じょうげん(はじめて かった ラウンド・はじめての ゆうしょうは べつ)
export const ensureCup = (p) => { p.cup = p.cup || {}; p.cup.cleared = Array.isArray(p.cup.cleared) ? p.cup.cleared : []; p.cup.titles = p.cup.titles || {}; if (p.cup.run && !cupById(p.cup.run.id)) p.cup.run = null; return p.cup; };
export function cupUnlocked(p, id) {
  const i = CUPS.findIndex((c) => c.id === id); if (i < 0) return false;
  return i === 0 || ensureCup(p).cleared.includes(CUPS[i - 1].id);
}
export function cupRound(p, id) { const r = ensureCup(p).run; return r && r.id === id ? r.round : 0; }
export function cupOpponent(cup, round, rnd = Math.random) {
  const r = cup.rounds[round];
  return cpuTeamAt(r.power, r.name, rnd, FORMATIONS[Math.floor(rnd() * FORMATIONS.length)].id, r.style);
}
const mergeTickets = (...ts) => ts.reduce((a, t) => { for (const [k, v] of Object.entries(t || {})) a[k] = (a[k] || 0) + v; return a; }, {});
// しあいの けっかを たいかいに はんえいする。forgive: まけても おなじ しあいから やりなおせる
export function cupResult(p, id, round, won, forgive = false, today = '') {
  const cup = cupById(id); const c = ensureCup(p); const last = round >= cup.rounds.length - 1;
  if (!won) {
    if (forgive) { c.run = { id, round }; return { type: 'retry', round }; }
    c.run = null; return { type: 'out', round };
  }
  c.firsts = c.firsts || {};
  const key = `${id}:${round}`; const firstWin = !c.firsts[key]; c.firsts[key] = 1;
  const firstClear = last && !(c.titles[id] > 0);
  let reward = mergeTickets(cup.rounds[round].reward, last ? cup.final : null);
  let capped = false;
  if (!firstWin && !firstClear) { // 2かいめいこうの くりかえしは 1日の じょうげんが ある
    c.mt = c.mt && c.mt.date === today ? c.mt : { date: today, n: 0 };
    const out = {};
    for (const k of TICKET_ORDER) for (let i = 0; i < (reward[k] || 0); i++) { if (c.mt.n >= MATCH_TICKET_CAP) { capped = true; break; } out[k] = (out[k] || 0) + 1; c.mt.n++; }
    reward = out;
  }
  addTickets(p, reward);
  if (!last) { c.run = { id, round: round + 1 }; return { type: 'advance', round: round + 1, reward, capped }; }
  c.run = null; if (!c.cleared.includes(id)) c.cleared.push(id); c.titles[id] = (c.titles[id] || 0) + 1;
  return { type: 'cleared', reward, first: c.titles[id] === 1, capped };
}
