import { countryByIso2, type Country } from "./countries";

/**
 * A guess at the guest's country from their IP address, used only to preselect
 * the dial code in an EMPTY phone field. It is a convenience, never a gate:
 * any failure (offline, blocked by an extension, slow, unknown country) yields
 * `null` and the field stays on its default.
 *
 * The lookup is a third-party service called straight from the client
 * (country.is: keyless, CORS-enabled, answers `{ ip, country }`). Nothing but
 * the request itself is sent — no account data, no phone number.
 */
const ENDPOINT = "https://api.country.is/";

/** Long enough for a slow mobile network, short enough that a guest who
 * started typing is never overtaken by a late answer they did not ask for. */
const TIMEOUT_MS = 3000;

let pending: Promise<Country | null> | null = null;

async function lookup(): Promise<Country | null> {
  if (typeof fetch !== "function") return null;
  const controller = typeof AbortController === "function" ? new AbortController() : undefined;
  const timer = setTimeout(() => controller?.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(ENDPOINT, { signal: controller?.signal });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    const code = (body as { country?: unknown } | null)?.country;
    if (typeof code !== "string") return null;
    return countryByIso2(code.toUpperCase()) ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * One lookup per app session: every phone field on every screen shares the
 * same answer, and a failed lookup is not retried on each mount.
 */
export function guessCountryByIp(): Promise<Country | null> {
  pending ??= lookup();
  return pending;
}

/** Test seam: forget the memoized answer. */
export function resetIpCountryGuess(): void {
  pending = null;
}
