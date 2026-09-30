"use client";

import { useState } from "react";
import type {
  FoodieBudgetOption,
  FoodieOption,
  FoodieProfile,
  FoodieProfileOptions,
} from "@bookeat/api/client";

import { Button } from "@web/components/ui/Button";
import { Card } from "@web/components/ui/Card";
import { Chip } from "@web/components/ui/Chip";
import { RemoteImage } from "@web/components/ui/RemoteImage";
import { AsyncBlock, Skeleton, type AsyncBlockQuery } from "@web/components/state/AsyncBlock";
import { cuisinePhoto } from "@web/lib/cuisine-photos";
import {
  toggleAllergySelection,
  toggleBudgetSelection,
  toggleCuisineSelection,
  toggleDietSelection,
  CUISINE_SELECTION_LIMIT,
} from "@web/lib/foodie-profile-selection";
import { useLocale } from "@web/lib/locale";
import { useFoodieOptions, useFoodieProfile, useSaveFoodieProfile } from "@web/lib/queries";
import { cx } from "@web/lib/cx";

/**
 * Раздел «Фуди-профиль» страницы `/profile` — Figma `qmMsg4jO1ggmyEHNIAD2ll`,
 * узел `5312:22289`, спека `foodie-profile-web-desktop-20260930.md`. Одна
 * длинная форма из четырёх карточек и одной кнопки сохранения (НЕ степпер
 * мобильного визарда — там один вопрос на экран).
 *
 * Форма не существует, пока не ответили ОБА запроса (`GET
 * /users/me/foodie-profile` и `GET /foodie-profile/options`) — иначе можно
 * было бы сохранить черновик поверх непрогруженного профиля и `PUT`-ом
 * (замена целиком) стереть то, что гость выбрал в приложении (риск 1 спеки).
 * Пока это не так — `AsyncBlock` держит общий скелет/ошибку по двум запросам
 * сразу.
 *
 * `data-amp-mask` на корневом элементе — раздел несёт данные о здоровье
 * (аллергии); если автозахват Amplitude (`elementInteractions`, сейчас
 * выключен, см. `lib/analytics.ts`) когда-нибудь включат, маска уже стоит
 * (критерий 25).
 */
export function ProfileFoodie() {
  const { t } = useLocale();
  const texts = t.web.profile.foodie;
  const profileQuery = useFoodieProfile();
  const optionsQuery = useFoodieOptions();

  const combined: AsyncBlockQuery<{ profile: FoodieProfile; options: FoodieProfileOptions }> = {
    data:
      profileQuery.data && optionsQuery.data
        ? { profile: profileQuery.data, options: optionsQuery.data }
        : undefined,
    isPending: profileQuery.isPending || optionsQuery.isPending,
    isError: profileQuery.isError || optionsQuery.isError,
    refetch: () => {
      void profileQuery.refetch();
      void optionsQuery.refetch();
    },
  };

  return (
    <section
      aria-labelledby="profile-foodie-title"
      data-amp-mask
      className="flex flex-col gap-foodie-col-gap"
    >
      <div className="flex flex-col gap-foodie-header-gap">
        <h2 id="profile-foodie-title" className="text-profile-title tracking-[-0.5px] text-ink">
          {texts.title}
        </h2>
        <p className="text-bodyM text-ink-secondary">{texts.subtitle}</p>
      </div>
      {/* Форма — ни разу не пустая коллекция (правило выбора допускает 0
       * кухонь/диет, сценарий 3.2/3.6), поэтому пустое состояние здесь не
       * имеет смысла — тот же приём, что у `BookingsSection`. */}
      <AsyncBlock query={combined} isEmpty={() => false} emptyText="" skeleton={<FoodieSkeleton />}>
        {({ profile, options }) => <FoodieForm profile={profile} options={options} />}
      </AsyncBlock>
    </section>
  );
}

/**
 * Высоты скелетов — реальные высоты карточек, а не произвольное число:
 * замерено по `design-specs/web/shots/5312-22289-foodie-{cuisine,diet,
 * budget}@2x.png` (2x-экспорт Figma, REST на узел был недоступен, см.
 * комментарий у `webTokens.foodie` в `packages/design-tokens/src/web.ts`) —
 * карточка кухонь ≈482px (широкая, 5 колонок плиток), карточки
 * диет/аллергий/бюджета ≈218px. Раньше все четыре были одинаковой h-40
 * (160px) — страница «прыгала» при появлении формы, особенно на карточке
 * кухонь (482 vs 160).
 */
function FoodieSkeleton() {
  const heights = ["h-[482px]", "h-[218px]", "h-[218px]", "h-[218px]"];
  return (
    <div className="flex flex-col gap-foodie-col-gap">
      {["cuisine", "diet", "allergies", "budget"].map((key, i) => (
        <Skeleton key={key} className={cx("w-full rounded-xl", heights[i])} />
      ))}
    </div>
  );
}

interface FoodieDraft {
  cuisines: readonly string[];
  diets: readonly string[];
  allergies: readonly string[];
  budget: string | null;
}

/** Черновик из сохранённого профиля: коды, которых нет среди АКТИВНЫХ
 * вариантов справочника, отбрасываются (критерий 7 — тот же приём, что у
 * визарда приложения, спека `foodie-profile-admin-dictionaries-20260916`
 * §3.5: скрытый код не рисуется и не считается, даже если он был сохранён). */
function buildDraft(profile: FoodieProfile, options: FoodieProfileOptions): FoodieDraft {
  const knownCuisines = new Set(options.cuisines.map((o) => o.code));
  const knownDiets = new Set(options.diets.map((o) => o.code));
  const knownAllergies = new Set(options.allergies.map((o) => o.code));
  const knownBudgets = new Set(options.budgets.map((o) => o.code));
  return {
    cuisines: profile.cuisines.filter((code) => knownCuisines.has(code)),
    diets: profile.diets.filter((code) => knownDiets.has(code)),
    allergies: profile.allergies.filter((code) => knownAllergies.has(code)),
    budget: profile.budget && knownBudgets.has(profile.budget) ? profile.budget : null,
  };
}

function toWireProfile(draft: FoodieDraft): FoodieProfile {
  return {
    cuisines: [...draft.cuisines],
    diets: [...draft.diets],
    allergies: [...draft.allergies],
    budget: draft.budget,
  };
}

/** Множества, а не порядок: критерий 20 — «если черновик ПО МНОЖЕСТВАМ
 * совпадает с загруженным, запроса нет». */
function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((code) => set.has(code));
}

function isPristine(draft: FoodieDraft, baseline: FoodieDraft): boolean {
  return (
    sameSet(draft.cuisines, baseline.cuisines) &&
    sameSet(draft.diets, baseline.diets) &&
    sameSet(draft.allergies, baseline.allergies) &&
    draft.budget === baseline.budget
  );
}

/**
 * Сама форма. Черновик и «исходник для сравнения» (`baseline`) рождаются
 * ОДИН раз через ленивый инициализатор `useState` — фоновый повторный ответ
 * `GET` (фокус вкладки, инвалидация) больше не меняет пропы `profile`, но
 * даже если бы менял, `useState(() => …)` не перезапускается на повторных
 * рендерах, поэтому выбор гостя не может быть молча стёрт (критерий 9).
 */
function FoodieForm({ profile, options }: { profile: FoodieProfile; options: FoodieProfileOptions }) {
  const { t } = useLocale();
  const texts = t.web.profile.foodie;
  const [baseline, setBaseline] = useState<FoodieDraft>(() => buildDraft(profile, options));
  const [draft, setDraft] = useState<FoodieDraft>(baseline);
  const [limitHintVisible, setLimitHintVisible] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const saveMutation = useSaveFoodieProfile();

  const pristine = isPristine(draft, baseline);

  function edit(next: FoodieDraft) {
    setDraft(next);
    setJustSaved(false);
    if (saveMutation.isError) saveMutation.reset();
  }

  function handleToggleCuisine(code: string) {
    const result = toggleCuisineSelection(draft.cuisines, code);
    setLimitHintVisible(result.blockedByLimit);
    if (result.blockedByLimit) return;
    edit({ ...draft, cuisines: result.next });
  }

  function handleToggleDiet(code: string) {
    edit({ ...draft, diets: toggleDietSelection(draft.diets, code) });
  }

  function handleToggleAllergy(code: string) {
    edit({ ...draft, allergies: toggleAllergySelection(draft.allergies, code) });
  }

  function handleToggleBudget(code: string) {
    edit({ ...draft, budget: toggleBudgetSelection(draft.budget, code) });
  }

  function handleSave() {
    if (saveMutation.isPending) return;
    if (pristine) {
      setJustSaved(true);
      return;
    }
    saveMutation.mutate(toWireProfile(draft), {
      onSuccess: (saved) => {
        const next = buildDraft(saved, options);
        setDraft(next);
        setBaseline(next);
        setJustSaved(true);
      },
    });
  }

  // Пока летит `PUT` (критерий 22 спеки), все поля выбора заблокированы —
  // иначе гость может кликнуть новую плитку МЕЖДУ отправкой запроса и его
  // ответом; `onSuccess` заменит черновик снимком сервера и эта правка молча
  // потеряется, при этом UI покажет «Сохранено» (для аллергий это данные о
  // здоровье, тут особенно нельзя).
  const formDisabled = saveMutation.isPending;

  return (
    <>
      <CuisineCard
        options={options.cuisines}
        selected={draft.cuisines}
        limitHintVisible={limitHintVisible}
        disabled={formDisabled}
        onToggle={handleToggleCuisine}
      />
      <ChipCard
        titleId="profile-foodie-diet-title"
        title={texts.diet.title}
        subtitle={texts.diet.subtitle}
        options={options.diets}
        selected={draft.diets}
        disabled={formDisabled}
        onToggle={handleToggleDiet}
      />
      <ChipCard
        titleId="profile-foodie-allergies-title"
        title={texts.allergies.title}
        subtitle={texts.allergies.subtitle}
        options={options.allergies}
        selected={draft.allergies}
        disabled={formDisabled}
        onToggle={handleToggleAllergy}
      />
      <BudgetCard
        options={options.budgets}
        selected={draft.budget}
        disabled={formDisabled}
        onToggle={handleToggleBudget}
      />
      <div className="flex flex-wrap items-center gap-foodie-save-gap">
        <Button variant="primary" size="l" loading={saveMutation.isPending} onClick={handleSave}>
          {texts.save}
        </Button>
        {saveMutation.isError ? (
          <p role="alert" className="text-[14px] leading-5 text-danger-text">
            {texts.failed}
          </p>
        ) : justSaved ? (
          <p role="status" className="text-[14px] leading-5 text-success-text">
            {texts.saved}
          </p>
        ) : (
          <p className="text-[14px] leading-5 text-ink-tertiary">{texts.hint}</p>
        )}
      </div>
    </>
  );
}

function CuisineCard({
  options,
  selected,
  limitHintVisible,
  disabled,
  onToggle,
}: {
  options: readonly FoodieOption[];
  selected: readonly string[];
  limitHintVisible: boolean;
  disabled: boolean;
  onToggle: (code: string) => void;
}) {
  const { t } = useLocale();
  const texts = t.web.profile.foodie.cuisine;

  return (
    <Card className="flex flex-col gap-foodie-card-gap p-foodie-card-p">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-h3 text-ink">{texts.title}</h3>
          <p className="text-bodyM text-ink-secondary">{texts.subtitle(CUISINE_SELECTION_LIMIT)}</p>
        </div>
        <span className="whitespace-nowrap text-bodyM font-semibold text-brand-text">
          {texts.counter(selected.length, CUISINE_SELECTION_LIMIT)}
        </span>
      </div>
      {limitHintVisible ? (
        <p role="status" className="text-[13px] leading-[18px] text-danger-text">
          {texts.limitHint}
        </p>
      ) : null}
      <div className="grid grid-cols-3 gap-x-foodie-tile-x gap-y-foodie-tile-y lg:grid-cols-5">
        {options.map((option) => {
          const isSelected = selected.includes(option.code);
          return (
            <CuisineTile
              key={option.code}
              option={option}
              selected={isSelected}
              disabled={disabled}
              onClick={() => onToggle(option.code)}
            />
          );
        })}
      </div>
    </Card>
  );
}

function CuisineTile({
  option,
  selected,
  disabled,
  onClick,
}: {
  option: FoodieOption;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const photoUrl = option.imageUrl?.trim() ? option.imageUrl : cuisinePhoto(option.code);
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={option.name}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "relative flex h-foodie-tile w-full items-end overflow-hidden rounded-lg text-left",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        "disabled:cursor-not-allowed disabled:opacity-60",
        selected ? "ring-2 ring-inset ring-brand" : null,
      )}
    >
      <RemoteImage src={photoUrl} alt="" sizes="164px" className="absolute inset-0" />
      {/* Затемнение снизу стоит ВСЕГДА, даже без фото (заглушка
       * `RemoteImage` — серая подложка): подпись держит контраст 4.5:1 не
       * только поверх фотографии (критерий 12). */}
      <span
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent"
      />
      <span className="relative z-10 flex items-center gap-1 px-3 py-2 text-[14px] font-medium leading-5 text-white">
        {selected ? (
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2.5 7.2 5.5 10.2 11.5 3.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
        <span className="line-clamp-2 break-words">{option.name}</span>
      </span>
    </button>
  );
}

function ChipCard({
  titleId,
  title,
  subtitle,
  options,
  selected,
  disabled,
  onToggle,
}: {
  titleId: string;
  title: string;
  subtitle: string;
  options: readonly FoodieOption[];
  selected: readonly string[];
  disabled: boolean;
  onToggle: (code: string) => void;
}) {
  return (
    <Card className="flex flex-col gap-foodie-card-gap p-foodie-card-p">
      <div>
        <h3 id={titleId} className="text-h3 text-ink">
          {title}
        </h3>
        <p className="text-bodyM text-ink-secondary">{subtitle}</p>
      </div>
      <div role="group" aria-labelledby={titleId} className="flex flex-wrap gap-foodie-chips-gap">
        {options.map((option) => {
          const isSelected = selected.includes(option.code);
          return (
            <Chip
              key={option.code}
              size="m"
              state={isSelected ? "selected" : "default"}
              disabled={disabled}
              onClick={() => onToggle(option.code)}
            >
              {/* `aria-hidden` — доступное имя чипа остаётся названием
               * варианта без «✓» (критерий 15 рисует галочку, но не
               * переименовывает кнопку для скринридера). */}
              {isSelected ? (
                <span aria-hidden="true" className="mr-1">
                  ✓
                </span>
              ) : null}
              {option.name}
            </Chip>
          );
        })}
      </div>
    </Card>
  );
}

function BudgetCard({
  options,
  selected,
  disabled,
  onToggle,
}: {
  options: readonly FoodieBudgetOption[];
  selected: string | null;
  disabled: boolean;
  onToggle: (code: string) => void;
}) {
  const { t } = useLocale();
  const texts = t.web.profile.foodie.budget;
  const titleId = "profile-foodie-budget-title";

  return (
    <Card className="flex flex-col gap-foodie-card-gap p-foodie-card-p">
      <div>
        <h3 id={titleId} className="text-h3 text-ink">
          {texts.title}
        </h3>
        <p className="text-bodyM text-ink-secondary">{texts.subtitle}</p>
      </div>
      <div
        role="group"
        aria-labelledby={titleId}
        className="grid grid-cols-1 gap-foodie-budget-gap md:grid-cols-3"
      >
        {options.map((option) => {
          const isSelected = selected === option.code;
          return (
            <button
              key={option.code}
              type="button"
              aria-pressed={isSelected}
              aria-label={option.priceLabel ? `${option.name}, ${option.priceLabel}` : option.name}
              disabled={disabled}
              onClick={() => onToggle(option.code)}
              className={cx(
                "flex h-foodie-budget items-center justify-between gap-3 rounded-lg border px-4 text-left",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                "disabled:cursor-not-allowed disabled:opacity-60",
                isSelected ? "border-brand bg-brand-subtle" : "border-line-control bg-canvas",
              )}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden="true"
                  className={cx(
                    "h-5 w-5 shrink-0 rounded-full border-2",
                    isSelected ? "border-brand bg-brand" : "border-line-control bg-canvas",
                  )}
                />
                <span
                  className={cx(
                    "truncate text-[14px] font-semibold leading-5",
                    isSelected ? "text-brand-text" : "text-ink",
                  )}
                >
                  {option.name}
                </span>
              </span>
              {option.priceLabel ? (
                <span className="shrink-0 text-[14px] text-ink-secondary">{option.priceLabel}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
