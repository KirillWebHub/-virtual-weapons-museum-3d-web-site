import type { ExhibitRecord } from '../content/types';
import { historicalSources, modelConditions, rightsChecked, akTermsSource, decorationCredits, noAISource } from '../content/sources';
import { sharedSafety } from '../content/safety';
import { exhibitHref } from '../navigation/pages';
import './education.css';

function link(text: string, href: string): HTMLAnchorElement { const node = document.createElement('a'); node.textContent = text; node.href = href; return node; }
function paragraph(text: string, className?: string): HTMLParagraphElement { const node = document.createElement('p'); node.textContent = text; if (className) node.className = className; return node; }
function section(id: string, kicker: string, title: string): HTMLElement {
  const node = document.createElement('section'); node.id = id; node.className = `education-section ${id}`; node.tabIndex = -1; node.setAttribute('aria-labelledby', `${id}-title`);
  const header = document.createElement('header'), heading = document.createElement('h2'); heading.id = `${id}-title`; heading.textContent = title; header.append(paragraph(kicker, 'education-kicker'), heading); node.append(header); return node;
}
function disclosure(title: string, className: string): HTMLDetailsElement { const node = document.createElement('details'), summary = document.createElement('summary'); node.className = className; summary.textContent = title; node.append(summary); return node; }

export function createEducationSections(records: readonly ExhibitRecord[]): readonly HTMLElement[] {
  const education = section('museum-education', 'После экскурсии', 'Увидеть. Назвать. Понять.');
  education.append(paragraph('Для первого знакомства с историей и внешним устройством. Пять образцов — авторская подборка Митичкина Кирилла Александровича для цифровой экспозиции.', 'education-lead'));
  const outcomes = document.createElement('ol'); outcomes.className = 'education-outcomes';
  for (const [index, [title, text, href, action]] of [
    ['Читать историю.', 'Год принятия модели, её модернизация и дата отдельного музейного предмета могут различаться. В главе Мосина это 1891, 1930 и 1942 годы.', './mosin.html#mosin-history', 'Вернуться к примеру Мосина ↗'],
    ['Называть видимое.', 'Сопоставляйте силуэт с названием: Мосин, ППШ-41, СКС, ПМ или АКМ. Приклад, цевьё и магазин помогают описать внешний облик. Номер цифровой группы не равен физической детали; описательная подпись сообщает только о форме.', './akm.html#akm-display', 'Рассмотреть подписи АКМ ↗'],
    ['Понимать границы.', 'Разнесение служит осмотру модели. Оно не задаёт порядок реальной разборки, а просмотр не подтверждает практический навык обращения с оружием.', '#museum-safety', 'Перейти к безопасности ↓'],
  ].entries()) {
    const item = document.createElement('li'), heading = document.createElement('h3'); heading.textContent = title!; item.append(paragraph(String(index + 1).padStart(2, '0'), 'education-number'), heading, paragraph(text!), link(action!, href!)); outcomes.append(item);
  }
  education.append(outcomes, paragraph('Подборка не представлена как перечень образцов, изученных на занятиях. Практическое обучение и требования преподавателя остаются отдельной частью подготовки.', 'education-scope'));

  const safety = section('museum-safety', 'Культура безопасности', sharedSafety.title); safety.append(paragraph(sharedSafety.lead, 'education-lead'));
  const rules = document.createElement('ol'); rules.className = 'education-safety-rules';
  for (const [index, rule] of sharedSafety.rules.entries()) { const item = document.createElement('li'), title = document.createElement('h3'); title.textContent = rule.title; item.append(paragraph(String(index + 1).padStart(2, '0'), 'education-number'), title, paragraph(rule.text)); rules.append(item); }
  safety.append(rules, link(`${sharedSafety.sourceTitle} ↗`, sharedSafety.source), paragraph('Памятка относится к подозрительной находке вне музея. Не определяйте состояние реального предмета по сходству с цифровой иллюстрацией.', 'education-scope'));

  const sources = section('museum-sources', 'Материалы экспозиции', 'У каждой истории есть источник.');
  sources.append(paragraph('Музейные публикации и официальные материалы служат основанием исторических текстов. Карточки 3D-моделей подтверждают происхождение иллюстраций и условия использования.', 'education-lead'));
  const group = document.createElement('div'); group.className = 'education-source-groups';
  for (const record of records) {
    const details = disclosure(record.id === 'mosin' ? 'Винтовка Мосина' : record.title, 'education-source-group'); details.id = `museum-source-${record.id}`;
    const list = document.createElement('ul');
    for (const source of historicalSources(record)) { const item = document.createElement('li'); item.append(paragraph(source.role === 'safety' ? 'Безопасность' : source.publisher, 'education-source-publisher'), link(source.title, source.url)); list.append(item); }
    if (record.id === 'akm') { const item = document.createElement('li'); item.append(paragraph(akTermsSource.publisher, 'education-source-publisher'), link(akTermsSource.title, akTermsSource.url), paragraph('Справочные названия элементов семейства АК. Статья посвящена АКС-74У; историю АКМ подтверждают источники выше.')); list.append(item); }
    details.append(list, link('История и сноски в главе ↗', `${exhibitHref(record.id)}#${record.id}-history`)); group.append(details);
  }
  sources.append(group, link('Основание общей памятки: МЧС России ↗', sharedSafety.source));

  const models = disclosure('Авторы 3D-моделей и условия использования', 'education-asset-credits'); models.id = 'museum-models';
  models.append(paragraph('Файлы оружия сохранены в предоставленном виде. Отмечены изменения представления, предварительное облегчение и размеры текстур. Изображения карточек — рендеры этих моделей; музейные фотографии не включены в оформление.', 'education-scope'));
  const assets = document.createElement('ul'); assets.className = 'education-assets';
  for (const record of records) {
    const item = document.createElement('li'), heading = document.createElement('h3'), condition = modelConditions[record.id]; item.id = `museum-model-${record.id}`;
    heading.textContent = record.history.metadata['model_source_title'] ?? record.title;
    item.append(heading, link(record.credits.author, record.credits.sourceUrl), document.createTextNode(' · '), link(record.credits.licenseName, record.credits.licenseUrl), paragraph(record.credits.modificationNote), paragraph(condition.textures));
    if (condition.attributionNote) item.append(paragraph(condition.attributionNote));
    if (condition.noAI) item.append(paragraph('Отметка NoAI: не передавать модель и её изображения в генеративные инструменты.'), link('Условия Sketchfab, раздел 15(a) ↗', noAISource));
    assets.append(item);
  }
  models.append(assets, paragraph(`Условия публикаций проверены ${rightsChecked}. Авторство и лицензии подтверждены публичными метаданными Sketchfab.`, 'education-scope')); sources.append(models);
  const decorations = disclosure('Витрины, монета, мишень и шрифты', 'education-asset-credits'); decorations.id = 'museum-decoration-credits';
  for (const asset of decorationCredits) { const item = document.createElement('div'); item.className = 'education-decoration'; item.append(link(`${asset.author} — ${asset.title}`, asset.source), document.createTextNode(' · '), link(asset.license, asset.licenseUrl), paragraph(asset.note)); decorations.append(item); }
  const fonts = paragraph('Локальные шрифты: ');
  for (const [index, [name, url]] of [['Lozung Caps — Artem Waves', './licenses/lozung-caps.txt'], ['Morfin Sans — KFproduction', './licenses/morfin-sans.txt'], ['Oswald — OFL', './licenses/oswald-OFL.txt'], ['Golos Text — OFL', './licenses/golos-text-OFL.txt']].entries()) { if (index) fonts.append(' · '); fonts.append(link(name!, url!)); }
  decorations.append(fonts, paragraph('Условия Lozung Caps и Morfin Sans сохранены из авторских readme. OFL относится к Oswald и Golos Text. Атрибуция не означает одобрение проекта авторами материалов.')); sources.append(decorations);
  const footer = document.createElement('footer'); footer.className = 'education-footer'; footer.append(paragraph('Виртуальный музей · Трек 03'), link('К экспонатам ↑', '#tour-start')); sources.append(footer);
  return [education, safety, sources];
}
