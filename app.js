import * as sync from './sync.js';
import { TAGS, unitsOf, skillsUpTo, byId, currentUnits, makeQuestion, shuffle, registerKokugo, setSeen } from './gen.js';

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
    plan = [cur[0], cur[1 % cur.length], ko || cur[2 % cur.length]];
    plan.push(weakPick(p, review.length ? review : sk));
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
let view = 'home';
let kidId = null;
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
  if (r) { S.remote = r; save(); if (['home', 'kid'].includes(view)) render(); }
}
const MILESTONES = [50, 100, 200, 300, 500, 750, 1000, 1500, 2000, 3000, 5000];
const ago = (t) => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 1 ? 'いま' : m < 60 ? `${m}ふん前` : m < 1440 ? `${Math.round(m / 60)}じかん前` : `${Math.round(m / 1440)}日前`; };
function siblingsCard() {
  const rows = KIDS.map((k) => ({ k, d: dataFor(k), remote: dataFor(k).remote, sel: dataFor(k).sel }));
  const total = rows.reduce((a, r) => a + r.d.goals, 0);
  const next = MILESTONES.find((m) => m > total) || total + 1000;
  const prev = [...MILESTONES].reverse().find((m) => m <= total) || 0;
  const pct = Math.round(((total - prev) / (next - prev)) * 100);
  const waiting = sync.enabled() && rows.some((r) => r.k.id !== kidId && !(S.remote && S.remote[r.k.id]));
  return `<div class="card" style="background:#fff8d9"><h2>🤝 きょうだいチーム</h2>
    ${rows.map((r) => `<div style="margin:6px 0"><b style="color:${r.k.color}">${r.k.em} ${r.d.name}</b>(${r.d.grade}ねん)${r.k.id === kidId ? ' ← じぶん' : ''}<br>
      <span class="pill">${r.d.rank}</span> ${r.sel.state === 'in' ? '<span class="pill" style="background:#ffd6d6">🇯🇵 日本代表</span>' : '<span class="pill">🪑 ひかえ</span>'} <span class="pill">⚽ ${r.d.goals}ゴール</span> <span class="pill">📅 ${r.d.days}日</span>
      ${r.remote && S.remote[r.k.id].t ? `<span class="muted"> ${ago(S.remote[r.k.id].t)}の きろく</span>` : ''}</div>`).join('')}
    ${rows.every((r) => r.sel.state === 'in') ? '<div style="margin-top:8px;background:#ffd6d6;border-radius:12px;padding:8px"><b>🇯🇵🇯🇵 ふたりそろって 日本代表!</b><br><span class="muted">せいかいごとの ボーナスポイントが ふえてるよ</span></div>' : ''}
    <div style="margin-top:10px"><b>チームの ゴール ごうけい ⚽ ${total}</b>
      <div class="bar" style="margin:6px 0"><i style="width:${pct}%"></i></div>
      <div class="muted">つぎの もくひょう ${next}ゴールまで あと ${next - total}!ふたりで ちからを あわせよう</div></div>
    ${waiting ? '<div class="muted">まだ あいての きろくが とどいてないよ(あいても アプリを ひらくと つながるよ)</div>' : ''}
  </div>`;
}

// ---- 画面 -----------------------------------------------------------------
function render() {
  document.documentElement.style.setProperty('--kid', kidId ? kidOf().color : '#1e6bd6');
  ({ home: vHome, kid: vKid, quiz: vQuiz, result: vResult, papa: vPapa })[view]();
}

function vHome() {
  $app.innerHTML = `
    <h1>⚽ ひびゆいFC</h1>
    <p class="sub">サッカーがくえん ― だれが れんしゅうする?</p>
    ${KIDS.map((k) => {
      const p = S.kids[k.id]; const r = rankOf(p.xp);
      return `<button class="btn kidbtn" style="background:${k.color}" data-act="pick" data-id="${k.id}">
        <span class="em">${k.em}</span><span>${k.name}<br><small>${k.grade}ねんせい ・ ${r.name}</small></span></button>`;
    }).join('')}
    ${siblingsCard()}
    <div style="text-align:center;margin-top:24px"><button class="link" data-act="papa">👨 パパの へや</button></div>`;
}

function repCard(k, p) {
  const d = dataFor(k); const sel = d.sel; const need = needDays();
  const set = new Set(d.recent);
  const dots = Array.from({ length: WINDOW }, (_, i) => { const day = new Date(); day.setDate(day.getDate() - (WINDOW - 1 - i)); return set.has(dstr(day)) ? '🟢' : '⚪'; }).join(' ');
  const left = p.today.bonusTotal - p.today.bonusDone;
  let msg;
  if (sel.state === 'in') msg = `🇯🇵 <b>日本代表に えらばれてるよ!</b>${sel.called && sel.n < need ? '(追加招集)' : ''}<br><span class="muted">${bothIn() ? '🇯🇵🇯🇵 ふたりそろって 日本代表! ボーナスポイントが ふえてるよ' : 'もうひとりも えらばれると、ボーナスが もっと ふえるよ'}</span>`;
  else if (sel.state === 'close') msg = `<b>あと 1日!</b> れんしゅうすると 日本代表に えらばれるよ`;
  else msg = `いまは 🪑 ひかえメンバー。だいじょうぶ、すぐ もどれるよ!<br><span class="muted">${left > 0 ? '🌟 かくれステージを 1つ クリアすると、すぐ 追加招集されるよ' : `あと ${need - sel.n}日 れんしゅうすると 日本代表に えらばれるよ`}</span>`;
  return `<div class="card" style="background:#ffeaea"><h2>🇯🇵 日本代表 せんしゅつ</h2>
    <div class="muted">この ${WINDOW}日で ${need}日 れんしゅうすると えらばれるよ</div>
    <div style="font-size:22px;margin:6px 0">${dots}</div>${msg}</div>`;
}

function vKid() {
  const k = kidOf(); const p = S.kids[k.id]; refreshDay(p);
  const r = rankOf(p.xp);
  const cur = currentUnits(k.grade, new Date().getMonth() + 1, S.override[k.id]);
  const left = p.today.bonusTotal - p.today.bonusDone;
  const welcome = p.today.gap > 0 && p.today.sets === 0
    ? `おかえり、${k.name}! まってたよ。きょうは かくれステージが ひらいてるよ 🌟`
    : p.today.sets > 0 ? `${k.name}、きょうも ナイスプレー!` : `${k.name}、きょうも キックオフ!`;
  $app.innerHTML = `
    <div class="field"><button class="link" data-act="home">← もどる</button><span>${k.grade}ねんせい</span></div>
    <div class="card">
      <div class="row" style="justify-content:space-between"><b style="font-size:22px">${k.em} ${k.name}</b><span class="pill">${r.name}</span></div>
      <div class="bar" style="margin:10px 0"><i style="width:${r.pct}%"></i></div>
      <div class="muted">${r.next ? `つぎの ランクまで あと ${r.next[0] - p.xp} ポイント` : 'さいこうランク!'}</div>
      <div class="row" style="margin-top:8px"><span class="pill">⚽ ゴール ${p.goals}</span><span class="pill">📅 ぜんぶで ${p.days.length}日</span></div>
    </div>
    ${repCard(k, p)}
    ${siblingsCard()}
    <div class="card"><b>${welcome}</b></div>
    <div class="card">
      <h2>🏟️ きょうの しあい</h2>
      <div class="muted">いま やってる たんげん:${cur.map((u) => u.name).join('、')}</div>
      <button class="btn gold" data-act="start" data-mode="daily">${p.today.sets > 0 ? '✅ もういっかい しあいする' : '▶ キックオフ!(5もん)'}</button>
    </div>
    ${left > 0 ? `<div class="card" style="background:#fff3c4"><h2>🌟 かくれステージ</h2>
      <div class="muted">おやすみしてた ぶん、ごほうびステージが ひらいたよ。ポイント 2ばい!<br>1つずつで おわってOK。あせらなくていいよ。</div>
      <button class="btn gold" data-act="start" data-mode="bonus">🌟 ステージに いく(のこり ${left})</button></div>` : ''}
    ${timeMachineCard(k, p)}
    <div class="card"><h2>🎯 すきな れんしゅう</h2>
      ${unitsOf(k.grade).map((u) => `<button class="btn gray" data-act="start" data-mode="practice" data-unit="${u.id}">${ICON[status(p, u.id)]} ${u.subject === '国語' ? '📖 ' : ''}${u.name}</button>`).join('')}
      <details style="margin-top:8px"><summary>⏪ まえの がくねんの れんしゅう</summary>
        ${skillsUpTo(k.grade).filter((u) => u.grade < k.grade).map((u) => `<button class="btn gray" data-act="start" data-mode="practice" data-unit="${u.id}">${ICON[status(p, u.id)]} ${u.grade}ねん:${u.name}</button>`).join('')}
      </details>
    </div>`;
}

function timeMachineCard(k, p) {
  const sk = skillsUpTo(k.grade);
  const todo = sk.filter((u) => status(p, u.id) === 'unknown' && u.grade < k.grade).length;
  const weak = sk.filter((u) => ['gap', 'shaky'].includes(status(p, u.id)));
  const due = sk.filter((u) => status(p, u.id) === 'sprout' && needs(p, u.id)).length;
  const grades = [...new Set(sk.map((u) => u.grade))];
  return `<div class="card" style="background:#e9f1ff"><h2>⏪ タイムマシン チェック</h2>
    <div class="muted">むかしの がくねんまで もどって、「ぬけてる ところ」を さがすよ。みつかったら ラッキー! そこを なおせば ぐんと つよくなる。</div>
    ${grades.map((g) => `<div style="margin:6px 0"><b>${g}ねん</b> ${sk.filter((u) => u.grade === g).map((u) => `<span title="${u.name}">${ICON[status(p, u.id)]}</span>`).join(' ')}</div>`).join('')}
    <div class="muted">✅ほんとに できた 🌱できたかも(べつの日に もういちど) 🔸あやしい 🔻ぬけてる ⬜まだ</div>
    ${todo + weak.length + due > 0 ? `<button class="btn" data-act="start" data-mode="back">⏪ タイムマシンに のる(5もん)</button>` : '<b>ぜんぶ チェックずみ! すごい!</b>'}
  </div>`;
}

function vQuiz() {
  const k = kidOf(); const it = Q.items[Q.i]; const q = it.q;
  const pct = Math.round((Q.i / Q.items.length) * 82);
  const a = Q.answered;
  const locked = !a && Date.now() < Q.lockUntil;
  $app.innerHTML = `
    <div class="field"><button class="link" data-act="quit">× やめる</button>
      <span>${Q.mode === 'bonus' ? '🌟 かくれステージ' : Q.mode === 'back' ? '⏪ タイムマシン' : it.retry ? '🔁 おなじ ところ(かずが ちがうよ)' : '🏟️ しあい'} ${Q.i + 1}/${Q.items.length}</span></div>
    <div class="pitch"><span class="ball" style="left:calc(${pct}% + 6px)">⚽</span><span class="goal">🥅</span></div>
    <div class="card">
      <div class="q">${q.text}</div>
      <div style="text-align:center"><button class="btn small gray" data-act="speak">🔊 よみあげ</button></div>
      ${locked ? '<div id="wait" class="muted" style="text-align:center">👀 もんだいを よく よんでね…</div>' : ''}
      <div class="choices">
        ${q.choices.map((c, idx) => `<button class="choice ${a ? (c.ok ? 'ok' : a.idx === idx ? 'ng' : '') : ''}" data-act="ans" data-idx="${idx}" ${a || locked ? 'disabled' : ''}>${c.label}</button>`).join('')}
      </div>
      ${a ? feedback(q, a) : `<div class="row" style="margin-top:14px">
        <button class="btn small gray" data-act="idk">🤔 わからない</button>
        <button class="btn small gray" data-act="ask">👨 パパに きく</button></div>`}
    </div>`;
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
  return `<div class="fb"><b>🧤 おしい! キーパーに とめられた</b>
    <p><span class="tag">げんいん</span><b>${name}</b></p><p>${msg}</p>
    <p><b>せいかいは:</b> ${q.choices.find((c) => c.ok).label}</p><p class="muted">${q.why}</p>
    <p>${Q.items[Q.i].retry ? '👨 ここは パパと いっしょに みよう! 「パパに きく」を おしてね。' : '👉 つぎに、かずを かえて もういちど ためすよ。おぼえた こたえは つかえないよ 😉'}</p></div>
    <div class="row"><button class="btn small gray" data-act="ask">👨 パパに きく</button></div>
    <button class="btn gold" id="nextbtn" data-act="next" disabled>📖 せつめいを よんでね…</button>`;
}

function vResult() {
  const k = kidOf(); const p = S.kids[k.id]; const R = Q.result;
  const call = R.callup ? '<div class="card" style="background:#ffe3e3"><div class="big">🇯🇵</div><h2 style="text-align:center">日本代表に えらばれたよ!</h2></div>' : '';
  const ranked = R.rankUp ? `<div class="card" style="background:#fff3c4"><div class="big">🎉</div><h2 style="text-align:center">ランクアップ!<br>${R.rankName}</h2></div>` : '';
  const weak = R.tags.length ? `<div class="card"><h2>🔎 つぎは ここを ねらおう</h2>${R.tags.map((t) => `<p><span class="tag">${TAGS[t][0]}</span><br><span class="muted">${TAGS[t][1]}</span></p>`).join('')}</div>` : `<div class="card"><b>ノーミス! パーフェクトゲーム ✨</b></div>`;
  const lower = skillsUpTo(k.grade).filter((u) => u.grade < k.grade && ['gap', 'shaky'].includes(status(p, u.id))).slice(0, 3);
  const found = lower.length ? `<div class="card" style="background:#e9f1ff"><h2>🕰️ むかしの ぬけてた ところ みつけた!</h2>
    <p class="muted">だれでも あるよ。ここを なおせば つぎの たんげんも ぐんと かんたんになるよ。</p>
    ${lower.map((u) => `<button class="btn gray" data-act="start" data-mode="practice" data-unit="${u.id}">${ICON[status(p, u.id)]} ${u.grade}ねん:${u.name} を れんしゅう</button>`).join('')}</div>` : '';
  $app.innerHTML = `
    <h1>${R.good >= 4 ? '🏆 ナイスゲーム!' : '👏 おつかれさま!'}</h1>
    <div class="card"><div class="big">⚽ × ${R.good}</div>
      <p style="text-align:center">${R.total}もん中 ${R.good}ゴール ・ +${R.xp}ポイント ${R.hat ? '・🎩 ハットトリック!' : ''}</p></div>
    ${call}${ranked}${found}${weak}
    <button class="btn gold" data-act="kid">もどる</button>`;
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
    <button class="btn small gold" data-act="synccopy">📋 こども用リンクを コピー</button>
    <p class="muted">こども用リンクを ひびと・ゆいとの スマホで ひらくと、おなじ せっていに なります。</p></div>`;
  $app.innerHTML = `<div class="field"><button class="link" data-act="home">← もどる</button><span>👨 パパの へや</span></div>${repAdmin}${syncCard}${tagRows}
    <p class="muted" style="color:#eaffea">学校の すすみ具合が ちがう ときは、うえの「いまの たんげん」を えらんでね。</p>`;
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
  if (a === 'pick') { kidId = el.dataset.id; view = 'kid'; syncNow(); }
  else if (a === 'home') { kidId = null; view = 'home'; syncNow(); }
  else if (a === 'kid') view = 'kid';
  else if (a === 'papa') view = 'papa';
  else if (a === 'start') return startQuiz(el.dataset.mode, el.dataset.unit);
  else if (a === 'quit') { if (!confirm('ここで やめる?(とちゅうまでの ポイントは きえるよ)')) return; view = 'kid'; }
  else if (a === 'ans') return answer(Number(el.dataset.idx));
  else if (a === 'idk') return answer(null, true);
  else if (a === 'ask') return askPapa();
  else if (a === 'speak') return speak(Q.items[Q.i].q.text);
  else if (a === 'next') { Q.answered = null; Q.i++; if (Q.i >= Q.items.length) return finish(); Q.lockUntil = Date.now() + lockMs(Q.items[Q.i].q); }
  else if (a === 'synccode') { document.getElementById('synccode').value = sync.newCode(); return; }
  else if (a === 'syncsave') {
    const db = document.getElementById('syncdb').value; const fc = document.getElementById('synccode').value;
    if (!sync.validCfg(db, fc)) return toast('URL(https://〜)と コード(10もじいじょう)を いれてね');
    sync.setCfg(db, fc); toast('つないだよ!'); syncNow(); return;
  }
  else if (a === 'synccopy') {
    if (!sync.enabled()) return toast('さきに「ほぞん」してね');
    if (navigator.clipboard) navigator.clipboard.writeText(sync.shareLink()).then(() => toast('こども用リンクを コピーしたよ'), () => toast('コピーできなかったよ'));
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

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
render();
