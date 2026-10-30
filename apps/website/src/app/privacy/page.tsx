import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/LegalPage';
import { siteConfig } from '@/site.config';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How QuickReply handles your data: snippets stay in your browser, nothing you type is collected; only plan status is checked with our billing server.',
  alternates: { canonical: '/privacy/' },
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated={siteConfig.legalUpdated}>
      <p>
        QuickReply is a Chrome extension that inserts saved text when you type a shortcut. This policy explains what data the
        extension handles. In short: your snippets stay on your computer and are never sent anywhere. The only thing the
        extension sends is a random install ID, to check which plan you have.
      </p>

      <h2>Data stored on your device</h2>
      <p>QuickReply saves the following in Chrome’s local extension storage (chrome.storage.local) on your computer:</p>
      <ul>
        <li>Your snippets: name, shortcut, text, folder, favorite and on/off status, and when they were created and edited.</li>
        <li>Your folders and settings, such as websites where QuickReply is turned off and your theme.</li>
        <li>Local usage counts: how many times each snippet was inserted and when it was last used, to power “Recently used”.</li>
      </ul>
      <p>
        This data never leaves your browser. QuickReply has no user accounts and no analytics. Your snippets are not synced to
        other devices unless you export a backup file and move it yourself.
      </p>
      <h2>Plan and payments</h2>
      <p>
        To know whether you have the Free plan or a paid plan, the extension creates a random install ID (not linked to your
        name, email or browsing) and sends it to the QuickReply billing server when you open the extension settings or
        dashboard. The server answers with your plan and its end date. If you activate a license key, the key and the install
        ID are sent so the plan can be linked to this browser. Nothing else is sent: no snippets, no typed text, no websites
        you visit.
      </p>
      <p>
        Paid plans are bought with cryptocurrency (USDT or Toncoin on the TON blockchain). When you start a payment, our
        server records the plan, price, currency, the install ID and a unique payment comment. Payments themselves happen in
        your own crypto wallet; we never see or store wallet keys or card details. Like every TON transaction, your payment
        (sender address, amount and comment) is public on the blockchain. To confirm payments, our server reads the incoming
        transactions of our receiving wallet through TonAPI (TON Console).
      </p>
      <p>
        We keep payment and license records (install IDs, license keys, plan, amounts, transaction IDs and the sender wallet
        address) for as long as needed to provide the plan and to meet accounting obligations. The billing server runs on
        Cloudflare.
      </p>

      <h2>Text you type on websites</h2>
      <p>
        To recognize a shortcut, QuickReply looks at the few characters immediately before your cursor while you type in a text
        field. This happens in memory on your device. The text you type is not saved, logged or transmitted. When a shortcut
        matches, only that shortcut is replaced with your snippet.
      </p>
      <p>
        QuickReply ignores password fields, payment card fields, one-time-code fields and fields that look like they hold
        secrets, and it never reads them.
      </p>

      <h2>Clipboard</h2>
      <p>
        The {'{clipboard}'} variable is off by default. If you turn it on, Chrome asks you to grant clipboard access. QuickReply
        then reads your clipboard only at the moment you insert a snippet that contains {'{clipboard}'}, inserts the text, and
        does not store it. You can turn this off at any time in Settings.
      </p>

      <h2>Permissions</h2>
      <ul>
        <li>
          <strong>Storage</strong>: to save your snippets and settings locally.
        </li>
        <li>
          <strong>Access to the websites you visit</strong>: so shortcuts can be expanded in text fields on any site. QuickReply
          does not read page content beyond what is described above.
        </li>
        <li>
          <strong>Clipboard read (optional)</strong>: only if you enable the {'{clipboard}'} variable.
        </li>
        <li>
          <strong>Network</strong>: only the extension’s own pages (settings and dashboard) contact the QuickReply billing server,
          as described in “Plan and payments”. Websites you visit are never contacted on our behalf.
        </li>
      </ul>

      <h2>Sharing and selling</h2>
      <p>
        QuickReply does not sell, rent or share your data with anyone, and does not use it for advertising or to determine
        creditworthiness. The only service providers involved are Cloudflare (hosting of this site and the billing server)
        and TonAPI (reading public blockchain data to confirm payments).
      </p>

      <h2>This website</h2>
      <p>
        This website does not use cookies, analytics or tracking scripts. Like any website, it is delivered by a hosting provider
        that may process technical data such as IP addresses in its server logs to deliver and secure the site.
      </p>

      <h2>Deleting your data</h2>
      <p>
        Delete any snippet in the extension, or remove QuickReply from Chrome to delete all of its data from your browser. Exported
        backup files are ordinary files on your computer that you control. To have your payment and license records deleted,
        contact us; records we must keep for accounting are kept only as long as required.
      </p>

      <h2>Children</h2>
      <p>QuickReply is a general productivity tool and does not knowingly collect information from anyone, including children.</p>

      <h2>Changes</h2>
      <p>If this policy changes, the updated version will be posted on this page with a new “Last updated” date.</p>

      <h2>Contact</h2>
      <p>
        Questions about privacy? See the <Link href="/contact/">contact page</Link>.
      </p>
    </LegalPage>
  );
}
