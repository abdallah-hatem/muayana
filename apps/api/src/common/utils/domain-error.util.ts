import { ConflictException } from '@nestjs/common';
import type { DomainErrorCode } from '@muayana/shared';

/** A 409 refusal carrying one of the contract's coded messages (contract "Errors"). */
export const domainConflict = (
  code: DomainErrorCode,
  message: string,
): ConflictException => new ConflictException({ message, error: code });

/**
 * A Prisma unique-constraint violation (P2002), matched by shape so services need no Prisma
 * value import. Used where a check-then-write can still lose a race to the unique index.
 */
export function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.name === 'PrismaClientKnownRequestError' &&
    (error as { code?: unknown }).code === 'P2002'
  );
}
