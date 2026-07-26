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

// Deterministic star field (fixed values — random would break SSR hydration)
const STARS = [
  { top: '6%', left: '12%', size: 2, delay: 0 },
  { top: '11%', left: '78%', size: 3, delay: 0.8 },
  { top: '18%', left: '38%', size: 2, delay: 1.6 },
  { top: '24%', left: '90%', size: 2, delay: 0.4 },
  { top: '31%', left: '8%', size: 3, delay: 2.1 },
  { top: '38%', left: '64%', size: 2, delay: 1.2 },
  { top: '46%', left: '22%', size: 2, delay: 2.7 },
  { top: '52%', left: '84%', size: 3, delay: 0.2 },
  { top: '60%', left: '46%', size: 2, delay: 1.9 },
  { top: '67%', left: '8%', size: 2, delay: 0.6 },
  { top: '72%', left: '72%', size: 3, delay: 2.4 },
  { top: '80%', left: '30%', size: 2, delay: 1.4 },
  { top: '86%', left: '88%', size: 2, delay: 0.9 },
  { top: '92%', left: '55%', size: 3, delay: 1.8 },
  { top: '14%', left: '55%', size: 2, delay: 2.9 },
  { top: '57%', left: '94%', size: 2, delay: 1.1 },
];

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
    </svg>
  );
}

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
    await createOrUpdateUserProfile(profile).catch(() => {}); // profile row is secondary; never block a valid session
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
        toast.error(tr('googleSignInFailed', selectedLanguage));
        setLoading(false);
      }
    } catch {
      toast.error(tr('googleSignInFailed', selectedLanguage));
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
    <div
      dir={getDir(selectedLanguage)}
      style={{
        minHeight: '100dvh',
        background: 'radial-gradient(120% 90% at 50% 0%, #12317D 0%, #0A1D52 48%, #060F2E 100%)',
        overflowY: 'auto', overflowX: 'hidden', position: 'relative',
      }}
    >
      {/* Drifting aurora glow */}
      <div className="aurora-blob" style={{ width: 360, height: 360, top: -100, left: -110, background: 'rgba(46,91,255,0.42)' }} />
      <div className="aurora-blob" style={{ width: 300, height: 300, top: '32%', right: -130, background: 'rgba(108,99,255,0.36)', animationDelay: '-5s' }} />
      <div className="aurora-blob" style={{ width: 320, height: 320, bottom: -120, left: '18%', background: 'rgba(56,189,248,0.26)', animationDelay: '-9s' }} />

      {/* Star field */}
      {STARS.map((s, i) => (
        <span key={i} className="star" style={{ top: s.top, left: s.left, width: s.size, height: s.size, animationDelay: `${s.delay}s` }} />
      ))}

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 520, margin: '0 auto', padding: '30px 22px 26px' }}>

        {/* Live badge */}
        <div className="anim-fade-up" style={{ display: 'flex', justifyContent: 'center' }}>
          <div className="glass-card" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 30, padding: '6px 14px' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ADE80', animation: 'pulse 2s ease-in-out infinite' }} />
            <span style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.85)', letterSpacing: '2px' }}>
              GLOBAL MARKETPLACE · LIVE IN 50+ COUNTRIES
            </span>
          </div>
        </div>

        <div style={{ height: 22 }} />

        {/* Title */}
        <p className="text-shimmer anim-fade-up" style={{ textAlign: 'center', fontSize: 44, fontWeight: 900, lineHeight: 1, margin: 0, animationDelay: '0.08s' }}>
          {tr('welcome', selectedLanguage)}
        </p>
        <div style={{ height: 8 }} />
        <p className="anim-fade-up" style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: 14.5, margin: 0, animationDelay: '0.14s' }}>
          Buy and sell anything across Africa and beyond.
        </p>

        <div style={{ height: 26 }} />

        {/* Logo with rotating halo + shine sweep */}
        <div className="anim-pop" style={{ display: 'flex', justifyContent: 'center', animationDelay: '0.2s' }}>
          <div style={{ position: 'relative', width: 132, height: 132, animation: 'float 5s ease-in-out infinite' }}>
            <div className="halo" />
            <div className="sweep" style={{
              position: 'absolute', inset: 0, borderRadius: 32,
              background: 'linear-gradient(160deg, #1A3A95 0%, #2E5BFF 55%, #6C63FF 120%)',
              border: '1px solid rgba(255,255,255,0.28)',
              boxShadow: '0 24px 60px rgba(20, 50, 160, 0.55), inset 0 1px 0 rgba(255,255,255,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ color: '#fff', fontWeight: 900, fontSize: 30, letterSpacing: '1.5px', textShadow: '0 2px 14px rgba(0,0,0,0.35)' }}>SYPH</span>
            </div>
          </div>
        </div>

        <div style={{ height: 24 }} />

        {/* Tagline */}
        <p className="anim-fade-up" style={{ textAlign: 'center', fontWeight: 800, fontSize: 13, color: 'rgba(255,255,255,0.85)', letterSpacing: '3px', margin: 0, textTransform: 'uppercase', animationDelay: '0.28s' }}>
          {tr('tagline', selectedLanguage)}
        </p>

        <div style={{ height: 16 }} />

        {/* Stat chips */}
        <div className="anim-fade-up" style={{ display: 'flex', gap: 8, justifyContent: 'center', animationDelay: '0.34s' }}>
          {['50+ Countries', '17+ Categories', '24/7 Live'].map((chip) => (
            <span key={chip} className="glass-card" style={{ borderRadius: 20, padding: '5px 12px', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.78)' }}>
              {chip}
            </span>
          ))}
        </div>

        <div style={{ height: 28 }} />

        {/* Google button */}
        <button onClick={handleGoogle} disabled={loading} className="btn-tap anim-fade-up" style={{
          width: '100%', height: 52, borderRadius: 26, border: 'none',
          background: '#fff', color: '#1a1a2e', fontWeight: 800, fontSize: 15,
          cursor: 'pointer', marginBottom: 12, opacity: loading ? 0.6 : 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          boxShadow: '0 10px 26px rgba(0,0,0,0.28)', animationDelay: '0.4s',
        }}>
          <GoogleIcon />
          {loading ? tr('loading', selectedLanguage) : tr('continueWithGoogle', selectedLanguage)}
        </button>

        {/* Divider */}
        <div className="anim-fade-up" style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0', animationDelay: '0.52s' }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.14)' }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', letterSpacing: '1px' }}>{tr('orWord', selectedLanguage)}</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.14)' }} />
        </div>

        {/* Login button */}
        <button onClick={() => router.push('/login')} className="btn-tap sweep anim-fade-up" style={{
          width: '100%', height: 52, borderRadius: 26, border: 'none',
          background: 'linear-gradient(135deg, #2E5BFF 0%, #6C63FF 100%)',
          color: '#fff', fontWeight: 800, fontSize: 15,
          cursor: 'pointer', marginBottom: 12,
          boxShadow: '0 14px 34px rgba(46,91,255,0.45)', animationDelay: '0.58s',
        }}>
          {tr('signIn', selectedLanguage)}
        </button>

        {/* Create Account */}
        <button onClick={() => router.push('/signup')} className="btn-tap glass-card anim-fade-up" style={{
          width: '100%', height: 52, borderRadius: 26,
          color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer',
          marginBottom: 12, animationDelay: '0.64s',
        }}>
          {tr('createAccount', selectedLanguage)}
        </button>

        {/* Guest link */}
        <div className="anim-fade-up" style={{ textAlign: 'center', animationDelay: '0.7s' }}>
          <button onClick={handleGuest} className="btn-tap" style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: 14, padding: '8px 14px',
            textDecoration: 'underline', textUnderlineOffset: 4,
          }}>
            {tr('continueAsGuest', selectedLanguage)} →
          </button>
        </div>

        <div style={{ height: 20 }} />

        {/* Trust trio */}
        <div className="anim-fade-up" style={{ display: 'flex', gap: 8, animationDelay: '0.76s' }}>
          {[
            { Icon: Lock, text: tr('securePrivate', selectedLanguage) },
            { Icon: MapPin, text: tr('nearbyListings', selectedLanguage) },
            { Icon: Zap, text: tr('browseInstantly', selectedLanguage) },
          ].map(({ Icon, text }, i) => (
            <div key={text} className="glass-card" style={{ flex: 1, borderRadius: 16, padding: '12px 8px', textAlign: 'center' }}>
              <div className="bob" style={{ animationDelay: `${i * 0.6}s` }}>
                <Icon size={18} color="#9DB8FF" />
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.72)', marginTop: 6, lineHeight: 1.3 }}>{text}</div>
            </div>
          ))}
        </div>

        <div style={{ height: 18 }} />

        {/* Legal */}
        <p className="anim-fade-up" style={{ textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontWeight: 600, fontSize: 12.5, lineHeight: 1.55, margin: 0, animationDelay: '0.82s' }}>
          By continuing you accept our{' '}
          <Link href="/terms" style={{ color: '#9DB8FF', fontWeight: 800 }}>Terms &amp; Conditions</Link>
          {' '}and acknowledge our{' '}
          <Link href="/privacy" style={{ color: '#9DB8FF', fontWeight: 800 }}>{tr('privacyPolicy', selectedLanguage)}</Link>.
        </p>

        <div style={{ height: 10 }} />
      </div>
    </div>
  );
}
