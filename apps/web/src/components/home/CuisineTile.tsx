"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import type { Cuisine } from "@bookeat/api/client";

import { cuisinePhoto } from "@web/lib/cuisine-photos";
import { cx } from "@web/lib/cx";

/**
 * Ячейка ряда «Выберите кухню» — Figma 3254:7 (кадр 3253:2).
 *
 * Два правила из макета, которые легко потерять:
 *
 * 1. Круг всегда 104, а ЯЧЕЙКА тянется по подписи (104 у «Европейской»,
 *    112 у «Паназиатской», 122 у «Морепродуктов»). Поэтому здесь `min-w`,
 *    а не `w`, и подпись в ОДНУ строку: «Средиземноморская» — одно слово,
 *    переносить его не по чему, и в ячейке шириной ровно с круг оно вылезает
 *    на соседей (именно это и было видно на стенде).
 *
 * 2. В макете в круге фотография. Справочник картинку присылает не всегда
 *    (на тестовом стенде — ни у одной из 14 кухонь), поэтому источников три:
 *    ссылка справочника → снимок из макета, лежащий в `public/cuisines` →
 *    монограмма. Битый адрес приравнен к отсутствующему: гость видит одно и
 *    то же, и лечится оно одинаково.
 *
 * Монограммы в макете НЕТ — это решение фронта, оно ждёт подтверждения
 * дизайнера. Альтернатива («не показывать кухню без картинки») хуже: кухня
 * это вход в фильтр каталога, и пропавший вход гость никак не восстановит.
 */
export function CuisineTile({ cuisine }: { cuisine: Cuisine }) {
  // Помним УПАВШИЕ адреса, а не булев флаг: адресов два, и «сломался
  // справочник» не должно означать «сломался и запасной снимок».
  const [broken, setBroken] = useState<ReadonlySet<string>>(() => new Set());

  const candidates = [cuisine.imageUrl?.trim(), cuisinePhoto(cuisine.id)].filter(
    (url): url is string => Boolean(url),
  );
  const src = candidates.find((url) => !broken.has(url));

  return (
    <Link
      href={`/venues?cuisine=${encodeURIComponent(cuisine.id)}`}
      className="flex min-w-cuisine flex-col items-center gap-cuisine-gap focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <span
        className={cx(
          "relative flex h-cuisine w-cuisine shrink-0 items-center justify-center overflow-hidden rounded-full",
          // Под фотографией — обычная приглушённая подложка (у части снимков
          // прозрачный фон). Под монограммой — фирменная светлая.
          src ? "bg-muted" : "bg-brand-subtle",
        )}
      >
        {src ? (
          <Image
            src={src}
            alt=""
            fill
            sizes="104px"
            // Тот же довод, что в RemoteImage: наш загрузчик отдаёт один адрес
            // на любую ширину, без флага Next печатает srcSet из шестнадцати
            // одинаковых ссылок.
            unoptimized
            loading="lazy"
            onError={() => setBroken((previous) => new Set(previous).add(src))}
            className="object-cover"
          />
        ) : (
          <span aria-hidden="true" className="text-h3 text-brand-text">
            {cuisine.name.trim().slice(0, 1).toUpperCase()}
          </span>
        )}
      </span>
      <span className="whitespace-nowrap text-center text-[16px] font-medium leading-[18px] text-ink">
        {cuisine.name}
      </span>
    </Link>
  );
}
