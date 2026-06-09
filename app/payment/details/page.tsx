'use client';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Smartphone, CreditCard, Lock, Info } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

type Method = 'mtn' | 'airtel' | 'bank';

const METHOD_META: Record<Method, { label: string; color: string; icon: React.ReactNode }> = {
  mtn:    { label: 'MTN Mobile Money',  color: '#FFAA00', icon: <Smartphone size={24} /> },
  airtel: { label: 'Airtel Money',      color: '#E53935', icon: <Smartphone size={24} /> },
  bank:   { label: 'Bank / Card',       color: '#2F6BFF', icon: <CreditCard size={24} />  },
};

function DetailsPageContent() {
  const router = useRouter();
  const sp = useSearchParams();

  const amount   = sp.get('amount') ?? '0';
  const currency = sp.get('currency') ?? 'USD';
  const type     = sp.get('type') ?? 'sponsored';
  const days     = sp.get('days') ?? '7';
  const listingId = sp.get('listingId') ?? '';
  const listingTitle = sp.get('listingTitle') ?? '';
  const method   = (sp.get('method') ?? 'mtn') as Method;

  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const meta = METHOD_META[method] ?? METHOD_META.mtn;
  const isMobile = method !== 'bank';

  async function handleProceed() {
    if (submitting) return;
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) { toast.error('Please sign in first.'); return; }

    if (isMobile) {
      if (!phone.trim() || phone.trim().length < 9) {
        toast.error(`Enter a valid ${meta.label} number.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const paymentDetails = isMobile ? { phoneNumber: phone.trim() } : {};

      const { data: result, error } = await supabase.functions.invoke('createPaymentOrder', {
        body: {
          uid: user.id,
          email: user.email ?? '',
          amount: Number(amount),
          currency,
          listingType: type,
          days: Number(days),
          paymentMethod: method,
          paymentDetails,
          listingData: { uid: user.id, listingId, listingTitle, type, days: Number(days) },
        },
      });
      if (error) throw error;

      const paymentId = result?.paymentId;
      if (!paymentId) throw new Error('No payment ID returned.');

      if (method === 'bank' && result?.redirectUrl) {
        window.location.href = result.redirectUrl;
        return;
      }

      const params = new URLSearchParams({ paymentId, amount, currency, type });
      router.push(`/payment/waiting?${params}`);
    } catch (e) {
      toast.error('Failed to initiate payment. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#F0F4FA', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      {/* App bar */}
      <div style={{ background: 'linear-gradient(135deg, #0F2B6E, #1E4DD9)', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', padding: 4 }}>
          <ArrowLeft size={22} />
        </button>
        <span style={{ color: '#fff', fontWeight: 900, fontSize: 17 }}>Payment Details</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {/* Method + amount summary */}
        <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #DCE7F5', padding: 16, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, background: `${meta.color}1F`, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: meta.color, flexShrink: 0 }}>
            {meta.icon}
          </div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 15, color: '#182033' }}>{meta.label}</div>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#6B7A99', marginTop: 2 }}>
              {currency} {Number(amount).toLocaleString()} · {days} days
            </div>
          </div>
        </div>

        {isMobile ? (
          <>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#182033', marginBottom: 6 }}>
              Enter your {method === 'mtn' ? 'MTN' : 'Airtel'} number
            </div>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#6B7A99', marginBottom: 20, lineHeight: 1.4 }}>
              You will receive a payment prompt on your {method === 'mtn' ? 'MTN' : 'Airtel'} line
            </div>

            <div style={{ position: 'relative', marginBottom: 14 }}>
              <Smartphone size={18} color={meta.color} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                placeholder="07XXXXXXXX"
                type="tel"
                inputMode="numeric"
                disabled={submitting}
                style={{ width: '100%', padding: '14px 16px 14px 44px', border: `1.5px solid ${meta.color}40`, borderRadius: 16, fontSize: 16, outline: 'none', background: '#F8FAFF', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
            </div>

            <div style={{ background: `${meta.color}12`, border: `1px solid ${meta.color}33`, borderRadius: 14, padding: 14, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <Info size={18} color={meta.color} style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ color: `${meta.color}E6`, fontWeight: 600, fontSize: 12.5, lineHeight: 1.4 }}>
                After tapping Okay, approve the payment prompt on your phone.
              </span>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#182033', marginBottom: 6 }}>Pay with Card / Bank</div>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#6B7A99', marginBottom: 20, lineHeight: 1.45 }}>
              Tap the button below — Pesapal&apos;s secure payment page will open for you to enter your card details.
            </div>

            <div style={{ background: '#E8F0FF', borderRadius: 16, border: '1px solid #BDD0FF', padding: 16, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <Lock size={20} color="#2F6BFF" style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontWeight: 900, fontSize: 13.5, color: '#1D3D8F' }}>Secured by Pesapal</div>
                <div style={{ fontWeight: 600, fontSize: 12.5, color: '#1D3D8F', marginTop: 4, lineHeight: 1.4 }}>
                  Visa, Mastercard and other cards are accepted. Your card details are never stored on our servers.
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bottom button */}
      <div style={{ padding: '12px 16px 28px', background: '#fff', boxShadow: '0 -4px 12px rgba(0,0,0,0.06)' }}>
        <button onClick={handleProceed} disabled={submitting} style={{ width: '100%', padding: '16px', background: submitting ? '#A0B4E0' : 'linear-gradient(135deg, #0F2B6E, #1E4DD9)', border: 'none', borderRadius: 18, color: '#fff', fontWeight: 900, fontSize: 16, cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {submitting ? (
            <><div style={{ width: 22, height: 22, border: '2px solid rgba(255,255,255,0.4)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />Processing…</>
          ) : 'Okay — Proceed to Pay'}
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </button>
      </div>
    </div>
  );
}

export default function PaymentDetailsPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: 32, height: 32, border: '3px solid #E8EDFF', borderTop: '3px solid #2E5BFF', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>}>
      <DetailsPageContent />
    </Suspense>
  );
}
