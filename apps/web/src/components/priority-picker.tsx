'use client';

import { useTranslations } from 'next-intl';
import { PRIORITIES, priorityLabelKey, type Priority } from '@muayana/shared';
import { cn } from '@/lib/utils';

/** The four priorities as one segmented control (low → urgent). */
export function PriorityPicker({
  value,
  onChange,
  disabled = false,
  labelledBy,
}: {
  value: Priority;
  onChange: (priority: Priority) => void;
  disabled?: boolean;
  labelledBy?: string;
}) {
  const t = useTranslations('common');
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      className="grid grid-cols-4 gap-1 rounded-md border-2 border-border bg-card p-1"
    >
      {PRIORITIES.map((priority) => {
        const chosen = priority === value;
        return (
          <button
            key={priority}
            type="button"
            role="radio"
            aria-checked={chosen}
            disabled={disabled}
            onClick={() => onChange(priority)}
            className={cn(
              'h-10 min-w-0 press cursor-pointer truncate rounded-sm px-1 type-small font-bold',
              'disabled:cursor-not-allowed disabled:opacity-50',
              chosen
                ? priority === 'urgent'
                  ? 'bg-destructive text-destructive-foreground'
                  : 'bg-foreground text-background'
                : 'text-muted-foreground hover:bg-accent',
            )}
          >
            {t(priorityLabelKey(priority))}
          </button>
        );
      })}
    </div>
  );
}
