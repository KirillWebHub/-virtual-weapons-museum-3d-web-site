import type { ExhibitId } from '../content/types';
import type { ReferenceCard } from '../exhibits/akm-detailed';

/** Authored exhibition copy. HTML fields contain only local, reviewed markup. */
export interface ChapterContent {
  readonly id: ExhibitId;
  readonly name: string;
  readonly heading: string;
  readonly kicker: string;
  readonly intro: string;
  readonly catalogLabel: string;
  readonly assembled: string;
  readonly cards: readonly ReferenceCard[];
  readonly caption: string;
  readonly illustrationNote: string;
  readonly author: string;
  readonly sourceTitle: string;
  readonly source: string;
  readonly license: string;
  readonly terms: string;
  readonly termsLabel: string;
  readonly history: { readonly kicker: string; readonly title: string; readonly lead: string; readonly paragraphs: readonly string[]; readonly takeaway: string; readonly sourceLabel: string };
  readonly safety: { readonly title: string; readonly paragraphs: readonly string[] };
}
