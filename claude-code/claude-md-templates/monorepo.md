# CLAUDE.md

This is a monorepo. Read this file first, then the package-specific CLAUDE.md inside whatever package you are working on.

## Project

A pnpm plus Turborepo monorepo. Multiple deployable apps and shared libraries. TypeScript everywhere.

## Top-level layout

```
apps/
  web/                  Next.js public site
  app/                  Next.js authenticated app
  api/                  Node API, deploys as a Vercel function
  worker/               Background worker, deploys to a different runtime
packages/
  ui/                   Shared React components
  config/               Shared eslint, tsconfig, tailwind presets
  db/                   Drizzle schema and queries, shared by api and worker
  auth/                 Auth helpers shared across apps
  utils/                Pure helpers, zero deps on app frameworks
tools/
  scripts/              Repo-level scripts (release, codegen, migrations)
.github/                CI workflows
```

## Stack

- pnpm workspaces
- Turborepo for task orchestration
- TypeScript strict mode, project references where it pays off
- Changesets for versioning shared packages

## Dependency rules

The dependency graph is enforced.

- Apps may depend on packages
- Packages may depend on other packages, only if no cycle is introduced
- Apps may NOT depend on other apps
- A package may NOT depend on an app

If you need code shared between two apps, lift it into a package. Do not cross-import between apps.

## Commands

All commands run from the repo root unless noted.

```bash
pnpm install                     # install everything
pnpm dev                         # dev mode for all apps in parallel
pnpm dev --filter web            # dev only for one app
pnpm build                       # build everything (turbo handles cache)
pnpm lint                        # lint everything
pnpm typecheck                   # typecheck everything
pnpm test                        # test everything
pnpm test --filter db            # test one package
pnpm changeset                   # create a changeset for a versioned change
pnpm changeset version           # bump versions based on accumulated changesets
```

## Per-app and per-package CLAUDE.md

Each app and each shared package has its own CLAUDE.md with stack-specific rules. Read it before working in that subtree:

- `apps/web/CLAUDE.md`
- `apps/app/CLAUDE.md`
- `apps/api/CLAUDE.md`
- `apps/worker/CLAUDE.md`
- `packages/ui/CLAUDE.md`
- `packages/db/CLAUDE.md`

If a sub-CLAUDE.md does not exist yet, create one when you start non-trivial work in that folder.

## Definition of done

For an app change:
- The app builds, lints, typechecks, tests
- Other apps that depend on changed packages also build clean
- Turborepo cache is hit on a re-run (proves no nondeterminism)

For a package change:
- The package builds and tests in isolation
- Every consumer (apps and packages) still builds and typechecks
- A changeset entry is added if the change is exported

## Things to never do without asking

- Add a new top-level package
- Change the relationship between packages
- Add a non-MIT-compatible dependency
- Modify the root tsconfig or eslint config
- Skip the changeset for a package change
- Make a breaking change to a shared package without a major bump

## Things to default to

- Path aliases configured in `packages/config/tsconfig` (no relative imports across packages)
- Shared eslint config from `@repo/config`
- Co-locate test files with source
- One PR per concern, even if it touches multiple packages

## Working efficiently in a monorepo

- Use `pnpm --filter <pkg>` aggressively. Do not run the full repo when you do not need to.
- Run `pnpm typecheck --filter ...^web` to typecheck everything that web depends on, plus web.
- Use `turbo run` cache to avoid recomputing unchanged packages. Trust the cache.
- Keep packages small. A 5-file package is better than a 50-file package.

## Versioning policy

- Apps follow continuous deployment, no version numbers, deploy on merge to main.
- Packages follow semantic versioning via changesets.
- A package is "1.x" stable if external consumers depend on it. Otherwise it can be "0.x".

## Voice

- Commit prefix indicates scope: `feat(web): ...`, `fix(db): ...`, `chore(repo): ...`
- PR titles match the prefix style
- One PR should not span more than 3 packages unless it is a coordinated rename
