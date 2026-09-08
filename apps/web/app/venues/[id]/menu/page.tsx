import { Suspense } from "react";

import { VenueMenuScreen } from "@web/components/venue/VenueMenuScreen";

/**
 * Страница «Меню {заведение}» — Figma qmMsg4jO1ggmyEHNIAD2ll, узел 5115:7448.
 * Тот же приём с id, что у `/venues/[id]`: неизвестный id сервер отдаёт 404, и
 * экран показывает «заведение не найдено» вместо пустой страницы.
 *
 * `Suspense` (ТЗ `web-preorder-menu-20260908`, A-WEB-2/A-WEB-3): страница
 * теперь читает `useSearchParams` (`?date&guests&slot` со страницы брони —
 * «Вернуться к бронированию»), а клиентское дерево с `useSearchParams`
 * обязано стоять за границей `Suspense`, иначе Next не может отрисовать
 * страницу заранее и валит сборку — тот же приём, что `/venues/[id]/book/page.tsx`.
 */
export default async function VenueMenuPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
      <VenueMenuScreen id={id} />
    </Suspense>
  );
}
