import { Box3, Mesh, Vector3 } from 'three';
import type { Group, Object3D } from 'three';
import { normalizeModel, disposeObject } from './model';
import { applySpread } from './state';
import type { PartGroup, PreparedModel } from './types';

export function prepareReference(model: Object3D): PreparedModel {
  let preparedRoot: Group | undefined;
  try {
    const root = normalizeModel(model, 'mag_low001'); preparedRoot = root;
    const nodes: Object3D[] = []; root.traverse(node => { if (!(node instanceof Mesh) && node.children.some(child => child instanceof Mesh)) nodes.push(node); });
    if (nodes.length !== 43) throw new Error(`Unexpected reference groups: ${nodes.length}`);
    const depth = (node: Object3D): number => { let n = 0; for (let p = node.parent; p; p = p.parent) n++; return n; };
    for (const node of [...nodes].sort((a, b) => depth(b) - depth(a))) root.attach(node);
    const measured = nodes.map((node, index) => {
      const box = new Box3().setFromObject(node, true);
      return { id: `ref-${String(index + 1).padStart(2, '0')}`, node, center: box.getCenter(new Vector3()), size: box.getSize(new Vector3()), target: new Vector3() };
    });
    let x = 0, y = 0, rowHeight = 0, width = 0;
    for (const part of [...measured].sort((a, b) => b.size.y - a.size.y)) {
      const w = Math.max(part.size.x, .3) + .22, h = Math.max(part.size.y, .26) + .22;
      if (x > 0 && x + w > 8) { y += rowHeight + .22; x = 0; rowHeight = 0; }
      part.target.set(x + w / 2, -y - h / 2, 0); x += w; rowHeight = Math.max(rowHeight, h); width = Math.max(width, x - .16);
    }
    const height = y + rowHeight;
    const parts: PartGroup[] = measured.map(part => ({ id: part.id, node: part.node, position: part.node.position.clone(), quaternion: part.node.quaternion.clone(), scale: part.node.scale.clone(), offset: part.target.add(new Vector3(-width / 2, height / 2, 0)).sub(part.center) }));
    const bounds = new Box3().setFromObject(root, true); applySpread(parts, 1); root.updateMatrixWorld(true); bounds.union(new Box3().setFromObject(root, true)); applySpread(parts, 0); root.updateMatrixWorld(true);
    let disposed = false;
    return { root, parts, bounds, dispose() { if (!disposed) { disposed = true; disposeObject(root); } } };
  } catch (error) { disposeObject(preparedRoot ?? model); throw error; }
}
