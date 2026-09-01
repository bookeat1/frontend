"use client";

import Link from "next/link";
import type { RestaurantSummary } from "@bookeat/api/client";

import { Card } from "@web/components/ui/Card";
import { RemoteImage } from "@web/components/ui/RemoteImage";
import { venueMeta } from "@web/lib/format";
import { useT } from "@web/lib/locale";

/**
 * Широкая карточка выдачи — Figma, узел «Card / Venue wide» кадра 3258:2:
 * 880×229, фото 268 слева, тело с паддингом 20/24, название 21/28 SemiBold,
 * подпись 14/20 и описание 14/22 на три строки.
 *
 * ЛОВУШКА, на которой карточка стояла плашмя: у веба СВОЙ набор брейкпоинтов
 * (`screens` в tailwind.config заменён, а не расширен, — там только
 * md/lg/xl/2xl из макета). Префикса `sm:` в этой теме НЕТ, и все классы с ним
 * молча выбрасывались: карточка никогда не становилась горизонтальной, фото
 * всегда лежало сверху во всю ширину. Здесь и на странице заведения теперь
 * `md:`.
 *
 * Ряда слотов из макета здесь нет: свободное время считает ручка доступности
 * ОТДЕЛЬНЫМ запросом на заведение и на конкретную дату, а выдача — это до ста
 * карточек. Показывать пять кнопок времени, за которыми нет запроса, значит
 * рисовать данные; вместо них — правдивые признаки «открыто сейчас» и
 * «онлайн-бронь», которые уже есть в ответе листинга.
 */
export function VenueWideCard({ venue }: { venue: RestaurantSummary }) {
  const t = useT();

  return (
    <Card className="relative flex w-full flex-col overflow-hidden md:flex-row">
      <div className="relative h-[200px] w-full shrink-0 bg-muted md:h-auto md:w-[268px]">
        <RemoteImage
          src={venue.coverPhoto?.uri}
          alt={venue.name}
          sizes="(min-width: 1280px) 268px, (min-width: 640px) 30vw, 100vw"
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3 p-5 md:p-6">
        <div className="flex flex-col gap-1">
          <h3 className="break-words text-[21px] font-semibold leading-7 tracking-[-0.2px] text-ink">
            <Link
              href={`/venues/${venue.id}`}
              className="after:absolute after:inset-0 after:content-[''] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {venue.name}
            </Link>
          </h3>
          <p className="break-words text-[14px] leading-5 text-ink-secondary">
            {venueMeta(venue, t)}
          </p>
        </div>

        {venue.description.trim() ? (
          // Три строки и многоточие: описания в каталоге бывают на абзац, а
          // карточка в макете фиксированной высоты.
          <p className="line-clamp-3 break-words text-[14px] leading-[22px] text-ink-secondary">
            {venue.description}
          </p>
        ) : null}

        <ul className="mt-auto flex flex-wrap gap-2">
          {venue.schedule?.openNow === true ? (
            <li className="inline-flex items-center rounded-sm bg-success px-3 py-1.5 text-[13px] font-medium leading-[18px] text-success-text">
              {t.web.catalog.card.open}
            </li>
          ) : null}
          {venue.acceptsOnlineBookings ? (
            <li className="inline-flex items-center rounded-sm bg-brand-subtle px-3 py-1.5 text-[13px] font-medium leading-[18px] text-brand-text">
              {t.web.catalog.card.bookable}
            </li>
          ) : null}
        </ul>
      </div>
    </Card>
  );
}
