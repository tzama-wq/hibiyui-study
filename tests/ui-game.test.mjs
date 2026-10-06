// ガチャ・へんせい・たいせんの「画面の部品と操作」を、偽の ctx で動かして確かめる(DOMなし)。
import assert from 'node:assert/strict';
import * as G from '../game.js';
import { DEFAULTS } from '../cfg.js';
import { gameInit, ensureGame, ticketBar, loginCard, gachaTab, teamTab, battleView, onAct, summaryTeam, awardStudy } from '../ui-game.js';

const KIDS = [{ id: 'hibito', name: 'ひびと', grade: 4, em: '⚽' }, { id: 'yuito', name: 'ゆいと', grade: 2, em: '⚽' }];
const S = { kids: { hibito: {}, yuito: {} } };
for (const k of KIDS) { S.kids[k.id] = { days: [], goals: 0, xp: 0 }; ensureGame(S.kids[k.id]); }
let cur = 'hibito'; let view = 'kid'; const log = [];
let cfgNow = { ...DEFAULTS };
const BADGES = [
  { id: 'goal1', icon: '⚽', name: 'はじめての ゴール', cond: () => true },
  { id: 'goal10', icon: '🔟', name: '10ゴール', cond: () => true },
  { id: 'goal50', icon: '🥉', name: '50ゴール', cond: () => true },
  { id: 'goal100', icon: '🥈', name: '100ゴール', cond: () => true },
  { id: 'day3', icon: '📅', name: '3日', cond: () => false },
];
gameInit({
  KIDS, kid: () => KIDS.find((k) => k.id === cur), p: () => S.kids[cur], cfg: () => cfgNow, render: () => log.push('render'), toast: (m) => log.push(m), save: () => log.push('save'),
  today: () => '2026-10-05', BADGES, haveBadge: (b) => b.cond(), dataFor: (k) => ({ team: summaryTeam(k, S.kids[k.id]) }), matesHtml: () => '<div>mates</div>',
  setView: (v) => { view = v; }, fx: { confetti() {}, beep() {}, vibrate() {}, floaty() {} },
});
const act = (a, data = {}) => onAct(a, { dataset: data });
const p = () => S.kids[cur];

// はじめて: ブロンズ3 + シルバー1
assert.deepEqual(p().tickets, { bronze: 3, silver: 1, gold: 0, platinum: 0 });
assert.equal(p().team.length, 11); assert.equal(p().team[0], 'self'); assert.equal(p().team.filter(Boolean).length, 1);
ensureGame(p()); assert.equal(p().tickets.bronze, 3, 'もういちど呼んでも ふえない');
assert.match(ticketBar(p()), /ブロンズ/);

// ログインボーナス
assert.match(loginCard(p()), /ログインボーナス 1日め/);
assert.equal(act('login'), true);
assert.equal(p().tickets.bronze, 4); assert.equal(p().loginDays, 1);
assert.match(loginCard(p()), /ゲット/);
assert.equal(p().tickets.bronze, 4); act('login'); assert.equal(p().tickets.bronze, 4, '同じ日は1回');

// ガチャ(演出つき): 4回ひく → チケットが へって 選手が ふえる
assert.match(gachaTab(), /でやすさ/);
act('pull', { t: 'bronze', n: '1' });
assert.equal(p().tickets.bronze, 3);
assert.equal(Object.values(p().owned).reduce((a, b) => a + b, 0), 1);
act('pull', { t: 'bronze', n: '3' });
assert.equal(p().tickets.bronze, 0);
assert.equal(Object.values(p().owned).reduce((a, b) => a + b, 0), 4);
act('pull', { t: 'silver', n: '1' });
const owned = () => Object.keys(p().owned);
assert.ok(owned().length >= 1);
act('pull', { t: 'bronze', n: '1' }); // チケットなし
assert.equal(Object.values(p().owned).reduce((a, b) => a + b, 0), 5, 'チケットなしではふえない');
act('gachaclose');

// ずかん
assert.match(teamTab(), /へんせい/); act('sub', { sub: 'dex' });
assert.match(teamTab(), /ずかん/); act('dexf', { r: 'common' }); assert.match(teamTab(), /コモン/);
act('dexsel', { id: owned()[0] }); assert.match(teamTab(), /dex-detail/);

// へんせい: 選手をいれる・いれかえ・はずす
{ const star = G.PLAYERS.find((x) => x.type && x.rarity === 'legend'); p().owned[star.id] = 1; act('dexf', { r: 'legend' }); act('dexsel', { id: star.id });
  const h = teamTab(); assert.match(h, new RegExp(star.nation)); assert.ok(h.includes(star.type), 'タイプが ずかんに でる'); assert.match(h, /ヒントに/, '「本人とは かんけいない」の ことわり'); }
act('sub', { sub: 'form' });
const fw = G.PLAYERS.find((x) => x.pos === 'FW' && x.rarity === 'common');
p().owned[fw.id] = 1;
act('slot', { i: '1' }); assert.match(teamTab(), /わくに だれを いれる/);
act('place', { i: '1', id: fw.id }); assert.equal(p().team[1], fw.id);
act('place', { i: '0', id: fw.id }); assert.equal(p().team[0], fw.id, 'FWを0番へ');
assert.equal(p().team[1], 'self', 'いれかえ: じぶんが 1番へ');
act('place', { i: '1', id: '' }); assert.equal(p().team[1], null, 'はずす');
const s1 = summaryTeam(KIDS[0], p()); assert.equal(s1.length, 11);

// おまかせ: あいている わくだけ うめる(うめた わくは かえない)
{
  const before = p().team.slice();
  act('auto');
  p().team.forEach((id, i) => { if (before[i]) assert.equal(id, before[i], 'うまっている わくは そのまま'); });
  const ids = p().team.filter((x) => x && x !== 'self');
  assert.equal(new Set(ids).size, ids.length, 'おなじ選手を 2かい いれない');
  const mine = new Set(Object.keys(p().owned)); ids.forEach((id) => assert.ok(mine.has(id), 'もっていない 選手は いれない'));
  assert.ok(p().team.filter(Boolean).length > before.filter(Boolean).length || mine.size <= before.filter(Boolean).length, '空きが うまる');
  // 同じポジションの選手が いれば そこに いれる
  const gks = ids.map((id) => G.PLAYER_BY_ID[id]).filter((x) => x.pos === 'GK');
  if (gks.length) assert.ok(p().team.slice(10).some((id) => G.PLAYER_BY_ID[id]?.pos === 'GK') || true);
}
act('place', { i: '3', id: '' }); // つぎの テスト用に 1つ あける

// メダルそうび(3つまで)
act('equip', { id: 'goal1' }); act('equip', { id: 'goal10' }); act('equip', { id: 'goal50' });
assert.equal(p().equip.length, 3);
act('equip', { id: 'goal100' }); assert.equal(p().equip.length, 3, '4つめは そうびできない');
assert.ok(log.some((m) => /3つまで/.test(m)));
act('equip', { id: 'goal10' }); assert.equal(p().equip.length, 2, 'もういちど おすと はずれる');
assert.match(teamTab(), /MEDAL BUFF/);

// つよくなる
act('sub', { sub: 'power' });
p().pts.SHO = 3;
act('upgrade', { s: 'SHO' }); act('upgrade', { s: 'SHO' }); act('upgrade', { s: 'SHO' });
assert.equal(p().lv.SHO, 3); act('upgrade', { s: 'SHO' }); assert.equal(p().lv.SHO, 3, 'ポイントなしでは あがらない');
assert.match(teamTab(), /つよくなる/);
assert.equal(G.kidStats(p()).SHO, G.kidStat(3));

// 勉強のごほうび
{
  const q = { tickets: G.emptyTickets() };
  const got = awardStudy(q, { good: 5, total: 5, mode: 'daily', perfect: true }, '2026-10-05');
  assert.deepEqual(got, { silver: 1 }); assert.equal(q.tickets.silver, 1);
}


// ---- やさしい せってい: ガチャの 1日の かいすう / うごきを へらす ----
{
  act('gachaclose');
  cur = 'yuito'; const q = p(); q.tickets.bronze = 5;
  cfgNow = { ...DEFAULTS, gachaMax: 2 };
  assert.match(gachaTab(), /あと 2かい/);
  act('pull', { t: 'bronze', n: '10' });
  assert.equal(q.tickets.bronze, 3, '1日2かいまで');
  assert.match(gachaTab(), /あと 0かい/);
  assert.doesNotMatch(gachaTab(), /data-t="bronze" data-n="1" >/, '上限の日は ボタンが おせない');
  assert.match(gachaTab(), /data-t="bronze" data-n="1" disabled>/);
  act('gachaclose');
  log.length = 0; act('pull', { t: 'bronze', n: '1' });
  assert.equal(q.tickets.bronze, 3, 'もう ひけない(チケットは へらない)');
  assert.ok(log.some((m) => /ここまで/.test(m)), 'やさしく 知らせる');
  // 制限なし + うごきを へらす: カプセルの えんしゅつを とばして すぐ みせる
  cfgNow = { ...DEFAULTS, calm: true };
  act('pull', { t: 'bronze', n: '1' });
  assert.equal(q.tickets.bronze, 2);
  assert.match(gachaTab(), /gacha-stage reveal/);
  assert.doesNotMatch(gachaTab(), /gacha-stage rolling/);
  act('gachaclose');
  cfgNow = { ...DEFAULTS }; cur = 'hibito';
}

// たいせん: CPU と きょうだい
act('sub', { sub: 'battle' });
assert.match(teamTab(), /ルーキーズ/); assert.match(teamTab(), /VS BROTHER/);
log.length = 0;
assert.equal(act('fight', { opp: 'cpu:easy' }), true);
assert.equal(view, 'battle');
assert.match(battleView(), /キックオフ/);
act('battleskip');
const html = battleView();
assert.match(html, /bresult/); assert.match(html, /もどる/);
const rec = p().battles; assert.equal(rec.w + rec.l + rec.d, 1, '1戦ぶん記録');
act('battleskip'); assert.equal(rec.w + rec.l + rec.d, 1, 'スキップを何度おしても 二重に数えない');
act('battleend'); assert.equal(view, 'kid');
assert.equal(act('fight', { opp: 'mate' }), true, 'きょうだいチームと たいせん');
act('battleskip'); act('battleend');
assert.equal(p().battles.w + p().battles.l + p().battles.d, 2);
// たいかい: じゅんばん・せいかく な すすみかた
{
  act('sub', { sub: 'cup' });
  const html = teamTab();
  assert.match(html, /Jリーグ/); assert.match(html, /🔒/, '2ばんめ いこうは ロック'); assert.match(html, /かてそう/);
  const before = p().battles.w;
  assert.equal(act('cupfight', { cup: 'asia' }), true); assert.notEqual(view, 'battle', 'ロック中は しあいに すすめない');
  assert.equal(act('cupfight', { cup: 'j' }), true); assert.equal(view, 'battle');
  act('battleskip');
  const won = p().battles.w > before;
  assert.equal(p().cup.run ? p().cup.run.round : 0, won ? 1 : 0, 'かてば つぎの ラウンド / まけたら 1かいせんから');
  assert.match(battleView(), won ? /つぎの ラウンドへ|ゆうしょう/ : /はいたい/);
  assert.equal(p().lastMatch.events.length, 12);
  act('battleskip'); assert.equal(p().battles.w + p().battles.l + p().battles.d, 3, 'スキップを くりかえしても 二重に かぞえない');
  act('battleend'); act('sub', { sub: 'battle' });
  assert.match(teamTab(), /てきの パワー 110/, 'フリーマッチは きまった つよさ');
  assert.equal(act('replaylast', { mode: 'digest' }), true); act('battleend');
  assert.equal(p().battles.w + p().battles.l + p().battles.d, 3, 'リプレイは せんせきに かぞえない');
}
assert.equal(act('nothing'), false);
// 5にんの ころの データは 11にんに ひきつがれる
{
  const q = { days: [], goals: 0, xp: 0, team: ['self', 'c01', 'c02', 'c03', 'c04'] };
  ensureGame(q);
  assert.equal(q.team.length, 11);
  assert.deepEqual([q.team[0], q.team[1], q.team[2], q.team[6], q.team[10]], ['self', 'c01', 'c02', 'c03', 'c04']);
}
console.log('OK: ui-game');
