"""Write the static sector index consumed by the map viewer. Coordinates are metres."""
from collections import defaultdict
from hashlib import sha256
import json
from math import floor, ceil
from io import BytesIO
import re
from pathlib import Path

import sys
sys.path.insert(0,str(Path(".cache/pylib").resolve()))
from array import array
from PIL import Image
from shapely.geometry import Polygon, box
from shapely.ops import unary_union
from shapely.strtree import STRtree
from road_sections import select_sections
from carriageways import Carriageways, grade_separated, polygon_rings

SIZE = 240
ZONE = SIZE * 4
FAR = 60
ROOT = Path("public/data")


def parts(geometry):
    return [g for g in getattr(geometry, "geoms", [geometry]) if g.geom_type == "Polygon" and not g.is_empty]


def ring_of(polygon):
    return [[round(x, 1), round(y, 1)] for x, y in polygon.exterior.coords]


def far_blocks(buildings, tones):
    """Merge touching footprints into one prism per block: area-weighted height and roof tone."""
    shapes = []
    for b in buildings:
        shape = Polygon(b["rings"][0]).buffer(0)
        if not shape.is_empty:
            shapes.append((shape, b))
    if not shapes:
        return []
    tree = STRtree([s for s, _ in shapes])
    merged = unary_union([s.buffer(1.5, join_style="mitre") for s, _ in shapes]).buffer(-1.5, join_style="mitre")
    blocks = []
    for block in parts(merged):
        outline = Polygon(block.exterior).simplify(3)
        if outline.is_empty or outline.geom_type != "Polygon" or outline.area < 20:
            continue
        area = height = 0
        colour = [0, 0, 0]
        for i in tree.query(block):
            shape, b = shapes[i]
            if not block.contains(shape.representative_point()):
                continue
            tone = tones.get(str(b["id"]) + b.get("toneSuffix", ""), "#d4c8b6")
            area += shape.area
            height += shape.area * b.get("heightOverride", b["height"])
            for c in range(3):
                colour[c] += shape.area * int(tone[1 + 2 * c:3 + 2 * c], 16)
        if area:
            blocks.append(dict(ring=ring_of(outline), height=round(height / area, 1),
                               tone="#" + "".join(f"{round(c / area):02x}" for c in colour)))
    return blocks


def stress(copies):
    """Tile the city into a synthetic stage that only measures load. Never published."""
    data = json.loads((ROOT / "city.json").read_bytes())
    t = data["terrain"]
    dx, dy = t["w"] * t["step"], t["h"] * t.get("stepY", t["step"])
    columns = ceil(copies ** .5)
    rows = ceil(copies / columns)

    def shift(points, ox, oy):
        return [[x + ox, y + oy] for x, y in points]
    out = {"ground": [], "buildings": [], "roads": [], "surfaces": [], "trees": [], "focus": None}
    for i in range(copies):
        ox, oy = (i % columns) * dx, -(i // columns) * dy
        out["ground"] += [shift(r, ox, oy) for r in data["ground"]]
        out["trees"] += shift(data["trees"], ox, oy)
        out["buildings"] += [{**b, "rings": [shift(r, ox, oy) for r in b["rings"]]} for b in data["buildings"]]
        out["roads"] += [{**r, "id": r.get("id", "") + "/" + str(i), "line": shift(r["line"], ox, oy)} for r in data["roads"]]
        out["surfaces"] += [{**s, "id": s["id"] + "/" + str(i), "rings": [shift(r, ox, oy) for r in s["rings"]]} for s in data["surfaces"]]
    w, h = t["w"], t["h"]
    values = []
    for row in range(rows * h):
        values += t["values"][(row % h) * w:(row % h + 1) * w] * columns
    out["terrain"] = {**t, "w": w * columns, "h": h * rows, "values": values}
    x0, y1 = t["origin"][0] - t["step"] / 2, t["origin"][1] + t.get("stepY", t["step"]) / 2
    x1, y0 = x0 + columns * dx, y1 - rows * dy
    out["boundary"] = [[x0 + 1, y0 + 1], [x1 - 1, y0 + 1], [x1 - 1, y1 - 1], [x0 + 1, y1 - 1], [x0 + 1, y0 + 1]]
    (ROOT / "stress.json").write_bytes(encode(out))


def encode(value):
    return json.dumps(value, separators=(",", ":"), ensure_ascii=False).encode()


def write_versioned(directory, name, value):
    payload = encode(value)
    digest = sha256(payload).hexdigest()[:12]
    path = directory / f"{name}-{digest}.json"
    path.write_bytes(payload)
    return path.name


def lighter(building):
    """Drop the vertices that sit within the 0.1 m precision of the data from a straight wall.

    Municipal footprints carry a vertex wherever a neighbour meets the wall. Each one costs a wall face,
    a parapet and a roof triangle in the viewer without changing the outline."""
    rings = building["rings"]
    polygon = Polygon(rings[0], rings[1:])
    slim = polygon.simplify(0.1) if polygon.is_valid else polygon
    if slim.geom_type != "Polygon" or not slim.is_valid or len(slim.interiors) != len(rings) - 1:
        return building
    out = [[[round(x, 1), round(y, 1)] for x, y in ring.coords] for ring in (slim.exterior, *slim.interiors)]
    # The first vertex anchors the building to the terrain: keep it first.
    if out[0][0] != rings[0][0]:
        if rings[0][0] not in out[0]:
            return building
        at = out[0].index(rings[0][0])
        out[0] = out[0][at:-1] + out[0][:at] + [out[0][at]]
    return {**building, "rings": out}


DENSE = 240   # buildings in a 240 m sector from which neighbours are fused
FUSE_TOP, FUSE_BASE, FUSE_TONE, FUSE_MOST = 1.5, 1.5, 60, 4


def fused(buildings, altitude, tones):
    """For small screens in a dense sector, join neighbours that read as one volume: roofs within half a storey,
    the same ground, a close roof tone. The group takes the mean roof level of its members, weighted by area.

    The party walls, the parapets between two such roofs and the extra rooftop cabins of a row cost triangles
    and show almost nothing on a phone. A group holds at most FUSE_MOST buildings, so a street keeps changing
    colour, and every member is compared with the first one, so a slope cannot drift into a single slab."""
    plain = {"id", "rings", "height", "source"}
    shapes, facts = [], []
    for b in buildings:
        shape = Polygon(b["rings"][0], b["rings"][1:])
        base = altitude(*b["rings"][0][0])
        tone = tones.get(str(b["id"]), "#d4c8b6")
        shapes.append(shape)
        facts.append((base, base + b["height"], [int(tone[i:i + 2], 16) for i in (1, 3, 5)],
                      set(b) <= plain and shape.is_valid and shape.area > 4))
    tree = STRtree(shapes)
    taken, out = set(), []

    def like(seed, i):
        (b0, t0, c0, _), (b1, t1, c1, ok) = facts[seed], facts[i]
        return ok and abs(t1 - t0) <= FUSE_TOP and abs(b1 - b0) <= FUSE_BASE and max(abs(p - q) for p, q in zip(c0, c1)) <= FUSE_TONE

    for seed in sorted(range(len(buildings)), key=lambda i: -shapes[i].area):
        if seed in taken:
            continue
        taken.add(seed)
        group = [seed]
        if facts[seed][3]:
            queue = [seed]
            while queue and len(group) < FUSE_MOST:
                at = queue.pop(0)
                reach = shapes[at].exterior.buffer(0.15)
                for i in sorted(tree.query(reach), key=lambda i: -shapes[i].area):
                    i = int(i)
                    if len(group) == FUSE_MOST:
                        break
                    if i in taken or not like(seed, i) or reach.intersection(shapes[i].exterior).length < 2:
                        continue
                    taken.add(i)
                    group.append(i)
                    queue.append(i)
        b = buildings[seed]
        if len(group) > 1:
            joined = unary_union([shapes[i].buffer(0.06, join_style="mitre") for i in group]).buffer(-0.06, join_style="mitre").simplify(0.1)
            if joined.geom_type == "Polygon" and joined.is_valid:
                rings = [[[round(x, 1), round(y, 1)] for x, y in ring.coords]
                         for ring in (joined.exterior, *(r for r in joined.interiors if Polygon(r).area > 1))]
                # The first vertex anchors the building to the terrain: stay on the seed's, or the nearest left.
                first = b["rings"][0][0]
                at = min(range(len(rings[0]) - 1), key=lambda k: (rings[0][k][0] - first[0]) ** 2 + (rings[0][k][1] - first[1]) ** 2)
                rings[0] = rings[0][at:-1] + rings[0][:at] + [rings[0][at]]
                top = sum(facts[i][1] * shapes[i].area for i in group) / sum(shapes[i].area for i in group)
                out.append({**b, "rings": rings, "height": round(top - altitude(*rings[0][0]), 2)})
                continue
            taken.difference_update(group[1:])
        out.append(b)
    return out


def partition(stage, road_cells=None):
    data = json.loads((ROOT / f"{stage}.json").read_bytes())
    directory = ROOT / f"{stage}-sectors"
    directory.mkdir(exist_ok=True)
    tiles = defaultdict(lambda: {"buildings": [], "trees": [], "props": [], "ground": [], "roads": [], "surfaces": []})

    def cell(x, y):
        return floor(x / SIZE), floor(y / SIZE)

    owners = []
    for building in data["buildings"]:
        # A single owner preserves walls and courtyards across cell boundaries.
        ring = building["rings"][0]
        xs, ys = zip(*ring)
        center = ((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2)
        key = cell(*center)
        owners.append(f"{key[0]}_{key[1]}")
        tiles[key]["buildings"].append(lighter(building))
    # The same bilinear reading of the terrain as the viewer, to compare roof and ground levels.
    relief = data["terrain"]
    def altitude(x, y):
        col = min(max((x - relief["origin"][0]) / relief["step"], 0), relief["w"] - 1.001)
        row = min(max((relief["origin"][1] - y) / (relief.get("stepY") or relief["step"]), 0), relief["h"] - 1.001)
        i, u, t, v, w = floor(row) * relief["w"] + floor(col), col % 1, row % 1, relief["values"], relief["w"]
        return (v[i] * (1 - u) + v[i + 1] * u) * (1 - t) + (v[i + w] * (1 - u) + v[i + w + 1] * u) * t
    roof_tones = json.loads((ROOT / "roof-tones.json").read_bytes())["tones"]
    # The fused list rides beside the full one: the small-screen profile draws it, the zones and the desktop do not.
    for name, detail in tiles.items():
        if len(detail["buildings"]) >= DENSE:
            detail["fused"] = fused(detail["buildings"], altitude, roof_tones)
            print("dense sector", name, len(detail["buildings"]), "buildings,", len(detail["fused"]), "fused")
    for point in data["trees"]:
        tiles[cell(*point)]["trees"].append(point)
    # Port objects mapped in OpenStreetMap: kind, easting, northing, heading and size.
    for prop in data.get("props", []):
        tiles[cell(prop[1], prop[2])]["props"].append(prop)

    for ring in data["ground"]:
        xs, ys = zip(*ring)
        tiles[cell((min(xs)+max(xs))/2,(min(ys)+max(ys))/2)]["ground"].append(ring)
    for layer in ("roads","surfaces"):
        for feature in data[layer]:
            chain = feature["line"] if layer=="roads" else feature["rings"][0]
            xs,ys=zip(*chain)
            # Include nearby strokes so filtering across the border samples the same colour.
            x0,y0=cell(min(xs)-9,min(ys)-9)
            x1,y1=cell(max(xs)+9,max(ys)+9)
            for x in range(x0,x1+1):
                for y in range(y0,y1+1):
                    if (x,y) in tiles:
                        tiles[x,y][layer].append(feature)
    published = stage == "city"
    palette = json.loads((ROOT/"roof-tones.json").read_bytes())
    west,south,width,height=palette["bounds"]
    atlas=Path(".cache/roof-atlas.png")
    roof=Image.open(atlas) if published and atlas.exists() else None
    # Without the orthophoto atlas (a checkout with no cache) each sector keeps its published roof tile.
    # That holds only while its buildings, and so the tile bounds, are unchanged.
    kept={}
    if published and roof is None:
        for path in (ROOT/"city-sectors").glob("*.json"):
            old=json.loads(path.read_bytes())
            kept[path.name.rsplit("-",1)[0]]=(old.get("roofBounds"),old.get("roofFile"))
    carriageways = Carriageways(data)
    sample_cells=set()
    if published:
        samples=select_sections(data,carriageways,SIZE)
        lab=ROOT/"road-width-lab"
        lab.mkdir(exist_ok=True)
        (lab/"sections.json").write_bytes(encode(samples))
        sample_cells={s["cell"] for s in samples.values()}
    entries = []
    generated = set()
    for (cx, cy), detail in sorted(tiles.items()):
        name = f"{cx}_{cy}"
        points = [p for b in detail["buildings"] for p in b["rings"][0]]
        points.extend(detail["trees"])
        # A quay crane reaches about 60 m from its place.
        points.extend([p[1] + dx, p[2] + dy] for p in detail["props"] for dx in (-60, 60) for dy in (-60, 60))
        points.extend(p for ring in detail["ground"] for p in ring)
        xs, ys = zip(*points)
        bounds = [min(xs) - 7, min(ys) - 7, max(xs) + 7, max(ys) + 7]
        detail["textureBounds"]=[cx*SIZE-5,cy*SIZE-5,(cx+1)*SIZE+5,(cy+1)*SIZE+5]
        if road_cells is None or name in road_cells:
            detail["carriageway"]=carriageways.tile(detail,[cx*SIZE,cy*SIZE,(cx+1)*SIZE,(cy+1)*SIZE])
        if name in sample_cells:
            baseline=carriageways.tile(detail,[cx*SIZE,cy*SIZE,(cx+1)*SIZE,(cy+1)*SIZE],original=True)
            (lab/(name+".json")).write_bytes(encode(baseline))
        left,bottom,right,top=floor(min(xs))-2,floor(min(ys))-2,ceil(max(xs))+2,ceil(max(ys))+2
        roof_file=None
        if roof:
            tile=roof.crop((left-west,south+height-top,right-west,south+height-bottom))
            image=BytesIO()
            tile.save(image,"WEBP",quality=85)
            payload=image.getvalue()
            roof_file=f"{name}-{sha256(payload).hexdigest()[:12]}.webp"
            (directory/roof_file).write_bytes(payload)
            detail["roofBounds"]=[left,bottom,right-left,top-bottom]
            detail["roofFile"]=roof_file
        elif published:
            bounds_then,roof_file=kept.get(name,(None,None))
            if bounds_then!=[left,bottom,right-left,top-bottom] or not (directory/roof_file).exists():
                raise SystemExit(f"Sector {name} needs a new roof tile: run roof-colours.py to build .cache/roof-atlas.png")
            detail["roofBounds"]=bounds_then
            detail["roofFile"]=roof_file
        file = write_versioned(directory, name, detail)
        # Elevation samples cover every object in the ownership bounds, including overhang.
        d=data["terrain"]
        ix0=max(0,floor((bounds[0]-d["origin"][0])/d["step"])-1)
        ix1=min(d["w"],ceil((bounds[2]-d["origin"][0])/d["step"])+2)
        iy0=max(0,floor((d["origin"][1]-bounds[3])/d["stepY"])-1)
        iy1=min(d["h"],ceil((d["origin"][1]-bounds[1])/d["stepY"])+2)
        samples=[v for iy in range(iy0,iy1) for v in d["values"][iy*d["w"]+ix0:iy*d["w"]+ix1]]
        tallest=max((b.get("heightOverride",b["height"]) for b in detail["buildings"]),default=0)
        tallest=max([tallest]+[90*p[4] if p[0]=="crane" else p[4] for p in detail["props"]])
        vertical=[min(samples)-5,max(samples)+max(50,tallest+6)]
        entries.append(dict(id=name, bounds=bounds, vertical=vertical, file=file))
        generated.update(f for f in (file, roof_file) if f)
    # Zones hold the per-building overview and the collision footprints, fetched on demand.
    def zone_of(cx, cy):
        return cx // 4, cy // 4
    zones = defaultdict(lambda: {"buildings": [], "owners": [], "trees": [], "props": [], "ground": []})
    for (cx, cy), detail in sorted(tiles.items()):
        zone = zones[zone_of(cx, cy)]
        zone["buildings"] += detail["buildings"]
        zone["owners"] += [f"{cx}_{cy}"] * len(detail["buildings"])
        zone["trees"] += detail["trees"]
        zone["props"] += detail["props"]
        zone["ground"] += detail["ground"]
    zone_directory = ROOT / f"{stage}-zones"
    zone_directory.mkdir(exist_ok=True)
    land = Polygon(data["boundary"]).buffer(0)
    zone_entries, far, zone_files = [], {}, set()
    for (zx, zy), zone in sorted(zones.items()):
        name = f"{zx}_{zy}"
        square = [zx * ZONE, zy * ZONE, (zx + 1) * ZONE, (zy + 1) * ZONE]
        # The zone paints its ground from its own streets: the whole city's coverage would be traced for each one.
        zone["coverage"] = polygon_rings(carriageways.coverage.intersection(box(square[0] - 8, square[1] - 8, square[2] + 8, square[3] + 8)))
        file = write_versioned(zone_directory, name, zone)
        zone_files.add(file)
        members = [e for e in entries if zone_of(*map(int, e["id"].split("_"))) == (zx, zy)]
        zone_entries.append(dict(id=name, bounds=square, file=file,
                                 vertical=[min(e["vertical"][0] for e in members), max(e["vertical"][1] for e in members)]))
        ground = []
        for gx in range(square[0], square[2], FAR):
            for gy in range(square[1], square[3], FAR):
                ground += [ring_of(p) for p in parts(land.intersection(box(gx, gy, gx + FAR, gy + FAR))) if p.area > 1]
        far[name] = dict(blocks=far_blocks(zone["buildings"], palette["tones"]), ground=ground)
    for path in zone_directory.iterdir():
        if re.fullmatch(r"-?\d+_-?\d+-[0-9a-f]{12}\.json", path.name) and path.name not in zone_files:
            path.unlink()
    # The core is everything the viewer needs before any zone arrives.
    terrain = data["terrain"]
    (ROOT / f"{stage}-terrain.bin").write_bytes(array("h", [round(v * 10) for v in terrain["values"]]).tobytes())
    core = dict(boundary=data["boundary"], roads=data["roads"], surfaces=data["surfaces"], focus=data.get("focus"),
                terrain={**{k: v for k, v in terrain.items() if k != "values"}, "file": f"{stage}-terrain.bin"}, far=far)
    (ROOT / f"{stage}-core.json").write_bytes(encode(core))
    # The same footprint index serves collision, the low LOD and the route graph.
    # Detail files remain independently cacheable on static hosting.
    index = dict(sectors=entries, sectorSize=SIZE, zones=zone_entries, zoneSize=ZONE, buildingCount=len(owners), carriageways=True,
                 roadCoverage=polygon_rings(carriageways.coverage.simplify(1.5)), roadFallback=carriageways.fallback(), roadExceptions=sorted({r["id"] for r in data["roads"] if grade_separated(r)}))
    (ROOT / f"{stage}-index.json").write_bytes(encode(index))
    for path in directory.iterdir():
        if re.fullmatch(r"-?\d+_-?\d+-[0-9a-f]{12}\.(json|webp)",path.name) and path.name not in generated:
            path.unlink()
    print(stage, len(entries), "sectors", len(data["buildings"]), "building parts")


if __name__ == "__main__":
    if "--stress" in sys.argv:
        stress(int(sys.argv[sys.argv.index("--stress") + 1]))
        partition("stress")
    else:
        partition("city", {"-2_-2","-1_-2"} if "--road-pilot" in sys.argv else None)
