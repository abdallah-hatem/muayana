import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Category } from '@muayana/shared';
import { clientFetch } from '@/lib/api-client';
import type { ApiResult } from '@/lib/api-result';
import { calls, deferred, routeApi } from '@/test-utils/api-mock';
import {
  CAT_ELECTRIC,
  CAT_PLASTER,
  fail,
  nextId,
  ok,
} from '@/test-utils/fixtures';
import { renderWithIntl } from '@/test-utils/render';
import { CategoriesScreen } from './categories-screen';

vi.mock('@/lib/api-client', () => ({
  clientFetch: vi.fn(),
  clientFetchRaw: vi.fn(),
}));

const UNUSED: Category = {
  id: nextId(),
  nameAr: 'نظافة',
  nameEn: 'Cleaning',
  color: '#E64980',
  sortOrder: 2,
  active: true,
  counts: { open: 0, workers: 0 },
};

function renderCategories() {
  renderWithIntl(<CategoriesScreen />);
  return userEvent.setup();
}

const dialog = () => screen.getByRole('dialog');
const rowNames = () =>
  screen
    .getAllByTestId('category-row')
    .map((row) => within(row).getByText(/Plastering|Electrical|Cleaning/))
    .map((el) => el.textContent);

describe('CategoriesScreen', () => {
  afterEach(() => vi.mocked(clientFetch).mockReset());

  it('empty state: no categories yet, with the way to add one', async () => {
    routeApi(clientFetch, { 'GET /categories': () => ok([] as Category[]) });
    renderCategories();

    expect(await screen.findByText('No categories yet')).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: 'New category' }).length,
    ).toBeGreaterThan(0);
  });

  it('duplicate name → the error is shown inline on the Arabic name', async () => {
    routeApi(clientFetch, {
      'GET /categories': () => ok([CAT_PLASTER]),
      'POST /categories': () => fail(409, 'DUPLICATE'),
    });
    const user = renderCategories();
    await screen.findByText('Plastering');

    await user.click(screen.getByRole('button', { name: 'New category' }));
    await user.type(within(dialog()).getByLabelText(/Arabic name/), 'محارة');
    await user.click(within(dialog()).getByRole('button', { name: 'Save' }));

    expect(
      await within(dialog()).findByText(
        'Another category already has this name.',
      ),
    ).toBeInTheDocument();
    expect(within(dialog()).getByLabelText(/Arabic name/)).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('double submit blocked: two taps on Save send one request, with the chosen colour', async () => {
    const pending = deferred<ApiResult<Category>>();
    routeApi(clientFetch, {
      'GET /categories': () => ok([] as Category[]),
      'POST /categories': () => pending.promise,
    });
    const user = renderCategories();
    await screen.findByText('No categories yet');

    await user.click(
      screen.getAllByRole('button', { name: 'New category' })[0],
    );
    await user.type(within(dialog()).getByLabelText(/Arabic name/), 'نظافة');
    await user.type(
      within(dialog()).getByLabelText(/English name/),
      'Cleaning',
    );
    await user.click(within(dialog()).getByRole('radio', { name: 'Pink' }));
    const save = within(dialog()).getByRole('button', { name: 'Save' });
    await user.click(save);
    await user.click(save);

    expect(calls(clientFetch, 'POST', '/categories')).toHaveLength(1);
    expect(calls(clientFetch, 'POST')[0].body).toEqual({
      nameAr: 'نظافة',
      nameEn: 'Cleaning',
      color: '#E64980',
    });
    pending.resolve(ok(UNUSED));
    expect(await screen.findByText('Cleaning')).toBeInTheDocument();
  });

  it('delete in use shows "Deactivate instead", which deactivates it and deletes nothing', async () => {
    routeApi(clientFetch, {
      'GET /categories': () => ok([CAT_PLASTER]),
      'PATCH /categories/': () => ok({ ...CAT_PLASTER, active: false }),
    });
    const user = renderCategories();
    await screen.findByText('Plastering');

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(
      within(dialog()).getByText('This category is in use'),
    ).toBeInTheDocument();
    await user.click(
      within(dialog()).getByRole('button', { name: 'Deactivate instead' }),
    );

    await waitFor(() =>
      expect(calls(clientFetch, 'PATCH')[0]?.body).toEqual({ active: false }),
    );
    expect(calls(clientFetch, 'DELETE')).toHaveLength(0);
    expect(await screen.findByText('Deactivated')).toBeInTheDocument();
  });

  it('delete refused by the API as in use (409) switches to "Deactivate instead"', async () => {
    routeApi(clientFetch, {
      'GET /categories': () => ok([UNUSED]),
      'DELETE /categories/': () => fail(409, 'IN_USE'),
    });
    const user = renderCategories();
    await screen.findByText('Cleaning');

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(within(dialog()).getByRole('button', { name: 'Delete' }));

    expect(
      await within(dialog()).findByRole('button', {
        name: 'Deactivate instead',
      }),
    ).toBeInTheDocument();
  });

  it('an unused category is deleted', async () => {
    routeApi(clientFetch, {
      'GET /categories': () => ok([CAT_PLASTER, UNUSED]),
      'DELETE /categories/': () => ok({ id: UNUSED.id }),
    });
    const user = renderCategories();
    await screen.findByText('Cleaning');

    const row = screen.getAllByTestId('category-row')[1];
    await user.click(within(row).getByRole('button', { name: 'Delete' }));
    await user.click(within(dialog()).getByRole('button', { name: 'Delete' }));

    await waitFor(() =>
      expect(screen.queryByText('Cleaning')).not.toBeInTheDocument(),
    );
    expect(
      calls(clientFetch, 'DELETE', `/categories/${UNUSED.id}`),
    ).toHaveLength(1);
  });

  it('reorder: moving a category down sends the whole new order once', async () => {
    const pending = deferred<ApiResult<Category[]>>();
    routeApi(clientFetch, {
      'GET /categories': () => ok([CAT_PLASTER, CAT_ELECTRIC, UNUSED]),
      'PUT /categories/order': () => pending.promise,
    });
    const user = renderCategories();
    await screen.findByText('Plastering');

    await user.click(
      screen.getByRole('button', { name: 'Move Plastering down' }),
    );
    // Shown at once; the arrows wait for the answer.
    expect(rowNames()).toEqual(['Electrical', 'Plastering', 'Cleaning']);
    expect(
      screen.getByRole('button', { name: 'Move Plastering down' }),
    ).toBeDisabled();

    expect(calls(clientFetch, 'PUT')).toEqual([
      {
        method: 'PUT',
        path: '/categories/order',
        body: { ids: [CAT_ELECTRIC.id, CAT_PLASTER.id, UNUSED.id] },
      },
    ]);
    pending.resolve(
      ok([
        { ...CAT_ELECTRIC, sortOrder: 0 },
        { ...CAT_PLASTER, sortOrder: 1 },
        { ...UNUSED, sortOrder: 2 },
      ]),
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Move Plastering down' }),
      ).toBeEnabled(),
    );
    expect(rowNames()).toEqual(['Electrical', 'Plastering', 'Cleaning']);
  });

  it('reorder refused → the previous order comes back', async () => {
    routeApi(clientFetch, {
      'GET /categories': () => ok([CAT_PLASTER, CAT_ELECTRIC]),
      'PUT /categories/order': () => fail(500, 'INTERNAL_ERROR'),
    });
    const user = renderCategories();
    await screen.findByText('Plastering');

    await user.click(
      screen.getByRole('button', { name: 'Move Electrical up' }),
    );

    await waitFor(() =>
      expect(rowNames()).toEqual(['Plastering', 'Electrical']),
    );
  });
});
