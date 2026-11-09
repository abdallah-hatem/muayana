import type { Locale, PhotoKind, Priority } from '../schemas/enums';

/** What the message needs from an issue (a subset of the contract `Issue`). */
export interface WhatsAppIssue {
  number: number;
  site: { name: string };
  location: string | null;
  category: { nameAr: string; nameEn: string | null } | null;
  description: string | null;
  priority: Priority;
  photos: readonly { kind: PhotoKind; url: string; sortOrder: number }[];
}

export interface WhatsAppOptions {
  /** Origin that turns a relative photo URL (`/uploads/…` in dev) into a link a worker can open. */
  baseUrl?: string;
  /**
   * False when the photos travel as files (the share sheet's caption): no photo links in the text.
   * Defaults to true (the wa.me fallback carries the links).
   */
  withPhotoLinks?: boolean;
  /** This message is one of several shares: a short `(1/3)` line comes first. */
  part?: { index: number; count: number };
  /** Issue numbers whose photo couldn't be attached: a closing line names them. */
  missingPhotos?: readonly number[];
}

export interface WhatsAppBatchOptions extends WhatsAppOptions {
  /** The whole batch's size for the greeting, when this message carries only part of it. */
  total?: number;
}

interface Words {
  site: string;
  issue: string;
  location: string;
  category: string;
  description: string;
  priority: string;
  photos: string;
  priorities: Record<Priority, string>;
  greeting: (name: string, count: number) => string;
  missing: (numbers: string) => string;
}

const WORDS: Record<Locale, Words> = {
  ar: {
    site: 'الموقع',
    issue: 'ملاحظة رقم',
    location: 'المكان',
    category: 'البند',
    description: 'الوصف',
    priority: 'الأولوية',
    photos: 'الصور',
    priorities: {
      low: 'منخفضة',
      normal: 'عادية',
      high: 'عالية',
      urgent: 'عاجلة',
    },
    greeting: (name, count) => `أهلاً ${name}، عندك ${count} ملاحظات:`,
    missing: (numbers) => `تعذّر إرفاق صورة من: ${numbers}`,
  },
  en: {
    site: 'Site',
    issue: 'Issue',
    location: 'Location',
    category: 'Category',
    description: 'Description',
    priority: 'Priority',
    photos: 'Photos',
    priorities: {
      low: 'Low',
      normal: 'Normal',
      high: 'High',
      urgent: 'Urgent',
    },
    greeting: (name, count) => `Hi ${name}, you have ${count} issues:`,
    missing: (numbers) => `A photo could not be attached for: ${numbers}`,
  },
};

const present = (value: string | null | undefined): value is string =>
  value !== null && value !== undefined && value.trim() !== '';

const absolute = (url: string, baseUrl: string | undefined): string =>
  baseUrl && url.startsWith('/') ? baseUrl.replace(/\/+$/, '') + url : url;

/** The before-photos (what the worker must fix), cover first. */
const photoLinks = (issue: WhatsAppIssue, baseUrl?: string): string[] =>
  issue.photos
    .filter((p) => p.kind === 'before')
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((p) => absolute(p.url, baseUrl));

/** Wraps a message in its share-part line (`(1/3)`) and its missing-photos line. */
const frame = (
  body: string,
  lang: Locale,
  { part, missingPhotos }: WhatsAppOptions,
): string =>
  [
    part && part.count > 1 ? `(${part.index}/${part.count})` : null,
    body,
    missingPhotos && missingPhotos.length > 0
      ? WORDS[lang].missing(
          [...new Set(missingPhotos)].map((n) => `#${n}`).join('، '),
        )
      : null,
  ]
    .filter((line): line is string => line !== null)
    .join('\n');

const issueBody = (
  issue: WhatsAppIssue,
  lang: Locale,
  options: WhatsAppOptions,
): string => {
  const w = WORDS[lang];
  const category = issue.category
    ? lang === 'en' && present(issue.category.nameEn)
      ? issue.category.nameEn
      : issue.category.nameAr
    : null;
  const links =
    options.withPhotoLinks === false ? [] : photoLinks(issue, options.baseUrl);
  const lines: (string | null)[] = [
    `${w.site}: ${issue.site.name}`,
    `${w.issue} #${issue.number}`,
    present(issue.location) ? `${w.location}: ${issue.location.trim()}` : null,
    category ? `${w.category}: ${category}` : null,
    present(issue.description)
      ? `${w.description}: ${issue.description.trim()}`
      : null,
    `${w.priority}: ${w.priorities[issue.priority]}`,
    links.length > 0 ? `${w.photos}:\n${links.join('\n')}` : null,
  ];
  return lines.filter((line): line is string => line !== null).join('\n');
};

/**
 * The text of one issue (§5.5): site, #number, location, category, description, priority, photo
 * links (unless the photos go as files). Lines with nothing to say are left out.
 */
export const buildIssueMessage = (
  issue: WhatsAppIssue,
  lang: Locale,
  options: WhatsAppOptions = {},
): string => frame(issueBody(issue, lang, options), lang, options);

/** One message for all of a worker's issues (§5.5 batch): a greeting, then each issue. */
export const buildBatchMessage = (
  issues: readonly WhatsAppIssue[],
  worker: { name: string },
  lang: Locale,
  options: WhatsAppBatchOptions = {},
): string =>
  frame(
    [
      WORDS[lang].greeting(worker.name, options.total ?? issues.length),
      ...issues.map((issue) => issueBody(issue, lang, options)),
    ].join('\n\n'),
    lang,
    options,
  );

/** `https://wa.me/<digits>?text=<encoded>` — wa.me wants the number without `+` or spaces. */
export const waMeUrl = (phone: string, text: string): string =>
  `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
