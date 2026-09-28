# @xq/test-cypress

`@xq/test-cypress` centralizes Cypress plugins, commands, and Node lifecycle hooks.
Package internals and source-module ownership are documented in
[packages/test-cypress/README.md](../packages/test-cypress/README.md).

## Installation

Install the facade directly in each Cypress consumer:

```bash
npm install --save-dev @xq/test-cypress cypress
```

Import `@xq/test-cypress` from support code and use `@xq/test-cypress/node`
from `cypress.config.ts`.
