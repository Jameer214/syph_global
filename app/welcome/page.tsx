'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock, MapPin, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider,
} from 'firebase/auth';
import { useAppStore } from '@/store';
import { auth } from '@/lib/firebase';
import { createOrUpdateUserProfile } from '@/lib/firestore';

export default function WelcomePage() {
  const router = useRouter();
  const { setUser, locationSet, selectedCountry } = useAppStore();
  const [loading, setLoading] = useState(false);

  const afterAuth = () => {
    if (locationSet && selectedCountry) {
      router.replace('/home');
    } else {
      router.replace('/location');
    }
  };

  const processUser = async (firebaseUser: import('firebase/auth').User) => {
    const profile = {
      uid: firebaseUser.uid,
      email: firebaseUser.email ?? '',
      displayName: firebaseUser.displayName ?? '',
      photoUrl: firebaseUser.photoURL ?? undefined,
    };
    await createOrUpdateUserProfile(profile);
    setUser(profile);
    afterAuth();
  };

  // Handle result after signInWithRedirect comes back
  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          setLoading(true);
          return processUser(result.user);
        }
      })
      .catch((err) => {
        const code = (err as { code?: string }).code ?? '';
        if (code === 'auth/unauthorized-domain') {
          toast.error('This domain is not authorised. Contact support.');
        } else if (code && code !== 'auth/no-auth-event') {
          toast.error('Google sign-in failed. Please try again.');
        }
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGoogle = async () => {
    setLoading(true);
    const provider = new GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    try {
      const result = await signInWithPopup(auth, provider);
      await processUser(result.user);
    } catch (err) {
      const code = (err as { code?: string }).code ?? '';
      if (code === 'auth/popup-blocked') {
        await signInWithRedirect(auth, provider);
      } else if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setLoading(false);
      } else if (code === 'auth/unauthorized-domain') {
        toast.error('This domain is not authorised. Please use Login or Create Account instead.');
        setLoading(false);
      } else if (code === 'auth/operation-not-allowed') {
        toast.error('Google sign-in is not enabled. Please use Login instead.');
        setLoading(false);
      } else {
        toast.error('Google sign-in failed. Please try again.');
        setLoading(false);
      }
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
    <div style={{ minHeight: '100dvh', background: '#D6ECFF', overflowY: 'auto' }}>
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '18px 20px 20px' }}>
        <div style={{ height: 20 }} />

        {/* Title */}
        <p style={{ textAlign: 'center', fontSize: 44, fontWeight: 900, color: '#132A66', lineHeight: 1, margin: 0 }}>
          Welcome to
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
          Find it. Locate it. Connect.
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
          {loading ? 'Signing in…' : 'Continue with Google'}
        </button>

        {/* Guest button */}
        <button onClick={handleGuest} style={{
          width: '100%', height: 52, borderRadius: 26,
          background: 'rgba(255,255,255,0.7)', border: '2px solid #2E5BFF',
          color: '#2E5BFF', fontWeight: 800, fontSize: 16, cursor: 'pointer', marginBottom: 12,
        }}>
          Continue as Guest
        </button>

        {/* Login button */}
        <button onClick={() => router.push('/login')} style={{
          width: '100%', height: 52, borderRadius: 26, border: 'none',
          background: '#2E5BFF', color: '#fff', fontWeight: 800, fontSize: 16,
          cursor: 'pointer', marginBottom: 12,
        }}>
          Login
        </button>

        {/* Create Account */}
        <button onClick={() => router.push('/signup')} style={{
          width: '100%', height: 52, borderRadius: 26,
          background: 'rgba(255,255,255,0.7)', border: '2px solid #2E5BFF',
          color: '#2E5BFF', fontWeight: 800, fontSize: 16, cursor: 'pointer',
        }}>
          Create Account
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
