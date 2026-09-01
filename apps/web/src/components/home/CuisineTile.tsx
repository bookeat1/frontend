"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { webCuisineTile, webLayout } from "@bookeat/design-tokens";
import type { Cuisine } from "@bookeat/api/client";

import { cuisinePhoto } from "@web/lib/cuisine-photos";
import { cx } from "@web/lib/cx";

/** Круг рисуется ровно в размер токена, поэтому `sizes` — тоже из токенов. */
const DESIGN_IMAGE_SIZES = `${webCuisineTile.size}px`;
const COMPACT_IMAGE_SIZES = `(min-width: ${webLayout.breakpoints[1]}px) ${webCuisineTile.sizeCompact}px, ${webCuisineTile.size}px`;

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
 * В тесном ряду (четырнадцать кухонь против десяти нарисованных) уменьшается
 * и подпись, и круг — 11/14 вместо 16/18 и 64 вместо 104. Числа посчитаны из
 * реальных ширин Noto Sans 500, разбор — в комментарии к `webCuisineTile`.
 * Мельче делаем ТОЛЬКО с `xl` (1280), и это не «на глаз». Ужимать подпись
 * имеет смысл ровно там, где это ПОМОГАЕТ уместить ряд. Контейнер отдаёт
 * 1200 только шире 1440, между 1024 и 1440 у него ещё поля `px-6`, и на 1024
 * ряду достаётся 976 при нужных 1127 — то есть на 1024 прокрутка всё равно
 * будет, и мелкий кегль там просто портит чтение. На 1280 доступно 1152, и
 * ряд помещается целиком.
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
      className="flex w-full flex-col items-center gap-cuisine-gap focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <span
        className={cx(
          "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full",
          "h-cuisine w-cuisine",
          compact && "xl:h-cuisine-compact xl:w-cuisine-compact",
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
            sizes={compact ? COMPACT_IMAGE_SIZES : DESIGN_IMAGE_SIZES}
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
          "w-full text-center text-ink [hyphens:none] [overflow-wrap:normal]",
          "text-cuisine-label",
          compact && "xl:text-cuisine-label-compact",
        )}
      >
        {cuisine.name}
      </span>
    </Link>
  );
}
