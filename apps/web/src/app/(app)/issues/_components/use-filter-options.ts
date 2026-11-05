'use client';

import type { Category, Site, Worker } from '@muayana/shared';
import { useEffect, useState } from 'react';
import { clientFetch } from '@/lib/api-client';

export type FilterOptions = {
  sites: Pick<Site, 'id' | 'name' | 'archived'>[];
  categories: Pick<Category, 'id' | 'nameAr' | 'nameEn' | 'color'>[];
  workers: Pick<Worker, 'id' | 'name'>[];
};

const EMPTY: FilterOptions = { sites: [], categories: [], workers: [] };

/**
 * What the site / category / worker filters offer, archived and inactive included (old issues
 * still point at them). A failed list leaves that picker empty; the rest of the screen works.
 * Aborted on unmount: leaving the screen must not leave its requests holding connections.
 */
export function useFilterOptions(): FilterOptions {
  const [options, setOptions] = useState<FilterOptions>(EMPTY);
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    const { signal } = controller;
    void Promise.all([
      clientFetch<Site[]>('/sites?archived=all&limit=100', { signal }),
      clientFetch<Category[]>('/categories?active=all', { signal }),
      clientFetch<Worker[]>('/workers?active=all&limit=100', { signal }),
    ]).then(([sites, categories, workers]) => {
      if (!alive) return;
      setOptions({
        sites: sites.success ? (sites.data ?? []) : [],
        categories: categories.success ? (categories.data ?? []) : [],
        workers: workers.success ? (workers.data ?? []) : [],
      });
    });
    return () => {
      alive = false;
      controller.abort();
    };
  }, []);
  return options;
}
