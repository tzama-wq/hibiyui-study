// 「そらの まもり」(エースコンバット・アーマードコアふうの ゲームモード)の 画面: ミッション・かくのう庫(きたい)・しゅつげき・ごほうび。
// ガチャで ゲットした キャラが そのまま「きたい」に なる(レアど=きしゅ、ポジション=やくわり、のうりょく=きたいの つよさ)。
import * as G from './game.js';
import { machineOf, MISSIONS, missionById, TIERS, ROLES } from './airsim.js';
import { startAir3D } from './air3d.js';
import { createSfx } from './sfx.js';

let X; let SFX = null; let AG = null; let STARTING = false;
export function skyInit(ctx) { X = ctx; }
const esc = (s) => String(s).replace(/[<>&"]/g, '');
const vw = () => (typeof innerWidth === 'number' ? innerWidth : 360);
const vh = () => (typeof innerHeight === 'number' ? innerHeight : 640);
const RAR = { kid: 'エース', common: 'コモン', uncommon: 'アンコモン', rare: 'レア', super: 'スーパーレア', legend: 'レジェンド', diamond: 'ダイヤモンド' };

export const ensureSky = (p) => { p.sky = p.sky && typeof p.sky === 'object' ? p.sky : {}; p.sky.cleared = p.sky.cleared || {}; p.sky.pilot = p.sky.pilot || 'self'; p.sky.daily = p.sky.daily || { date: '', n: 0 }; return p.sky; };

// ---- きたいの いちらん ---------------------------------------------------------------
export function machinesOf(k, p) {
  const out = [];
  const selfSt = G.kidStats(p);
  out.push(machineOf({ id: 'self', name: k.name, face: k.em || '', img: `images/players/self_${k.id}.webp`, rarity: 'kid', pos: 'ALL', stats: selfSt }));
  for (const [id, n] of Object.entries(p.owned || {})) {
    const pl = G.PLAYER_BY_ID[id]; if (!pl || !n) continue;
    out.push(machineOf({ id, name: pl.name, face: pl.face || '', img: pl.img || '', rarity: pl.rarity, pos: pl.pos, stats: G.playerEffective(p, id) }));
  }
  return out.sort((a, b) => b.rating - a.rating);
}
const pickPilot = (ms, p) => ms.find((m) => m.id === (p.sky || {}).pilot) || ms[0];
const wingsOf = (ms, pilot) => ms.filter((m) => m.id !== pilot.id).slice(0, 2); // いちばん つよい 2き が なかま

// ---- がめん ----------------------------------------------------------------------
function statBars(m) {
  const row = (n, v, c) => `<div class="smr-row"><span>${n}</span><i><u style="width:${Math.min(100, (v / 200) * 100)}%;background:${c}"></u></i><b>${Math.round(v)}</b></div>`;
  return `${row('かりょく', m.gunDps, '#ff4d5e')}${row('そうこう', m.hpMax / 3, '#6fcf97')}${row('スピード', m.speed, '#27d8ff')}${row('ブースト', m.boostMax, '#a56de2')}${row('ロック', (1.2 - m.lockTime) * 120 + m.locks * 8, '#ffd23f')}`;
}
function machineCard(m, sel) {
  return `<div class="mcard ${sel ? 'sel' : ''} r-${m.rarity}" data-act="skypilot" data-id="${m.id}"><div class="mc-head"><span class="mc-face">${m.img ? `<img src="${esc(m.img)}" alt="" loading="lazy" onerror="this.outerHTML='${esc(m.face)}'">` : esc(m.face)}</span>
    <div><b>${esc(m.pilot)}</b><small>${RAR[m.rarity] || ''} ・ ${esc(m.role)}</small></div><em>${m.rating}</em></div>
    <div class="mc-tier">🛩️ ${esc(m.tier)} ・ ミサイル ${m.missiles}/ロック ${m.locks}</div>${statBars(m)}<div class="muted">${esc(m.note)}</div></div>`;
}
export function skyHome(k, p) {
  const sk = ensureSky(p); const ms = machinesOf(k, p); const pilot = pickPilot(ms, p); const wings = wingsOf(ms, pilot);
  const stars = (id) => { const s = sk.cleared[id] || 0; return s ? '★'.repeat(s) + '☆'.repeat(3 - s) : ''; };
  const unlocked = (i) => i === 0 || sk.cleared[MISSIONS[i - 1].id];
  const res = sk.last ? `<div class="skyres ${sk.last.win ? 'win' : 'lose'}"><b>${sk.last.win ? '🎖 クリア!' : 'ざんねん…'} ${esc(sk.last.name)}</b>${sk.last.win ? ` ${'★'.repeat(sk.last.stars)}` : ''}<div>${sk.last.rewardText ? `ごほうび: ${sk.last.rewardText}` : ''}</div><button class="btn small gray" data-act="skyclear">とじる</button></div>` : '';
  return `<section class="panel sky-home"><h2 class="sec">SKY GUARD <small>そらの まもり</small></h2>
    <div class="muted">ふめいの むじんきから にっぽんの そらを まもる ゲーム。ガチャで ゲットした キャラが きたいに なるよ。サッカーの のうりょく(つよさ・きょうか・きゅうしゅう)は ぜんぶ ひきつぐよ!</div>${res}
    <div class="sky-pilot"><b>しゅつげき きたい</b>${machineCard(pilot, true)}<div class="muted">なかま(じどうで うつ): ${wings.map((w) => `${esc(w.face)} ${esc(w.pilot)}(${esc(w.tier)})`).join(' ・ ') || 'まだ いないよ(ガチャで あつめよう)'}</div>
      <button class="btn small gray" data-act="tab" data-tab="team">🛠 かくのう庫で きたいを えらぶ</button></div>
    <h3 class="sec">MISSION <small>ミッション</small></h3>
    ${MISSIONS.map((m, i) => { const ok = unlocked(i); const power = pilot.rating; const hint = power >= m.recommend ? '✅ いけそう' : `⚠ おすすめ きたいパワー ${m.recommend}`;
      return `<div class="smission ${ok ? '' : 'lock'}"><div class="sm-ico">${ok ? m.icon : '🔒'}</div><div class="sm-body"><b>${i + 1}. ${esc(m.name)} <em>${stars(m.id)}</em></b><small>${esc(m.brief)}</small><span class="sm-hint">${hint}・ごほうび ${rewardText(m.reward)}${sk.cleared[m.id] ? '' : ` + はじめて ${rewardText(m.first || {})}`}</span></div>
        <button class="btn gold" data-act="skygo" data-m="${m.id}" ${ok ? '' : 'disabled'}>🛫 しゅつげき</button></div>`; }).join('')}
    <div class="muted">そうさ: ひだりの スティック=むきを かえる ・ きかんほう(おしっぱなし)・ミサイル(ロックして うつ)・ブースト・かいひ(ローリングで むてき)。いのちが へったら かいひ!</div></section>`;
}
export function hangarHtml(k, p) {
  const sk = ensureSky(p); const ms = machinesOf(k, p);
  const T = Object.entries(TIERS).map(([r, t]) => `<span class="tier r-${r}">${RAR[r] || r}=${t.name}</span>`).join('');
  return `<section class="panel"><h2 class="sec">HANGAR <small>かくのう庫</small></h2>
    <div class="muted">ガチャで ゲットした キャラが きたいに なるよ。タップして しゅつげき きたいを えらぼう。きょうか・レベル・きゅうしゅうで つよく なるよ!</div>
    <div class="tiers">${T}</div><div class="roles">${Object.entries(ROLES).map(([r, v]) => `<span><b>${r === 'ALL' ? 'エース' : G.POS_NAME[r]}</b>=${v.name}</span>`).join('')}</div>
    <div class="mlistc">${ms.map((m) => machineCard(m, m.id === sk.pilot)).join('')}</div></section>`;
}
const rewardText = (r) => [...G.TICKET_ORDER.filter((t) => r[t]).map((t) => `${G.TICKETS[t].icon}×${r[t]}`), ...(r.pts ? [`💪${r.pts}pt`] : []), ...(r.shards ? [`💠×${r.shards}`] : [])].join(' ') || '—';

// ---- あそぶ ----------------------------------------------------------------------
async function startMission(id) {
  if (STARTING) return false; STARTING = true;
  try {
    const k = X.kid(); const p = X.p(); const sk = ensureSky(p); const mis = missionById(id); if (!mis) return false;
    const ms = machinesOf(k, p); const pilot = pickPilot(ms, p); const wings = wingsOf(ms, pilot);
    X.toast('🛫 しゅつげき じゅんびちゅう…');
    SFX = SFX || createSfx(() => (X.quiet ? X.quiet() : false));
    const map = { gun: 'gun', missile: 'missile', boom: 'boom', bigboom: 'bigboom', hit: 'hit', basehit: 'basehit', warn: 'warn', evade: 'evade', spark: 'spark', win: 'win', lose: 'lose' };
    if (AG) { AG.destroy(); AG = null; }
    try {
      AG = await startAir3D({ machine: pilot, wings, mission: mis, gentle: !!(X.cfg && X.cfg().gentle), calm: !!(X.cfg && X.cfg().calm),
        onSfx: (n) => { if (SFX && map[n]) SFX.play(map[n]); },
        onQuit: () => { AG = null; X.render(); },
        onEnd: (r) => { AG = null; finishMission(mis, r); } });
    } catch (e) { AG = null; X.toast('3Dを ひらけなかったよ…'); return false; }
    void sk; return true;
  } finally { STARTING = false; }
}
function finishMission(mis, r) {
  const p = X.p(); const sk = ensureSky(p); const t = X.today();
  let reward = {}; let text = '';
  if (r.win) {
    const first = !sk.cleared[mis.id]; sk.cleared[mis.id] = Math.max(sk.cleared[mis.id] || 0, r.stars);
    if (first) reward = { ...mis.reward }; else {
      sk.daily = sk.daily.date === t ? sk.daily : { date: t, n: 0 };
      if (sk.daily.n < 3) { sk.daily.n++; reward = { ...mis.reward }; } else { reward = { pts: mis.reward.pts || 0 }; } // くりかえしの ごほうびは 1日 3かいまで(チケットは)
    }
    if (first && mis.first) for (const [kk, v] of Object.entries(mis.first)) reward[kk] = (reward[kk] || 0) + v;
    if (r.stars >= 3) reward.pts = (reward.pts || 0) + 3;
    const { pts, shards, ...tk } = reward; G.addTickets(p, tk);
    if (pts) { const SP = ['SHO', 'PAS', 'SPD', 'DEF', 'STA']; p.pts = { ...G.emptyStatMap(), ...(p.pts || {}) }; for (const s of SP) p.pts[s] += pts; }
    if (shards) G.addShards(p, shards);
    p.xp += 20 + r.stars * 10; text = rewardText(reward);
    X.fx.confetti(vw() / 2, vh() * 0.35, 140, 1.6); X.fx.beep('win');
  }
  sk.last = { win: r.win, stars: r.stars, name: mis.name, rewardText: text };
  X.save(); X.render();
}

export function onSkyAct(a, el) {
  const p = X.p ? X.p() : null; if (!p) return false;
  switch (a) {
    case 'skypilot': { ensureSky(p).pilot = el.dataset.id; X.save(); X.toast('しゅつげき きたいを かえたよ!'); return true; }
    case 'skygo': startMission(el.dataset.m); return true;
    case 'skyclear': { delete ensureSky(p).last; X.save(); return true; }
    default: return false;
  }
}
