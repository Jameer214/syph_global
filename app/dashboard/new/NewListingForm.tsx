'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Camera, X, ChevronRight, MapPin, ImageIcon, Plus, Store, Grid, Info, BadgeCheck, History, Search, SlidersHorizontal, Receipt, Send, CreditCard, Megaphone, Zap, Star, Flame, Trophy, Tag } from 'lucide-react';
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

// Canonical English values stored to DB — only the display is translated.
// Reference (app) has only New/Used everywhere; Refurbished removed.
const CONDITION_KEYS: Record<string, string> = { New: 'conditionNew', Used: 'conditionUsed' };
// New=green / Used=orange condition tiles, shared by all form types.
const CONDITION_OPTS = [
  { val: 'New', color: '#2E9B55', bg: '#E8F5E9' },
  { val: 'Used', color: '#FF9800', bg: '#FFF3E0' },
] as const;
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
  // Sponsor mirrors syph's SyphGradientAppBar (blue), title "Sponsor My Item".
  sponsor: { gradient: 'linear-gradient(135deg, #0F2B6E, #1E4DD9)', titleKey: 'sponsorInfoTitle', subtitleKey: '' },
  // Flash app bar mirrors syph's SyphGradientAppBar (blue); the red hero lives in-body.
  flash:   { gradient: 'linear-gradient(135deg, #0F2B6E, #1E4DD9)', titleKey: 'flashInfoTitle', subtitleKey: '' },
};

// Section label with the app's accent bar, sitting above each section.
// Accent is type-aware (flash = red) — matches syph's per-screen accent color.
function SectionLabel({ text, color = '#2E5BFF' }: { text: string; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <div style={{ width: 4, height: 18, background: color, borderRadius: 4 }} />
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
  const [bio, setBio] = useState('');
  const [messageForBuyers, setMessageForBuyers] = useState('');
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

  // Price currency is a fixed prefix derived from the seller's country
  // (matches the app — no currency dropdown for any variant).
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

  async function handleSubmit() {
    if (!uid || !seller) { toast.error(tr('completeSetupFirst', lang)); router.push('/dashboard/setup'); return; }
    // Validation order mirrors syph: title → category → description → images → price.
    if (!title.trim()) { toast.error(tr('enterTitleToast', lang)); return; }
    if (!selectedMainId) { toast.error(tr('selectCategoryToast', lang)); return; }
    if (!description.trim()) { toast.error(tr('enterDescToast', lang)); return; }
    if (images.length === 0) { toast.error(tr('addOneImageToast', lang)); return; }
    if (!price.trim()) { toast.error(tr('enterPriceToast', lang)); return; }
    if (formType === 'flash') {
      const flashV = parseFloat(price.replace(/[^0-9.]/g, '')) || 0;
      const origV = parseFloat(originalPrice.replace(/[^0-9.]/g, '')) || 0;
      if (!originalPrice.trim() || origV <= 0) { toast.error(tr('enterPriceToast', lang)); return; }
      if (origV <= flashV) { toast.error(tr('origMustExceedFlash', lang)); return; }
    }
    // Location is optional for sponsor (matches the app); required for listing/flash.
    if (formType !== 'sponsor' && !locationText.trim()) { toast.error(tr('enterLocationToast', lang)); return; }

    const safeTitle = sanitizeText(title, 100);
    const safeDesc = sanitizeText(description, 1000);
    const safeBio = sanitizeText(bio, 500);
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
      // All variants use the seller-country currency as a fixed prefix
      // (no dropdown), matching the app.
      const effCurrency = listingCurrency;
      const listingId = await createListing({
        title: safeTitle,
        description: safeDesc,
        bio: safeBio || undefined,
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
  // Per-screen accent (flash = red like syph's flash screen; others = blue).
  const accent = formType === 'flash' ? '#E53935' : '#2E5BFF';
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

        {/* Info hero banner (all variants). Listing/sponsor = blue brand gradient;
            flash = red hero. syph order: banner FIRST, then the free-quota banner.
            Listing copy swaps to the paid-path wording once the free quota is used. */}
        <div style={{
          background: formType === 'flash'
            ? 'linear-gradient(135deg, #B71C1C, #E53935)'
            : 'linear-gradient(135deg, #1D49C6, #2E67F5)',
          borderRadius: 20, padding: '18px 18px', marginBottom: 12,
          display: 'flex', alignItems: 'center', gap: 14,
          boxShadow: formType === 'flash'
            ? '0 6px 16px rgba(229,57,53,0.30)'
            : '0 6px 16px rgba(46,103,245,0.35)',
        }}>
          {formType === 'sponsor'
            ? <Megaphone size={40} color="#fff" style={{ flexShrink: 0 }} />
            : formType === 'flash'
              ? <Zap size={40} color="#fff" style={{ flexShrink: 0 }} />
              : <Store size={40} color="#fff" style={{ flexShrink: 0 }} />}
          <div style={{ minWidth: 0 }}>
            <div style={{ color: '#fff', fontWeight: 900, fontSize: 16 }}>{tr(
              formType === 'sponsor' ? 'sponsorInfoTitle'
                : formType === 'flash' ? 'flashInfoTitle'
                  : willBePaid ? 'listItemInfoTitlePaid' : 'listItemInfoTitle', lang)}</div>
            <div style={{ color: 'rgba(255,255,255,0.72)', fontWeight: 600, fontSize: 12, marginTop: 4, lineHeight: 1.4 }}>{tr(
              formType === 'sponsor' ? 'sponsorInfoBody'
                : formType === 'flash' ? 'flashInfoBody'
                  : willBePaid ? 'listItemInfoBodyPaid' : 'listItemInfoBody', lang)}</div>
          </div>
        </div>

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

        {/* Category */}
        <div style={sectionWrap}>
          <SectionLabel color={accent} text={tr('category', lang)} />
          {/* Tappable tile → searchable bottom-sheet (matches the app), all variants. */}
          {
            <div
              onClick={() => { if (!submitting) { setCatSheetMainId(null); setCatSearch(''); setCatSheetOpen(true); } }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: 14,
                background: '#fff', borderRadius: 14, cursor: submitting ? 'default' : 'pointer',
                border: `${selectedMainId ? 1.5 : 1}px solid ${selectedMainId ? accent : '#DDE3EC'}`,
              }}>
              <div style={{ padding: 8, background: `${accent}1A`, borderRadius: 10, display: 'flex', flexShrink: 0 }}>
                <Grid size={20} color={accent} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: selectedMainId ? '#182033' : '#6B7A99' }}>
                  {selectedMainId ? selectedMainTitle : tr('selectCategory', lang)}
                </div>
                <div style={{ fontWeight: 600, fontSize: 12, marginTop: 2, color: selectedMainId && selectedSubTitle ? accent : '#8A97B0' }}>
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
          }
        </div>

        {/* Images */}
        <div style={sectionWrap}>
          <SectionLabel color={accent} text={tr('imagesLabel', lang)} />
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
              <ImageIcon size={20} color={accent} />
              <span style={{ fontWeight: 900, fontSize: 14.5, color: '#1E2B45', marginLeft: 8, flex: 1 }}>{tr('itemImagesUpTo3', lang)}</span>
              {images.length < MAX_IMAGES && (
                <button onClick={() => fileInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: accent, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
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
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" multiple style={{ display: 'none' }} onChange={(e) => handleImagePick(e.target.files)} />
          </div>
        </div>

        {/* Item Name */}
        <div style={sectionWrap}>
          <SectionLabel color={accent} text={tr('itemNameLabel', lang)} />
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tr('itemNameHint', lang)} style={inputStyle} />
        </div>

        {/* Price */}
        <div style={sectionWrap}>
          <SectionLabel color={accent} text={tr(formType === 'flash' ? 'flashSalePriceLabel' : 'priceLabel', lang)} />
          <div style={cardStyle}>
            {formType === 'flash' && (
              <>
                <label style={{ display: 'block', fontWeight: 700, fontSize: 12, color: '#888888', marginBottom: 6 }}>{tr('originalPriceLabel', lang)} *</label>
                <input value={originalPrice} onChange={(e) => setOriginalPrice(e.target.value)} placeholder="0.00" type="number" style={{ ...inputStyle, marginBottom: 12 }} />
                <label style={{ display: 'block', fontWeight: 700, fontSize: 12, color: '#E53935', marginBottom: 6 }}>{tr('flashSalePriceLabel', lang)} *</label>
              </>
            )}
            {/* Fixed currency prefix from the seller's country (no dropdown), all variants. */}
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontWeight: 700, fontSize: 15, color: '#4A5878', pointerEvents: 'none' }}>{listingCurrency}</span>
              <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" type="number" style={{ ...inputStyle, paddingLeft: 16 + listingCurrency.length * 9 + 8 }} />
            </div>
            {/* Live discount badge (flash) — mirrors syph's _itemDiscountPercent chip. */}
            {formType === 'flash' && (() => {
              const o = parseFloat(originalPrice.replace(/[^0-9.]/g, '')) || 0;
              const s = parseFloat(price.replace(/[^0-9.]/g, '')) || 0;
              if (!(o > 0 && s > 0 && s < o)) return null;
              const pct = Math.round(((o - s) / o) * 100);
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, padding: '10px 12px', borderRadius: 12, background: 'rgba(229,57,53,0.10)', border: '1px solid rgba(229,57,53,0.35)' }}>
                  <Tag size={16} color="#E53935" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#E53935' }}>{pct}% OFF — buyers see {listingCurrency} {originalPrice.trim()} crossed out</span>
                </div>
              );
            })()}
            {/* Negotiable = on/off switch (SwitchListTile in the app), all variants. */}
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
          </div>
        </div>

        {/* Item Condition */}
        <div style={sectionWrap}>
          {/* Listing = optional label; sponsor/flash = plain "Item Condition". */}
          <SectionLabel color={accent} text={tr(formType === 'listing' ? 'itemConditionOptional' : 'itemConditionLabel', lang)} />
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Info size={20} color={accent} />
              <span style={{ fontWeight: 900, fontSize: 14.5, color: '#1E2B45' }}>{tr(formType === 'listing' ? 'itemConditionOptional' : 'itemConditionLabel', lang)}</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {CONDITION_OPTS.map(({ val, color, bg }) => {
                const Icon = val === 'New' ? BadgeCheck : History;
                const selected = condition === val;
                return (
                  <button
                    key={val}
                    type="button"
                    // Listing is optional + tap-to-clear; sponsor/flash are non-clearing.
                    onClick={() => setCondition((prev) => (formType === 'listing' && prev === val ? '' : val))}
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
          </div>
        </div>

        {/* Specifications */}
        <div style={sectionWrap}>
          <SectionLabel color={accent} text={tr('specifications', lang)} />
          <div style={cardStyle}>
            {/* In-card header: tune icon + title + Add (matches syph _specificationsSection). */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <SlidersHorizontal size={20} color={accent} />
              <span style={{ flex: 1, fontWeight: 900, fontSize: 15, color: '#1E2B45' }}>{tr('specifications', lang)}</span>
              <button onClick={() => setSpecs((p) => [...p, { label: '', value: '' }])} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: accent, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}><Plus size={16} /> {tr('addLabel', lang)}</button>
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#9AA5B8', marginBottom: 12 }}>{tr('specsHelperExample', lang)}</div>
            {specs.map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: i === specs.length - 1 ? 0 : 10 }}>
                <input value={s.label} onChange={(e) => setSpecs((p) => p.map((r, idx) => idx === i ? { ...r, label: e.target.value } : r))} placeholder={tr('specLabelPlaceholder', lang)} style={{ ...inputStyle, flex: 1 }} />
                <input value={s.value} onChange={(e) => setSpecs((p) => p.map((r, idx) => idx === i ? { ...r, value: e.target.value } : r))} placeholder={tr('specValuePlaceholder', lang)} style={{ ...inputStyle, flex: 1 }} />
                {specs.length > 1 && <button onClick={() => setSpecs((p) => p.filter((_, idx) => idx !== i))} style={{ background: '#FFE9E7', border: 'none', borderRadius: 12, width: 44, flexShrink: 0, cursor: 'pointer', color: '#E53935', fontWeight: 900, fontSize: 18 }}>×</button>}
              </div>
            ))}
          </div>
        </div>

        {/* Description */}
        <div style={sectionWrap}>
          <SectionLabel color={accent} text={tr('descriptionLabel', lang)} />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={tr('describeYourItem', lang)} rows={4} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
        </div>

        {/* Bio (sponsor + flash) — sits after Description, before Location (matches the app). */}
        {formType !== 'listing' && (
          <div style={sectionWrap}>
            <SectionLabel color={accent} text={tr('bioLabel', lang)} />
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder={tr('bioHint', lang)} rows={2} style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }} />
          </div>
        )}

        {/* Location — optional (label) for sponsor; required for listing/flash. */}
        <div style={sectionWrap}>
          <SectionLabel color={accent} text={tr(formType === 'sponsor' ? 'locationOptionalLabel' : 'locationLabel', lang)} />
          <div style={{ position: 'relative' }}>
            <MapPin size={16} color="#6B7A99" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
            <input value={locationText} onChange={(e) => setLocationText(e.target.value)} placeholder={tr('exactAreaStreet', lang)} style={{ ...inputStyle, paddingLeft: 40 }} />
          </div>
        </div>

        {/* Message + Units. Listing (app): Units then Message; sponsor & flash: Message then Units. */}
        {(() => {
          const messageBlock = (
            <div key="msg" style={sectionWrap}>
              <SectionLabel color={accent} text={tr('messageAboutGoodsOptional', lang)} />
              <textarea value={messageForBuyers} onChange={(e) => setMessageForBuyers(e.target.value)} placeholder={tr('extraMessageForBuyers', lang)} rows={2} style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }} />
            </div>
          );
          const unitsBlock = (
            <div key="units" style={sectionWrap}>
              <SectionLabel color={accent} text={tr('unitsAvailableOptional', lang)} />
              <input value={units} onChange={(e) => setUnits(e.target.value)} placeholder={tr('unitsHint', lang)} type="number" min="1" style={inputStyle} />
            </div>
          );
          return formType === 'listing' ? [unitsBlock, messageBlock] : [messageBlock, unitsBlock];
        })()}

        {/* Promotion duration (sponsor/flash only). Tiles carry the per-duration
            price with privilege-discount strikethrough — mirrors syph _durationTile. */}
        {formType !== 'listing' && (
          <div style={sectionWrap}>
            <SectionLabel color={accent} text={formType === 'sponsor' ? tr('selectPromotionDuration', lang) : tr('flashSaleDuration', lang)} />
            <div style={cardStyle}>
              <div style={{ display: 'flex', gap: 8 }}>
                {DURATION_OPTS.map((d) => {
                  const priceKey = d <= 7 ? 'days7' : d <= 15 ? 'days15' : 'days30';
                  const catKey = formType === 'sponsor' ? 'upgradeToSponsored' : 'upgradeToFlashSale';
                  const ugx = adminPricing ? (adminPricing[catKey][priceKey] ?? 0) : 0;
                  const cur = getCurrencyForCountry(country || seller?.operatingCountry || '');
                  const hasDiscount = privilegePct > 0 && ugx > 0;
                  const fmt = (u: number) => `${cur} ${Math.round(convertPrice(u, 'UGX', cur)).toLocaleString()}`;
                  const origDisp = ugx > 0 ? fmt(ugx) : (adminPricing ? '—' : '...');
                  const discDisp = hasDiscount ? fmt(ugx * (1 - privilegePct / 100)) : origDisp;
                  const selected = duration === d;
                  const color = formType === 'sponsor' ? '#2F6BFF' : '#E53935';
                  // syph tile icons: sponsor 7/15=lightning, 30=star; flash 7=flash, 15=flame, 30=trophy.
                  const Icon = formType === 'flash'
                    ? (d === 7 ? Zap : d === 15 ? Flame : Trophy)
                    : (d === 30 ? Star : Zap);
                  const selBg = formType === 'flash' ? '#FFEBEE' : '#EAF0FF';
                  return (
                    <button key={d} onClick={() => setDuration(d)} style={{ flex: 1, padding: '18px 10px', borderRadius: 18, border: `${selected ? 2 : 1}px solid ${selected ? color : '#DCE7F5'}`, background: selected ? selBg : '#F5F8FD', cursor: 'pointer', textAlign: 'center', boxShadow: selected ? `0 4px 10px ${color}26` : 'none' }}>
                      <Icon size={22} color={selected ? color : '#8A97B0'} style={{ marginBottom: 6 }} />
                      <div style={{ fontWeight: 900, fontSize: 15, color: selected ? color : '#182033' }}>{d} {tr('daysWord', lang)}</div>
                      {hasDiscount && (
                        <div style={{ fontWeight: 600, fontSize: 10, color: '#8A97B0', textDecoration: 'line-through', marginTop: 4 }}>{origDisp}</div>
                      )}
                      <div style={{ fontWeight: 700, fontSize: 12, marginTop: hasDiscount ? 1 : 4, color: hasDiscount ? '#2E9B55' : (selected ? color : '#8A97B0') }}>{discDisp}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Listing Fee card (normal listing, quota used up) — mirrors syph
            list_item_payment_screen so the seller sees the fee before paying. */}
        {formType === 'listing' && willBePaid && (() => {
          const cur = listingCurrency;
          const hasDiscount = privilegePct > 0;
          const origAmt = Math.round(convertPrice(perListingUgx, 'UGX', cur));
          const discAmt = hasDiscount
            ? Math.round(convertPrice(perListingUgx * (1 - privilegePct / 100), 'UGX', cur))
            : origAmt;
          const fmt = (n: number) => `${cur} ${n.toLocaleString()}`;
          return (
            <div style={sectionWrap}>
              <SectionLabel color={accent} text={tr('listingFeeLabel', lang)} />
              <div style={{ background: '#EAF0FF', borderRadius: 18, border: '1.5px solid #2E5BFF', padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ padding: 12, background: 'rgba(46,91,255,0.12)', borderRadius: 14, display: 'flex', flexShrink: 0 }}>
                  <Receipt size={24} color="#2E5BFF" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 900, fontSize: 14, color: '#1E2B45' }}>{tr('perListingFee', lang)}</div>
                  <div style={{ fontWeight: 600, fontSize: 12, color: '#6B7A99', marginTop: 2 }}>{tr('oneTimeListingFee', lang)}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  {hasDiscount && (
                    <span style={{ fontWeight: 700, fontSize: 12, color: '#8A97B0', textDecoration: 'line-through' }}>{fmt(origAmt)}</span>
                  )}
                  <span style={{ fontWeight: 900, fontSize: 18, color: hasDiscount ? '#2E9B55' : '#2E5BFF' }}>{fmt(discAmt)}</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Submit — flash gets the red gradient + flash icon to match syph. */}
        <button onClick={handleSubmit} disabled={submitting} style={{ width: '100%', padding: 16, marginTop: 8, background: submitting ? '#A0B4E0' : (formType === 'flash' ? 'linear-gradient(90deg, #B71C1C, #E53935)' : 'linear-gradient(90deg, #1D49C6, #2E67F5)'), border: 'none', borderRadius: 18, color: '#fff', fontWeight: 900, fontSize: 16, cursor: submitting ? 'not-allowed' : 'pointer', boxShadow: formType === 'flash' ? '0 6px 14px rgba(229,57,53,0.38)' : '0 6px 14px rgba(46,103,245,0.38)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {submitting ? (
            <><div style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,0.4)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />{tr('submittingEllipsis', lang)}</>
          ) : formType === 'sponsor' ? (
            <><CreditCard size={18} /> {tr('payNowSubmit', lang)}</>
          ) : formType === 'flash' ? (
            <><Zap size={18} /> {tr('payNowSubmit', lang)}</>
          ) : willBePaid ? (
            <><CreditCard size={18} /> {tr('payListingFeeSubmit', lang)}</>
          ) : (
            <><Send size={18} /> {tr('submitForReview', lang)}</>
          )}
        </button>

        {/* Footer note (sponsor + flash) — mirrors syph's info card below Pay Now. */}
        {formType !== 'listing' && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 12, background: '#fff', border: '1px solid #E6ECF5', borderRadius: 14, padding: 14 }}>
            <Info size={20} color="#8A97B0" style={{ flexShrink: 0 }} />
            <span style={{ fontWeight: 700, fontSize: 13, color: '#6B7A99', lineHeight: 1.4 }}>{tr(formType === 'flash' ? 'flashFooterNote' : 'sponsorFooterNote', lang)}</span>
          </div>
        )}
      </div>

      {/* Category picker bottom-sheet (all variants) */}
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
