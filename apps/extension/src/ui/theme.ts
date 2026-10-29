import type { ThemePreference } from '@quickreply/shared';

let media: MediaQueryList | null = null;
let mediaListener: (() => void) | null = null;

/** Applies the theme to <html> and follows the OS setting when set to "system". */
export function applyTheme(pref: ThemePreference): void {
  media ??= window.matchMedia('(prefers-color-scheme: dark)');
  const set = () => {
    const dark = pref === 'dark' || (pref === 'system' && media?.matches === true);
    document.documentElement.classList.toggle('dark', dark);
  };
  if (mediaListener) media.removeEventListener('change', mediaListener);
  mediaListener = pref === 'system' ? set : null;
  if (mediaListener) media.addEventListener('change', mediaListener);
  set();
}
