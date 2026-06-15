'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  X, LayoutGrid, DollarSign, Languages, User, Store,
  Bookmark, MessageCircle, Bell, FileText, HeadphonesIcon,
  Info, LogOut, ChevronRight, Check, Search,
} from 'lucide-react';
import { sanitizeText } from '@/lib/sanitize';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store';
import { CURRENCIES, getCurrencyForCountry, getCurrencySymbol } from '@/lib/currency';
import { LANGUAGES, RTL_LANGS } from '@/lib/i18n';
import { getSellerProfile } from '@/lib/firestore';

interface Props {
  open: boolean;
  onClose: () => void;
}

const CURRENCY_FLAGS: Record<string, string> = {
  USD: '🇺🇸', KES: '🇰🇪', NGN: '🇳🇬', ZAR: '🇿🇦', GHS: '🇬🇭',
  TZS: '🇹🇿', UGX: '🇺🇬', ETB: '🇪🇹', EGP: '🇪🇬', XOF: '🌍',
  MAD: '🇲🇦', EUR: '🇪🇺', GBP: '🇬🇧', RWF: '🇷🇼',
};

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
  sublabel,
  badge,
  destructive,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  sublabel?: string;
  badge?: React.ReactNode;
  destructive?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '11px 14px', borderRadius: 12, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', marginBottom: 2 }}
      onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
    >
      <Icon size={20} color={destructive ? '#ef4444' : '#6f7b8f'} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontWeight: 600, fontSize: 15, color: destructive ? '#ef4444' : '#1c2c52', display: 'block' }}>{label}</span>
        {sublabel && <span style={{ fontWeight: 600, fontSize: 11, color: '#9aa0b2', display: 'block', marginTop: 1 }}>{sublabel}</span>}
      </div>
      {badge}
      <ChevronRight size={16} color="#c4d4e8" />
    </button>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: '#1E4DD9', background: '#E3F0FF', borderRadius: 30, padding: '2px 8px', whiteSpace: 'nowrap' }}>
      {children}
    </span>
  );
}

// ── Auth Required Modal ────────────────────────────────────────────────────────

function AuthModal({ onClose, onSignup, onLogin }: { onClose: () => void; onSignup: () => void; onLogin: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(0,0,0,0.55)' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 24, overflow: 'hidden', width: '100%', maxWidth: 360 }} onClick={e => e.stopPropagation()}>
        <div style={{ background: 'linear-gradient(135deg, #0F2B6E, #1E4DD9)', padding: '28px 24px 24px', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, background: 'rgba(255,255,255,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 24 }}>🔒</div>
          <div style={{ color: '#fff', fontWeight: 900, fontSize: 20 }}>Sign In to Continue</div>
          <div style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600, fontSize: 13, marginTop: 6, lineHeight: 1.4 }}>This feature is for registered users only.</div>
        </div>
        <div style={{ padding: '20px 20px 8px' }}>
          <button onClick={onSignup} style={{ width: '100%', padding: '13px', background: '#1E4DD9', border: 'none', borderRadius: 14, color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', marginBottom: 10 }}>Create Account</button>
          <button onClick={onLogin} style={{ width: '100%', padding: '13px', background: 'transparent', border: '2px solid #1E4DD9', borderRadius: 14, color: '#1E4DD9', fontWeight: 800, fontSize: 15, cursor: 'pointer', marginBottom: 10 }}>Login</button>
          <button onClick={onClose} style={{ width: '100%', padding: '10px', background: 'none', border: 'none', color: '#9AA0B2', fontWeight: 600, fontSize: 13, cursor: 'pointer', marginBottom: 8 }}>Not now</button>
        </div>
      </div>
    </div>
  );
}

// ── Currency Picker Sheet ──────────────────────────────────────────────────────

function CurrencySheet({
  current,
  isAuto,
  country,
  onSelect,
  onAuto,
  onClose,
}: {
  current: string;
  isAuto: boolean;
  country: string;
  onSelect: (code: string) => void;
  onAuto: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const autoCurrency = getCurrencyForCountry(country);

  const filtered = CURRENCIES.filter(c => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.symbol.includes(q);
  });

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: '28px 28px 0 0', boxShadow: '0 -8px 32px rgba(0,0,0,0.15)', maxHeight: '90dvh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4 }}>
          <div style={{ width: 40, height: 4, background: '#E0E8F0', borderRadius: 2 }} />
        </div>

        <div style={{ padding: '16px 20px 12px' }}>
          <div style={{ fontWeight: 900, fontSize: 22, color: '#182033', marginBottom: 10 }}>Display Currency</div>
          {/* Info box */}
          <div style={{ background: '#EEF4FF', borderRadius: 14, padding: 12, display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 16 }}>
            <span style={{ color: '#1E4DD9', opacity: 0.7, fontSize: 16 }}>ℹ️</span>
            <span style={{ color: '#1E4DD9', fontWeight: 600, fontSize: 13, opacity: 0.9, lineHeight: 1.4 }}>
              Auto source: {country || 'Unknown'} → {autoCurrency}
            </span>
          </div>
          {/* Search */}
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <Search size={16} color="#9AA0B2" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search currency..."
              style={{ width: '100%', padding: '12px 12px 12px 36px', border: '1px solid #DCE7F5', borderRadius: 14, fontSize: 14, outline: 'none', background: '#F8FAFF', boxSizing: 'border-box', fontFamily: 'inherit' }}
              autoFocus
            />
          </div>
          {/* Auto option */}
          <CurrencyOption
            flag="⚙️"
            title="Auto"
            subtitle={`Use auto currency (${autoCurrency})`}
            selected={isAuto}
            onTap={() => { onAuto(); onClose(); }}
          />
          <div style={{ fontWeight: 800, fontSize: 11, color: '#9AA0B2', letterSpacing: '0.5px', margin: '12px 0 8px', paddingLeft: 4 }}>MANUAL SELECTION</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 32px' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#9AA0B2', fontWeight: 700 }}>No currencies found</div>
          ) : (
            filtered.map(c => (
              <CurrencyOption
                key={c.code}
                flag={CURRENCY_FLAGS[c.code] ?? '💱'}
                title={`${c.code} (${c.symbol})`}
                subtitle={`Display all prices in ${c.code}`}
                selected={!isAuto && current === c.code}
                onTap={() => { onSelect(c.code); onClose(); }}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function CurrencyOption({ flag, title, subtitle, selected, onTap }: { flag: string; title: string; subtitle: string; selected: boolean; onTap: () => void }) {
  return (
    <button
      onClick={onTap}
      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: 16, marginBottom: 8, borderRadius: 16, border: `${selected ? 2 : 1}px solid ${selected ? '#1E4DD9' : '#E0ECFF'}`, background: selected ? '#E3F0FF' : '#fff', cursor: 'pointer', textAlign: 'left' }}
    >
      <div style={{ width: 24, height: 24, borderRadius: '50%', background: selected ? '#1E4DD9' : 'transparent', border: `2px solid ${selected ? '#1E4DD9' : '#C4D4E8'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {selected && <Check size={14} color="#fff" />}
      </div>
      <span style={{ fontSize: 22 }}>{flag}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: selected ? '#1E4DD9' : '#1c2c52' }}>{title}</div>
        <div style={{ fontWeight: 600, fontSize: 12, color: selected ? '#1E4DD9' : '#9AA0B2', marginTop: 2 }}>{subtitle}</div>
      </div>
    </button>
  );
}

// ── Language Picker Sheet ──────────────────────────────────────────────────────

function LanguageSheet({
  current,
  onSelect,
  onClose,
}: {
  current: string;
  onSelect: (code: string) => void;
  onClose: () => void;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: '28px 28px 0 0', boxShadow: '0 -8px 32px rgba(0,0,0,0.15)', maxHeight: '90dvh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4 }}>
          <div style={{ width: 40, height: 4, background: '#E0E8F0', borderRadius: 2 }} />
        </div>

        <div style={{ padding: '16px 20px 12px' }}>
          <div style={{ fontWeight: 900, fontSize: 22, color: '#182033', marginBottom: 10 }}>Select Language</div>
          <div style={{ background: '#EEF4FF', borderRadius: 14, padding: 12, display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 16 }}>
            <span style={{ fontSize: 16 }}>🌐</span>
            <span style={{ color: '#1E4DD9', fontWeight: 600, fontSize: 13, opacity: 0.9, lineHeight: 1.4 }}>
              Some content may only be available in English. The language setting affects the app interface.
            </span>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 32px' }}>
          {LANGUAGES.map(lang => {
            const selected = current === lang.code;
            return (
              <button
                key={lang.code}
                onClick={() => { onSelect(lang.code); onClose(); }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: 16, marginBottom: 8, borderRadius: 16, border: `${selected ? 2 : 1}px solid ${selected ? '#1E4DD9' : '#E0ECFF'}`, background: selected ? '#E3F0FF' : '#fff', cursor: 'pointer', textAlign: 'left' }}
              >
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: selected ? '#1E4DD9' : 'transparent', border: `2px solid ${selected ? '#1E4DD9' : '#C4D4E8'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {selected && <Check size={14} color="#fff" />}
                </div>
                <span style={{ fontSize: 22 }}>{lang.flag}</span>
                <span style={{ fontWeight: 800, fontSize: 15, color: selected ? '#1E4DD9' : '#1c2c52' }}>{lang.nativeName}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main Drawer ────────────────────────────────────────────────────────────────

export default function MenuDrawer({ open, onClose }: Props) {
  const router = useRouter();
  const {
    user, setUser,
    selectedCurrency, isAutoCurrency, setManualCurrency, setAutoCurrency,
    selectedLanguage, setLanguage,
    sellerMode, setSellerMode,
    selectedCountry, homeCountry,
  } = useAppStore();
  const overlayRef = useRef<HTMLDivElement>(null);

  const [sheet, setSheet] = useState<'currency' | 'language' | null>(null);
  const [showAuth, setShowAuth] = useState(false);

  // Close on outside click (when no sheet open)
  useEffect(() => {
    if (!open || sheet) return;
    const handle = (e: MouseEvent) => {
      if (overlayRef.current === e.target) onClose();
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open, sheet, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = (open || showAuth) ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open, showAuth]);

  // Apply RTL when language changes
  useEffect(() => {
    document.documentElement.dir = RTL_LANGS.has(selectedLanguage) ? 'rtl' : 'ltr';
  }, [selectedLanguage]);

  const displayName = user?.displayName ?? 'User';
  const isGuest = !user;

  const nav = (path: string) => { onClose(); router.push(path); };

  const requireAuth = (path: string) => {
    if (!isGuest) { nav(path); return; }
    onClose();
    setTimeout(() => setShowAuth(true), 50);
  };

  const handleSellerMode = async () => {
    if (isGuest) {
      onClose();
      setTimeout(() => setShowAuth(true), 50);
      return;
    }
    onClose();
    setSellerMode(true);
    if (user) {
      const profile = await getSellerProfile(user.uid).catch(() => null);
      router.push(profile ? '/dashboard' : '/dashboard/setup');
    }
  };

  const handleConsumerMode = () => {
    setSellerMode(false);
    nav('/home');
  };

  const handleLogout = async () => {
    onClose();
    try {
      await supabase.auth.signOut();
      setUser(null);
      router.replace('/home');
    } catch {
      toast.error('Logout failed.');
    }
  };

  const handleLanguageSelect = (code: string) => {
    setLanguage(code);
  };

  // Currency badge label — auto currency is anchored to home (GPS/first setup),
  // not the country being browsed.
  const currencyAnchor = homeCountry || selectedCountry;
  const autoCurrency = getCurrencyForCountry(currencyAnchor);
  const currencyBadgeText = isAutoCurrency ? `${autoCurrency} · Auto` : `${selectedCurrency} · Manual`;
  const currencySubLabel = isAutoCurrency
    ? `Auto: ${currencyAnchor || 'unknown'}`
    : 'Manual override';

  // Language badge
  const langInfo = LANGUAGES.find(l => l.code === selectedLanguage) ?? LANGUAGES[0];
  const langBadgeText = `${langInfo.flag} ${langInfo.nativeName}`;

  return (
    <>
      {/* Dim overlay */}
      <div
        ref={overlayRef}
        onClick={() => { if (!sheet) onClose(); else setSheet(null); }}
        style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.45)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
        }}
      />

      {/* Drawer panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 300, zIndex: 101,
        background: '#fff',
        borderRadius: '24px 0 0 24px',
        display: 'flex', flexDirection: 'column',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
        maxWidth: '85vw',
      }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #0F2B6E 0%, #1E4DD9 100%)', borderRadius: '24px 0 0 0', padding: '24px 20px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 14, padding: '6px 12px' }}>
            <span style={{ color: '#fff', fontWeight: 900, fontSize: 18, letterSpacing: 1 }}>SYPH</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.5)', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={() => requireAuth('/profile')}>
              {user?.photoUrl ? (
                <img src={user.photoUrl} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <span style={{ color: '#1E4DD9', fontWeight: 900, fontSize: 14 }}>{initials(displayName)}</span>
              )}
            </div>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, padding: 6, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <X size={18} color="#fff" />
            </button>
          </div>
        </div>

        {/* Greeting */}
        <div style={{ padding: '14px 20px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 12, color: '#9aa0b2', fontWeight: 600, margin: 0 }}>Hello,</p>
            <p style={{ fontSize: 18, fontWeight: 900, color: '#1c2c52', margin: 0 }}>
              {isGuest ? 'Guest' : sanitizeText(displayName).split(' ')[0]}
            </p>
          </div>
          {!isGuest && (
            <span style={{ fontSize: 10, fontWeight: 700, color: '#1E4DD9', background: '#E3F0FF', borderRadius: 30, padding: '3px 10px' }}>MEMBER</span>
          )}
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '0 16px' }} />

        {/* Nav content */}
        <div style={{ flex: 1, padding: '0 8px 20px', overflowY: 'auto' }}>

          {/* MODE */}
          <Section label="Mode" />
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 30, padding: 4, margin: '4px 8px' }}>
            <button
              onClick={handleConsumerMode}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', borderRadius: 26, border: 'none', cursor: 'pointer', background: !sellerMode ? '#fff' : 'none', boxShadow: !sellerMode ? '0 2px 8px rgba(30,77,217,0.12)' : 'none', fontWeight: 700, fontSize: 13, color: !sellerMode ? '#1E4DD9' : '#6f7b8f' }}
            >
              <User size={16} color={!sellerMode ? '#1E4DD9' : '#6f7b8f'} /> Consumer
            </button>
            <button
              onClick={handleSellerMode}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', borderRadius: 26, border: 'none', cursor: 'pointer', background: sellerMode ? '#fff' : 'none', boxShadow: sellerMode ? '0 2px 8px rgba(30,77,217,0.12)' : 'none', fontWeight: 700, fontSize: 13, color: sellerMode ? '#1E4DD9' : '#6f7b8f' }}
            >
              <Store size={16} color={sellerMode ? '#1E4DD9' : '#6f7b8f'} /> Seller
            </button>
          </div>

          <Section label="Browse" />
          <Item icon={LayoutGrid} label="Categories" onClick={() => nav('/categories')} />
          <Item
            icon={DollarSign}
            label="Display Currency"
            sublabel={currencySubLabel}
            badge={<Badge>{currencyBadgeText}</Badge>}
            onClick={() => setSheet('currency')}
          />
          <Item
            icon={Languages}
            label="Language"
            badge={<Badge>{langBadgeText}</Badge>}
            onClick={() => setSheet('language')}
          />

          <Section label="Your Space" />
          <Item icon={Bookmark} label="Saved Items" onClick={() => requireAuth('/saved')} />
          <Item icon={MessageCircle} label="Messages" onClick={() => requireAuth('/messages')} />
          <Item icon={Bell} label="Notifications" onClick={() => requireAuth('/notifications')} />

          <Section label="More" />
          <Item icon={FileText} label="Terms & Conditions" onClick={() => nav('/terms')} />
          <Item icon={HeadphonesIcon} label="Contact Support" onClick={() => requireAuth('/support')} />
          <Item icon={Info} label="About SYPH" onClick={() => nav('/about')} />

          {/* Logout — only for signed-in users, inside scroll area */}
          {!isGuest && (
            <div style={{ margin: '16px 8px 0', background: '#fff5f5', borderRadius: 14, overflow: 'hidden' }}>
              <Item icon={LogOut} label="Logout" destructive onClick={handleLogout} />
            </div>
          )}
        </div>

        {/* ── Fixed bottom auth section ── */}
        <div style={{
          borderTop: '1px solid #f1f5f9',
          padding: '14px 16px 20px',
          background: '#fff',
          flexShrink: 0,
        }}>
          {isGuest ? (
            <div>
              <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: '#9aa0b2', textAlign: 'center', letterSpacing: '0.3px' }}>
                Join millions buying &amp; selling on SYPH
              </p>
              <button
                onClick={() => nav('/welcome')}
                style={{
                  width: '100%', padding: '13px 0', borderRadius: 14, border: 'none',
                  background: 'linear-gradient(135deg, #0F2B6E 0%, #1E4DD9 100%)',
                  color: '#fff', fontWeight: 900, fontSize: 15, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <User size={18} color="#fff" />
                Sign In / Create Account
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 800, fontSize: 13, color: '#1c2c52', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {displayName}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: '#9aa0b2', fontWeight: 600 }}>Signed in</p>
              </div>
              <button
                onClick={() => requireAuth('/profile')}
                style={{ padding: '8px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: '#fff', color: '#1E4DD9', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
              >
                Profile
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Currency sheet — rendered over drawer */}
      {open && sheet === 'currency' && (
        <div style={{ zIndex: 102 }}>
          <CurrencySheet
            current={selectedCurrency}
            isAuto={isAutoCurrency}
            country={currencyAnchor}
            onSelect={(code) => setManualCurrency(code)}
            onAuto={() => setAutoCurrency()}
            onClose={() => setSheet(null)}
          />
        </div>
      )}

      {/* Language sheet — rendered over drawer */}
      {open && sheet === 'language' && (
        <div style={{ zIndex: 102 }}>
          <LanguageSheet
            current={selectedLanguage}
            onSelect={handleLanguageSelect}
            onClose={() => setSheet(null)}
          />
        </div>
      )}

      {/* Auth required modal — independent of drawer state */}
      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          onSignup={() => { setShowAuth(false); router.push('/signup'); }}
          onLogin={() => { setShowAuth(false); router.push('/login'); }}
        />
      )}
    </>
  );
}
