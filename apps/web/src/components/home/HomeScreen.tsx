"use client";

import Image from "next/image";
import Link from "next/link";
import { webAppSection } from "@bookeat/design-tokens";

import { Section, SectionHeader } from "@web/components/home/SectionHeader";
import {
  EVENTS_PATH,
  EVENT_CARD_IMAGE,
  EventCard,
  GUIDE_CARD_IMAGE,
  GUIDE_PATH,
  GuideCard,
  PROMO_CARD_FRAME,
  PromoCard,
  SHOW_EVENTS_LINK,
  SHOW_SECTION_LINKS,
  guideCollectionHref,
} from "@web/components/home/Cards";
import { CuisineRow, CuisineRowSkeleton } from "@web/components/home/CuisineRow";
import { SearchPanel } from "@web/components/home/SearchPanel";
import { Container } from "@web/components/layout/Container";
import { SiteChrome } from "@web/components/layout/SiteChrome";
import { AsyncBlock, Skeleton, StateMessage } from "@web/components/state/AsyncBlock";
import { VenueCard } from "@web/components/ui/VenueCard";
import { Button } from "@web/components/ui/Button";
import { assetUrl } from "@web/lib/asset";
import { useCity } from "@web/lib/city";
import { cx } from "@web/lib/cx";
import { EMPTY_CATALOG_STATE, buildSearchQuery } from "@web/lib/catalog-params";
import { useFavoriteControl } from "@web/lib/favorites";
import { venueMeta } from "@web/lib/format";
import { useT } from "@web/lib/locale";
import {
  useAmenities,
  useCatalog,
  useCuisines,
  useEvents,
  useGuideCollections,
  usePicks,
  usePromotions,
} from "@web/lib/queries";

/**
 * Главная — Figma QovvuAoI9YxsLMwWkfgKN8, кадр «WEB / 01 · Главная + каталог».
 * Секции «Выбрали для вас» и «Все заведения в Алматы» сверены с узлами
 * 3525:14214 и 3525:14246.
 *
 * Порядок секций и их отступы — из макета. Каждая секция ходит за своими
 * данными отдельным запросом и падает отдельно: сломавшаяся афиша не должна
 * уносить с собой каталог. Поэтому «загрузка/ошибка/пусто» живут внутри
 * секции, а не одним состоянием на всю страницу.
 *
 * Чего в макете есть, а здесь нет и почему:
 *   • быстрые фильтры героя («Сегодня вечером», «Романтический ужин») —
 *     таких значений API не знает; в этой роли стоят настоящие удобства из
 *     `GET /venue-features`, которые реально сужают выдачу;
 *   • слоты свободного времени на карточках — это запрос доступности на
 *     КАЖДУЮ карточку; на плохой связи это двадцать запросов ради подсказки,
 *     поэтому свободное время показывает только страница заведения.
 */
export function HomeScreen() {
  const t = useT();
  const { city, isError: cityFailed } = useCity();

  const cuisines = useCuisines();
  const picks = usePicks(city);
  const promos = usePromotions(city);
  const events = useEvents(city);
  const guide = useGuideCollections();
  const catalog = useCatalog(buildSearchQuery(EMPTY_CATALOG_STATE, city));
  // Одна подписка на избранное на всю страницу: карточек здесь дюжина.
  const favoriteProps = useFavoriteControl();

  return (
    <SiteChrome active="home">
      <Hero />

      {cityFailed ? (
        <Container className="py-10">
          <StateMessage
            title={t.web.states.errorTitle}
            text={t.web.states.errorText}
            tone="danger"
          />
        </Container>
      ) : null}

      <Section>
        <Container className="flex flex-col gap-6">
          <SectionHeader title={t.web.home.cuisines.title} />
          <AsyncBlock
            query={cuisines}
            emptyText={t.web.home.cuisines.empty}
            skeleton={<CuisineRowSkeleton />}
          >
            {(items) => <CuisineRow items={items} />}
          </AsyncBlock>
        </Container>
      </Section>

      <Section>
        <Container className="flex flex-col gap-7">
          <SectionHeader
            title={t.web.home.picks.title}
            subtitle={t.web.home.picks.subtitle}
            linkHref="/venues"
            linkLabel={t.web.home.picks.all}
          />
          <AsyncBlock
            query={picks}
            emptyText={t.web.home.picks.empty}
            skeleton={<VenueGridSkeleton />}
          >
            {(items) => (
              // `h-full` на ячейке — половина решения: сама ячейка сетки и так
              // растянута, но карточка внутри неё блочная и до низа не доходит.
              // Вторая половина — `h-full` внутри самой карточки.
              <ul className="grid grid-cols-1 gap-gutter md:grid-cols-2 xl:grid-cols-4">
                {items.map((venue) => (
                  <li key={venue.id} className="h-full">
                    <VenueCard
                      name={venue.name}
                      meta={venueMeta(venue, t)}
                      imageUrl={venue.coverPhoto?.uri}
                      href={`/venues/${venue.id}`}
                      tag={venue.acceptsOnlineBookings ? t.web.catalog.card.bookable : undefined}
                      {...favoriteProps(venue.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </AsyncBlock>
        </Container>
      </Section>

      <Section>
        <Container className="flex flex-col gap-7">
          <SectionHeader
            title={t.web.home.promos.title}
            subtitle={t.web.home.promos.subtitle}
          />
          <AsyncBlock
            query={promos}
            emptyText={t.web.home.promos.empty}
            skeleton={
              <div className="grid grid-cols-1 gap-gutter md:grid-cols-3">
                {PLACEHOLDERS.slice(0, 3).map((key) => (
                  <Skeleton key={key} className={cx(PROMO_CARD_FRAME, "rounded-card")} />
                ))}
              </div>
            }
          >
            {(items) => (
              <ul className="grid grid-cols-1 gap-gutter md:grid-cols-3">
                {items.slice(0, 3).map((promo) => (
                  <li key={promo.id}>
                    <PromoCard promo={promo} />
                  </li>
                ))}
              </ul>
            )}
          </AsyncBlock>
        </Container>
      </Section>

      <Section>
        <Container className="flex flex-col gap-7">
          {/* Ссылки «Смотреть все» в шапке этой секции в макете НЕТ (узел
              3255:27): там подпись со счётчиком, а переход вниз — кнопкой во
              всю ширину. */}
          <SectionHeader
            title={t.web.home.catalog.title}
            subtitle={catalog.data ? t.web.home.catalog.subtitle(catalog.data.total) : undefined}
          />
          <AsyncBlock
            query={catalog}
            emptyText={t.web.home.catalog.empty}
            isEmpty={(result) => result.items.length === 0}
            skeleton={<VenueGridSkeleton />}
          >
            {(result) => (
              // Просвет «сетка → кнопка» 28, как между блоками секции в макете
              // (узел 3525:14246), а не 24 гаттера сетки.
              <div className="flex flex-col gap-7">
                <ul className="grid grid-cols-1 gap-gutter md:grid-cols-2 xl:grid-cols-4">
                  {result.items.slice(0, HOME_CATALOG_LIMIT).map((venue) => (
                    <li key={venue.id} className="h-full">
                      <VenueCard
                        name={venue.name}
                        meta={venueMeta(venue, t)}
                        imageUrl={venue.coverPhoto?.uri}
                        href={`/venues/${venue.id}`}
                        tag={venue.acceptsOnlineBookings ? t.web.catalog.card.bookable : undefined}
                        {...favoriteProps(venue.id)}
                      />
                    </li>
                  ))}
                </ul>
                {/* Кнопка «Показать ещё N заведений» — узел 3255:219: белая,
                    во всю ширину, 54 высотой. Число НАСТОЯЩЕЕ: сколько
                    заведений выдача вернула сверх показанных. Показали всё —
                    кнопки нет, потому что жать в ней не на что. */}
                {result.total > HOME_CATALOG_LIMIT ? (
                  <Button
                    size="l"
                    variant="secondary"
                    block
                    asLink
                    href="/venues"
                    className="rounded-2xl border-transparent shadow-control"
                  >
                    {t.web.home.catalog.more(result.total - HOME_CATALOG_LIMIT)}
                  </Button>
                ) : null}
              </div>
            )}
          </AsyncBlock>
        </Container>
      </Section>

      <Section tone="subtle">
        <Container className="flex flex-col gap-7">
          <SectionHeader
            title={t.web.home.events.title}
            subtitle={t.web.home.events.subtitle}
            linkHref={SHOW_EVENTS_LINK ? EVENTS_PATH : undefined}
            linkLabel={t.web.home.events.all}
          />
          <AsyncBlock
            query={events}
            emptyText={t.web.home.events.empty}
            skeleton={
              <div className="grid grid-cols-1 gap-gutter md:grid-cols-3">
                {PLACEHOLDERS.slice(0, 3).map((key) => (
                  <CardSkeleton key={key} image={EVENT_CARD_IMAGE} body="h-event-body" />
                ))}
              </div>
            }
          >
            {(items) => (
              <ul className="grid grid-cols-1 gap-gutter md:grid-cols-3">
                {items.map((event) => (
                  <li key={event.id}>
                    <EventCard event={event} />
                  </li>
                ))}
              </ul>
            )}
          </AsyncBlock>
        </Container>
      </Section>

      <Section>
        <Container className="flex flex-col gap-7">
          <SectionHeader
            title={t.web.home.guide.title}
            subtitle={t.web.home.guide.subtitle}
            linkHref={SHOW_SECTION_LINKS ? GUIDE_PATH : undefined}
            linkLabel={t.web.home.guide.all}
          />
          <AsyncBlock
            query={guide}
            emptyText={t.web.home.guide.empty}
            skeleton={
              <div className="grid grid-cols-1 gap-gutter md:grid-cols-2">
                {PLACEHOLDERS.slice(0, 2).map((key) => (
                  <CardSkeleton key={key} image={GUIDE_CARD_IMAGE} body="h-guide-body" />
                ))}
              </div>
            }
          >
            {(items) => (
              <ul className="grid grid-cols-1 gap-gutter md:grid-cols-2">
                {items.slice(0, 2).map((collection) => (
                  <li key={collection.slug}>
                    <GuideCard
                      collection={collection}
                      href={SHOW_SECTION_LINKS ? guideCollectionHref(collection.slug) : undefined}
                    />
                  </li>
                ))}
              </ul>
            )}
          </AsyncBlock>
        </Container>
      </Section>

      <AppSection />
    </SiteChrome>
  );
}

/**
 * Сколько заведений показывает главная в блоке «Все заведения». Из макета:
 * подпись кнопки «Показать ещё 120 заведений» при «128 мест» в шапке секции
 * (узлы 3255:30 и 3255:220) — то есть на главной их восемь, две строки по
 * четыре.
 */
const HOME_CATALOG_LIMIT = 8;

/** Ключи для скелетов: индекс массива в `key` линтер справедливо не любит. */
const PLACEHOLDERS = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];

/**
 * Скелет карточки события и подборки: обложка + тело, собранные из ТЕХ ЖЕ
 * классов, что и настоящая карточка (`Cards.tsx`). Ниже `lg` обложка
 * держит мобильную пропорцию, и высота карточки зависит от ширины колонки —
 * одним числом её не описать, а скелет другой высоты заставил бы страницу
 * прыгать при появлении данных.
 */
function CardSkeleton({ image, body }: { image: string; body: string }) {
  return (
    <div aria-hidden="true" className="flex flex-col overflow-hidden rounded-card">
      <Skeleton className={cx("rounded-none", image)} />
      <Skeleton className={cx("rounded-none", body)} />
    </div>
  );
}

function VenueGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-gutter md:grid-cols-2 xl:grid-cols-4">
      {PLACEHOLDERS.slice(0, 4).map((key) => (
        <Skeleton key={key} className="h-[318px] rounded-card" />
      ))}
    </div>
  );
}

/**
 * Герой — Figma 3253:30.
 *
 * Подложка это ФОТОГРАФИЯ (`scaleMode: FILL`) плюс вертикальный градиент
 * затемнения тремя стопами (`webHero.scrim`). Раньше здесь стояла фирменная
 * заливка, потому что файла снимка не было; теперь он экспортирован из
 * макета в `public/brand/hero.webp` (1440 px, webp, 107 КБ).
 *
 * `priority` у картинки не украшение: это самое крупное изображение первого
 * экрана, то есть LCP страницы. `alt=""` — снимок декоративный, содержания в
 * нём нет, и озвучивать его скринридеру нечем.
 */
function Hero() {
  const t = useT();

  return (
    <section className="relative w-full overflow-hidden bg-inverse">
      <Image
        src={assetUrl("/brand/hero.webp")}
        alt=""
        fill
        sizes="100vw"
        priority
        // Наш загрузчик отдаёт адрес как есть — см. lib/image-loader.ts.
        unoptimized
        className="object-cover"
      />
      <div aria-hidden="true" className="absolute inset-0 bg-hero-scrim" />
      <Container className="relative flex flex-col gap-hero-gap py-hero-y">
        <div className="flex max-w-[640px] flex-col gap-3">
          {/* 48/52 из макета — только с `lg`; ниже кегль мобильной шапки
              главной (`webHero.mobileTitleFontSize`, docs/responsive.md § 5,
              дыра № 4): три строки по 48 съедали весь первый экран. */}
          <h1 className="text-hero-title-mobile text-ink-on-inverse lg:text-hero-title">
            {t.web.home.hero.title}
          </h1>
          <p className="text-[18px] leading-7 text-ink-on-inverse">{t.web.home.hero.subtitle}</p>
        </div>
        <SearchPanel state={EMPTY_CATALOG_STATE} />
        <QuickFilters />
      </Container>
    </section>
  );
}

/**
 * Быстрые фильтры под панелью поиска. В макете это придуманные ярлыки
 * («Романтический ужин», «24/7»), которых в данных нет вовсе. Вместо них —
 * справочник удобств: те же по виду чипы, но каждый действительно сужает
 * выдачу параметром `?features=`.
 *
 * Вид чипа взят из макета (узел 3253:55): заливка белым 14% и обводка белым
 * 30%, а не прозрачный фон со сплошной белой рамкой — на светлой части
 * фотографии такой чип пропадал бы.
 */
function QuickFilters() {
  const t = useT();
  const query = useAmenities();
  const amenities = (query.data ?? []).slice(0, 6);

  if (amenities.length === 0) return null;

  return (
    <ul aria-label={t.web.home.hero.quickFilters} className="flex flex-wrap gap-quick-gap">
      {amenities.map((amenity) => (
        <li key={amenity.id}>
          <Link
            href={`/venues?features=${encodeURIComponent(amenity.id)}`}
            className="inline-flex h-chip items-center rounded-full border border-on-photo-chip-border bg-on-photo-chip px-chip-x text-[14px] font-medium leading-5 text-ink-on-inverse backdrop-blur-sm hover:bg-on-inverse-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {amenity.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Секция «Приложение» перед подвалом — Figma 3256:62.
 *
 * Из макета: вертикальный градиент #B23036 → #631F21, паддинг 72/120,
 * заголовок 38/46 с трекингом −0.6, текст 17/26 белым 85%, кнопки магазинов
 * 46 высотой с радиусом 12 и белой рамкой, снимок телефона справа, который
 * ВЫСТУПАЕТ за секцию сверху и снизу и ею обрезается.
 *
 * ССЫЛКИ. iOS-приложение опубликовано — адрес проверен 31.08.2026 запросом к
 * `itunes.apple.com/lookup?bundleId=com.bookeat.app` и лежит здесь значением
 * по умолчанию (это публичный адрес витрины, не секрет). Android В МАГАЗИНЕ
 * НЕТ: `play.google.com/store/apps/details?id=com.bookeatteam.bookeatapp`
 * отвечает 404, поэтому кнопки Google Play нет вовсе — придуманный адрес
 * отправил бы гостя в никуда. Появится приложение — достаточно задать
 * `NEXT_PUBLIC_GOOGLE_PLAY_URL` при сборке, разметка уже готова.
 */
/**
 * Адреса витрин магазинов. Оба ПРОВЕРЕНЫ живым запросом 01.09.2026 и оба —
 * публичные ссылки, а не секреты, поэтому лежат значениями по умолчанию:
 * переменная окружения, забытая при сборке, не должна стирать кнопку.
 *
 *   • iOS  — `itunes.apple.com/lookup?bundleId=com.bookeat.app` (31.08.2026);
 *   • Android — `play.google.com/store/apps/details?id=kz.bookeat.app`
 *     отвечает 200, страница принадлежит BookEat Technologies. Прежняя запись
 *     «в Google Play приложения нет» опиралась на `com.bookeatteam.bookeatapp`
 *     и `com.bookeat.app` — оба и правда 404, но опубликовано приложение под
 *     ТРЕТЬИМ именем пакета, и оно же стоит в `apps/mobile/app.config.js`.
 */
const APP_STORE_URL_DEFAULT = "https://apps.apple.com/app/id6757542577";
const GOOGLE_PLAY_URL_DEFAULT = "https://play.google.com/store/apps/details?id=kz.bookeat.app";

function AppSection() {
  const t = useT();
  const appStore = process.env.NEXT_PUBLIC_APP_STORE_URL || APP_STORE_URL_DEFAULT;
  const googlePlay = process.env.NEXT_PUBLIC_GOOGLE_PLAY_URL || GOOGLE_PLAY_URL_DEFAULT;

  return (
    <section className="relative w-full overflow-hidden bg-app-section">
      <Container className="relative flex flex-col gap-6 py-app-y">
        <div className="flex max-w-[720px] flex-col gap-2">
          {/* 38/46 из макета — только с `lg` (дыра № 5); ниже — тот же
              мобильный кегль, что у героя. */}
          <h2 className="text-app-title-mobile tracking-[-0.6px] text-ink-on-inverse lg:text-app-title">
            {t.web.home.app.title}
          </h2>
          <p className="text-[17px] leading-[26px] text-on-brand-muted">{t.web.home.app.text}</p>
        </div>
        {/* В макете (узел 3256:66) кнопок ДВЕ, и это была отдельная претензия
            владельца 01.09.2026: Google Play не рисовался, потому что адрес
            искали по неверному имени пакета. */}
        <ul className="flex flex-wrap gap-store-gap">
          <li>
            <StoreLink
              href={appStore}
              label={t.web.home.app.appStore}
              badge="/brand/app-store.svg"
              width={webAppSection.storeButton.appStoreWidth}
            />
          </li>
          <li>
            <StoreLink
              href={googlePlay}
              label={t.web.home.app.googlePlay}
              badge="/brand/google-play.svg"
              width={webAppSection.storeButton.googlePlayWidth}
            />
          </li>
        </ul>
      </Container>
      {/* Снимок телефона. `aria-hidden` и пустой alt: это иллюстрация, весь
          смысл секции уже сказан текстом. На экранах уже 1024 он прячется —
          иначе он налезает на заголовок. */}
      <Image
        src={assetUrl("/brand/app-phone.webp")}
        alt=""
        aria-hidden="true"
        width={568}
        height={835}
        unoptimized
        loading="lazy"
        // Положение из макета: левый край снимка на 821 при ширине кадра 1440,
        // то есть на 101 правее центра. Через `calc(50% + 101px)`, а не
        // абсолютным `left`, — иначе на экране шире 1440 телефон уезжал бы от
        // центрального контейнера влево.
        //
        // `object-contain`, а НЕ `object-cover`: прямоугольник 568×835 в макете
        // вписывает снимок целиком (`scaleMode: FIT`), а не обрезает его.
        // Проверено по отрисовке кадра — тёмная рамка телефона начинается на
        // x≈990; `cover` дал бы 960, то есть аппарат заметно крупнее макета.
        className="pointer-events-none absolute -top-[199px] left-[calc(50%+101px)] hidden h-[835px] w-[568px] max-w-none select-none object-contain lg:block"
      />
    </section>
  );
}

/**
 * Кнопка магазина — узлы 3280:4095 (App Store, 161×46) и 3280:4251
 * (Google Play, 158×46).
 *
 * Это цельная картинка ИЗ МАКЕТА вместе с рамкой, а не наша кнопка с
 * перерисованным значком. Причина не в лени: у Apple и Google есть правила
 * оформления своих бейджей, а прежний вариант (своя рамка + своя двухстрочная
 * подпись + значок, нарисованный здесь по памяти) этим правилам не отвечал ни
 * пропорциями, ни начертанием.
 *
 * Кнопки в самом низу страницы, поэтому файлы, а не встроенный SVG: два
 * запроса на 24 КБ по `loading="lazy"` дешевле, чем те же 24 КБ в куске,
 * который блокирует первую отрисовку.
 *
 * `alt=""` и `aria-label` на ссылке: подпись на картинке уже есть, и озвучить
 * её дважды — значит заставить скринридер прочитать «Скачать в App Store
 * Скачать в App Store».
 */
function StoreLink({
  href,
  label,
  badge,
  width,
}: {
  href: string;
  label: string;
  badge: string;
  width: number;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className="inline-flex rounded-store focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <Image
        src={assetUrl(badge)}
        alt=""
        width={width}
        height={webAppSection.storeButton.height}
        unoptimized
        loading="lazy"
        className="h-store w-auto"
      />
    </a>
  );
}
