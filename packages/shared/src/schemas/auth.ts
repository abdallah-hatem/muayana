import { z } from 'zod';
import { LocaleSchema } from './enums';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const USER_NAME_MAX_LENGTH = 120;
/** Access token lifetime (contract: JWT, 7 days). */
export const ACCESS_TOKEN_TTL_DAYS = 7;

export const normalizeEmail = (email: string): string =>
  email.trim().toLowerCase();

export const EmailSchema = z
  .string()
  .transform(normalizeEmail)
  .pipe(z.email().max(254));

export const PasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH)
  .max(PASSWORD_MAX_LENGTH);

export const LoginRequestSchema = z.strictObject({
  email: EmailSchema,
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});

export const UserSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  name: z.string(),
  locale: LocaleSchema,
});

export const LoginResponseSchema = z.object({
  accessToken: z.string(),
  user: UserSchema,
});

export const UpdateMeRequestSchema = z.strictObject({
  name: z.string().trim().min(1).max(USER_NAME_MAX_LENGTH).optional(),
  locale: LocaleSchema.optional(),
});

export const ChangePasswordRequestSchema = z.strictObject({
  currentPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  newPassword: PasswordSchema,
});

export const ChangePasswordResponseSchema = z.object({ ok: z.literal(true) });
