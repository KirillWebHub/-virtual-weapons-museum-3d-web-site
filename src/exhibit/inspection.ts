import { inspectorRotation } from './chapter-state';

export function bindInspection(host: HTMLElement, onRotate: (yaw: number, pitch: number) => void): { reset(): void; rotateBy(yaw: number, pitch: number): void; setTouch(enabled: boolean): void; dispose(): void } {
  let yaw = 0, pitch = 0, touch = false, pointer: { id: number; x: number; y: number } | undefined;
  const apply = (): void => { ({ yaw, pitch } = inspectorRotation(yaw, pitch)); host.dataset['rotation'] = `${yaw.toFixed(3)},${pitch.toFixed(3)}`; onRotate(yaw, pitch); };
  const end = (): void => { if (pointer && host.hasPointerCapture(pointer.id)) host.releasePointerCapture(pointer.id); pointer = undefined; host.classList.remove('is-dragging'); };
  const down = (event: PointerEvent): void => {
    if (event.button !== 0 || (event.pointerType !== 'mouse' && !touch) || (event.target as HTMLElement).closest('button,a')) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY }; host.setPointerCapture(event.pointerId); host.classList.add('is-dragging'); host.focus({ preventScroll: true });
  };
  const move = (event: PointerEvent): void => {
    if (!pointer || event.pointerId !== pointer.id) return;
    yaw += (event.clientX - pointer.x) * .008; pitch += (event.clientY - pointer.y) * .006;
    pointer.x = event.clientX; pointer.y = event.clientY; apply();
  };
  const key = (event: KeyboardEvent): void => {
    if (event.target !== host) return;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'Escape'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') { yaw = 0; pitch = 0; }
    if (event.key === 'ArrowLeft') yaw -= .2; if (event.key === 'ArrowRight') yaw += .2;
    if (event.key === 'ArrowUp') pitch -= .15; if (event.key === 'ArrowDown') pitch += .15;
    if (event.key === 'Escape') end(); apply();
  };
  host.addEventListener('pointerdown', down); host.addEventListener('pointermove', move); host.addEventListener('pointerup', end); host.addEventListener('pointercancel', end); host.addEventListener('keydown', key); host.addEventListener('lostpointercapture', end); window.addEventListener('blur', end);
  return {
    reset() { end(); yaw = 0; pitch = 0; apply(); },
    rotateBy(yawDelta, pitchDelta) { yaw += yawDelta; pitch += pitchDelta; apply(); },
    setTouch(enabled) { end(); touch = enabled; host.classList.toggle('is-touch-enabled', enabled); },
    dispose() { end(); host.removeEventListener('pointerdown', down); host.removeEventListener('pointermove', move); host.removeEventListener('pointerup', end); host.removeEventListener('pointercancel', end); host.removeEventListener('keydown', key); host.removeEventListener('lostpointercapture', end); window.removeEventListener('blur', end); },
  };
}
