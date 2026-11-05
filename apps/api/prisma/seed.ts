import 'dotenv/config';
import { createHash } from 'node:crypto';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  type IssueStatus,
  type Priority,
  type Prisma,
} from '@prisma/client';
import sharp from 'sharp';
import { nameKey, normalizeEmail, PASSWORD_MIN_LENGTH } from '@muayana/shared';
import { hashPassword } from '../src/common/utils/password.util';
import {
  issuePhotoKey,
  resolveUploadDir,
} from '../src/common/utils/upload-dir.util';

/*
 * `npm run db:seed` (prisma db seed). Idempotent: run it as often as you like.
 * - The engineer from SEED_ENGINEER_EMAIL / SEED_ENGINEER_PASSWORD (created if missing; an
 *   existing account is left alone, so a password changed in the app is never overwritten).
 * - The 12 default categories (business §3), created if missing.
 * - SEED_ALLOW_SAMPLE=true (never in production): 3 sites (one archived), 8 workers, 40 issues
 *   in every status with history and placeholder photos. A sample site that already exists is
 *   skipped whole, so re-running never duplicates or rewrites anything.
 * No credential is written in this file.
 */

const env = process.env;

// ------------------------------------------------------------------ helpers

/** A stable UUID (v4-shaped) from a name, so sample rows keep their ids across runs. */
function sampleId(name: string): string {
  const h = createHash('sha1').update(`muayana-sample:${name}`).digest('hex');
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const DAY = 86_400_000;
const HOUR = 3_600_000;

/** Today (UTC midnight) shifted by `days`, for the date-only estimatedDate column. */
function dateOnly(days: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return new Date(d.getTime() + days * DAY);
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- categories

const CATEGORIES: { nameAr: string; nameEn: string; color: string }[] = [
  { nameAr: 'نقاشة', nameEn: 'Painting', color: '#E8590C' },
  { nameAr: 'كهرباء', nameEn: 'Electrical', color: '#FAB005' },
  { nameAr: 'سباكة', nameEn: 'Plumbing', color: '#1971C2' },
  { nameAr: 'محارة', nameEn: 'Plastering', color: '#A27B5C' },
  { nameAr: 'نجارة', nameEn: 'Carpentry', color: '#5C940D' },
  { nameAr: 'سيراميك', nameEn: 'Tiling', color: '#0CA678' },
  { nameAr: 'تكييف', nameEn: 'HVAC', color: '#15AABF' },
  { nameAr: 'ألوميتال', nameEn: 'Aluminium', color: '#868E96' },
  { nameAr: 'حدادة', nameEn: 'Metalwork', color: '#495057' },
  { nameAr: 'عزل', nameEn: 'Insulation', color: '#AE3EC9' },
  { nameAr: 'نظافة', nameEn: 'Cleaning', color: '#E64980' },
  { nameAr: 'أخرى', nameEn: 'Other', color: '#C92A2A' },
];

async function seedEngineer(db: PrismaClient): Promise<void> {
  const rawEmail = env.SEED_ENGINEER_EMAIL;
  const password = env.SEED_ENGINEER_PASSWORD;
  if (!rawEmail || !password)
    throw new Error(
      'Set SEED_ENGINEER_EMAIL and SEED_ENGINEER_PASSWORD (apps/api/.env) to seed the engineer',
    );
  if (password.length < PASSWORD_MIN_LENGTH)
    throw new Error(
      `SEED_ENGINEER_PASSWORD must be at least ${PASSWORD_MIN_LENGTH} characters`,
    );
  const email = normalizeEmail(rawEmail);
  if (await db.user.findUnique({ where: { email }, select: { id: true } })) {
    console.log(`Seed: engineer ${email} already exists (left unchanged)`);
    return;
  }
  await db.user.create({
    data: {
      email,
      name: env.SEED_ENGINEER_NAME || 'Engineer',
      passwordHash: await hashPassword(password),
      locale: 'ar',
    },
  });
  console.log(`Seed: created engineer ${email}`);
}

async function seedCategories(db: PrismaClient): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const [index, c] of CATEGORIES.entries()) {
    const row = await db.category.upsert({
      where: { nameKey: nameKey(c.nameAr) },
      create: { ...c, nameKey: nameKey(c.nameAr), sortOrder: index },
      update: {},
      select: { id: true },
    });
    ids.set(c.nameEn, row.id);
  }
  console.log(`Seed: ${CATEGORIES.length} categories present`);
  return ids;
}

// -------------------------------------------------------------------- sample

const WORKERS: {
  name: string;
  phone: string;
  categories: string[];
  active?: boolean;
  notes?: string;
}[] = [
  {
    name: 'عم سيد عبد الحميد',
    phone: '+201001234561',
    categories: ['Plastering', 'Painting'],
    notes: 'يفضّل الاتصال بعد العصر',
  },
  {
    name: 'محمود الكهربائي',
    phone: '+201112345672',
    categories: ['Electrical'],
  },
  {
    name: 'حسن النقاش',
    phone: '+201223456783',
    categories: ['Painting', 'Plastering'],
  },
  { name: 'كريم السباك', phone: '+201534567894', categories: ['Plumbing'] },
  {
    name: 'إبراهيم النجار',
    phone: '+201045678905',
    categories: ['Carpentry', 'Aluminium', 'Metalwork'],
  },
  { name: 'مصطفى السيراميك', phone: '+201156789016', categories: ['Tiling'] },
  {
    name: 'وليد التكييف',
    phone: '+201267890127',
    categories: ['HVAC', 'Electrical'],
  },
  {
    name: 'أشرف الحداد',
    phone: '+201578901238',
    categories: ['Metalwork', 'Aluminium'],
    active: false,
    notes: 'متوقف مؤقتاً',
  },
];

interface SampleIssue {
  status: IssueStatus;
  category?: string;
  /** Index into WORKERS; the worker has the category (business §3). */
  worker?: number;
  description?: string;
  location?: string;
  priority?: Priority;
  /** Days ago the photo was taken. */
  daysAgo: number;
  /** Estimated date relative to today (negative = in the past, overdue unless solved). */
  estimate?: number;
}

const SITE_A: SampleIssue[] = [
  { status: 'new', daysAgo: 0, location: 'الدور ٣ – شقة ٧' },
  { status: 'new', daysAgo: 0 },
  { status: 'new', daysAgo: 1, location: 'السلم الرئيسي' },
  { status: 'new', daysAgo: 1, description: 'صورة سريعة – تراجع لاحقاً' },
  {
    status: 'unassigned',
    category: 'Painting',
    description: 'تقشير دهان في حائط الصالة',
    location: 'الدور ٢ – شقة ٤',
    daysAgo: 2,
  },
  {
    status: 'unassigned',
    category: 'Electrical',
    description: 'مفتاح إضاءة مكسور في المطبخ',
    location: 'الدور ٥ – شقة ١٢',
    daysAgo: 3,
    priority: 'high',
  },
  {
    status: 'unassigned',
    category: 'Cleaning',
    description: 'بقايا مونة على أرضية المدخل',
    location: 'المدخل',
    daysAgo: 2,
    priority: 'low',
  },
  {
    status: 'assigned',
    category: 'Plastering',
    worker: 0,
    description: 'شرخ في الحائط بجوار الشباك',
    location: 'الدور ٣ – شقة ٧',
    daysAgo: 4,
  },
  {
    status: 'assigned',
    category: 'Plumbing',
    worker: 3,
    description: 'تسريب مياه تحت حوض الحمام',
    location: 'الدور ١ – شقة ٢',
    daysAgo: 3,
    priority: 'urgent',
  },
  {
    status: 'sent',
    category: 'Electrical',
    worker: 1,
    description: 'فيشة غير مثبتة في غرفة النوم',
    location: 'الدور ٤ – شقة ١٠',
    daysAgo: 6,
  },
  {
    status: 'sent',
    category: 'Tiling',
    worker: 5,
    description: 'بلاطة مكسورة في أرضية المطبخ',
    location: 'الدور ٢ – شقة ٥',
    daysAgo: 5,
  },
  {
    status: 'sent',
    category: 'Carpentry',
    worker: 4,
    description: 'باب الغرفة لا يقفل جيداً',
    location: 'الدور ٦ – شقة ١٤',
    daysAgo: 7,
    priority: 'low',
  },
  {
    status: 'estimated',
    category: 'Painting',
    worker: 2,
    description: 'بقع رطوبة في سقف الحمام',
    location: 'الدور ٣ – شقة ٨',
    daysAgo: 10,
    estimate: -3,
    priority: 'high',
  },
  {
    status: 'estimated',
    category: 'HVAC',
    worker: 6,
    description: 'تكييف الصالة لا يبرّد',
    location: 'الدور ٥ – شقة ١١',
    daysAgo: 8,
    estimate: 4,
  },
  {
    status: 'estimated',
    category: 'Plastering',
    worker: 0,
    description: 'طوب مكسور في السور الخارجي',
    location: 'السور الخارجي',
    daysAgo: 9,
    estimate: 2,
  },
  {
    status: 'in_progress',
    category: 'Plumbing',
    worker: 3,
    description: 'ضعف ضغط المياه في الدور الأخير',
    location: 'الدور ٧',
    daysAgo: 12,
    estimate: -1,
    priority: 'urgent',
  },
  {
    status: 'in_progress',
    category: 'Electrical',
    worker: 1,
    description: 'إضاءة السلم لا تعمل',
    location: 'السلم الرئيسي',
    daysAgo: 11,
    estimate: 1,
  },
  {
    status: 'in_progress',
    category: 'Aluminium',
    worker: 4,
    description: 'شباك ألوميتال لا ينزلق',
    location: 'الدور ٤ – شقة ٩',
    daysAgo: 14,
  },
  {
    status: 'solved',
    category: 'Painting',
    worker: 2,
    description: 'خدوش في دهان الممر',
    location: 'الدور ١ – الممر',
    daysAgo: 20,
    estimate: -12,
  },
  {
    status: 'solved',
    category: 'Tiling',
    worker: 5,
    description: 'فواصل سيراميك مفتوحة في الحمام',
    location: 'الدور ٢ – شقة ٣',
    daysAgo: 18,
    estimate: -10,
  },
  {
    status: 'solved',
    category: 'Electrical',
    worker: 1,
    description: 'لوحة كهرباء بدون غطاء',
    location: 'غرفة الكهرباء',
    daysAgo: 16,
    priority: 'urgent',
  },
  {
    status: 'cancelled',
    category: 'Other',
    description: 'مكررة – نفس ملاحظة الشرخ بالدور الثالث',
    location: 'الدور ٣',
    daysAgo: 4,
  },
];

const SITE_B: SampleIssue[] = [
  { status: 'new', daysAgo: 0, location: 'الحديقة' },
  { status: 'new', daysAgo: 2 },
  {
    status: 'unassigned',
    category: 'Insulation',
    description: 'تسريب من عزل السطح بعد المطر',
    location: 'السطح',
    daysAgo: 3,
    priority: 'high',
  },
  {
    status: 'assigned',
    category: 'Metalwork',
    worker: 4,
    description: 'درابزين السلم الخارجي مرتخٍ',
    location: 'السلم الخارجي',
    daysAgo: 4,
  },
  {
    status: 'sent',
    category: 'Painting',
    worker: 0,
    description: 'دهان الواجهة متفاوت اللون',
    location: 'الواجهة الأمامية',
    daysAgo: 6,
  },
  {
    status: 'estimated',
    category: 'Plumbing',
    worker: 3,
    description: 'صرف المطبخ بطيء',
    location: 'المطبخ',
    daysAgo: 9,
    estimate: -5,
  },
  {
    status: 'estimated',
    category: 'Carpentry',
    worker: 4,
    description: 'دولاب غرفة النوم الرئيسية غير مستوٍ',
    location: 'غرفة النوم الرئيسية',
    daysAgo: 7,
    estimate: 6,
  },
  {
    status: 'in_progress',
    category: 'HVAC',
    worker: 6,
    description: 'ماسورة صرف التكييف تنقط على البلكونة',
    location: 'البلكونة',
    daysAgo: 10,
    estimate: -2,
  },
  {
    status: 'in_progress',
    category: 'Plastering',
    worker: 2,
    description: 'محارة غير مستوية في حائط السلم',
    location: 'السلم الداخلي',
    daysAgo: 8,
    estimate: 3,
  },
  {
    status: 'solved',
    category: 'Electrical',
    worker: 1,
    description: 'جرس الباب لا يعمل',
    location: 'المدخل',
    daysAgo: 15,
  },
  {
    status: 'solved',
    category: 'Painting',
    worker: 0,
    description: 'آثار دهان على زجاج الشبابيك',
    location: 'الدور الأرضي',
    daysAgo: 13,
    priority: 'low',
  },
  {
    status: 'cancelled',
    category: 'Tiling',
    description: 'ليست مشكلة – اللون مطابق للعينة',
    location: 'الحمام',
    daysAgo: 5,
  },
];

const SITE_C: SampleIssue[] = [
  {
    status: 'solved',
    category: 'Painting',
    worker: 2,
    description: 'إعادة دهان واجهة المحل رقم ٤',
    location: 'محل ٤',
    daysAgo: 60,
  },
  {
    status: 'solved',
    category: 'Electrical',
    worker: 1,
    description: 'إضاءة الممر التجاري تومض',
    location: 'الممر التجاري',
    daysAgo: 55,
  },
  {
    status: 'solved',
    category: 'Plumbing',
    worker: 3,
    description: 'تسريب في دورة مياه الزوار',
    location: 'دورة المياه',
    daysAgo: 50,
  },
  {
    status: 'solved',
    category: 'Aluminium',
    worker: 7,
    description: 'باب ألوميتال المدخل يحتك بالأرض',
    location: 'المدخل الرئيسي',
    daysAgo: 48,
  },
  {
    status: 'cancelled',
    category: 'Other',
    description: 'تم نقلها لمقاول الموقع',
    location: 'الجراج',
    daysAgo: 45,
  },
  {
    status: 'in_progress',
    category: 'Metalwork',
    worker: 7,
    description: 'باب الطوارئ لا يغلق تلقائياً',
    location: 'مخرج الطوارئ',
    daysAgo: 40,
    estimate: -30,
    priority: 'high',
  },
];

const SITES = [
  {
    key: 'site-a',
    name: 'برج النخيل – التجمع الخامس',
    address: 'التجمع الخامس، القاهرة الجديدة',
    notes: 'مقاول عام: شركة البنيان',
    archived: false,
    issues: SITE_A,
  },
  {
    key: 'site-b',
    name: 'فيلا الشيخ زايد ١٢',
    address: 'الحي ١٢، الشيخ زايد، الجيزة',
    notes: null,
    archived: false,
    issues: SITE_B,
  },
  {
    key: 'site-c',
    name: 'مول الواحة – أكتوبر',
    address: '٦ أكتوبر، الجيزة',
    notes: 'تم التسليم',
    archived: true,
    issues: SITE_C,
  },
];

/** The moves from `new` to the issue's status (business §4), forward steps only. */
function pathTo(issue: SampleIssue): IssueStatus[] {
  const estimated = issue.estimate !== undefined;
  switch (issue.status) {
    case 'new':
      return ['new'];
    case 'unassigned':
      return ['new', 'unassigned'];
    case 'assigned':
      return ['new', 'unassigned', 'assigned'];
    case 'sent':
      return ['new', 'assigned', 'sent'];
    case 'estimated':
      return ['new', 'assigned', 'sent', 'estimated'];
    case 'in_progress':
      return estimated
        ? ['new', 'assigned', 'sent', 'estimated', 'in_progress']
        : ['new', 'assigned', 'sent', 'in_progress'];
    case 'solved':
      return estimated
        ? ['new', 'assigned', 'sent', 'estimated', 'in_progress', 'solved']
        : ['new', 'assigned', 'sent', 'in_progress', 'solved'];
    case 'cancelled':
      return ['new', 'unassigned', 'cancelled'];
  }
}

const PHOTO_SIZE = { width: 800, height: 600 };

/** A small placeholder JPEG: the category colour with the issue number stencilled on. */
async function writePlaceholder(
  file: string,
  color: string,
  label: string,
): Promise<void> {
  if (await exists(file)) return;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PHOTO_SIZE.width}" height="${PHOTO_SIZE.height}">
    <rect width="100%" height="100%" fill="${color}"/>
    <rect y="500" width="100%" height="100" fill="#15171B" opacity="0.6"/>
    <text x="40" y="572" font-family="monospace" font-size="56" font-weight="700" fill="#F4F1EA">${label}</text>
  </svg>`;
  await mkdir(dirname(file), { recursive: true });
  await writeFile(
    file,
    await sharp(Buffer.from(svg)).jpeg({ quality: 70 }).toBuffer(),
  );
}

async function seedWorkers(
  db: PrismaClient,
  categoryIds: Map<string, string>,
): Promise<string[]> {
  const ids: string[] = [];
  for (const w of WORKERS) {
    const row = await db.worker.upsert({
      where: { phone: w.phone },
      create: {
        name: w.name,
        phone: w.phone,
        notes: w.notes,
        active: w.active ?? true,
        categories: {
          create: w.categories.map((c) => ({
            categoryId: categoryIds.get(c)!,
          })),
        },
      },
      update: {},
      select: { id: true },
    });
    ids.push(row.id);
  }
  console.log(`Seed: ${WORKERS.length} sample workers present`);
  return ids;
}

async function seedSample(
  db: PrismaClient,
  categoryIds: Map<string, string>,
): Promise<void> {
  const uploadDir = resolveUploadDir(env.UPLOAD_DIR || 'uploads');
  const baseUrl = (
    env.PUBLIC_UPLOAD_BASE_URL || 'http://localhost:3101/uploads'
  ).replace(/\/+$/, '');
  const workerIds = await seedWorkers(db, categoryIds);

  for (const site of SITES) {
    const siteId = sampleId(site.key);
    const existing = await db.site.findUnique({
      where: { id: siteId },
      select: { id: true },
    });
    if (existing) {
      console.log(`Seed: sample site "${site.name}" exists (skipped)`);
      continue;
    }

    await db.$transaction(async (tx) => {
      await tx.site.create({
        data: {
          id: siteId,
          name: site.name,
          nameKey: nameKey(site.name),
          address: site.address,
          notes: site.notes,
          archived: site.archived,
          nextNumber: site.issues.length + 1,
        },
      });

      for (const [index, issue] of site.issues.entries()) {
        const number = index + 1;
        const id = sampleId(`${site.key}-issue-${number}`);
        const capturedAt = new Date(
          Date.now() - issue.daysAgo * DAY - ((index % 5) + 1) * HOUR,
        );
        const path = pathTo(issue);
        // Each move a few hours after the previous one, never in the future.
        const stepMs = Math.min(
          6 * HOUR,
          (Date.now() - capturedAt.getTime()) / (path.length + 1),
        );
        const at = (step: number) =>
          new Date(capturedAt.getTime() + step * stepMs);
        const reached = (s: IssueStatus) => {
          const step = path.indexOf(s);
          return step < 0 ? null : at(step);
        };

        const data: Prisma.IssueUncheckedCreateInput = {
          id,
          siteId,
          number,
          status: issue.status,
          priority: issue.priority ?? 'normal',
          description: issue.description ?? null,
          location: issue.location ?? null,
          categoryId: issue.category ? categoryIds.get(issue.category)! : null,
          workerId: issue.worker === undefined ? null : workerIds[issue.worker],
          estimatedDate:
            issue.estimate === undefined ? null : dateOnly(issue.estimate),
          capturedAt,
          assignedAt: reached('assigned'),
          sentAt: reached('sent'),
          solvedAt: reached('solved'),
          createdAt: capturedAt,
        };
        await tx.issue.create({ data });

        await tx.statusChange.createMany({
          data: path.map((to, step) => ({
            issueId: id,
            from: step === 0 ? null : path[step - 1],
            to,
            note: to === 'cancelled' ? (issue.description ?? null) : null,
            createdAt: at(step),
          })),
        });

        const photos: { kind: 'before' | 'after'; sortOrder: number }[] = [
          { kind: 'before', sortOrder: 0 },
        ];
        if (number % 3 === 0) photos.push({ kind: 'before', sortOrder: 1 });
        if (issue.status === 'solved')
          photos.push({ kind: 'after', sortOrder: 0 });

        for (const p of photos) {
          const photoId = sampleId(
            `${site.key}-issue-${number}-${p.kind}-${p.sortOrder}`,
          );
          const key = issuePhotoKey(id, photoId);
          await tx.photo.create({
            data: {
              id: photoId,
              issueId: id,
              kind: p.kind,
              storageKey: key,
              url: `${baseUrl}/${key}`,
              ...PHOTO_SIZE,
              sortOrder: p.sortOrder,
              createdAt:
                p.kind === 'after'
                  ? (reached('solved') ?? capturedAt)
                  : capturedAt,
            },
          });
        }
      }
    });
    console.log(
      `Seed: sample site "${site.name}" with ${site.issues.length} issues`,
    );
  }

  await ensurePlaceholderFiles(
    db,
    SITES.map((site) => sampleId(site.key)),
    uploadDir,
  );
}

/** Writes any missing placeholder file of the sample sites' photos (also repairs a wiped folder). */
async function ensurePlaceholderFiles(
  db: PrismaClient,
  siteIds: string[],
  uploadDir: string,
): Promise<void> {
  const photos = await db.photo.findMany({
    where: { issue: { siteId: { in: siteIds } } },
    select: {
      storageKey: true,
      kind: true,
      issue: {
        select: { number: true, category: { select: { color: true } } },
      },
    },
  });
  for (const p of photos) {
    await writePlaceholder(
      join(uploadDir, p.storageKey),
      p.kind === 'after' ? '#2F9E44' : (p.issue.category?.color ?? '#8A8578'),
      `#${p.issue.number}${p.kind === 'after' ? ' OK' : ''}`,
    );
  }
  console.log(
    `Seed: ${photos.length} placeholder photos present in ${uploadDir}`,
  );
}

// ---------------------------------------------------------------------- main

async function main(): Promise<void> {
  if (!env.DATABASE_URL) throw new Error('Set DATABASE_URL');
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
  });
  try {
    await seedEngineer(db);
    const categoryIds = await seedCategories(db);
    if (env.SEED_ALLOW_SAMPLE === 'true') {
      if (env.NODE_ENV === 'production')
        throw new Error(
          'SEED_ALLOW_SAMPLE is refused with NODE_ENV=production',
        );
      await seedSample(db, categoryIds);
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
