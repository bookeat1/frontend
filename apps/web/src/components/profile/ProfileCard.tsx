"use client";

import type { AuthUser } from "@bookeat/api/client";

import { Skeleton } from "@web/components/state/AsyncBlock";
import { cx } from "@web/lib/cx";
import { membershipMonthYear } from "@web/lib/format";
import { useLocale } from "@web/lib/locale";
import { formatForDisplay, kzNationalDigits } from "@web/lib/phone";

/**
 * Карточка гостя — узел 3525:15156: белая подложка радиуса 20 с тенью
 * карточки, паддинг 28, аватар-инициал 88 на `brand/50` → колонка «имя /
 * контакты / статистика» через 32. Кегли и просветы — утилиты `profile-*`,
 * выведенные из `webProfile.card`; здесь ни одного числа от себя.
 *
 * Ниже `lg` карточка повторяет «Профиль» приложения
 * (`apps/mobile/src/components/profile/ProfileIdentity.tsx`): аватар сверху,
 * имя и контакты под ним по центру. Десктопная строка в ряд — только с `lg`.
 *
 * Статистика приходит из ДВУХ запросов (брони и избранное), и они могут
 * ехать или упасть независимо от профиля: пока число неизвестно — заглушка
 * той же высоты; упало — статистика не показывается вовсе. Выдумать «0»
 * нельзя: ноль визитов и «не смогли посчитать» — разные вещи.
 */
export interface ProfileStat {
  /** `undefined` — ещё считается; `null` — посчитать не удалось. */
  value: number | null | undefined;
  /** Слово при числе — уже склонённое словарём («визита», «избранных»). */
  word: (count: number) => string;
}

export interface ProfileCardProps {
  /** Профиль может не приехать (сеть) — тогда `null`, и карточка показывает
   * обобщённую подпись вместо имени, а не пустой круг. */
  user: AuthUser | null;
  /** Подпись на случай, когда профиля нет — `t.web.header.account`. */
  fallbackName: string;
  stats: readonly ProfileStat[];
  className?: string;
}

/** Первая буква первого слова — как в макете («К» у «Камила Ахметова»).
 * Регистр — по правилам языка, а не ASCII. */
function initialOf(name: string, tag: string): string {
  const word = name.trim().split(/\s+/)[0] ?? "";
  return word ? word[0].toLocaleUpperCase(tag) : "";
}

export function ProfileCard({ user, fallbackName, stats, className }: ProfileCardProps) {
  const { t, locale } = useLocale();
  const texts = t.web.profile;
  const name = user?.fullName.trim() || fallbackName;

  const contacts: string[] = [];
  if (user?.phone) {
    const national = kzNationalDigits(user.phone);
    contacts.push(national ? formatForDisplay(national) : user.phone);
  }
  if (user?.email) contacts.push(user.email);
  const since = membershipMonthYear(user?.createdAt ?? null, locale);
  if (since) contacts.push(texts.since(since));

  return (
    <section
      aria-label={texts.title}
      className={cx(
        "flex flex-col items-center gap-6 rounded-xl bg-canvas p-profile-card-p text-center shadow-card",
        "lg:flex-row lg:items-center lg:gap-profile-card-gap lg:text-left",
        className,
      )}
    >
      <span
        role="img"
        aria-label={texts.avatarLabel}
        className="inline-flex h-profile-avatar w-profile-avatar shrink-0 items-center justify-center rounded-full bg-brand-subtle text-profile-avatar text-brand-text"
      >
        {initialOf(name, locale)}
      </span>

      <div className="flex min-w-0 flex-col items-center gap-profile-identity-gap lg:items-start">
        <h1 className="max-w-full break-words text-profile-name tracking-[-0.5px] text-ink">{name}</h1>
        {contacts.length > 0 ? (
          <p className="max-w-full text-profile-contact text-ink-secondary [overflow-wrap:anywhere]">
            {contacts.join(" · ")}
          </p>
        ) : null}
        <StatsRow stats={stats} />
      </div>
    </section>
  );
}

function StatsRow({ stats }: { stats: readonly ProfileStat[] }) {
  const visible = stats.filter(
    (stat): stat is ProfileStat & { value: number | undefined } => stat.value !== null,
  );
  if (visible.length === 0) return null;
  return (
    <ul className="flex flex-wrap justify-center gap-profile-stats-gap lg:justify-start">
      {visible.map((stat, index) => (
        <li key={index} className="flex items-center gap-profile-stat-gap">
          {stat.value === undefined ? (
            // Высота — строка статистики (24), ширина — под двузначное число
            // и слово; страница не должна прыгать, когда число приедет.
            <Skeleton className="h-6 w-24" />
          ) : (
            <>
              <span className="text-profile-stat text-ink">{stat.value}</span>
              <span className="text-profile-stat-label text-ink-tertiary">{stat.word(stat.value)}</span>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
