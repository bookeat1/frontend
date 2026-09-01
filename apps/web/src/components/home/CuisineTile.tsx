"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { webCuisineTile } from "@bookeat/design-tokens";
import type { Cuisine } from "@bookeat/api/client";

import { cuisinePhoto } from "@web/lib/cuisine-photos";
import { cx } from "@web/lib/cx";

/** Круг рисуется ровно в размер токена, поэтому `sizes` — тоже из токенов. */
const IMAGE_SIZES = `${webCuisineTile.size}px`;

/**
 * Ячейка ряда «Выберите кухню» — Figma 3254:7 (кадр 3253:2).
 *
 * Ширину ячейке задаёт `CuisineRow` (`width: min-content`), то есть ячейка
 * равна самому длинному СЛОВУ подписи или кругу — что шире. Ровно так ячейка
 * и нарисована в макете: 104 у «Европейской», 112 у «Паназиатской», 122 у
 * «Морепродуктов» при одном и том же круге 104.
 *
 * ПОДПИСЬ НЕ РВЁТСЯ ВНУТРИ СЛОВА. `hyphens: none` и `overflow-wrap: normal`
 * стоят явно: прежние `[hyphens:auto]` + `[overflow-wrap:anywhere]` давали
 * «Средизем-номорская» и «Море-продукты» — владелец назвал это багом
 * 01.09.2026. Перенос допустим ТОЛЬКО по пробелу, поэтому «Еуропалық асхана»
 * встаёт в две строки, а «Средиземноморская» обязана поместиться целиком.
 * Многоточия здесь тоже быть не может: обрезанное название кухни ничего не
 * значит.
 *
 * РАЗМЕР ОДИН НА ВСЕ ШИРИНЫ — тот, что в макете: круг 104, подпись 16/18
 * Medium. Уменьшенного варианта (64 и 11/14) больше нет: он существовал
 * 01.09.2026 несколько часов, пока от ряда требовали уместиться в 1200 без
 * прокрутки. Прокрутка эту причину сняла — см. `CuisineRow`.
 *
 * В макете в круге фотография. Справочник картинку присылает не всегда (на
 * тестовом стенде 01.09.2026 — ни у одной из 15 кухонь), поэтому источников
 * три: ссылка
 * справочника → снимок из макета в `public/cuisines` → монограмма. Битый адрес
 * приравнен к отсутствующему.
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
      className="flex w-full flex-col items-center gap-cuisine-gap focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <span
        className={cx(
          "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full",
          "h-cuisine w-cuisine",
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
            sizes={IMAGE_SIZES}
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
      <span className="w-full text-center text-cuisine-label text-ink [hyphens:none] [overflow-wrap:normal]">
        {cuisine.name}
      </span>
    </Link>
  );
}
