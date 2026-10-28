import { DirectionalLight, HemisphereLight, OrthographicCamera, Scene } from 'three';
import type { WebGLRenderer } from 'three';
import { gsap } from 'gsap';
import coinUrl from '../assets/hero/soviet-coin-1946.glb?url';
import { LatestAsset } from '../exhibit/lifecycle';
import { loadModel } from '../exhibit/model';
import { acquireSurface } from '../exhibit/render-surface';
import type { SurfaceLease } from '../exhibit/render-surface';
import { clipView } from '../exhibit/view';
import type { ExhibitSceneState, ModelLoader } from '../exhibit/types';
import { prepareCoin } from './coin-model';
import type { PreparedCoin } from './coin-model';

export interface CoinController { setRotation(yaw: number, pitch: number, animated?: boolean): void; setReducedMotion(reduced: boolean): void }
export interface CoinSceneOptions { readonly view: HTMLElement; readonly onState: (state: ExhibitSceneState) => void; readonly loader?: ModelLoader }
export type CoinFactory = (host: HTMLElement, options: CoinSceneOptions) => CoinScene;

/** Independent asset/state, shared canvas. An optional coin never blocks the vitrines. */
export class CoinScene implements CoinController {
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera(-1.15, 1.15, 1.15, -1.15, .1, 30);
  private readonly assets = new LatestAsset<PreparedCoin>(asset => { this.scene.remove(asset.root); asset.dispose(); });
  private surface: SurfaceLease | undefined;
  private readonly pose = { yaw: 0, pitch: 0 };
  private target = { yaw: 0, pitch: 0 };
  private tween: gsap.core.Tween | undefined;
  private disposed = false;
  private lost = false;
  private reduced = false;
  constructor(host: HTMLElement, private readonly options: CoinSceneOptions) {
    try {
      this.surface = acquireSurface(host, { draw: renderer => this.render(renderer), lost: () => { this.lost = true; this.options.onState({ type: 'error', message: 'Coin context lost' }); } });
      this.scene.environment = this.surface.environment; this.scene.environmentIntensity = .6;
      const key = new DirectionalLight(0xffe6b6, 2.1); key.position.set(-3, 4, 5);
      const fill = new DirectionalLight(0xe3e8ec, 1); fill.position.set(3, 1, 4);
      this.scene.add(key, fill, new HemisphereLight(0xf3e5c8, 0x29231d, .85));
      this.camera.position.z = 6; this.camera.lookAt(0, 0, 0); this.camera.updateMatrixWorld();
    } catch (error) { this.dispose(); throw error; }
  }
  async show(): Promise<void> {
    if (this.disposed) return; this.options.onState({ type: 'loading' });
    try {
      const asset = await this.assets.replace(async signal => prepareCoin(await (this.options.loader ?? loadModel)(coinUrl, signal)));
      if (!asset || this.disposed || this.lost) return;
      this.scene.add(asset.root); this.resize(); this.options.onState({ type: 'ready' }); this.surface?.request();
    } catch { if (!this.disposed) this.options.onState({ type: 'error', message: 'Coin unavailable' }); }
  }
  private render(renderer: WebGLRenderer): void {
    const asset = this.assets.value; if (!asset || this.disposed || this.lost) return;
    const rect = this.options.view.getBoundingClientRect(), clip = clipView(rect, innerWidth, innerHeight); if (!clip) return;
    asset.root.rotation.set(this.pose.pitch, this.pose.yaw + .08, .02);
    const aspect = rect.width / rect.height, half = 1.14;
    this.camera.left = -half * Math.max(1, aspect); this.camera.right = half * Math.max(1, aspect);
    this.camera.top = half * Math.max(1, 1 / aspect); this.camera.bottom = -this.camera.top; this.camera.updateProjectionMatrix();
    renderer.setViewport(rect.left, innerHeight - rect.bottom, rect.width, rect.height); renderer.setScissor(clip.x, clip.y, clip.width, clip.height); renderer.render(this.scene, this.camera);
    this.options.view.dataset['rotation'] = `${this.pose.yaw.toFixed(3)},${this.pose.pitch.toFixed(3)}`;
  }
  setRotation(yaw: number, pitch: number, animated = false): void {
    if (this.disposed) return; this.tween?.kill(); this.target = { yaw, pitch };
    if (animated && !this.reduced) this.tween = gsap.to(this.pose, { yaw, pitch, duration: .6, ease: 'power2.inOut', onUpdate: () => this.surface?.request() });
    else { Object.assign(this.pose, this.target); this.surface?.request(); }
  }
  setReducedMotion(reduced: boolean): void { this.reduced = reduced; if (reduced) { this.tween?.kill(); Object.assign(this.pose, this.target); this.surface?.request(); } }
  resize(): void { if (!this.disposed) { this.surface?.resize(); this.surface?.request(); } }
  dispose(): void { if (this.disposed) return; this.disposed = true; this.tween?.kill(); this.assets.dispose(); this.surface?.dispose(); this.surface = undefined; }
}
