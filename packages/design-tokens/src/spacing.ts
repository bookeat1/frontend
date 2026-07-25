/** 4pt base spacing scale. Never hardcode raw numbers in screens — use these. */
export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

/**
 * Corner radii — verified against Figma node 340:2535 and sibling screens.
 * Named by the role they play, not by their pixel value.
 */
export const radius = {
  /** Chips, pill buttons, icon buttons, the search input, bottom-nav pill. */
  pill: 999,
  /** Cards: menu item photos, promo banners, map preview, search result photo. */
  card: 20,
  /** The single largest photo on screen — restaurant cover photo only. */
  photoHero: 24,
} as const;

/** Minimum hit-slop / touch target per accessibility hard rule (>= 44pt). */
export const hitSlop = {
  minTouchTarget: 44,
} as const;

/**
 * Fixed control heights the design states explicitly. Verified against the
 * Reservation screen (Figma file oPxXynSOY3PYhf3gkVR5Ps, node 471:3880).
 */
export const controlHeight = {
  /** Date/guests pill selectors (471:3899), time slots (471:3914) and the
   * sticky flow CTA (471:3967) are all 48 tall. */
  pill: 48,
  /** "Special Requests" textarea (471:3946). */
  multilineField: 80,
  /** Dish photo in the pre-order list. Measured off the design render
   * `design-ref/screen-menu-preorder.png` (120x80) — that screen has no
   * value-by-value spec yet, so this is a read of the render, not a node. */
  dishPhotoHeight: 80,
  dishPhotoWidth: 120,
} as const;

/** Stroke widths from the design. */
export const borderWidth = {
  /** Time-slot pill outline — 1.5px, grey when idle, brand when chosen
   * (Figma node 471:3914). */
  control: 1.5,
} as const;
