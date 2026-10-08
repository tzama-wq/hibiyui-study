// 選手イラスト(Higgsfield)の プロンプトを つくる。実在の人物には にせない、オリジナルの デフォルメ キャラ。
//   node scripts/player-prompts.mjs > jobs.json   … まだ 画像が ない レア以上の 選手ぶん
import { existsSync } from 'node:fs';
import { PLAYERS } from '../game.js';

const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const pick = (a, h, k) => a[Math.floor(((h >>> (k * 3)) ^ (h * (k + 7))) >>> 0) % a.length];
const HAIR = ['short spiky black', 'curly dark brown', 'long wavy blonde', 'messy red', 'silver straight', 'dark braided', 'black afro-style', 'brown bowl-cut', 'chestnut ponytail', 'buzz-cut black', 'blue-tinted short', 'green-tinted spiky', 'orange wavy', 'white short', 'dark long straight', 'pink-tinted bob'];
const SKIN = ['light', 'tan', 'medium brown', 'deep brown', 'light', 'tan'];
const KIT = ['red and white', 'blue and white', 'green and yellow', 'orange and black', 'purple and white', 'sky-blue', 'yellow and navy', 'white and gold', 'crimson and black', 'teal and white', 'maroon and sky-blue', 'black and neon green'];
const POSE = { FW: 'powerful shooting pose kicking a ball', MF: 'stylish passing pose controlling the ball', DF: 'strong tackling pose with a determined face', GK: 'diving save pose wearing goalkeeper gloves' };
const MOTIF = { SHO: 'fiery flames and a lightning-bolt streak', PAS: 'floating music notes and glowing light trails', SPD: 'wind swirls, speed lines and electric sparks', DEF: 'a glowing shield emblem and flying stone fragments', STA: 'a glowing heart and rising sun rays' };
const AURA = { rare: 'blue glowing sparkles', super: 'gold and purple radiant aura with star bursts', legend: 'epic rainbow-gold flames, a crown-like halo and dramatic light rays' };

const jobs = PLAYERS.filter((p) => ['rare', 'super', 'legend'].includes(p.rarity) && !existsSync(new URL(`../images/players/${p.id}.webp`, import.meta.url))).map((p) => {
  const h = hash(p.id); const top = Object.keys(p.stats).sort((a, b) => p.stats[b] - p.stats[a])[0];
  const who = h % 4 === 0 ? 'young girl' : 'young boy';
  const prompt = `Original anime-style ${who} soccer player character, square game-card portrait, ${POSE[p.pos]}. ${pick(HAIR, h, 1)} hair, ${pick(SKIN, h, 2)} skin, wearing a ${pick(KIT, h, 3)} soccer kit. Motif: ${MOTIF[top]}. ${AURA[p.rarity]}. Clean cel-shaded Japanese mobile-game illustration, vivid colors, dark gradient background, no text, no logos, not a real person.`;
  return { id: p.id, prompt };
});
console.log(JSON.stringify(jobs, null, 1));
