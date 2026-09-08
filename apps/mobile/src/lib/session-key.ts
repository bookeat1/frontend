/**
 * The one storage key `auth.tsx` persists the guest session under.
 *
 * Pulled out of `auth.tsx` into its own file (MW-4, ADR-046) so
 * `secure-store.web.ts` can special-case exactly this key — to fan it out
 * into `apps/web`'s session format instead of storing it as a mobile-shaped
 * JSON blob — without importing from `auth.tsx` itself (that would be
 * circular: `auth.tsx` imports `./secure-store`, and `./secure-store.web`
 * would need `auth.tsx`'s `SESSION_KEY`).
 *
 * Native (iOS/Android) behaviour is unaffected: `secure-store.ts` re-exports
 * `expo-secure-store` untouched, and this key is just the same string
 * `auth.tsx` used to define locally — no format, no value changed there.
 */
export const SESSION_KEY = "bookeat.session.v1";
