'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { haversineKm, getCoordsIfGranted, type LatLng } from '@/lib/distance';

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
  return l.venueLatitude != null && l.venueLongitude != null
    ? { lat: Number(l.venueLatitude), lng: Number(l.venueLongitude) }
    : null;
}

export function useDistances(
  listings: DistanceInput[],
  externalCoords?: LatLng | null,
): Map<string, number> {
  const [silentCoords, setSilentCoords] = useState<LatLng | null>(null);
  const [sellerCoords, setSellerCoords] = useState<Map<string, LatLng>>(new Map());
  const requested = useRef<Set<string>>(new Set());

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

  // Stable key of seller ids we still need — happenings measure from their own
  // venue, so they don't need a seller lookup.
  const sellerIdsKey = useMemo(() => {
    const ids = new Set<string>();
    for (const l of listings) if (l.ownerUid && !ownVenue(l)) ids.add(l.ownerUid);
    return Array.from(ids).sort().join(',');
  }, [listings]);

  // Fetch coords for any sellers we haven't looked up yet.
  useEffect(() => {
    if (!coords || !sellerIdsKey) return;
    const missing = sellerIdsKey
      .split(',')
      .filter((id) => id && !requested.current.has(id));
    if (missing.length === 0) return;
    missing.forEach((id) => requested.current.add(id));

    let alive = true;
    (async () => {
      // A listing's `seller_id` (→ ownerUid) is the seller's auth user_id, not
      // the sellers PK. Match on user_id, but also key the result by the row id
      // defensively so lookups resolve regardless of which the listing carries.
      const list = missing.join(',');
      const { data } = await supabase
        .from('sellers')
        .select('id, user_id, business_latitude, business_longitude')
        .or(`user_id.in.(${list}),id.in.(${list})`);
      if (!alive || !data) return;
      setSellerCoords((prev) => {
        const next = new Map(prev);
        for (const row of data as Record<string, unknown>[]) {
          const lat = row.business_latitude;
          const lng = row.business_longitude;
          if (lat != null && lng != null) {
            const coord = { lat: Number(lat), lng: Number(lng) };
            if (row.user_id != null) next.set(String(row.user_id), coord);
            if (row.id != null) next.set(String(row.id), coord);
          }
        }
        return next;
      });
    })();
    return () => { alive = false; };
  }, [coords, sellerIdsKey]);

  // Build the id → km map — venue for happenings, seller for everything else.
  return useMemo(() => {
    const out = new Map<string, number>();
    if (!coords) return out;
    for (const l of listings) {
      const target = ownVenue(l) ?? (l.ownerUid ? sellerCoords.get(l.ownerUid) : undefined);
      if (target) out.set(l.id, haversineKm(coords, target));
    }
    return out;
  }, [coords, sellerCoords, listings]);
}
