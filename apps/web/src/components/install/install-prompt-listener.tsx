'use client';

// Loading the store attaches its `beforeinstallprompt` listener. The browser can fire that event on
// any page, before an install card is on screen, so the shell loads it on every signed-in page.
import '@/lib/install-prompt';

export function InstallPromptListener() {
  return null;
}
