import { createExhibitSection } from './exhibit/ExhibitSection';
import { createHero } from './hero/Hero';
import { connectHeroScene } from './hero/HeroScene';
import { createCollection } from './collection/Collection';
import type { ExhibitSectionOptions } from './exhibit/ExhibitSection';
import { exhibits } from './content/exhibits';
import { akmChapter } from './exhibits/akm-chapter';
import { mosinChapter } from './exhibits/mosin';
import { ppshChapter } from './exhibits/ppsh';
import { sksChapter } from './exhibits/sks';
import { pmChapter } from './exhibits/pm';
import { collectionHref } from './navigation/pages';
import type { MuseumPage } from './navigation/pages';
import type { ShowcaseFactory } from './hero/ShowcaseScene';
import type { CoinFactory } from './hero/CoinScene';
import { createMuseumNavigation } from './navigation/MuseumNavigation';
import { bindPagePosition } from './navigation/PagePosition';
import { createEducationSections } from './education/EducationSections';

type AppOptions = Pick<ExhibitSectionOptions, 'createScene' | 'reducedMotion' | 'finaleTargetLoader'> & { page?: MuseumPage; createHeroScene?: ShowcaseFactory; createCoinScene?: CoinFactory };

/** Mount the cover/catalog or one exhibit; never every chapter in one document. */
export function createApp(root: HTMLElement, options: AppOptions = {}): () => void {
  const page = document.createElement('main'); page.className = 'museum-shell';
  const sceneHost = document.createElement('div'); sceneHost.className = 'museum-scene-layer'; sceneHost.setAttribute('aria-hidden', 'true');
  const skip = document.createElement('a'); skip.className = 'skip-to-content'; skip.textContent = 'К содержанию';
  const id = options.page ?? 'home'; root.dataset['page'] = id;
  if (id === 'home') {
    document.title = 'Виртуальный музей'; skip.href = '#tour-start';
    let heroScene: ReturnType<typeof connectHeroScene> | undefined;
    const hero = createHero({ onRetry: () => heroScene?.reload(), onRetryCoin: () => heroScene?.reloadCoin(), ...(options.reducedMotion !== undefined ? { reducedMotion: options.reducedMotion } : {}) });
    page.append(hero.element, createCollection(exhibits), ...createEducationSections(exhibits)); root.replaceChildren(skip, sceneHost, page);
    const position = bindPagePosition(root, id); void document.fonts.ready.then(() => position.settle());
    heroScene = connectHeroScene(sceneHost, hero, options.createHeroScene, options.createCoinScene);
    return () => { position.dispose(); heroScene?.dispose(); hero.dispose(); sceneHost.remove(); };
  }
  const record = exhibits.find(record => record.id === id)!;
  document.title = `${id === 'mosin' ? 'Винтовка Мосина' : record.title} — Виртуальный музей`;
  const content = id === 'mosin' ? mosinChapter : id === 'akm' ? akmChapter : id === 'ppsh' ? ppshChapter : id === 'sks' ? sksChapter : id === 'pm' ? pmChapter : undefined;
  if (content) {
    let position: ReturnType<typeof bindPagePosition> | undefined;
    const chapter = createExhibitSection(record, { ...options, chapter: content, renderHost: sceneHost, onLayout() { position?.settle(); }, onState(state) { if (state.type === 'ready' || state.type === 'error' || state.type === 'closed') position?.settle(); } });
    const navigation = createMuseumNavigation(exhibits, id);
    chapter.element.querySelector('.exhibit-current-actions')!.querySelector('.exhibit-collection-link')!.after(navigation.menu);
    skip.href = `#${id}-history`; page.classList.add('exhibit-page'); page.append(chapter.element, navigation.pager); root.replaceChildren(skip, sceneHost, page);
    position = bindPagePosition(root, id);
    return () => { position?.dispose(); navigation.dispose(); chapter.dispose(); sceneHost.remove(); };
  }
  // A guarded fallback for a record without chapter content.
  skip.href = '#upcoming-title'; page.classList.add('upcoming-page');
  const back = document.createElement('a'); back.href = collectionHref; back.className = 'upcoming-back'; back.textContent = '← К экспозиции';
  const kicker = document.createElement('p'); kicker.className = 'exhibit-kicker'; kicker.textContent = record.periodLabel;
  const title = document.createElement('h1'); title.id = 'upcoming-title'; title.textContent = record.title;
  const note = document.createElement('p'); note.textContent = 'Скоро в экспозиции'; note.className = 'upcoming-note';
  const copy = document.createElement('p'); copy.textContent = 'Эта глава музея ещё готовится. Сейчас можно познакомиться с винтовкой Мосина, ППШ-41, СКС и АКМ.';
  page.append(back, kicker, title, note, copy); root.replaceChildren(skip, page);
  return () => {};
}
