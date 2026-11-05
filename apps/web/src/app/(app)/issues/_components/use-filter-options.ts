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
 */
export function useFilterOptions(): FilterOptions {
  const [options, setOptions] = useState<FilterOptions>(EMPTY);
  useEffect(() => {
    let alive = true;
    void Promise.all([
      clientFetch<Site[]>('/sites?archived=all&limit=100'),
      clientFetch<Category[]>('/categories?active=all'),
      clientFetch<Worker[]>('/workers?active=all&limit=100'),
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
    };
  }, []);
  return options;
}
