'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Zap, Timer } from 'lucide-react';
import Image from 'next/image';
import {
  collection, query, where, orderBy, limit, onSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/store';
import { formatConverted, getCurrencySymbol } from '@/lib/currency';
import BottomNav from '@/components/BottomNav';
import type { Listing } from '@/types';

function mapListing(data: Record<string, unknown>, id: string): Listing {
  return {
    id,
    title: String(data.title ?? ''),
    description: String(data.description ?? ''),
    imageUrl: String(data.imageUrl ?? ''),
    sellerName: String(data.sellerName ?? ''),
    ownerUid: String(data.ownerUid ?? ''),
    country: String(data.country ?? ''),
    regionOrCity: String(data.regionOrCity ?? ''),
    locationText: String(data.locationText ?? ''),
    priceText: data.priceText ? String(data.priceText) : undefined,
    priceValue: typeof data.priceValue === 'number' ? data.priceValue : undefined,
    currencyCode: String(data.currencyCode ?? 'USD'),
    negotiable: Boolean(data.negotiable),
    mainCategoryId: String(data.mainCategoryId ?? ''),
    openNow: Boolean(data.openNow),
    isSponsored: Boolean(data.isSponsored),
    isHappening: Boolean(data.isHappening),
    isFlashSale: Boolean(data.isFlashSale),
    isTrial: Boolean(data.isTrial),
    status: String(data.status ?? 'pending'),
    viewsCount: typeof data.viewsCount === 'number' ? data.viewsCount : 0,
    savesCount: typeof data.savesCount === 'number' ? data.savesCount : 0,
    messagesCount: typeof data.messagesCount === 'number' ? data.messagesCount : 0,
    createdAt: data.createdAt ? String(data.createdAt) : undefined,
    flashSaleEndsAt: data.flashSaleEndsAt ? String(data.flashSaleEndsAt) : undefined,
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

function FlashSaleCard({ item, selectedCurrency }: { item: Listing; selectedCurrency: string }) {
  const router = useRouter();
  const countdown = useCountdown();

  function displayPrice(listing: Listing): string {
    if (listing.priceText?.trim()) return listing.priceText.trim();
    if (listing.priceValue != null) {
      if (selectedCurrency && selectedCurrency !== listing.currencyCode) {
        return `≈ ${formatConverted(listing.priceValue, listing.currencyCode, selectedCurrency)}`;
      }
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
        }}>FLASH</div>
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
  const { selectedCountry, selectedCurrency } = useAppStore();
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const constraints = [
      where('status', '==', 'approved'),
      where('isFlashSale', '==', true),
      ...(selectedCountry ? [where('country', '==', selectedCountry)] : []),
      orderBy('createdAt', 'desc'),
      limit(40),
    ];
    const q = query(collection(db, 'listings'), ...constraints);
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => mapListing(d.data() as Record<string, unknown>, d.id)));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [selectedCountry]);

  return (
    <div style={{ minHeight: '100dvh', background: '#F0F4FF', maxWidth: 480, margin: '0 auto' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #C62828 0%, #E53935 100%)',
        padding: '52px 20px 24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Zap size={22} color="#fff" fill="#fff" />
          <span style={{ color: '#fff', fontWeight: 900, fontSize: 22 }}>Flash Sales</span>
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
            <div style={{ fontWeight: 900, fontSize: 16, marginTop: 12, color: '#1E2B45' }}>No flash sales yet</div>
            <div style={{ color: '#6B7A99', fontSize: 13, marginTop: 6, lineHeight: 1.4 }}>
              {selectedCountry ? `No flash sales in ${selectedCountry} right now.` : 'Flash sales will appear here when available.'}
            </div>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {items.map((item) => (
              <FlashSaleCard key={item.id} item={item} selectedCurrency={selectedCurrency} />
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
