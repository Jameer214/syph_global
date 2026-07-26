'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Package, Zap, Crown, Calendar, MoreVertical,
  Pencil, Eye, Trash2, Rocket,
} from 'lucide-react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { deleteListing } from '@/lib/firestore';
import { useAppStore } from '@/store';
import { translate as tr } from '@/lib/i18n';
import type { Listing } from '@/types';

type Tab = 'all' | 'normal' | 'happenings' | 'flash' | 'sponsored';

const STATUS_COLORS: Record<string, { text: string; bg: string }> = {
  approved: { text: '#1F8B4C', bg: '#E6F7EC' },
  pending: { text: '#E08A00', bg: '#FFF4E5' },
  rejected: { text: '#D13B3B', bg: '#FFECEC' },
};

function expiryLabel(dateStr: string, lang: string): string {
  const exp = new Date(dateStr);
  const diff = exp.getTime() - Date.now();
  if (diff < 0) return tr('expiredLabel', lang);
  const days = Math.floor(diff / 86400000);
  if (days >= 1) return `${tr('expiresIn', lang)} ${days}d`;
  const hrs = Math.floor(diff / 3600000);
  if (hrs >= 1) return `${tr('expiresIn', lang)} ${hrs}h`;
  return tr('expiresSoon', lang);
}

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
    flashSaleEndsAt: data.flash_sale_until ? String(data.flash_sale_until) : undefined,
  };
}

export default function MyListingsPage() {
  const router = useRouter();
  const { selectedLanguage: lang } = useAppStore();
  const [uid, setUid] = useState<string | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('all');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Listing | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUid(session?.user?.id ?? null);
      if (!session?.user) setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    const loadListings = async () => {
      const { data: sellerRow } = await supabase.from('sellers').select('id').eq('user_id', uid).single();
      if (!sellerRow || cancelled) { setLoading(false); return; }
      const { data } = await supabase.from('listings').select('*').eq('seller_id', (sellerRow as Record<string, unknown>).id);
      if (!cancelled) {
        setListings((data ?? []).map(d => mapListing(d as Record<string, unknown>, String((d as Record<string, unknown>).id ?? ''))));
        setLoading(false);
      }
    };
    loadListings();
    return () => { cancelled = true; };
  }, [uid]);

  const filtered = listings.filter((l) => {
    if (tab === 'normal') return !l.isHappening && !l.isSponsored && !l.isFlashSale;
    if (tab === 'happenings') return l.isHappening;
    if (tab === 'flash') return l.isFlashSale;
    if (tab === 'sponsored') return l.isSponsored;
    return true;
  });

  const approved = listings.filter((l) => l.status === 'approved').length;
  const pending = listings.filter((l) => l.status === 'pending').length;
  const rejected = listings.filter((l) => l.status === 'rejected').length;

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await deleteListing(deleteConfirm.id);
      toast.success(tr('listingDeleted', lang));
      setDeleteConfirm(null);
    } catch {
      toast.error(tr('failedToDeleteListing', lang));
    } finally {
      setDeleting(false);
    }
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: 'all', label: tr('tabAll', lang) },
    { id: 'normal', label: tr('normalTab', lang) },
    { id: 'happenings', label: tr('happenings', lang) },
    { id: 'flash', label: tr('flashSaleLabel', lang) },
    { id: 'sponsored', label: tr('sponsored', lang) },
  ];

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
        <div style={{ fontWeight: 900, fontSize: 18, color: '#1E2B45' }}>{tr('signInToViewListings', lang)}</div>
        <button onClick={() => router.push('/login')} style={{ marginTop: 20, background: '#2E5BFF', color: '#fff', border: 'none', borderRadius: 14, padding: '12px 32px', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>{tr('signIn', lang)}</button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#F0F4FF', paddingBottom: 40 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0F2B6E 0%, #1E4DD9 100%)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 40 }}>
        <button onClick={() => router.back()} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, padding: 8, cursor: 'pointer', display: 'flex' }}>
          <ArrowLeft size={20} color="#fff" />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#fff', fontWeight: 900, fontSize: 18 }}>{tr('myListings', lang)}</div>
          <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 }}>{listings.length} {tr('listingsWord', lang)}</div>
        </div>
        <button onClick={() => router.push('/dashboard/new')} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, padding: '7px 14px', cursor: 'pointer', color: '#fff', fontWeight: 800, fontSize: 13 }}>
          {tr('newShort', lang)}
        </button>
      </div>

      <div style={{ padding: '16px 16px 0' }}>

        {/* Summary card */}
        {listings.length > 0 && (
          <div style={{ background: 'linear-gradient(135deg, #1D49C6, #2E67F5)', borderRadius: 24, padding: 20, marginBottom: 16, boxShadow: '0 10px 22px rgba(36,83,212,0.22)' }}>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 900, fontSize: 11, letterSpacing: 0.8, marginBottom: 6 }}>{tr('myListings', lang).toUpperCase()}</div>
            <div style={{ color: '#fff', fontWeight: 900, fontSize: 22, marginBottom: 8 }}>{listings.length} {tr('listingsWord', lang)}</div>
            <div style={{ color: '#fff', fontWeight: 500, fontSize: 13, lineHeight: 1.5, marginBottom: 16 }}>
              {tr('trackListingsDesc', lang)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {[
                { label: tr('tabApproved', lang), value: approved },
                { label: tr('tabPending', lang), value: pending },
                { label: tr('tabRejected', lang), value: rejected },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: '12px 10px', textAlign: 'center' }}>
                  <div style={{ color: '#fff', fontWeight: 900, fontSize: 18 }}>{value}</div>
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: 12, marginTop: 4 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 14 }} className="no-scrollbar">
          {TABS.map(({ id, label }) => (
            <button key={id} onClick={() => setTab(id)} style={{
              padding: '8px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
              background: tab === id ? '#2E5BFF' : '#fff',
              color: tab === id ? '#fff' : '#6B7A99',
              fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap',
              boxShadow: tab === id ? '0 4px 10px rgba(46,91,255,0.25)' : '0 2px 6px rgba(0,0,0,0.05)',
            }}>{label}</button>
          ))}
        </div>

        {/* Empty state */}
        {listings.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 24, padding: 28, textAlign: 'center', border: '1px solid #eef2f8' }}>
            <div style={{ width: 72, height: 72, background: '#EAF1FF', borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <Package size={36} color="#2E5BFF" />
            </div>
            <div style={{ fontWeight: 900, fontSize: 18, color: '#1E2B45' }}>{tr('noListingsYet', lang)}</div>
            <div style={{ color: '#6B7A99', fontWeight: 600, fontSize: 13, marginTop: 8, lineHeight: 1.45 }}>
              {tr('whenSubmitAppear', lang)}
            </div>
            <button onClick={() => router.push('/dashboard/new')} style={{ marginTop: 16, width: '100%', background: '#2E5BFF', border: 'none', borderRadius: 16, padding: '14px 0', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
              {tr('createListing', lang)}
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 20px', color: '#6B7A99', fontWeight: 700, fontSize: 14 }}>
            {tr('noListingsCategory', lang)}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filtered.map((l) => {
              const sc = STATUS_COLORS[l.status] ?? { text: '#6B7A99', bg: '#F2F5F9' };
              const hasPromo = (l.isFlashSale || l.isSponsored) && l.flashSaleEndsAt;
              const promoExpired = hasPromo && new Date(l.flashSaleEndsAt!).getTime() < Date.now();

              return (
                <div key={l.id} style={{ background: '#fff', borderRadius: 22, border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', overflow: 'hidden', position: 'relative' }}>
                  <div style={{ padding: 14, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    {/* Image */}
                    <div style={{ width: 84, height: 84, borderRadius: 16, overflow: 'hidden', flexShrink: 0, background: '#EEF2FB', position: 'relative' }}>
                      {l.imageUrl ? (
                        <Image src={l.imageUrl} alt={l.title} fill style={{ objectFit: 'cover' }} sizes="84px" />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Package size={28} color="#9AA0B2" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 900, fontSize: 15, color: '#0F2B6E', lineHeight: 1.25, marginBottom: 8 }}>{l.title}</div>
                      {/* Chips */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                        {l.priceText && (
                          <span style={{ background: '#EEF4FF', borderRadius: 999, padding: '5px 10px', fontSize: 11.5, fontWeight: 700, color: '#2E5BFF' }}>{l.priceText}</span>
                        )}
                        {l.locationText && (
                          <span style={{ background: '#F0F4FF', borderRadius: 999, padding: '5px 10px', fontSize: 11.5, fontWeight: 700, color: '#4A5878' }}>{l.locationText}</span>
                        )}
                        {l.isHappening && <span style={{ background: '#E6F7EC', borderRadius: 999, padding: '5px 10px', fontSize: 11.5, fontWeight: 700, color: '#2E9B55' }}>{tr('happening', lang)}</span>}
                        {l.isSponsored && <span style={{ background: '#EAF1FF', borderRadius: 999, padding: '5px 10px', fontSize: 11.5, fontWeight: 700, color: '#2F6BFF' }}>{tr('sponsored', lang)}</span>}
                        {l.isFlashSale && <span style={{ background: '#FFECEC', borderRadius: 999, padding: '5px 10px', fontSize: 11.5, fontWeight: 700, color: '#E53935' }}>{tr('flashSaleLabel', lang)}</span>}
                      </div>
                      <span style={{ background: sc.bg, color: sc.text, fontSize: 10, fontWeight: 800, borderRadius: 10, padding: '3px 10px', textTransform: 'capitalize' }}>
                        {l.status === 'approved' ? tr('tabApproved', lang) : l.status === 'pending' ? tr('tabPending', lang) : l.status === 'rejected' ? tr('tabRejected', lang) : l.status === 'blocked' ? tr('statusBlocked', lang) : l.status}
                      </span>
                    </div>

                    {/* Menu */}
                    <div style={{ position: 'relative' }}>
                      <button onClick={() => setMenuOpen(menuOpen === l.id ? null : l.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#9AA0B2' }}>
                        <MoreVertical size={20} />
                      </button>
                      {menuOpen === l.id && (
                        <>
                          <div onClick={() => setMenuOpen(null)} style={{ position: 'fixed', inset: 0, zIndex: 90 }} />
                          <div style={{ position: 'absolute', top: 28, right: 0, background: '#fff', borderRadius: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 91, minWidth: 160, border: '1px solid #E0E8F0', overflow: 'hidden' }}>
                            {[
                              { icon: <Eye size={15} />, label: tr('viewLabel', lang), color: '#0F2B6E', action: () => { setMenuOpen(null); router.push(`/listing/${l.id}`); } },
                              { icon: <Pencil size={15} />, label: tr('editShort', lang), color: '#0F2B6E', action: () => { setMenuOpen(null); router.push(`/dashboard/edit/${l.id}`); } },
                              ...(l.status === 'approved' && !l.isHappening && !l.isSponsored && !l.isFlashSale ? [{
                                icon: <Rocket size={15} />, label: tr('upgradeLabel', lang), color: '#2F6BFF',
                                action: () => { setMenuOpen(null); router.push(`/dashboard/upgrade/${l.id}`); },
                              }] : []),
                              { icon: <Trash2 size={15} />, label: tr('deleteListing', lang), color: '#E53935', action: () => { setMenuOpen(null); setDeleteConfirm(l); } },
                            ].map(({ icon, label, color, action }) => (
                              <button key={label} onClick={action} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', color, fontWeight: 700, fontSize: 14, textAlign: 'left' }}>
                                {icon} {label}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Expiry banner */}
                  {hasPromo && !promoExpired && (
                    <div style={{ margin: '0 14px 14px', padding: '8px 12px', borderRadius: 12, background: l.isFlashSale ? '#FFEBEE' : '#EAF1FF', border: `1px solid ${l.isFlashSale ? 'rgba(229,57,53,0.25)' : 'rgba(47,107,255,0.25)'}`, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {l.isFlashSale ? <Zap size={14} color="#E53935" /> : <Crown size={14} color="#2F6BFF" />}
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: l.isFlashSale ? '#E53935' : '#2F6BFF' }}>{expiryLabel(l.flashSaleEndsAt!, lang)}</span>
                      </div>
                      <span style={{ background: 'rgba(46,157,85,0.1)', borderRadius: 999, padding: '3px 8px', fontSize: 10.5, fontWeight: 700, color: '#2E7D32' }}>{tr('revertsToNormal', lang)}</span>
                    </div>
                  )}
                  {hasPromo && promoExpired && (
                    <div style={{ margin: '0 14px 14px', padding: '8px 12px', borderRadius: 12, background: '#FFF4E5', border: '1px solid rgba(224,138,0,0.3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#E08A00' }}>{tr('promotionExpired', lang)}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <>
          <div onClick={() => !deleting && setDeleteConfirm(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200 }} />
          <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: '#fff', borderRadius: '22px 22px 0 0', padding: '24px 20px 36px', zIndex: 201 }}>
            <div style={{ width: 36, height: 4, background: '#e2e8f0', borderRadius: 2, margin: '0 auto 20px' }} />
            <div style={{ width: 56, height: 56, background: '#FFECEC', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <Trash2 size={26} color="#E53935" />
            </div>
            <div style={{ textAlign: 'center', fontWeight: 900, fontSize: 18, color: '#1E2B45', marginBottom: 8 }}>{tr('deleteListingQ', lang)}</div>
            <div style={{ textAlign: 'center', color: '#6B7A99', fontSize: 13, fontWeight: 600, lineHeight: 1.5, marginBottom: 24 }}>
              {tr('areYouSureDelete', lang)} <strong style={{ color: '#0F2B6E' }}>{deleteConfirm.title}</strong>? {tr('cannotBeUndone', lang)}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteConfirm(null)} disabled={deleting} style={{ flex: 1, padding: 14, borderRadius: 16, border: '1.5px solid #e2e8f0', background: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', color: '#4A5878' }}>{tr('cancel', lang)}</button>
              <button onClick={handleDelete} disabled={deleting} style={{ flex: 1, padding: 14, borderRadius: 16, border: 'none', background: '#E53935', color: '#fff', fontWeight: 900, fontSize: 15, cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1 }}>
                {deleting ? tr('deletingEllipsis', lang) : tr('deleteListing', lang)}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
