"""Prepare the visual lab from the current city export and its existing local caches."""
import json
import math
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(".cache/pylib").resolve()))
from PIL import Image, ImageFilter
from pyproj import Transformer
from shapely import STRtree, total_bounds
from shapely.geometry import Polygon, LineString, Point, box

out = Path("src/lab/samples")
out.mkdir(exist_ok=True)
read = lambda name: json.loads(Path(name).read_bytes())
city = read("public/data/city.json")
places = {f["properties"]["id"]: f["properties"]["xy"] for f in read("public/data/poi.geojson")["features"]}
buildings, roads, trees = (city[k] for k in ("buildings", "roads", "trees"))
polys = [Polygon(b["rings"][0], b["rings"][1:]).buffer(0) for b in buildings]
lines = [LineString(r["line"]) for r in roads]
points = [Point(p) for p in trees]
bi, ri, ti = map(STRtree, (polys, lines, points))
tags, leaves = {}, {}
proj = Transformer.from_crs(4326, 32628, always_xy=True)
ox, oy = proj.transform(-15.415, 28.105)
files = sorted(Path(".cache/sources").glob("osm-*.xml"))
if not files:
    raise RuntimeError("Missing local OSM source cache")
for file in files:
    for _, e in ET.iterparse(file, events=["end"]):
        if e.tag not in ("node", "way", "relation"):
            continue
        t = {v.get("k"): v.get("v") for v in e.findall("tag")}
        if e.tag == "way" and "surface" in t:
            tags[e.get("id")] = t["surface"]
        if e.tag == "node" and t.get("natural") == "tree" and ("leaf_type" in t or "species" in t):
            x, y = proj.transform(float(e.get("lon")), float(e.get("lat")))
            leaves[round(x-ox, 1), round(y-oy, 1)] = [t.get("leaf_type"), t.get("species")]
        e.clear()

def elevation(p):
    d = city["terrain"]
    x = min(d["w"]-1.001, max(0, (p[0]-d["origin"][0])/d["step"]))
    y = min(d["h"]-1.001, max(0, (d["origin"][1]-p[1])/d["stepY"]))
    i = int(y)*d["w"]+int(x)
    z = d["values"]
    a, b = x%1, y%1
    return (1-b)*((1-a)*z[i]+a*z[i+1])+b*((1-a)*z[i+d["w"]]+a*z[i+d["w"]+1])

def slope(i):
    z = [elevation(p) for p in buildings[i]["rings"][0]]
    return max(z)-min(z)

steep = max((i for i,b in enumerate(buildings) if not b.get("landmark") and 60<polys[i].area<1800), key=slope)
triana = next(r for r in roads if r.get("name") == "Calle Mayor de Triana")
centers = {"mercado":places["mercado-de-vegueta"], "santa-ana":places["santa-ana"],
           "triana":list(LineString(triana["line"]).interpolate(.5,normalized=True).coords[0]),
           "doramas":places["parque-doramas"], "pendio":list(polys[steep].representative_point().coords[0])}
atlas = Image.open(".cache/roof-atlas.png")
west,south,_,height = read("public/data/roof-tones.json")["bounds"]
for name,center in centers.items():
    x,y = map(round, center)
    r = 105
    bounds = [x-r,y-r,x+r,y+r]
    area = box(*bounds)
    selected = sorted(map(int,bi.query(area,predicate="intersects")))
    faces = {}
    for i in selected:
        b = buildings[i]
        edges = []
        for a,c in zip(b["rings"][0], b["rings"][0][1:]):
            edge = LineString([a,c])
            if edge.length < 1:
                edges.append(None)
                continue
            mid = edge.interpolate(.5,normalized=True)
            # Only visible nearby street axes qualify as a frontage.
            street = False
            for road in ri.query(mid.buffer(16)):
                axis = lines[road]
                hit = axis.interpolate(axis.project(mid))
                sight = LineString([mid,hit])
                if sight.length <= 16 and all(sight.intersection(polys[k]).length<.5 for k in bi.query(sight)):
                    street = True
                    break
            spans = []
            for k in bi.query(edge.buffer(.35)):
                if i == k: continue
                overlap = edge.intersection(polys[k].buffer(.35))
                for part in getattr(overlap,"geoms",[overlap]):
                    if part.geom_type != "LineString" or part.length < 1: continue
                    limits = sorted(edge.project(Point(p),normalized=True) for p in (part.coords[0],part.coords[-1]))
                    other = buildings[k]
                    spans.append([round(v,3) for v in [*limits,elevation(other["rings"][0][0])+other.get("heightOverride",other["height"])]])
            edges.append([int(street),spans] if street or spans else None)
        faces[str(i)] = edges
    vegetation = {}
    for i in ti.query(area):
        near = sorted((points[i].distance(points[j]),int(j)) for j in ti.query(points[i].buffer(14)) if j!=i)
        aligned = False
        if len(near)>=2:
            u,v = (trees[j] for _,j in near[:2])
            a,b = trees[i]
            aligned = (u[0]-a)*(v[0]-a)+(u[1]-b)*(v[1]-b)<-.82*near[0][0]*near[1][0]
        vegetation[str(i)] = [1 if aligned else 2 if len(near)>=4 else 0,*leaves.get(tuple(trees[i]),[None,None])]
    relevant = [roads[i]["id"] for i in ri.query(area)]
    sample = dict(center=center,bounds=bounds,faces=faces,trees=vegetation,
                  surfaces={k:tags[k] for k in relevant if k in tags})
    sample["buildings"] = [[buildings[i]["id"], *buildings[i]["rings"][0][0]] for i in selected]
    sample["treePositions"] = [trees[int(i)] for i in sorted(vegetation,key=int)]
    sample["focus"] = steep if name=="pendio" else min(selected,key=lambda i:polys[i].distance(Point(center)))
    # Pad to cover complete roofs whose footprints cross the sample boundary.
    left,bottom,right,top = total_bounds([area, *(polys[i] for i in selected)])
    minx,miny,maxx,maxy = map(round,(left-4,bottom-4,right+4,top+4))
    sample["roofBounds"]=[minx,miny,maxx,maxy]
    (out/(name+".json")).write_text(json.dumps(sample,separators=(",",":")),encoding="utf8")
    atlas.crop((minx-west,south+height-maxy,maxx-west,south+height-miny)).filter(ImageFilter.GaussianBlur(2)).save(out/(name+".webp"),quality=85)
    print(name,len(selected),len(vegetation))
