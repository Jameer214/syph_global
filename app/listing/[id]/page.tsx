'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  ArrowLeft, Bookmark, BookmarkCheck, Eye, Share2,
  MessageCircle, Star, Handshake, Zap, Award,
  MapPin, Store, Flag, ChevronRight, Grid3x3,
  FileText, Info, List, Navigation, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { sanitizeText } from '@/lib/sanitize';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store';
import { translate as tr, getDir } from '@/lib/i18n';
import { getListing, getListingReviews, getRelatedListings } from '@/lib/firestore';
import { formatConverted, getCurrencySymbol } from '@/lib/currency';
import Reveal from '@/components/Reveal';
import DistanceChip from '@/components/DistanceChip';
import { useDistances } from '@/lib/useDistances';
import type { Listing, Review } from '@/types';

// ─── Report Modal ─────────────────────────────────────────────────────────────

function ReportModal({ listingId, onClose }: { listingId: string; onClose: () => void }) {
  const { selectedLanguage } = useAppStore();
  // value = canonical English stored to the DB; key = translated display label.
  const REASONS: { value: string; key: string }[] = [
    { value: 'Fake listing', key: 'reportReasonFake' },
    { value: 'Wrong category', key: 'reportReasonWrongCategory' },
    { value: 'Spam / scam', key: 'reportReasonSpam' },
    { value: 'Offensive content', key: 'reportReasonOffensive' },
    { value: 'Already sold', key: 'reportReasonSold' },
    { value: 'Other', key: 'reportReasonOther' },
  ];
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) { toast.error(tr('signInToReport', selectedLanguage)); return; }
    if (!reason) { toast.error(tr('selectAReason', selectedLanguage)); return; }
    setSubmitting(true);
    try {
      await supabase.from('reports').insert({
        listing_id: listingId,
        reporter_id: uid,
        reason,
        details: details.trim(),
        status: 'pending',
      });
      toast.success(tr('reportSubmittedThanks', selectedLanguage));
      onClose();
    } catch { toast.error(tr('failedToSubmit', selectedLanguage)); }
    finally { setSubmitting(false); }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 480, padding: '20px 20px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#0F2B6E' }}>{tr('reportListing', selectedLanguage)}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={22} color="#6B7A99" /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {REASONS.map((r) => (
            <label key={r.value} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 14px', borderRadius: 12, border: `1.5px solid ${reason === r.value ? '#2E5BFF' : '#e2e8f0'}`, background: reason === r.value ? '#EEF3FF' : '#fafafa' }}>
              <input type="radio" checked={reason === r.value} onChange={() => setReason(r.value)} style={{ accentColor: '#2E5BFF' }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>{tr(r.key, selectedLanguage)}</span>
            </label>
          ))}
        </div>
        <textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder={tr('additionalDetailsOptional', selectedLanguage)} rows={3}
          style={{ width: '100%', borderRadius: 12, border: '1.5px solid #e2e8f0', padding: '10px 14px', fontSize: 14, outline: 'none', marginBottom: 14, resize: 'none', fontFamily: 'inherit' }} />
        <button onClick={submit} disabled={submitting || !reason}
          style={{ width: '100%', height: 50, borderRadius: 25, border: 'none', background: !reason || submitting ? '#9ca3af' : '#ef4444', color: '#fff', fontWeight: 800, fontSize: 15, cursor: !reason || submitting ? 'not-allowed' : 'pointer' }}>
          {submitting ? tr('submittingEllipsis', selectedLanguage) : tr('submitReport', selectedLanguage)}
        </button>
      </div>
    </div>
  );
}

// ─── Review Modal ─────────────────────────────────────────────────────────────

function ReviewModal({ listingId, sellerUid, onClose }: { listingId: string; sellerUid: string; onClose: () => void }) {
  const { selectedLanguage } = useAppStore();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Reviews are gated behind an existing conversation with the seller (same
  // rule as the Flutter app + enforced by the reviews_insert_own RLS policy).
  const [checkingChat, setCheckingChat] = useState(true);
  const [hasChatted, setHasChatted] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const u = session?.user;
      if (!u) { setCheckingChat(false); setHasChatted(false); return; }
      const { data } = await supabase
        .from('chats')
        .select('id')
        .eq('listing_id', listingId)
        .or(`buyer_id.eq.${u.id},seller_id.eq.${u.id}`)
        .limit(1);
      setHasChatted((data ?? []).length > 0);
      setCheckingChat(false);
    })();
  }, [listingId]);

  async function submit() {
    const { data: { session } } = await supabase.auth.getSession();
    const u = session?.user;
    if (!u) { toast.error(tr('signInToReview', selectedLanguage)); return; }
    if (!hasChatted) { toast.error(tr('messageSellerBeforeReview', selectedLanguage)); return; }
    if (!comment.trim()) { toast.error(tr('addCommentToast', selectedLanguage)); return; }
    setSubmitting(true);
    try {
      await supabase.from('reviews').insert({
        listing_id: listingId,
        seller_id: sellerUid,
        // reviewer_id is the column the RLS insert policy checks
        // (auth.uid() = reviewer_id); buyer_id/buyer_name kept for display.
        reviewer_id: u.id,
        buyer_id: u.id,
        buyer_name: u.user_metadata?.full_name || 'User',
        rating: Math.round(rating),
        comment: comment.trim(),
        status: 'pending',
      });
      toast.success(tr('reviewSubmittedTitle', selectedLanguage));
      onClose();
    } catch { toast.error(tr('failedToSubmitReview', selectedLanguage)); }
    finally { setSubmitting(false); }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 480, padding: '20px 20px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#0F2B6E' }}>{tr('shareYourReview', selectedLanguage)}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={22} color="#6B7A99" /></button>
        </div>
        {checkingChat ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#6B7A99', fontWeight: 700 }}>{tr('checkingEllipsis', selectedLanguage)}</div>
        ) : !hasChatted ? (
          <div style={{ textAlign: 'center', padding: '12px 4px 8px' }}>
            <MessageCircle size={40} color="#FF8F00" style={{ marginBottom: 12 }} />
            <p style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 800, color: '#0F2B6E' }}>{tr('contactSellerFirst', selectedLanguage)}</p>
            <p style={{ margin: '0 0 20px', fontSize: 13.5, fontWeight: 600, color: '#6B7A99', lineHeight: 1.45 }}>
              {tr('contactSellerFirstDesc', selectedLanguage)}
            </p>
            <button onClick={onClose}
              style={{ width: '100%', height: 48, borderRadius: 24, border: 'none', background: '#2E5BFF', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>
              {tr('gotIt', selectedLanguage)}
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 18 }}>
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} onClick={() => setRating(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                  <Star size={32} fill={s <= rating ? '#FF9800' : 'none'} color={s <= rating ? '#FF9800' : '#d1d5db'} />
                </button>
              ))}
            </div>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={tr('writeYourExperience', selectedLanguage)} rows={4}
              style={{ width: '100%', borderRadius: 12, border: '1.5px solid #e2e8f0', padding: '10px 14px', fontSize: 14, outline: 'none', marginBottom: 14, resize: 'none', fontFamily: 'inherit' }} />
            <button onClick={submit} disabled={submitting}
              style={{ width: '100%', height: 50, borderRadius: 25, border: 'none', background: submitting ? '#9ca3af' : '#2E5BFF', color: '#fff', fontWeight: 800, fontSize: 15, cursor: submitting ? 'not-allowed' : 'pointer' }}>
              {submitting ? tr('submittingEllipsis', selectedLanguage) : tr('submitReview', selectedLanguage)}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ListingDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { user, isSaved, toggleSaved, selectedCurrency, selectedLanguage } = useAppStore();

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [related, setRelated] = useState<Listing[]>([]);
  const [currentImage, setCurrentImage] = useState(0);
  const [messageText, setMessageText] = useState('');
  const [startingChat, setStartingChat] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const viewTracked = useRef(false);
  const lastMessageSent = useRef<number>(0);

  // Distance chips — main listing + related items.
  const mainDist = useDistances(useMemo(() => (listing ? [listing] : []), [listing]));
  const relatedDist = useDistances(related);

  // Load listing
  useEffect(() => {
    getListing(id).then((l) => {
      setListing(l);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  // Track view once per listing per 24h per browser.
  // Writes to viewQueue (not the listing doc) so the processViewQueue Cloud
  // Function can batch-aggregate counts — no write hotspot on popular listings.
  useEffect(() => {
    if (viewTracked.current) return;
    viewTracked.current = true;
    try {
      const cacheKey = `vt:${id}`;
      const lastView = localStorage.getItem(cacheKey);
      if (lastView && Date.now() - Number(lastView) < 86400000) return;
      localStorage.setItem(cacheKey, String(Date.now()));
    } catch { /* ignore if localStorage unavailable */ }
    void supabase.from('listings').update({ view_count: (listing?.viewsCount ?? 0) + 1 }).eq('id', id);
  }, [id]);

  // Load reviews + related + seller verification
  useEffect(() => {
    if (!listing) return;
    getListingReviews(id).then(setReviews).catch(() => {});
    getRelatedListings(listing.mainCategoryId, listing.country, id, 6).then(setRelated).catch(() => {});
    if (listing.ownerUid) {
      (async () => {
        try {
          const { data } = await supabase.from('sellers').select('is_verified').eq('user_id', listing.ownerUid).single();
          if (data) setIsVerified(Boolean(data.is_verified));
        } catch {}
      })();
    }
  }, [listing, id]);

  async function openOrCreateChat(initialMessage?: string) {
    if (startingChat) return;
    // Client-side rate limit: 3 seconds between sends
    const now = Date.now();
    if (now - lastMessageSent.current < 3000) {
      toast.error(tr('pleaseWaitBeforeMessage', selectedLanguage));
      return;
    }
    lastMessageSent.current = now;
    const { data: { session } } = await supabase.auth.getSession();
    const fireUser = session?.user;
    if (!fireUser) { toast.error(tr('signInToMessageSeller', selectedLanguage)); return; }
    if (!listing) return;
    if (!listing.ownerUid) { toast.error(tr('sellerChatUnavailable', selectedLanguage)); return; }
    if (fireUser.id === listing.ownerUid) { toast.error(tr('ownListingError', selectedLanguage)); return; }

    setStartingChat(true);
    try {
      // Find existing chat for this listing between these two users
      const { data: existing } = await supabase.from('chats')
        .select('id')
        .eq('listing_id', listing.id)
        .eq('buyer_id', fireUser.id)
        .eq('seller_id', listing.ownerUid)
        .limit(1);

      let chatId: string;
      if (existing && existing.length > 0) {
        chatId = existing[0].id;
      } else {
        const starter = (initialMessage ?? '').trim();
        // Denormalised display fields so the chat list/header show the buyer's
        // name + listing title/thumbnail (parity with the Flutter app).
        const { data: buyerProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', fireUser.id)
          .single();
        const buyerName =
          (buyerProfile?.full_name as string | undefined)?.trim() ||
          fireUser.email?.split('@')[0] ||
          'User';
        const { data: newChat } = await supabase.from('chats').insert({
          listing_id: listing.id,
          buyer_id: fireUser.id,
          seller_id: listing.ownerUid,
          buyer_name: buyerName,
          seller_name: listing.sellerName,
          listing_title: listing.title,
          listing_image_url: listing.imageUrl,
          last_message: starter,
          seller_unread_count: starter ? 1 : 0,
          buyer_unread_count: 0,
          is_admin_chat: false,
          last_message_at: new Date().toISOString(),
        }).select('id').single();
        chatId = newChat!.id;
      }

      const starter = (initialMessage ?? '').trim();
      if (starter) {
        await supabase.from('messages').insert({
          chat_id: chatId,
          sender_id: fireUser.id,
          content: starter,
          is_read: false,
        });
        await supabase.from('chats').update({
          last_message: starter,
          last_message_at: new Date().toISOString(),
          seller_unread_count: 1,
        }).eq('id', chatId);
      }

      setMessageText('');
      router.push(`/chat/${chatId}`);
    } catch (e) {
      console.error('Failed to open chat:', e);
      toast.error(tr('failedToOpenChat', selectedLanguage));
    } finally {
      setStartingChat(false);
    }
  }

  function openVenueInMaps() {
    if (!listing) return;
    const lat = listing.venueLatitude;
    const lng = listing.venueLongitude;
    const label = listing.locationText?.trim();
    let url: string;
    if (lat != null && lng != null) {
      url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    } else if (label) {
      url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(label)}`;
    } else {
      toast.error(tr('venueLocationUnavailable', selectedLanguage));
      return;
    }
    window.open(url, '_blank');
  }

  function shareListing() {
    if (!listing) return;
    const text = `${listing.title}\n\nCheck it out on SYPH: https://syph.app/listing/${listing.id}`;
    if (navigator.share) {
      navigator.share({ title: listing.title, text, url: `https://syph.app/listing/${listing.id}` }).catch(() => {});
    } else {
      navigator.clipboard.writeText(`https://syph.app/listing/${listing.id}`).then(() => toast.success(tr('linkCopied', selectedLanguage)));
    }
  }

  if (loading) {
    return (
      <div className="app-shell" style={{ minHeight: '100vh', backgroundColor: '#D6ECFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#6B7A99', fontWeight: 700 }}>{tr('loading', selectedLanguage)}</div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="app-shell" style={{ minHeight: '100vh', backgroundColor: '#D6ECFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#fff', borderRadius: 22, padding: 24, margin: 24, textAlign: 'center' }}>
          <p style={{ fontWeight: 900, color: '#0F2B6E' }}>{tr('listingNotFound', selectedLanguage)}</p>
        </div>
      </div>
    );
  }

  const images = (listing.imageUrls && listing.imageUrls.length > 0)
    ? listing.imageUrls
    : listing.imageUrl ? [listing.imageUrl] : [];

  let price: string;
  if (listing.priceValue != null && selectedCurrency && selectedCurrency !== listing.currencyCode) {
    price = `≈ ${formatConverted(listing.priceValue, listing.currencyCode, selectedCurrency)}`;
  } else if (listing.priceText?.trim()) {
    price = listing.priceText.trim();
  } else if (listing.priceValue != null) {
    price = `${getCurrencySymbol(listing.currencyCode)}${listing.priceValue.toLocaleString()}`;
  } else {
    price = tr('priceNotSet', selectedLanguage);
  }

  const saved = isSaved(listing.id);
  const isOwner = (user?.uid ?? '') === listing.ownerUid;

  return (
    <div dir={getDir(selectedLanguage)} className="app-shell" style={{ minHeight: '100vh', backgroundColor: '#D6ECFF' }}>
      {/* Header */}
      <div className="sweep" style={{ background: 'linear-gradient(135deg, #0F2B6E 0%, #1E4DD9 100%)', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 40 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', padding: 4 }}><ArrowLeft size={22} /></button>
        <span style={{ color: '#fff', fontWeight: 800, fontSize: 15, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{listing.title}</span>
        <button onClick={shareListing} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', padding: 4 }}><Share2 size={20} /></button>
        <button onClick={() => toggleSaved(listing.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', padding: 4 }}>
          {saved ? <BookmarkCheck size={20} /> : <Bookmark size={20} />}
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: '14px 16px 24px' }}>

        {/* Image gallery */}
        <div className="card-media" style={{ borderRadius: 24, overflow: 'hidden', aspectRatio: '16/9', position: 'relative', backgroundColor: '#f2f5f9' }}>
          {images.length === 0 ? (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>📷</div>
          ) : (
            <>
              <Image
                key={currentImage}
                src={images[currentImage]}
                alt={listing.title}
                fill
                className="anim-fade-in"
                style={{ objectFit: 'cover', animationDuration: '0.45s' }}
                sizes="480px"
              />
              {images.length > 1 && (
                <>
                  {/* Tap zones */}
                  {currentImage > 0 && <button onClick={() => setCurrentImage(currentImage - 1)} style={{ position: 'absolute', left: 0, top: 0, width: '30%', height: '100%', background: 'none', border: 'none', cursor: 'pointer' }} />}
                  {currentImage < images.length - 1 && <button onClick={() => setCurrentImage(currentImage + 1)} style={{ position: 'absolute', right: 0, top: 0, width: '30%', height: '100%', background: 'none', border: 'none', cursor: 'pointer' }} />}
                </>
              )}
            </>
          )}
        </div>
        {images.length > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 8 }}>
            {images.map((_, i) => (
              <button key={i} onClick={() => setCurrentImage(i)} style={{ padding: 0, background: 'none', border: 'none', cursor: 'pointer' }}>
                <div style={{ width: currentImage === i ? 20 : 8, height: 8, borderRadius: 4, background: currentImage === i ? '#2E5BFF' : '#2E5BFF4D', transition: 'width 0.2s' }} />
              </button>
            ))}
          </div>
        )}

        <div style={{ height: 14 }} />

        {/* Top card */}
        <div className="anim-fade-up" style={{ background: '#fff', borderRadius: 20, padding: 18, boxShadow: '0 5px 12px rgba(0,0,0,0.03)', border: '1px solid #e8edf5', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <p style={{ flex: 1, margin: 0, fontWeight: 900, fontSize: 21, color: '#0f172a', lineHeight: 1.2 }}>{sanitizeText(listing.title)}</p>
            <button onClick={() => toggleSaved(listing.id)} style={{ background: '#f8fafc', borderRadius: 14, border: 'none', cursor: 'pointer', padding: 8, display: 'flex', flexShrink: 0 }}>
              {saved ? <BookmarkCheck size={22} color="#2E5BFF" /> : <Bookmark size={22} color="#0F2B6E" />}
            </button>
          </div>
          <p style={{ margin: '10px 0 6px', fontWeight: 900, fontSize: 26, color: '#0F2B6E' }}>{price}</p>
          {mainDist.get(listing.id) != null && (
            <div style={{ marginBottom: 6 }}><DistanceChip km={mainDist.get(listing.id)} /></div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {listing.negotiable && <Badge icon={<Handshake size={15} color="#2E9B55" />} text={tr('negotiable', selectedLanguage)} fg="#2E9B55" />}
            {listing.condition && <Badge icon={<span style={{ fontSize: 14 }}>{listing.condition === 'New' ? '✨' : '🔄'}</span>} text={listing.condition === 'New' ? tr('new', selectedLanguage) : tr('used', selectedLanguage)} fg={listing.condition === 'New' ? '#2E9B55' : '#FF9800'} />}
            {listing.isSponsored && <Badge icon={<Award size={15} color="#63B3ED" />} text={tr('sponsored', selectedLanguage)} fg="#63B3ED" />}
            {listing.isHappening && <Badge icon={<Zap size={15} color="#2E9B55" />} text={tr('happening', selectedLanguage)} fg="#2E9B55" />}
            {listing.rating != null && listing.rating > 0 && <Badge icon={<Star size={15} color="#FF9800" fill="#FF9800" />} text={`${listing.rating.toFixed(1)} ★`} fg="#FF9800" />}
          </div>
        </div>

        {/* Stats strip */}
        <div className="anim-fade-up" style={{ background: '#fff', borderRadius: 20, padding: '12px 16px', boxShadow: '0 5px 12px rgba(0,0,0,0.03)', border: '1px solid #e8edf5', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-around', animationDelay: '0.06s' }}>
          <StatItem icon={<Eye size={20} color="#2E5BFF" />} value={String(listing.viewsCount)} label={tr('viewsLabel', selectedLanguage)} />
          <div style={{ width: 1, height: 36, background: '#e8edf5' }} />
          <StatItem icon={<Bookmark size={20} color="#2E5BFF" />} value={String(listing.savesCount)} label={tr('savesLabel', selectedLanguage)} />
          <div style={{ width: 1, height: 36, background: '#e8edf5' }} />
          <StatItem icon={<MessageCircle size={20} color="#2E5BFF" />} value={String(listing.messagesCount)} label={tr('chatsLabel', selectedLanguage)} />
        </div>

        {/* Venue directions card (happenings) */}
        {listing.isHappening && (
          <div onClick={openVenueInMaps} style={{ background: 'linear-gradient(135deg, #2E9B55, #45C76B)', borderRadius: 20, padding: 16, marginBottom: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 6px 12px rgba(46,155,85,0.25)' }}>
            <div style={{ width: 48, height: 48, background: 'rgba(255,255,255,0.2)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Navigation size={26} color="#fff" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, color: '#fff', fontWeight: 900, fontSize: 15 }}>{tr('tapForDirections', selectedLanguage)}</p>
              <p style={{ margin: '3px 0 0', color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{listing.locationText || tr('venueLocation', selectedLanguage)}</p>
            </div>
            <ChevronRight size={16} color="rgba(255,255,255,0.7)" />
          </div>
        )}

        {/* Seller shop access card (non-happenings) */}
        {!listing.isHappening && listing.ownerUid && (
          <div onClick={() => router.push(`/shop/${listing.ownerUid}`)} style={{ background: 'linear-gradient(135deg, #1D49C6, #2E67F5)', borderRadius: 20, padding: 16, marginBottom: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 6px 12px rgba(36,83,212,0.22)' }}>
            <div style={{ width: 48, height: 48, background: 'rgba(255,255,255,0.2)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Store size={26} color="#fff" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, color: '#fff', fontWeight: 900, fontSize: 15 }}>{tr('accessSellersShop', selectedLanguage)}</p>
              <p style={{ margin: '3px 0 0', color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {listing.sellerName ? `${listing.sellerName} • ` : ''}{tr('viewShopGetDirections', selectedLanguage)}
              </p>
            </div>
            <ChevronRight size={16} color="rgba(255,255,255,0.7)" />
          </div>
        )}

        {/* Specifications */}
        {listing.specifications && Object.keys(listing.specifications).length > 0 && (
          <SectionCard icon={<List size={20} color="#2E5BFF" />} title={tr('specifications', selectedLanguage)} marginBottom={14}>
            {Object.entries(listing.specifications).map(([key, val]) => (
              <div key={key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#2E5BFF', flexShrink: 0, marginTop: 5 }} />
                <span style={{ width: 120, flexShrink: 0, color: '#6B7A99', fontWeight: 700, fontSize: 13 }}>{key}</span>
                <span style={{ flex: 1, fontWeight: 800, fontSize: 13, color: '#0f172a' }}>{val}</span>
              </div>
            ))}
          </SectionCard>
        )}

        {/* Description */}
        <SectionCard icon={<FileText size={20} color="#2E5BFF" />} title={tr('description', selectedLanguage)} marginBottom={14}>
          <p style={{ margin: 0, fontWeight: 600, lineHeight: 1.6, color: 'rgba(0,0,0,0.85)', fontSize: 14 }}>
            {sanitizeText(listing.description) || tr('noDescriptionAdded', selectedLanguage)}
          </p>
        </SectionCard>

        {/* Bio — happenings only; regular listings no longer use a bio */}
        {listing.isHappening && listing.bio?.trim() && (
          <SectionCard icon={<Info size={20} color="#2E5BFF" />} title={tr('aboutThisItem', selectedLanguage)} marginBottom={14}>
            <p style={{ margin: 0, fontWeight: 600, lineHeight: 1.6, color: 'rgba(0,0,0,0.85)', fontSize: 14 }}>{sanitizeText(listing.bio)}</p>
          </SectionCard>
        )}

        {/* Item Details */}
        <SectionCard icon={<List size={20} color="#2E5BFF" />} title={tr('itemDetails', selectedLanguage)} marginBottom={14}>
          {listing.mainCategoryId && <DetailRow label={tr('category', selectedLanguage)} value={listing.mainCategoryId.replace(/_/g, ' ')} />}
          {listing.subCategoryId && <DetailRow label={tr('subcategoryField', selectedLanguage)} value={listing.subCategoryId.replace(/_/g, ' ')} />}
          {listing.condition && <DetailRow label={tr('condition', selectedLanguage)} value={listing.condition === 'New' ? tr('new', selectedLanguage) : tr('used', selectedLanguage)} />}
          {listing.units != null && <DetailRow label={tr('unitsAvailable', selectedLanguage)} value={String(listing.units)} />}
          <DetailRow label={tr('priceType', selectedLanguage)} value={listing.negotiable ? tr('negotiable', selectedLanguage) : tr('fixed', selectedLanguage)} />
          <DetailRow label={tr('location', selectedLanguage)} value={listing.locationText || '—'} />
          {listing.regionOrCity && <DetailRow label={tr('regionCity', selectedLanguage)} value={listing.regionOrCity} />}
          <DetailRow label={tr('countryField', selectedLanguage)} value={listing.country} />
          {listing.messageAboutGoods && (
            <div style={{ background: '#EEF5FF', borderRadius: 12, border: '1px solid #c7d9f5', padding: 12, marginTop: 10, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 16 }}>📢</span>
              <p style={{ margin: 0, color: '#0F2B6E', fontWeight: 600, fontSize: 13, lineHeight: 1.4 }}>{listing.messageAboutGoods}</p>
            </div>
          )}
        </SectionCard>

        {/* Full seller card */}
        <div style={{ background: 'linear-gradient(135deg, #1D49C6, #2E67F5)', borderRadius: 26, padding: 18, marginBottom: 14, boxShadow: '0 8px 18px rgba(36,83,212,0.18)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <div style={{ width: 58, height: 58, background: 'rgba(255,255,255,0.16)', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Store size={30} color="#fff" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: '0 0 4px', color: 'rgba(255,255,255,0.7)', fontWeight: 900, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase' }}>{tr('sellerShop', selectedLanguage)}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#fff', fontWeight: 900, fontSize: 18, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {listing.sellerName || tr('sellerFallback', selectedLanguage)}
                </span>
                {isVerified && (
                  <svg width="16" height="16" viewBox="0 0 24 24" aria-label="Verified" style={{ flexShrink: 0 }}>
                    <path fill="#E53935" d="M23 12l-2.44-2.78.34-3.68-3.61-.82-1.89-3.18L12 3 8.6 1.54 6.71 4.72l-3.61.81.34 3.68L1 12l2.44 2.78-.34 3.69 3.61.82 1.89 3.18L12 21l3.4 1.46 1.89-3.18 3.61-.82-.34-3.68z" />
                    <path fill="#fff" d="M10.09 16.72l-3.8-3.81 1.48-1.48 2.32 2.33 5.85-5.87 1.48 1.48z" />
                  </svg>
                )}
              </div>
              <p style={{ margin: '3px 0 0', color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {listing.locationText || tr('locationNotPublished', selectedLanguage)}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => router.push(`/shop/${listing.ownerUid}`)} style={{ flex: 1, background: '#fff', color: '#0F2B6E', border: 'none', borderRadius: 16, padding: '14px', fontWeight: 900, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Store size={16} /> {tr('viewShop', selectedLanguage)}
            </button>
            <button onClick={() => openOrCreateChat()} disabled={startingChat} style={{ flex: 1, background: 'transparent', color: '#fff', border: '1.5px solid rgba(255,255,255,0.45)', borderRadius: 16, padding: '14px', fontWeight: 900, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {startingChat ? <span style={{ fontSize: 12 }}>{tr('openingEllipsis', selectedLanguage)}</span> : <><MessageCircle size={16} /> {tr('messageContact', selectedLanguage)}</>}
            </button>
          </div>
        </div>

        {/* Chat starter card */}
        <SectionCard icon={<MessageCircle size={20} color="#2E5BFF" />} title={tr('chatWithSeller', selectedLanguage)} marginBottom={14}>
          <p style={{ margin: '0 0 14px', color: '#6B7A99', fontWeight: 600, lineHeight: 1.4, fontSize: 13 }}>{tr('sendQuickMessage', selectedLanguage)}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            {['quickMsgAvailable', 'quickMsgBestPrice', 'quickMsgDeliver'].map((msgKey) => {
              const msg = tr(msgKey, selectedLanguage);
              return (
                <button key={msgKey} onClick={() => setMessageText(msg)} style={{ background: '#f0f5ff', border: '1px solid rgba(46,91,255,0.2)', borderRadius: 999, padding: '10px 14px', fontWeight: 800, fontSize: 12.5, color: '#0F2B6E', cursor: 'pointer' }}>
                  {msg}
                </button>
              );
            })}
          </div>
          <textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            disabled={startingChat}
            placeholder={tr('writeMessageHere', selectedLanguage)}
            rows={3}
            style={{ width: '100%', padding: '14px', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', background: '#F7FAFD', fontSize: 14, fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box', outline: 'none' }}
          />
          <button
            onClick={() => openOrCreateChat(messageText.trim() || undefined)}
            disabled={startingChat}
            style={{ width: '100%', marginTop: 14, padding: '16px', borderRadius: 16, background: startingChat ? '#a5b4fc' : '#2E5BFF', color: '#fff', fontWeight: 900, fontSize: 15, border: 'none', cursor: 'pointer' }}
          >
            {startingChat ? tr('loading', selectedLanguage) : tr('sendMessage', selectedLanguage)}
          </button>
        </SectionCard>

        {/* Reviews */}
        {reviews.length > 0 && (
          <SectionCard icon={<Star size={20} color="#2E5BFF" />} title={`${tr('reviews', selectedLanguage)} (${reviews.length})`} marginBottom={14}>
            {reviews.map((r) => (
              <div key={r.id} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: 12, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 800, fontSize: 13, color: '#0f172a' }}>{sanitizeText(r.buyerName)}</span>
                  <div style={{ display: 'flex', gap: 2 }}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} size={12} color="#FF9800" fill={s <= r.rating ? '#FF9800' : 'transparent'} />
                    ))}
                  </div>
                </div>
                {r.comment && <p style={{ margin: 0, fontSize: 13, color: '#4A5878', lineHeight: 1.5 }}>{sanitizeText(r.comment)}</p>}
              </div>
            ))}
          </SectionCard>
        )}

        {/* Submit review button */}
        <button
          onClick={() => {
            if (!user?.uid) { toast.error(tr('signInToReview', selectedLanguage)); return; }
            setShowReview(true);
          }}
          style={{ width: '100%', padding: '15px', borderRadius: 18, background: '#2E5BFF', color: '#fff', fontWeight: 900, fontSize: 15, border: 'none', cursor: 'pointer', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <Star size={18} /> {tr('shareYourReview', selectedLanguage)}
        </button>

        {/* Report button */}
        <button
          onClick={() => {
            if (!user?.uid) { toast.error(tr('signInToReport', selectedLanguage)); return; }
            setShowReport(true);
          }}
          style={{ width: '100%', padding: '15px', borderRadius: 18, background: '#fff', color: '#ef4444', fontWeight: 900, fontSize: 15, border: '1.5px solid #fca5a5', cursor: 'pointer', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <Flag size={18} /> {tr('reportListing', selectedLanguage)}
        </button>

        {/* Related listings */}
        {related.length > 0 && (
          <Reveal once>
            <div style={{ background: '#0f172a', borderRadius: 16, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Grid3x3 size={18} color="#fff" />
              <span style={{ flex: 1, color: '#fff', fontWeight: 900, fontSize: 15 }}>{tr('relatedItems', selectedLanguage)}</span>
              <span style={{ color: 'rgba(255,255,255,0.54)', fontWeight: 600, fontSize: 12 }}>{listing.mainCategoryId.replace(/_/g, ' ')}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {related.map((r) => {
                const rPrice = r.priceValue != null ? `${r.currencyCode} ${r.priceValue.toLocaleString()}` : r.priceText ?? tr('priceNotSet', selectedLanguage);
                const rImg = r.imageUrls?.[0] ?? r.imageUrl;
                return (
                  <div key={r.id} onClick={() => router.push(`/listing/${r.id}`)} className="card-tap card-zoom" style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 3px 6px rgba(0,0,0,0.03)', cursor: 'pointer' }}>
                    <div className="card-media" style={{ aspectRatio: '1.2', position: 'relative', backgroundColor: '#f2f5f9' }}>
                      {rImg ? <Image src={rImg} alt={r.title} fill style={{ objectFit: 'cover' }} sizes="220px" /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>📦</div>}
                    </div>
                    <div style={{ padding: '10px 10px 8px' }}>
                      <p style={{ margin: '0 0 4px', fontWeight: 900, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', color: '#0f172a' }}>{r.title}</p>
                      <p style={{ margin: '0 0 4px', fontWeight: 800, fontSize: 12.5, color: '#0F2B6E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rPrice}</p>
                      {r.condition && (
                        <span style={{ background: r.condition === 'New' ? '#e8f5e9' : '#FFF3E0', color: r.condition === 'New' ? '#2E9B55' : '#FF9800', borderRadius: 999, padding: '3px 6px', fontSize: 10.5, fontWeight: 800 }}>{r.condition}</span>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 4 }}>
                        <MapPin size={12} color="#6B7A99" />
                        <span style={{ fontSize: 11, color: '#6B7A99', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.locationText}</span>
                      </div>
                      {relatedDist.get(r.id) != null && (
                        <div style={{ marginTop: 4 }}><DistanceChip km={relatedDist.get(r.id)} size="xs" /></div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
                        <Eye size={12} color="#6B7A99" />
                        <span style={{ fontSize: 11, color: '#6B7A99', fontWeight: 700 }}>{r.viewsCount}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Reveal>
        )}
      </div>

      {/* ── Sticky Bottom CTA ── */}
      {!isOwner ? (
        <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: '#fff', borderTop: '1px solid #eef2f8', padding: '10px 16px 20px', display: 'flex', gap: 10, zIndex: 30 }}>
          <button onClick={() => toggleSaved(listing.id)}
            style={{ width: 50, height: 50, borderRadius: 14, border: '1.5px solid #e2e8f0', background: saved ? '#EEF3FF' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {saved ? <BookmarkCheck size={20} color="#2E5BFF" /> : <Bookmark size={20} color="#6B7A99" />}
          </button>
          <button onClick={() => openOrCreateChat()} disabled={startingChat}
            className={startingChat ? 'btn-tap' : 'btn-tap cta-armed'}
            style={{ flex: 1, height: 50, borderRadius: 25, border: 'none', background: startingChat ? '#9ca3af' : '#2E5BFF', color: '#fff', fontWeight: 800, fontSize: 15, cursor: startingChat ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <MessageCircle size={18} /> {startingChat ? tr('openingEllipsis', selectedLanguage) : tr('messageSeller', selectedLanguage)}
          </button>
        </div>
      ) : (
        <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: '#fff', borderTop: '1px solid #eef2f8', padding: '10px 16px 20px', display: 'flex', gap: 10, zIndex: 30 }}>
          <button onClick={() => router.push(`/dashboard/edit/${listing.id}`)}
            style={{ flex: 1, height: 50, borderRadius: 25, border: 'none', background: '#2E5BFF', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>
            {tr('editListing', selectedLanguage)}
          </button>
          <button onClick={() => router.push(`/dashboard/upgrade/${listing.id}`)}
            style={{ flex: 1, height: 50, borderRadius: 25, border: 'none', background: '#F39C12', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>
            {tr('promoteListingBtn', selectedLanguage)}
          </button>
        </div>
      )}

      {showReport && <ReportModal listingId={listing.id} onClose={() => setShowReport(false)} />}
      {showReview && <ReviewModal listingId={listing.id} sellerUid={listing.ownerUid} onClose={() => setShowReview(false)} />}
    </div>
  );
}

// ── Helper components ──────────────────────────────────────────────────────────

function Badge({ icon, text, fg }: { icon: React.ReactNode; text: string; fg: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#fff', border: '1px solid #e8edf5', borderRadius: 999, padding: '8px 12px' }}>
      {icon}
      <span style={{ color: fg, fontWeight: 700, fontSize: 12.5 }}>{text}</span>
    </span>
  );
}

function StatItem({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      {icon}
      <span style={{ fontWeight: 900, fontSize: 15, color: '#0f172a' }}>{value}</span>
      <span style={{ color: '#6B7A99', fontWeight: 600, fontSize: 11 }}>{label}</span>
    </div>
  );
}

function SectionCard({ icon, title, children, marginBottom }: { icon: React.ReactNode; title: string; children: React.ReactNode; marginBottom?: number }) {
  return (
    <div style={{ background: '#fff', borderRadius: 24, padding: 18, border: '1px solid #e8edf5', boxShadow: '0 5px 12px rgba(0,0,0,0.03)', marginBottom: marginBottom ?? 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        {icon}
        <span style={{ fontWeight: 900, fontSize: 15.5, color: '#0F2B6E' }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
      <span style={{ width: 110, flexShrink: 0, color: '#6B7A99', fontWeight: 700, fontSize: 13 }}>{label}</span>
      <span style={{ flex: 1, fontWeight: 800, fontSize: 13, color: '#0f172a' }}>{value || '—'}</span>
    </div>
  );
}
