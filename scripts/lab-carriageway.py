"""Bake the driver's test carriageway against the actual triangles of the Mercado terrain."""
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(".cache/pylib").resolve()))
from shapely import constrained_delaunay_triangles, union_all
from shapely.geometry import LineString, Polygon, box

city = json.loads(Path("public/data/city.json").read_bytes())
bounds = json.loads(Path("src/lab/mercado.json").read_bytes())["bounds"]
sample = box(*bounds)
footways = {"steps", "footway", "path", "pedestrian", "cycleway"}
roads = []
for road in city["roads"]:
    if road["kind"] in footways:
        continue
    line = LineString(road["line"])
    width = 8 if road["kind"] in {"primary", "secondary", "trunk"} else 4.5
    if line.distance(sample) <= width / 2:
        roads.append(line.buffer(width / 2, quad_segs=8))
coverage = union_all(roads).intersection(sample)
rings = [r for r in city["ground"] if Polygon(r).intersects(sample)]
# Match ShapeGeometry's winding and diagonal, including clipped edge cells.
js = """
import {Shape,ShapeGeometry,Vector2} from 'three';
import {readFileSync} from 'node:fs';
const triangles=[];
for(const ring of JSON.parse(readFileSync(0,'utf8'))){
  const g=new ShapeGeometry(new Shape(ring.map(p=>new Vector2(...p)))).toNonIndexed();
  const a=g.attributes.position;
  for(let i=0;i<a.count;i+=3)triangles.push([i,i+1,i+2].map(j=>[a.getX(j),a.getY(j)]));
}
console.log(JSON.stringify(triangles));
"""
triangles = json.loads(subprocess.check_output(["node","--input-type=module","-e",js],input=json.dumps(rings).encode()))
dem = city["terrain"]
def altitude(x,y):
    u = min(dem["w"]-1.001,max(0,(x-dem["origin"][0])/dem["step"]))
    v = min(dem["h"]-1.001,max(0,(dem["origin"][1]-y)/dem["stepY"]))
    i = int(v)*dem["w"]+int(u)
    z,w = dem["values"],dem["w"]
    a,b = u%1,v%1
    return (1-b)*((1-a)*z[i]+a*z[i+1])+b*((1-a)*z[i+w]+a*z[i+w+1])

vertices = []
for corners in triangles:
    patch = coverage.intersection(Polygon(corners))
    if patch.area < 1e-7:
        continue
    (ax,ay),(bx,by),(cx,cy) = corners
    za,zb,zc = [altitude(*p) for p in corners]
    det = (bx-ax)*(cy-ay)-(cx-ax)*(by-ay)
    for tri in constrained_delaunay_triangles(patch).geoms:
        # North maps to world -Z. CCW in the map plane yields upward normals
        # for directional-light shadow bias as well as diffuse lighting.
        coords = list(tri.exterior.coords)[:3]
        for x,y in (coords if tri.exterior.is_ccw else reversed(coords)):
            b = ((x-ax)*(cy-ay)-(y-ay)*(cx-ax))/det
            c = ((bx-ax)*(y-ay)-(by-ay)*(x-ax))/det
            vertices.extend((round(x,3),round(za+b*(zb-za)+c*(zc-za),4),round(-y,3)))
polygons = [p for p in getattr(coverage,"geoms",[coverage]) if p.geom_type=="Polygon"]
outlines = [[[[round(x,3),round(y,3)] for x,y in contour.coords] for contour in [p.exterior,*p.interiors]] for p in polygons]
Path("src/lab/mercado-carriageway.json").write_text(json.dumps(dict(vertices=vertices,outlines=outlines),separators=(",",":")),encoding="utf8")
print(len(vertices)//9,"road triangles")
