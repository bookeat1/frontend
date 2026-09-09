import { DetourProvider } from "@swmansion/react-native-detour";
import type { PropsWithChildren } from "react";
import { detourConfig, isDetourConfigured } from "./detour";

/**
 * Only mounts `<DetourProvider>` when `isDetourConfigured` (both
 * `EXPO_PUBLIC_DETOUR_API_KEY` and `EXPO_PUBLIC_DETOUR_APP_ID` set) — see the
 * long comment in `detour.ts` for why this has to sit at the mount boundary
 * rather than inside the SDK: `DetourProviderNative` fires an automatic
 * retention event on every cold start regardless of whether `apiKey`/`appID`
 * are empty, so skipping the mount entirely (not passing an "empty" config)
 * is the only way to keep a misconfigured build from making that call.
 *
 * `<DetourLinkRouter />` (app/_layout.tsx) reads `useDetourContext()`, which
 * throws outside a `<DetourProvider>` — callers must gate it on
 * `isDetourConfigured` too, same as this component.
 */
export function DetourProviderGate({ children }: PropsWithChildren) {
  if (!isDetourConfigured) {
    return <>{children}</>;
  }

  return <DetourProvider config={detourConfig}>{children}</DetourProvider>;
}
