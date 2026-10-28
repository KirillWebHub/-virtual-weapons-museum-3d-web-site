import { Box3, Group, LatheGeometry, Mesh, MeshStandardMaterial, TorusGeometry, Vector2 } from 'three';
import type { BulletProfile } from './data';

export interface FinaleBullet extends Group { userData: { bounds: Box3 } }
const profiles: Readonly<Record<BulletProfile, readonly (readonly [number, number])[]>> = {
  pointed: [[0, -.5], [.12, -.5], [.15, -.45], [.15, .06], [.13, .24], [.075, .4], [0, .53]],
  long: [[0, -.65], [.12, -.65], [.14, -.59], [.14, .07], [.12, .30], [.06, .53], [0, .67]],
  round: [[0, -.42], [.17, -.42], [.19, -.36], [.19, .04], [.17, .20], [.115, .34], [.045, .41], [0, .43]],
  dome: [[0, -.32], [.21, -.32], [.23, -.26], [.23, .03], [.2, .17], [.13, .27], [0, .32]],
};

/** Stylized external geometry in dimensionless coordinates; no ammunition internals. */
export function createBullet(kind: BulletProfile): FinaleBullet {
  const material = new MeshStandardMaterial({ color: 0xb8784e, metalness: .85, roughness: .28 });
  const mesh = new Mesh(new LatheGeometry(profiles[kind].map(([radius, height]) => new Vector2(radius, height)), 64), material);
  mesh.rotation.z = -Math.PI / 2;
  const root = new Group() as FinaleBullet; root.add(mesh);
  const radius = kind === 'dome' ? .225 : kind === 'round' ? .185 : kind === 'long' ? .138 : .148;
  const ridge = new Mesh(new TorusGeometry(radius, .007, 6, 48), new MeshStandardMaterial({ color: 0x8c542f, metalness: .8, roughness: .35 }));
  ridge.rotation.y = Math.PI / 2; ridge.position.x = kind === 'long' ? -.42 : kind === 'dome' ? -.20 : -.30;
  root.add(ridge); root.updateMatrixWorld(true);
  // Cache before presentation transforms; rebuilding a camera must never rescale the bullet.
  root.userData.bounds = new Box3().setFromObject(root, true);
  return root;
}
