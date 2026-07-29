'use client';
import { useEffect, useMemo, useState } from 'react';
import { haversineKm, getCoordsIfGranted, isValidLatLng, type LatLng } from '@/lib/distance';
import { useSellerRecords } from '@/lib/sellerRecords';

/**
 * Given a set of listings, returns Map<listingId, distanceKm> from the user to
 * each listing's real-world location.
 *
 * Distance anchor is PER-LISTING, matching how locations are actually set:
 *  - Happenings carry their OWN venue location (set on the happening request
 *    screen → venue_latitude/longitude) → measured from the venue.
 *  - All other listings → measured from the seller's setup location
 *    (sellers.business_latitude/longitude), the same anchor `listings_near`
 *    uses. Seller coords are read directly (anon-readable) and cached.
 *
 * Solid + additive by design:
 *  - User location is obtained SILENTLY (only if already granted) unless the
 *    caller passes `externalCoords` (e.g. the Near-Me coordinates), so no new
 *    permission prompt is introduced.
 *  - Nothing existing is modified; sellers are never re-fetched.
 *
 * `listing.ownerUid` = listings.seller_id = the seller's auth user_id
 * (sellers.user_id), NOT the sellers PK. The lookup matches on user_id with an
 * id fallback for safety.
 */
type DistanceInput = {
  id: string;
  ownerUid?: string;
  venueLatitude?: number | null;
  venueLongitude?: number | null;
};

function ownVenue(l: DistanceInput): LatLng | null {
  return isValidLatLng(l.venueLatitude, l.venueLongitude)
    ? { lat: Number(l.venueLatitude), lng: Number(l.venueLongitude) }
    : null;
}

export function useDistances(
  listings: DistanceInput[],
  externalCoords?: LatLng | null,
): Map<string, number> {
  const [silentCoords, setSilentCoords] = useState<LatLng | null>(null);

  // Silent, prompt-free location on mount, re-read when the tab regains
  // visibility (user may have moved while away). Battery-safe: the browser
  // serves its cached fix for up to 5 min (maximumAge in getCoordsIfGranted),
  // so tab-switching never triggers extra hardware reads.
  useEffect(() => {
    let alive = true;
    const read = () =>
      getCoordsIfGranted().then((c) => { if (alive && c) setSilentCoords(c); });
    read();
    const onVisible = () => {
      if (document.visibilityState === 'visible') read();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const coords = externalCoords ?? silentCoords;

  // Seller ids we need coords for — happenings measure from their own venue, so
  // they don't need a seller lookup. Coords come from the SHARED seller-record
  // cache (see lib/sellerRecords), the SAME batched query that feeds verified
  // ticks — so distance + verified are one round-trip, not two, and a seller is
  // never re-fetched. Fetching is not gated on `coords`: the shared cache is
  // populated regardless (verified needs it too); we only skip the distance
  // MATH below when we have no user location.
  const sellerIds = useMemo(() => {
    const ids = new Set<string>();
    for (const l of listings) if (l.ownerUid && !ownVenue(l)) ids.add(l.ownerUid);
    return Array.from(ids);
  }, [listings]);

  const sellerRecords = useSellerRecords(sellerIds);

  // Build the id → km map — venue for happenings, seller for everything else.
  return useMemo(() => {
    const out = new Map<string, number>();
    if (!coords || !isValidLatLng(coords.lat, coords.lng)) return out;
    for (const l of listings) {
      let target = ownVenue(l);
      if (!target && l.ownerUid) {
        const rec = sellerRecords.get(l.ownerUid);
        if (rec && rec.lat != null && rec.lng != null) target = { lat: rec.lat, lng: rec.lng };
      }
      if (target) out.set(l.id, haversineKm(coords, target));
    }
    return out;
  }, [coords, sellerRecords, listings]);
}
