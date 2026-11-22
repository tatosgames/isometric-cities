"""Select measured street sections for the visual laboratory."""
from math import hypot
from shapely.geometry import LineString, Point
from shapely.prepared import prep
from carriageways import STYLE, grade_separated

def select_sections(city, roads, size):
    samples={}
    original=prep(roads.original)
    coverage=prep(roads.coverage)
    for r in city["roads"]:
        if grade_separated(r) or r["kind"] in STYLE["pedestrian"] or not r.get("name"):continue
        main=r["kind"] in STYLE["main"]
        key="main" if main else "street"
        half=STYLE["width"][key]/2
        target=STYLE["targetWidth"][key]/2
        for a,b in zip(r["line"],r["line"][1:]):
            dx,dy=b[0]-a[0],b[1]-a[1]
            length=hypot(dx,dy)
            if length<12:continue
            x,y=(a[0]+b[0])/2,(a[1]+b[1])/2
            if min(x%size,y%size,size-x%size,size-y%size)<45:continue
            nx,ny=-dy/length,dx/length
            def at(d):return Point(x+nx*d,y+ny*d)
            if not all(original.contains(at(sign*(half-.01))) and not original.contains(at(sign*(half+.01))) for sign in [-1,1]):continue
            line=LineString([at(-target-.1),at(target+.1)])
            if not coverage.contains(at(0)):continue
            cut=roads.coverage.intersection(line)
            if cut.geom_type!="LineString":continue
            offsets=sorted((px-x)*nx+(py-y)*ny for px,py in cut.coords)
            sides=[-offsets[0],offsets[-1]]
            free=[abs(d-target)<.002 for d in sides]
            if all(free):case="principale" if main else "ordinaria"
            elif not main and any(free) and abs(min(sides)-half)<.002:case="vincolata"
            else:continue
            if case in samples:continue
            samples[case]=dict(name=r["name"],way=r["id"],line=[[x-dx/length*5,y-dy/length*5],[x+dx/length*5,y+dy/length*5]],cell=f"{int(x//size)}_{int(y//size)}",before=2*half,sides=[round(d,3) for d in sides])
            if len(samples)==3:return samples
    return samples
