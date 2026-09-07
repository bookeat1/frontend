import { OceanBasketScreen } from "@web/components/ocean/OceanBasketScreen";

/**
 * ФИРМЕННАЯ СТРАНИЦА OCEAN BASKET — `/brand/ocean-basket`.
 *
 * Свой маршрут, а не подмена по слагу внутри `/articles/[slug]`, ровно по той
 * же причине, что у мобильного `app/brand/ocean-basket.tsx`: страница
 * подборки обслуживает ЛЮБУЮ запись гастрогида тем, что отдаёт ручка, а три
 * четверти этой страницы — зашитое содержимое одного бренда.
 *
 * Маршрут именованный, не `[slug]`: фирменная страница сегодня ровно одна.
 */
export default function OceanBasketBrandPage() {
  return <OceanBasketScreen />;
}
