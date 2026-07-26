'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Zap, Timer } from 'lucide-react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store';
import { formatConverted, getCurrencySymbol } from '@/lib/currency';
import { tr, getDir } from '@/lib/i18n';
import BottomNav from '@/components/BottomNav';
import DistanceChip from '@/components/DistanceChip';
import ZigzagEdge from '@/components/ZigzagEdge';
import { useDistances } from '@/lib/useDistances';
import type { Listing } from '@/types';

function mapListing(row: Record<string, unknown>): Listing {
  const imgs = Array.isArray(row.listing_images) ? (row.listing_images as { url: string }[]) : [];
  return {
    id: String(row.id ?? ''),
    title: String(row.title ?? ''),
    description: String(row.description ?? ''),
    imageUrl: imgs[0]?.url ?? String(row.image_url ?? ''),
    sellerName: String(row.seller_name ?? ''),
    ownerUid: String(row.seller_id ?? ''),
    country: String(row.country ?? ''),
    regionOrCity: String(row.region ?? ''),
    locationText: String(row.location_text ?? ''),
    priceText: row.price_text ? String(row.price_text) : undefined,
    priceValue: typeof row.price === 'number' ? row.price : undefined,
    currencyCode: String(row.currency ?? 'USD'),
    negotiable: Boolean(row.is_negotiable),
    mainCategoryId: String(row.category_id ?? ''),
    openNow: false,
    isSponsored: Boolean(row.is_sponsored),
    isHappening: false,
    isFlashSale: Boolean(row.is_flash_sale),
    isTrial: false,
    status: String(row.status ?? 'pending'),
    viewsCount: typeof row.view_count === 'number' ? row.view_count : 0,
    savesCount: typeof row.save_count === 'number' ? row.save_count : 0,
    messagesCount: 0,
    createdAt: row.created_at ? String(row.created_at) : undefined,
    flashSaleEndsAt: row.flash_sale_until ? String(row.flash_sale_until) : undefined,
    originalPriceValue: typeof row.flash_sale_price === 'number' ? row.flash_sale_price : undefined,
  };
}

function useCountdown(): string {
  const [time, setTime] = useState('');
  useEffect(() => {
    function compute() {
      const now = new Date();
      const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
      const diff = midnight.getTime() - now.getTime();
      const h = String(Math.floor(diff / 3600000)).padStart(2, '0');
      const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
      const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
      setTime(`${h}:${m}:${s}`);
    }
    compute();
    const id = setInterval(compute, 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

function FlashSaleCard({ item, selectedCurrency, distanceKm }: { item: Listing; selectedCurrency: string; distanceKm?: number }) {
  const { selectedLanguage } = useAppStore();
  const router = useRouter();
  const countdown = useCountdown();

  function displayPrice(listing: Listing): string {
    if (listing.priceValue != null && selectedCurrency && selectedCurrency !== listing.currencyCode) {
      return `≈ ${formatConverted(listing.priceValue, listing.currencyCode, selectedCurrency)}`;
    }
    if (listing.priceText?.trim()) return listing.priceText.trim();
    if (listing.priceValue != null) {
      return `${getCurrencySymbol(listing.currencyCode)}${listing.priceValue.toLocaleString()}`;
    }
    return 'Price not set';
  }

  function displayOriginalPrice(listing: Listing): string | null {
    if (listing.originalPriceText?.trim()) return listing.originalPriceText.trim();
    if (listing.originalPriceValue != null) {
      if (selectedCurrency && selectedCurrency !== listing.currencyCode) {
        return `≈ ${formatConverted(listing.originalPriceValue, listing.currencyCode, selectedCurrency)}`;
      }
      return `${getCurrencySymbol(listing.currencyCode)}${listing.originalPriceValue.toLocaleString()}`;
    }
    return null;
  }

  const price = displayPrice(item);
  const originalPrice = displayOriginalPrice(item);

  return (
    <div onClick={() => router.push(`/listing/${item.id}`)}
      style={{
        background: '#fff', borderRadius: 14, overflow: 'hidden', cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}>
      {/* Image */}
      <div style={{ position: 'relative', width: '100%', paddingBottom: '83%', background: '#f0f4f8' }}>
        {item.imageUrl ? (
          <Image src={item.imageUrl} alt={item.title} fill style={{ objectFit: 'cover' }} sizes="240px" />
        ) : (
          <div style={{ position: 'absolute', inset: 0, background: '#F2F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={32} color="#ccc" />
          </div>
        )}
        {/* FLASH badge */}
        <div style={{
          position: 'absolute', top: 8, left: 8,
          background: '#D32F2F', color: '#fff', fontSize: 9, fontWeight: 900,
          borderRadius: 20, padding: '3px 8px', letterSpacing: 0.5,
        }}>{tr('flashWord', selectedLanguage).toUpperCase()}</div>
        <ZigzagEdge color="#fff" />
      </div>

      {/* Body */}
      <div style={{ padding: '8px 8px 0' }}>
        <div style={{ fontWeight: 800, fontSize: 12.5, color: '#1E2B45', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
        {originalPrice && (
          <div style={{ color: '#9AA0B2', fontSize: 10.5, fontWeight: 600, textDecoration: 'line-through', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{originalPrice}</div>
        )}
        <div style={{ color: '#E53935', fontWeight: 900, fontSize: 13, marginTop: originalPrice ? 1 : 3 }}>{price}</div>
        {item.locationText && (
          <div style={{ color: '#6B7A99', fontSize: 11, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.locationText}</div>
        )}
        {distanceKm != null && (
          <div style={{ marginTop: 4 }}><DistanceChip km={distanceKm} size="xs" /></div>
        )}
      </div>

      {/* Countdown banner */}
      <div style={{
        background: '#D32F2F', padding: '5px 8px', marginTop: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
      }}>
        <Timer size={12} color="#fff" />
        <span style={{ color: '#fff', fontSize: 11, fontWeight: 900, letterSpacing: 0.5 }}>
          {countdown} left
        </span>
      </div>
    </div>
  );
}

export default function FlashSalesPage() {
  const { selectedCountry, selectedCurrency, selectedLanguage } = useAppStore();
  const [items, setItems] = useState<Listing[]>([]);
  const distanceById = useDistances(items);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      let q = supabase.from('listings')
        .select('*, listing_images(url, sort_order)')
        .eq('status', 'active')
        .eq('is_flash_sale', true)
        // Exclude flash sales whose timer has already run out (null = no expiry).
        .or(`flash_sale_until.is.null,flash_sale_until.gt.${new Date().toISOString()}`)
        .order('created_at', { ascending: false })
        .limit(40);
      if (selectedCountry) q = q.eq('country', selectedCountry);
      const { data } = await q;
      if (!cancelled) {
        setItems((data ?? []).map((row) => mapListing(row as Record<string, unknown>)));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedCountry]);

  return (
    <div dir={getDir(selectedLanguage)} style={{ minHeight: '100dvh', background: '#F0F4FF', maxWidth: 480, margin: '0 auto' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #C62828 0%, #E53935 100%)',
        padding: '52px 20px 24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Zap size={22} color="#fff" fill="#fff" />
          <span style={{ color: '#fff', fontWeight: 900, fontSize: 22 }}>{tr('flashSalesEndingSoon', selectedLanguage)}</span>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.80)', fontSize: 13, fontWeight: 600 }}>
          Ending soon — grab them before they&apos;re gone!
        </div>
        {selectedCountry && (
          <div style={{ marginTop: 8, background: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: '4px 12px', display: 'inline-block' }}>
            <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>📍 {selectedCountry}</span>
          </div>
        )}
      </div>

      <div style={{ padding: '16px 16px 90px' }}>
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
            <div style={{ width: 36, height: 36, border: '3px solid #FFE0E0', borderTop: '3px solid #E53935', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        )}

        {!loading && items.length === 0 && (
          <div style={{ textAlign: 'center', background: '#fff', borderRadius: 22, padding: 28, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <Zap size={42} color="#6B7A99" />
            <div style={{ fontWeight: 900, fontSize: 16, marginTop: 12, color: '#1E2B45' }}>{tr('noListingsYet', selectedLanguage)}</div>
            <div style={{ color: '#6B7A99', fontSize: 13, marginTop: 6, lineHeight: 1.4 }}>
              {selectedCountry ? tr('noFlashSalesHere', selectedLanguage) : tr('flashSalesWillAppear', selectedLanguage)}
            </div>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {items.map((item) => (
              <FlashSaleCard key={item.id} item={item} selectedCurrency={selectedCurrency} distanceKm={distanceById.get(item.id)} />
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
