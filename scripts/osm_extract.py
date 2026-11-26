"""Merge small overlapping Map API extracts by OSM identity before projection."""
import json
from pathlib import Path
from math import floor, ceil
import xml.etree.ElementTree as ET
from source_cache import fetch
from generation_cache import digest, file_digest, read_entry, write_entry


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


def source_paths(spec, offline):
    for bounds in cells(spec):
        bbox = ",".join(f"{value:.6f}" for value in bounds)
        yield fetch("osm.xml", "https://api.openstreetmap.org/api/0.6/map?bbox=" + bbox, offline=offline)


def merge(paths):
    objects = {}
    for path in paths:
        for element in ET.parse(path).getroot():
            if element.tag in ("node", "way", "relation"):
                key = element.tag, element.get("id")
                if key not in objects or int(element.get("version")) > int(objects[key].get("version")):
                    objects[key] = element
    root = ET.Element("osm")
    root.extend(objects.values())
    return root


def acquire(spec, *, offline=False):
    return merge(source_paths(spec, offline))


def tags(element):
    return {tag.get("k"): tag.get("v") for tag in element.iterfind("tag")}


def acquire_projected(spec, *, offline=False):
    """Share the ordered, projected snapshot used by the scene generator and audit."""
    from geo import ORIGIN_LONLAT, UTM, origin, to_crs
    from pyproj import __version__ as pyproj_version, proj_version_str

    paths = list(source_paths(spec, offline))
    cache = Path(".cache/generation/osm") / (digest([p.name for p in paths]) + ".json")
    key = digest("projected-osm-v1", ORIGIN_LONLAT, UTM, pyproj_version, proj_version_str,
                 [file_digest(path) for path in paths])
    payload = read_entry(cache, key)
    if payload is None:
        root = merge(paths)
        forward = to_crs()
        ox, oy = origin()
        nodes, node_tags, ways = {}, {}, {}
        for element in root.iterfind("node"):
            ident = element.get("id")
            x, y = forward.transform(float(element.get("lon")), float(element.get("lat")))
            nodes[ident] = [x - ox, y - oy]
            attributes = tags(element)
            if attributes:
                node_tags[ident] = attributes
        for element in root.iterfind("way"):
            ways[element.get("id")] = [tags(element), [node.get("ref") for node in element.iterfind("nd")]]
        relations = ET.Element("osm")
        relations.extend(root.iterfind("relation"))
        payload = json.dumps((nodes, node_tags, ways, ET.tostring(relations, encoding="unicode")),
                             ensure_ascii=False, separators=(",", ":")).encode()
        write_entry(cache, key, payload)
        return nodes, node_tags, ways, relations
    nodes, node_tags, ways, relations = json.loads(payload)
    return nodes, node_tags, ways, ET.fromstring(relations)
