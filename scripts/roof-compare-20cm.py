"""Confronto delle tinte dei tetti: ortofoto 20 cm 2024 (SITCAN) contro PNOA 1 m.

Uso: python scripts/roof-compare-20cm.py [--refresh]
Legge la finestra di roof-tones.json a strisce. Scrive ortho20-1m.png e
roof-compare.json in .cache/roof20, insieme alla cache delle strisce.
Ortofoto: (c) Gobierno de Canarias, CC BY 3.0 (aviso legal SITCAN).
"""
import argparse
from contextlib import ExitStack
import json
from pathlib import Path
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(".cache/pylib").resolve()))
import numpy as np
from PIL import Image, ImageFilter
import rasterio
from rasterio.windows import Window

from city_layers import read_layers
from generation_cache import digest, read_entry, write_entry
from geo import CANARY, origin
from roof_sampling import sample_roofs

URL = "/vsicurl/https://opendata.sitcan.es/upload/251/OTARM20/tif/251_OTARM20_GC.tif"
OUT = Path(".cache/roof20")
FACTOR = 5
STRIP = 128


def downsampled_preview(bounds, refresh=False):
    west, south, width, height = bounds
    ox, oy = origin(CANARY)
    key = digest("sitcan-1m-v1", URL, bounds, [ox, oy], FACTOR, STRIP,
                 rasterio.__version__, rasterio.__gdal_version__, np.__version__)
    image = Image.new("RGB", (width, height))
    started = time.perf_counter()
    with ExitStack() as opened:
        dataset = None
        for y in range(0, height, STRIP):
            h = min(STRIP, height-y)
            cache = OUT / "strips" / key / f"{y}.rgb"
            data = None if refresh else read_entry(cache, key)
            if data is None or len(data) != width * h * 3:
                if dataset is None:
                    opened.enter_context(rasterio.Env(
                        GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif",
                        GDAL_CACHEMAX=256, VSI_CACHE="TRUE"))
                    dataset = opened.enter_context(rasterio.open(URL))
                    col = round((ox + west - dataset.bounds.left) / 0.2)
                    row = round((dataset.bounds.top - (oy + south + height)) / 0.2)
                window = Window(col, row + y * FACTOR, width * FACTOR, h * FACTOR)
                pixels = dataset.read(window=window).astype(np.float32)
                average = pixels.reshape(3, h, FACTOR, width, FACTOR).mean(axis=(2, 4))
                data = average.transpose(1, 2, 0).astype("uint8").tobytes()
                write_entry(cache, key, data)
                print(f"  letto {y + h}/{height} m  ({time.perf_counter() - started:.0f}s)", flush=True)
                del pixels, average
            image.paste(Image.frombytes("RGB", (width, h), data), (0, y))
    return image


def filtered_crop(image, rect):
    left, top, right, bottom = rect
    width, height = image.size
    x0, y0 = max(left-2, 0), max(top-2, 0)
    halo = image.crop((x0, y0, min(right+2, width), min(bottom+2, height)))
    return halo.filter(ImageFilter.MedianFilter(5)).crop((left-x0, top-y0, right-x0, bottom-y0))


def lab(c):
    c = np.asarray(c) / 255.0
    c = np.where(c > .04045, ((c + .055) / 1.055) ** 2.4, c / 12.92)
    M = np.array([[.4124, .3576, .1805], [.2126, .7152, .0722], [.0193, .1192, .9505]])
    xyz = c @ M.T / np.array([.95047, 1, 1.08883])
    f = np.where(xyz > .008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh", action="store_true", help="Rileggi tutte le strisce dal GeoTIFF remoto")
    args = parser.parse_args()
    tones = json.loads(Path("public/data/roof-tones.json").read_text())
    bounds = tones["bounds"]
    stages = [read_layers(s) for s in ("pilot", "city")]
    OUT.mkdir(parents=True, exist_ok=True)
    with downsampled_preview(bounds, args.refresh) as image:
        image.save(OUT / "ortho20-1m.png")
        new = sample_roofs(stages, bounds, lambda rect: filtered_crop(image, rect))

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


if __name__ == "__main__":
    main()
