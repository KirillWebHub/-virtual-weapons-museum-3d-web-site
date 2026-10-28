import { ACESFilmicToneMapping, PMREMGenerator, WebGLRenderer } from 'three';
import type { Texture, WebGLRenderTarget } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RenderQueue } from './lifecycle';

interface Subscriber { draw(renderer: WebGLRenderer): void; lost(): void }
export interface SurfaceLease { readonly environment: Texture; request(): void; resize(): void; dispose(): void }
export interface SurfaceSample { event: 'frame' | 'dispose'; id: number; at: number; milliseconds: number; geometries: number; textures: number; programs: number; calls: number; triangles: number; subscribers: number }
const observers = new Set<(sample: SurfaceSample) => void>();
let surfaceId = 0;
/** Opt-in diagnostics used by the local QA fixture; no telemetry leaves the page. */
export function observeSurfaces(observer: (sample: SurfaceSample) => void): () => void { observers.add(observer); return () => { observers.delete(observer); }; }
const surfaces = new WeakMap<HTMLElement, RenderSurface>();

/** Chapters share one canvas, environment and frame queue; assets remain independently owned. */
class RenderSurface {
  readonly renderer: WebGLRenderer;
  private readonly environment: WebGLRenderTarget;
  private readonly queue: RenderQueue;
  private readonly subscribers = new Set<Subscriber>();
  private dimensions = '';
  lost = false;
  private readonly id = ++surfaceId;

  constructor(private readonly host: HTMLElement) {
    const canvas = document.createElement('canvas'), context = canvas.getContext('webgl2', { alpha: true, antialias: true });
    if (!context) throw new Error('WebGL 2 unavailable');
    this.renderer = new WebGLRenderer({ canvas, context, alpha: true, antialias: true });
    try {
      this.renderer.setClearColor(0, 0); this.renderer.toneMapping = ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1; this.renderer.autoClear = false; this.renderer.info.autoReset = false;
      const pmrem = new PMREMGenerator(this.renderer), room = new RoomEnvironment();
      try { this.environment = pmrem.fromScene(room, .12); } finally { room.dispose(); pmrem.dispose(); }
    } catch (error) { this.renderer.dispose(); this.renderer.forceContextLoss(); throw error; }
    host.append(canvas);
    this.queue = new RenderQueue(() => {
      if (this.lost) return;
      const started = performance.now(); this.renderer.info.reset();
      this.renderer.setScissorTest(false); this.renderer.setViewport(0, 0, innerWidth, innerHeight); this.renderer.clear(); this.renderer.setScissorTest(true);
      for (const subscriber of this.subscribers) subscriber.draw(this.renderer);
      this.renderer.setScissorTest(false);
      this.sample('frame', performance.now() - started);
    }, { request: callback => requestAnimationFrame(callback), cancel: id => cancelAnimationFrame(id) });
    canvas.addEventListener('webglcontextlost', this.onLost); window.addEventListener('scroll', this.onScroll, { passive: true }); window.addEventListener('resize', this.onResize); document.addEventListener('visibilitychange', this.onVisibility);
    this.resize(); this.onVisibility();
  }
  private sample(event: SurfaceSample['event'], milliseconds = 0): void {
    if (!observers.size) return;
    const info = this.renderer.info;
    const sample: SurfaceSample = { event, id: this.id, at: performance.now(), milliseconds, geometries: info.memory.geometries, textures: info.memory.textures, programs: info.programs?.length ?? 0, calls: info.render.calls, triangles: info.render.triangles, subscribers: this.subscribers.size };
    observers.forEach(observer => observer(sample));
  }
  private readonly onScroll = (): void => this.queue.request();
  private readonly onResize = (): void => { this.resize(); this.queue.request(); };
  private readonly onVisibility = (): void => {
    if (document.hidden || this.lost) { this.queue.pause(); this.host.dataset['renderState'] = 'paused'; }
    else { this.queue.resume(); this.host.dataset['renderState'] = 'active'; }
  };
  private readonly onLost = (event: Event): void => { event.preventDefault(); this.lost = true; this.onVisibility(); for (const s of [...this.subscribers]) s.lost(); };
  resize(): void {
    const ratio = Math.min(devicePixelRatio, 1.75), dimensions = `${innerWidth}/${innerHeight}/${ratio}`;
    if (dimensions === this.dimensions) return; this.dimensions = dimensions;
    this.renderer.setPixelRatio(ratio); this.renderer.setSize(innerWidth, innerHeight, false);
  }
  subscribe(subscriber: Subscriber): SurfaceLease {
    this.subscribers.add(subscriber); this.host.dataset['sceneCount'] = String(this.subscribers.size); let released = false;
    return { environment: this.environment.texture, request: () => this.queue.request(), resize: () => this.resize(), dispose: () => {
      if (released) return; released = true; this.subscribers.delete(subscriber); this.host.dataset['sceneCount'] = String(this.subscribers.size);
      if (this.subscribers.size) { this.queue.request(); return; }
      if (surfaces.get(this.host) === this) surfaces.delete(this.host);
      this.queue.dispose(); window.removeEventListener('scroll', this.onScroll); window.removeEventListener('resize', this.onResize); document.removeEventListener('visibilitychange', this.onVisibility);
      this.renderer.domElement.removeEventListener('webglcontextlost', this.onLost); this.environment.dispose(); this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove(); this.sample('dispose');
      if (!surfaces.has(this.host)) { delete this.host.dataset['sceneCount']; delete this.host.dataset['renderState']; }
    } };
  }
}

export function acquireSurface(host: HTMLElement, subscriber: Subscriber): SurfaceLease {
  let surface = surfaces.get(host);
  if (!surface || surface.lost) { surface = new RenderSurface(host); surfaces.set(host, surface); }
  return surface.subscribe(subscriber);
}
