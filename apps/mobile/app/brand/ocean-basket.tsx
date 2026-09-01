import React from "react";
import { OceanBasketScreen } from "../../src/components/ocean/OceanBasketScreen";

/**
 * ФИРМЕННАЯ СТРАНИЦА OCEAN BASKET — `/brand/ocean-basket`.
 *
 * Свой маршрут, а не подмена по слагу внутри `/gastroguide/collections/:slug`:
 * общая страница подборки обслуживает весь гастрогид, и ветка «если слаг такой
 * — рисуем другой экран» превратила бы её в развилку, которую придётся
 * помнить при каждой правке. Здесь же адрес говорит сам за себя, а общий путь
 * остался нетронутым.
 *
 * Маршрут ИМЕНОВАННЫЙ (`ocean-basket.tsx`), а не `[slug].tsx`: фирменная
 * страница сегодня ровно одна, и её содержимое зашито в код. Появится вторая —
 * тогда и появится параметр, вместе с реестром страниц; заводить его на один
 * бренд значит обещать конструктор, которого нет.
 *
 * КАК ОТКРЫТЬ. Сегодня — deep link `bookeat://brand/ocean-basket` (в вебе
 * `/brand/ocean-basket`). Из приложения сюда ведёт карточка «Выбора редакции»
 * гастрогида, если у подборки слаг `ocean-basket` (`app/gastroguide/index.tsx`),
 * но такой подборки в базе пока нет: `GET /gastroguide/collections/ocean-basket`
 * отвечает 404 на тесте 2026-09-01. Заведёт редакция — вход появится сам,
 * без правок кода.
 */
export default function OceanBasketBrandPage() {
  return <OceanBasketScreen />;
}
