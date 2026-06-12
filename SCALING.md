# SYPH Scaling Notes (Supabase era)

Last audited: 2026-06-13. The previous version of this file described the
old Firebase architecture and was misleading — Postgres does not "scale
automatically"; it scales as well as the query patterns, indexes, and
connection usage allow.

## Architecture
- Three clients (syph Flutter app, syph_global Next.js on Vercel,
  syph_admin Flutter) talk directly to Supabase (Postgres + PostgREST +
  Realtime + Auth + Storage) with the anon key; security is RLS.
- Firebase remains only for FCM push and Crashlytics.

## Done (2026-06-13 scaling pass)
1. **Feeds off realtime** — Flutter home feeds are one-shot fetches with
   server-side flag filters + pull-to-refresh (was: postgres_changes
   streams per user, the hard concurrency ceiling). admin_settings reads
   go through a 10-min client cache. Web support channel is filtered to
   the user's own ticket.
2. **Indexes** — `idx_*` composite/partial indexes for every hot query
   (status+country/category+created_at, partial indexes on promoted flags,
   chats/messages/reviews/sellers paths) + pg_trgm GIN indexes for search.
3. **Search** — `search_listings` RPC (trigram-indexed, server-ranked,
   whole catalog) used by both apps, with legacy fallback.
4. **Pagination** — keyset (created_at cursor) on web explore and
   category/subcategory pages; Flutter category screen uses offset pages.
5. **Images** — client-side downscale before upload (web canvas 1600px /
   q0.82; Flutter 1280px / q75); web cards use next/image with the
   Supabase storage host whitelisted (AVIF/WebP via Vercel CDN).
6. **Write churn** — view counts once per listing per app session;
   message counter folded into a single RPC write.
7. **Read reuse** — 60s session cache for web home feed queries.

## Known limits / next steps (in rough priority order)
- **Realtime still on**: chat threads/messages, saved, notifications,
  profile/seller streams. Fine for now; if realtime concurrency becomes
  the bottleneck again, move badges to polling and keep only the open
  chat thread live (consider Realtime `broadcast` instead of
  postgres_changes).
- **Server-side rate limiting**: lib/rateLimit.ts is client-side UX only.
  Sensitive RPCs (counters, auth flows) should eventually sit behind
  Supabase Edge Functions with real limits.
- **Web data caching**: pages are client-rendered; identical home feeds
  are fetched per visitor. ISR/server components with `revalidate` would
  collapse those reads at high traffic.
- **Near Me** is client-side haversine over the loaded page only — use
  PostGIS/earthdistance for true distance queries.
- **Admin dashboard counts** are exact full scans — switch to estimated
  counts or a stats table when tables grow.
- **Listing detail / other pages** still use raw <img> in places; migrate
  to next/image as touched.
- Supabase plan ceilings to watch: realtime concurrent connections,
  storage egress, DB compute. Upgrade tier before marketing pushes.
