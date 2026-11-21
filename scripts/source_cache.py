"""Local source cache. Requests with different spatial parameters never share a file."""
import hashlib
import subprocess
from pathlib import Path


def fetch(name, url):
    cache = Path(".cache/sources")
    cache.mkdir(parents=True, exist_ok=True)
    source = Path(name)
    digest = hashlib.sha256(url.encode()).hexdigest()[:16]
    path = cache / f"{source.stem}-{digest}{source.suffix}"
    if not path.exists():
        tmp = path.with_suffix(path.suffix + ".part")
        subprocess.run(["curl", "-fsSL", "--retry", "2", "--max-time", "120", url, "-o", str(tmp)], check=True)
        tmp.replace(path)
    return path
