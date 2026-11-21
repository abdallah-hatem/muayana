import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithIntl } from '@/test-utils/render';
import { CaptureSheet } from './capture-sheet';
import { galleryTakenAt } from './capture-shot';
import type { CaptureLookups } from './use-capture-lookups';

vi.mock('@/lib/api-client', () => ({ clientFetch: vi.fn() }));

const NOW = new Date('2026-11-10T10:00:00.000Z');
const fileAt = (ms: number) =>
  new File(['x'], 'p.jpg', { type: 'image/jpeg', lastModified: ms });

describe('galleryTakenAt (N5)', () => {
  it('a gallery photo keeps the date it was taken', () => {
    const taken = new Date('2026-11-08T07:30:00.000Z');
    expect(galleryTakenAt(fileAt(taken.getTime()), NOW)).toEqual(taken);
  });

  it('a date in the future or over a year back is not believable: dated now', () => {
    expect(galleryTakenAt(fileAt(NOW.getTime() + 60_000), NOW)).toEqual(NOW);
    expect(
      galleryTakenAt(fileAt(new Date('2024-01-01').getTime()), NOW),
    ).toEqual(NOW);
  });
});

describe('CaptureSheet from the gallery (N5)', () => {
  const lookups: CaptureLookups = {
    phase: 'ready',
    categories: [],
    workers: [],
    stale: false,
  };

  it('adds photos from the gallery to the open issue', async () => {
    const onAddFromGallery = vi.fn();
    renderWithIntl(
      <CaptureSheet
        draft={{ issueId: 'issue-1', photos: ['blob:one'] }}
        lookups={lookups}
        initialLocation=""
        addingPhoto={false}
        onAddPhoto={vi.fn()}
        onAddFromGallery={onAddFromGallery}
        onSave={vi.fn()}
      />,
    );
    await userEvent
      .setup()
      .click(await screen.findByTestId('capture-add-from-gallery'));
    expect(onAddFromGallery).toHaveBeenCalled();
  });

  it('a full issue offers no more gallery photos', async () => {
    renderWithIntl(
      <CaptureSheet
        draft={{
          issueId: 'issue-1',
          photos: Array.from({ length: 10 }, (_, i) => `blob:${i}`),
        }}
        lookups={lookups}
        initialLocation=""
        addingPhoto={false}
        onAddPhoto={vi.fn()}
        onAddFromGallery={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    await screen.findByTestId('capture-add-photo');
    expect(screen.queryByTestId('capture-add-from-gallery')).toBeNull();
  });
});
