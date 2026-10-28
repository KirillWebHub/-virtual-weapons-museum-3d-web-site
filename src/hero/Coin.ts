import { bindInspection } from '../exhibit/inspection';
import type { ExhibitSceneState } from '../exhibit/types';
import type { CoinController } from './CoinScene';

export function createCoin(options: { onRetry(): void; reducedMotion?: boolean }): {
  element: HTMLElement; view: HTMLElement; connect(scene: CoinController | undefined): void;
  setState(state: ExhibitSceneState): void; dispose(): void;
} {
  const element = document.createElement('figure'); element.className = 'hero-coin'; element.dataset['state'] = 'idle';
  element.innerHTML = `<div class="coin-visual" role="button" tabindex="-1" aria-disabled="true" aria-pressed="false" aria-label="Монета СССР 1946 года. Нажмите, чтобы перевернуть" aria-describedby="coin-help"><span class="coin-placeholder" aria-hidden="true">1946</span></div><figcaption><span>СССР / 1946</span><button type="button" class="coin-flip" aria-label="Перевернуть монету" disabled>↻</button></figcaption><span id="coin-help" class="coin-help">Перетаскивайте монету или вращайте стрелками. Нажатие переворачивает, Home возвращает исходный ракурс.</span><span class="coin-status" role="status">Монета загрузится после витрин.</span>`;
  const view = element.querySelector<HTMLElement>('.coin-visual')!, flipButton = element.querySelector<HTMLButtonElement>('button')!, status = element.querySelector<HTMLElement>('.coin-status')!;
  let scene: CoinController | undefined, ready = false, animated = false, yaw = 0, pitch = 0, start = { x: 0, y: 0 }, moved = false;
  const media = matchMedia('(prefers-reduced-motion: reduce)'), reduced = (): boolean => options.reducedMotion ?? media.matches;
  const inspection = bindInspection(view, (y, p) => { yaw = y; pitch = p; scene?.setRotation(y, p, animated && !reduced()); view.setAttribute('aria-pressed', String(Math.cos(y) < 0)); });
  inspection.setTouch(true);
  const syncMotion = (): void => scene?.setReducedMotion(reduced());
  const flip = (): void => { if (!ready) return; animated = true; inspection.rotateBy(Math.PI, 0); animated = false; };
  const onButton = (): void => { if (ready) flip(); else options.onRetry(); };
  const onDown = (event: PointerEvent): void => { start = { x: event.clientX, y: event.clientY }; moved = false; };
  const onMove = (event: PointerEvent): void => { if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) moved = true; };
  const onClick = (): void => { if (!moved) flip(); };
  const onKey = (event: KeyboardEvent): void => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); flip(); } };
  view.addEventListener('pointerdown', onDown); view.addEventListener('pointermove', onMove); view.addEventListener('click', onClick); view.addEventListener('keydown', onKey); flipButton.addEventListener('click', onButton); media.addEventListener('change', syncMotion);
  return {
    element, view,
    connect(next) { scene = next; syncMotion(); scene?.setRotation(yaw, pitch); },
    setState(state) {
      ready = state.type === 'ready'; element.dataset['state'] = state.type; view.tabIndex = ready ? 0 : -1; view.setAttribute('aria-disabled', String(!ready));
      flipButton.disabled = state.type === 'loading'; flipButton.setAttribute('aria-label', ready ? 'Перевернуть монету' : 'Повторить загрузку монеты');
      status.textContent = ready ? '' : state.type === 'loading' ? 'Загружаем монету…' : 'Монета недоступна. Можно повторить загрузку.';
      scene?.setRotation(yaw, pitch);
    },
    dispose() { inspection.dispose(); scene = undefined; view.removeEventListener('pointerdown', onDown); view.removeEventListener('pointermove', onMove); view.removeEventListener('click', onClick); view.removeEventListener('keydown', onKey); flipButton.removeEventListener('click', onButton); media.removeEventListener('change', syncMotion); },
  };
}
