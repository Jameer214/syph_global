'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, MapPin, Clock, Calendar, Phone, Navigation, Package, Zap, Award, Flame } from 'lucide-react';
import { onSnapshot, doc, collection, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/store';
import { tr, getDir } from '@/lib/i18n';
import { formatConverted, getCurrencySymbol } from '@/lib/currency';
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
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function parseShopData(d: Record<string, unknown>): ShopData {
  return {
    businessName: String(d.businessName ?? ''),
    contact: String(d.contactNumber ?? d.businessPhone ?? ''),
    country: String(d.country ?? d.operatingCountry ?? ''),
    region: String(d.region ?? d.operatingRegion ?? ''),
    description: String(d.description ?? d.bio ?? ''),
    isServiceProvider: Boolean(d.isServiceProvider),
    open24Hours: Boolean(d.open24Hours),
    openingTime: String(d.openingTime ?? ''),
    closingTime: String(d.closingTime ?? ''),
    workingDays: Array.isArray(d.workingDays) ? (d.workingDays as number[]) : [],
    locationAddress: String(d.businessLocationAddress ?? d.businessLocationText ?? ''),
    lat: typeof d.businessLatitude === 'number' ? d.businessLatitude : null,
    lng: typeof d.businessLongitude === 'number' ? d.businessLongitude : null,
    isVerified: Boolean(d.isVerified),
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

function hoursLabel(shop: ShopData): string {
  if (shop.open24Hours) return 'Open 24 hours';
  const open = shop.openingTime.trim();
  const close = shop.closingTime.trim();
  if (open && close) return `${open} - ${close}`;
  if (open) return `Opens at ${open}`;
  if (close) return `Closes at ${close}`;
  return 'Hours not set';
}

function daysLabel(days: number[]): string {
  if (!days.length) return 'All week';
  return [...days].sort().map((i) => DAY_LABELS[Math.min(i, 6)]).join(' · ');
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
  function displayPrice(l: Listing): string {
    if (l.priceText?.trim()) return l.priceText.trim();
    if (l.priceValue != null) {
      if (selectedCurrency && selectedCurrency !== l.currencyCode) {
        return `≈ ${formatConverted(l.priceValue, l.currencyCode, selectedCurrency)}`;
      }
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
          <Image src={listing.imageUrl} alt={listing.title} fill style={{ objectFit: 'cover' }} unoptimized />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Package size={28} color="#BCC8D8" />
          </div>
        )}
        {listing.isSponsored && (
          <div style={{ position: 'absolute', top: 8, left: 8, background: '#2F6BFF', borderRadius: 8, padding: '3px 8px', fontSize: 10, fontWeight: 900, color: '#fff' }}>Sponsored</div>
        )}
        {listing.isFlashSale && (
          <div style={{ position: 'absolute', top: 8, right: 8, background: '#E53935', borderRadius: 8, padding: '3px 8px', fontSize: 10, fontWeight: 900, color: '#fff' }}>Flash</div>
        )}
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
    if (l.priceText?.trim()) return l.priceText.trim();
    if (l.priceValue != null) {
      if (selectedCurrency && selectedCurrency !== l.currencyCode) {
        return `≈ ${formatConverted(l.priceValue, l.currencyCode, selectedCurrency)}`;
      }
      return `${getCurrencySymbol(l.currencyCode)}${l.priceValue.toLocaleString()}`;
    }
    return '';
  }

  const price = displayPrice(listing);

  return (
    <button onClick={onClick} style={{ background: '#fff', borderRadius: 18, border: '1px solid rgba(0,0,0,0.06)', overflow: 'hidden', display: 'flex', gap: 0, width: '100%', marginBottom: 12, textAlign: 'left', cursor: 'pointer', padding: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      <div style={{ width: 90, minHeight: 90, position: 'relative', background: '#EEF2FB', flexShrink: 0 }}>
        {listing.imageUrl ? (
          <Image src={listing.imageUrl} alt={listing.title} fill style={{ objectFit: 'cover' }} unoptimized />
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

  const [shop, setShop] = useState<ShopData | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loadingSeller, setLoadingSeller] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  // Real-time seller profile
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, 'sellers', uid), (snap) => {
      if (snap.exists()) setShop(parseShopData(snap.data() as Record<string, unknown>));
      setLoadingSeller(false);
    }, () => setLoadingSeller(false));
    return unsub;
  }, [uid]);

  // Subscribe to seller listings (real-time, matching Flutter stream)
  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, 'listings'),
      where('ownerUid', '==', uid),
      where('status', '==', 'approved'),
      orderBy('updatedAt', 'desc'),
    );
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
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
          rating: typeof data.rating === 'number' ? data.rating : undefined,
          condition: data.condition ? String(data.condition) : undefined,
          openNow: Boolean(data.openNow),
          isSponsored: Boolean(data.isSponsored),
          isHappening: Boolean(data.isHappening),
          isFlashSale: Boolean(data.isFlashSale),
          isTrial: Boolean(data.isTrial),
          status: String(data.status ?? 'approved'),
          viewsCount: typeof data.viewsCount === 'number' ? data.viewsCount : 0,
          savesCount: typeof data.savesCount === 'number' ? data.savesCount : 0,
          messagesCount: typeof data.messagesCount === 'number' ? data.messagesCount : 0,
        } as Listing;
      });
      setListings(items);
    }, () => {});
    return unsub;
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
              <div style={{ width: 72, height: 72, background: 'rgba(255,255,255,0.18)', borderRadius: 22, border: '1.5px solid rgba(255,255,255,0.30)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {shop?.isServiceProvider ? (
                  <span style={{ fontSize: 28 }}>🛠️</span>
                ) : (
                  <span style={{ color: '#fff', fontWeight: 900, fontSize: 28 }}>{initial}</span>
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Badges */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  <span style={{ background: 'rgba(255,255,255,0.20)', borderRadius: 999, padding: '5px 10px', fontSize: 11, fontWeight: 900, color: '#fff' }}>
                    {shop?.isServiceProvider ? 'Service Provider' : 'Seller'}
                  </span>
                  {shop?.open24Hours && (
                    <span style={{ background: 'rgba(0,193,118,0.90)', borderRadius: 999, padding: '5px 10px', fontSize: 11, fontWeight: 900, color: '#fff' }}>Open 24/7</span>
                  )}
                  {!shop?.open24Hours && hasHours && (
                    <span style={{ background: sellerIsOpen ? 'rgba(0,193,118,0.90)' : 'rgba(229,57,53,0.85)', borderRadius: 999, padding: '5px 10px', fontSize: 11, fontWeight: 900, color: '#fff' }}>
                      {sellerIsOpen ? tr('openNow', selectedLanguage) : 'Closed'}
                    </span>
                  )}
                </div>

                {/* Name + verified */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ color: '#fff', fontWeight: 900, fontSize: 20, lineHeight: 1.2 }}>{sellerName}</span>
                  {shop?.isVerified && <span style={{ fontSize: 18 }}>✓</span>}
                </div>

                {/* Location */}
                {loc && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, marginTop: 5 }}>
                    <MapPin size={13} color="rgba(255,255,255,0.6)" style={{ marginTop: 1, flexShrink: 0 }} />
                    <span style={{ color: 'rgba(255,255,255,0.70)', fontWeight: 600, fontSize: 12.5, lineHeight: 1.4 }}>{loc}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Hours */}
            {shop && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={13} color="rgba(255,255,255,0.6)" />
                  <span style={{ color: 'rgba(255,255,255,0.70)', fontWeight: 700, fontSize: 13 }}>{hoursLabel(shop)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Calendar size={12} color="rgba(255,255,255,0.6)" />
                  <span style={{ color: 'rgba(255,255,255,0.60)', fontWeight: 600, fontSize: 12 }}>{daysLabel(shop.workingDays)}</span>
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
                {shop?.description?.trim() ||
                  `${sellerName} is active on SYPH with ${items.length} item(s), ${happenings.length} happening(s), and ${flashSales.length} flash sale(s) currently visible to users.`}
              </p>
              {[
                { icon: <Phone size={17} />, label: tr('contactSeller', selectedLanguage), value: shop?.contact || 'Not published' },
                { icon: <Clock size={17} />, label: 'Business hours', value: shop ? hoursLabel(shop) : 'Not set' },
                { icon: <Calendar size={17} />, label: 'Working days', value: daysLabel(shop?.workingDays ?? []) },
                { icon: <Package size={17} />, label: 'Type', value: shop?.isServiceProvider ? 'Service Provider' : 'Seller' },
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
                {loc || 'Location not published'}
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
