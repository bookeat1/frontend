/**
 * Server-rendered map preview: `GET /restaurants/:id/map`.
 *
 * The backend proxies the map provider so the provider key never reaches a
 * mobile bundle (see backend ADR-012). The endpoint is public — no token, no
 * headers — and answers with a PNG, so the client's whole job is to build a
 * URL and hand it to an <Image>.
 *
 * The failure bodies are JSON with a machine-readable `code`
 * (`map_not_configured` 503, `map_provider_unavailable` / `map_provider_rate_limited`
 * 503, `map_no_coordinates` 404, `not_found` 404, `validation_failed` 422) —
 * an <Image> cannot read them, so the UI treats any load failure as "no map"
 * and only reaches for the body when it wants to know WHY (see the mobile
 * `lib/map-preview.ts` session latch).
 */

/** The three whitelisted presets, in server pixels at scale 1:
 * card 320x180, detail 480x270, wide 640x360 — all 16:9. */
export type MapPreviewSize = "card" | "detail" | "wide";

/** 1 or 2 only. 2 is the HiDPI render (the server doubles the pixels, not the
 * covered area). */
export type MapPreviewScale = 1 | 2;

export interface MapPreviewOptions {
  size?: MapPreviewSize;
  scale?: MapPreviewScale;
  /** 14..18. Values outside the range are clamped HERE, on purpose: the server
   * answers 422 rather than clamping, and a 422 from our own code would be a
   * bug we shipped, not a state the guest should ever see. */
  zoom?: number;
}

/** Every preset is 16:9, so a container can reserve the right box before the
 * bytes arrive. */
export const MAP_PREVIEW_ASPECT_RATIO = 16 / 9;

const MIN_ZOOM = 14;
const MAX_ZOOM = 18;

function clampZoom(zoom: number | undefined): number | undefined {
  if (zoom === undefined) return undefined;
  if (!Number.isFinite(zoom)) return undefined;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(zoom)));
}

/**
 * Builds the map-preview URL for one venue.
 *
 * Only whitelisted values are ever sent, so `validation_failed` is
 * unreachable from this code path. Parameters equal to the server default
 * (detail / 1 / 16) are still sent explicitly — the URL is also a cache key
 * for the HTTP layer on the device, and an explicit URL keeps that key stable
 * if the server default ever moves.
 */
export function buildMapPreviewUrl(
  apiBaseUrl: string,
  restaurantId: string,
  options: MapPreviewOptions = {},
): string {
  const base = apiBaseUrl.replace(/\/+$/, "");
  const params = new URLSearchParams({
    size: options.size ?? "detail",
    scale: String(options.scale ?? 1),
    zoom: String(clampZoom(options.zoom) ?? 16),
  });
  return `${base}/restaurants/${encodeURIComponent(restaurantId)}/map?${params.toString()}`;
}
