import Link from 'next/link';
import type { ReactNode } from 'react';

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <rect width="32" height="32" rx="7" fill="#1F2937" />
      <circle cx="14.5" cy="14.5" r="7" fill="none" stroke="#fff" strokeWidth="4.2" />
      <path d="M19 19 L25.5 26" stroke="#22C55E" strokeWidth="4.2" strokeLinecap="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5 rounded-md" aria-label="QuickReply home">
      <LogoMark />
      <span className="text-[17px] font-semibold tracking-[-0.015em]">QuickReply</span>
    </Link>
  );
}

/** Shortcuts are drawn as keycaps across the site: they are what people type. */
export function Keycap({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={`inline-flex h-7 items-center rounded-md border border-b-[3px] border-line-strong bg-white px-2 font-sans text-[13px] font-medium tracking-tight text-fg ${className}`}
    >
      {children}
    </kbd>
  );
}
