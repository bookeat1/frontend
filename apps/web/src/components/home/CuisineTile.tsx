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
 * Ячейка НЕ задаёт себе ширину: её задаёт колонка сетки в `CuisineRow`. Круг
 * тянется на ширину колонки и упирается в 104 из макета — при десяти кухнях
 * колонка выходит 103,5, и ряд совпадает с макетом; при четырнадцати круг
 * ужимается, но ряд остаётся ОДНОЙ строкой без прокрутки (замечание владельца
 * 01.09.2026). Прежние `min-w-cuisine` + `whitespace-nowrap` держали ячейку по
 * подписи и ряд от этого переносился.
 *
 * Подпись переносится по словам и, если слово длиннее колонки, внутри слова:
 * «Средиземноморская» — одно слово, и в колонке 71 px оно не помещается ни
 * целиком, ни половиной. `hyphens: auto` даёт перенос по правилам языка там,
 * где браузер умеет, `overflow-wrap: anywhere` — грубый запасной вариант.
 * Многоточия здесь быть не может: обрезанное название кухни ничего не значит.
 *
 * В макете в круге фотография. Справочник картинку присылает не всегда (на
 * тестовом стенде — ни у одной из 14 кухонь), поэтому источников три: ссылка
 * справочника → снимок из макета в `public/cuisines` → монограмма. Битый адрес
 * приравнен к отсутствующему.
 *
 * Монограммы в макете НЕТ — это решение фронта, оно ждёт подтверждения
 * дизайнера. Альтернатива («не показывать кухню без картинки») хуже: кухня
 * это вход в фильтр каталога, и пропавший вход гость никак не восстановит.
 */
export function CuisineTile({ cuisine, compact = false }: { cuisine: Cuisine; compact?: boolean }) {
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
      className="flex w-full min-w-0 flex-col items-center gap-cuisine-gap focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <span
        className={cx(
          "relative flex aspect-square w-full max-w-cuisine items-center justify-center overflow-hidden rounded-full",
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
      <span
        className={cx(
          "w-full text-balance text-center font-medium text-ink [hyphens:auto] [overflow-wrap:anywhere]",
          compact ? "text-[13px] leading-4" : "text-[16px] leading-[18px]",
        )}
      >
        {cuisine.name}
      </span>
    </Link>
  );
}
