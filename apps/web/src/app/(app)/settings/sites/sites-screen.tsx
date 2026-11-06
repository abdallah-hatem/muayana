'use client';

import {
  Archive,
  ArchiveRestore,
  Building2,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import type { Site } from '@muayana/shared';
import { ConfirmSheet } from '@/components/confirm-sheet';
import { EmptyState } from '@/components/empty-state';
import { ListPager } from '@/components/list-pager';
import { LoadError } from '@/components/load-error';
import { PageHeader } from '@/components/page-header';
import { Segmented } from '@/components/segmented';
import { useSiteSelection } from '@/components/site/site-context';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiErrorText } from '@/components/use-api-error-text';
import { usePagedList } from '@/components/use-paged-list';
import { usePendingAction } from '@/components/use-pending-action';
import {
  deleteSite,
  listSites,
  updateSite,
  type SiteTab,
} from '@/lib/directory-endpoints';
import { ROUTES } from '@/lib/routes';
import { cn } from '@/lib/utils';
import { SiteFormSheet } from './site-form-sheet';

type Editing = { site: Site | null; key: number } | null;

/**
 * Sites (business §3): active and archived tabs, create / edit, archive and restore, delete only
 * a site with no issues — one with issues offers "Archive instead".
 */
export function SitesScreen() {
  const t = useTranslations('sites');
  const errorText = useApiErrorText();
  const { sitesChanged } = useSiteSelection();
  const [tab, setTab] = useState<SiteTab>('active');
  const fetchPage = useCallback(
    (page: number, limit: number, signal: AbortSignal) =>
      listSites(tab, page, limit, signal),
    [tab],
  );
  const list = usePagedList(fetchPage);
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<Site | null>(null);
  const [deleteInUse, setDeleteInUse] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const action = usePendingAction();

  const changed = () => {
    list.reload();
    sitesChanged();
  };

  async function setArchived(site: Site, archived: boolean) {
    await action.run(async () => {
      setBusyId(site.id);
      const res = await updateSite(site.id, { archived });
      setBusyId(null);
      if (res.success) {
        toast.success(t(archived ? 'toast.archived' : 'toast.unarchived'));
        setDeleting(null);
        changed();
      } else if (res.status !== 401) toast.error(errorText(res));
    });
  }

  function askDelete(site: Site) {
    setDeleteError(null);
    setDeleteInUse(site.counts.total > 0);
    setDeleting(site);
  }

  async function confirmDelete() {
    if (!deleting) return;
    await action.run(async () => {
      const res = await deleteSite(deleting.id);
      if (res.success) {
        toast.success(t('toast.deleted'));
        setDeleting(null);
        changed();
      } else if (res.status === 409) setDeleteInUse(true);
      else if (res.status !== 401) setDeleteError(errorText(res));
    });
  }

  const newButton = (
    <Button
      type="button"
      onClick={() => setEditing({ site: null, key: Date.now() })}
    >
      <Plus aria-hidden />
      {t('new')}
    </Button>
  );

  return (
    <section
      data-testid="screen-sites"
      className="mx-auto flex w-full max-w-2xl flex-col gap-4"
    >
      <PageHeader
        title={t('title')}
        back={{ href: ROUTES.settings, label: t('back') }}
        actions={newButton}
      />
      <Segmented
        label={t('tabs.label')}
        value={tab}
        onChange={setTab}
        options={[
          { value: 'active', label: t('tabs.active') },
          { value: 'archived', label: t('tabs.archived') },
        ]}
      />

      {list.status === 'loading' ? (
        <ListSkeleton />
      ) : list.status === 'error' ? (
        <LoadError message={t('loadFailed')} onRetry={list.reload} />
      ) : list.items.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={t(
            tab === 'active' ? 'empty.activeTitle' : 'empty.archivedTitle',
          )}
          body={t(tab === 'active' ? 'empty.activeBody' : 'empty.archivedBody')}
          action={tab === 'active' ? newButton : undefined}
        />
      ) : (
        <>
          <ul
            aria-busy={list.refreshing}
            className={cn(
              'flex flex-col gap-3 transition-opacity',
              list.refreshing && 'opacity-60',
            )}
          >
            {list.items.map((site) => (
              <li
                key={site.id}
                className="flex flex-col gap-3 rounded-lg border-2 border-border bg-card p-4 shadow-card"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <h3 className="min-w-0 type-heading break-words">
                      {site.name}
                    </h3>
                    {site.archived && (
                      <span className="shrink-0 rounded-sm bg-muted px-2 py-0.5 type-micro font-bold text-muted-foreground uppercase">
                        {t('archivedBadge')}
                      </span>
                    )}
                  </div>
                  {site.address && (
                    <p className="type-small break-words text-muted-foreground">
                      {site.address}
                    </p>
                  )}
                  <p className="type-small text-muted-foreground">
                    {t('counts', {
                      open: site.counts.open,
                      total: site.counts.total,
                    })}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditing({ site, key: Date.now() })}
                  >
                    <Pencil aria-hidden />
                    {t('actions.edit')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={action.pending}
                    onClick={() => void setArchived(site, !site.archived)}
                  >
                    {busyId === site.id ? (
                      <Loader2 className="animate-spin" aria-hidden />
                    ) : site.archived ? (
                      <ArchiveRestore aria-hidden />
                    ) : (
                      <Archive aria-hidden />
                    )}
                    {t(site.archived ? 'actions.unarchive' : 'actions.archive')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => askDelete(site)}
                  >
                    <Trash2 aria-hidden />
                    {t('actions.delete')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <ListPager
            page={list.page}
            limit={list.limit}
            total={list.total}
            disabled={list.refreshing}
            onPageChange={list.setPage}
          />
        </>
      )}

      {editing && (
        <SiteFormSheet
          key={editing.key}
          open
          site={editing.site}
          onOpenChange={(open) => !open && setEditing(null)}
          onSaved={(_, created) => {
            setEditing(null);
            toast.success(t(created ? 'toast.created' : 'toast.saved'));
            changed();
          }}
        />
      )}

      <ConfirmSheet
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t(deleteInUse ? 'delete.inUseTitle' : 'delete.title')}
        body={t(deleteInUse ? 'delete.inUseBody' : 'delete.body')}
        confirmLabel={t('delete.confirm')}
        destructive
        busy={action.pending}
        error={deleteError}
        onConfirm={() => void confirmDelete()}
        alternative={
          !deleteInUse ? undefined : deleting && !deleting.archived ? (
            <Button
              type="button"
              disabled={action.pending}
              onClick={() => void setArchived(deleting, true)}
            >
              {action.pending ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Archive aria-hidden />
              )}
              {t('delete.archiveInstead')}
            </Button>
          ) : null
        }
      />
    </section>
  );
}

function ListSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-3">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-32 w-full rounded-lg" />
      ))}
    </div>
  );
}
