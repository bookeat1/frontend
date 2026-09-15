"use client";

import Link from "next/link";
import type { RestaurantSummary } from "@bookeat/api/client";

import { HeartIcon } from "@web/components/ui/HeartIcon";
import { RemoteImage } from "@web/components/ui/RemoteImage";
import { venueMeta } from "@web/lib/format";
import { useT } from "@web/lib/locale";

/**
 * Широкая карточка выдачи — Figma QovvuAoI9YxsLMwWkfgKN8, узел «Card / Venue
 * wide» 3525:14495: 880×229, фото 268 слева, тело с паддингом 20/24, название
 * 21/28 SemiBold, подпись 14/20 и описание 14/22 на три строки.
 *
 * ПОЧЕМУ НЕ `Card`. У карточки кита радиус 24, у этой — 18 (то же расхождение,
 * что у карточки блюда с её 16). Класс поверх `Card` полагался бы на порядок
 * правил в собранном CSS, а не на разметку, поэтому подложка своя.
 *
 * Высота 229 взята КАК МИНИМУМ, а не как жёсткий размер: у «Ресторан-кофейня
 * Дастархан» название занимает две строки, и фиксированные 229 обрезали бы
 * нижний ряд признаков. В обычном случае ряд карточек всё равно ровный.
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
 * «онлайн-бронь», которые уже есть в ответе листинга, — в геометрии слота
 * макета, чтобы нижний ряд карточки читался как в кадре.
 *
 * Чего ещё нет в данных листинга (и потому нет на карточке): бейдж «Столики
 * сегодня» / «Гастрогид» на фото, расстояние «1,2 км» в мета-строке, подпись
 * «Сегодня» и ссылка «Все слоты».
 */
export function VenueWideCard({
  venue,
  favorite = false,
  favoritePending = false,
  onToggleFavorite,
}: {
  venue: RestaurantSummary;
  favorite?: boolean;
  /** Запрос по этой карточке в полёте — кнопка заблокирована. */
  favoritePending?: boolean;
  /** Нет обработчика — нет и кнопки: сердце без действия это украшение. */
  onToggleFavorite?: () => void;
}) {
  const t = useT();

  return (
    <div className="relative flex w-full flex-col overflow-hidden rounded-wide-card bg-canvas shadow-card md:h-full md:min-h-wide-card md:flex-row">
      <div className="relative h-[200px] w-full shrink-0 bg-muted md:h-auto md:w-wide-card-image">
        <RemoteImage
          src={venue.coverPhoto?.uri}
          alt={venue.name}
          sizes="(min-width: 1280px) 268px, (min-width: 640px) 30vw, 100vw"
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3 p-5 md:px-wide-card-x md:py-wide-card-y">
        {/* Кружок избранного — узел I3525:14495;3367:11038: 40×40 на подложке
            `background/subtle`, в правом верхнем углу ТЕЛА карточки, а не
            фотографии. `z-10` обязателен: ссылка заголовка растянута на всю
            карточку псевдоэлементом и иначе перехватила бы нажатие. */}
        {onToggleFavorite ? (
          <button
            type="button"
            onClick={onToggleFavorite}
            disabled={favoritePending}
            aria-pressed={favorite}
            // Имя постоянное, состояние — в `aria-pressed`: см. VenueCard.
            aria-label={t.web.ui.favoriteToggle}
            className="absolute right-5 top-5 z-10 flex h-card-favorite w-card-favorite items-center justify-center rounded-full bg-subtle text-ink disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand md:right-wide-card-x md:top-wide-card-y"
          >
            <HeartIcon filled={favorite} size={24} />
          </button>
        ) : null}

        <div className="flex flex-col gap-1 pr-14">
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

        {/* Нижний ряд — геометрия слота макета (узел I3525:14495;3367:11047:
            34 высотой, паддинг 8/14, радиус 10, подложка `background/subtle`),
            просвет 8 как между слотами. Внутри — не время, а правдивые
            признаки из ответа листинга; цветом отличается только «Открыто». */}
        <ul className="mt-auto flex flex-wrap gap-2">
          {venue.schedule?.openNow === true ? (
            <li className="inline-flex h-wide-card-pill items-center rounded-wide-card-pill bg-subtle px-wide-card-pill-x py-wide-card-pill-y text-[13px] font-medium leading-[18px] text-success-text">
              {t.web.catalog.card.open}
            </li>
          ) : null}
          {venue.acceptsOnlineBookings ? (
            <li className="inline-flex h-wide-card-pill items-center rounded-wide-card-pill bg-subtle px-wide-card-pill-x py-wide-card-pill-y text-[13px] font-medium leading-[18px] text-ink">
              {t.web.catalog.card.bookable}
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
