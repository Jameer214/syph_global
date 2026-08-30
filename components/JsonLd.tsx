/**
 * Renders a JSON-LD structured-data block as a native <script> tag.
 * Next.js recommends a plain <script> (not next/script) for JSON-LD since it's
 * data, not executable code. `<` is escaped to < to prevent XSS via the
 * JSON payload (per the Next.js JSON-LD guide).
 */
export default function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
