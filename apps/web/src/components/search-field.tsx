'use client';

import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

/** A list's search box: the magnifier inside, 16px text on phones. */
export function SearchField({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="ps-12 text-base md:text-sm"
      />
    </div>
  );
}
