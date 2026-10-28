import { Box3, Group, Mesh, Vector3 } from 'three';
import type { BufferGeometry, Object3D } from 'three';
import { pmAuxiliaryMeshes, pmCards, pmGroups } from '../exhibits/pm';
import { splitGeometryIslands } from './geometry-islands';
import type { GeometryIsland } from './geometry-islands';
import { disposeObject } from './model';
import { applySpread } from './state';
import type { PartGroup, PreparedModel } from './types';

/** Keep extras out of the exhibited subtree, preserving shared resource ownership. */
export function separatePMAuxiliaries(model: Object3D): Group {
  const meshes: Mesh[] = []; model.traverse(node => { if (node instanceof Mesh) meshes.push(node); });
  const names = new Set(meshes.map(mesh => mesh.name)), core = new Set(pmGroups.map(spec => spec.sourceMesh));
  if (meshes.length !== 12 || names.size !== 12 || [...core, ...pmAuxiliaryMeshes].some(name => !names.has(name))) throw new Error('Unexpected PM meshes');
  const auxiliary = new Group(); auxiliary.name = 'PM-source-auxiliaries'; model.updateMatrixWorld(true);
  const excluded = new Set<string>(pmAuxiliaryMeshes); meshes.filter(mesh => excluded.has(mesh.name)).forEach(mesh => auxiliary.attach(mesh));
  return auxiliary;
}

/** Normalize the core-only subtree: source X is longitudinal and Y is up. */
export function normalizePM(model: Object3D): Group {
  model.updateMatrixWorld(true); const box = new Box3().setFromObject(model, true), length = box.getSize(new Vector3()).x;
  if (box.isEmpty() || !Number.isFinite(length) || length <= 0) throw new Error('Invalid PM frame');
  const centered = new Group(); centered.position.copy(box.getCenter(new Vector3())).negate(); centered.add(model);
  const scaled = new Group(); scaled.scale.setScalar(4.1 / length); scaled.add(centered);
  const root = new Group(); root.add(scaled); root.updateMatrixWorld(true); return root;
}

// A tall frame, broad slide and separate magazine retain this pistol's proportions.
// All fragments move together; positions are museum composition only.
const targets = [
  [-2, -.7], [-2, 1.85], [-2.8, 1.1], [.7, -.5], [2.3, 1.8], [3.6, 1.8],
  [2.3, .8], [3.6, .8], [2.3, -.2], [.9, 1.95], [2.3, -1.2], [3.6, -1.2], [2.3, -2.2], [3.6, -2.2],
] as const;

export function pmViewYaw(selected?: string): number { return selected === 'pm-13' ? -1.1 : -.28; }

function disposeBundle(model: Object3D, auxiliary?: Group): void {
  const owner = new Group(); owner.add(model); if (auxiliary) owner.add(auxiliary); disposeObject(owner);
}

export function preparePM(model: Object3D): PreparedModel {
  let root: Group | undefined, auxiliary: Group | undefined;
  const unattached = new Set<BufferGeometry>();
  try {
    auxiliary = separatePMAuxiliaries(model);
    const meshes = new Map<string, Mesh>(); model.traverse(node => { if (node instanceof Mesh) meshes.set(node.name, node); });
    const expected = new Map<string, number>(); pmGroups.forEach(spec => expected.set(spec.sourceMesh, (expected.get(spec.sourceMesh) ?? 0) + 1));
    const islands = new Map<string, readonly GeometryIsland[]>();
    for (const [name, mesh] of meshes) {
      const split = splitGeometryIslands(mesh.geometry); split.forEach(item => unattached.add(item.geometry)); islands.set(name, split);
      if (split.length !== expected.get(name)) throw new Error(`Unexpected PM fragments: ${name}`);
    }
    if (pmGroups.length !== 14 || new Set(pmGroups.map(spec => `${spec.sourceMesh}/${spec.island}`)).size !== 14) throw new Error('Invalid PM catalog');
    root = normalizePM(model); const preparedRoot = root, preparedAuxiliary = auxiliary;
    meshes.forEach(mesh => preparedRoot.attach(mesh));
    const parts: PartGroup[] = pmGroups.map((spec, index) => {
      const mesh = meshes.get(spec.sourceMesh)!, island = islands.get(spec.sourceMesh)?.[spec.island], target = targets[index];
      if (!island || !target) throw new Error(`Missing PM fragment: ${spec.nodeName}`);
      const node = new Group(); node.name = spec.nodeName; node.position.copy(mesh.position); node.quaternion.copy(mesh.quaternion); node.scale.copy(mesh.scale);
      node.add(new Mesh(island.geometry, mesh.material)); preparedRoot.add(node); unattached.delete(island.geometry);
      const center = new Box3().setFromObject(node, true).getCenter(new Vector3());
      return { id: pmCards[index]!.id, node, position: node.position.clone(), quaternion: node.quaternion.clone(), scale: node.scale.clone(), offset: new Vector3(target[0], target[1], 0).sub(center) };
    });
    const originals = new Set<BufferGeometry>(); meshes.forEach(mesh => { mesh.removeFromParent(); originals.add(mesh.geometry); }); originals.forEach(geometry => geometry.dispose());
    const bounds = new Box3().setFromObject(root, true); applySpread(parts, 1); root.updateMatrixWorld(true); bounds.union(new Box3().setFromObject(root, true)); applySpread(parts, 0); root.updateMatrixWorld(true);
    let disposed = false;
    return { root, parts, bounds, dispose() { if (!disposed) { disposed = true; disposeBundle(preparedRoot, preparedAuxiliary); } } };
  } catch (error) { unattached.forEach(geometry => geometry.dispose()); disposeBundle(root ?? model, auxiliary); throw error; }
}
