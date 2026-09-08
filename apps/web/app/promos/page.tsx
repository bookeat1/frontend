import { PromosScreen } from "@web/components/promos/PromosScreen";

/** Листинг «Все акции» — построен по образцу афиши (`/events`). `useSearchParams`
 * здесь нет, граница Suspense не нужна. */
export default function PromosPage() {
  return <PromosScreen />;
}
