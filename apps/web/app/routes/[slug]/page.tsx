import { GuideRouteScreen } from "@web/components/guide/GuideRouteScreen";

/**
 * «Маршруты» — одна гастропрогулка. Параметр — слаг (`GET /gastroguide/routes/:slug`);
 * форму проверять нечем: неизвестный слаг сервер отдаёт 404, и экран
 * показывает «маршрут не найден». Путь top-level (`/routes/:slug`), а не под
 * `/guide`, — зеркало мобильного роута `apps/mobile/app/routes/[slug].tsx`.
 */
export default async function RoutePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <GuideRouteScreen slug={slug} />;
}
