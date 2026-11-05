import { Label } from '@/components/ui/label';

/**
 * A form field's label (with the required asterisk), the control, and its error. The control's
 * `id` must match, and it points `aria-describedby` at `${id}-error` while an error shows.
 */
export function FormField({
  id,
  label,
  required = false,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="type-small font-bold">
        {label}
        {required && (
          <span aria-hidden className="text-destructive">
            *
          </span>
        )}
      </Label>
      {children}
      {hint && !error && (
        <p className="type-small text-muted-foreground">{hint}</p>
      )}
      {error && (
        <p id={`${id}-error`} className="type-small text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
