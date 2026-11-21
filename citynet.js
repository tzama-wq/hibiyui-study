// シティの きょうりょく(さいだい 3にん)。ホストが ほんもの の せかいを うごかし、ゲストは そうさを おくって けしきを うけとる。
//   ホスト: const hb = hostBindCity(sim, conn, onJoin?) を ゲストの ぶん だけ よぶ。  まいフレーム hb.tick(dt)
//   ゲスト: const gb = guestBindCity(sim, conn)  → sim.step を おきかえて、ホストの けしきを あらわす
const r1 = (v) => Math.round(v * 10) / 10; const r2 = (v) => Math.round(v * 100) / 100;
const KEYS = {
  crooks: ['id', 'type', 'x', 'y', 'z', 'yaw', 'hp', 'hpMax', 'state', 'wid', 'alert', 'minor', 'hunter', 'qtag', 'qboss', 'task', 'ph', 'air', 'cop', 'dead', 'speed'],
  traffic: ['id', 'x', 'z', 'yaw', 'model', 'tone', 'hostile', 'cop', 'dead', 'hidden', 'speeding', 'bike', 'r'],
  walkers: ['id', 'x', 'z', 'yaw', 'dead', 'look', 'scared', 'idle', 'spd', 'vert', 'dir'],
  civs: ['id', 'x', 'z', 'yaw', 'state', 'wid', 'minor', 'qtag'],
  pickups: ['id', 'kind', 'x', 'z', 'icon', 'col'],
  fires: ['id', 'x', 'z', 'h', 'hp', 'hpMax', 'r'],
  patients: ['id', 'x', 'z', 'state', 'sym'],
  jets: ['id', 'model', 'ph', 'x', 'y', 'z', 'yaw'],
  helis: ['id', 'ph', 'x', 'y', 'z', 'yaw', 'flash'],
  vehicles: ['id', 'kind', 'x', 'y', 'z', 'yaw', 'pitch', 'roll', 'occ', 'temp', 'speed', 'hp', 'hpMax', 'cat', 'model'],
  bullets: ['x', 'y', 'z', 'vx', 'vy', 'vz', 't'],
  missiles: ['x', 'y', 'z', 'vx', 'vy', 'vz', 'enemy'],
  effects: ['kind', 'x', 'y', 'z', 'r', 't', 'life'],
  wanted: ['id', 'name', 'rarity', 'rname', 'crime', 'stars', 'bounty', 'alive', 'x', 'z', 'caught', 'state'],
};
const NEAR = new Set(['crooks', 'traffic', 'walkers', 'civs', 'pickups', 'vehicles']); // ちかくの ものだけ おくる
const rnd = (v) => (typeof v === 'number' ? (Math.abs(v) < 10 ? r2(v) : r1(v)) : v);
const enc = (arr, keys) => arr.map((o) => keys.map((k) => rnd(o[k])));
const dec = (rows, keys) => rows.map((r) => { const o = {}; keys.forEach((k, i) => { if (r[i] !== undefined && r[i] !== null) o[k] = r[i]; }); return o; });
const PL = ['x', 'y', 'z', 'yaw', 'camYaw', 'aimPitch', 'hp', 'hpMax', 'dead', 'mode', 'veh', 'weapon', 'invuln', 'coins', 'speed', 'swing', 'reload', 'chute', 'aimRel', 'jh'];

export function snapshotCity(sim, forPl) {
  const S = sim.state; const pls = S.players; const near = (o) => pls.some((p) => Math.abs(p.x - o.x) < 380 && Math.abs(p.z - o.z) < 380);
  const m = { t: 's', tm: r1(S.t), lv: S.lv | 0, fine: S.fine | 0, msg: S.msg || '', mt: r2(S.msgT || 0), bn: S.banner || '', bt: r2(S.bannerT || 0), hit: S.hitT == null ? 0 : r2(S.hitT), sw: r2(S.swing || 0) };
  for (const [k, keys] of Object.entries(KEYS)) { let a = S[k] || []; if (NEAR.has(k)) a = a.filter(near); m[k] = enc(a, keys); }
  m.tracers = (S.tracers || []).map((t) => [r1(t.from.x), r1(t.from.y), r1(t.from.z), r1(t.to.x), r1(t.to.y), r1(t.to.z), r2(t.t)]);
  m.pl = pls.map((p) => PL.map((k) => (k === 'plat' ? 0 : rnd(p[k])))); m.pn = pls.map((p) => p.name || ''); m.pp = pls.map((p) => (p.plat ? p.plat.y : 0));
  if (forPl) { m.me = pls.indexOf(forPl); const A = ((forPl === pls[0] ? S.ammo : forPl.ammo) || {})[forPl.weapon]; m.am = A ? [A.mag, A.reserve] : null; m.nb = forPl.nearby ? { kind: forPl.nearby.kind, id: forPl.nearby.id, label: forPl.nearby.label } : null; }
  m.snd = (S.snd || []).slice(0, 12);
  return m;
}

export function hostBindCity(sim, conn, onEvent) {
  let pl = null; let alive = true; let acc = 0; const bestOf = {};
  conn.on((m) => {
    if (!alive || !m) return;
    if (m.t === 'hello') { if (!pl) { pl = sim.addPlayer(String(m.n || 'ゲスト').slice(0, 8), m.inv || null); if (!pl) { conn.send({ t: 'full' }); return; } if (m.pr) { bestOf.pr = m.pr; recalc(); } conn.send({ t: 'hi', me: sim.state.players.indexOf(pl) }); if (onEvent) onEvent({ e: 'join', pl }); } return; }
    if (!pl) return; const I = sim.inputOf(pl); if (!I) return;
    if (m.t === 'in' && m.i) { I.moveX = +m.i[0] || 0; I.moveY = +m.i[1] || 0; I.aimX = +m.i[2] || 0; I.aimY = +m.i[3] || 0; I.gun = !!m.i[4]; I.boost = !!m.i[5]; I.aimLock = !!m.i[6]; I.autoAim = m.i[7] !== 0; I.camYaw = typeof m.cy === 'number' ? m.cy : null; I.aimPitch = typeof m.ap === 'number' ? m.ap : null; I.turn = +m.i[8] || 0; I.climb = +m.i[9] || 0; }
    else if (m.t === 'ev') { if (m.e === 'jump') I.jump = true; else if (m.e === 'interact') sim.interactFor(pl); else if (m.e === 'reload') sim.as(pl, () => sim.reload && sim.reload()); else if (m.e === 'cycle') sim.as(pl, () => sim.cycleWeapon && sim.cycleWeapon(1)); else if (m.e === 'equip') sim.as(pl, () => sim.equip && sim.equip(String(m.id))); else if (m.e === 'wear') sim.as(pl, () => sim.wear && sim.wear(String(m.id))); }
  });
  const recalc = () => { let b = null; if (bestOf.pr) b = bestOf.pr; sim.setCoopBest(b); };
  conn.onClose(() => { alive = false; if (pl) { sim.removePlayer(pl); if (onEvent) onEvent({ e: 'leave', pl }); pl = null; } });
  return {
    tick(dt) { acc += dt; if (acc < 1 / 15 || !pl || !conn.isOpen()) return; acc = 0; conn.fast(snapshotCity(sim, pl)); sim.state.snd.length = 0; },
    get player() { return pl; }, gone: () => !alive || !conn.isOpen(),
  };
}

export function guestBindCity(sim, conn, name, progress) {
  const inv = { w: sim.state.wOwned.slice(), am: JSON.parse(JSON.stringify(sim.state.ammo || {})), wp: sim.state.player.weapon, eq: { ...sim.state.equip }, eo: sim.state.eqOwned.slice() };
  const S = sim.state; const P = S.player; let me = 0; let got = false; let lastRx = 0; const store = {}; const smooth = {};
  const objs = { crooks: new Map(), traffic: new Map(), walkers: new Map(), civs: new Map(), vehicles: new Map(), jets: new Map(), helis: new Map() };
  const adopt = (k, rows) => { const keys = KEYS[k]; const list = dec(rows, keys); const mp = objs[k]; if (!mp) return list; const out = []; const seen = new Set(); for (const n of list) { let o = mp.get(n.id); seen.add(n.id); if (!o) { o = { ...n }; o.tx = n.x; o.tz = n.z; o.tyaw = n.yaw; mp.set(n.id, o); } else { const keep = { x: o.x, z: o.z, yaw: o.yaw }; Object.assign(o, n); o.tx = n.x; o.tz = n.z; o.tyaw = n.yaw; o.x = keep.x; o.z = keep.z; o.yaw = keep.yaw; if (Math.hypot(o.tx - o.x, o.tz - o.z) > 40) { o.x = o.tx; o.z = o.tz; o.yaw = o.tyaw; } } out.push(o); } for (const id of [...mp.keys()]) if (!seen.has(id)) mp.delete(id); return out; };
  const apply = (m) => {
    got = true; lastRx = Date.now(); me = m.me == null ? me : m.me;
    S.lv = m.lv; S.fine = m.fine; S.msg = m.msg; S.msgT = m.mt; S.banner = m.bn; S.bannerT = m.bt; S.t = m.tm; if (m.hit) S.hitT = m.hit; if (m.sw > 0) S.swing = m.sw;
    for (const k of Object.keys(KEYS)) { if (!m[k]) continue; const v = adopt(k, m[k]); if (k === 'wanted') { S.wanted = v; continue; } S[k] = v; }
    S.tracers = m.tracers.map((t) => ({ from: { x: t[0], y: t[1], z: t[2] }, to: { x: t[3], y: t[4], z: t[5] }, t: t[6] }));
    // プレイヤー(じぶんと ほかの ふたり)
    const arr = m.pl.map((r, i) => { const o = {}; PL.forEach((k, j) => { o[k] = r[j]; }); o.name = m.pn[i]; o.y2 = m.pp[i]; return o; });
    if (!S.players || S.players.length !== arr.length) S.players = arr.map((o, i) => (i === me ? P : { ...o, tx: o.x, tz: o.z, tyaw: o.yaw }));
    arr.forEach((o, i) => { const tgt = S.players[i]; if (i === me) { const keep = { camYaw: P.camYaw, aimPitch: P.aimPitch, yaw: P.yaw }; const px = P.x; const pz = P.z; Object.assign(P, o); P.name = o.name; P.tx = o.x; P.tz = o.z; if (Math.hypot(o.x - px, o.z - pz) < 6 && P.mode === 'foot') { P.x = px + (o.x - px) * 0.5; P.z = pz + (o.z - pz) * 0.5; } P.camYaw = keep.camYaw; P.aimPitch = keep.aimPitch; if (o.mode !== 'foot') P.camYaw = o.camYaw; P.dead = o.dead; P.plat = o.y2 > 0 ? { y: o.y2, kind: 'roof' } : null; } else { const px = tgt.x; const pz = tgt.z; Object.assign(tgt, o); tgt.tx = o.x; tgt.tz = o.z; tgt.tyaw = o.yaw; tgt.x = Math.hypot(o.x - px, o.z - pz) > 30 ? o.x : px; tgt.z = Math.hypot(o.x - px, o.z - pz) > 30 ? o.z : pz; tgt.plat = o.y2 > 0 ? { y: o.y2, kind: 'roof' } : null; } });
    S.nearby = m.nb || null; if (m.am) { S.ammo = S.ammo || {}; S.ammo[P.weapon] = { mag: m.am[0], reserve: m.am[1] }; }
    for (const s of m.snd) if (S.snd.length < 24) S.snd.push(s);
  };
  conn.on((x) => { if (!x) return; if (x.t === 's') apply(x); else if (x.t === 'hi') me = x.me; });
  conn.send({ t: 'hello', n: name || 'ゲスト', pr: progress || null, inv });
  let sendT = 0; let lastKey = '';
  const I = sim.input;
  const sendInput = (force) => { const a = [r2(I.moveX), r2(I.moveY), r2(I.aimX), r2(I.aimY), I.gun ? 1 : 0, I.boost ? 1 : 0, I.aimLock ? 1 : 0, I.autoAim === false ? 0 : 1, r2(I.turn || 0), r2(I.climb || 0)]; const key = a.join(',') + '|' + r2(P.camYaw || 0) + '|' + r2(P.aimPitch || 0); if (!force && key === lastKey) return; lastKey = key; conn.fast({ t: 'in', i: a, cy: r2(P.camYaw || 0), ap: r2(P.aimPitch || 0) }); };
  const stepLocal = (dt) => {
    // うごきの なめらか化(20かい/びょう → 60fps)
    const k = 1 - Math.exp(-14 * dt);
    for (const mp of Object.values(objs)) for (const o of mp.values()) { if (o.tx == null) continue; o.x += (o.tx - o.x) * k; o.z += (o.tz - o.z) * k; if (o.tyaw != null && o.yaw != null) { let d = o.tyaw - o.yaw; while (d > Math.PI) d -= 6.283; while (d < -Math.PI) d += 6.283; o.yaw += d * k; } }
    for (const p of S.players || []) { if (p === P || p.tx == null) continue; p.x += (p.tx - p.x) * k; p.z += (p.tz - p.z) * k; let d = p.tyaw - p.yaw; while (d > Math.PI) d -= 6.283; while (d < -Math.PI) d += 6.283; p.yaw += d * k; }
    // じぶんの カメラの むきは そのばで かえる(ホストの へんじを またない)
    if (P.dead <= 0 && P.mode === 'foot') { if (I.aimX) { P.camYaw += I.aimX * 1.45 * dt; P.camFree = true; } P.aimPitch = Math.max(-0.35, Math.min(1.1, (P.aimPitch || 0) + I.aimY * 0.9 * dt)); if (!P.camFree) P.camYaw = P.yaw; }
    // じぶんの いどうは すこし よそくして なめらかに
    if (P.tx != null) { const kk = 1 - Math.exp(-10 * dt); P.x += (P.tx - P.x) * kk; P.z += (P.tz - P.z) * kk; }
    if (S.msgT > 0) S.msgT -= dt; if (S.bannerT > 0) S.bannerT -= dt;
    sendT += dt; if (sendT >= 0.033) { sendT = 0; sendInput(false); }
  };
  sim.step = stepLocal;
  sim.interact = () => { conn.send({ t: 'ev', e: 'interact' }); return true; };
  sim.jump = () => { conn.send({ t: 'ev', e: 'jump' }); return true; };
  sim.reload = () => { conn.send({ t: 'ev', e: 'reload' }); return true; };
  sim.cycleWeapon = () => { conn.send({ t: 'ev', e: 'cycle' }); return true; };
  const origWear = sim.wear; sim.wear = (id) => { conn.send({ t: 'ev', e: 'wear', id }); return origWear ? origWear(id) : true; };
  sim.equip = (id) => { conn.send({ t: 'ev', e: 'equip', id }); return { ok: true }; };
  void store; void smooth;
  return { me: () => me, lost: () => !conn.isOpen(), silent: () => got && Date.now() - lastRx > 2500, got: () => got, close: () => { try { conn.close(); } catch { /* ok */ } } };
}
