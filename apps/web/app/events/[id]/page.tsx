import { EventScreen } from "@web/components/events/EventScreen";

/**
 * Карточка события — узел 5033:6922. Идентификатор — UUID из афиши, данные —
 * `GET /events/:eventId`; 404 показывает «событие не найдено».
 */
export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EventScreen id={id} />;
}
