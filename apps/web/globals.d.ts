// Побочные импорты глобальных стилей под голым `tsc` (сборкой занимается Next,
// здесь только типы). Тот же приём, что в apps/admin/globals.d.ts.
declare module "*.css";

// Фикстуры `@bookeat/api` импортируют фотографии напрямую. Локально это
// разрешается через next-env.d.ts, который Next создаёт при первом запуске и
// который в .gitignore, — на чистом клоне (CI) его нет. Тип `number`, потому
// что Metro отдаёт идентификатор ресурса (см. packages/api/src/assets.d.ts).
declare module "*.jpg" {
  const value: number;
  export default value;
}
