export interface PagePosition { readonly top: number; readonly progress?: number; readonly finaleProgress?: number; readonly historyOpen: boolean; readonly catalogOpen: boolean; readonly openSections?: readonly string[] }
export interface ScrollMetrics { readonly start: number; readonly height: number; readonly viewport: number; readonly maximum: number }
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
export function referenceProgress(top: number, metrics: ScrollMetrics): number | undefined {
  const length = metrics.height - metrics.viewport;
  return length > 0 && top >= metrics.start && top <= metrics.start + length ? (top - metrics.start) / length : undefined;
}
export function restoredTop(position: PagePosition, metrics: ScrollMetrics, finale?: ScrollMetrics): number {
  const progress = position.progress, length = metrics.height - metrics.viewport;
  // A saved finale phase remains in that section when a short/reduced layout removes its scroll range.
  const top = position.finaleProgress !== undefined && finale ? finale.start + Math.max(0, finale.height - finale.viewport) * position.finaleProgress
    : progress !== undefined && length > 0 ? metrics.start + length * progress : position.top;
  return Math.max(0, Math.min(metrics.maximum, top));
}
export function validPosition(value: unknown): value is PagePosition {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  return finite(data['top']) && data['top'] >= 0 && typeof data['historyOpen'] === 'boolean' && typeof data['catalogOpen'] === 'boolean'
    && (data['progress'] === undefined || finite(data['progress']) && data['progress'] >= 0 && data['progress'] <= 1)
    && (data['finaleProgress'] === undefined || finite(data['finaleProgress']) && data['finaleProgress'] >= 0 && data['finaleProgress'] <= 1)
    && (data['openSections'] === undefined || Array.isArray(data['openSections']) && data['openSections'].length <= 20 && data['openSections'].every(id => typeof id === 'string' && id.length <= 120));
}
export function anchorId(hash: string): string | undefined {
  if (!hash.startsWith('#') || hash.length < 2) return undefined;
  try { return decodeURIComponent(hash.slice(1)); } catch { return undefined; }
}
