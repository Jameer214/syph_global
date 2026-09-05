'use client';
import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, SlidersHorizontal, ArrowUpDown, X, Clock, Navigation } from 'lucide-react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store';
import { tr, getDir, trCategory } from '@/lib/i18n';
import { formatConverted, formatPrice } from '@/lib/currency';
import { isPast } from '@/lib/promo';
import { getCategoryById } from '@/data/categories';
import DistanceChip from '@/components/DistanceChip';
import OpenStatusChip from '@/components/OpenStatusChip';
import { useDistances } from '@/lib/useDistances';
import { useVerifiedSellers } from '@/lib/useVerifiedSellers';
import VerifiedTick from '@/components/VerifiedTick';
import PropertyCard, { isPropertyListing } from '@/components/PropertyCard';
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
    subCategoryId: row.sub_category_id ? String(row.sub_category_id) : undefined,
    openNow: false,
    isSponsored: Boolean(row.is_sponsored) && !isPast(row.sponsored_until),
    isHappening: Boolean(row.is_happening),
    isFlashSale: Boolean(row.is_flash_sale) && !isPast(row.flash_sale_until),
    isTrial: false,
    status: String(row.status ?? 'pending'),
    viewsCount: typeof row.view_count === 'number' ? row.view_count : 0,
    savesCount: typeof row.save_count === 'number' ? row.save_count : 0,
    messagesCount: 0,
    rating: typeof row.rating === 'number' ? row.rating : undefined,
    condition: row.condition ? String(row.condition) : undefined,
    createdAt: row.created_at ? String(row.created_at) : undefined,
    flashSaleEndsAt: row.flash_sale_until ? String(row.flash_sale_until) : undefined,
  };
}

type SortBy = 'recommended' | 'priceLowHigh' | 'priceHighLow' | 'ratingHighLow';

export default function SubCategoryResultsPage() {
  const params = useParams();
  const router = useRouter();
  const mainId = params.id as string;
  const subId = params.subId as string;
  // Slice selectors instead of useAppStore() (the whole store), which
  // re-rendered this entire results grid on ANY store write. We subscribe to the
  // savedIds ARRAY (ref changes on save toggle → bookmarks update) rather than
  // the isSaved() function (stable ref → would never re-render on toggle).
  const savedIds = useAppStore((s) => s.savedIds);
  const toggleSaved = useAppStore((s) => s.toggleSaved);
  const selectedCurrency = useAppStore((s) => s.selectedCurrency);
  const selectedLanguage = useAppStore((s) => s.selectedLanguage);

  function displayPrice(listing: Listing): string {
    if (listing.priceValue != null && selectedCurrency && selectedCurrency !== listing.currencyCode) {
      return `≈ ${formatConverted(listing.priceValue, listing.currencyCode, selectedCurrency)}`;
    }
    if (listing.priceText?.trim()) return listing.priceText.trim();
    if (listing.priceValue != null) {
      return formatPrice(listing.priceValue, listing.currencyCode);
    }
    return 'Price not set';
  }

  const PAGE_SIZE = 24;
  const [listings, setListings] = useState<Listing[]>([]);
  const distanceById = useDistances(listings);
  const verifiedSellers = useVerifiedSellers(listings);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [openNow, setOpenNow] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>('recommended');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [ratingFilter, setRatingFilter] = useState('Any');
  const [conditionFilter, setConditionFilter] = useState('');
  const [showSortSheet, setShowSortSheet] = useState(false);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [tempMinPrice, setTempMinPrice] = useState('');
  const [tempMaxPrice, setTempMaxPrice] = useState('');
  const [tempRating, setTempRating] = useState('Any');
  const [tempOpenNow, setTempOpenNow] = useState(false);
  const [tempCondition, setTempCondition] = useState('');

  const mainCat = getCategoryById(mainId);
  const subCat = mainCat?.children.find((c) => c.id === subId);
  const title = subCat?.title ?? (mainCat ? trCategory(mainCat.id, mainCat.title, selectedLanguage) : tr('resultsWord', selectedLanguage));

  // Keyset-paginated (created_at cursor) — an unbounded query here would
  // download the entire subcategory as inventory grows.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data } = await supabase.from('listings')
        .select('*, listing_images(url, sort_order)')
        .eq('status', 'active')
        .eq('category_id', mainId)
        .eq('sub_category_id', subId)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);
      if (!cancelled) {
        const page = (data ?? []).map((row) => mapListing(row as Record<string, unknown>));
        setListings(page);
        setHasMore(page.length === PAGE_SIZE);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [mainId, subId]);

  const loadMore = async () => {
    if (loadingMore || !hasMore || listings.length === 0) return;
    setLoadingMore(true);
    try {
      const cursor = listings[listings.length - 1].createdAt;
      let q = supabase.from('listings')
        .select('*, listing_images(url, sort_order)')
        .eq('status', 'active')
        .eq('category_id', mainId)
        .eq('sub_category_id', subId)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);
      if (cursor) q = q.lt('created_at', cursor);
      const { data } = await q;
      const page = (data ?? []).map((row) => mapListing(row as Record<string, unknown>));
      setListings((prev) => {
        const seen = new Set(prev.map((l) => l.id));
        return [...prev, ...page.filter((l) => !seen.has(l.id))];
      });
      setHasMore(page.length === PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  };

  function applyFiltersAndSort(all: Listing[]): Listing[] {
    const minR = ratingFilter === '4+' ? 4 : ratingFilter === '3+' ? 3 : ratingFilter === '2+' ? 2 : 0;
    let filtered = all.filter((l) => {
      if (minR > 0 && (l.rating ?? 0) < minR) return false;
      if (minPrice && (l.priceValue ?? -1) < parseFloat(minPrice)) return false;
      if (maxPrice && (l.priceValue ?? Infinity) > parseFloat(maxPrice)) return false;
      if (conditionFilter && (l.condition ?? '').toLowerCase() !== conditionFilter.toLowerCase()) return false;
      if (openNow && !l.openNow) return false;
      return true;
    });
    filtered.sort((a, b) => {
      if (a.isSponsored !== b.isSponsored) return a.isSponsored ? -1 : 1;
      switch (sortBy) {
        case 'priceLowHigh': return (a.priceValue ?? Infinity) - (b.priceValue ?? Infinity);
        case 'priceHighLow': return (b.priceValue ?? -1) - (a.priceValue ?? -1);
        case 'ratingHighLow': return (b.rating ?? -1) - (a.rating ?? -1);
        default: return (b.viewsCount + b.savesCount + b.messagesCount) - (a.viewsCount + a.savesCount + a.messagesCount);
      }
    });
    return filtered;
  }

  // Memoised: the filter+sort of the whole (potentially hundreds of) listings
  // was running on EVERY render. Now it recomputes only when listings or a
  // filter/sort input actually changes. (Parity with the parent category page.)
  const filtered = useMemo(
    () => applyFiltersAndSort(listings),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [listings, ratingFilter, minPrice, maxPrice, conditionFilter, openNow, sortBy],
  );

  // Count of active filters shown as a badge on the filter button (parity with mobile).
  const filterCount = [openNow, ratingFilter !== 'Any', Boolean(minPrice || maxPrice), Boolean(conditionFilter)].filter(Boolean).length;

  return (
    <div className="app-shell wide-page" dir={getDir(selectedLanguage)} style={{ minHeight: '100vh', backgroundColor: '#D6ECFF' }}>
      <div className="wide-container" style={{ background: 'linear-gradient(135deg, #0F2B6E 0%, #1E4DD9 100%)', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 40 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', padding: 4 }}><ArrowLeft size={22} /></button>
        <span style={{ color: '#fff', fontWeight: 900, fontSize: 17, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
        <button onClick={() => setShowSortSheet(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', padding: 4 }}><ArrowUpDown size={20} /></button>
        <button onClick={() => { setTempMinPrice(minPrice); setTempMaxPrice(maxPrice); setTempRating(ratingFilter); setTempOpenNow(openNow); setTempCondition(conditionFilter); setShowFilterSheet(true); }} style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', padding: 4 }}><SlidersHorizontal size={20} />{filterCount > 0 && (<span style={{ position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, padding: '0 3px', boxSizing: 'border-box', background: '#E53935', color: '#fff', borderRadius: 999, fontSize: 10, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>{filterCount}</span>)}</button>
      </div>

      <div className="wide-container" style={{ padding: '12px 16px 16px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button onClick={() => setOpenNow((v) => !v)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 12px', borderRadius: 20, background: openNow ? '#2E5BFF' : '#fff', border: `1px solid ${openNow ? '#2E5BFF' : '#e2e8f0'}`, color: openNow ? '#fff' : '#0F2B6E', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
            <Clock size={14} /> {tr('openNow', selectedLanguage)}
          </button>
          <button onClick={() => { toast(tr('locationSortingComingSoon', selectedLanguage)); }} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 12px', borderRadius: 20, background: '#fff', border: '1px solid #e2e8f0', color: '#0F2B6E', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
            <Navigation size={14} /> {tr('featNearMeTitle', selectedLanguage)}
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="anim-fade-up" style={{ background: '#fff', borderRadius: 12, padding: 10, display: 'flex', gap: 12, animationDelay: `${i * 0.08}s` }}>
                <div className="skeleton" style={{ width: 72, height: 72, borderRadius: 10, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton" style={{ height: 14, borderRadius: 6, width: '70%' }} />
                  <div className="skeleton" style={{ height: 13, borderRadius: 6, width: '40%', marginTop: 8 }} />
                  <div className="skeleton" style={{ height: 12, borderRadius: 6, width: '55%', marginTop: 8 }} />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, textAlign: 'center', color: '#6B7A99' }}>
            <div style={{ fontSize: 40 }}>🔍</div>
            <p style={{ fontWeight: 900, margin: '10px 0 6px', color: '#0f172a' }}>{tr('noResults', selectedLanguage)}</p>
            <p style={{ margin: 0, fontSize: 13 }}>{tr('tryChangingFilters', selectedLanguage)}</p>
          </div>
        ) : (
          <>
          <div className="card-grid">
            {filtered.map((l, i) => {
              const img = l.imageUrls?.[0] ?? l.imageUrl;
              const price = displayPrice(l);
              // Real Estate & Accommodation → premium full-width property card.
              if (isPropertyListing(l)) {
                return (
                  <PropertyCard
                    key={l.id}
                    listing={l}
                    km={distanceById.get(l.id)}
                    verified={verifiedSellers.has(l.ownerUid)}
                  />
                );
              }
              return (
                <div key={l.id} onClick={() => router.push(`/listing/${l.id}`)} className="card-tap anim-fade-up card-zoom" style={{ background: '#fff', borderRadius: 12, padding: 10, display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', animationDelay: `${Math.min(i, 8) * 0.05}s`, animationDuration: '0.35s' }}>
                  <div className="card-media" style={{ width: 72, height: 72, borderRadius: 10, overflow: 'hidden', flexShrink: 0, backgroundColor: '#f2f5f9', position: 'relative' }}>
                    {img ? <Image src={img} alt={l.title} fill style={{ objectFit: 'cover' }} sizes="72px" /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>📦</div>}
                    <span style={{ position: 'absolute', top: 4, right: 4, zIndex: 2 }}>
                      <OpenStatusChip ownerUid={l.ownerUid} country={l.country} size="xs" variant="solid" />
                    </span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                      <p style={{ margin: 0, fontWeight: 900, fontSize: 14, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#0f172a' }}>{l.title}</p>
                      {verifiedSellers.has(l.ownerUid) && <span style={{ flexShrink: 0, marginTop: 1 }}><VerifiedTick size={15} /></span>}
                      {l.isSponsored && <span style={{ background: '#2E5BFF', color: '#fff', borderRadius: 999, padding: '3px 7px', fontSize: 10, fontWeight: 900, flexShrink: 0 }}>{tr('adBadge', selectedLanguage)}</span>}
                    </div>
                    <p style={{ margin: '3px 0', fontWeight: 800, color: '#2E5BFF', fontSize: 13, lineHeight: 1.25 }}>{price}</p>
                    <p style={{ margin: '0 0 4px', fontSize: 12, color: '#6B7A99', fontWeight: 700, lineHeight: 1.25 }}>{l.regionOrCity}, {l.country}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                      {distanceById.get(l.id) != null && <DistanceChip km={distanceById.get(l.id)} size="xs" />}
                      {l.rating != null && <span style={{ background: '#FFF8E1', color: '#B8860B', borderRadius: 999, padding: '4px 8px', fontSize: 11, fontWeight: 800 }}>★ {l.rating.toFixed(1)}</span>}
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); toggleSaved(l.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: savedIds.includes(l.id) ? '#2E5BFF' : '#9ca3af', flexShrink: 0, fontSize: 20 }}>
                    {savedIds.includes(l.id) ? '🔖' : '🔖'}
                  </button>
                </div>
              );
            })}
          </div>
          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="btn-tap"
              style={{
                width: '100%', height: 46, borderRadius: 14, marginTop: 12,
                background: '#fff', border: '1.5px solid #e2e8f0',
                color: '#2E5BFF', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                opacity: loadingMore ? 0.6 : 1,
              }}
            >
              {loadingMore ? tr('loading', selectedLanguage) : tr('loadMore', selectedLanguage)}
            </button>
          )}
          </>
        )}
      </div>

      {showSortSheet && (
        <>
          <div onClick={() => setShowSortSheet(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100 }} />
          <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: '#fff', borderRadius: '22px 22px 0 0', padding: '20px 20px 32px', zIndex: 101 }}>
            <div style={{ width: 36, height: 4, background: '#e2e8f0', borderRadius: 2, margin: '0 auto 16px' }} />
            <p style={{ fontWeight: 900, fontSize: 16, margin: '0 0 10px' }}>{tr('sortBy', selectedLanguage)}</p>
            {(['recommended', 'priceLowHigh', 'priceHighLow', 'ratingHighLow'] as SortBy[]).map((val) => {
              const labels: Record<SortBy, string> = { recommended: tr('recommended', selectedLanguage), priceLowHigh: tr('priceLowHigh', selectedLanguage), priceHighLow: tr('priceHighLow', selectedLanguage), ratingHighLow: tr('ratingHighLow', selectedLanguage) };
              return (
                <button key={val} onClick={() => { setSortBy(val); setShowSortSheet(false); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', background: 'none', border: 'none', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: 15, fontWeight: 700, color: sortBy === val ? '#2E5BFF' : '#0f172a' }}>
                  <span style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${sortBy === val ? '#2E5BFF' : '#cbd5e1'}`, background: sortBy === val ? '#2E5BFF' : 'transparent', display: 'inline-flex', flexShrink: 0 }} />
                  {labels[val]}
                </button>
              );
            })}
          </div>
        </>
      )}

      {showFilterSheet && (
        <>
          <div onClick={() => setShowFilterSheet(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100 }} />
          <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: '#fff', borderRadius: '22px 22px 0 0', padding: '20px 20px 32px', zIndex: 101, maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ width: 36, height: 4, background: '#e2e8f0', borderRadius: 2, margin: '0 auto 16px' }} />
            <p style={{ fontWeight: 900, fontSize: 16, margin: '0 0 16px', textAlign: 'center' }}>{tr('filters', selectedLanguage)}</p>
            <p style={{ fontWeight: 800, fontSize: 13, color: '#6B7A99', margin: '0 0 8px' }}>{tr('priceRange', selectedLanguage)}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <input value={tempMinPrice} onChange={(e) => setTempMinPrice(e.target.value)} type="number" placeholder={tr('minLabel', selectedLanguage)} style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 14 }} />
              <span style={{ fontWeight: 900, fontSize: 18 }}>–</span>
              <input value={tempMaxPrice} onChange={(e) => setTempMaxPrice(e.target.value)} type="number" placeholder={tr('maxLabel', selectedLanguage)} style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 14 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontWeight: 800, fontSize: 13, color: '#6B7A99' }}>{tr('ratingFilter', selectedLanguage)}</span>
              <select value={tempRating} onChange={(e) => setTempRating(e.target.value)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, fontWeight: 700 }}>
                <option value="Any">{tr('any', selectedLanguage)}</option><option value="2+">2+</option><option value="3+">3+</option><option value="4+">4+</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f1f5f9', marginBottom: 16 }}>
              <p style={{ margin: 0, fontWeight: 900, fontSize: 14 }}>{tr('openNow', selectedLanguage)}</p>
              <button onClick={() => setTempOpenNow((v) => !v)} style={{ width: 48, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer', background: tempOpenNow ? '#2E5BFF' : '#e2e8f0', position: 'relative' }}>
                <span style={{ position: 'absolute', top: 3, left: tempOpenNow ? 23 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
              </button>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setTempMinPrice(''); setTempMaxPrice(''); setTempRating('Any'); setTempOpenNow(false); setTempCondition(''); }} style={{ padding: '14px 20px', borderRadius: 14, border: '1.5px solid #e2e8f0', background: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>{tr('resetLabel', selectedLanguage)}</button>
              <button onClick={() => { setMinPrice(tempMinPrice); setMaxPrice(tempMaxPrice); setRatingFilter(tempRating); setOpenNow(tempOpenNow); setConditionFilter(tempCondition); setShowFilterSheet(false); }} style={{ flex: 1, padding: '14px 20px', borderRadius: 14, background: '#2E5BFF', color: '#fff', fontWeight: 900, fontSize: 15, border: 'none', cursor: 'pointer' }}>{tr('done', selectedLanguage)}</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
