import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function bindExhibitScroll({ element, onProgress, reducedMotion }: {
  element: HTMLElement; onProgress: (progress: number) => void; reducedMotion: boolean;
}): () => void {
  if (reducedMotion) { onProgress(0); return () => {}; }
  let disposed = false;
  const state = { progress: 0 };
  const tween = gsap.fromTo(state, { progress: 0 }, {
    progress: 1, ease: 'none', duration: 1,
    onUpdate: () => onProgress(state.progress),
    scrollTrigger: { trigger: element, start: 'top top', end: 'bottom bottom', scrub: true, invalidateOnRefresh: true },
  });
  const refresh = (): void => { if (!disposed) { ScrollTrigger.refresh(); onProgress(tween.scrollTrigger?.progress ?? 0); } };
  void document.fonts.ready.then(refresh);
  refresh();
  return () => { disposed = true; tween.scrollTrigger?.kill(); tween.kill(); };
}
