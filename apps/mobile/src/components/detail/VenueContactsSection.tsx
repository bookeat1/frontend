import type { Restaurant } from "@bookeat/api";
import { spacing } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { Text, View } from "react-native";
import { MapPreview } from "../booking/MapPreview";
import { VenueAddressRow, VenuePhoneRow, VenueSocialLinks } from "../contacts/VenueContactLinks";
import { detailStyles } from "./DetailBlocks";

const t = getDictionary();

/**
 * Блок «Контакты» карточки контента — заведения-хозяина афиши или акции.
 *
 * Один компонент на оба экрана: до этого он лежал копией в `app/event/[id].tsx`
 * и в `app/promotion/[id].tsx`, и копии уже начали расходиться.
 *
 * Сами строки контактов — общие с экраном брони (`contacts/VenueContactLinks`),
 * поэтому телефон отсюда звонит, WhatsApp пишет, а сайт открывается ровно так
 * же, как из карточки брони. Раньше здесь лежали неинтерактивные `View`/`Text`.
 *
 * Блок исчезает целиком, а не показывает пустой заголовок:
 *  - заведение ещё не загрузилось (`restaurant === undefined` — запрос идёт
 *    отдельно от самой афиши/акции и может опоздать или не прийти вовсе);
 *  - у заведения нет ни одного контакта.
 * Внутри каждая строка тоже рисуется только когда данные есть.
 *
 * Это НЕ `hasAnyContact` из `booking/ContactsCard`: там в признак входят ещё и
 * координаты, то есть заведение с одной точкой на карте получает блок с одной
 * картой. Здесь правило карточки афиши — блок держится на адресе, телефоне или
 * соцсетях; поведение экрана афиши сохранено ровно как было.
 */
export function hasVenueContacts(restaurant: Restaurant | undefined): restaurant is Restaurant {
  return Boolean(
    restaurant &&
      (restaurant.social?.website ||
        restaurant.social?.whatsapp ||
        restaurant.social?.instagram ||
        restaurant.address ||
        restaurant.phone),
  );
}

export function VenueContactsSection({ restaurant }: { restaurant: Restaurant | undefined }) {
  if (!hasVenueContacts(restaurant)) return null;

  return (
    <View style={detailStyles.section} testID="venue-contacts">
      <Text style={detailStyles.sectionTitle}>{t.restaurant.contacts}</Text>

      {/* Просвет между иконками здесь 8, а не 12 как в брони, — так выверено по
          макету 986:8940; поведение при этом общее. */}
      <VenueSocialLinks social={restaurant.social} gap={spacing.sm} />
      <VenueAddressRow restaurant={restaurant} />
      <VenuePhoneRow restaurant={restaurant} />

      <MapPreview restaurant={restaurant} />
    </View>
  );
}
