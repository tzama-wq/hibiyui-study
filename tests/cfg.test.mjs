import assert from 'node:assert/strict';
import {
  DEFAULTS, PRESETS, OPTIONS, BOOLS, sanitize, cfgOf, setCfg, applyPreset, lockMsFor, waitWrongMs,
  estimateMinutes, planPreview, gachaLeft, addGachaPulls, T,
} from '../cfg.js';

// 初期値: ぜんぶ ふつう(これまでと 同じ うごき)
assert.deepEqual(cfgOf({}, 'hibito'), DEFAULTS);
assert.equal(DEFAULTS.setSize, 5); assert.equal(DEFAULTS.gachaMax, 0);
for (const k of BOOLS) assert.equal(DEFAULTS[k], false, k);

// こわれた値は ふつうに もどる / 子どもごとに べつ
{
  const S = {};
  setCfg(S, 'hibito', { setSize: 3, calm: true });
  assert.equal(cfgOf(S, 'hibito').setSize, 3); assert.equal(cfgOf(S, 'hibito').calm, true);
  assert.equal(cfgOf(S, 'yuito').setSize, 5, '兄弟は べつ');
  assert.equal(sanitize({ setSize: 99 }).setSize, 5);
  assert.equal(sanitize({ lock: 'bogus' }).lock, 'normal');
  assert.equal(sanitize({ waitWrong: 7 }).waitWrong, 'normal');
  assert.equal(sanitize({ gachaMax: -5 }).gachaMax, 0);
  assert.equal(sanitize({ gachaMax: 999 }).gachaMax, 20);
  assert.equal(sanitize({ calm: 'yes' }).calm, true);
  assert.deepEqual(sanitize(null), DEFAULTS);
}

// おすすめセット
{
  const S = {};
  const adhd = applyPreset(S, 'hibito', 'adhd');
  assert.equal(adhd.setSize, 3); assert.equal(adhd.breakAfter, true); assert.equal(adhd.lock, 'short'); assert.equal(adhd.gachaMax, 5);
  assert.equal(adhd.calm, false, 'ADHD向けは 動きを けさない(すぐ ごほうびを みせる ほうが あう子が いる)');
  const asd = applyPreset(S, 'yuito', 'asd');
  for (const k of ['calm', 'quiet', 'plain', 'preview', 'soft']) assert.equal(asd[k], true, k);
  assert.ok(asd.gachaMax > 0 && asd.gachaMax <= 5, 'ガチャは 回数を おさえる');
  // 「おおきい もじ」は 子ども本人の えらんだ ものを のこす
  setCfg(S, 'yuito', { big: true });
  assert.equal(applyPreset(S, 'yuito', 'asd').big, true);
  // もとに もどす
  assert.deepEqual(applyPreset(S, 'hibito', 'reset'), DEFAULTS);
  assert.equal(applyPreset(S, 'hibito', 'nothing'), null);
  for (const [k, v] of Object.entries(PRESETS)) { for (const [key, val] of Object.entries(v.set)) assert.ok(key in DEFAULTS, `${k}.${key}`); assert.ok(v.name); }
}

// 待ち時間: ふつう / みじかい / なし
const L = (c, n) => lockMsFor(n, { ...DEFAULTS, ...c });
assert.equal(L({}, 10), 1500); assert.equal(L({}, 100), 3500, 'ふつうは いままでと同じ(1.5〜3.5秒)');
assert.equal(L({ lock: 'short' }, 5), 600); assert.equal(L({ lock: 'short' }, 100), 1500);
assert.equal(L({ lock: 'off' }, 100), 0);
for (const n of [0, 10, 40, 200]) assert.ok(L({ lock: 'short' }, n) <= L({}, n), 'みじかいは ふつうより みじかい');
assert.equal(waitWrongMs(DEFAULTS), 4000); assert.equal(waitWrongMs({ waitWrong: 'short' }), 2000); assert.equal(waitWrongMs({ waitWrong: 'off' }), 0);

// 見通し(これから やること)
assert.equal(estimateMinutes(3), 2); assert.equal(estimateMinutes(5), 3); assert.equal(estimateMinutes(1), 1);
{
  const mk = (subject, name) => ({ unit: { subject, name } });
  const plan = planPreview([mk('算数', 'わり算'), mk('算数', 'わり算'), mk('国語', '漢字'), mk('算数', 'わり算')]);
  assert.deepEqual(plan, [{ label: '算数:わり算', n: 2 }, { label: '国語:漢字', n: 1 }, { label: '算数:わり算', n: 1 }], 'じゅんばん どおりに');
  assert.deepEqual(planPreview([]), []);
}

// ガチャの 1日の かいすう
{
  const p = {}; const c = { ...DEFAULTS, gachaMax: 3 };
  assert.equal(gachaLeft(p, DEFAULTS, '2026-10-05'), Infinity, '0は せいげんなし');
  assert.equal(gachaLeft(p, c, '2026-10-05'), 3);
  addGachaPulls(p, '2026-10-05', 2);
  assert.equal(gachaLeft(p, c, '2026-10-05'), 1);
  addGachaPulls(p, '2026-10-05', 1);
  assert.equal(gachaLeft(p, c, '2026-10-05'), 0);
  assert.equal(gachaLeft(p, c, '2026-10-06'), 3, '次の日は また ひける');
}

// ことば: たとえを つかわない(ASD向け)。意味は 同じで、形は ちがう
{
  const n = T(DEFAULTS); const pl = T({ ...DEFAULTS, plain: true });
  assert.deepEqual(Object.keys(n), Object.keys(pl), 'ことばの 種類が そろっている');
  for (const key of ['ok', 'ng', 'retryNote', 'resultHigh', 'start', 'again']) assert.notEqual(n[key], pl[key], key);
  const all = JSON.stringify([pl.ok, pl.ng, pl.retryNote, pl.retryNow, pl.resultHigh, pl.resultLow, pl.start, pl.again, pl.mode, pl.combo(3), pl.score({ total: 5, good: 3, xp: 40, hat: true })]);
  for (const bad of ['キーパー', 'ゴール', 'ハットトリック', 'キックオフ', '🧤', '😉']) assert.ok(!all.includes(bad), `たとえが のこっている: ${bad}`);
  assert.match(n.score({ total: 5, good: 3, xp: 40, hat: true }), /ハットトリック/);
  assert.match(pl.score({ total: 5, good: 3, xp: 40, hat: false }), /5もん中 3もん せいかい/);
}
// 境界知能・ひとにやさしい せってい
{
  const S = {}; const c = applyPreset(S, 'x', 'bif');
  assert.equal(c.choices, '3'); assert.equal(c.hint, true); assert.equal(c.autoRead, true); assert.equal(c.setSize, 3); assert.equal(c.plain, true); assert.equal(c.forgive, true);
  assert.equal(c.lock, 'normal', '読む じかんは みじかく しない');
  assert.equal(sanitize({ choices: 9 }).choices, 'all'); assert.equal(sanitize({ choices: 2 }).choices, '2'); assert.equal(sanitize({ setSize: 2 }).setSize, 2);
  assert.equal(DEFAULTS.hint, false); assert.equal(DEFAULTS.choices, 'all');
  assert.ok(applyPreset(S, 'y', 'asd').calm && !applyPreset(S, 'y', 'asd').hint, 'ASD は ヒントなし・うごきを へらす');
}
console.log('OK: cfg');
