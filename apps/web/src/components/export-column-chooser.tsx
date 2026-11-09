'use client';

import {
  ISSUE_EXPORT_COLUMNS,
  exportColumnLabel,
  type ExportTarget,
  type IssueExportColumn,
  type Locale,
} from '@muayana/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

/** The default choice of every issue export: all §7 columns, in order. */
export const defaultExportColumns = (): IssueExportColumn[] => [
  ...ISSUE_EXPORT_COLUMNS,
];

/** `column` turned on/off, the result kept in §7 order. */
export const toggleExportColumn = (
  current: readonly IssueExportColumn[],
  column: IssueExportColumn,
  on: boolean,
): IssueExportColumn[] =>
  ISSUE_EXPORT_COLUMNS.filter((c) => (c === column ? on : current.includes(c)));

/**
 * The issue export column picker (business §7) shared by the issues CSV and the contractor Excel:
 * every column of the one shared list, labelled in the app's language — the same language the
 * file's headers are written in, and named for the file it builds (`target`: the Excel's photo
 * columns are pictures, the CSV's are links). Picking none shows why the export can't run.
 */
export function ExportColumnChooser({
  value,
  onChange,
  target = 'csv',
}: {
  value: readonly IssueExportColumn[];
  onChange: (columns: IssueExportColumn[]) => void;
  target?: ExportTarget;
}) {
  const t = useTranslations('export.columns');
  const locale = useLocale() as Locale;
  return (
    <fieldset className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <legend className="type-small font-bold">{t('title')}</legend>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(defaultExportColumns())}
          >
            {t('selectAll')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange([])}
          >
            {t('selectNone')}
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {ISSUE_EXPORT_COLUMNS.map((column) => (
          <ColumnCheckbox
            key={column}
            label={exportColumnLabel(column, locale, target)}
            checked={value.includes(column)}
            onChange={(on) => onChange(toggleExportColumn(value, column, on))}
          />
        ))}
      </div>
      {value.length === 0 && (
        <p role="alert" className="type-small text-destructive">
          {t('none')}
        </p>
      )}
    </fieldset>
  );
}

function ColumnCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  const id = useId();
  // The whole 44px row is the label, so a tap anywhere on it toggles the box; the label also
  // names the checkbox for screen readers.
  return (
    <Label
      htmlFor={id}
      className="min-h-11 cursor-pointer gap-3 rounded-md px-2 type-small hover:bg-accent/50"
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(state) => onChange(state === true)}
        className="size-5"
      />
      <span className="flex-1 py-2 leading-snug">{label}</span>
    </Label>
  );
}
