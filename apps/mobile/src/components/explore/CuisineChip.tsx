import type { Cuisine } from "@bookeat/api";
import { colors, exploreLayout, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { Image } from "expo-image";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { PHOTO_CACHE_POLICY, PHOTO_TRANSITION_MS } from "../../lib/photo-source";
import { PhotoView } from "../PhotoView";
import { cuisineLabelLines, cuisineLabelText } from "./cuisine-label";
import { cuisinePhoto } from "./cuisine-photos";

const t = getDictionary();

/**
 * One circular cuisine chip in the «Выберите кухню» rail. Tapping it opens the
 * catalog filtered to that cuisine (see the home screen's onPickCuisine).
 *
 * Картинка ищется по трём источникам подряд:
 *   1. `cuisine.imageUrl` — ссылка из СПРАВОЧНИКА (`GET /cuisines`). Так новая
 *      кухня получает свой круг без досылки сборки;
 *   2. снимок, вшитый в приложение (cuisine-photos.ts). Он нужен и когда
 *      ссылки нет вовсе (на бою сейчас именно так — см. шапку того файла), и
 *      когда ссылка есть, но НЕ ЗАГРУЗИЛАСЬ: для гостя это одно и то же
 *      «круг серый», поэтому лечится одинаково (onError ниже);
 *   3. фотография реального заведения этой кухни (`photoUri`).
 *
 * ВЕС. Картинка справочника — это то, что загрузили в кабинет, без вариантов
 * поменьше: `*.r2.dev` не умеет преобразований по адресу (проверено —
 * `/cdn-cgi/image/...` отвечает 404), поэтому меньший файл может появиться
 * только при загрузке (см. apps/admin/src/lib/image-downscale.ts). Что может
 * сделать телефон — не качать и не раскодировать одно и то же дважды: кэш
 * память+диск и `recyclingKey`, те же правила, по которым живёт любая
 * остальная фотография приложения (lib/photo-source.ts). Уменьшение картинки
 * под размер круга при декодировании expo-image делает сам
 * (`allowDownscaling`, по умолчанию включено) — поэтому в памяти лежит круг, а
 * не оригинал.
 */
export function CuisineChip({
  cuisine,
  onSelect,
  photoUri,
}: {
  cuisine: Cuisine;
  onSelect: (cuisine: Cuisine) => void;
  /** Фотография заведения этой кухни — последний запасной вариант. */
  photoUri?: string;
}) {
  const bundled = cuisinePhoto(cuisine.id);
  // Одноразовый переключатель: ссылка справочника отвалилась — дальше рисуем
  // запасной снимок и больше к ней не возвращаемся, чтобы круг не моргал.
  const [remoteFailed, setRemoteFailed] = useState(false);
  const remote = remoteFailed ? undefined : cuisine.imageUrl;
  const photo = remote ? { uri: remote } : bundled;
  const label = cuisineLabelText(cuisine.name);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.explore.cuisineFilter(cuisine.name)}
      onPress={() => onSelect(cuisine)}
      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
    >
      {photo ? (
        <Image
          source={photo}
          style={styles.circle}
          contentFit="cover"
          // Память + диск. Без этого (умолчание библиотеки — только диск) круг
          // раскодируется заново каждый раз, когда главная возвращается на
          // экран, хотя байты уже лежат на телефоне.
          cachePolicy={PHOTO_CACHE_POLICY}
          // Ряд кухонь — горизонтальный FlatList, ячейки переиспользуются:
          // без ключа круг соседней кухни проступает сквозь новый.
          recyclingKey={remote ?? String(cuisine.id)}
          transition={PHOTO_TRANSITION_MS}
          // Ссылка справочника не открылась — переключаемся на вшитый снимок.
          // Без этого кухня, у которой в справочнике битый URL, теряет круг,
          // хотя картинка для неё лежит прямо в сборке.
          onError={remote ? () => setRemoteFailed(true) : undefined}
          // Decorative: the label under the circle already names the cuisine,
          // and the pressable carries the full accessibility label.
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : (
        <PhotoView uri={photoUri} style={styles.circle} decorative placeholderIconSize={28} />
      )}
      {/* Название кухни показывается ЦЕЛИКОМ и ОДНИМ кеглем со всеми
          соседями: 14/20 Medium #1B1B1B из макета (3447:12767). Никакого
          `adjustsFontSizeToFit` — именно он давал «Морепродукты» и
          «Средиземноморская» мельче соседей (скриншоты владельца 2026-09-04).

          Ширина подписи не зажата кругом: ячейка hug по тексту (minWidth =
          круг), как в макете, поэтому «Морепродукты» стоит в одну строку и
          чуть шире круга, а круг остаётся по центру над ней. Единственное,
          что переносится, — слово длиннее MAX_SINGLE_LINE_CHARS, и переносится
          явным `-\n` по слогу (см. cuisine-label.ts, почему не U+00AD). */}
      <Text style={styles.label} numberOfLines={cuisineLabelLines(label)}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    // Ячейка hug по содержимому, не уже круга — так в макете (3447:12764:
    // ширины нет, `items-center`). Подпись длиннее круга расширяет ячейку,
    // а не ужимается; круг центрируется над ней.
    minWidth: exploreLayout.cuisineChip,
    alignItems: "center",
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.7,
  },
  circle: {
    width: exploreLayout.cuisineChip,
    height: exploreLayout.cuisineChip,
    borderRadius: radius.pill,
    backgroundColor: colors.background.bannerPlaceholder,
  },
  label: {
    // 14/20 Medium #1B1B1B — макет 3447:12767 (снято 2026-09-04, см.
    // /home/tai/work/design-specs/spec-mobile-home-cuisine-chip.md). Ширины
    // нет намеренно: текст меряет сам себя, ячейка подстраивается.
    ...typography.labelMedium,
    color: colors.text.primary,
    textAlign: "center",
    // Две строки резервируются всегда, чтобы круги соседних кухонь стояли на
    // одной высоте независимо от длины названия.
    minHeight: typography.labelMedium.lineHeight * 2,
  },
});
