'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Camera, X, ChevronDown, MapPin } from 'lucide-react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { createListing, getSellerProfile } from '@/lib/firestore';
import { getCurrencyForCountry, convertPrice } from '@/lib/currency';
import { CATEGORIES } from '@/data/categories';
import type { SellerProfile } from '@/types';
import toast from 'react-hot-toast';
import { sanitizeText } from '@/lib/sanitize';

const CURRENCIES = ['USD', 'UGX', 'KES', 'TZS', 'RWF', 'ETB', 'GHS', 'NGN', 'ZAR'];
const CONDITIONS = ['New', 'Used', 'Refurbished'];
const DURATION_OPTS = [7, 15, 30];

type FormType = 'listing' | 'sponsor' | 'flash';

interface AdminPricing {
  upgradeToSponsored: Record<string, number>;
  upgradeToFlashSale: Record<string, number>;
  happenings: Record<string, number>;
}

const HEADERS: Record<FormType, { gradient: string; title: string; subtitle: string }> = {
  listing: { gradient: 'linear-gradient(135deg, #0F2B6E, #1E4DD9)', title: 'New Listing', subtitle: 'List your item for buyers to discover' },
  sponsor: { gradient: 'linear-gradient(135deg, #C67200, #E89A00)', title: 'Sponsor My Item', subtitle: 'Boost your listing\'s visibility' },
  flash:   { gradient: 'linear-gradient(135deg, #C62828, #E53935)', title: 'Flash Sale', subtitle: 'Create a time-limited flash sale offer' },
};

export default function NewListingForm() {
  const router = useRouter();
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
  const [submitting, setSubmitting] = useState(false);

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
    });
  }, []);

  useEffect(() => {
    // Admin pricing not in Supabase — use defaults
    setAdminPricing({ upgradeToSponsored: {}, upgradeToFlashSale: {}, happenings: {} });
  }, []);

  const mainCategory = CATEGORIES.find((c) => c.id === selectedMainId);
  const subCategories = mainCategory?.children ?? [];

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
    if (ugx <= 0) return adminPricing ? 'Contact support' : 'Loading...';
    const sellerCurrency = getCurrencyForCountry(country || seller?.operatingCountry || '');
    const converted = convertPrice(ugx, 'UGX', sellerCurrency);
    return `${sellerCurrency} ${Math.round(converted).toLocaleString()}`;
  }

  async function handleSubmit() {
    if (!uid || !seller) { toast.error('Please complete seller setup first.'); router.push('/dashboard/setup'); return; }
    if (!title.trim()) { toast.error('Please enter a title.'); return; }
    if (!selectedMainId) { toast.error('Please select a category.'); return; }
    if (!description.trim()) { toast.error('Please enter a description.'); return; }
    if (!price.trim()) { toast.error('Please enter a price.'); return; }
    if (images.length === 0) { toast.error('Please add at least one image.'); return; }
    if (!locationText.trim()) { toast.error('Please enter your location.'); return; }

    const safeTitle = sanitizeText(title, 100);
    const safeDesc = sanitizeText(description, 1000);
    const safeLocation = sanitizeText(locationText, 200);
    const safeMessage = sanitizeText(messageForBuyers, 500);
    if (!safeTitle) { toast.error('Title cannot be empty.'); return; }
    if (!safeDesc) { toast.error('Description cannot be empty.'); return; }

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
        const ugx = getPriceUgx();
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
      } else {
        toast.success('Listing submitted for review!');
        router.push('/dashboard');
      }
    } catch {
      toast.error('Failed to submit. Please try again.');
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
        <div style={{ fontWeight: 900, fontSize: 18, color: '#1E2B45' }}>Sign in to list an item</div>
        <button onClick={() => router.push('/login')} style={{ marginTop: 20, background: '#2E5BFF', color: '#fff', border: 'none', borderRadius: 14, padding: '12px 32px', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>Sign In</button>
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
          <div style={{ color: '#fff', fontWeight: 900, fontSize: 20 }}>{hdr.title}</div>
          <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 4 }}>{hdr.subtitle}</div>
        </div>
      </div>

      <div style={{ padding: '16px 16px 100px' }}>

        {/* Photos */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Photos ({images.length}/8)</label>
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
                <span style={{ fontSize: 10, color: '#6B7A99', fontWeight: 700 }}>Add</span>
              </button>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => handleImagePick(e.target.files)} />
        </div>

        {/* Item info */}
        <div style={sectionStyle}>
          <div style={{ fontWeight: 900, fontSize: 15, color: '#1E2B45', marginBottom: 16 }}>Item Information</div>
          <label style={labelStyle}>Title *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. iPhone 14 Pro Max" style={inputStyle} />
          <label style={{ ...labelStyle, marginTop: 14 }}>Description *</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe your item..." rows={4} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
          <label style={{ ...labelStyle, marginTop: 14 }}>Message for buyers</label>
          <textarea value={messageForBuyers} onChange={(e) => setMessageForBuyers(e.target.value)} placeholder="Any special instructions..." rows={2} style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }} />
        </div>

        {/* Price */}
        <div style={sectionStyle}>
          <div style={{ fontWeight: 900, fontSize: 15, color: '#1E2B45', marginBottom: 16 }}>Pricing</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={{ ...inputStyle, width: 100, flexShrink: 0 }}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" type="number" style={{ ...inputStyle, flex: 1 }} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={negotiable} onChange={() => setNegotiable(!negotiable)} style={{ width: 18, height: 18, accentColor: '#2E5BFF', cursor: 'pointer' }} />
            <span style={{ fontWeight: 700, color: '#4A5878', fontSize: 14 }}>Price is negotiable</span>
          </label>
        </div>

        {/* Condition */}
        <div style={sectionStyle}>
          <div style={{ fontWeight: 900, fontSize: 15, color: '#1E2B45', marginBottom: 12 }}>Condition</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {CONDITIONS.map((c) => (
              <button key={c} onClick={() => setCondition(c)} style={{ flex: 1, padding: '10px 0', borderRadius: 14, border: 'none', background: condition === c ? '#2E5BFF' : '#F0F4FF', color: condition === c ? '#fff' : '#4A5878', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{c}</button>
            ))}
          </div>
        </div>

        {/* Category */}
        <div style={sectionStyle}>
          <div style={{ fontWeight: 900, fontSize: 15, color: '#1E2B45', marginBottom: 16 }}>Category</div>
          <label style={labelStyle}>Main Category *</label>
          <div style={{ position: 'relative' }}>
            <select value={selectedMainId} onChange={(e) => { setSelectedMainId(e.target.value); setSelectedSubId(''); }} style={{ ...inputStyle, appearance: 'none' }}>
              <option value="">Select category...</option>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
            <ChevronDown size={16} color="#6B7A99" style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          </div>
          {subCategories.length > 0 && (
            <>
              <label style={{ ...labelStyle, marginTop: 12 }}>Sub-Category</label>
              <div style={{ position: 'relative' }}>
                <select value={selectedSubId} onChange={(e) => setSelectedSubId(e.target.value)} style={{ ...inputStyle, appearance: 'none' }}>
                  <option value="">Select sub-category...</option>
                  {subCategories.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                </select>
                <ChevronDown size={16} color="#6B7A99" style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              </div>
            </>
          )}
        </div>

        {/* Location */}
        <div style={sectionStyle}>
          <div style={{ fontWeight: 900, fontSize: 15, color: '#1E2B45', marginBottom: 16 }}>Location</div>
          <label style={labelStyle}>Country</label>
          <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. Uganda" style={inputStyle} />
          <label style={{ ...labelStyle, marginTop: 12 }}>Region / City</label>
          <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="e.g. Kampala" style={inputStyle} />
          <label style={{ ...labelStyle, marginTop: 12 }}>Exact Location *</label>
          <div style={{ position: 'relative' }}>
            <MapPin size={16} color="#6B7A99" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
            <input value={locationText} onChange={(e) => setLocationText(e.target.value)} placeholder="e.g. Nakawa, Kampala" style={{ ...inputStyle, paddingLeft: 40 }} />
          </div>
        </div>

        {/* Promotion duration + pricing (sponsor/flash only) */}
        {formType !== 'listing' && (
          <div style={sectionStyle}>
            <div style={{ fontWeight: 900, fontSize: 15, color: '#1E2B45', marginBottom: 16 }}>
              {formType === 'sponsor' ? 'Sponsorship' : 'Flash Sale'} Duration
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
                    <div style={{ fontWeight: 900, fontSize: 13, color: selected ? color : '#182033' }}>{d} days</div>
                    <div style={{ fontWeight: 700, fontSize: 11.5, color: selected ? color : '#6B7A99', marginTop: 4 }}>{displayAmt}</div>
                  </button>
                );
              })}
            </div>

            {/* Summary */}
            <div style={{ background: formType === 'sponsor' ? '#EEF3FF' : '#FFF0F0', borderRadius: 14, padding: 14, marginTop: 14, border: `1px solid ${formType === 'sponsor' ? '#C0D0FF' : '#FFCDD2'}` }}>
              {[
                { label: 'Type', value: formType === 'sponsor' ? 'Sponsored' : 'Flash Sale' },
                { label: 'Duration', value: `${duration} days` },
                { label: 'Price', value: getDisplayPrice() },
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
            <><div style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,0.4)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />Submitting…</>
          ) : (
            formType === 'listing' ? 'Submit Listing' : 'Continue to Payment'
          )}
        </button>
      </div>
    </div>
  );
}
