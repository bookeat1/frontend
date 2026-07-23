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
