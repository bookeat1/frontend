import type { Config } from "tailwindcss";
import {
  webAppSection,
  webBookingCard,
  webBookingFlow,
  webBookingTicket,
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
  /**
   * Страница бронирования (узел 3525:14815). Как и у карточки брони, своих
   * ступеней в шкале кита у этих пар нет — они сняты с текстовых узлов самой
   * страницы, поэтому утилиты собраны из `webBookingFlow`.
   */
  "flow-title": [
    px(webBookingFlow.card.titleFontSize),
    { lineHeight: px(webBookingFlow.card.titleLineHeight), fontWeight: "700" },
  ],
  "flow-subtitle": [
    px(webBookingFlow.card.subtitleFontSize),
    { lineHeight: px(webBookingFlow.card.subtitleLineHeight), fontWeight: "400" },
  ],
  /** «Вторник, 25 августа», «Количество гостей», «Зона посадки» — одна пара
   * 16/24 SemiBold на все три строки-подзаголовка внутри карточек. */
  "flow-row-title": [
    px(webBookingFlow.slots.dateFontSize),
    { lineHeight: px(webBookingFlow.slots.dateLineHeight), fontWeight: "600" },
  ],
  /** Подпись группы слотов «День» / «Вечер» (узел 3525:14830). */
  "flow-slot-group": [
    px(webBookingFlow.slots.groupLabelFontSize),
    { lineHeight: px(webBookingFlow.slots.groupLabelLineHeight), fontWeight: "500" },
  ],
  /** Степпер гостей: значение SemiBold, знаки «−» и «+» Medium — в макете
   * это РАЗНЫЕ начертания одного кегля (узлы 3525:14872 и 3525:14874), а
   * утилита кегля несёт начертание с собой, поэтому пар две. */
  "flow-stepper-value": [
    px(webBookingFlow.stepper.fontSize),
    { lineHeight: px(webBookingFlow.stepper.lineHeight), fontWeight: "600" },
  ],
  "flow-stepper-sign": [
    px(webBookingFlow.stepper.fontSize),
    { lineHeight: px(webBookingFlow.stepper.lineHeight), fontWeight: "500" },
  ],
  /** Чип быстрого пожелания (узел 3525:14930) — 13/18 Medium, не 14/20 как
   * у чипа фильтра. */
  "flow-wish": [
    px(webBookingFlow.wishChip.fontSize),
    { lineHeight: px(webBookingFlow.wishChip.lineHeight), fontWeight: "500" },
  ],
  /** Сводка справа (узел 3525:14940). */
  "flow-summary-name": [
    px(webBookingFlow.summary.nameFontSize),
    { lineHeight: px(webBookingFlow.summary.nameLineHeight), fontWeight: "700" },
  ],
  "flow-summary-label": [
    px(webBookingFlow.summary.rowFontSize),
    { lineHeight: px(webBookingFlow.summary.rowLineHeight), fontWeight: "400" },
  ],
  "flow-summary-value": [
    px(webBookingFlow.summary.rowFontSize),
    { lineHeight: px(webBookingFlow.summary.rowLineHeight), fontWeight: "600" },
  ],
  "flow-total": [
    px(webBookingFlow.summary.totalFontSize),
    { lineHeight: px(webBookingFlow.summary.totalLineHeight), fontWeight: "600" },
  ],
  "flow-total-value": [
    px(webBookingFlow.summary.totalValueFontSize),
    { lineHeight: px(webBookingFlow.summary.totalValueLineHeight), fontWeight: "700" },
  ],
  /** Билет брони (узел 3525:15019). */
  "ticket-lead": [
    px(webBookingTicket.successTextFontSize),
    { lineHeight: px(webBookingTicket.successTextLineHeight), fontWeight: "400" },
  ],
  "ticket-venue-name": [
    px(webBookingTicket.venueHeader.nameFontSize),
    { lineHeight: px(webBookingTicket.venueHeader.nameLineHeight), fontWeight: "700" },
  ],
  "ticket-detail-label": [
    px(webBookingTicket.detail.labelFontSize),
    { lineHeight: px(webBookingTicket.detail.labelLineHeight), fontWeight: "500" },
  ],
  "ticket-detail-value": [
    px(webBookingTicket.detail.valueFontSize),
    { lineHeight: px(webBookingTicket.detail.valueLineHeight), fontWeight: "600" },
  ],
  "ticket-code": [
    px(webBookingTicket.code.valueFontSize),
    { lineHeight: px(webBookingTicket.code.valueLineHeight), fontWeight: "700" },
  ],
  /** «Код брони» — 13/18 MEDIUM (узел 3525:15100), а не Regular, как
   * одноимённая по кеглю ступень `bodyS`. */
  "ticket-code-label": [
    px(webBookingTicket.code.labelFontSize),
    { lineHeight: px(webBookingTicket.code.labelLineHeight), fontWeight: "500" },
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
        /** Кнопка «−»/«+» степпера гостей (узел 3525:14871) — 10 внутри
         * оболочки радиуса 14. Совпадает по числу со слотом сетки, но это
         * другой элемент другого экрана. */
        "stepper-btn": px(webBookingFlow.stepper.buttonRadius),
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
        /** Затемнение под белым названием в шапке билета (узел 3525:15029). */
        "ticket-scrim": webBookingTicket.venueHeader.scrim,
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
        /** Карточка формы бронирования: 26 сверху, 28 с трёх сторон
         * (узел 3525:14819). */
        "flow-card-t": px(webBookingFlow.card.paddingTop),
        "flow-card-x": px(webBookingFlow.card.paddingX),
        "flow-card-b": px(webBookingFlow.card.paddingBottom),
        "flow-stepper-p": px(webBookingFlow.stepper.padding),
        "flow-textarea-x": px(webBookingFlow.textarea.paddingX),
        "flow-textarea-y": px(webBookingFlow.textarea.paddingY),
        "flow-wish-x": px(webBookingFlow.wishChip.paddingX),
        "flow-summary-p": px(webBookingFlow.summary.padding),
        /** Просветы сводки (узел 3525:14940): между блоками 18, «название →
         * адрес» 3. В шкале Tailwind таких ступеней нет. */
        "flow-summary-gap": px(webBookingFlow.summary.gap),
        "flow-venue-text-gap": px(webBookingFlow.summary.venueTextGap),
        "ticket-top": px(webBookingTicket.contentPaddingTop),
        "ticket-bottom": px(webBookingTicket.contentPaddingBottom),
        "ticket-body": px(webBookingTicket.body.padding),
        "ticket-venue-x": px(webBookingTicket.venueHeader.paddingX),
        "ticket-venue-b": px(webBookingTicket.venueHeader.paddingBottom),
        "ticket-detail-x": px(webBookingTicket.detail.paddingX),
        "ticket-detail-y": px(webBookingTicket.detail.paddingY),
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
        "flow-stepper": px(webBookingFlow.stepper.height),
        "flow-stepper-btn": px(webBookingFlow.stepper.buttonSize),
        "flow-textarea": px(webBookingFlow.textarea.height),
        "flow-wish": px(webBookingFlow.wishChip.height),
        "flow-checkbox": px(webBookingFlow.checkbox.size),
        "flow-summary-photo": px(webBookingFlow.summary.photoSize),
        "ticket-venue": px(webBookingTicket.venueHeader.height),
        "ticket-detail": px(webBookingTicket.detail.height),
        "ticket-icon": px(webBookingTicket.successIcon.size),
        "ticket-icon-glyph": px(webBookingTicket.successIcon.glyphSize),
        "ticket-qr": px(webBookingTicket.code.qrSize),
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
        "flow-stepper-btn": px(webBookingFlow.stepper.buttonSize),
        "flow-stepper-value": px(webBookingFlow.stepper.valueWidth),
        "flow-checkbox": px(webBookingFlow.checkbox.size),
        "flow-summary-photo": px(webBookingFlow.summary.photoSize),
        "ticket-icon": px(webBookingTicket.successIcon.size),
        "ticket-icon-glyph": px(webBookingTicket.successIcon.glyphSize),
        "ticket-qr": px(webBookingTicket.code.qrSize),
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
        /** Ряд слотов страницы бронирования (узел 3525:14831) — четыре
         * ячейки 177 при ширине 732 и просвете 8, то есть четыре равные
         * колонки. Отдельно от `slots`: там четвёрка карточки брони. */
        "flow-slots": `repeat(${webBookingFlow.slots.columns}, minmax(0, 1fr))`,
        /** Четыре ячейки «Дата / Время / Гости / Зона» в билете
         * (узел 3525:15033). */
        "ticket-details": "repeat(4, minmax(0, 1fr))",
      },
      aspectRatio: {
        /** Карта в контактах (3264:69): 788×280. */
        "venue-map": `${webVenuePage.map.width} / ${webVenuePage.map.height}`,
      },
      maxWidth: {
        container: px(webLayout.containerWidth),
        modal: px(webLayout.modalWidth),
        /** Блок успеха и карточка-билет — оба 720 (узлы 3525:15022 и
         * 3525:15028). */
        ticket: px(webBookingTicket.card.width),
      },
    },
  },
  plugins: [],
};

export default config;
