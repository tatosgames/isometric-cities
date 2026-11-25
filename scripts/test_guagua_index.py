import unittest

from guagua_index import SIZE, index_piece


class GuaguaIndexTests(unittest.TestCase):
    def test_crossing_and_exact_stop_time(self):
        index = {}
        result = index_piece(index, "p", "p.json", "13", "Tres Palmas", 0, 90,
                             [[0, 0], [300, 0]],
                             [{"id": "a", "distance": 100}, {"id": "b", "distance": 300}])
        self.assertEqual(index["cells"]["0_0"][0][0], "p")
        self.assertEqual(index["cells"]["1_0"][0][1:3], [240.0, 300.0])
        self.assertAlmostEqual(result["times"][0], 15.2428571429, places=5)
        self.assertLess(index["cells"]["0_0"][0][3], index["cells"]["0_0"][0][4])

    def test_reentry_emits_two_intervals(self):
        index = {}
        index_piece(index, "loop", "loop.json", "1", "Centre", 0, 90,
                    [[0, 0], [300, 0], [300, 100], [0, 100]], [])
        intervals = index["cells"]["0_0"]
        self.assertEqual(len(intervals), 2)
        self.assertLess(intervals[0][2], intervals[1][1])

    def test_timing_matches_acceleration_limit(self):
        index = {}
        result = index_piece(index, "p", "p.json", "13", "x", 0, 90,
                             [[0, 0], [100, 0]], [])
        expected = 15.24285714285714
        self.assertAlmostEqual(result["duration"], expected, places=6)


if __name__ == "__main__":
    unittest.main()
