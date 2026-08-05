'use client';
import { useRouter } from 'next/navigation';
import { Store, MapPin, ChevronRight } from 'lucide-react';
import { sanitizeText } from '@/lib/sanitize';
import VerifiedTick from '@/components/VerifiedTick';
import type { ShopHit } from '@/lib/firestore';

/**
 * "Shops" section for the search suggestion dropdowns. Rendered at the top of
 * the existing results dropdown so a buyer can jump straight to a storefront.
 * Additive: returns null when there are no shop matches, so dropdowns that only
 * match products look exactly as before. Each row opens /shop/:uid.
 */
export default function ShopSuggestions({
  shops,
  label,
  onNavigate,
}: {
  shops: ShopHit[];
  label: string;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  if (!shops.length) return null;

  return (
    <>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '10px 14px 4px', fontSize: 11, fontWeight: 900,
          letterSpacing: 0.4, color: '#9ca3af',
        }}
      >
        <Store size={13} style={{ color: '#2E5BFF' }} />
        {label}
      </div>
      {shops.map((s) => {
        const loc = [s.region, s.country].filter((x) => x && x.trim()).join(', ');
        return (
          <div
            key={s.uid}
            onClick={() => { onNavigate?.(); router.push(`/shop/${s.uid}`); }}
            className="row-tap"
            style={{
              padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9',
              display: 'flex', alignItems: 'center', gap: 10,
            }}
          >
            {s.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={s.logoUrl}
                alt=""
                width={34}
                height={34}
                style={{ width: 34, height: 34, borderRadius: 9, objectFit: 'cover', flexShrink: 0 }}
              />
            ) : (
              <div style={{
                width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                background: 'rgba(46,91,255,0.10)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Store size={18} style={{ color: '#2E5BFF' }} />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                margin: 0, fontSize: 13, fontWeight: 800, color: '#1a1a2e',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {sanitizeText(s.name)}
                </span>
                {s.isVerified && <VerifiedTick size={14} />}
              </p>
              {loc && (
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <MapPin size={9} />{sanitizeText(loc)}
                </p>
              )}
            </div>
            <ChevronRight size={16} style={{ color: '#cbd5e1', flexShrink: 0 }} />
          </div>
        );
      })}
    </>
  );
}
