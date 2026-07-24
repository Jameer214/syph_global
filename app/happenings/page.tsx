'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Zap, MapPin, Bookmark, Calendar } from 'lucide-react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store';
import { formatConverted, getCurrencySymbol } from '@/lib/currency';
import { tr, getDir } from '@/lib/i18n';
import BottomNav from '@/components/BottomNav';
import DistanceChip from '@/components/DistanceChip';
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
    venueLatitude: typeof row.venue_latitude === 'number' ? row.venue_latitude : undefined,
    venueLongitude: typeof row.venue_longitude === 'number' ? row.venue_longitude : undefined,
    priceText: row.price_text ? String(row.price_text) : undefined,
    priceValue: typeof row.price === 'number' ? row.price : undefined,
    currencyCode: String(row.currency ?? 'USD'),
    negotiable: Boolean(row.is_negotiable),
    mainCategoryId: String(row.category_id ?? ''),
    openNow: false,
    isSponsored: Boolean(row.is_sponsored),
    isHappening: true,
    isFlashSale: false,
    isTrial: false,
    status: String(row.status ?? 'pending'),
    viewsCount: typeof row.view_count === 'number' ? row.view_count : 0,
    savesCount: typeof row.save_count === 'number' ? row.save_count : 0,
    messagesCount: 0,
    createdAt: row.created_at ? String(row.created_at) : undefined,
  };
}

export default function HappeningsPage() {
  const router = useRouter();
  const { selectedCountry, selectedCurrency, selectedLanguage, user, toggleSaved, isSaved } = useAppStore();

  function displayPrice(listing: Listing): string {
    if (listing.priceValue != null && selectedCurrency && selectedCurrency !== listing.currencyCode) {
      return `≈ ${formatConverted(listing.priceValue, listing.currencyCode, selectedCurrency)}`;
    }
    if (listing.priceText?.trim()) return listing.priceText.trim();
    if (listing.priceValue != null) {
      return `${getCurrencySymbol(listing.currencyCode)}${listing.priceValue.toLocaleString()}`;
    }
    return '';
  }
  const [happenings, setHappenings] = useState<Listing[]>([]);
  const distanceById = useDistances(happenings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      let q = supabase.from('happenings')
        .select('*, listing_images(url, sort_order)')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(40);
      if (selectedCountry) q = q.eq('country', selectedCountry);
      const { data } = await q;
      if (!cancelled) {
        setHappenings((data ?? []).map((row) => mapListing(row as Record<string, unknown>)));
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
        background: 'linear-gradient(135deg, #1B5E20 0%, #2E7D32 100%)',
        padding: '52px 20px 24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Zap size={22} color="#fff" fill="#fff" />
          <span style={{ color: '#fff', fontWeight: 900, fontSize: 22 }}>{tr('happeningsNearYou', selectedLanguage)}</span>
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
            <div style={{ fontWeight: 900, fontSize: 16, marginTop: 12, color: '#1E2B45' }}>{tr('noListingsYet', selectedLanguage)}</div>
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
              {distanceById.get(item.id) != null && (
                <div style={{ marginBottom: 6 }}><DistanceChip km={distanceById.get(item.id)} size="xs" /></div>
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
