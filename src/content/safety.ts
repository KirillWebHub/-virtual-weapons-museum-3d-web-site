import raw from '../../content/safety.md?raw';
import { parseHistory } from './history';
const entry = parseHistory(raw);
const field = (key: string): string => { const value = entry.metadata[key]; if (!value?.trim()) throw new Error(`Missing safety field: ${key}`); return value; };
const source = field('source_url'); if (new URL(source).protocol !== 'https:') throw new Error('Safety source must use HTTPS');
export const sharedSafety = Object.freeze({
  title: field('title'), lead: field('lead'), summary: field('summary'), source, sourceTitle: field('source_title'), checked: field('source_checked'),
  rules: Object.freeze([1, 2, 3].map(index => Object.freeze({ title: field(`rule_${index}_title`), text: field(`rule_${index}_text`) }))),
});
