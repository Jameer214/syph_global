/**
 * Open / Closed computation for listing cards, evaluated in the SELLER's own
 * timezone — the web port of the Flutter app's `SellerClock` + `_isSellerOpenNow`.
 *
 * Opening hours are wall-clock time where the seller is, but the browser clock
 * is the viewer's. SYPH is global, so we resolve the seller's country to its
 * IANA timezone and read "now" there via `Intl.DateTimeFormat` (DST-correct, no
 * extra dependency). Countries we can't resolve fall back to the device clock
 * so nothing breaks.
 */
import type { SellerHoursInfo } from '@/types';

// Country NAME (as stored on sellers/listings) → primary IANA timezone.
// Multi-zone countries use their most-populous/capital zone. Mirrors the map
// in syph `lib/core/seller_clock.dart`.
const ZONE_BY_NAME: Record<string, string> = {
  // ── Africa ──
  'Algeria': 'Africa/Algiers', 'Angola': 'Africa/Luanda', 'Benin': 'Africa/Porto-Novo',
  'Botswana': 'Africa/Gaborone', 'Burkina Faso': 'Africa/Ouagadougou', 'Burundi': 'Africa/Bujumbura',
  'Cabo Verde': 'Atlantic/Cape_Verde', 'Cameroon': 'Africa/Douala', 'Central African Republic': 'Africa/Bangui',
  'Chad': 'Africa/Ndjamena', 'Comoros': 'Indian/Comoro', 'Congo (Brazzaville)': 'Africa/Brazzaville',
  'Congo (DRC)': 'Africa/Kinshasa', 'Djibouti': 'Africa/Djibouti', 'Egypt': 'Africa/Cairo',
  'Equatorial Guinea': 'Africa/Malabo', 'Eritrea': 'Africa/Asmara', 'Eswatini': 'Africa/Mbabane',
  'Ethiopia': 'Africa/Addis_Ababa', 'Gabon': 'Africa/Libreville', 'Gambia': 'Africa/Banjul',
  'Ghana': 'Africa/Accra', 'Guinea': 'Africa/Conakry', 'Guinea-Bissau': 'Africa/Bissau',
  'Ivory Coast': 'Africa/Abidjan', 'Kenya': 'Africa/Nairobi', 'Lesotho': 'Africa/Maseru',
  'Liberia': 'Africa/Monrovia', 'Libya': 'Africa/Tripoli', 'Madagascar': 'Indian/Antananarivo',
  'Malawi': 'Africa/Blantyre', 'Mali': 'Africa/Bamako', 'Mauritania': 'Africa/Nouakchott',
  'Mauritius': 'Indian/Mauritius', 'Morocco': 'Africa/Casablanca', 'Mozambique': 'Africa/Maputo',
  'Namibia': 'Africa/Windhoek', 'Niger': 'Africa/Niamey', 'Nigeria': 'Africa/Lagos',
  'Rwanda': 'Africa/Kigali', 'São Tomé and Príncipe': 'Africa/Sao_Tome', 'Senegal': 'Africa/Dakar',
  'Sierra Leone': 'Africa/Freetown', 'Somalia': 'Africa/Mogadishu', 'South Africa': 'Africa/Johannesburg',
  'South Sudan': 'Africa/Juba', 'Sudan': 'Africa/Khartoum', 'Tanzania': 'Africa/Dar_es_Salaam',
  'Togo': 'Africa/Lome', 'Tunisia': 'Africa/Tunis', 'Uganda': 'Africa/Kampala',
  'Zambia': 'Africa/Lusaka', 'Zimbabwe': 'Africa/Harare',
  // ── Middle East ──
  'Bahrain': 'Asia/Bahrain', 'Iraq': 'Asia/Baghdad', 'Jordan': 'Asia/Amman',
  'Kuwait': 'Asia/Kuwait', 'Lebanon': 'Asia/Beirut', 'Oman': 'Asia/Muscat',
  'Palestine': 'Asia/Gaza', 'Qatar': 'Asia/Qatar', 'Saudi Arabia': 'Asia/Riyadh',
  'Syria': 'Asia/Damascus', 'United Arab Emirates': 'Asia/Dubai', 'Yemen': 'Asia/Aden',
  // ── Asia ──
  'Afghanistan': 'Asia/Kabul', 'Bangladesh': 'Asia/Dhaka', 'China': 'Asia/Shanghai',
  'India': 'Asia/Kolkata', 'Indonesia': 'Asia/Jakarta', 'Iran': 'Asia/Tehran',
  'Israel': 'Asia/Jerusalem', 'Japan': 'Asia/Tokyo', 'Kazakhstan': 'Asia/Almaty',
  'Malaysia': 'Asia/Kuala_Lumpur', 'Pakistan': 'Asia/Karachi', 'Philippines': 'Asia/Manila',
  'Singapore': 'Asia/Singapore', 'South Korea': 'Asia/Seoul', 'Sri Lanka': 'Asia/Colombo',
  'Thailand': 'Asia/Bangkok', 'Turkey': 'Europe/Istanbul', 'Vietnam': 'Asia/Ho_Chi_Minh',
  // ── Europe ──
  'Albania': 'Europe/Tirane', 'Austria': 'Europe/Vienna', 'Belgium': 'Europe/Brussels',
  'Czech Republic': 'Europe/Prague', 'Denmark': 'Europe/Copenhagen', 'Finland': 'Europe/Helsinki',
  'France': 'Europe/Paris', 'Germany': 'Europe/Berlin', 'Greece': 'Europe/Athens',
  'Hungary': 'Europe/Budapest', 'Ireland': 'Europe/Dublin', 'Italy': 'Europe/Rome',
  'Netherlands': 'Europe/Amsterdam', 'Norway': 'Europe/Oslo', 'Poland': 'Europe/Warsaw',
  'Portugal': 'Europe/Lisbon', 'Romania': 'Europe/Bucharest', 'Russia': 'Europe/Moscow',
  'Spain': 'Europe/Madrid', 'Sweden': 'Europe/Stockholm', 'Switzerland': 'Europe/Zurich',
  'Ukraine': 'Europe/Kyiv', 'United Kingdom': 'Europe/London',
  // ── Americas ──
  'Argentina': 'America/Argentina/Buenos_Aires', 'Brazil': 'America/Sao_Paulo', 'Canada': 'America/Toronto',
  'Chile': 'America/Santiago', 'Colombia': 'America/Bogota', 'Mexico': 'America/Mexico_City',
  'Peru': 'America/Lima', 'United States': 'America/New_York',
  // ── Oceania ──
  'Australia': 'Australia/Sydney', 'New Zealand': 'Pacific/Auckland',
};

// A few ISO alpha-2 codes, in case a row stores a code instead of a name.
const ZONE_BY_CODE: Record<string, string> = {
  'UG': 'Africa/Kampala', 'KE': 'Africa/Nairobi', 'TZ': 'Africa/Dar_es_Salaam',
  'NG': 'Africa/Lagos', 'ZA': 'Africa/Johannesburg', 'GH': 'Africa/Accra',
  'US': 'America/New_York', 'GB': 'Europe/London', 'IN': 'Asia/Kolkata',
};

function zoneForCountry(country?: string | null): string | null {
  if (!country) return null;
  const c = country.trim();
  if (!c) return null;
  if (ZONE_BY_NAME[c]) return ZONE_BY_NAME[c];
  if (c.length === 2 && ZONE_BY_CODE[c.toUpperCase()]) return ZONE_BY_CODE[c.toUpperCase()];
  const lower = c.toLowerCase();
  for (const name in ZONE_BY_NAME) {
    if (name.toLowerCase() === lower) return ZONE_BY_NAME[name];
  }
  return null;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
};

/**
 * Seller-local now as `{ weekday, minutes }` where weekday is 0=Mon … 6=Sun and
 * minutes is minutes-since-midnight. Falls back to the device clock when the
 * country can't be resolved to a timezone.
 */
function sellerLocalNow(country?: string | null): { weekday: number; minutes: number } {
  const now = new Date();
  const zone = zoneForCountry(country);
  if (zone) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: zone,
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(now);
      const wd = parts.find((p) => p.type === 'weekday')?.value ?? '';
      let hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
      const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
      if (hour === 24) hour = 0; // hour12:false can emit "24" at midnight
      const weekday = WEEKDAY_INDEX[wd] ?? (now.getDay() + 6) % 7;
      return { weekday, minutes: hour * 60 + minute };
    } catch {
      /* fall through to device clock */
    }
  }
  return { weekday: (now.getDay() + 6) % 7, minutes: now.getHours() * 60 + now.getMinutes() };
}

function parseHourMinute(raw?: string): [number, number] | null {
  if (!raw || !raw.trim()) return null;
  const parts = raw.trim().split(':');
  if (parts.length !== 2) return null;
  const hour = Number(parts[0]);
  const minute = Number(parts[1]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return [hour, minute];
}

function hasAnyHours(h: SellerHoursInfo): boolean {
  return h.open24Hours || !!h.openingTime?.trim() || !!h.closingTime?.trim();
}

/**
 * `true` = open now, `false` = closed now, `null` = can't tell (no hours on
 * file) → callers should render nothing. Evaluated in the seller's timezone;
 * mirrors Flutter `computeSellerOpen` / the app's Open Now filter.
 */
export function computeOpenNow(
  hours: SellerHoursInfo | null | undefined,
  country?: string | null,
): boolean | null {
  if (!hours || !hasAnyHours(hours)) return null;
  const { weekday, minutes } = sellerLocalNow(country);

  if (hours.workingDays && hours.workingDays.length > 0 && !hours.workingDays.includes(weekday)) {
    return false; // closed today
  }
  if (hours.open24Hours) return true;

  const open = parseHourMinute(hours.openingTime);
  const close = parseHourMinute(hours.closingTime);
  if (open == null || close == null) return null; // no usable times → unknown

  const openMinutes = open[0] * 60 + open[1];
  const closeMinutes = close[0] * 60 + close[1];
  if (openMinutes === closeMinutes) return true;
  if (openMinutes < closeMinutes) {
    return minutes >= openMinutes && minutes < closeMinutes;
  }
  return minutes >= openMinutes || minutes < closeMinutes; // overnight window
}
