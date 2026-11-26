"""Regression checks for deterministic sector generation and intermediate cache keys."""
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(".cache/pylib").resolve()))
from PIL import Image
from shapely import prepare
from shapely.geometry import Polygon, box

import carriageways
from generation_cache import file_digest
import sectors


def scene():
    ring = [[0, 0], [15, 0], [15, 15], [0, 15], [0, 0]]
    return {
        "boundary": [[-10, -10], [30, -10], [30, 30], [-10, 30], [-10, -10]],
        "buildings": [],
        "surfaces": [],
        "trees": [],
        "roads": [{"kind": "residential", "line": [[0, 5], [15, 5]]}],
        "ground": [ring],
        "terrain": {"w": 8, "h": 8, "origin": [-10, 30], "step": 5, "stepY": 5, "values": [0] * 64},
    }


class CarriagewayCacheTest(unittest.TestCase):
    def test_masks_faces_and_mesh_invalidate_independently(self):
        city = scene()
        detail = {"ground": city["ground"], "textureBounds": [-5, -5, 20, 20]}
        bounds = [0, 0, 15, 15]
        expected = carriageways.Carriageways(city).tile(detail, bounds)
        with tempfile.TemporaryDirectory() as temp, patch.object(carriageways, "CACHE", Path(temp)):
            first = carriageways.Carriageways(city, "city")
            self.assertEqual(first.tile(detail, bounds), expected)
            with patch.object(carriageways.Carriageways, "build_masks", side_effect=AssertionError("rebuilt masks")),                     patch.object(carriageways.subprocess, "check_output", side_effect=AssertionError("rebuilt faces")):
                second = carriageways.Carriageways(city, "city")
                with patch.object(second, "build_tile", side_effect=AssertionError("rebuilt mesh")):
                    self.assertEqual(second.tile(detail, bounds), expected)
                    city["terrain"]["values"][0] = 10
                    self.assertEqual(second.tile(detail, bounds), expected)

                city["terrain"]["values"][26] = 10
                updated = second.tile(detail, bounds)
                self.assertNotEqual(updated["positions"], expected["positions"])

            city["roads"][0]["line"][0][1] = 8
            with patch.object(carriageways.subprocess, "check_output", side_effect=AssertionError("rebuilt faces")):
                revised = carriageways.Carriageways(city, "city")
                self.assertNotEqual(revised.tile(detail, bounds)["positions"], updated["positions"])

            (Path(temp) / "city" / "faces.json").write_bytes(b"truncated")
            with patch.object(carriageways.Carriageways, "build_masks", side_effect=AssertionError("rebuilt masks")):
                self.assertEqual(carriageways.Carriageways(city, "city").faces, revised.faces)


class SectorGenerationTest(unittest.TestCase):
    def test_far_ground_keeps_border_holes_and_ring_order(self):
        land = Polygon(
            [(17, 2), (246, 2), (246, 284), (17, 284)],
            [[(60, 62), (100, 62), (100, 109), (60, 109)]],
        )
        bounds = [0, 0, 360, 360]
        expected = [
            sectors.ring_of(p)
            for x in range(0, 360, sectors.FAR)
            for y in range(0, 360, sectors.FAR)
            for p in sectors.parts(land.intersection(box(x, y, x + sectors.FAR, y + sectors.FAR)))
            if p.area > 1
        ]
        prepare(land)
        self.assertEqual(sectors.far_ground(land, bounds), expected)

    def test_stale_atlas_is_ignored_even_when_it_exists(self):
        cwd = Path.cwd()
        with tempfile.TemporaryDirectory() as temp:
            try:
                os.chdir(temp)
                atlas = Path(".cache/roof-atlas.png")
                atlas.parent.mkdir()
                with Image.new("RGB", (10, 10)) as image:
                    image.save(atlas)
                bounds = [30, 20, 10, 10]
                crop = [33, 23, 4, 4]
                self.assertEqual(sectors.open_atlas(bounds, [crop]), (None, None))
                atlas.with_suffix(".json").write_text(json.dumps({"bounds": bounds, "sha256": file_digest(atlas)}))
                image, key = sectors.open_atlas(bounds, [crop])
                self.assertIsNotNone(key)
                with image:
                    self.assertEqual(image.size, (10, 10))
                self.assertEqual(sectors.open_atlas(bounds, [[33, 23, 9, 9]]), (None, None))
                self.assertEqual(sectors.open_atlas([31, 20, 10, 10], [crop]), (None, None))
                atlas.write_bytes(b"damaged")
                self.assertEqual(sectors.open_atlas(bounds, [crop]), (None, None))
            finally:
                os.chdir(cwd)

    def test_cached_roof_requires_intact_published_file(self):
        cwd = Path.cwd()
        with tempfile.TemporaryDirectory() as temp, Image.new("RGB", (10, 10), "white") as image:
            try:
                os.chdir(temp)
                directory = Path("sectors")
                directory.mkdir()
                crop = (1, 1, 5, 5)
                file = sectors.bake_roof(directory, "0_0", image, "atlas", crop)
                expected = (directory / file).read_bytes()
                with patch.object(image, "crop", side_effect=AssertionError("rebuilt roof")):
                    self.assertEqual(sectors.bake_roof(directory, "0_0", image, "atlas", crop), file)
                (directory / file).write_bytes(b"damaged")
                self.assertEqual(sectors.bake_roof(directory, "0_0", image, "atlas", crop), file)
                self.assertEqual((directory / file).read_bytes(), expected)
            finally:
                os.chdir(cwd)

    def test_missing_roof_preflight_stops_before_building_carriageways(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            palette = {"bounds": [-10, -10, 40, 40], "tones": {}}
            (root / "roof-tones.json").write_text(json.dumps(palette))
            with patch.object(sectors, "ROOT", root), patch.object(sectors, "read_layers", return_value=scene()),                     patch.object(sectors, "Carriageways", side_effect=AssertionError("built carriageway")),                     patch.object(sectors, "open_atlas", return_value=(None, None)):
                with self.assertRaisesRegex(SystemExit, "run roof-colours.py"):
                    sectors.partition("city")
            self.assertEqual([p.name for p in root.iterdir()], ["roof-tones.json"])


if __name__ == "__main__":
    unittest.main()
