import type { RegionResponse } from "@/types/api";

// Map positions are stored as 0–1 fractions of the map image (x from the
// left, y from the top), so they don't depend on zoom or screen size. These
// helpers mirror backend/app/services/geo.py.

export interface MapPoint {
  x: number;
  y: number;
}

export const MAP_IMAGE = {
  src: "/lotr/middle-earth-map.jpg",
  width: 4096,
  height: 2234,
};

function contains(polygon: [number, number][], { x, y }: MapPoint): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [x1, y1] = polygon[i];
    const [x2, y2] = polygon[j];
    if (y1 > y !== y2 > y && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) inside = !inside;
  }
  return inside;
}

function area(polygon: [number, number][]): number {
  let sum = 0;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    sum += polygon[j][0] * polygon[i][1] - polygon[i][0] * polygon[j][1];
  }
  return Math.abs(sum) / 2;
}

/** The region containing the point; the smallest wins where outlines nest. */
export function regionAt(regions: RegionResponse[], point: MapPoint): RegionResponse | null {
  let best: RegionResponse | null = null;
  for (const r of regions) {
    if (contains(r.polygon, point) && (!best || area(r.polygon) < area(best.polygon))) best = r;
  }
  return best;
}

/** A random point inside the region (rejection-sampled from its bounding box). */
export function randomPointIn(region: RegionResponse, regions: RegionResponse[]): MapPoint {
  const xs = region.polygon.map((p) => p[0]);
  const ys = region.polygon.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  for (let i = 0; i < 200; i++) {
    const p = { x: minX + Math.random() * (maxX - minX), y: minY + Math.random() * (maxY - minY) };
    // Must land in this region specifically, not a smaller one nested inside it.
    if (regionAt(regions, p)?.id === region.id) return p;
  }
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

export function centroid(points: MapPoint[]): MapPoint {
  return {
    x: points.reduce((s, p) => s + p.x, 0) / points.length,
    y: points.reduce((s, p) => s + p.y, 0) / points.length,
  };
}

// Leaflet's CRS.Simple has latitude growing upward, in image pixels.
export function toLatLng({ x, y }: MapPoint): [number, number] {
  return [(1 - y) * MAP_IMAGE.height, x * MAP_IMAGE.width];
}

export function fromLatLng(lat: number, lng: number): MapPoint {
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return { x: clamp(lng / MAP_IMAGE.width), y: clamp(1 - lat / MAP_IMAGE.height) };
}
