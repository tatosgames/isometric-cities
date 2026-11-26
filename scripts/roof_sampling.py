"""Shared per-footprint sampling for the two orthophoto sources."""
import numpy as np
from PIL import Image, ImageDraw


def adjust_shadows(pixels):
    """Keep float32 because quantizing before the percentiles changes some tones."""
    rgb = np.asarray(pixels, dtype=np.float32)
    shade = np.maximum(0, 105 - rgb.mean(axis=-1, keepdims=True))
    return np.clip(rgb + shade * .67, 0, 255)


def sample_roofs(stages, bounds, crop, group=None):
    west, south, width, height = bounds
    buildings = []
    for scene in stages:
        assert all(west <= x <= west + width and south <= y <= south + height
                   for x, y in scene["boundary"])
        buildings.extend(scene["buildings"])
    order = range(len(buildings))
    if group is not None:
        # Sample nearby buildings together, then replay scene order for duplicate tone keys and JSON order.
        order = sorted(order, key=lambda i: group(*buildings[i]["rings"][0][0]))
    samples = [None] * len(buildings)
    for i in order:
        building = buildings[i]
        rings = [[(x - west, height - 1 - (y - south)) for x, y in ring]
                 for ring in building["rings"]]
        xs, ys = zip(*rings[0])
        x0, y0, x1, y1 = int(min(xs)), int(min(ys)), int(max(xs)) + 1, int(max(ys)) + 1
        mask = Image.new("L", (x1 - x0, y1 - y0))
        draw = ImageDraw.Draw(mask)
        for j, ring in enumerate(rings):
            draw.polygon([(x - x0, y - y0) for x, y in ring], fill=0 if j else 255)
        inside = np.asarray(crop((x0, y0, x1, y1)))[np.asarray(mask) > 0]
        if len(inside) < 4:
            continue
        pixels = adjust_shadows(inside)
        brightness = pixels.mean(axis=1)
        lo, hi = np.percentile(brightness, [35, 85])
        sample = np.median(pixels[(brightness >= lo) & (brightness <= hi)], axis=0)
        if np.isfinite(sample).all():
            key = str(building["id"]) + building.get("toneSuffix", "")
            samples[i] = key, sample.tolist()
    return dict(sample for sample in samples if sample is not None)
