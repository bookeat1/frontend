import type { ReactNode } from "react";

import { RemoteImage } from "@web/components/ui/RemoteImage";
import { repository } from "@web/lib/api";
import { cx } from "@web/lib/cx";

/**
 * Примитивы блока «Контакты и как добраться» — карта, плашка контакта,
 * ссылка внутри плашки и значки. Вынесены из `VenueScreen.tsx` (узел
 * 3264:66…74), потому что страница события/акции (`EventVenueBlocks.tsx`,
 * T1) рисует ТОТ ЖЕ блок с другим набором карточек, и вторая копия чисел
 * разъехалась бы с первой в первую же правку макета — тот же урок, что уже
 * стоил «Акциям» отдельной раскладки (bugs/bookeat-frontend-promos-list-own-layout).
 *
 * Числа плашки (72 высотой, радиус 14, паддинг 16/18, просвет 14, кружок 40)
 * — `webVenuePage.contactCard`; страница события использует те же классы
 * `venue-contact-*` и добавляет свою высоту (`h-afisha-contact` = 86,
 * `webEventDetail.contactCard`) через `className`, а не второй набор чисел.
 */

/** Карта заведения 788×280 (`webVenuePage.map`, узел 3264:69) — общая для
 * страницы заведения и страницы события/акции. `venueId`/`hasCoords` решают,
 * рисовать ли запрос вовсе: без координат сервер картинку не построит. */
export function MapPreview({
  venueId,
  hasCoords,
  alt,
  unavailableText,
}: {
  venueId: string;
  hasCoords: boolean;
  alt: string;
  unavailableText: string;
}) {
  const mapUrl = hasCoords ? repository.getMapPreviewUrl(venueId, { size: "detail" }) : undefined;

  // Координат нет — карту не строим и ничего не объясняем гостю: заведение
  // не виновато в отсутствии данных, а текст-заглушка сам стал жалобой на
  // заведение (снято 2026-09-09). Просто скрываем блок карты; адрес и
  // телефон ниже (если есть) рисуются как обычно.
  if (!mapUrl) {
    return null;
  }

  return (
    <div className="relative h-venue-map w-full overflow-hidden rounded-lg bg-muted">
      <RemoteImage
        src={mapUrl}
        alt={alt}
        sizes="788px"
        // Координаты есть, а карта не пришла — это НЕ то же самое, что
        // «координат нет». На тестовом стенде провайдер карт не настроен
        // (`map_not_configured`, 503), и без подписи здесь оставался бы серый
        // прямоугольник 788×280.
        fallback={<span className="text-bodyM text-ink-tertiary">{unavailableText}</span>}
      />
    </div>
  );
}

/**
 * Плашка контакта — узел 3264:74: радиус 14, паддинг 16/18, просвет 14,
 * белый кружок значка 40. Высота на странице заведения складывается из
 * содержимого; страница события фиксирует её 86-ю через `className`
 * (`h-afisha-contact`), а не переопределяет паддинг/просвет по новой.
 */
export function ContactCard({
  icon,
  title,
  note,
  href,
  external = false,
  className,
}: {
  icon: ReactNode;
  title: ReactNode;
  note?: ReactNode;
  href?: string;
  external?: boolean;
  className?: string;
}) {
  const body = (
    <>
      <span
        aria-hidden="true"
        className="flex h-venue-contact-icon w-venue-contact-icon shrink-0 items-center justify-center rounded-full bg-canvas text-ink-secondary"
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="break-words text-[14px] font-semibold leading-5 text-ink">{title}</span>
        {note ? <span className="break-words text-[12px] leading-4 text-ink-tertiary">{note}</span> : null}
      </span>
    </>
  );

  const inner = "flex items-center gap-venue-contact-gap px-venue-contact-x py-4";

  return (
    <li className={cx("rounded-field bg-subtle", className)}>
      {href ? (
        <a
          href={href}
          {...(external ? { target: "_blank", rel: "noreferrer nofollow" } : {})}
          className={cx(
            inner,
            "h-full rounded-field focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
          )}
        >
          {body}
        </a>
      ) : (
        <span className={cx(inner, "h-full")}>{body}</span>
      )}
    </li>
  );
}

/**
 * Ссылка внутри плашки контактов — наследует кегль и цвет строки, чтобы
 * заголовок 14/20 SemiBold и подпись 12/16 остались такими, как в макете.
 */
export function ContactLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer nofollow"
      className="rounded-sm hover:underline focus-visible:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      {children}
    </a>
  );
}

export function PinIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 21s6-5.3 6-10a6 6 0 1 0-12 0c0 4.7 6 10 6 10Z" strokeLinejoin="round" />
      <circle cx="12" cy="11" r="2.2" />
    </svg>
  );
}

export function PhoneIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path
        d="M5 4h3.2l1.4 3.5-2 1.3a12 12 0 0 0 5.6 5.6l1.3-2L18 13.8V17a2 2 0 0 1-2.2 2A14.5 14.5 0 0 1 5 6.2 2 2 0 0 1 7 4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Значок Instagram на плашке соцсетей (узел 3525:14725). Сам вектор из макета
 * не снят — component set в файле сломан (см. design-specs/web/spec-venue-
 * socials.md), поэтому контур нарисован по скриншоту: скруглённый квадрат,
 * объектив, точка вспышки; та же толщина линии, что у соседних значков.
 */
export function InstagramIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="4" y="4" width="16" height="16" rx="4.5" />
      <circle cx="12" cy="12" r="3.6" />
      <circle cx="16.6" cy="7.4" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function LinkIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1.2 1.2" strokeLinecap="round" />
      <path d="M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1.2-1.2" strokeLinecap="round" />
    </svg>
  );
}
