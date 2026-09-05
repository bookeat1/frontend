import { ArticleScreen } from "@web/components/articles/ArticleScreen";

/**
 * Страница статьи — узел 5033:7466. Параметр — слаг (`GET /articles/:slug`);
 * форму проверять нечем: неизвестный слаг сервер отдаёт 404, и экран
 * показывает «подборка не найдена».
 */
export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ArticleScreen slug={slug} />;
}
