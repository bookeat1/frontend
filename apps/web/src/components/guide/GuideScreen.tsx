"use client";

import { useMemo, type ReactNode } from "react";

import {
  EditorPickCard,
  EditorPickSkeleton,
  RubricTile,
  RubricTileSkeleton,
  WalkCard,
  WalkCardSkeleton,
} from "@web/components/guide/GuideCards";
import { Container } from "@web/components/layout/Container";
import { SiteChrome } from "@web/components/layout/SiteChrome";
import { AsyncBlock, StateMessage } from "@web/components/state/AsyncBlock";
import { useCity } from "@web/lib/city";
import { cx } from "@web/lib/cx";
import { splitGuideCollections } from "@web/lib/guide-collections";
import { useT } from "@web/lib/locale";
import { useGuideCollections, useGuideRoutes } from "@web/lib/queries";

/**
 * Гастрогид `/guide` — Figma «WEB / 08 · Гастрогид», узел 5033:7096.
 * Данные и их деление — как в `apps/mobile/app/gastroguide/index.tsx`:
 *
 *   • `GET /gastroguide/collections` (`useGuideCollections`) кормит «Рубрики»
 *     и «Выбор редакции», делит их `splitGuideCollections`;
 *   • `GET /gastroguide/routes?city=` (`useGuideRoutes`) — «Гастропрогулки».
 *     Город — тот же, что в шапке (`useCity`), а не «Алматы» из макета.
 *
 * Состояния. Загрузка/ошибка/пусто подборок живут в ПЕРВОЙ секции (та же
 * ручка, что у «Выбора редакции», дважды одно и то же не рисуем); «Выбор
 * редакции» появляется только когда есть что показать. Секция маршрутов
 * скрыта целиком, пока маршрутов нет, — двух пустых состояний подряд быть не
 * должно (правило приложения); её отказ страницу не рушит.
 *
 * Заголовки секций — свои, а не `SectionHeader` главной: в макете они
 * 26/24 w600 без подзаголовка и без ссылки «Смотреть все» (страницы
 * `/guide/rubrics` на сайте нет). Хлебных крошек в узле нет.
 */
export function GuideScreen() {
  const t = useT();
  const { city, isError: cityFailed } = useCity();
  const collections = useGuideCollections();
  const routes = useGuideRoutes(city);

  const { rubrics, editorPicks } = useMemo(
    () => splitGuideCollections(collections.data ?? []),
    [collections.data],
  );
  const walks = routes.data ?? [];

  return (
    <SiteChrome active="guide">
      <GuideHero city={city ?? t.explore.cityFallback} />

      {cityFailed ? (
        <Container className="py-10">
          <StateMessage title={t.web.states.errorTitle} text={t.web.states.errorText} tone="danger" />
        </Container>
      ) : null}

      <GuideSection title={t.articles.rubricsTitle} gap="gap-6">
        <AsyncBlock
          query={collections}
          emptyText={t.articles.emptyDescription}
          skeleton={
            <TwoUp>
              <RubricTileSkeleton />
              <RubricTileSkeleton />
              <RubricTileSkeleton />
              <RubricTileSkeleton />
            </TwoUp>
          }
        >
          {() =>
            rubrics.length > 0 ? (
              <TwoUp>
                {rubrics.map((collection) => (
                  <RubricTile key={collection.slug} collection={collection} />
                ))}
              </TwoUp>
            ) : (
              <StateMessage text={t.articles.emptyDescription} />
            )
          }
        </AsyncBlock>
      </GuideSection>

      {editorPicks.length > 0 ? (
        <GuideSection title={t.articles.editorPickTitle} gap="gap-4">
          <div className="flex flex-col gap-4 lg:gap-6">
            {editorPicks.map((collection) => (
              <EditorPickCard key={collection.slug} collection={collection} />
            ))}
          </div>
        </GuideSection>
      ) : collections.isPending ? (
        <GuideSection title={t.articles.editorPickTitle} gap="gap-4">
          <EditorPickSkeleton />
        </GuideSection>
      ) : null}

      {routes.isPending && city ? (
        <GuideSection title={t.articles.routesTitle} gap="gap-4" last>
          <TwoUp>
            <WalkCardSkeleton />
            <WalkCardSkeleton />
          </TwoUp>
        </GuideSection>
      ) : walks.length > 0 ? (
        <GuideSection title={t.articles.routesTitle} gap="gap-4" last>
          <TwoUp>
            {walks.map((route) => (
              <WalkCard key={route.slug} route={route} />
            ))}
          </TwoUp>
        </GuideSection>
      ) : (
        // Секции нет — но нижний отступ страницы (96 в макете) остаётся.
        <div className="pb-8 lg:pb-16" />
      )}
    </SiteChrome>
  );
}

/**
 * Шапка-«издание» (5033:7100): чёрный кадр, текст прижат к низу. Шрифт
 * слогана в макете — Playfair Display Italic; на сайте он не подключён
 * (`next/font` грузит файлы при сборке, а сборка идёт без сети), поэтому
 * стоит стек с засечками с Playfair первым — где шрифт есть в системе, будет
 * он. Город — из шапки, год из макета («2026») не показываем: его неоткуда
 * взять, а зашитый протухает молча.
 */
function GuideHero({ city }: { city: string }) {
  const t = useT();
  return (
    <section className="bg-black">
      <Container className="flex flex-col gap-1.5 pb-8 pt-16 lg:pt-[126px]">
        <p className="text-[14px] font-semibold uppercase leading-[19px] tracking-[0.08em] text-guide-gold lg:text-[16px]">
          {t.articles.guideEyebrow(city)}
        </p>
        <h1 className="break-words font-serif text-[36px] italic leading-[1.2] text-inverse lg:text-[48px]">
          {t.articles.guideHeadline(city)}
        </h1>
        <p className="text-[18px] leading-6 text-inverse lg:text-[20px] lg:leading-5">
          {t.articles.guideSubheadline}
        </p>
      </Container>
    </section>
  );
}

function GuideSection({
  title,
  gap,
  last = false,
  children,
}: {
  title: string;
  gap: "gap-4" | "gap-6";
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={cx("w-full pt-6 lg:pt-8", last ? "pb-12 lg:pb-24" : "pb-6 lg:pb-8")}>
      <Container className={cx("flex flex-col", gap)}>
        <h2 className="break-words text-[22px] font-semibold leading-7 text-ink lg:text-[26px] lg:leading-6">
          {title}
        </h2>
        {children}
      </Container>
    </section>
  );
}

/** Две карточки в ряд с `md` (планшет по контракту), одна колонка на телефоне. */
function TwoUp({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:gap-6">{children}</div>;
}
