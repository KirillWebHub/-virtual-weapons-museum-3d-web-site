import type { ExhibitRecord } from '../content/types';
import { exhibitHref } from '../navigation/pages';
import { exhibitCovers as covers } from '../content/covers';
import './collection.css';
export function createCollection(records: readonly ExhibitRecord[]): HTMLElement {
  const section = document.createElement('section'); section.id = 'tour-start'; section.className = 'collection'; section.tabIndex = -1;
  section.setAttribute('aria-labelledby', 'collection-title');
  section.innerHTML = `<header class="collection-heading"><div><p class="collection-kicker">Музей / 5 экспонатов</p><h2 id="collection-title">Выберите<br>свою историю.</h2></div><p>История создания, внешний облик<br>и культура безопасности.</p></header><ol class="collection-grid"></ol>`;
  const list = section.querySelector('ol')!;
  records.forEach((record, index) => {
    const cover = covers[record.id], ready = record.id === 'mosin' || record.id === 'akm' || record.id === 'ppsh' || record.id === 'sks' || record.id === 'pm', item = document.createElement('li');
    item.className = 'collection-card'; item.dataset['exhibitId'] = record.id;
    const link = document.createElement('a'); link.className = 'collection-card-link'; link.href = exhibitHref(record.id);
    const meta = document.createElement('div'); meta.className = 'collection-card-meta';
    const number = document.createElement('span'); number.textContent = String(index + 1).padStart(2, '0');
    const year = document.createElement('span'); year.textContent = record.periodLabel; meta.append(number, year);
    const image = document.createElement('img'); image.src = cover.image; image.alt = ''; image.width = 960; image.height = 540; image.loading = 'lazy'; image.decoding = 'async';
    const body = document.createElement('div'); body.className = 'collection-card-body';
    const title = document.createElement('h3'); title.textContent = cover.title;
    const category = document.createElement('p'); category.textContent = record.history.metadata['category'] ?? '';
    const action = document.createElement('span'); action.className = 'collection-card-action'; action.textContent = ready ? 'Рассмотреть экспонат ↗' : 'Скоро в экспозиции ↗';
    body.append(title, category, action); link.append(meta, image, body);
    const credits = document.createElement('p'); credits.className = 'collection-card-credits'; credits.append('3D: ');
    const author = document.createElement('a'); author.href = record.credits.sourceUrl; author.textContent = record.credits.author;
    author.title = record.history.metadata['model_source_title'] ?? record.title;
    const license = document.createElement('a'); license.href = record.credits.licenseUrl; license.textContent = record.credits.licenseName;
    credits.append(author, ' · ', license); item.append(link, credits); list.append(item);
  });
  const note = document.createElement('p'); note.className = 'collection-render-note'; note.textContent = 'Изображения — рендеры 3D-моделей. Изменены ракурсы, масштаб и освещение.';
  const navigation = document.createElement('nav'); navigation.className = 'collection-education-links'; navigation.setAttribute('aria-label', 'Материалы музея');
  for (const [text, href] of [['Итоги экскурсии', '#museum-education'], ['Безопасность', '#museum-safety'], ['Источники и авторы', '#museum-sources']]) { const link = document.createElement('a'); link.textContent = text!; link.href = href!; navigation.append(link); }
  section.querySelector('header')!.after(navigation); section.append(note); return section;
}
