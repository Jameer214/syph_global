'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Megaphone, Zap, Package } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getCurrencyForCountry, convertPrice } from '@/lib/currency';
import { getSellerProfile } from '@/lib/firestore';
import { getPromoPricing } from '@/lib/adminSettings';
import { useAppStore } from '@/store';
import { translate as tr } from '@/lib/i18n';
import type { SellerProfile } from '@/types';

type UpgradeType = 'sponsored' | 'flash_sale';

interface AdminPricing {
  upgradeToSponsored: Record<string, number>;
  upgradeToFlashSale: Record<string, number>;
}

const DURATIONS = [7, 15, 30];

export default function UpgradeListingPage() {
  const router = useRouter();
  const { selectedLanguage: lang } = useAppStore();
  const { id: listingId } = useParams() as { id: string };

  const [upgradeType, setUpgradeType] = useState<UpgradeType>('sponsored');
  const [selectedDays, setSelectedDays] = useState(7);
  const [loading, setLoading] = useState(false);
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [listingTitle, setListingTitle] = useState('');
  const [adminPricing, setAdminPricing] = useState<AdminPricing | null>(null);

  useEffect(() => {
    // Preselect the upgrade type when the seller came from the dashboard
    // "Sponsor" / "Flash Sale" tiles (…?type=sponsored | flash_sale).
    const t = new URLSearchParams(window.location.search).get('type');
    if (t === 'sponsored' || t === 'flash_sale') setUpgradeType(t);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      if (!u) return;
      const sp = await getSellerProfile(u.id);
      setSeller(sp);
    });
  }, []);

  useEffect(() => {
    if (!listingId) return;
    (async () => {
      try {
        const { data } = await supabase.from('listings').select('title').eq('id', listingId).single();
        if (data) setListingTitle(String((data as Record<string, unknown>).title ?? ''));
      } catch {}
    })();
  }, [listingId]);

  useEffect(() => {
    // Real upgrade prices from the shared backend (same source the app reads).
    getPromoPricing().then((pp) => {
      setAdminPricing({ upgradeToSponsored: pp.upgradeToSponsored, upgradeToFlashSale: pp.upgradeToFlashSale });
    });
  }, []);

  const color = upgradeType === 'sponsored' ? '#2F6BFF' : '#E53935';
  const sellerCurrency = getCurrencyForCountry(seller?.operatingCountry ?? '');

  function getPrice(days: number): string {
    if (!adminPricing) return '...';
    const catKey = upgradeType === 'sponsored' ? 'upgradeToSponsored' : 'upgradeToFlashSale';
    const priceKey = days <= 7 ? 'days7' : days <= 15 ? 'days15' : 'days30';
    const ugx = adminPricing[catKey][priceKey] ?? 0;
    if (ugx <= 0) return '—';
    const converted = Math.round(convertPrice(ugx, 'UGX', sellerCurrency));
    return `${sellerCurrency} ${converted.toLocaleString()}`;
  }

  function getAmountValue(days: number): number {
    if (!adminPricing) return 0;
    const catKey = upgradeType === 'sponsored' ? 'upgradeToSponsored' : 'upgradeToFlashSale';
    const priceKey = days <= 7 ? 'days7' : days <= 15 ? 'days15' : 'days30';
    const ugx = adminPricing[catKey][priceKey] ?? 0;
    return Math.round(convertPrice(ugx, 'UGX', sellerCurrency));
  }

  function handleProceed() {
    if (loading) return;
    setLoading(true);
    const amount = getAmountValue(selectedDays);
    const params = new URLSearchParams({
      amount: String(amount),
      currency: sellerCurrency,
      type: upgradeType === 'sponsored' ? 'sponsored' : 'flashsale',
      days: String(selectedDays),
      listingId,
      listingTitle,
    });
    router.push(`/payment/method?${params}`);
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#F0F4FA', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      {/* App bar */}
      <div style={{ background: 'linear-gradient(135deg, #0F2B6E, #1E4DD9)', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', padding: 4 }}>
          <ArrowLeft size={22} />
        </button>
        <span style={{ color: '#fff', fontWeight: 900, fontSize: 17 }}>{tr('upgradeListing', lang)}</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 16px 100px' }}>

        {/* Listing being upgraded */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.06)', padding: 14, marginBottom: 22, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, background: '#2F6BFF1A', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Package size={20} color="#2F6BFF" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: '#6B7A99', fontWeight: 700, marginBottom: 2 }}>{tr('upgradingLabel', lang)}</div>
            <div style={{ fontWeight: 900, fontSize: 14, color: '#182033', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{listingTitle || tr('loading', lang)}</div>
          </div>
        </div>

        {/* Upgrade type selection */}
        <div style={{ fontWeight: 900, fontSize: 16, color: '#182033', marginBottom: 12 }}>{tr('chooseUpgradeType', lang)}</div>
        {[
          { type: 'sponsored' as const, icon: <Megaphone size={24} />, title: tr('sponsoredListingTitle', lang), subtitle: tr('sponsoredUpgradeDesc', lang), color: '#2F6BFF' },
          { type: 'flash_sale' as const, icon: <Zap size={24} />, title: tr('flashSaleLabel', lang), subtitle: tr('flashUpgradeDesc', lang), color: '#E53935' },
        ].map(({ type, icon, title, subtitle, color: c }) => {
          const sel = upgradeType === type;
          return (
            <button key={type} onClick={() => setUpgradeType(type)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: 16, background: sel ? `${c}12` : '#fff', borderRadius: 18, border: `${sel ? 2 : 1}px solid ${sel ? c : 'rgba(0,0,0,0.07)'}`, cursor: 'pointer', marginBottom: 10, textAlign: 'left', boxShadow: sel ? `0 4px 12px ${c}1F` : undefined }}>
              <div style={{ width: 48, height: 48, background: `${c}1F`, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c, flexShrink: 0 }}>{icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900, fontSize: 15, color: sel ? c : '#182033' }}>{title}</div>
                <div style={{ fontWeight: 600, fontSize: 12.5, color: '#6B7A99', marginTop: 3, lineHeight: 1.35 }}>{subtitle}</div>
              </div>
              {sel && (
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: c, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ color: '#fff', fontSize: 13, fontWeight: 900 }}>✓</span>
                </div>
              )}
            </button>
          );
        })}

        {/* Duration */}
        <div style={{ fontWeight: 900, fontSize: 16, color: '#182033', marginTop: 22, marginBottom: 12 }}>{tr('selectDuration', lang)}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {DURATIONS.map((d) => {
            const sel = selectedDays === d;
            return (
              <button key={d} onClick={() => setSelectedDays(d)} style={{ flex: 1, padding: '14px 8px', borderRadius: 16, border: `${sel ? 2 : 1}px solid ${sel ? color : 'rgba(0,0,0,0.07)'}`, background: sel ? `${color}14` : '#fff', cursor: 'pointer', textAlign: 'center' }}>
                <div style={{ fontWeight: 900, fontSize: 13, color: sel ? color : '#182033' }}>{d} {tr('daysWord', lang)}</div>
                <div style={{ fontWeight: 700, fontSize: 11.5, color: sel ? color : '#6B7A99', marginTop: 4 }}>{getPrice(d)}</div>
              </button>
            );
          })}
        </div>

        {/* Summary */}
        <div style={{ background: `${color}0F`, border: `1px solid ${color}2E`, borderRadius: 16, padding: 16, marginTop: 26 }}>
          {[
            { label: tr('upgradeTypeLabel', lang), value: upgradeType === 'sponsored' ? tr('sponsored', lang) : tr('flashSaleLabel', lang) },
            { label: tr('durationWord', lang), value: `${selectedDays} ${tr('daysWord', lang)}` },
            { label: tr('listingPrice', lang), value: getPrice(selectedDays) },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: '#6B7A99', fontWeight: 700, fontSize: 13 }}>{label}</span>
              <span style={{ fontWeight: 900, fontSize: 13, color }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom button */}
      <div style={{ padding: '12px 16px 28px', background: '#fff', boxShadow: '0 -4px 12px rgba(0,0,0,0.06)' }}>
        <button onClick={handleProceed} disabled={loading} style={{ width: '100%', padding: '16px', background: loading ? '#A0B4E0' : `linear-gradient(135deg, ${color === '#2F6BFF' ? '#1D49C6, #2E67F5' : '#B71C1C, #E53935'})`, border: 'none', borderRadius: 18, color: '#fff', fontWeight: 900, fontSize: 16, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {upgradeType === 'sponsored' ? <Megaphone size={20} /> : <Zap size={20} />}
          {tr('proceedToPayment', lang)}
        </button>
      </div>
    </div>
  );
}
