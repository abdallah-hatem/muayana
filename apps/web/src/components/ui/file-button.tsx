'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';

/**
 * A file chooser that looks like the design's button: the native input stays hidden and the
 * button opens it. Each choice is handed over and the input is cleared, so the same file can be
 * chosen again.
 */
function FileButton({
  accept,
  multiple = false,
  capture,
  onFiles,
  children,
  inputLabel,
  ...buttonProps
}: Omit<React.ComponentProps<typeof Button>, 'onClick' | 'type'> & {
  accept: string;
  multiple?: boolean;
  capture?: 'user' | 'environment';
  onFiles: (files: File[]) => void;
  /** Accessible name of the hidden input (tests and screen readers reach it by this). */
  inputLabel: string;
}) {
  const input = React.useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        capture={capture}
        aria-label={inputLabel}
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = '';
          if (files.length > 0) onFiles(files);
        }}
      />
      <Button
        type="button"
        {...buttonProps}
        onClick={() => input.current?.click()}
      >
        {children}
      </Button>
    </>
  );
}

export { FileButton };
