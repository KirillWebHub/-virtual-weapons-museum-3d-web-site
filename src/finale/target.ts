import { Box3, Group, Mesh, Vector2, Vector3 } from 'three';
import type { Object3D } from 'three';
import targetUrl from '../assets/finale/shooting-range-target.glb?url';
import { disposeObject, loadStaticReference } from '../exhibit/model';
import type { ModelLoader } from '../exhibit/types';

export interface FinaleTarget { readonly root: Group; readonly impact: Vector3 }

/** Caller owns the returned resource bundle; a late abort always disposes it here. */
export async function loadFinaleTarget(signal: AbortSignal, loader: ModelLoader = loadStaticReference): Promise<FinaleTarget> {
  let source: Object3D | undefined, owned: Group | undefined;
  try {
    signal.throwIfAborted(); source = await loader(targetUrl, signal); signal.throwIfAborted();
    const target = prepareFinaleTarget(source); owned = target.root; signal.throwIfAborted();
    return target;
  } catch (error) {
    if (owned || source) disposeObject(owned ?? source!);
    throw error;
  }
}

export function prepareFinaleTarget(model: Object3D): FinaleTarget {
  model.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(model, true), size = bounds.getSize(new Vector3());
  if (bounds.isEmpty() || !Number.isFinite(size.y) || size.y <= 0) throw new Error('Invalid finale target bounds');
  const scale = 3.2 / size.y, center = bounds.getCenter(new Vector3()), content = new Group(), root = new Group();
  content.add(model); content.scale.setScalar(scale); content.position.copy(center).multiplyScalar(-scale); root.add(content); root.updateMatrixWorld(true);
  const impact = findSurfaceUV(root, new Vector2(.205, .254));
  if (!impact) throw new Error('Printed centre is missing from finale target');
  return { root, impact };
}

/** Locate the original printed circle using its texture coordinates, without editing it. */
function findSurfaceUV(root: Group, uv: Vector2): Vector3 | undefined {
  const a = new Vector2(), b = new Vector2(), c = new Vector2(), point = new Vector3(), vertex = new Vector3();
  let found: Vector3 | undefined;
  root.traverse(node => {
    if (found || !(node instanceof Mesh)) return;
    const position = node.geometry.getAttribute('position'), map = node.geometry.getAttribute('uv'), index = node.geometry.index;
    if (!position || !map) return;
    const count = index?.count ?? position.count;
    for (let i = 0; i + 2 < count; i += 3) {
      const ia = index ? index.getX(i) : i, ib = index ? index.getX(i + 1) : i + 1, ic = index ? index.getX(i + 2) : i + 2;
      a.fromBufferAttribute(map, ia); b.fromBufferAttribute(map, ib); c.fromBufferAttribute(map, ic);
      const determinant = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
      if (Math.abs(determinant) < 1e-9) continue;
      const u = ((b.y - c.y) * (uv.x - c.x) + (c.x - b.x) * (uv.y - c.y)) / determinant;
      const v = ((c.y - a.y) * (uv.x - c.x) + (a.x - c.x) * (uv.y - c.y)) / determinant, w = 1 - u - v;
      if (u >= -1e-7 && v >= -1e-7 && w >= -1e-7) {
        point.fromBufferAttribute(position, ia).multiplyScalar(u)
          .addScaledVector(vertex.fromBufferAttribute(position, ib), v)
          .addScaledVector(vertex.fromBufferAttribute(position, ic), w);
        node.localToWorld(point); found = root.worldToLocal(point.clone()); break;
      }
    }
  });
  return found;
}
