/**
 * Web (react-native-web) implementation.
 *
 * EAS Update — over-the-air JS bundle delivery — does not exist for a
 * browser build: there is nothing to check for, download or apply, and no
 * native module to ask. This is a deliberate no-op (ADR-046,
 * "Веб-заглушки только там, где реально импортируется"), not a missing
 * feature: `reloadApp()` in reload-app.ts reads `isEnabled` first and skips
 * straight past this step when it is `false`, falling through to
 * `DevSettings.reload()` / a quiet no-op — exactly the same path a native
 * build without EAS Update configured already takes.
 */
export const isEnabled = false;

export async function reloadAsync(): Promise<void> {
  // Nothing downloaded, nothing to apply.
}

export function useUpdates(): { isUpdatePending: boolean } {
  // `useAppUpdate.ts` only reads `isUpdatePending`; always `false` on web —
  // there is no OTA bundle waiting for a restart.
  return { isUpdatePending: false };
}
