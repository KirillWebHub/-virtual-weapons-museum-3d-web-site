import type { ChapterContent } from './chapter';
import { chapterState } from './chapter-state';
import { MANUAL_SCENE_QUERY } from './scene-layout';
import { visibleAnnotations } from './annotations';
import { bindInspection } from './inspection';
import type { ProjectedAnnotation } from './annotations';
import type { ExhibitScene } from './ExhibitScene';
import type { ExhibitSceneState } from './types';
import type { SceneView } from './view';
import './reference.css';

export function createReferenceSection(content: ChapterContent, onReopen: () => void, reducedMotion?: boolean): {
  element: HTMLElement; view: SceneView; connect(scene: ExhibitScene | undefined): void;
  setState(state: ExhibitSceneState | { type: 'closed' }): void;
  setScrollBinding(bind: typeof import('./scroll').bindExhibitScroll): void;
  updatePoints(points: readonly ProjectedAnnotation[]): void; dispose(): void;
} {
  const referenceCards = content.cards, referenceInfo = content, count = referenceCards.length;
  const element = document.createElement('section'); element.id = `${content.id}-display`; element.className = 'reference-section'; element.setAttribute('aria-labelledby', `${content.id}-title`);
  element.innerHTML = `<div class="reference-scroll"><div class="reference-stage">
    <header class="reference-heading"><p class="exhibit-kicker">${content.kicker}</p><h1 id="${content.id}-title">${content.heading} <br><span>Взгляд на ${content.catalogLabel}</span></h1><p>${content.intro}</p></header>
    <div class="reference-visual" role="group" tabindex="-1" aria-label="${content.name}: выберите одну из ${count} групп"><button type="button" class="reference-turn" aria-label="Повернуть выбранную группу" hidden>↻</button></div>
    <div class="reference-message" role="status"><p>Подробная модель загрузится при приближении.</p><button type="button" hidden>Повторить загрузку схемы</button></div>
    <aside class="reference-panel"><label class="exhibit-catalog"><span class="exhibit-catalog-caption">Каталог / ${content.catalogLabel}</span><span class="exhibit-select-wrap"><select aria-label="Группа подробной схемы"><option value="">Вся модель</option></select></span></label><div class="reference-paging"><button type="button" class="reference-prev" aria-label="Предыдущая группа">←</button><button type="button" class="reference-all">Вся схема</button><button type="button" class="reference-next" aria-label="Следующая группа">→</button></div><p class="reference-card-number">${count} / Все группы</p><h2 class="reference-part-title">Общий вид</h2><p class="reference-card-text" aria-live="polite" aria-atomic="true">Прокрутка разносит все доступные группы одновременно и возвращает их на место. Выберите номер или название — группа появится крупно с собственной карточкой.</p><p class="reference-card-kind"></p><p class="reference-rotate-help">Отдельную группу можно повернуть мышью или стрелками. Home — исходный ракурс.</p></aside>
    <nav class="reference-steps" aria-label="Состояния подробной схемы"><button type="button" data-progress="0" aria-pressed="true">01 Общий вид</button><button type="button" data-progress=".55" aria-pressed="false">02 Все группы</button><button type="button" data-progress="1" aria-pressed="false">03 Снова целое</button></nav>
    <p class="reference-note">Номера относятся к цифровым группам. Раскладка условная.</p>
  </div></div><div class="reference-caption"><p>${content.caption}</p><p>Иллюстрация: <a class="reference-author">${content.author}</a> · исходное название публикации <a class="reference-source">«${content.sourceTitle}»</a> · <a class="reference-license">CC BY 4.0</a> · <a class="reference-terms">${content.termsLabel}</a>. ${content.illustrationNote}</p></div>
    <details class="reference-catalog"><summary>Все карточки обычным текстом (${count})</summary><ol></ol></details>`;
  const get = <T extends HTMLElement>(selector: string): T => element.querySelector<T>(selector)!;
  const host = get<HTMLElement>('.reference-visual'), scroll = get<HTMLElement>('.reference-scroll'), stage = get<HTMLElement>('.reference-stage'), select = get<HTMLSelectElement>('select');
  const status = get<HTMLElement>('.reference-message'), statusText = get<HTMLElement>('.reference-message p'), retry = get<HTMLButtonElement>('.reference-message button');
  const prev = get<HTMLButtonElement>('.reference-prev'), next = get<HTMLButtonElement>('.reference-next'), all = get<HTMLButtonElement>('.reference-all');
  const turn = get<HTMLButtonElement>('.reference-turn');
  for (const [selector, url] of [['.reference-author', referenceInfo.source], ['.reference-source', referenceInfo.source], ['.reference-license', referenceInfo.license], ['.reference-terms', referenceInfo.terms]]) get<HTMLAnchorElement>(selector!).href = url!;
  let scene: ExhibitScene | undefined, progress = 0, phase = -1, selected: string | undefined;
  let ready = false, compact = false, unbind: (() => void) | undefined;
  let bindScroll: typeof import('./scroll').bindExhibitScroll | undefined;
  const shortWindow = matchMedia(MANUAL_SCENE_QUERY);
  const summaryText = (): string => shortWindow.matches || reduced() ? 'Выбирайте состояние кнопками. Номер или название открывает группу крупно с собственной карточкой.' : 'Листайте вниз — группы расходятся и снова собираются. Нажмите номер или выберите группу, чтобы рассмотреть её.';
  const media = matchMedia('(prefers-reduced-motion: reduce)'), reduced = (): boolean => reducedMotion ?? media.matches;
  const markers = referenceCards.map((card, index) => {
    const option = document.createElement('option'); option.value = card.id; option.textContent = `${String(index + 1).padStart(2, '0')} / ${card.title}`; select.append(option);
    const button = document.createElement('button'); button.type = 'button'; button.className = 'reference-marker'; button.hidden = true; button.textContent = String(index + 1).padStart(2, '0'); button.setAttribute('aria-label', `${index + 1}. ${card.title}`);
    const click = (): void => { choose(card.id); if (ready) host.focus({ preventScroll: true }); }; button.addEventListener('click', click); host.append(button);
    const li = document.createElement('li'), heading = document.createElement('h3'), paragraph = document.createElement('p'), open = document.createElement('button');
    heading.textContent = `${String(index + 1).padStart(2, '0')} / ${card.title}`; paragraph.textContent = card.text; open.type = 'button'; open.textContent = 'Рассмотреть отдельно ↗';
    const fromCatalog = (): void => { choose(card.id); scroll.scrollIntoView({ behavior: 'instant', block: 'start' }); host.focus({ preventScroll: true }); };
    open.addEventListener('click', fromCatalog); li.append(heading, paragraph);
    if (card.descriptive) { const note = document.createElement('p'); note.className = 'reference-descriptive'; note.textContent = 'Название по видимой форме'; li.append(note); }
    li.append(open); get<HTMLOListElement>('.reference-catalog ol').append(li);
    return { card, button, click, open, fromCatalog };
  });
  const inspection = bindInspection(host, (yaw, pitch) => { if (selected) scene?.setReferenceRotation(yaw, pitch); });
  function choose(id?: string): void {
    const card = referenceCards.find(card => card.id === id); selected = card?.id; select.value = selected ?? ''; select.title = select.selectedOptions[0]?.textContent ?? '';
    element.dataset['selected'] = selected ?? ''; host.classList.toggle('is-selected', Boolean(selected)); host.tabIndex = selected ? 0 : -1; inspection.reset(); scene?.selectReferencePart(selected);
    const index = card ? referenceCards.indexOf(card) : -1;
    get('.reference-card-number').textContent = card ? `${String(index + 1).padStart(2, '0')} / ${count}` : `${count} / Все группы`;
    get('.reference-part-title').textContent = card?.title ?? 'Общий вид';
    get('.reference-card-text').textContent = card?.text ?? summaryText();
    get('.reference-card-kind').textContent = card?.descriptive ? 'Название по видимой форме' : '';
    get('.reference-rotate-help').hidden = !card;
    turn.hidden = !card; turn.disabled = !ready;
  }
  function applyProgress(value: number): void {
    const state = chapterState(value); progress = state.progress; element.dataset['progress'] = progress.toFixed(3); element.dataset['spread'] = state.spread.toFixed(3);
    if (phase !== state.phase) { phase = state.phase; choose(); }
    for (const button of stepButtons) button.setAttribute('aria-pressed', String(Number(button.dataset['progress']) === (state.phase === 0 ? 0 : state.phase === 3 ? 1 : .55)));
    scene?.setReferenceProgress(progress);
  }
  const stepButtons = [...element.querySelectorAll<HTMLButtonElement>('[data-progress]')];
  function rebind(): void { unbind?.(); unbind = undefined; scroll.classList.toggle('is-static', compact || reduced() || shortWindow.matches); if (!selected) get('.reference-card-text').textContent = summaryText(); if (ready && bindScroll && !shortWindow.matches) unbind = bindScroll({ element: scroll, stage, onProgress: applyProgress, reducedMotion: reduced() }); }
  function setState(state: ExhibitSceneState | { type: 'closed' }): void {
    ready = state.type === 'ready'; compact = state.type === 'closed' || state.type === 'error'; element.dataset['state'] = state.type; status.hidden = ready; retry.hidden = state.type === 'loading' || ready;
    turn.disabled = !ready; host.setAttribute('aria-disabled', String(!ready)); host.tabIndex = selected && ready ? 0 : -1;
    retry.textContent = state.type === 'closed' ? 'Показать 3D' : 'Повторить загрузку схемы';
    statusText.textContent = state.type === 'loading' ? 'Загружаем подробную схему…' : state.type === 'error' ? state.message : state.type === 'closed' ? '3D-просмотр скрыт. Все карточки доступны ниже.' : '';
    if (!ready) for (const marker of markers) marker.button.hidden = true;
    rebind();
  }
  const selectChange = (): void => choose(select.value || undefined);
  const onAll = (): void => choose();
  const move = (direction: number): void => { const index = referenceCards.findIndex(card => card.id === selected); const target = index < 0 ? direction > 0 ? 0 : referenceCards.length - 1 : (index + direction + referenceCards.length) % referenceCards.length; choose(referenceCards[target]!.id); };
  const onPrev = (): void => move(-1), onNext = (): void => move(1);
  const onRetry = (): void => onReopen();
  const onTurn = (): void => inspection.rotateBy(Math.PI / 4, 0);
  const step = (event: Event): void => { const value = Number((event.currentTarget as HTMLButtonElement).dataset['progress']); choose(); if (!ready || reduced() || shortWindow.matches) { applyProgress(value); if (shortWindow.matches) host.scrollIntoView({ behavior: 'instant', block: 'center' }); } else window.scrollTo({ top: scroll.getBoundingClientRect().top + scrollY + (scroll.offsetHeight - stage.offsetHeight) * value, behavior: 'instant' }); };
  select.addEventListener('change', selectChange); all.addEventListener('click', onAll); prev.addEventListener('click', onPrev); next.addEventListener('click', onNext); retry.addEventListener('click', onRetry); media.addEventListener('change', rebind); shortWindow.addEventListener('change', rebind); stepButtons.forEach(button => button.addEventListener('click', step));
  turn.addEventListener('click', onTurn);
  const resize = new ResizeObserver(() => scene?.resize(innerWidth, innerHeight)); resize.observe(host);
  scroll.classList.toggle('is-static', reduced()); choose(); applyProgress(0);
  return {
    element, view: { element: host, mode: 'exhibit' }, setState,
    setScrollBinding(bind) { bindScroll = bind; rebind(); },
    connect(nextScene) {
      unbind?.(); unbind = undefined; scene = nextScene; ready = false; compact = false; scroll.classList.toggle('is-static', reduced()); choose();
      for (const marker of markers) marker.button.hidden = true;
    },
    updatePoints(points) {
      const shown = visibleAnnotations(points, host.clientWidth, host.clientHeight);
      for (const { card, button } of markers) {
        const point = shown.find(point => point.id === card.id); button.hidden = !point;
        if (point) button.style.transform = `translate(${point.x.toFixed(1)}px,${point.y.toFixed(1)}px) translate(-50%,-50%)`;
      }
    },
    dispose() {
      unbind?.(); inspection.dispose(); resize.disconnect(); turn.removeEventListener('click', onTurn);
      select.removeEventListener('change', selectChange); all.removeEventListener('click', onAll); prev.removeEventListener('click', onPrev); next.removeEventListener('click', onNext); retry.removeEventListener('click', onRetry); media.removeEventListener('change', rebind); shortWindow.removeEventListener('change', rebind); stepButtons.forEach(button => button.removeEventListener('click', step));
      for (const { button, click, open, fromCatalog } of markers) { button.removeEventListener('click', click); open.removeEventListener('click', fromCatalog); }
    },
  };
}
