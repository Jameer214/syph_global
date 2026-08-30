'use client';

/**
 * The blue DOCUMENT-verification badge — "VERIFIED" when a seller has passed
 * ID + live-selfie review (sellers.verification_status === 'approved'), else a
 * neutral grey "NOT VERIFIED". This is SEPARATE from the red is_verified tick
 * (the manual admin badge); the two render side by side.
 *
 * Presentational only: pass `verified`. Use `onDark` when it sits on a coloured
 * header so the not-verified state stays legible.
 */
export default function DocVerifiedBadge({
  verified,
  onDark = false,
  compact = false,
}: {
  verified: boolean;
  onDark?: boolean;
  compact?: boolean;
}) {
  const blue = '#2F6BFF';

  let bg: string;
  let fg: string;
  if (verified) {
    bg = onDark ? '#FFFFFF' : 'rgba(47,107,255,0.10)';
    fg = blue;
  } else {
    bg = onDark ? 'rgba(255,255,255,0.20)' : '#EDEFF4';
    fg = onDark ? '#FFFFFF' : '#7A8598';
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: compact ? '3px 7px' : '4px 9px',
        borderRadius: 999,
        background: bg,
        color: fg,
        fontWeight: 900,
        fontSize: compact ? 9.5 : 10.5,
        letterSpacing: 0.4,
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      <svg width={compact ? 12 : 13} height={compact ? 12 : 13} viewBox="0 0 24 24" fill="none" aria-hidden>
        {verified ? (
          <>
            <path
              d="M12 2l2.4 1.8 3-.2 1 2.8 2.4 1.8-1 2.8 1 2.8-2.4 1.8-1 2.8-3-.2L12 22l-2.4-1.8-3 .2-1-2.8L3.2 16l1-2.8-1-2.8 2.4-1.8 1-2.8 3 .2L12 2z"
              fill={fg}
            />
            <path d="M9 12.5l2 2 4-4.5" stroke={onDark ? '#2F6BFF' : '#fff'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : (
          <path
            d="M12 2l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V5l7-3zm0 6v4m0 3h.01"
            stroke={fg}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
      {verified ? 'VERIFIED' : 'NOT VERIFIED'}
    </span>
  );
}
