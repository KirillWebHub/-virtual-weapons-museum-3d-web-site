import { parseDocument } from 'yaml';
import type { HistoryEntry } from './types';

/** Read flat YAML metadata and preserve the Markdown body, including footnotes. */
export function parseHistory(raw: string): HistoryEntry {
  const header = /^(?:\uFEFF)?---[\t ]*\r?\n([\s\S]*?)\r?\n---[\t ]*(?:\r?\n|$)/.exec(raw);
  if (!header || header[1] === undefined) {
    throw new Error('История должна начинаться с закрытого YAML-блока --- / ---.');
  }

  const document = parseDocument(header[1], { schema: 'failsafe', uniqueKeys: true });
  if (document.errors.length || document.warnings.length) {
    throw new Error('Некорректные YAML-метаданные истории.');
  }

  const value: unknown = document.toJS({ maxAliasCount: 0 });
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Метаданные истории должны быть словарём строк.');
  }

  const entries = Object.entries(value);
  if (entries.some(([, field]) => typeof field !== 'string')) {
    throw new Error('Каждое значение метаданных истории должно быть строкой.');
  }

  const metadata = Object.fromEntries(entries) as Record<string, string>;
  const bodyMarkdown = raw.slice(header[0].length);
  if (!bodyMarkdown.trim()) throw new Error('Исторический текст отсутствует.');
  return { metadata, bodyMarkdown };
}
