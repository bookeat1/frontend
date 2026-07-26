/**
 * Session-level state for the server-rendered map preview
 * (`GET /restaurants/:id/map`, backend ADR-012).
 *
 * ## The problem
 *
 * An <Image> can only tell us "it did not load" — it cannot read the JSON
 * error body, so from the image alone we cannot tell "this environment has no
 * map provider configured at all" (503 `map_not_configured`, currently the
 * state of the test backend: the 2GIS key has not arrived) from "this one
 * venue has no coordinates" or "the network blinked". Without that
 * distinction the app would fire one doomed image request per venue for the
 * whole session.
 *
 * ## What this does, and why this shape
 *
 * Optimistic first, one diagnosis after a failure:
 *
 *  1. The image is requested normally. In the happy path (a key IS configured)
 *     this costs exactly zero extra requests — no probe, no HEAD, nothing.
 *  2. If it fails, ONE cheap `fetch` of the same URL reads the JSON body and
 *     its machine-readable `code`. That request is single-flight for the whole
 *     session (`diagnosis`), so a burst of screens still produces one.
 *  3. `map_not_configured` is an ENVIRONMENT-level answer, not a venue-level
 *     one — the backend checks the provider before it even looks the
 *     restaurant up (verified: an unknown uuid and a venue with no coordinates
 *     both answer `map_not_configured` on test today). So we latch it off for
 *     the rest of the process and stop asking for any venue's map.
 *
 * The alternative — a probe request on startup or before the first image —
 * was rejected: it puts an extra request on the critical path of every cold
 * start forever, in order to speed up a state (no key) that is temporary by
 * definition. This way the cost is paid only when a map has actually failed.
 *
 * The latch is deliberately one-way and process-scoped: no persistence, no
 * dependency, no timers. Deploying the key restarts the backend, and the guest
 * gets maps on the app's next cold start; nothing here needs to expire.
 *
 * Other codes (`map_provider_unavailable`, `map_provider_rate_limited`,
 * `map_no_coordinates`, `not_found`) do NOT latch: the first two are transient
 * and the last two are about one venue, which the component already handles by
 * not re-requesting that URL.
 */

/** Codes the server can put in the error envelope for this endpoint. Only
 * `map_not_configured` is acted upon globally — the rest are listed so the
 * next reader does not have to re-derive them from the backend. */
const CODE_NOT_CONFIGURED = "map_not_configured";

const DIAGNOSIS_TIMEOUT_MS = 5000;

let notConfigured = false;
let diagnosis: Promise<void> | null = null;

/** False once this environment has told us it has no map provider. */
export function mapPreviewsEnabled(): boolean {
  return !notConfigured;
}

/**
 * Asks the endpoint (once per session) WHY an image failed, and latches maps
 * off if the answer is "this deployment has no map provider".
 *
 * Never throws and never rejects: a failed diagnosis simply leaves the latch
 * as it was — a network error must not be mistaken for "this backend has no
 * maps", or one bad tunnel would kill map previews for the whole session.
 */
export function diagnoseMapFailure(url: string): Promise<void> {
  if (notConfigured) return Promise.resolve();
  if (!diagnosis) {
    diagnosis = runDiagnosis(url).finally(() => {
      // Cleared so a later, genuinely different failure can be diagnosed
      // again. It cannot loop: a component only calls this when an image it
      // rendered has failed, and it does not re-render that image afterwards.
      diagnosis = null;
    });
  }
  return diagnosis;
}

async function runDiagnosis(url: string): Promise<void> {
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(DIAGNOSIS_TIMEOUT_MS),
    });
    if (response.ok) return; // The image failed for a decoding/caching reason, not a server one.
    const body: unknown = await response.json();
    if (codeOf(body) === CODE_NOT_CONFIGURED) {
      notConfigured = true;
    }
  } catch {
    // Offline, timeout, or a non-JSON body (an HTML error page from a proxy).
    // Not enough to conclude anything about the environment.
  }
}

/** Reads `code` out of the standard error envelope without trusting its
 * shape — this body arrives from the network, not from our own types. */
function codeOf(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const code = (body as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

/** Test/debug helper: forget what we learned. Not used by the app. */
export function resetMapPreviewLatch(): void {
  notConfigured = false;
  diagnosis = null;
}
