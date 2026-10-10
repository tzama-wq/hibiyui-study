import * as sync from './sync.js';
import { addPoints, addTickets, addShards, cupById, ensureCup, emptyStatMap, registerBuffs, PLAYER_BY_ID, ENH_MAX, studyReward, PRACTICE_TICKET_CAP as PRACTICE_CAP } from './game.js';
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
const esc = (t) => String(t).replace(/[<>&"]/g, '');
const rankIdx = (name) => RANKS.findIndex((r) => r[1] === name);
// 1セットの もんだい数は 子どもごとの せってい(cfg.js の setSize。ふつうは 5)
const MAX_BONUS = 3;

// ---- 保存 -----------------------------------------------------------------
// ダイヤモンドレアの じぶんカードの えがら(よみこめない ときは えもじ)
const avaHtml = (k) => `<img class="ava-img" src="images/players/self_${k.id}.webp" alt="" onerror="this.outerHTML='${k.em}'">`;
const KEY = 'hibiyui.v1';
const VERSION = '2026-10-09.2'; // パパの へやに ひょうじ(スマホが さいしんか たしかめる ため)
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
  // 1かい せいかいしただけの「できた」は まだ「できた」にしない(答えを おぼえただけかも)。べつの日に せいかい、または 2もん せいかいで「できた」
  if (base === 'ok' && (u.d || []).length < 2 && u.ok < 2) return 'sprout';
  return base;
}
const lastCorrectDay = (p, id) => { const d = (p.units[id] || {}).d || []; return d[d.length - 1]; };
// いま たしかめる ひつようが ある単元か(sprout は もう1かい せいかい)
const needs = (p, id) => status(p, id) !== 'ok';
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
// ---- むげんチャレンジ: まだ「できて」いない もんだいを ぜんぶ じゅんばんに。やめても きろくは のこる ----
const infOf = (p) => (p.inf = p.inf || { cleared: {}, count: 0, round: 1 });
function infPool(kid) {
  const p = S.kids[kid.id]; const I = infOf(p); const out = [];
  for (const u of skillsUpTo(kid.grade)) {
    if (status(p, u.id) === 'ok') continue; // もう「できた」たんげんは のぞく
    if (u.items && !u.geo) { for (const it of u.items) if (!I.cleared[it.id]) out.push({ unit: u, key: it.id, itemId: it.id }); }
    else if (!I.cleared[`u:${u.id}`]) out.push({ unit: u, key: `u:${u.id}` });
  }
  return out;
}
function buildInf(kid, n) {
  const p = S.kids[kid.id]; const I = infOf(p); const kc = cfgOf(S, kid.id);
  let pool = infPool(kid);
  if (!pool.length && Object.keys(I.cleared).length) { I.cleared = {}; I.round++; pool = infPool(kid); } // ぜんぶ おわったら 2しゅうめ
  const seen = new Set();
  return shuffle(pool).slice(0, n).map((e) => {
    let q; for (let t = 0; t < 6; t++) { q = e.itemId ? makeProbe(e.unit, { itemId: e.itemId }) : makeQuestion(e.unit); if (!seen.has(q.text)) break; }
    seen.add(q.text);
    return { unit: e.unit, q: limitQ(q, kc.choices), retry: false, probe: false, inf: e.key };
  });
}
function buildSet(kid, mode, unitId) {
  if (mode === 'endless') return buildInf(kid, 10);
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
  } else if (mode === 'weak') { // 「じゃくてんに チャレンジ」: まちがえた ないようの ふくしゅう
    const items = [];
    const key = (e) => `${e.unit.id}|${JSON.stringify(e.probe || null)}`;
    const have = new Set();
    const push = (e) => { if (items.length >= SET_SIZE || have.has(key(e))) return; have.add(key(e)); items.push(e); };
    for (const r of (p.revenge || []).filter((x) => byId[x.unit]).sort((a, b) => a.due.localeCompare(b.due) || b.miss - a.miss)) push({ unit: byId[r.unit], probe: r.spec, rkey: r.key });
    for (const h of activeList(p)) if (byId[h.unit]) push({ unit: byId[h.unit], probe: specFor(h), hkey: h.key });
    const wu = sk.filter((u) => ['gap', 'shaky'].includes(status(p, u.id)));
    for (let t = 0; t < 40 && items.length < SET_SIZE && wu.length; t++) { const u = wu[Math.floor(Math.random() * wu.length)]; items.push({ unit: u }); }
    plan = items.length ? items.map((e) => (e.probe || e.rkey ? e : e.unit)) : [cur[0]];
    plan = plan.slice(0, SET_SIZE);
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
    const kos = unitsOf(kid.grade).filter((u) => u.subject === '国語'); // 国語は 漢字+ことばの たんげん。まいにち 2もん
    const pickKo = () => (kos.length ? kos[Math.floor(Math.random() * kos.length)] : null);
    const ko = pickKo(); let ko2 = pickKo(); for (let i = 0; i < 6 && kos.length > 1 && ko2 === ko; i++) ko2 = pickKo();
    const month = new Date().getMonth() + 1;
    const know = unitsOf(kid.grade).filter((u) => ['理科', '社会', '生活', '英語', '道徳'].includes(u.subject) || (u.subject === '算数' && u.items)); // 算数の「ことがら」たんげんも まぜる
    const knowNow = know.filter((u) => u.months.includes(month));
    const kpool = knowNow.length ? knowNow : know;
    const kn = kpool.length ? kpool[Math.floor(Math.random() * kpool.length)] : null;
    // だいじな じゅんに ならべて、せっていの もんだい数ぶん つかう。「やることを みせる」せっていの ときは じゅんばんを かえない
    plan = [cur[0], ko || cur[1 % cur.length], kn || cur[2 % cur.length], ko2 || cur[1 % cur.length], c.length ? c[0] : weakPick(p, review.length ? review : sk)].slice(0, SET_SIZE);
    if (!kc.preview) plan = shuffle(plan);
    // いま たしかめ中の かせつが あれば、1もん(大きいセットは 2もん)を「たしかめる 問題」に する
    const nProbe = Math.min(2, Math.max(1, Math.floor(SET_SIZE / 3)));
    nextProbes(p, today, nProbe + 2).filter((h) => byId[h.unit]).slice(0, nProbe).forEach((h, i) => { plan[plan.length - 1 - i] = { unit: byId[h.unit], probe: specFor(h), hkey: h.key }; });
    if (kc.gentle) { // まえに まちがえた もんだいを、ヒントつきで もういちど(1セット 1〜2もん・やさしい もんだいの あと)
      const due = dueRevenge(p, SET_SIZE >= 5 ? 2 : 1);
      due.forEach((r, i) => { const pos = Math.min(plan.length - 1, 1 + i * 2); if (!plan[pos] || !plan[pos].probe) plan[pos] = { unit: byId[r.unit], probe: r.spec, rkey: r.key }; });
    }
    if (kc.easyStart) { // 「できた」たんげんの やさしい もんだいで はじまり、(かせつの たしかめが ない ときは) おわる
      const done = sk.filter((u) => status(p, u.id) === 'ok');
      const pool = done.length ? done : sk.filter((u) => u.grade < kid.grade);
      const e1 = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
      const e2 = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
      if (e1) plan[0] = e1;
      if (e2 && plan.length >= 3 && !plan[plan.length - 1].probe) plan[plan.length - 1] = e2;
    }
  }
  const seen = new Set();
  return plan.map((entry) => {
    const unit = entry.probe ? entry.unit : entry;
    let q;
    for (let t = 0; t < 8; t++) { q = entry.probe ? makeProbe(unit, entry.probe) : makeQuestion(unit); if (!seen.has(q.text)) break; }
    seen.add(q.text);
    q = limitQ(q, kc.choices, entry.probe && entry.probe.tag);
    const rev = entry.rkey ? { revenge: true, rkey: entry.rkey, hinted: assistOne(q) } : {};
    return { unit, q, retry: false, probe: !!entry.probe, hkey: entry.hkey, ...rev };
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
  try { // 英語の ところは en-US、ほかは ja-JP で じゅんばんに よむ
    speechSynthesis.cancel();
    for (const seg of speakText(text).split(/([A-Za-z][A-Za-z0-9'’,.! ]*[A-Za-z0-9!.])/)) {
      if (!seg.trim()) continue;
      const u = new SpeechSynthesisUtterance(seg); u.lang = /^[A-Za-z]/.test(seg.trim()) ? 'en-US' : 'ja-JP'; u.rate = 0.9; speechSynthesis.speak(u);
    }
  } catch { /* 非対応 */ }
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
SND.try = [[392, 0.07], [523, 0.1]]; // まちがいの ときの やさしい おと(ブザーに しない)
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
const summary = (k) => { const p = S.kids[k.id]; return { name: k.name, grade: k.grade, xp: p.xp, goals: p.goals, days: p.days.length, rank: rankOf(p.xp).name, recent: p.days.slice(-14), callup: p.callup || null, team: summaryTeam(k, p),
  asks: (p.ask || []).slice(0, 10).map(({ id, date, text, t }) => ({ id, date, text: String(text).slice(0, 600), t })), ack: (S.ack || []).slice(-80),
  gods: (p.godReq || []).slice(0, 6).map(({ id, date, n, t }) => ({ id, date, n, t })) }; };
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
  { id: 'cup_allstar', icon: '🌟', name: '世界オールスター ゆうしょう', cond: (p) => ((p.cup || {}).cleared || []).includes('allstar') },
  { id: 'cup_isekai', icon: '🐉', name: '異世界大会 ゆうしょう', cond: (p) => ((p.cup || {}).cleared || []).includes('isekai') },
  { id: 'cup_galaxy', icon: '🌌', name: '銀河系大会 ゆうしょう', cond: (p) => ((p.cup || {}).cleared || []).includes('galaxy') },
  { id: 'cup_universe', icon: '🚀', name: '宇宙最強大会 ゆうしょう', cond: (p) => ((p.cup || {}).cleared || []).includes('universe') },
  { id: 'hyp1', icon: '🔬', name: 'はじめて のりこえた', cond: (p) => (p.hypResolved || 0) >= 1 },
  { id: 'hyp5', icon: '🧪', name: '5つ のりこえた', cond: (p) => (p.hypResolved || 0) >= 5 },
  { id: 'rank2', icon: '🚀', name: 'ユースの エース', cond: (p) => rankOf(p.xp).i >= rankIdx('ユースの エース') },
  { id: 'rank4', icon: '🏟️', name: 'Jリーガー', cond: (p) => rankOf(p.xp).i >= rankIdx('Jリーガー') },
  { id: 'rank5', icon: '🇯🇵', name: 'にほんだいひょう', cond: (p) => rankOf(p.xp).i >= rankIdx('にほんだいひょう') },
  { id: 'rank_eu', icon: '🌍', name: 'ヨーロッパの スター', cond: (p) => rankOf(p.xp).i >= rankIdx('ヨーロッパの スター') },
  { id: 'rank_wc', icon: '🏆', name: 'ワールドカップの スター', cond: (p) => rankOf(p.xp).i >= rankIdx('ワールドカップの スター') },
  { id: 'rank_max', icon: '👑', name: 'サッカーの でんせつ', cond: (p) => rankOf(p.xp).i >= RANKS.length - 1 },
  ...[['算数', '🔢'], ['国語', '📖'], ['理科', '🔬'], ['社会', '🏙️'], ['生活', '🌱'], ['英語', '🔤'], ['道徳', '💛']].map(([sj, icon]) => (
    { id: `m_${sj}`, icon, name: `${sj}の プロ`, cond: (p, k) => masterCount(p, k, sj) >= 3 })),
];
// ---- メダルを 3ばいに(まいにちの がんばり・九九・ちず・たいかい・ガチャ・きょうか・ランク) ----------------------------
{
  const unitOk = (p, id) => (p.units[id] || {}).ok || 0;
  const cupTitles = (p) => Object.values((p.cup || {}).titles || {}).reduce((a, b) => a + b, 0);
  const owned = (p) => Object.keys(p.owned || {});
  const enhSum = (p) => Object.values(p.plv || {}).reduce((a, b) => a + b, 0);
  const SP = { 算数: 'SHO', 国語: 'PAS', 理科: 'SPD', 社会: 'DEF', 生活: 'STA', 英語: 'PAS', 道徳: 'STA' };
  const more = []; const add = (id, icon, name, cond, buff) => more.push({ id, icon, name, cond, buff });
  [[500, '🏆', { SHO: 10 }], [1000, '💯', { SHO: 12 }], [2000, '🔥', { SHO: 14 }], [3000, '🌋', { SHO: 16 }]].forEach(([n, i, b]) => add(`goal${n}`, i, `${n}ゴール`, (p) => p.goals >= n, b));
  [[60, '📆', { STA: 10 }], [100, '💯', { STA: 12 }], [200, '🎖️', { STA: 14 }], [365, '🎆', { STA: 16 }]].forEach(([n, i, b]) => add(`day${n}`, i, n === 365 ? '1ねん れんしゅう' : `${n}日 れんしゅう`, (p) => p.days.length >= n, b));
  [[5, { SHO: 4, PAS: 3 }], [20, { SHO: 6, PAS: 4 }], [50, { SHO: 8, PAS: 6 }]].forEach(([n, b]) => add(`hat${n}`, '🎩', `ハットトリック ${n}かい`, (p) => (p.hat || 0) >= n, b));
  [[5, { ALL: 4 }], [20, { ALL: 5 }], [50, { ALL: 6 }]].forEach(([n, b]) => add(`perfect${n}`, '✨', `パーフェクト ${n}かい`, (p) => (p.perfect || 0) >= n, b));
  [[5, { SPD: 6 }], [20, { SPD: 9 }]].forEach(([n, b]) => add(`time${n}`, '⏪', `タイムマシン ${n}かい`, (p) => (p.backRuns || 0) >= n, b));
  [[10, { ALL: 4 }], [25, { ALL: 5 }], [50, { ALL: 6 }]].forEach(([n, b]) => add(`hyp${n}`, '🧪', `${n}つ のりこえた`, (p) => (p.hypResolved || 0) >= n, b));
  KUKU_DAN.forEach((id, i) => add(`kuku_d${i + 1}`, '✖️', `九九 ${i + 1}の だん マスター`, (p) => status(p, id) === 'ok', { SHO: 3 }));
  add('kuku_all', '🧮', '九九 ぜんぶ マスター', (p) => status(p, 'g2_kuku_all') === 'ok', { SHO: 6 });
  add('kuku_inv', '🔍', '□を さがせ マスター', (p) => status(p, 'g2_kuku_inv') === 'ok', { PAS: 6 });
  [['geo_pref', '🗾', 'とどうふけん はかせ', 6], ['geo_world', '🌏', 'せかい ちず はかせ', 6], ['flag_world', '🚩', 'こっき はかせ', 6], ['geo_pref_e', '🗾', 'にほんの かたち マスター', 3], ['geo_world_e', '🌏', 'せかいの かたち マスター', 3], ['flag_world_e', '🚩', 'せかいの こっき マスター', 3]]
    .forEach(([id, i, n, v]) => add(`ok_${id}`, i, n, (p) => status(p, id) === 'ok', { DEF: v }));
  [['geo_pref', '🗾', 'とどうふけん'], ['geo_world', '🌏', 'せかいの くに'], ['flag_world', '🚩', 'こっき']].forEach(([id, i, n]) => {
    add(`n50_${id}`, i, `${n} 50もん せいかい`, (p) => unitOk(p, id) >= 50, { DEF: 4 }); add(`n200_${id}`, i, `${n} 200もん せいかい`, (p) => unitOk(p, id) >= 200, { DEF: 8 });
  });
  [[2, { ALL: 3 }], [5, { ALL: 4 }], [10, { ALL: 6 }]].forEach(([n, b]) => add(`titles${n}`, '🏆', `たいかい ゆうしょう ${n}かい`, (p) => cupTitles(p) >= n, b));
  [[1, { SHO: 2 }], [10, { SHO: 4 }], [30, { SHO: 6 }], [100, { SHO: 8 }]].forEach(([n, b]) => add(`win${n}`, '⚔️', `たいせん ${n}しょう`, (p) => ((p.battles || {}).w || 0) >= n, b));
  [[1, { DEF: 3 }], [5, { DEF: 5 }], [20, { DEF: 7 }]].forEach(([n, b]) => add(`pk${n}`, '🥅', `PK戦 ${n}しょう`, (p) => (p.pkWins || 0) >= n, b));
  [[10, { PAS: 3 }], [30, { PAS: 5 }], [60, { PAS: 7 }], [100, { PAS: 9 }], [200, { PAS: 12 }]].forEach(([n, b]) => add(`dex${n}`, '📚', `ずかん ${n}にん`, (p) => owned(p).length >= n, b));
  [[1, { ALL: 3 }], [3, { ALL: 4 }], [10, { ALL: 6 }]].forEach(([n, b]) => add(`legend${n}`, '👑', `レジェンド ${n}にん ゲット`, (p) => owned(p).filter((id) => (PLAYER_BY_ID[id] || {}).rarity === 'legend').length >= n, b));
  [[5, { ALL: 3 }], [25, { ALL: 4 }], [100, { ALL: 6 }]].forEach(([n, b]) => add(`ov${n}`, '⭐', `リベンジ のりこえた ${n}こ`, (p) => (p.overcome || 0) >= n, b));
  [[10, { ALL: 2 }], [50, { ALL: 3 }], [200, { ALL: 5 }]].forEach(([n, b]) => add(`try${n}`, '🌱', `ためして みた ${n}かい`, (p) => (p.tries || 0) >= n, b));
  [[5, { SPD: 3 }], [20, { SPD: 6 }], [50, { SPD: 9 }]].forEach(([n, b]) => add(`enh${n}`, '💪', `きょうか ${n}かい`, (p) => enhSum(p) >= n, b));
  add('enhmax', '🔥', 'きょうか MAX', (p) => Object.values(p.plv || {}).some((v) => v >= ENH_MAX), { ALL: 5 });
  [['プロ1ねんめ', '🥅', { ALL: 2 }, 'rank_pro'], ['Jリーグ MVP', '🏅', { ALL: 3 }, 'rank_jmvp'], ['チャンピオンズリーグの スター', '🌟', { ALL: 5 }, 'rank_cl'], ['バロンドール', '🏆', { ALL: 6 }, 'rank_ballon']]
    .forEach(([nm, i, b, id]) => add(id, i, nm, (p) => rankOf(p.xp).i >= rankIdx(nm), b));
  [['算数', '🔢'], ['国語', '📖'], ['理科', '🔬'], ['社会', '🏙️'], ['生活', '🌱'], ['英語', '🔤'], ['道徳', '💛']].forEach(([sj, icon]) => {
    add(`m10_${sj}`, icon, `${sj}の たつじん`, (p, k) => masterCount(p, k, sj) >= 10, { [SP[sj]]: 8 });
    add(`m20_${sj}`, icon, `${sj}の はかせ`, (p, k) => masterCount(p, k, sj) >= 20, { [SP[sj]]: 10 });
  });
  registerBuffs(Object.fromEntries(more.map((m) => [m.id, m.buff])));
  BADGES.push(...more.map(({ id, icon, name, cond }) => ({ id, icon, name, cond })));
}
// メダルを とる じょうけん(「れんしゅう」の メダルだなに ひょうじ)
const UNIT_JA = () => ({ geo_pref: 'とどうふけんの かたち', geo_world: 'せかいの くにの かたち', flag_world: 'せかいの こっき', geo_pref_e: 'とどうふけんの かたち', geo_world_e: 'せかいの くにの かたち', flag_world_e: 'せかいの こっき' });
const BASE_DESC = {
  goal1: 'はじめて もんだいに せいかいする', goal10: 'ぜんぶで 10もん せいかい', goal50: 'ぜんぶで 50もん せいかい', goal100: 'ぜんぶで 100もん せいかい', goal300: 'ぜんぶで 300もん せいかい',
  day3: 'ぜんぶで 3日 れんしゅう', day7: 'ぜんぶで 7日 れんしゅう', day30: 'ぜんぶで 30日 れんしゅう',
  hat: '3もん れんぞくで せいかい(ハットトリック)', perfect: 'ミスなしで 1セット ぜんぶ せいかい', comeback: 'おやすみの あとの「かくれステージ」を クリア', time: 'タイムマシンを 1かい あそぶ',
  kuku9: '九九の 1〜9の だんが ぜんぶ「できた」', hyp1: 'つまずきの かせつを 1つ のりこえる', hyp5: 'つまずきの かせつを 5つ のりこえる',
  cup_j: 'Jリーグで ゆうしょう', cup_asia: 'アジアカップで ゆうしょう', cup_kirin: 'KIRINカップで ゆうしょう', cup_wc: 'ワールドカップで ゆうしょう',
  cup_allstar: '世界オールスターで ゆうしょう', cup_isekai: '異世界大会で ゆうしょう', cup_galaxy: '銀河系大会で ゆうしょう', cup_universe: '宇宙最強大会で ゆうしょう',
};
function medalDesc(b) {
  if (BASE_DESC[b.id]) return BASE_DESC[b.id];
  const id = b.id; let m;
  if ((m = id.match(/^goal(\d+)$/))) return `ぜんぶで ${m[1]}もん せいかい`;
  if ((m = id.match(/^day(\d+)$/))) return `ぜんぶで ${m[1]}日 れんしゅう`;
  if ((m = id.match(/^hat(\d+)$/))) return `ハットトリック(3もん れんぞく せいかい)を ${m[1]}かい`;
  if ((m = id.match(/^perfect(\d+)$/))) return `ミスなしの セット(パーフェクト)を ${m[1]}かい`;
  if ((m = id.match(/^time(\d+)$/))) return `タイムマシンを ${m[1]}かい あそぶ`;
  if ((m = id.match(/^hyp(\d+)$/))) return `つまずきの かせつを ${m[1]}こ のりこえる`;
  if ((m = id.match(/^kuku_d(\d)$/))) return `九九の ${m[1]}の だんが「できた」(2もん せいかい、または べつの日にも せいかい)`;
  if (id === 'kuku_all') return '「九九 ぜんぶ」が「できた」'; if (id === 'kuku_inv') return '「□を さがせ」が「できた」';
  if ((m = id.match(/^ok_(.+)$/))) return `「${UNIT_JA()[m[1]] || m[1]}」の もんだいが「できた」(2もん せいかい、または べつの日にも せいかい)`;
  if ((m = id.match(/^n(50|200)_(.+)$/))) return `「${UNIT_JA()[m[2]] || m[2]}」で ${m[1]}もん せいかい`;
  if ((m = id.match(/^titles(\d+)$/))) return `たいかいで ゆうしょうを ぜんぶで ${m[1]}かい`;
  if ((m = id.match(/^win(\d+)$/))) return `たいせん・たいかいの しあいで ${m[1]}しょう`;
  if ((m = id.match(/^pk(\d+)$/))) return `PK戦で ${m[1]}しょう`;
  if ((m = id.match(/^dex(\d+)$/))) return `ずかんに ${m[1]}にん あつめる`;
  if ((m = id.match(/^legend(\d+)$/))) return `レジェンドを ${m[1]}にん ゲット`;
  if ((m = id.match(/^enh(\d+)$/))) return `ガチャ選手の きょうかを ぜんぶで ${m[1]}かい`;
  if ((m = id.match(/^try(\d+)$/))) return `まちがえても ためして みる(ちょうせん)を ${m[1]}かい`;
  if ((m = id.match(/^ov(\d+)$/))) return `まちがえた もんだいを もういちど ちょうせんして、2かい できて「のりこえた」を ${m[1]}こ`;
  if (id === 'enhmax') return 'ガチャ選手を きょうか +20(MAX)に する';
  if (id.startsWith('rank')) return `ランク「${b.name}」まで ポイントを ためる`;
  if ((m = id.match(/^m(\d+)?_?(.+)$/))) { const n = m[1] || '3'; return `「${m[2]}」で「できた」たんげんを ${n}こ ふやす(それぞれ 3もん せいかい・2日 いじょう)`; }
  return '';
}
for (const b of BADGES) b.desc = medalDesc(b);

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
  if (r) {
    S.remote = r;
    const ack = ackSet(); // パパが「おしえたよ」した しつもんは こちらでも けす
    for (const kk of KIDS) { const pp = S.kids[kk.id]; const n = (pp.ask || []).length; pp.ask = (pp.ask || []).filter((a) => !ack.has(a.id)); }
    save();
    const typing = typeof document !== 'undefined' && document.activeElement && /^(SELECT|INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
    if (view === 'kid' || (view === 'papa' && !typing)) render();
  }
}
// ---- パパへの しつもん(スマホを またいで とどく) -----------------------------------
const ackSet = () => new Set([...(S.ack || []), ...Object.values(S.remote || {}).flatMap((r) => (r && r.ack) || [])]);
const plainText = (h) => String(h).replace(/<svg[\s\S]*?<\/svg>/g, '(えの もんだい)').replace(/<rt>[\s\S]*?<\/rt>/g, '').replace(/<[^>]*>/g, '').replace(/\s+\n/g, '\n').trim();
function asksOf(k) { // この子の まだ こたえていない しつもん(この スマホの ぶん + とどいた ぶん)
  const p = S.kids[k.id]; const ack = ackSet();
  const out = (p.ask || []).filter((a) => !ack.has(a.id));
  const have = new Set(out.map((a) => a.id));
  for (const a of ((S.remote || {})[k.id] || {}).asks || []) if (a && a.id && !have.has(a.id) && !ack.has(a.id)) { out.push({ ...a, remote: true }); have.add(a.id); }
  return out.sort((a, b) => (b.t || 0) - (a.t || 0));
}
const pendingAsks = () => KIDS.reduce((n, k) => n + asksOf(k).length, 0) + godPending().length;
// ---- 神チケット: 1日で「はじめての もんだい」+「まちがえた もんだい」を 100もん → パパに つうち → パパが OKすると くばられる ----
const GOD_GOAL = 100;
function godPending() { // パパへの おしらせ(神チケットを もらった ひ)。「みたよ」で けす
  const ack = ackSet(); const out = []; const have = new Set();
  for (const k of KIDS) {
    const p = S.kids[k.id];
    for (const r of [...(p.godReq || []), ...((((S.remote || {})[k.id]) || {}).gods || [])]) { if (!r || !r.id || have.has(r.id) || ack.has(r.id)) continue; have.add(r.id); out.push({ ...r, kid: k }); }
  }
  return out.sort((a, b) => (b.t || 0) - (a.t || 0));
}
function godHook(p, it, q, ok) { // こたえた もんだいが「はじめて」か「まえに まちがえた」なら きょうの かずに いれる
  const id = q.id; if (!id || it.retry) return;
  const t = todayStr();
  const G = (p.godDay = p.godDay && p.godDay.date === t ? p.godDay : { date: t, keys: {}, n: 0 });
  p.qh = p.qh || {};
  const eligible = p.qh[id] === undefined || p.qh[id] === 1;
  if (eligible && !G.keys[id]) {
    G.keys[id] = 1; G.n++;
    if (G.n >= GOD_GOAL && !(p.godReq || []).some((r) => r.date === t)) {
      const rid = `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
      p.godReq = [{ id: rid, date: t, n: G.n, t: Date.now() }, ...(p.godReq || [])].slice(0, 10);
      p.godGot = p.godGot || {}; p.godGot[rid] = 1; addTickets(p, { god: 1 }); // たっせいしたら すぐ 神チケット(パパには おしらせ)
      const k = kidOf(); save();
      toast(`🎫 きょう ${GOD_GOAL}もん たっせい!! 神チケットを ゲット! ガチャで つかおう`); confetti(innerWidth / 2, innerHeight * 0.3, 120, 1.5); beep('win');
      if (sync.enabled()) syncNow(); else if (navigator.share) navigator.share({ text: `【神チケット】${k.name}が きょう ${GOD_GOAL}もん たっせいして 神チケットを ゲットしたよ!` }).catch(() => {});
    }
  }
  p.qh[id] = ok ? 0 : 1;
}
function godCard(k, p) {
  const t = todayStr(); const n = p.godDay && p.godDay.date === t ? p.godDay.n : 0;
  const got = Object.keys(p.godGot || {}).length;
  const body = n >= GOD_GOAL ? '<span>🎉 きょうは たっせい! 🎫神チケットを ゲットしたよ(1日 1まい)</span>'
      : `<span>きょう 1日で「はじめての もんだい」+「まちがえた もんだい」を ${GOD_GOAL}もん こたえよう!<br>むげんチャレンジが おすすめ</span>`;
  return `<div class="god-card"><small>GOD TICKET</small><b>🎫 神チケット チャレンジ</b><div class="god-bar"><i style="width:${Math.min(100, n)}%"></i></div><div class="god-n">きょう ${Math.min(n, GOD_GOAL)} / ${GOD_GOAL}もん${got ? ` ・ これまでに ${got}まい` : ''}</div>${body}</div>`;
}
for (const kk of KIDS) for (const a of S.kids[kk.id].ask || []) { a.id = a.id || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`; a.t = a.t || Date.now(); a.text = plainText(a.text); }
setInterval(() => { if (sync.enabled() && document.visibilityState === 'visible' && !Q) syncNow(); }, 45000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && sync.enabled()) syncNow(); });
const MILESTONES = [50, 100, 200, 300, 500, 750, 1000, 1500, 2000, 3000, 5000];
const ago = (t) => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 1 ? 'いま' : m < 60 ? `${m}ふん前` : m < 1440 ? `${Math.round(m / 60)}じかん前` : `${Math.round(m / 1440)}日前`; };
const SUBJECT_ICON = { 算数: '🔢', 国語: '📖', 理科: '🔬', 社会: '🏙️', 生活: '🌱', 英語: '🔤', 道徳: '💛' };
const SUBJECTS = ['算数', '国語', '理科', '社会', '生活', '英語', '道徳'];

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
    // まちがえても TOPの のうりょく・ティアは さがらない(いままでの いちばん たかい あたいを のこす)
    p.abBest = p.abBest || {}; stats[sj] = Math.max(stats[sj], p.abBest[sj] || 0); p.abBest[sj] = stats[sj];
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
    <div class="pc-ava">${avaHtml(k)}</div>
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
      <div class="mate-ava">${avaHtml(r.k)}</div>
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
// ---- プレゼント(data/gifts.json): ひとりに 1かいだけ うけとれる ---------------------------------------
let GIFTS = [];
function claimGifts() {
  if (!kidId || !GIFTS.length) return;
  const p = S.kids[kidId]; p.gifts = p.gifts || [];
  for (const g of GIFTS) {
    const mine = g.to && g.to[kidId]; if (!mine || p.gifts.includes(g.id)) continue;
    const { pts, cfgPreset, ...tk } = mine; // pts: のうりょく ポイント({SPD: 30})/ cfgPreset: やさしい せってい プリセット名 / それいがい: チケット
    if (cfgPreset && PRESETS[cfgPreset]) setCfg(S, kidId, PRESETS[cfgPreset].set); // いまの せっていに かさねる(ほかの せっていは のこす)
    addTickets(p, tk);
    p.pts = { ...emptyStatMap(), ...(p.pts || {}) }; for (const [st, n] of Object.entries(pts || {})) if (st in p.pts) p.pts[st] += n;
    p.gifts.push(g.id); save();
    const STN = { SHO: 'シュート', PAS: 'パス', SPD: 'スピード', DEF: 'まもり', STA: 'スタミナ' };
    const txt = [...(cfgPreset ? ['やさしい せっていを いれたよ'] : []), ...Object.entries(tk).map(([t, n]) => `${TK_NAME[t] || t}×${n}`), ...Object.entries(pts || {}).map(([st, n]) => `${STN[st] || st} +${n}pt`)].join(' ');
    setTimeout(() => { toast(`🎁 プレゼント! ${txt} ${g.msg || ''}`); confetti(innerWidth / 2, innerHeight * 0.3, 140, 1.6); beep('win'); vibrate([60, 40, 100]); }, 500);
  }
}
function render() {
  claimGifts();
  if (kidId && S.kids[kidId].shardGift > 0 && !S.kids[kidId].shardGiftShown) { // これまでの ぶんの かけらを おしらせ
    const pp = S.kids[kidId]; pp.shardGiftShown = 1; save();
    setTimeout(() => { toast(`💠 いままでの がんばりで ダイヤの かけら +${pp.shardGift}!`); confetti(innerWidth / 2, innerHeight * 0.3, 90, 1.3); beep('win'); }, 1200);
  }
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
    ${KIDS.map((k) => `<button class="kid-select" style="--kid:${k.color}" data-act="bind" data-id="${k.id}"><span class="ks-ava">${avaHtml(k)}</span><span class="ks-name">${k.name}</span><span class="ks-sub">${k.grade}ねんせい</span></button>`).join('')}`;
}

function vLock() {
  const k = kidOf();
  $app.innerHTML = `<div class="hero"><div class="logo">⚽ HIBIYUI FC</div><div class="pc-ava" style="margin:8px 0">${avaHtml(k)}</div><h1>${k.name}の PINを いれてね</h1>
    <p class="sub">${k.name}だけの 4けたの すうじだよ</p></div>
    <button class="btn gold" data-act="unlock">🔓 PINを いれる</button>
    <div class="center">${S.shared ? '<button class="link" data-act="lock">← べつの 子</button> ' : ''}<button class="link" data-act="papa">👨 パパの へや</button></div>`;
}

function topBar(k, p) {
  const r = rankOf(p.xp);
  return `<header class="topbar"><div class="tb-ava-wrap">${ringSvg('tb-ring', r.pct / 100)}<div class="tb-ava">${avaHtml(k)}</div></div>
    <div class="tb-name"><b>${k.name}</b><small>${r.name}</small></div>
    <div class="tb-chips"><span class="chip gold">⚽ <b data-count="${p.goals}" data-key="goals">${p.goals}</b></span><span class="chip">XP <b data-count="${p.xp}" data-key="xp">${p.xp}</b></span></div>
    <button class="gear" data-act="mute" aria-label="おと">${quiet() ? '🔇' : '🔊'}</button>
    ${S.kidPins[k.id] || S.shared ? '<button class="gear" data-act="lock" aria-label="ロック">🔒</button>' : ''}<button class="gear" data-act="papa" aria-label="パパの へや">⚙${pendingAsks() > 0 && k.adult ? `<b class="gdot">${pendingAsks()}</b>` : ''}</button></header>`;
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
    <div class="medals">${BADGES.filter(have).map((b) => `<div class="medal got" title="${b.desc}"><span>${b.icon}</span><small>${b.name}</small></div>`).join('') || '<div class="muted">まだ メダルは ないよ。がんばって ゲットしよう!</div>'}</div>
    <details><summary><b>🔒 まだの メダル(${BADGES.length - n})</b></summary>
      <div class="mlist">${BADGES.filter((b) => !have(b)).map((b) => { const c = medalChallenge(b, k, p); return `<div class="mrow"><span>${b.icon}</span><div><b>${b.name}</b><small>${b.desc}</small></div>${c ? `<button class="btn small gold mgo" data-act="medalgo" data-id="${b.id}">▶ ${c.label}</button>` : ''}</div>`; }).join('')}</div></details></section>`;
}
// まだの メダルに「チャレンジ」: たりない ないように すぐ とりくめる(れんしゅう・たいかい・ガチャ などへ)
function medalChallenge(b, k, p) {
  const id = b.id; let m;
  const prac = (uid, label) => (byId[uid] ? { act: 'start', mode: 'practice', unit: uid, label } : null);
  const today = { act: 'start', mode: 'daily', label: 'きょうの しあいへ' };
  if ((m = id.match(/^kuku_d(\d)$/))) return prac(`g2_kuku_${m[1]}`, `${m[1]}の だんを れんしゅう`);
  if (id === 'kuku_all') return prac('g2_kuku_all', '九九を れんしゅう'); if (id === 'kuku_inv') return prac('g2_kuku_inv', '□を さがせ');
  if ((m = id.match(/^ok_(.+)$/)) || (m = id.match(/^n(?:50|200)_(.+)$/))) return prac(m[1], 'れんしゅうする');
  if ((m = id.match(/^m(?:10|20)?_(.+)$/)) && SUBJECTS.includes(m[1])) { // ○○の プロ・たつじん・はかせ: まだ「できた」に なって いない たんげんを
    const us = skillsUpTo(k.grade).filter((u) => u.subject === m[1] && status(p, u.id) !== 'ok' && !u.geo);
    const u = us.sort((x, y) => ({ gap: 0, shaky: 1, sprout: 2, unknown: 3 }[status(p, x.id)] - { gap: 0, shaky: 1, sprout: 2, unknown: 3 }[status(p, y.id)]) || x.grade - y.grade)[0];
    return u ? { act: 'start', mode: 'practice', unit: u.id, label: `${u.name}を れんしゅう` } : { act: 'start', mode: 'daily', label: `${m[1]}を がんばる` };
  }
  if (/^hyp\d+$/.test(id) || /^ov\d+$/.test(id)) return { act: 'start', mode: 'weak', label: 'じゃくてんに チャレンジ' };
  if (/^time\d*$/.test(id)) return { act: 'start', mode: 'back', label: 'タイムマシンへ' };
  if (/^cup_/.test(id) || /^titles\d+$/.test(id)) return { act: 'tab', tab: 'team', sub: 'cup', label: 'たいかいへ' };
  if (/^win\d+$/.test(id) || /^pk\d+$/.test(id)) return { act: 'tab', tab: 'team', sub: 'battle', label: 'たいせんへ' };
  if (/^dex\d+$/.test(id) || /^legend\d+$/.test(id)) return { act: 'tab', tab: 'gacha', label: 'ガチャへ' };
  if (/^enh/.test(id)) return { act: 'tab', tab: 'team', sub: 'power', label: 'つよくなる へ' };
  if (/^try\d+$/.test(id)) return { act: 'start', mode: 'endless', label: 'むげんチャレンジ' };
  if (/^(goal|day|hat|perfect|rank|comeback)/.test(id)) return id === 'comeback' ? today : (/^goal/.test(id) ? { act: 'start', mode: 'endless', label: 'むげんチャレンジ' } : today);
  return today;
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
    ${weakChallengeBtn(k, p)}
    ${infChallengeBtn(k, p)}
    ${godCard(k, p)}
    ${left > 0 ? `<button class="event-btn" data-act="start" data-mode="bonus"><small>SPECIAL STAGE</small><b>🌟 かくれステージ</b><span>のこり ${left} ・ ポイント 2ばい ・ あせらなくて OK</span></button>` : ''}
    ${medalShelf(k, p)}
    ${selfCfgCard(k)}`;
}

// 「じゃくてんに チャレンジ」: まちがえた ないようの ふくしゅう
function weakCount(k, p) {
  const keys = new Set((p.revenge || []).filter((r) => byId[r.unit]).map((r) => `${r.unit}|${JSON.stringify(r.spec)}`));
  const act = activeList(p).filter((h) => byId[h.unit]).length;
  const wu = skillsUpTo(k.grade).filter((u) => ['gap', 'shaky'].includes(status(p, u.id))).length;
  return keys.size + act + wu;
}
function infChallengeBtn(k, p) {
  const I = infOf(p); const left = infPool(k).length; const total = left + Object.keys(I.cleared).length;
  const state = I.count ? `${I.round}しゅうめ ・ クリア ${Object.keys(I.cleared).length} / ${total}もん ・ つづきから` : `まだ ${left}もん ・ ぜんぶ でるよ`;
  return `<button class="inf-btn" data-act="start" data-mode="endless"><small>INFINITE CHALLENGE</small><b>♾️ むげんチャレンジ</b><span>${left ? `まだ できて ない もんだいを ぜんぶ ・ とちゅうで やめても きろくは のこるよ<br>${state}` : 'ぜんぶ「できた」! すごい!'}</span></button>`;
}
function weakChallengeBtn(k, p) {
  const n = weakCount(k, p); const soft = cfg().soft || cfg().gentle;
  if (!n) return `<div class="weak-btn off"><small>CHALLENGE</small><b>💪 ${soft ? 'のびしろに チャレンジ' : 'じゃくてんに チャレンジ'}</b><span>まだ ありません。まちがえた もんだいが たまると ここで ふくしゅう できるよ</span></div>`;
  return `<button class="weak-btn" data-act="start" data-mode="weak"><small>CHALLENGE</small><b>💪 ${soft ? 'のびしろに チャレンジ' : 'じゃくてんに チャレンジ'}</b><span>まちがえた ないようを ふくしゅう ・ いま ${n}こ ${cfg().gentle ? '・ ヒントつきだから あんしん' : ''}</span></button>`;
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
  if (tab === 'train') body = (cfg().gentle ? '' : labCard(k, p)) + kukuCard(k, p) + shapeCard(k, p) + timeMachineCard(k, p) + practiceCard(k, p);
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
    <div class="muted">✅ほんとに できた 🌱できたかも(もう1かい せいかいで ✅) 🔸あやしい 🔻ぬけてる ⬜まだ</div>
    ${todo + weak.length + due > 0 ? '<button class="match-btn alt" data-act="start" data-mode="back"><small>TIME MACHINE</small><b>⏪ タイムマシンに のる</b><span>5もん ・ むかしの ぬけを さがす</span></button>' : '<b>ぜんぶ チェックずみ! すごい!</b>'}
  </section>`;
}

function vQuiz() {
  const k = kidOf(); const it = Q.items[Q.i]; const q = it.q;
  const tx = T(cfg());
  // 「あと なんもん」は もとの もんだい数で かぞえる(まちがえて ふえる「やりなおし」は べつに ひょうじ)
  const baseN = Q.items.filter((x) => !x.retry).length;
  const baseI = Q.items.slice(0, Q.i + 1).filter((x) => !x.retry).length;
  const baseLeft = baseN - baseI;
  const retryLeft = Q.items.slice(Q.i + 1).filter((x) => x.retry).length;
  const inf = Q.mode === 'endless' ? infOf(S.kids[k.id]) : null;
  const remain = inf ? `♾️ これまでに ${inf.count}もん クリア` : it.retry ? (retryLeft > 0 ? `やりなおし あと ${retryLeft}もん` : 'これが ほんとに さいごの 1もん') : (baseLeft > 0 ? `あと ${baseLeft}もん` : 'これが さいごの もんだい') + (retryLeft > 0 ? ` + やりなおし ${retryLeft}もん` : '');
  const pct = Math.round((Q.i / Q.items.length) * 82);
  const a = Q.answered;
  const locked = !a && Date.now() < Q.lockUntil;
  $app.innerHTML = `
    <div class="quiz-top"><button class="link" data-act="quit">🛋️ やすむ</button>
      <div class="scoreboard"><span class="sb-l">⚽ <b>${Q.good}</b></span><span class="sb-m">${inf ? `♾️<small>${inf.count}</small>` : it.retry ? 'やりなおし' : `${baseI}<small>/${baseN}</small>`}</span>
        <span class="sb-r">${it.revenge || it.rkey ? '⭐ リベンジ' : Q.mode === 'endless' ? '♾️ むげん' : Q.mode === 'weak' ? '💪 じゃくてん' : tx.mode[Q.mode === 'bonus' ? 'bonus' : Q.mode === 'back' ? 'back' : it.retry ? 'retry' : (it.probe || Q.mode === 'hyp') ? 'probe' : 'normal']}</span></div><span class="clock"></span></div>
    <div class="remain">${remain}</div>
    <div class="pitch"><span class="ball" style="left:calc(${pct}% + 6px);transform:rotate(${Q.i * 150}deg)">⚽</span><span class="goal">🥅</span></div>
    <div class="dots">${Q.items.map((x, i) => `<i class="${x.res || ''} ${i === Q.i ? 'cur' : ''}"></i>`).join('')}</div>
    <main><section class="panel qpanel">
      <div class="q ${qplain(q.text).length > 40 ? 'long' : ''}">${q.text}</div>
      <div style="text-align:center"><button class="btn small gray" data-act="speak">🔊 よみあげ</button></div>
      ${locked ? '<div id="wait" class="muted" style="text-align:center">👀 もんだいを よく よんでね…</div>' : ''}
      ${!a && it.tried ? '<div class="gnote">🌱 だいじょうぶ! もういちど えらんで みよう。ためして みるのが すごいよ。</div>' : ''}
      <div class="choices">
        ${q.choices.map((c, idx) => { const out = !a && (it.hinted || []).includes(idx); return `<button class="choice ${a ? (c.ok ? 'ok' : a.idx === idx ? (a.gentle ? 'try' : 'ng') : (a.gentle && (it.tried || []).includes(idx) ? 'try' : '')) : ''} ${out ? 'out' : ''}" data-act="ans" data-idx="${idx}" ${a || locked || out ? 'disabled' : ''}>${c.label}</button>`; }).join('')}
      </div>
      ${a ? feedback(q, a) : `<div class="row" style="margin-top:14px">
        ${(cfg().hint || cfg().gentle) && q.choices.length - (it.hinted || []).length > 2 ? '<button class="btn small gold" data-act="hint">💡 ヒント(ひとつ けす)</button>' : ''}
        ${cfg().gentle ? '' : '<button class="btn small gray" data-act="idk">🤔 わからない</button>'}
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
const hypLines = (evs0) => { const evs = cfg().gentle ? (evs0 || []).filter((e) => e.type === 'resolved') : evs0; return (evs && evs.length ? `<div class="hypnote">${evs.map((e) => `<p>${hypLine(e)}</p>`).join('')}</div>` : '') };

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
    return `<div class="fb good"><b>${tx.ok} ${Q.combo >= 3 ? tx.combo(Q.combo) : ''}${Q.items[Q.i].tried ? ' もういちど えらべて えらい!' : ''}</b>
      <p>+${a.xp} ポイント${a.rep ? `(🇯🇵 代表ボーナス +${a.rep} こみ)` : ''}</p><p class="muted">${q.why}</p>${hypLines(a.hyp)}</div>${next}`;
  }
  if (a.gentle) { // まちがいが にがて モード: せめない・さきに せいかいを おしえる・すぐ つぎへ
    return `<div class="fb gentle"><b>${tx.ng}</b>
      <p><b>せいかいは:</b> ${q.choices.find((c) => c.ok).label}</p><p class="muted">${q.why}</p>
      <p class="muted">まちがえると、あたまが ぐんぐん そだつよ。ちょうせん ポイント +${a.effort || 0}!</p>${hypLines(a.hyp)}</div>
      <div class="row"><button class="btn small gray" data-act="ask">👨 パパに きく</button></div>
      <button class="btn gold" data-act="next">${last ? '🏁 けっかを みる' : 'つぎへ ▶'}</button>`;
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

const TK_NAME = { bronze: '🥉ブロンズ', silver: '🥈シルバー', gold: '🥇ゴールド', platinum: '💎プラチナ', god: '🎫神' };
const STAT_JA = { SHO: 'シュート', PAS: 'パス', SPD: 'スピード', DEF: 'まもり', STA: 'スタミナ' };
function rewardPanel(R) {
  const tk = Object.entries(R.tickets || {}).filter(([, v]) => v);
  const pts = Object.entries(R.pts || {}).filter(([, v]) => v);
  if (!tk.length && !pts.length && !R.capped && !R.shards) return '';
  return `<section class="panel gold"><h2 class="sec">REWARD <small>ごほうび</small></h2>
    ${tk.length ? `<div class="reward-row">${tk.map(([k, v]) => `<span class="chip gold">${TK_NAME[k]} ×${v}</span>`).join(' ')} <small class="muted">ガチャで つかえるよ</small></div>` : `<div class="muted">${R.capped ? 'きょうは もう たくさん チケットを もらったよ。また あした!' : '6わり いじょう せいかいで チケットが もらえるよ(つぎは がんばろう!)'}</div>`}
    ${R.shards ? `<div class="reward-row"><span class="chip">💠 ダイヤの かけら +${R.shards}</span> <small class="muted">「チーム → ダイヤ」で つかうよ</small></div>` : ''}
    ${pts.length ? `<div class="reward-row">${pts.map(([k, v]) => `<span class="chip">${STAT_JA[k]} +${v}pt</span>`).join(' ')} <small class="muted">「チーム → つよく」で つかえるよ</small></div>` : ''}</section>`;
}

function vResult() {
  const k = kidOf(); const p = S.kids[k.id]; const R = Q.result;
  const tx = T(cfg());
  const stars = cfg().gentle ? 3 : Math.max(1, R.good / R.total >= 1 ? 3 : R.good / R.total >= 0.6 ? 2 : R.good / R.total >= 0.3 ? 1 : 0); // さいごまで やったら 星は 1つ いじょう(まちがいが にがてな 子は いつも 3つ)
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
    ${cfg().gentle ? '' : hypResultPanel(R)}
    ${R.newBadges.map((b) => `<section class="panel gold medal-new"><div class="big">${b.icon}</div><h2 class="center">NEW MEDAL!<br>${b.name}</h2></section>`).join('')}
    ${call}${ranked}${cfg().gentle ? '' : found}${cfg().gentle ? '' : weak}
    ${cfg().breakAfter ? '<section class="panel"><h2 class="sec">REST <small>きゅうけい</small></h2><div class="muted">がんばったね。1ぷん やすもう(みずを のむ・のびを する)。つづけても、おわっても いいよ。</div><button class="btn gray" data-act="rest">🍃 1ぷん やすむ</button></section>' : ''}
    <p class="muted center">これで ひとつ おわり。ホームに もどれるよ。</p>
    <button class="btn gold" data-act="kid">ホームに もどる</button></main>`;
}

const CFG_LABEL = {
  calm: '🐢 うごき・ひかり・紙ふぶきを へらす', quiet: '🔇 おと・ふるえを けす', plain: '💬 たとえを つかわない(そのままの ことば)',
  preview: '📋 はじめる まえに「やること」を みせる(じゅんばんも おなじ)', soft: '🌱 「できなかった」を みせない(ひかえ・からの まるを かくす)',
  schedule: '🗓️ 「きょうの やること」リストを ホームに だす', breakAfter: '🍃 1セットごとに きゅうけいを すすめる', big: '🔠 おおきい もじ',
  forgive: '🏆 たいかいで まけても、おなじ しあいから やりなおせる',
  gentle: '🌱 まちがえても だいじょうぶ モード(はじめての まちがいは もういちど えらべる・赤い ×や ブザーなし・「ためして みたね」と ほめる)', easyStart: '🌟 1もんめと さいごは「できた」たんげんの やさしい もんだい',
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
      ${(() => { const al = asksOf(k); return al.length ? al.map((a) => `<p style="white-space:pre-wrap;border-left:4px solid #ffcc00;padding-left:8px">${a.date} ${esc(a.text)}${a.remote ? ' <small class="muted">(スマホから とどいたよ)</small>' : ''}<br><button class="btn small gray" data-act="askdone" data-id="${k.id}" data-aid="${a.id}">✅ おしえたよ</button></p>`).join('') : '<p class="muted">しつもんは ないよ</p>'; })()}
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
  const updCard = `<div class="card"><h2>🔄 アプリの バージョン</h2>
    <p class="muted">いまの バージョン: <b>${VERSION}</b> ・ プレゼントや あたらしい きのうが とどかない ときは、「さいしんに こうしん」を おしてね(ほぞんした きろくは けさないよ)。</p>
    <button class="btn small gold" data-act="forceupdate">🔄 さいしんに こうしん</button></div>`;
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
  const godList = godPending();
  const godCardP = `<div class="card"><h2>🎫 神チケット(おしらせ)</h2>${godList.length ? godList.map((r) => `<p style="border-left:4px solid #ffcc00;padding-left:8px"><b>${esc(r.kid.name)}</b>が ${r.date} に 1日 ${r.n}もん たっせい! 🎫神チケットを 1まい ゲットしたよ<br><button class="btn small gray" data-act="godseen" data-gid="${r.id}">✅ みたよ</button></p>`).join('') : '<p class="muted">あたらしい おしらせは ないよ(1日 100もん=はじめて+まちがえた もんだい で 神チケットが じどうで くばられるよ)</p>'}</div>`;
  $app.innerHTML = `<div class="quiz-top"><button class="link" data-act="home">← もどる</button><span class="mode">👨 パパの へや</span><span></span></div><main>${godCardP}${updCard}${pinCard}${cfgCard()}${hypReport()}${ownerCard}${repAdmin}${syncCard}${tagRows}
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
  const built = buildSet(k, mode, unitId);
  if (!built.length) { toast('ぜんぶ「できた」! すごい!'); return; }
  Q = { mode, items: built, i: 0, good: 0, xp: 0, combo: 0, hat: false, answered: null, retries: 0, lockUntil: 0, pts: {}, missTags: {}, startXp: S.kids[k.id].xp };
  if (cfg().preview && mode !== 'endless') { view = 'preview'; toTop = true; render(); return; } // はじめる まえに「やること」を みせる
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

// ---- リベンジ(まちがいを のりこえる): まちがえた もんだいは、あとで ヒントつきで もういちど。2かい べつの 日に できたら「のりこえた」 ----
const ymd = (d) => dstr(d);
const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };
function addRevenge(p, it, q, tag) {
  if (it.retry && !it.rkey) return;                 // さっきの リベンジ(おなじ セット)は あたらしく ふやさない
  const spec = q.id ? { itemId: q.id } : (tag && tag !== 'unknown' && tag !== 'know_mixup' ? { tag } : null);
  if (!spec) return;
  p.revenge = p.revenge || [];
  const key = `${it.unit.id}|${spec.itemId || spec.tag}`;
  const r = p.revenge.find((x) => x.key === key);
  if (r) { r.miss++; r.due = addDays(1); return; }
  p.revenge.push({ key, unit: it.unit.id, spec, ok: 0, miss: 1, due: addDays(1), first: todayStr() });
  p.revenge = p.revenge.slice(-30);
}
const dueRevenge = (p, n) => (p.revenge || []).filter((r) => r.due <= todayStr() && byId[r.unit]).sort((a, b) => a.due.localeCompare(b.due)).slice(0, n);
const assistOne = (q) => { const w = q.choices.map((c, i) => i).filter((i) => !q.choices[i].ok); return w.length > 1 ? [w[Math.floor(Math.random() * w.length)]] : []; };
function answer(idx, unknown) {
  const k = kidOf(); const p = S.kids[k.id]; const it = Q.items[Q.i]; const q = it.q;
  if (Q.answered) return;
  if (!unknown && Date.now() < Q.lockUntil) return;
  const c = unknown ? null : q.choices[idx];
  const ok = !!(c && c.ok);
  const tag = ok ? null : unknown ? 'unknown' : c.tag;
  if (ok && it.inf) { // むげんチャレンジ: できた もんだいは きろく(やめても つづきから)
    const I = infOf(p); const t0 = todayStr();
    if (!I.cleared[it.inf]) { I.cleared[it.inf] = 1; I.count++; if (I.count % 50 === 0) { addTickets(p, { bronze: 1 }); Q.infTicket = (Q.infTicket || 0) + 1; } }
    if (!p.days.includes(t0)) p.days.push(t0); p.lastDate = t0;
  }
  const gentle = !!cfg().gentle; const second = !!it.tried; // まちがいが にがて モード: はじめての まちがいは せめず、もういちど えらべる
  const u = (p.units[it.unit.id] = p.units[it.unit.id] || { ok: 0, ng: 0, h: [] });
  u.h = (u.h || []).concat(ok ? 1 : 0).slice(-6);
  if (q.id) { p.seen = [...(p.seen || []).filter((x) => x !== q.id), q.id].slice(-300); setSeen(p.seen); }
  if (ok) { u.d = u.d || []; if (!u.d.includes(todayStr())) u.d.push(todayStr()); u.d = u.d.slice(-5); }
  if (it.retry) { p.rt = p.rt || { ok: 0, ng: 0 }; p.rt[ok ? 'ok' : 'ng']++; }
  if (!ok && !it.retry && !second) p.tries = (p.tries || 0) + 1; // まちがえても ためして みた かず(メダル「ためして みた」)
  // まちがえ方から「かせつ」を たてる / たしかめる(罠を えらべば こんきょ、せいかいは はんする しょうこ)
  const evs = observe(p, { unitId: it.unit.id, q, choice: c, ok, today: todayStr(), immediate: !!it.retry || second });
  if (it.hkey) noteProbe(p, it.hkey, todayStr());
  Q.hyp = (Q.hyp || []).concat(evs);
  for (const e of evs) if (e.type === 'resolved') { p.hypResolved = (p.hypResolved || 0) + 1; Q.xp += 30; } // のりこえた おいわい
  if (gentle && !ok && !unknown && !second) { // はじめての まちがい: おこらず、えらんだ ものを けして もういちど
    u.ng++; Q.combo = 0; p.tags[tag] = (p.tags[tag] || 0) + 1; Q.missTags[tag] = (Q.missTags[tag] || 0) + 1;
    it.tried = [idx]; it.hinted = [...(it.hinted || []), idx]; Q.xp += 4; // ちょうせん ポイント
    addRevenge(p, it, q, tag);   // あとで ヒントつきで もういちど ちょうせん(のりこえる ため)
    beep('try'); floaty('ためしたね!', lastTap.x, lastTap.y - 24);
    save(); render(); return;
  }
  godHook(p, it, q, ok);
  if (ok) {
    u.ok++; Q.good++; if (!second) Q.combo++;
    let xp = 10 * (Q.mode === 'bonus' ? 2 : 1);
    if (second) xp = Math.max(5, Math.round(xp / 2)); // 2かいめで できた ときも ちゃんと ポイント
    if (Q.combo === 3 && !second) { xp += 10; Q.hat = true; }
    const rep = repBonus(k); xp += rep;
    if (it.unit.grade < k.grade) xp = Math.max(2, Math.round(xp / 2)); // まえの がくねんは ポイントが はんぶん
    Q.xp += xp; p.goals++; it.res = 'ok';
    const st = addPoints(p, it.unit.subject, 2); if (st) Q.pts[st] = (Q.pts[st] || 0) + 2;
    if (it.rkey) { // リベンジの せいこう: 2かい(べつの 日)で「のりこえた」
      const r = (p.revenge || []).find((x) => x.key === it.rkey);
      if (r && !it.tried) {
        r.ok++; r.due = addDays(3); xp += 10; Q.rev = (Q.rev || 0) + 1;
        if (r.ok >= 2) { p.revenge = p.revenge.filter((x) => x !== r); p.overcome = (p.overcome || 0) + 1; xp += 20; Q.overcome = (Q.overcome || 0) + 1; }
      }
    }
    Q.xp += 0;
    Q.answered = { ok, idx, xp, rep, hyp: evs, revenge: !!it.rkey, overcome: !!(it.rkey && !(p.revenge || []).some((x) => x.key === it.rkey)) };
    beep('ok'); vibrate(25); confetti(lastTap.x, lastTap.y, Q.combo >= 3 ? 70 : 26, Q.combo >= 3 ? 1.3 : 0.8); floaty(`+${xp}`, lastTap.x, lastTap.y - 24);
  } else {
    if (!second) { u.ng++; Q.combo = 0; p.tags[tag] = (p.tags[tag] || 0) + 1; Q.missTags[tag] = (Q.missTags[tag] || 0) + 1; }
    if (it.rkey) { const r = (p.revenge || []).find((x) => x.key === it.rkey); if (r) { r.due = addDays(1); r.miss++; } } else if (!second) addRevenge(p, it, q, tag); // まちがえた もんだいは ぜんいん おぼえておく(「じゃくてんに チャレンジ」で つかう)
    if ((gentle ? Q.retries < 1 : Q.retries < 3) && !it.retry) {
      Q.retries++;
      // やりなおしは、おなじ 罠が 入った 問題(かせつの たしかめ)。数字は かわる
      const spec = tag && tag !== 'unknown' && tag !== 'know_mixup' ? { tag } : null;
      let nq; for (let t = 0; t < 8; t++) { nq = spec ? makeProbe(it.unit, spec) : makeQuestion(it.unit); if (nq.text !== q.text) break; }
      if (nq.text === q.text) nq = makeQuestion(it.unit);
      nq = limitQ(nq, cfg().choices, spec && spec.tag);
      const entry = { unit: it.unit, q: nq, retry: true };
      if (gentle) { entry.revenge = true; entry.hinted = assistOne(nq); Q.items.push(entry); } // さいごに「リベンジ」(ヒントつき)
      else Q.items.splice(Q.i + 1, 0, entry);
    }
    Q.xp += gentle ? 4 : 2; Q.answered = { ok, idx, tag, effort: gentle ? 4 : 2, hyp: evs, gentle }; it.res = gentle ? 'try' : 'ng'; // ちょうせん ポイント(まちがえても ゼロに しない)
    if (gentle) beep('try'); else { beep('ng'); vibrate([40, 40, 40]); }
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
  // ダイヤの かけら(べんきょうの せいかで たまる)
  let shards = 0;
  for (const e of Q.hyp || []) if (e.type === 'resolved') shards += 3;                   // かせつを のりこえた
  p.okSeen = p.okSeen || {};
  for (const id of new Set(Q.items.map((x) => x.unit.id))) if (status(p, id) === 'ok' && !p.okSeen[id]) { p.okSeen[id] = 1; shards += 2; } // たんげんが「できた」
  shards += newly.length;                                                                  // あたらしい メダル
  if (perfectNow) shards += 1;
  shards += (Q.overcome || 0) * 2; // リベンジで のりこえた ぶん
  { const wk = (() => { const d = new Date(); const j = new Date(d.getFullYear(), 0, 1); return `${d.getFullYear()}-${Math.floor(((d - j) / 864e5 + j.getDay()) / 7)}`; })();
    const recent = p.days.filter((x) => dayNum(t) - dayNum(x) <= 6).length;
    if (recent >= 5 && p.wkShard !== wk) { p.wkShard = wk; shards += 5; } }                // 1しゅうかんで 5日 れんしゅう
  if (shards) addShards(p, shards);
  const info = { good: Q.good, total: Q.items.length, mode: Q.mode, perfect: perfectNow };
  const gotTickets = awardStudy(p, info, t);
  const capped = !Object.keys(gotTickets).length && Object.keys(studyReward(info)).length > 0;
  save();
  const selAfter = dataFor(k).sel.state;
  const tags = Object.entries(Q.missTags).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([x]) => x).filter((x) => x !== 'unknown' || Object.keys(Q.missTags).length === 1);
  Q.result = { good: Q.good, total: Q.items.length, xp: bonusXp, hat: Q.hat, tags, rankUp: after.i > before.i, rankName: after.name, callup: selBefore !== 'in' && selAfter === 'in', newBadges: newly.map((b) => ({ icon: b.icon, name: b.name })), tickets: gotTickets, capped, shards, overcome: Q.overcome || 0, pts: Q.pts, hyp: (Q.hyp || []).map((e) => ({ type: e.type, label: hypLabel(e.h) })) };
  lastCount.score = 0;
  view = 'result'; toTop = true; render();
  if (Q.result.good >= Math.ceil(Q.result.total * 0.6) || Q.result.rankUp || Q.result.callup || Q.result.newBadges.length || Q.result.hyp.some((e) => e.type === 'resolved')) {
    setTimeout(() => { confetti(innerWidth / 2, innerHeight * 0.32, 110, 1.5); beep('win'); vibrate([60, 40, 60, 40, 120]); }, 400);
  }
  syncNow();
}

function askPapa() {
  const k = kidOf(); const p = S.kids[k.id]; const it = Q.items[Q.i]; const q = it.q;
  const body = `${plainText(q.text)}\n(${q.choices.map((c) => plainText(c.label)).join(' / ')})`;
  const text = `【パパにきく】${k.name}(${k.grade}ねん)\n${body}`;
  p.ask.unshift({ id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, t: Date.now(), date: todayStr(), text: `${k.name}:\n${body}` });
  p.ask = p.ask.slice(0, 30); save();
  if (sync.enabled()) { syncNow(); toast('パパの スマホに おくったよ!(パパが アプリを ひらくと とどくよ)'); return; }
  // つながって いない ときは、LINEなどで パパに おくれる ように する
  if (navigator.share) navigator.share({ text }).catch(() => {});
  else if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
  toast('しつもんを とっておいたよ。パパの スマホに とどけるには「パパの へや」で つなぐ せっていが ひつようだよ');
}

document.addEventListener('click', (e) => {
  lastTap = { x: e.clientX || innerWidth / 2, y: e.clientY || innerHeight / 2 };
  const el = e.target.closest('[data-act]'); if (!el) return;
  if (/^(SELECT|OPTION|INPUT|TEXTAREA)$/.test(e.target.tagName) || /^(SELECT|INPUT|TEXTAREA)$/.test(el.tagName)) return; // えらぶ とちゅうで がめんを つくりなおすと、プルダウンが とじて しまう
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
  else if (a === 'medalgo') { const b = BADGES.find((x) => x.id === el.dataset.id); const c = b && medalChallenge(b, kidOf(), S.kids[kidId]); if (!c) return; toTop = true; if (c.act === 'start') return startQuiz(c.mode, c.unit); tab = c.tab; view = 'kid'; if (c.sub) gameAct('sub', { dataset: { sub: c.sub } }); }
  else if (a === 'quit') {
    const endless = Q && Q.mode === 'endless';
    if (!confirm(endless ? 'ここで やめる?(ここまでの きろくは のこるよ。つぎは つづきから!)' : 'ここで ひとやすみ する?(ここまでの ポイントは とっておくよ)')) return;
    const pq = S.kids[kidId];
    if (endless) { const kq = kidOf(); const nb = BADGES.filter((b) => !(pq.badges || []).includes(b.id) && b.cond(pq, kq)); pq.badges = [...(pq.badges || []), ...nb.map((b) => b.id)]; if (nb.length) { addShards(pq, nb.length); toast(`🏅 あたらしい メダル ${nb.map((b) => b.name).join('・')}`); } else toast(`♾️ ${infOf(pq).count}もん クリア! つづきは また こんど`); save(); }
    if (Q && Q.xp) { pq.xp += Q.xp; Q.xp = 0; save(); toast('ここまでの ポイントは とっておいたよ'); }
    view = 'kid'; toTop = true;
  }
  else if (a === 'ans') return answer(Number(el.dataset.idx));
  else if (a === 'idk') return answer(null, true);
  else if (a === 'ask') return askPapa();
  else if (a === 'speak') return speak(Q.items[Q.i].q.text);
  else if (a === 'hint') { const it = Q.items[Q.i]; it.hinted = it.hinted || []; const cand = it.q.choices.map((c, i) => i).filter((i) => !it.q.choices[i].ok && !it.hinted.includes(i)); if (cand.length && it.q.choices.length - it.hinted.length > 2) { it.hinted.push(cand[Math.floor(Math.random() * cand.length)]); Q.hints = (Q.hints || 0) + 1; beep('ok'); } }
  else if (a === 'next') { Q.answered = null; Q.i++; if (Q.i >= Q.items.length) { if (Q.mode === 'endless') { Q.items = buildInf(kidOf(), 10); Q.i = 0; Q.retries = 0; if (!Q.items.length) { toast('ぜんぶ「できた」! すごい!'); view = 'kid'; toTop = true; render(); return; } } else return finish(); } Q.lockUntil = Date.now() + lockMs(Q.items[Q.i].q); toTop = true; }
  else if (a === 'synccode') { document.getElementById('synccode').value = sync.newCode(); return; }
  else if (a === 'syncsave') {
    const db = document.getElementById('syncdb').value; const fc = document.getElementById('synccode').value;
    if (!sync.validCfg(db, fc)) return toast('URL(https://〜)と コード(10もじいじょう)を いれてね');
    sync.setCfg(db, fc); toast('つないだよ!'); syncNow(); return;
  }
  else if (a === 'forceupdate') {
    toast('こうしん ちゅう…');
    (async () => { try { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); for (const k of await caches.keys()) await caches.delete(k); } catch { /* ignore */ } location.reload(); })();
    return;
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
  else if (a === 'godseen') { S.ack = [...(S.ack || []), el.dataset.gid].slice(-120); save(); syncNow(); }
  else if (a === 'askdone') { const aid = el.dataset.aid; const pp = S.kids[el.dataset.id]; pp.ask = (pp.ask || []).filter((x) => x.id !== aid); S.ack = [...(S.ack || []), aid].slice(-120); save(); syncNow(); }
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
  KIDS, kid: () => kidOf(), p: () => S.kids[kidId], cfg: () => cfg(), quiet: () => quiet(), render: () => render(), toast, save, today: todayStr, BADGES,
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

// プレゼント(パパから)
try {
  const r = await fetch('data/gifts.json', { cache: 'no-cache', signal: AbortSignal.timeout(4000) });
  if (r.ok) GIFTS = (await r.json()).gifts || [];
} catch { /* オフラインなど */ }

// 都道府県・せかいの くにの かたち(かたちクイズ)
try {
  const r = await fetch('data/geo.json', { cache: 'no-cache', signal: AbortSignal.timeout(4000) });
  const fr = await fetch('data/flags.json', { cache: 'no-cache', signal: AbortSignal.timeout(4000) }).catch(() => null);
  if (r.ok) registerGeo(await r.json(), fr && fr.ok ? await fr.json() : null);
} catch { /* オフラインなど */ }

// ---- いままでの がんばりぶんの ダイヤの かけらを 1かいだけ くばる ----------------------------------------
// (ダイヤモンドが できる まえに ためた ぶん: できた たんげん・のりこえた かせつ・メダル・パーフェクト・れんしゅうの 週・たいかい)
const weekKeyOf = (ds) => { const [y, m, d] = ds.split('-').map(Number); const dt = new Date(y, m - 1, d); const j = new Date(y, 0, 1); return `${y}-${Math.floor(((dt - j) / 864e5 + j.getDay()) / 7)}`; };
function migrateShards() {
  for (const k of KIDS) {
    const p = S.kids[k.id]; if (p.shardMig) continue; p.shardMig = 1;
    let n = 0; p.okSeen = p.okSeen || {};
    for (const id of Object.keys(p.units || {})) if (status(p, id) === 'ok' && !p.okSeen[id]) { p.okSeen[id] = 1; n += 2; }  // できた たんげん
    n += (p.hypResolved || 0) * 3 + (p.perfect || 0);                                                                          // のりこえた かせつ・パーフェクト
    const have = (b) => (p.badges || []).includes(b.id) || b.cond(p, k); n += BADGES.filter(have).length;                      // メダル
    const byWeek = {}; for (const d of p.days || []) { const w = weekKeyOf(d); byWeek[w] = (byWeek[w] || 0) + 1; }
    n += Object.values(byWeek).filter((c) => c >= 5).length * 5;                                                              // 1しゅうかんで 5日 れんしゅうした 週
    if ((byWeek[weekKeyOf(todayStr())] || 0) >= 5) p.wkShard = weekKeyOf(todayStr()); // こんしゅうの ぶんは さらに もらわない
    const c = ensureCup(p); c.firsts = c.firsts || {};                                                                           // たいかい
    for (const id of c.cleared) { const cup = cupById(id); if (cup) cup.rounds.forEach((_, i) => { c.firsts[`${id}:${i}`] = 1; }); }
    if (c.run) for (let r = 0; r < c.run.round; r++) c.firsts[`${c.run.id}:${r}`] = 1;
    n += Object.keys(c.firsts).length + c.cleared.length * 10;
    if (n) addShards(p, n);
    p.shardGift = n;
  }
  save();
}
migrateShards();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
render();
syncNow(); // ひらいた ときに じぶんの きろくを おくり、かぞくの きろく・しつもんを うけとる
