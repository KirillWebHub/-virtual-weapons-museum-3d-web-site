import { Box3, Group, Mesh, Vector3 } from 'three';
import type { Object3D } from 'three';
import { disposeObject } from '../exhibit/model';

export interface PreparedCoin { readonly root: Group; dispose(): void }
/** Display transforms only. Preserve every source surface, material and texture. */
export function prepareCoin(model: Object3D): PreparedCoin {
  let root: Group | undefined;
  try {
    model.updateMatrixWorld(true); const bounds = new Box3().setFromObject(model, true);
    if (bounds.isEmpty()) throw new Error('Empty coin');
    const center = bounds.getCenter(new Vector3()), point = new Vector3(); let radius = 0, meshes = 0;
    model.traverse(node => {
      if (!(node instanceof Mesh)) return; meshes++;
      const positions = node.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) radius = Math.max(radius, point.fromBufferAttribute(positions, i).applyMatrix4(node.matrixWorld).distanceTo(center));
    });
    if (meshes !== 3 || !Number.isFinite(radius) || radius <= 0) throw new Error('Invalid coin');
    const centered = new Group(); centered.position.copy(center).negate(); centered.add(model);
    const scaled = new Group(); scaled.scale.setScalar(1 / radius); scaled.add(centered);
    root = new Group(); root.add(scaled); root.updateMatrixWorld(true);
    const owned = root; let disposed = false;
    return { root, dispose() { if (!disposed) { disposed = true; disposeObject(owned); } } };
  } catch (error) { disposeObject(root ?? model); throw error; }
}
