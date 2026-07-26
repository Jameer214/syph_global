'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Given a set of listings, returns the Set of seller ids (ownerUid =
 * listings.seller_id) that are admin-verified. Batches one query for all the
 * sellers on screen and remembers which ids it already looked up, mirroring
 * how useDistances fetches seller coords. Safe + additive: an empty set until
 * the lookup resolves, so cards simply show no tick meanwhile.
 */
export function useVerifiedSellers(
  listings: { ownerUid?: string }[],
): Set<string> {
  const [verified, setVerified] = useState<Set<string>>(new Set());
  const requested = useRef<Set<string>>(new Set());

  const idsKey = useMemo(() => {
    const ids = new Set<string>();
    for (const l of listings) if (l.ownerUid) ids.add(l.ownerUid);
    return Array.from(ids).sort().join(',');
  }, [listings]);

  useEffect(() => {
    if (!idsKey) return;
    const ids = idsKey
      .split(',')
      .filter((id) => id && !requested.current.has(id));
    if (ids.length === 0) return;
    ids.forEach((id) => requested.current.add(id));

    let alive = true;
    (async () => {
      // ownerUid is the seller's auth user_id; match on user_id with an id
      // fallback, and keep only verified rows.
      const list = ids.join(',');
      const { data } = await supabase
        .from('sellers')
        .select('user_id, id, is_verified')
        .or(`user_id.in.(${list}),id.in.(${list})`)
        .eq('is_verified', true);
      if (!alive || !data) return;
      setVerified((prev) => {
        const next = new Set(prev);
        for (const row of data as Record<string, unknown>[]) {
          if (row.user_id != null) next.add(String(row.user_id));
          if (row.id != null) next.add(String(row.id));
        }
        return next;
      });
    })();
    return () => {
      alive = false;
    };
  }, [idsKey]);

  return verified;
}
