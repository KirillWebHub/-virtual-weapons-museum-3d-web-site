import { Box3, Group, Mesh, Vector3 } from 'three';
import type { BufferGeometry, Object3D } from 'three';
import { sksCards, sksGroups } from '../exhibits/sks';
import { splitGeometryIslands } from './geometry-islands';
import type { GeometryIsland } from './geometry-islands';
import { disposeObject } from './model';
import { applySpread } from './state';
import type { PartGroup, PreparedModel } from './types';

/** This source is long on Z, muzzle towards -Z; Y stays up. */
export function normalizeSKS(model: Object3D): Group {
  model.updateMatrixWorld(true);
  const box = new Box3().setFromObject(model, true);
  if (box.isEmpty()) throw new Error('Empty SKS model');
  const centered = new Group(); centered.position.copy(box.getCenter(new Vector3())).negate(); centered.add(model);
  const oriented = new Group(); oriented.rotation.y = Math.PI / 2; oriented.add(centered);
  const root = new Group(); root.add(oriented); root.updateMatrixWorld(true);
  const length = new Box3().setFromObject(root, true).getSize(new Vector3()).x;
  if (!Number.isFinite(length) || length <= 0) throw new Error('Invalid SKS frame');
  oriented.scale.setScalar(4.1 / length); root.updateMatrixWorld(true); return root;
}

// Targets are an exhibition cabinet adapted to this source, not assembly steps.
const targets = [
  [-1.4, -.8], [-2, 1.3], [-.4, 1.3], [-1.45, .55], [-2.55, 0], [-1.6, 0], [-.65, 0],
  [-2.2, -1.6], [-1.2, -1.6], [-.4, -1.6], [-3.15, -.8], [-1.5, 1.9],
  [.8, 1.5], [1.65, 1.5], [2.5, 1.5], [.8, .65], [1.65, .65], [2.5, .65], [.8, -.2], [1.65, -.2], [2.5, -.2], [.8, -1.05],
] as const;

/** Thin end plates need a broader opening view; the handle group shows its other side. */
export function sksViewYaw(selected?: string): number {
  const index = sksCards.findIndex(card => card.id === selected);
  return index === 5 ? Math.PI - .22 : [10, 18, 19, 20].includes(index) ? -1.1 : -.22;
}

export function prepareSKS(model: Object3D): PreparedModel {
  let root: Group | undefined;
  const unattached = new Set<BufferGeometry>();
  try {
    const allMeshes: Mesh[] = []; model.traverse(node => { if (node instanceof Mesh) allMeshes.push(node); });
    const meshes = new Map(allMeshes.map(mesh => [mesh.name, mesh]));
    const expected = new Map<string, number>(); sksGroups.forEach(spec => expected.set(spec.sourceMesh, (expected.get(spec.sourceMesh) ?? 0) + 1));
    if (allMeshes.length !== 21 || meshes.size !== 21 || [...expected.keys()].some(name => !meshes.has(name))) throw new Error('Unexpected SKS meshes');
    const islands = new Map<string, readonly GeometryIsland[]>();
    for (const [name, mesh] of meshes) {
      const split = splitGeometryIslands(mesh.geometry); split.forEach(item => unattached.add(item.geometry)); islands.set(name, split);
      if (split.length !== expected.get(name)) throw new Error(`Unexpected SKS fragments: ${name}`);
    }
    if (sksGroups.length !== 22 || new Set(sksGroups.map(group => `${group.sourceMesh}/${group.island}`)).size !== 22) throw new Error('Invalid SKS catalog');
    root = normalizeSKS(model); const preparedRoot = root;
    meshes.forEach(mesh => preparedRoot.attach(mesh));
    const parts: PartGroup[] = sksGroups.map((spec, index) => {
      const mesh = meshes.get(spec.sourceMesh)!, island = islands.get(spec.sourceMesh)?.[spec.island], target = targets[index];
      if (!island || !target) throw new Error(`Missing SKS fragment: ${spec.nodeName}`);
      const node = new Group(); node.name = spec.nodeName; node.position.copy(mesh.position); node.quaternion.copy(mesh.quaternion); node.scale.copy(mesh.scale);
      node.add(new Mesh(island.geometry, mesh.material)); preparedRoot.add(node); unattached.delete(island.geometry);
      const center = new Box3().setFromObject(node, true).getCenter(new Vector3());
      return { id: sksCards[index]!.id, node, position: node.position.clone(), quaternion: node.quaternion.clone(), scale: node.scale.clone(), offset: new Vector3(target[0], target[1], 0).sub(center) };
    });
    const originals = new Set<BufferGeometry>(); meshes.forEach(mesh => { mesh.removeFromParent(); originals.add(mesh.geometry); }); originals.forEach(geometry => geometry.dispose());
    const bounds = new Box3().setFromObject(root, true); applySpread(parts, 1); root.updateMatrixWorld(true); bounds.union(new Box3().setFromObject(root, true)); applySpread(parts, 0); root.updateMatrixWorld(true);
    let disposed = false;
    return { root, parts, bounds, dispose() { if (!disposed) { disposed = true; disposeObject(preparedRoot); } } };
  } catch (error) { unattached.forEach(geometry => geometry.dispose()); disposeObject(root ?? model); throw error; }
}
