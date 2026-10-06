// やさしい せってい(ADHD・ASD などの おこさんへの はいりょ)。画面(DOM)には さわらない 純粋な ロジック。
// ※ 診断や治療では ありません。「よくある はいりょ」を、子どもごとに えらべる ように した ものです。

export const DEFAULTS = {
  setSize: 5,          // 1セットの もんだい数(3 / 5)
  calm: false,         // うごき・ひかり・紙ふぶきを へらす
  quiet: false,        // おと・ふるえを けす
  plain: false,        // たとえを つかわない、そのままの ことば
  preview: false,      // はじめる まえに「やること」を みせる(じゅんばんも ずっと おなじ)
  soft: false,         // 「できなかった」を みせない ひょうじ(ひかえ・からの まる を かくす)
  schedule: false,     // 「きょうの やること」リストを ホームに だす
  breakAfter: false,   // 1セット おわったら きゅうけいを すすめる
  big: false,          // おおきい もじ
  forgive: false,      // たいかいで まけても、おなじ しあいから やりなおせる(はいたいに ならない)
  lock: 'normal',      // 「よく よんでね」の まち: normal / short / off
  waitWrong: 'normal', // まちがえた あとの 「せつめいを よんでね」の まち: normal / short / off
  gachaMax: 0,         // ガチャを 1日に ひける かいすう(0 = せいげんなし)
};

// ふつう「よく ある はいりょ」を ならべた おすすめセット(いつでも 1つずつ かえられる)
export const PRESETS = {
  adhd: { name: 'ADHD(あつまりにくい・じっとしにくい)に やさしい', set: { setSize: 3, breakAfter: true, schedule: true, lock: 'short', waitWrong: 'short', gachaMax: 5, forgive: true } },
  asd: { name: 'ASD(みとおし・かんかくが だいじ)に やさしい', set: { calm: true, quiet: true, plain: true, preview: true, soft: true, schedule: true, lock: 'short', gachaMax: 3, forgive: true } },
  reset: { name: 'ぜんぶ ふつうに もどす', set: {} },
};

export const OPTIONS = {
  setSize: [3, 5],
  lock: ['normal', 'short', 'off'],
  waitWrong: ['normal', 'short', 'off'],
  gachaMax: [0, 1, 3, 5, 10],
};
export const BOOLS = ['calm', 'quiet', 'plain', 'preview', 'soft', 'schedule', 'breakAfter', 'big', 'forgive'];

// ---- 読みだし・書きこみ ---------------------------------------------------------------
export function sanitize(c) {
  const o = { ...DEFAULTS, ...(c || {}) };
  for (const k of BOOLS) o[k] = !!o[k];
  if (!OPTIONS.setSize.includes(Number(o.setSize))) o.setSize = DEFAULTS.setSize; else o.setSize = Number(o.setSize);
  for (const k of ['lock', 'waitWrong']) if (!OPTIONS[k].includes(o[k])) o[k] = DEFAULTS[k];
  o.gachaMax = Math.max(0, Math.min(20, Math.floor(Number(o.gachaMax) || 0)));
  return o;
}
export const cfgOf = (S, id) => sanitize(((S && S.cfg) || {})[id]);
export function setCfg(S, id, patch) {
  S.cfg = S.cfg || {};
  S.cfg[id] = sanitize({ ...cfgOf(S, id), ...patch });
  return S.cfg[id];
}
export function applyPreset(S, id, name) {
  if (!PRESETS[name]) return null;
  S.cfg = S.cfg || {};
  // おと・うごき・おおきい もじ は 子ども本人が じぶんで かえた ものを のこす(はいりょの おしつけに ならないように)
  const keep = {};
  for (const k of ['big']) if (cfgOf(S, id)[k]) keep[k] = true;
  S.cfg[id] = sanitize({ ...PRESETS[name].set, ...keep });
  return S.cfg[id];
}

// ---- 待ち時間 ------------------------------------------------------------------------
// 問題が出てから、ぶんしょうを よむ までの 待ち(はんしゃで おさせない ため)
export function lockMsFor(textLen, cfg) {
  if (cfg.lock === 'off') return 0;
  if (cfg.lock === 'short') return Math.min(1500, Math.max(600, textLen * 50));
  return Math.min(3500, Math.max(1500, textLen * 120));
}
export const waitWrongMs = (cfg) => ({ normal: 4000, short: 2000, off: 0 })[cfg.waitWrong] ?? 4000;

// ---- 見通し(これから やること) ---------------------------------------------------------
export const estimateMinutes = (n) => Math.max(1, Math.ceil((n * 30) / 60)); // 1もん 30びょう くらい
export function planPreview(items) { // [{label, n}] を、はじめに でてくる じゅんに
  const out = [];
  for (const it of items) {
    const label = `${it.unit.subject}:${it.unit.name}`;
    const last = out[out.length - 1];
    if (last && last.label === label) last.n++; else out.push({ label, n: 1 });
  }
  return out;
}

// ---- ガチャの 1日の かいすう ------------------------------------------------------------
export function gachaLeft(p, cfg, today) {
  if (!(cfg.gachaMax > 0)) return Infinity;
  const used = p.gachaDay && p.gachaDay.date === today ? p.gachaDay.n : 0;
  return Math.max(0, cfg.gachaMax - used);
}
export function addGachaPulls(p, today, n) {
  p.gachaDay = p.gachaDay && p.gachaDay.date === today ? p.gachaDay : { date: today, n: 0 };
  p.gachaDay.n += n;
}

// ---- ことば(ふつう / たとえを つかわない) ----------------------------------------------------
const NORMAL = {
  ok: '⚽ ゴール!!',
  combo: (n) => `🔥 ${n}れんぞく!`,
  ng: '🧤 おしい! キーパーに とめられた',
  retryNote: '👉 つぎに、かずを かえて もういちど ためすよ。おぼえた こたえは つかえないよ 😉',
  retryNow: '👨 ここは パパと いっしょに みよう! 「パパに きく」を おしてね。',
  resultHigh: '🏆 ナイスゲーム!',
  resultLow: '👏 おつかれさま!',
  score: (R) => `${R.total}もん中 ${R.good}ゴール ・ +${R.xp}ポイント ${R.hat ? '・🎩 ハットトリック!' : ''}`,
  start: 'キックオフ!',
  again: 'もういっかい キックオフ!',
  mode: { bonus: '🌟 かくれ', back: '⏪ タイム', retry: '🔁 もういちど', probe: '🔬 かくにん', normal: '🏟️ しあい' },
};
const PLAIN = {
  ok: '✅ せいかい!',
  combo: (n) => `${n}もん つづけて せいかい`,
  ng: 'ちがうよ。だいじょうぶ。いっしょに みてみよう',
  retryNote: 'つぎは、かずを かえた おなじ もんだいが でるよ。もういちど ためせるよ。',
  retryNow: 'わからなかったら「パパに きく」を おしてね。',
  resultHigh: 'よく できました',
  resultLow: 'おつかれさま',
  score: (R) => `${R.total}もん中 ${R.good}もん せいかい ・ +${R.xp}ポイント ${R.hat ? '・3もん つづけて せいかい' : ''}`,
  start: 'はじめる',
  again: 'もういちど やる',
  mode: { bonus: 'ごほうび ステージ', back: 'むかしの ふくしゅう', retry: 'もういちど', probe: 'かくにん', normal: 'もんだい' },
};
export const T = (cfg) => (cfg.plain ? PLAIN : NORMAL);
