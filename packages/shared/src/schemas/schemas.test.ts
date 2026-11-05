import { describe, expect, it } from 'vitest';
import {
  CreateCategoryRequestSchema,
  IssueExportQuerySchema,
  IssueListQuerySchema,
  PAGE_LIMIT_MAX,
  UpdateIssueRequestSchema,
  nameKey,
} from './index';

describe('IssueListQuerySchema', () => {
  it('splits comma lists and applies defaults', () => {
    const parsed = IssueListQuerySchema.parse({
      status: 'new, assigned',
      overdue: 'true',
    });
    expect(parsed.status).toEqual(['new', 'assigned']);
    expect(parsed.overdue).toBe(true);
    expect(parsed).toMatchObject({ page: 1, limit: 20, sort: 'newest' });
  });

  it('refuses an unknown status in the list', () => {
    expect(IssueListQuerySchema.safeParse({ status: 'new,done' }).success).toBe(
      false,
    );
  });

  it('caps limit at 100', () => {
    expect(IssueListQuerySchema.safeParse({ limit: PAGE_LIMIT_MAX }).success).toBe(
      true,
    );
    expect(
      IssueListQuerySchema.safeParse({ limit: PAGE_LIMIT_MAX + 1 }).success,
    ).toBe(false);
  });
});

describe('CreateCategoryRequestSchema', () => {
  it('accepts a 60-character name and refuses 61', () => {
    const ok = { nameAr: 'ن'.repeat(60), color: '#FFCC00' };
    expect(CreateCategoryRequestSchema.safeParse(ok).success).toBe(true);
    expect(
      CreateCategoryRequestSchema.safeParse({ ...ok, nameAr: 'ن'.repeat(61) })
        .success,
    ).toBe(false);
  });

  it('refuses a colour that is not #RRGGBB', () => {
    expect(
      CreateCategoryRequestSchema.safeParse({ nameAr: 'كهرباء', color: 'red' })
        .success,
    ).toBe(false);
  });
});

describe('UpdateIssueRequestSchema', () => {
  it('accepts null to remove the worker and clear the date', () => {
    expect(
      UpdateIssueRequestSchema.parse({ workerId: null, estimatedDate: null }),
    ).toEqual({ workerId: null, estimatedDate: null });
  });

  it('refuses unknown fields', () => {
    expect(UpdateIssueRequestSchema.safeParse({ status: 'solved' }).success).toBe(
      false,
    );
  });
});

describe('IssueExportQuerySchema', () => {
  it('refuses an unknown column', () => {
    expect(
      IssueExportQuerySchema.safeParse({ columns: 'number,secret' }).success,
    ).toBe(false);
  });
});

describe('nameKey', () => {
  it('ignores case and surrounding / repeated spaces', () => {
    expect(nameKey('  Tower   A ')).toBe(nameKey('tower a'));
  });
});
