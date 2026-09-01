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
}

export function RemoteImage({
  src,
  alt,
  sizes,
  priority = false,
  fallback,
  className,
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
      priority={priority}
      loading={priority ? undefined : "lazy"}
      onError={() => setBroken(true)}
      className={cx("object-cover", className)}
    />
  );
}
