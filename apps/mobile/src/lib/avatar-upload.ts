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
  | { kind: "failed"; error: unknown };

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
    return { kind: "failed", error };
  }
}
