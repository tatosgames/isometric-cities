"""Validate the delivered carriageways against their neighbour and the protected OSM crossings."""
import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path
sys.path.insert(0,str(Path(".cache/pylib").resolve()))
from shapely import STRtree, from_wkb, get_parts, make_valid, union_all
from shapely.geometry import Polygon, LineString, box
from carriageways import grade_separated, Carriageways
from city_layers import read_layers
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--root',type=Path,default=Path('public/data'))
parser.add_argument('--widening-added',type=Path,help='candidate widening strip from the isolated generator')
parser.add_argument('--baseline-root',type=Path,default=Path('public/data'),help='baseline meshes for candidate seam checks')
parser.add_argument('--road-pilot',action='store_true')
args=parser.parse_args()
root=args.root
index=json.loads((root/"city-index.json").read_bytes())
city=read_layers("city",root)
special=[r for r in city["roads"] if grade_separated(r)]
assert set(index["roadExceptions"])=={r["id"] for r in special}
protected=STRtree([LineString(r["line"]).buffer(8-0.001) for r in special])
seams=defaultdict(dict)
meshed=set()
count=0
roads=Carriageways(city, 'city')
obstacle_parts=get_parts(roads.obstacles)
obstacle_index=STRtree(obstacle_parts)
samples=json.loads((root/"road-width-lab/sections.json").read_bytes())
assert set(samples)=={"ordinaria","principale","vincolata"}
widening=STRtree(get_parts(from_wkb(args.widening_added.read_bytes()))) if args.widening_added else None
setbacks=STRtree([make_valid(Polygon(b["rings"][0],b["rings"][1:])).buffer(.499)
                   for b in city["buildings"]]) if widening is not None else None
verified_widening=0

for entry in index["sectors"]:
    cell=tuple(map(int,entry["id"].split("_")))
    data=json.loads((root/"city-sectors"/entry["file"]).read_bytes())
    if "carriageway" not in data:continue
    meshed.add(cell)
    road=data["carriageway"]
    v=list(zip(*[iter(road["positions"])]*3))
    coords=[(x,-z,h) for x,h,z in v]
    faces=set(); triangles=[]
    for i,j,k in zip(*[iter(road["indices"])]*3):
        pts=[coords[i],coords[j],coords[k]]
        (x,y,_),(u,w,_),(a,b,_)=pts
        assert (u-x)*(b-y)-(w-y)*(a-x)>0,(cell,i,j,k)
        key=tuple(sorted((i,j,k)))
        assert key not in faces
        faces.add(key)
        poly=Polygon([p[:2] for p in pts])
        assert not len(protected.query(poly,predicate='intersects')),(cell,i,j,k,"grade crossing")
        triangles.append(poly)
        count+=1
    surface=union_all(triangles)
    x,y=cell
    bounds=box(x*240,y*240,(x+1)*240,(y+1)*240)
    old=roads.original.intersection(bounds)
    added=surface.difference(old.buffer(.001))
    if not added.is_empty:
        # Clip the components that can reach the cell. Join before shrinking so
        # the test still checks the buffer of the same local obstacle union.
        local_obstacles=union_all([obstacle_parts[i].intersection(bounds) for i in obstacle_index.query(bounds)])
        assert added.intersection(local_obstacles.buffer(-.001)).area<1e-6,(cell,"obstacle")
        assert added.difference(roads.land.intersection(bounds).buffer(.001)).area<1e-6,(cell,"land")
    if widening is not None:
        expected_strip=union_all([widening.geometries[i].intersection(bounds) for i in widening.query(bounds)])
        if not expected_strip.is_empty:
            verified_widening+=1
            new_pavement=surface.difference(roads.coverage.intersection(bounds).buffer(.001))
            local_setback=union_all(setbacks.geometries[setbacks.query(bounds)])
            assert new_pavement.intersection(local_setback).area<1e-6,(cell,"new building setback")
            assert new_pavement.difference(expected_strip.buffer(.001)).area<.002,(cell,"unexpected candidate paving")
            assert expected_strip.difference(surface.buffer(.002)).area<.02,(cell,"candidate strip missing from mesh")
    for kind,s in samples.items():
        if s["cell"]!=entry["id"]:continue
        (ax,ay),(bx,by)=s["line"];cx,cy=(ax+bx)/2,(ay+by)/2
        nx,ny=(ay-by)/10,(bx-ax)/10
        radius=max(s["sides"])+.1  # End the transect before the adjacent carriageway.
        section=LineString([(cx-radius*nx,cy-radius*ny),(cx+radius*nx,cy+radius*ny)])
        cut=surface.intersection(section)
        if widening is None:
            assert abs(cut.length-sum(s["sides"]))<.01,(kind,cut.length)
            expected_width={"ordinaria":5,"principale":9,"vincolata":4.75}[kind]
            assert abs(cut.length-expected_width)<.01
        assert abs(old.intersection(section).length-s["before"])<.01
    for axis in (0,1):
        for side in (0,1):
            edge=(cell[axis]+side)*240
            pts=sorted({(p[1-axis],p[2]) for p in coords if abs(p[axis]-edge)<.0002})
            neighbor=list(cell);neighbor[axis]+=1 if side else -1;neighbor=tuple(neighbor)
            seams[tuple(sorted((cell,neighbor)))][cell]=pts
expected={(-2,-2),(-1,-2)} if args.road_pilot else {tuple(map(int,e["id"].split("_"))) for e in index["sectors"]}
assert meshed==expected,("missing or unexpected mesh sectors",meshed^expected)
checked=0
baseline_entries={}
if widening is not None:
    before=json.loads((args.baseline_root/'city-index.json').read_bytes())
    baseline_entries={tuple(map(int,row['id'].split('_'))):row['file'] for row in before['sectors']}
existing_breaks=0

def baseline_edge(cell,axis,edge):
    path=args.baseline_root/'city-sectors'/baseline_entries[cell]
    values=json.loads(path.read_bytes())['carriageway']['positions']
    coords=zip(values[::3],[-z for z in values[2::3]],values[1::3])
    return [(p[1-axis],p[2]) for p in coords if abs(p[axis]-edge)<.0002]

for pair,by_cell in seams.items():
    if not all(c in meshed for c in pair):continue
    a,b=(by_cell[k] for k in pair)
    axis=0 if pair[0][0]!=pair[1][0] else 1
    if widening is not None:
        edge=pair[1][axis]*240
    for side,source,target in [(0,a,b),(1,b,a)]:
        missing=[(x,y) for x,y in source if not any(abs(x-u)<=.01 and abs(y-v)<=.01 for u,v in target)]
        if missing and widening is not None:
            # A real outer road edge may coincide with a sector boundary.
            # Every exception must already appear at the same baseline pose.
            old_source=baseline_edge(pair[side],axis,edge)
            old_target=baseline_edge(pair[1-side],axis,edge)
            preexisting=set(old_source)-set(old_target)
            assert all(p in preexisting for p in missing),(pair,missing)
            existing_breaks+=len(missing)
        else:
            assert not missing,(pair,a,b)
    checked+=bool(a)
print(len(meshed),"sectors;",count,"triangles;",checked,"road seams;",len(set(index['roadExceptions'])),"grade exceptions")
if widening is not None:
    assert verified_widening
    print(verified_widening,"sectors with validated widening strips;",existing_breaks,"pre-existing seam exceptions")
