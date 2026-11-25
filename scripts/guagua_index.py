"""Build the 240 m spatial index consumed by the Conducir guagua fleet."""

from __future__ import annotations

import math
from typing import Any, Iterable

SIZE = 240
ACCEL, BRAKE, LIMIT, DWELL = 2.5, 3.5, 8.0, 3.0


def _schedule(stops: list[float], length: float):
    targets = [min(float(stop), length) for stop in stops]
    stop_count = len(targets)
    if not targets or targets[-1] < length:
        targets.append(length)
    legs, from_distance, depart = [], 0.0, 0.0
    for i, target in enumerate(targets):
        span = target - from_distance
        peak = min(LIMIT, math.sqrt(2 * span / (1 / ACCEL + 1 / BRAKE))) if span else 0.0
        accelerating, braking = peak / ACCEL, peak / BRAKE
        cruising = max(0.0, span / peak - (accelerating + braking) / 2) if peak else 0.0
        arrive = depart + accelerating + cruising + braking
        leave = arrive + (DWELL if i < stop_count else 0.0)
        legs.append((from_distance, target, depart, arrive, leave, peak, accelerating, cruising))
        from_distance, depart = target, leave
    times = [leg[4] for leg in legs]

    def first_at_least(values: list[float], value: float) -> int:
        lo, hi = 0, len(values) - 1
        while lo < hi:
            mid = (lo + hi) >> 1
            if values[mid] < value:
                lo = mid + 1
            else:
                hi = mid
        return lo

    def time_at(distance: float, after_dwell: bool = False) -> float:
        leg = legs[first_at_least(targets, distance)]
        start, end, depart, arrive, leave, peak, accelerating, cruising = leg
        d = max(0.0, distance - start)
        if distance >= end:
            return leave if after_dwell else arrive
        if d <= peak * peak / (2 * ACCEL):
            return depart + math.sqrt(2 * d / ACCEL)
        if end - distance <= peak * peak / (2 * BRAKE):
            return arrive - math.sqrt(2 * (end - distance) / BRAKE)
        return depart + accelerating + (d - peak * peak / (2 * ACCEL)) / peak

    return time_at, legs, depart


def _distance_table(path: list[list[float]]) -> list[float]:
    distances = [0.0]
    for a, b in zip(path, path[1:]):
        distances.append(distances[-1] + math.hypot(b[0] - a[0], b[1] - a[1]))
    return distances


def _segment_cells(a: list[float], b: list[float]) -> Iterable[tuple[str, float, float]]:
    """Yield cell id and segment parameters for every grid cell touched by AB."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    cuts = [0.0, 1.0]
    if dx:
        start, end = sorted((a[0], b[0]))
        for boundary in range(math.floor(start / SIZE) + 1, math.floor(end / SIZE) + 1):
            cuts.append((boundary * SIZE - a[0]) / dx)
    if dy:
        start, end = sorted((a[1], b[1]))
        for boundary in range(math.floor(start / SIZE) + 1, math.floor(end / SIZE) + 1):
            cuts.append((boundary * SIZE - a[1]) / dy)
    cuts = sorted({max(0.0, min(1.0, value)) for value in cuts})
    for left, right in zip(cuts, cuts[1:]):
        mid = (left + right) / 2
        x, y = a[0] + dx * mid, a[1] + dy * mid
        yield f"{math.floor(x / SIZE)}_{math.floor(y / SIZE)}", left, right


def index_piece(index: dict[str, Any], piece_id: str, file: str, line: str, direction: str,
                phase: float, period: float, path: list[list[float]], stops: list[dict[str, Any]],
                distances: list[float] | None = None, times: list[float] | None = None) -> dict[str, Any]:
    """Add one route piece and its exact spatial/time intervals to ``index``.

    Cell intervals are ``[pieceId, fromDistance, toDistance, startTime, endTime]``.
    A segment that re-enters a cell emits a second interval.  ``distances`` and
    ``times`` are returned for generators that also write a route artifact.
    """
    if len(path) < 2 or period <= 0:
        raise ValueError("a piece needs a path with at least two points and a positive period")
    cumulative = distances or _distance_table(path)
    length = cumulative[-1]
    stop_distances = [float(stop["distance"]) for stop in stops]
    time_at, _, duration = _schedule(stop_distances, length)
    stop_times = times or [time_at(value) for value in stop_distances]
    index.setdefault("version", 1)
    index.setdefault("size", SIZE)
    index.setdefault("cells", {})
    index.setdefault("pieces", {})
    index["pieces"][piece_id] = {"file": file, "line": line, "direction": direction,
                                  "phase": float(phase), "period": float(period)}
    for i, (a, b) in enumerate(zip(path, path[1:])):
        span = cumulative[i + 1] - cumulative[i]
        if not span:
            continue
        for cell, left, right in _segment_cells(a, b):
            from_distance = cumulative[i] + span * left
            to_distance = cumulative[i] + span * right
            interval = [piece_id, round(from_distance, 6), round(to_distance, 6),
                        round(time_at(from_distance), 6), round(time_at(to_distance, to_distance >= length or any(abs(to_distance - d) < 1e-6 for d in stop_distances)), 6)]
            if interval[1]>=interval[2]:
                continue
            entries=index["cells"].setdefault(cell, [])
            if entries and entries[-1][0]==piece_id and entries[-1][2]==interval[1]:
                entries[-1][2]=interval[2]
                entries[-1][4]=interval[4]
            else:
                entries.append(interval)
    return {"length": length, "duration": duration, "distances": cumulative, "times": stop_times}
