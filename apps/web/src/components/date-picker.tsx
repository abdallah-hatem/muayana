'use client';

import { format, parse } from 'date-fns';
import { CalendarDays, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { BOTTOM_NAV_QUERY, useMediaQuery } from '@/lib/use-media-query';
import { cn } from '@/lib/utils';

const DATE_ONLY = 'yyyy-MM-dd';

/**
 * On a phone, keep the calendar clear of the bottom nav and its raised shutter: Radix flips it
 * above the trigger only when it would run under them. From md up there is no bottom nav, so it
 * flips only at the window's edge.
 */
const CLEAR_BOTTOM_NAV = { top: 8, right: 8, bottom: 112, left: 8 };
const CLEAR_EDGES = 8;

const toDate = (value: string | null): Date | undefined =>
  value ? parse(value, DATE_ONLY, new Date()) : undefined;

/**
 * A date-only (`YYYY-MM-DD`) picker: a button showing the date in stencil mono, a calendar in a
 * popover. Picking a day calls `onChange` and closes it.
 */
export function DatePicker({
  id,
  value,
  onChange,
  placeholder,
  disabled = false,
  busy = false,
  className,
  describedBy,
}: {
  id?: string;
  value: string | null;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  busy?: boolean;
  className?: string;
  describedBy?: string;
}) {
  const [open, setOpen] = useState(false);
  const phone = useMediaQuery(BOTTOM_NAV_QUERY);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled || busy}
          aria-describedby={describedBy}
          className={cn('justify-start', className)}
        >
          {busy ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <CalendarDays aria-hidden />
          )}
          {value ? (
            <span className="type-stencil" dir="ltr">
              {value}
            </span>
          ) : (
            <span className="truncate">{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0"
        align="start"
        collisionPadding={phone ? CLEAR_BOTTOM_NAV : CLEAR_EDGES}
      >
        <Calendar
          mode="single"
          selected={toDate(value)}
          onSelect={(day) => {
            if (!day) return;
            setOpen(false);
            onChange(format(day, DATE_ONLY));
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
