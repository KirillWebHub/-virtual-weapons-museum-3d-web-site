import type { createCoin } from './Coin';
import type { CoinFactory, CoinScene } from './CoinScene';

/** Wait for both the main composition and a nearby coin viewport. */
export function connectCoinScene(host: HTMLElement, coin: ReturnType<typeof createCoin>, factory?: CoinFactory): {
  permit(): void; reload(): void; dispose(): void;
} {
  let scene: CoinScene | undefined, disposed = false, revision = 0, allowed = false, visible = false, started = false;
  async function mount(): Promise<void> {
    const own = ++revision; scene?.dispose(); scene = undefined; coin.connect(undefined); coin.setState({ type: 'loading' });
    try {
      const module = await import('./CoinScene'); if (disposed || own !== revision) return;
      const options = { view: coin.view, onState(state: Parameters<typeof coin.setState>[0]) { if (!disposed && own === revision) coin.setState(state); } };
      scene = factory ? factory(host, options) : new module.CoinScene(host, options); coin.connect(scene); await scene.show();
    } catch { if (!disposed && own === revision) coin.setState({ type: 'error', message: 'Coin unavailable' }); }
  }
  const maybeStart = (): void => { if (!disposed && allowed && visible && !started) { started = true; observer.disconnect(); void mount(); } };
  const observer = new IntersectionObserver(entries => { visible = entries.some(entry => entry.isIntersecting); maybeStart(); }, { rootMargin: '150px' }); observer.observe(coin.view);
  const resize = new ResizeObserver(() => scene?.resize()); resize.observe(coin.view);
  return {
    permit() { allowed = true; maybeStart(); },
    reload() { if (!disposed) { allowed = started = true; observer.disconnect(); void mount(); } },
    dispose() { if (disposed) return; disposed = true; revision++; observer.disconnect(); resize.disconnect(); coin.connect(undefined); scene?.dispose(); scene = undefined; },
  };
}
