import * as SecureStore from "expo-secure-store";

/**
 * «Позже» в окне «Доступно обновление BookEat» — что именно оно означает во
 * времени.
 *
 * БЕЗ ЭТОГО ФАЙЛА «Позже» было бы обманом. Отказ, живущий только в памяти
 * процесса, снимает окно ровно до следующего холодного старта: гость,
 * закрывающий приложение после каждой брони, увидел бы одну и ту же просьбу
 * при каждом запуске, и кнопка «Позже» превратилась бы в «Ещё раз через
 * минуту». Поэтому отказ ЗАПИСЫВАЕТСЯ и переживает перезапуск.
 *
 * ЧТО ИМЕННО ХРАНИТСЯ. Одна запись `{ version, until }`:
 *
 *  - `version` — маркетинговая версия сборки, КОТОРАЯ ОТКАЗАЛАСЬ. Сервер в
 *    ответе `/app/version-check` не называет версию, до которой просит
 *    обновиться (`action` — единственное поле контракта, ADR-039), поэтому
 *    привязаться к «цели» нельзя. Зато можно привязаться к источнику: как
 *    только гость обновился, версия сборки другая, старый отказ перестаёт
 *    подходить и следующая просьба покажется сразу, а не досиживает сутки.
 *  - `until` — момент, после которого просить снова МОЖНО. Отказ не вечен:
 *    вечный отказ — это отключённая фича, которую никто не включал.
 *
 * ЧЕГО ЗДЕСЬ НЕТ И ПОЧЕМУ.
 *
 *  - Жёсткого режима (`action: "required"`). Он не читает эту запись вовсе:
 *    «Позже» у него нет ни на экране, ни в логике, и записанный вчера отказ
 *    от мягкой просьбы не имеет права проглотить сегодняшнее «дальше не
 *    пустим». Проверка живёт в `useAppUpdate` и закреплена тестом.
 *  - Обновления по воздуху (`kind: "restart"`). Его отказ намеренно остаётся
 *    в памяти: скачанный бандл применяется сам на следующем холодном старте,
 *    так что после перезапуска предлагать уже нечего — переживать перезапуск
 *    этой записи просто незачем.
 */

/** Ключ в хранилище. `v1` — если смысл записи изменится, ключ меняется, а не
 * переиспользуется молча (то же правило, что у `bookeat.notifications.v2`). */
export const UPDATE_SNOOZE_KEY = "bookeat.appUpdate.later.v1";

/**
 * Сколько молчать после «Позже» — сутки.
 *
 * Меньше (час) — это не «позже», а «через час», и гость увидит окно в тот же
 * вечер. Больше (неделя) — мягкая просьба перестаёт доходить, и остаётся
 * только жёсткий режим, то есть выбор между молчанием и стеной. Сутки дают
 * ровно одну просьбу в день на гостя, и включённый в панели порог доезжает до
 * всех за разумный срок без выкатки.
 */
export const UPDATE_SNOOZE_MS = 24 * 60 * 60 * 1000;

/** Записанный отказ. */
export interface UpdateSnooze {
  /** Версия сборки, которая отказалась. */
  version: string;
  /** Unix-время в миллисекундах: до этого момента не спрашиваем. */
  until: number;
}

/** Те три вызова хранилища, которые нужны этому модулю, — чтобы тест давал
 * своё хранилище, а не мокал нативный модуль (как в `notifications-pref.ts`). */
export interface SnoozeStorage {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync?(key: string): Promise<void>;
}

/**
 * Строка из хранилища → запись, или `null`.
 *
 * Любой мусор (не JSON, чужая форма, `until` не число) — это `null`, то есть
 * «отказа нет», то есть окно ПОКАЖЕТСЯ. Ошибка в эту сторону стоит гостю
 * одного лишнего окна; ошибка в обратную сторону прячет просьбу обновиться
 * навсегда и незаметно.
 */
export function parseSnooze(raw: string | null): UpdateSnooze | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const version = record.version;
  const until = record.until;
  if (typeof version !== "string" || version === "") return null;
  if (typeof until !== "number" || !Number.isFinite(until)) return null;
  return { version, until };
}

/**
 * Действует ли записанный отказ прямо сейчас.
 *
 * `false`, если запись от другой версии сборки (гость обновился — отказ
 * протух) или срок вышел.
 */
export function snoozeActive(
  snooze: UpdateSnooze | null,
  version: string,
  now: number,
): boolean {
  if (!snooze) return false;
  if (snooze.version !== version) return false;
  return now < snooze.until;
}

/** Прочитать отказ. Недоступное хранилище (веб, запертая связка ключей) — это
 * «отказа нет», а не падение. */
export async function readUpdateSnooze(
  storage: SnoozeStorage = SecureStore,
): Promise<UpdateSnooze | null> {
  try {
    return parseSnooze(await storage.getItemAsync(UPDATE_SNOOZE_KEY));
  } catch {
    return null;
  }
}

/** Записать отказ этой версии на `UPDATE_SNOOZE_MS` вперёд. Неудачная запись
 * стоит отказу только его долговечности, но не самого закрытия окна. */
export async function writeUpdateSnooze(
  version: string,
  now: number,
  storage: SnoozeStorage = SecureStore,
): Promise<UpdateSnooze> {
  const snooze: UpdateSnooze = { version, until: now + UPDATE_SNOOZE_MS };
  try {
    await storage.setItemAsync(UPDATE_SNOOZE_KEY, JSON.stringify(snooze));
  } catch {
    // Хранилище недоступно. Окно всё равно закрывается — за это отвечает
    // состояние в памяти, а не эта запись.
  }
  return snooze;
}
