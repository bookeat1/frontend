import type { AppUpdateDecision, LocalizedText } from "@bookeat/api";
import type { Dictionary, Locale } from "@bookeat/i18n";

/**
 * «Доступна новая версия» — что именно показать гостю.
 *
 * Случаев ДВА, и они про разные вещи:
 *
 *   - `"store"` — в магазине лежит новая СБОРКА. Решение принимает сервер
 *     (`GET /app/version-check`, ADR-039): нативную часть по воздуху доставить
 *     нельзя, поэтому «попросить» и «не пускать дальше» переключаются из
 *     панели без релиза. Кнопка ведёт в App Store / Google Play, приложение
 *     обновить себя не может.
 *   - `"restart"` — обновление по воздуху (expo-updates) уже СКАЧАНО на
 *     телефон и ждёт следующего холодного старта. Приложение может применить
 *     его само, кнопка перезапускает бандл. Магазин тут ни при чём.
 *
 * Ветки не смешиваются: у них разная кнопка и разная цена для гостя (уход в
 * магазин против мгновенного перезапуска), и обещать «обновим сейчас» там, где
 * нужен магазин, — вранье.
 */
export type UpdatePromptKind = "store" | "restart";

export interface UpdatePrompt {
  kind: UpdatePromptKind;
  title: string;
  message: string;
  /**
   * `true` — закрыть нельзя: сборка ниже минимально поддерживаемой
   * (`action: "required"`). Крестика, кнопки «Позже», тапа по подложке и
   * аппаратной «назад» у такого окна нет.
   */
  blocking: boolean;
  /** Куда ведёт кнопка в случае `"store"`. У `"restart"` её нет. */
  storeUrl?: string;
}

/**
 * Достаёт текст на языке интерфейса из объекта `{ru,kk,en}`, который прислал
 * сервер.
 *
 * Порядок: выбранный язык → русский (база, всегда заполнена в панели) →
 * `fallback` из словаря приложения. Последняя ступень обязательна: у
 * приложения ВОСЕМЬ языков, а у политики на сервере — три, поэтому гость с
 * корейским интерфейсом иначе увидел бы русский текст там, где у нас есть свой
 * перевод.
 *
 * Пустая строка на любой ступени считается отсутствием — иначе пустой перевод
 * в панели давал бы диалог без заголовка.
 */
export function resolveServerText(
  map: LocalizedText | undefined,
  locale: Locale,
  fallback: string,
): string {
  const chosen = map?.[locale]?.trim();
  if (chosen) return chosen;
  const russian = map?.ru?.trim();
  if (russian) return russian;
  return fallback;
}

/**
 * Ответ сервера → окно (или `null`, если показывать нечего).
 *
 * `action: "none"` и незнакомое значение — это `null`. Незнакомое значение до
 * сюда доехать не должно (маппер в @bookeat/api сводит его к `"none"`), но
 * ветка `default` оставлена явной: молчание — единственный безопасный ответ на
 * то, чего мы не поняли.
 *
 * Ссылка на магазин ОБЯЗАТЕЛЬНА для показа. Окно без неё — это либо кнопка,
 * которая никуда не ведёт, либо, в режиме `required`, запертый гость без
 * единого выхода: политику завели, `store_url` заполнить забыли. Молчим.
 */
export function storeUpdatePrompt(
  decision: AppUpdateDecision,
  locale: Locale,
  t: Dictionary,
): UpdatePrompt | null {
  if (decision.action === "none") return null;
  const storeUrl = decision.storeUrl?.trim();
  if (!storeUrl) return null;

  const required = decision.action === "required";
  return {
    kind: "store",
    title: resolveServerText(
      decision.title,
      locale,
      required ? t.appUpdate.requiredTitle : t.appUpdate.title,
    ),
    message: resolveServerText(
      decision.message,
      locale,
      required ? t.appUpdate.requiredMessage : t.appUpdate.message,
    ),
    blocking: required,
    storeUrl,
  };
}

/**
 * Скачанное обновление по воздуху → окно.
 *
 * Оно всегда закрываемое: JS уже лежит на телефоне и применится сам на
 * следующем холодном старте, так что «Позже» ничего не ломает и ничего не
 * теряет. Заголовок и текст — свои, из словаря: сервер про этот случай не
 * знает вовсе.
 */
export function restartUpdatePrompt(t: Dictionary): UpdatePrompt {
  return {
    kind: "restart",
    title: t.appUpdate.title,
    message: t.appUpdate.restartMessage,
    blocking: false,
  };
}

/**
 * Какое из двух окон показать, когда сработали оба.
 *
 * Магазин ВАЖНЕЕ: обновление по воздуху не довозит нативную часть, поэтому
 * перезапуск не решает проблему, из-за которой сервер просит новую сборку. А
 * `required` вообще нельзя перебить ничем.
 */
export function pickPrompt(
  store: UpdatePrompt | null,
  restart: UpdatePrompt | null,
): UpdatePrompt | null {
  return store ?? restart;
}
