import { clampProgress } from './state';

const smooth = (value: number): number => { const t = clampProgress(value); return t * t * (3 - 2 * t); };

/** Exhibition choreography: two external groups move together, then return together. */
export function chapterState(value: number): { progress: number; spread: number; phase: number; yaw: number } {
  const progress = clampProgress(value);
  const spread = progress < .7 ? smooth((progress - .16) / .24) : 1 - smooth((progress - .7) / .22);
  return { progress, spread, phase: progress < .16 ? 0 : progress < .4 ? 1 : progress < .7 ? 2 : 3, yaw: .1 * Math.sin(Math.PI * progress) };
}

export function inspectorRotation(yaw: number, pitch: number): { yaw: number; pitch: number } {
  const safeYaw = Number.isFinite(yaw) ? yaw : 0, safePitch = Number.isFinite(pitch) ? pitch : 0;
  return { yaw: Math.atan2(Math.sin(safeYaw), Math.cos(safeYaw)), pitch: Math.max(-.7, Math.min(.7, safePitch)) };
}
