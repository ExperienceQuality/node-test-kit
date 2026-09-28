# @xq/test-cypress

Platform-owned Cypress bundle. One browser import installs platform commands and plugins. One Node entrypoint installs Cypress run hooks.

## Why this package exists

Projects should not each choose plugin versions, register commands differently, or copy platform test setup. `@xq/test-cypress` centralizes that contract:

- `@xq/test-cypress`: browser-side plugins and commands
- `@xq/test-cypress/node`: Node-side Cypress lifecycle hooks
- one place to upgrade plugin versions and shared behavior

## Browser usage

Add package to a Cypress project:

```bash
npm install --save-dev @xq/test-cypress cypress
```

Import once from the testing-type support file:

```ts
// cypress/support/e2e.ts
import '@xq/test-cypress';
```

Cypress loads support code before every spec. The root entrypoint therefore installs browser commands for every spec without requiring imports in individual test files.

Current browser bundle:

- `cypress-plugin-api`, providing `cy.api()`
- `cy.rest(...requestArgs)`, forwarding requests to `cy.api()`
- `cy.rest(alias, ...requestArgs)`, aliasing response body under `@alias`

Examples:

```ts
cy.rest('POST', '/orders', { productId: 'p-123' })
  .its('status')
  .should('eq', 201);

cy.rest('createdOrder', 'POST', '/orders', { productId: 'p-123' });
cy.get('@createdOrder').its('productId').should('eq', 'p-123');
```

Without alias, `cy.rest()` does not create an alias. It yields the original Cypress response.

## Node lifecycle usage

Node hooks belong in `cypress.config.ts`, not the browser support file:

```ts
import { defineConfig } from 'cypress';
import { setupPlatform } from '@xq/test-cypress/node';

export default defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      return setupPlatform(on, config);
    },
  },
});
```

`@xq/test-cypress/node` currently registers the platform `before:run` hook. Add `after:run`, `before:spec`, or `after:spec` behavior in `src/setup.ts` when platform needs it. Node hooks cannot call `cy` commands.

## Source map

| File | What | Why | How it works |
| --- | --- | --- | --- |
| `src/index.ts` | Browser entrypoint | Gives consumers one import | Imports `cypress-plugin-api` and `commands/rest.ts` for side-effect registration |
| `src/commands/rest.ts` | Runtime `cy.rest()` command | Adds platform request behavior | Parses arguments, calls `cy.api()`, optionally aliases response body |
| `src/rest/types.ts` | `RestArgs`, `RestCommandArgs`, Cypress augmentation | Gives consumers autocomplete and compile-time checking | Extends `Cypress.Chainable` with `rest()` |
| `src/rest/parse.ts` | Pure argument parser | Keeps request parsing independent from Cypress runtime | Distinguishes optional alias from URL, method, or options |
| `src/node.ts` | Node public entrypoint | Separates Node imports from browser imports | Re-exports `setupPlatform` through `@xq/test-cypress/node` |
| `src/setup.ts` | Node event registration | Centralizes run-level platform hooks | Receives Cypress `on` and `config`, registers events, returns config |
| `test/rest-command.test.ts` | Runtime command tests | Proves registration, forwarding, and alias behavior | Stubs Cypress globals and imports command module |
| `tsconfig.json` | Production build config | Emits package JavaScript and declarations | Includes only `src/`, writes to `dist/` |
| `tsconfig.test.json` | Test type-check config | Checks source and tests without emitting files | Extends build config, adds Vitest and Node types |
| `package.json` | Package contract | Defines exports, dependencies, scripts, and files | Maps `.` to browser entry and `./node` to Node entry |
| `README.md` | Consumer and contributor guide | Documents supported usage and ownership boundaries | Explains imports, commands, hooks, and source layout |

## Dependency rules

- `cypress` is a peer dependency. Consumer and package must use one Cypress installation.
- Cypress plugins used at runtime belong in `dependencies`.
- Build and test tools belong in `devDependencies`.
- Browser entrypoint must not import Node-only modules such as `fs` or database drivers.
- Node plugins must be exposed through a separate subpath such as `@xq/test-cypress/node`.

## Add a browser plugin or command

1. Add plugin to `dependencies`.
2. Import browser plugin from `src/index.ts`.
3. Put each command in `src/commands/`.
4. Put reusable argument parsing in a pure module under `src/`.
5. Extend Cypress types in `src/rest/types.ts` or a focused declaration module.
6. Add tests under `test/`.

## Add a Node plugin or lifecycle hook

1. Add Node-only implementation under `src/setup.ts` or a focused `src/node/` module.
2. Register events from `setupPlatform`.
3. Return the Cypress config when modifying it.
4. Expose it through `src/node.ts` and `package.json` `./node` export.
5. Wire it from `cypress.config.ts` with `setupNodeEvents`.

## Verify

```bash
npm run build --workspace @xq/test-cypress
npm run check --workspace @xq/test-cypress
npm test --workspace @xq/test-cypress
```
