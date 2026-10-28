import mosinModel from '../../3D-models/mosin-rifle.glb?url';
import ppshModel from '../../3D-models/ppsh-41.glb?url';
import sksModel from '../../3D-models/sks.glb?url';
import pmModel from '../../3D-models/pm_-_makarov_pistol.glb?url';
import akmModel from '../../3D-models/akm-detailed.glb?url';
import mosinRaw from '../../history/mosin-1891-30.md?raw';
import ppshRaw from '../../history/ppsh-41.md?raw';
import sksRaw from '../../history/sks.md?raw';
import pmRaw from '../../history/makarov-pm.md?raw';
import akmRaw from '../../history/akm.md?raw';
import { parseHistory } from './history';
import type { ExhibitId, ExhibitRecord } from './types';

function metadataField(metadata: Record<string, string>, key: string): string {
  const value = metadata[key];
  if (!value?.trim()) throw new Error(`Отсутствует обязательное поле истории: ${key}`);
  return value;
}

function sourceUrl(metadata: Record<string, string>, key: string): string {
  const value = metadataField(metadata, key);
  if (new URL(value).protocol !== 'https:') throw new Error(`Источник должен использовать HTTPS: ${key}`);
  return value;
}

function createRecord(id: ExhibitId, historyId: string, periodLabel: string, modelUrl: string, raw: string): ExhibitRecord {
  const history = parseHistory(raw);
  if (history.metadata['id'] !== historyId) throw new Error(`История не соответствует экспонату: ${id}`);
  metadataField(history.metadata, 'category');
  metadataField(history.metadata, 'designer');
  return {
    id,
    title: metadataField(history.metadata, 'title'),
    periodLabel,
    modelUrl,
    history,
    credits: {
      author: metadataField(history.metadata, 'model_author'),
      sourceUrl: sourceUrl(history.metadata, 'model_source'),
      licenseName: metadataField(history.metadata, 'model_license'),
      licenseUrl: sourceUrl(history.metadata, 'model_license_url'),
      modificationNote: history.metadata['model_modification_note'] ?? 'Файл из 3D-models сохранён. Изменения визуализации указываются при подготовке главы.',
    },
  };
}

/** The five canonical exhibits; the VM-002 AK-47 reference is not an extra exhibit. */
export const exhibits: readonly ExhibitRecord[] = Object.freeze([
  createRecord('mosin', 'mosin-1891-30', '1891 / 1930', mosinModel, mosinRaw),
  createRecord('ppsh', 'ppsh-41', '1940', ppshModel, ppshRaw),
  createRecord('sks', 'sks', '1949', sksModel, sksRaw),
  createRecord('pm', 'makarov-pm', '1951', pmModel, pmRaw),
  createRecord('akm', 'akm', '1959', akmModel, akmRaw),
]);
