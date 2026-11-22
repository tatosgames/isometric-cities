"""Validate the delivered carriageways against their neighbour and the protected OSM crossings."""
import json
import sys
from collections import defaultdict
from pathlib import Path
sys.path.insert(0,str(Path(".cache/pylib").resolve()))
from shapely import STRtree, union_all
from shapely.geometry import Polygon, LineString, box
from carriageways import grade_separated, Carriageways
root=Path("public/data")
index=json.loads((root/"city-index.json").read_bytes())
city=json.loads((root/"city.json").read_bytes())
special=[r for r in city["roads"] if grade_separated(r)]
assert set(index["roadExceptions"])=={r["id"] for r in special}
protected=STRtree([LineString(r["line"]).buffer(8-0.001) for r in special])
seams=defaultdict(dict)
meshed=set()
count=0
roads=Carriageways(city)
samples=json.loads((root/"road-width-lab/sections.json").read_bytes())
assert set(samples)=={"ordinaria","principale","vincolata"}

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
    assert added.intersection(roads.obstacles.intersection(bounds).buffer(-.001)).area<1e-6,(cell,"obstacle")
    assert added.difference(roads.land.intersection(bounds).buffer(.001)).area<1e-6,(cell,"land")
    for kind,s in samples.items():
        if s["cell"]!=entry["id"]:continue
        (ax,ay),(bx,by)=s["line"];cx,cy=(ax+bx)/2,(ay+by)/2
        nx,ny=(ay-by)/10,(bx-ax)/10
        radius=max(s["sides"])+.1  # End the transect before the adjacent carriageway.
        section=LineString([(cx-radius*nx,cy-radius*ny),(cx+radius*nx,cy+radius*ny)])
        cut=surface.intersection(section)
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
expected={(-2,-2),(-1,-2)} if "--road-pilot" in sys.argv else {tuple(map(int,e["id"].split("_"))) for e in index["sectors"]}
assert meshed==expected,("missing or unexpected mesh sectors",meshed^expected)
checked=0
for pair,by_cell in seams.items():
    if not all(c in meshed for c in pair):continue
    a,b=(by_cell[k] for k in pair)
    for source,target in [(a,b),(b,a)]:
        assert all(any(abs(x-u)<=.01 and abs(y-v)<=.01 for u,v in target) for x,y in source),(pair,a,b)
    checked+=bool(a)
print(len(meshed),"sectors;",count,"triangles;",checked,"road seams;",len(set(index['roadExceptions'])),"grade exceptions")
