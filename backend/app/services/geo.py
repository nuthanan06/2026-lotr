"""Map geometry helpers. Coordinates are 0–1 fractions of the map image."""

from __future__ import annotations

from collections.abc import Iterable

from app.models.map import Region


def _contains(polygon: list[list[float]], x: float, y: float) -> bool:
    # Ray casting: count edge crossings of a ray from the point to +x.
    inside = False
    n = len(polygon)
    for i in range(n):
        x1, y1 = polygon[i]
        x2, y2 = polygon[(i + 1) % n]
        if (y1 > y) != (y2 > y):
            if x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
                inside = not inside
    return inside


def _area(polygon: list[list[float]]) -> float:
    n = len(polygon)
    return abs(
        sum(
            polygon[i][0] * polygon[(i + 1) % n][1] - polygon[(i + 1) % n][0] * polygon[i][1]
            for i in range(n)
        )
    ) / 2


def region_at(regions: Iterable[Region], x: float | None, y: float | None) -> Region | None:
    """The region containing the point; the smallest one wins where outlines
    nest or overlap (e.g. Mount Doom inside Mordor)."""
    if x is None or y is None:
        return None
    hits = [r for r in regions if _contains(r.polygon, x, y)]
    return min(hits, key=lambda r: _area(r.polygon), default=None)
