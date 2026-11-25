"""The scene layers of a stage: public/data/<stage>.json, gzipped for the city.

The whole municipality is some 95 MB as text and 14 MB gzipped. Gzip without a timestamp: the same layers give
the same bytes, so a regeneration that changes nothing leaves Git clean.
"""
import gzip
import json
from pathlib import Path

ROOT = Path("public/data")
GZIPPED = {"city"}


def layers_path(stage, root=ROOT):
    return Path(root) / (stage + (".json.gz" if stage in GZIPPED else ".json"))


def write_layers(stage, data, root=ROOT):
    text = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf8")
    layers_path(stage, root).write_bytes(gzip.compress(text, compresslevel=9, mtime=0) if stage in GZIPPED else text)


def read_layers(stage, root=ROOT):
    raw = layers_path(stage, root).read_bytes()
    return json.loads(gzip.decompress(raw) if stage in GZIPPED else raw)
