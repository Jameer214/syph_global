import type { Listing } from '@/types';

// Local-only "Recently viewed" history — the web mirror of the Flutter
// RecentlyViewedNotifier. Keeps the last MAX listings a visitor opened,
// most-recent first, in localStorage so the Home rail paints instantly.
// Nothing is written to the backend; every call is best-effort and never
// throws, so a storage hiccup can't break a page (same guarantee as
// listingsCache).

const KEY = 'recently_viewed_v1';
const MAX = 15;

export function getRecentlyViewed(): Listing[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? (list as Listing[]) : [];
  } catch {
    return [];
  }
}

/** Records `listing` as most-recently viewed. De-dupes by id (moves an
 *  already-seen item to the front) and caps the list at MAX. */
export function recordRecentlyViewed(listing: Listing | null | undefined): void {
  if (typeof window === 'undefined') return;
  if (!listing || !listing.id) return;
  try {
    const next = [listing, ...getRecentlyViewed().filter((l) => l.id !== listing.id)].slice(0, MAX);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Persisting is best-effort.
  }
}

export function clearRecentlyViewed(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Best-effort.
  }
}
