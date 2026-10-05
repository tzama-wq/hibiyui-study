// ガチャ・ずかん・へんせい・つよくなる・たいせんの「画面」。
// app.js から ctx(状態や共通の道具)を わたして つかう。DOM には さわらず、HTML文字列を かえす。
import * as G from './game.js';

let X; // ctx
export function gameInit(ctx) { X = ctx; }

const STAT_SHORT = { SHO: 'シュ', PAS: 'パス', SPD: 'スピ', DEF: 'まも', STA: 'スタ' };
const vw = () => (typeof innerWidth === 'number' ? innerWidth : 360);
const vh = () => (typeof innerHeight === 'number' ? innerHeight : 640);
const esc = (s) => String(s).replace(/[<>&"]/g, '');
const rewardText = (r) => G.TICKET_ORDER.filter((k) => r[k]).map((k) => `${G.TICKETS[k].icon}${G.TICKETS[k].name}×${r[k]}`).join(' ');

// ---- 保存データの 初期化 ----------------------------------------------------------
export function ensureGame(p) {
  p.tickets = { ...G.emptyTickets(), ...(p.tickets || {}) };
  p.owned = p.owned || {};
  if (!Array.isArray(p.team) || p.team.length !== 5) p.team = ['self', null, null, null, null];
  p.equip = Array.isArray(p.equip) ? p.equip.slice(0, G.MAX_EQUIP) : [];
  p.pts = { ...G.emptyStatMap(), ...(p.pts || {}) };
  p.lv = { ...G.emptyStatMap(), ...(p.lv || {}) };
  p.battles = p.battles || { w: 0, l: 0, d: 0 };
  if (!p.starter) { G.addTickets(p, { bronze: 3, silver: 1 }); p.starter = true; } // はじめての 1回ぶん
}

export const kidCardOf = (k, p) => ({ name: k.name, face: k.em, stats: G.kidStats(p) });
export const snapshotOf = (k, p) => G.teamSnapshot({ kid: kidCardOf(k, p), owned: p.owned, team: p.team, equip: p.equip });
export const summaryTeam = (k, p) => snapshotOf(k, p);

// ---- 学習のあとの ごほうび(チケット・強化ポイント) -----------------------------------------
export function awardStudy(p, info, today) {
  const tickets = G.earnStudyTickets(p, info, today);
  return tickets;
}

// ---- 部品 ---------------------------------------------------------------------
const ovrOf = (stats, pos) => {
  if (pos === 'ALL') return Math.round(G.STATS.reduce((a, s) => a + stats[s], 0) / 5);
  const main = { FW: ['SHO', 'SPD'], MF: ['PAS', 'STA'], DF: ['DEF', 'STA'], GK: ['DEF', 'STA'] }[pos] || [];
  const m = main.reduce((a, s) => a + stats[s], 0) / main.length;
  const o = G.STATS.filter((s) => !main.includes(s)).reduce((a, s) => a + stats[s], 0) / (5 - main.length);
  return Math.round(m * 0.65 + o * 0.35);
};
// イラストが あれば 画像、よみこめなければ 絵文字に もどる
const faceHtml = (pl) => (pl.img ? `<img class="rc-img" src="${esc(pl.img)}" alt="" loading="lazy" onerror="this.outerHTML='${pl.face}'">` : pl.face);
function cardHtml(pl, o = {}) {
  const lv = pl.level ? ` Lv${pl.level}` : '';
  const nm = pl.rarity === 'kid' ? 'じぶん' : G.RARITY_NAME[pl.rarity] || '';
  return `<div class="rcard r-${pl.rarity} ${o.cls || ''}" ${o.attrs || ''}>
    <div class="rc-top"><b class="rc-ovr">${ovrOf(pl.stats, pl.pos)}</b><small>${pl.pos === 'ALL' ? 'ALL' : pl.pos}${pl.nation ? ` ${pl.nation}` : ''}</small></div>
    <div class="rc-face ${pl.img ? 'has-img' : ''}">${faceHtml(pl)}</div><div class="rc-name">${esc(pl.name)}</div>
    <div class="rc-rar">${nm}${lv}${pl.offPos ? ' ⚠' : ''}</div>
    ${o.stats === false ? '' : `<div class="rc-stats">${G.STATS.map((s) => `<span><i>${STAT_SHORT[s]}</i>${pl.stats[s]}</span>`).join('')}</div>`}
    ${o.copies > 1 ? `<div class="rc-copies">×${o.copies}</div>` : ''}</div>`;
}
const playerOf = (id) => G.PLAYER_BY_ID[id];

export function ticketBar(p) {
  return `<div class="tickets">${G.TICKET_ORDER.map((t) => `<span class="tk tk-${t} ${p.tickets[t] ? 'has' : ''}">${G.TICKETS[t].icon}<b>${p.tickets[t]}</b><small>${G.TICKETS[t].name}</small></span>`).join('')}</div>`;
}

export function loginCard(p) {
  const today = X.today();
  const n = (p.loginDays || 0) + 1;
  if (p.lastLogin !== today) {
    return `<button class="event-btn login" data-act="login"><small>LOGIN BONUS</small><b>🎁 ログインボーナス ${n}日め</b>
      <span>${rewardText(G.loginReward(n))} が もらえるよ</span></button>`;
  }
  const nx = G.nextBigLogin(p.loginDays);
  return `<div class="rep-chip in">✅ きょうの ログインボーナス ゲット(ぜんぶで ${p.loginDays}日)${nx ? ` ・ あと ${nx.in}日で ${rewardText(nx.reward)}` : ''}</div>`;
}

// ---- ガチャ -------------------------------------------------------------------
const Gs = { phase: 'idle', ticket: null, results: [] };
function revealFx(results) {
  const best = results.reduce((b, r) => Math.max(b, G.RARITIES.indexOf(r.player.rarity)), 0);
  const W = vw(); const H = vh();
  if (best >= 4) { X.fx.confetti(W / 2, H * 0.4, 220, 2); X.fx.confetti(W * 0.2, H * 0.5, 120, 1.6); X.fx.confetti(W * 0.8, H * 0.5, 120, 1.6); X.fx.beep('win'); X.fx.vibrate([80, 40, 80, 40, 200]); }
  else if (best >= 3) { X.fx.confetti(W / 2, H * 0.4, 130, 1.6); X.fx.beep('win'); X.fx.vibrate([60, 40, 100]); }
  else if (best >= 2) { X.fx.confetti(W / 2, H * 0.4, 70, 1.2); X.fx.beep('ok'); X.fx.vibrate(40); }
  else X.fx.beep('ok');
}
export function gachaTab() {
  const p = X.p();
  const total = G.TICKET_ORDER.reduce((a, t) => a + p.tickets[t], 0);
  const stage = Gs.phase === 'idle' ? '' : stageHtml();
  return `${stage}<section class="panel"><h2 class="sec">GACHA <small>ガチャ</small></h2>
    ${ticketBar(p)}
    <div class="muted">べんきょうで チケットが もらえるよ。ログインボーナスは つづけるほど ごうかに なるよ(やすんでも なくならない)。</div>
    <div class="pull-list">${G.TICKET_ORDER.map((t) => {
    const n = p.tickets[t];
    return `<div class="pull-row tk-${t}"><div><b>${G.TICKETS[t].icon} ${G.TICKETS[t].name}</b><small>${G.RARITY_NAME[G.TICKETS[t].min]}いじょう かくてい</small></div>
        <button class="btn small" data-act="pull" data-t="${t}" data-n="1" ${n ? '' : 'disabled'}>1かい</button>
        <button class="btn small gold" data-act="pull" data-t="${t}" data-n="${Math.min(10, n)}" ${n >= 2 ? '' : 'disabled'}>まとめて ${Math.min(10, n)}</button></div>`;
  }).join('')}</div>
    ${total ? '' : '<div class="muted">チケットが ないよ。れんしゅうで ゲットしよう!(6わり いじょう せいかいで もらえる)</div>'}
  </section>
  <section class="panel"><h2 class="sec">RATE <small>でやすさ</small></h2>
    <div class="rate-table"><div class="rt-h"><span></span>${G.TICKET_ORDER.map((t) => `<span>${G.TICKETS[t].icon}</span>`).join('')}</div>
    ${G.RARITIES.slice().reverse().map((r) => `<div class="rt-r r-${r}"><span>${G.RARITY_NAME[r]}</span>${G.TICKET_ORDER.map((t) => { const v = G.rates(t)[r]; return `<span>${v === 0 ? '−' : `${+v.toFixed(r === 'legend' ? 2 : 1)}%`}</span>`; }).join('')}</div>`).join('')}</div>
    <div class="muted">👑 レジェンドは チケットが いいほど でやすいよ(ブロンズ 0.02% 〜 プラチナ 2%)。ほんとうに めずらしいよ!</div></section>`;
}
function stageHtml() {
  if (Gs.phase === 'rolling') {
    return `<div class="gacha-stage rolling"><div class="capsule">🔮</div><div class="gs-text">なにが でるかな…?</div></div>`;
  }
  const best = Gs.results.reduce((b, r) => (G.RARITIES.indexOf(r.player.rarity) > G.RARITIES.indexOf(b) ? r.player.rarity : b), 'common');
  const one = Gs.results.length === 1;
  return `<div class="gacha-stage reveal r-${best}"><div class="gs-rar">${G.RARITY_NAME[best]}${one ? '' : ' が でたよ!'}</div>
    <div class="gs-cards ${one ? 'one' : ''}">${Gs.results.map((r, i) => `<div class="gs-card" style="animation-delay:${0.1 + i * 0.12}s">${cardHtml({ ...r.player, level: G.levelOf(r.copies) }, { stats: one })}${r.isNew ? '<em class="new">NEW!</em>' : `<em class="dup">レベル${G.levelOf(r.copies)}</em>`}</div>`).join('')}</div>
    ${one && Gs.results[0].player.type ? `<div class="gs-type">${esc(Gs.results[0].player.type)}</div>` : ''}
    <button class="btn gold" data-act="gachaclose">とじる</button></div>`;
}

// ---- チーム(へんせい・ずかん・つよく・たいせん・きょうだい) -----------------------------------------
const UI = { sub: 'form', slot: null, dexF: 'all', dexSel: null };
const SUBS = [['form', '🧩', 'へんせい'], ['dex', '📚', 'ずかん'], ['power', '💪', 'つよく'], ['battle', '⚔️', 'たいせん'], ['mates', '🤝', 'きょうだい']];
export function teamTab() {
  const body = { form: formHtml, dex: dexHtml, power: powerHtml, battle: battleMenuHtml, mates: () => X.matesHtml() }[UI.sub]();
  return `<div class="subnav">${SUBS.map(([s, i, l]) => `<button class="${UI.sub === s ? 'on' : ''}" data-act="sub" data-sub="${s}"><span>${i}</span>${l}</button>`).join('')}</div>${body}`;
}

function formHtml() {
  const k = X.kid(); const p = X.p();
  const snap = snapshotOf(k, p); const r = G.ratings(snap);
  const rows = [[0, 1], [2], [3], [4]];
  const slotHtml = (i) => `<button class="slot ${UI.slot === i ? 'sel' : ''}" data-act="slot" data-i="${i}"><small>${G.SLOT_POS[i]}</small>${cardHtml(snap[i], { stats: false })}</button>`;
  return `<section class="panel"><h2 class="sec">FORMATION <small>へんせい</small></h2>
    <div class="power"><span>⚔ ${Math.round(r.att)}</span><span>🛡 ${Math.round(r.def)}</span><b>パワー ${r.power}</b></div>
    <div class="formation">${rows.map((row) => `<div class="frow">${row.map(slotHtml).join('')}</div>`).join('')}</div>
    <div class="muted">わくを おして、えらぼう。ポジションが ちがうと ⚠ よわくなるよ(じぶんは どこでも OK)。</div>
    ${UI.slot !== null ? pickerHtml(k, p) : ''}</section>${equipHtml(p)}`;
}
function pickerHtml(k, p) {
  const i = UI.slot; const pos = G.SLOT_POS[i];
  const placed = new Set(p.team.filter(Boolean));
  const owned = Object.keys(p.owned).map(playerOf).filter(Boolean)
    .sort((a, b) => (b.pos === pos) - (a.pos === pos) || G.RARITIES.indexOf(b.rarity) - G.RARITIES.indexOf(a.rarity) || ovrOf(b.stats, b.pos) - ovrOf(a.stats, a.pos));
  const opt = (id, pl, lv) => `<button class="opt ${p.team[i] === id ? 'cur' : ''}" data-act="place" data-i="${i}" data-id="${id}">${cardHtml({ ...pl, level: lv, offPos: pl.pos !== 'ALL' && pl.pos !== pos }, { stats: false, cls: 'mini' })}
    <span class="opt-info"><b>${esc(pl.name)}</b><small>${pl.pos === 'ALL' ? 'どこでも OK' : pl.pos === pos ? '◎ ぴったり' : '⚠ ポジションが ちがう'}${placed.has(id) && p.team[i] !== id ? ' ・ ほかの わくに いるよ(いれかえ)' : ''}</small></span></button>`;
  const selfSnap = { name: k.name, face: k.em, pos: 'ALL', rarity: 'kid', stats: G.kidStats(p) };
  return `<div class="picker"><h3>${i + 1}ばんめの わくに だれを いれる?(${pos})</h3>
    ${opt('self', selfSnap, 0)}${owned.map((pl) => opt(pl.id, pl, G.levelOf(p.owned[pl.id]))).join('')}
    ${owned.length ? '' : '<div class="muted">ガチャで 選手を あつめよう!</div>'}
    <button class="btn small gray" data-act="place" data-i="${i}" data-id="">この わくを からにする</button>
    <button class="btn small gray" data-act="slot" data-i="${i}">とじる</button></div>`;
}
function equipHtml(p) {
  const have = X.BADGES.filter((b) => X.haveBadge(b));
  const buff = G.teamBuff(p.equip);
  const bt = G.STATS.filter((s) => buff[s]).map((s) => `${G.STAT_NAME[s]}+${buff[s]}%`).join(' ・ ') || 'まだ なし';
  return `<section class="panel"><h2 class="sec">MEDAL BUFF <small>メダル そうび ${p.equip.length}/${G.MAX_EQUIP}</small></h2>
    <div class="muted">メダルを 3つまで そうびすると、チームが つよくなるよ。</div>
    <div class="buffnow">いまの バフ:${bt}</div>
    <div class="equip-list">${have.length ? have.map((b) => `<button class="eq ${p.equip.includes(b.id) ? 'on' : ''}" data-act="equip" data-id="${b.id}"><span>${b.icon}</span><b>${b.name}</b><small>${G.buffText(b.id)}</small></button>`).join('') : '<div class="muted">メダルを ゲットすると、ここで そうびできるよ。</div>'}</div></section>`;
}

function dexHtml() {
  const p = X.p();
  const n = Object.keys(p.owned).length;
  const f = UI.dexF;
  // もっている選手を さきに(レア度の たかい じゅん)、あとは まだの 選手
  const list = G.PLAYERS.filter((pl) => f === 'all' || pl.rarity === f)
    .sort((a, b) => (!!p.owned[b.id] - !!p.owned[a.id]) || (G.RARITIES.indexOf(b.rarity) - G.RARITIES.indexOf(a.rarity)));
  const sel = UI.dexSel && G.PLAYER_BY_ID[UI.dexSel];
  return `<section class="panel"><h2 class="sec">COLLECTION <small>ずかん ${n}/${G.PLAYERS.length}</small></h2>
    <div class="chips">${['all', ...G.RARITIES].map((r) => `<button class="chipb ${f === r ? 'on' : ''} r-${r}" data-act="dexf" data-r="${r}">${r === 'all' ? 'ぜんぶ' : G.RARITY_NAME[r]}${r === 'all' ? '' : ` ${G.PLAYERS.filter((x) => x.rarity === r && p.owned[x.id]).length}/${G.PLAYERS.filter((x) => x.rarity === r).length}`}</button>`).join('')}</div>
    ${sel && p.owned[sel.id] ? `<div class="dex-detail">${cardHtml({ ...sel, level: G.levelOf(p.owned[sel.id]) }, { copies: p.owned[sel.id] })}<div class="muted">${esc(sel.name)} ・ ${G.POS_NAME[sel.pos]}${sel.nation ? ` ${sel.nation}` : ''}<br>${sel.type ? `<b>${esc(sel.type)}</b><br>` : ''}おなじ 選手が ダブると レベルアップ(さいだい Lv5 ・ 1レベルで のうりょく +4%)</div></div>` : ''}
    <div class="muted" style="margin-bottom:6px">※ 有名な 選手を ヒントに した オリジナルの キャラクターだよ(ほんにんとは かんけい ないよ)。</div>
    <div class="dex-grid">${list.map((pl) => p.owned[pl.id]
    ? `<button class="dx got r-${pl.rarity}" data-act="dexsel" data-id="${pl.id}"><span>${pl.img ? `<img class="dx-img" src="${esc(pl.img)}" alt="" loading="lazy" onerror="this.outerHTML='${pl.face}'">` : pl.face}</span><small>${esc(pl.name)}</small>${p.owned[pl.id] > 1 ? `<em>×${p.owned[pl.id]}</em>` : ''}</button>`
    : `<div class="dx r-${pl.rarity}"><span>？</span><small>${G.RARITY_NAME[pl.rarity]}</small></div>`).join('')}</div></section>`;
}

function powerHtml() {
  const k = X.kid(); const p = X.p();
  const SUBJ = Object.fromEntries(Object.entries(G.SUBJECT_STAT).map(([sj, st]) => [st, sj]));
  return `<section class="panel"><h2 class="sec">POWER UP <small>つよくなる</small></h2>
    <div class="muted">べんきょうで せいかいすると、ポイントが たまるよ。ポイントで ${k.name}を つよくしよう! つよくなると、いつか レジェンド(さいだい 99)も こえられるよ。</div>
    <div class="kidcard">${cardHtml({ name: k.name, face: k.em, pos: 'ALL', rarity: 'kid', stats: G.kidStats(p) }, { stats: false })}</div>
    ${G.STATS.map((s) => {
    const lv = p.lv[s]; const cost = G.upgradeCost(lv); const can = p.pts[s] >= cost && lv < G.MAX_LEVEL;
    return `<div class="stat-row"><div class="sr-name"><b>${G.STAT_NAME[s]}</b><small>${SUBJ[s]}で ゲット</small></div>
        <div class="sr-bar"><i style="width:${Math.min(100, (G.kidStat(lv) / 150) * 100)}%"></i><u style="left:${(99 / 150) * 100}%"></u></div>
        <div class="sr-val"><b>${G.kidStat(lv)}</b><small>Lv${lv}</small></div>
        <button class="btn small ${can ? 'gold' : 'gray'}" data-act="upgrade" data-s="${s}" ${can ? '' : 'disabled'}>${lv >= G.MAX_LEVEL ? 'MAX' : `+ (${cost})`}</button>
        <div class="sr-pts">${p.pts[s]}pt</div></div>`;
  }).join('')}
    <div class="muted">縦の線(|)が レジェンドの さいだい(99)。</div></section>`;
}

// ---- 対戦 ----------------------------------------------------------------------
let B = null; let timer = null;
function mateOpponent() {
  const other = X.KIDS.find((k) => k.id !== X.kid().id);
  const d = X.dataFor(other);
  if (Array.isArray(d.team) && d.team.length === 5) return { name: `${other.name}の チーム`, team: d.team, power: G.ratings(d.team).power };
  return null;
}
function battleMenuHtml() {
  const k = X.kid(); const p = X.p();
  const snap = snapshotOf(k, p); const r = G.ratings(snap);
  const mate = mateOpponent();
  return `<section class="panel"><h2 class="sec">MATCH <small>たいせん</small></h2>
    <div class="power"><b>${k.name}の チーム パワー ${r.power}</b><span>${p.battles.w}勝 ${p.battles.d}分 ${p.battles.l}敗</span></div>
    <div class="muted">へんせいした チームで たいせん! (どちらが かつかは うんも あるよ)</div>
    ${mate ? `<button class="match-btn alt" data-act="fight" data-opp="mate"><small>VS BROTHER</small><b>⚔️ ${esc(mate.name)}と たいせん</b><span>あいての パワー ${mate.power}</span></button>` : '<div class="muted">きょうだいの チームは、きょうだいが アプリを ひらくと あらわれるよ。</div>'}
    <div class="cpu-list">${G.CPU_LEVELS.map((l) => `<button class="btn gray" data-act="fight" data-opp="cpu:${l.id}">⚔ ${l.club}<small>(${l.name} ・ パワー めやす ${Math.round(r.power * l.factor)})</small></button>`).join('')}</div></section>`;
}
function startFight(oppId) {
  const k = X.kid(); const p = X.p();
  const me = { name: `${k.name}の チーム`, team: snapshotOf(k, p) };
  let opp;
  if (oppId === 'mate') { const m = mateOpponent(); if (!m) return false; opp = { name: m.name, team: m.team }; }
  else opp = G.cpuTeam(G.ratings(me.team).power, oppId.split(':')[1]);
  const res = G.simulate(me, opp);
  B = { me, opp, res, i: 0, counted: false };
  X.setView('battle');
  tickBattle();
  return true;
}
function tickBattle() {
  clearTimeout(timer);
  if (!B || B.i >= B.res.events.length) { finishBattle(); return; }
  timer = setTimeout(() => {
    if (!B) return;
    B.i++;
    const ev = B.res.events[B.i - 1];
    if (ev.type === 'goal') { X.fx.beep(ev.side === 'a' ? 'ok' : 'ng'); X.fx.vibrate(ev.side === 'a' ? 30 : 15); if (ev.side === 'a') X.fx.confetti(vw() / 2, vh() * 0.3, 40, 1); }
    X.render();
    tickBattle();
  }, 1250);
}
function finishBattle() {
  if (!B || B.counted) return;
  B.counted = true;
  const p = X.p(); const s = B.res.score;
  if (s.a > s.b) p.battles.w++; else if (s.a < s.b) p.battles.l++; else p.battles.d++;
  X.save();
  if (s.a > s.b) { X.fx.confetti(vw() / 2, vh() * 0.35, 120, 1.5); X.fx.beep('win'); }
}
export function battleView() {
  if (!B) return '<main><div class="muted">たいせんが ないよ</div><button class="btn gold" data-act="battleend">もどる</button></main>';
  const ev = B.res.events.slice(0, B.i); const last = ev[ev.length - 1];
  const sc = last ? last.score : { a: 0, b: 0 };
  const done = B.i >= B.res.events.length;
  const sideHtml = (t) => `<div class="bteam">${t.team.map((m) => `<span title="${esc(m.name)}">${m.img ? `<img class="bt-img" src="${esc(m.img)}" alt="" onerror="this.outerHTML='${m.face}'">` : m.face}</span>`).join('')}<small>${G.ratings(t.team).power}</small></div>`;
  const result = done ? (sc.a > sc.b ? ['WIN!', '🏆 かったよ! ナイスゲーム!'] : sc.a < sc.b ? ['LOSE', 'ざんねん…! つぎは かてるよ。れんしゅうで つよく なろう!'] : ['DRAW', 'ひきわけ! いい しあいだったね']) : null;
  return `<div class="quiz-top"><span></span><div class="scoreboard"><span class="sb-l">${esc(B.me.name)} <b>${sc.a}</b></span><span class="sb-m">-</span><span class="sb-r"><b>${sc.b}</b> ${esc(B.opp.name)}</span></div><span></span></div>
    <main><section class="panel"><div class="vs">${sideHtml(B.me)}<b>VS</b>${sideHtml(B.opp)}</div>
    <div class="blog">${ev.map((e, i) => `<div class="bl ${e.type} ${e.side === 'a' ? 'me' : 'op'} ${i === ev.length - 1 ? 'new' : ''}"><i>${e.type === 'goal' ? '⚽' : e.type === 'save' ? '🧤' : '💨'}</i><span>${esc(e.text)}</span></div>`).join('') || '<div class="muted">キックオフ…!</div>'}</div>
    ${done ? `<div class="bresult ${sc.a > sc.b ? 'win' : sc.a < sc.b ? 'lose' : ''}"><b>${result[0]}</b><p>${result[1]}</p></div>` : '<button class="btn small gray" data-act="battleskip">⏩ とばす</button>'}
    <button class="btn gold" data-act="battleend">${done ? 'もどる' : 'やめる'}</button></section></main>`;
}

// ---- 操作 ----------------------------------------------------------------------
// 処理したら true(app.js が あとで 画面を かきなおす)
export function onAct(a, el) {
  const p = X.p ? X.p() : null;
  switch (a) {
    case 'login': {
      const r = G.claimLogin(p, X.today()); if (!r) return true;
      X.save(); X.fx.confetti(vw() / 2, vh() * 0.35, 90, 1.4); X.fx.beep('win'); X.fx.vibrate([50, 40, 80]);
      X.toast(`ログインボーナス ${r.n}日め!  ${rewardText(r.reward)}`); return true;
    }
    case 'pull': {
      const t = el.dataset.t; const n = Math.min(Number(el.dataset.n) || 1, p.tickets[t]);
      const results = [];
      for (let i = 0; i < n; i++) { const r = G.pull(p, t); if (r) results.push(r); }
      if (!results.length) return true;
      X.save(); Gs.phase = 'rolling'; Gs.ticket = t; Gs.results = results;
      X.fx.vibrate([30, 30, 30]);
      setTimeout(() => { Gs.phase = 'reveal'; revealFx(results); X.render(); }, 1500);
      return true;
    }
    case 'gachaclose': Gs.phase = 'idle'; return true;
    case 'sub': UI.sub = el.dataset.sub; UI.slot = null; UI.dexSel = null; return true;
    case 'slot': UI.slot = UI.slot === Number(el.dataset.i) ? null : Number(el.dataset.i); return true;
    case 'place': {
      const i = Number(el.dataset.i); const id = el.dataset.id || null;
      const was = p.team[i];
      if (id) { const j = p.team.indexOf(id); if (j >= 0 && j !== i) p.team[j] = was || null; } // いれかえ
      p.team[i] = id;
      UI.slot = null; X.save(); X.fx.beep('ok'); return true;
    }
    case 'equip': {
      const id = el.dataset.id; const j = p.equip.indexOf(id);
      if (j >= 0) p.equip.splice(j, 1);
      else if (p.equip.length >= G.MAX_EQUIP) { X.toast(`そうびは ${G.MAX_EQUIP}つまで。どれかを はずしてね`); return true; }
      else p.equip.push(id);
      X.save(); return true;
    }
    case 'dexf': UI.dexF = el.dataset.r; UI.dexSel = null; return true;
    case 'dexsel': UI.dexSel = UI.dexSel === el.dataset.id ? null : el.dataset.id; return true;
    case 'upgrade': {
      if (G.upgrade(p, el.dataset.s)) { X.save(); X.fx.beep('ok'); X.fx.vibrate(20); X.fx.floaty('UP!', vw() / 2, vh() * 0.4); }
      return true;
    }
    case 'fight': return startFight(el.dataset.opp);
    case 'battleskip': if (B) { B.i = B.res.events.length; clearTimeout(timer); finishBattle(); } return true;
    case 'battleend': clearTimeout(timer); B = null; X.setView('kid'); return true;
    default: return false;
  }
}
export function resetBattle() { clearTimeout(timer); B = null; }
