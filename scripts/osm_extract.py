"""Merge small overlapping Map API extracts by OSM identity before projection."""
from math import floor, ceil
import xml.etree.ElementTree as ET
from source_cache import fetch


def cells(spec):
    west, south, east, north = spec["bounds"]
    if "lattice" in spec:
        # Cells sit on a fixed grid of degrees, so a wider window reuses every extract already cached.
        step = spec["lattice"]
        for x in range(floor(round(west / step, 6)), ceil(round(east / step, 6))):
            for y in range(floor(round(south / step, 6)), ceil(round(north / step, 6))):
                yield x * step, y * step, (x + 1) * step, (y + 1) * step
        return
    columns, rows = spec["grid"]
    dx, dy = (east-west)/columns, (north-south)/rows
    for x in range(columns):
        for y in range(rows):
            yield west+x*dx, south+y*dy, west+(x+1)*dx, south+(y+1)*dy


def acquire(spec, *, offline=False):
    objects = {}
    for box in cells(spec):
        bbox = ",".join(f"{value:.6f}" for value in box)
        path = fetch("osm.xml", "https://api.openstreetmap.org/api/0.6/map?bbox="+bbox, offline=offline)
        for e in ET.parse(path).getroot():
            if e.tag in ("node", "way", "relation"):
                key = e.tag, e.get("id")
                if key not in objects or int(e.get("version")) > int(objects[key].get("version")):
                    objects[key] = e
    root = ET.Element("osm")
    root.extend(objects.values())
    return root
