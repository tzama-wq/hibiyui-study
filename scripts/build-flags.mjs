// 国旗の SVG(flag-icons / MIT, 4x3)を まとめて data/flags.json に する(1回だけ 実行)。
//   node scripts/build-flags.mjs <flag-icons の 4x3 SVG が はいった フォルダ>
// 国章(こくしょう)が ある おもい 旗は、かんたんな 形に おきかえる(スマホで かるく うごかす ため)。
import { readFile, writeFile } from 'node:fs/promises';
import { COUNTRIES } from './lib/geo-names.mjs';

const dir = process.argv[2];
if (!dir) { console.error('使い方: node scripts/build-flags.mjs <svg フォルダ>'); process.exit(1); }

const A2 = { JPN: 'jp', CHN: 'cn', KOR: 'kr', PRK: 'kp', IND: 'in', THA: 'th', VNM: 'vn', IDN: 'id', PHL: 'ph', MYS: 'my', MNG: 'mn', KAZ: 'kz', PAK: 'pk', BGD: 'bd', NPL: 'np', LAO: 'la', KHM: 'kh', MMR: 'mm', AFG: 'af', IRN: 'ir', IRQ: 'iq', SAU: 'sa', QAT: 'qa', TUR: 'tr', GBR: 'gb', FRA: 'fr', DEU: 'de', ITA: 'it', ESP: 'es', PRT: 'pt', NLD: 'nl', BEL: 'be', CHE: 'ch', AUT: 'at', SWE: 'se', NOR: 'no', FIN: 'fi', DNK: 'dk', ISL: 'is', IRL: 'ie', POL: 'pl', CZE: 'cz', GRC: 'gr', UKR: 'ua', HRV: 'hr', RUS: 'ru', EGY: 'eg', ZAF: 'za', NGA: 'ng', KEN: 'ke', MAR: 'ma', DZA: 'dz', ETH: 'et', TZA: 'tz', GHA: 'gh', SEN: 'sn', CMR: 'cm', MDG: 'mg', USA: 'us', CAN: 'ca', MEX: 'mx', CUB: 'cu', CRI: 'cr', BRA: 'br', ARG: 'ar', CHL: 'cl', PER: 'pe', COL: 'co', ECU: 'ec', URY: 'uy', PRY: 'py', VEN: 've', BOL: 'bo', AUS: 'au', NZL: 'nz',
  UZB: 'uz', JOR: 'jo', LBN: 'lb', YEM: 'ye', OMN: 'om', ARE: 'ae', KWT: 'kw', TKM: 'tm', AZE: 'az', GEO: 'ge', ARM: 'am', BTN: 'bt', TWN: 'tw', HUN: 'hu', ROU: 'ro', BGR: 'bg', SRB: 'rs', SVK: 'sk', SVN: 'si', LTU: 'lt', LVA: 'lv', EST: 'ee', BLR: 'by', ALB: 'al', BIH: 'ba', MKD: 'mk', LUX: 'lu', CYP: 'cy', TUN: 'tn', LBY: 'ly', SDN: 'sd', UGA: 'ug', COD: 'cd', AGO: 'ao', ZMB: 'zm', ZWE: 'zw', MOZ: 'mz', NAM: 'na', BWA: 'bw', CIV: 'ci', MLI: 'ml', NER: 'ne', TCD: 'td', SOM: 'so', RWA: 'rw', GTM: 'gt', HND: 'hn', NIC: 'ni', PAN: 'pa', DOM: 'do', HTI: 'ht', JAM: 'jm', GUY: 'gy', SUR: 'sr', PNG: 'pg',
  SGP: 'sg', BRN: 'bn', TLS: 'tl', MDV: 'mv', BHR: 'bh', ISR: 'il', SYR: 'sy', PSE: 'ps', LKA: 'lk', KGZ: 'kg', TJK: 'tj', AND: 'ad', MCO: 'mc', SMR: 'sm', LIE: 'li', MLT: 'mt', MDA: 'md', MNE: 'me', VAT: 'va', KOS: 'xk', MRT: 'mr', GMB: 'gm', GIN: 'gn', GNB: 'gw', SLE: 'sl', LBR: 'lr', BFA: 'bf', TGO: 'tg', BEN: 'bj', GNQ: 'gq', GAB: 'ga', COG: 'cg', CAF: 'cf', SSD: 'ss', ERI: 'er', DJI: 'dj', BDI: 'bi', MWI: 'mw', LSO: 'ls', SWZ: 'sz', CPV: 'cv', STP: 'st', COM: 'km', MUS: 'mu', SYC: 'sc', BHS: 'bs', BRB: 'bb', TTO: 'tt', GRD: 'gd', LCA: 'lc', VCT: 'vc', ATG: 'ag', DMA: 'dm', KNA: 'kn', BLZ: 'bz', SLV: 'sv', FJI: 'fj', SLB: 'sb', VUT: 'vu', WSM: 'ws', TON: 'to', KIR: 'ki', TUV: 'tv', NRU: 'nr', PLW: 'pw', MHL: 'mh', FSM: 'fm' };

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
  SRB: R(0, 0, 640, 160, '#c6363c') + R(0, 160, 640, 160, '#0c4076') + R(0, 320, 640, 160, '#fff') + R(130, 120, 90, 150, '#c6363c') + R(140, 130, 70, 100, '#fff'),
  DOM: R(0, 0, 640, 480, '#fff') + R(0, 0, 270, 200, '#002d62') + R(370, 0, 270, 200, '#ce1126') + R(0, 280, 270, 200, '#ce1126') + R(370, 280, 270, 200, '#002d62') + C(320, 240, 34, '#6aa84f'),
  TKM: R(0, 0, 640, 480, '#00843d') + R(70, 0, 110, 480, '#d22630') + R(95, 60, 60, 60, '#fff') + R(95, 180, 60, 60, '#f5a623') + R(95, 300, 60, 60, '#fff') + C(330, 90, 30, '#fff'),
  GTM: R(0, 0, 213, 480, '#4997d0') + R(213, 0, 214, 480, '#fff') + R(427, 0, 213, 480, '#4997d0') + C(320, 240, 52, '#9ab36c'),
  BTN: '<path fill="#ffd520" d="M0 0h640v480z"/><path fill="#ff4e12" d="M640 480V0L0 480z"/>' + C(320, 240, 70, '#fff'),
  OMN: R(0, 0, 640, 160, '#fff') + R(0, 160, 640, 160, '#db161b') + R(0, 320, 640, 160, '#008000') + R(0, 0, 190, 480, '#db161b') + C(95, 80, 36, '#fff'),
  NIC: R(0, 0, 640, 480, '#fff') + R(0, 0, 640, 160, '#0067c6') + R(0, 320, 640, 160, '#0067c6') + C(320, 240, 44, '#8fbf6a'),
  HTI: R(0, 0, 640, 240, '#00209f') + R(0, 240, 640, 240, '#d21034') + R(240, 170, 160, 140, '#fff'),
  ALB: R(0, 0, 640, 480, '#e41e20') + R(190, 110, 260, 260, '#000'),
  BIH: R(0, 0, 640, 480, '#002395') + '<path fill="#fecb00" d="M180 0h330v480z"/>',
  SLV: R(0, 0, 640, 160, '#0f47af') + R(0, 160, 640, 160, '#fff') + R(0, 320, 640, 160, '#0f47af') + C(320, 240, 44, '#c8a24a'),
  MNE: R(0, 0, 640, 480, '#d3ae3b') + R(24, 24, 592, 432, '#c40308') + C(320, 240, 60, '#d3ae3b'),
  BLZ: R(0, 0, 640, 480, '#003f87') + R(0, 0, 640, 60, '#ce1126') + R(0, 420, 640, 60, '#ce1126') + C(320, 240, 150, '#fff') + C(320, 240, 120, '#4aa14a'),
  AND: R(0, 0, 213, 480, '#10069f') + R(213, 0, 214, 480, '#fedd00') + R(427, 0, 213, 480, '#d50032') + R(285, 190, 70, 100, '#c8a24a'),
  VAT: R(0, 0, 320, 480, '#ffe000') + R(320, 0, 320, 480, '#fff') + R(420, 130, 24, 200, '#c8a24a') + R(470, 130, 24, 200, '#999'),
  FJI: R(0, 0, 640, 480, '#68bfe5') + R(0, 0, 320, 240, '#012169') + R(0, 100, 320, 40, '#fff') + R(140, 0, 40, 240, '#fff') + R(0, 108, 320, 24, '#c8102e') + R(148, 0, 24, 240, '#c8102e'),
  DMA: R(0, 0, 640, 480, '#006b3f') + R(250, 0, 140, 480, '#fcd116') + R(0, 170, 640, 140, '#fcd116') + C(320, 240, 120, '#d41c30'),
  SMR: R(0, 0, 640, 240, '#fff') + R(0, 240, 640, 240, '#5eb6e4') + C(320, 240, 60, '#c8a24a'),
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
