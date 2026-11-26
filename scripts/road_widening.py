"""Precompute extra carriageway strips along the road intervals matched by GTFS."""
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from functools import lru_cache
import math
import re

from shapely import clip_by_rect, get_parts, make_valid, union_all
from shapely.geometry import LineString, Point, Polygon, box
from shapely.strtree import STRtree


BUILDING_MARGIN = .50
SCAN = 13.
TILE = 200.
TAPER = 10.
MIN_RUN = 30.
EPS = .001
DIVIDER = .15


def polygon_parts(geometry):
    if geometry.is_empty:
        return
    if geometry.geom_type == "Polygon":
        yield geometry
    elif hasattr(geometry, "geoms"):
        for part in geometry.geoms:
            yield from polygon_parts(part)


def index_mask(geometry):
    return STRtree(list(polygon_parts(geometry)))


def within_bounds(index, bounds):
    x0, y0, x1, y1 = bounds
    polygons = []
    for hit in index.query(box(*bounds)):
        clipped = clip_by_rect(index.geometries[hit], x0, y0, x1, y1)
        if not clipped.is_valid:
            clipped = make_valid(clipped)
        polygons.extend(polygon_parts(clipped))
    return union_all(polygons)


def line_hits(hit, origin, normal):
    if hit.is_empty:
        return
    if hasattr(hit, "geoms"):
        for part in hit.geoms:
            yield from line_hits(part, origin, normal)
        return
    x, y = origin
    nx, ny = normal
    values = [(px - x)*nx + (py - y)*ny for px, py in hit.coords]
    yield min(values), max(values)


def meters(tag):
    if isinstance(tag, (int, float)):
        value = tag
    elif isinstance(tag, str) and re.fullmatch(r"\d+(?:\.\d+)?\s*m?", tag.strip()):
        value = float(tag.strip().removesuffix("m"))
    else:
        return None
    return value if 1 <= value <= 50 else None


def width_limit(tags, main, reviewed):
    if reviewed is not None:
        return .40, reviewed, "ortofoto"
    explicit = meters(tags.get("width"))
    if explicit is not None:
        return .40, explicit, "larghezza OSM"
    lanes = tags.get("lanes", "")
    if re.fullmatch(r"[1-8]", str(lanes)):
        return .40, int(lanes)*(3.25 if main else 3), "stima da corsie"
    return .20, math.inf, "solo spazio geometrico"


def intervals_for(axis, paths):
    """Resolve matching pieces on clipped road geometry, keeping gaps on the axis."""
    ranges = []
    for path in paths:
        overlap = axis.intersection(path.buffer(.06, cap_style="flat"))
        for part in get_parts(overlap):
            if part.geom_type != "LineString" or part.length < .05:
                continue
            a, b = sorted((axis.project(Point(part.coords[0])), axis.project(Point(part.coords[-1]))))
            if b - a >= .05:
                ranges.append((a, b))
    merged = []
    for start, end in sorted(ranges):
        if merged and start <= merged[-1][1] + .12:
            merged[-1] = (merged[-1][0], max(end, merged[-1][1]))
        else:
            merged.append((start, end))
    return merged


@dataclass
class Section:
    at: float
    center: tuple
    normal: tuple
    widths: tuple = (0., 0.)
    gains: list = field(default_factory=lambda: [0., 0.])
    source: str = ""
    rejection: str = ""

    def edge(self, side, offset):
        x, y = self.center
        nx, ny = self.normal
        sign = 1 if side == 0 else -1
        return x + sign*nx*offset, y + sign*ny*offset


def stations(axis, start, end):
    # Include axis vertices and shorten the sampling step around real bends.
    paths = list(axis.coords)
    vertices = [0.]
    for a, b in zip(paths, paths[1:]):
        vertices.append(vertices[-1] + math.dist(a, b))
    bends = []
    for i, (a, b, c) in enumerate(zip(paths, paths[1:], paths[2:]), 1):
        dot = (b[0]-a[0])*(c[0]-b[0])+(b[1]-a[1])*(c[1]-b[1])
        if dot < math.cos(math.radians(25))*math.dist(a,b)*math.dist(b,c):
            if start < vertices[i] < end:
                bends.append(vertices[i])
    boundaries = sorted({start, end, *[m for m in vertices if start < m < end],
                         *[m for b in bends for m in (b-5,b+5) if start < m < end]})
    result = [start]
    for a,b in zip(boundaries,boundaries[1:]):
        step = 2.5 if any(a-5 <= m <= b+5 for m in bends) else 5
        count = math.ceil((b-a)/step)
        result.extend(a + (b-a)*i/count for i in range(1,count+1))
    return result


def first_obstacle(intervals, width, side, *, extra=0.):
    space = SCAN - width
    for a, b in intervals:
        near, far = (a, b) if side == 0 else (-b, -a)
        if far >= width - EPS:
            space = min(space, max(0., near - width - extra))
    return space


def distribute(extra, available):
    left, right = available
    add_left = min(left, max(min(left, extra/2), extra - right))
    return [add_left, min(right, extra-add_left)]


def sections(axis, start, end, nominal, tags, main, reviewed, masks):
    result = []
    for at in stations(axis, start, end):
        point = axis.interpolate(at)
        a = axis.interpolate(max(0., at-.65))
        b = axis.interpolate(min(axis.length, at+.65))
        dx, dy = b.x-a.x, b.y-a.y
        length = math.hypot(dx,dy)
        if length < EPS or (result and at-result[-1].at < EPS):
            continue
        section = Section(at, (point.x, point.y), (-dy/length, dx/length))
        result.append(section)
        current, blocked, ground = masks(math.floor(point.x/TILE),math.floor(point.y/TILE))
        if blocked.covers(point) or not ground.covers(point):
            section.rejection = "asse vincolato"
            continue
        ray = LineString([section.edge(1, SCAN), section.edge(0, SCAN)])
        asphalt = list(line_hits(current.intersection(ray), section.center, section.normal))
        central = [(lo, hi) for lo,hi in asphalt if lo <= EPS and hi >= -EPS]
        if len(central) != 1:
            section.rejection = "asse fuori asfalto"
            continue
        lo, hi = central[0]
        current_left, current_right = hi, -lo
        if min(current_left, current_right)<.50 or max(current_left,current_right)>nominal+.25:
            section.rejection = "incrocio o carreggiate sovrapposte"
            continue
        section.widths = current_left, current_right
        clipped = [*line_hits(ray.intersection(blocked), section.center, section.normal),
                   *line_hits(ray.difference(ground), section.center, section.normal)]
        room = [first_obstacle(clipped, width, side) for side,width in enumerate(section.widths)]
        for near,far in asphalt:
            if near > hi+EPS:
                room[0]=min(room[0],max(0., (near-hi-DIVIDER)/2))
            if far < lo-EPS:
                room[1]=min(room[1],max(0., (lo-far-DIVIDER)/2))
        measured = [value for span,value in reviewed if span[0] <= at <= span[1]]
        fraction, limit, source = width_limit(tags, main, min(measured) if measured else None)
        section.source = source
        current_width = sum(section.widths)
        extra = min(current_width*fraction, max(0., limit-current_width), sum(room))
        section.gains = distribute(extra, room)
        if extra < .05:
            section.rejection = "larghezza già adeguata" if limit-current_width<.05 else "fascia libera assente"
    return result


def useful_runs(samples):
    run = []
    for sample in samples:
        if sample.rejection:
            if run:
                yield run
                run = []
        else:
            run.append(sample)
    if run:
        yield run


def taper(run):
    start, end = run[0].at, run[-1].at
    for sample in run:
        ramp = min(1., (sample.at-start)/TAPER, (end-sample.at)/TAPER)
        sample.gains = [g*ramp for g in sample.gains]
    limit_slopes(run)


def limit_slopes(run):
    for i, j in ((0,1), (len(run)-1,-1)):
        for n in range(i+j,len(run) if j==1 else -1,j):
            prev, now = run[n-j],run[n]
            slope = .22*abs(now.at-prev.at)
            now.gains = [min(value,last+slope) for value,last in zip(now.gains,prev.gains)]


def panel(a, b, side):
    if max(a.gains[side], b.gains[side]) < EPS:
        return Polygon()
    # Overlap the current paving before subtracting its true outline.
    points = [a.edge(side,max(0.,a.widths[side]-.25)),
              a.edge(side,a.widths[side]+a.gains[side]),
              b.edge(side,b.widths[side]+b.gains[side]),
              b.edge(side,max(0.,b.widths[side]-.25))]
    polygon = Polygon(points)
    return polygon if polygon.is_valid else make_valid(polygon)


def exact_strip(run, masks, axis, nominal):
    """Validate complete strips between samples, shrinking where corner chords overrun."""
    bounds = box(min(s.center[0] for s in run)-SCAN,min(s.center[1] for s in run)-SCAN,
                 max(s.center[0] for s in run)+SCAN,max(s.center[1] for s in run)+SCAN)
    current, blocked, ground = masks(*bounds.bounds)
    nearby_other = current.difference(axis.buffer(nominal+.27)).buffer(.02)
    forbidden = blocked.union(bounds.difference(ground)).union(nearby_other)
    for attempt in range(5):
        pieces = []
        reduce = set()
        for i,(a,b) in enumerate(zip(run,run[1:])):
            for side in range(2):
                strip = panel(a,b,side).difference(current)
                if strip.is_empty:
                    continue
                # The tolerance is for topology noise at coincident mask edges.
                if strip.intersection(forbidden).area > 1e-7:
                    reduce.update(((i,side),(i+1,side)))
                else:
                    pieces.append(strip)
        if not reduce:
            combined = union_all(pieces)
            # Every new component must be attached to the existing asphalt.
            joined = [p for p in polygon_parts(combined) if p.boundary.intersection(current).length > .05]
            return union_all(joined)
        for index, side in reduce:
            run[index].gains[side] *= .5 if attempt<2 else 0.
        limit_slopes(run)
    return Polygon()


def build_widening(data, baseline, land, obstacles, protected, corridors, road_tags, overrides, barrios=None):
    from carriageways import STYLE, grade_separated

    current_index = index_mask(baseline)
    # Keep existing polygons out of the extra building setback calculation.
    setback = [make_valid(Polygon(b["rings"][0],b["rings"][1:])).buffer(BUILDING_MARGIN+EPS)
               for b in data["buildings"]]
    setback_index = STRtree(setback)
    obstacle_index = index_mask(obstacles)
    protected_index = index_mask(protected)
    land_index = index_mask(land)
    barrios = barrios or []
    names, shapes = [], []
    for area in barrios:
        for outer,*holes in area.get("polygons",[]):
            names.append(area["name"])
            shapes.append(make_valid(Polygon(outer,holes)))
    barrio_index = STRtree(shapes)

    def local_masks(x0,y0,x1,y1):
        bounds = x0,y0,x1,y1
        blocked = union_all([within_bounds(obstacle_index,bounds), within_bounds(protected_index,bounds),
                             within_bounds(setback_index,bounds)])
        return within_bounds(current_index,bounds), blocked, within_bounds(land_index,bounds)

    @lru_cache(maxsize=128)
    def tile(ix,iy):
        return local_masks(ix*TILE-18,iy*TILE-18,(ix+1)*TILE+18,(iy+1)*TILE+18)

    reviewed = defaultdict(list)
    for row in overrides:
        value = meters(row["width"])
        if value is None:
            raise ValueError(f'Invalid reviewed road width for {row["way"]}')
        reviewed[str(row["way"])].append((LineString(row["line"]), value))

    exclusions = Counter()
    accepted = []
    eligible = sorted((road for road in data["roads"] if str(road["id"]) in corridors),
                      key=lambda road:tuple(math.floor(v/TILE) for v in road["line"][0]))
    for position, road in enumerate(eligible,1):
        if position%250==0:
            print(f'Widening audit: {position}/{len(eligible)} road entries',flush=True)
        way = str(road["id"])
        physical = corridors.get(way)
        if not physical:
            continue
        axis = LineString(road["line"])
        ranges = intervals_for(axis, physical)
        if not ranges:
            continue
        if grade_separated(road) or road.get("portal") or road["kind"] in STYLE["pedestrian"]:
            exclusions["ponte, passaggio o portale"] += sum(end-start for start,end in ranges)
            continue
        main = road["kind"] in {*STYLE["main"],"motorway","motorway_link","trunk_link","primary_link","secondary_link"}
        nominal = STYLE["targetWidth"]["main" if road["kind"] in STYLE["main"] else "street"]/2
        width_tags = road_tags.get(way,{})
        checked = [(span,value) for line,value in reviewed[way] for span in intervals_for(axis,[line])]
        for start,end in ranges:
            if end-start < MIN_RUN+2*TAPER:
                exclusions["intervallo corto"] += end-start
                continue
            measured = sections(axis,start,end,nominal,width_tags,main,checked,tile)
            for a,b in zip(measured,measured[1:]):
                reason = a.rejection or b.rejection
                if reason:
                    exclusions[reason] += b.at-a.at
            for run in useful_runs(measured):
                length = run[-1].at-run[0].at
                if length < MIN_RUN+2*TAPER:
                    exclusions["fascia utile corta"] += length
                    continue
                taper(run)
                strip = exact_strip(run,local_masks,axis,nominal)
                if strip.is_empty:
                    exclusions["verifica poligono continuo"] += length
                    continue
                points = [s.center for s in run]
                middle = Point(points[len(points)//2])
                hits = barrio_index.query(middle,predicate="intersects")
                barrio = min((names[i] for i in hits),default="Fuori dai barrios catalogati")
                central = [s for s in run if run[0].at+TAPER<=s.at<=run[-1].at-TAPER]
                gain = [sum(s.gains[i] for s in central)/len(central) for i in range(2)] if central else [0.,0.]
                sources = sorted({s.source for s in central})
                accepted.append((strip, dict(way=way, strada=road.get("name") or "", quartiere=barrio,
                                             lunghezza_m=round(length,3), sx_m=round(gain[0],3),
                                             dx_m=round(gain[1],3), fonte=" / ".join(sources),
                                             area_m2=round(strip.area,3), asse=[list(p) for p in points])))

    # Two additions from different ways may share a narrow median. Reject
    # both proposals if the exact strips touch each other.
    strips = [shape for shape,_ in accepted]
    tree = STRtree(strips)
    conflicts = {i for i,strip in enumerate(strips) for j in tree.query(strip,predicate="intersects")
                 if i!=j and accepted[i][1]["way"]!=accepted[j][1]["way"]}
    additions = []
    applied = []
    by_road = defaultdict(Counter)
    by_barrio = defaultdict(Counter)
    for i,(strip,row) in enumerate(accepted):
        if i in conflicts:
            exclusions["nuove fasce adiacenti"] += row["lunghezza_m"]
            continue
        additions.append(strip)
        applied.append(row)
        for totals in (by_road[row["way"]],by_barrio[row["quartiere"]]):
            totals["lunghezza_m"] += row["lunghezza_m"]
            totals["area_m2"] += row["area_m2"]
    extra = union_all(additions)
    return extra, {
        "margine_edifici_m": BUILDING_MARGIN,
        "area_m2": round(extra.area,3),
        "lunghezza_m": round(sum(r["lunghezza_m"] for r in applied),3),
        "per_strada": {k:{a:round(v,3) for a,v in values.items()} for k,values in by_road.items()},
        "per_quartiere": {k:{a:round(v,3) for a,v in values.items()} for k,values in by_barrio.items()},
        "esclusioni_m": {k:round(v,3) for k,v in exclusions.items()},
        "tratti": applied,
    }
