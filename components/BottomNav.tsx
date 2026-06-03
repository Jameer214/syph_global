'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Zap, Globe, MessageCircle, Bookmark } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAppStore } from '@/store';
import { subscribeChatThreads } from '@/lib/firestore';
import type { ChatThread } from '@/types';

const tabs = [
  { label: 'Home', icon: Home, href: '/home' },
  { label: 'Happenings', icon: Zap, href: '/happenings' },
  { label: 'General', icon: Globe, href: '/general' },
  { label: 'Messages', icon: MessageCircle, href: '/messages' },
  { label: 'Saved', icon: Bookmark, href: '/saved' },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useAppStore();
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

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 480, backgroundColor: '#fff',
      borderTop: '1px solid #f1f5f9', zIndex: 50, height: 60,
    }}>
      <div style={{ display: 'flex', height: '100%' }}>
        {tabs.map((tab) => {
          const active = pathname === tab.href || (tab.href !== '/home' && pathname?.startsWith(tab.href));
          const Icon = tab.icon;
          const isMessages = tab.href === '/messages';
          return (
            <Link key={tab.href} href={tab.href} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 2, textDecoration: 'none',
              color: active ? '#2E5BFF' : '#9ca3af',
            }}>
              <div style={{ position: 'relative' }}>
                <Icon size={22} />
                {isMessages && unread > 0 && (
                  <span style={{
                    position: 'absolute', top: -4, right: -6,
                    background: '#ef4444', color: '#fff', borderRadius: '50%',
                    width: 16, height: 16, fontSize: 9, fontWeight: 900,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </div>
              <span style={{ fontSize: 10, fontWeight: active ? 800 : 600 }}>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
