'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MapPin, Globe, X, ChevronDown, ChevronRight, LayoutGrid, Menu, Search, SlidersHorizontal, Navigation, MessageCircle, Handshake, Eye, ShoppingCart, BadgeDollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAppStore } from '@/store';
import { auth, db } from '@/lib/firebase';
import { COUNTRIES, COUNTRY_FLAGS } from '@/data/countries';
import MenuDrawer from '@/components/MenuDrawer';

const REGIONS = ['Central', 'Eastern', 'Northern', 'Western', 'Southern'];
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
  const { setLocationSet, setRegion, selectedCountry: storedCountry } = useAppStore();

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

      const currentUser = auth.currentUser;
      if (currentUser) {
        await setDoc(
          doc(db, 'users', currentUser.uid),
          {
            selectedCountry: pickedCountry,
            selectedRegion: pickedRegion || null,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      router.replace('/home');
    } catch {
      toast.error('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ minHeight: '100dvh', background: '#F0F4FF', display: 'flex', flexDirection: 'column' }}>
      <MenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />

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
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14,
            background: 'linear-gradient(135deg, #1E4DD9 0%, #2E5BFF 100%)',
            borderRadius: 16, padding: '13px 16px',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
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
            <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 22 }}>✓</span>
          </div>
        ) : (
          /* White card: detect home country prompt */
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14,
            background: '#fff', borderRadius: 16, padding: '13px 16px',
            border: '1px solid rgba(0,0,0,0.08)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          }}>
            <Navigation size={20} color="#2E5BFF" style={{ flexShrink: 0 }} />
            <p style={{ flex: 1, margin: 0, fontWeight: 800, fontSize: 14, color: '#1a1a2e' }}>
              Detect home country
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
                Detect
              </button>
            )}
          </div>
        )}

        {/* spin keyframe */}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

        {/* Dark goods search bar — matches Flutter's dark search bar */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
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
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          marginBottom: 12,
        }}>
          <div style={{
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
          style={{
            background: '#fff', borderRadius: 18,
            boxShadow: '0 3px 12px rgba(0,0,0,0.08)',
            border: '1px solid rgba(0,0,0,0.06)',
            overflow: 'hidden', marginBottom: 12,
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
                  placeholder="Search country of interest…"
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
                <span style={{ color: '#9ca3af', fontWeight: 700, fontSize: 11 }}>Region (optional)</span>
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
                  style={{
                    width: '100%', height: 44, borderRadius: 12,
                    border: '1px solid rgba(0,0,0,0.10)', background: '#f8faff',
                    paddingLeft: 40, paddingRight: 36, fontSize: 14, fontWeight: 600,
                    color: pickedRegion ? '#1a1a2e' : '#9ca3af',
                    outline: 'none', appearance: 'none', cursor: 'pointer',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="">All Regions</option>
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
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                      padding: '11px 16px',
                      background: isSelected ? 'rgba(46,91,255,0.06)' : 'none',
                      border: 'none', cursor: 'pointer', textAlign: 'left',
                      borderBottom: idx < filteredCountries.length - 1 ? '1px solid #f1f5f9' : 'none',
                    }}
                  >
                    <span style={{ fontSize: 22, flexShrink: 0 }}>{COUNTRY_FLAGS[c] ?? '🌍'}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', flex: 1 }}>{c}</span>
                    {isSelected
                      ? <span style={{ color: '#2E5BFF', fontWeight: 900, fontSize: 16 }}>✓</span>
                      : <ChevronRight size={16} style={{ color: '#d1d5db', flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Countries */}
        <div style={{ fontSize: 11, fontWeight: 800, color: '#6B7A99', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8, paddingLeft: 2 }}>
          Recent Countries
        </div>
        <div style={{
          background: '#fff', borderRadius: 16, overflow: 'hidden',
          border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
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
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                    padding: '13px 16px',
                    background: isSelected ? 'rgba(46,91,255,0.06)' : 'none',
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                    borderBottom: idx < recents.length - 1 ? '1px solid #f1f5f9' : 'none',
                  }}
                >
                  <span style={{ fontSize: 24, flexShrink: 0 }}>{COUNTRY_FLAGS[c] ?? '🌍'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#1a1a2e' }}>{c}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', marginTop: 1 }}>
                      {idx === 0 ? 'Most recently selected' : 'Recently selected'}
                    </div>
                  </div>
                  {isSelected
                    ? <span style={{ color: '#2E5BFF', fontWeight: 900, fontSize: 16, flexShrink: 0 }}>✓</span>
                    : <ChevronRight size={16} style={{ color: '#d1d5db', flexShrink: 0 }} />}
                </button>
              );
            })
          )}
        </div>

        {/* ── Website Info Sections ── */}
        <div style={{ height: 1, background: 'rgba(0,0,0,0.07)', margin: '24px 0' }} />

        {/* Hero stats strip */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
          {[
            { value: '17+', label: 'Categories' },
            { value: '50+', label: 'Countries' },
            { value: '100%', label: 'Free Trial' },
          ].map(stat => (
            <div key={stat.label} style={{
              flex: 1, background: '#fff', borderRadius: 14,
              padding: '14px 8px', textAlign: 'center',
              border: '1px solid rgba(0,0,0,0.06)',
              boxShadow: '0 2px 8px rgba(46,91,255,0.08)',
            }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#2E5BFF', lineHeight: 1 }}>{stat.value}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7A99', marginTop: 4, letterSpacing: '0.3px' }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* How It Works */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#2E5BFF', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 6 }}>How It Works</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#1a1a2e', lineHeight: 1.2 }}>Simple. Powerful. Global.</div>
            <div style={{ fontSize: 13, color: '#6B7A99', fontWeight: 500, marginTop: 6, lineHeight: 1.5 }}>From discovery to deal — SYPH makes every step effortless.</div>
          </div>
          {([
            {
              step: '01', Icon: Search, color: '#2E5BFF', bg: 'rgba(46,91,255,0.08)',
              title: 'Get location specific results',
              desc: "Browse listings filtered to your exact country or region — see only what's available near you.",
            },
            {
              step: '02', Icon: MessageCircle, color: '#6C63FF', bg: 'rgba(108,99,255,0.08)',
              title: 'Contact your service provider',
              desc: 'Message sellers directly through the platform. Ask questions and build trust before you commit.',
            },
            {
              step: '03', Icon: Handshake, color: '#10B981', bg: 'rgba(16,185,129,0.08)',
              title: 'Negotiate to a successful deal',
              desc: "Close the deal on your own terms — negotiate price, arrange pickup or delivery, and buy with confidence.",
            },
          ] as const).map(({ step, Icon, color, bg, title, desc }) => (
            <div key={step} style={{
              background: '#fff', borderRadius: 16, padding: '16px',
              marginBottom: 10, border: '1px solid rgba(0,0,0,0.06)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              display: 'flex', alignItems: 'flex-start', gap: 14,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 14, background: bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon size={20} color={color} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color, letterSpacing: '0.5px', marginBottom: 4 }}>STEP {step}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#1a1a2e', lineHeight: 1.3, marginBottom: 4 }}>{title}</div>
                <div style={{ fontSize: 13, color: '#6B7A99', fontWeight: 500, lineHeight: 1.5 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Why SYPH */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#2E5BFF', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 6 }}>Why SYPH</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#1a1a2e', lineHeight: 1.2 }}>Find it. Locate it. Connect.</div>
            <div style={{ fontSize: 13, color: '#6B7A99', fontWeight: 500, marginTop: 6, lineHeight: 1.5 }}>Discover products, services, and happenings near you.</div>
          </div>

          {/* For Sellers */}
          <div style={{
            background: '#fff', borderRadius: 18, padding: '20px 16px',
            border: '1px solid rgba(0,0,0,0.06)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
            marginBottom: 12,
          }}>
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
          <div style={{
            background: 'linear-gradient(135deg, #0F2B6E 0%, #1E4DD9 100%)',
            borderRadius: 18, padding: '20px 16px',
            boxShadow: '0 4px 20px rgba(30,77,217,0.3)',
          }}>
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
            style={{
              width: '100%', height: 52, borderRadius: 26, border: 'none',
              background: saving ? '#9ca3af' : '#2E5BFF',
              color: '#fff', fontWeight: 800, fontSize: 16,
              cursor: saving ? 'default' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
