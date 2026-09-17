import type { FoodieOption } from "@bookeat/api";

/**
 * Фуди-профиль: гидрация «скрытого, но выбранного».
 *
 * `GET /foodie-profile/options` отдаёт только АКТИВНЫЕ варианты (спека
 * `foodie-profile-admin-dictionaries-20260916`, критерий 4) — админ мог
 * скрыть код, который у ЭТОГО гостя уже сохранён в профиле (сценарий 3.5).
 * Такой код не приходит в `options` вовсе, но гость не должен увидеть свой
 * прежний выбор просто пропавшим — задача прямо требует отрисовать его
 * отмеченным, пусть и без нормального контента плитки (нет имени/картинки
 * от справочника, ведь запись скрыта).
 *
 * Подмешивает в конец списка активных вариантов «осиротевшие» плитки —
 * синтетические записи для кодов из `selected`, которых нет среди `options`.
 * У осиротевшей записи `name = code` (единственное, что есть без активной
 * записи справочника — запасная подпись, а не пустой квадрат) и
 * `imageUrl` отсутствует (фото тоже неоткуда взять).
 *
 * НЕ делает скрытый вариант снова ПРЕДЛАГАЕМЫМ: осиротевшая плитка рисуется
 * только когда её код уже в `selected` — новый выбор её не находит, потому
 * что она не в `options` с сервера вовсе.
 */
export function withHiddenSelected<T extends FoodieOption>(
  options: readonly T[],
  selected: readonly string[],
): readonly T[] {
  const known = new Set(options.map((option) => option.code));
  const orphanCodes = selected.filter((code) => !known.has(code));
  if (orphanCodes.length === 0) return options;
  const orphans = orphanCodes.map(
    (code) =>
      ({
        id: code,
        code,
        name: code,
        displayOrder: Number.MAX_SAFE_INTEGER,
      }) as T,
  );
  return [...options, ...orphans];
}
