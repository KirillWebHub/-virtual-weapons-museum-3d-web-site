import { Box3, Group, Mesh, Vector3 } from 'three';
import type { BufferGeometry, Object3D } from 'three';
import { ppshCards, ppshGroups, ppshMeshes } from '../exhibits/ppsh';
import { splitGeometryIslands } from './geometry-islands';
import type { GeometryIsland } from './geometry-islands';
import { disposeObject } from './model';
import { applySpread } from './state';
import type { PartGroup, PreparedModel } from './types';

/** Source X follows the barrel; Y is up. Keep every source surface in place. */
export function normalizePPSh(model: Object3D): Group {
  model.updateMatrixWorld(true);
  const box = new Box3().setFromObject(model, true), length = box.getSize(new Vector3()).x;
  if (box.isEmpty() || !Number.isFinite(length) || length <= 0) throw new Error('Invalid PPSh frame');
  const centered = new Group(); centered.position.copy(box.getCenter(new Vector3())).negate(); centered.add(model);
  const scaled = new Group(); scaled.scale.setScalar(4.1 / length); scaled.add(centered);
  const root = new Group(); root.add(scaled); root.updateMatrixWorld(true); return root;
}

// Five spacious shelves on the left, a six-column cabinet of small fragments on the right.
// Every fragment moves simultaneously; targets have no mechanical meaning.
const majorTargets = [[-1.6, 1.65], [-1.6, .25], [-1.6, 1.08], [-1.6, -.6], [-1.6, -1.48]] as const;
function targetFor(index: number): Vector3 {
  const major = majorTargets[index]; if (major) return new Vector3(major[0], major[1], 0);
  const slot = index - majorTargets.length;
  return new Vector3(.35 + slot % 6 * .5, 1.65 - Math.floor(slot / 6) * .55, 0);
}

// The drum is thin on X: a more oblique opening angle makes its broad face legible.
export function ppshViewYaw(selected?: string): number {
  const index = ppshCards.findIndex(card => card.id === selected);
  return index >= 0 && ppshGroups[index]?.sourceMesh === ppshMeshes.drum ? -1.1 : -.4;
}

export function preparePPSh(model: Object3D): PreparedModel {
  let root: Group | undefined;
  const unattached = new Set<BufferGeometry>();
  try {
    const meshes = new Map<string, Mesh>(); model.traverse(node => { if (node instanceof Mesh) meshes.set(node.name, node); });
    const expectedCounts = new Map<string, number>([[ppshMeshes.body, 30], [ppshMeshes.handle, 2], [ppshMeshes.lower, 1], [ppshMeshes.lever, 2], [ppshMeshes.trigger, 1], [ppshMeshes.sight, 1], [ppshMeshes.drum, 6]]);
    if (meshes.size !== expectedCounts.size || [...expectedCounts.keys()].some(name => !meshes.has(name))) throw new Error('Unexpected PPSh meshes');
    const islands = new Map<string, readonly GeometryIsland[]>();
    for (const [name, mesh] of meshes) {
      const split = splitGeometryIslands(mesh.geometry); split.forEach(item => unattached.add(item.geometry)); islands.set(name, split);
      if (split.length !== expectedCounts.get(name)) throw new Error(`Unexpected PPSh fragments: ${name}`);
    }
    if (ppshGroups.length !== 43 || new Set(ppshGroups.map(group => `${group.sourceMesh}/${group.island}`)).size !== 43) throw new Error('Invalid PPSh catalog');
    root = normalizePPSh(model); const preparedRoot = root;
    meshes.forEach(mesh => preparedRoot.attach(mesh));
    const parts: PartGroup[] = ppshGroups.map((spec, index) => {
      const mesh = meshes.get(spec.sourceMesh)!, island = islands.get(spec.sourceMesh)?.[spec.island];
      if (!island) throw new Error(`Missing PPSh fragment: ${spec.nodeName}`);
      const node = new Group(); node.name = spec.nodeName; node.position.copy(mesh.position); node.quaternion.copy(mesh.quaternion); node.scale.copy(mesh.scale);
      node.add(new Mesh(island.geometry, mesh.material)); preparedRoot.add(node); unattached.delete(island.geometry);
      const center = new Box3().setFromObject(node, true).getCenter(new Vector3());
      return { id: ppshCards[index]!.id, node, position: node.position.clone(), quaternion: node.quaternion.clone(), scale: node.scale.clone(), offset: targetFor(index).sub(center) };
    });
    // Geometry is replaced in memory only; materials/textures remain shared by the new fragments.
    const originals = new Set<BufferGeometry>(); meshes.forEach(mesh => { mesh.removeFromParent(); originals.add(mesh.geometry); }); originals.forEach(geometry => geometry.dispose());
    const bounds = new Box3().setFromObject(root, true); applySpread(parts, 1); root.updateMatrixWorld(true); bounds.union(new Box3().setFromObject(root, true)); applySpread(parts, 0); root.updateMatrixWorld(true);
    let disposed = false;
    return { root, parts, bounds, dispose() { if (!disposed) { disposed = true; disposeObject(preparedRoot); } } };
  } catch (error) { unattached.forEach(geometry => geometry.dispose()); disposeObject(root ?? model); throw error; }
}
