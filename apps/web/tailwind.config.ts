import type { Config } from "tailwindcss";
import {
  webAppSection,
  webBookingCard,
  webCatalog,
  webColors,
  webControls,
  webCuisineTile,
  webHeader,
  webHero,
  webLayout,
  webLoginModal,
  webRadius,
  webSearchPanel,
  webShadow,
  webTypography,
  webVenueCard,
  webVenuePage,
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

const fontSize: Record<string, FontSizeEntry> = {
  ...Object.fromEntries(
    Object.entries(webTypography).map(([name, style]): [string, FontSizeEntry] => [
      name,
      [
        px(style.fontSize),
        { lineHeight: px(style.lineHeight), fontWeight: String(style.fontWeight) },
      ],
    ]),
  ),
  /**
   * Карточка брони (узел 3525:14731). Своих строк в шкале кита у этих пар
   * нет — они сняты с текстовых узлов самой карточки, поэтому утилиты собраны
   * из `webBookingCard`, а не подобраны из ближайшей ступени шкалы.
   */
  "aside-card-title": [
    px(webBookingCard.header.titleFontSize),
    { lineHeight: px(webBookingCard.header.titleLineHeight), fontWeight: "700" },
  ],
  "booking-subtitle": [
    px(webBookingCard.header.subtitleFontSize),
    { lineHeight: px(webBookingCard.header.subtitleLineHeight), fontWeight: "400" },
  ],
  "booking-label": [
    px(webBookingCard.field.labelFontSize),
    { lineHeight: px(webBookingCard.field.labelLineHeight), fontWeight: "500" },
  ],
  "booking-value": [
    px(webBookingCard.field.valueFontSize),
    { lineHeight: px(webBookingCard.field.valueLineHeight), fontWeight: "600" },
  ],
  "booking-slots-title": [
    px(webBookingCard.slots.headerFontSize),
    { lineHeight: px(webBookingCard.slots.headerLineHeight), fontWeight: "600" },
  ],
  "booking-slot": [
    px(webBookingCard.slots.fontSize),
    { lineHeight: px(webBookingCard.slots.lineHeight), fontWeight: "600" },
  ],
  "booking-cta": [
    px(webBookingCard.cta.titleFontSize),
    { lineHeight: px(webBookingCard.cta.titleLineHeight), fontWeight: "600" },
  ],
  "booking-cta-sub": [
    px(webBookingCard.cta.subtitleFontSize),
    { lineHeight: px(webBookingCard.cta.subtitleLineHeight), fontWeight: "400" },
  ],
  /** Подпись кухни. Своей строки в ките у неё нет — кегль снят с самого
   * текстового узла (3254:9), поэтому утилита собрана из `webCuisineTile`. */
  "cuisine-label": [
    px(webCuisineTile.labelFontSize),
    {
      lineHeight: px(webCuisineTile.labelLineHeight),
      fontWeight: String(webCuisineTile.labelFontWeight),
    },
  ],
};

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
          dot: webColors.text.successDot,
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
        /** Вторая строка кнопки «Забронировать» — белый 80 %, узел 3525:14770. */
        "on-brand-subtle": webColors.overlay.onBrandSubtleText,
        "photo-action": webVenuePage.galleryButton.background,
      },
      fontSize,
      borderRadius: {
        sm: px(webRadius.sm),
        "nav-underline": px(webHeader.navUnderline.radius),
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
        tag: px(webVenuePage.tag.radius),
        promo: px(webVenuePage.promoCard.radius),
        /** Широкая карточка выдачи скруглена на 18 — не как карточка кита (24)
         * и не как карточка блюда (16). Узел 3525:14495. */
        "wide-card": px(webCatalog.wideCard.radius),
        /** Слот в сетке карточки брони — 10, а не 12 как у слота кита.
         * Узел 3525:14751. */
        "slot-grid": px(webBookingCard.slots.radius),
      },
      boxShadow: {
        card: webShadow.card,
        modal: webShadow.modal,
        control: webShadow.control,
        panel: webSearchPanel.shadow,
        aside: webVenuePage.asideCard.shadow,
        "photo-action": webVenuePage.galleryButton.shadow,
      },
      backgroundImage: {
        "hero-scrim": webHero.scrim,
        "app-section": webAppSection.gradient,
        "promo-scrim": webVenuePage.promoCard.scrim,
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
        "header-y": px(webHeader.paddingY),
        "header-brand-gap": px(webHeader.brandGap),
        "header-nav-gap": px(webHeader.navGap),
        "header-right-gap": px(webHeader.rightGap),
        "city-pill-x": px(webHeader.cityPill.paddingX),
        "city-pill-gap": px(webHeader.cityPill.gap),
        "btn-header-x": px(webControls.buttonHeader.paddingX),
        "card-badge-x": px(webVenueCard.badge.paddingX),
        "card-badge-y": px(webVenueCard.badge.paddingY),
        "card-badge-inset-x": px(webVenueCard.badge.insetX),
        "card-badge-inset-b": px(webVenueCard.badge.insetBottom),
        "card-favorite-inset": px(webVenueCard.favorite.inset),
        "hero-y": px(webHero.paddingY),
        "hero-gap": px(webHero.gap),
        "field-x": px(webSearchPanel.field.paddingX),
        "field-y": px(webSearchPanel.field.paddingY),
        "panel-x": px(webSearchPanel.paddingX),
        "panel-gap": px(webSearchPanel.gap),
        "quick-gap": px(webSearchPanel.quickFilterGap),
        "app-y": px(webAppSection.paddingY),
        "store-gap": px(webAppSection.storeButton.gap),
        "login-field-x": px(webLoginModal.field.paddingX),
        "login-field-gap": px(webLoginModal.field.gap),
        "venue-tag-x": px(webVenuePage.tag.paddingX),
        "venue-action-x": px(webVenuePage.actionButton.paddingX),
        "venue-contact-x": px(webVenuePage.contactCard.paddingX),
        "venue-contact-gap": px(webVenuePage.contactCard.gap),
        "venue-name-gap": px(webVenuePage.nameRowGap),
        "venue-mosaic-gap": px(webVenuePage.mosaic.gap),
        "venue-mosaic-inset": px(webVenuePage.galleryButton.inset),
        "venue-promo-p": px(webVenuePage.promoCard.padding),
        "venue-dish-x": px(webVenuePage.dishCard.bodyPaddingX),
        "venue-dish-y": px(webVenuePage.dishCard.bodyPaddingY),
        "venue-mosaic-inset-b": px(webVenuePage.galleryButton.insetBottom),
        "venue-tabs-gap": px(webVenuePage.tabs.gap),
        "venue-tabs-label-gap": px(webVenuePage.tabs.labelGap),
        "section-y": px(webLayout.sectionPaddingY),
        "wide-card-x": px(webCatalog.wideCard.bodyPaddingX),
        "wide-card-y": px(webCatalog.wideCard.bodyPaddingY),
        "active-chip-l": px(webCatalog.activeChip.paddingLeft),
        "active-chip-r": px(webCatalog.activeChip.paddingRight),
        "booking-field-x": px(webBookingCard.field.paddingX),
        "booking-field-y": px(webBookingCard.field.paddingY),
        "booking-cta-y": px(webBookingCard.cta.paddingY),
      },
      height: {
        "btn-l": px(webControls.buttonL.height),
        "btn-m": px(webControls.buttonM.height),
        chip: px(webControls.chip.height),
        "btn-header": px(webControls.buttonHeader.height),
        "city-pill": px(webHeader.cityPill.height),
        "nav-underline": px(webHeader.navUnderline.height),
        "card-favorite": px(webVenueCard.favorite.size),
        slot: px(webControls.slot.height),
        input: px(webControls.input.height),
        badge: px(webControls.badge.height),
        header: px(webLayout.headerHeight),
        "card-image": px(webVenueCard.imageHeight),
        cuisine: px(webCuisineTile.size),
        /** Строка подписи кухни — чтобы скелетон ряда был ровно той же
         * высоты, что и настоящая ячейка (104 + 12 + 18), и страница при
         * появлении данных не прыгала. */
        "cuisine-label": px(webCuisineTile.labelLineHeight),
        panel: px(webSearchPanel.height),
        submit: px(webSearchPanel.submit.height),
        store: px(webAppSection.storeButton.height),
        "login-field": px(webLoginModal.field.height),
        "login-submit": px(webLoginModal.submit.height),
        "venue-tag": px(webVenuePage.tag.height),
        "venue-action": px(webVenuePage.actionButton.height),
        "login-divider": px(webLoginModal.field.dividerHeight),
        "venue-mosaic": px(webVenuePage.mosaic.height),
        "venue-tile": px(webVenuePage.mosaic.tileHeight),
        "venue-gallery-btn": px(webVenuePage.galleryButton.height),
        "venue-dish-image": px(webVenuePage.dishCard.imageHeight),
        "venue-contact-icon": px(webVenuePage.contactCard.iconSize),
        "venue-contact-glyph": px(webVenuePage.contactCard.iconGlyphSize),
        "venue-tabs-underline": px(webVenuePage.tabs.underlineHeight),
        "venue-map": px(webVenuePage.map.height),
        "wide-card": px(webCatalog.wideCard.height),
        "sort-select": px(webCatalog.sortSelect.height),
        /** Слот сетки брони — 40 (узел 3525:14760), а не 42 как слот кита. */
        "slot-grid": px(webBookingCard.slots.height),
        "booking-field-icon": px(webBookingCard.field.iconSize),
        page: px(webCatalog.pagination.size),
        logo: px(webHeader.logo.height),
      },
      width: {
        cuisine: px(webCuisineTile.size),
        logo: px(webHeader.logo.width),
        "card-favorite": px(webVenueCard.favorite.size),
        "store-app": px(webAppSection.storeButton.appStoreWidth),
        "store-play": px(webAppSection.storeButton.googlePlayWidth),
        "search-date": px(webSearchPanel.dateWidth),
        "search-time": px(webSearchPanel.timeWidth),
        "search-guests": px(webSearchPanel.guestsWidth),
        submit: px(webSearchPanel.submit.width),
        "venue-aside": px(webVenuePage.asideWidth),
        "venue-contact-icon": px(webVenuePage.contactCard.iconSize),
        "venue-contact-glyph": px(webVenuePage.contactCard.iconGlyphSize),
        "filters-rail": px(webCatalog.filtersCard.width),
        "wide-card-image": px(webCatalog.wideCard.imageWidth),
        "booking-field-icon": px(webBookingCard.field.iconSize),
        page: px(webCatalog.pagination.size),
      },
      minHeight: {
        "venue-promo": px(webVenuePage.promoCard.minHeight),
      },
      gridTemplateColumns: {
        /** Сетка свободного времени (узел 3525:14749) — четыре равные
         * колонки; в макете это ряды по четыре ячейки `flex-[1_0_0]`. */
        slots: `repeat(${webBookingCard.slots.columns}, minmax(0, 1fr))`,
        /** Мозаика 3261:33: 788 к 404 при просвете 8 — это НЕ 2/3 к 1/3.
         * Дроби держат пропорцию макета на любой ширине контейнера. */
        mosaic: `${webVenuePage.mosaic.mainWidth}fr ${webVenuePage.mosaic.sideWidth}fr`,
      },
      aspectRatio: {
        /** Карта в контактах (3264:69): 788×280. */
        "venue-map": `${webVenuePage.map.width} / ${webVenuePage.map.height}`,
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
