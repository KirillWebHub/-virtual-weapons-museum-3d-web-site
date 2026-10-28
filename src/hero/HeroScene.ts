import type { ShowcaseScene, ShowcaseFactory, ShowcaseOptions } from './ShowcaseScene';
import type { createHero } from './Hero';
import { connectCoinScene } from './connectCoinScene';
import type { CoinFactory } from './CoinScene';
/** The cover owns only its illustration; no hidden exhibit chapter is mounted. */
export function connectHeroScene(host: HTMLElement, hero: ReturnType<typeof createHero>,
  createScene?: ShowcaseFactory, createCoinScene?: CoinFactory,
): { reload(): void; reloadCoin(): void; dispose(): void } {
  const coin = connectCoinScene(host, hero.coin, createCoinScene);
  let scene: ShowcaseScene | undefined, disposed = false, revision = 0, started = false;
  async function mount(): Promise<void> {
    const own = ++revision; scene?.dispose(); scene = undefined; hero.connectScene(undefined); hero.setState({ type: 'loading' });
    try {
      const [module] = await Promise.all([import('./ShowcaseScene'), document.fonts.ready]);
      if (disposed || own !== revision) return;
      const options: ShowcaseOptions = { view: hero.view.element, onState(state) { if (!disposed && own === revision) { hero.setState(state); if (state.type === 'ready') coin.permit(); } } };
      scene = createScene ? createScene(host, options) : new module.ShowcaseScene(host, options);
      hero.connectScene(scene); await scene.show();
    } catch { if (!disposed && own === revision) hero.setState({ type: 'error', message: 'Не удалось показать экспонат.' }); }
  }
  const observer = new IntersectionObserver(entries => {
    if (!started && entries.some(entry => entry.isIntersecting)) { started = true; observer.disconnect(); void mount(); }
  }, { rootMargin: '200px' }); observer.observe(hero.view.element);
  const resize = new ResizeObserver(() => scene?.resize()); resize.observe(hero.view.element);
  return { reload() { if (!disposed) { started = true; observer.disconnect(); void mount(); } }, reloadCoin() { coin.reload(); }, dispose() {
    if (disposed) return; disposed = true; revision++; coin.dispose(); observer.disconnect(); resize.disconnect(); hero.connectScene(undefined); scene?.dispose(); scene = undefined;
  } };
}
