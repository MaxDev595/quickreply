import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/LegalPage';
import { siteConfig } from '@/site.config';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms for using the QuickReply Chrome extension and website.',
  alternates: { canonical: '/terms/' },
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated={siteConfig.legalUpdated}>
      <p>
        These terms apply to the QuickReply Chrome extension and this website. By installing or using QuickReply, you agree to
        them. If you don’t agree, please don’t use QuickReply.
      </p>

      <h2>The service</h2>
      <p>
        QuickReply lets you save text snippets and insert them into text fields on websites by typing a shortcut. The current
        version is free to use. It runs entirely in your browser and does not require an account.
      </p>

      <h2>Your content</h2>
      <p>
        You own the snippets you create. They are stored locally in your browser. You are responsible for the content of your
        snippets and for keeping your own backups, for example by using the export feature.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Use QuickReply in line with the law and with the rules of the websites where you use it. Don’t use it to send spam,
        harass others, or violate anyone’s rights.
      </p>

      <h2>Compatibility</h2>
      <p>
        QuickReply is designed to work in standard text fields, Gmail and most web editors. Some websites use custom input
        methods where expansion may not work. Websites change over time, so compatibility with any particular site isn’t
        guaranteed.
      </p>

      <h2>Changes and availability</h2>
      <p>
        The extension may be updated, changed or discontinued. If paid features are introduced in the future, their terms will be
        presented before you choose to use them.
      </p>

      <h2>No warranty</h2>
      <p>
        QuickReply is provided “as is” and “as available”, without warranties of any kind, to the fullest extent permitted by law.
        Always review text before you send it.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, the QuickReply developers are not liable for any indirect, incidental or
        consequential damages, or for loss of data, arising from your use of QuickReply.
      </p>

      <h2>Privacy</h2>
      <p>
        How QuickReply handles data is described in the <Link href="/privacy/">Privacy Policy</Link>.
      </p>

      <h2>Changes to these terms</h2>
      <p>Updated terms will be posted on this page with a new “Last updated” date.</p>

      <h2>Contact</h2>
      <p>
        See the <Link href="/contact/">contact page</Link>.
      </p>
    </LegalPage>
  );
}
