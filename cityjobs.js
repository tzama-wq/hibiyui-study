// しょくぎょう(じたくで えらぶ): けいさつかん・SWAT・しょうぼうし・きゅうきゅうきゅうめいし。データと テキストだけ(シミュレーションは citysim.js)
export const JOBS = {
  none: { id: 'none', name: 'しょくぎょうなし', icon: '🙂', vehicle: null, desc: 'じゆうに あそぶ', color: '#3a3a3e' },
  police: { id: 'police', name: 'けいさつかん', icon: '👮', vehicle: 'police', desc: 'ひったくりを おいかけて たいほ・スピードいはんの くるまを とりしまる', tint: { Shirt: '#1d3f9a', Pants: '#142447' }, hat: { color: '#12275e', kind: 'cap' } },
  swat: { id: 'swat', name: 'SWAT たいいん', icon: '🪖', vehicle: 'swatvan', desc: 'じゅうかきを つかって ギャングや 指名手配はんを たいほ(ぶきを かしてもらえる)', tint: { Shirt: '#1a1c22', Pants: '#22252c' }, hat: { color: '#14161b', kind: 'helmet' } },
  fire: { id: 'fire', name: 'しょうぼうし', icon: '🧑‍🚒', vehicle: 'firetruck', desc: 'しょうぼうしゃで みずを かけて かじを けす', tint: { Shirt: '#e0641e', Pants: '#c45018' }, hat: { color: '#d8321e', kind: 'helmet' } },
  ems: { id: 'ems', name: 'きゅうきゅうきゅうめいし', icon: '🧑‍⚕️', vehicle: 'ambulance', desc: 'きゅうきゅうしゃで かんじゃの ところへ・おうきゅう てあてを して びょういんへ はこぶ', tint: { Shirt: '#f0f6f4', Pants: '#2a8a6a' }, hat: { color: '#f4f4f4', kind: 'cap' } },
};
export const JOB_LIST = ['police', 'swat', 'fire', 'ems'];
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
