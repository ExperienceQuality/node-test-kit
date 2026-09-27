# node-test-kit

Vitest-based foundation for backend functional and API E2E testing.

The repository is a private npm workspace. Consumer-facing packages and
platform documentation are split into focused documents:

| Topic | Documentation |
| --- | --- |
| What this project delivers | [docs/deliverables.md](docs/deliverables.md) |
| Node/Vitest test kit usage | [docs/node-test-kit.md](docs/node-test-kit.md) |
| Cypress platform and scaffolding | [docs/cypress-platform.md](docs/cypress-platform.md) |
| TypeScript development and release checks | [docs/development.md](docs/development.md) |
| Cypress package internals | [packages/cy-platform/README.md](packages/cy-platform/README.md) |
| Node test-kit package internals | [packages/node-test-kit/README.md](packages/node-test-kit/README.md) |

## Quick start

Install dependencies and validate the workspace:

```bash
npm install
npm run check
npm test
```

For the backend test kit, start with:

```ts
import { defineConfig } from 'node-test-kit/vitest/config';

export default defineConfig({
  application: { url: 'http://127.0.0.1:4000/health' }
});
```

```ts
import { test } from 'node-test-kit/vitest';

test('uses the platform-owned kit fixture', async ({ kit }) => {
  console.log(kit.rest, kit.stub, kit.run);
});
```

For Cypress projects, use the versioned CLI:

```bash
npx @experiencequality/create-cy-platform@0.1.0 brownfield .
npx @experiencequality/create-cy-platform@0.1.0 greenfield ../orders-cypress --install
```

The dependency-free Unix fallback is documented in
[docs/cypress-platform.md](docs/cypress-platform.md).
