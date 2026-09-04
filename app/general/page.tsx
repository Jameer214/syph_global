'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, Search, X, SlidersHorizontal, MapPin, Star } from 'lucide-react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store';
import { formatConverted, getCurrencySymbol } from '@/lib/currency';
import { isPast, isEventExpired } from '@/lib/promo';
import { tr, getDir } from '@/lib/i18n';
import BottomNav from '@/components/BottomNav';
import DistanceChip from '@/components/DistanceChip';
import OpenStatusChip from '@/components/OpenStatusChip';
import { useDistances } from '@/lib/useDistances';
import { useVerifiedSellers } from '@/lib/useVerifiedSellers';
import VerifiedTick from '@/components/VerifiedTick';
import ShopSuggestions from '@/components/ShopSuggestions';
import PropertyCard, { isPropertyListing } from '@/components/PropertyCard';
import { getCategoryById } from '@/data/categories';
import { searchSellers, type ShopHit } from '@/lib/firestore';
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
    openNow: Boolean(row.open_now),
    isSponsored: Boolean(row.is_sponsored) && !isPast(row.sponsored_until),
    isHappening: Boolean(row.is_happening) && !isEventExpired(row.event_date),
    isFlashSale: Boolean(row.is_flash_sale) && !isPast(row.flash_sale_until),
    isTrial: Boolean(row.is_trial),
    status: String(row.status ?? 'pending'),
    viewsCount: typeof row.view_count === 'number' ? row.view_count : 0,
    savesCount: typeof row.save_count === 'number' ? row.save_count : 0,
    messagesCount: 0,
    rating: typeof row.rating === 'number' ? row.rating : undefined,
    createdAt: row.created_at ? String(row.created_at) : undefined,
  };
}

type SortMode = 'random' | 'newest' | 'price_asc' | 'price_desc' | 'rating';

export default function GeneralPage() {
  const router = useRouter();
  const { selectedCountry, selectedCurrency, selectedLanguage } = useAppStore();

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
  const [listings, setListings] = useState<Listing[]>([]);
  const distanceById = useDistances(listings);
  const verifiedSellers = useVerifiedSellers(listings);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Matching seller shops for the same query — shown above the grid so buyers
  // can open a storefront directly. Additive to the listing search.
  const [shopResults, setShopResults] = useState<ShopHit[]>([]);
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) { setShopResults([]); return; }
    const t = setTimeout(() => {
      // General browses all countries — no country scoping.
      searchSellers(q).then(setShopResults);
    }, 350);
    return () => clearTimeout(t);
  }, [searchQuery]);
  const [sort, setSort] = useState<SortMode>('random');
  const [showSortMenu, setShowSortMenu] = useState(false);
  // Selected property subcategory chip (null = "All"). Only Real Estate /
  // Accommodation listings carry these; the chip row derives from what's present.
  const [selectedSub, setSelectedSub] = useState<string | null>(null);
  const offsetRef = useRef<number>(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE = 20;

  const loadListings = useCallback(async (reset: boolean) => {
    if (reset) setLoading(true); else setLoadingMore(true);
    try {
      // Default = a whole-catalog random draw across ALL countries via the
      // random_listings RPC (order by random()). The RPC returns base rows
      // only, so a second query attaches listing_images. It's a single shuffled
      // batch (no offset pagination — paging a reshuffling feed isn't coherent).
      if (sort === 'random') {
        const { data: baseRows } = await supabase.rpc('random_listings', { max_results: 60 });
        const ids: string[] = (baseRows ?? []).map((r: Record<string, unknown>) => String(r.id));
        let items: Listing[] = [];
        if (ids.length > 0) {
          const { data: withImgs } = await supabase.from('listings')
            .select('*, listing_images(url, sort_order)')
            .in('id', ids);
          const byId = new Map(
            (withImgs ?? []).map((r) => [String((r as Record<string, unknown>).id), r] as const),
          );
          items = ids
            .map((id: string) => byId.get(id))
            .filter((row): row is Record<string, unknown> => Boolean(row))
            .map((row) => mapListing(row));
        }
        offsetRef.current = items.length;
        setHasMore(false);
        setListings(items);
        return;
      }

      const orderField = sort === 'rating' ? 'rating' : sort === 'price_asc' || sort === 'price_desc' ? 'price' : 'created_at';
      const ascending = sort === 'price_asc';
      const offset = reset ? 0 : offsetRef.current;

      // General browses ALL countries — no country filter (intentionally).
      const q = supabase.from('listings')
        .select('*, listing_images(url, sort_order)')
        .eq('status', 'active')
        .order(orderField, { ascending })
        .range(offset, offset + PAGE - 1);

      const { data } = await q;
      const newItems = (data ?? []).map((row) => mapListing(row as Record<string, unknown>));
      offsetRef.current = reset ? newItems.length : offsetRef.current + newItems.length;
      setHasMore(newItems.length === PAGE);
      setListings((prev) => reset ? newItems : [...prev, ...newItems]);
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [sort]);

  useEffect(() => {
    offsetRef.current = 0;
    loadListings(true);
  }, [loadListings]);

  const filtered = searchQuery.trim()
    ? listings.filter((l) =>
        l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.sellerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.locationText.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : listings;

  // Property subcategory chips, derived from the Real Estate / Accommodation
  // listings actually in the results (canonical category order). Tapping one
  // narrows the grid to that subcategory; the leading "All" chip clears it.
  const propertySubs: { id: string; title: string }[] = [];
  {
    const present = new Set<string>();
    for (const l of filtered) {
      if (isPropertyListing(l) && l.subCategoryId) present.add(l.subCategoryId);
    }
    if (present.size > 0) {
      for (const mainId of ['real_estate', 'accommodation']) {
        getCategoryById(mainId)?.children?.forEach((s) => {
          if (present.has(s.id)) propertySubs.push({ id: s.id, title: s.title });
        });
      }
    }
  }
  const activeSub = propertySubs.some((c) => c.id === selectedSub) ? selectedSub : null;
  const displayed = activeSub
    ? filtered.filter((l) => l.subCategoryId === activeSub)
    : filtered;

  const sortLabels: Record<SortMode, string> = {
    random: tr('sortRandom', selectedLanguage),
    newest: tr('newest', selectedLanguage),
    price_asc: tr('priceLowHigh', selectedLanguage),
    price_desc: tr('priceHighLow', selectedLanguage),
    rating: tr('topRated', selectedLanguage),
  };

  return (
    <div dir={getDir(selectedLanguage)} className="wide-page" style={{ minHeight: '100dvh', background: '#F0F4FF' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div className="wide-container" style={{
        background: 'linear-gradient(135deg, #0F2B6E 0%, #1E4DD9 60%, #2E5BFF 100%)',
        padding: '52px 20px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Globe size={22} color="#fff" />
          <span style={{ color: '#fff', fontWeight: 900, fontSize: 22 }}>{tr('listings', selectedLanguage)}</span>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
          All approved listings · all countries
        </div>

        {/* Search bar */}
        <div style={{ position: 'relative' }}>
          <Search size={16} color="#6B7A99" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={tr('searchHint', selectedLanguage)}
            style={{
              width: '100%', padding: '11px 40px 11px 40px', background: '#fff',
              border: 'none', borderRadius: 14, fontSize: 14, outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
              <X size={16} color="#6B7A99" />
            </button>
          )}
        </div>
      </div>

      {/* Sort bar */}
      <div className="wide-container" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, background: '#F0F4FF', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
        <SlidersHorizontal size={16} color="#6B7A99" />
        <span style={{ color: '#6B7A99', fontSize: 13, fontWeight: 600, marginRight: 4 }}>{tr('filters', selectedLanguage)}:</span>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowSortMenu(!showSortMenu)} style={{
            background: '#fff', border: '1px solid #E0E8F0', borderRadius: 20,
            padding: '5px 14px', fontSize: 13, fontWeight: 700, color: '#2E5BFF',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
          }}>
            {sortLabels[sort]} ▾
          </button>
          {showSortMenu && (
            <div style={{
              position: 'absolute', top: '110%', left: 0, background: '#fff', borderRadius: 14,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 50, minWidth: 180,
              border: '1px solid #E0E8F0', overflow: 'hidden',
            }}>
              {(Object.keys(sortLabels) as SortMode[]).map((s) => (
                <button key={s} onClick={() => { setSort(s); setShowSortMenu(false); }} style={{
                  width: '100%', textAlign: 'left', padding: '11px 16px',
                  background: sort === s ? '#F0F4FF' : '#fff', border: 'none',
                  color: sort === s ? '#2E5BFF' : '#1E2B45', fontWeight: sort === s ? 800 : 600,
                  fontSize: 14, cursor: 'pointer',
                }}>
                  {sortLabels[s]}
                </button>
              ))}
            </div>
          )}
        </div>
        <span style={{ marginLeft: 'auto', color: '#6B7A99', fontSize: 12, fontWeight: 600 }}>
          {displayed.length} listings
        </span>
      </div>

      {/* Listings grid */}
      <div className="wide-container" style={{ padding: '16px 16px 90px' }}>
        {searchQuery.trim() !== '' && shopResults.length > 0 && (
          <div style={{
            background: '#fff', borderRadius: 14, border: '1px solid #eef2f7',
            overflow: 'hidden', marginBottom: 16,
          }}>
            <ShopSuggestions
              shops={shopResults}
              label={tr('shopsSectionLabel', selectedLanguage)}
            />
          </div>
        )}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
            <div style={{ width: 36, height: 36, border: '3px solid #E8EDFF', borderTop: '3px solid #2E5BFF', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', background: '#fff', borderRadius: 22, padding: 28, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <Globe size={42} color="#6B7A99" />
            <div style={{ fontWeight: 900, fontSize: 16, marginTop: 12, color: '#1E2B45' }}>
              {searchQuery ? tr('noResults', selectedLanguage) : tr('noListingsYet', selectedLanguage)}
            </div>
            <div style={{ color: '#6B7A99', fontSize: 13, marginTop: 6 }}>
              {searchQuery ? tr('noListingsMatchSearch', selectedLanguage) : tr('listingsWillAppearApproved', selectedLanguage)}
            </div>
          </div>
        )}

        {!loading && propertySubs.length > 0 && (
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12, marginBottom: 4 }}>
            {[{ id: null as string | null, title: 'All' }, ...propertySubs].map((c) => {
              const on = activeSub === c.id;
              return (
                <button key={c.id ?? 'all'} onClick={() => setSelectedSub(c.id)}
                  style={{
                    flexShrink: 0, padding: '8px 16px', borderRadius: 999, cursor: 'pointer',
                    fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap',
                    background: on ? '#2E5BFF' : '#fff',
                    color: on ? '#fff' : '#1E2B45',
                    border: `1px solid ${on ? '#2E5BFF' : '#E0E8F0'}`,
                  }}>
                  {c.title}
                </button>
              );
            })}
          </div>
        )}

        {!loading && (
          <div className="explore-grid">
            {displayed.map((item) => (
              isPropertyListing(item) ? (
                <PropertyCard
                  key={item.id}
                  listing={item}
                  km={distanceById.get(item.id)}
                  verified={verifiedSellers.has(item.ownerUid)}
                />
              ) : (
              <div key={item.id} onClick={() => router.push(`/listing/${item.id}`)}
                style={{
                  background: '#fff', borderRadius: 16, overflow: 'hidden', cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                }}>
                <div style={{ position: 'relative', width: '100%', paddingBottom: '75%', background: '#f0f4f8' }}>
                  {item.imageUrl ? (
                    <Image src={item.imageUrl} alt={item.title} fill style={{ objectFit: 'cover' }} sizes="240px" />
                  ) : (
                    <div style={{ position: 'absolute', inset: 0, background: '#E8EDFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Globe size={28} color="#6B7A99" />
                    </div>
                  )}
                  {item.isSponsored && (
                    <span style={{ position: 'absolute', top: 6, left: 6, background: '#FF8C00', color: '#fff', fontSize: 8, fontWeight: 900, borderRadius: 10, padding: '2px 7px', letterSpacing: 0.3 }}>{tr('featured', selectedLanguage).toUpperCase()}</span>
                  )}
                  <span style={{ position: 'absolute', top: 6, right: 6, zIndex: 2 }}>
                    <OpenStatusChip ownerUid={item.ownerUid} country={item.country} size="xs" variant="solid" />
                  </span>
                </div>
                <div style={{ padding: '8px 10px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ flex: 1, minWidth: 0, fontWeight: 800, fontSize: 12.5, color: '#1E2B45', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                    {verifiedSellers.has(item.ownerUid) && <VerifiedTick size={14} />}
                  </div>
                  <div style={{ color: '#2E5BFF', fontWeight: 900, fontSize: 13, marginTop: 2 }}>{displayPrice(item)}</div>
                  {item.locationText && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#6B7A99', fontSize: 10, marginTop: 3 }}>
                      <MapPin size={10} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.locationText}</span>
                    </div>
                  )}
                  {distanceById.get(item.id) != null && (
                    <div style={{ marginTop: 4 }}><DistanceChip km={distanceById.get(item.id)} size="xs" /></div>
                  )}
                  {item.rating != null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 4 }}>
                      <Star size={10} color="#FFB800" fill="#FFB800" />
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#4A5878' }}>{item.rating.toFixed(1)}</span>
                    </div>
                  )}
                </div>
              </div>
              )
            ))}
          </div>
        )}

        {/* Load more */}
        {!loading && hasMore && !searchQuery && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
            {loadingMore ? (
              <div style={{ width: 28, height: 28, border: '3px solid #E8EDFF', borderTop: '3px solid #2E5BFF', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            ) : (
              <button onClick={() => loadListings(false)} style={{
                background: '#fff', border: '1.5px solid #2E5BFF', color: '#2E5BFF',
                borderRadius: 20, padding: '10px 28px', fontWeight: 800, cursor: 'pointer', fontSize: 14,
              }}>
                {tr('loadMore', selectedLanguage)}
              </button>
            )}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
