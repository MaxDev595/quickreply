import { useEffect, useState } from 'react';
import { loadState, subscribe, type AppState } from '../lib/storage';
import { applyTheme } from './theme';

/** Live view of everything in chrome.storage.local. */
export function useAppState(): AppState | null {
  const [state, setState] = useState<AppState | null>(null);

  useEffect(() => {
    let alive = true;
    loadState().then((s) => alive && setState(s), () => undefined);
    const unsubscribe = subscribe((s) => alive && setState(s));
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  const theme = state?.settings.theme;
  useEffect(() => {
    if (theme) applyTheme(theme);
  }, [theme]);

  return state;
}
