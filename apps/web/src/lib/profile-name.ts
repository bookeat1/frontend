/**
 * `PATCH /users/me` знает только `full_name` целиком — `packages/api/src/types.ts`
 * (`ProfileUpdate`) не содержит отдельных «имя»/«фамилия», в точности как
 * `apps/mobile/src/lib/profile-edit.ts` (`ProfileDraft.fullName`, одно поле).
 * Форма «Настройки» на вебе (узел 5115:9023) рисует ДВА поля — режем строку
 * по первому пробелу для показа и склеиваем обратно перед отправкой.
 *
 * Это НЕ то же самое, что отдельное поле фамилии на сервере: гость с именем
 * «Анна-Мария Ким-Ли» получит «Анна-Мария» в первом поле и «Ким-Ли» во
 * втором, и наоборот, гость, который впишет три слова, отправит их все —
 * сервер просто хранит `full_name` строкой и не проверяет её форму.
 */
export interface SplitName {
  firstName: string;
  lastName: string;
}

export function splitFullName(fullName: string): SplitName {
  const trimmed = fullName.trim();
  if (trimmed === "") return { firstName: "", lastName: "" };
  const spaceIndex = trimmed.indexOf(" ");
  if (spaceIndex === -1) return { firstName: trimmed, lastName: "" };
  return {
    firstName: trimmed.slice(0, spaceIndex).trim(),
    lastName: trimmed.slice(spaceIndex + 1).trim(),
  };
}

export function joinFullName({ firstName, lastName }: SplitName): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
}
