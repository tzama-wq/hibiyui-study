# OpenStreetMap(c) の データから シティの ちずを つくる(1かい だけ はしらせる。けっかは data/city-map.json に ほぞん)。
#   python scripts/import-osm.py [緯度 経度 はんぶんの みちのり(m)]
#   データ: © OpenStreetMap contributors (ODbL)。まちの なまえは ゲームの がめんには でない。
import json, math, sys, time, urllib.parse, urllib.request

LAT0 = float(sys.argv[1]) if len(sys.argv) > 1 else 35.5395
LON0 = float(sys.argv[2]) if len(sys.argv) > 2 else 139.6300
HALF = float(sys.argv[3]) if len(sys.argv) > 3 else 1000.0
KM_LAT = 111320.0
KM_LON = 111320.0 * math.cos(math.radians(LAT0))
dlat = HALF / KM_LAT * 1.02
dlon = HALF / KM_LON * 1.02
BBOX = f'{LAT0 - dlat},{LON0 - dlon},{LAT0 + dlat},{LON0 + dlon}'

def xz(lat, lon):  # x=ひがし, z=きた(メートル)
    return ((lon - LON0) * KM_LON, (lat - LAT0) * KM_LAT)

QUERY = f'''[out:json][timeout:90][bbox:{BBOX}];
(way["highway"]["highway"!~"footway|path|steps|cycleway|pedestrian|track|bus_guideway|construction|proposed"];
 way["building"];
 way["waterway"~"river|riverbank|canal"]; way["natural"="water"]; way["landuse"="riverbank"];
 way["railway"~"rail|subway|light_rail|narrow_gauge"]["tunnel"!="yes"];
 way["leisure"~"park|pitch|playground|stadium|sports_centre"]; way["landuse"~"grass|recreation_ground|cemetery"];
 way["amenity"~"school|university|college|kindergarten|place_of_worship|parking"];
 way["shop"="mall"]; way["building"="retail"];
 node["railway"="station"]; node["amenity"~"school|place_of_worship"]; node["shop"~"mall|supermarket|convenience"]; node["leisure"="park"];
);
out geom tags;'''
SERVERS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']
raw = None
for url in SERVERS:
    try:
        t = time.time()
        req = urllib.request.Request(url, data=urllib.parse.urlencode({'data': QUERY}).encode(), headers={'User-Agent': 'hibiyui-city-map-import/1.0'})
        raw = json.loads(urllib.request.urlopen(req, timeout=120).read().decode())
        print('ok', url, len(raw['elements']), 'elements', round(time.time() - t), 's')
        break
    except Exception as ex:
        print('NG', url, ex)
if raw is None:
    sys.exit(1)
json.dump(raw, open('scripts/.osm-raw.json', 'w', encoding='utf-8'))
print('saved raw')
