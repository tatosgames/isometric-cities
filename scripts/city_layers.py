"""The scene layers of a stage: public/data/<stage>.json, gzipped for the city.

The whole municipality is some 95 MB as text and 14 MB gzipped. Gzip without a timestamp: the same layers give
the same bytes, so a regeneration that changes nothing leaves Git clean.
"""
import gzip
from hashlib import sha256
import json
import sys
import zlib
from pathlib import Path

from generation_cache import atomic_write, digest, file_digest, read_entry, write_entry

ROOT = Path("public/data")
GZIPPED = {"city"}


def layers_path(stage, root=ROOT):
    return Path(root) / (stage + (".json.gz" if stage in GZIPPED else ".json"))


def write_layers(stage, data, root=ROOT, *, compresslevel=9):
    text = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf8")
    output = layers_path(stage, root)
    if stage not in GZIPPED:
        atomic_write(output, text)
        return
    key = digest("city-gzip-v1", compresslevel, sys.version_info[:3], zlib.ZLIB_RUNTIME_VERSION, text)
    marker = Path(".cache/generation") / f"{stage}-gzip-{compresslevel}.sha256"
    cached = read_entry(marker, key)
    if cached is not None and output.is_file() and file_digest(output).encode("ascii") == cached:
        return
    payload = gzip.compress(text, compresslevel=compresslevel, mtime=0)
    atomic_write(output, payload)
    write_entry(marker, key, sha256(payload).hexdigest().encode("ascii"))

def read_layers(stage, root=ROOT):
    raw = layers_path(stage, root).read_bytes()
    return json.loads(gzip.decompress(raw) if stage in GZIPPED else raw)
