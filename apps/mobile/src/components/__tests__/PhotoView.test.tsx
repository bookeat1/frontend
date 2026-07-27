/**
 * BUG THIS FILE HOLDS: см. lib/__tests__/photo-source.test.ts — фото, которого
 * больше нет в бакете, оставляло в списке дыру. Там проверяется правило, здесь
 * — что компонент действительно по нему живёт: что он подписан на отказ, что
 * после отказа он рисует ту же самую плашку «фото нет», и что он не пытается
 * загрузить тот же адрес снова.
 *
 * Что тут НЕ проверяется и проверено быть не может: сам кэш. `cachePolicy`,
 * `recyclingKey` и плавное появление — нативное поведение expo-image, которого
 * в jsdom нет (см. test/stubs/expo-image.tsx). Тест утверждает только то, что
 * приложение эти значения просит; работают ли они — вопрос к телефону.
 */
import { fireEvent, render } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { PhotoView } from "../PhotoView";

const URI = "https://pub-41b6f06fc8e74b6e959cdd6def081e22.r2.dev/restaurants/a/1.webp";
const OTHER = "https://pub-41b6f06fc8e74b6e959cdd6def081e22.r2.dev/restaurants/b/2.webp";

const image = (c: HTMLElement) => c.querySelector<HTMLImageElement>('[data-testid="photo-image"]');
const placeholder = (c: HTMLElement) => c.querySelector('[data-testid="photo-placeholder"]');

describe("PhotoView", () => {
  it("фото, которое отдалось 404, превращается в плашку «фото нет»", () => {
    const { container } = render(<PhotoView uri={URI} alt="Зал ресторана" style={{}} />);
    expect(image(container)).not.toBeNull();
    expect(placeholder(container)).toBeNull();

    fireEvent.error(image(container) as HTMLImageElement);

    expect(image(container)).toBeNull();
    expect(placeholder(container)).not.toBeNull();
  });

  it("заведение без фото и заведение с упавшим фото выглядят одинаково", () => {
    // Гость не может их различить, и мы тоже: одна плашка на оба случая, а не
    // две разные заглушки.
    const withPhoto = render(<PhotoView uri={URI} style={{}} />);
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

    rerender(<PhotoView uri={URI} style={{}} />);

    expect(image(container)).toBeNull();
  });

  it("следующее заведение в переиспользованной строке получает свой шанс", () => {
    const { container, rerender } = render(<PhotoView uri={URI} style={{}} />);
    fireEvent.error(image(container) as HTMLImageElement);

    rerender(<PhotoView uri={OTHER} style={{}} />);

    expect(image(container)?.getAttribute("src")).toBe(OTHER);
  });

  it("просит кэш в памяти и на диске и ключ переиспользования", () => {
    const { container } = render(<PhotoView uri={URI} style={{}} />);
    const img = image(container) as HTMLImageElement;
    expect(img.getAttribute("data-cache-policy")).toBe("memory-disk");
    expect(img.getAttribute("data-recycling-key")).toBe(URI);
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
