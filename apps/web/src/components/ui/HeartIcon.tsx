/**
 * Сердце избранного. Одно на весь сайт: оно стоит и на карточке заведения
 * (узел 3280:4745), и в шапке страницы заведения (узел 3525:14603), и второе,
 * «чуть другое», разъехалось бы с первым в первую же правку.
 *
 * Форма перерисована как inline-SVG из мобильного набора Phosphor: тянуть
 * иконочный пакет в веб ради одного контура не за что.
 */
export function HeartIcon({ filled, size = 20 }: { filled: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 20.7 3.9 12.6a5.4 5.4 0 0 1 7.6-7.6l.5.5.5-.5a5.4 5.4 0 0 1 7.6 7.6Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
