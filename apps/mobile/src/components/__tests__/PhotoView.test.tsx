/**
 * BUG THIS FILE HOLDS: см. lib/__tests__/photo-source.test.ts — фото, которого
 * больше нет в бакете, оставляло в списке дыру. Там проверяется правило, здесь
 * — что компонент действительно по нему живёт: что он подписан на отказ, что
 * после отказа он рисует ту же самую плашку «фото нет», и что он не пытается
 * загрузить тот же адрес снова.
 *
 * У слота теперь ДВА адреса: сперва уменьшенная копия, за ней оригинал. Поэтому
 * «фото не загрузилось» здесь — это два отказа подряд, а не один. Первый отказ
 * обязан быть незаметен для гостя: он видит фото, просто оригинального размера.
 *
 * Что тут НЕ проверяется и проверено быть не может: сам кэш. `cachePolicy`,
 * `recyclingKey` и плавное появление — нативное поведение expo-image, которого
 * в jsdom нет (см. test/stubs/expo-image.tsx). Тест утверждает только то, что
 * приложение эти значения просит; работают ли они — вопрос к телефону.
 */
import { fireEvent, render } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { PHOTO_BUCKET_BASE } from "../../lib/photo-source";
import { PhotoView } from "../PhotoView";

const URI = `${PHOTO_BUCKET_BASE}restaurants/a/1.webp`;
const OTHER = `${PHOTO_BUCKET_BASE}restaurants/b/2.webp`;
const FULL = `${PHOTO_BUCKET_BASE}derived/w1280/restaurants/a/1.webp.jpg`;
const TILE = `${PHOTO_BUCKET_BASE}derived/w640/restaurants/a/1.webp.jpg`;

const image = (c: HTMLElement) => c.querySelector<HTMLImageElement>('[data-testid="photo-image"]');
const placeholder = (c: HTMLElement) => c.querySelector('[data-testid="photo-placeholder"]');
const src = (c: HTMLElement) => image(c)?.getAttribute("src");

describe("PhotoView", () => {
  it("по умолчанию просит уменьшенную копию, а не загруженный оригинал", () => {
    // Ради этого вся задача: карточка высотой 148pt не должна тянуть 7 МБ.
    const { container } = render(<PhotoView uri={URI} style={{}} />);
    expect(src(container)).toBe(FULL);
  });

  it("маленькая плитка просит копию поменьше", () => {
    const { container } = render(<PhotoView uri={URI} style={{}} size="tile" />);
    expect(src(container)).toBe(TILE);
  });

  it("копии ещё нет — гость видит оригинал, а не дырку", () => {
    // Копии генерируются пачкой; фото, залитое после последнего прогона, копии
    // не имеет. Отказ копии обязан быть незаметен.
    const { container } = render(<PhotoView uri={URI} style={{}} />);
    fireEvent.error(image(container) as HTMLImageElement);

    expect(placeholder(container)).toBeNull();
    expect(src(container)).toBe(URI);
  });

  it("фото, которого нет ни в одном размере, превращается в плашку «фото нет»", () => {
    const { container } = render(<PhotoView uri={URI} alt="Зал ресторана" style={{}} />);
    expect(image(container)).not.toBeNull();
    expect(placeholder(container)).toBeNull();

    fireEvent.error(image(container) as HTMLImageElement); // копия
    fireEvent.error(image(container) as HTMLImageElement); // оригинал

    expect(image(container)).toBeNull();
    expect(placeholder(container)).not.toBeNull();
  });

  it("заведение без фото и заведение с упавшим фото выглядят одинаково", () => {
    // Гость не может их различить, и мы тоже: одна плашка на оба случая, а не
    // две разные заглушки.
    const withPhoto = render(<PhotoView uri={URI} style={{}} />);
    fireEvent.error(image(withPhoto.container) as HTMLImageElement);
    fireEvent.error(image(withPhoto.container) as HTMLImageElement);
    const failed = placeholder(withPhoto.container)?.outerHTML;

    const withoutPhoto = render(<PhotoView uri={undefined} style={{}} />);
    const absent = placeholder(withoutPhoto.container)?.outerHTML;

    expect(failed).toBeTruthy();
    expect(failed).toBe(absent);
  });

  it("после отказа тот же адрес не запрашивается снова", () => {
    const { container, rerender } = render(<PhotoView uri={URI} style={{}} />);
    fireEvent.error(image(container) as HTMLImageElement);
    fireEvent.error(image(container) as HTMLImageElement);

    rerender(<PhotoView uri={URI} style={{}} />);

    expect(image(container)).toBeNull();
  });

  it("отказавшая копия и отказавший оригинал не уступают очередь друг другу", () => {
    // Если бы компонент помнил только последний упавший адрес, он бесконечно
    // ходил бы по кругу «копия → оригинал → копия» за счёт трафика гостя.
    const { container, rerender } = render(<PhotoView uri={URI} style={{}} />);
    fireEvent.error(image(container) as HTMLImageElement);
    fireEvent.error(image(container) as HTMLImageElement);

    rerender(<PhotoView uri={URI} style={{}} />);
    rerender(<PhotoView uri={URI} style={{}} />);

    expect(image(container)).toBeNull();
    expect(placeholder(container)).not.toBeNull();
  });

  it("следующее заведение в переиспользованной строке получает свой шанс", () => {
    const { container, rerender } = render(<PhotoView uri={URI} style={{}} />);
    fireEvent.error(image(container) as HTMLImageElement);
    fireEvent.error(image(container) as HTMLImageElement);

    rerender(<PhotoView uri={OTHER} style={{}} />);

    expect(src(container)).toBe(`${PHOTO_BUCKET_BASE}derived/w1280/restaurants/b/2.webp.jpg`);
  });

  it("просит кэш в памяти и на диске и ключ переиспользования", () => {
    const { container } = render(<PhotoView uri={URI} style={{}} />);
    const img = image(container) as HTMLImageElement;
    expect(img.getAttribute("data-cache-policy")).toBe("memory-disk");
    // Ключ — это адрес, который реально показывается, иначе строка списка не
    // сбросит старый bitmap при переходе с копии на оригинал.
    expect(img.getAttribute("data-recycling-key")).toBe(FULL);
    expect(img.getAttribute("data-transition")).toBe("150");
  });

  it("декоративное фото не объявляется скринридеру дважды", () => {
    // Подпись уже несёт карточка вокруг; «изображение» вторым голосом — шум.
    const { container } = render(<PhotoView uri={URI} alt="Зал" style={{}} decorative />);
    expect(image(container)?.getAttribute("aria-label")).toBeNull();

    const labelled = render(<PhotoView uri={URI} alt="Зал" style={{}} />);
    expect(image(labelled.container)?.getAttribute("aria-label")).toBe("Зал");
  });
});
