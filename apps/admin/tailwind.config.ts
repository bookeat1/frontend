import type { Config } from "tailwindcss";
import { colors, radius, spacing } from "@bookeat/design-tokens";

/**
 * Tailwind theme is derived from the shared @bookeat/design-tokens package so
 * the admin panel stays visually consistent with the mobile app and no colors
 * are hardcoded here. Extra neutral shades needed for a desktop admin chrome
 * (borders, table hover) are added as semantic aliases.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: colors.brand.primary,
        text: {
          DEFAULT: colors.text.primary,
          muted: colors.text.muted,
          strong: colors.text.strong,
          "on-brand": colors.text.onBrand,
        },
        surface: colors.background.surface,
        screen: colors.background.screen,
        chip: colors.background.chip,
        "chip-active": colors.background.chipActive,
        hairline: colors.border.subtle,
      },
      borderRadius: {
        card: `${radius.card}px`,
        pill: `${radius.pill}px`,
      },
      spacing: {
        xxs: `${spacing.xxs}px`,
        xs: `${spacing.xs}px`,
        sm: `${spacing.sm}px`,
        md: `${spacing.md}px`,
        lg: `${spacing.lg}px`,
        xl: `${spacing.xl}px`,
        xxl: `${spacing.xxl}px`,
        xxxl: `${spacing.xxxl}px`,
        huge: `${spacing.huge}px`,
      },
    },
  },
  plugins: [],
};

export default config;
