'use client';

import { useId } from 'react';

/**
 * "Torn paper" zigzag strip meant to be dropped as the last child of a card's
 * media container (which must be `position: relative`). It overlays the bottom
 * edge of the photo with [color] (the card background) shaped into up-pointing
 * teeth, so the photo appears to tear into the details section below instead of
 * ending on a hard straight line. Mirrors the Flutter `ZigzagEdge` widget.
 */
export default function ZigzagEdge({
  color = '#fff',
  height = 8,
  tooth = 12,
}: {
  color?: string;
  height?: number;
  tooth?: number;
}) {
  // Unique, SSR-stable pattern id so multiple cards on a page don't collide.
  const id = useId().replace(/:/g, '');
  const patternId = `zz-${id}`;
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height,
        pointerEvents: 'none',
        lineHeight: 0,
      }}
    >
      <svg
        width="100%"
        height={height}
        preserveAspectRatio="none"
        style={{ display: 'block' }}
      >
        <defs>
          <pattern
            id={patternId}
            width={tooth * 2}
            height={height}
            patternUnits="userSpaceOnUse"
          >
            {/* One up-pointing tooth: base on the bottom line, apex at the top. */}
            <path
              d={`M0 ${height} L${tooth} 0 L${tooth * 2} ${height} Z`}
              fill={color}
            />
          </pattern>
        </defs>
        <rect width="100%" height={height} fill={`url(#${patternId})`} />
      </svg>
    </div>
  );
}
