import * as sync from './sync.js';
import { addPoints, SUBJECT_STAT, studyReward, PRACTICE_TICKET_CAP as PRACTICE_CAP } from './game.js';
import { DEFAULTS, PRESETS, OPTIONS, BOOLS, cfgOf, setCfg, applyPreset, lockMsFor, waitWrongMs, estimateMinutes, planPreview, T } from './cfg.js';
import { gameInit, ensureGame, ticketBar, loginCard, gachaTab, teamTab, battleView, onAct as gameAct, summaryTeam, awardStudy, resetBattle } from './ui-game.js';
import { TAGS, unitsOf, skillsUpTo, byId, currentUnits, makeQuestion, makeProbe, shuffle, registerKokugo, registerKnowledge, registerGeo, setSeen, KUKU_DAN } from './gen.js';
import { observe, nextProbes, noteProbe, specFor, activeList, counts, THRESH } from './hyp.js';

// ---- 設定 -----------------------------------------------------------------
const KIDS = [
  { id: 'hibito', name: 'ひびと', grade: 4, color: '#1e6bd6', em: '⚽' },
  { id: 'yuito', name: 'ゆいと', grade: 2, color: '#d6341e', em: '⚽' },
  { id: 'papa', name: 'パパ', grade: 4, color: '#2a9d6f', em: '👨', adult: true }, // パパも 3にんめの 選手として さんか(小4の もんだい)
];
// ランク(25だん)。さいごまで いくには ながい たびに なる。むかしの きろく(xp)は そのまま ひきつぐ
const RANKS = [
  [0, 'サッカーきょうしつ'], [100, 'ジュニアユース'], [250, 'ジュニアユースの エース'], [450, 'ユースの レギュラー'], [700, 'ユースの エース'],
  [1000, 'ユースだいひょう'], [1400, 'プロ1ねんめ'], [1900, 'プロの レギュラー'], [2500, 'Jリーガー'], [3200, 'Jリーグの エース'],
  [4000, 'Jリーグ ベストイレブン'], [5000, 'Jリーグ MVP'], [6200, 'にほんだいひょうこうほ'], [7600, 'にほんだいひょう'], [9200, 'にほんだいひょうの エース'],
  [11000, 'だいひょうの キャプテン'], [13000, 'ヨーロッパへ ちょうせん'], [15500, 'ヨーロッパの レギュラー'], [18500, 'ヨーロッパの スター'], [22000, 'チャンピオンズリーグの スター'],
  [26000, 'ワールドカップの だいひょう'], [30000, 'ワールドカップの スター'], [35000, 'バロンドールこうほ'], [41000, 'バロンドール'], [50000, 'サッカーの でんせつ'],
];
const rankIdx = (name) => RANKS.findIndex((r) => r[1] === name);
// 1セットの もんだい数は 子どもごとの せってい(cfg.js の setSize。ふつうは 5)
const MAX_BONUS = 3;

// ---- 保存 -----------------------------------------------------------------
const KEY = 'hibiyui.v1';
const newKid = () => ({ badges: [], seen: [], xp: 0, goals: 0, days: [], lastDate: null, units: {}, tags: {}, ask: [], today: { date: null, sets: 0, bonusTotal: 0, bonusDone: 0 } });
const init = () => ({ kids: Object.fromEntries(KIDS.map((k) => [k.id, newKid()])), override: {} });
let S;
try { S = JSON.parse(localStorage.getItem(KEY)) || init(); } catch { S = init(); }
for (const k of KIDS) S.kids[k.id] = { ...newKid(), ...S.kids[k.id] };
S.override = S.override || {};
for (const k of KIDS) ensureGame(S.kids[k.id]);
// このスマホの持ち主(ひびと/ゆいと)。リンクで指定された場合は、まだ決まっていなければ それに する
if (!S.bound && sync.hashKid && KIDS.some((k) => k.id === sync.hashKid)) S.bound = sync.hashKid;
if (S.bound && !KIDS.some((k) => k.id === S.bound)) S.bound = null;
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* 保存できなくても動く */ } };

// ---- 日付 -----------------------------------------------------------------
const pad = (n) => String(n).padStart(2, '0');
const dstr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => dstr(new Date());
const dayNum = (s) => { const [y, m, d] = s.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 864e5); };

// 日が変わったら、お休みした日数から「かくれステージ」を用意する
function refreshDay(p) {
  const t = todayStr();
  if (p.today.date === t) return;
  const gap = p.lastDate ? dayNum(t) - dayNum(p.lastDate) - 1 : 0;
  p.today = { date: t, sets: 0, bonusTotal: Math.min(Math.max(gap, 0), MAX_BONUS), bonusDone: 0, gap: Math.max(gap, 0) };
  save();
}

const rankOf = (xp) => {
  let i = 0;
  RANKS.forEach(([min], idx) => { if (xp >= min) i = idx; });
  const next = RANKS[i + 1];
  return { i, name: RANKS[i][1], next, pct: next ? Math.round(((xp - RANKS[i][0]) / (next[0] - RANKS[i][0])) * 100) : 100 };
};

// ---- 出題の組み立て -------------------------------------------------------
// 単元ごとの習熟状態: unknown(まだ) / ok / shaky(あやしい) / gap(ぬけてる)
function status(p, id) {
  const u = p.units[id];
  const n = u ? u.ok + u.ng : 0;
  if (!n) return 'unknown';
  let base;
  if (n === 1) base = u.ok ? 'ok' : 'shaky';
  else {
    const h = u.h && u.h.length >= 2 ? u.h.slice(-4) : null;
    const rate = h ? h.reduce((a, b) => a + b, 0) / h.length : u.ok / n;
    base = rate >= 0.75 ? 'ok' : rate >= 0.5 ? 'shaky' : 'gap';
  }
  // 1日だけの「できた」は まだ「できた」にしない(答えを おぼえただけかも。べつの日に もういちど たしかめる)
  if (base === 'ok' && (u.d || []).length < 2) return 'sprout';
  return base;
}
const lastCorrectDay = (p, id) => { const d = (p.units[id] || {}).d || []; return d[d.length - 1]; };
// いま たしかめる ひつようが ある単元か(sprout は べつの日に)
const needs = (p, id) => { const st = status(p, id); return st !== 'ok' && !(st === 'sprout' && lastCorrectDay(p, id) === todayStr()); };
const ICON = { ok: '✅', sprout: '🌱', shaky: '🔸', gap: '🔻', unknown: '⬜' };
const WEIGHT = { ok: 0.1, sprout: 0.5, shaky: 0.6, gap: 0.9, unknown: 0.3 };

function weakPick(p, units) {
  const w = units.map((u) => 1 + 4 * WEIGHT[status(p, u.id)]);
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < units.length; i++) { r -= w[i]; if (r <= 0) return units[i]; }
  return units[units.length - 1];
}

// タイムマシン: あやしい単元の「前提」を たどって、本当に ぬけている 昔の単元を 探す
function backCandidates(kid) {
  const p = S.kids[kid.id];
  const sk = skillsUpTo(kid.grade);
  const cur = currentUnits(kid.grade, new Date().getMonth() + 1, S.override[kid.id]);
  const cand = new Set();
  const walk = (id) => { for (const pr of byId[id].pre) { if (needs(p, pr)) cand.add(pr); walk(pr); } };
  sk.filter((u) => ['gap', 'shaky'].includes(status(p, u.id))).forEach((u) => { cand.add(u.id); walk(u.id); });
  sk.filter((u) => status(p, u.id) === 'sprout' && needs(p, u.id)).forEach((u) => cand.add(u.id));
  cur.forEach((u) => walk(u.id));
  sk.filter((u) => u.grade < kid.grade && status(p, u.id) === 'unknown').forEach((u) => cand.add(u.id));
  const rank = (id) => ({ gap: 0, shaky: 1, sprout: 2, unknown: 3, ok: 4 })[status(p, id)] * 10 + byId[id].grade;
  return [...cand].filter((id) => needs(p, id)).sort((a, b) => rank(a) - rank(b)).map((id) => byId[id]);
}

// せんたくしの かずを へらす(せいかい + まちがい を いくつか のこす)
function limitQ(q, n, keepTag) { // keepTag: たしかめる もんだいの「わな」は のこす
  const m = Number(n); if (!m || q.choices.length <= m) return q;
  const ok = q.choices.find((c) => c.ok); const wrong = shuffle(q.choices.filter((c) => !c.ok)).sort((x, y) => (y.tag === keepTag) - (x.tag === keepTag)).slice(0, m - 1);
  return { ...q, choices: shuffle([ok, ...wrong]) };
}
function buildSet(kid, mode, unitId) {
  const p = S.kids[kid.id];
  const kc = cfgOf(S, kid.id); const SET_SIZE = kc.setSize;
  const sk = skillsUpTo(kid.grade);
  const cur = currentUnits(kid.grade, new Date().getMonth() + 1, S.override[kid.id]);
  let plan;
  const today = todayStr();
  if (mode === 'practice') plan = Array(SET_SIZE).fill(byId[unitId]);
  else if (mode === 'hyp') { // 「たしかめる」ボタン: ひとつの かせつを しらべる 問題だけ
    const h = (p.hyp || {})[unitId];
    plan = h && byId[h.unit] ? Array.from({ length: SET_SIZE }, () => ({ unit: byId[h.unit], probe: specFor(h), hkey: h.key })) : Array(SET_SIZE).fill(cur[0]);
  } else if (mode === 'back') {
    const c = backCandidates(kid);
    const pool = c.length ? c : sk.filter((u) => u.grade < kid.grade);
    plan = Array.from({ length: SET_SIZE }, (_, i) => pool[i % pool.length]);
  } else if (mode === 'bonus') {
    const c = backCandidates(kid);
    plan = Array.from({ length: SET_SIZE }, (_, i) => (i % 2 === 0 && c.length ? c[(i / 2) % c.length] : weakPick(p, sk)));
  } else {
    const review = sk.filter((u) => !cur.includes(u));
    const c = backCandidates(kid);
    const ko = unitsOf(kid.grade).find((u) => u.subject === '国語');
    const month = new Date().getMonth() + 1;
    const know = unitsOf(kid.grade).filter((u) => ['理科', '社会', '生活'].includes(u.subject));
    const knowNow = know.filter((u) => u.months.includes(month));
    const kpool = knowNow.length ? knowNow : know;
    const kn = kpool.length ? kpool[Math.floor(Math.random() * kpool.length)] : null;
    // だいじな じゅんに ならべて、せっていの もんだい数ぶん つかう。「やることを みせる」せっていの ときは じゅんばんを かえない
    plan = [cur[0], ko || cur[1 % cur.length], kn || cur[2 % cur.length], c.length ? c[0] : weakPick(p, review.length ? review : sk), cur[1 % cur.length]].slice(0, SET_SIZE);
    if (!kc.preview) plan = shuffle(plan);
    // いま たしかめ中の かせつが あれば、1もん(大きいセットは 2もん)を「たしかめる 問題」に する
    const nProbe = Math.min(2, Math.max(1, Math.floor(SET_SIZE / 3)));
    nextProbes(p, today, nProbe + 2).filter((h) => byId[h.unit]).slice(0, nProbe).forEach((h, i) => { plan[plan.length - 1 - i] = { unit: byId[h.unit], probe: specFor(h), hkey: h.key }; });
  }
  const seen = new Set();
  return plan.map((entry) => {
    const unit = entry.probe ? entry.unit : entry;
    let q;
    for (let t = 0; t < 8; t++) { q = entry.probe ? makeProbe(unit, entry.probe) : makeQuestion(unit); if (!seen.has(q.text)) break; }
    seen.add(q.text);
    q = limitQ(q, kc.choices, entry.probe && entry.probe.tag);
    return { unit, q, retry: false, probe: !!entry.probe, hkey: entry.hkey };
  });
}

// ---- 画面状態 -------------------------------------------------------------
S.kidPins = S.kidPins || {};
// 2人で1台を使うモード(S.shared)では、さいしょは「だれが つかう?」から
let kidId = S.shared ? null : (S.bound || null);
let view = kidId ? 'kid' : 'setup';
let unlocked = false; // その子のPINを いれたか(アプリを ひらくたびに リセット)
let Q = null; // クイズ中の状態
const kidOf = () => KIDS.find((k) => k.id === kidId);
const $app = document.getElementById('app');

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600);
}
// 読みあげ: HTMLタグと【】を とる。読み問題は 答えを 読んでしまわないよう、【】の中は「まる まる」と 読む
const speakText = (s) => (/読みは|よみは/.test(s) ? s.replace(/【[^】]*】/g, ' まるまる ') : s).replace(/<[^>]*>/g, ' ').replace(/[【】]/g, ' ').replace(/×/g, ' かける ').replace(/÷/g, ' わる ').replace(/\+/g, ' たす ').replace(/−/g, ' ひく ').replace(/=/g, ' は ').replace(/\?/g, '');
function speak(text) {
  try { const u = new SpeechSynthesisUtterance(speakText(text)); u.lang = 'ja-JP'; u.rate = 0.9; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch { /* 非対応 */ }
}

// ---- 動き・音・ふるえ ---------------------------------------------------------
const osReduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
let reduceMotion = osReduce; // スマホの「うごきを へらす」か、アプリの せっていの どちらかで おさえる
const cfg = () => (kidId ? cfgOf(S, kidId) : DEFAULTS);
const quiet = () => !!S.mute || (kidId ? cfgOf(S, kidId).quiet : false);
function applyCfg() {
  const c = cfg();
  reduceMotion = osReduce || c.calm;
  document.body.classList.toggle('calm', c.calm);
  document.body.classList.toggle('big', c.big);
}
let lastTap = { x: innerWidth / 2, y: innerHeight / 2 };
function vibrate(p) { try { if (!quiet() && navigator.vibrate) navigator.vibrate(p); } catch { /* 非対応 */ } }
let actx;
const SND = { ok: [[660, 0.09], [880, 0.16]], ng: [[260, 0.12], [200, 0.2]], win: [[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.3]] };
function beep(name) {
  if (quiet()) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    let t = actx.currentTime;
    for (const [f, d] of SND[name]) {
      const o = actx.createOscillator(); const g = actx.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + d + 0.02);
      t += d * 0.85;
    }
  } catch { /* 音が出なくても動く */ }
}
// 紙ふぶき(動きを減らす設定のときは出さない)
function confetti(x, y, n = 36, spread = 1) {
  if (reduceMotion) return;
  const cv = document.getElementById('fx'); if (!cv) return;
  cv.width = innerWidth; cv.height = innerHeight;
  const ctx = cv.getContext('2d');
  const colors = ['#ffc93c', '#27d8ff', '#2f7bff', '#19d68a', '#ff4d5e', '#ffffff'];
  const ps = Array.from({ length: n }, () => ({
    x, y, vx: (Math.random() - 0.5) * 12 * spread, vy: -Math.random() * 11 * spread - 3, g: 0.35,
    r: Math.random() * 6.3, vr: (Math.random() - 0.5) * 0.4, s: 5 + Math.random() * 6, c: colors[(Math.random() * colors.length) | 0], life: 70 + Math.random() * 30,
  }));
  let frames = 0;
  const step = () => {
    ctx.clearRect(0, 0, cv.width, cv.height);
    let alive = 0;
    for (const p of ps) {
      if (p.life-- <= 0) continue;
      alive++; p.vy += p.g; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.globalAlpha = Math.min(1, p.life / 30); ctx.fillStyle = p.c;
      ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore();
    }
    if (alive && frames++ < 200) requestAnimationFrame(step); else ctx.clearRect(0, 0, cv.width, cv.height);
  };
  requestAnimationFrame(step);
}
// 「+10」が ふわっと うかぶ
function floaty(text, x, y) {
  if (reduceMotion) return;
  const d = document.createElement('div');
  d.className = 'floaty'; d.textContent = text; d.style.left = `${x}px`; d.style.top = `${y}px`;
  document.body.appendChild(d); setTimeout(() => d.remove(), 1000);
}
// 数字のカウントアップと、リングの伸び
const lastCount = {};
function animateCounts() {
  document.querySelectorAll('[data-count]').forEach((el) => {
    const key = el.dataset.key; const to = Number(el.dataset.count);
    const from = reduceMotion ? to : (lastCount[key] ?? 0);
    lastCount[key] = to;
    if (from === to) { el.textContent = to; return; }
    const t0 = performance.now();
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / 700);
      el.textContent = Math.round(from + (to - from) * (1 - (1 - k) ** 3));
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const fillRings = () => document.querySelectorAll('[data-ring]').forEach((el) => {
    el.style.strokeDashoffset = String(113.1 * (1 - Math.max(0, Math.min(1, Number(el.dataset.ring)))));
  });
  requestAnimationFrame(() => requestAnimationFrame(fillRings));
  setTimeout(fillRings, 120); // 画面が見えていない間も、リングが空のままにならないように
}
const ringSvg = (cls, pct) => `<svg class="${cls}" viewBox="0 0 44 44"><circle class="rg-bg" cx="22" cy="22" r="18"/><circle class="rg-fg" cx="22" cy="22" r="18" stroke-dasharray="113.1" stroke-dashoffset="113.1" data-ring="${pct}"/></svg>`;

// ---- きょうだい共有 ---------------------------------------------------------
const summary = (k) => { const p = S.kids[k.id]; return { name: k.name, grade: k.grade, xp: p.xp, goals: p.goals, days: p.days.length, rank: rankOf(p.xp).name, recent: p.days.slice(-14), callup: p.callup || null, team: summaryTeam(k, p) }; };
// ---- メダル(実績) -------------------------------------------------------------
const masterCount = (p, k, sj) => skillsUpTo(k.grade).filter((u) => u.subject === sj && ['ok', 'sprout'].includes(status(p, u.id)) && (p.units[u.id] || {}).ok >= 3).length;
const BADGES = [
  { id: 'goal1', icon: '⚽', name: 'はじめての ゴール', cond: (p) => p.goals >= 1 },
  { id: 'goal10', icon: '🔟', name: '10ゴール', cond: (p) => p.goals >= 10 },
  { id: 'goal50', icon: '🥉', name: '50ゴール', cond: (p) => p.goals >= 50 },
  { id: 'goal100', icon: '🥈', name: '100ゴール', cond: (p) => p.goals >= 100 },
  { id: 'goal300', icon: '🥇', name: '300ゴール', cond: (p) => p.goals >= 300 },
  { id: 'day3', icon: '📅', name: '3日 れんしゅう', cond: (p) => p.days.length >= 3 },
  { id: 'day7', icon: '🗓️', name: '7日 れんしゅう', cond: (p) => p.days.length >= 7 },
  { id: 'day30', icon: '🏅', name: '30日 れんしゅう', cond: (p) => p.days.length >= 30 },
  { id: 'hat', icon: '🎩', name: 'ハットトリック', cond: (p) => (p.hat || 0) >= 1 },
  { id: 'perfect', icon: '✨', name: 'パーフェクトゲーム', cond: (p) => (p.perfect || 0) >= 1 },
  { id: 'comeback', icon: '🌟', name: 'おかえり ステージ クリア', cond: (p) => !!p.callup },
  { id: 'time', icon: '⏪', name: 'タイムマシンに のった', cond: (p) => (p.backRuns || 0) >= 1 },
  { id: 'kuku9', icon: '✖️', name: '九九マスター', cond: (p) => KUKU_DAN.every((id) => status(p, id) === 'ok') },
  { id: 'cup_j', icon: '🏟️', name: 'Jリーグ ゆうしょう', cond: (p) => ((p.cup || {}).cleared || []).includes('j') },
  { id: 'cup_asia', icon: '🏆', name: 'アジアカップ ゆうしょう', cond: (p) => ((p.cup || {}).cleared || []).includes('asia') },
  { id: 'cup_kirin', icon: '🍀', name: 'KIRINカップ ゆうしょう', cond: (p) => ((p.cup || {}).cleared || []).includes('kirin') },
  { id: 'cup_wc', icon: '🌍', name: 'ワールドカップ ゆうしょう', cond: (p) => ((p.cup || {}).cleared || []).includes('wc') },
  { id: 'hyp1', icon: '🔬', name: 'はじめて のりこえた', cond: (p) => (p.hypResolved || 0) >= 1 },
  { id: 'hyp5', icon: '🧪', name: '5つ のりこえた', cond: (p) => (p.hypResolved || 0) >= 5 },
  { id: 'rank2', icon: '🚀', name: 'ユースの エース', cond: (p) => rankOf(p.xp).i >= rankIdx('ユースの エース') },
  { id: 'rank4', icon: '🏟️', name: 'Jリーガー', cond: (p) => rankOf(p.xp).i >= rankIdx('Jリーガー') },
  { id: 'rank5', icon: '🇯🇵', name: 'にほんだいひょう', cond: (p) => rankOf(p.xp).i >= rankIdx('にほんだいひょう') },
  { id: 'rank_eu', icon: '🌍', name: 'ヨーロッパの スター', cond: (p) => rankOf(p.xp).i >= rankIdx('ヨーロッパの スター') },
  { id: 'rank_wc', icon: '🏆', name: 'ワールドカップの スター', cond: (p) => rankOf(p.xp).i >= rankIdx('ワールドカップの スター') },
  { id: 'rank_max', icon: '👑', name: 'サッカーの でんせつ', cond: (p) => rankOf(p.xp).i >= RANKS.length - 1 },
  ...[['算数', '🔢'], ['国語', '📖'], ['理科', '🔬'], ['社会', '🏙️'], ['生活', '🌱']].map(([sj, icon]) => (
    { id: `m_${sj}`, icon, name: `${sj}の プロ`, cond: (p, k) => masterCount(p, k, sj) >= 3 })),
];

// ---- 日本代表の選出 ---------------------------------------------------------
// 直近7日で need 日以上 れんしゅうすると 選出。かくれステージを クリアすると 追加招集(3日間)。
const WINDOW = 7;
const needDays = () => S.need || 3;
function selection(recent, callup) {
  const t = dayNum(todayStr());
  const n = new Set(recent.filter((d) => { const x = t - dayNum(d); return x >= 0 && x < WINDOW; })).size;
  const called = !!callup && t - dayNum(callup) >= 0 && t - dayNum(callup) <= 3;
  const state = n >= needDays() || called ? 'in' : n === needDays() - 1 ? 'close' : 'out';
  return { n, state, called };
}
// ローカルと共有データを あわせた その子の じょうほう(日数は ふえるだけなので ひとつに まとめる)
function dataFor(k) {
  const loc = summary(k); const rem = S.remote && S.remote[k.id];
  const d = rem && rem.xp > loc.xp ? { ...loc, ...rem } : loc;
  const recent = [...new Set([...(loc.recent || []), ...((rem && rem.recent) || [])])];
  const callup = [loc.callup, rem && rem.callup].filter(Boolean).sort().pop() || null;
  return { ...d, recent, callup, remote: !!(rem && rem.xp > loc.xp), sel: selection(recent, callup) };
}
const bothIn = () => KIDS.filter((x) => !x.adult).every((x) => dataFor(x).sel.state === 'in'); // 日本代表の ボーナスは 子ども ふたりぶん(パパは かんけいなし)
const repBonus = (k) => (dataFor(k).sel.state === 'in' ? 3 : 0) + (bothIn() ? 2 : 0);

async function syncNow() {
  if (!sync.enabled()) return;
  const k = kidId && kidOf();
  if (k) await sync.push(k.id, summary(k));
  const r = await sync.pull();
  if (r) { S.remote = r; save(); if (view === 'kid') render(); }
}
const MILESTONES = [50, 100, 200, 300, 500, 750, 1000, 1500, 2000, 3000, 5000];
const ago = (t) => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 1 ? 'いま' : m < 60 ? `${m}ふん前` : m < 1440 ? `${Math.round(m / 60)}じかん前` : `${Math.round(m / 1440)}日前`; };
const SUBJECT_ICON = { 算数: '🔢', 国語: '📖', 理科: '🔬', 社会: '🏙️', 生活: '🌱' };
const SUBJECTS = ['算数', '国語', '理科', '社会', '生活'];

// ---- 選手カード(能力値) ----------------------------------------------------------
// 教科ごとの「ほんとに できる 度合い」を 40〜99 の 能力値に する。ぜんぶ ⬜ なら 40 から スタート。
function ability(k, p) {
  const W = { ok: 1, sprout: 0.6, shaky: 0.3, gap: 0.1, unknown: 0 };
  const sk = skillsUpTo(k.grade);
  const stats = {};
  for (const sj of SUBJECTS) {
    const us = sk.filter((u) => u.subject === sj);
    if (!us.length) continue;
    stats[sj] = Math.round(40 + 59 * (us.reduce((a, u) => a + W[status(p, u.id)], 0) / us.length));
  }
  const vals = Object.values(stats);
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 40;
  const ovr = Math.min(99, Math.round(avg) + Math.round((rankOf(p.xp).i * 7) / (RANKS.length - 1))); // ランクの ぶんは さいだい +7
  return { stats, ovr, tier: ovr >= 80 ? 'legend' : ovr >= 65 ? 'gold' : ovr >= 50 ? 'silver' : 'bronze' };
}

function playerCard(k, p) {
  const ab = ability(k, p); const r = rankOf(p.xp);
  return `<section class="pcard tier-${ab.tier}">
    <div class="pc-shine"></div>
    <div class="pc-left"><div class="pc-ovr"><b data-count="${ab.ovr}" data-key="ovr">${ab.ovr}</b></div><div class="pc-ovr-l">OVR</div><div class="pc-grade">${k.grade}ねん</div></div>
    <div class="pc-ava">${k.em}</div>
    <div class="pc-name">${k.name}</div>
    <div class="pc-rank">${r.name}</div>
    <div class="pc-stats">${Object.entries(ab.stats).map(([sj, v]) => `<div><span>${SUBJECT_ICON[sj]} ${sj}</span><b>${v}</b></div>`).join('')}</div>
    <div class="pc-xp"><i style="width:${r.pct}%"></i></div>
    <div class="pc-xpl">${r.next ? `つぎの ランクまで あと ${r.next[0] - p.xp}` : 'MAX RANK'}</div>
  </section>`;
}

// ---- きょうだいチーム(ひとの 記録を 見るだけ。問題は ひらけない) -----------------------------
function siblingsCard() {
  const rows = KIDS.map((k) => ({ k, d: dataFor(k), remote: dataFor(k).remote, sel: dataFor(k).sel }));
  const total = rows.reduce((a, r) => a + r.d.goals, 0);
  const next = MILESTONES.find((m) => m > total) || total + 1000;
  const prev = [...MILESTONES].reverse().find((m) => m <= total) || 0;
  const pct = Math.round(((total - prev) / (next - prev)) * 100);
  const waiting = sync.enabled() && rows.some((r) => r.k.id !== kidId && !(S.remote && S.remote[r.k.id]));
  return `<section class="panel"><h2 class="sec">TEAM <small>かぞくチーム</small></h2>
    ${rows.map((r) => `<div class="mate" style="--kid:${r.k.color}">
      <div class="mate-ava">${r.k.em}</div>
      <div class="mate-main"><b>${r.d.name}</b><small>${r.d.grade}ねん ・ ${r.d.rank}${r.k.id === kidId ? ' ・ じぶん' : ''}</small>
        <div class="row"><span class="chip gold">⚽ ${r.d.goals}</span><span class="chip">📅 ${r.d.days}日</span>${r.sel.state === 'in' ? '<span class="chip red">🇯🇵 代表</span>' : (cfg().soft ? '' : '<span class="chip">🪑 ひかえ</span>')}</div>
        ${r.remote && S.remote[r.k.id].t ? `<small class="muted">${ago(S.remote[r.k.id].t)}の きろく</small>` : ''}</div></div>`).join('')}
    ${rows.filter((r) => !r.k.adult).every((r) => r.sel.state === 'in') ? '<div class="banner-red"><b>🇯🇵🇯🇵 ふたりそろって 日本代表!</b><small>せいかいごとの ボーナスポイントが ふえてるよ</small></div>' : ''}
    <div style="margin-top:12px"><b>チームの ゴール ごうけい ⚽ ${total}</b>
      <div class="bar" style="margin:6px 0"><i style="width:${pct}%"></i></div>
      <div class="muted">つぎの もくひょう ${next}ゴールまで あと ${next - total}!</div></div>
    ${waiting ? '<div class="muted">まだ あいての きろくが とどいてないよ(あいても アプリを ひらくと つながるよ)</div>' : ''}
  </section>`;
}

// ---- 画面 -----------------------------------------------------------------
let tab = 'home';
let toTop = false;
function render() {
  const k = kidId && kidOf();
  document.documentElement.style.setProperty('--kid', k ? k.color : '#2f7bff');
  applyCfg();
  document.body.dataset.view = view;
  const needLock = view === 'kid' && kidId && S.kidPins[kidId] && !unlocked;
  (needLock ? vLock : { setup: vSetup, kid: vKid, quiz: vQuiz, result: vResult, papa: vPapa, battle: () => { $app.innerHTML = battleView(); }, preview: vPreview, rest: vRest }[view])();
  if (toTop) {
    window.scrollTo(0, 0); toTop = false;
    document.body.classList.add('enter'); clearTimeout(render.t); render.t = setTimeout(() => document.body.classList.remove('enter'), 900);
  }
  animateCounts();
}

// このスマホは だれの? (さいしょの 1回だけ。パパが やる)
function vSetup() {
  $app.innerHTML = `<div class="hero"><div class="logo">⚽ HIBIYUI FC</div><h1>${S.shared ? 'だれが つかう?' : 'このスマホは だれの?'}</h1>
    <p class="sub">${S.shared ? 'じぶんの なまえを えらんで、じぶんの PINを いれてね。' : 'えらぶと、この スマホには その子の がめんだけが でるよ。<br>(かえるときは パパの PINが いるよ)'}</p></div>
    ${KIDS.map((k) => `<button class="kid-select" style="--kid:${k.color}" data-act="bind" data-id="${k.id}"><span class="ks-ava">${k.em}</span><span class="ks-name">${k.name}</span><span class="ks-sub">${k.grade}ねんせい</span></button>`).join('')}`;
}

function vLock() {
  const k = kidOf();
  $app.innerHTML = `<div class="hero"><div class="logo">⚽ HIBIYUI FC</div><div class="pc-ava" style="margin:8px 0">${k.em}</div><h1>${k.name}の PINを いれてね</h1>
    <p class="sub">${k.name}だけの 4けたの すうじだよ</p></div>
    <button class="btn gold" data-act="unlock">🔓 PINを いれる</button>
    <div class="center">${S.shared ? '<button class="link" data-act="lock">← べつの 子</button> ' : ''}<button class="link" data-act="papa">👨 パパの へや</button></div>`;
}

function topBar(k, p) {
  const r = rankOf(p.xp);
  return `<header class="topbar"><div class="tb-ava-wrap">${ringSvg('tb-ring', r.pct / 100)}<div class="tb-ava">${k.em}</div></div>
    <div class="tb-name"><b>${k.name}</b><small>${r.name}</small></div>
    <div class="tb-chips"><span class="chip gold">⚽ <b data-count="${p.goals}" data-key="goals">${p.goals}</b></span><span class="chip">XP <b data-count="${p.xp}" data-key="xp">${p.xp}</b></span></div>
    <button class="gear" data-act="mute" aria-label="おと">${quiet() ? '🔇' : '🔊'}</button>
    ${S.kidPins[k.id] || S.shared ? '<button class="gear" data-act="lock" aria-label="ロック">🔒</button>' : ''}<button class="gear" data-act="papa" aria-label="パパの へや">⚙</button></header>`;
}
function navBar() {
  const items = [['home', '🏠', 'ホーム'], ['train', '🎯', 'れんしゅう'], ['gacha', '🎰', 'ガチャ'], ['team', '🤝', 'チーム']];
  return `<nav class="nav">${items.map(([t, i, l]) => `<button class="${tab === t ? 'on' : ''}" data-act="tab" data-tab="${t}"><span>${i}</span><small>${l}</small></button>`).join('')}</nav>`;
}

function repChip(k) {
  const sel = dataFor(k).sel;
  if (cfg().soft && sel.state !== 'in') return ''; // 「できなかった」を みせない せってい
  return sel.state === 'in'
    ? `<div class="rep-chip in">🇯🇵 日本代表に えらばれてるよ${bothIn() ? '(ふたりそろって!)' : ''}</div>`
    : sel.state === 'close' ? '<div class="rep-chip">🇯🇵 あと 1日 れんしゅうで 日本代表!</div>'
      : '<div class="rep-chip out">🪑 いまは ひかえ ― かんたんに もどれるよ(チームを みてね)</div>';
}

function missionCard(k, p) {
  const done = p.today.sets > 0;
  const set = new Set(dataFor(k).recent);
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return { ds: dstr(d), w: '日月火水木金土'[d.getDay()], today: i === 6 }; });
  return `<section class="mission"><div class="ring-box">${ringSvg('ring', done ? 1 : 0)}<span class="ring-ic">${done ? '✅' : '⚽'}</span></div>
    <div class="ms-main"><b>きょうの ミッション</b><small>${cfg().plain ? (done ? 'きょうの もんだいは おわり' : 'もんだいを 1かい やろう') : (done ? 'キックオフ クリア! ナイス!' : 'キックオフを 1かい やろう')}</small>
      ${cfg().soft ? '' : `<div class="week">${days.map((x) => `<span class="wd ${set.has(x.ds) ? 'on' : ''} ${x.today ? 'today' : ''}"><i>${set.has(x.ds) ? '⚽' : ''}</i><small>${x.w}</small></span>`).join('')}</div>`}</div></section>`;
}

function medalShelf(k, p) {
  const have = (b) => (p.badges || []).includes(b.id) || b.cond(p, k);
  const n = BADGES.filter(have).length;
  return `<section class="panel"><h2 class="sec">MEDALS <small>メダル ${n}/${BADGES.length}</small></h2>
    <div class="medals">${BADGES.map((b) => `<div class="medal ${have(b) ? 'got' : ''}" title="${b.name}"><span>${have(b) ? b.icon : '🔒'}</span><small>${b.name}</small></div>`).join('')}</div></section>`;
}

// 「きょうの やること」リスト(みとおしが あると おちつく子の ため)
function scheduleCard(k, p) {
  const left = p.today.bonusTotal - p.today.bonusDone; const done = p.today.sets > 0;
  const items = [[done, `${cfg().setSize}もんの もんだい`]];
  if (p.today.bonusTotal > 0) items.push([left <= 0, 'ごほうび ステージ']);
  items.push([null, 'ごほうび(ガチャ・メダル)は すきな ときで OK']);
  const all = done && left <= 0;
  return `<section class="panel"><h2 class="sec">TODAY <small>きょうの やること</small></h2>
    <ol class="todo">${items.map(([d, t]) => `<li class="${d ? 'done' : ''}">${d === null ? '🎁' : d ? '✅' : '⬜'} ${t}</li>`).join('')}</ol>
    <div class="muted">${all ? 'ぜんぶ おわり! きょうは おしまい。また あした。' : 'ぜんぶ おわったら、きょうは おしまい。'}</div></section>`;
}

// じぶんで かえられる せってい(おと・うごき・もじ)
function selfCfgCard(k) {
  const c = cfg();
  const b = (key, label) => `<button class="tgl ${c[key] ? 'on' : ''}" data-act="cfgt" data-id="${k.id}" data-key="${key}">${c[key] ? '✅' : '⬜'} ${label}</button>`;
  return `<section class="panel"><h2 class="sec">MY SETTINGS <small>じぶんに あう ように</small></h2>
    <div class="muted">つかいやすい ように、いつでも かえて いいよ。</div>
    ${b('quiet', '🔇 おと・ふるえを けす')}${b('calm', '🐢 うごき・ひかりを へらす')}${b('big', '🔠 おおきい もじ')}</section>`;
}

function homeTab(k, p) {
  const cur = currentUnits(k.grade, new Date().getMonth() + 1, S.override[k.id]);
  const left = p.today.bonusTotal - p.today.bonusDone;
  const welcome = p.today.gap > 0 && p.today.sets === 0
    ? `おかえり、${k.name}! まってたよ。きょうは かくれステージが ひらいてるよ 🌟`
    : p.today.sets > 0 ? `${k.name}、きょうも ナイスプレー!` : `${k.name}、きょうも キックオフ!`;
  return `${playerCard(k, p)}
    <div class="welcome">${welcome}</div>
    ${loginCard(p)}
    <div class="tk-wrap" data-act="tab" data-tab="gacha">${ticketBar(p)}</div>
    ${cfg().schedule ? scheduleCard(k, p) : ''}
    ${missionCard(k, p)}
    ${repChip(k)}
    <button class="match-btn" data-act="start" data-mode="daily"><small>TODAY'S MATCH</small><b>${p.today.sets > 0 ? T(cfg()).again : T(cfg()).start}</b>
      <span>${p.today.sets > 0 ? '✅ きょうの しあい クリア ・ ' : `${cfg().setSize}もん ・ `}${cur.map((u) => u.name).join('、')}</span></button>
    ${left > 0 ? `<button class="event-btn" data-act="start" data-mode="bonus"><small>SPECIAL STAGE</small><b>🌟 かくれステージ</b><span>のこり ${left} ・ ポイント 2ばい ・ あせらなくて OK</span></button>` : ''}
    ${medalShelf(k, p)}
    ${selfCfgCard(k)}`;
}

function repCard(k, p) {
  const d = dataFor(k); const sel = d.sel; const need = needDays();
  const set = new Set(d.recent);
  const soft = cfg().soft;
  const dots = Array.from({ length: WINDOW }, (_, i) => { const day = new Date(); day.setDate(day.getDate() - (WINDOW - 1 - i)); return set.has(dstr(day)) ? '🟢' : (soft ? '' : '⚪'); }).filter(Boolean).join(' ');
  const left = p.today.bonusTotal - p.today.bonusDone;
  let msg;
  if (soft && sel.state !== 'in') msg = 'いつでも 日本代表に もどれるよ。ゆっくりで だいじょうぶ。';
  else if (sel.state === 'in') msg = `🇯🇵 <b>日本代表に えらばれてるよ!</b>${sel.called && sel.n < need ? '(追加招集)' : ''}<br><span class="muted">${bothIn() ? '🇯🇵🇯🇵 ふたりそろって 日本代表! ボーナスポイントが ふえてるよ' : 'もうひとりも えらばれると、ボーナスが もっと ふえるよ'}</span>`;
  else if (sel.state === 'close') msg = '<b>あと 1日!</b> れんしゅうすると 日本代表に えらばれるよ';
  else msg = `いまは 🪑 ひかえメンバー。だいじょうぶ、すぐ もどれるよ!<br><span class="muted">${left > 0 ? '🌟 かくれステージを 1つ クリアすると、すぐ 追加招集されるよ' : `あと ${need - sel.n}日 れんしゅうすると 日本代表に えらばれるよ`}</span>`;
  return `<section class="panel rep"><h2 class="sec">JAPAN <small>日本代表 せんしゅつ</small></h2>
    <div class="muted">この ${WINDOW}日で ${need}日 れんしゅうすると えらばれるよ</div>
    <div style="font-size:22px;margin:6px 0">${dots}</div>${msg}</section>`;
}

// PINが まだ きまっていない スマホ(リンクで ひらいた とき)は、さいしょに パパが PINを きめる
function vPinGate() {
  $app.innerHTML = `<div class="hero"><div class="logo">⚽ HIBIYUI FC</div><h1>パパの PINを きめよう</h1>
    <p class="sub">この スマホの「パパの へや」や、もちぬしの へんこうに つかう 4けたの すうじです。<br>パパが きめてね(子どもには ひみつ)</p></div>
    <button class="btn gold" data-act="setpin">🔒 PINを きめる</button>`;
}

function vKid() {
  if (!S.pin) return vPinGate();
  const k = kidOf(); const p = S.kids[k.id]; refreshDay(p);
  let body;
  if (tab === 'train') body = labCard(k, p) + kukuCard(k, p) + shapeCard(k, p) + timeMachineCard(k, p) + practiceCard(k, p);
  else if (tab === 'gacha') body = gachaTab();
  else if (tab === 'team') body = teamTab();
  else body = homeTab(k, p);
  $app.innerHTML = `${topBar(k, p)}<main>${body}</main>${navBar()}`;
}

// 九九マスター: だんごとに「できた」を ふやす
function kukuCard(k, p) {
  const done = KUKU_DAN.filter((id) => status(p, id) === 'ok').length;
  const b = (id, label) => `<button class="btn gray kk" data-act="start" data-mode="practice" data-unit="${id}">${ICON[status(p, id)]} ${label}</button>`;
  return `<section class="panel"><h2 class="sec">KUKU <small>九九マスター</small></h2>
    <div class="muted">できた だん ${done}/9 ${done === 9 ? '🎉 ぜんぶ マスター!' : '(ぜんぶ できると メダル!)'}</div>
    <div class="kukugrid">${KUKU_DAN.map((id, i) => b(id, `${i + 1}の だん`)).join('')}</div>
    <div class="row">${b('g2_kuku_all', '九九 ぜんぶ')}${b('g2_kuku_inv', '□を さがせ')}</div></section>`;
}
// かたちクイズ(都道府県・くに): 形から なまえを あてる
function shapeCard(k, p) {
  const e = k.grade >= 3 ? '' : '_e';
  const us = ['geo_pref', 'geo_world', 'flag_world'].map((id) => byId[id + e]).filter(Boolean);
  if (!us.length) return '';
  return `<section class="panel"><h2 class="sec">QUIZ <small>かたち・はた あてクイズ</small></h2>
    <div class="muted">かたちや はたを みて、どこか あてよう! ${e ? 'ゆうめいな ところから だすよ。' : 'ぜんぶで 47都道府県と せかいの くにが でるよ。'}</div>
    <div class="row">${us.map((u) => `<button class="btn gold" data-act="start" data-mode="practice" data-unit="${u.id}">${u.id.includes('flag') ? '🚩 くにの はた' : u.id.includes('pref') ? '🗾 にほんの かたち' : '🌏 せかいの かたち'}</button>`).join('')}</div></section>`;
}
function practiceCard(k, p) {
  const btn = (u, label) => `<button class="btn gray" data-act="start" data-mode="practice" data-unit="${u.id}">${ICON[status(p, u.id)]} ${label}</button>`;
  const mine = unitsOf(k.grade);
  const earlier = skillsUpTo(k.grade).filter((u) => u.grade < k.grade);
  return `<section class="panel"><h2 class="sec">TRAINING <small>すきな れんしゅう</small></h2>
    <div class="muted">れんしゅうでも 6わり いじょう せいかいで 🎟 チケットが もらえるよ(1日 ${PRACTICE_CAP}まいまで)</div>
    ${SUBJECTS.filter((sj) => mine.some((u) => u.subject === sj)).map((sj) => `<details ${sj === '算数' ? 'open' : ''}><summary><b>${SUBJECT_ICON[sj]} ${sj}</b></summary>
      ${mine.filter((u) => u.subject === sj).map((u) => btn(u, u.name)).join('')}</details>`).join('')}
    <details><summary><b>⏪ まえの がくねんの れんしゅう</b> <small class="muted">(ポイントは はんぶん ・ チケットは もらえるよ)</small></summary>
      ${earlier.map((u) => btn(u, `${u.grade}ねん ${SUBJECT_ICON[u.subject] || ''}${u.name}`)).join('')}
    </details></section>`;
}

function timeMachineCard(k, p) {
  const sk = skillsUpTo(k.grade);
  const todo = sk.filter((u) => status(p, u.id) === 'unknown' && u.grade < k.grade).length;
  const weak = sk.filter((u) => ['gap', 'shaky'].includes(status(p, u.id)));
  const due = sk.filter((u) => status(p, u.id) === 'sprout' && needs(p, u.id)).length;
  const grades = [...new Set(sk.map((u) => u.grade))];
  return `<section class="panel tm"><h2 class="sec">TIME MACHINE <small>タイムマシン チェック</small></h2>
    <div class="muted">むかしの がくねんまで もどって、「ぬけてる ところ」を さがすよ。みつかったら ラッキー! そこを なおせば ぐんと つよくなる。</div>
    ${grades.map((g) => `<div style="margin:8px 0"><b>${g}ねん</b> ${SUBJECTS.map((sj) => { const us = sk.filter((u) => u.grade === g && u.subject === sj); return us.length ? `<span style="white-space:nowrap">${SUBJECT_ICON[sj]}${us.map((u) => `<span title="${u.name}">${ICON[status(p, u.id)]}</span>`).join('')}</span>` : ''; }).join(' ')}</div>`).join('')}
    <div class="muted">✅ほんとに できた 🌱できたかも(べつの日に もういちど) 🔸あやしい 🔻ぬけてる ⬜まだ</div>
    ${todo + weak.length + due > 0 ? '<button class="match-btn alt" data-act="start" data-mode="back"><small>TIME MACHINE</small><b>⏪ タイムマシンに のる</b><span>5もん ・ むかしの ぬけを さがす</span></button>' : '<b>ぜんぶ チェックずみ! すごい!</b>'}
  </section>`;
}

function vQuiz() {
  const k = kidOf(); const it = Q.items[Q.i]; const q = it.q;
  const tx = T(cfg());
  const remain = Q.i === Q.items.length - 1 ? 'これが さいごの 1もん' : `あと ${Q.items.length - Q.i - 1}もん`;
  const pct = Math.round((Q.i / Q.items.length) * 82);
  const a = Q.answered;
  const locked = !a && Date.now() < Q.lockUntil;
  $app.innerHTML = `
    <div class="quiz-top"><button class="link" data-act="quit">🛋️ やすむ</button>
      <div class="scoreboard"><span class="sb-l">⚽ <b>${Q.good}</b></span><span class="sb-m">${Q.i + 1}<small>/${Q.items.length}</small></span>
        <span class="sb-r">${tx.mode[Q.mode === 'bonus' ? 'bonus' : Q.mode === 'back' ? 'back' : it.retry ? 'retry' : (it.probe || Q.mode === 'hyp') ? 'probe' : 'normal']}</span></div><span class="clock"></span></div>
    <div class="remain">${remain}</div>
    <div class="pitch"><span class="ball" style="left:calc(${pct}% + 6px);transform:rotate(${Q.i * 150}deg)">⚽</span><span class="goal">🥅</span></div>
    <div class="dots">${Q.items.map((x, i) => `<i class="${x.res || ''} ${i === Q.i ? 'cur' : ''}"></i>`).join('')}</div>
    <main><section class="panel qpanel">
      <div class="q ${qplain(q.text).length > 40 ? 'long' : ''}">${q.text}</div>
      <div style="text-align:center"><button class="btn small gray" data-act="speak">🔊 よみあげ</button></div>
      ${locked ? '<div id="wait" class="muted" style="text-align:center">👀 もんだいを よく よんでね…</div>' : ''}
      <div class="choices">
        ${q.choices.map((c, idx) => { const out = !a && (it.hinted || []).includes(idx); return `<button class="choice ${a ? (c.ok ? 'ok' : a.idx === idx ? 'ng' : '') : ''} ${out ? 'out' : ''}" data-act="ans" data-idx="${idx}" ${a || locked || out ? 'disabled' : ''}>${c.label}</button>`; }).join('')}
      </div>
      ${a ? feedback(q, a) : `<div class="row" style="margin-top:14px">
        ${cfg().hint && q.choices.length - (it.hinted || []).length > 2 ? '<button class="btn small gold" data-act="hint">💡 ヒント(ひとつ けす)</button>' : ''}
        <button class="btn small gray" data-act="idk">🤔 わからない</button>
        <button class="btn small gray" data-act="ask">👨 パパに きく</button></div>`}
    </section></main>`;
  const i0 = Q.i;
  if (cfg().autoRead && !a && !it.spoken) { it.spoken = true; setTimeout(() => { if (view === 'quiz' && Q && Q.i === i0) speak(q.text); }, 350); }
  if (locked) {
    setTimeout(() => {
      if (view !== 'quiz' || !Q || Q.i !== i0 || Q.answered) return;
      document.querySelectorAll('.choice').forEach((b) => { b.disabled = false; });
      const w = document.getElementById('wait'); if (w) w.remove();
    }, Q.lockUntil - Date.now());
  }
  if (a && !a.ok) {
    setTimeout(() => {
      const b = document.getElementById('nextbtn');
      if (!b || !Q || Q.i !== i0) return;
      b.disabled = false; b.textContent = Q.i === Q.items.length - 1 ? '🏁 けっかを みる' : 'つぎへ ▶';
    }, Math.max(1, waitWrongMs(cfg())));
  }
}

// ---- つまずきの「かせつ」(仮説): 立てる → たしかめる → けっろん ------------------------------------
const hypLabel = (h) => (h.kind === 'item' ? h.label : (TAGS[h.tag] ? TAGS[h.tag][0] : h.tag));
const weakWord = () => (cfg().soft ? 'のびしろ' : 'よわい');
function hypLine(e) {
  const l = hypLabel(e.h);
  if (e.type === 'new') return `🔎 かせつ: 「${l}」が くりかえし おきるのかも? つぎの もんだいで たしかめるよ。`;
  if (e.type === 'reopen') return `🔎 「${l}」が また でたよ。もういちど たしかめよう。`;
  if (e.type === 'confirmed') return cfg().soft ? `🌱 「${l}」は、れんしゅうすると のびそう。いっしょに やってみよう。` : `⚠️ たしかめた けっか、「${l}」が つづいているよ。ここを れんしゅうしよう。`;
  if (e.type === 'cleared') return `🍀 「${l}」は たまたま だったね。だいじょうぶ!`;
  if (e.type === 'resolved') return `🌟 「${l}」を のりこえたよ! すごい!(+30ポイント)`;
  return '';
}
const hypLines = (evs) => (evs && evs.length ? `<div class="hypnote">${evs.map((e) => `<p>${hypLine(e)}</p>`).join('')}</div>` : '');

// つまずき けんきゅうじょ(ひとつずつ「たしかめる」)
function labCard(k, p) {
  const list = activeList(p); const c = counts(p);
  if (!list.length && !c.resolved && !c.cleared) {
    return `<section class="panel"><h2 class="sec">LAB <small>つまずき けんきゅうじょ</small></h2>
      <div class="muted">まちがえると、ここに「かせつ」が でるよ。まちがいは ${weakWord()}ところを みつける ヒント。たしかめて、のりこえよう!</div></section>`;
  }
  const status = (h) => (h.status === 'confirmed'
    ? `${cfg().soft ? '🌱 れんしゅう中' : `⚠️ ここが ${weakWord()} みたい`} ・ のりこえるまで: れんぞく せいかい ${Math.min(h.streak, THRESH.resolveStreak)}/${THRESH.resolveStreak}、${Math.min(h.okDays.length, THRESH.resolveDays)}/${THRESH.resolveDays}日`
    : `❓ たしかめ中 ・ まちがい ${h.sup}かい / せいかい ${h.ref}かい`);
  return `<section class="panel"><h2 class="sec">LAB <small>つまずき けんきゅうじょ</small></h2>
    <div class="muted">まちがえ方から「かせつ」を たてて、もういちど たしかめるよ。</div>
    <div class="row"><span class="chip gold">🌟 のりこえた ${c.resolved}</span><span class="chip">🍀 たまたま ${c.cleared}</span></div>
    ${list.slice(0, 6).map((h) => `<div class="hyp ${h.status}"><div class="hyp-main"><b>${h.kind === 'item' ? `「${hypLabel(h)}」` : hypLabel(h)}</b><small>${status(h)}</small></div>
      <button class="btn small gold" data-act="start" data-mode="hyp" data-unit="${h.key}">🔬 たしかめる</button></div>`).join('')}
    ${list.length > 6 ? `<div class="muted">ほか ${list.length - 6}こ</div>` : ''}</section>`;
}
function hypResultPanel(R) {
  if (!R.hyp || !R.hyp.length) return '';
  const icon = { new: '🔎', reopen: '🔎', confirmed: cfg().soft ? '🌱' : '⚠️', cleared: '🍀', resolved: '🌟' };
  const text = { new: 'かせつを たてたよ', reopen: 'もういちど たしかめよう', confirmed: cfg().soft ? 'れんしゅうすると のびそう' : `ほんとうに ${weakWord()} みたい`, cleared: 'たまたま だったね', resolved: 'のりこえた!' };
  return `<section class="panel"><h2 class="sec">LAB <small>かせつの けっか</small></h2>
    ${R.hyp.map((e) => `<p>${icon[e.type]} <b>${e.label}</b> ― ${text[e.type]}</p>`).join('')}
    <div class="muted">「れんしゅう」→「つまずき けんきゅうじょ」で、つづきを たしかめられるよ。</div></section>`;
}
// パパ向け: かせつの ほうこく
function hypReport() {
  return `<div class="card"><h2>🔬 つまずきの かせつ(パパ向け)</h2>
    <p class="muted">まちがえ方から「たぶん ここが ${'弱い'}」と 推定した 仮説です(仮です)。同じ まちがえ方の「罠」が ある 問題で 繰り返し 確かめ、3回の根拠で「確定」、3回連続で罠を避ければ「たまたま」、確定後に 3回連続正解(2日以上)で「のりこえた」とします。</p>
    ${KIDS.map((k) => {
    const p = S.kids[k.id]; const list = activeList(p); const c = counts(p);
    return `<div class="cfgbox"><b>${k.name}</b> <span class="muted">のりこえた ${c.resolved} ・ たまたま ${c.cleared} ・ たしかめ中 ${c.testing} ・ 確定 ${c.confirmed}</span>
      ${list.length ? list.map((h) => `<p><b>${h.status === 'confirmed' ? '⚠️ 確定' : '❓ 確かめ中'}</b> 「${hypLabel(h)}」 <span class="muted">(${(byId[h.unit] || {}).name || h.unit} ・ 根拠 ${h.sup} / 反する 証拠 ${h.ref})</span>${h.kind === 'tag' && TAGS[h.tag] ? `<br><span class="muted">声かけ: ${TAGS[h.tag][1]}</span>` : ''}</p>`).join('') : '<p class="muted">いま 確かめている 仮説は ありません</p>'}</div>`;
  }).join('')}</div>`;
}

function feedback(q, a) {
  const tx = T(cfg()); const wait = waitWrongMs(cfg());
  const last = Q.i === Q.items.length - 1;
  const next = `<button class="btn gold" data-act="next">${last ? '🏁 けっかを みる' : 'つぎへ ▶'}</button>`;
  if (a.ok) {
    return `<div class="fb good"><b>${tx.ok} ${Q.combo >= 3 ? tx.combo(Q.combo) : ''}</b>
      <p>+${a.xp} ポイント${a.rep ? `(🇯🇵 代表ボーナス +${a.rep} こみ)` : ''}</p><p class="muted">${q.why}</p>${hypLines(a.hyp)}</div>${next}`;
  }
  const [name, msg] = TAGS[a.tag] || TAGS.unknown;
  const picked = a.idx != null ? q.choices[a.idx] : null;
  return `<div class="fb"><b>${tx.ng}</b>
    <p><span class="tag">げんいん</span><b>${name}</b></p>
    ${picked && picked.note ? `<p>👉 えらんだ「${picked.label}」は… ${picked.note}</p>` : `<p>${msg}</p>`}
    <p><b>せいかいは:</b> ${q.choices.find((c) => c.ok).label}</p><p class="muted">${q.why}</p>
    <p>${Q.items[Q.i].retry ? tx.retryNow : tx.retryNote}</p>
    <p class="muted">ちょうせん ポイント +${a.effort || 0}(まちがえても、ポイントは かならず つくよ)</p>${hypLines(a.hyp)}</div>
    <div class="row"><button class="btn small gray" data-act="ask">👨 パパに きく</button></div>
    <button class="btn gold" id="nextbtn" data-act="next" ${wait ? 'disabled' : ''}>${wait ? '📖 せつめいを よんでね…' : (last ? '🏁 けっかを みる' : 'つぎへ ▶')}</button>`;
}

const TK_NAME = { bronze: '🥉ブロンズ', silver: '🥈シルバー', gold: '🥇ゴールド', platinum: '💎プラチナ' };
const STAT_JA = { SHO: 'シュート', PAS: 'パス', SPD: 'スピード', DEF: 'まもり', STA: 'スタミナ' };
function rewardPanel(R) {
  const tk = Object.entries(R.tickets || {}).filter(([, v]) => v);
  const pts = Object.entries(R.pts || {}).filter(([, v]) => v);
  if (!tk.length && !pts.length && !R.capped) return '';
  return `<section class="panel gold"><h2 class="sec">REWARD <small>ごほうび</small></h2>
    ${tk.length ? `<div class="reward-row">${tk.map(([k, v]) => `<span class="chip gold">${TK_NAME[k]} ×${v}</span>`).join(' ')} <small class="muted">ガチャで つかえるよ</small></div>` : `<div class="muted">${R.capped ? 'きょうは もう たくさん チケットを もらったよ。また あした!' : '6わり いじょう せいかいで チケットが もらえるよ(つぎは がんばろう!)'}</div>`}
    ${pts.length ? `<div class="reward-row">${pts.map(([k, v]) => `<span class="chip">${STAT_JA[k]} +${v}pt</span>`).join(' ')} <small class="muted">「チーム → つよく」で つかえるよ</small></div>` : ''}</section>`;
}

function vResult() {
  const k = kidOf(); const p = S.kids[k.id]; const R = Q.result;
  const tx = T(cfg());
  const stars = Math.max(1, R.good / R.total >= 1 ? 3 : R.good / R.total >= 0.6 ? 2 : R.good / R.total >= 0.3 ? 1 : 0); // さいごまで やったら 星は 1つ いじょう
  const call = R.callup ? '<section class="panel rep"><div class="big">🇯🇵</div><h2 class="center">日本代表に えらばれたよ!</h2></section>' : '';
  const ranked = R.rankUp ? `<section class="panel gold"><div class="big">🎉</div><h2 class="center">ランクアップ!<br>${R.rankName}</h2></section>` : '';
  const weak = R.tags.length ? `<section class="panel"><h2 class="sec">NEXT <small>つぎは ここを ねらおう</small></h2>${R.tags.map((t) => `<p><span class="tag">${TAGS[t][0]}</span><br><span class="muted">${TAGS[t][1]}</span></p>`).join('')}</section>` : '<section class="panel"><b>ノーミス! パーフェクトゲーム ✨</b></section>';
  const lower = skillsUpTo(k.grade).filter((u) => u.grade < k.grade && ['gap', 'shaky'].includes(status(p, u.id))).slice(0, 3);
  const found = lower.length ? `<section class="panel tm"><h2 class="sec">TIME MACHINE <small>むかしの ぬけてた ところ みつけた!</small></h2>
    <p class="muted">だれでも あるよ。ここを なおせば つぎの たんげんも ぐんと かんたんになるよ。</p>
    ${lower.map((u) => `<button class="btn gray" data-act="start" data-mode="practice" data-unit="${u.id}">${ICON[status(p, u.id)]} ${u.grade}ねん:${u.name} を れんしゅう</button>`).join('')}</section>` : '';
  $app.innerHTML = `<div class="hero small"><h1>${R.good >= 4 ? tx.resultHigh : tx.resultLow}</h1></div>
    <main><section class="panel score"><div class="stars">${[1, 2, 3].map((n) => `<span class="star ${n <= stars ? 'on' : ''}" style="animation-delay:${0.3 + n * 0.25}s">★</span>`).join('')}</div>
      <div class="big">${cfg().plain ? '✅' : '⚽'} × <b data-count="${R.good}" data-key="score">${R.good}</b></div>
      <p class="center">${tx.score(R)}</p></section>
    ${rewardPanel(R)}
    ${hypResultPanel(R)}
    ${R.newBadges.map((b) => `<section class="panel gold medal-new"><div class="big">${b.icon}</div><h2 class="center">NEW MEDAL!<br>${b.name}</h2></section>`).join('')}
    ${call}${ranked}${found}${weak}
    ${cfg().breakAfter ? '<section class="panel"><h2 class="sec">REST <small>きゅうけい</small></h2><div class="muted">がんばったね。1ぷん やすもう(みずを のむ・のびを する)。つづけても、おわっても いいよ。</div><button class="btn gray" data-act="rest">🍃 1ぷん やすむ</button></section>' : ''}
    <p class="muted center">これで ひとつ おわり。ホームに もどれるよ。</p>
    <button class="btn gold" data-act="kid">ホームに もどる</button></main>`;
}

const CFG_LABEL = {
  calm: '🐢 うごき・ひかり・紙ふぶきを へらす', quiet: '🔇 おと・ふるえを けす', plain: '💬 たとえを つかわない(そのままの ことば)',
  preview: '📋 はじめる まえに「やること」を みせる(じゅんばんも おなじ)', soft: '🌱 「できなかった」を みせない(ひかえ・からの まるを かくす)',
  schedule: '🗓️ 「きょうの やること」リストを ホームに だす', breakAfter: '🍃 1セットごとに きゅうけいを すすめる', big: '🔠 おおきい もじ',
  forgive: '🏆 たいかいで まけても、おなじ しあいから やりなおせる',
  hint: '💡 「ヒント」ボタンを だす(まちがいの せんたくしを 1つずつ けす)', autoRead: '🔊 もんだいが でたら じどうで よみあげる',
};
const LOCK_LABEL = { normal: 'ふつう(1.5〜3.5びょう)', short: 'みじかい(0.6〜1.5びょう)', off: 'なし' };
const WAIT_LABEL = { normal: 'ふつう(4びょう)', short: 'みじかい(2びょう)', off: 'なし' };
function cfgCard() {
  const sel = (id, key, opts, label) => `<label class="cfgrow"><span>${label}</span><select data-act="cfgs" data-id="${id}" data-key="${key}">${opts.map(([v, t]) => `<option value="${v}" ${String(cfgOf(S, id)[key]) === String(v) ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`;
  return `<div class="card"><h2>🧩 やさしい せってい</h2>
    <p class="muted">お子さんに あわせて えらべる「はいりょ」です。<b>診断や治療ではありません。</b>どれが あうかは 子どもごとに ちがうので、1つずつ ためして、あうものを のこしてください(学校・かかりつけ・支援機関の アドバイスが あれば、そちらを ゆうせん)。</p>
    ${KIDS.map((k) => {
    const c = cfgOf(S, k.id);
    return `<div class="cfgbox"><b>${k.name}</b>
      <div class="row">${Object.entries(PRESETS).map(([key, pr]) => `<button class="btn small gray" data-act="cfgp" data-id="${k.id}" data-p="${key}">${pr.name}</button>`).join('')}</div>
      ${sel(k.id, 'setSize', OPTIONS.setSize.map((v) => [v, `${v}もん`]), '1セットの もんだい数')}
      ${sel(k.id, 'choices', OPTIONS.choices.map((v) => [v, v === 'all' ? 'ぜんぶ' : `${v}つに へらす`]), 'せんたくしの かず')}
      ${sel(k.id, 'lock', OPTIONS.lock.map((v) => [v, LOCK_LABEL[v]]), '「よく よんでね」の まち')}
      ${sel(k.id, 'waitWrong', OPTIONS.waitWrong.map((v) => [v, WAIT_LABEL[v]]), 'まちがえた あとの まち')}
      ${sel(k.id, 'gachaMax', OPTIONS.gachaMax.map((v) => [v, v === 0 ? 'せいげんなし' : `${v}かいまで`]), 'ガチャ 1日の かいすう')}
      ${BOOLS.map((key) => `<button class="tgl ${c[key] ? 'on' : ''}" data-act="cfgt" data-id="${k.id}" data-key="${key}">${c[key] ? '✅' : '⬜'} ${CFG_LABEL[key]}</button>`).join('')}
    </div>`;
  }).join('')}
    <p class="muted">※ ガチャは「いつ あたるか わからない」ので、しょうどう(おさえにくい きもち)が つよい子は ひきすぎる ことが あります。1日の かいすうの じょうげんを おすすめします。</p></div>`;
}

function vPapa() {
  const tagRows = KIDS.map((k) => {
    const p = S.kids[k.id];
    const top = Object.entries(p.tags).sort((a, b) => b[1] - a[1]).slice(0, 3);
    return `<div class="card"><h2>${k.name}(${k.grade}ねん)</h2>
      <p class="muted">ゴール ${p.goals} ・ ぜんぶで ${p.days.length}日 ・ さいごに やった日:${p.lastDate || 'まだ'}</p>
      ${(() => { const r = p.rt || { ok: 0, ng: 0 }; const n = r.ok + r.ng; if (!n) return ''; const pct = Math.round((r.ok / n) * 100); return `<p><b>🔁 まちがえたあとの 数字ちがい再挑戦:${pct}%</b>(${r.ok}/${n})${n >= 4 && pct < 50 ? '<br><span style="color:#c0392b">⚠ 解説を読んでも わかっていないかも。いっしょに 見てあげてください。</span>' : ''}</p>`; })()}
      <b>つまずきが おおいところ</b>
      ${top.length ? top.map(([t, n]) => `<p><span class="tag">${n}かい</span><b>${TAGS[t][0]}</b><br><span class="muted">${TAGS[t][1]}</span></p>`).join('') : '<p class="muted">まだ データが ないよ</p>'}
      <b>がくしゅうマップ(1ねん〜)</b>
      ${skillsUpTo(k.grade).map((u) => `<div class="muted">${ICON[status(p, u.id)]} ${u.grade}ねん:${u.name}${(() => { const np = u.pre.filter((x) => status(p, x) !== 'ok'); return np.length && ['gap', 'shaky'].includes(status(p, u.id)) ? `(→ まず ${np.map((x) => byId[x].name).join('・')})` : ''; })()}</div>`).join('')}
      <b>パパに きく</b>
      ${p.ask.length ? p.ask.map((a, i) => `<p style="white-space:pre-wrap;border-left:4px solid #ffcc00;padding-left:8px">${a.date} ${a.text}<br><button class="btn small gray" data-act="askdone" data-id="${k.id}" data-i="${i}">✅ おしえたよ</button></p>`).join('') : '<p class="muted">しつもんは ないよ</p>'}
      <b>学校の いまの たんげん</b><br>
      <select data-act="override" data-id="${k.id}">
        <option value="">じどう(日付から きめる)</option>
        ${unitsOf(k.grade).filter((u) => u.subject !== '国語').map((u) => `<option value="${u.id}" ${S.override[k.id] === u.id ? 'selected' : ''}>${u.name}</option>`).join('')}
      </select></div>`;
  }).join('');
  const sc = sync.getCfg();
  const repAdmin = `<div class="card"><h2>🇯🇵 日本代表の きまり</h2>
    <p class="muted">この ${WINDOW}日で れんしゅうした日が 下の日数いじょうなら 選出。かくれステージを クリアすると 追加招集(3日間)。外れても「ひかえメンバー」で、ポイントや記録は へりません。</p>
    <select data-act="need">${[2, 3, 4, 5].map((n) => `<option value="${n}" ${needDays() === n ? 'selected' : ''}>${WINDOW}日で ${n}日</option>`).join('')}</select>
    ${KIDS.map((k) => { const d = dataFor(k); return `<p>${k.name}:${d.sel.state === 'in' ? '🇯🇵 選出中' : '🪑 ひかえ'}(この${WINDOW}日で ${d.sel.n}日${d.sel.called ? '・追加招集' : ''})</p>`; }).join('')}</div>`;
  const syncCard = `<div class="card"><h2>🔗 きょうだいと つなぐ</h2>
    <p class="muted">${sync.enabled() ? '✅ つながっています(ランク・ゴール数・日数だけ きょうゆう)' : '⚠ まだ つながっていません。いまは この スマホの きろくだけ みえます。'}</p>
    <p class="muted">Firebase の Realtime Database の URL と、家族だけの ひみつの コードを いれます。</p>
    <details><summary><b>📖 はじめての せってい(パパが 1かいだけ)</b></summary><ol class="muted" style="padding-left:20px;line-height:1.7">
      <li>パソコンで <b>console.firebase.google.com</b> を ひらき、Google アカウントで ログイン →「プロジェクトを つくる」(なまえは なんでも OK ・ アナリティクスは オフ)</li>
      <li>左の「構築」→「Realtime Database」→「データベースを作成」→ ロケーション「シンガポール」→「テストモード」で はじめる</li>
      <li>「ルール」タブを、README の「きょうだい共有」の ルールに おきかえて「公開」</li>
      <li>「データ」タブの いちばん うえの URL(https://〜firebasedatabase.app)を コピーして、下の 1つめの らんに はりつける</li>
      <li>「🎲 コードを つくる」→「💾 ほぞん」→「🔎 つながりを チェック」で「つながったよ」が でれば OK</li>
      <li>下の「📋 〜用リンクを コピー」を、LINE などで ひびと・ゆいと・パパ それぞれの スマホに おくって ひらく(スマホごとに 1かいだけ)</li></ol></details>
    <input id="syncdb" placeholder="https://xxxx-default-rtdb.firebaseio.com" value="${sc.db || ''}" style="width:100%;font:inherit;padding:8px;margin:4px 0">
    <input id="synccode" placeholder="かぞくコード(10もじいじょう)" value="${sc.fc || ''}" style="width:100%;font:inherit;padding:8px;margin:4px 0">
    <button class="btn small gray" data-act="synccode">🎲 コードを つくる</button>
    <button class="btn small" data-act="syncsave">💾 ほぞん</button>
    <button class="btn small gray" data-act="synctest">🔎 つながりを チェック</button>
    <p class="muted">下の リンクを それぞれの スマホで ひらくと、その子の スマホに なって、おなじ せっていが はいります。</p>
    ${KIDS.map((k) => `<button class="btn small gold" data-act="synccopy" data-id="${k.id}">📋 ${k.name}用リンクを コピー</button>`).join('')}</div>`;
  const pinCard = `<div class="card"><h2>🔐 PIN</h2>
    <p class="muted">子どもの PINは、その子の がめんを ひらくときの かぎです(パパの PINで かんりします)。きめると アプリを ひらくたびに PINを きかれます。</p>
    ${KIDS.map((k) => `<div class="row"><b>${k.name}</b> <span class="chip ${S.kidPins[k.id] ? 'gold' : ''}">${S.kidPins[k.id] ? '設定ずみ' : 'なし'}</span>
      <button class="btn small gray" data-act="setkidpin" data-id="${k.id}">${S.kidPins[k.id] ? 'かえる' : 'きめる'}</button>
      ${S.kidPins[k.id] ? `<button class="btn small gray" data-act="clearkidpin" data-id="${k.id}">けす</button>` : ''}</div>`).join('')}
    <div class="row" style="margin-top:8px"><button class="btn small gray" data-act="changepin">🔑 パパの PINを かえる</button>
      <button class="btn small ${S.shared ? 'gold' : 'gray'}" data-act="toggleshared">${S.shared ? '✅ みんなで つかう モード(おす とやめる)' : 'みんなで 1台を つかう モードに する'}</button></div>
    ${S.shared && KIDS.some((k) => !S.kidPins[k.id]) ? '<p class="muted">⚠ みんなで つかう ときは、ぜんいん PINを きめてね(PINが ない子は だれでも ひらけます)。</p>' : ''}</div>`;
  const ownerCard = `<div class="card"><h2>📱 この スマホの もちぬし</h2>
    <p>いまは「<b>${S.bound ? KIDS.find((k) => k.id === S.bound).name : 'きまっていません'}</b>」の スマホです。ほかの子の もんだいは ひらけません。</p>
    ${KIDS.filter((k) => k.id !== S.bound).map((k) => `<button class="btn small gray" data-act="rebind" data-id="${k.id}">${k.name}の スマホに かえる</button>`).join('')}</div>`;
  $app.innerHTML = `<div class="quiz-top"><button class="link" data-act="home">← もどる</button><span class="mode">👨 パパの へや</span><span></span></div><main>${pinCard}${cfgCard()}${hypReport()}${ownerCard}${repAdmin}${syncCard}${tagRows}
    <p class="muted">学校の すすみ具合が ちがう ときは、「いまの たんげん」を えらんでね。</p></main>`;
}

// ---- パパのPIN(持ち主の変更・パパの へやに 入るとき) ------------------------------------
const pinHash = (t) => { let h = 5381; for (const c of String(t)) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0; return h.toString(36); };
function askPin(msg) {
  if (!S.pin) {
    const p1 = prompt('パパの PINを きめてください(4けたの すうじ)。子どもには ひみつにしてね');
    if (!/^\d{4}$/.test(p1 || '')) { toast('4けたの すうじで いれてね'); return false; }
    S.pin = pinHash(p1); save(); return true;
  }
  const p = prompt(msg || 'パパの PINを いれてね');
  if (p === null) return false;
  if (pinHash(p) !== S.pin) { toast('PINが ちがうよ'); return false; }
  return true;
}

// ---- 動作 -----------------------------------------------------------------
// 問題が出てから、よく読む時間(はんしゃで おさせない。せっていで みじかく・なしに できる)
const qplain = (t) => t.replace(/<svg[\s\S]*?<\/svg>/g, '');
const lockMs = (q) => lockMsFor(qplain(q.text).length, cfg());
function startQuiz(mode, unitId) {
  const k = kidOf();
  setSeen(S.kids[k.id].seen || []);
  Q = { mode, items: buildSet(k, mode, unitId), i: 0, good: 0, xp: 0, combo: 0, hat: false, answered: null, retries: 0, lockUntil: 0, pts: {}, missTags: {}, startXp: S.kids[k.id].xp };
  if (cfg().preview) { view = 'preview'; toTop = true; render(); return; } // はじめる まえに「やること」を みせる
  beginQuiz();
}
function beginQuiz() {
  Q.lockUntil = Date.now() + lockMs(Q.items[0].q);
  view = 'quiz'; toTop = true; render();
}
function vPreview() {
  const n = Q.items.length; const plan = planPreview(Q.items);
  $app.innerHTML = `<div class="quiz-top"><button class="link" data-act="previewback">← もどる</button><span class="mode">これから やること</span><span></span></div>
    <main><section class="panel"><h2 class="sec">PLAN <small>じゅんばん</small></h2>
      <ol class="steps">${plan.map((x) => `<li><b>${x.label}</b><span>${x.n}もん</span></li>`).join('')}</ol>
      <div class="muted">ぜんぶで ${n}もん。だいたい ${estimateMinutes(n)}ふん。じかんの せいげんは ないよ。<br>
      まちがえたら、おなじ ところの もんだいが 1もん ふえる ことが あるよ(1セットで さいだい 3もん)。<br>
      おわったら けっかが でて、ホームに もどれるよ。とちゅうで やすんでも だいじょうぶ(ポイントは のこるよ)。</div>
      <button class="btn gold" data-act="begin">はじめる</button></section></main>`;
}

// きゅうけい(1ぷん)。かすかに ふくらむ まるを みながら、ゆっくり いきを する
let restUntil = 0; let restTimer = null;
function startRest() { restUntil = Date.now() + 60000; view = 'rest'; toTop = true; render(); tickRest(); }
function tickRest() {
  clearTimeout(restTimer);
  if (view !== 'rest') return;
  const left = Math.max(0, Math.ceil((restUntil - Date.now()) / 1000));
  const el = document.getElementById('restleft');
  if (left <= 0) { render(); toast('きゅうけい おわり。つづけても、おわっても いいよ'); return; }
  if (el) el.textContent = `${left} びょう`;
  restTimer = setTimeout(tickRest, 1000);
}
function vRest() {
  const left = Math.max(0, Math.ceil((restUntil - Date.now()) / 1000));
  $app.innerHTML = `<div class="hero"><h1>きゅうけい</h1><p class="sub">みずを のんだり、のびを したり しよう。</p></div>
    <main><section class="panel rest"><div class="breath"></div>
      <div class="big" id="restleft">${left > 0 ? `${left} びょう` : 'おしまい'}</div>
      <div class="muted center">${left > 0 ? 'ゆっくり いきを すって、はいて。' : 'もう いいよ。つづけても、おわっても だいじょうぶ。'}</div>
      <button class="btn gold" data-act="restend">${left > 0 ? 'もう もどる' : 'ホームに もどる'}</button></section></main>`;
}

function answer(idx, unknown) {
  const k = kidOf(); const p = S.kids[k.id]; const it = Q.items[Q.i]; const q = it.q;
  if (Q.answered) return;
  if (!unknown && Date.now() < Q.lockUntil) return;
  const c = unknown ? null : q.choices[idx];
  const ok = !!(c && c.ok);
  const tag = ok ? null : unknown ? 'unknown' : c.tag;
  const u = (p.units[it.unit.id] = p.units[it.unit.id] || { ok: 0, ng: 0, h: [] });
  u.h = (u.h || []).concat(ok ? 1 : 0).slice(-6);
  if (q.id) { p.seen = [...(p.seen || []).filter((x) => x !== q.id), q.id].slice(-300); setSeen(p.seen); }
  if (ok) { u.d = u.d || []; if (!u.d.includes(todayStr())) u.d.push(todayStr()); u.d = u.d.slice(-5); }
  if (it.retry) { p.rt = p.rt || { ok: 0, ng: 0 }; p.rt[ok ? 'ok' : 'ng']++; }
  // まちがえ方から「かせつ」を たてる / たしかめる(罠を えらべば こんきょ、せいかいは はんする しょうこ)
  const evs = observe(p, { unitId: it.unit.id, q, choice: c, ok, today: todayStr(), immediate: !!it.retry });
  if (it.hkey) noteProbe(p, it.hkey, todayStr());
  Q.hyp = (Q.hyp || []).concat(evs);
  for (const e of evs) if (e.type === 'resolved') { p.hypResolved = (p.hypResolved || 0) + 1; Q.xp += 30; } // のりこえた おいわい
  if (ok) {
    u.ok++; Q.good++; Q.combo++;
    let xp = 10 * (Q.mode === 'bonus' ? 2 : 1);
    if (Q.combo === 3) { xp += 10; Q.hat = true; }
    const rep = repBonus(k); xp += rep;
    if (it.unit.grade < k.grade) xp = Math.max(2, Math.round(xp / 2)); // まえの がくねんは ポイントが はんぶん
    Q.xp += xp; p.goals++; it.res = 'ok';
    const st = SUBJECT_STAT[it.unit.subject]; if (st) { addPoints(p, it.unit.subject, 2); Q.pts[st] = (Q.pts[st] || 0) + 2; }
    Q.answered = { ok, idx, xp, rep, hyp: evs };
    beep('ok'); vibrate(25); confetti(lastTap.x, lastTap.y, Q.combo >= 3 ? 70 : 26, Q.combo >= 3 ? 1.3 : 0.8); floaty(`+${xp}`, lastTap.x, lastTap.y - 24);
  } else {
    u.ng++; Q.combo = 0;
    p.tags[tag] = (p.tags[tag] || 0) + 1; Q.missTags[tag] = (Q.missTags[tag] || 0) + 1;
    if (Q.retries < 3 && !it.retry) {
      Q.retries++;
      // やりなおしは、おなじ 罠が 入った 問題(かせつの たしかめ)。数字は かわる
      const spec = tag && tag !== 'unknown' && tag !== 'know_mixup' ? { tag } : null;
      let nq; for (let t = 0; t < 8; t++) { nq = spec ? makeProbe(it.unit, spec) : makeQuestion(it.unit); if (nq.text !== q.text) break; }
      if (nq.text === q.text) nq = makeQuestion(it.unit);
      nq = limitQ(nq, cfg().choices, spec && spec.tag);
      Q.items.splice(Q.i + 1, 0, { unit: it.unit, q: nq, retry: true });
    }
    Q.xp += 2; Q.answered = { ok, idx, tag, effort: 2, hyp: evs }; it.res = 'ng'; // ちょうせん ポイント(まちがえても ゼロに しない)
    beep('ng'); vibrate([40, 40, 40]);
  }
  save(); render();
}

function finish() {
  const k = kidOf(); const p = S.kids[k.id]; refreshDay(p);
  const before = rankOf(p.xp);
  const selBefore = dataFor(k).sel.state;
  const own = Q.items.filter((x) => x.unit.grade >= k.grade).length / Math.max(1, Q.items.length);
  const bonusXp = Q.xp + Math.round(20 * own); // 1セットやりきったボーナス(まえの がくねんの ぶんは はんぶん)
  p.xp += bonusXp;
  const after = rankOf(p.xp);
  const t = todayStr();
  if (Q.mode === 'bonus') { p.today.bonusDone++; p.callup = t; } else p.today.sets++;
  if (!p.days.includes(t)) p.days.push(t);
  p.lastDate = t;
  if (Q.hat) p.hat = (p.hat || 0) + 1;
  if (Q.good === Q.items.length && !Object.keys(Q.missTags).length) p.perfect = (p.perfect || 0) + 1;
  if (Q.mode === 'back') p.backRuns = (p.backRuns || 0) + 1;
  const newly = BADGES.filter((b) => !(p.badges || []).includes(b.id) && b.cond(p, k));
  p.badges = [...(p.badges || []), ...newly.map((b) => b.id)];
  const perfectNow = Q.good === Q.items.length && !Object.keys(Q.missTags).length;
  const info = { good: Q.good, total: Q.items.length, mode: Q.mode, perfect: perfectNow };
  const gotTickets = awardStudy(p, info, t);
  const capped = !Object.keys(gotTickets).length && Object.keys(studyReward(info)).length > 0;
  save();
  const selAfter = dataFor(k).sel.state;
  const tags = Object.entries(Q.missTags).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([x]) => x).filter((x) => x !== 'unknown' || Object.keys(Q.missTags).length === 1);
  Q.result = { good: Q.good, total: Q.items.length, xp: bonusXp, hat: Q.hat, tags, rankUp: after.i > before.i, rankName: after.name, callup: selBefore !== 'in' && selAfter === 'in', newBadges: newly.map((b) => ({ icon: b.icon, name: b.name })), tickets: gotTickets, capped, pts: Q.pts, hyp: (Q.hyp || []).map((e) => ({ type: e.type, label: hypLabel(e.h) })) };
  lastCount.score = 0;
  view = 'result'; toTop = true; render();
  if (Q.result.good >= Math.ceil(Q.result.total * 0.6) || Q.result.rankUp || Q.result.callup || Q.result.newBadges.length || Q.result.hyp.some((e) => e.type === 'resolved')) {
    setTimeout(() => { confetti(innerWidth / 2, innerHeight * 0.32, 110, 1.5); beep('win'); vibrate([60, 40, 60, 40, 120]); }, 400);
  }
  syncNow();
}

function askPapa() {
  const k = kidOf(); const p = S.kids[k.id]; const it = Q.items[Q.i]; const q = it.q;
  const text = `【パパにきく】${k.name}(${k.grade}ねん)\nもんだい:${q.text}\nせんたくし:${q.choices.map((c) => c.label).join(' / ')}`;
  p.ask.unshift({ date: todayStr(), text: `\n${q.text}\n(${q.choices.map((c) => c.label).join(' / ')})` });
  p.ask = p.ask.slice(0, 30); save();
  if (navigator.share) navigator.share({ text }).catch(() => {});
  else if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
  toast('パパに しつもんを とっておいたよ!');
}

document.addEventListener('click', (e) => {
  lastTap = { x: e.clientX || innerWidth / 2, y: e.clientY || innerHeight / 2 };
  const el = e.target.closest('[data-act]'); if (!el) return;
  const a = el.dataset.act;
  if (a === 'bind' && S.shared) {
    kidId = el.dataset.id; unlocked = false; tab = 'home'; view = 'kid'; toTop = true; syncNow();
  }
  else if (a === 'bind') {
    if (!askPin()) return;
    S.bound = el.dataset.id; kidId = S.bound; tab = 'home'; view = 'kid'; toTop = true; save(); syncNow();
  }
  else if (a === 'rebind') {
    if (!confirm(`この スマホを「${KIDS.find((x) => x.id === el.dataset.id).name}」の スマホに かえる?`)) return;
    S.bound = el.dataset.id; kidId = S.bound; unlocked = false; tab = 'home'; view = 'kid'; toTop = true; save(); syncNow();
  }
  else if (a === 'unlock') {
    const pw = prompt(`${kidOf().name}の PINを いれてね`);
    if (pw === null) return;
    if (pinHash(pw) !== S.kidPins[kidId]) { toast('PINが ちがうよ'); return; }
    unlocked = true; toTop = true;
  }
  else if (a === 'lock') { unlocked = false; if (S.shared) { kidId = null; view = 'setup'; } toTop = true; }
  else if (a === 'setkidpin') {
    const who = KIDS.find((x) => x.id === el.dataset.id);
    const p1 = prompt(`${who.name}の PINを きめてください(4けたの すうじ)`);
    if (p1 === null) return;
    if (!/^\d{4}$/.test(p1)) { toast('4けたの すうじで いれてね'); return; }
    S.kidPins[who.id] = pinHash(p1); save(); toast(`${who.name}の PINを きめたよ`);
  }
  else if (a === 'clearkidpin') { delete S.kidPins[el.dataset.id]; save(); toast('PINを けしたよ'); }
  else if (a === 'changepin') {
    const p1 = prompt('あたらしい パパの PINを いれてね(4けた)');
    if (p1 === null) return;
    if (!/^\d{4}$/.test(p1)) { toast('4けたの すうじで いれてね'); return; }
    S.pin = pinHash(p1); save(); toast('パパの PINを かえたよ');
  }
  else if (a === 'toggleshared') {
    S.shared = !S.shared; save();
    if (S.shared) { kidId = null; unlocked = false; } else { kidId = S.bound || null; unlocked = false; }
    toast(S.shared ? 'みんなで つかう モードに したよ' : '1人ずつの スマホに もどしたよ');
  }
  else if (a === 'mute') { const was = quiet(); S.mute = false; setCfg(S, kidId, { quiet: !was }); save(); if (!quiet()) beep('ok'); }
  else if (a === 'begin') return beginQuiz();
  else if (a === 'previewback') { Q = null; view = 'kid'; toTop = true; }
  else if (a === 'rest') return startRest();
  else if (a === 'restend') { clearTimeout(restTimer); view = 'kid'; tab = 'home'; toTop = true; }
  else if (a === 'cfgt') { const id = el.dataset.id; setCfg(S, id, { [el.dataset.key]: !cfgOf(S, id)[el.dataset.key] }); save(); }
  else if (a === 'cfgp') { applyPreset(S, el.dataset.id, el.dataset.p); save(); toast('せっていを かえたよ'); }
  else if (a === 'setpin') { if (!askPin()) return; }
  else if (a === 'tab') { tab = el.dataset.tab; view = 'kid'; toTop = true; }
  else if (a === 'home' || a === 'kid') { view = kidId ? 'kid' : 'setup'; tab = 'home'; toTop = true; if (a === 'home') syncNow(); }
  else if (a === 'papa') { if (!askPin()) return; view = 'papa'; toTop = true; }
  else if (a === 'start') { toTop = true; return startQuiz(el.dataset.mode, el.dataset.unit); }
  else if (a === 'quit') {
    if (!confirm('ここで ひとやすみ する?(ここまでの ポイントは とっておくよ)')) return;
    const pq = S.kids[kidId];
    if (Q && Q.xp) { pq.xp += Q.xp; Q.xp = 0; save(); toast('ここまでの ポイントは とっておいたよ'); }
    view = 'kid'; toTop = true;
  }
  else if (a === 'ans') return answer(Number(el.dataset.idx));
  else if (a === 'idk') return answer(null, true);
  else if (a === 'ask') return askPapa();
  else if (a === 'speak') return speak(Q.items[Q.i].q.text);
  else if (a === 'hint') { const it = Q.items[Q.i]; it.hinted = it.hinted || []; const cand = it.q.choices.map((c, i) => i).filter((i) => !it.q.choices[i].ok && !it.hinted.includes(i)); if (cand.length && it.q.choices.length - it.hinted.length > 2) { it.hinted.push(cand[Math.floor(Math.random() * cand.length)]); Q.hints = (Q.hints || 0) + 1; beep('ok'); } }
  else if (a === 'next') { Q.answered = null; Q.i++; if (Q.i >= Q.items.length) return finish(); Q.lockUntil = Date.now() + lockMs(Q.items[Q.i].q); toTop = true; }
  else if (a === 'synccode') { document.getElementById('synccode').value = sync.newCode(); return; }
  else if (a === 'syncsave') {
    const db = document.getElementById('syncdb').value; const fc = document.getElementById('synccode').value;
    if (!sync.validCfg(db, fc)) return toast('URL(https://〜)と コード(10もじいじょう)を いれてね');
    sync.setCfg(db, fc); toast('つないだよ!'); syncNow(); return;
  }
  else if (a === 'synctest') {
    toast('しらべてるよ…');
    sync.check().then((r) => {
      const names = r.ids.map((id) => (KIDS.find((k) => k.id === id) || { name: id }).name);
      toast(r.ok ? (names.length ? `つながったよ! きろくが とどいている人: ${names.join('・')}` : 'つながったよ! まだ だれの きろくも ないよ(それぞれの スマホで アプリを ひらいてね)')
        : r.status === 401 || r.status === 403 ? 'ルールが ちがうよ。README の ルールを コピーして「公開」してね'
          : r.status === 404 ? 'URLが ちがうみたい。「データ」タブの いちばん うえの URLを いれてね' : r.status === -1 ? 'まず URLと コードを ほぞんしてね' : 'つながらないよ。ネットと URLを かくにんしてね');
    });
    return;
  }
  else if (a === 'synccopy') {
    if (navigator.clipboard) navigator.clipboard.writeText(sync.shareLink(el.dataset.id)).then(() => toast('こども用リンクを コピーしたよ'), () => toast('コピーできなかったよ'));
    return;
  }
  else if (a === 'askdone') { S.kids[el.dataset.id].ask.splice(Number(el.dataset.i), 1); save(); }
  else if (gameAct(a, el)) { /* ガチャ・へんせい・たいせん など */ }
  render();
});
// 選手カードが 指に ついて すこし かたむく
document.addEventListener('pointermove', (e) => {
  const c = e.target.closest && e.target.closest('.pcard');
  if (!c || reduceMotion) return;
  const r = c.getBoundingClientRect();
  c.style.setProperty('--ry', `${((e.clientX - r.left) / r.width - 0.5) * 16}deg`);
  c.style.setProperty('--rx', `${-((e.clientY - r.top) / r.height - 0.5) * 16}deg`);
});
document.addEventListener('pointerup', () => document.querySelectorAll('.pcard').forEach((c) => { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); }));

document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-act="override"],[data-act="need"],[data-act="cfgs"]'); if (!el) return;
  if (el.dataset.act === 'cfgs') {
    const key = el.dataset.key; const numeric = key === 'setSize' || key === 'gachaMax';
    setCfg(S, el.dataset.id, { [key]: numeric ? Number(el.value) : el.value }); save(); toast('せっていを かえたよ'); return render();
  }
  if (el.dataset.act === 'need') { S.need = Number(el.value); save(); toast('日数を かえたよ'); return render(); }
  if (el.value) S.override[el.dataset.id] = el.value; else delete S.override[el.dataset.id];
  save(); toast('たんげんを かえたよ');
});

gameInit({
  KIDS, kid: () => kidOf(), p: () => S.kids[kidId], cfg: () => cfg(), render: () => render(), toast, save, today: todayStr, BADGES,
  haveBadge: (b) => (S.kids[kidId].badges || []).includes(b.id) || b.cond(S.kids[kidId], kidOf()),
  dataFor, matesHtml: () => repCard(kidOf(), S.kids[kidId]) + siblingsCard(),
  setView: (v) => { view = v; toTop = true; },
  fx: { confetti, beep, vibrate, floaty },
});

// 国語の問題プール(毎朝 Gemini が増やす)。読めなくても 算数だけで動く
try {
  const r = await fetch('data/kokugo-pool.json', { cache: 'no-cache', signal: AbortSignal.timeout(4000) });
  if (r.ok) registerKokugo((await r.json()).items || []);
} catch { /* オフラインなど */ }

// 理科・社会・生活(人が確かめた事実リスト)
try {
  const r = await fetch('data/knowledge.json', { cache: 'no-cache', signal: AbortSignal.timeout(4000) });
  if (r.ok) registerKnowledge((await r.json()).units || []);
} catch { /* オフラインなど */ }

// 都道府県・せかいの くにの かたち(かたちクイズ)
try {
  const r = await fetch('data/geo.json', { cache: 'no-cache', signal: AbortSignal.timeout(4000) });
  const fr = await fetch('data/flags.json', { cache: 'no-cache', signal: AbortSignal.timeout(4000) }).catch(() => null);
  if (r.ok) registerGeo(await r.json(), fr && fr.ok ? await fr.json() : null);
} catch { /* オフラインなど */ }

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
render();
