"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { Card } from "@web/components/ui/Card";
import { HeartIcon } from "@web/components/ui/HeartIcon";
import { RemoteImage } from "@web/components/ui/RemoteImage";
import { cx } from "@web/lib/cx";
import { useT } from "@web/lib/locale";

/**
 * Карточка заведения — единственная карточка, полностью размеченная в
 * десктопных кадрах (Figma QovvuAoI9YxsLMwWkfgKN8, узел 3280:4748; в блоке
 * «Выбрали для вас» (3525:14214) и в «Все заведения» (3525:14246) это ОДИН и
 * тот же компонент, 282 шириной).
 *
 * Размеры оттуда же: фото 190 высотой, тело с паддингом 16 и просветом 16,
 * название 18/24 SemiBold, подпись 14/20 Regular #595959, слоты-подсказки
 * 32 высотой с радиусом 10 (первый — фирменный #FBEFF0/#96272C, остальные
 * серые #F8F8F8). Ширина карточки в макете 282, но она НЕ зашита: карточка
 * тянется на ширину ячейки сетки, иначе колонки на 1024 и 1280 разъедутся.
 *
 * Данные приходят пропсами. Своего запроса у карточки нет — сеть живёт в
 * `@bookeat/api`, и экран передаёт сюда уже разобранный ответ.
 *
 * `slots` РАЗЛИЧАЕТ два случая, которые легко перепутать:
 *   • `undefined` — свободное время не спрашивали (сайт не делает запрос
 *     доступности на каждую карточку выдачи), и блок не рисуется вовсе;
 *   • `[]` — спросили, и свободного времени нет; тогда это сказано словами.
 * Раньше оба случая выглядели как «Свободного времени нет», то есть карточка
 * утверждала про заведение то, чего никто не проверял.
 */
export interface VenueCardProps {
  name: string;
  /** Готовая строка «кухня · цена · расстояние» — её собирает словарь. */
  meta: string;
  imageUrl?: string | null;
  /** Плашка поверх фотографии, например «Столики сегодня». */
  tag?: string;
  /** Куда ведёт карточка. Есть — вся карточка становится ссылкой. */
  href?: string;
  /** Подсказки свободного времени. См. комментарий выше о `undefined` и `[]`. */
  slots?: readonly string[];
  favorite?: boolean;
  /** Запрос по этой карточке в полёте — кнопка заблокирована. */
  favoritePending?: boolean;
  onToggleFavorite?: () => void;
  onSelectSlot?: (time: string) => void;
  /** Нижний слот тела — кнопка «Забронировать» в избранном профиля
   * (узел 3525:15403). Кнопка стоит ПОВЕРХ растянутой ссылки заголовка. */
  action?: ReactNode;
  className?: string;
}

export function VenueCard({
  name,
  meta,
  imageUrl,
  tag,
  href,
  slots,
  favorite = false,
  favoritePending = false,
  onToggleFavorite,
  onSelectSlot,
  action,
  className,
}: VenueCardProps) {
  const t = useT();

  return (
    // `h-full` + растущее тело: в макете все карточки ряда одного размера, а в
    // жизни у одного заведения подпись в строку, у другого в две, и нижние
    // края разъезжались (замечание владельца 01.09.2026 про «Все заведения»).
    // Одной высоты мало — её задаёт ячейка сетки; чтобы белая подложка
    // дотянулась до низа, тело обязано быть `flex-1`.
    <Card className={cx("relative flex h-full w-full flex-col", className)}>
      <div className="relative h-card-image w-full shrink-0 bg-muted">
        <RemoteImage
          src={imageUrl}
          alt={name}
          // Ширина карточки из макета — 282 при контейнере 1200 в четыре
          // колонки; ниже 1024 колонок меньше, поэтому доля вьюпорта больше.
          sizes="(min-width: 1280px) 282px, (min-width: 1024px) 25vw, 50vw"
        />

        {/* Плашка стоит СНИЗУ СЛЕВА, как в макете (узел 3280:4806), а не
            сверху: сверху справа живёт кружок избранного, и обе метки в одном
            углу налезали бы друг на друга. Радиус 8, паддинг 6/10, 12/16
            SemiBold — числа в `webVenueCard.badge`. */}
        {tag ? (
          <span className="absolute bottom-card-badge-inset-b left-card-badge-inset-x inline-flex items-center rounded-sm bg-photo-badge px-card-badge-x py-card-badge-y text-[12px] font-semibold leading-4 text-ink-on-brand">
            {tag}
          </span>
        ) : null}

        {onToggleFavorite ? (
          <button
            type="button"
            onClick={onToggleFavorite}
            disabled={favoritePending}
            aria-pressed={favorite}
            // Имя ПОСТОЯННОЕ, состояние несёт `aria-pressed`. Меняющееся имя
            // рядом с состоянием читается вслух как «Убрать из избранного,
            // нажато» — гость слышит противоречие вместо подсказки.
            aria-label={t.web.ui.favoriteToggle}
            className="absolute right-card-favorite-inset top-card-favorite-inset z-10 flex h-card-favorite w-card-favorite items-center justify-center rounded-full bg-photo-control text-ink disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <HeartIcon filled={favorite} />
          </button>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-card-body p-card-body">
        <div className="flex flex-col gap-1">
          {/* Название заведения переносится, а не режется многоточием:
              «Ресторан-кофейня Дастархан» на 282 px в одну строку не влезает,
              и обрезанное имя гость не узнает. */}
          <h3 className="break-words text-[18px] font-semibold leading-6 text-ink">
            {href ? (
              // Ссылкой становится ЗАГОЛОВОК, а не вся карточка: внутри
              // карточки живут кнопки (избранное, слоты), а кнопка внутри
              // ссылки — невалидная разметка, которую браузеры и скринридеры
              // разбирают каждый по-своему. `after:absolute` растягивает
              // область нажатия ссылки на всю карточку, оставляя кнопки
              // кликабельными поверх неё.
              <Link
                href={href}
                className="after:absolute after:inset-0 after:content-[''] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                {name}
              </Link>
            ) : (
              name
            )}
          </h3>
          <p className="break-words text-[14px] leading-5 text-ink-secondary">{meta}</p>
        </div>

        {slots === undefined ? null : slots.length > 0 ? (
          // Слоты делят строку поровну (`flex-1`, узел 3280:4392), а не
          // переносятся: в макете это ряд из трёх равных долей.
          <ul aria-label={t.web.ui.slotsLabel} className="relative z-10 flex gap-2">
            {slots.map((time, index) => (
              <li key={time} className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => onSelectSlot?.(time)}
                  className={cx(
                    "inline-flex h-8 w-full items-center justify-center rounded-slot px-3 text-[13px] font-semibold leading-[18px]",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                    // Первый слот в макете выделен фирменным тоном — это
                    // ближайшее свободное время, а не «выбранное».
                    index === 0 ? "bg-brand-subtle text-brand-text" : "bg-subtle text-ink",
                  )}
                >
                  {time}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] leading-[18px] text-ink-tertiary">{t.web.ui.noSlots}</p>
        )}
        {action ? <div className="relative z-10 mt-auto">{action}</div> : null}
      </div>
    </Card>
  );
}
