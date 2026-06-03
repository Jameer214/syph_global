'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  X, LayoutGrid, DollarSign, Languages, User, Store,
  Bookmark, MessageCircle, Bell, FileText, HeadphonesIcon,
  Info, LogOut, ChevronRight,
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import toast from 'react-hot-toast';
import { auth } from '@/lib/firebase';
import { useAppStore } from '@/store';

interface Props {
  open: boolean;
  onClose: () => void;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (!parts.length) return 'U';
  if (parts.length === 1) return (parts[0][0] ?? 'U').toUpperCase();
  return ((parts[0][0] ?? '') + (parts[1][0] ?? '')).toUpperCase();
}

function Section({ label }: { label: string }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 800, color: '#9aa0b2', letterSpacing: '0.5px', padding: '0 12px', marginTop: 20, marginBottom: 4 }}>
      {label.toUpperCase()}
    </p>
  );
}

function Item({
  icon: Icon,
  label,
  badge,
  destructive,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  badge?: React.ReactNode;
  destructive?: boolean;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 14,
      padding: '11px 14px', borderRadius: 12, border: 'none', background: 'none',
      cursor: 'pointer', textAlign: 'left', marginBottom: 2,
    }}
    onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
    >
      <Icon size={20} color={destructive ? '#ef4444' : '#6f7b8f'} />
      <span style={{ flex: 1, fontWeight: 600, fontSize: 15, color: destructive ? '#ef4444' : '#1c2c52' }}>{label}</span>
      {badge}
      <ChevronRight size={16} color="#c4d4e8" />
    </button>
  );
}

export default function MenuDrawer({ open, onClose }: Props) {
  const router = useRouter();
  const { user, setUser } = useAppStore();
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (overlayRef.current === e.target) onClose();
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const displayName = user?.displayName ?? 'User';
  const isGuest = !user;

  const nav = (path: string) => { onClose(); router.push(path); };

  const handleLogout = async () => {
    onClose();
    try {
      await signOut(auth);
      setUser(null);
      router.replace('/welcome');
    } catch {
      toast.error('Logout failed.');
    }
  };

  return (
    <>
      {/* Overlay */}
      <div
        ref={overlayRef}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.45)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
        }}
      />

      {/* Drawer panel — slides from right */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 300, zIndex: 101,
        background: '#fff',
        borderRadius: '24px 0 0 24px',
        display: 'flex', flexDirection: 'column',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
        overflowY: 'auto',
        maxWidth: '85vw',
      }}>

        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #0F2B6E 0%, #1E4DD9 100%)',
          borderRadius: '24px 0 0 0',
          padding: '24px 20px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.15)', borderRadius: 14,
            padding: '6px 12px',
          }}>
            <span style={{ color: '#fff', fontWeight: 900, fontSize: 18, letterSpacing: 1 }}>SYPH</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Avatar */}
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.5)',
              background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }} onClick={() => nav('/profile')}>
              {user?.photoUrl ? (
                <img src={user.photoUrl} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <span style={{ color: '#1E4DD9', fontWeight: 900, fontSize: 14 }}>
                  {initials(displayName)}
                </span>
              )}
            </div>

            {/* Close */}
            <button onClick={onClose} style={{
              background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10,
              padding: 6, cursor: 'pointer', display: 'flex', alignItems: 'center',
            }}>
              <X size={18} color="#fff" />
            </button>
          </div>
        </div>

        {/* Greeting */}
        <div style={{ padding: '14px 20px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 12, color: '#9aa0b2', fontWeight: 600, margin: 0 }}>Hello,</p>
            <p style={{ fontSize: 18, fontWeight: 900, color: '#1c2c52', margin: 0 }}>
              {isGuest ? 'Guest' : displayName.split(' ')[0]}
            </p>
          </div>
          {!isGuest && (
            <span style={{
              fontSize: 10, fontWeight: 700, color: '#1E4DD9',
              background: '#E3F0FF', borderRadius: 30, padding: '3px 10px',
            }}>MEMBER</span>
          )}
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '0 16px' }} />

        {/* Nav content */}
        <div style={{ flex: 1, padding: '0 8px 20px', overflowY: 'auto' }}>

          {/* MODE: Consumer / Seller toggle */}
          <Section label="Mode" />
          <div style={{
            display: 'flex', background: '#f1f5f9', borderRadius: 30,
            padding: 4, margin: '4px 8px',
          }}>
            <button onClick={() => nav('/home')} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '10px 0', borderRadius: 26, border: 'none', cursor: 'pointer',
              background: '#fff', boxShadow: '0 2px 8px rgba(30,77,217,0.12)',
              fontWeight: 700, fontSize: 13, color: '#1E4DD9',
            }}>
              <User size={16} color="#1E4DD9" /> Consumer
            </button>
            <button onClick={() => nav('/dashboard')} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '10px 0', borderRadius: 26, border: 'none', cursor: 'pointer',
              background: 'none', fontWeight: 700, fontSize: 13, color: '#6f7b8f',
            }}>
              <Store size={16} color="#6f7b8f" /> Seller
            </button>
          </div>

          <Section label="Browse" />
          <Item icon={LayoutGrid} label="Categories" onClick={() => nav('/categories')} />
          <Item icon={DollarSign} label="Display Currency" badge={
            <span style={{ fontSize: 10, fontWeight: 700, color: '#1E4DD9', background: '#E3F0FF', borderRadius: 30, padding: '2px 8px' }}>USD</span>
          } onClick={() => {}} />
          <Item icon={Languages} label="Language" badge={
            <span style={{ fontSize: 10, fontWeight: 700, color: '#1E4DD9', background: '#E3F0FF', borderRadius: 30, padding: '2px 8px' }}>EN</span>
          } onClick={() => {}} />

          <Section label="Your Space" />
          <Item icon={Bookmark} label="Saved Items" onClick={() => nav('/saved')} />
          <Item icon={MessageCircle} label="Messages" onClick={() => nav('/messages')} />
          <Item icon={Bell} label="Notifications" onClick={() => nav('/notifications')} />

          <Section label="More" />
          <Item icon={FileText} label="Terms & Conditions" onClick={() => nav('/terms')} />
          <Item icon={HeadphonesIcon} label="Contact Support" onClick={() => nav('/support')} />
          <Item icon={Info} label="About SYPH" onClick={() => nav('/about')} />

          {/* Logout */}
          <div style={{ margin: '16px 8px 0', background: '#fff5f5', borderRadius: 14, overflow: 'hidden' }}>
            <Item
              icon={isGuest ? X : LogOut}
              label={isGuest ? 'Exit Guest Mode' : 'Logout'}
              destructive
              onClick={isGuest ? () => { onClose(); router.replace('/welcome'); } : handleLogout}
            />
          </div>

          {/* Auth CTA for guests */}
          {isGuest && (
            <div style={{ margin: '12px 8px 0', background: 'linear-gradient(135deg, #0F2B6E, #1E4DD9)', borderRadius: 16, padding: '16px' }}>
              <p style={{ color: '#fff', fontWeight: 800, fontSize: 15, margin: '0 0 12px' }}>Join SYPH</p>
              <button onClick={() => nav('/signup')} style={{
                width: '100%', padding: '10px 0', borderRadius: 12, border: 'none',
                background: '#fff', color: '#1E4DD9', fontWeight: 800, fontSize: 14, cursor: 'pointer', marginBottom: 8,
              }}>Create Account</button>
              <button onClick={() => nav('/login')} style={{
                width: '100%', padding: '10px 0', borderRadius: 12,
                border: '2px solid rgba(255,255,255,0.5)', background: 'none',
                color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer',
              }}>Login</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
