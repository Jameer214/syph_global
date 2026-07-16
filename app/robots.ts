import type { MetadataRoute } from 'next';

const BASE_URL = 'https://www.syphglobal.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Keep account/auth pages out of search results.
      disallow: ['/dashboard', '/profile', '/messages', '/notifications', '/saved', '/login', '/signup'],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
