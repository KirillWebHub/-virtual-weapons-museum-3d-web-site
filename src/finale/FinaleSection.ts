import type { ExhibitRecord } from '../content/types';
import { EXHIBIT_IDS } from '../content/types';
import { collectionHref, exhibitHref } from '../navigation/pages';
import type { FinaleSection, FinaleSectionOptions, FinaleState } from './types';
import './finale.css';

const titles = { mosin: 'Винтовка Мосина', ppsh: 'ППШ-41', sks: 'СКС', pm: 'Пистолет Макарова', akm: 'АКМ' } as const;
const ammo = { mosin: '7,62×54R', ppsh: '7,62×25 ТТ', sks: '7,62×39', pm: '9×18 ПМ', akm: '7,62×39' } as const;
const ammoSources = {
  mosin: 'https://museumkchr.ru/exhibits/229-vintovka-mosina-obrazca-1891-goda.html',
  ppsh: 'https://ar.culture.ru/en/subject/pistolet-pulemet',
  sks: 'https://victorymuseum.ru/about/museum-collection/armament/7-62-mm-samozaryadnyy-karabin-simonova-sks/',
  pm: 'https://heroes.museum-arms.ru/pm.html',
  akm: 'https://mgssk.ru/dlinnostvolnoe/',
} as const;

/** One chapter ending. The shared Three.js surface is owned by the parent scene. */
export function createFinaleSection(record: ExhibitRecord, options: FinaleSectionOptions): FinaleSection {
  const index = EXHIBIT_IDS.indexOf(record.id), number = String(index + 1).padStart(2, '0'), next = EXHIBIT_IDS[index + 1];
  const title = record.title.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
  const element = document.createElement('section');
  element.id = `${record.id}-finale`; element.className = 'finale-section'; element.dataset['state'] = 'idle';
  element.setAttribute('aria-labelledby', `${record.id}-finale-title`);
  element.innerHTML = `<div class="finale-scroll"><div class="finale-stage">
    <div class="finale-artboard">
      <div class="finale-visual" role="img" aria-label="Музейная отметка: ${title}, полёт пули и мишень"></div>
      <div class="finale-atmosphere" aria-hidden="true">${Array.from({ length: 10 }, () => '<i></i>').join('')}</div>
      <header class="finale-intro"><p class="finale-eyebrow">Экспонат ${number} / ${title}</p><h2 id="${record.id}-finale-title">Последний<br>штрих.</h2><p>Вы познакомились с экспонатом.<br>Остаётся музейная отметка.</p></header>
      <div class="finale-flight-caption" aria-hidden="true"><p class="finale-eyebrow">В центре внимания</p><p class="finale-flight-title">Пуля.</p><p>Для патрона ${ammo[record.id]}</p></div>
      <div class="finale-trail" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="finale-hit" aria-hidden="true"><i class="finale-mark"></i><i class="finale-wave"></i></div>
      <div class="finale-flash" aria-hidden="true"><i class="finale-flash-core"></i><div class="finale-smoke"><i></i><i></i><i></i></div></div>
      <article class="finale-paper" aria-hidden="true" inert>
        <div class="finale-ornament" aria-hidden="true"><i></i><i></i><i></i></div>
        <div class="finale-copy"><p class="finale-card-kicker">${title} / глава завершена</p><h2>История<br>продолжается.</h2><i class="finale-card-rule" aria-hidden="true"></i><p>Вы познакомились с историей, внешним обликом и терминологией экспоната. Продолжите экскурсию или вернитесь к коллекции.</p><nav class="finale-links" aria-label="Продолжить после ${title}"><a class="finale-next" href="${next ? exhibitHref(next) : './#museum-education'}">${next ? `Далее: ${titles[next]}` : 'Итоги экскурсии'} ↗</a><a href="${collectionHref}">К экспозиции ↗</a></nav></div>
        <div class="finale-stamp" aria-hidden="true"><span>Музейная коллекция</span><strong>Рассмотрено</strong><span>Экспонат / ${number}</span></div>
      </article>
    </div>
    <div class="finale-controls"><div class="finale-control-row"><p class="finale-phase" aria-live="polite">Музейная отметка</p><button type="button" class="finale-repeat">Повторить ↺</button><button type="button" class="finale-skip">К итогу ↓</button><button type="button" class="finale-retry" hidden>Повторить загрузку</button></div>
      <div class="finale-manual" role="group" aria-label="Состояния музейной отметки"><button type="button" data-finale-progress="0" aria-pressed="true">01 Начало</button><button type="button" data-finale-progress=".36" aria-pressed="false">02 Полёт</button><button type="button" data-finale-progress=".69" aria-pressed="false">03 Попадание</button><button type="button" data-finale-progress="1" aria-pressed="false">04 Итог</button></div>
      <div class="finale-progress" aria-hidden="true"><i></i></div><p class="finale-hint">Листайте вниз. Обратная прокрутка возвращает сцену.</p><p class="finale-status" role="status" hidden></p>
    </div>
  </div></div>
  <details class="finale-sources"><summary>Об этой иллюстрации</summary><p>Художественное завершение главы. В полёте показана пуля отдельно от гильзы; её внешний вид стилизован, размеры и баллистика не воспроизводятся. <a href="${ammoSources[record.id]}">Источник обозначения ${ammo[record.id]} ↗</a>. У АКМ и СКС общий тип патрона.</p><p>Мишень: <a href="https://sketchfab.com/3d-models/shooting-range-target-bdc995c9e3c8494fbffb7f5758a8567a">AJ — Shooting Range Target</a> · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. Исходный GLB сохранён; изменены масштаб, ракурс, освещение и движение представления. Авторы модели оружия указаны в источниках главы.</p></details>`;
  const get = <T extends HTMLElement>(selector: string): T => element.querySelector<T>(selector)!;
  const visual = get<HTMLElement>('.finale-visual'), scroll = get<HTMLElement>('.finale-scroll'), stage = get<HTMLElement>('.finale-stage');
  const intro = get<HTMLElement>('.finale-intro'), flight = get<HTMLElement>('.finale-flight-caption'), paper = get<HTMLElement>('.finale-paper');
  const flash = get<HTMLElement>('.finale-flash'), core = get<HTMLElement>('.finale-flash-core'), smoke = get<HTMLElement>('.finale-smoke');
  const hit = get<HTMLElement>('.finale-hit'), mark = get<HTMLElement>('.finale-mark'), wave = get<HTMLElement>('.finale-wave'), trail = get<HTMLElement>('.finale-trail');
  const atmosphere = get<HTMLElement>('.finale-atmosphere'), streaks = [...atmosphere.children] as HTMLElement[], stamp = get<HTMLElement>('.finale-stamp');
  const phase = get<HTMLElement>('.finale-phase'), bar = get<HTMLElement>('.finale-progress i'), hint = get<HTMLElement>('.finale-hint'), status = get<HTMLElement>('.finale-status');
  const repeat = get<HTMLButtonElement>('.finale-repeat'), skip = get<HTMLButtonElement>('.finale-skip'), retry = get<HTMLButtonElement>('.finale-retry');
  const manualButtons = [...element.querySelectorAll<HTMLButtonElement>('[data-finale-progress]')];
  const motion = matchMedia('(prefers-reduced-motion: reduce)'), short = matchMedia('(max-height:799px)');
  const reduced = (): boolean => options.reducedMotion ?? motion.matches;
  let state: FinaleState = 'idle', progress = 0, disposed = false, activated = false, near = false, front = false, bindRevision = 0;
  let unbind: (() => void) | undefined;
  const fallback = (): boolean => reduced() || state === 'closed' || state === 'error';
  const layer = (value: boolean): void => { if (front === value) return; front = value; options.onLayer(value); };
  const reveal = (value: boolean): void => { paper.setAttribute('aria-hidden', String(!value)); paper.inert = !value; };
  const setPhase = (value: number): void => {
    const label = value < .11 ? 'Перед выстрелом' : value < .25 ? 'Выстрел' : value < .64 ? 'Полёт пули' : value < .76 ? 'Попадание' : 'Музейная отметка';
    if (phase.textContent !== label) phase.textContent = label;
    bar.style.transform = `scaleX(${value})`;
    manualButtons.forEach(button => { const selected = value < .25 ? 0 : value < .64 ? .36 : value < .76 ? .69 : 1; button.setAttribute('aria-pressed', String(Number(button.dataset['finaleProgress']) === selected)); });
  };
  function readableFinale(): void {
    layer(false); progress = 1; element.dataset['progress'] = '1.000';
    intro.style.opacity = '0'; intro.setAttribute('aria-hidden', 'true'); flight.style.opacity = '0'; flight.setAttribute('aria-hidden', 'true');
    paper.style.clipPath = 'inset(0)'; reveal(true); stamp.style.opacity = '1';
    core.style.opacity = smoke.style.opacity = mark.style.opacity = wave.style.opacity = trail.style.opacity = atmosphere.style.opacity = '0';
    setPhase(1);
  }
  function resetFallbackPresentation(): void {
    layer(false); progress = 0; element.dataset['progress'] = '0.000';
    element.dataset['weaponVisible'] = element.dataset['bulletVisible'] = 'false';
    intro.style.opacity = '1'; intro.setAttribute('aria-hidden', 'false');
    flight.style.opacity = '0'; flight.setAttribute('aria-hidden', 'true');
    paper.style.clipPath = 'inset(0 0 0 100%)'; reveal(false); stamp.style.opacity = '0';
    core.style.opacity = smoke.style.opacity = mark.style.opacity = wave.style.opacity = trail.style.opacity = atmosphere.style.opacity = '0';
    setPhase(0);
  }
  const applyProgress = (value: number): void => {
    if (disposed) return;
    progress = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
    element.dataset['progress'] = progress.toFixed(3); setPhase(progress); options.onProgress(progress);
  };
  const activate = (): void => {
    if (disposed || activated || reduced() || state === 'closed' || state === 'error') return;
    activated = true; options.onActivate(); rebind();
  };
  function rebind(): void {
    unbind?.(); unbind = undefined; const revision = ++bindRevision;
    const staticMode = fallback() || short.matches;
    element.classList.toggle('is-static', staticMode); element.classList.toggle('is-fallback', fallback()); element.classList.toggle('is-reduced', reduced());
    scroll.classList.toggle('is-static', staticMode);
    repeat.hidden = skip.hidden = fallback();
    manualButtons.forEach(button => { button.disabled = state !== 'ready'; });
    repeat.disabled = skip.disabled = state !== 'ready';
    hint.textContent = short.matches && !fallback() ? 'Выберите состояние. Все пояснения и переходы доступны ниже.' : 'Листайте вниз. Обратная прокрутка возвращает сцену.';
    if (fallback()) { readableFinale(); return; }
    if (!activated) { applyProgress(0); return; }
    if (short.matches) { applyProgress(progress); return; }
    void import('../exhibit/scroll').then(module => {
      if (disposed || revision !== bindRevision || fallback() || short.matches) return;
      unbind = module.bindExhibitScroll({ element: scroll, onProgress: applyProgress, reducedMotion: false });
    });
  }
  function seek(value: number): void {
    if (fallback() || disposed || state !== 'ready') return;
    if (short.matches) { applyProgress(value); return; }
    const range = Math.max(0, scroll.offsetHeight - stage.offsetHeight);
    window.scrollTo({ top: scroll.getBoundingClientRect().top + scrollY + range * value, behavior: 'instant' });
    applyProgress(value);
  }
  const onRepeat = (): void => seek(0), onSkip = (): void => seek(1), onRetry = (): void => { if (!disposed) options.onRetry(); };
  const onManual = (event: Event): void => seek(Number((event.currentTarget as HTMLButtonElement).dataset['finaleProgress']));
  repeat.addEventListener('click', onRepeat); skip.addEventListener('click', onSkip); retry.addEventListener('click', onRetry);
  manualButtons.forEach(button => button.addEventListener('click', onManual));
  const onPreference = (): void => { if (near) activate(); rebind(); };
  motion.addEventListener('change', onPreference); short.addEventListener('change', onPreference);
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.target === scroll) { near = entry.isIntersecting; if (near) activate(); else layer(false); }
  }, { rootMargin: '300px' }); observer.observe(scroll);
  rebind();

  return {
    element, visual,
    setState(next) {
      if (disposed) return; const changed = state !== next, wasFallback = fallback(); state = next; element.dataset['state'] = next;
      if (wasFallback && !fallback()) resetFallbackPresentation();
      status.hidden = next === 'idle' || next === 'ready';
      status.textContent = next === 'loading' ? 'Загружаем музейную отметку…' : next === 'closed' ? '3D скрыто. Итог главы и переходы доступны.' : next === 'error' ? 'Анимация недоступна. Итог главы и переходы доступны.' : '';
      retry.hidden = next !== 'error' && next !== 'closed'; retry.textContent = next === 'closed' ? 'Показать 3D' : 'Повторить загрузку';
      if (changed) rebind(); if (near) activate();
    },
    update(frame) {
      if (disposed) return;
      if (fallback()) { readableFinale(); return; }
      layer(frame.front && frame.visible); element.dataset['progress'] = frame.progress.toFixed(3); element.dataset['mobile'] = String(frame.mobile); element.dataset['weaponVisible'] = String(frame.weaponVisible); element.dataset['bulletVisible'] = String(frame.bulletVisible);
      element.dataset['lateralError'] = frame.lateralError.toFixed(8); element.dataset['impactError'] = frame.impactError.toFixed(6); element.dataset['bulletScale'] = frame.bulletScale.toFixed(6);
      element.dataset['flight'] = frame.flight.toFixed(6); element.dataset['noseX'] = frame.nose.x.toFixed(6); element.dataset['noseY'] = frame.nose.y.toFixed(6); element.dataset['noseZ'] = frame.nose.z.toFixed(6);
      element.dataset['targetX'] = frame.target.x.toFixed(6); element.dataset['targetY'] = frame.target.y.toFixed(6); element.dataset['targetZ'] = frame.target.z.toFixed(6);
      setPhase(frame.progress);
      intro.style.opacity = String(frame.intro); intro.setAttribute('aria-hidden', String(frame.intro < .05));
      flight.style.opacity = String(frame.flightCaption); flight.setAttribute('aria-hidden', String(frame.flightCaption < .05));
      paper.style.clipPath = frame.mobile ? `inset(${100 * (1 - frame.paper)}% 0 0 0)` : `inset(0 0 0 ${48 + 52 * (1 - frame.paper)}%)`;
      reveal(frame.paper > .93); stamp.style.opacity = String(frame.stamp);
      hit.style.transform = `translate3d(${frame.impact.x}px,${frame.impact.y}px,0)`; flash.style.transform = `translate3d(${frame.muzzle.x}px,${frame.muzzle.y}px,0)`;
      trail.style.transform = `translate3d(${frame.tip.x}px,${frame.tip.y}px,0)`; trail.style.setProperty('--body', `${frame.bodyPixels}px`);
      trail.style.opacity = String(frame.trail); core.style.opacity = String(frame.flash); smoke.style.opacity = String(frame.smoke); smoke.style.transform = `translateX(${(1 - frame.smoke) * 45}px) scale(${1 + (1 - frame.smoke) * 1.2})`;
      mark.style.opacity = String(frame.mark * (1 - frame.paper)); wave.style.opacity = String(frame.wave); wave.style.transform = `scale(${frame.waveScale})`;
      atmosphere.style.opacity = String(frame.trail * .7);
      for (const [i, streak] of streaks.entries()) { const width = 80 + i % 4 * 45; streak.style.width = `${width}px`; streak.style.transform = `translate3d(${(1 - (frame.flight * 5.2 + i * .173) % 1) * (visual.clientWidth + width) - width}px,${visual.clientHeight * (.16 + i % 7 * .105)}px,0)`; }
    },
    dispose() {
      if (disposed) return; disposed = true; bindRevision++; unbind?.(); observer.disconnect(); layer(false);
      motion.removeEventListener('change', onPreference); short.removeEventListener('change', onPreference);
      repeat.removeEventListener('click', onRepeat); skip.removeEventListener('click', onSkip); retry.removeEventListener('click', onRetry); manualButtons.forEach(button => button.removeEventListener('click', onManual));
    },
  };
}
