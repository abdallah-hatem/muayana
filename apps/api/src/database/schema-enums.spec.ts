import { $Enums } from '@prisma/client';
import {
  IssueStatusSchema,
  LocaleSchema,
  PhotoKindSchema,
  PrioritySchema,
} from '@muayana/shared';

// The Prisma enums are a second spelling of the contract enums in packages/shared.
// This fails the moment the two drift.
describe('Prisma enums match the shared contract', () => {
  const pairs: [string, Record<string, string>, readonly string[]][] = [
    ['IssueStatus', $Enums.IssueStatus, IssueStatusSchema.options],
    ['Priority', $Enums.Priority, PrioritySchema.options],
    ['PhotoKind', $Enums.PhotoKind, PhotoKindSchema.options],
    ['Locale', $Enums.Locale, LocaleSchema.options],
  ];

  it.each(pairs)('%s', (_name, prismaEnum, shared) => {
    expect(Object.values(prismaEnum)).toEqual([...shared]);
  });
});
