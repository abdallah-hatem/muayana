import { describe, expect, it } from 'vitest';
import type { TrayPhoto } from '@/lib/offline-queue';
import {
  dayKind,
  groupByImportDay,
  keepPresent,
  pickNumber,
  togglePick,
} from './selection';

const photo = (id: string, importedAt: number, seq: number): TrayPhoto => ({
  id,
  siteId: null,
  importedAt,
  seq,
  capturedAt: new Date(importedAt).toISOString(),
  photo: { bytes: new ArrayBuffer(1), type: 'image/jpeg' },
});

describe('tray selection order (N6)', () => {
  it('numbers photos in the order they are tapped', () => {
    let selection: readonly string[] = [];
    for (const id of ['c', 'a', 'd'])
      selection = togglePick(selection, id).selection;
    expect(selection).toEqual(['c', 'a', 'd']);
    expect(['a', 'b', 'c', 'd'].map((id) => pickNumber(selection, id))).toEqual(
      [2, 0, 1, 3],
    );
  });

  it('unpicking a photo moves the ones after it up a number', () => {
    const { selection } = togglePick(['c', 'a', 'd'], 'a');
    expect(selection).toEqual(['c', 'd']);
    expect(pickNumber(selection, 'd')).toBe(2);
  });

  it('an 11th photo is refused: an issue takes 10 at most', () => {
    const ten = Array.from({ length: 10 }, (_, i) => `p${i}`);
    const result = togglePick(ten, 'p10');
    expect(result.blocked).toBe(true);
    expect(result.selection).toBe(ten);
    // Unpicking still works at the limit.
    expect(togglePick(ten, 'p3')).toMatchObject({ blocked: false });
  });

  it('picks of photos that left the tray drop out, keeping the order of the rest', () => {
    const photos = [photo('a', 1, 1), photo('d', 1, 2)];
    expect(keepPresent(['c', 'a', 'd'], photos)).toEqual(['a', 'd']);
    const same = ['a', 'd'];
    expect(keepPresent(same, photos)).toBe(same);
  });
});

describe('tray groups (N6)', () => {
  const day = (iso: string) => new Date(iso).getTime();

  it('groups by import day, newest import first, a pick in its gallery order', () => {
    const yesterday = day('2026-11-20T15:00:00');
    const morning = day('2026-11-21T08:00:00');
    const now = day('2026-11-21T10:42:00');
    const groups = groupByImportDay([
      photo('y1', yesterday, 1),
      photo('m1', morning, 2),
      photo('m2', morning, 3),
      photo('n1', now, 4),
      photo('n2', now, 5),
    ]);
    expect(groups.map((g) => g.photos.map((p) => p.id))).toEqual([
      ['n1', 'n2', 'm1', 'm2'],
      ['y1'],
    ]);
    expect(groups[0].latest).toBe(now);
  });

  it('tells today, yesterday and earlier apart', () => {
    const now = new Date('2026-11-21T10:42:00');
    expect(dayKind(day('2026-11-21T00:10:00'), now)).toBe('today');
    expect(dayKind(day('2026-11-20T23:50:00'), now)).toBe('yesterday');
    expect(dayKind(day('2026-11-19T12:00:00'), now)).toBe('earlier');
  });
});
