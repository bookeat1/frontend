import type { MenuHighlight } from "@bookeat/api";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";
import { describe, expect, it, vi } from "vitest";
import type { DishCardItem } from "../../../lib/dish-card";
import { MenuHighlightsStrip } from "../MenuHighlightsStrip";

/**
 * Лента «Лучшие позиции» на экранах брони и подтверждения.
 *
 * Что ловят эти тесты: до 2026-08-26 карточки в ленте рисовались без
 * `onPress`, то есть выглядели нажимаемыми и не делали ничего, а описание
 * блюда было обрезано на второй строке и прочитать его целиком было негде.
 * С 2026-08-27 к этому добавилось действие: карточка из ленты обязана уметь
 * то же, что карточка из меню, — счётчик и «Добавить · итого». Считает она по
 * `price_minor` с сервера; нет числа — нет и кнопки.
 *
 * Модалка react-native-web живёт в портале в `document.body`, поэтому запросы
 * идут через `screen` (baseElement = body), а не через возвращённый контейнер.
 */

/** Длинное описание — ровно тот случай, ради которого карточка и открывается:
 * в ленте от него видно два слова с многоточием. */
const LONG_DESCRIPTION =
  "Нежный запеченный баклажан с прохладным соусом из йогурта, чесноком, " +
  "зернами граната и свежей мятой, подается на теплой лепешке домашней выпечки";

/** Неразрывный пробел — так печатает цену маппер; в исходниках тестов он
 * пишется только escape-последовательностью (правило репозитория). */
const PRICE = "3\u00a0900 ₸";

const AUBERGINE: MenuHighlight = {
  id: "dish-1",
  name: "Баклажан по-домашнему",
  description: LONG_DESCRIPTION,
  price: PRICE,
  priceMinor: 390_000,
  isTopPick: true,
  // Фото нет — так у 1565 блюд из 2376 на бою (проверено 2026-08-24).
  photo: undefined,
};

const KEBAB: MenuHighlight = {
  id: "dish-2",
  name: "Люля-кебаб",
  description: "Баранина на углях",
  price: "5\u00a0400 ₸",
  priceMinor: 540_000,
  isTopPick: false,
  photo: undefined,
};

/** Шторка считает нижний отступ по безопасной зоне, а её в jsdom не меряют —
 * отдаём метрики явно, как это делает `app/_layout.tsx` на телефоне. */
const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderStrip(items: MenuHighlight[], onAdd?: (dish: DishCardItem, quantity: number) => void) {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <MenuHighlightsStrip items={items} onAdd={onAdd} />
    </SafeAreaProvider>,
  );
}

/** Открытая карточка блюда. Запросы к ней ОБЯЗАНЫ быть в этих границах:
 * название, описание и цена есть и в самой ленте (там описание просто
 * обрезано стилем, а в DOM лежит целиком), поэтому поиск по всему документу
 * ничего бы не доказал. */
function sheet(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>('[data-testid="dish-card-sheet"]');
}

/** Подписи всех кнопок ВНУТРИ открытой карточки. */
function sheetButtonLabels(): (string | null)[] {
  return Array.from(sheet()?.querySelectorAll('[role="button"]') ?? []).map((b) =>
    b.getAttribute("aria-label"),
  );
}

/** Кнопка «Добавить · итого» внутри карточки, или null — её там нет. */
function addButton(): HTMLElement | null {
  return (
    Array.from(sheet()?.querySelectorAll<HTMLElement>('[role="button"]') ?? []).find((b) =>
      b.getAttribute("aria-label")?.startsWith("Добавить ·"),
    ) ?? null
  );
}

/** Карточка блюда в ленте — она же кнопка, которая открывает шторку. */
function cardFor(item: MenuHighlight): HTMLElement {
  return screen.getByRole("button", { name: item.name });
}

describe("MenuHighlightsStrip", () => {
  it("тап по блюду открывает карточку с ПОЛНЫМ описанием", () => {
    renderStrip([AUBERGINE, KEBAB]);

    // Шторки нет, пока по блюду не нажали.
    expect(sheet()).toBeNull();

    fireEvent.click(cardFor(AUBERGINE));

    const opened = sheet();
    expect(opened).not.toBeNull();
    // Описание ЦЕЛИКОМ — ради этого карточка и открывается.
    expect(opened?.textContent).toContain(LONG_DESCRIPTION);
    expect(opened?.textContent).toContain(AUBERGINE.name);
    expect(opened?.textContent).toContain(PRICE);
    // Открылось ИМЕННО то блюдо, по которому нажали.
    expect(opened?.textContent).not.toContain("Баранина на углях");
  });

  it("карточка блюда без фотографии не рисует плашку на месте фото", () => {
    renderStrip([AUBERGINE]);
    fireEvent.click(cardFor(AUBERGINE));

    // Внутри шторки — только текст. Плашка «фото нет» (PhotoView,
    // testID="photo-placeholder") размером с фотографию читалась бы как
    // незагрузившаяся картинка.
    expect(sheet()?.querySelector('[data-testid="photo-placeholder"]')).toBeNull();
    expect(sheet()?.querySelector('[data-testid="photo-image"]')).toBeNull();
    // Карточка при этом не пустая: название, описание и цена на месте.
    expect(sheet()?.textContent).toContain(AUBERGINE.name);
    expect(sheet()?.textContent).toContain(LONG_DESCRIPTION);
  });

  it("без onAdd лента читательская: добавлять некуда", () => {
    // Так лента ведёт себя там, где предзаказа нет вовсе (заведение без
    // онлайн-брони). Кнопка, которая иногда невозможна, хуже её отсутствия.
    renderStrip([AUBERGINE]);
    fireEvent.click(cardFor(AUBERGINE));

    expect(sheetButtonLabels()).toEqual(["Закрыть"]);
  });

  it("карточка из ленты умеет то же, что из меню: счётчик и «Добавить · итого»", () => {
    // Владелец сравнил два экрана рядом: карточка одна и та же, а действие
    // было только на экране меню. Считать итог мешало отсутствие цены числом —
    // теперь она приходит с сервера (`price_minor`).
    const onAdd = vi.fn();
    renderStrip([AUBERGINE], onAdd);
    fireEvent.click(cardFor(AUBERGINE));

    // Кнопка называет ИТОГ по одной штуке: 3 900 ₸.
    expect(addButton()?.getAttribute("aria-label")).toBe("Добавить · 3\u00a0900\u00a0₸");

    // «+» пересчитывает итог, а не только цифру в счётчике.
    fireEvent.click(screen.getByRole("button", { name: "Увеличить количество" }));
    expect(addButton()?.getAttribute("aria-label")).toBe("Добавить · 7\u00a0800\u00a0₸");

    fireEvent.click(addButton()!);
    expect(onAdd).toHaveBeenCalledTimes(1);
    const [dish, quantity] = onAdd.mock.calls[0];
    expect(dish.id).toBe(AUBERGINE.id);
    expect(dish.priceMinor).toBe(390_000);
    expect(quantity).toBe(2);
  });

  it("нет цены числом — кнопки «Добавить» нет, даже когда добавлять есть куда", () => {
    // Сервер не дал `price_minor`: итог считать не из чего. Показать кнопку и
    // посчитать сумму из строки «3 900 ₸» значило бы придумать деньги.
    const onAdd = vi.fn();
    renderStrip([{ ...AUBERGINE, priceMinor: null }], onAdd);
    fireEvent.click(cardFor(AUBERGINE));

    expect(sheetButtonLabels()).toEqual(["Закрыть"]);
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("крестик закрывает карточку", async () => {
    renderStrip([AUBERGINE]);
    fireEvent.click(cardFor(AUBERGINE));
    expect(sheet()).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    // Не мгновенно: шторка доигрывает отъезд вниз и только потом снимается.
    await waitFor(() => {
      expect(sheet()).toBeNull();
    });
  });
});
