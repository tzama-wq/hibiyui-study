// 「地球防衛隊」(エースコンバット・アーマードコアふうの ゲームモード)の 画面: ミッション・かくのう庫(そうび)・しゅつげき・ごほうび。
// しゅじんこう = じぶん(サッカーの つよさを ひきつぐ)。ガチャの キャラは「ぶひん」(きかんじゅう・ミサイル・つばさ…)として そうびする。
import * as G from './game.js';
import { VEHICLES, SLOTS, RARITY_NAME, RARITY_RANK, partOf, buildVehicle, autoLoadout, MISSIONS, missionById, missionMix, PVP_MISSION } from './airsim.js';
import { pairUI, modal, closeModal } from './ui-net.js';
import { startAir3D, startPreview, stopPreview } from './air3d.js';
import { startCity3D } from './city3d.js';
import { carStats, DEFAULT_OWNED, DEFAULT_WEAPONS } from './citysim.js';
import { normalizeHome } from './cityhome.js';
import { normLook } from './citylook.js';
import { defenseMission, JOBS as CJOBS, JSDF } from './cityjobs.js';
import { unitsOf, skillsUpTo, isCalcUnit, makeQuestion } from './gen.js';
import { createSfx } from './sfx.js';

let X; let SFX = null; let AG = null; let STARTING = false;
const esc = (s) => String(s).replace(/[<>&"]/g, '');
const vw = () => (typeof innerWidth === 'number' ? innerWidth : 360);
const vh = () => (typeof innerHeight === 'number' ? innerHeight : 640);
const VKEYS = Object.keys(VEHICLES);
const COLORS = { plane: '#e9eef7', ship: '#8fa3b8', tank: '#6f8a4a' };
const PALETTE = [['#c9453d', 'あか'], ['#e0892f', 'オレンジ'], ['#d9c23a', 'きいろ'], ['#5f9a4a', 'みどり'], ['#2fa8a0', 'ターコイズ'], ['#3f78d0', 'あお'], ['#2d4a8a', 'こん'], ['#8a56c4', 'むらさき'], ['#d96aa8', 'ピンク'], ['#e9eef7', 'しろ'], ['#3a3f48', 'くろ'], ['#b79a6a', 'さばく']];
export const vehicleName = (k, sk, v) => (sk.names && sk.names[v]) || k.name;

export function skyInit(ctx) {
  X = ctx;
  if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
    const host = document.getElementById('app'); if (!host) return;
    let t = 0;
    new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => { const cv = host.querySelector('canvas.sky-prev'); if (!cv) { stopPreview(); return; } try { const p = X.p(); const sp = specOf(X.kid(), p, ensureSky(p).vehicle); startPreview(cv, sp.spec); } catch { /* ok */ } }, 30); }).observe(host, { childList: true, subtree: true });
  }
}

export const ensureSky = (p) => {
  p.sky = p.sky && typeof p.sky === 'object' ? p.sky : {};
  const s = p.sky; s.cleared = s.cleared && !Array.isArray(s.cleared) ? s.cleared : {}; s.daily = s.daily || { date: '', n: 0 };
  if (!VEHICLES[s.vehicle]) s.vehicle = 'plane';
  s.loadout = s.loadout || {}; for (const v of VKEYS) s.loadout[v] = s.loadout[v] || {};
  s.firsts = s.firsts || {}; s.colors = s.colors || {}; s.names = s.names || {}; s.city = s.city && typeof s.city === 'object' ? s.city : { coins: 0, done: {}, kos: 0, daily: { date: '', n: 0 } }; s.city.done = s.city.done || {}; s.city.owned = Array.isArray(s.city.owned) ? s.city.owned : []; s.city.arrests = s.city.arrests && typeof s.city.arrests === 'object' ? s.city.arrests : {}; s.city.weapons = Array.isArray(s.city.weapons) ? s.city.weapons : []; s.city.weapon = s.city.weapon || 'pistol'; s.city.ammo = s.city.ammo && typeof s.city.ammo === 'object' ? s.city.ammo : {}; s.city.jobOk = s.city.jobOk | 0; s.city.warps = Array.isArray(s.city.warps) ? s.city.warps.slice(0, 3) : []; s.city.job = typeof s.city.job === 'string' ? s.city.job : 'none'; s.city.jobXp = s.city.jobXp && typeof s.city.jobXp === 'object' ? s.city.jobXp : {}; s.city.home = normalizeHome(s.city.home); s.city.phone = !!s.city.phone; s.city.defLevel = Math.max(1, s.city.defLevel | 0); s.city.defBest = s.city.defBest | 0; s.city.quest = s.city.quest && typeof s.city.quest === 'object' ? s.city.quest : {}; s.city.rpgXp = s.city.rpgXp | 0; s.city.collect = s.city.collect && typeof s.city.collect === 'object' ? s.city.collect : {}; s.city.look = normLook(s.city.look); s.city.loadout = Array.isArray(s.city.loadout) ? s.city.loadout.slice(0, 5) : []; s.city.eqOwned = Array.isArray(s.city.eqOwned) ? s.city.eqOwned : []; s.city.equip = s.city.equip && typeof s.city.equip === 'object' ? s.city.equip : {}; s.city.jobs = s.city.jobs || { n: 0, pay: 0 }; s.city.daily = s.city.daily || { date: '', n: 0 };
  delete s.pilot; return s;
};

// ---- じぶん + ぶひんから きたいを つくる ----------------------------------------------------
function ownedChars(p) {
  const out = [];
  for (const [id, n] of Object.entries(p.owned || {})) { const pl = G.PLAYER_BY_ID[id]; if (!pl || !n) continue; out.push({ id, name: pl.name, face: pl.face || '', img: pl.img || '', rarity: pl.rarity, pos: pl.pos, stats: G.playerEffective(p, id) }); }
  return out;
}
export function specOf(k, p, vehicle, loadoutOverride) {
  const sk = ensureSky(p); const chars = ownedChars(p); const byId = Object.fromEntries(chars.map((c) => [c.id, c]));
  const lo = loadoutOverride || sk.loadout[vehicle] || {}; const parts = {}; const used = new Set();
  for (const sl of SLOTS[vehicle]) { const id = lo[sl.id]; if (id && byId[id] && !used.has(id)) { parts[sl.id] = partOf(vehicle, sl.id, byId[id]); used.add(id); } }
  const V = buildVehicle({ vehicle, name: vehicleName(k, sk, vehicle), face: k.em || '', kidStats: G.kidStats(p), parts });
  return { V, chars, spec: { vehicle, color: sk.colors[vehicle] || COLORS[vehicle], parts, missiles: V.missiles, icon: VEHICLES[vehicle].icon, vname: VEHICLES[vehicle].name } };
}

// ---- がめん ----------------------------------------------------------------------
const rewardText = (r) => [...G.TICKET_ORDER.filter((t) => r[t]).map((t) => `${G.TICKETS[t].icon}×${r[t]}`), ...(r.pts ? [`💪${r.pts}pt`] : []), ...(r.shards ? [`💠×${r.shards}`] : [])].join(' ') || '—';
function bars(V) {
  const row = (n, v, c) => `<div class="smr-row"><span>${n}</span><i><u style="width:${Math.max(4, Math.min(100, v))}%;background:${c}"></u></i><b>${Math.round(v)}</b></div>`;
  return `${row('かりょく', V.gunDps / 1.6, '#ff4d5e')}${row('そうこう', V.hpMax / (V.vehicle === 'plane' ? 5 : 9), '#6fcf97')}${row('スピード', V.vehicle === 'plane' ? V.speed / 1.6 : V.speed * 3.5, '#27d8ff')}${row('ブースト', V.boostMax, '#a56de2')}${row('ミサイル', V.missiles * 6 + V.locks * 6, '#ffd23f')}`;
}
function vehicleTabs(sk) {
  return `<div class="vtabs">${VKEYS.map((v) => `<button class="${sk.vehicle === v ? 'on' : ''}" data-act="skyveh" data-v="${v}"><span>${VEHICLES[v].icon}</span>${VEHICLES[v].name}</button>`).join('')}</div><div class="muted vnote">${esc(VEHICLES[sk.vehicle].note)}</div>`;
}
const mixIcons = (m) => { const c = missionMix(m); return `${c.air ? `✈️×${c.air} ` : ''}${c.sea ? `🚢×${c.sea} ` : ''}${c.ground ? `🚜×${c.ground}` : ''}`; };

export function skyHome(k, p) {
  const sk = ensureSky(p); const { V } = specOf(k, p, sk.vehicle); const eq = Object.keys(sk.loadout[sk.vehicle]).length;
  const stars = (id) => { const s = sk.cleared[id] || 0; return s ? '★'.repeat(s) + '☆'.repeat(3 - s) : ''; };
  const unlocked = (i) => i === 0 || sk.cleared[MISSIONS[i - 1].id];
  const res = sk.last ? `<div class="skyres ${sk.last.win ? 'win' : 'lose'}"><b>${sk.last.win ? '🎖 クリア!' : 'ざんねん…'} ${esc(sk.last.name)}</b>${sk.last.win ? ` ${'★'.repeat(sk.last.stars)}` : ''}<div>${sk.last.rewardText ? `ごほうび: ${sk.last.rewardText}` : ''}</div><button class="btn small gray" data-act="skyclear">とじる</button></div>` : '';
  const cty = sk.city || {}; const jobNow = CJOBS[cty.job] || CJOBS.none; const inJsdf = JSDF.includes(cty.job);
  return `<section class="panel sky-home"><h2 class="sec">EastRopeIslandCity <small>イースト ロープ アイランド シティ</small></h2>
    <div class="muted">しゅじんこうは ${esc(k.name)}! まちを じゆうに あるいて、のりものや しょくぎょうを たのしもう。サッカーの つよさも ひきつぐよ。</div>${res}
    <div class="netcard city main"><b>🏙️ シティへ でかける</b><div class="muted">くるま・バイク・せんしゃ・ふね・ひこうき・せんとうきに のりおり! 指名手配の 凶悪犯を たいほ。じたくで しょくぎょう(けいさつ・SWAT・しょうぼう・きゅうきゅう・じえいたい)を えらんで、おへやも つくろう。ガレージで のりものを かおう。</div><div class="muted">${jobNow.icon} ${esc(jobNow.name)} ・ 🪙 ${cty.coins || 0} ・ ミッション クリア ${Object.values(cty.done || {}).reduce((a2, b2) => a2 + b2, 0)}かい ・ たいほ ${Object.values(cty.arrests || {}).reduce((a2, b2) => a2 + b2, 0)}にん</div><button class="btn gold" data-act="citygo">🏙️ シティへ でかける</button></div>
    <div class="netcard"><b>みんなで あそぶ(さいだい 3にん)</b><div class="muted">ホストの QRコードを ほかの ふたりが よみとると、いっしょに シティで たたかえるよ。ホストは パパが おすすめ。パパが いない ときは ふたりでも あそべるよ。</div><div class="row"><button class="btn gold" data-act="coophost">ホストに なる</button><button class="btn" data-act="coopjoin">さんかする</button></div></div>
    <div class="netcard def"><b>🎖️ 地球防衛隊 ぼうえい にんむ <em>Lv.${cty.defLevel || 1}</em></b><div class="muted">${inJsdf ? 'シティの きちに いる ちょうかんに はなしかけると すぐに ぼうえい にんむが はじまるよ。にんむは だんだん むずかしくなる! クリアするまで おわれないぞ。' : 'じえいたい(りく・うみ・そら)の しょくぎょうに なって、シティの きちの ちょうかんに はなしかけよう。にんむは おわりなく むずかしくなるよ。'}</div><div class="muted">さいこう きろく Lv.${cty.defBest || 0}</div></div>
    <h3 class="sec">MACHINE <small>のりものを えらぶ</small></h3>${vehicleTabs(sk)}
    <div class="sky-me"><b>${VEHICLES[sk.vehicle].icon} ${sk.names[sk.vehicle] ? esc(sk.names[sk.vehicle]) : `${esc(k.name)}の ${VEHICLES[sk.vehicle].name}`}</b> <em>パワー ${V.rating}</em>${bars(V)}
      <div class="muted">そうび ${eq}/5 ${eq < 5 ? '… かくのう庫で ぶひんを つけると もっと つよく なるよ' : ''}</div>
      <button class="btn small gray" data-act="tab" data-tab="team">🛠 かくのう庫で そうびする</button></div>
    <div class="netcard"><b>📡 ふたりで あそぶ</b><div class="muted">おなじ Wi-Fi の スマホ 2だいで、きょうりょく(いっしょに てきを たおす)か たいせん(のりもの どうしで たたかう)!</div><button class="btn gold" data-act="netsky">📡 つなぐ</button></div>
    <div class="muted">そうさ: ひだりの スティック(みぎに たおせば みぎへ、うえに たおせば うえ・まえへ。ひこうき=むき・のぼる/くだる、ふね・せんしゃ=すすむ・まがる)。ほうげき・ミサイル(ロックして うつ)・ブースト・かいひ。ミサイルは オートロック! ひこうきの きかんほうは きしゅを てきに むけて ねらう。ふね・せんしゃの ほうげきは **みぎがわを ドラッグして ねらう**(「てきに むける」で ちかい てきに あわせてくれるよ)。</div></section>`;
}

function slotCard(sk, sl, ch, chars) {
  const cur = sk.loadout[sk.vehicle][sl.id]; const c = chars.find((x) => x.id === cur); const pt = c ? partOf(sk.vehicle, sl.id, c) : null;
  const usedElsewhere = new Set(Object.entries(sk.loadout[sk.vehicle]).filter(([s]) => s !== sl.id).map(([, id]) => id));
  const open = sk.pick === sl.id;
  let list = '';
  if (open) {
    const opts = chars.filter((x) => !usedElsewhere.has(x.id)).map((x) => ({ x, pt: partOf(sk.vehicle, sl.id, x) })).sort((a, b) => b.pt.power - a.pt.power).slice(0, 40);
    list = `<div class="eq-list">${cur ? `<button class="btn small gray" data-act="skyput" data-slot="${sl.id}" data-id="">✖ はずす</button>` : ''}${opts.map(({ x, pt: q }) => `<button class="eq-opt r-${x.rarity} ${x.id === cur ? 'sel' : ''}" data-act="skyput" data-slot="${sl.id}" data-id="${x.id}"><span class="mc-face">${x.img ? `<img src="${esc(x.img)}" alt="" loading="lazy" onerror="this.outerHTML='${esc(x.face)}'">` : esc(x.face)}</span><b>${esc(x.name)}</b><small>${RARITY_NAME[x.rarity] || ''}・${G.POS_NAME[x.pos] || x.pos}</small><em>${q.power}${q.fit ? ' ◎' : ''}</em></button>`).join('') || '<div class="muted">キャラが いないよ。ガチャで あつめよう!</div>'}</div>`;
  }
  return `<div class="eq-slot ${open ? 'open' : ''}"><button class="eq-head r-${c ? c.rarity : 'none'}" data-act="skyslot" data-slot="${sl.id}"><span class="sl-ico">${sl.icon}</span><div><b>${sl.name}</b><small>${sl.note}${sl.match.length ? ` ・ ◎=${sl.match.map((m) => G.POS_NAME[m] || m).join('/')}` : ''}</small></div>
    <div class="sl-cur">${c ? `<span class="mc-face">${c.img ? `<img src="${esc(c.img)}" alt="" onerror="this.outerHTML='${esc(c.face)}'">` : esc(c.face)}</span><b>${esc(c.name)}</b><em>${pt.power}${pt.fit ? ' ◎' : ''}</em>` : '<span class="muted">(からっぽ)</span>'}</div></button>${list}</div>`;
}
export function hangarHtml(k, p) {
  const sk = ensureSky(p); const { V, chars } = specOf(k, p, sk.vehicle);
  return `<section class="panel"><h2 class="sec">HANGAR <small>かくのう庫</small></h2>
    <div class="muted">しゅじんこうの のりものに、ガチャの キャラを ぶひんとして つけよう。ぶひんを かえると みためも かわるよ!</div>${vehicleTabs(sk)}
    <canvas class="sky-prev" width="640" height="320"></canvas>
    <div class="eq-paint"><div class="eq-pt"><b>🎨 いろ</b><button class="sw reset ${sk.colors[sk.vehicle] ? '' : 'on'}" data-act="skycolor" data-c="" title="もとの いろ">もとの いろ</button>${PALETTE.map(([c, n]) => `<button class="sw ${sk.colors[sk.vehicle] === c ? 'on' : ''}" style="background:${c}" data-act="skycolor" data-c="${c}" title="${n}" aria-label="${n}"></button>`).join('')}</div>
      <div class="eq-pt"><b>✏️ なまえ</b><span class="eq-nm">${esc(vehicleName(k, sk, sk.vehicle))}</span><button class="btn small gray" data-act="skyname">なまえを かえる</button></div></div>
    <div class="sky-me"><em>パワー ${V.rating}</em>${bars(V)}<div class="muted">いのち ${V.hpMax} ・ ミサイル ${V.missiles}はつ ・ ロック ${V.locks}</div></div>
    <div class="row"><button class="btn gold" data-act="skyauto">✨ おまかせ そうび</button><button class="btn gray" data-act="skyclearall">ぜんぶ はずす</button></div>
    <div class="eq-slots">${SLOTS[sk.vehicle].map((sl) => slotCard(sk, sl, null, chars)).join('')}</div>
    <div class="muted">おなじ キャラは 1つの ぶひんだけ。◎は ポジションが ぴったり(つよさ ×1.2)。レアどが たかいほど つよい ぶひんに なるよ。きょうか・きゅうしゅうも ぜんぶ きくよ!</div></section>`;
}

// ---- あそぶ ----------------------------------------------------------------------
async function startMission(id, net) {
  if (STARTING) return false; STARTING = true;
  try {
    const k = X.kid(); const p = X.p(); const sk = ensureSky(p); const mis = id === 'pvp' ? PVP_MISSION : missionById(id); if (!mis) return false;
    const vehicle = sk.vehicle; const { V, spec } = specOf(k, p, vehicle);
    X.toast('🛫 しゅつげき じゅんびちゅう…');
    SFX = SFX || createSfx(() => (X.quiet ? X.quiet() : false));
    const map = { gun: 'gun', missile: 'missile', boom: 'boom', bigboom: 'bigboom', hit: 'hit', basehit: 'basehit', warn: 'warn', evade: 'evade', spark: 'spark', win: 'win', lose: 'lose' };
    if (AG) { AG.destroy(); AG = null; }
    stopPreview();
    try {
      AG = await startAir3D({ vehicle: V, spec, mission: mis, net, gentle: !!(X.cfg && X.cfg().gentle), calm: !!(X.cfg && X.cfg().calm),
        onSfx: (n) => { if (SFX && map[n]) SFX.play(map[n]); },
        onQuit: () => { AG = null; X.render(); },
        onEnd: (r) => { AG = null; finishMission(mis, r, vehicle); } });
    } catch (e) { AG = null; X.toast('3Dを ひらけなかったよ…'); return false; }
    return true;
  } finally { STARTING = false; }
}
export function finishMission(mis, r, vehicle) {
  const p = X.p(); const sk = ensureSky(p); const t = X.today();
  if (r.pvp || r.lostLink && !r.coop) {
    if (r.pvp && !r.lostLink) { sk.pvp = sk.pvp || { w: 0, l: 0 }; if (r.win) sk.pvp.w++; else sk.pvp.l++; p.xp += r.win ? 15 : 8; }
    sk.last = { win: !!r.win, stars: 0, name: 'たいせん', rewardText: r.lostLink ? 'つうしんが きれたよ' : `${sk.pvp.w}しょう ${sk.pvp.l}はい` }; X.save(); X.render(); return;
  }
  let reward = {}; let text = '';
  if (r.win) {
    const fk = `${mis.id}:${vehicle}`; const firstVeh = !sk.firsts[fk]; const firstAny = !sk.cleared[mis.id];
    sk.firsts[fk] = 1; sk.cleared[mis.id] = Math.max(sk.cleared[mis.id] || 0, r.stars);
    if (firstAny) reward = { ...mis.reward }; else {
      sk.daily = sk.daily.date === t ? sk.daily : { date: t, n: 0 };
      if (sk.daily.n < 3) { sk.daily.n++; reward = { ...mis.reward }; } else { reward = { pts: mis.reward.pts || 0 }; } // くりかえしの ごほうびは 1日 3かいまで
    }
    if (firstVeh && mis.first) for (const [kk, v] of Object.entries(mis.first)) reward[kk] = (reward[kk] || 0) + v; // のりものごとの はじめての クリア
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

// ---- ぼうえい にんむ(シティから シームレスに いどう・クリアするまで おわれない・どんどん むずかしく なる) ----
async function startDefense() {
  if (STARTING) return false; STARTING = true;
  try {
    const k = X.kid(); const p = X.p(); const sk = ensureSky(p); const city = sk.city; const L = Math.max(1, city.defLevel | 0);
    const job = CJOBS[city.job]; const vehicle = job && job.branch ? job.branch : 'plane'; const { V, spec } = specOf(k, p, vehicle); const mis = defenseMission(L);
    X.toast(`🎖️ ぼうえい にんむ Lv.${L} しゅつげき!`); SFX = SFX || createSfx(() => (X.quiet ? X.quiet() : false)); SFX.bgmTheme('defense');
    const map = { gun: 'gun', missile: 'missile', boom: 'boom', bigboom: 'bigboom', hit: 'hit', basehit: 'basehit', warn: 'warn', evade: 'evade', spark: 'spark', win: 'win', lose: 'lose' };
    if (AG) { AG.destroy(); AG = null; } stopPreview();
    try {
      AG = await startAir3D({ vehicle: V, spec, mission: mis, gentle: !!(X.cfg && X.cfg().gentle), calm: !!(X.cfg && X.cfg().calm), onSfx: (n) => { if (SFX && map[n]) SFX.play(map[n]); },
        onQuit: () => { AG = null; X.toast('🎖️ にんむ ちゅうは もどれないぞ! クリアするまで がんばれ!'); setTimeout(() => startDefense(), 700); },
        onEnd: (r) => { AG = null; defenseEnd(mis, r); } });
    } catch (e) { AG = null; X.toast('3Dを ひらけなかったよ…'); return false; }
    return true;
  } finally { STARTING = false; }
}
function defenseEnd(mis, r) {
  const p = X.p(); const sk = ensureSky(p); const city = sk.city; const L = mis.level;
  if (r && r.win) {
    const { pts, shards, ...tk } = mis.reward; G.addTickets(p, tk); if (pts) { const SP = ['SHO', 'PAS', 'SPD', 'DEF', 'STA']; p.pts = { ...G.emptyStatMap(), ...(p.pts || {}) }; for (const st2 of SP) p.pts[st2] += pts; }
    city.coins += 200 * L; p.xp += 20 + 3 * L; city.defLevel = L + 1; city.defBest = Math.max(city.defBest | 0, L); X.save(); X.fx.confetti(vw() / 2, vh() * 0.35, 140, 1.6); X.fx.beep('win'); X.toast(`🎖️ にんむ クリア! 🪙+${200 * L} → Lv.${L + 1}に ステップアップ!`);
    setTimeout(() => startCity(), 1300);
  } else { X.toast('ざんねん… もういちど ちょうせんだ!'); setTimeout(() => startDefense(), 1200); }
}

export function onSkyAct(a, el) {
  const p = X.p ? X.p() : null; if (!p) return false;
  const sk = ensureSky(p);
  switch (a) {
    case 'skyveh': { if (VEHICLES[el.dataset.v]) { sk.vehicle = el.dataset.v; delete sk.pick; X.save(); X.render(); } return true; }
    case 'skygo': startMission(el.dataset.m); return true;
    case 'netsky': openSkyNet(); return true;
    case 'citygo': startCity(); return true;
    case 'coophost': coopHost(); return true;
    case 'coopjoin': coopJoin(); return true;
    case 'skyclear': { delete sk.last; X.save(); X.render(); return true; }
    case 'skyslot': { sk.pick = sk.pick === el.dataset.slot ? null : el.dataset.slot; X.render(); return true; }
    case 'skyput': {
      const lo = sk.loadout[sk.vehicle]; const id = el.dataset.id; const slot = el.dataset.slot;
      if (!id) delete lo[slot]; else { for (const s of Object.keys(lo)) if (lo[s] === id) delete lo[s]; lo[slot] = id; }
      sk.pick = null; X.save(); X.render(); return true;
    }
    case 'skycolor': { const c = el.dataset.c; if (c) sk.colors[sk.vehicle] = c; else delete sk.colors[sk.vehicle]; X.save(); X.render(); return true; }
    case 'skyname': { const k = X.kid(); const cur = vehicleName(k, sk, sk.vehicle); const n = typeof prompt === 'function' ? prompt('きたいの なまえを いれてね(8もじまで)', cur) : null; if (n === null) return true; const t = String(n).replace(/[<>&"]/g, '').trim().slice(0, 8); if (t && t !== k.name) sk.names[sk.vehicle] = t; else delete sk.names[sk.vehicle]; X.save(); X.toast(t ? `なまえを「${t}」に したよ!` : 'なまえを もとに もどしたよ'); X.render(); return true; }
    case 'skyauto': { sk.loadout[sk.vehicle] = autoLoadout(sk.vehicle, ownedChars(p)); sk.pick = null; X.save(); X.toast('おまかせで そうびしたよ!'); X.render(); return true; }
    case 'skyclearall': { sk.loadout[sk.vehicle] = {}; sk.pick = null; X.save(); X.render(); return true; }
    default: return false;
  }
}
void RARITY_RANK;

// ---- ふたりで あそぶ(ローカル つうしん) ----------------------------------------------------
function openSkyNet() {
  const k = X.kid(); const p = X.p(); const sk = ensureSky(p); const mine = specOf(k, p, sk.vehicle);
  const hello = { t: 'hello', name: k.name, vehicle: mine.V, spec: mine.spec };
  pairUI({ title: '📡 ふたりで 地球防衛隊', onConn: (conn, role) => lobby(conn, role, hello), onCancel: () => {} });
}
function lobby(conn, role, hello) {
  let partner = null; let replied = false; let started = false;
  const sendHello = () => conn.send(hello);
  const unlocked = (sk) => MISSIONS.filter((m, i) => i === 0 || sk.cleared[MISSIONS[i - 1].id]);
  const show = () => {
    const sk = ensureSky(X.p());
    if (!partner) { modal('<h3>つながったよ!</h3><p class="muted">あいての じゅんびを まっているよ…</p><button class="btn gray" data-n="x">やめる</button>').querySelector('[data-n=x]').addEventListener('click', () => { conn.close(); closeModal(); }); return; }
    const pv = partner.spec; const mv = hello.spec;
    const head = `<h3>📡 つながった!</h3><div class="netpair"><div><b>${esc(hello.name)}</b><br>${mv.icon} ${esc(mv.vname)}<br><small>パワー ${hello.vehicle.rating}</small></div><div>⚔️🤝</div><div><b>${esc(partner.name)}</b><br>${pv.icon} ${esc(pv.vname)}<br><small>パワー ${partner.vehicle.rating}</small></div></div>`;
    if (role === 'host') {
      const box = modal(`${head}<p class="muted">あそびかたを えらんでね</p><div class="netmodes"><button class="btn gold" data-n="coop">🤝 きょうりょく</button><button class="btn" data-n="pvp">⚔️ たいせん</button></div>
        <div class="netms" hidden>${unlocked(sk).map((m) => `<button class="btn small" data-n="go" data-m="${m.id}">${m.icon} ${esc(m.name)}</button>`).join('')}</div><button class="btn gray" data-n="x">やめる</button>`);
      box.querySelector('[data-n=coop]').addEventListener('click', () => { box.querySelector('.netms').hidden = false; });
      box.querySelector('[data-n=pvp]').addEventListener('click', () => go('pvp'));
      box.querySelectorAll('[data-n=go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.m)));
      box.querySelector('[data-n=x]').addEventListener('click', () => { conn.close(); closeModal(); });
    } else {
      const box = modal(`${head}<p class="muted">ホストが あそびかたを えらんでいるよ…</p><button class="btn gray" data-n="x">やめる</button>`);
      box.querySelector('[data-n=x]').addEventListener('click', () => { conn.close(); closeModal(); });
    }
  };
  const begin = (mid, r) => { if (started) return; started = true; closeModal(); startMission(mid, { role: r, conn, partner: { vehicle: partner.vehicle, spec: partner.spec, name: partner.name }, pvp: mid === 'pvp' }); };
  const go = (mid) => { if (!partner || started) return; conn.send({ t: 'start', m: mid }); begin(mid, 'host'); };
  conn.on((m) => {
    if (!m) return;
    if (m.t === 'hello') { partner = { name: String(m.name || 'ともだち').slice(0, 12), vehicle: m.vehicle, spec: m.spec }; if (!replied) { replied = true; sendHello(); } show(); }
    else if (m.t === 'start' && role === 'guest' && partner) begin(m.m, 'guest');
  });
  conn.onClose(() => { if (!started) { closeModal(); X.toast('つうしんが きれたよ'); } });
  show(); sendHello();
}

// ---- シティ(じゆうに うごける まち) ------------------------------------------------------------
// ---- みんなで あそぶ(きょうりょく・さいだい 3にん): ホストの QRを ほかの ふたりが よみとる ----
function coopHost() {
  const conns = []; const k = X.kid();
  const go = () => { closeModal(); for (const c of conns) { try { c.conn.send({ t: 'go', host: k.name }); } catch { /* ok */ } } startCity({ role: 'host', conns }); };
  const more = () => { const box = modal(`<h3>つながったよ!(${conns.length}にん)</h3><p class="muted">もう ひとり さそう? それとも はじめる?</p><button class="btn gold" data-n="add">もうひとり さそう</button><button class="btn" data-n="go">はじめる</button><button class="btn gray" data-n="cancel">やめる</button>`, () => {});
    box.querySelector('[data-n=add]').addEventListener('click', pairOne); box.querySelector('[data-n=go]').addEventListener('click', go); box.querySelector('[data-n=cancel]').addEventListener('click', () => { for (const c of conns) { try { c.conn.close(); } catch { /* ok */ } } closeModal(); }); };
  const pairOne = () => pairUI({ title: `みんなで あそぶ: ${conns.length + 1}にんめを さそう`, role: 'host', onCancel: () => { if (conns.length) more(); }, onConn: (conn) => { conns.push({ conn }); if (conns.length >= 2) go(); else more(); } });
  pairOne();
}
function coopJoin() {
  pairUI({ title: 'みんなで あそぶ: さんかする', role: 'guest', onCancel: () => {}, onConn: (conn) => {
    const box = modal('<h3>つながったよ!</h3><p class="muted">ホストが はじめるのを まっているよ…</p><button class="btn gray" data-n="cancel">やめる</button>', () => {}); let started = false;
    box.querySelector('[data-n=cancel]').addEventListener('click', () => { try { conn.close(); } catch { /* ok */ } closeModal(); });
    conn.on((m) => { if (m && m.t === 'go' && !started) { started = true; closeModal(); startCity({ role: 'guest', conn }); } });
    conn.onClose(() => { if (!started) { closeModal(); X.toast('ホストと きれたよ'); } });
  } });
}
async function startCity(coop) {
  if (STARTING) return false; STARTING = true;
  try {
    const k = X.kid(); const p = X.p(); const sk = ensureSky(p); const ks = G.kidStats(p); const city = sk.city;
    const tank = specOf(k, p, 'tank'); const ship = specOf(k, p, 'ship'); const plane = specOf(k, p, 'plane');
    X.toast('🏙️ まちへ いくよ…'); SFX = SFX || createSfx(() => (X.quiet ? X.quiet() : false)); stopPreview();
    const map = { jump: 'jump', shot_pistol: 'shot_pistol', shot_smg: 'shot_smg', shot_sg: 'shot_sg', shot_rifle: 'shot_rifle', shot_sniper: 'shot_sniper', reload: 'reload', dry: 'dry', hitmark: 'hitmark', gun: 'gun', missile: 'missile', boom: 'boom', bigboom: 'bigboom', hit: 'hit', warn: 'warn', win: 'win', lose: 'lose', coin: 'cash', gem: 'sparkle', door: 'door', bump: 'hit', mission: 'warn', down: 'spark' };
    try {
      const prog = { a: Object.values(city.arrests || {}).filter((n) => n > 0).length, m: Object.entries(city.done || {}).filter(([kk]) => kk !== 'secret').reduce((q, [, n]) => q + n, 0), j: city.jobOk | 0 };
      AG = await startCity3D({ coop: coop || null, progress: prog, kidName: k.name, stats: ks, vehicles: { car: carStats(ks), tank: tank.V, ship: ship.V, plane: plane.V }, specs: { tank: tank.spec, ship: ship.spec, plane: plane.spec }, coins: city.coins, done: city.done, owned: city.owned, weapons: city.weapons, weapon: city.weapon, ammo: city.ammo, jobOk: city.jobOk, warps: city.warps, defLevel: city.defLevel, quest: city.quest, rpgXp: city.rpgXp, collect: city.collect, look: city.look, loadout: city.loadout, onRestart: () => startCity(), onDefense: (d) => startDefense(d), job: city.job, jobXp: city.jobXp, home: city.home, phone: city.phone, eqOwned: city.eqOwned, equip: city.equip, arrests: city.arrests, onSoccer: () => { AG = null; if (X.openSoccer) X.openSoccer(); else X.render(); }, getJobQuestion: (subj) => jobQuestion(k, subj), onJobDone: (r) => cityJob(r), calm: !!(X.cfg && X.cfg().calm), gentle: !!(X.cfg && X.cfg().gentle),
        onSfx: (n) => { if (!SFX) return; if (n.startsWith('bgm:')) SFX.bgmTheme(n.slice(4)); else if (map[n]) SFX.play(map[n]); },
        onSave: (r) => { city.coins = r.coins; city.done = { ...r.done }; if (r.owned) city.owned = r.owned.filter((id) => !DEFAULT_OWNED.includes(id)); if (r.arrests) city.arrests = { ...r.arrests }; if (r.weapons) city.weapons = r.weapons.filter((id) => !DEFAULT_WEAPONS.includes(id)); if (r.weapon) city.weapon = r.weapon; if (r.ammo) city.ammo = JSON.parse(JSON.stringify(r.ammo)); if (r.jobOk != null) city.jobOk = r.jobOk | 0; if (Array.isArray(r.warps)) city.warps = r.warps.map((w) => (w ? { x: w.x, z: w.z, name: w.name } : null)); if (typeof r.job === 'string') city.job = r.job; if (r.jobXp) city.jobXp = { ...r.jobXp }; if (r.quest) city.quest = JSON.parse(JSON.stringify(r.quest)); if (r.rpgXp != null) city.rpgXp = r.rpgXp | 0; if (r.collect) city.collect = JSON.parse(JSON.stringify(r.collect)); if (r.look) city.look = normLook(r.look); if (Array.isArray(r.loadout)) city.loadout = r.loadout.slice(0, 5); if (r.defLevel) city.defLevel = Math.max(city.defLevel | 0, r.defLevel | 0); if (r.home) city.home = JSON.parse(JSON.stringify(r.home)); city.phone = !!r.phone; if (r.eqOwned) city.eqOwned = [...r.eqOwned]; if (r.equip) city.equip = { ...r.equip }; X.save(); },
        onBounty: (e) => cityBounty(e),
        onReward: (e) => cityReward(e),
        onBuy: (id) => { const pp = X.p(); if (id === 'shard') G.addShards(pp, 5); else G.addTickets(pp, { [id]: 1 }); X.save(); X.toast(`🎁 ${id === 'shard' ? 'ダイヤの かけら ×5' : 'ガチャチケット ×1'} を かったよ!`); },
        onQuit: () => { AG = null; if (SFX) SFX.bgmStop(); X.render(); } });
    } catch (err) { AG = null; X.toast('3Dを ひらけなかったよ…'); return false; }
    return true;
  } finally { STARTING = false; }
}
// おしごとの もんだい(さんすう・こくごを その がくねんから)
function jobQuestion(k, subj) {
  let pool = [];
  if (subj === '算数') { const all = skillsUpTo(k.grade).filter(isCalcUnit); pool = all.slice(-8); } else pool = unitsOf(k.grade).filter((u) => u.subject === '国語' && u.gen);
  for (let i = 0; i < 12 && pool.length; i++) {
    try { const u = pool[Math.floor(Math.random() * pool.length)]; const q = makeQuestion(u); if (q && Array.isArray(q.choices) && q.choices.length >= 2 && q.choices.some((c) => c.ok)) return { text: q.text, why: q.why || '', choices: q.choices.map((c) => ({ label: c.label, ok: !!c.ok })) }; } catch { /* next */ }
  }
  return null;
}
function cityJob(r) {
  const p = X.p(); const sk = ensureSky(p); sk.city.jobs.n++; sk.city.jobs.pay += r.pay; p.xp += r.correct * 2; X.save(); X.toast(`📚 おべんきょう おつかれさま! せいかい ${r.correct}/${r.total} 🪙+${r.pay}`);
}
function cityBounty(e) {
  const p = X.p(); const tk = { ...(e.tickets || {}) }; if (Object.keys(tk).length) G.addTickets(p, tk);
  p.xp += 5 + (e.stars || 1) * 3; X.save(); X.toast(`🚔 ${e.name} を たいほ! 🪙+${e.coins} ${Object.keys(tk).length ? rewardText(tk) : ''}`);
}
function cityReward(e) {
  const p = X.p(); const sk = ensureSky(p); const t = X.today(); const c = sk.city; c.daily = c.daily.date === t ? c.daily : { date: t, n: 0 };
  const tickets = { ...e.reward }; let note = '';
  if (!e.first) { if (c.daily.n < 3) c.daily.n++; else { for (const kk of Object.keys(tickets)) delete tickets[kk]; note = '(きょうは チケットは おしまい)'; } }
  const { shards, ...tk } = tickets; if (Object.keys(tk).length) G.addTickets(p, tk); if (shards) G.addShards(p, shards);
  if (e.pts) { const SP = ['SHO', 'PAS', 'SPD', 'DEF', 'STA']; p.pts = { ...G.emptyStatMap(), ...(p.pts || {}) }; for (const s2 of SP) p.pts[s2] += e.pts; }
  p.xp += 20; X.save(); X.toast(`🎁 ${e.name} クリア! ${rewardText(tickets)} ${e.pts ? `💪${e.pts}pt` : ''} 🪙+${e.coins} ${note}`);
}
