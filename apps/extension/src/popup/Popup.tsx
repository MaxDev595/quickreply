import {
  filterSnippets,
  isSiteExcluded,
  previewText,
  sortSnippets,
  type Snippet,
} from '@quickreply/shared';
import { Copy, CopyPlus, MoreHorizontal, Pencil, Plus, Search, Settings, Star, Trash2, LayoutGrid, Power } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { GET_PAGE_INFO, isPageInfo } from '../lib/messages';
import { updateSettings, type AppState } from '../lib/storage';
import { addSnippet, copySnippet, deleteSnippet, duplicateSnippet, openDashboard, saveSnippet } from '../ui/actions';
import { ConfirmDialog, IconButton, Keycap, Logo, Menu, Toggle, cx, useToast } from '../ui/components';
import { useLimitGuard } from '../ui/limit';
import { exampleSnippets } from '../ui/examples';
import { useAppState } from '../ui/useAppState';

function useActiveHostname(): string | null | undefined {
  // undefined = still checking, null = QuickReply can't run on this page.
  const [host, setHost] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id === undefined) throw new Error('no tab');
        const info: unknown = await chrome.tabs.sendMessage(tab.id, { type: GET_PAGE_INFO });
        if (alive) setHost(isPageInfo(info) && info.hostname ? info.hostname : null);
      } catch {
        if (alive) setHost(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  return host;
}

export function Popup() {
  const state = useAppState();
  if (!state) return <div className="h-[500px] w-[380px] bg-bg" />;
  return <PopupView state={state} />;
}

function PopupView({ state }: { state: AppState }) {
  const { snippets, settings, usage } = state;
  const [query, setQuery] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Snippet | null>(null);
  const [toast, showToast] = useToast();
  const [limitDialog, guard] = useLimitGuard();
  const host = useActiveHostname();

  const list = useMemo(() => sortSnippets(filterSnippets(snippets, query), 'most-used', usage), [snippets, query, usage]);
  const excludedHere = host ? isSiteExcluded(host, settings.excludedSites) : false;

  const toggleSite = async (enable: boolean) => {
    if (!host) return;
    const excluded = enable
      ? settings.excludedSites.filter((s) => !isSiteExcluded(host, [s]))
      : [...settings.excludedSites, host.replace(/^www\./, '')];
    await updateSettings({ excludedSites: excluded });
  };

  const newSnippet = () => {
    openDashboard('#/all?new=1');
    window.close();
  };

  return (
    <div className="flex h-[500px] w-[380px] flex-col bg-bg text-fg">
      <header className="flex items-center justify-between px-4 pt-3.5 pb-3">
        <Logo size={22} />
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => updateSettings({ enabled: !settings.enabled })}
            aria-pressed={settings.enabled}
            title={settings.enabled ? 'Pause QuickReply everywhere' : 'Turn QuickReply on'}
            className={cx(
              'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium transition-colors',
              settings.enabled
                ? 'border-accent/30 bg-accent-soft text-accent-text'
                : 'border-line bg-bg-alt text-muted hover:text-fg',
            )}
          >
            <span className={cx('size-1.5 rounded-full', settings.enabled ? 'bg-accent' : 'bg-faint')} />
            {settings.enabled ? 'On' : 'Paused'}
          </button>
          <IconButton label="Settings" onClick={() => openDashboard('#/settings')}>
            <Settings size={16} />
          </IconButton>
        </div>
      </header>

      {settings.enabled && host !== undefined && (
        <div className="mx-4 mb-3 flex items-center justify-between rounded-lg border border-line bg-bg-alt px-3 py-2 text-[12px]">
          {host ? (
            <>
              <span className="truncate text-muted">
                Expand on <span className="font-medium text-fg">{host.replace(/^www\./, '')}</span>
              </span>
              <Toggle checked={!excludedHere} onChange={toggleSite} label={`Expand on ${host}`} />
            </>
          ) : (
            <span className="flex items-center gap-1.5 text-muted">
              <Power size={13} /> Not available on this page
            </span>
          )}
        </div>
      )}

      {snippets.length > 0 && (
        <div className="px-4 pb-2">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search snippets"
              aria-label="Search snippets"
              className="h-9 w-full rounded-lg border border-line bg-surface pr-3 pl-9 text-[13px] outline-none placeholder:text-faint focus:border-accent focus:ring-3 focus:ring-accent/15"
            />
          </div>
        </div>
      )}

      <main className="min-h-0 flex-1 overflow-y-auto px-2">
        {snippets.length === 0 ? (
          <EmptyState
            prefix={settings.defaultPrefix}
            onCreate={newSnippet}
            onExamples={() =>
              guard(async () => {
                for (const draft of exampleSnippets(settings.defaultPrefix || '/')) {
                  if (!snippets.some((s) => s.shortcut === draft.shortcut)) await addSnippet(draft);
                }
                showToast('Example snippets added');
              })
            }
          />
        ) : list.length === 0 ? (
          <p className="px-2 py-10 text-center text-[13px] text-muted">No snippets match “{query}”.</p>
        ) : (
          <ul className="pb-2" aria-label="Snippets">
            {list.map((s) => (
              <SnippetRow
                key={s.id}
                snippet={s}
                onCopy={async () => showToast((await copySnippet(s)) ? 'Copied to clipboard' : 'Copy failed')}
                onDelete={() => setPendingDelete(s)}
                onDuplicate={() =>
                  guard(async () => {
                    await duplicateSnippet(s.id);
                    showToast('Snippet duplicated');
                  })
                }
              />
            ))}
          </ul>
        )}
      </main>

      <footer className="flex items-center justify-between border-t border-line px-4 py-3">
        <button
          type="button"
          onClick={() => {
            openDashboard('#/all');
            window.close();
          }}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-fg"
        >
          <LayoutGrid size={15} /> Open dashboard
        </button>
        {snippets.length > 0 && (
          <button
            type="button"
            onClick={newSnippet}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-[13px] font-medium text-accent-fg hover:bg-accent-hover"
          >
            <Plus size={16} /> New snippet
          </button>
        )}
      </footer>

      {pendingDelete && (
        <ConfirmDialog
          title="Delete this snippet?"
          body={
            <>
              <span className="font-medium text-fg">{pendingDelete.name}</span> ({pendingDelete.shortcut}) will be removed. This
              can’t be undone.
            </>
          }
          confirmLabel="Delete snippet"
          onCancel={() => setPendingDelete(null)}
          onConfirm={async () => {
            await deleteSnippet(pendingDelete.id);
            setPendingDelete(null);
            showToast('Snippet deleted');
          }}
        />
      )}
      {toast}
      {limitDialog}
    </div>
  );
}

function SnippetRow({
  snippet,
  onCopy,
  onDelete,
  onDuplicate,
}: {
  snippet: Snippet;
  onCopy: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const edit = () => {
    openDashboard(`#/all?s=${encodeURIComponent(snippet.id)}`);
    window.close();
  };
  return (
    <li className="group relative flex items-start gap-2 rounded-lg px-2 py-2 hover:bg-surface-hover">
      <button type="button" onClick={edit} className="min-w-0 flex-1 text-left outline-none" aria-label={`Edit ${snippet.name}`}>
        <div className="flex items-center gap-2">
          <span className={cx('truncate text-[13px] font-medium', !snippet.enabled && 'text-muted')}>{snippet.name}</span>
          {snippet.favorite && <Star size={12} className="shrink-0 fill-amber-400 text-amber-400" aria-label="Favorite" />}
          {!snippet.enabled && <span className="text-[11px] text-faint">Off</span>}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <Keycap className="max-w-[45%] shrink-0">{snippet.shortcut}</Keycap>
          <span className="min-w-0 truncate text-[12px] text-muted">{previewText(snippet.content, 60)}</span>
        </div>
      </button>
      <div className="flex items-center opacity-70 group-focus-within:opacity-100 group-hover:opacity-100">
        <IconButton label={`Copy ${snippet.name}`} onClick={onCopy}>
          <Copy size={15} />
        </IconButton>
        <Menu
          trigger={(toggle) => (
            <IconButton label={`More actions for ${snippet.name}`} onClick={toggle}>
              <MoreHorizontal size={16} />
            </IconButton>
          )}
          items={[
            { label: 'Edit', icon: <Pencil size={14} />, onSelect: edit },
            {
              label: 'Duplicate',
              icon: <CopyPlus size={14} />,
              onSelect: onDuplicate,
            },
            {
              label: snippet.favorite ? 'Remove from favorites' : 'Add to favorites',
              icon: <Star size={14} />,
              onSelect: () => saveSnippet(snippet.id, { favorite: !snippet.favorite }),
            },
            {
              label: snippet.enabled ? 'Turn off' : 'Turn on',
              icon: <Power size={14} />,
              onSelect: () => saveSnippet(snippet.id, { enabled: !snippet.enabled }),
            },
            { label: 'Delete', icon: <Trash2 size={14} />, onSelect: onDelete, danger: true },
          ]}
        />
      </div>
    </li>
  );
}

function EmptyState({ prefix, onCreate, onExamples }: { prefix: string; onCreate: () => void; onExamples: () => void }) {
  const p = prefix || '/';
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="w-full rounded-xl border border-line bg-bg-alt p-4 text-left">
        <div className="flex items-center gap-2 text-[12px] text-muted">
          You type <Keycap>{p}hello</Keycap>
        </div>
        <p className="mt-2.5 text-[13px] leading-relaxed text-fg">
          Hello! Thank you for contacting us. How can I help you today?
        </p>
      </div>
      <h1 className="mt-6 text-[15px] font-semibold">Create your first snippet</h1>
      <p className="mt-1 max-w-[260px] text-[13px] leading-relaxed text-muted">
        Save a message once, then type its shortcut in any text field to insert it.
      </p>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-[13px] font-medium text-accent-fg hover:bg-accent-hover"
        >
          <Plus size={16} /> New snippet
        </button>
        <button
          type="button"
          onClick={onExamples}
          className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3.5 text-[13px] font-medium hover:bg-surface-hover"
        >
          Add examples
        </button>
      </div>
    </div>
  );
}
