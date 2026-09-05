import { EventsScreen } from "@web/components/events/EventsScreen";

/** Афиша — узел 5033:6703. `useSearchParams` здесь нет, граница Suspense не нужна. */
export default function EventsPage() {
  return <EventsScreen />;
}
