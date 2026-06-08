export interface Listing {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  imageUrls?: string[];
  videoUrl?: string;
  bio?: string;
  specifications?: Record<string, string>;
  venueLatitude?: number;
  venueLongitude?: number;
  sellerName: string;
  ownerUid: string;
  country: string;
  regionOrCity: string;
  locationText: string;
  priceText?: string;
  priceValue?: number;
  currencyCode: string;
  negotiable: boolean;
  messageAboutGoods?: string;
  mainCategoryId: string;
  subCategoryId?: string;
  rating?: number;
  condition?: string;
  openNow: boolean;
  isSponsored: boolean;
  isHappening: boolean;
  isFlashSale: boolean;
  isTrial: boolean;
  status: string;
  viewsCount: number;
  savesCount: number;
  messagesCount: number;
  lastInteraction?: string;
  createdAt?: string;
  flashSaleEndsAt?: string;
  originalPriceValue?: number;
  originalPriceText?: string;
}

export interface CategoryNode {
  id: string;
  title: string;
  description: string;
  icon?: string;
  gradient?: string;
  children: SubCategory[];
}

export interface SubCategory {
  id: string;
  title: string;
}

export interface SellerProfile {
  uid: string;
  businessName: string;
  businessPhone: string;
  operatingCountry: string;
  operatingRegion: string;
  businessLocationText?: string;
  mainCategoryIds: string[];
  serviceSubcategoryIds: string[];
  isVerified?: boolean;
  rating?: number;
  totalReviews?: number;
  bio?: string;
  photoUrl?: string;
  createdAt?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoUrl?: string;
  country?: string;
  regionOrCity?: string;
}

export interface Review {
  id: string;
  listingId: string;
  sellerUid: string;
  buyerUid: string;
  buyerName: string;
  rating: number;
  comment: string;
  createdAt: string;
  status: string;
}

export interface SellerHoursInfo {
  open24Hours: boolean;
  openingTime?: string;   // "HH:mm"
  closingTime?: string;   // "HH:mm"
  workingDays: number[];  // 0=Mon … 6=Sun, empty = every day
}

export interface FilterState {
  country?: string;
  region?: string;
  mainCategoryId?: string;
  subCategoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  condition?: string;
  isSponsored?: boolean;
}

export interface ChatThread {
  id: string;
  participants: string[];
  sellerUid: string;
  sellerName: string;
  buyerUid: string;
  buyerName: string;
  listingId: string;
  listingTitle: string;
  listingImageUrl: string;
  lastMessage: string;
  lastSenderUid: string;
  updatedAt: string;
  unreadForSeller: number;
  unreadForBuyer: number;
}

export interface ChatMessage {
  id: string;
  senderUid: string;
  text: string;
  createdAt: string;
}

export interface Report {
  listingId: string;
  reporterUid: string;
  reporterName: string;
  reason: string;
  details?: string;
}

export interface PromotionRequest {
  uid: string;
  listingId: string;
  type: 'sponsorListing' | 'flashSale';
  days: number;
  paymentMethod: string;
  amount: number;
  currencyCode: string;
  transactionReference?: string;
  status: string;
  createdAt?: string;
}

export interface SupportMessage {
  id: string;
  senderUid: string;
  senderName: string;
  text: string;
  isFromAdmin: boolean;
  createdAt: string;
}

export interface SupportChat {
  userUid: string;
  userName: string;
  userEmail: string;
  lastMessage: string;
  lastMessageAt: string;
  updatedAt: string;
  unreadForAdmin: number;
  unreadForUser: number;
}
