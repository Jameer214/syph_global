import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import CookieConsent from '@/components/CookieConsent';

export const metadata: Metadata = {
  title: 'SYPH — Find It. Locate It. Connect.',
  description: 'Buy and sell anything across Africa and beyond.',
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
