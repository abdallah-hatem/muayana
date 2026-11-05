'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Switch as SwitchPrimitive } from 'radix-ui';

function Switch({
  className,
  size = 'default',
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: 'sm' | 'default';
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        // Visual track 44×24 (sm 32×18); an invisible 44px-tall area around it takes the tap.
        "peer group/switch relative inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-[background-color,border-color,box-shadow] outline-none after:absolute after:-inset-x-1 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-[''] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-6 data-[size=default]:w-11 data-[size=sm]:h-[1.125rem] data-[size=sm]:w-8 data-[state=checked]:border-foreground data-[state=checked]:bg-primary data-[state=unchecked]:bg-input dark:data-[state=checked]:border-primary",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          'pointer-events-none block rounded-full bg-card shadow-card ring-0 transition-transform group-data-[size=default]/switch:size-5 group-data-[size=sm]/switch:size-3.5 data-[state=checked]:bg-primary-foreground group-data-[size=default]/switch:data-[state=checked]:translate-x-5 group-data-[size=sm]/switch:data-[state=checked]:translate-x-3.5 data-[state=unchecked]:translate-x-0 rtl:group-data-[size=default]/switch:data-[state=checked]:-translate-x-5 rtl:group-data-[size=sm]/switch:data-[state=checked]:-translate-x-3.5',
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
