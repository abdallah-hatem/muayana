import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Category, Worker } from '@muayana/shared';
import { clientFetch } from '@/lib/api-client';
import type { ApiResult } from '@/lib/api-result';
import { calls, deferred, routeApi } from '@/test-utils/api-mock';
import {
  CAT_ELECTRIC,
  CAT_PLASTER,
  fail,
  makeWorker,
  ok,
} from '@/test-utils/fixtures';
import { renderWithIntl } from '@/test-utils/render';
import { WorkerForm } from './worker-form';

vi.mock('@/lib/api-client', () => ({
  clientFetch: vi.fn(),
  clientFetchRaw: vi.fn(),
}));

function renderForm({
  worker = null,
  categories = [CAT_PLASTER, CAT_ELECTRIC],
  onSaved = vi.fn(),
}: {
  worker?: Worker | null;
  categories?: Category[];
  onSaved?: (w: Worker) => void;
} = {}) {
  renderWithIntl(
    <WorkerForm
      formId="worker"
      worker={worker}
      categories={categories}
      onSaved={onSaved}
    >
      <button type="submit">Add worker</button>
    </WorkerForm>,
  );
  return { user: userEvent.setup(), onSaved };
}

async function fill(
  user: ReturnType<typeof userEvent.setup>,
  { name = 'Sayed', phone = '01001234567', category = 'Plastering' } = {},
) {
  await user.type(screen.getByLabelText(/^Name/), name);
  if (phone) await user.type(screen.getByLabelText(/^Phone/), phone);
  if (category)
    await user.click(screen.getByRole('button', { name: category }));
}

const submit = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Add worker' }));

describe('WorkerForm', () => {
  afterEach(() => vi.mocked(clientFetch).mockReset());

  it('no category selected → inline error, nothing sent', async () => {
    const { user } = renderForm();
    await fill(user, { category: '' });
    await submit(user);

    expect(
      screen.getByText('Choose at least one category.'),
    ).toBeInTheDocument();
    expect(clientFetch).not.toHaveBeenCalled();
  });

  it('bad phone → inline error, nothing sent', async () => {
    const { user } = renderForm();
    await fill(user, { phone: '0100123' });
    await submit(user);

    expect(
      screen.getByText(
        "That isn't an Egyptian phone number, e.g. 01001234567.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^Phone/)).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(clientFetch).not.toHaveBeenCalled();
  });

  it('duplicate phone → error from API shown on the phone field', async () => {
    routeApi(clientFetch, { 'POST /workers': () => fail(409, 'DUPLICATE') });
    const { user, onSaved } = renderForm();
    await fill(user);
    await submit(user);

    expect(
      await screen.findByText('Another worker already has this phone.'),
    ).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('a category deactivated meanwhile (409 INACTIVE_CATEGORY) → error on the categories', async () => {
    routeApi(clientFetch, {
      'POST /workers': () => fail(409, 'INACTIVE_CATEGORY'),
    });
    const { user } = renderForm();
    await fill(user);
    await submit(user);

    expect(
      await screen.findByText(
        'One of the chosen categories was deactivated. Choose again.',
      ),
    ).toBeInTheDocument();
  });

  it('a pasted local number with Arabic digits and spaces is sent as +20…', async () => {
    const saved = makeWorker();
    routeApi(clientFetch, { 'POST /workers': () => ok(saved) });
    const { user, onSaved } = renderForm();
    await fill(user, { phone: '', category: 'Electrical' });
    await user.click(screen.getByLabelText(/^Phone/));
    await user.paste('٠١٠٠ ١٢٣ ٤٥٦٧');
    await user.type(screen.getByLabelText(/^Notes/), '  Sundays only ');
    await submit(user);

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
    expect(calls(clientFetch, 'POST', '/workers')[0].body).toEqual({
      name: 'Sayed',
      phone: '+201001234567',
      categoryIds: [CAT_ELECTRIC.id],
      notes: 'Sundays only',
    });
  });

  it('double submit blocked: two taps send one request', async () => {
    const pending = deferred<ApiResult<Worker>>();
    routeApi(clientFetch, { 'POST /workers': () => pending.promise });
    const { user } = renderForm();
    await fill(user);
    await submit(user);
    await submit(user);

    expect(calls(clientFetch, 'POST')).toHaveLength(1);
    pending.resolve(ok(makeWorker()));
  });

  it('only active categories are offered; a deactivated one the worker has shows and can be removed', async () => {
    const worker = makeWorker({
      categories: [
        CAT_PLASTER,
        {
          id: CAT_ELECTRIC.id,
          nameAr: 'كهرباء',
          nameEn: 'Electrical',
          color: CAT_ELECTRIC.color,
        },
      ],
    });
    routeApi(clientFetch, { 'PATCH /workers/': () => ok(worker) });
    const { user } = renderForm({ worker, categories: [CAT_PLASTER] });

    const inactive = screen.getByRole('button', {
      name: 'Electrical (deactivated)',
    });
    expect(inactive).toHaveAttribute('aria-pressed', 'true');
    await user.click(inactive);
    await submit(user);

    await waitFor(() => expect(calls(clientFetch, 'PATCH')).toHaveLength(1));
    expect(calls(clientFetch, 'PATCH')[0].body).toMatchObject({
      categoryIds: [CAT_PLASTER.id],
    });
  });
});
