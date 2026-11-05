'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type TitleState = [string | null, (title: string | null) => void];

const ShellTitleContext = createContext<TitleState>([null, () => undefined]);

/** Holds the top bar's title override for the page on screen. */
export function ShellTitleProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const state = useState<string | null>(null);
  return (
    <ShellTitleContext.Provider value={state}>
      {children}
    </ShellTitleContext.Provider>
  );
}

export const useShellTitleOverride = (): string | null =>
  useContext(ShellTitleContext)[0];

/**
 * The top bar's title slot. A page renders `<ShellTitle title="#38" />` to replace the default
 * (its nav label); the override goes away with the page.
 */
export function ShellTitle({ title }: { title: string }) {
  const [, setTitle] = useContext(ShellTitleContext);
  useEffect(() => {
    setTitle(title);
    return () => setTitle(null);
  }, [title, setTitle]);
  return null;
}
