import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import type {
  FailureWindow,
  LoginAttemptStore,
} from '../interfaces/login-attempt-store.interface';

/** Failed sign-ins in the `login_failures` table, shared by every API instance. */
@Injectable()
export class PrismaLoginAttemptStore implements LoginAttemptStore {
  constructor(private readonly db: DatabaseService) {}

  async failuresSince(
    keys: readonly string[],
    since: Date,
  ): Promise<Map<string, FailureWindow>> {
    const rows = await this.db.loginFailure.groupBy({
      by: ['key'],
      where: { key: { in: [...keys] }, at: { gte: since } },
      _count: { _all: true },
      _min: { at: true },
    });
    return new Map(
      rows.map((row) => [
        row.key,
        { count: row._count._all, oldest: row._min.at },
      ]),
    );
  }

  async recordFailure(
    keys: readonly string[],
    at: Date,
    pruneBefore: Date,
  ): Promise<void> {
    await this.db.$transaction([
      this.db.loginFailure.deleteMany({ where: { at: { lt: pruneBefore } } }),
      this.db.loginFailure.createMany({
        data: keys.map((key) => ({ key, at })),
      }),
    ]);
  }

  async clear(keys: readonly string[]): Promise<void> {
    await this.db.loginFailure.deleteMany({ where: { key: { in: [...keys] } } });
  }
}
