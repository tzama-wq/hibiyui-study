import * as sync from './sync.js';
import { TAGS, unitsOf, skillsUpTo, byId, currentUnits, makeQuestion, shuffle, registerKokugo, registerKnowledge, setSeen } from './gen.js';

// ---- 設定 -----------------------------------------------------------------
const KIDS = [
  { id: 'hibito', name: 'ひびと', grade: 4, color: '#1e6bd6', em: '⚽' },
  { id: 'yuito', name: 'ゆいと', grade: 2, color: '#d6341e', em: '⚽' },
];
const RANKS = [
  [0, 'サッカーきょうしつ'], [100, 'ジュニアユース'], [300, 'ユースの エース'], [600, 'プロ1ねんめ'],
  [1000, 'Jリーガー'], [1600, 'にほんだいひょう'], [2500, 'ワールドカップの スター'],
];
const SET_SIZE = 5;
const MAX_BONUS = 3;

// ---- 保存 -----------------------------------------------------------------
const KEY = 'hibiyui.v1';
const newKid = () => ({ seen: [], xp: 0, goals: 0, days: [], lastDate: null, units: {}, tags: {}, ask: [], today: { date: null, sets: 0, bonusTotal: 0, bonusDone: 0 } });
const init = () => ({ kids: Object.fromEntries(KIDS.map((k) => [k.id, newKid()])), override: {} });
let S;
try { S = JSON.parse(localStorage.getItem(KEY)) || init(); } catch { S = init(); }
for (const k of KIDS) S.kids[k.id] = { ...newKid(), ...S.kids[k.id] };
S.override = S.override || {};
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

function buildSet(kid, mode, unitId) {
  const p = S.kids[kid.id];
  const sk = skillsUpTo(kid.grade);
  const cur = currentUnits(kid.grade, new Date().getMonth() + 1, S.override[kid.id]);
  let plan;
  if (mode === 'practice') plan = Array(SET_SIZE).fill(byId[unitId]);
  else if (mode === 'back') {
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
    plan = [cur[0], cur[1 % cur.length], ko || cur[2 % cur.length], kn || cur[2 % cur.length]];
    plan.push(c.length ? c[0] : weakPick(p, review.length ? review : sk));
    plan = shuffle(plan);
  }
  const seen = new Set();
  return plan.map((unit) => {
    let q;
    for (let t = 0; t < 8; t++) { q = makeQuestion(unit); if (!seen.has(q.text)) break; }
    seen.add(q.text);
    return { unit, q, retry: false };
  });
}

// ---- 画面状態 -------------------------------------------------------------
let kidId = S.bound || null;
let view = kidId ? 'kid' : 'setup';
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

// ---- きょうだい共有 ---------------------------------------------------------
const summary = (k) => { const p = S.kids[k.id]; return { name: k.name, grade: k.grade, xp: p.xp, goals: p.goals, days: p.days.length, rank: rankOf(p.xp).name, recent: p.days.slice(-14), callup: p.callup || null }; };
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
const bothIn = () => KIDS.every((x) => dataFor(x).sel.state === 'in');
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
  const ovr = Math.min(99, Math.round(avg) + rankOf(p.xp).i);
  return { stats, ovr, tier: ovr >= 80 ? 'legend' : ovr >= 65 ? 'gold' : ovr >= 50 ? 'silver' : 'bronze' };
}

function playerCard(k, p) {
  const ab = ability(k, p); const r = rankOf(p.xp);
  return `<section class="pcard tier-${ab.tier}">
    <div class="pc-shine"></div>
    <div class="pc-left"><div class="pc-ovr">${ab.ovr}</div><div class="pc-ovr-l">OVR</div><div class="pc-grade">${k.grade}ねん</div></div>
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
  return `<section class="panel"><h2 class="sec">TEAM <small>きょうだいチーム</small></h2>
    ${rows.map((r) => `<div class="mate" style="--kid:${r.k.color}">
      <div class="mate-ava">${r.k.em}</div>
      <div class="mate-main"><b>${r.d.name}</b><small>${r.d.grade}ねん ・ ${r.d.rank}${r.k.id === kidId ? ' ・ じぶん' : ''}</small>
        <div class="row"><span class="chip gold">⚽ ${r.d.goals}</span><span class="chip">📅 ${r.d.days}日</span>${r.sel.state === 'in' ? '<span class="chip red">🇯🇵 代表</span>' : '<span class="chip">🪑 ひかえ</span>'}</div>
        ${r.remote && S.remote[r.k.id].t ? `<small class="muted">${ago(S.remote[r.k.id].t)}の きろく</small>` : ''}</div></div>`).join('')}
    ${rows.every((r) => r.sel.state === 'in') ? '<div class="banner-red"><b>🇯🇵🇯🇵 ふたりそろって 日本代表!</b><small>せいかいごとの ボーナスポイントが ふえてるよ</small></div>' : ''}
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
  document.body.dataset.view = view;
  ({ setup: vSetup, kid: vKid, quiz: vQuiz, result: vResult, papa: vPapa })[view]();
  if (toTop) { window.scrollTo(0, 0); toTop = false; }
}

// このスマホは だれの? (さいしょの 1回だけ。パパが やる)
function vSetup() {
  $app.innerHTML = `<div class="hero"><div class="logo">⚽ HIBIYUI FC</div><h1>このスマホは だれの?</h1>
    <p class="sub">えらぶと、この スマホには その子の がめんだけが でるよ。<br>(かえるときは パパの PINが いるよ)</p></div>
    ${KIDS.map((k) => `<button class="kid-select" style="--kid:${k.color}" data-act="bind" data-id="${k.id}"><span class="ks-ava">${k.em}</span><span class="ks-name">${k.name}</span><span class="ks-sub">${k.grade}ねんせい</span></button>`).join('')}`;
}

function topBar(k, p) {
  const r = rankOf(p.xp);
  return `<header class="topbar"><div class="tb-ava">${k.em}</div><div class="tb-name"><b>${k.name}</b><small>${r.name}</small></div>
    <div class="tb-chips"><span class="chip gold">⚽ ${p.goals}</span><span class="chip">XP ${p.xp}</span></div>
    <button class="gear" data-act="papa" aria-label="パパの へや">⚙</button></header>`;
}
function navBar() {
  const items = [['home', '🏠', 'ホーム'], ['train', '🎯', 'れんしゅう'], ['team', '🤝', 'チーム'], ['time', '⏪', 'タイム']];
  return `<nav class="nav">${items.map(([t, i, l]) => `<button class="${tab === t ? 'on' : ''}" data-act="tab" data-tab="${t}"><span>${i}</span><small>${l}</small></button>`).join('')}</nav>`;
}

function repChip(k) {
  const sel = dataFor(k).sel;
  return sel.state === 'in'
    ? `<div class="rep-chip in">🇯🇵 日本代表に えらばれてるよ${bothIn() ? '(ふたりそろって!)' : ''}</div>`
    : sel.state === 'close' ? '<div class="rep-chip">🇯🇵 あと 1日 れんしゅうで 日本代表!</div>'
      : '<div class="rep-chip out">🪑 いまは ひかえ ― かんたんに もどれるよ(チームを みてね)</div>';
}

function homeTab(k, p) {
  const cur = currentUnits(k.grade, new Date().getMonth() + 1, S.override[k.id]);
  const left = p.today.bonusTotal - p.today.bonusDone;
  const welcome = p.today.gap > 0 && p.today.sets === 0
    ? `おかえり、${k.name}! まってたよ。きょうは かくれステージが ひらいてるよ 🌟`
    : p.today.sets > 0 ? `${k.name}、きょうも ナイスプレー!` : `${k.name}、きょうも キックオフ!`;
  return `${playerCard(k, p)}
    <div class="welcome">${welcome}</div>
    ${repChip(k)}
    <button class="match-btn" data-act="start" data-mode="daily"><small>TODAY'S MATCH</small><b>${p.today.sets > 0 ? 'もういっかい キックオフ!' : 'キックオフ!'}</b>
      <span>${p.today.sets > 0 ? '✅ きょうの しあい クリア ・ ' : '5もん ・ '}${cur.map((u) => u.name).join('、')}</span></button>
    ${left > 0 ? `<button class="event-btn" data-act="start" data-mode="bonus"><small>SPECIAL STAGE</small><b>🌟 かくれステージ</b><span>のこり ${left} ・ ポイント 2ばい ・ あせらなくて OK</span></button>` : ''}`;
}

function repCard(k, p) {
  const d = dataFor(k); const sel = d.sel; const need = needDays();
  const set = new Set(d.recent);
  const dots = Array.from({ length: WINDOW }, (_, i) => { const day = new Date(); day.setDate(day.getDate() - (WINDOW - 1 - i)); return set.has(dstr(day)) ? '🟢' : '⚪'; }).join(' ');
  const left = p.today.bonusTotal - p.today.bonusDone;
  let msg;
  if (sel.state === 'in') msg = `🇯🇵 <b>日本代表に えらばれてるよ!</b>${sel.called && sel.n < need ? '(追加招集)' : ''}<br><span class="muted">${bothIn() ? '🇯🇵🇯🇵 ふたりそろって 日本代表! ボーナスポイントが ふえてるよ' : 'もうひとりも えらばれると、ボーナスが もっと ふえるよ'}</span>`;
  else if (sel.state === 'close') msg = '<b>あと 1日!</b> れんしゅうすると 日本代表に えらばれるよ';
  else msg = `いまは 🪑 ひかえメンバー。だいじょうぶ、すぐ もどれるよ!<br><span class="muted">${left > 0 ? '🌟 かくれステージを 1つ クリアすると、すぐ 追加招集されるよ' : `あと ${need - sel.n}日 れんしゅうすると 日本代表に えらばれるよ`}</span>`;
  return `<section class="panel rep"><h2 class="sec">JAPAN <small>日本代表 せんしゅつ</small></h2>
    <div class="muted">この ${WINDOW}日で ${need}日 れんしゅうすると えらばれるよ</div>
    <div style="font-size:22px;margin:6px 0">${dots}</div>${msg}</section>`;
}

function vKid() {
  const k = kidOf(); const p = S.kids[k.id]; refreshDay(p);
  let body;
  if (tab === 'train') body = practiceCard(k, p);
  else if (tab === 'team') body = repCard(k, p) + siblingsCard();
  else if (tab === 'time') body = timeMachineCard(k, p);
  else body = homeTab(k, p);
  $app.innerHTML = `${topBar(k, p)}<main>${body}</main>${navBar()}`;
}

function practiceCard(k, p) {
  const btn = (u, label) => `<button class="btn gray" data-act="start" data-mode="practice" data-unit="${u.id}">${ICON[status(p, u.id)]} ${label}</button>`;
  const mine = unitsOf(k.grade);
  const earlier = skillsUpTo(k.grade).filter((u) => u.grade < k.grade);
  return `<section class="panel"><h2 class="sec">TRAINING <small>すきな れんしゅう</small></h2>
    ${SUBJECTS.filter((sj) => mine.some((u) => u.subject === sj)).map((sj) => `<details ${sj === '算数' ? 'open' : ''}><summary><b>${SUBJECT_ICON[sj]} ${sj}</b></summary>
      ${mine.filter((u) => u.subject === sj).map((u) => btn(u, u.name)).join('')}</details>`).join('')}
    <details><summary><b>⏪ まえの がくねんの れんしゅう</b></summary>
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
  const pct = Math.round((Q.i / Q.items.length) * 82);
  const a = Q.answered;
  const locked = !a && Date.now() < Q.lockUntil;
  $app.innerHTML = `
    <div class="quiz-top"><button class="link" data-act="quit">✕ やめる</button>
      <span class="mode">${Q.mode === 'bonus' ? '🌟 かくれステージ' : Q.mode === 'back' ? '⏪ タイムマシン' : it.retry ? '🔁 おなじ ところ(かずが ちがうよ)' : '🏟️ しあい'}</span>
      <span class="clock">${Q.i + 1}/${Q.items.length}</span></div>
    <div class="pitch"><span class="ball" style="left:calc(${pct}% + 6px)">⚽</span><span class="goal">🥅</span></div>
    <main><section class="panel qpanel">
      <div class="q ${q.text.length > 40 ? 'long' : ''}">${q.text}</div>
      <div style="text-align:center"><button class="btn small gray" data-act="speak">🔊 よみあげ</button></div>
      ${locked ? '<div id="wait" class="muted" style="text-align:center">👀 もんだいを よく よんでね…</div>' : ''}
      <div class="choices">
        ${q.choices.map((c, idx) => `<button class="choice ${a ? (c.ok ? 'ok' : a.idx === idx ? 'ng' : '') : ''}" data-act="ans" data-idx="${idx}" ${a || locked ? 'disabled' : ''}>${c.label}</button>`).join('')}
      </div>
      ${a ? feedback(q, a) : `<div class="row" style="margin-top:14px">
        <button class="btn small gray" data-act="idk">🤔 わからない</button>
        <button class="btn small gray" data-act="ask">👨 パパに きく</button></div>`}
    </section></main>`;
  const i0 = Q.i;
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
    }, 4000);
  }
}

function feedback(q, a) {
  const last = Q.i === Q.items.length - 1;
  const next = `<button class="btn gold" data-act="next">${last ? '🏁 けっかを みる' : 'つぎへ ▶'}</button>`;
  if (a.ok) {
    return `<div class="fb good"><b>⚽ ゴール!! ${Q.combo >= 3 ? `🔥 ${Q.combo}れんぞく!` : ''}</b>
      <p>+${a.xp} ポイント${a.rep ? `(🇯🇵 代表ボーナス +${a.rep} こみ)` : ''}</p><p class="muted">${q.why}</p></div>${next}`;
  }
  const [name, msg] = TAGS[a.tag] || TAGS.unknown;
  const picked = a.idx != null ? q.choices[a.idx] : null;
  return `<div class="fb"><b>🧤 おしい! キーパーに とめられた</b>
    <p><span class="tag">げんいん</span><b>${name}</b></p>
    ${picked && picked.note ? `<p>👉 えらんだ「${picked.label}」は… ${picked.note}</p>` : `<p>${msg}</p>`}
    <p><b>せいかいは:</b> ${q.choices.find((c) => c.ok).label}</p><p class="muted">${q.why}</p>
    <p>${Q.items[Q.i].retry ? '👨 ここは パパと いっしょに みよう! 「パパに きく」を おしてね。' : '👉 つぎに、かずを かえて もういちど ためすよ。おぼえた こたえは つかえないよ 😉'}</p></div>
    <div class="row"><button class="btn small gray" data-act="ask">👨 パパに きく</button></div>
    <button class="btn gold" id="nextbtn" data-act="next" disabled>📖 せつめいを よんでね…</button>`;
}

function vResult() {
  const k = kidOf(); const p = S.kids[k.id]; const R = Q.result;
  const call = R.callup ? '<section class="panel rep"><div class="big">🇯🇵</div><h2 class="center">日本代表に えらばれたよ!</h2></section>' : '';
  const ranked = R.rankUp ? `<section class="panel gold"><div class="big">🎉</div><h2 class="center">ランクアップ!<br>${R.rankName}</h2></section>` : '';
  const weak = R.tags.length ? `<section class="panel"><h2 class="sec">NEXT <small>つぎは ここを ねらおう</small></h2>${R.tags.map((t) => `<p><span class="tag">${TAGS[t][0]}</span><br><span class="muted">${TAGS[t][1]}</span></p>`).join('')}</section>` : '<section class="panel"><b>ノーミス! パーフェクトゲーム ✨</b></section>';
  const lower = skillsUpTo(k.grade).filter((u) => u.grade < k.grade && ['gap', 'shaky'].includes(status(p, u.id))).slice(0, 3);
  const found = lower.length ? `<section class="panel tm"><h2 class="sec">TIME MACHINE <small>むかしの ぬけてた ところ みつけた!</small></h2>
    <p class="muted">だれでも あるよ。ここを なおせば つぎの たんげんも ぐんと かんたんになるよ。</p>
    ${lower.map((u) => `<button class="btn gray" data-act="start" data-mode="practice" data-unit="${u.id}">${ICON[status(p, u.id)]} ${u.grade}ねん:${u.name} を れんしゅう</button>`).join('')}</section>` : '';
  $app.innerHTML = `<div class="hero small"><h1>${R.good >= 4 ? '🏆 ナイスゲーム!' : '👏 おつかれさま!'}</h1></div>
    <main><section class="panel score"><div class="big">⚽ × ${R.good}</div>
      <p class="center">${R.total}もん中 ${R.good}ゴール ・ +${R.xp}ポイント ${R.hat ? '・🎩 ハットトリック!' : ''}</p></section>
    ${call}${ranked}${found}${weak}
    <button class="btn gold" data-act="kid">ホームに もどる</button></main>`;
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
    <p class="muted">Firebase の Realtime Database の URL と、家族だけの ひみつの コードを いれます。つくりかたは README の「きょうだい共有」を見てね。</p>
    <input id="syncdb" placeholder="https://xxxx-default-rtdb.firebaseio.com" value="${sc.db || ''}" style="width:100%;font:inherit;padding:8px;margin:4px 0">
    <input id="synccode" placeholder="かぞくコード(10もじいじょう)" value="${sc.fc || ''}" style="width:100%;font:inherit;padding:8px;margin:4px 0">
    <button class="btn small gray" data-act="synccode">🎲 コードを つくる</button>
    <button class="btn small" data-act="syncsave">💾 ほぞん</button>
    <p class="muted">下の リンクを それぞれの スマホで ひらくと、その子の スマホに なって、おなじ せっていが はいります。</p>
    ${KIDS.map((k) => `<button class="btn small gold" data-act="synccopy" data-id="${k.id}">📋 ${k.name}用リンクを コピー</button>`).join('')}</div>`;
  const ownerCard = `<div class="card"><h2>📱 この スマホの もちぬし</h2>
    <p>いまは「<b>${S.bound ? KIDS.find((k) => k.id === S.bound).name : 'きまっていません'}</b>」の スマホです。ほかの子の もんだいは ひらけません。</p>
    ${KIDS.filter((k) => k.id !== S.bound).map((k) => `<button class="btn small gray" data-act="rebind" data-id="${k.id}">${k.name}の スマホに かえる</button>`).join('')}</div>`;
  $app.innerHTML = `<div class="quiz-top"><button class="link" data-act="home">← もどる</button><span class="mode">👨 パパの へや</span><span></span></div><main>${ownerCard}${repAdmin}${syncCard}${tagRows}
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
// 問題が出てから、よく読む時間(はんしゃで おさせない)
const lockMs = (q) => Math.min(3500, Math.max(1500, q.text.length * 120));
function startQuiz(mode, unitId) {
  const k = kidOf();
  setSeen(S.kids[k.id].seen || []);
  Q = { mode, items: buildSet(k, mode, unitId), i: 0, good: 0, xp: 0, combo: 0, hat: false, answered: null, retries: 0, lockUntil: 0, missTags: {}, startXp: S.kids[k.id].xp };
  Q.lockUntil = Date.now() + lockMs(Q.items[0].q);
  view = 'quiz'; render();
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
  if (ok) {
    u.ok++; Q.good++; Q.combo++;
    let xp = 10 * (Q.mode === 'bonus' ? 2 : 1);
    if (Q.combo === 3) { xp += 10; Q.hat = true; }
    const rep = repBonus(k); xp += rep;
    Q.xp += xp; p.goals++;
    Q.answered = { ok, idx, xp, rep };
  } else {
    u.ng++; Q.combo = 0;
    p.tags[tag] = (p.tags[tag] || 0) + 1; Q.missTags[tag] = (Q.missTags[tag] || 0) + 1;
    if (Q.retries < 3 && !it.retry) {
      Q.retries++;
      let nq; for (let t = 0; t < 8; t++) { nq = makeQuestion(it.unit); if (nq.text !== q.text) break; }
      Q.items.splice(Q.i + 1, 0, { unit: it.unit, q: nq, retry: true });
    }
    Q.answered = { ok, idx, tag };
  }
  save(); render();
}

function finish() {
  const k = kidOf(); const p = S.kids[k.id]; refreshDay(p);
  const before = rankOf(p.xp);
  const selBefore = dataFor(k).sel.state;
  const bonusXp = Q.xp + 20; // 1セットやりきったボーナス
  p.xp += bonusXp;
  const after = rankOf(p.xp);
  const t = todayStr();
  if (Q.mode === 'bonus') { p.today.bonusDone++; p.callup = t; } else p.today.sets++;
  if (!p.days.includes(t)) p.days.push(t);
  p.lastDate = t;
  save();
  const selAfter = dataFor(k).sel.state;
  const tags = Object.entries(Q.missTags).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([x]) => x).filter((x) => x !== 'unknown' || Object.keys(Q.missTags).length === 1);
  Q.result = { good: Q.good, total: Q.items.length, xp: bonusXp, hat: Q.hat, tags, rankUp: after.i > before.i, rankName: after.name, callup: selBefore !== 'in' && selAfter === 'in' };
  view = 'result'; render();
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
  const el = e.target.closest('[data-act]'); if (!el) return;
  const a = el.dataset.act;
  if (a === 'bind') {
    if (!askPin()) return;
    S.bound = el.dataset.id; kidId = S.bound; tab = 'home'; view = 'kid'; toTop = true; save(); syncNow();
  }
  else if (a === 'rebind') {
    if (!confirm(`この スマホを「${KIDS.find((x) => x.id === el.dataset.id).name}」の スマホに かえる?`)) return;
    S.bound = el.dataset.id; kidId = S.bound; tab = 'home'; view = 'kid'; toTop = true; save(); syncNow();
  }
  else if (a === 'tab') { tab = el.dataset.tab; view = 'kid'; toTop = true; }
  else if (a === 'home' || a === 'kid') { view = kidId ? 'kid' : 'setup'; tab = 'home'; toTop = true; if (a === 'home') syncNow(); }
  else if (a === 'papa') { if (!askPin()) return; view = 'papa'; toTop = true; }
  else if (a === 'start') { toTop = true; return startQuiz(el.dataset.mode, el.dataset.unit); }
  else if (a === 'quit') { if (!confirm('ここで やめる?(とちゅうまでの ポイントは きえるよ)')) return; view = 'kid'; }
  else if (a === 'ans') return answer(Number(el.dataset.idx));
  else if (a === 'idk') return answer(null, true);
  else if (a === 'ask') return askPapa();
  else if (a === 'speak') return speak(Q.items[Q.i].q.text);
  else if (a === 'next') { Q.answered = null; Q.i++; if (Q.i >= Q.items.length) return finish(); Q.lockUntil = Date.now() + lockMs(Q.items[Q.i].q); toTop = true; }
  else if (a === 'synccode') { document.getElementById('synccode').value = sync.newCode(); return; }
  else if (a === 'syncsave') {
    const db = document.getElementById('syncdb').value; const fc = document.getElementById('synccode').value;
    if (!sync.validCfg(db, fc)) return toast('URL(https://〜)と コード(10もじいじょう)を いれてね');
    sync.setCfg(db, fc); toast('つないだよ!'); syncNow(); return;
  }
  else if (a === 'synccopy') {
    if (navigator.clipboard) navigator.clipboard.writeText(sync.shareLink(el.dataset.id)).then(() => toast('こども用リンクを コピーしたよ'), () => toast('コピーできなかったよ'));
    return;
  }
  else if (a === 'askdone') { S.kids[el.dataset.id].ask.splice(Number(el.dataset.i), 1); save(); }
  render();
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-act="override"],[data-act="need"]'); if (!el) return;
  if (el.dataset.act === 'need') { S.need = Number(el.value); save(); toast('日数を かえたよ'); return render(); }
  if (el.value) S.override[el.dataset.id] = el.value; else delete S.override[el.dataset.id];
  save(); toast('たんげんを かえたよ');
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

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
render();
