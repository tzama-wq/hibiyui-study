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
const units = ['geo_pref', 'geo_world', 'geo_pref_e', 'geo_world_e'].map((id) => byId[id]);
assert.ok(units.every(Boolean));
assert.equal(units[0].items.length, 47); assert.equal(units[1].items.length, COUNTRIES.length);
assert.equal(units[2].items.length, PREFS.filter((p) => p[6]).length);
assert.ok(unitsOf(2).some((u) => u.id === 'geo_pref_e') && unitsOf(4).some((u) => u.id === 'geo_world'));
assert.ok(!unitsOf(4).some((u) => u.id === 'geo_pref_e'), '小4に かんたん版は ださない');

for (const u of units) {
  for (const it of u.items) {
    for (let t = 0; t < 6; t++) {
      const q = makeProbe(u, { itemId: it.id });
      assert.equal(q.choices.length, 4, u.id); assert.equal(q.choices.filter((c) => c.ok).length, 1);
      assert.equal(new Set(q.choices.map((c) => c.label)).size, 4, `${it.hlabel}: せんたくしが かぶらない`);
      assert.ok(q.text.includes('<svg') && q.text.includes('<path'), 'かたちが ある');
      assert.ok(q.hlabel && q.hlabel.endsWith('の かたち'));
      assert.ok(q.choices.every((c) => c.ok || (c.tag === 'know_mixup' && c.note)));
      assert.ok(q.why.length > 5);
    }
  }
  assert.ok(makeQuestion(u).choices.length === 4);
}
// 小2用は ふりがな ぜんぶ(県も)、小4用は 県だけ ふりがな なし
const kana = (u, name) => makeProbe(u, { itemId: u.items.find((i) => i.hlabel === `${name}の かたち`).id }).choices.find((c) => c.ok).label;
assert.equal(kana(byId.geo_pref, '神奈川県'), '<ruby>神奈川<rt>かながわ</rt></ruby>県');
assert.equal(kana(byId.geo_pref_e, '神奈川県'), '<ruby>神奈川県<rt>かながわけん</rt></ruby>');
assert.equal(kana(byId.geo_world, 'アメリカ'), 'アメリカ');
// 近い ところが まざる(九州の かたちには 九州の ほかの県が でやすい)
let near = 0;
for (let i = 0; i < 60; i++) { const q = makeProbe(byId.geo_pref, { itemId: byId.geo_pref.items.find((x) => x.hlabel.startsWith('熊本')).id }); near += q.choices.filter((c) => !c.ok && /福岡|佐賀|長崎|大分|宮崎|鹿児島|沖縄/.test(c.label.replace(/<[^>]*>/g, ''))).length; }
assert.ok(near / 60 >= 1.9, '同じ地方から 2つは まざる');
// こっきクイズ
for (const id of ['flag_world', 'flag_world_e']) {
  const u = byId[id]; assert.ok(u, id);
  for (const it of u.items) {
    const q = makeProbe(u, { itemId: it.id });
    assert.ok(q.text.includes('class="flag"') && q.text.includes('はた'), 'はたが ある');
    assert.equal(q.choices.length, 4); assert.equal(new Set(q.choices.map((c) => c.label)).size, 4);
    assert.ok(q.hlabel.endsWith('の はた'));
  }
}
assert.equal(byId.flag_world.items.length, COUNTRIES.length);
console.log('OK: geo');
