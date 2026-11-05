/**
 * An optional free-text field after trimming: left out stays undefined (no change), blank
 * becomes null (cleared), anything else is kept.
 */
export const blankToNull = (
  value: string | null | undefined,
): string | null | undefined =>
  value === undefined ? undefined : value === null || value === '' ? null : value;
