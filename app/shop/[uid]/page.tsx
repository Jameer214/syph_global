'use client';
import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, MapPin, Clock, Calendar, Phone, Navigation, Package, Zap, Award, Flame, Truck } from 'lucide-react';
import { sanitizeText } from '@/lib/sanitize';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store';
import { tr, getDir } from '@/lib/i18n';
import { formatConverted, getCurrencySymbol } from '@/lib/currency';
import { isPast } from '@/lib/promo';
import DistanceChip from '@/components/DistanceChip';
import ZigzagEdge from '@/components/ZigzagEdge';
import { useDistances } from '@/lib/useDistances';
import type { Listing } from '@/types';

interface ShopData {
  businessName: string;
  contact: string;
  country: string;
  region: string;
  description: string;
  isServiceProvider: boolean;
  open24Hours: boolean;
  openingTime: string;
  closingTime: string;
  workingDays: number[];
  locationAddress: string;
  lat: number | null;
  lng: number | null;
  isVerified: boolean;
  delivers: boolean;
}


function parseShopData(d: Record<string, unknown>): ShopData {
  return {
    businessName: String(d.shop_name ?? d.business_name ?? d.businessName ?? ''),
    contact: String(d.phone ?? d.contact_number ?? d.contactNumber ?? d.businessPhone ?? ''),
    country: String(d.country ?? d.operatingCountry ?? ''),
    region: String(d.region ?? d.operatingRegion ?? ''),
    description: String(d.shop_description ?? d.description ?? d.bio ?? ''),
    isServiceProvider: Boolean(d.is_service_provider ?? d.isServiceProvider),
    open24Hours: Boolean(d.open_24_hours ?? d.open24Hours),
    openingTime: String(d.opening_time ?? d.openingTime ?? ''),
    closingTime: String(d.closing_time ?? d.closingTime ?? ''),
    workingDays: Array.isArray(d.working_days ?? d.workingDays) ? ((d.working_days ?? d.workingDays) as number[]) : [],
    locationAddress: String(d.business_location_address ?? d.businessLocationAddress ?? d.businessLocationText ?? ''),
    lat: typeof d.business_latitude === 'number' ? d.business_latitude : typeof d.businessLatitude === 'number' ? d.businessLatitude : null,
    lng: typeof d.business_longitude === 'number' ? d.business_longitude : typeof d.businessLongitude === 'number' ? d.businessLongitude : null,
    isVerified: Boolean(d.is_verified ?? d.isVerified),
    delivers: Boolean(d.delivers),
  };
}

function isOpen(shop: ShopData): boolean {
  const today = (new Date().getDay() + 6) % 7; // JS 0=Sun → 0=Mon
  if (shop.workingDays.length > 0 && !shop.workingDays.includes(today)) return false;
  if (shop.open24Hours) return true;
  const open = shop.openingTime.trim();
  const close = shop.closingTime.trim();
  if (!open || !close) return false;
  const [oh, om] = open.split(':').map(Number);
  const [ch, cm] = close.split(':').map(Number);
  const now = new Date();
  const nowM = now.getHours() * 60 + now.getMinutes();
  const openM = oh * 60 + om;
  const closeM = ch * 60 + cm;
  return closeM > openM ? nowM >= openM && nowM < closeM : nowM >= openM || nowM < closeM;
}

const DAY_KEYS = ['dayMon', 'dayTue', 'dayWed', 'dayThu', 'dayFri', 'daySat', 'daySun'];

function hoursLabel(shop: ShopData, lang: string): string {
  if (shop.open24Hours) return tr('open24HoursLabel', lang);
  const open = shop.openingTime.trim();
  const close = shop.closingTime.trim();
  if (open && close) return `${open} - ${close}`;
  if (open) return `${tr('opensAt', lang)} ${open}`;
  if (close) return `${tr('closesAt', lang)} ${close}`;
  return tr('hoursNotSet', lang);
}

function daysLabel(days: number[], lang: string): string {
  if (!days.length) return tr('allWeek', lang);
  return [...days].sort().map((i) => tr(DAY_KEYS[Math.min(i, 6)], lang)).join(' · ');
}

function locationLabel(shop: ShopData, listings: Listing[]): string {
  if (shop.locationAddress) return shop.locationAddress;
  if (shop.region && shop.country) return `${shop.region}, ${shop.country}`;
  if (shop.country) return shop.country;
  if (listings.length) return listings[0].locationText;
  return '';
}

function openMaps(location: string, lat: number | null, lng: number | null) {
  if (!location && lat === null) return;
  const url = lat !== null && lng !== null
    ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location)}`;
  window.open(url, '_blank');
}

// ── Item card ──────────────────────────────────────────────────────────────────

function ItemCard({ listing, onClick, selectedCurrency }: { listing: Listing; onClick: () => void; selectedCurrency: string }) {
  const { selectedLanguage } = useAppStore();
  function displayPrice(l: Listing): string {
    if (l.priceValue != null && selectedCurrency && selectedCurrency !== l.currencyCode) {
      return `≈ ${formatConverted(l.priceValue, l.currencyCode, selectedCurrency)}`;
    }
    if (l.priceText?.trim()) return l.priceText.trim();
    if (l.priceValue != null) {
      return `${getCurrencySymbol(l.currencyCode)}${l.priceValue.toLocaleString()}`;
    }
    return 'Price not set';
  }

  function displayOriginalPrice(l: Listing): string | null {
    if (l.originalPriceText?.trim()) return l.originalPriceText.trim();
    if (l.originalPriceValue != null) {
      if (selectedCurrency && selectedCurrency !== l.currencyCode) {
        return `≈ ${formatConverted(l.originalPriceValue, l.currencyCode, selectedCurrency)}`;
      }
      return `${getCurrencySymbol(l.currencyCode)}${l.originalPriceValue.toLocaleString()}`;
    }
    return null;
  }

  const originalPrice = listing.isFlashSale ? displayOriginalPrice(listing) : null;
  const priceColor = listing.isFlashSale ? '#E53935' : '#2F6BFF';

  return (
    <button onClick={onClick} style={{ background: '#fff', borderRadius: 18, border: '1px solid rgba(0,0,0,0.06)', overflow: 'hidden', textAlign: 'left', cursor: 'pointer', width: '100%', padding: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      <div style={{ width: '100%', aspectRatio: '4/3', position: 'relative', background: '#EEF2FB' }}>
        {listing.imageUrl ? (
          <Image src={listing.imageUrl} alt={listing.title} fill style={{ objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Package size={28} color="#BCC8D8" />
          </div>
        )}
        {listing.isSponsored && (
          <div style={{ position: 'absolute', top: 8, left: 8, background: '#2F6BFF', borderRadius: 8, padding: '3px 8px', fontSize: 10, fontWeight: 900, color: '#fff' }}>{tr('sponsored', selectedLanguage)}</div>
        )}
        {listing.isFlashSale && (
          <div style={{ position: 'absolute', top: 8, right: 8, background: '#E53935', borderRadius: 8, padding: '3px 8px', fontSize: 10, fontWeight: 900, color: '#fff' }}>{tr('flashWord', selectedLanguage)}</div>
        )}
        <ZigzagEdge color="#fff" />
      </div>
      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontWeight: 800, fontSize: 13, color: '#182033', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{listing.title}</div>
        {originalPrice && (
          <div style={{ fontWeight: 600, fontSize: 10.5, color: '#9AA0B2', textDecoration: 'line-through', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{originalPrice}</div>
        )}
        <div style={{ fontWeight: 900, fontSize: 13, color: priceColor, marginTop: originalPrice ? 1 : 4 }}>{displayPrice(listing)}</div>
        <div style={{ fontWeight: 600, fontSize: 11, color: '#9AA0B2', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{listing.locationText}</div>
      </div>
    </button>
  );
}

// ── Happening card ─────────────────────────────────────────────────────────────

function HappeningCard({ listing, onClick, selectedCurrency }: { listing: Listing; onClick: () => void; selectedCurrency: string }) {
  function displayPrice(l: Listing): string {
    if (l.priceValue != null && selectedCurrency && selectedCurrency !== l.currencyCode) {
      return `≈ ${formatConverted(l.priceValue, l.currencyCode, selectedCurrency)}`;
    }
    if (l.priceText?.trim()) return l.priceText.trim();
    if (l.priceValue != null) {
      return `${getCurrencySymbol(l.currencyCode)}${l.priceValue.toLocaleString()}`;
    }
    return '';
  }

  const price = displayPrice(listing);

  return (
    <button onClick={onClick} style={{ background: '#fff', borderRadius: 18, border: '1px solid rgba(0,0,0,0.06)', overflow: 'hidden', display: 'flex', gap: 0, width: '100%', marginBottom: 12, textAlign: 'left', cursor: 'pointer', padding: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      <div style={{ width: 90, minHeight: 90, position: 'relative', background: '#EEF2FB', flexShrink: 0 }}>
        {listing.imageUrl ? (
          <Image src={listing.imageUrl} alt={listing.title} fill style={{ objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Calendar size={24} color="#BCC8D8" />
          </div>
        )}
      </div>
      <div style={{ flex: 1, padding: 14, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: '#182033', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{listing.title}</div>
        {price && <div style={{ fontWeight: 900, fontSize: 13, color: '#7C3AED' }}>{price}</div>}
        <div style={{ fontWeight: 600, fontSize: 12, color: '#9AA0B2' }}>{listing.locationText}</div>
      </div>
    </button>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({ icon, count, label, color }: { icon: React.ReactNode; count: number; label: string; color: string }) {
  return (
    <div style={{ flex: 1, background: '#fff', borderRadius: 20, border: '1px solid rgba(0,0,0,0.05)', padding: '14px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 38, height: 38, background: `${color}1A`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>{icon}</div>
      <div style={{ fontWeight: 900, fontSize: 18, color }}>{count}</div>
      <div style={{ fontWeight: 700, fontSize: 11, color: '#9AA0B2', textAlign: 'center', lineHeight: 1.3 }}>{label}</div>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px', gap: 12 }}>
      <div style={{ width: 64, height: 64, background: '#EEF2FB', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#BCC8D8' }}>{icon}</div>
      <div style={{ fontWeight: 900, fontSize: 15, color: '#182033', textAlign: 'center' }}>{title}</div>
      <div style={{ fontWeight: 600, fontSize: 13, color: '#9AA0B2', textAlign: 'center', lineHeight: 1.5 }}>{subtitle}</div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function SellerShopPage() {
  const { uid } = useParams() as { uid: string };
  const router = useRouter();
  const { selectedCurrency, selectedLanguage } = useAppStore();
  // One "how far away" chip for the whole shop (single seller).
  const shopKm = useDistances(useMemo(() => [{ id: uid, ownerUid: uid }], [uid])).get(uid);

  const [shop, setShop] = useState<ShopData | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loadingSeller, setLoadingSeller] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  // Load seller profile
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    (async () => {
      const [{ data }, { data: profileData }] = await Promise.all([
        supabase.from('sellers').select('*').eq('user_id', uid).single(),
        // get_public_profile RPC (id/full_name/avatar_url only) so the avatar
        // shows for logged-out visitors — the profiles SELECT policy requires
        // a signed-in user, which would blank it for guests.
        supabase.rpc('get_public_profile', { p_uid: uid }),
      ]);
      if (!cancelled) {
        if (data) setShop(parseShopData(data as Record<string, unknown>));
        const prof = Array.isArray(profileData) ? profileData[0] : profileData;
        if (prof) setPhotoUrl((prof as Record<string, unknown>).avatar_url as string | null);
        setLoadingSeller(false);
      }
    })();
    return () => { cancelled = true; };
  }, [uid]);

  // Load seller listings
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    (async () => {
      // listings.seller_id is the seller's auth user_id (== the route uid),
      // NOT the sellers-table PK. Joining on sellers.id returned zero rows,
      // which is why the shop showed none of the seller's listings.
      const { data } = await supabase.from('listings')
        .select('*, listing_images(url, sort_order)')
        .eq('seller_id', uid)
        .eq('status', 'active')
        .order('updated_at', { ascending: false });
      if (cancelled) return;
      if (!cancelled && data) {
        const items: Listing[] = data.map((row) => {
          const r = row as Record<string, unknown>;
          const imgs = Array.isArray(r.listing_images) ? (r.listing_images as { url: string }[]) : [];
          return {
            id: String(r.id ?? ''),
            title: String(r.title ?? ''),
            description: String(r.description ?? ''),
            imageUrl: imgs[0]?.url ?? String(r.image_url ?? ''),
            sellerName: String(r.seller_name ?? ''),
            ownerUid: uid,
            country: String(r.country ?? ''),
            regionOrCity: String(r.region ?? ''),
            locationText: String(r.location_text ?? ''),
            priceText: r.price_text ? String(r.price_text) : undefined,
            priceValue: typeof r.price === 'number' ? r.price : undefined,
            currencyCode: String(r.currency ?? 'USD'),
            negotiable: Boolean(r.is_negotiable),
            mainCategoryId: String(r.category_id ?? ''),
            rating: typeof r.rating === 'number' ? r.rating : undefined,
            condition: r.condition ? String(r.condition) : undefined,
            openNow: false,
            isSponsored: Boolean(r.is_sponsored) && !isPast(r.sponsored_until),
            isHappening: false,
            isFlashSale: Boolean(r.is_flash_sale) && !isPast(r.flash_sale_until),
            isTrial: false,
            status: String(r.status ?? 'active'),
            viewsCount: typeof r.view_count === 'number' ? r.view_count : 0,
            savesCount: typeof r.save_count === 'number' ? r.save_count : 0,
            messagesCount: 0,
          } as Listing;
        });
        setListings(items);
      }
    })();
    return () => { cancelled = true; };
  }, [uid]);

  if (loadingSeller) {
    return (
      <div dir={getDir(selectedLanguage)} style={{ minHeight: '100dvh', background: '#F0F4FA', maxWidth: 480, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 36, height: 36, border: '3px solid #E8EDFF', borderTop: '3px solid #2F6BFF', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  const items = listings.filter((l) => !l.isHappening && !l.isFlashSale);
  const happenings = listings.filter((l) => l.isHappening);
  const flashSales = listings.filter((l) => l.isFlashSale);
  const sponsoredCount = listings.filter((l) => l.isSponsored).length;

  const sellerName = shop?.businessName?.trim() || (listings[0]?.sellerName ?? 'Seller Shop');
  const initial = sellerName[0]?.toUpperCase() ?? '?';
  const loc = shop ? locationLabel(shop, listings) : '';
  const sellerIsOpen = shop ? isOpen(shop) : false;
  const hasHours = shop && (shop.open24Hours || shop.openingTime || shop.closingTime);

  const TABS = [
    `Items${items.length ? ` (${items.length})` : ''}`,
    `Events${happenings.length ? ` (${happenings.length})` : ''}`,
    `Flash${flashSales.length ? ` (${flashSales.length})` : ''}`,
    'About',
  ];

  return (
    <div dir={getDir(selectedLanguage)} style={{ minHeight: '100dvh', background: '#F0F4FA', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* App bar */}
      <div style={{ background: 'linear-gradient(135deg, #0F2B6E, #1E4DD9)', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', padding: 4 }}>
          <ArrowLeft size={22} />
        </button>
        <span style={{ color: '#fff', fontWeight: 900, fontSize: 17 }}>{tr('viewShop', selectedLanguage)}</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 32px' }}>

        {/* Hero card */}
        <div style={{ background: 'linear-gradient(135deg, #1A42BB, #2E67F5)', borderRadius: 28, boxShadow: '0 12px 24px rgba(36,83,212,0.28)', overflow: 'hidden', position: 'relative', marginBottom: 14 }}>
          {/* Decorative circles */}
          <div style={{ position: 'absolute', right: -40, top: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', left: -24, bottom: -30, width: 130, height: 130, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />

          <div style={{ padding: 20, position: 'relative' }}>
            {/* Top row: avatar + name */}
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 14 }}>
              {/* Avatar */}
              <div style={{ width: 72, height: 72, background: 'rgba(255,255,255,0.18)', borderRadius: 22, border: '1.5px solid rgba(255,255,255,0.30)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                {photoUrl ? (
                  <Image src={photoUrl} alt={sellerName} width={72} height={72} style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
                ) : shop?.isServiceProvider ? (
                  <span style={{ fontSize: 28 }}>🛠️</span>
                ) : (
                  <span style={{ color: '#fff', fontWeight: 900, fontSize: 28 }}>{initial}</span>
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Badges */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  <span style={{ background: 'rgba(255,255,255,0.20)', borderRadius: 999, padding: '5px 10px', fontSize: 11, fontWeight: 900, color: '#fff' }}>
                    {shop?.isServiceProvider ? tr('serviceProvider', selectedLanguage) : tr('seller', selectedLanguage)}
                  </span>
                  {shop?.open24Hours && (
                    <span style={{ background: 'rgba(0,193,118,0.90)', borderRadius: 999, padding: '5px 10px', fontSize: 11, fontWeight: 900, color: '#fff' }}>{tr('open247', selectedLanguage)}</span>
                  )}
                  {!shop?.open24Hours && hasHours && (
                    <span style={{ background: sellerIsOpen ? 'rgba(0,193,118,0.90)' : 'rgba(229,57,53,0.85)', borderRadius: 999, padding: '5px 10px', fontSize: 11, fontWeight: 900, color: '#fff' }}>
                      {sellerIsOpen ? tr('openNow', selectedLanguage) : tr('closed', selectedLanguage)}
                    </span>
                  )}
                </div>

                {/* Name + verified */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ color: '#fff', fontWeight: 900, fontSize: 20, lineHeight: 1.2 }}>{sanitizeText(sellerName)}</span>
                  {shop?.isVerified && (
                    <svg width="18" height="18" viewBox="0 0 24 24" aria-label="Verified" style={{ flexShrink: 0 }}>
                      <path fill="#E53935" d="M23 12l-2.44-2.78.34-3.68-3.61-.82-1.89-3.18L12 3 8.6 1.54 6.71 4.72l-3.61.81.34 3.68L1 12l2.44 2.78-.34 3.69 3.61.82 1.89 3.18L12 21l3.4 1.46 1.89-3.18 3.61-.82-.34-3.68z" />
                      <path fill="#fff" d="M10.09 16.72l-3.8-3.81 1.48-1.48 2.32 2.33 5.85-5.87 1.48 1.48z" />
                    </svg>
                  )}
                  {shop?.delivers && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(27,138,75,0.9)', color: '#fff', fontWeight: 800, fontSize: 11, borderRadius: 999, padding: '3px 8px', flexShrink: 0 }}>
                      <Truck size={12} /> {tr('deliversChip', selectedLanguage)}
                    </span>
                  )}
                </div>

                {/* Location */}
                {loc && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, marginTop: 5 }}>
                    <MapPin size={13} color="rgba(255,255,255,0.6)" style={{ marginTop: 1, flexShrink: 0 }} />
                    <span style={{ color: 'rgba(255,255,255,0.70)', fontWeight: 600, fontSize: 12.5, lineHeight: 1.4 }}>{sanitizeText(loc)}</span>
                  </div>
                )}
                {shopKm != null && (
                  <div style={{ marginTop: 6 }}><DistanceChip km={shopKm} /></div>
                )}
              </div>
            </div>

            {/* Hours */}
            {shop && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={13} color="rgba(255,255,255,0.6)" />
                  <span style={{ color: 'rgba(255,255,255,0.70)', fontWeight: 700, fontSize: 13 }}>{hoursLabel(shop, selectedLanguage)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Calendar size={12} color="rgba(255,255,255,0.6)" />
                  <span style={{ color: 'rgba(255,255,255,0.60)', fontWeight: 600, fontSize: 12 }}>{daysLabel(shop.workingDays, selectedLanguage)}</span>
                </div>
              </div>
            )}

            {/* Count chips */}
            {(items.length > 0 || happenings.length > 0 || sponsoredCount > 0 || flashSales.length > 0) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {items.length > 0 && <span style={{ background: 'rgba(255,255,255,0.16)', borderRadius: 999, padding: '8px 12px', fontSize: 12, fontWeight: 800, color: '#fff' }}>{items.length} Items</span>}
                {happenings.length > 0 && <span style={{ background: 'rgba(255,255,255,0.16)', borderRadius: 999, padding: '8px 12px', fontSize: 12, fontWeight: 800, color: '#fff' }}>{happenings.length} Events</span>}
                {sponsoredCount > 0 && <span style={{ background: 'rgba(255,255,255,0.16)', borderRadius: 999, padding: '8px 12px', fontSize: 12, fontWeight: 800, color: '#fff' }}>{sponsoredCount} Sponsored</span>}
                {flashSales.length > 0 && <span style={{ background: 'rgba(255,255,255,0.16)', borderRadius: 999, padding: '8px 12px', fontSize: 12, fontWeight: 800, color: '#fff' }}>{flashSales.length} Flash Sales</span>}
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => loc && openMaps(loc, shop?.lat ?? null, shop?.lng ?? null)}
                disabled={!loc}
                style={{ flex: 1, background: '#fff', border: 'none', borderRadius: 16, padding: '13px 8px', color: '#1A42BB', fontWeight: 900, fontSize: 13.5, cursor: loc ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: loc ? 1 : 0.5 }}
              >
                <Navigation size={17} />
                Directions
              </button>
              <button
                onClick={() => shop?.contact && (window.location.href = `tel:${shop.contact}`)}
                disabled={!shop?.contact}
                style={{ flex: 1, background: 'transparent', border: '1.5px solid rgba(255,255,255,0.50)', borderRadius: 16, padding: '13px 8px', color: '#fff', fontWeight: 900, fontSize: 13.5, cursor: shop?.contact ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: shop?.contact ? 1 : 0.5 }}
              >
                <Phone size={17} />
                Call
              </button>
            </div>
          </div>
        </div>

        {/* Quick stats row */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <StatCard icon={<Package size={20} />} count={items.length} label={tr('activeListings', selectedLanguage)} color="#2E67F5" />
          <StatCard icon={<Zap size={20} />} count={happenings.length} label={tr('happenings', selectedLanguage)} color="#7C3AED" />
          <StatCard icon={<Award size={20} />} count={sponsoredCount} label={tr('sponsored', selectedLanguage)} color="#F59E0B" />
          <StatCard icon={<Flame size={20} />} count={flashSales.length} label={tr('flashSales', selectedLanguage)} color="#E53935" />
        </div>

        {/* Tab bar */}
        <div style={{ background: '#fff', borderRadius: 18, border: '1px solid rgba(0,0,0,0.05)', padding: 6, display: 'flex', gap: 4, marginBottom: 14 }}>
          {TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              style={{ flex: 1, padding: '9px 4px', borderRadius: 14, border: 'none', background: activeTab === i ? '#2F6BFF' : 'transparent', color: activeTab === i ? '#fff' : '#1D3D8F', fontWeight: 900, fontSize: 12, cursor: 'pointer' }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 0 && (
          items.length === 0 ? (
            <EmptyState icon={<Package size={28} />} title={tr('noListingsYet', selectedLanguage)} subtitle="This seller hasn't listed any items yet." />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {items.map((l) => <ItemCard key={l.id} listing={l} onClick={() => router.push(`/listing/${l.id}`)} selectedCurrency={selectedCurrency} />)}
            </div>
          )
        )}

        {activeTab === 1 && (
          happenings.length === 0 ? (
            <EmptyState icon={<Calendar size={28} />} title={tr('noListingsYet', selectedLanguage)} subtitle="This seller has no happenings listed." />
          ) : (
            <div>{happenings.map((l) => <HappeningCard key={l.id} listing={l} onClick={() => router.push(`/listing/${l.id}`)} selectedCurrency={selectedCurrency} />)}</div>
          )
        )}

        {activeTab === 2 && (
          flashSales.length === 0 ? (
            <EmptyState icon={<Flame size={28} />} title={tr('noListingsYet', selectedLanguage)} subtitle="This seller has no active flash sales." />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {flashSales.map((l) => <ItemCard key={l.id} listing={l} onClick={() => router.push(`/listing/${l.id}`)} selectedCurrency={selectedCurrency} />)}
            </div>
          )
        )}

        {activeTab === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* About card */}
            <div style={{ background: '#fff', borderRadius: 22, border: '1px solid rgba(0,0,0,0.05)', padding: 16 }}>
              <div style={{ fontWeight: 900, fontSize: 16, color: '#1D3D8F', marginBottom: 10 }}>{tr('viewShop', selectedLanguage)}</div>
              <p style={{ fontWeight: 600, fontSize: 14, color: 'rgba(0,0,0,0.8)', lineHeight: 1.5, margin: 0, marginBottom: 14 }}>
                {sanitizeText(shop?.description) ||
                  `${sanitizeText(sellerName)} is active on SYPH with ${items.length} item(s), ${happenings.length} happening(s), and ${flashSales.length} flash sale(s) currently visible to users.`}
              </p>
              {[
                { icon: <Phone size={17} />, label: tr('contactSeller', selectedLanguage), value: shop?.contact || tr('notPublished', selectedLanguage) },
                { icon: <Clock size={17} />, label: tr('businessHours', selectedLanguage), value: shop ? hoursLabel(shop, selectedLanguage) : tr('notSet', selectedLanguage) },
                { icon: <Calendar size={17} />, label: tr('workingDaysLabel', selectedLanguage), value: daysLabel(shop?.workingDays ?? [], selectedLanguage) },
                { icon: <Package size={17} />, label: tr('typeWord', selectedLanguage), value: shop?.isServiceProvider ? tr('serviceProvider', selectedLanguage) : tr('seller', selectedLanguage) },
              ].map(({ icon, label, value }) => (
                <div key={label} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ color: '#2F6BFF', marginTop: 1, flexShrink: 0 }}>{icon}</div>
                  <div>
                    <span style={{ fontWeight: 900, color: '#1D3D8F', fontSize: 13.5 }}>{label}: </span>
                    <span style={{ fontWeight: 600, color: 'rgba(0,0,0,0.8)', fontSize: 13.5 }}>{value}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Location card */}
            <div style={{ background: '#fff', borderRadius: 22, border: '1px solid rgba(0,0,0,0.05)', padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <MapPin size={18} color="#2F6BFF" />
                <span style={{ fontWeight: 900, fontSize: 16, color: '#1D3D8F' }}>{tr('location', selectedLanguage)}</span>
              </div>
              <p style={{ fontWeight: 600, fontSize: 14, color: loc ? 'rgba(0,0,0,0.8)' : '#9AA0B2', lineHeight: 1.45, margin: 0, marginBottom: loc ? 14 : 0 }}>
                {loc || tr('locationNotPublished', selectedLanguage)}
              </p>
              {shop?.lat && shop?.lng && (
                <p style={{ fontWeight: 700, fontSize: 12, color: '#9AA0B2', margin: '4px 0 14px' }}>
                  {shop.lat.toFixed(6)}, {shop.lng.toFixed(6)}
                </p>
              )}
              {loc && (
                <button
                  onClick={() => openMaps(loc, shop?.lat ?? null, shop?.lng ?? null)}
                  style={{ width: '100%', padding: '13px 16px', background: 'transparent', border: '1.5px solid #2F6BFF', borderRadius: 16, color: '#2F6BFF', fontWeight: 900, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  <Navigation size={17} />
                  Get Directions on Maps
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
