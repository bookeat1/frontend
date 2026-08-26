import { describe, expect, it } from "vitest";
import { mapRestaurantStories, type ApiStory } from "../http-mapping";

/**
 * `action_url` — единственное поле истории, которое уезжает прямиком в
 * `Linking.openURL`. Поэтому граница проверяется здесь, в маппере, а не в
 * экране: до экрана обязано доезжать либо http(s)-адрес, либо `null`.
 *
 * Поле пришло с бэкенда 2026-08-26 и НЕОБЯЗАТЕЛЬНОЕ: старая сборка сервера
 * его не присылает вовсе.
 */
const story = (overrides: Partial<ApiStory> = {}): ApiStory => ({
  id: "s-1",
  image_url: "https://cdn.book-eat.com/story-1.jpg",
  caption: "Сладкий четверг",
  sort_order: 0,
  ...overrides,
});

describe("mapRestaurantStories: ссылка истории", () => {
  it("http(s)-адрес доезжает до экрана как есть", () => {
    const [mapped] = mapRestaurantStories([
      story({ action_url: "https://book-eat.com/promo" }),
    ]);
    expect(mapped.actionUrl).toBe("https://book-eat.com/promo");
  });

  it("http:// тоже проходит — не всякий сайт партнёра на https", () => {
    const [mapped] = mapRestaurantStories([story({ action_url: "http://book-eat.com/promo" })]);
    expect(mapped.actionUrl).toBe("http://book-eat.com/promo");
  });

  it("ссылки нет — null, и это обычный случай", () => {
    expect(mapRestaurantStories([story({ action_url: null })])[0].actionUrl).toBeNull();
    expect(mapRestaurantStories([story({ action_url: "   " })])[0].actionUrl).toBeNull();
    // Старая сборка сервера поля вообще не присылает.
    expect(mapRestaurantStories([story()])[0].actionUrl).toBeNull();
  });

  it("всё, что не http(s), становится null — до openURL такое не доедет", () => {
    for (const bad of [
      "javascript:alert(1)",
      "tel:+77075474747",
      "file:///etc/passwd",
      "book-eat.com/promo", // без схемы: достраивать нельзя, опечатка уведёт к чужому сайту
      "смотрите у нас в инстаграме",
    ]) {
      expect(mapRestaurantStories([story({ action_url: bad })])[0].actionUrl).toBeNull();
    }
  });

  it("плохая ссылка НЕ выкидывает историю — теряется только ссылка, картинка остаётся", () => {
    const mapped = mapRestaurantStories([story({ action_url: "javascript:alert(1)" })]);
    expect(mapped).toHaveLength(1);
    expect(mapped[0].imageUrl).toBe("https://cdn.book-eat.com/story-1.jpg");
    expect(mapped[0].actionUrl).toBeNull();
  });
});
