'use client';

import {
  ISSUE_STATUSES,
  PRIORITIES,
  type Locale,
  type ParsedIssueFilter,
} from '@muayana/shared';
import { format, parseISO } from 'date-fns';
import { CalendarDays, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { STATUS_DOT } from '@/components/status-chip';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { categoryName } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { FilterOptions } from './use-filter-options';

/** Radix Select can't hold an empty value: this one stands for "no filter". */
const ANY = '__any__';

/**
 * Every filter field of the issues list except search and sort (they sit above the list). The
 * same form fills the phone's bottom sheet and the desktop side panel.
 */
export function FilterForm({
  value,
  onChange,
  options,
}: {
  value: ParsedIssueFilter;
  onChange: (next: ParsedIssueFilter) => void;
  options: FilterOptions;
}) {
  const t = useTranslations('issues.filters');
  const tFields = useTranslations('common.fields');
  const tStatus = useTranslations('common.status');
  const tPriority = useTranslations('common.priority');
  const tTable = useTranslations('issues.table');
  const locale = useLocale() as Locale;
  const set = (patch: Partial<ParsedIssueFilter>) =>
    onChange({ ...value, ...patch });

  return (
    <div className="flex flex-col gap-5">
      <OptionSelect
        label={tFields('site')}
        anyLabel={t('any')}
        value={value.siteId}
        items={options.sites.map((s) => ({ id: s.id, label: s.name }))}
        onChange={(siteId) => set({ siteId })}
      />
      <OptionSelect
        label={tFields('category')}
        anyLabel={t('any')}
        value={value.categoryId}
        items={options.categories.map((c) => ({
          id: c.id,
          label: categoryName(c, locale),
        }))}
        onChange={(categoryId) => set({ categoryId })}
      />
      <OptionSelect
        label={tFields('worker')}
        anyLabel={t('any')}
        value={value.workerId}
        items={options.workers.map((w) => ({ id: w.id, label: w.name }))}
        onChange={(workerId) => set({ workerId })}
      />

      <ToggleGroup
        label={tTable('status')}
        values={ISSUE_STATUSES}
        selected={value.status ?? []}
        labelOf={(s) => tStatus(s)}
        dotOf={(s) => STATUS_DOT[s]}
        onChange={(status) =>
          set({ status: status.length ? status : undefined })
        }
      />
      <ToggleGroup
        label={tFields('priority')}
        values={PRIORITIES}
        selected={value.priority ?? []}
        labelOf={(p) => tPriority(p)}
        onChange={(priority) =>
          set({ priority: priority.length ? priority : undefined })
        }
      />

      <OverdueSwitch
        label={t('overdueOnly')}
        checked={value.overdue === true}
        onChange={(on) => set({ overdue: on ? true : undefined })}
      />

      <DateRange
        legend={t('captured')}
        from={value.capturedFrom}
        to={value.capturedTo}
        onChange={(capturedFrom, capturedTo) =>
          set({ capturedFrom, capturedTo })
        }
      />
      <DateRange
        legend={t('solved')}
        from={value.solvedFrom}
        to={value.solvedTo}
        onChange={(solvedFrom, solvedTo) => set({ solvedFrom, solvedTo })}
      />
    </div>
  );
}

function OptionSelect({
  label,
  anyLabel,
  value,
  items,
  onChange,
}: {
  label: string;
  anyLabel: string;
  value: string | undefined;
  items: { id: string; label: string }[];
  onChange: (id: string | undefined) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="type-small font-bold">
        {label}
      </Label>
      <Select
        value={value ?? ANY}
        onValueChange={(v) => onChange(v === ANY ? undefined : v)}
      >
        <SelectTrigger id={id} className="w-full cursor-pointer">
          <SelectValue placeholder={anyLabel} />
        </SelectTrigger>
        <SelectContent position="popper" className="scrollbar-clean max-h-72">
          <SelectItem value={ANY}>{anyLabel}</SelectItem>
          {items.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ToggleGroup<T extends string>({
  label,
  values,
  selected,
  labelOf,
  dotOf,
  onChange,
}: {
  label: string;
  values: readonly T[];
  selected: readonly T[];
  labelOf: (value: T) => string;
  dotOf?: (value: T) => string;
  onChange: (next: T[]) => void;
}) {
  const toggle = (value: T) =>
    onChange(
      values.filter((v) =>
        v === value ? !selected.includes(v) : selected.includes(v),
      ),
    );
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 type-small font-bold">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {values.map((value) => {
          const on = selected.includes(value);
          return (
            <button
              key={value}
              type="button"
              data-value={value}
              aria-pressed={on}
              onClick={() => toggle(value)}
              className={cn(
                'inline-flex min-h-11 press cursor-pointer items-center gap-2 rounded-md border-2 px-3 type-small font-bold',
                on
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-card hover:border-foreground/40',
              )}
            >
              {dotOf && (
                <span
                  className={cn('size-2.5 rounded-full', dotOf(value))}
                  aria-hidden
                />
              )}
              {labelOf(value)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function OverdueSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <Label htmlFor={id} className="type-small font-bold">
        {label}
      </Label>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        className="cursor-pointer"
      />
    </div>
  );
}

function DateRange({
  legend,
  from,
  to,
  onChange,
}: {
  legend: string;
  from: string | undefined;
  to: string | undefined;
  onChange: (from: string | undefined, to: string | undefined) => void;
}) {
  const t = useTranslations('issues.filters');
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 type-small font-bold">{legend}</legend>
      <div className="grid grid-cols-2 gap-2">
        <DateField
          label={t('from')}
          value={from}
          onChange={(v) => onChange(v, to)}
        />
        <DateField
          label={t('to')}
          value={to}
          onChange={(v) => onChange(from, v)}
        />
      </div>
    </fieldset>
  );
}

/** A `YYYY-MM-DD` picked on a calendar (never the native date input). */
function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}) {
  const t = useTranslations('issues.filters');
  const [open, setOpen] = useState(false);
  const selected = value ? parseISO(value) : undefined;
  return (
    <div className="flex flex-col gap-1">
      <span className="type-micro text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={`${label}: ${value ?? t('pickDate')}`}
              className="min-w-0 flex-1 justify-start font-normal"
            >
              <CalendarDays aria-hidden />
              {value ? (
                <span className="type-stencil" dir="ltr">
                  {value}
                </span>
              ) : (
                <span className="truncate text-muted-foreground">
                  {t('pickDate')}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selected}
              defaultMonth={selected}
              onSelect={(day) => {
                onChange(day ? format(day, 'yyyy-MM-dd') : undefined);
                setOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t('clearDate')}
            onClick={() => onChange(undefined)}
          >
            <X aria-hidden />
          </Button>
        )}
      </div>
    </div>
  );
}
