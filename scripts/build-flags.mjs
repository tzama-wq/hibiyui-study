// 国旗の SVG(flag-icons / MIT, 4x3)を まとめて data/flags.json に する(1回だけ 実行)。
//   node scripts/build-flags.mjs <flag-icons の 4x3 SVG が はいった フォルダ>
// 国章(こくしょう)が ある おもい 旗は、かんたんな 形に おきかえる(スマホで かるく うごかす ため)。
import { readFile, writeFile } from 'node:fs/promises';
import { COUNTRIES } from './lib/geo-names.mjs';

const dir = process.argv[2];
if (!dir) { console.error('使い方: node scripts/build-flags.mjs <svg フォルダ>'); process.exit(1); }

const A2 = { JPN: 'jp', CHN: 'cn', KOR: 'kr', PRK: 'kp', IND: 'in', THA: 'th', VNM: 'vn', IDN: 'id', PHL: 'ph', MYS: 'my', MNG: 'mn', KAZ: 'kz', PAK: 'pk', BGD: 'bd', NPL: 'np', LAO: 'la', KHM: 'kh', MMR: 'mm', AFG: 'af', IRN: 'ir', IRQ: 'iq', SAU: 'sa', QAT: 'qa', TUR: 'tr', GBR: 'gb', FRA: 'fr', DEU: 'de', ITA: 'it', ESP: 'es', PRT: 'pt', NLD: 'nl', BEL: 'be', CHE: 'ch', AUT: 'at', SWE: 'se', NOR: 'no', FIN: 'fi', DNK: 'dk', ISL: 'is', IRL: 'ie', POL: 'pl', CZE: 'cz', GRC: 'gr', UKR: 'ua', HRV: 'hr', RUS: 'ru', EGY: 'eg', ZAF: 'za', NGA: 'ng', KEN: 'ke', MAR: 'ma', DZA: 'dz', ETH: 'et', TZA: 'tz', GHA: 'gh', SEN: 'sn', CMR: 'cm', MDG: 'mg', USA: 'us', CAN: 'ca', MEX: 'mx', CUB: 'cu', CRI: 'cr', BRA: 'br', ARG: 'ar', CHL: 'cl', PER: 'pe', COL: 'co', ECU: 'ec', URY: 'uy', PRY: 'py', VEN: 've', BOL: 'bo', AUS: 'au', NZL: 'nz' };

// こくしょうが おもい 旗は 手で かんたんに(640x480)
const R = (x, y, w, h, f) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}"/>`;
const C = (x, y, r, f) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${f}"/>`;
const SIMPLE = {
  BOL: R(0, 0, 640, 160, '#d52b1e') + R(0, 160, 640, 160, '#f9e300') + R(0, 320, 640, 160, '#007934') + C(320, 240, 34, '#9c6b30'),
  MEX: R(0, 0, 214, 480, '#006847') + R(214, 0, 213, 480, '#fff') + R(427, 0, 213, 480, '#ce1126') + C(320, 240, 52, '#a9794a') + C(320, 240, 34, '#6b8e3a'),
  ESP: R(0, 0, 640, 480, '#aa151b') + R(0, 120, 640, 240, '#f1bf00') + R(150, 190, 50, 100, '#aa151b'),
  HRV: R(0, 0, 640, 160, '#f00') + R(0, 160, 640, 160, '#fff') + R(0, 320, 640, 160, '#171796') + R(270, 170, 100, 140, '#fff') + R(270, 170, 100, 28, '#f00') + R(270, 226, 100, 28, '#f00') + R(270, 282, 100, 28, '#f00') + R(310, 198, 30, 28, '#f00') + R(280, 254, 30, 28, '#f00') + R(310, 254, 0, 0, '#f00'),
  ECU: R(0, 0, 640, 240, '#ffdd00') + R(0, 240, 640, 120, '#034ea2') + R(0, 360, 640, 120, '#ed1c24') + C(320, 240, 40, '#a9794a'),
  AFG: R(0, 0, 214, 480, '#000') + R(214, 0, 213, 480, '#d32011') + R(427, 0, 213, 480, '#007a36') + C(320, 240, 60, '#fff') + C(320, 240, 42, '#d32011'),
  PRY: R(0, 0, 640, 160, '#d52b1e') + R(0, 160, 640, 160, '#fff') + R(0, 320, 640, 160, '#0038a8') + C(320, 240, 44, '#fff') + C(320, 240, 34, '#4a9a4a'),
  IRN: R(0, 0, 640, 160, '#239f40') + R(0, 160, 640, 160, '#fff') + R(0, 320, 640, 160, '#da0000') + C(320, 240, 40, '#da0000') + C(320, 240, 20, '#fff'),
};

const out = {};
for (const [a3, , , , , , ] of COUNTRIES) {
  const a2 = A2[a3];
  if (!a2) { console.error(`${a3} の コードが ありません`); process.exit(1); }
  let inner;
  if (SIMPLE[a3]) inner = SIMPLE[a3];
  else {
    let s = await readFile(`${dir}/${a2}.svg`, 'utf8');
    inner = s.replace(/<\?xml[^>]*>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
      .replace(/<metadata[\s\S]*?<\/metadata>/g, '').replace(/\s+/g, ' ').replace(/> </g, '><').trim();
    // IDが ほかの 旗と ぶつからない ように 国コードを つける
    inner = inner.replace(/\bid="([^"]+)"/g, `id="${a2}-$1"`).replace(/url\(#([^)]+)\)/g, `url(#${a2}-$1)`).replace(/href="#([^"]+)"/g, `href="#${a2}-$1"`);
  }
  out[a3] = inner;
}
const json = JSON.stringify({ v: 1, flags: out });
await writeFile(new URL('../data/flags.json', import.meta.url), json);
const big = Object.entries(out).sort((a, b) => b[1].length - a[1].length).slice(0, 5).map(([k, v]) => `${k}:${(v.length / 1024).toFixed(0)}KB`).join(' ');
console.log(`data/flags.json: ${Object.keys(out).length}か国 / ${(json.length / 1024).toFixed(0)}KB (おおきい: ${big})`);
