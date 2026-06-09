'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { MessageCircle, Trash2, ShieldCheck } from 'lucide-react';
import { sanitizeText } from '@/lib/sanitize';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store';
import { translate as tr, getDir } from '@/lib/i18n';
import { subscribeChatThreads } from '@/lib/firestore';
import BottomNav from '@/components/BottomNav';
import type { ChatThread } from '@/types';

function timeLabel(updatedAt: string): string {
  if (!updatedAt) return '';
  // updatedAt may be a Firestore Timestamp string like "Timestamp(seconds=..., nanoseconds=...)"
  // or an ISO string. Try to parse a Date.
  let d: Date | null = null;
  try {
    // Try direct parsing
    const parsed = new Date(updatedAt);
    if (!isNaN(parsed.getTime())) {
      d = parsed;
    } else {
      // Try extracting seconds from Firestore Timestamp string
      const match = updatedAt.match(/seconds=(\d+)/);
      if (match) d = new Date(parseInt(match[1]) * 1000);
    }
  } catch {
    return '';
  }
  if (!d) return '';

  const now = new Date();
  const isToday = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  if (isToday) {
    const hour = d.getHours() % 12 || 12;
    const minute = String(d.getMinutes()).padStart(2, '0');
    const suffix = d.getHours() >= 12 ? 'PM' : 'AM';
    return `${hour}:${minute} ${suffix}`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.getFullYear() === yesterday.getFullYear() && d.getMonth() === yesterday.getMonth() && d.getDate() === yesterday.getDate();
  if (isYesterday) return 'Yesterday';
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

export default function MessagesPage() {
  const router = useRouter();
  const { user, selectedLanguage } = useAppStore();
  const uid = user?.uid ?? '';

  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    const unsub = subscribeChatThreads(uid, (ts) => {
      setThreads(ts);
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  async function hideThread(threadId: string) {
    if (!uid) return;
    setDeletingId(threadId);
    try {
      // Just remove from local state; no hidden_for field in Supabase schema
      setThreads((prev) => prev.filter((t) => t.id !== threadId));
      toast.success('Conversation removed');
    } catch {
      toast.error('Failed to delete conversation');
    } finally {
      setDeletingId(null);
      setConfirmDelete(null);
    }
  }

  if (!uid) {
    return (
      <div dir={getDir(selectedLanguage)} className="app-shell" style={{ minHeight: '100vh', backgroundColor: '#fff' }}>
        <div style={{ background: 'linear-gradient(135deg, #0F2B6E 0%, #1E4DD9 100%)', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center' }}>
          <span style={{ color: '#fff', fontWeight: 900, fontSize: 18 }}>{tr('messages', selectedLanguage)}</span>
        </div>
        <div style={{ padding: 16, paddingBottom: 80 }}>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24, textAlign: 'center' }}>
            <MessageCircle size={40} color="#9ca3af" />
            <p style={{ fontWeight: 900, margin: '10px 0 6px', color: '#0f172a' }}>{tr('signInToViewMessages', selectedLanguage)}</p>
            <p style={{ margin: 0, color: '#6B7A99', fontSize: 13 }}>You need to be signed in to access your messages.</p>
            <button onClick={() => router.push('/login')} style={{ marginTop: 16, padding: '12px 24px', background: '#2E5BFF', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 900, cursor: 'pointer' }}>{tr('signIn', selectedLanguage)}</button>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div dir={getDir(selectedLanguage)} className="app-shell" style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0F2B6E 0%, #1E4DD9 100%)', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', position: 'sticky', top: 0, zIndex: 40 }}>
        <span style={{ color: '#fff', fontWeight: 900, fontSize: 18, flex: 1 }}>{tr('messages', selectedLanguage)}</span>
      </div>

      <div style={{ padding: '12px 16px', paddingBottom: 80 }}>
        {/* SYPH Support entry */}
        <div onClick={() => router.push('/support')} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, cursor: 'pointer', border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
          <div style={{ width: 56, height: 56, borderRadius: 12, background: 'linear-gradient(135deg, #0F2B6E, #2E5BFF)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ShieldCheck size={26} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 900, fontSize: 14.5, color: '#0f172a' }}>{tr('syphSupport', selectedLanguage)}</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#2E5BFF', fontWeight: 700 }}>Admin team</p>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6B7A99', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Chat with us</p>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#6B7A99' }}>{tr('loading', selectedLanguage)}</div>
        ) : threads.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, textAlign: 'center', border: '1px solid #e2e8f0' }}>
            <MessageCircle size={40} color="#9ca3af" />
            <p style={{ fontWeight: 900, margin: '10px 0 6px', color: '#0f172a' }}>{tr('noMessagesYet', selectedLanguage)}</p>
            <p style={{ margin: 0, color: '#6B7A99', fontSize: 13 }}>Start a chat from a listing page.</p>
          </div>
        ) : (
          threads.map((thread) => {
            const isSeller = uid === thread.sellerUid;
            const otherName = isSeller ? thread.buyerName : thread.sellerName;
            const unreadCount = isSeller ? thread.unreadForSeller : thread.unreadForBuyer;
            const isUnread = unreadCount > 0;

            return (
              <div key={thread.id} style={{ position: 'relative', marginBottom: 8 }}>
                {/* Swipe-to-delete reveal */}
                <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, display: 'flex', alignItems: 'stretch', borderRadius: '0 12px 12px 0', overflow: 'hidden', zIndex: 0 }}>
                  <button
                    onClick={() => setConfirmDelete(thread.id)}
                    style={{ background: '#ef4444', border: 'none', cursor: 'pointer', padding: '0 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, color: '#fff', fontWeight: 700, fontSize: 12, borderRadius: '0 12px 12px 0' }}
                  >
                    <Trash2 size={22} />
                    Delete
                  </button>
                </div>

                <div
                  onClick={() => router.push(`/chat/${thread.id}`)}
                  style={{ position: 'relative', background: '#fff', borderRadius: 12, padding: 12, display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer', border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.03)', zIndex: 1 }}
                >
                  {/* Thumbnail */}
                  <div style={{ width: 56, height: 56, borderRadius: 12, overflow: 'hidden', flexShrink: 0, backgroundColor: '#EEF3FF', position: 'relative' }}>
                    {thread.listingImageUrl ? (
                      <Image src={thread.listingImageUrl} alt={thread.listingTitle} fill style={{ objectFit: 'cover' }} sizes="56px" />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {isSeller ? <span style={{ fontSize: 26 }}>👤</span> : <span style={{ fontSize: 26 }}>🏪</span>}
                      </div>
                    )}
                  </div>

                  {/* Text */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontWeight: isUnread ? 900 : 700, fontSize: 14.5, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>{sanitizeText(otherName)}</span>
                      <span style={{ fontSize: 11.5, color: isUnread ? '#2E5BFF' : '#9ca3af', fontWeight: isUnread ? 700 : 500, flexShrink: 0 }}>{timeLabel(thread.updatedAt)}</span>
                    </div>
                    {thread.listingTitle && (
                      <p style={{ margin: '0 0 2px', fontSize: 12, color: '#2E5BFF', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sanitizeText(thread.listingTitle)}</p>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, color: isUnread ? '#0f172a' : '#9ca3af', fontWeight: isUnread ? 600 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {thread.lastMessage || 'Open chat'}
                      </span>
                      {isUnread && (
                        <span style={{ background: '#2E5BFF', color: '#fff', borderRadius: 999, padding: '3px 7px', fontSize: 11, fontWeight: 900, flexShrink: 0, marginLeft: 8 }}>
                          {unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Delete confirm dialog */}
      {confirmDelete && (
        <>
          <div onClick={() => setConfirmDelete(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#fff', borderRadius: 20, padding: 24, zIndex: 201, width: 300, maxWidth: '90vw' }}>
            <p style={{ fontWeight: 900, fontSize: 17, margin: '0 0 8px', color: '#0f172a' }}>{tr('deleteConversation', selectedLanguage)}</p>
            <p style={{ margin: '0 0 20px', color: '#6B7A99', fontSize: 14 }}>This will remove the conversation from your messages.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff', fontWeight: 800, cursor: 'pointer' }}>{tr('cancel', selectedLanguage)}</button>
              <button onClick={() => hideThread(confirmDelete)} disabled={!!deletingId} style={{ flex: 1, padding: '12px', borderRadius: 12, background: '#ef4444', color: '#fff', border: 'none', fontWeight: 900, cursor: 'pointer' }}>{tr('done', selectedLanguage)}</button>
            </div>
          </div>
        </>
      )}

      <BottomNav />
    </div>
  );
}
