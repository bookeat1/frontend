import type { FoodieProfile } from "@bookeat/api";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../lib/auth";
import {
  EMPTY_FOODIE_INVITE_STATE,
  foodieInviteAllowed,
  readFoodieInviteState,
  writeFoodieInviteDismiss,
  writeFoodieInviteHiddenForever,
  type FoodieInviteState,
} from "../lib/foodie-invite-snooze";

/** Пустой профиль — 5.4/критерий 22: ни одной кухни/диеты/аллергии и бюджет
 * не выбран. Тот же контракт, что `GET /users/me/foodie-profile` отдаёт
 * гостю, который визард ни разу не проходил. */
export function isEmptyFoodieProfile(profile: FoodieProfile): boolean {
  return (
    profile.cuisines.length === 0 &&
    profile.diets.length === 0 &&
    profile.allergies.length === 0 &&
    profile.budget === null
  );
}

export interface FoodieProfileInviteState {
  /** Показывать карточку-приглашение ПРЯМО СЕЙЧАС. */
  visible: boolean;
  /** Тап по крестику — закрывает немедленно и копит счётчик закрытий. */
  dismiss: () => void;
}

/**
 * Данные карточки-приглашения «Расскажите, что любите» (персонализация v1,
 * `specs/foodie-personalization-v1-20260916.md`, сценарий 3.2, критерий 22).
 *
 * ПОКАЗ: вошедший гость (иначе профиля нет вовсе — критерий 22 явно требует
 * «гость вошёл») с ПУСТЫМ профилем (5.4/`isEmptyFoodieProfile`), которому не
 * действует ни 30-дневный снуз, ни необратимое «профиль перестал быть
 * пустым» (см. `foodie-invite-snooze.ts`).
 *
 * ПРОВЕРКА «ПРОФИЛЬ ПЕРЕСТАЛ БЫТЬ ПУСТЫМ» — на КАЖДЫЙ успешный ответ `GET`,
 * не только пока карточка видна (задача явно требует эту разницу): гость мог
 * заполнить профиль из «Профиля», минуя эту карточку целиком, и следующий
 * заход на главную обязан больше её не предлагать.
 *
 * `dismiss()` закрывает карточку СРАЗУ через состояние в памяти
 * (`closedThisSession`), запись в хранилище — только про то, увидит ли гость
 * её снова в следующий раз (тот же принцип, что у `useAppUpdate`/«Позже»).
 */
export function useFoodieProfileInvite(): FoodieProfileInviteState {
  const { status, repository } = useAuth();

  const profileQuery = useQuery<FoodieProfile>({
    // ТОТ ЖЕ ключ, что визард (`foodie-profile-draft.tsx`) — если гость уже
    // открывал визард в этой сессии, здесь кэш-хит, а не второй запрос.
    queryKey: ["foodie-profile"],
    queryFn: () => repository.getFoodieProfile(),
    enabled: status === "signed-in",
    staleTime: 5 * 60_000,
  });

  const [snooze, setSnooze] = useState<{ loaded: boolean; value: FoodieInviteState }>({
    loaded: false,
    value: EMPTY_FOODIE_INVITE_STATE,
  });
  const [closedThisSession, setClosedThisSession] = useState(false);

  useEffect(() => {
    let alive = true;
    void readFoodieInviteState().then((value) => {
      if (alive) setSnooze({ loaded: true, value });
    });
    return () => {
      alive = false;
    };
  }, []);

  // «Профиль перестал быть пустым» → скрыть навсегда. Один раз за КАЖДЫЙ
  // непустой ответ, не за каждый рендер — `hiddenWritten` — это про то же
  // самое значение профиля, не про сам факт непустоты вообще (перечитанный
  // непустой профиль после смены языка не должен писать в хранилище снова).
  const hiddenWritten = useRef<FoodieProfile | null>(null);
  useEffect(() => {
    const profile = profileQuery.data;
    if (!profile || isEmptyFoodieProfile(profile)) return;
    if (hiddenWritten.current === profile) return;
    hiddenWritten.current = profile;
    void writeFoodieInviteHiddenForever().then((value) => setSnooze({ loaded: true, value }));
  }, [profileQuery.data]);

  const dismiss = useCallback(() => {
    setClosedThisSession(true);
    void writeFoodieInviteDismiss(snooze.value, Date.now()).then((value) =>
      setSnooze({ loaded: true, value }),
    );
  }, [snooze.value]);

  const visible =
    !closedThisSession &&
    status === "signed-in" &&
    snooze.loaded &&
    profileQuery.isSuccess &&
    isEmptyFoodieProfile(profileQuery.data) &&
    foodieInviteAllowed(snooze.value, Date.now());

  return { visible, dismiss };
}
