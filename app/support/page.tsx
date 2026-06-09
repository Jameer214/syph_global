'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ShieldCheck, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { subscribeSupportMessages, sendSupportMessage, markSupportRead } from '@/lib/firestore';
import type { SupportMessage } from '@/types';

function timeLabel(ts: string): string {
  if (!ts) return '';
  // ts may be a Firestore Timestamp stringified or an ISO string
  let d: Date;
  try { d = new Date(ts); } catch { return ''; }
  if (isNaN(d.getTime())) return '';
  const h = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12;
  const m = String(d.getMinutes()).padStart(2, '0');
  const suffix = d.getHours() >= 12 ? 'PM' : 'AM';
  return `${h}:${m} ${suffix}`;
}

export default function SupportPage() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<{ uid: string; displayName: string | null; email: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      if (u) {
        setAuthUser({ uid: u.id, displayName: u.user_metadata?.full_name ?? null, email: u.email ?? null });
      } else {
        setAuthUser(null);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!authUser) return;
    const unsub = subscribeSupportMessages(authUser.uid, (msgs) => {
      setMessages(msgs);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }, 60);
    });
    // mark read on mount
    markSupportRead(authUser.uid);
    return unsub;
  }, [authUser]);

  async function handleSend() {
    if (sending || !text.trim() || !authUser) return;
    const msgText = text.trim();
    setText('');
    setSending(true);
    try {
      await sendSupportMessage(
        authUser.uid,
        authUser.displayName || authUser.email || 'User',
        authUser.email || '',
        msgText,
      );
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }, 60);
    } catch (e) {
      setText(msgText);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F0F4FF' }}>
        <div style={{ width: 36, height: 36, border: '3px solid #E8EDFF', borderTop: '3px solid #2E5BFF', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div style={{ minHeight: '100dvh', background: '#F0F4FF', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <ShieldCheck size={48} color="#2E5BFF" />
        <div style={{ fontWeight: 900, fontSize: 18, color: '#1E2B45', marginTop: 16 }}>Sign in to contact support</div>
        <div style={{ color: '#6B7A99', fontSize: 14, marginTop: 8, textAlign: 'center' }}>You need to be logged in to chat with the SYPH support team.</div>
        <button onClick={() => router.push('/login')} style={{
          marginTop: 24, background: '#2E5BFF', color: '#fff', border: 'none',
          borderRadius: 14, padding: '12px 32px', fontWeight: 800, fontSize: 15, cursor: 'pointer',
        }}>Sign In</button>
        <button onClick={() => router.back()} style={{
          marginTop: 12, background: 'transparent', color: '#6B7A99', border: 'none',
          fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>Go Back</button>
      </div>
    );
  }

  return (
    <div style={{
      height: '100dvh', maxWidth: 480, margin: '0 auto',
      display: 'flex', flexDirection: 'column', background: '#F8FAFF',
    }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0F2B6E 0%, #1E4DD9 100%)',
        padding: '50px 16px 14px', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button onClick={() => router.back()} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, padding: 8, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <ArrowLeft size={20} color="#fff" />
        </button>
        <div style={{ width: 34, height: 34, background: 'rgba(255,255,255,0.20)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ShieldCheck size={20} color="#fff" />
        </div>
        <div>
          <div style={{ color: '#fff', fontWeight: 900, fontSize: 14, letterSpacing: -0.2 }}>SYPH Support</div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>Admin team</div>
        </div>
      </div>

      {/* Info banner */}
      <div style={{
        margin: '10px 12px 4px', padding: '10px 14px',
        background: '#EEF4FF', borderRadius: 14, border: '1px solid #D0E2FF',
        display: 'flex', alignItems: 'flex-start', gap: 8, flexShrink: 0,
      }}>
        <ShieldCheck size={16} color="#2E5BFF" style={{ flexShrink: 0, marginTop: 1 }} />
        <span style={{ color: '#0F2B6E', fontWeight: 600, fontSize: 12, lineHeight: 1.4 }}>
          Messages go directly to the SYPH admin team. Response within 24 hours.
        </span>
      </div>

      {/* Messages area */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
        {messages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
            <div style={{
              background: '#fff', borderRadius: '50%', padding: 22,
              boxShadow: '0 6px 16px rgba(0,0,0,0.07)',
            }}>
              <ShieldCheck size={44} color="#2E5BFF" />
            </div>
            <div style={{ fontWeight: 900, fontSize: 17, color: '#1E2B45' }}>Send us a message</div>
            <div style={{ color: '#6B7A99', fontWeight: 600, fontSize: 14 }}>Our admin team will get back to you.</div>
          </div>
        )}

        {messages.map((msg) => {
          const fromMe = !msg.isFromAdmin;
          return (
            <div key={msg.id} style={{
              display: 'flex', justifyContent: fromMe ? 'flex-end' : 'flex-start',
              marginBottom: 10,
            }}>
              <div style={{
                maxWidth: '74%',
                background: fromMe ? '#2E5BFF' : '#fff',
                borderRadius: fromMe
                  ? '18px 18px 4px 18px'
                  : '18px 18px 18px 4px',
                padding: '10px 14px',
                border: fromMe ? 'none' : '1.2px solid #E0E8F0',
                boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
              }}>
                {!fromMe && (
                  <div style={{ color: '#2E5BFF', fontWeight: 900, fontSize: 11, letterSpacing: 0.2, marginBottom: 4 }}>
                    SYPH Admin
                  </div>
                )}
                <div style={{ color: fromMe ? '#fff' : '#1E2B45', fontWeight: 500, fontSize: 14, lineHeight: 1.45 }}>
                  {msg.text}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
                  <span style={{ color: fromMe ? 'rgba(255,255,255,0.6)' : '#9AA0B2', fontSize: 11 }}>
                    {timeLabel(msg.createdAt)}
                  </span>
                  {fromMe && <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>· Sent</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input bar */}
      <div style={{
        background: '#fff', borderTop: '1px solid #E8EDFF',
        padding: '10px 12px 12px', flexShrink: 0,
        display: 'flex', alignItems: 'flex-end', gap: 10,
      }}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message admin…"
          rows={1}
          disabled={sending}
          style={{
            flex: 1, background: '#F0F4FF', border: 'none', borderRadius: 24,
            padding: '10px 16px', fontSize: 14, outline: 'none', resize: 'none',
            lineHeight: 1.5, maxHeight: 120, overflow: 'auto', fontFamily: 'inherit',
          }}
        />
        <button onClick={handleSend} disabled={sending || !text.trim()} style={{
          width: 44, height: 44, borderRadius: '50%', background: text.trim() ? '#2E5BFF' : '#C8D6FF',
          border: 'none', cursor: text.trim() ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          transition: 'background 0.2s',
        }}>
          {sending ? (
            <div style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          ) : (
            <Send size={20} color="#fff" />
          )}
        </button>
      </div>
    </div>
  );
}
