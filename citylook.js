// キャラの きがえ(からだ・ふく・ぼうし)。データだけ。ふくは しろく ぬりかえる 色(tint)で あらわす
export const BODIES = [
  { id: 'casual', name: 'ふつうの こ', key: 'casual' },
  { id: 'man', name: 'おとこのこ', key: 'man' },
  { id: 'woman', name: 'おんなのこ', key: 'womancasual' },
  { id: 'dress', name: 'ワンピースの こ', key: 'womandress' },
];
export const OUTFITS = [
  { id: 'default', name: 'いつもの ふく', icon: '👕', price: 0 },
  { id: 'blue', name: 'ブルー ユニフォーム', icon: '⚽', price: 300, shirt: '#1d5fd6', pants: '#f2f2f2' },
  { id: 'red', name: 'レッド ユニフォーム', icon: '⚽', price: 300, shirt: '#d62a2a', pants: '#f2f2f2' },
  { id: 'yellow', name: 'イエロー ジャージ', icon: '🟡', price: 300, shirt: '#f0c420', pants: '#2a3a6a' },
  { id: 'green', name: 'グリーン パーカー', icon: '🟢', price: 600, shirt: '#2a9a4a', pants: '#2a3a2a' },
  { id: 'pink', name: 'ピンク コーデ', icon: '🌸', price: 600, shirt: '#ff7fb0', pants: '#7a4a8a' },
  { id: 'ninja', name: 'ニンジャ', icon: '🥷', price: 900, shirt: '#1a1a22', pants: '#1a1a22' },
  { id: 'hero', name: 'ヒーロー', icon: '🦸', price: 900, shirt: '#d62a2a', pants: '#1d3fa6' },
  { id: 'lab', name: 'はかせ', icon: '🥼', price: 1200, shirt: '#f4f4f4', pants: '#3a5a8a' },
  { id: 'space', name: 'うちゅう ひこうし', icon: '🚀', price: 1500, shirt: '#6a3ad6', pants: '#2a1a5a' },
  { id: 'camo', name: 'さいきょう めいさい', icon: '🪖', price: 1800, shirt: '#5a6a3a', pants: '#3a4a2a' },
  { id: 'gold', name: 'ゴールド ゴージャス', icon: '👑', price: 3000, shirt: '#e0b020', pants: '#3a2a10' },
];
export const HATS = [
  { id: 'none', name: 'ぼうしなし', icon: '🙂', price: 0 },
  { id: 'cap', name: 'キャップ', icon: '🧢', price: 200, kind: 'cap', color: '#d62a2a' },
  { id: 'beanie', name: 'ニットぼう', icon: '🧶', price: 300, kind: 'beanie', color: '#3a7ad6' },
  { id: 'headband', name: 'ハチマキ', icon: '🎌', price: 300, kind: 'headband', color: '#e02020' },
  { id: 'builder', name: 'ヘルメット', icon: '⛑️', price: 600, kind: 'helmet', color: '#f0c420' },
  { id: 'bunny', name: 'うさぎ みみ', icon: '🐰', price: 600, kind: 'ears', color: '#ffb0d0' },
  { id: 'crown', name: 'おうかん', icon: '👑', price: 2000, kind: 'crown', color: '#ffd23f' },
];
export const DEFAULT_LOOK = { body: 'casual', outfit: 'default', hat: 'none', owned: ['default', 'none'] };
export const normLook = (l) => { const o = { ...DEFAULT_LOOK, ...(l || {}) }; o.owned = [...new Set([...(Array.isArray(o.owned) ? o.owned : []), 'default', 'none'])]; if (!BODIES.some((b) => b.id === o.body)) o.body = 'casual'; if (!OUTFITS.some((x) => x.id === o.outfit)) o.outfit = 'default'; if (!HATS.some((x) => x.id === o.hat)) o.hat = 'none'; return o; };
