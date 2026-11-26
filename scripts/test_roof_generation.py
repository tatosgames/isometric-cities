"""Regressions for tiled roof sampling and the optional orthophoto download cache."""
import json
import os
from pathlib import Path
import runpy
import sys
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(".cache/pylib").resolve()))
from PIL import Image, ImageFilter
import numpy as np

from generation_cache import file_digest
from roof_sampling import adjust_shadows, sample_roofs

SCRIPTS = Path(__file__).resolve().parent
roof = runpy.run_path(str(SCRIPTS / "roof-colours.py"))
pnoa = roof["Orthophoto"]
comparison = runpy.run_path(str(SCRIPTS / "roof-compare-20cm.py"))
sitcan = comparison["downsampled_preview"]


class RoofTilesTest(unittest.TestCase):
    def test_palette_only_leaves_legacy_assets_intact(self):
        scene = {
            "boundary": [[0, 0], [2, 2]],
            "buildings": [{"id": 42, "rings": [[[0, 0], [2, 0], [2, 2], [0, 2]]]}],
        }

        class PaletteSource:
            def __init__(self, bounds):
                self.bounds = bounds

            def crop(self, rect):
                x0, y0, x1, y1 = rect
                return Image.new("RGB", (x1-x0, y1-y0), (130, 120, 110))

        with TemporaryDirectory() as directory:
            previous = Path.cwd()
            try:
                os.chdir(directory)
                for filename in (".cache/roof-atlas.png", ".cache/roof-atlas.json", "public/data/roof-colours.webp"):
                    legacy = Path(filename)
                    legacy.parent.mkdir(parents=True, exist_ok=True)
                    legacy.write_bytes(b"legacy")
                with (patch.dict(roof["main"].__globals__, read_layers=lambda _: scene, Orthophoto=PaletteSource),
                      patch.object(sys, "argv", ["roof-colours.py", "--palette-only"])):
                    roof["main"]()
                palette = json.loads(Path("public/data/roof-tones.json").read_bytes())
                self.assertEqual(palette["tones"], {"42": "#82786e"})
                for filename in (".cache/roof-atlas.png", ".cache/roof-atlas.json", "public/data/roof-colours.webp"):
                    self.assertEqual(Path(filename).read_bytes(), b"legacy")
            finally:
                os.chdir(previous)

    def test_halo_and_footprint_match_complete_filter(self):
        bounds = [0, 0, 29, 21]
        rng = np.random.default_rng(237)
        with TemporaryDirectory() as directory:
            path = Path(directory)
            calls = []

            class LocalOrthophoto(pnoa):
                def source(self, tx, ty):
                    calls.append((tx, ty))
                    tile = path / f"{tx}-{ty}.png"
                    return tile, file_digest(tile)

            with patch.dict(pnoa.filtered.__globals__, TILE=8, CACHE=path / "derived"):
                photo = LocalOrthophoto(bounds)
                original = Image.fromarray(rng.integers(0, 256, (21, 29, 3), dtype=np.uint8))
                for tx, ty in photo.keys((0, 0, 29, 21)):
                    original.crop(photo.rect(tx, ty)).save(path / f"{tx}-{ty}.png")
                smooth = original.filter(ImageFilter.MedianFilter(5))
                stages = [{
                    "boundary": [[0, 0], [29, 21]],
                    "buildings": [
                        {"id": 1, "rings": [[[0, 0], [3, 0], [3, 4], [0, 4]]]},
                        {"id": 2, "toneSuffix": "-wing", "rings": [
                            [[5, 5], [11, 5], [11, 11], [5, 11]],
                            [[7, 7], [8, 7], [8, 8], [7, 8]],
                        ]},
                        {"id": 1, "rings": [[[1, 0], [5, 0], [5, 5], [1, 5]]]},
                    ],
                }]
                self.assertEqual(list(sample_roofs(stages, bounds, photo.crop, group=lambda x, y: -x).items()),
                                 list(sample_roofs(stages, bounds, smooth.crop).items()))
                self.assertNotIn((3, 2), calls)
                self.assertEqual(photo.atlas().tobytes(),
                                 adjust_shadows(smooth).astype("uint8").tobytes())
                cached = LocalOrthophoto(bounds)
                with patch.object(cached, "raw_tile", side_effect=AssertionError("decoded a warm tile")):
                    self.assertEqual(cached.atlas().tobytes(), photo.atlas().tobytes())
                (path / "derived" / "0-0.rgb").write_bytes(b"broken")
                repaired = LocalOrthophoto(bounds)
                self.assertEqual(repaired.tile(0, 0).tobytes(), smooth.crop(repaired.rect(0, 0)).tobytes())
                # A changed adjacent source must invalidate the tile's halo without changing its own JPEG.
                neighbour = (1, 0)
                replacement = Image.new("RGB", (8, 8))
                replacement.save(path / "1-0.png")
                original.paste(replacement, photo.rect(*neighbour)[:2])
                changed = LocalOrthophoto(bounds)
                rebuilt = original.filter(ImageFilter.MedianFilter(5))
                self.assertEqual(changed.tile(0, 0).tobytes(), rebuilt.crop(changed.rect(0, 0)).tobytes())
                self.assertNotEqual(changed.tile(0, 0).tobytes(), photo.tile(0, 0).tobytes())


class RoofStripsTest(unittest.TestCase):
    def test_warm_corrupt_and_refresh_strip_cache(self):
        bounds = [0, 0, 22, 14]
        _, _, width, height = bounds
        raster = np.random.default_rng(852).integers(0, 256, (3, 80, 120), dtype=np.uint8)
        reads = []

        class Dataset:
            bounds = SimpleNamespace(left=-1, top=15)

            def __enter__(self):
                return self

            def __exit__(self, *args):
                pass

            def read(self, window):
                x, y, w, h = map(int, window.flatten())
                reads.append((x, y, w, h))
                return raster[:, y:y+h, x:x+w]

        with TemporaryDirectory() as directory:
            path = Path(directory)
            runtime = sitcan.__globals__
            with (patch.dict(runtime, OUT=path, STRIP=5, origin=lambda _: (0, 0)),
                  patch.object(runtime["rasterio"], "open", return_value=Dataset()) as opened):
                cold = sitcan(bounds)
                expect = raster[:, 5:75, 5:115].astype(np.float32)
                expect = expect.reshape(3, height, 5, width, 5).mean(axis=(2, 4))
                expect = expect.transpose(1, 2, 0).astype("uint8")
                self.assertEqual(cold.tobytes(), expect.tobytes())
                rect = (0, 4, 11, 13)
                self.assertEqual(comparison["filtered_crop"](cold, rect).tobytes(),
                                 cold.filter(ImageFilter.MedianFilter(5)).crop(rect).tobytes())
                self.assertEqual(len(reads), 3)
                self.assertEqual(sitcan(bounds).tobytes(), expect.tobytes())
                self.assertEqual(opened.call_count, 1)
                next(path.glob("strips/*/0.rgb")).write_bytes(b"broken")
                self.assertEqual(sitcan(bounds).tobytes(), expect.tobytes())
                self.assertEqual(len(reads), 4)
                self.assertEqual(sitcan(bounds, refresh=True).tobytes(), expect.tobytes())
                self.assertEqual(len(reads), 7)


if __name__ == "__main__":
    unittest.main()
