import type { PartGroup } from './types';

export function clampProgress(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

/** Hold both endpoints; interpolate only from absolute saved transforms. */
export function spreadForProgress(value: number): number {
  const time = clampProgress((clampProgress(value) - .15) / .7);
  return time * time * (3 - 2 * time);
}

export function applyDisplayState(parts: readonly PartGroup[], progress: number): void {
  applySpread(parts, spreadForProgress(progress));
}

export function applySpread(parts: readonly PartGroup[], amount: number): void {
  const spread = clampProgress(amount);
  for (const part of parts) {
    part.node.position.copy(part.position).addScaledVector(part.offset, spread);
    part.node.quaternion.copy(part.quaternion);
    part.node.scale.copy(part.scale);
  }
}
