/**
 * The one thing push has to do BEFORE the session disappears.
 *
 * `DELETE /devices/push-tokens` is authenticated, so it has to go out while
 * the guest is still signed in. AuthProvider owns sign-out and knows nothing
 * about push, and PushProvider mounts under it — so the hook is published into
 * a module-scoped cell, exactly the way AuthProvider publishes the session
 * gateway into token-store.ts. Same reason: a provider cannot reach into a
 * context that is above it.
 */
type PushSignOutHook = () => Promise<void>;

let hook: PushSignOutHook | null = null;

export function setPushSignOutHook(next: PushSignOutHook | null): void {
  hook = next;
}

/**
 * Runs the hook if one is registered, and NEVER rejects and never hangs.
 *
 * Sign-out is not allowed to depend on the network: a guest on a dead
 * connection taps «Выйти» and must be signed out, not left watching a spinner
 * until the HTTP client's own 8-second timeout fires. Two seconds is enough
 * for the request to make it out on a working connection and short enough not
 * to be felt on a broken one; if it loses the race, the device simply stays
 * registered until Expo reports it gone.
 */
const SIGN_OUT_BUDGET_MS = 2000;

export async function runPushSignOutHook(): Promise<void> {
  const current = hook;
  if (!current) return;
  try {
    await Promise.race([
      current(),
      new Promise<void>((resolve) => setTimeout(resolve, SIGN_OUT_BUDGET_MS)),
    ]);
  } catch {
    // Deliberately swallowed: see the doc comment. Sign-out always wins.
  }
}
