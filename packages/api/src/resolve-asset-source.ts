import { Image, type ImageSourcePropType } from "react-native";

export interface ResolvedAssetSource {
  uri: string;
  width: number;
  height: number;
}

/**
 * Native/default implementation: static image imports are opaque Metro
 * asset ids on iOS/Android, and `Image.resolveAssetSource` is the only way
 * to turn them into a real `{ uri, width, height }`.
 *
 * See the `.web.ts` sibling for the react-native-web variant — keep this
 * file's exported signature identical so Metro can pick either one
 * per-platform without callers caring.
 */
export function resolveAssetSource(
  source: ImageSourcePropType,
): ResolvedAssetSource {
  return Image.resolveAssetSource(source);
}
