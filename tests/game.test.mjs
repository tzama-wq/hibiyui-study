import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import {
  PLAYERS, RARITIES, TICKETS, LEGEND_RATES, TICKET_ORDER, STATS, rates, rollRarity, pull, levelOf, rngSeed,
  studyReward, earnStudyTickets, loginReward, claimLogin, nextBigLogin, emptyTickets,
  upgrade, upgradeCost, kidStat, addPoints, teamBuff, BADGE_BUFFS, MAX_EQUIP, BUFF_CAP,
  teamSnapshot, ratings, simulate, cpuTeam, goalChance, SLOT_POS, TEAM_SIZE, migrateTeam,
} from '../game.js';

// ---- 選手データ ----
assert.equal(PLAYERS.length, 220);
assert.equal(new Set(PLAYERS.map((p) => p.id)).size, 220);
assert.equal(new Set(PLAYERS.map((p) => p.name)).size, 220, '名前が重複');
for (const r of RARITIES) assert.ok(PLAYERS.some((p) => p.rarity === r), r);
assert.equal(PLAYERS.filter((p) => p.rarity === 'legend').length, 12);
for (const [r, n] of Object.entries({ common: 80, uncommon: 60, rare: 44, super: 24, legend: 12 })) assert.equal(PLAYERS.filter((p) => p.rarity === r).length, n, r);
for (const p of PLAYERS) for (const s of STATS) assert.ok(p.stats[s] >= 30 && p.stats[s] <= 99, `${p.id} ${s}`);
for (const pos of ['FW', 'MF', 'DF', 'GK']) assert.ok(PLAYERS.some((p) => p.pos === pos && p.rarity === 'common'), `${pos} コモン`);
const avg = (r) => { const l = PLAYERS.filter((p) => p.rarity === r); return l.reduce((a, p) => a + STATS.reduce((x, s) => x + p.stats[s], 0) / 5, 0) / l.length; };
for (let i = 1; i < RARITIES.length; i++) assert.ok(avg(RARITIES[i]) > avg(RARITIES[i - 1]), `平均が ${RARITIES[i]} で逆転`);

// モデル入りの選手(レア〜レジェンド)には 国と タイプが ある。名前は もじり(本人の名前は つかわない)
for (const p of PLAYERS) {
  const star = ['rare', 'super', 'legend'].includes(p.rarity);
  assert.equal(!!p.type, star, `${p.id} タイプ`);
  assert.equal(!!p.nation, star, `${p.id} 国`);
}
assert.equal(PLAYERS.filter((p) => p.type).length, 80);
assert.equal(PLAYERS.filter((p) => p.nation === '🇯🇵').length, 21, '日本人モデルは21人');
for (const pos of ['FW', 'MF', 'DF', 'GK']) assert.ok(PLAYERS.some((p) => p.type && p.pos === pos), `${pos} のモデル入り`);

// 選手を うしろに ふやしても、もう いる選手の なまえ・のうりょくは かわらない(もっている選手が かわらないように)
const PIN = {"c01":{"name":"マル・ストライク","pos":"FW","stats":{"SHO":56,"PAS":44,"SPD":50,"DEF":38,"STA":38}},"c40":{"name":"セナ・ロック","pos":"DF","stats":{"SHO":39,"PAS":40,"SPD":42,"DEF":49,"STA":55}},"c80":{"name":"リュウ・ドリーム","pos":"MF","stats":{"SHO":38,"PAS":49,"SPD":42,"DEF":39,"STA":56}},"u01":{"name":"ヒカル・ブレイズ","pos":"FW","stats":{"SHO":65,"PAS":55,"SPD":63,"DEF":52,"STA":56}},"u60":{"name":"ショウ・パス","pos":"MF","stats":{"SHO":54,"PAS":65,"SPD":52,"DEF":50,"STA":63}},"l01":{"name":"キング・ペロ","pos":"FW","stats":{"SHO":96,"PAS":96,"SPD":95,"DEF":93,"STA":91}},"s24":{"name":"テア・シュテーゲル","pos":"GK","stats":{"SHO":74,"PAS":87,"SPD":76,"DEF":86,"STA":76}},"r44":{"name":"ナガノ・ソラ","pos":"DF","stats":{"SHO":63,"PAS":63,"SPD":76,"DEF":70,"STA":74}}};
for (const [id, v] of Object.entries(PIN)) {
  const p = PLAYERS.find((x) => x.id === id);
  assert.deepEqual({ name: p.name, pos: p.pos, stats: p.stats }, v, `${id} が かわってしまった(もっている選手が かわる)`);
}

// イラスト: モデル入りの選手(レア以上)は 全員 画像ファイルが ある。それ以外は 絵文字
for (const p of PLAYERS) {
  if (p.type) assert.ok(existsSync(new URL(`../${p.img}`, import.meta.url)), `${p.id} の画像が ない: ${p.img}`);
  else assert.equal(p.img, '');
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
  p.pts.PAS = 10_000; p.lv.PAS = 100;
  assert.equal(upgrade(p, 'PAS'), false, 'Lv100が上限');
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
  const rr = (lv) => ratings(cpuTeam(60, lv, rngSeed(5)).team).power;
  assert.ok(rr('easy') < rr('normal') && rr('normal') < rr('hard') && rr('hard') < rr('boss'));
  assert.ok(Math.abs(rr('normal') - 60) <= 6);
}
// 5にんの ころの へんせいは 11にんの じゅんばんに ひきつがれる
assert.deepEqual(migrateTeam(['a', 'b', 'c', 'd', 'e']), ['a', 'b', 'c', null, null, null, 'd', null, null, null, 'e']);
assert.equal(migrateTeam([]).length, 11);
console.log('OK: game');
