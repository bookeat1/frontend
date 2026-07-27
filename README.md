# BookEat — frontend monorepo

Mobile app (Expo / React Native / TypeScript) with a structure ready for a
future Next.js web app to sit alongside it.

## Layout

```
apps/
  mobile/            Expo app (expo-router), screens & app-specific components
packages/
  design-tokens/      Colors, spacing, typography — no magic numbers in screens
  i18n/               RU dictionary (kk/en to be added later, same shape)
  api/                Domain types + RestaurantRepository interface + mock impl
```

## Requirements

- Node 20+, pnpm (via corepack: `corepack enable && corepack prepare pnpm@latest --activate`,
  or `npm i -g pnpm` if corepack can't symlink in your environment)

## Setup

```bash
pnpm install
```

## Run

```bash
pnpm --filter @bookeat/mobile start   # Expo dev server (scan QR with Expo Go)
pnpm --filter @bookeat/mobile android
pnpm --filter @bookeat/mobile ios
pnpm --filter @bookeat/mobile web
```

## Checks

```bash
pnpm run typecheck   # tsc --noEmit across apps/* and packages/*
pnpm run lint        # eslint on apps/mobile
pnpm run test        # vitest, whole monorepo, single deterministic run
pnpm run check       # all three, in that order
pnpm --filter @bookeat/mobile export   # expo export, headless build check
```

Tests live next to what they cover, in `__tests__` folders. **A bug fix comes
with the test that would have caught it** — see [TESTING.md](./TESTING.md) for
the runner, the conventions and what is deliberately not covered.

## Data layer

All screens read data through `useRepository()` (`apps/mobile/src/lib/repository.tsx`).
Which implementation is live is decided by one environment variable:

```bash
# apps/mobile/.env — see .env.example
EXPO_PUBLIC_API_URL=https://test.backend.book-eat.com/api/v1
```

- **set** → `HttpRestaurantRepository`, real backend-core data;
- **unset/blank** → `MockRestaurantRepository`, the app runs with zero backend setup.

Both implement the same `RestaurantRepository` interface, so no screen knows which
one it's talking to.

What the real backend does and doesn't cover today (see `packages/api/src/unknown-data.ts`
for the authoritative, per-field list):

| Screen data | Source |
|---|---|
| Каталог, поиск, фильтры кухни/города/цены | `GET /restaurants`, `GET /restaurants/search`, `GET /cities` |
| Карточка заведения, часы, контакты, соцсети | `GET /restaurants/:id` |
| Рейтинг и число отзывов | `GET /restaurants/:id/reviews/summary` |
| «Популярное в меню» | `GET /restaurants/:id/menu` |
| Акции | `GET /restaurants/:id/promos` (без картинок — их нет в API) |
| Расстояние, превью карты, столики, подсказки поиска | заглушки, полей в API нет |

Cuisines come from the venues' free-text `cuisine_type`, **not** from
`GET /restaurant-categories` — that endpoint is empty on the live catalog and no
venue carries a `category_id`.

## Known gaps (see PR description for full list)

- Figma MCP tools were unavailable in the session that built this scaffold, so
  screens follow the text spec (node names/sizes/section structure), not a
  pixel-accurate readout of the actual file. Colors/spacing/exact copy need a
  design review pass against fileKey `7rBjjTjp4FbxV9SCJmypWF`.
- Photos are placeholder `picsum.photos` images, not the real exported Figma assets.
- App icon/splash are Expo's stock placeholders, not the BookEat brand.
