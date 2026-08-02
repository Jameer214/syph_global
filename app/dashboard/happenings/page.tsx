'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Camera, X, ChevronDown, MapPin, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { sanitizeText } from '@/lib/sanitize';
import { supabase } from '@/lib/supabase';
import { createHappening, getSellerProfile, uploadListingImages } from '@/lib/firestore';
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
  const [currency, setCurrency] = useState('USD');
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      if (!u) { setLoading(false); return; }
      setUid(u.id);
      const sp = await getSellerProfile(u.id).catch(() => null);
      setSeller(sp);
      setLoading(false);
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
    const toAdd = Array.from(files).slice(0, 8 - images.length);
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
    if (!title.trim()) { toast.error(tr('enterTitleToast', lang)); return; }
    if (!description.trim()) { toast.error(tr('enterDescToast', lang)); return; }
    if (!locationText.trim()) { toast.error(tr('enterVenueToast', lang)); return; }
    if (images.length === 0) { toast.error(tr('addOneImageToast', lang)); return; }

    const safeTitle = sanitizeText(title, 100);
    const safeDesc = sanitizeText(description, 1000);
    const safeLocation = sanitizeText(locationText, 200);
    if (!safeTitle) { toast.error(tr('titleEmptyToast', lang)); return; }
    if (!safeDesc) { toast.error(tr('descEmptyToast', lang)); return; }

    setSubmitting(true);
    try {
      const priceValue = price ? (parseFloat(price.replace(/[^0-9.]/g, '')) || 0) : 0;
      await createHappening({
        title: safeTitle,
        description: safeDesc,
        imageUrl: '',
        sellerName: seller.businessName || 'Organiser',
        ownerUid: uid,
        country: seller.operatingCountry,
        regionOrCity: seller.operatingRegion,
        locationText: safeLocation,
        priceText: price ? `${currency} ${price}` : undefined,
        priceValue: priceValue || undefined,
        currencyCode: currency,
        negotiable: false,
        mainCategoryId: selectedMainId || 'happenings',
        openNow: false,
        isSponsored: false,
        isHappening: true,
        isFlashSale: false,
        isTrial: false,
      }, images);
      toast.success(tr('happeningSubmitted', lang));
      setShowForm(false);
      setTitle(''); setDescription(''); setLocationText('');
      setSelectedMainId(''); setPrice('');
      setImages([]); setImagePreviews([]);
    } catch {
      toast.error(tr('failedSubmitRetry', lang));
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

          {/* Photos */}
          <div style={{ background: '#fff', borderRadius: 20, padding: 18, marginBottom: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <label style={labelStyle}>{tr('photosLabel', lang)} ({images.length}/8)</label>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {imagePreviews.map((url, i) => (
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

          {/* Info */}
          <div style={{ background: '#fff', borderRadius: 20, padding: 18, marginBottom: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ fontWeight: 900, fontSize: 15, color: '#1E2B45', marginBottom: 16 }}>{tr('happeningDetails', lang)}</div>
            <label style={labelStyle}>{tr('listingTitle', lang)} *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tr('eventTitlePlaceholder', lang)} style={inputStyle} />
            <label style={{ ...labelStyle, marginTop: 14 }}>{tr('listingDescription', lang)} *</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={tr('describeEventPlaceholder', lang)} rows={4} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
            <label style={{ ...labelStyle, marginTop: 14 }}>{tr('venueLocation', lang)} *</label>
            <div style={{ position: 'relative' }}>
              <MapPin size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input value={locationText} onChange={(e) => setLocationText(e.target.value)} placeholder={tr('venuePlaceholder', lang)} style={{ ...inputStyle, paddingLeft: 40 }} />
            </div>
          </div>

          {/* Category */}
          <div style={{ background: '#fff', borderRadius: 20, padding: 18, marginBottom: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ fontWeight: 900, fontSize: 15, color: '#1E2B45', marginBottom: 12 }}>{tr('category', lang)}</div>
            <div style={{ position: 'relative' }}>
              <select value={selectedMainId} onChange={(e) => setSelectedMainId(e.target.value)} style={{ ...inputStyle, paddingRight: 28, appearance: 'none' }}>
                <option value="">{tr('selectCategory', lang)}</option>
                {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{trCategory(c.id, c.title, lang)}</option>)}
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6B7A99' }} />
            </div>
          </div>

          {/* Price (optional) */}
          <div style={{ background: '#fff', borderRadius: 20, padding: 18, marginBottom: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ fontWeight: 900, fontSize: 15, color: '#1E2B45', marginBottom: 12 }}>{tr('ticketEntryPrice', lang)} ({tr('optionalLabel', lang)})</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={{ ...inputStyle, width: 100, paddingRight: 28, appearance: 'none' }}>
                  {['USD', 'UGX', 'KES', 'TZS', 'GHS', 'NGN', 'ZAR'].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6B7A99' }} />
              </div>
              <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder={tr('freePricePlaceholder', lang)} type="number" style={{ ...inputStyle, flex: 1 }} />
            </div>
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
            ) : tr('postHappening', lang)}
          </button>
        </div>
      )}
    </div>
  );
}
