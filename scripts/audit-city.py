"""Offline visual audit. Run from the repository root: python -I scripts/audit-city.py"""
import argparse
import csv
import json
import sys
from collections import Counter
from pathlib import Path

sys.path[:0] = [str(Path(".cache/pylib").resolve()), str(Path(__file__).resolve().parent)]
from geo import from_crs, origin, to_crs
from shapely import make_valid, union_all
from shapely.geometry import LineString, Polygon, mapping
from shapely.ops import transform
from shapely.strtree import STRtree

from osm_extract import acquire


def read(path):
    return json.loads(Path(path).read_bytes())


def polygon(row):
    outer, *holes = row["rings"]
    return make_valid(Polygon(outer, holes))


def building_use(tags):
    if tags.get("shop") == "mall" or tags.get("amenity") == "marketplace":
        return tags.get("shop") or "marketplace"
    kind = tags.get("building")
    if kind in {"retail", "warehouse", "industrial", "stadium", "sports_hall",
                "train_station", "transportation", "supermarket"}:
        return kind


def cover(tags):
    value = tags.get("surface") or tags.get("landcover") or tags.get("natural")
    if value in {"asphalt", "sand", "grass"}:
        return value
    if value in {"paved", "paving_stones", "concrete", "cobblestone", "sett"}:
        return "paved"
    if value in {"ground", "dirt", "earth", "bare_ground", "compacted"}:
        return "earth"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=Path(".cache/audit-city"))
    out = parser.parse_args().out
    data = read("public/data/city.json")
    catalog = read("content/las-palmas.json")
    osm = acquire(catalog["coverage"], offline=True)
    forward = to_crs()
    inverse = from_crs()
    ox, oy = origin()
    nodes = {}
    for e in osm.iterfind("node"):
        x, y = forward.transform(float(e.get("lon")), float(e.get("lat")))
        nodes[e.get("id")] = x - ox, y - oy
    land = make_valid(Polygon(data["boundary"]))
    tags_by_id, masks, mask_ids = {}, [], []
    for e in osm.iterfind("way"):
        key = e.get("id")
        tags = {t.get("k"): t.get("v") for t in e.iterfind("tag")}
        tags_by_id[key] = tags
        if not (building_use(tags) or cover(tags) or tags.get("amenity") in
                {"parking", "bus_station"} or tags.get("highway") == "pedestrian"):
            continue
        refs = [nd.get("ref") for nd in e.iterfind("nd")]
        if len(refs) < 4 or refs[0] != refs[-1] or tags.get("area") == "no":
            continue
        if tags.get("highway") and tags.get("area") != "yes" and not tags.get("amenity"):
            continue  # A closed road centreline can enclose a whole block.
        geom = make_valid(Polygon([nodes[i] for i in refs])).intersection(land)
        if geom.area > 0:
            masks.append(geom)
            mask_ids.append(key)
    del osm, nodes
    masks_index = STRtree(masks)
    features = []

    def geographic(x, y):
        return inverse.transform(x + ox, y + oy)

    def record(group, priority, key, geom, reason, *, name="", osm_ids=(), **metrics):
        point = geom.representative_point()
        lon, lat = geographic(point.x, point.y)
        props = dict(group=group, priority=priority, id=key, name=name, reason=reason,
                     osm_way_ids=" ".join(map(str, osm_ids)), lon=round(lon, 6),
                     lat=round(lat, 6), **metrics)
        features.append(dict(type="Feature", properties=props,
                             geometry=mapping(transform(geographic, geom))))

    for b in data["buildings"]:
        if b.get("windows") is False:
            continue
        geom = polygon(b)
        if geom.area < 250:
            continue
        matches = []
        for i in masks_index.query(geom):
            key = mask_ids[i]
            use = building_use(tags_by_id[key])
            if use:
                overlap = geom.intersection(masks[i]).area
                # Require reciprocal coverage to avoid assigning a whole retail estate to each annex.
                if overlap >= .7 * geom.area and overlap >= .5 * masks[i].area:
                    matches.append((overlap / geom.area, key, use))
        if matches or geom.area >= 5000:
            fraction, key, use = max(matches, default=(0, "", ""))
            record("facade", 1 if matches else 3, str(b["id"]), geom,
                   "uso OSM e finestre abilitate" if matches else "grande impronta con finestre abilitate",
                   name=tags_by_id.get(key, {}).get("name", ""), osm_ids=[key] if key else [],
                   area_m2=round(geom.area), height_m=b["height"], use=use,
                   footprint_match_pct=round(100*fraction, 1) if matches else None)

    surfaces = {s["id"] for s in data["surfaces"]}
    for s in data["surfaces"]:
        key = s["id"]
        tags = tags_by_id.get(key, {})
        if s["kind"] != "park" or s.get("paved"):
            continue
        geom = polygon(s)
        signals = []
        for i in masks_index.query(geom):
            other = tags_by_id[mask_ids[i]]
            if (other.get("building") or other.get("roof:shape") or
                    cover(other) not in {"asphalt", "paved", "earth", "sand"}):
                continue
            part = geom.intersection(masks[i])
            if part.area >= 25:
                signals.append((mask_ids[i], part))
        area = union_all([g for _, g in signals]).area if signals else 0
        if area >= 100 or (tags.get("leisure") == "park" and geom.area >= 2500):
            record("ground", 2 if area >= 100 else 3, key, geom,
                   "copertura esplicita sul verde" if area >= 100 else "parco esteso reso verde",
                   name=tags.get("name", ""), osm_ids=sorted({key, *(k for k, _ in signals)}),
                   area_m2=round(geom.area), mapped_cover_m2=round(area),
                   mapped_cover_pct=round(100*area/geom.area, 1))

    lines = [LineString(r["line"]) for r in data["roads"]]
    index = STRtree(lines)
    for key, geom in zip(mask_ids, masks):
        tags = tags_by_id[key]
        if tags.get("amenity") not in {"bus_station", "parking"} and tags.get("highway") != "pedestrian":
            continue
        lengths = Counter()
        for i in index.query(geom):
            r = data["roads"][i]
            if r["kind"] not in {"service", "footway", "path", "pedestrian", "busway"}:
                continue
            road_tags = tags_by_id.get(r["id"], {})
            if any(road_tags.get(k, "0") != tags.get(k, "0") for k in ("level", "layer")):
                continue
            if road_tags.get("bridge", "no") != tags.get("bridge", "no"):
                continue
            length = lines[i].intersection(geom).length
            if length >= 5:
                lengths[r["id"]] += length
        if len(lengths) >= 4:
            record("road_area", 2, key, geom, "assi nello stesso perimetro e livello OSM",
                   name=tags.get("name", ""), osm_ids=[key, *sorted(lengths)],
                   road_count=len(lengths), inside_m=round(sum(lengths.values())),
                   level=tags.get("level", "0"), area_m2=round(geom.area))
        if (key not in surfaces and cover(tags) and geom.area >= 250 and
                not tags.get("building") and tags.get("parking") not in {"underground", "multi-storey"} and
                tags.get("level", "0") == "0" and tags.get("layer", "0") == "0"):
            record("ground", 2, key, geom, "piazzale con copertura esplicita assente per ID",
                   name=tags.get("name", ""), osm_ids=[key], use=cover(tags), area_m2=round(geom.area))

    for r, geom in zip(data["roads"], lines):
        tags = tags_by_id.get(r["id"], {})
        if tags.get("level", "").startswith("-") and not r.get("layer"):
            record("road_level", 1, r["id"], geom, "asse esportato senza la quota OSM negativa",
                   name=tags.get("name", ""), osm_ids=[r["id"]], use=r["kind"],
                   level=tags["level"], inside_m=round(geom.length))

    features.sort(key=lambda f: (f["properties"]["priority"], f["properties"]["group"],
                                 -f["properties"].get("area_m2", 0), f["properties"]["id"]))
    out.mkdir(parents=True, exist_ok=True)
    (out / "audit.geojson").write_text(json.dumps(dict(type="FeatureCollection",
        attribution="© OpenStreetMap contributors; Ayuntamiento de Las Palmas de Gran Canaria",
        features=features), ensure_ascii=False), encoding="utf8")
    rows = [f["properties"] for f in features]
    fields = list(dict.fromkeys(k for row in rows for k in row))
    with (out / "audit.csv").open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fields or ["group"])
        writer.writeheader()
        writer.writerows(rows)
    print(f"{len(rows)} candidates in {out}")
    print(sorted(Counter((r["group"], r["priority"]) for r in rows).items()))


if __name__ == "__main__":
    main()
