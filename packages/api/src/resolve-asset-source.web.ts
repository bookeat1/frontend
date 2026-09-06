import type { ResolvedAssetSource } from "./resolve-asset-source";

/**
 * Web (react-native-web) implementation.
 *
 * `Image.resolveAssetSource` is a Metro/native-only API — react-native-web's
 * `Image` component has no such static method, and calling it throws
 * `resolveAssetSource is not a function` at import time (it broke the whole
 * `@bookeat/api` barrel, since fixtures build these at module scope).
 *
 * Metro's web asset plugin already resolves static image imports to a plain
 * object (`{ uri, width, height, ... }`) instead of the opaque numeric asset
 * id used on native, so there is nothing left to resolve — this just reads
 * the fields that are already there.
 */
export function resolveAssetSource(source: unknown): ResolvedAssetSource {
  if (typeof source === "string") {
    return { uri: source, width: 0, height: 0 };
  }
  const asset = source as Partial<ResolvedAssetSource> | undefined;
  return {
    uri: asset?.uri ?? "",
    width: asset?.width ?? 0,
    height: asset?.height ?? 0,
  };
}
