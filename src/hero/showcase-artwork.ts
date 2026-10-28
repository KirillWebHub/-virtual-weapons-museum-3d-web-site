import { CanvasTexture, SRGBColorSpace } from 'three';
import type { Texture } from 'three';

function canvas(width: number, height: number): { element: HTMLCanvasElement; context: CanvasRenderingContext2D } {
  const element = document.createElement('canvas'); element.width = width; element.height = height;
  const context = element.getContext('2d'); if (!context) throw new Error('Canvas unavailable'); return { element, context };
}
function texture(element: HTMLCanvasElement): Texture { const result = new CanvasTexture(element); result.colorSpace = SRGBColorSpace; return result; }

/** Derive a clean silhouette from the existing transparent render, not another heavy GLB. */
export async function loadSilhouette(url: string, signal: AbortSignal): Promise<Texture> {
  const response = await fetch(url, { signal }); if (!response.ok) throw new Error(`Cover: HTTP ${response.status}`);
  const bitmap = await createImageBitmap(await response.blob());
  try {
    signal.throwIfAborted(); const source = canvas(bitmap.width, bitmap.height); source.context.drawImage(bitmap, 0, 0);
    const pixels = source.context.getImageData(0, 0, bitmap.width, bitmap.height).data;
    let left = bitmap.width, top = bitmap.height, right = 0, bottom = 0;
    for (let y = 0; y < bitmap.height; y++) for (let x = 0; x < bitmap.width; x++) if (pixels[(y * bitmap.width + x) * 4 + 3]! > 16) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y); }
    if (right <= left || bottom <= top) throw new Error('Empty cover');
    const output = canvas(768, 480), scale = Math.min(704 / (right - left), 406 / (bottom - top)), width = (right - left) * scale, height = (bottom - top) * scale;
    output.context.drawImage(source.element, left, top, right - left + 1, bottom - top + 1, (768 - width) / 2, (480 - height) / 2, width, height);
    output.context.globalCompositeOperation = 'source-in'; output.context.fillStyle = '#efe5cf'; output.context.fillRect(0, 0, 768, 480);
    return texture(output.element);
  } finally { bitmap.close(); }
}
export function makeLabel(index: number, name: string, period: string): Texture {
  const { element, context } = canvas(768, 480); context.textAlign = 'center'; context.fillStyle = '#d8b778'; context.font = '500 100px Oswald'; context.fillText(String(index + 1).padStart(2, '0'), 384, 125);
  context.fillStyle = '#f1e4c5'; context.font = '500 84px Oswald'; context.fillText(name.toUpperCase(), 384, 260, 706);
  context.fillStyle = '#c9bfa9'; context.font = '400 48px Oswald'; context.fillText(period, 384, 365); return texture(element);
}
export function makeContactShadow(): Texture {
  const { element, context } = canvas(128, 128), gradient = context.createRadialGradient(64, 64, 4, 64, 64, 64);
  gradient.addColorStop(0, '#10120cd9'); gradient.addColorStop(.38, '#10120c78'); gradient.addColorStop(1, '#10120c00'); context.fillStyle = gradient; context.fillRect(0, 0, 128, 128); return texture(element);
}
