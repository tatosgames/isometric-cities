"""Local source cache. Requests with different spatial parameters never share a file."""
import hashlib
import subprocess
from pathlib import Path
from tempfile import NamedTemporaryFile


def fetch(name, url, *, offline=False):
    cache = Path(".cache/sources")
    cache.mkdir(parents=True, exist_ok=True)
    source = Path(name)
    digest = hashlib.sha256(url.encode()).hexdigest()[:16]
    path = cache / f"{source.stem}-{digest}{source.suffix}"
    if not path.exists():
        if offline:
            raise FileNotFoundError(f"Missing offline source: {path} ({url})")
        with NamedTemporaryFile(dir=cache, prefix=path.name + ".", suffix=".part", delete=False) as stream:
            tmp = Path(stream.name)
        try:
            subprocess.run(["curl", "-fsSL", "--retry", "2", "--max-time", "120", url, "-o", str(tmp)], check=True)
            tmp.replace(path)
        finally:
            tmp.unlink(missing_ok=True)
    return path
