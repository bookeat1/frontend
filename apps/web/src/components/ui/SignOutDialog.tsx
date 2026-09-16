"use client";

import { Button } from "@web/components/ui/Button";
import { Modal } from "@web/components/ui/Modal";
import { SignOutIcon } from "@web/components/ui/SignOutIcon";
import { useLocale } from "@web/lib/locale";

/**
 * Подтверждение выхода (Figma `qmMsg4jO1ggmyEHNIAD2ll`, узел 5265:21449,
 * `signOutDialog`) — узор `CancelBookingDialog`/`RemovePreorderDialog` (общий
 * `Modal` + два `Button`, не `window.confirm`), но по раскладке самого узла:
 * круглый розовый бейдж с иконкой двери над заголовком (`Modal.centerIcon`),
 * всё по центру, ряд из двух кнопок РАВНОЙ ширины на всю карточку.
 *
 * Порядок и стили кнопок — как в макете, а не как в двух готовых диалогах
 * выше (там отмена слева `secondary`, подтверждение справа `primary`):
 * здесь подтверждение выхода — ЛЕВАЯ кнопка, обводочная (`outline`), а
 * отмена — ПРАВАЯ, залитая фирменным красным (`primary`) и потому визуально
 * заметнее. Это осознанный дизайн (мягкий нудж не выходить), не опечатка.
 *
 * ОБЩИЙ компонент для ОБЕИХ кнопок «Выйти» на сайте — меню раздела на
 * `/profile` (`ProfileScreen.tsx`) и шапка (`SiteChrome.tsx`, видна на всех
 * страницах). Тексты общие (`t.web.profile.signOutDialog`) — диалог один и
 * тот же вне зависимости от места клика, дублировать компонент нельзя.
 */
export function SignOutDialog({ onConfirm, onClose }: { onConfirm: () => void; onClose: () => void }) {
  const { t } = useLocale();
  const texts = t.web.profile.signOutDialog;

  return (
    <Modal
      title={texts.title}
      description={texts.text}
      onClose={onClose}
      centerIcon={
        <span
          aria-hidden="true"
          className="flex h-signout-icon-badge w-signout-icon-badge shrink-0 items-center justify-center rounded-full bg-signout-icon-bg text-brand"
        >
          <SignOutIcon />
        </span>
      }
    >
      <div className="flex w-full gap-3">
        <Button variant="outline" size="profile" className="flex-1" onClick={onConfirm}>
          {texts.confirm}
        </Button>
        <Button variant="primary" size="profile" className="flex-1" onClick={onClose}>
          {texts.cancel}
        </Button>
      </div>
    </Modal>
  );
}
