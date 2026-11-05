import type { IssueStatus, Locale } from '@muayana/shared';

/**
 * Text for the dev-only /design preview: section titles and mock data, in both languages so
 * the LTR/RTL toggle shows real copy. Real screens take their strings from messages/.
 */
type Bilingual = Record<Locale, string>;

export const SECTION: Record<string, Bilingual> = {
  title: { ar: 'نظام التصميم — شريط الموقع', en: 'Design system — Site tape' },
  intro: {
    ar: 'معاينة للمطوّرين فقط: الألوان، الخطوط، حالات الملاحظات، الأزرار، ونماذج الشاشات.',
    en: 'Developer-only preview: palette, type, issue statuses, buttons and mock screens.',
  },
  palette: { ar: 'الألوان', en: 'Palette' },
  type: { ar: 'مقاسات الخط', en: 'Type scale' },
  statuses: { ar: 'حالات الملاحظة', en: 'Issue statuses' },
  buttons: { ar: 'الأزرار', en: 'Buttons' },
  fields: { ar: 'الحقول', en: 'Fields' },
  card: { ar: 'بطاقة ملاحظة', en: 'Issue card' },
  inbox: { ar: 'شاشة الفرز (الهاتف)', en: 'Sort inbox (phone)' },
  theme: { ar: 'المظهر', en: 'Theme' },
  direction: { ar: 'الاتجاه', en: 'Direction' },
  hazard: { ar: 'شريط التحذير', en: 'Hazard stripe' },
};

export const TYPE_SAMPLES: {
  utility: string;
  label: string;
  text: Bilingual;
}[] = [
  {
    utility: 'type-display',
    label: 'display 32/800',
    text: { ar: '١٢ ملاحظة مفتوحة', en: '12 open issues' },
  },
  {
    utility: 'type-title',
    label: 'title 22/700',
    text: { ar: 'برج النخيل — الدور الثالث', en: 'Palm Tower — 3rd floor' },
  },
  {
    utility: 'type-heading',
    label: 'heading 18/700',
    text: {
      ar: 'شرخ في المحارة بجوار الشباك',
      en: 'Plaster crack beside the window',
    },
  },
  {
    utility: 'type-body',
    label: 'body 16/400',
    text: {
      ar: 'الشرخ طوله حوالي ٤٠ سم ويحتاج معالجة قبل الدهان.',
      en: 'The crack is about 40 cm long and needs treating before painting.',
    },
  },
  {
    utility: 'type-small',
    label: 'small 14/500',
    text: { ar: 'التقطت منذ ٣ ساعات', en: 'Captured 3 hours ago' },
  },
  {
    utility: 'type-micro',
    label: 'micro 12/600',
    text: { ar: 'آخر تحديث', en: 'LAST UPDATED' },
  },
];

export const STENCIL_SAMPLE = {
  label: 'mono / stencil',
  text: '#14 · 2026-11-03 · +20 101 234 5678',
};

/** Token swatches: CSS variable + the matching Tailwind classes. */
export const SWATCHES: { name: string; fill: string; text: string }[] = [
  { name: 'background', fill: 'bg-background', text: 'text-foreground' },
  { name: 'card', fill: 'bg-card', text: 'text-card-foreground' },
  { name: 'muted', fill: 'bg-muted', text: 'text-muted-foreground' },
  {
    name: 'secondary',
    fill: 'bg-secondary',
    text: 'text-secondary-foreground',
  },
  { name: 'primary', fill: 'bg-primary', text: 'text-primary-foreground' },
  { name: 'accent', fill: 'bg-accent', text: 'text-accent-foreground' },
  {
    name: 'destructive',
    fill: 'bg-destructive',
    text: 'text-destructive-foreground',
  },
  { name: 'success', fill: 'bg-success', text: 'text-success-foreground' },
  { name: 'info', fill: 'bg-info', text: 'text-info-foreground' },
  { name: 'foreground', fill: 'bg-foreground', text: 'text-background' },
];

export const MOCK_ISSUE: {
  number: number;
  status: IssueStatus;
  overdue: boolean;
  photos: number;
  site: Bilingual;
  location: Bilingual;
  description: Bilingual;
  category: Bilingual;
  categoryColor: string;
  worker: Bilingual;
  phone: string;
  estimatedDate: string;
} = {
  number: 14,
  status: 'estimated',
  overdue: true,
  photos: 3,
  site: { ar: 'برج النخيل', en: 'Palm Tower' },
  location: {
    ar: 'الدور ٣ — شقة ٣٠٢ — المطبخ',
    en: 'Floor 3 — Apt 302 — Kitchen',
  },
  description: {
    ar: 'تسريب مياه أسفل حوض المطبخ، والخشب بدأ ينتفخ.',
    en: 'Water leaking under the kitchen sink; the cabinet wood is swelling.',
  },
  category: { ar: 'سباكة', en: 'Plumbing' },
  categoryColor: '#1E6FD9',
  worker: { ar: 'محمود عبد الله', en: 'Mahmoud Abdallah' },
  phone: '+20 101 234 5678',
  estimatedDate: '2026-11-03',
};

export const MOCK_CATEGORIES: { name: Bilingual; color: string }[] = [
  { name: { ar: 'نقاشة', en: 'Painting' }, color: '#E0A100' },
  { name: { ar: 'كهرباء', en: 'Electrical' }, color: '#D9480F' },
  { name: { ar: 'سباكة', en: 'Plumbing' }, color: '#1E6FD9' },
  { name: { ar: 'محارة', en: 'Plastering' }, color: '#868E96' },
  { name: { ar: 'نجارة', en: 'Carpentry' }, color: '#8B5A2B' },
  { name: { ar: 'سيراميك', en: 'Tiling' }, color: '#0CA678' },
];

export const MOCK_INBOX = {
  left: 12,
  site: { ar: 'برج النخيل', en: 'Palm Tower' },
  captured: { ar: 'التقطت ١٠:٤٢ ص', en: 'Captured 10:42 AM' },
  descriptionPlaceholder: {
    ar: 'مثال: شرخ في المحارة بجوار الشباك',
    en: 'e.g. Plaster crack beside the window',
  },
  locationValue: { ar: 'الدور ٣ — الممر', en: 'Floor 3 — Corridor' },
  workerValue: { ar: 'اختر عاملاً (سباكة)', en: 'Choose a worker (plumbing)' },
};
