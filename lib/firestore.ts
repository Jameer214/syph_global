import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  startAfter,
  startAt,
  endAt,
  serverTimestamp,
  documentId,
  DocumentSnapshot,
  QueryConstraint,
  onSnapshot,
  increment,
  Unsubscribe,
  Timestamp,
} from 'firebase/firestore';

/** Convert a Firestore Timestamp, plain Date, ISO string, or millis-number to ISO string. */
function tsToIso(val: unknown): string {
  if (!val) return '';
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'number') return new Date(val).toISOString();
  if (typeof val === 'object' && 'seconds' in (val as object)) {
    const ts = val as { seconds: number; nanoseconds?: number };
    return new Date(ts.seconds * 1000).toISOString();
  }
  return String(val);
}
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';
import type { Listing, SellerProfile, Review, SellerHoursInfo, ChatThread, ChatMessage, Report, PromotionRequest, UserProfile } from '@/types';

function mapListing(data: Record<string, unknown>, id: string): Listing {
  return {
    id,
    title: String(data.title ?? ''),
    description: String(data.description ?? ''),
    imageUrl: String(data.imageUrl ?? ''),
    imageUrls: Array.isArray(data.imageUrls)
      ? (data.imageUrls as string[])
      : undefined,
    videoUrl: data.videoUrl ? String(data.videoUrl) : undefined,
    bio: data.bio ? String(data.bio) : undefined,
    specifications:
      data.specifications &&
      typeof data.specifications === 'object' &&
      !Array.isArray(data.specifications)
        ? (data.specifications as Record<string, string>)
        : undefined,
    venueLatitude:
      typeof data.venueLatitude === 'number' ? data.venueLatitude : undefined,
    venueLongitude:
      typeof data.venueLongitude === 'number' ? data.venueLongitude : undefined,
    sellerName: String(data.sellerName ?? ''),
    ownerUid: String(data.ownerUid ?? ''),
    country: String(data.country ?? ''),
    regionOrCity: String(data.regionOrCity ?? ''),
    locationText: String(data.locationText ?? ''),
    priceText: data.priceText ? String(data.priceText) : undefined,
    priceValue:
      typeof data.priceValue === 'number' ? data.priceValue : undefined,
    currencyCode: String(data.currencyCode ?? 'USD'),
    negotiable: Boolean(data.negotiable),
    messageAboutGoods: data.messageAboutGoods
      ? String(data.messageAboutGoods)
      : undefined,
    mainCategoryId: String(data.mainCategoryId ?? ''),
    subCategoryId: data.subCategoryId ? String(data.subCategoryId) : undefined,
    rating: typeof data.rating === 'number' ? data.rating : undefined,
    condition: data.condition ? String(data.condition) : undefined,
    openNow: Boolean(data.openNow),
    isSponsored: Boolean(data.isSponsored),
    isHappening: Boolean(data.isHappening),
    isFlashSale: Boolean(data.isFlashSale),
    isTrial: Boolean(data.isTrial),
    status: String(data.status ?? 'pending'),
    viewsCount:
      typeof data.viewsCount === 'number' ? data.viewsCount : 0,
    savesCount:
      typeof data.savesCount === 'number' ? data.savesCount : 0,
    messagesCount:
      typeof data.messagesCount === 'number' ? data.messagesCount : 0,
    lastInteraction: data.lastInteraction
      ? String(data.lastInteraction)
      : undefined,
    createdAt: data.createdAt ? String(data.createdAt) : undefined,
    flashSaleEndsAt: data.flashSaleEndsAt
      ? String(data.flashSaleEndsAt)
      : undefined,
    originalPriceValue:
      typeof data.originalPriceValue === 'number' ? data.originalPriceValue : undefined,
    originalPriceText: data.originalPriceText
      ? String(data.originalPriceText)
      : undefined,
  };
}

export async function getListings(options: {
  pageSize?: number;
  lastDoc?: DocumentSnapshot;
  mainCategoryId?: string;
  subCategoryId?: string;
  country?: string;
  isSponsored?: boolean;
  isFlashSale?: boolean;
  isHappening?: boolean;
  orderByField?: string;
}): Promise<{ listings: Listing[]; lastDoc: DocumentSnapshot | null }> {
  const {
    pageSize = 20,
    lastDoc,
    mainCategoryId,
    subCategoryId,
    country,
    isSponsored,
    isFlashSale,
    isHappening,
    orderByField = 'createdAt',
  } = options;

  const constraints: QueryConstraint[] = [
    where('status', '==', 'approved'),
  ];

  if (mainCategoryId) constraints.push(where('mainCategoryId', '==', mainCategoryId));
  if (subCategoryId) constraints.push(where('subCategoryId', '==', subCategoryId));
  if (country) constraints.push(where('country', '==', country));
  if (isSponsored !== undefined) constraints.push(where('isSponsored', '==', isSponsored));
  if (isFlashSale !== undefined) constraints.push(where('isFlashSale', '==', isFlashSale));
  if (isHappening !== undefined) constraints.push(where('isHappening', '==', isHappening));

  constraints.push(orderBy(orderByField, 'desc'));
  if (lastDoc) constraints.push(startAfter(lastDoc));
  constraints.push(limit(pageSize));

  const q = query(collection(db, 'listings'), ...constraints);
  const snap = await getDocs(q);

  const listings = snap.docs.map((d) =>
    mapListing(d.data() as Record<string, unknown>, d.id)
  );
  const last = snap.docs[snap.docs.length - 1] ?? null;

  return { listings, lastDoc: last };
}

export async function getListing(id: string): Promise<Listing | null> {
  const snap = await getDoc(doc(db, 'listings', id));
  if (!snap.exists()) return null;
  return mapListing(snap.data() as Record<string, unknown>, snap.id);
}

function filterByCountry(listings: Listing[], country?: string): Listing[] {
  if (!country) return listings;
  const c = country.toLowerCase();
  return listings.filter((l) => l.country?.toLowerCase() === c);
}

export async function getSponsoredListings(count = 8, country?: string): Promise<Listing[]> {
  const constraints = [
    where('status', '==', 'approved'),
    where('isSponsored', '==', true),
    orderBy('createdAt', 'desc'),
  ];
  if (country) constraints.splice(2, 0, where('country', '==', country));
  const q = query(collection(db, 'listings'), ...constraints, limit(count));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapListing(d.data() as Record<string, unknown>, d.id));
}

export async function getFlashSaleListings(count = 12, country?: string): Promise<Listing[]> {
  const constraints = [
    where('status', '==', 'approved'),
    where('isFlashSale', '==', true),
    orderBy('createdAt', 'desc'),
  ];
  if (country) constraints.splice(2, 0, where('country', '==', country));
  const q = query(collection(db, 'listings'), ...constraints, limit(count));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapListing(d.data() as Record<string, unknown>, d.id));
}

export async function getHappenings(count = 8, country?: string): Promise<Listing[]> {
  const constraints = [
    where('status', '==', 'approved'),
    where('isHappening', '==', true),
    orderBy('createdAt', 'desc'),
  ];
  if (country) constraints.splice(2, 0, where('country', '==', country));
  const q = query(collection(db, 'listings'), ...constraints, limit(count));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapListing(d.data() as Record<string, unknown>, d.id));
}

export async function getNewestListings(count = 20, country?: string): Promise<Listing[]> {
  const constraints = [
    where('status', '==', 'approved'),
    orderBy('createdAt', 'desc'),
  ];
  if (country) constraints.splice(1, 0, where('country', '==', country));
  const q = query(collection(db, 'listings'), ...constraints, limit(count));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapListing(d.data() as Record<string, unknown>, d.id));
}

export async function getTrendingListings(count = 12, country?: string): Promise<Listing[]> {
  const constraints = [
    where('status', '==', 'approved'),
    orderBy('viewsCount', 'desc'),
  ];
  if (country) constraints.splice(1, 0, where('country', '==', country));
  const q = query(collection(db, 'listings'), ...constraints, limit(count));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapListing(d.data() as Record<string, unknown>, d.id));
}

export async function getSellerProfile(uid: string): Promise<SellerProfile | null> {
  const snap = await getDoc(doc(db, 'sellers', uid));
  if (!snap.exists()) return null;
  const d = snap.data() as Record<string, unknown>;
  return {
    uid: String(d.uid ?? uid),
    businessName: String(d.businessName ?? ''),
    businessPhone: String(d.businessPhone ?? ''),
    operatingCountry: String(d.operatingCountry ?? ''),
    operatingRegion: String(d.operatingRegion ?? ''),
    businessLocationText: d.businessLocationText
      ? String(d.businessLocationText)
      : undefined,
    mainCategoryIds: Array.isArray(d.mainCategoryIds)
      ? (d.mainCategoryIds as string[])
      : [],
    serviceSubcategoryIds: Array.isArray(d.serviceSubcategoryIds)
      ? (d.serviceSubcategoryIds as string[])
      : [],
    isVerified: Boolean(d.isVerified),
    rating: typeof d.rating === 'number' ? d.rating : undefined,
    totalReviews: typeof d.totalReviews === 'number' ? d.totalReviews : undefined,
    bio: d.bio ? String(d.bio) : undefined,
    photoUrl: d.photoUrl ? String(d.photoUrl) : undefined,
    createdAt: d.createdAt ? String(d.createdAt) : undefined,
  };
}

export async function getSellerListings(uid: string, count = 20): Promise<Listing[]> {
  const q = query(
    collection(db, 'listings'),
    where('ownerUid', '==', uid),
    where('status', '==', 'approved'),
    orderBy('createdAt', 'desc'),
    limit(count)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) =>
    mapListing(d.data() as Record<string, unknown>, d.id)
  );
}

export async function getListingReviews(listingId: string): Promise<Review[]> {
  const q = query(
    collection(db, 'reviews'),
    where('listingId', '==', listingId),
    where('status', '==', 'approved'),
    orderBy('createdAt', 'desc'),
    limit(20)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      listingId: String(data.listingId ?? ''),
      sellerUid: String(data.sellerUid ?? ''),
      buyerUid: String(data.buyerUid ?? ''),
      buyerName: String(data.buyerName ?? 'Anonymous'),
      rating: typeof data.rating === 'number' ? data.rating : 5,
      comment: String(data.comment ?? ''),
      createdAt: String(data.createdAt ?? ''),
      status: String(data.status ?? 'approved'),
    };
  });
}

export async function getRelatedListings(
  mainCategoryId: string,
  country: string,
  excludeId: string,
  count = 4
): Promise<Listing[]> {
  const q = query(
    collection(db, 'listings'),
    where('status', '==', 'approved'),
    where('mainCategoryId', '==', mainCategoryId),
    orderBy('createdAt', 'desc'),
    limit(count + 1)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => mapListing(d.data() as Record<string, unknown>, d.id))
    .filter((l) => l.id !== excludeId)
    .slice(0, count);
}

export async function getAllSellers(count = 40): Promise<import('@/types').SellerProfile[]> {
  const snap = await getDocs(
    query(collection(db, 'sellers'), orderBy('createdAt', 'desc'), limit(count))
  );
  return snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    return {
      uid: String(data.uid ?? d.id),
      businessName: String(data.businessName ?? ''),
      businessPhone: String(data.businessPhone ?? ''),
      operatingCountry: String(data.operatingCountry ?? ''),
      operatingRegion: String(data.operatingRegion ?? ''),
      businessLocationText: data.businessLocationText ? String(data.businessLocationText) : undefined,
      mainCategoryIds: Array.isArray(data.mainCategoryIds) ? (data.mainCategoryIds as string[]) : [],
      serviceSubcategoryIds: Array.isArray(data.serviceSubcategoryIds) ? (data.serviceSubcategoryIds as string[]) : [],
      isVerified: Boolean(data.isVerified),
      rating: typeof data.rating === 'number' ? data.rating : undefined,
      totalReviews: typeof data.totalReviews === 'number' ? data.totalReviews : undefined,
      bio: data.bio ? String(data.bio) : undefined,
      photoUrl: data.photoUrl ? String(data.photoUrl) : undefined,
      createdAt: data.createdAt ? String(data.createdAt) : undefined,
    };
  });
}

export async function batchGetSellerHoursMap(
  ownerUids: string[]
): Promise<Map<string, SellerHoursInfo>> {
  const result = new Map<string, SellerHoursInfo>();
  const unique = [...new Set(ownerUids.filter(Boolean))];
  if (unique.length === 0) return result;

  // Firestore `in` supports up to 30 items
  for (let i = 0; i < unique.length; i += 30) {
    const chunk = unique.slice(i, i + 30);
    const snap = await getDocs(
      query(collection(db, 'sellers'), where(documentId(), 'in', chunk))
    );
    for (const d of snap.docs) {
      const data = d.data() as Record<string, unknown>;
      result.set(d.id, {
        open24Hours: Boolean(data.open24Hours),
        openingTime: data.openingTime ? String(data.openingTime) : undefined,
        closingTime: data.closingTime ? String(data.closingTime) : undefined,
        workingDays: Array.isArray(data.workingDays)
          ? (data.workingDays as number[])
          : [],
      });
    }
  }
  return result;
}

export async function subscribeNewsletter(email: string): Promise<void> {
  await addDoc(collection(db, 'newsletterSubscribers'), {
    email,
    source: 'web_sell_page',
    createdAt: serverTimestamp(),
  });
}

// ─── User Profile ────────────────────────────────────────────────────────────

export async function createOrUpdateUserProfile(profile: UserProfile): Promise<void> {
  await setDoc(doc(db, 'users', profile.uid), {
    uid: profile.uid,
    email: profile.email,
    displayName: profile.displayName,
    photoUrl: profile.photoUrl ?? null,
    country: profile.country ?? null,
    regionOrCity: profile.regionOrCity ?? null,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  const d = snap.data() as Record<string, unknown>;
  return {
    uid: String(d.uid ?? uid),
    email: String(d.email ?? ''),
    displayName: String(d.displayName ?? ''),
    photoUrl: d.photoUrl ? String(d.photoUrl) : undefined,
    country: d.country ? String(d.country) : undefined,
    regionOrCity: d.regionOrCity ? String(d.regionOrCity) : undefined,
  };
}

// ─── My Listings (all statuses) ──────────────────────────────────────────────

export async function getMyListings(
  ownerUid: string,
  pageSize = 20,
  lastDoc?: DocumentSnapshot,
): Promise<{ listings: Listing[]; lastDoc: DocumentSnapshot | null }> {
  const constraints: QueryConstraint[] = [
    where('ownerUid', '==', ownerUid),
    orderBy('createdAt', 'desc'),
  ];
  if (lastDoc) constraints.push(startAfter(lastDoc));
  constraints.push(limit(pageSize));

  const snap = await getDocs(query(collection(db, 'listings'), ...constraints));
  return {
    listings: snap.docs.map((d) => mapListing(d.data() as Record<string, unknown>, d.id)),
    lastDoc: snap.docs[snap.docs.length - 1] ?? null,
  };
}

export async function createListing(
  data: Omit<Listing, 'id' | 'viewsCount' | 'savesCount' | 'messagesCount' | 'status'>,
  imageFiles: File[],
): Promise<string> {
  const imageUrls: string[] = [];
  for (const file of imageFiles) {
    const storageRef = ref(storage, `listings/${data.ownerUid}/${Date.now()}_${file.name}`);
    const snap = await uploadBytes(storageRef, file);
    const url = await getDownloadURL(snap.ref);
    imageUrls.push(url);
  }

  const docRef = await addDoc(collection(db, 'listings'), {
    ...data,
    imageUrl: imageUrls[0] ?? '',
    imageUrls,
    viewsCount: 0,
    savesCount: 0,
    messagesCount: 0,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateListing(id: string, updates: Partial<Listing>): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, ...rest } = updates;
  await updateDoc(doc(db, 'listings', id), { ...rest, updatedAt: serverTimestamp() });
}

export async function deleteListing(id: string): Promise<void> {
  await deleteDoc(doc(db, 'listings', id));
}

export async function uploadListingImages(ownerUid: string, files: File[]): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files) {
    const storageRef = ref(storage, `listings/${ownerUid}/${Date.now()}_${file.name}`);
    const snap = await uploadBytes(storageRef, file);
    urls.push(await getDownloadURL(snap.ref));
  }
  return urls;
}

export async function uploadAvatar(uid: string, file: File): Promise<string> {
  const storageRef = ref(storage, `avatars/${uid}_${Date.now()}`);
  const snap = await uploadBytes(storageRef, file);
  return getDownloadURL(snap.ref);
}

// ─── Chat / Messaging ─────────────────────────────────────────────────────────

function mapThread(d: Record<string, unknown>, id: string): ChatThread {
  return {
    id,
    participants: Array.isArray(d.participants) ? (d.participants as string[]) : [],
    sellerUid: String(d.sellerUid ?? ''),
    sellerName: String(d.sellerName ?? ''),
    buyerUid: String(d.buyerUid ?? ''),
    buyerName: String(d.buyerName ?? ''),
    listingId: String(d.listingId ?? ''),
    listingTitle: String(d.listingTitle ?? ''),
    listingImageUrl: String(d.listingImageUrl ?? ''),
    lastMessage: String(d.lastMessage ?? ''),
    lastSenderUid: String(d.lastSenderUid ?? ''),
    updatedAt: d.updatedAt ? String(d.updatedAt) : '',
    unreadForSeller: typeof d.unreadForSeller === 'number' ? d.unreadForSeller : 0,
    unreadForBuyer: typeof d.unreadForBuyer === 'number' ? d.unreadForBuyer : 0,
  };
}

export function subscribeChatThreads(uid: string, cb: (threads: ChatThread[]) => void): Unsubscribe {
  const q = query(
    collection(db, 'chats'),
    where('participants', 'array-contains', uid),
    orderBy('updatedAt', 'desc'),
    limit(50),
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => mapThread(d.data() as Record<string, unknown>, d.id)));
  });
}

export function subscribeChatMessages(threadId: string, cb: (msgs: ChatMessage[]) => void): Unsubscribe {
  const q = query(
    collection(db, 'chats', threadId, 'messages'),
    orderBy('createdAt', 'asc'),
    limit(200),
  );
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          senderUid: String(data.senderUid ?? ''),
          text: String(data.text ?? ''),
          createdAt: data.createdAt ? tsToIso(data.createdAt) : '',
        };
      }),
    );
  });
}

export async function sendMessage(
  threadId: string,
  thread: Omit<ChatThread, 'id' | 'unreadForSeller' | 'unreadForBuyer' | 'updatedAt'>,
  senderUid: string,
  text: string,
  isSeller: boolean,
): Promise<void> {
  const chatRef = doc(db, 'chats', threadId);
  await setDoc(
    chatRef,
    {
      ...thread,
      lastMessage: text,
      lastSenderUid: senderUid,
      updatedAt: serverTimestamp(),
      ...(isSeller
        ? { unreadForBuyer: increment(1), unreadForSeller: 0 }
        : { unreadForSeller: increment(1), unreadForBuyer: 0 }),
    },
    { merge: true },
  );
  await addDoc(collection(db, 'chats', threadId, 'messages'), {
    senderUid,
    text,
    createdAt: serverTimestamp(),
  });
}

export async function markThreadRead(threadId: string, isSeller: boolean): Promise<void> {
  await updateDoc(doc(db, 'chats', threadId), {
    ...(isSeller ? { unreadForSeller: 0 } : { unreadForBuyer: 0 }),
  });
}

// ─── Saved / Wishlist ─────────────────────────────────────────────────────────

export async function getSavedIds(uid: string): Promise<string[]> {
  const snap = await getDoc(doc(db, 'savedListings', uid));
  if (!snap.exists()) return [];
  const d = snap.data() as Record<string, unknown>;
  return Array.isArray(d.ids) ? (d.ids as string[]) : [];
}

export async function syncSavedIds(uid: string, ids: string[]): Promise<void> {
  await setDoc(doc(db, 'savedListings', uid), { ids, updatedAt: serverTimestamp() });
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export async function createReport(report: Report): Promise<void> {
  await addDoc(collection(db, 'reports'), {
    ...report,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
}

// ─── Promotion Requests ───────────────────────────────────────────────────────

export async function createPromotionRequest(req: Omit<PromotionRequest, 'status' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'promotionRequests'), {
    ...req,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getMyPromotionRequests(uid: string): Promise<PromotionRequest[]> {
  const q = query(
    collection(db, 'promotionRequests'),
    where('uid', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(20),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    return {
      uid: String(data.uid ?? ''),
      listingId: String(data.listingId ?? ''),
      type: (data.type as 'sponsorListing' | 'flashSale') ?? 'sponsorListing',
      days: typeof data.days === 'number' ? data.days : 7,
      paymentMethod: String(data.paymentMethod ?? ''),
      amount: typeof data.amount === 'number' ? data.amount : 0,
      currencyCode: String(data.currencyCode ?? 'USD'),
      transactionReference: data.transactionReference ? String(data.transactionReference) : undefined,
      status: String(data.status ?? 'pending'),
      createdAt: data.createdAt ? String(data.createdAt) : undefined,
    };
  });
}

// ─── Seller Setup ─────────────────────────────────────────────────────────────

export async function createSellerProfile(profile: Omit<SellerProfile, 'isVerified' | 'rating' | 'totalReviews'>): Promise<void> {
  await setDoc(doc(db, 'sellers', profile.uid), {
    ...profile,
    // store both naming conventions for Flutter app compatibility
    country: profile.operatingCountry,
    region: profile.operatingRegion,
    contactNumber: profile.businessPhone,
    isVerified: false,
    rating: 0,
    totalReviews: 0,
    createdAt: serverTimestamp(),
  });
}

export async function updateSellerProfile(uid: string, updates: Partial<SellerProfile>): Promise<void> {
  await updateDoc(doc(db, 'sellers', uid), { ...updates, updatedAt: serverTimestamp() });
}

// ─── Support / Admin Chat ─────────────────────────────────────────────────────

export function subscribeSupportMessages(
  uid: string,
  cb: (msgs: import('@/types').SupportMessage[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'supportChats', uid, 'messages'),
    orderBy('createdAt', 'asc'),
    limit(200),
  );
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          senderUid: String(data.senderUid ?? ''),
          senderName: String(data.senderName ?? ''),
          text: String(data.text ?? ''),
          isFromAdmin: Boolean(data.isFromAdmin),
          createdAt: data.createdAt ? tsToIso(data.createdAt) : '',
        };
      })
    );
  });
}

export async function sendSupportMessage(
  uid: string,
  displayName: string,
  email: string,
  text: string,
): Promise<void> {
  const chatRef = doc(db, 'supportChats', uid);
  await setDoc(chatRef, {
    userUid: uid,
    userName: displayName,
    userEmail: email,
    lastMessage: text,
    lastMessageAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    unreadForAdmin: increment(1),
    unreadForUser: 0,
  }, { merge: true });
  await addDoc(collection(db, 'supportChats', uid, 'messages'), {
    senderUid: uid,
    senderName: displayName,
    text,
    isFromAdmin: false,
    createdAt: serverTimestamp(),
  });
}

export async function markSupportRead(uid: string): Promise<void> {
  await updateDoc(doc(db, 'supportChats', uid), { unreadForUser: 0 }).catch(() => {});
}

// ─── Post Happenings ─────────────────────────────────────────────────────────

export async function createHappening(
  data: Omit<Listing, 'id' | 'viewsCount' | 'savesCount' | 'messagesCount' | 'status'>,
  imageFiles: File[],
): Promise<string> {
  const imageUrls: string[] = [];
  for (const file of imageFiles) {
    const storageRef = ref(storage, `listings/${data.ownerUid}/${Date.now()}_${file.name}`);
    const snap = await uploadBytes(storageRef, file);
    const url = await getDownloadURL(snap.ref);
    imageUrls.push(url);
  }
  const docRef = await addDoc(collection(db, 'listings'), {
    ...data,
    imageUrl: imageUrls[0] ?? '',
    imageUrls,
    isHappening: true,
    viewsCount: 0,
    savesCount: 0,
    messagesCount: 0,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function searchListings(searchTerm: string, count = 24): Promise<Listing[]> {
  const term = searchTerm.toLowerCase().trim();
  if (!term) return [];
  // Firestore prefix search on title (requires status+title composite index)
  // For full-text search at scale, migrate to Algolia or Typesense
  const q = query(
    collection(db, 'listings'),
    where('status', '==', 'approved'),
    orderBy('title'),
    startAt(term),
    endAt(term + ''),
    limit(count)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapListing(d.data() as Record<string, unknown>, d.id));
}
