import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * У смены фотографии три исхода, которые легко слить в один — и каждое слияние
 * бьёт по живому человеку:
 *
 *   - человек закрыл галерею, ничего не выбрав. Показать здесь ошибку значит
 *     обвинить его в том, что он передумал;
 *   - галерея запрещена в системных настройках. «Попробуйте ещё раз» здесь
 *     врёт: сколько ни пробуй, галерея не откроется, чинится это только в
 *     настройках телефона;
 *   - отправка не удалась. Вот тут «попробуйте ещё раз» — правда.
 *
 * Поэтому проверяется не «вернулась ли ссылка», а что эти три случая
 * различимы.
 */

const requestPermission = vi.fn();
const launchLibrary = vi.fn();

vi.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: () => requestPermission(),
  launchImageLibraryAsync: (options: unknown) => launchLibrary(options),
}));

const { pickAndUploadAvatar } = await import("../avatar-upload");

afterEach(() => {
  vi.clearAllMocks();
});

function uploader(impl: (file: { uri: string }) => Promise<string>) {
  return { uploadAvatar: vi.fn(impl) };
}

describe("pickAndUploadAvatar", () => {
  it("отправляет выбранное фото и возвращает ссылку с сервера", async () => {
    requestPermission.mockResolvedValue({ granted: true });
    launchLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///tmp/pic.jpg", fileName: "pic.jpg", mimeType: "image/jpeg" }],
    });
    const up = uploader(async () => "https://cdn.example/avatar.jpg");

    const outcome = await pickAndUploadAvatar(up);

    expect(outcome).toEqual({ kind: "uploaded", url: "https://cdn.example/avatar.jpg" });
    expect(up.uploadAvatar).toHaveBeenCalledWith({
      uri: "file:///tmp/pic.jpg",
      name: "pic.jpg",
      type: "image/jpeg",
    });
  });

  it("закрытая галерея — не ошибка", async () => {
    requestPermission.mockResolvedValue({ granted: true });
    launchLibrary.mockResolvedValue({ canceled: true, assets: [] });
    const up = uploader(async () => "unused");

    expect(await pickAndUploadAvatar(up)).toEqual({ kind: "cancelled" });
    expect(up.uploadAvatar).not.toHaveBeenCalled();
  });

  it("отказ в доступе отличается от сбоя отправки", async () => {
    requestPermission.mockResolvedValue({ granted: false });
    const up = uploader(async () => "unused");

    expect(await pickAndUploadAvatar(up)).toEqual({ kind: "denied" });
    // Галерея даже не открывалась: спрашивать разрешение и тут же лезть в неё
    // значит показать пустой экран вместо объяснения.
    expect(launchLibrary).not.toHaveBeenCalled();
    expect(up.uploadAvatar).not.toHaveBeenCalled();
  });

  it("сбой отправки возвращается как сбой, а не как отмена", async () => {
    requestPermission.mockResolvedValue({ granted: true });
    launchLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///tmp/pic.jpg" }],
    });
    const boom = new Error("network");
    const up = uploader(async () => {
      throw boom;
    });

    expect(await pickAndUploadAvatar(up)).toEqual({ kind: "failed", error: boom });
  });

  it("режет квадрат и сжимает — аватар показывается кружком, а не отправляется оригиналом", async () => {
    requestPermission.mockResolvedValue({ granted: true });
    launchLibrary.mockResolvedValue({ canceled: true, assets: [] });

    await pickAndUploadAvatar(uploader(async () => "unused"));

    const options = launchLibrary.mock.calls[0][0] as {
      allowsEditing: boolean;
      aspect: number[];
      quality: number;
    };
    expect(options.allowsEditing).toBe(true);
    expect(options.aspect).toEqual([1, 1]);
    expect(options.quality).toBeLessThan(1);
  });
});
