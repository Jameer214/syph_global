'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Camera, X, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { sanitizeText } from '@/lib/sanitize';
import { supabase } from '@/lib/supabase';
import { getListing, updateListing, uploadListingImages } from '@/lib/firestore';
import { CATEGORIES } from '@/data/categories';
import { useAppStore } from '@/store';
import { translate as tr, trCategory } from '@/lib/i18n';
import type { Listing } from '@/types';

const CURRENCIES = ['USD', 'UGX', 'KES', 'TZS', 'RWF', 'ETB', 'GHS', 'NGN', 'ZAR'];
// Canonical English values stored to DB — only the display is translated.
const CONDITIONS = ['New', 'Used', 'Refurbished'];
const CONDITION_KEYS: Record<string, string> = { New: 'conditionNew', Used: 'conditionUsed', Refurbished: 'conditionRefurbished' };

export default function EditListingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { selectedLanguage: lang } = useAppStore();

  const [uid, setUid] = useState<string | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);

  // form state
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
  const [units, setUnits] = useState('');
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) { setLoading(false); return; }
      setUid(session.user.id);
    });
  }, []);

  useEffect(() => {
    if (!id) return;
    let currentUid = '';
    supabase.auth.getSession().then(({ data: { session } }) => { currentUid = session?.user?.id ?? ''; });
    getListing(id).then((l) => {
      if (!l) { setLoading(false); return; }
      // IDOR guard: redirect immediately if not the owner
      if (l.ownerUid && currentUid && l.ownerUid !== currentUid) {
        router.replace('/dashboard');
        return;
      }
      setListing(l);
      setTitle(l.title);
      setDescription(l.description);
      setMessageForBuyers(l.messageAboutGoods ?? '');
      setCurrency(l.currencyCode);
      setPrice(l.priceValue != null ? String(l.priceValue) : '');
      setNegotiable(l.negotiable);
      setCondition(l.condition ?? 'New');
      setSelectedMainId(l.mainCategoryId ?? '');
      setSelectedSubId(l.subCategoryId ?? '');
      setCountry(l.country ?? '');
      setRegion(l.regionOrCity ?? '');
      setLocationText(l.locationText ?? '');
      const imgs = l.imageUrls?.length ? l.imageUrls : l.imageUrl ? [l.imageUrl] : [];
      setExistingImages(imgs);
      setUnits(l.units != null ? String(l.units) : '');
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  function handleImagePick(files: FileList | null) {
    if (!files) return;
    const total = existingImages.length + newImages.length;
    const toAdd = Array.from(files).slice(0, 8 - total);
    setNewImages((prev) => [...prev, ...toAdd]);
    toAdd.forEach((f) => setNewImagePreviews((prev) => [...prev, URL.createObjectURL(f)]));
  }

  function removeExistingImage(idx: number) {
    setExistingImages((prev) => prev.filter((_, i) => i !== idx));
  }

  function removeNewImage(idx: number) {
    URL.revokeObjectURL(newImagePreviews[idx]);
    setNewImages((prev) => prev.filter((_, i) => i !== idx));
    setNewImagePreviews((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
    if (!uid || !listing) { toast.error(tr('notAuthorised', lang)); return; }
    if (listing.ownerUid !== uid) { toast.error(tr('notYourListing', lang)); return; }
    if (!title.trim()) { toast.error(tr('enterTitleToast', lang)); return; }
    if (!description.trim()) { toast.error(tr('enterDescToast', lang)); return; }
    if (!price.trim()) { toast.error(tr('enterPriceToast', lang)); return; }
    if (existingImages.length + newImages.length === 0) { toast.error(tr('addOneImageToast', lang)); return; }

    const safeTitle = sanitizeText(title, 100);
    const safeDesc = sanitizeText(description, 1000);
    const safeLocation = sanitizeText(locationText, 200);
    const safeMessage = sanitizeText(messageForBuyers, 500);
    if (!safeTitle) { toast.error(tr('titleEmptyToast', lang)); return; }
    if (!safeDesc) { toast.error(tr('descEmptyToast', lang)); return; }

    setSubmitting(true);
    try {
      let uploadedUrls: string[] = [];
      if (newImages.length > 0) {
        uploadedUrls = await uploadListingImages(uid, newImages);
      }
      const allImages = [...existingImages, ...uploadedUrls];
      const priceValue = parseFloat(price.replace(/[^0-9.]/g, '')) || 0;
      await updateListing(id, {
        title: safeTitle,
        description: safeDesc,
        messageAboutGoods: safeMessage || undefined,
        priceText: `${currency} ${price}`,
        priceValue,
        currencyCode: currency,
        negotiable,
        condition,
        mainCategoryId: selectedMainId,
        subCategoryId: selectedSubId || undefined,
        country,
        regionOrCity: region,
        locationText: safeLocation,
        imageUrl: allImages[0] ?? '',
        imageUrls: allImages,
        units: units.trim() ? (parseInt(units.trim(), 10) || undefined) : undefined,
      });
      toast.success(tr('listingUpdated', lang));
      router.push('/dashboard');
    } catch {
      toast.error(tr('failedUpdateRetry', lang));
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 16px', border: '1.5px solid #E0E8F0',
    borderRadius: 14, fontSize: 15, outline: 'none', background: '#F8FAFF',
    boxSizing: 'border-box', fontFamily: 'inherit',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontWeight: 800, fontSize: 13, color: '#4A5878', marginBottom: 6,
  };
  const sectionStyle: React.CSSProperties = {
    background: '#fff', borderRadius: 20, padding: 18, marginBottom: 14,
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  };

  const mainCategory = CATEGORIES.find((c) => c.id === selectedMainId);
  const subCategories = mainCategory?.children ?? [];
  const totalImages = existingImages.length + newImages.length;

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
        <div style={{ fontWeight: 900, fontSize: 18, color: '#1E2B45' }}>{tr('signInToEdit', lang)}</div>
        <button onClick={() => router.push('/login')} style={{ marginTop: 20, background: '#2E5BFF', color: '#fff', border: 'none', borderRadius: 14, padding: '12px 32px', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>{tr('signIn', lang)}</button>
      </div>
    );
  }

  if (!listing) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#F0F4FF', padding: 24 }}>
        <div style={{ fontWeight: 900, fontSize: 18, color: '#1E2B45' }}>{tr('listingNotFound', lang)}</div>
        <button onClick={() => router.back()} style={{ marginTop: 16, color: '#2E5BFF', background: 'none', border: 'none', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>{tr('goBack', lang)}</button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#F0F4FF' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0F2B6E, #1E4DD9)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 40 }}>
        <button onClick={() => router.back()} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, padding: 8, cursor: 'pointer', display: 'flex' }}>
          <ArrowLeft size={20} color="#fff" />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#fff', fontWeight: 900, fontSize: 18 }}>{tr('editListing', lang)}</div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 }}>{tr('updateListingDetails', lang)}</div>
        </div>
      </div>

      <div style={{ padding: '16px 16px 100px' }}>

        {/* Photos */}
        <div style={sectionStyle}>
          <label style={labelStyle}>{tr('photosLabel', lang)} ({totalImages}/8)</label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {existingImages.map((url, i) => (
              <div key={`existing-${i}`} style={{ position: 'relative', width: 80, height: 80 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 12 }} />
                <button onClick={() => removeExistingImage(i)} style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, background: '#E53935', border: '2px solid #fff', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                  <X size={11} color="#fff" />
                </button>
              </div>
            ))}
            {newImagePreviews.map((url, i) => (
              <div key={`new-${i}`} style={{ position: 'relative', width: 80, height: 80 }}>
                <Image src={url} alt="" fill style={{ objectFit: 'cover', borderRadius: 12 }} />
                <button onClick={() => removeNewImage(i)} style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, background: '#E53935', border: '2px solid #fff', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                  <X size={11} color="#fff" />
                </button>
              </div>
            ))}
            {totalImages < 8 && (
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
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={{ ...inputStyle, width: 100, paddingRight: 28, appearance: 'none' }}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6B7A99' }} />
            </div>
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
              <button key={c} onClick={() => setCondition(c)}
                style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: `2px solid ${condition === c ? '#2E5BFF' : '#e2e8f0'}`, background: condition === c ? '#EEF3FF' : '#fff', color: condition === c ? '#2E5BFF' : '#6B7A99', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                {tr(CONDITION_KEYS[c], lang)}
              </button>
            ))}
          </div>
        </div>

        {/* Category */}
        <div style={sectionStyle}>
          <div style={{ fontWeight: 900, fontSize: 15, color: '#1E2B45', marginBottom: 16 }}>{tr('category', lang)}</div>
          <label style={labelStyle}>{tr('mainCategoryLabel', lang)} *</label>
          <div style={{ position: 'relative', marginBottom: 14 }}>
            <select value={selectedMainId} onChange={(e) => { setSelectedMainId(e.target.value); setSelectedSubId(''); }} style={{ ...inputStyle, paddingRight: 28, appearance: 'none' }}>
              <option value="">{tr('selectCategory', lang)}</option>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{trCategory(c.id, c.title, lang)}</option>)}
            </select>
            <ChevronDown size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6B7A99' }} />
          </div>
          {subCategories.length > 0 && (
            <>
              <label style={labelStyle}>{tr('subcategoryField', lang)}</label>
              <div style={{ position: 'relative' }}>
                <select value={selectedSubId} onChange={(e) => setSelectedSubId(e.target.value)} style={{ ...inputStyle, paddingRight: 28, appearance: 'none' }}>
                  <option value="">{tr('selectSubcategory', lang)}</option>
                  {subCategories.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                </select>
                <ChevronDown size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6B7A99' }} />
              </div>
            </>
          )}
        </div>

        {/* Location */}
        <div style={sectionStyle}>
          <div style={{ fontWeight: 900, fontSize: 15, color: '#1E2B45', marginBottom: 16 }}>{tr('locationLabel', lang)}</div>
          <label style={labelStyle}>{tr('countryField', lang)}</label>
          <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder={tr('countryPlaceholder', lang)} style={inputStyle} />
          <label style={{ ...labelStyle, marginTop: 14 }}>{tr('regionCity', lang)}</label>
          <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder={tr('cityPlaceholder', lang)} style={{ ...inputStyle }} />
          <label style={{ ...labelStyle, marginTop: 14 }}>{tr('exactLocation', lang)}</label>
          <input value={locationText} onChange={(e) => setLocationText(e.target.value)} placeholder={tr('locationPlaceholder', lang)} style={{ ...inputStyle }} />
        </div>
      </div>

      {/* Sticky submit */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: '#fff', borderTop: '1px solid #eef2f8', padding: '12px 16px 24px' }}>
        <button onClick={handleSubmit} disabled={submitting}
          style={{ width: '100%', height: 52, borderRadius: 26, border: 'none', background: submitting ? '#9ca3af' : '#2E5BFF', color: '#fff', fontWeight: 900, fontSize: 16, cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {submitting ? (
            <><span style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> {tr('savingEllipsis', lang)}</>
          ) : tr('saveChanges', lang)}
        </button>
      </div>
    </div>
  );
}
