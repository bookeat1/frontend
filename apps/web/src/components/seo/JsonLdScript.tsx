import type { JsonLdNode } from "@web/lib/seo/jsonld";

/**
 * `<script type="application/ld+json">` — сервер-компонент, рендерится вместе
 * с остальным HTML (никакого клиентского добавления в `<head>`, роботы, не
 * исполняющие JS, обязаны увидеть узел сразу).
 *
 * `</script>` внутри строкового значения (адрес, название заведения с этим
 * литералом) закрыл бы тег раньше времени — экранируем ОДИН символ `<` перед
 * `/script`, этого достаточно, чтобы браузер и JSON.parse не спутали разметку
 * с концом скрипта.
 */
export function JsonLdScript({ data }: { data: JsonLdNode }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
