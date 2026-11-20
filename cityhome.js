// じたく(はこにわ): へや・かぐ・かべがみ・ゆか・いえの がいかん・かくちょう。シミュレーションと ぶんりした せいてきな データと かんすう(テストできる)。
// データ: home = { lv, floor, wall, house, items: [{ id, x, y, r }], inv: { かぐID: かず }, floors: [かいほうずみ], walls: [かいほうずみ], houses: [かいほうずみ] }
export const HOME_LEVELS = [
  { w: 6, h: 5, cost: 0, name: 'ちいさな いえ' },
  { w: 8, h: 6, cost: 3000, name: 'ふつうの いえ' },
  { w: 10, h: 7, cost: 12000, name: 'ひろい いえ' },
  { w: 12, h: 8, cost: 40000, name: 'おおきな いえ' },
];
export const FLOORS = [
  { id: 'wood', name: 'フローリング', a: '#c9a06a', b: '#b98f5a', cost: 0 }, { id: 'tatami', name: 'たたみ', a: '#b9c27a', b: '#a9b26a', cost: 0 },
  { id: 'tile', name: 'タイル', a: '#e8e8ea', b: '#cfd3d8', cost: 600 }, { id: 'carpet', name: 'カーペット', a: '#9a5a6a', b: '#8a4a5a', cost: 800 },
  { id: 'sky', name: 'そらいろ', a: '#9fd0f0', b: '#8cc2e8', cost: 900 }, { id: 'checker', name: 'チェック', a: '#f2f2f2', b: '#2a2a30', cost: 1200 },
  { id: 'stone', name: 'いし', a: '#8d8f95', b: '#7c7e84', cost: 1500 },
];
export const WALLS = [
  { id: 'cream', name: 'クリーム', c: '#f1e7cf', cost: 0 }, { id: 'white', name: 'しろ', c: '#f6f6f4', cost: 0 },
  { id: 'mint', name: 'ミント', c: '#bfe6d4', cost: 500 }, { id: 'pink', name: 'さくら', c: '#f6cfd8', cost: 500 },
  { id: 'blue', name: 'ブルー', c: '#bcd3f2', cost: 700 }, { id: 'stripe', name: 'ストライプ', c: '#e8d27a', s: '#f6ecb0', cost: 1200 },
  { id: 'wood', name: 'もくめ', c: '#b98c58', cost: 1000 }, { id: 'night', name: 'よぞら', c: '#2c3563', cost: 1500 },
];
// いえの がいかん(かくちょう レベルで ふえる。おとなりに ならぶ いえの デザインも かわる)
export const HOUSES = [
  { id: 'a', name: 'あかやねの いえ', wall: '#f2ead8', roof: '#c0392b', lv: 0 }, { id: 'b', name: 'あおやねの いえ', wall: '#eef2f6', roof: '#2c6fbb', lv: 0 },
  { id: 'c', name: 'みどりの いえ', wall: '#e6f0d8', roof: '#3f8f4a', lv: 1 }, { id: 'd', name: 'レンガの いえ', wall: '#c9835a', roof: '#4a3a32', lv: 2 },
  { id: 'e', name: 'モダンハウス', wall: '#f4f4f6', roof: '#3a3f4a', lv: 3, flat: true }, { id: 'f', name: 'おしろふうの いえ', wall: '#e8e0f0', roof: '#7a4ac0', lv: 3, tower: true },
];
// かぐ: rar 1=ふつう 2=レア 3=スーパーレア。w×h=ますの おおきさ
export const FURN = [
  { id: 'bed', name: 'ベッド', icon: '🛏️', w: 2, h: 2, rar: 1 }, { id: 'sofa', name: 'ソファ', icon: '🛋️', w: 2, h: 1, rar: 1 }, { id: 'table', name: 'ちゃぶだい', icon: '🍵', w: 1, h: 1, rar: 1 },
  { id: 'tv', name: 'テレビ', icon: '📺', w: 1, h: 1, rar: 1 }, { id: 'plant', name: 'かんようしょくぶつ', icon: '🪴', w: 1, h: 1, rar: 1 }, { id: 'shelf', name: 'ほんだな', icon: '📚', w: 1, h: 1, rar: 1 },
  { id: 'lamp', name: 'ライト', icon: '💡', w: 1, h: 1, rar: 1 }, { id: 'rug', name: 'ラグ', icon: '🧶', w: 2, h: 2, rar: 1 }, { id: 'fridge', name: 'れいぞうこ', icon: '🧊', w: 1, h: 2, rar: 1 },
  { id: 'teddy', name: 'くまの ぬいぐるみ', icon: '🧸', w: 1, h: 1, rar: 1 }, { id: 'ball', name: 'サッカーボール', icon: '⚽', w: 1, h: 1, rar: 1 }, { id: 'game', name: 'ゲームき', icon: '🎮', w: 1, h: 1, rar: 1 },
  { id: 'desk', name: 'パソコンデスク', icon: '💻', w: 2, h: 1, rar: 1 }, { id: 'kotatsu', name: 'こたつ', icon: '🍊', w: 2, h: 2, rar: 1 }, { id: 'wardrobe', name: 'クローゼット', icon: '🚪', w: 1, h: 2, rar: 1 },
  { id: 'cat', name: 'ねこ', icon: '🐱', w: 1, h: 1, rar: 2 }, { id: 'dog', name: 'いぬ', icon: '🐶', w: 1, h: 1, rar: 2 }, { id: 'piano', name: 'ピアノ', icon: '🎹', w: 2, h: 1, rar: 2 },
  { id: 'guitar', name: 'ギター', icon: '🎸', w: 1, h: 1, rar: 2 }, { id: 'aquarium', name: 'すいそう', icon: '🐠', w: 2, h: 1, rar: 2 }, { id: 'trophy', name: 'トロフィー', icon: '🏆', w: 1, h: 1, rar: 2 },
  { id: 'globe', name: 'ちきゅうぎ', icon: '🌐', w: 1, h: 1, rar: 2 }, { id: 'bath', name: 'バスタブ', icon: '🛁', w: 2, h: 1, rar: 2 }, { id: 'palm', name: 'ヤシの き', icon: '🌴', w: 1, h: 1, rar: 2 },
  { id: 'clock', name: 'とけい', icon: '🕰️', w: 1, h: 1, rar: 2 }, { id: 'art', name: 'がく(え)', icon: '🖼️', w: 1, h: 1, rar: 2 },
  { id: 'fountain', name: 'ふんすい', icon: '⛲', w: 2, h: 2, rar: 3 }, { id: 'statue', name: 'どうぞう', icon: '🗿', w: 1, h: 1, rar: 3 }, { id: 'rocket', name: 'ロケット もけい', icon: '🚀', w: 2, h: 2, rar: 3 },
  { id: 'chandelier', name: 'シャンデリア', icon: '🪔', w: 1, h: 1, rar: 3 }, { id: 'fire', name: 'だんろ', icon: '🔥', w: 2, h: 1, rar: 3 }, { id: 'ufo', name: 'ゆーふぉー', icon: '🛸', w: 2, h: 2, rar: 3 },
];
export const furnOf = (id) => FURN.find((f) => f.id === id);
export const floorOf = (id) => FLOORS.find((f) => f.id === id);
export const wallOf = (id) => WALLS.find((w) => w.id === id);
export const houseOf = (id) => HOUSES.find((h) => h.id === id);
export const emptyHome = () => ({ lv: 0, floor: 'wood', wall: 'cream', house: 'a', items: [], inv: { bed: 1, sofa: 1, plant: 1 }, floors: ['wood', 'tatami'], walls: ['cream', 'white'], houses: ['a', 'b'] });
export const normalizeHome = (h) => {
  const e = emptyHome(); if (!h || typeof h !== 'object') return e; const o = { ...e, ...h };
  o.lv = Math.max(0, Math.min(HOME_LEVELS.length - 1, o.lv | 0)); o.inv = o.inv && typeof o.inv === 'object' ? { ...o.inv } : {}; for (const k of Object.keys(o.inv)) if (!furnOf(k) || !(o.inv[k] > 0)) delete o.inv[k];
  o.floors = [...new Set([...e.floors, ...(Array.isArray(o.floors) ? o.floors : [])])].filter(floorOf); o.walls = [...new Set([...e.walls, ...(Array.isArray(o.walls) ? o.walls : [])])].filter(wallOf); o.houses = [...new Set([...e.houses, ...(Array.isArray(o.houses) ? o.houses : [])])].filter(houseOf);
  if (!o.floors.includes(o.floor)) o.floor = 'wood'; if (!o.walls.includes(o.wall)) o.wall = 'cream'; if (!o.houses.includes(o.house)) o.house = 'a';
  const { w, h: hh } = HOME_LEVELS[o.lv]; o.items = (Array.isArray(o.items) ? o.items : []).filter((it) => it && furnOf(it.id) && Number.isFinite(it.x) && Number.isFinite(it.y)).map((it) => ({ id: it.id, x: it.x | 0, y: it.y | 0, r: it.r ? 1 : 0 })).filter((it) => { const [iw, ih] = dims(it); return it.x >= 0 && it.y >= 0 && it.x + iw <= w && it.y + ih <= hh; });
  return o;
};
export const dims = (it) => { const f = furnOf(it.id); return it.r ? [f.h, f.w] : [f.w, f.h]; };
export const roomSize = (home) => HOME_LEVELS[home.lv];
// ますが あいているか(ほかの かぐと かさならない・へやの なか)
export const canPlace = (home, id, x, y, r, ignoreIdx = -1) => {
  const f = furnOf(id); if (!f) return false; const [iw, ih] = r ? [f.h, f.w] : [f.w, f.h]; const { w, h } = HOME_LEVELS[home.lv]; if (x < 0 || y < 0 || x + iw > w || y + ih > h) return false;
  for (let i = 0; i < home.items.length; i++) { if (i === ignoreIdx) continue; const it = home.items[i]; const [jw, jh] = dims(it); if (x < it.x + jw && it.x < x + iw && y < it.y + jh && it.y < y + ih) return false; }
  return true;
};
export const itemAt = (home, x, y) => home.items.findIndex((it) => { const [iw, ih] = dims(it); return x >= it.x && x < it.x + iw && y >= it.y && y < it.y + ih; });
export const placeItem = (home, id, x, y, r = 0) => { if (!(home.inv[id] > 0) || !canPlace(home, id, x, y, r)) return false; home.inv[id]--; if (!home.inv[id]) delete home.inv[id]; home.items.push({ id, x, y, r: r ? 1 : 0 }); return true; };
export const moveItem = (home, idx, x, y) => { const it = home.items[idx]; if (!it || !canPlace(home, it.id, x, y, it.r, idx)) return false; it.x = x; it.y = y; return true; };
export const rotateItem = (home, idx) => { const it = home.items[idx]; if (!it) return false; const r = it.r ? 0 : 1; if (!canPlace(home, it.id, it.x, it.y, r, idx)) return false; it.r = r; return true; };
export const storeItem = (home, idx) => { const it = home.items[idx]; if (!it) return false; home.items.splice(idx, 1); home.inv[it.id] = (home.inv[it.id] || 0) + 1; return true; };
export const addFurn = (home, id, n = 1) => { if (!furnOf(id)) return false; home.inv[id] = (home.inv[id] || 0) + n; return true; };
export const expandCost = (home) => (home.lv + 1 < HOME_LEVELS.length ? HOME_LEVELS[home.lv + 1].cost : null);
export const expand = (home, coins) => { const c = expandCost(home); if (c == null || coins < c) return -1; home.lv++; for (const hs of HOUSES) if (hs.lv <= home.lv && !home.houses.includes(hs.id)) home.houses.push(hs.id); return c; };
export const buyStyle = (home, kind, id, coins) => {
  const list = kind === 'floor' ? FLOORS : WALLS; const it = list.find((x) => x.id === id); const own = kind === 'floor' ? home.floors : home.walls; if (!it) return -1; if (own.includes(id)) { home[kind] = id; return 0; } if (coins < it.cost) return -1; own.push(id); home[kind] = id; return it.cost;
};
export const setHouse = (home, id) => { const hs = houseOf(id); if (!hs || !home.houses.includes(id) || hs.lv > home.lv) return false; home.house = id; return true; };
// ほうしゅうの かぐ(むずかしい しごと ほど レアが でやすい)
export const rollFurn = (rnd, level = 1) => {
  const p3 = level >= 3 ? 0.18 : level >= 2 ? 0.08 : 0.02; const p2 = level >= 3 ? 0.4 : level >= 2 ? 0.32 : 0.18; const r = rnd(); const rar = r < p3 ? 3 : r < p3 + p2 ? 2 : 1; const list = FURN.filter((f) => f.rar === rar); return list[Math.floor(rnd() * list.length)].id;
};
