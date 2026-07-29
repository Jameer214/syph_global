'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { useAppStore } from '@/store';
import { tr, getDir } from '@/lib/i18n';
import { formatConverted, getCurrencySymbol } from '@/lib/currency';
import { getListingsByIds, getSavedIds, syncSavedIds, getPriceDropEvents, type PriceDropEvent } from '@/lib/firestore';
import BottomNav from '@/components/BottomNav';
import DistanceChip from '@/components/DistanceChip';
import OpenStatusChip from '@/components/OpenStatusChip';
import { useDistances } from '@/lib/useDistances';
import type { Listing } from '@/types';

export default function SavedPage() {
  const router = useRouter();
  const { user, savedIds, toggleSaved, isSaved, selectedCurrency, selectedLanguage } = useAppStore();

  function displayPrice(listing: Listing): string | null {
    if (listing.priceValue != null && selectedCurrency && selectedCurrency !== listing.currencyCode) {
      return `≈ ${formatConverted(listing.priceValue, listing.currencyCode, selectedCurrency)}`;
    }
    if (listing.priceText?.trim()) return listing.priceText.trim();
    if (listing.priceValue != null) {
      return `${getCurrencySymbol(listing.currencyCode)}${listing.priceValue.toLocaleString()}`;
    }
    return null;
  }
  const uid = user?.uid ?? '';

  const [savedListings, setSavedListings] = useState<Listing[]>([]);
  const distanceById = useDistances(savedListings);
  const [loading, setLoading] = useState(true);
  // Price-drop events keyed by listing id (best-effort; empty on any failure).
  const [priceDrops, setPriceDrops] = useState<Record<string, PriceDropEvent>>({});

  // Load price-drop events for the current user (best-effort, additive).
  useEffect(() => {
    if (!uid) { setPriceDrops({}); return; }
    getPriceDropEvents(uid).then(setPriceDrops).catch(() => setPriceDrops({}));
  }, [uid]);

  // Formats a raw numeric price into the user's display currency (mirrors displayPrice).
  function fmtPrice(value: number | null, listingCurrency: string): string {
    if (value == null) return '';
    if (selectedCurrency && selectedCurrency !== listingCurrency) {
      return formatConverted(value, listingCurrency, selectedCurrency);
    }
    return `${getCurrencySymbol(listingCurrency)}${value.toLocaleString()}`;
  }

  // Load saved listings whenever savedIds changes
  useEffect(() => {
    if (!uid) {
      setLoading(false);
      setSavedListings([]);
      return;
    }

    if (savedIds.length === 0) {
      setSavedListings([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    // Single batched query instead of one request per saved id (was an N+1:
    // 80 saved items → 80 round-trips on every mount / save toggle).
    getListingsByIds(savedIds)
      .then((results) => {
        setSavedListings(results);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [uid, savedIds]);

  // Sync saved IDs with Firestore on mount / when uid changes
  useEffect(() => {
    if (!uid) return;
    // Pull remote saved IDs and merge with local
    getSavedIds(uid).then((remoteIds) => {
      const merged = Array.from(new Set([...savedIds, ...remoteIds]));
      if (merged.length !== savedIds.length) {
        // Update local store by toggling in missing ones
        remoteIds.forEach((id) => {
          if (!savedIds.includes(id)) toggleSaved(id);
        });
      }
      // Push merged back to Firestore
      syncSavedIds(uid, merged).catch(() => {});
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  // Sync savedIds to Firestore whenever they change
  useEffect(() => {
    if (!uid) return;
    syncSavedIds(uid, savedIds).catch(() => {});
  }, [uid, savedIds]);

  if (!uid) {
    return (
      <div dir={getDir(selectedLanguage)} className="app-shell" style={{ minHeight: '100vh', backgroundColor: '#fff' }}>
        <div style={{ background: 'linear-gradient(135deg, #0F2B6E 0%, #1E4DD9 100%)', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center' }}>
          <span style={{ color: '#fff', fontWeight: 900, fontSize: 18 }}>{tr('savedListings', selectedLanguage)}</span>
        </div>
        <div style={{ padding: '16px 16px 80px' }}>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24, textAlign: 'center' }}>
            <Bookmark size={40} color="#9ca3af" />
            <p style={{ fontWeight: 900, margin: '10px 0 6px', color: '#0f172a' }}>{tr('signInToViewSaved', selectedLanguage)}</p>
            <p style={{ margin: 0, color: '#6B7A99', fontSize: 13 }}>{tr('savedSyncedDesc', selectedLanguage)}</p>
            <button onClick={() => router.push('/login')} style={{ marginTop: 16, padding: '12px 24px', background: '#2E5BFF', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 900, cursor: 'pointer' }}>{tr('signIn', selectedLanguage)}</button>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div dir={getDir(selectedLanguage)} className="app-shell" style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0F2B6E 0%, #1E4DD9 100%)', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', position: 'sticky', top: 0, zIndex: 40 }}>
        <span style={{ color: '#fff', fontWeight: 900, fontSize: 18 }}>{tr('savedListings', selectedLanguage)}</span>
      </div>

      <div style={{ padding: '12px 16px', paddingBottom: 80 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#6B7A99' }}>{tr('loading', selectedLanguage)}</div>
        ) : savedListings.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, textAlign: 'center', border: '1px solid #e2e8f0' }}>
            <Bookmark size={40} color="#9ca3af" />
            <p style={{ fontWeight: 900, margin: '10px 0 6px', color: '#0f172a' }}>{tr('noSavedItems', selectedLanguage)}</p>
            <p style={{ margin: '0 0 16px', color: '#6B7A99', fontSize: 13 }}>{tr('tapBookmarkDesc', selectedLanguage)}</p>
            <button onClick={() => router.push('/home')} style={{ padding: '12px 24px', background: '#2E5BFF', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 900, cursor: 'pointer' }}>{tr('browseListings', selectedLanguage)}</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {savedListings.map((l) => {
              const price = displayPrice(l);
              const img = l.imageUrls?.[0] ?? l.imageUrl;
              const subtitle = [price, l.locationText?.trim() || null].filter(Boolean).join(' • ') || '—';

              return (
                <div key={l.id} onClick={() => router.push(`/listing/${l.id}`)} style={{ background: '#fff', borderRadius: 12, padding: 12, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                  {/* Image */}
                  <div style={{ width: 56, height: 56, borderRadius: 12, overflow: 'hidden', flexShrink: 0, backgroundColor: '#f2f5f9', position: 'relative' }}>
                    {img ? (
                      <Image src={img} alt={l.title} fill style={{ objectFit: 'cover' }} sizes="56px" />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>📦</div>
                    )}
                    <span style={{ position: 'absolute', top: 3, right: 3, zIndex: 2 }}>
                      <OpenStatusChip ownerUid={l.ownerUid} country={l.country} size="xs" variant="solid" />
                    </span>
                  </div>

                  {/* Text */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: '0 0 3px', fontWeight: 900, fontSize: 14, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title}</p>
                    <p style={{ margin: 0, fontSize: 12.5, color: '#6B7A99', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</p>
                    {distanceById.get(l.id) != null && (
                      <div style={{ marginTop: 4 }}><DistanceChip km={distanceById.get(l.id)} size="xs" /></div>
                    )}
                    {(() => {
                      // ADDITIVE price-drop badge: prefer a recorded event, else
                      // fall back to the listing's own original/current price pair.
                      const ev = priceDrops[l.id];
                      const oldVal = ev?.oldPrice ?? l.originalPriceValue ?? null;
                      const newVal = ev?.newPrice ?? l.priceValue ?? null;
                      const cur = ev?.currency ?? l.currencyCode;
                      if (oldVal == null || newVal == null || oldVal <= newVal) return null;
                      const percent = ev?.percent && ev.percent > 0
                        ? ev.percent
                        : Math.round(((oldVal - newVal) / oldVal) * 100);
                      if (percent <= 0) return null;
                      return (
                        <div style={{
                          marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '5px 10px', borderRadius: 999,
                          background: 'linear-gradient(135deg, #FF3D71 0%, #E5346B 100%)',
                          boxShadow: '0 3px 8px rgba(229,52,107,0.28)',
                        }}>
                          <span style={{ color: '#fff', fontWeight: 900, fontSize: 11.5 }}>🎉 {tr('priceDropped', selectedLanguage)}</span>
                          <span style={{ color: '#fff', fontWeight: 600, fontSize: 11, textDecoration: 'line-through' }}>{fmtPrice(oldVal, cur)}</span>
                          <span style={{ color: '#fff', fontWeight: 900, fontSize: 12 }}>{fmtPrice(newVal, cur)}</span>
                          <span style={{ background: '#fff', color: '#E5346B', fontWeight: 900, fontSize: 11, borderRadius: 6, padding: '2px 6px' }}>-{percent}%</span>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Remove button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSaved(l.id); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, flexShrink: 0, color: '#2E5BFF', display: 'flex' }}
                  >
                    <BookmarkCheck size={22} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
