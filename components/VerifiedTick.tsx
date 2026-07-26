/**
 * Red "verified seller" tick for listing cards — same mark as the shop header.
 * Render it in a card's details area (not on the photo) when the seller is
 * verified; it takes no space when you don't render it.
 */
export default function VerifiedTick({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-label="Verified seller"
      style={{ flexShrink: 0 }}
    >
      <path
        fill="#E53935"
        d="M23 12l-2.44-2.78.34-3.68-3.61-.82-1.89-3.18L12 3 8.6 1.54 6.71 4.72l-3.61.81.34 3.68L1 12l2.44 2.78-.34 3.69 3.61.82 1.89 3.18L12 21l3.4 1.46 1.89-3.18 3.61-.82-.34-3.68z"
      />
      <path
        fill="#fff"
        d="M10.09 16.72l-3.8-3.81 1.48-1.48 2.32 2.33 5.85-5.87 1.48 1.48z"
      />
    </svg>
  );
}
