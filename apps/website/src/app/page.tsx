import { CalendarDays, FolderTree, Globe, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { Keycap } from '@/components/brand';
import { SiteFooter, SiteHeader } from '@/components/chrome';
import { InstallButton } from '@/components/InstallButton';
import { LiveDemo } from '@/components/LiveDemo';
import { Reveal } from '@/components/Reveal';
import { siteConfig } from '@/site.config';

const FEATURES = [
  {
    icon: Zap,
    title: 'Instant Text Expansion',
    body: 'Type a shortcut like /hello and the full message appears in place. Changed your mind? Ctrl+Z brings the shortcut back.',
  },
  {
    icon: Sparkles,
    title: 'Smart Snippets',
    body: 'Similar shortcuts such as /hi and /hire never collide: the shorter one waits for a space. Turn any snippet off without deleting it.',
  },
  {
    icon: CalendarDays,
    title: 'Dynamic Variables',
    body: 'Insert today’s {date} or {time} automatically, or add fill-in fields like {name} that you complete in a small form as you insert.',
  },
  {
    icon: FolderTree,
    title: 'Organize Your Snippets',
    body: 'Group snippets into folders, star favorites, and find anything with search. Recently used snippets are one click away.',
  },
  {
    icon: Globe,
    title: 'Works Across Websites',
    body: 'Built for Gmail, web forms and the text editors most sites use. Pause it on any site where you don’t want it.',
  },
  {
    icon: ShieldCheck,
    title: 'Privacy First',
    body: 'Snippets stay in your browser. No account, no servers, no tracking. Password and payment fields are always ignored.',
  },
];

const FAQ = [
  {
    q: 'Is QuickReply free?',
    a: 'Yes. The current version is completely free, with no account and no limit on the number of snippets.',
  },
  {
    q: 'How does text expansion work?',
    a: 'You save a snippet and give it a shortcut, for example /pricing. When you type that shortcut in a text field, QuickReply replaces it with the saved text. To notice a shortcut it looks only at the last few characters before your cursor, in memory, and nothing is recorded.',
  },
  {
    q: 'Does QuickReply collect my messages?',
    a: 'No. Your snippets and settings are stored locally in Chrome on your computer. QuickReply has no servers and never sends what you type anywhere. It also skips password, payment and one-time-code fields entirely.',
  },
  {
    q: 'Does QuickReply work with Gmail?',
    a: 'Yes, it is designed to work in Gmail’s compose window, as well as in regular web forms and most rich text editors. A few apps, such as Google Docs, draw text in their own way instead of using standard text fields, so expansion may not work there.',
  },
  {
    q: 'Can I import my snippets?',
    a: 'Yes. You can export all snippets and folders to a backup file and import it on another computer, or restore it later. Imports are checked first, and you choose what happens when a shortcut already exists. Importing directly from other text expanders isn’t supported yet.',
  },
  {
    q: 'Can I use QuickReply offline?',
    a: 'Yes. Everything runs inside your browser, so your snippets work with or without an internet connection.',
  },
];

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
};

const appJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'QuickReply',
  applicationCategory: 'ProductivityApplication',
  operatingSystem: 'Chrome',
  description: siteConfig.description,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
};

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="mx-auto grid max-w-[1120px] items-center gap-12 px-5 pt-14 pb-20 sm:px-8 md:pt-20 lg:grid-cols-[1fr_520px] lg:gap-14 lg:pb-28">
            <Reveal>
              <h1 className="max-w-[560px] text-[40px] leading-[1.05] font-semibold tracking-[-0.035em] text-balance sm:text-[56px]">
                Stop Typing the Same Thing Over and Over.
              </h1>
              <p className="mt-6 max-w-[500px] text-[18px] leading-relaxed text-muted">
                Save your frequently used messages and insert them instantly with simple shortcuts. Work faster, reply smarter, and stay
                focused.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <InstallButton />
                <a href="#how-it-works" className="text-[15px] font-medium text-muted underline-offset-4 hover:text-fg hover:underline">
                  See how it works
                </a>
              </div>
              <p className="mt-6 text-[13px] text-muted">Free. No account. Your snippets never leave your browser.</p>
            </Reveal>
            <Reveal delay={0.15}>
              <LiveDemo />
            </Reveal>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-t border-line bg-bg-alt">
          <div className="mx-auto max-w-[1120px] px-5 py-20 sm:px-8 md:py-24">
            <h2 className="max-w-[760px] text-[32px] leading-tight font-semibold tracking-[-0.025em] sm:text-[40px]">
              Everything you need to reply in seconds
            </h2>
            <p className="mt-4 max-w-[560px] text-[17px] leading-relaxed text-muted">
              Small enough to learn in a minute. Careful enough to use in every inbox you work in.
            </p>
            <div className="mt-12 grid overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3" style={{ gap: 1 }}>
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <div key={title} className="bg-white p-7">
                  <Icon size={20} className="text-accent" aria-hidden="true" />
                  <h3 className="mt-4 text-[17px] font-semibold tracking-[-0.01em]">{title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-muted">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="border-t border-line">
          <div className="mx-auto max-w-[1120px] px-5 py-20 sm:px-8 md:py-24">
            <h2 className="text-[32px] leading-tight font-semibold tracking-[-0.025em] sm:text-[40px]">How it works</h2>
            <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
              <li>
                <Step n={1} title="Create a Snippet" body="Write a reply you send often: a greeting, your pricing, a signature." />
                <div className="mt-6 rounded-xl border border-line bg-bg-alt p-4 text-[14px] leading-relaxed">
                  Our plans start at $19 per month. Let me know if you’d like more details!
                </div>
              </li>
              <li>
                <Step n={2} title="Assign a Shortcut" body="Pick something short and memorable. A prefix like / keeps it from firing by accident." />
                <div className="mt-6 flex items-center gap-3 rounded-xl border border-line bg-bg-alt p-4">
                  <Keycap>/pricing</Keycap>
                  <span className="text-[14px] text-muted">is ready to use</span>
                </div>
              </li>
              <li>
                <Step n={3} title="Type Less, Get More Done" body="Type the shortcut in Gmail or any text field. The full text appears instantly." />
                <div className="mt-6 rounded-xl border border-line bg-bg-alt p-4 text-[14px] leading-relaxed">
                  <span className="text-faint line-through decoration-faint">/pricing</span>{' '}
                  <span>Our plans start at $19 per month…</span>
                </div>
              </li>
            </ol>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-t border-line bg-bg-alt">
          <div className="mx-auto grid max-w-[1120px] gap-10 px-5 py-20 sm:px-8 md:grid-cols-[320px_1fr] md:py-24">
            <h2 className="text-[32px] leading-tight font-semibold tracking-[-0.025em] sm:text-[40px]">Questions, answered</h2>
            <div className="divide-y divide-line border-y border-line">
              {FAQ.map((f) => (
                <details key={f.q} className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[16px] font-medium">
                    {f.q}
                    <span className="faq-icon text-[22px] leading-none font-light text-muted transition-transform" aria-hidden="true">
                      +
                    </span>
                  </summary>
                  <p className="max-w-[640px] pb-6 text-[15px] leading-relaxed text-muted">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Get the extension */}
        <section id="get" className="border-t border-line">
          <div className="mx-auto flex max-w-[1120px] flex-col items-start gap-6 px-5 py-20 sm:px-8 md:flex-row md:items-center md:justify-between md:py-24">
            <div>
              <h2 className="text-[32px] leading-tight font-semibold tracking-[-0.025em] sm:text-[40px]">Get QuickReply for Chrome</h2>
              <p className="mt-3 max-w-[520px] text-[17px] leading-relaxed text-muted">
                {siteConfig.chromeStoreUrl
                  ? 'Install it in a few seconds. Your first snippet takes less than a minute.'
                  : 'QuickReply isn’t in the Chrome Web Store yet. The install link will appear here as soon as it’s published.'}
              </p>
            </div>
            <InstallButton />
          </div>
        </section>
      </main>
      <SiteFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(appJsonLd) }} />
    </>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <>
      <span className="flex size-8 items-center justify-center rounded-full border border-line-strong text-[14px] font-semibold tabular-nums">
        {n}
      </span>
      <h3 className="mt-4 text-[18px] font-semibold tracking-[-0.01em]">{title}</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">{body}</p>
    </>
  );
}
