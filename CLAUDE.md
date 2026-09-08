# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`bookeat-frontend` is the pnpm monorepo for **BookEat**: `apps/mobile` (Expo/React Native,
the guest app), `apps/admin` (Next.js, venue/platform dashboard), `apps/web` (Next.js, desktop
guest site), and shared `packages/api`, `packages/design-tokens`, `packages/i18n`, `packages/markdown`.

**Full architecture (why the monorepo is split this way, data flow, backend contract) lives in
`docs/ARCHITECTURE.md`. Design tokens, color roles, and recurring UI patterns live in
`docs/DESIGN_SYSTEM.md`. Product requirements are in `bookeat-backend/docs/PRD.md`.** Read the
relevant one before any non-trivial UI or cross-app change — this file only holds what must be
followed on every edit.

**Only `tech-lead` and `product-manager` edit `docs/ARCHITECTURE.md`, `docs/DESIGN_SYSTEM.md`
and `bookeat-backend/docs/PRD.md`.** Any other role that makes an architecturally or
product-significant change (new pattern, new token, new business rule) notes what needs
updating in its PR/report instead of editing the doc directly — `project-manager` checks at
acceptance whether that update actually landed.

## Commands

```bash
corepack prepare pnpm@10.34.5 --activate   # this repo requires pnpm, not npm
pnpm install

pnpm mobile start              # Expo dev server (apps/mobile)
pnpm mobile start -- --clear   # same, clearing Metro cache
pnpm --filter @bookeat/admin dev   # apps/admin dev server
pnpm --filter @bookeat/web dev     # apps/web dev server

pnpm run typecheck   # tsc --noEmit across apps/* + packages/*
pnpm run lint        # lint (mobile eslint config)
pnpm run test        # vitest run
pnpm run check       # typecheck + lint + test — run this before finishing any change, it's what CI runs
```

## Hard rules while editing

- **Design tokens, not raw values.** Colors/spacing/typography come from `packages/design-tokens`
  (`colors.ts`/`typography.ts`/`spacing.ts`/`fonts.ts` for mobile RN, `web.ts` for the Next.js apps
  — two separate files on purpose, see DESIGN_SYSTEM.md). Don't hardcode a hex or px value that
  already has a token.
- **Backend contract lives in `packages/api`.** New endpoints/DTOs get typed there once and consumed
  by all three apps — don't hand-roll fetch calls or duplicate response types inside an app.
  Error `code` (not the message) is what UI branches on, matching backend `domain.ErrorCode`.
- **Mobile vs web are separate visual languages**, not one theme with breakpoints — don't reuse a
  mobile component 1:1 on web or vice versa without checking DESIGN_SYSTEM.md's platform-differences
  section first.
- **i18n:** user-facing strings go through `packages/i18n`, never inline literals in a component.
- One app's dev server at a time unless the task needs otherwise — they share ports/workspace state.
- Run `pnpm run check` before calling a change done; a red typecheck/lint/test is not "почти готово".
