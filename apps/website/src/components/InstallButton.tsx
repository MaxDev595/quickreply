import { Puzzle } from 'lucide-react';
import { siteConfig } from '@/site.config';

/**
 * Until the extension is live in the Chrome Web Store, this shows an honest
 * "coming soon" state instead of a made-up store link.
 */
export function InstallButton({ size = 'lg' }: { size?: 'md' | 'lg' }) {
  const cls = size === 'lg' ? 'h-12 px-5 text-[15px]' : 'h-9 px-3.5 text-[14px]';
  if (siteConfig.chromeStoreUrl) {
    return (
      <a
        href={siteConfig.chromeStoreUrl}
        target="_blank"
        rel="noopener"
        className={`inline-flex items-center gap-2 rounded-xl bg-accent font-semibold text-white shadow-[0_1px_2px_rgb(22_163_74/0.4)] transition-colors hover:bg-accent-hover ${cls}`}
      >
        <Puzzle size={18} aria-hidden="true" />
        Add to Chrome — Free
      </a>
    );
  }
  return (
    <span
      role="note"
      className={`inline-flex items-center gap-2.5 rounded-xl border border-line bg-bg-alt font-semibold text-fg ${cls}`}
    >
      <Puzzle size={18} aria-hidden="true" />
      Add to Chrome — Free
      <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[12px] font-medium text-accent-hover">Coming soon</span>
    </span>
  );
}
