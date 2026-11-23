"""Confronto delle tinte dei tetti: ortofoto 20 cm 2024 (SITCAN) contro public/data/roof-tones.json (PNOA 1 m).

Uso:  python -I scripts/roof-compare-20cm.py
Legge da remoto solo la finestra di roof-tones.json (circa 30-60 MB, il file intero e di 10 GB).
Scrive in .cache/roof20/ (ortho20-1m.png e roof-compare.json); non tocca public/data.
Ortofoto: (c) Gobierno de Canarias, CC BY 3.0 (aviso legal SITCAN). Vedi docs/GEODATA_SOURCES.md.
"""
import json, sys, time
from pathlib import Path
sys.path.insert(0, '.cache/pylib')
import numpy as np
import rasterio
from rasterio.windows import Window
from PIL import Image, ImageDraw, ImageFilter
from geo import CANARY, origin
from math import floor, ceil

URL = '/vsicurl/https://opendata.sitcan.es/upload/251/OTARM20/tif/251_OTARM20_GC.tif'
OUT = Path('.cache/roof20'); OUT.mkdir(parents=True, exist_ok=True)
tones = json.loads(Path('public/data/roof-tones.json').read_text())
west, south, width, height = tones['bounds']
ox, oy = origin(CANARY)
stages = [json.loads(Path(f'public/data/{s}.json').read_bytes()) for s in ('pilot', 'city')]

F = 5  # 0.2 m -> 1 m
t0 = time.time()
with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR', CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.tif', GDAL_CACHEMAX=256, VSI_CACHE='TRUE'):
    with rasterio.open(URL) as r:
        left, top = r.bounds.left, r.bounds.top
        col0 = round((ox + west - left) / 0.2)
        row0 = round((top - (oy + south + height)) / 0.2)
        im = np.zeros((height, width, 3), np.float32)
        step = 400  # righe da 1 m per blocco
        for y in range(0, height, step):
            h = min(step, height - y)
            win = Window(col0, row0 + y * F, width * F, h * F)
            a = r.read(window=win).astype(np.float32)  # 3, h*F, width*F
            a = a.reshape(3, h, F, width, F).mean(axis=(2, 4))
            im[y:y + h] = a.transpose(1, 2, 0)
            print(f'  letto {y + h}/{height} m  ({time.time() - t0:.0f}s)', flush=True)
Image.fromarray(im.astype('uint8')).save(OUT / 'ortho20-1m.png')

smooth = Image.fromarray(im.astype('uint8')).filter(ImageFilter.MedianFilter(5))
rgb = np.asarray(smooth, dtype=np.float32)
shade = np.maximum(0, 105 - rgb.mean(axis=2, keepdims=True))
rgb = np.clip(rgb + shade * .67, 0, 255)
new = {}
for scene in stages:
    for b in scene['buildings']:
        rings = [[(x - west, height - 1 - (y - south)) for x, y in ring] for ring in b['rings']]
        xs, ys = zip(*rings[0])
        x0, y0, x1, y1 = int(min(xs)), int(min(ys)), int(max(xs)) + 1, int(max(ys)) + 1
        mask = Image.new('L', (x1 - x0, y1 - y0))
        d = ImageDraw.Draw(mask)
        for i, ring in enumerate(rings):
            d.polygon([(x - x0, y - y0) for x, y in ring], fill=0 if i else 255)
        px = rgb[y0:y1, x0:x1][np.asarray(mask) > 0]
        key = str(b['id']) + b.get('toneSuffix', '')
        if len(px) < 4: continue
        br = px.mean(axis=1)
        lo, hi = np.percentile(br, [35, 85])
        s = np.median(px[(br >= lo) & (br <= hi)], axis=0)
        if np.isfinite(s).all(): new[key] = [float(c) for c in s]

def lab(c):
    c = np.asarray(c) / 255.0
    c = np.where(c > .04045, ((c + .055) / 1.055) ** 2.4, c / 12.92)
    M = np.array([[.4124, .3576, .1805], [.2126, .7152, .0722], [.0193, .1192, .9505]])
    xyz = c @ M.T / np.array([.95047, 1, 1.08883])
    f = np.where(xyz > .008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)

old = {k: [int(v[i:i + 2], 16) for i in (1, 3, 5)] for k, v in tones['tones'].items()}
keys = sorted(set(old) & set(new))
A = np.array([old[k] for k in keys], float); B = np.array([new[k] for k in keys], float)
dE = np.linalg.norm(lab(A) - lab(B), axis=1)
dL = lab(B)[:, 0] - lab(A)[:, 0]
res = dict(buildings_old=len(old), buildings_new=len(new), common=len(keys),
           deltaE=dict(median=round(float(np.median(dE)), 1), p75=round(float(np.percentile(dE, 75)), 1), p95=round(float(np.percentile(dE, 95)), 1),
                       under5=round(float((dE < 5).mean()), 3), under10=round(float((dE < 10).mean()), 3)),
           lightness_new_minus_old=dict(median=round(float(np.median(dL)), 1), mean=round(float(dL.mean()), 1)),
           worst=[(keys[i], '#%02x%02x%02x' % tuple(int(v) for v in A[i]), '#%02x%02x%02x' % tuple(int(v) for v in B[i]), round(float(dE[i]), 1)) for i in np.argsort(-dE)[:8]],
           sample={k: ('#%02x%02x%02x' % tuple(old[k]), '#%02x%02x%02x' % tuple(int(v) for v in new[k])) for k in ['41119-nave', '41119', '41435', '41434', '40277', '41117'] if k in new and k in old})
(OUT / 'roof-compare.json').write_text(json.dumps(dict(res, new={k: '#%02x%02x%02x' % tuple(int(v) for v in c) for k, c in new.items()}), indent=1))
print(json.dumps(res, indent=1))
