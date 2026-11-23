"""Monuments the municipal building layer does not map, drawn from their OpenStreetMap footprint.

Each entry of `catalog["osmBuildings"]` names a way (and optional inner ways cut out of it), the
height in metres and the look of the building. The height is an estimate declared in the catalogue
until scripts/lidar-check.py measures it: those parts carry `source="osm-estimate"`.
"""
from shapely import make_valid
from shapely.geometry import Polygon

LOOK_KEYS = ("osm", "holes", "height", "note")


def osm_buildings(catalog, polygon, area, parts, rings):
    """Building records for the catalogue entries.

    `polygon(ref)` returns the shapely polygon of an OSM reference in map metres, `area` clips to the
    map, `parts` and `rings` are the helpers data.py uses for municipal footprints. Ids are negative so
    they never meet a municipal OBJECTID.
    """
    buildings = []
    for index, entry in enumerate(catalog.get("osmBuildings", [])):
        outer = polygon(entry["osm"])
        holes = [polygon(ref).exterior.coords for ref in entry.get("holes", [])]
        shape = make_valid(Polygon(outer.exterior.coords, holes)).intersection(area)
        look = {key: value for key, value in entry.items() if key not in LOOK_KEYS}
        for part in parts(shape, "Polygon"):
            if part.area < 2:
                continue
            buildings.append(dict(id=-(index + 1), **look, rings=rings(part), height=entry["height"], source="osm-estimate"))
    return buildings
