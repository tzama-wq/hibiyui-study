// ピクセルの しあい アニメ。simulate() の events(チャンス12かい)を、11人ずつの ドットの 選手が プレーする 映像に する。
// 画面の しくみ(DOM)には さわらない。canvas を わたして つかう。ロジック(buildPlan など)は node で テストできる。
//   const m = createMatch({ me, opp, events, speed, callbacks }); m.attach(canvas); ... m.destroy();
//   me / opp: { name, team: [{ id, name, slot, rarity }] }   events: simulate の events(各 ev に idx, total を つける)

export const W = 320; export const H = 184;
export const PITCH = { x0: 10, x1: 310, y0: 26, y1: 178 };
export const ZOOM = 2; // カメラの ズーム(せいすう ばいで ドットが ぼやけない)
const GOAL_HALF = 15; // ゴールの はば(たて)の はんぶん
const CY = (PITCH.y0 + PITCH.y1) / 2;
const PW = PITCH.x1 - PITCH.x0; const PH = PITCH.y1 - PITCH.y0;

// ---- かたち: 11にんの おきば ------------------------------------------------------------
const ROW_X = { GK: 0.05, DF: 0.22, MF: 0.44, FW: 0.64 };
// こうげきの むき(own goal = 0 → あいての ゴール = 1)の ざひょう
export function layout(team) {
  const rows = { GK: [], DF: [], MF: [], FW: [] };
  team.forEach((m, i) => rows[m.slot].push(i));
  const pos = Array(team.length);
  for (const [s, idxs] of Object.entries(rows)) {
    idxs.forEach((i, j) => { pos[i] = { ax: ROW_X[s], ay: s === 'GK' ? 0.5 : 0.14 + (0.72 * (j + 0.5)) / idxs.length }; });
  }
  return { pos, rows };
}
// ax, ay(こうげきの むき)→ ピクセル。side 'a' は みぎへ せめる、'b' は ひだりへ せめる
export const toPx = (side, ax, ay) => ({ x: side === 'a' ? PITCH.x0 + ax * PW : PITCH.x1 - ax * PW, y: PITCH.y0 + ay * PH });

// ---- こうげき1かいの だんどり(ぶんしょう) -------------------------------------------------------
// ev: { side, type: goal|save|miss, passer, shooter }   rnd: 0〜1 の らんすう
export function buildPlan(ev, team, rnd, dteam = null) {
  const L = layout(team);
  const pickOf = (arr) => arr[Math.floor(rnd() * arr.length)];
  const byName = (n) => { const i = team.findIndex((m) => m.name === n); return i >= 0 ? i : -1; };
  const mf = L.rows.MF; const df = L.rows.DF; const fw = L.rows.FW; const gk = L.rows.GK[0];
  let shooter = byName(ev.shooter); if (shooter < 0) shooter = pickOf(fw.length ? fw : mf);
  let passer = byName(ev.passer); if (passer < 0 || passer === shooter) passer = pickOf([...mf, ...fw].filter((i) => i !== shooter));
  const chain = [rnd() < 0.3 ? gk : pickOf(df.length ? df : mf)];
  const mids = mf.filter((i) => i !== passer && i !== shooter);
  if (mids.length) chain.push(pickOf(mids));
  chain.push(passer, shooter);
  const out = chain.filter((x, i) => x !== undefined && x !== chain[i - 1]);
  if (out.length < 3) out.unshift(pickOf(df.length ? df : mf));
  // ぜんぶ ちがう人に する(おなじ 人への パスは けす)
  const seen = new Set(); const uniq = out.filter((x) => (seen.has(x) ? false : seen.add(x)));
  if (uniq[uniq.length - 1] !== shooter) { uniq.splice(uniq.indexOf(shooter), 1); uniq.push(shooter); }
  // シュートの ばしょ: ゴールの すみ / キーパーの ところ / はずす
  const side = rnd() < 0.5 ? -1 : 1;
  let aim;
  if (ev.type === 'goal') aim = { dy: side * (6 + rnd() * 7), over: false, net: true };
  else if (ev.type === 'save') aim = { dy: side * (3 + rnd() * 10), over: false, net: false };
  else aim = rnd() < 0.5 ? { dy: side * (GOAL_HALF + 7 + rnd() * 10), over: false, net: false, wide: true } : { dy: side * rnd() * 8, over: true, net: false };
  const def = ev.type === 'tackle' && dteam ? dteam.findIndex((m) => m.name === ev.defender) : -1; // ボールを うばう ディフェンダー
  return { chain: uniq, shooter, gk, aim, type: ev.type, side: ev.side, def, kind: ev.kind || 'tackle', header: ev.how === 'header' && ev.type === 'goal' };
}

// ---- 見た目 ----------------------------------------------------------------------------
const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const HAIR = ['#2a1a0e', '#5a3a1c', '#c9a227', '#161616', '#7a3b1d', '#a8481f'];
const SKIN = ['#f4c7a1', '#e9b58c', '#d39b6b', '#a86f45'];
const RIVAL = ['#e0453a', '#f2a31b', '#2fbf71', '#9b59d0', '#e84393'];
export function look(m, side, teamName) {
  const h = hash(m.id || m.name);
  const rival = RIVAL[hash(teamName) % RIVAL.length];
  const gk = m.slot === 'GK';
  return {
    hair: HAIR[h % HAIR.length], skin: SKIN[(h >> 3) % SKIN.length],
    shirt: gk ? (side === 'a' ? '#f2e14a' : '#3bd1c6') : side === 'a' ? '#2f6df6' : rival,
    trim: side === 'a' ? '#ffffff' : '#fff6d8', shorts: gk ? '#222' : side === 'a' ? '#ffffff' : '#2a2a2a',
    star: m.rarity === 'kid' ? 'kid' : ['rare', 'super', 'legend'].includes(m.rarity) ? m.rarity : '',
  };
}

function sprite(ctx, x, y, a, o) {
  x = Math.round(x); y = Math.round(y);
  const j = Math.round(o.jump || 0);
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x - 3, y, 7, 1);
  y -= j;
  const f = o.frame || 0;
  ctx.fillStyle = a.skin; ctx.fillRect(x - 2, y - 3, 2, 3 - (f === 1 ? 1 : 0)); ctx.fillRect(x + 1, y - 3, 2, 3 - (f === 2 ? 1 : 0));
  ctx.fillStyle = '#111'; ctx.fillRect(x - 2, y - (f === 1 ? 1 : 1) , 2, 1); ctx.fillRect(x + 1, y - 1, 2, 1);
  ctx.fillStyle = a.shorts; ctx.fillRect(x - 3, y - 5, 6, 2);
  ctx.fillStyle = a.shirt; ctx.fillRect(x - 3, y - 10, 6, 5);
  ctx.fillStyle = a.trim; ctx.fillRect(x - 1, y - 10, 2, 1);
  ctx.fillStyle = a.skin;
  if (o.arms) { ctx.fillRect(x - 4, y - 14, 1, 5); ctx.fillRect(x + 3, y - 14, 1, 5); }
  else if (f === 1) { ctx.fillRect(x - 4, y - 10, 1, 3); ctx.fillRect(x + 3, y - 8, 1, 3); } else if (f === 2) { ctx.fillRect(x - 4, y - 8, 1, 3); ctx.fillRect(x + 3, y - 10, 1, 3); }
  else { ctx.fillRect(x - 4, y - 9, 1, 3); ctx.fillRect(x + 3, y - 9, 1, 3); }
  if (o.kick > 0) { ctx.fillStyle = a.skin; ctx.fillRect(x + (o.dir > 0 ? 2 : -7), y - 5, 5, 2); ctx.fillStyle = '#111'; ctx.fillRect(x + (o.dir > 0 ? 6 : -8), y - 5, 2, 2); }
  ctx.fillRect(x - 2, y - 14, 4, 4);
  ctx.fillStyle = a.hair; ctx.fillRect(x - 2, y - 15, 4, 2); ctx.fillRect(x - 2, y - 13, 1, 1); ctx.fillRect(x + 1, y - 13, 1, 1);
  ctx.fillStyle = '#111'; ctx.fillRect(x + (o.dir > 0 ? 0 : -1), y - 12, 1, 1);
  if (a.star === 'kid') { ctx.fillStyle = '#ffd23f'; ctx.fillRect(x - 2, y - 14, 4, 1); ctx.fillRect(x - 1, y - 19, 2, 2); ctx.fillRect(x - 2, y - 18, 4, 1); }
  else if (a.star) { ctx.fillStyle = a.star === 'legend' ? '#ff9f1c' : a.star === 'super' ? '#ffd23f' : '#9be7ff'; ctx.fillRect(x, y - 19, 1, 3); ctx.fillRect(x - 1, y - 18, 3, 1); }
}
// スライディング・ころんだ すがた(よこむき)
function slideSprite(ctx, x, y, a, dir) {
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x - 8, y, 16, 1);
  ctx.fillStyle = a.shirt; ctx.fillRect(x - 5, y - 5, 7, 4);
  ctx.fillStyle = a.shorts; ctx.fillRect(x + (dir > 0 ? 2 : -6), y - 5, 4, 4);
  ctx.fillStyle = a.skin; ctx.fillRect(x + (dir > 0 ? 6 : -9), y - 4, 4, 2); ctx.fillRect(x + (dir > 0 ? -8 : 6), y - 6, 4, 4);
  ctx.fillStyle = '#111'; ctx.fillRect(x + (dir > 0 ? 9 : -10), y - 4, 1, 2);
  ctx.fillStyle = a.hair; ctx.fillRect(x + (dir > 0 ? -8 : 8), y - 7, 3, 2);
}
function diveSprite(ctx, x, y, a, up, dirX) { // よこに とびつく キーパー
  x = Math.round(x); y = Math.round(y);
  ctx.save(); ctx.translate(x, y - 6); ctx.rotate((up ? -1 : 1) * Math.PI * 0.5 * (dirX > 0 ? -1 : 1) * -1);
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(-3, 5, 7, 1);
  ctx.fillStyle = a.skin; ctx.fillRect(-2, 2, 2, 3); ctx.fillRect(1, 2, 2, 3);
  ctx.fillStyle = a.shorts; ctx.fillRect(-3, 0, 6, 2);
  ctx.fillStyle = a.shirt; ctx.fillRect(-3, -5, 6, 5);
  ctx.fillStyle = a.skin; ctx.fillRect(-4, -10, 1, 6); ctx.fillRect(3, -10, 1, 6); ctx.fillRect(-2, -9, 4, 4);
  ctx.fillStyle = a.hair; ctx.fillRect(-2, -10, 4, 2);
  ctx.restore();
}

// ---- しあい ほんたい ---------------------------------------------------------------------
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const ease = (t) => t * t * (3 - 2 * t);

export function createMatch({ me, opp, events, speed = 1, rnd = Math.random, callbacks = {}, pk = null }) {
  const sides = { a: me, b: opp };
  const players = { a: [], b: [] };
  const lay = { a: layout(me.team), b: layout(opp.team) };
  for (const k of ['a', 'b']) {
    sides[k].team.forEach((m, i) => {
      const p = toPx(k, lay[k].pos[i].ax, lay[k].pos[i].ay);
      players[k].push({ k, i, m, x: p.x, y: p.y, tx: p.x, ty: p.y, look: look(m, k, sides[k].name), frame: 0, dir: k === 'a' ? 1 : -1, jump: 0, arms: false, dive: null });
    });
  }
  const ball = { x: (PITCH.x0 + PITCH.x1) / 2, y: CY, z: 0, hold: null, net: 0 };
  const cam = { x: (W - W / ZOOM) / 2, y: 60 };
  const S = { idx: -1, step: null, steps: [], si: 0, t: 0, pause: 1.1, banner: null, done: false, shake: 0, crowd: 0, anim: 0, flash: 0, speed, plan: null, started: false };
  let canvas = null; let ctx = null; let raf = 0; let last = 0; let dead = false;
  const cb = callbacks;

  // たいけい(ふだんの ばしょ)に もどす。こうげき中の チームは 前へ、まもる チームは うしろへ
  function formation(atkSide) {
    for (const k of ['a', 'b']) {
      const push = atkSide ? (k === atkSide ? 0.13 : -0.07) : 0;
      players[k].forEach((p) => {
        const L = lay[k].pos[p.i]; const gk = p.m.slot === 'GK';
        const q = toPx(k, gk ? L.ax : Math.max(0.04, L.ax + push), L.ay);
        p.tx = q.x; p.ty = q.y;
      });
    }
  }
  const holderPx = (p) => ({ x: p.x + (p.dir > 0 ? 4 : -4), y: p.y - 1 });

  function beginEvent(n) {
    S.idx = n; const ev = events[n];
    const atk = ev.side; const dfn = atk === 'a' ? 'b' : 'a';
    const plan = buildPlan(ev, sides[atk].team, rnd, sides[dfn].team); S.plan = plan;
    formation(atk);
    const goalX = atk === 'a' ? PITCH.x1 : PITCH.x0; const dirA = atk === 'a' ? 1 : -1;
    players[atk].forEach((p) => { p.dir = dirA; }); players[dfn].forEach((p) => { p.dir = -dirA; });
    const steps = []; const chain = plan.chain;
    steps.push({ type: 'hold', who: chain[0], dur: 0.45 });
    const cut = plan.type === 'tackle' && plan.kind === 'intercept'; // さいごの パスを カットされる
    for (let k = 1; k < chain.length; k++) steps.push({ type: 'pass', from: chain[k - 1], to: chain[k], k, n: chain.length, dur: 0.5, cut: cut && k === chain.length - 1 });
    if (cut) { /* パスが カットされて おわり */ }
    else if (plan.type === 'tackle') { steps.push({ type: 'dribble', who: plan.shooter, dur: 0.35 }); steps.push({ type: 'steal', who: plan.shooter, dur: 0.8 }); }
    else { steps.push({ type: 'dribble', who: plan.shooter, dur: plan.header ? 0.05 : 0.35 }); steps.push({ type: 'shot', who: plan.shooter, dur: plan.header ? 0.45 : 0.55, goalX }); }
    steps.push({ type: 'after', dur: plan.type === 'goal' ? 2.1 : plan.type === 'tackle' ? 1.3 : 1.15 });
    S.steps = steps; S.si = 0; S.t = 0; S.step = null;
    cb.onEvent && cb.onEvent({ phase: 'start', i: n, ev });
  }

  function startStep(st) {
    const atk = S.plan.side; const dfn = atk === 'a' ? 'b' : 'a'; const P = players[atk];
    st.began = true;
    if (st.type === 'hold') { ball.hold = P[st.who]; }
    if (st.type === 'pass') {
      const r = P[st.to]; const f = P[st.from];
      // うけ手は ゴールの ほうへ はしる
      const u = st.k / (st.n - 1); const L = lay[atk].pos[st.to];
      const q = toPx(atk, lerp(Math.max(L.ax, 0.3), 0.78, u * u), lerp(L.ay, 0.5 + (Math.sin(st.to * 7 + S.idx) * 0.16), u));
      r.tx = q.x; r.ty = q.y;
      if (S.plan.header && st.k === st.n - 1) { const h = toPx(atk, 0.86, 0.5 + Math.sin(S.idx * 5) * 0.1); r.tx = h.x; r.ty = h.y; st.arc = 20; } // クロス → ヘディング
      st.sx = f.x; st.sy = f.y; ball.hold = null; st.arc = st.arc || 6 + (Math.abs(f.x - q.x) > 80 ? 8 : 0);
      if (st.cut) { // うけ手の てまえで ディフェンダーが カット
        const d = defPlayer(); const pt = { x: lerp(f.x, q.x, 0.55), y: lerp(f.y, q.y, 0.55) };
        d.tx = pt.x; d.ty = pt.y; st.px = pt.x; st.py = pt.y; st.defP = d;
      }
      // まもる人が ボールに よる
      const near = players[dfn].filter((p) => p.m.slot !== 'GK').sort((a, b) => Math.hypot(a.x - q.x, a.y - q.y) - Math.hypot(b.x - q.x, b.y - q.y)).slice(0, 2);
      near.forEach((p, j) => { p.tx = lerp(p.x, q.x, 0.6 - j * 0.2); p.ty = lerp(p.y, q.y, 0.6 - j * 0.2); });
    }
    if (st.type === 'dribble') {
      const s = P[st.who]; ball.hold = s;
      const q = toPx(atk, 0.8, clamp01((s.y - PITCH.y0) / PH * 0.5 + 0.25)); s.tx = q.x; s.ty = lerp(q.y, CY, 0.35);
    }
    if (st.type === 'steal') { // ディフェンダーが ボールを うばう(スライディング)
      const d = defPlayer(); const c = P[st.who]; st.defP = d; st.carrier = c;
      ball.hold = c; d.tx = c.x + c.dir * 7; d.ty = c.y; d.dir = c.dir > 0 ? -1 : 1; st.sx = ball.x; st.sy = ball.y;
    }
    if (st.type === 'shot') {
      const s = P[st.who]; if (!S.plan.header) s.kick = 0.35; const keeper = players[dfn][S.plan.gk >= 0 ? lay[dfn].rows.GK[0] : 0];
      const A = S.plan.aim; ball.hold = null; st.sx = ball.x; st.sy = ball.y;
      const ty = CY + A.dy;
      if (S.plan.type === 'goal') { st.tx = st.goalX + (atk === 'a' ? 5 : -5); st.ty = ty; keeper.dive = { up: A.dy > 0, t: 0, ty: CY - A.dy * 1.2, tx: keeper.x, late: true }; }
      else if (S.plan.type === 'save') { st.tx = keeper.x - (atk === 'a' ? 5 : -5); st.ty = ty; keeper.dive = { up: ty < CY, t: 0, ty, tx: keeper.x, late: false }; }
      else { st.tx = st.goalX + (atk === 'a' ? 16 : -16); st.ty = ty; st.high = A.over ? 18 : 3; }
      st.keeper = keeper;
      s.dir = atk === 'a' ? 1 : -1;
    }
    if (st.type === 'after') {
      const type = S.plan.type;
      if (cb.onEvent) cb.onEvent({ phase: 'result', i: S.idx, ev: events[S.idx] });
      if (type === 'tackle') {
        const d = defPlayer(); const dirA = atk === 'a' ? 1 : -1; ball.hold = d;
        d.tx = d.x - dirA * 34; d.ty = lerp(d.y, CY, 0.3); d.dir = -dirA; S.crowd = 0.5;
        nextBanner(S.plan.kind === 'intercept' ? 'カット!' : 'タックル!', 0.9);
      } else if (type === 'goal') {
        nextBanner('ゴール!!', 1.1);
        S.shake = 0.5; S.crowd = 1; S.flash = 0.35; ball.net = 1;
        const sh = players[atk][S.plan.shooter];
        sh.arms = true; sh.celebrate = true;
        // みんな あつまる
        players[atk].forEach((p) => { if (p !== sh && p.m.slot !== 'GK') { const q = { x: lerp(p.x, sh.x, 0.7), y: lerp(p.y, sh.y, 0.7) }; p.tx = q.x; p.ty = q.y; } });
        sh.tx = lerp(sh.x, (PITCH.x0 + PITCH.x1) / 2, 0.15); sh.ty = lerp(sh.y, CY + 20, 0.5);
      } else if (type === 'save') { S.crowd = 0.5; nextBanner('セーブ!', 0.9); } else { S.crowd = 0.2; nextBanner('ざんねん…', 0.9); }
    }
  }
  // ボールを うばう ディフェンダー(なまえで きまって いれば その人、なければ ボールに ちかい DF)
  function defPlayer() {
    const dfn = S.plan.side === 'a' ? 'b' : 'a'; const L = players[dfn];
    if (S.plan.def >= 0 && L[S.plan.def]) return L[S.plan.def];
    const c = L.filter((p) => p.m.slot === 'DF' || p.m.slot === 'MF'); const pool = c.length ? c : L.filter((p) => p.m.slot !== 'GK');
    return pool.sort((a, b) => Math.hypot(a.x - ball.x, a.y - ball.y) - Math.hypot(b.x - ball.x, b.y - ball.y))[0];
  }

  function updateStep(st, dt) {
    const atk = S.plan.side; const P = players[atk];
    const u = clamp01(S.t / st.dur);
    if (st.type === 'hold') { const h = holderPx(P[st.who]); ball.x = h.x; ball.y = h.y; ball.z = 0; }
    else if (st.type === 'pass') {
      const r = P[st.to]; const tx = st.cut ? st.px : r.x + r.dir * 2; const ty = st.cut ? st.py : r.y;
      ball.x = lerp(st.sx, tx, ease(u)); ball.y = lerp(st.sy, ty, ease(u)); ball.z = Math.sin(u * Math.PI) * st.arc * (st.cut ? 0.6 : 1);
      if (u >= 1) { ball.hold = st.cut ? st.defP : r; }
    } else if (st.type === 'dribble') { const h = holderPx(P[st.who]); ball.x = h.x; ball.y = h.y; ball.z = 0; }
    else if (st.type === 'steal') {
      const d = st.defP; const c = st.carrier;
      if (u < 0.35) { const h = holderPx(c); ball.x = h.x; ball.y = h.y; ball.z = 0; }
      else { const v = clamp01((u - 0.35) / 0.65); d.slide = u < 0.8; c.fallen = u > 0.5; ball.hold = null; ball.x = lerp(st.sx, d.x + d.dir * 5, ease(v)); ball.y = lerp(st.sy, d.y, ease(v)); ball.z = Math.sin(v * Math.PI) * 5; }
      if (u >= 1) { d.slide = false; ball.hold = d; }
    } else if (st.type === 'shot') {
      const uu = ease(u);
      if (S.plan.header) { const sh = P[st.who]; sh.jump = Math.sin(u * Math.PI) * 7; }
      ball.x = lerp(st.sx, st.tx, uu); ball.y = lerp(st.sy, st.ty, uu);
      ball.z = Math.sin(u * Math.PI) * (st.high != null ? st.high : 5) + (S.plan.header ? (1 - u) * 9 : 0);
      // キーパーの とびつき
      const k = st.keeper; if (k && k.dive) {
        const dd = clamp01((S.t - (k.dive.late ? 0.12 : 0.05)) / (k.dive.late ? 0.4 : 0.35)); k.dive.t = dd;
        k.x = lerp(k.dive.tx, k.dive.tx + (S.plan.side === 'a' ? 1 : -1) * -1, dd); k.y = lerp(k.dive.y0 != null ? k.dive.y0 : (k.dive.y0 = k.y), k.dive.ty, ease(dd)); k.tx = k.x; k.ty = k.y;
      }
      if (S.plan.type === 'save' && u > 0.92) { st.saved = true; }
    } else if (st.type === 'after') {
      const type = S.plan.type;
      if (type === 'tackle') { const d = defPlayer(); const h = holderPx(d); ball.x = h.x; ball.y = h.y; ball.z = 0; }
      else if (type === 'goal') { ball.net = Math.max(0, 1 - S.t / 1.2); const sh = P[S.plan.shooter]; sh.jump = Math.abs(Math.sin(S.t * 7)) * 5; }
      else if (type === 'save') {
        const k = st.keeperRef || (st.keeperRef = (() => { const dfn = atk === 'a' ? 'b' : 'a'; return players[dfn][lay[dfn].rows.GK[0]]; })());
        if (!st.vx) { st.sx = ball.x; st.sy = ball.y; st.ex = ball.x - (atk === 'a' ? 28 : -28); st.ey = ball.y + (ball.y < CY ? -26 : 26); }
        const v = clamp01(S.t / 0.6); ball.x = lerp(st.sx, st.ex, ease(v)); ball.y = lerp(st.sy, st.ey, ease(v)); ball.z = Math.sin(v * Math.PI) * 9; st.vx = 1; void k;
      } else { // はずれ: ボールは そのまま ころがって とまる
        if (!st.vx) { st.vx = 1; st.sx = ball.x; st.sy = ball.y; }
        const v = clamp01(S.t / 0.7); ball.x = st.sx + (atk === 'a' ? 10 : -10) * ease(v); ball.z = (1 - v) * 4;
      }
    }
  }

  // ---- PK戦 ----
  function startKick(i) {
    const pkS = S.pk; const K = pkS.kicks[i]; pkS.i = i; pkS.t = 0; pkS.stage = 'ready';
    const ks = K.side; const ds = ks === 'a' ? 'b' : 'a';
    const order = [...lay[ks].rows.FW, ...lay[ks].rows.MF, ...lay[ks].rows.DF];
    const kicker = players[ks][order[Math.floor(i / 2) % order.length]]; const keeper = players[ds][lay[ds].rows.GK[0]];
    pkS.kicker = kicker; pkS.keeper = keeper;
    const spot = { x: PITCH.x1 - 46, y: CY };
    const mid = (PITCH.x0 + PITCH.x1) / 2; let n = 0;
    for (const k of ['a', 'b']) for (const p of players[k]) {
      p.dive = null; p.arms = false; p.celebrate = false; p.jump = 0;
      if (p === kicker || p === keeper) continue;
      p.tx = mid + (k === 'a' ? -14 : 14); p.ty = PITCH.y0 + 20 + (n++ % 11) * 11; p.dir = k === 'a' ? 1 : -1;
    }
    kicker.x = spot.x - 26; kicker.y = spot.y + 3; kicker.tx = spot.x - 5; kicker.ty = spot.y; kicker.dir = 1;
    keeper.x = PITCH.x1 - 5; keeper.y = CY; keeper.tx = PITCH.x1 - 5; keeper.ty = CY; keeper.dir = -1;
    ball.x = spot.x; ball.y = spot.y; ball.hold = null; ball.z = 0; ball.net = 0;
    S.plan = { side: 'a', type: K.kind, gk: lay[ds].rows.GK[0] };
    cb.onPk && cb.onPk({ phase: 'start', i, kick: K, shown: pkS.kicks.slice(0, i) });
  }
  function stepPk(dt) {
    const q = S.pk; const K = q.kicks[q.i]; q.t += dt;
    const kp = q.keeper;
    if (q.stage === 'ready') {
      if (q.t >= 0.95) {
        q.stage = 'shot'; q.t = 0; q.sx = ball.x; q.sy = ball.y;
        const dy = (rnd() < 0.5 ? -1 : 1) * (7 + rnd() * 7);
        if (K.kind === 'goal') { q.tx = PITCH.x1 + 5; q.ty = CY + dy; kp.dive = { up: dy > 0, t: 0, ty: CY - dy * 1.2, late: true, y0: kp.y }; }
        else if (K.kind === 'save') { q.tx = PITCH.x1 - 6; q.ty = CY + dy * 0.8; kp.dive = { up: dy < 0, t: 0, ty: CY + dy * 0.8, late: false, y0: kp.y }; }
        else { q.tx = PITCH.x1 + 14; q.ty = CY + (dy > 0 ? 1 : -1) * (GOAL_HALF + 9); q.high = 3; }
      }
      return;
    }
    if (q.stage === 'shot') {
      const u = clamp01(q.t / 0.5); const e = ease(u);
      ball.x = lerp(q.sx, q.tx, e); ball.y = lerp(q.sy, q.ty, e); ball.z = Math.sin(u * Math.PI) * (q.high != null ? q.high : 4);
      if (kp.dive) { const dd = clamp01((q.t - (kp.dive.late ? 0.1 : 0.04)) / 0.38); kp.dive.t = dd; kp.y = lerp(kp.dive.y0, kp.dive.ty, ease(dd)); kp.ty = kp.y; }
      if (u >= 1) {
        q.stage = 'after'; q.t = 0;
        if (K.kind === 'goal') { S.shake = 0.35; S.crowd = 1; S.flash = 0.25; ball.net = 1; q.kicker.arms = true; } else if (K.kind === 'save') { S.crowd = 0.4; q.ex = ball.x - 22; q.ey = ball.y + (ball.y < CY ? -18 : 18); q.bx = ball.x; q.by = ball.y; }
        cb.onPk && cb.onPk({ phase: 'result', i: q.i, kick: K, shown: q.kicks.slice(0, q.i + 1) });
      }
      return;
    }
    // after
    if (K.kind === 'save') { const v = clamp01(q.t / 0.5); ball.x = lerp(q.bx, q.ex, ease(v)); ball.y = lerp(q.by, q.ey, ease(v)); ball.z = Math.sin(v * Math.PI) * 6; }
    if (K.kind === 'goal') { ball.net = Math.max(0, 1 - q.t / 0.9); q.kicker.jump = Math.abs(Math.sin(q.t * 8)) * 4; }
    if (q.t >= (K.kind === 'goal' ? 1.2 : 0.95)) {
      q.kicker.jump = 0;
      if (q.i + 1 >= q.kicks.length) { q.on = false; S.done = true; nextBanner('PK戦 しゅうりょう', 2); cb.onEnd && cb.onEnd(); return; }
      startKick(q.i + 1);
    }
  }
  function nextBanner(text, dur) { S.banner = { text, t: dur }; cb.onBanner && cb.onBanner(text); }

  function step(dt) {
    S.anim += dt;
    // カメラ: ボールを おいかける(すこし ゴールの ほうを みる)
    const lead = S.plan ? (S.plan.side === 'a' ? 18 : -18) : 0;
    const tx = Math.max(0, Math.min(W - W / ZOOM, ball.x + lead - W / ZOOM / 2));
    const ty = Math.max(0, Math.min(H - H / ZOOM, ball.y - H / ZOOM / 2));
    const k = Math.min(1, dt * 4.5); cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
    // えんしゅつの げんすい
    for (const k of ['a', 'b']) for (const p of players[k]) if (p.kick > 0) p.kick -= dt;
    S.shake = Math.max(0, S.shake - dt); S.flash = Math.max(0, S.flash - dt); S.crowd = Math.max(0, S.crowd - dt * 0.35);
    // せんしゅの いどう
    for (const k of ['a', 'b']) for (const p of players[k]) {
      const dx = p.tx - p.x; const dy = p.ty - p.y; const d = Math.hypot(dx, dy);
      if (!p.dive || p.dive.t >= 1 || !S.step) {
        const sp = Math.min(d, (p.m.slot === 'GK' ? 30 : 62) * dt * 1.6);
        if (d > 0.4) { p.x += (dx / d) * sp; p.y += (dy / d) * sp; p.frame = 1 + (Math.floor(S.anim * 10) % 2); if (Math.abs(dx) > 1.5) p.dir = dx > 0 ? 1 : -1; } else p.frame = 0;
      }
      if (!p.celebrate) p.jump = 0;
    }
    if (S.done) return;
    if (S.pause > 0) { S.pause -= dt; if (S.pause <= 0 && !S.started) { S.started = true; beginEvent(0); S.pause = 0; } else if (S.pause <= 0 && S.pk && !S.pk.on) { S.pk.on = true; startKick(0); } else if (S.pause <= 0 && S.next) { const n = S.next; S.next = null; players.a.concat(players.b).forEach((p) => { p.celebrate = false; p.arms = false; p.dive = null; p.slide = false; p.fallen = false; p.kick = 0; }); beginEvent(n); } return; }
    if (S.pk && S.pk.on) { stepPk(dt); return; }
    if (!S.started) return;
    const st = S.steps[S.si];
    if (!st) return;
    if (!st.began) startStep(st);
    S.t += dt;
    updateStep(st, dt);
    if (S.t >= st.dur) {
      S.si++; S.t = 0;
      if (S.si >= S.steps.length) { // 1かい おわり
        const n = S.idx + 1;
        if (cb.onEvent) cb.onEvent({ phase: 'end', i: S.idx, ev: events[S.idx] });
        if (n >= events.length) {
          ball.hold = null; formation(null);
          if (pk && pk.length) { S.pk = { kicks: pk, i: -1, on: false }; nextBanner('PK戦', 1.6); S.pause = 1.7; return; }
          S.done = true; nextBanner('FULL TIME', 2.5); cb.onEnd && cb.onEnd(); return;
        }
        // ハーフタイム(ぜんぶの まんなか)
        const half = events[n].idx != null && events[n].total && events[n].idx === Math.floor(events[n].total / 2) && events[S.idx].idx < events[n].idx;
        formation(null); ball.x = (PITCH.x0 + PITCH.x1) / 2; ball.y = CY; ball.hold = null; ball.z = 0; ball.net = 0;
        if (half) nextBanner('HALF TIME', 1.6);
        S.next = n; S.pause = half ? 1.6 : 0.55;
      }
    }
  }

  // ---- かく ---------------------------------------------------------------------------
  function drawPitch(c) {
    c.fillStyle = '#0c1a33'; c.fillRect(0, 0, W, H);
    // かんきゃく
    const boost = S.crowd;
    for (let r = 0; r < 3; r++) for (let x = 0; x < W; x += 4) {
      const h = hash(`${x}:${r}`); const hop = boost > 0.05 && (h & 3) === 0 ? Math.round(Math.abs(Math.sin(S.anim * 9 + x)) * 3 * boost) : 0;
      c.fillStyle = ['#e8564a', '#f4c542', '#4aa3e8', '#e8e8e8', '#6fcf97', '#a56de2'][h % 6]; c.fillRect(x, 7 + r * 5 - hop, 3, 3); c.fillStyle = '#d9a784'; c.fillRect(x, 5 + r * 5 - hop, 3, 2);
    }
    c.fillStyle = '#1b2d4f'; c.fillRect(0, 20, W, 4);
    // しばふ
    for (let i = 0; i < 12; i++) { c.fillStyle = i % 2 ? '#2f8f46' : '#379c4e'; c.fillRect(PITCH.x0 + (i * PW) / 12, PITCH.y0, Math.ceil(PW / 12), PH); }
    c.fillStyle = '#2a7d3d'; c.fillRect(0, PITCH.y0, PITCH.x0, PH); c.fillRect(PITCH.x1, PITCH.y0, W - PITCH.x1, PH); c.fillRect(0, PITCH.y1, W, H - PITCH.y1);
    // ライン
    c.fillStyle = 'rgba(255,255,255,.85)';
    c.fillRect(PITCH.x0, PITCH.y0, PW, 1); c.fillRect(PITCH.x0, PITCH.y1 - 1, PW, 1); c.fillRect(PITCH.x0, PITCH.y0, 1, PH); c.fillRect(PITCH.x1 - 1, PITCH.y0, 1, PH);
    c.fillRect((PITCH.x0 + PITCH.x1) / 2, PITCH.y0, 1, PH);
    const mid = (PITCH.x0 + PITCH.x1) / 2;
    for (let a = 0; a < 64; a++) { const t = (a / 64) * Math.PI * 2; c.fillRect(Math.round(mid + Math.cos(t) * 24), Math.round(CY + Math.sin(t) * 24), 1, 1); }
    for (const s of [0, 1]) { // ペナルティエリア
      const x = s ? PITCH.x1 - 38 : PITCH.x0; c.fillRect(x, CY - 36, 38, 1); c.fillRect(x, CY + 36, 38, 1); c.fillRect(s ? x : x + 37, CY - 36, 1, 73);
      const x2 = s ? PITCH.x1 - 14 : PITCH.x0; c.fillRect(x2, CY - 18, 14, 1); c.fillRect(x2, CY + 18, 14, 1); c.fillRect(s ? x2 : x2 + 13, CY - 18, 1, 37);
    }
    // ゴール(あみ)
    const net = ball.net;
    for (const s of [0, 1]) {
      const gx = s ? PITCH.x1 : PITCH.x0 - 8;
      c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(gx, CY - GOAL_HALF, 8, GOAL_HALF * 2);
      c.fillStyle = 'rgba(255,255,255,.45)';
      for (let y = CY - GOAL_HALF; y < CY + GOAL_HALF; y += 3) c.fillRect(gx, y, 8, 1);
      for (let x = 0; x < 8; x += 3) c.fillRect(gx + x, CY - GOAL_HALF, 1, GOAL_HALF * 2);
      c.fillStyle = '#fff'; c.fillRect(s ? PITCH.x1 - 1 : PITCH.x0 - 8, CY - GOAL_HALF - 1, 9, 2); c.fillRect(s ? PITCH.x1 - 1 : PITCH.x0 - 8, CY + GOAL_HALF - 1, 9, 2);
      if (net > 0 && S.plan && ((s && S.plan.side === 'a') || (!s && S.plan.side === 'b'))) { c.fillStyle = `rgba(255,255,255,${0.5 * net})`; c.fillRect(gx - 2, CY - GOAL_HALF, 12, GOAL_HALF * 2); }
    }
  }

  function render() {
    if (!ctx) return;
    const c = ctx; c.imageSmoothingEnabled = false;
    c.save();
    if (S.shake > 0) c.translate(Math.round((Math.random() - 0.5) * 8 * S.shake * 2), Math.round((Math.random() - 0.5) * 6 * S.shake * 2));
    c.scale(ZOOM, ZOOM); c.translate(-Math.round(cam.x), -Math.round(cam.y));
    drawPitch(c);
    const all = [...players.a, ...players.b].sort((p, q) => p.y - q.y);
    const drawBall = () => {
      const bx = Math.round(ball.x); const by = Math.round(ball.y);
      c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(bx - 1, by + 1, 4, 1);
      c.fillStyle = '#fff'; c.fillRect(bx - 1, by - 2 - Math.round(ball.z), 3, 3); c.fillStyle = '#222'; c.fillRect(bx, by - 1 - Math.round(ball.z), 1, 1);
    };
    let ballDone = false;
    for (const p of all) {
      if (!ballDone && ball.y < p.y) { drawBall(); ballDone = true; }
      if (p.dive && p.dive.t > 0 && p.dive.t < 1.01 && S.step !== null) diveSprite(c, p.x, p.y, p.look, p.dive.up, p.dir);
      else if (p.dive && p.dive.t > 0) diveSprite(c, p.x, p.y, p.look, p.dive.up, p.dir);
      else if (p.slide || p.fallen) slideSprite(c, p.x, p.y, p.look, p.slide ? p.dir : -p.dir);
      else sprite(c, p.x, p.y, p.look, { frame: p.frame, jump: p.jump, arms: p.arms, dir: p.dir, kick: p.kick });
    }
    if (!ballDone) drawBall();
    c.restore();
    if (S.flash > 0) { c.fillStyle = `rgba(255,255,255,${S.flash * 0.7})`; c.fillRect(0, 0, W, H); }
  }

  function loop(ts) {
    if (dead) return;
    const dt = Math.min(0.05, last ? (ts - last) / 1000 : 0.016) * S.speed; last = ts;
    step(dt); render();
    raf = requestAnimationFrame(loop);
  }

  return {
    attach(cv) { canvas = cv; ctx = cv ? cv.getContext('2d') : null; if (cv) { cv.width = W; cv.height = H; } if (!raf && !dead) { last = 0; raf = requestAnimationFrame(loop); } render(); },
    setSpeed(n) { S.speed = n; },
    get speed() { return S.speed; },
    get done() { return S.done; },
    skip() { S.done = true; formation(null); ball.x = (PITCH.x0 + PITCH.x1) / 2; ball.y = CY; ball.hold = null; ball.z = 0; players.a.concat(players.b).forEach((p) => { p.x = p.tx; p.y = p.ty; p.arms = false; p.dive = null; p.celebrate = false; p.jump = 0; }); cb.onEnd && cb.onEnd(); render(); },
    destroy() { dead = true; if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf); },
    // テスト用
    _state: S, _players: players, _ball: ball, _step: step,
  };
}
