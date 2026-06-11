'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Globe, X, ChevronDown, ChevronRight, LayoutGrid, Menu, Search, SlidersHorizontal, Navigation, MessageCircle, Handshake, Eye, ShoppingCart, BadgeDollarSign, Shield, Zap, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '@/store';
import { tr, getDir } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { COUNTRIES, COUNTRY_FLAGS } from '@/data/countries';
import MenuDrawer from '@/components/MenuDrawer';

const REGIONS = ['Central', 'Eastern', 'Northern', 'Western', 'Southern'];

const CATEGORIES = [
  { emoji: '🏠', name: 'Real Estate' },
  { emoji: '🚗', name: 'Vehicles' },
  { emoji: '👗', name: 'Fashion' },
  { emoji: '📱', name: 'Electronics' },
  { emoji: '🍕', name: 'Food & Dining' },
  { emoji: '💼', name: 'Services' },
  { emoji: '💻', name: 'Technology' },
  { emoji: '🌿', name: 'Agriculture' },
  { emoji: '🏋️', name: 'Sports' },
  { emoji: '🎨', name: 'Art & Crafts' },
  { emoji: '💊', name: 'Health' },
  { emoji: '✈️', name: 'Travel' },
  { emoji: '🏗️', name: 'Construction' },
  { emoji: '🎵', name: 'Music & Media' },
  { emoji: '📚', name: 'Education' },
  { emoji: '🐾', name: 'Pets' },
  { emoji: '🎮', name: 'Gaming' },
  { emoji: '💰', name: 'Finance' },
];

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
  const { setLocationSet, setRegion, selectedCountry: storedCountry, selectedLanguage } = useAppStore();

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
      if (showErrors) toast.error('Geolocation not supported by this browser.');
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
          } else if (showErrors) {
            toast.error('Could not determine your country. Please select manually.');
          }
        } catch {
          if (showErrors) toast.error('Failed to get location. Please select manually.');
        } finally {
          setDetectingGPS(false);
        }
      },
      () => {
        setDetectingGPS(false);
        if (showErrors) toast.error('Location access denied. Please select manually.');
      },
      { timeout: 10000 }
    );
  };

  const handleContinue = async () => {
    if (!pickedCountry.trim()) {
      toast.error('Please select a country or use GPS.');
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
      toast.error('Failed to save. Please try again.');
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
            <div style={{ fontSize: 22, fontWeight: 900, color: '#0F2B6E', marginBottom: 10 }}>Releasing Soon!</div>
            <div style={{ fontSize: 14, color: '#6B7A99', fontWeight: 500, lineHeight: 1.65, marginBottom: 22 }}>
              Welcome to SYPH! The mobile app is on its way — packed with everything you love on the website plus real-time notifications, in-app payments, sponsored listings, flash sales, and more.
            </div>
            <div style={{ background: 'linear-gradient(135deg, #F0F4FF 0%, #E8EEFF 100%)', borderRadius: 14, padding: '14px 16px', marginBottom: 22, border: '1px solid #D7E5FF' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#2E5BFF', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 4 }}>Stay tuned</div>
              <div style={{ fontSize: 13, color: '#4A5878', fontWeight: 500, lineHeight: 1.5 }}>
                We&apos;ll notify you the moment SYPH hits the App Store and Google Play. The global marketplace is coming to your pocket.
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
              Got it!
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
              FIND IT. LOCATE IT. CONNECT.
            </p>
            <p style={{ margin: '2px 0 0', color: '#fff', fontSize: 20, fontWeight: 900, letterSpacing: '1px' }}>SYPH</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link href="/categories" style={{
              background: '#F39C12', borderRadius: 10, padding: '7px 12px',
              display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none',
            }}>
              <LayoutGrid size={16} color="#fff" />
              <span style={{ color: '#fff', fontWeight: 800, fontSize: 12 }}>Category</span>
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
                GPS DETECTED
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
              placeholder="Search goods & services…"
              className="input-anim-dark"
              style={{
                width: '100%', height: 46, borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.10)',
                background: '#1A1A1A', paddingLeft: 44, paddingRight: 14,
                fontSize: 14, fontWeight: 600, color: '#fff', outline: 'none',
                boxSizing: 'border-box',
              }}
            />
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
            <div style={{ color: '#1a1a2e', fontWeight: 900, fontSize: 18, lineHeight: 1 }}>Where are you?</div>
            <div style={{ color: '#6B7A99', fontSize: 12.5, marginTop: 3, fontWeight: 500 }}>
              Choose your country and region of interest
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
                  {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
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
                    <span className="row-flag" style={{ fontSize: 22, flexShrink: 0 }}>{COUNTRY_FLAGS[c] ?? '🌍'}</span>
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
          {tr('allCountries', selectedLanguage)}
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
                <div style={{ fontWeight: 900, fontSize: 14, color: '#1a1a2e' }}>No recent countries yet</div>
                <div style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600, marginTop: 2 }}>Search for a country above</div>
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
                  <span className="row-flag" style={{ fontSize: 24, flexShrink: 0 }}>{COUNTRY_FLAGS[c] ?? '🌍'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#1a1a2e' }}>{c}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', marginTop: 1 }}>
                      {idx === 0 ? 'Most recently selected' : 'Recently selected'}
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
        <div style={{
          background: 'linear-gradient(135deg, #0a1a4a 0%, #0F2B6E 45%, #1a3a9e 100%)',
          borderRadius: 20, padding: '24px 18px 22px', marginBottom: 16,
          position: 'relative', overflow: 'hidden',
          animation: 'fadeInUp 0.5s ease forwards',
        }}>
          <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(46,91,255,0.2)', animation: 'float 5s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', top: 20, right: 50, width: 55, height: 55, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', animation: 'floatReverse 7s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', bottom: -40, left: -20, width: 130, height: 130, borderRadius: '50%', background: 'rgba(46,91,255,0.12)', animation: 'float 6s ease-in-out infinite' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.12)', borderRadius: 20, padding: '5px 13px', marginBottom: 16, border: '1px solid rgba(255,255,255,0.18)' }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ADE80', animation: 'pulse 2s ease-in-out infinite' }} />
              <span style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.9)', letterSpacing: '1.5px' }}>LIVE IN 50+ COUNTRIES</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', lineHeight: 1.15, marginBottom: 10 }}>
              The World&apos;s<br />Marketplace
            </div>
            <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.72)', fontWeight: 500, lineHeight: 1.65, marginBottom: 20 }}>
              SYPH is a global broker connecting buyers and sellers across 50+ countries — for every service, every product, every region. No fees. No limits.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { value: '50+', label: 'Countries' },
                { value: '17+', label: 'Categories' },
                { value: '100%', label: 'Free' },
                { value: '24/7', label: 'Available' },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '9px 4px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.14)' }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginTop: 3 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Auto-scrolling categories ticker */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#6B7A99', letterSpacing: '1.8px', textTransform: 'uppercase', marginBottom: 9, paddingLeft: 2 }}>All Categories</div>
          <div style={{ overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 28, background: 'linear-gradient(to right, #F0F4FF, transparent)', zIndex: 2, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 28, background: 'linear-gradient(to left, #F0F4FF, transparent)', zIndex: 2, pointerEvents: 'none' }} />
            <div className="ticker-row" style={{ display: 'flex', gap: 7, animation: 'scrollLeft 24s linear infinite', width: 'max-content' }}>
              {[...CATEGORIES, ...CATEGORIES].map((cat, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#fff', borderRadius: 20, padding: '6px 12px', border: '1px solid rgba(0,0,0,0.07)', flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                  <span style={{ fontSize: 14 }}>{cat.emoji}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#1a1a2e', whiteSpace: 'nowrap' }}>{cat.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Global Reach — world regions grid */}
        <div style={{ marginBottom: 24, background: '#fff', borderRadius: 18, padding: '20px 16px', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(46,91,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, animation: 'glow 3s ease-in-out infinite' }}>
              <Globe size={20} color="#2E5BFF" />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#2E5BFF', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Global Reach</div>
              <div style={{ fontSize: 17, fontWeight: 900, color: '#1a1a2e', lineHeight: 1.2 }}>Every Country. Every Region.</div>
            </div>
          </div>
          <div style={{ fontSize: 13, color: '#6B7A99', fontWeight: 500, marginBottom: 16, lineHeight: 1.55 }}>
            SYPH operates across all major world regions — wherever you are, we have you covered.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { flag: '🌍', region: 'Africa', count: '54 countries' },
              { flag: '🌍', region: 'Europe', count: '44 countries' },
              { flag: '🌎', region: 'Americas', count: '35 countries' },
              { flag: '🌏', region: 'Asia Pacific', count: '48 countries' },
              { flag: '🕌', region: 'Middle East', count: '18 countries' },
              { flag: '🌊', region: 'Oceania', count: '14 countries' },
            ].map(r => (
              <div key={r.region} className="lift" style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#F8FAFF', borderRadius: 12, padding: '10px 11px', border: '1px solid rgba(46,91,255,0.08)' }}>
                <span className="lift-emoji" style={{ fontSize: 20 }}>{r.flag}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#1a1a2e' }}>{r.region}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af' }}>{r.count}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* How It Works */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#2E5BFF', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 6 }}>How It Works</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#1a1a2e', lineHeight: 1.2 }}>Simple. Powerful. Global.</div>
            <div style={{ fontSize: 13, color: '#6B7A99', fontWeight: 500, marginTop: 6, lineHeight: 1.5 }}>From discovery to deal — SYPH makes every step effortless.</div>
          </div>
          {([
            { step: '01', Icon: Search, color: '#2E5BFF', bg: 'rgba(46,91,255,0.08)', title: 'Get location specific results', desc: "Browse listings filtered to your exact country or region — see only what's available near you." },
            { step: '02', Icon: MessageCircle, color: '#6C63FF', bg: 'rgba(108,99,255,0.08)', title: 'Contact your service provider', desc: 'Message sellers directly through the platform. Ask questions and build trust before you commit.' },
            { step: '03', Icon: Handshake, color: '#10B981', bg: 'rgba(16,185,129,0.08)', title: 'Negotiate to a successful deal', desc: "Close the deal on your own terms — negotiate price, arrange pickup or delivery, and buy with confidence." },
          ] as const).map(({ step, Icon, color, bg, title, desc }, idx) => (
            <div key={step}>
              <div className="lift" style={{ background: '#fff', borderRadius: 16, padding: '16px', marginBottom: 4, border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={20} color={color} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color, letterSpacing: '0.5px', marginBottom: 4 }}>STEP {step}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#1a1a2e', lineHeight: 1.3, marginBottom: 4 }}>{title}</div>
                  <div style={{ fontSize: 13, color: '#6B7A99', fontWeight: 500, lineHeight: 1.5 }}>{desc}</div>
                </div>
              </div>
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
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#2E5BFF', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 6 }}>Everything on SYPH</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#1a1a2e', lineHeight: 1.2 }}>Every Product. Every Service.</div>
            <div style={{ fontSize: 13, color: '#6B7A99', fontWeight: 500, marginTop: 6, lineHeight: 1.5 }}>From everyday essentials to rare finds — if it exists, you&apos;ll find it on SYPH.</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {CATEGORIES.map(cat => (
              <div key={cat.name} className="lift" style={{ background: '#fff', borderRadius: 14, padding: '14px 8px', textAlign: 'center', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div className="lift-emoji" style={{ fontSize: 28, marginBottom: 6 }}>{cat.emoji}</div>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#1a1a2e', lineHeight: 1.3 }}>{cat.name}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Why SYPH */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#2E5BFF', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 6 }}>Why SYPH</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#1a1a2e', lineHeight: 1.2 }}>Find it. Locate it. Connect.</div>
            <div style={{ fontSize: 13, color: '#6B7A99', fontWeight: 500, marginTop: 6, lineHeight: 1.5 }}>Discover products, services, and happenings near you.</div>
          </div>
          {/* For Sellers */}
          <div style={{ background: '#fff', borderRadius: 18, padding: '20px 16px', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: 12 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#F0F4FF', borderRadius: 10, padding: '5px 12px', marginBottom: 14 }}>
              <span style={{ fontSize: 15 }}>🏪</span>
              <span style={{ fontWeight: 800, fontSize: 12, color: '#2E5BFF' }}>For Sellers</span>
            </div>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#1a1a2e', marginBottom: 4, lineHeight: 1.3 }}>Grow Globally. Sell Locally.</div>
            <div style={{ fontSize: 13, color: '#6B7A99', fontWeight: 500, marginBottom: 16, lineHeight: 1.5 }}>Reach buyers across 50+ countries with zero listing fees.</div>
            {([
              { Icon: Globe, text: 'List products visible across 50+ countries' },
              { Icon: Eye, text: 'Get maximum visibility with zero listing fees' },
              { Icon: MapPin, text: 'Location-targeted reach to the right buyers' },
            ] as const).map(({ Icon, text }) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(46,91,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={15} color="#2E5BFF" />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#374151', lineHeight: 1.4 }}>{text}</span>
              </div>
            ))}
          </div>
          {/* For Buyers */}
          <div style={{ background: 'linear-gradient(135deg, #0F2B6E 0%, #1E4DD9 100%)', borderRadius: 18, padding: '20px 16px', boxShadow: '0 4px 20px rgba(30,77,217,0.3)' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '5px 12px', marginBottom: 14 }}>
              <span style={{ fontSize: 15 }}>🛒</span>
              <span style={{ fontWeight: 800, fontSize: 12, color: '#fff' }}>For Buyers</span>
            </div>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#fff', marginBottom: 4, lineHeight: 1.3 }}>Shop Smarter. Buy Confidently.</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 500, marginBottom: 16, lineHeight: 1.5 }}>Browse location-filtered listings and connect directly with sellers.</div>
            {([
              { Icon: Navigation, text: "Find exactly what's available near you" },
              { Icon: ShoppingCart, text: 'Buy direct from sellers with no middleman fees' },
              { Icon: BadgeDollarSign, text: 'Negotiate prices and get the best deals' },
            ] as const).map(({ Icon, text }) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={15} color="#fff" />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)', lineHeight: 1.4 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Global Broker manifesto */}
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
              Your Global Broker.<br />For Everything.
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.72)', fontWeight: 500, lineHeight: 1.65, marginBottom: 20 }}>
              Whether you&apos;re buying or selling goods, offering services, or searching for something specific — SYPH is your all-in-one global brokerage platform, available in every country, across every category, completely free.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center' }}>
              {['Real Estate', 'Vehicles', 'Fashion', 'Electronics', 'Services', 'Agriculture', 'Technology', 'Food & Dining', 'Health', 'Education'].map(cat => (
                <span key={cat} style={{ background: 'rgba(255,255,255,0.11)', color: 'rgba(255,255,255,0.88)', borderRadius: 20, padding: '5px 11px', fontSize: 11, fontWeight: 700, border: '1px solid rgba(255,255,255,0.18)' }}>{cat}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Trust pillars */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#1a1a2e' }}>Built on Trust</div>
            <div style={{ fontSize: 13, color: '#6B7A99', marginTop: 4, fontWeight: 500 }}>Your security and satisfaction are our priority</div>
          </div>
          {([
            { Icon: Shield, color: '#2E5BFF', bg: 'rgba(46,91,255,0.08)', title: 'Verified Listings', desc: 'Every listing is reviewed for quality and authenticity before going live on the platform.' },
            { Icon: Zap, color: '#F39C12', bg: 'rgba(243,156,18,0.1)', title: 'Instant Connections', desc: 'Connect with sellers and buyers in real-time through our built-in messaging platform.' },
            { Icon: CheckCircle, color: '#10B981', bg: 'rgba(16,185,129,0.08)', title: 'Free Forever', desc: 'No listing fees. No commissions. No hidden charges. SYPH is completely free to use.' },
          ] as const).map(({ Icon, color, bg, title, desc }) => (
            <div key={title} className="lift" style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 10, background: '#fff', borderRadius: 16, padding: '16px', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={20} color={color} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#1a1a2e', marginBottom: 4 }}>{title}</div>
                <div style={{ fontSize: 13, color: '#6B7A99', fontWeight: 500, lineHeight: 1.5 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer tagline */}
        <div style={{
          textAlign: 'center', padding: '22px 16px',
          background: 'linear-gradient(135deg, #0F2B6E 0%, #1E4DD9 100%)',
          borderRadius: 20, marginBottom: 16,
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
          <div style={{ position: 'absolute', bottom: -30, left: -30, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🌍</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#fff', marginBottom: 8, letterSpacing: '0.5px' }}>SYPH — Find it. Locate it. Connect.</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 500, lineHeight: 1.6 }}>The global marketplace for every service, every product, and every region — connecting buyers and sellers worldwide, for free.</div>
          </div>
        </div>

        {/* Download badges */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#6B7A99', letterSpacing: '1.5px', textTransform: 'uppercase', textAlign: 'center', marginBottom: 12 }}>Available on</div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <Image src="/apple-badge.svg" alt="Download on the App Store" width={160} height={53} onClick={() => setShowAppModal(true)} className="btn-tap" style={{ height: 50, width: 'auto', borderRadius: 8, cursor: 'pointer' }} />
            <Image src="/google-play-badge.svg" alt="Get it on Google Play" width={160} height={53} onClick={() => setShowAppModal(true)} className="btn-tap" style={{ height: 50, width: 'auto', borderRadius: 8, cursor: 'pointer' }} />
          </div>
        </div>

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
