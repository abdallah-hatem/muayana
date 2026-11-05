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

/**
 * The text of one issue (§5.5): site, #number, location, category, description, priority, photo
 * links. Lines with nothing to say are left out.
 */
export const buildIssueMessage = (
  issue: WhatsAppIssue,
  lang: Locale,
  options: WhatsAppOptions = {},
): string => {
  const w = WORDS[lang];
  const category = issue.category
    ? lang === 'en' && present(issue.category.nameEn)
      ? issue.category.nameEn
      : issue.category.nameAr
    : null;
  const links = photoLinks(issue, options.baseUrl);
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

/** One message for all of a worker's issues (§5.5 batch): a greeting, then each issue. */
export const buildBatchMessage = (
  issues: readonly WhatsAppIssue[],
  worker: { name: string },
  lang: Locale,
  options: WhatsAppOptions = {},
): string =>
  [
    WORDS[lang].greeting(worker.name, issues.length),
    ...issues.map((issue) => buildIssueMessage(issue, lang, options)),
  ].join('\n\n');

/** `https://wa.me/<digits>?text=<encoded>` — wa.me wants the number without `+` or spaces. */
export const waMeUrl = (phone: string, text: string): string =>
  `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
