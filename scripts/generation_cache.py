"""Local, content-addressed intermediate files for the Python generators."""
from hashlib import sha256
import json
import os
from pathlib import Path
from tempfile import NamedTemporaryFile


def digest(*parts):
    checksum = sha256()
    for part in parts:
        payload = part if isinstance(part, bytes) else json.dumps(
            part, ensure_ascii=False, separators=(",", ":")
        ).encode()
        checksum.update(len(payload).to_bytes(8, "big"))
        checksum.update(payload)
    return checksum.hexdigest()


def file_digest(path):
    with Path(path).open("rb") as stream:
        checksum = sha256()
        for block in iter(lambda: stream.read(1 << 20), b""):
            checksum.update(block)
    return checksum.hexdigest()


def _atomic_write(path, chunks):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    stream = NamedTemporaryFile(dir=path.parent, prefix=path.name + ".", delete=False)
    temporary = Path(stream.name)
    try:
        with stream:
            for chunk in chunks:
                stream.write(chunk)
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def atomic_write(path, payload):
    _atomic_write(path, (payload,))


def read_entry(path, key):
    try:
        with Path(path).open("rb") as stream:
            if stream.read(65) != key.encode("ascii") + b"\n":
                return None
            expected = stream.read(65)
            payload = stream.read()
        if expected == sha256(payload).hexdigest().encode("ascii") + b"\n":
            return payload
    except OSError:
        pass
    return None


def write_entry(path, key, payload):
    header = f"{key}\n{sha256(payload).hexdigest()}\n".encode("ascii")
    _atomic_write(path, (header, payload))
