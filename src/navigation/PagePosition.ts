import type { MuseumPage } from './pages';
import { anchorId, referenceProgress, restoredTop, validPosition } from './position-state';
import type { PagePosition, ScrollMetrics } from './position-state';

const stateKey = 'virtualMuseumPosition';
type Intent = { type: 'anchor'; hash: string; focus: boolean } | { type: 'position'; position: PagePosition };
/** Keep position per history entry; a late asset may settle layout, never overrule user input. */
export function bindPagePosition(root: HTMLElement, page: MuseumPage): { settle(): void; dispose(): void } {
  let disposed = false, settled = false, frame: number | undefined, timer: ReturnType<typeof setTimeout> | undefined, intent: Intent | undefined;
  const previousRestoration = window.history.scrollRestoration; window.history.scrollRestoration = 'manual';
  const urlKey = (): string => location.pathname + location.search + location.hash;
  const metrics = (): ScrollMetrics => {
    const scroll = root.querySelector<HTMLElement>('.reference-scroll'), stage = root.querySelector<HTMLElement>('.reference-stage');
    return { start: scroll ? scroll.getBoundingClientRect().top + scrollY : 0, height: scroll?.offsetHeight ?? 0, viewport: stage?.offsetHeight ?? innerHeight, maximum: Math.max(0, document.documentElement.scrollHeight - innerHeight) };
  };
  const finaleMetrics = (): ScrollMetrics | undefined => {
    const scroll = root.querySelector<HTMLElement>('.finale-scroll'), stage = root.querySelector<HTMLElement>('.finale-stage');
    if (!scroll) return undefined;
    const viewport = stage?.offsetHeight ?? innerHeight;
    return { start: scroll.getBoundingClientRect().top + scrollY, height: scroll.classList.contains('is-static') ? viewport : scroll.offsetHeight, viewport, maximum: Math.max(0, document.documentElement.scrollHeight - innerHeight) };
  };
  const capture = (): PagePosition => {
    const progress = referenceProgress(scrollY, metrics()), finale = finaleMetrics();
    const finaleProgress = finale ? referenceProgress(scrollY, finale) : undefined;
    return { top: Math.max(0, scrollY), ...(progress !== undefined ? { progress } : {}), ...(finaleProgress !== undefined ? { finaleProgress } : {}), historyOpen: root.querySelector<HTMLDetailsElement>('.exhibit-full-history')?.open ?? false, catalogOpen: root.querySelector<HTMLDetailsElement>('.reference-catalog')?.open ?? false, openSections: [...root.querySelectorAll<HTMLDetailsElement>('details[id][open]')].map(details => details.id) };
  };
  function save(): void {
    if (disposed || intent) return;
    const state: unknown = window.history.state;
    window.history.replaceState({ ...(state && typeof state === 'object' ? state : {}), [stateKey]: { page, url: urlKey(), position: capture() } }, '');
  }
  const checkpoint = (): PagePosition | undefined => {
    const state = window.history.state as Record<string, unknown> | null, value = state?.[stateKey];
    if (!value || typeof value !== 'object') return undefined;
    const data = value as Record<string, unknown>;
    return data['page'] === page && data['url'] === urlKey() && validPosition(data['position']) ? data['position'] : undefined;
  };
  function target(hash: string): HTMLElement | undefined {
    const id = anchorId(hash === '#ak47-reference' || hash === '#akm-prototype' ? '#akm' : hash);
    const node = id ? document.getElementById(id) : null;
    return node && root.contains(node) ? node : undefined;
  }
  function reveal(node: HTMLElement): void {
    let ancestor: HTMLElement | null = node;
    while (ancestor && root.contains(ancestor)) { if (ancestor instanceof HTMLDetailsElement) ancestor.open = true; ancestor = ancestor.parentElement; }
  }
  function waitingForFinale(): boolean {
    if (!intent) return false;
    const section = intent.type === 'position' ? intent.position.finaleProgress !== undefined ? root.querySelector<HTMLElement>('.finale-section') : null
      : target(intent.hash)?.closest<HTMLElement>('.finale-section');
    const state = section?.dataset['state'];
    return (state === 'idle' || state === 'loading') && !section?.querySelector('.finale-scroll')?.classList.contains('is-static');
  }
  function restore(final = settled): void {
    if (disposed || !intent) return;
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      frame = undefined; if (disposed || !intent) return;
      if (intent.type === 'position') window.scrollTo({ top: restoredTop(intent.position, metrics(), finaleMetrics()), behavior: 'instant' });
      else {
        const node = target(intent.hash);
        if (node) { reveal(node); node.scrollIntoView({ behavior: 'instant', block: 'start' }); if (intent.focus) { if (!node.hasAttribute('tabindex')) { node.tabIndex = -1; node.setAttribute('data-museum-anchor', ''); } node.focus({ preventScroll: true }); } }
      }
      // Move near a lazy finale now; retain its intent until target loading has settled its layout.
      if (final && !waitingForFinale()) { intent = undefined; save(); }
    });
  }
  function enter(): void {
    const saved = checkpoint();
    if (saved) {
      for (const [selector, open] of [['.exhibit-full-history', saved.historyOpen], ['.reference-catalog', saved.catalogOpen]] as const) { const details = root.querySelector<HTMLDetailsElement>(selector); if (details) details.open = open; }
      for (const details of root.querySelectorAll<HTMLDetailsElement>('details[id]')) details.open = saved.openSections?.includes(details.id) ?? false;
      const anchor = target(location.hash); if (anchor) reveal(anchor);
      intent = { type: 'position', position: saved };
    } else intent = location.hash && target(location.hash) ? { type: 'anchor', hash: location.hash, focus: true } : { type: 'position', position: { top: 0, historyOpen: false, catalogOpen: false } };
    restore();
  }
  const onClick = (event: MouseEvent): void => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const clicked = event.target as HTMLElement;
    if (clicked.closest('button,select,input,summary')) { interrupt(); return; }
    const link = clicked.closest<HTMLAnchorElement>('a[href]'); if (!link || link.target || link.hasAttribute('download')) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname || url.search !== location.search || !url.hash || !target(url.hash)) return;
    event.preventDefault(); intent = undefined; save();
    if (url.hash !== location.hash) window.history.pushState(null, '', url.hash);
    intent = { type: 'anchor', hash: url.hash, focus: true }; restore();
  };
  const interrupt = (): void => { intent = undefined; if (frame !== undefined) cancelAnimationFrame(frame); frame = undefined; };
  const onKey = (event: KeyboardEvent): void => { if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) interrupt(); };
  const onScroll = (): void => { if (timer !== undefined) clearTimeout(timer); timer = setTimeout(save, 180); };
  root.addEventListener('click', onClick); window.addEventListener('hashchange', enter); window.addEventListener('popstate', enter);
  window.addEventListener('wheel', interrupt, { passive: true }); window.addEventListener('touchstart', interrupt, { passive: true }); window.addEventListener('pointerdown', interrupt, { passive: true }); window.addEventListener('keydown', onKey); window.addEventListener('scroll', onScroll, { passive: true });
  enter(); void document.fonts.ready.then(() => restore());
  return {
    settle() { settled = true; restore(true); },
    dispose() {
      if (disposed) return; intent = undefined; save(); disposed = true;
      if (frame !== undefined) cancelAnimationFrame(frame); if (timer !== undefined) clearTimeout(timer);
      root.removeEventListener('click', onClick); window.removeEventListener('hashchange', enter); window.removeEventListener('popstate', enter); window.removeEventListener('wheel', interrupt); window.removeEventListener('touchstart', interrupt); window.removeEventListener('pointerdown', interrupt); window.removeEventListener('keydown', onKey); window.removeEventListener('scroll', onScroll); window.history.scrollRestoration = previousRestoration;
    },
  };
}
