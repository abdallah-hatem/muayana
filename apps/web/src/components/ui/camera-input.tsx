'use client';

import * as React from 'react';

/**
 * The phone camera, as an invisible file input (`capture="environment"` opens the back camera;
 * a desktop gets the file picker). `source="gallery"` opens the phone's photos instead, several
 * at a time. Never shown: a designed button calls `ref.current.click()`.
 * The value is cleared after each pick so the same file can be chosen twice in a row.
 */
function CameraInput({
  onFiles,
  source = 'camera',
  ...props
}: Omit<
  React.ComponentProps<'input'>,
  'type' | 'accept' | 'capture' | 'onChange' | 'multiple'
> & {
  onFiles: (files: File[]) => void;
  source?: 'camera' | 'gallery';
}) {
  const gallery = source === 'gallery';
  return (
    <input
      type="file"
      accept="image/*"
      capture={gallery ? undefined : 'environment'}
      multiple={gallery}
      tabIndex={-1}
      aria-hidden
      className="sr-only"
      data-slot={gallery ? 'gallery-input' : 'camera-input'}
      onChange={(event) => {
        const files = Array.from(event.currentTarget.files ?? []);
        event.currentTarget.value = '';
        if (files.length) onFiles(files);
      }}
      {...props}
    />
  );
}

export { CameraInput };
