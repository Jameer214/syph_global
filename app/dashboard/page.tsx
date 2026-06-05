'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Store, FileText,
  Eye, MessageCircle, Bookmark, Package, Edit3, ChevronRight,
  ArrowLeft, BarChart2, Smartphone,
} from 'lucide-react';
import Image from 'next/image';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection, query, where, onSnapshot, doc, getDoc,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { getSellerProfile } from '@/lib/firestore';
import type { Listing, SellerProfile } from '@/types';

function mapListing(data: Record<string, unknown>, id: string): Listing {
  return {
    id,
    title: String(data.title ?? ''),
    description: String(data.description ?? ''),
    imageUrl: String(data.imageUrl ?? ''),
    sellerName: String(data.sellerName ?? ''),
    ownerUid: String(data.ownerUid ?? ''),
    country: String(data.country ?? ''),
    regionOrCity: String(data.regionOrCity ?? ''),
    locationText: String(data.locationText ?? ''),
    priceText: data.priceText ? String(data.priceText) : undefined,
    priceValue: typeof data.priceValue === 'number' ? data.priceValue : undefined,
    currencyCode: String(data.currencyCode ?? 'USD'),
    negotiable: Boolean(data.negotiable),
    mainCategoryId: String(data.mainCategoryId ?? ''),
    openNow: Boolean(data.openNow),
    isSponsored: Boolean(data.isSponsored),
    isHappening: Boolean(data.isHappening),
    isFlashSale: Boolean(data.isFlashSale),
    isTrial: Boolean(data.isTrial),
    status: String(data.status ?? 'pending'),
    viewsCount: typeof data.viewsCount === 'number' ? data.viewsCount : 0,
    savesCount: typeof data.savesCount === 'number' ? data.savesCount : 0,
    messagesCount: typeof data.messagesCount === 'number' ? data.messagesCount : 0,
    createdAt: data.createdAt ? String(data.createdAt) : undefined,
  };
}

type ListingTab = 'all' | 'pending' | 'approved' | 'rejected';

const STATUS_COLORS: Record<string, string> = {
  approved: '#1F8B4C',
  pending: '#E08A00',
  rejected: '#D13B3B',
};
const STATUS_BG: Record<string, string> = {
  approved: '#E6F7EC',
  pending: '#FFF4E5',
  rejected: '#FFECEC',
};

export default function DashboardPage() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [listingTab, setListingTab] = useState<ListingTab>('all');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { setUid(null); setLoading(false); return; }
      setUid(u.uid);
      const sp = await getSellerProfile(u.uid);
      setSeller(sp);
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'listings'), where('ownerUid', '==', uid));
    const unsub = onSnapshot(q, (snap) => {
      setListings(snap.docs.map((d) => mapListing(d.data() as Record<string, unknown>, d.id)));
    }, () => {});
    return unsub;
  }, [uid]);

  const totalViews = listings.reduce((s, l) => s + l.viewsCount, 0);
  const totalMessages = listings.reduce((s, l) => s + l.messagesCount, 0);
  const totalSaves = listings.reduce((s, l) => s + l.savesCount, 0);
  const totalListings = listings.length;

  const filteredListings = listingTab === 'all'
    ? listings
    : listings.filter((l) => l.status === listingTab);

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
      <div style={{ minHeight: '100dvh', background: '#F0F4FF', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <Store size={48} color="#2E5BFF" />
        <div style={{ fontWeight: 900, fontSize: 18, color: '#1E2B45', marginTop: 16 }}>Sign in to access your dashboard</div>
        <button onClick={() => router.push('/login')} style={{ marginTop: 20, background: '#2E5BFF', color: '#fff', border: 'none', borderRadius: 14, padding: '12px 32px', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>Sign In</button>
      </div>
    );
  }


  return (
    <div style={{ minHeight: '100dvh', background: '#F0F4FF', maxWidth: 480, margin: '0 auto' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0F2B6E 0%, #1E4DD9 100%)',
        padding: '52px 16px 20px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button onClick={() => router.back()} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, padding: 8, cursor: 'pointer', display: 'flex' }}>
          <ArrowLeft size={20} color="#fff" />
        </button>
        <span style={{ color: '#fff', fontWeight: 900, fontSize: 20 }}>Seller Dashboard</span>
      </div>

      <div style={{ padding: '16px 16px 90px' }}>

        {/* Seller profile card or CTA */}
        {seller ? (
          <div style={{
            background: '#fff', borderRadius: 26, padding: 18, marginBottom: 16,
            border: '1.2px solid #D7E5FF', boxShadow: '0 6px 14px rgba(0,0,0,0.04)',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ width: 58, height: 58, background: '#EAF1FF', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Store size={30} color="#2E5BFF" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#2E5BFF', fontWeight: 900, fontSize: 12, letterSpacing: 0.6 }}>SELLER PROFILE</div>
                <div style={{ fontWeight: 900, fontSize: 18, color: '#1E2B45', marginTop: 4 }}>{seller.businessName}</div>
                {(seller.operatingRegion || seller.operatingCountry) && (
                  <div style={{ color: '#6B7A99', fontWeight: 700, fontSize: 13, marginTop: 4 }}>
                    {[seller.operatingRegion, seller.operatingCountry].filter(Boolean).join(', ')}
                  </div>
                )}
              </div>
              <button onClick={() => router.push('/dashboard/setup')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <Edit3 size={20} color="#2E5BFF" />
              </button>
            </div>
            {seller.bio && (
              <div style={{ background: '#F4F7FF', borderRadius: 18, border: '1px solid #E1EBFF', padding: 14, marginTop: 14, color: '#394255', fontSize: 13, fontWeight: 600, lineHeight: 1.5 }}>
                {seller.bio}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button onClick={() => router.push('/dashboard/setup')} style={{
                flex: 1, padding: '11px 0', background: '#fff', border: '1.5px solid #2E5BFF',
                borderRadius: 16, color: '#2E5BFF', fontWeight: 800, fontSize: 14, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <Edit3 size={16} /> Edit Setup
              </button>
              <button onClick={() => router.push(`/shop/${uid}`)} style={{
                flex: 1, padding: '11px 0', background: '#2E5BFF', border: 'none',
                borderRadius: 16, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <Store size={16} /> View Shop
              </button>
            </div>
          </div>
        ) : (
          <div style={{
            background: '#fff', borderRadius: 26, padding: 20, marginBottom: 16,
            border: '1.2px solid #D7E5FF', boxShadow: '0 6px 14px rgba(0,0,0,0.04)',
            textAlign: 'center',
          }}>
            <div style={{ width: 68, height: 68, background: '#EAF1FF', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <Store size={34} color="#2E5BFF" />
            </div>
            <div style={{ fontWeight: 900, fontSize: 17, color: '#1E2B45' }}>Seller Setup Not Completed</div>
            <div style={{ color: '#6B7A99', fontSize: 13, marginTop: 8, lineHeight: 1.45 }}>
              Complete your seller profile to start listing items and reaching customers.
            </div>
            <button onClick={() => router.push('/dashboard/setup')} style={{
              marginTop: 16, width: '100%', background: '#2E5BFF', border: 'none',
              borderRadius: 16, padding: '14px 0', color: '#fff', fontWeight: 800,
              fontSize: 14, cursor: 'pointer',
            }}>Complete Seller Setup</button>
          </div>
        )}

        {/* Hero card */}
        <div style={{
          background: 'linear-gradient(135deg, #1D49C6, #2E67F5)',
          borderRadius: 28, padding: 22, marginBottom: 18,
          boxShadow: '0 10px 18px rgba(36,83,212,0.22)',
        }}>
          <div style={{ color: '#fff', fontWeight: 900, fontSize: 21, lineHeight: 1.2, marginBottom: 12 }}>Grow your business</div>
          <div style={{ color: '#fff', fontSize: 14, fontWeight: 500, lineHeight: 1.5 }}>
            List items, get discovered by customers, and boost visibility with sponsored listings and flash sales.
          </div>
        </div>

        {/* Analytics */}
        <div style={{
          background: '#fff', borderRadius: 24, padding: 20, marginBottom: 18,
          border: '1.2px solid #D7E5FF', boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ background: '#E8F0FF', borderRadius: 12, padding: 8 }}>
              <BarChart2 size={20} color="#2E5BFF" />
            </div>
            <span style={{ fontWeight: 900, fontSize: 15, color: '#1E2B45' }}>Your Analytics</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
            {[
              { icon: <Eye size={20} color="#2F6BFF" />, value: totalViews, label: 'Views', color: '#2F6BFF' },
              { icon: <MessageCircle size={20} color="#00B97C" />, value: totalMessages, label: 'Chats', color: '#00B97C' },
              { icon: <Bookmark size={20} color="#FF8C00" />, value: totalSaves, label: 'Saves', color: '#FF8C00' },
              { icon: <Package size={20} color="#9B59B6" />, value: totalListings, label: 'Listings', color: '#9B59B6' },
            ].map((chip, i) => (
              <div key={i} style={{ background: `${chip.color}12`, borderRadius: 16, padding: '12px 6px', textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>{chip.icon}</div>
                <div style={{ fontWeight: 900, fontSize: 16, color: chip.color }}>{chip.value}</div>
                <div style={{ fontWeight: 600, fontSize: 10, color: '#6B7A99', marginTop: 2 }}>{chip.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* My Listings section */}
        <div style={{ background: '#fff', borderRadius: 22, padding: 16, marginBottom: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontWeight: 900, fontSize: 16, color: '#1E2B45' }}>My Listings</div>
            <button onClick={() => router.push('/dashboard/new')} style={{
              background: '#2E5BFF', border: 'none', borderRadius: 10,
              padding: '6px 14px', color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer',
            }}>+ New Listing</button>
          </div>

          <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto' }}>
            {(['all', 'pending', 'approved', 'rejected'] as ListingTab[]).map((tab) => (
              <button key={tab} onClick={() => setListingTab(tab)} style={{
                padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                background: listingTab === tab ? '#2E5BFF' : '#F0F4FF',
                color: listingTab === tab ? '#fff' : '#6B7A99',
                fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap', textTransform: 'capitalize',
              }}>{tab}</button>
            ))}
          </div>

          {filteredListings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#6B7A99', fontSize: 14 }}>
              No {listingTab === 'all' ? '' : listingTab} listings yet.
            </div>
          ) : (
            filteredListings.map((l) => (
              <div key={l.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #F0F4FF' }}>
                <div style={{ width: 56, height: 56, borderRadius: 12, overflow: 'hidden', flexShrink: 0, background: '#E8EDFF' }}>
                  {l.imageUrl ? (
                    <Image src={l.imageUrl} alt={l.title} width={56} height={56} style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Package size={24} color="#6B7A99" />
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 13, color: '#1E2B45', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <span style={{ background: STATUS_BG[l.status] ?? '#F2F5F9', color: STATUS_COLORS[l.status] ?? '#6B7A99', fontSize: 10, fontWeight: 800, borderRadius: 10, padding: '2px 8px', textTransform: 'capitalize' }}>{l.status}</span>
                    <span style={{ color: '#9AA0B2', fontSize: 11 }}>👁 {l.viewsCount}</span>
                  </div>
                </div>
                <button onClick={() => router.push(`/dashboard/edit/${l.id}`)} style={{ background: '#F0F4FF', border: 'none', borderRadius: 10, padding: '7px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: '#2E5BFF', fontWeight: 700, fontSize: 12 }}>
                  <Edit3 size={13} /> Edit
                </button>
              </div>
            ))
          )}
        </div>

        {/* Listing Policies */}
        <div onClick={() => router.push('/dashboard/policy')} style={{
          background: '#F0F4FF', border: '1.2px solid #BDD0FF', borderRadius: 26, padding: '18px 16px',
          marginBottom: 16, cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.025)',
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <div style={{ width: 62, height: 62, background: '#DDE8FF', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <FileText size={30} color="#2E5BFF" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#2E5BFF', fontWeight: 900, fontSize: 15, lineHeight: 1.2, letterSpacing: 0.3 }}>Listing Policies</div>
            <div style={{ color: '#2D3340', fontSize: 13, fontWeight: 500, lineHeight: 1.45, marginTop: 8 }}>
              Understand how upgrades, promotions, and happenings work — and what happens when they expire.
            </div>
          </div>
          <ChevronRight size={34} color="#6E7785" />
        </div>

        {/* App-Only Features */}
        <div style={{
          background: 'linear-gradient(135deg, #0F2B6E 0%, #1a3a9e 100%)',
          borderRadius: 22, padding: 20, marginBottom: 16,
          boxShadow: '0 6px 20px rgba(15,43,110,0.25)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ width: 46, height: 46, borderRadius: 14, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Smartphone size={24} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 16, color: '#fff' }}>More on the SYPH App</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>Exclusive mobile features</div>
            </div>
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)', fontWeight: 500, lineHeight: 1.65, marginBottom: 16 }}>
            The following requesting screens are available exclusively in the SYPH mobile app and are not accessible on this website.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
            {[
              { emoji: '⭐', label: 'Sponsor My Item', desc: 'Boost listing visibility to the top of search results' },
              { emoji: '⚡', label: 'Flash Sales', desc: 'Run time-limited discount offers to attract buyers fast' },
              { emoji: '📅', label: 'Post Happenings', desc: 'Share events, markets and local happenings near you' },
              { emoji: '📈', label: 'My Promotions', desc: 'Track and manage all your active promotional campaigns' },
            ].map(f => (
              <div key={f.label} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: '13px 12px', border: '1px solid rgba(255,255,255,0.12)' }}>
                <div style={{ fontSize: 22, marginBottom: 7 }}>{f.emoji}</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 5 }}>{f.label}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 1.4, fontWeight: 500 }}>{f.desc}</div>
              </div>
            ))}
          </div>

          <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 14, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.16)' }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: '#fff', marginBottom: 6 }}>Why app-only?</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', lineHeight: 1.6, fontWeight: 500 }}>
              These features rely on real-time push notifications, in-app payment flows, and mobile-native interactions that deliver the best experience on the SYPH mobile app. Download the app to unlock them — it&apos;s free.
            </div>
          </div>
        </div>

        {/* Download info */}
        <div style={{ background: '#fff', borderRadius: 18, padding: '18px 16px', marginBottom: 8, border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ fontSize: 28 }}>📱</div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 15, color: '#1E2B45' }}>Get the SYPH App</div>
              <div style={{ fontSize: 12, color: '#6B7A99', marginTop: 2 }}>Available on iOS & Android</div>
            </div>
          </div>
          <div style={{ fontSize: 13, color: '#4A5878', fontWeight: 500, lineHeight: 1.65, marginBottom: 14 }}>
            The SYPH app gives you the full seller experience — sponsor listings, run flash sales, post happenings, track promotions, receive real-time buyer messages, and manage everything from your phone.
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, background: '#1E2B45', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>🍎</span>
              <div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>Download on the</div>
                <div style={{ fontSize: 13, color: '#fff', fontWeight: 800 }}>App Store</div>
              </div>
            </div>
            <div style={{ flex: 1, background: '#1E2B45', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>🤖</span>
              <div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>Get it on</div>
                <div style={{ fontSize: 13, color: '#fff', fontWeight: 800 }}>Google Play</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
