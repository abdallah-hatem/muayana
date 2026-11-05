import { Injectable } from '@nestjs/common';
import type { Locale, Prisma } from '@prisma/client';
import { DatabaseService } from '../../../database/database.service';

/** What the API ever shows of a user: never the password hash. */
export const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  locale: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{
  select: typeof PUBLIC_USER_SELECT;
}>;

export type UserWithHash = PublicUser & { passwordHash: string };

@Injectable()
export class AuthUserRepository {
  constructor(private readonly db: DatabaseService) {}

  /** For sign-in only: the one read that includes the hash. `email` is already normalised. */
  findByEmailWithHash(email: string): Promise<UserWithHash | null> {
    return this.db.user.findUnique({
      where: { email },
      select: { ...PUBLIC_USER_SELECT, passwordHash: true },
    });
  }

  findHashById(id: string): Promise<string | null> {
    return this.db.user
      .findUnique({ where: { id }, select: { passwordHash: true } })
      .then((row) => row?.passwordHash ?? null);
  }

  findPublicById(id: string): Promise<PublicUser | null> {
    return this.db.user.findUnique({
      where: { id },
      select: PUBLIC_USER_SELECT,
    });
  }

  async exists(id: string): Promise<boolean> {
    return (await this.db.user.count({ where: { id } })) > 0;
  }

  updateProfile(
    id: string,
    data: { name?: string; locale?: Locale },
  ): Promise<PublicUser> {
    return this.db.user.update({
      where: { id },
      data,
      select: PUBLIC_USER_SELECT,
    });
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.db.user.update({ where: { id }, data: { passwordHash } });
  }
}
