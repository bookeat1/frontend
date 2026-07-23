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
pnpm --filter @bookeat/mobile export   # expo export, headless build check
```

## Data layer

All screens read data through `useRepository()` (`apps/mobile/src/lib/repository.tsx`),
which is currently wired to `MockRestaurantRepository` from `@bookeat/api`. Swapping
to a real backend means writing a sibling class implementing `RestaurantRepository`
and changing the `value` passed to `RepositoryProvider` — no screen changes needed.

## Known gaps (see PR description for full list)

- Figma MCP tools were unavailable in the session that built this scaffold, so
  screens follow the text spec (node names/sizes/section structure), not a
  pixel-accurate readout of the actual file. Colors/spacing/exact copy need a
  design review pass against fileKey `7rBjjTjp4FbxV9SCJmypWF`.
- Photos are placeholder `picsum.photos` images, not the real exported Figma assets.
- App icon/splash are Expo's stock placeholders, not the BookEat brand.
