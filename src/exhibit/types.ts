import type { Box3, Group, Object3D, Quaternion, Vector3 } from 'three';
import type { ExhibitId } from '../content/types';

export type Point3 = readonly [number, number, number];
export interface PartDefinition { readonly id: string; readonly label: string; readonly nodeName: string; readonly offset: Point3 }
export interface AnnotationDefinition {
  readonly id: string; readonly label: string; readonly nodeName: string;
  /** Approximate point in the normalized assembled frame; snapped to existing geometry. */
  readonly point: Point3; readonly description: string; readonly source: string;
}
export interface ExhibitSceneConfig {
  readonly id: ExhibitId;
  readonly orientationReference: string;
  readonly presentationRotation: Point3;
  readonly parts: readonly PartDefinition[];
}
export interface PartGroup {
  readonly id: string;
  readonly node: Object3D;
  readonly position: Vector3;
  readonly quaternion: Quaternion;
  readonly scale: Vector3;
  readonly offset: Vector3;
}
export interface PreparedModel { readonly root: Group; readonly parts: readonly PartGroup[]; readonly bounds: Box3; dispose(): void }
export type ModelLoader = (url: string, signal: AbortSignal) => Promise<Object3D>;
export type ExhibitSceneState = { readonly type: 'loading' | 'ready' } | { readonly type: 'error'; readonly message: string };
