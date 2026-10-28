import type { ExhibitRecord } from '../content/types';
import { renderHistory } from '../content/renderHistory';
import type { ChapterContent } from './chapter';
import { createReferenceSection } from './ReferenceSection';
import { bindInspection } from './inspection';
import type { ExhibitScene, SceneOptions } from './ExhibitScene';
import type { ExhibitSceneState, ModelLoader } from './types';
import type { SceneView } from './view';
import './exhibit.css';
import './select.css';
import { collectionHref } from '../navigation/pages';
import { sharedSafety } from '../content/safety';
import { createFinaleSection } from '../finale/FinaleSection';
import type { FinaleTargetLoader } from '../finale/FinaleScene';

export interface ExhibitSectionOptions {
  chapter: ChapterContent; renderHost: HTMLElement; additionalViews?: readonly SceneView[]; reducedMotion?: boolean; loader?: ModelLoader;
  createScene?: (host: HTMLElement, options: SceneOptions) => ExhibitScene;
  onScene?: (scene: ExhibitScene | undefined) => void;
  finaleTargetLoader?: FinaleTargetLoader;
  onLayout?: () => void;
  onState?: (state: ExhibitSceneState | { type: 'closed' }) => void;
}

export function createExhibitSection(record: ExhibitRecord, options: ExhibitSectionOptions): { element: HTMLElement; reload(): void; dispose(): void } {
  const content = options.chapter, referenceCards = content.cards;
  if (content.id !== record.id) throw new Error('Chapter content mismatch');
  const element = document.createElement('section'); element.id = record.id; element.className = 'exhibit'; element.setAttribute('aria-label', `${content.name} — глава экспозиции`);
  element.innerHTML = `<div class="exhibit-current-actions"><a class="exhibit-collection-link" href="${collectionHref}">← К экспозиции</a><a href="#${record.id}-history">История ↘</a><a href="#${record.id}-overview">Свободный обзор ↘</a><button type="button" class="exhibit-toggle">Скрыть 3D</button></div>
    <section class="exhibit-history" id="${record.id}-history" aria-labelledby="${record.id}-history-title">
      <div class="exhibit-history-intro"><p class="exhibit-kicker">${content.history.kicker}</p><h2 id="${record.id}-history-title">${content.history.title}</h2><p class="exhibit-lead">${content.history.lead}</p></div>
      <div class="exhibit-history-copy">${content.history.paragraphs.map(p => `<p>${p}</p>`).join('')}<p class="exhibit-takeaway">${content.history.takeaway}</p><a class="exhibit-history-source" href="#${record.id}-source-1">${content.history.sourceLabel} ↗</a></div>
      <details class="exhibit-full-history"><summary>Читать историю полностью и посмотреть источники</summary></details>
    </section>
    <section class="exhibit-safety" aria-labelledby="${record.id}-safety-title"><p class="exhibit-kicker">Культура безопасности</p><h2 id="${record.id}-safety-title">${content.safety.title}</h2><div>${[...content.safety.paragraphs.slice(0, -1), sharedSafety.summary].map(p => `<p>${p}</p>`).join('')}<a href="${sharedSafety.source}">Рекомендации МЧС России ↗</a><p><a href="./#museum-safety">Общая памятка музея ↗</a></p></div></section>
    <section class="exhibit-inspector" id="${record.id}-overview" aria-labelledby="${record.id}-overview-title"><header><p class="exhibit-kicker">В конце — ваш ракурс</p><h2 id="${record.id}-overview-title">Рассмотреть<br>со всех сторон.</h2><p>Потяните модель мышью. Стрелки клавиатуры меняют ракурс, Home возвращает исходный. Колесо продолжает листать страницу.</p></header><div class="inspector-visual" role="group" tabindex="0" aria-label="Свободный обзор: ${content.name}; вращение стрелками, Home — исходный ракурс" aria-describedby="${record.id}-inspection-help"></div><div class="inspector-panel"><label class="exhibit-catalog"><span class="exhibit-catalog-caption">Каталог / ${content.catalogLabel}</span><span class="exhibit-select-wrap"><select aria-label="Элемент в свободном обзоре" title="Общий вид"><option value="">Общий вид</option></select></span></label><div class="inspector-actions"><button type="button" class="inspector-reset">Исходный ракурс ↺</button><button type="button" class="inspector-touch" aria-pressed="false">Вращать касанием</button></div><h3 class="inspector-part-title">${content.assembled}</h3><p class="inspector-description" aria-live="polite" aria-atomic="true">Выберите название в списке — группа появится отдельно с собственной карточкой. Свободное вращение не меняет состояние экскурсии.</p><p class="inspector-kind"></p><p id="${record.id}-inspection-help" class="inspector-help">На телефоне включите вращение отдельно. Для прокрутки используйте область вне модели или выключите этот режим.</p></div><p class="exhibit-inspector-message" role="status" hidden>3D недоступно. Все описания доступны выше.</p></section>
    <footer class="exhibit-credits"><p></p><a href="#${record.id}-sources">Источники главы ↗</a><a href="${collectionHref}">К экспозиции ↗</a></footer>`;
  const get = <T extends HTMLElement>(selector: string): T => { const found = element.querySelector<T>(selector); if (!found) throw new Error(`Missing exhibit node: ${selector}`); return found; };
  const toggle = get<HTMLButtonElement>('.exhibit-toggle'), inspectorHost = get<HTMLElement>('.inspector-visual');
  const inspectorSelect = get<HTMLSelectElement>('.inspector-panel select'), reset = get<HTMLButtonElement>('.inspector-reset'), touch = get<HTMLButtonElement>('.inspector-touch');
  const history = get<HTMLDetailsElement>('.exhibit-full-history'); history.append(renderHistory(record.history, record.id));
  let scene: ExhibitScene | undefined, ready = false, opened = true, disposed = false, revision = 0, touchEnabled = false;
  let finaleRequested = false, finaleProgress = 0, returnToFinale = false;
  const finale = createFinaleSection(record, {
    onProgress(progress) { finaleProgress = progress; scene?.setFinaleProgress(progress); },
    onActivate() { finaleRequested = true; void scene?.prepareFinale(); },
    onRetry() { if (!opened || !scene) { returnToFinale = true; reopen(); } else void scene.prepareFinale(); },
    onLayer(front) { options.renderHost.classList.toggle('is-finale-front', front); },
    ...(options.reducedMotion !== undefined ? { reducedMotion: options.reducedMotion } : {}),
  });
  get('.exhibit-credits').before(finale.element);
  const detailed = createReferenceSection(content, () => reopen(), options.reducedMotion); element.prepend(detailed.element);
  get('.reference-stage').append(get('.exhibit-current-actions'));
  for (const [index, card] of referenceCards.entries()) { const option = document.createElement('option'); option.value = card.id; option.textContent = `${String(index + 1).padStart(2, '0')} / ${card.title}`; inspectorSelect.append(option); }
  const rotation = { yaw: 0, pitch: 0 };
  const inspection = bindInspection(inspectorHost, (yaw, pitch) => { rotation.yaw = yaw; rotation.pitch = pitch; scene?.setInspectionRotation(yaw, pitch); });
  const credit = get<HTMLElement>('.exhibit-credits p'); credit.append('3D: ');
  const author = document.createElement('a'); author.href = record.credits.sourceUrl; author.textContent = `${record.credits.author} — «${record.history.metadata['model_source_title'] ?? record.title}»`;
  const license = document.createElement('a'); license.href = record.credits.licenseUrl; license.textContent = record.credits.licenseName;
  credit.append(author, ' · ', license, ' · ', record.credits.modificationNote);
  const openHistory = (event: MouseEvent): void => { const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a'); if (link?.hash.startsWith(`#${record.id}-source`)) history.open = true; };
  element.addEventListener('click', openHistory);

  function setState(state: ExhibitSceneState | { type: 'closed' }): void {
    if (state.type === 'error' || state.type === 'closed') finale.setState(state.type);
    ready = state.type === 'ready'; element.dataset['state'] = state.type; detailed.setState(state);
    inspectorHost.tabIndex = ready ? 0 : -1; inspectorHost.setAttribute('aria-disabled', String(!ready)); reset.disabled = touch.disabled = !ready;
    const inspectorStatus = get<HTMLElement>('.exhibit-inspector-message'); inspectorStatus.hidden = ready; inspectorStatus.textContent = state.type === 'loading' ? 'Загружаем 3D-модель…' : '3D недоступно. Все карточки доступны выше.';
    if (returnToFinale && (ready || state.type === 'error')) { returnToFinale = false; finale.element.scrollIntoView({ behavior: 'instant', block: 'start' }); }
    options.onState?.(state);
  }
  function release(): void { options.renderHost.classList.remove('is-finale-front'); detailed.connect(undefined); options.onScene?.(undefined); scene?.dispose(); scene = undefined; ready = false; }
  async function mount(): Promise<void> {
    if (disposed || !opened) return;
    const request = ++revision; release(); finale.setState('idle'); setState({ type: 'loading' });
    try {
      const [sceneModule, scrollModule] = await Promise.all([import('./ExhibitScene'), import('./scroll'), document.fonts.ready]);
      if (disposed || !opened || request !== revision) return;
      detailed.setScrollBinding(scrollModule.bindExhibitScroll);
      const sceneOptions: SceneOptions = { records: [record],
        finale: { id: record.id, element: finale.visual,
          reducedMotion: () => options.reducedMotion ?? matchMedia('(prefers-reduced-motion: reduce)').matches,
          onFrame(frame) { if (!disposed && request === revision) finale.update(frame); },
          onState(state) { if (!disposed && request === revision) { finale.setState(state); options.onLayout?.(); } },
          ...(options.finaleTargetLoader ? { targetLoader: options.finaleTargetLoader } : {}),
        }, views: [...(options.additionalViews ?? []), detailed.view, { element: inspectorHost, mode: 'inspect' }],
        onAnnotations(view, points) { if (!disposed && request === revision && view.element === detailed.view.element) detailed.updatePoints(points); },
        onState(state) { if (!disposed && opened && request === revision) setState(state); }, ...(options.loader ? { loader: options.loader } : {}) };
      scene = options.createScene ? options.createScene(options.renderHost, sceneOptions) : new sceneModule.ExhibitScene(options.renderHost, sceneOptions);
      detailed.connect(scene); options.onScene?.(scene); scene.setFinaleProgress(finaleProgress); if (finaleRequested) void scene.prepareFinale(); scene.setInspectionRotation(rotation.yaw, rotation.pitch); scene.setInspectionSelection(inspectorSelect.value || undefined); await scene.showExhibit(record.id);
    } catch { if (!disposed && opened && request === revision) setState({ type: 'error', message: 'Не удалось открыть 3D. История, все карточки и источники доступны ниже.' }); }
  }
  function reopen(): void { if (!disposed) { opened = true; toggle.textContent = 'Скрыть 3D'; void mount(); } }
  const onToggle = (): void => { opened = !opened; toggle.textContent = opened ? 'Скрыть 3D' : 'Показать 3D'; if (opened) void mount(); else { revision++; release(); setState({ type: 'closed' }); } detailed.element.scrollIntoView({ behavior: 'instant', block: 'start' }); };
  const onSelection = (): void => {
    const card = referenceCards.find(card => card.id === inspectorSelect.value);
    inspectorSelect.title = inspectorSelect.selectedOptions[0]?.textContent ?? '';
    get('.inspector-part-title').textContent = card?.title ?? content.assembled; get('.inspector-description').textContent = card?.text ?? 'Выберите название в списке — группа появится отдельно с собственной карточкой. Свободное вращение не меняет состояние экскурсии.';
    get('.inspector-kind').textContent = card?.descriptive ? 'Название по видимой форме' : ''; scene?.setInspectionSelection(card?.id);
  };
  const onReset = (): void => inspection.reset();
  const onTouch = (): void => { touchEnabled = !touchEnabled; inspection.setTouch(touchEnabled); touch.setAttribute('aria-pressed', String(touchEnabled)); touch.textContent = touchEnabled ? 'Выключить вращение касанием' : 'Вращать касанием'; };
  toggle.addEventListener('click', onToggle); inspectorSelect.addEventListener('change', onSelection); reset.addEventListener('click', onReset); touch.addEventListener('click', onTouch);
  const interruptReturn = (): void => { returnToFinale = false; };
  const interruptKey = (event: KeyboardEvent): void => { if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) interruptReturn(); };
  window.addEventListener('wheel', interruptReturn, { passive: true }); window.addEventListener('touchstart', interruptReturn, { passive: true }); window.addEventListener('pointerdown', interruptReturn, { passive: true }); window.addEventListener('keydown', interruptKey);
  const resize = new ResizeObserver(() => scene?.resize(innerWidth, innerHeight)); resize.observe(detailed.view.element); resize.observe(inspectorHost); resize.observe(finale.visual); for (const view of options.additionalViews ?? []) resize.observe(view.element);
  let started = false;
  const intersection = new IntersectionObserver(entries => { if (!started && entries.some(entry => entry.isIntersecting)) { started = true; intersection.disconnect(); void mount(); } }, { rootMargin: '200px' });
  intersection.observe(element); intersection.observe(detailed.view.element); intersection.observe(inspectorHost); for (const view of options.additionalViews ?? []) intersection.observe(view.element);
  return { element, reload: reopen, dispose() {
    if (disposed) return; disposed = true; revision++; release(); finale.dispose(); detailed.dispose(); inspection.dispose(); resize.disconnect(); intersection.disconnect();
    window.removeEventListener('wheel', interruptReturn); window.removeEventListener('touchstart', interruptReturn); window.removeEventListener('pointerdown', interruptReturn); window.removeEventListener('keydown', interruptKey);
    toggle.removeEventListener('click', onToggle); inspectorSelect.removeEventListener('change', onSelection); reset.removeEventListener('click', onReset); touch.removeEventListener('click', onTouch); element.removeEventListener('click', openHistory);
  } };
}
