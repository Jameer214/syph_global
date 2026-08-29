export function sanitizeText(input: string | undefined | null, maxLength = 500): string {
  if (!input) return '';
  return input
    .normalize('NFC')
    // strip control characters (keep \t \n \r)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // strip zero-width and invisible Unicode characters
    .replace(/[​‌‍‏﻿­]/g, '')
    // strip HTML tags, then any residual angle brackets so no tag can be
    // reconstructed by a downstream renderer (app / admin / JSON-LD)
    .replace(/<[^>]+>/g, '')
    .replace(/[<>]/g, '')
    // block dangerous URI schemes and inline event handlers
    .replace(/(javascript|vbscript|data)\s*:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    // collapse excessive whitespace
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLength);
}

/**
 * Hygiene pass for an email before it is sent to auth / stored on a profile:
 * lower-cased, whitespace-free, only characters legal in an address. Not a
 * validity check — Supabase auth still validates the format.
 */
export function sanitizeEmail(input: string | undefined | null): string {
  if (!input) return '';
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[\x00-\x1F\x7F<>]/g, '')
    .replace(/[^a-z0-9.@_+\-]/g, '')
    .slice(0, 254);
}

/**
 * Build a safe ILIKE "contains" pattern for a search box: the term is cleaned,
 * then LIKE metacharacters (`\`, `%`, `_`) are escaped so they match literally
 * and a lone `%`/`_` can't become a match-everything wildcard. Returns
 * `%<escaped>%`.
 */
export function likeContains(input: string | undefined | null): string {
  const cleaned = sanitizeText(input, 100);
  const escaped = cleaned.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
  return `%${escaped}%`;
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
