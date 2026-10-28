import './styles/tokens.css';
import './styles/base.css';
import { createApp } from './app';
import { legacyChapterHref, museumPage } from './navigation/pages';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('Не найден корневой элемент приложения.');
const page = museumPage(location.pathname);
const legacy = page === 'home' ? legacyChapterHref(location.hash) : undefined;
if (legacy) location.replace(legacy);
let dispose = legacy ? (): void => {} : createApp(root, { page }), mounted = !legacy;
const onHashChange = (): void => {
  const target = page === 'home' ? legacyChapterHref(location.hash) : undefined;
  if (target) location.replace(target);
};
window.addEventListener('hashchange', onHashChange);
const onPageHide = (): void => { if (mounted) { dispose(); mounted = false; } };
const onPageShow = (event: PageTransitionEvent): void => { if (event.persisted && !mounted && !legacy) { dispose = createApp(root, { page }); mounted = true; } };
window.addEventListener('pagehide', onPageHide);
window.addEventListener('pageshow', onPageShow);
import.meta.hot?.dispose(() => { window.removeEventListener('pagehide', onPageHide); window.removeEventListener('pageshow', onPageShow); window.removeEventListener('hashchange', onHashChange); dispose(); });

