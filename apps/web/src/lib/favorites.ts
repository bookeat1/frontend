"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback } from "react";

import { useAuth } from "@web/lib/auth";
import { useFavoriteIds, useToggleFavorite } from "@web/lib/queries";
import { currentPathForReturn, loginHref } from "@web/lib/return-to";

/** Что карточка получает, чтобы нарисовать сердце и обработать нажатие. */
export interface FavoriteControlProps {
  favorite: boolean;
  /** Запрос по ЭТОЙ карточке в полёте: кнопка на это время заблокирована. */
  favoritePending: boolean;
  onToggleFavorite: () => void;
}

/**
 * Сердце на карточке заведения — одно поведение на все места, где оно
 * нарисовано: главная (узлы 3525:14214 и 3525:14246 файла
 * `QovvuAoI9YxsLMwWkfgKN8`) и выдача (3525:14495).
 *
 * Хук отдаёт ФАБРИКУ пропсов, а не пропсы: на экране карточек до сотни, а
 * запрос избранного и мутация должны быть общими на весь экран. Вызывать хук
 * внутри карточки значило бы завести по подписке на кэш на каждую.
 *
 * Гость без входа не получает кнопку-обманку: нажатие уводит на вход И
 * ЗАПОМИНАЕТ, откуда он ушёл, — иначе после ввода кода он оказывается на
 * главной, а заведение, ради которого всё затевалось, остаётся позади. Адрес
 * возврата берётся из `window.location` в момент НАЖАТИЯ: он включает строку
 * поиска (на выдаче это выбранные фильтры), и, в отличие от разметки, в
 * обработчике события расхождения с сервером быть не может.
 *
 * `push`, а не `replace`, — чтобы «назад» с экрана входа вернуло гостя туда,
 * где он смотрел заведение.
 */
export function useFavoriteControl(): (id: string) => FavoriteControlProps {
  const router = useRouter();
  const { signedIn } = useAuth();
  const favorites = useFavoriteIds();
  const toggle = useToggleFavorite();
  const saved = favorites.data;
  // Зависимость — САМА ФУНКЦИЯ мутации: она стабильна между рендерами, а
  // объект `toggle` новый каждый раз, и мемоизация по нему не работала бы
  // никогда. `variables` читаем через тот же объект, но уже внутри вызова.
  const mutate = toggle.mutate;
  const pendingId = toggle.isPending ? toggle.variables?.id : undefined;

  return useCallback(
    (id: string) => ({
      favorite: saved?.has(id) ?? false,
      favoritePending: pendingId === id,
      onToggleFavorite: () => {
        if (!signedIn) {
          router.push(loginHref(currentPathForReturn()));
          return;
        }
        mutate({ id, next: !(saved?.has(id) ?? false) });
      },
    }),
    [saved, signedIn, router, mutate, pendingId],
  );
}

/**
 * Адрес экрана входа для ССЫЛКИ (кнопка «Сохранить» в шапке заведения).
 *
 * Здесь `usePathname()`, а не `window.location`: значение попадает в разметку,
 * а она собирается и на сервере тоже. Строка поиска при этом теряется — на
 * странице заведения её нет, и обмен честный; в обработчиках событий
 * (`useFavoriteControl`) сохраняется полный адрес.
 */
export function useLoginHref(): string {
  const pathname = usePathname();
  return loginHref(pathname);
}
