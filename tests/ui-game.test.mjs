// ガチャ・へんせい・たいせんの「画面の部品と操作」を、偽の ctx で動かして確かめる(DOMなし)。
import assert from 'node:assert/strict';
import * as G from '../game.js';
import { gameInit, ensureGame, ticketBar, loginCard, gachaTab, teamTab, battleView, onAct, summaryTeam, awardStudy } from '../ui-game.js';

const KIDS = [{ id: 'hibito', name: 'ひびと', grade: 4, em: '⚽' }, { id: 'yuito', name: 'ゆいと', grade: 2, em: '⚽' }];
const S = { kids: { hibito: {}, yuito: {} } };
for (const k of KIDS) { S.kids[k.id] = { days: [], goals: 0, xp: 0 }; ensureGame(S.kids[k.id]); }
let cur = 'hibito'; let view = 'kid'; const log = [];
const BADGES = [
  { id: 'goal1', icon: '⚽', name: 'はじめての ゴール', cond: () => true },
  { id: 'goal10', icon: '🔟', name: '10ゴール', cond: () => true },
  { id: 'goal50', icon: '🥉', name: '50ゴール', cond: () => true },
  { id: 'goal100', icon: '🥈', name: '100ゴール', cond: () => true },
  { id: 'day3', icon: '📅', name: '3日', cond: () => false },
];
gameInit({
  KIDS, kid: () => KIDS.find((k) => k.id === cur), p: () => S.kids[cur], render: () => log.push('render'), toast: (m) => log.push(m), save: () => log.push('save'),
  today: () => '2026-10-05', BADGES, haveBadge: (b) => b.cond(), dataFor: (k) => ({ team: summaryTeam(k, S.kids[k.id]) }), matesHtml: () => '<div>mates</div>',
  setView: (v) => { view = v; }, fx: { confetti() {}, beep() {}, vibrate() {}, floaty() {} },
});
const act = (a, data = {}) => onAct(a, { dataset: data });
const p = () => S.kids[cur];

// はじめて: ブロンズ3 + シルバー1
assert.deepEqual(p().tickets, { bronze: 3, silver: 1, gold: 0, platinum: 0 });
assert.deepEqual(p().team, ['self', null, null, null, null]);
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
act('sub', { sub: 'form' });
const fw = G.PLAYERS.find((x) => x.pos === 'FW' && x.rarity === 'common');
p().owned[fw.id] = 1;
act('slot', { i: '1' }); assert.match(teamTab(), /わくに だれを いれる/);
act('place', { i: '1', id: fw.id }); assert.equal(p().team[1], fw.id);
act('place', { i: '0', id: fw.id }); assert.equal(p().team[0], fw.id, 'FWを0番へ');
assert.equal(p().team[1], 'self', 'いれかえ: じぶんが 1番へ');
act('place', { i: '1', id: '' }); assert.equal(p().team[1], null, 'はずす');
const s1 = summaryTeam(KIDS[0], p()); assert.equal(s1.length, 5);

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
assert.equal(act('nothing'), false);
console.log('OK: ui-game');
