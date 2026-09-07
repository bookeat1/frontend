"use client";

import { useState } from "react";
import type { AuthUser } from "@bookeat/api/client";

import { Button } from "@web/components/ui/Button";
import { Card } from "@web/components/ui/Card";
import { SelectField } from "@web/components/ui/SelectField";
import { Switch } from "@web/components/ui/Switch";
import { TextField } from "@web/components/ui/TextField";
import { useAuth } from "@web/lib/auth";
import { useCity } from "@web/lib/city";
import { WEB_LOCALES, WEB_LOCALE_LABELS, useLocale, type WebLocale } from "@web/lib/locale";
import { joinFullName, splitFullName } from "@web/lib/profile-name";
import { useUpdateProfile } from "@web/lib/queries";

/**
 * Раздел «Настройки» страницы `/profile` — узел 5115:9023 (файл
 * `qmMsg4jO1ggmyEHNIAD2ll`). Три карточки: `PersonalDataCard`,
 * `NotificationsCard`, `LanguageCityCard`. Числа — `webProfile.settings`
 * (`packages/design-tokens/src/web.ts`), сняты с экспортированного PNG,
 * т.к. `/v1/files/:key/nodes` и `/v1/images` были 429 всю сессию.
 */
export function ProfileSettings() {
  const { t } = useLocale();
  const { user, applyUser } = useAuth();
  if (!user) return null;

  return (
    <section aria-labelledby="profile-settings-title" className="flex flex-col gap-profile-section-gap">
      <h2 id="profile-settings-title" className="text-profile-title tracking-[-0.5px] text-ink">
        {t.web.profile.settings.title}
      </h2>
      <div className="flex flex-col gap-settings-card">
        <PersonalDataCard user={user} onSaved={applyUser} />
        <NotificationsCard />
        <LanguageCityCard />
      </div>
    </section>
  );
}

function PersonalDataCard({ user, onSaved }: { user: AuthUser; onSaved: (user: AuthUser) => void }) {
  const { t } = useLocale();
  const texts = t.web.profile.settings.personalData;
  const [draft, setDraft] = useState(() => splitFullName(user.fullName));
  const [nameError, setNameError] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const mutation = useUpdateProfile();

  const edit = (patch: Partial<typeof draft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setJustSaved(false);
    if (mutation.isError) mutation.reset();
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (mutation.isPending) return;
    const fullName = joinFullName(draft);
    if (fullName === "") {
      setNameError(true);
      return;
    }
    setNameError(false);
    // Ничего не изменилось — второй клик безвреден, но 422 на пустой патч не
    // стоит ловить специально.
    if (fullName === user.fullName) {
      setJustSaved(true);
      return;
    }
    mutation.mutate(
      { fullName },
      {
        onSuccess: (fresh) => {
          onSaved(fresh);
          setDraft(splitFullName(fresh.fullName));
          setJustSaved(true);
        },
      },
    );
  };

  return (
    <Card className="flex flex-col gap-settings-row p-settings-card">
      <h3 className="text-h3 text-ink">{texts.title}</h3>
      <form onSubmit={handleSubmit} className="flex flex-col gap-settings-row" noValidate>
        <div className="grid grid-cols-1 gap-x-settings-col gap-y-settings-row md:grid-cols-2">
          <TextField
            label={texts.firstName}
            placeholder={texts.firstNamePlaceholder}
            value={draft.firstName}
            onChange={(event) => edit({ firstName: event.target.value })}
            error={nameError ? texts.firstNameRequired : undefined}
          />
          <TextField
            label={texts.lastName}
            placeholder={texts.lastNamePlaceholder}
            value={draft.lastName}
            onChange={(event) => edit({ lastName: event.target.value })}
          />
          <TextField label={texts.phone} value={user.phone ?? texts.notSet} disabled hint={texts.phoneReadOnly} />
          <TextField label={texts.email} value={user.email} disabled hint={texts.emailReadOnly} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" size="m" loading={mutation.isPending}>
            {texts.save}
          </Button>
          {justSaved && !mutation.isPending ? (
            <p role="status" className="text-[14px] leading-5 text-success-text">
              {texts.saved}
            </p>
          ) : null}
          {mutation.isError ? (
            <p role="alert" className="text-[14px] leading-5 text-danger-text">
              {texts.failed}
            </p>
          ) : null}
        </div>
      </form>
    </Card>
  );
}

/**
 * У `PATCH /users/me` нет полей под эти переключатели (`ProfileUpdate` в
 * `packages/api/src/types.ts` знает только `fullName`/`city`/`birthDate`), и
 * отдельной ручки настроек уведомлений в бэкенде тоже нет — есть только лента
 * `GET /notifications`, это другая сущность. Состояние живёт в компоненте и
 * НЕ переживает перезагрузку страницы: обещать сохранение того, чего сервер
 * не хранит, было бы враньём гостю. Нужна ручка бэкенда, прежде чем это можно
 * будет отправлять по-настоящему.
 */
function NotificationsCard() {
  const { t } = useLocale();
  const texts = t.web.profile.settings.notifications;
  const [reminders, setReminders] = useState(true);
  const [promo, setPromo] = useState(false);

  return (
    <Card className="flex flex-col gap-settings-row p-settings-card">
      <h3 className="text-h3 text-ink">{texts.title}</h3>
      <div className="flex flex-col gap-settings-toggle-row">
        <div className="flex items-center justify-between gap-4">
          <span className="text-[15px] leading-[22px] text-ink">{texts.bookingReminders}</span>
          <Switch checked={reminders} onChange={setReminders} label={texts.bookingReminders} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[15px] leading-[22px] text-ink">{texts.promo}</span>
          <Switch checked={promo} onChange={setPromo} label={texts.promo} />
        </div>
      </div>
    </Card>
  );
}

/**
 * Язык — реальный переключатель локали сайта (`useLocale`, localStorage).
 * Город — тот же список сайта, что у капсулы города в шапке (`useCity`,
 * `GET /cities`). Оба применяются сразу, без кнопки «Сохранить»: это
 * настройки браузера/сайта, а не поля аккаунта на сервере.
 */
function LanguageCityCard() {
  const { t, locale, setLocale } = useLocale();
  const texts = t.web.profile.settings.languageCity;
  const { city, cities, setCity, isLoading, isError } = useCity();

  const languageOptions = WEB_LOCALES.map((code) => ({ value: code, label: WEB_LOCALE_LABELS[code] }));
  const cityOptions = cities.map((name) => ({ value: name, label: name }));
  const cityHint = isError ? t.web.states.errorText : isLoading ? t.web.states.loading : undefined;

  return (
    <Card className="flex flex-col gap-settings-row p-settings-card">
      <h3 className="text-h3 text-ink">{texts.title}</h3>
      <div className="grid grid-cols-1 gap-x-settings-col gap-y-settings-row md:grid-cols-2">
        <SelectField<WebLocale>
          label={texts.language}
          value={locale}
          onChange={setLocale}
          options={languageOptions}
        />
        <SelectField
          label={texts.city}
          value={city ?? ""}
          onChange={setCity}
          options={cityOptions.length > 0 ? cityOptions : [{ value: "", label: "" }]}
          disabled={cityOptions.length === 0}
          hint={cityHint}
        />
      </div>
    </Card>
  );
}
