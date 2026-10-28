import type { ExhibitId, ExhibitRecord } from './types';
export interface ContentSource { readonly title: string; readonly publisher: string; readonly url: string; readonly role: 'history' | 'safety' }
/** Separate asset credits from historical authority, using the existing authored footnotes. */
export function historicalSources(record: ExhibitRecord): readonly ContentSource[] {
  const result: ContentSource[] = [];
  for (const line of record.history.bodyMarkdown.split('\n')) {
    const note = /^\[\^[^\]]+\]:\s*(.*)$/.exec(line)?.[1]; if (!note || note.includes(record.credits.sourceUrl)) continue;
    for (const match of note.matchAll(/\[([^\]]+)\]\((https:\/\/[^)]+)\)/g)) {
      const url = match[2]!, host = new URL(url).hostname;
      if (host === 'sketchfab.com' || host === 'creativecommons.org') continue;
      result.push({ title: match[1]!, publisher: note.slice(0, note.indexOf('[')).trim().replace(/\.\s*$/, ''), url, role: host.endsWith('mchs.gov.ru') ? 'safety' : 'history' });
    }
  }
  return result;
}
export const rightsChecked = '2026-10-28';
export const modelConditions: Record<ExhibitId, { readonly noAI: boolean; readonly textures: string; readonly attributionNote?: string }> = {
  mosin: { noAI: false, textures: 'В подключённом GLB — 6 изображений 1024×1024. На этом этапе размеры не менялись.' },
  ppsh: { noAI: false, textures: 'В подключённом GLB — 3 изображения 1024×1024. На этом этапе размеры не менялись.' },
  sks: { noAI: true, textures: 'Используется предоставленная облегчённая версия: 3 изображения 1024×1024. На этом этапе размеры не менялись.', attributionNote: 'В исходном GLB указан Mateusz Woliński / jeandiz. Текущая карточка публикации отображает имя SpatialNeglect.' },
  pm: { noAI: false, textures: 'В подключённом GLB — 9 изображений 1024×1024. Автор описывает текстуры пистолета 2048×2048: в используемой веб-версии их размер уменьшен. На этом этапе повторного изменения не было.' },
  akm: { noAI: false, textures: 'В подключённом GLB — 6 изображений 1024×1024. На этом этапе размеры не менялись.' },
};
export const akTermsSource: ContentSource = {
  title: 'Автомат Калашникова · АКС-74У', publisher: 'Тульский государственный музей оружия', url: 'https://heroes.museum-arms.ru/aks.html', role: 'history',
};
export const noAISource = 'https://sketchfab.com/terms';
export const decorationCredits = [
  { title: 'Shooting Range Target', author: 'AJ / ArneJans', source: 'https://sketchfab.com/3d-models/shooting-range-target-bdc995c9e3c8494fbffb7f5758a8567a', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', note: 'Авторство и лицензия — из встроенных метаданных предоставленного GLB. Исходный файл сохранён. Изменены ракурс, масштаб и положение при показе. Мишень — декоративный элемент финала, не дополнительный экспонат. Пули — стилизованные внешние формы без точного масштаба; физическая баллистика не моделируется.' },
  { title: 'DISPLAY CASE LOW POLY', author: 'THEAPPXR', source: 'https://sketchfab.com/3d-models/display-case-low-poly-f49a07c15ff44f4fa3cec3b1e4cd5d14', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', note: 'Исходный GLB сохранён. Изменены материалы, пропорции и расположение; добавлены силуэты экспонатов.' },
  { title: 'Münze der Sowjetunion (1946)', author: 'Igor Denisov / Digor', source: 'https://sketchfab.com/3d-models/munze-der-sowjetunion-1946-9070bd76ed0d482981f10fade794952c', license: 'CC BY-NC-ND 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-nc-nd/4.0/', note: 'Учебное некоммерческое использование. GLB, геометрия, материалы и текстуры сохранены без изменений; применяются преобразования показа и освещение.' },
] as const;
