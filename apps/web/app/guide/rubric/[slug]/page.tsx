import { GuideRubricScreen } from "@web/components/guide/GuideRubricScreen";

/**
 * «Гастрогид» — одна рубрика. Параметр — слаг категории
 * (`GET /gastroguide/categories`); зеркало мобильного роута
 * `apps/mobile/app/gastroguide/rubric/[slug].tsx`. Неизвестный слаг не даёт
 * сетевого 404 (рубрики читаются списком, не по одной) — «не найдено» экран
 * решает сам, когда ни рубрики, ни подборок с этим слагом не нашлось.
 */
export default async function GuideRubricPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <GuideRubricScreen slug={slug} />;
}
