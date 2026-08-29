'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Camera, X, ChevronDown, ChevronRight, MapPin, ImageIcon, Plus, Store, Grid, Info, BadgeCheck, History, Search } from 'lucide-react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { createListing, getSellerProfile } from '@/lib/firestore';
import { getCurrencyForCountry, convertPrice } from '@/lib/currency';
import { getListItemPricing, getSellerPrivilegePercent, getActiveListingCount, getPromoPricing, type ListItemPricing } from '@/lib/adminSettings';
import { CATEGORIES } from '@/data/categories';
import type { SellerProfile } from '@/types';
import toast from 'react-hot-toast';
import { sanitizeText } from '@/lib/sanitize';
import { useAppStore } from '@/store';
import { translate as tr, trCategory } from '@/lib/i18n';

const CURRENCIES = ['USD', 'UGX', 'KES', 'TZS', 'RWF', 'ETB', 'GHS', 'NGN', 'ZAR'];
// Canonical English values stored to DB — only the display is translated.
const CONDITIONS = ['New', 'Used', 'Refurbished'];
const CONDITION_KEYS: Record<string, string> = { New: 'conditionNew', Used: 'conditionUsed', Refurbished: 'conditionRefurbished' };
const DURATION_OPTS = [7, 15, 30];
const MAX_IMAGES = 3;

type FormType = 'listing' | 'sponsor' | 'flash';

interface AdminPricing {
  upgradeToSponsored: Record<string, number>;
  upgradeToFlashSale: Record<string, number>;
  happenings: Record<string, number>;
}

const HEADERS: Record<FormType, { gradient: string; titleKey: string; subtitleKey: string }> = {
  listing: { gradient: 'linear-gradient(135deg, #0F2B6E, #1E4DD9)', titleKey: 'listNewItemTitle', subtitleKey: '' },
  sponsor: { gradient: 'linear-gradient(135deg, #C67200, #E89A00)', titleKey: 'featSponsorTitle', subtitleKey: 'boostVisibilitySub' },
  flash:   { gradient: 'linear-gradient(135deg, #C62828, #E53935)', titleKey: 'flashSaleLabel', subtitleKey: 'flashSaleSubtitle' },
};

// Section label with the app's blue accent bar, sitting above each section.
function SectionLabel({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <div style={{ width: 4, height: 18, background: '#2E5BFF', borderRadius: 4 }} />
      <span style={{ fontWeight: 900, fontSize: 15, color: '#1E2B45' }}>{text}</span>
    </div>
  );
}

export default function NewListingForm() {
  const router = useRouter();
  const { selectedLanguage: lang } = useAppStore();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get('type');
  const formType: FormType = typeParam === 'sponsor' ? 'sponsor' : typeParam === 'flash' ? 'flash' : 'listing';

  const [uid, setUid] = useState<string | null>(null);
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminPricing, setAdminPricing] = useState<AdminPricing | null>(null);

  const [images, setImages] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [messageForBuyers, setMessageForBuyers] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [price, setPrice] = useState('');
  const [negotiable, setNegotiable] = useState(false);
  // Listing: condition is optional and starts unset (tap again clears).
  // Sponsor/flash keep their previous default of 'New'.
  const [condition, setCondition] = useState(formType === 'listing' ? '' : 'New');
  const [selectedMainId, setSelectedMainId] = useState('');
  const [selectedSubId, setSelectedSubId] = useState('');
  // Category bottom-sheet (listing variant): which pane is showing.
  const [catSheetOpen, setCatSheetOpen] = useState(false);
  const [catSheetMainId, setCatSheetMainId] = useState<string | null>(null);
  const [catSearch, setCatSearch] = useState('');
  // Country/region come from the seller profile (matching the app — not asked here).
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [locationText, setLocationText] = useState('');
  const [duration, setDuration] = useState(7);
  const [units, setUnits] = useState('');
  const [originalPrice, setOriginalPrice] = useState(''); // flash sale only
  const [specs, setSpecs] = useState<{ label: string; value: string }[]>([{ label: '', value: '' }]);
  const [submitting, setSubmitting] = useState(false);

  // Free-15 quota / paid-listing config (normal listings only) — mirrors the app.
  const [pricing, setPricing] = useState<ListItemPricing | null>(null);
  const [activeCount, setActiveCount] = useState(0);
  const [privilegePct, setPrivilegePct] = useState(0);
  const [countLoaded, setCountLoaded] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      if (!u) { setLoading(false); return; }
      setUid(u.id);
      const sp = await getSellerProfile(u.id);
      setSeller(sp);
      if (sp) {
        setCountry(sp.operatingCountry || '');
        setRegion(sp.operatingRegion || '');
      }
      setLoading(false);
      // Privilege discount applies to every paid flow (listing, sponsor, flash).
      setPrivilegePct(await getSellerPrivilegePercent(u.id));
      // Normal listings obey the free-quota promo; sponsor/flash are always paid.
      if (typeParam !== 'sponsor' && typeParam !== 'flash') {
        const [pr, cnt] = await Promise.all([
          getListItemPricing(),
          getActiveListingCount(u.id),
        ]);
        setPricing(pr);
        setActiveCount(cnt);
        setCountLoaded(true);
      }
    });
  }, [typeParam]);

  useEffect(() => {
    // Real "create a new promoted listing" prices from the shared backend:
    // sponsor → sponsorItem, flash → flashSale (mapped into the fields this form reads).
    getPromoPricing().then((pp) => {
      setAdminPricing({ upgradeToSponsored: pp.sponsorItem, upgradeToFlashSale: pp.flashSale, happenings: pp.happenings });
    });
  }, []);

  const mainCategory = CATEGORIES.find((c) => c.id === selectedMainId);
  const subCategories = mainCategory?.children ?? [];

  // Listing price currency is a fixed prefix derived from the seller's country
  // (matches the app — no currency dropdown for the free listing variant).
  const listingCurrency = getCurrencyForCountry(country || seller?.operatingCountry || '') || 'USD';

  // Titles for the chosen category (used by the tile + sheet).
  const selectedMainTitle = mainCategory ? trCategory(mainCategory.id, mainCategory.title, lang) : '';
  const selectedSubTitle = subCategories.find((s) => s.id === selectedSubId)?.title ?? '';
  const catSheetMain = CATEGORIES.find((c) => c.id === catSheetMainId) ?? null;

  function clearCategory() {
    setSelectedMainId('');
    setSelectedSubId('');
  }

  // Free while the promo is on AND the seller is under quota (and not in a
  // country where the admin switched the free promo off). Otherwise it's paid.
  const sellerCountryLc = (country || seller?.operatingCountry || '').trim().toLowerCase();
  const stoppedCountry = !!pricing && pricing.freeStoppedCountries.includes(sellerCountryLc);
  const promoActive = pricing ? (pricing.promoEnabled && !stoppedCountry) : true;
  const listingIsFree = pricing ? (promoActive && activeCount < pricing.freeQuota) : true;
  const perListingUgx = pricing?.perListingUgx ?? 0;
  const willBePaid = formType === 'listing' && countLoaded && !listingIsFree && perListingUgx > 0;

  function handleImagePick(files: FileList | null) {
    if (!files) return;
    const newFiles = Array.from(files).slice(0, MAX_IMAGES - images.length);
    setImages((prev) => [...prev, ...newFiles]);
    newFiles.forEach((f) => setImagePreviewUrls((prev) => [...prev, URL.createObjectURL(f)]));
  }

  function removeImage(idx: number) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
    setImagePreviewUrls((prev) => { URL.revokeObjectURL(prev[idx]); return prev.filter((_, i) => i !== idx); });
  }

  function getPriceUgx(): number {
    if (!adminPricing) return 0;
    const catKey = formType === 'sponsor' ? 'upgradeToSponsored' : 'upgradeToFlashSale';
    const priceKey = duration <= 7 ? 'days7' : duration <= 15 ? 'days15' : 'days30';
    return adminPricing[catKey][priceKey] ?? 0;
  }

  function getDisplayPrice(): string {
    const ugx = getPriceUgx();
    if (ugx <= 0) return adminPricing ? tr('contactSupport', lang) : tr('loading', lang);
    const sellerCurrency = getCurrencyForCountry(country || seller?.operatingCountry || '');
    const converted = convertPrice(ugx, 'UGX', sellerCurrency);
    return `${sellerCurrency} ${Math.round(converted).toLocaleString()}`;
  }

  async function handleSubmit() {
    if (!uid || !seller) { toast.error(tr('completeSetupFirst', lang)); router.push('/dashboard/setup'); return; }
    if (!selectedMainId) { toast.error(tr('selectCategoryToast', lang)); return; }
    if (images.length === 0) { toast.error(tr('addOneImageToast', lang)); return; }
    if (!title.trim()) { toast.error(tr('enterTitleToast', lang)); return; }
    if (!price.trim()) { toast.error(tr('enterPriceToast', lang)); return; }
    if (formType === 'flash') {
      const flashV = parseFloat(price.replace(/[^0-9.]/g, '')) || 0;
      const origV = parseFloat(originalPrice.replace(/[^0-9.]/g, '')) || 0;
      if (!originalPrice.trim() || origV <= 0) { toast.error(tr('enterPriceToast', lang)); return; }
      if (origV <= flashV) { toast.error(tr('origMustExceedFlash', lang)); return; }
    }
    if (!description.trim()) { toast.error(tr('enterDescToast', lang)); return; }
    if (!locationText.trim()) { toast.error(tr('enterLocationToast', lang)); return; }

    const safeTitle = sanitizeText(title, 100);
    const safeDesc = sanitizeText(description, 1000);
    const safeLocation = sanitizeText(locationText, 200);
    const safeMessage = sanitizeText(messageForBuyers, 500);
    if (!safeTitle) { toast.error(tr('titleEmptyToast', lang)); return; }
    if (!safeDesc) { toast.error(tr('descEmptyToast', lang)); return; }

    setSubmitting(true);
    try {
      const priceValue = parseFloat(price.replace(/[^0-9.]/g, '')) || 0;
      const specifications: Record<string, string> = {};
      for (const s of specs) { const l = s.label.trim(); const v = s.value.trim(); if (l && v) specifications[l] = v; }
      const origVal = formType === 'flash' && originalPrice.trim()
        ? (parseFloat(originalPrice.replace(/[^0-9.]/g, '')) || undefined)
        : undefined;
      // Listing uses the seller-country currency (fixed prefix, no dropdown);
      // sponsor/flash keep the currency the seller picked.
      const effCurrency = formType === 'listing' ? listingCurrency : currency;
      const listingId = await createListing({
        title: safeTitle,
        description: safeDesc,
        imageUrl: '',
        sellerName: seller.businessName || 'Seller',
        ownerUid: uid,
        country: country || seller.operatingCountry,
        regionOrCity: region || seller.operatingRegion,
        locationText: safeLocation,
        priceText: `${effCurrency} ${price}`,
        priceValue,
        specifications: Object.keys(specifications).length ? specifications : undefined,
        originalPriceValue: origVal,
        originalPriceText: origVal !== undefined ? `${effCurrency} ${originalPrice}` : undefined,
        currencyCode: effCurrency,
        negotiable,
        messageAboutGoods: safeMessage || undefined,
        units: units.trim() ? (parseInt(units.trim(), 10) || undefined) : undefined,
        mainCategoryId: selectedMainId,
        subCategoryId: selectedSubId || undefined,
        condition: condition || undefined,
        openNow: false,
        isSponsored: formType === 'sponsor',
        isHappening: false,
        isFlashSale: formType === 'flash',
        isTrial: false,
      }, images);

      if (formType !== 'listing') {
        const baseUgx = getPriceUgx();
        const ugx = privilegePct > 0 ? baseUgx * (1 - privilegePct / 100) : baseUgx;
        const sellerCurrency = getCurrencyForCountry(country || seller.operatingCountry || '');
        const amount = Math.round(convertPrice(ugx, 'UGX', sellerCurrency));
        const listingType = formType === 'sponsor' ? 'sponsored' : 'flashsale';
        const params = new URLSearchParams({
          amount: String(amount),
          currency: sellerCurrency,
          type: listingType,
          days: String(duration),
          listingId,
          listingTitle: safeTitle,
        });
        router.push(`/payment/method?${params}`);
      } else if (willBePaid) {
        // Free quota used up (or promo off) — route the paid listing fee through
        // the same payment flow the app uses, with any privilege discount applied.
        const sellerCurrency = getCurrencyForCountry(country || seller.operatingCountry || '');
        const effectiveUgx = privilegePct > 0 ? perListingUgx * (1 - privilegePct / 100) : perListingUgx;
        const amount = Math.round(convertPrice(effectiveUgx, 'UGX', sellerCurrency));
        const params = new URLSearchParams({
          amount: String(amount),
          currency: sellerCurrency,
          type: 'listing',
          days: '0',
          listingId,
          listingTitle: safeTitle,
        });
        router.push(`/payment/method?${params}`);
      } else {
        toast.success(tr('listingSubmitted', lang));
        router.push('/dashboard');
      }
    } catch {
      toast.error(tr('failedSubmitRetry', lang));
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F0F4FF' }}>
        <div style={{ width: 36, height: 36, border: '3px solid #E8EDFF', borderTop: '3px solid #2E5BFF', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!uid) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#F0F4FF', padding: 24 }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ fontWeight: 900, fontSize: 18, color: '#1E2B45' }}>{tr('signInToListItem', lang)}</div>
        <button onClick={() => router.push('/login')} style={{ marginTop: 20, background: '#2E5BFF', color: '#fff', border: 'none', borderRadius: 14, padding: '12px 32px', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>{tr('signIn', lang)}</button>
      </div>
    );
  }

  const hdr = HEADERS[formType];
  // Bare filled input — matches the app's _inputField (fill, radius 14, grey border).
  const inputStyle: React.CSSProperties = { width: '100%', padding: '13px 16px', border: '1px solid #D7DEE8', borderRadius: 14, fontSize: 15, outline: 'none', background: '#F5F8FD', boxSizing: 'border-box', fontFamily: 'inherit' };
  // White card wrapping richer sections (Images, Price, Condition, Specifications, Category).
  const cardStyle: React.CSSProperties = { background: '#fff', borderRadius: 18, border: '1px solid #E6ECF5', padding: 16, boxShadow: '0 3px 8px rgba(0,0,0,0.03)' };
  const sectionWrap: React.CSSProperties = { marginBottom: 20 };

  return (
    <div style={{ minHeight: '100dvh', background: '#F0F4FF', maxWidth: 480, margin: '0 auto' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ background: hdr.gradient, padding: '52px 16px 24px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <button onClick={() => router.back()} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, padding: 8, cursor: 'pointer', display: 'flex', flexShrink: 0, marginTop: 2 }}>
          <ArrowLeft size={20} color="#fff" />
        </button>
        <div>
          <div style={{ color: '#fff', fontWeight: 900, fontSize: 20 }}>{tr(hdr.titleKey, lang)}</div>
          {hdr.subtitleKey && (
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 4 }}>{tr(hdr.subtitleKey, lang)}</div>
          )}
        </div>
      </div>

      <div style={{ padding: '16px 16px 100px' }}>

        {/* Free-15 quota banner (normal listings, while the promo is active) */}
        {formType === 'listing' && countLoaded && pricing && promoActive && (
          <div style={{
            background: listingIsFree ? '#EAF7EE' : '#FFF4E5',
            border: `1px solid ${listingIsFree ? 'rgba(46,157,85,0.3)' : 'rgba(224,138,0,0.35)'}`,
            borderRadius: 14, padding: '12px 14px', marginBottom: 20,
            display: 'flex', alignItems: 'flex-start', gap: 10,
          }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>{listingIsFree ? '🎁' : '💳'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: listingIsFree ? '#1F8B4C' : '#8A5A00' }}>
                {activeCount}/{pricing.freeQuota} {tr('freeListingsUsedLabel', lang)}
              </div>
              <div style={{ fontSize: 12, color: listingIsFree ? '#2E7D50' : '#7A5A1E', marginTop: 3, lineHeight: 1.4 }}>
                {listingIsFree
                  ? `${Math.max(0, pricing.freeQuota - activeCount)} ${tr('freeSlotsLeftHint', lang)}`
                  : tr('quotaFullPaidHint', lang)}
              </div>
            </div>
          </div>
        )}

        {/* Info banner (listing only) */}
        {formType === 'listing' && (
          <div style={{
            background: 'linear-gradient(135deg, #1D49C6, #2E67F5)',
            borderRadius: 20, padding: '18px 18px', marginBottom: 12,
            display: 'flex', alignItems: 'center', gap: 14,
            boxShadow: '0 6px 16px rgba(46,103,245,0.35)',
          }}>
            <Store size={40} color="#fff" style={{ flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ color: '#fff', fontWeight: 900, fontSize: 16 }}>{tr('listItemInfoTitle', lang)}</div>
              <div style={{ color: 'rgba(255,255,255,0.72)', fontWeight: 600, fontSize: 12, marginTop: 4, lineHeight: 1.4 }}>{tr('listItemInfoBody', lang)}</div>
            </div>
          </div>
        )}

        {/* Category */}
        <div style={sectionWrap}>
          <SectionLabel text={tr('category', lang)} />
          {formType === 'listing' ? (
            /* Tappable tile → searchable bottom-sheet (matches the app). */
            <div
              onClick={() => { if (!submitting) { setCatSheetMainId(null); setCatSearch(''); setCatSheetOpen(true); } }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: 14,
                background: '#fff', borderRadius: 14, cursor: submitting ? 'default' : 'pointer',
                border: `${selectedMainId ? 1.5 : 1}px solid ${selectedMainId ? '#2E5BFF' : '#DDE3EC'}`,
              }}>
              <div style={{ padding: 8, background: 'rgba(46,91,255,0.1)', borderRadius: 10, display: 'flex', flexShrink: 0 }}>
                <Grid size={20} color="#2E5BFF" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: selectedMainId ? '#182033' : '#6B7A99' }}>
                  {selectedMainId ? selectedMainTitle : tr('selectCategory', lang)}
                </div>
                <div style={{ fontWeight: 600, fontSize: 12, marginTop: 2, color: selectedMainId && selectedSubTitle ? '#2E5BFF' : '#8A97B0' }}>
                  {selectedMainId && selectedSubTitle ? selectedSubTitle : tr('tapToChooseCategory', lang)}
                </div>
              </div>
              {selectedMainId ? (
                <button
                  onClick={(e) => { e.stopPropagation(); if (!submitting) clearCategory(); }}
                  style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', display: 'flex', flexShrink: 0 }}>
                  <X size={20} color="#8A97B0" />
                </button>
              ) : (
                <ChevronRight size={22} color="#8A97B0" style={{ flexShrink: 0 }} />
              )}
            </div>
          ) : (
            <div style={cardStyle}>
              <label style={{ display: 'block', fontWeight: 800, fontSize: 12.5, color: '#4A5878', marginBottom: 6 }}>{tr('mainCategoryLabel', lang)} *</label>
              <div style={{ position: 'relative' }}>
                <select value={selectedMainId} onChange={(e) => { setSelectedMainId(e.target.value); setSelectedSubId(''); }} style={{ ...inputStyle, appearance: 'none' }}>
                  <option value="">{tr('selectCategory', lang)}...</option>
                  {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{trCategory(c.id, c.title, lang)}</option>)}
                </select>
                <ChevronDown size={16} color="#6B7A99" style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              </div>
              {subCategories.length > 0 && (
                <>
                  <label style={{ display: 'block', fontWeight: 800, fontSize: 12.5, color: '#4A5878', margin: '12px 0 6px' }}>{tr('subcategoryField', lang)}</label>
                  <div style={{ position: 'relative' }}>
                    <select value={selectedSubId} onChange={(e) => setSelectedSubId(e.target.value)} style={{ ...inputStyle, appearance: 'none' }}>
                      <option value="">{tr('selectSubcategory', lang)}...</option>
                      {subCategories.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                    </select>
                    <ChevronDown size={16} color="#6B7A99" style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Images */}
        <div style={sectionWrap}>
          <SectionLabel text={tr('imagesLabel', lang)} />
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
              <ImageIcon size={20} color="#2E5BFF" />
              <span style={{ fontWeight: 900, fontSize: 14.5, color: '#1E2B45', marginLeft: 8, flex: 1 }}>{tr('itemImagesUpTo3', lang)}</span>
              {images.length < MAX_IMAGES && (
                <button onClick={() => fileInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: '#2E5BFF', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                  <Plus size={16} /> {tr('addLabel', lang)}
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {imagePreviewUrls.map((url, i) => (
                <div key={i} style={{ position: 'relative', width: 82, height: 82 }}>
                  <Image src={url} alt="" fill style={{ objectFit: 'cover', borderRadius: 12 }} />
                  <button onClick={() => removeImage(i)} style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, background: '#E53935', border: '2px solid #fff', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                    <X size={11} color="#fff" />
                  </button>
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

        {/* Item Name */}
        <div style={sectionWrap}>
          <SectionLabel text={tr('itemNameLabel', lang)} />
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tr('itemNameHint', lang)} style={inputStyle} />
        </div>

        {/* Price */}
        <div style={sectionWrap}>
          <SectionLabel text={tr('priceLabel', lang)} />
          <div style={cardStyle}>
            {formType === 'flash' && (
              <>
                <label style={{ display: 'block', fontWeight: 800, fontSize: 12.5, color: '#4A5878', marginBottom: 6 }}>{tr('originalPriceLabel', lang)} *</label>
                <input value={originalPrice} onChange={(e) => setOriginalPrice(e.target.value)} placeholder="0.00" type="number" style={{ ...inputStyle, marginBottom: 12 }} />
                <label style={{ display: 'block', fontWeight: 800, fontSize: 12.5, color: '#4A5878', marginBottom: 6 }}>{tr('flashSalePriceLabel', lang)} *</label>
              </>
            )}
            {formType === 'listing' ? (
              /* Fixed currency prefix from the seller's country (no dropdown). */
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontWeight: 700, fontSize: 15, color: '#4A5878', pointerEvents: 'none' }}>{listingCurrency}</span>
                <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" type="number" style={{ ...inputStyle, paddingLeft: 16 + listingCurrency.length * 9 + 8 }} />
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={{ ...inputStyle, width: 100, flexShrink: 0 }}>
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" type="number" style={{ ...inputStyle, flex: 1 }} />
              </div>
            )}
            {formType === 'listing' ? (
              /* Negotiable = on/off switch (SwitchListTile in the app). */
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12, border: '1px solid #D7DEE8', borderRadius: 14, padding: '10px 14px' }}>
                <span style={{ fontWeight: 700, color: '#182033', fontSize: 14 }}>{tr('negotiableLabel', lang)}</span>
                <button
                  type="button"
                  onClick={() => setNegotiable((v) => !v)}
                  aria-pressed={negotiable}
                  style={{
                    width: 46, height: 26, borderRadius: 999, border: 'none', flexShrink: 0,
                    background: negotiable ? '#2E5BFF' : '#C7D0E0', cursor: 'pointer',
                    position: 'relative', transition: 'background 0.15s', padding: 0,
                  }}>
                  <span style={{
                    position: 'absolute', top: 3, left: negotiable ? 23 : 3, width: 20, height: 20,
                    borderRadius: '50%', background: '#fff', transition: 'left 0.15s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  }} />
                </button>
              </div>
            ) : (
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12, cursor: 'pointer', border: '1px solid #D7DEE8', borderRadius: 14, padding: '10px 14px' }}>
                <span style={{ fontWeight: 700, color: '#182033', fontSize: 14 }}>{tr('negotiableLabel', lang)}</span>
                <input type="checkbox" checked={negotiable} onChange={() => setNegotiable(!negotiable)} style={{ width: 18, height: 18, accentColor: '#2E5BFF', cursor: 'pointer' }} />
              </label>
            )}
          </div>
        </div>

        {/* Item Condition */}
        <div style={sectionWrap}>
          <SectionLabel text={tr('itemConditionOptional', lang)} />
          <div style={cardStyle}>
            {formType === 'listing' ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Info size={20} color="#2E5BFF" />
                  <span style={{ fontWeight: 900, fontSize: 14.5, color: '#1E2B45' }}>{tr('itemConditionOptional', lang)}</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {([
                    { val: 'New', color: '#2E9B55', bg: '#E8F5E9', Icon: BadgeCheck },
                    { val: 'Used', color: '#FF9800', bg: '#FFF3E0', Icon: History },
                  ] as const).map(({ val, color, bg, Icon }) => {
                    const selected = condition === val;
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setCondition((prev) => (prev === val ? '' : val))}
                        style={{
                          flex: 1, padding: '14px 0', borderRadius: 14, cursor: 'pointer',
                          background: selected ? bg : '#F7FAFF',
                          border: `${selected ? 2 : 1}px solid ${selected ? color : '#DCE7F5'}`,
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                        }}>
                        <Icon size={26} color={selected ? color : '#8A97B0'} />
                        <span style={{ fontWeight: 900, fontSize: 14, color: selected ? color : '#8A97B0' }}>{tr(CONDITION_KEYS[val], lang)}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                {CONDITIONS.map((c) => (
                  <button key={c} onClick={() => setCondition(c)} style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: `1px solid ${condition === c ? '#2E5BFF' : '#D7DEE8'}`, background: condition === c ? '#2E5BFF' : '#F5F8FD', color: condition === c ? '#fff' : '#4A5878', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{tr(CONDITION_KEYS[c], lang)}</button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Specifications */}
        <div style={sectionWrap}>
          <SectionLabel text={tr('specifications', lang)} />
          <div style={cardStyle}>
            {specs.map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: i === specs.length - 1 ? 0 : 10 }}>
                <input value={s.label} onChange={(e) => setSpecs((p) => p.map((r, idx) => idx === i ? { ...r, label: e.target.value } : r))} placeholder={tr('specLabelPlaceholder', lang)} style={{ ...inputStyle, flex: 1 }} />
                <input value={s.value} onChange={(e) => setSpecs((p) => p.map((r, idx) => idx === i ? { ...r, value: e.target.value } : r))} placeholder={tr('specValuePlaceholder', lang)} style={{ ...inputStyle, flex: 1 }} />
                {specs.length > 1 && <button onClick={() => setSpecs((p) => p.filter((_, idx) => idx !== i))} style={{ background: '#FFECEC', border: 'none', borderRadius: 12, width: 44, flexShrink: 0, cursor: 'pointer', color: '#E53935', fontWeight: 900, fontSize: 18 }}>×</button>}
              </div>
            ))}
            <button onClick={() => setSpecs((p) => [...p, { label: '', value: '' }])} style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: '#2E5BFF', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}><Plus size={16} /> {tr('addSpecification', lang)}</button>
          </div>
        </div>

        {/* Description */}
        <div style={sectionWrap}>
          <SectionLabel text={tr('descriptionLabel', lang)} />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={tr('describeYourItem', lang)} rows={4} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
        </div>

        {/* Location */}
        <div style={sectionWrap}>
          <SectionLabel text={tr('locationLabel', lang)} />
          <div style={{ position: 'relative' }}>
            <MapPin size={16} color="#6B7A99" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
            <input value={locationText} onChange={(e) => setLocationText(e.target.value)} placeholder={tr('exactAreaStreet', lang)} style={{ ...inputStyle, paddingLeft: 40 }} />
          </div>
        </div>

        {/* Units Available (optional) */}
        <div style={sectionWrap}>
          <SectionLabel text={tr('unitsAvailableOptional', lang)} />
          <input value={units} onChange={(e) => setUnits(e.target.value)} placeholder={tr('unitsHint', lang)} type="number" min="1" style={inputStyle} />
        </div>

        {/* Message about goods (optional) */}
        <div style={sectionWrap}>
          <SectionLabel text={tr('messageAboutGoodsOptional', lang)} />
          <textarea value={messageForBuyers} onChange={(e) => setMessageForBuyers(e.target.value)} placeholder={tr('extraMessageForBuyers', lang)} rows={2} style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }} />
        </div>

        {/* Promotion duration + pricing (sponsor/flash only) */}
        {formType !== 'listing' && (
          <div style={sectionWrap}>
            <SectionLabel text={formType === 'sponsor' ? tr('sponsorshipDuration', lang) : tr('flashSaleDuration', lang)} />
            <div style={cardStyle}>
              <div style={{ display: 'flex', gap: 8 }}>
                {DURATION_OPTS.map((d) => {
                  const priceKey = d <= 7 ? 'days7' : d <= 15 ? 'days15' : 'days30';
                  const catKey = formType === 'sponsor' ? 'upgradeToSponsored' : 'upgradeToFlashSale';
                  const ugx = adminPricing ? (adminPricing[catKey][priceKey] ?? 0) : 0;
                  const sellerCurrency = getCurrencyForCountry(country || seller?.operatingCountry || '');
                  const displayAmt = ugx > 0
                    ? `${sellerCurrency} ${Math.round(convertPrice(ugx, 'UGX', sellerCurrency)).toLocaleString()}`
                    : adminPricing ? '—' : '...';
                  const selected = duration === d;
                  const color = formType === 'sponsor' ? '#2F6BFF' : '#E53935';
                  return (
                    <button key={d} onClick={() => setDuration(d)} style={{ flex: 1, padding: '14px 8px', borderRadius: 14, border: `${selected ? 2 : 1}px solid ${selected ? color : '#D7DEE8'}`, background: selected ? `${color}14` : '#F5F8FD', cursor: 'pointer', textAlign: 'center' }}>
                      <div style={{ fontWeight: 900, fontSize: 13, color: selected ? color : '#182033' }}>{d} {tr('daysWord', lang)}</div>
                      <div style={{ fontWeight: 700, fontSize: 11.5, color: selected ? color : '#6B7A99', marginTop: 4 }}>{displayAmt}</div>
                    </button>
                  );
                })}
              </div>
              <div style={{ background: formType === 'sponsor' ? '#EEF3FF' : '#FFF0F0', borderRadius: 14, padding: 14, marginTop: 14, border: `1px solid ${formType === 'sponsor' ? '#C0D0FF' : '#FFCDD2'}` }}>
                {[
                  { label: tr('typeWord', lang), value: formType === 'sponsor' ? tr('sponsored', lang) : tr('flashSaleLabel', lang) },
                  { label: tr('durationWord', lang), value: `${duration} ${tr('daysWord', lang)}` },
                  { label: tr('listingPrice', lang), value: getDisplayPrice() },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ color: '#6B7A99', fontWeight: 700, fontSize: 13 }}>{label}</span>
                    <span style={{ fontWeight: 900, fontSize: 13, color: formType === 'sponsor' ? '#2F6BFF' : '#E53935' }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Submit */}
        <button onClick={handleSubmit} disabled={submitting} style={{ width: '100%', padding: 16, marginTop: 8, background: submitting ? '#A0B4E0' : 'linear-gradient(90deg, #1D49C6, #2E67F5)', border: 'none', borderRadius: 18, color: '#fff', fontWeight: 900, fontSize: 16, cursor: submitting ? 'not-allowed' : 'pointer', boxShadow: '0 6px 14px rgba(46,103,245,0.38)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {submitting ? (
            <><div style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,0.4)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />{tr('submittingEllipsis', lang)}</>
          ) : (
            (formType === 'listing' && !willBePaid) ? tr('submitForReview', lang) : tr('continueToPayment', lang)
          )}
        </button>
      </div>

      {/* Category picker bottom-sheet (listing only) */}
      {catSheetOpen && (
        <div
          onClick={() => setCatSheetOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 480, maxHeight: '80vh', background: '#fff', borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Sheet header */}
            <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #EEF1F6', display: 'flex', alignItems: 'center', gap: 10 }}>
              {catSheetMain && (
                <button onClick={() => setCatSheetMainId(null)} style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', display: 'flex' }}>
                  <ArrowLeft size={20} color="#1E2B45" />
                </button>
              )}
              <span style={{ flex: 1, fontWeight: 900, fontSize: 16, color: '#1E2B45' }}>
                {catSheetMain ? trCategory(catSheetMain.id, catSheetMain.title, lang) : tr('selectCategory', lang)}
              </span>
              <button onClick={() => setCatSheetOpen(false)} style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', display: 'flex' }}>
                <X size={20} color="#6B7A99" />
              </button>
            </div>
            {/* Search */}
            <div style={{ padding: '12px 16px', position: 'relative' }}>
              <Search size={16} color="#6B7A99" style={{ position: 'absolute', left: 28, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                value={catSearch}
                onChange={(e) => setCatSearch(e.target.value)}
                placeholder={tr('search', lang)}
                autoFocus
                style={{ ...inputStyle, paddingLeft: 40 }}
              />
            </div>
            {/* List */}
            <div style={{ overflowY: 'auto', padding: '0 8px 16px' }}>
              {!catSheetMain
                ? CATEGORIES
                    .filter((c) => trCategory(c.id, c.title, lang).toLowerCase().includes(catSearch.trim().toLowerCase()))
                    .map((c) => (
                      <button
                        key={c.id}
                        onClick={() => { setCatSheetMainId(c.id); setCatSearch(''); }}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 12px', background: 'none', border: 'none', borderRadius: 12, cursor: 'pointer', textAlign: 'left' }}>
                        <span style={{ flex: 1, fontWeight: 700, fontSize: 15, color: '#1E2B45' }}>{trCategory(c.id, c.title, lang)}</span>
                        <ChevronRight size={18} color="#8A97B0" />
                      </button>
                    ))
                : (catSheetMain.children ?? [])
                    .filter((s) => s.title.toLowerCase().includes(catSearch.trim().toLowerCase()))
                    .map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setSelectedMainId(catSheetMain.id);
                          setSelectedSubId(s.id);
                          setCatSheetOpen(false);
                        }}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 12px', background: 'none', border: 'none', borderRadius: 12, cursor: 'pointer', textAlign: 'left' }}>
                        <span style={{ flex: 1, fontWeight: 700, fontSize: 15, color: '#1E2B45' }}>{s.title}</span>
                      </button>
                    ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
