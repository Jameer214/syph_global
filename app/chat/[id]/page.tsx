'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  doc, getDoc, addDoc, collection, setDoc, serverTimestamp, increment, onSnapshot,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useAppStore } from '@/store';
import { tr, getDir } from '@/lib/i18n';
import { subscribeChatMessages, markThreadRead } from '@/lib/firestore';
import type { ChatMessage } from '@/types';

function formatTime(createdAt: string): string {
  if (!createdAt) return '';
  let d: Date | null = null;
  try {
    const parsed = new Date(createdAt);
    if (!isNaN(parsed.getTime())) {
      d = parsed;
    } else {
      const match = createdAt.match(/seconds=(\d+)/);
      if (match) d = new Date(parseInt(match[1]) * 1000);
    }
  } catch {
    return '';
  }
  if (!d) return '';
  const hour = d.getHours() % 12 || 12;
  const minute = String(d.getMinutes()).padStart(2, '0');
  const suffix = d.getHours() >= 12 ? 'PM' : 'AM';
  return `${hour}:${minute} ${suffix}`;
}

interface ThreadInfo {
  sellerUid: string;
  buyerUid: string;
  sellerName: string;
  buyerName: string;
  listingTitle: string;
  listingImageUrl: string;
}

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const threadId = params.id as string;

  const { user, selectedLanguage } = useAppStore();
  const fireUser = auth.currentUser;
  const currentUid = user?.uid ?? fireUser?.uid ?? '';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threadInfo, setThreadInfo] = useState<ThreadInfo | null>(null);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load thread info
  useEffect(() => {
    getDoc(doc(db, 'chats', threadId)).then((snap) => {
      if (snap.exists()) {
        const d = snap.data() as Record<string, unknown>;
        setThreadInfo({
          sellerUid: String(d.sellerUid ?? ''),
          buyerUid: String(d.buyerUid ?? ''),
          sellerName: String(d.sellerName ?? 'Seller'),
          buyerName: String(d.buyerName ?? 'User'),
          listingTitle: String(d.listingTitle ?? ''),
          listingImageUrl: String(d.listingImageUrl ?? ''),
        });
      }
    }).catch(() => {});
  }, [threadId]);

  // Subscribe to messages
  useEffect(() => {
    const unsub = subscribeChatMessages(threadId, setMessages);
    return unsub;
  }, [threadId]);

  // Mark as read when opened
  useEffect(() => {
    if (!currentUid || !threadInfo) return;
    const isSeller = currentUid === threadInfo.sellerUid;
    markThreadRead(threadId, isSeller).catch(() => {});
  }, [threadId, currentUid, threadInfo]);

  // Auto scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage() {
    if (sending || !inputText.trim()) return;
    if (!currentUid) { toast.error('Please sign in first.'); return; }

    const text = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      const isSeller = currentUid === threadInfo?.sellerUid;
      const otherUnreadField = isSeller ? 'unreadForBuyer' : 'unreadForSeller';

      await addDoc(collection(db, 'chats', threadId, 'messages'), {
        senderUid: currentUid,
        text,
        createdAt: serverTimestamp(),
      });

      await setDoc(doc(db, 'chats', threadId), {
        lastMessage: text,
        lastSenderUid: currentUid,
        updatedAt: serverTimestamp(),
        [otherUnreadField]: increment(1),
      }, { merge: true });
    } catch (e) {
      toast.error(`Failed to send: ${e}`);
      setInputText(text); // restore
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  const isSeller = currentUid === threadInfo?.sellerUid;
  const otherName = threadInfo ? (isSeller ? threadInfo.buyerName : threadInfo.sellerName) : 'Chat';
  const listingTitle = threadInfo?.listingTitle ?? '';
  const listingImage = threadInfo?.listingImageUrl ?? '';

  return (
    <div dir={getDir(selectedLanguage)} className="app-shell" style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc' }}>
      {/* Custom header */}
      <div style={{ background: 'linear-gradient(135deg, #0F2B6E 0%, #1E4DD9 100%)', padding: '0 16px', height: 62, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button onClick={() => router.back()} aria-label={tr('back', selectedLanguage)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', padding: 4 }}>
          <ArrowLeft size={22} />
        </button>

        {/* Listing thumbnail */}
        <div style={{ width: 36, height: 36, borderRadius: 10, overflow: 'hidden', flexShrink: 0, backgroundColor: 'rgba(255,255,255,0.2)', position: 'relative' }}>
          {listingImage ? (
            <Image src={listingImage} alt={listingTitle} fill style={{ objectFit: 'cover' }} sizes="36px" unoptimized />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
              {isSeller ? '👤' : '🏪'}
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, color: '#fff', fontWeight: 800, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{otherName}</p>
          {listingTitle && (
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{listingTitle}</p>
          )}
        </div>
      </div>

      {/* Messages list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#9ca3af', padding: 40, fontWeight: 700 }}>{tr('noMessages', selectedLanguage)}</div>
        ) : (
          messages.map((msg) => {
            const fromMe = currentUid !== '' && msg.senderUid === currentUid;
            return (
              <div key={msg.id} style={{ display: 'flex', justifyContent: fromMe ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
                <div style={{
                  maxWidth: 280,
                  padding: '10px 12px',
                  borderRadius: fromMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: fromMe ? '#2E5BFF' : '#F1F5F9',
                  border: fromMe ? 'none' : '1px solid #e2e8f0',
                }}>
                  <p style={{ margin: 0, color: fromMe ? '#fff' : '#0f172a', fontWeight: 600, lineHeight: 1.4, wordBreak: 'break-word' }}>{msg.text}</p>
                  <p style={{ margin: '6px 0 0', fontSize: 11, color: fromMe ? 'rgba(255,255,255,0.7)' : '#9ca3af', textAlign: 'right' }}>{formatTime(msg.createdAt)}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div style={{ borderTop: '1px solid #e2e8f0', padding: '10px 12px 12px', backgroundColor: '#D6ECFF', display: 'flex', gap: 10, alignItems: 'flex-end', flexShrink: 0 }}>
        <textarea
          ref={inputRef}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          disabled={sending}
          placeholder={tr('yourMessage', selectedLanguage)}
          rows={1}
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 20, border: '1px solid #e2e8f0',
            background: '#fff', fontSize: 14, fontFamily: 'inherit', resize: 'none',
            outline: 'none', lineHeight: 1.5, maxHeight: 100, overflowY: 'auto',
          }}
        />
        <button
          onClick={sendMessage}
          disabled={sending || !inputText.trim()}
          aria-label={tr('send', selectedLanguage)}
          style={{
            width: 44, height: 44, borderRadius: '50%',
            background: inputText.trim() ? '#2E5BFF' : '#e2e8f0',
            border: 'none', cursor: inputText.trim() ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            transition: 'background 0.2s',
          }}
        >
          {sending ? (
            <span style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.5)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
          ) : (
            <Send size={18} color={inputText.trim() ? '#fff' : '#9ca3af'} />
          )}
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
