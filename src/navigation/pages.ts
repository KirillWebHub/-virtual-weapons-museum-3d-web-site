import { EXHIBIT_IDS } from '../content/types';
import type { ExhibitId } from '../content/types';
export type MuseumPage = 'home' | ExhibitId;
/** Flat HTML entries also work under a GitHub Pages repository subdirectory. */
export function exhibitHref(id: ExhibitId): string { return `./${id}.html`; }
export const collectionHref = './#tour-start';
export function museumPage(pathname: string): MuseumPage {
  const name = pathname.split('/').at(-1)?.replace(/\.html$/, '');
  return EXHIBIT_IDS.find(id => id === name) ?? 'home';
}
/** Preserve links shared before chapters became separate pages. */
export function legacyChapterHref(hash: string): string | undefined {
  if (hash === '#ak47-reference' || hash === '#akm-prototype') return './akm.html#akm';
  const id = EXHIBIT_IDS.find(id => hash === `#${id}` || hash.startsWith(`#${id}-`));
  return id ? `${exhibitHref(id)}${hash}` : undefined;
}
