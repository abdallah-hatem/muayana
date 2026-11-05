import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clientFetch } from '@/lib/api-client';
import { calls, routeApi } from '@/test-utils/api-mock';
import {
  CAT_ELECTRIC,
  CAT_PLASTER,
  makeWorker,
  ok,
} from '@/test-utils/fixtures';
import { renderWithIntl } from '@/test-utils/render';
import { WorkerPicker } from './worker-picker';

vi.mock('@/lib/api-client', () => ({ clientFetch: vi.fn() }));

describe('WorkerPicker', () => {
  afterEach(() => vi.mocked(clientFetch).mockReset());

  it("Worker picker lists only active workers having the issue's category, with open counts (§5.4, §6.11)", async () => {
    const sayed = makeWorker({
      name: 'Sayed',
      categories: [CAT_PLASTER],
      counts: { ...makeWorker().counts, open: 3 },
    });
    const inactive = makeWorker({ name: 'Hassan', active: false });
    const electrician = makeWorker({
      name: 'Mahmoud',
      categories: [CAT_ELECTRIC],
    });
    routeApi(clientFetch, {
      'GET /workers': () => ok([sayed, inactive, electrician]),
    });
    const onChange = vi.fn();

    renderWithIntl(
      <WorkerPicker
        id="w"
        categoryId={CAT_PLASTER.id}
        value={null}
        onChange={onChange}
      />,
    );

    const user = userEvent.setup();
    await user.click(await screen.findByRole('combobox'));
    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['No worker', 'Sayed3 open']);

    const [request] = calls(clientFetch, 'GET', '/workers');
    const query = new URLSearchParams(request.path.split('?')[1]);
    expect(query.get('categoryId')).toBe(CAT_PLASTER.id);
    expect(query.get('active')).toBe('true');

    await user.click(screen.getByRole('option', { name: /Sayed/ }));
    expect(onChange).toHaveBeenCalledWith(sayed);
  });

  it('asks for a category first and loads nothing without one', () => {
    renderWithIntl(
      <WorkerPicker id="w" categoryId={null} value={null} onChange={vi.fn()} />,
    );
    expect(screen.getByText('Choose a category first.')).toBeInTheDocument();
    expect(clientFetch).not.toHaveBeenCalled();
  });
});
