'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Heart, Plus, Check, Circle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '@/store';
import { supabase } from '@/lib/supabase';
import { tr, getDir } from '@/lib/i18n';
import { fetchActivePolls, votePoll, totalVotes, hasVoted, type Poll, type PollOption } from '@/lib/polls';

// ── Brand SVG icons (lucide has no TikTok / X marks) ─────────────────────────
function TikTokIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#fff" aria-hidden>
      <path d="M16.6 5.82a4.28 4.28 0 0 1-1.05-2.82h-3.2v12.9a2.44 2.44 0 0 1-2.44 2.32 2.44 2.44 0 1 1 .7-4.78V10.2a5.64 5.64 0 0 0-1.03-.09 5.6 5.6 0 1 0 5.6 5.6V9.01a7.5 7.5 0 0 0 4.37 1.4V7.2a4.28 4.28 0 0 1-2.95-1.38z" />
    </svg>
  );
}
function YouTubeIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#fff" aria-hidden>
      <path d="M23.5 6.2a3 3 0 0 0-2.11-2.13C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.39.52A3 3 0 0 0 .5 6.2 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.8 3 3 0 0 0 2.11 2.13c1.89.52 9.39.52 9.39.52s7.5 0 9.39-.52a3 3 0 0 0 2.11-2.13A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.8zM9.6 15.6V8.4l6.2 3.6z" />
    </svg>
  );
}
function InstagramIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1.2" fill="#fff" stroke="none" />
    </svg>
  );
}
function XIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#fff" aria-hidden>
      <path d="M18.9 2h3.3l-7.2 8.24L23.7 22h-6.6l-5.18-6.77L5.99 22H2.68l7.7-8.8L2.3 2h6.77l4.68 6.19zm-1.16 18h1.83L7.34 3.9H5.38z" />
    </svg>
  );
}

interface Platform {
  name: string;
  handle: string;
  url: string;
  Icon: (p: { size?: number }) => React.ReactElement;
  gradient: string;
}

const PLATFORMS: Platform[] = [
  { name: 'TikTok', handle: '@syphglobal1', url: 'https://www.tiktok.com/@syphglobal1?_r=1&_t=ZS-982mRhEL0Mf', Icon: TikTokIcon, gradient: 'linear-gradient(135deg, #010101, #25F4EE)' },
  { name: 'YouTube', handle: '@syphglobal', url: 'https://youtube.com/@syphglobal?si=xHhQSey4B7la5KZL', Icon: YouTubeIcon, gradient: 'linear-gradient(135deg, #FF0000, #CC0000)' },
  { name: 'Instagram', handle: '@syphglobal', url: 'https://www.instagram.com/syphglobal?igsh=MjM0YnVsM3FsMzFx', Icon: InstagramIcon, gradient: 'linear-gradient(135deg, #833AB4, #FD1D1D, #FCB045)' },
  { name: 'X', handle: '@SyphGlobal', url: 'https://x.com/SyphGlobal', Icon: XIcon, gradient: 'linear-gradient(135deg, #14171A, #2B3137)' },
];

const BLUE = '#2E5BFF';
const BLUE_DARK = '#1D49C6';

export default function SocialsPage() {
  const router = useRouter();
  const { selectedLanguage: lang } = useAppStore();

  const [polls, setPolls] = useState<Poll[]>([]);
  const [loadingPolls, setLoadingPolls] = useState(true);
  const [votingIds, setVotingIds] = useState<Set<string>>(new Set());

  const loadPolls = async () => {
    const p = await fetchActivePolls();
    setPolls(p);
    setLoadingPolls(false);
  };

  useEffect(() => { loadPolls(); }, []);

  const openUrl = (url: string) => {
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (!win) toast.error(tr('couldNotOpenLink', lang));
  };

  const vote = async (poll: Poll, option: PollOption) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { toast.error(tr('signInToVote', lang)); return; }
    if (votingIds.has(poll.id)) return;
    setVotingIds((s) => new Set(s).add(poll.id));
    try {
      await votePoll(poll.id, option.id);
      await loadPolls();
    } catch {
      toast.error(tr('voteFailed', lang));
    } finally {
      setVotingIds((s) => { const n = new Set(s); n.delete(poll.id); return n; });
    }
  };

  const sectionLabel = (text: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 4, height: 18, background: BLUE, borderRadius: 4 }} />
      <span style={{ fontWeight: 900, fontSize: 15, color: '#0F2B6E' }}>{text}</span>
    </div>
  );

  return (
    <div dir={getDir(lang)} style={{ minHeight: '100dvh', background: '#F0F4FF', maxWidth: 520, margin: '0 auto' }}>
      {/* App bar */}
      <div style={{ background: 'linear-gradient(135deg, #0F2B6E 0%, #1E4DD9 100%)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 40 }}>
        <button onClick={() => router.back()} aria-label={tr('back', lang)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, padding: 8, cursor: 'pointer', display: 'flex' }}>
          <ArrowLeft size={20} color="#fff" />
        </button>
        <span style={{ color: '#fff', fontWeight: 900, fontSize: 18 }}>{tr('socials', lang)}</span>
      </div>

      <div style={{ padding: '16px 16px 28px' }}>
        {/* Hero card */}
        <div style={{ padding: 20, borderRadius: 22, background: 'linear-gradient(135deg, #1D49C6, #2E67F5)', boxShadow: '0 8px 18px rgba(46,103,245,0.35)' }}>
          <Heart size={34} color="#fff" fill="#fff" />
          <div style={{ color: '#fff', fontSize: 20, fontWeight: 900, marginTop: 12 }}>{tr('socialsJoinCommunity', lang)}</div>
          <div style={{ color: '#fff', fontSize: 13.5, lineHeight: 1.5, fontWeight: 600, marginTop: 8, opacity: 0.95 }}>{tr('socialsJoinBody', lang)}</div>
        </div>

        <div style={{ height: 18 }} />
        {sectionLabel(tr('socialsFollowUs', lang))}
        <div style={{ height: 10 }} />

        {/* Platform cards */}
        {PLATFORMS.map((p) => (
          <div key={p.name} style={{ padding: 14, borderRadius: 18, background: '#fff', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 3px 8px rgba(0,0,0,0.03)', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
            <div style={{ width: 52, height: 52, borderRadius: 15, background: p.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <p.Icon size={24} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 900, fontSize: 15.5, color: '#0F2B6E' }}>{p.name}</div>
              <div style={{ color: '#9AA0B2', fontWeight: 600, fontSize: 12.5, marginTop: 2 }}>{p.handle}</div>
            </div>
            <button onClick={() => openUrl(p.url)} style={{ border: 'none', cursor: 'pointer', borderRadius: 30, padding: '10px 18px', background: p.gradient, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <Plus size={17} color="#fff" />
              <span style={{ color: '#fff', fontWeight: 800, fontSize: 13.5 }}>{tr('follow', lang)}</span>
            </button>
          </div>
        ))}

        {/* Polls */}
        {loadingPolls ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
            <div style={{ width: 32, height: 32, border: '3px solid #E8EDFF', borderTop: `3px solid ${BLUE}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : polls.length === 0 ? null : (
          <div style={{ marginTop: 14 }}>
            {sectionLabel(tr('communityPolls', lang))}
            <div style={{ color: '#9AA0B2', fontSize: 12.5, fontWeight: 600, margin: '4px 0 12px' }}>{tr('pollsSubtitle', lang)}</div>
            {polls.map((poll) => {
              const voting = votingIds.has(poll.id);
              const total = totalVotes(poll);
              const voted = hasVoted(poll);
              return (
                <div key={poll.id} style={{ padding: 16, borderRadius: 18, background: '#fff', border: '1px solid rgba(0,0,0,0.06)', marginBottom: 12 }}>
                  <div style={{ fontWeight: 900, fontSize: 15.5, color: '#0F2B6E' }}>{poll.question}</div>
                  <div style={{ marginTop: 12 }}>
                    {poll.options.map((option) => {
                      const pct = total === 0 ? 0 : option.votes / total;
                      const isMine = poll.myOptionId === option.id;
                      return (
                        <button
                          key={option.id}
                          onClick={() => !voting && vote(poll, option)}
                          disabled={voting}
                          style={{
                            position: 'relative', width: '100%', textAlign: 'left', marginBottom: 8,
                            borderRadius: 12, border: `${isMine ? 1.6 : 1}px solid ${isMine ? BLUE : 'rgba(0,0,0,0.10)'}`,
                            background: 'none', cursor: voting ? 'default' : 'pointer', overflow: 'hidden', padding: 0,
                          }}
                        >
                          {voted && (
                            <div style={{ position: 'absolute', inset: 0, background: isMine ? 'rgba(46,91,255,0.14)' : 'rgba(29,73,198,0.14)', width: `${Math.min(100, Math.max(0, pct * 100))}%` }} />
                          )}
                          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px' }}>
                            {isMine ? <Check size={19} color={BLUE} /> : <Circle size={19} color="#9AA0B2" />}
                            <span style={{ flex: 1, fontWeight: isMine ? 800 : 600, fontSize: 13.5, color: '#0F2B6E' }}>{option.label}</span>
                            {voted && <span style={{ fontWeight: 800, fontSize: 13, color: isMine ? BLUE : '#9AA0B2' }}>{Math.round(pct * 100)}%</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ color: '#9AA0B2', fontSize: 11.5, fontWeight: 600, marginTop: 6 }}>
                    {voted ? `${total} ${tr('votesWord', lang)} · ${tr('tapToChange', lang)}` : `${total} ${tr('votesWord', lang)}`}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
