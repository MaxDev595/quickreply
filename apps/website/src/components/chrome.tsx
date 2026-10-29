import Link from 'next/link';
import { Logo } from './brand';

const NAV = [
  { href: '/#features', label: 'Features' },
  { href: '/#how-it-works', label: 'How It Works' },
  { href: '/#faq', label: 'FAQ' },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-5 sm:px-8">
        <Logo />
        <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="hidden rounded-md px-3 py-2 text-[14px] text-muted transition-colors hover:text-fg md:inline-block">
              {n.label}
            </Link>
          ))}
          <Link
            href="/#get"
            className="ml-2 inline-flex h-9 items-center rounded-lg bg-graphite px-3.5 text-[14px] font-medium text-white transition-colors hover:bg-fg"
          >
            Get Extension
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-bg-alt">
      <div className="mx-auto flex max-w-[1120px] flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="flex flex-col gap-2">
          <Logo />
          <p className="text-[13px] text-muted">Type less. Get more done.</p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-[14px] text-muted">
          <Link href="/privacy/" className="hover:text-fg">
            Privacy Policy
          </Link>
          <Link href="/terms/" className="hover:text-fg">
            Terms of Service
          </Link>
          <Link href="/contact/" className="hover:text-fg">
            Contact
          </Link>
        </nav>
      </div>
      <div className="mx-auto max-w-[1120px] px-5 pb-8 text-[12px] text-faint sm:px-8">
        © {new Date().getFullYear()} QuickReply. Chrome is a trademark of Google LLC; QuickReply is not affiliated with Google.
      </div>
    </footer>
  );
}
