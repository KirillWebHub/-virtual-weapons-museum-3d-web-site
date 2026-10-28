import type { ExhibitId } from '../content/types';
import type { Point3 } from '../exhibit/types';

export type BulletProfile = 'pointed' | 'long' | 'round' | 'dome';
export interface FinaleRecord {
  readonly muzzle: Point3;
  readonly ammo: string;
  readonly profile: BulletProfile;
  readonly index: string;
}

/** Anchors belong to the existing normalized illustrations, not to physical dimensions. */
export const finaleRecords: Readonly<Record<ExhibitId, FinaleRecord>> = {
  mosin: { muzzle: [-2.05, .162270, -.031905], ammo: '7,62×54R', profile: 'long', index: '01' },
  ppsh: { muzzle: [-1.897065, .297171, .000021], ammo: '7,62×25 ТТ', profile: 'round', index: '02' },
  sks: { muzzle: [-2.05, .183477, .018730], ammo: '7,62×39', profile: 'pointed', index: '03' },
  pm: { muzzle: [-2.05, 1.239653, -.015527], ammo: '9×18 ПМ', profile: 'dome', index: '04' },
  akm: { muzzle: [-1.515780, .294079, .236991], ammo: '7,62×39', profile: 'pointed', index: '05' },
};
