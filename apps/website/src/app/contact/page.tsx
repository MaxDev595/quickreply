import type { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';
import { siteConfig } from '@/site.config';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'How to reach the QuickReply team.',
  alternates: { canonical: '/contact/' },
};

export default function ContactPage() {
  return (
    <LegalPage title="Contact">
      {siteConfig.contactEmail ? (
        <p>
          For questions, payments and licenses, feedback or privacy requests, email{' '}
          <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>. For a payment, include the payment
          comment (QR-…) or your license key.
        </p>
      ) : (
        <p>A support email address will be published here when QuickReply launches in the Chrome Web Store.</p>
      )}
      <p>
        Please don’t include passwords or other sensitive information in your message. QuickReply never needs them to help you.
      </p>
    </LegalPage>
  );
}
