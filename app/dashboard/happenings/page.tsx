'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Camera, X, ChevronDown, MapPin, Plus, Video, ImageIcon, PartyPopper, Link2, CreditCard, Info, CalendarDays, CalendarCheck, CalendarClock } from 'lucide-react';
import toast from 'react-hot-toast';
import { sanitizeText } from '@/lib/sanitize';
import { supabase } from '@/lib/supabase';
import { createHappening, getSellerProfile, uploadListingImages } from '@/lib/firestore';
import { getCurrencyForCountry, convertPrice } from '@/lib/currency';
import { getPromoPricing, getSellerPrivilegePercent, type DayPriceMap } from '@/lib/adminSettings';
import { CATEGORIES } from '@/data/categories';
import { useAppStore } from '@/store';
import { translate as tr, trCategory } from '@/lib/i18n';
import type { Listing, SellerProfile } from '@/types';

function mapListing(data: Record<string, unknown>, id: string): Listing {
  return {
    id, title: String(data.title ?? ''), description: String(data.description ?? ''),
    imageUrl: String(data.image_url ?? ''),
    imageUrls: undefined,
    sellerName: String(data.seller_name ?? ''), ownerUid: String(data.user_id ?? data.seller_id ?? ''),
    country: String(data.country ?? ''), regionOrCity: String(data.region ?? ''),
    locationText: String(data.location ?? data.location_text ?? ''),
    priceText: (data.price_text ?? data.priceText) ? String(data.price_text ?? data.priceText) : undefined,
    priceValue: typeof data.price === 'number' ? data.price : undefined,
    currencyCode: String(data.currency ?? 'USD'),
    negotiable: false, mainCategoryId: String(data.category_id ?? ''),
    openNow: false, isSponsored: false,
    isHappening: true, isFlashSale: false,
    isTrial: false, status: String(data.status ?? 'pending'),
    viewsCount: 0, savesCount: 0, messagesCount: 0,
    createdAt: data.created_at ? String(data.created_at) : undefined,
  };
}

const STATUS_COLORS: Record<string, string> = { approved: '#2E9B55', pending: '#F39C12', rejected: '#E53935' };
const STATUS_BG: Record<string, string> = { approved: '#E8F5E9', pending: '#FFF8EE', rejected: '#FFECEC' };

// Section label with the happenings green accent bar (matches syph's green _sectionLabel).
function SectionLabel({ text, optional, lang }: { text: string; optional?: boolean; lang: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <div style={{ width: 4, height: 18, background: '#2E9B55', borderRadius: 4 }} />
      <span style={{ fontWeight: 900, fontSize: 15, color: '#1E2B45' }}>{text}{optional ? ` (${tr('optionalLabel', lang)})` : ''}</span>
    </div>
  );
}

const MAX_IMAGES = 3;
// Happenings are always under "Events & Tickets" — sellers only pick the event
// type (a subcategory), like the app. No other categories are shown.
const EVENTS_CATEGORY_ID = 'events_tickets';
const EVENT_TYPES = CATEGORIES.find((c) => c.id === EVENTS_CATEGORY_ID)?.children ?? [];

export default function HappeningsPage() {
  const router = useRouter();
  const { selectedLanguage: lang } = useAppStore();
  const [uid, setUid] = useState<string | null>(null);
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [happenings, setHappenings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationText, setLocationText] = useState('');
  const [selectedMainId, setSelectedMainId] = useState('');
  const [price, setPrice] = useState('');
  const [bio, setBio] = useState('');
  const [negotiable, setNegotiable] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Happenings are a paid, duration-based promo (parity with the app).
  const [selectedDays, setSelectedDays] = useState(7);
  const [pricing, setPricing] = useState<DayPriceMap | null>(null);
  const [privilegePct, setPrivilegePct] = useState(0);
  const [eventDate, setEventDate] = useState('');
  const [venueLat, setVenueLat] = useState<number | null>(null);
  const [venueLng, setVenueLng] = useState<number | null>(null);
  const [video, setVideo] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  function handleVideoPick(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    if (f.size > 60 * 1024 * 1024) { toast.error(tr('videoTooLarge', lang)); return; }
    setVideo(f);
  }

  function useCurrentVenue() {
    if (!navigator.geolocation) { toast.error(tr('failedGetLocation', lang)); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setVenueLat(pos.coords.latitude); setVenueLng(pos.coords.longitude); toast.success(tr('venueGpsSet', lang)); },
      () => toast.error(tr('failedGetLocation', lang)),
    );
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      if (!u) { setLoading(false); return; }
      setUid(u.id);
      const sp = await getSellerProfile(u.id).catch(() => null);
      setSeller(sp);
      setLoading(false);
      const [pp, pct] = await Promise.all([getPromoPricing(), getSellerPrivilegePercent(u.id)]);
      setPricing(pp.happenings);
      setPrivilegePct(pct);
    });
  }, []);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    supabase
      .from('listings')
      .select('*')
      .eq('is_happening', true)
      .eq('seller_id', uid)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (!cancelled) setHappenings((data ?? []).map((d: Record<string, unknown>) => mapListing(d, String(d.id ?? ''))));
      });
    return () => { cancelled = true; };
  }, [uid]);

  function handleImagePick(files: FileList | null) {
    if (!files) return;
    const toAdd = Array.from(files).slice(0, MAX_IMAGES - images.length);
    setImages((prev) => [...prev, ...toAdd]);
    toAdd.forEach((f) => setImagePreviews((prev) => [...prev, URL.createObjectURL(f)]));
  }

  function removeImage(idx: number) {
    URL.revokeObjectURL(imagePreviews[idx]);
    setImages((prev) => prev.filter((_, i) => i !== idx));
    setImagePreviews((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
    if (!uid || !seller) { toast.error(tr('completeSetupFirst', lang)); return; }
    // Validation order mirrors syph: title → description → event date → venue → images → valid price.
    if (!title.trim()) { toast.error(tr('enterTitleToast', lang)); return; }
    if (!description.trim()) { toast.error(tr('enterDescToast', lang)); return; }
    if (!eventDate) { toast.error(tr('selectEventDateToast', lang)); return; }
    if (!locationText.trim()) { toast.error(tr('enterVenueToast', lang)); return; }
    if (images.length === 0) { toast.error(tr('addOneImageToast', lang)); return; }
    const priceParsed = price.trim() ? parseFloat(price.replace(/[^0-9.]/g, '')) : NaN;
    if (!price.trim() || Number.isNaN(priceParsed)) { toast.error(tr('enterValidPrice', lang)); return; }

    const safeTitle = sanitizeText(title, 100);
    const safeDesc = sanitizeText(description, 1000);
    const safeLocation = sanitizeText(locationText, 200);
    const safeBio = sanitizeText(bio, 500);
    if (!safeTitle) { toast.error(tr('titleEmptyToast', lang)); return; }
    if (!safeDesc) { toast.error(tr('descEmptyToast', lang)); return; }

    setSubmitting(true);
    try {
      // Price currency is the seller-country currency (fixed prefix), matching syph.
      const happeningCurrency = getCurrencyForCountry(seller.operatingCountry || '') || 'USD';
      const listingId = await createHappening({
        title: safeTitle,
        description: safeDesc,
        bio: safeBio || undefined,
        imageUrl: '',
        sellerName: seller.businessName || 'Organiser',
        ownerUid: uid,
        country: seller.operatingCountry,
        regionOrCity: seller.operatingRegion,
        locationText: safeLocation,
        priceText: `${happeningCurrency} ${price.trim()}`,
        priceValue: priceParsed,
        currencyCode: happeningCurrency,
        negotiable,
        mainCategoryId: EVENTS_CATEGORY_ID,
        subCategoryId: selectedMainId || undefined,
        openNow: false,
        isSponsored: false,
        isHappening: true,
        isFlashSale: false,
        isTrial: false,
        eventDate: eventDate ? new Date(eventDate).toISOString() : undefined,
        venueLatitude: venueLat ?? undefined,
        venueLongitude: venueLng ?? undefined,
      }, images, video);

      // Happenings are a paid, duration-based promo — route through payment like the app.
      const dayKey = selectedDays === 7 ? 'days7' : selectedDays === 15 ? 'days15' : 'days30';
      const ugx = pricing ? pricing[dayKey] : 0;
      const effectiveUgx = privilegePct > 0 ? ugx * (1 - privilegePct / 100) : ugx;
      const sellerCurrency = getCurrencyForCountry(seller.operatingCountry || '') || 'USD';
      const amount = Math.round(convertPrice(effectiveUgx, 'UGX', sellerCurrency));
      if (listingId && amount > 0) {
        const params = new URLSearchParams({
          amount: String(amount), currency: sellerCurrency, type: 'happenings',
          days: String(selectedDays), listingId, listingTitle: safeTitle,
        });
        router.push(`/payment/method?${params}`);
        return;
      }
      toast.success(tr('happeningSubmitted', lang));
      setShowForm(false);
      setTitle(''); setDescription(''); setLocationText('');
      setSelectedMainId(''); setPrice(''); setBio(''); setNegotiable(false);
      setEventDate(''); setVenueLat(null); setVenueLng(null);
      setVideo(null);
      setImages([]); setImagePreviews([]);
    } catch {
      toast.error(tr('failedSubmitRetry', lang));
    } finally {
      setSubmitting(false);
    }
  }

  // Price currency = seller-country currency (fixed prefix), matching syph.
  const happeningCurrency = getCurrencyForCountry(seller?.operatingCountry || '') || 'USD';
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '13px 16px', border: '1px solid #D7DEE8',
    borderRadius: 14, fontSize: 15, outline: 'none', background: '#F5F8FD',
    boxSizing: 'border-box', fontFamily: 'inherit',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontWeight: 800, fontSize: 13, color: '#4A5878', marginBottom: 6,
  };
  const cardStyle: React.CSSProperties = {
    background: '#fff', borderRadius: 18, border: '1px solid #E6ECF5', padding: 16, boxShadow: '0 3px 8px rgba(0,0,0,0.03)',
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F0F4FF' }}>
        <div style={{ width: 36, height: 36, border: '3px solid #E8EDFF', borderTop: '3px solid #2E9B55', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#F0F4FF', paddingBottom: 40 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1B5E20, #2E7D32)', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => showForm ? setShowForm(false) : router.back()} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, padding: 8, cursor: 'pointer', display: 'flex' }}>
            <ArrowLeft size={20} color="#fff" />
          </button>
          <div>
            <div style={{ color: '#fff', fontWeight: 900, fontSize: 18 }}>{showForm ? tr('postHappening', lang) : tr('myHappenings', lang)}</div>
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 }}>
              {showForm ? tr('shareEventWithBuyers', lang) : tr('manageEvents', lang)}
            </div>
          </div>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 10, padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#fff', fontWeight: 700, fontSize: 13 }}>
            <Plus size={16} /> {tr('newLabel', lang)}
          </button>
        )}
      </div>

      {/* List view */}
      {!showForm && (
        <div style={{ padding: '16px 16px 0' }}>
          {happenings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: 20, border: '1px solid #eef2f8' }}>
              <div style={{ width: 64, height: 64, background: '#E8F5E9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <MapPin size={28} color="#2E9B55" />
              </div>
              <p style={{ margin: '0 0 8px', fontWeight: 900, fontSize: 18, color: '#0F2B6E' }}>{tr('noHappeningsYet', lang)}</p>
              <p style={{ margin: '0 0 20px', fontSize: 14, fontWeight: 600, color: '#9ca3af', lineHeight: 1.5 }}>
                {tr('postEventsDesc', lang)}
              </p>
              <button onClick={() => setShowForm(true)}
                style={{ background: '#2E9B55', color: '#fff', border: 'none', borderRadius: 14, padding: '12px 28px', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
                {tr('postAHappening', lang)}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {happenings.map((h) => (
                <div key={h.id} onClick={() => router.push(`/listing/${h.id}`)}
                  style={{ background: '#fff', borderRadius: 16, padding: '12px', border: '1px solid #eef2f8', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'center' }}>
                  {h.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={h.imageUrl} alt={h.title} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 12, flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 60, height: 60, background: '#E8F5E9', borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <MapPin size={24} color="#2E9B55" />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: '#0F2B6E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.title}</p>
                    <p style={{ margin: '3px 0 0', fontSize: 12, fontWeight: 600, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {h.locationText || h.regionOrCity}
                    </p>
                    <span style={{ display: 'inline-block', marginTop: 5, fontSize: 11, fontWeight: 800, padding: '2px 10px', borderRadius: 99, background: STATUS_BG[h.status] ?? '#f1f5f9', color: STATUS_COLORS[h.status] ?? '#6B7A99' }}>
                      {h.status === 'approved' ? tr('tabApproved', lang) : h.status === 'pending' ? tr('tabPending', lang) : h.status === 'rejected' ? tr('tabRejected', lang) : h.status}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#2E5BFF' }}>{h.priceText || tr('freeLabel', lang)}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af' }}>{h.viewsCount} {tr('viewsWord', lang)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Post form */}
      {showForm && (
        <div style={{ padding: '16px 16px 100px' }}>

          {/* Celebration hero banner (mirrors syph's green gradient card). */}
          <div style={{ background: 'linear-gradient(135deg, #1A7A3A, #2E9B55)', borderRadius: 20, padding: '18px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 6px 16px rgba(46,157,85,0.35)' }}>
            <PartyPopper size={40} color="#fff" style={{ flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ color: '#fff', fontWeight: 900, fontSize: 16 }}>{tr('happeningHeroTitle', lang)}</div>
              <div style={{ color: 'rgba(255,255,255,0.72)', fontWeight: 600, fontSize: 12, marginTop: 4, lineHeight: 1.4 }}>{tr('happeningHeroBody', lang)}</div>
            </div>
          </div>

          {/* Event Category — fixed to Events & Tickets; only pick the event type */}
          <div style={{ marginBottom: 20 }}>
            <SectionLabel text={tr('eventCategory', lang)} lang={lang} />
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(46,157,85,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 20 }}>🎟️</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: '#1E2B45' }}>{trCategory(EVENTS_CATEGORY_ID, 'Events & Tickets', lang)}</div>
                  <div style={{ fontWeight: 600, fontSize: 12, color: '#9ca3af' }}>{tr('chooseEventTypeOptional', lang)}</div>
                </div>
              </div>
              <div style={{ position: 'relative' }}>
                <select value={selectedMainId} onChange={(e) => setSelectedMainId(e.target.value)} style={{ ...inputStyle, paddingRight: 28, appearance: 'none' }}>
                  <option value="">{tr('selectEventType', lang)}</option>
                  {EVENT_TYPES.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                </select>
                <ChevronDown size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6B7A99' }} />
              </div>
            </div>
          </div>

          {/* Event Images */}
          <div style={{ marginBottom: 20 }}>
            <SectionLabel text={tr('eventImages', lang)} lang={lang} />
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                <ImageIcon size={20} color="#2E5BFF" />
                <span style={{ fontWeight: 900, fontSize: 14.5, color: '#1E2B45', marginLeft: 8, flex: 1 }}>{tr('eventImagesUpTo3', lang)}</span>
                {images.length < MAX_IMAGES && (
                  <button onClick={() => fileInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: '#2E5BFF', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}><Plus size={16} /> {tr('addLabel', lang)}</button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {imagePreviews.map((url, i) => (
                  <div key={i} style={{ position: 'relative', width: 82, height: 82 }}>
                    <Image src={url} alt="" fill style={{ objectFit: 'cover', borderRadius: 12 }} />
                    {i === 0 && (
                      <span style={{ position: 'absolute', bottom: 4, left: 4, background: '#2E9B55', color: '#fff', fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 6 }}>{tr('coverBadge', lang)}</span>
                    )}
                    <button onClick={() => removeImage(i)} style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, background: '#E53935', border: '2px solid #fff', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}><X size={11} color="#fff" /></button>
                  </div>
                ))}
                {images.length < MAX_IMAGES && (
                  <button onClick={() => fileInputRef.current?.click()} style={{ width: 82, height: 82, background: '#F5F8FD', border: '1.5px dashed #A0B4E0', borderRadius: 12, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    <Camera size={22} color="#6B7A99" />
                    <span style={{ fontSize: 10, color: '#6B7A99', fontWeight: 700 }}>{tr('addLabel', lang)}</span>
                  </button>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => handleImagePick(e.target.files)} />
            </div>
          </div>

          {/* Event Video */}
          <div style={{ marginBottom: 20 }}>
            <SectionLabel text={tr('eventVideo', lang)} optional lang={lang} />
            <div style={cardStyle}>
              {video ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#F5F8FD', borderRadius: 12, padding: '10px 12px' }}>
                  <Video size={20} color="#2E9B55" />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: '#1E2B45', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{video.name}</span>
                  <button onClick={() => setVideo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E53935', display: 'flex' }}><X size={18} /></button>
                </div>
              ) : (
                <button onClick={() => videoInputRef.current?.click()} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#F5F8FD', border: '1.5px dashed #A0B4E0', borderRadius: 12, padding: '14px', color: '#2E5BFF', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                  <Video size={18} /> {tr('addVideo', lang)}
                </button>
              )}
              <input ref={videoInputRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={(e) => handleVideoPick(e.target.files)} />
            </div>
          </div>

          {/* Event Name */}
          <div style={{ marginBottom: 20 }}>
            <SectionLabel text={tr('eventName', lang)} lang={lang} />
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tr('eventTitlePlaceholder', lang)} style={inputStyle} />
          </div>

          {/* Ticket Price / Entry — required, fixed currency prefix from seller country. */}
          <div style={{ marginBottom: 20 }}>
            <SectionLabel text={tr('ticketEntryPrice', lang)} lang={lang} />
            <div style={cardStyle}>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontWeight: 700, fontSize: 15, color: '#4A5878', pointerEvents: 'none' }}>{happeningCurrency}</span>
                <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder={tr('freePricePlaceholder', lang)} type="number" style={{ ...inputStyle, paddingLeft: 16 + happeningCurrency.length * 9 + 8 }} />
              </div>
              {/* Negotiable toggle (SwitchListTile in the app). */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12, border: '1px solid #D7DEE8', borderRadius: 14, padding: '10px 14px' }}>
                <span style={{ fontWeight: 700, color: '#182033', fontSize: 14 }}>{tr('negotiableLabel', lang)}</span>
                <button type="button" onClick={() => setNegotiable((v) => !v)} aria-pressed={negotiable} style={{ width: 46, height: 26, borderRadius: 999, border: 'none', flexShrink: 0, background: negotiable ? '#2E9B55' : '#C7D0E0', cursor: 'pointer', position: 'relative', transition: 'background 0.15s', padding: 0 }}>
                  <span style={{ position: 'absolute', top: 3, left: negotiable ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                </button>
              </div>
            </div>
          </div>

          {/* Description */}
          <div style={{ marginBottom: 20 }}>
            <SectionLabel text={tr('descriptionLabel', lang)} lang={lang} />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={tr('describeEventPlaceholder', lang)} rows={4} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
          </div>

          {/* Event Date — captures date + time (syph uses date + time pickers). */}
          <div style={{ marginBottom: 20 }}>
            <SectionLabel text={tr('eventDateLabel', lang)} lang={lang} />
            <input type="datetime-local" value={eventDate} onChange={(e) => setEventDate(e.target.value)} style={inputStyle} />
          </div>

          {/* Contact / Payment (bio) — sits between Event Date and Venue (syph order). */}
          <div style={{ marginBottom: 20 }}>
            <SectionLabel text={tr('contactPaymentLabel', lang)} lang={lang} />
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Link2 size={18} color="#2E5BFF" style={{ flexShrink: 0 }} />
                <span style={{ fontWeight: 700, fontSize: 13, color: '#1E2B45' }}>{tr('contactPaymentHeading', lang)}</span>
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', marginTop: 6, lineHeight: 1.4 }}>{tr('contactPaymentBody', lang)}</div>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder={tr('contactPaymentHint', lang)} rows={2} style={{ ...inputStyle, resize: 'none', lineHeight: 1.5, marginTop: 12 }} />
            </div>
          </div>

          {/* Venue */}
          <div style={{ marginBottom: 20 }}>
            <SectionLabel text={tr('venueSectionLabel', lang)} lang={lang} />
            <div style={cardStyle}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 10, lineHeight: 1.4 }}>{tr('venueHelper', lang)}</div>
              <label style={labelStyle}>{tr('venueLocation', lang)} *</label>
              <div style={{ position: 'relative' }}>
                <MapPin size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                <input value={locationText} onChange={(e) => setLocationText(e.target.value)} placeholder={tr('venuePlaceholder', lang)} style={{ ...inputStyle, paddingLeft: 40 }} />
              </div>
              <button type="button" onClick={useCurrentVenue} style={{ marginTop: 12, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: venueLat !== null ? 'rgba(46,157,85,0.08)' : '#F5F8FD', border: `1.5px solid ${venueLat !== null ? '#2E9B55' : '#DCE7F5'}`, borderRadius: 14, padding: '12px 14px', color: venueLat !== null ? '#2E7D32' : '#2E5BFF', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                <MapPin size={16} /> {venueLat !== null ? tr('venueGpsSet', lang) : tr('setVenueGps', lang)}
              </button>
            </div>
          </div>

          {/* Promotion duration (paid — like the app) */}
          <div style={{ marginBottom: 20 }}>
            <SectionLabel text={tr('selectDuration', lang)} lang={lang} />
            <div style={cardStyle}>
            <div style={{ display: 'flex', gap: 8 }}>
              {[7, 15, 30].map((d) => {
                const key = (d === 7 ? 'days7' : d === 15 ? 'days15' : 'days30') as 'days7' | 'days15' | 'days30';
                const ugx = pricing ? pricing[key] : 0;
                const cur = getCurrencyForCountry(seller?.operatingCountry || '') || 'USD';
                const hasDiscount = privilegePct > 0 && ugx > 0;
                const fmt = (u: number) => `${cur} ${Math.round(convertPrice(u, 'UGX', cur)).toLocaleString()}`;
                const origDisp = ugx > 0 ? fmt(ugx) : (pricing ? '—' : '...');
                const discDisp = hasDiscount ? fmt(ugx * (1 - privilegePct / 100)) : origDisp;
                const sel = selectedDays === d;
                const Icon = d === 7 ? CalendarDays : d === 15 ? CalendarCheck : CalendarClock;
                return (
                  <button key={d} onClick={() => setSelectedDays(d)} style={{ flex: 1, padding: '18px 10px', borderRadius: 18, border: `${sel ? 2 : 1}px solid ${sel ? '#2E9B55' : '#DCE7F5'}`, background: sel ? 'rgba(46,157,85,0.10)' : '#fff', cursor: 'pointer', textAlign: 'center', boxShadow: sel ? '0 4px 10px rgba(46,157,85,0.22)' : 'none' }}>
                    <Icon size={22} color={sel ? '#2E9B55' : '#8A97B0'} style={{ marginBottom: 6 }} />
                    <div style={{ fontWeight: 900, fontSize: 15, color: sel ? '#2E7D32' : '#182033' }}>{d} {tr('daysWord', lang)}</div>
                    {hasDiscount && (
                      <div style={{ fontWeight: 600, fontSize: 10, color: '#8A97B0', textDecoration: 'line-through', marginTop: 4 }}>{origDisp}</div>
                    )}
                    <div style={{ fontWeight: 700, fontSize: 12, marginTop: hasDiscount ? 1 : 4, color: hasDiscount ? '#2E9B55' : (sel ? '#2E7D32' : '#6B7A99') }}>{discDisp}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

          {/* Footer note — mirrors syph's info card below Pay Now. */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: '#fff', border: '1px solid #E6ECF5', borderRadius: 14, padding: 14 }}>
            <Info size={20} color="#8A97B0" style={{ flexShrink: 0 }} />
            <span style={{ fontWeight: 700, fontSize: 13, color: '#6B7A99', lineHeight: 1.4 }}>{tr('happeningFooterNote', lang)}</span>
          </div>
        </div>
      )}

      {/* Sticky submit (form only) */}
      {showForm && (
        <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: '#fff', borderTop: '1px solid #eef2f8', padding: '12px 16px 24px' }}>
          <button onClick={handleSubmit} disabled={submitting}
            style={{ width: '100%', height: 52, borderRadius: 26, border: 'none', background: submitting ? '#9ca3af' : '#2E9B55', color: '#fff', fontWeight: 900, fontSize: 16, cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {submitting ? (
              <><span style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> {tr('submittingEllipsis', lang)}</>
            ) : (<><CreditCard size={18} /> {tr('payNowSubmit', lang)}</>)}
          </button>
        </div>
      )}
    </div>
  );
}
