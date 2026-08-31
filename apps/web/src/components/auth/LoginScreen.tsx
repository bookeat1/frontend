"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { RepositoryError } from "@bookeat/api/client";
import type { Dictionary } from "@bookeat/i18n";

import { Button } from "@web/components/ui/Button";
import { TextField } from "@web/components/ui/TextField";
import { authRepository } from "@web/lib/api";
import { assetUrl } from "@web/lib/asset";
import { useAuth } from "@web/lib/auth";
import { cx } from "@web/lib/cx";
import { formatForDisplay, formatNational, isComplete, nationalDigits, toE164 } from "@web/lib/phone";
import { useT } from "@web/lib/locale";

/**
 * Вход гостя — Figma 3272:2 (шаг «номер») и 3389:11920 (шаг «код»).
 *
 * ЭТО НАСТОЯЩИЙ ВХОД, а не заглушка: `POST /auth/otp/request` и
 * `POST /auth/otp/verify` через `@bookeat/api`. На тестовом стенде каналы
 * доставки настроены (проверено 31.08.2026: у процесса заданы
 * OTP_WHATSAPP_*, OTP_TELEGRAM_GATEWAY_TOKEN и OTP_SMS_*), так что код
 * реально приходит. Успешная проверка кода СОЗДАЁТ учётную запись, если номер
 * новый, — отдельного шага регистрации у этого бэкенда нет, поэтому кнопки
 * «Войти» и «Регистрация» в шапке ведут на один и тот же экран.
 *
 * ТРИ РАСХОЖДЕНИЯ С МАКЕТОМ, каждое с причиной:
 *
 * 1. Клеток для кода ШЕСТЬ, а не четыре. Сервер генерирует шестизначный код
 *    (`internal/auth/otpcode/otpcode.go`, `const length = 6`), и четыре поля
 *    сделали бы вход невозможным. Это ошибка макета, а не вёрстки.
 * 2. Кнопки «Продолжить с Google» нет. Ручки входа через Google у бэкенда не
 *    существует (`/auth/*` знает пароль, OTP, refresh, logout и Telegram
 *    mini app) — кнопка была бы декорацией, которая никуда не ведёт.
 * 3. Выбора страны у номера нет: код страны зафиксирован на «KZ +7», как и
 *    нарисовано. Гость с иностранным номером на сайте войти не сможет —
 *    см. lib/phone.ts.
 *
 * ВРЕМЕННО: подложка — снимок ГЕРОЯ (`/brand/hero.webp`, скопирован в
 * `/brand/login.webp`). В макете 3272:2 своя фотография, но её заливку не
 * удалось выгрузить: Figma API держал 429 больше часа. Файл подменяется одним
 * `cp`, разметку это не трогает. ЗАДОЛЖЕННОСТЬ, названа в отчёте.
 */
export function LoginScreen() {
  const t = useT();
  const router = useRouter();
  const { completeSignIn, signedIn } = useAuth();

  const [step, setStep] = useState<"phone" | "code">("phone");
  const [digits, setDigits] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Сколько секунд до следующего разрешённого запроса кода. Лимит сервера —
   * один запрос в минуту на номер, поэтому отсчёт честный, а не украшение. */
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const requestCode = useCallback(
    async (phoneDigits: string) => {
      setBusy(true);
      setError(null);
      try {
        await authRepository.requestOtp(toE164(phoneDigits));
        setStep("code");
        setCode("");
        setCooldown(RESEND_SECONDS);
      } catch (failure) {
        setError(requestErrorText(failure, t));
      } finally {
        setBusy(false);
      }
    },
    [t],
  );

  async function submitPhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!isComplete(digits)) {
      setError(t.web.auth.phoneIncomplete);
      return;
    }
    await requestCode(digits);
  }

  async function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || code.length !== CODE_LENGTH) return;
    setBusy(true);
    setError(null);
    try {
      const session = await authRepository.verifyOtp({ phone: toE164(digits), code });
      await completeSignIn(session);
      // `replace`, а не `push`: «назад» с главной не должен возвращать на
      // экран входа, который для вошедшего гостя уже бессмыслен.
      router.replace("/");
    } catch (failure) {
      setError(verifyErrorText(failure, t));
      // Введённый код НЕ стираем: гость видит, что именно он набрал, и правит
      // одну цифру вместо шести.
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <Image
        src={assetUrl("/brand/login.webp")}
        alt=""
        fill
        sizes="100vw"
        priority
        unoptimized
        className="object-cover"
      />
      <div aria-hidden="true" className="absolute inset-0 bg-scrim" />

      <div className="relative w-full max-w-modal rounded-2xl bg-canvas p-8 shadow-modal">
        {signedIn ? (
          <div className="flex flex-col gap-4">
            <h1 className="text-h3 text-ink">{t.web.auth.signedInTitle}</h1>
            <p className="text-bodyM text-ink-secondary">{t.web.auth.signedInText}</p>
            <Button block onClick={() => router.replace("/")}>
              {t.web.auth.backHome}
            </Button>
          </div>
        ) : step === "phone" ? (
          <form onSubmit={submitPhone} className="flex flex-col gap-5" noValidate>
            <BrandMark />
            <div className="flex flex-col gap-2">
              <h1 className="text-h3 text-ink">{t.web.auth.title}</h1>
              <p className="text-bodyM text-ink-secondary">{t.web.auth.subtitle}</p>
            </div>

            <TextField
              label={t.web.auth.phoneLabel}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              autoFocus
              value={formatNational(digits)}
              onChange={(event) => {
                setDigits(nationalDigits(event.target.value));
                setError(null);
              }}
              placeholder={t.web.auth.phonePlaceholder}
              error={error ?? undefined}
              leadingSlot={
                <span className="flex shrink-0 items-center gap-2 border-r border-line-strong pr-3 text-[15px] font-semibold leading-[22px] text-ink">
                  {t.web.auth.country}
                  <span className="text-ink-secondary">+7</span>
                </span>
              }
            />

            <Button type="submit" block loading={busy}>
              {busy ? t.web.auth.requesting : t.web.auth.requestCode}
            </Button>

            <p className="text-center text-[13px] leading-[18px] text-ink-tertiary">
              {t.web.auth.terms}
            </p>
          </form>
        ) : (
          <form onSubmit={submitCode} className="flex flex-col gap-5" noValidate>
            <button
              type="button"
              onClick={() => {
                setStep("phone");
                setError(null);
              }}
              className="inline-flex items-center gap-2 self-start text-[15px] font-semibold leading-[22px] text-brand-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path
                  d="M14 6l-6 6 6 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {t.web.auth.changePhone}
            </button>

            <div className="flex flex-col gap-2">
              <h1 className="text-h3 text-ink">{t.web.auth.codeTitle}</h1>
              <p className="text-bodyM text-ink-secondary">
                {t.web.auth.codeSentTo(formatForDisplay(digits))}
              </p>
            </div>

            <CodeInput value={code} onChange={setCode} invalid={Boolean(error)} />

            {error ? (
              <p role="alert" className="text-[13px] leading-[18px] text-danger-text">
                {error}
              </p>
            ) : null}

            <Button type="submit" block loading={busy} disabled={code.length !== CODE_LENGTH}>
              {busy ? t.web.auth.verifying : t.web.auth.verify}
            </Button>

            <div className="flex flex-col items-center gap-2">
              {cooldown > 0 ? (
                <p className="text-[13px] leading-[18px] text-ink-tertiary">
                  {t.web.auth.resendIn(cooldown)}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => void requestCode(digits)}
                  disabled={busy}
                  className="text-[13px] font-semibold leading-[18px] text-brand-text disabled:text-ink-disabled focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  {t.web.auth.resend}
                </button>
              )}
              {/* В макете «Не приходит код?» — ссылка. Страницы поддержки у
                  сайта нет, поэтому это раскрывающаяся подсказка, а не ссылка
                  в 404. */}
              <details className="w-full text-center">
                <summary className="cursor-pointer list-none text-[13px] font-semibold leading-[18px] text-brand-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                  {t.web.auth.noCode}
                </summary>
                <p className="pt-2 text-left text-[13px] leading-[18px] text-ink-secondary">
                  {t.web.auth.noCodeHelp}
                </p>
              </details>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}

/** Логотип в карточке (узел 3272:8). Ссылка на главную — единственный выход с
 * экрана входа: шапки сайта здесь по макету нет. */
function BrandMark() {
  const t = useT();
  return (
    <Link
      href="/"
      className="self-start text-[24px] font-bold leading-8 tracking-[-0.4px] text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      {t.web.header.brand}
    </Link>
  );
}

/** Длина кода — ШЕСТЬ: `otpcode.Generate` в бэкенде. */
const CODE_LENGTH = 6;
/** Лимит сервера на запрос кода — 1 в минуту на номер (AUTH_OTP_RATE_PER_MIN). */
const RESEND_SECONDS = 60;

/**
 * Клетки для кода (узел 3389:11920).
 *
 * Почему не одно поле с межбуквенным интервалом: макет рисует клетки, и они
 * же дают понятный фокус. Почему не шесть независимых состояний: значение
 * ОДНО (строка `value`), клетки лишь показывают её символы — иначе
 * «вставить код из буфера» пришлось бы собирать из шести кусков.
 *
 * Что обязано работать и работает: ввод с переходом вперёд, Backspace с
 * возвратом назад, стрелки, вставка целиком в любую клетку, автоподстановка
 * кода из SMS (`autocomplete="one-time-code"` на первой клетке).
 */
function CodeInput({
  value,
  onChange,
  invalid,
}: {
  value: string;
  onChange: (next: string) => void;
  invalid: boolean;
}) {
  const t = useT();
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const focus = (index: number) => {
    const target = refs.current[Math.min(Math.max(index, 0), CODE_LENGTH - 1)];
    target?.focus();
    target?.select();
  };

  function handleInput(index: number, raw: string) {
    const digitsOnly = raw.replace(/\D/g, "");
    if (!digitsOnly) return;
    const next = (value.slice(0, index) + digitsOnly + value.slice(index + digitsOnly.length))
      .replace(/\D/g, "")
      .slice(0, CODE_LENGTH);
    onChange(next);
    focus(index + digitsOnly.length);
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      event.preventDefault();
      if (value[index]) {
        onChange(value.slice(0, index) + value.slice(index + 1));
      } else if (index > 0) {
        onChange(value.slice(0, index - 1) + value.slice(index));
        focus(index - 1);
      }
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      focus(index - 1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      focus(index + 1);
    }
  }

  function handlePaste(index: number, event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    handleInput(index, event.clipboardData.getData("text"));
  }

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="pb-1.5 text-[13px] font-medium leading-[18px] text-ink-secondary">
        {t.web.auth.codeLabel}
      </legend>
      <div className="flex gap-2">
        {Array.from({ length: CODE_LENGTH }, (_, index) => (
          <input
            key={index}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="text"
            inputMode="numeric"
            // Автоподстановка кода из сообщения — только на первой клетке:
            // иначе браузер попытается вписать весь код в каждую.
            autoComplete={index === 0 ? "one-time-code" : "off"}
            // eslint-disable-next-line jsx-a11y/no-autofocus -- фокус на первой
            // клетке сразу после перехода на шаг кода: гость пришёл сюда, чтобы
            // набрать код, и лишний клик здесь — чистая потеря.
            autoFocus={index === 0}
            maxLength={1}
            aria-label={t.web.auth.codeDigitLabel(index + 1, CODE_LENGTH)}
            aria-invalid={invalid || undefined}
            value={value[index] ?? ""}
            onChange={(event) => handleInput(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={(event) => handlePaste(index, event)}
            className={cx(
              "h-[56px] w-full min-w-0 rounded-field bg-canvas text-center text-[22px] font-semibold leading-7 text-ink",
              "focus:outline-none",
              invalid
                ? "border-2 border-danger-text"
                : "border border-line-control focus:border-2 focus:border-brand",
            )}
          />
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Ошибка запроса кода. Ветвимся ТОЛЬКО по машинному `code` и по статусу —
 * английский `error` сервера гостю не показывается никогда.
 */
function requestErrorText(failure: unknown, t: Dictionary): string {
  if (!(failure instanceof RepositoryError)) return t.web.auth.errors.generic;
  if (failure.isOffline) return t.web.auth.errors.offline;
  if (failure.code === "otp_invalid_phone") return t.web.auth.errors.invalidPhone;
  if (failure.code === "otp_rate_limited_minute" || failure.code === "otp_rate_limited_hour") {
    return failure.retryAfterSeconds
      ? t.web.auth.errors.rateLimited(failure.retryAfterSeconds)
      : t.web.auth.errors.tooOften;
  }
  if (failure.status === 429) {
    return failure.retryAfterSeconds
      ? t.web.auth.errors.rateLimited(failure.retryAfterSeconds)
      : t.web.auth.errors.tooOften;
  }
  // 422 без узкого кода — это старая сборка сервера, где на запрос кода
  // осталась ровно одна причина после клиентской проверки номера: лимит.
  if (failure.status === 422) return t.web.auth.errors.tooOften;
  return t.web.auth.errors.generic;
}

/** Ошибка проверки кода. `otp_invalid` СЛИТ сервером из трёх случаев
 * («неверный», «истёк», «активного кода нет») — намеренно, чтобы ручка не
 * работала датчиком присутствия. Поэтому текст перечисляет причины. */
function verifyErrorText(failure: unknown, t: Dictionary): string {
  if (!(failure instanceof RepositoryError)) return t.web.auth.errors.generic;
  if (failure.isOffline) return t.web.auth.errors.offline;
  if (failure.code === "otp_too_many_attempts") return t.web.auth.errors.tooManyAttempts;
  if (failure.code === "otp_invalid_phone") return t.web.auth.errors.invalidPhone;
  if (failure.code === "otp_invalid" || failure.status === 401) {
    return t.web.auth.errors.codeRejected;
  }
  if (failure.status === 422) return t.web.auth.errors.codeRejected;
  return t.web.auth.errors.generic;
}
