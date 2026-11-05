import { z } from 'zod';

/** An optional variable: unset and empty both mean "not configured". */
const optionalString = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().min(1).optional(),
);

/**
 * Every environment variable the API reads. Validated once by ConfigModule at boot:
 * a missing or malformed value stops the process before it serves a request.
 */
export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3101),
    DATABASE_URL: z
      .string()
      .regex(/^postgres(ql)?:\/\//, 'must be a postgres:// connection string'),
    JWT_SECRET: z.string().min(32, 'must be at least 32 characters'),
    CORS_ORIGINS: z
      .string()
      .min(1)
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      )
      .pipe(z.array(z.url()).min(1)),
    /** Where photos go: local disk (dev/test) or Vercel Blob (deployed). */
    STORAGE_DRIVER: z.enum(['local', 'blob']).default('local'),
    /** Local driver: folder photos are written to (relative to apps/api). */
    UPLOAD_DIR: z.string().min(1).default('uploads'),
    /** Local driver: public base URL the files are served from (…/uploads). */
    PUBLIC_UPLOAD_BASE_URL: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.url().optional(),
    ),
    /** Blob driver: the store's read-write token. */
    BLOB_READ_WRITE_TOKEN: optionalString,
    /** Set by Vercel on every deployment: the database pool shrinks to one connection. */
    VERCEL: optionalString,
  })
  .superRefine((env, ctx) => {
    if (env.STORAGE_DRIVER === 'blob' && !env.BLOB_READ_WRITE_TOKEN) {
      ctx.addIssue({
        code: 'custom',
        path: ['BLOB_READ_WRITE_TOKEN'],
        message: 'is required when STORAGE_DRIVER=blob',
      });
    }
    if (env.STORAGE_DRIVER === 'local' && !env.PUBLIC_UPLOAD_BASE_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['PUBLIC_UPLOAD_BASE_URL'],
        message: 'is required when STORAGE_DRIVER=local',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return result.data;
}
