#!/usr/bin/env bash
#
# Тексты окна «Доступно обновление BookEat» → в базу, без сборки приложения.
#
# ЗАЧЕМ ЭТОТ ФАЙЛ. Заголовок и сообщение окна приходят с сервера
# (GET /api/v1/app/version-check, backend ADR-039). В приложении лежат только
# ЗАПАСНЫЕ строки — на случай, когда ответа нет или в политике нет нужного
# языка. Пока в базе стоит засев миграции 0103, гость увидит ЕГО текст
# («Доступно обновление» / «Вышла новая версия BookEat…»), а не текст макета:
# ответ сервера всегда перебивает словарь. Этот скрипт приводит базу к макету.
#
# ЧТО ОН НЕ ДЕЛАЕТ. Не трогает пороги (min_supported_version,
# min_recommended_version), ссылку на магазин и тексты жёсткого режима: ручка
# работает как PATCH, отсутствующее поле сохраняется. Включение самой фичи —
# отдельное решение и отдельный запрос.
#
# КОМУ МОЖНО. Только суперадмину: PUT /api/v1/admin/app-update-policies/:platform
# сидит за RequireRole(admin), и это тот же переключатель, который умеет
# поставить стену перед всеми гостями сразу.
#
# КАК ЗАПУСКАТЬ (адрес обязателен, значения по умолчанию нет — чтобы прод
# нельзя было задеть, забыв аргумент):
#
#   ADMIN_TOKEN=... ./apply.sh https://test.backend.book-eat.com
#
# Токен берётся из окружения и в репозиторий не попадает.
set -euo pipefail

BASE="${1:-}"
if [[ -z "$BASE" ]]; then
  echo "usage: ADMIN_TOKEN=... $0 <base-url>   # например https://test.backend.book-eat.com" >&2
  exit 2
fi
if [[ -z "${ADMIN_TOKEN:-}" ]]; then
  echo "ADMIN_TOKEN не задан" >&2
  exit 2
fi

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BODY="$HERE/recommended-wording.json"

for platform in ios android; do
  echo "→ $platform"
  curl -fsS -X PUT "$BASE/api/v1/admin/app-update-policies/$platform" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    --data-binary @"$BODY"
  echo
done
