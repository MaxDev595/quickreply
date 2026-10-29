import { useEffect, useId, useRef, useState, type ComponentProps, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <rect x="0.5" y="0.5" width="31" height="31" rx="6.5" fill="#1F2937" stroke="#FFFFFF" strokeOpacity="0.08" />
      <circle cx="14.5" cy="14.5" r="7" fill="none" stroke="#fff" strokeWidth="4.2" />
      <path d="M19 19 L25.5 26" stroke="#22C55E" strokeWidth="4.2" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ size = 24 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark size={size} />
      <span className="text-[15px] font-semibold tracking-[-0.01em] text-fg">QuickReply</span>
    </span>
  );
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:bg-accent-hover border-transparent',
  secondary: 'bg-surface text-fg border-line hover:bg-surface-hover hover:border-line-strong',
  ghost: 'bg-transparent text-muted border-transparent hover:bg-surface-hover hover:text-fg',
  danger: 'bg-surface text-danger border-line hover:bg-danger-soft hover:border-danger/40',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  ...props
}: ComponentProps<'button'> & { variant?: Variant; size?: 'sm' | 'md' }) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
        size === 'sm' ? 'h-7 px-2.5 text-[12px]' : 'h-9 px-3.5 text-[13px]',
        VARIANTS[variant],
        className,
      )}
    />
  );
}

export function IconButton({ label, className, ...props }: ComponentProps<'button'> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className={cx(
        'inline-flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-hover hover:text-fg',
        className,
      )}
    />
  );
}

/** Shortcuts are shown as keycaps: they are literally what the user types. */
export function Keycap({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cx(
        'inline-flex h-[22px] max-w-full items-center truncate rounded-md border border-b-2 border-line-strong bg-bg-alt px-1.5 font-sans text-[12px] font-medium tracking-tight text-fg',
        className,
      )}
    >
      {children}
    </kbd>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
        checked ? 'bg-accent' : 'bg-line-strong',
      )}
    >
      <span
        className={cx(
          'inline-block size-4 rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-[18px]' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

export function TextField({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }) => ReactNode;
}) {
  const id = useId();
  const msgId = `${id}-msg`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[12px] font-medium text-muted">
        {label}
      </label>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': error || hint ? msgId : undefined })}
      {error ? (
        <p id={msgId} className="text-[12px] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={msgId} className="text-[12px] text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const inputBase =
  'h-9 rounded-lg border border-line bg-surface px-3 text-[13px] text-fg placeholder:text-faint outline-none transition-[border-color,box-shadow] focus:border-accent focus:ring-3 focus:ring-accent/15 aria-[invalid=true]:border-danger';

export const inputClass = `${inputBase} w-full`;

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
}

/** Small dropdown menu with keyboard support (Esc to close, arrows to move). */
export function Menu({ trigger, items, align = 'right' }: { trigger: (open: () => void) => ReactNode; items: MenuItem[]; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    ref.current?.querySelector<HTMLButtonElement>('[role=menuitem]')?.focus();
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const onKeyDown = (e: ReactKeyboardEvent) => {
    const buttons = [...(ref.current?.querySelectorAll<HTMLButtonElement>('[role=menuitem]') ?? [])];
    const idx = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') {
      e.stopPropagation();
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      buttons[(idx + 1) % buttons.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      buttons[(idx - 1 + buttons.length) % buttons.length]?.focus();
    }
  };

  return (
    <div ref={ref} className="relative" onKeyDown={onKeyDown}>
      {trigger(() => setOpen((v) => !v))}
      {open && (
        <div
          role="menu"
          className={cx(
            'qr-pop absolute top-full z-30 mt-1 min-w-[168px] rounded-xl border border-line bg-surface p-1 shadow-card',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={cx(
                'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] outline-none hover:bg-surface-hover focus:bg-surface-hover',
                item.danger ? 'text-danger' : 'text-fg',
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  danger = true,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-[1px]" onMouseDown={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="qr-confirm-title"
        className="qr-pop w-full max-w-[340px] rounded-xl border border-line bg-surface p-5 shadow-card"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="qr-confirm-title" className="text-[15px] font-semibold">
          {title}
        </h2>
        <div className="mt-1.5 text-[13px] leading-relaxed text-muted">{body}</div>
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={onCancel}>Cancel</Button>
          <Button ref={confirmRef} variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Short status messages ("Snippet saved"). */
export function useToast(): [ReactNode, (message: string) => void] {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = (m: string) => {
    window.clearTimeout(timer.current);
    setMessage(m);
    timer.current = window.setTimeout(() => setMessage(null), 2200);
  };
  const node = (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center">
      {message && (
        <div className="qr-pop rounded-lg bg-fg px-3.5 py-2 text-[13px] font-medium text-bg shadow-card">{message}</div>
      )}
    </div>
  );
  return [node, show];
}
