import {
  filterSnippets,
  previewText,
  recentlyUsed,
  sortSnippets,
  type Snippet,
  type SnippetSort,
} from '@quickreply/shared';
import { Plus, Search, Star } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AppState } from '../lib/storage';
import { addSnippet, deleteSnippet, duplicateSnippet, saveSnippet } from '../ui/actions';
import { Button, ConfirmDialog, Keycap, cx, inputBase, inputClass, useToast } from '../ui/components';
import { useLimitGuard } from '../ui/limit';
import { exampleSnippets } from '../ui/examples';
import { useAppState } from '../ui/useAppState';
import { useRoute, type Route, type View } from './route';
import { SettingsView } from './SettingsView';
import { Sidebar } from './Sidebar';
import { SnippetEditor, draftFrom, type Draft } from './SnippetEditor';

export function Dashboard() {
  const state = useAppState();
  if (!state) return <div className="h-screen bg-bg" />;
  return <DashboardView state={state} />;
}

function viewTitle(view: View, state: AppState): string {
  switch (view.kind) {
    case 'all':
      return 'All snippets';
    case 'favorites':
      return 'Favorites';
    case 'recent':
      return 'Recently used';
    case 'folder':
      return state.folders.find((f) => f.id === view.id)?.name ?? 'Folder';
    case 'settings':
      return 'Settings';
  }
}

function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 899px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 899px)');
    const on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return narrow;
}

function DashboardView({ state }: { state: AppState }) {
  const { snippets, folders, usage, settings } = state;
  const [route, navigate] = useRoute();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SnippetSort>('updated');
  const [dirty, setDirty] = useState(false);
  const [pendingRoute, setPendingRoute] = useState<Route | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Snippet | null>(null);
  const [toast, showToast] = useToast();
  const [limitDialog, guard] = useLimitGuard();
  const narrow = useNarrow();
  const { view, selected } = route;

  const go = useCallback(
    (next: Route) => {
      if (dirty && (next.selected !== route.selected || next.view.kind === 'settings')) setPendingRoute(next);
      else navigate(next);
    },
    [dirty, navigate, route.selected],
  );

  // Warn before closing the tab with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const onBefore = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBefore);
    return () => window.removeEventListener('beforeunload', onBefore);
  }, [dirty]);

  useEffect(() => {
    document.title = `${viewTitle(view, state)} · QuickReply`;
  }, [view, state]);

  const counts = useMemo(() => {
    const byFolder: Record<string, number> = {};
    for (const s of snippets) if (s.folderId) byFolder[s.folderId] = (byFolder[s.folderId] ?? 0) + 1;
    return {
      all: snippets.length,
      favorites: snippets.filter((s) => s.favorite).length,
      recent: recentlyUsed(snippets, usage).length,
      folders: byFolder,
    };
  }, [snippets, usage]);

  const list = useMemo(() => {
    let base: Snippet[];
    switch (view.kind) {
      case 'favorites':
        base = snippets.filter((s) => s.favorite);
        break;
      case 'recent':
        base = recentlyUsed(snippets, usage);
        break;
      case 'folder':
        base = snippets.filter((s) => s.folderId === view.id);
        break;
      default:
        base = snippets;
    }
    const filtered = filterSnippets(base, query);
    return view.kind === 'recent' && sort === 'updated' ? filtered : sortSnippets(filtered, sort, usage);
  }, [snippets, usage, view, query, sort]);

  const current = selected && selected !== 'new' ? (snippets.find((s) => s.id === selected) ?? null) : null;
  const isNewDraft = selected === 'new';
  const newDraft: Draft = useMemo(
    () => ({
      name: '',
      shortcut: settings.defaultPrefix,
      content: '',
      folderId: view.kind === 'folder' ? view.id : null,
      favorite: view.kind === 'favorites',
      enabled: true,
    }),
    // A fresh draft is built whenever "New snippet" is opened in a view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isNewDraft, view],
  );

  const editorOpen = selected === 'new' || current !== null;

  const onSave = async (draft: Draft) => {
    if (selected === 'new') {
      const created = await guard(() => addSnippet(draft));
      if (!created) return;
      setDirty(false);
      navigate({ view, selected: created.id });
      showToast('Snippet created');
    } else if (current) {
      await saveSnippet(current.id, draft);
      setDirty(false);
      showToast('Changes saved');
    }
  };

  if (view.kind === 'settings') {
    return (
      <Shell sidebar={<Sidebar state={state} view={view} counts={counts} onNavigate={(v) => go({ view: v, selected: null })} />} narrow={narrow}>
        <SettingsView state={state} onToast={showToast} />
        {toast}
      </Shell>
    );
  }

  const listPane = (
    <div className={cx('flex min-h-0 flex-col border-line', narrow ? 'flex-1' : 'w-[360px] shrink-0 border-r')}>
      <div className="flex flex-col gap-3 px-5 pt-5 pb-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="truncate text-[20px] font-semibold tracking-[-0.01em]">{viewTitle(view, state)}</h1>
          <Button variant="primary" onClick={() => go({ view, selected: 'new' })}>
            <Plus size={16} /> New snippet
          </Button>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search snippets"
              aria-label="Search snippets"
              className={cx(inputClass, 'pl-9')}
            />
          </div>
          <select aria-label="Sort snippets" value={sort} onChange={(e) => setSort(e.target.value as SnippetSort)} className={cx(inputBase, 'w-[124px] shrink-0')}>
            <option value="updated">{view.kind === 'recent' ? 'Last used' : 'Last edited'}</option>
            <option value="name">Name</option>
            <option value="shortcut">Shortcut</option>
            <option value="most-used">Most used</option>
          </select>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {list.length === 0 ? (
          <ListEmpty
            view={view}
            hasAny={snippets.length > 0}
            query={query}
            onNew={() => go({ view, selected: 'new' })}
            onExamples={() =>
              guard(async () => {
                for (const d of exampleSnippets(settings.defaultPrefix || '/')) {
                  if (!snippets.some((s) => s.shortcut === d.shortcut)) await addSnippet(d);
                }
                showToast('Example snippets added');
              })
            }
          />
        ) : (
          <ul aria-label="Snippets" className="flex flex-col gap-0.5">
            {list.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => go({ view, selected: s.id })}
                  aria-current={s.id === selected ? 'true' : undefined}
                  className={cx(
                    'w-full rounded-lg px-3 py-2.5 text-left transition-colors',
                    s.id === selected ? 'bg-accent-soft shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--qr-accent)_35%,transparent)]' : 'hover:bg-surface-hover',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={cx('truncate text-[13px] font-medium', !s.enabled && 'text-muted line-through decoration-faint')}>{s.name}</span>
                    {s.favorite && <Star size={12} className="shrink-0 fill-amber-400 text-amber-400" aria-label="Favorite" />}
                    <Keycap className="ml-auto shrink-0">{s.shortcut}</Keycap>
                  </div>
                  <p className="mt-1 truncate text-[12px] text-muted">{previewText(s.content, 80)}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  const editorPane = editorOpen ? (
    <SnippetEditor
      key={selected ?? 'none'}
      snippet={current}
      initial={current ? draftFrom(current) : newDraft}
      allSnippets={snippets}
      folders={folders}
      usage={current ? usage[current.id] : undefined}
      clipboardEnabled={settings.clipboardEnabled}
      onSave={onSave}
      onDirtyChange={setDirty}
      onDelete={() => current && setPendingDelete(current)}
      onDuplicate={async () => {
        if (!current) return;
        const copy = await guard(() => duplicateSnippet(current.id));
        if (!copy) return;
        navigate({ view, selected: copy.id });
        showToast('Snippet duplicated');
      }}
      onBack={narrow ? () => go({ view, selected: null }) : undefined}
    />
  ) : (
    <div className="flex h-full items-center justify-center p-8 text-center">
      <div className="max-w-[300px]">
        <p className="text-[14px] font-medium">Select a snippet to edit it</p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">Or create a new one. Changes apply to every open tab right away.</p>
      </div>
    </div>
  );

  return (
    <Shell sidebar={<Sidebar state={state} view={view} counts={counts} onNavigate={(v) => go({ view: v, selected: null })} />} narrow={narrow}>
      <div className="flex h-full min-h-0">
        {narrow ? (editorOpen ? <div className="min-w-0 flex-1">{editorPane}</div> : listPane) : (
          <>
            {listPane}
            <div className="min-w-0 flex-1 bg-bg">{editorPane}</div>
          </>
        )}
      </div>

      {pendingRoute && (
        <ConfirmDialog
          title="Discard unsaved changes?"
          body="Your edits to this snippet haven’t been saved."
          confirmLabel="Discard changes"
          onCancel={() => setPendingRoute(null)}
          onConfirm={() => {
            setDirty(false);
            navigate(pendingRoute);
            setPendingRoute(null);
          }}
        />
      )}
      {pendingDelete && (
        <ConfirmDialog
          title="Delete this snippet?"
          body={
            <>
              <span className="font-medium text-fg">{pendingDelete.name}</span> ({pendingDelete.shortcut}) will be removed. This can’t be undone.
            </>
          }
          confirmLabel="Delete snippet"
          onCancel={() => setPendingDelete(null)}
          onConfirm={async () => {
            await deleteSnippet(pendingDelete.id);
            setPendingDelete(null);
            setDirty(false);
            navigate({ view, selected: null });
            showToast('Snippet deleted');
          }}
        />
      )}
      {toast}
      {limitDialog}
    </Shell>
  );
}

function Shell({ sidebar, narrow, children }: { sidebar: ReactNode; narrow: boolean; children: ReactNode }) {
  return (
    <div className="flex h-screen min-h-0 bg-bg text-fg">
      {narrow ? null : sidebar}
      <main className="flex min-w-0 flex-1 flex-col">
        {narrow && <MobileNav sidebar={sidebar} />}
        <div className="min-h-0 flex-1">{children}</div>
      </main>
    </div>
  );
}

function MobileNav({ sidebar }: { sidebar: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="flex h-12 items-center border-b border-line px-3">
        <Button size="sm" variant="ghost" onClick={() => setOpen(true)} aria-expanded={open}>
          Menu
        </Button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 flex bg-black/30" onClick={() => setOpen(false)}>
          <div className="h-full" onClick={(e) => e.stopPropagation()} onClickCapture={(e) => (e.target as HTMLElement).closest('nav button, [aria-current]') && setOpen(false)}>
            {sidebar}
          </div>
        </div>
      )}
    </>
  );
}

function ListEmpty({
  view,
  hasAny,
  query,
  onNew,
  onExamples,
}: {
  view: View;
  hasAny: boolean;
  query: string;
  onNew: () => void;
  onExamples: () => void;
}) {
  if (query.trim()) return <p className="px-3 py-10 text-center text-[13px] text-muted">No snippets match “{query}”.</p>;
  if (!hasAny)
    return (
      <div className="px-3 py-10 text-center">
        <p className="text-[14px] font-medium">No snippets yet</p>
        <p className="mx-auto mt-1 max-w-[240px] text-[13px] leading-relaxed text-muted">
          Save a reply you type often and give it a shortcut.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Button variant="primary" onClick={onNew}>
            <Plus size={16} /> New snippet
          </Button>
          <Button onClick={onExamples}>Add examples</Button>
        </div>
      </div>
    );
  const messages: Record<string, string> = {
    favorites: 'Star a snippet to keep it here.',
    recent: 'Snippets you expand on websites will show up here.',
    folder: 'No snippets in this folder yet. Choose this folder in a snippet’s Folder field.',
  };
  return <p className="px-3 py-10 text-center text-[13px] leading-relaxed text-muted">{messages[view.kind] ?? 'Nothing here yet.'}</p>;
}
