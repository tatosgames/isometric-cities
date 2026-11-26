"""Targeted geometry regressions for the city guagua widening."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0,str(Path('.cache/pylib').resolve()))
from shapely import union_all
from shapely.geometry import GeometryCollection, LineString, box
from road_widening import build_widening, intervals_for


class CityWideningTests(unittest.TestCase):
    def widening(self, tags=None, building=None, adjacent=False, crossing=False):
        axis=LineString([(0,0),(100,0)])
        road=dict(id='a',kind='residential',line=list(axis.coords))
        base=[box(-2,-2.5,102,2.5)]
        if adjacent:
            base.append(box(-2,3.5,102,8.5))
        if crossing:
            base.append(box(47.5,-12,52.5,12))
        buildings=[] if building is None else [dict(rings=[list(building.exterior.coords)])]
        return build_widening(dict(roads=[road],buildings=buildings),union_all(base),box(-20,-20,120,20),
                              building if building is not None else GeometryCollection(),
                              GeometryCollection(),{'a':[axis]},{'a':tags or {}},[])

    def test_width_evidence_and_multiple_lanes_in_one_direction(self):
        for tags,expected in [({},1),({'width':'7 m'},2),({'oneway':'yes','lanes':'2'},1)]:
            _,report=self.widening(tags)
            row,=report['tratti']
            self.assertAlmostEqual(row['sx_m']+row['dx_m'],expected,places=2)

    def test_building_margin_and_asymmetric_gain(self):
        building=box(10,2.9,90,6)
        added,report=self.widening({'width':'7'},building)
        row,=report['tratti']
        self.assertLess(row['sx_m'],.01)
        self.assertGreater(row['dx_m'],1.9)
        self.assertLess(added.intersection(building.buffer(.5)).area,1e-8)

    def test_parallel_carriageway_keeps_a_gap(self):
        added,_=self.widening({'width':'7'},adjacent=True)
        self.assertFalse(added.intersects(box(0,2.95,100,3.05)))

    def test_crossing_is_excluded_from_the_strip(self):
        added,report=self.widening({'width':'7'},crossing=True)
        self.assertFalse(added.intersects(box(48,-10,52,10)))
        self.assertIn('incrocio o carreggiate sovrapposte',report['esclusioni_m'])

    def test_only_matched_intervals_on_the_correct_axis_are_selected(self):
        axis=LineString([(0,0),(100,0)])
        runs=[LineString([(2,0),(32,0)]),LineString([(50,0),(92,0)]),
              LineString([(0,4),(100,4)])]
        self.assertEqual(intervals_for(axis,runs),[(2.,32.),(50.,92.)])


if __name__=='__main__':
    unittest.main()
