import type { PixelPoint, Point } from './types';

function finite(value: number, name: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
  return value;
}

/** A single reversible world-space line; camera movement cannot steer the projectile. */
export function flightPoint(origin: Point, distance: number, fraction: number): Point {
  finite(origin.x, 'origin.x'); finite(origin.y, 'origin.y'); finite(origin.z, 'origin.z');
  finite(distance, 'distance'); finite(fraction, 'fraction');
  if (distance < 0) throw new RangeError('distance must be non-negative');
  return { x: origin.x + distance * Math.max(0, Math.min(1, fraction)), y: origin.y, z: origin.z };
}

/** Orthographic camera XY; viewWidth is the frustum width before zoom. */
export function cameraAnchor(center: Point, zoom: number, screenX: number, viewWidth: number): PixelPoint {
  finite(center.x, 'center.x'); finite(center.y, 'center.y');
  finite(zoom, 'zoom'); finite(screenX, 'screenX'); finite(viewWidth, 'viewWidth');
  if (zoom <= 0 || viewWidth <= 0) throw new RangeError('zoom and viewWidth must be positive');
  if (screenX < 0 || screenX > 1) throw new RangeError('screenX must be between zero and one');
  return { x: center.x - (screenX - .5) * viewWidth / zoom, y: center.y };
}

/** Lateral distance from the frozen muzzle axis; forward X movement is ignored. */
export function alignmentError(point: Point, origin: Point): number {
  return Math.hypot(point.y - origin.y, point.z - origin.z);
}
