/** Owns each result, including late results from loaders that cannot finish aborting. */
export class LatestAsset<T> {
  private revision = 0;
  private controller: AbortController | undefined;
  private current: T | undefined;
  private disposed = false;
  private readonly release: (asset: T) => void;

  constructor(release: (asset: T) => void) { this.release = release; }
  get value(): T | undefined { return this.current; }

  clear(): void {
    this.revision++;
    this.controller?.abort();
    this.controller = undefined;
    if (this.current !== undefined) this.release(this.current);
    this.current = undefined;
  }

  async replace(load: (signal: AbortSignal) => Promise<T>): Promise<T | undefined> {
    if (this.disposed) return undefined;
    this.clear();
    const revision = this.revision;
    const controller = new AbortController();
    this.controller = controller;
    let asset: T;
    try { asset = await load(controller.signal); }
    catch (error) {
      if (this.disposed || revision !== this.revision || controller.signal.aborted) return undefined;
      this.controller = undefined;
      throw error;
    }
    if (this.disposed || revision !== this.revision || controller.signal.aborted) {
      this.release(asset);
      return undefined;
    }
    this.controller = undefined;
    this.current = asset;
    return asset;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clear();
  }
}

export interface FrameClock {
  request(callback: FrameRequestCallback): number;
  cancel(id: number): void;
}

/** At most one pending frame; idle scenes have no continuous animation loop. */
export class RenderQueue {
  private frame: number | undefined;
  private paused = false;
  private disposed = false;
  private readonly render: () => void;
  private readonly clock: FrameClock;

  constructor(render: () => void, clock: FrameClock) { this.render = render; this.clock = clock; }
  request(): void {
    if (this.paused || this.disposed || this.frame !== undefined) return;
    this.frame = this.clock.request(() => {
      this.frame = undefined;
      if (!this.paused && !this.disposed) this.render();
    });
  }
  pause(): void {
    this.paused = true;
    if (this.frame !== undefined) this.clock.cancel(this.frame);
    this.frame = undefined;
  }
  resume(): void { if (!this.disposed) { this.paused = false; this.request(); } }
  dispose(): void { this.pause(); this.disposed = true; }
}
