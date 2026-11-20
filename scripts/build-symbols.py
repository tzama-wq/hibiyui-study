"""OpenStreetMap から 地図記号の いち(学校・郵便局・病院・交番・寺・神社…)を あつめて symbols-data.js に かく。
  使いかた:  python scripts/build-symbols.py
  データ出典: © OpenStreetMap contributors (ODbL)
"""
import json, math, os, subprocess, tempfile

LAT0, LON0, HALF = 35.5345, 139.6405, 800.0
KM_LAT = 111320.0
KM_LON = 111320.0 * math.cos(math.radians(LAT0))
BBOX = '(35.5255,139.6295,35.5435,139.6515)'
Q = f'''[out:json][timeout:90];
(
 nwr["amenity"~"^(school|kindergarten|hospital|clinic|post_office|police|fire_station|townhall|library|place_of_worship|bank|college|university)$"]{BBOX};
 nwr["office"="government"]{BBOX};
 nwr["man_made"="works"]{BBOX};
 nwr["shop"="supermarket"]{BBOX};
);
out center tags;'''


def xz(lat, lon):
    return (-(lon - LON0) * KM_LON, (lat - LAT0) * KM_LAT)


def kind(t):
    a = t.get('amenity')
    if a in ('school', 'college', 'university'): return 'school'
    if a == 'kindergarten': return 'kinder'
    if a in ('hospital', 'clinic'): return 'hospital'
    if a == 'post_office': return 'post'
    if a == 'police': return 'police'
    if a == 'fire_station': return 'fire'
    if a == 'townhall' or t.get('office') == 'government': return 'hall'
    if a == 'library': return 'library'
    if a == 'bank': return 'bank'
    if a == 'place_of_worship':
        r = t.get('religion')
        return 'temple' if r == 'buddhist' else 'shrine' if r == 'shinto' else 'church' if r == 'christian' else None
    if t.get('man_made') == 'works': return 'factory'
    if t.get('shop') == 'supermarket': return 'super'
    return None


def main():
    tmp = tempfile.mkdtemp(prefix='sym_')
    qf = os.path.join(tmp, 'q.txt'); open(qf, 'w', encoding='utf-8').write(Q)
    out = os.path.join(tmp, 'o.json')
    for url in ('https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'):
        subprocess.run(['curl', '-s', '-m', '100', '-A', 'hibiyui-citymap/1.0', '--data-urlencode', f'data@{qf}', url, '-o', out], check=False)
        try:
            d = json.load(open(out, encoding='utf-8')); break
        except Exception:
            d = None
    if not d: raise SystemExit('overpass failed')
    items = []; seen = set()
    for e in d['elements']:
        t = e.get('tags', {}); k = kind(t)
        if not k: continue
        c = e.get('center') or {'lat': e.get('lat'), 'lon': e.get('lon')}
        if c['lat'] is None: continue
        x, z = xz(c['lat'], c['lon'])
        if abs(x) > HALF + 30 or abs(z) > HALF + 30: continue
        key = (k, round(x / 12), round(z / 12))
        if key in seen: continue
        seen.add(key)
        nm = (t.get('name:ja') or t.get('name') or '').replace('"', '')[:14]
        items.append([k, round(x, 1), round(z, 1), nm])
    with open(os.path.join(os.path.dirname(__file__), '..', 'symbols-data.js'), 'w', encoding='utf-8') as f:
        f.write('// OpenStreetMap(© OpenStreetMap contributors, ODbL)から scripts/build-symbols.py で作成した 地図記号の いち [しゅるい, x, z, なまえ]\n')
        f.write('export const SYMBOLS = ' + json.dumps(items, ensure_ascii=False) + ';\n')
    print('symbols', len(items))


main()
