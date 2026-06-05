'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, MapPin, Loader, Store, Clock, Globe,
  Phone, ChevronDown, Search, CheckCircle, X, FileText,
} from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getSellerProfile, createSellerProfile, updateSellerProfile } from '@/lib/firestore';
import { COUNTRIES, COUNTRY_FLAGS } from '@/data/countries';
import type { SellerProfile } from '@/types';
import toast from 'react-hot-toast';

const REGIONS = ['Central', 'Eastern', 'Northern', 'Western', 'Southern', 'Other'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function SellerSetupPage() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [description, setDescription] = useState('');
  const [isServiceProvider, setIsServiceProvider] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [address, setAddress] = useState('');
  const [open24Hours, setOpen24Hours] = useState(false);
  const [openingTime, setOpeningTime] = useState('08:00');
  const [closingTime, setClosingTime] = useState('18:00');
  const [workingDays, setWorkingDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [businessLat, setBusinessLat] = useState<number | null>(null);
  const [businessLng, setBusinessLng] = useState<number | null>(null);

  // Country modal state
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [countryQuery, setCountryQuery] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { setLoading(false); return; }
      setUid(u.uid);
      const sp = await getSellerProfile(u.uid);
      if (sp) {
        setIsEditing(true);
        setBusinessName(sp.businessName || '');
        setPhone(sp.businessPhone || '');
        setDescription(sp.bio || '');
        setSelectedCountry(sp.operatingCountry || '');
        setSelectedRegion(sp.operatingRegion || '');
        setAddress(sp.businessLocationText || '');
        const raw = sp as unknown as Record<string, unknown>;
        if (typeof raw.businessLatitude === 'number') setBusinessLat(raw.businessLatitude as number);
        if (typeof raw.businessLongitude === 'number') setBusinessLng(raw.businessLongitude as number);
        if (typeof raw.isServiceProvider === 'boolean') setIsServiceProvider(raw.isServiceProvider as boolean);
        if (raw.open24Hours === true) setOpen24Hours(true);
        if (typeof raw.openingTime === 'string' && raw.openingTime) setOpeningTime(raw.openingTime as string);
        if (typeof raw.closingTime === 'string' && raw.closingTime) setClosingTime(raw.closingTime as string);
        if (Array.isArray(raw.workingDays)) setWorkingDays(raw.workingDays as number[]);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const filteredCountries = countryQuery.trim()
    ? COUNTRIES.filter(c => c.toLowerCase().includes(countryQuery.toLowerCase()))
    : COUNTRIES;

  function toggleDay(dayIdx: number) {
    setWorkingDays(prev =>
      prev.includes(dayIdx) ? prev.filter(d => d !== dayIdx) : [...prev, dayIdx]
    );
  }

  async function detectLocation() {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported by your browser.');
      return;
    }
    setFetchingLocation(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 12000 })
      );
      const { latitude, longitude } = pos.coords;
      setBusinessLat(latitude);
      setBusinessLng(longitude);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
      );
      const data = await res.json();
      const parts = [
        data.address?.road,
        data.address?.suburb,
        data.address?.city || data.address?.town || data.address?.village,
        data.address?.state,
        data.address?.country,
      ].filter(Boolean);
      const resolved = parts.join(', ');
      setAddress(resolved || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
      if (!selectedCountry && data.address?.country) setSelectedCountry(data.address.country);
      toast.success('Location detected!');
    } catch {
      toast.error('Failed to detect location. Please try again.');
    } finally {
      setFetchingLocation(false);
    }
  }

  async function handleSave() {
    if (!uid) return;
    if (!businessName.trim()) { toast.error('Please enter your business name.'); return; }
    if (!phone.trim()) { toast.error('Please enter a contact number.'); return; }
    if (!selectedCountry) { toast.error('Please select your country.'); return; }
    if (!selectedRegion) { toast.error('Please select your region.'); return; }
    if (!description.trim()) { toast.error('Please enter a business description.'); return; }
    if (!open24Hours && (!openingTime || !closingTime)) {
      toast.error('Please set your opening and closing times.'); return;
    }
    if (businessLat === null || businessLng === null) {
      toast.error('Please set your business location using the GPS button.'); return;
    }

    setSaving(true);
    try {
      const profileData: Omit<SellerProfile, 'isVerified' | 'rating' | 'totalReviews'> = {
        uid,
        businessName: businessName.trim(),
        businessPhone: phone.trim(),
        operatingCountry: selectedCountry,
        operatingRegion: selectedRegion,
        businessLocationText: address.trim() || undefined,
        bio: description.trim(),
        mainCategoryIds: [],
        serviceSubcategoryIds: [],
      };
      const extraFields = {
        country: selectedCountry,
        region: selectedRegion,
        contactNumber: phone.trim(),
        description: description.trim(),
        isServiceProvider,
        open24Hours,
        openingTime: open24Hours ? null : openingTime,
        closingTime: open24Hours ? null : closingTime,
        workingDays,
        businessLocationAddress: address.trim() || null,
        businessLatitude: businessLat,
        businessLongitude: businessLng,
      };

      if (isEditing) {
        await updateSellerProfile(uid, { ...profileData, ...extraFields } as Parameters<typeof updateSellerProfile>[1]);
      } else {
        await createSellerProfile(profileData);
        await updateSellerProfile(uid, extraFields as Parameters<typeof updateSellerProfile>[1]);
      }

      toast.success('Seller profile saved!');
      router.push('/dashboard');
    } catch {
      toast.error('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  }

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
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <Store size={48} color="#2E5BFF" />
        <div style={{ fontWeight: 900, fontSize: 18, color: '#1E2B45', marginTop: 16 }}>Sign in to set up your seller profile</div>
        <button onClick={() => router.push('/login')} style={{ marginTop: 20, background: '#2E5BFF', color: '#fff', border: 'none', borderRadius: 14, padding: '12px 32px', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>Sign In</button>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 16px', border: '1.5px solid #E0E8F0',
    borderRadius: 14, fontSize: 15, outline: 'none', background: '#F8FAFF',
    boxSizing: 'border-box', fontFamily: 'inherit', color: '#1a1a2e',
  };
  const labelStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6,
    fontWeight: 800, fontSize: 13, color: '#4A5878', marginBottom: 8,
  };
  const sectionStyle: React.CSSProperties = {
    background: '#fff', borderRadius: 20, padding: 18, marginBottom: 14,
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.04)',
  };
  const cardSectionStyle: React.CSSProperties = {
    borderRadius: 20, padding: 20, marginBottom: 14,
    background: 'linear-gradient(135deg, rgba(30,77,217,0.04) 0%, rgba(74,122,255,0.02) 100%)',
    border: '1px solid #E0ECFF',
  };

  return (
    <div style={{ minHeight: '100dvh', background: '#F0F4FF', maxWidth: 480, margin: '0 auto' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Country Search Modal (bottom sheet) */}
      {showCountryModal && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
          onClick={() => { setShowCountryModal(false); setCountryQuery(''); }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: '20px 20px 0 0', maxHeight: '82dvh', display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
              <div style={{ width: 40, height: 4, borderRadius: 99, background: '#e2e8f0' }} />
            </div>
            <div style={{ padding: '6px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 900, fontSize: 16, color: '#1E2B45' }}>Select Country</div>
              <button onClick={() => { setShowCountryModal(false); setCountryQuery(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <X size={20} color="#6B7A99" />
              </button>
            </div>
            <div style={{ padding: '0 16px 10px', position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 28, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} />
              <input
                autoFocus
                value={countryQuery}
                onChange={e => setCountryQuery(e.target.value)}
                placeholder="Search country…"
                style={{ ...inputStyle, paddingLeft: 40, height: 44, fontSize: 14 }}
              />
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {filteredCountries.map((c, idx) => {
                const isSel = selectedCountry === c;
                return (
                  <button key={c} onClick={() => { setSelectedCountry(c); setShowCountryModal(false); setCountryQuery(''); }} style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                    padding: '13px 16px', background: isSel ? 'rgba(46,91,255,0.05)' : 'none',
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                    borderBottom: idx < filteredCountries.length - 1 ? '1px solid #f8faff' : 'none',
                  }}>
                    <span style={{ fontSize: 22, flexShrink: 0 }}>{COUNTRY_FLAGS[c] ?? '🌍'}</span>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: isSel ? 800 : 600, color: '#1a1a2e' }}>{c}</span>
                    {isSel && <CheckCircle size={18} color="#2E5BFF" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0F2B6E 0%, #1E4DD9 100%)', padding: '50px 16px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button onClick={() => router.back()} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, padding: 8, cursor: 'pointer', display: 'flex' }}>
            <ArrowLeft size={20} color="#fff" />
          </button>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 76, height: 76, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #1E4DD9 0%, #4A7AFF 100%)',
            borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(30,77,217,0.4)',
          }}>
            <Store size={38} color="#fff" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', marginBottom: 10 }}>Become a Seller</div>
          <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.72)', fontWeight: 500, lineHeight: 1.6, maxWidth: 300, margin: '0 auto' }}>
            Set up your seller profile to list products and services to buyers across 50+ countries — completely free.
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 16px 100px' }}>

        {/* Business Information */}
        <div style={sectionStyle}>
          <div style={{ fontWeight: 900, fontSize: 15, color: '#1E2B45', marginBottom: 18 }}>Business Information</div>

          <label style={labelStyle}><Store size={14} color="#2E5BFF" /> Business Name *</label>
          <input value={businessName} onChange={e => setBusinessName(e.target.value)}
            placeholder="e.g. Mama Sarah's Store" style={{ ...inputStyle, marginBottom: 16 }} />

          <label style={labelStyle}><Phone size={14} color="#2E5BFF" /> Contact Number *</label>
          <input value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="+256 700 000 000" type="tel" style={{ ...inputStyle, marginBottom: 16 }} />

          <label style={labelStyle}><Globe size={14} color="#2E5BFF" /> Country *</label>
          <button
            type="button"
            onClick={() => setShowCountryModal(true)}
            style={{
              ...inputStyle, marginBottom: 16, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 10, height: 50,
              color: selectedCountry ? '#1a1a2e' : '#9ca3af',
            }}
          >
            {selectedCountry ? (
              <>
                <span style={{ fontSize: 20 }}>{COUNTRY_FLAGS[selectedCountry] ?? '🌍'}</span>
                <span style={{ flex: 1, fontWeight: 700, fontSize: 15 }}>{selectedCountry}</span>
              </>
            ) : (
              <>
                <Globe size={16} color="#9ca3af" />
                <span style={{ flex: 1 }}>Select country…</span>
              </>
            )}
            <ChevronDown size={16} color="#9ca3af" />
          </button>

          <label style={labelStyle}>Region *</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {REGIONS.map(r => (
              <button key={r} onClick={() => setSelectedRegion(r)} style={{
                padding: '8px 16px', borderRadius: 20,
                border: `1.5px solid ${selectedRegion === r ? '#2E5BFF' : '#E0E8F0'}`,
                cursor: 'pointer',
                background: selectedRegion === r ? '#2E5BFF' : '#fff',
                color: selectedRegion === r ? '#fff' : '#4A5878',
                fontWeight: 700, fontSize: 13,
              }}>{r}</button>
            ))}
          </div>

          <label style={labelStyle}><FileText size={14} color="#2E5BFF" /> Business Description *</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Describe what you sell or the services you offer…" rows={3}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6, marginBottom: 16 }} />

          {/* Service provider toggle */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: '#F8FAFF', borderRadius: 14, padding: '13px 14px',
            border: '1px solid #E0E8F0',
          }}>
            <div>
              <div style={{ fontWeight: 800, color: '#1E2B45', fontSize: 14 }}>Service Provider?</div>
              <div style={{ color: '#6B7A99', fontSize: 12, marginTop: 2 }}>
                {isServiceProvider ? 'You offer services (not physical goods)' : 'You sell physical goods'}
              </div>
            </div>
            <label style={{ position: 'relative', width: 48, height: 28, cursor: 'pointer', flexShrink: 0 }}>
              <input type="checkbox" checked={isServiceProvider} onChange={() => setIsServiceProvider(!isServiceProvider)} style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} />
              <span style={{ position: 'absolute', inset: 0, borderRadius: 999, background: isServiceProvider ? '#2E5BFF' : '#DCE7F5', transition: '0.3s' }} />
              <span style={{ position: 'absolute', left: isServiceProvider ? 22 : 2, top: 2, width: 24, height: 24, borderRadius: '50%', background: '#fff', transition: '0.3s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
            </label>
          </div>
        </div>

        {/* Business Hours */}
        <div style={cardSectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(30,77,217,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Clock size={22} color="#1E4DD9" />
            </div>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#1E2B45' }}>Business Hours</div>
          </div>
          <div style={{ fontSize: 13, color: '#6B7A99', fontWeight: 500, marginBottom: 16, lineHeight: 1.55 }}>
            Let buyers know when you&apos;re available to respond and transact.
          </div>

          <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', border: '1px solid #E0ECFF' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}>
              <div>
                <div style={{ fontWeight: 800, color: '#1E2B45', fontSize: 14 }}>Open 24 Hours</div>
                <div style={{ color: '#6B7A99', fontSize: 12, marginTop: 2 }}>Always open, 7 days a week</div>
              </div>
              <label style={{ position: 'relative', width: 48, height: 28, cursor: 'pointer', flexShrink: 0 }}>
                <input type="checkbox" checked={open24Hours} onChange={() => setOpen24Hours(!open24Hours)} style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} />
                <span style={{ position: 'absolute', inset: 0, borderRadius: 999, background: open24Hours ? '#2E5BFF' : '#DCE7F5', transition: '0.3s' }} />
                <span style={{ position: 'absolute', left: open24Hours ? 22 : 2, top: 2, width: 24, height: 24, borderRadius: '50%', background: '#fff', transition: '0.3s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
              </label>
            </div>

            {!open24Hours && (
              <>
                <div style={{ height: 1, background: '#f1f5f9' }} />
                <div style={{ padding: '14px 16px', display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontWeight: 700, fontSize: 12, color: '#4A5878', marginBottom: 6 }}>Opening Time</label>
                    <input type="time" value={openingTime} onChange={e => setOpeningTime(e.target.value)}
                      style={{ ...inputStyle, fontSize: 14 }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontWeight: 700, fontSize: 12, color: '#4A5878', marginBottom: 6 }}>Closing Time</label>
                    <input type="time" value={closingTime} onChange={e => setClosingTime(e.target.value)}
                      style={{ ...inputStyle, fontSize: 14 }} />
                  </div>
                </div>
                <div style={{ height: 1, background: '#f1f5f9' }} />
                <div style={{ padding: '14px 16px' }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: '#4A5878', marginBottom: 10 }}>Working Days</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {DAY_LABELS.map((day, i) => (
                      <button key={i} onClick={() => toggleDay(i)} style={{
                        width: 42, height: 40, borderRadius: 12,
                        border: `1.5px solid ${workingDays.includes(i) ? '#2E5BFF' : '#CDD5E0'}`,
                        cursor: 'pointer',
                        background: workingDays.includes(i) ? '#2E5BFF' : 'transparent',
                        color: workingDays.includes(i) ? '#fff' : '#64748B',
                        fontWeight: 700, fontSize: 11,
                      }}>{day}</button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Business Location */}
        <div style={cardSectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(30,77,217,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <MapPin size={22} color="#1E4DD9" />
            </div>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#1E2B45' }}>Business Location</div>
          </div>
          <div style={{ fontSize: 13, color: '#6B7A99', fontWeight: 500, lineHeight: 1.55, marginBottom: 8 }}>
            Pin your exact location so buyers can find you in &apos;Near Me&apos; search results.
          </div>
          {businessLat === null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#EF4444', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#EF4444', fontWeight: 700 }}>Required to appear in Near Me results</span>
            </div>
          )}
          {businessLat !== null && <div style={{ marginBottom: 14 }} />}

          <button onClick={detectLocation} disabled={fetchingLocation || saving} style={{
            width: '100%', padding: '13px 0',
            background: businessLat !== null ? 'rgba(30,77,217,0.06)' : '#1E4DD9',
            border: businessLat !== null ? '1.5px solid #2E5BFF' : 'none',
            borderRadius: 14,
            color: businessLat !== null ? '#2E5BFF' : '#fff',
            fontWeight: 800, fontSize: 14,
            cursor: fetchingLocation || saving ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            {fetchingLocation
              ? <><Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Detecting…</>
              : businessLat !== null
                ? <><MapPin size={16} /> Update Business Location</>
                : <><MapPin size={16} /> Set Business Location</>
            }
          </button>

          {businessLat !== null && (
            <div style={{
              marginTop: 14, background: '#fff', borderRadius: 14, padding: '14px 16px',
              border: '1px solid #E0ECFF', display: 'flex', alignItems: 'flex-start', gap: 12,
            }}>
              <CheckCircle size={20} color="#2E5BFF" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: '#1E2B45', marginBottom: 4 }}>Location Saved</div>
                <div style={{ fontSize: 12, color: '#6B7A99', lineHeight: 1.5, wordBreak: 'break-word' }}>
                  {address || `${businessLat.toFixed(6)}, ${businessLng?.toFixed(6)}`}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Save button */}
        <button onClick={handleSave} disabled={saving} style={{
          width: '100%', padding: 16, background: saving ? '#A0B4E0' : '#1E4DD9',
          border: 'none', borderRadius: 18, color: '#fff', fontWeight: 900, fontSize: 16,
          cursor: saving ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          {saving ? (
            <>
              <div style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,0.4)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              Saving…
            </>
          ) : (
            isEditing ? 'Update Profile →' : 'Complete Setup →'
          )}
        </button>
      </div>
    </div>
  );
}
