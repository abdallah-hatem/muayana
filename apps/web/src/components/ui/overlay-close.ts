/**
 * The ✕ in the corner of a sheet or dialog: a 44px tap target (the icon stays 20px), tucked 8px
 * from the corner so it lines up with a 16px-padded header.
 */
export const OVERLAY_CLOSE =
  "absolute end-2 top-2 flex size-11 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5";

/** The grabber bar at the top of every bottom sheet (Sheet from the bottom and the vaul Drawer). */
export const SHEET_GRABBER =
  'mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-input';
