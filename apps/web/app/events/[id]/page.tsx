import { EventScreen } from "@web/components/events/EventScreen";

/**
 * Карточка события — узел 5033:6922. Идентификатор — UUID из афиши; у
 * публичного API нет `GET /events/:id`, поэтому экран ищет событие в листинге
 * и показывает «событие не найдено», если его там нет.
 */
export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EventScreen id={id} />;
}
