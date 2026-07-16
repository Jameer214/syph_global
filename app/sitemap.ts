import type { MetadataRoute } from 'next';
import { supabase } from '@/lib/supabase';

const BASE_URL = 'https://www.syphglobal.com';

// Regenerate the sitemap at most once an hour so new listings show up for
// crawlers without rebuilding the whole site.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // Public, crawlable pages. Auth/account pages (login, signup, dashboard,
  // profile, messages, notifications, saved, splash, welcome) are intentionally
  // left out — they hold no public content.
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE_URL}/categories`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/flash-sales`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE_URL}/happenings`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${BASE_URL}/general`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE_URL}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE_URL}/support`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE_URL}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE_URL}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
  ];

  // Every active listing becomes its own indexable URL.
  let listingRoutes: MetadataRoute.Sitemap = [];
  try {
    const { data } = await supabase
      .from('listings')
      .select('id, created_at')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(45000); // Google caps a single sitemap at 50,000 URLs.

    listingRoutes = (data ?? []).map((row) => ({
      url: `${BASE_URL}/listing/${row.id}`,
      lastModified: row.created_at ? new Date(row.created_at as string) : now,
      changeFrequency: 'weekly',
      priority: 0.6,
    }));
  } catch {
    // If Supabase is unreachable at build/revalidate time, still ship the
    // static routes rather than failing the whole sitemap.
  }

  return [...staticRoutes, ...listingRoutes];
}
