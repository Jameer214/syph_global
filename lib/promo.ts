// Helpers that decide when a "timed" listing has run out, so web feeds match
// the Flutter app (which downgrades expired promos in its listing mapper and
// filters them out of the flash-sale / sponsored feed queries).

/** True when a `*_until` timestamp exists and is already in the past. */
export function isPast(raw: unknown): boolean {
  if (raw == null) return false;
  const t = new Date(String(raw)).getTime();
  return isFinite(t) && t <= Date.now();
}

/**
 * True when an event's `event_date` is before the start of today — i.e. the
 * happening is over. A null date means "no date set", which never expires.
 * Day-granular (not exact time) so an event still shows for its whole day.
 */
export function isEventExpired(raw: unknown): boolean {
  if (raw == null) return false;
  const t = new Date(String(raw)).getTime();
  if (!isFinite(t)) return false;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return t < start.getTime();
}

/** ISO timestamp for the start of today — for `event_date.gte.<iso>` filters. */
export function startOfTodayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
