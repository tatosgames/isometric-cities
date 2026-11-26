"""Build a subdued local roof-colour atlas from an IGN PNOA orthophoto."""
import argparse
from functools import lru_cache
import json
from math import ceil, floor
from pathlib import Path
import sys
from tempfile import NamedTemporaryFile
from urllib.parse import urlencode

sys.path.insert(0, str(Path(".cache/pylib").resolve()))
from PIL import Image, ImageFilter, __version__ as pillow_version

from city_layers import read_layers
from generation_cache import atomic_write, digest, file_digest, read_entry, write_entry
from geo import CANARY, origin
from roof_sampling import adjust_shadows, sample_roofs
from source_cache import fetch

TILE = 1024
HALO = 2
CACHE = Path(".cache/roof-filtered")


class Orthophoto:
    def __init__(self, bounds):
        self.west, self.south, self.width, self.height = bounds
        self.ox, self.oy = origin(CANARY)
        self.paths = lru_cache(maxsize=None)(self.source)
        self.raw_tile = lru_cache(maxsize=12)(self.decode)
        self.tile = lru_cache(maxsize=32)(self.filtered)

    def rect(self, tx, ty):
        """Pixel rectangle with screen Y measured down, WMS tile Y measured up."""
        x = tx * TILE
        y = ty * TILE
        return x, self.height - min(self.height, y + TILE), min(self.width, x + TILE), self.height - y

    def keys(self, rect):
        left, top, right, bottom = rect
        for tx in range(left // TILE, (right - 1) // TILE + 1):
            for ty in range((self.height - bottom) // TILE, (self.height - 1 - top) // TILE + 1):
                yield tx, ty

    def source(self, tx, ty):
        left, top, right, bottom = self.rect(tx, ty)
        west, south = self.ox + self.west, self.oy + self.south
        lower = ty * TILE
        extent = west + left, south + lower, west + left + (right - left), south + lower + (bottom - top)
        params = dict(SERVICE="WMS", VERSION="1.3.0", REQUEST="GetMap", LAYERS="OI.OrthoimageCoverage",
                      STYLES="", CRS="EPSG:4083", FORMAT="image/jpeg", WIDTH=right-left,
                      HEIGHT=bottom-top, BBOX=",".join(f"{v:.3f}" for v in extent))
        url = "https://www.ign.es/wms-inspire/pnoa-ma?" + urlencode(params)
        path = fetch("roof.jpg", url)
        return path, file_digest(path)

    def decode(self, tx, ty):
        path, _ = self.paths(tx, ty)
        left, top, right, bottom = self.rect(tx, ty)
        with Image.open(path) as image:
            if image.size != (right-left, bottom-top):
                raise ValueError(f"Unexpected orthophoto tile dimensions in {path}")
            return image.convert("RGB")

    def filtered(self, tx, ty):
        left, top, right, bottom = self.rect(tx, ty)
        x0, y0 = max(left-HALO, 0), max(top-HALO, 0)
        x1, y1 = min(right+HALO, self.width), min(bottom+HALO, self.height)
        neighbours = list(self.keys((x0, y0, x1, y1)))
        path, _ = self.paths(tx, ty)
        extent = (left-x0, top-y0, right-x0, bottom-y0)
        sources = []
        for x, y in neighbours:
            px, py, _, _ = self.rect(x, y)
            sources.append((px - x0, py - y0, self.paths(x, y)[1]))
        key = digest("pnoa-median-v1", pillow_version, extent, [x1 - x0, y1 - y0], sources)
        cache_file = CACHE / (path.stem + ".rgb")
        payload = read_entry(cache_file, key)
        size = (right-left, bottom-top)
        if payload is not None and len(payload) == size[0] * size[1] * 3:
            return Image.frombytes("RGB", size, payload)
        halo = Image.new("RGB", (x1-x0, y1-y0))
        for x, y in neighbours:
            px, py, _, _ = self.rect(x, y)
            halo.paste(self.raw_tile(x, y), (px-x0, py-y0))
        smooth = halo.filter(ImageFilter.MedianFilter(2*HALO+1)).crop(extent)
        write_entry(cache_file, key, smooth.tobytes())
        return smooth

    def crop(self, rect):
        left, top, right, bottom = rect
        if not (0 <= left < right <= self.width and 0 <= top < bottom <= self.height):
            raise ValueError(f"Roof footprint lies outside the orthophoto: {rect}")
        neighbours = list(self.keys(rect))
        if len(neighbours) == 1:
            tx, ty = neighbours[0]
            x, y, _, _ = self.rect(tx, ty)
            return self.tile(tx, ty).crop((left - x, top - y, right - x, bottom - y))
        result = Image.new("RGB", (right-left, bottom-top))
        for tx, ty in neighbours:
            x, y, _, _ = self.rect(tx, ty)
            result.paste(self.tile(tx, ty), (x-left, y-top))
        return result

    def atlas(self):
        result = Image.new("RGB", (self.width, self.height))
        for tx, ty in self.keys((0, 0, self.width, self.height)):
            left, top, _, _ = self.rect(tx, ty)
            rgb = adjust_shadows(self.tile(tx, ty)).astype("uint8")
            result.paste(Image.fromarray(rgb), (left, top))
        return result


def save_image(image, path, format, **kwargs):
    with NamedTemporaryFile(dir=path.parent, prefix=path.name + ".", delete=False) as stream:
        temporary = Path(stream.name)
        try:
            image.save(stream, format=format, **kwargs)
            stream.close()
            temporary.replace(path)
        finally:
            stream.close()
            temporary.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--palette-only", action="store_true",
                        help="Build roof-tones.json from only the tiles needed by building footprints")
    args = parser.parse_args()
    stages = [read_layers(s) for s in ("pilot", "city")]
    xs, ys = zip(*(p for stage in stages for p in stage["boundary"]))
    west, south = floor(min(xs)) - 8, floor(min(ys)) - 8
    width, height = ceil(max(xs)) - west + 8, ceil(max(ys)) - south + 8
    bounds = [west, south, width, height]
    ortho = Orthophoto(bounds)
    samples = sample_roofs(stages, bounds, ortho.crop,
                           group=lambda x, y: ((x - west) // TILE, (y - south) // TILE))
    colours = {key: "#" + "".join(f"{int(c):02x}" for c in value) for key, value in samples.items()}
    if not args.palette_only:
        with ortho.atlas() as atlas:
            path = Path(".cache/roof-atlas.png")
            save_image(atlas, path, "PNG")
            with atlas.resize((max(1, width//2), max(1, height//2)), Image.Resampling.LANCZOS) as preview:
                save_image(preview, Path("public/data/roof-colours.webp"), "WEBP", quality=86)
            metadata = dict(bounds=bounds, sha256=file_digest(path))
            atomic_write(path.with_suffix(".json"), json.dumps(metadata, separators=(",", ":")).encode())
    palette = json.dumps(dict(tones=colours, bounds=bounds), separators=(",", ":"))
    atomic_write(Path("public/data/roof-tones.json"), palette.encode())
    print("Roof colour extent (west, south, width, height)", *bounds)


if __name__ == "__main__":
    main()
