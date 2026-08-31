import type { Config } from "tailwindcss";
import {
  webAppSection,
  webColors,
  webControls,
  webCuisineTile,
  webHero,
  webLayout,
  webRadius,
  webSearchPanel,
  webShadow,
  webTypography,
  webVenueCard,
} from "@bookeat/design-tokens";

/**
 * Тема целиком выведена из `@bookeat/design-tokens/web` — того самого файла,
 * куда сняты значения из Figma-кита. В этом конфиге НЕТ ни одного числа и ни
 * одного цвета «от себя»: если чего-то не хватает, значение добавляется в
 * пакет токенов, а не сюда.
 */
const px = (value: number) => `${value}px`;

/** `text-h1` и остальные утилиты кегля несут ещё интерлиньяж и начертание —
 * ровно тройками, как они подписаны в макете (60/68 · Bold и так далее). */
type FontSizeEntry = [string, { lineHeight: string; fontWeight: string }];

const fontSize: Record<string, FontSizeEntry> = Object.fromEntries(
  Object.entries(webTypography).map(([name, style]): [string, FontSizeEntry] => [
    name,
    [px(style.fontSize), { lineHeight: px(style.lineHeight), fontWeight: String(style.fontWeight) }],
  ]),
);

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    // Брейкпоинты ровно из макета (узел 3273:153). Порядок Tailwind —
    // от меньшего к большему, поэтому список развёрнут.
    screens: {
      md: px(webLayout.breakpoints[3]),
      lg: px(webLayout.breakpoints[2]),
      xl: px(webLayout.breakpoints[1]),
      "2xl": px(webLayout.breakpoints[0]),
    },
    extend: {
      colors: {
        canvas: webColors.background.canvas,
        subtle: webColors.background.subtle,
        muted: webColors.background.muted,
        disabled: webColors.background.disabled,
        inverse: webColors.background.inverse,
        brand: {
          DEFAULT: webColors.background.brand,
          subtle: webColors.background.brandSubtle,
          text: webColors.text.brand,
        },
        ink: {
          DEFAULT: webColors.text.primary,
          secondary: webColors.text.secondary,
          tertiary: webColors.text.tertiary,
          disabled: webColors.text.disabled,
          "on-brand": webColors.text.onBrand,
          "on-inverse": webColors.text.onInverse,
          "on-inverse-muted": webColors.text.onInverseMuted,
        },
        line: {
          DEFAULT: webColors.border.default,
          strong: webColors.border.strong,
          control: webColors.border.control,
        },
        success: {
          DEFAULT: webColors.background.success,
          text: webColors.text.success,
        },
        warning: {
          DEFAULT: webColors.background.warning,
          text: webColors.text.warning,
        },
        danger: {
          DEFAULT: webColors.background.danger,
          text: webColors.text.danger,
          strong: webColors.text.dangerStrong,
        },
        scrim: webColors.overlay.scrim,
        "photo-badge": webColors.overlay.photoBadge,
        "photo-control": webColors.overlay.photoControl,
        "on-inverse-line": webColors.overlay.onInverseLine,
        "on-inverse-surface": webColors.overlay.onInverseSurface,
        "on-photo-chip": webColors.overlay.onPhotoChip,
        "on-photo-chip-border": webColors.overlay.onPhotoChipBorder,
        "on-brand-muted": webColors.overlay.onBrandMutedText,
      },
      fontSize,
      borderRadius: {
        sm: px(webRadius.sm),
        md: px(webRadius.md),
        lg: px(webRadius.lg),
        xl: px(webRadius.xl),
        "2xl": px(webRadius.xxl),
        card: px(webRadius.card),
        field: px(webRadius.field),
        panel: px(webSearchPanel.radius),
        checkbox: px(webRadius.checkbox),
        store: px(webAppSection.storeButton.radius),
        full: px(webRadius.full),
        slot: px(webVenueCard.slot.radius),
      },
      boxShadow: {
        card: webShadow.card,
        modal: webShadow.modal,
        panel: webSearchPanel.shadow,
      },
      backgroundImage: {
        "hero-scrim": webHero.scrim,
        "app-section": webAppSection.gradient,
      },
      spacing: {
        gutter: px(webLayout.gutter),
        "page-gutter": px(webLayout.pageGutter),
        "btn-l-x": px(webControls.buttonL.paddingX),
        "btn-m-x": px(webControls.buttonM.paddingX),
        "chip-x": px(webControls.chip.paddingX),
        "slot-x": px(webControls.slot.paddingX),
        "input-x": px(webControls.input.paddingX),
        "badge-x": px(webControls.badge.paddingX),
        "card-body": px(webVenueCard.bodyPadding),
        "cuisine-gap": px(webCuisineTile.gap),
        "cuisine-row-x": px(webCuisineTile.rowGapX),
        "cuisine-row-y": px(webCuisineTile.rowGapY),
        "hero-y": px(webHero.paddingY),
        "hero-gap": px(webHero.gap),
        "field-x": px(webSearchPanel.field.paddingX),
        "field-y": px(webSearchPanel.field.paddingY),
        "panel-x": px(webSearchPanel.paddingX),
        "panel-gap": px(webSearchPanel.gap),
        "quick-gap": px(webSearchPanel.quickFilterGap),
        "app-y": px(webAppSection.paddingY),
      },
      height: {
        "btn-l": px(webControls.buttonL.height),
        "btn-m": px(webControls.buttonM.height),
        chip: px(webControls.chip.height),
        slot: px(webControls.slot.height),
        input: px(webControls.input.height),
        badge: px(webControls.badge.height),
        header: px(webLayout.headerHeight),
        "card-image": px(webVenueCard.imageHeight),
        cuisine: px(webCuisineTile.size),
        panel: px(webSearchPanel.height),
        submit: px(webSearchPanel.submit.height),
        store: px(webAppSection.storeButton.height),
      },
      width: {
        cuisine: px(webCuisineTile.size),
        "search-date": px(webSearchPanel.dateWidth),
        "search-time": px(webSearchPanel.timeWidth),
        "search-guests": px(webSearchPanel.guestsWidth),
        submit: px(webSearchPanel.submit.width),
      },
      minWidth: {
        cuisine: px(webCuisineTile.size),
      },
      maxWidth: {
        container: px(webLayout.containerWidth),
        modal: px(webLayout.modalWidth),
      },
    },
  },
  plugins: [],
};

export default config;
