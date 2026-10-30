import type { Metadata } from 'next';
import { Check } from 'lucide-react';
import { Checkout } from '@/components/Checkout';
import { SiteFooter, SiteHeader } from '@/components/chrome';
import { PLANS, formatUsd, type PlanId } from '@quickreply/shared';
import { siteConfig } from '@/site.config';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'QuickReply is free with every local feature. Pro and Business plans add sync and team features.',
  alternates: { canonical: '/pricing/' },
};

const ORDER: PlanId[] = ['free', 'pro_monthly', 'pro_annual', 'business_monthly'];

export default function PricingPage() {
  const checkout = Boolean(siteConfig.billingApi);
  return (
    <>
      <SiteHeader />
      <main>
        <section className="mx-auto max-w-[1120px] px-5 pt-16 pb-12 sm:px-8">
          <h1 className="text-[40px] leading-tight font-semibold tracking-[-0.03em]">Pricing</h1>
          <p className="mt-3 max-w-[560px] text-[17px] leading-relaxed text-muted">
            Everything that works on your computer is free, with no limits. Paid plans add cloud sync and team features.
          </p>
          {!checkout && (
            <div className="mt-10 grid overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4" style={{ gap: 1 }}>
              {ORDER.map((id) => {
                const p = PLANS[id];
                return (
                  <div key={id} className="flex flex-col bg-white p-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-[16px] font-semibold">{p.name}</h2>
                      {id !== 'free' && <span className="rounded-full bg-bg-alt px-2 py-0.5 text-[12px] text-muted">Coming soon</span>}
                    </div>
                    <div className="mt-2 text-[26px] font-semibold tracking-[-0.02em]">
                      {formatUsd(p.priceCents)}
                      {id !== 'free' && (
                        <span className="text-[13px] font-normal text-muted">{p.perSeat ? ' /user/mo' : p.periodDays >= 365 ? ' /year' : ' /month'}</span>
                      )}
                    </div>
                    <ul className="mt-4 flex flex-col gap-1.5 text-[14px] text-muted">
                      {p.features.map((f) => (
                        <li key={f} className="flex gap-1.5">
                          <Check size={15} className="mt-0.5 shrink-0 text-accent" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </section>
        <Checkout />
      </main>
      <SiteFooter />
    </>
  );
}
