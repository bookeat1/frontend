import { fontFamilies } from "./fonts";

/**
 * Type scale verified against Figma node 340:2535 and the search/photo
 * screens. Every role maps 1:1 to a text style actually used in the design —
 * do not add sizes that aren't backed by a real node.
 */
export const typography = {
  /** Home greeting «Куда сегодня, Камила?» (node 986:8720) — the largest type
   * in the app, and the only place that uses it. */
  titleXxl: {
    fontFamily: fontFamilies.notoSansBold,
    fontSize: 24,
    lineHeight: 32,
  },
  /** Venue name on the Reservation detail screen (node 488:9876) — the one
   * place the design goes above 20pt. */
  titleXl: {
    fontFamily: fontFamilies.notoSansBold,
    fontSize: 22,
    lineHeight: 30,
    letterSpacing: -0.5,
  },
  /** Section/screen titles: "Flour Demi", "О ресторане", "Популярное в меню", "Контакты". */
  titleLg: {
    fontFamily: fontFamilies.notoSansBold,
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: -0.5,
  },
  /** Card headings on the Reservation detail screen ("What happens next?",
   * "Contacts") — bold 18, one step below the venue name (node 488:9876). */
  titleCard: {
    fontFamily: fontFamilies.notoSansBold,
    fontSize: 18,
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  /** Screen header titles ("Фотографии") and photo counter ("4 из 6"). */
  titleMd: {
    fontFamily: fontFamilies.notoSansSemiBold,
    fontSize: 16,
    lineHeight: 24,
  },
  /** Restaurant name in search result cards. */
  titleSm: {
    fontFamily: fontFamilies.notoSansBold,
    fontSize: 16,
    lineHeight: 24,
  },
  /** Menu item name / price — pure black in the design, see colors.text.strong. */
  itemName: {
    fontFamily: fontFamilies.notoSansSemiBold,
    fontSize: 16,
    lineHeight: 24,
  },
  /** Active tab label, button labels, chip labels ("Открыто до 23:00", "Забронировать стол"). */
  labelSemiBold: {
    fontFamily: fontFamilies.notoSansSemiBold,
    fontSize: 14,
    lineHeight: 20,
  },
  /** Hours/phone/address primary line, selected search chip label. */
  labelMedium: {
    fontFamily: fontFamilies.notoSansMedium,
    fontSize: 14,
    lineHeight: 20,
  },
  /** Description copy, inactive tab label, address line. */
  body: {
    fontFamily: fontFamilies.notoSansRegular,
    fontSize: 14,
    lineHeight: 20,
  },
  /** Search-chip small labels ("Казахская кухня", "12 000-20 000 ₸"). */
  captionMedium: {
    fontFamily: fontFamilies.notoSansMedium,
    fontSize: 12,
    lineHeight: 16,
  },
  /** Muted captions: hours subtext, phone/address subtext, menu item description. */
  caption: {
    fontFamily: fontFamilies.notoSansRegular,
    fontSize: 12,
    lineHeight: 16,
  },
  /** Bottom-nav labels. */
  navLabel: {
    fontFamily: fontFamilies.notoSansRegular,
    fontSize: 10,
    lineHeight: 14,
  },
  /** Promo banner caption over the photo — the one place the design uses Inter. */
  bannerCaption: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: 12,
    lineHeight: 16,
  },
} as const;

export type TypographyToken = typeof typography;
