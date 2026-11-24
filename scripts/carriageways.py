"""Precompute indexed carriageways on the renderer's terrain faces in local metres."""
import json
import subprocess
from pathlib import Path

from shapely import make_valid, constrained_delaunay_triangles, union_all
from shapely.geometry import LineString, Point, Polygon, box

STYLE = json.loads(Path("src/data/road-style.json").read_bytes())
TRIANGULATE = """
import {Shape,ShapeGeometry,Vector2} from 'three';
import {readFileSync} from 'node:fs';
const rings=JSON.parse(readFileSync(0,'utf8'));
console.log(JSON.stringify(rings.map(r=>{
  const g=new ShapeGeometry(new Shape(r.map(p=>new Vector2(...p))));
  const a=g.attributes.position;
  return Array.from(g.index.array,i=>[a.getX(i),a.getY(i)]);
})));
"""

def grade_separated(road):
    return road.get("bridge","no") not in ("no","0","false") or road.get("layer","0") not in ("0","","+0")

def polygon_rings(mask):
    polygons=[p for p in getattr(mask,"geoms",[mask]) if p.geom_type=="Polygon" and not p.is_empty]
    return [[[[round(x,4),round(y,4)] for x,y in ring.coords] for ring in [p.exterior,*p.interiors]] for p in polygons]

class Carriageways:
    def __init__(self, data):
        self.dem=data["terrain"]
        shapes=[]
        old=[]
        obstacles=[make_valid(Polygon(f["rings"][0],f["rings"][1:])) for f in [*data["buildings"],*data["surfaces"]]]
        obstacles.extend(Point(x,y).buffer(.3) for x,y in data["trees"])
        protected=[]
        for road in data["roads"]:
            line=LineString(road["line"])
            if grade_separated(road):
                protected.append(line.buffer(8))
            if road["kind"] in STYLE["pedestrian"]:
                obstacles.append(line.buffer(STYLE["width"]["pedestrian"]/2))
            else:
                key="main" if road["kind"] in STYLE["main"] else "street"
                # A street that goes under ground ends square at the tunnel mouth; its other end meets
                # streets whose round caps already cover the joint.
                cap="flat" if road.get("portal") else "round"
                old.append(line.buffer(STYLE["width"][key]/2,quad_segs=8,cap_style=cap))
                shapes.append(line.buffer(STYLE["targetWidth"][key]/2,quad_segs=8,cap_style=cap))
        self.protected=union_all(protected)
        self.obstacles=union_all([*obstacles,self.protected])
        self.land=make_valid(Polygon(data["boundary"]))
        self.original=union_all(old).difference(self.protected)
        allowed=union_all(shapes).intersection(self.land).difference(self.obstacles)
        self.coverage=union_all([self.original,allowed])
        rings=data["ground"]
        faces=json.loads(subprocess.check_output(["node","--input-type=module","-e",TRIANGULATE],input=json.dumps(rings).encode()))
        self.faces={id(r):f for r,f in zip(rings,faces)}

    def fallback(self, bounds=None):
        mask=self.protected if bounds is None else self.protected.intersection(box(*bounds))
        return polygon_rings(mask)

    def elevation(self,x,y):
        d=self.dem
        u=min(d["w"]-1.001,max(0,(x-d["origin"][0])/d["step"]))
        v=min(d["h"]-1.001,max(0,(d["origin"][1]-y)/d["stepY"]))
        i=int(v)*d["w"]+int(u);z=d["values"];w=d["w"];a=u%1;b=v%1
        return (1-b)*((1-a)*z[i]+a*z[i+1])+b*((1-a)*z[i+w]+a*z[i+w+1])

    def tile(self,detail,bounds,original=False):
        tile=box(*bounds)
        coverage=(self.original if original else self.coverage).intersection(tile)
        fallback=self.fallback(detail["textureBounds"])
        ids={};positions=[];indices=[];seen=set()
        for ring in detail["ground"]:
            faces=self.faces[id(ring)]
            for j in range(0,len(faces),3):
                corners=faces[j:j+3]
                patch=Polygon(corners).intersection(coverage)
                if patch.area<1e-9:continue
                (ax,ay),(bx,by),(cx,cy)=corners
                za,zb,zc=[self.elevation(*p) for p in corners]
                det=(bx-ax)*(cy-ay)-(cx-ax)*(by-ay)
                for tri in constrained_delaunay_triangles(patch).geoms:
                    face=[]
                    for x,y in list(tri.exterior.coords)[:3]:
                        b=((x-ax)*(cy-ay)-(y-ay)*(cx-ax))/det
                        c=((bx-ax)*(y-ay)-(by-ay)*(x-ax))/det
                        face.append((round(x,4),round(za+b*(zb-za)+c*(zc-za),4),round(-y,4)))
                    a,b,c=face
                    cross=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2])
                    if abs(cross)<1e-8:continue
                    if cross<0:face.reverse()
                    key=tuple(sorted(face))
                    if key in seen:continue
                    seen.add(key)
                    for vertex in face:
                        if vertex not in ids:
                            ids[vertex]=len(ids);positions.extend(vertex)
                        indices.append(ids[vertex])
        return dict(positions=positions,indices=indices,fallback=fallback)
