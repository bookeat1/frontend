"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { useAuth } from "@web/lib/auth";
import { useFavoriteIds, useToggleFavorite } from "@web/lib/queries";

/**
 * Сердце на карточке заведения — одно поведение на все три места, где оно
 * нарисовано: главная (узлы 3525:14214 и 3525:14246), выдача (3525:14495) и
 * шапка страницы заведения.
 *
 * Хук отдаёт ФАБРИКУ пропсов, а не пропсы: на экране карточек до сотни, а
 * запрос избранного и мутация должны быть общими на весь экран. Вызывать хук
 * внутри карточки значило бы завести по подписке на кэш на каждую.
 *
 * Гость без входа не получает кнопку-обманку: нажатие уводит на вход. Именно
 * push, а не replace, — чтобы «назад» вернуло его туда, где он смотрел
 * заведение.
 */
export function useFavoriteControl(): (id: string) => {
  favorite: boolean;
  onToggleFavorite: () => void;
} {
  const router = useRouter();
  const { signedIn } = useAuth();
  const favorites = useFavoriteIds();
  const toggle = useToggleFavorite();
  const saved = favorites.data;

  return useCallback(
    (id: string) => ({
      favorite: saved?.has(id) ?? false,
      onToggleFavorite: () => {
        if (!signedIn) {
          router.push("/login");
          return;
        }
        toggle.mutate({ id, next: !(saved?.has(id) ?? false) });
      },
    }),
    [saved, signedIn, router, toggle],
  );
}
