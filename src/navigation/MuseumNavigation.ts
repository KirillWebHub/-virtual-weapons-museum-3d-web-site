import type { ExhibitId, ExhibitRecord } from '../content/types';
import { EXHIBIT_IDS } from '../content/types';
import { collectionHref, exhibitHref } from './pages';
import './navigation.css';

const shortNames: Record<ExhibitId, string> = { mosin: 'Мосин', ppsh: 'ППШ-41', sks: 'СКС', pm: 'ПМ', akm: 'АКМ' };
export function tourNeighbors(id: ExhibitId): { index: number; previous: ExhibitId | undefined; next: ExhibitId | undefined } {
  const index = EXHIBIT_IDS.indexOf(id);
  return { index, previous: EXHIBIT_IDS[index - 1], next: EXHIBIT_IDS[index + 1] };
}

/** Native document links keep each chapter independent, including on static hosting. */
export function createMuseumNavigation(records: readonly ExhibitRecord[], id: ExhibitId): {
  menu: HTMLElement; pager: HTMLElement; dispose(): void;
} {
  const route = tourNeighbors(id), number = String(route.index + 1).padStart(2, '0');
  const title = (item: ExhibitId): string => item === 'mosin' ? 'Винтовка Мосина' : records.find(record => record.id === item)!.title;
  const menu = document.createElement('nav'); menu.className = 'museum-navigation'; menu.setAttribute('aria-label', 'Экспонаты музея');
  const disclosure = document.createElement('details'), summary = document.createElement('summary');
  summary.append('Маршрут '); const current = document.createElement('span'); current.textContent = `${number} / 05`; summary.append(current);
  const list = document.createElement('ol'); list.className = 'museum-route';
  for (const [index, item] of EXHIBIT_IDS.entries()) {
    const li = document.createElement('li'), link = document.createElement('a'), num = document.createElement('span'), name = document.createElement('span');
    link.href = item === id ? `#${id}` : exhibitHref(item); link.setAttribute('aria-label', `${index + 1}. ${title(item)}`);
    if (item === id) link.setAttribute('aria-current', 'page');
    num.textContent = String(index + 1).padStart(2, '0'); name.textContent = shortNames[item]; link.append(num, name); li.append(link); list.append(li);
  }
  const catalog = document.createElement('a'); catalog.href = collectionHref; catalog.className = 'museum-route-catalog'; catalog.textContent = 'Все экспонаты ↗';
  const sources = document.createElement('a'); sources.href = './#museum-sources'; sources.className = 'museum-route-catalog'; sources.textContent = 'Источники музея ↗';
  const panel = document.createElement('div'); panel.className = 'museum-route-panel'; panel.append(list, catalog, sources);
  disclosure.append(summary, panel); menu.append(disclosure);
  const close = (): void => { disclosure.open = false; };
  const outside = (event: PointerEvent): void => { if (!menu.contains(event.target as Node)) close(); };
  const escape = (event: KeyboardEvent): void => { if (event.key === 'Escape' && disclosure.open) { event.preventDefault(); close(); summary.focus({ preventScroll: true }); } };
  const follow = (event: MouseEvent): void => { if ((event.target as HTMLElement).closest('a')) close(); };
  const focusOut = (event: FocusEvent): void => { if (event.relatedTarget instanceof Node && !menu.contains(event.relatedTarget)) close(); };
  document.addEventListener('pointerdown', outside); menu.addEventListener('keydown', escape); menu.addEventListener('click', follow); menu.addEventListener('focusout', focusOut);

  const pager = document.createElement('nav'); pager.className = 'museum-pager'; pager.setAttribute('aria-label', 'Продолжение экскурсии');
  const caption = document.createElement('p'); caption.className = 'museum-pager-caption'; caption.textContent = `Экспонат ${number} / 05`;
  const outcomes = document.createElement('a'); outcomes.href = './#museum-education'; outcomes.textContent = 'Итоги и безопасность ↗'; caption.append(outcomes);
  pager.append(caption);
  for (const [direction, neighbor] of [['previous', route.previous], ['next', route.next]] as const) {
    const link = document.createElement('a'); link.className = `museum-pager-link museum-pager-${direction}`;
    link.href = neighbor ? exhibitHref(neighbor) : collectionHref;
    const label = document.createElement('span'), name = document.createElement('span'), arrow = document.createElement('span');
    label.className = 'museum-pager-label'; label.textContent = neighbor ? direction === 'previous' ? 'Предыдущий экспонат' : 'Следующий экспонат' : direction === 'previous' ? 'Выбрать другую историю' : 'Вернуться к коллекции';
    name.className = 'museum-pager-name'; name.textContent = neighbor ? neighbor === 'mosin' ? 'Винтовка Мосина' : neighbor === 'pm' ? 'Пистолет Макарова' : shortNames[neighbor] : 'Экспозиция';
    arrow.className = 'museum-pager-arrow'; arrow.textContent = direction === 'previous' ? '←' : '→'; arrow.setAttribute('aria-hidden', 'true');
    link.append(label, name, arrow); pager.append(link);
  }
  return { menu, pager, dispose() { document.removeEventListener('pointerdown', outside); menu.removeEventListener('keydown', escape); menu.removeEventListener('click', follow); menu.removeEventListener('focusout', focusOut); } };
}
