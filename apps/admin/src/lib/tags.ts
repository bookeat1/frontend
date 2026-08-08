/**
 * Event tags UX helpers. The admin form takes tags as a single
 * comma-separated text field (no heavy chips widget); these functions bridge
 * that string to the `string[]` the backend expects and back.
 */

/**
 * Parse a comma-separated tag string into a clean list: trim each tag, drop
 * blanks, and dedupe case-insensitively while keeping the first spelling the
 * user typed. Order is preserved. The backend also trims and caps the count —
 * this is UX, not the safety boundary.
 */
export function parseTags(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const tag = part.trim();
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

/** Render a tag list back into the comma-separated text the field shows. */
export function formatTags(tags: string[] | undefined): string {
  return tags?.join(", ") ?? "";
}
