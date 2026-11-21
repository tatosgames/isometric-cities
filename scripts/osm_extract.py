"""Merge small overlapping Map API extracts by OSM identity before projection."""
import xml.etree.ElementTree as ET
from source_cache import fetch


def acquire(spec):
    west, south, east, north = spec["bounds"]
    columns, rows = spec["grid"]
    objects = {}
    for x in range(columns):
        for y in range(rows):
            dx, dy = (east-west)/columns, (north-south)/rows
            box = (west+x*dx, south+y*dy, west+(x+1)*dx, south+(y+1)*dy)
            bbox = ",".join(f"{value:.6f}" for value in box)
            path = fetch("osm.xml", "https://api.openstreetmap.org/api/0.6/map?bbox="+bbox)
            for e in ET.parse(path).getroot():
                if e.tag in ("node", "way", "relation"):
                    key = e.tag, e.get("id")
                    if key not in objects or int(e.get("version")) > int(objects[key].get("version")):
                        objects[key] = e
    root = ET.Element("osm")
    root.extend(objects.values())
    return root
