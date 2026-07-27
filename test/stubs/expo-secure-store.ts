/**
 * In-memory stand-in for expo-secure-store (Keychain / Android Keystore).
 *
 * It is NOT a no-op on purpose: sign-out has to be observable, so the tests
 * can assert that the stored session key is really gone and not merely that a
 * function was called. `__store` is exposed for that.
 */
const store = new Map<string, string>();

export const __store = store;

export async function getItemAsync(key: string): Promise<string | null> {
  return store.has(key) ? store.get(key)! : null;
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  store.set(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  store.delete(key);
}

export async function isAvailableAsync(): Promise<boolean> {
  return true;
}
