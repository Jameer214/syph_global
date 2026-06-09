'use client';
import { useState, useEffect, useRef } from 'react';
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
import {
  doc, getDoc, collection, query, where, limit, getDocs,
  setDoc, serverTimestamp, increment, addDoc,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useAppStore } from '@/store';
import { translate as tr, getDir } from '@/lib/i18n';
import { getListing, getListingReviews, getRelatedListings } from '@/lib/firestore';
import { formatConverted, getCurrencySymbol } from '@/lib/currency';
import type { Listing, Review } from '@/types';

// ─── Report Modal ─────────────────────────────────────────────────────────────

function ReportModal({ listingId, onClose }: { listingId: string; onClose: () => void }) {
  const REASONS = ['Fake listing', 'Wrong category', 'Spam / scam', 'Offensive content', 'Already sold', 'Other'];
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const uid = auth.currentUser?.uid;
    if (!uid) { toast.error('Sign in to report.'); return; }
    if (!reason) { toast.error('Select a reason.'); return; }
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'reports'), {
        listingId, reporterUid: uid,
        reporterName: auth.currentUser?.displayName || 'User',
        reason, details: details.trim(), status: 'pending',
        createdAt: serverTimestamp(),
      });
      toast.success('Report submitted. Thank you!');
      onClose();
    } catch { toast.error('Failed to submit.'); }
    finally { setSubmitting(false); }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 480, padding: '20px 20px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#0F2B6E' }}>Report Listing</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={22} color="#6B7A99" /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {REASONS.map((r) => (
            <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 14px', borderRadius: 12, border: `1.5px solid ${reason === r ? '#2E5BFF' : '#e2e8f0'}`, background: reason === r ? '#EEF3FF' : '#fafafa' }}>
              <input type="radio" checked={reason === r} onChange={() => setReason(r)} style={{ accentColor: '#2E5BFF' }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>{r}</span>
            </label>
          ))}
        </div>
        <textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Additional details (optional)" rows={3}
          style={{ width: '100%', borderRadius: 12, border: '1.5px solid #e2e8f0', padding: '10px 14px', fontSize: 14, outline: 'none', marginBottom: 14, resize: 'none', fontFamily: 'inherit' }} />
        <button onClick={submit} disabled={submitting || !reason}
          style={{ width: '100%', height: 50, borderRadius: 25, border: 'none', background: !reason || submitting ? '#9ca3af' : '#ef4444', color: '#fff', fontWeight: 800, fontSize: 15, cursor: !reason || submitting ? 'not-allowed' : 'pointer' }}>
          {submitting ? 'Submitting…' : 'Submit Report'}
        </button>
      </div>
    </div>
  );
}

// ─── Review Modal ─────────────────────────────────────────────────────────────

function ReviewModal({ listingId, sellerUid, onClose }: { listingId: string; sellerUid: string; onClose: () => void }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const u = auth.currentUser;
    if (!u) { toast.error('Sign in to review.'); return; }
    if (!comment.trim()) { toast.error('Add a comment.'); return; }
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'reviews'), {
        listingId, sellerUid, buyerUid: u.uid,
        buyerName: u.displayName || 'User',
        rating, comment: comment.trim(),
        status: 'pending', createdAt: serverTimestamp(),
      });
      toast.success('Review submitted for approval!');
      onClose();
    } catch { toast.error('Failed to submit review.'); }
    finally { setSubmitting(false); }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 480, padding: '20px 20px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#0F2B6E' }}>Share Your Review</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={22} color="#6B7A99" /></button>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 18 }}>
          {[1, 2, 3, 4, 5].map((s) => (
            <button key={s} onClick={() => setRating(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
              <Star size={32} fill={s <= rating ? '#FF9800' : 'none'} color={s <= rating ? '#FF9800' : '#d1d5db'} />
            </button>
          ))}
        </div>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Write your experience…" rows={4}
          style={{ width: '100%', borderRadius: 12, border: '1.5px solid #e2e8f0', padding: '10px 14px', fontSize: 14, outline: 'none', marginBottom: 14, resize: 'none', fontFamily: 'inherit' }} />
        <button onClick={submit} disabled={submitting}
          style={{ width: '100%', height: 50, borderRadius: 25, border: 'none', background: submitting ? '#9ca3af' : '#2E5BFF', color: '#fff', fontWeight: 800, fontSize: 15, cursor: submitting ? 'not-allowed' : 'pointer' }}>
          {submitting ? 'Submitting…' : 'Submit Review'}
        </button>
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

  // Load listing
  useEffect(() => {
    getListing(id).then((l) => {
      setListing(l);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  // Track view once per listing per 24h per browser to avoid Firestore write hotspots
  useEffect(() => {
    if (viewTracked.current) return;
    viewTracked.current = true;
    try {
      const cacheKey = `vt:${id}`;
      const lastView = localStorage.getItem(cacheKey);
      if (lastView && Date.now() - Number(lastView) < 86400000) return;
      localStorage.setItem(cacheKey, String(Date.now()));
    } catch { /* ignore if localStorage unavailable */ }
    setDoc(doc(db, 'listings', id), { viewsCount: increment(1), updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
  }, [id]);

  // Load reviews + related + seller verification
  useEffect(() => {
    if (!listing) return;
    getListingReviews(id).then(setReviews).catch(() => {});
    getRelatedListings(listing.mainCategoryId, listing.country, id, 6).then(setRelated).catch(() => {});
    if (listing.ownerUid) {
      getDoc(doc(db, 'sellers', listing.ownerUid)).then((snap) => {
        if (snap.exists()) setIsVerified(Boolean((snap.data() as Record<string, unknown>).isVerified));
      }).catch(() => {});
    }
  }, [listing, id]);

  async function openOrCreateChat(initialMessage?: string) {
    if (startingChat) return;
    // Client-side rate limit: 3 seconds between sends
    const now = Date.now();
    if (now - lastMessageSent.current < 3000) {
      toast.error('Please wait before sending another message.');
      return;
    }
    lastMessageSent.current = now;
    const fireUser = auth.currentUser;
    if (!fireUser) { toast.error('Sign in to message the seller'); return; }
    if (!listing) return;
    if (!listing.ownerUid) { toast.error('Seller chat not available'); return; }
    if (fireUser.uid === listing.ownerUid) { toast.error('This is your own listing'); return; }

    setStartingChat(true);
    try {
      const participants = [fireUser.uid, listing.ownerUid].sort();
      const chatsQuery = query(
        collection(db, 'chats'),
        where('listingId', '==', listing.id),
        where('participants', '==', participants),
        limit(1)
      );
      const existing = await getDocs(chatsQuery);

      let chatId: string;
      if (existing.docs.length > 0) {
        chatId = existing.docs[0].id;
      } else {
        const chatRef = doc(collection(db, 'chats'));
        chatId = chatRef.id;
        const starter = (initialMessage ?? '').trim();
        await setDoc(chatRef, {
          listingId: listing.id,
          participants,
          buyerUid: fireUser.uid,
          sellerUid: listing.ownerUid,
          buyerName: fireUser.displayName?.trim() || fireUser.email?.split('@')[0] || 'User',
          sellerName: listing.sellerName,
          listingTitle: listing.title,
          listingImageUrl: listing.imageUrl,
          lastMessage: starter,
          unreadForBuyer: 0,
          unreadForSeller: starter ? 1 : 0,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        });
      }

      const starter = (initialMessage ?? '').trim();
      if (starter) {
        await addDoc(collection(db, 'chats', chatId, 'messages'), {
          senderUid: fireUser.uid,
          text: starter,
          createdAt: serverTimestamp(),
          type: 'text',
        });
        await setDoc(doc(db, 'chats', chatId), {
          lastMessage: starter,
          lastSenderUid: fireUser.uid,
          updatedAt: serverTimestamp(),
          unreadForSeller: increment(1),
        }, { merge: true });
        setDoc(doc(db, 'listings', id), { messagesCount: increment(1), updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
      }

      setMessageText('');
      router.push(`/chat/${chatId}`);
    } catch (e) {
      console.error('Failed to open chat:', e);
      toast.error('Failed to open chat. Please try again.');
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
      toast.error('Venue location not available');
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
      navigator.clipboard.writeText(`https://syph.app/listing/${listing.id}`).then(() => toast.success('Link copied!'));
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
  if (listing.priceText?.trim()) {
    price = listing.priceText.trim();
  } else if (listing.priceValue != null) {
    if (selectedCurrency && selectedCurrency !== listing.currencyCode) {
      price = `≈ ${formatConverted(listing.priceValue, listing.currencyCode, selectedCurrency)}`;
    } else {
      price = `${getCurrencySymbol(listing.currencyCode)}${listing.priceValue.toLocaleString()}`;
    }
  } else {
    price = tr('priceNotSet', selectedLanguage);
  }

  const saved = isSaved(listing.id);
  const isOwner = (user?.uid ?? auth.currentUser?.uid) === listing.ownerUid;

  return (
    <div dir={getDir(selectedLanguage)} className="app-shell" style={{ minHeight: '100vh', backgroundColor: '#D6ECFF' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0F2B6E 0%, #1E4DD9 100%)', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 40 }}>
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
        <div style={{ borderRadius: 24, overflow: 'hidden', aspectRatio: '16/9', position: 'relative', backgroundColor: '#f2f5f9' }}>
          {images.length === 0 ? (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>📷</div>
          ) : (
            <>
              <Image
                src={images[currentImage]}
                alt={listing.title}
                fill
                style={{ objectFit: 'cover' }}
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
        <div style={{ background: '#fff', borderRadius: 20, padding: 18, boxShadow: '0 5px 12px rgba(0,0,0,0.03)', border: '1px solid #e8edf5', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <p style={{ flex: 1, margin: 0, fontWeight: 900, fontSize: 21, color: '#0f172a', lineHeight: 1.2 }}>{sanitizeText(listing.title)}</p>
            <button onClick={() => toggleSaved(listing.id)} style={{ background: '#f8fafc', borderRadius: 14, border: 'none', cursor: 'pointer', padding: 8, display: 'flex', flexShrink: 0 }}>
              {saved ? <BookmarkCheck size={22} color="#2E5BFF" /> : <Bookmark size={22} color="#0F2B6E" />}
            </button>
          </div>
          <p style={{ margin: '10px 0 6px', fontWeight: 900, fontSize: 26, color: '#0F2B6E' }}>{price}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {listing.negotiable && <Badge icon={<Handshake size={15} color="#2E9B55" />} text={tr('negotiable', selectedLanguage)} fg="#2E9B55" />}
            {listing.condition && <Badge icon={<span style={{ fontSize: 14 }}>{listing.condition === 'New' ? '✨' : '🔄'}</span>} text={listing.condition === 'New' ? tr('new', selectedLanguage) : tr('used', selectedLanguage)} fg={listing.condition === 'New' ? '#2E9B55' : '#FF9800'} />}
            {listing.isSponsored && <Badge icon={<Award size={15} color="#63B3ED" />} text={tr('sponsored', selectedLanguage)} fg="#63B3ED" />}
            {listing.isHappening && <Badge icon={<Zap size={15} color="#2E9B55" />} text={tr('happening', selectedLanguage)} fg="#2E9B55" />}
            {listing.rating != null && listing.rating > 0 && <Badge icon={<Star size={15} color="#FF9800" fill="#FF9800" />} text={`${listing.rating.toFixed(1)} ★`} fg="#FF9800" />}
          </div>
        </div>

        {/* Stats strip */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '12px 16px', boxShadow: '0 5px 12px rgba(0,0,0,0.03)', border: '1px solid #e8edf5', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
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
              <p style={{ margin: '3px 0 0', color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{listing.locationText || 'Venue location'}</p>
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
                {listing.sellerName ? `${listing.sellerName} • ` : ''}View shop & get directions
              </p>
            </div>
            <ChevronRight size={16} color="rgba(255,255,255,0.7)" />
          </div>
        )}

        {/* Specifications */}
        {listing.specifications && Object.keys(listing.specifications).length > 0 && (
          <SectionCard icon={<List size={20} color="#2E5BFF" />} title="Specifications" marginBottom={14}>
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
            {sanitizeText(listing.description) || 'No description added.'}
          </p>
        </SectionCard>

        {/* Bio */}
        {listing.bio?.trim() && (
          <SectionCard icon={<Info size={20} color="#2E5BFF" />} title="About This Item" marginBottom={14}>
            <p style={{ margin: 0, fontWeight: 600, lineHeight: 1.6, color: 'rgba(0,0,0,0.85)', fontSize: 14 }}>{sanitizeText(listing.bio)}</p>
          </SectionCard>
        )}

        {/* Item Details */}
        <SectionCard icon={<List size={20} color="#2E5BFF" />} title={tr('itemDetails', selectedLanguage)} marginBottom={14}>
          {listing.mainCategoryId && <DetailRow label="Category" value={listing.mainCategoryId.replace(/_/g, ' ')} />}
          {listing.subCategoryId && <DetailRow label="Subcategory" value={listing.subCategoryId.replace(/_/g, ' ')} />}
          {listing.condition && <DetailRow label="Condition" value={listing.condition} />}
          <DetailRow label="Price Type" value={listing.negotiable ? 'Negotiable' : 'Fixed'} />
          <DetailRow label="Location" value={listing.locationText || '—'} />
          {listing.regionOrCity && <DetailRow label="Region/City" value={listing.regionOrCity} />}
          <DetailRow label="Country" value={listing.country} />
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
                  {listing.sellerName || 'Seller'}
                </span>
                {isVerified && <span style={{ fontSize: 16 }}>✅</span>}
              </div>
              <p style={{ margin: '3px 0 0', color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {listing.locationText || 'Location not published'}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => router.push(`/shop/${listing.ownerUid}`)} style={{ flex: 1, background: '#fff', color: '#0F2B6E', border: 'none', borderRadius: 16, padding: '14px', fontWeight: 900, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Store size={16} /> {tr('viewShop', selectedLanguage)}
            </button>
            <button onClick={() => openOrCreateChat()} disabled={startingChat} style={{ flex: 1, background: 'transparent', color: '#fff', border: '1.5px solid rgba(255,255,255,0.45)', borderRadius: 16, padding: '14px', fontWeight: 900, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {startingChat ? <span style={{ fontSize: 12 }}>Opening…</span> : <><MessageCircle size={16} /> {tr('messageContact', selectedLanguage)}</>}
            </button>
          </div>
        </div>

        {/* Chat starter card */}
        <SectionCard icon={<MessageCircle size={20} color="#2E5BFF" />} title={tr('chatWithSeller', selectedLanguage)} marginBottom={14}>
          <p style={{ margin: '0 0 14px', color: '#6B7A99', fontWeight: 600, lineHeight: 1.4, fontSize: 13 }}>Send a quick message to the seller.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            {['Is this still available?', "What's the best price?", 'Do you deliver?'].map((msg) => (
              <button key={msg} onClick={() => setMessageText(msg)} style={{ background: '#f0f5ff', border: '1px solid rgba(46,91,255,0.2)', borderRadius: 999, padding: '10px 14px', fontWeight: 800, fontSize: 12.5, color: '#0F2B6E', cursor: 'pointer' }}>
                {msg}
              </button>
            ))}
          </div>
          <textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            disabled={startingChat}
            placeholder="Write a message here…"
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
          <SectionCard icon={<Star size={20} color="#2E5BFF" />} title={`Reviews (${reviews.length})`} marginBottom={14}>
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
            if (!auth.currentUser) { toast.error('Sign in to submit a review'); return; }
            setShowReview(true);
          }}
          style={{ width: '100%', padding: '15px', borderRadius: 18, background: '#2E5BFF', color: '#fff', fontWeight: 900, fontSize: 15, border: 'none', cursor: 'pointer', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <Star size={18} /> {tr('shareYourReview', selectedLanguage)}
        </button>

        {/* Report button */}
        <button
          onClick={() => {
            if (!auth.currentUser) { toast.error('Sign in to report'); return; }
            setShowReport(true);
          }}
          style={{ width: '100%', padding: '15px', borderRadius: 18, background: '#fff', color: '#ef4444', fontWeight: 900, fontSize: 15, border: '1.5px solid #fca5a5', cursor: 'pointer', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <Flag size={18} /> {tr('reportListing', selectedLanguage)}
        </button>

        {/* Related listings */}
        {related.length > 0 && (
          <div>
            <div style={{ background: '#0f172a', borderRadius: 16, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Grid3x3 size={18} color="#fff" />
              <span style={{ flex: 1, color: '#fff', fontWeight: 900, fontSize: 15 }}>{tr('relatedItems', selectedLanguage)}</span>
              <span style={{ color: 'rgba(255,255,255,0.54)', fontWeight: 600, fontSize: 12 }}>{listing.mainCategoryId.replace(/_/g, ' ')}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {related.map((r) => {
                const rPrice = r.priceValue != null ? `${r.currencyCode} ${r.priceValue.toLocaleString()}` : r.priceText ?? 'Price not set';
                const rImg = r.imageUrls?.[0] ?? r.imageUrl;
                return (
                  <div key={r.id} onClick={() => router.push(`/listing/${r.id}`)} style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 3px 6px rgba(0,0,0,0.03)', cursor: 'pointer' }}>
                    <div style={{ aspectRatio: '1.2', position: 'relative', backgroundColor: '#f2f5f9' }}>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
                        <Eye size={12} color="#6B7A99" />
                        <span style={{ fontSize: 11, color: '#6B7A99', fontWeight: 700 }}>{r.viewsCount}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
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
            style={{ flex: 1, height: 50, borderRadius: 25, border: 'none', background: startingChat ? '#9ca3af' : '#2E5BFF', color: '#fff', fontWeight: 800, fontSize: 15, cursor: startingChat ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <MessageCircle size={18} /> {startingChat ? 'Opening…' : tr('messageSeller', selectedLanguage)}
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
