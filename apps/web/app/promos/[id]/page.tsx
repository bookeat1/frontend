import { PromoScreen } from "@web/components/promos/PromoScreen";

/**
 * Карточка акции — T1b (2026-09-06, решение владельца: отдельная страница по
 * шаблону события, а не редирект на заведение). Идентификатор — UUID акции,
 * данные — `GET /promos/:promoId`; 404 показывает «акция не найдена».
 */
export default async function PromoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PromoScreen id={id} />;
}
