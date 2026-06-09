'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { useAppStore } from '@/store';
import { tr, getDir } from '@/lib/i18n';
import { formatConverted, getCurrencySymbol } from '@/lib/currency';
import { getListing, getSavedIds, syncSavedIds } from '@/lib/firestore';
import BottomNav from '@/components/BottomNav';
import type { Listing } from '@/types';

export default function SavedPage() {
  const router = useRouter();
  const { user, savedIds, toggleSaved, isSaved, selectedCurrency, selectedLanguage } = useAppStore();

  function displayPrice(listing: Listing): string | null {
    if (listing.priceText?.trim()) return listing.priceText.trim();
    if (listing.priceValue != null) {
      if (selectedCurrency && selectedCurrency !== listing.currencyCode) {
        return `≈ ${formatConverted(listing.priceValue, listing.currencyCode, selectedCurrency)}`;
      }
      return `${getCurrencySymbol(listing.currencyCode)}${listing.priceValue.toLocaleString()}`;
    }
    return null;
  }
  const fireUser = auth.currentUser;
  const uid = user?.uid ?? fireUser?.uid ?? '';

  const [savedListings, setSavedListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

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
    Promise.all(savedIds.map((id) => getListing(id)))
      .then((results) => {
        setSavedListings(results.filter((l): l is Listing => l !== null));
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
            <p style={{ margin: 0, color: '#6B7A99', fontSize: 13 }}>Your saved listings will be synced across devices when you sign in.</p>
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
            <p style={{ margin: '0 0 16px', color: '#6B7A99', fontSize: 13 }}>Tap the bookmark icon on any listing to save it here.</p>
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
                  </div>

                  {/* Text */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: '0 0 4px', fontWeight: 900, fontSize: 14, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title}</p>
                    <p style={{ margin: 0, fontSize: 12.5, color: '#6B7A99', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</p>
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
