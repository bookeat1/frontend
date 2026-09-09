"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { type Amenity, type Photo, type Restaurant } from "@bookeat/api/client";

import { Container } from "@web/components/layout/Container";
import { SiteChrome } from "@web/components/layout/SiteChrome";
import { AsyncBlock, Skeleton, StateMessage } from "@web/components/state/AsyncBlock";
import { BookingCard } from "@web/components/venue/BookingCard";
import { BottomBar } from "@web/components/ui/BottomBar";
import { Breadcrumb } from "@web/components/ui/Breadcrumb";
import { Button } from "@web/components/ui/Button";
import { HeartIcon } from "@web/components/ui/HeartIcon";
import { Modal } from "@web/components/ui/Modal";
import { RemoteImage } from "@web/components/ui/RemoteImage";
import { Tag } from "@web/components/ui/Tag";
import { isNotFound } from "@web/lib/not-found";
import { useAuth } from "@web/lib/auth";
import { useLoginHref } from "@web/lib/favorites";
import { bookingHref } from "@web/lib/booking-link";
import { promoHref } from "@web/components/home/Cards";
import { cx } from "@web/lib/cx";
import {
  formatMoneyMinor,
  instagramHandle,
  instantDateLabel,
  venueMeta,
  websiteHost,
} from "@web/lib/format";
import { usePreorderDraft } from "@web/lib/use-preorder-draft";
import { DishStepper } from "@web/components/venue/DishStepper";
import {
  ContactCard,
  ContactLink,
  InstagramIcon,
  LinkIcon,
  PhoneIcon,
  PinIcon,
} from "@web/components/venue/VenueContacts";
import { phoneHoursNote, scheduleStatus, type ScheduleStatus } from "@web/lib/schedule";
import { useLocale, useT } from "@web/lib/locale";
import { useFavoriteIds, useMenuSections, useToggleFavorite, useVenue } from "@web/lib/queries";

/**
 * Карточка заведения — Figma 3z0f6dgev4HMwBAHPjTjPo, кадр «WEB / 03 · Карточка
 * заведения» (узел 3261:2). Разметка узла дочитана из API макета 31.08.2026;
 * до этого числа снимались с отрисовки кадра, и половина из них не совпадала.
 *
 * ВЕРТИКАЛЬНЫЙ РИТМ СТРАНИЦЫ (из координат узлов, а не на глаз):
 *   хлебные крошки 24 сверху, 16 до мозаики;
 *   мозаика 460, 32 до шапки заведения;
 *   шапка, 32 до двух колонок;
 *   левая колонка: «О заведении», 24, дальше секции через 32;
 *   низ страницы 80 (узел 3262:2, `paddingBottom`).
 *
 * КОЛОНКИ: просвет 32, правая 380 фиксированная, левая тянется — при
 * контейнере 1200 это ровно 788, ширина мозаики и всех секций макета.
 *
 * ЧТО В МАКЕТЕ ЕСТЬ, А ЗДЕСЬ НЕТ И ПОЧЕМУ:
 *   • вкладки «Обзор / Меню / Отзывы / Фото / Контакты» (узел 3263:2) — это
 *     навигация по разделам, которых пока нет; секции идут подряд одной
 *     страницей;
 *   • ссылка «Смотреть все» у «Популярное в меню» ТЕПЕРЬ ЕСТЬ (2026-09-07,
 *     узел 5115:7448 «Меню {заведение}», `VenueMenuScreen.tsx` /
 *     `/venues/:id/menu`) — раньше вела бы в никуда, страница появилась;
 *   • «500 м от вас» в строке под названием — расстояния сервер не считает;
 *
 * ЧТО ПОЯВИЛОСЬ: ряд ярлыков-удобств под названием (узел 3261:57) — раньше
 * считалось, что таких данных нет. Они есть: детальный ответ отдаёт
 * `features`, и теперь это `Restaurant.amenities`. Аналогично — город в
 * хлебных крошках (узел 3525:14563, «Главная / Алматы / Заведения / …»):
 * раньше города заведения не было в модели отдельным полем, теперь есть
 * `Restaurant.city`, ничего склонять в коде не нужно.
 */
export function VenueScreen({ id }: { id: string }) {
  const t = useT();
  const query = useVenue(id);

  return (
    <SiteChrome active="venues">
      {/* 24 сверху и 80 снизу — паддинги узлов 3261:30 и 3262:2. */}
      {/* Ниже `lg` снизу прибита полоса с кнопкой брони (`VenueBookingBar`),
          и последний блок должен в неё не упираться — просвет из приложения
          (`DETAIL_FOOTER_CLEARANCE`). С `lg` — прежние 80 по макету. */}
      <Container className="pb-bottom-bar-clearance pt-6 lg:pb-20">
        <Breadcrumb
          label={t.web.venue.breadcrumbLabel}
          items={[
            { label: t.web.venue.breadcrumbHome, href: "/" },
            query.data ? { label: query.data.city } : null,
            { label: t.web.venue.breadcrumbVenues, href: "/venues" },
            query.data ? { label: query.data.name, current: true } : null,
          ]}
        />

        <div className="pt-4">
          {isNotFound(query.error) ? (
            <StateMessage title={t.web.venue.notFound.title} text={t.web.venue.notFound.text}>
              <Link
                href="/venues"
                className="text-[16px] font-semibold leading-6 text-brand-text underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                {t.web.venue.notFound.back}
              </Link>
            </StateMessage>
          ) : (
            <AsyncBlock
              query={query}
              emptyText={t.web.venue.notFound.text}
              isEmpty={() => false}
              skeleton={
                <div className="flex flex-col gap-8">
                  <Skeleton className="h-[300px] rounded-xl md:h-venue-mosaic" />
                  <Skeleton className="h-12 w-1/3" />
                  <Skeleton className="h-40 w-full" />
                </div>
              }
            >
              {(venue) => <VenueBody venue={venue} />}
            </AsyncBlock>
          )}
        </div>
      </Container>
    </SiteChrome>
  );
}

function VenueBody({ venue }: { venue: Restaurant }) {
  const t = useT();
  const status = scheduleStatus(venue.schedule, t);
  /** ОДИН инстанс на страницу, поднят сюда из `MenuSection`: хук читает и
   * пишет один и тот же `sessionStorage`, но React-состояние он держит СВОЙ —
   * два отдельных вызова `usePreorderDraft(venue.id)` в разных компонентах
   * этой же страницы НЕ видят обновлений друг друга (только после
   * перемонтирования/навигации). Клик «+» на карточке блюда обязан сразу
   * обновить сумму рядом с заголовком меню — на той же странице, без похода
   * на `/venues/[id]/book` (владелец, 2026-09-06). */
  const preorder = usePreorderDraft(venue.id);
  const photos = venue.coverPhoto
    ? [venue.coverPhoto, ...venue.photos.filter((photo) => photo.id !== venue.coverPhoto?.id)]
    : venue.photos;
  const hasPromos = venue.promoBanners.length > 0;
  /** Окно со всеми снимками открывают ДВА элемента — кнопка на мозаике и
   * вкладка «Фото · N», — поэтому его состояние живёт здесь, а не в галерее. */
  const [galleryOpen, setGalleryOpen] = useState(false);

  /** Есть ли что показать в блоке контактов (2026-09-09, блок вернули без
   * карты) — та же `hasAnything`-проверка, что раньше жила внутри `Contacts`,
   * поднята сюда, потому что от неё зависит и вкладка «Контакты»: вкладка на
   * пустую секцию вела бы в никуда. */
  const hasContacts =
    venue.address.trim().length > 0 ||
    Boolean(venue.phone) ||
    Boolean(venue.social?.instagram || venue.social?.whatsapp || venue.social?.website);

  /**
   * Есть ли меню вообще (решение владельца 2026-09-09, `MenuSection` больше
   * не рисует ничего — ни сетки, ни заглушки — без карточек «Популярное»,
   * см. комментарий над `MenuSection`). Раньше здесь ещё досматривался полный
   * список блюд через `GET /restaurants/:id/menu` (`useMenuSections`), чтобы
   * не прятать секцию с настоящим меню без «Популярного» — с тех пор как
   * секция сама перестала что-либо показывать в этом случае, тот досмотр
   * держал бы вкладку «Меню» включённой БЕЗ соответствующей секции на
   * странице (`SECTION_ID.menu` не рендерится → вкладка ведёт в никуда, тот
   * же класс бага, что разбирает комментарий у `hasContacts` выше). Поэтому
   * признак — снова просто «есть карточки „Популярное“», без второго
   * запроса.
   */
  const hasMenu = venue.menuHighlights.length > 0;

  /** Вкладки собираются из ТОГО, ЧТО НА СТРАНИЦЕ ЕСТЬ: нет акций — нет и
   * вкладки. `useMemo` здесь не украшение: список уходит в зависимость
   * наблюдателя прокрутки, и новый массив на каждый кадр пересоздавал бы его. */
  const tabs = useMemo<SectionTab[]>(() => {
    const all: (SectionTab | null)[] = [
      { id: SECTION_ID.about, label: t.web.venue.tabs.overview },
      hasMenu ? { id: SECTION_ID.menu, label: t.web.venue.tabs.menu } : null,
      photos.length > 0
        ? {
            id: SECTION_ID.photos,
            label: t.web.venue.tabs.photos(photos.length),
            // Мозаика стоит ВЫШЕ вкладок, и прокрутка к ней уводила бы вверх,
            // за пределы страницы, которую гость читает. Вкладка делает то же,
            // что кнопка «Все фото», — открывает все снимки.
            onSelect: () => setGalleryOpen(true),
          }
        : null,
      hasPromos ? { id: SECTION_ID.promos, label: t.web.venue.tabs.promos } : null,
      hasContacts ? { id: SECTION_ID.contacts, label: t.web.venue.tabs.contacts } : null,
    ];
    return all.filter((tab): tab is SectionTab => tab !== null);
  }, [t, hasMenu, photos.length, hasPromos, hasContacts]);

  return (
    <div className="flex flex-col gap-8">
      <Gallery photos={photos} name={venue.name} open={galleryOpen} onOpenChange={setGalleryOpen} />

      <VenueHeader venue={venue} status={status} />

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Левая колонка: вкладки, «О заведении» и дальше 24, потом секции
            через 32 (узлы 3525:14612 и 3525:14639). */}
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <SectionTabs tabs={tabs} />

          <section id={SECTION_ID.about} className="flex scroll-mt-6 flex-col gap-3">
            <h2 className="text-h3 tracking-[-0.4px] text-ink">{t.web.venue.about.title}</h2>
            <p className="whitespace-pre-line break-words text-[16px] leading-[26px] text-ink-secondary">
              {venue.description.trim() || t.web.venue.about.empty}
            </p>
          </section>

          <div className="flex flex-col gap-8">
            {/* У заведения без меню (ни «Популярного», ни полного) блока нет
                вовсе — ни сетки карточек, ни ссылки «Полное меню»: вход в
                пустоту хуже отсутствия входа (решение владельца 2026-09-09,
                отменяет прежний 🟡-компромисс A10 `web-preorder-menu-20260908`
                про «дешёвый признак `acceptsOnlineBookings`»). */}
            {hasMenu ? <MenuSection venue={venue} preorder={preorder} /> : null}
            {hasPromos ? <PromoSection venue={venue} /> : null}
            {hasContacts ? <Contacts venue={venue} /> : null}
          </div>
        </div>

        <aside className="hidden lg:block lg:w-venue-aside lg:shrink-0">
          {/* НИЖЕ `lg` КОЛОНКИ НЕТ (контракт `docs/responsive.md`, дыра № 8):
              в приложении на экране заведения слоты не выбирают — внизу
              прибита одна кнопка «Забронировать стол», а выбор живёт на
              экране брони. Карточка со слотами под контактами, в самом низу
              страницы, была бы третьей выдумкой, а не адаптивом.

              Правая колонка — узел 3525:14730 «Right column (sticky)»: 380
              фиксированной ширины, вертикальный auto-layout с просветом 16 и
              РОВНО ОДИН ребёнок, карточка брони 3525:14731. Просвет 16 заложен
              под второй блок, но второго блока в макете нет, поэтому и здесь
              его нет.

              ЧАСЫ РАБОТЫ ОТСЮДА УБРАНЫ. Пока брони на сайте не было, они
              занимали место карточки «взаймы». В макете отдельного блока часов
              нет НИГДЕ на странице: время работы живёт только ярлыком в шапке
              заведения (3525:14586 «Открыто до 23:00», из `venue.schedule` в
              `lib/schedule.ts`, ярлык берёт время закрытия сегодняшнего дня).
              Строка под телефоном в блоке контактов («Ежедневно с … до …»)
              осталась только там же — блок контактов (без карты) вернули
              2026-09-09.

              «Липкость» — единственное, что о ней известно, это слово (sticky)
              в имени слоя: ни оффсета, ни второго состояния в макете нет.
              Отступ сверху 24 остался прежним и макетом НЕ подтверждён. */}
          <div className="lg:sticky lg:top-6">
            <BookingCard venue={venue} />
          </div>
        </aside>
      </div>

      <VenueBookingBar venueId={venue.id} />
    </div>
  );
}

/**
 * Прибитая к низу кнопка «Забронировать стол» ниже `lg` — дословно футер
 * `apps/mobile/app/restaurant/[id]/index.tsx` (строки 221–231): одна красная
 * кнопка, ведущая на экран брони, без телефонного запасного варианта и без
 * неактивного состояния — их в макете приложения нет. Заведение офлайн
 * тоже ведёт на `/book`: там стоит то же объяснение, что и в карточке.
 * Подпись — мобильный ключ `t.restaurant.bookTable` (есть в ru/kk/en), новых
 * ключей под адаптив контракт не заводит.
 */
function VenueBookingBar({ venueId }: { venueId: string }) {
  const t = useT();
  return (
    <BottomBar>
      <Button size="submit" block asLink href={bookingHref(venueId)}>
        {t.restaurant.bookTable}
      </Button>
    </BottomBar>
  );
}

/** Подпись вкладки с полосой под ней: одна разметка на ссылку и на кнопку,
 * чтобы они не разошлись видом. */
function TabLabel({ label, current }: { label: string; current: boolean }) {
  return (
    <>
      <span
        className={cx(
          "text-[16px] leading-6",
          current ? "font-semibold text-ink" : "font-medium text-ink-secondary",
        )}
      >
        {label}
      </span>
      <span
        aria-hidden="true"
        className={cx(
          "h-venue-tabs-underline w-full rounded-nav-underline",
          current ? "bg-brand" : "bg-transparent",
        )}
      />
    </>
  );
}

/** Ссылка-якорь или кнопка-действие — снаружи они выглядят одинаково. */
function TabShell({ tab, current }: { tab: SectionTab; current: boolean }) {
  const shell =
    "flex flex-col items-center gap-venue-tabs-label-gap focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

  if (tab.onSelect) {
    return (
      <button type="button" onClick={tab.onSelect} className={shell}>
        <TabLabel label={tab.label} current={current} />
      </button>
    );
  }

  return (
    <a href={`#${tab.id}`} aria-current={current ? "true" : undefined} className={shell}>
      <TabLabel label={tab.label} current={current} />
    </a>
  );
}

/**
 * Идентификаторы секций страницы. Одни и те же в разметке секции и в ссылке
 * вкладки: разъехались бы — вкладка молча вела бы в никуда.
 */
const SECTION_ID = {
  about: "venue-about",
  menu: "venue-menu",
  photos: "venue-photos",
  promos: "venue-promos",
  contacts: "venue-contacts",
} as const;

interface SectionTab {
  id: string;
  label: string;
  /** Вкладка не якорь, а действие (так устроено «Фото»): тогда она рисуется
   * кнопкой и в подсветке по прокрутке не участвует — прокручивать нечего. */
  onSelect?: () => void;
}

/**
 * Вкладки страницы — узел 3525:14613: ряд через 32, подпись 16/24 (активная
 * SemiBold основным цветом, остальные Medium вторичным), под подписью полоса 2
 * через 12; у неактивной вкладки полоса прозрачная, поэтому строка не прыгает.
 *
 * ЭТО ССЫЛКИ НА ЯКОРЯ, А НЕ ВКЛАДКИ-ПЕРЕКЛЮЧАТЕЛИ. Разделов «Меню» и «Фото»
 * отдельными страницами у сайта нет, а всё их содержимое уже лежит на этой
 * странице ниже. Поэтому нажатие прокручивает к секции — и работает без
 * JavaScript, средним кликом и с клавиатуры.
 *
 * Вкладки «Отзывы · 312» из макета здесь НЕТ: отзывов на сайте не существует
 * ни секцией, ни страницей, и вкладка вела бы в пустоту. Вкладка «Контакты»
 * снималась целиком вместе с блоком 2026-09-07 (карта без провайдера), но
 * блок (без карты) вернули 2026-09-09 — вкладка с ним же, за тем же
 * `hasContacts`, что и сама секция.
 *
 * Активная вкладка вычисляется наблюдателем прокрутки. Наблюдателя нет
 * (старый браузер) — активной остаётся первая: это хуже подсветки, но не
 * ломает переходы.
 */
function SectionTabs({ tabs }: { tabs: SectionTab[] }) {
  const t = useT();
  const [active, setActive] = useState<string | undefined>(tabs[0]?.id);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      // Полоса «сейчас читают»: верхние 30% окна. Без неё активной становилась
      // бы любая секция, краем попавшая в экран, и подсветка дрожала бы.
      { rootMargin: "0px 0px -70% 0px", threshold: 0 },
    );
    for (const tab of tabs) {
      if (tab.onSelect) continue;
      const element = document.getElementById(tab.id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [tabs]);

  if (tabs.length < 2) return null;

  return (
    <nav aria-label={t.web.venue.tabs.label}>
      <ul className="flex flex-wrap gap-venue-tabs-gap">
        {tabs.map((tab) => {
          const current = tab.id === active;
          return (
            <li key={tab.id}>
              <TabShell tab={tab} current={current} />
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Шапка заведения — узел 3525:14582.
 *
 * Название 40/48 Bold с трекингом −0.8, рядом ярлык статуса через 14; строка
 * свойств 16/24; ряд ярлыков-удобств через 12 от неё, ярлыки через 8.
 * Действия справа — обводочные кнопки 46 высотой (размер `action`).
 */
function VenueHeader({
  venue,
  status,
}: {
  venue: Restaurant;
  status: ScheduleStatus;
}) {
  const t = useT();
  const amenities = venue.amenities ?? [];

  return (
    <header className="flex flex-wrap items-start justify-between gap-6">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-venue-name-gap">
          <h1 className="text-h1 tracking-[-0.8px] text-ink">{venue.name}</h1>
          {/* Ярлык «Открыто до 23:00» — с точкой только когда заведение
              действительно открыто: у «часы не указаны» точке нечего значить. */}
          <Tag tone={status.tone === "success" ? "success" : "neutral"} dot={status.tone === "success"}>
            {status.label}
          </Tag>
        </div>
        <p className="text-[16px] leading-6 text-ink-secondary">{venueMeta(venue, t)}</p>
        {amenities.length > 0 ? <AmenityRow amenities={amenities} /> : null}
        {venue.reviewsCount > 0 ? (
          <p className="text-bodyM text-ink-tertiary">
            {venue.rating.toFixed(1)}
            {t.web.format.metaSeparator}
            {t.web.venue.reviews(venue.reviewsCount)}
          </p>
        ) : null}
      </div>
      {/* Две кнопки, как в макете (узел 3525:14601), просвет 10. Обе делают
          то, что обещают: «Сохранить» ходит в `PUT/DELETE /favorites/:id`,
          «Поделиться» открывает системное окно или копирует адрес. */}
      <div className="flex items-center gap-2.5">
        <SaveButton id={venue.id} />
        <ShareButton name={venue.name} />
      </div>
    </header>
  );
}

/** Ряд удобств — узел 3261:57: ярлыки через 8, подписи приходят с сервера
 * уже переведёнными, своего словаря у них нет и быть не должно. */
function AmenityRow({ amenities }: { amenities: Amenity[] }) {
  const t = useT();
  return (
    <ul aria-label={t.web.venue.amenitiesLabel} className="flex flex-wrap gap-2">
      {amenities.map((amenity) => (
        <li key={amenity.id}>
          <Tag>{amenity.name}</Tag>
        </li>
      ))}
    </ul>
  );
}

/**
 * Мозаика фотографий — узел 3261:33.
 *
 * ТРИ ЧИСЛА, КОТОРЫХ НЕ БЫЛО РАНЬШЕ:
 *   • деление 788 к 404 при просвете 8, а не «две трети к одной» — разница
 *     двенадцать пикселей, и она видна;
 *   • радиус 20 лежит на КОНТЕЙНЕРЕ, который обрезает содержимое: у самих
 *     фотографий радиуса нет, внутренние углы мозаики прямые. Раньше каждая
 *     плитка скруглялась отдельно, и мозаика читалась как пять карточек;
 *   • «Все фото · N» — БЕЛАЯ кнопка 48 высотой с радиусом 12 и тенью,
 *     прижатая к правому нижнему углу всей мозаики (16/16), а не тёмная
 *     таблетка поверх последней плитки (узел 3261:42).
 *
 * Фотографий может быть меньше четырёх и может не быть вовсе: тогда правая
 * колонка не рисуется, а не оставляет серые дыры.
 *   1 — одна плитка во всю высоту большого снимка;
 *   2 — колонка из двух по 226 (226 + 8 + 226 = 460, ровно в высоту);
 *   3 — 2×2, где третья растянута на обе колонки;
 *   4 — сетка макета.
 */
function Gallery({
  photos,
  name,
  open,
  onOpenChange,
}: {
  photos: Photo[];
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  /** Индекс фото, открытого во весь экран, ПОВЕРХ сетки (окно кита). `null` —
   * лайтбокс закрыт. Своё состояние, а не поле сетки: сетку не нужно
   * размонтировать, чтобы вернуться к ней «Esc»-ом или крестиком лайтбокса. */
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (photos.length === 0) {
    return <StateMessage text={t.web.venue.gallery.empty} />;
  }

  const [main, ...rest] = photos;
  const grid = rest.slice(0, 4);

  return (
    <section id={SECTION_ID.photos} aria-label={t.web.venue.gallery.label} className="relative scroll-mt-6">
      <div
        className={cx(
          "grid gap-venue-mosaic-gap overflow-hidden rounded-xl md:h-venue-mosaic",
          grid.length > 0 ? "md:grid-cols-mosaic" : "md:grid-cols-1",
        )}
      >
        {/* Плитки мозаики — сразу лайтбокс на своём индексе, БЕЗ обязательного
            захода через модалку «все фото» (владелец, живой клик по фото на
            `/venues/[id]` открывал только кнопку-счётчик, сама плитка молчала). */}
        <button
          type="button"
          onClick={() => setLightboxIndex(0)}
          aria-label={t.web.venue.gallery.openPhoto(1)}
          className="relative h-[300px] bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand md:h-full"
        >
          <RemoteImage
            src={main.uri}
            alt={main.alt || name}
            sizes="(min-width: 1280px) 788px, 100vw"
            priority
          />
        </button>
        {grid.length > 0 ? (
          <div
            className={cx(
              "grid gap-venue-mosaic-gap",
              grid.length >= 3 ? "grid-cols-2" : "grid-cols-1",
            )}
          >
            {grid.map((photo, index) => (
              <button
                type="button"
                key={photo.id}
                onClick={() => setLightboxIndex(index + 1)}
                aria-label={t.web.venue.gallery.openPhoto(index + 2)}
                className={cx(
                  "relative bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                  grid.length === 1 ? "h-[200px] md:h-full" : "h-[110px] md:h-venue-tile",
                  grid.length === 3 && index === 2 ? "col-span-2" : "",
                )}
              >
                <RemoteImage src={photo.uri} alt={photo.alt || name} sizes="198px" />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Кнопка настоящая: открывает все снимки. Раньше на этом месте стояла
          неинтерактивная плашка, то есть элемент, который выглядит кнопкой и
          ничего не делает. */}
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className="absolute bottom-venue-mosaic-inset-b right-venue-mosaic-inset inline-flex h-venue-gallery-btn items-center gap-1.5 rounded-md bg-photo-action px-4 text-[14px] font-semibold leading-5 text-ink shadow-photo-action transition-colors hover:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <GridIcon />
        {t.web.venue.gallery.count(photos.length)}
      </button>

      {open ? (
        <Modal
          title={t.web.venue.gallery.label}
          onClose={() => onOpenChange(false)}
          // Окно кита узкое (380) — это ширина модалки входа. Для сетки
          // снимков нужна вся полоса контента; `!` здесь обязателен, потому
          // что `max-w-modal` стоит в самом компоненте.
          className="!max-w-[960px]"
        >
          <ul className="grid max-h-[70vh] grid-cols-2 gap-venue-mosaic-gap overflow-y-auto md:grid-cols-3">
            {photos.map((photo, index) => (
              <li key={photo.id} className="relative aspect-[4/3] overflow-hidden rounded-lg bg-muted">
                {/* Клик по плитке открывает её же во весь экран (лайтбокс
                    ниже), а не просто показывает сетку сеткой. */}
                <button
                  type="button"
                  onClick={() => setLightboxIndex(index)}
                  aria-label={t.web.venue.gallery.openPhoto(index + 1)}
                  className="absolute inset-0 h-full w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  <RemoteImage src={photo.uri} alt={photo.alt || name} sizes="300px" />
                </button>
              </li>
            ))}
          </ul>
        </Modal>
      ) : null}

      {lightboxIndex !== null ? (
        <PhotoLightbox
          photos={photos}
          name={name}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      ) : null}
    </section>
  );
}

/**
 * Полноэкранный просмотр ОДНОГО фото поверх сетки — второй, более глубокий
 * слой, чем `Modal` со всеми снимками. На мобильном это отдельный экран
 * `app/restaurant/[id]/photo/[photoId].tsx` с горизонтальным свайпом; на вебе
 * страницы нет, поэтому это состояние внутри `Gallery`, а не роут.
 *
 * `z-[60]`: окно всех фото уже стоит на `z-50` (сам `Modal`), лайтбокс должен
 * лечь строго поверх него, а не рядом.
 *
 * Стрелки и Escape ловятся В ФАЗЕ ПЕРЕХВАТА (`capture: true`) и глушатся
 * `stopPropagation`: `Modal` вешает свой обработчик Escape на `document` тоже,
 * и без перехвата один и тот же Escape успевал закрыть сразу оба слоя —
 * гость терял сетку фото, хотя хотел закрыть только фото.
 */
function PhotoLightbox({
  photos,
  name,
  index,
  onIndexChange,
  onClose,
}: {
  photos: Photo[];
  name: string;
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const t = useT();
  const total = photos.length;
  const photo = photos[index];

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      } else if (event.key === "ArrowLeft") {
        event.stopPropagation();
        onIndexChange((index - 1 + total) % total);
      } else if (event.key === "ArrowRight") {
        event.stopPropagation();
        onIndexChange((index + 1) % total);
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [index, total, onIndexChange, onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.web.venue.gallery.label}
      className="fixed inset-0 z-[60] flex flex-col bg-scrim"
    >
      <header className="flex items-center justify-between gap-4 p-4 text-ink-on-inverse">
        <span className="text-[14px] font-medium leading-5">
          {t.web.venue.gallery.photoOf(index + 1, total)}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.web.ui.close}
          className="flex h-10 w-10 items-center justify-center rounded-full text-ink-on-inverse hover:bg-on-inverse-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path
              d="M3 3l10 10M13 3L3 13"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </header>

      <div className="relative min-h-0 flex-1">
        <RemoteImage src={photo.uri} alt={photo.alt || name} sizes="100vw" priority />

        {total > 1 ? (
          <>
            <button
              type="button"
              onClick={() => onIndexChange((index - 1 + total) % total)}
              aria-label={t.web.venue.gallery.previousPhoto}
              className="absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-photo-control text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <ArrowIcon direction="left" />
            </button>
            <button
              type="button"
              onClick={() => onIndexChange((index + 1) % total)}
              aria-label={t.web.venue.gallery.nextPhoto}
              className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-photo-control text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <ArrowIcon direction="right" />
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
      className={direction === "left" ? "" : "rotate-180"}
    >
      <path
        d="M10 3L5 8l5 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

/**
 * «Популярное в меню» — узел 3263:89: просвет секции 20, сетка 16, в строке
 * три карточки по 252 при колонке 788. Карточка (узел 3263:95): радиус 16,
 * картинка 150, тело паддинг 12/16 с просветом 6, цена прижата к низу
 * (16/24 Bold).
 *
 * СТЕППЕР НА КАРТОЧКЕ (A-WEB-2, `venue-menu-stepper-promo-card`, 2026-09-06) —
 * только у блюда с `priceMinor !== null` (правило приложения «нет числа — нет
 * действия», как в `DishDetailSheet`) и только у заведения с
 * `acceptsOnlineBookings`: без кнопки брони предзаказу некуда прикрепиться.
 * Черновик — `usePreorderDraft`, `sessionStorage` по заведению; отдельно на
 * `apps/mobile` степпер НЕ переносится (решение владельца 2026-09-06,
 * см. спеку), `DishDetailSheet` там не тронут.
 *
 * БЕЗ КАРТОЧЕК «ПОПУЛЯРНОЕ» (2026-09-09, решение владельца): секция целиком
 * не рендерится, если у заведения пустой `menuHighlights` — заголовок
 * «Лучшие позиции» и ссылка «Всё меню →» дублировали вкладку «Меню» на этой
 * же странице (`hasMenu`/`fullMenuQuery` в `VenueBody`, не связана с этим
 * компонентом). Раньше здесь была заглушка `fullMenuOnly` (A10,
 * `web-preorder-menu-20260908`) — убрана, вход в меню остаётся только через
 * вкладку.
 */
function MenuSection({
  venue,
  preorder,
}: {
  venue: Restaurant;
  /** Один инстанс на всю страницу — см. комментарий в `VenueBody`. */
  preorder: ReturnType<typeof usePreorderDraft>;
}) {
  const t = useT();
  const canPreorder = venue.acceptsOnlineBookings;

  if (venue.menuHighlights.length === 0) {
    return null;
  }

  return (
    <section id={SECTION_ID.menu} className="flex scroll-mt-6 flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        {/* Заголовок «Лучшие позиции» — тот же ключ и та же формулировка, что
            на `apps/mobile` (`t.restaurant.menuHighlights`), а не отдельная
            веб-строка «Популярное в меню»: решение владельца, секция одна и
            та же на обеих платформах. */}
        <h2 className="text-h3 tracking-[-0.4px] text-ink">{t.restaurant.menuHighlights}</h2>
        <div className="flex items-baseline gap-4">
          {/* Растёт сразу по клику «+» на карточке блюда ниже — общий
              `preorder` с родителем, без второго вызова хука (см. VenueBody). */}
          {canPreorder && preorder.totalMinor > 0 ? (
            <p className="text-[15px] font-semibold leading-5 text-ink">
              {t.web.venue.menu.preorderTotal(formatMoneyMinor(preorder.totalMinor))}
            </p>
          ) : null}
          {/* Полное меню — отдельная страница (узел 5115:7448), а не ещё шесть
              карточек здесь: «Популярное в меню» остаётся коротким списком. */}
          <Link
            href={`/venues/${venue.id}/menu`}
            className="text-[15px] font-semibold leading-5 text-brand-text hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {t.web.venue.menu.viewAll}
          </Link>
        </div>
      </div>
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {venue.menuHighlights.slice(0, 6).map((dish) => {
            const canAdd = canPreorder && dish.priceMinor !== null;
            const quantity = preorder.quantityOf(dish.id);
            return (
              <li key={dish.id}>
                {/* Не `Card`: у той радиус 24 и тень карточки заведения
                    (узел 3280:5482). Карточка блюда — свой узел 3263:95 с
                    радиусом 16 и той же двойной тенью. */}
                <div className="flex h-full flex-col overflow-hidden rounded-lg bg-canvas shadow-card">
                  <div className="relative h-venue-dish-image w-full bg-muted">
                    <RemoteImage
                      src={dish.photo?.uri}
                      alt={dish.name}
                      sizes="(min-width: 1280px) 252px, 33vw"
                    />
                  </div>
                  {/* Тело карточки: название с описанием сверху, цена и
                      степпер прижаты к низу (`justify-between`, узел
                      3525:14648), а не отодвинуты произвольным отступом. */}
                  <div className="flex flex-1 flex-col justify-between gap-4 px-venue-dish-x py-venue-dish-y">
                    <div className="flex flex-col gap-1.5">
                      <p className="break-words text-[15px] font-semibold leading-[22px] text-ink">
                        {dish.name}
                      </p>
                      {dish.description ? (
                        <p className="line-clamp-2 break-words text-[13px] leading-[18px] text-ink-tertiary">
                          {dish.description}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="break-words text-[16px] leading-6 text-ink">
                        {dish.price || t.web.venue.menu.noPrice}
                      </p>
                      {canAdd && dish.priceMinor !== null ? (
                        <DishStepper
                          quantity={quantity}
                          max={preorder.maxQty}
                          dishName={dish.name}
                          onAdd={() =>
                            preorder.add({
                              menuItemId: dish.id,
                              name: dish.name,
                              priceMinor: dish.priceMinor as number,
                            })
                          }
                          onIncrement={() => preorder.increment(dish.id)}
                          onDecrement={() => preorder.decrement(dish.id)}
                        />
                      ) : null}
                    </div>
                  </div>
                </div>
              </li>
            );
        })}
      </ul>
    </section>
  );
}

/**
 * «Акции заведения» — узел 3264:2, карточка 3379:11497: 262 высотой, радиус
 * 18, паддинг 20, фотография с вертикальным затемнением, заголовок 22/30 Bold
 * прижат к низу.
 *
 * ПОЧИНЕНО 2026-09-06 (`venue-menu-stepper-promo-card`, задача B-WEB-1):
 * `discount_percent`, `terms` и `cover_image_url` реально отдаются сервером
 * (миграции 0032/0060/0066/0101) — их выбрасывал клиентский `mapPromoBanners`
 * (`packages/api`), а не отсутствие данных на бэкенде. Бейдж и подзаголовок
 * рисуются тем же правилом, что на главной (`home/Cards.tsx`) и на
 * `/promos/[id]` (`PromoScreen.tsx`): бейдж только при `discountPercent > 0`,
 * подзаголовок «{заведение} · {terms}», а без `terms` — «{заведение} ·
 * до {дата}» (та же формула дат, что на `/promos/[id]`, `instantDateLabel` +
 * `t.promotions.until`). Фотографии у настоящей акции тоже больше нет
 * оснований прятать — заливка остаётся только когда `coverImageUrl: null`.
 */
function PromoSection({ venue }: { venue: Restaurant }) {
  const t = useT();
  const { locale } = useLocale();
  return (
    <section id={SECTION_ID.promos} className="flex scroll-mt-6 flex-col gap-5">
      <h2 className="text-h3 tracking-[-0.4px] text-ink">{t.web.venue.promos.title}</h2>
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {venue.promoBanners.map((promo) => {
          const untilDate = instantDateLabel(promo.endsAt, locale);
          const subtitle = t.promotions.subtitle([
            venue.name,
            promo.terms.trim() || (untilDate ? t.promotions.until(untilDate) : ""),
          ]);
          return (
            <li key={promo.id}>
              <Link
                href={promoHref(promo.id)}
                className={cx(
                  "relative flex min-h-venue-promo flex-col justify-end overflow-hidden rounded-promo p-venue-promo-p focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                  promo.coverImageUrl ? "bg-muted" : "bg-brand",
                )}
              >
                {promo.coverImageUrl ? (
                  <>
                    <RemoteImage
                      src={promo.coverImageUrl}
                      alt=""
                      sizes="(min-width: 1280px) 384px, 50vw"
                    />
                    <span aria-hidden="true" className="absolute inset-0 bg-promo-scrim" />
                  </>
                ) : null}
                {promo.discountPercent !== null && promo.discountPercent > 0 ? (
                  <span className="absolute left-5 top-5 inline-flex items-center rounded-full bg-brand px-3 py-1.5 text-[13px] font-bold leading-[18px] text-ink-on-brand">
                    {t.web.format.discount(promo.discountPercent)}
                  </span>
                ) : null}
                <div className="relative flex flex-col gap-1">
                  <p className="break-words text-[22px] font-bold leading-[30px] tracking-[-0.3px] text-ink-on-brand">
                    {promo.title}
                  </p>
                  {subtitle ? (
                    <p className="truncate text-[14px] leading-5 text-on-brand-subtle" title={subtitle}>
                      {subtitle}
                    </p>
                  ) : null}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * «Контакты» (узел 3264:66, без карты) — вернули 2026-09-09: адрес, телефон,
 * соцсети (Instagram/WhatsApp/сайт). Карту (2026-09-07, `MapPreview`,
 * `GET /restaurants/:id/map`) не рендерим — то решение про статичную картинку
 * без настоящего провайдера карт не отменяли, отменили только полное снятие
 * всего блока. Заголовок — просто «Контакты» (без «и как добраться»,
 * `t.web.venue.contacts.title`). Примитивы те же, что у страницы
 * события/акции (`EventVenueBlocks.tsx`) — `ContactCard`/`ContactLink`/иконки
 * из `VenueContacts.tsx`.
 */
type SocialChannel = { key: keyof NonNullable<Restaurant["social"]>; href: string; label: string };

function socialChannelTitle(channel: SocialChannel): string {
  if (channel.key === "instagram") return instagramHandle(channel.href) ?? channel.label;
  if (channel.key === "website") return websiteHost(channel.href) ?? channel.label;
  return channel.label;
}

function Contacts({ venue }: { venue: Restaurant }) {
  const t = useT();
  // Каналы в порядке макета (узел 3525:14729 «Instagram · WhatsApp»); сайт
  // в макете не нарисован, но в API есть — идёт последним.
  const channels: SocialChannel[] = [];
  for (const key of ["instagram", "whatsapp", "website"] as const) {
    const href = venue.social?.[key];
    if (href) channels.push({ key, href, label: t.web.venue.contacts.channel[key] });
  }
  // Заголовок плашки (узел 3525:14728 «flourdemi.kz») — имя аккаунта
  // Instagram; если первый канал — сайт, его домен; иначе имя канала.
  const primary: SocialChannel | undefined = channels[0];
  const primaryTitle = primary ? socialChannelTitle(primary) : null;
  const phoneNote = venue.phone ? phoneHoursNote(venue.schedule, t) : null;

  // Вызывающий код (`VenueBody`) уже проверил `hasContacts` и не рендерит
  // компонент вовсе, если адреса/телефона/соцсетей нет — пустой секции здесь
  // быть не может, поэтому веток «нечего показать» тут нет (тот же приём,
  // что у `hasContacts` в `EventVenueBlocks.tsx`).
  return (
    <section id={SECTION_ID.contacts} className="flex scroll-mt-6 flex-col gap-5">
      <h2 className="text-h3 tracking-[-0.4px] text-ink">{t.web.venue.contacts.title}</h2>

      {/* Три плашки со значком слева — узел 3264:73. Значок несёт
          `aria-hidden`: смысл уже сказан подписью строки. Карты (`MapPreview`)
          здесь намеренно нет — 2026-09-07, статичная картинка без настоящего
          провайдера. */}
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {venue.address.trim() ? (
          <ContactCard icon={<PinIcon />} title={venue.address} note={venue.addressNote} />
        ) : null}
        {venue.phone ? (
          <ContactCard
            icon={<PhoneIcon />}
            title={venue.phone}
            href={`tel:${venue.phone.replace(/[^\d+]/g, "")}`}
            note={phoneNote ?? t.web.venue.contacts.phone}
          />
        ) : null}
        {primary && primaryTitle ? (
          // Плашка соцсетей (узел 3525:14724): заголовок ведёт на первый
          // канал, подпись перечисляет ВСЕ каналы, и каждый — ссылка.
          <ContactCard
            icon={primary.key === "instagram" ? <InstagramIcon /> : <LinkIcon />}
            title={<ContactLink href={primary.href}>{primaryTitle}</ContactLink>}
            note={channels.map((channel, index) => (
              <Fragment key={channel.key}>
                {index > 0 ? t.web.format.metaSeparator : null}
                <ContactLink href={channel.href}>{channel.label}</ContactLink>
              </Fragment>
            ))}
          />
        ) : null}
      </ul>
    </section>
  );
}

/**
 * «Поделиться» (узел 3261:72). Делает ровно то, что обещает: системное окно
 * там, где оно есть (`navigator.share` — мобильные браузеры и Safari), иначе
 * копирование адреса в буфер с подтверждением. Молчаливой кнопки нет: если
 * не сработало ни то, ни другое, ничего не показываем как «скопировано».
 */
function ShareButton({ name }: { name: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: name, url });
        return;
      } catch {
        // Гость закрыл системное окно — это не ошибка и не повод копировать.
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Буфер недоступен (не-https, запрет политикой). Обещать «скопировано»
      // в этом случае нельзя.
    }
  }

  return (
    <>
      {copied ? (
        <span role="status" className="text-[13px] leading-[18px] text-ink-secondary">
          {t.web.venue.shareCopied}
        </span>
      ) : null}
      <Button size="action" variant="secondary" onClick={() => void share()}>
        <ShareIcon />
        {t.web.venue.share}
      </Button>
    </>
  );
}

/**
 * «Сохранить» (узел 3525:14602). Раньше кнопки здесь не было вовсе: считалось,
 * что избранного у сайта нет. Оно есть — `GET /favorites`, `PUT /favorites/:id`
 * и `DELETE /favorites/:id`, те же ручки, что у приложения.
 *
 * ЧЕТЫРЕ СОСТОЯНИЯ, а не два:
 *   • гость не вошёл — кнопка ведёт на вход, а не притворяется работающей;
 *   • список избранного ещё едет — подпись «Сохранить», а не мигание;
 *   • полёт запроса — кнопка заблокирована, повторное нажатие безвредно
 *     (ручки идемпотентные);
 *   • отказ сервера — состояние откатывается и появляется текст ошибки, а не
 *     ложное «сохранено».
 */
function SaveButton({ id }: { id: string }) {
  const t = useT();
  const { signedIn } = useAuth();
  const favorites = useFavoriteIds();
  const toggle = useToggleFavorite();
  const loginTarget = useLoginHref();
  const saved = favorites.data?.has(id) ?? false;

  if (!signedIn) {
    // Ссылка ПОМНИТ, откуда гость ушёл: без этого он вводит код и попадает на
    // главную, а заведение, ради которого всё затевалось, остаётся позади.
    return (
      <Button size="action" variant="secondary" asLink href={loginTarget}>
        <HeartIcon filled={false} size={24} />
        {t.web.venue.save}
      </Button>
    );
  }

  return (
    <>
      {toggle.isError ? (
        <span role="alert" className="text-[13px] leading-[18px] text-danger">
          {t.web.venue.saveFailed}
        </span>
      ) : null}
      <Button
        size="action"
        variant="secondary"
        aria-pressed={saved}
        loading={toggle.isPending}
        onClick={() => toggle.mutate({ id, next: !saved })}
      >
        <HeartIcon filled={saved} size={24} />
        {saved ? t.web.venue.saved : t.web.venue.save}
      </Button>
    </>
  );
}

/** Значок сетки на кнопке «Все фото» (узел 3367:11311) — четыре квадрата. */
function GridIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 15V4m0 0L8.5 7.5M12 4l3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" strokeLinecap="round" />
    </svg>
  );
}

