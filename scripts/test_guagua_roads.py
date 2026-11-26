import unittest
from collections import defaultdict

import guaguas  # Uses the same local geodata environment as the importer.
from guagua_roads import BusRoads, RoadClearance
from shapely import STRtree
from shapely.geometry import box


def directed_roads(coords, edges):
    roads = BusRoads.__new__(BusRoads)
    roads.coords = coords
    roads.nodes, roads.edges = [], []
    roads.out, roads.restrictions = defaultdict(list), defaultdict(list)
    roads.via_ways = set()
    for edge in edges:
        roads.add(*edge)
    roads.tree = STRtree(roads.edges)
    roads.xy = [list(edge.coords) for edge in roads.edges]
    roads.length = [edge.length for edge in roads.edges]
    return roads


class DirectedMatchingTests(unittest.TestCase):
    def test_connected_lane_wins_over_nearest_disconnected_lane(self):
        roads = directed_roads({
            'near-start': (0, 0), 'near-end': (16, 0),
            'far-start': (0, 5), 'far-middle': (32, 5), 'far-end': (64, 5),
        }, [('near-start', 'near-end', 'near'), ('far-start', 'far-middle', 'far'),
            ('far-middle', 'far-end', 'far')])
        self.assertEqual(roads.snaps((0, 0), 1, 0)[0][1], 0)
        chain, = roads.match([(0, 0), (64, 0)])
        self.assertEqual(chain[0][0], (0, 5))
        self.assertEqual(chain[-1][0], (64, 5))
        self.assertEqual({way for _, _, way in chain}, {'far'})
        self.assertEqual(roads.match([(64, 0), (0, 0)]), [])

    def test_short_gtfs_gap_uses_connected_geometry_and_respects_turns(self):
        roads = directed_roads({'a': (0, 0), 'b': (32, 0), 'c': (64, 0)},
                               [('a', 'b', 'west'), ('b', 'c', 'east')])
        shape = [(0, 0), (32, 0), (32, 12), (64, 0)]
        self.assertEqual(roads.snaps((32, 0), 0, 1), [])
        chain, = roads.match(shape)
        self.assertEqual([chain[0][0], chain[-1][0]], [(0, 0), (64, 0)])
        roads.restrictions[('b', 'west')].append(('no_straight_on', 'east'))
        self.assertEqual(len(roads.match(shape)), 2)

    def test_tight_turn_allows_overhang_but_keeps_a_paved_corridor(self):
        clearance = RoadClearance.__new__(RoadClearance)
        road = box(-20, -2.2, 2.2, 2.2).union(box(-2.2, -2.2, 2.2, 20))
        clearance.fits = road.covers
        chain = [((-12, 0), 0, 'a'), ((0, 0), 12, 'a'), ((0, 12), 24, 'b')]
        self.assertEqual(list(clearance.verified(chain)), [])
        run, = clearance.verified(chain, allow_tight_turns=True)
        self.assertEqual(len(run), 3)

        blocked = RoadClearance.__new__(RoadClearance)
        blocked.fits = road.difference(box(-8, -2.2, -7, 2.2)).covers
        self.assertTrue(all(len(run) < 3 for run in blocked.verified(chain, allow_tight_turns=True)))

    def test_rounded_offset_can_collapse_adjacent_vertices(self):
        clearance = RoadClearance.__new__(RoadClearance)
        clearance.fits = box(-20, -20, 20, 20).covers
        chain = [((.05, 0), 0, 'a'), ((1, 0), 1, 'a'), ((1, -12), 13, 'b')]
        run, = clearance.verified(chain, allow_tight_turns=True)
        self.assertEqual(len(run), 2)


if __name__ == '__main__':
    unittest.main()
