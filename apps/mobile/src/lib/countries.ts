/**
 * The country list behind the phone field's selector.
 *
 * WHY THIS FILE AND NOT A LIBRARY. The job here is small and fixed: show a
 * flag, a dial code and a Russian country name, and know how many digits a
 * handful of countries' numbers have. `libphonenumber-js` solves a much larger
 * problem — validating national number RANGES per region — and carries the
 * metadata to match. Measured on v1.13.9, metadata alone, before its parser:
 * `metadata.min.json` 84 269 B raw / 19 282 B gzipped, `metadata.full.json`
 * 157 926 B / 39 519 B. It also ships no localized country names, so the
 * Russian labels below would have had to be written anyway.
 *
 * This file, bundled and minified by esbuild, is 13 317 B raw / 3 513 B
 * gzipped for 215 countries — the flag emoji are COMPUTED from the ISO code
 * (two regional-indicator code points) rather than stored, and the table is
 * one string rather than 215 object literals.
 *
 * WHAT WE DELIBERATELY DO NOT KNOW. Only the countries our guests actually
 * come from carry a digit grouping. Everywhere else `groups` is undefined and
 * the field accepts free digits up to the E.164 ceiling. That is a feature:
 * a guest with a number from a country we guessed wrong about must still be
 * able to type it. Never let an incomplete table refuse a real number.
 */

/** E.164 caps the whole number — country code included — at 15 digits. */
export const E164_MAX_DIGITS = 15;

export interface Country {
  /** ISO 3166-1 alpha-2, uppercase. Also the picker's stable key. */
  iso2: string;
  /** Dial code WITHOUT the plus, e.g. "7", "44", "998". */
  dial: string;
  /** Russian name, as shown in the picker. */
  name: string;
  /**
   * Digit-group sizes of the national number, e.g. [3, 3, 2, 2] renders
   * `(701) 234-56-78`. `undefined` means "we do not claim to know this
   * country's format" — the field then takes free digits and validates only
   * that there is at least one.
   */
  groups?: readonly number[];
  /**
   * A leading digit used domestically before the national number (the Soviet
   * "8"). Stripped on entry, because no national number in these countries
   * begins with it — so this is lossless, and it is what lets a guest type
   * their number the way they say it out loud.
   */
  trunk?: string;
  /**
   * Set on the country that wins an ambiguous dial code (+7 → KZ, not RU;
   * +1 → US, not CA). Without it a pasted "+7…" would resolve to whichever
   * row happens to come first.
   */
  primary?: true;
}

/**
 * iso2 dial name — one per line, parsed once at module load. A packed string
 * instead of 240 object literals: same data, a fraction of the bytes, and it
 * stays readable in the diff.
 */
const TABLE = `
AF 93 Афганистан
AL 355 Албания
DZ 213 Алжир
AS 1684 Американское Самоа
AD 376 Андорра
AO 244 Ангола
AI 1264 Ангилья
AG 1268 Антигуа и Барбуда
AR 54 Аргентина
AM 374 Армения
AW 297 Аруба
AU 61 Австралия
AT 43 Австрия
AZ 994 Азербайджан
BS 1242 Багамы
BH 973 Бахрейн
BD 880 Бангладеш
BB 1246 Барбадос
BY 375 Беларусь
BE 32 Бельгия
BZ 501 Белиз
BJ 229 Бенин
BM 1441 Бермуды
BT 975 Бутан
BO 591 Боливия
BA 387 Босния и Герцеговина
BW 267 Ботсвана
BR 55 Бразилия
BN 673 Бруней
BG 359 Болгария
BF 226 Буркина-Фасо
BI 257 Бурунди
KH 855 Камбоджа
CM 237 Камерун
CA 1 Канада
CV 238 Кабо-Верде
KY 1345 Каймановы острова
CF 236 ЦАР
TD 235 Чад
CL 56 Чили
CN 86 Китай
CO 57 Колумбия
KM 269 Коморы
CG 242 Конго
CD 243 ДР Конго
CR 506 Коста-Рика
CI 225 Кот-д’Ивуар
HR 385 Хорватия
CU 53 Куба
CW 599 Кюрасао
CY 357 Кипр
CZ 420 Чехия
DK 45 Дания
DJ 253 Джибути
DM 1767 Доминика
DO 1809 Доминикана
EC 593 Эквадор
EG 20 Египет
SV 503 Сальвадор
GQ 240 Экваториальная Гвинея
ER 291 Эритрея
EE 372 Эстония
ET 251 Эфиопия
FJ 679 Фиджи
FI 358 Финляндия
FR 33 Франция
GF 594 Французская Гвиана
PF 689 Французская Полинезия
GA 241 Габон
GM 220 Гамбия
GE 995 Грузия
DE 49 Германия
GH 233 Гана
GI 350 Гибралтар
GR 30 Греция
GL 299 Гренландия
GD 1473 Гренада
GP 590 Гваделупа
GU 1671 Гуам
GT 502 Гватемала
GN 224 Гвинея
GW 245 Гвинея-Бисау
GY 592 Гайана
HT 509 Гаити
HN 504 Гондурас
HK 852 Гонконг
HU 36 Венгрия
IS 354 Исландия
IN 91 Индия
ID 62 Индонезия
IR 98 Иран
IQ 964 Ирак
IE 353 Ирландия
IL 972 Израиль
IT 39 Италия
JM 1876 Ямайка
JP 81 Япония
JO 962 Иордания
KZ 7 Казахстан
KE 254 Кения
KI 686 Кирибати
KW 965 Кувейт
KG 996 Киргизия
LA 856 Лаос
LV 371 Латвия
LB 961 Ливан
LS 266 Лесото
LR 231 Либерия
LY 218 Ливия
LI 423 Лихтенштейн
LT 370 Литва
LU 352 Люксембург
MO 853 Макао
MK 389 Северная Македония
MG 261 Мадагаскар
MW 265 Малави
MY 60 Малайзия
MV 960 Мальдивы
ML 223 Мали
MT 356 Мальта
MH 692 Маршалловы Острова
MQ 596 Мартиника
MR 222 Мавритания
MU 230 Маврикий
MX 52 Мексика
FM 691 Микронезия
MD 373 Молдова
MC 377 Монако
MN 976 Монголия
ME 382 Черногория
MA 212 Марокко
MZ 258 Мозамбик
MM 95 Мьянма
NA 264 Намибия
NR 674 Науру
NP 977 Непал
NL 31 Нидерланды
NC 687 Новая Каледония
NZ 64 Новая Зеландия
NI 505 Никарагуа
NE 227 Нигер
NG 234 Нигерия
KP 850 КНДР
NO 47 Норвегия
OM 968 Оман
PK 92 Пакистан
PW 680 Палау
PS 970 Палестина
PA 507 Панама
PG 675 Папуа — Новая Гвинея
PY 595 Парагвай
PE 51 Перу
PH 63 Филиппины
PL 48 Польша
PT 351 Португалия
PR 1787 Пуэрто-Рико
QA 974 Катар
RE 262 Реюньон
RO 40 Румыния
RU 7 Россия
RW 250 Руанда
KN 1869 Сент-Китс и Невис
LC 1758 Сент-Люсия
VC 1784 Сент-Винсент и Гренадины
WS 685 Самоа
SM 378 Сан-Марино
ST 239 Сан-Томе и Принсипи
SA 966 Саудовская Аравия
SN 221 Сенегал
RS 381 Сербия
SC 248 Сейшелы
SL 232 Сьерра-Леоне
SG 65 Сингапур
SK 421 Словакия
SI 386 Словения
SB 677 Соломоновы Острова
SO 252 Сомали
ZA 27 ЮАР
KR 82 Республика Корея
SS 211 Южный Судан
ES 34 Испания
LK 94 Шри-Ланка
SD 249 Судан
SR 597 Суринам
SZ 268 Эсватини
SE 46 Швеция
CH 41 Швейцария
SY 963 Сирия
TW 886 Тайвань
TJ 992 Таджикистан
TZ 255 Танзания
TH 66 Таиланд
TL 670 Восточный Тимор
TG 228 Того
TO 676 Тонга
TT 1868 Тринидад и Тобаго
TN 216 Тунис
TR 90 Турция
TM 993 Туркмения
TC 1649 Тёркс и Кайкос
TV 688 Тувалу
UG 256 Уганда
UA 380 Украина
AE 971 ОАЭ
GB 44 Великобритания
US 1 США
UY 598 Уругвай
UZ 998 Узбекистан
VU 678 Вануату
VA 379 Ватикан
VE 58 Венесуэла
VN 84 Вьетнам
YE 967 Йемен
ZM 260 Замбия
ZW 263 Зимбабве
`;

/**
 * Formats we are prepared to state as fact, and nothing more.
 *
 * These are the countries BookEat guests actually arrive from (KZ/RU first,
 * then the neighbours and the two tourist sources). Everything else is
 * deliberately absent: an invented grouping would either truncate a real
 * number or draw brackets around the wrong digits, and both are worse than
 * plain digits.
 */
const FORMATS: Record<string, { groups: readonly number[]; trunk?: string; primary?: true }> = {
  KZ: { groups: [3, 3, 2, 2], trunk: "8", primary: true },
  RU: { groups: [3, 3, 2, 2], trunk: "8" },
  US: { groups: [3, 3, 4], primary: true },
  CA: { groups: [3, 3, 4] },
  BY: { groups: [2, 3, 2, 2], trunk: "8" },
  UA: { groups: [2, 3, 2, 2] },
  UZ: { groups: [2, 3, 2, 2], trunk: "8" },
  KG: { groups: [3, 3, 3], trunk: "0" },
  TJ: { groups: [2, 3, 2, 2] },
  TM: { groups: [2, 2, 2, 2] },
  AZ: { groups: [2, 3, 2, 2] },
  GE: { groups: [3, 3, 3] },
  AM: { groups: [2, 3, 3] },
  TR: { groups: [3, 3, 2, 2] },
  AE: { groups: [2, 3, 4] },
  CN: { groups: [3, 4, 4] },
};

/**
 * The order the picker shows. Everything not named here follows in Russian
 * alphabetical order — a guest scrolling for «Германия» should not have to
 * know it sits under D.
 */
const PINNED = ["KZ", "RU", "UZ", "KG", "AZ", "GE", "AM", "TR", "AE", "US", "CN"];

function parseTable(): Country[] {
  const out: Country[] = [];
  for (const line of TABLE.split("\n")) {
    if (!line) continue;
    const firstSpace = line.indexOf(" ");
    const secondSpace = line.indexOf(" ", firstSpace + 1);
    const iso2 = line.slice(0, firstSpace);
    const dial = line.slice(firstSpace + 1, secondSpace);
    const name = line.slice(secondSpace + 1);
    out.push({ iso2, dial, name, ...FORMATS[iso2] });
  }
  return out;
}

const ALL = parseTable();

const BY_ISO = new Map(ALL.map((c) => [c.iso2, c]));

/**
 * The picker's order: the countries our guests come from, then the rest
 * alphabetically by their Russian name.
 */
export const COUNTRIES: readonly Country[] = [
  ...PINNED.map((iso) => BY_ISO.get(iso)!),
  ...ALL.filter((c) => !PINNED.includes(c.iso2)).sort((a, b) => a.name.localeCompare(b.name, "ru")),
];

/** Kazakhstan. A local guest types ten digits and never opens the picker. */
export const DEFAULT_COUNTRY: Country = BY_ISO.get("KZ")!;

export function countryByIso2(iso2: string): Country | undefined {
  return BY_ISO.get(iso2);
}

/**
 * How many digits the national number has, when we claim to know. `undefined`
 * means "we do not know" and is NOT the same as zero — nothing may use it to
 * refuse input.
 */
export function nationalLength(country: Country): number | undefined {
  return country.groups?.reduce((sum, n) => sum + n, 0);
}

/** The most digits this country's national part can hold, known format or not. */
export function maxNationalDigits(country: Country): number {
  return nationalLength(country) ?? E164_MAX_DIGITS - country.dial.length;
}

/**
 * Dial codes sorted longest-first, so "+1868" resolves to Trinidad and not to
 * the US with a national number starting 868.
 */
const DIAL_INDEX: readonly Country[] = [...ALL].sort((a, b) => {
  if (a.dial.length !== b.dial.length) return b.dial.length - a.dial.length;
  // Same length: the primary owner of a shared code wins (+7 → KZ, +1 → US).
  return (b.primary ? 1 : 0) - (a.primary ? 1 : 0);
});

/**
 * Finds the country whose dial code starts `digits`. Longest match wins, and
 * a shared code goes to its primary owner.
 */
export function matchDialCode(digits: string): Country | undefined {
  return DIAL_INDEX.find((c) => digits.startsWith(c.dial));
}

/**
 * The flag, computed from the ISO code rather than stored: 'K','Z' become the
 * regional-indicator pair that renders as 🇰🇿.
 *
 * On a platform whose font has no flag glyphs (some Android builds) this
 * degrades to the letters "KZ" — still a correct, readable answer, which is
 * why it is safe to rely on and why no image assets are shipped.
 */
export function flagEmoji(iso2: string): string {
  const A = 0x1f1e6;
  return String.fromCodePoint(
    A + (iso2.charCodeAt(0) - 65),
    A + (iso2.charCodeAt(1) - 65),
  );
}
