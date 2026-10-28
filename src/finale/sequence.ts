import { gsap } from 'gsap';

export interface FinalePose {
  gX: number; gY: number; gS: number; gRoll: number;
  tX: number; tY: number; tZ: number; tS: number; tPitch: number;
  flight: number; follow: number; zoom: number; camReset: number;
  flash: number; smoke: number; mark: number; waveAlpha: number; waveScale: number;
  paper: number; copyAlpha: number; flightAlpha: number; trail: number; stamp: number; clock: number;
}
export interface FinaleSequenceConfig {
  readonly mobile: boolean;
  readonly isPM: boolean;
  readonly maxZoom: number;
  readonly reduced: boolean;
  readonly finalGun?: { readonly x: number; readonly y: number; readonly scale: number };
}

/** Caller supplies the fresh initial pose, owns the returned paused timeline and kills it. */
export function createFinaleTimeline(state: FinalePose, config: FinaleSequenceConfig, onUpdate: () => void): gsap.core.Timeline {
  const { mobile, isPM, maxZoom, reduced } = config;
  if (!Number.isFinite(maxZoom) || maxZoom <= 0) throw new RangeError('maxZoom must be positive and finite');
  const initialGunX = state.gX, initialTargetY = state.tY;
  const finalGun = config.finalGun ?? { x: isPM ? -1.3 : -2.05, y: isPM ? -.1 : -.05, scale: isPM ? .88 : 1.36 };
  const timeline = gsap.timeline({ paused: true, defaults: { ease: 'none' }, onUpdate });
  timeline.to(state, { clock: 1, duration: 1 }, 0);
  if (reduced) {
    timeline.to(state, { paper: 1, stamp: 1, copyAlpha: 0, camReset: 1, gX: finalGun.x, gY: finalGun.y, gS: finalGun.scale, duration: .2 }, .5);
    return timeline;
  }
  timeline.to(state, { copyAlpha: 0, duration: .10 }, .09)
    .to(state, { flash: 1, smoke: .5, duration: .012 }, .105)
    .to(state, { flash: 0, smoke: 1, duration: .045 }, .117)
    .to(state, { gX: initialGunX - .24, gRoll: -.065, duration: .025, ease: 'power2.out' }, .108)
    .to(state, { gX: initialGunX - .70, gRoll: -.09, duration: .16, ease: 'power1.out' }, .133)
    .to(state, { smoke: 0, duration: .14 }, .162)
    .to(state, { flight: 1, duration: .58 }, .11)
    .to(state, { follow: 1, duration: .14, ease: 'sine.inOut' }, .14)
    .to(state, { zoom: maxZoom, duration: .17, ease: 'power2.inOut' }, .14)
    .to(state, { flightAlpha: 1, trail: 1, duration: .09 }, .23)
    .to(state, { flightAlpha: 0, duration: .09 }, .49)
    .to(state, { zoom: mobile ? .95 : 1.65, duration: mobile ? .20 : .19, ease: 'sine.inOut' }, mobile ? .45 : .49)
    .to(state, { trail: 0, duration: .09 }, .60)
    .to(state, { mark: 1, waveAlpha: .85, waveScale: .35, duration: .012 }, .69)
    .to(state, { waveAlpha: 0, waveScale: 2.4, tPitch: .025, duration: .08, ease: 'power2.out' }, .702)
    .to(state, { tPitch: 0, tY: initialTargetY - 5, duration: .17, ease: 'power2.in' }, .735)
    .to(state, { gX: -8, gRoll: 0, duration: .001 }, .745)
    .to(state, { paper: 1, camReset: 1, duration: .19, ease: 'power2.inOut' }, .76)
    .to(state, { gX: finalGun.x, gY: finalGun.y, gS: finalGun.scale, gRoll: .025, duration: .17, ease: 'power3.out' }, .80)
    .to(state, { stamp: 1, duration: .055, ease: 'power2.out' }, .92);
  return timeline;
}
