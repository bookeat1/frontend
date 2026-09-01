import { Linking, Platform } from "react-native";

/**
 * Opening things that live outside the app.
 *
 * Every helper is best-effort and NEVER throws: a device with no browser, no
 * dialer or no maps app is a real configuration (tablets, kiosk devices,
 * emulators), and a rejected `Linking.openURL` there must not crash a screen
 * the guest opened to read their booking. The caller decides whether to show
 * anything; today nothing needs to, because the affordance is only rendered
 * when the underlying value exists.
 */
async function open(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

/** Adds a scheme to a bare host so "instagram.com/x" is not treated as a
 * relative path (the backend stores social links as free text). */
export function toHttpUrl(raw: string): string {
  const value = raw.trim();
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value.replace(/^\/+/, "")}`;
}

export function openWebsite(url: string): Promise<boolean> {
  return open(toHttpUrl(url));
}

/**
 * Страница приложения в системных настройках телефона.
 *
 * Единственный путь назад для гостя, которому система запретила уведомления:
 * диалог она показывает один раз, и после отказа `requestPermissionsAsync`
 * возвращает «нет», ничего не показав. Как и всё в этом файле — best-effort:
 * на устройстве без такой страницы возвращается false, а не исключение.
 */
export async function openAppSettings(): Promise<boolean> {
  try {
    await Linking.openSettings();
    return true;
  } catch {
    return false;
  }
}

/**
 * WhatsApp. The stored value may be a full wa.me link or a bare phone number,
 * so a number is normalised to digits and turned into the documented
 * https://wa.me/<digits> form, which both the app and the web client handle.
 */
export function openWhatsApp(value: string): Promise<boolean> {
  const raw = value.trim();
  if (/^https?:\/\//i.test(raw) || raw.startsWith("whatsapp:")) return open(raw);
  const digits = raw.replace(/\D+/g, "");
  if (!digits) return Promise.resolve(false);
  return open(`https://wa.me/${digits}`);
}

/**
 * Support contact for the empty/error states' «Написать в поддержку» link.
 *
 * The app has NO support channel wired yet — there is no support number, email
 * or chat URL anywhere in the codebase or the backend contract. Rather than
 * invent one (a wrong `wa.me` number would dial a real stranger), this is an
 * explicit `undefined` placeholder and `openSupport` is no-op-safe: the link
 * renders and is tappable, but does nothing until a real contact is set here.
 * Flagged in the delivery report — set this to the real `wa.me`/`https`/`mailto`
 * URL when support gives us one, and every state's link starts working with no
 * further code change.
 */
export const SUPPORT_CONTACT_URL: string | undefined = undefined;

/** Opens the support contact if one is configured; a safe no-op otherwise. */
export function openSupport(): Promise<boolean> {
  if (!SUPPORT_CONTACT_URL) return Promise.resolve(false);
  return open(SUPPORT_CONTACT_URL);
}

/** Instagram. A bare "@handle" or "handle" becomes a profile URL. */
export function openInstagram(value: string): Promise<boolean> {
  const raw = value.trim();
  if (/^https?:\/\//i.test(raw)) return open(raw);
  const handle = raw.replace(/^@/, "").replace(/^instagram\.com\//i, "");
  if (!handle) return Promise.resolve(false);
  return open(`https://instagram.com/${handle}`);
}

/** `tel:` with every separator stripped — "+7 (707) 547 47 47" as stored by
 * the backend is not a valid tel: payload. */
export function openPhone(phone: string): Promise<boolean> {
  const cleaned = phone.replace(/[^\d+]/g, "");
  if (!cleaned) return Promise.resolve(false);
  return open(`tel:${cleaned}`);
}

/**
 * The device's maps app at the venue's coordinates.
 *
 * iOS gets Apple Maps' `maps:` (which also hands off to Google Maps if the
 * guest set that as default via a universal link, but `maps:` is the one
 * scheme guaranteed to exist), Android gets the standard `geo:` intent with a
 * label, and web/anything else falls back to a Google Maps URL. The label is
 * URI-encoded because real venue names contain spaces, commas and Cyrillic.
 */
export function openMap(input: {
  latitude: number;
  longitude: number;
  label: string;
}): Promise<boolean> {
  const { latitude, longitude, label } = input;
  const coords = `${latitude},${longitude}`;
  const encoded = encodeURIComponent(label);
  if (Platform.OS === "ios") {
    return open(`maps:0,0?q=${encoded}@${coords}`);
  }
  if (Platform.OS === "android") {
    return open(`geo:${coords}?q=${coords}(${encoded})`);
  }
  return open(`https://www.google.com/maps/search/?api=1&query=${coords}`);
}
