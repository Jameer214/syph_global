'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, Mail, Lock, Eye, EyeOff, ArrowLeft, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { useAppStore } from '@/store';
import { auth } from '@/lib/firebase';
import { createOrUpdateUserProfile } from '@/lib/firestore';
import { COUNTRIES } from '@/data/countries';

const REGIONS = ['Central', 'Eastern', 'Northern', 'Western', 'Southern', 'Other'];

export default function SignupPage() {
  const router = useRouter();
  const { setUser, locationSet, selectedCountry } = useAppStore();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [country, setCountry] = useState('');
  const [countrySearch, setCountrySearch] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [region, setRegion] = useState('');
  const [loading, setLoading] = useState(false);
  const countryRef = useRef<HTMLDivElement>(null);

  const afterAuth = () => {
    if (locationSet && selectedCountry) {
      router.replace('/home');
    } else {
      router.replace('/location');
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (countryRef.current && !countryRef.current.contains(e.target as Node)) {
        setShowCountryDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredCountries = COUNTRIES.filter((c) =>
    c.toLowerCase().includes(countrySearch.toLowerCase())
  ).slice(0, 20);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return toast.error('Please enter your full name.');
    if (!email.trim()) return toast.error('Please enter your email.');
    if (password.length < 6) return toast.error('Password must be at least 6 characters.');
    if (!country) return toast.error('Please select your country.');

    setLoading(true);
    try {
      const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const firebaseUser = result.user;

      // Update display name
      await updateProfile(firebaseUser, { displayName: fullName.trim() });

      const profile = {
        uid: firebaseUser.uid,
        email: firebaseUser.email ?? '',
        displayName: fullName.trim(),
        photoUrl: firebaseUser.photoURL ?? undefined,
        country: country || undefined,
        regionOrCity: region || undefined,
      };
      await createOrUpdateUserProfile(profile);
      setUser(profile);
      toast.success('Account created successfully!');
      afterAuth();
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      if (code === 'auth/email-already-in-use') {
        toast.error('This email is already registered. Try logging in.');
      } else if (code === 'auth/invalid-email') {
        toast.error('Invalid email address.');
      } else if (code === 'auth/weak-password') {
        toast.error('Password is too weak.');
      } else {
        toast.error('Sign up failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 52, borderRadius: 14,
    border: '1.5px solid #e2e8f0', background: '#f8faff',
    paddingLeft: 46, paddingRight: 16, fontSize: 15, fontWeight: 500,
    color: '#1a1a2e', outline: 'none',
  };

  return (
    <div style={{ minHeight: '100dvh', background: '#D6ECFF', overflowY: 'auto' }}>
      <div style={{ maxWidth: 520, margin: '0 auto', width: '100%', padding: '20px 20px 40px' }}>
        {/* Back button */}
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0', display: 'flex', alignItems: 'center', gap: 6, color: '#132A66', fontWeight: 700, fontSize: 15 }}
        >
          <ArrowLeft size={20} />
          Back
        </button>

        <div style={{ height: 16 }} />

        {/* Card */}
        <div style={{ background: '#fff', borderRadius: 24, padding: '28px 24px', boxShadow: '0 4px 24px rgba(0,0,0,0.07)' }}>
          {/* Title */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: '#132A66' }}>
              Create Account &mdash; <span style={{ color: '#2E5BFF' }}>SYPH</span>
            </h1>
            <p style={{ margin: '8px 0 0', color: '#6B7A99', fontSize: 14, fontWeight: 500 }}>
              Join millions buying and selling across Africa and beyond.
            </p>
          </div>

          <form onSubmit={handleSignup}>
            {/* Full name */}
            <div style={{ position: 'relative', marginBottom: 14 }}>
              <User size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full name"
                autoComplete="name"
                style={inputStyle}
              />
            </div>

            {/* Email */}
            <div style={{ position: 'relative', marginBottom: 14 }}>
              <Mail size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                autoComplete="email"
                style={inputStyle}
              />
            </div>

            {/* Password */}
            <div style={{ position: 'relative', marginBottom: 14 }}>
              <Lock size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (min 6 characters)"
                autoComplete="new-password"
                style={{ ...inputStyle, paddingRight: 48 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex' }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Country autocomplete */}
            <div ref={countryRef} style={{ position: 'relative', marginBottom: 14 }}>
              <input
                type="text"
                value={country ? country : countrySearch}
                onChange={(e) => {
                  setCountry('');
                  setCountrySearch(e.target.value);
                  setShowCountryDropdown(true);
                }}
                onFocus={() => setShowCountryDropdown(true)}
                placeholder="Select country"
                style={{ ...inputStyle, paddingLeft: 16 }}
              />
              {showCountryDropdown && filteredCountries.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                  background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 200, overflowY: 'auto',
                  marginTop: 4,
                }}>
                  {filteredCountries.map((c, idx) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setCountry(c);
                        setCountrySearch(c);
                        setShowCountryDropdown(false);
                      }}
                      style={{
                        width: '100%', padding: '12px 16px', background: 'none', border: 'none',
                        cursor: 'pointer', textAlign: 'left', fontSize: 14, fontWeight: 600,
                        color: '#1a1a2e',
                        borderBottom: idx < filteredCountries.length - 1 ? '1px solid #f1f5f9' : 'none',
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Region dropdown */}
            <div style={{ position: 'relative', marginBottom: 24 }}>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                style={{
                  width: '100%', height: 52, borderRadius: 14,
                  border: '1.5px solid #e2e8f0', background: '#f8faff',
                  padding: '0 16px', fontSize: 15, fontWeight: 500,
                  color: region ? '#1a1a2e' : '#9ca3af', outline: 'none',
                  appearance: 'none', cursor: 'pointer',
                }}
              >
                <option value="">Select region (optional)</option>
                {REGIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <ChevronDown size={18} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', height: 52, borderRadius: 26, border: 'none',
                background: '#2E5BFF', color: '#fff', fontWeight: 800, fontSize: 16,
                cursor: 'pointer', opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <div style={{ height: 20 }} />

          <p style={{ textAlign: 'center', margin: 0, color: '#6B7A99', fontSize: 14, fontWeight: 500 }}>
            Already have an account?{' '}
            <Link href="/login" style={{ color: '#2E5BFF', fontWeight: 800, textDecoration: 'none' }}>
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
