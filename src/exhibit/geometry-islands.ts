import { BufferGeometry, Float32BufferAttribute } from 'three';

export interface GeometryIsland { readonly geometry: BufferGeometry; readonly triangleIds: readonly number[] }

/** Weld UV/normal seams for connectivity only; retain every original corner attribute. */
export function splitGeometryIslands(source: BufferGeometry): readonly GeometryIsland[] {
  const position = source.getAttribute('position'), index = source.index;
  if (!position || !index || index.count % 3 !== 0) throw new Error('Expected indexed triangles');
  const parent = Array.from({ length: position.count }, (_, i) => i), vertices = new Map<string, number>();
  const find = (vertex: number): number => { while (parent[vertex] !== vertex) { parent[vertex] = parent[parent[vertex]!]!; vertex = parent[vertex]!; } return vertex; };
  const join = (a: number, b: number): void => { parent[find(a)] = find(b); };
  for (let vertex = 0; vertex < position.count; vertex++) {
    const key = [position.getX(vertex), position.getY(vertex), position.getZ(vertex)].map(value => Math.round(value * 1e5)).join('/');
    const match = vertices.get(key); if (match !== undefined) join(vertex, match); else vertices.set(key, vertex);
  }
  for (let i = 0; i < index.count; i += 3) { join(index.getX(i), index.getX(i + 1)); join(index.getX(i), index.getX(i + 2)); }
  const groups = new Map<number, number[]>();
  for (let i = 0; i < index.count; i += 3) { const owner = find(index.getX(i)); let triangles = groups.get(owner); if (!triangles) { triangles = []; groups.set(owner, triangles); } triangles.push(i / 3); }
  const islands: GeometryIsland[] = [];
  try {
    for (const triangleIds of [...groups.values()].sort((a, b) => b.length - a.length || a[0]! - b[0]!)) {
      const lookup = new Map<number, number>(), originals: number[] = [], indices: number[] = [];
      for (const triangle of triangleIds) for (let corner = 0; corner < 3; corner++) {
        const old = index.getX(triangle * 3 + corner); let next = lookup.get(old);
        if (next === undefined) { next = originals.length; lookup.set(old, next); originals.push(old); } indices.push(next);
      }
      const geometry = new BufferGeometry(); islands.push({ geometry, triangleIds });
      for (const [name, attribute] of Object.entries(source.attributes)) {
        const array = new Float32Array(originals.length * attribute.itemSize);
        originals.forEach((vertex, i) => { for (let component = 0; component < attribute.itemSize; component++) array[i * attribute.itemSize + component] = attribute.getComponent(vertex, component); });
        geometry.setAttribute(name, new Float32BufferAttribute(array, attribute.itemSize));
      }
      geometry.setIndex(indices); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    }
    return islands;
  } catch (error) { islands.forEach(island => island.geometry.dispose()); throw error; }
}
