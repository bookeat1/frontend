import Link from "next/link";

import { Container } from "@web/components/layout/Container";
import { t } from "@web/lib/i18n";

/**
 * Заглушка корня. Экранов на этом этапе нет намеренно — собран только набор
 * компонентов, и единственное, что здесь нужно, это дорога к его витрине.
 * Настоящая главная приедет отдельной задачей.
 */
export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center bg-canvas">
      <Container className="flex flex-col items-start gap-4">
        <h1 className="text-h2 text-ink">{t.web.kit.title}</h1>
        <p className="max-w-[720px] text-bodyM text-ink-secondary">{t.web.kit.subtitle}</p>
        <Link
          href="/kit"
          className="text-bodyL font-semibold text-brand underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          /kit
        </Link>
      </Container>
    </main>
  );
}
