import { isGetPageInfoRequest, type PageInfo } from '../lib/messages';
import { loadState, recordUsage, subscribe } from '../lib/storage';
import { readClipboard } from './clipboard';
import { Expander } from './expander';

/** Hostname of the top-level page, so site exclusions also cover embedded editors. */
function pageHostname(): string {
  if (window.top === window) return location.hostname;
  const origins = location.ancestorOrigins;
  const topOrigin = origins.length > 0 ? origins[origins.length - 1] : undefined;
  if (topOrigin) {
    try {
      return new URL(topOrigin).hostname;
    } catch {
      /* fall through */
    }
  }
  return location.hostname;
}

/** After an extension update the old content script loses its runtime. */
const contextAlive = (): boolean => typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id);

function main(): void {
  const hostname = pageHostname();
  let unsubscribe: (() => void) | null = null;

  const expander = new Expander({
    hostname,
    readClipboard,
    onExpanded: (id) => {
      if (!contextAlive()) return teardown();
      recordUsage(id).catch(() => undefined);
    },
  });

  function teardown(): void {
    expander.stop();
    unsubscribe?.();
  }

  loadState()
    .then((state) => {
      expander.update(state.snippets, state.settings);
      expander.start();
      unsubscribe = subscribe((next) => {
        if (!contextAlive()) return teardown();
        expander.update(next.snippets, next.settings);
      });
    })
    .catch(() => undefined);

  if (window.top === window) {
    chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
      if (sender.id !== chrome.runtime.id || !isGetPageInfoRequest(message)) return false;
      const info: PageInfo = { hostname };
      sendResponse(info);
      return false;
    });
  }
}

// Guard against double injection (e.g. extension reload while the tab stays open).
const FLAG = '__quickreplyContentLoaded';
const globalScope = globalThis as typeof globalThis & { [FLAG]?: boolean };
if (!globalScope[FLAG] && contextAlive()) {
  globalScope[FLAG] = true;
  main();
}
