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
import { BUDGET_TIERS } from "../components/foodie-profile/foodie-profile-options";
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
 *      плитке раньше, чем ответ GET пришёл, прилетевший ответ НЕ
 *      перетирает его — см. `userEdited`;
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

/** Читает `budget` бэкенда как `BudgetTier`, только если это один из трёх
 * известных вариантов — иначе (в т.ч. `null`) черновик остаётся без бюджета,
 * а не падает на незнакомом значении будущего бэкенда. */
function asBudgetTier(value: string | null): BudgetTier | null {
  return (BUDGET_TIERS as readonly string[]).includes(value ?? "") ? (value as BudgetTier) : null;
}

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
  /** Идёт первоначальная загрузка сохранённого профиля (`GET`). Экраны не
   * обязаны с ней считаться — пустой черновик всегда валидное начало, — но
   * могут показать лёгкий индикатор, если решат. */
  isLoadingProfile: boolean;
  /** Идёт сохранение (`PUT`) — последний шаг должен блокировать повторный тап
   * «Готово», пока это true. */
  isSaving: boolean;
  /** Последний вызов `save()` завершился ошибкой. Сбрасывается следующим
   * вызовом `save()`. */
  saveFailed: boolean;
  /** Отправляет весь черновик на `PUT /users/me/foodie-profile`. Возвращает
   * `true` при успехе — вызывающий экран должен уходить дальше только тогда,
   * иначе оставлять гостя на экране с `saveFailed`. */
  save(): Promise<boolean>;
}

const FoodieProfileDraftContext = createContext<FoodieProfileDraftValue | null>(null);

export function FoodieProfileDraftProvider({ children }: { children: React.ReactNode }) {
  const { status, repository } = useAuth();
  const queryClient = useQueryClient();

  const [draft, setDraft] = useState<FoodieProfileDraft>(EMPTY_DRAFT);
  // Once true, the GET response must never overwrite the draft again — the
  // guest has already started making their own choices.
  const userEdited = useRef(false);
  const hydrated = useRef(false);

  const profileQuery = useQuery<FoodieProfile>({
    queryKey: ["foodie-profile"],
    queryFn: () => repository.getFoodieProfile(),
    // Экран, с которого открывается визард, уже требует вошедшего гостя
    // (см. profile.tsx), но провайдер не полагается на это молча.
    enabled: status === "signed-in",
  });

  useEffect(() => {
    if (hydrated.current || userEdited.current) return;
    if (!profileQuery.data) return;
    hydrated.current = true;
    const saved = profileQuery.data;
    setDraft({
      cuisines: saved.cuisines,
      diets: saved.diets,
      allergies: saved.allergies,
      budget: asBudgetTier(saved.budget),
    });
  }, [profileQuery.data]);

  const toggleCuisine = useCallback((id: string) => {
    userEdited.current = true;
    let blockedByLimit = false;
    setDraft((prev) => {
      const result = toggleCuisineSelection(prev.cuisines, id);
      blockedByLimit = result.blockedByLimit;
      return result.blockedByLimit ? prev : { ...prev, cuisines: result.next };
    });
    return { blockedByLimit };
  }, []);

  const toggleDiet = useCallback((id: string) => {
    userEdited.current = true;
    setDraft((prev) => ({ ...prev, diets: toggleDietSelection(prev.diets, id) }));
  }, []);

  const toggleAllergy = useCallback((id: string) => {
    userEdited.current = true;
    setDraft((prev) => ({ ...prev, allergies: toggleAllergySelection(prev.allergies, id) }));
  }, []);

  const setBudget = useCallback((tier: BudgetTier) => {
    userEdited.current = true;
    setDraft((prev) => ({ ...prev, budget: toggleBudgetSelection(prev.budget, tier) }));
  }, []);

  const saveMutation = useMutation({
    mutationFn: (input: FoodieProfile) => repository.replaceFoodieProfile(input),
    onSuccess: (saved) => {
      queryClient.setQueryData(["foodie-profile"], saved);
    },
  });

  const save = useCallback(async (): Promise<boolean> => {
    try {
      await saveMutation.mutateAsync(toWireProfile(draft));
      return true;
    } catch {
      return false;
    }
  }, [draft, saveMutation]);

  const value = useMemo<FoodieProfileDraftValue>(
    () => ({
      draft,
      toggleCuisine,
      toggleDiet,
      toggleAllergy,
      setBudget,
      isLoadingProfile: profileQuery.isLoading,
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
