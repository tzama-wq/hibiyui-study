import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerGeo, byId, makeQuestion, makeProbe, unitsOf } from '../gen.js';
import { PREFS, COUNTRIES } from '../scripts/lib/geo-names.mjs';

const geo = JSON.parse(readFileSync(new URL('../data/geo.json', import.meta.url), 'utf8'));
assert.equal(Object.keys(geo.pref).length, 47); assert.equal(Object.keys(geo.world).length, COUNTRIES.length);
assert.equal(PREFS.length, 47); assert.equal(new Set(PREFS.map((p) => p[1])).size, 47);
for (const o of [...Object.values(geo.pref), ...Object.values(geo.world)]) {
  assert.ok(o.d.startsWith('M') && o.d.length > 30, `${o.n}: かたちが ある`);
  assert.ok(o.w > 0 && o.h > 0 && Math.max(o.w, o.h) === 200 || Math.max(o.w, o.h) >= 199, `${o.n}: サイズ`);
  assert.ok(/^[Mlz0-9 -]+$/.test(o.d), `${o.n}: パスの もじ`);
}

const flags = JSON.parse(readFileSync(new URL('../data/flags.json', import.meta.url), 'utf8'));
assert.equal(Object.keys(flags.flags).length, COUNTRIES.length);
assert.ok(Object.values(flags.flags).every((s) => s.includes('<') && s.length > 80 && s.length < 20000), '国旗の サイズ');
registerGeo(geo, flags); registerGeo(geo, flags); // 2回よんでも ふえない
const ids = ['geo_pref', 'geo_world', 'geo_pref_e', 'geo_world_e', 'flag_world', 'flag_world_e'];
const units = ids.map((id) => byId[id]);
assert.ok(units.every(Boolean));
const nEasyPref = PREFS.filter((p) => p[6]).length;
assert.equal(byId.geo_pref.items.length, 47 * 7, 'とい7しゅるい');
assert.equal(byId.geo_world.items.length, COUNTRIES.length * 6);
assert.equal(byId.flag_world.items.length, COUNTRIES.length * 5);
assert.equal(COUNTRIES.length, 197, '197か国');
assert.equal(byId.geo_pref_e.items.length, nEasyPref * 2, 'かんたん版は 2しゅるい');
assert.equal(byId.flag_world_e.items.length, COUNTRIES.length * 5, 'こっきは ゆいとも ぜんぶ(197か国・5しゅるい)');
assert.ok(unitsOf(2).some((u) => u.id === 'geo_pref_e') && unitsOf(4).some((u) => u.id === 'geo_world'));
assert.ok(!unitsOf(4).some((u) => u.id === 'geo_pref_e'), '小4に かんたん版は ださない');

const strip = (t) => t.replace(/<[^>]*>/g, '');
for (const u of units) {
  const kinds = new Set();
  for (const it of u.items) {
    for (let t = 0; t < 4; t++) {
      const q = makeProbe(u, { itemId: it.id });
      assert.equal(q.choices.length, 4, `${u.id} ${it.hlabel}`); assert.equal(q.choices.filter((c) => c.ok).length, 1);
      assert.equal(new Set(q.choices.map((c) => c.label)).size, 4, `${it.hlabel}: せんたくしが かぶらない`);
      assert.ok(q.choices.every((c) => c.ok || (c.tag === 'know_mixup' && c.note)));
      assert.ok(q.why.length > 5 && q.hlabel);
      // かたち・はたが ひつような ところに ある(もんだいに あるか、せんたくしに ある)
      const inQ = /<svg[^>]*><(path|g|rect)/.test(q.text) || /<svg/.test(q.text);
      const inC = q.choices.every((c) => c.label.includes('<svg'));
      if (it.svg || it.raw) assert.ok(inQ || inC, `${u.id}: ${strip(q.text)} に えが ない`); else assert.ok(!inQ && !inC, '文字だけの もんだい');
      if (inC) assert.ok(!/<svg/.test(q.text), 'えらびかたが えの ときは もんだいに えは ださない');
      kinds.add(`${inQ ? 'Q' : ''}${inC ? 'C' : ''}${strip(q.text).slice(0, 6)}`);
    }
  }
  assert.ok(kinds.size >= (u.id.endsWith('_e') ? 2 : 4), `${u.id}: といかたが ふえた(${[...kinds].join('|')})`);
  assert.ok(makeQuestion(u).choices.length === 4);
}
// 同じ ぎょうの もんだいが 同じに ならない(7日ぶん ひいても かぶりにくい)
for (const id of ['geo_pref', 'geo_world', 'flag_world']) {
  const u = byId[id]; const texts = new Set(); for (let i = 0; i < 300; i++) texts.add(strip(makeQuestion(u).text) + '|' + (u.items.length));
  assert.ok(texts.size >= 4, id);
  const seen = new Set(); for (let i = 0; i < 60; i++) seen.add(makeQuestion(u).id);
  assert.ok(seen.size >= 40, `${id}: 60もんで ${seen.size}しゅるい`);
}
// 小2用は ふりがな ぜんぶ(県も)、小4用は 県だけ ふりがな なし
const first = (u, label) => u.items.find((i) => i.hlabel === label && !i.raw && i.svg);
const kana = (u, name) => makeProbe(u, { itemId: first(u, `${name}の かたち`).id }).choices.find((c) => c.ok).label;
assert.equal(kana(byId.geo_pref, '神奈川県'), '<ruby>神奈川<rt>かながわ</rt></ruby>県');
assert.equal(kana(byId.geo_pref_e, '神奈川県'), '<ruby>神奈川県<rt>かながわけん</rt></ruby>');
assert.equal(kana(byId.geo_world, 'アメリカ'), 'アメリカ');
// 近い ところが まざる(九州の かたちには 九州の ほかの県が でやすい)
let near = 0;
for (let i = 0; i < 60; i++) { const q = makeProbe(byId.geo_pref, { itemId: first(byId.geo_pref, '熊本県の かたち').id }); near += q.choices.filter((c) => !c.ok && /福岡|佐賀|長崎|大分|宮崎|鹿児島|沖縄/.test(strip(c.label))).length; }
assert.ok(near / 60 >= 1.9, '同じ地方から 2つは まざる');
// ちほう・たいりく・しゅとの もんだい
{
  const find = (u, re) => u.items.find((i) => re.test(i.q));
  const reg = makeProbe(byId.geo_pref, { itemId: find(byId.geo_pref, /どの 地方/).id });
  assert.equal(reg.choices.length, 4); assert.ok(reg.choices.some((c) => c.ok));
  const cap = makeProbe(byId.geo_pref, { itemId: byId.geo_pref.items.find((i) => /^.*は どの 都道府県の/.test(i.q) && i.hlabel === '神奈川県の けんちょうしょざいち').id });
  assert.match(strip(cap.text), /横浜.*どの 都道府県/); assert.match(strip(cap.choices.find((c) => c.ok).label), /神奈川/);
  const cont = makeProbe(byId.flag_world, { itemId: byId.flag_world.items.find((i) => /たいりく/.test(i.q) && i.hlabel === 'ブラジルの たいりく').id });
  assert.match(strip(cont.choices.find((c) => c.ok).label), /南.*アメリカ/);
  const rev = makeProbe(byId.flag_world, { itemId: byId.flag_world.items.find((i) => i.raw && i.hlabel === '日本の はた').id });
  assert.ok(rev.choices.every((c) => c.label.includes('class="flag mini"')) && /「.*日本.*」の はたは どれ/.test(strip(rev.text)));
}
assert.ok(Object.values(flags.flags).length === COUNTRIES.length);
// 「〇〇の くには どれ?」は まちがいが 同じ グループに ならない
{
  const world = Object.fromEntries(Object.values(geo.world).map((o) => [o.n, o]));
  const prefs = Object.fromEntries(Object.values(geo.pref).map((o) => [o.n, o]));
  const nameOf = (label) => strip(label).replace(/\s+/g, '');
  const check = (u, rows, key, re) => {
    for (const it of u.items.filter((i) => re.test(i.q))) {
      const q = makeProbe(u, { itemId: it.id }); const ent = rows[it.ent];
      for (const c of q.choices.filter((x) => !x.ok)) {
        const bare = c.label.replace(/<rt>.*?<\/rt>/g, '').replace(/<[^>]*>/g, '');
        const other = Object.values(rows).find((o) => o.n === bare || (o.n.length > 1 && /[県府都道]$/.test(o.n) && bare === o.n));
        if (other && !c.label.includes('<svg')) assert.notEqual(other[key], ent[key], `${it.ent}: まちがいに おなじ グループ ${other.n}`);
      }
    }
  };
  check(byId.geo_world, world, 'k', /に ある くには どれ/);
  check(byId.geo_pref, prefs, 'r', /ちほうに ある 県は どれ/);
  // はたの 「たいりく」: 旗の 絵が 4つとも ちがう たいりく
  const fl = makeProbe(byId.flag_world, { itemId: byId.flag_world.items.find((i) => /の くにの はたは どれ/.test(i.q) && i.hlabel === 'ブラジルの たいりく').id });
  assert.equal(fl.choices.length, 4);
}
// おなじ 県・国が つづけて でない(40もん ひいて、3もん いない に 同じ県が 出ない)
for (const id of ['geo_pref', 'geo_world', 'flag_world']) {
  const u = byId[id]; const ents = [];
  for (let i = 0; i < 80; i++) { const q = makeQuestion(u); ents.push(u.items.find((x) => x.id === q.id).ent); }
  for (let i = 0; i < ents.length; i++) for (let j = Math.max(0, i - 3); j < i; j++) assert.notEqual(ents[i], ents[j], `${id}: ${ents[i]} が ちかくで くりかえし`);
}
console.log('OK: geo');
