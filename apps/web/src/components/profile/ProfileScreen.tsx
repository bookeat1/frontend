"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Booking } from "@bookeat/api/client";

import { Container } from "@web/components/layout/Container";
import { SiteChrome } from "@web/components/layout/SiteChrome";
import { Badge } from "@web/components/ui/Badge";
import { Modal } from "@web/components/ui/Modal";
import { Button } from "@web/components/ui/Button";
import { RemoteImage } from "@web/components/ui/RemoteImage";
import { VenueCard } from "@web/components/ui/VenueCard";
import { ProfileCard, type ProfileStat } from "@web/components/profile/ProfileCard";
import { ProfileSkeleton } from "@web/components/profile/ProfileFallback";
import { ProfileNav, SECTION_PARAM, parseSection, type ProfileSection } from "@web/components/profile/ProfileNav";
import { ProfileSegmented, segmentTabId } from "@web/components/profile/ProfileSegmented";
import { ProfileSettings } from "@web/components/profile/ProfileSettings";
import { AsyncBlock, Skeleton, StateMessage } from "@web/components/state/AsyncBlock";
import { useAuth } from "@web/lib/auth";
import { useFavoriteControl } from "@web/lib/favorites";
import { bookingHref, bookingResultPath } from "@web/lib/booking-link";
import { bookingDateLabel, venueMeta, venueWallClock } from "@web/lib/format";
import { useLocale } from "@web/lib/locale";
import {
  canCancel,
  canChange,
  canShowCode,
  type BookingSegment,
  countVisits,
  splitBySegment,
  statusPill,
} from "@web/lib/profile-bookings";
import {
  useCancelBooking,
  useFavoriteIds,
  useFavoriteVenues,
  useMyBookings,
  useVenue,
} from "@web/lib/queries";
import { loginHref } from "@web/lib/return-to";

/**
 * Страница гостя `/profile` — Figma QovvuAoI9YxsLMwWkfgKN8, узел 3525:15153
 * («WEB / 05 · Страница гостя»). Разбор: `design-specs/web/spec-profile.md`,
 * числа — `webProfile` в `packages/design-tokens/src/web.ts`.
 *
 * Каркас: карточка гостя сверху, ниже — меню разделов слева (252) и активный
 * раздел справа через 32. Раздел выбирается адресом (`?section=…`), поэтому
 * пункты меню — ссылки. Здесь собраны карточка, меню и КАРКАС раздела «Мои
 * брони» (заголовок + сегменты + место под список); сами карточки броней,
 * «Избранное» и «Настройки» — отдельные задачи, их место занимают заглушки
 * той же геометрии.
 *
 * ГОСТЬ БЕЗ СЕССИИ: страница личная, показывать на ней нечего — уводим на
 * `/login` с возвратом сюда (`return-to.ts`). Пока сессия читается из
 * хранилища, НИЧЕГО не решаем: иначе перезагрузка страницы у вошедшего гостя
 * мигала бы экраном входа.
 *
 * ВЫХОД С ЭТОЙ СТРАНИЦЫ ведёт на главную, а не на `/login?next=/profile`:
 * гость, который только что вышел, не должен видеть экран входа с возвратом
 * туда, откуда ушёл. Кнопок «Выйти» на странице две — в меню разделов и в
 * шапке (`SiteChrome`), и шапка про эту страницу не знает, поэтому переход
 * true→false у `signedIn` (сессия БЫЛА и кончилась) сторож трактует как выход
 * и сам ведёт на главную; на `/login` уходит только тот, у кого сессии не было.
 *
 * НИЖЕ `lg` (контракт `apps/web/docs/responsive.md`): структура «Профиля»
 * приложения — карточка, под ней меню на всю ширину, под ним раздел; числа из
 * Figma WEB стоят только под `lg:`. Просветы узкого экрана — шкала Tailwind, как
 * у `Container` и `SiteHeader`; отдельных мобильных токенов у страницы нет.
 */
export function ProfileScreen() {
  const { t } = useLocale();
  const texts = t.web.profile;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { user, signedIn, isLoading, signOut } = useAuth();
  const section = parseSection(params.get(SECTION_PARAM));

  // Сессия была замечена на этой странице: её исчезновение — выход, а не
  // «гость пришёл без входа». Ссылка, а не состояние: перерисовка тут не нужна.
  const hadSession = useRef(false);
  // Выход, начатый кнопкой меню: она сама ведёт на главную, и сторож ниже
  // не должен перебивать переход вторым `replace`.
  const leaving = useRef(false);
  const [signingOut, setSigningOut] = useState(false);

  // Строка поиска (`?section=favorites`) — гость мог прийти сюда прямой
  // ссылкой из подвала на конкретный раздел; `usePathname()` её не содержит,
  // и без неё вход-и-возврат ронял гостя на раздел по умолчанию («Мои
  // брони»), а не туда, куда он шёл.
  const search = params.toString();

  useEffect(() => {
    if (isLoading) return;
    if (signedIn) {
      hadSession.current = true;
      return;
    }
    if (leaving.current) return;
    const returnTo = search ? `${pathname}?${search}` : pathname;
    router.replace(hadSession.current ? "/" : loginHref(returnTo));
  }, [isLoading, signedIn, pathname, search, router]);

  const bookings = useMyBookings();
  const favorites = useFavoriteIds();

  const stats: ProfileStat[] = [
    {
      value: bookings.isError ? null : bookings.data ? countVisits(bookings.data.items) : undefined,
      word: texts.visitsWord,
    },
    {
      value: favorites.isError ? null : favorites.data ? favorites.data.size : undefined,
      word: texts.favoritesWord,
    },
  ];

  const handleSignOut = () => {
    if (signingOut) return;
    leaving.current = true;
    setSigningOut(true);
    signOut();
    router.replace("/");
  };

  let body: React.ReactNode;
  if (isLoading || (!signedIn && (hadSession.current || signingOut))) {
    // Пока сессия читается — скелет. После выхода — тот же скелет на тик до
    // перехода на главную: «доступен после входа, перенаправляем» здесь
    // соврал бы, гость выходит по своей воле.
    body = <ProfileSkeleton />;
  } else if (!signedIn) {
    body = <StateMessage text={texts.signInText} />;
  } else {
    body = (
      <>
        <ProfileCard user={user} fallbackName={t.web.header.account} stats={stats} />
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-profile-content-gap">
          <ProfileNav active={section} onSignOut={handleSignOut} signingOut={signingOut} />
          <div className="min-w-0 flex-1">
            {section === "bookings" ? (
              <BookingsSection
                query={bookings}
                counts={bookings.data ? segmentCounts(bookings.data.items) : undefined}
              />
            ) : section === "favorites" ? (
              <FavoritesSection />
            ) : (
              <ProfileSettings />
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    // Кадр 3525:15153 залит `background/subtle`: белые карточки на серой подложке.
    <SiteChrome tone="subtle">
      <Container className="flex flex-col gap-6 py-6 lg:gap-profile-page-gap lg:pb-profile-page-b lg:pt-profile-page-t">
        {body}
      </Container>
    </SiteChrome>
  );
}

function segmentCounts(items: readonly Booking[]): Record<BookingSegment, number> {
  const split = splitBySegment(items, new Date());
  return { active: split.active.length, past: split.past.length, cancelled: split.cancelled.length };
}

const SEGMENTS: readonly BookingSegment[] = ["active", "past", "cancelled"];

/**
 * Раздел «Мои брони» (узел 3525:15194): заголовок 28/36 и сегменты в одной
 * строке, ниже через 20 — список карточек. Счётчики в сегментах — настоящие,
 * из того же запроса, что и «визиты» в карточке гостя; пока запрос едет,
 * подписи без чисел, а не с нулями.
 *
 * Список — ПЕРВАЯ страница `GET /bookings` (`MY_BOOKINGS_PAGE_SIZE`), без
 * подгрузки следующих: у гостя это разумный потолок, а вторая страница —
 * отдельная задача, а не то, что можно дорисовать «на глаз».
 */
function BookingsSection({
  query,
  counts,
}: {
  query: import("@tanstack/react-query").UseQueryResult<import("@bookeat/api/client").BookingPage>;
  counts?: Record<BookingSegment, number>;
}) {
  const { t } = useLocale();
  const texts = t.web.profile.bookings;
  const [segment, setSegment] = useState<BookingSegment>("active");
  const panelId = "profile-bookings-panel";

  const options = useMemo(
    () =>
      SEGMENTS.map((key) => ({
        key,
        label: counts ? texts.segment(texts.segments[key], counts[key]) : texts.segments[key],
      })),
    [counts, texts],
  );

  return (
    <section aria-labelledby="profile-bookings-title" className="flex flex-col gap-profile-section-gap">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 id="profile-bookings-title" className="text-profile-title tracking-[-0.5px] text-ink">
          {texts.title}
        </h2>
        <ProfileSegmented
          options={options}
          value={segment}
          onChange={setSegment}
          label={texts.segmentsLabel}
          panelId={panelId}
        />
      </div>
      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={segmentTabId(panelId, segment)}
        className="flex flex-col gap-pbook-gap"
      >
        <AsyncBlock
          query={query}
          isEmpty={() => false}
          emptyText=""
          skeleton={<Skeleton className="h-pbook-image w-full rounded-pbook" />}
        >
          {(page) => {
            const items = splitBySegment(page.items)[segment];
            if (items.length === 0) {
              const emptyText =
                segment === "active"
                  ? texts.emptyActive
                  : segment === "past"
                    ? texts.emptyPast
                    : texts.emptyCancelled;
              return (
                <StateMessage text={emptyText}>
                  {segment === "active" ? (
                    <Link
                      href="/venues"
                      className="text-[16px] font-semibold leading-6 text-brand-text underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    >
                      {texts.findVenue}
                    </Link>
                  ) : null}
                </StateMessage>
              );
            }
            return (
              <>
                <ul className="flex flex-col gap-pbook-gap">
                  {items.map((booking) => (
                    <li key={booking.id}>
                      <BookingCard booking={booking} />
                    </li>
                  ))}
                </ul>
                {page.total > page.items.length ? (
                  <p className="text-[13px] leading-[18px] text-ink-tertiary">
                    {texts.partial(page.items.length, page.total)}
                  </p>
                ) : null}
              </>
            );
          }}
        </AsyncBlock>
      </div>
    </section>
  );
}

/**
 * Одна карточка брони (узел 3525:15205, `webProfile.bookingCard`).
 *
 * `GET /bookings` не несёт ни названия заведения, ни фото, ни адреса — только
 * `restaurant_id` (см. `packages/api/src/http-mapping.ts` `ApiBooking`). Тот
 * же приём, что у мобильного `BookingListCard`: карточка сама донашивает
 * сводку заведения (`useVenue`, React Query дедуплицирует по id), а пока она
 * не пришла или упала — название честно подменяется служебной строкой, фото
 * и адрес просто не рисуются.
 */
function BookingCard({ booking }: { booking: Booking }) {
  const { t, locale } = useLocale();
  const texts = t.web.profile.bookings;
  const venueQuery = useVenue(booking.restaurantId);
  const venue = venueQuery.data;
  const [cancelOpen, setCancelOpen] = useState(false);
  const now = useMemo(() => new Date(), []);

  const pill = statusPill(booking, now);
  const wallClock = venueWallClock(booking.startsAt, venue?.schedule?.timezone);
  const dateLabel = wallClock ? bookingDateLabel(wallClock.date, locale) : null;

  return (
    <div className="flex flex-col overflow-hidden rounded-pbook bg-canvas shadow-card md:flex-row">
      <div className="relative h-[180px] w-full shrink-0 bg-muted md:h-pbook-image md:w-pbook-image">
        <RemoteImage
          src={venue?.coverPhoto?.uri}
          alt={venue?.name ?? texts.venueFallback}
          sizes="(min-width: 768px) 200px, 100vw"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-pbook-body-gap px-pbook-body-x py-pbook-body-y">
        <div className="flex flex-wrap items-start justify-between gap-pbook-top-gap">
          <div className="flex min-w-0 flex-col gap-pbook-titles-gap">
            <h3 className="break-words text-pbook-title tracking-[-0.2px] text-ink">
              {venue?.name ?? texts.venueFallback}
            </h3>
            {venue?.address ? (
              <p className="break-words text-pbook-address text-ink-secondary">{venue.address}</p>
            ) : null}
          </div>
          {/* Тон бейджа даёт и заливку, и цвет точки (`bg-current`) — своего
              отдельного значения «цвет точки» Figma в этой сессии не отдал
              (429 на весь файл), поэтому точка не придумывает новый оттенок,
              а берёт уже измеренный цвет текста бейджа того же тона. */}
          <Badge tone={pill.tone} className="shrink-0 gap-1.5">
            <span aria-hidden="true" className="h-[7px] w-[7px] shrink-0 rounded-full bg-current" />
            {texts.status[pill.key]}
          </Badge>
        </div>

        <dl className="flex flex-wrap gap-x-pbook-info-gap gap-y-2">
          <div className="flex flex-col gap-pbook-info-inner">
            <dt className="text-pbook-label uppercase tracking-[0.2px] text-ink-tertiary">{texts.info.date}</dt>
            <dd className="text-pbook-value text-ink">{dateLabel ?? "—"}</dd>
          </div>
          <div className="flex flex-col gap-pbook-info-inner">
            <dt className="text-pbook-label uppercase tracking-[0.2px] text-ink-tertiary">{texts.info.time}</dt>
            <dd className="text-pbook-value text-ink">{wallClock?.time ?? "—"}</dd>
          </div>
          <div className="flex flex-col gap-pbook-info-inner">
            <dt className="text-pbook-label uppercase tracking-[0.2px] text-ink-tertiary">{texts.info.guests}</dt>
            <dd className="text-pbook-value text-ink">{booking.guests}</dd>
          </div>
          {canShowCode(booking, now) ? (
            <div className="flex flex-col gap-pbook-info-inner">
              <dt className="text-pbook-label uppercase tracking-[0.2px] text-ink-tertiary">{texts.info.code}</dt>
              <dd className="text-pbook-value text-ink">{booking.id.slice(0, 8).toUpperCase()}</dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-auto flex flex-wrap gap-pbook-actions-gap">
          {canChange(booking, now) ? (
            <Button asLink href={bookingHref(booking.restaurantId, { changeBookingId: booking.id })} variant="secondary" size="m">
              {texts.actions.change}
            </Button>
          ) : null}
          {canCancel(booking) ? (
            <Button variant="secondary" size="m" onClick={() => setCancelOpen(true)}>
              {texts.actions.cancel}
            </Button>
          ) : null}
          {pill.key === "completed" || pill.key === "noShow" || pill.key === "cancelled" ? (
            <Button asLink href={`/venues/${encodeURIComponent(booking.restaurantId)}`} variant="secondary" size="m">
              {texts.actions.rebook}
            </Button>
          ) : null}
          {canShowCode(booking, now) ? (
            <Button asLink href={bookingResultPath(booking.id)} variant="outline" size="m">
              {texts.actions.showCode}
            </Button>
          ) : null}
        </div>
      </div>

      {cancelOpen ? <CancelBookingDialog booking={booking} onClose={() => setCancelOpen(false)} /> : null}
    </div>
  );
}

/** Подтверждение отмены (узел брони, текст `t.web.profile.bookings.cancelDialog`).
 * Отдельная модалка, а не `window.confirm`: та не даёт заблокировать кнопку
 * на время запроса и не покажет текст отказа при 4xx/5xx. */
function CancelBookingDialog({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const { t } = useLocale();
  const texts = t.web.profile.bookings.cancelDialog;
  const cancelMutation = useCancelBooking();

  const handleConfirm = () => {
    if (cancelMutation.isPending) return;
    cancelMutation.mutate(
      { bookingId: booking.id },
      {
        onSuccess: () => onClose(),
      },
    );
  };

  return (
    <Modal title={texts.title} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-[15px] leading-[22px] text-ink-secondary">{texts.text}</p>
        {cancelMutation.isError ? (
          <p role="alert" className="text-[13px] leading-[18px] text-danger-strong">
            {texts.failed}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" size="m" onClick={onClose} disabled={cancelMutation.isPending}>
            {texts.keep}
          </Button>
          <Button variant="primary" size="m" onClick={handleConfirm} loading={cancelMutation.isPending}>
            {texts.confirm}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Раздел «Избранное» (узел 3525:15365-...): ряд карточек заведений — тот же
 * `VenueCard`, что и на главной/в каталоге (правило «не плодить вторую
 * карточку»), с кнопкой «Забронировать» как нижним слотом карточки и
 * сердечком, снятие которого сразу убирает карточку из списка (тот же
 * `useToggleFavorite`/`invalidateQueries`, что и везде).
 */
function FavoritesSection() {
  const { t } = useLocale();
  const texts = t.web.profile.favorites;
  const query = useFavoriteVenues();
  const favoriteProps = useFavoriteControl();

  return (
    <section className="flex flex-col gap-profile-section-gap">
      <h2 className="text-profile-title tracking-[-0.5px] text-ink">{texts.title}</h2>
      <AsyncBlock
        query={query}
        emptyText={texts.empty}
        empty={
          <StateMessage text={texts.empty}>
            <Link
              href="/venues"
              className="text-[16px] font-semibold leading-6 text-brand-text underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {texts.browse}
            </Link>
          </StateMessage>
        }
        skeleton={
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {["a", "b", "c"].map((key) => (
              <Skeleton key={key} className="h-fav-image w-full rounded-pbook" />
            ))}
          </div>
        }
      >
        {(venues) => (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {venues.map((venue) => (
              <li key={venue.id} className="h-full">
                <VenueCard
                  name={venue.name}
                  meta={venueMeta(venue, t)}
                  imageUrl={venue.coverPhoto?.uri}
                  href={`/venues/${venue.id}`}
                  action={
                    <Button asLink href={`/venues/${venue.id}/book`} variant="secondary" size="m" className="w-full">
                      {texts.book}
                    </Button>
                  }
                  {...favoriteProps(venue.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </AsyncBlock>
    </section>
  );
}
