'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store';
import { translate as tr } from '@/lib/i18n';

type Status = 'waiting' | 'success' | 'failed';

function Step({ done, pending, label }: { done: boolean; pending?: boolean; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: done ? '#E6F9EF' : '#F0F4FA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {done ? (
          <span style={{ fontSize: 16 }}>✓</span>
        ) : pending ? (
          <div style={{ width: 14, height: 14, border: '2px solid #C4D0E0', borderTop: '2px solid #2F6BFF', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        ) : (
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#C4D0E0' }} />
        )}
      </div>
      <span style={{ fontWeight: 700, fontSize: 13.5, color: done ? '#1B8F4E' : '#182033' }}>{label}</span>
    </div>
  );
}

function WaitingContent() {
  const router = useRouter();
  const { selectedLanguage: lang } = useAppStore();
  const sp = useSearchParams();
  const paymentId = sp.get('paymentId') ?? '';
  const amount = sp.get('amount') ?? '0';
  const currency = sp.get('currency') ?? 'USD';
  const type = sp.get('type') ?? '';
  const isVerification = type === 'verification';

  const [status, setStatus] = useState<Status>('waiting');
  const [errorMessage, setErrorMessage] = useState('');
  const [pollCount, setPollCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef(0);

  useEffect(() => {
    const start = setTimeout(() => {
      timerRef.current = setInterval(async () => {
        pollRef.current += 1;
        setPollCount(pollRef.current);

        if (pollRef.current >= 36) {
          clearInterval(timerRef.current!);
          setStatus('failed');
          setErrorMessage(tr('paymentTimedOut', lang));
          return;
        }

        try {
          const { data: result, error } = await supabase.functions.invoke('verifyPaymentStatus', { body: { paymentId } });
          if (error) throw error;
          const s = result?.status;
          if (s === 'confirmed') {
            clearInterval(timerRef.current!);
            setStatus('success');
          } else if (s === 'failed') {
            clearInterval(timerRef.current!);
            setStatus('failed');
            setErrorMessage(result?.message ?? tr('paymentFailedRetry', lang));
          }
        } catch {
          // silent — keep polling
        }
      }, 5000);
    }, 3000);

    return () => {
      clearTimeout(start);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [paymentId]);

  if (status === 'success') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 24px' }}>
        <div style={{ width: 110, height: 110, borderRadius: '50%', background: 'linear-gradient(135deg, #1B8F4E, #2DBE7F)', boxShadow: '0 0 24px #1B8F4E4D', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 32 }}>
          <span style={{ fontSize: 54, color: '#fff' }}>✓</span>
        </div>
        <div style={{ fontWeight: 900, fontSize: 24, color: '#182033', marginBottom: 10 }}>{tr('paymentSuccessful', lang)}</div>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#1B8F4E', marginBottom: 10 }}>{currency} {Number(amount).toLocaleString()} {tr('paidLabel', lang)}</div>
        <div style={{ fontWeight: 600, fontSize: 14, color: '#6B7A99', textAlign: 'center', lineHeight: 1.5, marginBottom: 32 }}>
          {isVerification ? tr('verificationSubmittedForReview', lang) : tr('submittedForReview', lang)}
        </div>
        <button onClick={() => router.replace(isVerification ? '/dashboard/get-verified' : '/dashboard')} style={{ width: '100%', maxWidth: 360, padding: '16px', background: '#1B8F4E', border: 'none', borderRadius: 18, color: '#fff', fontWeight: 900, fontSize: 16, cursor: 'pointer' }}>
          {tr('backToDashboard', lang)}
        </button>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 24px' }}>
        <div style={{ width: 110, height: 110, borderRadius: '50%', background: 'linear-gradient(135deg, #E53935, #FF6B6B)', boxShadow: '0 0 24px #E5393540', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 32 }}>
          <span style={{ fontSize: 54, color: '#fff' }}>✕</span>
        </div>
        <div style={{ fontWeight: 900, fontSize: 24, color: '#182033', marginBottom: 10 }}>{tr('paymentFailed', lang)}</div>
        <div style={{ fontWeight: 600, fontSize: 14, color: '#6B7A99', textAlign: 'center', lineHeight: 1.5, marginBottom: 32, padding: '0 32px' }}>
          {errorMessage || tr('somethingWentWrong', lang)}
        </div>
        <button onClick={() => router.back()} style={{ width: '100%', maxWidth: 360, padding: '16px', background: '#E53935', border: 'none', borderRadius: 18, color: '#fff', fontWeight: 900, fontSize: 16, cursor: 'pointer' }}>
          {tr('tryAgain', lang)}
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 24px' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{transform:scale(0.9)} 50%{transform:scale(1.1)}}`}</style>
      <div style={{ width: 100, height: 100, borderRadius: '50%', background: 'linear-gradient(135deg, #2F6BFF, #6B9FFF)', boxShadow: '0 0 24px #2F6BFF4D', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 32, animation: 'pulse 1.2s ease-in-out infinite' }}>
        <span style={{ fontSize: 46, filter: 'brightness(10)' }}>💳</span>
      </div>
      <div style={{ fontWeight: 900, fontSize: 22, color: '#182033', marginBottom: 10 }}>{tr('processingPayment', lang)}</div>
      <div style={{ fontWeight: 600, fontSize: 14, color: '#6B7A99', textAlign: 'center', lineHeight: 1.5, marginBottom: 32 }}>
        {tr('confirmPaymentWait', lang)}
      </div>

      <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #DCE7F5', padding: 16, width: '100%', maxWidth: 360, marginBottom: 20 }}>
        <Step done={true} label={tr('paymentRequestSent', lang)} />
        <Step done={false} pending label={tr('awaitingApproval', lang)} />
        <Step done={false} label={isVerification ? tr('documentsWillBeSubmitted', lang) : tr('listingWillBeSubmitted', lang)} />
      </div>

      <div style={{ fontWeight: 600, fontSize: 12, color: '#9AA0B2' }}>
        {pollCount > 0 ? `${tr('checkingLabel', lang)} (${pollCount})` : tr('startingCheckSoon', lang)}
      </div>
    </div>
  );
}

export default function PaymentWaitingPage() {
  const { selectedLanguage: lang } = useAppStore();
  return (
    <div style={{ minHeight: '100dvh', background: '#F0F4FA', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ background: 'linear-gradient(135deg, #0F2B6E, #1E4DD9)', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center' }}>
        <span style={{ color: '#fff', fontWeight: 900, fontSize: 17 }}>{tr('processingEllipsis', lang)}</span>
      </div>
      <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: '#6B7A99', fontWeight: 700 }}>{tr('loading', lang)}</div>}>
        <WaitingContent />
      </Suspense>
    </div>
  );
}
