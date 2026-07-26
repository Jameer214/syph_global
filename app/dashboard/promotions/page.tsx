'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Crown, Zap, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getMyPromotionRequests } from '@/lib/firestore';
import { useAppStore } from '@/store';
import { translate as tr } from '@/lib/i18n';
import type { PromotionRequest } from '@/types';

function tsToDate(ts: string): Date | null {
  if (!ts) return null;
  try {
    const d = new Date(ts);
    if (!isNaN(d.getTime())) return d;
    const m = ts.match(/seconds=(\d+)/);
    if (m) return new Date(parseInt(m[1]) * 1000);
  } catch { /* ignore */ }
  return null;
}

function formatDate(ts: string): string {
  const d = tsToDate(ts);
  if (!d) return '—';
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

const STATUS_CONFIG = {
  approved: { icon: CheckCircle, color: '#2E9B55', bg: '#E8F5E9', labelKey: 'tabApproved' },
  rejected: { icon: XCircle, color: '#E53935', bg: '#FFECEC', labelKey: 'tabRejected' },
  pending: { icon: AlertCircle, color: '#F39C12', bg: '#FFF8EE', labelKey: 'tabPending' },
};

export default function PromotionsPage() {
  const router = useRouter();
  const { selectedLanguage: lang } = useAppStore();
  const [uid, setUid] = useState<string | null>(null);
  const [requests, setRequests] = useState<PromotionRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      if (!u) { setLoading(false); return; }
      setUid(u.id);
      try {
        const reqs = await getMyPromotionRequests(u.id);
        setRequests(reqs);
      } catch { /* ignore */ }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F0F4FF' }}>
        <div style={{ width: 36, height: 36, border: '3px solid #E8EDFF', borderTop: '3px solid #2E5BFF', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!uid) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#F0F4FF', padding: 24 }}>
        <div style={{ fontWeight: 900, fontSize: 18, color: '#1E2B45' }}>{tr('signInToViewPromos', lang)}</div>
        <button onClick={() => router.push('/login')} style={{ marginTop: 20, background: '#2E5BFF', color: '#fff', border: 'none', borderRadius: 14, padding: '12px 32px', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>{tr('signIn', lang)}</button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#F0F4FF', paddingBottom: 40 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #7A5AF8, #9B72FB)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 40 }}>
        <button onClick={() => router.back()} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, padding: 8, cursor: 'pointer', display: 'flex' }}>
          <ArrowLeft size={20} color="#fff" />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#fff', fontWeight: 900, fontSize: 18 }}>{tr('featPromotionsTitle', lang)}</div>
          <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 }}>{tr('trackBoosts', lang)}</div>
        </div>
      </div>

      <div style={{ padding: '16px 16px 0' }}>

        {requests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: 20, border: '1px solid #eef2f8' }}>
            <div style={{ width: 64, height: 64, background: '#F0F4FF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Crown size={28} color="#9ca3af" />
            </div>
            <p style={{ margin: '0 0 8px', fontWeight: 900, fontSize: 18, color: '#0F2B6E' }}>{tr('noPromotionsYet', lang)}</p>
            <p style={{ margin: '0 0 20px', fontSize: 14, fontWeight: 600, color: '#9ca3af', lineHeight: 1.5 }}>
              {tr('promoteReachDesc', lang)}
            </p>
            <button onClick={() => router.push('/dashboard')}
              style={{ background: '#2E5BFF', color: '#fff', border: 'none', borderRadius: 14, padding: '12px 28px', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
              {tr('goToDashboard', lang)}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {requests.map((req, i) => {
              const status = (req.status as keyof typeof STATUS_CONFIG) in STATUS_CONFIG
                ? (req.status as keyof typeof STATUS_CONFIG)
                : 'pending';
              const cfg = STATUS_CONFIG[status];
              const StatusIcon = cfg.icon;
              const isSponsored = req.type === 'sponsorListing';

              return (
                <div key={i} style={{ background: '#fff', borderRadius: 18, padding: '16px', border: '1px solid #eef2f8', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: isSponsored ? '#FFF8EE' : '#FFF1F0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {isSponsored ? <Crown size={20} color="#F39C12" /> : <Zap size={20} color="#E53935" />}
                      </div>
                      <div>
                        <p style={{ margin: 0, fontWeight: 900, fontSize: 14, color: '#0F2B6E' }}>
                          {isSponsored ? tr('sponsorListingLabel', lang) : tr('flashSaleLabel', lang)}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: 12, fontWeight: 600, color: '#9ca3af' }}>
                          {req.days} {tr('daysWord', lang)}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 99, background: cfg.bg }}>
                      <StatusIcon size={14} color={cfg.color} />
                      <span style={{ fontSize: 12, fontWeight: 800, color: cfg.color }}>{tr(cfg.labelKey, lang)}</span>
                    </div>
                  </div>

                  <div style={{ background: '#F8FAFF', borderRadius: 12, padding: '10px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af' }}>{tr('amountPaid', lang)}</span>
                      <span style={{ fontSize: 13, fontWeight: 900, color: '#0F2B6E' }}>
                        {req.currencyCode} {req.amount.toLocaleString()}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af' }}>{tr('promotePayment', lang)}</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#4A5878', textTransform: 'capitalize' }}>
                        {req.paymentMethod || '—'}
                      </span>
                    </div>
                    {req.transactionReference && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af' }}>{tr('referenceLabel', lang)}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#4A5878', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>
                          {req.transactionReference}
                        </span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af' }}>{tr('submittedLabel', lang)}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#4A5878', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={11} color="#9ca3af" />
                        {req.createdAt ? formatDate(req.createdAt) : '—'}
                      </span>
                    </div>
                  </div>

                  {req.listingId && (
                    <button onClick={() => router.push(`/listing/${req.listingId}`)}
                      style={{ width: '100%', marginTop: 10, padding: '10px', borderRadius: 12, border: '1.5px solid #e2e8f0', background: '#fff', color: '#2E5BFF', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                      {tr('viewListing', lang)}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
