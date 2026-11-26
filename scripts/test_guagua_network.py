import unittest

from guagua_network import intervals_within, stop_locations, stop_segments
from guagua_roads import RoadClearance
from shapely import union_all
from shapely.geometry import LineString, Polygon, box


class NetworkGeometryTest(unittest.TestCase):
    def test_covered_and_disjoint_paths(self):
        boundary = box(0, 0, 10, 10)
        inside = LineString([(1, 1), (4, 1), (4, 5)])
        intervals = intervals_within(inside, boundary)
        self.assertEqual(intervals, [(0.0, 7.0)])
        self.assertIsInstance(intervals[0][0], float)
        along_boundary = LineString([(1, 0), (4, 0), (4, 4)])
        self.assertEqual(intervals_within(along_boundary, boundary), [(0, 7)])
        self.assertEqual(intervals_within(LineString([(0, -2), (5, -2)]), boundary), [])

    def test_crossing_a_boundary_and_a_hole(self):
        shell = box(0, 0, 10, 10)
        hole = box(4, 4, 6, 6)
        boundary = Polygon(shell.exterior.coords, [hole.exterior.coords])
        shape = LineString([(-1, 5), (11, 5)])
        self.assertEqual(intervals_within(shape, boundary), [(1, 5), (7, 11)])

    def test_covered_path_still_omits_tiny_segments(self):
        shape = LineString([(1, 1), (2, 1), (2, 1), (2.00005, 1)])
        self.assertEqual(intervals_within(shape, box(0, 0, 10, 10)), [(0, 1)])

    def test_border_can_split_a_covered_segment_below_the_cutoff(self):
        boundary = Polygon([(0, 0), (0.00005, 0), (1, 0), (1, 1), (0, 1)])
        shape = LineString([(0, 0), (0.5, 0)])
        self.assertEqual(intervals_within(shape, boundary), [(0.00005, 0.5)])

    def test_repeated_stop_projects_in_travel_order(self):
        coords = [(0, 0), (10, 0), (10, 0), (90, 0), (90, 100), (10, 100), (10, 0), (0, 0)]
        positions = stop_locations(stop_segments(coords), ["73", "73"], {"73": ("Stop", (10, 0))})
        self.assertEqual([(measure, sid) for measure, sid, _, _ in positions], [(10, "73"), (370, "73")])

    def test_clearance_matches_overlay_with_outlying_obstacles(self):
        crossing = box(49, 7, 51, 13)
        far = box(49, 50, 51, 60)
        data = {
            "boundary": box(0, 0, 100, 100).exterior.coords,
            "roads": [{"kind": "street", "line": [(10, 10), (90, 10)]}],
            "buildings": [{"rings": [p.exterior.coords]} for p in (crossing, far)],
            "trees": [],
            "surfaces": [],
        }
        style = {"width": {"main": 6, "street": 4}, "main": [], "pedestrian": []}
        clearance = RoadClearance(data, style)
        original = union_all(clearance.pavement).intersection(clearance.boundary)
        original = original.difference(union_all(clearance.obstacles))
        self.assertTrue(clearance.tile(0, 0).equals(original))


if __name__ == "__main__":
    unittest.main()
