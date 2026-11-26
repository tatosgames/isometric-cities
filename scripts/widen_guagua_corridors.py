"""Build an isolated city candidate with wider guagua corridors."""
import argparse
import json
from pathlib import Path
import shutil
import sys

sys.path.insert(0,str(Path('.cache/pylib').resolve()))
from shapely import STRtree, area, get_parts, intersection, make_valid, prepare
from shapely.geometry import Polygon
from carriageways import Carriageways
from generation_cache import atomic_write
from guagua_network import match_network, publish
from road_widening import build_widening
from sectors import partition


def check_added_pavement(added,roads,data):
    pieces=get_parts(added)
    prepare(roads.land)
    if not all(roads.land.covers(piece) for piece in pieces):
        raise ValueError('New pavement leaves the map')
    setbacks=[make_valid(Polygon(b['rings'][0],b['rings'][1:])).buffer(.499)
              for b in data['buildings']]
    setback_index=STRtree(setbacks)
    if setback_index.query(pieces,predicate='intersects').size:
        raise ValueError('New pavement crosses the building setback')
    protected=STRtree(get_parts(roads.obstacles))
    left,right=protected.query(pieces,predicate='intersects')
    if area(intersection(pieces[left],protected.geometries[right])).sum()>1e-5:
        raise ValueError('New pavement crosses a protected mask')


def drive_surface_coverage(baseline,added):
    # The surface raster is sampled at 2 px/m. Keep the exact edges around
    # every changed strip and retain the existing simplification elsewhere.
    exact_window=added.buffer(2,quad_segs=1,join_style='bevel')
    exact=baseline.intersection(exact_window).union(added)
    return baseline.simplify(1.5).difference(exact_window).union(exact)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,required=True,help='new candidate directory')
    parser.add_argument('--feed',type=Path,default=Path('.cache/guaguas/feed.zip'))
    parser.add_argument('--width-survey',type=Path,help='optional verified per-interval orthophoto widths JSON')
    args=parser.parse_args()
    output=args.output.resolve()
    public=Path('public').resolve()
    if output.exists() or output.is_relative_to(public):
        parser.error('--output must be a new directory outside public')
    overrides=json.loads(args.width_survey.read_bytes()) if args.width_survey else []
    if not isinstance(overrides,list):
        parser.error('--width-survey must contain an array')
    network=match_network(args.feed)
    data=network.datasets['city']
    print('Preparing the current carriageway mask',flush=True)
    roads=Carriageways(data,'city')
    baseline=roads.coverage
    barrios=json.loads((public/'data/barrios.json').read_bytes())
    print('Checking road widening along the matched corridors',flush=True)
    added,report=build_widening(data,baseline,roads.land,roads.obstacles,roads.protected,
                               network.corridors(),network.roads.tags_by_way,overrides,barrios)
    if added.is_empty:
        raise ValueError('No eligible widening strips')
    output.mkdir(parents=True)
    atomic_write(output/'report.json',json.dumps(report,ensure_ascii=False,indent=2).encode())
    atomic_write(output/'added.wkb',added.wkb)
    check_added_pavement(added,roads,data)
    print(f'Validated {added.area:.1f} m² of new pavement',flush=True)
    candidate=output/'public'
    shutil.copytree(public,candidate)
    roads.coverage=baseline.union(added)
    partition('city',root=candidate/'data',data=data,carriageways=roads,
              drive_coverage=drive_surface_coverage(baseline,added))
    publish(args.feed,candidate/'data/guaguas',areas=('city',),network=network,
            city_pavement={'coverage':roads.coverage,'protected':roads.protected,'widening':added})
    atomic_write(output/'complete',b'city sectors and guagua bundles generated\n')


if __name__=='__main__':
    main()
