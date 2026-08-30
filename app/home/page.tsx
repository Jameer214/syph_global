'use client';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Search, SlidersHorizontal, MapPin, Zap, TrendingUp,
  Star, Crown, Globe, Eye, Bookmark, MessageCircle, Menu,
  LayoutGrid, X, ChevronDown, ShoppingBag, Sparkles, Award, Timer, History,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { sanitizeText } from '@/lib/sanitize';
import { useAppStore } from '@/store';
import { supabase } from '@/lib/supabase';
import { formatConverted, getCurrencySymbol } from '@/lib/currency';
import { tr, getDir, trCategory } from '@/lib/i18n';
import { COUNTRY_FLAGS } from '@/data/countries';
import BottomNav from '@/components/BottomNav';
import MenuDrawer from '@/components/MenuDrawer';
import DistanceChip from '@/components/DistanceChip';
import OpenStatusChip from '@/components/OpenStatusChip';
import ZigzagEdge from '@/components/ZigzagEdge';
import VerifiedTick from '@/components/VerifiedTick';
import { useVerifiedSellers } from '@/lib/useVerifiedSellers';
import { useDistances } from '@/lib/useDistances';
import type { Listing } from '@/types';
import { readListingsCache, writeListingsCache, isCacheFresh, HOT_SELLING_TTL_MS } from '@/lib/listingsCache';
import { getRecentlyViewed, clearRecentlyViewed } from '@/lib/recentlyViewed';
import { addSavedSearch, searchSellers, type ShopHit } from '@/lib/firestore';
import ShopSuggestions from '@/components/ShopSuggestions';
import { isPast, isEventExpired, startOfTodayISO } from '@/lib/promo';
import { mainCategoryForQuery, getCategoryById } from '@/data/categories';

// ─── helpers ──────────────────────────────────────────────────────────────────

function mapListing(data: Record<string, unknown>, id: string): Listing {
  const imgs = Array.isArray(data.listing_images) ? (data.listing_images as { url: string; sort_order?: number }[]) : [];
  const sorted = [...imgs].sort((a, b) => ((a.sort_order ?? 0) - (b.sort_order ?? 0)));
  const status = String(data.status ?? 'pending');
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
    venueLatitude: typeof data.venue_latitude === 'number' ? data.venue_latitude : undefined,
    venueLongitude: typeof data.venue_longitude === 'number' ? data.venue_longitude : undefined,
    mainCategoryId: String(data.category_id ?? ''),
    subCategoryId: data.sub_category_id ? String(data.sub_category_id) : undefined,
    openNow: Boolean(data.open_now),
    // Timed promos expire: a listing stays flagged in the DB but should stop
    // counting as sponsored / flash once its `*_until` timestamp has passed
    // (mirrors the Flutter listing mapper so web and app agree).
    isSponsored: Boolean(data.is_sponsored) && !isPast(data.sponsored_until),
    isHappening: Boolean(data.is_happening) && !isEventExpired(data.event_date),
    isFlashSale: Boolean(data.is_flash_sale) && !isPast(data.flash_sale_until),
    isTrial: Boolean(data.is_trial),
    status: status === 'active' ? 'approved' : status,
    viewsCount: typeof data.view_count === 'number' ? data.view_count : 0,
    savesCount: typeof data.save_count === 'number' ? data.save_count : 0,
    messagesCount: typeof data.messages_count === 'number' ? data.messages_count : 0,
    rating: typeof data.rating === 'number' ? data.rating : undefined,
    createdAt: data.created_at ? String(data.created_at) : undefined,
    flashSaleEndsAt: data.flash_sale_until ? String(data.flash_sale_until) : undefined,
    units: typeof data.unit_count === 'number' ? data.unit_count : undefined,
  };
}

// ─── personalised-rail helpers (mirror the Flutter app) ─────────────────────────

// Deterministic seeded RNG so a given seed always yields the same shuffle.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Stable per-device seed persisted once, so a visitor's rails stay consistent
// for them but differ from other people.
function getRailSeed(): number {
  if (typeof window === 'undefined') return 1;
  try {
    const existing = window.localStorage.getItem('syph-rail-seed');
    if (existing) return parseInt(existing, 10) || 1;
    const seed = Math.floor(Math.random() * (1 << 30)) + 1;
    window.localStorage.setItem('syph-rail-seed', String(seed));
    return seed;
  } catch {
    return 1;
  }
}

function dedupeById(pool: Listing[]): Listing[] {
  const seen = new Set<string>();
  const out: Listing[] = [];
  for (const l of pool) if (!seen.has(l.id)) { seen.add(l.id); out.push(l); }
  return out;
}

const DAY_MS = 24 * 60 * 60 * 1000;
function dayIndex(): number {
  return Math.floor((Date.now() - Date.UTC(2024, 0, 1)) / DAY_MS);
}

// "Shuffled per user, one new item leads each day" — a per-user shuffle fixes a
// personal order; rotating the start index by the day count surfaces a new lead
// item daily while the set stays stable within the day.
function dailyRotatedRail(pool: Listing[], seed: number, take = 10): Listing[] {
  const unique = dedupeById(pool);
  if (unique.length === 0) return unique;
  const rng = mulberry32(seed);
  // Fisher–Yates with the seeded RNG.
  for (let i = unique.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [unique[i], unique[j]] = [unique[j], unique[i]];
  }
  const offset = ((dayIndex() % unique.length) + unique.length) % unique.length;
  const rotated = [...unique.slice(offset), ...unique.slice(0, offset)];
  return rotated.slice(0, take);
}

// A rotating window over the views-ordered pool: a different block each day so
// the rail looks fresh daily while the pool itself refreshes only every 3 days.
function hotSellingDailySlice(pool: Listing[], take = 10): Listing[] {
  if (pool.length === 0) return pool;
  const windows = Math.ceil(pool.length / take);
  const start = ((dayIndex() % windows) * take) % pool.length;
  const out: Listing[] = [];
  for (let i = 0; i < take && i < pool.length; i++) {
    out.push(pool[(start + i) % pool.length]);
  }
  return out;
}

// 60s session cache — navigating away and back re-renders home without
// re-firing the same five feed queries against the database.
const feedCache = new Map<string, { at: number; data: Listing[] }>();
const FEED_TTL_MS = 60_000;

function useListings(opts: {
  isFlashSale?: boolean;
  isHappening?: boolean;
  isSponsored?: boolean;
  orderColumn?: string;
  count?: number;
  country?: string;
}): Listing[] {
  const [listings, setListings] = useState<Listing[]>([]);
  const { isFlashSale, isHappening, isSponsored, orderColumn = 'created_at', count = 16, country } = opts;

  useEffect(() => {
    let cancelled = false;
    const key = JSON.stringify([isFlashSale, isHappening, isSponsored, orderColumn, count, country ?? '']);

    // 1. Fast in-session path (60s) — avoids re-querying on quick navigation.
    const hit = feedCache.get(key);
    if (hit && Date.now() - hit.at < FEED_TTL_MS) {
      setListings(hit.data);
      return;
    }

    // 2. Persistent 24h cache — paint saved listings immediately on load.
    const persisted = readListingsCache(`feed_${key}`);
    if (persisted && !cancelled) {
      setListings(persisted.items);
      feedCache.set(key, { at: Date.now(), data: persisted.items });
    }

    const fetchListings = async () => {
      let q = supabase
        .from('listings')
        .select('*, listing_images(url, sort_order)')
        .eq('status', 'active')
        .order(orderColumn, { ascending: false })
        .limit(count);
      if (isFlashSale !== undefined) q = q.eq('is_flash_sale', isFlashSale);
      if (isHappening !== undefined) q = q.eq('is_happening', isHappening);
      if (isSponsored !== undefined) q = q.eq('is_sponsored', isSponsored);
      // Drop expired timed promos server-side (null = no expiry set = still on),
      // matching the Flutter flash-sale/sponsored feed queries.
      if (isFlashSale === true) {
        q = q.or(`flash_sale_until.is.null,flash_sale_until.gt.${new Date().toISOString()}`);
      }
      if (isSponsored === true) {
        q = q.or(`sponsored_until.is.null,sponsored_until.gt.${new Date().toISOString()}`);
      }
      // Drop happenings whose event day has already passed (null = no date set).
      if (isHappening === true) {
        q = q.or(`event_date.is.null,event_date.gte.${startOfTodayISO()}`);
      }
      if (country) q = q.eq('country', country);
      const { data } = await q;
      const items = (data ?? []).map(r => mapListing(r as Record<string, unknown>, String((r as Record<string, unknown>).id ?? '')));
      feedCache.set(key, { at: Date.now(), data: items });
      writeListingsCache(`feed_${key}`, items);
      if (!cancelled) setListings(items);
    };

    // 3. Stale-while-revalidate: the persisted cache above paints instantly for
    //    a snappy load, but we ALWAYS refetch in the background so removals stay
    //    honest — a deleted listing, an ended flash sale / sponsorship, or an
    //    expired happening drops on the very next load instead of lingering for
    //    up to 24h. The 60s in-session `feedCache` (early return above) still
    //    dedups rapid navigation, so this doesn't hammer the backend.
    fetchListings();
    return () => { cancelled = true; };
  }, [isFlashSale, isHappening, isSponsored, orderColumn, count, country]);

  return listings;
}

function displayPrice(listing: Listing, selectedCurrency: string): string {
  if (listing.priceValue != null && selectedCurrency && selectedCurrency !== listing.currencyCode) {
    return `≈ ${formatConverted(listing.priceValue, listing.currencyCode, selectedCurrency)}`;
  }
  if (listing.priceText?.trim()) return listing.priceText.trim();
  if (listing.priceValue != null) {
    return `${getCurrencySymbol(listing.currencyCode)}${listing.priceValue.toLocaleString()}`;
  }
  return 'Price not set';
}

// ─── sub-components ───────────────────────────────────────────────────────────

function SectionStrip({
  gradient, icon, title, subtitle, href, seeAllLabel, sweep,
}: {
  gradient: [string, string];
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  href?: string;
  seeAllLabel?: string;
  sweep?: boolean;
}) {
  return (
    <div className={sweep ? 'sweep' : undefined} style={{
      background: `linear-gradient(135deg, ${gradient[0]} 0%, ${gradient[1]} 100%)`,
      borderRadius: '14px 14px 0 0', padding: '10px 14px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="bob" style={{ color: '#fff', display: 'flex' }}>{icon}</span>
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

// Cosmetic urgency countdown to the next UTC midnight — matches the dedicated
// /flash-sales page card and the Flutter flash-sale card.
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

function FlashCard({ listing, onClick, selectedCurrency, distanceKm, verified }: { listing: Listing; onClick: () => void; selectedCurrency: string; distanceKm?: number; verified?: boolean }) {
  const { selectedLanguage } = useAppStore();
  const countdown = useCountdown();
  return (
    <div
      onClick={onClick}
      className="card-tap card-zoom"
      style={{
        width: 160, borderRadius: 12, overflow: 'hidden',
        background: '#fff', flexShrink: 0,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)', cursor: 'pointer',
      }}
    >
      <div className="card-media" style={{ position: 'relative', paddingTop: '83.33%' /* aspect 1.2, matches grid cards */ }}>
        {listing.imageUrl ? (
          <Image src={listing.imageUrl} alt={listing.title} fill sizes="160px" className="img-fade" onLoad={(e) => e.currentTarget.classList.add('img-loaded')} style={{ objectFit: 'cover' }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LayoutGrid size={24} color="#9ca3af" />
          </div>
        )}
        <span className="flash-badge" style={{
          position: 'absolute', top: 6, left: 6,
          background: '#E53935', color: '#fff', fontSize: 8, fontWeight: 900,
          padding: '2px 6px', borderRadius: 8,
        }}>{tr('flashWord', selectedLanguage).toUpperCase()}</span>
        <span style={{ position: 'absolute', top: 8, right: 8, zIndex: 2 }}>
          <OpenStatusChip ownerUid={listing.ownerUid} country={listing.country} size="xs" variant="solid" />
        </span>
        <ZigzagEdge color="#fff" />
      </div>
      <div style={{ padding: '6px 8px 6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <p style={{ margin: 0, flex: 1, minWidth: 0, fontSize: 11, fontWeight: 700, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {listing.title}
          </p>
          {verified && <VerifiedTick size={13} />}
        </div>
        <p style={{ margin: '3px 0 0', fontSize: 12, fontWeight: 800, color: '#2E5BFF' }}>
          {displayPrice(listing, selectedCurrency)}
        </p>
        {distanceKm != null && (
          <div style={{ marginTop: 4 }}><DistanceChip km={distanceKm} size="xs" /></div>
        )}
      </div>
      {/* Countdown banner — same behaviour/format as the app & /flash-sales page */}
      <div style={{ background: '#D32F2F', padding: '5px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <Timer size={12} color="#fff" />
        <span style={{ color: '#fff', fontSize: 11, fontWeight: 900, letterSpacing: 0.5 }}>{countdown} left</span>
      </div>
    </div>
  );
}

function FeaturedCard({ listing, onClick, selectedCurrency, distanceKm, verified }: { listing: Listing; onClick: () => void; selectedCurrency: string; distanceKm?: number; verified?: boolean }) {
  const { selectedLanguage } = useAppStore();
  return (
    <div
      onClick={onClick}
      className="card-tap card-zoom"
      style={{
        width: 220, borderRadius: 14, overflow: 'hidden',
        background: '#fff', flexShrink: 0,
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)', cursor: 'pointer',
      }}
    >
      <div className="card-media" style={{ position: 'relative', paddingTop: '72%' }}>
        {listing.imageUrl ? (
          <Image src={listing.imageUrl} alt={listing.title} fill sizes="220px" className="img-fade" onLoad={(e) => e.currentTarget.classList.add('img-loaded')} style={{ objectFit: 'cover' }} />
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
          }}>{tr('adBadge', selectedLanguage)}</span>
        )}
        <span style={{ position: 'absolute', top: 8, right: 8, zIndex: 2 }}>
          <OpenStatusChip ownerUid={listing.ownerUid} country={listing.country} size="xs" variant="solid" />
        </span>
        <ZigzagEdge color="#fff" />
      </div>
      <div style={{ padding: '7px 10px 8px' }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {listing.title}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 800, color: '#2E5BFF', lineHeight: 1.25 }}>
          {displayPrice(listing, selectedCurrency)}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6B7A99', fontWeight: 500, lineHeight: 1.25, display: 'flex', alignItems: 'center', gap: 4 }}>
          <MapPin size={10} />{listing.locationText || listing.regionOrCity}
        </p>
        {distanceKm != null && (
          <div style={{ marginTop: 4 }}><DistanceChip km={distanceKm} /></div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
          {[
            { icon: <Eye size={10} />, val: listing.viewsCount },
            { icon: <Bookmark size={10} />, val: listing.savesCount },
            { icon: <MessageCircle size={10} />, val: listing.messagesCount },
          ].map(({ icon, val }, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>
              {icon}{val}
            </span>
          ))}
          {verified && <span style={{ marginLeft: 'auto' }}><VerifiedTick size={16} /></span>}
        </div>
      </div>
    </div>
  );
}

function GridCard({ listing, onClick, selectedCurrency, distanceKm, verified }: { listing: Listing; onClick: () => void; selectedCurrency: string; distanceKm?: number; verified?: boolean }) {
  const { selectedLanguage } = useAppStore();
  return (
    <div
      onClick={onClick}
      className="card-tap anim-fade-up card-zoom"
      style={{
        borderRadius: 14, overflow: 'hidden',
        background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', cursor: 'pointer',
      }}
    >
      <div className="card-media" style={{ position: 'relative', paddingTop: '83.33%' /* aspect 1.2 */ }}>
        {listing.imageUrl ? (
          <Image src={listing.imageUrl} alt={listing.title} fill sizes="(max-width: 480px) 50vw, 240px" className="img-fade" onLoad={(e) => e.currentTarget.classList.add('img-loaded')} style={{ objectFit: 'cover' }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LayoutGrid size={24} color="#9ca3af" />
          </div>
        )}
        <ZigzagEdge color="#fff" />
        <span style={{ position: 'absolute', top: 6, right: 6, zIndex: 2 }}>
          <OpenStatusChip ownerUid={listing.ownerUid} country={listing.country} size="xs" variant="solid" />
        </span>
      </div>
      <div style={{ padding: '8px 10px 10px' }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {listing.title}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 800, color: '#2E5BFF', lineHeight: 1.25 }}>
          {displayPrice(listing, selectedCurrency)}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6B7A99', fontWeight: 500, lineHeight: 1.25, display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <MapPin size={10} />{listing.locationText || listing.regionOrCity}
        </p>
        {distanceKm != null && (
          <div style={{ marginTop: 4 }}><DistanceChip km={distanceKm} /></div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>
            <Eye size={10} />{listing.viewsCount}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>
            <Bookmark size={10} />{listing.savesCount}
          </span>
          {verified && <span style={{ marginLeft: 'auto' }}><VerifiedTick size={16} /></span>}
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
      className="sheet-backdrop"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="sheet-panel"
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
          className="btn-tap"
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
    user, selectedCountry, selectedRegion, locationSet, selectedCurrency, selectedLanguage,
  } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Listing[]>([]);
  // Matching seller shops for the same query — shown above product hits so
  // buyers can open a storefront directly. Additive to the listing search.
  const [shopResults, setShopResults] = useState<ShopHit[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    timeSort: 'newest', priceSort: 'none', rating: 'any', openNow: false, nearMe: false,
  });
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [nearMeLoading, setNearMeLoading] = useState(false);
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

  // Revisit a saved search: when arriving with ?q=... (from the Saved Searches
  // page), pre-fill the search field so the results dropdown re-runs. Read from
  // window.location to avoid needing a Suspense boundary for useSearchParams.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const q = new URLSearchParams(window.location.search).get('q');
    if (q && q.trim()) setSearchQuery(q.trim());
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

  // Per-device seed + last-searched category power the personalised rails.
  // Start at 0/null so the server render and first client render match, then
  // hydrate the real values in an effect (avoids hydration mismatch).
  const [railSeed, setRailSeed] = useState(0);
  const [lastSearchCat, setLastSearchCat] = useState<string | null>(null);
  useEffect(() => {
    setRailSeed(getRailSeed());
    try {
      const c = localStorage.getItem('syph-last-search-category');
      if (c) setLastSearchCat(c);
    } catch { /* ignore */ }
  }, []);

  // Recently viewed — local-only personal history, hydrated client-side (like
  // railSeed above) so server and first client render match.
  const [recentlyViewed, setRecentlyViewed] = useState<Listing[]>([]);
  useEffect(() => {
    setRecentlyViewed(getRecentlyViewed());
  }, []);

  // Data subscriptions — ALL sections filtered by selected country
  const filterCountry = selectedCountry || undefined;
  const flashSales = useListings({ isFlashSale: true, count: 20, country: filterCountry });
  // Trending = the most-viewed listings in the country (pure view_count).
  const trending = useListings({ orderColumn: 'view_count', count: 20, country: filterCountry });
  const happenings = useListings({ isHappening: true, count: 12, country: filterCountry });
  const sponsored = useListings({ isSponsored: true, count: 12, country: filterCountry });

  // Broad country pool (newest) that feeds Recommended / Just In / Top Rated.
  const railPool = useListings({ count: 40, country: filterCountry });

  // Recommended: personalise the POOL by the user's searched categories, then
  // order it per-user with a daily-rotating lead item.
  const recommended = useMemo(() => {
    let pool = railPool;
    if (lastSearchCat) {
      const matched = railPool.filter((l) => l.mainCategoryId === lastSearchCat);
      if (matched.length >= 4) pool = matched;
    }
    return dailyRotatedRail(pool, railSeed);
  }, [railPool, railSeed, lastSearchCat]);

  // Just In — recent items, shuffled per user, rotating daily.
  const justIn = useMemo(
    () => dailyRotatedRail(railPool.slice(0, 30), railSeed),
    [railPool, railSeed],
  );

  // Top Rated — 4.5★+, shuffled per user, rotating daily.
  const topRated = useMemo(
    () => dailyRotatedRail(railPool.filter((l) => (l.rating ?? 0) >= 4.5), railSeed),
    [railPool, railSeed],
  );

  // Hot Selling [Category] — most-viewed in the last-searched category (default
  // electronics), pool cached 3 days, a different daily slice shown within them.
  const HOT_DEFAULT_CATEGORY = 'electronics';
  const hotCatId = lastSearchCat || HOT_DEFAULT_CATEGORY;
  const hotCat = getCategoryById(hotCatId);
  const hotCatTitle = hotCat ? trCategory(hotCat.id, hotCat.title, selectedLanguage) : '';
  const [hotSellingPool, setHotSellingPool] = useState<Listing[]>([]);
  useEffect(() => {
    if (!selectedCountry) { setHotSellingPool([]); return; }
    let cancelled = false;
    const cacheKey = `hot_${selectedCountry}_${hotCatId}`;
    const cached = readListingsCache(cacheKey);
    if (cached && cached.items.length > 0) setHotSellingPool(cached.items);
    // Refetch only when missing or older than 3 days.
    if (cached && cached.items.length > 0 && isCacheFresh(cached, HOT_SELLING_TTL_MS)) return;
    (async () => {
      const { data } = await supabase.from('listings')
        .select('*, listing_images(url, sort_order)')
        .eq('status', 'active')
        .eq('country', selectedCountry)
        .eq('category_id', hotCatId)
        .order('view_count', { ascending: false })
        .limit(30);
      const items = (data ?? []).map((r) => mapListing(r as Record<string, unknown>, String((r as Record<string, unknown>).id ?? '')));
      writeListingsCache(cacheKey, items);
      if (!cancelled) setHotSellingPool(items);
    })();
    return () => { cancelled = true; };
  }, [selectedCountry, hotCatId]);
  const hotSelling = useMemo(() => hotSellingDailySlice(hotSellingPool), [hotSellingPool]);

  // Progressive reveal — with a tiny catalogue every rail draws from the same
  // handful of listings and looks repetitive, so rails unlock only as the
  // country gains distinct listings. Just In + More to Explore always show.
  const catalogSize = useMemo(() => {
    const ids = new Set<string>();
    for (const l of [...trending, ...railPool, ...happenings, ...sponsored, ...flashSales]) ids.add(l.id);
    return ids.size;
  }, [trending, railPool, happenings, sponsored, flashSales]);
  const REVEAL_TRENDING = 8;
  const REVEAL_RECOMMENDED = 12;
  const REVEAL_HOT_SELLING = 12;
  const REVEAL_TOP_RATED = 20;
  const EXPLORE_MAX = 42;
  const EXPLORE_PAGE = 16;
  const [explore, setExplore] = useState<Listing[]>([]);
  const [exploreLoading, setExploreLoading] = useState(true);
  const [exploreHasMore, setExploreHasMore] = useState(true);
  const [exploreLoadingMore, setExploreLoadingMore] = useState(false);

  // Explore — keyset-paginated server-side (created_at cursor). Each "Load
  // more" fetches the next page from the database instead of revealing more
  // of one big pre-downloaded batch.
  const fetchExplorePage = useCallback(async (cursor: string | null): Promise<Listing[]> => {
    let q = supabase.from('listings')
      .select('*, listing_images(url, sort_order)')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(EXPLORE_PAGE);
    if (selectedCountry) q = q.eq('country', selectedCountry);
    if (cursor) q = q.lt('created_at', cursor);
    const { data } = await q;
    return (data ?? []).map((r) => mapListing(r as Record<string, unknown>, String((r as Record<string, unknown>).id ?? '')));
  }, [selectedCountry]);

  // Near Me — server-side true-distance sort over the whole catalog via the
  // listings_near RPC (earthdistance + GiST index). Replaces the old client
  // haversine sort that could only rank the already-loaded page.
  const fetchNearbyExplore = useCallback(async (): Promise<Listing[]> => {
    if (!userCoords) return [];
    const { data: near, error } = await supabase.rpc('listings_near', {
      user_lat: userCoords.lat,
      user_lng: userCoords.lng,
      radius_km: 50,
      country_filter: selectedCountry || null,
      category_filter: null,
      max_results: 60,
    });
    if (error || !near) return [];
    const ids = (near as Record<string, unknown>[]).map((r) => String(r.id));
    if (ids.length === 0) return [];
    // Re-fetch matched ids with the images join, preserving distance order.
    const { data } = await supabase.from('listings')
      .select('*, listing_images(url, sort_order)')
      .in('id', ids);
    const byId = new Map((data ?? []).map((r) => [String((r as Record<string, unknown>).id), r]));
    return ids
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((r) => mapListing(r as Record<string, unknown>, String((r as Record<string, unknown>).id ?? '')));
  }, [userCoords, selectedCountry]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setExploreLoading(true);
      const nearActive = filters.nearMe && !!userCoords;
      const page = nearActive ? await fetchNearbyExplore() : await fetchExplorePage(null);
      if (!cancelled) {
        setExplore(page);
        // Near mode returns a bounded distance set — no keyset "load more".
        setExploreHasMore(!nearActive && page.length === EXPLORE_PAGE);
        setExploreLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fetchExplorePage, fetchNearbyExplore, filters.nearMe, userCoords]);

  const loadMoreExplore = async () => {
    if (exploreLoadingMore || !exploreHasMore) return;
    setExploreLoadingMore(true);
    try {
      const cursor = explore.length > 0 ? (explore[explore.length - 1].createdAt ?? null) : null;
      const page = await fetchExplorePage(cursor);
      setExplore((prev) => {
        const seen = new Set(prev.map((l) => l.id));
        return [...prev, ...page.filter((l) => !seen.has(l.id))];
      });
      setExploreHasMore(page.length === EXPLORE_PAGE);
    } finally {
      setExploreLoadingMore(false);
    }
  };

  // Save the current keyword + active filters so it can be revisited and
  // alerted on when new matching listings appear (additive).
  const handleSaveSearch = async () => {
    const keyword = searchQuery.trim();
    if (!keyword) return;
    if (!user?.uid) { router.push('/login'); return; }
    try {
      await addSavedSearch(user.uid, keyword, {
        country: selectedCountry,
        region: selectedRegion,
        timeSort: filters.timeSort,
        priceSort: filters.priceSort,
        rating: filters.rating,
        openNow: filters.openNow,
        nearMe: filters.nearMe,
      });
      toast.success(tr('searchSaved', selectedLanguage));
    } catch {
      // best-effort
    }
  };

  // Search debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShopResults([]);
      setShowSearch(false);
      return;
    }
    setShowSearch(true);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      const term = sanitizeText(searchQuery.trim(), 100);
      // Shop search runs in parallel with the product search (additive; never
      // throws). Country-scoped when a country of interest is selected.
      searchSellers(term, selectedCountry || undefined).then(setShopResults);
      // 24h per-term cache: show saved results instantly; only re-query when
      // the cache is missing or stale (>24h).
      const searchCacheKey = `search_${term.toLowerCase()}`;
      const persistedSearch = readListingsCache(searchCacheKey);
      if (persistedSearch) setSearchResults(persistedSearch.items);
      if (isCacheFresh(persistedSearch)) { setSearchLoading(false); return; }
      setSearchLoading(true);
      try {
        // Indexed server-side search (pg_trgm RPC) over the whole catalog.
        const { data: ranked, error } = await supabase.rpc('search_listings', {
          search_term: term,
          country_filter: null,
          region_filter: null,
          category_filter: null,
          max_results: 20,
        });
        if (error) throw error;
        const ids = (ranked ?? []).map((r: Record<string, unknown>) => String(r.id));
        if (ids.length === 0) { writeListingsCache(searchCacheKey, []); setSearchResults([]); return; }
        // Re-fetch matched ids with the images join, preserving rank order.
        const { data } = await supabase.from('listings')
          .select('*, listing_images(url, sort_order)')
          .in('id', ids);
        const byId = new Map((data ?? []).map((r) => [String((r as Record<string, unknown>).id), r]));
        const results = ids
          .map((id: string) => byId.get(id))
          .filter(Boolean)
          .map((r: unknown) => mapListing(r as Record<string, unknown>, String((r as Record<string, unknown>).id ?? '')));
        writeListingsCache(searchCacheKey, results);
        setSearchResults(results);
      } catch {
        // RPC unavailable — fall back to the legacy unindexed search.
        try {
          const { data } = await supabase.from('listings')
            .select('*, listing_images(url, sort_order)')
            .eq('status', 'active')
            .or(`title.ilike.%${term}%,description.ilike.%${term}%,seller_name.ilike.%${term}%,location_text.ilike.%${term}%,region.ilike.%${term}%`)
            .order('created_at', { ascending: false })
            .limit(20);
          const fbResults = (data ?? []).map((r) => mapListing(r as Record<string, unknown>, String((r as Record<string, unknown>).id ?? '')));
          writeListingsCache(searchCacheKey, fbResults);
          setSearchResults(fbResults);
        } catch {
          setSearchResults(persistedSearch?.items ?? []);
        }
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
  // useMemo (a VALUE), not useCallback-then-call: the old `sortedExplore()`
  // returned a brand-new array every render, so `exploreItems` changed identity
  // each time → `allShownListings` useMemo re-ran → useDistances/useVerifiedSellers
  // rebuilt their id-keys (O(n log n) over ~100 listings) on every keystroke/tick.
  // As a memoised value the array identity is stable while inputs are unchanged.
  const exploreItems = useMemo(() => {
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
    if (filters.rating !== 'any') {
      const min = parseInt(filters.rating);
      items = items.filter((l) => (l.rating ?? 0) >= min);
    }
    // Near Me: `explore` already arrives ordered by true distance from the
    // listings_near RPC — preserve that order, skip the local price/time sorts.
    if (!(filters.nearMe && userCoords)) {
      if (filters.priceSort === 'low') items.sort((a, b) => (a.priceValue ?? 0) - (b.priceValue ?? 0));
      if (filters.priceSort === 'high') items.sort((a, b) => (b.priceValue ?? 0) - (a.priceValue ?? 0));
      if (filters.timeSort === 'oldest') items.reverse();
    }
    return items;
  }, [explore, filters, userCoords, selectedCountry, selectedRegion]);

  // Distance chips — how far the user is from each visible listing's seller.
  // railPool covers the Recommended/Just In/Top Rated rails (all derived from
  // it). Uses Near-Me coords when active, else silent (already-granted) coords.
  const allShownListings = useMemo(
    () => [
      ...flashSales, ...trending, ...happenings, ...sponsored,
      ...railPool, ...hotSelling, ...exploreItems,
      // Search hits included so Near Me can sort the dropdown by true distance.
      ...searchResults,
    ],
    [flashSales, trending, happenings, sponsored, railPool, hotSelling, exploreItems, searchResults],
  );
  const distanceById = useDistances(allShownListings, userCoords);
  // Which sellers on screen are verified → drives the tick on each card.
  const verifiedSellers = useVerifiedSellers(allShownListings);

  // The active filters must shape the search dropdown too — e.g. Open Now has
  // to hide closed shops in results, not just in the browse grid below. Mirrors
  // the exploreItems filter/sort order so search and browse behave identically.
  const filteredSearchResults = useMemo(() => {
    let items = [...searchResults];
    if (filters.openNow) items = items.filter((l) => l.openNow);
    if (filters.rating !== 'any') {
      const min = parseInt(filters.rating);
      items = items.filter((l) => (l.rating ?? 0) >= min);
    }
    if (filters.nearMe && userCoords) {
      items.sort((a, b) => (distanceById.get(a.id) ?? Infinity) - (distanceById.get(b.id) ?? Infinity));
    } else {
      if (filters.priceSort === 'low') items.sort((a, b) => (a.priceValue ?? 0) - (b.priceValue ?? 0));
      if (filters.priceSort === 'high') items.sort((a, b) => (b.priceValue ?? 0) - (a.priceValue ?? 0));
      if (filters.timeSort === 'oldest') items.reverse();
    }
    return items;
  }, [searchResults, filters, userCoords, distanceById]);

  function saveSearch(term: string) {
    if (!term.trim()) return;
    const current: string[] = (() => {
      try { return JSON.parse(localStorage.getItem('syph-recent-searches') || '[]'); }
      catch { return []; }
    })();
    const updated = [term, ...current.filter((s) => s !== term)].slice(0, 5);
    localStorage.setItem('syph-recent-searches', JSON.stringify(updated));
    setRecentSearches(updated);
    // Remember the category this search resolved to — powers Hot Selling.
    const cat = mainCategoryForQuery(term);
    if (cat) {
      try { localStorage.setItem('syph-last-search-category', cat.id); } catch { /* ignore */ }
      setLastSearchCat(cat.id);
    }
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
      toast.error(tr('geoNotSupportedShort', selectedLanguage));
      return;
    }
    setNearMeLoading(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        // Explicit user action → get the most accurate, fresh fix available.
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });
      setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      toast.success(tr('showingNearestListings', selectedLanguage));
    } catch {
      toast.error(tr('locationAccessDeniedShort', selectedLanguage));
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

  // Rotating search placeholder — cycles category hints while the field is idle.
  const searchHints = useMemo(() => [
    tr('searchListings', selectedLanguage),
    'Cars 🚗', 'Phones 📱', 'Real Estate 🏠', 'Fashion 👗', 'Electronics 🎧', 'Furniture 🛋️',
  ], [selectedLanguage]);
  useEffect(() => {
    if (searchFocused || searchQuery) return;
    const t = setInterval(() => setPlaceholderIdx((i) => (i + 1) % searchHints.length), 2600);
    return () => clearInterval(t);
  }, [searchFocused, searchQuery, searchHints.length]);

  return (
    <div className="wide-page" style={{ minHeight: '100dvh', background: '#F0F4FF', paddingBottom: 80 }} dir={getDir(selectedLanguage)}>
      <MenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
      {/* ── Top App Bar ── */}
      <div className="sweep" style={{
        background: 'linear-gradient(135deg, #0F2B6E 0%, #1E4DD9 100%)',
        padding: '14px 16px 14px',
        position: 'sticky', top: 'var(--desktop-nav-h)', zIndex: 40,
      }}>
        <div className="wide-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.65)', fontSize: 10, fontWeight: 600, letterSpacing: '0.5px' }}>
              {tr('tagline', selectedLanguage).toUpperCase()}
            </p>
            <p className="text-shimmer" style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 900, letterSpacing: '1px' }}>SYPH</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Location pill — tappable, shows flag + country · region */}
            <button
              onClick={() => router.push('/location')}
              className="btn-tap"
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
            <Link href="/categories" className="btn-tap" style={{
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
      <div className="wide-container" style={{ padding: '14px 14px 0' }}>

        {/* Location banner */}
        <div className="anim-fade-up" style={{
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
            className="btn-tap"
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
              placeholder={searchFocused ? searchHints[0] : searchHints[placeholderIdx]}
              className="input-anim"
              style={{
                width: '100%', height: 46, borderRadius: 14,
                border: '1.5px solid #e2e8f0', background: '#fff',
                paddingLeft: 42, paddingRight: 14, fontSize: 14, fontWeight: 500,
                color: '#1a1a2e', outline: 'none',
              }}
            />
            {/* Search dropdown */}
            {showSearch && (
              <div className="anim-fade-up" style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30,
                background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)', marginTop: 4, maxHeight: 320, overflowY: 'auto',
                animationDuration: '0.25s',
              }}>
                <ShopSuggestions
                  shops={shopResults}
                  label={tr('shopsSectionLabel', selectedLanguage)}
                  onNavigate={() => { setSearchQuery(''); setShowSearch(false); }}
                />
                {searchLoading ? (
                  <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>{tr('searchingDots', selectedLanguage)}</div>
                ) : filteredSearchResults.length === 0 ? (
                  shopResults.length === 0 ? (
                    <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>{tr('noResults', selectedLanguage)}</div>
                  ) : null
                ) : (
                  filteredSearchResults.map((item) => {
                    const inCountry = !selectedCountry || item.country === selectedCountry;
                    return (
                      <div
                        key={item.id}
                        onClick={() => { goToListing(item.id, searchQuery.trim()); setSearchQuery(''); setShowSearch(false); }}
                        className="row-tap"
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
            className="btn-tap"
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

        {/* ── Save search (additive) — only when a keyword is present ── */}
        {searchQuery.trim() !== '' && (
          <button
            onClick={handleSaveSearch}
            className="btn-tap"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              marginBottom: 12, padding: '8px 14px', borderRadius: 12,
              background: '#fff', border: '1.5px solid rgba(46,91,255,0.4)',
              color: '#2E5BFF', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}
          >
            <Bookmark size={15} />
            {tr('saveSearch', selectedLanguage)}
          </button>
        )}

        {/* ── Flash Sales ── */}
        {flashSales.length > 0 && (
          <div className="anim-fade-up" style={{ marginBottom: 16 }}>
            <SectionStrip
              gradient={['#C62828', '#E53935']}
              icon={<Zap size={16} />}
              title={tr('flashSalesEndingSoon', selectedLanguage)}
              href="/flash-sales"
              seeAllLabel={tr('seeAll', selectedLanguage)}
              sweep
            />
            <div style={{
              background: '#fff', borderRadius: '0 0 14px 14px',
              padding: '12px 12px',
              overflowX: 'auto', display: 'flex', gap: 10,
            }}
              className="no-scrollbar rail rail-stagger"
            >
              {flashSales.slice(0, 4).map((l) => (
                <FlashCard key={l.id} listing={l} onClick={() => goToListing(l.id)} selectedCurrency={selectedCurrency} distanceKm={distanceById.get(l.id)} verified={verifiedSellers.has(l.ownerUid)} />
              ))}
            </div>
          </div>
        )}

        {/* ── Trending in Country ── */}
        {trending.length > 0 && catalogSize >= REVEAL_TRENDING && (
          <div className="anim-fade-up" style={{ marginBottom: 16 }}>
            <SectionStrip
              gradient={['#E65100', '#FF6D00']}
              icon={<TrendingUp size={16} />}
              title={selectedCountry ? `${tr('trendingIn', selectedLanguage)} ${selectedCountry}` : tr('trendingNearYou', selectedLanguage)}
              subtitle={tr('hotNow', selectedLanguage)}
            />
            <div style={{
              background: '#fff', borderRadius: '0 0 14px 14px',
              padding: '12px 12px',
              overflowX: 'auto', display: 'flex', gap: 10,
            }}
              className="no-scrollbar rail rail-stagger"
            >
              {trending.slice(0, 10).map((l) => (
                <FeaturedCard key={l.id} listing={l} onClick={() => goToListing(l.id)} selectedCurrency={selectedCurrency} distanceKm={distanceById.get(l.id)} verified={verifiedSellers.has(l.ownerUid)} />
              ))}
            </div>
          </div>
        )}

        {/* ── Recently Viewed — local-only personal history ── */}
        {recentlyViewed.length > 0 && (
          <div className="anim-fade-up" style={{ marginBottom: 16 }}>
            <SectionStrip
              gradient={['#37474F', '#546E7A']}
              icon={<History size={16} />}
              title={tr('recentlyViewed', selectedLanguage)}
            />
            <div style={{
              background: '#fff', borderRadius: '0 0 14px 14px',
              padding: '12px 12px',
              overflowX: 'auto', display: 'flex', gap: 10, alignItems: 'stretch',
            }}
              className="no-scrollbar rail rail-stagger"
            >
              {recentlyViewed.map((l) => (
                <FeaturedCard key={l.id} listing={l} onClick={() => goToListing(l.id)} selectedCurrency={selectedCurrency} distanceKm={distanceById.get(l.id)} verified={verifiedSellers.has(l.ownerUid)} />
              ))}
              <button
                onClick={() => { clearRecentlyViewed(); setRecentlyViewed([]); }}
                style={{
                  flex: '0 0 auto', alignSelf: 'center', background: '#ECEFF1',
                  border: 'none', borderRadius: 12, color: '#546E7A',
                  fontWeight: 700, fontSize: 12, padding: '10px 14px',
                  cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                {tr('clearAction', selectedLanguage)}
              </button>
            </div>
          </div>
        )}

        {/* ── Hot Selling [Category] ── */}
        {hotSelling.length > 0 && catalogSize >= REVEAL_HOT_SELLING && (
          <div className="anim-fade-up" style={{ marginBottom: 16 }}>
            <SectionStrip
              gradient={['#AD1457', '#D81B60']}
              icon={<ShoppingBag size={16} />}
              title={hotCatTitle ? `${tr('hotSelling', selectedLanguage)} ${hotCatTitle}` : tr('hotSelling', selectedLanguage)}
              subtitle={tr('hotNow', selectedLanguage)}
            />
            <div style={{
              background: '#fff', borderRadius: '0 0 14px 14px',
              padding: '12px 12px',
              overflowX: 'auto', display: 'flex', gap: 10,
            }}
              className="no-scrollbar rail rail-stagger"
            >
              {hotSelling.map((l) => (
                <FeaturedCard key={l.id} listing={l} onClick={() => goToListing(l.id)} selectedCurrency={selectedCurrency} distanceKm={distanceById.get(l.id)} verified={verifiedSellers.has(l.ownerUid)} />
              ))}
            </div>
          </div>
        )}

        {/* ── Recommended For You ── */}
        {recommended.length > 0 && catalogSize >= REVEAL_RECOMMENDED && (
          <div className="anim-fade-up" style={{ marginBottom: 16 }}>
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
              className="no-scrollbar rail rail-stagger"
            >
              {recommended.map((l) => (
                <FeaturedCard key={l.id} listing={l} onClick={() => goToListing(l.id)} selectedCurrency={selectedCurrency} distanceKm={distanceById.get(l.id)} verified={verifiedSellers.has(l.ownerUid)} />
              ))}
            </div>
          </div>
        )}

        {/* ── Just In ── */}
        {justIn.length > 0 && (
          <div className="anim-fade-up" style={{ marginBottom: 16 }}>
            <SectionStrip
              gradient={['#00695C', '#00897B']}
              icon={<Sparkles size={16} />}
              title={tr('justIn', selectedLanguage)}
              subtitle={tr('newest', selectedLanguage)}
            />
            <div style={{
              background: '#fff', borderRadius: '0 0 14px 14px',
              padding: '12px 12px',
              overflowX: 'auto', display: 'flex', gap: 10,
            }}
              className="no-scrollbar rail rail-stagger"
            >
              {justIn.map((l) => (
                <FeaturedCard key={l.id} listing={l} onClick={() => goToListing(l.id)} selectedCurrency={selectedCurrency} distanceKm={distanceById.get(l.id)} verified={verifiedSellers.has(l.ownerUid)} />
              ))}
            </div>
          </div>
        )}

        {/* ── Top Rated ── */}
        {topRated.length > 0 && catalogSize >= REVEAL_TOP_RATED && (
          <div className="anim-fade-up" style={{ marginBottom: 16 }}>
            <SectionStrip
              gradient={['#B8860B', '#F6A609']}
              icon={<Award size={16} />}
              title={tr('topRated', selectedLanguage)}
              subtitle="4.5★+"
            />
            <div style={{
              background: '#fff', borderRadius: '0 0 14px 14px',
              padding: '12px 12px',
              overflowX: 'auto', display: 'flex', gap: 10,
            }}
              className="no-scrollbar rail rail-stagger"
            >
              {topRated.map((l) => (
                <FeaturedCard key={l.id} listing={l} onClick={() => goToListing(l.id)} selectedCurrency={selectedCurrency} distanceKm={distanceById.get(l.id)} verified={verifiedSellers.has(l.ownerUid)} />
              ))}
            </div>
          </div>
        )}

        {/* ── Happenings ── */}
        {happenings.length > 0 && (
          <div className="anim-fade-up" style={{ marginBottom: 16 }}>
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
              className="no-scrollbar rail rail-stagger"
            >
              {happenings.slice(0, 4).map((l) => (
                <FeaturedCard key={l.id} listing={l} onClick={() => goToListing(l.id)} selectedCurrency={selectedCurrency} distanceKm={distanceById.get(l.id)} verified={verifiedSellers.has(l.ownerUid)} />
              ))}
            </div>
          </div>
        )}

        {/* ── Sponsored ── */}
        {sponsored.length > 0 && (
          <div className="anim-fade-up" style={{ marginBottom: 16 }}>
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
              className="no-scrollbar rail rail-stagger"
            >
              {sponsored.slice(0, 4).map((l) => (
                <FeaturedCard key={l.id} listing={l} onClick={() => goToListing(l.id)} selectedCurrency={selectedCurrency} distanceKm={distanceById.get(l.id)} verified={verifiedSellers.has(l.ownerUid)} />
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

          {exploreLoading ? (
            <div className="explore-grid">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="anim-fade-up" style={{ borderRadius: 14, overflow: 'hidden', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', animationDelay: `${i * 0.08}s` }}>
                  <div className="skeleton" style={{ paddingTop: '83.33%' }} />
                  <div style={{ padding: '8px 10px 10px' }}>
                    <div className="skeleton" style={{ height: 13, borderRadius: 6, width: '80%' }} />
                    <div className="skeleton" style={{ height: 14, borderRadius: 6, width: '45%', marginTop: 6 }} />
                    <div className="skeleton" style={{ height: 11, borderRadius: 6, width: '65%', marginTop: 6 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : exploreItems.length === 0 ? (
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
              <div className="explore-grid">
                {exploreItems.slice(0, EXPLORE_MAX).map((l) => (
                  <GridCard key={l.id} listing={l} onClick={() => goToListing(l.id)} selectedCurrency={selectedCurrency} distanceKm={distanceById.get(l.id)} verified={verifiedSellers.has(l.ownerUid)} />
                ))}
              </div>

              {exploreHasMore && explore.length < EXPLORE_MAX && (
                <button
                  onClick={loadMoreExplore}
                  disabled={exploreLoadingMore}
                  className="btn-tap"
                  style={{
                    width: '100%', height: 46, borderRadius: 14, marginTop: 12,
                    background: '#fff', border: '1.5px solid #e2e8f0',
                    color: '#2E5BFF', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                    opacity: exploreLoadingMore ? 0.6 : 1,
                  }}
                >
                  {exploreLoadingMore ? tr('loading', selectedLanguage) : tr('loadMore', selectedLanguage)}
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
          onApply={(f) => setFilters(f)}
          onClose={() => setShowFilter(false)}
          lang={selectedLanguage}
        />
      )}

      <BottomNav />
    </div>
  );
}
