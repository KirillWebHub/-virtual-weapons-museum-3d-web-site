import type { ExhibitId } from '../content/types';

export interface Point { x: number; y: number; z: number }
export interface PixelPoint { x: number; y: number }
export type FinaleState = 'idle' | 'loading' | 'ready' | 'error' | 'closed';
export interface FinaleFrame {
  progress: number; visible: boolean; mobile: boolean; front: boolean;
  paper: number; stamp: number; intro: number; flightCaption: number;
  flash: number; smoke: number; trail: number; wave: number; waveScale: number; mark: number;
  impact: PixelPoint; muzzle: PixelPoint; tip: PixelPoint; bodyPixels: number;
  flight: number; nose: Point; origin: Point; target: Point; bulletScale: number;
  weaponVisible: boolean; bulletVisible: boolean; lateralError: number; impactError: number;
}
export interface FinaleSceneOptions {
  id: ExhibitId; element: HTMLElement;
  onFrame(frame: FinaleFrame): void; onState(state: FinaleState): void;
  reducedMotion(): boolean;
}
export interface FinaleSectionOptions {
  onProgress(progress: number): void;
  onActivate(): void;
  onRetry(): void;
  onLayer(front: boolean): void;
  reducedMotion?: boolean;
}
export interface FinaleSection {
  element: HTMLElement; visual: HTMLElement;
  update(frame: FinaleFrame): void; setState(state: FinaleState): void;
  dispose(): void;
}
