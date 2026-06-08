'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Zap, MapPin, Bookmark, Calendar } from 'lucide-react';
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
    imageUrls: Array.isArray(data.imageUrls) ? (data.imageUrls as string[]) : undefined,
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
  };
}

export default function HappeningsPage() {
  const router = useRouter();
  const { selectedCountry, selectedCurrency, user, toggleSaved, isSaved } = useAppStore();

  function displayPrice(listing: Listing): string {
    if (listing.priceText?.trim()) return listing.priceText.trim();
    if (listing.priceValue != null) {
      if (selectedCurrency && selectedCurrency !== listing.currencyCode) {
        return `≈ ${formatConverted(listing.priceValue, listing.currencyCode, selectedCurrency)}`;
      }
      return `${getCurrencySymbol(listing.currencyCode)}${listing.priceValue.toLocaleString()}`;
    }
    return '';
  }
  const [happenings, setHappenings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const constraints = [
      where('status', '==', 'approved'),
      where('isHappening', '==', true),
      ...(selectedCountry ? [where('country', '==', selectedCountry)] : []),
      orderBy('createdAt', 'desc'),
      limit(40),
    ];
    const q = query(collection(db, 'listings'), ...constraints);
    const unsub = onSnapshot(q, (snap) => {
      setHappenings(snap.docs.map((d) => mapListing(d.data() as Record<string, unknown>, d.id)));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [selectedCountry]);

  return (
    <div style={{ minHeight: '100dvh', background: '#F0F4FF', maxWidth: 480, margin: '0 auto' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1B5E20 0%, #2E7D32 100%)',
        padding: '52px 20px 24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Zap size={22} color="#fff" fill="#fff" />
          <span style={{ color: '#fff', fontWeight: 900, fontSize: 22 }}>Happenings</span>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.80)', fontSize: 13, fontWeight: 600 }}>
          Events, launches &amp; pop-ups near you
        </div>
        {selectedCountry && (
          <div style={{ marginTop: 8, background: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: '4px 12px', display: 'inline-block' }}>
            <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>📍 {selectedCountry}</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '16px 16px 90px' }}>
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
            <div style={{ width: 36, height: 36, border: '3px solid #E8EDFF', borderTop: '3px solid #2E7D32', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        )}

        {!loading && happenings.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 60, background: '#fff', borderRadius: 22, padding: 28, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <Calendar size={42} color="#6B7A99" />
            <div style={{ fontWeight: 900, fontSize: 16, marginTop: 12, color: '#1E2B45' }}>No happenings yet</div>
            <div style={{ color: '#6B7A99', fontSize: 13, marginTop: 6, lineHeight: 1.4 }}>
              {selectedCountry ? `No happenings in ${selectedCountry} right now.` : 'Approved happenings will appear here.'}
            </div>
          </div>
        )}

        {!loading && happenings.map((item) => (
          <div key={item.id} onClick={() => router.push(`/listing/${item.id}`)}
            style={{
              background: '#fff', borderRadius: 20, marginBottom: 16, overflow: 'hidden',
              cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.07)',
            }}>
            {/* Image */}
            <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: '#f0f4f8' }}>
              {item.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt={item.title}
                  fill
                  style={{ objectFit: 'cover' }}
                  sizes="480px"
                />
              ) : (
                <div style={{ width: '100%', height: '100%', background: '#E8EDFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Calendar size={40} color="#6B7A99" />
                </div>
              )}
              {/* HAPPENING badge */}
              <div style={{
                position: 'absolute', top: 10, left: 10,
                background: '#1B5E20', color: '#fff', fontSize: 10, fontWeight: 900,
                borderRadius: 20, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4,
                letterSpacing: 0.5,
              }}>
                <Zap size={10} fill="#fff" />
                HAPPENING
              </div>
              {/* Save button */}
              <button
                onClick={(e) => { e.stopPropagation(); if (!user) { router.push('/login'); return; } toggleSaved(item.id); }}
                style={{
                  position: 'absolute', top: 10, right: 10,
                  background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '50%',
                  width: 36, height: 36, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                }}>
                <Bookmark size={18} color={isSaved(item.id) ? '#2E5BFF' : '#6B7A99'} fill={isSaved(item.id) ? '#2E5BFF' : 'none'} />
              </button>
            </div>

            {/* Card body */}
            <div style={{ padding: '12px 14px 14px' }}>
              <div style={{ fontWeight: 900, fontSize: 15, color: '#1E2B45', marginBottom: 4 }}>{item.title}</div>
              {displayPrice(item) && (
                <div style={{ fontWeight: 900, fontSize: 14, color: '#2E5BFF', marginBottom: 4 }}>{displayPrice(item)}</div>
              )}
              {item.locationText && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#6B7A99', fontSize: 12, marginBottom: 6 }}>
                  <MapPin size={12} />
                  <span>{item.locationText}</span>
                </div>
              )}
              {item.sellerName && (
                <div style={{ color: '#4A5878', fontSize: 12, fontWeight: 600 }}>by {item.sellerName}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <BottomNav />
    </div>
  );
}
