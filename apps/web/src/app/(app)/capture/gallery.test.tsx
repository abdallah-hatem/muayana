import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithIntl } from '@/test-utils/render';
import { CaptureSheet } from './capture-sheet';
import { galleryTakenAt } from './capture-shot';
import { GalleryChoiceSheet } from './gallery-choice-sheet';
import type { CaptureLookups } from './use-capture-lookups';

vi.mock('@/lib/api-client', () => ({ clientFetch: vi.fn() }));

const NOW = new Date('2026-11-10T10:00:00.000Z');
const fileAt = (ms: number) =>
  new File(['x'], 'p.jpg', { type: 'image/jpeg', lastModified: ms });
const photos = (n: number) =>
  Array.from({ length: n }, (_, i) => new File(['x'], `p${i}.jpg`));

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

describe('GalleryChoiceSheet (N5)', () => {
  it('several photos: one issue each, or one issue with all of them', async () => {
    const onChoose = vi.fn();
    const user = userEvent.setup();
    renderWithIntl(
      <GalleryChoiceSheet
        files={photos(3)}
        onChoose={onChoose}
        onCancel={vi.fn()}
      />,
    );
    await user.click(await screen.findByTestId('gallery-separate'));
    expect(onChoose).toHaveBeenLastCalledWith(true);
    await user.click(screen.getByTestId('gallery-together'));
    expect(onChoose).toHaveBeenLastCalledWith(false);
  });

  it('more than 10 photos can only be separate issues', async () => {
    renderWithIntl(
      <GalleryChoiceSheet
        files={photos(11)}
        onChoose={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(await screen.findByTestId('gallery-together')).toBeDisabled();
    expect(screen.getByTestId('gallery-separate')).toBeEnabled();
  });

  it('cancel stores nothing', async () => {
    const onChoose = vi.fn();
    const onCancel = vi.fn();
    renderWithIntl(
      <GalleryChoiceSheet
        files={photos(2)}
        onChoose={onChoose}
        onCancel={onCancel}
      />,
    );
    await userEvent
      .setup()
      .click(await screen.findByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
    expect(onChoose).not.toHaveBeenCalled();
  });
});

describe('CaptureSheet from the gallery (N5)', () => {
  const lookups: CaptureLookups = {
    phase: 'ready',
    categories: [],
    workers: [],
    stale: false,
  };

  it('adds photos from the gallery to the open issue and says how many issues wait after it', async () => {
    const onAddFromGallery = vi.fn();
    renderWithIntl(
      <CaptureSheet
        draft={{ issueId: 'issue-1', photos: ['blob:one'] }}
        lookups={lookups}
        initialLocation=""
        addingPhoto={false}
        waiting={2}
        onAddPhoto={vi.fn()}
        onAddFromGallery={onAddFromGallery}
        onSave={vi.fn()}
      />,
    );
    await userEvent
      .setup()
      .click(await screen.findByTestId('capture-add-from-gallery'));
    expect(onAddFromGallery).toHaveBeenCalled();
    expect(
      screen.getByText(/2 more issues from the gallery after this/),
    ).toBeInTheDocument();
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
