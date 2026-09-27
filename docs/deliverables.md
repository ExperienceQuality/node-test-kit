# Project deliverables

This table is the project-level inventory. Package-specific implementation
details live beside each package.

| Deliverable | Location | What it provides | Consumer value |
| --- | --- | --- | --- |
| Backend REST client | `packages/rest-client/` | PactumJS-backed fluent HTTP requests with request/response capture | Test application APIs and inspect the complete exchange |
| Database kit | `packages/db/` | Typed PostgreSQL clients built with Kysely and `pg` | Use named, type-safe database connections in tests |
| Stub server kit | `packages/stub/` | PactumJS mock server and interaction lifecycle | Stub downstream services with per-test cleanup |
| Core runtime | `packages/core/` | Run context, backend process, REST, and stub composition | Share one platform-owned test lifecycle |
| Public Node test kit | `packages/node-test-kit/` | Stable `node-test-kit` package and Vitest adapter | Import the supported test API from one package |
| Cypress platform package | `packages/cy-platform/` | `cy.api()` integration, `cy.rest()`, and Cypress Node hooks | Standardize Cypress plugins and setup across projects |
| Cypress project CLI | `packages/create-cy-platform/` | Greenfield/brownfield project scaffolding | Create a configured Cypress project with `npx` |
| Shell scaffolder fallback | `scripts/scaffold-cy-platform.sh` | Dependency-free Unix scaffolding script | Bootstrap projects when npm CLI execution is unavailable |
| Consumer showcase | `showcase/backend-e2e/` | Packed-package backend E2E example | Verify the documented consumer workflow end to end |
| Release verification | `scripts/verify-structure.mjs`, `scripts/verify-packages.mjs` | Workspace boundary and fresh-consumer archive checks | Catch broken package boundaries before release |
