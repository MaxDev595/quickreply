import type { ReactNode } from 'react';
import { SiteFooter, SiteHeader } from './chrome';

export function LegalPage({ title, updated, children }: { title: string; updated?: string; children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[720px] px-5 py-16 sm:px-8 md:py-20">
        <h1 className="text-[36px] leading-tight font-semibold tracking-[-0.025em]">{title}</h1>
        {updated && <p className="mt-3 text-[14px] text-muted">Last updated: {updated}</p>}
        <div className="mt-10 flex flex-col gap-4 text-[16px] leading-[1.7] text-fg [&_a]:text-accent-hover [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mt-8 [&_h2]:text-[20px] [&_h2]:font-semibold [&_h2]:tracking-[-0.01em] [&_li]:mt-1.5 [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
