import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
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
 *     вовсе;
 *   - сохранения на бэкенд нет (это отдельная будущая задача — эндпоинта под
 *     фуди-профиль пока не существует), то есть ничего не обязано
 *     переживать релоад приложения или диплинк на середину шага. Первое, что
 *     обычно оправдывает параметры маршрута (диплинк, восстановление после
 *     свежего запуска), здесь не применимо.
 *
 * НИЧЕГО ОТСЮДА НЕ УХОДИТ НА СЕРВЕР. Финальный экран («Бюджет») либо выводит
 * собранный черновик в консоль, либо просто отбрасывает его — см. его
 * комментарий.
 */

export interface FoodieProfileDraft {
  cuisines: readonly string[];
  diets: readonly string[];
  allergies: readonly string[];
  budget: BudgetTier | null;
}

const EMPTY_DRAFT: FoodieProfileDraft = { cuisines: [], diets: [], allergies: [], budget: null };

interface FoodieProfileDraftValue {
  draft: FoodieProfileDraft;
  /** Тап по плитке кухни. Возвращает `blockedByLimit`, чтобы экран показал
   * подсказку лимита вместо молчаливого игнора шестого тапа. */
  toggleCuisine(id: string): { blockedByLimit: boolean };
  toggleDiet(id: string): void;
  toggleAllergy(id: string): void;
  setBudget(tier: BudgetTier): void;
}

const FoodieProfileDraftContext = createContext<FoodieProfileDraftValue | null>(null);

export function FoodieProfileDraftProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<FoodieProfileDraft>(EMPTY_DRAFT);

  const toggleCuisine = useCallback((id: string) => {
    let blockedByLimit = false;
    setDraft((prev) => {
      const result = toggleCuisineSelection(prev.cuisines, id);
      blockedByLimit = result.blockedByLimit;
      return result.blockedByLimit ? prev : { ...prev, cuisines: result.next };
    });
    return { blockedByLimit };
  }, []);

  const toggleDiet = useCallback((id: string) => {
    setDraft((prev) => ({ ...prev, diets: toggleDietSelection(prev.diets, id) }));
  }, []);

  const toggleAllergy = useCallback((id: string) => {
    setDraft((prev) => ({ ...prev, allergies: toggleAllergySelection(prev.allergies, id) }));
  }, []);

  const setBudget = useCallback((tier: BudgetTier) => {
    setDraft((prev) => ({ ...prev, budget: toggleBudgetSelection(prev.budget, tier) }));
  }, []);

  const value = useMemo<FoodieProfileDraftValue>(
    () => ({ draft, toggleCuisine, toggleDiet, toggleAllergy, setBudget }),
    [draft, toggleCuisine, toggleDiet, toggleAllergy, setBudget],
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
