import type { ExhibitId } from './types';
import mosin from '../assets/exhibits/mosin.webp';
import ppsh from '../assets/exhibits/ppsh.webp';
import sks from '../assets/exhibits/sks.webp';
import pm from '../assets/exhibits/pm.webp';
import akm from '../assets/exhibits/akm.webp';

export const exhibitCovers: Record<ExhibitId, { title: string; image: string; label: string }> = {
  mosin: { title: 'Винтовка Мосина', image: mosin, label: 'Мосин' }, ppsh: { title: 'ППШ-41', image: ppsh, label: 'ППШ-41' },
  sks: { title: 'СКС', image: sks, label: 'СКС' }, pm: { title: 'Пистолет Макарова', image: pm, label: 'ПМ' }, akm: { title: 'АКМ', image: akm, label: 'АКМ' },
};
