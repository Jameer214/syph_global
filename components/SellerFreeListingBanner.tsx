'use client';
// One-shot notice pushed by admin (Free Listings Control) to every seller's
// dashboard — web port of the SYPH app's SellerFreeListingBanner. Reads
// admin_settings['payment_methods'].pricing.listItem.sellerBanner
// { enabled, id, title, message, type }.
//
// Auto-delete is per-seller, per-device: the first time this device sees a
// given banner `id` we store the timestamp in localStorage and the banner
// disappears 6 minutes later (or immediately, if that window already elapsed
// across reloads). A new `id` from admin resets the timer so a re-pushed
// banner shows again.
import { useEffect, useState } from 'react';
import { Info, AlertTriangle, CheckCircle2, XCircle, X } from 'lucide-react';
import { getListItemPricing } from '@/lib/adminSettings';

const PREFIX = 'free_listing_banner_seen_';
const AUTO_DELETE_MS = 6 * 60 * 1000;

const STYLES: Record<string, { color: string; Icon: typeof Info }> = {
  warning: { color: '#F59E0B', Icon: AlertTriangle },
  success: { color: '#2DBE7F', Icon: CheckCircle2 },
  error: { color: '#E53935', Icon: XCircle },
  info: { color: '#2F6BFF', Icon: Info },
};

export default function SellerFreeListingBanner() {
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('info');

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    (async () => {
      const { sellerBanner: b } = await getListItemPricing();
      if (cancelled) return;
      if (!b.enabled || !b.id || (!b.title && !b.message)) return;

      try {
        const key = `${PREFIX}${b.id}`;
        // Keep storage tidy: drop first-seen markers for older banner ids.
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (k && k.startsWith(PREFIX) && k !== key) localStorage.removeItem(k);
        }

        const now = Date.now();
        const firstSeen = parseInt(localStorage.getItem(key) ?? '', 10);
        let remaining = AUTO_DELETE_MS;
        if (Number.isFinite(firstSeen)) {
          const elapsed = now - firstSeen;
          if (elapsed >= AUTO_DELETE_MS) return; // already expired
          remaining = AUTO_DELETE_MS - elapsed;
        } else {
          localStorage.setItem(key, String(now));
        }

        setTitle(b.title);
        setMessage(b.message);
        setType(b.type);
        setVisible(true);
        timer = setTimeout(() => setVisible(false), remaining);
      } catch {
        /* localStorage unavailable — skip */
      }
    })();

    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, []);

  if (!visible) return null;
  const s = STYLES[type] ?? STYLES.info;
  const Icon = s.Icon;

  return (
    <div style={{
      marginBottom: 14, padding: '12px 8px 12px 14px',
      background: `${s.color}1A`, border: `1px solid ${s.color}4D`, borderRadius: 14,
      display: 'flex', alignItems: 'flex-start', gap: 10,
    }}>
      <Icon size={20} color={s.color} style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && <div style={{ color: s.color, fontWeight: 800, fontSize: 13.5 }}>{title}</div>}
        {title && message && <div style={{ height: 2 }} />}
        {message && <div style={{ color: s.color, opacity: 0.85, fontSize: 12.5, lineHeight: 1.4 }}>{message}</div>}
      </div>
      <button onClick={() => setVisible(false)} aria-label="Dismiss" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', flexShrink: 0 }}>
        <X size={18} color={s.color} />
      </button>
    </div>
  );
}
