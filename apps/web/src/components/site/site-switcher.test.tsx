import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clientFetch } from '@/lib/api-client';
import { LAST_SITE_KEY } from '@/lib/last-site';
import { routeApi } from '@/test-utils/api-mock';
import { makeSite, ok } from '@/test-utils/fixtures';
import { renderWithIntl } from '@/test-utils/render';
import { SiteProvider, useSiteSelection } from './site-context';
import { SiteSwitcher } from './site-switcher';

vi.mock('@/lib/api-client', () => ({ clientFetch: vi.fn() }));

const palm = makeSite({ name: 'Palm Tower' });
const nile = makeSite({ name: 'Nile Villas' });

function Chosen() {
  const { siteId } = useSiteSelection();
  return <output aria-label="chosen">{siteId ?? 'all'}</output>;
}

function renderSwitcher() {
  routeApi(clientFetch, { 'GET /sites': () => ok([palm, nile]) });
  renderWithIntl(
    <SiteProvider>
      <SiteSwitcher />
      <Chosen />
    </SiteProvider>,
  );
}

describe('SiteSwitcher', () => {
  afterEach(() => vi.mocked(clientFetch).mockReset());

  it('Site switcher preselects the last used site (§5.1)', async () => {
    window.localStorage.setItem(LAST_SITE_KEY, nile.id);
    renderSwitcher();

    await waitFor(() =>
      expect(screen.getByRole('combobox')).toHaveTextContent('Nile Villas'),
    );
    expect(screen.getByLabelText('chosen')).toHaveTextContent(nile.id);
  });

  it('choosing a site remembers it; a remembered site that is gone falls back to all sites', async () => {
    window.localStorage.setItem(LAST_SITE_KEY, 'gone-site');
    renderSwitcher();
    await waitFor(() =>
      expect(screen.getByLabelText('chosen')).toHaveTextContent('all'),
    );
    expect(window.localStorage.getItem(LAST_SITE_KEY)).toBeNull();

    const user = userEvent.setup();
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'Palm Tower' }));
    expect(window.localStorage.getItem(LAST_SITE_KEY)).toBe(palm.id);
    expect(screen.getByLabelText('chosen')).toHaveTextContent(palm.id);
  });
});
