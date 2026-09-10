"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import type { MenuDish, MenuSection, PreorderLineInput, Restaurant } from "@bookeat/api/client";
import { RepositoryError } from "@bookeat/api/client";

import { Container } from "@web/components/layout/Container";
import { SiteChrome } from "@web/components/layout/SiteChrome";
import { AsyncBlock, Skeleton, StateMessage } from "@web/components/state/AsyncBlock";
import { BookingCard } from "@web/components/venue/BookingCard";
import { BottomBar } from "@web/components/ui/BottomBar";
import { Button } from "@web/components/ui/Button";
import { Chip } from "@web/components/ui/Chip";
import { DishStepper } from "@web/components/venue/DishStepper";
import { Modal } from "@web/components/ui/Modal";
import { RemoteImage } from "@web/components/ui/RemoteImage";
import { isNotFound } from "@web/lib/not-found";
import { useAuth } from "@web/lib/auth";
import {
  BOOKING_PARAM,
  bookingHref,
  bookingResultPath,
  menuBookingHref,
  readBookingIntent,
  readMenuBookingId,
  type BookingIntent,
} from "@web/lib/booking-link";
import { cx } from "@web/lib/cx";
import { formatMoneyMinor } from "@web/lib/format";
import { filterMenuSections } from "@web/lib/menu-search";
import { useMenuSections, useVenue } from "@web/lib/queries";
import { useT } from "@web/lib/locale";
import { useBookingPreorderCart } from "@web/lib/use-booking-preorder-cart";
import { usePreorderDraft } from "@web/lib/use-preorder-draft";
import { loginHref } from "@web/lib/return-to";

/**
 * Отдельная страница «Меню {заведение}» — Figma qmMsg4jO1ggmyEHNIAD2ll, узел
 * 5115:7448. Раньше меню заведения было видно ТОЛЬКО как «Популярное в меню»
 * на самой странице заведения (максимум шесть карточек, `VenueScreen.tsx` →
 * `MenuSection`) — у заведения с полным меню в полсотни блюд остальное было
 * недостижимо ровно так же, как в приложении до `restaurant/[id]/menu.tsx`
 * (см. комментарий в том файле).
 *
 * Данные — `GET /restaurants/:id/menu`, тот же `MenuSection[]`, что и в
 * приложении (`useMenuSections`, `packages/api`); поиск и разбор по категориям
 * — ЛОКАЛЬНЫЕ (меню целиком уже в руках), тем же правилом, что мобильный
 * `apps/mobile/src/lib/menu-search.ts`.
 *
 * СТЕППЕР ПРЕДЗАКАЗА (ТЗ `web-preorder-menu-20260908`, задачи A-WEB-1..3):
 * узел 5115:7448 степпера «+» на карточке НЕ рисует — проверено рендером
 * (`/v1/images`, 429 на `/v1/files/:key/nodes`), и это осознанное решение
 * владельца от 2026-09-08 «ставим тот же `DishStepper`, что и в „Популярное в
 * меню“, дизайнер обновит кадр постфактум», а не пропуск. Карточка блюда
 * (`DishCard`) получает `DishStepper` по тому же правилу, что и на странице
 * заведения: `acceptsOnlineBookings && isAvailable && priceMinor !== null`.
 * Правая колонка выше `BookingCard` получает карточку «Предзаказ»
 * (`MenuPreorderCard`) при непустом черновике, ниже `lg` — `BottomBar` с
 * одной кнопкой («Забронировать» / «К бронированию · Итого ≈ N ₸»). Черновик
 * — тот же `usePreorderDraft(venue.id)`, что на странице заведения и брони,
 * ОДИН вызов хука на страницу (см. комментарий в `MenuPageBody`).
 *
 * ЧЕГО В МАКЕТЕ ЕСТЬ, А ЗДЕСЬ НЕТ, И ПОЧЕМУ:
 *   • города в хлебных крошках («… / Алматы / …») — хлебные крошки здесь ЗЕРКАЛЯТ
 *     `VenueScreen.tsx` ровно затем, чтобы у сайта не было двух разных
 *     раскладок крошек одновременно. `Restaurant.city` У ЗАВЕДЕНИЯ УЖЕ ЕСТЬ
 *     (`packages/api/src/types.ts`) — старый комментарий у `VenueScreen.tsx`
 *     про «города в модели нет» устарел. Команда уже занимается разбором
 *     крошек под макет (заметка `bookeat-web.md` от 2026-09-07, «venue
 *     breadcrumb figma fix») — эта страница намеренно НЕ трогает крошки
 *     первой, чтобы не разъехаться с той правкой.
 *
 * Точные пиксельные числа узла 5115:7448 (радиусы, паддинги) НЕ сверены через
 * Figma REST — `/v1/files`, `/v1/images` и MCP по этому файлу 2026-09-07
 * отвечали 429 весь заход (см. `bookeat-mobile-figma-access.md`). Карточка
 * блюда и сетка переиспользуют уже сверенные токены `webVenuePage.dishCard` —
 * тот же узор, что у «Популярное в меню» на странице заведения, а не числа на
 * глаз по PNG-скриншоту.
 *
 * РЕЖИМ ПРАВКИ ПРЕДЗАКАЗА (`?booking=<id>`, ТЗ `web-preorder-menu-20260908`,
 * C-WEB-1): та же страница, не отдельная. `?booking` приоритетнее
 * `?date/guests/slot` (раздел 5 ТЗ) — при его наличии карточка справа читает
 * `GET /bookings/:id/preorder` (`useBookingPreorderCart`) вместо черновика
 * заведения, «Забронировать» уступает место «Сохранить заказ», а гость без
 * входа или не владелец брони видит экран-заглушку по образцу
 * `BookingResultScreen.tsx`, а не сетку блюд.
 */
export function VenueMenuScreen({ id }: { id: string }) {
  const t = useT();
  const venueQuery = useVenue(id);
  /**
   * Выбор со страницы брони (`?date&guests&slot`) едет сюда в адресе — та же
   * схема, что у `BookingScreen.tsx` (`lib/booking-link.ts`). `hasIntent`
   * различает «гость пришёл со страницы брони» (A8: кнопка «Вернуться к
   * бронированию» есть) от «зашёл в меню напрямую» (кнопки нет, интент —
   * умолчания). Страница — за границей `Suspense` в `app/venues/[id]/menu/
   * page.tsx`, как у `/venues/[id]/book`: без неё сборка валится.
   */
  const searchParams = useSearchParams();
  const intent = useMemo(() => readBookingIntent(searchParams), [searchParams]);
  const hasIntent = useMemo(
    () =>
      searchParams.has(BOOKING_PARAM.date) ||
      searchParams.has(BOOKING_PARAM.guests) ||
      searchParams.has(BOOKING_PARAM.slot),
    [searchParams],
  );
  const bookingId = useMemo(() => readMenuBookingId(searchParams), [searchParams]);

  return (
    <SiteChrome active="venues">
      <Container className="pb-bottom-bar-clearance pt-6 lg:pb-20">
        <nav
          aria-label={t.web.venue.breadcrumbLabel}
          className="text-[13px] leading-[18px] text-ink-tertiary"
        >
          <Link
            href="/"
            className="hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {t.web.venue.breadcrumbHome}
          </Link>
          <span aria-hidden="true"> / </span>
          <Link
            href="/venues"
            className="hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {t.web.venue.breadcrumbVenues}
          </Link>
          {venueQuery.data ? (
            <>
              <span aria-hidden="true"> / </span>
              <Link
                href={`/venues/${id}`}
                className="hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                {venueQuery.data.name}
              </Link>
              <span aria-hidden="true"> / </span>
              <span className="text-ink-secondary">{t.web.venue.menuPage.breadcrumb}</span>
            </>
          ) : null}
        </nav>

        <div className="pt-4">
          {bookingId ? (
            <BookingModeGate venueId={id} bookingId={bookingId} venueQuery={venueQuery} />
          ) : isNotFound(venueQuery.error) ? (
            <StateMessage title={t.web.venue.notFound.title} text={t.web.venue.notFound.text}>
              <Link
                href="/venues"
                className="text-[16px] font-semibold leading-6 text-brand-text underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                {t.web.venue.notFound.back}
              </Link>
            </StateMessage>
          ) : (
            <AsyncBlock query={venueQuery} emptyText={t.web.venue.notFound.text} isEmpty={() => false} skeleton={<VenueMenuSkeleton />}>
              {(venue) => <MenuPageBody venue={venue} intent={intent} hasIntent={hasIntent} />}
            </AsyncBlock>
          )}
        </div>
      </Container>
    </SiteChrome>
  );
}

/** Скелет ровно страницы целиком (шапка + меню) — так грузится обычный
 * `venueQuery` до появления заведения. */
function VenueMenuSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <Skeleton className="h-12 w-1/3" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

/** Скелет сетки блюд — поиск/шапка уже есть (заведение загружено), едет
 * только `GET /restaurants/:id/menu`. Общий для обычного режима и режима
 * `?booking=` (`MenuPageBody`/`BookingModeMenuBody`). */
function MenuGridSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-9 w-2/3" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-venue-dish-image w-full" />
        ))}
      </div>
    </div>
  );
}

/**
 * Общая фигура степпера на карточке блюда — то, что реально нужно `DishCard`/
 * `MenuBrowser` от корзины, независимо от того, живёт ли она в
 * `sessionStorage` (`usePreorderDraft`, обычный режим) или в памяти страницы
 * (`useBookingPreorderCart`, режим `?booking=`, C3). Оба хука структурно
 * satisfy этот интерфейс без адаптера — сужаем тип на границе, а не копируем
 * `MenuBrowser`/`DishCard` под каждый режим.
 */
interface PreorderCartControls {
  quantityOf(menuItemId: string): number;
  maxQty: number;
  add(dish: { menuItemId: string; name: string; priceMinor: number }): void;
  increment(menuItemId: string): void;
  decrement(menuItemId: string): void;
}

/** C6: `RepositoryError.code` → причина отказа `PUT` для словаря
 * `web.venue.menuPage.bookingCart.error`. Тот же принцип, что
 * `preorderFailureReason` в `queries.ts` — ветвление ТОЛЬКО по коду. */
type BookingSaveErrorReason =
  | "locked"
  | "paymentInFlight"
  | "bookingClosed"
  | "belowMinimum"
  | "itemUnavailable"
  | "other";

function saveErrorReason(error: unknown): BookingSaveErrorReason {
  if (error instanceof RepositoryError) {
    switch (error.code) {
      case "preorder_locked":
        return "locked";
      case "preorder_payment_in_flight":
        return "paymentInFlight";
      case "preorder_booking_closed":
        return "bookingClosed";
      case "preorder_below_minimum":
        return "belowMinimum";
      case "preorder_item_unavailable":
        return "itemUnavailable";
      default:
        return "other";
    }
  }
  return "other";
}

/**
 * Ворота режима `?booking=<id>` (C-WEB-1, C4): гость без входа или не
 * владелец брони видит экран-заглушку по образцу `BookingResultScreen.tsx`
 * ВМЕСТО сетки блюд — редактировать чужой или неизвестной брони предзаказ
 * незачем показывать даже как читаемое меню в этом режиме.
 */
function BookingModeGate({
  venueId,
  bookingId,
  venueQuery,
}: {
  venueId: string;
  bookingId: string;
  venueQuery: ReturnType<typeof useVenue>;
}) {
  const t = useT();
  const { signedIn, isLoading: authLoading } = useAuth();
  const cart = useBookingPreorderCart(bookingId);

  if (!signedIn && !authLoading) {
    return (
      <StateMessage title={t.web.bookingResult.signInTitle} text={t.web.bookingResult.signInText}>
        <Button size="m" asLink href={loginHref(menuBookingHref(venueId, bookingId))}>
          {t.web.bookingResult.signInAction}
        </Button>
      </StateMessage>
    );
  }

  if (isNotFound(cart.query.error)) {
    return <StateMessage title={t.web.bookingResult.notFoundTitle} text={t.web.bookingResult.notFoundText} />;
  }

  if (isNotFound(venueQuery.error)) {
    return (
      <StateMessage title={t.web.venue.notFound.title} text={t.web.venue.notFound.text}>
        <Link
          href="/venues"
          className="text-[16px] font-semibold leading-6 text-brand-text underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {t.web.venue.notFound.back}
        </Link>
      </StateMessage>
    );
  }

  return (
    <AsyncBlock query={venueQuery} emptyText={t.web.venue.notFound.text} isEmpty={() => false} skeleton={<VenueMenuSkeleton />}>
      {(venue) => (
        <AsyncBlock query={cart.query} emptyText="" isEmpty={() => false} skeleton={<VenueMenuSkeleton />}>
          {() => <BookingModeMenuBody venue={venue} bookingId={bookingId} cart={cart} />}
        </AsyncBlock>
      )}
    </AsyncBlock>
  );
}

/**
 * Тело страницы в режиме `?booking=` (C3-C7). Отдельно от `MenuPageBody`:
 * интент бронирования здесь не читается вовсе (режим `booking` его
 * игнорирует, раздел 5 ТЗ), справа не карточка слотов `BookingCard` — правка
 * УЖЕ существующей брони, а не создание новой, а низ и правая колонка ведут
 * одно и то же действие («Сохранить заказ»), поэтому состояние сохранения и
 * модалка подтверждения снятия живут ЗДЕСЬ, на уровень выше обеих — иначе
 * полоса ниже `lg` (карточка справа там не смонтирована, `hidden lg:block`)
 * не имела бы доступа к тому же запросу и к той же модалке.
 */
function BookingModeMenuBody({
  venue,
  bookingId,
  cart,
}: {
  venue: Restaurant;
  bookingId: string;
  cart: ReturnType<typeof useBookingPreorderCart>;
}) {
  const t = useT();
  const router = useRouter();
  const menuQuery = useMenuSections(venue.id);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const handleSave = useCallback(
    (items: PreorderLineInput[]) => {
      cart.save.mutate(items, {
        onSuccess: () => {
          setConfirmingClear(false);
          router.push(bookingResultPath(bookingId));
        },
      });
    },
    [cart.save, router, bookingId],
  );

  /** C3: «Очистить» + «Сохранить» с пустой корзиной — снятие предзаказа
   * (`PUT {items:[]}`), решение продукта, поэтому СНАЧАЛА подтверждение, а
   * не тихая отправка. Непустая корзина сохраняется сразу — это и есть
   * обычный путь. */
  const handleSaveClick = useCallback(() => {
    if (cart.save.isPending) return;
    const items = cart.saveInput();
    if (items.length === 0) {
      setConfirmingClear(true);
      return;
    }
    handleSave(items);
  }, [cart, handleSave]);

  const errorReason = saveErrorReason(cart.save.error);

  return (
    <>
      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <h1 className="text-h1 tracking-[-0.8px] text-ink">{t.web.venue.menuPage.title(venue.name)}</h1>

          <AsyncBlock
            query={menuQuery}
            emptyText={t.web.venue.menu.empty}
            isEmpty={(sections) => sections.length === 0}
            skeleton={<MenuGridSkeleton />}
          >
            {(sections) => <MenuBrowser sections={sections} venue={venue} preorder={cart} />}
          </AsyncBlock>
        </div>

        <aside className="hidden lg:block lg:w-venue-aside lg:shrink-0">
          <div className="flex flex-col gap-4 lg:sticky lg:top-6">
            <BookingPreorderCard cart={cart} sections={menuQuery.data} onSaveClick={handleSaveClick} />
          </div>
        </aside>
      </div>

      {/* C6: ВНЕ карточки справа — та ниже `lg` не смонтирована
          (`hidden lg:block`), а `BottomBar` ниже `lg` несёт только кнопку
          (C7), не текст. Отказ обязан быть виден на любой ширине, поэтому
          строка отказа стоит здесь, в обычном потоке (не под `BottomBar`,
          которая `fixed`). */}
      {cart.save.isError ? (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-danger-text bg-danger px-4 py-3">
          <p className="text-bodyS text-danger-text">{t.web.venue.menuPage.bookingCart.error[errorReason]}</p>
          {errorReason === "bookingClosed" ? (
            <Button size="m" variant="outline" block asLink href={bookingResultPath(bookingId)}>
              {t.web.venue.menuPage.bookingCart.backToTicket}
            </Button>
          ) : null}
        </div>
      ) : null}

      <BookingModeBottomBar totalMinor={cart.totalMinor} saving={cart.save.isPending} onSaveClick={handleSaveClick} />

      {confirmingClear ? (
        <RemovePreorderDialog
          saving={cart.save.isPending}
          isError={cart.save.isError}
          errorText={t.web.venue.menuPage.bookingCart.error[errorReason]}
          onConfirm={() => handleSave([])}
          onClose={() => setConfirmingClear(false)}
        />
      ) : null}
    </>
  );
}

const BOOKING_CART_TITLE_ID = "booking-preorder-title";

/**
 * Карточка «Ваш заказ» (C3) — В ОТЛИЧИЕ ОТ `MenuPreorderCard` обычного
 * режима, показывается ВСЕГДА, даже при пустой корзине: это единственный
 * путь до кнопки «Сохранить заказ», которым гость снимает предзаказ целиком
 * (C3), и прятать его именно тогда, когда он больше всего нужен, нельзя.
 */
function BookingPreorderCard({
  cart,
  sections,
  onSaveClick,
}: {
  cart: ReturnType<typeof useBookingPreorderCart>;
  /** `undefined`, пока `GET /restaurants/:id/menu` ещё в полёте — тогда ни
   * одна строка не помечена «нет в наличии» (тот же приём, что в
   * `MenuPreorderCard`, A6). */
  sections: MenuSection[] | undefined;
  onSaveClick: () => void;
}) {
  const t = useT();
  const texts = t.web.venue.menuPage.bookingCart;

  const availability = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const section of sections ?? []) {
      for (const dish of section.dishes) map.set(dish.id, dish.isAvailable);
    }
    return map;
  }, [sections]);

  return (
    <section
      aria-labelledby={BOOKING_CART_TITLE_ID}
      className="flex flex-col gap-4 overflow-hidden rounded-xl border border-line-strong bg-canvas p-6 shadow-aside"
    >
      <h2 id={BOOKING_CART_TITLE_ID} className="text-aside-card-title tracking-[-0.2px] text-ink">
        {texts.title}
      </h2>

      {cart.cart.lines.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {cart.cart.lines.map((line) => {
            const unavailable = availability.get(line.menuItemId) === false;
            return (
              <li key={line.menuItemId} className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-flow-summary-value text-ink">{line.name}</p>
                  <p className="text-bodyS text-ink-tertiary">
                    {t.web.booking.summary.preorder.lineQty(line.quantity, formatMoneyMinor(line.priceMinor))}
                  </p>
                  {unavailable ? (
                    <p className="text-bodyS text-ink-tertiary">{t.web.venue.menuPage.unavailable}</p>
                  ) : null}
                </div>
                <DishStepper
                  quantity={line.quantity}
                  max={cart.maxQty}
                  dishName={line.name}
                  size="l"
                  onAdd={() => cart.increment(line.menuItemId)}
                  onIncrement={() => cart.increment(line.menuItemId)}
                  onDecrement={() => cart.decrement(line.menuItemId)}
                />
              </li>
            );
          })}
        </ul>
      ) : null}

      <hr className="border-0 border-t border-line" />

      <div className="flex flex-col gap-1">
        <p className="text-flow-summary-label text-ink">{texts.total(formatMoneyMinor(cart.totalMinor))}</p>
        <p className="text-bodyS text-ink-tertiary">{texts.estimateNote}</p>
      </div>

      <div className="flex flex-col gap-2.5">
        <Button size="m" block onClick={onSaveClick} loading={cart.save.isPending}>
          {texts.save}
        </Button>
        <Button size="m" variant="outline" block onClick={cart.clear} disabled={cart.save.isPending}>
          {texts.clear}
        </Button>
      </div>
    </section>
  );
}

/**
 * Полоса ниже `lg` в режиме `booking` (C7) — та же полоса, что и в обычном
 * режиме (`MenuBottomBar`), но кнопка не ссылка, а действие: «Сохранить
 * заказ» шлёт `PUT` напрямую, а не уводит на другую страницу.
 */
function BookingModeBottomBar({
  totalMinor,
  saving,
  onSaveClick,
}: {
  totalMinor: number;
  saving: boolean;
  onSaveClick: () => void;
}) {
  const t = useT();
  const texts = t.web.venue.menuPage.bookingCart;

  return (
    <BottomBar>
      <Button size="submit" block onClick={onSaveClick} loading={saving}>
        {texts.saveBar(formatMoneyMinor(totalMinor))}
      </Button>
    </BottomBar>
  );
}

/** Подтверждение снятия предзаказа (раздел 6 ТЗ, 🟡) — тот же узор, что
 * `CancelBookingDialog` в `ProfileScreen.tsx`: отдельная модалка, а не
 * `window.confirm`, чтобы заблокировать кнопку на время запроса и показать
 * текст отказа при 4xx/5xx, не потеряв введённое (здесь — снятый список). */
function RemovePreorderDialog({
  saving,
  isError,
  errorText,
  onConfirm,
  onClose,
}: {
  saving: boolean;
  isError: boolean;
  errorText: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const texts = t.web.venue.menuPage.bookingCart.removeConfirm;

  return (
    <Modal title={texts.title} description={texts.text} onClose={onClose}>
      <div className="flex flex-col gap-4">
        {isError ? (
          <p role="alert" className="text-bodyS text-danger-strong">
            {errorText}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" size="m" onClick={onClose} disabled={saving}>
            {texts.keep}
          </Button>
          <Button variant="primary" size="m" onClick={onConfirm} loading={saving}>
            {texts.confirm}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function MenuPageBody({
  venue,
  intent,
  hasIntent,
}: {
  venue: Restaurant;
  intent: BookingIntent;
  /** A8: кнопка «Вернуться к бронированию» видна ТОЛЬКО когда адрес реально
   * нёс `date`/`guests`/`slot` — иначе гость, зашедший в меню напрямую,
   * увидел бы кнопку на умолчания, которых сам не выбирал. */
  hasIntent: boolean;
}) {
  const t = useT();
  const menuQuery = useMenuSections(venue.id);
  /** ОДИН вызов хука на страницу (A3, как в `VenueBody` → `VenueScreen.tsx`):
   * сетка блюд, карточка «Предзаказ» и нижняя полоса читают ОДНО и то же
   * React-состояние — клик «+» на карточке обязан сразу подвинуть сумму в
   * карточке справа и в `BottomBar`, без похода на другую страницу. */
  const preorder = usePreorderDraft(venue.id);

  return (
    <>
      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <h1 className="text-h1 tracking-[-0.8px] text-ink">{t.web.venue.menuPage.title(venue.name)}</h1>

          <AsyncBlock
            query={menuQuery}
            emptyText={t.web.venue.menu.empty}
            isEmpty={(sections) => sections.length === 0}
            skeleton={<MenuGridSkeleton />}
          >
            {(sections) => <MenuBrowser sections={sections} venue={venue} preorder={preorder} />}
          </AsyncBlock>
        </div>

        <aside className="hidden lg:block lg:w-venue-aside lg:shrink-0">
          <div className="flex flex-col gap-4 lg:sticky lg:top-6">
            {preorder.draft.lines.length > 0 ? (
              <MenuPreorderCard
                venue={venue}
                preorder={preorder}
                sections={menuQuery.data}
                intent={intent}
                hasIntent={hasIntent}
              />
            ) : null}
            <BookingCard venue={venue} />
          </div>
        </aside>
      </div>

      <MenuBottomBar venueId={venue.id} intent={intent} totalMinor={preorder.totalMinor} />
    </>
  );
}

/**
 * Поиск + чипы категорий + сетка блюд. Отбор ДВУХСТУПЕНЧАТЫЙ: чип категории
 * сужает список разделов, поиск — сужает блюда внутри уже выбранных разделов.
 * Список самих чипов строится по ПОЛНОМУ меню (`sections`, не по результату
 * поиска) — иначе набор чипов прыгал бы при каждой напечатанной букве.
 */
function MenuBrowser({
  sections,
  venue,
  preorder,
}: {
  sections: MenuSection[];
  venue: Restaurant;
  preorder: PreorderCartControls;
}) {
  const t = useT();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const searched = useMemo(() => filterMenuSections(sections, search), [sections, search]);
  const visibleSections = activeCategory
    ? searched.filter((section) => section.title === activeCategory)
    : searched;
  const dishes = useMemo(
    () => visibleSections.flatMap((section) => section.dishes),
    [visibleSections],
  );

  return (
    <div className="flex flex-col gap-5">
      <label className="flex h-12 items-center gap-3 rounded-lg bg-subtle px-4">
        <span className="sr-only">{t.web.venue.menuPage.searchLabel}</span>
        <SearchIcon />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t.web.venue.menuPage.searchPlaceholder}
          className="w-full min-w-0 bg-transparent text-[16px] leading-6 text-ink outline-none placeholder:text-ink-tertiary"
        />
      </label>

      {sections.length > 1 ? (
        <ul
          aria-label={t.web.venue.menuPage.categoriesLabel}
          className="flex flex-wrap gap-2"
        >
          <li>
            <Chip
              state={activeCategory === null ? "selected" : "default"}
              onClick={() => setActiveCategory(null)}
            >
              {t.web.venue.menuPage.allCategory}
            </Chip>
          </li>
          {sections.map((section) => (
            <li key={section.title}>
              <Chip
                state={activeCategory === section.title ? "selected" : "default"}
                onClick={() =>
                  setActiveCategory((current) => (current === section.title ? null : section.title))
                }
              >
                {section.title}
              </Chip>
            </li>
          ))}
        </ul>
      ) : null}

      {dishes.length === 0 ? (
        <StateMessage
          title={t.web.venue.menuPage.searchEmptyTitle}
          text={t.web.venue.menuPage.searchEmptyDescription}
        />
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {dishes.map((dish) => (
              <li key={dish.id}>
                <DishCard dish={dish} canPreorder={venue.acceptsOnlineBookings} preorder={preorder} />
              </li>
            ))}
          </ul>
          <p className="text-[13px] leading-[18px] text-ink-tertiary">
            {t.web.venue.menuPage.footerNote}
          </p>
        </>
      )}
    </div>
  );
}

/**
 * Карточка блюда — тот же узор, что «Популярное в меню» на странице
 * заведения (`VenueScreen.tsx` → `MenuSection`). Степпер — по правилу A1:
 * `acceptsOnlineBookings && isAvailable && priceMinor !== null`; блюдо вне
 * наличия помечено текстом и приглушённой карточкой (A2), степпера у него
 * нет вовсе, даже если оно уже лежит в черновике с прошлого визита.
 */
function DishCard({
  dish,
  canPreorder,
  preorder,
}: {
  dish: MenuDish;
  canPreorder: boolean;
  preorder: PreorderCartControls;
}) {
  const t = useT();
  const canAdd = canPreorder && dish.isAvailable && dish.priceMinor !== null;
  const quantity = preorder.quantityOf(dish.id);

  return (
    <div
      className={cx(
        "flex h-full flex-col overflow-hidden rounded-lg bg-canvas shadow-card",
        !dish.isAvailable && "opacity-60",
      )}
    >
      <div className="relative h-venue-dish-image w-full bg-muted">
        <RemoteImage src={dish.imageUrl} alt={dish.name} sizes="(min-width: 1280px) 252px, 33vw" />
      </div>
      <div className="flex flex-1 flex-col justify-between gap-4 px-venue-dish-x py-venue-dish-y">
        <div className="flex flex-col gap-1.5">
          <p className="break-words text-[15px] font-semibold leading-[22px] text-ink">{dish.name}</p>
          {dish.description ? (
            <p className="line-clamp-2 break-words text-[13px] leading-[18px] text-ink-tertiary">
              {dish.description}
            </p>
          ) : null}
        </div>
        <div className="flex items-end justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="break-words text-[16px] font-bold leading-6 text-ink">
              {dish.priceMinor === null ? t.web.venue.menu.noPrice : formatMoneyMinor(dish.priceMinor)}
            </p>
            {!dish.isAvailable ? (
              <p className="text-[13px] leading-[18px] text-ink-tertiary">
                {t.web.venue.menuPage.unavailable}
              </p>
            ) : null}
          </div>
          {canAdd ? (
            <DishStepper
              quantity={quantity}
              max={preorder.maxQty}
              dishName={dish.name}
              onAdd={() =>
                preorder.add({ menuItemId: dish.id, name: dish.name, priceMinor: dish.priceMinor as number })
              }
              onIncrement={() => preorder.increment(dish.id)}
              onDecrement={() => preorder.decrement(dish.id)}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Карточка «Предзаказ» в правой колонке (A-WEB-2, A5-A6, A8) — над
 * `BookingCard`, только при непустом черновике. Узла под неё в макете нет
 * (🔴-1 ТЗ): паддинг/радиус/тень взяты у уже сверенной `BookingCard`
 * (`webVenuePage.asideCard`), а не подобраны на глаз.
 */
function MenuPreorderCard({
  venue,
  preorder,
  sections,
  intent,
  hasIntent,
}: {
  venue: Restaurant;
  preorder: ReturnType<typeof usePreorderDraft>;
  /** `undefined`, пока `GET /restaurants/:id/menu` ещё в полёте — тогда
   * доступность строк неизвестна, и ни одна не помечена «нет в наличии»
   * (A6: помечаем только то, что знаем наверняка). */
  sections: MenuSection[] | undefined;
  intent: BookingIntent;
  hasIntent: boolean;
}) {
  const t = useT();
  const texts = t.web.venue.menuPage.cart;

  /** Блюдо → `isAvailable` из ЗАГРУЖЕННОГО меню. Строка черновика, чьего
   * блюда в карте нет вовсе (блюдо удалено из меню целиком), в карту не
   * попадает — `.get()` вернёт `undefined`, и строка останется без пометки
   * (A6: «строка, чьего блюда в меню нет вовсе, показывается без пометки»). */
  const availability = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const section of sections ?? []) {
      for (const dish of section.dishes) map.set(dish.id, dish.isAvailable);
    }
    return map;
  }, [sections]);

  return (
    <section
      aria-labelledby={CART_TITLE_ID}
      className="flex flex-col gap-4 overflow-hidden rounded-xl border border-line-strong bg-canvas p-6 shadow-aside"
    >
      <h2 id={CART_TITLE_ID} className="text-aside-card-title tracking-[-0.2px] text-ink">
        {texts.title}
      </h2>

      <ul className="flex flex-col gap-3">
        {preorder.draft.lines.map((line) => {
          const unavailable = availability.get(line.menuItemId) === false;
          return (
            <li key={line.menuItemId} className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-flow-summary-value text-ink">{line.name}</p>
                <p className="text-bodyS text-ink-tertiary">
                  {t.web.booking.summary.preorder.lineQty(line.quantity, formatMoneyMinor(line.priceMinor))}
                </p>
                {unavailable ? (
                  <p className="text-bodyS text-ink-tertiary">{t.web.venue.menuPage.unavailable}</p>
                ) : null}
              </div>
              <DishStepper
                quantity={line.quantity}
                max={preorder.maxQty}
                dishName={line.name}
                size="l"
                onAdd={() => preorder.increment(line.menuItemId)}
                onIncrement={() => preorder.increment(line.menuItemId)}
                onDecrement={() => preorder.decrement(line.menuItemId)}
              />
            </li>
          );
        })}
      </ul>

      <hr className="border-0 border-t border-line" />

      <div className="flex flex-col gap-1">
        <p className="text-flow-summary-label text-ink">{texts.total(formatMoneyMinor(preorder.totalMinor))}</p>
        <p className="text-bodyS text-ink-tertiary">{texts.estimateNote}</p>
        {/* D-WEB-1 (D4): тот же текст и то же условие, что в `PreorderBlock`
            сводки брони (`BookingSummary.tsx` → `BelowMinimumHint`) — не
            блокирует «Забронировать»/«К бронированию», только предупреждает. */}
        {venue.preorderMinAmountMinor !== null &&
        preorder.totalMinor > 0 &&
        preorder.totalMinor < venue.preorderMinAmountMinor ? (
          <p className="text-bodyS text-ink-secondary">
            {t.web.booking.summary.preorder.belowMinimum(
              formatMoneyMinor(venue.preorderMinAmountMinor),
              formatMoneyMinor(venue.preorderMinAmountMinor - preorder.totalMinor),
            )}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2.5">
        {hasIntent ? (
          <Button size="m" block asLink href={bookingHref(venue.id, intent)}>
            {texts.backToBooking}
          </Button>
        ) : null}
        <Button size="m" variant="outline" block onClick={preorder.clear}>
          {texts.clear}
        </Button>
      </div>
    </section>
  );
}

const CART_TITLE_ID = "menu-preorder-title";

/**
 * Полоса ниже `lg` (A7, `docs/responsive.md`, дыра № 8, тот же приём, что
 * `VenueBookingBar` на странице заведения): одна кнопка, ведущая на
 * `/venues/[id]/book` с интентом, который принесла страница меню (пусто →
 * чистый адрес). Подпись меняется вместе с суммой черновика, тем же React-
 * состоянием, что и карточка «Предзаказ» и сетка блюд.
 */
function MenuBottomBar({
  venueId,
  intent,
  totalMinor,
}: {
  venueId: string;
  intent: BookingIntent;
  totalMinor: number;
}) {
  const t = useT();
  const texts = t.web.venue.menuPage.cart;
  const href = bookingHref(venueId, intent);

  return (
    <BottomBar>
      <Button size="submit" block asLink href={href}>
        {totalMinor > 0 ? texts.toBooking(formatMoneyMinor(totalMinor)) : texts.book}
      </Button>
    </BottomBar>
  );
}

function SearchIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="shrink-0 text-ink-tertiary"
    >
      <circle cx="9" cy="9" r="6" />
      <path d="M17 17l-3.8-3.8" strokeLinecap="round" />
    </svg>
  );
}
