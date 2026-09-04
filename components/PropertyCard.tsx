'use client';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Home, Heart, MapPin, Eye, Bookmark } from 'lucide-react';
import { useAppStore } from '@/store';
import { formatConverted, getCurrencySymbol } from '@/lib/currency';
import DistanceChip from '@/components/DistanceChip';
import type { Listing } from '@/types';

/** True for listings that should use the premium [PropertyCard] instead of the
 * normal product card — anything under the Real Estate or Accommodation main
 * categories. Every card surface gates on this so ONLY property listings get the
 * new look; all other listings render exactly as before. */
export function isPropertyListing(l: Pick<Listing, 'mainCategoryId'>): boolean {
  return l.mainCategoryId === 'real_estate' || l.mainCategoryId === 'accommodation';
}

/**
 * Full-width, real-estate-portal style card for Accommodation & Real Estate
 * listings — mirror of the Flutter `PropertyListingCard`. A large hero photo
 * with a floating white info panel (title · location · price) over its lower
 * edge, a heart save button top-right, and a views · saves · distance meta row.
 *
 * Drop into any CSS grid with `spanFull` so it stretches across all columns.
 */
export default function PropertyCard({
  listing,
  km,
  verified = false,
  spanFull = true,
}: {
  listing: Listing;
  km?: number | null;
  verified?: boolean;
  spanFull?: boolean;
}) {
  const router = useRouter();
  const { selectedCurrency, isSaved, toggleSaved } = useAppStore();
  const saved = isSaved(listing.id);

  function displayPrice(): string {
    if (
      listing.priceValue != null &&
      selectedCurrency &&
      selectedCurrency !== listing.currencyCode
    ) {
      return `≈ ${formatConverted(listing.priceValue, listing.currencyCode, selectedCurrency)}`;
    }
    if (listing.priceText?.trim()) return listing.priceText.trim();
    if (listing.priceValue != null) {
      return `${getCurrencySymbol(listing.currencyCode)}${listing.priceValue.toLocaleString()}`;
    }
    return 'Price not set';
  }

  const locationText =
    listing.locationText?.trim() ||
    [listing.regionOrCity, listing.country].filter(Boolean).join(', ');

  return (
    <div
      onClick={() => router.push(`/listing/${listing.id}`)}
      style={{
        gridColumn: spanFull ? '1 / -1' : undefined,
        position: 'relative',
        width: '100%',
        aspectRatio: '1.32',
        borderRadius: 22,
        overflow: 'hidden',
        cursor: 'pointer',
        marginBottom: 4,
      }}
    >
      {/* Hero photo */}
      {listing.imageUrl ? (
        <Image
          src={listing.imageUrl}
          alt={listing.title}
          fill
          style={{ objectFit: 'cover' }}
          sizes="(max-width: 768px) 100vw, 640px"
        />
      ) : (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: '#E8EDFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Home size={36} color="#6B7A99" />
        </div>
      )}

      {/* Heart save button */}
      <button
        aria-label={saved ? 'Unsave' : 'Save'}
        onClick={(e) => {
          e.stopPropagation();
          toggleSaved(listing.id);
        }}
        style={{
          position: 'absolute',
          top: 14,
          right: 14,
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: '#fff',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}
      >
        <Heart
          size={20}
          color={saved ? '#2E5BFF' : '#1E2B45'}
          fill={saved ? '#2E5BFF' : 'none'}
        />
      </button>

      {/* Floating info panel */}
      <div
        style={{
          position: 'absolute',
          left: 14,
          right: 14,
          bottom: 14,
          background: '#fff',
          borderRadius: 18,
          padding: '14px 16px',
          boxShadow: '0 6px 14px rgba(0,0,0,0.12)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontWeight: 900,
              fontSize: 17,
              color: '#1E2B45',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {listing.title}
            </span>
            {verified && <VerifiedInline />}
          </div>
          {locationText && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                color: '#6B7A99',
                fontSize: 12.5,
                fontWeight: 600,
                marginTop: 5,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              <MapPin size={14} />
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {locationText}
              </span>
            </div>
          )}
          {/* Views · Saves · Distance meta row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              marginTop: 8,
              color: '#6B7A99',
              fontSize: 11.5,
              fontWeight: 700,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Eye size={14} /> {listing.viewsCount ?? 0}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Bookmark size={14} /> {listing.savesCount ?? 0}
            </span>
            {km != null && <DistanceChip km={km} size="xs" />}
          </div>
        </div>
        <div
          style={{
            fontWeight: 900,
            fontSize: 17,
            color: '#1E2B45',
            textAlign: 'right',
            flexShrink: 0,
          }}
        >
          {displayPrice()}
        </div>
      </div>
    </div>
  );
}

// Small inline verified badge — kept local so the card has no extra deps.
function VerifiedInline() {
  return (
    <span style={{ flexShrink: 0, display: 'inline-flex' }}>
      <svg width={16} height={16} viewBox="0 0 24 24" fill="#2E5BFF" aria-hidden>
        <path d="M12 2l2.4 1.8 3 .2.9 2.9 2.3 1.9-1 2.8 1 2.8-2.3 1.9-.9 2.9-3 .2L12 22l-2.4-1.8-3-.2-.9-2.9L3.4 15l1-2.8-1-2.8 2.3-1.9.9-2.9 3-.2L12 2z" />
        <path d="M10.6 14.6l-2.2-2.2-1.1 1.1 3.3 3.3 5.6-5.6-1.1-1.1z" fill="#fff" />
      </svg>
    </span>
  );
}
