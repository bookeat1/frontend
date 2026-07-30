import { colors } from "@bookeat/design-tokens";
import { Image, type ImageContentFit, type ImageStyle } from "expo-image";
import React from "react";
import { StyleSheet, View, type StyleProp } from "react-native";
import { ForkKnife } from "./icons";
import {
  PHOTO_CACHE_POLICY,
  PHOTO_TRANSITION_MS,
  resolvePhotoDisplay,
  type PhotoSize,
} from "../lib/photo-source";

/**
 * THE remote photo of this app — venue covers, gallery tiles, dish thumbnails,
 * event and banner artwork. Everything that loads bytes over the network goes
 * through here; a second, slightly different <Image> somewhere else is a bug,
 * because it would be the one that still flashes, still re-decodes on scroll
 * and still shows an empty box when the file is gone.
 *
 * What it guarantees, in the words of what the guest sees:
 *
 *  - a photo already seen once appears instantly (memory + disk cache, see
 *    lib/photo-source.ts);
 *  - a photo being fetched shows the app's neutral tile, never white;
 *  - a photo that arrives fades in instead of popping;
 *  - a photo that 404s becomes the SAME "no photo" tile the app already shows
 *    for a dish without a picture — never a broken-image glyph, never a hole,
 *    and never an infinite retry;
 *  - a photo is fetched at roughly the size it is drawn, not at whatever size
 *    it was uploaded at, and if that resized copy has not been generated yet
 *    the slot quietly falls back to the original instead of showing nothing.
 *
 * The placeholder is deliberately the one that already existed on the dish
 * card (neutral chip fill + a muted ForkKnife, hidden from screen readers
 * because the surrounding card already carries the real label). The dish card
 * now renders it through this component instead of its own copy, so the app
 * has exactly one "no photo" tile.
 */
export function PhotoView({
  uri,
  alt,
  style,
  contentFit = "cover",
  transition = PHOTO_TRANSITION_MS,
  priority,
  /** How big the slot is on screen, which decides which resized copy is
   * requested. Defaults to `full`: erring towards the larger copy costs a few
   * KB, erring towards the smaller one shows the guest a blurry photo. */
  size = "full",
  /** Decorative photos are hidden from screen readers: their card or the
   * pressable around them already says what they are, and "изображение"
   * announced twice is noise. */
  decorative = false,
  /** The icon is dropped on tiles too small to fit it (the 72pt reservation
   * avatar), which then fall back to the plain neutral fill. */
  placeholderIcon = true,
  placeholderIconSize = 28,
  /** Fill of the "no photo" tile. The default is the app's neutral chip
   * colour; the promo strip overrides it because its caption is white text
   * written ON the tile, and white on light grey is unreadable. */
  placeholderColor = colors.background.chip,
}: {
  uri: string | null | undefined;
  alt?: string;
  style: StyleProp<ImageStyle>;
  contentFit?: ImageContentFit;
  transition?: number;
  priority?: "low" | "normal" | "high";
  size?: PhotoSize;
  decorative?: boolean;
  placeholderIcon?: boolean;
  placeholderIconSize?: number;
  placeholderColor?: string;
}) {
  // A LIST of failed URIs, not one: a slot has two addresses to get through
  // (the resized copy, then the original behind it), and remembering only the
  // last failure would let the two take turns forever. See resolvePhotoDisplay.
  const [brokenUris, setBrokenUris] = React.useState<string[]>([]);
  const display = resolvePhotoDisplay(uri, brokenUris, size);

  // Latched on the URI, not on a boolean: see resolvePhotoDisplay. Recreating
  // the callback per URI is intentional — a stale closure here would mark the
  // wrong photo broken in a recycled row.
  //
  // The functional update matters: two <Image>s in the same slot can report
  // failure in the same tick, and a plain `setBrokenUris([...brokenUris, uri])`
  // would drop one of them and re-request it.
  const handleError = React.useCallback(() => {
    if (display.kind !== "image") return;
    const failed = display.uri;
    setBrokenUris((prev) => (prev.includes(failed) ? prev : [...prev, failed]));
  }, [display]);

  if (display.kind === "placeholder") {
    return (
      <View
        style={[style, styles.placeholder, { backgroundColor: placeholderColor }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        testID="photo-placeholder"
      >
        {placeholderIcon ? (
          <ForkKnife size={placeholderIconSize} color={colors.text.muted} weight="regular" />
        ) : null}
      </View>
    );
  }

  return (
    <Image
      testID="photo-image"
      source={{ uri: display.uri }}
      style={style}
      contentFit={contentFit}
      transition={transition}
      priority={priority}
      // Memory + disk. The single reason this component exists.
      cachePolicy={PHOTO_CACHE_POLICY}
      // Drops the previous row's bitmap when a FlatList recycles this view,
      // instead of cross-fading venue A into venue B.
      recyclingKey={display.uri}
      onError={handleError}
      {...(decorative
        ? { accessible: false, importantForAccessibility: "no-hide-descendants" as const, alt: "" }
        : { accessibilityLabel: alt, alt })}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
  },
});
