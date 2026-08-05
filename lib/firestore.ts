import { supabase } from '@/lib/supabase';
import { sanitizeText } from '@/lib/sanitize';
import { compressImage } from '@/lib/imageCompress';
import type { Listing, SellerProfile, Review, SellerHoursInfo, ChatThread, ChatMessage, Report, PromotionRequest, UserProfile } from '@/types';

// ─── File validation ──────────────────────────────────────────────────────────

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png']);
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2 MB

function validateImageFile(file: File, maxBytes = MAX_IMAGE_SIZE): void {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error(`Invalid file type: ${file.type}. Only JPEG and PNG images are allowed.`);
  }
  if (file.size > maxBytes) {
    throw new Error(`File too large. Maximum size is ${maxBytes / 1024 / 1024} MB.`);
  }
}

// ─── Mapping helpers ──────────────────────────────────────────────────────────

function mapListing(row: Record<string, unknown>): Listing {
  const images = Array.isArray(row.listing_images)
    ? (row.listing_images as Array<{ url: string; sort_order: number }>)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(i => i.url)
    : [];
  return {
    id: String(row.id ?? ''),
    title: String(row.title ?? ''),
    description: String(row.description ?? ''),
    imageUrl: images[0] ?? String(row.image_url ?? ''),
    imageUrls: images.length > 0 ? images : undefined,
    videoUrl: row.video_url ? String(row.video_url) : undefined,
    bio: row.bio ? String(row.bio) : undefined,
    // specifications is a JSON object on the row ({ "color": "black" }); coerce
    // values to strings for the details view. Was hardcoded undefined, so the
    // Specifications section never rendered.
    specifications:
      row.specifications &&
      typeof row.specifications === 'object' &&
      !Array.isArray(row.specifications)
        ? Object.fromEntries(
            Object.entries(row.specifications as Record<string, unknown>)
              .filter(([, v]) => v != null && String(v).trim() !== '')
              .map(([k, v]) => [k, String(v)]),
          )
        : undefined,
    eventDate: row.event_date ? String(row.event_date) : undefined,
    venueLatitude: typeof row.venue_latitude === 'number' ? row.venue_latitude : undefined,
    venueLongitude: typeof row.venue_longitude === 'number' ? row.venue_longitude : undefined,
    sellerName: String(row.seller_name ?? ''),
    ownerUid: String(row.seller_id ?? ''),
    country: String(row.country ?? ''),
    regionOrCity: String(row.region ?? ''),
    locationText: String(row.location_text ?? row.region ?? ''),
    priceText: row.price_text ? String(row.price_text) : undefined,
    priceValue: typeof row.price === 'number' ? row.price : undefined,
    currencyCode: String(row.currency ?? 'USD'),
    negotiable: Boolean(row.is_negotiable),
    messageAboutGoods: row.message_about_goods ? String(row.message_about_goods) : undefined,
    mainCategoryId: String(row.category_id ?? ''),
    subCategoryId: row.sub_category_id ? String(row.sub_category_id) : undefined,
    rating: undefined,
    condition: row.condition ? String(row.condition) : undefined,
    openNow: Boolean(row.open_now),
    isSponsored: Boolean(row.is_sponsored),
    isHappening: Boolean(row.is_happening),
    isFlashSale: Boolean(row.is_flash_sale),
    isTrial: Boolean(row.is_trial),
    status: row.status === 'active' ? 'approved' : String(row.status ?? 'pending'),
    viewsCount: typeof row.view_count === 'number' ? row.view_count : 0,
    savesCount: typeof row.save_count === 'number' ? row.save_count : 0,
    messagesCount: 0,
    lastInteraction: undefined,
    createdAt: row.created_at ? String(row.created_at) : undefined,
    flashSaleEndsAt: row.flash_sale_until ? String(row.flash_sale_until) : undefined,
    originalPriceValue: typeof row.original_price === 'number' ? row.original_price
      : (typeof row.flash_sale_price === 'number' ? row.flash_sale_price : undefined),
    originalPriceText: row.original_price_text ? String(row.original_price_text) : undefined,
    units: typeof row.unit_count === 'number' ? row.unit_count : undefined,
  };
}

// Happenings now live in the listings table (is_happening = true) and use the
// shared mapListing — no separate happenings mapper is needed.

// ─── Listings ─────────────────────────────────────────────────────────────────

export async function getListings(options: {
  pageSize?: number;
  lastDoc?: null;
  mainCategoryId?: string;
  subCategoryId?: string;
  country?: string;
  isSponsored?: boolean;
  isFlashSale?: boolean;
  isHappening?: boolean;
  orderByField?: string;
}): Promise<{ listings: Listing[]; lastDoc: null }> {
  const { pageSize = 20, mainCategoryId, country, isSponsored, isFlashSale } = options;

  let q = supabase
    .from('listings')
    .select('*, listing_images(url, sort_order)')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(pageSize);

  if (mainCategoryId) q = q.eq('category_id', mainCategoryId);
  if (country) q = q.eq('country', country);
  if (isSponsored !== undefined) q = q.eq('is_sponsored', isSponsored);
  if (isFlashSale !== undefined) q = q.eq('is_flash_sale', isFlashSale);

  const { data } = await q;
  return { listings: (data ?? []).map(r => mapListing(r as Record<string, unknown>)), lastDoc: null };
}

export async function getListing(id: string): Promise<Listing | null> {
  const { data } = await supabase
    .from('listings')
    .select('*, listing_images(url, sort_order)')
    .eq('id', id)
    .single();
  if (!data) return null;
  return mapListing(data as Record<string, unknown>);
}

// Batch-fetch many listings in ONE query. The Saved page previously did
// Promise.all(ids.map(getListing)) — one round-trip PER saved item, so a user
// with 80 saved listings fired 80 requests on every mount and on every save
// toggle. This collapses that to a single `.in('id', ids)` query. Order is
// restored to match `ids` (the caller's order) since `.in` does not guarantee it.
export async function getListingsByIds(ids: string[]): Promise<Listing[]> {
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from('listings')
    .select('*, listing_images(url, sort_order)')
    .in('id', ids);
  const byId = new Map<string, Listing>();
  for (const r of data ?? []) {
    const l = mapListing(r as Record<string, unknown>);
    byId.set(l.id, l);
  }
  return ids.map((id) => byId.get(id)).filter((l): l is Listing => l != null);
}

export async function getSponsoredListings(count = 8, country?: string): Promise<Listing[]> {
  let q = supabase
    .from('listings')
    .select('*, listing_images(url, sort_order)')
    .eq('status', 'active')
    .eq('is_sponsored', true)
    .order('created_at', { ascending: false })
    .limit(count);
  if (country) q = q.eq('country', country);
  const { data } = await q;
  return (data ?? []).map(r => mapListing(r as Record<string, unknown>));
}

export async function getFlashSaleListings(count = 12, country?: string): Promise<Listing[]> {
  let q = supabase
    .from('listings')
    .select('*, listing_images(url, sort_order)')
    .eq('status', 'active')
    .eq('is_flash_sale', true)
    .order('created_at', { ascending: false })
    .limit(count);
  if (country) q = q.eq('country', country);
  const { data } = await q;
  return (data ?? []).map(r => mapListing(r as Record<string, unknown>));
}

export async function getHappenings(count = 8, country?: string): Promise<Listing[]> {
  let q = supabase
    .from('listings')
    .select('*, listing_images(url, sort_order)')
    .eq('status', 'active')
    .eq('is_happening', true)
    .order('created_at', { ascending: false })
    .limit(count);
  if (country) q = q.eq('country', country);
  const { data } = await q;
  return (data ?? []).map(r => mapListing(r as Record<string, unknown>));
}

export async function getNewestListings(count = 20, country?: string): Promise<Listing[]> {
  let q = supabase
    .from('listings')
    .select('*, listing_images(url, sort_order)')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(count);
  if (country) q = q.eq('country', country);
  const { data } = await q;
  return (data ?? []).map(r => mapListing(r as Record<string, unknown>));
}

export async function getTrendingListings(count = 12, country?: string): Promise<Listing[]> {
  let q = supabase
    .from('listings')
    .select('*, listing_images(url, sort_order)')
    .eq('status', 'active')
    .order('view_count', { ascending: false })
    .limit(count);
  if (country) q = q.eq('country', country);
  const { data } = await q;
  return (data ?? []).map(r => mapListing(r as Record<string, unknown>));
}

export async function getRelatedListings(
  mainCategoryId: string,
  country: string,
  excludeId: string,
  count = 4
): Promise<Listing[]> {
  const { data } = await supabase
    .from('listings')
    .select('*, listing_images(url, sort_order)')
    .eq('status', 'active')
    .eq('category_id', mainCategoryId)
    .neq('id', excludeId)
    .limit(count);
  return (data ?? []).map(r => mapListing(r as Record<string, unknown>));
}

export async function getListingReviews(listingId: string): Promise<Review[]> {
  const { data } = await supabase
    .from('reviews')
    .select('*')
    .eq('listing_id', listingId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(20);
  return (data ?? []).map((d: Record<string, unknown>) => ({
    id: String(d.id ?? ''),
    listingId: String(d.listing_id ?? ''),
    sellerUid: String(d.seller_id ?? ''),
    buyerUid: String(d.reviewer_id ?? ''),
    buyerName: 'User',
    rating: typeof d.rating === 'number' ? d.rating : 5,
    comment: String(d.comment ?? ''),
    createdAt: String(d.created_at ?? ''),
    status: String(d.status ?? 'approved'),
  }));
}

// ─── Sellers ──────────────────────────────────────────────────────────────────

/** Lightweight seller-shop hit for the search suggestion dropdowns — just
 * enough to render a row and open the storefront (/shop/:uid). */
export interface ShopHit {
  uid: string; // sellers.user_id (auth uid)
  name: string;
  logoUrl?: string;
  isVerified: boolean;
  country: string;
  region: string;
}

/** Shop search — lets the search dropdowns surface matching seller storefronts
 * (by shop name or description) alongside product/service hits, so a buyer can
 * jump straight to a shop. Additive and self-contained: swallows any error and
 * returns [] so it can never break the existing listing search. */
export async function searchSellers(keyword: string, country?: string, limit = 6): Promise<ShopHit[]> {
  const k = keyword.trim();
  if (!k) return [];
  // Sanitize for the PostgREST or()-filter: commas/parentheses/percent/star
  // would otherwise be parsed as filter syntax.
  const safe = k.replace(/[,()%*]/g, ' ').trim();
  if (!safe) return [];
  try {
    let q = supabase
      .from('sellers')
      .select('user_id, shop_name, shop_logo_url, is_verified, country, region')
      .or(`shop_name.ilike.%${safe}%,shop_description.ilike.%${safe}%`);
    if (country && country.trim()) q = q.eq('country', country.trim());
    const { data } = await q.limit(limit);
    return (data ?? [])
      .map((d: Record<string, unknown>) => ({
        uid: String(d.user_id ?? ''),
        name: String(d.shop_name ?? ''),
        logoUrl: d.shop_logo_url ? String(d.shop_logo_url) : undefined,
        isVerified: Boolean(d.is_verified),
        country: String(d.country ?? ''),
        region: String(d.region ?? ''),
      }))
      .filter((s) => s.uid !== '' && s.name.trim() !== '');
  } catch {
    return [];
  }
}

export async function getSellerProfile(uid: string): Promise<SellerProfile | null> {
  const { data } = await supabase
    .from('sellers')
    .select('*')
    .eq('user_id', uid)
    .single();
  if (!data) return null;
  const d = data as Record<string, unknown>;
  return {
    uid: String(d.user_id ?? uid),
    businessName: String(d.shop_name ?? ''),
    businessPhone: String(d.phone ?? ''),
    operatingCountry: String(d.country ?? ''),
    operatingRegion: String(d.region ?? ''),
    businessLocationText: d.business_location_address ? String(d.business_location_address) : undefined,
    mainCategoryIds: [],
    serviceSubcategoryIds: [],
    isVerified: Boolean(d.is_verified),
    rating: typeof d.avg_rating === 'number' ? d.avg_rating : undefined,
    totalReviews: typeof d.review_count === 'number' ? d.review_count : undefined,
    bio: d.shop_description ? String(d.shop_description) : undefined,
    photoUrl: d.shop_logo_url ? String(d.shop_logo_url) : undefined,
    delivers: Boolean(d.delivers),
    createdAt: d.created_at ? String(d.created_at) : undefined,
  };
}

export async function getSellerListings(uid: string, count = 20): Promise<Listing[]> {
  // First get seller's internal id
  const { data: sellerRow } = await supabase
    .from('sellers')
    .select('id')
    .eq('user_id', uid)
    .single();
  if (!sellerRow) return [];
  // listings.seller_id holds the seller's auth uid (NOT sellers.id).
  const { data } = await supabase
    .from('listings')
    .select('*, listing_images(url, sort_order)')
    .eq('seller_id', uid)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(count);
  return (data ?? []).map(r => mapListing(r as Record<string, unknown>));
}

export async function getAllSellers(count = 40): Promise<SellerProfile[]> {
  const { data } = await supabase
    .from('sellers')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(count);
  return (data ?? []).map((d: Record<string, unknown>) => ({
    uid: String(d.user_id ?? d.id ?? ''),
    businessName: String(d.shop_name ?? ''),
    businessPhone: String(d.phone ?? ''),
    operatingCountry: String(d.country ?? ''),
    operatingRegion: String(d.region ?? ''),
    businessLocationText: undefined,
    mainCategoryIds: [],
    serviceSubcategoryIds: [],
    isVerified: Boolean(d.is_verified),
    rating: typeof d.avg_rating === 'number' ? d.avg_rating : undefined,
    totalReviews: typeof d.review_count === 'number' ? d.review_count : undefined,
    bio: d.shop_description ? String(d.shop_description) : undefined,
    photoUrl: d.shop_logo_url ? String(d.shop_logo_url) : undefined,
    createdAt: d.created_at ? String(d.created_at) : undefined,
  }));
}

export async function batchGetSellerHoursMap(
  ownerUids: string[]
): Promise<Map<string, SellerHoursInfo>> {
  const result = new Map<string, SellerHoursInfo>();
  const unique = [...new Set(ownerUids.filter(Boolean))];
  if (unique.length === 0) return result;
  // ownerUids are user_ids; sellers table keyed by user_id
  const { data } = await supabase
    .from('sellers')
    .select('user_id, open_24_hours, opening_time, closing_time, working_days')
    .in('user_id', unique);
  for (const d of (data ?? []) as Record<string, unknown>[]) {
    result.set(String(d.user_id ?? ''), {
      open24Hours: d.open_24_hours === true,
      openingTime: d.opening_time ? String(d.opening_time) : undefined,
      closingTime: d.closing_time ? String(d.closing_time) : undefined,
      workingDays: Array.isArray(d.working_days)
        ? (d.working_days as unknown[]).map(e => Number(e))
        : [],
    });
  }
  return result;
}

// ─── Newsletter ───────────────────────────────────────────────────────────────

export async function subscribeNewsletter(email: string): Promise<'ok' | 'exists' | 'invalid'> {
  const trimmed = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'invalid';
  const { error } = await supabase.from('newsletter_subscribers').insert({ email: trimmed, country: null });
  if (error) {
    if (error.code === '23505') return 'exists'; // unique constraint violation
    throw error;
  }
  return 'ok';
}

// ─── User Profile ─────────────────────────────────────────────────────────────

export async function createOrUpdateUserProfile(profile: UserProfile): Promise<void> {
  await supabase.from('profiles').upsert({
    id: profile.uid,
    email: profile.email,
    display_name: profile.displayName,
    avatar_url: profile.photoUrl ?? null,
    country: profile.country ?? null,
    region: profile.regionOrCity ?? null,
  });
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', uid)
    .single();
  if (!data) return null;
  const d = data as Record<string, unknown>;
  return {
    uid: String(d.id ?? uid),
    email: String(d.email ?? ''),
    displayName: String(d.display_name ?? ''),
    photoUrl: (d.avatar_url ?? d.photo_url) ? String(d.avatar_url ?? d.photo_url) : undefined,
    country: d.country ? String(d.country) : undefined,
    regionOrCity: d.region ? String(d.region) : undefined,
  };
}

// ─── My Listings ──────────────────────────────────────────────────────────────

export async function getMyListings(
  ownerUid: string,
  pageSize = 20,
  _lastDoc?: null,
): Promise<{ listings: Listing[]; lastDoc: null }> {
  // Get seller internal id first
  const { data: sellerRow } = await supabase
    .from('sellers')
    .select('id')
    .eq('user_id', ownerUid)
    .single();
  if (!sellerRow) return { listings: [], lastDoc: null };

  // listings.seller_id holds the seller's auth uid (NOT sellers.id).
  const { data } = await supabase
    .from('listings')
    .select('*, listing_images(url, sort_order)')
    .eq('seller_id', ownerUid)
    .order('created_at', { ascending: false })
    .limit(pageSize);
  return {
    listings: (data ?? []).map(r => mapListing(r as Record<string, unknown>)),
    lastDoc: null,
  };
}

// ─── Create / Update Listings ─────────────────────────────────────────────────

export async function createListing(
  data: Omit<Listing, 'id' | 'viewsCount' | 'savesCount' | 'messagesCount' | 'status'>,
  imageFiles: File[],
): Promise<string> {
  const imageUrls: string[] = [];
  for (const rawFile of imageFiles) {
    validateImageFile(rawFile);
    const file = await compressImage(rawFile);
    const path = `${data.ownerUid}/${Date.now()}_${file.name}`;
    const { data: uploadData } = await supabase.storage.from('listing-images').upload(path, file);
    if (uploadData) {
      const { data: { publicUrl } } = supabase.storage.from('listing-images').getPublicUrl(uploadData.path);
      imageUrls.push(publicUrl);
    }
  }

  // Get seller's internal id
  const { data: sellerRow } = await supabase
    .from('sellers')
    .select('id')
    .eq('user_id', data.ownerUid)
    .single();

  const sellerId = sellerRow ? (sellerRow as Record<string, unknown>).id : null;

  const { data: newListing } = await supabase
    .from('listings')
    .insert({
      seller_id: data.ownerUid,
      category_id: data.mainCategoryId || null,
      sub_category_id: data.subCategoryId ?? null,
      title: data.title,
      description: data.description,
      seller_name: data.sellerName ?? null,
      price: data.priceValue ?? null,
      price_text: data.priceText ?? null,
      currency: data.currencyCode ?? 'USD',
      condition: data.condition ?? null,
      country: data.country,
      region: data.regionOrCity ?? null,
      location_text: data.locationText ?? null,
      message_about_goods: data.messageAboutGoods ?? null,
      status: 'pending',
      is_negotiable: data.negotiable ?? false,
      is_flash_sale: data.isFlashSale ?? false,
      is_sponsored: data.isSponsored ?? false,
      view_count: 0,
      save_count: 0,
      unit_count: data.units ?? null,
      specifications: data.specifications && Object.keys(data.specifications).length > 0 ? data.specifications : null,
      original_price: data.originalPriceValue ?? null,
      original_price_text: data.originalPriceText ?? null,
      venue_latitude: data.venueLatitude ?? null,
      venue_longitude: data.venueLongitude ?? null,
    })
    .select('id')
    .single();

  const listingId = String((newListing as Record<string, unknown>)?.id ?? '');

  // Insert listing_images rows
  if (listingId && imageUrls.length > 0) {
    await supabase.from('listing_images').insert(
      imageUrls.map((url, sort_order) => ({ listing_id: listingId, url, sort_order }))
    );
  }

  return listingId;
}

export async function updateListing(id: string, updates: Partial<Listing>): Promise<void> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.title !== undefined) patch.title = updates.title;
  if (updates.description !== undefined) patch.description = updates.description;
  if (updates.priceValue !== undefined) patch.price = updates.priceValue;
  if (updates.priceText !== undefined) patch.price_text = updates.priceText;
  if (updates.currencyCode !== undefined) patch.currency = updates.currencyCode;
  if (updates.condition !== undefined) patch.condition = updates.condition;
  if (updates.country !== undefined) patch.country = updates.country;
  if (updates.regionOrCity !== undefined) patch.region = updates.regionOrCity;
  if (updates.locationText !== undefined) patch.location_text = updates.locationText;
  if (updates.negotiable !== undefined) patch.is_negotiable = updates.negotiable;
  if (updates.isFlashSale !== undefined) patch.is_flash_sale = updates.isFlashSale;
  if (updates.isSponsored !== undefined) patch.is_sponsored = updates.isSponsored;
  if (updates.mainCategoryId !== undefined) patch.category_id = updates.mainCategoryId;
  if (updates.subCategoryId !== undefined) patch.sub_category_id = updates.subCategoryId;
  if (updates.messageAboutGoods !== undefined) patch.message_about_goods = updates.messageAboutGoods;
  if (updates.units !== undefined) patch.unit_count = updates.units ?? null;
  await supabase.from('listings').update(patch).eq('id', id);
}

export async function deleteListing(id: string): Promise<void> {
  // Remove child image rows first (matches the app) so no orphans are left.
  await supabase.from('listing_images').delete().eq('listing_id', id);
  await supabase.from('listings').delete().eq('id', id);
}

export async function uploadListingImages(ownerUid: string, files: File[]): Promise<string[]> {
  const urls: string[] = [];
  for (const rawFile of files) {
    validateImageFile(rawFile);
    const file = await compressImage(rawFile);
    const path = `${ownerUid}/${Date.now()}_${file.name}`;
    const { data: uploadData } = await supabase.storage.from('listing-images').upload(path, file);
    if (uploadData) {
      const { data: { publicUrl } } = supabase.storage.from('listing-images').getPublicUrl(uploadData.path);
      urls.push(publicUrl);
    }
  }
  return urls;
}

export async function uploadAvatar(uid: string, rawFile: File): Promise<string> {
  validateImageFile(rawFile, MAX_AVATAR_SIZE);
  const file = await compressImage(rawFile, 800);
  const path = `${uid}_${Date.now()}`;
  const { data: uploadData } = await supabase.storage.from('avatars').upload(path, file);
  if (!uploadData) return '';
  const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(uploadData.path);
  return publicUrl;
}

// ─── Chat / Messaging ─────────────────────────────────────────────────────────

function mapThread(d: Record<string, unknown>): ChatThread {
  return {
    id: String(d.id ?? ''),
    participants: [String(d.buyer_id ?? ''), String(d.seller_id ?? '')].filter(Boolean),
    sellerUid: String(d.seller_id ?? ''),
    sellerName: String(d.seller_name ?? ''),
    buyerUid: String(d.buyer_id ?? ''),
    buyerName: String(d.buyer_name ?? ''),
    listingId: String(d.listing_id ?? ''),
    listingTitle: String(d.listing_title ?? ''),
    listingImageUrl: String(d.listing_image_url ?? ''),
    lastMessage: String(d.last_message ?? ''),
    lastSenderUid: '',
    updatedAt: d.last_message_at ? String(d.last_message_at) : '',
    unreadForSeller: typeof d.seller_unread_count === 'number' ? d.seller_unread_count : 0,
    unreadForBuyer: typeof d.buyer_unread_count === 'number' ? d.buyer_unread_count : 0,
  };
}

export function subscribeChatThreads(uid: string, cb: (threads: ChatThread[]) => void): () => void {
  // Initial load
  supabase
    .from('chats')
    .select('*')
    .or(`buyer_id.eq.${uid},seller_id.eq.${uid}`)
    .order('last_message_at', { ascending: false })
    .limit(50)
    .then(({ data }) => {
      cb((data ?? []).map(r => mapThread(r as Record<string, unknown>)));
    });

  // Channel name must be unique PER CALL: supabase.channel() returns the
  // existing instance for a repeated topic, and adding postgres_changes
  // callbacks to an already-subscribed channel throws. BottomNav (unread
  // badge) and the messages page both subscribe for the same uid, so a
  // shared name crashed whichever mounted second.
  const channel = supabase.channel(`chats:${uid}:${Date.now()}-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chats', filter: `buyer_id=eq.${uid}` }, () => {
      supabase
        .from('chats')
        .select('*')
        .or(`buyer_id.eq.${uid},seller_id.eq.${uid}`)
        .order('last_message_at', { ascending: false })
        .limit(50)
        .then(({ data }) => cb((data ?? []).map(r => mapThread(r as Record<string, unknown>))));
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chats', filter: `seller_id=eq.${uid}` }, () => {
      supabase
        .from('chats')
        .select('*')
        .or(`buyer_id.eq.${uid},seller_id.eq.${uid}`)
        .order('last_message_at', { ascending: false })
        .limit(50)
        .then(({ data }) => cb((data ?? []).map(r => mapThread(r as Record<string, unknown>))));
    })
    .subscribe();

  return () => supabase.removeChannel(channel);
}

export function subscribeChatMessages(threadId: string, cb: (msgs: ChatMessage[]) => void): () => void {
  // Initial load
  supabase
    .from('messages')
    .select('*')
    .eq('chat_id', threadId)
    .order('created_at', { ascending: true })
    .limit(200)
    .then(({ data }) => {
      cb((data ?? []).map((d: Record<string, unknown>) => ({
        id: String(d.id ?? ''),
        senderUid: String(d.sender_id ?? ''),
        text: String(d.content ?? ''),
        createdAt: d.created_at ? String(d.created_at) : '',
      })));
    });

  // Unique per call — same collision hazard as subscribeChatThreads above.
  const channel = supabase.channel(`messages:${threadId}:${Date.now()}-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${threadId}` }, () => {
      supabase
        .from('messages')
        .select('*')
        .eq('chat_id', threadId)
        .order('created_at', { ascending: true })
        .limit(200)
        .then(({ data }) => {
          cb((data ?? []).map((d: Record<string, unknown>) => ({
            id: String(d.id ?? ''),
            senderUid: String(d.sender_id ?? ''),
            text: String(d.content ?? ''),
            createdAt: d.created_at ? String(d.created_at) : '',
          })));
        });
    })
    .subscribe();

  return () => supabase.removeChannel(channel);
}

export async function sendMessage(
  threadId: string,
  thread: Omit<ChatThread, 'id' | 'unreadForSeller' | 'unreadForBuyer' | 'updatedAt'>,
  senderUid: string,
  text: string,
  isSeller: boolean,
): Promise<void> {
  const safeText = sanitizeText(text, 1000);
  if (!safeText) return;

  const now = new Date().toISOString();

  // Upsert chat thread
  await supabase.from('chats').upsert({
    id: threadId,
    listing_id: thread.listingId || null,
    buyer_id: thread.buyerUid,
    seller_id: thread.sellerUid,
    last_message: safeText,
    last_message_at: now,
    ...(isSeller
      ? { seller_unread_count: 0, buyer_unread_count: 1 }
      : { buyer_unread_count: 0, seller_unread_count: 1 }),
  });

  // Insert message
  await supabase.from('messages').insert({
    chat_id: threadId,
    sender_id: senderUid,
    content: safeText,
    is_read: false,
  });
}

export async function markThreadRead(threadId: string, isSeller: boolean): Promise<void> {
  const patch = isSeller
    ? { seller_unread_count: 0 }
    : { buyer_unread_count: 0 };
  await supabase.from('chats').update(patch).eq('id', threadId);
}

// ─── Saved / Wishlist ─────────────────────────────────────────────────────────

export async function getSavedIds(uid: string): Promise<string[]> {
  const { data } = await supabase
    .from('saved_listings')
    .select('listing_id')
    .eq('user_id', uid);
  return (data ?? []).map((r: Record<string, unknown>) => String(r.listing_id ?? ''));
}

export async function syncSavedIds(uid: string, ids: string[]): Promise<void> {
  // Delete existing, then insert new
  await supabase.from('saved_listings').delete().eq('user_id', uid);
  if (ids.length > 0) {
    await supabase.from('saved_listings').insert(
      ids.map(listing_id => ({ user_id: uid, listing_id }))
    );
  }
}

// ─── Price-Drop Alerts ───────────────────────────────────────────────────────
// When a seller LOWERS the price of a saved listing, the backend records a
// price_drop_events row for the user. The client only READS its own rows
// (RLS: auth.uid() = user_id). Best-effort: any failure returns an empty map so
// the Saved page degrades gracefully to its normal look.

export interface PriceDropEvent {
  listingId: string;
  oldPrice: number | null;
  newPrice: number | null;
  currency: string | null;
  seen: boolean;
  percent: number;
}

export async function getPriceDropEvents(
  uid: string,
): Promise<Record<string, PriceDropEvent>> {
  try {
    const { data } = await supabase
      .from('price_drop_events')
      .select('listing_id, old_price, new_price, currency, seen, created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(500);

    const map: Record<string, PriceDropEvent> = {};
    for (const r of (data ?? []) as Record<string, unknown>[]) {
      const listingId = String(r.listing_id ?? '');
      if (!listingId || map[listingId]) continue; // newest-first: keep latest
      const oldPrice = r.old_price != null ? Number(r.old_price) : null;
      const newPrice = r.new_price != null ? Number(r.new_price) : null;
      const percent =
        oldPrice != null && newPrice != null && oldPrice > 0 && newPrice < oldPrice
          ? Math.round(((oldPrice - newPrice) / oldPrice) * 100)
          : 0;
      map[listingId] = {
        listingId,
        oldPrice,
        newPrice,
        currency: r.currency != null ? String(r.currency) : null,
        seen: r.seen === true,
        percent,
      };
    }
    return map;
  } catch {
    return {};
  }
}

// ─── Saved Searches + Alerts ─────────────────────────────────────────────────
// A user keeps a search (keyword + filters). A background matcher fires a push
// when new listings match. Owner-only reads/writes (RLS on user_id).

export interface SavedSearchFilters {
  country?: string;
  region?: string;
  timeSort?: string;
  priceSort?: string;
  rating?: string;
  openNow?: boolean;
  nearMe?: boolean;
}

export interface SavedSearch {
  id: string;
  keyword: string;
  filters: SavedSearchFilters;
  createdAt: string | null;
}

export async function getSavedSearches(uid: string): Promise<SavedSearch[]> {
  const { data } = await supabase
    .from('saved_searches')
    .select('id, keyword, filters, created_at')
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
    .limit(200);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id ?? ''),
    keyword: String(r.keyword ?? ''),
    filters: (r.filters ?? {}) as SavedSearchFilters,
    createdAt: r.created_at ? String(r.created_at) : null,
  }));
}

export async function addSavedSearch(
  uid: string,
  keyword: string,
  filters: SavedSearchFilters,
): Promise<void> {
  const trimmed = keyword.trim();
  if (!trimmed) return;
  await supabase.from('saved_searches').insert({
    user_id: uid,
    keyword: trimmed,
    filters,
  });
}

export async function deleteSavedSearch(uid: string, id: string): Promise<void> {
  await supabase.from('saved_searches').delete().eq('user_id', uid).eq('id', id);
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export async function createReport(report: Report): Promise<void> {
  await supabase.from('reports').insert({
    reporter_id: report.reporterUid ?? null,
    listing_id: report.listingId ?? null,
    seller_id: null,
    reason: report.reason,
    details: report.details ?? null,
    status: 'pending',
  });
}

// ─── Promotion Requests ───────────────────────────────────────────────────────

export async function createPromotionRequest(req: Omit<PromotionRequest, 'status' | 'createdAt'>): Promise<string> {
  // Get seller internal id
  const { data: sellerRow } = await supabase
    .from('sellers')
    .select('id')
    .eq('user_id', req.uid)
    .single();

  const { data } = await supabase.from('promotions').insert({
    listing_id: req.listingId ?? null,
    seller_id: sellerRow ? (sellerRow as Record<string, unknown>).id : null,
    type: req.type,
    starts_at: new Date().toISOString(),
    ends_at: null,
    amount_paid: req.amount ?? 0,
    currency: req.currencyCode ?? 'USD',
    status: 'pending',
  }).select('id').single();

  return String((data as Record<string, unknown>)?.id ?? '');
}

export async function getMyPromotionRequests(uid: string): Promise<PromotionRequest[]> {
  const { data: sellerRow } = await supabase
    .from('sellers')
    .select('id')
    .eq('user_id', uid)
    .single();
  if (!sellerRow) return [];

  const { data } = await supabase
    .from('promotions')
    .select('*')
    .eq('seller_id', (sellerRow as Record<string, unknown>).id)
    .order('starts_at', { ascending: false })
    .limit(20);

  return (data ?? []).map((d: Record<string, unknown>) => ({
    uid,
    listingId: String(d.listing_id ?? ''),
    type: (d.type as 'sponsorListing' | 'flashSale') ?? 'sponsorListing',
    days: 7,
    paymentMethod: '',
    amount: typeof d.amount_paid === 'number' ? d.amount_paid : 0,
    currencyCode: String(d.currency ?? 'USD'),
    transactionReference: undefined,
    status: String(d.status ?? 'pending'),
    createdAt: d.starts_at ? String(d.starts_at) : undefined,
  }));
}

// ─── Seller Setup ─────────────────────────────────────────────────────────────

export async function createSellerProfile(
  profile: Omit<SellerProfile, 'isVerified' | 'rating' | 'totalReviews'>,
  extra?: Record<string, unknown>
): Promise<void> {
  const row: Record<string, unknown> = {
    user_id: profile.uid,
    shop_name: profile.businessName,
    shop_description: profile.bio ?? null,
    country: profile.operatingCountry,
    region: profile.operatingRegion,
    phone: profile.businessPhone ?? null,
    is_verified: false,
  };
  if (extra) {
    if (extra.contactNumber !== undefined) row.phone = extra.contactNumber;
    if (extra.description !== undefined) row.shop_description = extra.description;
    if (extra.isServiceProvider !== undefined) row.is_service_provider = extra.isServiceProvider;
    if (extra.open24Hours !== undefined) row.open_24_hours = extra.open24Hours;
    if (extra.openingTime !== undefined) row.opening_time = extra.openingTime;
    if (extra.closingTime !== undefined) row.closing_time = extra.closingTime;
    if (extra.workingDays !== undefined) row.working_days = extra.workingDays;
    if (extra.businessLocationAddress !== undefined) row.business_location_address = extra.businessLocationAddress;
    if (extra.businessLatitude !== undefined) row.business_latitude = extra.businessLatitude;
    if (extra.businessLongitude !== undefined) row.business_longitude = extra.businessLongitude;
    if (extra.delivers !== undefined) row.delivers = extra.delivers;
  }
  await supabase.from('sellers').insert(row);
}

export async function updateSellerProfile(uid: string, updates: Partial<SellerProfile>): Promise<void> {
  const u = updates as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (u.businessName !== undefined) patch.shop_name = u.businessName;
  if (u.bio !== undefined) patch.shop_description = u.bio;
  if (u.operatingCountry !== undefined) patch.country = u.operatingCountry;
  if (u.operatingRegion !== undefined) patch.region = u.operatingRegion;
  if (u.businessPhone !== undefined) patch.phone = u.businessPhone;
  // Extra fields passed from setup/edit pages (camelCase → snake_case)
  if (u.contactNumber !== undefined) patch.phone = u.contactNumber;
  if (u.description !== undefined) patch.shop_description = u.description;
  if (u.isServiceProvider !== undefined) patch.is_service_provider = u.isServiceProvider;
  if (u.open24Hours !== undefined) patch.open_24_hours = u.open24Hours;
  if (u.openingTime !== undefined) patch.opening_time = u.openingTime;
  if (u.closingTime !== undefined) patch.closing_time = u.closingTime;
  if (u.workingDays !== undefined) patch.working_days = u.workingDays;
  if (u.businessLocationAddress !== undefined) patch.business_location_address = u.businessLocationAddress;
  if (u.businessLatitude !== undefined) patch.business_latitude = u.businessLatitude;
  if (u.businessLongitude !== undefined) patch.business_longitude = u.businessLongitude;
  if (u.delivers !== undefined) patch.delivers = u.delivers;
  if (Object.keys(patch).length > 0) await supabase.from('sellers').update(patch).eq('user_id', uid);
}

// ─── Support ─────────────────────────────────────────────────────────────────

export function subscribeSupportMessages(
  uid: string,
  cb: (msgs: import('@/types').SupportMessage[]) => void
): () => void {
  const mapMsg = (d: Record<string, unknown>): import('@/types').SupportMessage => ({
    id: String(d.id ?? ''),
    senderUid: String(d.sender_id ?? ''),
    senderName: '',
    text: String(d.content ?? ''),
    isFromAdmin: Boolean(d.is_from_admin),
    createdAt: d.created_at ? String(d.created_at) : '',
  });

  // Get or create support ticket for this user
  const loadMessages = async (): Promise<string | null> => {
    const { data: ticket } = await supabase
      .from('support_tickets')
      .select('id')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (!ticket) { cb([]); return null; }
    const ticketId = String((ticket as Record<string, unknown>).id);
    const { data } = await supabase
      .from('support_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true })
      .limit(200);
    cb((data ?? []).map(d => mapMsg(d as Record<string, unknown>)));
    return ticketId;
  };

  // Subscribe only to THIS user's ticket. An unfiltered subscription would
  // make every open support screen receive (and re-query on) every other
  // user's support messages — a realtime fan-out problem at scale.
  // New users have no ticket until their first message; poll lightly until
  // one exists, then attach the filtered channel.
  let channel: ReturnType<typeof supabase.channel> | null = null;
  let disposed = false;
  (async () => {
    let ticketId = await loadMessages();
    while (!disposed && !ticketId) {
      await new Promise((r) => setTimeout(r, 4000));
      if (disposed) return;
      ticketId = await loadMessages();
    }
    if (disposed || !ticketId) return;
    channel = supabase.channel(`support:${uid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `ticket_id=eq.${ticketId}` }, () => {
        loadMessages();
      })
      .subscribe();
  })();

  return () => {
    disposed = true;
    if (channel) supabase.removeChannel(channel);
  };
}

export async function sendSupportMessage(
  uid: string,
  displayName: string,
  email: string,
  text: string,
): Promise<void> {
  const safeText = sanitizeText(text, 2000);
  if (!safeText) return;
  text = safeText;
  // Upsert support ticket
  let ticketId: string | null = null;
  const { data: existing } = await supabase
    .from('support_tickets')
    .select('id')
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (existing) {
    ticketId = String((existing as Record<string, unknown>).id ?? '');
  } else {
    const { data: newTicket } = await supabase
      .from('support_tickets')
      .insert({ user_id: uid, subject: `Support from ${displayName}`, status: 'open' })
      .select('id')
      .single();
    ticketId = newTicket ? String((newTicket as Record<string, unknown>).id ?? '') : null;
  }

  if (!ticketId) return;

  await supabase.from('support_messages').insert({
    ticket_id: ticketId,
    sender_id: uid,
    is_from_admin: false,
    content: text,
  });
}

export async function markSupportRead(_uid: string): Promise<void> {
  // No-op in Supabase model — read status tracked at message level if needed
}

// ─── Happenings (as listings) ─────────────────────────────────────────────────

export async function createHappening(
  data: Omit<Listing, 'id' | 'viewsCount' | 'savesCount' | 'messagesCount' | 'status'>,
  imageFiles: File[],
  videoFile?: File | null,
): Promise<string> {
  const imageUrls: string[] = [];
  for (const rawFile of imageFiles) {
    validateImageFile(rawFile);
    const file = await compressImage(rawFile);
    const path = `${data.ownerUid}/${Date.now()}_${file.name}`;
    const { data: uploadData } = await supabase.storage.from('listing-images').upload(path, file);
    if (uploadData) {
      const { data: { publicUrl } } = supabase.storage.from('listing-images').getPublicUrl(uploadData.path);
      imageUrls.push(publicUrl);
    }
  }

  // Optional promo video (happenings only) — uploaded raw to the shared bucket.
  let videoUrl: string | null = null;
  if (videoFile) {
    const ext = (videoFile.name.split('.').pop() || 'mp4').toLowerCase();
    const vpath = `${data.ownerUid}/${Date.now()}_video.${ext}`;
    const { data: vUp } = await supabase.storage.from('listing-images').upload(vpath, videoFile);
    if (vUp) videoUrl = supabase.storage.from('listing-images').getPublicUrl(vUp.path).data.publicUrl;
  }

  // Happenings are listings with is_happening = true (parity with the app),
  // so they share the same table, feed, moderation and seller ownership.
  const { data: newListing } = await supabase
    .from('listings')
    .insert({
      seller_id: data.ownerUid,
      category_id: data.mainCategoryId || 'happenings',
      sub_category_id: data.subCategoryId ?? null,
      title: data.title,
      description: data.description,
      seller_name: data.sellerName ?? null,
      price: data.priceValue ?? null,
      price_text: data.priceText ?? null,
      currency: data.currencyCode ?? 'USD',
      country: data.country ?? null,
      region: data.regionOrCity ?? null,
      location_text: data.locationText ?? null,
      image_url: imageUrls[0] ?? null,
      status: 'pending', // pending review
      is_happening: true,
      is_negotiable: false,
      is_flash_sale: false,
      is_sponsored: false,
      view_count: 0,
      save_count: 0,
      event_date: data.eventDate ?? null,
      venue_latitude: data.venueLatitude ?? null,
      venue_longitude: data.venueLongitude ?? null,
      video_url: videoUrl,
    })
    .select('id')
    .single();

  const listingId = String((newListing as Record<string, unknown>)?.id ?? '');
  if (listingId && imageUrls.length > 0) {
    await supabase.from('listing_images').insert(
      imageUrls.map((url, sort_order) => ({ listing_id: listingId, url, sort_order }))
    );
  }
  return listingId;
}

// ─── Search ───────────────────────────────────────────────────────────────────

export async function searchListings(searchTerm: string, count = 24): Promise<Listing[]> {
  const term = searchTerm.toLowerCase().trim();
  if (!term) return [];
  const { data } = await supabase
    .from('listings')
    .select('*, listing_images(url, sort_order)')
    .eq('status', 'active')
    .ilike('title', `%${term}%`)
    .limit(count);
  return (data ?? []).map(r => mapListing(r as Record<string, unknown>));
}
