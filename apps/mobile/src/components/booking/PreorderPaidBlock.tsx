import type { BookingPayment, Preorder, PreorderLine } from "@bookeat/api";
import { colors, controlHeight, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { formatMoneyMinor } from "../../lib/format";
import { PhotoView } from "../PhotoView";
import { BookingCard } from "./BookingCard";

const t = getDictionary();

/**
 * Платёжная пометка «Предзаказ оплачен» рядом со статусом брони. Это НЕ статус
 * брони (тот про подтверждение рестораном): отдельная зелёная пилюля, тон и
 * размеры те же, что у `BookingStatusPill`.
 */
export function PreorderPaidPill() {
  return (
    <View style={styles.pill} testID="preorder-paid-pill">
      <Text style={styles.pillLabel} numberOfLines={2}>
        {t.booking.paymentPaidTitle}
      </Text>
    </View>
  );
}

/**
 * «Предзаказ» на экране брони (Figma «BookEat (Copy) (Copy)», страница
 * «🟢 Готово к разработке», node `5504:7535`/`5504:7536`/`5504:7537`).
 *
 * БЫЛО: блок показывался ТОЛЬКО когда предзаказ уже оплачен (`payment`
 * требовался). По новому макету бронь с предзаказом — уже состоявшийся факт
 * сама по себе, платёж отдельная история: список блюд теперь виден ВСЕГДА,
 * когда у брони есть хоть одна позиция предзаказа, а `payment` стал
 * необязательным — платёжная пометка и разбивка суммы дорисовываются, только
 * если он есть. Экран решает, звать ли компонент, по
 * `preorder.data.items.length > 0`, а не по факту оплаты.
 *
 * ФОТО БЛЮДА В СПИСКЕ НЕТ В ОТВЕТЕ СЕРВЕРА: макет рисует снимок 140×100 и
 * описание у каждой позиции, но `PreorderLine` (`GET /bookings/:id/preorder`)
 * несёт только `name`/`priceMinor`/`quantity`/`totalMinor` — ни `imageUrl`,
 * ни `description` бэкенд не отдаёт (см. `packages/api/src/types.ts`,
 * `ApiPreorderItem` в `http-mapping.ts`). Подставлять фото блюда из каталога
 * меню по `menuItemId` рискованно и дорого (это отдельный запрос всего меню
 * ради миниатюры, и позиция может уже не числиться в каталоге), а рисовать
 * случайную заглушку как настоящую фотографию — обманывать интерфейс.
 * Поэтому фото — честный декоративный плейсхолдер `PhotoView` без `uri`, а
 * описание блюда не показано вовсе. Если бэкенд добавит `image_url`/
 * `description` в ответ предзаказа — сюда просто добавится `uri`/`description`,
 * менять раскладку не придётся.
 */
export function PreorderCard({ preorder, payment }: { preorder: Preorder; payment?: BookingPayment | null }) {
  const fee = payment?.feeMinor ?? 0;
  const base = payment?.baseAmountMinor;
  const showBreakdown = Boolean(payment) && fee > 0 && base !== undefined;
  return (
    <BookingCard title={t.booking.preorderSectionTitle} titleSize="section" gap={spacing.lg}>
      {payment ? <PreorderPaidPill /> : null}
      <View style={styles.list} testID="preorder-paid-block">
        {preorder.items.map((item) => (
          <PreorderItemRow key={item.id} item={item} />
        ))}
      </View>
      {payment ? (
        <View style={styles.totals}>
          {showBreakdown ? (
            <>
              <View style={styles.row}>
                <Text style={styles.name}>{t.booking.paymentBreakdownDishes}</Text>
                <Text style={styles.price}>{formatMoneyMinor(base)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.name}>{t.booking.paymentBreakdownFee}</Text>
                <Text style={styles.price}>{formatMoneyMinor(fee)}</Text>
              </View>
            </>
          ) : null}
          <View style={styles.row}>
            <Text style={[styles.name, styles.strong]}>{t.booking.paymentBreakdownTotal}</Text>
            <Text style={[styles.price, styles.strong]} testID="preorder-paid-total">
              {formatMoneyMinor(payment.amountMinor)}
            </Text>
          </View>
        </View>
      ) : null}
    </BookingCard>
  );
}

/**
 * Одна позиция — название и цена слева, декоративное фото с круглой пилюлей
 * числа порций справа (узлы 5504:7538…7564). Пилюля — ТОЛЬКО ЧТЕНИЕ, без
 * +/-: это готовый предзаказ состоявшейся брони, а не корзина выбора блюд
 * (та живёт на `restaurant/[id]/book/menu`, `DishRow`).
 */
function PreorderItemRow({ item }: { item: PreorderLine }) {
  return (
    <View style={styles.itemRow}>
      <View style={styles.itemText}>
        <Text style={styles.itemName} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.itemPrice}>{formatMoneyMinor(item.totalMinor)}</Text>
      </View>
      <View style={styles.itemPhotoBox}>
        <PhotoView uri={undefined} style={styles.itemPhoto} decorative placeholderIconSize={24} />
        <View
          style={styles.quantityBadge}
          accessibilityLabel={`${item.quantity} × ${item.name}`}
        >
          <Text style={styles.quantityLabel}>{item.quantity}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: controlHeight.statusPill,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    backgroundColor: colors.status.positiveSurface,
  },
  pillLabel: { ...typography.labelSemiBold, color: colors.status.positiveText, textAlign: "center" },
  // 24 между позициями (узел 5504:7537: gap 24).
  list: { gap: spacing.xxl },
  totals: { gap: spacing.sm },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.md },
  name: { ...typography.body, color: colors.text.primary, flex: 1, flexShrink: 1 },
  price: { ...typography.body, color: colors.text.primary },
  strong: { ...typography.labelSemiBold },
  // Текст слева, фото справа (узел 5504:7538: 187 текста + 16 просвет + 140 фото).
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  itemText: {
    flex: 1,
    gap: spacing.xs,
  },
  itemName: {
    ...typography.itemName,
    color: colors.text.strong,
  },
  itemPrice: {
    ...typography.body,
    color: colors.text.primary,
  },
  itemPhotoBox: {
    width: controlHeight.preorderSummaryPhotoWidth,
    height: controlHeight.preorderSummaryPhotoHeight,
  },
  itemPhoto: {
    width: "100%",
    height: "100%",
    borderRadius: radius.card,
    backgroundColor: colors.background.chip,
  },
  // Круглая белая пилюля с числом порций — угол фото (узлы 5504:7545/7554/7563).
  quantityBadge: {
    position: "absolute",
    right: spacing.sm,
    bottom: spacing.sm,
    width: controlHeight.preorderQuantityBadge,
    height: controlHeight.preorderQuantityBadge,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background.surface,
    shadowColor: colors.overlay.footerShadow,
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 3,
  },
  quantityLabel: {
    ...typography.itemName,
    color: colors.text.primary,
  },
});
