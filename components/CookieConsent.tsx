'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem('syph-cookie-consent');
    if (!accepted) setVisible(true);
  }, []);

  if (!visible) return null;

  function acceptAll() {
    localStorage.setItem('syph-cookie-consent', 'all');
    setVisible(false);
  }

  function acceptNecessary() {
    localStorage.setItem('syph-cookie-consent', 'necessary');
    setVisible(false);
  }

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: '#0F2B6E', color: '#fff', padding: '14px 20px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 12, flexWrap: 'wrap',
    }}>
      <p style={{ margin: 0, fontSize: 13, flex: 1, minWidth: 200 }}>
        We use cookies and Firebase to provide core features, analytics, and personalization.
        By using SYPH you agree to our{' '}
        <Link href="/privacy" style={{ color: '#93C5FD', textDecoration: 'underline' }}>Privacy Policy</Link>
        {' '}and{' '}
        <Link href="/terms" style={{ color: '#93C5FD', textDecoration: 'underline' }}>Terms</Link>.
      </p>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          onClick={acceptAll}
          style={{
            background: '#2E5BFF', color: '#fff', border: 'none',
            borderRadius: 8, padding: '8px 20px', fontWeight: 700,
            fontSize: 13, cursor: 'pointer',
          }}
        >
          Accept All
        </button>
        <button
          onClick={acceptNecessary}
          style={{
            background: 'transparent', color: '#93C5FD', border: '1px solid #93C5FD',
            borderRadius: 8, padding: '8px 16px', fontWeight: 600,
            fontSize: 13, cursor: 'pointer',
          }}
        >
          Necessary Only
        </button>
      </div>
    </div>
  );
}
