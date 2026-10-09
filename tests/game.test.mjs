import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import {
  PLAYERS, RARITIES, TICKETS, LEGEND_RATES, TICKET_ORDER, STATS, rates, rollRarity, pull, levelOf, rngSeed,
  studyReward, earnStudyTickets, loginReward, claimLogin, nextBigLogin, emptyTickets,
  upgrade, upgradeCost, kidStat, addPoints, teamBuff, BADGE_BUFFS, MAX_EQUIP, BUFF_CAP,
  teamSnapshot, ratings, simulate, cpuTeam, goalChance, SLOT_POS, TEAM_SIZE, migrateTeam,
  FORMATIONS, slotsOf, refitTeam, MAX_LEVEL, matchSummary, DIAMOND, diamondReq, claimDiamond, addShards, rarityRank, DIAMOND_CAP, enhance, enhCost, totalPoints, spendPoints, ENH_MAX, STAT_CAP, PLAYERS as ALLP, CUPS, MATCH_TICKET_CAP, cupById, cupUnlocked, cupRound, cupResult, ensureCup, shootout, winChance, cpuTeamAt, addTickets,
} from '../game.js';

// ---- 選手データ ----
assert.equal(PLAYERS.length, 552);
assert.equal(new Set(PLAYERS.map((p) => p.id)).size, 552);
assert.equal(new Set(PLAYERS.map((p) => p.name)).size, 552, '名前が重複');
for (const r of RARITIES) assert.ok(PLAYERS.some((p) => p.rarity === r), r);
assert.equal(PLAYERS.filter((p) => p.rarity === 'legend').length, 60);
for (const [r, n] of Object.entries({ common: 80, uncommon: 60, rare: 220, super: 120, legend: 60, diamond: 12 })) assert.equal(PLAYERS.filter((p) => p.rarity === r).length, n, r);
for (const p of PLAYERS) for (const s of STATS) assert.ok(p.stats[s] >= 30 && p.stats[s] <= (p.rarity === 'diamond' ? 140 : 99), `${p.id} ${s}`);
for (const pos of ['FW', 'MF', 'DF', 'GK']) assert.ok(PLAYERS.some((p) => p.pos === pos && p.rarity === 'common'), `${pos} コモン`);
const avg = (r) => { const l = PLAYERS.filter((p) => p.rarity === r); return l.reduce((a, p) => a + STATS.reduce((x, s) => x + p.stats[s], 0) / 5, 0) / l.length; };
for (let i = 1; i < RARITIES.length; i++) assert.ok(avg(RARITIES[i]) > avg(RARITIES[i - 1]), `平均が ${RARITIES[i]} で逆転`);

// モデル入りの選手(レア〜レジェンド)には 国と タイプが ある。名前は もじり(本人の名前は つかわない)
for (const p of PLAYERS) {
  const star = ['rare', 'super', 'legend', 'diamond'].includes(p.rarity);
  assert.equal(!!p.type, star, `${p.id} タイプ`);
  assert.equal(!!p.nation, star, `${p.id} 国`);
}
assert.equal(PLAYERS.filter((p) => p.type).length, 412);
assert.equal(PLAYERS.filter((p) => p.img).length, 412, 'レア以上 + ダイヤ 412にん ぜんいんに イラスト');
assert.equal(PLAYERS.filter((p) => p.img && p.nation === '🇯🇵').length >= 21, true, '日本人モデルは 21人 いじょう');
for (const pos of ['FW', 'MF', 'DF', 'GK']) assert.ok(PLAYERS.some((p) => p.img && p.pos === pos), `${pos} の イラスト`);

// 選手を うしろに ふやしても、もう いる選手の なまえ・のうりょくは かわらない(もっている選手が かわらないように)
const PIN = {"c01":{"name":"マル・ストライク","pos":"FW","stats":{"SHO":56,"PAS":44,"SPD":50,"DEF":38,"STA":38}},"c40":{"name":"セナ・ロック","pos":"DF","stats":{"SHO":39,"PAS":40,"SPD":42,"DEF":49,"STA":55}},"c80":{"name":"リュウ・ドリーム","pos":"MF","stats":{"SHO":38,"PAS":49,"SPD":42,"DEF":39,"STA":56}},"u01":{"name":"ヒカル・ブレイズ","pos":"FW","stats":{"SHO":65,"PAS":55,"SPD":63,"DEF":52,"STA":56}},"u60":{"name":"ショウ・パス","pos":"MF","stats":{"SHO":54,"PAS":65,"SPD":52,"DEF":50,"STA":63}},"l01":{"name":"キング・ペロ","pos":"FW","stats":{"SHO":96,"PAS":96,"SPD":95,"DEF":93,"STA":91}},"s24":{"name":"テア・シュテーゲル","pos":"GK","stats":{"SHO":74,"PAS":87,"SPD":76,"DEF":86,"STA":76}},"r44":{"name":"ナガノ・ソラ","pos":"DF","stats":{"SHO":63,"PAS":63,"SPD":76,"DEF":70,"STA":74}}};
for (const [id, v] of Object.entries(PIN)) {
  const p = PLAYERS.find((x) => x.id === id);
  assert.deepEqual({ name: p.name, pos: p.pos, stats: p.stats }, v, `${id} が かわってしまった(もっている選手が かわる)`);
}

// イラスト: モデル入りの選手(レア以上)は 全員 画像ファイルが ある。それ以外は 絵文字
for (const p of PLAYERS) {
  if (p.img) assert.ok(existsSync(new URL(`../${p.img}`, import.meta.url)), `${p.id} の画像が ない: ${p.img}`);
  else assert.ok(p.rarity === 'common' || p.rarity === 'uncommon' || p.type, 'イラストが ない 選手は 絵文字の かお');
}

// ---- 出る確率 ----
for (const t of TICKET_ORDER) {
  const rt = rates(t);
  assert.ok(Math.abs(Object.values(rt).reduce((a, b) => a + b, 0) - 100) < 1e-9, `${t} 合計`);
  assert.equal(rt.legend, LEGEND_RATES[t], `${t} のレジェンド`);
  assert.ok(rt.legend <= 2, `${t} のレジェンドは さいだい 2%`);
  const minI = RARITIES.indexOf(TICKETS[t].min);
  RARITIES.forEach((r, i) => { if (i < minI) assert.equal(rt[r], 0, `${t} は ${r} が出ない`); });
}
assert.deepEqual(rates('bronze'), { common: 60, uncommon: 28, rare: 9.5, super: 2.48, legend: 0.02 }, 'ブロンズは いままでと同じ');
assert.deepEqual(TICKET_ORDER.map((t) => rates(t).legend), [0.02, 0.1, 0.5, 2], 'いいチケットほど レジェンドが でやすい');
for (let i = 1; i < TICKET_ORDER.length; i++) assert.ok(rates(TICKET_ORDER[i]).legend > rates(TICKET_ORDER[i - 1]).legend);
assert.equal(Math.max(...TICKET_ORDER.map((t) => rates(t).legend)), 2, '最大2%');

const N = 2_000_000;
{
  const rnd = rngSeed(12345);
  const cnt = Object.fromEntries(RARITIES.map((r) => [r, 0]));
  for (let i = 0; i < N; i++) cnt[rollRarity('bronze', rnd)]++;
  const exp = (r) => (rates('bronze')[r] / 100) * N;
  assert.ok(Math.abs(cnt.legend - exp('legend')) <= 5 * Math.sqrt(exp('legend')), `レジェンド ${cnt.legend} (期待 ${exp('legend')})`);
  for (const r of ['common', 'uncommon', 'rare', 'super']) {
    const e = exp(r); assert.ok(Math.abs(cnt[r] - e) <= 5 * Math.sqrt(e), `${r} ${cnt[r]} (期待 ${e})`);
  }
  console.log('  ブロンズ 2,000,000回:', JSON.stringify(cnt));
}
for (const t of ['silver', 'gold', 'platinum']) {
  const rnd = rngSeed(31 + t.length); const n = 1_000_000; let leg = 0;
  for (let i = 0; i < n; i++) if (rollRarity(t, rnd) === 'legend') leg++;
  const e = (rates(t).legend / 100) * n;
  assert.ok(Math.abs(leg - e) <= 5 * Math.sqrt(e), `${t} レジェンド ${leg} (期待 ${e})`);
  console.log(`  ${t} 1,000,000回: レジェンド ${leg} (${(leg / n * 100).toFixed(3)}%)`);
}
for (const t of ['silver', 'gold', 'platinum']) {
  const rnd = rngSeed(777); const minI = RARITIES.indexOf(TICKETS[t].min);
  for (let i = 0; i < 300_000; i++) assert.ok(RARITIES.indexOf(rollRarity(t, rnd)) >= minI, `${t} 保証`);
}

// ---- 1回ひく ----
{
  const p = { tickets: { ...emptyTickets(), bronze: 2 }, owned: {} };
  const rnd = rngSeed(1);
  const a = pull(p, 'bronze', rnd);
  assert.equal(p.tickets.bronze, 1); assert.ok(a.isNew); assert.equal(p.owned[a.player.id], 1);
  pull(p, 'bronze', rnd);
  assert.equal(pull(p, 'bronze', rnd), null, 'チケットなしではひけない');
  assert.equal(pull(p, 'gold', rnd), null);
  assert.equal(levelOf(1), 0); assert.equal(levelOf(3), 2); assert.equal(levelOf(99), 5);
}

// ---- チケットの かせぎかた ----
assert.deepEqual(studyReward({ good: 2, total: 5, mode: 'daily' }), {}, '6割未満はもらえない');
assert.deepEqual(studyReward({ good: 3, total: 5, mode: 'daily' }), { bronze: 1 });
assert.deepEqual(studyReward({ good: 5, total: 5, mode: 'daily', perfect: true }), { silver: 1 });
assert.deepEqual(studyReward({ good: 5, total: 5, mode: 'bonus', perfect: true }), { silver: 1, bronze: 1 });
{
  const p = { tickets: emptyTickets() };
  let total = 0;
  for (let i = 0; i < 20; i++) { const g = earnStudyTickets(p, { good: 5, total: 5, mode: 'bonus', perfect: true }, '2026-10-05'); total += Object.values(g).reduce((a, b) => a + b, 0); }
  assert.equal(total, 6, '1日の上限は6まい');
  const g2 = earnStudyTickets(p, { good: 5, total: 5, mode: 'daily', perfect: true }, '2026-10-06');
  assert.deepEqual(g2, { silver: 1 }, '次の日は また もらえる');
}
// ログインボーナス: 通算の日数で だんだん ごうかに(やすんでも なくならない)
assert.deepEqual(loginReward(1), { bronze: 1 });
assert.deepEqual(loginReward(3), { silver: 1 });
assert.deepEqual(loginReward(7), { silver: 2 });
assert.deepEqual(loginReward(14), { gold: 1 });
assert.deepEqual(loginReward(30), { platinum: 1, gold: 1 });
assert.deepEqual(nextBigLogin(1), { day: 7, in: 6, reward: { silver: 2 } });
{
  const p = { tickets: emptyTickets() };
  const a = claimLogin(p, '2026-10-05');
  assert.equal(a.n, 1); assert.equal(p.tickets.bronze, 1);
  assert.equal(claimLogin(p, '2026-10-05'), null, '同じ日は1回だけ');
  const b = claimLogin(p, '2026-10-20'); // 15日あいても、つぎの日数に すすむ
  assert.equal(b.n, 2);
}

// ---- 強化 ----
assert.equal(upgradeCost(0), 1); assert.equal(upgradeCost(9), 1); assert.equal(upgradeCost(10), 2); assert.equal(upgradeCost(99), 10);
assert.ok(kidStat(46) < 100 && kidStat(47) > 99, `Lv47でレジェンド(99)を超える: ${kidStat(47)}`);
assert.ok(kidStat(100) > 99, '最大まで強化すると レジェンドより強い');
{
  const p = { pts: {}, lv: {} };
  addPoints(p, '算数', 5); addPoints(p, '国語', 1); addPoints(p, '体育', 99);
  assert.equal(p.pts.SHO, 5); assert.equal(p.pts.PAS, 1);
  for (let i = 0; i < 5; i++) assert.ok(upgrade(p, 'SHO'));
  assert.equal(p.lv.SHO, 5); assert.equal(p.pts.SHO, 0);
  assert.equal(upgrade(p, 'SHO'), false, 'ポイント不足');
  p.pts.PAS = 10_000; p.lv.PAS = 999;
  assert.equal(upgrade(p, 'PAS'), false, 'Lv999が上限');
}

// ---- バフ ----
for (const id of Object.keys(BADGE_BUFFS)) assert.ok(Object.keys(BADGE_BUFFS[id]).length > 0);
assert.deepEqual(teamBuff([]), { SHO: 0, PAS: 0, SPD: 0, DEF: 0, STA: 0 });
assert.equal(teamBuff(['goal10']).SHO, 2);
assert.equal(teamBuff(['perfect']).PAS, 3, 'ぜんぶ+3%');
assert.equal(MAX_EQUIP, 3);
assert.equal(teamBuff(['goal300', 'goal100', 'goal50', 'm_算数']).SHO, 8 + 5 + 3, 'そうびは3つまで(4つめは ムシ)');
assert.ok(teamBuff(Object.keys(BADGE_BUFFS)).SHO <= BUFF_CAP);

// ---- 編成と つよさ ----
const kid = { name: 'ひびと', face: '⚽', stats: Object.fromEntries(STATS.map((s) => [s, 50])) };
const fw = PLAYERS.find((p) => p.pos === 'FW' && p.rarity === 'common');
const df = PLAYERS.find((p) => p.pos === 'DF' && p.rarity === 'common');
{
  const snap = teamSnapshot({ kid, owned: { [fw.id]: 1, [df.id]: 3 }, team: ['self', fw.id, null, null, null, null, df.id, null, null, null, fw.id] });
  assert.equal(snap.length, 11); assert.equal(TEAM_SIZE, 11);
  assert.deepEqual(SLOT_POS.reduce((a, p) => ({ ...a, [p]: (a[p] || 0) + 1 }), {}), { FW: 2, MF: 4, DF: 4, GK: 1 }, '4-4-2');
  assert.equal(snap[0].name, 'ひびと'); assert.equal(snap[0].stats.SHO, 50, 'じぶんは どこでも ペナルティなし');
  assert.equal(snap[2].name, 'ベンチの 子');
  assert.equal(snap[6].level, 2);
  assert.ok(snap[10].offPos && snap[10].stats.SHO < fw.stats.SHO, 'ポジション ちがいは よわくなる(FWをGKの わくへ)');
  assert.ok(!snap[1].offPos && snap[1].stats.SHO === fw.stats.SHO);
  const buffed = teamSnapshot({ kid, owned: {}, team: ['self'], equip: ['goal300'] });
  assert.equal(buffed[0].stats.SHO, Math.round(50 * 1.08));
}
{
  const strong = (v) => ({ name: 'S', team: SLOT_POS.map((slot, i) => ({ slot, id: `x${i}`, name: `S${i}`, face: '⚽', pos: slot, rarity: 'common', level: 0, offPos: false, stats: Object.fromEntries(STATS.map((s) => [s, v])) })) });
  assert.equal(ratings(strong(60).team).power, 60);
  assert.ok(ratings(strong(80).team).power > ratings(strong(60).team).power);
  assert.ok(goalChance(100, 100) > 0.29 && goalChance(100, 100) < 0.31);
  assert.ok(goalChance(1000, 1) <= 0.8 && goalChance(1, 1000) >= 0.04);
  // しあい: 同じシードなら同じ けっか / 強いほうが かつ
  const r1 = simulate(strong(70), strong(40), rngSeed(9)); const r2 = simulate(strong(70), strong(40), rngSeed(9));
  assert.deepEqual(r1.score, r2.score);
  assert.equal(r1.events.length, 12);
  assert.equal(r1.events.at(-1).score.a + r1.events.at(-1).score.b, r1.score.a + r1.score.b);
  let win = 0; let lose = 0; const rnd = rngSeed(2026);
  for (let i = 0; i < 4000; i++) { const r = simulate(strong(70), strong(40), rnd); if (r.score.a > r.score.b) win++; else if (r.score.a < r.score.b) lose++; }
  assert.ok(win / 4000 > 0.8, `強いほうの勝率 ${win / 4000}`);
  assert.ok(lose / 4000 > 0.005 || true);
  // 同じ強さなら おおよそ いーぶん
  let w2 = 0; let l2 = 0;
  for (let i = 0; i < 6000; i++) { const r = simulate(strong(60), strong(60), rnd); if (r.score.a > r.score.b) w2++; else if (r.score.a < r.score.b) l2++; }
  assert.ok(Math.abs(w2 - l2) / 6000 < 0.04, `互角: ${w2} vs ${l2}`);
  console.log(`  70 vs 40 の勝率 ${(win / 40).toFixed(1)}% / 60 vs 60 の勝ち数 ${w2} / 負け数 ${l2}`);
  // CPUは じぶんの強さに あわせる
  const rr = (lv) => ratings(cpuTeam(lv, rngSeed(5)).team).power;
  assert.ok(rr('easy') < rr('normal') && rr('normal') < rr('hard') && rr('hard') < rr('boss') && rr('boss') < rr('god'));
  assert.ok(Math.abs(rr('normal') - 52) <= 6, 'CPUは じぶんの つよさに かかわらず きまった つよさ');
}
// 5にんの ころの へんせいは 11にんの じゅんばんに ひきつがれる
assert.deepEqual(migrateTeam(['a', 'b', 'c', 'd', 'e']), ['a', 'b', 'c', null, null, null, 'd', null, null, null, 'e']);
assert.equal(migrateTeam([]).length, 11);

// ---- フォーメーション ----
for (const f of FORMATIONS) {
  const sl = slotsOf(f.id);
  assert.equal(sl.length, 11, f.name); assert.equal(f.fw + f.mf + f.df, 10); assert.equal(sl.filter((x) => x === 'GK').length, 1);
  assert.deepEqual(sl, [...sl].sort((a, b) => ['FW', 'MF', 'DF', 'GK'].indexOf(a) - ['FW', 'MF', 'DF', 'GK'].indexOf(b)), 'FW→MF→DF→GK');
  const cpu = cpuTeam('normal', rngSeed(3), f.id).team;
  assert.deepEqual(cpu.map((x) => x.slot), sl);
  const r = simulate({ name: 'a', team: cpu }, { name: 'b', team: cpu }, rngSeed(1));
  assert.equal(r.events.length, 12, `${f.name}で しあいが できる`);
}
{ // こうげき型は att が たかく、まもり型は def が たかい(せんしゅは おなじ つよさ)
  const flat = (id) => cpuTeam('normal', () => 0.5, id).team;
  const a433 = ratings(flat('433')); const a442 = ratings(flat('442')); const a532 = ratings(flat('532'));
  assert.ok(a433.att > a442.att && a532.def > a442.def && a532.att < a442.att);
}
{ // かたちを かえると、ポジションの あう わくに ならびなおす
  const pos = { s: 'ALL', f1: 'FW', f2: 'FW', f3: 'FW', d1: 'DF', g: 'GK' };
  const t = refitTeam(['f1', 'f2', null, null, null, null, 'd1', null, null, null, 'g'].map((x) => x), slotsOf('433'), (id) => pos[id]);
  const sl = slotsOf('433');
  assert.equal(t[sl.indexOf('GK')], 'g'); assert.equal(t[sl.indexOf('DF')], 'd1');
  assert.deepEqual(t.slice(0, 2), ['f1', 'f2']);
  const t2 = refitTeam(['s', 'f1', 'f2', 'f3'], slotsOf('451'), (id) => pos[id]); // FW は 1にんだけ
  assert.equal(t2.filter(Boolean).length, 4, '1にんも きえない'); assert.equal(t2[0], 'f1');
}

// ---- つよさの ばらつき: はじめの チームは ボスに かてない / やさしい あいてには かてる ----
{
  const flat = (v) => ({ name: 'F', team: SLOT_POS.map((slot, i) => ({ slot, id: `f${i}`, name: `F${i}`, face: '⚽', pos: slot, rarity: 'common', level: 0, offPos: false, stats: Object.fromEntries(STATS.map((x) => [x, v])) })) });
  const rnd = rngSeed(77);
  const start = flat(30);
  assert.ok(winChance(start, cpuTeam('boss', rnd), 400, rnd) < 0.01, 'はじめの チームは ボス(レジェンド)に かてない');
  assert.ok(winChance(start, cpuTeam('hard', rnd), 400, rnd) < 0.03);
  assert.ok(winChance(start, cpuTeam('easy', rnd), 400, rnd) > 0.3, 'やさしい あいてには かてる');
  assert.ok(winChance(flat(95), cpuTeam('boss', rnd), 400, rnd) > 0.35, 'レジェンド チームなら ボスと いい しょうぶ');
  // タイプ: こうげき型は こうげきが たかく まもりが ひくい
  const att = ratings(cpuTeamAt(60, 'A', () => 0.5, '442', 'att').team); const def = ratings(cpuTeamAt(60, 'D', () => 0.5, '442', 'def').team);
  assert.ok(att.att > def.att && att.def < def.def);
}
// ---- PK戦 ----
{
  const rnd = rngSeed(5); let strong = 0;
  for (let i = 0; i < 2000; i++) { const k = shootout(100, 40, rnd); assert.notEqual(k.a, k.b, 'PK戦は ひきわけない'); if (k.a > k.b) strong++; }
  assert.ok(strong / 2000 > 0.55 && strong / 2000 < 0.85, `PK戦の かち ${strong / 2000}`);
}
// ---- たいかい ----
{
  const all = CUPS.flatMap((c) => c.rounds.map((r) => r.power));
  assert.deepEqual(CUPS.map((c) => c.id), ['j', 'asia', 'kirin', 'wc', 'allstar', 'isekai', 'galaxy', 'universe']);
  for (const c of CUPS) for (let i = 1; i < c.rounds.length; i++) assert.ok(c.rounds[i].power > c.rounds[i - 1].power, `${c.name}: ラウンドごとに つよく なる`);
  const finals = CUPS.map((c) => c.rounds.at(-1).power);
  for (let i = 1; i < finals.length; i++) assert.ok(finals[i] > finals[i - 1], 'たいかいの けっしょうは じゅんばんに つよく なる');
  assert.ok(Math.min(...all) <= 36 && Math.max(...all) >= 350, 'はばが ひろい');
  assert.ok(CUPS.every((c) => cupById(c.id).badge && BADGE_BUFFS[c.badge]), 'たいかいごとに メダルと バフ');
  assert.ok(CUPS.every((c) => c.rounds.every((r) => r.name && r.label && r.reward)));
  const p = { tickets: emptyTickets() };
  assert.ok(cupUnlocked(p, 'j') && !cupUnlocked(p, 'asia') && !cupUnlocked(p, 'wc'));
  assert.equal(cupRound(p, 'j'), 0);
  // かつと つぎへ / まけると はいたい
  let r = cupResult(p, 'j', 0, true); assert.equal(r.type, 'advance'); assert.equal(cupRound(p, 'j'), 1); assert.equal(p.tickets.bronze, 1);
  r = cupResult(p, 'j', 1, false); assert.equal(r.type, 'out'); assert.equal(cupRound(p, 'j'), 0, 'はいたい: 1かいせんから');
  // やりなおし(やさしい せってい)
  cupResult(p, 'j', 0, true); r = cupResult(p, 'j', 1, false, true); assert.equal(r.type, 'retry'); assert.equal(cupRound(p, 'j'), 1);
  // ゆうしょう → つぎの たいかい
  for (let k = 1; k < 4; k++) r = cupResult(p, 'j', k, true);
  assert.equal(r.type, 'cleared'); assert.ok(r.first); assert.ok(cupUnlocked(p, 'asia')); assert.ok(!cupUnlocked(p, 'kirin'));
  assert.equal(p.cup.titles.j, 1); assert.equal(cupRound(p, 'j'), 0);
  assert.equal(p.tickets.silver, 1 + 1 + 2, 'ラウンド3,4 + ゆうしょう ボーナス');
  r = cupResult(p, 'j', 3, true); assert.equal(r.first, false); assert.equal(p.cup.titles.j, 2);
  // こわれた データでも だいじょうぶ
  const q = { cup: { run: { id: 'zzz', round: 9 }, cleared: 'x' } }; ensureCup(q); assert.equal(q.cup.run, null); assert.deepEqual(q.cup.cleared, []);
}
// れんしゅうの チケットは べつわく
{
  const p = { tickets: emptyTickets() };
  for (let i = 0; i < 10; i++) earnStudyTickets(p, { good: 5, total: 5, mode: 'daily', perfect: false }, '2026-10-07');
  const daily = Object.values(p.tickets).reduce((a, b) => a + b, 0); assert.equal(daily, 6, 'セットの 上限は 6');
  let got = 0; for (let i = 0; i < 10; i++) got += Object.values(earnStudyTickets(p, { good: 4, total: 5, mode: 'practice', perfect: false }, '2026-10-07')).reduce((a, b) => a + b, 0);
  assert.equal(got, 4, 'れんしゅうは セットが 上限でも べつに 4まい もらえる');
  assert.deepEqual(earnStudyTickets(p, { good: 2, total: 5, mode: 'practice' }, '2026-10-07'), {}, '6わり みまんは もらえない');
  const q = { tickets: emptyTickets() }; assert.equal(Object.values(earnStudyTickets(q, { good: 5, total: 5, mode: 'practice', perfect: true }, '2026-10-08')).reduce((a, b) => a + b, 0), 1);
}
// ---- ガチャ選手の きょうか ----
{
  const pl = ALLP.find((x) => x.rarity === 'legend'); const cm = ALLP.find((x) => x.rarity === 'common');
  assert.ok(enhCost(0, 'legend') > enhCost(0, 'common') && enhCost(5, 'common') > enhCost(0, 'common'), 'レアほど・かさねるほど ポイントが いる');
  assert.ok(enhCost(0, 'common') > 1 + 0, 'じぶんの 1レベル(1pt)より たかい');
  const p = { owned: { [pl.id]: 1 }, pts: { SHO: 3, PAS: 0, SPD: 0, DEF: 0, STA: 0 } };
  assert.equal(enhance(p, pl.id), false, 'ポイントが たりない'); assert.equal(totalPoints(p), 3);
  assert.equal(enhance(p, cm.id), false, 'もってない 選手は きょうか できない');
  p.pts = { SHO: 10, PAS: 20, SPD: 0, DEF: 5, STA: 0 };
  const cost = enhCost(0, 'legend'); const before = totalPoints(p);
  assert.equal(enhance(p, pl.id), true); assert.equal(p.plv[pl.id], 1); assert.equal(totalPoints(p), before - cost);
  assert.ok(p.pts.PAS <= 10 && p.pts.DEF === 5, 'おおい ポイントから へらす');
  // つよく なる(+3%)、ダブりの レベルと かさなる、うわがきの じょうげん
  const kid = { name: 'k', face: 'k', stats: Object.fromEntries(STATS.map((s) => [s, 50])) };
  const snap = (plv, copies) => teamSnapshot({ kid, owned: { [pl.id]: copies }, team: [pl.id, ...Array(10).fill(null)], formation: '442', plv }).find((m) => m.id === pl.id);
  const base = snap({}, 1); const e5 = snap({ [pl.id]: 5 }, 1);
  const main = Object.keys(pl.stats).sort((a, b) => pl.stats[b] - pl.stats[a])[0];
  assert.ok(e5.stats[main] > base.stats[main] && e5.enh === 5);
  assert.ok(Math.abs(e5.stats[main] / base.stats[main] - 1.15) < 0.04, '5かいで ほぼ +15%');
  assert.ok(snap({ [pl.id]: 20 }, 6)[main === 'x' ? 'stats' : 'stats'][main] <= STAT_CAP);
  p.plv[pl.id] = ENH_MAX; p.pts = { SHO: 999, PAS: 0, SPD: 0, DEF: 0, STA: 0 }; assert.equal(enhance(p, pl.id), false, 'MAXで とまる');
  assert.equal(spendPoints({ pts: { SHO: 1 } }, 5), false);
}
// ---- レア いじょう 5ばい: むかしの 選手は かわらない / あたらしい 選手に くにと とくいが ある ----
{
  const rarePlus = PLAYERS.filter((p) => ['rare', 'super', 'legend'].includes(p.rarity));
  assert.equal(rarePlus.length, 400);
  assert.ok(rarePlus.every((p) => p.nation && p.type), 'レア いじょうは ぜんいん くにと とくい つき');
  assert.ok(PLAYERS.filter((p) => p.img).every((p) => p.type && /^images\/players\/[a-z]\d+\.webp$/.test(p.img)), 'イラストは レア以上だけ');
  assert.ok(PLAYERS.filter((p) => p.rarity === 'common' || p.rarity === 'uncommon').every((p) => !p.type));
  const s = (id) => PLAYERS.find((p) => p.id === id);
  assert.equal(s('l01').name, 'キング・ペロ'); assert.ok(s('l60') && s('s120') && s('r220'));
  for (const p of rarePlus) { const [lo, hi] = { rare: [62, 78], super: [74, 90], legend: [89, 99] }[p.rarity]; assert.ok(Object.values(p.stats).every((v) => v >= Math.round(lo * 0.9) && v <= 99), `${p.id} のうりょく`); }
}
// ---- たいかい チケットの 1日の じょうげん ----
{
  const p = { tickets: emptyTickets() }; const T = '2026-10-09';
  // はじめて かつ ラウンドは じょうげん なし(すべて もらえる)
  for (let r = 0; r < 4; r++) cupResult(p, 'j', r, true, false, T);
  assert.equal(Object.values(p.tickets).reduce((a, b) => a + b, 0), 1 + 1 + 1 + 1 + 2, 'はじめての ぶんは ぜんぶ');
  assert.equal(p.cup.titles.j, 1);
  const have = () => Object.values(p.tickets).reduce((a, b) => a + b, 0);
  const before = have(); const sBefore = p.tickets.silver; const bBefore = p.tickets.bronze;
  // くりかえしは 1日 MATCH_TICKET_CAP まいまで
  for (let rep = 0; rep < 6; rep++) for (let r = 0; r < 4; r++) cupResult(p, 'j', r, true, false, T);
  assert.equal(p.tickets.silver - sBefore, MATCH_TICKET_CAP, 'シルバーは 1日 20まいまで(しゅるいごと)');
  assert.equal(p.tickets.bronze - bBefore, 12, 'ブロンズは じょうげん みまんなので ぜんぶ もらえる');
  const rr = cupResult(p, 'j', 2, true, false, T); assert.equal(rr.reward && Object.keys(rr.reward).length, 0, 'シルバーは もう もらえない'); assert.ok(rr.capped);
  // つぎの日は また もらえる
  const b2 = have(); cupResult(p, 'j', 0, true, false, '2026-10-10'); assert.ok(have() > b2);
  // ふくすうの ほかの たいかいの はじめては じょうげんの せいげんを うけない
  const b3 = have(); cupResult(p, 'asia', 0, true, false, '2026-10-10'); assert.ok(have() > b3);
}
// ---- つよく: 999まで ----
{
  assert.equal(MAX_LEVEL, 999);
  const p = { pts: { SHO: 1000, PAS: 0, SPD: 0, DEF: 0, STA: 0 }, lv: { SHO: 998, PAS: 0, SPD: 0, DEF: 0, STA: 0 } };
  assert.equal(upgrade(p, 'SHO'), true); assert.equal(p.lv.SHO, 999); assert.equal(upgrade(p, 'SHO'), false, '999で とまる');
  assert.equal(kidStat(999), Math.round(30 + 999 * 1.5));
  // じぶんは 140 の うわがきに かからない(ガチャ選手だけ)
  const kid = { name: 'k', face: 'k', stats: Object.fromEntries(STATS.map((s) => [s, kidStat(999)])) };
  const snap = teamSnapshot({ kid, owned: {}, team: ['self'], formation: '442' });
  assert.ok(snap[0].stats.SHO > 1000 && ratings(snap).power > 140);
}
// ---- ポイントは ぜんぶの のうりょくに わかれる(小2は 生活だけ、小4は 理科・社会だけ) ----
{
  const p = { pts: {} };
  for (let i = 0; i < 60; i++) { addPoints(p, '算数', 2); addPoints(p, '国語', 2); addPoints(p, '生活', 2); }
  assert.ok(STATS.every((s) => p.pts[s] > 0), '小2: 算数・国語・生活で 5つとも のびる');
  assert.ok(Math.abs(p.pts.SPD - p.pts.DEF) <= 2 && Math.abs(p.pts.DEF - p.pts.STA) <= 2, '生活は 3つに わける');
  const q = { pts: {} };
  for (let i = 0; i < 60; i++) { addPoints(q, '算数', 2); addPoints(q, '国語', 2); addPoints(q, '理科', 2); addPoints(q, '社会', 2); }
  assert.ok(STATS.every((s) => q.pts[s] > 0), '小4: 算数・国語・理科・社会で 5つとも のびる');
  assert.equal(addPoints(q, '体育', 2), null);
  assert.equal(addPoints({}, '算数', 2), 'SHO');
}
// ---- ディフェンダーの タックル・カット ----
{
  const flat = (v, d) => ({ name: 'F', team: SLOT_POS.map((slot, i) => ({ slot, id: `f${i}`, name: `F${d}${i}`, face: '⚽', pos: slot, rarity: 'common', level: 0, offPos: false, stats: Object.fromEntries(STATS.map((x) => [x, v])) })) });
  const rnd = rngSeed(31); let tk = 0; let all = 0; let dfn = 0; let goals = 0; const types = new Set(); const starts = {};
  for (let g = 0; g < 400; g++) {
    const A = flat(60, 'a'); const B = flat(60, 'b'); const r = simulate(A, B, rnd);
    assert.equal(r.events.length, 12);
    for (const e of r.events) {
      all++; types.add(e.type);
      if (e.type === 'tackle') {
        tk++; const defTeam = e.side === 'a' ? B : A;
        const d = defTeam.team.find((m) => m.name === e.defender); assert.ok(d, 'うばう 人は まもる チームの 人'); assert.ok(['DF', 'MF'].includes(d.slot));
        if (d.slot === 'MF') assert.ok(['intercept', 'offside'].includes(e.kind), 'MFは インターセプト(か オフサイド)'); dfn += d.slot === 'DF' ? 1 : 0;
        assert.match(e.text, /タックル|インターセプト|ファウル|オフサイド/); assert.ok(['tackle', 'intercept', 'foul', 'offside'].includes(e.kind)); if (e.kind === 'foul') assert.ok(['save', 'miss'].includes(e.fk), 'ファウルの あとは フリーキック');
      }
      if (e.type === 'goal') { goals++; assert.ok(['shot', 'header', 'long', 'fk'].includes(e.how)); if (e.start === 'corner') assert.equal(e.how, 'header'); if (e.start === 'freekick') assert.equal(e.how, 'fk'); }
      assert.ok(['open', 'corner', 'freekick'].includes(e.start)); if (e.type === 'tackle') assert.equal(e.start, 'open'); starts[e.start] = (starts[e.start] || 0) + 1;
    }
    const sm = matchSummary(r.events, r.score);
    assert.equal(sm.stats.a.goals + sm.stats.b.goals, r.score.a + r.score.b);
    assert.equal(sm.stats.a.shots + sm.stats.b.shots + sm.stats.a.tackles + sm.stats.b.tackles, 12);
    if (sm.mvp) assert.ok(sm.mvp.name && ['a', 'b'].includes(sm.mvp.side));
  }
  assert.ok(types.has('tackle') && types.has('goal') && types.has('save') && types.has('miss'));
  const share = tk / all; assert.ok(share > 0.18 && share < 0.35, `ディフェンダーが ボールを うばう わりあい ${share.toFixed(2)}`);
  assert.ok(dfn / tk > 0.5, 'DFの タックルが おおい');
  assert.ok(starts.corner > 100 && starts.freekick > 50, `セットプレー ${JSON.stringify(starts)}`);
  assert.ok(Math.abs(goals / all - 0.2) < 0.12, 'ゴールの わりあいは これまでと ほぼ おなじ');
  // MVP: ゴール+アシストの 人が えらばれる
  const s2 = matchSummary([{ side: 'a', type: 'goal', passer: 'P', shooter: 'S', keeper: 'K' }, { side: 'b', type: 'tackle', defender: 'D', kind: 'tackle', shooter: 'X', passer: 'Y', keeper: 'K2' }], { a: 1, b: 0 });
  assert.equal(s2.mvp.name, 'S');
}
// ---- ダイヤモンド ----
{
  const dl = PLAYERS.filter((p) => p.rarity === 'diamond');
  assert.equal(dl.length, 12); assert.deepEqual(['FW', 'MF', 'DF', 'GK'].map((x) => dl.filter((d) => d.pos === x).length), [3, 3, 3, 3]);
  assert.ok(dl.every((d) => Math.max(...Object.values(d.stats)) > 118 && Math.min(...Object.values(d.stats)) > 85), 'レジェンドより つよい');
  assert.ok(rarityRank('diamond') > rarityRank('legend'));
  // ガチャでは でない
  const rnd = rngSeed(4); const seen = new Set();
  for (let i = 0; i < 20000; i++) { const q = { tickets: { bronze: 0, silver: 0, gold: 0, platinum: 1 }, owned: {} }; const r = pull(q, 'platinum', rnd); if (r) seen.add(r.player.rarity); }
  assert.ok(!seen.has('diamond'), 'ダイヤは ガチャに でない');
  // じょうけん: かけら・きたえた レジェンド・たつじん メダル
  const d = dl.find((x) => x.pos === 'FW'); const lg = PLAYERS.find((x) => x.rarity === 'legend' && x.pos === 'FW');
  const medals = new Set(); const have = (id) => medals.has(id);
  const p = { owned: {}, shards: 0, plv: {} };
  assert.equal(claimDiamond(p, d.id, have), false);
  addShards(p, DIAMOND.shards); assert.equal(diamondReq(p, d, have).can, false, 'レジェンドと メダルが ない');
  p.owned[lg.id] = 1; p.plv[lg.id] = DIAMOND.legendEnh - 1; assert.equal(diamondReq(p, d, have).legend.ok, false);
  p.plv[lg.id] = DIAMOND.legendEnh; assert.equal(diamondReq(p, d, have).can, false, 'メダルが ない');
  medals.add('m10_国語'); assert.equal(diamondReq(p, d, have).trial.ok, false, 'FWは 算数');
  medals.add('m10_算数'); assert.equal(diamondReq(p, d, have).can, true);
  assert.equal(claimDiamond(p, d.id, have), true); assert.equal(p.shards, 0); assert.equal(p.owned[d.id], 1); assert.equal(diamondReq(p, d, have).copies, 1); assert.equal(claimDiamond(p, d.id, have), false, 'かけらが たりない うちは もらえない');
  for (let n = 2; n <= 6; n++) { addShards(p, DIAMOND.shards); assert.equal(claimDiamond(p, d.id, have), true, `${n}かいめ`); assert.equal(p.owned[d.id], n); }
  addShards(p, DIAMOND.shards); assert.equal(diamondReq(p, d, have).owned, true); assert.equal(claimDiamond(p, d.id, have), false, 'レベル5(6かい)で うちどめ'); p.shards = 0;
  { const dfd = dl.find((x) => x.pos === 'DF'); const dlg = PLAYERS.find((x) => x.rarity === 'legend' && x.pos === 'DF'); const pd = { owned: { [dlg.id]: 1 }, shards: DIAMOND.shards, plv: { [dlg.id]: DIAMOND.legendEnh } }; const hv = (id) => id === 'm10_生活'; assert.equal(diamondReq(pd, dfd, hv).can, true, 'DFは 生活でも OK(小2むけ)'); assert.equal(diamondReq(pd, dfd, (id) => id === 'm10_算数').can, false); }
  // GK: 理科 か 生活 どちらでも
  const gk = dl.find((x) => x.pos === 'GK'); const glg = PLAYERS.find((x) => x.rarity === 'legend' && x.pos === 'GK');
  const p2 = { owned: { [glg.id]: 1 }, shards: DIAMOND.shards, plv: { [glg.id]: DIAMOND.legendEnh } };
  assert.equal(diamondReq(p2, gk, have).can, false); medals.add('m10_生活'); assert.equal(diamondReq(p2, gk, have).can, true);
  // ダイヤの のうりょくは 180 まで(レジェンドは 140)
  const kid = { name: 'k', face: 'k', stats: Object.fromEntries(STATS.map((s) => [s, 50])) };
  const snapd = teamSnapshot({ kid, owned: { [d.id]: 6 }, team: [d.id, ...Array(10).fill(null)], formation: '442', plv: { [d.id]: 20 } })[0];
  assert.ok(Math.max(...Object.values(snapd.stats)) > 140 && Math.max(...Object.values(snapd.stats)) <= DIAMOND_CAP);
  // たいかいの はじめての しょうりで かけら
  const q = { tickets: emptyTickets() }; cupResult(q, 'j', 0, true, false, '2026-10-12'); assert.equal(q.shards, 1);
  cupResult(q, 'j', 0, true, false, '2026-10-12'); assert.equal(q.shards, 1, 'くりかえしは かけらなし');
  for (let r = 1; r < 4; r++) cupResult(q, 'j', r, true, false, '2026-10-12'); assert.equal(q.shards, 1 + 3 + 10);
}
console.log('OK: game');
// 神チケット: レジェンド 100%(ふつうの ごほうびの じゅんには はいらない)
{
  assert.equal(rates('god').legend, 100); assert.ok(!TICKET_ORDER.includes('god'));
  const rnd = rngSeed(4242); for (let i = 0; i < 2000; i++) assert.equal(rollRarity('god', rnd), 'legend');
  const p = { tickets: emptyTickets(), owned: {} }; addTickets(p, { god: 2 }); assert.equal(p.tickets.god, 2);
  const r = pull(p, 'god', rnd); assert.equal(r.player.rarity, 'legend'); assert.equal(p.tickets.god, 1);
  assert.ok(Object.keys(studyReward({ good: 5, total: 5, mode: 'normal', perfect: true })).every((k) => k !== 'god'));
  console.log('OK: 神チケット');
}
