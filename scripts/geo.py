"""Shared local frame: every script measures map metres from the same origin."""
from pyproj import Transformer

# The map's (0,0), near Santa Ana. Changing it moves every coordinate in public/data.
ORIGIN_LONLAT = (-15.415, 28.105)
UTM = 32628     # WGS 84 / UTM 28N: the metric frame of the geodata and the viewer
CANARY = 4083   # REGCAN95 / UTM 28N: the frame the Spanish orthophoto services answer in


def to_crs(epsg=UTM):
    """WGS84 lon/lat to `epsg`."""
    return Transformer.from_crs(4326, epsg, always_xy=True)


def from_crs(epsg=UTM):
    """`epsg` to WGS84 lon/lat."""
    return Transformer.from_crs(epsg, 4326, always_xy=True)


def origin(epsg=UTM):
    """The map origin expressed in `epsg`."""
    return to_crs(epsg).transform(*ORIGIN_LONLAT)
