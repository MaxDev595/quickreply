import {
  PREFIX_OPTIONS,
  createExport,
  exportFileName,
  mergeImport,
  normalizeSiteInput,
  parseImport,
  replaceWithImport,
  type MergeReport,
  type ParsedImport,
  type ShortcutConflictStrategy,
  type ThemePreference,
  type TriggerMode,
} from '@quickreply/shared';
import { Download, Monitor, Moon, Sun, Upload, X } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { billingEnabled } from '../lib/billing';
import { updateLibrary, updateSettings, type AppState } from '../lib/storage';
import { PlanSection } from './PlanSection';
import { Button, ConfirmDialog, Toggle, cx, inputBase, inputClass } from '../ui/components';

function Section({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="grid grid-cols-1 gap-4 border-b border-line py-7 last:border-b-0 md:grid-cols-[240px_1fr] md:gap-10">
      <div>
        <h2 className="text-[14px] font-semibold">{title}</h2>
        {description && <p className="mt-1 text-[13px] leading-relaxed text-muted">{description}</p>}
      </div>
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </section>
  );
}

function Row({ label, description, children }: { label: string; description?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <div>
        <div className="text-[13px] font-medium">{label}</div>
        {description && <div className="mt-0.5 text-[12px] leading-relaxed text-muted">{description}</div>}
      </div>
      {children}
    </div>
  );
}

function Choice<T extends string>({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: T;
  options: { value: T; label: string; description?: string; icon?: ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="grid grid-cols-1 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'rounded-lg border px-3 py-2.5 text-left transition-colors',
            value === o.value ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-line-strong',
          )}
        >
          <span className="flex items-center gap-2 text-[13px] font-medium">
            {o.icon}
            {o.label}
          </span>
          {o.description && <span className="mt-0.5 block text-[12px] leading-relaxed text-muted">{o.description}</span>}
        </button>
      ))}
    </div>
  );
}

type PendingImport = { mode: 'merge' | 'restore'; parsed: ParsedImport; fileName: string };

export function SettingsView({ state, onToast }: { state: AppState; onToast: (m: string) => void }) {
  const { settings, snippets, folders } = state;
  const [site, setSite] = useState('');
  const [siteError, setSiteError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [strategy, setStrategy] = useState<ShortcutConflictStrategy>('rename');
  const fileRef = useRef<HTMLInputElement>(null);
  const modeRef = useRef<'merge' | 'restore'>('merge');
  const version = chrome.runtime.getManifest().version;

  const addSite = async () => {
    const host = normalizeSiteInput(site);
    if (!host) return setSiteError('Enter a website like mail.google.com or example.com.');
    if (settings.excludedSites.includes(host)) return setSiteError('This website is already on the list.');
    await updateSettings({ excludedSites: [...settings.excludedSites, host].sort() });
    setSite('');
    setSiteError(null);
  };

  const setClipboard = async (on: boolean) => {
    if (!on) return updateSettings({ clipboardEnabled: false });
    try {
      const granted = await chrome.permissions.request({ permissions: ['clipboardRead'] });
      if (granted) await updateSettings({ clipboardEnabled: true });
      else onToast('Clipboard access was not granted');
    } catch {
      onToast('Clipboard access is not available');
    }
  };

  const exportLibrary = () => {
    const blob = new Blob([JSON.stringify(createExport({ snippets, folders }), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportFileName();
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    onToast(`Exported ${snippets.length} ${snippets.length === 1 ? 'snippet' : 'snippets'}`);
  };

  const pickFile = (mode: 'merge' | 'restore') => {
    modeRef.current = mode;
    setImportError(null);
    fileRef.current?.click();
  };

  const onFile = async (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    const result = parseImport(await file.text());
    if (!result.ok) return setImportError(result.error);
    setPending({ mode: modeRef.current, parsed: result.value, fileName: file.name });
  };

  const applyImport = async () => {
    if (!pending) return;
    const { parsed, mode } = pending;
    const result: { report?: MergeReport } = {};
    await updateLibrary((lib) => {
      const merged = mode === 'restore' ? replaceWithImport(parsed.data) : mergeImport(lib, parsed.data, strategy);
      result.report = merged.report;
      return merged.data;
    });
    setPending(null);
    const r = result.report;
    onToast(
      mode === 'restore'
        ? `Backup restored: ${r?.added ?? 0} snippets`
        : `Imported ${r?.added ?? 0}, updated ${r?.overwritten ?? 0}, skipped ${r?.skipped ?? 0}`,
    );
  };

  const conflicts = pending ? pending.parsed.data.snippets.filter((s) => snippets.some((x) => x.shortcut === s.shortcut)).length : 0;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[880px] px-8 pt-8 pb-16">
        <h1 className="text-[22px] font-semibold tracking-[-0.01em]">Settings</h1>

        {billingEnabled && (
          <Section title="Plan" description="Your plan is checked with the QuickReply billing server.">
            <PlanSection onToast={onToast} />
          </Section>
        )}

        <Section title="General" description="Pause QuickReply everywhere without losing your snippets.">
          <Row label="Enable QuickReply" description="When off, shortcuts are not expanded on any website.">
            <Toggle checked={settings.enabled} onChange={(v) => updateSettings({ enabled: v })} label="Enable QuickReply" />
          </Row>
        </Section>

        <Section title="Shortcuts" description="Choose when a shortcut turns into text, and the prefix used for new snippets.">
          <Choice<TriggerMode>
            name="Expansion timing"
            value={settings.triggerMode}
            onChange={(v) => updateSettings({ triggerMode: v })}
            options={[
              { value: 'instant', label: 'As soon as it’s typed', description: 'Similar shortcuts like /hi and /hire wait for a space.' },
              { value: 'delimiter', label: 'After a space or punctuation', description: 'Fewer surprises. The space is kept.' },
            ]}
          />
          <Row label="Prefix for new snippets" description="Use ; if a site already uses / for its own commands (Slack, Notion).">
            <select
              aria-label="Prefix for new snippets"
              value={settings.defaultPrefix}
              onChange={(e) => updateSettings({ defaultPrefix: e.target.value })}
              className={cx(inputBase, 'w-[150px] shrink-0')}
            >
              {PREFIX_OPTIONS.map((p) => (
                <option key={p || 'none'} value={p}>
                  {p ? `${p}  (${p}hello)` : 'No prefix'}
                </option>
              ))}
            </select>
          </Row>
        </Section>

        <Section
          title="Websites"
          description="QuickReply never expands in password or payment fields. Add websites where it should stay off completely."
        >
          <div className="flex gap-2">
            <input
              value={site}
              onChange={(e) => {
                setSite(e.target.value);
                setSiteError(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && addSite()}
              placeholder="example.com"
              aria-label="Website to turn off"
              aria-invalid={Boolean(siteError)}
              className={inputClass}
            />
            <Button onClick={addSite}>Add website</Button>
          </div>
          {siteError && <p className="-mt-2 text-[12px] text-danger">{siteError}</p>}
          {settings.excludedSites.length === 0 ? (
            <p className="text-[13px] text-muted">QuickReply is on for every website.</p>
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line" aria-label="Websites where QuickReply is off">
              {settings.excludedSites.map((s) => (
                <li key={s} className="flex h-10 items-center justify-between px-3 text-[13px]">
                  <span>{s}</span>
                  <button
                    type="button"
                    aria-label={`Turn QuickReply back on for ${s}`}
                    onClick={() => updateSettings({ excludedSites: settings.excludedSites.filter((x) => x !== s) })}
                    className="inline-flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface-hover hover:text-fg"
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Variables" description="Dates and fill-in fields always work. Clipboard access is optional and asks for permission.">
          <Row label="Allow {clipboard}" description="Lets snippets paste your current clipboard text. Chrome will ask for permission.">
            <Toggle checked={settings.clipboardEnabled} onChange={setClipboard} label="Allow clipboard variable" />
          </Row>
        </Section>

        <Section title="Appearance">
          <Choice<ThemePreference>
            name="Theme"
            value={settings.theme}
            onChange={(v) => updateSettings({ theme: v })}
            options={[
              { value: 'light', label: 'Light', icon: <Sun size={15} /> },
              { value: 'dark', label: 'Dark', icon: <Moon size={15} /> },
              { value: 'system', label: 'System', icon: <Monitor size={15} /> },
            ]}
          />
        </Section>

        <Section title="Backup" description="Snippets live only in this browser. Export a backup file to keep a copy or move to another computer.">
          <div className="flex flex-wrap gap-2">
            <Button onClick={exportLibrary} disabled={snippets.length === 0}>
              <Download size={15} /> Export snippets
            </Button>
            <Button onClick={() => pickFile('merge')}>
              <Upload size={15} /> Import snippets
            </Button>
            <Button variant="ghost" onClick={() => pickFile('restore')}>
              Restore from backup
            </Button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            data-testid="import-file"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          {importError && (
            <p role="alert" className="text-[13px] text-danger">
              {importError}
            </p>
          )}
        </Section>

        <Section title="Privacy">
          <ul className="flex list-disc flex-col gap-1.5 pl-4 text-[13px] leading-relaxed text-muted">
            <li>Your snippets and settings are stored only in this browser (chrome.storage.local).</li>
            <li>QuickReply has no servers, no account and no analytics. Nothing you type is sent anywhere.</li>
            <li>To spot a shortcut, it looks at the last few characters before the cursor, in memory only. Typed text is never saved.</li>
            <li>Password, payment and one-time-code fields are ignored.</li>
            <li>Usage counts (how often a snippet was used) stay on this device and can be cleared by deleting the snippet.</li>
          </ul>
        </Section>

        <Section title="About">
          <p className="text-[13px] text-muted">
            QuickReply {version}. Type less, get more done.
          </p>
        </Section>
      </div>

      {pending && (
        <ConfirmDialog
          title={pending.mode === 'restore' ? 'Restore this backup?' : 'Import snippets?'}
          danger={pending.mode === 'restore'}
          confirmLabel={pending.mode === 'restore' ? 'Replace all snippets' : 'Import'}
          onCancel={() => setPending(null)}
          onConfirm={applyImport}
          body={
            <div className="flex flex-col gap-3">
              <p>
                {pending.fileName} has {pending.parsed.data.snippets.length} snippets and {pending.parsed.data.folders.length} folders.
                {pending.mode === 'restore' && ` Your current ${snippets.length} snippets will be replaced.`}
              </p>
              {pending.parsed.warnings.length > 0 && (
                <p>{pending.parsed.warnings.length} invalid items will be skipped.</p>
              )}
              {pending.mode === 'merge' && conflicts > 0 && (
                <label className="flex flex-col gap-1.5">
                  <span className="text-fg">
                    {conflicts} {conflicts === 1 ? 'shortcut already exists' : 'shortcuts already exist'}:
                  </span>
                  <select
                    value={strategy}
                    onChange={(e) => setStrategy(e.target.value as ShortcutConflictStrategy)}
                    className={inputClass}
                    aria-label="When a shortcut already exists"
                  >
                    <option value="rename">Keep both (rename imported)</option>
                    <option value="skip">Keep mine, skip imported</option>
                    <option value="overwrite">Replace mine with imported</option>
                  </select>
                </label>
              )}
            </div>
          }
        />
      )}
    </div>
  );
}
