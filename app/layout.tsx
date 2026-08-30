import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import CookieConsent from '@/components/CookieConsent';
import AuthSync from '@/components/AuthSync';
import JsonLd from '@/components/JsonLd';
import DesktopTopNav from '@/components/DesktopTopNav';

// Site-wide structured data: identifies the brand + enables the search box
// sitelink in Google results. Listing pages add their own Product node.
const ORG_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'SYPH',
  url: 'https://www.syphglobal.com',
  logo: 'https://www.syphglobal.com/icon.png',
  description:
    'SYPH is your digital broker — find and connect with the businesses you want, anywhere. Search nearby, get GPS directions, and chat directly. No middleman.',
};

const WEBSITE_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'SYPH',
  url: 'https://www.syphglobal.com',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: 'https://www.syphglobal.com/home?q={search_term_string}',
    },
    'query-input': 'required name=search_term_string',
  },
};

export const metadata: Metadata = {
  metadataBase: new URL('https://www.syphglobal.com'),
  title: 'SYPH — Find It. Locate It. Connect.',
  description: 'SYPH is your digital broker — find and connect with the businesses you want, anywhere. Search nearby, get GPS directions, and chat directly. No middleman.',
  // icon / apple-icon / opengraph-image / twitter-image are auto-attached from
  // the matching files in app/ (Next.js metadata file conventions).
  openGraph: {
    title: 'SYPH — Find It. Locate It. Connect.',
    description: 'SYPH is your digital broker — find and connect with the businesses you want, anywhere. Search nearby, get GPS directions, and chat directly. No middleman.',
    url: 'https://www.syphglobal.com',
    siteName: 'SYPH',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SYPH — Find It. Locate It. Connect.',
    description: 'SYPH is your digital broker — find and connect with the businesses you want, anywhere. Search nearby, get GPS directions, and chat directly. No middleman.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <JsonLd data={ORG_JSON_LD} />
        <JsonLd data={WEBSITE_JSON_LD} />
        <AuthSync />
        <DesktopTopNav />
        <div className="app-shell">
          {children}
        </div>
        <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
        <CookieConsent />
      </body>
    </html>
  );
}
