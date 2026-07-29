'use client';
import { useEffect, useMemo, useReducer } from 'react';
import { supabase } from '@/lib/supabase';
import { isValidLatLng } from '@/lib/distance';

/**
 * Shared, batched seller-record cache.
 *
 * useDistances and useVerifiedSellers both need per-seller data keyed on the
 * SAME id set (ownerUid = listings.seller_id = the seller's auth user_id). They
 * used to fire TWO separate `sellers` queries on every listing grid. This module
 * collapses both needs — GPS coords AND admin-verified flag — into ONE query per
 * unique seller-id set, coalesced across all callers via a microtask (the same
 * pattern as OpenStatusChip's hours batching). The cache is module-level so a
 * seller fetched for a distance chip is never re-fetched for a verified tick,
 * and vice-versa, for the whole session.
 *
 * A listing carries the seller's auth user_id, not the sellers PK, so we match
 * on user_id with an id fallback and key the cache by BOTH so a lookup resolves
 * regardless of which the caller holds.
 */
export interface SellerRecord {
  lat?: number;      // undefined when unset / placeholder (never a bogus far-away chip)
  lng?: number;
  isVerified: boolean;
}

const cache = new Map<string, SellerRecord>(); // key: user_id AND id → same record
const listeners = new Set<() => void>();
let pending = new Set<string>();
let scheduled = false;

async function flush() {
  scheduled = false;
  const ids = [...pending].filter((id) => !cache.has(id));
  pending = new Set();
  if (ids.length === 0) return;
  const list = ids.join(',');
  try {
    const { data } = await supabase
      .from('sellers')
      .select('id, user_id, business_latitude, business_longitude, is_verified')
      .or(`user_id.in.(${list}),id.in.(${list})`);
    // Seed every requested id as "looked up" first so a seller with no row (or
    // no GPS) is cached as not-verified/no-coords and never re-requested.
    for (const id of ids) if (!cache.has(id)) cache.set(id, { isVerified: false });
    for (const row of (data ?? []) as Record<string, unknown>[]) {
      const lat = row.business_latitude as number | null;
      const lng = row.business_longitude as number | null;
      const valid = isValidLatLng(lat, lng);
      const rec: SellerRecord = {
        lat: valid ? Number(lat) : undefined,
        lng: valid ? Number(lng) : undefined,
        isVerified: Boolean(row.is_verified),
      };
      if (row.user_id != null) cache.set(String(row.user_id), rec);
      if (row.id != null) cache.set(String(row.id), rec);
    }
  } catch {
    for (const id of ids) if (!cache.has(id)) cache.set(id, { isVerified: false });
  } finally {
    listeners.forEach((l) => l());
  }
}

function request(id: string) {
  if (cache.has(id) || pending.has(id)) return;
  pending.add(id);
  if (!scheduled) {
    scheduled = true;
    queueMicrotask(flush);
  }
}

/**
 * Given a set of seller ids, returns a Map<id, SellerRecord> for those already
 * resolved, requesting any missing ones in a single coalesced batch. Empty
 * entries simply appear once the batch resolves (additive: callers render
 * nothing meanwhile).
 */
export function useSellerRecords(ids: string[]): Map<string, SellerRecord> {
  const [tick, force] = useReducer((x) => x + 1, 0);
  const key = useMemo(
    () => Array.from(new Set(ids.filter(Boolean))).sort().join(','),
    [ids],
  );

  useEffect(() => {
    if (!key) return;
    for (const id of key.split(',')) request(id);
    const l = () => force();
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, [key]);

  return useMemo(() => {
    const out = new Map<string, SellerRecord>();
    if (!key) return out;
    for (const id of key.split(',')) {
      const rec = cache.get(id);
      if (rec) out.set(id, rec);
    }
    return out;
    // Recompute when the id set changes or a batch resolves (tick bump).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick]);
}
