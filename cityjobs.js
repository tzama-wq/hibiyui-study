// しょくぎょう(じたくで えらぶ): けいさつかん・SWAT・しょうぼうし・きゅうきゅうきゅうめいし。データと テキストだけ(シミュレーションは citysim.js)
export const JOBS = {
  none: { id: 'none', name: 'しょくぎょうなし', icon: '🙂', vehicle: null, desc: 'じゆうに あそぶ', color: '#3a3a3e' },
  police: { id: 'police', name: 'けいさつかん', icon: '👮', vehicle: 'police', desc: 'ひったくりを おいかけて たいほ・スピードいはんの くるまを とりしまる', tint: { Shirt: '#1d3f9a', Pants: '#142447' }, hat: { color: '#12275e', kind: 'cap' } },
  swat: { id: 'swat', name: 'SWAT たいいん', icon: '🪖', vehicle: 'swatvan', desc: 'じゅうかきを つかって ギャングや 指名手配はんを たいほ(ぶきを かしてもらえる)', tint: { Shirt: '#1a1c22', Pants: '#22252c' }, hat: { color: '#14161b', kind: 'helmet' } },
  fire: { id: 'fire', name: 'しょうぼうし', icon: '🧑‍🚒', vehicle: 'firetruck', desc: 'しょうぼうしゃで みずを かけて かじを けす', tint: { Shirt: '#e0641e', Pants: '#c45018' }, hat: { color: '#d8321e', kind: 'helmet' } },
  ems: { id: 'ems', name: 'きゅうきゅうきゅうめいし', icon: '🧑‍⚕️', vehicle: 'ambulance', desc: 'きゅうきゅうしゃで かんじゃの ところへ・おうきゅう てあてを して びょういんへ はこぶ', tint: { Shirt: '#f0f6f4', Pants: '#2a8a6a' }, hat: { color: '#f4f4f4', kind: 'cap' } },
};
// 自衛隊(りく・うみ・そら)。きちの ちょうかんに はなしかけると 「地球防衛隊」の ぼうえい にんむへ シームレスに いどう
Object.assign(JOBS, {
  jgsdf: { id: 'jgsdf', name: 'りくじょう じえいたい', icon: '🪖', vehicle: 'tank', branch: 'tank', desc: 'せんしゃに のって りくから まもる。きちの ちょうかんと はなすと ぼうえい にんむへ', tint: { Shirt: '#51603a', Pants: '#3b4a2b' }, hat: { color: '#3f5a2a', kind: 'helmet' } },
  jmsdf: { id: 'jmsdf', name: 'かいじょう じえいたい', icon: '⚓', vehicle: 'ship', branch: 'ship', desc: 'ぐんかんで うみから まもる。きちの ちょうかんと はなすと ぼうえい にんむへ', tint: { Shirt: '#f4f6f8', Pants: '#1c2a4a' }, hat: { color: '#f4f6f8', kind: 'cap' } },
  jasdf: { id: 'jasdf', name: 'こうくう じえいたい', icon: '✈️', vehicle: 'plane', branch: 'plane', desc: 'せんとうきで そらから まもる。きちの ちょうかんと はなすと ぼうえい にんむへ', tint: { Shirt: '#2a4a8a', Pants: '#1f3566' }, hat: { color: '#1f3566', kind: 'helmet' } },
});
export const JSDF = ['jgsdf', 'jmsdf', 'jasdf'];
export const JOB_LIST = ['police', 'swat', 'fire', 'ems', ...JSDF];
// ぼうえい にんむ: レベルが あがるたびに むずかしく なりつづける(おわりが ない)。クリアするまで おわれない
export function defenseMission(level) {
  const L = Math.max(1, level | 0); const pool = ['drone', 'boat']; if (L >= 2) pool.push('etank'); if (L >= 3) pool.push('fighter'); if (L >= 4) pool.push('destroyer'); if (L >= 5) pool.push('bomber');
  const nw = Math.min(16, 4 + Math.floor(L / 2)); const gap = Math.max(7, 13 - Math.floor(L / 3)); const waves = [];
  for (let i = 0; i < nw; i++) waves.push({ t: 2 + i * gap, type: pool[(i + L) % pool.length], n: Math.min(14, 2 + Math.floor((L + i) / 3)) });
  const boss = L % 5 === 0; if (boss) waves.push({ t: 2 + nw * gap, type: 'boss', n: 1 + Math.floor(L / 15) });
  const reward = { bronze: 1 + Math.floor(L / 3), pts: 6 + L * 2 }; if (L >= 4) reward.silver = Math.floor(L / 4); if (L >= 8) reward.gold = Math.floor(L / 8); if (L >= 20) reward.platinum = Math.floor(L / 20);
  const briefs = ['ふめいの ドローンと ボートが せまって いる! まもりぬけ!', 'てきの かずが ふえて きた! ぜんぶ たおして きちを まもれ!', 'つよい てきが まざって いる! きを ぬくな!', 'ぼうえいせんの はじまりだ! クリアするまで もどれないぞ!'];
  return { id: `def${L}`, name: `ぼうえい にんむ Lv.${L}${boss ? ' (ボス)' : ''}`, icon: '🎖️', brief: briefs[L % briefs.length], baseHp: 280 + Math.min(420, L * 14), boss, waves, reward, first: {}, def: true, level: L, hpMul: 1 + 0.09 * (L - 1), dmgMul: 1 + 0.05 * (L - 1), bossMul: 1 + 0.12 * (L - 1) };
}
// SWAT に かしてもらえる ぶき(しょくぎょうを やめると かえす)
export const SWAT_LOAN = ['assault', 'smg', 'pump', 'grenadel', 'rpg'];
// きゅうきゅう: びょうじょうと おうきゅう てあて(せいかいは choices[0]。UIで ならびを シャッフル)
export const SYMPTOMS = [
  { id: 'bleed', icon: '🩸', say: 'ちが とまらない…!', choices: ['きずぐちを つよく おさえて ちを とめる', 'みずを たくさん のませる', 'ほうっておく'] },
  { id: 'cpr', icon: '💔', say: 'たおれて いきを していない!', choices: ['AEDを つかって しんぞうマッサージ', 'ねかせて ようすを みる', 'おおごえで ゆすり おこす'] },
  { id: 'choke', icon: '😮', say: 'のどに ものが つまった…!', choices: ['せなかを つよく たたく', 'みずを ごくごく のませる', 'あたまを ぎゅっと おさえる'] },
  { id: 'fracture', icon: '🦵', say: 'あしを おった みたい…', choices: ['うごかさず そえぎで こていする', 'ぎゅっと ひっぱって のばす', 'むりやり あるかせる'] },
  { id: 'heat', icon: '🥵', say: 'ねっちゅうしょうで ぐったり…', choices: ['すずしい ところで からだを ひやす', 'あつい おゆを のませる', 'はしって もらう'] },
  { id: 'burn', icon: '🔥', say: 'やけどを した!', choices: ['すぐに みずで ひやす', 'バターを ぬる', 'こおりを ちょくせつ あてる'] },
];
export const JOB_PAY = { snatch: 160, speed: 130, raid: 700, fire: 360, patient: 480 };
