/**
 * The look shared by every popover list in the kit — Select, DropdownMenu, Command — so they read
 * as one product and can't drift apart: a solid card with the 2px "site tape" border, 44px rows of
 * 16px text, the safety-yellow highlight with ink on it, a bold selected row.
 */

/** The floating surface: solid card, 2px border, float shadow, quick fade + scale from the trigger. */
export const LIST_CONTENT =
  'z-50 rounded-lg border-2 border-border bg-popover text-popover-foreground shadow-float data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:duration-(--motion-fast) data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:duration-(--motion-base)';

/**
 * One row. Radix marks the keyboard/pointer row `data-highlighted`, cmdk marks it
 * `data-selected=true`; both get the same highlight. Muted text and icons inside a highlighted row
 * switch to ink so they stay readable on yellow in both themes.
 */
export const LIST_ROW =
  "group/row relative flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-md py-2 ps-3 pe-3 text-start text-base font-medium outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-[highlighted]:bg-primary data-[highlighted]:text-primary-foreground data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground data-[state=checked]:font-bold [&[data-highlighted]_.text-muted-foreground]:text-primary-foreground [&[data-selected=true]_.text-muted-foreground]:text-primary-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5 [&_svg:not([class*='text-'])]:text-muted-foreground [&[data-highlighted]_svg:not([class*='text-'])]:text-primary-foreground [&[data-selected=true]_svg:not([class*='text-'])]:text-primary-foreground";

export const LIST_SEPARATOR = '-mx-1.5 my-1.5 h-0.5 bg-border';

/** A group heading inside a list. */
export const LIST_LABEL = 'px-3 pt-2 pb-1 type-micro text-muted-foreground';
