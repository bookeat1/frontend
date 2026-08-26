"use client";

import { useState } from "react";

/**
 * Миниатюра по произвольному адресу — с честной заглушкой вместо дыры.
 *
 * ПОЧЕМУ ОБЫЧНЫЙ <img>, А НЕ next/image. Адреса приходят из БД: боевой бакет
 * R2 (`pub-…r2.dev`), старые ссылки на Supabase Storage, вручную вставленные
 * URL. Домены заранее не известны, а `next/image` требует их перечислить в
 * `images.remotePatterns` — то есть любая новая ссылка ломалась бы молча.
 *
 * ПОЧЕМУ ЗАПОМИНАЕМ АДРЕС, А НЕ ФЛАГ. Строка списка живёт дольше своих данных:
 * после `invalidateQueries` в той же строке может оказаться другая картинка.
 * Булев `failed` погасил бы и её, поэтому сравниваем именно упавший адрес —
 * то же правило, что в мобильном `PhotoView` (см. bugs/bookeat-frontend-
 * photo-404-hole-and-third-party-placeholder).
 *
 * ВЕС. Уменьшенных версий у ссылок нет: `*.r2.dev` не умеет преобразований по
 * адресу — `?width=…` игнорируется, `/cdn-cgi/image/…` отвечает 404 (проверено
 * curl-ом 2026-08-26). Значит браузер тянет оригинал и ужимает его при
 * отрисовке. Что можно сделать здесь — не качать то, что не видно:
 * `loading="lazy"` + `decoding="async"`.
 */
export interface ImageThumbProps {
  /** Адрес картинки. `null`/пустая строка = «фото нет». */
  url: string | null | undefined;
  /** Подпись для скринридера, когда картинка есть (например, название блюда). */
  alt: string;
  /** Русская подпись заглушки: она же и видимый текст, и имя для скринридера. */
  emptyLabel: string;
  /** Размер и форма коробки. Одинаковы для картинки и для заглушки. */
  className?: string;
}

export function ImageThumb({ url, alt, emptyLabel, className = "h-12 w-12" }: ImageThumbProps) {
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  const src = url?.trim() ? url.trim() : null;

  if (src === null || src === brokenUrl) {
    return (
      <span
        role="img"
        aria-label={emptyLabel}
        className={`flex shrink-0 items-center justify-center rounded-card border border-dashed border-text-muted/50 bg-chip px-xxs text-center text-[10px] font-medium leading-tight text-text-muted ${className}`}
      >
        {emptyLabel}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setBrokenUrl(src)}
      className={`shrink-0 rounded-card border border-hairline bg-chip object-cover ${className}`}
    />
  );
}
