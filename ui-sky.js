// 「地球防衛隊」(エースコンバット・アーマードコアふうの ゲームモード)の 画面: ミッション・かくのう庫(そうび)・しゅつげき・ごほうび。
// しゅじんこう = じぶん(サッカーの つよさを ひきつぐ)。ガチャの キャラは「ぶひん」(きかんじゅう・ミサイル・つばさ…)として そうびする。
import * as G from './game.js';
import { VEHICLES, SLOTS, RARITY_NAME, RARITY_RANK, partOf, buildVehicle, autoLoadout, MISSIONS, missionById, missionMix, PVP_MISSION } from './airsim.js';
import { pairUI, modal, closeModal } from './ui-net.js';
import { startAir3D, startPreview, stopPreview } from './air3d.js';
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
  s.firsts = s.firsts || {}; s.colors = s.colors || {}; s.names = s.names || {};
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
  return `<section class="panel sky-home"><h2 class="sec">EARTH DEFENSE <small>地球防衛隊</small></h2>
    <div class="muted">ふめいの てきから にっぽんを まもる ゲーム。しゅじんこうは ${esc(k.name)}! サッカーの つよさを ひきつぐよ。ガチャの キャラは「そうび(ぶひん)」に なるよ。</div>${res}
    <h3 class="sec">MACHINE <small>のりものを えらぶ</small></h3>${vehicleTabs(sk)}
    <div class="sky-me"><b>${VEHICLES[sk.vehicle].icon} ${sk.names[sk.vehicle] ? esc(sk.names[sk.vehicle]) : `${esc(k.name)}の ${VEHICLES[sk.vehicle].name}`}</b> <em>パワー ${V.rating}</em>${bars(V)}
      <div class="muted">そうび ${eq}/5 ${eq < 5 ? '… かくのう庫で ぶひんを つけると もっと つよく なるよ' : ''}</div>
      <button class="btn small gray" data-act="tab" data-tab="team">🛠 かくのう庫で そうびする</button></div>
    <div class="netcard"><b>📡 ふたりで あそぶ</b><div class="muted">おなじ Wi-Fi の スマホ 2だいで、きょうりょく(いっしょに てきを たおす)か たいせん(のりもの どうしで たたかう)!</div><button class="btn gold" data-act="netsky">📡 つなぐ</button></div>
    <h3 class="sec">MISSION <small>ミッション</small></h3>
    <div class="muted">どの のりものでも クリアできるよ。ミッションごとに くう✈️・うみ🚢・りく🚜の てきが ちがうよ。あいしょうの いい のりものを さがそう!</div>
    ${MISSIONS.map((m, i) => { const ok = unlocked(i); const first = !(sk.firsts[`${m.id}:${sk.vehicle}`]);
      return `<div class="smission ${ok ? '' : 'lock'}"><div class="sm-ico">${ok ? m.icon : '🔒'}</div><div class="sm-body"><b>${i + 1}. ${esc(m.name)} <em>${stars(m.id)}</em></b><small>${esc(m.brief)}</small><span class="sm-hint">てき: ${mixIcons(m)}・ごほうび ${rewardText(m.reward)}${first ? ` + はじめて ${VEHICLES[sk.vehicle].icon} ${rewardText(m.first || {})}` : ''}</span></div>
        <button class="btn gold" data-act="skygo" data-m="${m.id}" ${ok ? '' : 'disabled'}>🛫 しゅつげき</button></div>`; }).join('')}
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

export function onSkyAct(a, el) {
  const p = X.p ? X.p() : null; if (!p) return false;
  const sk = ensureSky(p);
  switch (a) {
    case 'skyveh': { if (VEHICLES[el.dataset.v]) { sk.vehicle = el.dataset.v; delete sk.pick; X.save(); X.render(); } return true; }
    case 'skygo': startMission(el.dataset.m); return true;
    case 'netsky': openSkyNet(); return true;
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
