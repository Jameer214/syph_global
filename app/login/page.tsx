'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { useAppStore } from '@/store';
import { auth } from '@/lib/firebase';
import { createOrUpdateUserProfile } from '@/lib/firestore';

export default function LoginPage() {
  const router = useRouter();
  const { setUser, locationSet, selectedCountry } = useAppStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error('Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      const firebaseUser = result.user;
      const profile = {
        uid: firebaseUser.uid,
        email: firebaseUser.email ?? '',
        displayName: firebaseUser.displayName ?? '',
        photoUrl: firebaseUser.photoURL ?? undefined,
      };
      await createOrUpdateUserProfile(profile);
      setUser(profile);
      afterAuth();
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        toast.error('Incorrect email or password.');
      } else if (code === 'auth/too-many-requests') {
        toast.error('Too many attempts. Please try again later.');
      } else {
        toast.error('Login failed. Please try again.');
      }
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
      await sendPasswordResetEmail(auth, resetEmail.trim());
      toast.success('Password reset email sent! Check your inbox.');
      setShowForgot(false);
      setResetEmail('');
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
    <div style={{ minHeight: '100dvh', background: '#D6ECFF', display: 'flex', flexDirection: 'column' }}>
      <div style={{ maxWidth: 520, margin: '0 auto', width: '100%', padding: '20px 20px 32px' }}>
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
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: '#132A66' }}>
              Login to{' '}
              <span style={{ color: '#2E5BFF' }}>SYPH</span>
            </h1>
            <p style={{ margin: '8px 0 0', color: '#6B7A99', fontSize: 14, fontWeight: 500 }}>
              Welcome back! Sign in to your account.
            </p>
          </div>

          <form onSubmit={handleLogin}>
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
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <Lock size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
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
                Forgot Password?
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
              {loading ? 'Signing in…' : 'Login'}
            </button>
          </form>

          <div style={{ height: 20 }} />

          {/* Sign up link */}
          <p style={{ textAlign: 'center', margin: 0, color: '#6B7A99', fontSize: 14, fontWeight: 500 }}>
            Don&apos;t have an account?{' '}
            <Link href="/signup" style={{ color: '#2E5BFF', fontWeight: 800, textDecoration: 'none' }}>
              Create one
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
                  placeholder="Email address"
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
                {resetLoading ? 'Sending…' : 'Send Reset Email'}
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
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
