import { Box3, DirectionalLight, HemisphereLight, OrthographicCamera, Raycaster, Scene, Vector2, Vector3 } from 'three';
import type { WebGLRenderer } from 'three';
import type { ExhibitId, ExhibitRecord } from '../content/types';
import { LatestAsset } from './lifecycle';
import { acquireSurface } from './render-surface';
import type { SurfaceLease } from './render-surface';
import { prepareMosin } from './mosin-model';
import { preparePPSh, ppshViewYaw } from './ppsh-model';
import { prepareSKS, sksViewYaw } from './sks-model';
import { preparePM, pmViewYaw } from './pm-model';
import { loadStaticReference } from './model';
import { prepareReference } from './reference-model';
import { applySpread, clampProgress, spreadForProgress } from './state';
import { chapterState, inspectorRotation } from './chapter-state';
import type { ProjectedAnnotation } from './annotations';
import type { AnnotationDefinition, ExhibitSceneState, ModelLoader, PreparedModel } from './types';
import { clipView, fitCamera } from './view';
import type { SceneView } from './view';
import { FinaleScene } from '../finale/FinaleScene';
import type { FinaleTargetLoader } from '../finale/FinaleScene';
import type { FinaleSceneOptions } from '../finale/types';

export interface SceneOptions {
  readonly records: readonly ExhibitRecord[];
  readonly finale?: FinaleSceneOptions & { targetLoader?: FinaleTargetLoader };
  readonly onState: (state: ExhibitSceneState) => void;
  readonly loader?: ModelLoader;
  readonly views?: readonly SceneView[];
  readonly annotations?: readonly AnnotationDefinition[];
  readonly onAnnotations?: (view: SceneView, points: readonly ProjectedAnnotation[]) => void;
}

/** One lazily loaded exhibit, with independent state and a shared render surface. */
export class ExhibitScene {
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera(-5, 5, 5, -5, .1, 100);
  private readonly assets = new LatestAsset<PreparedModel>(model => { this.scene.remove(model.root); model.dispose(); });
  private readonly cameras = new Map<HTMLElement, OrthographicCamera>();
  private readonly raycaster = new Raycaster();
  private surface: SurfaceLease | undefined;
  private finale: FinaleScene | undefined;
  private exhibitId: ExhibitId | undefined;
  private heroProgress = 1;
  private chapterProgress = 0;
  private spreadOverride: number | undefined;
  private selected: string | undefined;
  private selectedInspection: string | undefined;
  private detailRotation = { yaw: 0, pitch: 0 };
  private inspection = { yaw: 0, pitch: 0 };
  private readonly fitKeys = new Map<HTMLElement, string>();
  private readonly pointCache = new Map<HTMLElement, { key: string; points: readonly ProjectedAnnotation[] }>();
  private revision = 0;
  private disposed = false;
  private contextLost = false;

  constructor(host: HTMLElement, private readonly options: SceneOptions) {
    try {
      this.surface = acquireSurface(host, { draw: renderer => this.render(renderer), lost: this.onContextLost });
      const lightMetal = options.records.length === 1 && (options.records[0]?.id === 'mosin' || options.records[0]?.id === 'ppsh' || options.records[0]?.id === 'sks' || options.records[0]?.id === 'pm');
      this.scene.environment = this.surface.environment; this.scene.environmentIntensity = .46;
      const key = new DirectionalLight(0xe6e1d4, lightMetal ? 2 : 1.8); key.position.set(-3, 5, 4);
      const fill = new DirectionalLight(0xcbd0c5, .8); fill.position.set(1, 1, 5);
      const rim = new DirectionalLight(0xf3d4a8, .65); rim.position.set(0, 3, -5);
      this.scene.add(key, fill, rim, new HemisphereLight(0xd9d7cc, 0x181c15, 1));
      if (options.finale) this.finale = new FinaleScene(options.finale, this.surface.environment, () => this.surface?.request());
      window.addEventListener('resize', this.onResize);
    } catch (error) { this.dispose(); throw error; }
  }

  private readonly onResize = (): void => this.resize(innerWidth, innerHeight);
  private readonly onContextLost = (): void => {
    this.contextLost = true;
    this.options.onState({ type: 'error', message: '3D-просмотр прерван. Повторите загрузку; все карточки доступны текстом.' });
  };

  private applyPose(model: PreparedModel, mode: SceneView['mode']): void {
    const selected = mode === 'exhibit' ? this.selected : mode === 'inspect' ? this.selectedInspection : undefined;
    const yaw = this.exhibitId === 'pm' ? pmViewYaw(selected) : this.exhibitId === 'sks' ? sksViewYaw(selected) : this.exhibitId === 'ppsh' ? ppshViewYaw(selected) : this.exhibitId === 'mosin' ? -.18 : -.12;
    model.root.rotation.set(.08, yaw, 0); model.root.scale.setScalar(1);
    if (mode === 'hero') { model.root.rotation.set(.1, -.24, .19 + .04 * this.heroProgress); model.root.scale.setScalar(.965 + .035 * this.heroProgress); }
    if (mode === 'inspect') { model.root.rotation.x += this.inspection.pitch; model.root.rotation.y += this.inspection.yaw; }
    if (mode === 'exhibit' && selected) { model.root.rotation.x += this.detailRotation.pitch; model.root.rotation.y += this.detailRotation.yaw; }
    applySpread(model.parts, mode === 'exhibit' && !selected ? this.spreadOverride ?? chapterState(this.chapterProgress).spread : 0);
    model.parts.forEach(part => { part.node.visible = !selected || part.id === selected; }); model.root.updateMatrixWorld(true);
  }

  private projectAnnotations(view: SceneView, camera: OrthographicCamera, model: PreparedModel, key: string): void {
    if (!this.options.onAnnotations || view.mode !== 'exhibit') return;
    const selected = this.selected;
    if (selected) { this.options.onAnnotations(view, []); return; }
    const rect = view.element.getBoundingClientRect(), spread = this.spreadOverride ?? chapterState(this.chapterProgress).spread;
    const cached = this.pointCache.get(view.element);
    const points = cached?.key === key ? cached.points : model.parts.map(part => {
      const bounds = new Box3().setFromObject(part.node, true), center = bounds.getCenter(new Vector3()), world = center.clone(); world.y = bounds.max.y + .12;
      const ndc = world.clone().project(camera); let visible = ndc.z >= -1 && ndc.z <= 1;
      if (visible && spread < .98) {
        const surface = center.clone().project(camera); this.raycaster.setFromCamera(new Vector2(surface.x, surface.y), camera);
        const hit = this.raycaster.intersectObject(model.root)[0];
        let owner = hit?.object; while (owner && owner !== part.node && owner !== model.root) owner = owner.parent ?? undefined;
        visible = owner === part.node;
      }
      const x = (ndc.x + 1) * rect.width / 2, y = (1 - ndc.y) * rect.height / 2;
      return { id: part.id, x, y, visible };
    });
    this.pointCache.set(view.element, { key, points });
    this.options.onAnnotations(view, points.map(point => ({ ...point, visible: point.visible && rect.left + point.x >= 0 && rect.left + point.x <= innerWidth && rect.top + point.y >= 0 && rect.top + point.y <= innerHeight })));

  }

  private render(renderer: WebGLRenderer): void {
    const model = this.assets.value;
    if (this.disposed || this.contextLost) return;
    if (!this.options.views) { if (model) this.applyPose(model, 'exhibit'); renderer.render(this.scene, this.camera); return; }
    for (const view of this.options.views) {
      const rect = view.element.getBoundingClientRect(), clip = clipView(rect, innerWidth, innerHeight), camera = this.cameras.get(view.element);
      if (!model || !clip || !camera) { this.options.onAnnotations?.(view, []); continue; }
      this.applyPose(model, view.mode);
      // Scroll frames with the same pose need no repeated vertex walks/raycasting.
      // Include the model generation, independent view pose and viewport dimensions.
      const key = `${this.revision}/${view.mode}/${view.mode === 'inspect' ? this.selectedInspection : this.selected}/${this.spreadOverride ?? chapterState(this.chapterProgress).spread}/${model.root.rotation.toArray().join(',')}/${rect.width}/${rect.height}`;
      if (view.mode !== 'hero' && this.fitKeys.get(view.element) !== key) {
        const id = view.mode === 'inspect' ? this.selectedInspection : this.selected;
        const part = model.parts.find(part => part.id === id);
        const bounds = new Box3().setFromObject(part?.node ?? model.root, true);
        if (part) fitCamera(camera, bounds.expandByScalar(Math.max(bounds.getSize(new Vector3()).length() * .08, .006)), rect.width, rect.height, { x: .87, y: .8 }, .01);
        else if (view.mode === 'inspect') {
          bounds.union(new Box3(new Vector3(-2.3, -1.104, -2.3), new Vector3(2.3, 1.104, 2.3)));
          fitCamera(camera, bounds.expandByScalar(.08), rect.width, rect.height, { x: .93, y: .9 });
        } else fitCamera(camera, bounds.expandByScalar(.25), rect.width, rect.height, { x: .91, y: .82 });
        this.fitKeys.set(view.element, key);
      }
      renderer.setViewport(rect.left, innerHeight - rect.bottom, rect.width, rect.height); renderer.setScissor(clip.x, clip.y, clip.width, clip.height); renderer.render(this.scene, camera); this.projectAnnotations(view, camera, model, key);
    }
    if (model) model.parts.forEach(part => { part.node.visible = true; });
    this.finale?.render(renderer);
  }

  async showExhibit(id: ExhibitId): Promise<void> {
    if (this.disposed) return;
    const request = ++this.revision; this.finale?.clearModel(); this.options.onState({ type: 'loading' });
    try {
      const record = this.options.records.find(record => record.id === id);
      if (!record || (id !== 'akm' && id !== 'mosin' && id !== 'ppsh' && id !== 'sks' && id !== 'pm')) throw new Error(`Exhibit not configured: ${id}`);
      this.exhibitId = id;
      const result = await this.assets.replace(async signal => {
        const model = await (this.options.loader ?? loadStaticReference)(record.modelUrl, signal);
        return id === 'mosin' ? prepareMosin(model) : id === 'ppsh' ? preparePPSh(model) : id === 'sks' ? prepareSKS(model) : id === 'pm' ? preparePM(model) : prepareReference(model);
      });
      if (!result || this.disposed || request !== this.revision || result !== this.assets.value) return;
      this.scene.add(result.root); this.finale?.setModel(result); this.resize(innerWidth, innerHeight); this.options.onState({ type: 'ready' }); this.surface?.request();
    } catch { if (!this.disposed && request === this.revision) this.options.onState({ type: 'error', message: 'Не удалось загрузить 3D-модель. Все карточки доступны ниже; можно повторить загрузку.' }); }
  }

  prepareFinale(): Promise<void> { return this.finale?.prepare() ?? Promise.resolve(); }
  setFinaleProgress(progress: number): void { this.finale?.setProgress(progress); }

  setProgress(progress: number): void { this.spreadOverride = spreadForProgress(progress); this.surface?.request(); }
  setChapterProgress(progress: number): void { this.spreadOverride = undefined; this.chapterProgress = clampProgress(progress); this.surface?.request(); }
  setHeroProgress(progress: number): void { if (!this.disposed) { this.heroProgress = clampProgress(progress); this.surface?.request(); } }
  selectReferencePart(id: string | undefined): void { this.selected = id; this.detailRotation = { yaw: 0, pitch: 0 }; this.surface?.request(); }
  setReferenceProgress(progress: number): void { this.setChapterProgress(progress); }
  setReferenceRotation(yaw: number, pitch: number): void { this.detailRotation = inspectorRotation(yaw, pitch); this.surface?.request(); }
  setInspectionSelection(id: string | undefined): void { this.selectedInspection = id; this.surface?.request(); }
  setInspectionRotation(yaw: number, pitch: number): void { this.inspection = inspectorRotation(yaw, pitch); this.surface?.request(); }

  resize(width: number, height: number): void {
    if (this.disposed || !this.surface || width <= 0 || height <= 0) return;
    this.surface.resize(); this.finale?.resize();
    const model = this.assets.value;
    if (this.options.views) for (const view of this.options.views) {
      const camera = this.cameras.get(view.element) ?? this.camera.clone(); this.cameras.set(view.element, camera);
      if (model && view.mode === 'hero') {
        const previous = this.heroProgress; this.heroProgress = 1; this.applyPose(model, 'hero'); this.heroProgress = previous;
        const rect = view.element.getBoundingClientRect(); fitCamera(camera, new Box3().setFromObject(model.root, true), rect.width, rect.height, { x: .95, y: .93 });
      }
    }
    else if (model) fitCamera(this.camera, model.bounds, width, height);
    this.surface?.request();
  }

  dispose(): void {
    if (this.disposed) return; this.disposed = true; this.revision++;
    window.removeEventListener('resize', this.onResize); this.finale?.dispose(); this.finale = undefined; this.assets.dispose(); this.cameras.clear(); this.fitKeys.clear(); this.pointCache.clear(); this.surface?.dispose(); this.surface = undefined;
  }
}
