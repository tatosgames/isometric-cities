from contextlib import chdir
import gzip
from pathlib import Path
import sys
from subprocess import CalledProcessError
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(".cache/pylib").resolve()))
from shapely import prepare
from shapely.geometry import LineString, Polygon, box

from city_layers import layers_path, write_layers
from generation_cache import digest, read_entry, write_entry
from geo import clip_to_area
import osm_extract
from source_cache import fetch


class GenerationDataTest(unittest.TestCase):
    def test_clip_preserves_order_for_interior_and_boundary(self):
        area = Polygon(
            [(0, 0), (20, 0), (20, 20), (0, 20)],
            holes=[[(8, 8), (12, 8), (12, 12), (8, 12)]],
        )
        prepare(area)
        for geometry in (
            box(1, 1, 7, 7),
            box(6, 6, 10, 11),
            box(9, 9, 10, 10),
            box(-2, -2, 4, 4),
            LineString([(2, 4), (3, 3), (4, 2)]),
            LineString([(0, 0), (20, 20)]),
        ):
            with self.subTest(geometry=geometry):
                self.assertEqual(clip_to_area(geometry, area).wkb, geometry.intersection(area).wkb)

    def test_cache_content_key_and_integrity(self):
        with TemporaryDirectory() as directory:
            file = Path(directory) / "derived"
            key = digest("abc", "d")
            self.assertNotEqual(key, digest("ab", "cd"))
            self.assertIsNone(read_entry(file, key))
            write_entry(file, key, b"payload")
            self.assertEqual(read_entry(file, key), b"payload")
            self.assertIsNone(read_entry(file, digest("other")))
            file.write_bytes(file.read_bytes()[:-1] + b"X")
            self.assertIsNone(read_entry(file, key))

    def test_failed_download_does_not_leave_a_cache_hit(self):
        with TemporaryDirectory() as directory, chdir(directory):
            def fail(command, *, check):
                Path(command[-1]).write_bytes(b"partial")
                raise CalledProcessError(1, command)

            url = "https://example.invalid/geo"
            with patch("source_cache.subprocess.run", side_effect=fail):
                with self.assertRaises(CalledProcessError):
                    fetch("city.xml", url)
            self.assertEqual(list(Path(".cache/sources").iterdir()), [])
            with self.assertRaises(FileNotFoundError):
                fetch("city.xml", url, offline=True)

    def test_gzip_level_and_warm_reuse(self):
        data = {"roads": ["calle"] * 2000}
        with TemporaryDirectory() as directory, chdir(directory):
            root = Path("out")
            path = layers_path("city", root)
            write_layers("city", data, root)
            canonical = path.read_bytes()
            with patch("city_layers.gzip.compress", side_effect=AssertionError("recompressed")):
                write_layers("city", data, root)
            write_layers("city", data, root, compresslevel=6)
            alternate = path.read_bytes()
            self.assertNotEqual(canonical, alternate)
            self.assertEqual(gzip.decompress(canonical), gzip.decompress(alternate))
            write_layers("city", data, root)
            self.assertEqual(path.read_bytes(), canonical)

    def test_projected_osm_preserves_order_and_detects_replaced_source(self):
        def source(version, lon, node_id):
            return (f'<osm><node id="1" version="{version}" lon="{lon}" lat="28"/>'
                    f'<node id="{node_id}" version="1" lon="-15" lat="28"/>'
                    f'<way id="5" version="1"><nd ref="1"/><nd ref="{node_id}"/></way></osm>')

        with TemporaryDirectory() as directory, chdir(directory):
            first, second = Path("first.xml"), Path("second.xml")
            first.write_text(source(1, -15, 2), encoding="utf-8")
            second.write_text(source(2, -16, 3), encoding="utf-8")
            with patch.object(osm_extract, "source_paths", return_value=[first, second]):
                nodes, _, ways, _ = osm_extract.acquire_projected({})
                self.assertEqual(list(nodes), ["1", "2", "3"])
                self.assertEqual(ways["5"][1], ["1", "2"])
                with patch.object(osm_extract, "merge", side_effect=AssertionError("reparsed")):
                    self.assertEqual(osm_extract.acquire_projected({})[0], nodes)
                second.write_text(source(2, -17, 3), encoding="utf-8")
                self.assertNotEqual(osm_extract.acquire_projected({})[0]["1"], nodes["1"])


if __name__ == "__main__":
    unittest.main()
