"use client";

import Image from "next/image";
import { useState } from "react";

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
  className?: string;
}

export function RemoteImage({ src, alt, sizes, priority = false, className }: RemoteImageProps) {
  const [broken, setBroken] = useState(false);
  const url = src?.trim() ? src.trim() : null;

  if (!url || broken) {
    // Пустая подложка, а не «нет фото» словами: подпись на месте каждой
    // отсутствующей картинки в сетке из двадцати карточек — это шум.
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
