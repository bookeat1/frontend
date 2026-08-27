import type { GuideCollection } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { ListMediaCard } from "../ListMediaCard";

const t = getDictionary();

/**
 * Карточка подборки («статьи») в списке гастрогида.
 *
 * Геометрия — общая `ListMediaCard` (макет 3z0f6dgev4HMwBAHPjTjPo, node
 * 3452:13344): снимок 198 со скруглением 22, название ВНУТРИ снимка. Владелец
 * попросил 2026-08-27, чтобы карточка статей выглядела как карточка на
 * странице поиска; до этого здесь была своя вёрстка с обложкой 206 и текстом
 * под ней.
 *
 * СЕРДЕЧКА НЕТ, хотя в макете оно нарисовано в правом верхнем углу кадра:
 * избранное на бэкенде покрывает заведения, события и акции — подборок в нём
 * нет. Нарисовать сердечко значило бы завести контрол, который ничего не
 * запоминает; такое из этого приложения уже убирали (см. память команды,
 * fake-favorite-heart). Появится ручка — сердечко вернётся сюда.
 *
 * Вторая строка — `subtitle`, а при его отсутствии начало `description`:
 * у живых подборок подзаголовок чаще пустой, а весь редакционный текст лежит
 * в описании, и строка из макета иначе просто не заполнилась бы. Никакой
 * выдуманной подписи («От BookEat» и прочего) тут нет.
 */
export function ArticleListCard({
  collection,
  onPress,
}: {
  collection: GuideCollection;
  onPress: (slug: string) => void;
}) {
  const summary = collection.subtitle || collection.description;

  return (
    <ListMediaCard
      title={collection.title}
      subtitle={summary}
      coverUri={collection.coverImageUrl}
      onPress={() => onPress(collection.slug)}
      accessibilityLabel={
        summary ? t.articles.card(collection.title, summary) : collection.title
      }
    />
  );
}
