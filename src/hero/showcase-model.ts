import { Box3, BoxGeometry, DoubleSide, EdgesGeometry, Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry } from 'three';
import type { BufferGeometry, Material, Object3D, Texture } from 'three';
import { disposeObject } from '../exhibit/model';

export interface ShowcaseArtwork { readonly silhouette: Texture; readonly label: Texture }
export interface PreparedShowcase { readonly root: Group; readonly bounds: Box3; dispose(): void }

/** One uploaded stand, shared geometry/materials, five distinct museum illustrations. */
export function prepareShowcase(model: Object3D, artwork: readonly ShowcaseArtwork[], shadow: Texture): PreparedShowcase {
  const glass = model.getObjectByName('Object_4'), base = model.getObjectByName('Object_5'), cushion = model.getObjectByName('Object_6');
  if (!(glass instanceof Mesh) || !(base instanceof Mesh) || !(cushion instanceof Mesh) || artwork.length !== 5) throw new Error('Unexpected display case');
  const root = new Group(), template = new Group(); root.add(model, template); root.updateMatrixWorld(true);
  const oldMaterials = new Set<Material>();
  for (const mesh of [glass, base, cushion]) {
    template.attach(mesh); const old = mesh.material as MeshStandardMaterial; oldMaterials.add(old); mesh.material = old.clone();
  }
  oldMaterials.forEach(material => material.dispose()); root.remove(model);
  const glassMaterial = glass.material as MeshStandardMaterial; glassMaterial.color.set('#c8d2c5'); glassMaterial.opacity = .08; glassMaterial.transparent = true; glassMaterial.depthWrite = false; glassMaterial.roughness = .1; glassMaterial.metalness = 0; glass.renderOrder = 4;
  const baseMaterial = base.material as MeshStandardMaterial; baseMaterial.color.set('#252922'); baseMaterial.metalness = .2; baseMaterial.roughness = .52;
  const cushionMaterial = cushion.material as MeshStandardMaterial; cushionMaterial.color.set('#a86652'); cushionMaterial.roughness = .92;
  // Adapt a jewellery stand into a miniature museum vitrine without editing its GLB.
  base.scale.y *= .52;
  glass.scale.y *= 2.6; glass.position.y -= .89308476448 * (2.6 - .52);
  cushion.position.y -= .89308476448 * (1 - .52);
  const edgeMaterial = new LineBasicMaterial({ color: '#b0b3a0', transparent: true, opacity: .25 });
  const edges = new LineSegments(new EdgesGeometry(glass.geometry, 24), edgeMaterial); edges.position.copy(glass.position); edges.quaternion.copy(glass.quaternion); edges.scale.copy(glass.scale); template.add(edges);
  const shadowGeometry = new PlaneGeometry(1, 1), shadowMaterial = new MeshBasicMaterial({ map: shadow, transparent: true, depthWrite: false, toneMapped: false });
  for (let index = 0; index < 5; index++) {
    const stand = index === 0 ? template : template.clone(true); stand.name = `vitrine-${index + 1}`;
    if (index) root.add(stand);
    const silhouette = new Mesh(new PlaneGeometry(.266, .171), new MeshBasicMaterial({ map: artwork[index]!.silhouette, transparent: true, alphaTest: .04, side: DoubleSide, depthWrite: false, toneMapped: false }));
    silhouette.name = `silhouette-${index + 1}`; silhouette.position.set(0, .735, .018); stand.add(silhouette);
    if (index === 3) silhouette.scale.setScalar(1.8);
    const label = new Mesh(new PlaneGeometry(.34, .20), new MeshBasicMaterial({ map: artwork[index]!.label, transparent: true, depthWrite: false, toneMapped: false }));
    label.name = `label-${index + 1}`; label.position.set(0, .24, .1482); stand.add(label);
    // Fresh geometry clones must not inherit another stand's artwork.
    if (index) for (const child of [...stand.children]) if (/^(silhouette|label)-/.test(child.name) && child !== silhouette && child !== label) stand.remove(child);
    stand.scale.set(2.6, 1.8, 1.8); stand.position.set((index - 2) * 1.48, 0, Math.abs(index - 2) * -.18); stand.rotation.y = -.06 + (index - 2) * .025;
    const contact = new Mesh(shadowGeometry, shadowMaterial); contact.name = `contact-${index + 1}`; contact.rotation.x = -Math.PI / 2; contact.scale.set(1.8, 1.3, 1); contact.position.set(stand.position.x, -.015, stand.position.z); root.add(contact);
  }
  const riser = new Mesh(new BoxGeometry(4.65, 1.2, 1.25), new MeshStandardMaterial({ color: '#252922', roughness: .65, metalness: .15 })); riser.name = 'riser'; riser.position.set(0, .6, -.7); riser.visible = false; riser.scale.setScalar(0); root.add(riser);
  root.updateMatrixWorld(true); const bounds = new Box3().setFromObject(root, true); let disposed = false;
  return { root, bounds, dispose() { if (disposed) return; disposed = true; disposeObject(root); const geometry = new Set<BufferGeometry>(), materials = new Set<Material>(); root.traverse(node => { if (node instanceof LineSegments) { geometry.add(node.geometry); materials.add(node.material as Material); } }); geometry.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); } };
}

export function setShowcaseLayout(root: Group, compact: boolean): void {
  for (let index = 0; index < 5; index++) {
    const stand = root.getObjectByName(`vitrine-${index + 1}`)!, contact = root.getObjectByName(`contact-${index + 1}`)!;
    stand.position.set(compact ? (index < 3 ? (index - 1) * 1.48 : (index - 3.5) * 1.48) : (index - 2) * 1.48, compact && index < 3 ? 1.2 : 0, compact ? (index < 3 ? -.7 : .95) : Math.abs(index - 2) * -.18);
    contact.position.set(stand.position.x, stand.position.y - .015, stand.position.z);
  }
  const riser = root.getObjectByName('riser')!; riser.visible = compact; riser.scale.setScalar(compact ? 1 : 0);
}
