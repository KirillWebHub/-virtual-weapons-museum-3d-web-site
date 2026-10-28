import { Box3, DirectionalLight, HemisphereLight, OrthographicCamera, Scene, Vector3 } from 'three';
import type { Object3D, Texture, WebGLRenderer } from 'three';
import showcaseUrl from '../assets/hero/display-case.glb?url';
import { exhibits } from '../content/exhibits';
import { exhibitCovers } from '../content/covers';
import { LatestAsset } from '../exhibit/lifecycle';
import { disposeObject, loadModel } from '../exhibit/model';
import { acquireSurface } from '../exhibit/render-surface';
import type { SurfaceLease } from '../exhibit/render-surface';
import type { ExhibitSceneState, ModelLoader } from '../exhibit/types';
import { clipView } from '../exhibit/view';
import { loadSilhouette, makeContactShadow, makeLabel } from './showcase-artwork';
import { prepareShowcase, setShowcaseLayout } from './showcase-model';
import type { PreparedShowcase } from './showcase-model';

export interface ShowcaseOptions { readonly view: HTMLElement; readonly onState: (state: ExhibitSceneState) => void; readonly loader?: ModelLoader; readonly silhouetteLoader?: typeof loadSilhouette }
export interface HeroSceneController { setHeroProgress(progress: number): void; setHeroPointer?(x: number, y: number): void }
export type ShowcaseFactory = (host: HTMLElement, options: ShowcaseOptions) => ShowcaseScene;

/** A decorative cover. It never requests any of the five weapon GLBs. */
export class ShowcaseScene implements HeroSceneController {
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera(-5, 5, 5, -5, .1, 60);
  private readonly assets = new LatestAsset<PreparedShowcase>(asset => { this.scene.remove(asset.root); asset.dispose(); });
  private surface: SurfaceLease | undefined;
  private disposed = false;
  private lost = false;
  private progress = 1;
  private pointer = { x: 0, y: 0 };

  constructor(host: HTMLElement, private readonly options: ShowcaseOptions) {
    try {
      this.surface = acquireSurface(host, { draw: renderer => this.render(renderer), lost: () => { this.lost = true; this.options.onState({ type: 'error', message: '3D-просмотр прерван.' }); } });
      this.scene.environment = this.surface.environment; this.scene.environmentIntensity = .7;
      const key = new DirectionalLight(0xf1e4c9, 3); key.position.set(-3, 6, 5);
      const fill = new DirectionalLight(0xc2d1ce, 1.3); fill.position.set(3, 3, 6);
      const rim = new DirectionalLight(0xffb18a, 2); rim.position.set(-1, 5, -4);
      this.scene.add(key, fill, rim, new HemisphereLight(0xe8e2cf, 0x1a1c17, 1.5));
    } catch (error) { this.dispose(); throw error; }
  }
  async show(): Promise<void> {
    if (this.disposed) return; this.options.onState({ type: 'loading' });
    try {
      const asset = await this.assets.replace(async signal => {
        const results = await Promise.allSettled([
          (this.options.loader ?? loadModel)(showcaseUrl, signal),
          ...exhibits.map(record => (this.options.silhouetteLoader ?? loadSilhouette)(exhibitCovers[record.id].image, signal)),
        ]);
        const modelResult = results[0]!, textures: Texture[] = [], labels: Texture[] = [];
        let model: Object3D | undefined, shadow: Texture | undefined;
        try {
          for (const [index, result] of results.entries()) if (result.status === 'fulfilled') {
            if (!index) model = result.value as Object3D; else textures.push(result.value as Texture);
          }
          if (modelResult.status === 'rejected' || results.some(result => result.status === 'rejected') || !model) throw new Error('Showcase assets unavailable');
          exhibits.forEach((record, index) => labels.push(makeLabel(index, exhibitCovers[record.id].label, record.periodLabel)));
          shadow = makeContactShadow();
          return prepareShowcase(model, textures.map((silhouette, index) => ({ silhouette, label: labels[index]! })), shadow);
        } catch (error) { if (model) disposeObject(model); textures.forEach(texture => texture.dispose()); labels.forEach(texture => texture.dispose()); shadow?.dispose(); throw error; }
      });
      if (!asset || this.disposed || this.lost) return;
      this.scene.add(asset.root); this.resize(); this.options.onState({ type: 'ready' }); this.surface?.request();
    } catch { if (!this.disposed) this.options.onState({ type: 'error', message: 'Не удалось загрузить музейную композицию.' }); }
  }
  private render(renderer: WebGLRenderer): void {
    const asset = this.assets.value; if (!asset || this.disposed || this.lost) return;
    const rect = this.options.view.getBoundingClientRect(), clip = clipView(rect, innerWidth, innerHeight); if (!clip) return;
    const compact = rect.width < 640; setShowcaseLayout(asset.root, compact);
    asset.root.rotation.set(this.pointer.y * .025, -.13 + .19 * this.progress + this.pointer.x * .065, 0);
    asset.root.position.y = -.13 * (1 - this.progress); asset.root.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(asset.root, true), center = bounds.getCenter(new Vector3());
    this.camera.position.copy(center).add(new Vector3(-3.6, compact ? 4.5 : 3.1, 9)); this.camera.lookAt(center); this.camera.updateMatrixWorld(true);
    const projected = bounds.clone().applyMatrix4(this.camera.matrixWorldInverse), size = projected.getSize(new Vector3()), middle = projected.getCenter(new Vector3()), aspect = rect.width / rect.height;
    const half = Math.max(size.y / 1.76, size.x / (aspect * 1.92), .1);
    this.camera.left = middle.x - half * aspect; this.camera.right = middle.x + half * aspect; this.camera.top = middle.y + half; this.camera.bottom = middle.y - half; this.camera.updateProjectionMatrix();
    renderer.setViewport(rect.left, innerHeight - rect.bottom, rect.width, rect.height); renderer.setScissor(clip.x, clip.y, clip.width, clip.height); renderer.render(this.scene, this.camera);
    this.options.view.dataset['vitrines'] = '5'; this.options.view.dataset['pose'] = `${this.progress.toFixed(3)},${this.pointer.x.toFixed(3)},${this.pointer.y.toFixed(3)}`;
  }
  setHeroProgress(progress: number): void { this.progress = Math.max(0, Math.min(1, progress)); this.surface?.request(); }
  setHeroPointer(x: number, y: number): void { this.pointer = { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) }; this.surface?.request(); }
  resize(): void { if (!this.disposed) { this.surface?.resize(); this.surface?.request(); } }
  dispose(): void { if (this.disposed) return; this.disposed = true; this.assets.dispose(); this.surface?.dispose(); this.surface = undefined; }
}
