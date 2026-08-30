'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Zap, Globe, MessageCircle, Bookmark } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAppStore } from '@/store';
import { subscribeChatThreads } from '@/lib/firestore';
import { translate as tr } from '@/lib/i18n';
import type { ChatThread } from '@/types';

// Desktop-only primary navigation. Mirrors the tab set in BottomNav; shown at
// ≥1024px (via the `.desktop-topnav` rule in globals.css) while the fixed bottom
// bar is hidden. Rendered once globally in app/layout.tsx so every page gets it.
const tabs = [
  { labelKey: 'home', icon: Home, href: '/home' },
  { labelKey: 'happenings', icon: Zap, href: '/happenings' },
  { labelKey: 'general', icon: Globe, href: '/general' },
  { labelKey: 'messages', icon: MessageCircle, href: '/messages' },
  { labelKey: 'saved', icon: Bookmark, href: '/saved' },
];

export default function DesktopTopNav() {
  const pathname = usePathname();
  const { user, selectedLanguage } = useAppStore();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeChatThreads(user.uid, (threads: ChatThread[]) => {
      const total = threads.reduce((sum, t) => {
        return sum + (t.sellerUid === user.uid ? t.unreadForSeller : t.unreadForBuyer);
      }, 0);
      setUnread(total);
    });
    return unsub;
  }, [user]);

  // Hide the primary nav on entry / auth screens — a tab bar there is noise.
  const HIDDEN_PREFIXES = ['/splash', '/welcome', '/login', '/signup', '/auth'];
  if (pathname === '/' || HIDDEN_PREFIXES.some((p) => pathname?.startsWith(p))) {
    return null;
  }

  return (
    <nav className="desktop-topnav" style={{
      position: 'sticky', top: 0, zIndex: 60,
      height: 54, width: '100%', background: '#fff',
      borderBottom: '1px solid #eef1f6',
      alignItems: 'center', gap: 8,
      padding: '0 24px',
      boxShadow: '0 1px 8px rgba(15,43,110,0.06)',
    }}>
      {/* Brand */}
      <Link href="/home" style={{ textDecoration: 'none', marginRight: 12, flexShrink: 0 }}>
        <span style={{
          fontSize: 20, fontWeight: 900, letterSpacing: '1px',
          background: 'linear-gradient(135deg, #0F2B6E 0%, #1E4DD9 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>SYPH</span>
      </Link>

      {/* Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {tabs.map((tab) => {
          const active = pathname === tab.href || (tab.href !== '/home' && pathname?.startsWith(tab.href));
          const Icon = tab.icon;
          const isMessages = tab.href === '/messages';
          return (
            <Link key={tab.href} href={tab.href} className="btn-tap" style={{
              display: 'flex', alignItems: 'center', gap: 7,
              textDecoration: 'none', position: 'relative',
              padding: '8px 14px', borderRadius: 12,
              color: active ? '#2E5BFF' : '#4A5878',
              background: active ? '#EEF3FF' : 'transparent',
              fontWeight: active ? 800 : 600, fontSize: 14,
              transition: 'background 0.2s, color 0.2s',
            }}>
              <div style={{ position: 'relative', display: 'flex' }}>
                <Icon size={19} />
                {isMessages && unread > 0 && (
                  <span style={{
                    position: 'absolute', top: -6, right: -8,
                    background: '#ef4444', color: '#fff', borderRadius: '50%',
                    minWidth: 16, height: 16, padding: '0 4px', fontSize: 9, fontWeight: 900,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </div>
              <span>{tr(tab.labelKey, selectedLanguage)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
