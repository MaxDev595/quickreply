import { LIMITS, type Folder } from '@quickreply/shared';
import { Clock, Folder as FolderIcon, FolderPlus, Layers, MoreHorizontal, Pencil, Settings, Star, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { updateSettings, type AppState } from '../lib/storage';
import { addFolder, deleteFolder, renameFolder } from '../ui/actions';
import { ConfirmDialog, IconButton, Logo, Menu, Toggle, cx, inputClass } from '../ui/components';
import { sameView, type View } from './route';

interface Props {
  state: AppState;
  view: View;
  counts: { all: number; favorites: number; recent: number; folders: Record<string, number> };
  onNavigate: (view: View) => void;
}

function NavItem({ active, icon, label, count, onClick }: { active: boolean; icon: ReactNode; label: string; count?: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cx(
        'flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition-colors',
        active ? 'bg-surface font-medium text-fg shadow-[0_0_0_1px_var(--qr-border)]' : 'text-muted hover:bg-surface-hover hover:text-fg',
      )}
    >
      <span className={cx('shrink-0', active ? 'text-accent' : 'text-faint')}>{icon}</span>
      <span className="truncate">{label}</span>
      {count !== undefined && <span className="ml-auto text-[12px] text-faint tabular-nums">{count}</span>}
    </button>
  );
}

function FolderNameInput({ initial, onSubmit, onCancel }: { initial: string; onSubmit: (name: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(initial);
  const submit = () => (value.trim() ? onSubmit(value.trim()) : onCancel());
  return (
    <input
      autoFocus
      value={value}
      maxLength={LIMITS.folderNameMax}
      aria-label="Folder name"
      placeholder="Folder name"
      onChange={(e) => setValue(e.target.value)}
      onBlur={submit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') submit();
        if (e.key === 'Escape') onCancel();
      }}
      className={cx(inputClass, 'h-8')}
    />
  );
}

export function Sidebar({ state, view, counts, onNavigate }: Props) {
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Folder | null>(null);
  const { folders, settings } = state;

  return (
    <aside className="flex h-full w-[232px] shrink-0 flex-col border-r border-line bg-bg-alt">
      <div className="px-4 pt-4 pb-5">
        <Logo />
      </div>
      <nav className="flex flex-col gap-0.5 px-2" aria-label="Library">
        <NavItem active={sameView(view, { kind: 'all' })} icon={<Layers size={16} />} label="All snippets" count={counts.all} onClick={() => onNavigate({ kind: 'all' })} />
        <NavItem active={sameView(view, { kind: 'favorites' })} icon={<Star size={16} />} label="Favorites" count={counts.favorites} onClick={() => onNavigate({ kind: 'favorites' })} />
        <NavItem active={sameView(view, { kind: 'recent' })} icon={<Clock size={16} />} label="Recently used" count={counts.recent} onClick={() => onNavigate({ kind: 'recent' })} />
      </nav>

      <div className="mt-6 flex items-center justify-between px-4 pb-1.5">
        <h2 className="text-[12px] font-medium text-muted">Folders</h2>
        <IconButton label="New folder" className="size-6" onClick={() => setCreating(true)}>
          <FolderPlus size={14} />
        </IconButton>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2">
        {folders.map((f) =>
          renaming === f.id ? (
            <FolderNameInput
              key={f.id}
              initial={f.name}
              onCancel={() => setRenaming(null)}
              onSubmit={async (name) => {
                await renameFolder(f.id, name);
                setRenaming(null);
              }}
            />
          ) : (
            <div key={f.id} className="group relative">
              <NavItem
                active={sameView(view, { kind: 'folder', id: f.id })}
                icon={<FolderIcon size={16} />}
                label={f.name}
                count={counts.folders[f.id] ?? 0}
                onClick={() => onNavigate({ kind: 'folder', id: f.id })}
              />
              <div className="absolute top-1 right-1 hidden group-focus-within:block group-hover:block">
                <Menu
                  trigger={(toggle) => (
                    <IconButton label={`Folder actions for ${f.name}`} className="size-6 bg-surface" onClick={toggle}>
                      <MoreHorizontal size={14} />
                    </IconButton>
                  )}
                  items={[
                    { label: 'Rename', icon: <Pencil size={14} />, onSelect: () => setRenaming(f.id) },
                    { label: 'Delete folder', icon: <Trash2 size={14} />, danger: true, onSelect: () => setDeleting(f) },
                  ]}
                />
              </div>
            </div>
          ),
        )}
        {creating && (
          <FolderNameInput
            initial=""
            onCancel={() => setCreating(false)}
            onSubmit={async (name) => {
              const id = await addFolder(name);
              setCreating(false);
              onNavigate({ kind: 'folder', id });
            }}
          />
        )}
        {folders.length === 0 && !creating && (
          <button type="button" onClick={() => setCreating(true)} className="px-2.5 py-1 text-left text-[12px] text-faint hover:text-muted">
            Group snippets by team, client or topic.
          </button>
        )}
      </div>

      <div className="flex flex-col gap-0.5 border-t border-line p-2">
        <NavItem active={view.kind === 'settings'} icon={<Settings size={16} />} label="Settings" onClick={() => onNavigate({ kind: 'settings' })} />
        <div className="flex h-9 items-center justify-between px-2.5 text-[13px]">
          <span className="flex items-center gap-2 text-muted">
            <span className={cx('size-1.5 rounded-full', settings.enabled ? 'bg-accent' : 'bg-faint')} />
            {settings.enabled ? 'Expansion on' : 'Paused'}
          </span>
          <Toggle checked={settings.enabled} onChange={(v) => updateSettings({ enabled: v })} label="Enable QuickReply" />
        </div>
      </div>

      {deleting && (
        <ConfirmDialog
          title={`Delete “${deleting.name}”?`}
          body="The folder is removed. Its snippets are kept and moved out of the folder."
          confirmLabel="Delete folder"
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            await deleteFolder(deleting.id);
            setDeleting(null);
            if (sameView(view, { kind: 'folder', id: deleting.id })) onNavigate({ kind: 'all' });
          }}
        />
      )}
    </aside>
  );
}
