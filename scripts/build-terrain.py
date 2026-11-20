"""国土地理院の標高タイル(DEM5A PNG, z15)から、マップ範囲の標高グリッドを作って terrain-data.js に書き出す。
  使いかた:  python scripts/build-terrain.py
  データ出典: 国土地理院 標高タイル https://maps.gsi.go.jp/ (基盤地図情報 数値標高モデル)
"""
import math, os, io, sys, base64, struct, urllib.request, tempfile
from PIL import Image

LAT0, LON0, HALF = 35.5345, 139.6405, 800.0
KM_LAT = 111132.0
KM_LON = 111320.0 * math.cos(math.radians(LAT0))
Z = 15
RANGE = 900.0   # グリッドの はんいは ±RANGE (m)
N = 181         # 10mごと
STEP = 2 * RANGE / (N - 1)


def tile_xy(lat, lon, z):
    n = 2 ** z
    x = (lon + 180.0) / 360.0 * n
    y = (1.0 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2.0 * n
    return x, y


def get_tile(x, y, cache, tmp):
    k = (x, y)
    if k in cache:
        return cache[k]
    for layer, zz, xx, yy in (('dem5a_png', Z, x, y), ('dem_png', Z - 1, x // 2, y // 2)):
        url = f'https://cyberjapandata.gsi.go.jp/xyz/{layer}/{zz}/{xx}/{yy}.png'
        try:
            data = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'hibiyui-terrain-build'}), timeout=30).read()
        except Exception as e:
            print('skip', url, e)
            continue
        open(os.path.join(tmp, f'{layer}_{zz}_{xx}_{yy}.png'), 'wb').write(data)
        im = Image.open(io.BytesIO(data)).convert('RGB')
        cache[k] = (im, layer, zz, xx, yy)
        return cache[k]
    cache[k] = None
    return None


def elev(lat, lon, cache, tmp):
    tx, ty = tile_xy(lat, lon, Z)
    ix, iy = int(tx), int(ty)
    t = get_tile(ix, iy, cache, tmp)
    if not t:
        return None
    im, layer, zz, xx, yy = t
    # 取得した タイル内の ピクセル
    fx, fy = tile_xy(lat, lon, zz)
    px = min(255, max(0, int((fx - xx) * 256)))
    py = min(255, max(0, int((fy - yy) * 256)))
    r, g, b = im.getpixel((px, py))
    v = r * 65536 + g * 256 + b
    if v == 8388608:
        return None
    if v > 8388608:
        v -= 16777216
    return v * 0.01


def main():
    tmp = tempfile.mkdtemp(prefix='gsi_dem_')
    cache = {}
    vals = []
    miss = 0
    for j in range(N):
        z = -RANGE + j * STEP
        for i in range(N):
            x = -RANGE + i * STEP
            lat = LAT0 + z / KM_LAT
            lon = LON0 - x / KM_LON   # build-citymap と おなじ: x は にしが プラス
            e = elev(lat, lon, cache, tmp)
            if e is None:
                miss += 1
            vals.append(e)
    # データなし(うみ・かわ)は となりから うめる
    for _ in range(60):
        done = True
        nv = list(vals)
        for j in range(N):
            for i in range(N):
                if vals[j * N + i] is None:
                    ns = [vals[jj * N + ii] for jj, ii in ((j - 1, i), (j + 1, i), (j, i - 1), (j, i + 1)) if 0 <= jj < N and 0 <= ii < N and vals[jj * N + ii] is not None]
                    if ns:
                        nv[j * N + i] = sum(ns) / len(ns)
                    else:
                        done = False
        vals = nv
        if done:
            break
    vals = [0.0 if v is None else v for v in vals]
    # かるく ぼかす(3x3)
    sm = list(vals)
    for j in range(1, N - 1):
        for i in range(1, N - 1):
            sm[j * N + i] = (vals[j * N + i] * 4 + vals[(j - 1) * N + i] * 2 + vals[(j + 1) * N + i] * 2 + vals[j * N + i - 1] * 2 + vals[j * N + i + 1] * 2 + vals[(j - 1) * N + i - 1] + vals[(j - 1) * N + i + 1] + vals[(j + 1) * N + i - 1] + vals[(j + 1) * N + i + 1]) / 16.0
    vals = sm
    lo, hi = min(vals), max(vals)
    print('grid', N, 'missing', miss, 'min', lo, 'max', hi, 'tiles', len(cache))
    arr = [int(round(v * 10)) for v in vals]  # デシメートル
    raw = struct.pack('<%dh' % len(arr), *arr)
    b64 = base64.b64encode(raw).decode()
    with open(os.path.join(os.path.dirname(__file__), '..', 'terrain-data.js'), 'w', encoding='utf-8') as f:
        f.write('// 国土地理院 標高タイル(DEM5A)から scripts/build-terrain.py で作成。Int16(デシメートル)・z が こうしの いち\n')
        f.write(f'export const TERRAIN = {{ range: {RANGE}, n: {N}, min: {lo:.2f}, max: {hi:.2f}, data: "{b64}" }};\n')
    print('wrote terrain-data.js', len(b64))


main()
