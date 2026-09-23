/**
 * Web-safe admin surface of @bookeat/api. Import from `@bookeat/api/admin` so
 * the mobile mock data (which statically imports .jpg assets) never enters a
 * web bundle. Consumed by apps/admin.
 */
export * from "./types";
export {
  PLATFORM_DEFAULT_HOLD_MINUTES,
  PLATFORM_DEFAULT_FREE_CANCEL_HOURS,
  PLATFORM_DEFAULT_LATE_ARRIVAL_TEXT,
} from "../booking-rules";
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
  classifyPushCampaignFailure,
  isPushCampaignInFlight,
  pushCampaignsPollIntervalMs,
  type PushCampaignFailure,
  type PushCampaignFailureKind,
} from "./push-campaigns";
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
  FOODIE_DIET_EXCLUSIVE_CODE,
  FOODIE_OPTION_KINDS,
  FOODIE_PRICE_CATEGORIES,
  buildFoodieI18nField,
  canHideFoodieOption,
  classifyFoodieOptionFailure,
  flattenFoodieOptions,
  isLastActiveOfKind,
  reorderFoodieOptions,
  sortFoodieOptions,
  type FoodieOptionBuckets,
  type FoodieOptionEntry,
  type FoodieOptionFailure,
  type FoodieOptionFailureKind,
  type FoodieOptionKind,
  type FoodieOptionSaveInput,
  type FoodieOptionsAdminResponse,
  type FoodiePriceCategory,
} from "./foodie-options";
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
  FREE_CANCEL_WINDOW_MAX_MINUTES,
  FREE_CANCEL_WINDOW_MIN_MINUTES,
  parseFreeCancelWindowMinutes,
} from "./free-cancel-window";
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
export {
  canTransitionPromoCodeStatus,
  classifyPromoCodeFailure,
  type PromoCodeFailure,
  type PromoCodeFailureKind,
} from "./promo-codes";
