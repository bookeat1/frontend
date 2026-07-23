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

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

/** Minimum hit-slop / touch target per accessibility hard rule (>= 44pt). */
export const hitSlop = {
  minTouchTarget: 44,
} as const;
