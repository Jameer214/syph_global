'use client';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Smartphone, CreditCard, CheckCircle2 } from 'lucide-react';

type Method = 'mtn' | 'airtel' | 'bank';

interface MethodConfig {
  id: Method;
  title: string;
  subtitle: string;
  color: string;
  icon: React.ReactNode;
}

const METHODS: MethodConfig[] = [
  { id: 'mtn', title: 'MTN Mobile Money', subtitle: 'Pay using your MTN MoMo number', color: '#FFAA00', icon: <Smartphone size={26} /> },
  { id: 'airtel', title: 'Airtel Money', subtitle: 'Pay using your Airtel Money number', color: '#E53935', icon: <Smartphone size={26} /> },
  { id: 'bank', title: 'Bank / Card', subtitle: 'Pay with Visa, Mastercard or bank card', color: '#2F6BFF', icon: <CreditCard size={26} /> },
];

const TYPE_LABELS: Record<string, string> = {
  sponsored: 'Sponsored', flashsale: 'Flash Sale', happenings: 'Happenings', listing: 'Listing Fee',
};

const TYPE_COLORS: Record<string, string> = {
  sponsored: '#63B3ED', flashsale: '#E53935', happenings: '#2E9B55', listing: '#2F6BFF',
};

function MethodPageContent() {
  const router = useRouter();
  const sp = useSearchParams();

  const amount = sp.get('amount') ?? '0';
  const currency = sp.get('currency') ?? 'USD';
  const type = sp.get('type') ?? 'sponsored';
  const days = sp.get('days') ?? '7';
  const listingId = sp.get('listingId') ?? '';
  const listingTitle = sp.get('listingTitle') ?? '';

  const [selected, setSelected] = useState<Method | null>(null);

  const typeColor = TYPE_COLORS[type] ?? '#2F6BFF';
  const typeLabel = TYPE_LABELS[type] ?? type;

  function handleContinue() {
    if (!selected) return;
    const params = new URLSearchParams({ amount, currency, type, days, listingId, listingTitle, method: selected });
    router.push(`/payment/details?${params}`);
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#F0F4FA', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      {/* App bar */}
      <div style={{ background: 'linear-gradient(135deg, #0F2B6E, #1E4DD9)', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', padding: 4 }}>
          <ArrowLeft size={22} />
        </button>
        <span style={{ color: '#fff', fontWeight: 900, fontSize: 17 }}>Choose Payment Method</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {/* Summary card */}
        <div style={{ background: `linear-gradient(135deg, ${typeColor}, ${typeColor}BF)`, borderRadius: 22, padding: 18, marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: `0 8px 16px ${typeColor}40` }}>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: 13 }}>{typeLabel}</div>
            <div style={{ color: '#fff', fontWeight: 900, fontSize: 26, margin: '4px 0' }}>{currency} {Number(amount).toLocaleString()}</div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: 13 }}>{days} days promotion</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: 14 }}>
            <CreditCard size={28} color="#fff" />
          </div>
        </div>

        <div style={{ fontWeight: 900, fontSize: 17, color: '#182033', marginBottom: 14 }}>Select Payment Method</div>

        {METHODS.map((m) => {
          const isSel = selected === m.id;
          return (
            <button key={m.id} onClick={() => setSelected(m.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 16, padding: 18, background: isSel ? `${m.color}0F` : '#fff', borderRadius: 20, border: `${isSel ? 2 : 1}px solid ${isSel ? m.color : '#DCE7F5'}`, cursor: 'pointer', marginBottom: 14, textAlign: 'left', boxShadow: '0 4px 10px rgba(0,0,0,0.04)', transition: 'all 0.18s' }}>
              <div style={{ width: 52, height: 52, background: `${m.color}1F`, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: m.color, flexShrink: 0 }}>
                {m.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900, fontSize: 15, color: isSel ? m.color : '#182033' }}>{m.title}</div>
                <div style={{ fontWeight: 600, fontSize: 12.5, color: '#6B7A99', marginTop: 3 }}>{m.subtitle}</div>
              </div>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: isSel ? m.color : 'transparent', border: `2px solid ${isSel ? m.color : '#BCC8D8'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {isSel && <CheckCircle2 size={14} color="#fff" />}
              </div>
            </button>
          );
        })}
      </div>

      {/* Continue button */}
      <div style={{ padding: '12px 16px 28px', background: '#fff', boxShadow: '0 -4px 12px rgba(0,0,0,0.06)' }}>
        <button onClick={handleContinue} disabled={!selected} style={{ width: '100%', padding: '16px', background: selected ? 'linear-gradient(135deg, #0F2B6E, #1E4DD9)' : '#D0D8F0', border: 'none', borderRadius: 18, color: '#fff', fontWeight: 900, fontSize: 16, cursor: selected ? 'pointer' : 'not-allowed' }}>
          Continue
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
