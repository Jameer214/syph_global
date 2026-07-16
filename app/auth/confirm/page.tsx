'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, XCircle, MailCheck, Loader2 } from 'lucide-react';
import type { EmailOtpType } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type Status = 'idle' | 'loading' | 'success' | 'error';

function ConfirmInner() {
  const params = useSearchParams();
  const tokenHash = params.get('token_hash');
  const type = (params.get('type') ?? 'signup') as EmailOtpType;

  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const confirm = async () => {
    if (!tokenHash) {
      setErrorMsg('This confirmation link is invalid or incomplete. Please use the button in your email.');
      setStatus('error');
      return;
    }
    setStatus('loading');
    // Verify only on tap (not on page load) so email link-scanners can't burn
    // the one-time token before the user gets here.
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) {
      const msg = (error.message || '').toLowerCase();
      setErrorMsg(
        msg.includes('expired')
          ? 'This link has expired. Please sign up again to get a fresh confirmation email.'
          : 'We couldn’t confirm your email — the link may be invalid or already used.'
      );
      setStatus('error');
      return;
    }
    // Confirmed. Sign out so the user logs in fresh with their credentials.
    await supabase.auth.signOut();
    setStatus('success');
  };

  const card: React.CSSProperties = {
    background: '#fff', borderRadius: 24, padding: '36px 28px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.07)', textAlign: 'center',
  };
  const heading: React.CSSProperties = { margin: '18px 0 8px', fontSize: 24, fontWeight: 900, color: '#132A66' };
  const body: React.CSSProperties = { margin: 0, color: '#6B7A99', fontSize: 15, fontWeight: 500, lineHeight: 1.5 };
  const primaryBtn: React.CSSProperties = {
    width: '100%', height: 52, borderRadius: 26, border: 'none', background: '#2E5BFF',
    color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer', marginTop: 24,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  };

  return (
    <div style={{ minHeight: '100dvh', background: '#D6ECFF', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ maxWidth: 460, width: '100%' }}>
        <div style={card}>
          {status === 'success' ? (
            <>
              <CheckCircle2 size={56} color="#22C55E" style={{ display: 'inline-block' }} />
              <h1 style={heading}>Email confirmed! 🎉</h1>
              <p style={body}>Your SYPH account is ready. Please log in to continue.</p>
              <Link href="/login" style={{ textDecoration: 'none' }}>
                <span style={primaryBtn}>Go to Login</span>
              </Link>
            </>
          ) : status === 'error' ? (
            <>
              <XCircle size={56} color="#EF4444" style={{ display: 'inline-block' }} />
              <h1 style={heading}>Confirmation failed</h1>
              <p style={body}>{errorMsg}</p>
              <Link href="/signup" style={{ textDecoration: 'none' }}>
                <span style={{ ...primaryBtn, background: '#132A66' }}>Back to Sign Up</span>
              </Link>
            </>
          ) : (
            <>
              <MailCheck size={56} color="#2E5BFF" style={{ display: 'inline-block' }} />
              <h1 style={heading}>Confirm your email</h1>
              <p style={body}>Tap the button below to confirm your SYPH account and finish signing up.</p>
              <button onClick={confirm} disabled={status === 'loading'} style={{ ...primaryBtn, opacity: status === 'loading' ? 0.7 : 1 }}>
                {status === 'loading' ? (<><Loader2 size={18} className="spin" /> Confirming…</>) : 'Confirm my account'}
              </button>
            </>
          )}
        </div>
      </div>
      <style>{`.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100dvh', background: '#D6ECFF' }} />}>
      <ConfirmInner />
    </Suspense>
  );
}
