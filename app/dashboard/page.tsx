'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Store, FileText,
  Eye, MessageCircle, Bookmark, Package, Edit3, ChevronRight,
  ArrowLeft, BarChart2, Megaphone, Zap, Calendar, Crown, PlusCircle,
  Star, CreditCard,
} from 'lucide-react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { getSellerProfile } from '@/lib/firestore';
import { getListItemPricing, getSellerPrivilegePercent } from '@/lib/adminSettings';
import SellerFreeListingBanner from '@/components/SellerFreeListingBanner';
import { useAppStore } from '@/store';
import { translate as tr } from '@/lib/i18n';
import type { Listing, SellerProfile } from '@/types';

function mapListing(data: Record<string, unknown>, id: string): Listing {
  const rawStatus = String(data.status ?? 'pending');
  return {
    id,
    title: String(data.title ?? ''),
    description: String(data.description ?? ''),
    imageUrl: String(data.image_url ?? ''),
    sellerName: String(data.seller_name ?? ''),
    ownerUid: String(data.seller_id ?? ''),
    country: String(data.country ?? ''),
    regionOrCity: String(data.region ?? ''),
    locationText: String(data.location_text ?? ''),
    priceText: data.price_text ? String(data.price_text) : undefined,
    priceValue: typeof data.price === 'number' ? data.price : undefined,
    currencyCode: String(data.currency ?? 'USD'),
    negotiable: Boolean(data.is_negotiable),
    mainCategoryId: String(data.category_id ?? ''),
    openNow: Boolean(data.open_now),
    isSponsored: Boolean(data.is_sponsored),
    isHappening: Boolean(data.is_happening),
    isFlashSale: Boolean(data.is_flash_sale),
    isTrial: Boolean(data.is_trial),
    status: rawStatus === 'active' ? 'approved' : rawStatus,
    viewsCount: typeof data.view_count === 'number' ? data.view_count : 0,
    savesCount: typeof data.save_count === 'number' ? data.save_count : 0,
    messagesCount: typeof data.messages_count === 'number' ? data.messages_count : 0,
    createdAt: data.created_at ? String(data.created_at) : undefined,
  };
}

type ListingTab = 'all' | 'pending' | 'approved' | 'rejected';

const STATUS_COLORS: Record<string, string> = {
  approved: '#1F8B4C',
  pending: '#E08A00',
  rejected: '#D13B3B',
  blocked: '#D13B3B',
};
const STATUS_BG: Record<string, string> = {
  approved: '#E6F7EC',
  pending: '#FFF4E5',
  rejected: '#FFECEC',
  blocked: '#FFECEC',
};

export default function DashboardPage() {
  const router = useRouter();
  const { selectedLanguage } = useAppStore();
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [listingTab, setListingTab] = useState<ListingTab>('all');
  const [showAppModal, setShowAppModal] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [blockMessage, setBlockMessage] = useState('');
  const [privilegePct, setPrivilegePct] = useState(0);
  const [freeStopped, setFreeStopped] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      if (!u) { setUid(null); setLoading(false); return; }
      setUid(u.id);
      const sp = await getSellerProfile(u.id);
      setSeller(sp);
      setLoading(false);
      // Privilege discount + free-promo-stopped banners (parity with the app).
      const [pr, pct] = await Promise.all([getListItemPricing(), getSellerPrivilegePercent(u.id)]);
      setPrivilegePct(pct);
      const c = (sp?.operatingCountry ?? '').trim().toLowerCase();
      setFreeStopped(!!c && pr.freeStoppedCountries.includes(c));
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const u = session?.user ?? null;
      if (!u) { setUid(null); setLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    const loadListings = async () => {
      const { data: sellerRow } = await supabase.from('sellers').select('id, is_blocked, block_message').eq('user_id', uid).single();
      if (!sellerRow || cancelled) return;
      const sr = sellerRow as Record<string, unknown>;
      setBlocked(sr.is_blocked === true);
      setBlockMessage(String(sr.block_message ?? ''));
      // Admin-removed listings are hidden from the seller too.
      const { data } = await supabase.from('listings').select('*').eq('seller_id', sr.id).neq('status', 'removed_by_admin');
      if (!cancelled) setListings((data ?? []).map(d => mapListing(d as Record<string, unknown>, String((d as Record<string, unknown>).id ?? ''))));
    };
    loadListings();
    return () => { cancelled = true; };
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
        <div style={{ fontWeight: 900, fontSize: 18, color: '#1E2B45', marginTop: 16 }}>{tr('dashSignInAccess', selectedLanguage)}</div>
        <button onClick={() => router.push('/login')} style={{ marginTop: 20, background: '#2E5BFF', color: '#fff', border: 'none', borderRadius: 14, padding: '12px 32px', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>{tr('signIn', selectedLanguage)}</button>
      </div>
    );
  }


  return (
    <div style={{ minHeight: '100dvh', background: '#F0F4FF', maxWidth: 480, margin: '0 auto' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeInUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Releasing Soon modal */}
      {showAppModal && (
        <div
          onClick={() => setShowAppModal(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}
        >
          <div onClick={e => e.stopPropagation()} style={{
            background: '#fff', borderRadius: 24, padding: '32px 24px', textAlign: 'center',
            maxWidth: 360, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
            animation: 'fadeInUp 0.25s ease forwards',
          }}>
            <div style={{ fontSize: 52, marginBottom: 14 }}>🚀</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#0F2B6E', marginBottom: 10 }}>{tr('releasingSoon', selectedLanguage)}</div>
            <div style={{ fontSize: 14, color: '#6B7A99', fontWeight: 500, lineHeight: 1.65, marginBottom: 22 }}>
              {tr('releasingSoonBody', selectedLanguage)}
            </div>
            <div style={{ background: 'linear-gradient(135deg, #F0F4FF 0%, #E8EEFF 100%)', borderRadius: 14, padding: '14px 16px', marginBottom: 22, border: '1px solid #D7E5FF' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#2E5BFF', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 4 }}>{tr('stayTuned', selectedLanguage)}</div>
              <div style={{ fontSize: 13, color: '#4A5878', fontWeight: 500, lineHeight: 1.5 }}>
                {tr('stayTunedBody', selectedLanguage)}
              </div>
            </div>
            <button
              onClick={() => setShowAppModal(false)}
              style={{
                width: '100%', padding: '14px 0', background: 'linear-gradient(135deg, #0F2B6E 0%, #1E4DD9 100%)',
                border: 'none', borderRadius: 14, color: '#fff', fontWeight: 900, fontSize: 15, cursor: 'pointer',
              }}
            >
              {tr('gotItExcl', selectedLanguage)}
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="sweep" style={{
        background: 'linear-gradient(135deg, #0F2B6E 0%, #1E4DD9 100%)',
        padding: '52px 16px 20px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button onClick={() => router.back()} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, padding: 8, cursor: 'pointer', display: 'flex' }}>
          <ArrowLeft size={20} color="#fff" />
        </button>
        <span style={{ color: '#fff', fontWeight: 900, fontSize: 20 }}>{tr('sellerDashboard', selectedLanguage)}</span>
      </div>

      <div style={{ padding: '16px 16px 90px' }}>

        {/* Blocked banner */}
        {blocked && (
          <div style={{
            background: '#FFF1F0', border: '1.2px solid #F3B4B0', borderRadius: 20,
            padding: 16, marginBottom: 16, display: 'flex', gap: 12, alignItems: 'flex-start',
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(229,57,53,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Store size={20} color="#E53935" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 900, fontSize: 15, color: '#C62828' }}>{tr('accountBlocked', selectedLanguage)}</div>
              <div style={{ color: '#7A2E2B', fontWeight: 600, fontSize: 12.8, lineHeight: 1.4, marginTop: 4 }}>
                {blockMessage.trim() || tr('accountBlockedFallback', selectedLanguage)}
              </div>
            </div>
          </div>
        )}

        {/* Free-listing promo ended in this seller's country */}
        {freeStopped && (
          <div style={{ background: '#FFF6E5', border: '1.2px solid #F3D08A', borderRadius: 20, padding: 16, marginBottom: 16, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(183,121,31,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <CreditCard size={20} color="#B7791F" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 900, fontSize: 15, color: '#8A5A00' }}>{tr('freeListingsEnded', selectedLanguage)}</div>
              <div style={{ color: '#7A5A1E', fontWeight: 600, fontSize: 12.8, lineHeight: 1.4, marginTop: 4 }}>{tr('freeListingsEndedDesc', selectedLanguage)}</div>
            </div>
          </div>
        )}

        {/* Privileged seller — % off all platform fees */}
        {privilegePct > 0 && (
          <div style={{ background: 'linear-gradient(135deg, #E6A000, #F7C948)', borderRadius: 20, padding: 16, marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', boxShadow: '0 6px 14px rgba(230,160,0,0.32)' }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Star size={24} color="#fff" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 900, fontSize: 15, color: '#fff' }}>{tr('privilegedSeller', selectedLanguage)}</div>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: 12.5, lineHeight: 1.35, marginTop: 3 }}>{privilegePct}% {tr('privilegedSellerDesc', selectedLanguage)}</div>
            </div>
            <div style={{ padding: '6px 11px', background: 'rgba(255,255,255,0.22)', borderRadius: 999, flexShrink: 0 }}>
              <span style={{ color: '#fff', fontWeight: 900, fontSize: 12.5 }}>{privilegePct}% OFF</span>
            </div>
          </div>
        )}

        {/* Admin one-shot notice (Free Listings Control) */}
        <SellerFreeListingBanner />

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
                <div style={{ color: '#2E5BFF', fontWeight: 900, fontSize: 12, letterSpacing: 0.6 }}>{tr('sellerProfileLabel', selectedLanguage)}</div>
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
                <Edit3 size={16} /> {tr('editSetup', selectedLanguage)}
              </button>
              <button onClick={() => router.push(`/shop/${uid}`)} style={{
                flex: 1, padding: '11px 0', background: '#2E5BFF', border: 'none',
                borderRadius: 16, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <Store size={16} /> {tr('viewShop', selectedLanguage)}
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
            <div style={{ fontWeight: 900, fontSize: 17, color: '#1E2B45' }}>{tr('sellerSetupNotCompleted', selectedLanguage)}</div>
            <div style={{ color: '#6B7A99', fontSize: 13, marginTop: 8, lineHeight: 1.45 }}>
              {tr('sellerSetupNotCompletedDesc', selectedLanguage)}
            </div>
            <button onClick={() => router.push('/dashboard/setup')} style={{
              marginTop: 16, width: '100%', background: '#2E5BFF', border: 'none',
              borderRadius: 16, padding: '14px 0', color: '#fff', fontWeight: 800,
              fontSize: 14, cursor: 'pointer',
            }}>{tr('completeSellerSetup', selectedLanguage)}</button>
          </div>
        )}

        {/* Hero card */}
        <div style={{
          background: 'linear-gradient(135deg, #1D49C6, #2E67F5)',
          borderRadius: 28, padding: 22, marginBottom: 18,
          boxShadow: '0 10px 18px rgba(36,83,212,0.22)',
        }}>
          <div style={{ color: '#fff', fontWeight: 900, fontSize: 21, lineHeight: 1.2, marginBottom: 12 }}>{tr('growYourBusiness', selectedLanguage)}</div>
          <div style={{ color: '#fff', fontSize: 14, fontWeight: 500, lineHeight: 1.5 }}>
            {tr('growYourBusinessDesc', selectedLanguage)}
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
            <span style={{ fontWeight: 900, fontSize: 15, color: '#1E2B45' }}>{tr('yourAnalytics', selectedLanguage)}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
            {[
              { icon: <Eye size={20} color="#2F6BFF" />, value: totalViews, label: tr('statViews', selectedLanguage), color: '#2F6BFF' },
              { icon: <MessageCircle size={20} color="#00B97C" />, value: totalMessages, label: tr('statChats', selectedLanguage), color: '#00B97C' },
              { icon: <Bookmark size={20} color="#FF8C00" />, value: totalSaves, label: tr('statSaves', selectedLanguage), color: '#FF8C00' },
              { icon: <Package size={20} color="#9B59B6" />, value: totalListings, label: tr('statListings', selectedLanguage), color: '#9B59B6' },
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
            <div style={{ fontWeight: 900, fontSize: 16, color: '#1E2B45' }}>{tr('myListings', selectedLanguage)}</div>
            <button onClick={() => router.push('/dashboard/new')} style={{
              background: '#2E5BFF', border: 'none', borderRadius: 10,
              padding: '6px 14px', color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer',
            }}>{tr('newListingBtn', selectedLanguage)}</button>
          </div>

          <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto' }}>
            {(['all', 'pending', 'approved', 'rejected'] as ListingTab[]).map((tab) => (
              <button key={tab} onClick={() => setListingTab(tab)} style={{
                padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                background: listingTab === tab ? '#2E5BFF' : '#F0F4FF',
                color: listingTab === tab ? '#fff' : '#6B7A99',
                fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap',
              }}>{tr(tab === 'all' ? 'tabAll' : tab === 'pending' ? 'tabPending' : tab === 'approved' ? 'tabApproved' : 'tabRejected', selectedLanguage)}</button>
            ))}
          </div>

          {filteredListings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#6B7A99', fontSize: 14 }}>
              {tr('noListingsYet', selectedLanguage)}
            </div>
          ) : (
            filteredListings.map((l, i) => (
              <div key={l.id} className="anim-fade-up card-zoom" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #F0F4FF', animationDelay: `${Math.min(i, 8) * 0.05}s` }}>
                <div className="card-media" style={{ width: 56, height: 56, borderRadius: 12, overflow: 'hidden', flexShrink: 0, background: '#E8EDFF' }}>
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
                    <span style={{ background: STATUS_BG[l.status] ?? '#F2F5F9', color: STATUS_COLORS[l.status] ?? '#6B7A99', fontSize: 10, fontWeight: 800, borderRadius: 10, padding: '2px 8px' }}>{tr(l.status === 'approved' ? 'tabApproved' : l.status === 'pending' ? 'tabPending' : l.status === 'rejected' ? 'tabRejected' : l.status === 'blocked' ? 'statusBlocked' : 'tabPending', selectedLanguage)}</span>
                    <span style={{ color: '#9AA0B2', fontSize: 11 }}>👁 {l.viewsCount}</span>
                  </div>
                </div>
                <button onClick={() => router.push(`/dashboard/edit/${l.id}`)} style={{ background: '#F0F4FF', border: 'none', borderRadius: 10, padding: '7px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: '#2E5BFF', fontWeight: 700, fontSize: 12 }}>
                  <Edit3 size={13} /> {tr('editShort', selectedLanguage)}
                </button>
              </div>
            ))
          )}
        </div>

        {/* Listing Policies */}
        <div onClick={() => router.push('/dashboard/policy')} className="card-tap" style={{
          background: '#F0F4FF', border: '1.2px solid #BDD0FF', borderRadius: 26, padding: '18px 16px',
          marginBottom: 16, cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.025)',
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <div style={{ width: 62, height: 62, background: '#DDE8FF', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <FileText size={30} color="#2E5BFF" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#2E5BFF', fontWeight: 900, fontSize: 15, lineHeight: 1.2, letterSpacing: 0.3 }}>{tr('listingPolicies', selectedLanguage)}</div>
            <div style={{ color: '#2D3340', fontSize: 13, fontWeight: 500, lineHeight: 1.45, marginTop: 8 }}>
              {tr('listingPoliciesDesc', selectedLanguage)}
            </div>
          </div>
          <ChevronRight size={34} color="#6E7785" />
        </div>

        {/* Seller Tools — actionable request flows (parity with the SYPH app) */}
        <div style={{ background: '#fff', borderRadius: 22, padding: 16, marginBottom: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ background: '#E8F0FF', borderRadius: 12, padding: 8 }}>
              <Store size={20} color="#2E5BFF" />
            </div>
            <span style={{ fontWeight: 900, fontSize: 15, color: '#1E2B45' }}>{tr('sellerTools', selectedLanguage)}</span>
          </div>
          {[
            { icon: <PlusCircle size={26} color="#2E5BFF" />, title: tr('sellMyItem', selectedLanguage), desc: tr('sellMyItemDesc', selectedLanguage), onClick: () => router.push(seller ? '/dashboard/new' : '/dashboard/setup') },
            { icon: <Megaphone size={26} color="#2E5BFF" />, title: tr('featSponsorTitle', selectedLanguage), desc: tr('featSponsorDesc', selectedLanguage), onClick: () => router.push('/dashboard/listings?promote=sponsored') },
            { icon: <Zap size={26} color="#2E5BFF" />, title: tr('flashSaleLabel', selectedLanguage), desc: tr('featFlashDesc', selectedLanguage), onClick: () => router.push('/dashboard/listings?promote=flash_sale') },
            { icon: <Calendar size={26} color="#2E5BFF" />, title: tr('featHappeningsTitle', selectedLanguage), desc: tr('featHappeningsDesc', selectedLanguage), onClick: () => router.push(seller ? '/dashboard/happenings' : '/dashboard/setup') },
            { icon: <Crown size={26} color="#2E5BFF" />, title: tr('featPromotionsTitle', selectedLanguage), desc: tr('featPromotionsDesc', selectedLanguage), onClick: () => router.push('/dashboard/promotions') },
          ].map((t, i, arr) => (
            <button key={t.title} onClick={t.onClick} className="card-tap" style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '12px 4px',
              background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
              borderBottom: i < arr.length - 1 ? '1px solid #F0F4FF' : 'none',
            }}>
              <div style={{ width: 52, height: 52, background: '#E9EEFA', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{t.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 14.5, color: '#2E5BFF' }}>{t.title}</div>
                <div style={{ fontWeight: 500, fontSize: 12.5, color: '#2D3340', marginTop: 3, lineHeight: 1.4 }}>{t.desc}</div>
              </div>
              <ChevronRight size={24} color="#6E7785" style={{ flexShrink: 0 }} />
            </button>
          ))}
        </div>

        {/* Download info */}
        <div style={{ background: '#fff', borderRadius: 18, padding: '18px 16px', marginBottom: 8, border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ fontSize: 28 }}>📱</div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 15, color: '#1E2B45' }}>{tr('getSyphApp', selectedLanguage)}</div>
              <div style={{ fontSize: 12, color: '#6B7A99', marginTop: 2 }}>{tr('availableIosAndroid', selectedLanguage)}</div>
            </div>
          </div>
          <div style={{ fontSize: 13, color: '#4A5878', fontWeight: 500, lineHeight: 1.65, marginBottom: 14 }}>
            {tr('getAppDesc', selectedLanguage)}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Image src="/apple-badge.svg" alt="Download on the App Store" width={160} height={53} onClick={() => setShowAppModal(true)} style={{ flex: 1, height: 48, width: 'auto', borderRadius: 8, cursor: 'pointer' }} />
            <Image src="/google-play-badge.svg" alt="Get it on Google Play" width={160} height={53} onClick={() => setShowAppModal(true)} style={{ flex: 1, height: 48, width: 'auto', borderRadius: 8, cursor: 'pointer' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
