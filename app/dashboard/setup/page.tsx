'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MapPin, Loader } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getSellerProfile, createSellerProfile, updateSellerProfile } from '@/lib/firestore';
import type { SellerProfile } from '@/types';
import toast from 'react-hot-toast';

const REGIONS = ['Central', 'Eastern', 'Northern', 'Western', 'Southern', 'Other'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const COUNTRIES = [
  'Uganda', 'Kenya', 'Tanzania', 'Rwanda', 'Burundi', 'Ethiopia', 'South Sudan',
  'DRC', 'Nigeria', 'Ghana', 'South Africa', 'Zimbabwe', 'Zambia', 'Malawi',
  'Mozambique', 'Angola', 'Cameroon', 'Senegal', 'Ivory Coast', 'Other',
];

export default function SellerSetupPage() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Form fields
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
  const [workingDays, setWorkingDays] = useState<number[]>([0, 1, 2, 3, 4]); // Mon-Fri default
  const [fetchingLocation, setFetchingLocation] = useState(false);

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
        // read back extra fields from raw data if available
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  function toggleDay(dayIdx: number) {
    setWorkingDays((prev) =>
      prev.includes(dayIdx) ? prev.filter((d) => d !== dayIdx) : [...prev, dayIdx]
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
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true })
      );
      const { latitude, longitude } = pos.coords;
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
      const resolvedAddress = parts.join(', ');
      setAddress(resolvedAddress || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
      // auto-fill country if empty
      if (!selectedCountry && data.address?.country) {
        setSelectedCountry(data.address.country);
      }
      toast.success('Location detected!');
    } catch (e) {
      toast.error('Failed to detect location. Please enter manually.');
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

      if (isEditing) {
        await updateSellerProfile(uid, {
          ...profileData,
          // Also write Flutter-compatible field names
          // @ts-expect-error extra fields for Flutter compat
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
        });
      } else {
        await createSellerProfile(profileData);
        // write extra fields
        await updateSellerProfile(uid, {
          // @ts-expect-error extra fields for Flutter compat
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
        });
      }

      toast.success('Seller profile saved!');
      router.push('/dashboard');
    } catch (e) {
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
        <div style={{ fontWeight: 900, fontSize: 18, color: '#1E2B45' }}>Sign in to set up your seller profile</div>
        <button onClick={() => router.push('/login')} style={{ marginTop: 20, background: '#2E5BFF', color: '#fff', border: 'none', borderRadius: 14, padding: '12px 32px', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>Sign In</button>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 16px', border: '1.5px solid #E0E8F0',
    borderRadius: 14, fontSize: 15, outline: 'none', background: '#F8FAFF',
    boxSizing: 'border-box', fontFamily: 'inherit',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontWeight: 800, fontSize: 13, color: '#4A5878', marginBottom: 6,
  };
  const sectionStyle: React.CSSProperties = {
    background: '#fff', borderRadius: 20, padding: 18, marginBottom: 14,
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  };

  return (
    <div style={{ minHeight: '100dvh', background: '#F0F4FF', maxWidth: 480, margin: '0 auto' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0F2B6E 0%, #1E4DD9 100%)',
        padding: '52px 16px 24px', display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button onClick={() => router.back()} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, padding: 8, cursor: 'pointer', display: 'flex' }}>
          <ArrowLeft size={20} color="#fff" />
        </button>
        <div>
          <div style={{ color: '#fff', fontWeight: 900, fontSize: 20 }}>Seller Setup</div>
          <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 3 }}>
            {isEditing ? 'Update your seller profile' : 'Set up your seller profile to start listing'}
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 16px 100px' }}>

        {/* Business Information */}
        <div style={sectionStyle}>
          <div style={{ fontWeight: 900, fontSize: 15, color: '#1E2B45', marginBottom: 16 }}>Business Information</div>

          <label style={labelStyle}>Business Name *</label>
          <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Your business name"
            style={inputStyle} />

          <label style={{ ...labelStyle, marginTop: 14 }}>Phone Number *</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+256 700 000 000"
            type="tel" style={inputStyle} />

          <label style={{ ...labelStyle, marginTop: 14 }}>Description *</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your business or services..." rows={4}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />

          {/* Service provider toggle */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 0', borderTop: '1px solid #F0F4FF', marginTop: 14,
          }}>
            <div>
              <div style={{ fontWeight: 800, color: '#1E2B45', fontSize: 14 }}>Service Provider?</div>
              <div style={{ color: '#6B7A99', fontSize: 12, marginTop: 2 }}>
                {isServiceProvider ? 'You offer services (not physical goods)' : 'You sell physical goods'}
              </div>
            </div>
            <label style={{ position: 'relative', width: 48, height: 28, cursor: 'pointer' }}>
              <input type="checkbox" checked={isServiceProvider} onChange={() => setIsServiceProvider(!isServiceProvider)} style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} />
              <span style={{ position: 'absolute', inset: 0, borderRadius: 999, background: isServiceProvider ? '#2E5BFF' : '#DCE7F5', transition: '0.3s' }} />
              <span style={{ position: 'absolute', left: isServiceProvider ? 22 : 2, top: 2, width: 24, height: 24, borderRadius: '50%', background: '#fff', transition: '0.3s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
            </label>
          </div>
        </div>

        {/* Location */}
        <div style={sectionStyle}>
          <div style={{ fontWeight: 900, fontSize: 15, color: '#1E2B45', marginBottom: 16 }}>Location</div>

          <label style={labelStyle}>Country *</label>
          <select value={selectedCountry} onChange={(e) => setSelectedCountry(e.target.value)}
            style={{ ...inputStyle, appearance: 'none' }}>
            <option value="">Select country...</option>
            {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <label style={{ ...labelStyle, marginTop: 14 }}>Region *</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {REGIONS.map((r) => (
              <button key={r} onClick={() => setSelectedRegion(r)} style={{
                padding: '8px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
                background: selectedRegion === r ? '#2E5BFF' : '#F0F4FF',
                color: selectedRegion === r ? '#fff' : '#4A5878',
                fontWeight: 700, fontSize: 13,
              }}>{r}</button>
            ))}
          </div>

          <label style={{ ...labelStyle, marginTop: 14 }}>Business Address</label>
          <div style={{ position: 'relative' }}>
            <MapPin size={16} color="#6B7A99" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, area, city..."
              style={{ ...inputStyle, paddingLeft: 40 }} />
          </div>

          <button onClick={detectLocation} disabled={fetchingLocation} style={{
            marginTop: 10, width: '100%', background: '#F0F4FF', border: '1.5px solid #2E5BFF',
            borderRadius: 14, padding: '11px 0', color: '#2E5BFF', fontWeight: 800, fontSize: 14,
            cursor: fetchingLocation ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            {fetchingLocation ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <MapPin size={16} />}
            {fetchingLocation ? 'Detecting…' : 'Detect My Location'}
          </button>
        </div>

        {/* Business Hours */}
        <div style={sectionStyle}>
          <div style={{ fontWeight: 900, fontSize: 15, color: '#1E2B45', marginBottom: 16 }}>Business Hours</div>

          {/* 24h toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontWeight: 800, color: '#1E2B45', fontSize: 14 }}>Open 24 Hours?</div>
            </div>
            <label style={{ position: 'relative', width: 48, height: 28, cursor: 'pointer' }}>
              <input type="checkbox" checked={open24Hours} onChange={() => setOpen24Hours(!open24Hours)} style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} />
              <span style={{ position: 'absolute', inset: 0, borderRadius: 999, background: open24Hours ? '#2E5BFF' : '#DCE7F5', transition: '0.3s' }} />
              <span style={{ position: 'absolute', left: open24Hours ? 22 : 2, top: 2, width: 24, height: 24, borderRadius: '50%', background: '#fff', transition: '0.3s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
            </label>
          </div>

          {!open24Hours && (
            <>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Opening Time</label>
                  <input type="time" value={openingTime} onChange={(e) => setOpeningTime(e.target.value)}
                    style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Closing Time</label>
                  <input type="time" value={closingTime} onChange={(e) => setClosingTime(e.target.value)}
                    style={inputStyle} />
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <label style={labelStyle}>Working Days</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {DAY_LABELS.map((day, i) => (
                    <button key={i} onClick={() => toggleDay(i)} style={{
                      width: 42, height: 38, borderRadius: 12, border: 'none', cursor: 'pointer',
                      background: workingDays.includes(i) ? '#2E5BFF' : '#F0F4FF',
                      color: workingDays.includes(i) ? '#fff' : '#4A5878',
                      fontWeight: 700, fontSize: 11,
                    }}>{day}</button>
                  ))}
                </div>
              </div>
            </>
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
            isEditing ? 'Update Profile' : 'Save & Continue'
          )}
        </button>
      </div>
    </div>
  );
}
