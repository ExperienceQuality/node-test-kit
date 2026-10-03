# xq-test-platform

Vitest-based foundation for backend functional and API E2E testing.

The repository is a private npm workspace containing five internal consumer
packages. Consumer-facing packages and platform documentation are split into
focused documents:

| Topic | Documentation |
| --- | --- |
| What this project delivers | [docs/deliverables.md](docs/deliverables.md) |
| Node/Vitest test facade usage | [docs/test.md](docs/test.md) |
| Node Cucumber consumer guide | [docs/consumer-guide.md](docs/consumer-guide.md) |
| TypeScript development and release checks | [docs/development.md](docs/development.md) |
| Node test package internals | [packages/test/README.md](packages/test/README.md) |

## Quick start

Install dependencies and validate the workspace:

```bash
npm install
npm run check
npm test
```

For the backend test kit, start with:

```ts
import { defineConfig } from '@xq/test/vitest/config';

export default defineConfig({
  application: { url: 'http://127.0.0.1:4000/health' }
});
```

```ts
import { test } from '@xq/test/vitest';

test('uses the platform-owned kit fixture', async ({ kit }) => {
  console.log(kit.rest, kit.stub, kit.run);
});
```
