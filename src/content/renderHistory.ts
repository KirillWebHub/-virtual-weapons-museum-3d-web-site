import type { HistoryEntry } from './types';

export function safeSourceUrl(value: string): string | undefined {
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : undefined; } catch { return undefined; }
}

/** The small Markdown subset used by the owned history files; raw HTML is always text. */
export function renderHistory(entry: HistoryEntry, prefix: string): HTMLElement {
  const article = document.createElement('div'); article.className = 'history-markdown';
  const footnotes = new Map<string, string>(), lines: string[] = [];
  for (const line of entry.bodyMarkdown.split('\n')) {
    const note = /^\[\^([^\]]+)\]:\s*(.*)$/.exec(line);
    if (note) footnotes.set(note[1]!, note[2]!); else lines.push(line);
  }
  function inline(parent: HTMLElement, text: string): void {
    const pattern = /\*\*([^*]+)\*\*|\[\^([^\]]+)\]|\[([^\]]+)\]\(([^)]+)\)/g;
    let start = 0;
    for (const match of text.matchAll(pattern)) {
      parent.append(document.createTextNode(text.slice(start, match.index)));
      if (match[1]) { const strong = document.createElement('strong'); strong.textContent = match[1]; parent.append(strong); }
      else if (match[2] && footnotes.has(match[2])) {
        const sup = document.createElement('sup'), link = document.createElement('a'); link.href = `#${prefix}-source-${match[2]}`; link.textContent = match[2]; link.setAttribute('aria-label', `Источник ${match[2]}`); sup.append(link); parent.append(sup);
      } else if (match[3] && match[4]) {
        const url = safeSourceUrl(match[4]);
        if (url) { const link = document.createElement('a'); link.href = url; link.textContent = match[3]; parent.append(link); }
        else parent.append(document.createTextNode(match[3]));
      } else parent.append(document.createTextNode(match[0]));
      start = match.index + match[0].length;
    }
    parent.append(document.createTextNode(text.slice(start)));
  }
  let paragraph: string[] = [], list: HTMLUListElement | undefined;
  const flush = (): void => { if (paragraph.length) { const p = document.createElement('p'); inline(p, paragraph.join(' ')); article.append(p); paragraph = []; } list = undefined; };
  for (const line of lines) {
    if (!line.trim()) { flush(); continue; }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flush(); if (heading[1]!.length === 1 || heading[2] === 'Источники') continue;
      const h = document.createElement(heading[1]!.length === 2 ? 'h3' : 'h4'); inline(h, heading[2]!); article.append(h); continue;
    }
    if (line.startsWith('- ')) {
      if (paragraph.length) flush();
      if (!list) { list = document.createElement('ul'); article.append(list); }
      const item = document.createElement('li'); inline(item, line.slice(2)); list.append(item);
    } else { if (list) flush(); paragraph.push(line.trim()); }
  }
  flush();
  const sourceTitle = document.createElement('h3'); sourceTitle.textContent = 'Источники'; sourceTitle.id = `${prefix}-sources`; sourceTitle.tabIndex = -1; article.append(sourceTitle);
  const sources = document.createElement('ol');
  for (const [id, value] of footnotes) { const li = document.createElement('li'); li.id = `${prefix}-source-${id}`; li.tabIndex = -1; inline(li, value); sources.append(li); }
  article.append(sources); return article;
}
