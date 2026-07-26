'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/store';
import { translate as tr } from '@/lib/i18n';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const { selectedLanguage } = useAppStore();

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
        {tr('cookieNotice', selectedLanguage)}{' '}
        {tr('byUsingAgree', selectedLanguage)}{' '}
        <Link href="/privacy" style={{ color: '#93C5FD', textDecoration: 'underline' }}>{tr('privacyPolicy', selectedLanguage)}</Link>
        {' '}{tr('andWord', selectedLanguage)}{' '}
        <Link href="/terms" style={{ color: '#93C5FD', textDecoration: 'underline' }}>{tr('terms', selectedLanguage)}</Link>.
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
          {tr('acceptAll', selectedLanguage)}
        </button>
        <button
          onClick={acceptNecessary}
          style={{
            background: 'transparent', color: '#93C5FD', border: '1px solid #93C5FD',
            borderRadius: 8, padding: '8px 16px', fontWeight: 600,
            fontSize: 13, cursor: 'pointer',
          }}
        >
          {tr('necessaryOnly', selectedLanguage)}
        </button>
      </div>
    </div>
  );
}
