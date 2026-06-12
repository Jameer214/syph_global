// SYPH load test — simulates concurrent browsers hitting the hot read paths
// (home feeds, explore page, search RPC) directly against Supabase.
//
// Usage:
//   node scripts/load-test.mjs [concurrency] [iterations-per-worker]
//   node scripts/load-test.mjs 50 20
//
// Reads NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY from
// .env.local automatically. Watch latency in the output AND the System
// Monitor screen in syph_admin while it runs.
//
// Start small (10 workers), then 50, then 200. p95 under ~300ms = healthy.

import { readFileSync } from 'node:fs';

function loadEnv() {
  const env = {};
  try {
    for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m) env[m[1]] = m[2].trim();
    }
  } catch { /* fall through to process.env */ }
  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

const { url, key } = loadEnv();
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (run from syph_global/)');
  process.exit(1);
}

const CONCURRENCY = parseInt(process.argv[2] ?? '20', 10);
const ITERATIONS = parseInt(process.argv[3] ?? '10', 10);

const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

// The same read shapes the real clients issue.
const scenarios = [
  { name: 'home: newest feed', fn: () => fetch(`${url}/rest/v1/listings?select=*,listing_images(url,sort_order)&status=eq.active&order=created_at.desc&limit=16`, { headers }) },
  { name: 'home: sponsored', fn: () => fetch(`${url}/rest/v1/listings?select=*,listing_images(url,sort_order)&status=eq.active&is_sponsored=eq.true&order=updated_at.desc&limit=12`, { headers }) },
  { name: 'home: flash sales', fn: () => fetch(`${url}/rest/v1/listings?select=*,listing_images(url,sort_order)&status=eq.active&is_flash_sale=eq.true&order=updated_at.desc&limit=12`, { headers }) },
  { name: 'category page', fn: () => fetch(`${url}/rest/v1/listings?select=*,listing_images(url,sort_order)&status=eq.active&category_id=eq.vehicles&order=created_at.desc&limit=24`, { headers }) },
  { name: 'search RPC', fn: () => fetch(`${url}/rest/v1/rpc/search_listings`, { method: 'POST', headers, body: JSON.stringify({ search_term: 'car', country_filter: null, region_filter: null, category_filter: null, max_results: 20 }) }) },
];

const results = new Map(scenarios.map(s => [s.name, { times: [], errors: 0 }]));

async function worker() {
  for (let i = 0; i < ITERATIONS; i++) {
    for (const s of scenarios) {
      const t0 = performance.now();
      try {
        const res = await s.fn();
        await res.text();
        if (!res.ok) results.get(s.name).errors++;
        else results.get(s.name).times.push(performance.now() - t0);
      } catch {
        results.get(s.name).errors++;
      }
    }
  }
}

function pct(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

console.log(`SYPH load test → ${CONCURRENCY} workers × ${ITERATIONS} iterations × ${scenarios.length} scenarios`);
console.log(`Target: ${url}\n`);
const started = performance.now();
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
const wall = ((performance.now() - started) / 1000).toFixed(1);

let totalReqs = 0;
for (const [name, r] of results) {
  totalReqs += r.times.length + r.errors;
  const p50 = pct(r.times, 50).toFixed(0).padStart(5);
  const p95 = pct(r.times, 95).toFixed(0).padStart(5);
  const p99 = pct(r.times, 99).toFixed(0).padStart(5);
  const flag = pct(r.times, 95) > 500 ? '  ⚠ SLOW' : pct(r.times, 95) > 300 ? '  ⚠ watch' : '';
  console.log(`${name.padEnd(22)} ok=${String(r.times.length).padStart(5)}  err=${String(r.errors).padStart(3)}  p50=${p50}ms  p95=${p95}ms  p99=${p99}ms${flag}`);
}
console.log(`\n${totalReqs} requests in ${wall}s (~${Math.round(totalReqs / wall)} req/s sustained)`);
