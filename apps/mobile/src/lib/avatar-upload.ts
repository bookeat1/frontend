import * as ImagePicker from "expo-image-picker";

/**
 * Выбор фотографии профиля и её отправка.
 *
 * Живёт отдельно от экрана, потому что здесь три разных исхода, и экрану важно
 * различать их, а не показывать одну ошибку на всё:
 *   - человек закрыл галерею, ничего не выбрав — это НЕ ошибка и сообщать не о
 *     чем;
 *   - галерея запрещена в системных настройках — просить ещё раз бесполезно,
 *     это чинится только в настройках телефона, и текст должен вести туда;
 *   - отправка не удалась — вот здесь уместно «попробуйте ещё раз».
 *
 * Разрешение спрашивается ТОЛЬКО в момент, когда человек уже нажал на аватар.
 * Спросить заранее, «на всякий случай», значит потребовать доступ к галерее у
 * того, кто фотографию менять не собирался.
 */

export type AvatarPickOutcome =
  | { kind: "uploaded"; url: string }
  | { kind: "cancelled" }
  | { kind: "denied" }
  /** reason различает то, с чем человек МОЖЕТ что-то сделать: слишком большой
   * файл и неподходящий формат чинятся выбором другого фото, всё остальное —
   * только повтором. Один текст на все случаи отправлял бы человека жать
   * «ещё раз» там, где повтор бесполезен. */
  | { kind: "failed"; reason: AvatarFailure; error: unknown };

export type AvatarFailure = "too_large" | "bad_format" | "other";

/** Слой доступа, который умеет отправить аватар. Узкий тип — чтобы функцию
 * можно было проверить на подделке без сети. */
export interface AvatarUploader {
  uploadAvatar(file: { uri: string; name?: string; type?: string }): Promise<string>;
}

export async function pickAndUploadAvatar(uploader: AvatarUploader): Promise<AvatarPickOutcome> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return { kind: "denied" };
  }

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    // Аватар рисуется кругом, поэтому квадрат режется сразу: иначе человек
    // выбирает горизонтальный кадр, а видит из него случайную середину.
    allowsEditing: true,
    aspect: [1, 1],
    // Сжатие на телефоне, а не отправка оригинала: снимок современной камеры
    // весит больше нашего предела в 5 МБ, а показывается кружком в 96 точек.
    quality: 0.8,
  });
  if (picked.canceled || picked.assets.length === 0) {
    return { kind: "cancelled" };
  }

  const asset = picked.assets[0];
  try {
    const url = await uploader.uploadAvatar({
      uri: asset.uri,
      name: asset.fileName ?? "avatar.jpg",
      type: asset.mimeType ?? "image/jpeg",
    });
    return { kind: "uploaded", url };
  } catch (error) {
    return { kind: "failed", reason: failureReason(error), error };
  }
}

/** Раскладывает отказ сервера по тому, что человек может сделать. Статусы —
 * ровно те, что отдаёт загрузка аватара (media/avatar.go): 413 больше 5 МБ,
 * 422 не картинка или неподдерживаемый тип. */
function failureReason(error: unknown): AvatarFailure {
  const status = (error as { status?: number } | null)?.status;
  if (status === 413) return "too_large";
  if (status === 422) return "bad_format";
  return "other";
}
