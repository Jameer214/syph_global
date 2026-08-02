'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Camera, X, ChevronDown, MapPin } from 'lucide-react';
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

type FormType = 'listing' | 'sponsor' | 'flash';

interface AdminPricing {
  upgradeToSponsored: Record<string, number>;
  upgradeToFlashSale: Record<string, number>;
  happenings: Record<string, number>;
}

const HEADERS: Record<FormType, { gradient: string; titleKey: string; subtitleKey: string }> = {
  listing: { gradient: 'linear-gradient(135deg, #0F2B6E, #1E4DD9)', titleKey: 'newListing', subtitleKey: 'listItemSubtitle' },
  sponsor: { gradient: 'linear-gradient(135deg, #C67200, #E89A00)', titleKey: 'featSponsorTitle', subtitleKey: 'boostVisibilitySub' },
  flash:   { gradient: 'linear-gradient(135deg, #C62828, #E53935)', titleKey: 'flashSaleLabel', subtitleKey: 'flashSaleSubtitle' },
};

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
  const [condition, setCondition] = useState('New');
  const [selectedMainId, setSelectedMainId] = useState('');
  const [selectedSubId, setSelectedSubId] = useState('');
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [locationText, setLocationText] = useState('');
  const [duration, setDuration] = useState(7);
  const [units, setUnits] = useState('');
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
    const newFiles = Array.from(files).slice(0, 8 - images.length);
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
    if (!title.trim()) { toast.error(tr('enterTitleToast', lang)); return; }
    if (!selectedMainId) { toast.error(tr('selectCategoryToast', lang)); return; }
    if (!description.trim()) { toast.error(tr('enterDescToast', lang)); return; }
    if (!price.trim()) { toast.error(tr('enterPriceToast', lang)); return; }
    if (images.length === 0) { toast.error(tr('addOneImageToast', lang)); return; }
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
      const listingId = await createListing({
        title: safeTitle,
        description: safeDesc,
        imageUrl: '',
        sellerName: seller.businessName || 'Seller',
        ownerUid: uid,
        country: country || seller.operatingCountry,
        regionOrCity: region || seller.operatingRegion,
        locationText: safeLocation,
        priceText: `${currency} ${price}`,
        priceValue,
        currencyCode: currency,
        negotiable,
        messageAboutGoods: safeMessage || undefined,
        units: units.trim() ? (parseInt(units.trim(), 10) || undefined) : undefined,
        mainCategoryId: selectedMainId,
        subCategoryId: selectedSubId || undefined,
        condition,
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
  const inputStyle: React.CSSProperties = { width: '100%', padding: '12px 16px', border: '1.5px solid #E0E8F0', borderRadius: 14, fontSize: 15, outline: 'none', background: '#F8FAFF', boxSizing: 'border-box', fontFamily: 'inherit' };
  const labelStyle: React.CSSProperties = { display: 'block', fontWeight: 800, fontSize: 13, color: '#4A5878', marginBottom: 6 };
  const sectionStyle: React.CSSProperties = { background: '#fff', borderRadius: 20, padding: 18, marginBottom: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' };

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
          <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 4 }}>{tr(hdr.subtitleKey, lang)}</div>
        </div>
      </div>

      <div style={{ padding: '16px 16px 100px' }}>

        {/* Free-15 quota banner (normal listings, while the promo is active) */}
        {formType === 'listing' && countLoaded && pricing && promoActive && (
          <div style={{
            background: listingIsFree ? '#EAF7EE' : '#FFF4E5',
            border: `1px solid ${listingIsFree ? 'rgba(46,157,85,0.3)' : 'rgba(224,138,0,0.35)'}`,
            borderRadius: 14, padding: '12px 14px', marginBottom: 14,
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

        {/* Photos */}
        <div style={sectionStyle}>
          <label style={labelStyle}>{tr('photosLabel', lang)} ({images.length}/8)</label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {imagePreviewUrls.map((url, i) => (
              <div key={i} style={{ position: 'relative', width: 80, height: 80 }}>
                <Image src={url} alt="" fill style={{ objectFit: 'cover', borderRadius: 12 }} />
                <button onClick={() => removeImage(i)} style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, background: '#E53935', border: '2px solid #fff', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                  <X size={11} color="#fff" />
                </button>
              </div>
            ))}
            {images.length < 8 && (
              <button onClick={() => fileInputRef.current?.click()} style={{ width: 80, height: 80, background: '#F0F4FF', border: '2px dashed #A0B4E0', borderRadius: 12, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <Camera size={22} color="#6B7A99" />
                <span style={{ fontSize: 10, color: '#6B7A99', fontWeight: 700 }}>{tr('addLabel', lang)}</span>
              </button>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => handleImagePick(e.target.files)} />
        </div>

        {/* Item info */}
        <div style={sectionStyle}>
          <div style={{ fontWeight: 900, fontSize: 15, color: '#1E2B45', marginBottom: 16 }}>{tr('itemInformation', lang)}</div>
          <label style={labelStyle}>{tr('listingTitle', lang)} *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tr('titlePlaceholder', lang)} style={inputStyle} />
          <label style={{ ...labelStyle, marginTop: 14 }}>{tr('listingDescription', lang)} *</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={tr('descPlaceholder', lang)} rows={4} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
          <label style={{ ...labelStyle, marginTop: 14 }}>{tr('messageForBuyers', lang)}</label>
          <textarea value={messageForBuyers} onChange={(e) => setMessageForBuyers(e.target.value)} placeholder={tr('specialInstructions', lang)} rows={2} style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }} />
          <label style={{ ...labelStyle, marginTop: 14 }}>{tr('unitsAvailable', lang)} <span style={{ fontWeight: 600, color: '#9ca3af' }}>({tr('optionalLabel', lang)})</span></label>
          <input value={units} onChange={(e) => setUnits(e.target.value)} placeholder="e.g. 10" type="number" min="1" style={inputStyle} />
        </div>

        {/* Price */}
        <div style={sectionStyle}>
          <div style={{ fontWeight: 900, fontSize: 15, color: '#1E2B45', marginBottom: 16 }}>{tr('pricingSection', lang)}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={{ ...inputStyle, width: 100, flexShrink: 0 }}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" type="number" style={{ ...inputStyle, flex: 1 }} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={negotiable} onChange={() => setNegotiable(!negotiable)} style={{ width: 18, height: 18, accentColor: '#2E5BFF', cursor: 'pointer' }} />
            <span style={{ fontWeight: 700, color: '#4A5878', fontSize: 14 }}>{tr('negotiableLabel', lang)}</span>
          </label>
        </div>

        {/* Condition */}
        <div style={sectionStyle}>
          <div style={{ fontWeight: 900, fontSize: 15, color: '#1E2B45', marginBottom: 12 }}>{tr('listingCondition', lang)}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {CONDITIONS.map((c) => (
              <button key={c} onClick={() => setCondition(c)} style={{ flex: 1, padding: '10px 0', borderRadius: 14, border: 'none', background: condition === c ? '#2E5BFF' : '#F0F4FF', color: condition === c ? '#fff' : '#4A5878', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{tr(CONDITION_KEYS[c], lang)}</button>
            ))}
          </div>
        </div>

        {/* Category */}
        <div style={sectionStyle}>
          <div style={{ fontWeight: 900, fontSize: 15, color: '#1E2B45', marginBottom: 16 }}>{tr('category', lang)}</div>
          <label style={labelStyle}>{tr('mainCategoryLabel', lang)} *</label>
          <div style={{ position: 'relative' }}>
            <select value={selectedMainId} onChange={(e) => { setSelectedMainId(e.target.value); setSelectedSubId(''); }} style={{ ...inputStyle, appearance: 'none' }}>
              <option value="">{tr('selectCategory', lang)}...</option>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{trCategory(c.id, c.title, lang)}</option>)}
            </select>
            <ChevronDown size={16} color="#6B7A99" style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          </div>
          {subCategories.length > 0 && (
            <>
              <label style={{ ...labelStyle, marginTop: 12 }}>{tr('subcategoryField', lang)}</label>
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

        {/* Location */}
        <div style={sectionStyle}>
          <div style={{ fontWeight: 900, fontSize: 15, color: '#1E2B45', marginBottom: 16 }}>{tr('locationLabel', lang)}</div>
          <label style={labelStyle}>{tr('countryField', lang)}</label>
          <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder={tr('countryPlaceholder', lang)} style={inputStyle} />
          <label style={{ ...labelStyle, marginTop: 12 }}>{tr('regionCity', lang)}</label>
          <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder={tr('cityPlaceholder', lang)} style={inputStyle} />
          <label style={{ ...labelStyle, marginTop: 12 }}>{tr('exactLocation', lang)} *</label>
          <div style={{ position: 'relative' }}>
            <MapPin size={16} color="#6B7A99" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
            <input value={locationText} onChange={(e) => setLocationText(e.target.value)} placeholder={tr('locationPlaceholder', lang)} style={{ ...inputStyle, paddingLeft: 40 }} />
          </div>
        </div>

        {/* Promotion duration + pricing (sponsor/flash only) */}
        {formType !== 'listing' && (
          <div style={sectionStyle}>
            <div style={{ fontWeight: 900, fontSize: 15, color: '#1E2B45', marginBottom: 16 }}>
              {formType === 'sponsor' ? tr('sponsorshipDuration', lang) : tr('flashSaleDuration', lang)}
            </div>

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
                  <button key={d} onClick={() => setDuration(d)} style={{ flex: 1, padding: '14px 8px', borderRadius: 16, border: `${selected ? 2 : 1}px solid ${selected ? color : 'rgba(0,0,0,0.07)'}`, background: selected ? `${color}14` : '#fff', cursor: 'pointer', textAlign: 'center' }}>
                    <div style={{ fontWeight: 900, fontSize: 13, color: selected ? color : '#182033' }}>{d} {tr('daysWord', lang)}</div>
                    <div style={{ fontWeight: 700, fontSize: 11.5, color: selected ? color : '#6B7A99', marginTop: 4 }}>{displayAmt}</div>
                  </button>
                );
              })}
            </div>

            {/* Summary */}
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
        )}

        {/* Submit */}
        <button onClick={handleSubmit} disabled={submitting} style={{ width: '100%', padding: 16, background: submitting ? '#A0B4E0' : hdr.gradient, border: 'none', borderRadius: 18, color: '#fff', fontWeight: 900, fontSize: 16, cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {submitting ? (
            <><div style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,0.4)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />{tr('submittingEllipsis', lang)}</>
          ) : (
            (formType === 'listing' && !willBePaid) ? tr('submitListing', lang) : tr('continueToPayment', lang)
          )}
        </button>
      </div>
    </div>
  );
}
