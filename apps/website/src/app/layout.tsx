import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { siteConfig } from '@/site.config';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.siteUrl),
  title: {
    default: 'QuickReply — Text Expander & Auto Text for Chrome',
    template: '%s — QuickReply',
  },
  description: siteConfig.description,
  keywords: ['text expander', 'Chrome extension', 'snippets', 'canned responses', 'text shortcuts', 'auto text', 'email templates'],
  applicationName: 'QuickReply',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'QuickReply',
    title: 'QuickReply — Stop typing the same thing over and over',
    description: siteConfig.description,
    url: '/',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'QuickReply turns /hello into a full reply' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'QuickReply — Text Expander for Chrome',
    description: siteConfig.description,
    images: ['/og.png'],
  },
  icons: { icon: '/icon-32.png', apple: '/icon-128.png' },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
