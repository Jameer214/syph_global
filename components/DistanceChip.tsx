import { MapPin } from 'lucide-react';
import { distanceLabel } from '@/lib/distance';
import { useAppStore } from '@/store';
import { tr } from '@/lib/i18n';

/**
 * Small "📍 2.3 km away" chip shown on listing cards when we know how far the
 * user is from the seller. Renders nothing when distance is unavailable, so it
 * is safe to drop into any card without affecting its normal layout.
 */
export default function DistanceChip({
  km,
  size = 'sm',
}: {
  km: number | null | undefined;
  size?: 'sm' | 'xs';
}) {
  // Slice selector (not whole-store) so this chip re-renders only when the
  // language changes — not on every save-toggle / unread / currency write.
  const selectedLanguage = useAppStore((s) => s.selectedLanguage);
  const label = distanceLabel(km, tr('awayWord', selectedLanguage));
  if (!label) return null;
  const fs = size === 'xs' ? 9.5 : 11;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        background: '#EAF1FF',
        color: '#1E4DD9',
        fontWeight: 700,
        fontSize: fs,
        borderRadius: 999,
        padding: size === 'xs' ? '1px 6px' : '2px 8px',
        lineHeight: 1.3,
        whiteSpace: 'nowrap',
      }}
    >
      <MapPin size={size === 'xs' ? 9 : 11} /> {label}
    </span>
  );
}
