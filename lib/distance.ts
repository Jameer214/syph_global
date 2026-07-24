// Distance helpers for the "how far away" chips shown on listing cards.
// Purely additive — nothing here changes existing feed/Near-Me logic.

export type LatLng = { lat: number; lng: number };

const R_KM = 6371;
const toRad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in km between two coordinates (Haversine). */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Human label: "350 m away" under 1 km, else "2.3 km away" / "12 km away". */
export function distanceLabel(km: number | null | undefined): string {
  if (km == null || !isFinite(km) || km < 0) return '';
  if (km < 1) return `${Math.max(1, Math.round(km * 1000))} m away`;
  if (km < 10) return `${km.toFixed(1)} km away`;
  return `${Math.round(km)} km away`;
}

/**
 * Returns the user's coordinates ONLY if geolocation permission was already
 * granted — never triggers a permission prompt. Resolves null otherwise, so
 * callers can silently skip distance chips without changing page UX.
 */
export async function getCoordsIfGranted(): Promise<LatLng | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
  try {
    // Without the Permissions API we can't confirm silently → don't prompt.
    if (!navigator.permissions?.query) return null;
    const status = await navigator.permissions.query({
      name: 'geolocation' as PermissionName,
    });
    if (status.state !== 'granted') return null;

    return await new Promise<LatLng | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { maximumAge: 300000, timeout: 8000, enableHighAccuracy: false },
      );
    });
  } catch {
    return null;
  }
}
