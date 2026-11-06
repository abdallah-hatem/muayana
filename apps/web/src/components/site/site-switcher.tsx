'use client';

import { MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import type { Site } from '@muayana/shared';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { capturePrefs } from '@/lib/capture-prefs';
import { listActiveSites } from '@/lib/issue-endpoints';
import { useSiteSelection } from './site-context';

const ALL = '__all__';

/**
 * The top bar's site pill (`data-slot="site-switcher"`): all sites or one active site. The last
 * one used is preselected (business §5.1); a remembered site that is gone or archived falls back to
 * all sites.
 */
export function SiteSwitcher() {
  const t = useTranslations('shell.siteSwitcher');
  const { siteId, setSiteId, ready, sitesVersion } = useSiteSelection();
  const [sites, setSites] = useState<Pick<Site, 'id' | 'name'>[] | null>(
    null,
  );
  // Only a list the API gave can prove the remembered site is gone; the phone's copy (offline)
  // can be out of date.
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    let live = true;
    const controller = new AbortController();
    void listActiveSites(controller.signal).then((res) => {
      if (!live) return;
      setConfirmed(res.success);
      setSites(res.success ? res.data : (capturePrefs.cachedSites() ?? []));
    });
    return () => {
      live = false;
      controller.abort();
    };
  }, [sitesVersion]);

  useEffect(() => {
    if (!ready || !confirmed || sites === null || siteId === null) return;
    if (!sites.some((s) => s.id === siteId)) setSiteId(null);
  }, [ready, confirmed, sites, siteId, setSiteId]);

  const current = sites?.find((s) => s.id === siteId);
  const value = current ? current.id : ALL;

  return (
    // Takes the top bar's leftover room; the label ends in an ellipsis and, when even that is too
    // narrow (a phone with the queue chip), only the pin shows — the trigger keeps its name.
    <div data-slot="site-switcher" className="min-w-0 flex-1 sm:flex-none">
      <Select
        value={value}
        onValueChange={(next) => setSiteId(next === ALL ? null : next)}
        disabled={sites === null}
      >
        <SelectTrigger
          aria-label={t('label')}
          className="@container h-11 w-full min-w-0 gap-1.5 rounded-full border-0 bg-secondary px-3 type-small font-bold text-secondary-foreground data-[size=default]:h-11 sm:w-60"
        >
          <MapPin className="size-4 shrink-0" aria-hidden />
          {/* Below 7.5rem the label would be a letter or two, so only the pin shows. The query
              hides the inner span: the kit's `*:data-[slot=select-value]:flex` outranks a
              `hidden` on the value itself. */}
          <SelectValue
            placeholder={t('placeholder')}
            className="min-w-0 flex-1"
          >
            <span
              dir="auto"
              className="min-w-0 truncate text-start @max-[7.5rem]:hidden"
            >
              {current ? current.name : t('placeholder')}
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent position="popper" align="start">
          <SelectItem value={ALL}>{t('placeholder')}</SelectItem>
          {(sites ?? []).map((site) => (
            <SelectItem key={site.id} value={site.id}>
              <span dir="auto">{site.name}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
