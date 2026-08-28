import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { GuideRoutePoint } from "@bookeat/api/admin";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GuideRoutePointList } from "../GuideRoutePointList";

/**
 * ЗАЩИТА ОТ РЕГРЕССИИ — порядок остановок гастропрогулки.
 *
 * Что здесь удерживается и почему это стоит теста:
 *
 *  1. Переставляются id ОСТАНОВОК, а не заведений. Список построен на общем
 *     `OrderedVenueList`, который на соседнем экране двигает `restaurant_id`;
 *     ручка маршрута принимает `point_ids` и отвергает всё остальное (422
 *     guide_order_mismatch). Перепутать эти два поля — значит превратить
 *     перетаскивание в отказ, который редактор не сможет объяснить. Тем более
 *     что одно заведение имеет право встречаться в маршруте дважды, и тогда
 *     список id заведений вообще перестаёт быть ключом.
 *
 *  2. Один запрос на перемещение, со ВСЕМ итоговым порядком, и кнопки
 *     «Выше»/«Ниже» дают ровно то же, что перетаскивание: до drag-and-drop с
 *     клавиатуры не добраться, а панелью пользуются и с телефона.
 *
 *  3. Плашку «заведение отключено» получает только остановка-ЗАВЕДЕНИЕ.
 *     Остановка-«место» (парк, набережная) заведения не имеет по замыслу, и
 *     красная плашка у неё была бы сообщением о несуществующей поломке.
 */

afterEach(cleanup);

function point(over: Partial<GuideRoutePoint> = {}): GuideRoutePoint {
  return {
    id: "p-1",
    position: 1,
    kind: "restaurant",
    restaurant_id: "r-1",
    title: "Завтрак",
    title_i18n: undefined,
    description: "",
    description_i18n: undefined,
    photo_url: null,
    address: "ул. Достык, 1",
    address_i18n: undefined,
    latitude: null,
    longitude: null,
    venue: {
      id: "r-1",
      name: "Дареджани",
      address: "ул. Достык, 1",
      cuisine_type: "Грузинская",
      city: "Алматы",
      price_category: "medium",
      primary_image_url: null,
      is_active: true,
    },
    ...over,
  };
}

function renderList(points: GuideRoutePoint[], onReorder = vi.fn()) {
  render(
    <GuideRoutePointList
      points={points}
      reordering={false}
      onReorder={onReorder}
      onRemove={vi.fn()}
      onEdit={vi.fn()}
    />,
  );
  return onReorder;
}

describe("остановки гастропрогулки", () => {
  it("«Ниже» отправляет ВЕСЬ итоговый порядок id остановок, одним запросом", () => {
    const onReorder = renderList([
      point({ id: "p-1", title: "Завтрак", position: 1 }),
      point({ id: "p-2", title: "Прогулка", kind: "place", restaurant_id: null, venue: null, position: 2 }),
      point({ id: "p-3", title: "Ужин", position: 3 }),
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Ниже: Завтрак" }));

    expect(onReorder).toHaveBeenCalledTimes(1);
    expect(onReorder).toHaveBeenCalledWith(["p-2", "p-1", "p-3"]);
  });

  it("переставляются id остановок, а не заведений — одно заведение может быть в маршруте дважды", () => {
    const onReorder = renderList([
      point({ id: "p-1", title: "Завтрак", restaurant_id: "r-1", position: 1 }),
      point({ id: "p-2", title: "Ужин там же", restaurant_id: "r-1", position: 2 }),
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Выше: Ужин там же" }));

    expect(onReorder).toHaveBeenCalledWith(["p-2", "p-1"]);
  });

  it("отключённое заведение помечено — иначе редактор не поймёт, почему у остановки нет карточки", () => {
    renderList([
      point({
        id: "p-1",
        title: "Ужин",
        venue: {
          id: "r-1",
          name: "Дареджани",
          address: "ул. Достык, 1",
          cuisine_type: "Грузинская",
          city: "Алматы",
          price_category: "medium",
          primary_image_url: null,
          is_active: false,
        },
      }),
    ]);

    expect(screen.getByText(/Заведение отключено/)).toBeTruthy();
  });

  it("остановка-«место» плашкой «отключено» не помечается — заведения у неё нет по замыслу", () => {
    renderList([
      point({ id: "p-1", title: "Парк", kind: "place", restaurant_id: null, venue: null }),
    ]);

    expect(screen.queryByText(/Заведение отключено/)).toBeNull();
  });

  it("пустой маршрут объясняет, что публикация без остановок невозможна", () => {
    renderList([]);

    expect(screen.getByText("В прогулке пока нет остановок")).toBeTruthy();
    expect(screen.getByText(/нельзя опубликовать/)).toBeTruthy();
  });
});
