// ピクセルの しあい アニメ。simulate() の events(チャンス12かい)を、11人ずつの ドットの 選手が プレーする 映像に する。
// 画面の しくみ(DOM)には さわらない。canvas を わたして つかう。ロジック(buildPlan など)は node で テストできる。
//   const m = createMatch({ me, opp, events, speed, callbacks }); m.attach(canvas); ... m.destroy();
//   me / opp: { name, team: [{ id, name, slot, rarity }] }   events: simulate の events(各 ev に idx, total を つける)

export const W = 320; export const H = 212; // したに ベンチと かんきゃくせきの ぶんも ある
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
  const start = ev.type === 'tackle' ? 'open' : ev.start || 'open'; // コーナーキック / フリーキック
  return { chain: uniq, shooter, gk, aim, type: ev.type, side: ev.side, def, kind: ev.kind || 'tackle', card: ev.card || '', start, taker: uniq.length > 1 ? uniq[uniq.length - 2] : uniq[0], header: (ev.how === 'header' && ev.type === 'goal') || (start === 'corner') };
}

// ---- 見た目 ----------------------------------------------------------------------------
const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const HAIR = ['#2a1a0e', '#5a3a1c', '#c9a227', '#161616', '#7a3b1d', '#a8481f', '#d9d9e0', '#2c4d9c'];
const SKIN = ['#f4c7a1', '#e9b58c', '#d39b6b', '#a86f45', '#7d4e2d'];
const RIVAL = ['#e0453a', '#f2a31b', '#2fbf71', '#9b59d0', '#e84393', '#18a0a0'];
const OL = '#14121c'; // ふちどり(カイロソフトふうの くろい ふち)
export function look(m, side, teamName) {
  const h = hash(m.id || m.name);
  const th = hash(teamName);
  const rival = RIVAL[th % RIVAL.length];
  const gk = m.slot === 'GK';
  const shirt = gk ? (side === 'a' ? '#f2e14a' : '#3bd1c6') : side === 'a' ? '#2f6df6' : rival;
  return {
    hair: HAIR[h % HAIR.length], skin: SKIN[(h >> 3) % SKIN.length], style: (h >> 6) % 6,
    shirt, trim: side === 'a' ? '#ffffff' : '#fff6d8', shorts: gk ? '#222' : side === 'a' ? '#ffffff' : '#2a2a2a',
    sock: gk ? '#222' : side === 'a' ? '#2f6df6' : rival, pat: gk ? 0 : (th >> 4) % 4, glove: gk,
    star: m.rarity === 'kid' ? 'kid' : ['rare', 'super', 'legend'].includes(m.rarity) ? m.rarity : '',
  };
}

// からだの ぶひんを ふちどりつきで かく。list: [x, y, w, h, いろ](あしもとの まんなかが げんてん。みぎむき)
function drawParts(ctx, ox, oy, flip, list) {
  ctx.fillStyle = OL;
  for (const [x, y, w, h] of list) ctx.fillRect(ox + (flip ? -x - w : x) - 1, oy + y - 1, w + 2, h + 2);
  for (const [x, y, w, h, c] of list) { ctx.fillStyle = c; ctx.fillRect(ox + (flip ? -x - w : x), oy + y, w, h); }
}
function bodyParts(a, o) {
  const f = o.frame || 0; const L = [];
  const hand = a.glove ? '#ffd23f' : a.skin;
  const run = f === 1 || f === 2;
  // あし(うしろ・まえ)
  const legs = [[-3, f === 1 ? -1 : 0], [1, f === 2 ? -1 : 0]];
  legs.forEach(([lx, lift], i) => {
    const bx = run && i === (f === 1 ? 1 : 0) ? lx + 1 : lx; // はなれた あしは うしろへ
    L.push([bx, -5 + lift, 2, 2, a.skin], [bx, -3 + lift, 2, 2, a.sock], [bx, -1 + lift, 3, 1, '#111']);
  });
  if (o.kick > 0) L.push([1, -5, 6, 2, a.skin], [1, -3, 6, 1, a.sock], [7, -5, 2, 2, '#111']); // けりあしを のばす
  // ズボン・シャツ
  L.push([-4, -8, 8, 3, a.shorts], [-4, -13, 8, 5, a.shirt]);
  if (a.pat === 1) L.push([-4, -12, 8, 1, a.trim], [-4, -10, 8, 1, a.trim]);
  else if (a.pat === 2) L.push([-2, -13, 1, 5, a.trim], [1, -13, 1, 5, a.trim]);
  else if (a.pat === 3) L.push([-4, -11, 8, 2, a.trim]);
  L.push([-2, -13, 4, 1, a.trim]);
  // うで
  if (o.arms) L.push([-6, -17, 2, 5, a.shirt], [-6, -19, 2, 2, hand], [4, -17, 2, 5, a.shirt], [4, -19, 2, 2, hand]);
  else {
    const by = f === 1 ? -13 : f === 2 ? -11 : -12; const fy = f === 1 ? -11 : f === 2 ? -13 : -12;
    L.push([-6, by, 2, 4, a.shirt], [-6, by + 4, 2, 2, hand], [4, fy, 2, 4, a.shirt], [4, fy + 4, 2, 2, hand]);
  }
  // あたま
  L.push([-3, -19, 6, 6, a.skin]);
  const st = a.style; const hc = a.hair;
  if (st === 0) L.push([-3, -20, 6, 2, hc], [-3, -18, 1, 2, hc]);
  else if (st === 1) L.push([-3, -20, 6, 2, hc], [-3, -22, 2, 2, hc], [0, -22, 2, 2, hc], [2, -21, 1, 1, hc]);
  else if (st === 2) L.push([-3, -20, 6, 2, hc], [-4, -19, 2, 6, hc]);
  else if (st === 3) L.push([-4, -22, 8, 4, hc], [-4, -19, 2, 3, hc]);
  else if (st === 4) L.push([-3, -20, 6, 2, hc], [-6, -18, 3, 2, hc], [-6, -16, 2, 3, hc]);
  else L.push([-3, -20, 6, 2, hc], [-3, -18, 6, 1, '#e84343']);
  L.push([-1, -17, 1, 2, OL], [2, -17, 1, 2, OL]);
  return L;
}
function markParts(a) { // せんしゅの めじるし(じぶん・レア いじょう)
  if (a.star === 'kid') return [[-3, -24, 6, 1, '#ffd23f'], [-3, -26, 1, 2, '#ffd23f'], [0, -27, 1, 3, '#ffd23f'], [2, -26, 1, 2, '#ffd23f']];
  if (a.star) { const c = a.star === 'legend' ? '#ff9f1c' : a.star === 'super' ? '#ffd23f' : '#9be7ff'; return [[0, -27, 1, 5, c], [-2, -25, 5, 1, c]]; }
  return [];
}
function sprite(ctx, x, y, a, o) {
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.fillRect(x - 5, y, 10, 1); ctx.fillRect(x - 4, y + 1, 8, 1);
  drawParts(ctx, x, y - Math.round(o.jump || 0), o.dir < 0, [...bodyParts(a, o), ...markParts(a)]);
}
// スライディング・ころんだ すがた(よこむき)
function slideSprite(ctx, x, y, a, dir) {
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.fillRect(x - 10, y, 20, 1);
  drawParts(ctx, x, y, dir < 0, [
    [-9, -8, 6, 6, a.skin], [-9, -9, 6, 2, a.hair], [-6, -6, 1, 2, OL],
    [-4, -8, 7, 5, a.shirt], [-4, -6, 7, 1, a.trim],
    [3, -7, 4, 4, a.shorts], [7, -6, 6, 2, a.skin], [11, -6, 3, 2, a.sock], [13, -6, 2, 2, '#111'],
    [-3, -10, 6, 2, a.shirt], [3, -10, 2, 2, a.skin],
  ]);
}
function diveSprite(ctx, x, y, a, up, dirX) { // よこに とびつく キーパー
  x = Math.round(x); y = Math.round(y);
  ctx.save(); ctx.translate(x, y - 9); ctx.rotate((up ? -1 : 1) * Math.PI * 0.5 * (dirX > 0 ? -1 : 1) * -1);
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(-5, 9, 10, 1);
  drawParts(ctx, 0, 9, false, bodyParts(a, { arms: true, frame: 0 }));
  ctx.restore();
}

// ---- しあい ほんたい ---------------------------------------------------------------------
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const ease = (t) => t * t * (3 - 2 * t);

export function createMatch({ me, opp, events, speed = 1, rnd = Math.random, callbacks = {}, pk = null, replay = true }) {
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
  const say = (t) => cb.onCommentary && cb.onCommentary(t); // じっきょう
  const sfx = (n) => cb.onSfx && cb.onSfx(n);              // こうかおん
  // えんしゅつ: ほこり・ひばな・かみふぶき(Math.random: しあいの けっかの らんすうを みださない)
  const fxp = [];
  const burst = (x, y, n, colors, o = {}) => { for (let i = 0; i < n; i++) fxp.push({ x, y, vx: (Math.random() - 0.5) * (o.spread || 50), vy: -Math.random() * (o.up || 25) - 4, t: 0, l: (o.life || 0.7) * (0.6 + Math.random() * 0.6), c: colors[Math.floor(Math.random() * colors.length)], s: o.size || 2 }); };
  const trail = []; // ボールの きせき
  const hist = []; let histT = 0; // リプレイ用の きろく(1びょう 30こま)
  const snap = () => ({ b: [ball.x, ball.y, ball.z, ball.net], c: [cam.x, cam.y], p: [...players.a, ...players.b].map((p) => [p.x, p.y, p.frame, p.dir, p.jump, p.arms ? 1 : 0, p.slide ? 1 : 0, p.fallen ? 1 : 0, p.kick || 0, p.dive ? [p.dive.up, p.dive.t] : 0]) });
  const applyFrame = (f) => {
    ball.x = f.b[0]; ball.y = f.b[1]; ball.z = f.b[2]; ball.net = f.b[3]; cam.x = f.c[0]; cam.y = f.c[1];
    [...players.a, ...players.b].forEach((p, i) => { const q = f.p[i]; p.x = q[0]; p.y = q[1]; p.frame = q[2]; p.dir = q[3]; p.jump = q[4]; p.arms = !!q[5]; p.slide = !!q[6]; p.fallen = !!q[7]; p.kick = q[8]; p.dive = q[9] ? { up: q[9][0], t: q[9][1] } : null; p.tx = p.x; p.ty = p.y; });
  };

  // たいけい(ふだんの ばしょ)に もどす。こうげき中の チームは 前へ、まもる チームは うしろへ
  function formation(atkSide) {
    for (const k of ['a', 'b']) {
      const push = atkSide ? (k === atkSide ? 0.13 : -0.07) : 0;
      players[k].forEach((p) => {
        const L = lay[k].pos[p.i]; const gk = p.m.slot === 'GK';
        const q = toPx(k, gk ? L.ax : Math.max(0.04, L.ax + push), L.ay);
        p.tx = q.x; p.ty = q.y; p.bx = q.x; p.by = q.y;
      });
    }
  }
  // ボールの うごきに あわせて、ほかの せんしゅも うごく(こうげきは はしりこみ、まもりは ボールに よる)
  function shape(excl, u = 0) {
    const atk = S.plan.side; const dirA = atk === 'a' ? 1 : -1;
    for (const k of ['a', 'b']) for (const p of players[k]) {
      if (excl.includes(p) || p.m.slot === 'GK' || p.bx == null) continue;
      if (k === atk) { p.tx = p.bx + dirA * 10 * u + (ball.x - p.bx) * 0.1; p.ty = p.by + (ball.y - p.by) * 0.2 + Math.sin(p.i * 3 + S.idx) * 4; }
      else { p.tx = p.bx + (ball.x - p.bx) * 0.2; p.ty = p.by + (ball.y - p.by) * 0.32; }
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
    const sp = plan.type !== 'tackle' && (plan.start === 'corner' || plan.start === 'freekick'); // セットプレー
    const cut = plan.type === 'tackle' && plan.kind === 'intercept'; // さいごの パスを カットされる
    if (sp) {
      steps.push({ type: 'setpiece', kind: plan.start, dur: 1.5 });
      if (plan.start === 'corner') { steps.push({ type: 'cross', from: plan.taker, to: plan.shooter, dur: 0.85 }); steps.push({ type: 'shot', who: plan.shooter, dur: 0.45, goalX }); }
      else steps.push({ type: 'shot', who: plan.shooter, dur: 0.75, goalX, fk: true });
    } else {
      steps.push({ type: 'hold', who: chain[0], dur: 0.45 });
      for (let k = 1; k < chain.length; k++) steps.push({ type: 'pass', from: chain[k - 1], to: chain[k], k, n: chain.length, dur: 0.5, cut: cut && k === chain.length - 1 });
    }
    if (sp) { /* せっとぴーすは じょうの とおり */ }
    else if (cut) { /* パスが カットされて おわり */ }
    else if (plan.type === 'tackle') { steps.push({ type: 'dribble', who: plan.shooter, dur: 0.35 }); steps.push({ type: 'steal', who: plan.shooter, dur: 0.8 }); }
    else { steps.push({ type: 'dribble', who: plan.shooter, dur: plan.header ? 0.05 : 0.35 }); steps.push({ type: 'shot', who: plan.shooter, dur: plan.header ? 0.45 : 0.55, goalX }); }
    steps.push({ type: 'after', dur: plan.type === 'goal' ? 1.5 : plan.type === 'tackle' ? 1.3 : 1.15 });
    if (plan.type === 'goal' && replay && S.speed <= 1.6) steps.push({ type: 'replay', dur: 3 });
    hist.length = 0; trail.length = 0;
    S.steps = steps; S.si = 0; S.t = 0; S.step = null;
    cb.onEvent && cb.onEvent({ phase: 'start', i: n, ev });
  }

  function startStep(st) {
    const atk = S.plan.side; const dfn = atk === 'a' ? 'b' : 'a'; const P = players[atk];
    st.began = true;
    const nm = (i) => (P[i] ? P[i].m.name : '');
    if (st.type === 'hold') say(`${nm(st.who)}が ボールを もった`);
    else if (st.type === 'pass') { say(st.cut ? `${nm(st.from)}の パスを…!` : `${nm(st.from)}から ${nm(st.to)}へ パス!`); sfx('pass'); }
    else if (st.type === 'dribble') say(`${nm(st.who)}が ドリブルで しかける!`);
    else if (st.type === 'shot') { say(`${nm(st.who)}の シュート!!`); if (!S.plan.header) sfx('kick'); burst(ball.x, ball.y, 6, ['#fff', '#ffe066', '#ffd23f'], { spread: 40, up: 14, life: 0.35 }); }
    else if (st.type === 'steal') { say(S.plan.kind === 'foul' ? `${defPlayer().m.name}が ひっかけた!` : `${defPlayer().m.name}が タックル!`); sfx('tackle'); }
    else if (st.type === 'setpiece') { setPiece(st); }
    else if (st.type === 'cross') { const f = P[st.from]; f.kick = 0.35; say(`${f.m.name}の クロス!`); sfx('kick'); }
    if (st.type === 'replay') {
      const fr = hist.slice(Math.max(0, (S.goalMark || hist.length) - 84), Math.min(hist.length, (S.goalMark || hist.length) + 6));
      st.frames = fr.length ? fr : [snap()]; st.dur = Math.max(0.5, st.frames.length / 20); S.rp = true; say('リプレイ'); cb.onReplay && cb.onReplay(true);
    }
    if (st.type === 'hold') { ball.hold = P[st.who]; }
    if (st.type === 'pass') {
      const r = P[st.to]; const f = P[st.from];
      // うけ手は ゴールの ほうへ はしる
      const u = st.k / (st.n - 1); const L = lay[atk].pos[st.to];
      shape([P[st.from], P[st.to]], u);
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
    if (st.type === 'cross') { const f = P[st.from]; ball.hold = null; st.sx = ball.x; st.sy = ball.y; st.arc = 24; void f; }
    if (st.type === 'dribble') {
      const s = P[st.who]; ball.hold = s;
      const q = toPx(atk, 0.8, clamp01((s.y - PITCH.y0) / PH * 0.5 + 0.25)); s.tx = q.x; s.ty = lerp(q.y, CY, 0.35);
    }
    if (st.type === 'steal') { // ディフェンダーが ボールを うばう(スライディング)
      const d = defPlayer(); const c = P[st.who]; st.defP = d; st.carrier = c;
      ball.hold = c; d.tx = c.x + c.dir * 7; d.ty = c.y; d.dir = c.dir > 0 ? -1 : 1; st.sx = ball.x; st.sy = ball.y;
      burst(c.x, c.y, 10, ['#e8e0c8', '#cbbf9a', '#b8a77a'], { spread: 40, up: 12, life: 0.6, size: 2 });
    }
    if (st.type === 'shot') {
      const s = P[st.who]; if (!S.plan.header) s.kick = 0.35; const keeper = players[dfn][S.plan.gk >= 0 ? lay[dfn].rows.GK[0] : 0];
      const A = S.plan.aim; ball.hold = null; st.sx = ball.x; st.sy = ball.y;
      const ty = CY + A.dy;
      if (S.plan.type === 'goal') { st.tx = st.goalX + (atk === 'a' ? 5 : -5); st.ty = ty; keeper.dive = { up: A.dy > 0, t: 0, ty: CY - A.dy * 1.2, tx: keeper.x, late: true }; }
      else if (S.plan.type === 'save') { st.tx = keeper.x - (atk === 'a' ? 5 : -5); st.ty = ty; keeper.dive = { up: ty < CY, t: 0, ty, tx: keeper.x, late: false }; }
      else { st.tx = st.goalX + (atk === 'a' ? 16 : -16); st.ty = ty; st.high = A.over ? 18 : 3; }
      if (st.fk) { st.high = A.over ? 24 : 15; st.curve = (A.dy > 0 ? 1 : -1) * 9; s.kick = 0.4; sfx('kick'); }
      st.keeper = keeper;
      s.dir = atk === 'a' ? 1 : -1;
    }
    if (st.type === 'after') {
      const type = S.plan.type;
      if (cb.onEvent) cb.onEvent({ phase: 'result', i: S.idx, ev: events[S.idx] });
      S.goalMark = type === 'goal' ? hist.length : S.goalMark;
      say(type === 'goal' ? `ゴール!! ${nm(S.plan.shooter)}!` : type === 'save' ? 'ナイスセーブ!' : type === 'tackle' ? (S.plan.kind === 'foul' ? (S.plan.card ? 'ファウル! イエローカード!' : 'ファウル!') : S.plan.kind === 'intercept' ? 'パスカット!' : 'ナイスタックル!') : 'ああっ ざんねん…');
      sfx(type === 'goal' ? 'goal' : type === 'save' ? 'save' : type === 'tackle' ? 'tackle' : 'miss');
      if (type === 'goal') { const gx = atk === 'a' ? PITCH.x1 : PITCH.x0; burst(gx, CY, 70, ['#ffc93c', '#27d8ff', '#ff4d5e', '#fff', '#19d68a'], { spread: 120, up: 55, life: 1.4, size: 2 }); }
      if (type === 'tackle' && S.plan.kind === 'foul') {
        const d = defPlayer(); ball.hold = players[atk][S.plan.shooter]; S.crowd = 0.3; sfx('whistle');
        nextBanner('ファウル!', 1.0); if (S.plan.card) S.card = { p: d, t: 1.4 };
      } else if (type === 'tackle') {
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
  // コーナーキック・フリーキックの じゅんび
  function setPiece(st) {
    const atk = S.plan.side; const dfn = atk === 'a' ? 'b' : 'a'; const dirA = atk === 'a' ? 1 : -1;
    const goalX = atk === 'a' ? PITCH.x1 : PITCH.x0; const P = players[atk]; const D = players[dfn];
    const snapTo = (p, x, y) => { p.tx = x; p.ty = y; p.x = lerp(p.x, x, 0.55); p.y = lerp(p.y, y, 0.55); };
    const taker = P[S.plan.taker]; const shooter = P[S.plan.shooter];
    const side = S.idx % 2 ? 1 : -1;
    nextBanner(st.kind === 'corner' ? 'コーナーキック!' : 'フリーキック!', 1.1); sfx('whistle');
    say(st.kind === 'corner' ? `コーナーキック! ${taker.m.name}が けります` : `フリーキック! ${shooter.m.name}が ねらう`);
    const others = P.filter((p) => p !== taker && p !== shooter && p.m.slot !== 'GK');
    const dOthers = D.filter((p) => p.m.slot !== 'GK');
    if (st.kind === 'corner') {
      const cy = side > 0 ? PITCH.y1 - 2 : PITCH.y0 + 2; const cx = goalX - dirA * 2;
      snapTo(taker, cx - dirA * 3, cy); ball.hold = null; ball.x = cx - dirA; ball.y = cy; ball.z = 0;
      const sp = toPx(atk, 0.9, 0.5 + side * 0.04); snapTo(shooter, sp.x, sp.y);
      others.forEach((p, j) => { const q = toPx(atk, 0.84 + (j % 3) * 0.035, 0.3 + (j % 5) * 0.1); snapTo(p, q.x, q.y); });
      dOthers.forEach((p, j) => snapTo(p, goalX - dirA * (10 + (j % 3) * 8), CY + ((j % 6) - 2.5) * 8));
    } else {
      const spot = toPx(atk, 0.74, 0.5 + side * 0.16);
      snapTo(shooter, spot.x - dirA * 7, spot.y + 1); ball.hold = null; ball.x = spot.x; ball.y = spot.y; ball.z = 0;
      const wall = dOthers.slice().sort((a, b) => Math.hypot(a.x - spot.x, a.y - spot.y) - Math.hypot(b.x - spot.x, b.y - spot.y)).slice(0, 4);
      const gc = { x: goalX, y: CY }; const ang = Math.atan2(gc.y - spot.y, gc.x - spot.x);
      wall.forEach((p, j) => snapTo(p, spot.x + Math.cos(ang) * 11 - Math.sin(ang) * (j - 1.5) * 5, spot.y + Math.sin(ang) * 11 + Math.cos(ang) * (j - 1.5) * 5));
      others.forEach((p, j) => { const q = toPx(atk, 0.82 + (j % 2) * 0.05, 0.28 + (j % 6) * 0.09); snapTo(p, q.x, q.y); });
      dOthers.filter((p) => !wall.includes(p)).forEach((p, j) => snapTo(p, goalX - dirA * (12 + (j % 3) * 8), CY + ((j % 5) - 2) * 9));
      taker.tx = taker.x;
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
    } else if (st.type === 'cross') {
      const r = P[st.to]; ball.x = lerp(st.sx, r.x + r.dir * 2, ease(u)); ball.y = lerp(st.sy, r.y, ease(u)); ball.z = Math.sin(u * Math.PI) * st.arc;
      if (u >= 1) ball.hold = r;
    } else if (st.type === 'replay') { applyFrame(st.frames[Math.min(st.frames.length - 1, Math.floor(S.t * 20))]); }
    else if (st.type === 'dribble') { const h = holderPx(P[st.who]); ball.x = h.x; ball.y = h.y; ball.z = 0; }
    else if (st.type === 'steal') {
      const d = st.defP; const c = st.carrier;
      if (u < 0.35) { const h = holderPx(c); ball.x = h.x; ball.y = h.y; ball.z = 0; }
      else if (S.plan.kind === 'foul') { d.slide = u < 0.7; c.fallen = u > 0.45; const h = holderPx(c); ball.x = h.x; ball.y = h.y; ball.z = 0; }
      else { const v = clamp01((u - 0.35) / 0.65); d.slide = u < 0.8; c.fallen = u > 0.5; ball.hold = null; ball.x = lerp(st.sx, d.x + d.dir * 5, ease(v)); ball.y = lerp(st.sy, d.y, ease(v)); ball.z = Math.sin(v * Math.PI) * 5; }
      if (u >= 1) { d.slide = false; ball.hold = S.plan.kind === 'foul' ? c : d; }
    } else if (st.type === 'shot') {
      const uu = ease(u);
      if (S.plan.header) { const sh = P[st.who]; sh.jump = Math.sin(u * Math.PI) * 7; }
      ball.x = lerp(st.sx, st.tx, uu); ball.y = lerp(st.sy, st.ty, uu) + (st.curve ? Math.sin(u * Math.PI) * st.curve : 0);
      ball.z = Math.sin(u * Math.PI) * (st.high != null ? st.high : 5) + (S.plan.header ? (1 - u) * 9 : 0);
      // キーパーの とびつき
      const k = st.keeper; if (k && k.dive) {
        const dd = clamp01((S.t - (k.dive.late ? 0.12 : 0.05)) / (k.dive.late ? 0.4 : 0.35)); k.dive.t = dd;
        k.x = lerp(k.dive.tx, k.dive.tx + (S.plan.side === 'a' ? 1 : -1) * -1, dd); k.y = lerp(k.dive.y0 != null ? k.dive.y0 : (k.dive.y0 = k.y), k.dive.ty, ease(dd)); k.tx = k.x; k.ty = k.y;
      }
      if (S.plan.type === 'save' && u > 0.92) { st.saved = true; }
    } else if (st.type === 'after') {
      const type = S.plan.type;
      if (type === 'tackle') { const d = S.plan.kind === 'foul' ? players[atk][S.plan.shooter] : defPlayer(); const h = holderPx(d); ball.x = h.x; ball.y = h.y; ball.z = 0; }
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
        q.stage = 'shot'; q.t = 0; q.sx = ball.x; q.sy = ball.y; sfx('kick');
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
        sfx(K.kind === 'goal' ? 'goal' : K.kind === 'save' ? 'save' : 'miss');
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
  function nextBanner(text, dur) {
    if (/TIME|PK/.test(text)) sfx('whistle'); S.banner = { text, t: dur }; cb.onBanner && cb.onBanner(text); }

  function step(dt) {
    S.anim += dt;
    for (let i = fxp.length - 1; i >= 0; i--) { const q = fxp[i]; q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 70 * dt; if (q.t >= q.l) fxp.splice(i, 1); }
    // カメラ: ボールを おいかける(すこし ゴールの ほうを みる)
    const lead = S.plan ? (S.plan.side === 'a' ? 18 : -18) : 0;
    const tx = Math.max(0, Math.min(W - W / ZOOM, ball.x + lead - W / ZOOM / 2));
    const ty = Math.max(0, Math.min(H - H / ZOOM, ball.y - H / ZOOM / 2));
    const k = Math.min(1, dt * 4.5); cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
    // えんしゅつの げんすい
    for (const k of ['a', 'b']) for (const p of players[k]) if (p.kick > 0) p.kick -= dt;
    if (S.card) { S.card.t -= dt; if (S.card.t <= 0) S.card = null; }
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
    if (S.pause > 0) { S.pause -= dt; if (S.pause <= 0 && !S.started) { S.started = true; sfx('whistle'); beginEvent(0); S.pause = 0; } else if (S.pause <= 0 && S.pk && !S.pk.on) { S.pk.on = true; startKick(0); } else if (S.pause <= 0 && S.next) { const n = S.next; S.next = null; players.a.concat(players.b).forEach((p) => { p.celebrate = false; p.arms = false; p.dive = null; p.slide = false; p.fallen = false; p.kick = 0; }); beginEvent(n); } return; }
    if (S.pk && S.pk.on) { stepPk(dt); return; }
    if (!S.started) return;
    const st = S.steps[S.si];
    if (!st) return;
    if (!st.began) startStep(st);
    S.t += dt;
    updateStep(st, dt);
    if (!S.rp) { // リプレイ用に きろく(30こま/びょう)・ボールの きせき
      histT += dt; while (histT >= 1 / 30) { histT -= 1 / 30; hist.push(snap()); if (hist.length > 240) hist.shift(); }
      const lt = trail[trail.length - 1];
      if (!ball.hold && (!lt || Math.hypot(ball.x - lt.x, ball.y - lt.y) > 2.5)) { trail.push({ x: ball.x, y: ball.y, z: ball.z, t: S.anim }); if (trail.length > 8) trail.shift(); }
    }
    if (S.t >= st.dur) {
      S.si++; S.t = 0;
      if (st.type === 'replay') { S.rp = false; cb.onReplay && cb.onReplay(false); }
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
    c.fillStyle = '#0a1426'; c.fillRect(0, 0, W, H);
    const boost = S.crowd;
    const crowd = (y0, rows, flip) => { // かんきゃくせき(ゴールの ときに はねる)
      c.fillStyle = '#16233f'; c.fillRect(0, y0 - 2, W, rows * 5 + 5);
      for (let r = 0; r < rows; r++) for (let x = 0; x < W; x += 4) {
        const h = hash(`${x}:${r}:${y0}`); const hop = boost > 0.05 && (h & 3) === 0 ? Math.round(Math.abs(Math.sin(S.anim * 9 + x)) * 3 * boost) : 0;
        const yy = y0 + (flip ? rows - 1 - r : r) * 5 - hop;
        c.fillStyle = ['#e8564a', '#f4c542', '#4aa3e8', '#e8e8e8', '#6fcf97', '#a56de2', '#ff9f43'][h % 7]; c.fillRect(x, yy + 2, 3, 3);
        c.fillStyle = ['#d9a784', '#c68b63', '#f0c9a6'][(h >> 3) % 3]; c.fillRect(x, yy, 3, 2);
      }
    };
    crowd(2, 3, false);
    // こうこくの ボード(うえ・した)
    const BOARD = ['#e63946', '#2a9d8f', '#f4a261', '#4361ee', '#9b5de5', '#ffbe0b'];
    const board = (y) => { for (let x = 0; x < W; x += 24) { c.fillStyle = BOARD[(x / 24) % BOARD.length]; c.fillRect(x, y, 23, 6); c.fillStyle = 'rgba(255,255,255,.75)'; c.fillRect(x + 3, y + 2, 5, 2); c.fillRect(x + 10, y + 2, 3, 2); c.fillRect(x + 15, y + 2, 5, 2); } c.fillStyle = '#0c1424'; c.fillRect(0, y + 6, W, 2); };
    board(PITCH.y0 - 10);
    // しばふ(かわるがわるの しま + ななめの かげ)
    for (let i = 0; i < 12; i++) { c.fillStyle = i % 2 ? '#2f8f46' : '#38a04f'; c.fillRect(PITCH.x0 + (i * PW) / 12, PITCH.y0, Math.ceil(PW / 12), PH); }
    for (let y = PITCH.y0; y < PITCH.y1; y += 8) { c.fillStyle = 'rgba(0,0,0,.05)'; c.fillRect(PITCH.x0, y, PW, 4); }
    c.fillStyle = '#2a7d3d'; c.fillRect(0, PITCH.y0, PITCH.x0, PH); c.fillRect(PITCH.x1, PITCH.y0, W - PITCH.x1, PH);
    c.fillStyle = '#237137'; c.fillRect(0, PITCH.y1, W, 8);
    board(PITCH.y1 + 8);
    // ベンチ(したがわ)
    for (const bx of [60, 220]) { c.fillStyle = '#e8e8f0'; c.fillRect(bx, PITCH.y1 + 17, 48, 2); c.fillStyle = '#1c2540'; c.fillRect(bx, PITCH.y1 + 19, 48, 5); for (let k = 0; k < 4; k++) { c.fillStyle = ['#2f6df6', '#ffffff'][(bx > 100 ? 1 : 0)]; c.fillRect(bx + 4 + k * 11, PITCH.y1 + 13, 5, 5); c.fillStyle = '#d9a784'; c.fillRect(bx + 4 + k * 11, PITCH.y1 + 10, 5, 4); } }
    crowd(PITCH.y1 + 27, 2, true);
    // ライン
    c.fillStyle = 'rgba(255,255,255,.9)';
    c.fillRect(PITCH.x0, PITCH.y0, PW, 1); c.fillRect(PITCH.x0, PITCH.y1 - 1, PW, 1); c.fillRect(PITCH.x0, PITCH.y0, 1, PH); c.fillRect(PITCH.x1 - 1, PITCH.y0, 1, PH);
    const mid = (PITCH.x0 + PITCH.x1) / 2; c.fillRect(mid, PITCH.y0, 1, PH);
    for (let a = 0; a < 72; a++) { const t = (a / 72) * Math.PI * 2; c.fillRect(Math.round(mid + Math.cos(t) * 24), Math.round(CY + Math.sin(t) * 24), 1, 1); }
    c.fillRect(mid - 1, CY - 1, 3, 3);
    for (const s2 of [0, 1]) { // ペナルティエリアと スポット
      const x = s2 ? PITCH.x1 - 38 : PITCH.x0; c.fillRect(x, CY - 36, 38, 1); c.fillRect(x, CY + 36, 38, 1); c.fillRect(s2 ? x : x + 37, CY - 36, 1, 73);
      const x2 = s2 ? PITCH.x1 - 14 : PITCH.x0; c.fillRect(x2, CY - 18, 14, 1); c.fillRect(x2, CY + 18, 14, 1); c.fillRect(s2 ? x2 : x2 + 13, CY - 18, 1, 37);
      c.fillRect(s2 ? PITCH.x1 - 46 : PITCH.x0 + 45, CY - 1, 2, 2);
    }
    // コーナーフラッグ
    for (const [fx, fy] of [[PITCH.x0, PITCH.y0], [PITCH.x1, PITCH.y0], [PITCH.x0, PITCH.y1], [PITCH.x1, PITCH.y1]]) { c.fillStyle = '#fff'; c.fillRect(fx, fy - 6, 1, 7); c.fillStyle = '#ff3b3b'; c.fillRect(fx + 1, fy - 6, 4, 3); }
    // ゴール(あみ・ポスト・かげ)
    const net = ball.net;
    for (const s2 of [0, 1]) {
      const gx = s2 ? PITCH.x1 : PITCH.x0 - 9;
      c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(gx, CY - GOAL_HALF - 3, 9, GOAL_HALF * 2 + 8);
      c.fillStyle = 'rgba(255,255,255,.16)'; c.fillRect(gx, CY - GOAL_HALF, 9, GOAL_HALF * 2);
      c.fillStyle = 'rgba(255,255,255,.5)';
      for (let y = CY - GOAL_HALF; y < CY + GOAL_HALF; y += 3) c.fillRect(gx, y, 9, 1);
      for (let x = 0; x < 9; x += 3) c.fillRect(gx + x, CY - GOAL_HALF, 1, GOAL_HALF * 2);
      c.fillStyle = '#fff'; c.fillRect(s2 ? PITCH.x1 - 1 : PITCH.x0 - 9, CY - GOAL_HALF - 2, 10, 3); c.fillRect(s2 ? PITCH.x1 - 1 : PITCH.x0 - 9, CY + GOAL_HALF - 1, 10, 3);
      c.fillStyle = '#cfd3df'; c.fillRect(s2 ? PITCH.x1 + 7 : PITCH.x0 - 9, CY - GOAL_HALF - 2, 2, GOAL_HALF * 2 + 4);
      if (net > 0 && S.plan && ((s2 && S.plan.side === 'a') || (!s2 && S.plan.side === 'b'))) { c.fillStyle = `rgba(255,255,255,${0.5 * net})`; c.fillRect(gx - 2, CY - GOAL_HALF, 13, GOAL_HALF * 2); }
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
      const bx = Math.round(ball.x); const by = Math.round(ball.y); const bz = Math.round(ball.z);
      c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(bx - 2, by + 1, 5, 2);
      c.fillStyle = OL; c.fillRect(bx - 3, by - 5 - bz, 6, 6); c.fillRect(bx - 2, by - 6 - bz, 4, 8);
      c.fillStyle = '#fff'; c.fillRect(bx - 2, by - 4 - bz, 4, 4); c.fillRect(bx - 1, by - 5 - bz, 2, 6);
      c.fillStyle = '#2b2b3a'; const ph = Math.floor(S.anim * 12) % 2; c.fillRect(bx - 1 + ph, by - 3 - bz, 2, 2);
    };
    // ボールの きせき
    for (const q of trail) { const age = S.anim - q.t; if (age > 0.28 || age < 0) continue; c.globalAlpha = (1 - age / 0.28) * 0.45; c.fillStyle = '#fff'; c.fillRect(Math.round(q.x) - 1, Math.round(q.y) - 2 - Math.round(q.z), 3, 3); }
    c.globalAlpha = 1;
    let ballDone = false;
    for (const p of all) {
      if (!ballDone && ball.y < p.y) { drawBall(); ballDone = true; }
      if (p.dive && p.dive.t > 0 && p.dive.t < 1.01 && S.step !== null) diveSprite(c, p.x, p.y, p.look, p.dive.up, p.dir);
      else if (p.dive && p.dive.t > 0) diveSprite(c, p.x, p.y, p.look, p.dive.up, p.dir);
      else if (p.slide || p.fallen) slideSprite(c, p.x, p.y, p.look, p.slide ? p.dir : -p.dir);
      else sprite(c, p.x, p.y, p.look, { frame: p.frame, jump: p.jump, arms: p.arms, dir: p.dir, kick: p.kick });
    }
    if (!ballDone) drawBall();
    if (S.card) { const cp = S.card.p; c.fillStyle = OL; c.fillRect(Math.round(cp.x) - 3, Math.round(cp.y) - 36, 6, 8); c.fillStyle = '#ffd23f'; c.fillRect(Math.round(cp.x) - 2, Math.round(cp.y) - 35, 4, 6); }
    for (const q of fxp) { c.globalAlpha = Math.max(0, 1 - q.t / q.l); c.fillStyle = q.c; c.fillRect(Math.round(q.x), Math.round(q.y), q.s, q.s); }
    c.globalAlpha = 1;
    c.restore();
    // ボールを もっている 人の なまえ
    const hp = ball.hold; if (hp && !S.done && !(S.pk && S.pk.on) && hp.m) {
      const label = String(hp.m.name).slice(0, 9); c.font = 'bold 9px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      const sx = (hp.x - cam.x) * ZOOM; const sy = (hp.y - 31 - cam.y) * ZOOM; const tw = c.measureText(label).width + 6;
      c.fillStyle = 'rgba(0,0,0,.62)'; c.fillRect(Math.round(sx - tw / 2), Math.round(sy - 6), Math.round(tw), 12);
      c.fillStyle = hp.k === 'a' ? '#9fd0ff' : '#ffd0a0'; c.fillText(label, Math.round(sx), Math.round(sy));
    }
    if (S.rp) { // リプレイ: すこし セピア + うえしたの くろおび
      c.fillStyle = 'rgba(255,215,140,.10)'; c.fillRect(0, 0, W, H);
      c.fillStyle = '#000'; c.fillRect(0, 0, W, 10); c.fillRect(0, H - 10, W, 10);
      c.fillStyle = '#ff3b3b'; c.fillRect(8, 14, 34, 11); c.fillStyle = '#fff'; c.font = 'bold 8px sans-serif'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText('REPLAY', 11, 20);
    }
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
