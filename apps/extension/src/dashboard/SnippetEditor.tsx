import {
  LIMITS,
  SHORTCUT_ERROR_MESSAGES,
  formatDate,
  formatTime,
  isBuiltinVariable,
  usesClipboard,
  validateShortcut,
  type Folder,
  type Snippet,
  type UsageEntry,
} from '@quickreply/shared';
import { CalendarDays, Clipboard, Clock, CopyPlus, Star, TextCursorInput, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Button, Keycap, TextField, Toggle, cx, inputClass } from '../ui/components';

export interface Draft {
  name: string;
  shortcut: string;
  content: string;
  folderId: string | null;
  favorite: boolean;
  enabled: boolean;
}

export function draftFrom(s: Snippet): Draft {
  return { name: s.name, shortcut: s.shortcut, content: s.content, folderId: s.folderId, favorite: s.favorite, enabled: s.enabled };
}

export function isDirty(a: Draft, b: Draft): boolean {
  return (Object.keys(a) as (keyof Draft)[]).some((k) => a[k] !== b[k]);
}

interface Props {
  snippet: Snippet | null;
  initial: Draft;
  allSnippets: Snippet[];
  folders: Folder[];
  usage: UsageEntry | undefined;
  clipboardEnabled: boolean;
  onSave: (draft: Draft) => Promise<void>;
  onDelete: () => void;
  onDuplicate: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onBack?: () => void;
}

const IS_MAC = /Mac|iPhone|iPad/.test(navigator.userAgent);

const VARIABLE_BUTTONS: { label: string; token: string; icon: ReactNode }[] = [
  { label: 'Date', token: '{date}', icon: <CalendarDays size={14} /> },
  { label: 'Time', token: '{time}', icon: <Clock size={14} /> },
  { label: 'Date & time', token: '{datetime}', icon: <CalendarDays size={14} /> },
  { label: 'Clipboard', token: '{clipboard}', icon: <Clipboard size={14} /> },
  { label: 'Fill-in field', token: '{name}', icon: <TextCursorInput size={14} /> },
];

export function SnippetEditor(props: Props) {
  const { snippet, initial, allSnippets, folders, usage, clipboardEnabled, onSave, onDelete, onDuplicate, onDirtyChange, onBack } = props;
  const [draft, setDraft] = useState(initial);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const isNew = snippet === null;

  const shortcutError = validateShortcut(draft.shortcut, allSnippets, snippet?.id);
  const nameError = draft.name.trim() ? null : 'Name is required.';
  const contentError = draft.content.length === 0 ? 'Write the text this shortcut inserts.' : null;
  const valid = !shortcutError && !nameError && !contentError;
  const dirty = isNew || isDirty(draft, initial);

  useEffect(() => onDirtyChange(isNew ? draft.content.length > 0 || draft.name.length > 0 : isDirty(draft, initial)), [draft, initial, isNew, onDirtyChange]);

  const prefixOf = useMemo(
    () =>
      shortcutError
        ? null
        : allSnippets.find((s) => s.id !== snippet?.id && s.enabled && s.shortcut !== draft.shortcut && (s.shortcut.startsWith(draft.shortcut) || draft.shortcut.startsWith(s.shortcut))),
    [allSnippets, draft.shortcut, shortcutError, snippet?.id],
  );

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const save = async () => {
    setTouched(true);
    if (!valid || saving) return;
    setSaving(true);
    try {
      await onSave({ ...draft, name: draft.name.trim() });
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      void save();
    }
  };

  const insertToken = (token: string) => {
    const el = contentRef.current;
    if (!el) return;
    el.focus();
    const start = el.selectionStart;
    const end = el.selectionEnd;
    // Select "name" in {name} so the user can type the field's real name right away.
    const selectName = () => el.setSelectionRange(start + 1, start + token.length - 1);
    // execCommand keeps the textarea's undo history; React picks up the input event.
    if (document.execCommand('insertText', false, token)) {
      if (token === '{name}') selectName(); // value is already updated synchronously
    } else {
      set('content', draft.content.slice(0, start) + token + draft.content.slice(end));
      if (token === '{name}') requestAnimationFrame(selectName);
    }
  };

  return (
    <form
      className="flex h-full min-h-0 flex-col"
      onKeyDown={onKeyDown}
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      aria-label={isNew ? 'New snippet' : `Edit ${initial.name}`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-6 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {onBack && (
            <Button size="sm" variant="ghost" onClick={onBack}>
              Back
            </Button>
          )}
          <h2 className="truncate text-[15px] font-semibold">{isNew ? 'New snippet' : initial.name}</h2>
          {!isNew && dirty && <span className="text-[12px] text-muted">Unsaved changes</span>}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => set('favorite', !draft.favorite)}
            aria-pressed={draft.favorite}
            aria-label={draft.favorite ? 'Remove from favorites' : 'Add to favorites'}
            title={draft.favorite ? 'Remove from favorites' : 'Add to favorites'}
            className="inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-surface-hover hover:text-fg"
          >
            <Star size={16} className={draft.favorite ? 'fill-amber-400 text-amber-400' : ''} />
          </button>
          {!isNew && (
            <>
              <Button size="sm" variant="ghost" onClick={onDuplicate}>
                <CopyPlus size={14} /> Duplicate
              </Button>
              <Button size="sm" variant="ghost" className="hover:text-danger" onClick={onDelete}>
                <Trash2 size={14} /> Delete
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto flex max-w-[720px] flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_200px]">
            <TextField label="Name" error={touched ? nameError : null}>
              {(a) => (
                <input
                  {...a}
                  autoFocus={isNew}
                  value={draft.name}
                  maxLength={LIMITS.nameMax}
                  placeholder="Welcome message"
                  onChange={(e) => set('name', e.target.value)}
                  className={inputClass}
                />
              )}
            </TextField>
            <TextField
              label="Shortcut"
              error={(touched || draft.shortcut.length > 1) && shortcutError ? SHORTCUT_ERROR_MESSAGES[shortcutError] : null}
              hint={prefixOf ? `Expands after a space, because ${prefixOf.shortcut} is similar.` : 'Type this anywhere to insert the text.'}
            >
              {(a) => (
                <input
                  {...a}
                  value={draft.shortcut}
                  maxLength={LIMITS.shortcutMax}
                  spellCheck={false}
                  autoCapitalize="off"
                  autoComplete="off"
                  placeholder="/welcome"
                  onChange={(e) => set('shortcut', e.target.value.replace(/\s/g, ''))}
                  className={cx(inputClass, 'border-b-2 font-medium')}
                />
              )}
            </TextField>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <label htmlFor="qr-content" className="text-[12px] font-medium text-muted">
                Text
              </label>
              <div className="flex flex-wrap gap-1" role="toolbar" aria-label="Insert variable">
                {VARIABLE_BUTTONS.map((v) => (
                  <button
                    key={v.token}
                    type="button"
                    onClick={() => insertToken(v.token)}
                    title={`Insert ${v.token}`}
                    className="inline-flex h-7 items-center gap-1 rounded-md border border-line bg-surface px-2 text-[12px] text-muted hover:border-line-strong hover:text-fg"
                  >
                    {v.icon}
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              id="qr-content"
              ref={contentRef}
              value={draft.content}
              maxLength={LIMITS.contentMax}
              onChange={(e) => set('content', e.target.value)}
              placeholder={'Hello {name}!\n\nThanks for reaching out. How can I help you today?'}
              rows={9}
              aria-invalid={touched && Boolean(contentError)}
              className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2.5 text-[14px] leading-relaxed text-fg outline-none placeholder:text-faint focus:border-accent focus:ring-3 focus:ring-accent/15 aria-[invalid=true]:border-danger"
            />
            {touched && contentError && <p className="text-[12px] text-danger">{contentError}</p>}
            {usesClipboard(draft.content) && !clipboardEnabled && (
              <p className="text-[12px] text-muted">
                {'{clipboard}'} stays empty until you turn on clipboard access in Settings.
              </p>
            )}
          </div>

          <Preview shortcut={draft.shortcut} content={draft.content} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="Folder">
              {(a) => (
                <select
                  {...a}
                  value={draft.folderId ?? ''}
                  onChange={(e) => set('folderId', e.target.value || null)}
                  className={inputClass}
                >
                  <option value="">No folder</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              )}
            </TextField>
            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-muted">Status</span>
              <div className="flex h-9 items-center gap-2.5">
                <Toggle checked={draft.enabled} onChange={(v) => set('enabled', v)} label="Snippet enabled" />
                <span className="text-[13px]">{draft.enabled ? 'Shortcut is active' : 'Shortcut is turned off'}</span>
              </div>
            </div>
          </div>

          {snippet && (
            <p className="text-[12px] text-faint">
              Created {new Date(snippet.createdAt).toLocaleDateString()}. Last edited {new Date(snippet.updatedAt).toLocaleString()}.{' '}
              {usage ? `Used ${usage.count} ${usage.count === 1 ? 'time' : 'times'}.` : 'Not used yet.'}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-3">
        <span className="mr-auto hidden text-[12px] text-faint sm:inline">{IS_MAC ? '⌘S' : 'Ctrl+S'} to save</span>
        <Button type="submit" variant="primary" disabled={saving || (!isNew && !dirty)}>
          {isNew ? 'Create snippet' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}

/** Live "you type → it inserts" preview. Fill-in fields are shown as placeholders. */
function Preview({ shortcut, content }: { shortcut: string; content: string }) {
  const now = new Date();
  const parts = content.split(/(\{[a-zA-Z][a-zA-Z0-9_-]{0,31}\})/g);
  return (
    <section aria-label="Preview" className="rounded-xl border border-line bg-bg-alt">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-[12px] text-muted">
        <span>When you type</span>
        {shortcut ? <Keycap>{shortcut}</Keycap> : <span className="text-faint">a shortcut</span>}
        <span>QuickReply inserts:</span>
      </div>
      <div className="min-h-[56px] px-4 py-3 text-[14px] leading-relaxed whitespace-pre-wrap text-fg">
        {content ? (
          parts.map((part, i) => {
            const m = /^\{(.+)\}$/.exec(part);
            const name = m?.[1];
            if (!name) return <span key={i}>{part}</span>;
            if (isBuiltinVariable(name)) {
              const value =
                name === 'date' ? formatDate(now) : name === 'time' ? formatTime(now) : name === 'datetime' ? `${formatDate(now)} ${formatTime(now)}` : 'clipboard text';
              return (
                <span key={i} className={name === 'clipboard' ? 'rounded bg-surface px-1 text-muted italic' : ''}>
                  {value}
                </span>
              );
            }
            return (
              <span key={i} className="rounded border border-dashed border-accent/50 bg-accent-soft px-1 text-accent-text">
                {name}
              </span>
            );
          })
        ) : (
          <span className="text-faint">Your text will appear here.</span>
        )}
      </div>
    </section>
  );
}
