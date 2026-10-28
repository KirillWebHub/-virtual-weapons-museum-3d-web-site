export const EXHIBIT_IDS = ['mosin', 'ppsh', 'sks', 'pm', 'akm'] as const;
export type ExhibitId = (typeof EXHIBIT_IDS)[number];

export interface HistoryEntry {
  readonly metadata: Record<string, string>;
  readonly bodyMarkdown: string;
}

export interface ModelCredits {
  readonly author: string;
  readonly sourceUrl: string;
  readonly licenseName: string;
  readonly licenseUrl: string;
  readonly modificationNote: string;
}

export interface ExhibitRecord {
  readonly id: ExhibitId;
  readonly title: string;
  readonly periodLabel: string;
  readonly modelUrl: string;
  readonly history: HistoryEntry;
  readonly credits: ModelCredits;
}
