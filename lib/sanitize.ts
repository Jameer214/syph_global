export function sanitizeText(input: string | undefined | null, maxLength = 500): string {
  if (!input) return '';
  return input
    .normalize('NFC')
    // strip control characters (keep \t \n \r)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // strip zero-width and invisible Unicode characters
    .replace(/[​‌‍‏﻿­]/g, '')
    // strip HTML tags
    .replace(/<[^>]+>/g, '')
    // block javascript: URIs and inline event handlers
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    // collapse excessive whitespace
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLength);
}

export function sanitizeUrl(url: string | undefined | null): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

export function hasAnalyticsConsent(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('syph-cookie-consent') === 'all';
}
