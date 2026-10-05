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
export const SLOT_POS = ['FW', 'FW', 'MF', 'MF', 'MF', 'MF', 'DF', 'DF', 'DF', 'DF', 'GK'];
export const TEAM_SIZE = SLOT_POS.length;
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
const COUNTS = { common: 80, uncommon: 60, rare: 44, super: 24, legend: 12 };
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
      out.push({ id, name, pos, rarity, face, nation, type, img: type ? `images/players/${id}.webp` : '', stats });
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
  p.tk = p.tk && p.tk.date === today ? p.tk : { date: today, n: 0 };
  const want = studyReward(info);
  const got = {};
  for (const k of TICKET_ORDER) {
    for (let i = 0; i < (want[k] || 0); i++) {
      if (p.tk.n >= DAILY_STUDY_TICKET_CAP) break;
      got[k] = (got[k] || 0) + 1; p.tk.n++;
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
  hat: { SHO: 3, PAS: 2 }, perfect: { ALL: 3 }, comeback: { STA: 3, SPD: 2 }, time: { SPD: 3 }, hyp1: { ALL: 2 }, hyp5: { ALL: 4 },
  rank2: { ALL: 2 }, rank4: { ALL: 3 }, rank5: { ALL: 5 },
  m_算数: { SHO: 6 }, m_国語: { PAS: 6 }, m_理科: { SPD: 6 }, m_社会: { DEF: 6 }, m_生活: { STA: 6 },
};
export const MAX_EQUIP = 3;
export const BUFF_CAP = 40;
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
export function effectiveStats(base, { level = 0, buff = emptyStatMap(), penalty = 1 }) {
  return Object.fromEntries(STATS.map((s) => [s, Math.round(base[s] * (1 + 0.04 * level) * (1 + buff[s] / 100) * penalty)]));
}
const BENCH = { id: 'bench', name: 'ベンチの 子', face: '🪑', pos: 'ALL', rarity: 'common', stats: Object.fromEntries(STATS.map((s) => [s, 30])) };
// team: 11この わく(選手ID / 'self' / null)。kid: { name, face, stats }
export function teamSnapshot({ kid, owned = {}, team = [], equip = [] }) {
  const buff = teamBuff(equip);
  return SLOT_POS.map((slot, i) => {
    const id = team[i];
    let who; let level = 0; let penalty = 1;
    if (id === 'self') who = { id: 'self', name: kid.name, face: kid.face, pos: 'ALL', rarity: 'kid', stats: kid.stats };
    else if (id && owned[id] && PLAYER_BY_ID[id]) {
      who = PLAYER_BY_ID[id]; level = levelOf(owned[id]);
      if (who.pos !== slot) penalty = OUT_OF_POSITION;
    } else who = BENCH;
    return { slot, id: who.id, name: who.name, face: who.face, img: who.img || '', pos: who.pos, rarity: who.rarity, level, offPos: penalty < 1, stats: effectiveStats(who.stats, { level, buff, penalty }) };
  });
}
const attSkill = (s) => 0.5 * s.SHO + 0.2 * s.PAS + 0.3 * s.SPD;
const defSkill = (s) => 0.6 * s.DEF + 0.2 * s.STA + 0.2 * s.SPD;
// ポジションごとの 「こうげき」「まもり」への きよ度(4-4-2)
const ATT_W = { FW: 1, MF: 0.5, DF: 0.1, GK: 0 };
const DEF_W = { FW: 0, MF: 0.5, DF: 1, GK: 1.5 };
export function ratings(snap) {
  let aw = 0; let as = 0; let dw = 0; let ds = 0;
  snap.forEach((p, i) => {
    const pos = SLOT_POS[i];
    aw += ATT_W[pos]; as += ATT_W[pos] * attSkill(p.stats);
    dw += DEF_W[pos]; ds += DEF_W[pos] * defSkill(p.stats);
  });
  const att = as / aw; const def = ds / dw;
  return { att, def, power: Math.round((att + def) / 2) };
}

// ---- 対戦(かんたんな シミュレーション) ---------------------------------------------------------
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const pickW = (arr, w, rnd) => { const t = w.reduce((a, b) => a + b, 0); let r = rnd() * t; for (let i = 0; i < arr.length; i++) { r -= w[i]; if (r <= 0) return arr[i]; } return arr[arr.length - 1]; };
export const goalChance = (att, def) => clamp(0.3 * (att / Math.max(1, def)) ** 1.3, 0.04, 0.8);
const GK_SLOT = SLOT_POS.lastIndexOf('GK');
const at = (team, pos) => team.filter((_, i) => SLOT_POS[i] === pos);
export function simulate(a, b, rnd = Math.random, phases = 6) {
  const ra = ratings(a.team); const rb = ratings(b.team);
  const sides = [{ ...a, r: ra, key: 'a' }, { ...b, r: rb, key: 'b' }];
  const events = []; const score = { a: 0, b: 0 };
  for (let i = 0; i < phases * 2; i++) {
    const atk = sides[i % 2]; const dfn = sides[(i + 1) % 2];
    const fw = at(atk.team, 'FW'); const mf = at(atk.team, 'MF');
    const gk = dfn.team[GK_SLOT];
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

// CPUチーム(じぶんの つよさに あわせて つくる)
export const CPU_LEVELS = [
  { id: 'easy', name: 'やさしい', factor: 0.75, club: 'ルーキーズ FC' },
  { id: 'normal', name: 'ふつう', factor: 1.0, club: 'ライバル ユナイテッド' },
  { id: 'hard', name: 'つよい', factor: 1.25, club: 'ストロング ワンダラーズ' },
  { id: 'boss', name: 'ボス', factor: 1.6, club: 'レジェンド オールスターズ' },
];
export function cpuTeam(power, levelId, rnd = Math.random) {
  const lv = CPU_LEVELS.find((l) => l.id === levelId) || CPU_LEVELS[1];
  const base = Math.max(35, power * lv.factor);
  const faces = ['🦁', '🐯', '🦊', '🐻', '🐺', '🦅', '🐲', '🦈', '🐘', '🦏', '🧤'];
  const team = SLOT_POS.map((slot, i) => ({
    slot, id: `cpu${i}`, name: `${FIRST[Math.floor(rnd() * FIRST.length)]}・${LAST[slot][Math.floor(rnd() * LAST[slot].length)]}`, face: faces[i % faces.length], pos: slot, rarity: 'common', level: 0, offPos: false,
    stats: Object.fromEntries(STATS.map((s) => [s, Math.round(base * (0.9 + 0.2 * rnd()))])),
  }));
  return { name: lv.club, team };
}
