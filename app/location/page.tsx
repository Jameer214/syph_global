'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Globe, X, ChevronDown, ChevronRight, LayoutGrid, Menu, Search, SlidersHorizontal, Navigation, MessageCircle, Handshake, Eye, ShoppingCart, BadgeDollarSign, Shield, Zap, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '@/store';
import { tr, getDir, trCategory } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { COUNTRIES, COUNTRY_FLAGS } from '@/data/countries';
import { CATEGORIES as REAL_CATEGORIES } from '@/data/categories';
import MenuDrawer from '@/components/MenuDrawer';
import Reveal from '@/components/Reveal';
import ShopSuggestions from '@/components/ShopSuggestions';
import { searchSellers, type ShopHit } from '@/lib/firestore';

// Canonical English values stored to the profile — only the display is translated.
const REGIONS = ['Central', 'Eastern', 'Northern', 'Western', 'Southern'];
const REGION_KEYS: Record<string, string> = {
  Central: 'regionCentral', Eastern: 'regionEastern', Northern: 'regionNorthern',
  Western: 'regionWestern', Southern: 'regionSouthern',
};

// Real category tree — cards/chips route into the category browser
const CATEGORIES = REAL_CATEGORIES.map(c => ({ id: c.id, emoji: c.icon, name: c.title }));

const RECENT_KEY = 'syph-recent-countries';

function loadRecents(): string[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); } catch { return []; }
}

function pushRecent(country: string, current: string[]): string[] {
  const t = country.trim();
  if (!t) return current;
  const next = [t, ...current.filter(c => c.toLowerCase() !== t.toLowerCase())].slice(0, 2);
  if (typeof window !== 'undefined') localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  return next;
}

export default function LocationPage() {
  const router = useRouter();
  const { setLocationSet, setRegion, setHomeCountry, homeCountry, selectedCountry: storedCountry, selectedLanguage } = useAppStore();

  const [countrySearch, setCountrySearch] = useState('');
  const [pickedCountry, setPickedCountry] = useState('');
  const [pickedRegion, setPickedRegion] = useState('');
  const [recents, setRecents] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detectingGPS, setDetectingGPS] = useState(false);
  const [gpsDetectedCountry, setGpsDetectedCountry] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [goodsSearch, setGoodsSearch] = useState('');
  // Matching seller shops for the goods query — shown as a live dropdown under
  // the search bar so buyers can open a storefront directly. Additive.
  const [shopResults, setShopResults] = useState<ShopHit[]>([]);
  useEffect(() => {
    const q = goodsSearch.trim();
    if (!q) { setShopResults([]); return; }
    const t = setTimeout(() => {
      searchSellers(q, homeCountry || storedCountry || undefined).then(setShopResults);
    }, 350);
    return () => clearTimeout(t);
  }, [goodsSearch, homeCountry, storedCountry]);
  const [showAppModal, setShowAppModal] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // On mount: pre-fill from store, load recents, auto-detect GPS silently
  useEffect(() => {
    setRecents(loadRecents());
    if (storedCountry) {
      setPickedCountry(storedCountry);
      setCountrySearch(storedCountry);
    }
    const t = setTimeout(() => detectGPS(false), 600);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredCountries = (countrySearch.trim() && !pickedCountry)
    ? COUNTRIES.filter(c => c.toLowerCase().includes(countrySearch.toLowerCase())).slice(0, 10)
    : [];

  const selectCountry = (c: string) => {
    setPickedCountry(c);
    setCountrySearch(c);
    setShowSuggestions(false);
    setRecents(prev => pushRecent(c, prev));
  };

  const clearCountry = () => {
    setPickedCountry('');
    setCountrySearch('');
    setShowSuggestions(true);
  };

  const detectGPS = (showErrors: boolean) => {
    if (!navigator.geolocation) {
      if (showErrors) toast.error(tr('geoNotSupported', selectedLanguage));
      return;
    }
    if (detectingGPS) return;
    setDetectingGPS(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          const data = await res.json();
          const country = data?.address?.country ?? '';
          if (country && COUNTRIES.includes(country)) {
            selectCountry(country);
            setGpsDetectedCountry(country);
            // Establish the currency anchor from GPS once (mirrors Flutter:
            // only when no home is set yet). Browsing later won't move currency.
            if (!homeCountry) setHomeCountry(country);
          } else if (showErrors) {
            toast.error(tr('couldNotDetermineCountry', selectedLanguage));
          }
        } catch {
          if (showErrors) toast.error(tr('failedGetLocation', selectedLanguage));
        } finally {
          setDetectingGPS(false);
        }
      },
      () => {
        setDetectingGPS(false);
        if (showErrors) toast.error(tr('locationAccessDenied', selectedLanguage));
      },
      { timeout: 10000 }
    );
  };

  const handleContinue = async () => {
    if (!pickedCountry.trim()) {
      toast.error(tr('selectCountryOrGps', selectedLanguage));
      return;
    }
    setSaving(true);
    try {
      // setLocationSet also auto-sets currency for the picked country
      setLocationSet(true, pickedCountry);
      setRegion(pickedRegion);

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase.from('profiles').upsert({
          id: session.user.id,
          country: pickedCountry,
          region: pickedRegion || null,
        });
      }

      router.replace('/home');
    } catch {
      toast.error(tr('failedToSaveRetry', selectedLanguage));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div dir={getDir(selectedLanguage)} style={{ minHeight: '100dvh', background: '#F0F4FF', display: 'flex', flexDirection: 'column' }}>
      <MenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />

      {/* Releasing Soon modal */}
      {showAppModal && (
        <div
          onClick={() => setShowAppModal(false)}
          className="sheet-backdrop"
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
              className="btn-tap"
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

      {/* ── Top App Bar (matches home screen) ── */}
      <div style={{
        background: 'linear-gradient(135deg, #0F2B6E 0%, #1E4DD9 100%)',
        padding: '14px 16px',
        position: 'sticky', top: 0, zIndex: 40,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.65)', fontSize: 10, fontWeight: 600, letterSpacing: '0.5px' }}>
              {tr('tagline', selectedLanguage).toUpperCase()}
            </p>
            <p style={{ margin: '2px 0 0', color: '#fff', fontSize: 20, fontWeight: 900, letterSpacing: '1px' }}>SYPH</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link href="/categories" style={{
              background: '#F39C12', borderRadius: 10, padding: '7px 12px',
              display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none',
            }}>
              <LayoutGrid size={16} color="#fff" />
              <span style={{ color: '#fff', fontWeight: 800, fontSize: 12 }}>{tr('category', selectedLanguage)}</span>
            </Link>
            <button onClick={() => setMenuOpen(true)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '6px',
            }}>
              <Menu size={22} color="#fff" strokeWidth={2.2} />
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 110px' }}>

        {/* GPS detection banner — matches Flutter's home country detection card */}
        {gpsDetectedCountry ? (
          /* Blue ribbon: detected country */
          <div className="anim-pop sweep" style={{
            display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14,
            background: 'linear-gradient(135deg, #1E4DD9 0%, #2E5BFF 100%)',
            borderRadius: 16, padding: '13px 16px',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              animation: 'float 3s ease-in-out infinite',
            }}>
              <Navigation size={18} color="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: 700, letterSpacing: '0.3px' }}>
                {tr('gpsDetected', selectedLanguage).toUpperCase()}
              </p>
              <p style={{ margin: '2px 0 0', color: '#fff', fontSize: 15, fontWeight: 900 }}>
                {COUNTRY_FLAGS[gpsDetectedCountry] ?? '🌍'} {gpsDetectedCountry}
              </p>
            </div>
            <span className="anim-pop" style={{ color: 'rgba(255,255,255,0.85)', fontSize: 22, animationDelay: '0.25s' }}>✓</span>
          </div>
        ) : (
          /* White card: detect home country prompt */
          <div className="anim-fade-up" style={{
            display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14,
            background: '#fff', borderRadius: 16, padding: '13px 16px',
            border: '1px solid rgba(0,0,0,0.08)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          }}>
            <Navigation size={20} color="#2E5BFF" style={{ flexShrink: 0 }} />
            <p style={{ flex: 1, margin: 0, fontWeight: 800, fontSize: 14, color: '#1a1a2e' }}>
              {tr('useMyLocation', selectedLanguage)}
            </p>
            {detectingGPS ? (
              <div style={{
                width: 18, height: 18, border: '2.5px solid #2E5BFF',
                borderTopColor: 'transparent', borderRadius: '50%',
                animation: 'spin 0.7s linear infinite', flexShrink: 0,
              }} />
            ) : (
              <button
                onClick={() => detectGPS(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2E5BFF', fontWeight: 800, fontSize: 14, padding: 0, flexShrink: 0 }}
              >
                {tr('useMyLocation', selectedLanguage)}
              </button>
            )}
          </div>
        )}

        {/* Dark goods search bar — matches Flutter's dark search bar */}
        <div className="anim-fade-up" style={{ display: 'flex', gap: 10, marginBottom: 14, animationDelay: '0.06s' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search
              size={17}
              style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.55)', pointerEvents: 'none' }}
            />
            <input
              type="text"
              value={goodsSearch}
              onChange={(e) => setGoodsSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && goodsSearch.trim()) {
                  if (typeof window !== 'undefined') {
                    sessionStorage.setItem('syph-pending-search', goodsSearch.trim());
                  }
                  router.push('/home');
                }
              }}
              placeholder={tr('searchGoodsServices', selectedLanguage)}
              className="input-anim-dark"
              style={{
                width: '100%', height: 46, borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.10)',
                background: '#1A1A1A', paddingLeft: 44, paddingRight: 14,
                fontSize: 14, fontWeight: 600, color: '#fff', outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {/* Live shop suggestions — open a storefront directly from here. */}
            {goodsSearch.trim() !== '' && shopResults.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 40,
                background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0',
                boxShadow: '0 8px 24px rgba(0,0,0,0.18)', marginTop: 6,
                maxHeight: 300, overflowY: 'auto',
              }}>
                <ShopSuggestions
                  shops={shopResults}
                  label={tr('shopsSectionLabel', selectedLanguage)}
                  onNavigate={() => setGoodsSearch('')}
                />
              </div>
            )}
          </div>
          <button
            type="button"
            className="btn-tap"
            style={{
              width: 46, height: 46, borderRadius: 14, flexShrink: 0,
              background: '#fff', border: '1px solid rgba(0,0,0,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <SlidersHorizontal size={18} color="#1a1a2e" />
          </button>
        </div>

        {/* Page title section */}
        <div className="anim-fade-up" style={{
          display: 'flex', alignItems: 'center', gap: 10,
          marginBottom: 12, animationDelay: '0.12s',
        }}>
          <div className="radar" style={{
            width: 38, height: 38, borderRadius: 12,
            background: '#2E5BFF',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            boxShadow: '0 4px 10px rgba(46,91,255,0.28)',
          }}>
            <MapPin size={19} color="#fff" />
          </div>
          <div>
            <div style={{ color: '#1a1a2e', fontWeight: 900, fontSize: 18, lineHeight: 1 }}>{tr('whereAreYou', selectedLanguage)}</div>
            <div style={{ color: '#6B7A99', fontSize: 12.5, marginTop: 3, fontWeight: 500 }}>
              {tr('chooseCountryRegion', selectedLanguage)}
            </div>
          </div>
        </div>

        {/* Country + Region card */}
        <div
          ref={cardRef}
          className="anim-fade-up"
          style={{
            background: '#fff', borderRadius: 18,
            boxShadow: '0 3px 12px rgba(0,0,0,0.08)',
            border: '1px solid rgba(0,0,0,0.06)',
            overflow: 'hidden', marginBottom: 12,
            animationDelay: '0.18s',
          }}
        >
          <div style={{ display: 'flex' }}>
            <div style={{ width: 4, background: '#2E5BFF', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              {/* Country search field */}
              <div style={{ padding: '12px 12px 10px', position: 'relative' }}>
                <Globe
                  size={17}
                  style={{
                    position: 'absolute', left: 26, top: '50%',
                    transform: 'translateY(-50%)', color: '#2E5BFF', pointerEvents: 'none',
                  }}
                />
                <input
                  type="text"
                  value={countrySearch}
                  onChange={(e) => {
                    if (pickedCountry) setPickedCountry('');
                    setCountrySearch(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder={tr('selectCountry', selectedLanguage)}
                  className="input-anim"
                  style={{
                    width: '100%', height: 44, borderRadius: 12,
                    border: '1px solid rgba(0,0,0,0.10)', background: '#f8faff',
                    paddingLeft: 42, paddingRight: countrySearch ? 40 : 14,
                    fontSize: 14, fontWeight: 600, color: '#1a1a2e', outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                {countrySearch && (
                  <button
                    type="button"
                    onClick={clearCountry}
                    style={{
                      position: 'absolute', right: 24, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#9ca3af', display: 'flex', padding: 2,
                    }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Region divider label */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px' }}>
                <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                <span style={{ color: '#9ca3af', fontWeight: 700, fontSize: 11 }}>{tr('region', selectedLanguage)}</span>
                <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
              </div>

              {/* Region dropdown */}
              <div style={{ padding: '8px 12px 12px', position: 'relative' }}>
                <MapPin
                  size={16}
                  style={{
                    position: 'absolute', left: 26, top: '50%',
                    transform: 'translateY(-50%)', color: '#2E5BFF', pointerEvents: 'none',
                  }}
                />
                <select
                  value={pickedRegion}
                  onChange={(e) => setPickedRegion(e.target.value)}
                  className="input-anim"
                  style={{
                    width: '100%', height: 44, borderRadius: 12,
                    border: '1px solid rgba(0,0,0,0.10)', background: '#f8faff',
                    paddingLeft: 40, paddingRight: 36, fontSize: 14, fontWeight: 600,
                    color: pickedRegion ? '#1a1a2e' : '#9ca3af',
                    outline: 'none', appearance: 'none', cursor: 'pointer',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="">{tr('selectRegion', selectedLanguage)}</option>
                  {REGIONS.map(r => <option key={r} value={r}>{tr(REGION_KEYS[r], selectedLanguage)}</option>)}
                </select>
                <ChevronDown
                  size={16}
                  style={{
                    position: 'absolute', right: 24, top: '50%',
                    transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Country suggestions */}
          {showSuggestions && filteredCountries.length > 0 && (
            <div style={{ borderTop: '1px solid #f1f5f9' }}>
              {filteredCountries.map((c, idx) => {
                const isSelected = pickedCountry.toLowerCase() === c.toLowerCase();
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => selectCountry(c)}
                    className="row-tap anim-fade-up"
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                      padding: '11px 16px',
                      background: isSelected ? 'rgba(46,91,255,0.06)' : 'none',
                      border: 'none', cursor: 'pointer', textAlign: 'left',
                      borderBottom: idx < filteredCountries.length - 1 ? '1px solid #f1f5f9' : 'none',
                      animationDelay: `${idx * 0.035}s`, animationDuration: '0.3s',
                    }}
                  >
                    <span className="bob" style={{ fontSize: 22, flexShrink: 0, animationDelay: `${(idx * 0.45) % 2.8}s` }}>
                      <span className="row-flag">{COUNTRY_FLAGS[c] ?? '🌍'}</span>
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', flex: 1 }}>{c}</span>
                    {isSelected
                      ? <span className="anim-pop" style={{ color: '#2E5BFF', fontWeight: 900, fontSize: 16 }}>✓</span>
                      : <ChevronRight size={16} className="row-chev" style={{ color: '#d1d5db', flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Countries */}
        <div className="anim-fade-up" style={{ fontSize: 11, fontWeight: 800, color: '#6B7A99', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8, paddingLeft: 2, animationDelay: '0.24s' }}>
          {tr('recentCountries', selectedLanguage)}
        </div>
        <div className="anim-fade-up" style={{
          background: '#fff', borderRadius: 16, overflow: 'hidden',
          border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
          animationDelay: '0.3s',
        }}>
          {recents.length === 0 ? (
            <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 24 }}>🏳️</span>
              <div>
                <div style={{ fontWeight: 900, fontSize: 14, color: '#1a1a2e' }}>{tr('noRecentCountries', selectedLanguage)}</div>
                <div style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600, marginTop: 2 }}>{tr('searchCountryAbove', selectedLanguage)}</div>
              </div>
            </div>
          ) : (
            recents.map((c, idx) => {
              const isSelected = pickedCountry.toLowerCase() === c.toLowerCase();
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => selectCountry(c)}
                  className="row-tap"
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                    padding: '13px 16px',
                    background: isSelected ? 'rgba(46,91,255,0.06)' : 'none',
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                    borderBottom: idx < recents.length - 1 ? '1px solid #f1f5f9' : 'none',
                  }}
                >
                  <span className="bob" style={{ fontSize: 24, flexShrink: 0, animationDelay: `${(idx * 0.45) % 2.8}s` }}>
                    <span className="row-flag">{COUNTRY_FLAGS[c] ?? '🌍'}</span>
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#1a1a2e' }}>{c}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', marginTop: 1 }}>
                      {idx === 0 ? tr('mostRecentlySelected', selectedLanguage) : tr('recentlySelected', selectedLanguage)}
                    </div>
                  </div>
                  {isSelected
                    ? <span className="anim-pop" style={{ color: '#2E5BFF', fontWeight: 900, fontSize: 16, flexShrink: 0 }}>✓</span>
                    : <ChevronRight size={16} className="row-chev" style={{ color: '#d1d5db', flexShrink: 0 }} />}
                </button>
              );
            })
          )}
        </div>

        {/* ── Website Info Sections ── */}
        <div style={{ height: 1, background: 'rgba(0,0,0,0.07)', margin: '24px 0' }} />

        {/* Hero: The World's Marketplace */}
        <Reveal>
        <div style={{
          background: 'linear-gradient(135deg, #0a1a4a 0%, #0F2B6E 45%, #1a3a9e 100%)',
          borderRadius: 20, padding: '24px 18px 22px', marginBottom: 16,
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(46,91,255,0.2)', animation: 'float 5s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', top: 20, right: 50, width: 55, height: 55, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', animation: 'floatReverse 7s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', bottom: -40, left: -20, width: 130, height: 130, borderRadius: '50%', background: 'rgba(46,91,255,0.12)', animation: 'float 6s ease-in-out infinite' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.12)', borderRadius: 20, padding: '5px 13px', marginBottom: 16, border: '1px solid rgba(255,255,255,0.18)' }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ADE80', animation: 'pulse 2s ease-in-out infinite' }} />
              <span style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.9)', letterSpacing: '1.5px' }}>{tr('liveIn50', selectedLanguage).toUpperCase()}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', lineHeight: 1.15, marginBottom: 10 }}>
              {tr('worldsMarketplace', selectedLanguage)}
            </div>
            <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.72)', fontWeight: 500, lineHeight: 1.65, marginBottom: 20 }}>
              {tr('worldsMarketplaceDesc', selectedLanguage)}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { value: '50+', label: tr('countriesLabel', selectedLanguage) },
                { value: '17+', label: tr('categories', selectedLanguage) },
                { value: '100%', label: tr('freeLabel', selectedLanguage) },
                { value: '24/7', label: tr('availableLabel', selectedLanguage) },
              ].map((s, i) => (
                <Reveal key={s.label} delay={0.15 + i * 0.08} className="reveal-pop" style={{ flex: 1 }}>
                  <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '9px 4px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.14)' }}>
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginTop: 3 }}>{s.label}</div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
        </Reveal>

        {/* Auto-scrolling categories ticker */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#6B7A99', letterSpacing: '1.8px', textTransform: 'uppercase', marginBottom: 9, paddingLeft: 2 }}>{tr('allCategories', selectedLanguage)}</div>
          <div style={{ overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 28, background: 'linear-gradient(to right, #F0F4FF, transparent)', zIndex: 2, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 28, background: 'linear-gradient(to left, #F0F4FF, transparent)', zIndex: 2, pointerEvents: 'none' }} />
            <div className="ticker-row" style={{ display: 'flex', gap: 7, animation: 'scrollLeft 24s linear infinite', width: 'max-content' }}>
              {[...CATEGORIES, ...CATEGORIES].map((cat, i) => (
                <div
                  key={i}
                  onClick={() => router.push(`/categories?cat=${cat.id}`)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#fff', borderRadius: 20, padding: '6px 12px', border: '1px solid rgba(0,0,0,0.07)', flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', cursor: 'pointer' }}
                >
                  <span style={{ fontSize: 14 }}>{cat.emoji}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#1a1a2e', whiteSpace: 'nowrap' }}>{trCategory(cat.id, cat.name, selectedLanguage)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Global Reach — world regions grid */}
        <Reveal>
        <div style={{ marginBottom: 24, background: '#fff', borderRadius: 18, padding: '20px 16px', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(46,91,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, animation: 'glow 3s ease-in-out infinite' }}>
              <Globe size={20} color="#2E5BFF" />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#2E5BFF', letterSpacing: '1.5px', textTransform: 'uppercase' }}>{tr('globalReach', selectedLanguage)}</div>
              <div style={{ fontSize: 17, fontWeight: 900, color: '#1a1a2e', lineHeight: 1.2 }}>{tr('everyCountryRegion', selectedLanguage)}</div>
            </div>
          </div>
          <div style={{ fontSize: 13, color: '#6B7A99', fontWeight: 500, marginBottom: 16, lineHeight: 1.55 }}>
            {tr('globalReachDesc', selectedLanguage)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { flag: '🌍', region: tr('continentAfrica', selectedLanguage), count: `54 ${tr('countriesWord', selectedLanguage)}` },
              { flag: '🌍', region: tr('continentEurope', selectedLanguage), count: `44 ${tr('countriesWord', selectedLanguage)}` },
              { flag: '🌎', region: tr('continentAmerica', selectedLanguage), count: `35 ${tr('countriesWord', selectedLanguage)}` },
              { flag: '🌏', region: tr('continentAsiaPacific', selectedLanguage), count: `48 ${tr('countriesWord', selectedLanguage)}` },
              { flag: '🕌', region: tr('continentMiddleEast', selectedLanguage), count: `18 ${tr('countriesWord', selectedLanguage)}` },
              { flag: '🌊', region: tr('continentOceania', selectedLanguage), count: `14 ${tr('countriesWord', selectedLanguage)}` },
            ].map((r, i) => (
              <Reveal key={r.region} delay={i * 0.08}>
                <div className="lift" style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#F8FAFF', borderRadius: 12, padding: '10px 11px', border: '1px solid rgba(46,91,255,0.08)', height: '100%' }}>
                  <span className="bob" style={{ fontSize: 20, animationDelay: `${(i * 0.55) % 3}s` }}>
                    <span className="lift-emoji">{r.flag}</span>
                  </span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#1a1a2e' }}>{r.region}</div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af' }}>{r.count}</div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
        </Reveal>

        {/* How It Works */}
        <div style={{ marginBottom: 28 }}>
          <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#2E5BFF', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 6 }}>{tr('howItWorksLabel', selectedLanguage)}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#1a1a2e', lineHeight: 1.2 }}>{tr('howItWorksTitle', selectedLanguage)}</div>
            <div style={{ fontSize: 13, color: '#6B7A99', fontWeight: 500, marginTop: 6, lineHeight: 1.5 }}>{tr('howItWorksSubtitle', selectedLanguage)}</div>
          </div>
          </Reveal>
          {([
            { step: '01', Icon: Search, color: '#2E5BFF', bg: 'rgba(46,91,255,0.08)', title: tr('howStep1Title', selectedLanguage), desc: tr('howStep1Desc', selectedLanguage) },
            { step: '02', Icon: MessageCircle, color: '#6C63FF', bg: 'rgba(108,99,255,0.08)', title: tr('howStep2Title', selectedLanguage), desc: tr('howStep2Desc', selectedLanguage) },
            { step: '03', Icon: Handshake, color: '#10B981', bg: 'rgba(16,185,129,0.08)', title: tr('howStep3Title', selectedLanguage), desc: tr('howStep3Desc', selectedLanguage) },
          ] as const).map(({ step, Icon, color, bg, title, desc }, idx) => (
            <div key={step}>
              <Reveal delay={idx * 0.1}>
              <div className="lift" style={{ background: '#fff', borderRadius: 16, padding: '16px', marginBottom: 4, border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={20} color={color} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color, letterSpacing: '0.5px', marginBottom: 4 }}>{tr('stepWord', selectedLanguage).toUpperCase()} {step}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#1a1a2e', lineHeight: 1.3, marginBottom: 4 }}>{title}</div>
                  <div style={{ fontSize: 13, color: '#6B7A99', fontWeight: 500, lineHeight: 1.5 }}>{desc}</div>
                </div>
              </div>
              </Reveal>
              {idx < 2 && (
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
                  <div style={{ width: 2, height: 14, background: 'linear-gradient(to bottom, rgba(46,91,255,0.35), rgba(46,91,255,0.04))' }} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* All Services & Goods grid */}
        <div style={{ marginBottom: 28 }}>
          <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#2E5BFF', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 6 }}>{tr('everythingOnSyph', selectedLanguage)}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#1a1a2e', lineHeight: 1.2 }}>{tr('everyProductService', selectedLanguage)}</div>
            <div style={{ fontSize: 13, color: '#6B7A99', fontWeight: 500, marginTop: 6, lineHeight: 1.5 }}>{tr('everythingDesc', selectedLanguage)}</div>
          </div>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {CATEGORIES.map((cat, i) => (
              <Reveal key={cat.name} delay={(i % 9) * 0.06} className="reveal-pop">
                <div
                  className="lift"
                  onClick={() => router.push(`/categories?cat=${cat.id}`)}
                  style={{ background: '#fff', borderRadius: 14, padding: '14px 8px', textAlign: 'center', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', height: '100%', cursor: 'pointer' }}>
                  <div
                    className="bob"
                    style={{ fontSize: 28, marginBottom: 6, animationDelay: `${(i * 0.37) % 2.6}s`, animationDuration: `${2.8 + (i % 4) * 0.5}s` }}
                  >
                    <span className="lift-emoji">{cat.emoji}</span>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#1a1a2e', lineHeight: 1.3 }}>{trCategory(cat.id, cat.name, selectedLanguage)}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        {/* Why SYPH */}
        <div style={{ marginBottom: 24 }}>
          <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#2E5BFF', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 6 }}>{tr('whySyph', selectedLanguage)}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#1a1a2e', lineHeight: 1.2 }}>{tr('tagline', selectedLanguage)}</div>
            <div style={{ fontSize: 13, color: '#6B7A99', fontWeight: 500, marginTop: 6, lineHeight: 1.5 }}>{tr('taglineDesc', selectedLanguage)}</div>
          </div>
          </Reveal>
          {/* For Sellers */}
          <Reveal>
          <div style={{ background: '#fff', borderRadius: 18, padding: '20px 16px', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: 12 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#F0F4FF', borderRadius: 10, padding: '5px 12px', marginBottom: 14 }}>
              <span style={{ fontSize: 15 }}>🏪</span>
              <span style={{ fontWeight: 800, fontSize: 12, color: '#2E5BFF' }}>{tr('forSellers', selectedLanguage)}</span>
            </div>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#1a1a2e', marginBottom: 4, lineHeight: 1.3 }}>{tr('growGloballyTitle', selectedLanguage)}</div>
            <div style={{ fontSize: 13, color: '#6B7A99', fontWeight: 500, marginBottom: 16, lineHeight: 1.5 }}>{tr('growGloballySubtitle', selectedLanguage)}</div>
            {([
              { Icon: Globe, text: tr('sellerBullet1', selectedLanguage) },
              { Icon: Eye, text: tr('sellerBullet2', selectedLanguage) },
              { Icon: MapPin, text: tr('sellerBullet3', selectedLanguage) },
            ] as const).map(({ Icon, text }) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(46,91,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={15} color="#2E5BFF" />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#374151', lineHeight: 1.4 }}>{text}</span>
              </div>
            ))}
          </div>
          </Reveal>
          {/* For Buyers */}
          <Reveal delay={0.08}>
          <div style={{ background: 'linear-gradient(135deg, #0F2B6E 0%, #1E4DD9 100%)', borderRadius: 18, padding: '20px 16px', boxShadow: '0 4px 20px rgba(30,77,217,0.3)' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '5px 12px', marginBottom: 14 }}>
              <span style={{ fontSize: 15 }}>🛒</span>
              <span style={{ fontWeight: 800, fontSize: 12, color: '#fff' }}>{tr('forBuyers', selectedLanguage)}</span>
            </div>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#fff', marginBottom: 4, lineHeight: 1.3 }}>{tr('shopSmarterTitle', selectedLanguage)}</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 500, marginBottom: 16, lineHeight: 1.5 }}>{tr('shopSmarterSubtitle', selectedLanguage)}</div>
            {([
              { Icon: Navigation, text: tr('buyerBullet1', selectedLanguage) },
              { Icon: ShoppingCart, text: tr('buyerBullet2', selectedLanguage) },
              { Icon: BadgeDollarSign, text: tr('buyerBullet3', selectedLanguage) },
            ] as const).map(({ Icon, text }) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={15} color="#fff" />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)', lineHeight: 1.4 }}>{text}</span>
              </div>
            ))}
          </div>
          </Reveal>
        </div>

        {/* Global Broker manifesto */}
        <Reveal>
        <div style={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #0F2B6E 55%, #1a3a9e 100%)',
          borderRadius: 20, padding: '26px 18px', marginBottom: 16,
          textAlign: 'center', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, borderRadius: '50%', background: 'rgba(46,91,255,0.12)', animation: 'float 7s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', bottom: -30, left: -30, width: 130, height: 130, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 40, marginBottom: 10, display: 'inline-block', animation: 'float 4s ease-in-out infinite' }}>🌐</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', lineHeight: 1.2, marginBottom: 12 }}>
              {tr('yourGlobalBroker', selectedLanguage)}
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.72)', fontWeight: 500, lineHeight: 1.65, marginBottom: 20 }}>
              {tr('globalBrokerManifesto', selectedLanguage)}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center' }}>
              {CATEGORIES.slice(0, 10).map(cat => (
                <span key={cat.id} style={{ background: 'rgba(255,255,255,0.11)', color: 'rgba(255,255,255,0.88)', borderRadius: 20, padding: '5px 11px', fontSize: 11, fontWeight: 700, border: '1px solid rgba(255,255,255,0.18)' }}>{trCategory(cat.id, cat.name, selectedLanguage)}</span>
              ))}
            </div>
          </div>
        </div>
        </Reveal>

        {/* Trust pillars */}
        <div style={{ marginBottom: 24 }}>
          <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#1a1a2e' }}>{tr('builtOnTrust', selectedLanguage)}</div>
            <div style={{ fontSize: 13, color: '#6B7A99', marginTop: 4, fontWeight: 500 }}>{tr('trustSubtitle', selectedLanguage)}</div>
          </div>
          </Reveal>
          {([
            { Icon: Shield, color: '#2E5BFF', bg: 'rgba(46,91,255,0.08)', title: tr('trustVerifiedTitle', selectedLanguage), desc: tr('trustVerifiedDesc', selectedLanguage) },
            { Icon: Zap, color: '#F39C12', bg: 'rgba(243,156,18,0.1)', title: tr('trustInstantTitle', selectedLanguage), desc: tr('trustInstantDesc', selectedLanguage) },
            { Icon: CheckCircle, color: '#10B981', bg: 'rgba(16,185,129,0.08)', title: tr('trustFreeTitle', selectedLanguage), desc: tr('trustFreeDesc', selectedLanguage) },
          ] as const).map(({ Icon, color, bg, title, desc }, i) => (
            <Reveal key={title} delay={i * 0.1}>
            <div className="lift" style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 10, background: '#fff', borderRadius: 16, padding: '16px', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={20} color={color} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#1a1a2e', marginBottom: 4 }}>{title}</div>
                <div style={{ fontSize: 13, color: '#6B7A99', fontWeight: 500, lineHeight: 1.5 }}>{desc}</div>
              </div>
            </div>
            </Reveal>
          ))}
        </div>

        {/* Footer tagline */}
        <Reveal>
        <div style={{
          textAlign: 'center', padding: '22px 16px',
          background: 'linear-gradient(135deg, #0F2B6E 0%, #1E4DD9 100%)',
          borderRadius: 20, marginBottom: 16,
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
          <div style={{ position: 'absolute', bottom: -30, left: -30, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div className="bob" style={{ fontSize: 28, marginBottom: 8 }}>🌍</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#fff', marginBottom: 8, letterSpacing: '0.5px' }}>SYPH — {tr('tagline', selectedLanguage)}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 500, lineHeight: 1.6 }}>{tr('footerGlobalDesc', selectedLanguage)}</div>
          </div>
        </div>
        </Reveal>

        {/* Download badges */}
        <Reveal>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#6B7A99', letterSpacing: '1.5px', textTransform: 'uppercase', textAlign: 'center', marginBottom: 12 }}>{tr('availableOn', selectedLanguage)}</div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <Image src="/apple-badge.svg" alt="Download on the App Store" width={160} height={53} onClick={() => setShowAppModal(true)} className="btn-tap" style={{ height: 50, width: 'auto', borderRadius: 8, cursor: 'pointer' }} />
            <Image src="/google-play-badge.svg" alt="Get it on Google Play" width={160} height={53} onClick={() => setShowAppModal(true)} className="btn-tap" style={{ height: 50, width: 'auto', borderRadius: 8, cursor: 'pointer' }} />
          </div>
        </div>
        </Reveal>

      </div>

      {/* Sticky Continue button */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        background: 'rgba(240,244,255,0.96)', backdropFilter: 'blur(8px)',
        borderTop: '1px solid rgba(0,0,0,0.06)',
        padding: '12px 16px env(safe-area-inset-bottom, 16px)',
      }}>
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <button
            onClick={handleContinue}
            disabled={saving}
            className={saving ? undefined : pickedCountry ? 'btn-tap cta-armed' : 'btn-tap'}
            style={{
              width: '100%', height: 52, borderRadius: 26, border: 'none',
              background: saving ? '#9ca3af' : '#2E5BFF',
              color: '#fff', fontWeight: 800, fontSize: 16,
              cursor: saving ? 'default' : 'pointer',
            }}
          >
            {saving ? tr('loading', selectedLanguage) : tr('confirmLocation', selectedLanguage)}
          </button>
        </div>
      </div>
    </div>
  );
}
