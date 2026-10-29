// Test-only stand-in for the chrome.* APIs QuickReply uses, backed by the
// harness server so every page and origin shares one "chrome.storage.local".
// Injected by the harness before the extension code. Never shipped.
/* global __QR_MANIFEST__ */
(() => {
  const BASE = '__QR_BASE__';
  const MANIFEST = __QR_MANIFEST__;
  const listeners = new Set();
  const messageListeners = new Set();

  // Counters so tests can wait until the page has caught up with storage.
  window.__qrPending = 0;
  window.__qrGets = 0;
  window.__qrSeenVersion = 0;
  const tracked = async (fn) => {
    window.__qrPending++;
    try {
      return await fn();
    } finally {
      window.__qrPending--;
    }
  };

  const toKeys = (keys) => (keys == null ? null : Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : Object.keys(keys));

  const storageLocal = {
    get: (keys) => tracked(async () => {
      const res = await fetch(`${BASE}/__store`, { cache: 'no-store' });
      const { data: all } = await res.json();
      window.__qrGets++;
      const wanted = toKeys(keys);
      if (!wanted) return all;
      const out = {};
      for (const k of wanted) if (k in all) out[k] = all[k];
      return out;
    }),
    set: (items) => tracked(() => fetch(`${BASE}/__store`, { method: 'POST', body: JSON.stringify({ set: items }) })),
    remove: (keys) => tracked(() => fetch(`${BASE}/__store`, { method: 'POST', body: JSON.stringify({ remove: toKeys(keys) }) })),
  };

  window.__qrEventsOpen = false;
  const events = new EventSource(`${BASE}/__events`);
  events.onopen = () => {
    window.__qrEventsOpen = true;
  };
  // Free the connection when the page goes away (Chromium limits connections per host).
  window.addEventListener('pagehide', () => events.close());
  events.onmessage = (e) => {
    const { version, changes } = JSON.parse(e.data);
    for (const fn of listeners) fn(changes, 'local');
    window.__qrSeenVersion = version;
  };

  window.__qrPermissionsRequested = [];
  window.chrome = {
    runtime: {
      id: 'quickreply-test-harness',
      getURL: (path) => `${BASE}/ext/${path.replace(/^\//, '')}`,
      getManifest: () => MANIFEST,
      onMessage: { addListener: (fn) => messageListeners.add(fn), removeListener: (fn) => messageListeners.delete(fn) },
    },
    storage: {
      local: storageLocal,
      onChanged: { addListener: (fn) => listeners.add(fn), removeListener: (fn) => listeners.delete(fn) },
    },
    tabs: {
      async create({ url }) {
        window.__qrOpenedUrl = url;
        return {};
      },
      async query() {
        return window.__qrActiveTab ? [{ id: 1 }] : [];
      },
      async sendMessage() {
        if (window.__qrActiveTab) return { hostname: window.__qrActiveTab };
        throw new Error('Could not establish connection. Receiving end does not exist.');
      },
    },
    permissions: {
      async request(req) {
        window.__qrPermissionsRequested.push(req);
        return true;
      },
    },
  };
})();
