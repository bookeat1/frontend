"use client";

import { useState } from "react";

import { Card } from "@web/components/ui/Card";
import { cx } from "@web/lib/cx";
import { t } from "@web/lib/i18n";

/**
 * Карточка заведения — единственная карточка, полностью размеченная в
 * десктопных кадрах (Figma 3z0f6dgev4HMwBAHPjTjPo, узел 3280:5482).
 *
 * Размеры оттуда же: фото 190 высотой, тело с паддингом 16 и просветом 16,
 * название 18/24 SemiBold, подпись 14/20 Regular #595959, слоты-подсказки
 * 32 высотой с радиусом 10 (первый — фирменный #FBEFF0/#96272C, остальные
 * серые #F8F8F8). Ширина карточки в макете 282, но она НЕ зашита: карточка
 * тянется на ширину ячейки сетки, иначе колонки на 1024 и 1280 разъедутся.
 *
 * Данные приходят пропсами. Своего запроса у карточки нет — сеть живёт в
 * `@bookeat/api`, и экран передаёт сюда уже разобранный ответ.
 */
export interface VenueCardProps {
  name: string;
  /** Готовая строка «кухня · цена · расстояние» — её собирает словарь. */
  meta: string;
  imageUrl?: string | null;
  /** Плашка поверх фотографии, например «Столики сегодня». */
  tag?: string;
  /** Подсказки свободного времени. Пусто — блок не рисуется вовсе. */
  slots?: readonly string[];
  favorite?: boolean;
  onToggleFavorite?: () => void;
  onSelectSlot?: (time: string) => void;
  className?: string;
}

export function VenueCard({
  name,
  meta,
  imageUrl,
  tag,
  slots = [],
  favorite = false,
  onToggleFavorite,
  onSelectSlot,
  className,
}: VenueCardProps) {
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  const src = imageUrl?.trim() ? imageUrl.trim() : null;
  const showImage = src !== null && src !== brokenUrl;

  return (
    <Card className={cx("flex w-full flex-col", className)}>
      <div className="relative h-card-image w-full bg-muted">
        {showImage ? (
          // ПОЧЕМУ обычный <img>, а не next/image: адреса картинок приходят из
          // БД (боевой бакет R2 `pub-…r2.dev`, старые ссылки на Supabase
          // Storage, вставленные вручную URL). Домены заранее не известны, а
          // next/image требует перечислить их в `images.remotePatterns` — любая
          // новая ссылка ломалась бы молча. Ровно то же решение и по той же
          // причине принято в apps/admin/src/components/ui/ImageThumb.tsx.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={name}
            loading="lazy"
            decoding="async"
            onError={() => setBrokenUrl(src)}
            className="h-full w-full object-cover"
          />
        ) : null}

        {tag ? (
          <span className="absolute left-4 top-4 inline-flex items-center rounded-sm bg-photo-badge px-2.5 py-1.5 text-[12px] font-semibold leading-4 text-ink-on-brand">
            {tag}
          </span>
        ) : null}

        {onToggleFavorite ? (
          <button
            type="button"
            onClick={onToggleFavorite}
            aria-pressed={favorite}
            aria-label={favorite ? t.web.ui.removeFromFavorites : t.web.ui.addToFavorites}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-photo-control text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <HeartIcon filled={favorite} />
          </button>
        ) : null}
      </div>

      <div className="flex flex-col gap-card-body p-card-body">
        <div className="flex flex-col gap-1">
          {/* Название заведения переносится, а не режется многоточием:
              «Ресторан-кофейня Дастархан» на 282 px в одну строку не влезает,
              и обрезанное имя гость не узнает. */}
          <h3 className="break-words text-[18px] font-semibold leading-6 text-ink">{name}</h3>
          <p className="break-words text-[14px] leading-5 text-ink-secondary">{meta}</p>
        </div>

        {slots.length > 0 ? (
          <ul aria-label={t.web.ui.slotsLabel} className="flex flex-wrap gap-2">
            {slots.map((time, index) => (
              <li key={time}>
                <button
                  type="button"
                  onClick={() => onSelectSlot?.(time)}
                  className={cx(
                    "inline-flex h-8 items-center justify-center rounded-slot px-3 text-[13px] font-semibold leading-[18px]",
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
      </div>
    </Card>
  );
}

/** Сердце из мобильного набора Phosphor, перерисованное как inline-SVG:
 * тянуть иконочный пакет ради одной формы в вебе не за что. */
function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 20.7 3.9 12.6a5.4 5.4 0 0 1 7.6-7.6l.5.5.5-.5a5.4 5.4 0 0 1 7.6 7.6Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
