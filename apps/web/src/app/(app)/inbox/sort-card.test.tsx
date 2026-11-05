import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clientFetch } from '@/lib/api-client';
import { calls, routeApi, type ApiCall } from '@/test-utils/api-mock';
import {
  CAT_ELECTRIC,
  CAT_PLASTER,
  makeIssue,
  makeWorker,
  ok,
} from '@/test-utils/fixtures';
import { renderWithIntl } from '@/test-utils/render';
import { SortCard } from './sort-card';

vi.mock('@/lib/api-client', () => ({ clientFetch: vi.fn() }));

const sayed = makeWorker({ name: 'Sayed', categories: [CAT_PLASTER] });
const mahmoud = makeWorker({ name: 'Mahmoud', categories: [CAT_ELECTRIC] });

function workersFor(call: ApiCall) {
  const categoryId = new URLSearchParams(call.path.split('?')[1]).get(
    'categoryId',
  );
  return ok(categoryId === CAT_PLASTER.id ? [sayed] : [mahmoud]);
}

function renderCard(onSaved = vi.fn()) {
  const issue = makeIssue();
  routeApi(clientFetch, {
    'GET /workers': workersFor,
    'PATCH /issues/': (call) =>
      ok({ ...issue, ...(call.body as object), status: 'unassigned' }),
  });
  renderWithIntl(
    <SortCard
      issue={issue}
      categories={[CAT_PLASTER, CAT_ELECTRIC]}
      onSaved={onSaved}
      onSkip={vi.fn()}
      onBack={vi.fn()}
      canGoBack={false}
    />,
  );
  return { issue, onSaved, user: userEvent.setup() };
}

describe('SortCard', () => {
  afterEach(() => vi.mocked(clientFetch).mockReset());

  it('Changing category in the sorter clears a picked worker who lacks it (§6.3)', async () => {
    const { user, onSaved } = renderCard();

    await user.click(screen.getByRole('button', { name: 'Plastering' }));
    await user.click(await screen.findByRole('combobox'));
    await user.click(screen.getByRole('option', { name: /Sayed/ }));
    expect(screen.getByRole('combobox')).toHaveTextContent('Sayed');

    await user.click(screen.getByRole('button', { name: 'Electrical' }));
    await waitFor(() =>
      expect(screen.getByRole('combobox')).toHaveTextContent('No worker'),
    );

    await user.type(screen.getByLabelText(/Description/), 'Loose socket');
    await user.click(screen.getByRole('button', { name: /Save & next/ }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const [patch] = calls(clientFetch, 'PATCH');
    expect(patch.body).toMatchObject({ categoryId: CAT_ELECTRIC.id });
    expect(patch.body).not.toHaveProperty('workerId');
  });

  it('Inbox "save & next" without description → stays, inline error (§6.1)', async () => {
    const { user, onSaved } = renderCard();

    await user.click(screen.getByRole('button', { name: 'Plastering' }));
    await user.click(screen.getByRole('button', { name: /Save & next/ }));

    expect(
      screen.getByText('Write a short description of the defect.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/)).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(calls(clientFetch, 'PATCH')).toHaveLength(0);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('a full sort with a worker sends category, description, location, priority and the worker', async () => {
    const { user, onSaved, issue } = renderCard();

    await user.click(screen.getByRole('button', { name: 'Plastering' }));
    await user.type(screen.getByLabelText(/Description/), '  Wall crack  ');
    await user.type(screen.getByLabelText('Location'), 'Floor 3');
    await user.click(screen.getByRole('radio', { name: 'Urgent' }));
    await user.click(await screen.findByRole('combobox'));
    await user.click(screen.getByRole('option', { name: /Sayed/ }));
    await user.click(screen.getByRole('button', { name: /Save & next/ }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const patches = calls(clientFetch, 'PATCH');
    expect(patches).toHaveLength(1);
    expect(patches[0].path).toBe(`/issues/${issue.id}`);
    expect(patches[0].body).toEqual({
      categoryId: CAT_PLASTER.id,
      description: 'Wall crack',
      location: 'Floor 3',
      priority: 'urgent',
      workerId: sayed.id,
    });
  });
});
