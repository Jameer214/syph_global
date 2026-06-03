'use client';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '@/store';
import { COUNTRIES, COUNTRY_FLAGS } from '@/data/countries';

const REGIONS: { label: string; countries: string[] }[] = [
  {
    label: 'Africa',
    countries: [
      'Algeria', 'Angola', 'Benin', 'Botswana', 'Burkina Faso', 'Burundi',
      'Cabo Verde', 'Cameroon', 'Central African Republic', 'Chad', 'Comoros',
      'Congo (Brazzaville)', 'Congo (DRC)', 'Djibouti', 'Egypt',
      'Equatorial Guinea', 'Eritrea', 'Eswatini', 'Ethiopia', 'Gabon', 'Gambia',
      'Ghana', 'Guinea', 'Guinea-Bissau', 'Ivory Coast', 'Kenya', 'Lesotho',
      'Liberia', 'Libya', 'Madagascar', 'Malawi', 'Mali', 'Mauritania',
      'Mauritius', 'Morocco', 'Mozambique', 'Namibia', 'Niger', 'Nigeria',
      'Rwanda', 'São Tomé and Príncipe', 'Senegal', 'Sierra Leone', 'Somalia',
      'South Africa', 'South Sudan', 'Sudan', 'Tanzania', 'Togo', 'Tunisia',
      'Uganda', 'Zambia', 'Zimbabwe',
    ],
  },
  {
    label: 'Middle East',
    countries: [
      'Bahrain', 'Iraq', 'Jordan', 'Kuwait', 'Lebanon', 'Oman', 'Palestine',
      'Qatar', 'Saudi Arabia', 'Syria', 'United Arab Emirates', 'Yemen',
    ],
  },
  {
    label: 'Asia',
    countries: [
      'Afghanistan', 'Bangladesh', 'China', 'India', 'Indonesia', 'Iran',
      'Israel', 'Japan', 'Kazakhstan', 'Malaysia', 'Pakistan', 'Philippines',
      'Singapore', 'South Korea', 'Sri Lanka', 'Thailand', 'Turkey', 'Vietnam',
    ],
  },
  {
    label: 'Europe',
    countries: [
      'Albania', 'Austria', 'Belgium', 'Czech Republic', 'Denmark', 'Finland',
      'France', 'Germany', 'Greece', 'Hungary', 'Ireland', 'Italy',
      'Netherlands', 'Norway', 'Poland', 'Portugal', 'Romania', 'Russia',
      'Spain', 'Sweden', 'Switzerland', 'Ukraine', 'United Kingdom',
    ],
  },
  {
    label: 'Americas',
    countries: [
      'Argentina', 'Brazil', 'Canada', 'Chile', 'Colombia', 'Mexico', 'Peru',
      'United States',
    ],
  },
  {
    label: 'Oceania',
    countries: ['Australia', 'New Zealand'],
  },
];

export default function LocationPage() {
  const router = useRouter();
  const { setLocationSet } = useAppStore();
  const [search, setSearch] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);

  const filteredRegions = useMemo(() => {
    if (!search.trim()) return REGIONS;
    const q = search.toLowerCase();
    return REGIONS.map((r) => ({
      ...r,
      countries: r.countries.filter((c) => c.toLowerCase().includes(q)),
    })).filter((r) => r.countries.length > 0);
  }, [search]);

  const selectCountry = (country: string) => {
    setLocationSet(true, country);
    router.replace('/home');
  };

  const handleGPS = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser.');
      return;
    }
    setGpsLoading(true);
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
          } else {
            toast.error('Could not determine your country. Please select manually.');
          }
        } catch {
          toast.error('Failed to get location. Please select manually.');
        } finally {
          setGpsLoading(false);
        }
      },
      () => {
        setGpsLoading(false);
        toast.error('Location access denied. Please select manually.');
      }
    );
  };

  return (
    <div style={{ minHeight: '100dvh', background: '#F0F4FF', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(160deg, #0F2B6E 0%, #1E4DD9 100%)',
        padding: '20px 20px 24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: 'rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <span style={{ color: '#fff', fontWeight: 900, fontSize: 16 }}>S</span>
          </div>
          <div>
            <div style={{ color: '#fff', fontWeight: 900, fontSize: 22, lineHeight: 1 }}>Where are you?</div>
            <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 13, marginTop: 3, fontWeight: 500 }}>
              Select your country to see local listings
            </div>
          </div>
        </div>

        {/* Search bar */}
        <div style={{ position: 'relative' }}>
          <Search size={17} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search countries..."
            style={{
              width: '100%', height: 44, borderRadius: 14, border: 'none',
              background: 'rgba(255,255,255,0.15)', color: '#fff',
              paddingLeft: 42, paddingRight: 16, fontSize: 15, fontWeight: 500,
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 80px' }}>
        {/* GPS button */}
        <button
          onClick={handleGPS}
          disabled={gpsLoading}
          style={{
            width: '100%', height: 50, borderRadius: 14, border: 'none',
            background: '#2E5BFF', color: '#fff', fontWeight: 800, fontSize: 15,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 10, marginBottom: 20, opacity: gpsLoading ? 0.7 : 1,
          }}
        >
          <MapPin size={18} />
          {gpsLoading ? 'Detecting location…' : 'Use my current location'}
        </button>

        {/* Countries grouped by region */}
        {filteredRegions.map((region) => (
          <div key={region.label} style={{ marginBottom: 8 }}>
            <div style={{
              fontSize: 11, fontWeight: 800, color: '#6B7A99', letterSpacing: '1.5px',
              textTransform: 'uppercase', padding: '8px 4px 6px',
            }}>
              {region.label}
            </div>
            <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              {region.countries.map((country, idx) => (
                <button
                  key={country}
                  onClick={() => selectCountry(country)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                    padding: '13px 16px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    borderBottom: idx < region.countries.length - 1 ? '1px solid #f1f5f9' : 'none',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 24, flexShrink: 0 }}>{COUNTRY_FLAGS[country] ?? '🌍'}</span>
                  <span style={{ fontSize: 15, fontWeight: 600, color: '#1a1a2e' }}>{country}</span>
                </button>
              ))}
            </div>
          </div>
        ))}

        {filteredRegions.length === 0 && (
          <div style={{ textAlign: 'center', color: '#6B7A99', fontSize: 15, fontWeight: 600, marginTop: 40 }}>
            No countries found for &ldquo;{search}&rdquo;
          </div>
        )}

        {/* Skip */}
        <button
          onClick={() => {
            setLocationSet(true, '');
            router.replace('/home');
          }}
          style={{
            width: '100%', height: 48, borderRadius: 14, border: '1.5px solid #d1d5db',
            background: 'transparent', color: '#6B7A99', fontWeight: 700, fontSize: 14,
            cursor: 'pointer', marginTop: 16,
          }}
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
