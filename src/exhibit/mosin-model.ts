import { Box3, Group, Mesh, Vector3 } from 'three';
import type { Object3D } from 'three';
import { mosinCards } from '../exhibits/mosin';
import { disposeObject } from './model';
import { applySpread } from './state';
import type { PartGroup, PreparedModel } from './types';

/** The source is long on Z, with Y up. Preserve its exact assembled geometry. */
export function normalizeMosin(model: Object3D): Group {
  model.updateMatrixWorld(true);
  const box = new Box3().setFromObject(model, true);
  if (box.isEmpty()) throw new Error('Empty Mosin model');
  const centered = new Group(); centered.position.copy(box.getCenter(new Vector3())).negate(); centered.add(model);
  const oriented = new Group(); oriented.rotation.y = -Math.PI / 2; oriented.add(centered);
  const root = new Group(); root.add(oriented); root.updateMatrixWorld(true);
  const length = new Box3().setFromObject(root, true).getSize(new Vector3()).x;
  if (!Number.isFinite(length) || length <= 0) throw new Error('Invalid Mosin frame');
  oriented.scale.setScalar(4.1 / length); root.updateMatrixWorld(true);
  oriented.position.sub(new Box3().setFromObject(root, true).getCenter(new Vector3())); root.updateMatrixWorld(true);
  return root;
}

// Three exhibition shelves. Coordinates are specific to the proportions of this rifle.
const targets = [
  [-1.45, 1.03], [-2.8, 1.55], [-1.45, 1.65], [-1.45, -1.24], [-1.4, .43], [-1.4, -.24], [-1, -1.83], [-2.8, 1.03],
  [1.45, -.9], [.9, -.14], [.9, -1.83], [2.65, .45], [1.1, 1.55], [2.65, -.9], [.3, 1.03], [1.45, 1.03], [2.65, 1.03], [1.25, .45], [2.7, 1.65],
] as const;

export function prepareMosin(model: Object3D): PreparedModel {
  let root: Group | undefined;
  try {
    const owners: Object3D[] = []; model.traverse(node => { if (!(node instanceof Mesh) && node.children.some(child => child instanceof Mesh)) owners.push(node); });
    const names = new Set(owners.map(node => node.name));
    if (owners.length !== mosinCards.length || mosinCards.some(card => !names.has(card.nodeName))) throw new Error('Unexpected Mosin groups');
    root = normalizeMosin(model);
    const preparedRoot = root;
    const parts: PartGroup[] = mosinCards.map((card, index) => {
      const node = preparedRoot.getObjectByName(card.nodeName)!; preparedRoot.attach(node);
      const center = new Box3().setFromObject(node, true).getCenter(new Vector3()), target = targets[index]!;
      return { id: card.id, node, position: node.position.clone(), quaternion: node.quaternion.clone(), scale: node.scale.clone(), offset: new Vector3(target[0], target[1], 0).sub(center) };
    });
    const bounds = new Box3().setFromObject(root, true); applySpread(parts, 1); root.updateMatrixWorld(true); bounds.union(new Box3().setFromObject(root, true)); applySpread(parts, 0); root.updateMatrixWorld(true);
    let disposed = false;
    return { root, parts, bounds, dispose() { if (!disposed) { disposed = true; disposeObject(preparedRoot); } } };
  } catch (error) { disposeObject(root ?? model); throw error; }
}
