import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

export const revalidate = 3600;

async function fetchListingMeta(id: string): Promise<{
  title: string;
  description: string;
  imageUrl: string;
  locationText: string;
  price: string;
} | null> {
  try {
    const { data } = await supabase
      .from('listings')
      .select('title, description, image_url, location_text, price, price_text, currency, status, listing_images(url, sort_order)')
      .eq('id', id)
      .single();

    if (!data || data.status !== 'active') return null;

    const row = data as Record<string, unknown>;

    // Prefer the first ordered gallery image, fall back to legacy image_url.
    const imgs = Array.isArray(row.listing_images)
      ? [...(row.listing_images as { url: string; sort_order?: number }[])].sort(
          (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
        )
      : [];
    const imageUrl = imgs[0]?.url ?? String(row.image_url ?? '');

    const currency = String(row.currency ?? 'USD');
    const priceText = String(row.price_text ?? '');
    const priceValue = typeof row.price === 'number' ? row.price : undefined;
    const price = priceText || (priceValue != null ? `${currency} ${priceValue.toLocaleString()}` : '');

    return {
      title: String(row.title ?? ''),
      description: String(row.description ?? ''),
      imageUrl,
      locationText: String(row.location_text ?? ''),
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

  const canonical = `/listing/${id}`;
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
    alternates: { canonical },
    openGraph: {
      title: metaTitle,
      description: metaDesc,
      url: canonical,
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
