import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { IssueExportColumn } from '@muayana/shared';
import { renderIntl } from '@/test-utils/render-intl';
import { ExportColumnChooser } from './export-column-chooser';

const rowOf = (checkbox: HTMLElement): HTMLElement =>
  checkbox.closest('label') as HTMLElement;

describe('ExportColumnChooser', () => {
  it('a tap anywhere on the row toggles its column, not only the box', async () => {
    const onChange = vi.fn();
    renderIntl(
      <ExportColumnChooser value={['number', 'site']} onChange={onChange} />,
    );
    const site = screen.getByRole('checkbox', { name: 'Site' });
    const row = rowOf(site);
    expect(row).not.toBeNull();

    // The row's empty space (the label itself, outside the box and the text).
    await userEvent.click(row);
    expect(onChange).toHaveBeenLastCalledWith(['number']);

    const status = screen.getByRole('checkbox', { name: 'Status' });
    await userEvent.click(rowOf(status));
    expect(onChange).toHaveBeenLastCalledWith(['number', 'site', 'status']);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('the box itself toggles once (no double toggle through its label)', async () => {
    const onChange = vi.fn();
    renderIntl(<ExportColumnChooser value={['number']} onChange={onChange} />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Number' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('keyboard: Tab reaches the named checkbox and Space toggles it', async () => {
    const onChange = vi.fn();
    renderIntl(<ExportColumnChooser value={[]} onChange={onChange} />);
    const number = screen.getByRole('checkbox', { name: 'Number' });
    number.focus();
    await userEvent.keyboard(' ');
    expect(onChange).toHaveBeenLastCalledWith(['number']);
    expect(number).toHaveAttribute('aria-checked', 'false');
  });

  it('Excel names photo columns as pictures; the CSV keeps links (ar and en)', () => {
    const all: IssueExportColumn[] = [];
    const { unmount } = renderIntl(
      <ExportColumnChooser value={all} onChange={() => {}} target="excel" />,
      'ar',
    );
    expect(screen.getByRole('checkbox', { name: 'الصور' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'روابط الصور' })).toBeNull();
    unmount();

    renderIntl(<ExportColumnChooser value={all} onChange={() => {}} />);
    expect(
      screen.getByRole('checkbox', { name: 'Photo links' }),
    ).toBeInTheDocument();
  });
});
