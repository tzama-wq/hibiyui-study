# OpenStreetMap(c) の ちずデータ(Overpass で とった json)を シティの ゲームデータ citymap-data.js に へんかんする。
#   python scripts/build-citymap.py <osm-dir>   (osm-dir には roads.json bld.json water.json misc.json)
#   データ: © OpenStreetMap contributors (ODbL)
import json, math, os, random, sys

D = sys.argv[1] if len(sys.argv) > 1 else '.'
LAT0, LON0, HALF = 35.5345, 139.6405, 800.0
KM_LAT = 111320.0
KM_LON = 111320.0 * math.cos(math.radians(LAT0))
rnd = random.Random(7)

def xz(lat, lon):
    return ((lon - LON0) * KM_LON, (lat - LAT0) * KM_LAT)

def load(n):
    try:
        return json.load(open(os.path.join(D, n), encoding='utf-8'))['elements']
    except Exception as e:
        print('missing', n, e); return []

def geom(e):
    return [xz(p['lat'], p['lon']) for p in e.get('geometry', [])]

def dp(pts, tol):
    if len(pts) < 3: return pts
    def rec(a, b):
        ax, az = pts[a]; bx, bz = pts[b]; dx = bx - ax; dz = bz - az; L = dx * dx + dz * dz; md = 0; mi = -1
        for i in range(a + 1, b):
            px, pz = pts[i]
            d = math.hypot(px - ax, pz - az) if L == 0 else abs((px - ax) * dz - (pz - az) * dx) / math.sqrt(L)
            if d > md: md = d; mi = i
        if md > tol: return rec(a, mi)[:-1] + rec(mi, b)
        return [pts[a], pts[b]]
    return rec(0, len(pts) - 1)

def hull(points):
    pts = sorted(set(points))
    if len(pts) < 3: return pts
    def cross(o, a, b): return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo = []
    for p in pts:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 0: lo.pop()
        lo.append(p)
    up = []
    for p in reversed(pts):
        while len(up) >= 2 and cross(up[-2], up[-1], p) <= 0: up.pop()
        up.append(p)
    return lo[:-1] + up[:-1]

def obb(poly):
    h = hull(poly)
    if len(h) < 3: return None
    best = None
    for i in range(len(h)):
        a = h[i]; b = h[(i + 1) % len(h)]; ang = math.atan2(b[1] - a[1], b[0] - a[0]); c = math.cos(-ang); s = math.sin(-ang)
        xs = []; zs = []
        for p in h:
            xs.append(p[0] * c - p[1] * s); zs.append(p[0] * s + p[1] * c)
        w = max(xs) - min(xs); d = max(zs) - min(zs); ar = w * d
        if best is None or ar < best[0]:
            cx = (max(xs) + min(xs)) / 2; cz = (max(zs) + min(zs)) / 2
            # さかさに もどして ちゅうしん
            ux = cx * math.cos(ang) - cz * math.sin(ang); uz = cx * math.sin(ang) + cz * math.cos(ang)
            best = (ar, ux, uz, w, d, ang)
    return best

def poly_area(p):
    a = 0
    for i in range(len(p)): a += p[i][0] * p[(i + 1) % len(p)][1] - p[(i + 1) % len(p)][0] * p[i][1]
    return abs(a) / 2

def inb(x, z, m=0): return abs(x) <= HALF + m and abs(z) <= HALF + m

out = {'center': [LAT0, LON0], 'half': HALF}
# ---- みち
CLS = {'motorway': 4, 'trunk': 4, 'primary': 4, 'secondary': 3, 'tertiary': 2, 'unclassified': 1, 'residential': 1, 'living_street': 0, 'service': 0, 'motorway_link': 3, 'trunk_link': 3, 'primary_link': 3, 'secondary_link': 2, 'tertiary_link': 2, 'road': 1}
roads = []
for e in load('roads.json'):
    t = e.get('tags', {}); hw = t.get('highway'); c = CLS.get(hw)
    if c is None or t.get('tunnel') in ('yes', 'building_passage', 'culvert') or t.get('area') == 'yes': continue
    if hw == 'service' and t.get('service') in ('parking_aisle', 'driveway', 'drive-through'): continue
    p = geom(e)
    if len(p) < 2: continue
    p = dp(p, 1.2)
    if not any(inb(x, z, 40) for x, z in p): continue
    br = 1 if t.get('bridge') in ('yes', 'viaduct', 'movable') else 0
    roads.append((c, br, p, t.get('name', '')))
out['roads'] = [[c, br, [round(v, 1) for q in p for v in q]] for c, br, p, _ in roads]
# ---- みず(かわ・いけ)
rivers = []; ponds = []
for e in load('water.json'):
    t = e.get('tags', {})
    if e['type'] == 'way':
        p = geom(e)
        if t.get('waterway') in ('river', 'canal', 'stream') and len(p) >= 2:
            if t.get('waterway') == 'river' or t.get('waterway') == 'canal': rivers.append(dp(p, 2.0))
        elif len(p) >= 4 and p[0] == p[-1] and (t.get('natural') == 'water' or t.get('waterway') == 'riverbank' or t.get('landuse') == 'riverbank'):
            ponds.append(dp(p, 2.0))
    elif e['type'] == 'relation':
        for m in e.get('members', []):
            if m.get('role') == 'outer' and m.get('geometry'):
                p = [xz(q['lat'], q['lon']) for q in m['geometry']]
                if len(p) >= 4 and p[0] == p[-1]: ponds.append(dp(p, 2.0))
                elif len(p) >= 2: ponds.append(('open', dp(p, 2.0)))
out['rivers'] = [[round(v, 1) for q in p for v in q] for p in rivers]
out['ponds'] = [[round(v, 1) for q in p for v in q] for p in ponds if not (isinstance(p, tuple))]
out['pondEdges'] = [[round(v, 1) for q in p[1] for v in q] for p in ponds if isinstance(p, tuple)]
# ---- てつどう・みどり・しせつ
rails = []; greens = []; pitches = []; pois = {}; schools = []; stations = []; malls = []
for e in load('misc.json'):
    t = e.get('tags', {}); nm = t.get('name', '')
    if e['type'] == 'node':
        x, z = xz(e['lat'], e['lon'])
        if t.get('railway') == 'station': stations.append((nm, x, z))
        elif t.get('shop') in ('mall', 'supermarket'): malls.append((nm, x, z))
        continue
    p = geom(e)
    if len(p) < 2: continue
    if 'railway' in t:
        if t.get('tunnel') == 'yes' or t.get('railway') == 'subway' and t.get('tunnel') != 'no': continue
        shin = ('新幹線' in nm) or t.get('highspeed') == 'yes' or t.get('railway:track_ref') == 'shin'
        rails.append((1 if shin else 0, dp(p, 2.0)))
    elif t.get('leisure') in ('pitch', 'sports_centre') and p[0] == p[-1]:
        pitches.append(dp(p, 1.0))
    elif p[0] == p[-1] and len(p) >= 4 and (t.get('leisure') in ('park', 'garden', 'playground') or t.get('landuse') in ('grass', 'recreation_ground', 'cemetery', 'forest', 'meadow', 'farmland') or t.get('natural') in ('wood', 'scrub', 'grassland')):
        greens.append((nm, dp(p, 1.5), t.get('leisure') or t.get('landuse') or t.get('natural')))
        if '綱島東三丁目公園' in nm: pois['park3'] = {'poly': [[round(a, 1), round(b, 1)] for a, b in dp(p, 1.0)]}
    elif t.get('amenity') == 'school' and p[0] == p[-1]:
        schools.append((nm, dp(p, 1.0)))
        if '綱島東小学校' in nm: pois['school'] = {'poly': [[round(a, 1), round(b, 1)] for a, b in dp(p, 1.0)]}
    elif t.get('amenity') == 'place_of_worship' and p[0] == p[-1]:
        c = obb(p)
        if c: pois.setdefault('shrines', []).append([round(c[1], 1), round(c[2], 1)])
    elif t.get('amenity') == 'parking' and p[0] == p[-1]:
        out.setdefault('parking', []).append([round(v, 1) for q in dp(p, 1.0) for v in q])
def chain(ways):
    ways = [list(w) for w in ways]; best = []
    while ways:
        cur = ways.pop(0); grew = True
        while grew:
            grew = False
            for i, w in enumerate(ways):
                if math.hypot(cur[-1][0] - w[0][0], cur[-1][1] - w[0][1]) < 8: cur = cur + w[1:]; ways.pop(i); grew = True; break
                if math.hypot(cur[-1][0] - w[-1][0], cur[-1][1] - w[-1][1]) < 8: cur = cur + list(reversed(w))[1:]; ways.pop(i); grew = True; break
                if math.hypot(cur[0][0] - w[-1][0], cur[0][1] - w[-1][1]) < 8: cur = w[:-1] + cur; ways.pop(i); grew = True; break
                if math.hypot(cur[0][0] - w[0][0], cur[0][1] - w[0][1]) < 8: cur = list(reversed(w))[:-1] + cur; ways.pop(i); grew = True; break
        if len(cur) > len(best): best = cur
    return best
def pick(kind, a, b):
    for k, w in rails:
        if k != kind: continue
        for ww in (w, list(reversed(w))):
            if math.hypot(ww[0][0] - a[0], ww[0][1] - a[1]) < 25 and math.hypot(ww[-1][0] - b[0], ww[-1][1] - b[1]) < 25: return ww
    return []
def join(parts):
    res = []
    for w in parts:
        res += w if not res else w[1:]
    return res
rails2 = {}
tk = join([pick(0, (-780, -674), (-602, -188)), pick(0, (-602, -188), (-602, 18)), pick(0, (-602, 18), (-602, 43)), pick(0, (-602, 43), (-450, 361)), pick(0, (-450, 361), (-387, 449)), pick(0, (-387, 449), (457, 1736))])
sh = join([pick(1, (-399, -883), (-135, -429)), pick(1, (-135, -429), (118, -2)), pick(1, (118, -2), (946, 1458))])
for key, ch in (('toyoko', tk), ('shin', sh)):
    ch = dp(ch, 3.0)
    rails2[key] = [round(v, 1) for q in ch for v in q]
out['rails'] = rails2
out['greens'] = [[[round(v, 1) for q in p for v in q], kind] for nm, p, kind in greens]
out['pitches'] = [[round(v, 1) for q in p for v in q] for p in pitches]
for nm, x, z in stations:
    if nm == '新綱島': pois['shinTsunashima'] = [round(x, 1), round(z, 1)]
    if nm == '綱島': pois['tsunashima'] = [round(x, 1), round(z, 1)]
# はし(なまえで さがす)
for c, br, p, nm in roads:
    if br and nm in ('大綱橋', '樽綱橋'):
        mx = sum(a for a, b in p) / len(p); mz = sum(b for a, b in p) / len(p); pois['ootsuna' if nm == '大綱橋' else 'tarutsuna'] = [round(mx, 1), round(mz, 1)]
for k in ('park3', 'school'):
    if k in pois:
        poly = pois[k]['poly']; pois[k]['c'] = [round(sum(a for a, b in poly) / len(poly), 1), round(sum(b for a, b in poly) / len(poly), 1)]
out['pois'] = pois
out['malls'] = [[x, z] for nm, x, z in malls if inb(x, z)]
# ---- たてもの(いちばん ちいさい かたむいた ちょうほうけい)
HOUSE = {'house', 'detached', 'semidetached_house', 'terrace', 'residential', 'bungalow', 'cabin', 'farm', 'dormitory_house'}
SKIP = {'shed', 'garage', 'garages', 'carport', 'roof', 'hut', 'service', 'kiosk', 'toilets', 'greenhouse', 'container', 'ruins', 'construction', 'transformer_tower', 'static_caravan', 'boathouse', 'bunker', 'stable', 'barn', 'cowshed', 'silo', 'tank', 'allotment_house', 'houseboat'}
blds = []
for e in load('bld.json'):
    t = e.get('tags', {}); b = t.get('building')
    if b in SKIP: continue
    p = geom(e)
    if len(p) < 4: continue
    if not any(inb(x, z, 30) for x, z in p): continue
    area = poly_area(p)
    if area < 14: continue
    o = obb(p)
    if o is None: continue
    _, cx, cz, w, d, ang = o
    if w < 2.5 or d < 2.5: continue
    # たかさ
    h = None
    try:
        if 'height' in t: h = float(str(t['height']).replace('m', '').strip())
        elif 'building:levels' in t: h = float(t['building:levels']) * 3.3 + 1.0
    except Exception: h = None
    kind = 'house' if b in HOUSE else 'apt' if b in ('apartments', 'dormitory') else 'shop' if b in ('commercial', 'retail', 'supermarket', 'kiosk') else 'office' if b in ('office', 'hotel') else 'school' if b in ('school', 'university', 'college', 'kindergarten', 'public', 'civic', 'government', 'hospital') else 'warehouse' if b in ('industrial', 'warehouse', 'factory', 'manufacture', 'storage_tank') else None
    if kind is None:
        kind = 'house' if area < 170 else ('apt' if area < 500 else 'office' if area < 1400 else 'warehouse')
    if h is None:
        h = rnd.uniform(6.2, 8.8) if kind == 'house' else rnd.uniform(12, 30) if kind in ('apt', 'shop') else rnd.uniform(14, 40) if kind == 'office' else rnd.uniform(9, 16) if kind == 'warehouse' else rnd.uniform(11, 15)
    if kind == 'house': h = min(h, 10)
    if kind == 'shop' and h > 10: kind = 'shop'
    blds.append([round(cx, 1), round(cz, 1), round(w, 1), round(d, 1), round(ang, 2), round(h, 1), {'house': 0, 'apt': 1, 'shop': 2, 'office': 3, 'school': 4, 'warehouse': 5}[kind]])
out['buildings'] = blds
print('roads', len(out['roads']), 'rivers', len(rivers), 'ponds', len(out['ponds']), 'rails', len(rails), 'greens', len(greens), 'buildings', len(blds), 'pois', list(pois))
js = '// OpenStreetMap(c) の データから つくった シティの ちず(scripts/build-citymap.py)。© OpenStreetMap contributors (ODbL)\nexport const MAP = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n'
open('citymap-data.js', 'w', encoding='utf-8').write(js)
print('wrote citymap-data.js', round(len(js) / 1024), 'KB')
