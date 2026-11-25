"""Extract the two-stop Vegueta trip segment from a local Guaguas Municipales GTFS ZIP."""
import argparse
import csv
import hashlib
import io
import json
import math
import sys
from pathlib import Path
from tempfile import NamedTemporaryFile
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / ".cache/pylib"))
from geo import origin, to_crs
from shapely import make_valid, union_all
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import substring

# Reviewed OSM ways in travel order through the pilot. The feed samples this
# corridor sparsely, along Calle Hernán Pérez de Grado.
ROAD_ID = "30913504"
STOP_IDS = ["73", "75"]
TRIP = "LA0130001"
SOURCE = "https://www.guaguas.com/transit/google_transit.zip"


def rows(archive, table):
    with archive.open(table + ".txt") as raw, io.TextIOWrapper(raw, encoding="utf-8-sig") as stream:
        yield from csv.DictReader(stream)


def check_sweep(path, city, style):
    # Sweep the entire 7.2 x 2.2 m body along every exported segment. Use the
    # original road widths shared by the pilot and city, including intersections.
    region = path.envelope.buffer(12)
    streets = []
    for road in city["roads"]:
        if road["kind"] in style["pedestrian"]:
            continue
        line = LineString(road["line"])
        if region.intersects(line):
            width = style["width"]["main" if road["kind"] in style["main"] else "street"]
            streets.append(line.buffer(width / 2))
    pavement = union_all(streets)
    obstacles = []
    for item in city["buildings"]:
        ring, *holes = item["rings"]
        footprint = Polygon(ring, holes)
        if region.intersects(footprint):
            obstacles.append(make_valid(footprint))
    obstacles.extend(Point(x, y).buffer(.3) for x, y in city["trees"] if region.covers(Point(x,y)))
    clear = pavement.intersection(Polygon(city["boundary"])).difference(union_all(obstacles))
    for a,b in zip(path.coords, list(path.coords)[1:]):
        dx, dy = b[0]-a[0], b[1]-a[1]
        length = math.hypot(dx, dy)
        ux, uy = dx/length, dy/length
        swept = Polygon([(x + f*ux - s*uy, y + f*uy + s*ux)
                         for (x,y), f, s in [(a,-3.6,1.1),(a,-3.6,-1.1),(b,3.6,-1.1),(b,3.6,1.1)]])
        if not clear.covers(swept):
            raise ValueError(f"Bus envelope leaves drivable area near {a}: {swept.difference(clear).area:.3f} m²")


def extract(feed):
    ox, oy = origin()
    project = to_crs()
    def metres(row, prefix):
        x,y = project.transform(float(row[prefix+"_lon"]), float(row[prefix+"_lat"]))
        return x-ox,y-oy
    with ZipFile(feed) as archive:
        trip = next(r for r in rows(archive,"trips") if r["trip_id"] == TRIP)
        route = next(r for r in rows(archive,"routes") if r["route_id"] == trip["route_id"])
        times = sorted((r for r in rows(archive,"stop_times") if r["trip_id"] == TRIP),
                       key=lambda r:int(r["stop_sequence"]))
        sequence = [r["stop_id"] for r in times]
        first = sequence.index(STOP_IDS[0])
        if sequence[first:first+2] != STOP_IDS:
            raise ValueError("Reviewed stops are no longer consecutive")
        stops = {r["stop_id"]: r for r in rows(archive,"stops") if r["stop_id"] in STOP_IDS}
        shape = sorted((r for r in rows(archive,"shapes") if r["shape_id"] == trip["shape_id"]),
                       key=lambda r:int(r["shape_pt_sequence"]))
        source = LineString([metres(row,"shape_pt") for row in shape])
    official = [Point(metres(stops[i],"stop")) for i in STOP_IDS]
    distances = [source.project(p) for p in official]
    if distances[0] >= distances[1] or any(source.distance(p)>12 for p in official):
        raise ValueError("Stop positions or direction have changed")
    city_dir = ROOT/"public/data"
    pilot = json.loads((city_dir/"pilot.json").read_bytes())
    roads = {road["id"]:road["line"] for road in pilot["roads"]}
    # Keep to the right in the direction of service on the surveyed OSM way.
    lane = LineString(roads[ROAD_ID]).offset_curve(-.45)
    start = lane.project(official[0]) - 11
    end = lane.project(official[1]) + 17
    if not 0 <= start < end <= lane.length or any(lane.distance(stop)>8 for stop in official):
        raise ValueError("Reviewed street no longer serves these stops")
    path = substring(lane, start, end)
    ref = substring(source, distances[0]-11, distances[1]+17)
    if path.hausdorff_distance(ref)>12:
        raise ValueError("Published shape has moved away from reviewed streets")
    coords = [[round(x,2),round(y,2)] for x,y in path.simplify(.03).coords]
    path = LineString(coords)
    style = json.loads((ROOT/"src/data/road-style.json").read_bytes())
    for city in [pilot, json.loads((city_dir/"city.json").read_bytes())]:
        check_sweep(path,city,style)
    return dict(line=route["route_short_name"],direction=trip["trip_headsign"],path=coords,
                stops=[dict(id=i,name=stops[i]["stop_name"],position=[round(v,2) for v in p.coords[0]],
                            distance=round(path.project(p),2)) for i,p in zip(STOP_IDS,official)],
                source=dict(url=SOURCE,sha256=hashlib.sha256(feed.read_bytes()).hexdigest(),
                            trip=TRIP,shape=trip["shape_id"],osmWays=[ROAD_ID]))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("zip",type=Path,nargs="?",default=ROOT/".cache/guaguas/feed.zip")
    parser.add_argument("--output",type=Path)
    parser.add_argument("--network",action="store_true",help="build the verified city and pilot fleet")
    args = parser.parse_args()
    if args.network:
        from guagua_network import publish
        publish(args.zip,args.output or ROOT/"public/data/guaguas")
        sys.exit(0)
    args.output=args.output or ROOT/"public/data/guaguas.json"
    data = extract(args.zip)
    with NamedTemporaryFile("w",encoding="utf-8",dir=args.output.parent,delete=False) as out:
        json.dump(data,out,ensure_ascii=False,separators=(",",":"))
        out.write("\n")
    Path(out.name).replace(args.output)
    print(f"Line {data['line']} to {data['direction']}: {len(data['stops'])} stops, {LineString(data['path']).length:.1f} m")
