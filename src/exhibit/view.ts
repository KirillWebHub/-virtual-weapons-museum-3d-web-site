import { Vector3 } from 'three';
import type { Box3, OrthographicCamera } from 'three';

export interface SceneView { readonly element: HTMLElement; readonly mode: 'hero' | 'exhibit' | 'inspect' }
export interface ViewRect { readonly left: number; readonly right: number; readonly top: number; readonly bottom: number; readonly width: number; readonly height: number }

export function clipView(rect: ViewRect, width: number, height: number): { x: number; y: number; width: number; height: number } | undefined {
  const left = Math.max(0, rect.left), right = Math.min(width, rect.right);
  const top = Math.max(0, rect.top), bottom = Math.min(height, rect.bottom);
  if (right <= left || bottom <= top || rect.width <= 0 || rect.height <= 0) return undefined;
  return { x: left, y: height - bottom, width: right - left, height: bottom - top };
}

export function fitCamera(camera: OrthographicCamera, bounds: Box3, width: number, height: number, fill = { x: .893, y: .806 }, minimum = .5): void {
  if (width <= 0 || height <= 0 || bounds.isEmpty()) return;
  const center = bounds.getCenter(new Vector3()), size = bounds.getSize(new Vector3()), aspect = width / height;
  const halfHeight = Math.max(size.y / (2 * fill.y), size.x / (aspect * 2 * fill.x), minimum);
  camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect;
  camera.top = halfHeight; camera.bottom = -halfHeight;
  camera.position.set(center.x, center.y, center.z + 12); camera.lookAt(center);
  camera.updateProjectionMatrix(); camera.updateMatrixWorld();
}
