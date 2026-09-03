// Reads seller pricing / free-listing promo config from the shared backend,
// mirroring the SYPH app (admin_settings key 'payment_methods' -> pricing.listItem)
// so the website enforces the same free-quota + paid-listing rules.
import { supabase } from '@/lib/supabase';

/** Default free-listing quota — kept in lockstep with the app (15). */
export const DEFAULT_FREE_QUOTA = 15;

export interface SellerBanner {
  enabled: boolean;
  id: string;
  title: string;
  message: string;
  type: string; // info | warning | success | error
}

export interface ListItemPricing {
  freeQuota: number;
  promoEnabled: boolean;
  promoBanner: string;
  perListingUgx: number;
  freeStoppedCountries: string[]; // lower-cased
  sellerBanner: SellerBanner;
}

const FALLBACK: ListItemPricing = {
  freeQuota: DEFAULT_FREE_QUOTA,
  promoEnabled: true,
  promoBanner: '',
  perListingUgx: 0,
  freeStoppedCountries: [],
  sellerBanner: { enabled: false, id: '', title: '', message: '', type: 'info' },
};

/** admin_settings['payment_methods'].pricing.listItem — the free-quota / fee config. */
export async function getListItemPricing(): Promise<ListItemPricing> {
  try {
    const { data } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', 'payment_methods')
      .limit(1)
      .maybeSingle();
    const value = (data as Record<string, unknown> | null)?.value as Record<string, unknown> | undefined;
    const pricing = value && typeof value === 'object' ? (value.pricing as Record<string, unknown> | undefined) : undefined;
    const cat = pricing && typeof pricing === 'object' ? (pricing.listItem as Record<string, unknown> | undefined) : undefined;
    if (!cat) return FALLBACK;

    const quota = parseInt(String(cat.freeQuota ?? ''), 10);
    const banner = (cat.sellerBanner as Record<string, unknown> | undefined) ?? {};
    return {
      freeQuota: Number.isFinite(quota) ? quota : DEFAULT_FREE_QUOTA,
      promoEnabled: cat.promoEnabled === undefined ? true : cat.promoEnabled === true,
      promoBanner: String(cat.promoBanner ?? ''),
      perListingUgx: parseFloat(String(cat.perListing ?? '0').replace(/,/g, '')) || 0,
      freeStoppedCountries: Array.isArray(cat.freeStoppedCountries)
        ? (cat.freeStoppedCountries as unknown[]).map((c) => String(c).trim().toLowerCase())
        : [],
      sellerBanner: {
        enabled: banner.enabled === true,
        id: String(banner.id ?? ''),
        title: String(banner.title ?? '').trim(),
        message: String(banner.message ?? '').trim(),
        type: String(banner.type ?? 'info'),
      },
    };
  } catch {
    return FALLBACK;
  }
}

export interface VerificationFee {
  enabled: boolean;
  feeUgx: number; // base amount, in UGX
  note: string;
  freeAfterPaidListings: number;
}

const VERIFICATION_FALLBACK: VerificationFee = {
  enabled: false,
  feeUgx: 0,
  note: '',
  freeAfterPaidListings: 3,
};

/**
 * admin_settings['payment_methods'].pricing.verification — the ID-verification
 * fee config, read exactly like the app's `_loadFee`. Any failure leaves the fee
 * OFF so a config hiccup never blocks a seller from getting verified.
 */
export async function getVerificationFee(): Promise<VerificationFee> {
  try {
    const { data } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', 'payment_methods')
      .limit(1)
      .maybeSingle();
    const value = (data as Record<string, unknown> | null)?.value as Record<string, unknown> | undefined;
    const pricing = value && typeof value === 'object' ? (value.pricing as Record<string, unknown> | undefined) : undefined;
    const v = pricing && typeof pricing === 'object' ? (pricing.verification as Record<string, unknown> | undefined) : undefined;
    if (!v) return VERIFICATION_FALLBACK;
    const freeAfter = parseInt(String(v.freeAfterPaidListings ?? '3'), 10);
    return {
      enabled: v.enabled === true,
      feeUgx: parseFloat(String(v.fee ?? '0').replace(/,/g, '')) || 0,
      note: String(v.note ?? '').trim(),
      freeAfterPaidListings: Number.isFinite(freeAfter) ? freeAfter : 3,
    };
  } catch {
    return VERIFICATION_FALLBACK;
  }
}

/** Seller's PAID-listing count (is_trial=false) — mirrors listing_repository.paidListingCount. */
export async function getPaidListingCount(uid: string): Promise<number> {
  try {
    const { count } = await supabase
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('seller_id', uid)
      .eq('is_trial', false);
    return count ?? 0;
  } catch {
    return 0;
  }
}

/** Per-seller platform-fee discount % (user_privileges, else global_privilege). */
export async function getSellerPrivilegePercent(uid: string): Promise<number> {
  try {
    const { data: userRows } = await supabase
      .from('user_privileges')
      .select('enabled, discount_percent')
      .eq('user_id', uid)
      .limit(1);
    const u = (userRows ?? [])[0] as Record<string, unknown> | undefined;
    if (u && u.enabled === true) return parseInt(String(u.discount_percent ?? '0'), 10) || 0;

    const { data: gRows } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', 'global_privilege')
      .limit(1);
    const g = (gRows ?? [])[0] as Record<string, unknown> | undefined;
    const val = g?.value as Record<string, unknown> | undefined;
    if (val && val.enabled === true) return parseInt(String(val.discount_percent ?? '0'), 10) || 0;
    return 0;
  } catch {
    return 0;
  }
}

export type PromoCategory =
  | 'sponsorItem' | 'flashSale' | 'happenings'        // create a NEW promoted listing
  | 'upgradeToSponsored' | 'upgradeToFlashSale';      // upgrade an EXISTING listing

export type DayPriceMap = { days7: number; days15: number; days30: number };

const PROMO_CATS: PromoCategory[] = ['sponsorItem', 'flashSale', 'happenings', 'upgradeToSponsored', 'upgradeToFlashSale'];

/**
 * Duration-based promo prices (UGX) per category, from
 * admin_settings['payment_methods'].pricing — the same source the app reads.
 */
export async function getPromoPricing(): Promise<Record<PromoCategory, DayPriceMap>> {
  const empty = (): DayPriceMap => ({ days7: 0, days15: 0, days30: 0 });
  const out = Object.fromEntries(PROMO_CATS.map((c) => [c, empty()])) as Record<PromoCategory, DayPriceMap>;
  try {
    const { data } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', 'payment_methods')
      .limit(1)
      .maybeSingle();
    const value = (data as Record<string, unknown> | null)?.value as Record<string, unknown> | undefined;
    const pricing = value && typeof value === 'object' ? (value.pricing as Record<string, unknown> | undefined) : undefined;
    if (!pricing) return out;
    const num = (v: unknown) => parseFloat(String(v ?? '0').replace(/,/g, '')) || 0;
    for (const c of PROMO_CATS) {
      const cat = pricing[c] as Record<string, unknown> | undefined;
      if (!cat) continue;
      out[c] = { days7: num(cat.days7), days15: num(cat.days15), days30: num(cat.days30) };
    }
  } catch {
    /* fall back to zeros */
  }
  return out;
}

/**
 * Active (live) + pending listings for this seller — the count that eats into
 * the free quota. Sold/deleted listings don't count, so deleting frees a slot.
 * listings.seller_id holds the auth uid (see createListing), so we count by uid.
 */
export async function getActiveListingCount(uid: string): Promise<number> {
  try {
    const { data } = await supabase
      .from('listings')
      .select('id')
      .eq('seller_id', uid)
      .in('status', ['active', 'pending']);
    return (data ?? []).length;
  } catch {
    return 0;
  }
}
