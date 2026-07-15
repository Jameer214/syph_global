import type { Listing } from '@/types';

// Persistent (localStorage) cache for listing feeds and search results, so the
// home / select-location grids and search results paint INSTANTLY on the next
// visit instead of re-firing every query. Stale-while-revalidate: show the
// cached items immediately, then refetch in the background when older than the
// 24h TTL. Mirrors the Flutter app's ListingsCache. All ops are best-effort and
// never throw (SSR-safe, quota-safe).

const PREFIX = 'lcache_v1_';
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export type ListingsCacheEntry = { fetchedAt: number; items: Listing[] };

export function readListingsCache(key: string): ListingsCacheEntry | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ListingsCacheEntry;
    if (!parsed || !Array.isArray(parsed.items)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeListingsCache(key: string, items: Listing[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      PREFIX + key,
      JSON.stringify({ fetchedAt: Date.now(), items }),
    );
  } catch {
    // localStorage full/disabled — caching must never break the page.
  }
}

export function isCacheFresh(entry: ListingsCacheEntry | null): boolean {
  return !!entry && Date.now() - entry.fetchedAt < CACHE_TTL_MS;
}
