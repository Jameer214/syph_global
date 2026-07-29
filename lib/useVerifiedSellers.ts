'use client';
import { useMemo } from 'react';
import { useSellerRecords } from '@/lib/sellerRecords';

/**
 * Given a set of listings, returns the Set of seller ids (ownerUid =
 * listings.seller_id) that are admin-verified. Reads from the SHARED, batched
 * seller-record cache (see lib/sellerRecords) so the verified flag rides along
 * with the same single `sellers` query that useDistances uses — no separate
 * round-trip. Safe + additive: an empty set until the batch resolves, so cards
 * simply show no tick meanwhile.
 */
export function useVerifiedSellers(
  listings: { ownerUid?: string }[],
): Set<string> {
  const ids = useMemo(() => {
    const s = new Set<string>();
    for (const l of listings) if (l.ownerUid) s.add(l.ownerUid);
    return Array.from(s);
  }, [listings]);

  const records = useSellerRecords(ids);

  return useMemo(() => {
    const out = new Set<string>();
    for (const [id, rec] of records) if (rec.isVerified) out.add(id);
    return out;
  }, [records]);
}
