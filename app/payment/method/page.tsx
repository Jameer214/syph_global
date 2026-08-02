'use client';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CreditCard, Lock, Info } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { convertPrice, hasRate } from '@/lib/currency';
import toast from 'react-hot-toast';
import { useAppStore } from '@/store';
import { translate as tr } from '@/lib/i18n';

// Currencies Pesapal can process directly (East/Southern Africa + major
// international). Anything else (e.g. NGN, GHS, XOF) is charged in USD by card,
// since Pesapal has no local rail for it — mirrors the app's _pesapalCurrencies.
const PESAPAL_CURRENCIES = new Set(['UGX', 'KES', 'TZS', 'RWF', 'MWK', 'ZMW', 'USD', 'GBP', 'EUR']);

const TYPE_LABEL_KEYS: Record<string, string> = {
  sponsored: 'sponsored', flashsale: 'flashSaleLabel', happenings: 'happenings', listing: 'listingFee',
};
const TYPE_COLORS: Record<string, string> = {
  sponsored: '#63B3ED', flashsale: '#E53935', happenings: '#2E9B55', listing: '#2F6BFF',
};

function MethodPageContent() {
  const router = useRouter();
  const { selectedLanguage: lang } = useAppStore();
  const sp = useSearchParams();

  const amount = sp.get('amount') ?? '0';
  const currency = (sp.get('currency') ?? 'USD').trim().toUpperCase();
  const type = sp.get('type') ?? 'sponsored';
  const days = sp.get('days') ?? '7';
  const listingId = sp.get('listingId') ?? '';
  const listingTitle = sp.get('listingTitle') ?? '';

  const [submitting, setSubmitting] = useState(false);

  const typeColor = TYPE_COLORS[type] ?? '#2F6BFF';
  const typeLabel = TYPE_LABEL_KEYS[type] ? tr(TYPE_LABEL_KEYS[type], lang) : type;

  // Resolve what Pesapal will actually charge: the local currency if it's
  // supported, otherwise convert to USD (card-only) — same rule as the app.
  const isPesapalCur = PESAPAL_CURRENCIES.has(currency);
  const converted = !isPesapalCur;
  // Only convert when we actually have a rate — otherwise block, never guess (app parity).
  const canConvert = !converted || hasRate(currency);
  const chargeCurrency = isPesapalCur ? currency : 'USD';
  const chargeAmount = isPesapalCur
    ? Number(amount)
    : (canConvert ? Math.round(convertPrice(Number(amount), currency, 'USD') * 100) / 100 : 0);

  async function handleProceed() {
    if (submitting) return;
    if (converted && (!canConvert || !(chargeAmount > 0))) { toast.error(tr('currencyConvertUnavailable', lang)); return; }

    // Open the checkout tab synchronously (within the click) so pop-up blockers
    // allow it; we set its URL once the order is created.
    const checkoutWin = window.open('', '_blank');
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) { toast.error(tr('signInFirst', lang)); checkoutWin?.close(); setSubmitting(false); return; }

      const { data: result, error } = await supabase.functions.invoke('createPaymentOrder', {
        body: {
          uid: user.id,
          email: user.email ?? '',
          amount: chargeAmount,
          currency: chargeCurrency,
          listingType: type,
          days: Number(days),
          // Records-only; Pesapal's hosted page presents the country's methods.
          paymentMethod: 'pesapal',
          paymentDetails: {},
          listingData: { uid: user.id, listingId, listingTitle, type, days: Number(days) },
        },
      });
      if (error) throw error;

      const paymentId = result?.paymentId;
      const redirectUrl = result?.redirectUrl;
      if (!paymentId || !redirectUrl) throw new Error('No checkout URL returned.');

      // Send the checkout tab to Pesapal; keep this tab on the waiting page,
      // which polls verifyPaymentStatus (mirrors the app's webview + waiting).
      if (checkoutWin) checkoutWin.location.href = redirectUrl;
      else window.location.href = redirectUrl;
      const params = new URLSearchParams({ paymentId, amount: String(chargeAmount), currency: chargeCurrency, type });
      router.push(`/payment/waiting?${params}`);
    } catch {
      checkoutWin?.close();
      toast.error(tr('failedInitiatePayment', lang));
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
        <span style={{ color: '#fff', fontWeight: 900, fontSize: 17 }}>{tr('choosePaymentMethod', lang)}</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {/* Summary card */}
        <div style={{ background: `linear-gradient(135deg, ${typeColor}, ${typeColor}BF)`, borderRadius: 22, padding: 18, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: `0 8px 16px ${typeColor}40` }}>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: 13 }}>{typeLabel}</div>
            <div style={{ color: '#fff', fontWeight: 900, fontSize: 26, margin: '4px 0' }}>{currency} {Number(amount).toLocaleString()}</div>
            {converted && canConvert
              ? <div style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 700, fontSize: 13 }}>≈ USD {chargeAmount.toLocaleString()} · {days} {tr('daysPromotionSuffix', lang)}</div>
              : <div style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: 13 }}>{days} {tr('daysPromotionSuffix', lang)}</div>}
          </div>
          <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: 14 }}>
            <CreditCard size={28} color="#fff" />
          </div>
        </div>

        {/* Hosted-checkout explanation — Pesapal presents the country's methods */}
        <div style={{ background: '#E8F0FF', borderRadius: 16, border: '1px solid #BDD0FF', padding: 16, display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
          <Lock size={20} color="#2F6BFF" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontWeight: 900, fontSize: 13.5, color: '#1D3D8F' }}>{tr('securedPayment', lang)}</div>
            <div style={{ fontWeight: 600, fontSize: 12.5, color: '#1D3D8F', marginTop: 4, lineHeight: 1.45 }}>
              {tr('hostedCheckoutNote', lang)}
            </div>
          </div>
        </div>

        {/* USD-conversion note when the local currency isn't Pesapal-supported */}
        {converted && (
          <div style={{ background: '#FFF4E5', borderRadius: 14, border: '1px solid rgba(224,138,0,0.35)', padding: 14, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Info size={18} color="#B7791F" style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ color: '#8A5A00', fontWeight: 600, fontSize: 12.5, lineHeight: 1.4 }}>
              {tr('cardOnlyUsdNote', lang)}
            </span>
          </div>
        )}
      </div>

      {/* Proceed button */}
      <div style={{ padding: '12px 16px 28px', background: '#fff', boxShadow: '0 -4px 12px rgba(0,0,0,0.06)' }}>
        <button onClick={handleProceed} disabled={submitting} style={{ width: '100%', padding: '16px', background: submitting ? '#A0B4E0' : 'linear-gradient(135deg, #0F2B6E, #1E4DD9)', border: 'none', borderRadius: 18, color: '#fff', fontWeight: 900, fontSize: 16, cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {submitting ? (
            <><div style={{ width: 22, height: 22, border: '2px solid rgba(255,255,255,0.4)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />{tr('processingEllipsis', lang)}</>
          ) : tr('okayProceedToPay', lang)}
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </button>
      </div>
    </div>
  );
}

export default function PaymentMethodPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: 32, height: 32, border: '3px solid #E8EDFF', borderTop: '3px solid #2E5BFF', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>}>
      <MethodPageContent />
    </Suspense>
  );
}
