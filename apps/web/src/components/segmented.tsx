'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

/** Two or three mutually exclusive views of one list (active / archived), as tabs. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  disabled = false,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as T)}>
      <TabsList aria-label={label} className="h-12 w-full md:w-fit">
        {options.map((o) => (
          <TabsTrigger
            key={o.value}
            value={o.value}
            disabled={disabled}
            className="cursor-pointer px-4 type-small font-bold"
          >
            {o.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
