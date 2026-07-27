/**
 * `react-native` under the test runner = `react-native-web`, plus the one
 * thing Metro provides that a plain bundler does not.
 *
 * `Image.resolveAssetSource` is a Metro API: it turns the number Metro hands
 * back for `import photo from "./photo.jpg"` into `{ uri, width, height }`.
 * Vite hands back a URL string instead, and react-native-web has no such
 * function at all — so `packages/api/src/mock-data.ts` throws at import time,
 * which takes down anything that touches the `@bookeat/api` barrel.
 *
 * The shim is deliberately dumb: it reports the URL it was given and no
 * dimensions it does not know. Nothing in the tests asserts on mock photo
 * sizes; if something ever does, it should read them from a fixture rather
 * than from a fake Metro.
 */
import * as ReactNativeWeb from "react-native-web";

const { Image } = ReactNativeWeb as unknown as { Image: Record<string, unknown> };

if (typeof Image.resolveAssetSource !== "function") {
  Image.resolveAssetSource = (source: unknown) => {
    if (typeof source === "string") return { uri: source, width: 0, height: 0, scale: 1 };
    if (source && typeof source === "object") {
      const asset = source as { uri?: string; default?: string };
      return { uri: asset.uri ?? asset.default ?? "", width: 0, height: 0, scale: 1 };
    }
    return { uri: "", width: 0, height: 0, scale: 1 };
  };
}

export * from "react-native-web";
export { default } from "react-native-web";
