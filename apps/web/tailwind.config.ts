import type { Config } from "tailwindcss";
import {
  webAppSection,
  webBookingCard,
  webBookingFlow,
  webBottomBar,
  webBookingTicket,
  webCatalog,
  webCatalogPagination,
  webColors,
  webControls,
  webCuisineTile,
  webHeader,
  webHero,
  webHomeEventCard,
  webHomeGuideCard,
  webGuidePage,
  webHomePromoCard,
  webLayout,
  webLoginModal,
  webProfile,
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
   * Герой и секция «Приложение» главной. Кегли из Figma WEB (48/52 и 38/46)
   * живут ТОЛЬКО под `lg:`; ниже — `*-mobile`, размер мобильной шапки
   * главной (`webHero.mobileTitleFontSize`, см. комментарий в токене и
   * `docs/responsive.md`, § 5, дыры № 4 и 5).
   */
  "hero-title": [
    px(webHero.titleFontSize),
    { lineHeight: px(webHero.titleLineHeight), fontWeight: "700" },
  ],
  "hero-title-mobile": [
    px(webHero.mobileTitleFontSize),
    { lineHeight: px(webHero.mobileTitleLineHeight), fontWeight: "700" },
  ],
  "app-title": [
    px(webAppSection.titleFontSize),
    { lineHeight: px(webAppSection.titleLineHeight), fontWeight: "700" },
  ],
  "app-title-mobile": [
    px(webAppSection.mobileTitleFontSize),
    { lineHeight: px(webAppSection.mobileTitleLineHeight), fontWeight: "700" },
  ],
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
  "ticket-venue-meta": [
    px(webBookingTicket.venueHeader.metaFontSize),
    { lineHeight: px(webBookingTicket.venueHeader.metaLineHeight), fontWeight: "400" },
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
  /** Страница гостя (узел 3525:15153) — кегли сняты с текстовых узлов,
   * своих ступеней в шкале кита у них нет. Числа — `webProfile`. */
  "profile-avatar": [px(webProfile.card.avatar.fontSize), { lineHeight: px(webProfile.card.avatar.lineHeight), fontWeight: "700" }],
  "profile-name": [px(webProfile.card.nameFontSize), { lineHeight: px(webProfile.card.nameLineHeight), fontWeight: "700" }],
  "profile-contact": [px(webProfile.card.contactFontSize), { lineHeight: px(webProfile.card.contactLineHeight), fontWeight: "400" }],
  "profile-stat": [px(webProfile.card.stats.valueFontSize), { lineHeight: px(webProfile.card.stats.valueLineHeight), fontWeight: "700" }],
  "profile-stat-label": [px(webProfile.card.stats.labelFontSize), { lineHeight: px(webProfile.card.stats.labelLineHeight), fontWeight: "400" }],
  "profile-nav": [px(webProfile.nav.item.fontSize), { lineHeight: px(webProfile.nav.item.lineHeight), fontWeight: "500" }],
  "profile-title": [px(webProfile.section.titleFontSize), { lineHeight: px(webProfile.section.titleLineHeight), fontWeight: "700" }],
  segment: [px(webProfile.segmented.segment.fontSize), { lineHeight: px(webProfile.segmented.segment.lineHeight), fontWeight: "500" }],
  "pbook-title": [px(webProfile.bookingCard.titleFontSize), { lineHeight: px(webProfile.bookingCard.titleLineHeight), fontWeight: "600" }],
  "pbook-address": [px(webProfile.bookingCard.addressFontSize), { lineHeight: px(webProfile.bookingCard.addressLineHeight), fontWeight: "400" }],
  pill: [px(webProfile.bookingCard.statusPill.fontSize), { lineHeight: px(webProfile.bookingCard.statusPill.lineHeight), fontWeight: "600" }],
  "pbook-label": [px(webProfile.bookingCard.info.labelFontSize), { lineHeight: px(webProfile.bookingCard.info.labelLineHeight), fontWeight: "500" }],
  "pbook-value": [px(webProfile.bookingCard.info.valueFontSize), { lineHeight: px(webProfile.bookingCard.info.valueLineHeight), fontWeight: "600" }],
  "fav-title": [px(webProfile.favorites.card.titleFontSize), { lineHeight: px(webProfile.favorites.card.titleLineHeight), fontWeight: "600" }],
  /**
   * Квадрат нумерации выдачи (узел 3525:14500): 15/22, Medium у неактивных
   * и многоточия, SemiBold у текущей страницы — две утилиты, как у пар
   * `flow-summary-*`, а не переопределение веса поверх одной.
   */
  page: [
    px(webCatalogPagination.label.fontSize),
    {
      lineHeight: px(webCatalogPagination.label.lineHeight),
      fontWeight: String(webCatalogPagination.label.weight),
    },
  ],
  "page-current": [
    px(webCatalogPagination.label.fontSize),
    {
      lineHeight: px(webCatalogPagination.label.lineHeight),
      fontWeight: String(webCatalogPagination.label.currentWeight),
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
        guide: {
          gold: webGuidePage.gold,
          pick: webGuidePage.editorPickFill,
          "pick-subtitle": webGuidePage.editorPickSubtitle,
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
        /** Точка «ждём подтверждения» в ярлыке брони профиля (узел 3525:15248). */
        "warning-dot": webProfile.bookingCard.statusPill.dot.warning,
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
        /** Пилюля нижнего ряда широкой карточки — 10 (узел I3525:14495;3367:11047). */
        "wide-card-pill": px(webCatalog.wideCard.pill.radius),
        /** Слот в сетке карточки брони — 10, а не 12 как у слота кита.
         * Узел 3525:14751. */
        "slot-grid": px(webBookingCard.slots.radius),
        /** Кнопка «−»/«+» степпера гостей (узел 3525:14871) — 10 внутри
         * оболочки радиуса 14. Совпадает по числу со слотом сетки, но это
         * другой элемент другого экрана. */
        "stepper-btn": px(webBookingFlow.stepper.buttonRadius),
        /** Страница гостя: карточка брони и карточка избранного — 18 (узлы
         * 3525:15205 и 3525:15393), сегмент — 9 (3525:15198). */
        pbook: px(webProfile.bookingCard.radius),
        segment: px(webProfile.segmented.segment.radius),
      },
      boxShadow: {
        card: webShadow.card,
        modal: webShadow.modal,
        control: webShadow.control,
        panel: webSearchPanel.shadow,
        aside: webVenuePage.asideCard.shadow,
        "photo-action": webVenuePage.galleryButton.shadow,
        /** Полоса с кнопкой у нижнего края экрана ниже `lg` (из приложения). */
        "bottom-bar": webBottomBar.shadow,
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
        "bottom-bar": px(webBottomBar.padding),
        "bottom-bar-gap": px(webBottomBar.gap),
        "bottom-bar-clearance": px(webBottomBar.clearance),
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
        "wide-card-pill-x": px(webCatalog.wideCard.pill.paddingX),
        "wide-card-pill-y": px(webCatalog.wideCard.pill.paddingY),
        "wide-card-y": px(webCatalog.wideCard.bodyPaddingY),
        "sort-select-l": px(webCatalog.sortSelect.paddingLeft),
        "sort-select-r": px(webCatalog.sortSelect.paddingRight),
        /** Правый паддинг самого `<select>`: место под шеврон 24 и просвет 8
         * плюс паддинг кадра 14 (узел 3525:14473). */
        "sort-select-text-r": px(
          webCatalog.sortSelect.paddingRight +
            webCatalog.sortSelect.gap +
            webCatalog.sortSelect.iconSize,
        ),
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
        /** Страница гостя (узел 3525:15153), числа — `webProfile`. */
        "profile-page-t": px(webProfile.page.paddingTop),
        "profile-page-b": px(webProfile.page.paddingBottom),
        "profile-page-gap": px(webProfile.page.gap),
        "profile-card-p": px(webProfile.card.padding),
        "profile-card-gap": px(webProfile.card.gap),
        "profile-identity-gap": px(webProfile.card.identityGap),
        "profile-stats-gap": px(webProfile.card.stats.gap),
        "profile-stat-gap": px(webProfile.card.stats.innerGap),
        "profile-content-gap": px(webProfile.contentGap),
        "profile-nav-p": px(webProfile.nav.padding),
        "profile-nav-gap": px(webProfile.nav.gap),
        "profile-nav-item-x": px(webProfile.nav.item.paddingX),
        "profile-nav-item-gap": px(webProfile.nav.item.gap),
        "profile-section-gap": px(webProfile.section.gap),
        "segmented-p": px(webProfile.segmented.padding),
        "segment-x": px(webProfile.segmented.segment.paddingX),
        "pbook-gap": px(webProfile.bookingsGap),
        "pbook-body-x": px(webProfile.bookingCard.body.paddingX),
        "pbook-body-y": px(webProfile.bookingCard.body.paddingY),
        "pbook-body-gap": px(webProfile.bookingCard.body.gap),
        "pbook-top-gap": px(webProfile.bookingCard.topGap),
        "pbook-titles-gap": px(webProfile.bookingCard.titlesGap),
        "pbook-info-gap": px(webProfile.bookingCard.info.gap),
        "pbook-info-inner": px(webProfile.bookingCard.info.innerGap),
        "pbook-actions-gap": px(webProfile.bookingCard.actions.gap),
        "pbook-action-x": px(webProfile.bookingCard.actions.paddingX),
        "pill-x": px(webProfile.bookingCard.statusPill.paddingX),
        "pill-gap": px(webProfile.bookingCard.statusPill.gap),
        "fav-gap": px(webProfile.favorites.gap),
        "fav-body-t": px(webProfile.favorites.card.paddingTop),
        "fav-body-x": px(webProfile.favorites.card.paddingX),
        "fav-body-b": px(webProfile.favorites.card.paddingBottom),
        "fav-body-gap": px(webProfile.favorites.card.gap),
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
        "event-card": px(webHomeEventCard.height),
        "event-image": px(webHomeEventCard.imageHeight),
        /** Обложка события ниже `lg` — из карточки «Афиши» приложения. */
        "event-image-mobile": px(webHomeEventCard.mobileImageHeight),
        /** Тела карточек событий и подборок — для скелетов лент главной:
         * ниже `lg` высота карточки складывается из обложки и тела, и
         * скелет должен быть собран из тех же частей. */
        "event-body": px(webHomeEventCard.bodyHeight),
        "promo-card": px(webHomePromoCard.height),
        "guide-image": px(webHomeGuideCard.imageHeight),
        "guide-body": px(webHomeGuideCard.bodyHeight),
        "guide-rubric": px(webGuidePage.rubric.height),
        "guide-rubric-m": px(webGuidePage.rubric.mobileHeight),
        "guide-pick": px(webGuidePage.editorPick.height),
        "guide-pick-m": px(webGuidePage.editorPick.mobileHeight),
        "guide-walk": px(webGuidePage.walk.height),
        "guide-walk-m": px(webGuidePage.walk.mobileHeight),
        "sort-select": px(webCatalog.sortSelect.height),
        "wide-card-pill": px(webCatalog.wideCard.pill.height),
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
        "profile-avatar": px(webProfile.card.avatar.size),
        "profile-nav-item": px(webProfile.nav.item.height),
        "profile-nav-icon": px(webProfile.nav.item.iconSize),
        segment: px(webProfile.segmented.segment.height),
        "pbook-image": px(webProfile.bookingCard.image.height),
        pill: px(webProfile.bookingCard.statusPill.height),
        "pill-dot": px(webProfile.bookingCard.statusPill.dotSize),
        "pbook-action": px(webProfile.bookingCard.actions.height),
        "fav-image": px(webProfile.favorites.card.imageHeight),
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
        "profile-avatar": px(webProfile.card.avatar.size),
        "profile-nav": px(webProfile.nav.width),
        "profile-nav-icon": px(webProfile.nav.item.iconSize),
        "pbook-image": px(webProfile.bookingCard.image.width),
        "pill-dot": px(webProfile.bookingCard.statusPill.dotSize),
      },
      minHeight: {
        "venue-promo": px(webVenuePage.promoCard.minHeight),
        "event-card": px(webHomeEventCard.height),
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
        /** Ряд избранного в профиле (узел 3525:15392) — три равные колонки. */
        favorites: `repeat(${webProfile.favorites.columns}, minmax(0, 1fr))`,
      },
      aspectRatio: {
        /** Карта в контактах (3264:69): 788×280. */
        "venue-map": `${webVenuePage.map.width} / ${webVenuePage.map.height}`,
        /** Обложки акции и подборки на главной ниже `lg` — пропорция
         * карточки горизонтального ряда приложения (256×148). Одно значение
         * на обе: у `webHomePromoCard` и `webHomeGuideCard` один и тот же
         * мобильный источник. */
        "home-cover": `${webHomePromoCard.mobileCover.width} / ${webHomePromoCard.mobileCover.height}`,
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
