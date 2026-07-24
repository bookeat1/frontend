import type { PushSubscriptionInput } from "@bookeat/api/admin";

/**
 * Web-push client helpers: service-worker registration, VAPID key handling and
 * the fiddly PushSubscription -> backend-shape conversion.
 *
 * The backend (pushsubscriptions.registerRequest -> webpush-go) decodes the
 * keys with base64.RawURLEncoding, so we emit base64url WITHOUT padding — which
 * is exactly what the browser's key material yields once encoded. Getting this
 * wrong is the classic "push never delivers" bug, so it lives in one place.
 */

/** VAPID public key, baked in at build time. Absent => the feature is hidden
 * and the whole flow is disabled (no crash). */
const VAPID_PUBLIC_KEY = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "").trim();

/** Base path the panel is served under (e.g. "/admin-preview" on test, "" in
 * dev). Next does NOT auto-prefix string literals, so the service-worker URL
 * and scope must include it explicitly. Kept in sync with `basePath` in
 * next.config at deploy time. */
const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");

const SW_URL = `${BASE_PATH}/sw.js`;
const SW_SCOPE = `${BASE_PATH}/`;

/** True when the browser can do web push AND a VAPID key was baked in. */
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    VAPID_PUBLIC_KEY.length > 0
  );
}

/** Whether a VAPID key is configured at all (used to hide the control on a
 * deploy that never set it, without inspecting browser capabilities). */
export function isPushConfigured(): boolean {
  return VAPID_PUBLIC_KEY.length > 0;
}

/** base64url (browser/RFC4648 §5, no padding) -> bytes, for applicationServerKey. */
function urlBase64ToUint8Array(base64url: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  // Construct over an explicit ArrayBuffer so the type is Uint8Array<ArrayBuffer>
  // (not <ArrayBufferLike>), which applicationServerKey's BufferSource requires.
  const buffer = new ArrayBuffer(raw.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** ArrayBuffer -> base64url without padding. This is the exact encoding the
 * backend's webpush-go expects (base64.RawURLEncoding). */
function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Extract p256dh + auth from a live PushSubscription and shape it for the
 * backend. Throws if the browser did not hand back both keys (should never
 * happen for a userVisibleOnly subscription, but we never send a partial one). */
export function toBackendSubscription(
  subscription: PushSubscription,
  restaurantId: string,
): PushSubscriptionInput {
  const p256dh = subscription.getKey("p256dh");
  const auth = subscription.getKey("auth");
  if (!p256dh || !auth) {
    throw new Error("PushSubscription is missing p256dh/auth keys");
  }
  return {
    restaurant_id: restaurantId,
    endpoint: subscription.endpoint,
    keys: {
      p256dh: arrayBufferToBase64Url(p256dh),
      auth: arrayBufferToBase64Url(auth),
    },
  };
}

/** Register the panel's service worker at the base-path-aware URL/scope and
 * wait until it is active. Reuses an existing registration if present. */
export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration(SW_SCOPE);
  if (existing) {
    await navigator.serviceWorker.ready;
    return existing;
  }
  await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
  return navigator.serviceWorker.ready;
}

/** Subscribe (or reuse an existing subscription) via the push manager using the
 * baked-in VAPID key as applicationServerKey. */
export async function subscribeToPush(
  registration: ServiceWorkerRegistration,
): Promise<PushSubscription> {
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
}

/** The already-registered subscription for this browser+scope, if any. */
export async function getExistingSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration(SW_SCOPE);
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}
