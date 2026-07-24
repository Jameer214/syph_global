import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import CookieConsent from '@/components/CookieConsent';
import AuthSync from '@/components/AuthSync';

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
        <AuthSync />
        <div className="app-shell">
          {children}
        </div>
        <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
        <CookieConsent />
      </body>
    </html>
  );
}
