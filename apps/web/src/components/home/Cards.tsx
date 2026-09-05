"use client";

import Link from "next/link";
import type { EventSummary, GuideCollection, HomePromo } from "@bookeat/api/client";

import { Card } from "@web/components/ui/Card";
import { RemoteImage } from "@web/components/ui/RemoteImage";
import { cx } from "@web/lib/cx";
import { eventDateParts } from "@web/lib/format";
import { useLocale, useT } from "@web/lib/locale";

/**
 * Карточки лент главной. Все три — из кадра 3253:2:
 *   • акция  — «Card / Promo», 384×260, фото с градиентом, бейдж скидки;
 *   • событие — «Card / Event», 384×324, плашка с датой поверх фото;
 *   • подборка — «Card / Article», 588×464, надзаголовок «От редакции».
 *
 * Акция и подборка ведут на страницу заведения-хозяина, а не на собственные
 * экраны: этих экранов в вебе ещё нет (событие с 2026-09-05 ведёт на
 * `/events/[id]`), и ссылка на них была бы
 * обещанием несуществующего маршрута. Исключение — подборка: у неё нет
 * заведения-хозяина, поэтому её карточка ведёт на страницу подборки, и эта
 * ссылка живёт за флагом `SHOW_SECTION_LINKS` до появления роута.
 */

/**
 * ВРЕМЕННО: ссылки «Вся афиша» / «Все подборки» в шапках секций главной и
 * ссылка с карточки гастрогида выключены — роутов `/events` и `/guide` на
 * сайте ещё нет, они появятся отдельной задачей после снятия макетов, и ссылка
 * вела бы в 404 Next. Включить, когда появятся роуты /events и /guide: ОДНА
 * строка — поставить здесь `true`. Разметку, словарь (`t.web.home.events.all`,
 * `t.web.home.guide.all` во всех трёх языках) и тесты трогать не надо.
 *
 * В макете (узел I3525:14277 секции 3525:14272) ссылка ЕСТЬ — расхождение
 * сознательное. Приём тот же, что у `SHOW_FOR_BUSINESS` в `SiteHeader`.
 */
export const SHOW_SECTION_LINKS: boolean = false;

/**
 * Роут `/events` ЕСТЬ с 2026-09-05 (узлы 5033:6703 и 5033:6922), поэтому
 * ссылка «Вся афиша» и карточка события включены отдельным флагом, а не общим
 * `SHOW_SECTION_LINKS`: тот всё ещё держит выключенным `/guide`, которого нет.
 */
export const SHOW_EVENTS_LINK: boolean = true;

/** Адреса, которые появятся вместе с роутами; собраны в одном месте, чтобы
 * при включении флага не искать их по вёрстке. */
export const EVENTS_PATH = "/events";
export const GUIDE_PATH = "/guide";
export const guideCollectionHref = (slug: string) => `${GUIDE_PATH}/${slug}`;
export const eventHref = (id: string) => `${EVENTS_PATH}/${id}`;

/**
 * Размеры обложек трёх карточек. Числа макета (260, 196/324, 300) живут только
 * под `lg:` — ниже структуру задаёт приложение (`docs/responsive.md`, § 5,
 * дыра № 6): у акции и подборки обложка держит пропорцию мобильной карточки
 * ряда (`aspect-home-cover`, 256×148), у события — фиксированную высоту
 * карточки «Афиши» приложения (`h-event-image-mobile`, 198).
 *
 * Константы экспортируются, чтобы скелеты лент в `HomeScreen` были собраны из
 * ТЕХ ЖЕ классов, что и карточки: высота скелета обязана совпадать с высотой
 * содержимого на каждой ширине, иначе страница прыгает при появлении данных
 * (правило из `conventions/bookeat-web.md`).
 */
export const PROMO_CARD_FRAME = "aspect-home-cover w-full lg:aspect-auto lg:h-promo-card";
export const EVENT_CARD_IMAGE = "h-event-image-mobile w-full lg:h-event-image";
export const GUIDE_CARD_IMAGE = "aspect-home-cover w-full lg:aspect-auto lg:h-guide-image";

/** `sizes` для `RemoteImage`: ниже `md` карточка занимает всю колонку. */
const THIRD_COLUMN_SIZES = "(min-width: 1280px) 384px, (min-width: 768px) 33vw, 100vw";
const HALF_COLUMN_SIZES = "(min-width: 1280px) 588px, (min-width: 768px) 50vw, 100vw";

export function PromoCard({ promo }: { promo: HomePromo }) {
  const t = useT();

  return (
    <article
      className={cx(
        "relative flex flex-col justify-end overflow-hidden rounded-card bg-muted p-5",
        PROMO_CARD_FRAME,
      )}
    >
      <RemoteImage src={promo.coverImageUrl} alt={promo.title} sizes={THIRD_COLUMN_SIZES} />
      {/* Затемнение снизу: белый текст поверх произвольной фотографии иначе
          читается через раз. Градиент, а не сплошная плашка, — как в макете. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-[rgba(0,0,0,0.72)] via-[rgba(0,0,0,0.25)] to-transparent"
      />
      {promo.discountPercent !== null ? (
        <span className="absolute left-5 top-5 inline-flex items-center rounded-full bg-brand px-3 py-1.5 text-[13px] font-bold leading-[18px] text-ink-on-brand">
          {t.web.format.discount(promo.discountPercent)}
        </span>
      ) : null}
      <div className="relative flex flex-col gap-0.5">
        <h3 className="text-[20px] font-bold leading-[30px] tracking-[-0.3px] text-ink-on-inverse">
          <Link
            href={`/venues/${promo.restaurantId}`}
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {promo.title}
          </Link>
        </h3>
        {promo.restaurantName ? (
          <p className="text-[14px] leading-5 text-ink-on-inverse">{promo.restaurantName}</p>
        ) : null}
      </div>
    </article>
  );
}

export function EventCard({ event }: { event: EventSummary }) {
  const { locale } = useLocale();
  const t = useT();
  const date = eventDateParts(event.startsAt, locale);
  const place = [event.restaurant.name, date?.time].filter(Boolean).join(t.web.format.metaSeparator);

  return (
    <Card className="relative flex h-full w-full flex-col lg:min-h-event-card">
      <div className={cx("relative shrink-0 bg-muted", EVENT_CARD_IMAGE)}>
        <RemoteImage src={event.coverImageUrl} alt={event.title} sizes={THIRD_COLUMN_SIZES} />
        {date ? (
          <span className="absolute left-4 top-4 flex h-[60px] w-[60px] flex-col items-center justify-center rounded-field bg-canvas">
            <span className="text-[22px] font-bold leading-[26px] text-ink">{date.day}</span>
            <span className="text-[11px] font-semibold leading-[14px] tracking-[0.4px] text-brand-text">
              {date.month}
            </span>
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-3 px-5 pb-5 pt-4">
        <div className="flex flex-col gap-1.5">
          <h3 className="break-words text-[20px] font-semibold leading-[26px] text-ink">
            <Link
              href={SHOW_EVENTS_LINK ? eventHref(event.id) : `/venues/${event.restaurantId}`}
              className="after:absolute after:inset-0 after:content-[''] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {event.title}
            </Link>
          </h3>
          {place ? <p className="text-[14px] leading-5 text-ink-secondary">{place}</p> : null}
        </div>
        {/* Тег ровно ОДИН (узлы I3525:1427x;3280:5591) и в одну строку:
            длинный обрезается многоточием, полный текст — в title. */}
        {event.tags.length > 0 ? (
          <ul className="flex gap-2">
            {event.tags.slice(0, 1).map((tag) => (
              <li
                key={tag}
                title={tag}
                className="max-w-full truncate rounded-sm bg-brand-subtle px-3 py-1.5 text-[14px] font-medium leading-4 text-brand-text"
              >
                {tag}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Card>
  );
}

/**
 * Карточка подборки. `href` — адрес страницы подборки; пока роута нет,
 * `HomeScreen` передаёт его только при включённом `SHOW_SECTION_LINKS`, и без
 * него карточка остаётся статьёй без ссылки. Со ссылкой — тот же приём
 * растянутой ссылки, что у `EventCard` и `PromoCard`.
 */
export function GuideCard({ collection, href }: { collection: GuideCollection; href?: string }) {
  const t = useT();

  return (
    <Card className={cx("flex w-full flex-col", href ? "relative" : null)}>
      <div className={cx("relative bg-muted", GUIDE_CARD_IMAGE)}>
        <RemoteImage src={collection.coverImageUrl} alt={collection.title} sizes={HALF_COLUMN_SIZES} />
      </div>
      <div className="flex flex-col gap-2 px-7 pb-7 pt-6">
        <p className="text-[13px] font-medium leading-[18px] tracking-[0.2px] text-ink-tertiary">
          {t.web.home.guide.eyebrow}
        </p>
        <h3 className="break-words text-[24px] font-bold leading-8 tracking-[-0.3px] text-ink">
          {href ? (
            <Link
              href={href}
              className="after:absolute after:inset-0 after:content-[''] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {collection.title}
            </Link>
          ) : (
            collection.title
          )}
        </h3>
        <p className={cx("break-words text-bodyM text-ink-secondary")}>
          {collection.subtitle || t.web.home.guide.venues(collection.venueCount)}
        </p>
      </div>
    </Card>
  );
}
