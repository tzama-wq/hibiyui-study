// ガチャ・ずかん・へんせい・つよくなる・たいせんの「画面」。
// app.js から ctx(状態や共通の道具)を わたして つかう。DOM には さわらず、HTML文字列を かえす。
import * as G from './game.js';
import { DEFAULTS, gachaLeft, addGachaPulls } from './cfg.js';
import { createMatch } from './match.js';

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
  if (Array.isArray(p.team) && p.team.length === 5) p.team = G.migrateTeam(p.team); // 5にんの ころの へんせいを ひきつぐ
  if (!Array.isArray(p.team) || p.team.length !== G.TEAM_SIZE) p.team = G.migrateTeam(['self']);
  if (!G.FORMATIONS.some((f) => f.id === p.formation)) p.formation = '442';
  G.ensureCup(p);
  p.plv = p.plv && typeof p.plv === 'object' ? p.plv : {};
  p.equip = Array.isArray(p.equip) ? p.equip.slice(0, G.MAX_EQUIP) : [];
  p.pts = { ...G.emptyStatMap(), ...(p.pts || {}) };
  p.lv = { ...G.emptyStatMap(), ...(p.lv || {}) };
  p.battles = p.battles || { w: 0, l: 0, d: 0 };
  if (!p.starter) { G.addTickets(p, { bronze: 3, silver: 1 }); p.starter = true; } // はじめての 1回ぶん
}

export const kidImg = (k) => `images/players/self_${k.id}.webp`; // ダイヤモンドレアの じぶんカード
export const kidCardOf = (k, p) => ({ name: k.name, face: k.em, img: kidImg(k), stats: G.kidStats(p) });
export const snapshotOf = (k, p) => G.teamSnapshot({ kid: kidCardOf(k, p), owned: p.owned, team: p.team, equip: p.equip, formation: p.formation, plv: p.plv });
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
  const lv = (pl.level ? ` Lv${pl.level}` : '') + (pl.enh ? `+${pl.enh}` : '');
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
  const lim = gachaLeft(p, X.cfg ? X.cfg() : DEFAULTS, X.today()); // きょうの のこりかいすう(せいげんなしは Infinity)
  const total = G.TICKET_ORDER.reduce((a, t) => a + p.tickets[t], 0);
  const stage = Gs.phase === 'idle' ? '' : stageHtml();
  return `${stage}<section class="panel"><h2 class="sec">GACHA <small>ガチャ</small></h2>
    ${ticketBar(p)}
    <div class="muted">べんきょうで チケットが もらえるよ。ログインボーナスは つづけるほど ごうかに なるよ(やすんでも なくならない)。</div>
    ${(() => { const left = gachaLeft(p, X.cfg ? X.cfg() : DEFAULTS, X.today()); return left === Infinity ? '' : `<div class="muted">きょうの ガチャ: あと ${left}かい(チケットは のこしておけるよ)</div>`; })()}
    <div class="pull-list">${G.TICKET_ORDER.map((t) => {
    const n = p.tickets[t];
    return `<div class="pull-row tk-${t}"><div><b>${G.TICKETS[t].icon} ${G.TICKETS[t].name}</b><small>${G.RARITY_NAME[G.TICKETS[t].min]}いじょう かくてい</small></div>
        <button class="btn small" data-act="pull" data-t="${t}" data-n="1" ${n && lim > 0 ? '' : 'disabled'}>1かい</button>
        <button class="btn small gold" data-act="pull" data-t="${t}" data-n="${Math.min(10, n, lim)}" ${n >= 2 && lim >= 2 ? '' : 'disabled'}>まとめて ${Math.min(10, n, lim)}</button></div>`;
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
const SUBS = [['form', '🧩', 'へんせい'], ['dex', '📚', 'ずかん'], ['power', '💪', 'つよく'], ['cup', '🏆', 'たいかい'], ['battle', '⚔️', 'フリー'], ['mates', '🤝', 'かぞく']];
export function teamTab() {
  const body = { form: formHtml, dex: dexHtml, power: powerHtml, cup: cupHtml, battle: battleMenuHtml, mates: () => X.matesHtml() + famTeamsHtml() }[UI.sub]();
  return `<div class="subnav">${SUBS.map(([s, i, l]) => `<button class="${UI.sub === s ? 'on' : ''}" data-act="sub" data-sub="${s}"><span>${i}</span>${l}</button>`).join('')}</div>${body}`;
}

const rowsOf = (fid) => { // [FW のわく], [MF], [DF], [GK] の じゅんに、わくの ばんごうを ならべる
  const sl = G.slotsOf(fid); return ['FW', 'MF', 'DF', 'GK'].map((pos) => sl.map((s, i) => (s === pos ? i : -1)).filter((i) => i >= 0));
};
function formHtml() {
  const k = X.kid(); const p = X.p();
  const slots = G.slotsOf(p.formation);
  const snap = snapshotOf(k, p); const r = G.ratings(snap);
  const rows = rowsOf(p.formation);
  const slotHtml = (i) => `<button class="slot ${UI.slot === i ? 'sel' : ''}" data-act="slot" data-i="${i}"><small>${slots[i]}</small>${cardHtml(snap[i], { stats: false })}</button>`;
  return `<section class="panel"><h2 class="sec">FORMATION <small>へんせい</small></h2>
    <div class="power"><span>⚔ ${Math.round(r.att)}</span><span>🛡 ${Math.round(r.def)}</span><b>パワー ${r.power}</b></div>
    <div class="chips fchips">${G.FORMATIONS.map((f) => `<button class="chipb ${p.formation === f.id ? 'on' : ''}" data-act="formation" data-f="${f.id}">${f.name}</button>`).join('')}</div>
    <div class="muted">${G.formationOf(p.formation).name}: ${G.formationOf(p.formation).desc}(かたちで こうげき・まもりが ちょっと かわるよ)</div>
    <div class="formation">${rows.map((row) => `<div class="frow n${row.length}">${row.map(slotHtml).join('')}</div>`).join('')}</div>
    <div class="muted">わくを おして、えらぼう。ポジションが ちがうと ⚠ よわくなるよ(じぶんは どこでも OK)。</div>
    <button class="btn small gold" data-act="auto">✨ おまかせで あいている わくを うめる</button>
    ${UI.slot !== null ? pickerHtml(k, p) : ''}</section>${equipHtml(p)}`;
}
function pickerHtml(k, p) {
  const i = UI.slot; const pos = G.slotsOf(p.formation)[i];
  const placed = new Set(p.team.filter(Boolean));
  const owned = Object.keys(p.owned).map(playerOf).filter(Boolean)
    .sort((a, b) => (b.pos === pos) - (a.pos === pos) || G.RARITIES.indexOf(b.rarity) - G.RARITIES.indexOf(a.rarity) || ovrOf(b.stats, b.pos) - ovrOf(a.stats, a.pos));
  const opt = (id, pl, lv) => `<button class="opt ${p.team[i] === id ? 'cur' : ''}" data-act="place" data-i="${i}" data-id="${id}">${cardHtml({ ...pl, level: lv, offPos: pl.pos !== 'ALL' && pl.pos !== pos }, { stats: false, cls: 'mini' })}
    <span class="opt-info"><b>${esc(pl.name)}</b><small>${pl.pos === 'ALL' ? 'どこでも OK' : pl.pos === pos ? '◎ ぴったり' : '⚠ ポジションが ちがう'}${placed.has(id) && p.team[i] !== id ? ' ・ ほかの わくに いるよ(いれかえ)' : ''}</small></span></button>`;
  const selfSnap = { name: k.name, face: k.em, img: kidImg(k), pos: 'ALL', rarity: 'kid', stats: G.kidStats(p) };
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
    ${sel && p.owned[sel.id] ? `<div class="dex-detail">${cardHtml({ ...sel, level: G.levelOf(p.owned[sel.id]) }, { copies: p.owned[sel.id] })}<div class="muted">${esc(sel.name)} ・ ${G.POS_NAME[sel.pos]}${sel.nation ? ` ${sel.nation}` : ''}<br>${sel.type ? `<b>${esc(sel.type)}</b><br>` : ''}おなじ 選手が ダブると レベルアップ(さいだい Lv5 ・ 1レベルで のうりょく +4%)</div></div>${enhHtml(sel, p)}` : ''}
    <div class="muted" style="margin-bottom:6px">※ 有名な 選手を ヒントに した オリジナルの キャラクターだよ(ほんにんとは かんけい ないよ)。</div>
    <div class="dex-grid">${list.map((pl) => p.owned[pl.id]
    ? `<button class="dx got r-${pl.rarity}" data-act="dexsel" data-id="${pl.id}"><span>${pl.img ? `<img class="dx-img" src="${esc(pl.img)}" alt="" loading="lazy" onerror="this.outerHTML='${pl.face}'">` : pl.face}</span><small>${esc(pl.name)}</small>${p.owned[pl.id] > 1 ? `<em>×${p.owned[pl.id]}</em>` : ''}</button>`
    : `<div class="dx r-${pl.rarity}"><span>？</span><small>${G.RARITY_NAME[pl.rarity]}</small></div>`).join('')}</div></section>`;
}

// ガチャ選手の きょうか(ポイントで)
function enhHtml(pl, p) {
  const e = (p.plv || {})[pl.id] || 0; const cost = G.enhCost(e, pl.rarity); const have = G.totalPoints(p);
  const can = e < G.ENH_MAX && have >= cost;
  return `<div class="enh"><b>💪 きょうか +${e}/${G.ENH_MAX}</b><small>ポイントで のうりょくが 1かい +3% ふえるよ(いまの ポイント ${have})</small>
    <button class="btn small ${can ? 'gold' : 'gray'}" data-act="penh" data-id="${pl.id}" ${can ? '' : 'disabled'}>${e >= G.ENH_MAX ? 'MAX' : `きょうか! (${cost}pt)`}</button></div>`;
}
function powerHtml() {
  const k = X.kid(); const p = X.p();
  const SUBJ = Object.fromEntries(Object.entries(G.SUBJECT_STAT).map(([sj, st]) => [st, sj]));
  return `<section class="panel"><h2 class="sec">POWER UP <small>つよくなる</small></h2>
    <div class="muted">べんきょうで せいかいすると、ポイントが たまるよ。ポイントで ${k.name}を つよくしよう! つよくなると、いつか レジェンド(さいだい 99)も こえられるよ。</div>
    <div class="kidcard">${cardHtml({ name: k.name, face: k.em, img: kidImg(k), pos: 'ALL', rarity: 'kid', stats: G.kidStats(p) }, { stats: false })}</div>
    ${G.STATS.map((s) => {
    const lv = p.lv[s]; const cost = G.upgradeCost(lv); const can = p.pts[s] >= cost && lv < G.MAX_LEVEL;
    return `<div class="stat-row"><div class="sr-name"><b>${G.STAT_NAME[s]}</b><small>${SUBJ[s]}で ゲット</small></div>
        <div class="sr-bar"><i style="width:${Math.min(100, (G.kidStat(lv) / 150) * 100)}%"></i><u style="left:${(99 / 150) * 100}%"></u></div>
        <div class="sr-val"><b>${G.kidStat(lv)}</b><small>Lv${lv}</small></div>
        <button class="btn small ${can ? 'gold' : 'gray'}" data-act="upgrade" data-s="${s}" ${can ? '' : 'disabled'}>${lv >= G.MAX_LEVEL ? 'MAX' : `+ (${cost})`}</button>
        <div class="sr-pts">${p.pts[s]}pt</div></div>`;
  }).join('')}
    <div class="muted">縦の線(|)が レジェンドの さいだい(99)。</div>
    <div class="muted">💎 ガチャで ゲットした 選手も、おなじ ポイントで「きょうか」できるよ(ポイントは すこし おおく いるよ)。「ずかん」で 選手を おして ためそう。(ポイント ぜんぶで ${G.totalPoints(p)})</div></section>`;
}

// ---- 対戦 ----------------------------------------------------------------------
let B = null; let timer = null; let M = null;
// かぞくの チームの へんせいを みる(みるだけ)
function famTeamsHtml() {
  const others = X.KIDS.filter((k) => k.id !== X.kid().id);
  return others.map((o) => {
    const d = X.dataFor(o);
    if (!Array.isArray(d.team) || d.team.length !== G.TEAM_SIZE) return `<section class="panel"><h2 class="sec">TEAM <small>${esc(o.name)}の チーム</small></h2><div class="muted">まだ とどいてないよ(${esc(o.name)}が アプリを ひらくと みえるよ)</div></section>`;
    const sl = d.team.map((m) => m.slot);
    const fm = G.FORMATIONS.find((f) => f.fw === sl.filter((x) => x === 'FW').length && f.mf === sl.filter((x) => x === 'MF').length && f.df === sl.filter((x) => x === 'DF').length);
    const row = (pos) => `<div class="frow n${d.team.filter((m) => m.slot === pos).length}">${d.team.filter((m) => m.slot === pos).map((m) => `<div class="slot">${cardHtml({ ...m }, { stats: false })}</div>`).join('')}</div>`;
    return `<section class="panel"><h2 class="sec">TEAM <small>${esc(o.name)}の チーム</small></h2>
      <div class="power"><b>パワー ${G.ratings(d.team).power}</b><span>${fm ? fm.name : ''}</span></div>
      <div class="formation">${['FW', 'MF', 'DF', 'GK'].map(row).join('')}</div>
      <div class="muted">${esc(o.name)}の いまの へんせいだよ(みるだけ)。たいせんは「たいせん」から!</div></section>`;
  }).join('');
}
// かぞく(ひびと・ゆいと・パパ)の うち、チームの きろくが とどいている 人
function mateOpponents() {
  return X.KIDS.filter((k) => k.id !== X.kid().id).map((other) => {
    const d = X.dataFor(other);
    if (Array.isArray(d.team) && d.team.length === G.TEAM_SIZE) return { id: other.id, name: `${other.name}の チーム`, team: d.team, power: G.ratings(d.team).power };
    return null;
  }).filter(Boolean);
}
const mateOpponent = (id) => { const l = mateOpponents(); return id ? l.find((m) => m.id === id) : l[0]; };
function battleMenuHtml() {
  const k = X.kid(); const p = X.p();
  const snap = snapshotOf(k, p); const r = G.ratings(snap);
  const mates = mateOpponents();
  return `<section class="panel"><h2 class="sec">MATCH <small>たいせん</small></h2>
    <div class="power"><b>${k.name}の チーム パワー ${r.power}</b><span>${p.battles.w}勝 ${p.battles.d}分 ${p.battles.l}敗</span></div>
    <div class="muted">へんせいした チームで たいせん! (どちらが かつかは うんも あるよ)</div>
    ${mates.length ? mates.map((mate) => `<button class="match-btn alt" data-act="fight" data-opp="mate:${mate.id}"><small>VS FAMILY</small><b>⚔️ ${esc(mate.name)}と たいせん</b><span>あいての パワー ${mate.power}</span></button>`).join('') : '<div class="muted">かぞくの チームは、かぞくが アプリを ひらくと あらわれるよ。</div>'}
    ${p.lastMatch ? `<div class="replay"><b>🎬 まえの しあい</b> <span>${esc(p.lastMatch.me.name)} ${p.lastMatch.score.a} - ${p.lastMatch.score.b} ${esc(p.lastMatch.opp.name)}</span>
      <div class="row"><button class="btn small gold" data-act="replaylast" data-mode="digest">✨ ダイジェスト(ゴールだけ)</button><button class="btn small gray" data-act="replaylast" data-mode="full">🎬 ぜんぶ みる</button></div></div>` : ''}
    <div class="cpu-list">${G.CPU_LEVELS.map((l) => `<button class="btn gray" data-act="fight" data-opp="cpu:${l.id}">⚔ ${l.club}<small>(${l.name} ・ てきの パワー ${l.power} ・ ${stars(estimateVs(l.power))})</small></button>`).join('')}</div></section>`;
}
const slim = (t) => ({ name: t.name, power: G.ratings(t.team).power, team: t.team.map((m) => ({ id: m.id, name: m.name, slot: m.slot, rarity: m.rarity })) });
const animOn = () => !(X.cfg && X.cfg().calm); // 「うごきを へらす」ときは 映像を だして うごかさない
function startFight(oppId) {
  const k = X.kid(); const p = X.p();
  const me = { name: `${k.name}の チーム`, team: snapshotOf(k, p) };
  let opp;
  if (oppId === 'mate' || oppId.startsWith('mate:')) { const m = mateOpponent(oppId.split(':')[1]); if (!m) return false; opp = { name: m.name, team: m.team }; }
  else opp = G.cpuTeam(oppId.split(':')[1], Math.random, G.FORMATIONS[Math.floor(Math.random() * G.FORMATIONS.length)].id);
  const res = G.simulate(me, opp);
  const pk = res.score.a === res.score.b ? G.shootout(G.ratings(me.team).power, G.ratings(opp.team).power) : null; // どうてん → PK戦
  openBattle({ me: slim(me), opp: slim(opp), res, pk, counted: false, mode: 'full' });
  return true;
}
// ---- たいかい ----------------------------------------------------------------------
// かてそう度(★1〜5): 同じ つよさの あいてだと ★★★
const stars = (w) => { const n = w >= 0.8 ? 5 : w >= 0.6 ? 4 : w >= 0.4 ? 3 : w >= 0.2 ? 2 : 1; return `かてそう ${'★'.repeat(n)}${'☆'.repeat(5 - n)}`; };
const estimateVs = (power) => { const k = X.kid(); const p = X.p(); return G.winChance({ name: 'a', team: snapshotOf(k, p) }, G.cpuTeamAt(power, 'x'), 100); };
function cupHtml() {
  const p = X.p(); const c = G.ensureCup(p); const k = X.kid(); const my = G.ratings(snapshotOf(k, p)).power;
  return `<section class="panel"><h2 class="sec">CUP <small>たいかい</small></h2>
    <div class="power"><b>いまの パワー ${my}</b><span>ゆうしょう ${c.cleared.length}/${G.CUPS.length}</span></div>
    <div class="muted">じゅんばんに かって、つぎの たいかいへ! かてば つぎの ラウンド、まけると はいたい(1かいせんから)。ガチャで 選手を あつめて、つよく なろう。</div></section>
    ${G.CUPS.map((cup, ci) => {
    const open = G.cupUnlocked(p, cup.id); const done = c.cleared.includes(cup.id); const round = G.cupRound(p, cup.id);
    const r = cup.rounds[round];
    const dots = cup.rounds.map((x, i) => `<i class="${i < round ? 'won' : i === round && open ? 'cur' : ''}"></i>`).join('');
    if (!open) return `<section class="panel cup locked"><h3>🔒 ${cup.icon} ${cup.name}</h3><div class="muted">${G.CUPS[ci - 1].name}で ゆうしょうすると ひらくよ</div></section>`;
    const opp = G.cupOpponent(cup, round);
    const w = G.winChance({ name: 'a', team: snapshotOf(k, p) }, opp, 120);
    return `<section class="panel cup ${done ? 'done' : ''}"><h3>${cup.icon} ${cup.name} ${done ? `<em class="trophy">🏆×${c.titles[cup.id] || 1}</em>` : ''}</h3>
      <div class="muted">${cup.sub}</div><div class="cdots">${dots}</div>
      <div class="cnext"><small>${c.run && c.run.id === cup.id ? 'つづき ' : ''}ラウンド ${round + 1}/${cup.rounds.length}:${r.label}</small>
        <b>VS ${esc(r.name)}</b><span>てきの パワー ${r.power} ・ ${G.STYLE_NAME[r.style]}</span><span class="muted">${stars(w)}</span></div>
      <button class="btn gold" data-act="cupfight" data-cup="${cup.id}">⚔ ${done ? 'もういちど ちょうせん' : 'しあいに すすむ'}</button></section>`;
  }).join('')}`;
}
function startCup(id) {
  const k = X.kid(); const p = X.p();
  if (!G.cupUnlocked(p, id)) { X.toast('まえの たいかいで ゆうしょうすると ひらくよ'); return true; }
  const cup = G.cupById(id); const round = G.cupRound(p, id);
  p.cup.run = { id, round };
  const me = { name: `${k.name}の チーム`, team: snapshotOf(k, p) };
  const opp = G.cupOpponent(cup, round);
  const res = G.simulate(me, opp);
  const pk = res.score.a === res.score.b ? G.shootout(G.ratings(me.team).power, G.ratings(opp.team).power) : null;
  openBattle({ me: slim(me), opp: slim(opp), res, pk, counted: false, mode: 'full', cup: { id, round } });
  return true;
}
// しあいを ひらく(あたらしい しあい / まえの しあいの リプレイ)
function openBattle(b) {
  stopMatch(); clearTimeout(timer);
  const all = b.res.events.map((e, i) => ({ ...e, idx: i, total: b.res.events.length }));
  let evs = all;
  if (b.mode === 'digest') { evs = all.filter((e) => e.type === 'goal'); if (!evs.length) evs = all.filter((e) => e.type === 'save'); if (!evs.length) evs = all.slice(0, 4); }
  B = { ...b, evs, i: 0, speed: 1, anim: animOn(), matchDone: false, banner: '', pkShown: null };
  X.setView('battle');
  if (B.anim) {
    M = createMatch({ me: B.me, opp: B.opp, events: evs, speed: B.speed, pk: b.pk ? G.pkKicks(b.pk) : null, callbacks: {
      onPk: ({ phase, kick, shown }) => { if (!B) return; B.pkShown = phase === 'result' ? shown : shown; if (phase === 'result') { X.fx.beep(kick.ok ? (kick.side === 'a' ? 'ok' : 'ng') : 'ng'); if (kick.ok && kick.side === 'a') X.fx.confetti(vw() / 2, vh() * 0.3, 30, 1); } hudUpdate(); },
      onEvent: ({ phase, i, ev }) => {
        if (!B) return;
        if (phase === 'start') { B.minute = Math.round(((ev.idx + 0.5) / ev.total) * 90); hudUpdate(); }
        if (phase === 'result') {
          B.i = i + 1;
          if (ev.type === 'goal') { X.fx.beep(ev.side === 'a' ? 'ok' : 'ng'); X.fx.vibrate(ev.side === 'a' ? 30 : 15); if (ev.side === 'a') X.fx.confetti(vw() / 2, vh() * 0.3, 40, 1); }
          hudUpdate(true);
        }
      },
      onBanner: (t) => { B.banner = t; hudUpdate(); setTimeout(() => { if (B && B.banner === t) { B.banner = ''; hudUpdate(); } }, 1500); },
      onEnd: () => { if (!B) return; B.i = B.evs.length; B.matchDone = true; B.minute = 90; finishBattle(); X.render(); },
    } });
  } else tickBattle();
}
function cupOutHtml() {
  const o = B.cupOut; const cup = G.cupById(B.cup.id);
  const rw = (Object.keys(o.reward || {}).length ? `<p>${rewardText(o.reward)} を ゲット!</p>` : '') + (o.capped ? `<p class="muted">きょうの くりかえしの チケットは ここまで(1日 ${G.MATCH_TICKET_CAP}まい)。はじめて かった ラウンドの チケットは ふくまれないよ。</p>` : '');
  if (o.type === 'cleared') return `<div class="cupout win"><b>🏆 ${cup.name} ゆうしょう!</b>${rw}${o.first ? '<p>メダルを ゲットしたよ!(チームが ちょっと つよくなる)</p>' : ''}<button class="btn gold" data-act="sub" data-sub="cup">たいかいへ もどる</button></div>`;
  if (o.type === 'advance') return `<div class="cupout win"><b>✅ しょうり! つぎの ラウンドへ</b>${rw}<p>つぎ: ${cup.rounds[o.round].label} ― ${esc(cup.rounds[o.round].name)}</p><button class="btn gold" data-act="cupfight" data-cup="${cup.id}">⚔ つぎの しあいへ</button></div>`;
  if (o.type === 'retry') return `<div class="cupout"><b>ざんねん…!</b><p>おなじ しあいから もういちど ちょうせんできるよ。</p><button class="btn gold" data-act="cupfight" data-cup="${cup.id}">⚔ もういちど</button></div>`;
  return `<div class="cupout lose"><b>はいたい…</b><p>${cup.name}は 1かいせんから やりなおし。ガチャで 選手を あつめて、れんしゅうで つよく なって また ちょうせんしよう!</p><button class="btn gray" data-act="cupfight" data-cup="${cup.id}">⚔ 1かいせんから</button></div>`;
}
function stopMatch() { if (M) { M.destroy(); M = null; } }
const scoreNow = () => { if (B.matchDone || (!B.anim && B.i >= B.evs.length)) return B.res.score; const e = B.evs[B.i - 1]; return e ? e.score : { a: 0, b: 0 }; };
// がめんを つくりなおさずに、スコアなどを その場で かきかえる(映像の canvas を こわさない)
function hudUpdate(addLog) {
  if (!B || typeof document === 'undefined') return;
  const sc = scoreNow(); const q = (id) => document.getElementById(id);
  if (q('bsa')) q('bsa').textContent = sc.a; if (q('bsb')) q('bsb').textContent = sc.b;
  if (q('bpk')) q('bpk').outerHTML = pkRow();
  if (q('bmin')) q('bmin').textContent = B.matchDone ? 'おわり' : B.minute ? `${B.minute < 46 ? '前半' : '後半'} ${B.minute}分` : 'キックオフ';
  if (q('bban')) { q('bban').textContent = B.banner || ''; q('bban').className = `bban ${B.banner ? 'on' : ''}`; }
  if (addLog && q('blog')) { const e = B.evs[B.i - 1]; if (e) { q('blog').insertAdjacentHTML('beforeend', logRow(e, true)); q('blog').scrollTop = q('blog').scrollHeight; const em = q('blog').querySelector('.muted'); if (em) em.remove(); } }
}
// PK戦の ひょう(⚽ ゴール ・ 🧤 セーブ ・ ✖ はずれ)。しあい中は けった ぶんだけ
function pkRow() {
  if (!B || !B.pk) return '<span id="bpk"></span>';
  const all = G.pkKicks(B.pk);
  const kicks = !B.anim || B.matchDone ? all : B.pkShown;
  if (!kicks) return '<span id="bpk"></span>';
  const mark = (s) => kicks.filter((k) => k.side === s).map((k) => (k.ok ? '⚽' : k.kind === 'save' ? '🧤' : '✖')).join(' ') || '…';
  const sc = (s) => kicks.filter((k) => k.side === s && k.ok).length;
  return `<div id="bpk" class="bpk"><b>PK戦</b><div><span>${esc(B.me.name)} <em>${sc('a')}</em></span><small>${mark('a')}</small></div><div><span>${esc(B.opp.name)} <em>${sc('b')}</em></span><small>${mark('b')}</small></div></div>`;
}
const logRow = (e, isNew) => `<div class="bl ${e.type} ${e.side === 'a' ? 'me' : 'op'} ${isNew ? 'new' : ''}"><i>${e.type === 'goal' ? '⚽' : e.type === 'save' ? '🧤' : '💨'}</i><span>${esc(e.text)}</span></div>`;
function tickBattle() { // 「うごきを へらす」ときの ぶんしょうだけの しあい
  clearTimeout(timer);
  if (!B || B.i >= B.evs.length) { finishBattle(); return; }
  timer = setTimeout(() => {
    if (!B) return;
    B.i++;
    const ev = B.evs[B.i - 1];
    if (ev.type === 'goal') { X.fx.beep(ev.side === 'a' ? 'ok' : 'ng'); X.fx.vibrate(ev.side === 'a' ? 30 : 15); if (ev.side === 'a') X.fx.confetti(vw() / 2, vh() * 0.3, 40, 1); }
    X.render();
    tickBattle();
  }, 1250);
}
function finishBattle() {
  if (!B || B.counted) return;
  B.counted = true;
  const p = X.p(); const s = B.res.score;
  const won = s.a > s.b || (s.a === s.b && B.pk && B.pk.a > B.pk.b);
  if (won) p.battles.w++; else if (s.a < s.b || B.pk) p.battles.l++; else p.battles.d++;
  if (B.cup) B.cupOut = G.cupResult(p, B.cup.id, B.cup.round, won, !!(X.cfg && X.cfg().forgive), X.today());
  if (B.pk && won) p.pkWins = (p.pkWins || 0) + 1;
  p.lastMatch = { pk: B.pk || null, me: B.me, opp: B.opp, score: { ...s }, events: B.res.events.map(({ side, type, passer, shooter, keeper, score, text }) => ({ side, type, passer, shooter, keeper, score, text })) };
  X.save();
  if (won) { X.fx.confetti(vw() / 2, vh() * 0.35, 120, 1.5); X.fx.beep('win'); }
}
export function battleView() {
  if (!B) return '<main><div class="muted">たいせんが ないよ</div><button class="btn gold" data-act="battleend">もどる</button></main>';
  const done = B.anim ? B.matchDone : B.i >= B.evs.length;
  const sc = done ? B.res.score : scoreNow();
  const shown = B.evs.slice(0, B.i);
  const won = sc.a > sc.b || (sc.a === sc.b && B.pk && B.pk.a > B.pk.b);
  const result = done ? (won ? ['WIN!', B.pk ? `🏆 PK戦 ${B.pk.a}-${B.pk.b} で かったよ!` : '🏆 かったよ! ナイスゲーム!'] : sc.a < sc.b || B.pk ? ['LOSE', B.pk ? `PK戦 ${B.pk.a}-${B.pk.b}…ざんねん! つぎは かてるよ。` : 'ざんねん…! つぎは かてるよ。れんしゅうで つよく なろう!'] : ['DRAW', 'ひきわけ! いい しあいだったね']) : null;
  const cupPanel = done && B.cupOut ? cupOutHtml() : '';
  const teamHtml = (t) => `<div class="bteam"><b>${esc(t.name)}</b><small>パワー ${t.power}</small></div>`;
  if (B.anim && M) setTimeout(() => { const cv = typeof document !== 'undefined' && document.getElementById('mcv'); if (cv && M) M.attach(cv); }, 0);
  return `<div class="quiz-top"><span></span><div class="scoreboard"><span class="sb-l">${esc(B.me.name)} <b id="bsa">${sc.a}</b></span><span class="sb-m">-</span><span class="sb-r"><b id="bsb">${sc.b}</b> ${esc(B.opp.name)}</span></div><span></span></div>
    <main><section class="panel"><div class="vs">${teamHtml(B.me)}<b>VS</b>${teamHtml(B.opp)}</div>
    ${B.anim ? `<div class="mwrap"><canvas id="mcv" class="mcv" aria-label="しあいの えいぞう"></canvas><span id="bmin" class="bmin">${done ? 'おわり' : B.minute ? `${B.minute < 46 ? '前半' : '後半'} ${B.minute}分` : 'キックオフ'}</span><div id="bban" class="bban ${B.banner ? 'on' : ''}">${esc(B.banner)}</div></div>` : ''}
    ${pkRow()}
    <div class="blog" id="blog">${shown.map((e) => logRow(e)).join('') || '<div class="muted">キックオフ…!</div>'}</div>
    ${done ? `<div class="bresult ${won ? 'win' : sc.a < sc.b || B.pk ? 'lose' : ''}"><b>${result[0]}</b><p>${result[1]}</p></div>
      ${cupPanel}<div class="row"><button class="btn small gold" data-act="replaylast" data-mode="digest">✨ ダイジェストを みる</button><button class="btn small gray" data-act="replaylast" data-mode="full">🎬 もういちど ぜんぶ</button></div>`
    : `<div class="row"><button class="btn small gray" data-act="battlespeed">⏩ ${B.speed > 1 ? 'ふつうに もどす' : 'はやおくり'}</button><button class="btn small gray" data-act="battleskip">⏭ とばす</button></div>`}
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
      const t = el.dataset.t; const c = X.cfg ? X.cfg() : DEFAULTS;
      const left = gachaLeft(p, c, X.today());
      if (left === 0) { X.toast('きょうの ガチャは ここまで! チケットは とっておけるよ。また あしたね'); return true; }
      const n = Math.min(Number(el.dataset.n) || 1, p.tickets[t], left);
      const results = [];
      for (let i = 0; i < n; i++) { const r = G.pull(p, t); if (r) results.push(r); }
      if (!results.length) return true;
      addGachaPulls(p, X.today(), results.length);
      X.save(); Gs.ticket = t; Gs.results = results;
      if (c.calm) { Gs.phase = 'reveal'; revealFx(results); return true; } // 「うごきを へらす」ときは カプセルの えんしゅつを とばして すぐ みせる
      Gs.phase = 'rolling';
      X.fx.vibrate([30, 30, 30]);
      setTimeout(() => { Gs.phase = 'reveal'; revealFx(results); X.render(); }, 1500);
      return true;
    }
    case 'gachaclose': Gs.phase = 'idle'; return true;
    case 'sub': UI.sub = el.dataset.sub; UI.slot = null; UI.dexSel = null; return true;
    case 'formation': {
      const f = el.dataset.f; if (f === p.formation) return true;
      const posOf = (id) => (id === 'self' ? 'ALL' : (playerOf(id) || {}).pos);
      p.team = G.refitTeam(p.team, G.slotsOf(f), posOf); p.formation = f;
      UI.slot = null; X.save(); X.fx.beep('ok'); X.toast(`${G.formationOf(f).name}に かえたよ`); return true;
    }
    case 'slot': UI.slot = UI.slot === Number(el.dataset.i) ? null : Number(el.dataset.i); return true;
    case 'place': {
      const i = Number(el.dataset.i); const id = el.dataset.id || null;
      const was = p.team[i];
      if (id) { const j = p.team.indexOf(id); if (j >= 0 && j !== i) p.team[j] = was || null; } // いれかえ
      p.team[i] = id;
      UI.slot = null; X.save(); X.fx.beep('ok'); return true;
    }
    case 'auto': { // あいている わくに、ポジションの あう つよい選手を いれる
      const placed = new Set(p.team.filter(Boolean));
      const pool = Object.keys(p.owned).map(playerOf).filter(Boolean);
      let n = 0;
      for (let i = 0; i < G.TEAM_SIZE; i++) {
        if (p.team[i]) continue;
        const pos = G.slotsOf(p.formation)[i];
        const best = pool.filter((x) => !placed.has(x.id))
          .sort((a, b) => (b.pos === pos) - (a.pos === pos) || ovrOf(b.stats, b.pos) - ovrOf(a.stats, a.pos))[0];
        if (best) { p.team[i] = best.id; placed.add(best.id); n++; }
      }
      X.save(); X.toast(n ? `${n}にん いれたよ!` : 'いれられる 選手が いないよ(ガチャで あつめよう)');
      return true;
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
    case 'penh': {
      if (G.enhance(p, el.dataset.id)) { X.save(); X.fx.beep('ok'); X.fx.vibrate(20); X.fx.floaty('きょうか!', vw() / 2, vh() * 0.4); } else X.toast('ポイントが たりないよ(べんきょうで ためよう)');
      return true;
    }
    case 'upgrade': {
      if (G.upgrade(p, el.dataset.s)) { X.save(); X.fx.beep('ok'); X.fx.vibrate(20); X.fx.floaty('UP!', vw() / 2, vh() * 0.4); }
      return true;
    }
    case 'fight': return startFight(el.dataset.opp);
    case 'cupfight': return startCup(el.dataset.cup);
    case 'battleskip': if (B) { clearTimeout(timer); if (M) M.skip(); else { B.i = B.evs.length; finishBattle(); } } return true;
    case 'battlespeed': if (B && M) { B.speed = B.speed > 1 ? 1 : 2.5; M.setSpeed(B.speed); X.render(); } return true;
    case 'replaylast': { const lm = p.lastMatch; if (!lm) return false; openBattle({ me: lm.me, opp: lm.opp, res: { events: lm.events, score: lm.score }, pk: lm.pk || null, counted: true, mode: el.dataset.mode }); return true; }
    case 'battleend': clearTimeout(timer); stopMatch(); B = null; X.setView('kid'); return true;
    default: return false;
  }
}
export function resetBattle() { clearTimeout(timer); stopMatch(); B = null; }
