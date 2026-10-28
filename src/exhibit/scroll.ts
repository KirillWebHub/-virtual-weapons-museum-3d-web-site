import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function bindExhibitScroll({ element, stage, onProgress, reducedMotion }: {
  element: HTMLElement; stage: HTMLElement; onProgress: (progress: number) => void; reducedMotion: boolean;
}): () => void {
  if (reducedMotion) { onProgress(0); return () => {}; }
  let disposed = false;
  const state = { progress: 0 };
  const tween = gsap.fromTo(state, { progress: 0 }, {
    progress: 1, ease: 'none', duration: 1,
    onUpdate: () => onProgress(state.progress),
    // Use the sticky stage, not innerHeight: Safari's toolbar can change the latter
    // while the stable 100svh stage and the document's scroll range stay unchanged.
    scrollTrigger: { trigger: element, start: 'top top', end: () => `+=${Math.max(1, element.offsetHeight - stage.offsetHeight)}`, scrub: true, invalidateOnRefresh: true },
  });
  const refresh = (): void => { if (!disposed) { ScrollTrigger.refresh(); onProgress(tween.scrollTrigger?.progress ?? 0); } };
  void document.fonts.ready.then(refresh);
  refresh();
  return () => { disposed = true; tween.scrollTrigger?.kill(); tween.kill(); };
}
