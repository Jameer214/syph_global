# Scaling Notes for SYPH Global

## Current architecture
- Vercel Edge Network — automatic horizontal scaling, no config needed
- Firebase Firestore — NoSQL, automatic scaling to millions of documents
- Firebase Auth — managed, scales automatically

## For 1M+ users
1. **Enable Vercel Analytics** in dashboard — monitor real traffic patterns
2. **Firebase indexes** — add composite indexes for common queries (status+country+createdAt)
3. **Firestore read caching** — listings page uses onSnapshot (real-time); for static pages consider getDoc + React Query cache
4. **Images** — use Next.js Image component with Vercel image optimization for all listing images
5. **Upstash Redis** — add via Vercel Marketplace for server-side rate limiting and session caching

## Already handled by infrastructure
- Load balancing: Vercel Edge
- DDoS protection: Vercel + Cloudflare (if behind CF)
- Database scaling: Firestore
- Auth scaling: Firebase Auth
- File storage scaling: Firebase Storage (backed by Google Cloud)
