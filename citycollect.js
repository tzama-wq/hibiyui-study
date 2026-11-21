// やりこみ(あつめる・たすける・スピードラン)。データだけ(ばしょは citysim.js が まちの どうろから きまった じゅんで つくる)
export const COLL = [
  { id: 'gold', name: '金の ブロック', icon: '🧱', n: 24, pay: 150, col: '#ffd23f', auto: true, done: '金の ブロックを ゲット!', bonus: 3000, clear: '金の ブロックを ぜんぶ あつめた! キラキラ だね!', how: 'まちに かくれて いる。ちかづくと じどうで ひろえる(ちずに ヒントが でるよ)' },
  { id: 'cat', name: 'ネコを たすけろ', icon: '🐱', n: 10, pay: 120, col: '#ffb35a', verb: '🐱 ネコを たすける', done: 'ネコを たすけた!', bonus: 2500, clear: 'まちの ネコが ぜんいん だいじょうぶ! ありがとう ニャ!', how: 'こまっている ネコに ちかづいて ボタン' },
  { id: 'flower', name: 'お花に みずやり', icon: '🌷', n: 12, pay: 90, col: '#ff7fb0', verb: '🌷 みずを あげる', done: 'お花が げんきに なった!', bonus: 2200, clear: 'まちじゅうに お花が さいたよ!', how: 'かれそうな お花に ちかづいて ボタン' },
  { id: 'bbq', name: 'バーベキューの ひを けす', icon: '🍖', n: 8, pay: 110, col: '#ff7a3a', verb: '🍖 ひを けす', done: 'バーベキューの ひを けした!', bonus: 2400, clear: 'ひの ようじん! しょうぼうしの かがみ だ!', how: 'もえっぱなしの ひに ちかづいて ボタン' },
  { id: 'run', name: 'スピードラン', icon: '⏱️', n: 5, pay: 400, col: '#4ac8ff', verb: '⏱️ スピードラン', done: 'ゴール!', bonus: 4000, clear: 'まちの はやさ チャンピオン!', how: 'スタートの ばしょで ボタン→じかんないに ゴールへ(のりものOK)' },
];
COLL.push({ id: 'roof', name: 'おくじょうの ひみつ', icon: '🌟', n: 8, pay: 260, col: '#9a6bff', auto: true, done: 'おくじょうの ひみつを ゲット!', bonus: 3500, clear: 'まちの てっぺんを せいふくした!', how: 'たかい たてものの かべに ちかづいて エレベーター→おくじょうを さがそう' });
export const collPay = (c) => c.pay;
