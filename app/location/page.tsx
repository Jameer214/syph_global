'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Globe, X, ChevronDown, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAppStore } from '@/store';
import { auth, db } from '@/lib/firebase';
import { COUNTRIES, COUNTRY_FLAGS } from '@/data/countries';

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
            if (showErrors) toast.success(`Detected: ${country}`);
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
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0F2B6E 0%, #1E4DD9 100%)',
        padding: '20px 20px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: 'rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <MapPin size={22} color="#fff" />
          </div>
          <div>
            <div style={{ color: '#fff', fontWeight: 900, fontSize: 22, lineHeight: 1 }}>Where are you?</div>
            <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 13, marginTop: 4, fontWeight: 500 }}>
              Choose your country and region of interest
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 110px' }}>

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

        {/* GPS button */}
        <button
          onClick={() => detectGPS(true)}
          disabled={detectingGPS}
          style={{
            width: '100%', height: 46, borderRadius: 14,
            border: '1.5px solid #2E5BFF', background: 'transparent',
            color: '#2E5BFF', fontWeight: 700, fontSize: 14,
            cursor: detectingGPS ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 8, marginBottom: 20, opacity: detectingGPS ? 0.6 : 1,
          }}
        >
          <MapPin size={16} />
          {detectingGPS ? 'Detecting location…' : 'Use my current location'}
        </button>

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
