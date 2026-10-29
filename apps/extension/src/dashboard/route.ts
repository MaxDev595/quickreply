import { useEffect, useState } from 'react';

export type View =
  | { kind: 'all' }
  | { kind: 'favorites' }
  | { kind: 'recent' }
  | { kind: 'folder'; id: string }
  | { kind: 'settings' };

export interface Route {
  view: View;
  /** Selected snippet id, `'new'` for a new draft, or null. */
  selected: string | null;
}

export function parseHash(hash: string): Route {
  const [path = '', query = ''] = hash.replace(/^#\/?/, '').split('?');
  const params = new URLSearchParams(query);
  const selected = params.get('new') === '1' ? 'new' : params.get('s');
  const [head, id] = path.split('/');
  let view: View;
  switch (head) {
    case 'favorites':
      view = { kind: 'favorites' };
      break;
    case 'recent':
      view = { kind: 'recent' };
      break;
    case 'settings':
      view = { kind: 'settings' };
      break;
    case 'folder':
      view = id ? { kind: 'folder', id: decodeURIComponent(id) } : { kind: 'all' };
      break;
    default:
      view = { kind: 'all' };
  }
  return { view, selected };
}

export function toHash({ view, selected }: Route): string {
  const path = view.kind === 'folder' ? `folder/${encodeURIComponent(view.id)}` : view.kind;
  const query = selected === 'new' ? '?new=1' : selected ? `?s=${encodeURIComponent(selected)}` : '';
  return `#/${path}${query}`;
}

export function useRoute(): [Route, (route: Route) => void] {
  const [route, setRoute] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const onHash = () => setRoute(parseHash(location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const navigate = (next: Route) => {
    const hash = toHash(next);
    if (hash !== location.hash) location.hash = hash;
    else setRoute(next);
  };
  return [route, navigate];
}

export function sameView(a: View, b: View): boolean {
  return a.kind === b.kind && (a.kind !== 'folder' || (b.kind === 'folder' && a.id === b.id));
}
