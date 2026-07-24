'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { checkRateLimit } from '@/lib/rateLimit';
import { useAppStore } from '@/store';
import { tr, getDir } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { createOrUpdateUserProfile } from '@/lib/firestore';

export default function LoginPage() {
  const router = useRouter();
  const { setUser, locationSet, selectedCountry, selectedLanguage } = useAppStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Forgot password modal
  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

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
        setGoogleLoading(true);
        processUser(session.user).finally(() => setGoogleLoading(false));
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: typeof window !== 'undefined' ? window.location.href : undefined },
      });
      if (error) {
        toast.error('Google sign-in failed. Please try again.');
        setGoogleLoading(false);
      }
    } catch {
      toast.error('Google sign-in failed. Please try again.');
      setGoogleLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error('Please enter your email and password.');
      return;
    }
    if (!checkRateLimit(`login:${email.trim()}`, 5, 60000)) {
      toast.error('Too many login attempts. Please wait a minute and try again.');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error || !data.user) {
        if (error?.message?.toLowerCase().includes('invalid')) {
          toast.error('Incorrect email or password.');
        } else if (error?.message?.toLowerCase().includes('too many')) {
          toast.error('Too many attempts. Please try again later.');
        } else {
          toast.error('Login failed. Please try again.');
        }
        return;
      }
      const profile = {
        uid: data.user.id,
        email: data.user.email ?? '',
        displayName: data.user.user_metadata?.full_name ?? data.user.email?.split('@')[0] ?? '',
        photoUrl: data.user.user_metadata?.avatar_url ?? undefined,
      };
      await createOrUpdateUserProfile(profile).catch(() => {}); // profile row is secondary; never block a valid session
      setUser(profile);
      afterAuth();
    } catch {
      toast.error('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      toast.error('Please enter your email address.');
      return;
    }
    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim());
      if (error) {
        toast.error('Failed to send reset email. Please check the address.');
      } else {
        toast.success('Password reset email sent! Check your inbox.');
        setShowForgot(false);
        setResetEmail('');
      }
    } catch {
      toast.error('Failed to send reset email. Please check the address.');
    } finally {
      setResetLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 52, borderRadius: 14,
    border: '1.5px solid #e2e8f0', background: '#f8faff',
    paddingLeft: 46, paddingRight: 16, fontSize: 15, fontWeight: 500,
    color: '#1a1a2e', outline: 'none',
  };

  return (
    <div dir={getDir(selectedLanguage)} style={{ minHeight: '100dvh', background: '#D6ECFF', display: 'flex', flexDirection: 'column' }}>
      <div style={{ maxWidth: 520, margin: '0 auto', width: '100%', padding: '20px 20px 32px' }}>
        {/* Back button */}
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0', display: 'flex', alignItems: 'center', gap: 6, color: '#132A66', fontWeight: 700, fontSize: 15 }}
        >
          <ArrowLeft size={20} />
          {tr('back', selectedLanguage)}
        </button>

        <div style={{ height: 16 }} />

        {/* Card */}
        <div style={{ background: '#fff', borderRadius: 24, padding: '28px 24px', boxShadow: '0 4px 24px rgba(0,0,0,0.07)' }}>
          {/* Title */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: '#132A66' }}>
              Login to{' '}
              <span style={{ color: '#2E5BFF' }}>SYPH</span>
            </h1>
            <p style={{ margin: '8px 0 0', color: '#6B7A99', fontSize: 14, fontWeight: 500 }}>
              Welcome back! Sign in to your account.
            </p>
          </div>

          {/* Google sign-in */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={googleLoading || loading}
            style={{
              width: '100%', height: 52, borderRadius: 26, border: '1.5px solid #e2e8f0',
              background: '#fff', color: '#1a1a2e', fontWeight: 800, fontSize: 15,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 10, marginBottom: 20, opacity: (googleLoading || loading) ? 0.7 : 1,
            }}
          >
            {/* Google G logo */}
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            {googleLoading ? tr('loading', selectedLanguage) : tr('continueWithGoogle', selectedLanguage)}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
            <span style={{ color: '#9ca3af', fontWeight: 600, fontSize: 13 }}>or</span>
            <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
          </div>

          <form onSubmit={handleLogin}>
            {/* Email */}
            <div style={{ position: 'relative', marginBottom: 14 }}>
              <Mail size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={tr('emailField', selectedLanguage)}
                autoComplete="email"
                style={inputStyle}
              />
            </div>

            {/* Password */}
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <Lock size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={tr('passwordField', selectedLanguage)}
                autoComplete="current-password"
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

            {/* Forgot password */}
            <div style={{ textAlign: 'right', marginBottom: 22 }}>
              <button
                type="button"
                onClick={() => setShowForgot(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2E5BFF', fontWeight: 700, fontSize: 13 }}
              >
                {tr('forgotPassword', selectedLanguage)}
              </button>
            </div>

            {/* Login button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', height: 52, borderRadius: 26, border: 'none',
                background: '#2E5BFF', color: '#fff', fontWeight: 800, fontSize: 16,
                cursor: 'pointer', opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? tr('loading', selectedLanguage) : tr('signIn', selectedLanguage)}
            </button>
          </form>

          <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 8 }}>
            By continuing, you agree to our{' '}
            <a href="/terms" style={{ color: '#2E5BFF', textDecoration: 'none' }}>Terms</a>
            {' '}and{' '}
            <a href="/privacy" style={{ color: '#2E5BFF', textDecoration: 'none' }}>Privacy Policy</a>.
          </p>

          <div style={{ height: 20 }} />

          {/* Sign up link */}
          <p style={{ textAlign: 'center', margin: 0, color: '#6B7A99', fontSize: 14, fontWeight: 500 }}>
            {tr('dontHaveAccount', selectedLanguage)}{' '}
            <Link href="/signup" style={{ color: '#2E5BFF', fontWeight: 800, textDecoration: 'none' }}>
              {tr('createAccount', selectedLanguage)}
            </Link>
          </p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgot && (
        <div
          onClick={() => setShowForgot(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100, padding: '0 20px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 24, padding: '28px 24px', width: '100%', maxWidth: 420 }}
          >
            <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 900, color: '#132A66' }}>Reset Password</h2>
            <p style={{ margin: '0 0 20px', color: '#6B7A99', fontSize: 14 }}>
              Enter your email and we&apos;ll send a reset link.
            </p>
            <form onSubmit={handleResetPassword}>
              <div style={{ position: 'relative', marginBottom: 16 }}>
                <Mail size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder={tr('emailField', selectedLanguage)}
                  style={{
                    width: '100%', height: 50, borderRadius: 14,
                    border: '1.5px solid #e2e8f0', background: '#f8faff',
                    paddingLeft: 46, paddingRight: 16, fontSize: 15, fontWeight: 500,
                    color: '#1a1a2e', outline: 'none',
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={resetLoading}
                style={{
                  width: '100%', height: 50, borderRadius: 26, border: 'none',
                  background: '#2E5BFF', color: '#fff', fontWeight: 800, fontSize: 15,
                  cursor: 'pointer', opacity: resetLoading ? 0.7 : 1,
                }}
              >
                {resetLoading ? tr('loading', selectedLanguage) : tr('forgotPassword', selectedLanguage)}
              </button>
            </form>
            <button
              onClick={() => setShowForgot(false)}
              style={{
                width: '100%', height: 44, borderRadius: 26, border: 'none',
                background: 'none', color: '#6B7A99', fontWeight: 700, fontSize: 14,
                cursor: 'pointer', marginTop: 10,
              }}
            >
              {tr('cancel', selectedLanguage)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
