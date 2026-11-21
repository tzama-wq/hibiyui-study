// シティの たてもの(がいへき): えがいた テクスチャ(まど・ベランダ・おみせ・かんばん)+ひかる まど+でこぼこ(バンプ)+ちょうてんカラー。
//   addBuildings(THREE, scene, buildings, { shadows, aniso }) → ぜんぶの たてものを しゅるいごとに 1つの メッシュに まとめる。
const FLOOR = 3.6; const BAY = 5; const TILE = 4; // 1タイル = よこ4ベイ × たて4かい
const mulberry = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

function canvasPair(w, h) { const mk = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }; const m = mk(); const e = mk(); const b = mk(); const r = mk(); const g = m.getContext('2d'); const ge = e.getContext('2d'); const gb = b.getContext('2d'); const gr = r.getContext('2d'); ge.fillStyle = '#000'; ge.fillRect(0, 0, w, h); gb.fillStyle = '#808080'; gb.fillRect(0, 0, w, h); gr.fillStyle = '#d0d0d0'; gr.fillRect(0, 0, w, h); return { m, e, b, r, g, ge, gb, gr }; }
const grain = (g, w, h, rnd, n = 2500, a = 0.06) => { for (let i = 0; i < n; i++) { g.fillStyle = rnd() < 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a * 1.4})`; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); } };
const streaks = (g, w, h, rnd, n = 40) => { for (let i = 0; i < n; i++) { const x = rnd() * w; const y = rnd() * h * 0.6; g.fillStyle = `rgba(30,25,20,${0.02 + rnd() * 0.05})`; g.fillRect(x, y, 1 + rnd() * 2, h * (0.2 + rnd() * 0.5)); } };
const WARM = ['#ffc872', '#ffd98a', '#ffb860', '#fff0c0', '#ffe2a0', '#9fd8ff'];

// ---- うえの かい ----
function upperTile(kind, seed) {
  const W = 512; const rnd = mulberry(seed * 977 + 13); const P = canvasPair(W, W); const { g, ge, gb, gr } = P; const cell = W / TILE;
  g.fillStyle = kind === 'warehouse' ? '#b8bcc4' : '#dcd8d0'; g.fillRect(0, 0, W, W); gb.fillStyle = '#808080';
  for (let fy = 0; fy < TILE; fy++) for (let bx = 0; bx < TILE; bx++) {
    const x = bx * cell; const y = fy * cell; const lit = rnd() < (kind === 'tower' ? 0.45 : 0.28); const wc = WARM[Math.floor(rnd() * WARM.length)];
    if (kind === 'office') {
      g.fillStyle = '#c9c6bf'; g.fillRect(x, y + cell - 38, cell, 38); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x, y + cell - 40, cell, 3);
      const gg = g.createLinearGradient(x, y, x, y + cell - 40); gg.addColorStop(0, '#8fb0cc'); gg.addColorStop(1, '#2f4a66'); g.fillStyle = gg; g.fillRect(x, y + 4, cell, cell - 44);
      g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.moveTo(x + 10, y + 4); g.lineTo(x + 50, y + 4); g.lineTo(x + 20, y + cell - 40); g.lineTo(x - 10, y + cell - 40); g.fill();
      g.fillStyle = '#b8b6b0'; for (let m = 0; m <= 2; m++) g.fillRect(x + m * cell / 2 - 1.5, y + 4, 3, cell - 44);
      if (lit) { ge.fillStyle = wc; ge.globalAlpha = 0.85; ge.fillRect(x + 3, y + 30, cell - 6, cell - 72); ge.globalAlpha = 1; for (let m = 0; m <= 2; m++) { ge.fillStyle = '#000'; ge.fillRect(x + m * cell / 2 - 1.5, y + 30, 3, cell - 72); } }
      gr.fillStyle = '#2a2a2a'; gr.fillRect(x, y + 4, cell, cell - 44); gb.fillStyle = '#505050'; gb.fillRect(x, y + 4, cell, cell - 44);
    } else if (kind === 'glass') { // ガラスの カーテンウォール
      const gg = g.createLinearGradient(x, y, x + cell, y + cell); gg.addColorStop(0, '#7fb4d6'); gg.addColorStop(0.5, '#3f7098'); gg.addColorStop(1, '#1f3a56'); g.fillStyle = gg; g.fillRect(x, y, cell, cell);
      g.fillStyle = 'rgba(255,255,255,.22)'; g.beginPath(); g.moveTo(x + 6, y); g.lineTo(x + 46, y); g.lineTo(x + 12, y + cell); g.lineTo(x - 28, y + cell); g.fill();
      g.fillStyle = '#9aa4ae'; for (let m = 0; m <= 4; m++) g.fillRect(x + m * cell / 4 - 1.2, y, 2.4, cell); g.fillRect(x, y + cell - 3, cell, 3); g.fillRect(x, y + cell / 2 - 1, cell, 2);
      if (lit) { ge.fillStyle = wc; ge.globalAlpha = 0.6; ge.fillRect(x + 3, y + 3, cell - 6, cell - 8); ge.globalAlpha = 1; }
      gr.fillStyle = '#1c1c1c'; gr.fillRect(x, y, cell, cell); gb.fillStyle = '#606060'; gb.fillRect(x, y, cell, cell);
    } else if (kind === 'apt' || kind === 'tile' || kind === 'concrete') {
      if (kind === 'tile') { const TC = ['#b8654a', '#c8b898', '#8a9aa0', '#a8806a'][seed % 4]; g.fillStyle = TC; g.fillRect(x, y, cell, cell); g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 1; for (let t = 0; t <= cell; t += 10) { g.beginPath(); g.moveTo(x + t, y); g.lineTo(x + t, y + cell); g.stroke(); g.beginPath(); g.moveTo(x, y + t); g.lineTo(x + cell, y + t); g.stroke(); } gb.fillStyle = '#8c8c8c'; gb.fillRect(x, y, cell, cell); }
      else if (kind === 'concrete') { g.fillStyle = '#a9aaa6'; g.fillRect(x, y, cell, cell); g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(x, y + cell / 2 - 1, cell, 2); g.fillRect(x + cell / 2 - 1, y, 2, cell); g.fillStyle = 'rgba(0,0,0,.28)'; for (let t = 0; t < 4; t++) for (let u = 0; u < 4; u++) { g.beginPath(); g.arc(x + 16 + t * 32, y + 16 + u * 32, 1.8, 0, 6.28); g.fill(); } for (let t = 0; t < 3; t++) { g.fillStyle = `rgba(40,30,20,${0.04 + rnd() * 0.06})`; g.fillRect(x + rnd() * cell, y, 3 + rnd() * 3, cell); } }
      else { g.fillStyle = '#e2ded6'; g.fillRect(x, y, cell, cell); }
      // ベランダ(スラブ・てすり)
      g.fillStyle = '#b9b5ac'; g.fillRect(x + 4, y + cell - 40, cell - 8, 10); g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x + 4, y + cell - 30, cell - 8, 4);
      g.fillStyle = '#7a7e86'; for (let k = 0; k < 14; k++) g.fillRect(x + 6 + k * 8, y + cell - 70, 2, 30); g.fillStyle = '#a9adb5'; g.fillRect(x + 4, y + cell - 72, cell - 8, 3);
      const gg = g.createLinearGradient(x, y + 10, x, y + cell - 72); gg.addColorStop(0, '#6a88a4'); gg.addColorStop(1, '#2c4058'); g.fillStyle = gg; g.fillRect(x + 12, y + 14, 70, cell - 88); g.fillStyle = '#d6d6d2'; g.fillRect(x + 46, y + 14, 3, cell - 88);
      g.fillStyle = '#4a5a6a'; g.fillRect(x + 92, y + 28, 24, 36); g.fillStyle = '#e8e8e4'; g.fillRect(x + 90, y + 26, 28, 3); g.fillRect(x + 90, y + 62, 28, 3);
      if (rnd() < 0.5) { g.fillStyle = '#9a9ea6'; g.fillRect(x + 92, y + cell - 66, 22, 18); g.fillStyle = '#6a6e76'; g.fillRect(x + 94, y + cell - 64, 18, 5); }
      if (rnd() < 0.3) { g.fillStyle = ['#e04a4a', '#4a8ae0', '#f0d04a', '#5ac07a'][Math.floor(rnd() * 4)]; g.fillRect(x + 20 + rnd() * 30, y + cell - 66, 14, 22); }
      if (lit) { ge.fillStyle = wc; ge.globalAlpha = 0.8; ge.fillRect(x + 12, y + 14, 70, cell - 88); ge.globalAlpha = 1; ge.fillStyle = '#000'; ge.fillRect(x + 46, y + 14, 3, cell - 88); }
      gr.fillStyle = '#303030'; gr.fillRect(x + 12, y + 14, 70, cell - 88); gb.fillStyle = '#5a5a5a'; gb.fillRect(x + 12, y + 14, 70, cell - 88); gb.fillStyle = '#c0c0c0'; gb.fillRect(x + 4, y + cell - 40, cell - 8, 10);
    } else if (kind === 'tenant') {
      g.fillStyle = '#d8d2c6'; g.fillRect(x, y, cell, cell); g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x, y + cell - 4, cell, 4);
      const gg = g.createLinearGradient(x, y + 18, x, y + cell - 28); gg.addColorStop(0, '#7894ac'); gg.addColorStop(1, '#30465c'); g.fillStyle = gg; g.fillRect(x + 12, y + 18, cell - 40, cell - 50); g.fillStyle = '#e8e8e4'; g.fillRect(x + 10, y + 16, cell - 36, 3); g.fillRect(x + 10, y + cell - 33, cell - 36, 3);
      if (rnd() < 0.5) { const sc = ['#d12a2a', '#2a6ad1', '#2aa86a', '#e0a02a', '#8a3ad1', '#e8e8ee'][Math.floor(rnd() * 6)]; g.fillStyle = sc; g.fillRect(x + cell - 22, y + 8, 18, cell - 18); g.fillStyle = '#fff'; for (let k = 0; k < 5; k++) g.fillRect(x + cell - 18, y + 20 + k * 16, 10, 8); ge.fillStyle = sc; ge.globalAlpha = 0.9; ge.fillRect(x + cell - 22, y + 8, 18, cell - 18); ge.globalAlpha = 1; }
      if (rnd() < 0.4) { g.fillStyle = '#9a9ea6'; g.fillRect(x + 16, y + cell - 24, 28, 18); }
      if (lit) { ge.fillStyle = wc; ge.globalAlpha = 0.8; ge.fillRect(x + 12, y + 18, cell - 40, cell - 50); ge.globalAlpha = 1; }
      gr.fillStyle = '#383838'; gr.fillRect(x + 12, y + 18, cell - 40, cell - 50); gb.fillStyle = '#585858'; gb.fillRect(x + 12, y + 18, cell - 40, cell - 50);
    } else if (kind === 'school') {
      g.fillStyle = '#e6dfc8'; g.fillRect(x, y, cell, cell); g.fillStyle = '#c9c1a6'; g.fillRect(x, y + cell - 6, cell, 6);
      for (let p = 0; p < 2; p++) { const gg = g.createLinearGradient(x, y + 20, x, y + cell - 24); gg.addColorStop(0, '#9fc0d6'); gg.addColorStop(1, '#46688a'); g.fillStyle = gg; g.fillRect(x + 8 + p * 60, y + 22, 54, cell - 52); g.fillStyle = '#f4f4f0'; g.fillRect(x + 8 + p * 60 + 26, y + 22, 3, cell - 52); g.fillRect(x + 8 + p * 60, y + 22 + (cell - 52) * 0.55, 54, 3); if (lit) { ge.fillStyle = wc; ge.globalAlpha = 0.75; ge.fillRect(x + 8 + p * 60, y + 22, 54, cell - 52); ge.globalAlpha = 1; } }
      g.fillStyle = '#3a6aa8'; g.fillRect(x, y, 5, cell); gr.fillStyle = '#303030'; gr.fillRect(x + 8, y + 22, 114, cell - 52); gb.fillStyle = '#5a5a5a'; gb.fillRect(x + 8, y + 22, 114, cell - 52);
    } else if (kind === 'tower') {
      const gg = g.createLinearGradient(x, y, x + cell, y + cell); gg.addColorStop(0, '#5a7a9a'); gg.addColorStop(1, '#1c2c40'); g.fillStyle = gg; g.fillRect(x, y, cell, cell); g.fillStyle = '#9aa3b0'; g.fillRect(x, y + cell - 8, cell, 8); for (let m = 0; m <= 4; m++) g.fillRect(x + m * cell / 4 - 1, y, 2, cell);
      g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x + 20, y, 14, cell);
      if (lit) { ge.fillStyle = wc; ge.globalAlpha = 0.7; ge.fillRect(x, y + 12, cell, cell - 26); ge.globalAlpha = 1; for (let m = 0; m <= 4; m++) { ge.fillStyle = '#000'; ge.fillRect(x + m * cell / 4 - 1, y, 2, cell); } }
      gr.fillStyle = '#202020'; gr.fillRect(x, y, cell, cell - 8); gb.fillStyle = '#6a6a6a'; gb.fillRect(x, y, cell, cell - 8);
    } else { // warehouse
      for (let s = 0; s < 16; s++) { g.fillStyle = s % 2 ? '#a9aeb8' : '#c2c6ce'; g.fillRect(x + s * (cell / 16), y, cell / 16, cell); } g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(x, y + cell - 4, cell, 4);
      gb.fillStyle = '#909090'; for (let s = 0; s < 16; s += 2) gb.fillRect(x + s * (cell / 16), y, cell / 16, cell);
      gr.fillStyle = '#9a9a9a'; gr.fillRect(x, y, cell, cell);
    }
  }
  g.fillStyle = 'rgba(0,0,0,.14)'; for (let fy = 1; fy < TILE; fy++) g.fillRect(0, fy * cell - 1, W, 2); grain(g, W, W, rnd); streaks(g, W, W, rnd);
  return P;
}

// ---- いちばん した(おみせ・ロビー) ----
const SHOPS = ['ラーメン', 'ベーカリー', 'ドラッグ', 'カフェ', 'ほんや', 'ゲーム', 'くつや', 'やおや', 'バーガー', 'ぎゅうどん', 'くすり', 'うどん', 'たいやき', 'ふくや', 'おにぎり', 'しょくどう'];
function groundTile(kind, seed) {
  const Wt = 512; const Ht = 128; const rnd = mulberry(seed * 313 + 7); const P = canvasPair(Wt, Ht); const { g, ge, gb, gr } = P; const cell = Wt / TILE;
  g.fillStyle = kind === 'lobby' ? '#8d8e92' : '#bdb8ae'; g.fillRect(0, 0, Wt, Ht);
  for (let bx = 0; bx < TILE; bx++) {
    const x = bx * cell;
    if (kind === 'shop') {
      const sc = ['#d12a2a', '#2a6ad1', '#2aa86a', '#e0a02a', '#8a3ad1', '#d1527a', '#2a9aa8'][Math.floor(rnd() * 7)]; const name = SHOPS[Math.floor(rnd() * SHOPS.length)];
      g.fillStyle = sc; g.fillRect(x + 2, 6, cell - 4, 30); ge.fillStyle = sc; ge.globalAlpha = 0.85; ge.fillRect(x + 2, 6, cell - 4, 30); ge.globalAlpha = 1; g.fillStyle = '#fff'; g.font = 'bold 20px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name, x + cell / 2, 22); ge.fillStyle = '#fff'; ge.font = 'bold 20px sans-serif'; ge.textAlign = 'center'; ge.textBaseline = 'middle'; ge.fillText(name, x + cell / 2, 22);
      const gg = g.createLinearGradient(x, 40, x, Ht); gg.addColorStop(0, '#41546a'); gg.addColorStop(1, '#232f3c'); g.fillStyle = gg; g.fillRect(x + 8, 42, cell - 16, Ht - 46); ge.fillStyle = WARM[Math.floor(rnd() * 4)]; ge.globalAlpha = 0.6; ge.fillRect(x + 8, 42, cell - 16, Ht - 52); ge.globalAlpha = 1;
      for (let k = 0; k < 4; k++) { const cc = ['#e0603a', '#e8d04a', '#6ac06a', '#e8e8ee', '#d06aa0'][Math.floor(rnd() * 5)]; g.fillStyle = cc; g.fillRect(x + 14 + k * 26, 90 + rnd() * 10, 18, 22); ge.fillStyle = cc; ge.globalAlpha = 0.5; ge.fillRect(x + 14 + k * 26, 90, 18, 22); ge.globalAlpha = 1; }
      g.fillStyle = '#e8e6e0'; g.fillRect(x + 6, 40, 3, Ht - 40); g.fillRect(x + cell - 9, 40, 3, Ht - 40); g.fillRect(x + 6, 40, cell - 12, 3);
      if (rnd() < 0.3) { g.fillStyle = '#6a6e76'; g.fillRect(x + 6, 40, cell - 12, Ht - 40); ge.fillStyle = '#000'; ge.fillRect(x + 6, 40, cell - 12, Ht - 40); for (let k = 0; k < 10; k++) { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x + 6, 44 + k * 8, cell - 12, 2); } }
      gr.fillStyle = '#303030'; gr.fillRect(x + 8, 42, cell - 16, Ht - 46); gb.fillStyle = '#505050'; gb.fillRect(x + 8, 42, cell - 16, Ht - 46);
    } else if (kind === 'conbini') {
      g.fillStyle = '#f2f2f0'; g.fillRect(x, 0, cell, Ht); g.fillStyle = '#2aa86a'; g.fillRect(x, 8, cell, 10); g.fillStyle = '#2a6ad1'; g.fillRect(x, 20, cell, 8); ge.fillStyle = '#2aa86a'; ge.fillRect(x, 8, cell, 10); ge.fillStyle = '#2a6ad1'; ge.fillRect(x, 20, cell, 8);
      g.fillStyle = '#cfe6f6'; g.fillRect(x + 6, 36, cell - 12, Ht - 40); ge.fillStyle = '#ffffff'; ge.globalAlpha = 0.95; ge.fillRect(x + 6, 36, cell - 12, Ht - 42); ge.globalAlpha = 1;
      for (let k = 0; k < 3; k++) { g.fillStyle = ['#e04a4a', '#f0d04a', '#4a8ae0'][k]; g.fillRect(x + 12 + k * 34, 50, 26, 40); ge.fillStyle = '#000'; ge.fillRect(x + 12 + k * 34 + 12, 50, 2, 40); }
      g.fillStyle = '#ccd'; g.fillRect(x + 6, 36, 3, Ht - 40); g.fillRect(x + cell - 9, 36, 3, Ht - 40);
      gr.fillStyle = '#404040'; gr.fillRect(x + 6, 36, cell - 12, Ht - 40);
    } else if (kind === 'lobby') {
      g.fillStyle = '#6d6e72'; g.fillRect(x, 0, cell, Ht); const gg = g.createLinearGradient(x, 20, x, Ht); gg.addColorStop(0, '#5a7288'); gg.addColorStop(1, '#2a3846'); g.fillStyle = gg; g.fillRect(x + 6, 20, cell - 12, Ht - 22); ge.fillStyle = '#ffe2a0'; ge.globalAlpha = 0.5; ge.fillRect(x + 6, 24, cell - 12, Ht - 40); ge.globalAlpha = 1;
      g.fillStyle = '#aab0b8'; g.fillRect(x + cell / 2 - 1, 20, 3, Ht - 22); g.fillRect(x + 6, 20, cell - 12, 3); gr.fillStyle = '#242424'; gr.fillRect(x + 6, 20, cell - 12, Ht - 22); gb.fillStyle = '#585858'; gb.fillRect(x + 6, 20, cell - 12, Ht - 22);
    } else { // garage
      g.fillStyle = '#a8a69e'; g.fillRect(x, 0, cell, Ht); g.fillStyle = '#2a2b2f'; g.fillRect(x + 12, 40, cell - 24, Ht - 40); g.fillStyle = '#d8c23a'; g.fillRect(x + 12, 40, cell - 24, 6); ge.fillStyle = '#ffd890'; ge.globalAlpha = 0.25; ge.fillRect(x + 20, 50, cell - 40, 12); ge.globalAlpha = 1; gb.fillStyle = '#505050'; gb.fillRect(x + 12, 40, cell - 24, Ht - 40);
    }
  }
  g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(0, Ht - 5, Wt, 5); g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(0, 0, Wt, 2); grain(g, Wt, Ht, rnd, 900);
  return P;
}
const roofTile = () => { const W = 256; const rnd = mulberry(5); const P = canvasPair(W, W); const { g, gb } = P; g.fillStyle = '#8d8e8a'; g.fillRect(0, 0, W, W); grain(g, W, W, rnd, 3000, 0.08); g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 1.5; for (let i = 0; i < 4; i++) { g.strokeRect(rnd() * 120, rnd() * 120, 60 + rnd() * 120, 60 + rnd() * 120); } gb.fillStyle = '#808080'; gb.fillRect(0, 0, W, W); return P; };

export function addBuildings(THREE, scene, buildings, o = {}) {
  const aniso = o.aniso || 4; const S = o.shadows;
  const tex = (cv, srgb) => { const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  const mkMat = (P, extra = {}) => new THREE.MeshStandardMaterial({ map: tex(P.m, true), emissiveMap: tex(P.e, true), emissive: 0xffffff, emissiveIntensity: 1.0, bumpMap: tex(P.b), bumpScale: 1.5, roughnessMap: tex(P.r), roughness: 1, metalness: 0.05, vertexColors: true, ...extra });
  const up = { glass: mkMat(upperTile('glass', 13), { metalness: 0.65 }), tile0: mkMat(upperTile('tile', 8)), tile1: mkMat(upperTile('tile', 9)), tile2: mkMat(upperTile('tile', 10)), tile3: mkMat(upperTile('tile', 11)), concrete: mkMat(upperTile('concrete', 12)), office: mkMat(upperTile('office', 1), { metalness: 0.2 }), apt: mkMat(upperTile('apt', 2)), tenant: mkMat(upperTile('tenant', 3)), school: mkMat(upperTile('school', 4)), tower: mkMat(upperTile('tower', 5), { metalness: 0.45 }), warehouse: mkMat(upperTile('warehouse', 6), { metalness: 0.3 }) };
  const gd = { shop: [0, 1, 2].map((i) => mkMat(groundTile('shop', i + 1))), conbini: [mkMat(groundTile('conbini', 9))], lobby: [mkMat(groundTile('lobby', 4))], garage: [mkMat(groundTile('garage', 6))] };
  const rf = mkMat(roofTile(), { vertexColors: true });
  const plain = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.1 });
  const parts = new Map(); const push = (mat, geo) => { if (!parts.has(mat)) parts.set(mat, []); parts.get(mat).push(geo); };
  const col = new THREE.Color(); const rnd = mulberry(77);
  const colorize = (geo, c) => { col.set(c); const n = geo.attributes.position.count; const a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; } geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); };
  const TINT = ['#ffffff', '#f4efe4', '#e8eef6', '#f2e8e0', '#e6f0e6', '#eadfd0'];
  // はこ(がいへき):UVは かいの かずと ベイの かずに ぴったり あわせる
  const place = (geo, b) => { geo.rotateY(-(b.ang || 0)); geo.translate(b.cx, 0, b.cz); };
  const wallBox = (mat, b, hgt, cy, tint, vTiles, vOff) => {
    const w = b.w; const d = b.d; const geo = new THREE.BoxGeometry(w, hgt, d); const uv = geo.attributes.uv; const bw = Math.max(1, Math.round(w / BAY)); const bd = Math.max(1, Math.round(d / BAY)); const uOff = Math.floor(rnd() * TILE) / TILE;
    for (let i = 0; i < uv.count; i++) { const face = Math.floor(i / 4); const u = uv.getX(i); const v = uv.getY(i); if (face < 2) uv.setXY(i, uOff + u * bd / TILE, vOff + v * vTiles); else if (face >= 4) uv.setXY(i, uOff + u * bw / TILE, vOff + v * vTiles); else uv.setXY(i, 0, 0); }
    geo.translate(0, cy, 0); place(geo, b); colorize(geo, tint); push(mat, geo);
  };
  const plainBox = (b, w, h, d, lx, y, lz, c) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(lx, y, lz); place(g, b); colorize(g, c); push(plain, g); };
  const roofBox = (b, w, d, y, c) => { const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 12, uv.getY(i) * d / 12); g.translate(0, y, 0); place(g, b); colorize(g, c); push(rf, g); };
  const glbInst = [];
  for (const b of buildings) {
    if (['house', 'pillar', 'shrine', 'home'].includes(b.kind)) continue;
    if (o.glb) { const pk = o.glb.pick(b); if (pk) { const kit = o.glb.kit(pk); if (kit) { const sx = b.w / kit.size.x; const sz = b.d / kit.size.z; const sm = (sx + sz) / 2; const sy = Math.max(0.75 * sm, Math.min(1.8 * sm, b.h / kit.size.y)); glbInst.push({ b, kit, sx, sy, sz }); b.H = kit.size.y * sy; continue; } } }
    const w = b.w; const d = b.d; const tint = TINT[b.tone % TINT.length]; const k = b.kind;
    const style = k === 'tower' ? 'tower' : k === 'office' ? (b.tone % 3 === 0 ? 'glass' : 'office') : k === 'apt' ? ['apt', 'tile' + (b.tone % 4), 'concrete', 'tile' + ((b.tone + 1) % 4)][b.tone % 4] : k === 'shop' ? (b.tone % 4 === 0 ? 'tile' + (b.tone % 3) : 'tenant') : (k === 'school' || k === 'gym') ? 'school' : (k === 'hq' || k === 'station' || k === 'mall') ? 'office' : 'warehouse';
    const hasGround = ['tower', 'office', 'apt', 'shop', 'hq', 'station', 'mall'].includes(k) && b.h > 9 && w > 8 && d > 8;
    const hb = hasGround ? 4.6 : 0; const nUp = Math.max(1, Math.round((b.h - hb) / FLOOR)); const hUp = nUp * FLOOR; const H = hb + hUp;
    if (hasGround) { const gk = k === 'shop' ? (rnd() < 0.18 ? 'conbini' : 'shop') : (k === 'apt' ? 'garage' : 'lobby'); const arr = gd[gk]; wallBox(arr[Math.floor(rnd() * arr.length)], b, hb, hb / 2, tint, 1 / (hb / 5), 0); }
    const vTiles = nUp / TILE; const vOff = Math.floor(rnd() * TILE) / TILE; wallBox(up[style], b, hUp, hb + hUp / 2, tint, vTiles, vOff);
    roofBox(b, w, d, H + 0.02, '#ffffff');
    plainBox(b, w + 0.7, 0.5, d + 0.7, 0, H - 0.1, 0, '#bdbab2');
    const pc = '#a9a69e'; plainBox(b, w, 0.9, 0.3, 0, H + 0.45, -d / 2 + 0.15, pc); plainBox(b, w, 0.9, 0.3, 0, H + 0.45, d / 2 - 0.15, pc); plainBox(b, 0.3, 0.9, d, -w / 2 + 0.15, H + 0.45, 0, pc); plainBox(b, 0.3, 0.9, d, w / 2 - 0.15, H + 0.45, 0, pc);
    if (hasGround) plainBox(b, w + 0.6, 0.35, d + 0.6, 0, hb + 0.1, 0, '#9c9a94');
    if ((k === 'tower' || k === 'office' || k === 'hq') && w > 10 && d > 10) plainBox(b, Math.min(8, w * 0.4), 4.5, Math.min(8, d * 0.4), 0, H + 2.25, 0, '#8a8d92');
    if (k === 'apt' && w > 9 && d > 9) plainBox(b, 5, H + 1.5, 5, w / 2 - 3, (H + 1.5) / 2, -d / 2 + 3, '#d4d0c6');
    b.H = H;
  }
  const meshes = [];
  { // たてものの 3Dモデル(CC0)を インスタンスで ならべる(160mごとの タイルに わけて、みえない ところは えがかない)
    const tiles = new Map(); const m4 = new THREE.Matrix4(); const T = new THREE.Matrix4(); const Ry = new THREE.Matrix4(); const Sc = new THREE.Matrix4(); const C0 = new THREE.Matrix4();
    for (const it of glbInst) { const k = `${Math.floor(it.b.cx / 160)},${Math.floor(it.b.cz / 160)}`; if (!tiles.has(k)) tiles.set(k, []); tiles.get(k).push(it); }
    for (const list of tiles.values()) { const byKit = new Map(); for (const it of list) { if (!byKit.has(it.kit)) byKit.set(it.kit, []); byKit.get(it.kit).push(it); }
      for (const [kit, items] of byKit) kit.parts.forEach((pt) => { const im = new THREE.InstancedMesh(pt.geo, pt.mat, items.length); items.forEach((it, i) => { T.makeTranslation(it.b.cx, 0, it.b.cz); Ry.makeRotationY(-(it.b.ang || 0) + (it.b.tone % 2 ? Math.PI : 0)); Sc.makeScale(it.sx, it.sy, it.sz); C0.makeTranslation(-kit.center.x, -kit.minY, -kit.center.z); m4.copy(T).multiply(Ry).multiply(Sc).multiply(C0).multiply(pt.m4); im.setMatrixAt(i, m4); }); im.castShadow = !!S; im.receiveShadow = !!S; im.frustumCulled = true; im.computeBoundingSphere && im.computeBoundingSphere(); scene.add(im); meshes.push(im); }); } }
  for (const [mat, list] of parts) {
    let nv = 0; let ni = 0; for (const g of list) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
    const pos = new Float32Array(nv * 3); const nor = new Float32Array(nv * 3); const uvA = new Float32Array(nv * 2); const colA = new Float32Array(nv * 3); const idx = new Uint32Array(ni); let vo = 0; let io = 0;
    for (const g of list) { const n = g.attributes.position.count; pos.set(g.attributes.position.array, vo * 3); nor.set(g.attributes.normal.array, vo * 3); if (g.attributes.uv) uvA.set(g.attributes.uv.array, vo * 2); colA.set(g.attributes.color.array, vo * 3); if (g.index) { for (let i = 0; i < g.index.count; i++) idx[io++] = g.index.array[i] + vo; } else for (let i = 0; i < n; i++) idx[io++] = vo + i; vo += n; g.dispose(); }
    const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); mg.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); mg.setAttribute('uv', new THREE.BufferAttribute(uvA, 2)); mg.setAttribute('color', new THREE.BufferAttribute(colA, 3)); mg.setIndex(new THREE.BufferAttribute(idx, 1)); mg.computeBoundingSphere();
    const m = new THREE.Mesh(mg, mat); m.castShadow = !!S && mat !== rf; m.receiveShadow = !!S; scene.add(m); meshes.push(m);
  }
  return meshes;
}
