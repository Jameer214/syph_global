'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Camera, X, ChevronDown, MapPin, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { createHappening, getSellerProfile, uploadListingImages } from '@/lib/firestore';
import { CATEGORIES } from '@/data/categories';
import type { Listing, SellerProfile } from '@/types';

function mapListing(data: Record<string, unknown>, id: string): Listing {
  return {
    id, title: String(data.title ?? ''), description: String(data.description ?? ''),
    imageUrl: String(data.imageUrl ?? ''),
    imageUrls: Array.isArray(data.imageUrls) ? (data.imageUrls as string[]) : undefined,
    sellerName: String(data.sellerName ?? ''), ownerUid: String(data.ownerUid ?? ''),
    country: String(data.country ?? ''), regionOrCity: String(data.regionOrCity ?? ''),
    locationText: String(data.locationText ?? ''),
    priceText: data.priceText ? String(data.priceText) : undefined,
    priceValue: typeof data.priceValue === 'number' ? data.priceValue : undefined,
    currencyCode: String(data.currencyCode ?? 'USD'),
    negotiable: Boolean(data.negotiable), mainCategoryId: String(data.mainCategoryId ?? ''),
    openNow: Boolean(data.openNow), isSponsored: Boolean(data.isSponsored),
    isHappening: Boolean(data.isHappening), isFlashSale: Boolean(data.isFlashSale),
    isTrial: Boolean(data.isTrial), status: String(data.status ?? 'pending'),
    viewsCount: typeof data.viewsCount === 'number' ? data.viewsCount : 0,
    savesCount: typeof data.savesCount === 'number' ? data.savesCount : 0,
    messagesCount: typeof data.messagesCount === 'number' ? data.messagesCount : 0,
    createdAt: data.createdAt ? String(data.createdAt) : undefined,
  };
}

const STATUS_COLORS: Record<string, string> = { approved: '#2E9B55', pending: '#F39C12', rejected: '#E53935' };
const STATUS_BG: Record<string, string> = { approved: '#E8F5E9', pending: '#FFF8EE', rejected: '#FFECEC' };

export default function HappeningsPage() {
  const router = useRouter();
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
      .from('happenings')
      .select('*')
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
    if (!uid || !seller) { toast.error('Complete seller setup first.'); return; }
    if (!title.trim()) { toast.error('Enter a title.'); return; }
    if (!description.trim()) { toast.error('Enter a description.'); return; }
    if (!locationText.trim()) { toast.error('Enter the venue location.'); return; }
    if (images.length === 0) { toast.error('Add at least one image.'); return; }

    setSubmitting(true);
    try {
      const priceValue = price ? (parseFloat(price.replace(/[^0-9.]/g, '')) || 0) : 0;
      await createHappening({
        title: title.trim(),
        description: description.trim(),
        imageUrl: '',
        sellerName: seller.businessName || 'Organiser',
        ownerUid: uid,
        country: seller.operatingCountry,
        regionOrCity: seller.operatingRegion,
        locationText: locationText.trim(),
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
      toast.success('Happening submitted for review!');
      setShowForm(false);
      setTitle(''); setDescription(''); setLocationText('');
      setSelectedMainId(''); setPrice('');
      setImages([]); setImagePreviews([]);
    } catch {
      toast.error('Failed to submit. Try again.');
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
            <div style={{ color: '#fff', fontWeight: 900, fontSize: 18 }}>{showForm ? 'Post Happening' : 'My Happenings'}</div>
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 }}>
              {showForm ? 'Share your event with buyers' : 'Manage your events & experiences'}
            </div>
          </div>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 10, padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#fff', fontWeight: 700, fontSize: 13 }}>
            <Plus size={16} /> New
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
              <p style={{ margin: '0 0 8px', fontWeight: 900, fontSize: 18, color: '#0F2B6E' }}>No Happenings Yet</p>
              <p style={{ margin: '0 0 20px', fontSize: 14, fontWeight: 600, color: '#9ca3af', lineHeight: 1.5 }}>
                Post events, concerts, markets, and more for buyers to discover.
              </p>
              <button onClick={() => setShowForm(true)}
                style={{ background: '#2E9B55', color: '#fff', border: 'none', borderRadius: 14, padding: '12px 28px', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
                Post a Happening
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
                      {h.status}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#2E5BFF' }}>{h.priceText || 'Free'}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af' }}>{h.viewsCount} views</span>
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
            <label style={labelStyle}>Photos ({images.length}/8)</label>
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
                  <span style={{ fontSize: 10, color: '#6B7A99', fontWeight: 700 }}>Add</span>
                </button>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => handleImagePick(e.target.files)} />
          </div>

          {/* Info */}
          <div style={{ background: '#fff', borderRadius: 20, padding: 18, marginBottom: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ fontWeight: 900, fontSize: 15, color: '#1E2B45', marginBottom: 16 }}>Happening Details</div>
            <label style={labelStyle}>Title *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Summer Market 2026" style={inputStyle} />
            <label style={{ ...labelStyle, marginTop: 14 }}>Description *</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe your event…" rows={4} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
            <label style={{ ...labelStyle, marginTop: 14 }}>Venue / Location *</label>
            <div style={{ position: 'relative' }}>
              <MapPin size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input value={locationText} onChange={(e) => setLocationText(e.target.value)} placeholder="e.g. Kampala, Freedom Square" style={{ ...inputStyle, paddingLeft: 40 }} />
            </div>
          </div>

          {/* Category */}
          <div style={{ background: '#fff', borderRadius: 20, padding: 18, marginBottom: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ fontWeight: 900, fontSize: 15, color: '#1E2B45', marginBottom: 12 }}>Category</div>
            <div style={{ position: 'relative' }}>
              <select value={selectedMainId} onChange={(e) => setSelectedMainId(e.target.value)} style={{ ...inputStyle, paddingRight: 28, appearance: 'none' }}>
                <option value="">Select category</option>
                {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6B7A99' }} />
            </div>
          </div>

          {/* Price (optional) */}
          <div style={{ background: '#fff', borderRadius: 20, padding: 18, marginBottom: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ fontWeight: 900, fontSize: 15, color: '#1E2B45', marginBottom: 12 }}>Ticket / Entry Price (optional)</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={{ ...inputStyle, width: 100, paddingRight: 28, appearance: 'none' }}>
                  {['USD', 'UGX', 'KES', 'TZS', 'GHS', 'NGN', 'ZAR'].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6B7A99' }} />
              </div>
              <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0 (leave blank for free)" type="number" style={{ ...inputStyle, flex: 1 }} />
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
              <><span style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> Submitting…</>
            ) : 'Post Happening'}
          </button>
        </div>
      )}
    </div>
  );
}
