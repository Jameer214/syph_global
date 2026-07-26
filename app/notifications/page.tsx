'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  MessageCircle, CheckCircle, XCircle, Zap, Calendar, Star,
  Bell, ChevronRight, Shield, Info, Award,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import BottomNav from '@/components/BottomNav';
import { useAppStore } from '@/store';
import { translate as tr, getDir } from '@/lib/i18n';

// ─── types ────────────────────────────────────────────────────────────────────

interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  route?: string;
  createdAt?: Date;
}

interface AdminNotification {
  id: string;
  title: string;
  message: string;
  targetType: string;
  targetUid?: string;
  readBy: Record<string, { seconds: number }>;
  createdAt?: Date;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function timeAgo(dt?: Date): string {
  if (!dt) return 'Just now';
  const diff = Date.now() - dt.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} day ago`;
  const wk = Math.floor(day / 7);
  if (wk < 5) return `${wk} week ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo} month ago`;
  return `${Math.floor(day / 365)} year ago`;
}

function iconBgForType(type: string): string {
  switch (type) {
    case 'message': return '#E8F2FF';
    case 'listing_approved': return '#E6F7EC';
    case 'listing_rejected': return '#FFECEC';
    case 'sponsor_approved': return '#FFF4E5';
    case 'flash_sale_approved': return '#FFEEE8';
    case 'happening_approved': return '#EAF7EE';
    case 'recommendation': return '#F1ECFF';
    default: return '#F2F5F9';
  }
}

function iconColorForType(type: string): string {
  switch (type) {
    case 'message': return '#2E5BFF';
    case 'listing_approved': return '#1F8B4C';
    case 'listing_rejected': return '#D13B3B';
    case 'sponsor_approved': return '#E08A00';
    case 'flash_sale_approved': return '#E25A2C';
    case 'happening_approved': return '#2E9B55';
    case 'recommendation': return '#7A5AF8';
    default: return '#6B7A99';
  }
}

function IconForType({ type, color }: { type: string; color: string }) {
  const props = { size: 26, color };
  switch (type) {
    case 'message': return <MessageCircle {...props} />;
    case 'listing_approved': return <CheckCircle {...props} />;
    case 'listing_rejected': return <XCircle {...props} />;
    case 'sponsor_approved': return <Award {...props} />;
    case 'flash_sale_approved': return <Zap {...props} />;
    case 'happening_approved': return <Calendar {...props} />;
    case 'recommendation': return <Star {...props} />;
    default: return <Bell {...props} />;
  }
}

// ─── main component ───────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const router = useRouter();
  const { user, selectedLanguage } = useAppStore();

  const [uid, setUid] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [adminNotifs, setAdminNotifs] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);

  // auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUid(session?.user?.id ?? null);
      setLoading(false);
    });
  }, []);

  // notifications — not in Supabase schema yet, show empty state
  useEffect(() => {
    if (!uid) { setNotifications([]); return; }
    setNotifications([]);
  }, [uid]);

  useEffect(() => {
    if (!uid) { setAdminNotifs([]); return; }
    setAdminNotifs([]);
  }, [uid]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  async function markAllRead() {
    // No-op — notifications table not yet in Supabase
  }

  async function markNotifRead(_id: string, route?: string) {
    if (route) router.push(route);
  }

  async function markAdminRead(_docId: string) {
    // No-op
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F0F4FF' }}>
        <div style={{ width: 36, height: 36, border: '3px solid #E8EDFF', borderTop: '3px solid #2E5BFF', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  return (
    <div dir={getDir(selectedLanguage)} style={{ minHeight: '100dvh', background: '#F0F4FF', maxWidth: 480, margin: '0 auto', position: 'relative' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0F2B6E 0%, #1E4DD9 60%, #2E5BFF 100%)',
        padding: '52px 20px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ color: '#fff', fontWeight: 900, fontSize: 22 }}>{tr('notifications', selectedLanguage)}</span>
        {unreadCount > 0 && (
          <button onClick={markAllRead} style={{
            background: 'rgba(255,255,255,0.18)', border: 'none', color: '#fff',
            fontWeight: 800, fontSize: 13, borderRadius: 20, padding: '6px 14px',
            cursor: 'pointer',
          }}>
            {tr('markAllRead', selectedLanguage)}
          </button>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '16px 16px 90px' }}>

        {/* Auth gate */}
        {!uid && (
          <div style={{ background: '#fff', borderRadius: 22, padding: 24, textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <Bell size={42} color="#6B7A99" />
            <div style={{ fontWeight: 900, fontSize: 16, marginTop: 12 }}>{tr('signInForNotifications', selectedLanguage)}</div>
            <div style={{ color: '#6B7A99', fontSize: 13, marginTop: 6 }}>{tr('notifRegisteredOnly', selectedLanguage)}</div>
            <button onClick={() => router.push('/login')} style={{
              marginTop: 16, background: '#2E5BFF', color: '#fff', border: 'none',
              borderRadius: 14, padding: '12px 28px', fontWeight: 800, cursor: 'pointer', fontSize: 15,
            }}>{tr('signIn', selectedLanguage)}</button>
          </div>
        )}

        {/* Admin messages */}
        {uid && adminNotifs.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            {/* Section badge */}
            <div style={{ marginBottom: 10 }}>
              <span style={{
                background: '#7A5AF8', color: '#fff', fontWeight: 900,
                fontSize: 12, borderRadius: 999, padding: '6px 12px',
                display: 'inline-flex', alignItems: 'center', gap: 5,
              }}>
                <Shield size={14} />
                From SYPH Admin
              </span>
            </div>

            {adminNotifs.map((n) => {
              const isRead = !!n.readBy[uid!];
              return (
                <div key={n.id}
                  onClick={() => { if (!isRead) markAdminRead(n.id); }}
                  style={{
                    borderRadius: 22,
                    background: isRead
                      ? 'linear-gradient(135deg, #F4F0FF, #EDE8FF)'
                      : 'linear-gradient(135deg, #7A5AF8, #9B7BFF)',
                    boxShadow: `0 5px 12px rgba(122,90,248,${isRead ? 0.06 : 0.22})`,
                    padding: 16, marginBottom: 14, cursor: isRead ? 'default' : 'pointer',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 13, flexShrink: 0,
                      background: isRead ? 'rgba(122,90,248,0.12)' : 'rgba(255,255,255,0.20)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Shield size={22} color={isRead ? '#7A5AF8' : '#fff'} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: isRead ? '#7A5AF8' : '#fff', fontWeight: 900, fontSize: 12, letterSpacing: 0.5 }}>{tr('syphAdmin', selectedLanguage)}</div>
                      <div style={{ color: isRead ? '#182033' : '#fff', fontWeight: 900, fontSize: 14.5 }}>{n.title}</div>
                    </div>
                    {!isRead && <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#fff', flexShrink: 0, marginTop: 4 }} />}
                  </div>
                  <div style={{ color: isRead ? '#3D4658' : 'rgba(255,255,255,0.92)', fontWeight: 600, fontSize: 13.5, lineHeight: 1.45, marginTop: 12 }}>
                    {n.message}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                    <span style={{ color: isRead ? '#6B7A99' : 'rgba(255,255,255,0.70)', fontWeight: 700, fontSize: 12 }}>
                      {timeAgo(n.createdAt)}
                    </span>
                    {!isRead ? (
                      <span style={{
                        background: 'rgba(255,255,255,0.18)', color: '#fff',
                        fontWeight: 800, fontSize: 11, borderRadius: 999, padding: '5px 10px',
                      }}>{tr('tapToRead', selectedLanguage)}</span>
                    ) : (
                      <span style={{
                        background: 'rgba(122,90,248,0.10)', color: '#7A5AF8',
                        fontWeight: 700, fontSize: 11, borderRadius: 999, padding: '5px 10px',
                      }}>Read · disappears in 4hrs</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Unread count banner */}
        {uid && unreadCount > 0 && (
          <div style={{
            background: '#fff', borderRadius: 18, padding: 14, marginBottom: 14,
            border: '1px solid rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <Info size={20} color="#6B7A99" />
            <span style={{ color: '#6B7A99', fontWeight: 700, fontSize: 14 }}>
              You have {unreadCount} unread notification{unreadCount === 1 ? '' : 's'}.
            </span>
          </div>
        )}

        {/* Notification list */}
        {uid && notifications.length === 0 && adminNotifs.length === 0 && (
          <div style={{ background: '#fff', borderRadius: 22, padding: 28, textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <Bell size={42} color="#6B7A99" />
            <div style={{ fontWeight: 900, fontSize: 16, marginTop: 12 }}>{tr('noNotificationsYet', selectedLanguage)}</div>
            <div style={{ color: '#6B7A99', fontSize: 13, marginTop: 6, lineHeight: 1.4 }}>
              You&apos;ll be notified about messages, approvals, and more.
            </div>
          </div>
        )}

        {uid && notifications.map((n) => {
          const iconBg = iconBgForType(n.type);
          const iconColor = iconColorForType(n.type);
          return (
            <div key={n.id}
              onClick={() => markNotifRead(n.id, n.route)}
              style={{
                background: n.isRead ? '#fff' : '#F0F4FF',
                border: n.isRead ? '1px solid rgba(0,0,0,0.05)' : `1px solid rgba(46,91,255,0.18)`,
                borderRadius: 22, marginBottom: 12, padding: 14, cursor: 'pointer',
                boxShadow: '0 4px 8px rgba(0,0,0,0.03)',
              }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{
                  width: 52, height: 52, background: iconBg, borderRadius: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <IconForType type={n.type} color={iconColor} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: n.isRead ? 800 : 900, fontSize: 14.5, color: '#182033' }}>{n.title}</span>
                    {!n.isRead && <div style={{ width: 10, height: 10, background: '#2E5BFF', borderRadius: '50%', flexShrink: 0, marginLeft: 6 }} />}
                  </div>
                  <div style={{ color: '#3D4658', fontWeight: 600, lineHeight: 1.4, fontSize: 13.5, marginTop: 6 }}>{n.body}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                    <span style={{ color: '#6B7A99', fontWeight: 700, fontSize: 12 }}>{timeAgo(n.createdAt)}</span>
                    <ChevronRight size={22} color="#6B7A99" />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <BottomNav />
    </div>
  );
}
