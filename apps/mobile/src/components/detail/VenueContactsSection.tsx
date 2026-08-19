import type { Restaurant } from "@bookeat/api";
import { colors } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { Text, View } from "react-native";
import { MapPreview } from "../booking/MapPreview";
import { GlobeSimple, InstagramLogo, MapPin, Phone, WhatsappLogo } from "../icons";
import { DetailInfoRow, detailStyles } from "./DetailBlocks";

const t = getDictionary();

/**
 * Блок «Контакты» карточки контента — заведения-хозяина афиши или акции.
 *
 * Один компонент на оба экрана: до этого он лежал копией в `app/event/[id].tsx`
 * и в `app/promotion/[id].tsx`, и копии уже начали расходиться.
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

  const { website, whatsapp, instagram } = restaurant.social ?? {};
  const hasSocial = Boolean(website || whatsapp || instagram);

  return (
    <View style={detailStyles.section} testID="venue-contacts">
      <Text style={detailStyles.sectionTitle}>{t.restaurant.contacts}</Text>

      {hasSocial ? (
        <View style={detailStyles.socialRow}>
          {website ? (
            <View style={detailStyles.socialIcon}>
              <GlobeSimple size={24} color={colors.text.primary} weight="regular" />
            </View>
          ) : null}
          {whatsapp ? (
            <View style={detailStyles.socialIcon}>
              <WhatsappLogo size={24} color={colors.text.primary} weight="regular" />
            </View>
          ) : null}
          {instagram ? (
            <View style={detailStyles.socialIcon}>
              <InstagramLogo size={24} color={colors.text.primary} weight="regular" />
            </View>
          ) : null}
        </View>
      ) : null}

      {restaurant.address ? (
        <DetailInfoRow
          icon={MapPin}
          primary={restaurant.address}
          secondary={restaurant.addressNote}
        />
      ) : null}

      {restaurant.phone ? (
        <DetailInfoRow icon={Phone} primary={restaurant.phone} secondary={t.restaurant.phoneLabel} />
      ) : null}

      <MapPreview restaurant={restaurant} />
    </View>
  );
}
