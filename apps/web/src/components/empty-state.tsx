import type { LucideIcon } from 'lucide-react';

/**
 * An empty list: the hazard stripe, an icon, what is (not) here and what to do next. `action` is
 * the way to the first item (a button or link).
 */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border p-8 text-center">
      <div className="h-3 w-24 rounded-sm hazard-stripe" aria-hidden />
      <Icon className="size-10 text-muted-foreground" aria-hidden />
      <p className="type-heading">{title}</p>
      {body && <p className="type-body text-muted-foreground">{body}</p>}
      {action}
    </div>
  );
}
