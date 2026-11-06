'use client';

import { Download, Share, SquarePlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  installPromptStore,
  isIosSafari,
  isStandalone,
  rememberDismissed,
  wasDismissed,
} from '@/lib/install-prompt';

type Device = 'hidden' | 'ios' | 'other';

const noSubscribe = () => () => {};
/** Read once on the client; the server (and the first hydration pass) renders no card. */
const readDevice = (): Device => {
  if (isStandalone() || wasDismissed()) return 'hidden';
  return isIosSafari() ? 'ios' : 'other';
};
const serverDevice = (): Device => 'hidden';

/**
 * "Install the app" (business §5.10, installable): a dismissible card on the dashboard and in
 * Settings. Browsers with an install prompt (Chrome, Edge, Samsung) get an Install button that
 * opens their own dialog; iPhone Safari, which has none, gets the Share → Add to Home Screen steps.
 * Hidden once installed, when already opened from the home screen, or once dismissed.
 */
export function InstallCard({ className }: { className?: string }) {
  const t = useTranslations('shell.install');
  const device = useSyncExternalStore(noSubscribe, readDevice, serverDevice);
  const prompt = useSyncExternalStore(
    installPromptStore.subscribe,
    installPromptStore.getPrompt,
    () => null,
  );
  const installed = useSyncExternalStore(
    installPromptStore.subscribe,
    installPromptStore.getInstalled,
    () => false,
  );
  const [dismissed, setDismissed] = useState(false);
  const [installing, setInstalling] = useState(false);

  const dismiss = () => {
    rememberDismissed();
    setDismissed(true);
  };
  const install = async () => {
    setInstalling(true);
    try {
      const outcome = await installPromptStore.install();
      if (outcome === 'accepted') setDismissed(true);
    } finally {
      setInstalling(false);
    }
  };

  if (device === 'hidden' || dismissed || installed) return null;
  const ios = device === 'ios';
  if (!ios && !prompt && !installing) return null;

  return (
    <section
      aria-labelledby="install-card-title"
      data-testid="install-card"
      className={cn(
        'flex flex-col gap-3 rounded-lg border-2 border-primary bg-card p-4',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- a 48px static icon; next/image adds nothing */}
        <img
          src="/icons/icon-192.png"
          alt=""
          width={48}
          height={48}
          className="size-12 shrink-0 rounded-md"
        />
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id="install-card-title" className="type-body font-bold">
            {ios ? t('iosTitle') : t('title')}
          </h2>
          {!ios && (
            <p className="type-small text-muted-foreground">{t('body')}</p>
          )}
        </div>
      </div>
      {ios && (
        <ol className="flex flex-col gap-2 type-small">
          <li className="flex items-center gap-2.5">
            <Share aria-hidden className="size-5 shrink-0" />
            <span>{t('iosStep1')}</span>
          </li>
          <li className="flex items-center gap-2.5">
            <SquarePlus aria-hidden className="size-5 shrink-0" />
            <span>{t('iosStep2')}</span>
          </li>
        </ol>
      )}
      <div className="flex flex-wrap gap-2">
        {!ios && (
          <Button
            size="sm"
            onClick={() => void install()}
            disabled={installing}
            data-testid="install-app"
          >
            <Download aria-hidden />
            {installing ? t('installing') : t('action')}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={dismiss}
          data-testid="install-dismiss"
        >
          {ios ? t('gotIt') : t('dismiss')}
        </Button>
      </div>
    </section>
  );
}
