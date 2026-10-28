import { Group, Quaternion, Vector3 } from 'three';
import type { Object3D } from 'three';
import type { PreparedModel } from '../exhibit/types';
import type { ExhibitId } from '../content/types';
import { finaleRecords } from './data';

/** Borrow surfaces without borrowing a chapter's current spread/selection pose. */
export function cloneAssembled(source: PreparedModel, id: ExhibitId): { root: Group; muzzle: Vector3 } {
  const original: Object3D[] = [], copies: Object3D[] = [];
  source.root.traverse(node => original.push(node));
  const copy = source.root.clone(true); copy.traverse(node => copies.push(node));
  const mapping = new Map(original.map((node, index) => [node, copies[index]!]));
  copy.position.set(0, 0, 0); copy.quaternion.identity(); copy.scale.setScalar(1); copy.visible = true;
  for (const part of source.parts) {
    const node = mapping.get(part.node)!;
    node.position.copy(part.position); node.quaternion.copy(part.quaternion); node.scale.copy(part.scale); node.visible = true;
  }
  const aligned = new Group(), root = new Group(), muzzle = new Vector3(...finaleRecords[id].muzzle);
  if (id === 'akm') {
    aligned.quaternion.copy(new Quaternion(0, -.01247800677, .01070761868, .99986481399));
    muzzle.applyQuaternion(aligned.quaternion);
  }
  aligned.add(copy); root.add(aligned); root.updateMatrixWorld(true);
  return { root, muzzle };
}

/** The chapter remains the sole owner of borrowed geometry, textures and materials. */
export function releaseSharedClone(root: Group): void { root.removeFromParent(); root.clear(); }
