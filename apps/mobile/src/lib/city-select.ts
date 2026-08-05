/**
 * A one-shot mailbox for handing a picked city back from `app/city` to
 * whichever screen opened it.
 *
 * expo-router navigates between separate route components and `router.back()`
 * carries no payload, so a full-screen picker cannot set the caller's state
 * directly. Rather than thread the city through URL params (and re-parse it on
 * a screen that is still mounted underneath in the stack), the caller leaves a
 * handler here BEFORE navigating; the picker calls it on selection and pops.
 *
 * The handler closes over the caller's own setState — which stays valid because
 * a pushed screen keeps the previous one mounted. Exactly one selection is in
 * flight at a time: requesting again replaces the pending handler, and
 * resolving clears it, so an abandoned pick cannot fire into a later caller.
 *
 * `null` means "cleared" — the filter reads it as «все города», the profile
 * field as «город не указан». Each caller maps it to its own empty value.
 */
type CitySelectionHandler = (city: string | null) => void;

let pending: CitySelectionHandler | null = null;

/** Register the handler that the next `/city` selection should call. */
export function requestCitySelection(handler: CitySelectionHandler): void {
  pending = handler;
}

/** Called by the city screen when the guest taps a city (or the clear row).
 * Fires the pending handler once, then forgets it. */
export function resolveCitySelection(city: string | null): void {
  const handler = pending;
  pending = null;
  handler?.(city);
}
