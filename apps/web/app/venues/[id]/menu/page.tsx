import { VenueMenuScreen } from "@web/components/venue/VenueMenuScreen";

/**
 * Страница «Меню {заведение}» — Figma qmMsg4jO1ggmyEHNIAD2ll, узел 5115:7448.
 * Тот же приём с id, что у `/venues/[id]`: неизвестный id сервер отдаёт 404, и
 * экран показывает «заведение не найдено» вместо пустой страницы.
 */
export default async function VenueMenuPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <VenueMenuScreen id={id} />;
}
