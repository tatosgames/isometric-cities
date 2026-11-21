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
from PIL import Image

SIZE = 240
ROOT = Path("public/data")


def encode(value):
    return json.dumps(value, separators=(",", ":"), ensure_ascii=False).encode()


def write_versioned(directory, name, value):
    payload = encode(value)
    digest = sha256(payload).hexdigest()[:12]
    path = directory / f"{name}-{digest}.json"
    path.write_bytes(payload)
    return path.name


def partition(stage):
    data = json.loads((ROOT / f"{stage}.json").read_bytes())
    directory = ROOT / f"{stage}-sectors"
    directory.mkdir(exist_ok=True)
    tiles = defaultdict(lambda: {"buildings": [], "trees": [], "ground": [], "roads": [], "surfaces": []})

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
        tiles[key]["buildings"].append(building)
    for point in data["trees"]:
        tiles[cell(*point)]["trees"].append(point)

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
    roof=Image.open(".cache/roof-atlas.png")
    west,south,width,height=json.loads((ROOT/"roof-tones.json").read_bytes())["bounds"]
    entries = []
    generated = set()
    for (cx, cy), detail in sorted(tiles.items()):
        name = f"{cx}_{cy}"
        points = [p for b in detail["buildings"] for p in b["rings"][0]]
        points.extend(detail["trees"])
        points.extend(p for ring in detail["ground"] for p in ring)
        xs, ys = zip(*points)
        bounds = [min(xs) - 7, min(ys) - 7, max(xs) + 7, max(ys) + 7]
        detail["textureBounds"]=[cx*SIZE-5,cy*SIZE-5,(cx+1)*SIZE+5,(cy+1)*SIZE+5]
        left,bottom,right,top=floor(min(xs))-2,floor(min(ys))-2,ceil(max(xs))+2,ceil(max(ys))+2
        tile=roof.crop((left-west,south+height-top,right-west,south+height-bottom))
        image=BytesIO()
        tile.save(image,"WEBP",quality=85)
        payload=image.getvalue()
        roof_file=f"{name}-{sha256(payload).hexdigest()[:12]}.webp"
        (directory/roof_file).write_bytes(payload)
        detail["roofBounds"]=[left,bottom,right-left,top-bottom]
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
        vertical=[min(samples)-5,max(samples)+max(50,tallest+6)]
        entries.append(dict(id=name, bounds=bounds, vertical=vertical, file=file))
        generated.update((file, roof_file))
    # The same footprint index serves collision, the low LOD and the route graph.
    # Detail files remain independently cacheable on static hosting.
    index = dict(sectors=entries, sectorSize=SIZE, buildingOwners=owners)
    (ROOT / f"{stage}-index.json").write_bytes(encode(index))
    for path in directory.iterdir():
        if re.fullmatch(r"-?\d+_-?\d+-[0-9a-f]{12}\.(json|webp)",path.name) and path.name not in generated:
            path.unlink()
    print(stage, len(entries), "sectors", len(data["buildings"]), "building parts")


if __name__ == "__main__":
    partition("city")
