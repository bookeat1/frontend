import type { FoodieProfile } from "@bookeat/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useFoodieOptions } from "../hooks/useFoodieOptions";
import { useAuth } from "./auth";
import {
  toggleAllergySelection,
  toggleBudgetSelection,
  toggleCuisineSelection,
  toggleDietSelection,
  type BudgetTier,
} from "./foodie-profile-selection";

/**
 * Локальное состояние визарда «Фуди-профиль», общее для всех четырёх шагов
 * (`app/foodie-profile/{cuisine,diet,allergies,budget}.tsx`).
 *
 * МЕХАНИЗМ СОСТОЯНИЯ — React Context, смонтированный на
 * `app/foodie-profile/_layout.tsx`, а не параметры роута. Тот же паттерн, что
 * `BookingDraftProvider` у флоу брони
 * (`app/restaurant/[id]/book/_layout.tsx`): черновик рождается, когда гость
 * входит в группу маршрутов, и выбрасывается, когда выходит. Причины
 * предпочесть его query-параметрам (`useLocalSearchParams`) для ЭТОГО флоу:
 *
 *   - шаг 1 копит МАССИВ (до 5 кухонь) — сериализовать его в URL и парсить на
 *     каждом шаге дешевле не сделать, а cardinality набора уже выражена типом
 *     здесь;
 *   - навигация внутри визарда — `router.push`, и при обычном query-подходе
 *     каждый следующий шаг обязан вручную протащить ВСЕ параметры предыдущих
 *     через URL, иначе `router.back()` их потеряет; с контекстом это не нужно
 *     вовсе.
 *
 * СОХРАНЕНИЕ НА БЭКЕНД (задача 2026-09-16, эндпоинт `GET/PUT
 * /users/me/foodie-profile` теперь существует — bookeat-backend
 * feat/foodie-profile-backend). Провайдер сам:
 *
 *   1. при монтировании читает сохранённый профиль (`GET`) и заполняет им
 *      черновик — если гость открывает визард повторно, он видит свой
 *      прежний выбор, а не пустые экраны. Если гость успел тапнуть по
 *      плитке раньше, чем ответ GET пришёл, прилетевший ответ НЕ перетирает
 *      именно ту категорию, которую он тронул — остальные три всё равно
 *      гидрируются из ответа. Отслеживается ПОКАТЕГОРИЙНО (`cuisinesTouched`
 *      / `dietsTouched` / `allergiesTouched` / `budgetTouched`), не одним
 *      общим флагом — иначе тап по одной плитке молча блокирует гидрацию
 *      всех остальных трёх категорий (регрессия ревью PR #225, раунд 2);
 *
 *      ГИДРАЦИЯ ОТБРАСЫВАЕТ СКРЫТЫЕ КОДЫ (спека
 *      foodie-profile-admin-dictionaries-20260916, §3.5: «новый клиент не
 *      находит `spicy` среди активных и не рисует», критерий 20/22).
 *      Провайдер сверяет `saved.*` с `useFoodieOptions()` (живой справочник,
 *      `GET /foodie-profile/options`) и в черновик кладёт только коды,
 *      которые сервер СЕЙЧАС считает активными — код, который админ скрыл
 *      после того, как гость его выбрал, просто не попадает в состояние
 *      визарда вовсе (не рисуется плиткой и не улетит следующим `PUT`).
 *      Это чисто гидрация ЧЕРНОВИКА визарда — сохранённый на сервере профиль
 *      гостя эта фильтрация не трогает: пока гость не нажал «Готово» ещё
 *      раз, скрытый код у него на сервере остаётся и продолжает считаться в
 *      `LoadTasteProfile` (критерий 12 — это бэкендовая, а не эта, забота).
 *      Пока справочник (`useFoodieOptions()`) ещё не загрузился, фильтр не
 *      применяется вовсе (нечем сверять) — категория гидрируется как есть и
 *      будет отфильтрована повторным проходом эффекта, когда справочник
 *      подъедет;
 *   2. на последнем шаге (`budget.tsx`) отдаёт `save()`, которая шлёт весь
 *      черновик одним `PUT` (replace, не merge) и возвращает `true`/`false`,
 *      чтобы экран уходил на `/profile` только при успехе.
 */

export interface FoodieProfileDraft {
  cuisines: readonly string[];
  diets: readonly string[];
  allergies: readonly string[];
  budget: BudgetTier | null;
}

const EMPTY_DRAFT: FoodieProfileDraft = { cuisines: [], diets: [], allergies: [], budget: null };

function toWireProfile(draft: FoodieProfileDraft): FoodieProfile {
  return {
    cuisines: [...draft.cuisines],
    diets: [...draft.diets],
    allergies: [...draft.allergies],
    budget: draft.budget,
  };
}

interface FoodieProfileDraftValue {
  draft: FoodieProfileDraft;
  /** Тап по плитке кухни. Возвращает `blockedByLimit`, чтобы экран показал
   * подсказку лимита вместо молчаливого игнора шестого тапа. */
  toggleCuisine(id: string): { blockedByLimit: boolean };
  toggleDiet(id: string): void;
  toggleAllergy(id: string): void;
  setBudget(tier: BudgetTier): void;
  /** Идёт первоначальная загрузка сохранённого профиля (`GET`). Последний шаг
   * визарда ОБЯЗАН с ней считаться — пока не пришёл первый успешный ответ,
   * `save()` может стереть ранее сохранённые категории, отправив на бэкенд
   * пустой/неполный черновик вместо того, что гость выбрал раньше (`PUT`
   * заменяет, а не мержит). */
  isLoadingProfile: boolean;
  /** `GET /users/me/foodie-profile` завершился ошибкой и ещё ни разу не
   * приходил успешно в этой сессии визарда. Пока это true, `save()`
   * отклоняется без запроса — см. комментарий у `save` ниже. */
  profileLoadFailed: boolean;
  /** Повторяет `GET /users/me/foodie-profile` — вызывается кнопкой
   * «Повторить» рядом с сообщением о `profileLoadFailed`. */
  retryLoadProfile(): void;
  /** Идёт сохранение (`PUT`) — последний шаг должен блокировать повторный тап
   * «Готово», пока это true. */
  isSaving: boolean;
  /** Последний вызов `save()` завершился ошибкой. Сбрасывается следующим
   * вызовом `save()`. */
  saveFailed: boolean;
  /**
   * Отправляет весь черновик на `PUT /users/me/foodie-profile`. Возвращает
   * `true` при успехе — вызывающий экран должен уходить дальше только тогда,
   * иначе оставлять гостя на экране с `saveFailed`.
   *
   * ОТКАЗЫВАЕТ (возвращает `false` без сетевого запроса), пока исходный
   * `GET` ещё не завершился успешно хотя бы раз в этой сессии визарда
   * (`profileQuery.isSuccess === false` — НЕ `isLoadingProfile ||
   * profileLoadFailed`: в TanStack Query v5 у выключенного/неактивного
   * запроса `isLoading` тоже `false`, так что пара `isLoading || isError`
   * пропустила бы сохранение, например если сессия оборвалась посреди
   * визарда) — иначе на плохой сети гость может протапать визард поверх
   * непрогруженного черновика и `PUT`-ом (replace-семантика) стереть то, что
   * сохранил раньше. Экран должен блокировать саму кнопку через
   * `isLoadingProfile`/`profileLoadFailed`, это — защита второго уровня, не
   * основной UX.
   */
  save(): Promise<boolean>;
}

const FoodieProfileDraftContext = createContext<FoodieProfileDraftValue | null>(null);

export function FoodieProfileDraftProvider({ children }: { children: React.ReactNode }) {
  const { status, repository } = useAuth();
  const queryClient = useQueryClient();

  const [draft, setDraft] = useState<FoodieProfileDraft>(EMPTY_DRAFT);
  // Per-category "the guest already touched this" flags — NOT one shared
  // flag. A tap on step 1 (cuisines) must only stop hydration of `cuisines`;
  // the other three categories still need to pick up the GET response when
  // it lands, or an untouched category gets silently wiped by the later PUT
  // (replace semantics). See the doc comment above for the full scenario.
  const cuisinesTouched = useRef(false);
  const dietsTouched = useRef(false);
  const allergiesTouched = useRef(false);
  const budgetTouched = useRef(false);

  const profileQuery = useQuery<FoodieProfile>({
    queryKey: ["foodie-profile"],
    queryFn: () => repository.getFoodieProfile(),
    // Экран, с которого открывается визард, уже требует вошедшего гостя
    // (см. profile.tsx), но провайдер не полагается на это молча.
    enabled: status === "signed-in",
  });
  // Тот же ключ кэша, что у `useFoodieOptions()` на каждом из 4 экранов —
  // общий кэш TanStack Query, второго запроса это не стоит.
  const optionsQuery = useFoodieOptions();

  useEffect(() => {
    if (!profileQuery.data) return;
    // Runs on every GET response, not just the first — an untouched
    // category still picks up the latest server value if the query data
    // changes again (e.g. a refetch after a failed retry), AND every time
    // the live options dictionary itself changes (options load in later than
    // the profile most of the time — the filter below only has something to
    // filter against once `optionsQuery.data` exists).
    const saved = profileQuery.data;
    const options = optionsQuery.data;
    // Пока справочник ещё не загрузился, фильтровать не по чему — категория
    // гидрируется как есть, эффект перезапустится и отфильтрует, когда
    // options.data подъедет (см. doc-comment выше).
    const knownCuisines = options ? new Set(options.cuisines.map((o) => o.code)) : null;
    const knownDiets = options ? new Set(options.diets.map((o) => o.code)) : null;
    const knownAllergies = options ? new Set(options.allergies.map((o) => o.code)) : null;
    const knownBudgets = options ? new Set(options.budgets.map((o) => o.code)) : null;
    setDraft((prev) => ({
      cuisines: cuisinesTouched.current
        ? prev.cuisines
        : knownCuisines
          ? saved.cuisines.filter((code) => knownCuisines.has(code))
          : saved.cuisines,
      diets: dietsTouched.current
        ? prev.diets
        : knownDiets
          ? saved.diets.filter((code) => knownDiets.has(code))
          : saved.diets,
      allergies: allergiesTouched.current
        ? prev.allergies
        : knownAllergies
          ? saved.allergies.filter((code) => knownAllergies.has(code))
          : saved.allergies,
      budget: budgetTouched.current
        ? prev.budget
        : knownBudgets && saved.budget
          ? knownBudgets.has(saved.budget)
            ? saved.budget
            : null
          : saved.budget,
    }));
  }, [profileQuery.data, optionsQuery.data]);

  const toggleCuisine = useCallback((id: string) => {
    cuisinesTouched.current = true;
    let blockedByLimit = false;
    setDraft((prev) => {
      const result = toggleCuisineSelection(prev.cuisines, id);
      blockedByLimit = result.blockedByLimit;
      return result.blockedByLimit ? prev : { ...prev, cuisines: result.next };
    });
    return { blockedByLimit };
  }, []);

  const toggleDiet = useCallback((id: string) => {
    dietsTouched.current = true;
    setDraft((prev) => ({ ...prev, diets: toggleDietSelection(prev.diets, id) }));
  }, []);

  const toggleAllergy = useCallback((id: string) => {
    allergiesTouched.current = true;
    setDraft((prev) => ({ ...prev, allergies: toggleAllergySelection(prev.allergies, id) }));
  }, []);

  const setBudget = useCallback((tier: BudgetTier) => {
    budgetTouched.current = true;
    setDraft((prev) => ({ ...prev, budget: toggleBudgetSelection(prev.budget, tier) }));
  }, []);

  const saveMutation = useMutation({
    mutationFn: (input: FoodieProfile) => repository.replaceFoodieProfile(input),
    onSuccess: (saved) => {
      queryClient.setQueryData(["foodie-profile"], saved);
      // Персонализация v1 (`specs/foodie-personalization-v1-20260916.md`,
      // сценарий 3.8, критерий 24) — три ряда, которые читают вкус гостя,
      // должны переспросить сервер СРАЗУ после сохранения, а не досидеть на
      // стухшем `staleTime` до следующего похода на главную. `invalidateQueries`
      // (не `refetchQueries`): экраны этих рядов могут быть немонтированы
      // прямо сейчас (визард — отдельный маршрут), и им незачем платить сетью
      // за данные, которые никто не смотрит, — они перезапросят сами, когда
      // гость вернётся на главную.
      void queryClient.invalidateQueries({ queryKey: ["home-picks"] });
      void queryClient.invalidateQueries({ queryKey: ["home-feed"] });
      void queryClient.invalidateQueries({ queryKey: ["explore-events"] });
    },
  });

  const { mutateAsync: replaceFoodieProfile } = saveMutation;
  const save = useCallback(async (): Promise<boolean> => {
    // Second-layer guard (see the doc comment on `save` in the interface
    // above) — the screen is expected to keep "Готово" disabled for the same
    // reason, but `save()` itself must never trust that alone.
    //
    // Gate on `!isSuccess`, not `isLoading || isError`: TanStack Query v5
    // reports `isLoading: false` for a disabled/inactive query too (e.g. the
    // session drops mid-wizard and `enabled` flips to false) — that combo
    // would slip past an `isLoading || isError` guard and PUT over an
    // untouched draft. `isSuccess` only becomes true once the GET has
    // actually resolved at least once in this session.
    // `!optionsQuery.isSuccess` too — without the dictionary the hydration
    // filter above never ran (passthrough), so an unfiltered draft could
    // still carry a code the admin hid meanwhile straight into the PUT.
    if (!profileQuery.isSuccess || !optionsQuery.isSuccess) return false;
    try {
      await replaceFoodieProfile(toWireProfile(draft));
      return true;
    } catch {
      return false;
    }
  }, [draft, replaceFoodieProfile, profileQuery.isSuccess, optionsQuery.isSuccess]);

  const { refetch: refetchProfile } = profileQuery;
  const retryLoadProfile = useCallback(() => {
    void refetchProfile();
  }, [refetchProfile]);

  const value = useMemo<FoodieProfileDraftValue>(
    () => ({
      draft,
      toggleCuisine,
      toggleDiet,
      toggleAllergy,
      setBudget,
      isLoadingProfile: profileQuery.isLoading,
      profileLoadFailed: profileQuery.isError,
      retryLoadProfile,
      isSaving: saveMutation.isPending,
      saveFailed: saveMutation.isError,
      save,
    }),
    [
      draft,
      toggleCuisine,
      toggleDiet,
      toggleAllergy,
      setBudget,
      profileQuery.isLoading,
      profileQuery.isError,
      retryLoadProfile,
      saveMutation.isPending,
      saveMutation.isError,
      save,
    ],
  );

  return (
    <FoodieProfileDraftContext.Provider value={value}>{children}</FoodieProfileDraftContext.Provider>
  );
}

export function useFoodieProfileDraft(): FoodieProfileDraftValue {
  const value = useContext(FoodieProfileDraftContext);
  if (!value) {
    throw new Error("useFoodieProfileDraft must be used within a FoodieProfileDraftProvider");
  }
  return value;
}
