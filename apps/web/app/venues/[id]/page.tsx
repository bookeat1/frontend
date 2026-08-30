import { VenueScreen } from "@web/components/venue/VenueScreen";

/**
 * Страница заведения. Идентификатор — UUID из каталога; проверять его форму
 * здесь нечем и незачем: неизвестный id сервер отдаёт 404, и экран показывает
 * «заведение не найдено», а не пустую страницу.
 */
export default async function VenuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <VenueScreen id={id} />;
}
