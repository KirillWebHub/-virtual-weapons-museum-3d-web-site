import { Box3, DirectionalLight, HemisphereLight, OrthographicCamera, Scene, Vector3 } from 'three';
import type { Group, Mesh, Texture, WebGLRenderer } from 'three';
import type { PreparedModel } from '../exhibit/types';
import { disposeObject } from '../exhibit/model';
import { clipView } from '../exhibit/view';
import { cloneAssembled, releaseSharedClone } from './clone';
import { finaleRecords } from './data';
import { createBullet } from './bullet';
import { loadFinaleTarget } from './target';
import { flightPoint, cameraAnchor, alignmentError } from './math';
import { createFinaleTimeline } from './sequence';
import type { FinalePose } from './sequence';
import type { FinaleFrame, FinaleSceneOptions, FinaleState } from './types';

export type FinaleTargetLoader = (signal: AbortSignal) => ReturnType<typeof loadFinaleTarget>;
type FinaleOptions = FinaleSceneOptions & { targetLoader?: FinaleTargetLoader };
interface Shot { origin: Vector3; end: Vector3; scale: number; tipOffset: number; length: number; viewHeight: number; maxZoom: number; initialCamera: { x: number; y: number } }
const clamp = (p: number): number => Number.isFinite(p) ? Math.max(0, Math.min(1, p)) : 0;

/** A scissored view on the chapter's existing canvas; borrowed gun surfaces are never disposed here. */
export class FinaleScene {
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera(-5, 5, 2.5, -2.5, .01, 100);
  private readonly bullet: Group;
  private readonly pose = {} as FinalePose;
  private source: PreparedModel | undefined;
  private gun: Group | undefined;
  private muzzle = new Vector3();
  private target: Group | undefined;
  private impact = new Vector3();
  private shot: Shot | undefined;
  private timeline: ReturnType<typeof createFinaleTimeline> | undefined;
  private progress = 0;
  private layoutKey = '';
  private started = false;
  private disposed = false;
  private generation = 0;
  private abort: AbortController | undefined;
  private status: FinaleState = 'idle';
  private lastFrame: FinaleFrame | undefined;

  constructor(private readonly options: FinaleOptions, environment: Texture, private readonly request: () => void) {
    this.bullet = createBullet(finaleRecords[options.id].profile); this.scene.add(this.bullet);
    this.scene.environment = environment; this.scene.environmentIntensity = .7;
    const key = new DirectionalLight(0xe8e0d0, 2); key.position.set(-3, 5, 5);
    const fill = new DirectionalLight(0xc7ced6, 1); fill.position.set(4, 1, 4);
    const rim = new DirectionalLight(0xf1c589, 1); rim.position.set(1, 3, -3);
    this.scene.add(key, fill, rim, new HemisphereLight(0xe9e0c9, 0x171a16, 1.2));
  }

  setModel(source: PreparedModel): void {
    this.clearModel(); this.source = source;
    if (this.started) { this.cloneGun(); this.finish(); }
  }
  clearModel(): void {
    if (this.gun) releaseSharedClone(this.gun);
    this.gun = undefined; this.source = undefined; this.shot = undefined; this.layoutKey = '';
  }
  private cloneGun(): void {
    if (!this.source || this.gun) return;
    const model = cloneAssembled(this.source, this.options.id); this.gun = model.root; this.muzzle = model.muzzle; this.scene.add(model.root);
  }
  async prepare(): Promise<void> {
    if (this.disposed || this.status === 'loading') return;
    this.started = true; this.cloneGun();
    if (this.target) { this.finish(); return; }
    const generation = ++this.generation; this.abort?.abort(); const abort = new AbortController(); this.abort = abort;
    this.setState('loading');
    try {
      const asset = await (this.options.targetLoader ?? loadFinaleTarget)(abort.signal);
      if (this.disposed || abort.signal.aborted || generation !== this.generation) { disposeObject(asset.root); return; }
      this.target = asset.root; this.impact.copy(asset.impact); this.scene.add(asset.root); this.finish();
    } catch {
      if (!this.disposed && !abort.signal.aborted && generation === this.generation) { this.setState('error'); this.offscreen(); }
    }
  }
  private finish(): void {
    if (!this.gun || !this.target || this.disposed) return;
    this.layoutKey = ''; this.setState('ready'); this.request();
  }
  private setState(state: FinaleState): void { this.status = state; this.options.onState(state); }
  setProgress(value: number): void { this.progress = clamp(value); this.timeline?.progress(this.progress); this.request(); }
  resize(): void { this.layoutKey = ''; this.request(); }
  private gunPose(): void {
    if (!this.gun) return;
    this.gun.position.set(this.pose.gX, this.pose.gY, .15); this.gun.scale.setScalar(this.pose.gS);
    this.gun.rotation.set(.035, Math.PI, this.pose.gRoll); this.gun.updateMatrixWorld(true);
  }
  private targetPose(): void {
    if (!this.target) return;
    this.target.position.set(this.pose.tX, this.pose.tY, this.pose.tZ); this.target.scale.setScalar(this.pose.tS);
    this.target.rotation.set(this.pose.tPitch, -.5, 0); this.target.updateMatrixWorld(true);
  }
  private build(width: number, height: number, mobile: boolean): void {
    if (!this.gun || !this.target) return;
    this.timeline?.kill(); const isPM = this.options.id === 'pm', baseScale = isPM ? .73 : 1.18, aspect = width / height;
    Object.assign(this.pose, { gX: -2.1, gY: 0, gS: baseScale, gRoll: 0, tX: 0, tY: 0, tZ: 0, tS: 1, tPitch: 0, flight: 0, follow: 0, zoom: 1, camReset: 0, flash: 0, smoke: 0, mark: 0, waveAlpha: 0, waveScale: .2, paper: 0, copyAlpha: 1, flightAlpha: 0, trail: 0, stamp: 0, clock: 0 });
    this.gunPose(); this.pose.gY = this.impact.y - this.gun.localToWorld(this.muzzle.clone()).y; this.gunPose();
    const origin = this.gun.localToWorld(this.muzzle.clone()), end = new Vector3(origin.x + 8.5, origin.y, origin.z);
    const offset = this.impact.clone().applyAxisAngle(new Vector3(0, 1, 0), -.5);
    this.pose.tX = end.x - offset.x; this.pose.tY = end.y - offset.y; this.pose.tZ = end.z - offset.z; this.targetPose();
    const bulletBox = (this.bullet.userData['bounds'] as Box3).clone(), size = bulletBox.getSize(new Vector3()), scale = .32 / size.x;
    const bounds = this.visibleBounds(this.gun).union(this.visibleBounds(this.target)), frame = bounds.getSize(new Vector3()), center = bounds.getCenter(new Vector3());
    const viewHeight = mobile ? 5.7 : Math.max(5.2, frame.x * 1.12 / aspect, frame.y * 1.15), viewWidth = viewHeight * aspect;
    this.shot = { origin, end, scale, tipOffset: bulletBox.max.x * scale, length: size.x * scale, viewHeight, initialCamera: mobile ? cameraAnchor(origin, 1, .025, viewWidth) : { x: center.x, y: center.y }, maxZoom: Math.max(2, Math.min(24, viewWidth * (mobile ? .62 : .38) / (size.x * scale), viewHeight * .42 / (Math.max(size.y, size.z) * scale))) };
    // Fit each silhouette into the left side, letting only its tip cross the paper edge.
    const initialGun = { x: this.pose.gX, y: this.pose.gY, scale: this.pose.gS, roll: this.pose.gRoll };
    Object.assign(this.pose, { gX: 0, gY: 0, gS: 1, gRoll: .025 }); this.gunPose();
    const finalBounds = this.visibleBounds(this.gun), finalSize = finalBounds.getSize(new Vector3()), finalCenter = finalBounds.getCenter(new Vector3());
    const finalWidth = 5 * aspect, finalScale = Math.min(isPM ? .88 : 1.36, finalWidth * .54 / finalSize.x, 5 * .62 / finalSize.y);
    const finalGun = { x: -finalWidth * .20 - finalCenter.x * finalScale, y: -.05 - finalCenter.y * finalScale, scale: finalScale };
    Object.assign(this.pose, { gX: initialGun.x, gY: initialGun.y, gS: initialGun.scale, gRoll: initialGun.roll });
    this.timeline = createFinaleTimeline(this.pose, { mobile, isPM, finalGun, maxZoom: this.shot.maxZoom, reduced: this.options.reducedMotion() }, this.request); this.timeline.progress(this.progress);
  }
  private visibleBounds(root: Group): Box3 {
    const bounds = new Box3(); root.updateMatrixWorld(true);
    root.traverse(node => {
      if (!(node as Mesh).isMesh) return;
      for (let p = node; p && p !== root; p = p.parent!) if (!p.visible) return;
      const mesh = node as Mesh; if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      bounds.union(mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld));
    }); return bounds;
  }
  private project(point: Vector3, width: number, height: number): { x: number; y: number } {
    const p = point.clone().project(this.camera); return { x: (p.x + 1) * width / 2, y: (1 - p.y) * height / 2 };
  }
  private offscreen(): void {
    if (this.lastFrame) this.options.onFrame({ ...this.lastFrame, visible: false, front: false });
  }
  render(renderer: WebGLRenderer): void {
    const rect = this.options.element.getBoundingClientRect(), clip = clipView(rect, innerWidth, innerHeight);
    if (this.disposed || this.status !== 'ready' || !this.gun || !this.target || !clip) { this.offscreen(); return; }
    const mobile = innerWidth <= 900, reduced = this.options.reducedMotion(), key = `${rect.width}/${rect.height}/${mobile}/${reduced}`;
    if (key !== this.layoutKey) { this.layoutKey = key; this.build(rect.width, rect.height, mobile); }
    if (!this.shot) return;
    const p = this.pose, shot = this.shot, viewHeight = shot.viewHeight + (5 - shot.viewHeight) * p.camReset, viewWidth = viewHeight * rect.width / rect.height, zoom = p.zoom + (1 - p.zoom) * p.camReset;
    const nose = flightPoint(shot.origin, 8.5, p.flight), anchor = cameraAnchor(nose, zoom, mobile ? .68 : .42, viewWidth);
    const cx = (shot.initialCamera.x + (anchor.x - shot.initialCamera.x) * p.follow) * (1 - p.camReset), cy = (shot.initialCamera.y + (anchor.y - shot.initialCamera.y) * p.follow) * (1 - p.camReset);
    const camera = this.camera; camera.left = -viewWidth / 2; camera.right = viewWidth / 2; camera.top = viewHeight / 2; camera.bottom = -viewHeight / 2; camera.zoom = zoom; camera.position.set(cx, cy, 15); camera.lookAt(cx, cy, 0); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    this.gunPose(); this.targetPose();
    this.gun.visible = !mobile && (reduced || this.progress < .735 || this.progress > .80); this.target.visible = this.progress < .80 && !reduced;
    this.bullet.position.set(nose.x - shot.tipOffset, nose.y, nose.z); this.bullet.scale.setScalar(shot.scale); this.bullet.rotation.set(p.flight * 9, 0, 0); this.bullet.visible = this.progress >= .11 && this.progress < .69 && !reduced;
    const target = this.target.localToWorld(this.impact.clone()), tip = this.project(new Vector3(nose.x, nose.y, nose.z), rect.width, rect.height), impact = this.project(target, rect.width, rect.height);
    const frame: FinaleFrame = { progress: this.progress, visible: true, mobile, front: this.progress > .80 && !mobile && !reduced, paper: p.paper, stamp: p.stamp, intro: p.copyAlpha, flightCaption: p.flightAlpha, flash: p.flash, smoke: p.smoke, trail: p.trail, wave: p.waveAlpha, waveScale: p.waveScale, mark: p.mark, impact, muzzle: this.project(shot.origin, rect.width, rect.height), tip, bodyPixels: shot.length * zoom / viewWidth * rect.width, flight: p.flight, nose, origin: { x: shot.origin.x, y: shot.origin.y, z: shot.origin.z }, target: { x: target.x, y: target.y, z: target.z }, bulletScale: shot.scale, weaponVisible: this.gun.visible, bulletVisible: this.bullet.visible, lateralError: alignmentError(nose, shot.origin), impactError: Math.hypot(tip.x - impact.x, tip.y - impact.y) };
    this.lastFrame = frame; this.options.onFrame(frame);
    Object.assign(this.options.element.dataset, { noseX: nose.x.toFixed(6), noseY: nose.y.toFixed(6), noseZ: nose.z.toFixed(6), bulletScale: shot.scale.toFixed(6), lateralError: frame.lateralError.toFixed(8), targetWorldX: target.x.toFixed(6), targetWorldY: target.y.toFixed(6), targetWorldZ: target.z.toFixed(6), impactError: this.progress >= .69 && this.progress < .702 ? frame.impactError.toFixed(6) : '', weaponVisible: String(this.gun.visible), bulletVisible: String(this.bullet.visible), cameraZoom: zoom.toFixed(4) });
    renderer.setViewport(rect.left, innerHeight - rect.bottom, rect.width, rect.height); renderer.setScissor(clip.x, clip.y, clip.width, clip.height); renderer.clearDepth(); renderer.render(this.scene, camera);
  }
  dispose(): void {
    if (this.disposed) return; this.disposed = true; this.generation++; this.abort?.abort(); this.timeline?.kill(); this.offscreen();
    this.clearModel(); if (this.target) disposeObject(this.target); disposeObject(this.bullet); this.target = undefined; this.scene.clear();
  }
}
