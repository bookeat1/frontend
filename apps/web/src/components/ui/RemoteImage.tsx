"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";

import { cx } from "@web/lib/cx";

/**
 * Фотография с сервера.
 *
 * Два случая, из-за которых нельзя просто поставить <Image src=…>:
 *   1. адреса может не быть вовсе (у заведения нет обложки) —
 *   2. адрес может быть битым (файл удалили из бакета).
 * И в том, и в другом случае на месте картинки остаётся серая подложка ТОЙ ЖЕ
 * высоты: вёрстка не должна знать, доехало фото или нет.
 *
 * Всегда `fill` — размер задаёт родитель (у него фиксированная высота или
 * пропорция из макета), а `sizes` говорит браузеру, какой ширины картинка
 * будет на самом деле.
 */
export interface RemoteImageProps {
  src?: string | null;
  alt: string;
  /** Ширины из макета, например "(min-width: 1280px) 282px, 25vw". */
  sizes: string;
  /** Первый экран — грузим сразу, остальное лениво. */
  priority?: boolean;
  /**
   * Что показать вместо картинки, когда её нет или она не загрузилась.
   *
   * По умолчанию — пустая подложка: подпись на месте каждой отсутствующей
   * фотографии в сетке из двадцати карточек это шум. Но у ОДИНОЧНОГО крупного
   * блока (карта в контактах — 788×280) пустая подложка читается как дырка в
   * странице, и там объяснение нужно. Поэтому это проп, а не поведение по
   * умолчанию.
   */
  fallback?: ReactNode;
  className?: string;
  /**
   * `"cover"` (по умолчанию) — фото обрезается по контейнеру, как раньше.
   *
   * `"letterboxed"` — двухслойный вид как в превью Instagram Stories: снизу
   * та же картинка растянута на весь контейнер (`object-fit: cover`) с
   * сильным блюром и лёгким затемнением — только чтобы не спорить по
   * контрасту с текстом, который рисуется поверх отдельным HTML-слоем
   * (заголовок/бейдж в `EventScreen`/`PromoScreen`); сверху — та же
   * картинка целиком (`object-fit: contain`), без обрезки, независимо от
   * пропорций. Нужно там, где источник — портретный сторис-постер с текстом,
   * вплавленным в саму картинку: `object-cover` отрезает верх/низ, где
   * обычно весь текст (живые случаи на проде, 2026-09-15). Для альбомного
   * фото с пропорцией, близкой к контейнеру, `contain` заполняет почти всю
   * площадь и разница с обычным `cover` почти незаметна — это ожидаемо.
   */
  fit?: "cover" | "letterboxed";
}

export function RemoteImage({
  src,
  alt,
  sizes,
  priority = false,
  fallback,
  className,
  fit = "cover",
}: RemoteImageProps) {
  const [broken, setBroken] = useState(false);
  const url = src?.trim() ? src.trim() : null;

  if (!url || broken) {
    if (fallback) {
      return (
        <div
          className={cx(
            "flex h-full w-full items-center justify-center bg-muted p-4 text-center",
            className,
          )}
        >
          {fallback}
        </div>
      );
    }
    return <div aria-hidden="true" className={cx("h-full w-full bg-muted", className)} />;
  }

  const loadingProp = { priority, loading: priority ? undefined : ("lazy" as const) };

  if (fit === "letterboxed") {
    return (
      <div className={cx("absolute inset-0 overflow-hidden", className)}>
        <Image
          src={url}
          alt=""
          aria-hidden="true"
          fill
          sizes={sizes}
          unoptimized
          {...loadingProp}
          className="scale-110 object-cover blur-[28px] brightness-[0.6]"
        />
        <Image
          src={url}
          alt={alt}
          fill
          sizes={sizes}
          unoptimized
          {...loadingProp}
          onError={() => setBroken(true)}
          className="object-contain"
        />
      </div>
    );
  }

  return (
    <Image
      src={url}
      alt={alt}
      fill
      sizes={sizes}
      // Наш загрузчик отдаёт один и тот же адрес на любую ширину (менять
      // размер картинки в чужом бакете мы не можем), поэтому без этого флага
      // Next печатает `srcSet` из шестнадцати одинаковых ссылок — около
      // килограмма разметки на каждую фотографию и ноль пользы.
      unoptimized
      {...loadingProp}
      onError={() => setBroken(true)}
      className={cx("object-cover", className)}
    />
  );
}
