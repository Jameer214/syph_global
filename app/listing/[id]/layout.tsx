import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const revalidate = 3600;

interface FirestoreField {
  stringValue?: string;
  doubleValue?: number;
  integerValue?: string;
  booleanValue?: boolean;
}

async function fetchListingMeta(id: string): Promise<{
  title: string;
  description: string;
  imageUrl: string;
  locationText: string;
  price: string;
} | null> {
  try {
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/syph-733fb/databases/(default)/documents/listings/${id}`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const f: Record<string, FirestoreField> = data.fields ?? {};

    const status = f.status?.stringValue ?? '';
    if (status !== 'approved') return null;

    const priceValue = f.priceValue?.doubleValue ?? Number(f.priceValue?.integerValue ?? 0);
    const currencyCode = f.currencyCode?.stringValue ?? 'USD';
    const priceText = f.priceText?.stringValue ?? '';
    const price = priceText || (priceValue ? `${currencyCode} ${priceValue.toLocaleString()}` : '');

    return {
      title: f.title?.stringValue ?? '',
      description: f.description?.stringValue ?? '',
      imageUrl: f.imageUrl?.stringValue ?? '',
      locationText: f.locationText?.stringValue ?? '',
      price,
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const listing = await fetchListingMeta(id);

  if (!listing || !listing.title) {
    return {
      title: 'Listing — SYPH Marketplace',
      description: "Find what you're looking for on SYPH.",
    };
  }

  const metaTitle = `${listing.title} — SYPH`;
  const parts = [
    listing.description.slice(0, 120),
    listing.locationText,
    listing.price,
  ].filter(Boolean);
  const metaDesc = parts.join(' • ') || "Find listings on SYPH — Africa's marketplace";

  return {
    title: metaTitle,
    description: metaDesc,
    openGraph: {
      title: metaTitle,
      description: metaDesc,
      images: listing.imageUrl
        ? [{ url: listing.imageUrl, width: 800, height: 600, alt: listing.title }]
        : [],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: metaTitle,
      description: metaDesc,
      images: listing.imageUrl ? [listing.imageUrl] : [],
    },
  };
}

export default function ListingLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
