import { Box3, Group, Material, Matrix3, Mesh, Quaternion, Texture, Vector3 } from 'three';
import type { Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { fetchGlb } from './transport';
import { applyDisplayState } from './state';
import type { ExhibitSceneConfig, ModelLoader, PartGroup, PreparedModel } from './types';

export const loadModel: ModelLoader = async (url, signal) => {
  return fetchModel(url, signal, false);
};

/** Static museum reference only: the source clip is malformed and is never played. */
export const loadStaticReference: ModelLoader = async (url, signal) => fetchModel(url, signal, true);

async function fetchModel(url: string, signal: AbortSignal, staticReference: boolean): Promise<Object3D> {
  const absolute = new URL(url, document.baseURI);
  const data = await fetchGlb(absolute, signal);
  signal.throwIfAborted();
  const loader = new GLTFLoader();
  if (staticReference) loader.register(parser => ({ name: 'museum_static_reference', async beforeRoot() { parser.json.animations = []; } }));
  const gltf = await loader.parseAsync(data, new URL('.', absolute).href);
  return gltf.scene;
}

export function disposeObject(root: Object3D): void {
  const geometries = new Set<Mesh['geometry']>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  root.traverse(node => {
    if (!(node instanceof Mesh)) return;
    geometries.add(node.geometry);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) materials.add(material);
  });
  for (const material of materials) for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value);
  for (const texture of textures) {
    const data: unknown = texture.source.data;
    if (typeof ImageBitmap !== 'undefined' && data instanceof ImageBitmap) data.close();
    texture.dispose();
  }
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
}

export function normalizeModel(model: Object3D, referenceName: string): Group {
  model.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(model, true);
  if (bounds.isEmpty()) throw new Error('Empty model');
  const center = bounds.getCenter(new Vector3());
  let xx = 0, xy = 0, xz = 0, yy = 0, yz = 0, zz = 0;
  const point = new Vector3();
  model.traverse(node => {
    if (!(node instanceof Mesh)) return;
    const positions = node.geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i += 2) {
      point.fromBufferAttribute(positions, i).applyMatrix4(node.matrixWorld).sub(center);
      xx += point.x * point.x; xy += point.x * point.y; xz += point.x * point.z;
      yy += point.y * point.y; yz += point.y * point.z; zz += point.z * point.z;
    }
  });
  const covariance = new Matrix3().set(xx, xy, xz, xy, yy, yz, xz, yz, zz);
  const axis = new Vector3(.4, .6, 1).normalize();
  for (let i = 0; i < 35; i++) axis.applyMatrix3(covariance).normalize();
  const orientation = new Quaternion().setFromUnitVectors(axis, new Vector3(1, 0, 0));
  const reference = model.getObjectByName(referenceName);
  if (!reference) throw new Error(`Missing orientation reference: ${referenceName}`);
  point.copy(new Box3().setFromObject(reference, true).getCenter(new Vector3())).sub(center).applyQuaternion(orientation);
  orientation.premultiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.atan2(-point.z, point.y) + Math.PI));
  const offset = new Group(); offset.position.copy(center).negate(); offset.add(model);
  const oriented = new Group(); oriented.quaternion.copy(orientation); oriented.add(offset);
  const frame = new Group(); frame.add(oriented); frame.updateMatrixWorld(true);
  const length = new Box3().setFromObject(frame, true).getSize(new Vector3()).x;
  if (!Number.isFinite(length) || length <= 0) throw new Error('Invalid model bounds');
  oriented.scale.setScalar(4.1 / length);
  frame.updateMatrixWorld(true);
  oriented.position.sub(new Box3().setFromObject(frame, true).getCenter(new Vector3()));
  frame.updateMatrixWorld(true);
  return frame;
}

export function prepareModel(model: Object3D, config: ExhibitSceneConfig): PreparedModel {
  let root: Group | undefined;
  try {
    root = normalizeModel(model, config.orientationReference);
    const parts: PartGroup[] = config.parts.map(part => {
      const node = root?.getObjectByName(part.nodeName);
      if (!node) throw new Error(`Missing group: ${part.nodeName}`);
      root?.attach(node);
      return { id: part.id, node, position: node.position.clone(), quaternion: node.quaternion.clone(), scale: node.scale.clone(), offset: new Vector3(...part.offset) };
    });
    root.rotation.set(...config.presentationRotation);
    applyDisplayState(parts, 0); root.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(root, true);
    applyDisplayState(parts, 1); root.updateMatrixWorld(true);
    bounds.union(new Box3().setFromObject(root, true));
    applyDisplayState(parts, 0); root.updateMatrixWorld(true);
    let disposed = false;
    const preparedRoot = root;
    return { root, parts, bounds, dispose() { if (!disposed) { disposed = true; disposeObject(preparedRoot); } } };
  } catch (error) { disposeObject(root ?? model); throw error; }
}
