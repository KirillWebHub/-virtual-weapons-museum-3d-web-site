import { projectInfo } from '../content/author';
import type { HeroSceneController } from './ShowcaseScene';
import type { ExhibitSceneState } from '../exhibit/types';
import type { SceneView } from '../exhibit/view';
import './hero.css';
import { createCoin } from './Coin';

export function createHero(options: { onRetry(): void; onRetryCoin(): void; reducedMotion?: boolean }): {
  element: HTMLElement; view: SceneView; coin: ReturnType<typeof createCoin>;
  connectScene(scene: HeroSceneController | undefined): void;
  setState(state: ExhibitSceneState | { type: 'closed' }): void;
  dispose(): void;
} {
  const element = document.createElement('section'); element.className = 'hero'; element.id = 'hero';
  element.setAttribute('aria-labelledby', 'museum-title');
  element.innerHTML = `<div class="hero-diagonal" aria-hidden="true"></div>
    <h1 class="hero-title" id="museum-title"><span>Виртуальный</span> <span>музей</span></h1>
    <div class="hero-visual" role="img" aria-label="Пять музейных витрин с силуэтами Мосина, ППШ-41, СКС, ПМ и АКМ"></div>
    <p class="hero-track"><span>ТРЕК 03</span>Безопасное обращение<br>с оружием</p>
    <p class="hero-author"><span>Автор</span><span class="hero-author-name"></span></p>
    <a class="hero-arrow" href="#tour-start" aria-label="Начать экскурсию"><svg viewBox="0 0 28 56" fill="none" width="22" height="44" aria-hidden="true"><path d="M14 1v51M3 41l11 11 11-11" stroke="currentColor" stroke-width="1.8"/></svg></a>
    <div class="hero-status" role="status"><p>Загружаем экспозицию…</p><button type="button" hidden>Повторить 3D</button></div>`;
  const coin = createCoin({ onRetry: options.onRetryCoin, ...(options.reducedMotion !== undefined ? { reducedMotion: options.reducedMotion } : {}) }); element.append(coin.element);
  const visual = element.querySelector<HTMLElement>('.hero-visual')!;
  const status = element.querySelector<HTMLElement>('.hero-status')!;
  const statusText = status.querySelector('p')!;
  const retry = status.querySelector('button')!;
  const arrow = element.querySelector<HTMLAnchorElement>('.hero-arrow')!;
  element.querySelector('.hero-author-name')!.textContent = projectInfo.author.fullName;
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = (): boolean => options.reducedMotion ?? media.matches;
  let scene: HeroSceneController | undefined, tween: { kill(): unknown } | undefined;
  let generation = 0, disposed = false;
  function stopIntro(): void { generation++; tween?.kill(); tween = undefined; }
  function syncMotion(): void {
    element.classList.toggle('is-reduced', reduced()); stopIntro(); scene?.setHeroProgress(1); scene?.setHeroPointer?.(0, 0); element.dataset['intro'] = 'static';
  }
  function startIntro(): void {
    stopIntro(); const own = generation, current = scene;
    const rect = element.getBoundingClientRect();
    if (!current || reduced() || rect.bottom <= 0 || rect.top >= innerHeight) { current?.setHeroProgress(1); element.dataset['intro'] = 'static'; return; }
    current.setHeroProgress(0); element.dataset['intro'] = 'playing';
    void import('gsap').then(({ gsap }) => {
      if (disposed || own !== generation || current !== scene) return;
      const pose = { value: 0 };
      tween = gsap.to(pose, { value: 1, duration: 1.6, ease: 'power2.out',
        onUpdate() { current.setHeroProgress(pose.value); },
        onComplete() { element.dataset['intro'] = 'done'; },
      });
    }).catch(() => { if (!disposed && own === generation && current === scene) { current.setHeroProgress(1); element.dataset['intro'] = 'static'; } });
  }
  const onArrow = (event: MouseEvent): void => {
    const target = document.getElementById('tour-start'); if (!target) return;
    event.preventDefault();
    target.focus({ preventScroll: true }); target.scrollIntoView({ behavior: 'instant', block: 'start' });
    history.replaceState(null, '', '#tour-start');
  };
  const onRetry = (): void => options.onRetry();
  const onPointer = (event: PointerEvent): void => { if (reduced() || event.pointerType === 'touch' || (event.target as HTMLElement).closest('.hero-coin')) return; const rect = element.getBoundingClientRect(); scene?.setHeroPointer?.((event.clientX - rect.left) / rect.width * 2 - 1, (event.clientY - rect.top) / rect.height * 2 - 1); };
  const onLeave = (): void => scene?.setHeroPointer?.(0, 0);
  arrow.addEventListener('click', onArrow); retry.addEventListener('click', onRetry); media.addEventListener('change', syncMotion); element.addEventListener('pointermove', onPointer); element.addEventListener('pointerleave', onLeave);
  syncMotion();
  return {
    element, view: { element: visual, mode: 'hero' }, coin,
    connectScene(next) { stopIntro(); scene = next; scene?.setHeroProgress(reduced() ? 1 : 0); },
    setState(state) {
      element.dataset['state'] = state.type;
      visual.setAttribute('aria-hidden', String(state.type !== 'ready'));
      status.hidden = state.type === 'ready'; retry.hidden = state.type === 'loading';
      if (state.type === 'loading') statusText.textContent = 'Загружаем экспозицию…';
      if (state.type === 'error') { stopIntro(); statusText.textContent = 'Не удалось показать музейную композицию.'; retry.textContent = 'Повторить 3D'; }
      if (state.type === 'closed') { stopIntro(); statusText.textContent = '3D-просмотр скрыт.'; retry.textContent = 'Показать 3D'; }
      if (state.type === 'ready') startIntro();
    },
    dispose() { if (disposed) return; disposed = true; stopIntro(); coin.dispose(); scene = undefined; arrow.removeEventListener('click', onArrow); retry.removeEventListener('click', onRetry); media.removeEventListener('change', syncMotion); element.removeEventListener('pointermove', onPointer); element.removeEventListener('pointerleave', onLeave); },
  };
}
