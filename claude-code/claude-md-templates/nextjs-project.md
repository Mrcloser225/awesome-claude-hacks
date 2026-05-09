# CLAUDE.md

This file is read by Claude Code at the start of every session. Keep it tight, current, and honest.

## Project

A Next.js 15 application using the App Router. TypeScript everywhere. Tailwind for styling. Deployed on Vercel.

## Stack

- Next.js 15 (App Router, React Server Components by default)
- TypeScript strict mode
- Tailwind CSS
- shadcn/ui for component primitives
- Postgres via Neon for the production database
- Drizzle ORM
- Auth via Clerk
- Vercel for hosting and preview deploys

## Directory layout

```
app/                    Routes (App Router)
  api/                  Route handlers
  (marketing)/          Marketing pages, no auth
  (app)/                Authenticated app, layout enforces login
components/             React components
  ui/                   shadcn primitives, do not edit directly
  shared/               Shared composed components
lib/                    Pure helpers, no JSX
  db/                   Drizzle schema and client
  auth/                 Clerk helpers
server/                 Server actions and server-only code
public/                 Static assets
tests/                  Vitest unit and integration tests
e2e/                    Playwright tests
```

## Conventions

- Server Components by default. Add "use client" only when you need state, effects, or browser APIs.
- Server Actions for mutations. Route handlers only for third-party webhooks.
- Drizzle queries live in `lib/db/queries/` and are imported by server components and actions.
- All forms use `react-hook-form` plus `zod`. No raw FormData parsing.
- Errors thrown in Server Components surface to the nearest `error.tsx`. Do not wrap them.
- Loading states use `loading.tsx` files, not Suspense in components, unless we have a specific reason.

## Commands

```bash
pnpm dev              # local dev server, port 3000
pnpm build            # production build
pnpm start            # run production build locally
pnpm lint             # eslint
pnpm typecheck        # tsc noEmit
pnpm test             # vitest unit and integration
pnpm test:e2e         # playwright
pnpm db:migrate       # apply Drizzle migrations
pnpm db:studio        # Drizzle Studio
```

## Definition of done

A change is done when:
- `pnpm lint` passes
- `pnpm typecheck` passes
- `pnpm test` passes
- A preview deploy on Vercel renders the changed pages without console errors
- New behavior has at least one test at the right layer
- The PR description explains what changed and why

## Things to never do without asking

- Add a new top-level dependency
- Change the database schema
- Modify `components/ui/` files (regenerate via shadcn CLI instead)
- Disable a lint rule project-wide
- Skip auth checks on a route
- Use `any` to silence TypeScript

## Things to default to

- Plain function components, no class components
- `"use server"` for actions, scoped to a single file
- Co-locate a route's components inside the route folder unless reused
- Use the existing design tokens in `tailwind.config.ts`, do not introduce new ones casually
- Write the test alongside the change in the same PR

## Open questions for the human

If something is unclear, ask before guessing. Common ambiguities:
- Should this be public or behind auth?
- Do we own the data or is this a third-party feed?
- Is performance or correctness the higher priority for this code path?

## Voice

- Plain English in commit messages and PR descriptions
- No filler, no marketing language
- Trade-offs explicit when making non-obvious choices
