'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Search, SlidersHorizontal, MapPin, Zap, TrendingUp,
  Star, Crown, Globe, Eye, Bookmark, MessageCircle, Menu,
  LayoutGrid, X, ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { sanitizeText } from '@/lib/sanitize';
import { useAppStore } from '@/store';
import { supabase } from '@/lib/supabase';
import { formatConverted, getCurrencySymbol } from '@/lib/currency';
import { tr, getDir } from '@/lib/i18n';
import { COUNTRY_FLAGS } from '@/data/countries';
import BottomNav from '@/components/BottomNav';
import MenuDrawer from '@/components/MenuDrawer';
import type { Listing } from '@/types';

// ─── helpers ──────────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function mapListing(data: Record<string, unknown>, id: string): Listing {
  const imgs = Array.isArray(data.listing_images) ? (data.listing_images as { url: string; sort_order?: number }[]) : [];
  const sorted = [...imgs].sort((a, b) => ((a.sort_order ?? 0) - (b.sort_order ?? 0)));
  const status = String(data.status ?? 'pending');
  const sellersRow = data.sellers as { business_latitude?: number; business_longitude?: number } | null;
  return {
    id,
    title: String(data.title ?? ''),
    description: String(data.description ?? ''),
    imageUrl: sorted[0]?.url ?? String(data.image_url ?? ''),
    imageUrls: sorted.length > 1 ? sorted.map(i => i.url) : undefined,
    sellerName: String(data.seller_name ?? ''),
    ownerUid: String(data.seller_id ?? ''),
    country: String(data.country ?? ''),
    regionOrCity: String(data.region ?? ''),
    locationText: String(data.location_text ?? ''),
    priceText: data.price_text ? String(data.price_text) : undefined,
    priceValue: typeof data.price === 'number' ? data.price : undefined,
    currencyCode: String(data.currency ?? 'USD'),
    negotiable: Boolean(data.is_negotiable),
    mainCategoryId: String(data.category_id ?? ''),
    subCategoryId: data.sub_category_id ? String(data.sub_category_id) : undefined,
    openNow: Boolean(data.open_now),
    isSponsored: Boolean(data.is_sponsored),
    isHappening: Boolean(data.is_happening),
    isFlashSale: Boolean(data.is_flash_sale),
    isTrial: Boolean(data.is_trial),
    status: status === 'active' ? 'approved' : status,
    viewsCount: typeof data.view_count === 'number' ? data.view_count : 0,
    savesCount: typeof data.save_count === 'number' ? data.save_count : 0,
    messagesCount: typeof data.messages_count === 'number' ? data.messages_count : 0,
    rating: typeof data.rating === 'number' ? data.rating : undefined,
    createdAt: data.created_at ? String(data.created_at) : undefined,
    flashSaleEndsAt: data.flash_sale_until ? String(data.flash_sale_until) : undefined,
    venueLatitude: typeof sellersRow?.business_latitude === 'number' ? sellersRow.business_latitude : undefined,
    venueLongitude: typeof sellersRow?.business_longitude === 'number' ? sellersRow.business_longitude : undefined,
  };
}

function useListings(opts: {
  isFlashSale?: boolean;
  isHappening?: boolean;
  isSponsored?: boolean;
  orderField?: string;
  count?: number;
  country?: string;
}): Listing[] {
  const [listings, setListings] = useState<Listing[]>([]);
  const { isFlashSale, isHappening, isSponsored, count = 16, country } = opts;

  useEffect(() => {
    let cancelled = false;
    const fetchListings = async () => {
      let q = supabase
        .from('listings')
        .select('*, listing_images(url, sort_order)')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(count);
      if (isFlashSale !== undefined) q = q.eq('is_flash_sale', isFlashSale);
      if (isHappening !== undefined) q = q.eq('is_happening', isHappening);
      if (isSponsored !== undefined) q = q.eq('is_sponsored', isSponsored);
      if (country) q = q.eq('country', country);
      const { data } = await q;
      if (!cancelled) setListings((data ?? []).map(r => mapListing(r as Record<string, unknown>, String((r as Record<string, unknown>).id ?? ''))));
    };
    fetchListings();
    return () => { cancelled = true; };
  }, [isFlashSale, isHappening, isSponsored, count, country]);

  return listings;
}

function displayPrice(listing: Listing, selectedCurrency: string): string {
  if (listing.priceText?.trim()) return listing.priceText.trim();
  if (listing.priceValue != null) {
    if (selectedCurrency && selectedCurrency !== listing.currencyCode) {
      return `≈ ${formatConverted(listing.priceValue, listing.currencyCode, selectedCurrency)}`;
    }
    return `${getCurrencySymbol(listing.currencyCode)}${listing.priceValue.toLocaleString()}`;
  }
  return 'Price not set';
}

// ─── sub-components ───────────────────────────────────────────────────────────

function SectionStrip({
  gradient, icon, title, subtitle, href, seeAllLabel,
}: {
  gradient: [string, string];
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  href?: string;
  seeAllLabel?: string;
}) {
  return (
    <div style={{
      background: `linear-gradient(135deg, ${gradient[0]} 0%, ${gradient[1]} 100%)`,
      borderRadius: '14px 14px 0 0', padding: '10px 14px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: '#fff', display: 'flex' }}>{icon}</span>
        <span style={{ color: '#fff', fontWeight: 800, fontSize: 15 }}>{title}</span>
        {subtitle && (
          <span style={{
            background: 'rgba(255,255,255,0.25)', color: '#fff',
            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
          }}>{subtitle}</span>
        )}
      </div>
      {href && (
        <Link href={href} style={{
          background: 'rgba(255,255,255,0.25)', color: '#fff',
          fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
          textDecoration: 'none',
        }}>{seeAllLabel ?? 'See all'}</Link>
      )}
    </div>
  );
}

function FlashCard({ listing, onClick, selectedCurrency }: { listing: Listing; onClick: () => void; selectedCurrency: string }) {
  return (
    <div
      onClick={onClick}
      style={{
        width: 120, borderRadius: 12, overflow: 'hidden',
        background: '#fff', flexShrink: 0,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)', cursor: 'pointer',
      }}
    >
      <div style={{ position: 'relative', height: 90 }}>
        {listing.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={listing.imageUrl} alt={listing.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LayoutGrid size={24} color="#9ca3af" />
          </div>
        )}
        <span style={{
          position: 'absolute', top: 6, left: 6,
          background: '#E53935', color: '#fff', fontSize: 8, fontWeight: 900,
          padding: '2px 6px', borderRadius: 8,
        }}>FLASH</span>
      </div>
      <div style={{ padding: '6px 8px 8px' }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {listing.title}
        </p>
        <p style={{ margin: '3px 0 0', fontSize: 12, fontWeight: 800, color: '#2E5BFF' }}>
          {displayPrice(listing, selectedCurrency)}
        </p>
      </div>
    </div>
  );
}

function FeaturedCard({ listing, onClick, selectedCurrency }: { listing: Listing; onClick: () => void; selectedCurrency: string }) {
  return (
    <div
      onClick={onClick}
      style={{
        width: 220, borderRadius: 14, overflow: 'hidden',
        background: '#fff', flexShrink: 0,
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)', cursor: 'pointer',
      }}
    >
      <div style={{ position: 'relative', paddingTop: '56.25%' /* 16:9 */ }}>
        {listing.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={listing.imageUrl} alt={listing.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LayoutGrid size={28} color="#9ca3af" />
          </div>
        )}
        {listing.isSponsored && (
          <span style={{
            position: 'absolute', top: 8, left: 8,
            background: '#2E5BFF', color: '#fff', fontSize: 9, fontWeight: 800,
            padding: '2px 7px', borderRadius: 8,
          }}>Ad</span>
        )}
        {listing.openNow && (
          <span style={{
            position: 'absolute', top: 8, right: 8,
            background: '#1F7A3D', color: '#fff', fontSize: 9, fontWeight: 800,
            padding: '2px 7px', borderRadius: 8,
          }}>Open Now</span>
        )}
      </div>
      <div style={{ padding: '10px 10px 12px' }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {listing.title}
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 14, fontWeight: 800, color: '#2E5BFF' }}>
          {displayPrice(listing, selectedCurrency)}
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 11, color: '#6B7A99', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
          <MapPin size={10} />{listing.locationText || listing.regionOrCity}
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
          {[
            { icon: <Eye size={10} />, val: listing.viewsCount },
            { icon: <Bookmark size={10} />, val: listing.savesCount },
            { icon: <MessageCircle size={10} />, val: listing.messagesCount },
          ].map(({ icon, val }, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>
              {icon}{val}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function GridCard({ listing, onClick, selectedCurrency }: { listing: Listing; onClick: () => void; selectedCurrency: string }) {
  return (
    <div
      onClick={onClick}
      style={{
        borderRadius: 14, overflow: 'hidden',
        background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', cursor: 'pointer',
      }}
    >
      <div style={{ position: 'relative', paddingTop: '83.33%' /* aspect 1.2 */ }}>
        {listing.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={listing.imageUrl} alt={listing.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LayoutGrid size={24} color="#9ca3af" />
          </div>
        )}
        {listing.openNow && (
          <span style={{
            position: 'absolute', bottom: 6, left: 6,
            background: '#1F7A3D', color: '#fff', fontSize: 9, fontWeight: 800,
            padding: '2px 7px', borderRadius: 8,
          }}>Open Now</span>
        )}
      </div>
      <div style={{ padding: '8px 10px 10px' }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {listing.title}
        </p>
        <p style={{ margin: '3px 0 0', fontSize: 14, fontWeight: 800, color: '#2E5BFF' }}>
          {displayPrice(listing, selectedCurrency)}
        </p>
        <p style={{ margin: '3px 0 0', fontSize: 11, color: '#6B7A99', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <MapPin size={10} />{listing.locationText || listing.regionOrCity}
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 5 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>
            <Eye size={10} />{listing.viewsCount}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>
            <Bookmark size={10} />{listing.savesCount}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Filter sheet ──────────────────────────────────────────────────────────────

interface Filters {
  timeSort: 'newest' | 'oldest' | 'none';
  priceSort: 'none' | 'low' | 'high';
  rating: 'any' | '2' | '3' | '4';
  openNow: boolean;
  nearMe: boolean;
}

function FilterSheet({
  filters,
  onApply,
  onClose,
  lang,
}: {
  filters: Filters;
  onApply: (f: Filters) => void;
  onClose: () => void;
  lang: string;
}) {
  const [local, setLocal] = useState<Filters>(filters);

  const selectStyle: React.CSSProperties = {
    width: '100%', height: 46, borderRadius: 12,
    border: '1.5px solid #e2e8f0', background: '#f8faff',
    padding: '0 14px', fontSize: 14, fontWeight: 600,
    color: '#1a1a2e', outline: 'none', appearance: 'none', cursor: 'pointer',
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: '24px 24px 0 0',
          width: '100%', maxWidth: 480, padding: '20px 20px 40px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#132A66' }}>{tr('filterListings', lang)}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={22} color="#6B7A99" />
          </button>
        </div>

        {/* Time sort */}
        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#6B7A99', marginBottom: 6 }}>{tr('datePosted', lang)}</label>
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <select value={local.timeSort} onChange={(e) => setLocal({ ...local, timeSort: e.target.value as Filters['timeSort'] })} style={selectStyle}>
            <option value="newest">{tr('newestFirst', lang)}</option>
            <option value="oldest">{tr('oldestFirst', lang)}</option>
            <option value="none">{tr('none', lang)}</option>
          </select>
          <ChevronDown size={16} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} />
        </div>

        {/* Price sort */}
        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#6B7A99', marginBottom: 6 }}>{tr('priceFilter', lang)}</label>
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <select value={local.priceSort} onChange={(e) => setLocal({ ...local, priceSort: e.target.value as Filters['priceSort'] })} style={selectStyle}>
            <option value="none">{tr('none', lang)}</option>
            <option value="low">{tr('lowToHigh', lang)}</option>
            <option value="high">{tr('highToLow', lang)}</option>
          </select>
          <ChevronDown size={16} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} />
        </div>

        {/* Rating */}
        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#6B7A99', marginBottom: 6 }}>{tr('minimumRating', lang)}</label>
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <select value={local.rating} onChange={(e) => setLocal({ ...local, rating: e.target.value as Filters['rating'] })} style={selectStyle}>
            <option value="any">{tr('any', lang)}</option>
            <option value="2">2+ Stars</option>
            <option value="3">3+ Stars</option>
            <option value="4">4+ Stars</option>
          </select>
          <ChevronDown size={16} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} />
        </div>

        {/* Toggles */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {[
            { label: tr('openNowFilter', lang), key: 'openNow' as const },
            { label: tr('nearMeGps', lang), key: 'nearMe' as const },
          ].map(({ label, key }) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>{label}</span>
              <button
                onClick={() => setLocal({ ...local, [key]: !local[key] })}
                style={{
                  width: 50, height: 28, borderRadius: 14, border: 'none',
                  background: local[key] ? '#2E5BFF' : '#e2e8f0',
                  cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
                }}
              >
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', background: '#fff',
                  position: 'absolute', top: 3, left: local[key] ? 25 : 3,
                  transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
                }} />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={() => { onApply(local); onClose(); }}
          style={{
            width: '100%', height: 52, borderRadius: 26, border: 'none',
            background: '#2E5BFF', color: '#fff', fontWeight: 800, fontSize: 16,
            cursor: 'pointer',
          }}
        >
          {tr('done', lang)}
        </button>
      </div>
    </div>
  );
}

// ─── Main home page ────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();
  const {
    selectedCountry, selectedRegion, locationSet, selectedCurrency, selectedLanguage,
  } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Listing[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    timeSort: 'newest', priceSort: 'none', rating: 'any', openNow: false, nearMe: false,
  });
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [nearMeLoading, setNearMeLoading] = useState(false);
  const [exploreCount, setExploreCount] = useState(8);
  const [menuOpen, setMenuOpen] = useState(false);
  const [announcement, setAnnouncement] = useState<{ title: string; body: string; type: string } | null>(null);
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flag = selectedCountry ? (COUNTRY_FLAGS[selectedCountry] ?? '🌍') : '🌍';

  // Location label shown in the app bar pill
  const locationLabel = locationSet && selectedCountry
    ? selectedRegion
      ? `${selectedCountry} · ${selectedRegion}`
      : selectedCountry
    : tr('allCountries', selectedLanguage);

  // Load recent searches from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = JSON.parse(localStorage.getItem('syph-recent-searches') || '[]');
      if (Array.isArray(stored)) setRecentSearches(stored);
    } catch {
      // ignore parse errors
    }
  }, []);

  // Pick up search query carried from the location screen's dark search bar
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const pending = sessionStorage.getItem('syph-pending-search');
    if (pending) {
      setSearchQuery(pending);
      setShowSearch(true);
      sessionStorage.removeItem('syph-pending-search');
    }
  }, []);

  // Fetch active announcement once on mount
  useEffect(() => {
    supabase.from('announcements')
      .select('title, body, type')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) setAnnouncement(data[0] as { title: string; body: string; type: string });
      });
  }, []);

  // Data subscriptions — ALL sections filtered by selected country
  const filterCountry = selectedCountry || undefined;
  const flashSales = useListings({ isFlashSale: true, count: 20, country: filterCountry });
  const trending = useListings({ orderField: 'viewsCount', count: 12, country: filterCountry });
  const recommended = useListings({ orderField: 'createdAt', count: 12, country: filterCountry });
  const happenings = useListings({ isHappening: true, count: 12, country: filterCountry });
  const sponsored = useListings({ isSponsored: true, count: 12, country: filterCountry });
  const [explore, setExplore] = useState<Listing[]>([]);

  // Explore (all approved) — Supabase-filtered by country
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let q = supabase.from('listings')
        .select('*, listing_images(url, sort_order), sellers!seller_id(business_latitude, business_longitude)')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(40);
      if (selectedCountry) q = q.eq('country', selectedCountry);
      const { data } = await q;
      if (!cancelled) setExplore((data ?? []).map((r) => mapListing(r as Record<string, unknown>, String((r as Record<string, unknown>).id ?? ''))));
    })();
    return () => { cancelled = true; };
  }, [selectedCountry]);

  // Search debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowSearch(false);
      return;
    }
    setShowSearch(true);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const term = sanitizeText(searchQuery.trim(), 100);
        const { data } = await supabase.from('listings')
          .select('*, listing_images(url, sort_order)')
          .eq('status', 'active')
          .or(`title.ilike.%${term}%,description.ilike.%${term}%,seller_name.ilike.%${term}%,location_text.ilike.%${term}%,region.ilike.%${term}%`)
          .order('created_at', { ascending: false })
          .limit(20);
        setSearchResults((data ?? []).map((r) => mapListing(r as Record<string, unknown>, String((r as Record<string, unknown>).id ?? ''))));
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 400);
  }, [searchQuery]);

  // Active filter count
  const filterCount = [
    filters.timeSort !== 'newest',
    filters.priceSort !== 'none',
    filters.rating !== 'any',
    filters.openNow,
    filters.nearMe,
  ].filter(Boolean).length;

  // Apply client-side sorting/filtering to explore.
  // Region filter is client-side only (no guaranteed Firestore composite index).
  const sortedExplore = useCallback(() => {
    let items = [...explore];
    // Belt-and-suspenders country filter
    if (selectedCountry) items = items.filter((l) => l.country === selectedCountry);
    // Region filter — client-side
    if (selectedRegion) {
      items = items.filter((l) =>
        !l.regionOrCity || l.regionOrCity.toLowerCase().includes(selectedRegion.toLowerCase())
      );
    }
    if (filters.openNow) items = items.filter((l) => l.openNow);
    if (filters.nearMe && userCoords) {
      items.sort((a, b) => {
        const distA = a.venueLatitude != null && a.venueLongitude != null
          ? haversineKm(userCoords.lat, userCoords.lng, a.venueLatitude, a.venueLongitude)
          : Infinity;
        const distB = b.venueLatitude != null && b.venueLongitude != null
          ? haversineKm(userCoords.lat, userCoords.lng, b.venueLatitude, b.venueLongitude)
          : Infinity;
        return distA - distB;
      });
    }
    if (filters.rating !== 'any') {
      const min = parseInt(filters.rating);
      items = items.filter((l) => (l.rating ?? 0) >= min);
    }
    if (filters.priceSort === 'low') items.sort((a, b) => (a.priceValue ?? 0) - (b.priceValue ?? 0));
    if (filters.priceSort === 'high') items.sort((a, b) => (b.priceValue ?? 0) - (a.priceValue ?? 0));
    if (filters.timeSort === 'oldest') items.reverse();
    return items;
  }, [explore, filters, userCoords, selectedCountry, selectedRegion]);

  const exploreItems = sortedExplore().slice(0, exploreCount);

  function saveSearch(term: string) {
    if (!term.trim()) return;
    const current: string[] = (() => {
      try { return JSON.parse(localStorage.getItem('syph-recent-searches') || '[]'); }
      catch { return []; }
    })();
    const updated = [term, ...current.filter((s) => s !== term)].slice(0, 5);
    localStorage.setItem('syph-recent-searches', JSON.stringify(updated));
    setRecentSearches(updated);
  }

  const goToListing = (id: string, term?: string) => {
    if (term) saveSearch(term);
    router.push(`/listing/${id}`);
  };

  // Navigate to location page so user can browse all countries
  const handleBrowseAll = () => {
    router.push('/location');
  };

  const handleNearMe = useCallback(async () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported.');
      return;
    }
    setNearMeLoading(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });
      setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      toast.success('Showing listings nearest to you.');
    } catch {
      toast.error('Location access denied.');
    } finally {
      setNearMeLoading(false);
    }
  }, []);

  useEffect(() => {
    if (filters.nearMe) {
      handleNearMe();
    } else {
      setUserCoords(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.nearMe]);

  return (
    <div style={{ minHeight: '100dvh', background: '#F0F4FF', paddingBottom: 80 }} dir={getDir(selectedLanguage)}>
      <MenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
      {/* ── Top App Bar ── */}
      <div style={{
        background: 'linear-gradient(135deg, #0F2B6E 0%, #1E4DD9 100%)',
        padding: '14px 16px 14px',
        position: 'sticky', top: 0, zIndex: 40,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.65)', fontSize: 10, fontWeight: 600, letterSpacing: '0.5px' }}>
              {tr('tagline', selectedLanguage).toUpperCase()}
            </p>
            <p style={{ margin: '2px 0 0', color: '#fff', fontSize: 20, fontWeight: 900, letterSpacing: '1px' }}>SYPH</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Location pill — tappable, shows flag + country · region */}
            <button
              onClick={() => router.push('/location')}
              style={{
                background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: 20, padding: '5px 10px',
                display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer',
                maxWidth: 150, flexShrink: 1, minWidth: 0,
              }}
            >
              <span style={{ fontSize: 14, flexShrink: 0, lineHeight: 1 }}>{flag}</span>
              <span style={{
                color: '#fff', fontWeight: 700, fontSize: 11,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                flex: 1, minWidth: 0,
              }}>
                {locationLabel}
              </span>
              <ChevronDown size={11} color="rgba(255,255,255,0.8)" style={{ flexShrink: 0 }} />
            </button>
            <Link href="/categories" style={{
              background: '#F39C12', borderRadius: 10, padding: '7px 12px',
              display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', flexShrink: 0,
            }}>
              <LayoutGrid size={16} color="#fff" />
              <span style={{ color: '#fff', fontWeight: 800, fontSize: 12 }}>{tr('category', selectedLanguage)}</span>
            </Link>
            <button onClick={() => setMenuOpen(true)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '6px', flexShrink: 0,
            }}>
              <Menu size={22} color="#fff" strokeWidth={2.2} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ padding: '14px 14px 0' }}>

        {/* Location banner */}
        <div style={{
          background: '#fff', borderRadius: 14, padding: '10px 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          border: '1px solid #e8edf5', marginBottom: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 26 }}>{flag}</span>
            <div>
              <p style={{ margin: 0, fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>{tr('showingIn', selectedLanguage)}</p>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#1a1a2e' }}>
                {selectedCountry || tr('allCountries', selectedLanguage)}
              </p>
              {selectedRegion && (
                <p style={{ margin: '2px 0 0', fontSize: 11, fontWeight: 600, color: '#2E5BFF' }}>
                  {selectedRegion} {tr('region', selectedLanguage)}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => router.push('/location')}
            style={{
              background: '#E3F0FF', color: '#2E5BFF', border: 'none',
              borderRadius: 10, padding: '6px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}
          >
            {tr('change', selectedLanguage)}
          </button>
        </div>

        {/* Announcement banner */}
        {announcement && !announcementDismissed && (() => {
          const bg = announcement.type === 'warning' ? '#FFF8E1' : announcement.type === 'promo' ? '#E8F5E9' : '#E3F0FF';
          const border = announcement.type === 'warning' ? '#FFD54F' : announcement.type === 'promo' ? '#A5D6A7' : '#93C5FD';
          const color = announcement.type === 'warning' ? '#7B5800' : announcement.type === 'promo' ? '#1B5E20' : '#1E40AF';
          const icon = announcement.type === 'warning' ? '⚠️' : announcement.type === 'promo' ? '🎉' : 'ℹ️';
          return (
            <div style={{
              background: bg, border: `1px solid ${border}`, borderRadius: 14,
              padding: '10px 14px', marginBottom: 12,
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                {announcement.title && (
                  <div style={{ fontWeight: 800, fontSize: 13, color, marginBottom: 2 }}>{announcement.title}</div>
                )}
                <div style={{ fontSize: 12, color, fontWeight: 600, lineHeight: 1.4 }}>{announcement.body}</div>
              </div>
              <button
                onClick={() => setAnnouncementDismissed(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color, padding: 2, flexShrink: 0 }}
              >
                <X size={14} />
              </button>
            </div>
          );
        })()}

        {/* Search bar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, position: 'relative' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={17} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
              placeholder={tr('searchListings', selectedLanguage)}
              style={{
                width: '100%', height: 46, borderRadius: 14,
                border: '1.5px solid #e2e8f0', background: '#fff',
                paddingLeft: 42, paddingRight: 14, fontSize: 14, fontWeight: 500,
                color: '#1a1a2e', outline: 'none',
              }}
            />
            {/* Search dropdown */}
            {showSearch && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30,
                background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)', marginTop: 4, maxHeight: 320, overflowY: 'auto',
              }}>
                {searchLoading ? (
                  <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>{tr('searchingDots', selectedLanguage)}</div>
                ) : searchResults.length === 0 ? (
                  <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>{tr('noResults', selectedLanguage)}</div>
                ) : (
                  searchResults.map((item) => {
                    const inCountry = !selectedCountry || item.country === selectedCountry;
                    return (
                      <div
                        key={item.id}
                        onClick={() => { goToListing(item.id, searchQuery.trim()); setSearchQuery(''); setShowSearch(false); }}
                        style={{
                          padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9',
                          display: 'flex', alignItems: 'flex-start', gap: 10,
                        }}
                      >
                        <Search size={15} style={{ color: '#9ca3af', flexShrink: 0, marginTop: 2 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {sanitizeText(item.title)}
                          </p>
                          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <MapPin size={9} />{sanitizeText(item.locationText)}
                            <span style={{ marginLeft: 6 }}>{item.mainCategoryId}</span>
                            {item.priceText && <span style={{ marginLeft: 6, color: '#2E5BFF', fontWeight: 700 }}>{item.priceText}</span>}
                          </p>
                          {!inCountry && (
                            <span style={{ fontSize: 9, background: '#FFF3E0', color: '#E65100', fontWeight: 700, padding: '1px 6px', borderRadius: 6, marginTop: 2, display: 'inline-block' }}>
                              {tr('broaderMatch', selectedLanguage)}
                            </span>
                          )}
                        </div>
                        {item.openNow && (
                          <span style={{ fontSize: 9, background: '#E8F5E9', color: '#1F7A3D', fontWeight: 700, padding: '2px 6px', borderRadius: 6, flexShrink: 0 }}>
                            Open
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
          {/* Filter button */}
          <button
            onClick={() => setShowFilter(true)}
            style={{
              width: 46, height: 46, borderRadius: 14,
              background: filterCount > 0 ? '#2E5BFF' : '#fff',
              border: '1.5px solid #e2e8f0', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative', flexShrink: 0,
            }}
          >
            <SlidersHorizontal size={18} color={filterCount > 0 ? '#fff' : '#4A5878'} />
            {filterCount > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -4,
                background: '#ef4444', color: '#fff', borderRadius: '50%',
                width: 16, height: 16, fontSize: 9, fontWeight: 900,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{filterCount}</span>
            )}
          </button>
        </div>

        {/* ── Flash Sales ── */}
        {flashSales.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <SectionStrip
              gradient={['#C62828', '#E53935']}
              icon={<Zap size={16} />}
              title={tr('flashSalesEndingSoon', selectedLanguage)}
              href="/flash-sales"
              seeAllLabel={tr('seeAll', selectedLanguage)}
            />
            <div style={{
              background: '#fff', borderRadius: '0 0 14px 14px',
              padding: '12px 12px',
              overflowX: 'auto', display: 'flex', gap: 10,
            }}
              className="no-scrollbar"
            >
              {flashSales.map((l) => (
                <FlashCard key={l.id} listing={l} onClick={() => goToListing(l.id)} selectedCurrency={selectedCurrency} />
              ))}
            </div>
          </div>
        )}

        {/* ── Trending Near You ── */}
        {trending.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <SectionStrip
              gradient={['#E65100', '#FF6D00']}
              icon={<TrendingUp size={16} />}
              title={tr('trendingNearYou', selectedLanguage)}
              subtitle={tr('hotNow', selectedLanguage)}
            />
            <div style={{
              background: '#fff', borderRadius: '0 0 14px 14px',
              padding: '12px 12px',
              overflowX: 'auto', display: 'flex', gap: 10,
            }}
              className="no-scrollbar"
            >
              {trending.map((l) => (
                <FeaturedCard key={l.id} listing={l} onClick={() => goToListing(l.id)} selectedCurrency={selectedCurrency} />
              ))}
            </div>
          </div>
        )}

        {/* ── Recommended For You ── */}
        {recommended.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <SectionStrip
              gradient={['#6A1B9A', '#8E24AA']}
              icon={<Star size={16} />}
              title={tr('recommendedForYou', selectedLanguage)}
            />
            <div style={{
              background: '#fff', borderRadius: '0 0 14px 14px',
              padding: '12px 12px',
              overflowX: 'auto', display: 'flex', gap: 10,
            }}
              className="no-scrollbar"
            >
              {recommended.map((l) => (
                <FeaturedCard key={l.id} listing={l} onClick={() => goToListing(l.id)} selectedCurrency={selectedCurrency} />
              ))}
            </div>
          </div>
        )}

        {/* ── Happenings ── */}
        {happenings.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <SectionStrip
              gradient={['#1B5E20', '#2E7D32']}
              icon={<Zap size={16} />}
              title={tr('happenings', selectedLanguage)}
              href="/happenings"
              seeAllLabel={tr('seeAll', selectedLanguage)}
            />
            <div style={{
              background: '#fff', borderRadius: '0 0 14px 14px',
              padding: '12px 12px',
              overflowX: 'auto', display: 'flex', gap: 10,
            }}
              className="no-scrollbar"
            >
              {happenings.map((l) => (
                <FeaturedCard key={l.id} listing={l} onClick={() => goToListing(l.id)} selectedCurrency={selectedCurrency} />
              ))}
            </div>
          </div>
        )}

        {/* ── Sponsored ── */}
        {sponsored.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <SectionStrip
              gradient={['#0D47A1', '#1976D2']}
              icon={<Crown size={16} />}
              title={tr('sponsored', selectedLanguage)}
            />
            <div style={{
              background: '#fff', borderRadius: '0 0 14px 14px',
              padding: '12px 12px',
              overflowX: 'auto', display: 'flex', gap: 10,
            }}
              className="no-scrollbar"
            >
              {sponsored.map((l) => (
                <FeaturedCard key={l.id} listing={l} onClick={() => goToListing(l.id)} selectedCurrency={selectedCurrency} />
              ))}
            </div>
          </div>
        )}

        {/* ── More to Explore ── */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0 14px' }}>
            <div style={{ flex: 1, height: 1, background: '#d1d5db' }} />
            <span style={{ fontSize: 11, fontWeight: 800, color: '#6B7A99', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
              {tr('moreToExplore', selectedLanguage)}
            </span>
            <div style={{ flex: 1, height: 1, background: '#d1d5db' }} />
          </div>

          {exploreItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af' }}>
              <Globe size={40} style={{ opacity: 0.4, margin: '0 auto 12px', display: 'block' }} />
              {selectedCountry ? (
                <>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#4A5878' }}>
                    {tr('noListingsYet', selectedLanguage)} in {flag} {selectedCountry}{selectedRegion ? ` · ${selectedRegion}` : ''}
                  </p>
                  <p style={{ margin: '6px 0 16px', fontSize: 13 }}>
                    {tr('beFirstToList', selectedLanguage)}
                  </p>
                  <button
                    onClick={handleBrowseAll}
                    style={{
                      background: '#2E5BFF', color: '#fff', border: 'none',
                      borderRadius: 14, padding: '10px 22px', fontWeight: 700,
                      fontSize: 14, cursor: 'pointer',
                    }}
                  >
                    {tr('browseAllCountries', selectedLanguage)}
                  </button>
                </>
              ) : (
                <>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{tr('noListingsInArea', selectedLanguage)}</p>
                  <p style={{ margin: '6px 0 0', fontSize: 13 }}>{tr('tryChangingCountry', selectedLanguage)}</p>
                </>
              )}
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {exploreItems.map((l) => (
                  <GridCard key={l.id} listing={l} onClick={() => goToListing(l.id)} selectedCurrency={selectedCurrency} />
                ))}
              </div>

              {exploreCount < sortedExplore().length && (
                <button
                  onClick={() => setExploreCount((c) => c + 8)}
                  style={{
                    width: '100%', height: 46, borderRadius: 14, marginTop: 12,
                    background: '#fff', border: '1.5px solid #e2e8f0',
                    color: '#2E5BFF', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                  }}
                >
                  {tr('loadMore', selectedLanguage)}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Filter Sheet */}
      {showFilter && (
        <FilterSheet
          filters={filters}
          onApply={(f) => {
            setFilters(f);
            setExploreCount(8);
          }}
          onClose={() => setShowFilter(false)}
          lang={selectedLanguage}
        />
      )}

      <BottomNav />
    </div>
  );
}
