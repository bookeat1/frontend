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
  MAX_ACTION_URL_LENGTH,
  classifyPlatformContentFailure,
  validateActionUrl,
  type ActionUrlProblem,
  type PlatformContentFailure,
  type PlatformContentFailureKind,
} from "./platform-content";
export {
  MENU_TOP_PICK_LIMIT,
  classifyMenuTopPickFailure,
  isTopPickReorder,
  moveTopPick,
  topPickSlotsLeft,
  type MenuTopPickFailure,
  type MenuTopPickFailureKind,
} from "./menu-top-picks";
export {
  CONTENT_LOCALES,
  TRANSLATION_LOCALES,
  buildTranslationPatch,
  classifyTranslationFailure,
  emptyTranslationDraft,
  missingTranslations,
  removedTranslations,
  translationDraftFrom,
  translationsChanged,
  type ContentLocale,
  type TranslationDraft,
  type TranslationFailure,
  type TranslationFailureKind,
  type TranslationLocale,
} from "./translations";
export {
  classifyGuideFailure,
  type GuideFailure,
  type GuideFailureKind,
} from "./guide-failure";
export {
  isWhatsAppPhoneShaped,
  normalizeWhatsAppPhone,
} from "./whatsapp-phone";
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
export {
  MAX_VENUE_CUISINES,
  activeCuisines,
  cuisineIdsOf,
  deselectCuisine,
  makeMainCuisine,
  reorderCuisines,
  sameCuisineSelection,
  saveVenueWithCuisines,
  selectCuisine,
  sortCuisines,
  type CuisineDictionaryEntry,
  type CuisineOrderPatch,
  type CuisineSaveInput,
  type CuisineSelectError,
  type CuisineSelectResult,
  type VenueCuisine,
  type VenueSaveOutcome,
} from "./cuisines";
export {
  MAX_VENUE_FEATURES,
  activeVenueFeatures,
  mergeVenueFeatureOptions,
  reorderVenueFeatures,
  sameVenueFeatureSelection,
  sortVenueFeatures,
  splitIntoColumns,
  toggleVenueFeature,
  venueFeatureCodes,
  venueFeatureIdsOf,
  type VenueFeature,
  type VenueFeatureDictionaryEntry,
  type VenueFeatureOrderPatch,
  type VenueFeatureSaveInput,
  type VenueFeatureSelectError,
  type VenueFeatureSelectResult,
} from "./venue-features";
export {
  saveVenueWithDictionaries,
  type VenueSaveSteps,
} from "./venue-save";
export {
  activeCities,
  normalizeCityKey,
  reorderCityIds,
  sortCities,
  validateCityAlias,
  type CityAliasError,
  type CityAliasResult,
  type CityDictionaryEntry,
  type CitySaveInput,
} from "./cities";
