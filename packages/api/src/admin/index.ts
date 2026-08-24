/**
 * Web-safe admin surface of @bookeat/api. Import from `@bookeat/api/admin` so
 * the mobile mock data (which statically imports .jpg assets) never enters a
 * web bundle. Consumed by apps/admin.
 */
export * from "./types";
export {
  AdminApiClient,
  AdminApiError,
  imageUploadErrorCode,
  type AdminApiClientOptions,
  type ImageUploadErrorCode,
} from "./client";
export {
  classifyCapacitySwitchFailure,
  type CapacitySwitchFailure,
  type CapacitySwitchFailureKind,
} from "./capacity-switch";
export {
  classifyBookingActionFailure,
  type BookingActionFailure,
  type BookingActionFailureKind,
} from "./booking-action";
export {
  classifyGuideFailure,
  type GuideFailure,
  type GuideFailureKind,
} from "./guide-failure";
export {
  parsePriceRangeInput,
  type PriceRangeInput,
  type PriceRangeParseError,
} from "./price-input";
export {
  SOCIAL_LINK_TYPES,
  isKnownSocialLinkType,
  normalizeSocialLink,
  parseSocialLinkRows,
  sameSocialLinks,
  type KnownSocialLinkType,
  type SocialLink,
  type SocialLinkError,
  type SocialLinkInput,
  type SocialLinkNormalizeResult,
  type SocialLinkRowsResult,
} from "./social-links";
