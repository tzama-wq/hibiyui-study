// ぶき・そうびの アイコン(じさく・おなじ トンマナ: くらい タイル+しろい シルエット)。ゲームの ぶきの いちらんを ほうふつと させる ふうの オリジナル。
// canvas で かいて dataURL に する(ファイル なし・けんり もんだい なし)。
const W = 100; const H = 50;
const R = (x, y, w, h) => ['r', x, y, w, h];
const P = (...pts) => ['p', pts];
const C = (x, y, r) => ['c', x, y, r];
const L = (x1, y1, x2, y2, w = 2) => ['l', x1, y1, x2, y2, w];

const GUN = {
  pistol: [R(18, 12, 60, 11), R(76, 14, 7, 6), P([26, 23], [44, 23], [40, 45], [27, 45]), R(44, 25, 10, 3)],
  revolver: [R(38, 12, 46, 8), C(40, 19, 10), P([20, 26], [38, 28], [34, 46], [19, 44]), R(80, 11, 8, 4)],
  smg: [R(12, 14, 56, 12), R(68, 17, 18, 4), P([40, 26], [49, 26], [49, 47], [40, 47]), P([24, 26], [33, 26], [31, 41], [22, 41]), R(2, 16, 12, 3), R(30, 10, 14, 4)],
  shotgun: [R(14, 15, 78, 5), R(38, 20, 24, 6), R(14, 13, 28, 11), P([2, 14], [14, 14], [14, 29], [2, 27]), P([34, 24], [42, 24], [40, 36], [33, 36])],
  rifle: [R(22, 14, 48, 10), R(70, 16, 26, 3), P([3, 14], [22, 14], [22, 25], [3, 31]), P([44, 24], [53, 24], [49, 40], [40, 38]), R(44, 9, 12, 5), P([30, 24], [37, 24], [35, 36], [29, 36])],
  mg: [R(18, 14, 46, 11), R(64, 15, 30, 4), P([2, 14], [18, 14], [18, 26], [2, 30]), R(34, 25, 16, 13), R(66, 19, 3, 12), R(74, 19, 3, 12), R(40, 9, 14, 5)],
  sniper: [R(18, 15, 36, 9), R(54, 17, 42, 3), R(36, 6, 30, 6), R(44, 12, 4, 4), P([2, 15], [18, 15], [18, 25], [2, 30]), P([30, 24], [37, 24], [35, 37], [29, 37]), R(78, 20, 3, 9)],
  rpg: [R(6, 15, 70, 9), P([76, 12], [96, 19], [76, 27]), P([26, 24], [34, 24], [32, 40], [25, 40]), R(40, 9, 8, 6), R(2, 17, 6, 5)],
  grenadel: [R(24, 14, 48, 12), R(72, 16, 20, 8), C(48, 27, 8), P([4, 15], [24, 15], [24, 26], [4, 32]), P([34, 34], [41, 34], [39, 46], [33, 46])],
  homing: [R(6, 18, 72, 9), P([78, 15], [97, 22], [78, 30]), R(26, 8, 34, 10), P([30, 27], [38, 27], [36, 43], [29, 43]), R(60, 10, 6, 4)],
  minigun: [R(30, 10, 62, 3), R(30, 15, 62, 3), R(30, 20, 62, 3), R(30, 25, 62, 3), R(18, 8, 16, 22), C(26, 19, 9), P([14, 28], [24, 30], [22, 46], [12, 46]), R(86, 8, 4, 20)],
  railgun: [R(10, 16, 82, 7), R(32, 11, 5, 17), R(50, 11, 5, 17), R(68, 11, 5, 17), P([4, 15], [10, 15], [10, 25], [4, 29]), P([22, 23], [30, 23], [28, 40], [21, 40]), C(90, 19, 4)],
  knife: [P([8, 25], [60, 14], [74, 22], [60, 28]), R(60, 17, 8, 14), R(68, 19, 26, 9)],
  bat: [P([6, 40], [10, 44], [78, 12], [74, 6]), P([74, 6], [78, 12], [94, 12], [92, 5]), R(2, 36, 10, 10)],
  hammer: [R(40, 20, 52, 6), R(12, 8, 30, 14), R(8, 12, 6, 6)],
  crowbar: [R(8, 22, 78, 5), P([86, 24], [94, 14], [98, 18], [92, 30]), P([8, 24], [2, 30], [6, 34], [14, 27])],
  machete: [P([6, 28], [74, 8], [92, 12], [74, 26]), R(2, 24, 18, 8)],
  axe: [R(10, 22, 78, 5), P([56, 6], [76, 6], [86, 24], [56, 22]), R(2, 18, 12, 12)],
  fist: [R(26, 14, 44, 24), C(32, 16, 6), C(44, 14, 6), C(56, 14, 6), C(68, 16, 6), R(22, 30, 20, 14)],
  grenade: [C(46, 28, 15), R(40, 6, 12, 9), R(52, 8, 14, 3), C(70, 10, 4)],
  molotov: [P([42, 12], [56, 12], [60, 26], [66, 46], [34, 46], [40, 26]), R(44, 6, 10, 8), P([46, 6], [50, -2], [54, 6])],
};
const WSHAPE = { pistol: 'pistol', combatpistol: 'pistol', heavypistol: 'pistol', pistol50: 'pistol', revolver: 'revolver', appistol: 'pistol', microsmg: 'smg', smg: 'smg', assaultsmg: 'smg', combatpdw: 'smg', sawedoff: 'shotgun', pump: 'shotgun', dbarrel: 'shotgun', assaultsg: 'shotgun', assault: 'rifle', carbine: 'rifle', specialcarbine: 'rifle', heavyrifle: 'rifle', mg: 'mg', combatmg: 'mg', minigun: 'minigun', sniper: 'sniper', marksman: 'sniper', heavysniper: 'sniper', grenade: 'grenade', molotov: 'molotov', grenadel: 'grenadel', rpg: 'rpg', homing: 'homing', railgun: 'railgun', knife: 'knife', bat: 'bat', hammer: 'hammer', crowbar: 'crowbar', machete: 'machete', axe: 'axe', fist: 'fist' };
const SCALE = { sawedoff: 0.78, microsmg: 0.78, combatpistol: 0.95, heavypistol: 1.05, pistol50: 1.08, appistol: 0.95, heavyrifle: 1.05, heavysniper: 1.0, combatmg: 1.0 };

const EQ = {
  jacket: [P([22, 6], [40, 4], [50, 12], [60, 4], [78, 6], [94, 20], [84, 30], [76, 24], [76, 46], [24, 46], [24, 24], [16, 30], [6, 20]), L(50, 12, 50, 46, 2)],
  hood: [P([22, 8], [40, 4], [50, 14], [60, 4], [78, 8], [94, 22], [84, 32], [76, 26], [76, 46], [24, 46], [24, 26], [16, 32], [6, 22]), P([40, 4], [50, 14], [60, 4], [56, 2], [44, 2]), R(36, 32, 28, 10)],
  vest: [P([26, 6], [40, 4], [50, 12], [60, 4], [74, 6], [78, 44], [22, 44]), R(30, 20, 14, 10), R(56, 20, 14, 10), L(26, 8, 30, 2, 5), L(74, 8, 70, 2, 5)],
  armor: [P([14, 14], [30, 6], [42, 4], [50, 12], [58, 4], [70, 6], [86, 14], [82, 24], [74, 24], [76, 46], [24, 46], [26, 24], [18, 24]), C(20, 14, 9), C(80, 14, 9), P([40, 26], [60, 26], [56, 40], [44, 40])],
  suit: [P([20, 6], [40, 4], [50, 12], [60, 4], [80, 6], [92, 36], [84, 40], [74, 20], [70, 46], [54, 46], [50, 30], [46, 46], [30, 46], [26, 20], [16, 40], [8, 36]), C(50, 20, 5)],
  shoe: [P([8, 30], [20, 14], [40, 14], [44, 26], [74, 28], [92, 38], [92, 44], [8, 44]), R(8, 40, 86, 5)],
  boot: [P([14, 4], [40, 4], [42, 28], [78, 32], [94, 42], [94, 46], [14, 46]), R(14, 40, 80, 6)],
  wing: [P([8, 30], [20, 14], [40, 14], [44, 26], [74, 28], [92, 38], [92, 44], [8, 44]), P([20, 12], [4, 2], [10, 14], [0, 14], [12, 22])],
  bolt: [P([8, 30], [20, 14], [40, 14], [44, 26], [74, 28], [92, 38], [92, 44], [8, 44]), P([56, 2], [44, 18], [52, 18], [46, 30], [62, 12], [54, 12])],
  cap: [P([16, 30], [20, 14], [40, 6], [62, 8], [78, 22], [80, 30]), R(58, 28, 40, 6), R(16, 30, 64, 5)],
  visor: [R(14, 24, 72, 7), P([86, 24], [98, 30], [86, 31]), P([22, 24], [28, 10], [72, 10], [80, 24])],
  headset: [P([20, 32], [20, 20], [30, 8], [70, 8], [80, 20], [80, 32], [74, 32], [74, 22], [66, 14], [34, 14], [26, 22], [26, 32]), R(14, 24, 14, 18), R(72, 24, 14, 18), R(36, 38, 6, 5), R(36, 40, 28, 3)],
  helmet: [P([14, 34], [16, 18], [34, 6], [66, 6], [84, 18], [86, 34]), R(12, 32, 78, 6), R(44, 6, 12, 8)],
  goggle: [R(8, 20, 84, 4), C(32, 24, 14), C(68, 24, 14), R(46, 22, 8, 5)],
  mask: [P([10, 22], [24, 12], [76, 12], [90, 22], [82, 36], [60, 28], [50, 36], [40, 28], [18, 36]), P([30, 6], [50, 0], [70, 6], [50, 10])],
  crown: [P([12, 36], [18, 12], [34, 26], [50, 6], [66, 26], [82, 12], [88, 36]), R(12, 34, 76, 8)],
};
const ESHAPE = { jersey: 'jacket', hoodie: 'hood', rider: 'jacket', vest: 'vest', armor: 'armor', bsuit: 'suit', u_suit: 'suit', sneaker: 'shoe', runner: 'shoe', spike: 'shoe', turbo: 'boot', rocket: 'wing', lightning: 'bolt', u_boots: 'bolt', cap: 'cap', visor: 'visor', headset: 'headset', tactical: 'helmet', goggle: 'goggle', hmask: 'mask', u_helm: 'crown' };

const cache = new Map();
function drawPrims(g, prims, scale, fill) {
  g.save(); g.translate(W / 2, H / 2); g.scale(scale, scale); g.translate(-W / 2, -H / 2); g.fillStyle = fill; g.strokeStyle = fill;
  for (const p of prims) {
    if (p[0] === 'r') g.fillRect(p[1], p[2], p[3], p[4]); else if (p[0] === 'c') { g.beginPath(); g.arc(p[1], p[2], p[3], 0, 6.283); g.fill(); } else if (p[0] === 'l') { g.lineWidth = p[5]; g.beginPath(); g.moveTo(p[1], p[2]); g.lineTo(p[3], p[4]); g.stroke(); }
    else { g.beginPath(); p[1].forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); }
  }
  g.restore();
}
function tile(prims, scale, accent) {
  const key = prims; let url = cache.get(key + accent + scale); if (url) return url;
  try {
    const c = document.createElement('canvas'); c.width = 200; c.height = 100; const g = c.getContext('2d'); g.scale(2, 2);
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#2a3242'); bg.addColorStop(1, '#141a24'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(0, 0, W, 2); g.strokeStyle = accent; g.globalAlpha = 0.55; g.lineWidth = 1.5; g.strokeRect(1, 1, W - 2, H - 2); g.globalAlpha = 1;
    g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 3; g.shadowOffsetY = 1.5; drawPrims(g, prims, scale * 0.86, '#eef2f7'); g.shadowColor = 'transparent';
    url = c.toDataURL('image/png');
  } catch { url = ''; }
  cache.set(key + accent + scale, url); return url;
}
const RAR = ['#7a8aa6', '#5ac8ff', '#ffb02a', '#ff5aff'];
export function weaponIconURL(w) { const shape = GUN[WSHAPE[w.id] || (w.melee ? 'knife' : w.expl ? 'rpg' : 'pistol')]; const tier = w.price >= 40000 ? 3 : w.price >= 14000 ? 2 : w.price >= 4000 ? 1 : 0; return tile(shape, SCALE[w.id] || 1, RAR[tier]); }
export function equipIconURL(e) { const shape = EQ[ESHAPE[e.id] || (e.slot === 'body' ? 'jacket' : e.slot === 'feet' ? 'shoe' : 'cap')]; const tier = e.price >= 100000 ? 3 : e.price >= 15000 ? 2 : e.price >= 3000 ? 1 : 0; return tile(shape, 1, RAR[tier]); }
export const iconImg = (url, cls = 'wi') => (url ? `<img class="${cls}" src="${url}" alt="" draggable="false">` : '');
