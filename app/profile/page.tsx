'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Camera, Edit3, Lock, LogOut, Store, Settings,
  Sun, Moon, MapPin, ChevronRight, User,
} from 'lucide-react';
import { onAuthStateChanged, signOut, updateProfile, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import toast from 'react-hot-toast';
import { auth, db, storage } from '@/lib/firebase';
import BottomNav from '@/components/BottomNav';
import { useAppStore } from '@/store';
import type { UserProfile, SellerProfile } from '@/types';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return (parts[0][0] ?? 'U').toUpperCase();
  return ((parts[0][0] ?? '') + (parts[1][0] ?? '')).toUpperCase();
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, setUser } = useAppStore();
  const [authUser, setAuthUser] = useState<{ uid: string; displayName: string | null; email: string | null; photoURL: string | null } | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [isDark, setIsDark] = useState(false);

  // edit name modal
  const [showEditName, setShowEditName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);

  // change password modal
  const [showChangePw, setShowChangePw] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [pwDone, setPwDone] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { setAuthUser(null); setLoading(false); return; }
      setAuthUser({ uid: u.uid, displayName: u.displayName, email: u.email, photoURL: u.photoURL });

      // load user profile
      const snap = await getDoc(doc(db, 'users', u.uid));
      if (snap.exists()) setProfile(snap.data() as UserProfile);

      // load seller profile
      const sellerSnap = await getDoc(doc(db, 'sellers', u.uid));
      if (sellerSnap.exists()) setSeller(sellerSnap.data() as SellerProfile);

      setLoading(false);
    });
    return unsub;
  }, []);

  async function handlePhotoUpload(file: File) {
    if (!authUser) return;
    setUploadingPhoto(true);
    try {
      const sRef = storageRef(storage, `profile_photos/${authUser.uid}/profile_${Date.now()}.jpg`);
      await uploadBytes(sRef, file);
      const url = await getDownloadURL(sRef);
      await updateProfile(auth.currentUser!, { photoURL: url });
      await setDoc(doc(db, 'users', authUser.uid), { photoUrl: url }, { merge: true });
      setAuthUser((prev) => prev ? { ...prev, photoURL: url } : null);
      toast.success('Profile photo updated!');
    } catch (e) {
      toast.error('Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function saveName() {
    if (!authUser || !nameInput.trim()) return;
    setSavingName(true);
    try {
      await updateProfile(auth.currentUser!, { displayName: nameInput.trim() });
      await setDoc(doc(db, 'users', authUser.uid), { displayName: nameInput.trim(), updatedAt: serverTimestamp() }, { merge: true });
      setAuthUser((prev) => prev ? { ...prev, displayName: nameInput.trim() } : null);
      toast.success('Name updated!');
      setShowEditName(false);
    } catch (e) {
      toast.error('Failed to update name');
    } finally {
      setSavingName(false);
    }
  }

  async function changePassword() {
    setPwError('');
    if (!currentPw || !newPw || !confirmPw) { setPwError('All fields are required.'); return; }
    if (newPw.length < 6) { setPwError('New password must be at least 6 characters.'); return; }
    if (newPw !== confirmPw) { setPwError('Passwords do not match.'); return; }
    setSavingPw(true);
    try {
      const u = auth.currentUser!;
      const cred = EmailAuthProvider.credential(u.email!, currentPw);
      await reauthenticateWithCredential(u, cred);
      await updatePassword(u, newPw);
      setPwDone(true);
    } catch (e: unknown) {
      const msg = (e as Error).message ?? 'Failed to change password';
      setPwError(msg.replace('Firebase: ', ''));
    } finally {
      setSavingPw(false);
    }
  }

  async function logout() {
    await signOut(auth);
    setUser(null);
    router.push('/welcome');
  }

  const displayName = profile?.displayName || authUser?.displayName || 'User';
  const email = profile?.email || authUser?.email || '';
  const photoURL = authUser?.photoURL || profile?.photoUrl || '';
  const country = profile?.country || '';
  const region = profile?.regionOrCity || '';
  const location = [region, country].filter(Boolean).join(', ');

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F0F4FF' }}>
        <div style={{ width: 36, height: 36, border: '3px solid #E8EDFF', borderTop: '3px solid #2E5BFF', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  // ─── GUEST VIEW ───────────────────────────────────────────────────────────

  if (!authUser) {
    return (
      <div style={{ minHeight: '100dvh', background: '#F0F4FF', maxWidth: 480, margin: '0 auto' }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

        {/* Guest header */}
        <div style={{
          background: 'linear-gradient(135deg, #4A5A72, #6F7B8F)',
          borderRadius: 28, margin: '52px 16px 0', padding: 24,
          display: 'flex', alignItems: 'center', gap: 16,
          boxShadow: '0 8px 20px rgba(74,90,114,0.30)',
        }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', border: '3px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <User size={34} color="#4A5A72" style={{ background: '#fff', borderRadius: '50%', padding: 4 }} />
          </div>
          <div>
            <div style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>Guest User</div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: 600 }}>guest@syph.app</div>
          </div>
        </div>

        <div style={{ padding: '16px 16px 90px' }}>
          {/* Sign up / Login cards */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <button onClick={() => router.push('/signup')} style={{
              flex: 1, background: '#fff', border: '1.5px solid rgba(30,77,217,0.20)',
              borderRadius: 20, padding: '18px 0', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              boxShadow: '0 4px 8px rgba(30,77,217,0.10)',
            }}>
              <User size={28} color="#1E4DD9" />
              <span style={{ color: '#1E4DD9', fontWeight: 700, fontSize: 14 }}>Sign Up</span>
            </button>
            <button onClick={() => router.push('/login')} style={{
              flex: 1, background: '#fff', border: '1.5px solid rgba(45,190,127,0.20)',
              borderRadius: 20, padding: '18px 0', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              boxShadow: '0 4px 8px rgba(45,190,127,0.10)',
            }}>
              <LogOut size={28} color="#2DBE7F" />
              <span style={{ color: '#2DBE7F', fontWeight: 700, fontSize: 14 }}>Log In</span>
            </button>
          </div>

          {/* Info card */}
          <div style={{
            background: '#E8F0FF', borderRadius: 18, padding: 16,
            border: '1px solid #D0E2FF', marginBottom: 12, display: 'flex', gap: 12,
          }}>
            <Settings size={20} color="#1E4DD9" style={{ flexShrink: 0, marginTop: 2 }} />
            <span style={{ color: '#1E2B45', fontWeight: 600, lineHeight: 1.4, fontSize: 14 }}>
              You are browsing as a guest. Create an account to save items, chat with sellers, and use seller mode.
            </span>
          </div>

          {/* Locked tiles */}
          {[
            { icon: <Camera size={22} color="#9AA0B2" />, title: 'Change profile photo' },
            { icon: <Edit3 size={22} color="#9AA0B2" />, title: 'Change display name' },
          ].map((tile, i) => (
            <div key={i} style={{
              background: '#fff', borderRadius: 18, marginBottom: 8, padding: '12px 16px',
              display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
            }} onClick={() => router.push('/signup')}>
              <div style={{ background: '#F5F5F5', borderRadius: 12, padding: 8 }}>{tile.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: '#1E2B45', fontSize: 15 }}>{tile.title}</div>
                <div style={{ color: '#9AA0B2', fontSize: 12, marginTop: 2 }}>Sign up to edit</div>
              </div>
              <Lock size={18} color="#9AA0B2" />
            </div>
          ))}

          {/* Dark mode toggle */}
          <div style={{
            background: '#fff', borderRadius: 18, padding: '14px 16px',
            border: '1px solid #DCE7F5', boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            display: 'flex', alignItems: 'center', gap: 16,
          }}>
            <div style={{ background: '#F0F4FF', borderRadius: 14, padding: 12 }}>
              {isDark ? <Moon size={24} color="#B0C4FF" /> : <Sun size={24} color="#1E4DD9" />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#1E2B45' }}>Dark Mode</div>
              <div style={{ fontSize: 13, color: '#6F7B8F', marginTop: 3 }}>{isDark ? 'Dark theme is on' : 'Light theme is on'}</div>
            </div>
            <label style={{ position: 'relative', width: 48, height: 28, cursor: 'pointer' }}>
              <input type="checkbox" checked={isDark} onChange={() => setIsDark(!isDark)} style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} />
              <span style={{
                position: 'absolute', inset: 0, borderRadius: 999,
                background: isDark ? '#2563EB' : '#DCE7F5', transition: '0.3s',
              }} />
              <span style={{
                position: 'absolute', left: isDark ? 22 : 2, top: 2,
                width: 24, height: 24, borderRadius: '50%', background: '#fff', transition: '0.3s',
                boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
              }} />
            </label>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ─── LOGGED-IN VIEW ───────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100dvh', background: '#F0F4FF', maxWidth: 480, margin: '0 auto' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Blue gradient header */}
      <div style={{
        background: 'linear-gradient(135deg, #0F2B6E 0%, #1E4DD9 60%, #4A7AFF 100%)',
        padding: '52px 20px 24px', position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative circles */}
        <div style={{ position: 'absolute', right: -20, top: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.10)' }} />
        <div style={{ position: 'absolute', left: -30, bottom: -30, width: 150, height: 150, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 20, position: 'relative' }}>
          {/* Avatar */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              border: '3px solid #fff', overflow: 'hidden',
              background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
            }}>
              {photoURL ? (
                <img src={photoURL} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ color: '#1E4DD9', fontWeight: 900, fontSize: 28 }}>{initials(displayName)}</span>
              )}
              {uploadingPhoto && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
                  <div style={{ width: 24, height: 24, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                </div>
              )}
            </div>
            {/* Edit overlay */}
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                position: 'absolute', bottom: 0, right: 0, width: 26, height: 26,
                background: '#1E4DD9', border: '2px solid #fff', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              }}>
              <Camera size={12} color="#fff" />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); }} />
          </div>

          {/* Name/email */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ color: '#fff', fontSize: 20, fontWeight: 800, letterSpacing: -0.3 }}>{displayName}</span>
              <span style={{
                background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)',
                color: '#fff', fontSize: 9, fontWeight: 800, letterSpacing: 0.5,
                borderRadius: 20, padding: '3px 8px',
              }}>MEMBER</span>
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: '4px 10px',
              marginTop: 8, display: 'inline-block',
            }}>
              <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>{email}</span>
            </div>
            {location && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
                <MapPin size={14} color="rgba(255,255,255,0.8)" />
                <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: 600 }}>{location}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 16px 90px' }}>

        {/* Seller trial if applicable */}
        {seller && (
          <div style={{
            background: '#E8F5E9', borderRadius: 18, padding: 16, marginBottom: 16,
            border: '1px solid rgba(46,155,85,0.5)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Settings size={20} color="#2E9B55" />
              <span style={{ color: '#2E9B55', fontWeight: 900, fontSize: 14 }}>
                Active seller account
              </span>
            </div>
            <div style={{ color: 'rgba(46,155,85,0.8)', fontSize: 12, fontWeight: 600, marginTop: 6 }}>
              Manage your listings from the Seller Dashboard.
            </div>
          </div>
        )}

        {/* Action tiles */}
        {[
          { icon: <Camera size={24} color="#1E4DD9" />, bg: '#E8F0FF', title: 'Change profile photo', sub: 'Tap to update your profile picture', action: () => fileInputRef.current?.click() },
          { icon: <Edit3 size={24} color="#2DBE7F" />, bg: '#E8F9F0', title: 'Change display name', sub: displayName, action: () => { setNameInput(displayName); setShowEditName(true); } },
          { icon: <Lock size={24} color="#E07A2F" />, bg: '#FFF0E8', title: 'Change password', sub: 'Update your account password', action: () => { setCurrentPw(''); setNewPw(''); setConfirmPw(''); setPwError(''); setPwDone(false); setShowChangePw(true); } },
          { icon: <Store size={24} color="#2E5BFF" />, bg: '#EEF2FF', title: 'Seller Dashboard', sub: 'Manage your listings and sales', action: () => router.push('/dashboard') },
        ].map((tile, i) => (
          <div key={i} onClick={tile.action} style={{
            background: '#fff', borderRadius: 18, marginBottom: 8, padding: 16, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 16,
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
          }}>
            <div style={{ background: tile.bg, borderRadius: 14, padding: 12 }}>{tile.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#1E2B45' }}>{tile.title}</div>
              <div style={{ color: '#6F7B8F', fontSize: 13, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tile.sub}</div>
            </div>
            <ChevronRight size={20} color="#6F7B8F" />
          </div>
        ))}

        {/* Dark mode toggle */}
        <div style={{
          background: '#fff', borderRadius: 18, padding: '14px 16px', marginBottom: 8,
          border: '1px solid #DCE7F5', boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <div style={{ background: '#F0F4FF', borderRadius: 14, padding: 12 }}>
            {isDark ? <Moon size={24} color="#B0C4FF" /> : <Sun size={24} color="#1E4DD9" />}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#1E2B45' }}>Dark Mode</div>
            <div style={{ fontSize: 13, color: '#6F7B8F', marginTop: 3 }}>{isDark ? 'Dark theme is on' : 'Light theme is on'}</div>
          </div>
          <label style={{ position: 'relative', width: 48, height: 28, cursor: 'pointer' }}>
            <input type="checkbox" checked={isDark} onChange={() => setIsDark(!isDark)} style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} />
            <span style={{ position: 'absolute', inset: 0, borderRadius: 999, background: isDark ? '#2563EB' : '#DCE7F5', transition: '0.3s' }} />
            <span style={{ position: 'absolute', left: isDark ? 22 : 2, top: 2, width: 24, height: 24, borderRadius: '50%', background: '#fff', transition: '0.3s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
          </label>
        </div>

        {/* Logout */}
        <button onClick={logout} style={{
          width: '100%', background: '#FFF0F0', border: '1px solid rgba(213,56,56,0.2)',
          borderRadius: 18, padding: '16px', color: '#D53838', fontWeight: 800,
          fontSize: 15, cursor: 'pointer', marginTop: 8,
        }}>
          Log Out
        </button>
      </div>

      {/* Edit Name Modal */}
      {showEditName && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 24, padding: 24, width: '100%', maxWidth: 360 }}>
            <div style={{ fontWeight: 800, fontSize: 18, color: '#1C2C52', marginBottom: 16 }}>Change Display Name</div>
            <input value={nameInput} onChange={(e) => setNameInput(e.target.value)}
              placeholder="Display name"
              style={{ width: '100%', padding: '12px 16px', border: '1px solid #E0E8F0', borderRadius: 14, fontSize: 15, background: '#F4F7FF', outline: 'none', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => setShowEditName(false)} style={{ flex: 1, padding: '12px', border: '1px solid #E0E8F0', borderRadius: 14, background: '#fff', color: '#6B7A99', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveName} disabled={savingName} style={{ flex: 1, padding: '12px', border: 'none', borderRadius: 14, background: '#1E4DD9', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>
                {savingName ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showChangePw && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 24, padding: 24, width: '100%', maxWidth: 360 }}>
            <div style={{ fontWeight: 800, fontSize: 18, color: '#1C2C52', marginBottom: 16 }}>Change Password</div>
            {pwDone ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 48 }}>✓</div>
                <div style={{ color: '#2DBE7F', fontWeight: 700, marginTop: 12 }}>Password updated successfully!</div>
                <button onClick={() => setShowChangePw(false)} style={{ marginTop: 20, padding: '10px 32px', background: '#2E5BFF', color: '#fff', border: 'none', borderRadius: 14, fontWeight: 800, cursor: 'pointer' }}>Done</button>
              </div>
            ) : (
              <>
                {[
                  { val: currentPw, set: setCurrentPw, placeholder: 'Current password' },
                  { val: newPw, set: setNewPw, placeholder: 'New password (min 6 chars)' },
                  { val: confirmPw, set: setConfirmPw, placeholder: 'Confirm new password' },
                ].map((f, i) => (
                  <input key={i} type="password" value={f.val} onChange={(e) => f.set(e.target.value)}
                    placeholder={f.placeholder}
                    style={{ width: '100%', padding: '12px 16px', border: '1px solid #E0E8F0', borderRadius: 14, fontSize: 15, background: '#F4F7FF', outline: 'none', marginBottom: 10, boxSizing: 'border-box' }} />
                ))}
                {pwError && <div style={{ color: '#E53935', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{pwError}</div>}
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button onClick={() => setShowChangePw(false)} style={{ flex: 1, padding: '12px', border: '1px solid #E0E8F0', borderRadius: 14, background: '#fff', color: '#6B7A99', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={changePassword} disabled={savingPw} style={{ flex: 1, padding: '12px', border: 'none', borderRadius: 14, background: '#E07A2F', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>
                    {savingPw ? 'Updating…' : 'Update Password'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
