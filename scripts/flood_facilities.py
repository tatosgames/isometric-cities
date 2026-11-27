"""Critical facilities for the flood module, from OpenStreetMap: hospitals and clinics, schools, emergency services
and care homes, as points in map metres (public/data/flood-facilities.json).

    PYTHONPATH=.cache/pylib python scripts/flood_facilities.py

The flood lab matches each point to the building footprint under it. Names stay as OSM has them (Spanish).
Data © OpenStreetMap contributors, ODbL.
"""
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from geo import origin, to_crs  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public/data/flood-facilities.json"
MIRRORS = ["https://overpass-api.de/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
           "https://overpass.kumi.systems/api/interpreter"]
# The kinds the flood lab tells apart, and the OSM tags that make them.
KINDS = {
    "hospital": [("amenity", "hospital")],
    "health": [("amenity", "clinic"), ("healthcare", "centre")],
    "school": [("amenity", "school"), ("amenity", "kindergarten"), ("amenity", "college"), ("amenity", "university")],
    "emergency": [("amenity", "fire_station"), ("amenity", "police"), ("emergency", "ambulance_station")],
    "care": [("social_facility", "nursing_home"), ("amenity", "nursing_home")],
}


def city_bounds():
    """West, south, east, north of the city data in lon/lat, from its boundary."""
    city = json.loads((ROOT / "public/data/city-aoi.geojson").read_text(encoding="utf-8"))
    points = []

    def walk(c):
        if isinstance(c[0], (int, float)):
            points.append(c)
        else:
            for x in c:
                walk(x)
    for f in city.get("features", [city]):
        walk(f["geometry"]["coordinates"])
    xs, ys = [p[0] for p in points], [p[1] for p in points]
    return min(xs), min(ys), max(xs), max(ys)


def query(bounds):
    w, s, e, n = bounds
    box = f"({s},{w},{n},{e})"
    parts = "".join(f'nwr["{k}"="{v}"]{box};' for tags in KINDS.values() for k, v in tags)
    data = urllib.parse.urlencode({"data": f"[out:json][timeout:120];({parts});out center tags;"}).encode()
    for attempt, url in enumerate(MIRRORS * 2):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, data, {"User-Agent": "isometric-cities"}), timeout=150) as r:
                return json.load(r)["elements"]
        except Exception as error:  # noqa: BLE001
            print(f"{url}: {error}", file=sys.stderr)
            time.sleep(3 + attempt)
    raise SystemExit("Overpass did not answer")


def kind_of(tags):
    for kind, pairs in KINDS.items():
        if any(tags.get(k) == v for k, v in pairs):
            return kind
    return None


def main():
    bounds = city_bounds()
    project, (ox, oy) = to_crs(), origin()
    out = []
    for el in query(bounds):
        tags = el.get("tags", {})
        kind = kind_of(tags)
        lon, lat = (el["lon"], el["lat"]) if "lon" in el else (el["center"]["lon"], el["center"]["lat"])
        if not kind:
            continue
        x, y = project.transform(lon, lat)
        out.append({"id": f'{el["type"][0]}{el["id"]}', "kind": kind, "name": tags.get("name", ""),
                    "x": round(x - ox, 1), "y": round(y - oy, 1)})
    out.sort(key=lambda f: (f["kind"], f["id"]))
    OUT.write_text(json.dumps({"source": "© OpenStreetMap contributors, ODbL", "facilities": out},
                              ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    counts = {k: sum(f["kind"] == k for f in out) for k in KINDS}
    print(f"{len(out)} facilities → {OUT.relative_to(ROOT)} {counts}")


if __name__ == "__main__":
    main()
