import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FillPhoto, LocalPhoto } from './photo';

describe('broken photos (m3)', () => {
  it('a stored photo whose URL fails shows the "no picture" mark, not a broken image', () => {
    render(
      <div className="relative">
        <FillPhoto src="/uploads/gone.jpg" alt="Issue #3 1/1" sizes="96px" />
      </div>,
    );
    const img = screen.getByRole('img', { name: 'Issue #3 1/1' });
    expect(img.tagName).toBe('IMG');
    fireEvent.error(img);
    const placeholder = screen.getByRole('img', { name: 'Issue #3 1/1' });
    expect(placeholder.tagName).toBe('SPAN');
    expect(document.querySelector('img')).toBeNull();
  });

  it('a phone photo that fails to decode keeps its box (same classes) with the mark', () => {
    render(
      <LocalPhoto
        src="blob:x"
        alt="Queued photo"
        className="size-16 rounded-md"
      />,
    );
    fireEvent.error(screen.getByRole('img', { name: 'Queued photo' }));
    const failed = screen.getByTestId('photo-failed');
    expect(failed).toHaveClass('size-16', 'rounded-md');
    expect(document.querySelector('img')).toBeNull();
  });
});
