'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock, MapPin, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '@/store';
import { tr, getDir } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { createOrUpdateUserProfile } from '@/lib/firestore';

export default function WelcomePage() {
  const router = useRouter();
  const { setUser, locationSet, selectedCountry, selectedLanguage } = useAppStore();
  const [loading, setLoading] = useState(false);

  const afterAuth = () => {
    if (locationSet && selectedCountry) {
      router.replace('/home');
    } else {
      router.replace('/location');
    }
  };

  const processUser = async (supabaseUser: import('@supabase/supabase-js').User) => {
    const profile = {
      uid: supabaseUser.id,
      email: supabaseUser.email ?? '',
      displayName: supabaseUser.user_metadata?.full_name ?? supabaseUser.email?.split('@')[0] ?? '',
      photoUrl: supabaseUser.user_metadata?.avatar_url ?? undefined,
    };
    await createOrUpdateUserProfile(profile);
    setUser(profile);
    afterAuth();
  };

  // Handle OAuth redirect result on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setLoading(true);
        processUser(session.user).finally(() => setLoading(false));
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: typeof window !== 'undefined' ? window.location.href : undefined },
      });
      if (error) {
        toast.error('Google sign-in failed. Please try again.');
        setLoading(false);
      }
    } catch {
      toast.error('Google sign-in failed. Please try again.');
      setLoading(false);
    }
  };

  const handleApple = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: { redirectTo: typeof window !== 'undefined' ? window.location.href : undefined },
      });
      if (error) {
        toast.error('Apple sign-in failed. Please try again.');
        setLoading(false);
      }
    } catch {
      toast.error('Apple sign-in failed. Please try again.');
      setLoading(false);
    }
  };

  const handleGuest = () => {
    // Store a guest marker in localStorage so splash knows guest mode
    if (typeof window !== 'undefined') {
      localStorage.setItem('syph-guest', 'true');
    }
    afterAuth();
  };

  return (
    <div dir={getDir(selectedLanguage)} style={{ minHeight: '100dvh', background: '#D6ECFF', overflowY: 'auto' }}>
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '18px 20px 20px' }}>
        <div style={{ height: 20 }} />

        {/* Title */}
        <p style={{ textAlign: 'center', fontSize: 44, fontWeight: 900, color: '#132A66', lineHeight: 1, margin: 0 }}>
          {tr('welcome', selectedLanguage)}
        </p>

        <div style={{ height: 18 }} />

        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{
            width: 132, height: 132, borderRadius: 32,
            background: 'linear-gradient(160deg, #0F2B6E 0%, #1E4DD9 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: '#fff', fontWeight: 900, fontSize: 30, letterSpacing: '0.8px' }}>SYPH</span>
          </div>
        </div>

        <div style={{ height: 18 }} />

        {/* Tagline */}
        <p style={{ textAlign: 'center', fontWeight: 900, fontSize: 18, color: '#132A66', margin: 0 }}>
          {tr('tagline', selectedLanguage)}
        </p>
        <div style={{ height: 10 }} />
        <p style={{ textAlign: 'center', color: '#4A5878', fontWeight: 700, fontSize: 15, margin: 0 }}>
          Buy and sell anything across Africa and beyond.
        </p>

        <div style={{ height: 30 }} />

        {/* Google button */}
        <button onClick={handleGoogle} disabled={loading} style={{
          width: '100%', height: 52, borderRadius: 26, border: 'none',
          background: '#fff', color: '#000', fontWeight: 800, fontSize: 16,
          cursor: 'pointer', marginBottom: 12, opacity: loading ? 0.6 : 1,
        }}>
          {loading ? tr('loading', selectedLanguage) : tr('continueWithGoogle', selectedLanguage)}
        </button>

        {/* Apple button */}
        <button onClick={handleApple} disabled={loading} style={{
          width: '100%', height: 52, borderRadius: 26, border: 'none',
          background: '#1C1C1E', color: '#fff', fontWeight: 800, fontSize: 16,
          cursor: 'pointer', marginBottom: 12, opacity: loading ? 0.6 : 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <svg width="18" height="22" viewBox="0 0 814 1000" fill="white"><path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 482.8 0 293.2 0 192.1c0-130.3 84.5-199 167.2-199 78.8 0 127.6 52.8 167.5 52.8 37.6 0 92.5-56.2 171.1-56.2 33.6 0 152.9 3.2 236.3 116.7zm-257.1-104.7C503.9 165.3 474 85.5 474 20.1c0-5.2.4-10.3 1-15.5 52.8 1.9 116.7 35.9 152.2 79.5 30.2 36.6 58.7 95.7 58.7 174 0 5.8-.7 11.7-1 17.5z"/></svg>
          Continue with Apple
        </button>

        {/* Guest button */}
        <button onClick={handleGuest} style={{
          width: '100%', height: 52, borderRadius: 26,
          background: 'rgba(255,255,255,0.7)', border: '2px solid #2E5BFF',
          color: '#2E5BFF', fontWeight: 800, fontSize: 16, cursor: 'pointer', marginBottom: 12,
        }}>
          {tr('continueAsGuest', selectedLanguage)}
        </button>

        {/* Login button */}
        <button onClick={() => router.push('/login')} style={{
          width: '100%', height: 52, borderRadius: 26, border: 'none',
          background: '#2E5BFF', color: '#fff', fontWeight: 800, fontSize: 16,
          cursor: 'pointer', marginBottom: 12,
        }}>
          {tr('signIn', selectedLanguage)}
        </button>

        {/* Create Account */}
        <button onClick={() => router.push('/signup')} style={{
          width: '100%', height: 52, borderRadius: 26,
          background: 'rgba(255,255,255,0.7)', border: '2px solid #2E5BFF',
          color: '#2E5BFF', fontWeight: 800, fontSize: 16, cursor: 'pointer',
        }}>
          {tr('createAccount', selectedLanguage)}
        </button>

        <div style={{ height: 18 }} />

        {/* Info card */}
        <div style={{ background: 'rgba(255,255,255,0.75)', borderRadius: 22, padding: '14px 16px' }}>
          {[
            { Icon: Lock, text: 'Your data is secure and private' },
            { Icon: MapPin, text: 'Location used to show nearby listings' },
            { Icon: Zap, text: 'Continue browsing without signing up' },
          ].map(({ Icon, text }, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: i < 2 ? 12 : 0 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 14,
                background: 'rgba(46,91,255,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon size={20} color="#2E5BFF" />
              </div>
              <span style={{ color: '#4A5878', fontWeight: 700, fontSize: 14.5, lineHeight: 1.2 }}>{text}</span>
            </div>
          ))}
        </div>

        <div style={{ height: 16 }} />

        {/* Legal */}
        <div style={{ background: 'rgba(255,255,255,0.78)', borderRadius: 20, padding: '14px 16px', textAlign: 'center' }}>
          <span style={{ color: '#4A5878', fontWeight: 700, fontSize: 13.5, lineHeight: 1.45 }}>
            By agreeing you accept our{' '}
            <Link href="/terms" style={{ color: '#2E5BFF', fontWeight: 900 }}>Terms &amp; Conditions</Link>
            {' '}and acknowledge our{' '}
            <Link href="/privacy" style={{ color: '#2E5BFF', fontWeight: 900 }}>Privacy Policy</Link>.
          </span>
        </div>

        <div style={{ height: 10 }} />
      </div>
    </div>
  );
}
