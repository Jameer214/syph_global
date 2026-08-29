'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, MapPin, Loader, Store, Clock, Globe,
  Phone, ChevronDown, Search, CheckCircle, X, FileText,
  Truck, Wrench, ShoppingBag, Calendar, Sun, Moon, ChevronRight, Info,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getSellerProfile, createSellerProfile, updateSellerProfile } from '@/lib/firestore';
import { COUNTRIES } from '@/data/countries';
import type { SellerProfile } from '@/types';
import toast from 'react-hot-toast';
import { sanitizeText } from '@/lib/sanitize';
import { useAppStore } from '@/store';
import { translate as tr } from '@/lib/i18n';

// Canonical English values stored to DB — only the display is translated.
// syph parity: exactly five regions, no "Other".
const REGIONS = ['Central', 'Eastern', 'Northern', 'Western', 'Southern'];
const REGION_KEYS: Record<string, string> = {
  Central: 'regionCentral', Eastern: 'regionEastern', Northern: 'regionNorthern',
  Western: 'regionWestern', Southern: 'regionSouthern',
};
const DAY_KEYS = ['dayMon', 'dayTue', 'dayWed', 'dayThu', 'dayFri', 'daySat', 'daySun'];

const BLUE = '#1E4DD9';

export default function SellerSetupPage() {
  const router = useRouter();
  const { selectedLanguage: lang } = useAppStore();
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [description, setDescription] = useState('');
  const [isServiceProvider, setIsServiceProvider] = useState(false);
  const [delivers, setDelivers] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [address, setAddress] = useState('');
  const [open24Hours, setOpen24Hours] = useState(false);
  // syph parity: times start unset ("Not set") and must be picked before submit.
  const [openingTime, setOpeningTime] = useState('');
  const [closingTime, setClosingTime] = useState('');
  // syph parity: working days start empty (empty = available every day).
  const [workingDays, setWorkingDays] = useState<number[]>([]);
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [businessLat, setBusinessLat] = useState<number | null>(null);
  const [businessLng, setBusinessLng] = useState<number | null>(null);

  // Country modal state
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [countryQuery, setCountryQuery] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      if (!u) { setLoading(false); return; }
      setUid(u.id);
      const sp = await getSellerProfile(u.id);
      if (sp) {
        setIsEditing(true);
        setBusinessName(sp.businessName || '');
        setPhone(sp.businessPhone || '');
        setDescription(sp.bio || '');
        setSelectedCountry(sp.operatingCountry || '');
        setSelectedRegion(REGIONS.includes(sp.operatingRegion || '') ? sp.operatingRegion! : '');
        setAddress(sp.businessLocationText || '');
        setDelivers(sp.delivers === true);
      }
      setLoading(false);
    });
  }, []);

  const filteredCountries = countryQuery.trim()
    ? COUNTRIES.filter(c => c.toLowerCase().includes(countryQuery.toLowerCase()))
    : COUNTRIES;

  function toggleDay(dayIdx: number) {
    setWorkingDays(prev =>
      prev.includes(dayIdx) ? prev.filter(d => d !== dayIdx) : [...prev, dayIdx].sort()
    );
  }

  async function detectLocation() {
    if (!navigator.geolocation) {
      toast.error(tr('geoNotSupported', lang));
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
      toast.success(tr('locationDetected', lang));
    } catch {
      toast.error(tr('failedDetectLocation', lang));
    } finally {
      setFetchingLocation(false);
    }
  }

  async function handleSave() {
    if (!uid) return;
    // Validation order mirrors syph's _saveAndContinue exactly.
    if (!businessName.trim()) { toast.error(tr('enterBusinessName', lang)); return; }
    if (businessName.trim().length > 60) { toast.error(tr('setupNameTooLong', lang)); return; }
    if (description.trim().length > 500) { toast.error(tr('setupDescTooLong', lang)); return; }
    if (!phone.trim()) { toast.error(tr('enterContactNumber', lang)); return; }
    if (!selectedCountry) { toast.error(tr('selectYourCountry', lang)); return; }
    if (!selectedRegion) { toast.error(tr('selectYourRegion', lang)); return; }
    if (!description.trim()) { toast.error(tr('enterBusinessDesc', lang)); return; }
    if (!open24Hours && !openingTime) { toast.error(tr('setupSelectOpening', lang)); return; }
    if (!open24Hours && !closingTime) { toast.error(tr('setupSelectClosing', lang)); return; }
    if (businessLat === null || businessLng === null) {
      toast.error(tr('setLocationGps', lang)); return;
    }

    setSaving(true);
    try {
      const safeName = sanitizeText(businessName, 60);
      const safeDesc = sanitizeText(description, 500);
      const safeAddress = sanitizeText(address, 200);
      if (!safeName) { toast.error(tr('businessNameEmpty', lang)); return; }
      if (!safeDesc) { toast.error(tr('businessDescEmpty', lang)); return; }
      const profileData: Omit<SellerProfile, 'isVerified' | 'rating' | 'totalReviews'> = {
        uid,
        businessName: safeName,
        businessPhone: phone.trim(),
        operatingCountry: selectedCountry,
        operatingRegion: selectedRegion,
        businessLocationText: safeAddress || undefined,
        bio: safeDesc,
        mainCategoryIds: [],
        serviceSubcategoryIds: [],
      };
      const extraFields = {
        country: selectedCountry,
        region: selectedRegion,
        contactNumber: phone.trim(),
        description: safeDesc,
        isServiceProvider,
        open24Hours,
        openingTime: open24Hours ? null : openingTime,
        closingTime: open24Hours ? null : closingTime,
        workingDays,
        businessLocationAddress: safeAddress || null,
        businessLatitude: businessLat,
        businessLongitude: businessLng,
        delivers,
      };

      if (isEditing) {
        await updateSellerProfile(uid, { ...profileData, ...extraFields } as Parameters<typeof updateSellerProfile>[1]);
      } else {
        await createSellerProfile(profileData, extraFields);
      }

      toast.success(tr('sellerProfileSaved', lang));
      router.push('/dashboard');
    } catch {
      toast.error(tr('failedSaveProfile', lang));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
        <div style={{ width: 36, height: 36, border: '3px solid #E8EDFF', borderTop: `3px solid ${BLUE}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!uid) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff', padding: 24 }}>
        <Store size={48} color={BLUE} />
        <div style={{ fontWeight: 900, fontSize: 18, color: '#1E2B45', marginTop: 16 }}>{tr('signInToSetupSeller', lang)}</div>
        <button onClick={() => router.push('/login')} style={{ marginTop: 20, background: BLUE, color: '#fff', border: 'none', borderRadius: 14, padding: '12px 32px', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>{tr('signIn', lang)}</button>
      </div>
    );
  }

  // ── Shared styles (mirror syph's filled, rounded-16 fields) ─────────────────
  const fieldWrap: React.CSSProperties = { position: 'relative', marginBottom: 16 };
  const fieldIcon: React.CSSProperties = { position: 'absolute', left: 14, top: 17, color: BLUE };
  const filledInput: React.CSSProperties = {
    width: '100%', padding: '15px 14px 15px 44px', border: '1px solid #E0E8F0',
    borderRadius: 16, fontSize: 15, outline: 'none', background: '#F8FAFF',
    boxSizing: 'border-box', fontFamily: 'inherit', color: '#1a1a2e',
  };
  const fieldLabel: React.CSSProperties = {
    position: 'absolute', left: 40, top: -8, background: '#fff', padding: '0 6px',
    fontSize: 12, fontWeight: 600, color: '#5A6B8C',
  };
  const cardSectionStyle: React.CSSProperties = {
    borderRadius: 24, padding: 20, marginBottom: 24,
    background: 'linear-gradient(135deg, rgba(30,77,217,0.05) 0%, rgba(74,122,255,0.02) 100%)',
    border: '1px solid #E0ECFF',
  };
  const toggleRow: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 12,
    background: '#F8FAFC', borderRadius: 20, padding: '12px 14px',
    border: '1px solid #E8ECF2', marginBottom: 24,
  };

  return (
    <div style={{ minHeight: '100dvh', background: '#fff', maxWidth: 480, margin: '0 auto' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Country Search Modal (bottom sheet) — no flags, mirrors syph */}
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
              <div style={{ fontWeight: 900, fontSize: 16, color: '#1E2B45' }}>{tr('setupCountryLabel', lang)}</div>
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
                placeholder={tr('setupCountryHint', lang)}
                style={{ width: '100%', padding: '12px 16px 12px 40px', border: '1px solid #E0E8F0', borderRadius: 12, fontSize: 14, outline: 'none', background: '#F8FAFF', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {filteredCountries.map((c, idx) => {
                const isSel = selectedCountry === c;
                return (
                  <button key={c} onClick={() => { setSelectedCountry(c); setShowCountryModal(false); setCountryQuery(''); }} style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                    padding: '13px 16px', background: 'none',
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                    borderBottom: idx < filteredCountries.length - 1 ? '1px solid #f8faff' : 'none',
                  }}>
                    {isSel
                      ? <CheckCircle size={20} color={BLUE} style={{ flexShrink: 0 }} />
                      : <Globe size={20} color="#9ca3af" style={{ flexShrink: 0 }} />}
                    <span style={{ flex: 1, fontSize: 15, fontWeight: isSel ? 800 : 400, color: '#1a1a2e' }}>{c}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Gradient app bar (mirrors SyphGradientAppBar) */}
      <div style={{ background: 'linear-gradient(135deg, #0F2B6E 0%, #1E4DD9 100%)', padding: '14px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => router.back()} style={{ background: 'transparent', border: 'none', padding: 6, cursor: 'pointer', display: 'flex' }}>
          <ArrowLeft size={22} color="#fff" />
        </button>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{tr('sellerSetupTitle', lang)}</div>
      </div>

      <div style={{ padding: '24px 20px 100px' }}>

        {/* Header block */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 80, height: 80, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #1E4DD9 0%, #4A7AFF 100%)',
            borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 20px rgba(30,77,217,0.3)',
          }}>
            <Store size={40} color="#fff" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5, color: '#111' }}>{tr('becomeASeller', lang)}</div>
          <div style={{ fontSize: 14, color: '#6B7280', fontWeight: 500, marginTop: 8 }}>{tr('setupBecomeSellerDesc', lang)}</div>
        </div>

        {/* Business name */}
        <div style={fieldWrap}>
          <Store size={18} style={fieldIcon} />
          <span style={fieldLabel}>{tr('setupBusinessNameLabel', lang)}</span>
          <input value={businessName} onChange={e => setBusinessName(e.target.value)}
            placeholder={tr('setupBusinessNameHint', lang)} style={filledInput} />
        </div>

        {/* Contact number */}
        <div style={fieldWrap}>
          <Phone size={18} style={fieldIcon} />
          <span style={fieldLabel}>{tr('setupContactLabel', lang)}</span>
          <input value={phone} onChange={e => setPhone(e.target.value)} type="tel"
            placeholder={tr('setupContactHint', lang)} style={filledInput} />
        </div>

        {/* Country picker */}
        <div style={fieldWrap}>
          <Globe size={18} style={fieldIcon} />
          <span style={fieldLabel}>{tr('setupCountryLabel', lang)}</span>
          <button type="button" onClick={() => setShowCountryModal(true)}
            style={{ ...filledInput, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', color: selectedCountry ? '#1a1a2e' : '#9ca3af' }}>
            <span style={{ flex: 1 }}>{selectedCountry || tr('setupCountryHint', lang)}</span>
            <ChevronDown size={18} color="#9ca3af" />
          </button>
        </div>

        {/* Region dropdown */}
        <div style={fieldWrap}>
          <MapPin size={18} style={fieldIcon} />
          <span style={fieldLabel}>{tr('setupRegionLabel', lang)}</span>
          <select value={selectedRegion} onChange={e => setSelectedRegion(e.target.value)}
            style={{ ...filledInput, cursor: 'pointer', appearance: 'none', color: selectedRegion ? '#1a1a2e' : '#9ca3af' }}>
            <option value="" disabled>{tr('setupSelectRegion', lang)}</option>
            {REGIONS.map(r => <option key={r} value={r}>{tr(REGION_KEYS[r], lang)}</option>)}
          </select>
          <ChevronDown size={18} color="#9ca3af" style={{ position: 'absolute', right: 14, top: 17, pointerEvents: 'none' }} />
        </div>

        {/* Business description */}
        <div style={fieldWrap}>
          <FileText size={18} style={fieldIcon} />
          <span style={fieldLabel}>{tr('setupBusinessDescLabel', lang)}</span>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            placeholder={tr('setupBusinessDescHint', lang)} rows={3}
            style={{ ...filledInput, resize: 'vertical', lineHeight: 1.6 }} />
        </div>

        {/* Service provider toggle */}
        <div style={toggleRow}>
          {isServiceProvider ? <Wrench size={22} color={BLUE} /> : <ShoppingBag size={22} color={BLUE} />}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: '#1E2B45', fontSize: 14 }}>{tr('setupServiceProvider', lang)}</div>
            <div style={{ color: '#6B7A99', fontSize: 12, marginTop: 2 }}>
              {isServiceProvider ? tr('setupOffersServices', lang) : tr('setupSellsProducts', lang)}
            </div>
          </div>
          <label style={{ position: 'relative', width: 48, height: 28, cursor: 'pointer', flexShrink: 0 }}>
            <input type="checkbox" checked={isServiceProvider} onChange={() => setIsServiceProvider(!isServiceProvider)} style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} />
            <span style={{ position: 'absolute', inset: 0, borderRadius: 999, background: isServiceProvider ? BLUE : '#DCE7F5', transition: '0.3s' }} />
            <span style={{ position: 'absolute', left: isServiceProvider ? 22 : 2, top: 2, width: 24, height: 24, borderRadius: '50%', background: '#fff', transition: '0.3s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
          </label>
        </div>

        {/* Delivery toggle */}
        <div style={toggleRow}>
          <Truck size={22} color={BLUE} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: '#1E2B45', fontSize: 14 }}>{tr('setupDeliveryLabel', lang)}</div>
            <div style={{ color: '#6B7A99', fontSize: 12, marginTop: 2 }}>{tr('setupDeliveryDesc', lang)}</div>
          </div>
          <label style={{ position: 'relative', width: 48, height: 28, cursor: 'pointer', flexShrink: 0 }}>
            <input type="checkbox" checked={delivers} onChange={() => setDelivers(!delivers)} style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} />
            <span style={{ position: 'absolute', inset: 0, borderRadius: 999, background: delivers ? BLUE : '#DCE7F5', transition: '0.3s' }} />
            <span style={{ position: 'absolute', left: delivers ? 22 : 2, top: 2, width: 24, height: 24, borderRadius: '50%', background: '#fff', transition: '0.3s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
          </label>
        </div>

        {/* Business Hours card */}
        <div style={cardSectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(30,77,217,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Clock size={22} color={BLUE} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#1E2B45' }}>{tr('setupBusinessHours', lang)}</div>
          </div>
          <div style={{ fontSize: 13, color: '#000000', opacity: 0.54, fontWeight: 500, marginBottom: 20, lineHeight: 1.5 }}>
            {tr('setupBusinessHoursDesc', lang)}
          </div>

          <div style={{ background: '#fff', borderRadius: 16, padding: 12 }}>
            {/* Open 24h switch */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: '#1E2B45', fontSize: 15 }}>{tr('setupOpen24', lang)}</div>
                <div style={{ color: '#6B7A99', fontSize: 13, marginTop: 2 }}>{tr('setupAlwaysOpen', lang)}</div>
              </div>
              <label style={{ position: 'relative', width: 48, height: 28, cursor: 'pointer', flexShrink: 0 }}>
                <input type="checkbox" checked={open24Hours} onChange={() => setOpen24Hours(!open24Hours)} style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} />
                <span style={{ position: 'absolute', inset: 0, borderRadius: 999, background: open24Hours ? BLUE : '#DCE7F5', transition: '0.3s' }} />
                <span style={{ position: 'absolute', left: open24Hours ? 22 : 2, top: 2, width: 24, height: 24, borderRadius: '50%', background: '#fff', transition: '0.3s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
              </label>
            </div>

            {/* Opening / closing time tiles — only when NOT 24h */}
            {!open24Hours && (
              <>
                <div style={{ height: 1, background: '#EEF1F6', margin: '12px 0' }} />
                <TimeTile icon={<Sun size={20} color={BLUE} />} title={tr('setupOpeningTime', lang)} value={openingTime} onChange={setOpeningTime} notSet={tr('setupNotSet', lang)} />
                <div style={{ height: 12 }} />
                <TimeTile icon={<Moon size={20} color={BLUE} />} title={tr('setupClosingTime', lang)} value={closingTime} onChange={setClosingTime} notSet={tr('setupNotSet', lang)} />
              </>
            )}

            {/* Working days — ALWAYS visible (syph parity) */}
            <div style={{ height: 1, background: '#EEF1F6', margin: '12px 0' }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calendar size={20} color={BLUE} />
                <div style={{ fontSize: 15, fontWeight: 800, color: '#1E2B45' }}>{tr('setupWorkingDays', lang)}</div>
                <div style={{ flex: 1 }} />
                {workingDays.length > 0 && (
                  <button onClick={() => setWorkingDays([])} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', fontSize: 12, color: BLUE, fontWeight: 600 }}>
                    {tr('setupAllWeek', lang)}
                  </button>
                )}
              </div>
              <div style={{ fontSize: 12, color: '#00000073', height: 1.4, marginTop: 6, lineHeight: 1.4 }}>
                {tr('setupWorkingDaysDesc', lang)}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                {DAY_KEYS.map((dayKey, i) => {
                  const sel = workingDays.includes(i);
                  return (
                    <button key={i} onClick={() => toggleDay(i)} style={{
                      width: 42, height: 42, borderRadius: 12,
                      border: `1.5px solid ${sel ? BLUE : '#CDD5E0'}`,
                      cursor: 'pointer',
                      background: sel ? BLUE : 'transparent',
                      color: sel ? '#fff' : '#64748B',
                      fontWeight: 700, fontSize: 12,
                    }}>{tr(dayKey, lang)}</button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Business Location card */}
        <div style={cardSectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(30,77,217,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <MapPin size={22} color={BLUE} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#1E2B45' }}>{tr('setupBusinessLocation', lang)}</div>
          </div>
          <div style={{ fontSize: 13, color: '#000000', opacity: 0.54, fontWeight: 500, lineHeight: 1.4 }}>
            {tr('setupLocationInstructions', lang)}
          </div>
          {businessLat === null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <Info size={14} color="#EF4444" />
              <span style={{ fontSize: 12, color: '#EF4444', fontWeight: 600 }}>{tr('setupRequiredNearMe', lang)}</span>
            </div>
          )}

          <button onClick={detectLocation} disabled={fetchingLocation || saving} style={{
            width: '100%', padding: '14px 0', marginTop: 20,
            background: BLUE, border: 'none', borderRadius: 16, color: '#fff',
            fontWeight: 700, fontSize: 15,
            cursor: fetchingLocation || saving ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            {fetchingLocation
              ? <><Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> {tr('setupDetectingLocation', lang)}</>
              : businessLat !== null
                ? <><MapPin size={18} /> {tr('setupUpdateLocation', lang)}</>
                : <><MapPin size={18} /> {tr('setupSetLocation', lang)}</>
            }
          </button>

          {businessLat !== null && (
            <div style={{
              marginTop: 16, background: '#fff', borderRadius: 16, padding: 16,
              border: '1px solid #E0ECFF', display: 'flex', alignItems: 'flex-start', gap: 12,
            }}>
              <CheckCircle size={20} color={BLUE} style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#1E2B45', marginBottom: 4 }}>{tr('setupLocationSaved', lang)}</div>
                <div style={{ fontSize: 12, color: '#6B7A99', lineHeight: 1.5, wordBreak: 'break-word' }}>
                  {address || `${businessLat.toFixed(6)}, ${businessLng?.toFixed(6)}`}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Submit button */}
        <button onClick={handleSave} disabled={saving} style={{
          width: '100%', padding: 16, marginTop: 8, marginBottom: 32,
          background: saving ? '#A0B4E0' : BLUE,
          border: 'none', borderRadius: 20, color: '#fff', fontWeight: 700, fontSize: 16,
          cursor: saving ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          {saving ? (
            <div style={{ width: 24, height: 24, border: '2px solid rgba(255,255,255,0.4)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          ) : (
            <>{tr('setupCompleteSetup', lang)} <ChevronRight size={20} /></>
          )}
        </button>
      </div>
    </div>
  );
}

// Time picker tile mirroring syph's _buildTimePickerTile (label + value + chevron).
function TimeTile({ icon, title, value, onChange, notSet }: {
  icon: React.ReactNode; title: string; value: string;
  onChange: (v: string) => void; notSet: string;
}) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '14px 16px', border: '1px solid #E0E8F0', borderRadius: 12, cursor: 'pointer',
    }}>
      {icon}
      <span style={{ flex: 1, fontWeight: 600, color: '#1E2B45', fontSize: 14 }}>{title}</span>
      <span style={{ color: value ? '#1E4DD9' : '#9ca3af', fontWeight: 600, fontSize: 14 }}>{value || notSet}</span>
      <ChevronRight size={18} color="#9ca3af" />
      <input type="time" value={value} onChange={e => onChange(e.target.value)}
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
    </label>
  );
}
