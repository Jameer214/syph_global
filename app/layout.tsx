import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import CookieConsent from '@/components/CookieConsent';

export const metadata: Metadata = {
  metadataBase: new URL('https://www.syphglobal.com'),
  title: 'SYPH — Find It. Locate It. Connect.',
  description: 'Buy and sell anything across Africa and beyond.',
  // icon / apple-icon / opengraph-image / twitter-image are auto-attached from
  // the matching files in app/ (Next.js metadata file conventions).
  openGraph: {
    title: 'SYPH — Find It. Locate It. Connect.',
    description: 'Buy and sell anything across Africa and beyond.',
    url: 'https://www.syphglobal.com',
    siteName: 'SYPH',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SYPH — Find It. Locate It. Connect.',
    description: 'Buy and sell anything across Africa and beyond.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          {children}
        </div>
        <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
        <CookieConsent />
      </body>
    </html>
  );
}
